// 배경 음악 (CC0, 출처 assets/CREDITS.md). 화면마다 곡을 정해 이어서 반복한다.
// 효과음과 같은 소리 설정(sound.js)을 따른다 — 소리를 끄면 음악도 멈춘다.
// 브라우저는 사용자가 누르기 전에는 소리를 막으므로, 막히면 다음 클릭·터치·키 입력 때 다시 튼다.
import { soundOn } from './sound.js';

const TRACKS = {
  menu: 'assets/music/old-tower-inn.mp3', // 시작·참여·대기: 아늑한 여관
  map: 'assets/music/stage-select.mp3', // 월드맵·퀴즈·능력 구매·결과
  dungeon0: 'assets/music/stage-1.mp3', // 잊혀진 숲
  dungeon1: 'assets/music/boss-fight.mp3', // 용암 광산 (긴장감)
  dungeon2: 'assets/music/stage-2.mp3', // 얼어붙은 성
};
const VOLUME = 0.3; // 효과음과 퀴즈 글을 가리지 않게

const players = {}; // 곡마다 오디오 하나 (다시 오면 이어서)
let wanted = null; // 지금 화면이 원하는 곡
let current = null; // 지금 재생 중인 오디오

function apply() {
  const next = wanted && soundOn() ? wanted : null;
  if (current && (!next || current !== players[next])) current.pause();
  if (!next) { current = null; return; }
  if (typeof Audio === 'undefined') return;
  if (!players[next]) {
    const a = new Audio(TRACKS[next]);
    a.loop = true;
    a.volume = VOLUME;
    a.preload = 'auto';
    players[next] = a;
  }
  current = players[next];
  if (current.paused) current.play().catch(() => { /* 아직 누르기 전 → 다음 입력 때 다시 */ });
}

// 화면이 바뀔 때 부른다. 같은 곡이면 끊기지 않고 이어진다
export function playMusic(name) {
  wanted = name;
  apply();
}

// 소리 켜기·끄기를 바꾼 뒤 부른다
export function refreshMusic() {
  apply();
}

if (typeof window !== 'undefined') {
  const retry = () => { if (current && current.paused && soundOn()) current.play().catch(() => {}); };
  ['pointerdown', 'touchend', 'keydown'].forEach((t) => window.addEventListener(t, retry, { capture: true, passive: true }));
}
