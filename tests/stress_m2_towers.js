/**
 * Milestone 2 Empirical Stress Test Harness:
 * Defensive Towers, Aggro Priority, Heat Scaling, Homing Projectiles, and Defense Hierarchy.
 *
 * Mission Requirements:
 * 1. Call for help aggro switch when hero attacks allied hero within tower range under multi-unit presence (minions, heroes, boss).
 * 2. Consecutive heat scaling accuracy (+25% per hit up to 2.0x max) and immediate reset on target exit.
 * 3. Homing projectile tracking against high-speed dashes and mid-air target death dissipation.
 * 4. Structure invulnerability hierarchy (Inner immune while Outer alive, Nexus immune while Inner alive).
 *
 * Run: node tests/stress_m2_towers.js
 */

import { performance } from 'node:perf_hooks';
import {
  DefensiveTower,
  TowerProjectile,
  createTowerHierarchy,
  TOWER_RADIUS,
  BASE_TOWER_DAMAGE,
  TOWER_ATTACK_INTERVAL,
  TOWER_MAX_HP,
  TOWER_ARMOR,
  TOWER_POSITIONS
} from '../src/world/tower.js';
import { SupremeBoss, evaluateMatchOutcome, BOSS_CONFIGS } from '../src/world/boss.js';
import { MinionUnit } from '../src/world/minion.js';
import { Entity } from '../src/entities/entity.js';

// --- Terminal Colors & Utilities ---
const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m'
};

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
    console.log(`  ${COLORS.green}✔ PASS${COLORS.reset} ${name} ${COLORS.dim}(${duration}ms)${COLORS.reset}`);
    passCount++;
  } catch (err) {
    const duration = (performance.now() - start).toFixed(2);
    console.log(`  ${COLORS.red}✖ FAIL${COLORS.reset} ${name} ${COLORS.dim}(${duration}ms)${COLORS.reset}`);
    console.log(`    ${COLORS.red}${err.message}${COLORS.reset}`);
    if (err.stack) {
      console.log(`    ${COLORS.dim}${err.stack.split('\n').slice(1, 4).join('\n    ')}${COLORS.reset}`);
    }
    failCount++;
    failures.push({ name, error: err });
  }
}

function section(title) {
  console.log(`\n${COLORS.bold}${COLORS.cyan}=== ${title} ===${COLORS.reset}`);
}

function assert(condition, message = 'Assertion failed') {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message ? message + ': ' : ''}Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertCloseTo(actual, expected, epsilon = 0.001, message = '') {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`${message ? message + ': ' : ''}Expected ${actual} close to ${expected} (eps ${epsilon}), diff ${Math.abs(actual - expected)}`);
  }
}

function createMockHero(overrides = {}) {
  return {
    id: overrides.id || `hero_${Math.random().toString(36).substring(2, 7)}`,
    name: overrides.name || 'Hero Unit',
    team: overrides.team || 'enemy',
    type: 'hero',
    x: overrides.x ?? 400,
    y: overrides.y ?? 400,
    z: overrides.z ?? 0,
    hp: overrides.hp ?? 1000,
    maxHp: overrides.maxHp ?? 1000,
    radius: overrides.radius ?? 25,
    height: overrides.height ?? 40,
    speed: overrides.speed ?? 300,
    isDead: overrides.isDead ?? false,
    isAlive() {
      return !this.isDead && this.hp > 0;
    },
    takeDamage(amount, type = 'physical') {
      const dmg = Math.min(this.hp, amount);
      this.hp -= dmg;
      if (this.hp <= 0) {
        this.isDead = true;
      }
      return dmg;
    },
    ...overrides
  };
}

function createMockMinion(overrides = {}) {
  return {
    id: overrides.id || `minion_${Math.random().toString(36).substring(2, 7)}`,
    team: overrides.team || 'enemy',
    type: 'minion',
    x: overrides.x ?? 400,
    y: overrides.y ?? 400,
    z: overrides.z ?? 0,
    hp: overrides.hp ?? 300,
    maxHp: overrides.maxHp ?? 300,
    radius: overrides.radius ?? 14,
    height: overrides.height ?? 26,
    isDead: overrides.isDead ?? false,
    isAlive() {
      return !this.isDead && this.hp > 0;
    },
    takeDamage(amount) {
      const dmg = Math.min(this.hp, amount);
      this.hp -= dmg;
      if (this.hp <= 0) this.isDead = true;
      return dmg;
    },
    ...overrides
  };
}

function createMockBoss(overrides = {}) {
  return {
    id: overrides.id || 'boss_colossus',
    name: 'Stone Colossus',
    team: overrides.team || 'enemy',
    type: 'boss',
    x: overrides.x ?? 400,
    y: overrides.y ?? 400,
    z: overrides.z ?? 0,
    hp: overrides.hp ?? 3500,
    maxHp: overrides.maxHp ?? 3500,
    radius: overrides.radius ?? 35,
    height: overrides.height ?? 60,
    towerDamageReduction: overrides.towerDamageReduction ?? 0.40,
    isDead: overrides.isDead ?? false,
    isAlive() {
      return !this.isDead && this.hp > 0;
    },
    takeDamage(amount) {
      const dmg = Math.min(this.hp, amount);
      this.hp -= dmg;
      if (this.hp <= 0) this.isDead = true;
      return dmg;
    },
    ...overrides
  };
}

console.log(`\n${COLORS.bold}================================================================${COLORS.reset}`);
console.log(`${COLORS.bold}  CHALLENGER 1: Milestone 2 Towers & Defense Empirical Harness  ${COLORS.reset}`);
console.log(`${COLORS.bold}================================================================${COLORS.reset}`);

// ============================================================================
// SECTION 1: CALL FOR HELP AGGRO SWITCH UNDER MULTI-UNIT PRESENCE
// ============================================================================
section('1. Call For Help Aggro Switch Under Dense Multi-Unit Presence');

test('1.1 Peacetime target selection prioritizes closest minion over hero and boss', () => {
  const tower = new DefensiveTower('tower_test_1', 'allied', 1000, 1000);

  // Cluster: 1 enemy hero at dist 100, 1 boss at dist 200, 1 minion at dist 150, 1 closer minion at dist 50
  const hero = createMockHero({ id: 'enemy_hero', x: 1000, y: 1100 }); // dist 100
  const boss = createMockBoss({ id: 'enemy_boss', x: 1000, y: 1200 }); // dist 200
  const minionFar = createMockMinion({ id: 'minion_far', x: 1000, y: 1150 }); // dist 150
  const minionClose = createMockMinion({ id: 'minion_close', x: 1000, y: 1050 }); // dist 50

  const target = tower.selectTarget([hero, boss, minionFar, minionClose]);
  assert(target !== null, 'Target should be selected');
  assertEqual(target.id, 'minion_close', 'Closest minion must be targeted over hero and far minion');
});

test('1.2 Call for Help immediately breaks sticky lock on minion when hostile hero attacks allied hero', () => {
  const tower = new DefensiveTower('tower_test_2', 'allied', 1000, 1000);

  const minion = createMockMinion({ id: 'm_locked', x: 1050, y: 1000 });
  const enemyHero = createMockHero({ id: 'enemy_hero_aggressor', x: 1100, y: 1000 });
  const allyHero = createMockHero({ id: 'allied_hero_victim', team: 'allied', x: 1020, y: 1000 });

  // 1. Initial lock on minion
  let target = tower.selectTarget([minion, enemyHero]);
  assertEqual(target.id, 'm_locked', 'Tower locks on minion initially');
  assertEqual(tower.currentTarget.id, 'm_locked');

  // Verify sticky lock holds in peacetime
  target = tower.selectTarget([minion, enemyHero]);
  assertEqual(target.id, 'm_locked', 'Sticky lock persists in peacetime');

  // 2. Hostile hero attacks allied hero -> Call for Help triggered!
  target = tower.selectTarget([minion, enemyHero], 'enemy_hero_aggressor');
  assertEqual(target.id, 'enemy_hero_aggressor', 'Call for Help must immediately override minion lock');
  assertEqual(tower.currentTarget.id, 'enemy_hero_aggressor');
});

test('1.3 Call for Help switches aggro under dense multi-unit presence (50 minions, boss, 3 heroes)', () => {
  const tower = new DefensiveTower('tower_test_3', 'allied', 1000, 1000);

  const units = [];
  // 50 enemy minions scattered in range [1020, 1380]
  for (let i = 0; i < 50; i++) {
    units.push(createMockMinion({ id: `minion_${i}`, x: 1020 + (i * 5), y: 1000 + (i % 10) }));
  }

  // 1 boss
  units.push(createMockBoss({ id: 'boss_colossus_1', x: 1080, y: 1080 }));

  // 3 hostile heroes
  const hero1 = createMockHero({ id: 'enemy_hero_1', x: 1050, y: 1050 });
  const hero2 = createMockHero({ id: 'enemy_hero_2', x: 1060, y: 1060 });
  const hero3 = createMockHero({ id: 'enemy_hero_3', x: 1070, y: 1070 });
  units.push(hero1, hero2, hero3);

  // Tower initially acquires closest minion
  let target = tower.selectTarget(units);
  assert(target !== null && target.type === 'minion', 'Peacetime must select minion');

  // Hero 2 attacks allied hero -> Call for Help
  target = tower.selectTarget(units, 'enemy_hero_2');
  assertEqual(target.id, 'enemy_hero_2', 'Tower must acquire enemy_hero_2 among 54 active hostile units');

  // Hero 3 attacks allied hero next -> Tower switches to Hero 3
  target = tower.selectTarget(units, 'enemy_hero_3');
  assertEqual(target.id, 'enemy_hero_3', 'Tower must switch immediately to newest hero aggressor enemy_hero_3');
});

test('1.4 Call for Help ignores out-of-range aggressor heroes', () => {
  const tower = new DefensiveTower('tower_test_4', 'allied', 1000, 1000);

  const minion = createMockMinion({ id: 'minion_in_range', x: 1100, y: 1000 }); // dist 100
  // Aggressor hero is outside 400-unit attack radius (dist = 450)
  const outOfRangeHero = createMockHero({ id: 'enemy_hero_out', x: 1450, y: 1000 });

  const enemiesInRange = [minion]; // outOfRangeHero is filtered out of enemiesInRange by update()
  const target = tower.selectTarget(enemiesInRange, 'enemy_hero_out');
  assertEqual(target.id, 'minion_in_range', 'Tower must not target hero who is outside attack radius');
});

test('1.5 Call for Help rejects non-hero aggressor IDs (minions/boss attacking hero)', () => {
  const tower = new DefensiveTower('tower_test_5', 'allied', 1000, 1000);

  const minionAttackingHero = createMockMinion({ id: 'minion_creep_agg', x: 1200, y: 1000 }); // dist 200
  const closerMinion = createMockMinion({ id: 'minion_closest', x: 1050, y: 1000 }); // dist 50

  // Minion creep attacks allied hero, passing minion id as callForHelpAggressorId
  const target = tower.selectTarget([minionAttackingHero, closerMinion], 'minion_creep_agg');
  assertEqual(target.id, 'minion_closest', 'Minion attacking ally does not trigger Call for Help; standard priority rules apply');
});

test('1.6 Aggressor death or departure seamlessly falls back to remaining valid targets', () => {
  const tower = new DefensiveTower('tower_test_6', 'allied', 1000, 1000);

  const aggressorHero = createMockHero({ id: 'hero_agg', x: 1100, y: 1000, hp: 50 });
  const fallbackMinion = createMockMinion({ id: 'minion_fallback', x: 1150, y: 1000 });
  const secondaryHero = createMockHero({ id: 'hero_secondary', x: 1250, y: 1000 });

  // 1. Acquire aggressor via Call for Help
  let target = tower.selectTarget([aggressorHero, fallbackMinion, secondaryHero], 'hero_agg');
  assertEqual(target.id, 'hero_agg');

  // 2. Aggressor dies
  aggressorHero.hp = 0;
  aggressorHero.isDead = true;

  // Next selectTarget without call for help
  target = tower.selectTarget([aggressorHero, fallbackMinion, secondaryHero]);
  assertEqual(target.id, 'minion_fallback', 'Dead aggressor must be abandoned for closest alive minion');

  // 3. Fallback minion dies
  fallbackMinion.hp = 0;
  fallbackMinion.isDead = true;

  // Tower update with full entity array (update filters out dead entities before selectTarget)
  tower.update(0.01667, [aggressorHero, fallbackMinion, secondaryHero]);
  assertEqual(tower.currentTarget.id, 'hero_secondary', 'Fallback advances to remaining alive hero in tower.update');

  // Also verify selectTarget with alive enemies array
  target = tower.selectTarget([secondaryHero]);
  assertEqual(target.id, 'hero_secondary', 'selectTarget with alive units selects hero_secondary');
});

// ============================================================================
// SECTION 2: CONSECUTIVE HEAT SCALING ACCURACY & RESET BEHAVIOR
// ============================================================================
section('2. Consecutive Heat Scaling Accuracy & Immediate Reset On Target Exit');

test('2.1 Exact heat scaling progression: +25% per hit up to +100% (2.0x cap)', () => {
  const tower = new DefensiveTower('tower_heat_1', 'allied', 500, 500);
  const hero = createMockHero({ id: 'tank_hero', x: 600, y: 500, hp: 5000 });

  // Initial shot (Shot 1): 150.0 (1.0x baseline)
  tower.selectTarget([hero]);
  let dmg1 = tower.calculateShotDamage(hero);
  assertEqual(dmg1, 150, 'Shot 1 must be exactly base damage (150)');
  tower.recordShot(hero);

  // Shot 2: 150 * 1.25 = 187.5 (+25%)
  let dmg2 = tower.calculateShotDamage(hero);
  assertCloseTo(dmg2, 187.5, 0.001, 'Shot 2 must be +25% (187.5)');
  tower.recordShot(hero);

  // Shot 3: 150 * 1.50 = 225.0 (+50%)
  let dmg3 = tower.calculateShotDamage(hero);
  assertCloseTo(dmg3, 225.0, 0.001, 'Shot 3 must be +50% (225.0)');
  tower.recordShot(hero);

  // Shot 4: 150 * 1.75 = 262.5 (+75%)
  let dmg4 = tower.calculateShotDamage(hero);
  assertCloseTo(dmg4, 262.5, 0.001, 'Shot 4 must be +75% (262.5)');
  tower.recordShot(hero);

  // Shot 5: 150 * 2.00 = 300.0 (+100% / 2.0x max cap)
  let dmg5 = tower.calculateShotDamage(hero);
  assertCloseTo(dmg5, 300.0, 0.001, 'Shot 5 must be +100% cap (300.0)');
  tower.recordShot(hero);

  // Shots 6 through 15: Must remain strictly capped at 300.0
  for (let i = 6; i <= 15; i++) {
    let dmgN = tower.calculateShotDamage(hero);
    assertEqual(dmgN, 300, `Shot ${i} must remain capped at 300`);
    tower.recordShot(hero);
  }
});

test('2.2 Immediate heat reset when hero exits 400-unit attack radius', () => {
  const tower = new DefensiveTower('tower_heat_2', 'allied', 500, 500);
  const hero = createMockHero({ id: 'diving_hero', x: 600, y: 500, hp: 5000 }); // dist 100

  // Ramp up heat with 4 shots (to 300 dmg)
  tower.selectTarget([hero]);
  for (let i = 0; i < 4; i++) {
    tower.recordShot(hero);
  }
  assertEqual(tower.calculateShotDamage(hero), 300, 'Ramped to max 300 dmg');

  // Hero exits range: moves to x=950, y=500 (dist = 450 > 400)
  hero.x = 950;
  hero.y = 500;

  // Simulate update tick where hero is out of range
  tower.update(0.01667, [hero]);

  // Verify target is cleared and consecutive hits reset to 0
  assertEqual(tower.currentTarget, null, 'Current target must be cleared on range exit');
  assertEqual(tower.consecutiveHitsOnTarget, 0, 'Consecutive hits must be reset to 0');

  // Hero dives back in: moves to x=600, y=500 (dist = 100)
  hero.x = 600;
  hero.y = 500;

  // Before firing on re-entry, calculateShotDamage must be baseline 150
  tower.selectTarget([hero]);
  assertEqual(tower.currentTarget.id, 'diving_hero');
  assertEqual(tower.consecutiveHitsOnTarget, 0, 'Consecutive hits remains 0 before shot');
  assertEqual(tower.calculateShotDamage(hero), 150, 'Baseline damage calculation before first shot on re-entry');

  // Now simulate update tick: fires Shot 1 on re-entry
  tower.update(0.01667, [hero]);
  const firedProj = tower.activeProjectiles[tower.activeProjectiles.length - 1];
  assert(firedProj !== undefined, 'Projectile must be fired upon re-entry');
  assertEqual(firedProj.damage, 150, 'Fired projectile on re-entry deals baseline 150.0 damage');
  assertEqual(tower.consecutiveHitsOnTarget, 1, 'Consecutive hits increments to 1 after shot 1 fired');
  // Next shot damage will be 187.5
  assertEqual(tower.calculateShotDamage(hero), 187.5, 'Next shot will be +25% (187.5)');
});

test('2.3 Boundary distance jitter: exactly 400.0 in range vs 400.1 out of range', () => {
  const tower = new DefensiveTower('tower_heat_3', 'allied', 500, 500);
  const hero = createMockHero({ id: 'jitter_hero', x: 900, y: 500 }); // dist = 400.0

  // 1. Boundary check at exactly 400.0 units
  assert(tower.isWithinRange(hero), 'Distance 400.0 must be within range');
  tower.selectTarget([hero]);
  tower.recordShot(hero);
  tower.recordShot(hero);
  assert(tower.consecutiveHitsOnTarget >= 2, 'Heat increments while at boundary');

  // 2. Micro-step to 400.1 units (dist > 400)
  hero.x = 900.1;
  assert(!tower.isWithinRange(hero), 'Distance 400.1 must be outside range');

  tower.selectTarget([]); // No enemies in range
  assertEqual(tower.currentTarget, null, 'Target cleared at 400.1');
  assertEqual(tower.consecutiveHitsOnTarget, 0, 'Heat reset to 0 at 400.1');
});

test('2.4 Immediate heat reset on target switch between heroes', () => {
  const tower = new DefensiveTower('tower_heat_4', 'allied', 500, 500);
  const heroA = createMockHero({ id: 'hero_A', x: 600, y: 500, hp: 3000 });
  const heroB = createMockHero({ id: 'hero_B', x: 650, y: 500, hp: 3000 });

  // Ramp on Hero A
  tower.selectTarget([heroA, heroB]);
  tower.recordShot(heroA);
  tower.recordShot(heroA);
  tower.recordShot(heroA);
  assertEqual(tower.calculateShotDamage(heroA), 150 * 1.75); // 262.5

  // Switch to Hero B (Call for Help on B)
  tower.selectTarget([heroA, heroB], 'hero_B');
  assertEqual(tower.currentTarget.id, 'hero_B');
  assertEqual(tower.consecutiveHitsOnTarget, 0, 'Consecutive hits reset for Hero B');

  // Shot damage on Hero B must be baseline 150
  assertEqual(tower.calculateShotDamage(heroB), 150, 'Hero B takes baseline 150 on first shot');
});

test('2.5 Non-hero targets (minions and boss) never scale heat', () => {
  const tower = new DefensiveTower('tower_heat_5', 'allied', 500, 500);
  const minion = createMockMinion({ id: 'siege_minion', x: 600, y: 500, hp: 3000 });

  tower.selectTarget([minion]);
  for (let i = 0; i < 10; i++) {
    assertEqual(tower.calculateShotDamage(minion), 150, `Minion shot ${i+1} must be 150`);
    tower.recordShot(minion);
  }

  // Stone Colossus with -40% damage reduction
  const colossus = createMockBoss({ id: 'colossus_boss', x: 600, y: 500, hp: 5000, towerDamageReduction: 0.40 });
  tower.selectTarget([colossus]);
  for (let i = 0; i < 5; i++) {
    assertEqual(tower.calculateShotDamage(colossus), 150, 'Base calculation before reduction is 150');
    tower.recordShot(colossus);
  }
});

// ============================================================================
// SECTION 3: HOMING PROJECTILE TRACKING & MID-AIR DEATH DISSIPATION
// ============================================================================
section('3. Homing Projectile Tracking Against Dashes & Mid-Air Death Dissipation');

test('3.1 Homing projectile successfully tracks and hits linear moving target', () => {
  const target = createMockHero({ id: 'moving_target', x: 600, y: 500, z: 0, hp: 1000 });
  const proj = new TowerProjectile({
    towerId: 'tower_proj_1',
    team: 'allied',
    target,
    damage: 150,
    speed: 750,
    x: 500,
    y: 500,
    z: 80
  });

  const initialHp = target.hp;
  const dt = 0.01667;
  let ticks = 0;

  // Target moves at 300 units/s in +X direction
  while (!proj.hasImpacted && ticks < 200) {
    target.x += 300 * dt;
    proj.update(dt);
    ticks++;
  }

  assert(proj.hasImpacted, 'Projectile must impact moving target');
  assert(proj.isDead, 'Projectile must be marked dead after impact');
  assertEqual(target.hp, initialHp - 150, 'Target takes 150 physical damage on impact');
});

test('3.2 Homing projectile tracks high-speed dash (1500 speed) without losing lock or generating NaN', () => {
  const target = createMockHero({ id: 'dashing_target', x: 600, y: 500, z: 0, hp: 1000 });
  const proj = new TowerProjectile({
    towerId: 'tower_proj_2',
    team: 'allied',
    target,
    damage: 150,
    speed: 750,
    x: 500,
    y: 500,
    z: 80
  });

  const dt = 0.01667;
  let ticks = 0;

  // Dash active for 0.25s (15 frames) at 1500 speed in diagonal direction
  while (!proj.hasImpacted && ticks < 300) {
    if (ticks < 15) {
      target.x += 1060 * dt; // ~1500 speed diagonal
      target.y += 1060 * dt;
    }
    proj.update(dt);
    assert(!isNaN(proj.x) && !isNaN(proj.y) && !isNaN(proj.z), `Coordinates must remain finite at tick ${ticks}`);
    ticks++;
  }

  assert(proj.hasImpacted, 'Projectile must catch up and impact after high-speed dash concludes');
  assertEqual(target.hp, 850);
});

test('3.3 Instant blink / flash displacement: Projectile redirects vector instantly', () => {
  const target = createMockHero({ id: 'flashing_target', x: 600, y: 500, z: 0, hp: 1000 });
  const proj = new TowerProjectile({
    towerId: 'tower_proj_3',
    team: 'allied',
    target,
    damage: 150,
    speed: 750,
    x: 500,
    y: 500,
    z: 80
  });

  // Advance 3 frames
  for (let i = 0; i < 3; i++) proj.update(0.01667);

  // Instant Flash 350 units away to (950, 700)
  target.x = 950;
  target.y = 700;

  let ticks = 0;
  while (!proj.hasImpacted && ticks < 200) {
    proj.update(0.01667);
    ticks++;
  }

  assert(proj.hasImpacted, 'Projectile must re-orient and impact flashed target');
  assertCloseTo(proj.x, 950, 5.0, 'Impact X matches flashed target position');
  assertCloseTo(proj.y, 700, 5.0, 'Impact Y matches flashed target position');
});

test('3.4 Mid-air target death dissipation: Projectile dissipates and deals NO overkill damage', () => {
  const target = createMockHero({ id: 'fragile_target', x: 800, y: 800, hp: 100 });
  const proj = new TowerProjectile({
    towerId: 'tower_proj_4',
    team: 'allied',
    target,
    damage: 150,
    speed: 750,
    x: 500,
    y: 500,
    z: 80
  });

  // Advance 5 frames towards target
  for (let i = 0; i < 5; i++) {
    proj.update(0.01667);
    assert(!proj.isDead, 'Projectile should be in flight');
  }

  // Target dies from external source (e.g. minion hit)
  target.hp = 0;
  target.isDead = true;

  // Next projectile update
  proj.update(0.01667);

  assert(proj.isDead, 'Projectile must immediately mark itself dead when target dies');
  assertEqual(proj.hasImpacted, false, 'Dissipated projectile must NOT set hasImpacted');
  assertEqual(target.hp, 0, 'Target HP must not take additional negative overkill damage');
});

test('3.5 Multi-projectile volley overkill dissipation: Only fatal shot deals damage, subsequent dissipate', () => {
  const target = createMockHero({ id: 'boss_target', x: 700, y: 700, hp: 200 });

  const proj1 = new TowerProjectile({ id: 'p1', target, damage: 200, speed: 750, x: 650, y: 650 }); // closer
  const proj2 = new TowerProjectile({ id: 'p2', target, damage: 200, speed: 750, x: 500, y: 500 }); // further
  const proj3 = new TowerProjectile({ id: 'p3', target, damage: 200, speed: 750, x: 400, y: 400 }); // furthest

  const dt = 0.01667;
  let p1Impacted = false;

  for (let tick = 0; tick < 100; tick++) {
    proj1.update(dt);
    proj2.update(dt);
    proj3.update(dt);

    if (proj1.hasImpacted && !p1Impacted) {
      p1Impacted = true;
      assertEqual(target.hp, 0, 'Proj 1 must reduce target HP to 0');
      assert(target.isDead, 'Target must be dead');
    }
  }

  assert(proj1.hasImpacted, 'Proj 1 impacted');
  assert(!proj2.hasImpacted, 'Proj 2 must dissipate mid-air, NOT impact');
  assert(proj2.isDead, 'Proj 2 is dead');
  assert(!proj3.hasImpacted, 'Proj 3 must dissipate mid-air, NOT impact');
  assert(proj3.isDead, 'Proj 3 is dead');
  assertEqual(target.hp, 0, 'Target HP remains strictly 0 without negative overkill');
});

test('3.6 Stone Colossus takes -40% damage from tower projectiles', () => {
  const colossus = createMockBoss({ id: 'colossus_reduction', x: 600, y: 500, hp: 3500, towerDamageReduction: 0.40 });
  const proj = new TowerProjectile({
    towerId: 'tower_proj_5',
    team: 'allied',
    target: colossus,
    damage: 150,
    speed: 750,
    x: 580,
    y: 500,
    z: 80
  });

  while (!proj.hasImpacted) {
    proj.update(0.01667);
  }

  // 150 * (1 - 0.40) = 90.0 damage dealt
  assertEqual(colossus.hp, 3500 - 90, 'Colossus HP must be reduced by exactly 90 (40% reduction of 150)');
});

// ============================================================================
// SECTION 4: STRUCTURE INVULNERABILITY HIERARCHY
// ============================================================================
section('4. Structure Invulnerability Hierarchy');

test('4.1 Allied hierarchy: Outer -> Inner -> Nexus strict sequential vulnerability', () => {
  const { allied } = createTowerHierarchy();
  const { outer, inner, nexus } = allied;

  // Phase 1: All structures intact
  assertEqual(outer.isInvulnerable(), false, 'Outer tower must be vulnerable from match start');
  assertEqual(inner.isInvulnerable(), true, 'Inner tower must be invulnerable while Outer is alive');
  assertEqual(nexus.isInvulnerable(), true, 'Nexus must be invulnerable while Inner is alive');

  // Attempt damage on invulnerable structures
  const innerRes = inner.takeDamage(1000);
  assertEqual(innerRes.damageTaken, 0, 'Invulnerable Inner takes 0 damage');
  assertEqual(innerRes.invulnerable, true);
  assertEqual(inner.hp, 2500);

  const nexusRes = nexus.takeDamage(2000);
  assertEqual(nexusRes.damageTaken, 0, 'Invulnerable Nexus takes 0 damage');
  assertEqual(nexusRes.invulnerable, true);
  assertEqual(nexus.hp, 5000);

  // Phase 2: Destroy Outer Tower
  const outerKill = outer.takeDamage(3000);
  assertEqual(outer.hp, 0);
  assertEqual(outerKill.destroyed, true);

  // Inner tower now vulnerable, Nexus still invulnerable
  assertEqual(inner.isInvulnerable(), false, 'Inner tower becomes vulnerable when Outer falls');
  assertEqual(nexus.isInvulnerable(), true, 'Nexus remains invulnerable while Inner is alive');

  // Damage Inner tower
  inner.takeDamage(1000);
  assertEqual(inner.hp, 1500);

  // Phase 3: Destroy Inner Tower
  inner.takeDamage(2000);
  assertEqual(inner.hp, 0);

  // Allied Nexus now vulnerable
  assertEqual(nexus.isInvulnerable(), false, 'Allied Nexus becomes vulnerable when Inner falls');
  nexus.takeDamage(1500);
  assertEqual(nexus.hp, 3500);
});

test('4.2 Enemy hierarchy: Outer -> Inner -> (Supreme Boss alive -> Nexus immune)', () => {
  let supremeBossAlive = true;
  const { enemy } = createTowerHierarchy({
    isSupremeBossAlive: () => supremeBossAlive
  });
  const { outer, inner, nexus } = enemy;

  // Destroy Outer
  outer.takeDamage(outer.maxHp);
  assertEqual(inner.isInvulnerable(), false, 'Enemy Inner vulnerable after Outer falls');

  // Destroy Inner
  inner.takeDamage(inner.maxHp);
  assertEqual(inner.hp, 0);

  // Supreme Boss is still alive!
  assertEqual(nexus.isInvulnerable(), true, 'Enemy Nexus remains invulnerable while Supreme Boss is alive');
  const immuneDmg = nexus.takeDamage(1000);
  assertEqual(immuneDmg.damageTaken, 0);
  assertEqual(nexus.hp, nexus.maxHp);

  // Slay Supreme Boss
  supremeBossAlive = false;
  assertEqual(nexus.isInvulnerable(), false, 'Enemy Nexus becomes vulnerable once Supreme Boss is slain');

  // Destroy Enemy Nexus
  const fatalDmg = nexus.takeDamage(nexus.maxHp);
  assertEqual(nexus.hp, 0);
  assertEqual(fatalDmg.destroyed, true);
});

test('4.3 Sequence skipping defense: Adversarial bypass attempts fail cleanly', () => {
  let supremeBossAlive = true;
  const { enemy } = createTowerHierarchy({
    isSupremeBossAlive: () => supremeBossAlive
  });
  const { outer, inner, nexus } = enemy;

  // Direct assault on Nexus while both towers alive
  nexus.takeDamage(99999);
  assertEqual(nexus.hp, nexus.maxHp, 'Nexus undamaged when Outer and Inner alive');

  // Direct assault on Inner while Outer alive
  inner.takeDamage(99999);
  assertEqual(inner.hp, inner.maxHp, 'Inner undamaged when Outer alive');

  // Destroy Outer, but attempt Nexus while Inner is intact
  outer.takeDamage(outer.maxHp);
  nexus.takeDamage(99999);
  assertEqual(nexus.hp, nexus.maxHp, 'Nexus undamaged when Outer is down but Inner alive');

  // Slay Supreme Boss prematurely while towers intact
  supremeBossAlive = false;
  nexus.takeDamage(99999);
  assertEqual(nexus.hp, nexus.maxHp, 'Nexus undamaged even if Supreme Boss slain if Inner is alive');
});

test('4.4 Match outcome trigger evaluation matches invulnerability hierarchy', () => {
  // Scenario A: Allied Nexus falls -> Immediate DEFEAT
  const resA = evaluateMatchOutcome(0, 5000, true);
  assertEqual(resA.outcome, 'DEFEAT', 'Allied nexus <= 0 triggers DEFEAT immediately');
  assertEqual(resA.isOver, true);

  // Scenario B: Enemy Nexus down, but Supreme Boss STILL alive -> IN_PROGRESS
  const resB = evaluateMatchOutcome(5000, 0, true);
  assertEqual(resB.outcome, 'IN_PROGRESS', 'Enemy nexus destroyed before boss slain must NOT trigger victory');
  assertEqual(resB.isOver, false);

  // Scenario C: Enemy Nexus down AND Supreme Boss slain -> VICTORY
  const resC = evaluateMatchOutcome(5000, 0, false);
  assertEqual(resC.outcome, 'VICTORY', 'Enemy nexus down and boss slain triggers VICTORY');
  assertEqual(resC.isOver, true);

  // Scenario D: Normal match in progress
  const resD = evaluateMatchOutcome(5000, 5000, true);
  assertEqual(resD.outcome, 'IN_PROGRESS');
  assertEqual(resD.isOver, false);
});

// ============================================================================
// SECTION 5: HIGH-FREQUENCY SIMULATION STRESS & INVARIANT FUZZING
// ============================================================================
section('5. High-Frequency Simulation Stress & Invariant Fuzzing');

test('5.1 1,000 tick continuous simulation: Cooldowns, heat bounds, projectile garbage collection', () => {
  const tower = new DefensiveTower('stress_tower', 'allied', 1600, 1600);
  const target = createMockHero({ id: 'stress_hero', x: 1700, y: 1600, hp: 100000 });

  const start = performance.now();
  for (let tick = 0; tick < 1000; tick++) {
    tower.update(0.01667, [target]);

    // Invariant 1: Heat bonus multiplier never exceeds 2.0x (max 300 damage)
    const dmg = tower.calculateShotDamage(target);
    assert(dmg >= 150 && dmg <= 300, `Damage ${dmg} out of bounds [150, 300] at tick ${tick}`);

    // Invariant 2: Active projectiles pool never leaks (bounded by flight time)
    assert(tower.activeProjectiles.length <= 5, `Projectile accumulation leak: ${tower.activeProjectiles.length}`);

    // Invariant 3: Cooldown timer stays in [0, 1.0]
    assert(tower.cooldownTimer >= -0.01 && tower.cooldownTimer <= 1.0, `Cooldown invalid: ${tower.cooldownTimer}`);
  }
  const elapsed = performance.now() - start;
  assert(elapsed < 100, `1,000 tower simulation ticks took ${elapsed.toFixed(2)}ms, must be < 100ms`);
});

test('5.2 Rapid target cycling fuzzing: 500 random target swaps preserve state integrity', () => {
  const tower = new DefensiveTower('fuzz_tower', 'allied', 1000, 1000);
  const heroes = [];
  for (let i = 0; i < 10; i++) {
    heroes.push(createMockHero({ id: `fuzz_h_${i}`, x: 1050 + (i * 10), y: 1000, hp: 1000 }));
  }

  const start = performance.now();
  for (let i = 0; i < 500; i++) {
    const randomHero = heroes[i % heroes.length];
    const aggressorId = i % 3 === 0 ? randomHero.id : null;
    tower.update(0.01667, heroes, aggressorId);

    // Target must always be valid or null
    if (tower.currentTarget) {
      assert(tower.currentTarget.isAlive(), 'Target must be alive');
      assert(tower.isWithinRange(tower.currentTarget), 'Target must be in range');
    }
  }
  const elapsed = performance.now() - start;
  assert(elapsed < 100, `500 fuzzing cycles took ${elapsed.toFixed(2)}ms`);
});

// ============================================================================
// STRESS TEST SUMMARY & VERDICT
// ============================================================================
console.log(`\n${COLORS.bold}================================================================${COLORS.reset}`);
console.log(`${COLORS.bold}                   STRESS TEST SUMMARY                          ${COLORS.reset}`);
console.log(`${COLORS.bold}================================================================${COLORS.reset}`);
console.log(`Total Stress Tests:  ${testCount}`);
console.log(`Passed:              ${COLORS.green}${passCount}${COLORS.reset}`);
console.log(`Failed:              ${failCount > 0 ? COLORS.red : COLORS.reset}${failCount}${COLORS.reset}`);

if (failures.length > 0) {
  console.log(`\n${COLORS.bold}${COLORS.red}FAILURES DETAIL:${COLORS.reset}`);
  for (const f of failures) {
    console.log(`  ${COLORS.red}✖ ${f.name}${COLORS.reset}`);
    console.log(`    ${f.error.message}`);
  }
  console.log(`\n${COLORS.bold}${COLORS.red}VERDICT: REJECT${COLORS.reset}\n`);
  process.exit(1);
} else {
  console.log(`\n${COLORS.bold}${COLORS.green}>>> EMPIRICAL VERDICT: APPROVE <<<${COLORS.reset}\n`);
  process.exit(0);
}
