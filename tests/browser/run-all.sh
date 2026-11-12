#!/bin/bash
# 브라우저 시험 전부: bash tests/browser/run-all.sh  → 시험마다 PASS/FAIL 수
D="$(cd "$(dirname "$0")" && pwd)"
for f in game.e2e offline.e2e dungeon3.e2e teacher-full.e2e bank.test import.test sound.test; do
  r=$(bash "$D/run.sh" "$f.html")
  echo "$f: PASS $(echo "$r" | grep -c '^PASS') / FAIL $(echo "$r" | grep -cE '^(FAIL|ERROR)')"
  echo "$r" | grep -E '^(FAIL|ERROR)' | head -5
done
