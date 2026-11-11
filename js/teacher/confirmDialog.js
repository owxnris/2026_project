// 삭제 확인 상자 (design.md 교사 플랫폼 UI 규칙). 삭제를 누르면 true, 취소하면 false.
// okLabel: 확인 버튼 글자 (활동 종료처럼 되돌릴 수 없는 다른 일에도 쓴다)
const $ = (id) => document.getElementById(id);

export function confirmDelete(message, okLabel = '삭제') {
  $('confirm-text').textContent = message;
  $('confirm-ok').textContent = okLabel;
  $('confirm').hidden = false;
  $('confirm-cancel').focus();

  return new Promise((resolve) => {
    function close(result) {
      $('confirm').hidden = true;
      $('confirm-ok').removeEventListener('click', onOk);
      $('confirm-cancel').removeEventListener('click', onCancel);
      document.removeEventListener('keydown', onKey);
      resolve(result);
    }
    function onOk() { close(true); }
    function onCancel() { close(false); }
    function onKey(e) { if (e.key === 'Escape') close(false); }

    $('confirm-ok').addEventListener('click', onOk);
    $('confirm-cancel').addEventListener('click', onCancel);
    document.addEventListener('keydown', onKey);
  });
}
