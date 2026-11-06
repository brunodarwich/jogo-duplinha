/** Accessible camera controls. Uses the same smoothed camera as mouse-wheel zoom. */
export function setupZoomControls(camera, canvas) {
  const panel = document.getElementById('zoom-controls');
  if (!panel) return;
  const slider = panel.querySelector('input');
  const output = panel.querySelector('output');
  const minus = panel.querySelector('[data-zoom="out"]');
  const plus = panel.querySelector('[data-zoom="in"]');
  const reset = panel.querySelector('[data-zoom="reset"]');
  slider.min = camera.minZoom;
  slider.max = camera.maxZoom;
  const sync = () => {
    slider.value = camera.targetZoom;
    output.textContent = `${Math.round(camera.targetZoom * 100)}%`;
    minus.disabled = camera.targetZoom <= camera.minZoom + 0.001;
    plus.disabled = camera.targetZoom >= camera.maxZoom - 0.001;
  };
  minus.onclick = () => { camera.zoomBy(-0.1); sync(); };
  plus.onclick = () => { camera.zoomBy(0.1); sync(); };
  reset.onclick = () => { camera.setZoom(1.25); sync(); };
  slider.oninput = () => { camera.setZoom(Number(slider.value)); sync(); };
  // InputManager's wheel handler runs first and updates targetZoom.
  canvas.addEventListener('wheel', sync);
  const stop = event => event.stopPropagation();
  const events = ['pointerdown', 'pointermove', 'keyup', 'keydown', 'wheel'];
  for (const name of events) panel.addEventListener(name, stop);
  sync();
  return () => {
    canvas.removeEventListener('wheel', sync);
    for (const name of events) panel.removeEventListener(name, stop);
    minus.onclick = plus.onclick = reset.onclick = slider.oninput = null;
  };
}
