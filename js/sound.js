// 효과음 (design.md 그래픽 방향): 파일 없이 브라우저(Web Audio)에서 짧은 소리를 만든다.
// 기본은 꺼짐 — 시작 화면의 소리 버튼으로 켜고, 선택은 이 기기에 기억한다(저장이 막혀도 게임은 그대로).
const KEY = 'dungeonDash.sound';
const VOLUME = 0.07; // 교실에서 거슬리지 않게 작게

let on = false;
try { on = localStorage.getItem(KEY) === 'on'; } catch { /* 저장소를 못 쓰면 꺼진 채로 */ }

let ctx = null;
function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// 브라우저는 사용자가 누르기 전에는 소리를 막는다 → 첫 클릭·키 입력 때 깨운다
if (typeof window !== 'undefined') {
  const wake = () => { if (on) audio(); };
  window.addEventListener('pointerdown', wake, { once: true });
  window.addEventListener('keydown', wake, { once: true });
}

export function soundOn() { return on; }

export function setSound(next) {
  on = next;
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* 기억만 못 한다 */ }
  if (on) play('coin');
}

// 음 하나: 주파수(Hz)에서 끝 주파수로, 길이(초), 파형, 시작 지연(초)
function tone(c, from, to, dur, type = 'square', delay = 0) {
  const t = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  gain.gain.setValueAtTime(VOLUME, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

const SOUNDS = {
  correct: (c) => { tone(c, 660, 660, 0.09); tone(c, 990, 990, 0.14, 'square', 0.09); }, // 딩동
  wrong: (c) => { tone(c, 220, 140, 0.25, 'triangle'); }, // 낮게 내려감
  coin: (c) => { tone(c, 1320, 1320, 0.06); tone(c, 1760, 1760, 0.1, 'square', 0.06); }, // 코인 사기
  hit: (c) => { tone(c, 180, 60, 0.18, 'sawtooth'); }, // 부딪힘
  clear: (c) => { [523, 659, 784, 1047].forEach((f, i) => tone(c, f, f, 0.14, 'square', i * 0.11)); }, // 도미솔도
};

// 소리 내기: 꺼져 있거나 브라우저가 지원하지 않으면 아무것도 하지 않는다
export function play(name) {
  if (!on) return;
  try {
    const c = audio();
    if (c) SOUNDS[name](c);
  } catch { /* 소리는 게임을 막지 않는다 */ }
}
