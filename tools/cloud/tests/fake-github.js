/* LOCAL fake of the GitHub REST endpoints Cloud Studio uses. Proves our client logic only; it is NOT GitHub.
 * "Builds" run the real tools/cloud/validate_project.py on the committed files, then fail if a Kotlin file contains BROKEN_REF. */
const http = require('http'), crypto = require('crypto'), fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const sha = s => crypto.createHash('sha1').update(String(s)).digest('hex');
module.exports = function start(opts = {}) {
  const S = { blobs: {}, trees: {}, commits: {}, refs: {}, runs: [], jobs: {}, arts: [], dispatches: [], calls: [], private: !!opts.private, n: 100, wf: new Set(['cloud-android-debug.yml', 'cloud-android-release.yml', 'cloud-android-test.yml', 'cloud-android-build.yml', 'cloud-android-cleanup.yml']) };
  const root = sha('tree0'); S.trees[root] = {}; const c0 = sha('c0'); S.commits[c0] = { tree: root, parents: [], message: 'init' }; S.refs['main'] = c0;
  const files = br => { const t = S.trees[S.commits[S.refs[br]].tree]; return Object.fromEntries(Object.entries(t).map(([p, b]) => [p, Buffer.from(S.blobs[b], 'base64').toString('utf8')])); };
  S.files = files;
  function build(run, br, id, slug, kind) {
    const f = files(br), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fakebuild-')), pd = path.join(dir, 'cloud-projects', slug);
    for (const [p, t] of Object.entries(f)) if (p.startsWith('cloud-projects/' + slug + '/')) { const o = path.join(dir, p); fs.mkdirSync(path.dirname(o), { recursive: true }); fs.writeFileSync(o, t); }
    const v = cp.spawnSync('python3', [path.join(__dirname, '..', 'validate_project.py'), 'cloud-projects/' + slug], { cwd: dir, encoding: 'utf8' });
    let log = '2025-01-01T00:00:00.0000000Z Validate: ' + v.stdout.split('\n').slice(0, -2).join(' ') + '\n', ok = v.status === 0;
    if (ok) { for (const [p, t] of Object.entries(f)) if (/\.kt$/.test(p) && /BROKEN_REF/.test(t)) { ok = false; log += '2025-01-01T00:00:01.0000000Z e: file:///home/runner/work/r/r/' + p + ':7:9 Unresolved reference: BROKEN_REF\n2025-01-01T00:00:02.0000000Z FAILURE: Build failed with an exception.\n* What went wrong:\nExecution failed for task \':app:compileDebugKotlin\'.\n> Compilation error. See log for more details\n'; } }
    else log += 'validator rejected the project\n';
    if (ok) log += 'BUILD SUCCESSFUL in 41s\n';
    S.jobs[run.id] = [{ id: run.id * 10, name: 'build / build', status: 'completed', conclusion: ok ? 'success' : 'failure', steps: [{ name: 'Check inputs', status: 'completed' }, { name: 'Gradle build', status: 'completed' }] }];
    S.logs = S.logs || {}; S.logs[run.id * 10] = log; run.status = 'completed'; run.conclusion = ok ? 'success' : 'failure'; run.updated_at = new Date().toISOString();
    if (ok) S.arts.push({ id: run.id * 7, name: (kind === 'test' ? 'cloud-emu-' : 'cloud-apk-') + id, size_in_bytes: 4000000, expired: false, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 7 * 864e5).toISOString(), run: run.id });
    S.arts.push({ id: run.id * 7 + 1, name: 'cloud-log-' + id, size_in_bytes: 900, expired: false, created_at: new Date().toISOString(), run: run.id });
  }
  const srv = http.createServer((req, res) => {
    let body = ''; req.on('data', d => body += d); req.on('end', () => {
      const u = new URL(req.url, 'http://x'), p = u.pathname, m = req.method, J = (c, o) => { res.writeHead(c, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
      S.calls.push(m + ' ' + req.url + ' auth=' + (req.headers.authorization ? 'yes' : 'no'));
      if (req.headers.authorization !== 'Bearer ghp_TESTTOKEN0123456789012345678901234') return J(401, { message: 'Bad credentials' });
      let b = {}; try { b = body ? JSON.parse(body) : {}; } catch (e) { }
      if (p === '/user') return J(200, { login: 'tester' });
      const mm = /^\/repos\/o\/r(\/.*)?$/.exec(p); if (!mm) return J(404, { message: 'Not Found' }); const r = mm[1] || '';
      let x, x0;
      if (r === '') return J(200, { full_name: 'o/r', default_branch: 'main', private: S.private });
      if ((x0 = /^\/contents\/\.github\/workflows\/([\w.-]+)$/.exec(r))) return S.wf.has(x0[1]) ? J(200, { name: x0[1] }) : J(404, { message: 'Not Found' });
      if (r === '/branches') return J(200, Object.keys(S.refs).map(name => ({ name })));
      if ((x = /^\/git\/ref\/heads\/(.+)$/.exec(r))) return S.refs[x[1]] ? J(200, { object: { sha: S.refs[x[1]] } }) : J(404, { message: 'Not Found' });
      if (r === '/git/refs' && m === 'POST') { S.refs[b.ref.replace('refs/heads/', '')] = b.sha; return J(201, {}); }
      if ((x = /^\/git\/refs\/heads\/(.+)$/.exec(r))) { if (m === 'DELETE') { delete S.refs[x[1]]; res.writeHead(204); return res.end(); } if (m === 'PATCH') { S.refs[x[1]] = b.sha; return J(200, {}); } }
      if ((x = /^\/git\/commits\/(\w+)$/.exec(r))) return S.commits[x[1]] ? J(200, { tree: { sha: S.commits[x[1]].tree } }) : J(404, { message: 'Not Found' });
      if (r === '/git/blobs' && m === 'POST') { const id = sha(b.content); S.blobs[id] = b.content; return J(201, { sha: id }); }
      if ((x = /^\/git\/blobs\/(\w+)$/.exec(r))) return J(200, { encoding: 'base64', content: S.blobs[x[1]] });
      if (r === '/git/trees' && m === 'POST') { const t = Object.assign({}, S.trees[b.base_tree]); for (const e of b.tree) { if (e.sha === null) delete t[e.path]; else t[e.path] = e.sha; } const id = sha(JSON.stringify(t)); S.trees[id] = t; return J(201, { sha: id }); }
      if (r === '/git/commits' && m === 'POST') { const id = sha(JSON.stringify(b) + Math.random()); S.commits[id] = { tree: b.tree, parents: b.parents, message: b.message }; return J(201, { sha: id }); }
      if ((x = /^\/git\/trees\/(.+)$/.exec(r))) { const br = decodeURIComponent(x[1]); if (!S.refs[br]) return J(404, { message: 'Not Found' }); const t = S.trees[S.commits[S.refs[br]].tree]; return J(200, { tree: Object.entries(t).map(([path, s]) => ({ path, type: 'blob', sha: s, size: Buffer.from(S.blobs[s], 'base64').length })) }); }
      if ((x = /^\/actions\/workflows\/([\w.-]+)\/dispatches$/.exec(r)) && m === 'POST') {
        if (!S.wf.has(x[1])) return J(404, { message: 'Not Found' }); if (!S.refs[b.ref]) return J(422, { message: 'No ref found for: ' + b.ref });
        S.dispatches.push({ wf: x[1], b }); const id = ++S.n, kind = x[1].includes('release') ? 'release' : x[1].includes('test') ? 'test' : 'debug';
        const run = { id, name: 'Cloud Android ' + kind, display_title: 'zen-cloud ' + b.inputs.build_id + ' ' + kind, status: 'queued', conclusion: null, event: 'workflow_dispatch', head_branch: b.ref, html_url: 'https://github.com/o/r/actions/runs/' + id, created_at: new Date().toISOString(), run_started_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        S.runs.unshift(run); S.jobs[id] = [{ id: id * 10, name: 'build / build', status: 'in_progress', steps: [{ name: 'Check inputs', status: 'completed' }, { name: 'Gradle build', status: 'in_progress' }] }];
        setTimeout(() => { run.status = 'in_progress'; }, 30); setTimeout(() => { if (run.status !== 'completed') build(run, b.ref, b.inputs.build_id, b.inputs.project_dir.split('/')[1], kind); }, opts.buildMs || 120);
        res.writeHead(204); return res.end();
      }
      if (r === '/actions/runs') { let rs = S.runs; const st = u.searchParams.get('status'); if (st) rs = rs.filter(q => q.status === st); const br = u.searchParams.get('branch'); if (br) rs = rs.filter(q => q.head_branch === br); return J(200, { workflow_runs: rs }); }
      if ((x = /^\/actions\/runs\/(\d+)$/.exec(r))) { const q = S.runs.find(y => y.id == x[1]); return q ? J(200, q) : J(404, { message: 'Not Found' }); }
      if ((x = /^\/actions\/runs\/(\d+)\/jobs$/.exec(r))) return J(200, { jobs: S.jobs[x[1]] || [] });
      if ((x = /^\/actions\/runs\/(\d+)\/cancel$/.exec(r))) { const q = S.runs.find(y => y.id == x[1]); q.status = 'completed'; q.conclusion = 'cancelled'; return J(202, {}); }
      if ((x = /^\/actions\/runs\/(\d+)\/artifacts$/.exec(r))) return J(200, { artifacts: S.arts.filter(a => a.run == x[1]) });
      if (r === '/actions/artifacts' && m === 'GET') return J(200, { artifacts: S.arts });
      if ((x = /^\/actions\/artifacts\/(\d+)$/.exec(r)) && m === 'DELETE') { S.arts = S.arts.filter(a => a.id != x[1]); res.writeHead(204); return res.end(); }
      if ((x = /^\/actions\/jobs\/(\d+)\/logs$/.exec(r))) { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end((S.logs || {})[x[1]] || ''); }
      if ((x = /^\/check-runs\/(\d+)\/annotations$/.exec(r))) { const l = (S.logs || {})[x[1]] || ''; const mt = /e: file:\/\/\/.*?(cloud-projects\/\S+?):(\d+):\d+ (.*)/.exec(l); return J(200, mt ? [{ path: mt[1], start_line: +mt[2], annotation_level: 'failure', message: mt[3] }] : []); }
      return J(404, { message: 'Not Found ' + r });
    });
  });
  return new Promise(ok => srv.listen(0, '127.0.0.1', () => ok({ S, port: srv.address().port, close: () => srv.close() })));
};
