// 교사 플랫폼 화면 전환: 한 번에 한 화면만 보이고, 지금 메뉴에 밑줄을 친다.
const VIEWS = { classes: 'home-view', detail: 'class-view', bank: 'bank-view' };
const MENU_OF = { classes: 'classes', detail: 'classes', bank: 'bank' }; // 학급 상세는 '학급' 메뉴 아래

export function showView(name) {
  Object.entries(VIEWS).forEach(([key, id]) => {
    document.getElementById(id).hidden = key !== name;
  });
  document.querySelectorAll('.menu-item').forEach((item) => {
    item.classList.toggle('current', item.dataset.view === MENU_OF[name]);
  });
}

export function hideAllViews() {
  Object.values(VIEWS).forEach((id) => { document.getElementById(id).hidden = true; });
}

export function setupMenu() {
  document.querySelectorAll('.menu-item').forEach((item) => {
    item.addEventListener('click', () => showView(item.dataset.view));
  });
}
