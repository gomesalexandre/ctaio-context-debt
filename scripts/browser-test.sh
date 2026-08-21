#!/usr/bin/env bash
# Autonomous runtime check: drive the real UI, not a mock.
# Goal, in the words of someone who'd actually use this:
#   "Audit a repo's coding-agent context and decide whether the
#    recommendations are concrete and trustworthy."
set -uo pipefail
PORT="${PORT:-3000}"
URL="http://localhost:${PORT}"
SHOT="${SHOT:-/tmp/ctxdebt}"

fail() { echo "FAIL: $*" >&2; exit 1; }

echo "== 1. page loads =="
agent-browser open "$URL" >/dev/null 2>&1 || fail "could not open $URL"
agent-browser wait --load networkidle >/dev/null 2>&1
agent-browser get text body 2>/dev/null | head -5
agent-browser screenshot "${SHOT}-1-load.png" 2>&1 | tail -1

echo "== 2. happy path: analyze a real repo =="
agent-browser snapshot -i 2>/dev/null | head -20
agent-browser find placeholder "shapeshift/web" fill "shapeshift/web" >/dev/null 2>&1 \
  || agent-browser fill "#repo" "shapeshift/web" >/dev/null 2>&1 \
  || fail "no repo input found"
agent-browser find text "Analyze" click >/dev/null 2>&1 || fail "no Analyze button"

# Stages must actually progress. Wait for the terminal stage, not a fixed sleep.
agent-browser wait --text "architect" >/dev/null 2>&1 \
  || agent-browser wait --fn "document.body.innerText.match(/score|Score/i)" >/dev/null 2>&1 \
  || echo "WARN: never saw a terminal stage"
agent-browser screenshot "${SHOT}-2-result.png" 2>&1 | tail -1
agent-browser get text body 2>/dev/null | head -40

echo "== 3. failure case: repo that does not exist =="
agent-browser open "$URL" >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1
agent-browser fill "#repo" "gomesalexandre/definitely-not-a-real-repo-9999" >/dev/null 2>&1
agent-browser find text "Analyze" click >/dev/null 2>&1
agent-browser wait 6000 >/dev/null 2>&1
agent-browser get text body 2>/dev/null | grep -iE "not found|private|error|rate" \
  && echo "OK: error surfaced to the user" \
  || echo "BLOCKER: bad repo produced no visible error"
agent-browser screenshot "${SHOT}-3-error.png" 2>&1 | tail -1

echo "== done, shots at ${SHOT}-*.png =="
