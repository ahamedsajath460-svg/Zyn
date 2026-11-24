import json, os, shutil, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__)); V = os.path.join(HERE, "..", "validate_project.py"); SAMPLE = os.path.join(HERE, "..", "..", "..", "cloud-projects", "sample-hello")
def run(mutate=None):
    d = tempfile.mkdtemp(); p = os.path.join(d, "cloud-projects", "x"); shutil.copytree(SAMPLE, p)
    if mutate: mutate(p)
    r = subprocess.run([sys.executable, V, "cloud-projects/x"], cwd=d, capture_output=True, text=True); shutil.rmtree(d); return r.returncode, json.loads(r.stdout.strip().splitlines()[-1])
def app(p, t): open(os.path.join(p, "app", "build.gradle.kts"), "a").write(t)
def test(name, cond): print(("ok   " if cond else "FAIL ") + name); return cond
res = []
c, j = run(); res.append(test("sample passes, app module + compileSdk + applicationId detected", c == 0 and j["app_module"] == "app" and j["compile_sdk"] == "34" and j["application_id"] == "com.zenai.samplehello"))
for name, t in [("env access", 'val a = System.getenv("X")'), ("process start", 'Runtime.getRuntime().exec("id")'), ("token name", 'val t = "GITHUB_TOKEN"'), ("network", 'java.net.URL("http://x").readText()'), ("home dir", 'System.getProperty("user.home")')]:
    c, j = run(lambda p, t=t: app(p, "\n" + t + "\n")); res.append(test("rejects " + name, c == 1 and not j["ok"]))
def evil_repo(p): f = os.path.join(p, "settings.gradle.kts"); open(f, "a").write('\nallprojects { repositories { maven { url = uri("https://evil.example/m") } } }\n')
c, j = run(evil_repo); res.append(test("rejects non-allowlisted repository", c == 1 and any("allowlist" in e for e in j["errors"])))
def http_repo(p): f = os.path.join(p, "settings.gradle.kts"); open(f, "a").write('\nrepositories { maven { url = uri("http://repo.maven.apache.org/x") } }\n')
c, j = run(http_repo); res.append(test("rejects plain-http repository", c == 1))
def wf(p): os.makedirs(os.path.join(p, ".github", "workflows")); open(os.path.join(p, ".github", "workflows", "a.yml"), "w").write("x")
c, j = run(wf); res.append(test("rejects .github inside project", c == 1))
def link(p): os.symlink("/etc/passwd", os.path.join(p, "app", "evil.txt"))
c, j = run(link); res.append(test("rejects symlinks", c == 1))
def nosettings(p): os.remove(os.path.join(p, "settings.gradle.kts"))
c, j = run(nosettings); res.append(test("rejects project without settings.gradle", c == 1))
def bigf(p): open(os.path.join(p, "app", "big.bin"), "wb").write(b"0" * (6 * 1024 * 1024))
c, j = run(bigf); res.append(test("rejects file over 5 MB", c == 1))
sys.exit(0 if all(res) else 1)
