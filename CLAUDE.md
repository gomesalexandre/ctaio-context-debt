# 40-Minute Agentic Challenge — Operating Rules

Timed assessment. Time is EXTREMELY scarce. Every minute of research or abstraction is a minute not shipping.

## Prime directive
Ship a narrow, WORKING vertical slice end-to-end. A small thing that demonstrably runs beats a big thing that almost runs.

## Process
1. **Inspect requirements first** (2-3 min max) — read the brief fully before writing any code. Use `challenge-plan` skill.
2. **Simple architecture** — one process, minimal deps, no layers you don't need. Boring tech, flat files, single entry point.
3. **Explicit agent contracts** — every agent call has a defined input shape and output shape (JSON schema or typed struct). No vibes-based parsing.
4. **Validate generated outputs** — parse/schema-check every LLM output; retry-or-fallback on invalid. Never trust raw model text downstream.
5. **Runtime-test autonomously** — use agent-browser to drive the real UI/flow yourself. Don't claim it works without driving it.
6. **Before declaring done** — run build + typecheck + tests, then `ship-check` skill.

## CHALLENGE_LOG.md
Record as you go (one line each, timestamped): meaningful failures, assumptions made, scope cuts, and fixes. This is submission evidence — keep it honest and terse.

## Hard cuts
- No unnecessary research, no speculative abstraction, no config for hypothetical futures.
- No polishing until the slice works end-to-end.
- If stuck >5 min on one thing: cut scope or work around, log it.
