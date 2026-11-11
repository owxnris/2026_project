// 학급 화면 '학생' 탭 (design.md): 참여한 학생 표(닉네임·참여 시각), 실시간
import { onClassDataChange, getStudents, getClassDataError } from './classHub.js';
import { message, renderTable } from './tableUtil.js';

const $ = (id) => document.getElementById(id);

function when(ts) {
  if (!ts) return '';
  const d = new Date(ts.toMillis());
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function render() {
  const box = $('student-list');
  const err = getClassDataError();
  if (err) { message(box, `학생 목록을 불러오지 못했어요 (${err.code || err.message})`, 'error'); return; }
  const list = getStudents();
  $('student-count').textContent = `참여한 학생 ${list.length}명`;
  if (list.length === 0) {
    message(box, '아직 참여한 학생이 없어요. 학생에게 참여 코드를 알려 주세요 (게임 시작 → 참여 코드·닉네임 입력).');
    return;
  }
  renderTable(box, ['닉네임', '참여 시각'], list.map((s) => [s.nickname, when(s.joinedAt)]));
}

export function setupStudentsTab() {
  onClassDataChange(render);
}
