// 체험 모드용 Firebase 대신: 이 브라우저(localStorage) 안에서만 도는 작은 Firestore·로그인.
// 체험 모드(index.html·teacher.html의 ?demo=1)일 때만 js/firebase/sdk.js 대신 쓰인다 → 게임·교사 코드는 그대로.
// - 같은 브라우저의 교사 탭과 학생 탭이 데이터를 함께 본다 (localStorage 변경 알림으로 실시간)
// - 실제 Firebase와 서버에는 아무것도 보내지 않는다. 보안 규칙 검사는 없다 (체험용)
// - 처음 열면 예시 학급·문제·가상 학생 결과를 넣는다 (seed.js)
import { seed } from './seed.js';

const DB_KEY = 'dd.demo.db';
const TEACHER_KEY = 'dd.demo.teacher'; // 교사 탭: 체험 선생님으로 로그인했는지
const STUDENT_KEY = 'dd.demo.student'; // 학생 탭마다(sessionStorage) 다른 익명 학생

export class Timestamp {
  constructor(seconds, nanoseconds) { this.seconds = seconds; this.nanoseconds = nanoseconds; }
  toMillis() { return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6); }
  toDate() { return new Date(this.toMillis()); }
  static fromMillis(ms) { return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6); }
  static now() { return Timestamp.fromMillis(Date.now()); }
}

// ── 저장소 ──
let docs = new Map();
const revive = (k, v) => (v && typeof v === 'object' && v.__ts ? new Timestamp(v.s, v.n) : v);
const replacer = (k, v) => (v instanceof Timestamp ? { __ts: 1, s: v.seconds, n: v.nanoseconds } : v);
function load() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    docs = new Map(raw ? JSON.parse(raw, revive) : []);
  } catch { docs = new Map(); }
}
function save() {
  try { localStorage.setItem(DB_KEY, JSON.stringify([...docs], replacer)); } catch { /* 저장 공간 부족 등: 이 탭에서만 유지 */ }
}
load();
const ready = docs.size ? Promise.resolve() : seed({ docs, Timestamp }).then(save);

const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());
// 다른 탭이 바꾸면 다시 읽고 알린다 (교사 탭 ↔ 학생 탭 실시간)
window.addEventListener('storage', (e) => { if (e.key === DB_KEY) { load(); emit(); } });

const clone = (d) => JSON.parse(JSON.stringify(d, replacer), revive);
const resolve = (v) => {
  if (v && v.__serverTs) return Timestamp.now();
  if (v instanceof Timestamp) return v;
  if (Array.isArray(v)) return v.map(resolve);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolve(x)]));
  return v;
};
const write = () => { save(); emit(); };

// ── Firestore 흉내 ──
const segs = (p) => p.split('/');
let auto = 0;
const newId = () => `d${Date.now().toString(36)}${(auto++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const getFirestore = () => ({});
export const serverTimestamp = () => ({ __serverTs: true });
export const increment = (n) => ({ __inc: n }); // 지금 값에 더하기 (여러 학생이 동시에 넣어도 합계가 맞게)
const merge = (prev = {}, data) => Object.fromEntries([...Object.entries(prev), ...Object.entries(data).map(([k, v]) => [k, v && v.__inc !== undefined ? (prev[k] ?? 0) + v.__inc : v])]);
export function collection(base, ...s) { return { path: [base.path, ...s].filter(Boolean).join('/'), kind: 'col' }; }
export function doc(base, ...s) {
  if (base.kind === 'col' && s.length === 0) { const id = newId(); return { path: `${base.path}/${id}`, id, kind: 'doc' }; }
  const path = [base.path, ...s].filter(Boolean).join('/');
  return { path, id: segs(path).pop(), kind: 'doc' };
}
export const where = (f, op, v) => [f, v];
export function query(col, ...filters) { return { ...col, filters }; }
const dsnap = (path) => {
  const d = docs.get(path);
  return { id: segs(path).pop(), ref: { path, id: segs(path).pop(), kind: 'doc' }, exists: () => docs.has(path), data: () => (d ? clone(d) : undefined) };
};
function colDocs(t) {
  const prefix = `${t.path}/`;
  return [...docs.keys()].filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
    .filter((p) => (t.filters || []).every(([f, v]) => docs.get(p)[f] === v)).map(dsnap);
}
const denied = () => Object.assign(new Error('permission-denied'), { code: 'permission-denied' });
export async function getDoc(ref) { await ready; return dsnap(ref.path); }
export async function getDocs(t) { await ready; return { docs: colDocs(t), size: colDocs(t).length }; }
export async function setDoc(ref, data) {
  await ready;
  if (ref.path.includes('/results/') && docs.has(ref.path)) throw denied(); // 결과는 만들기만 (실제 규칙과 같게)
  docs.set(ref.path, resolve(data)); write();
}
export async function updateDoc(ref, data) { await ready; docs.set(ref.path, resolve(merge(docs.get(ref.path), data))); write(); }
export async function addDoc(col, data) { await ready; const r = doc(col); docs.set(r.path, resolve(data)); write(); return r; }
export async function deleteDoc(ref) { await ready; docs.delete(ref.path); write(); }
export async function getCountFromServer(col) { await ready; return { data: () => ({ count: colDocs(col).length }) }; }
export function writeBatch() {
  const ops = [];
  return {
    set(ref, data) { ops.push(() => docs.set(ref.path, resolve(data))); return this; },
    update(ref, data) { ops.push(() => docs.set(ref.path, resolve(merge(docs.get(ref.path), data)))); return this; },
    delete(ref) { ops.push(() => docs.delete(ref.path)); return this; },
    async commit() { await ready; ops.forEach((op) => op()); write(); },
  };
}
export function onSnapshot(t, next) {
  const fire = t.kind === 'doc' ? () => next(dsnap(t.path)) : () => next({ docs: colDocs(t) });
  listeners.add(fire);
  ready.then(() => setTimeout(fire, 0));
  return () => listeners.delete(fire);
}

// ── 로그인 흉내 ──
export const initializeApp = () => ({});
const auth = { currentUser: null };
export const getAuth = () => auth;
const onTeacherPage = /teacher\.html$/.test(location.pathname);
const TEACHER = { uid: 'demo-teacher', isAnonymous: false, displayName: '체험', email: 'demo@dungeon-dash.example' };
try {
  if (onTeacherPage && localStorage.getItem(TEACHER_KEY) === '1') auth.currentUser = TEACHER;
  const sid = sessionStorage.getItem(STUDENT_KEY);
  if (!onTeacherPage && sid) auth.currentUser = { uid: sid, isAnonymous: true };
} catch { /* 저장소를 못 쓰면 매번 새로 */ }
const authListeners = new Set();
const fireAuth = () => authListeners.forEach((cb) => cb(auth.currentUser));
export class GoogleAuthProvider { setCustomParameters() {} }
export async function signInWithPopup() {
  auth.currentUser = TEACHER;
  try { localStorage.setItem(TEACHER_KEY, '1'); } catch { /* 이번 탭만 */ }
  fireAuth();
  return { user: auth.currentUser };
}
export async function signInAnonymously() {
  if (!auth.currentUser) {
    auth.currentUser = { uid: `demo-s-${newId()}`, isAnonymous: true };
    try { sessionStorage.setItem(STUDENT_KEY, auth.currentUser.uid); } catch { /* 이번 페이지만 */ }
  }
  return { user: auth.currentUser };
}
export async function signOut() {
  const wasTeacher = auth.currentUser && !auth.currentUser.isAnonymous;
  auth.currentUser = null;
  try {
    if (wasTeacher) localStorage.removeItem(TEACHER_KEY);
    else sessionStorage.removeItem(STUDENT_KEY);
  } catch { /* 무시 */ }
  fireAuth();
}
export function onAuthStateChanged(a, cb) {
  authListeners.add(cb);
  ready.then(() => setTimeout(() => cb(auth.currentUser), 0));
  return () => authListeners.delete(cb);
}

// 체험 데이터를 처음 상태로 (배너의 '처음부터 다시')
export function resetDemo() {
  try { localStorage.removeItem(DB_KEY); localStorage.removeItem(TEACHER_KEY); sessionStorage.removeItem(STUDENT_KEY); } catch { /* 무시 */ }
}
