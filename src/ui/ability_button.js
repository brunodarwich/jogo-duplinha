/** Tap to cast with assistance, or drag from the button to aim and release. */
export function bindAbilityButton(button, input, slot) {
  if (!button) return () => {};
  const listeners = [];
  const listen = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  };
  let gesture = null;
  let lastTouch = -Infinity;
  const ownsPreview = () => gesture?.aiming && input.targetingState?.slot === slot;
  const release = () => {
    const pointerId = gesture?.id;
    gesture = null;
    if (pointerId !== undefined) {
      try { button.releasePointerCapture?.(pointerId); } catch { /* Capture may already be gone. */ }
    }
  };
  const cancel = () => {
    if (!gesture) return;
    lastTouch = performance.now();
    if (ownsPreview()) input.cancelTargeting();
    release();
  };
  const move = event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    gesture.dx = dx; gesture.dy = dy;
    if (!gesture.dragged && Math.hypot(dx, dy) > 12) {
      gesture.dragged = true;
      gesture.aiming = input.triggerAbility(slot, { autoAim: true, previewOnly: true }) === true;
    }
    if (ownsPreview()) input.aimAbilityFromStick(dx, dy);
  };
  const up = event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    lastTouch = performance.now();
    move(event);
    if (!gesture.dragged) input.triggerAbility(slot, { autoAim: true, quickCast: true });
    else if (ownsPreview()) {
      if (Math.hypot(gesture.dx, gesture.dy) <= 12) input.cancelTargeting();
      else if (!input.confirmCast()) input.cancelTargeting();
    }
    release();
  };
  listen(button, 'pointerdown', event => {
    if (event.pointerType !== 'touch' || gesture) return;
    event.preventDefault();
    event.stopPropagation();
    lastTouch = performance.now();
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, dy: 0, dragged: false, aiming: false };
    try { button.setPointerCapture?.(event.pointerId); } catch { /* Window release remains available. */ }
  });
  listen(button, 'pointermove', move);
  listen(button, 'pointerup', up);
  listen(button, 'pointercancel', event => { if (event.pointerId === gesture?.id) cancel(); });
  listen(button, 'lostpointercapture', event => { if (event.pointerId === gesture?.id) cancel(); });
  listen(button, 'click', event => {
    if ((event.pointerType === 'touch' || event.detail > 0) && performance.now() - lastTouch < 700) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    event.stopPropagation();
    input.triggerAbility(slot, { autoAim: true });
  });
  if (typeof window !== 'undefined') {
    listen(window, 'pointerup', up);
    listen(window, 'blur', cancel);
    listen(window, 'resize', cancel);
    listen(window, 'orientationchange', cancel);
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    listen(document, 'visibilitychange', () => { if (document.hidden) cancel(); });
  }
  return () => { cancel(); for (const remove of listeners) remove(); };
}
