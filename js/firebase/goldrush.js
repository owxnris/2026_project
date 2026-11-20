// 골드 러시 실시간 현황: 이 활동의 진행 상황(progress) 문서를 실시간으로 받아 참가자 수·총 골드·순위를 만든다.
// 진행 상황 문서의 coins = 이벤트에서 모은 골드 (학생이 정답을 맞힐 때마다 씀 — progress.js).
// 실제로 참가한 학생 데이터만 보여 준다 (가짜 참가자 없음). Firebase가 없는 예비 흐름은 이 기기 한 명만
import { collection, onSnapshot } from './sdk.js';
import { db, auth } from './app.js';
import { session } from '../session.js';
import { state } from '../state.js';
import { boardOf } from '../goldrushBoard.js';

// cb(현황)을 바뀔 때마다 부른다. 돌려준 함수를 부르면 그만 받는다
export function liveBoard(cb) {
  if (!session.online) {
    const me = [{ uid: 'me', nickname: session.nickname || '나', coins: state.coins }];
    cb(boardOf(me, 'me'));
    const t = setInterval(() => cb(boardOf([{ ...me[0], coins: state.coins }], 'me')), 1000);
    return () => clearInterval(t);
  }
  return onSnapshot(collection(db, 'classes', session.classId, 'activities', session.activityId, 'progress'), (snap) => {
    cb(boardOf(snap.docs.map((d) => ({ uid: d.id, ...d.data() })), auth.currentUser?.uid));
  }, () => cb({ participants: 0, totalGold: 0, top: [], rank: null, error: true }));
}
