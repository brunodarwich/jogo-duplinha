import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertCloseTo, assertTrue, assertFalse } from '../helpers/assert.js';
import { applyDamage } from '../../src/combat/combat.js';
import { HeroEntity } from '../../src/entities/entity.js';
import { MinionUnit, MinionProjectile } from '../../src/world/minion.js';
import { DefensiveTower, TowerProjectile } from '../../src/world/tower.js';
import { SupremeBoss, StoneColossusBoss, AbyssalBehemothBoss, NexusGuardianBoss } from '../../src/world/boss.js';

describe('Runtime unified damage and lifecycle', () => {
  it('mitigates once, absorbs a barrier once and cancels recall on a real hero', () => {
    const hero = new HeroEntity({ hp: 1000, maxHp: 1000, armor: 100, barrier: 20 });
    hero.isRecalling = true;
    const result = applyDamage(hero, { sourceId: 'attacker', amount: 100, type: 'physical' });
    assertEqual(hero.hp, 970);
    assertEqual(hero.barrier, 0);
    assertEqual(result.finalDamage, 50);
    assertEqual(result.actualDamageDealt, 30);
    assertEqual(hero.lastDamagerId, 'attacker');
    assertFalse(hero.isRecalling);
  });

  it('calls the lethal hero lifecycle once and ignores malformed or repeated damage', () => {
    const hero = new HeroEntity({ hp: 40, maxHp: 100, level: 1 });
    const result = applyDamage(hero, { sourceId: 'attacker', amount: 100, type: 'true' });
    assertTrue(result.wasLethal);
    assertEqual(result.killerId, 'attacker');
    assertEqual(hero.respawnTimer, 5);
    assertEqual(hero.hp, 0);
    assertFalse(applyDamage(hero, { amount: 100 }).wasLethal);
    assertEqual(hero.respawnTimer, 5);
    hero.bountyAwarded = true;
    hero.xpAwarded = true;
    hero.skillSpeedBonus = 100;
    hero.skillSpeedRemaining = 4;
    hero.shroudRemaining = 4;
    hero.isUntargetableFlag = true;
    hero.respawn();
    assertFalse(hero.bountyAwarded);
    assertFalse(hero.xpAwarded);
    assertEqual(hero.skillSpeedBonus, 0);
    assertEqual(hero.shroudRemaining, 0);
    assertFalse(hero.isUntargetableFlag);
    const alive = { hp: 100, armor: 0 };
    for (const amount of [NaN, Infinity, -50]) {
      assertEqual(applyDamage(alive, { amount }).actualDamageDealt, 0);
      assertEqual(alive.hp, 100);
    }
  });

  it('respects structure hierarchy and both forms of guardian shield', () => {
    const outer = new DefensiveTower({ id: 'outer', tier: 'outer', hp: 100 });
    const inner = new DefensiveTower({ id: 'inner', tier: 'inner', parentTower: outer, hp: 100 });
    assertEqual(applyDamage(inner, { amount: 100, type: 'true' }).actualDamageDealt, 0);
    assertEqual(inner.hp, 100);
    for (const boss of [new SupremeBoss(), new NexusGuardianBoss()]) {
      boss.shieldActive = true;
      const previous = boss.hp;
      assertEqual(applyDamage(boss, { amount: 100, type: 'true' }).actualDamageDealt, 0);
      assertEqual(boss.hp, previous);
    }
  });

  it('minion melee and projectile damage respect hero armor', () => {
    const hero = new HeroEntity({ id: 'target', team: 'enemy', x: 510, y: 500, hp: 1000, maxHp: 1000, armor: 100 });
    const melee = new MinionUnit({ team: 'allied', x: 500, y: 500, attackDamage: 100 });
    melee.update(0.1, [hero]);
    assertEqual(hero.hp, 950);
    const projectile = new MinionProjectile({ sourceId: 'ranged', team: 'allied', x: hero.x, y: hero.y, target: hero, damage: 100 });
    projectile.update(1);
    assertEqual(hero.hp, 900);
    projectile.update(1);
    assertEqual(hero.hp, 900);
  });

  it('tower projectiles preserve colossus reduction and apply armor only once', () => {
    const boss = new StoneColossusBoss({ x: 500, y: 500 });
    const previous = boss.hp;
    const projectile = new TowerProjectile({ sourceId: 'tower', team: 'allied', x: boss.x, y: boss.y, target: boss, damage: 100 });
    projectile.update(1);
    assertCloseTo(previous - boss.hp, 100 * 0.6 * (100 / 140));
  });

  it('boss direct attacks and persistent hazards use physical and magical mitigation', () => {
    const hero = new HeroEntity({ team: 'allied', x: 2800, y: 2800, hp: 1000, maxHp: 1000, armor: 100, magicResist: 100 });
    const guardian = new NexusGuardianBoss({ x: 2800, y: 2800 });
    guardian.update(0.1, [hero]);
    assertEqual(hero.hp, 940);
    const behemoth = new AbyssalBehemothBoss({ x: 2800, y: 2800 });
    behemoth.acidTimer = 0;
    let pool;
    behemoth.update(0.1, [hero], { addHazard(hazard) { pool = hazard; } });
    pool.update(0.5);
    assertEqual(hero.hp, 930);
  });
});
