# Context Debt

Your agent setup has debt. Here's the number.

`CLAUDE.md`, `AGENTS.md`, `.claude/agents/`, `.claude/skills/`, `.claude/commands/` accumulate
for months and nobody ever prunes one. This measures what that pile actually costs you
per turn, and which parts of it contradict each other, repeat each other, or point at
files that no longer exist.

```bash
bun install
echo 'OPENROUTER_API_KEY=sk-or-...' > .env

bun run src/index.ts <path-to-repo> "add an authenticated API route"   # CLI
bun run src/server.ts                                                  # web UI on :3000
```

## Real runs

| target | files | est. tokens | stale refs | score |
|---|---|---|---|---|
| this repo | 5 | 1,933 | 0 | 59/100 |
| anthropics/claude-code | 3 | 2,000 | 28 | 54/100 |
| shapeshift/web | 70 | 103,511 | 77 | 23/100 |

## How it works

Five stages. Two of them are deterministic, and that's on purpose.

| # | stage | engine | what it does |
|---|---|---|---|
| 1 | scan | **deterministic** | classify files, estimate tokens, find stale refs |
| 2 | mapper | `gemini-3-flash` | propose findings, each with `file:line` + verbatim quote |
| 3 | simulator | `deepseek-v4-flash` | for a real task, which always-on files are dead weight? |
| 4 | **verify** | **deterministic** | re-read every citation, **kill** findings whose quote isn't there |
| 5 | architect | `gemini-3-flash` | DELETE / MOVE / SCOPE / MERGE / KEEP plan |

Stage 3 runs a different vendor from stage 2 on purpose, so the second opinion isn't the
same brain grading its own homework.

**Stage 4 is the load-bearing idea.** A language model will happily invent a contradiction
that reads perfectly and cite a line that says nothing of the sort. So the pipeline doesn't
ask another model whether to believe it. It reopens the file and checks. Findings whose
evidence isn't on disk get killed, and the kill list is rendered in the report, because a
validation step whose output you can't see isn't a validation step.

Every hop is a zod contract with strict JSON-schema at the API layer and one retry that
feeds the parse error back to the model.

## What it won't do

- Token counts are `chars / 4`, labelled `est.` everywhere. It does not run the real tokenizer.
- It refuses to run on a sparse or partial checkout rather than reporting numbers it can't
  stand behind. See `CHALLENGE_LOG.md` for why that guard exists.
- `~/`-relative references are reported as uncheckable, not as broken.
