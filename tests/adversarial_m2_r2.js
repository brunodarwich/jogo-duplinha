import { DefensiveTower, TowerProjectile, createTowerHierarchy, TOWER_RADIUS, BASE_TOWER_DAMAGE } from '../src/world/tower.js';
import { MinionUnit, WaveSpawner, MinionAIState, getWaveComposition, shouldDisengageLeash, resolveMinionDeath, LANE_WAYPOINTS } from '../src/world/minion.js';
import { BOSS_CONFIGS, SupremeBoss, StoneColossusBoss, AbyssalBehemothBoss, NexusGuardianBoss, BossManager, GroundHazard, evaluateMatchOutcome } from '../src/world/boss.js';
import { GameMap, MAP_BOUNDS, isInsideAlliedFountain, isInsideEnemyFountain, distanceToLane, isInsideLane } from '../src/world/map.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    failed++;
    console.error(`\x1b[31m✖ FAIL:\x1b[0m ${message}`);
    throw new Error(`FAIL: ${message}`);
  } else {
    passed++;
    console.log(`\x1b[32m✔ PASS:\x1b[0m ${message}`);
  }
}

console.log('================================================================');
console.log(' ADVERSARIAL STRESS TEST SUITE: REVIEWER 2 (MILISTONE 2)');
console.log('================================================================\n');

// ─────────────────────────────────────────────────────────────────────────────
// 1. TOWER AGGRO HIERARCHY & STRESS
// ─────────────────────────────────────────────────────────────────────────────
console.log('>>> [1/5] Testing Tower Aggro Hierarchy & Targeting Invariants...');

{
  const tower = new DefensiveTower('test_tower_1', 'allied', 1000, 1000);

  // 1.1 Range boundary checks
  assert(tower.isWithinRange({ x: 1000, y: 1400 }) === true, 'Entity at exact 400 boundary is within range');
  assert(tower.isWithinRange({ x: 1000, y: 1400.1 }) === false, 'Entity at 400.1 is outside range');
  assert(tower.isWithinRange(null) === false, 'Null entity returns false for isWithinRange');
  assert(tower.isWithinRange({ x: NaN, y: 1000 }) === false, 'NaN coord returns false');

  // 1.2 Empty / dead enemies handling
  assert(tower.selectTarget([]) === null, 'Empty enemy list returns null target');
  try {
    tower.selectTarget(null);
    assert(false, 'selectTarget(null) did not throw');
  } catch (err) {
    assert(err instanceof TypeError, 'selectTarget(null) throws TypeError (enemiesInRange null guard missing)');
  }

  // 1.3 Peacetime: Minion vs Hero distance arbitration
  // Even if hero is much closer (dist 100) than minion (dist 350), peacetime MUST target minion
  const closeHero = { id: 'hero_close', type: 'hero', x: 1050, y: 1050, hp: 1000 };
  const farMinion = { id: 'minion_far', type: 'minion', x: 1300, y: 1000, hp: 300 };
  let target = tower.selectTarget([closeHero, farMinion]);
  assert(target.id === 'minion_far', 'Tower strictly prioritizes minion over hero in peacetime regardless of distance');

  // 1.4 Call for Help: Aggressor attacking ally IMMEDIATELY preempts active minion lock
  // Active target is currently farMinion. Now hero attacks ally:
  target = tower.selectTarget([closeHero, farMinion], 'hero_close');
  assert(target.id === 'hero_close', 'Call for Help preempts active minion lock and switches to aggressor hero');

  // 1.5 Non-hero Call for Help is rejected
  tower.currentTarget = null;
  target = tower.selectTarget([closeHero, farMinion], 'minion_far');
  assert(target.id === 'minion_far', 'Non-hero cannot claim Call for Help priority (targets minion via normal rule)');

  // 1.6 Sticky Target Lock
  // While locked on closeHero, another minion enters:
  tower.currentTarget = closeHero;
  const newMinion = { id: 'minion_new', type: 'minion', x: 1010, y: 1010, hp: 300 };
  target = tower.selectTarget([closeHero, farMinion, newMinion]);
  assert(target.id === 'hero_close', 'Tower maintains sticky lock on hero once targeted until dead or out of range');

  // 1.7 Current target leaves range
  closeHero.x = 2000; // moves far away
  target = tower.selectTarget([closeHero, farMinion, newMinion]);
  assert(target.id === 'minion_new', 'When previous target leaves range, switches to closest minion in range');

  // 1.8 Unit attacking tower priority
  tower.currentTarget = null;
  const attackingMinion = { id: 'minion_atk', type: 'minion', x: 1200, y: 1000, hp: 300 };
  const closerMinion = { id: 'minion_closer', type: 'minion', x: 1100, y: 1000, hp: 300 };
  target = tower.selectTarget([closerMinion, attackingMinion], null, 'minion_atk');
  assert(target.id === 'minion_atk', 'Unit explicitly attacking tower takes priority over closer idle minion');
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. HEAT SCALING & HOMING PROJECTILES
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n>>> [2/5] Testing Tower Heat Ramp & Projectile Physics...');

{
  const tower = new DefensiveTower('test_tower_2', 'allied', 500, 500);
  const heroA = { id: 'hero_A', type: 'hero', hp: 5000 };
  const heroB = { id: 'hero_B', type: 'hero', hp: 5000 };
  const minion = { id: 'creep_1', type: 'minion', hp: 1000 };

  // 2.1 Ramp up on hero A
  assert(tower.calculateShotDamage(heroA) === 150, 'Shot 0 damage is 150 base');
  tower.recordShot(heroA);
  assert(tower.calculateShotDamage(heroA) === 150 * 1.25, 'Shot 1 damage is 187.5 (+25%)');
  tower.recordShot(heroA);
  assert(tower.calculateShotDamage(heroA) === 150 * 1.50, 'Shot 2 damage is 225.0 (+50%)');
  tower.recordShot(heroA);
  assert(tower.calculateShotDamage(heroA) === 150 * 1.75, 'Shot 3 damage is 262.5 (+75%)');
  tower.recordShot(heroA);
  assert(tower.calculateShotDamage(heroA) === 300, 'Shot 4 damage is 300.0 (+100% max cap)');
  tower.recordShot(heroA);
  assert(tower.calculateShotDamage(heroA) === 300, 'Shot 5 damage remains strictly clamped at 300.0 (2.0x)');

  // 2.2 Heat does NOT apply to minions
  assert(tower.calculateShotDamage(minion) === 150, 'Minion always receives unheated baseline 150 damage');
  tower.recordShot(minion);
  assert(tower.calculateShotDamage(minion) === 150, 'Consecutive shots on minion do NOT increment heat');

  // 2.3 Switch to Hero B resets heat
  tower.recordShot(heroA);
  tower.recordShot(heroA);
  assert(tower.calculateShotDamage(heroA) === 150 * 1.50, 'Hero A at +50% heat');
  tower.recordShot(heroB);
  assert(tower.calculateShotDamage(heroB) === 150 * 1.25, 'Switch to Hero B resets heat to 1st shot on new target');

  // 2.4 Homing projectile travel and mid-air target death dissipation
  const dummyTarget = { x: 500, y: 800, z: 0, hp: 500, isAlive: () => true };
  const proj = new TowerProjectile({
    x: 500,
    y: 500,
    z: 80,
    target: dummyTarget,
    speed: 750,
    damage: 150
  });

  // Step 1: projectile moves towards target
  proj.update(0.1); // 75 units forward
  assert(proj.isAlive() === true, 'Projectile is alive while traveling');
  assert(proj.y > 500, 'Projectile moved along Y axis towards target');

  // Step 2: target dies mid-air
  dummyTarget.isAlive = () => false;
  dummyTarget.hp = 0;
  proj.update(0.1);
  assert(proj.isDead === true, 'Projectile dissipates mid-air when target dies');

  // 2.5 Stone Colossus -40% damage reduction on impact
  const colossusTarget = {
    x: 500,
    y: 510,
    z: 0,
    hp: 3500,
    towerDamageReduction: 0.40,
    isAlive: () => true,
    takeDamage: (amt) => { colossusTarget.hp -= amt; }
  };
  const colossusProj = new TowerProjectile({
    x: 500,
    y: 500,
    z: 0,
    target: colossusTarget,
    speed: 750,
    damage: 200
  });
  colossusProj.update(0.1); // will impact immediately (dist 10 <= step 75)
  assert(colossusProj.hasImpacted === true, 'Projectile impacted target');
  // Expected damage: 200 * (1 - 0.40) = 120
  assert(colossusTarget.hp === 3500 - 120, 'Stone Colossus receives exactly -40% damage (120 instead of 200)');
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. STRUCTURE INVULNERABILITY HIERARCHY
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n>>> [3/5] Testing Structure Invulnerability Hierarchy...');

{
  let supremeBossAlive = true;
  const hierarchy = createTowerHierarchy({
    isSupremeBossAlive: () => supremeBossAlive
  });

  const { outer: alliedOuter, inner: alliedInner, nexus: alliedNexus } = hierarchy.allied;
  const { outer: enemyOuter, inner: enemyInner, nexus: enemyNexus } = hierarchy.enemy;

  // 3.1 Initial invulnerability states
  assert(alliedOuter.isInvulnerable() === false, 'Allied outer tower is initially vulnerable');
  assert(alliedInner.isInvulnerable() === true, 'Allied inner tower is invulnerable while outer is alive');
  assert(alliedNexus.isInvulnerable() === true, 'Allied nexus is invulnerable while inner is alive');

  assert(enemyOuter.isInvulnerable() === false, 'Enemy outer tower is initially vulnerable');
  assert(enemyInner.isInvulnerable() === true, 'Enemy inner tower is invulnerable while outer is alive');
  assert(enemyNexus.isInvulnerable() === true, 'Enemy nexus is invulnerable initially');

  // 3.2 Destroy outer tower
  let res = enemyInner.takeDamage(1000);
  assert(res.damageTaken === 0 && res.invulnerable === true, 'Attacking invulnerable inner tower deals 0 damage');
  assert(enemyInner.hp === 2500, 'Inner tower HP undamaged');

  enemyOuter.takeDamage(3000);
  assert(enemyOuter.hp <= 0, 'Outer tower destroyed');
  assert(enemyInner.isInvulnerable() === false, 'Inner tower becomes vulnerable after outer destroyed');

  // 3.3 Enemy Nexus dual-protection (Inner tower AND Supreme Boss)
  enemyInner.takeDamage(3000);
  assert(enemyInner.hp <= 0, 'Inner tower destroyed');
  assert(enemyNexus.isInvulnerable() === true, 'Enemy nexus STILL invulnerable because Supreme Boss is alive!');

  res = enemyNexus.takeDamage(1000);
  assert(res.damageTaken === 0 && res.invulnerable === true, 'Enemy nexus takes 0 damage while Supreme Boss alive');

  // Slay Supreme Boss
  supremeBossAlive = false;
  assert(enemyNexus.isInvulnerable() === false, 'Enemy nexus becomes vulnerable once both Inner Tower AND Supreme Boss are dead');

  res = enemyNexus.takeDamage(1000);
  assert(res.damageTaken === 1000 && res.invulnerable === false, 'Enemy nexus successfully takes damage');
  assert(enemyNexus.hp === 4000, 'Enemy nexus HP reduced from 5000 to 4000');
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. MINION WAVES, LEASH AI & BOUNTIES
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n>>> [4/5] Testing Minion Waves, Leash State Machine & Bounty Sharing...');

{
  // 4.1 Wave composition across 10 waves
  for (let w = 1; w <= 10; w++) {
    const comp = getWaveComposition(w);
    assert(comp.meleeCount === 3, `Wave ${w} has 3 melee`);
    assert(comp.rangedCount === 3, `Wave ${w} has 3 ranged`);
    if (w % 3 === 0) {
      assert(comp.cannonCount === 1, `Wave ${w} (3rd wave) includes 1 Cannon Siege Minion`);
      assert(comp.totalUnits === 7, `Wave ${w} has 7 total units`);
    } else {
      assert(comp.cannonCount === 0, `Wave ${w} has 0 Cannon`);
      assert(comp.totalUnits === 6, `Wave ${w} has 6 total units`);
    }
  }

  // 4.2 Leash distance check
  const wp = { x: 1600, y: 1600 };
  assert(shouldDisengageLeash({ x: 1600, y: 2000 }, wp) === false, 'Dist exactly 400 does not disengage');
  assert(shouldDisengageLeash({ x: 1600, y: 2001 }, wp) === true, 'Dist 401 disengages leash');
  assert(shouldDisengageLeash(null, wp) === false, 'Null minion pos safely returns false');

  // 4.3 Minion Unit AI Leash Return State Machine
  const minion = new MinionUnit({ team: 'allied', x: 1600, y: 1600, subType: 'melee' });
  minion.waypointIndex = 3; // at (1600, 1600)

  // Pull minion away to (2100, 1600) -> dist 500 > 400
  minion.x = 2100;
  minion.y = 1600;
  minion.update(0.01667, []);
  assert(minion.aiState === MinionAIState.LEASH_RETURN, 'Minion transitions to LEASH_RETURN when pulled > 400 units');

  // Minion marches back towards waypoint
  minion.update(0.5, []);
  assert(minion.x < 2100, 'Minion moves back towards waypoint during LEASH_RETURN');

  // Move minion within 40 units of waypoint
  minion.x = 1620;
  minion.y = 1600;
  minion.update(0.01667, []);
  assert(minion.aiState === MinionAIState.MARCH, 'Minion returns to MARCH once back at waypoint');

  // 4.4 Bounty payouts & assists
  const heroKiller = { id: 'p1', type: 'hero' };
  const ally1 = { id: 'p2', type: 'hero' };
  const ally2 = { id: 'p3', type: 'hero' };

  // Melee kill: 21g base, 30% assist = 6g
  let res = resolveMinionDeath('melee', heroKiller, [heroKiller, ally1, ally2]);
  assert(res.awardedKillerGold === 21, 'Killer gets 21g for melee');
  assert(res.awardedAssistGold.length === 2, '2 allies receive assists');
  assert(res.awardedAssistGold[0].gold === 6, 'Ally gets 6g assist (floor(21 * 0.3))');

  // Cannon kill: 45g base, 30% assist = 13g
  res = resolveMinionDeath('cannon', heroKiller, [heroKiller, ally1]);
  assert(res.awardedKillerGold === 45, 'Killer gets 45g for cannon');
  assert(res.awardedAssistGold[0].gold === 13, 'Ally gets 13g assist (floor(45 * 0.3))');

  // Non-hero kill: 0g
  const towerKiller = { id: 'tower_allied_1', type: 'tower' };
  res = resolveMinionDeath('cannon', towerKiller, [heroKiller, ally1]);
  assert(res.awardedKillerGold === 0, 'Tower kill awards 0 gold to players');
  assert(res.awardedAssistGold.length === 0, 'No assists awarded on tower denial');
  assert(res.reason === 'denied_by_non_hero', 'Reason is denied_by_non_hero');
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. BOSS MECHANICS & ENDGAME OUTCOMES
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n>>> [5/5] Testing Boss Phases, Abilities & Endgame Victory/Defeat Triggers...');

{
  // 5.1 Stone Colossus Wave 5
  const colossus = new StoneColossusBoss();
  assert(colossus.hp === 3500, 'Stone Colossus maxHp is 3500');
  assert(colossus.towerDamageReduction === 0.40, 'Stone Colossus has 40% tower damage reduction');

  // 5.2 Abyssal Behemoth Wave 10
  const behemoth = new AbyssalBehemothBoss();
  assert(behemoth.hp === 6000, 'Abyssal Behemoth maxHp is 6000');
  assert(behemoth.silenceDuration === 2.0, 'Abyssal Behemoth silence is 2.0s');

  // 5.3 Supreme Boss 3-Phase Progression & Cataclysmic Shield
  const supreme = new SupremeBoss();
  assert(supreme.maxHp === 12000, 'Supreme Boss maxHp is 12000');
  assert(supreme.phase === 1, 'Initial phase is Phase 1 (Cleave)');

  supreme.takeDamage(4000); // HP: 8000 (66.6% maxHp)
  assert(supreme.phase === 1, 'At 8000/12000 HP (>66%), remains Phase 1');

  supreme.takeDamage(100); // HP: 7900 (<66% maxHp)
  assert(supreme.phase === 2, 'Drops below 66% HP => Phase 2 (Meteor Rain)');

  supreme.takeDamage(4000); // HP: 3900 (<33% maxHp)
  assert(supreme.phase === 3, 'Drops below 33% HP => Phase 3 (Cataclysmic Shield)');

  // Cataclysmic shield absorbs all damage
  supreme.shieldActive = true;
  let dmgRes = supreme.takeDamage(2000);
  assert(dmgRes.damageTaken === 0 && dmgRes.shielded === true, 'Active shield completely absorbs damage');
  assert(supreme.hp === 3900, 'HP unchanged while shielded');

  supreme.shieldActive = false;
  dmgRes = supreme.takeDamage(3900);
  assert(dmgRes.damageTaken === 3900 && dmgRes.isDead === true, 'Lethal damage slays Supreme Boss');

  // 5.4 Match Outcome Arbitration
  // Scenario A: Allied Nexus falls -> DEFEAT
  let outcome = evaluateMatchOutcome(0, 5000, true);
  assert(outcome.isOver === true && outcome.outcome === 'DEFEAT', 'Allied Nexus at 0 HP triggers DEFEAT immediately');

  // Scenario B: Enemy Nexus down but Supreme Boss still alive -> IN_PROGRESS
  outcome = evaluateMatchOutcome(2000, 0, true);
  assert(outcome.isOver === false && outcome.outcome === 'IN_PROGRESS', 'Enemy Nexus down with Supreme Boss alive does NOT grant victory');

  // Scenario C: Enemy Nexus down and Supreme Boss dead -> VICTORY
  outcome = evaluateMatchOutcome(2000, 0, false);
  assert(outcome.isOver === true && outcome.outcome === 'VICTORY', 'Enemy Nexus down with Supreme Boss dead triggers VICTORY');

  // Scenario D: Both Nexuses at 0 -> Allied loss takes precedence (DEFEAT)
  outcome = evaluateMatchOutcome(0, 0, false);
  assert(outcome.isOver === true && outcome.outcome === 'DEFEAT', 'Allied Nexus destruction takes precedence over Enemy Nexus');
}

console.log('\n================================================================');
console.log(` ADVERSARIAL STRESS TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('ADVERSARIAL VERDICT: 100% PASS - ALL MILESTONE 2 INVARIANTS ROBUST');
  process.exit(0);
}
