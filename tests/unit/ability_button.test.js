import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertDeepEqual } from '../helpers/assert.js';
import { bindAbilityButton } from '../../src/ui/ability_button.js';

function setup() {
  const button = new EventTarget();
  button.setPointerCapture = () => {};
  button.releasePointerCapture = () => {};
  const calls = [];
  const input = {
    targetingState: null,
    triggerAbility(slot, options) {
      calls.push(['trigger', slot, options]);
      if (!options.quickCast) this.targetingState = { slot };
      return true;
    },
    aimAbilityFromStick(dx, dy) { calls.push(['aim', dx, dy]); },
    confirmCast() { calls.push(['confirm']); this.targetingState = null; },
    cancelTargeting() { calls.push(['cancel']); this.targetingState = null; }
  };
  const cleanup = bindAbilityButton(button, input, 'Q');
  const emit = (type, props = {}) => button.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), props));
  const touch = (type, x = 20, y = 20, id = 2) => emit(type, { pointerType: 'touch', pointerId: id, clientX: x, clientY: y, isPrimary: false });
  return { button, input, calls, cleanup, emit, touch };
}

describe('Ability buttons support quick touch casts and drag aiming', () => {
  it('A secondary finger tap casts once and suppresses the compatibility click', () => {
    const b = setup();
    b.touch('pointerdown'); b.touch('pointerup');
    b.emit('click', { pointerType: 'touch', detail: 1 });
    assertDeepEqual(b.calls, [['trigger', 'Q', { autoAim: true, quickCast: true }]]);
    b.cleanup();
  });

  it('Dragging previews and aims before casting only on release', () => {
    const b = setup();
    b.touch('pointerdown'); b.touch('pointermove', 70, 40);
    assertDeepEqual(b.calls, [
      ['trigger', 'Q', { autoAim: true, previewOnly: true }], ['aim', 50, 20]
    ]);
    b.touch('pointerup', 70, 40);
    assertEqual(b.calls.filter(call => call[0] === 'confirm').length, 1);
    b.cleanup();
  });

  it('Returning a drag to its starting point cancels without casting', () => {
    const b = setup();
    b.touch('pointerdown'); b.touch('pointermove', 70, 40); b.touch('pointermove', 22, 22);
    b.touch('pointerup', 22, 22);
    assertEqual(b.calls.filter(call => call[0] === 'confirm').length, 0);
    assertEqual(b.calls.at(-1)[0], 'cancel');
    b.cleanup();
  });

  it('Pointer cancellation never casts and clears the gesture preview', () => {
    const b = setup();
    b.touch('pointerdown'); b.touch('pointermove', 70, 40); b.touch('pointercancel', 70, 40);
    b.touch('pointerup', 70, 40); b.emit('click', { pointerType: 'touch', detail: 1 });
    assertEqual(b.calls.filter(call => call[0] === 'confirm').length, 0);
    assertEqual(b.calls.at(-1)[0], 'cancel');
    b.cleanup();
  });

  it('Other touch pointers cannot take over or release a skill gesture', () => {
    const b = setup();
    b.touch('pointerdown'); b.touch('pointerdown', 20, 20, 3); b.touch('pointerup', 20, 20, 3);
    assertEqual(b.calls.length, 0);
    b.touch('pointerup');
    assertEqual(b.calls.length, 1);
    b.cleanup();
  });

  it('Keyboard and mouse clicks open an assisted preview', () => {
    const b = setup();
    b.emit('click', { detail: 0 });
    b.emit('click', { detail: 1, pointerType: 'mouse' });
    assertDeepEqual(b.calls, [
      ['trigger', 'Q', { autoAim: true }], ['trigger', 'Q', { autoAim: true }]
    ]);
    b.cleanup();
  });

  it('Failed ability validation cannot confirm an unrelated targeting state', () => {
    const b = setup();
    b.input.triggerAbility = () => false;
    b.input.targetingState = { slot: 'W' };
    b.touch('pointerdown'); b.touch('pointermove', 70, 40); b.touch('pointerup', 70, 40);
    assertEqual(b.calls.length, 0);
    assertEqual(b.input.targetingState.slot, 'W');
    b.cleanup();
  });

  it('Releasing an invalid unit target clears the drag preview without casting', () => {
    const b = setup();
    b.input.confirmCast = () => false;
    b.touch('pointerdown'); b.touch('pointermove', 70, 40); b.touch('pointerup', 70, 40);
    assertEqual(b.input.targetingState, null);
    assertEqual(b.calls.at(-1)[0], 'cancel');
    b.cleanup();
  });

  it('Cleanup removes listeners and cancels a pending drag', () => {
    const b = setup();
    b.touch('pointerdown'); b.touch('pointermove', 70, 40); b.cleanup();
    assertEqual(b.calls.at(-1)[0], 'cancel');
    const count = b.calls.length;
    b.touch('pointerup', 70, 40); b.emit('click', { detail: 0 });
    assertEqual(b.calls.length, count);
  });

  it('Lost capture cancels a drag and release cannot cast afterward', () => {
    const b = setup();
    b.touch('pointerdown'); b.touch('pointermove', 70, 40);
    b.emit('lostpointercapture', { pointerId: 2 }); b.touch('pointerup', 70, 40);
    assertEqual(b.calls.at(-1)[0], 'cancel');
    assertEqual(b.calls.filter(call => call[0] === 'confirm').length, 0);
    b.cleanup();
  });

  it('Window interruption cancels the preview and cleanup removes global listeners', () => {
    const previousWindow = globalThis.window;
    const fakeWindow = new EventTarget();
    globalThis.window = fakeWindow;
    try {
      const b = setup();
      b.touch('pointerdown'); b.touch('pointermove', 70, 40);
      fakeWindow.dispatchEvent(new Event('blur'));
      b.touch('pointerup', 70, 40);
      assertEqual(b.calls.at(-1)[0], 'cancel');
      assertEqual(b.calls.filter(call => call[0] === 'confirm').length, 0);
      b.cleanup();
      const count = b.calls.length;
      fakeWindow.dispatchEvent(new Event('resize'));
      assertEqual(b.calls.length, count);
    } finally {
      if (previousWindow === undefined) delete globalThis.window;
      else globalThis.window = previousWindow;
    }
  });
});
