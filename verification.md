# 실제 Firebase 배포·검증 기록

가짜 Firebase 시험(자동)과 실제 Firebase 확인을 구분해 적는다. **실제 Firebase에서 직접 확인한 항목만 '실제 확인'에 체크한다.**
- 프로젝트: `gbl-dungeondash` (.firebaserc, js/firebase/config.js)
- 서버 함수 지역: `asia-northeast3` (functions/index.js `REGION` = js/firebase/app.js `FUNCTIONS_REGION`, 두 값이 다르면 호출이 실패한다)

## 1. 배포 전 점검 (2026-11-11, 코드 수준에서 확인함)
| 항목 | 상태 |
|---|---|
| .firebaserc 기본 프로젝트 = config.js projectId | 같음 (gbl-dungeondash) |
| 함수 지역: 서버·앱 두 곳 | 같음 (asia-northeast3). Firestore 위치와 달라도 동작은 한다 (같으면 더 빠름) |
| 실행 환경 | firebase.json `nodejs22`, package.json engines node 22 |
| 패키지 | firebase-functions 6.6.0, firebase-admin 13.10.0 (functions/node_modules 설치됨) |
| 환경 변수·비밀 값 | 쓰지 않음 (process.env·defineSecret 없음). 관리자 SDK는 배포 환경의 기본 권한으로 동작 |
| 함수 목록 | index.js를 불러오면 6개: startActivity, endActivity, startRun, issueQuestion, submitAnswer, finishRun |
| 배포에서 빼는 파일 | functions/test, node_modules (firebase.json ignore) |
| 보안 규칙 | 눈으로 점검함: 문법·권한 흐름 이상 없음. **규칙 컴파일·실행 시험은 하지 못함** (Firebase CLI·Java 없음) — 배포할 때 CLI가 컴파일 오류를 알려 준다 |
| 복합 색인 | 필요 없음 (쿼리는 같음(==) 조건만 씀) |
| 자동 시험 | functions 노드 시험 36개 통과 (이 점검 때 다시 실행) |

## 2. 사용자가 직접 할 일 (여기서 멈춤)
| 순서 | 할 일 | 비고 |
|---|---|---|
| U1 | Firebase 콘솔 → 요금제 **Blaze**로 변경, 결제 계정 연결 | 결제 설정 — 직접 |
| U2 | Google Cloud 콘솔 → 결제 → **예산 알림** (예: 월 5,000원) | 알림만 오고 사용을 멈추지 않는다 |
| U3 | Firestore Database → 데이터베이스 **위치** 확인 | asia-northeast3이 아니어도 그대로 배포해도 된다. 바꾸고 싶으면 알려 주면 두 곳을 함께 고친다 |
| U4 | `npm install -g firebase-tools` → `firebase login` | 이 컴퓨터에는 아직 CLI가 없다 |
| U5 | 프로젝트 폴더에서 `firebase projects:list` | gbl-dungeondash가 보이면 권한 확인됨 |
| U6 | `cd functions` → `npm install` → `npm test` → `cd ..` | 시험 36개 통과 확인 |
| U7 | **`firebase deploy --only firestore:rules,functions`** | 실제 배포 (규칙은 바로 적용된다). 첫 배포 때 API 사용 설정·이미지 정리 정책을 물으면 기본값(예)으로 |
| U8 | 오류가 나면 출력 전체를 알려 주기 | 규칙 컴파일 오류, 권한 오류(IAM), 결제 미설정 등 |

- 규칙만 먼저 시험하고 싶으면 `firebase deploy --only firestore:rules` (함수 없이도 공유 문제은행 권한 V2~V6은 확인할 수 있다. 활동 시작·퀴즈는 함수가 있어야 한다)
- 되돌리기: 함수 삭제 `firebase functions:delete 함수이름 --region asia-northeast3`, 규칙은 콘솔 규칙 탭의 이전 버전 기록에서 되돌린다

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

### V1. Cloud Functions 6개 등록·실행
1. Firebase 콘솔 → Functions: startActivity·endActivity·startRun·issueQuestion·submitAnswer·finishRun 6개, 지역 asia-northeast3
2. 교사 A: 학급 만들기 → 문제은행 '기본 문제 불러오기' → 활동 만들기(문제 3개, 5분) → 활동 줄 → 시작 → 상태 '진행 중', 남은 시간 감소 (startActivity)
3. 학생 S1: index.html → 시작 → 참여 코드·닉네임 → 월드맵 → 던전 → 입장 퀴즈 3문제 (startRun·issueQuestion·submitAnswer)
4. 깃발까지 가서 '결과를 저장했어요' (finishRun) → Firestore `classes/{학급}/results/{runId}` 문서 1개
5. 교사 A: 종료 → 학생 화면 '선생님이 활동을 끝냈어요' (endActivity)
6. 콘솔 → Functions → 로그에 오류가 없는지
- 기대: 모두 동작. 실패하면 학생·교사 화면의 빨간 안내 글(괄호 안 코드)과 Functions 로그를 기록

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
// 함께 확인하면 좋은 학생 권한 (6-10·10-3)
await tryIt(s.getDoc(s.doc(db, 'classes', '학급ID', 'activities', '활동ID', 'answerKey', 'main')));  // 'permission-denied'
await tryIt(s.setDoc(s.doc(db, 'classes', '학급ID', 'results', 'fake'), { studentUid: auth.currentUser.uid }));  // 'permission-denied'
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
1. 학생 S2: 입장 퀴즈 3문제만 풀고 끝내기 (또는 다른 창에서 새로 시작해 중도 종료)
2. 교사 A 결과 탭: S2 줄 정답률·학습 수준 '데이터 부족', 자세한 기록 피드백 '데이터가 부족해요', 추천 없음
3. 학급 전체 푼 문제가 10개 미만인 학급에서는 '다음 수업 보충 학습 요약'이 '데이터가 부족해요'
4. 3번 미만 푼 문제·개념의 정답률 칸이 '데이터 부족 (n번)'

## 4. 검증 결과 기록
'자동 시험'은 가짜 Firebase(실제 서버 코드 + 메모리 저장소) 위의 시험이다. 실제 Firebase 권한 규칙은 거치지 않는다.

| 항목 | 자동 시험 (코드 수준) | 실제 Firebase 확인 | 날짜·메모 |
|---|---|---|---|
| V1 함수 6개 등록·실행 | 통과 (노드 25개, 브라우저 흐름) | [ ] 확인 전 | |
| V2 교사 A/B 권한 분리 | 화면 흐름 통과. 규칙 거부는 시험 못 함 | [ ] 확인 전 | |
| V3 원본·복사본 독립 | 통과 (teacher-full.e2e) | [ ] 확인 전 | |
| V4 비소유자 삭제 차단 | 화면에 버튼 없음만 확인. 규칙 거부는 시험 못 함 | [ ] 확인 전 | |
| V5 학생 공유 문제은행 차단 | 시험 못 함 (규칙 전용) | [ ] 확인 전 | |
| V6 이메일·실명 미저장 | 공유 문서 필드·이메일 공유 이름 거부 통과. 규칙 거부는 시험 못 함 | [ ] 확인 전 | |
| V7 실제 응답 기반 피드백·추천 | 통과 (노드 계산 시험, 브라우저 흐름) | [ ] 확인 전 | |
| V8 데이터 부족 표시 | 통과 (노드·브라우저) | [ ] 확인 전 | |
