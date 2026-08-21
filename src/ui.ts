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
/* v2: editorial, high-contrast, the stage rail is the hero. Warm paper ground,
   ink serif for prose, grotesque for data. Deterministic stages read green,
   model stages read amber, so the alternation is legible at a glance. */
:root{
  --bg:#faf7f2;--fg:#17161a;--mut:#6c6862;--line:#e5ded2;--card:#fffdfa;
  --accent:#b8501f;--ok:#1a7f4b;--warn:#b9770e;--bad:#b3261e;
  --shadow:0 1px 2px rgba(23,22,26,.05),0 8px 24px -12px rgba(23,22,26,.18);
  --serif:ui-serif,"Iowan Old Style",Georgia,serif;
  --sans:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,monospace;
}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){
  --bg:#131316;--fg:#eceaea;--mut:#95918c;--line:#2b2b31;--card:#1b1b20;
  --accent:#e87a45;--ok:#4ade80;--warn:#e0a437;--bad:#f0736a;
  --shadow:0 1px 2px rgba(0,0,0,.4),0 10px 30px -14px rgba(0,0,0,.7);
}}
:root[data-theme=dark]{
  --bg:#131316;--fg:#eceaea;--mut:#95918c;--line:#2b2b31;--card:#1b1b20;
  --accent:#e87a45;--ok:#4ade80;--warn:#e0a437;--bad:#f0736a;
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{background:var(--bg);color:var(--fg);font:17px/1.6 var(--serif);margin:0;padding:3.5rem 1.25rem 5rem}
.wrap{max-width:820px;margin:0 auto}
h1{font-size:clamp(2.4rem,6vw,3.4rem);line-height:1.02;letter-spacing:-.035em;margin:0 0 .5rem;font-weight:600}
.tag{color:var(--mut);font-size:1.06rem;max-width:60ch;margin:0 0 2.2rem}
h2{font-family:var(--sans);font-size:.76rem;font-weight:650;text-transform:uppercase;letter-spacing:.13em;
   color:var(--mut);margin:2.8rem 0 .9rem;padding-bottom:.5rem;border-bottom:1px solid var(--line)}
form{display:flex;gap:.5rem;flex-wrap:wrap}
input{flex:1 1 260px;min-width:0;font:500 1rem/1.2 var(--mono);color:var(--fg);background:var(--card);
  border:1px solid var(--line);border-radius:9px;padding:.85rem 1rem;box-shadow:var(--shadow);transition:border-color .15s}
input:focus{outline:none;border-color:var(--accent)}
button{font:600 .95rem var(--sans);letter-spacing:.01em;color:#fff;background:var(--accent);border:0;
  border-radius:9px;padding:.85rem 1.6rem;cursor:pointer;box-shadow:var(--shadow);transition:filter .15s,transform .06s}
button:hover{filter:brightness(1.08)} button:active{transform:translateY(1px)}
button[disabled]{opacity:.5;cursor:default;filter:none}
.note{font-size:.84rem;color:var(--mut);margin:.7rem 0 0}
.hide{display:none}

/* stage rail: a vertical spine so the handoff order is unmistakable */
.stages{margin:2.4rem 0 0;border-left:2px solid var(--line);padding-left:0}
.stage{position:relative;display:flex;align-items:baseline;gap:.7rem;flex-wrap:wrap;
  padding:.72rem 0 .72rem 1.4rem;border-bottom:1px solid var(--line)}
.stage:last-child{border-bottom:0}
.dot{position:absolute;left:-7px;top:1.05rem;width:12px;height:12px;border-radius:50%;
  background:var(--bg);border:2px solid var(--line);transition:background .2s,border-color .2s}
.sname{font:600 1rem var(--sans);letter-spacing:-.01em;min-width:6.2rem}
.smeta{font:.83rem/1.4 var(--mono);color:var(--mut);flex:1 1 auto}
.kind{font:650 .6rem var(--sans);text-transform:uppercase;letter-spacing:.11em;
  padding:.2rem .5rem;border-radius:4px;border:1px solid var(--line);color:var(--mut);white-space:nowrap}
.stage[data-kind=deterministic] .kind{color:var(--ok);border-color:color-mix(in srgb,var(--ok) 40%,transparent)}
.stage[data-kind=model] .kind{color:var(--warn);border-color:color-mix(in srgb,var(--warn) 40%,transparent)}
.stage[data-status=running] .dot{border-color:var(--accent);background:var(--accent);animation:pulse 1.1s ease-in-out infinite}
.stage[data-status=running] .sname{color:var(--accent)}
.stage[data-status=done] .dot{border-color:var(--ok);background:var(--ok)}
.stage[data-status=pending]{opacity:.45}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.82)}}
@media (prefers-reduced-motion:reduce){.stage[data-status=running] .dot{animation:none}}

/* score */
.score{display:flex;gap:1.6rem;align-items:center;background:var(--card);border:1px solid var(--line);
  border-radius:14px;padding:1.5rem 1.7rem;margin:2rem 0 1rem;box-shadow:var(--shadow)}
.score b{font:600 4rem/1 var(--sans);letter-spacing:-.05em;color:var(--accent)}
.score .lab{font:650 .68rem var(--sans);text-transform:uppercase;letter-spacing:.13em;color:var(--mut)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(146px,1fr));gap:.6rem;margin:1rem 0}
.stat{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:.85rem 1rem}
.stat i{display:block;font:600 1.5rem/1.15 var(--sans);font-style:normal;letter-spacing:-.02em}
.stat span{font:.66rem var(--sans);text-transform:uppercase;letter-spacing:.09em;color:var(--mut)}

/* findings */
.f{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--sv);
  border-radius:0 11px 11px 0;padding:1.05rem 1.2rem;margin:.7rem 0;box-shadow:var(--shadow)}
.f h3{font:600 1.04rem var(--sans);margin:0 0 .4rem;letter-spacing:-.01em}
.pill{display:inline-block;font:650 .61rem var(--sans);text-transform:uppercase;letter-spacing:.1em;
  color:#fff;background:var(--sv);padding:.2rem .52rem;border-radius:99px;margin-right:.55rem;vertical-align:2px}
.cite{font:.79rem/1.55 var(--mono);color:var(--mut);margin-top:.6rem;padding-top:.5rem;border-top:1px dashed var(--line);word-break:break-word}
.killed{opacity:.6;border-left-style:dashed}
.err{background:var(--card);border:1px solid color-mix(in srgb,var(--bad) 45%,var(--line));
  border-left:3px solid var(--bad);border-radius:0 11px 11px 0;padding:1.05rem 1.2rem;margin:1.4rem 0}
.err h3{font:600 1.04rem var(--sans);margin:0 0 .3rem;color:var(--bad)}
.err p{margin:0;font-size:.94rem;color:var(--mut)}

table{width:100%;border-collapse:collapse;font:.86rem var(--sans)}
td,th{text-align:left;padding:.46rem .55rem;border-bottom:1px solid var(--line)}
th{font:650 .66rem var(--sans);text-transform:uppercase;letter-spacing:.09em;color:var(--mut)}
code{font:.85em var(--mono);background:color-mix(in srgb,var(--mut) 15%,transparent);padding:.1em .36em;border-radius:4px}
.scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
.op{display:inline-block;min-width:60px;font:700 .66rem var(--sans);letter-spacing:.07em}
.pipe{font:.78rem/1.7 var(--mono);background:var(--card);border:1px solid var(--line);
  border-radius:10px;padding:1rem 1.15rem;white-space:pre-wrap;overflow-x:auto;color:var(--mut)}
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
    return '<div class="stage" id="st-' + s[0] + '" data-status="pending" data-kind="' + s[1] + '">' +
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
