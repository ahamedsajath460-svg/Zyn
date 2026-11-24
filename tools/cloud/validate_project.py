#!/usr/bin/env python3
"""Zen AI Cloud Studio: static guard for a generated Android project BEFORE Gradle runs.

This is defence in depth, not a sandbox. The real isolation is: the build job has no secrets, a read-only token,
an ephemeral runner and an egress allowlist (see docs/cloud-studio/SECURITY.md). Gradle scripts are code, so no
text scan can prove a project harmless; this scan stops the obvious and accidental problems early.

usage: validate_project.py <project_dir> [--github-output]
exit 0 = ok (warnings allowed), 1 = rejected. Prints one JSON summary on the last line.
"""
import json, os, re, sys

ALLOWED_REPO_HOSTS = ("maven.google.com", "dl.google.com", "repo.maven.apache.org", "repo1.maven.org", "plugins.gradle.org", "services.gradle.org", "jitpack.io")
MAX_FILES, MAX_BYTES, MAX_FILE = 3000, 60 * 1024 * 1024, 5 * 1024 * 1024
SCRIPT_EXT = (".gradle", ".kts", ".properties")
FORBIDDEN_IN_SCRIPTS = [
    (r"System\.getenv|providers\.environmentVariable|getenv\(", "reads environment variables (could reach secrets)"),
    (r"ProcessBuilder|Runtime\.getRuntime\(\)|\bexec\s*\{|\bexec\(|commandLine\s*\(", "starts external processes"),
    (r"java\.net\.(URL|Socket|HttpURLConnection)|URL\(\s*[\"']http|HttpClient", "opens network connections from the build script"),
    (r"user\.home|\.ssh|/etc/passwd|GITHUB_TOKEN|ACTIONS_RUNTIME_TOKEN|ACTIONS_ID_TOKEN", "touches credentials or the home directory"),
    (r"\.github/|git\s+push", "tries to reach repository or workflow files"),
]
warnings, errors = [], []

def err(m): errors.append(m)
def warn(m): warnings.append(m)

def main():
    if len(sys.argv) < 2: print("usage: validate_project.py <project_dir>"); return 2
    root = os.path.normpath(sys.argv[1])
    if root.startswith("..") or os.path.isabs(root): err("project_dir must be a relative path inside the repository")
    if not os.path.isdir(root): err("project_dir '%s' does not exist" % root); return finish(root, {})
    files, total = [], 0
    for d, dirs, fs in os.walk(root):
        dirs[:] = [x for x in dirs if x not in (".git", "build", ".gradle", ".idea")]
        for n in fs:
            p = os.path.join(d, n)
            if os.path.islink(p): err("symbolic link not allowed: " + p); continue
            sz = os.path.getsize(p); total += sz; files.append(p)
            if sz > MAX_FILE: err("file too large (>5 MB): " + p)
            rel = os.path.relpath(p, root).replace(os.sep, "/")
            if rel.startswith(".github/") or "/.github/" in rel: err("workflow files are not allowed inside a project: " + rel)
    if len(files) > MAX_FILES: err("too many files (%d > %d)" % (len(files), MAX_FILES))
    if total > MAX_BYTES: err("project is larger than 60 MB")

    settings = [f for f in files if os.path.basename(f) in ("settings.gradle", "settings.gradle.kts") and os.path.dirname(f) == root]
    if not settings: err("no settings.gradle(.kts) in the project root")
    info = {"compile_sdk": "34", "app_module": "app", "application_id": "", "min_sdk": "", "target_sdk": ""}
    app_gradle = None
    for f in files:
        if os.path.basename(f) in ("build.gradle", "build.gradle.kts"):
            t = read(f)
            if re.search(r"com\.android\.application", re.sub(r"[^\n]*apply\s+false[^\n]*", "", t)): app_gradle = f; info["app_module"] = os.path.relpath(os.path.dirname(f), root).replace(os.sep, "/") or "."; break
    if not app_gradle: err("no module with the com.android.application plugin was found")
    else:
        t = read(app_gradle)
        for key, pat in (("compile_sdk", r"compileSdk(?:Version)?\s*[=\s]\s*(\d+)"), ("min_sdk", r"minSdk(?:Version)?\s*[=\s]\s*(\d+)"), ("target_sdk", r"targetSdk(?:Version)?\s*[=\s]\s*(\d+)"), ("application_id", r"applicationId\s*[=\s]\s*[\"']([\w.]+)[\"']")):
            m = re.search(pat, t)
            if m: info[key] = m.group(1)
        if not info["application_id"]:
            m = re.search(r"namespace\s*[=\s]\s*[\"']([\w.]+)[\"']", t)
            if m: info["application_id"] = m.group(1)
    if info["application_id"] and not re.fullmatch(r"[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+", info["application_id"]): err("invalid application id: " + info["application_id"])

    for f in files:
        rel = os.path.relpath(f, root).replace(os.sep, "/")
        if rel.endswith("gradle-wrapper.jar") or rel.endswith("gradle-wrapper.properties"): warn("project wrapper is ignored (Zen AI builds with its own pinned Gradle): " + rel)
        if rel.startswith("buildSrc/") or "/buildSrc/" in rel: warn("buildSrc runs arbitrary build code; review before trusting: " + rel)
        if not f.endswith(SCRIPT_EXT) or f.endswith("gradle-wrapper.properties"): continue
        t = read(f)
        for pat, why in FORBIDDEN_IN_SCRIPTS:
            if re.search(pat, t): err("%s %s" % (rel, why))
        for m in re.finditer(r"url\s*(?:=|\()\s*(?:uri\()?\s*[\"']([^\"']+)[\"']", t):
            u = m.group(1)
            if u.startswith("http") and not any(re.match(r"https://([\w.-]+\.)?" + re.escape(h) + r"(/|$)", u) for h in ALLOWED_REPO_HOSTS): err("%s uses a repository that is not on the allowlist: %s" % (rel, u))
            if u.startswith("http://"): err("%s uses a plain-http repository: %s" % (rel, u))
        if re.search(r"allowInsecureProtocol\s*=\s*true", t): err(rel + " allows insecure protocols")
    return finish(root, info)

def read(p):
    try:
        with open(p, encoding="utf-8", errors="replace") as f: return f.read()
    except OSError: return ""

def finish(root, info):
    for w in warnings: print("::warning::" + w)
    for e in errors: print("::error::" + e)
    out = dict(info); out["ok"] = not errors; out["errors"] = errors; out["warnings"] = warnings
    if "--github-output" in sys.argv and os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a") as f:
            for k in ("compile_sdk", "app_module", "application_id", "min_sdk", "target_sdk"): f.write("%s=%s\n" % (k, info.get(k, "")))
    print(json.dumps(out))
    return 0 if not errors else 1

if __name__ == "__main__": sys.exit(main())
