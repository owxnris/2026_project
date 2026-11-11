// 대기 화면 (design.md): 학급 이름(본문), '선생님이 시작하면 게임이 열려요'(작은 안내). 정보 표시줄 없음
// 학급의 진행 중 활동을 지켜보다가 시작되면(또는 이미 진행 중이면) 그 활동의 종료 시각으로 월드맵을 연다
import { CSS, LAYOUT } from '../config.js';
import { watchRunningActivities } from '../firebase/student.js';
import { serverNow } from '../firebase/clock.js';
import { session, enterActivity } from '../session.js';
import { resetGame, restoreCleared } from '../state.js';
import { loadClearedCount } from '../progress.js';
import { text } from '../ui.js';

const cx = LAYOUT.W / 2;

export default class WaitingScene extends Phaser.Scene {
  constructor() { super('Waiting'); }

  create() {
    this.entering = false;
    text(this, cx, 200, session.className, 'body').setOrigin(0.5);
    text(this, cx, 245, `${session.nickname} · 선생님이 시작하면 게임이 열려요`, 'small').setOrigin(0.5);
    this.error = text(this, cx, 300, '', 'small', CSS.bad).setOrigin(0.5);

    this.stop = watchRunningActivities(session.classId, (list) => {
      this.error.setText('');
      // 종료 시각이 지난 활동은 끝난 것으로 본다
      const a = list.find((x) => x.endAt && x.endAt.toMillis() > serverNow());
      if (!a) return;
      if (this.entering) return;
      this.entering = true;
      enterActivity(a.id);
      resetGame(a.endAt.toMillis());
      // 다시 들어온 학생(새로고침·재접속)은 이 활동에서 깬 던전을 이어서 연다
      loadClearedCount().catch(() => 0).then((n) => {
        restoreCleared(n);
        if (this.scene.isActive()) this.scene.start('WorldMap');
      });
    }, (e) => {
      this.error.setText(`활동 정보를 받지 못했어요 (${e.code || e.message})`);
    });
    this.events.once('shutdown', () => this.stop());
  }
}
