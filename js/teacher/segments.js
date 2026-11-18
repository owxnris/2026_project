// 보기 버튼 묶음: [data-seg] 안의 버튼을 누르면 같은 상자 안의 [data-sec-panel] 중 하나만 보인다.
// 긴 분석을 한 화면에 늘어놓지 않고 버튼으로 골라 보게 한다 (교사 결과 탭)
export function setupSegments(root, onChange) {
  const seg = root.querySelector(':scope > [data-seg], [data-seg]');
  const buttons = [...seg.querySelectorAll('[data-sec]')];
  const panels = () => [...root.querySelectorAll('[data-sec-panel]')].filter((p) => p.closest('[data-seg-root]') === root);
  function show(name) {
    buttons.forEach((b) => {
      const on = b.dataset.sec === name;
      b.classList.toggle('current', on);
      b.setAttribute('aria-pressed', String(on));
    });
    panels().forEach((p) => { p.hidden = p.dataset.secPanel !== name; });
    if (onChange) onChange(name);
  }
  buttons.forEach((b) => b.addEventListener('click', () => show(b.dataset.sec)));
  show(buttons[0].dataset.sec);
  return { show };
}
