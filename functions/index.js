// Cloud Functions 진입점 (서버 채점). 실제 동작은 handlers.js, 채점 규칙은 grading.js에 있다.
// 배포: 이 폴더에서 npm install → 프로젝트 폴더에서 firebase deploy --only functions
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { createHandlers, CallError } from './handlers.js';

// 서버 함수 지역. js/firebase/app.js의 FUNCTIONS_REGION과 반드시 같아야 한다 (다르면 호출이 실패한다).
// Firestore 데이터베이스 위치와 같으면 더 빠르다 (달라도 동작한다).
const REGION = 'asia-northeast3';
// maxInstances: 갑자기 호출이 몰려도 서버가 끝없이 늘지 않게 하는 상한 (비용 보호)
setGlobalOptions({ region: REGION, maxInstances: 10 });

initializeApp();
const handlers = createHandlers({
  db: getFirestore(),
  ts: (ms) => Timestamp.fromMillis(ms),
  now: () => Date.now(),
});

function callable(fn) {
  return onCall(async (request) => {
    const auth = request.auth
      ? { uid: request.auth.uid, provider: request.auth.token.firebase?.sign_in_provider }
      : null;
    try {
      return await fn(auth, request.data ?? {});
    } catch (e) {
      if (e instanceof CallError) throw new HttpsError(e.code, e.message, e.details);
      throw e;
    }
  });
}

export const startActivity = callable(handlers.startActivity);
export const endActivity = callable(handlers.endActivity);
export const startRun = callable(handlers.startRun);
export const issueQuestion = callable(handlers.issueQuestion);
export const submitAnswer = callable(handlers.submitAnswer);
export const finishRun = callable(handlers.finishRun);
