import { GameMap, distanceToLane, isInsideLane, isInsideShopZone, resolveCircleCollision, resolveSegmentCollision, clampToBounds } from '../src/world/map.js';
import { DefensiveTower, TowerProjectile, createTowerHierarchy, BASE_TOWER_DAMAGE, TOWER_RADIUS } from '../src/world/tower.js';
import { MinionUnit, WaveSpawner, getWaveComposition, shouldDisengageLeash, resolveMinionDeath, MinionAIState } from '../src/world/minion.js';
import { SupremeBoss, evaluateMatchOutcome, StoneColossusBoss, AbyssalBehemothBoss, NexusGuardianBoss, BossManager } from '../src/world/boss.js';

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log(`  ✔ PASS: ${msg}`);
  } else {
    failed++;
    console.error(`  ✖ FAIL: ${msg}`);
  }
}

console.log('================================================================');
console.log(' ADVERSARIAL STRESS TEST: MILESTONE 2 (WORLD, TOWER, MINION, BOSS)');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. Map Geometry & Collision Invariants
// -----------------------------------------------------------------------------
console.log('>>> [1/4] Stress Testing Map Geometry, Lane Boundaries & Collision Sliding...');

// 1.1 Distance to Lane diagonal (y = x)
assert(Math.abs(distanceToLane(0, 0)) < 1e-9, 'distanceToLane(0,0) is exactly 0');
assert(Math.abs(distanceToLane(1600, 1600)) < 1e-9, 'distanceToLane(1600,1600) is exactly 0');
// (100, 0): dist = |100 - 0| / sqrt(2) = 70.710678
assert(Math.abs(distanceToLane(100, 0) - (100 * Math.SQRT1_2)) < 1e-9, 'distanceToLane(100, 0) matches Euclidean diagonal distance');
assert(Math.abs(distanceToLane(0, 100) - (100 * Math.SQRT1_2)) < 1e-9, 'distanceToLane(0, 100) is symmetric');
assert(distanceToLane(NaN, 100) === Infinity, 'distanceToLane with NaN safely returns Infinity');

// 1.2 Lane boundary check (halfWidth = 175)
// At lane border: dist = 175. Point: x = 1600 + 175 / sqrt(2), y = 1600 - 175 / sqrt(2)
const offset = 175 * Math.SQRT1_2;
assert(isInsideLane(1600 + offset, 1600 - offset, 175), 'Point exactly on lane boundary is inside lane');
assert(!isInsideLane(1600 + offset + 0.1, 1600 - offset, 175), 'Point 0.1 units outside lane boundary is outside lane');

// 1.3 Shop Zone (R=250 around 400, 400)
assert(isInsideShopZone({ x: 400, y: 400 }), 'Fountain center is inside shop zone');
assert(isInsideShopZone({ x: 400 + 250, y: 400 }), 'Fountain edge at 250 units is inside shop zone');
assert(!isInsideShopZone({ x: 400 + 250.01, y: 400 }), 'Point at 250.01 units is outside shop zone');
assert(!isInsideShopZone(null), 'Null entity safely returns false');
assert(!isInsideShopZone({ x: NaN, y: 400 }), 'NaN coordinates safely return false');

// 1.4 Collision Sliding
const col = resolveCircleCollision(410, 400, 20, 400, 400, 40); // dist = 10, minDist = 60
assert(col.collided === true, 'Entity colliding with structure is flagged');
assert(col.penetration === 50, 'Penetration depth correctly computed as 50');
assert(col.newX === 460, 'Resolved X pushed outside obstacle boundary');

// Tangential sliding on map entity
const map = new GameMap();
map.registerStructure('tower_test', 500, 500, 40);
const testHero = { id: 'hero_test', x: 520, y: 500, vx: -100, vy: 50, radius: 20, hp: 1000 };
map.resolveEntityCollision(testHero);
assert(testHero.x >= 560, 'Collision resolution pushed entity outside tower radius (40 + 20 = 60)');
assert(testHero.vx === 0, 'Normal velocity component stopped upon direct head-on collision');

// 1.5 Fountain Regeneration Team Isolation
const alliedHero = { id: 'ally', team: 'allied', x: 400, y: 400, hp: 500, maxHp: 1000, mana: 100, maxMana: 500 };
const enemyHero = { id: 'enemy', team: 'enemy', x: 400, y: 400, hp: 500, maxHp: 1000, mana: 100, maxMana: 500 };
map.applyFountainRegen([alliedHero, enemyHero], 1.0); // 1.0s elapsed
// Allied: +10% HP = +100 HP, +15% Mana = +75 Mana
assert(Math.abs(alliedHero.hp - 600) < 1e-4, 'Allied hero regenerated +10% HP/s in allied fountain');
assert(Math.abs(alliedHero.mana - 175) < 1e-4, 'Allied hero regenerated +15% Mana/s in allied fountain');
assert(enemyHero.hp === 500, 'Enemy hero in allied fountain receives ZERO HP regen');
assert(enemyHero.mana === 100, 'Enemy hero in allied fountain receives ZERO Mana regen');

// -----------------------------------------------------------------------------
// 2. Tower AI, Aggro Switches & Heat Scaling
// -----------------------------------------------------------------------------
console.log('\n>>> [2/4] Stress Testing Tower AI, True Sight, Aggro Switches & Heat Scaling...');

const tower = new DefensiveTower('tower_test', 'allied', 1000, 1000);
const enemyCreep1 = { id: 'creep_1', type: 'minion', team: 'enemy', x: 1050, y: 1000, hp: 300, radius: 15 };
const enemyCreep2 = { id: 'creep_2', type: 'minion', team: 'enemy', x: 1100, y: 1000, hp: 300, radius: 15 };
const enemyHeroA = { id: 'hero_A', type: 'hero', team: 'enemy', x: 1150, y: 1000, hp: 1500, radius: 20 };
const enemyHeroB = { id: 'hero_B', type: 'hero', team: 'enemy', x: 1200, y: 1000, hp: 1500, radius: 20 };
const stealthHero = { id: 'stealth_hero', type: 'hero', team: 'enemy', x: 1020, y: 1000, hp: 1000, radius: 20, stealthedUntil: Date.now() + 5000 };

// 2.1 True Sight
tower.update(0.016, [stealthHero]);
assert(stealthHero.revealedByTrueSight === true, 'Defensive tower grants True Sight and reveals stealthed entity');

// 2.2 Peacetime Target Selection: minion over hero
const peacetimeTarget = tower.selectTarget([enemyHeroA, enemyCreep2, enemyCreep1]);
assert(peacetimeTarget.id === 'creep_1', 'Tower selects closest minion over hero in peacetime');

// 2.3 Sticky Lock: Target does not change while current target remains alive and in range
tower.currentTarget = enemyCreep1;
const stickyTarget = tower.selectTarget([enemyCreep2, enemyCreep1, enemyHeroA]);
assert(stickyTarget.id === 'creep_1', 'Tower maintains sticky lock on existing valid target');

// 2.4 Call for Help overrides sticky lock immediately
const aggroTarget = tower.selectTarget([enemyCreep1, enemyHeroA], 'hero_A');
assert(aggroTarget.id === 'hero_A', 'Call for Help immediately switches aggro to aggressor hero');

// 2.5 Heat Scaling Ramp and Clamping (+25% per shot, max +100% = 2.0x)
tower.currentTarget = enemyHeroA;
tower.consecutiveHitsOnTarget = 0;
assert(tower.calculateShotDamage(enemyHeroA) === 150, 'Shot 0 damage is base 150');
tower.recordShot(enemyHeroA);
assert(tower.calculateShotDamage(enemyHeroA) === 187.5, 'Shot 1 damage is 187.5 (+25%)');
tower.recordShot(enemyHeroA);
assert(tower.calculateShotDamage(enemyHeroA) === 225, 'Shot 2 damage is 225 (+50%)');
tower.recordShot(enemyHeroA);
assert(tower.calculateShotDamage(enemyHeroA) === 262.5, 'Shot 3 damage is 262.5 (+75%)');
tower.recordShot(enemyHeroA);
assert(tower.calculateShotDamage(enemyHeroA) === 300, 'Shot 4 damage is 300 (+100% cap)');
tower.recordShot(enemyHeroA);
assert(tower.calculateShotDamage(enemyHeroA) === 300, 'Shot 5 damage remains strictly capped at 300 (2.0x)');

// Heat reset on target switch
tower.recordShot(enemyHeroB);
assert(tower.calculateShotDamage(enemyHeroB) === 187.5, 'Switching to new hero resets heat back to 1st shot');

// Heat reset when switching to minion
tower.recordShot(enemyCreep1);
assert(tower.calculateShotDamage(enemyCreep1) === 150, 'Minion targets never receive heat multiplier');

// 2.6 Full 6-Structure Invulnerability Hierarchy
const hierarchy = createTowerHierarchy({ isSupremeBossAlive: () => true });
assert(hierarchy.allied.outer.isInvulnerable() === false, 'Allied outer tower has no parent and is vulnerable');
assert(hierarchy.allied.inner.isInvulnerable() === true, 'Allied inner tower is invulnerable while outer is alive');
assert(hierarchy.allied.nexus.isInvulnerable() === true, 'Allied nexus is invulnerable while inner is alive');

assert(hierarchy.enemy.nexus.isInvulnerable() === true, 'Enemy nexus is invulnerable while inner tower is alive');
hierarchy.enemy.outer.hp = 0;
hierarchy.enemy.inner.hp = 0;
// Inner is destroyed, but Supreme Boss is STILL alive!
assert(hierarchy.enemy.nexus.isInvulnerable() === true, 'Enemy nexus remains invulnerable while Supreme Boss is alive even after inner falls');

// Slay supreme boss
const hierarchy2 = createTowerHierarchy({ isSupremeBossAlive: () => false });
hierarchy2.enemy.outer.hp = 0;
hierarchy2.enemy.inner.hp = 0;
assert(hierarchy2.enemy.nexus.isInvulnerable() === false, 'Enemy nexus becomes vulnerable once towers AND Supreme Boss are defeated');

// -----------------------------------------------------------------------------
// 3. Minion Waves, AI State Machine & Leash Return
// -----------------------------------------------------------------------------
console.log('\n>>> [3/4] Stress Testing Minion Wave Spawning, Waypoint Navigation & Leash AI...');

// 3.1 Wave Composition scaling
const w1 = getWaveComposition(1);
assert(w1.meleeCount === 3 && w1.rangedCount === 3 && w1.cannonCount === 0 && w1.totalUnits === 6, 'Wave 1 has 6 units');
const w2 = getWaveComposition(2);
assert(w2.cannonCount === 0 && w2.totalUnits === 6, 'Wave 2 has 6 units');
const w3 = getWaveComposition(3);
assert(w3.cannonCount === 1 && w3.totalUnits === 7, 'Wave 3 (Cannon wave) has 7 units');
const w6 = getWaveComposition(6);
assert(w6.cannonCount === 1 && w6.totalUnits === 7, 'Wave 6 (Cannon wave) has 7 units');
const w10 = getWaveComposition(10);
assert(w10.cannonCount === 0 && w10.totalUnits === 6, 'Wave 10 has 6 units');

// 3.2 Leash Boundary (>400 units)
const wp = { x: 1000, y: 1000 };
assert(!shouldDisengageLeash({ x: 1000, y: 1400 }, wp), 'Exact 400 distance does not disengage leash');
assert(shouldDisengageLeash({ x: 1000, y: 1401 }, wp), 'Distance 401 disengages leash');

// 3.3 Minion AI Leash Return Behavior
const minion = new MinionUnit({ team: 'allied', subType: 'melee', x: 1500, y: 1500 });
minion.waypointIndex = 0; // WP0 is at (400, 400). Distance ~1555 > 400!
minion.update(0.1, []);
assert(minion.aiState === MinionAIState.LEASH_RETURN, 'Minion pulled beyond leash boundary enters LEASH_RETURN state');
assert(minion.targetEntity === null, 'Minion drops target upon leash return');

// Step minion until it returns to waypoint
minion.x = 430;
minion.y = 430; // distance ~42.4 from (400, 400) <= 50 units
minion.update(0.1, []);
assert(minion.aiState === MinionAIState.MARCH, 'Minion returning within 50 units resumes MARCH state');

// 3.4 Minion Death Bounties & Assist Rules
const killerHero = { id: 'hero_1', type: 'hero' };
const allyHeroA = { id: 'hero_2', type: 'hero' };
const allyHeroB = { id: 'hero_3', type: 'hero' };
const towerKiller = { id: 'tower_allied', type: 'tower' };

const meleeKill = resolveMinionDeath('melee', killerHero, [killerHero, allyHeroA, allyHeroB]);
assert(meleeKill.awardedKillerGold === 21, 'Melee kill gives 21g to hero');
assert(meleeKill.awardedAssistGold.length === 2, 'Two nearby allies receive assist gold');
assert(meleeKill.awardedAssistGold[0].gold === Math.floor(21 * 0.30), 'Assist gold is 30% of base bounty');

const deniedKill = resolveMinionDeath('cannon', towerKiller, [killerHero]);
assert(deniedKill.awardedKillerGold === 0, 'Tower kill awards 0 gold to players');
assert(deniedKill.reason === 'denied_by_non_hero', 'Reason is denied_by_non_hero');

// -----------------------------------------------------------------------------
// 4. Boss Mechanics, Phases & Victory/Defeat Triggers
// -----------------------------------------------------------------------------
console.log('\n>>> [4/4] Stress Testing Boss AI, Phases, Damage Immunity & Endgame Evaluation...');

// 4.1 Stone Colossus (Wave 5)
const colossus = new StoneColossusBoss();
assert(colossus.maxHp === 3500, 'Stone Colossus maxHp is 3500');
assert(colossus.towerDamageReduction === 0.40, 'Stone Colossus reduces tower damage by 40%');

// Tower projectile hitting colossus (spawn 100 units away so 750 speed impacts in 1 step)
const colossusProj = new TowerProjectile({
  x: colossus.x + 50,
  y: colossus.y + 50,
  target: colossus,
  damage: 150
});
colossusProj.update(1.0); // Impact
assert(colossus.hp === 3500 - (150 * 0.60), 'Colossus takes exactly 60% of tower projectile damage (90 dmg)');

// 4.2 Abyssal Behemoth (Wave 10)
const behemoth = new AbyssalBehemothBoss();
assert(behemoth.maxHp === 6000, 'Abyssal Behemoth maxHp is 6000');
assert(behemoth.silenceDuration === 2.0, 'Abyssal Behemoth silence duration is 2.0s');

// 4.3 Supreme Boss 3-Phase Progression & Shield Immunity
const supreme = new SupremeBoss();
assert(supreme.phase === 1, 'Phase is 1 at 100% HP');
supreme.takeDamage(4000); // 8000 HP (66.6% ratio)
assert(supreme.phase === 1, 'Phase remains 1 at >66% HP');
supreme.takeDamage(100); // 7900 HP (<66% ratio)
assert(supreme.phase === 2, 'Phase transitions to 2 at <=66% HP');
supreme.takeDamage(3900); // 4000 HP (33.3% ratio)
assert(supreme.phase === 2, 'Phase remains 2 at >33% HP');
supreme.takeDamage(100); // 3900 HP (<33% ratio)
assert(supreme.phase === 3, 'Phase transitions to 3 at <=33% HP');

// Cataclysmic Shield immunity
supreme.shieldActive = true;
const shieldedRes = supreme.takeDamage(5000);
assert(shieldedRes.damageTaken === 0 && shieldedRes.shielded === true, 'Supreme Boss shield absorbs 100% of damage');
assert(supreme.hp === 3900, 'Supreme Boss HP remains unchanged while shield is active');

// 4.4 Match Outcome Matrix
// Case 1: Match Ongoing
assert(evaluateMatchOutcome(5000, 5000, true).outcome === 'IN_PROGRESS', 'Both nexus healthy -> IN_PROGRESS');
// Case 2: Allied Nexus Falls -> DEFEAT
assert(evaluateMatchOutcome(0, 5000, true).outcome === 'DEFEAT', 'Allied Nexus 0 HP -> DEFEAT');
// Case 3: Enemy Nexus 0 HP but Supreme Boss ALIVE -> IN_PROGRESS
assert(evaluateMatchOutcome(5000, 0, true).outcome === 'IN_PROGRESS', 'Enemy Nexus 0 HP with Supreme Boss alive -> IN_PROGRESS (cannot win)');
// Case 4: Enemy Nexus 0 HP and Supreme Boss DEAD -> VICTORY
assert(evaluateMatchOutcome(5000, 0, false).outcome === 'VICTORY', 'Enemy Nexus 0 HP with Supreme Boss dead -> VICTORY');

console.log('\n================================================================');
console.log(` M2 ADVERSARIAL STRESS TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('ADVERSARIAL VERDICT: 100% PASS - ALL M2 INVARIANTS ROBUST');
  process.exit(0);
}
