#!/usr/bin/env python3
"""Zen AI Cloud Studio helper for the GitHub Actions workflows.

  cloud_tools.py redact   < in > out                        mask secrets in a log
  cloud_tools.py annotate <build.log> <project_dir>         turn Gradle / Kotlin / javac / AAPT errors into ::error annotations
  cloud_tools.py collect  <project_dir> <out_dir> <variant> <build_id> [<gradle_version> <sdk_packages>]
                                                           copy APKs, write .sha256 files and build-info.json
"""
import glob, hashlib, json, os, re, subprocess, sys, datetime

SECRETS = [
    (re.compile(r"github_pat_[A-Za-z0-9_]{20,}"), "***"), (re.compile(r"gh[pousr]_[A-Za-z0-9]{20,}"), "***"),
    (re.compile(r"AIza[0-9A-Za-z_-]{30,}"), "***"), (re.compile(r"sk-[A-Za-z0-9_-]{20,}"), "***"),
    (re.compile(r"(?i)bearer\s+[A-Za-z0-9._~+/=-]{16,}"), "Bearer ***"),
    (re.compile(r"(?i)(password|passwd|secret|token|api[_-]?key|storePassword|keyPassword)(\s*[:=]\s*)[^\s'\"]{4,}"), r"\1\2***"),
    (re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----"), "***"),
]

def redact(t):
    for env in ("GITHUB_TOKEN", "KEYSTORE_PASSWORD", "KEY_PASSWORD", "CLOUD_KEYSTORE_PASSWORD", "CLOUD_KEY_PASSWORD"):
        v = os.environ.get(env)
        if v and len(v) >= 4: t = t.replace(v, "***")
    for rx, rep in SECRETS: t = rx.sub(rep, t)
    return t

def esc(s):  # workflow-command escaping
    return s.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")

def rel(path, root):
    p = path.replace("file://", "")
    i = p.find(root.rstrip("/") + "/")
    return p[i:] if i >= 0 else p

def annotate(log_path, root):
    try: text = open(log_path, encoding="utf-8", errors="replace").read()
    except OSError: print("no log"); return 0
    text = redact(text); n = 0; seen = set()
    def emit(kind, msg, f=None, line=None, col=None):
        nonlocal n
        key = (f, line, msg[:80])
        if n >= 15 or key in seen: return
        seen.add(key); n += 1
        loc = ""
        if f: loc += "file=%s," % f
        if line: loc += "line=%s," % line
        if col: loc += "col=%s," % col
        print("::%s %stitle=Cloud build::%s" % (kind, loc, esc(msg[:600])))
    for m in re.finditer(r"^e: (?:file://)?(\S+?):(\d+):(\d+)\s+(.*)$", text, re.M): emit("error", m.group(4), rel(m.group(1), root), m.group(2), m.group(3))
    for m in re.finditer(r"^(\S+\.(?:java|kt)):(\d+): error: (.*)$", text, re.M): emit("error", m.group(3), rel(m.group(1), root), m.group(2))
    for m in re.finditer(r"^(?:ERROR: )?(\S+\.xml):(\d+)(?::\d+)?: (?:AAPT: )?error: (.*)$", text, re.M): emit("error", m.group(3), rel(m.group(1), root), m.group(2))
    for m in re.finditer(r"^\s*> (Could not (?:resolve|find|get) .*)$", text, re.M): emit("error", m.group(1))
    for m in re.finditer(r"^\* What went wrong:\n(.+(?:\n.+)?)", text, re.M): emit("error", " ".join(m.group(1).split("\n")))
    for m in re.finditer(r"^(Execution failed for task .*)$", text, re.M): emit("error", m.group(1))
    if n == 0 and re.search(r"BUILD FAILED", text): emit("error", "Build failed. Open the build log for the full output.")
    return 0

def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""): h.update(b)
    return h.hexdigest()

def aapt2():
    home = os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT") or ""
    c = sorted(glob.glob(os.path.join(home, "build-tools", "*", "aapt2")), key=lambda p: [int(x) if x.isdigit() else 0 for x in re.split(r"[.\-rc]+", p.split("/")[-2])])
    return c[-1] if c else None

def badging(apk):
    tool = aapt2()
    if not tool: return {}
    try: out = subprocess.run([tool, "dump", "badging", apk], capture_output=True, text=True, timeout=60).stdout
    except Exception: return {}
    g = lambda rx: (re.search(rx, out) or [None, ""])[1]
    return {"package": g(r"package: name='([^']*)'"), "versionName": g(r"versionName='([^']*)'"), "versionCode": g(r"versionCode='([^']*)'"), "minSdk": g(r"sdkVersion:'(\d+)'"), "targetSdk": g(r"targetSdkVersion:'(\d+)'")}

def collect(project, out, variant, build_id, gradle_version="", sdk_packages=""):
    os.makedirs(out, exist_ok=True)
    apks = sorted(glob.glob(os.path.join(project, "**", "build", "outputs", "apk", "**", "*.apk"), recursive=True))
    items = []
    for a in apks:
        name = os.path.basename(a)
        if variant == "debug" and "debug" not in a.lower(): continue
        if variant == "release" and "release" not in a.lower(): continue
        if "androidTest" in a: continue
        dst = os.path.join(out, name); open(dst, "wb").write(open(a, "rb").read())
        d = sha256(dst); open(dst + ".sha256", "w").write("%s  %s\n" % (d, name))
        items.append(dict(name=name, size=os.path.getsize(dst), sha256=d, **badging(dst)))
    info = {"build_id": build_id, "variant": variant, "project_dir": project, "apks": items, "gradle_version": gradle_version, "sdk_packages": sdk_packages,
            "signing": "debug key (Android debug keystore)" if variant == "debug" else "UNSIGNED - sign with cloud-android-release.yml",
            "run_id": os.environ.get("GITHUB_RUN_ID", ""), "run_attempt": os.environ.get("GITHUB_RUN_ATTEMPT", ""), "commit": os.environ.get("GITHUB_SHA", ""),
            "built_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}
    json.dump(info, open(os.path.join(out, "build-info.json"), "w"), indent=2)
    print(json.dumps(info))
    return 0 if items else 3

if __name__ == "__main__":
    a = sys.argv[1:]
    if not a: print(__doc__); sys.exit(2)
    if a[0] == "redact":
        for ln in sys.stdin:                      # streamed line by line so the Actions log stays live
            sys.stdout.write(redact(ln)); sys.stdout.flush()
        sys.exit(0)
    if a[0] == "annotate": sys.exit(annotate(a[1], a[2]))
    if a[0] == "collect": sys.exit(collect(*a[1:]))
    print(__doc__); sys.exit(2)
