import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertFalse, assertTrue } from '../helpers/assert.js';
import { VirtualJoystick } from '../../src/ui/virtual_joystick.js';

function hero() {
  return { id: 'me', team: 'allied', x: 0, y: 0, hp: 100, isAlive: () => true };
}

describe('Touch controls follow combat commands', () => {
  it('Attack without a hostile never spends Q', () => {
    const casts = [], commands = [], messages = [];
    const joystick = Object.create(VirtualJoystick.prototype);
    joystick.gameSim = { playerHero: hero(), entities: [], input: { triggerAbility: slot => casts.push(slot) },
      handleCommand: command => commands.push(command), particles: { addFloatingText: text => messages.push(text) } };
    joystick.handleTouchAttack();
    assertEqual(casts.length, 0);
    assertEqual(commands.length, 0);
    assertTrue(messages.length > 0, 'A failed target acquisition needs feedback');
  });

  it('Attack chooses the nearest living hostile, never an ally', () => {
    const commands = [];
    const joystick = Object.create(VirtualJoystick.prototype);
    joystick.gameSim = { playerHero: hero(), handleCommand: cmd => commands.push(cmd), entities: [
      { id: 'ally', team: 'allied', x: 1, y: 0, hp: 100 },
      { id: 'dead', team: 'enemy', x: 2, y: 0, hp: 0 },
      { id: 'near', team: 'enemy', x: 80, y: 0, hp: 100 },
      { id: 'far', team: 'enemy', x: 150, y: 0, hp: 100 }
    ] };
    joystick.handleTouchAttack();
    assertEqual(commands.length, 1);
    assertEqual(commands[0].type, 'ATTACK_TARGET');
    assertEqual(commands[0].targetId, 'near');
  });

  it('A narrow desktop window is not blocked by an orientation warning', () => {
    const previousWindow = globalThis.window, previousDocument = globalThis.document;
    let hidden = false;
    globalThis.window = { innerWidth: 390, innerHeight: 844, matchMedia: query => ({ matches: query.includes('max-width') }) };
    globalThis.document = { getElementById: () => ({ classList: {
      add: name => { if (name === 'hidden') hidden = true; },
      remove: name => { if (name === 'hidden') hidden = false; }
    } }) };
    try {
      const joystick = Object.create(VirtualJoystick.prototype);
      joystick.checkOrientation();
      assertTrue(hidden);
    } finally {
      if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
      if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
    }
  });

  it('A dismissed portrait recommendation stays dismissed', () => {
    const previousWindow = globalThis.window, previousDocument = globalThis.document;
    let visible = false;
    globalThis.window = { innerWidth: 390, innerHeight: 844, matchMedia: () => ({ matches: true }) };
    globalThis.document = { getElementById: () => ({ classList: {
      add: () => { visible = false; }, remove: () => { visible = true; }
    } }) };
    try {
      const joystick = Object.create(VirtualJoystick.prototype);
      joystick.orientationDismissed = true;
      joystick.checkOrientation();
      assertFalse(visible);
    } finally {
      if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
      if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
    }
  });

  it('The browser tap sequence sends one attack command', () => {
    const previousWindow = globalThis.window;
    const fakeWindow = new EventTarget();
    fakeWindow.matchMedia = () => ({ matches: true });
    fakeWindow.innerWidth = 844;
    globalThis.window = fakeWindow;
    try {
      const commands = [];
      const joystick = Object.create(VirtualJoystick.prototype);
      joystick.listeners = [];
      joystick.container = { classList: { add() {} } };
      joystick.attackBtnEl = new EventTarget();
      joystick.gameSim = { playerHero: hero(), entities: [{ id: 'target', team: 'enemy', x: 10, y: 0, hp: 100 }],
        handleCommand: command => commands.push(command) };
      joystick.bindTouchEvents();
      joystick.attackBtnEl.dispatchEvent(new Event('pointerdown'));
      joystick.attackBtnEl.dispatchEvent(new Event('touchstart'));
      joystick.attackBtnEl.dispatchEvent(new Event('click'));
      assertEqual(commands.length, 1);
      joystick.listeners.forEach(remove => remove());
    } finally {
      if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    }
  });
});
