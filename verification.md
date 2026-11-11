# 실제 Firebase 배포·검증 기록

가짜 Firebase 시험(자동)과 실제 Firebase 확인을 구분해 적는다. **실제 Firebase에서 직접 확인한 항목만 '실제 확인'에 체크한다.**
- 프로젝트: `gbl-dungeondash` (.firebaserc, js/firebase/config.js)
- 요금제: **Spark(무료) 그대로**. Cloud Functions·Blaze를 쓰지 않는다. 서버 코드가 없고, 규칙(firestore.rules)과 학생 기기가 일을 나눈다 (spec.md '정답 노출과 보안 한계')

## 1. 배포 전 점검 (2026-11-11, 코드 수준에서 확인함)
| 항목 | 상태 |
|---|---|
| .firebaserc 기본 프로젝트 = config.js projectId | 같음 (gbl-dungeondash) |
| Cloud Functions 의존 | 없음 (functions/ 폴더·firebase.json functions·SDK functions import 삭제. 검색: `grep -rn "httpsCallable\|getFunctions\|callServer" js` 결과 없음) |
| 보안 규칙 | Firestore 에뮬레이터(실제 규칙 엔진)에서 컴파일·시험 통과 11묶음 (tests/test-rules, `npm run test:rules`, Java·firebase-tools 필요) |
| 복합 색인 | 필요 없음 (쿼리는 같음(==) 조건만 씀) |
| 자동 시험 | 노드 28개(tests/test), 브라우저 흐름 game 52·teacher 73·dungeon 11·bank 40·import 16·offline 5 |
| 무료 사용량 | Spark 일일 한도(쓰기 2만·읽기 5만) 안인지는 수업 규모로 확인해야 한다. 쓰기는 진행 상황(progress)이 코인·던전이 바뀔 때만(최대 1초에 1번), 결과는 판마다 1개, 복습 기록은 답할 때마다 1개다. 학생 30명이 한 수업에 하면 대략 수천 건 (확인 전, 아래 U5) |

## 2. 사용자가 직접 할 일 (여기서 멈춤)
| 순서 | 할 일 | 비고 |
|---|---|---|
| U1 | Firebase 콘솔 → Authentication → 로그인 방법에서 **Google**과 **익명** 사용 설정 확인 | 요금제는 Spark 그대로 두면 된다 |
| U2 | Firestore Database가 만들어져 있는지 확인 | 위치는 아무 곳이어도 된다 |
| U3 | **규칙 게시**: Firestore Database → 규칙 탭에 `firestore.rules` 전체를 붙여 넣고 **게시** | 예전 초안 규칙이 남아 있으면 활동 만들기가 permission-denied로 막힌다. 명령으로 하려면 U4 후 `firebase deploy --only firestore:rules` |
| U4 | (선택) `npm install -g firebase-tools` → `firebase login` → 프로젝트 폴더에서 `firebase deploy --only firestore:rules,hosting` | 콘솔에 붙여 넣기만 해도 게임은 Live Server로 돌릴 수 있다 |
| U5 | 수업 중 Firestore 콘솔 → 사용량 탭에서 쓰기·읽기 횟수 확인 | 한도를 넘기면 그날은 요청이 거부된다. 넘길 것 같으면 알려 주면 진행 상황 쓰기 간격을 늘린다 |
| U6 | 오류가 나면 화면의 빨간 글(괄호 안 코드)을 알려 주기 | permission-denied면 규칙이 최신인지 먼저 확인 |

- 되돌리기: 규칙은 콘솔 규칙 탭의 이전 버전 기록에서 되돌린다

## 3. 배포 후 검증 절차
준비: VS Code Live Server로 `teacher.html`과 `index.html`을 연다.
- **교사 A**: 일반 창에서 Google 계정 A로 로그인
- **교사 B**: 시크릿 창 또는 다른 브라우저에서 Google 계정 B로 로그인
- **학생**: 또 다른 창(시크릿 창 등)에서 학생 S1, S2

콘솔 시험 문장은 그 창의 개발자 도구(F12) → Console에 붙여 넣는다. 결과로 `'permission-denied'`가 나와야 '막힘'이다.
```js
// 공통 준비 (teacher.html 또는 index.html 창에서 먼저 한 번)
const s = await import('./js/firebase/sdk.js'); const { db, auth } = await import('./js/firebase/app.js');
const tryIt = (p) => p.then(() => '성공함(막혀야 하면 문제!)', (e) => e.code);
```

### V1. 활동 시작부터 결과 저장까지 (Cloud Functions 없이)
1. 교사 A: 학급 만들기 → 문제은행 '기본 문제 불러오기' → 활동 만들기(문제 3개, 5분) → 활동 줄 → 시작 → 상태 '진행 중', 남은 시간 감소 (Firestore 규칙이 활동 문서의 status·startAt·endAt 변경을 허용해야 한다)
2. 학생 S1: index.html → 시작 → 참여 코드·닉네임 → 월드맵 → 던전 → 입장 퀴즈 3문제 (활동 문서·answerKey 읽기)
3. 깃발까지 가서 '결과를 저장했어요' → Firestore `classes/{학급}/results/{S1uid_…}` 문서 1개 (coinsEarned = quizCorrect × 10)
4. 교사 A: 종료 → 학생 화면 '선생님이 활동을 끝냈어요'
5. 같은 결과를 다시 저장할 수 없는지: S1 콘솔 `await tryIt(s.setDoc(s.doc(db,'classes','학급ID','results','그문서ID'), { studentUid: auth.currentUser.uid }))` → `'permission-denied'`
- 기대: 모두 동작. 실패하면 학생·교사 화면의 빨간 안내 글(괄호 안 코드)을 기록

### V2. 공유 문제은행 교사 A/B 권한 분리
1. 교사 A: 공유 문제은행 → 공유 이름 '과학 선생님' 저장 → 문제은행에서 직접 만든 문제 하나 '공유'
2. 교사 B: 공유 문제은행에 그 문제가 보이고 출처 '과학 선생님', 줄에 '공유 취소'가 **없다**
3. 교사 B 콘솔 (공유 문서 id는 Firestore 콘솔 sharedQuestions에서 복사):
```js
const id = '공유문서ID';
await tryIt(s.updateDoc(s.doc(db, 'sharedQuestions', id), { question: 'B가 고침' }));   // 'permission-denied'
await tryIt(s.setDoc(s.doc(s.collection(db, 'sharedQuestions')), { subject: '과학', difficulty: '하', learningConcept: 'x', question: 'q', choices: ['a','b','c','d'], answer: 0, ownerUid: 'A의uid', authorName: '사칭' }));  // 'permission-denied' (남의 uid로 올리기)
```

### V3. 가져온 뒤 원본과 복사본의 독립성
1. 교사 B: 그 문제 '미리보기'(보기·정답 확인) → '가져오기' → 줄이 '가져옴'
2. 교사 B 문제은행: 출처 '공유: 과학 선생님'으로 생김 → '수정'으로 문제 글을 바꿔 저장
3. Firestore 콘솔: `sharedQuestions/{id}`의 question은 그대로, `teachers/{B uid}/questions/{새 id}`만 바뀜 (origin.sharedId = 원본 id)
4. 교사 A가 내 문제를 고치고 '공유 갱신' → 공유 문서만 바뀌고 교사 B의 복사본은 그대로
5. 교사 B: 활동 만들기 문제 고르기 표에 가져온 문제가 보인다

### V4. 소유자가 아닌 교사의 삭제 차단
1. 교사 B 콘솔: `await tryIt(s.deleteDoc(s.doc(db, 'sharedQuestions', id)))` → `'permission-denied'`
2. 교사 A: 공유 문제은행 → 공유 취소 → 공유 문서가 사라지고 교사 B의 복사본은 남는다

### V5. 학생 계정의 공유 문제은행 접근 차단
학생 S1 창(index.html, 참여한 뒤) 콘솔:
```js
await tryIt(s.getDoc(s.doc(db, 'sharedQuestions', id)));                       // 'permission-denied'
await tryIt(s.setDoc(s.doc(s.collection(db, 'sharedQuestions')), { question: 'x' }));  // 'permission-denied'
// 함께 확인하면 좋은 학생 권한 (6-10·10-3). 학급 밖·남의 데이터는 막힌다
await tryIt(s.getDoc(s.doc(db, 'classes', '다른학급ID', 'activities', '활동ID', 'answerKey', 'main')));  // 'permission-denied' (내 학급의 정답표는 읽힌다 — 기기 채점, 알려진 한계)
await tryIt(s.setDoc(s.doc(db, 'classes', '학급ID', 'results', 'fake'), { studentUid: auth.currentUser.uid }));  // 'permission-denied' (형식이 안 맞는 결과)
```

### V6. 공유 문서에 이메일·실명 미저장
1. Firestore 콘솔 → sharedQuestions/{id}: 필드가 subject·difficulty·learningConcept·question·choices·answer·ownerUid·authorName·sharedAt·updatedAt뿐, authorName은 공유 이름이고 Google 이름·이메일이 없다
2. 교사 A 공유 문제은행: 공유 이름에 `a@b.com` → 빨간 안내, 저장 안 됨
3. 교사 A 콘솔 (규칙이 막는지):
```js
await tryIt(s.setDoc(s.doc(s.collection(db, 'sharedQuestions')), { subject: '과학', difficulty: '하', learningConcept: 'x', question: 'q', choices: ['a','b','c','d'], answer: 0, ownerUid: auth.currentUser.uid, authorName: 'a@b.com' }));  // 'permission-denied'
await tryIt(s.setDoc(s.doc(s.collection(db, 'sharedQuestions')), { subject: '과학', difficulty: '하', learningConcept: 'x', question: 'q', choices: ['a','b','c','d'], answer: 0, ownerUid: auth.currentUser.uid, authorName: '이름', email: 'a@b.com' }));  // 'permission-denied'
```

### V7. 실제 학생 응답 기반 맞춤 피드백·복습 문제 추천
1. 교사 A: 같은 학습 개념 문제가 2개 이상 있는 활동을 만들어 시작 (기본 문제는 개념이 모두 달라서 같은 개념 문제를 직접 1~2개 더 만든다)
2. 학생 S1: 던전에 두 번 들어가 입장 퀴즈 6문제 이상 풀기. 한 개념은 일부러 3번 이상 틀리기
3. 교사 A: 학급 → 결과 탭 → S1 줄 → 자세한 기록
   - 맞춤 피드백의 정답률·'몇 번 중 몇 번'이 판별 기록·Firestore results answers를 직접 센 값과 같다
   - 그 개념이 '취약 개념'으로 나오고, 추천 문제가 같은 과목·개념의 내 문제은행 문제다 (틀린 문제가 먼저)
   - '추천 문제로 활동 만들기' → 그 문제가 골라진 활동 만들기 양식
4. 두 번째 활동에서도 3문제 이상 풀면 '활동별 변화' 줄이 나온다

### V8. 응답 데이터가 부족할 때 '데이터 부족'
1. 학생 S2: 입장 퀴즈 3문제만 풀고 교사가 활동을 종료 (실패로 저장됨)
2. 교사 A 결과 탭: S2 줄 정답률·학습 수준 '데이터 부족', 자세한 기록 피드백 '데이터가 부족해요', 추천 없음
3. 학급 전체 푼 문제가 10개 미만인 학급에서는 '다음 수업 보충 학습 요약'이 '데이터가 부족해요'
4. 3번 미만 푼 문제·개념의 정답률 칸이 '데이터 부족 (n번)'

## 4. 검증 결과 기록
- 배포 상태(2026-11-11): 규칙이 게시됐는지 **확인 전**. 사용자가 올린 규칙은 예전 초안(answerKey 항목 없음)이었다 → 위 U3 필요
- '자동 시험'은 가짜 Firebase(메모리 저장소 + 실제 화면 코드) 위의 시험, '규칙 에뮬레이터'는 실제 규칙 엔진을 로컬에서 돌린 시험이다. 둘 다 실제 Firebase 확인은 아니다

| 항목 | 자동 시험 (코드 수준) | 규칙 에뮬레이터 | 실제 Firebase 확인 | 날짜·메모 |
|---|---|---|---|---|
| V1 활동 시작~결과 저장 | 통과 (game.e2e 52, 노드 28) | 통과 (시작·종료 시각 규칙, 결과 한 번만·값 검사) | [ ] 확인 전 | |
| V2 교사 A/B 권한 분리 | 화면 흐름 통과 | 통과 | [ ] 확인 전 | |
| V3 원본·복사본 독립 | 통과 (teacher-full.e2e) | 통과 | [ ] 확인 전 | |
| V4 비소유자 삭제 차단 | 화면에 버튼 없음만 확인 | 통과 | [ ] 확인 전 | |
| V5 학생 공유 문제은행 차단 | - | 통과 | [ ] 확인 전 | |
| V6 이메일·실명 미저장 | 통과 | 통과 | [ ] 확인 전 | |
| V7 실제 응답 기반 피드백·추천 | 통과 | - | [ ] 확인 전 | |
| V8 데이터 부족 표시 | 통과 | - | [ ] 확인 전 | |
