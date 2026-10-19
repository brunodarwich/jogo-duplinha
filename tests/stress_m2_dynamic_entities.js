/**
 * Milestone 2 Remediation (Iteration 2) Challenger 1:
 * Empirical Stress Testing of Defensive Towers, Projectiles & Aggro
 * with Dynamically Instantiated Entities (MinionUnit, Bosses, Entity subclasses).
 *
 * Requirements:
 * 1. Tower heat ramping on dynamic Entity instances.
 * 2. Projectile tracking and mid-air dissipation against dynamic entities.
 * 3. Aggro priorities (Peacetime minion preference, Call for Help, Sticky Lock, Tower Attacker).
 * 4. Structure hierarchy with dynamic Supreme Boss.
 */

import { performance } from 'node:perf_hooks';
import {
  DefensiveTower,
  TowerProjectile,
  createTowerHierarchy,
  TOWER_RADIUS,
  BASE_TOWER_DAMAGE
} from '../src/world/tower.js';
import {
  MinionUnit,
  WaveSpawner,
  MINION_BASE_STATS
} from '../src/world/minion.js';
import {
  StoneColossusBoss,
  AbyssalBehemothBoss,
  NexusGuardianBoss
} from '../src/world/boss.js';
import { Entity } from '../src/entities/entity.js';

let testCount = 0;
let passCount = 0;
let failCount = 0;
const failures = [];

function test(name, fn) {
  testCount++;
  const start = performance.now();
  try {
    fn();
    const duration = (performance.now() - start).toFixed(2);
    console.log(`  ✔ PASS ${name} (${duration}ms)`);
    passCount++;
  } catch (err) {
    const duration = (performance.now() - start).toFixed(2);
    console.log(`  ✖ FAIL ${name} (${duration}ms)`);
    console.log(`    ${err.message}`);
    failCount++;
    failures.push({ name, error: err });
  }
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

function assert(condition, message = 'Assertion failed') {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message ? message + ': ' : ''}Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertCloseTo(actual, expected, epsilon = 0.001, message = '') {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`${message ? message + ': ' : ''}Expected ${actual} close to ${expected} (diff: ${Math.abs(actual - expected)})`);
  }
}

console.log('================================================================');
console.log(' CHALLENGER 1: Dynamic Entity Instantiation Tower Stress Harness');
console.log('================================================================');

// --- SECTION 1: Tower Heat Ramping on Dynamic Hero Entities ---
section('1. Tower Heat Ramping on Dynamic Hero Entities');

test('1.1 Exact heat ramp (+25% per hit up to +100%) against dynamic Entity (hero) via calculateShotDamage & recordShot', () => {
  const tower = new DefensiveTower('t_heat_dyn', 'allied', 500, 500);
  const hero = new Entity({
    id: 'hero_tank',
    type: 'hero',
    team: 'enemy',
    x: 600,
    y: 500,
    maxHp: 5000,
    hp: 5000
  });

  tower.selectTarget([hero]);
  assertEqual(tower.currentTarget.id, hero.id);

  // Shot 1: baseline 150
  assertEqual(tower.calculateShotDamage(hero), 150);
  tower.recordShot(hero);

  // Shot 2: +25% -> 187.5
  assertCloseTo(tower.calculateShotDamage(hero), 187.5);
  tower.recordShot(hero);

  // Shot 3: +50% -> 225.0
  assertCloseTo(tower.calculateShotDamage(hero), 225.0);
  tower.recordShot(hero);

  // Shot 4: +75% -> 262.5
  assertCloseTo(tower.calculateShotDamage(hero), 262.5);
  tower.recordShot(hero);

  // Shot 5: +100% -> 300.0 (max cap)
  assertCloseTo(tower.calculateShotDamage(hero), 300.0);
  tower.recordShot(hero);

  // Subsequent shots 6-10 stay clamped at 300
  for (let i = 6; i <= 10; i++) {
    assertEqual(tower.calculateShotDamage(hero), 300, `Shot ${i} clamped at 300`);
    tower.recordShot(hero);
  }
});

test('1.2 End-to-end tower.update() projectile firing verifies heat ramp on dynamic Hero', () => {
  const tower = new DefensiveTower('t_e2e_heat', 'allied', 500, 500);
  const hero = new Entity({
    id: 'hero_e2e',
    type: 'hero',
    team: 'enemy',
    x: 600,
    y: 500,
    maxHp: 5000,
    hp: 5000
  });

  // Expected projectile damages: 150, 187.5, 225, 262.5, 300, 300
  const expectedDamages = [150, 187.5, 225, 262.5, 300, 300];

  for (let i = 0; i < expectedDamages.length; i++) {
    tower.cooldownTimer = 0; // ready to fire
    tower.update(0.01667, [hero]);
    const firedProj = tower.activeProjectiles[tower.activeProjectiles.length - 1];
    assert(firedProj !== undefined, `Projectile ${i} must be fired`);
    assertCloseTo(firedProj.damage, expectedDamages[i], 0.001, `Projectile ${i} damage`);
  }
});

test('1.3 Dynamic hero exiting attack radius immediately resets heat to baseline', () => {
  const tower = new DefensiveTower('t_reset_dyn', 'allied', 500, 500);
  const hero = new Entity({
    id: 'hero_diver',
    type: 'hero',
    team: 'enemy',
    x: 600,
    y: 500,
    maxHp: 5000,
    hp: 5000
  });

  // Ramp heat to max
  tower.selectTarget([hero]);
  for (let i = 0; i < 5; i++) tower.recordShot(hero);
  assertEqual(tower.calculateShotDamage(hero), 300);

  // Hero moves out of range (dist 450 > 400)
  hero.x = 950;
  tower.update(0.01667, [hero]);

  assertEqual(tower.currentTarget, null, 'Target cleared on range exit');
  assertEqual(tower.consecutiveHitsOnTarget, 0, 'Consecutive hits reset to 0');

  // Hero dives back in
  hero.x = 600;
  tower.cooldownTimer = 0;
  tower.update(0.01667, [hero]);
  assertEqual(tower.currentTarget.id, hero.id);
  // Fired projectile on re-entry must have baseline 150 damage
  const proj = tower.activeProjectiles[tower.activeProjectiles.length - 1];
  assert(proj !== undefined, 'Projectile fired on re-entry');
  assertEqual(proj.damage, 150, 'Fired shot has baseline 150 damage');
});

test('1.4 Target swap between dynamic hero entities resets heat for new target', () => {
  const tower = new DefensiveTower('t_swap_dyn', 'allied', 500, 500);
  const hero1 = new Entity({ id: 'hero_1', type: 'hero', team: 'enemy', x: 600, y: 500, maxHp: 3000, hp: 3000 });
  const hero2 = new Entity({ id: 'hero_2', type: 'hero', team: 'enemy', x: 650, y: 500, maxHp: 3000, hp: 3000 });

  tower.selectTarget([hero1, hero2]);
  assertEqual(tower.currentTarget.id, hero1.id);
  tower.recordShot(hero1);
  tower.recordShot(hero1);
  assertCloseTo(tower.calculateShotDamage(hero1), 225.0);

  // Hero 2 attacks ally -> Call for help
  tower.selectTarget([hero1, hero2], hero2.id);
  assertEqual(tower.currentTarget.id, hero2.id);
  assertEqual(tower.calculateShotDamage(hero2), 150, 'New target starts at baseline 150');
});

// --- SECTION 2: Dynamic MinionUnit & Boss Combat Interactions ---
section('2. Dynamic MinionUnit & Boss Combat Interactions');

test('2.1 Defensive tower never scales heat on dynamic MinionUnit instances', () => {
  const tower = new DefensiveTower('t_minion_heat', 'allied', 500, 500);
  const meleeMinion = new MinionUnit({ team: 'enemy', subType: 'melee', waveIndex: 1, x: 550, y: 500 });
  const cannonMinion = new MinionUnit({ team: 'enemy', subType: 'cannon', waveIndex: 3, x: 580, y: 500 });

  tower.selectTarget([meleeMinion, cannonMinion]);
  assertEqual(tower.currentTarget.id, meleeMinion.id);

  for (let i = 0; i < 8; i++) {
    assertEqual(tower.calculateShotDamage(meleeMinion), 150);
    tower.recordShot(meleeMinion);
  }

  tower.selectTarget([cannonMinion]);
  for (let i = 0; i < 5; i++) {
    assertEqual(tower.calculateShotDamage(cannonMinion), 150);
    tower.recordShot(cannonMinion);
  }
});

test('2.2 Defensive tower projectile applies -40% reduction to dynamic StoneColossusBoss', () => {
  const tower = new DefensiveTower('t_colossus', 'allied', 500, 500);
  const colossus = new StoneColossusBoss({ team: 'enemy', x: 600, y: 500 });

  assertEqual(colossus.towerDamageReduction, 0.40, 'Colossus has 40% reduction');
  const initialHp = colossus.hp;

  const proj = new TowerProjectile({
    towerId: tower.id,
    target: colossus,
    damage: 150,
    speed: 750,
    x: tower.x,
    y: tower.y,
    z: 80
  });

  while (!proj.hasImpacted && !proj.isDead) {
    proj.update(0.01667);
  }

  assert(proj.hasImpacted, 'Projectile impacted dynamic Colossus');
  // 150 * (1 - 0.40) = 90
  assertEqual(colossus.hp, initialHp - 90, 'Colossus HP reduced by exactly 90');
});

test('2.3 Peacetime aggro selects closest dynamic MinionUnit over Boss and Hero', () => {
  const tower = new DefensiveTower('t_prio_dyn', 'allied', 1000, 1000);
  const hero = new Entity({ id: 'h_close', type: 'hero', team: 'enemy', x: 1080, y: 1000 }); // dist 80
  const boss = new StoneColossusBoss({ id: 'b_close', team: 'enemy', x: 1100, y: 1000 }); // dist 100
  const minionFar = new MinionUnit({ id: 'm_far', team: 'enemy', subType: 'melee', waveIndex: 1, x: 1250, y: 1000 }); // dist 250
  const minionClose = new MinionUnit({ id: 'm_close', team: 'enemy', subType: 'melee', waveIndex: 1, x: 1050, y: 1000 }); // dist 50

  const target = tower.selectTarget([hero, boss, minionFar, minionClose]);
  assertEqual(target.id, 'm_close', 'Closest minion selected over closer hero and boss in peacetime');
});

test('2.4 Call for Help switches aggro from dynamic MinionUnit to aggressor Hero', () => {
  const tower = new DefensiveTower('t_cfh_dyn', 'allied', 1000, 1000);
  const minion = new MinionUnit({ id: 'm_lock', team: 'enemy', subType: 'melee', waveIndex: 1, x: 1050, y: 1000 });
  const aggressorHero = new Entity({ id: 'hero_agg', type: 'hero', team: 'enemy', x: 1100, y: 1000 });

  // Initial peacetime lock on minion
  let target = tower.selectTarget([minion, aggressorHero]);
  assertEqual(target.id, 'm_lock');

  // Aggressor hero attacks allied hero -> Call for Help
  target = tower.selectTarget([minion, aggressorHero], aggressorHero.id);
  assertEqual(target.id, 'hero_agg', 'Call for help overrides minion lock');
});

// --- SECTION 3: Projectile Tracking, Movement & Overkill Dissipation ---
section('3. Projectile Tracking, Movement & Overkill Dissipation');

test('3.1 TowerProjectile tracks fast-moving dynamic MinionUnit without losing lock', () => {
  const minion = new MinionUnit({ team: 'enemy', subType: 'melee', waveIndex: 1, x: 600, y: 500, speed: 400 });
  const proj = new TowerProjectile({
    towerId: 't_fast',
    target: minion,
    damage: 150,
    speed: 750,
    x: 500,
    y: 500,
    z: 80
  });

  let ticks = 0;
  while (!proj.hasImpacted && ticks < 200) {
    minion.x += 400 * 0.01667; // moves fast along X axis
    proj.update(0.01667);
    ticks++;
  }

  assert(proj.hasImpacted, 'Projectile caught up and impacted moving MinionUnit');
  assert(!isNaN(minion.hp), 'Minion HP remains finite');
});

test('3.2 Projectile dissipates mid-air when dynamic MinionUnit is destroyed by external source', () => {
  const minion = new MinionUnit({ team: 'enemy', subType: 'melee', waveIndex: 1, x: 800, y: 500 });
  const proj = new TowerProjectile({
    towerId: 't_ext_kill',
    target: minion,
    damage: 150,
    speed: 750,
    x: 500,
    y: 500,
    z: 80
  });

  // Advance 3 frames
  for (let i = 0; i < 3; i++) proj.update(0.01667);
  assert(!proj.isDead, 'In flight');

  // External lethal damage
  minion.takeDamage(9999, 'physical');
  assert(minion.isDead, 'Minion dead');

  // Projectile next update
  proj.update(0.01667);
  assert(proj.isDead, 'Projectile marks itself dead immediately on target death');
  assertEqual(proj.hasImpacted, false, 'Does NOT impact dead target');
});

test('3.3 Multi-projectile volley on dynamic Entity only impacts once if fatal', () => {
  const target = new Entity({ id: 'ent_low_hp', type: 'hero', team: 'enemy', x: 700, y: 500, maxHp: 200, hp: 200 });

  const p1 = new TowerProjectile({ target, damage: 200, speed: 750, x: 650, y: 500 });
  const p2 = new TowerProjectile({ target, damage: 200, speed: 750, x: 550, y: 500 });

  for (let t = 0; t < 60; t++) {
    p1.update(0.01667);
    p2.update(0.01667);
  }

  assert(p1.hasImpacted, 'P1 impacted');
  assertEqual(target.hp, 0, 'Target HP is 0');
  assert(target.isDead, 'Target is dead');
  assert(!p2.hasImpacted, 'P2 dissipated mid-air');
  assert(p2.isDead, 'P2 is dead');
  assertEqual(target.hp, 0, 'HP not reduced to negative');
});

// --- SECTION 4: Structure Invulnerability with Dynamic Supreme Boss ---
section('4. Structure Invulnerability with Dynamic Supreme Boss');

test('4.1 Enemy Nexus invulnerability strictly tied to dynamic NexusGuardianBoss', () => {
  const supremeBoss = new NexusGuardianBoss({ team: 'enemy', x: 2500, y: 2500 });
  const hierarchy = createTowerHierarchy({
    isSupremeBossAlive: () => supremeBoss.isAlive()
  });

  const { outer, inner, nexus } = hierarchy.enemy;

  // Outer down
  outer.takeDamage(outer.maxHp);
  assert(!inner.isInvulnerable(), 'Inner vulnerable');

  // Inner down
  inner.takeDamage(inner.maxHp);
  assert(inner.hp <= 0, 'Inner destroyed');

  // Supreme Boss alive -> Nexus invulnerable
  assert(nexus.isInvulnerable(), 'Nexus invulnerable while Supreme Boss is alive');
  const dmgRes = nexus.takeDamage(500);
  assertEqual(dmgRes.damageTaken, 0, 'Deals 0 damage to invulnerable Nexus');
  assertEqual(nexus.hp, nexus.maxHp);

  // Supreme Boss slain
  supremeBoss.takeDamage(supremeBoss.maxHp);
  assert(!supremeBoss.isAlive(), 'Supreme boss dead');
  assert(!nexus.isInvulnerable(), 'Nexus now vulnerable');

  // Slay Nexus
  const finalDmg = nexus.takeDamage(nexus.maxHp);
  assertEqual(finalDmg.destroyed, true, 'Enemy Nexus destroyed');
});

// --- SECTION 5: End-to-End Simulation with WaveSpawner & Dynamic Entities ---
section('5. End-to-End Simulation with WaveSpawner & Dynamic Entities');

test('5.1 WaveSpawner + DefensiveTower 600-tick integration simulation', () => {
  const spawner = new WaveSpawner(null, { firstWaveTime: 1.0, waveInterval: 60.0, autoUpdateMinions: true });
  const tower = new DefensiveTower('t_sim', 'allied', 1250, 1250);
  const entities = [];

  // Simulate 120 seconds (7200 frames / ticks) in compressed 0.1s steps
  const dt = 0.1;
  const totalTicks = 600;

  for (let tick = 0; tick < totalTicks; tick++) {
    spawner.update(dt, entities);
    tower.update(dt, entities);

    // Assert tower invariants
    if (tower.currentTarget) {
      assert(tower.currentTarget.isAlive(), `Target at tick ${tick} must be alive`);
      assert(tower.isWithinRange(tower.currentTarget), `Target at tick ${tick} must be in range`);
    }
  }

  assert(entities.length > 0, 'Entities spawned and tracked');
  console.log(`    Total active entities remaining: ${entities.length}`);
});

// --- SECTION 6: Adversarial Boundary & Stress Cases with Dynamic Entities ---
section('6. Adversarial Boundary & Stress Cases with Dynamic Entities');

test('6.1 High-speed dash (1500 speed) on dynamic Entity tracked without NaN', () => {
  const hero = new Entity({ id: 'dash_hero', type: 'hero', team: 'enemy', x: 600, y: 500, maxHp: 2000, hp: 2000 });
  const proj = new TowerProjectile({
    towerId: 't_dash',
    target: hero,
    damage: 150,
    speed: 750,
    x: 500,
    y: 500,
    z: 80
  });

  const dt = 0.01667;
  let ticks = 0;
  while (!proj.hasImpacted && ticks < 250) {
    if (ticks < 15) {
      hero.x += 1060 * dt;
      hero.y += 1060 * dt;
    }
    proj.update(dt);
    assert(!isNaN(proj.x) && !isNaN(proj.y), 'Coordinates must be valid numbers');
    ticks++;
  }
  assert(proj.hasImpacted, 'Projectile impacts after dash');
  assertEqual(hero.hp, 1850);
});

test('6.2 Instant blink displacement on dynamic Entity redirects vector instantly', () => {
  const hero = new Entity({ id: 'blink_hero', type: 'hero', team: 'enemy', x: 600, y: 500, maxHp: 1000, hp: 1000 });
  const proj = new TowerProjectile({
    towerId: 't_blink',
    target: hero,
    damage: 150,
    speed: 750,
    x: 500,
    y: 500,
    z: 80
  });

  for (let i = 0; i < 3; i++) proj.update(0.01667);

  // Instant blink
  hero.x = 850;
  hero.y = 750;

  let ticks = 0;
  while (!proj.hasImpacted && ticks < 200) {
    proj.update(0.01667);
    ticks++;
  }
  assert(proj.hasImpacted, 'Impacted blinked hero');
  assertCloseTo(proj.x, 850, 5.0);
  assertCloseTo(proj.y, 750, 5.0);
});

test('6.3 Call for Help ignores non-hero attacker (MinionUnit attacking allied hero)', () => {
  const tower = new DefensiveTower('t_nonhero_cfh', 'allied', 1000, 1000);
  const minionAgg = new MinionUnit({ id: 'm_agg', team: 'enemy', subType: 'melee', waveIndex: 1, x: 1200, y: 1000 });
  const minionClose = new MinionUnit({ id: 'm_closer', team: 'enemy', subType: 'melee', waveIndex: 1, x: 1050, y: 1000 });

  // Minion attacks ally -> call for help passed with minion ID
  const target = tower.selectTarget([minionAgg, minionClose], 'm_agg');
  assertEqual(target.id, 'm_closer', 'Minion attacker does not trigger Call for Help; standard proximity applies');
});

test('6.4 Boundary distance precision: 400.0 inside range vs 400.1 outside range', () => {
  const tower = new DefensiveTower('t_bound', 'allied', 500, 500);
  const minionAtBound = new MinionUnit({ team: 'enemy', subType: 'melee', waveIndex: 1, x: 900, y: 500 }); // dist 400.0
  const minionOut = new MinionUnit({ team: 'enemy', subType: 'melee', waveIndex: 1, x: 900.1, y: 500 }); // dist 400.1

  assert(tower.isWithinRange(minionAtBound), '400.0 is inside');
  assert(!tower.isWithinRange(minionOut), '400.1 is outside');
});

test('6.5 Massive cluster: 100 dynamic MinionUnits, 2 bosses, 5 heroes target selection', () => {
  const tower = new DefensiveTower('t_massive', 'allied', 1000, 1000);
  const units = [];

  for (let i = 0; i < 100; i++) {
    units.push(new MinionUnit({ id: `dyn_m_${i}`, team: 'enemy', subType: i % 3 === 0 ? 'cannon' : 'melee', waveIndex: 1, x: 1050 + (i * 2), y: 1000 + (i % 5) }));
  }
  units.push(new StoneColossusBoss({ id: 'dyn_colossus', team: 'enemy', x: 1100, y: 1000 }));
  units.push(new AbyssalBehemothBoss({ id: 'dyn_behemoth', team: 'enemy', x: 1150, y: 1000 }));
  for (let h = 0; h < 5; h++) {
    units.push(new Entity({ id: `dyn_h_${h}`, type: 'hero', team: 'enemy', x: 1040 + h * 20, y: 1000 }));
  }

  const start = performance.now();
  const target = tower.selectTarget(units);
  const elapsed = performance.now() - start;

  assert(target !== null, 'Target selected from 107 dynamic units');
  assert(target.type === 'minion', 'Peacetime selects minion');
  assert(elapsed < 5.0, `Target selection took ${elapsed.toFixed(2)}ms (< 5ms)`);
});

test('6.6 AbyssalBehemothBoss Roar of Fear applies silence without breaking tower targeting', () => {
  const tower = new DefensiveTower('t_behemoth', 'allied', 1000, 1000);
  const behemoth = new AbyssalBehemothBoss({ team: 'enemy', x: 1100, y: 1000 });
  const allyHero = new Entity({ id: 'ally_h', type: 'hero', team: 'allied', x: 1120, y: 1000, maxHp: 2000, hp: 2000 });

  // Behemoth update with roar ready within 350 range of allyHero applies silence
  behemoth.roarTimer = 0;
  behemoth.update(0.01667, [allyHero]);
  assert(allyHero.silencedUntil > Date.now(), 'Ally hero is silenced by Behemoth roar');

  // Tower still targets behemoth if alone in range
  const target = tower.selectTarget([behemoth]);
  assertEqual(target.id, behemoth.id, 'Tower targets Behemoth');
});

test('6.7 Allied hierarchy sequential destruction: Outer -> Inner -> Nexus', () => {
  const hierarchy = createTowerHierarchy();
  const { outer, inner, nexus } = hierarchy.allied;

  assert(!outer.isInvulnerable(), 'Outer vulnerable');
  assert(inner.isInvulnerable(), 'Inner invulnerable');
  assert(nexus.isInvulnerable(), 'Nexus invulnerable');

  outer.takeDamage(outer.maxHp);
  assert(!inner.isInvulnerable(), 'Inner vulnerable once Outer is destroyed');
  assert(nexus.isInvulnerable(), 'Nexus still invulnerable');

  inner.takeDamage(inner.maxHp);
  assert(!nexus.isInvulnerable(), 'Nexus vulnerable once Inner is destroyed');

  nexus.takeDamage(nexus.maxHp);
  assert(nexus.hp <= 0, 'Nexus destroyed');
});

console.log('\n================================================================');
console.log(` DYNAMIC ENTITY STRESS SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
console.log('================================================================');

if (failCount > 0) {
  console.log('>>> EMPIRICAL VERDICT: REJECT <<<');
  process.exit(1);
} else {
  console.log('>>> EMPIRICAL VERDICT: APPROVE <<<');
  process.exit(0);
}
