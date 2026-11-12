// 시험용 가짜 Firestore (메모리). 실제 questionBank.js가 이 함수를 쓰도록 import map으로 바꿔 끼운다.
export const docs = new Map(); // path → data
export const log = [];
let auto = 0;
const listeners = new Set();
function emit() { listeners.forEach((fn) => fn()); }
export const serverTimestamp = () => ({ __ts: Date.now(), toMillis() { return this.__ts; } });
export function collection(db, ...segs) { return { path: segs.join('/') }; }
export function doc(col, id) { return { path: `${col.path}/${id}`, id }; }
export async function getDoc(ref) { log.push(['get', ref.path]); return { exists: () => docs.has(ref.path), data: () => docs.get(ref.path) }; }
export async function addDoc(col, data) { const id = `auto${++auto}`; docs.set(`${col.path}/${id}`, data); log.push(['add', id]); emit(); return { id }; }
export async function updateDoc(ref, data) { docs.set(ref.path, { ...docs.get(ref.path), ...data }); log.push(['update', ref.path]); emit(); }
export async function deleteDoc(ref) { docs.delete(ref.path); log.push(['delete', ref.path]); emit(); }
export function writeBatch() {
  const ops = [];
  return {
    set(ref, data) { ops.push([ref, data]); },
    async commit() { ops.forEach(([ref, data]) => docs.set(ref.path, data)); log.push(['commit', ops.length]); emit(); },
  };
}
export function onSnapshot(col, onNext) {
  const fire = () => {
    const prefix = `${col.path}/`;
    const d = [...docs].filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
      .map(([p, data]) => ({ id: p.slice(prefix.length), data: () => data }));
    onNext({ docs: d });
  };
  listeners.add(fire); fire();
  return () => listeners.delete(fire);
}
