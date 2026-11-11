// 참여 화면 (design.md): 참여 코드·닉네임 입력창 2개를 세로로, 입장 버튼(주 버튼). 정보 표시줄 없음
import { CSS, LAYOUT } from '../config.js';
import { joinClass, JoinError } from '../firebase/student.js';
import { setClass } from '../session.js';
import { text, createButton, createInput } from '../ui.js';

const cx = LAYOUT.W / 2;
const NICKNAME_MAX = 10; // firestore.rules 학생 문서 nickname 길이와 같다

export default class JoinScene extends Phaser.Scene {
  constructor() { super('Join'); }

  create() {
    // 입력 중에 Space·Shift가 게임 조작으로 먹히지 않게 키 가로채기를 끈다 (던전에서 켠 것)
    this.input.keyboard.disableGlobalCapture();
    this.events.once('shutdown', () => this.input.keyboard.enableGlobalCapture());
    this.busy = false;

    text(this, cx, 90, '수업 참여', 'body').setOrigin(0.5);
    text(this, cx, 150, '참여 코드', 'small').setOrigin(0.5);
    this.code = createInput(this, cx, 195, { placeholder: '숫자 6자리', inputMode: 'numeric' });
    text(this, cx, 255, '닉네임', 'small').setOrigin(0.5);
    this.nick = createInput(this, cx, 300, { placeholder: '선생님이 알아볼 수 있는 이름 (10자까지)' });
    this.nick.el.maxLength = NICKNAME_MAX;
    this.error = text(this, cx, 350, '', 'small', CSS.bad).setOrigin(0.5);
    this.button = createButton(this, cx, 420, '입장', () => this.submit(), { primary: true });

    [this.code.el, this.nick.el].forEach((el) => el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.submit();
    }));
    this.code.el.focus();
  }

  async submit() {
    if (this.busy) return;
    const code = this.code.value();
    const nickname = this.nick.value();
    this.code.setInvalid(false);
    this.nick.setInvalid(false);
    if (!/^\d{6}$/.test(code)) {
      this.code.setInvalid(true);
      this.error.setText('참여 코드는 숫자 6자리예요.');
      return;
    }
    if (!nickname) {
      this.nick.setInvalid(true);
      this.error.setText('닉네임을 입력해 주세요.');
      return;
    }
    if (nickname.length > NICKNAME_MAX) {
      this.nick.setInvalid(true);
      this.error.setText(`닉네임은 ${NICKNAME_MAX}자까지 쓸 수 있어요.`);
      return;
    }
    this.busy = true;
    this.button.setAlpha(0.4);
    this.error.setText('').setColor(CSS.player);
    this.error.setText('참여하는 중…');
    try {
      setClass(await joinClass(code, nickname));
      this.scene.start('Waiting');
    } catch (e) {
      this.error.setColor(CSS.bad);
      if (e instanceof JoinError) {
        this.code.setInvalid(true);
        this.error.setText(e.message);
      } else {
        this.error.setText(`참여하지 못했어요 — 인터넷 연결을 확인하고 다시 눌러 주세요 (${e.code || e.message})`);
      }
      this.busy = false;
      this.button.setAlpha(1);
    }
  }
}
