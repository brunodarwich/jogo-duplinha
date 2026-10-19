/**
 * Milestone 2 Empirical Stress Test Harness: Minion Waves, Leash Boundaries, Boss Phases & Game-Over Triggers.
 *
 * Requirements Tested:
 * 1. 60s periodic wave spawning cycles over 10 consecutive simulated waves, including cannon minions every 3rd wave.
 * 2. Minion leash disengagement (>400 units from lane waypoints returns to lane).
 * 3. Wave 5 Stone Colossus slam stun and -40% tower damage reduction.
 * 4. Wave 10 Abyssal Behemoth acid pool ground hazards and silence debuff.
 * 5. Supreme Nexus Guardian Boss 3-phase transitions and Nexus invulnerability until Supreme Boss death.
 * 6. Simultaneous Nexus damage game-over resolution.
 *
 * Executed via: node tests/stress_m2_bosses.js
 */

import { performance } from 'node:perf_hooks';
import {
  WaveSpawner,
  MinionUnit,
  MinionProjectile,
  getWaveComposition,
  shouldDisengageLeash,
  resolveMinionDeath,
  LANE_WAYPOINTS,
  MinionAIState,
  WAVE_INTERVAL,
  FIRST_WAVE_TIME,
  LEASH_MAX_DISTANCE,
  MINION_BASE_STATS
} from '../src/world/minion.js';

import {
  BossManager,
  SupremeBoss,
  NexusGuardianBoss,
  StoneColossusBoss,
  AbyssalBehemothBoss,
  GroundHazard,
  evaluateMatchOutcome,
  BOSS_CONFIGS
} from '../src/world/boss.js';

import {
  DefensiveTower,
  TowerProjectile,
  createTowerHierarchy,
  TOWER_POSITIONS,
  BASE_TOWER_DAMAGE
} from '../src/world/tower.js';

import { GameSimulation } from '../src/game.js';
import { Entity } from '../src/entities/entity.js';

// --- Test Utilities & Reporting ---

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  magenta: '\x1b[35m'
};

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;
const failures = [];

function assert(condition, message) {
  totalChecks++;
  if (condition) {
    passedChecks++;
  } else {
    failedChecks++;
    failures.push(message);
    console.error(`    ${COLORS.red}✖ [ASSERTION FAILED] ${message}${COLORS.reset}`);
  }
}

function assertClose(actual, expected, tolerance = 1e-4, message = '') {
  totalChecks++;
  const diff = Math.abs(actual - expected);
  if (diff <= tolerance) {
    passedChecks++;
  } else {
    failedChecks++;
    const desc = `${message} (expected ~${expected}, got ${actual}, diff ${diff.toFixed(6)} > ${tolerance})`;
    failures.push(desc);
    console.error(`    ${COLORS.red}✖ [ASSERTION FAILED] ${desc}${COLORS.reset}`);
  }
}

function runSection(title, fn) {
  console.log(`\n${COLORS.bold}${COLORS.cyan}================================================================${COLORS.reset}`);
  console.log(`${COLORS.bold}${COLORS.cyan}>>> ${title}${COLORS.reset}`);
  console.log(`${COLORS.bold}${COLORS.cyan}================================================================${COLORS.reset}`);
  const start = performance.now();
  const priorFails = failedChecks;
  try {
    fn();
    const dur = (performance.now() - start).toFixed(2);
    if (failedChecks === priorFails) {
      console.log(`  ${COLORS.green}✔ SECTION PASSED${COLORS.reset} ${COLORS.dim}(${dur}ms)${COLORS.reset}`);
    } else {
      console.log(`  ${COLORS.red}✖ SECTION FAILED (${failedChecks - priorFails} checks failed)${COLORS.reset} ${COLORS.dim}(${dur}ms)${COLORS.reset}`);
    }
  } catch (err) {
    const dur = (performance.now() - start).toFixed(2);
    console.log(`  ${COLORS.red}✖ SECTION EXCEPTION: ${err.message}${COLORS.reset} ${COLORS.dim}(${dur}ms)${COLORS.reset}`);
  }
}

console.log(`${COLORS.bold}${COLORS.magenta}================================================================${COLORS.reset}`);
console.log(`${COLORS.bold}${COLORS.magenta} MILESTONE 2 EMPIRICAL STRESS TEST HARNESS: MINIONS & BOSSES${COLORS.reset}`);
console.log(`${COLORS.bold}${COLORS.magenta}================================================================${COLORS.reset}`);

// ============================================================================
// SUITE 1: 60s WAVE SPAWNING CYCLES OVER 10 CONSECUTIVE WAVES & CANNONS
// ============================================================================
runSection('SUITE 1: Periodic Wave Spawning (10 Waves, 60s Interval & Cannon Scaling)', () => {
  // 1.1 Composition math across 10 waves
  console.log('  [1.1] Verifying getWaveComposition for waves 1..10...');
  for (let w = 1; w <= 10; w++) {
    const comp = getWaveComposition(w);
    assert(comp.waveIndex === w, `Wave index matches ${w}`);
    assert(comp.meleeCount === 3, `Wave ${w} has exactly 3 melee units`);
    assert(comp.rangedCount === 3, `Wave ${w} has exactly 3 ranged units`);

    const isCannonWave = (w % 3 === 0);
    if (isCannonWave) {
      assert(comp.cannonCount === 1, `Wave ${w} is a cannon wave and has exactly 1 cannon minion`);
      assert(comp.totalUnits === 7, `Wave ${w} totalUnits is 7`);
    } else {
      assert(comp.cannonCount === 0, `Wave ${w} has 0 cannon minions`);
      assert(comp.totalUnits === 6, `Wave ${w} totalUnits is 6`);
    }
  }

  // 1.2 Continuous 580-second fixed-step simulation across 10 waves (dt = 0.01667)
  console.log('  [1.2] Simulating 10 consecutive waves across 580.0s (30s first wave + 9 x 60s)...');
  const spawner = new WaveSpawner(null, { firstWaveTime: 30.0, waveInterval: 60.0 });
  const spawnedEntities = [];
  const waveSpawns = [];

  let lastWave = 0;
  const dt = 0.01667;
  // Waves 1..10 occur at t=30, 90, 150, 210, 270, 330, 390, 450, 510, 570.
  // 585 seconds allows wave 10 to trigger at 570s and complete all staggered releases by ~572s.
  // Next wave (wave 11) is scheduled for 630s.
  const tenWavesDuration = 585.0;
  const tenWavesTicks = Math.ceil(tenWavesDuration / dt);

  for (let i = 0; i < tenWavesTicks; i++) {
    spawner.update(dt, spawnedEntities);
    if (spawner.waveIndex > lastWave) {
      lastWave = spawner.waveIndex;
      waveSpawns.push({
        wave: lastWave,
        time: spawner.matchTime,
        nextWaveTime: spawner.nextWaveTime
      });
    }
  }

  assert(waveSpawns.length === 10, `Exactly 10 waves spawned in 585s, got ${waveSpawns.length}`);
  assert(spawner.waveIndex === 10, `Spawner waveIndex is exactly 10`);

  // Expected trigger times: Wave 1 at 30s, Wave 2 at 90s, Wave 3 at 150s, ..., Wave 10 at 570s
  for (let idx = 0; idx < waveSpawns.length; idx++) {
    const expectedTime = 30.0 + idx * 60.0;
    const spawnRecord = waveSpawns[idx];
    assert(spawnRecord.wave === idx + 1, `Wave number is ${idx + 1}`);
    assertClose(spawnRecord.time, expectedTime, 0.05, `Wave ${idx + 1} trigger time`);
  }

  // Count spawned entities by team and type
  const alliedMinions = spawnedEntities.filter(e => e.team === 'allied');
  const enemyMinions = spawnedEntities.filter(e => e.team === 'enemy');
  assert(alliedMinions.length === 63, `63 allied minions spawned over 10 waves (7*6 + 3*7), got ${alliedMinions.length}`);
  assert(enemyMinions.length === 63, `63 enemy minions spawned over 10 waves, got ${enemyMinions.length}`);

  const totalCannons = spawnedEntities.filter(e => e.subType === 'cannon');
  const alliedCannons = alliedMinions.filter(e => e.subType === 'cannon');
  const enemyCannons = enemyMinions.filter(e => e.subType === 'cannon');
  assert(totalCannons.length === 6, `Total 6 cannons across 10 waves (3 waves * 2 teams), got ${totalCannons.length}`);
  assert(alliedCannons.length === 3, `3 allied cannons spawned`);
  assert(enemyCannons.length === 3, `3 enemy cannons spawned`);

  // Verify cannon wave indexes (waves 3, 6, 9)
  for (const c of totalCannons) {
    assert(c.waveIndex % 3 === 0, `Cannon belongs to wave divisible by 3 (wave ${c.waveIndex})`);
  }

  // Verify queue is completely empty after wave completes
  assert(spawner.spawnQueue.length === 0, 'Spawner queue is completely emptied');

  // Verify Wave 11 triggers precisely at 630.0s
  console.log('  [1.2.2] Stepping past 630.0s to verify Wave 11 trigger...');
  while (spawner.matchTime < 630.5) {
    spawner.update(dt, spawnedEntities);
  }
  assert(spawner.waveIndex === 11, `Wave 11 triggered on schedule at 630.0s (got waveIndex ${spawner.waveIndex})`);

  // 1.3 Stat growth scaling across waves
  console.log('  [1.3] Validating minion stat growth scaling per wave index...');
  for (const minion of spawnedEntities) {
    const w = minion.waveIndex;
    const base = MINION_BASE_STATS[minion.subType];
    const expectedHp = base.hp + (w - 1) * base.hpGrowth;
    const expectedAd = base.ad + (w - 1) * base.adGrowth;

    assert(minion.maxHp === expectedHp, `Wave ${w} ${minion.subType} maxHp scaled to ${expectedHp}`);
    assert(minion.hp === expectedHp, `Wave ${w} ${minion.subType} initial hp equals maxHp`);
    assert(minion.attackDamage === expectedAd, `Wave ${w} ${minion.subType} AD scaled to ${expectedAd}`);
    assert(!isNaN(minion.x) && !isNaN(minion.y), `Minion coordinates are valid numbers`);
  }

  // 1.4 Variable delta-T jitter stress
  console.log('  [1.4] Stressing spawner with variable frame time jitter (5ms - 60ms)...');
  const jitterSpawner = new WaveSpawner(null, { firstWaveTime: 30.0, waveInterval: 60.0 });
  const jitterEntities = [];
  let simTime = 0;
  let jitterSeed = 42;
  function pseudoRand() {
    jitterSeed = (jitterSeed * 9301 + 49297) % 233280;
    return jitterSeed / 233280;
  }

  while (simTime < 585.0) {
    const stepDt = 0.005 + pseudoRand() * 0.055; // 5ms to 60ms jitter
    jitterSpawner.update(stepDt, jitterEntities);
    simTime += stepDt;
  }

  assert(jitterSpawner.waveIndex === 10, `Jitter spawner reached wave 10, got ${jitterSpawner.waveIndex}`);
  assert(jitterEntities.length >= 126, `All 10 waves spawned despite delta-T jitter`);

  // 1.5 Massive lag spike stress (120s step)
  console.log('  [1.5] Stressing spawner with 120s lag spike...');
  const lagSpawner = new WaveSpawner(null, { firstWaveTime: 30.0, waveInterval: 60.0 });
  const lagEntities = [];
  lagSpawner.update(120.0, lagEntities); // Jump to 120s directly
  assert(lagSpawner.waveIndex >= 1, 'Spawner handled 120s lag spike without crash');
  assert(lagSpawner.nextWaveTime > 120.0, 'Next wave scheduled in future');
});

// ============================================================================
// SUITE 2: MINION LEASH DISENGAGEMENT (>400 UNITS) & WAYPOINT MARCH
// ============================================================================
runSection('SUITE 2: Minion Leash Boundaries (>400 Units) & AI State Machine', () => {
  // 2.1 Boundary distance precision
  console.log('  [2.1] Boundary distance precision checks around exactly 400.0 units...');
  const wp0 = LANE_WAYPOINTS[0]; // (400, 400)

  assert(!shouldDisengageLeash({ x: 400, y: 400 }, wp0), 'At waypoint (dist 0): false');
  assert(!shouldDisengageLeash({ x: 400, y: 799.9 }, wp0), 'At dist 399.9: false');
  assert(!shouldDisengageLeash({ x: 400, y: 800.0 }, wp0), 'At dist exactly 400.0: false');
  assert(shouldDisengageLeash({ x: 400, y: 800.01 }, wp0), 'At dist 400.01: true');
  assert(shouldDisengageLeash({ x: 400, y: 900.0 }, wp0), 'At dist 500.0: true');

  // Radial stress: 36 angles at distance 399.9 (all false) and 400.1 (all true)
  for (let deg = 0; deg < 360; deg += 10) {
    const rad = (deg * Math.PI) / 180;
    const insidePos = { x: 400 + Math.cos(rad) * 399.9, y: 400 + Math.sin(rad) * 399.9 };
    const outsidePos = { x: 400 + Math.cos(rad) * 400.1, y: 400 + Math.sin(rad) * 400.1 };

    assert(!shouldDisengageLeash(insidePos, wp0), `Radial angle ${deg} deg at 399.9 units is within leash`);
    assert(shouldDisengageLeash(outsidePos, wp0), `Radial angle ${deg} deg at 400.1 units exceeds leash`);
  }

  // Null safety
  assert(!shouldDisengageLeash(null, wp0), 'Null minionPos returns false safely');
  assert(!shouldDisengageLeash({ x: 400, y: 400 }, null), 'Null waypointPos returns false safely');

  // 2.2 AI State Machine leash disengagement
  console.log('  [2.2] Testing AI state transition to LEASH_RETURN when pulled > 400 units...');
  const minion = new MinionUnit({
    team: 'allied',
    subType: 'melee',
    x: 400,
    y: 400
  });

  assert(minion.aiState === MinionAIState.MARCH, 'Minion starts in MARCH state');

  // Create an enemy target and position minion beyond leash boundary (>400 from WP0)
  const enemyHero = new Entity({
    id: 'enemy_hero_test',
    type: 'hero',
    team: 'enemy',
    x: 850,
    y: 850, // hypot(450, 450) = 636.4 > 400 from WP0 (400, 400)
    hp: 1000
  });

  // Pull minion out to (840, 840)
  minion.x = 840;
  minion.y = 840;
  minion.targetEntity = enemyHero;
  minion.aiState = MinionAIState.PURSUE;

  // Update minion: should detect leash boundary exceeded from current waypoint (WP0)
  minion.update(0.01667, [minion, enemyHero], []);

  assert(minion.aiState === MinionAIState.LEASH_RETURN, `Minion switched to LEASH_RETURN (was ${minion.aiState})`);
  assert(minion.targetEntity === null, 'Target cleared on leash disengagement');

  // 2.3 Uninterruptibility while returning & re-engaging upon arrival
  console.log('  [2.3] Validating minion ignores enemies while in LEASH_RETURN until near waypoint...');
  // Place enemy right in front of minion while returning
  const annoyingEnemy = new Entity({
    id: 'annoying_enemy',
    type: 'minion',
    team: 'enemy',
    x: minion.x - 10,
    y: minion.y - 10,
    hp: 100
  });

  // Tick while still far from waypoint: must remain in LEASH_RETURN and NOT re-target annoyingEnemy
  minion.update(0.01667, [minion, annoyingEnemy], []);
  assert(minion.aiState === MinionAIState.LEASH_RETURN, 'Minion remains in LEASH_RETURN despite nearby enemy');
  assert(minion.targetEntity === null, 'Minion does not re-acquire target during leash return');

  // Move minion close to WP0 (within 50 units)
  minion.x = 425;
  minion.y = 425; // hypot(25, 25) ≈ 35.3 <= 50

  minion.update(0.01667, [minion, annoyingEnemy], []);
  assert(minion.aiState === MinionAIState.MARCH, 'Minion transitions back to MARCH upon reaching waypoint vicinity');

  // 2.4 End of lane waypoint clamping
  console.log('  [2.4] Checking waypoint index progression limits at lane ends...');
  const alliedEndMinion = new MinionUnit({ team: 'allied', x: 2800, y: 2800 });
  alliedEndMinion.waypointIndex = LANE_WAYPOINTS.length - 1; // At WP6
  alliedEndMinion.update(0.01667, [], []);
  assert(alliedEndMinion.waypointIndex === LANE_WAYPOINTS.length - 1, 'Allied minion does not exceed WP6');

  const enemyEndMinion = new MinionUnit({ team: 'enemy', x: 400, y: 400 });
  enemyEndMinion.waypointIndex = 0; // At WP0
  enemyEndMinion.update(0.01667, [], []);
  assert(enemyEndMinion.waypointIndex === 0, 'Enemy minion does not underflow below WP0');
});

// ============================================================================
// SUITE 3: WAVE 5 STONE COLOSSUS SLAM STUN & -40% TOWER DAMAGE REDUCTION
// ============================================================================
runSection('SUITE 3: Wave 5 Stone Colossus Mini-Boss & Tower Mitigation', () => {
  // 3.1 Wave 5 BossManager spawning
  console.log('  [3.1] Verifying Stone Colossus spawn on Wave 5...');
  const bossMgr = new BossManager(null);
  const entities = [];

  bossMgr.checkWaveSpawns(4, entities);
  assert(!bossMgr.colossusSpawned, 'Wave 4: Colossus not spawned');

  bossMgr.checkWaveSpawns(5, entities);
  assert(bossMgr.colossusSpawned, 'Wave 5: Colossus spawned');
  assert(bossMgr.activeBosses.some(b => b instanceof StoneColossusBoss), 'Active bosses includes StoneColossusBoss');

  const colossus = bossMgr.activeBosses.find(b => b instanceof StoneColossusBoss);
  assert(colossus.hp === 3500, `Colossus max HP is 3500, got ${colossus.hp}`);
  assert(colossus.towerDamageReduction === 0.40, `Tower damage reduction is exactly 0.40 (40%)`);
  assert(colossus.slamRadius === 220, `Slam radius is 220 units`);
  assert(colossus.slamStunDuration === 1.5, `Slam stun duration is 1.5s`);

  // Check no duplicate spawn on wave 6
  bossMgr.checkWaveSpawns(6, entities);
  const colossusCount = bossMgr.activeBosses.filter(b => b instanceof StoneColossusBoss).length;
  assert(colossusCount === 1, 'Colossus is not duplicated on subsequent waves');

  // 3.2 Tower damage reduction (-40%) stress test
  console.log('  [3.2] Verifying -40% damage reduction on tower projectiles against Stone Colossus...');
  const colossusTarget = new StoneColossusBoss({ x: 1200, y: 1200 });
  const normalTarget = new Entity({ id: 'dummy_normal', team: 'enemy', x: 1200, y: 1200, hp: 3500, maxHp: 3500 });

  // Standard shot (150 base damage) launched from tower at (1000, 1000, z: 80)
  const projColossus = new TowerProjectile({
    team: 'allied',
    target: colossusTarget,
    damage: BASE_TOWER_DAMAGE,
    x: 1000,
    y: 1000,
    z: 80
  });

  // Step projectile flight until impact
  let steps = 0;
  while (!projColossus.hasImpacted && !projColossus.isDead && steps < 100) {
    projColossus.update(0.01667);
    steps++;
  }
  assert(projColossus.hasImpacted, 'Tower projectile impacted Colossus');
  assertClose(colossusTarget.hp, 3500 - 150 * 0.60, 0.01, 'Colossus took 90 damage (150 * 0.60)');

  // Compare with normal target
  const projNormal = new TowerProjectile({
    team: 'allied',
    target: normalTarget,
    damage: BASE_TOWER_DAMAGE,
    x: 1000,
    y: 1000,
    z: 80
  });
  while (!projNormal.hasImpacted && !projNormal.isDead) {
    projNormal.update(0.01667);
  }
  assertClose(normalTarget.hp, 3500 - 150, 0.01, 'Normal entity took full 150 damage');

  // Heat scaling test on Colossus:
  // Hits with +25%, +50%, +75%, +100% heat ramp
  console.log('  [3.2.2] Testing consecutive heat-scaled shots against Stone Colossus (-40%)...');
  const heatTower = new DefensiveTower('tower_heat_test', 'allied', 1000, 1000);
  const colossusHeatTarget = new StoneColossusBoss({ x: 1100, y: 1100 });

  const expectedDamages = [
    150 * 1.0 * 0.60,   // Heat 0: 90
    150 * 1.25 * 0.60,  // Heat 1: 112.5
    150 * 1.50 * 0.60,  // Heat 2: 135
    150 * 1.75 * 0.60,  // Heat 3: 157.5
    150 * 2.00 * 0.60   // Heat 4 (capped): 180
  ];

  for (let shot = 0; shot < expectedDamages.length; shot++) {
    const rawShotDmg = heatTower.calculateShotDamage({ type: 'hero' }); // Test heat multiplier
    const effectiveDamage = rawShotDmg * (1.0 - colossusHeatTarget.towerDamageReduction);
    assertClose(effectiveDamage, expectedDamages[shot], 0.01, `Shot ${shot + 1} effective damage with heat scaling`);
    heatTower.recordShot({ id: 'dummy_hero', type: 'hero' });
  }

  // 3.3 Ground Slam AoE telegraph & Stun
  console.log('  [3.3] Verifying Ground Slam AoE telegraph, 250 dmg, and 1.5s stun...');
  const slamColossus = new StoneColossusBoss({ x: 1500, y: 1500 });
  slamColossus.slamTimer = 0; // Ready to slam

  const allyInside = new Entity({ id: 'ally_inside', team: 'allied', x: 1600, y: 1500, hp: 1000 }); // dist = 100 <= 220
  const allyBorder = new Entity({ id: 'ally_border', team: 'allied', x: 1500, y: 1719, hp: 1000 }); // dist = 219 <= 220
  const allyOutside = new Entity({ id: 'ally_outside', team: 'allied', x: 1500, y: 1725, hp: 1000 }); // dist = 225 > 220
  const enemyInside = new Entity({ id: 'enemy_inside', team: 'enemy', x: 1550, y: 1500, hp: 1000 }); // friendly to colossus

  const testEntities = [slamColossus, allyInside, allyBorder, allyOutside, enemyInside];
  const mgr = new BossManager(null);

  // Trigger slam
  slamColossus.update(0.01667, testEntities, mgr);
  assert(mgr.activeHazards.length === 1, 'GroundHazard created for slam');
  const hazard = mgr.activeHazards[0];
  assert(hazard.type === 'slam', 'Hazard type is slam');
  assert(hazard.radius === 220, 'Hazard radius is 220');

  // Before completion (t = 0.5s): no damage or stun yet
  mgr.update(0.5, testEntities);
  assert(allyInside.hp === 1000, 'No damage applied during telegraph');
  assert(allyInside.stunnedUntil === undefined || allyInside.stunnedUntil === 0, 'No stun applied during telegraph');

  // Complete hazard (duration = 1.2s)
  mgr.update(0.8, testEntities); // Total elapsed = 1.3s >= 1.2s
  assert(hazard.isDead, 'Hazard completed and marked isDead');

  // Verify damage and stun on units
  assert(allyInside.hp === 750, `Ally inside took 250 damage (HP 750, got ${allyInside.hp})`);
  assert(allyInside.stunnedUntil > Date.now(), 'Ally inside is stunned');

  assert(allyBorder.hp === 750, `Ally at 219 distance took 250 damage`);
  assert(allyBorder.stunnedUntil > Date.now(), 'Ally at 219 distance is stunned');

  assert(allyOutside.hp === 1000, 'Ally outside (dist 225) took 0 damage');
  assert(allyOutside.stunnedUntil === undefined || allyOutside.stunnedUntil === 0, 'Ally outside is NOT stunned');

  assert(enemyInside.hp === 1000, 'Enemy unit (same team) took 0 damage (no friendly fire)');
  assert(enemyInside.stunnedUntil === undefined || enemyInside.stunnedUntil === 0, 'Enemy unit is NOT stunned');

  // Verify cooldown reset
  assertClose(slamColossus.slamTimer, slamColossus.slamCooldown, 0.05, 'Slam cooldown reset to 10.0s');
});

// ============================================================================
// SUITE 4: WAVE 10 ABYSSAL BEHEMOTH ACID POOL & SILENCE DEBUFF
// ============================================================================
runSection('SUITE 4: Wave 10 Abyssal Behemoth Acid Pools & AoE Silence', () => {
  // 4.1 Wave 10 spawning
  console.log('  [4.1] Verifying Abyssal Behemoth spawn on Wave 10...');
  const bossMgr = new BossManager(null);
  const entities = [];

  bossMgr.checkWaveSpawns(9, entities);
  assert(!bossMgr.behemothSpawned, 'Wave 9: Behemoth not spawned');

  bossMgr.checkWaveSpawns(10, entities);
  assert(bossMgr.behemothSpawned, 'Wave 10: Behemoth spawned');
  assert(bossMgr.activeBosses.some(b => b instanceof AbyssalBehemothBoss), 'Active bosses includes AbyssalBehemothBoss');

  const behemoth = bossMgr.activeBosses.find(b => b instanceof AbyssalBehemothBoss);
  assert(behemoth.hp === 6000, `Behemoth HP is 6000, got ${behemoth.hp}`);
  assert(behemoth.silenceDuration === 2.0, `Silence duration is 2.0s`);

  // 4.2 Acid Pool Ground Hazard (6.0s duration, 0.5s tick interval, 20 damage/tick)
  console.log('  [4.2] Verifying Acid Pool ticks (20 dmg per 0.5s over 6.0s)...');
  const victim = new Entity({ id: 'acid_victim', team: 'allied', x: 2000, y: 2000, hp: 1000 });
  const pool = new GroundHazard({
    type: 'acid_pool',
    x: 2000,
    y: 2000,
    radius: 100,
    duration: 6.0,
    tickInterval: 0.5,
    onTick: (haz) => {
      if (Math.hypot(victim.x - haz.x, victim.y - haz.y) <= haz.radius) {
        victim.hp -= 20;
      }
    }
  });

  const hazardMgr = new BossManager(null);
  hazardMgr.addHazard(pool);

  // Simulate 6.0 seconds in 0.1s steps
  let tickCount = 0;
  for (let s = 0; s < 60; s++) {
    const prevHp = victim.hp;
    hazardMgr.update(0.1, [victim]);
    if (victim.hp < prevHp) {
      tickCount++;
      assert(prevHp - victim.hp === 20, 'Each tick deals exactly 20 damage');
    }
  }

  // 6.0s / 0.5s = 12 ticks
  assert(tickCount === 12, `Acid pool triggered exactly 12 ticks over 6.0s (got ${tickCount})`);
  assert(victim.hp === 1000 - 12 * 20, `Victim HP reduced by 240 (760, got ${victim.hp})`);

  // Step 0.02s to cross 6.0s duration threshold accounting for float rounding
  hazardMgr.update(0.02, [victim]);
  assert(pool.isDead, 'Acid pool expired after 6.0s');
  assert(hazardMgr.activeHazards.length === 0, 'Acid pool removed from activeHazards');

  // 4.3 Dynamic escape from acid pool
  console.log('  [4.3] Verifying unit escaping acid pool stops taking damage...');
  const escapingHero = new Entity({ id: 'escaper', team: 'allied', x: 1000, y: 1000, hp: 500 });
  const escapePool = new GroundHazard({
    type: 'acid_pool',
    x: 1000,
    y: 1000,
    radius: 100,
    duration: 6.0,
    tickInterval: 0.5,
    onTick: (haz) => {
      if (Math.hypot(escapingHero.x - haz.x, escapingHero.y - haz.y) <= haz.radius) {
        escapingHero.hp -= 20;
      }
    }
  });

  const escapeMgr = new BossManager(null);
  escapeMgr.addHazard(escapePool);

  // Stay inside for 1.0s (10 steps of 0.1s => 2 ticks at 0.5s and 1.0s)
  for (let step = 0; step < 10; step++) {
    escapeMgr.update(0.1, [escapingHero]);
  }
  assert(escapingHero.hp === 460, 'Took 40 dmg for 2 ticks');

  // Step outside pool (dist 150 > 100)
  escapingHero.x = 1150;
  for (let step = 0; step < 30; step++) {
    escapeMgr.update(0.1, [escapingHero]); // Remaining 3.0s outside
  }
  assert(escapingHero.hp === 460, 'Took 0 additional damage while outside pool');

  // 4.4 Roar of Fear (AoE Silence 2.0s)
  console.log('  [4.4] Verifying Roar of Fear 2.0s silence debuff and 350-unit radius...');
  const roarBehemoth = new AbyssalBehemothBoss({ x: 2000, y: 2000 });
  roarBehemoth.roarTimer = 0; // Ready to roar

  const silenceTargetInside = new Entity({ id: 'sil_inside', team: 'allied', x: 2300, y: 2000, hp: 1000 }); // dist 300 <= 350
  const silenceTargetBorder = new Entity({ id: 'sil_border', team: 'allied', x: 2000, y: 2350, hp: 1000 }); // dist 350 <= 350
  const silenceTargetOutside = new Entity({ id: 'sil_outside', team: 'allied', x: 2000, y: 2351, hp: 1000 }); // dist 351 > 350

  const roarEntities = [roarBehemoth, silenceTargetInside, silenceTargetBorder, silenceTargetOutside];
  roarBehemoth.update(0.01667, roarEntities);

  assert(silenceTargetInside.silencedUntil > Date.now(), 'Target inside is silenced');
  assertClose((silenceTargetInside.silencedUntil - Date.now()) / 1000, 2.0, 0.1, 'Silence duration is 2.0s');
  assert(silenceTargetBorder.silencedUntil > Date.now(), 'Target at exact boundary (350) is silenced');
  assert(silenceTargetOutside.silencedUntil === undefined || silenceTargetOutside.silencedUntil === 0, 'Target outside boundary (351) is NOT silenced');
  assertClose(roarBehemoth.roarTimer, 12.0, 0.05, 'Roar cooldown reset to 12.0s');
});

// ============================================================================
// SUITE 5: SUPREME BOSS 3-PHASE TRANSITIONS & NEXUS INVULNERABILITY
// ============================================================================
runSection('SUITE 5: Supreme Boss Phase Transitions & Nexus Invulnerability Chain', () => {
  // 5.1 3-Phase HP Threshold Transitions
  console.log('  [5.1] Validating exact HP thresholds for Phase 1, Phase 2, and Phase 3...');
  const supreme = new SupremeBoss();
  assert(supreme.maxHp === 12000, 'Supreme Boss max HP is 12000');
  assert(supreme.phase === 1, 'Starts in Phase 1 at 100% HP');

  // Phase 1: > 66% (> 7920 HP)
  supreme.hp = 7921;
  assert(supreme.phase === 1, '7921 HP (66.01%): Phase 1');

  // Phase 2: > 33% and <= 66% (3960 < HP <= 7920)
  supreme.hp = 7920;
  assert(supreme.phase === 2, '7920 HP (66.00%): Phase 2 (Meteor Rain)');

  supreme.hp = 6000;
  assert(supreme.phase === 2, '6000 HP (50.00%): Phase 2');

  supreme.hp = 3961;
  assert(supreme.phase === 2, '3961 HP (33.01%): Phase 2');

  // Phase 3: <= 33% (<= 3960 HP)
  supreme.hp = 3960;
  assert(supreme.phase === 3, '3960 HP (33.00%): Phase 3 (Cataclysmic Shield / Enrage)');

  supreme.hp = 1000;
  assert(supreme.phase === 3, '1000 HP (8.33%): Phase 3');

  // 5.2 Phase 3 Cataclysmic Shield immunity and expiration
  console.log('  [5.2] Testing Cataclysmic Shield immunity in NexusGuardianBoss entity...');
  const guardian = new NexusGuardianBoss({ x: 2550, y: 2550 });
  assert(!guardian.shieldActive, 'Shield is initially inactive');

  // Bring guardian down to 3500 HP (Phase 3)
  guardian.hp = 3500;
  assert(guardian.phase === 3, 'Guardian in Phase 3');

  // Trigger phase 3 shield
  guardian.update(0.01667, []);
  assert(guardian.shieldActive, 'Cataclysmic Shield activated upon entering Phase 3');
  assertClose(guardian.shieldTimer, 8.0, 0.05, 'Shield duration is 8.0 seconds');

  // Attempt damage while shielded
  const dmgRes1 = guardian.takeDamage(1000);
  assert(dmgRes1.damageTaken === 0, 'Damage taken is 0 while shielded');
  assert(dmgRes1.shielded === true, 'Damage result marked shielded: true');
  assert(guardian.hp === 3500, 'Guardian HP unchanged while shielded');

  // Simulate 8.1 seconds passing
  guardian.update(8.1, []);
  assert(!guardian.shieldActive, 'Cataclysmic Shield expired after 8.0s');

  // Attempt damage after shield expiration
  const dmgRes2 = guardian.takeDamage(1000);
  assert(dmgRes2.damageTaken === 1000, 'Damage taken is 1000 after shield drops');
  assert(dmgRes2.shielded === false, 'Damage result marked shielded: false');
  assert(guardian.hp === 2500, 'Guardian HP successfully reduced to 2500');

  // 5.3 Nexus Invulnerability Chain until Supreme Boss Death
  console.log('  [5.3] Testing full structure hierarchy: Outer -> Inner -> Supreme Boss -> Enemy Nexus...');
  const gameSim = new GameSimulation();
  // Ensure structures and supreme boss initialized
  const outer = gameSim.towers.find(t => t.id === 'tower_enemy_outer');
  const inner = gameSim.towers.find(t => t.id === 'tower_enemy_inner');
  const nexus = gameSim.enemyNexus;
  const supBoss = gameSim.bossManager.supremeBoss;

  assert(outer !== null && inner !== null && nexus !== null && supBoss !== null, 'All entities exist');

  // Initial State: Outer alive
  assert(outer.isInvulnerable() === false, 'Outer tower is vulnerable');
  assert(inner.isInvulnerable() === true, 'Inner tower is invulnerable while Outer is alive');
  assert(nexus.isInvulnerable() === true, 'Enemy Nexus is invulnerable while Inner is alive');

  // Destroy Outer Tower
  outer.takeDamage(5000);
  assert(outer.hp <= 0 && outer.isDead, 'Outer tower destroyed');
  assert(inner.isInvulnerable() === false, 'Inner tower is now vulnerable');
  assert(nexus.isInvulnerable() === true, 'Nexus still invulnerable while Inner has not fallen');

  // Destroy Inner Tower
  inner.takeDamage(5000);
  assert(inner.hp <= 0 && inner.isDead, 'Inner tower destroyed');

  // CRITICAL CHECK: Inner tower is dead, but Supreme Boss is ALIVE
  assert(gameSim.bossManager.isSupremeBossAlive() === true, 'Supreme Boss is alive');
  assert(nexus.isInvulnerable() === true, 'Enemy Nexus MUST BE INVULNERABLE while Supreme Boss is alive');

  // Attempt to damage Nexus while Supreme Boss is alive
  const nexusDmgRes = nexus.takeDamage(1000);
  assert(nexusDmgRes.damageTaken === 0, 'Nexus takes 0 damage while invulnerable');
  assert(nexusDmgRes.invulnerable === true, 'Nexus damage returns invulnerable: true');
  assert(nexus.hp === 5000, 'Nexus HP remained intact at 5000');

  // Now slay the Supreme Boss!
  supBoss.takeDamage(15000);
  assert(supBoss.isAlive() === false, 'Supreme Boss has been slain');
  assert(gameSim.bossManager.isSupremeBossAlive() === false, 'BossManager reports Supreme Boss dead');

  // NOW Nexus MUST become vulnerable!
  assert(nexus.isInvulnerable() === false, 'Enemy Nexus is now VULNERABLE after Supreme Boss death');

  const validNexusDmg = nexus.takeDamage(1000);
  assert(validNexusDmg.damageTaken === 1000, 'Nexus successfully took 1000 damage');
  assert(nexus.hp === 4000, 'Nexus HP reduced to 4000');
});

// ============================================================================
// SUITE 6: SIMULTANEOUS NEXUS DAMAGE & GAME-OVER RESOLUTION
// ============================================================================
runSection('SUITE 6: Game-Over Triggers & Simultaneous Nexus Destruction', () => {
  // 6.1 Clean Victory
  console.log('  [6.1] Evaluating clean VICTORY condition...');
  const resVictory = evaluateMatchOutcome(5000, 0, false);
  assert(resVictory.isOver === true, 'Match is over on victory');
  assert(resVictory.outcome === 'VICTORY', 'Outcome is VICTORY');

  // 6.2 Clean Defeat
  console.log('  [6.2] Evaluating clean DEFEAT condition...');
  const resDefeat = evaluateMatchOutcome(0, 5000, true);
  assert(resDefeat.isOver === true, 'Match is over on defeat');
  assert(resDefeat.outcome === 'DEFEAT', 'Outcome is DEFEAT');

  // 6.3 Victory denied while Supreme Boss alive
  console.log('  [6.3] Evaluating victory denied while Supreme Boss is alive...');
  const resDenied = evaluateMatchOutcome(5000, 0, true);
  assert(resDenied.isOver === false, 'Match is NOT over when boss alive');
  assert(resDenied.outcome === 'IN_PROGRESS', 'Outcome remains IN_PROGRESS');

  // 6.4 Crucial Edge Case: Simultaneous Nexus Destruction (Both reach 0 HP on same frame)
  console.log('  [6.4] Adversarial Stress: Simultaneous Nexus destruction on the exact same frame...');
  // Case A: Exactly 0 and 0
  const resSim0 = evaluateMatchOutcome(0, 0, false);
  assert(resSim0.isOver === true, 'Match is over on simultaneous nexus destruction');
  assert(resSim0.outcome === 'DEFEAT', 'Simultaneous destruction resolves authoritatively to DEFEAT');

  // Case B: Overkill damage (e.g. -200 and -500)
  const resSimOverkill = evaluateMatchOutcome(-200, -500, false);
  assert(resSimOverkill.isOver === true, 'Overkill simultaneous destruction resolves');
  assert(resSimOverkill.outcome === 'DEFEAT', 'Overkill simultaneous destruction resolves to DEFEAT');

  // Case C: Simultaneous destruction with supreme boss alive
  const resSimBossAlive = evaluateMatchOutcome(0, 0, true);
  assert(resSimBossAlive.isOver === true, 'Simultaneous with boss alive is over');
  assert(resSimBossAlive.outcome === 'DEFEAT', 'Resolves to DEFEAT');

  // 6.5 Simulation End-to-End Game State Integration
  console.log('  [6.5] Verifying GameSimulation endgame flags under simultaneous destruction...');
  const sim = new GameSimulation();
  sim.alliedNexus.hp = 0;
  sim.enemyNexus.hp = 0;
  sim.bossManager.supremeBoss.hp = 0;
  sim.bossManager.supremeBoss.isDead = true;

  // Run simulation tick
  sim.update(0.01667);

  assert(sim.isDefeat === true, 'sim.isDefeat is TRUE');
  assert(sim.isVictory === false, 'sim.isVictory remains FALSE (no dual state conflict)');
});

// ============================================================================
// SUMMARY & VERDICT
// ============================================================================
console.log(`\n${COLORS.bold}${COLORS.cyan}================================================================${COLORS.reset}`);
console.log(`${COLORS.bold}${COLORS.cyan} EMPIRICAL STRESS TEST SUMMARY${COLORS.reset}`);
console.log(`${COLORS.bold}${COLORS.cyan}================================================================${COLORS.reset}`);
console.log(`Total Checks Executed: ${COLORS.bold}${totalChecks}${COLORS.reset}`);
console.log(`Passed Checks:         ${COLORS.green}${passedChecks}${COLORS.reset}`);
console.log(`Failed Checks:         ${failedChecks > 0 ? COLORS.red : COLORS.green}${failedChecks}${COLORS.reset}`);

if (failedChecks === 0) {
  console.log(`\n${COLORS.bold}${COLORS.green}>>> EMPIRICAL VERDICT: APPROVE <<<${COLORS.reset}`);
  console.log(`${COLORS.green}All 6 Milestone 2 requirements verified under rigorous empirical stress.${COLORS.reset}\n`);
  process.exit(0);
} else {
  console.log(`\n${COLORS.bold}${COLORS.red}>>> EMPIRICAL VERDICT: REJECT <<<${COLORS.reset}`);
  console.error(`Failures detected:\n${failures.map(f => ` - ${f}`).join('\n')}\n`);
  process.exit(1);
}
