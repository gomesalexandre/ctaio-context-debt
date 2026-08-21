const esc = (s: string) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function renderHtml(r: any): string {
  const sev = (s: string) => ({ high: '#c0392b', medium: '#b9770e', low: '#5d6d7e' })[s] ?? '#555';
  const confirmed = r.findings.filter((f: any) => f.verdict === 'CONFIRMED');
  const killed = r.findings.filter((f: any) => f.verdict === 'KILLED');
  const byKind = (k: string) => r.inventory.files.filter((f: any) => f.kind === k);
  const sum = (fs: any[]) => fs.reduce((a: number, f: any) => a + f.estTokens, 0);

  return `<title>Context Debt Report</title>
<style>
:root{--bg:#fbfaf8;--fg:#1a1a1a;--mut:#6b6b6b;--line:#e2ddd5;--card:#fff;--accent:#b8501f}
:root:not([data-theme=light]) @media (prefers-color-scheme:dark){}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#16161a;--fg:#ededed;--mut:#9a9a9a;--line:#2e2e36;--card:#1e1e24;--accent:#e0763f}}
:root[data-theme=dark]{--bg:#16161a;--fg:#ededed;--mut:#9a9a9a;--line:#2e2e36;--card:#1e1e24;--accent:#e0763f}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--fg);font:16px/1.6 ui-serif,Georgia,serif;margin:0;padding:2.5rem 1.25rem}
.wrap{max-width:860px;margin:0 auto}
h1{font-size:2rem;margin:0 0 .2rem;letter-spacing:-.02em}
h2{font-size:1.15rem;margin:2.5rem 0 .8rem;padding-bottom:.4rem;border-bottom:1px solid var(--line);font-family:ui-sans-serif,system-ui,sans-serif}
.sub{color:var(--mut);font-size:.9rem;margin-bottom:2rem;font-family:ui-monospace,monospace}
.score{display:flex;gap:1.5rem;align-items:baseline;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:1.25rem 1.5rem;margin:1.5rem 0}
.score b{font-size:3.2rem;line-height:1;color:var(--accent);font-family:ui-sans-serif,system-ui,sans-serif}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.75rem;margin:1rem 0}
.stat{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:.8rem 1rem}
.stat i{display:block;font-style:normal;font-size:1.5rem;font-weight:600;font-family:ui-sans-serif,system-ui,sans-serif}
.stat span{font-size:.72rem;color:var(--mut);text-transform:uppercase;letter-spacing:.06em;font-family:ui-sans-serif,system-ui,sans-serif}
.f{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--sv);border-radius:8px;padding:1rem 1.1rem;margin:.7rem 0}
.f h3{margin:0 0 .35rem;font-size:1rem;font-family:ui-sans-serif,system-ui,sans-serif}
.tag{font-size:.66rem;text-transform:uppercase;letter-spacing:.07em;color:#fff;background:var(--sv);padding:.14rem .5rem;border-radius:99px;font-family:ui-sans-serif,system-ui,sans-serif;vertical-align:middle;margin-right:.4rem}
.cite{font-family:ui-monospace,monospace;font-size:.78rem;color:var(--mut);margin-top:.5rem;border-top:1px dashed var(--line);padding-top:.45rem}
.killed{opacity:.62}
table{width:100%;border-collapse:collapse;font-size:.86rem;font-family:ui-sans-serif,system-ui,sans-serif}
td,th{text-align:left;padding:.42rem .5rem;border-bottom:1px solid var(--line)}
th{font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;color:var(--mut)}
code{font-family:ui-monospace,monospace;font-size:.83em;background:rgba(128,128,128,.13);padding:.08em .35em;border-radius:3px}
.op{display:inline-block;min-width:62px;font-size:.68rem;font-weight:700;letter-spacing:.05em;font-family:ui-sans-serif,system-ui,sans-serif}
.pipe{font-family:ui-monospace,monospace;font-size:.78rem;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:1rem;white-space:pre-wrap;overflow-x:auto}
.note{font-size:.83rem;color:var(--mut);font-style:italic}
.scroll{overflow-x:auto}
</style>
<div class="wrap">
<h1>Context Debt Report</h1>
<div class="sub">${esc(r.root)} · ${esc(r.generatedAt)} · ${r.elapsedMs}ms</div>

<div class="score">
  <b>${r.score}</b>
  <div><div style="font-size:.78rem;text-transform:uppercase;letter-spacing:.07em;color:var(--mut);font-family:ui-sans-serif,system-ui,sans-serif">Context debt score / 100</div>
  <div class="note">Higher is healthier. Computed from measured tokens, verified findings and stale refs — not asked of a model.</div></div>
</div>

<div class="grid">
  <div class="stat"><i>${r.inventory.alwaysOnTokens.toLocaleString()}</i><span>Always-on tokens (est.)</span></div>
  <div class="stat"><i>${r.wastePct}%</i><span>Irrelevant to this task</span></div>
  <div class="stat"><i>${r.inventory.staleRefs.length}</i><span>Stale references</span></div>
  <div class="stat"><i>${confirmed.length}</i><span>Verified findings</span></div>
  <div class="stat"><i>${killed.length}</i><span>Hallucinations killed</span></div>
</div>

<h2>Inventory</h2>
<div class="scroll"><table>
<tr><th>Kind</th><th>Files</th><th>Est. tokens</th></tr>
${['always-on', 'rule', 'agent', 'skill']
  .map((k) => `<tr><td><code>${k}</code></td><td>${byKind(k).length}</td><td>${sum(byKind(k)).toLocaleString()}</td></tr>`)
  .join('')}
</table></div>

<h2>Task simulation</h2>
<p>For the task <b>&ldquo;${esc(r.task)}&rdquo;</b>, <code>${r.models.simulator}</code> judged these always-on files dead weight:</p>
<p>${r.simulation.irrelevantAlwaysOn.map((f: string) => `<code>${esc(f)}</code>`).join(' ') || '<span class="note">none</span>'}</p>
<p class="note">${esc(r.simulation.rationale)}</p>

<h2>Verified findings</h2>
${
  confirmed
    .map(
      (f: any) => `<div class="f" style="--sv:${sev(f.severity)}">
<h3><span class="tag">${esc(f.severity)}</span>${esc(f.title)}</h3>
<div>${esc(f.detail)}</div>
${f.citations.map((c: any) => `<div class="cite">✓ ${esc(c.file)}:${c.line} &nbsp;&ldquo;${esc(c.quote.slice(0, 150))}&rdquo;</div>`).join('')}
</div>`,
    )
    .join('') || '<p class="note">No findings survived verification.</p>'
}

${
  killed.length
    ? `<h2>Killed by the citation gate</h2>
<p class="note">These were produced by <code>${r.models.mapper}</code> but their quoted evidence does not exist at the cited line. The gate is deterministic — it re-reads the file. They are shown because a validation step you can't see the output of isn't a validation step.</p>
${killed
  .map(
    (f: any) => `<div class="f killed" style="--sv:#7f8c8d"><h3>✗ ${esc(f.title)}</h3>
<div class="cite">killed: ${esc(f.killReason ?? '')}</div></div>`,
  )
  .join('')}`
    : ''
}

<h2>Stale references</h2>
${
  r.inventory.staleRefs.length
    ? `<div class="scroll"><table><tr><th>File</th><th>Line</th><th>Broken ref</th></tr>
${r.inventory.staleRefs.slice(0, 25).map((s: any) => `<tr><td><code>${esc(s.file)}</code></td><td>${s.line}</td><td><code>${esc(s.ref)}</code></td></tr>`).join('')}
</table></div><p class="note">Detected with <code>fs.existsSync</code>. No model involved, nothing to hallucinate.</p>`
    : '<p class="note">None — every referenced path resolves.</p>'
}

<h2>Proposed cleanup</h2>
<div class="scroll"><table><tr><th>Op</th><th>Target</th><th>Rationale</th><th>Est. saved</th></tr>
${r.actions
  .map(
    (a: any) =>
      `<tr><td><span class="op" style="color:${a.op === 'DELETE' ? '#c0392b' : a.op === 'KEEP' ? '#1e8449' : 'var(--accent)'}">${esc(a.op)}</span></td><td><code>${esc(a.target)}</code></td><td>${esc(a.rationale)}</td><td>${a.estTokensSaved ? `~${a.estTokensSaved.toLocaleString()}` : '—'}</td></tr>`,
  )
  .join('')}
</table></div>

<h2>Pipeline trace</h2>
<div class="pipe">${r.pipeline.map((l: string) => esc(l)).join('\n')}</div>
<p class="note">Stages 1 and 4 are deterministic. Stages 2, 3 and 5 are models, each under a schema contract, and stage 4 exists to catch stage 2 lying.</p>
</div>`;
}
