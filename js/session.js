// 학생이 참여한 학급과 활동. Firebase 설정값이 없으면 online이 false이고, 예전처럼 questions.json으로 혼자 플레이한다.
import { isConfigured } from './firebase/app.js';
import { watchActivity } from './firebase/student.js';

export const session = {
  online: isConfigured,
  classId: null,
  className: '',
  nickname: '',
  activityId: null,
  ended: false, // 교사가 활동을 종료했으면 true
};

let stopEnd = null;

export function setClass({ classId, className, nickname }) {
  Object.assign(session, { classId, className, nickname });
}

// 진행 중 활동에 들어간다. 교사가 종료하면 session.ended가 true가 된다 (state.js checkTimeout이 본다)
export function enterActivity(activityId) {
  leaveActivity();
  session.activityId = activityId;
  session.ended = false;
  stopEnd = watchActivity(session.classId, activityId, (a) => {
    if (!a || a.status === 'ended') session.ended = true;
  });
}

export function leaveActivity() {
  if (stopEnd) stopEnd();
  stopEnd = null;
  session.activityId = null;
  session.ended = false;
}
