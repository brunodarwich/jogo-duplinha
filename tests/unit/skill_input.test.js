import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue, assertCloseTo } from '../helpers/assert.js';
import { GameSimulation } from '../../src/game.js';
import { MinionUnit } from '../../src/world/minion.js';
import { worldToScreen } from '../../src/core/isometric.js';

function encounter(heroClass = 'sorceress') {
  const sim = new GameSimulation({ heroClass });
  const hero = sim.playerHero, input = sim.input;
  hero.level = 15;
  for (const ability of Object.values(hero.abilities)) ability.rank = 1;
  const enemy = new MinionUnit({ id: 'aim-enemy', team: 'enemy', x: hero.x + 180, y: hero.y, hp: 10000, maxHp: 10000 });
  sim.entities = [hero, enemy];
  input.entityManager = sim.entities;
  input.setPlayerHero(hero);
  const pointAt = (x, y) => {
    const point = worldToScreen(x, y, 0, sim.camera);
    input.updateCursor(point.sx, point.sy);
  };
  return { sim, hero, input, enemy, pointAt };
}

describe('Assisted skill input in the running game', () => {
  it('casts self skills immediately and clears a previous targeting preview', () => {
    const { hero, input, enemy } = encounter('knight');
    input.triggerAbility('Q');
    assertTrue(!!input.targetingState);
    const mana = hero.mana;
    input.triggerAbility('W');
    assertEqual(input.targetingState, null);
    assertEqual(hero.mana, mana - hero.abilities.W.manaCost);
    assertTrue(enemy.hp < enemy.maxHp);
  });

  it('confirms an assisted preview with the same key a second time', () => {
    const { hero, input, enemy, pointAt } = encounter();
    pointAt(enemy.x, enemy.y);
    input.triggerAbility('Q');
    assertEqual(hero.abilities.Q.cooldownRemaining, 0);
    input.triggerAbility('Q');
    assertTrue(enemy.hp < enemy.maxHp);
    assertEqual(input.targetingState, null);
  });

  it('uses the click position immediately even before the next animation frame', () => {
    const { hero, input, enemy, pointAt } = encounter();
    pointAt(hero.x - 300, hero.y);
    input.triggerAbility('Q');
    const point = worldToScreen(enemy.x, enemy.y, 0, input.camera);
    input.handlePointerDown({ button: 0, pointerType: 'mouse', clientX: point.sx, clientY: point.sy });
    assertTrue(enemy.hp < enemy.maxHp, 'Click must not cast at the previous frame target');
  });

  it('quick casts at the current enemy without needing a canvas tap', () => {
    const { hero, input, enemy } = encounter();
    hero.attackTarget = enemy;
    input.triggerAbility('Q', { autoAim: true, quickCast: true });
    assertTrue(enemy.hp < enemy.maxHp);
    assertEqual(input.targetingState, null);
  });

  it('does not spend mana when a unit-targeted skill has no valid enemy', () => {
    const { hero, input, sim } = encounter('assassin');
    sim.entities = input.entityManager = [hero];
    const mana = hero.mana;
    assertEqual(input.triggerAbility('Q', { autoAim: true, quickCast: true }), false);
    assertEqual(hero.mana, mana);
    assertEqual(hero.abilities.Q.cooldownRemaining, 0);
  });

  it('refreshes validity if the target dies between preview and confirmation', () => {
    const { hero, input, enemy } = encounter('assassin');
    input.triggerAbility('Q', { autoAim: true });
    enemy.hp = 0;
    const mana = hero.mana;
    assertEqual(input.confirmCast(), false);
    assertEqual(hero.mana, mana);
  });

  it('previews the real upgraded mobility range and the chosen distance', () => {
    const { hero, input, pointAt } = encounter();
    hero.abilities.E.rank = 4;
    pointAt(hero.x + 100, hero.y);
    input.triggerAbility('E');
    const indicator = input.getTargetingIndicator();
    assertEqual(indicator.range, 425);
    assertCloseTo(indicator.end.x, hero.x + 100, .001);
    input.confirmCast();
    assertCloseTo(hero.x, 750, .001);
  });

  it('lets a touch drag preview a self skill without spending until release', () => {
    const { hero, input } = encounter('knight');
    const mana = hero.mana;
    input.triggerAbility('W', { previewOnly: true });
    assertTrue(!!input.targetingState);
    assertEqual(hero.mana, mana);
    input.cancelTargeting();
    assertEqual(hero.mana, mana);
  });

  it('maps the ability stick direction through a rotated isometric camera', () => {
    const { hero, input } = encounter('ranger');
    input.camera.rotation = Math.PI / 2;
    input.triggerAbility('Q', { autoAim: true });
    input.aimAbilityFromStick(72, 0);
    const indicator = input.getTargetingIndicator();
    const origin = worldToScreen(hero.x, hero.y, 0, input.camera);
    const end = worldToScreen(indicator.end.x, indicator.end.y, 0, input.camera);
    assertTrue(end.sx > origin.sx);
    assertCloseTo(end.sy, origin.sy, .001);
  });

  it('holding a skill key does not confirm or spend it repeatedly', () => {
    const { hero, input, pointAt, enemy } = encounter();
    pointAt(enemy.x, enemy.y);
    input.handleKeyDown({ key: 'q', code: 'KeyQ' });
    input.handleKeyDown({ key: 'q', code: 'KeyQ', repeat: true });
    assertEqual(hero.abilities.Q.cooldownRemaining, 0);
    assertTrue(!!input.targetingState);
  });

  it('cancels a guest preview locally without sending an invalid network command', () => {
    const { sim, hero, input } = encounter();
    const sent = [];
    sim.isHost = false;
    sim.network = { authoritativeWorld: true, isSoloMode: false, sendCommand: command => sent.push(command) };
    const mana = hero.mana;
    input.triggerAbility('Q');
    input.cancelTargeting();
    assertEqual(input.targetingState, null);
    assertEqual(sent.length, 0);
    assertEqual(hero.mana, mana);
  });
});
