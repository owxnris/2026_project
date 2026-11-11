// 오류 코드를 쉬운 말로 바꿔 화면의 빨간 안내에 붙인다. 코드는 문의할 때 쓰도록 뒤에 남긴다.
const TEXT = {
  'permission-denied': '권한이 없어요',
  unavailable: '인터넷 연결이 불안정해요',
  'network-request-failed': '인터넷 연결을 확인해 주세요',
  'deadline-exceeded': '응답이 너무 늦어요',
  'resource-exhausted': '오늘 쓸 수 있는 양을 넘었어요. 내일 다시 하거나 선생님께 알려 주세요',
  unauthenticated: '로그인이 필요해요',
  'not-found': '찾을 수 없어요',
  'failed-precondition': '지금은 할 수 없어요',
  aborted: '요청이 겹쳐서 중단됐어요. 다시 눌러 주세요',
  cancelled: '요청이 취소됐어요',
};

// 예: reasonText(e) → '권한이 없어요 · permission-denied'. 아는 코드가 아니면 코드(또는 메시지)만
export function reasonText(e) {
  const code = String(e?.reason || e?.code || e?.message || 'unknown').replace(/^(firestore|auth)\//, '');
  return TEXT[code] ? `${TEXT[code]} · ${code}` : code;
}
