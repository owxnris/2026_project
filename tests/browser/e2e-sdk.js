// 시험용 Firebase SDK: 교사·학생 앱이 같은 메모리 Firestore를 본다 (Cloud Functions 없음).
// 규칙 일부 흉내: 결과 문서는 만들기만 되고 같은 번호로 다시 쓰면 permission-denied (실제 규칙은 에뮬레이터 시험이 맡는다)
import { auth } from '/__test/e2e-app.js';

export const docs = new Map();
export const loseWriteOnce = new Set(); // 경로 일부 문자열: 그 경로 쓰기는 저장한 뒤 응답만 잃은 것처럼 한 번 실패 (네트워크 끊김)
export const failReadOnce = new Set(); // 경로 일부 문자열: 그 경로 읽기는 한 번 실패
export const readLog = []; // 앱이 읽은 문서 [path, data]
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());
let auto = 0;

export class Timestamp {
  constructor(seconds, nanoseconds) { this.seconds = seconds; this.nanoseconds = nanoseconds; }
  toMillis() { return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6); }
  static fromMillis(ms) { return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6); }
}
export const ts = (ms) => Timestamp.fromMillis(ms);
export const serverTimestamp = () => ({ __serverTs: true });
// 쓰기 직전: serverTimestamp 자리를 서버 시각(여기서는 이 기기 시각 + 시험이 정한 오프셋)으로 바꾼다
export let serverOffsetMs = 0;
export const setServerOffset = (ms) => { serverOffsetMs = ms; };
const resolve = (v) => {
  if (v && v.__serverTs) return ts(Date.now() + serverOffsetMs);
  if (v instanceof Timestamp) return v;
  if (Array.isArray(v)) return v.map(resolve);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolve(x)]));
  return v;
};
function revive(k, v) { return v && typeof v === 'object' && Object.keys(v).sort().join() === 'nanoseconds,seconds' ? new Timestamp(v.seconds, v.nanoseconds) : v; }
const clone = (d) => JSON.parse(JSON.stringify(d), revive);

const segs = (p) => p.split('/');
export function collection(base, ...s) { return { path: [base.path, ...s].filter(Boolean).join('/'), kind: 'col' }; }
export function doc(base, ...s) {
  if (base.kind === 'col' && s.length === 0) return { path: `${base.path}/c${++auto}`, id: `c${auto}`, kind: 'doc' };
  const path = [base.path, ...s].filter(Boolean).join('/');
  return { path, id: segs(path).pop(), kind: 'doc', parent: { path: segs(path).slice(0, -1).join('/') } };
}
export const where = (f, op, v) => [f, v];
export function query(col, ...filters) { return { ...col, filters }; }
const dsnap = (path) => {
  const d = docs.get(path);
  readLog.push([path, d]);
  return { id: segs(path).pop(), ref: { path }, exists: () => docs.has(path), data: () => (d ? clone(d) : undefined) };
};
function colDocs(t) {
  const prefix = `${t.path}/`;
  return [...docs.keys()].filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
    .filter((p) => (t.filters || []).every(([f, v]) => docs.get(p)[f] === v)).map(dsnap);
}
const netErr = () => Object.assign(new Error('unavailable'), { code: 'unavailable' });
const denied = () => Object.assign(new Error('permission-denied'), { code: 'permission-denied' });
function takeFlag(set, path) {
  for (const k of set) if (path.includes(k)) { set.delete(k); return true; }
  return false;
}
export async function getDoc(ref) {
  if (takeFlag(failReadOnce, ref.path)) throw netErr();
  return dsnap(ref.path);
}
export async function getDocs(t) { return { docs: colDocs(t) }; }
export async function setDoc(ref, data) {
  if (ref.path.includes('/results/') && docs.has(ref.path)) throw denied(); // 결과는 만들기만 된다
  docs.set(ref.path, resolve(data)); emit();
  if (takeFlag(loseWriteOnce, ref.path)) throw netErr();
}
export async function updateDoc(ref, data) { docs.set(ref.path, { ...docs.get(ref.path), ...resolve(data) }); emit(); }
export async function addDoc(col, data) { const r = doc(col); docs.set(r.path, resolve(data)); emit(); return r; }
export async function deleteDoc(ref) { docs.delete(ref.path); emit(); }
export async function getCountFromServer(col) { return { data: () => ({ count: colDocs(col).length }) }; }
export function writeBatch() {
  const ops = [];
  return {
    set(ref, data) { ops.push(() => docs.set(ref.path, resolve(data))); },
    update(ref, data) { ops.push(() => docs.set(ref.path, { ...docs.get(ref.path), ...resolve(data) })); },
    delete(ref) { ops.push(() => docs.delete(ref.path)); },
    async commit() { ops.forEach((op) => op()); emit(); },
  };
}
export function onSnapshot(t, next) {
  const fire = t.kind === 'doc' ? () => next(dsnap(t.path)) : () => next({ docs: colDocs(t) });
  listeners.add(fire); setTimeout(fire, 0);
  return () => listeners.delete(fire);
}
export async function signInAnonymously(a) { a.currentUser = a.currentUser || { uid: 'S1', provider: 'anonymous' }; return { user: a.currentUser }; }

// 교사 로그인 흉내 (Google 팝업 대신 시험 교사 T1)
const authListeners = new Set();
const fireAuth = () => authListeners.forEach((cb) => cb(auth.currentUser));
export class GoogleAuthProvider {}
export async function signInWithPopup(a) {
  a.currentUser = globalThis.nextTeacher || { uid: 'T1', provider: 'google.com', isAnonymous: false, displayName: '김선생', email: 't1@example.com' };
  fireAuth();
  return { user: a.currentUser };
}
export async function signOut(a) { a.currentUser = null; fireAuth(); }
export function onAuthStateChanged(a, cb) { authListeners.add(cb); setTimeout(() => cb(a.currentUser), 0); return () => authListeners.delete(cb); }
export const initializeApp = () => ({});
export const getAuth = () => auth;
export const getFirestore = () => ({});
