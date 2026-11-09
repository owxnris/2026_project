// 학급 상세 화면: 학급 이름, 참여 코드, 탭 '학생 · 활동 · 결과' (탭 내용은 각 단계에서 채운다)
import { showView } from './nav.js';

function selectTab(name) {
  document.querySelectorAll('#class-view .tab').forEach((tab) => {
    tab.classList.toggle('current', tab.dataset.tab === name);
  });
  document.querySelectorAll('#class-view .tab-panel').forEach((panel) => {
    panel.hidden = panel.dataset.panel !== name;
  });
}

// c: { id, name, joinCode }
export function openClassDetail(c) {
  document.getElementById('detail-name').textContent = c.name;
  document.getElementById('detail-code').textContent = c.joinCode;
  selectTab('students');
  showView('detail');
}

export function setupClassDetail() {
  document.querySelectorAll('#class-view .tab').forEach((tab) => {
    tab.addEventListener('click', () => selectTab(tab.dataset.tab));
  });
  document.getElementById('class-back-btn').addEventListener('click', () => showView('classes'));
}
