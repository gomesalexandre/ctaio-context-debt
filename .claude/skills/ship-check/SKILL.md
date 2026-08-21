---
name: ship-check
description: Pre-submission gate for the 40-min challenge — build/typecheck, exercise the real workflow, adversarial review, autonomous browser test, fix blockers, deploy, summarize CHALLENGE_LOG.md. Run in the final ~10 minutes.
---

# ship-check

Final gate before submission. Run every step; skip nothing silently — log skips in CHALLENGE_LOG.md.

## Steps

1. **Build + typecheck** — run the project's build/typecheck (and tests if they exist). Fix errors before proceeding; warnings ship.
2. **Exercise the real workflow** — start the app and drive the primary user flow end-to-end for real (real agent calls, not mocks). Confirm each acceptance criterion from the plan.
3. **Adversarial review** — fire the `skeptic` agent on the implementation. While it runs, continue to step 4.
4. **Autonomous browser test** — use agent-browser to drive the UI yourself: load, complete the happy path, one failure case (empty input or forced error). Screenshot the working result as evidence.
5. **Fix blockers only** — from skeptic + browser findings, fix BLOCKERs. IMPORTANT gets fixed only if <5 min remain uncommitted; NICE-TO-HAVE is logged and cut.
6. **Deploy** — if the challenge asks for a deployment/URL, ship it now (simplest host that works) and verify the deployed URL with agent-browser, not just localhost.
7. **Summarize CHALLENGE_LOG.md** — top section for submission: what was built, what works (evidenced), assumptions, scope cuts, meaningful failures + fixes. Honest and terse; judges reward candor over polish.

## Rules
- If time is nearly out, priority is: happy path works > deployed > log summarized > everything else.
- Never claim something works that wasn't driven in step 2 or 4.
