#!/bin/bash
# 브라우저 시험 하나 실행: bash tests/browser/run.sh game.e2e.html [가상 시간 ms]
# 결과는 PASS/FAIL 줄로 나온다. Chrome 헤드리스를 쓴다 (경로가 다르면 CHROME 환경 변수로 지정)
D="$(cd "$(dirname "$0")" && pwd)"
CHROME="${CHROME:-/c/Program Files/Google/Chrome/Application/chrome.exe}"
curl -s -o /dev/null http://127.0.0.1:5599/ || { (node "$D/server.mjs" > "$D/.server.log" 2>&1 &); sleep 1; }
"$CHROME" --headless=new --disable-gpu --no-first-run --user-data-dir="$D/.chrome-profile" --virtual-time-budget=${2:-30000} --dump-dom "http://127.0.0.1:5599/__test/$1" 2>/dev/null | sed -n '/<pre id="out">/,/<\/pre>/p' | sed 's/<[^>]*>//g; s/^[[:space:]]*//'
