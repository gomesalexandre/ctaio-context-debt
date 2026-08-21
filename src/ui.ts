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
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&family=IBM+Plex+Mono:wght@400;500;600&family=Newsreader:opsz,wght@6..72,500;6..72,600;6..72,700&display=swap" rel="stylesheet">
<style>
/* CTAIO Labs — Context Debt Analyzer. Dark chrome, paper body, amber signal. */
:root{
  --ink:#16161D;--paper:#F6F6F8;--card:#FFFFFF;--rule:#E3E3E9;
  --dark:#100F1A;--dark2:#1A1926;--darkrule:#22222F;--darkline:#2E2E3B;
  --amber:#F5A623;--amber2:#FFBB44;--link:#B26A00;
  --mut:#6E6E7E;--mut2:#5B5B69;--dim:#7C7C8C;--dim2:#5C5C6E;--onDark:#C9C9D4;
  --bad:#C4342A;--warn:#B26A00;--ok:#1A7F4B;
  --sans:"DM Sans",ui-sans-serif,system-ui,sans-serif;
  --mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
  --serif:"Newsreader",ui-serif,Georgia,serif;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--paper)}
body{font-family:var(--sans);color:var(--ink);-webkit-font-smoothing:antialiased}
a{color:var(--link);text-decoration:none} a:hover{color:var(--ink)}
::selection{background:#FBE3B4}
.shell{max-width:1280px;margin:0 auto;padding:0 40px}
@media(max-width:720px){.shell{padding:0 20px}}

/* nav */
.nav{background:var(--dark);border-bottom:1px solid var(--darkrule)}
.nav .shell{height:64px;display:flex;align-items:center;gap:40px}
.brand{font-family:var(--sans);font-weight:700;font-size:15px;color:#fff;letter-spacing:-.01em}
.brand span{color:var(--amber)}
.navlinks{display:flex;gap:26px;font-size:14.5px;font-weight:500;color:var(--onDark)}
.navlinks a{color:var(--onDark)} .navlinks a.on{color:#fff}
@media(max-width:720px){.navlinks{display:none}}

/* hero */
.hero{background:var(--dark);color:#fff}
.hero .shell{padding:56px 40px 44px;display:grid;grid-template-columns:1fr 1fr;gap:72px;align-items:start}
@media(max-width:900px){.hero .shell{grid-template-columns:1fr;gap:32px;padding:40px 20px 36px}}
.eyebrow{font-size:12px;font-weight:700;letter-spacing:.16em;color:var(--amber);margin-bottom:16px}
.hero h1{font-family:var(--serif);font-weight:600;font-size:clamp(32px,4.4vw,46px);line-height:1.1;letter-spacing:-.02em;margin:0 0 14px}
.hero p{font-size:15px;line-height:1.55;color:var(--onDark);margin:0;max-width:46ch}
form{display:flex;gap:10px}
input{flex:1;min-width:0;font-family:var(--mono);font-size:14px;padding:13px 15px;border:1px solid #34343F;background:var(--dark2);color:#fff;border-radius:8px}
input:focus{outline:none;border-color:var(--amber)}
input::placeholder{color:#8A8A96}
button{font-family:var(--sans);font-size:14.5px;font-weight:700;padding:13px 24px;background:var(--amber);color:var(--dark);border:none;border-radius:8px;cursor:pointer;white-space:nowrap}
button:hover{background:var(--amber2)} button[disabled]{opacity:.55;cursor:default}
.reads{margin-top:14px;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.reads b{font-family:var(--mono);font-size:11.5px;color:var(--dim2);font-weight:400;margin-right:4px}
.reads span{font-family:var(--mono);font-size:11.5px;padding:4px 9px;border:1px solid var(--darkline);border-radius:999px;color:var(--onDark)}

/* pipeline strip */
.stages{display:flex;background:var(--card);border:1px solid var(--rule);margin:0}
.stages.hide{display:none}
@media(max-width:900px){.stages{flex-direction:column}}
.stage{flex:1;padding:16px 20px;border-left:3px solid var(--rule);display:flex;align-items:baseline;gap:11px;min-width:0}
.stage:first-child{border-left-width:1px}
.stage[data-status=running]{border-left-color:var(--amber);background:#FFFCF5}
.stage[data-status=done]{border-left-color:var(--ok)}
.stage[data-status=error]{border-left-color:var(--bad)}
.stage[data-status=pending]{opacity:.5}
.dot{font-family:var(--mono);font-size:11px;color:var(--amber);font-weight:600}
.stage[data-status=running] .dot::after{content:"▸"} 
.stage[data-status=done] .dot::after{content:"✓";color:var(--ok)}
.stage[data-status=pending] .dot::after{content:"·"}
.stage[data-status=error] .dot::after{content:"✗";color:var(--bad)}
.sname{font-size:14px;font-weight:700;letter-spacing:-.005em;text-transform:capitalize}
.smeta{font-family:var(--mono);font-size:11.5px;color:var(--mut);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}
.kind{font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);white-space:nowrap}
.stage[data-kind=deterministic] .kind{color:var(--ok)}

/* results, on paper */
.body{padding:0 0 90px}
.wrap{max-width:1280px;margin:0 auto;padding:0 40px}
@media(max-width:720px){.wrap{padding:0 20px}}
h2{font-family:var(--serif);font-weight:600;font-size:28px;letter-spacing:-.015em;margin:44px 0 6px}
.note{font-size:14.5px;color:var(--mut2);margin:0 0 20px;max-width:78ch}
.score{display:grid;grid-template-columns:auto 1fr;gap:28px;align-items:center;background:var(--dark);color:#fff;padding:28px 32px;margin:0}
@media(max-width:720px){.score{grid-template-columns:1fr;gap:12px;padding:22px}}
.score b{font-family:var(--serif);font-weight:500;font-size:64px;line-height:1;letter-spacing:-.03em;color:var(--amber)}
.score .lab{font-family:var(--mono);font-size:11.5px;letter-spacing:.1em;color:var(--dim2);text-transform:uppercase}
.score .note{color:var(--onDark);margin:6px 0 0;font-size:13.5px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1px;background:var(--rule);border:1px solid var(--rule);border-top:none}
.stat{background:var(--card);padding:16px 18px}
.stat i{display:block;font-style:normal;font-family:var(--serif);font-weight:500;font-size:30px;line-height:1;letter-spacing:-.02em}
.stat span{font-size:12px;color:var(--dim);margin-top:6px;display:block}
.f{background:var(--card);border:1px solid var(--rule);border-left:3px solid var(--sv);padding:18px 20px;margin:10px 0}
.f h3{font-size:15.5px;font-weight:700;letter-spacing:-.01em;margin:0 0 6px}
.pill{display:inline-block;font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;font-weight:600;color:var(--dark);background:var(--amber);padding:3px 8px;border-radius:3px;margin-right:9px;vertical-align:1px}
.f[style*="--bad"] .pill{background:var(--bad);color:#fff}
.cite{font-family:var(--mono);font-size:11.5px;line-height:1.6;color:var(--mut);margin-top:9px;padding-top:8px;border-top:1px solid var(--rule);word-break:break-word}
.killed{opacity:.62;border-left-style:dashed}
.err{background:var(--card);border:1px solid var(--rule);border-left:3px solid var(--bad);padding:18px 20px;margin:24px 0}
.err h3{font-size:15.5px;font-weight:700;margin:0 0 4px;color:var(--bad)}
.err p{margin:0;font-size:14px;color:var(--mut2)}
table{width:100%;border-collapse:collapse;font-size:13.5px;background:var(--card)}
td,th{text-align:left;padding:10px 14px;border-bottom:1px solid var(--rule)}
th{font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--dim);font-weight:600}
code{font-family:var(--mono);font-size:.88em;background:#F0F0F4;padding:.12em .38em;border-radius:3px}
.scroll{overflow-x:auto;border:1px solid var(--rule)}
.op{display:inline-block;min-width:58px;font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.06em}
.pipe{font-family:var(--mono);font-size:11.5px;line-height:1.75;background:var(--card);border:1px solid var(--rule);padding:16px 18px;white-space:pre-wrap;overflow-x:auto;color:var(--mut)}
</style>
</head>
<body>
<div class="nav"><div class="shell">
  <div class="brand">CTAIO<span> Labs</span></div>
  <div class="navlinks"><a href="https://ctaio.dev/">Newsletter</a><a href="https://ctaio.dev/">Weekly AI Edge</a><a class="on" href="#">Labs</a><a href="https://ctaio.dev/">Podcast</a></div>
</div></div>

<div class="hero"><div class="shell">
  <div>
    <div class="eyebrow">CTAIO LABS &middot; AGENT CONTEXT</div>
    <h1>Your agent setup has debt. Here's the number.</h1>
    <p>Instruction files accumulate for months and nobody prunes one. This measures what they cost on every turn, and which of them contradict each other, repeat each other, or point at files that are gone.</p>
  </div>
  <div>
    <form id="f">
      <input id="repo" placeholder="github.com/org/repo" value="shapeshift/web" autocomplete="off" spellcheck="false">
      <button id="go" type="submit">Analyze</button>
    </form>
    <div class="reads"><b>reads</b>
      <span>CLAUDE.md</span><span>AGENTS.md</span><span>.claude/agents</span><span>.claude/skills</span><span>.claude/commands</span>
    </div>
  </div>
</div></div>

<div class="body"><div class="wrap">
<div id="stages" class="stages hide"></div>
<div id="err"></div>
<div id="out"></div>
</div></div>

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
