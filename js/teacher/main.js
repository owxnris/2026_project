// 교사 플랫폼 진입점: 로그인 상태에 따라 화면을 바꾼다.
import { isConfigured } from '../firebase/app.js';
import { watchTeacher, login, logout } from './auth.js';
import { createClass, watchMyClasses } from './classes.js';
import { renderClassList, showClassListLoading, showClassListError } from './classList.js';

const $ = (id) => document.getElementById(id);

// 학급 목록 실시간 구독. 로그아웃 전에 끊어야 권한 오류가 나지 않는다.
let stopClassList = null;

function startClassList() {
  stopClassListWatch();
  showClassListLoading($('class-list'));
  stopClassList = watchMyClasses(
    (classes) => renderClassList($('class-list'), classes),
    (e) => showClassListError($('class-list'), e),
  );
}

function stopClassListWatch() {
  if (stopClassList) stopClassList();
  stopClassList = null;
}

const ERROR_TEXT = {
  'auth/unauthorized-domain': '이 주소는 로그인이 허용되지 않았어요. Firebase 콘솔 → Authentication → 설정 → 승인된 도메인에 추가해 주세요.',
  'auth/operation-not-allowed': 'Google 로그인이 꺼져 있어요. Firebase 콘솔 → Authentication에서 켜 주세요.',
};

function showError(msg) {
  $('error').textContent = msg;
}

function show(user) {
  $('login-view').hidden = !!user;
  $('home-view').hidden = !user;
  $('account').hidden = !user;
  $('page-title').textContent = user ? '홈' : '로그인';
  if (user) {
    $('teacher-name').textContent = user.displayName || user.email;
    $('welcome').textContent = `${user.displayName || '선생님'} 선생님, 환영합니다`;
    startClassList();
  } else {
    stopClassListWatch();
  }
}

if (!isConfigured) {
  $('login-btn').disabled = true;
  showError('Firebase 설정값이 아직 없어요. js/firebase/config.js에 Firebase 콘솔에서 받은 값을 넣어 주세요.');
} else {
  watchTeacher(show);
  $('login-btn').addEventListener('click', async () => {
    showError('');
    try {
      await login();
    } catch (e) {
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
      showError(ERROR_TEXT[e.code] || `로그인하지 못했어요 (${e.code || e.message})`);
    }
  });
  $('logout-btn').addEventListener('click', () => {
    stopClassListWatch();
    logout();
  });
  $('class-form').addEventListener('submit', onCreateClass);
}

// 학급 만들기: 이름이 비면 안내만, 저장되면 발급된 참여 코드를 보여 준다.
async function onCreateClass(event) {
  event.preventDefault();
  const input = $('class-name');
  const name = input.value.trim();
  $('class-error').textContent = '';
  input.classList.remove('invalid');

  if (!name) {
    input.classList.add('invalid');
    $('class-error').textContent = '학급 이름을 입력해 주세요.';
    return;
  }

  $('class-create-btn').disabled = true;
  try {
    const { joinCode } = await createClass(name);
    input.value = '';
    $('class-created-name').textContent = `${name} 참여 코드`;
    $('class-code').textContent = joinCode;
    $('class-created').hidden = false;
    $('class-notice').textContent = '저장했어요';
    setTimeout(() => { $('class-notice').textContent = ''; }, 2000);
  } catch (e) {
    $('class-error').textContent = `학급을 만들지 못했어요 (${e.code || e.message})`;
  } finally {
    $('class-create-btn').disabled = false;
  }
}
