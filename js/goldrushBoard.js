// 골드 러시 현황 계산 (순수 함수): 진행 상황 문서들 → 참가자 수·총 골드·순위.
// 학생 게임(js/firebase/goldrush.js)과 교사 진행 중 화면(js/teacher/activityView.js)이 함께 쓴다. 시험: tests/test/goldrush.test.js
// entries: [{ uid, nickname, coins }] — coins = 이벤트에서 모은 골드
export function boardOf(entries, myUid, topN = 5) {
  const list = entries.map((e) => ({ uid: e.uid, nickname: e.nickname, gold: e.coins ?? 0 }))
    .sort((a, b) => b.gold - a.gold || String(a.nickname).localeCompare(String(b.nickname), 'ko'));
  let rank = 0;
  list.forEach((p, i) => {
    p.rank = i > 0 && list[i - 1].gold === p.gold ? list[i - 1].rank : i + 1; // 같은 골드는 같은 순위
    if (p.uid === myUid) rank = p.rank;
  });
  return {
    participants: list.length, totalGold: list.reduce((n, p) => n + p.gold, 0), top: list.slice(0, topN), all: list, rank: rank || null, me: myUid,
  };
}
