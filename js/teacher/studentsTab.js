// 학급 화면 '학생' 탭 (design.md): 참여한 학생 표(닉네임·참여 시각·던전 지도 진행·골드), 실시간
import { reasonText } from '../firebase/errors.js';
import {
  onClassDataChange, getStudents, getClassDataError, getAdventures, getChest, getClassId,
} from './classHub.js';
import { chestState, newGoal } from '../chest.js';
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
  renderTable(box, ['닉네임', '참여 시각', '던전 지도 (깬 방)', '골드', '보물상자에 넣은 골드'], list.map((s) => [
    s.nickname, when(s.joinedAt), progressText(adv[s.id]), adv[s.id]?.gold ?? 0, adv[s.id]?.donated ?? 0,
  ]));
}

// 학급 보물상자 카드: 진행 막대·보상·열림, 지난 목표 기록, '목표 정하기' 양식
function renderChest() {
  const c = getChest();
  const s = chestState(c);
  const box = $('chest-status');
  if (!s.ready) {
    box.innerHTML = '';
    box.append(Object.assign(document.createElement('p'), { className: 'small-text muted', textContent: '아직 목표가 없어요. \'목표 정하기\'로 목표 골드와 보상을 정하면 학생 게임의 보물상자가 열려요.' }));
  } else {
    const bar = document.createElement('div');
    bar.className = 'chest-bar';
    const fill = document.createElement('div');
    fill.style.width = `${s.percent}%`;
    bar.append(fill);
    const line = document.createElement('p');
    line.className = 'small-text';
    line.textContent = `${s.total} / ${s.goal} 골드 (${s.percent}%) · 보상: ${s.reward}${s.opened ? ' · 열렸어요! 보상을 주고 다음 목표를 정해 주세요' : ''}`;
    if (s.opened) line.classList.add('notice');
    box.replaceChildren(bar, line);
  }
  const hist = (c?.history ?? []).slice(-3).reverse();
  $('chest-history').textContent = hist.length ? `지난 목표: ${hist.map((h) => `${h.reward}(${h.total}/${h.goal}${h.opened ? ' 열림' : ''})`).join(' · ')}` : '';
  $('chest-edit-btn').textContent = s.ready ? '새 목표 정하기' : '목표 정하기';
}

export function setupStudentsTab(saveChest) {
  onClassDataChange(render);
  onClassDataChange(renderChest);
  const form = $('chest-form');
  $('chest-edit-btn').addEventListener('click', () => {
    const c = getChest();
    $('chest-goal').value = c?.goal ?? 1000;
    $('chest-reward').value = '';
    $('chest-error').textContent = '';
    form.hidden = false;
  });
  $('chest-cancel-btn').addEventListener('click', () => { form.hidden = true; });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = new Date();
    const r = newGoal(getChest(), $('chest-goal').value, $('chest-reward').value, `${d.getMonth() + 1}월 ${d.getDate()}일`);
    if (r.error) { $('chest-error').textContent = r.error; return; }
    try {
      await saveChest(getClassId(), r.chest);
      form.hidden = true;
    } catch (err) {
      $('chest-error').textContent = `저장하지 못했어요 (${reasonText(err)})`;
    }
  });
}
