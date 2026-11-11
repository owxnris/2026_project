// 교사 화면 표·안내 글 만들기 (design.md: 표, 빈 목록 안내) — 학생·결과·순위 화면이 함께 쓴다
export function message(box, text, className = 'muted') {
  const p = document.createElement('p');
  p.className = `small-text ${className}`;
  p.textContent = text;
  box.replaceChildren(p);
}

// headers: 머리줄 글자, rows: [[칸 글자...]], onRow(i): 줄을 눌렀을 때 (없으면 누를 수 없음)
export function renderTable(box, headers, rows, { onRow, className = '' } = {}) {
  const t = document.createElement('table');
  t.className = `table ${className}`;
  const head = t.createTHead().insertRow();
  headers.forEach((label) => {
    const th = document.createElement('th');
    th.textContent = label;
    head.appendChild(th);
  });
  const body = t.createTBody();
  rows.forEach((cells, i) => {
    const row = body.insertRow();
    cells.forEach((c) => {
      const td = row.insertCell();
      if (c && typeof c === 'object') { td.textContent = c.text; td.className = c.className || ''; } else td.textContent = c ?? '';
    });
    if (onRow) {
      row.className = 'clickable';
      row.tabIndex = 0;
      row.addEventListener('click', () => onRow(i));
      row.addEventListener('keydown', (e) => { if (e.key === 'Enter') onRow(i); });
    }
  });
  box.replaceChildren(t);
  return t;
}
