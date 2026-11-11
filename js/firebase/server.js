// 서버 함수(Cloud Functions) 부르기와 서버 시각. 교사 플랫폼과 학생용 게임이 함께 쓴다.
// 서버 함수는 응답마다 serverNow(서버 시각, ms)를 돌려준다 → 기기 시계와의 차이를 기억해 남은 시간 계산에 쓴다.
import { httpsCallable } from './sdk.js';
import { functions } from './app.js';

let offsetMs = 0; // 서버 시각 - 기기 시각

export function serverNow() {
  return Date.now() + offsetMs;
}

export async function callServer(name, data) {
  const sent = Date.now();
  const { data: res } = await httpsCallable(functions, name)(data);
  if (typeof res?.serverNow === 'number') offsetMs = res.serverNow - (sent + Date.now()) / 2;
  return res;
}

// 서버 함수 오류 → 이유 코드 (functions/handlers.js의 details.reason, 없으면 오류 코드)
export function errorReason(e) {
  return e?.details?.reason || String(e?.code || e?.message || 'unknown').replace(/^functions\//, '');
}
