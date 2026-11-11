// 지금 연 학급의 참여 학생·결과를 실시간으로 받아 학생 탭·결과 탭·진행 중 화면에 나눠 준다.
// 구독 함수는 setupClassHub에서 받는다 (store: { watchStudents, watchResults })
let store = null;
let stops = [];
let students = [];
let results = [];
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
export function getClassDataError() { return error; }

export function openClassData(classId) {
  closeClassData();
  students = [];
  results = [];
  error = null;
  const fail = (e) => { error = e; notify(); };
  stops = [
    store.watchStudents(classId, (list) => { students = list; notify(); }, fail),
    store.watchResults(classId, (list) => { results = list; notify(); }, fail),
  ];
  notify();
}

export function closeClassData() {
  stops.forEach((stop) => stop());
  stops = [];
}
