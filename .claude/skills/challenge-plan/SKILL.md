---
name: challenge-plan
description: Rapid planning for the 40-min challenge — requirements → idea → architecture → acceptance criteria → implementation order. Target 3-5 minutes total, then start building.
---

# challenge-plan

Planning is a 3-5 minute sprint, not a document. Output goes at the top of CHALLENGE_LOG.md.

## Steps

1. **Requirements** (1 min) — read the brief twice. List explicit requirements verbatim, and graded criteria if stated. Note what is NOT required (candidate scope cuts).
2. **Idea** (1 min) — pick ONE idea sized to ~30 min of build. Optionally fire the `idea-critic` agent in the background and keep moving; act on MODIFY/KILL only.
3. **Architecture** (1 min) — one paragraph: runtime, entry point, agent calls with their input/output contracts, storage (prefer in-memory/flat file), UI surface. If it needs a diagram, it's too complex.
4. **Acceptance criteria** (1 min) — 3-5 binary checks defining "done", each verifiable by driving the running app. First one is always the happy-path vertical slice.
5. **Implementation order** (1 min) — ordered list, vertical slice first, each step leaves the app runnable. Mark the cut line: everything below it is pre-authorized scope cut if time runs short.

## Rules
- No research beyond the brief unless a requirement is genuinely ambiguous.
- Write the plan into CHALLENGE_LOG.md, then IMMEDIATELY start step 1 of the implementation order.
- If planning exceeds 5 minutes, ship the current plan as-is.
