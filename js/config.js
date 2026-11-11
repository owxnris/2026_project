// design.md의 색·글자 규칙과 spec.md의 수치를 한곳에 모은다.

export const COLORS = {
  bg: 0x1B1F2A,
  player: 0xF5F5F5,
  obstacle: 0x9C6ADE,
  good: 0xFFD54F,
  bad: 0xFF5252,
};

export const CSS = {
  bg: '#1B1F2A',
  player: '#F5F5F5',
  obstacle: '#9C6ADE',
  good: '#FFD54F',
  bad: '#FF5252',
};

export const FONT = '"Malgun Gothic", sans-serif';
export const SIZE = { big: '48px', body: '24px', small: '16px' };

export const LAYOUT = { W: 960, H: 540, HUD_H: 60, GUIDE_H: 40 };

export const RULES = {
  TOTAL_TIME_SEC: 300, // [임시] 교사 플랫폼 전까지 쓰는 기본값
  ENTRY_QUIZ_COUNT: 3,
  QUIZ_TIME_SEC: 15,
  COIN_PER_CORRECT: 10,
  HIT_COIN_LOSS: 10, // [임시] spec에서 [미정]
};

export const PHYS = {
  GRAVITY: 1200,
  MOVE_SPEED: 220,
  JUMP_SPEED: 520,
  DASH_SPEED: 450, // 너무 빠르지 않게, 구현 후 조정
  DASH_MS: 250,
  HIT_INVULN_MS: 1000,
  HIT_STUN_MS: 300,
};

// 능력 (spec.md 능력 구매). 가격은 js/grading.js ABILITY_PRICE와 같아야 한다
export const ABILITIES = [
  { key: 'dash', name: '대시', price: 10, effect: '짧게 빠르게 이동 (Shift). 산 횟수만큼 쓸 수 있어요', repeat: true },
  { key: 'shield', name: '보호막', price: 15, effect: '장애물 충돌 1번을 막아 줘요' },
  { key: 'doubleJump', name: '이단 점프', price: 20, effect: '공중에서 Space를 한 번 더 눌러 점프해요' },
];

export const GUIDE_TEXT = '←→ 이동 · Space 점프 · 능력은 입장 퀴즈 뒤에 코인으로 사요';

