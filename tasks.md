# 작업 목록

spec.md의 필수 기능을 만드는 순서다. 위에서부터 하나씩 진행한다.
- 한 줄 = 한 번 구현 → 확인 → 커밋하는 단위다. '확인'이 되면 체크한다
- [미정] 줄은 사용자가 정해야 하는 결정이다. 그 결정이 필요한 작업은 정해진 뒤에 한다
- Firebase가 필요한 작업은 2-5(설정값)가 끝나야 실제로 확인할 수 있다
- 각 작업은 Live Server 확인 → 개별 커밋. (구 x-y)는 단계를 다시 배치하기 전 번호다
- 최종 검증 기준: 10-8 실제 수업 흐름(교사 1명 + 학생 여러 명)

## 끝난 작업
- [x] 9주차 프로토타입: 시작 → 월드맵 → 퀴즈 → 던전 → 결과 → 월드맵, 던전 2개, 전체 시간 임시 300초
- [x] 0. 문서 정비: spec.md·design.md 개정, tasks.md 작성
- [x] 1. 제목 변경: 탭 제목·시작 화면 '던전 대시 / DUNGEON DASH'

## 2. Firebase 기반
- [x] 2-1 SDK·설정값 자리·초기화 (js/firebase/sdk.js·config.js·app.js) — 확인: 설정값이 없으면 교사 화면에 안내가 뜬다
- [x] 2-2 교사 Google 로그인·로그아웃 화면 (teacher.html, js/teacher/auth.js·main.js, css/teacher.css)
- [x] 2-3 학생 익명 로그인 함수 (js/firebase/student.js)
- [x] 2-4 firestore.rules 초안 + 점검 (joinCodes ownerUid, 학생 문서 필드 제한)
- [x] 2-5 Firebase 프로젝트 만들기(gbl-dungeondash), 웹 앱 설정값을 js/firebase/config.js에 넣기 — 확인: 실제 값으로 초기화 성공, 로그인 없이 읽기는 규칙이 막음
- [x] 2-6 콘솔 설정: Google·익명 로그인 켜기, 승인된 도메인에 127.0.0.1 추가, Firestore 만들기
- [x] 2-7 firestore.rules를 콘솔에 게시 — 확인: 규칙 게시 성공
- [x] 2-7a app.js에서 app·auth·db export, 초기화 한 번 — 확인: 시험 설정값으로 초기화 오류 없음, 다시 불러와도 앱 1개
- [x] 2-8 교사 로그인 확인 — 확인: Google 로그인 후 이름이 보이고 teachers/{uid} 문서가 생긴다
- [x] 2-9 교사 로그아웃 확인 — 확인: 로그아웃을 누르면 로그인 화면으로 돌아가고, 새로고침해도 로그인 화면이다

## 3. 교사 플랫폼 뼈대와 학급
진행 순서: 3-3 → 3-4 → 3-5 → 3-1 → 3-6 → 3-7 → 3-8
- 공통 UI(표·양식·알림·확인 상자)는 따로 만들지 않고, 각 화면을 만들 때 design.md '교사 플랫폼 UI 규칙'대로 그 화면에 필요한 만큼 만든다 (기존 3-2 작업은 없앰)
- 확인은 모두 VS Code Live Server로 teacher.html(127.0.0.1)을 열고 Google 로그인한 상태에서 한다
- 회귀 시험(2026-11-11): 실제 teacher.html + main.js를 가짜 Firebase에 붙여 3-4·3-5·3-1·3-6·3-7 흐름(빈 목록, 만들기, 메뉴, 상세·탭, 이름 바꾸기) 자동 시험 통과 — 완료 체크는 사용자 Live Server 확인 뒤

- [x] 3-3 참여 코드 규칙 결정
  - 숫자 6자리 (예: 482913), 무작위 생성
  - 지금 쓰이는 참여 코드(joinCodes에 있는 코드)와 겹치지 않게 한다
  - 다른 교사의 학급에 함부로 접근하지 못하도록 기존 Firestore 보안 규칙을 그대로 유지한다
  - [x] 지워진 학급의 코드 재사용: 학급 삭제를 지원하지 않으므로 해당 없음 (결정(2026-11-11))

- [x] 3-4 학급 만들기와 참여 코드 발급
  - 로그인 후 화면에 '학급 만들기' 버튼(주 버튼)과 학급 이름 입력창
  - 숫자 6자리 코드를 무작위로 만들고, 학급 문서(classes)와 코드 문서(joinCodes)를 한 번에(batch) 저장
  - 코드가 이미 있으면(규칙이 막음) 새 코드로 다시 시도
  - 구현됨 (js/teacher/classes.js, teacher.html, js/teacher/main.js, css/teacher.css, js/firebase/sdk.js) — 가짜 Firestore로 코드 형식·필드·중복 재시도 시험 통과, Live Server에서 저장 완료 안내·6자리 코드 표시 확인(사용자)
  - 확인 (Live Server)
    - 학급 이름을 넣고 '학급 만들기' → '저장했어요'(금색)와 발급된 6자리 숫자 코드가 화면에 보인다
    - Firestore 콘솔: classes/{id}에 ownerUid(내 uid)·name·joinCode·createdAt, joinCodes/{코드}에 classId·ownerUid가 생긴다
    - 학급 이름을 비우고 누르면 입력창이 빨간 테두리 + 빨간 안내, 문서는 생기지 않는다
    - 학급을 두 개 만들면 서로 다른 코드가 나온다
    - 브라우저 개발자 도구 콘솔에 빨간 오류가 없다

- [ ] 3-5 내가 만든 학급 목록
  - 학급 표(이름·참여 코드·학생 수), 빈 목록 안내, 불러오는 중 표시
  - 확인 (Live Server)
    - 학급이 없으면 '아직 학급이 없어요' 안내가 보인다
    - 3-4에서 만든 학급이 표에 보이고, 새로 만들면 새로고침 없이 바로 줄이 생긴다
    - 새로고침해도 목록이 그대로 보인다
    - 다른 Google 계정으로 로그인하면 내 학급이 보이지 않는다
    - 개발자 도구 콘솔에 빨간 오류(권한 오류 포함)가 없다
  - 구현됨 (js/teacher/classList.js, classes.js, main.js, teacher.html, css/teacher.css, js/firebase/sdk.js) — 가짜 Firestore·가짜 DOM 시험 통과, Live Server 확인 전

- [ ] 3-1 메뉴와 화면 전환
  - 정보 표시줄에 메뉴 '학급 · 문제은행', 한 번에 한 화면만 보이기 (문제은행 화면은 4단계 전까지 빈 화면)
  - 확인 (Live Server)
    - 로그인 전에는 메뉴가 보이지 않는다
    - 로그인하면 학급 화면이 먼저 보이고 '학급' 메뉴에 흰색 밑줄
    - '문제은행'을 누르면 화면과 밑줄이 바뀌고, '학급'을 누르면 학급 목록으로 돌아온다
    - 개발자 도구 콘솔에 빨간 오류가 없다
  - 구현됨 (js/teacher/nav.js, main.js, teacher.html, css/teacher.css) — 가짜 DOM 시험 통과, Live Server 확인 전

- [ ] 3-6 학급 상세 화면
  - 목록에서 학급을 고르면 상세 화면: 학급 이름, 참여 코드(큰 숫자), 탭 '학생 · 활동 · 결과'(내용은 각 단계에서 채움), 목록으로 돌아가기
  - 확인 (Live Server)
    - 학급 목록의 줄을 누르면 그 학급의 이름과 참여 코드가 보이는 상세 화면이 열린다
    - 탭을 누르면 탭 밑줄이 바뀐다
    - 돌아가기(보조 버튼)나 '학급' 메뉴를 누르면 목록으로 돌아온다
    - 다른 학급을 고르면 그 학급의 정보로 바뀐다
    - 개발자 도구 콘솔에 빨간 오류가 없다
  - 구현됨 (js/teacher/classDetail.js, nav.js, classList.js, main.js, teacher.html, css/teacher.css) — 가짜 DOM 시험 통과, Live Server 확인 전

- [ ] 3-7 학급 이름 수정
  - 확인 (Live Server, teacher.html): 학급 상세에서 이름을 바꿔 저장하면 상세·목록에 바로 반영된다 / 빈 이름은 빨간 안내만 / Firestore에서 name만 바뀌고 ownerUid·joinCode는 그대로 / 새로고침해도 바뀐 이름이 유지된다 / 콘솔 빨간 오류 없음
  - 구현됨 (js/teacher/classDetail.js, classes.js, teacher.html, css/teacher.css, js/firebase/sdk.js) — 가짜 Firestore·가짜 DOM 시험 통과, Live Server 확인 전. 교사 화면 단계 안내 문구를 현재 순서(4·5·6·8단계)로 고침
- [x] 3-8 학급 삭제: 지원하지 않는다 (학생 결과 손실 방지) (결정(2026-11-11))
  - 보류: 지금은 학급 삭제를 지원하지 않는 방향으로 두고 다음 단계로 넘어간다. → 2026-11-11 지원하지 않기로 결정

## 4. 문제은행 (구 5단계)
- 확인은 teacher.html → '문제은행' 메뉴에서 한다

- 과목 13개, 난이도 기준, 학습 개념 관리, 검색·거르기, 저장 검사는 spec.md '문제은행 규칙'을 따른다
- [x] 4-1 난이도: 하·중·상 3단계와 구분 기준 (spec.md) (구 5-1)
- [x] 4-2 학습 개념: 과목별 선택 목록(내 문제은행에서 모음) + 새 개념 직접 입력, 필수, 띄어쓰기·대소문자 중복 방지 (spec.md) (구 5-1a)
  - 기존 12문제의 난이도·학습 개념은 기능 시험용 값이다. 실제 수업의 분류는 교사가 문제를 등록할 때 정한다
- [x] 4-3 questions.json에 id(d01~d12)·difficulty·learningConcept 추가 (구 5-2)
  - 확인: index.html에서 지금처럼 입장 퀴즈가 나오고 끝까지 플레이된다 / 콘솔 빨간 오류 없음
  - 구현됨 (questions.json) — 12문제 모두 id·하중상·학습 개념 형식 검사 통과, 헤드리스 브라우저에서 시작 화면까지 오류 없이 열림. 끝까지 플레이 Live Server 확인(사용자)
- [x] 4-4 문제 표: 과목·난이도·학습 개념·문제·정답, 실시간, 빈 목록 안내 (구 5-3)
  - 확인: 문제가 없으면 빈 목록 안내 / Firestore 콘솔에서 teachers/{내 uid}/questions에 문서를 하나 넣으면 새로고침 없이 표에 보인다 / 다른 교사 계정에서는 보이지 않는다
  - 구현됨 (js/teacher/questionBank.js·bankView.js, main.js, teacher.html, css/teacher.css, js/firebase/sdk.js) — 가짜 저장소로 실제 화면 모듈을 헤드리스 브라우저에서 시험 통과, Live Server 확인(사용자)
- [x] 4-5 문제 추가 양식 (구 5-4)
  - 확인: 과목·난이도·학습 개념·문제·보기 4개·정답을 넣고 저장하면 표에 생긴다 / Firestore 문서 필드가 spec.md와 같다(source 'teacher', updatedAt) / 빈 칸·정답 미선택은 빨간 안내만, 문서 안 생김 / 보기끼리 글이 같아도 저장된다
  - 확인(학습 개념): 과목을 고르면 그 과목에서 쓴 개념만 목록에 나온다 / '새 개념 입력'으로 넣은 개념이 다음 문제부터 목록에 보인다 / '일차 방정식'처럼 띄어쓰기만 다르게 넣으면 이미 있는 '일차방정식'으로 저장되고 안내가 뜬다
  - 구현됨 (js/teacher/bankForm.js·bankRules.js) — 저장 검사·개념 합치기·보기 중복 허용 시험 통과, Live Server 확인(사용자)
- [x] 4-6 문제 수정 (구 5-5)
  - 확인: 표에서 수정을 누르면 양식에 기존 값이 채워진다 / 저장하면 표와 Firestore에 반영되고 updatedAt이 바뀐다 / 취소하면 그대로
  - 구현됨 (bankForm.js·questionBank.js) — 값 채우기·저장·source 유지 시험 통과, Live Server 확인(사용자)
- [x] 4-7 문제 삭제, 확인 상자 (구 5-6)
  - 확인: 삭제 → 확인 상자 / 취소하면 남고, 삭제하면 표와 Firestore에서 사라진다
  - 구현됨 (js/teacher/confirmDialog.js·bankView.js) — 취소·삭제 시험 통과, Live Server 확인(사용자)
- [x] 4-8 과목·난이도·학습 개념으로 걸러 보기, 문제 내용 검색창 (구 5-7)
  - 확인: 조건을 고르면 맞는 문제만 보이고, 조건을 풀면 전체가 보인다 / 검색창에 글자를 넣으면 문제 글에 그 글자가 있는 문제만 보인다 / 거르기와 검색이 함께 적용된다 / 맞는 문제가 없으면 빈 목록 안내
  - 구현됨 (bankRules.js·bankView.js) — 거르기 3종·검색·함께 적용·빈 결과 안내 시험 통과, Live Server 확인(사용자)
- [x] 4-9 기본 문제 불러오기: questions.json → 문제은행 (source 'default', 학습 개념 포함) (구 5-8)
  - 확인: 누르면 12문제가 생긴다 / 두 번 눌러도 12문제만 있다 / 교사가 만든 문제는 그대로 남는다
  - 구현됨 (js/teacher/questionBank.js·bankView.js·main.js, teacher.html, css/teacher.css) — 실제 questionBank.js를 가짜 Firestore에 붙여 시험 통과(12개 저장·필드 확인, 두 번째는 0개, 고친 기본 문제 유지, 지운 것만 복구, 직접 만든 문제 영향 없음), Live Server 확인(사용자)

## 5. 수업 활동 관리 (구 6단계 교사 쪽)
- 확인은 teacher.html → 학급 상세 → '활동' 탭에서 한다

- [x] 5-0 채점 방식: Cloud Functions·Blaze 요금제 없이 Spark 무료 요금제만 쓴다 → 학생 기기 채점 + Firestore 규칙 검사 (사용자 결정(2026-11-11), 서버 채점에서 변경) (구 6-0)
  - [x] 변경 내용: spec.md '정답 노출과 보안 한계', 데이터 구조(runs·attempts 삭제, answerKey 학생 읽기, results 학생 본인 생성), 권한 표. functions/ 폴더 삭제, 시험 전용 tests/ 폴더만 npm 사용
- [x] 5-1 동시 활동 수: 학급당 진행 중 활동 1개. 진행 중인 활동이 있으면 다른 활동 시작 불가 (구 6-6)
  - [x] 대기 활동은 여러 개 미리 만들 수 있고 '시작'만 막는다
  - [x] 중도 종료: 결과를 cleared / failed / abandoned로 나누고 문제 풀이 기록을 남긴다
- [x] 5-2 활동 만들기: 제목·전체 시간, 문제 고르기 표(과목·난이도·학습 개념 거르기, 여러 과목 혼합 가능) → 활동 문서(문제 복사, 학습 개념 유지, 정답 제외) + 정답표(answerKey/main) 한 번에 저장 (구 6-1)
  - 확인: 저장하면 Firestore activities 문서의 questions에 learningConcept는 있고 answer는 없다 / answerKey/main에 문제별 정답이 있다 / status 'waiting' / 빈 제목·시간 없음·문제 0개는 빨간 안내
  - 구현됨 — js/teacher/activityTab.js·activities.js·activityRules.js, teacher.html, css/teacher.css — 전체 시간은 분으로 입력. 가짜 Firestore로 실제 화면 모듈 시험 통과(teacher.e2e), Live Server 확인 전
- [x] 5-3 firestore.rules: answerKey는 소유 교사만, 활동은 대기 상태로만 만들기 + 시작·종료는 허용된 변경만(교사), answerKey는 소유 교사 쓰기·같은 학급 학생 읽기, results는 학생 본인 번호로 한 번만(형식·코인 범위 검사), learners는 본인만 → 게시 (구 6-1a)
  - 확인: 게시 후 5-2 활동 만들기가 그대로 된다 (학생 쪽 거부 확인은 6-10)
  - 구현됨 — firestore.rules, firebase.json — 규칙 에뮬레이터 시험 11묶음 통과(2026-11-11, 재작성). 게시는 사용자(콘솔 규칙 탭에 붙여 넣고 '게시', 또는 firebase deploy --only firestore:rules) — 예전 초안 규칙이 올라가 있으면 활동 만들기가 permission-denied로 막힌다
- [ ] 5-4 활동 탭: 활동 표(제목·문제 수·전체 시간·상태), 실시간 (구 6-2)
  - 확인: 만든 활동이 '대기'(흰색)로 바로 보인다 / 다른 학급 상세에는 보이지 않는다
  - 구현됨 — activityTab.js — 시험 통과(teacher.e2e), Live Server 확인 전
- [ ] 5-5 진행 중 화면 뼈대: 참여 코드·남은 시간(큰 숫자), 시작 버튼 (구 6-3)
  - 확인: 활동 줄을 누르면 열린다 / 주 버튼은 '시작' 하나
  - 구현됨 — js/teacher/activityView.js, nav.js, classDetail.js — 순위 표 자리는 8-3에서 채움. 시험 통과(teacher.e2e), Live Server 확인 전
- [x] 5-6 활동 시작: status 'running', startAt(Firestore 서버 시각)·endAt = startAt + 전체 시간 (구 6-4)
  - 확인: 시작 → 남은 시간이 1초씩 줄고 상태가 '진행 중'(금색) / Firestore에 startAt·endAt / 새로고침해도 남은 시간이 이어진다
  - 확인(진행 중 1개): 진행 중인 활동이 있으면 다른 활동의 시작을 누를 때 빨간 안내가 뜨고 시작되지 않는다 / 대기 활동은 그동안에도 만들 수 있다
  - 구현됨 — js/teacher/activities.js startActivity(진행 중 확인 후 ① status·startAt(서버 시각) ② endAt, 규칙이 두 쓰기를 검사), activityView.js — 시험 통과(teacher-full·game.e2e, 규칙 에뮬레이터), 규칙 게시·Live Server 확인 전
- [ ] 5-7 활동 종료: status 'ended' (구 6-5)
  - 확인: 종료 → 상태 '종료'(흰색 40%) / 종료 버튼은 확인 상자를 거친다 / 그 뒤 다른 활동을 시작할 수 있다
  - 구현됨 — activities.js endActivity(status 'ended'), 학생 기기가 끝난 판을 failed로 저장, confirmDialog.js — 시험 통과, 규칙 게시·Live Server 확인 전
  - [x] 시간이 다 되면: 교사 화면·학생 게임 모두 끝난 활동으로 보고, status는 다음 활동을 시작할 때 교사 화면이 'ended'로 바꾼다 (결정(2026-11-11))
    - 지금 기본값: 종료 시각이 지나면 교사 화면·학생 게임 모두 끝난 활동으로 본다 (따로 정하면 바꾼다)
- [x] 5-8 Firebase 설정 (사용자): Spark 무료 요금제 그대로 (업그레이드 없음), Firebase 콘솔에서 Authentication(Google·익명)·Firestore 사용 설정 확인. 규칙 게시용 Firebase CLI 설치·로그인(또는 콘솔에 붙여 넣기)
  - 확인: 콘솔 Authentication 로그인 방법에 Google·익명이 켜져 있다 / Firestore가 만들어져 있다
- [ ] 5-9 기기 채점 규칙과 시험: js/grading.js·js/runLog.js(순수 함수), 노드 시험 28개(tests/test, npm test) + 규칙 에뮬레이터 11묶음(npm run test:rules)
  - 확인: 채점·중복 지급·시간 초과·입장 3문제·회복·코인 검사·같은 문제 다시 받기·결과 한 번만 통과 (2026-11-11 실제 실행함)
- 실제 Firebase 배포·검증 절차와 결과 기록: verification.md (V1~V8). 배포 전 점검은 끝났고(2026-11-11), CLI 로그인·배포 명령은 사용자가 한다
- [x] 5-10 규칙 게시(+ Hosting 배포): firebase deploy --only firestore:rules,hosting 또는 콘솔에 firestore.rules 붙여 넣기 (Cloud Functions 배포는 없다)
  - 확인: 콘솔 Firestore 규칙에 answerKey·results 검사가 보인다 / 5-2 활동 만들기·5-6 시작·7-2·7-4가 실제 Firebase로 된다

## 6. 학생 참여 시스템 (구 4단계 + 6-7·6-9·6-10)
- 확인은 index.html(학생)과 teacher.html(교사)을 함께 연다. 학생 여러 명은 일반 창·시크릿 창·다른 브라우저로 만든다 (익명 사용자가 서로 다름)

- [x] 6-1 닉네임: 1~10자, 겹쳐도 됨 (결정(2026-11-11))
  - 구현됨 — JoinScene.js(10자 안내·입력 제한), firestore.rules(nickname.size() <= 10, 에뮬레이터 시험 통과). 참여 화면 안내는 Live Server 확인 전
  - 지금 기본값: 앞뒤 공백을 지우고 비어 있지만 않으면 받는다. 다시 참여하면 처음 닉네임을 그대로 쓴다
- [ ] 6-2 Phaser 입력창: main.js DOM 설정, ui.js 입력창 함수 (구 4-1)
  - 확인: 입력창에 한글·숫자를 칠 수 있다 / 입력 중 Space·Shift가 게임 조작으로 처리되지 않는다
  - 구현됨 — js/main.js(dom), js/ui.js(createInput) — 시험 통과(game.e2e: 값 입력·검사), 한글 입력은 Live Server 확인 전
- [ ] 6-3 참여 장면(JoinScene): 코드·닉네임 입력창, 입장 버튼 (구 4-3)
  - 확인: 시작 → 참여 화면, design.md 배치대로
  - 구현됨 — js/scenes/JoinScene.js, StartScene.js — 시험 통과(game.e2e), Live Server 확인 전
- [ ] 6-4 참여 처리: 익명 로그인 → 코드 조회 → 학생 문서(이미 있으면 그대로 사용) (구 4-4)
  - 확인: 교사 학급 코드로 들어가면 Firestore에 students/{uid}(nickname·joinCode·joinedAt) / 틀린 코드는 빨간 안내 / 새로고침 후 다시 참여해도 학생 문서는 하나
  - 구현됨 — js/firebase/student.js(joinClass), js/session.js — 시험 통과(game.e2e), Live Server 확인 전
- [x] 6-5 Firebase 없이 단독 플레이: 설정값이 없을 때(개발·시험)만 허용 (결정(2026-11-11)) — questions.json에 정답이 있어 정답 비노출의 예외가 됨 (구 4-5)
  - 지금: 설정값이 없을 때만 예전처럼 questions.json으로 혼자 플레이(js/quiz.js 예비 흐름). 설정값이 있으면 반드시 참여 → 기기 채점
- [ ] 6-6 교사 학급 상세 '학생' 탭: 참여한 학생 실시간 표 (구 4-6)

  - 확인: 학생이 참여하면 교사 화면에 바로 줄이 생기고 학급 목록의 학생 수도 바뀐다
  - 구현됨 — js/teacher/studentsTab.js·classHub.js·classData.js. 학급 목록의 학생 수는 목록을 다시 그릴 때(새로고침·학급 추가) 바뀐다. 시험: teacher-full.e2e(실제 teacher.html + main.js), Live Server 확인 전
- [ ] 6-7 대기 장면(WaitingScene): 활동 상태를 지켜보다 시작 신호를 받으면 월드맵으로 (구 6-7)
  - 확인: 활동이 대기 중이면 대기 화면 / 교사가 시작하면 학생 화면이 몇 초 안에 월드맵으로 / 이미 진행 중일 때 참여하면 바로 월드맵
  - 구현됨 — js/scenes/WaitingScene.js — 시험 통과(game.e2e), Live Server 확인 전
- [ ] 6-8 남은 시간을 활동 endAt(서버 시각) 기준으로 (state.js) (구 6-9)
  - 확인: 교사 진행 중 화면과 학생 화면의 남은 시간이 1초 이내로 같다
  - 구현됨 — js/state.js, js/firebase/clock.js(Firestore 서버 시각으로 기기 시계 차이 맞춤) — 시험 통과(endTime = endAt), 두 기기 비교는 Live Server 확인 전
- [ ] 6-9 활동 종료 신호 → 학생 최종 결과 화면 (구 6-10)
  - 확인: 교사가 종료하면 모든 학생 화면이 최종 결과로 넘어간다 / 시간이 다 돼도 넘어간다
  - 구현됨 — js/session.js(종료 신호), state.js(checkTimeout), ResultScene.js('선생님이 활동을 끝냈어요') — 교사 종료는 시험 통과(game.e2e), 시간 종료는 Live Server 확인 전
- [ ] 6-10 학생 권한 확인
  - 확인: 참여한 학생 창의 개발자 도구에서 answerKey 읽기, 다른 학급 읽기를 시도하면 거부된다
  - 규칙 거부(학급 밖 학생의 활동·정답표·결과 읽기·쓰기, 남의 결과·복습 기록 읽기·쓰기, 활동 고치기)는 Firestore 에뮬레이터 시험 통과(tests/test-rules). 같은 학급 학생은 정답표를 읽을 수 있다(기기 채점, 알려진 한계). 실제 Firebase는 규칙 게시 후 확인
- [ ] 6-11 재접속·중복 실행: 다시 들어오면 처음 닉네임과 깬 던전 수 유지, 같은 학생이 창 두 개로 하면 나중 창만 이어짐
  - 확인: 진행 중에 새로고침 → 참여 → 바로 월드맵, 깬 던전이 열려 있다 / 다른 닉네임을 넣어도 처음 닉네임 / 두 번째 창에서 던전을 시작하면 첫 창 퀴즈에 '다른 창에서 게임을 새로 시작해서 이 판은 끝났어요'
  - 구현됨 — js/progress.js(loadClearedCount), WaitingScene.js, QuizScene.js, firestore.rules(학생이 자기 progress 읽기). 시험: game.e2e, Live Server 확인 전

## 7. 게임 연동 (구 6-8·6-8a, 7단계, 8-1·8-3~8-6)
- 확인은 교사가 활동을 시작한 상태에서 학생 창(index.html)으로 플레이하며 한다

- [ ] 7-1 활동 문제로 출제 (questions.js가 활동 문제를 받음) (구 6-8)
  - 확인: 교사가 고른 문제만 나온다 / 활동 문서(문제 목록)에 정답이 없다 (정답표는 같은 학급 학생만 읽는다 — 알려진 한계)
  - 구현됨 — js/runLog.js(출제), js/quiz.js, QuizScene.js — 시험 통과(runLog 노드 시험, game.e2e), 규칙 게시·Live Server 확인 전
- [ ] 7-2 채점 연결 (5-0에서 정한 방식: 학생 기기 채점) (구 6-8a)
  - 확인: 맞히면 코인 +10과 금색 테두리, 틀리면 빨간 테두리와 정답 보기 / 시간 초과는 오답
  - 확인(연결): 인터넷이 끊긴 채 문제·정답표를 받으면 빨간 안내와 '다시 시도', 다시 연결해 누르면 이어진다 / 같은 문제의 답은 한 번만 채점돼 코인이 한 번만 오른다
  - 구현됨 — js/runLog.js(채점), quiz.js, QuizScene.js — 시험 통과(입장·회복 퀴즈, 중복 제출), 규칙 게시·Live Server 확인 전
- [x] 7-3 능력 종류·가격·대시와의 관계 정하기 (spec.md) (구 7-0)
- [x] 7-4 능력을 산 뒤 재도전: 능력은 산 판에만, 다시 들어가면 새로 산다 (결정(2026-11-11)) (구 7-1)
  - 지금 기본값: 능력은 산 그 판에만. 다시 들어가면 새로 산다 (spec.md)
- [ ] 7-5 config.js에 능력 목록(대시 10/1회, 보호막 15, 이단 점프 20) (구 7-2)
  - 확인: 기존 게임 동작이 그대로다
  - 구현됨 — js/config.js ABILITIES (대시 10·보호막 15·이단 점프 20, 서버 grading.js와 같음)
- [ ] 7-6 능력 구매 장면(ShopScene): 입장 퀴즈 → 능력 구매 → 던전 (구 7-3)
  - 확인: 입장 퀴즈 뒤 능력 구매 화면, 던전 입장 버튼으로 던전 시작 / design.md 배치대로
  - 구현됨 — js/scenes/ShopScene.js. 시험: game.e2e, Live Server 확인 전
- [ ] 7-7 구매 처리: 코인 차감, 부족한 능력 흐리게·안내 (구 7-4)
  - 확인: 30코인으로 보호막+대시 1회 가능, 이단 점프+보호막 불가 / 코인이 HUD에 바로 반영
  - 구현됨 — ShopScene.js(부족하면 빨간 안내, 보호막·이단 점프는 한 번만). 시험: game.e2e, Live Server 확인 전
- [ ] 7-8 대시를 '산 횟수만큼 사용'으로 (구 7-5)
  - 확인: 산 횟수만큼만 대시, 대시할 때 코인은 줄지 않는다 / 안 사면 대시 안 됨 안내
  - 구현됨 — DungeonScene.js tryDash. 안 산 경우 시험 통과, 산 횟수만큼 쓰기는 Live Server 확인 전
- [ ] 7-9 보호막: 충돌 1회 무시 (구 7-6)
  - 확인: 첫 충돌에 코인이 줄지 않고, 두 번째부터 줄어든다 / 다음 던전에는 남지 않는다
  - 구현됨 — DungeonScene.js onHit. 시험: game.e2e, Live Server 확인 전
- [ ] 7-10 이단 점프 (구 7-7)
  - 확인: 산 판에서만 공중에서 Space 한 번 더 / 다음 던전에는 남지 않는다
  - 구현됨 — DungeonScene.js update. 물리 동작이라 Live Server 확인 전 (자동 시험 없음)
- [ ] 7-11 회복 퀴즈는 충돌로 0개가 될 때만 (구 7-8)
  - 확인: 구매로 0개가 되면 퀴즈가 안 뜨고, 충돌로 0개가 되면 뜬다
  - 구현됨 — 퀴즈는 충돌(onHit)에서만 띄움, 보호막이 막은 충돌은 제외. 시험: game.e2e, Live Server 확인 전
- [ ] 7-12 안내 줄에 가진 능력, 시작 화면 설명을 '능력으로' (구 7-9)
  - 확인: 예) Shift 대시(남은 2회) · 보호막
  - 구현됨 — DungeonScene.js guideText, StartScene.js 설명·흐름 한 줄, WorldMap 안내. Live Server 확인 전
- [x] 7-13 별 기준, 획득 내역 항목, 합계 계산, 보상 내용 — 아래 기본값으로 확정 (결정(2026-11-11)) (구 8-1)
  - 지금 기본값: 별(클리어·입장 퀴즈 모두 정답·충돌 0번), 합계 = 얻은 코인, 보상 = 다음 던전 열림 (spec.md)
- [ ] 7-14 한 판 기록 모으기: 문제별 기록(questionId·learningConcept·고른 답·정답 여부·입장/회복), wrongConcepts, 코인, 능력, 대시, 충돌, 추락, 클리어 시간 (구 8-3)
  - 확인: 한 판을 하고 콘솔에 출력한 기록이 실제 플레이와 맞다
  - 구현됨 — 퀴즈 기록·wrongConcepts·코인은 서버(attempts·run)가, 능력·대시·충돌·추락·클리어 시간은 js/quiz.js playStats가 모은다. 시험: game.e2e, Live Server 확인 전
- [ ] 7-15 결과 화면 새 배치: 별·획득 내역·합계·보상 (구 8-4)
  - 확인: design.md 배치대로, 7-13에서 정한 값이 보인다
  - 구현됨 — js/scenes/ResultScene.js. Live Server 확인 전
- [ ] 7-16 결과 저장(results), 실패 시 다시 시도 안내 (구 8-5)
  - 확인: 던전 한 판마다 Firestore results 문서가 하나 생기고 필드가 spec.md와 같다 / 인터넷을 끊고 끝내면 다시 시도 안내, 다시 연결하면 저장
  - 구현됨 — quiz.js saveOutcome·runStore.js saveResult(문서 번호 = 판 번호, 만들기만 되므로 중복 없음), ResultScene.js(저장 중·저장했어요·다시 시도) — cleared·failed·abandoned 결과와 필드·규칙 시험 통과(game.e2e, 규칙 에뮬레이터), 인터넷 끊김은 Live Server 확인 전
- [ ] 7-17 진행 상황 갱신(progress): 던전 입장·클리어·코인 변화 때 (구 8-6)
  - 확인: 플레이하는 동안 Firestore progress/{uid} 값이 바뀐다
  - 구현됨 — js/progress.js (1초에 한 번). 시험: game.e2e, Live Server 확인 전

## 8. 결과 분석 (구 8-2·8-7~8-10, 8a)
- 확인은 학생 2명 이상이 플레이한 결과로 teacher.html에서 한다

- [x] 8-1 순위 기준, 최종 결과 화면 내용 — 아래 기본값으로 확정 (결정(2026-11-11)) (구 8-2)
  - 지금 기본값: 깬 던전 수 → 맞힌 문제 수 / 최종 결과는 클리어한 던전·맞힌 문제·정답률 (spec.md)
- [x] 8-2 학급 통계 항목 — 아래 기본값으로 확정 (결정(2026-11-11))
  - 지금 기본값: 참여 학생 수·판 수·푼 문제 수·평균 정답률·던전별 클리어한 학생 수 (spec.md)
- [ ] 8-3 진행 중 화면: 학생별 진행 상황·순위 실시간 표 (구 8-7)
  - 확인: 학생이 던전을 깨면 교사 화면 순위가 바로 바뀐다
  - 구현됨 — activityView.js(진행 상황 + 서버 결과), analysis.js ranking. 시험: teacher-full.e2e(실제 teacher.html + main.js), Live Server 확인 전
- [ ] 8-4 결과 탭: 학생별 결과 표(맞힌 수·정답률·클리어한 던전) (구 8-8)
  - 확인: 저장된 결과가 학생별로 합쳐져 보이고, 계산 값이 Firestore 결과와 맞다
  - 구현됨 — js/teacher/resultsTab.js·analysis.js. 계산은 노드 시험(analysis.test.js)과 시험: teacher-full.e2e(실제 teacher.html + main.js), Live Server 확인 전
- [ ] 8-5 학생 자세한 기록: 판별 던전 기록(클리어·시간·충돌·추락·산 능력), 틀린 문제 (구 8-9)
  - 확인: 결과 탭에서 학생 줄을 누르면 열린다
  - 구현됨 — resultsTab.js 자세한 기록. 시험: teacher-full.e2e(실제 teacher.html + main.js), Live Server 확인 전
- [ ] 8-6 학생 최종 결과 화면 (구 8-10)
  - 확인: 시간 종료·교사 종료 때 8-1에서 정한 내용이 보인다
  - 구현됨 — ResultScene.js drawFinal. 교사 종료는 시험 통과(game.e2e), 시간 종료는 Live Server 확인 전
- [ ] 8-7 학급 통계 화면 (8-2에서 정한 항목)
  - 확인: 값이 결과 데이터와 맞다
  - 구현됨 — resultsTab.js 학급 통계 한 줄. 시험: teacher-full.e2e(실제 teacher.html + main.js), Live Server 확인 전
- [x] 8-8 취약 개념 기준 — 3번 이상·오답률 50% 이상으로 확정 (결정(2026-11-11)) (구 8a-1)
  - 지금 기본값: 3번 이상 풀고 오답률 50% 이상 (js/teacher/analysis.js WEAK_MIN_TOTAL·WEAK_RATE)
- [ ] 8-9 design.md에 분석 화면 배치 추가 (구 8a-2)
  - 확인: 사용자 승인
  - design.md 결과 탭 배치 초안 작성 — 사용자 승인 전
- [ ] 8-10 개념별 집계 함수: answers → '과목 + 개념'마다 (과목은 활동 문제 사본에서 찾음) 푼 횟수·틀린 횟수·오답률·틀린 학생 수 (구 8a-3)
  - 확인: 시험 데이터로 계산 값이 손으로 센 값과 같다
  - 구현됨 — analysis.js conceptStats·questionStats (문제별 정답률 포함). 노드 시험 6개 통과(손으로 센 값과 비교, 실제 실행함)
- [ ] 8-11 학급별 취약 개념 표 (오답률 높은 순, 활동으로 거르기) (구 8a-4)
  - 확인: 여러 학생 결과가 개념별로 합쳐져 보이고, 8-8 기준에 맞는 개념이 '취약'으로 표시된다
  - 구현됨 — resultsTab.js 개념별 오답(학급). 시험: teacher-full.e2e(실제 teacher.html + main.js), Live Server 확인 전
- [ ] 8-12 학생별 취약 개념과 틀린 문제 (8-5 자세한 기록 안) (구 8a-5)
  - 확인: 학생마다 다른 취약 개념이 보인다
  - 구현됨 — resultsTab.js 자세한 기록의 개념별 오답·틀린 문제. 시험: teacher-full.e2e(실제 teacher.html + main.js), Live Server 확인 전

## 12. 교사 협력·학습 분석 (2026-11-11 요청)
- 확인은 teacher.html에서 한다. 공유 문제은행은 Google 계정 두 개(교사 A·B)로 확인한다
- 자동 시험: tests/test/analysis.test.js(노드, 데이터 부족 기준 포함), 브라우저 teacher-full.e2e(교사 두 명 공유·가져오기, 맞춤 피드백·추천·보충 요약) 통과. Live Server 확인 전
- 실제 Firebase 검증은 verification.md V2~V8 (규칙 거부는 실제 Firebase에서만 확인할 수 있다)
- [ ] 12-1 학생별 맞춤 피드백: 정답률·학습 수준·취약 개념·잘하는 개념·시간 초과·활동별 변화 (규칙 기반, 데이터 부족 표시)
  - 확인: 결과 탭에서 학생을 누르면 피드백 문장이 실제 결과와 맞다 / 푼 문제가 5개 미만인 학생은 '데이터가 부족해요'
  - 구현됨 — js/teacher/analysis.js(studentFeedback·activityTrend·levelOf), resultsTab.js
- [ ] 12-2 취약 개념 추천 문제 → 추천 문제로 활동 만들기
  - 확인: 추천 문제가 취약 개념과 같은 과목·개념이다 / 버튼을 누르면 그 문제가 골라진 활동 만들기 양식이 열린다
  - 구현됨 — analysis.js recommendQuestions, activityTab.js openFormWith
- [ ] 12-3 학급 분석: 학습 수준 분포, 활동별 참여율·완료율, 문제별·개념별 정답률(데이터 부족 표시), 다음 수업 보충 학습 요약
  - 확인: 값이 Firestore 결과와 맞다 / 결과가 적으면 '데이터 부족'
  - 구현됨 — analysis.js(participation·supplementSummary·levelDistribution·rateText), resultsTab.js, teacher.html
- [ ] 12-4 공유 문제은행 데이터·규칙: sharedQuestions, 개인 문제 source 'shared'·origin·sharedId, teachers shareName, firestore.rules(교사만 읽기, 올린 교사만 고치기·지우기, 필드 제한)
  - 확인: 배포 후 교사 B가 교사 A의 공유 문제를 지우거나 고치려 하면 거부된다 / 학생 계정은 공유 문제를 읽을 수 없다
  - 구현됨 — js/teacher/sharedBank.js, firestore.rules. 규칙 시험은 에뮬레이터(Java)가 없어 실행하지 못함
- [ ] 12-5 공유하기: 공유 이름 정하기(이메일 불가), 내 문제 '공유'·'공유 갱신', 공유 취소
  - 확인: 공유 이름 없이 공유하면 안내 / 공유하면 공유 문제은행에 보이고 출처는 공유 이름 / Firestore 공유 문서에 이메일·실명이 없다
  - 구현됨 — sharedBank.js, sharedView.js, bankView.js(출처 칸·공유 버튼)
- [ ] 12-6 공유 문제 찾기·미리보기·가져오기 (복사, 출처 표시, 한 번만, 개념 합치기)
  - 확인: 교사 B가 과목·난이도·개념·검색으로 찾고, 미리보기로 정답을 보고, 가져오면 내 문제은행에 '공유: 이름'으로 생긴다 / 가져온 문제를 고쳐도 원본은 그대로 / 활동 만들기에서 바로 고를 수 있다
  - 구현됨 — sharedView.js, sharedBank.js importShared
- [ ] 12-7 design.md 공유 문제은행·결과 탭 분석 배치 — 사용자 승인 전
- 아직 만들지 않은 것 (필요하면 spec.md에 정한 뒤)
  - [x] 12-8 학습 수준·데이터 부족 기준값 — 지금 값으로 확정, 실제 수업 뒤 조정 가능 (결정(2026-11-11)) ( 수준 5문제·80%/50%, 정답률 3번, 보충 요약 10문제)
  - [ ] 12-9 [미정] 학생에게 맞춤 피드백 보여 주기 (지금은 교사만 봄. 학생이 자기 결과를 읽게 하려면 규칙 변경 필요 — 9-2와 함께)
  - [x] 12-10 피드백 저장·메모: 이번에는 만들지 않는다 — 피드백은 늘 최신 결과로 다시 계산 (결정(2026-11-11))
  - [x] 12-11 공유 문제 신고·평가·가져간 횟수·나눠 불러오기: 이번에는 만들지 않는다 (결정(2026-11-11))
  - [ ] 12-12 [미정] 공유 문제은행을 읽을 수 있는 교사 제한 (10-5 교사 허용 목록과 함께)

## 9. 차별화 기능 (spec.md 반영·승인 후)
- 지금 spec.md에 없는 기능이다. 각 기능은 먼저 spec.md에 규칙과 데이터 구조를 정하고 승인받은 뒤 만든다
- 모두 7단계 결과 데이터(answers·wrongConcepts)를 실제로 쓰는 기능으로 만든다

- [x] 9-1 오답 도감: 만들지 않는다 — 틀린 문제의 정답을 학생에게 모아 보여 주면 정답 비노출과 충돌. 9-4 틀린 문제 다시 내기로 대신 (결정(2026-11-11)). 원래 메모: 보여 줄 범위(활동 안 / 학급 전체), 틀린 문제의 정답을 보여 줄지(정답 비노출과 충돌), 학생 계정이 없어 다른 기기·브라우저에서는 이어지지 않는 점 → spec.md 반영
- [x] 9-2 (9-1을 만들지 않아 해당 없음) 오답 도감 데이터: 학생이 자기 결과를 읽을 수 있게 firestore.rules 변경 (지금은 교사만 읽음)
  - 확인: 학생은 자기 결과만 읽고, 다른 학생 결과는 거부된다
- [x] 9-3 (해당 없음) 오답 도감 화면 (학생): 틀린 문제·개념 모아 보기
  - 확인: 한 판에서 틀린 문제가 도감에 바로 보인다
- [x] 9-4 재도전: 틀린 문제를 학생 기기가 절반 확률로 먼저 다시 낸다, 보상은 같음, 능력 재도전(7-4)과 따로 (결정(2026-11-11)). 원래 메모: 무엇을 다시 하는지(틀린 개념 문제 퀴즈 / 던전 재도전), 보상, 7-4(능력 재도전 처리)와의 관계 → spec.md 반영
- [ ] 9-5 재도전 기능: 틀린 문제·개념을 우선 출제
  - 구현됨 — js/grading.js(pickQuestion·updateWrong)·runLog.js, runStore.js(learners/{uid}), firestore.rules(learners 본인만). 노드 시험·규칙 에뮬레이터 통과, 규칙 게시·Live Server 확인 전
  - 확인: 재도전 퀴즈에 내가 틀린 개념의 문제가 먼저 나오고, 결과가 기록된다
- [x] 9-6 학급 공동 보스: 만들지 않는다 (spec.md 범위 밖 '보스전') (결정(2026-11-11)). 원래 메모: spec.md 범위 밖의 '보스전'을 풀지, 규칙(예: 학급 전체 정답 수만큼 보스 체력 감소), 공유 데이터 구조·권한 → spec.md 반영
- [x] 9-7 (해당 없음) 공동 보스 데이터와 firestore.rules
  - 확인: 여러 학생의 정답이 한 보스 상태에 함께 반영되고, 학생이 값을 직접 꾸밀 수 없다
- [x] 9-8 (해당 없음) 공동 보스 화면: 교사 진행 중 화면과 학생 화면
  - 확인: 학생이 맞힐 때 교사·학생 화면의 보스 상태가 함께 바뀐다

## 10. 통합 검증·안정화·배포 (구 9·10단계)
- [ ] 10-1 네트워크 오류 처리: 로그인·저장·조회 실패 안내, 다시 시도 (구 9-1)
  - 확인: 인터넷을 끊었다 켜도 진행이 이어진다
  - 일부 구현됨 — 참여(다시 누르기), 퀴즈 받기·답 내기·결과 저장(빨간 안내 + 다시 시도, 같은 문제는 한 번만 채점, 결과는 판 번호로 한 번만 저장), 진행 상황(다음 변화 때 다시 씀). 응답을 잃어버린 뒤 다시 보내도 코인 한 번 시험 통과(game.e2e). 실제 인터넷 끊기는 Live Server 확인 전
- [ ] 10-2 새로고침·재접속 처리 (구 9-2)
  - 확인: 학생이 새로고침 후 다시 들어와도 학생이 하나만 남고 진행이 이어진다
  - 구현됨 — 6-11과 같음. 시험: game.e2e, Live Server 확인 전
- [ ] 10-3 보안 규칙 시험: 다른 교사로 남의 학급 읽기, 학생으로 남의 결과 쓰기·수정, 코드 목록 조회, 정답표 읽기 (구 9-3)
  - 확인: 모두 막힌다
  - Firestore 에뮬레이터 규칙 시험 8묶음 통과(npm run test:rules: 다른 교사 결과·정답표 읽기, 학생 결과 쓰기, 코드 목록 조회, 활동 상태 변경 모두 거부). 실제 Firebase는 배포 후 verification.md로 확인
- [ ] 10-4 학생 3명 이상 동시 진행 (구 9-4)
  - 판은 학생 기기 메모리에서 따로 진행되고 결과는 학생별 번호로 저장되므로 섞일 수 없다 — 규칙 에뮬레이터(남의 번호 거부)·teacher-full(학생 2명 결과) 시험 통과. 실제 여러 기기는 확인 전
  - 확인: 순위·결과·진행 상황이 섞이지 않는다
- [ ] 10-5 [미정] 교사 계정 허용 목록으로 제한할지 (구 9-6)
- [x] 10-6 배포 방식: Firebase Hosting (firebase.json hosting 추가) (결정(2026-11-11)) (구 10-1)
- [ ] 10-7 배포 (사용자: firebase deploy --only hosting). web.app 주소는 기본 승인 도메인이라 따로 추가하지 않는다 (구 10-2)
  - 확인: 다른 기기에서 접속해 한 판 완주
- [ ] 10-8 최종 검증 — 실제 수업 흐름 (교사 1명 + 학생 여러 명, 서로 다른 기기)
  - 교사: 로그인 → 학급 만들기 → 문제 준비(학습 개념 포함) → 활동 만들기 → 참여 코드 안내 → 시작
  - 학생: 코드·닉네임 참여 → 대기 → 시작 신호 → 퀴즈 → 코인 → 능력 구매 → 던전 → 결과 저장 → 반복
  - 교사: 실시간 순위 → 종료 → 학생별 결과·학급 통계·취약 개념 확인 (+ 승인된 차별화 기능)
  - 확인: 처음부터 끝까지 끊김 없이 진행되고, 교사 화면의 분석 값이 학생 실제 플레이와 맞으며, 모든 화면 콘솔에 빨간 오류가 없다

## 11. 확장 기능 (승인 후 하나씩)
- [ ] 11-1 3번째 던전 (얼어붙은 성)
  - 구현됨 — js/dungeons.js (가장 어려운 코스: 높은 발판, 빠른 장애물 8개). 레벨 점검(구멍 ≤140px·높이 차 ≤90px·문과 깃발이 발판 위)·해금·체크포인트·마지막 클리어 보상 시험 통과(dungeon3.e2e). 실제 플레이 난이도는 사용자 확인 전
- [ ] 11-2 그래픽 적용 (12주차, design.md 개정)
- [x] 11-3 게임 규칙 확정 (결정(2026-11-11)): 문 2개(체크포인트), 충돌 -10코인, 추락은 코인 그대로·마지막 문으로, 문 퀴즈 없음, 피드백·서사 spec.md
  - 구현됨 — DungeonScene.js(문 통과 안내·체크포인트 부활). 시험 통과(dungeon3.e2e). 실제 플레이 감각은 사용자 확인 전
- [ ] 11-5 실제 플레이 감각 점검 (사용자): 던전별 난이도, 대시 거리, 이단 점프 높이, 장애물 속도 — 초등학생이 3분 안팎으로 깰 수 있는지
- [ ] 11-4 검토 후보: 결과 CSV 내보내기, 효과음 ('틀린 문제 복습 활동'은 9단계 재도전으로 옮김)
