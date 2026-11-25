# 에셋 출처와 라이선스

게임에 쓰는 그림·음악·글꼴은 모두 무료이고 상업적 이용이 가능하다. 그림과 음악은 CC0(퍼블릭 도메인)이라 표기 의무는 없지만 감사의 뜻으로 적는다. (받은 날: 그림 2026-11-12, 음악 2026-11-18)

| 에셋 | 만든 이 | 라이선스 | 받은 곳 (2026-11-12) | 프로젝트 파일 | 쓰는 곳 |
|---|---|---|---|---|---|
| Tiny Dungeon 1.0 | Kenney (www.kenney.nl) | CC0 1.0 | https://opengameart.org/content/tiny-dungeon | assets/kenney/tiny-dungeon.png (Tilemap/tilemap_packed.png), License-tiny-dungeon.txt | 주인공 말랑이, 몬스터, 벽·돌판·문·장식, 물약·방패 |
| Pixel Platformer 1.2 | Kenney | CC0 1.0 | https://opengameart.org/content/pixel-platformer-0 | assets/kenney/pixel-platformer.png (Tilemap/tilemap_packed.png), License-pixel-platformer.txt | 풀·흙 발판, 코인, 깃발, 자물쇠 |
| UI Pack - Pixel Adventure 2.0 | Kenney | CC0 1.0 | https://opengameart.org/content/ui-pack-pixel-adventure | assets/kenney/ui-pixel.png (Small tiles/Thick outline/tilemap_packed.png), License-ui-pack-pixel-adventure.txt | 버튼·패널·리본 |
| The Old Tower Inn (배경 음악) | RandomMind | CC0 1.0 | https://opengameart.org/content/chiptune-medieval-the-old-tower-inn | assets/music/old-tower-inn.mp3 | 시작·참여·대기 화면 |
| Chiptune Adventures 1·2·3·4 (배경 음악) | Juhani Junkala (SubspaceAudio) | CC0 1.0 | https://opengameart.org/content/4-chiptunes-adventure | assets/music/stage-1.mp3(숲), boss-fight.mp3(광산), stage-2.mp3(성), stage-select.mp3(월드맵·퀴즈·상점·결과), INFO-juhani-junkala.txt(라이선스 원문) | 던전·월드맵 |
| Galmuri 2.40.3 (픽셀 한글 글꼴) | quiple (Minseo Lee) | SIL Open Font License 1.1 | jsDelivr CDN `galmuri@2.40.3` (index.html에서 불러옴, 파일은 넣지 않음) | - | 게임 화면 글자 |

- 직접 만든 그림: 결과 화면 별(js/art.js STAR, 16px 픽셀 그림)과 주인공 눈 감은 그림(Tiny Dungeon 108번을 고쳐 만듦), 입자 점. 모두 이 프로젝트 코드 안에서 만든다
- Kenney 라이선스 원문은 assets/kenney/License-*.txt에 그대로 두었다
- 그림을 바꾸거나 더할 때는 이 표에 출처와 라이선스를 먼저 적는다. CC0이 아니면 상업적 이용·재배포 조건을 확인하고 적는다

## 원스토어 등록 이미지 (2026-11-25)
- store/graphic_1024x578.png: 새 그림 없이 게임에 쓰는 Kenney 그림(Tiny Dungeon·Pixel Platformer, CC0)과 Galmuri 글꼴(SIL OFL 1.1)을 store/graphic.html(캔버스)로 배치해 헤드리스 크롬으로 1024×578 캡처
- store/icon_512.png: 같은 방법(store/icon.html) — 말랑이(Tiny Dungeon 108번)·코인(Pixel Platformer 151번)·벽돌, 글자 없음
- store/screenshot_1~6.png: 실제 게임 화면을 헤드리스 크롬으로 960×540(16:9) 캡처
- store/gameplay.mp4: 실제 게임을 자동으로 플레이하며(tests/browser/video.html) 캔버스를 WebCodecs(H.264)로 인코딩하고 mp4-muxer(MIT, jsDelivr CDN)로 MP4로 묶음 — 34초, 소리 없음

