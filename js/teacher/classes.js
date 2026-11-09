// 학급 만들기와 참여 코드 발급.
// 참여 코드: 무작위 숫자 6자리. 지금 쓰이는 코드(joinCodes에 있는 코드)와 겹치지 않게 한다.
import { doc, getDoc, collection, writeBatch, serverTimestamp } from '../firebase/sdk.js';
import { auth, db } from '../firebase/app.js';

const MAX_TRIES = 5;

export function makeJoinCode() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return String(n).padStart(6, '0');
}

async function codeInUse(code) {
  return (await getDoc(doc(db, 'joinCodes', code))).exists();
}

// 학급 문서와 참여 코드 문서를 한 번에 저장하고 { classId, joinCode }를 돌려준다.
export async function createClass(name) {
  const ownerUid = auth.currentUser.uid;

  for (let i = 0; i < MAX_TRIES; i++) {
    const joinCode = makeJoinCode();
    if (await codeInUse(joinCode)) continue;

    const classRef = doc(collection(db, 'classes'));
    const batch = writeBatch(db);
    batch.set(classRef, { ownerUid, name, joinCode, createdAt: serverTimestamp() });
    batch.set(doc(db, 'joinCodes', joinCode), { classId: classRef.id, ownerUid });

    try {
      await batch.commit();
      return { classId: classRef.id, joinCode };
    } catch (e) {
      // 확인과 저장 사이에 다른 교사가 같은 코드를 쓴 경우: 규칙이 덮어쓰기를 막으므로 새 코드로 다시
      if (e.code === 'permission-denied' && (await codeInUse(joinCode))) continue;
      throw e;
    }
  }
  throw new Error('참여 코드를 만들지 못했어요. 다시 눌러 주세요.');
}
