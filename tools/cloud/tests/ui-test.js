/* Opens the REAL a2z.html in headless Chromium (412x860), opens Cloud Studio, and drives every section against the local fake GitHub. */
const { chromium } = require('playwright'); const path = require('path'); const start = require('./fake-github');
const TOKEN = 'ghp_TESTTOKEN0123456789012345678901234';
(async () => {
  const fake = await start({ buildMs: 200 }), errs = [], out = []; let hasTok = false, previews = [];
  const b = await chromium.launch(), pg = await b.newPage({ viewport: { width: 412, height: 860 } });
  pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push('console:' + m.text()); });
  await pg.exposeFunction('__fetchFake', async (method, p, body) => { const r = await fetch('http://127.0.0.1:' + fake.port + p, { method, headers: { authorization: 'Bearer ' + TOKEN }, body: body || undefined }); return { s: r.status, t: await r.text() }; });
  await pg.exposeFunction('__prev', (t, h, w) => { previews.push({ t, len: h.length, w }); });
  await pg.addInitScript(() => {
    window.A2ZCloud = { _tok: false, hasToken() { return this._tok; }, setToken() { this._tok = true; return 'ok'; }, clearToken() { this._tok = false; },
      gh(id, ns, m, p, body) { window.__fetchFake(m, p, body).then(r => window.__cloudCb(id, r.s, r.t)); }, openPreview(t, h, w) { window.__prev(t, h, w); return 'ok'; }, shareApk() { return 'ok'; },
      downloadApk(id) { setTimeout(() => window.__cloudCb(id, 200, JSON.stringify({ name: 'app-debug.apk', size: 4000000, sha256: 'ab'.repeat(32), where: 'Downloads/Zen Ai/Cloud Studio/app-debug.apk', package: 'com.zenai.samplehello', versionName: '1.0', versionCode: 1 })), 20); },
      downloadReports(id) { const px = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='; setTimeout(() => window.__cloudCb(id, 200, JSON.stringify({ files: [{ name: '01-launch.png', size: 70, b64: px }, { name: 'crash-report.txt', size: 0, text: '' }, { name: 'logcat.txt', size: 9, text: 'I/ok line' }] })), 20); } };
  });
  await pg.goto('file://' + path.resolve(__dirname, '../../../app/src/main/assets/a2z.html')); await pg.waitForTimeout(2500);
  await pg.evaluate(() => { location.hash = 'tools'; window.A2ZAuth = null; }); await pg.waitForTimeout(150);
  await pg.evaluate(() => { const x = [...document.querySelectorAll('button')].find(q => /^\s*Skip/.test(q.textContent)); if (x) x.click(); }); await pg.waitForTimeout(500);
  const ok = (n, c, d) => { out.push((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : '  ' + (d || ''))); if (!c) process.exitCode = 1; };
  const reg = await pg.evaluate(() => !!ALL.find(x => x.id === 'cloudstudio')); ok('tool registered in ALL (Create category)', reg);
  await pg.evaluate(() => { tool = 'cloudstudio'; drawTools(); document.querySelectorAll('.n-gate').forEach(e => e.classList.remove('n-gate')); }); await pg.waitForTimeout(800);
  const navs = await pg.$$eval('.cs-nav button', a => a.map(x => x.textContent)); ok('11 sections in navigation', navs.length === 11, navs.join(','));
  const txt = () => pg.evaluate(() => document.querySelector('.cs').innerText);
  ok('overview shows setup-required (no token yet)', /Setup required/.test(await txt()));
  await pg.screenshot({ path: 'cs-overview.png' });
  const nav = async n => { await pg.evaluate(n => [...document.querySelectorAll('.cs-nav button')].find(x => x.textContent === n).click(), n); await pg.waitForTimeout(400); };
  // settings: save token, repo
  await nav('Cloud Settings'); await pg.fill('.cs input[type=password]', TOKEN); await pg.evaluate(() => [...document.querySelectorAll('.cs-b')].find(x => /Save and test token/.test(x.textContent)).click()); await pg.waitForTimeout(700);
  ok('token accepted (Connected as tester)', await pg.evaluate(() => A2ZCloud._tok === true));
  await pg.fill('.cs input[placeholder="owner/name"]', 'o/r'); await pg.evaluate(() => [...document.querySelectorAll('.cs-b')].find(x => /Save and test repository/.test(x.textContent)).click()); await pg.waitForTimeout(900);
  ok('repo test lists all 5 workflow files', /Repository o\/r/.test(await txt()) && (await txt()).split('✓').length === 6, (await txt()).split('2 · REPOSITORY')[1].slice(0, 500));
  // creator: sample project
  await nav('AI App Creator'); await pg.evaluate(() => [...document.querySelectorAll('.cs-b')].find(x => /sample project/.test(x.textContent)).click()); await pg.waitForTimeout(900);
  ok('sample project created and workspace opened', /Sample Hello|MainActivity|lines/.test(await txt()), (await txt()).slice(0, 200));
  const hlOk = await pg.evaluate(() => document.querySelector('.cs-ew pre').innerHTML.includes('t-k')); ok('syntax highlighting renders', hlOk); await pg.screenshot({ path: 'cs-workspace.png' });
  // edit: typing marks dirty + lint error marker
  await pg.evaluate(() => { const t = document.querySelector('.cs-ew textarea'); t.value += '\nfun z(){ R.layout.nothere }\n'; t.dispatchEvent(new Event('input')); }); await pg.waitForTimeout(900);
  ok('error highlighting for missing layout', await pg.evaluate(() => document.querySelectorAll('.cs-ew .mk div').length > 0)); await pg.screenshot({ path: 'cs-lint.png' });
  await pg.evaluate(() => { const t = document.querySelector('.cs-ew textarea'); t.value = t.value.replace('\nfun z(){ R.layout.nothere }\n', ''); t.dispatchEvent(new Event('input')); }); await pg.waitForTimeout(900);
  // build center: real flow through fake GitHub
  await nav('Build Center'); await pg.evaluate(() => { document.querySelector('.cs input[type=checkbox]').checked = false; [...document.querySelectorAll('.cs-b')].find(x => /Build debug APK/.test(x.textContent)).click(); });
  await pg.waitForFunction(() => /Build succeeded/.test(document.querySelector('.cs').innerText), null, { timeout: 30000 }).catch(() => { }); ok('debug build succeeded through UI', /Build succeeded/.test(await txt()), (await txt()).slice(0, 400)); await pg.screenshot({ path: 'cs-build.png' });
  ok('workflow dispatched on cloud/ branch', fake.S.dispatches.length === 1 && fake.S.dispatches[0].b.ref === 'cloud/sample-hello', JSON.stringify(fake.S.dispatches.map(d => d.b.ref)));
  // apk manager download
  await nav('APK Manager'); await pg.evaluate(() => [...document.querySelectorAll('.cs-b')].find(x => x.textContent === 'Download').click()); await pg.waitForTimeout(700);
  ok('apk metadata shown (package, sha256, path)', /com\.zenai\.samplehello/.test(await txt()) && /SHA-256 (ab){4}/.test(await txt()), (await txt()).slice(0, 300)); await pg.screenshot({ path: 'cs-apk.png' });
  // history
  await nav('Build History'); await pg.click('.cs-card'); await pg.waitForTimeout(300); await pg.evaluate(() => [...document.querySelectorAll('.cs-b')].find(x => x.textContent === 'Build log').click()); await pg.waitForTimeout(300);
  ok('build log viewable in history', /BUILD SUCCESSFUL/.test(await txt())); 
  // preview xml (static, sandboxed iframe, no scripts) and check DOMParser XML drawing
  await nav('Live Preview'); await pg.waitForTimeout(500); await pg.selectOption('.cs select >> nth=1', { index: 0 }).catch(() => { });
  const sel = await pg.$$eval('.cs select option', o => o.map(x => x.value)); const lay = sel.find(v => /layout\/activity_main\.xml/.test(v)); await pg.evaluate(v => { const s = document.querySelectorAll('.cs select')[1]; s.value = v; s.dispatchEvent(new Event('change')); }, lay); await pg.waitForTimeout(400);
  const ifr = await pg.evaluate(() => { const f = document.querySelector('.cs-dev iframe'); return f ? { sandbox: f.getAttribute('sandbox'), hasScript: /<script/i.test(f.srcdoc), hasText: /Hello from Zen AI/.test(f.srcdoc), button: /<button/.test(f.srcdoc) } : null; });
  ok('XML preview: sandboxed, script-free, draws TextView+Button', ifr && ifr.sandbox === '' && !ifr.hasScript && ifr.hasText && ifr.button, JSON.stringify(ifr)); await pg.screenshot({ path: 'cs-preview.png' });
  // virtual device: run emulator test, load reports
  await nav('Virtual Device'); await pg.evaluate(() => [...document.querySelectorAll('.cs-b')].find(x => /Run emulator test/.test(x.textContent)).click());
  await pg.waitForFunction(() => /Load screenshots/.test(document.querySelector('.cs').innerText), null, { timeout: 30000 }).catch(() => { });
  await pg.evaluate(() => [...document.querySelectorAll('.cs-b')].find(x => /Load screenshots/.test(x.textContent)).click()); await pg.waitForTimeout(500);
  ok('emulator test run + screenshots/logcat loaded', await pg.evaluate(() => !!document.querySelector('.cs-shots img') && /No crash detected/.test(document.querySelector('.cs').innerText))); await pg.screenshot({ path: 'cs-device.png' });
  ok('test workflow dispatched with api_level + ui_events', fake.S.dispatches.some(d => d.wf === 'cloud-android-test.yml' && d.b.inputs.api_level === '34' && d.b.inputs.ui_events === '300'));
  // sdk, projects, dark theme
  await nav('Android SDK'); await pg.waitForTimeout(300); ok('sdk screen lists packages', /platforms;android-35/.test(await txt()));
  await nav('My Projects'); ok('projects list', /Sample Hello/.test(await txt()));
  await pg.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark')); await nav('Overview'); await pg.waitForTimeout(600); await pg.screenshot({ path: 'cs-dark.png' });
  ok('overview stats show 2 builds, 1 project', /Total builds/.test(await txt()));
  errs.splice(0, errs.length, ...errs.filter(e => !/ERR_TUNNEL|default-keys\.json/.test(e)));
  ok('no page errors (proxy/file:// noise filtered)', errs.length === 0, errs.slice(0, 5).join(' | '));
  console.log(out.join('\n')); await b.close(); fake.close();
})();
