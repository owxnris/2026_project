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
  const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
  const ref = doc(db, 'teachers', user.uid);
  if (!(await getDoc(ref)).exists()) {
    await setDoc(ref, { name: user.displayName, email: user.email, createdAt: serverTimestamp() });
  }
}

export function logout() {
  return signOut(auth);
}
