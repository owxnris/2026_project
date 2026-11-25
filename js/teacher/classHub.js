// 지금 연 학급의 참여 학생·결과를 실시간으로 받아 학생 탭·결과 탭·진행 중 화면에 나눠 준다.
// 구독 함수는 setupClassHub에서 받는다 (store: { watchStudents, watchResults })
let store = null;
let stops = [];
let students = [];
let results = [];
let adventures = {}; // { [studentUid]: { clearedCount, gold } } 학생별 모험 기록
let chest = null; // 학급 보물상자 { goal, reward, total, history } | null
let classId = null;
let error = null;
const listeners = new Set();

const notify = () => listeners.forEach((fn) => fn());

export function setupClassHub(s) {
  store = s;
}

export function onClassDataChange(fn) {
  listeners.add(fn);
}

export function getStudents() { return students; }
export function getResults() { return results; }
export function getAdventures() { return adventures; }
export function getChest() { return chest; }
export function getClassId() { return classId; }
export function getClassDataError() { return error; }

export function openClassData(id) {
  closeClassData();
  classId = id;
  chest = null;
  students = [];
  results = [];
  adventures = {};
  error = null;
  const fail = (e) => { error = e; notify(); };
  stops = [
    store.watchStudents(id, (list) => { students = list; notify(); }, fail),
    store.watchResults(id, (list) => { results = list; notify(); }, fail),
  ];
  if (store.watchAdventures) stops.push(store.watchAdventures(id, (map) => { adventures = map; notify(); }));
  if (store.watchChest) stops.push(store.watchChest(id, (c) => { chest = c; notify(); }));
  notify();
}

export function closeClassData() {
  stops.forEach((stop) => stop());
  stops = [];
}
