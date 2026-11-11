// 학급 상세 화면: 학급 이름(바꾸기), 참여 코드, 탭 '학생 · 활동 · 결과' (탭 내용은 각 단계에서 채운다)
import { showView } from './nav.js';
import { renameClass } from './classes.js';
import { showActivities } from './activityTab.js';
import { openClassData } from './classHub.js';
import { resetResultsTab } from './resultsTab.js';

const $ = (id) => document.getElementById(id);
let current = null; // 지금 열린 학급 { id, name, joinCode }

function selectTab(name) {
  document.querySelectorAll('#class-view .tab').forEach((tab) => {
    tab.classList.toggle('current', tab.dataset.tab === name);
  });
  document.querySelectorAll('#class-view .tab-panel').forEach((panel) => {
    panel.hidden = panel.dataset.panel !== name;
  });
}

function setRenameMode(on) {
  $('rename-form').hidden = !on;
  $('rename-btn').hidden = on;
  $('rename-error').textContent = '';
  $('rename-input').classList.remove('invalid');
  if (on) {
    $('rename-input').value = current.name;
    $('rename-input').focus();
  }
}

// 이름이 비면 안내만, 저장되면 상세 화면 이름을 바로 바꾼다 (목록은 실시간 구독으로 바뀐다).
async function onRename(event) {
  event.preventDefault();
  const input = $('rename-input');
  const name = input.value.trim();
  $('rename-error').textContent = '';
  input.classList.remove('invalid');

  if (!name) {
    input.classList.add('invalid');
    $('rename-error').textContent = '학급 이름을 입력해 주세요.';
    return;
  }
  if (name === current.name) {
    setRenameMode(false);
    return;
  }

  const target = current;
  $('rename-save-btn').disabled = true;
  try {
    await renameClass(target.id, name);
    target.name = name;
    if (current === target) {
      $('detail-name').textContent = name;
      setRenameMode(false);
      $('detail-notice').textContent = '저장했어요';
      setTimeout(() => { $('detail-notice').textContent = ''; }, 2000);
    }
  } catch (e) {
    $('rename-error').textContent = `이름을 바꾸지 못했어요 (${e.code || e.message})`;
  } finally {
    $('rename-save-btn').disabled = false;
  }
}

// c: { id, name, joinCode }
export function openClassDetail(c) {
  current = c;
  $('detail-name').textContent = c.name;
  $('detail-code').textContent = c.joinCode;
  $('detail-notice').textContent = '';
  setRenameMode(false);
  selectTab('students');
  showActivities(c);
  resetResultsTab();
  openClassData(c.id);
  showView('detail');
}

// 활동 진행 화면에서 돌아올 때: 지금 학급의 '활동' 탭으로
export function backToActivities() {
  selectTab('activities');
  showView('detail');
}

export function setupClassDetail() {
  document.querySelectorAll('#class-view .tab').forEach((tab) => {
    tab.addEventListener('click', () => selectTab(tab.dataset.tab));
  });
  $('class-back-btn').addEventListener('click', () => showView('classes'));
  $('rename-btn').addEventListener('click', () => setRenameMode(true));
  $('rename-cancel-btn').addEventListener('click', () => setRenameMode(false));
  $('rename-form').addEventListener('submit', onRename);
}
