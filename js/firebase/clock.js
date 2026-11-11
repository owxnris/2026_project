// 서버 시각 맞추기. Cloud Functions가 없으므로 Firestore의 서버 시각(serverTimestamp)으로 기기 시계와의 차이를 잰다.
// 교사는 활동을 시작할 때, 학생은 진행 상황을 처음 쓸 때 한 번 맞춘다. 맞추기 전에는 기기 시각을 그대로 쓴다.
let offsetMs = 0; // 서버 시각 - 기기 시각

export function serverNow() {
  return Date.now() + offsetMs;
}

// sentMs: 쓰기 요청을 보내기 직전 기기 시각, recvMs: 서버 시각을 읽은 직후 기기 시각 (왕복 시간의 절반을 지연으로 본다)
export function syncClock(serverMs, sentMs, recvMs) {
  offsetMs = serverMs - (sentMs + recvMs) / 2;
}

// 오류 → 이유 코드 (permission-denied, unavailable …). 판 진행 오류(RunError)는 reason을 그대로 쓴다
export function errorReason(e) {
  return e?.reason || String(e?.code || e?.message || 'unknown').replace(/^firestore\//, '');
}
