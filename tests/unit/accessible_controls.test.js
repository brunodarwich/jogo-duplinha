import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue } from '../helpers/assert.js';
import { InputManager } from '../../src/core/input.js';
import { escapeLobbyText } from '../../src/ui/lobby_ui.js';
import { HUDController } from '../../src/ui/hud.js';
import { ShopUI } from '../../src/ui/shop_ui.js';

describe('Keyboard control boundaries', () => {
  it('Focused button activation does not also open chat or move the camera', () => {
    const previousDocument = globalThis.document;
    const input = new InputManager();
    const commands = [];
    input.dispatch = command => commands.push(command);
    globalThis.document = { activeElement: { tagName: 'BUTTON' } };
    try {
      input.handleKeyDown({ key: 'Enter' });
      input.handleKeyDown({ key: ' ', code: 'Space' });
      assertEqual(commands.length, 0);
    } finally {
      if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
    }
  });

  it('Unlearned abilities report their state without entering aiming mode', () => {
    const input = new InputManager();
    const errors = [];
    input.playerHeroRef = { hp: 100, mana: 200, abilities: { Q: { rank: 0, manaCost: 50, range: 500 } } };
    input.onSkillError = (slot, reason) => errors.push([slot, reason]);
    input.triggerAbility('Q');
    assertEqual(errors[0][1], 'unlearned');
    assertEqual(input.targetingState, null);
    assertEqual(input.playerHeroRef.mana, 200);
  });

  it('Names from the network are displayed as text, including markup characters', () => {
    const escaped = escapeLobbyText('<img src=x onerror="attack()"> & João');
    assertTrue(escaped.includes('&lt;img'));
    assertTrue(escaped.includes('&quot;'));
    assertTrue(escaped.includes('&amp; João'));
    assertEqual(escaped.includes('<img'), false);
  });

  it('Stopping UI removes listeners attached to persistent controls', () => {
    const control = new EventTarget();
    let activations = 0;
    const hud = new HUDController();
    const shop = new ShopUI({});
    hud.listen(control, 'click', () => activations++);
    shop.listen(control, 'click', () => activations++);
    control.dispatchEvent(new Event('click'));
    assertEqual(activations, 2);
    hud.destroy();
    shop.destroy();
    control.dispatchEvent(new Event('click'));
    assertEqual(activations, 2);
    hud.destroy();
    shop.destroy();
  });
});
