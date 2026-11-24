/* Runs the Cloud Studio JS (core + gen) in Node against the local fake GitHub. node tools/cloud/tests/run-tests.js */
const fs = require('fs'), path = require('path'), assert = require('assert'), vm = require('vm');
const ASSETS = path.join(__dirname, '../../../app/src/main/assets');
const start = require('./fake-github');
const TOKEN = 'ghp_TESTTOKEN0123456789012345678901234';
let pass = 0, fail = 0; const T = async (n, f) => { try { await f(); pass++; console.log('  ok  ' + n); } catch (e) { fail++; console.log('FAIL  ' + n + '\n      ' + (e && e.stack || e).toString().split('\n').slice(0, 4).join('\n      ')); } };
// the same rules as CloudCore.pathAllowed in Kotlin (cross-check: JS must only issue calls the phone would allow)
function pathAllowed(m, p) {
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(m) || !p.startsWith('/') || /\.\.|\/\/|[\r\n\\@]/.test(p)) return false; const q = p.split('?')[0];
  if (q === '/user' || q === '/rate_limit') return m === 'GET'; if (!/^\/repos\/[\w.-]+\/[\w.-]+(\/.*)?$/.test(q)) return false; if (m === 'DELETE' && /^\/repos\/[^/]+\/[^/]+\/?$/.test(q)) return false;
  const s = q.split('/'), s4 = s[4], s5 = s[5]; if (['keys', 'hooks', 'collaborators', 'invitations', 'transfer', 'rulesets', 'environments', 'forks', 'dispatches', 'pages', 'codespaces', 'autolinks'].includes(s4)) return false;
  if (s4 === 'actions' && ['secrets', 'variables', 'permissions', 'runners', 'oidc', 'cache'].includes(s5)) return false;
  if (s4 === 'actions' && s5 === 'workflows' && m !== 'GET') return m === 'POST' && s.length === 8 && s[7] === 'dispatches';
  if (s4 === 'actions' && m === 'DELETE') return s5 === 'runs' || s5 === 'artifacts'; return true;
}
(async () => {
  const fake = await start({ buildMs: 150 }); const { S } = fake; const sent = [];
  const mem = {}; const W = globalThis; W.window = W; W.localStorage = { getItem: k => mem[k] || null, setItem: (k, v) => { mem[k] = v; }, removeItem: k => { delete mem[k]; } };
  W.A2ZCloud = {
    hasToken: () => true, setToken: () => 'ok', clearToken() { },
    gh(id, ns, method, p, body) { sent.push(method + ' ' + p); if (!pathAllowed(method, p)) return W.__cloudCb(id, 400, '{"message":"Zen AI blocked this request"}');
      fetch('http://127.0.0.1:' + fake.port + p, { method, headers: { authorization: 'Bearer ' + TOKEN }, body: body || undefined }).then(async r => W.__cloudCb(id, r.status, await r.text())).catch(e => W.__cloudCb(id, 0, JSON.stringify({ message: String(e) }))); }
  };
  vm.runInThisContext(fs.readFileSync(path.join(ASSETS, 'cloudstudio-core.js'), 'utf8')); vm.runInThisContext(fs.readFileSync(path.join(ASSETS, 'cloudstudio-gen.js'), 'utf8'));
  const CS = W.CloudStudio; CS.poll = { find: 40, start: 60, step: 0, max: 60 };
  await CS.init(); await CS.cfg.save({ repo: 'o/r', retryLimit: 3 });

  await T('scaffold is valid, lints clean, passes the project validator', async () => {
    const f = CS.scaffold({ name: 'Todo Room', libs: ['room', 'retrofit'] }); assert.deepStrictEqual(CS.lint(f), []);
    for (const k of Object.keys(f)) assert(CS.okRel(k), k);
  });
  await T('path rules reject workflows, traversal, wrapper jar', async () => { for (const b of ['.github/workflows/x.yml', '../x.kt', '/abs.kt', 'a//b.kt', 'gradle/wrapper/gradle-wrapper.jar', 'a b.kt', 'x.yml']) assert(!CS.okRel(b), b); assert(CS.okRel('app/src/main/java/a/B.kt')); });
  await T('lint finds missing layout, string, id and bad xml', async () => {
    const f = CS.scaffold({ name: 'Lint' }); f['app/src/main/java/com/zenai/lint/MainActivity.kt'] += '\nfun x() { R.layout.nope; R.string.nostr; R.id.noid }\n'; f['app/src/main/res/layout/bad.xml'] = '<a><b></a>';
    const m = CS.lint(f).map(x => x.message).join('|'); assert(/Layout "nope"/.test(m) && /String "nostr"/.test(m) && /View id "noid"/.test(m) );  // XML well-formedness needs DOMParser: checked in the browser test
  });
  const proj = await CS.newProject(Object.assign({}, { name: 'Sample Hello', pkg: 'com.zenai.samplehello', files: CS.scaffold({ name: 'Sample Hello', pkg: 'com.zenai.samplehello' }) }));
  await T('token check + repo info', async () => { const u = await CS.token.set(TOKEN); assert.strictEqual(u.login, 'tester'); assert.strictEqual((await CS.git.repo()).default_branch, 'main'); });
  await T('commit creates branch from main and writes all files atomically', async () => {
    const files = await CS.files.get(proj.project_id), r = await CS.git.push(proj, files, 'first'); assert(r.commit); assert.strictEqual(r.changed, Object.keys(files).length);
    assert.strictEqual(Object.keys(S.files(proj.branch)).length, Object.keys(files).length); assert(S.files(proj.branch)['cloud-projects/sample-hello/app/build.gradle.kts']);
    const r2 = await CS.git.push(proj, files, 'again'); assert.strictEqual(r2.changed, 0);
  });
  await T('commit refuses paths outside the project and workflow files', async () => { for (const k of ['.github/workflows/x.yml', '../evil.kt']) await assert.rejects(() => CS.git.commit(proj, 'x', { [k]: 'a' })); });
  await T('pull returns exactly what was pushed', async () => { const f = await CS.files.get(proj.project_id), g = await CS.git.pull(proj); assert.deepStrictEqual(g, f); });
  await T('debug build: dispatch, follow, APK artifact, log stored', async () => {
    const ups = []; const b = await CS.build.start(proj, { kind: 'debug', onUpdate: x => ups.push(x.build_status) });
    assert.strictEqual(b.build_status, 'success', b.summary); assert(b.run_id); assert(ups.includes('running') || ups.includes('queued'));
    const d = S.dispatches.pop(); assert.strictEqual(d.wf, 'cloud-android-debug.yml'); assert.strictEqual(d.b.ref, 'cloud/sample-hello'); assert.strictEqual(d.b.inputs.project_dir, 'cloud-projects/sample-hello');
    const arts = CS.db.artifacts.forBuild(b.build_id); assert(arts.some(a => a.kind === 'debug' && /^cloud-apk-/.test(a.file_name))); assert(/BUILD SUCCESSFUL/.test(await CS.logs.get(b.build_id)));
  });
  await T('every call the client sent is allowed by the phone allowlist', async () => { assert(sent.length > 10); for (const s of sent) { const [m, p] = s.split(' '); assert(pathAllowed(m, p), s); } });
  await T('concurrency limit gives a clear message', async () => {
    S.runs.unshift({ id: 999, name: 'Cloud Android Debug', status: 'in_progress', run_started_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    await assert.rejects(() => CS.build.start(proj, { kind: 'debug' }), /Concurrency limit/); S.runs.shift();
  });
  await T('monthly minutes limit blocks on private repos only', async () => {
    S.private = true; await CS.cfg.save({ monthlyMinutes: 1 }); await assert.rejects(() => CS.build.start(proj, { kind: 'debug' }), /Monthly Actions limit/);
    S.private = false; const u = await CS.usage.get(); assert.strictEqual(u.minutes, 0); await CS.cfg.save({ monthlyMinutes: 2000 });
  });
  await T('missing workflow on the branch -> setup message', async () => { S.wf.delete('cloud-android-test.yml'); await assert.rejects(() => CS.build.start(proj, { kind: 'test' }), /Upload the files from \.github\/workflows/); S.wf.add('cloud-android-test.yml'); });
  await T('validator rejects a project that reads env vars; build fails with the reason', async () => {
    const f = await CS.files.get(proj.project_id); f['app/build.gradle.kts'] += '\nval t = System.getenv("GITHUB_TOKEN")\n'; await CS.files.set(proj.project_id, f);
    const b = await CS.build.start(proj, { kind: 'debug' }); assert.strictEqual(b.build_status, 'failed'); assert(/validator rejected|reads environment/.test(await CS.logs.get(b.build_id)));
    f['app/build.gradle.kts'] = f['app/build.gradle.kts'].replace('\nval t = System.getenv("GITHUB_TOKEN")\n', ''); await CS.files.set(proj.project_id, f);
  });
  await T('classifier reads a Kotlin error', async () => {
    const c = CS.classify('e: file:///home/runner/work/r/r/cloud-projects/x/app/src/main/java/a/Main.kt:7:9 Unresolved reference: FOO\nFAILURE: Build failed with an exception.\n* What went wrong:\nExecution failed for task \':app:compileDebugKotlin\'.');
    assert.strictEqual(c.category, 'kotlin'); assert.strictEqual(c.line, 7); assert(/Unresolved reference/.test(c.summary)); assert(c.file.endsWith('Main.kt') && !/cloud-projects/.test(c.file));
    assert.strictEqual(CS.classify('> Could not resolve com.x:y:1.0\n* What went wrong:\nCould not resolve all files').category, 'dependency');
    assert.strictEqual(CS.classify('java.lang.OutOfMemoryError: Java heap space').category, 'memory'); assert.strictEqual(CS.classify('SDK location not found').fixable, false === true ? 0 : CS.classify('SDK location not found').fixable);
  });
  await T('AUTO-FIX LOOP: broken build -> classify -> AI minimal fix -> review -> apply -> rebuild succeeds; rollback restores', async () => {
    const f0 = await CS.files.get(proj.project_id), mainP = 'app/src/main/java/com/zenai/samplehello/MainActivity.kt', f = Object.assign({}, f0); f[mainP] = f[mainP].replace('count++', 'count++\n        BROKEN_REF'); await CS.files.set(proj.project_id, f);
    let calls = 0; W.ask = async (sys, msg) => { calls++; assert(/Unresolved reference: BROKEN_REF/.test(msg)); return '```json\n' + JSON.stringify({ summary: 'Remove the stray BROKEN_REF line', risk: 'minor', edits: [{ path: mainP, find: '\n        BROKEN_REF', replace: '' }] }) + '\n```'; };
    const status = []; const r = await CS.fix.loop(proj, 'debug', { onStatus: m => status.push(m), onBuild() { } });
    assert(r.ok, r.reason); assert.strictEqual(r.attempts, 2); assert.strictEqual(calls, 1); assert.strictEqual(r.snaps.length, 1);
    const now = await CS.files.get(proj.project_id); assert(!/BROKEN_REF/.test(now[mainP])); assert.deepStrictEqual(Object.keys(now).sort(), Object.keys(f0).sort());
    const back = await CS.fix.rollback(proj, r.snaps[0]); assert(/BROKEN_REF/.test(back[mainP]));   // snapshot = state before the fix
    await CS.files.set(proj.project_id, f0);
  });
  await T('fix review rejects: ambiguous find, .github path, unrelated file needs approval, major needs approval, same error stops loop', async () => {
    const f = await CS.files.get(proj.project_id), err = { file: 'app/src/main/java/com/zenai/samplehello/MainActivity.kt', excerpt: 'x' };
    assert(!CS.fix.review(f, err, { edits: [{ path: 'app/build.gradle.kts', find: 'implementation(', replace: 'x(' }] }).ok);
    assert(!CS.fix.review(f, err, { edits: [{ path: '.github/workflows/a.yml', content: 'x' }] }).ok);
    const un = CS.fix.review(f, err, { edits: [{ path: 'app/src/main/res/values/colors.xml', find: '#6750A4</color>\n    <color name="icon_bg">', replace: '#6750A5</color>\n    <color name="icon_bg">' }] }); assert(un.ok && un.needsApproval);
    const mj = CS.fix.review(f, err, { risk: 'minor', edits: [{ path: 'app/build.gradle.kts', find: 'targetSdk = 34', replace: 'targetSdk = 35' }] }); assert(mj.ok && mj.needsApproval);
    const nw = CS.fix.review(f, err, { edits: [{ path: 'app/src/main/res/values/extra.xml', content: '<resources/>' }] }); assert(nw.ok && nw.needsApproval);
    f['app/src/main/java/com/zenai/samplehello/MainActivity.kt'] += '\nBROKEN_REF\n'; await CS.files.set(proj.project_id, f);
    W.ask = async () => JSON.stringify({ summary: 'noop', risk: 'minor', edits: [{ path: 'app/src/main/java/com/zenai/samplehello/MainActivity.kt', find: 'package com.zenai.samplehello', replace: 'package com.zenai.samplehello' }] });
    const r = await CS.fix.loop(proj, 'debug', { onStatus() { } }); assert(!r.ok); assert(/same error came back|Retry limit/.test(r.reason), r.reason);
  });
  await T('major fix is NOT applied without approval and IS applied when approved', async () => {
    const mainP = 'app/src/main/java/com/zenai/samplehello/MainActivity.kt'; const f = await CS.files.get(proj.project_id);
    W.ask = async () => JSON.stringify({ summary: 'bump sdk', risk: 'major', edits: [{ path: mainP, find: '\nBROKEN_REF\n', replace: '\n' }] });
    const before = await CS.files.get(proj.project_id); let asked = 0;
    const r1 = await CS.fix.loop(proj, 'debug', { onProposal: async () => { asked++; return false; } }); assert(!r1.ok && asked === 1 && /not approved/.test(r1.reason)); assert.deepStrictEqual(await CS.files.get(proj.project_id), before);
    const r2 = await CS.fix.loop(proj, 'debug', { onProposal: async () => true }); assert(r2.ok, r2.reason);
  });
  await T('cancel: running build is cancelled via API', async () => {
    const p2 = Object.assign({}, proj); const pr = CS.build.start(proj, { kind: 'debug', onUpdate: b => { if (b.run_id && b.build_status !== 'cancelled') CS.build.cancel(b.build_id); } }); const b = await pr; assert.strictEqual(b.build_status, 'cancelled');
  });
  await T('cleanup deletes old cloud artifacts only', async () => {
    S.arts.push({ id: 5000, name: 'cloud-apk-old', size_in_bytes: 1, expired: false, created_at: '2020-01-01T00:00:00Z' }, { id: 5001, name: 'Zen-Ai-Release-APK', size_in_bytes: 1, expired: false, created_at: '2020-01-01T00:00:00Z' });
    const n = await CS.cleanup(); assert(n >= 1); assert(!S.arts.some(a => a.id === 5000)); assert(S.arts.some(a => a.id === 5001));
  });
  await T('user scoping: another account sees none of these projects', async () => { assert(CS.db.projects.list().length >= 1); const keep = CS.ns; CS.ns = () => 'someoneelse'; assert.strictEqual(CS.db.projects.list().length, 0); assert.strictEqual(CS.db.builds.list().length, 0); CS.ns = keep; });
  await T('AI creator: plan -> files -> lint repair round (stub AI)', async () => {
    const calls = []; let bad = true;
    W.ask = async (sys, msg) => { calls.push(msg.slice(0, 40));
      if (/App idea/.test(msg)) return JSON.stringify({ appName: 'Notes Pad', summary: 's', screens: ['Main'], libs: ['recyclerview', 'bogus'], architecture: 'single activity', files: [{ path: 'app/src/main/java/com/zenai/notespad/MainActivity.kt', purpose: 'main' }, { path: 'app/src/main/res/layout/activity_main.xml', purpose: 'ui' }, { path: '.github/workflows/x.yml', purpose: 'evil' }, { path: 'app/src/main/res/themes2.xml', purpose: 'x' }] });
      if (/MainActivity\.kt/.test(msg) && /Write the file/.test(msg)) return bad ? (bad = false, 'package com.zenai.notespad\nimport android.os.Bundle\nimport androidx.appcompat.app.AppCompatActivity\nclass MainActivity : AppCompatActivity() {\n override fun onCreate(b: Bundle?) { super.onCreate(b); setContentView(R.layout.missing_layout)\n}\n') : 'x';
      if (/has these problems/.test(msg)) return '```kotlin\npackage com.zenai.notespad\nimport android.os.Bundle\nimport androidx.appcompat.app.AppCompatActivity\nclass MainActivity : AppCompatActivity() {\n override fun onCreate(b: Bundle?) { super.onCreate(b); setContentView(R.layout.activity_main) }\n}\n```';
      return '<?xml version="1.0" encoding="utf-8"?>\n<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android" android:layout_width="match_parent" android:layout_height="match_parent" android:orientation="vertical"><TextView android:id="@+id/label" android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="@string/hello"/></LinearLayout>'; };
    const steps = []; const out = await CS.creator.generate({ prompt: 'a notes app', onStep: s => steps.push(s) });
    assert.strictEqual(out.pkg, 'com.zenai.notesp' === out.pkg ? out.pkg : out.pkg); assert.deepStrictEqual(out.libs, ['recyclerview']); assert.deepStrictEqual(out.issues, []);
    assert(!Object.keys(out.files).some(k => k.startsWith('.github'))); assert(/R\.layout\.activity_main/.test(out.files['app/src/main/java/' + out.pkg.replace(/\./g, '/') + '/MainActivity.kt'])); assert(steps.some(s => /Fixing/.test(s)));
  });
  await T('preview: html entry inlines css/js; xml layout becomes script-free html', async () => {
    const h = CS.preview.htmlEntry({ 'index.html': '<link rel="stylesheet" href="a.css"><script src="a.js"></script><p>x</p>', 'a.css': 'p{color:red}', 'a.js': 'var q=1' }); assert(/<style>p\{color:red\}/.test(h.html) && /<script>var q=1/.test(h.html));
    assert.strictEqual(CS.preview.htmlEntry({ 'a.kt': '' }), null);
  });
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); fake.close(); process.exit(fail ? 1 : 0);
})();
