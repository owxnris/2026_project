#!/bin/bash
# 게임 화면 캡처(눈으로 확인용): bash tests/browser/shot.sh out.png "scene=Dungeon&data=%7B%22dungeon%22:0%7D&x=900" [ms] [shot.html|shot-on.html]
D="$(cd "$(dirname "$0")" && pwd)"
CHROME="${CHROME:-/c/Program Files/Google/Chrome/Application/chrome.exe}"
curl -s -o /dev/null http://127.0.0.1:5599/ || { (node "$D/server.mjs" > "$D/.server.log" 2>&1 &); sleep 1; }
"$CHROME" --headless=new --disable-gpu --no-first-run --user-data-dir="$D/.chrome-profile" --hide-scrollbars --window-size=960,560 --virtual-time-budget=${3:-8000} --screenshot="$D/$1" "http://127.0.0.1:5599/__test/${4:-shot.html}?$2" 2>/dev/null
