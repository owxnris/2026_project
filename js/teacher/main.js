// 교사 플랫폼 진입점: 로그인 상태에 따라 화면을 바꾼다.
import { isConfigured } from '../firebase/app.js';
import { watchTeacher, login, logout } from './auth.js';

const $ = (id) => document.getElementById(id);

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
  $('logout-btn').addEventListener('click', () => logout());
}
