// 학급 화면 '학생' 탭 (design.md): 참여한 학생 표(닉네임·참여 시각·던전 지도 진행·골드), 실시간
import { reasonText } from '../firebase/errors.js';
import {
  onClassDataChange, getStudents, getClassDataError, getAdventures,
} from './classHub.js';
import { DUNGEONS } from '../dungeons.js';
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
  if (err) { message(box, `학생 목록을 불러오지 못했어요 (${reasonText(err)})`, 'error'); return; }
  const list = getStudents();
  const adv = getAdventures();
  const started = list.filter((s) => adv[s.id]?.clearedCount > 0);
  const avg = started.length ? (started.reduce((n, s) => n + adv[s.id].clearedCount, 0) / list.length).toFixed(1) : null;
  $('student-count').textContent = `참여한 학생 ${list.length}명${avg !== null ? ` · 평균 깬 방 ${avg}/${DUNGEONS.length}` : ''}`;
  if (list.length === 0) {
    message(box, '아직 참여한 학생이 없어요. 학생에게 참여 코드를 알려 주세요 (게임 시작 → 참여 코드·닉네임 입력).');
    return;
  }
  // 던전 지도 진행: 깬 방 수와 다음 방 (모험 기록 — 수업이 바뀌어도 이어진다)
  const progressText = (a) => {
    if (!a || !a.clearedCount) return '아직 시작 전';
    if (a.clearedCount >= DUNGEONS.length) return `${DUNGEONS.length}/${DUNGEONS.length} · 모두 정복`;
    return `${a.clearedCount}/${DUNGEONS.length} · 다음 '${DUNGEONS[a.clearedCount].name}'`;
  };
  renderTable(box, ['닉네임', '참여 시각', '던전 지도 (깬 방)', '골드'], list.map((s) => [
    s.nickname, when(s.joinedAt), progressText(adv[s.id]), adv[s.id]?.gold ?? 0,
  ]));
}

export function setupStudentsTab() {
  onClassDataChange(render);
}
