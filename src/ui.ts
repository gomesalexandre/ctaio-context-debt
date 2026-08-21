/**
 * The whole client, inline. The point of this page is that the agent handoffs
 * are VISIBLE — you watch scan hand off to two different model families, watch
 * the deterministic gate kill findings, and see the architect run on survivors.
 * A spinner would hide exactly the thing worth showing.
 */
export const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Context Debt</title>
<style>
:root{--bg:#fbfaf8;--fg:#1a1a1a;--mut:#6b6b6b;--line:#e2ddd5;--card:#fff;--accent:#b8501f;--ok:#1e8449;--warn:#b9770e;--bad:#c0392b}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#16161a;--fg:#ededed;--mut:#9a9a9a;--line:#2e2e36;--card:#1e1e24;--accent:#e0763f;--ok:#4ade80;--warn:#fbbf24;--bad:#f87171}}
:root[data-theme=dark]{--bg:#16161a;--fg:#ededed;--mut:#9a9a9a;--line:#2e2e36;--card:#1e1e24;--accent:#e0763f;--ok:#4ade80;--warn:#fbbf24;--bad:#f87171}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--fg);font:16px/1.6 ui-serif,Georgia,serif;margin:0;padding:2.5rem 1.25rem}
.wrap{max-width:860px;margin:0 auto}
h1{font-size:2.1rem;margin:0 0 .2rem;letter-spacing:-.02em}
.tag{color:var(--mut);font-size:.95rem;margin-bottom:1.8rem}
h2{font-size:1.12rem;margin:2.2rem 0 .8rem;padding-bottom:.4rem;border-bottom:1px solid var(--line);font-family:ui-sans-serif,system-ui,sans-serif}
form{display:flex;gap:.6rem;margin:1.5rem 0;flex-wrap:wrap}
input{flex:1;min-width:220px;background:var(--card);color:var(--fg);border:1px solid var(--line);border-radius:8px;padding:.7rem .9rem;font:inherit;font-family:ui-monospace,monospace;font-size:.9rem}
input:focus{outline:2px solid var(--accent);outline-offset:1px}
button{background:var(--accent);color:#fff;border:0;border-radius:8px;padding:.7rem 1.4rem;font:600 .95rem ui-sans-serif,system-ui,sans-serif;cursor:pointer}
button:disabled{opacity:.55;cursor:not-allowed}
.stages{display:grid;gap:.4rem;margin:1.2rem 0}
.stage{display:flex;align-items:center;gap:.7rem;background:var(--card);border:1px solid var(--line);border-left:3px solid var(--line);border-radius:8px;padding:.6rem .9rem;font-family:ui-sans-serif,system-ui,sans-serif;font-size:.88rem;transition:border-color .2s}
.stage[data-status=running]{border-left-color:var(--accent)}
.stage[data-status=done]{border-left-color:var(--ok)}
.stage[data-status=error]{border-left-color:var(--bad)}
.dot{width:9px;height:9px;border-radius:50%;background:var(--line);flex:none}
.stage[data-status=running] .dot{background:var(--accent);animation:p 1s ease-in-out infinite}
.stage[data-status=done] .dot{background:var(--ok)}
.stage[data-status=error] .dot{background:var(--bad)}
@keyframes p{0%,100%{opacity:1}50%{opacity:.25}}
.sname{font-weight:600;min-width:82px}
.smeta{color:var(--mut);font-size:.82rem;font-family:ui-monospace,monospace}
.kind{margin-left:auto;font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);border:1px solid var(--line);border-radius:99px;padding:.1rem .5rem}
.err{background:var(--card);border:1px solid var(--bad);border-left:3px solid var(--bad);border-radius:8px;padding:1rem 1.1rem;margin:1rem 0}
.err h3{margin:0 0 .3rem;font-size:1rem;color:var(--bad);font-family:ui-sans-serif,system-ui,sans-serif}
.err p{margin:0;font-size:.9rem}
.score{display:flex;gap:1.4rem;align-items:baseline;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:1.2rem 1.5rem;margin:1.2rem 0}
.score b{font-size:3.1rem;line-height:1;color:var(--accent);font-family:ui-sans-serif,system-ui,sans-serif}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:.7rem;margin:1rem 0}
.stat{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:.75rem 1rem}
.stat i{display:block;font-style:normal;font-size:1.45rem;font-weight:600;font-family:ui-sans-serif,system-ui,sans-serif}
.stat span{font-size:.7rem;color:var(--mut);text-transform:uppercase;letter-spacing:.06em;font-family:ui-sans-serif,system-ui,sans-serif}
.f{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--sv);border-radius:8px;padding:.9rem 1.1rem;margin:.6rem 0}
.f h3{margin:0 0 .3rem;font-size:.98rem;font-family:ui-sans-serif,system-ui,sans-serif}
.pill{font-size:.64rem;text-transform:uppercase;letter-spacing:.07em;color:#fff;background:var(--sv);padding:.13rem .5rem;border-radius:99px;font-family:ui-sans-serif,system-ui,sans-serif;margin-right:.4rem;vertical-align:middle}
.cite{font-family:ui-monospace,monospace;font-size:.76rem;color:var(--mut);margin-top:.45rem;border-top:1px dashed var(--line);padding-top:.4rem;word-break:break-word}
.killed{opacity:.6}
table{width:100%;border-collapse:collapse;font-size:.85rem;font-family:ui-sans-serif,system-ui,sans-serif}
td,th{text-align:left;padding:.4rem .5rem;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:.68rem;text-transform:uppercase;letter-spacing:.05em;color:var(--mut)}
code{font-family:ui-monospace,monospace;font-size:.83em;background:rgba(128,128,128,.13);padding:.08em .35em;border-radius:3px}
.note{font-size:.82rem;color:var(--mut);font-style:italic}
.scroll{overflow-x:auto}
.hide{display:none}
</style>
</head>
<body>
<div class="wrap">
<h1>Context Debt</h1>
<div class="tag">What your accumulated agent instructions actually cost you on every single turn, and which parts are stale, duplicated or contradictory.</div>

<form id="f">
  <input id="repo" placeholder="shapeshift/web" value="shapeshift/web" autocomplete="off" spellcheck="false">
  <button id="go" type="submit">Analyze</button>
</form>
<div class="note">Public GitHub repos. Reads only CLAUDE.md, AGENTS.md and .claude/**</div>

<div id="stages" class="stages hide"></div>
<div id="err"></div>
<div id="out"></div>
</div>

<script>
var STAGES = [
  ['scan','deterministic'],
  ['mapper','model'],
  ['simulator','model'],
  ['verify','deterministic'],
  ['architect','model']
];
var esc = function(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); };
var num = function(n){ return (n == null ? 0 : n).toLocaleString(); };

function paintStages(){
  var el = document.getElementById('stages');
  el.className = 'stages';
  el.innerHTML = STAGES.map(function(s){
    return '<div class="stage" id="st-' + s[0] + '" data-status="pending">' +
      '<span class="dot"></span><span class="sname">' + s[0] + '</span>' +
      '<span class="smeta" id="sm-' + s[0] + '">waiting</span>' +
      '<span class="kind">' + s[1] + '</span></div>';
  }).join('');
}
function setStage(name, status, meta){
  var el = document.getElementById('st-' + name);
  if (!el) return;
  el.setAttribute('data-status', status);
  var m = document.getElementById('sm-' + name);
  if (m && meta) m.textContent = meta;
  else if (m && status === 'running') m.textContent = 'running...';
}
function showError(title, msg){
  document.getElementById('err').innerHTML =
    '<div class="err"><h3>' + esc(title) + '</h3><p>' + esc(msg) + '</p></div>';
}

function render(r){
  var sev = { high:'var(--bad)', medium:'var(--warn)', low:'var(--mut)' };
  var conf = r.findings.filter(function(f){ return f.verdict === 'CONFIRMED'; });
  var kill = r.findings.filter(function(f){ return f.verdict === 'KILLED'; });
  var h = '';

  h += '<div class="score"><b>' + r.score + '</b><div>' +
    '<div style="font-size:.76rem;text-transform:uppercase;letter-spacing:.07em;color:var(--mut);font-family:ui-sans-serif,system-ui,sans-serif">Context debt score / 100</div>' +
    '<div class="note">Higher is healthier. Arithmetic over measured tokens, verified findings and stale refs. Never asked of a model.</div></div></div>';

  h += '<div class="grid">' +
    '<div class="stat"><i>' + num(r.inventory.alwaysOnTokens) + '</i><span>Always-on tokens (est.)</span></div>' +
    '<div class="stat"><i>' + num(r.inventory.totalTokens) + '</i><span>Total context tokens</span></div>' +
    '<div class="stat"><i>' + r.wastePct + '%</i><span>Irrelevant to this task</span></div>' +
    '<div class="stat"><i>' + num(r.inventory.staleRefs.length) + '</i><span>Stale references</span></div>' +
    '<div class="stat"><i>' + conf.length + '</i><span>Verified findings</span></div>' +
    '<div class="stat"><i>' + kill.length + '</i><span>Hallucinations killed</span></div>' +
    '</div>';

  h += '<h2>Verified findings</h2>';
  if (conf.length) {
    h += conf.map(function(f){
      var c = f.citations.map(function(x){
        return '<div class="cite">&#10003; ' + esc(x.file) + ':' + x.line + ' &nbsp;&ldquo;' + esc(String(x.quote).slice(0,150)) + '&rdquo;</div>';
      }).join('');
      return '<div class="f" style="--sv:' + (sev[f.severity] || 'var(--mut)') + '">' +
        '<h3><span class="pill">' + esc(f.severity) + '</span>' + esc(f.title) + '</h3>' +
        '<div>' + esc(f.detail) + '</div>' + c + '</div>';
    }).join('');
  } else {
    h += '<p class="note">No findings survived verification.</p>';
  }

  if (kill.length) {
    h += '<h2>Killed by the citation gate</h2>';
    h += '<p class="note">Produced by ' + esc(r.models.mapper) + ' but the quoted evidence is not at the cited line. The gate re-reads the file. Shown because a validation step you cannot see the output of is not a validation step.</p>';
    h += kill.map(function(f){
      return '<div class="f killed" style="--sv:var(--mut)"><h3>&#10007; ' + esc(f.title) + '</h3>' +
        '<div class="cite">killed: ' + esc(f.killReason) + '</div></div>';
    }).join('');
  }

  h += '<h2>Stale references</h2>';
  if (r.inventory.staleRefs.length) {
    h += '<div class="scroll"><table><tr><th>File</th><th>Line</th><th>Broken ref</th></tr>' +
      r.inventory.staleRefs.slice(0,25).map(function(s){
        return '<tr><td><code>' + esc(s.file) + '</code></td><td>' + s.line + '</td><td><code>' + esc(s.ref) + '</code></td></tr>';
      }).join('') + '</table></div>' +
      '<p class="note">Checked against the repo\\'s full file tree from the GitHub API. No model involved.</p>';
  } else {
    h += '<p class="note">None. Every referenced path resolves.</p>';
  }

  h += '<h2>Proposed cleanup</h2><div class="scroll"><table><tr><th>Op</th><th>Target</th><th>Rationale</th><th>Est. saved</th></tr>' +
    r.actions.map(function(a){
      var col = a.op === 'DELETE' ? 'var(--bad)' : (a.op === 'KEEP' ? 'var(--ok)' : 'var(--accent)');
      return '<tr><td><b style="color:' + col + ';font-family:ui-sans-serif,system-ui,sans-serif;font-size:.7rem;letter-spacing:.05em">' + esc(a.op) + '</b></td>' +
        '<td><code>' + esc(a.target) + '</code></td><td>' + esc(a.rationale) + '</td>' +
        '<td>' + (a.estTokensSaved ? '~' + num(a.estTokensSaved) : '&mdash;') + '</td></tr>';
    }).join('') + '</table></div>';

  h += '<h2>Pipeline trace</h2><div class="scroll"><table>' +
    r.pipeline.map(function(l){ return '<tr><td><code>' + esc(l) + '</code></td></tr>'; }).join('') +
    '</table></div>';
  h += '<p class="note">Stages 1 and 4 are deterministic. Stages 2, 3 and 5 are models under schema contracts, and stage 4 exists to catch stage 2 lying.</p>';

  document.getElementById('out').innerHTML = h;
}

document.getElementById('f').addEventListener('submit', function(ev){
  ev.preventDefault();
  var repo = document.getElementById('repo').value.trim();
  if (!repo) return;
  var btn = document.getElementById('go');
  btn.disabled = true;
  document.getElementById('err').innerHTML = '';
  document.getElementById('out').innerHTML = '';
  paintStages();

  fetch('/api/analyze', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ repo: repo })
  }).then(function(res){
    if (!res.body || !res.body.getReader) {
      // No streaming support: fall back to reading the whole body at once.
      return res.text().then(function(t){
        t.split('\\n').forEach(function(line){ if (line.trim()) handle(JSON.parse(line)); });
      });
    }
    var reader = res.body.getReader();
    var dec = new TextDecoder();
    var buf = '';
    function pump(){
      return reader.read().then(function(r){
        if (r.done) { if (buf.trim()) handle(JSON.parse(buf)); return; }
        buf += dec.decode(r.value, { stream: true });
        var lines = buf.split('\\n');
        buf = lines.pop();
        lines.forEach(function(line){ if (line.trim()) handle(JSON.parse(line)); });
        return pump();
      });
    }
    return pump();
  }).catch(function(e){
    showError('Request failed', String(e && e.message ? e.message : e));
  }).then(function(){
    btn.disabled = false;
  });
});

function handle(msg){
  if (msg.stage === 'error') {
    STAGES.forEach(function(s){
      var el = document.getElementById('st-' + s[0]);
      if (el && el.getAttribute('data-status') === 'running') setStage(s[0], 'error', 'failed');
    });
    showError(msg.title || 'Analysis failed', msg.message || 'unknown error');
    return;
  }
  if (msg.stage === 'done') { render(msg.data); return; }
  setStage(msg.stage, msg.status, msg.meta);
}
</script>
</body>
</html>`;
