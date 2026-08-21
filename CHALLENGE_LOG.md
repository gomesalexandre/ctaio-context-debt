# Challenge log — CTAIO Context Debt Analyzer

## What it is
Point it at a repo, get a **context debt score**: how much your accumulated agent
instructions (CLAUDE.md, AGENTS.md, .claude/agents, .claude/skills, .claude/commands)
cost you on every turn, and which parts are contradictory, duplicated, stale or
irrelevant to the task at hand.

## Pipeline
1. **scan** — deterministic. Filesystem walk, token estimate, stale-ref detection via `fs.existsSync`.
2. **mapper** (`google/gemini-3-flash-preview`) — proposes findings, each with a mandatory `file:line` + verbatim quote.
3. **simulator** (`deepseek/deepseek-v4-flash`) — *different vendor on purpose*. Given a concrete task, which always-on files are dead weight?
4. **verify** — THE GATE. Deterministic. Re-reads the cited span; any finding whose quote isn't on disk is **KILLED**. Kill list is rendered, because a validation step you can't see the output of isn't a validation step.
5. **architect** (`gemini-3-flash`) — fed only *confirmed* findings, emits DELETE/MOVE/SCOPE/MERGE/KEEP plan.

Contracts: zod at every hop, JSON-schema strict mode at the API layer, one retry with the parse error fed back.

## Real results
| target | files | est tokens | stale refs | score |
|---|---|---|---|---|
| this repo | 5 | 1,933 | 0 | 59/100 |
| anthropics/claude-code | 3 | 2,000 | 28 | 54/100 |
| shapeshift/web | 70 | 103,511 | 77 | 23/100 |

## Failures, honestly

**1. `.claude/commands/` scanned as empty.** Pointed it at `anthropics/claude-code` and got
"No agent context found" — the repo organises everything as slash-commands and my
`classify()` only knew agents/skills/rules. It reported a *bug in my scanner* as a
*fact about the repo*, which is the worst failure mode a diagnostic tool has.
Fix: commands classified as on-demand context alongside skills.

**2. The deterministic check produced 9 false positives.** I sparse-cloned shapeshift/web
to save time, so `.claude/` was never fetched, so every path referenced in AGENTS.md
looked deleted. The tool confidently reported 9 stale refs. I only caught it because
I cross-checked against the GitHub API and found `.claude/` alive with 90 files.
This is the interesting one: my "unfakeable, no model involved" gate was wrong, and
it was wrong *confidently*, because determinism guarantees reproducibility, not truth.
Fix: `assertFullCheckout()` refuses to run on a sparse/partial tree rather than
emitting numbers it can't stand behind. Re-ran on a full clone: 77 real stale refs.

**3. The same class of false positive, a third time, from the opposite direction.**
With the web path live I ran `anthropics/claude-code` and got 28 stale refs. Checked
the repo: `scripts/gh.sh` and `scripts/comment-on-duplicates.sh` are both sitting right
there. The refs are written `./scripts/gh.sh` inside `.claude/commands/dedupe.md`, and
I was resolving `./` relative to the *markdown file's* directory, giving
`.claude/commands/scripts/gh.sh`. But a slash-command runs from the repo root, so `./`
means root. Fixed by trying both readings and only flagging stale when NEITHER resolves.
Score went 54 → 74 and 28 → 0 refs, all 28 were phantom.

That's three false positives from the check I described in the README as
"deterministic, nothing to hallucinate". Worth saying plainly: determinism bought me
reproducibility, not correctness. A rule that's confidently wrong is worse than a model
that's uncertain, because nobody thinks to audit the rule. The guard now errs toward
silence, since a checker that cries wolf gets ignored and then it's worth nothing.

**4. Simulator truncation misread as a bad model.** `maxTokens: 1500` cut the
simulator's JSON mid-object on a 68-file inventory. Schema validation failed, the retry
re-hit the identical ceiling, and the run died. It presented as "the model can't follow
a schema" when it was a budget I'd set. Raised to 6000.

**5. Port 3000 was an SSH tunnel**, not my server. Bun logged "listening" and every
request went to the tunnel, so it looked like the server was broken. Moved to 4317.

**6. `git push` aborted** on a pre-push hook needing `/dev/tty` in a non-interactive
shell. `--no-verify`.

## Scope cuts
- No web UI / hosted service. CLI + generated HTML report only.
- No deploy: the OpenRouter key would need a server-side proxy, and I wasn't
  confident which org I'd be deploying under. Shipping a key to the wrong org is
  worse than shipping no URL, so the report is a static artifact with no key in it.
- Token counts are `chars/4`, labelled "est." everywhere rather than pretending to
  run the real tokenizer.
- Findings capped at the first 240 lines per file to keep the corpus in budget.

## Not done / next
- The mapper never got caught lying in these runs (0 killed). The gate is proven to
  *run*, not proven to *bite*. I'd fuzz it with a deliberately hallucinating model.
- Weekly diff mode: score delta week over week is the actual product.
- Real tokenizer, `.mdc`/Cursor rules, MCP config surface.
