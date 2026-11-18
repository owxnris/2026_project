// 교사 Google 로그인·로그아웃. 처음 로그인하면 teachers/{uid} 문서를 만든다.
import {
  GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
  doc, getDoc, setDoc, serverTimestamp,
} from '../firebase/sdk.js';
import { auth, db } from '../firebase/app.js';

// 익명(학생) 사용자는 교사로 보지 않는다.
export function watchTeacher(callback) {
  onAuthStateChanged(auth, (user) => callback(user && !user.isAnonymous ? user : null));
}

export async function login() {
  // 매번 계정 고르기 창을 띄운다 (공용 교실 컴퓨터에서 앞 사람 계정으로 바로 들어가지 않게)
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const { user } = await signInWithPopup(auth, provider);
  const ref = doc(db, 'teachers', user.uid);
  if (!(await getDoc(ref)).exists()) {
    await setDoc(ref, { name: user.displayName, email: user.email, createdAt: serverTimestamp() });
  }
}

export function logout() {
  return signOut(auth);
}
