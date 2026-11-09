// 학생 쪽 Firebase 기능. 학생은 계정 없이 익명 인증을 쓴다.
import { signInAnonymously } from './sdk.js';
import { auth } from './app.js';

// 이미 익명으로 로그인돼 있으면 그 사용자를 그대로 쓴다.
export async function signInStudent() {
  if (auth.currentUser) return auth.currentUser;
  const { user } = await signInAnonymously(auth);
  return user;
}
