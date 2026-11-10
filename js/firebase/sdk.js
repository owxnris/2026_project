// Firebase JS SDK를 CDN에서 불러오는 곳. 버전은 여기서만 바꾼다. (10.12.2 [임시] — spec.md에서 [미정])
export { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
export {
  getAuth, GoogleAuthProvider, signInWithPopup, signInAnonymously, signOut, onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
export {
  getFirestore, doc, getDoc, setDoc, serverTimestamp, collection, writeBatch,
  query, where, onSnapshot, getCountFromServer, updateDoc, addDoc, deleteDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
