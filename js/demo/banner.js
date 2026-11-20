// 체험 모드 안내: 화면 오른쪽 아래의 작은 알약 '체험 모드 · 코드 111111'. 누르면 메뉴가 펼쳐진다
// (게임 화면의 안내 줄·버튼을 가리지 않도록 작게 둔다)
import { resetDemo } from './sdk.js';
import { DEMO_CODE } from './seed.js';

const onTeacher = /teacher\.html$/.test(location.pathname);
const FONT = '"Malgun Gothic", sans-serif';
const box = document.createElement('div');
box.id = 'demo-banner';
Object.assign(box.style, {
  position: 'fixed', right: '10px', bottom: '10px', zIndex: '1000', display: 'flex', flexDirection: 'column',
  alignItems: 'flex-end', gap: '6px', font: `13px ${FONT}`,
});

const menu = document.createElement('div');
menu.hidden = true;
Object.assign(menu.style, {
  background: 'rgba(43, 58, 103, 0.97)', color: '#fff', borderRadius: '12px', padding: '10px 12px',
  boxShadow: '0 2px 10px rgba(0,0,0,0.3)', maxWidth: '260px', lineHeight: '1.5',
});
menu.innerHTML = `
  <div style="margin-bottom:8px">이 브라우저에만 저장되는 체험이에요. 학생 참여 코드는 <b>${DEMO_CODE}</b>, 선생님은 '로그인'만 누르면 돼요.</div>`;
const pill = document.createElement('button');
pill.type = 'button';
pill.textContent = `체험 모드 · 코드 ${DEMO_CODE} ▾`;

const btnStyle = {
  display: 'block', width: '100%', margin: '4px 0 0', color: '#1B1F2A', background: '#FFD54F', border: 'none',
  borderRadius: '999px', padding: '5px 10px', font: `bold 12px ${FONT}`, cursor: 'pointer', textAlign: 'center', textDecoration: 'none',
};
function action(label, onClick, href) {
  const el = document.createElement(href ? 'a' : 'button');
  if (href) { el.href = href; el.target = '_blank'; el.rel = 'noopener'; } else el.type = 'button';
  el.textContent = label;
  Object.assign(el.style, btnStyle);
  if (onClick) el.addEventListener('click', onClick);
  menu.appendChild(el);
}
action(onTeacher ? '학생 화면 새 탭으로 열기' : '교사 화면 새 탭으로 열기', null, onTeacher ? 'index.html?demo=1' : 'teacher.html?demo=1'); // 새 탭도 체험 모드로
action('처음부터 다시', () => {
  if (!window.confirm('체험 데이터를 처음 상태로 되돌릴까요? 이 브라우저에서 만든 체험 기록이 지워져요.')) return;
  resetDemo();
  location.reload();
});
action('체험 끝내기', () => {
  try { sessionStorage.removeItem('dd.demo'); localStorage.removeItem('dd.demo'); } catch { /* 무시 */ }
  location.href = location.pathname; // ?demo 없이 다시 열기 → 실제 서비스
});

Object.assign(pill.style, {
  border: 'none', borderRadius: '999px', padding: '6px 12px', background: 'rgba(43, 58, 103, 0.95)', color: '#fff',
  font: `bold 13px ${FONT}`, cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
});
pill.addEventListener('click', () => {
  menu.hidden = !menu.hidden;
  pill.textContent = `체험 모드 · 코드 ${DEMO_CODE} ${menu.hidden ? '▾' : '▴'}`;
});
box.append(menu, pill);
// 교사 로그인 버튼: 체험 모드에서는 Google 창 없이 체험 선생님으로 들어간다는 것을 글자로 알린다
const relabel = () => { const btn = document.getElementById('login-btn'); if (btn) btn.textContent = '체험 선생님으로 들어가기 (Google 로그인 아님)'; };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', relabel); else relabel();
const attach = () => document.body.appendChild(box);
if (document.body) attach(); else document.addEventListener('DOMContentLoaded', attach);
