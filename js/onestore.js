// 원스토어 H5 게임 SDK 기본 연동 (spec.md '출시', 2026-11-25). 광고·결제는 넣지 않는다.
// SDK는 index.html 맨 앞의 <script type="module">이 게임 코드·Phaser보다 먼저 불러온다 (window.ONEstoreH5).
// - 원스토어 앱(안드로이드 WebView) 안: initializeAsync → 로딩 진행률(setLoadingProgress) → startGameAsync 뒤에 시작 화면
// - 일반 브라우저(GitHub Pages·Live Server): initializeAsync 결과에 err → 지금처럼 바로 시작
// - SDK 파일을 못 불러왔을 때(학교망 차단 등)도 일반 브라우저와 같다
// 공식 안내: https://onestore-dev.gitbook.io/dev/tools/web-sdk
import { setMusicPaused } from './music.js';
import { setSoundPaused } from './sound.js';

let sdk = null;
let inApp = false; // 원스토어 앱 안에서 초기화에 성공했는지
let progress = 0; // 마지막 로딩 진행률 (0~100)
let initDone = Promise.resolve(false);

function report() {
  if (inApp) sdk.setLoadingProgress(progress);
}

// main.js가 게임을 만든 직후 부른다. 앱이 백그라운드로 가거나(background) 할 때 게임과 소리를 멈추고, 돌아오면 다시 시작
export function setupOneStore(game) {
  sdk = typeof window !== 'undefined' ? window.ONEstoreH5 ?? null : null;
  if (!sdk) return; // SDK를 못 불러옴 → 일반 브라우저처럼
  // 이벤트는 초기화 직후 바로 올 수 있으므로 initializeAsync 전에 등록한다
  sdk.on('pause', () => {
    game.pause();
    setMusicPaused(true);
    setSoundPaused(true);
  });
  sdk.on('resume', () => {
    game.resume();
    setMusicPaused(false);
    setSoundPaused(false);
  });
  initDone = sdk.initializeAsync()
    .then((info) => {
      if (info?.err) return false; // 원스토어 앱이 아님 (일반 브라우저) → SDK 없이 그대로
      inApp = true;
      report();
      return true;
    })
    .catch((e) => {
      console.warn('원스토어 SDK 초기화 실패 — SDK 없이 시작해요', e?.reason ?? e);
      return false;
    });
}

// 그림 로딩 진행률 (BootScene, 0~1)
export function reportLoading(ratio) {
  progress = Math.max(progress, Math.min(100, Math.round(ratio * 100)));
  report();
}

// 시작 화면으로 가도 되는지: 앱이면 진행률 100 → startGameAsync가 끝난 뒤, 아니면 바로
export async function platformReady() {
  if (!(await initDone)) return;
  progress = 100;
  report();
  try {
    await sdk.startGameAsync();
  } catch (e) {
    console.warn('원스토어 startGameAsync 실패 — 그대로 시작해요', e?.reason ?? e);
  }
}
