/** Activate secondary touch pointers too; browsers only synthesize click reliably for the primary finger. */
export function enableTouchActivation(button, listen) {
  if (!button) return;
  let pointerId = null;
  let lastTouchUp = -Infinity;
  listen(button, 'pointerdown', event => {
    if (event.pointerType === 'touch') pointerId = event.pointerId;
  });
  listen(button, 'pointercancel', () => { pointerId = null; });
  listen(button, 'pointerup', event => {
    if (event.pointerType !== 'touch' || event.pointerId !== pointerId) return;
    pointerId = null;
    const rect = button.getBoundingClientRect?.();
    if (rect && Number.isFinite(event.clientX) && Number.isFinite(event.clientY) &&
      (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) return;
    lastTouchUp = performance.now();
    event.preventDefault();
    button.click();
  });
  // The explicit activation above is also followed by a compatibility click on some browsers.
  listen(button, 'click', event => {
    if ((event.pointerType === 'touch' || event.detail > 0) && performance.now() - lastTouchUp < 700) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, { capture: true });
}
