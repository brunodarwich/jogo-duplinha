import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertCloseTo, assertTrue, assertFalse } from '../helpers/assert.js';
import { Entity, HeroEntity } from '../../src/entities/entity.js';
import { MinionUnit, MinionAIState } from '../../src/world/minion.js';

const NOW = 10000;

describe('Runtime crowd control and effective movement', () => {
  it('stun and root suspend a queued hero move, then permit it to resume', () => {
    for (const effect of ['stunnedUntil', 'rootedUntil']) {
      const hero = new HeroEntity({ x: 0, y: 0, speed: 100, hpRegen: 0, manaRegen: 0 });
      hero[effect] = NOW + 1000;
      hero.moveTo(1000, 0);
      hero.update(0.1, NOW);
      assertEqual(hero.x, 0, effect);
      assertEqual(hero.vx, 0);
      assertFalse(hero.isMoving);
      hero.update(0.1, NOW + 1001);
      assertCloseTo(hero.x, 10);
      assertTrue(hero.isMoving);
    }
  });

  it('slow scales actual movement including a temporary bonus without mutating speed', () => {
    const entity = new Entity({ x: 0, y: 0, speed: 100, hpRegen: 0 });
    entity.skillSpeedBonus = 40;
    entity.slowedUntil = NOW + 1000;
    entity.slowPercentage = 0.5;
    entity.moveTo(1000, 0);
    entity.update(0.1, NOW);
    assertCloseTo(entity.x, 7);
    assertEqual(entity.speed, 100);
    entity.update(0.1, NOW + 1001);
    assertCloseTo(entity.x, 21);
    assertEqual(entity.slowPercentage, 0);
    assertEqual(entity.speed, 100);
  });

  it('silence does not stop walking and death clears movement effects', () => {
    const hero = new HeroEntity({ x: 0, y: 0, speed: 100 });
    hero.silencedUntil = NOW + 1000;
    hero.moveTo(1000, 0);
    hero.update(0.1, NOW);
    assertCloseTo(hero.x, 10);
    hero.slowedUntil = NOW + 2000;
    hero.slowPercentage = 0.7;
    hero.stunnedUntil = NOW + 1000;
    hero.takeDamage(100000);
    assertEqual(hero.stunnedUntil, 0);
    assertEqual(hero.slowedUntil, 0);
    assertEqual(hero.slowPercentage, 0);
    assertEqual(hero.targetX, null);
  });

  it('idle expiry clears stale slow strength and a full slow cannot snap to a nearby target', () => {
    const entity = new Entity({ x: 0, y: 0, speed: 100 });
    entity.slowedUntil = NOW + 10;
    entity.slowPercentage = 0.8;
    entity.update(0.1, NOW + 20);
    assertEqual(entity.slowPercentage, 0);
    entity.slowedUntil = NOW + 1000;
    entity.slowPercentage = 1;
    entity.moveTo(1, 0);
    entity.update(0.1, NOW);
    assertEqual(entity.x, 0);
  });

  it('each minion type stops under stun and resumes its lane with slow expiring', () => {
    for (const subType of ['melee', 'ranged', 'cannon']) {
      const minion = new MinionUnit({ subType, team: 'allied', x: 500, y: 500 });
      minion.stunnedUntil = NOW + 1000;
      minion.update(0.1, [], [], null, NOW);
      assertEqual(minion.x, 500, subType);
      assertEqual(minion.y, 500, subType);
      minion.slowedUntil = NOW + 2000;
      minion.slowPercentage = 0.5;
      minion.update(0.1, [], [], null, NOW + 1001);
      const slowedDistance = Math.hypot(minion.x - 500, minion.y - 500);
      assertCloseTo(slowedDistance, minion.speed * 0.1 * 0.5);
      const previousX = minion.x;
      const previousY = minion.y;
      minion.update(0.1, [], [], null, NOW + 2001);
      assertCloseTo(Math.hypot(minion.x - previousX, minion.y - previousY), minion.speed * 0.1);
      assertEqual(minion.slowPercentage, 0);
    }
  });

  it('stun blocks minion attacks, while root allows an in-range attack', () => {
    const minion = new MinionUnit({ team: 'allied', x: 500, y: 500 });
    const target = new Entity({ id: 'target', team: 'enemy', x: 510, y: 500, hp: 1000, maxHp: 1000 });
    minion.aiState = MinionAIState.ATTACK;
    minion.targetEntity = target;
    minion.stunnedUntil = NOW + 1000;
    minion.update(0.1, [target], [], null, NOW);
    assertEqual(target.hp, 1000);
    minion.rootedUntil = NOW + 2000;
    minion.update(0.1, [target], [], null, NOW + 1001);
    assertTrue(target.hp < 1000);
    assertEqual(minion.x, 500);
  });
});
