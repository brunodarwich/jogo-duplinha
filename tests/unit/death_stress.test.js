import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertCloseTo, assertTrue, assertFalse } from '../helpers/assert.js';
import { resolveModule } from '../helpers/module_resolver.js';

describe('Tier 1 Unit: Adversarial Stress Testing — Hero Death & Resurrection Lifecycle', () => {
  it('TC-CHALLENGE-01: Overkill damage and repeated lethal damage while dead preserve state invariants', async () => {
    const { module: entityMod } = await resolveModule('entities/entity');
    const hero = new entityMod.HeroEntity({ heroId: 'knight', hp: 680, maxHp: 680, level: 1 });

    // Massive overkill damage
    const dealt = hero.takeDamage(1_000_000, 'physical');
    assertEqual(hero.hp, 0, 'HP must clamp to 0 upon lethal damage');
    assertTrue(hero.isDead, 'Hero must be flagged dead');
    assertFalse(hero.isAlive(), 'Hero isAlive() must be false');
    assertEqual(hero.respawnTimer, 5.0, 'Respawn timer at level 1 must be 5.0s');

    // Repeated hits in quick succession while dead
    const hits = [500, 1000, 50000, Infinity];
    for (const h of hits) {
      const secondaryDealt = hero.takeDamage(h, 'physical');
      assertEqual(secondaryDealt, 0, 'Damage dealt to dead hero must be 0');
      assertEqual(hero.hp, 0, 'HP must remain 0');
      assertTrue(hero.isDead, 'Hero must remain dead');
      assertEqual(hero.respawnTimer, 5.0, 'Respawn timer must not reset on secondary hits');
    }

    // Negative & zero damage while dead
    assertEqual(hero.takeDamage(-100), 0, 'Negative damage while dead returns 0');
    assertEqual(hero.takeDamage(0), 0, 'Zero damage while dead returns 0');
    assertEqual(hero.takeDamage(NaN), 0, 'NaN damage while dead returns 0');
    assertEqual(hero.hp, 0, 'HP remains 0');
  });

  it('TC-CHALLENGE-02: 300 simulation ticks while dead enforce strict state invariants', async () => {
    const { module: entityMod } = await resolveModule('entities/entity');
    const hero = new entityMod.HeroEntity({
      heroId: 'ranger',
      hp: 520,
      maxHp: 520,
      mana: 320,
      maxMana: 320,
      level: 1,
      x: 1200,
      y: 1200
    });

    hero.takeDamage(1000);
    assertTrue(hero.isDead);

    const dt = 1 / 60;
    for (let tick = 0; tick < 299; tick++) {
      hero.moveTo(2500, 2500);
      hero.setAttackTarget({ id: 'dummy', x: 1250, y: 1200, hp: 100 });
      hero.heal(100);

      assertEqual(hero.isDead, true);
      assertFalse(hero.isAlive());
      assertEqual(hero.hp, 0);
      assertFalse(hero.isMoving);
      assertFalse(hero.canMove());
      assertFalse(hero.canAttack());
      assertFalse(hero.canCast());
      assertEqual(hero.vx, 0);
      assertEqual(hero.vy, 0);
      assertEqual(hero.targetX, null);
      assertEqual(hero.targetY, null);
      assertEqual(hero.attackTarget, null);
      assertEqual(hero.x, 1200);
      assertEqual(hero.y, 1200);

      hero.update(dt);
    }
  });

  it('TC-CHALLENGE-03: sim.entities preserves dead hero across 100 simulation ticks during dynamic cleanup', async () => {
    const { module: gameMod } = await resolveModule('game');
    const { module: minionMod } = await resolveModule('world/minion');

    const sim = new gameMod.GameSimulation();
    const hero = sim.playerHero;
    assertTrue(sim.entities.includes(hero), 'Player hero present in sim.entities');

    const enemyMinion = new minionMod.MinionUnit({ id: 'test_enemy_minion', team: 'enemy', hp: 200, maxHp: 200 });
    sim.entities.push(enemyMinion);

    hero.takeDamage(10000);
    enemyMinion.takeDamage(1000);
    assertTrue(hero.isDead);
    assertTrue(enemyMinion.isDead);

    for (let tick = 0; tick < 100; tick++) {
      sim.update(0.01667);
      assertTrue(sim.entities.includes(hero), `Hero must be retained at tick ${tick}`);
    }

    assertFalse(sim.entities.includes(enemyMinion), 'Dead minion must be removed by cleanup filter');
    assertTrue(sim.entities.includes(hero), 'Dead hero retained after 100 ticks');
  });

  it('TC-CHALLENGE-04: Exact resurrection invariants at (400, 400) with complete CC cleanse', async () => {
    const { module: entityMod } = await resolveModule('entities/entity');
    const hero = new entityMod.HeroEntity({
      heroId: 'sorceress',
      hp: 480,
      maxHp: 480,
      mana: 460,
      maxMana: 460,
      x: 2400,
      y: 2400,
      level: 1
    });

    hero.takeDamage(1000);
    assertTrue(hero.isDead);

    // Apply CC and debuffs while dead
    const future = Date.now() + 100000;
    hero.stunnedUntil = future;
    hero.silencedUntil = future;
    hero.rootedUntil = future;
    hero.tauntedUntil = future;
    hero.tauntTargetId = 'boss_1';
    hero.slowedUntil = future;
    hero.slowPercentage = 0.75;
    hero.stealthedUntil = future;
    hero.mana = 0;
    hero.barrier = 150;
    hero.holdPosition = true;

    // Fast forward full respawn duration (5.0s)
    hero.update(5.0);

    assertFalse(hero.isDead);
    assertTrue(hero.isAlive());
    assertEqual(hero.x, 400);
    assertEqual(hero.y, 400);
    assertEqual(hero.z, 0);
    assertEqual(hero.vx, 0);
    assertEqual(hero.vy, 0);
    assertEqual(hero.hp, hero.maxHp);
    assertEqual(hero.mana, hero.maxMana);
    assertEqual(hero.barrier, 0);
    assertEqual(hero.respawnTimer, 0);
    assertEqual(hero.respawnDuration, 0);
    assertEqual(hero.holdPosition, false);
    assertEqual(hero.attackTarget, null);
    assertEqual(hero.attackCooldown, 0);

    // CC cleansed
    assertEqual(hero.stunnedUntil, 0);
    assertEqual(hero.silencedUntil, 0);
    assertEqual(hero.rootedUntil, 0);
    assertEqual(hero.tauntedUntil, 0);
    assertEqual(hero.tauntTargetId, null);
    assertEqual(hero.slowedUntil, 0);
    assertEqual(hero.slowPercentage, 0);
    assertEqual(hero.stealthedUntil, 0);

    // Immediate combat readiness
    assertTrue(hero.canMove());
    assertTrue(hero.canAttack());
    assertTrue(hero.canCast());
  });

  it('TC-CHALLENGE-05: Ability cooldowns decay while dead and maintain decay upon resurrection', async () => {
    const { module: entityMod } = await resolveModule('entities/entity');
    const hero = new entityMod.HeroEntity({ heroId: 'cleric', hp: 500, maxHp: 500, level: 1 });

    hero.abilities.Q.cooldownRemaining = 5.0;
    hero.abilities.W.cooldownRemaining = 10.0;
    hero.abilities.R.cooldownRemaining = 60.0;

    hero.takeDamage(1000); // 5s respawn
    assertTrue(hero.isDead);

    // 3 seconds of death elapsed
    hero.update(3.0);
    assertCloseTo(hero.abilities.Q.cooldownRemaining, 2.0, 0.01);
    assertCloseTo(hero.abilities.W.cooldownRemaining, 7.0, 0.01);
    assertCloseTo(hero.abilities.R.cooldownRemaining, 57.0, 0.01);

    // Remaining 2 seconds elapsed (resurrection)
    hero.update(2.0);
    assertTrue(hero.isAlive());
    assertEqual(hero.abilities.Q.cooldownRemaining, 0);
    assertCloseTo(hero.abilities.W.cooldownRemaining, 5.0, 0.01);
    assertCloseTo(hero.abilities.R.cooldownRemaining, 55.0, 0.01);
  });

  it('TC-CHALLENGE-06: Level-scaling respawn formula across levels 1-18 for all 5 hero archetypes', async () => {
    const { module: heroesMod } = await resolveModule('entities/heroes');
    const { module: entityMod } = await resolveModule('entities/entity');

    const heroClasses = ['knight', 'sorceress', 'ranger', 'assassin', 'cleric'];

    for (const heroClass of heroClasses) {
      for (let lvl = 1; lvl <= 18; lvl++) {
        const expected = 4.0 + lvl * 1.0;
        assertEqual(heroesMod.calculateRespawnTime(lvl), expected);

        const hero = new entityMod.HeroEntity({ heroId: heroClass, hp: 500, maxHp: 500, level: lvl });
        hero.die();
        assertEqual(hero.respawnDuration, expected);
        assertEqual(hero.respawnTimer, expected);
      }
    }
  });
});
