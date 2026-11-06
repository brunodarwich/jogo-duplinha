import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertFalse, assertTrue } from '../helpers/assert.js';
import { HelpUI, resolveReducedMotion } from '../../src/ui/help_ui.js';

describe('Guide preferences', () => {
  it('Uses system motion preference until the player makes an explicit choice', () => {
    assertTrue(resolveReducedMotion(null, true));
    assertFalse(resolveReducedMotion('false', true));
    assertTrue(resolveReducedMotion('true', false));
    assertFalse(resolveReducedMotion(null, false));
  });

  it('Motion setting removes shake without changing simulation or hiding indicators', () => {
    let shake = true;
    const simulation = { camera: { setShakeEnabled: value => { shake = value; } }, renderer: {}, matchTime: 27 };
    const help = new HelpUI(simulation);
    help.setReducedMotion(true, false);
    assertFalse(shake);
    assertTrue(simulation.renderer.reducedMotion);
    assertEqual(simulation.matchTime, 27);
    help.setReducedMotion(false, false);
    assertTrue(shake);
  });

  it('Skipping the guide persists completion and it remains manually reopenable', () => {
    const previousWindow = globalThis.window;
    const memory = new Map();
    globalThis.window = { localStorage: { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) } };
    try {
      const help = new HelpUI({});
      let opens = 0;
      help.open = () => { opens++; };
      help.showFirstRun();
      assertEqual(opens, 1);
      help.dialog = { open: true, close() { this.open = false; } };
      help.close();
      help.showFirstRun();
      assertEqual(opens, 1);
      help.open();
      assertEqual(opens, 2);
    } finally {
      if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    }
  });
});
