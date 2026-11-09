// 학급 목록 표 그리기 (design.md 교사 플랫폼 UI 규칙: 표·빈 목록·불러오는 중)
import { countStudents } from './classes.js';

function message(box, text, className) {
  const p = document.createElement('p');
  p.className = `small-text ${className}`;
  p.textContent = text;
  box.replaceChildren(p);
}

export function showClassListLoading(box) {
  message(box, '불러오는 중…', 'muted');
}

export function showClassListError(box, error) {
  message(box, `학급 목록을 불러오지 못했어요 (${error.code || error.message})`, 'error');
}

// classes: [{ id, name, joinCode, ... }]
export function renderClassList(box, classes) {
  if (classes.length === 0) {
    message(box, '아직 학급이 없어요. 위에서 학급 이름을 넣고 학급 만들기를 눌러 보세요.', 'muted');
    return;
  }

  const table = document.createElement('table');
  table.className = 'table';
  const head = table.createTHead().insertRow();
  ['학급 이름', '참여 코드', '학생 수'].forEach((label) => {
    const th = document.createElement('th');
    th.textContent = label;
    head.appendChild(th);
  });

  const body = table.createTBody();
  classes.forEach((c) => {
    const row = body.insertRow();
    row.dataset.classId = c.id;
    row.insertCell().textContent = c.name;
    row.insertCell().textContent = c.joinCode;
    const countCell = row.insertCell();
    countCell.textContent = '…';
    countStudents(c.id)
      .then((n) => { countCell.textContent = `${n}명`; })
      .catch(() => { countCell.textContent = '-'; });
  });

  box.replaceChildren(table);
}
