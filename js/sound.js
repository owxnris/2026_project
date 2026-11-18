// 효과음 (design.md 그래픽 방향): 파일 없이 브라우저(Web Audio)에서 짧은 소리를 만든다.
// 기본은 켜짐(사용자 요청, 2026-11-18) — 시작 화면의 소리 버튼으로 끄고 켜며, 선택은 이 기기에 기억한다(저장이 막혀도 게임은 그대로).
// 배경 음악(music.js)도 이 설정을 따른다.
const KEY = 'dungeonDash.sound';
const VOLUME = 0.1; // 교실에서 거슬리지 않을 만큼

let on = true;
try { on = localStorage.getItem(KEY) !== 'off'; } catch { /* 저장소를 못 쓰면 켜진 채로 */ }

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

// 브라우저는 사용자가 직접 누르는 순간에만 소리 장치를 켜 준다 (터치 기기는 손을 뗄 때(touchend), 키보드는 키를 누를 때).
// 예전에는 첫 입력 한 번만, 그것도 소리가 켜져 있을 때만 깨워서 — 버튼으로 켠 뒤에는 장치가 잠든 채로 남아 소리가 안 날 수 있었다.
// 이제 매 입력마다 깨운다. 장치를 켜기만 하고 소리는 내지 않으므로 소리가 꺼져 있어도 상관없다
if (typeof window !== 'undefined') {
  const wake = () => { audio(); };
  ['pointerdown', 'touchend', 'keydown'].forEach((t) => window.addEventListener(t, wake, { capture: true, passive: true }));
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
