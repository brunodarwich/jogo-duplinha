/**
 * Milestone 1 Stress Test Harness: InputDispatcher & HUD / Minimap Controller
 *
 * Verifies under empirical stress:
 * 1. InputDispatcher / InputManager picking hierarchy under dense unit clusters (identical coordinates)
 * 2. Ability targeting preview state transitions: Rapid sequential keypresses ('Q' -> 'W' -> 'E' -> 'R' -> Right-Click -> 'Escape' -> 'S')
 * 3. Minimap unprojection and coordinate bounds: clicks on all 4 corners, borders, and out-of-bounds
 * 4. High-frequency input simulation: 1,000 simultaneous right-click drag events and continuous dragging
 *
 * Run: node tests/stress_m1_input.js
 */

import { performance } from 'node:perf_hooks';
import {
  InputDispatcher,
  InputManager,
  CommandType,
  IndicatorType,
  MAP_SIZE,
  clamp
} from '../src/core/input.js';
import { Minimap, formatMatchTime } from '../src/ui/hud.js';
import { Camera } from '../src/core/camera.js';
import { screenToWorld, worldToScreen } from '../src/core/isometric.js';

// --- Test Utilities ---

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
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
    id: 'hero_player',
    name: 'Player Knight',
    team: 'allied',
    type: 'hero',
    x: 500,
    y: 500,
    hp: 1000,
    maxHp: 1000,
    mana: 300,
    maxMana: 300,
    speed: 320,
    isDead: false,
    abilities: {
      Q: {
        id: 'knight_q',
        name: 'Shield Slam',
        manaCost: 40,
        cooldown: 8,
        cooldownRemaining: 0,
        range: 400,
        targetingType: IndicatorType.DIRECTIONAL_LINE,
        hitboxWidth: 50
      },
      W: {
        id: 'knight_w',
        name: 'Taunt Shout',
        manaCost: 60,
        cooldown: 12,
        cooldownRemaining: 0,
        radius: 300,
        targetingType: IndicatorType.SELF_AOE
      },
      E: {
        id: 'knight_e',
        name: 'Iron Cleave',
        manaCost: 50,
        cooldown: 10,
        cooldownRemaining: 0,
        range: 450,
        radius: 180,
        targetingType: IndicatorType.GROUND_AOE
      },
      R: {
        id: 'knight_r',
        name: 'Fortress Domain',
        manaCost: 100,
        cooldown: 60,
        cooldownRemaining: 0,
        range: 600,
        radius: 350,
        targetingType: IndicatorType.GROUND_AOE
      }
    },
    ...overrides
  };
}

console.log(`\n${COLORS.bold}================================================================${COLORS.reset}`);
console.log(`${COLORS.bold}  CHALLENGER 2: Milestone 1 Input & HUD Stress Test Harness      ${COLORS.reset}`);
console.log(`${COLORS.bold}================================================================${COLORS.reset}`);

// ============================================================================
// SECTION 1: PICKING HIERARCHY UNDER DENSE UNIT CLUSTERS
// ============================================================================
section('1. Input Picking Hierarchy Under Dense Unit Clusters');

test('1.1 Priority hierarchy: Hostile Hero > Hostile Minion > Hostile Boss > Friendly Units at identical coordinates', () => {
  const camera = new Camera({ worldX: 500, worldY: 500, viewportWidth: 1280, viewportHeight: 720 });
  const inputMgr = new InputManager(null, camera);
  const playerHero = createMockHero({ x: 500, y: 500 });
  inputMgr.setPlayerHero(playerHero);

  // Position cursor at exactly world (600, 600)
  inputMgr.worldX = 600;
  inputMgr.worldY = 600;

  // Cluster of 40 entities stacked at exactly (600, 600)
  const cluster = [];

  // Add 15 allied minions (priority 1)
  for (let i = 0; i < 15; i++) {
    cluster.push({ id: `ally_minion_${i}`, team: 'allied', type: 'minion', x: 600, y: 600, hp: 200, radius: 25 });
  }

  // Add 2 allied heroes (priority 1)
  cluster.push({ id: 'ally_hero_1', team: 'allied', type: 'hero', x: 600, y: 600, hp: 800, radius: 30 });
  cluster.push({ id: 'ally_hero_2', team: 'allied', type: 'hero', x: 600, y: 600, hp: 800, radius: 30 });

  // Add 3 hostile bosses / towers (priority 2)
  cluster.push({ id: 'enemy_tower_1', team: 'enemy', type: 'tower', x: 600, y: 600, hp: 3000, radius: 40 });
  cluster.push({ id: 'enemy_boss_1', team: 'enemy', type: 'boss', x: 600, y: 600, hp: 5000, radius: 45 });

  // Add 15 hostile minions (priority 3)
  for (let i = 0; i < 15; i++) {
    cluster.push({ id: `enemy_minion_${i}`, team: 'enemy', type: 'minion', x: 600, y: 600, hp: 250, radius: 25 });
  }

  // Add 2 hostile heroes (priority 4) placed randomly in the list
  const enemyHeroTarget = { id: 'enemy_hero_primary', team: 'enemy', type: 'hero', x: 600, y: 600, hp: 900, radius: 30 };
  const enemyHeroSecond = { id: 'enemy_hero_secondary', team: 'enemy', type: 'hero', x: 600, y: 600, hp: 850, radius: 30 };
  cluster.splice(5, 0, enemyHeroTarget);
  cluster.splice(25, 0, enemyHeroSecond);

  const picked = inputMgr.pickEntity(cluster, playerHero);
  assert(picked !== null, 'Should have picked an entity from dense cluster');
  assertEqual(picked.team, 'enemy', 'Picked entity must be enemy');
  assertEqual(picked.type, 'hero', 'Hostile Hero (priority 4) must take absolute precedence over minions, towers and allies');
});

test('1.2 Dead and untargetable hostile heroes are bypassed in favor of alive hostile hero', () => {
  const camera = new Camera({ worldX: 500, worldY: 500, viewportWidth: 1280, viewportHeight: 720 });
  const inputMgr = new InputManager(null, camera);
  const playerHero = createMockHero();
  inputMgr.worldX = 500;
  inputMgr.worldY = 500;

  const cluster = [
    { id: 'dead_hero_bool', team: 'enemy', type: 'hero', x: 500, y: 500, hp: 500, isDead: true, radius: 30 },
    { id: 'dead_hero_fn', team: 'enemy', type: 'hero', x: 500, y: 500, hp: 500, isDead: () => true, radius: 30 },
    { id: 'dead_hero_zerohp', team: 'enemy', type: 'hero', x: 500, y: 500, hp: 0, isDead: false, radius: 30 },
    { id: 'dead_hero_neghp', team: 'enemy', type: 'hero', x: 500, y: 500, hp: -25, isDead: false, radius: 30 },
    { id: 'untargetable_hero', team: 'enemy', type: 'hero', x: 500, y: 500, hp: 500, isUntargetable: () => true, radius: 30 },
    { id: 'alive_hero', team: 'enemy', type: 'hero', x: 500, y: 500, hp: 600, isDead: false, radius: 30 },
    { id: 'alive_minion', team: 'enemy', type: 'minion', x: 500, y: 500, hp: 200, radius: 25 }
  ];

  const picked = inputMgr.pickEntity(cluster, playerHero);
  assert(picked !== null, 'Must pick alive candidate');
  assertEqual(picked.id, 'alive_hero', 'Must pick the alive hostile hero and ignore all 5 dead/untargetable heroes');
});

test('1.3 Fallback to hostile minion when all hostile heroes in cluster are dead', () => {
  const inputMgr = new InputManager();
  const playerHero = createMockHero();
  inputMgr.worldX = 400;
  inputMgr.worldY = 400;

  const cluster = [
    { id: 'dead_hero_1', team: 'enemy', type: 'hero', x: 400, y: 400, hp: 0, radius: 30 },
    { id: 'dead_hero_2', team: 'enemy', type: 'hero', x: 400, y: 400, isDead: true, radius: 30 },
    { id: 'alive_minion', team: 'enemy', type: 'minion', x: 400, y: 400, hp: 200, radius: 25 },
    { id: 'allied_hero', team: 'allied', type: 'hero', x: 400, y: 400, hp: 800, radius: 30 }
  ];

  const picked = inputMgr.pickEntity(cluster, playerHero);
  assert(picked !== null, 'Must pick alive hostile minion');
  assertEqual(picked.id, 'alive_minion', 'Must fall back to hostile minion (priority 3) over allied hero (priority 1)');
});

test('1.4 Distance minimization tie-breaking among same-priority hostile heroes', () => {
  const inputMgr = new InputManager();
  const playerHero = createMockHero();
  inputMgr.worldX = 1000;
  inputMgr.worldY = 1000;

  const cluster = [
    { id: 'hero_far', team: 'enemy', type: 'hero', x: 1020, y: 1020, hp: 500, radius: 35 }, // dist ~ 28.28
    { id: 'hero_close', team: 'enemy', type: 'hero', x: 1005, y: 1005, hp: 500, radius: 35 }, // dist ~ 7.07
    { id: 'hero_exact', team: 'enemy', type: 'hero', x: 1000, y: 1000, hp: 500, radius: 35 } // dist = 0
  ];

  const picked = inputMgr.pickEntity(cluster, playerHero);
  assertEqual(picked.id, 'hero_exact', 'Must select closest entity (hero_exact at dist=0) among same priority');
});

test('1.5 Scalability stress test: 5,000 stacked units picked in under 50ms', () => {
  const inputMgr = new InputManager();
  const playerHero = createMockHero();
  inputMgr.worldX = 1500;
  inputMgr.worldY = 1500;

  const massiveCluster = [];
  // 4,990 distractors
  for (let i = 0; i < 4990; i++) {
    massiveCluster.push({
      id: `creep_${i}`,
      team: i % 2 === 0 ? 'allied' : 'enemy',
      type: 'minion',
      x: 1500 + (i % 5) - 2,
      y: 1500 + (i % 5) - 2,
      hp: 100,
      radius: 30
    });
  }
  // 9 towers
  for (let i = 0; i < 9; i++) {
    massiveCluster.push({
      id: `tower_${i}`,
      team: 'enemy',
      type: 'tower',
      x: 1500,
      y: 1500,
      hp: 3000,
      radius: 40
    });
  }
  // 1 sole alive enemy hero placed at the very end
  const needleHero = {
    id: 'needle_enemy_hero',
    team: 'enemy',
    type: 'hero',
    x: 1500,
    y: 1500,
    hp: 1200,
    radius: 35
  };
  massiveCluster.push(needleHero);

  const start = performance.now();
  const picked = inputMgr.pickEntity(massiveCluster, playerHero);
  const elapsed = performance.now() - start;

  assertEqual(picked.id, 'needle_enemy_hero', 'Must find the needle enemy hero across 5,000 stacked units');
  assert(elapsed < 50, `5,000 units picking took ${elapsed.toFixed(2)}ms, must be < 50ms`);
});

test('1.6 InputDispatcher command generation with picked hostile vs friendly entity', () => {
  const dispatcher = new InputDispatcher({ x: 0, y: 0 }, 1.0, { width: 1280, height: 720 });

  const enemyPicked = { id: 'boss_colossus', team: 'enemy', x: 800, y: 800 };
  const attackCmd = dispatcher.handleMouseDown(2, 640, 360, enemyPicked);
  assertEqual(attackCmd.type, CommandType.ATTACK_TARGET);
  assertEqual(attackCmd.targetId, 'boss_colossus');
  assertEqual(attackCmd.targetX, 800);
  assertEqual(attackCmd.targetY, 800);

  const allyPicked = { id: 'ally_cleric', team: 'allied', x: 800, y: 800 };
  const moveCmd = dispatcher.handleMouseDown(2, 640, 360, allyPicked);
  assertEqual(moveCmd.type, CommandType.MOVE_TO);
});

// ============================================================================
// SECTION 2: ABILITY TARGETING PREVIEW STATE TRANSITIONS
// ============================================================================
section('2. Ability Targeting Preview State Transitions');

test('2.1 Rapid sequence: Q -> W -> E -> R -> Right-Click -> Escape -> S in InputDispatcher', () => {
  const dispatcher = new InputDispatcher();
  const hero = createMockHero();

  // 1. Press Q -> START_TARGETING (Q)
  const qCmd = dispatcher.handleKeyDown('Q', hero);
  assertEqual(qCmd.type, CommandType.START_TARGETING);
  assertEqual(qCmd.skill, 'Q');
  assertEqual(dispatcher.targetingSkill, 'Q');

  // 2. Rapid switch to W -> START_TARGETING (W)
  const wCmd = dispatcher.handleKeyDown('W', hero);
  assertEqual(wCmd.type, CommandType.START_TARGETING);
  assertEqual(wCmd.skill, 'W');
  assertEqual(dispatcher.targetingSkill, 'W');

  // 3. Rapid switch to E -> START_TARGETING (E)
  const eCmd = dispatcher.handleKeyDown('E', hero);
  assertEqual(eCmd.type, CommandType.START_TARGETING);
  assertEqual(eCmd.skill, 'E');
  assertEqual(dispatcher.targetingSkill, 'E');

  // 4. Rapid switch to R -> START_TARGETING (R)
  const rCmd = dispatcher.handleKeyDown('R', hero);
  assertEqual(rCmd.type, CommandType.START_TARGETING);
  assertEqual(rCmd.skill, 'R');
  assertEqual(dispatcher.targetingSkill, 'R');

  // 5. Right-Click cancels targeting
  const rcCmd = dispatcher.handleMouseDown(2, 640, 360);
  assertEqual(rcCmd.type, CommandType.CANCEL_TARGETING);
  assertEqual(rcCmd.skill, 'R');
  assertEqual(dispatcher.targetingSkill, null);

  // 6. Escape when targeting is null -> returns null safely
  const escCmd = dispatcher.handleKeyDown('Escape');
  assertEqual(escCmd, null);
  assertEqual(dispatcher.targetingSkill, null);

  // 7. Press S -> STOP command
  const sCmd = dispatcher.handleKeyDown('S');
  assertEqual(sCmd.type, CommandType.STOP);
  assertEqual(dispatcher.targetingSkill, null);
});

test('2.2 Rapid sequence Q -> W -> E -> R -> Right-Click -> Escape -> S in InputManager', () => {
  const camera = new Camera({ worldX: 500, worldY: 500, viewportWidth: 1280, viewportHeight: 720 });
  const inputMgr = new InputManager(null, camera);
  const hero = createMockHero();
  inputMgr.setPlayerHero(hero);

  const dispatched = [];
  inputMgr.onCommand(cmd => dispatched.push(cmd));

  // Press Q
  inputMgr.handleKeyDown({ key: 'q' });
  assertEqual(inputMgr.targetingSkill, 'Q');
  assert(inputMgr.targetingState !== null);
  assertEqual(inputMgr.targetingState.slot, 'Q');
  assertEqual(inputMgr.targetingState.indicator.type, IndicatorType.DIRECTIONAL_LINE);

  // Press W
  inputMgr.handleKeyDown({ key: 'w' });
  assertEqual(inputMgr.targetingSkill, 'W');
  assertEqual(inputMgr.targetingState.slot, 'W');
  assertEqual(inputMgr.targetingState.indicator.type, IndicatorType.SELF_AOE);

  // Press E
  inputMgr.handleKeyDown({ key: 'e' });
  assertEqual(inputMgr.targetingSkill, 'E');
  assertEqual(inputMgr.targetingState.slot, 'E');
  assertEqual(inputMgr.targetingState.indicator.type, IndicatorType.GROUND_AOE);

  // Press R
  inputMgr.handleKeyDown({ key: 'r' });
  assertEqual(inputMgr.targetingSkill, 'R');
  assertEqual(inputMgr.targetingState.slot, 'R');
  assertEqual(inputMgr.targetingState.indicator.type, IndicatorType.GROUND_AOE);

  // Right-click: cancels targeting
  inputMgr.handlePointerDown({ button: 2, clientX: 640, clientY: 360 });
  assertEqual(inputMgr.targetingSkill, null);
  assertEqual(inputMgr.targetingState, null);
  assert(dispatched.some(c => c.type === CommandType.CANCEL_TARGETING && c.skill === 'R'));

  // Escape: no crash, stays null
  inputMgr.handleKeyDown({ key: 'Escape' });
  assertEqual(inputMgr.targetingSkill, null);

  // Press S: dispatches STOP
  inputMgr.handleKeyDown({ key: 's' });
  assertEqual(dispatched[dispatched.length - 1].type, CommandType.STOP);
});

test('2.3 Cooldown and mana gating during rapid key switching', () => {
  const dispatcher = new InputDispatcher();
  const hero = createMockHero();

  // Enter Q
  dispatcher.handleKeyDown('Q', hero);
  assertEqual(dispatcher.targetingSkill, 'Q');

  // W is on cooldown
  hero.abilities.W.cooldownRemaining = 5.5;
  const wFail = dispatcher.handleKeyDown('W', hero);
  assertEqual(wFail.type, 'SKILL_ERROR');
  assertEqual(wFail.error, 'Skill on cooldown');
  // Targeting skill must remain Q!
  assertEqual(dispatcher.targetingSkill, 'Q');

  // E costs 50 mana, hero only has 30 mana
  hero.mana = 30;
  const eFail = dispatcher.handleKeyDown('E', hero);
  assertEqual(eFail.type, 'SKILL_ERROR');
  assertEqual(eFail.error, 'Insufficient mana');
  // Targeting skill must remain Q!
  assertEqual(dispatcher.targetingSkill, 'Q');

  // Pressing Escape cancels Q cleanly
  const cancel = dispatcher.handleKeyDown('Escape');
  assertEqual(cancel.type, CommandType.CANCEL_TARGETING);
  assertEqual(cancel.skill, 'Q');
  assertEqual(dispatcher.targetingSkill, null);
});

test('2.4 Left-click cast confirmation clears targeting and produces CAST_ABILITY with valid coords', () => {
  const camera = new Camera({ worldX: 500, worldY: 500, viewportWidth: 1280, viewportHeight: 720 });
  const inputMgr = new InputManager(null, camera);
  const hero = createMockHero({ x: 500, y: 500 });
  inputMgr.setPlayerHero(hero);

  let castCmd = null;
  inputMgr.onCommand(cmd => { if (cmd.type === CommandType.CAST_ABILITY) castCmd = cmd; });

  // Activate E (Ground AoE)
  inputMgr.handleKeyDown({ key: 'e' });
  assertEqual(inputMgr.targetingSkill, 'E');

  // Left click at screen (700, 400)
  inputMgr.updateCursor(700, 400);
  inputMgr.handlePointerDown({ button: 0, clientX: 700, clientY: 400 });

  assert(castCmd !== null, 'Left-click should confirm and dispatch CAST_ABILITY');
  assertEqual(castCmd.slot, 'E');
  assert(typeof castCmd.targetX === 'number' && !isNaN(castCmd.targetX));
  assert(typeof castCmd.targetY === 'number' && !isNaN(castCmd.targetY));
  assertEqual(inputMgr.targetingSkill, null, 'Targeting must be cleared after cast');
  assertEqual(inputMgr.targetingState, null);
});

test('2.5 Double-tap self-cast for TARGET_UNIT ability with canSelfCast', () => {
  const camera = new Camera({ worldX: 500, worldY: 500, viewportWidth: 1280, viewportHeight: 720 });
  const inputMgr = new InputManager(null, camera);
  const hero = createMockHero({
    x: 450,
    y: 450,
    abilities: {
      W: {
        id: 'holy_shield',
        targetingType: IndicatorType.TARGET_UNIT,
        canSelfCast: true,
        range: 500,
        manaCost: 50,
        cooldownRemaining: 0
      }
    }
  });
  inputMgr.setPlayerHero(hero);

  let castCmd = null;
  inputMgr.onCommand(cmd => { if (cmd.type === CommandType.CAST_ABILITY) castCmd = cmd; });

  // First tap: enter targeting
  inputMgr.handleKeyDown({ key: 'w' });
  assertEqual(inputMgr.targetingSkill, 'W');

  // Second tap: triggers double-tap self-cast!
  inputMgr.handleKeyDown({ key: 'w' });

  assert(castCmd !== null, 'Double tap should dispatch self-cast CAST_ABILITY');
  assertEqual(castCmd.slot, 'W');
  assertEqual(castCmd.targetId, hero.id);
  assertEqual(castCmd.targetX, hero.x);
  assertEqual(castCmd.targetY, hero.y);
  assertEqual(inputMgr.targetingSkill, null, 'Targeting should be cleared after double-tap self-cast');
});

test('2.6 Fuzzing stress test: 10,000 randomized rapid key/mouse state transitions without corruption', () => {
  const dispatcher = new InputDispatcher({ x: 0, y: 0 }, 1.0, { width: 1280, height: 720 });
  const hero = createMockHero();

  const keys = ['Q', 'W', 'E', 'R', 'S', 'H', 'B', 'Escape', 'invalid_key', ''];
  const buttons = [0, 2, 1];

  const start = performance.now();
  for (let i = 0; i < 10000; i++) {
    const action = Math.random();
    if (action < 0.6) {
      // Key event
      const key = keys[Math.floor(Math.random() * keys.length)];
      // Randomly toggle mana / cooldown to test boundaries
      hero.mana = Math.random() < 0.1 ? 0 : 300;
      hero.abilities.Q.cooldownRemaining = Math.random() < 0.1 ? 5 : 0;
      dispatcher.handleKeyDown(key, hero);
    } else {
      // Mouse event
      const btn = buttons[Math.floor(Math.random() * buttons.length)];
      const sx = (Math.random() * 2000) - 400; // include out of bounds
      const sy = (Math.random() * 2000) - 400;
      dispatcher.handleMouseDown(btn, sx, sy, null);
    }

    // Invariant: targetingSkill is either null or one of 'Q', 'W', 'E', 'R'
    const target = dispatcher.targetingSkill;
    assert(
      target === null || ['Q', 'W', 'E', 'R'].includes(target),
      `Corrupted targetingSkill: ${target} at iteration ${i}`
    );
  }
  const elapsed = performance.now() - start;
  assert(elapsed < 200, `10,000 transitions took ${elapsed.toFixed(2)}ms, must finish in < 200ms`);
});

// ============================================================================
// SECTION 3: MINIMAP UNPROJECTION AND COORDINATE BOUNDS
// ============================================================================
section('3. Minimap Unprojection and Coordinate Bounds');

test('3.1 Minimap all 4 corners: (0, 0), (200, 0), (200, 200), (0, 200) unproject to exact map bounds', () => {
  const minimap = new Minimap(null);

  // Corner 1: Top-Left (0, 0)
  const c1 = minimap.mapToWorld(0, 0);
  assertCloseTo(c1.wx, 0, 0.001, 'Top-Left WX');
  assertCloseTo(c1.wy, 0, 0.001, 'Top-Left WY');

  // Corner 2: Top-Right (200, 0)
  const c2 = minimap.mapToWorld(200, 0);
  assertCloseTo(c2.wx, 3200, 0.001, 'Top-Right WX');
  assertCloseTo(c2.wy, 0, 0.001, 'Top-Right WY');

  // Corner 3: Bottom-Right (200, 200)
  const c3 = minimap.mapToWorld(200, 200);
  assertCloseTo(c3.wx, 3200, 0.001, 'Bottom-Right WX');
  assertCloseTo(c3.wy, 3200, 0.001, 'Bottom-Right WY');

  // Corner 4: Bottom-Left (0, 200)
  const c4 = minimap.mapToWorld(0, 200);
  assertCloseTo(c4.wx, 0, 0.001, 'Bottom-Left WX');
  assertCloseTo(c4.wy, 3200, 0.001, 'Bottom-Left WY');
});

test('3.2 Minimap 4 borders: Midpoint and edge unprojections', () => {
  const minimap = new Minimap(null);

  // Top Border Midpoint (100, 0)
  const topMid = minimap.mapToWorld(100, 0);
  assertCloseTo(topMid.wx, 1600, 0.001);
  assertCloseTo(topMid.wy, 0, 0.001);

  // Right Border Midpoint (200, 100)
  const rightMid = minimap.mapToWorld(200, 100);
  assertCloseTo(rightMid.wx, 3200, 0.001);
  assertCloseTo(rightMid.wy, 1600, 0.001);

  // Bottom Border Midpoint (100, 200)
  const bottomMid = minimap.mapToWorld(100, 200);
  assertCloseTo(bottomMid.wx, 1600, 0.001);
  assertCloseTo(bottomMid.wy, 3200, 0.001);

  // Left Border Midpoint (0, 100)
  const leftMid = minimap.mapToWorld(0, 100);
  assertCloseTo(leftMid.wx, 0, 0.001);
  assertCloseTo(leftMid.wy, 1600, 0.001);

  // Center (100, 100)
  const center = minimap.mapToWorld(100, 100);
  assertCloseTo(center.wx, 1600, 0.001);
  assertCloseTo(center.wy, 1600, 0.001);
});

test('3.3 Out-of-bounds clicks on minimap clamp strictly to [0, 3200]', () => {
  const minimap = new Minimap(null);

  const extremePoints = [
    { mx: -50, my: -50, expX: 0, expY: 0 },
    { mx: 300, my: 300, expX: 3200, expY: 3200 },
    { mx: -10000, my: 100, expX: 0, expY: 1600 },
    { mx: 100, my: 99999, expX: 1600, expY: 3200 },
    { mx: Infinity, my: -Infinity, expX: 3200, expY: 0 }
  ];

  for (const pt of extremePoints) {
    const res = minimap.mapToWorld(pt.mx, pt.my);
    assertCloseTo(res.wx, pt.expX, 0.001, `Clamped WX for (${pt.mx}, ${pt.my})`);
    assertCloseTo(res.wy, pt.expY, 0.001, `Clamped WY for (${pt.mx}, ${pt.my})`);
    assert(res.wx >= 0 && res.wx <= 3200, 'WX must be in [0, 3200]');
    assert(res.wy >= 0 && res.wy <= 3200, 'WY must be in [0, 3200]');
  }
});

test('3.4 Minimap worldToMap clamping for off-map entities', () => {
  const minimap = new Minimap(null);

  const offMapEntities = [
    { wx: -500, wy: -500, expMx: 0, expMy: 0 },
    { wx: 5000, wy: 5000, expMx: 200, expMy: 200 },
    { wx: 1600, wy: -100, expMx: 100, expMy: 0 },
    { wx: 4000, wy: 1600, expMx: 200, expMy: 100 }
  ];

  for (const e of offMapEntities) {
    const m = minimap.worldToMap(e.wx, e.wy);
    assertCloseTo(m.mx, e.expMx, 0.001);
    assertCloseTo(m.my, e.expMy, 0.001);
  }
});

test('3.5 Interactive minimap click and drag dispatch simulation with mock DOM canvas', () => {
  const eventListeners = {};
  const mockCanvas = {
    getBoundingClientRect: () => ({ left: 1000, top: 500, width: 200, height: 200 }),
    addEventListener: (type, fn) => { eventListeners[type] = fn; }
  };

  const savedWindow = globalThis.window;
  const windowListeners = {};
  globalThis.window = {
    addEventListener: (type, fn) => { windowListeners[type] = fn; }
  };

  try {
    const minimap = new Minimap(mockCanvas);
    let lastMoveTarget = null;
    let lastPanTarget = null;

    minimap.setupInteraction(
      (wx, wy) => { lastMoveTarget = { wx, wy }; },
      (wx, wy) => { lastPanTarget = { wx, wy }; }
    );

    // 1. Right-click click at canvas center (clientX=1100, clientY=600 -> mx=100, my=100)
    eventListeners['pointerdown']({
      button: 2,
      clientX: 1100,
      clientY: 600,
      stopPropagation: () => {}
    });
    assert(lastMoveTarget !== null, 'Right click on minimap must invoke onMoveCommand');
    assertCloseTo(lastMoveTarget.wx, 1600, 1.0);
    assertCloseTo(lastMoveTarget.wy, 1600, 1.0);

    // 2. Left-click pointerdown at Top-Right (clientX=1200, clientY=500 -> mx=200, my=0)
    eventListeners['pointerdown']({
      button: 0,
      clientX: 1200,
      clientY: 500,
      stopPropagation: () => {}
    });
    assert(lastPanTarget !== null, 'Left click on minimap must invoke onPanCommand');
    assertCloseTo(lastPanTarget.wx, 3200, 1.0);
    assertCloseTo(lastPanTarget.wy, 0, 1.0);

    // 3. Pointermove drag while dragging is active (drag to Bottom-Left: clientX=1000, clientY=700)
    windowListeners['pointermove']({
      button: 0,
      clientX: 1000,
      clientY: 700
    });
    assertCloseTo(lastPanTarget.wx, 0, 1.0);
    assertCloseTo(lastPanTarget.wy, 3200, 1.0);

    // 4. Pointerup ends dragging
    windowListeners['pointerup']();
    assertEqual(minimap.isDragging, false);

    // Subsequent pointermove should do nothing
    lastPanTarget = null;
    windowListeners['pointermove']({ clientX: 1100, clientY: 600 });
    assertEqual(lastPanTarget, null, 'No pan command after pointerup');
  } finally {
    globalThis.window = savedWindow;
  }
});

test('3.6 Frustum quad calculations under extreme camera locations', () => {
  const drawCalls = [];
  const mockCtx = {
    clearRect: () => {},
    fillRect: () => {},
    beginPath: () => {},
    moveTo: (x, y) => drawCalls.push(['moveTo', x, y]),
    lineTo: (x, y) => drawCalls.push(['lineTo', x, y]),
    closePath: () => {},
    stroke: () => {},
    fill: () => {},
    arc: () => {}
  };
  const mockCanvas = { getContext: () => mockCtx, width: 200, height: 200 };
  const minimap = new Minimap(mockCanvas);

  const extremeCameras = [
    new Camera({ worldX: 0, worldY: 0, viewportWidth: 1280, viewportHeight: 720 }),
    new Camera({ worldX: 3200, worldY: 3200, viewportWidth: 1280, viewportHeight: 720 }),
    new Camera({ worldX: -500, worldY: 4500, viewportWidth: 1920, viewportHeight: 1080 })
  ];

  for (const cam of extremeCameras) {
    drawCalls.length = 0;
    minimap.render({ entities: [] }, cam, 1.0, cam.viewportWidth, cam.viewportHeight);

    // Verify all quad vertices passed to moveTo/lineTo are valid numbers in [0, 200]
    for (const call of drawCalls) {
      const [_, x, y] = call;
      assert(!isNaN(x) && !isNaN(y), `Frustum vertex must not be NaN: (${x}, ${y})`);
      assert(x >= 0 && x <= 200, `Minimap X vertex must be clamped to [0, 200], got ${x}`);
      assert(y >= 0 && y <= 200, `Minimap Y vertex must be clamped to [0, 200], got ${y}`);
    }
  }
});

// ============================================================================
// SECTION 4: HIGH-FREQUENCY INPUT SIMULATION (1,000 SIMULTANEOUS EVENTS)
// ============================================================================
section('4. High-Frequency Input Simulation (1,000 Simultaneous Events)');

test('4.1 High-frequency burst: 1,000 simultaneous right-clicks in InputDispatcher', () => {
  const dispatcher = new InputDispatcher({ x: 0, y: 0 }, 1.0, { width: 1280, height: 720 });

  const start = performance.now();
  const commands = [];

  for (let i = 0; i < 1000; i++) {
    // Generate pseudo-random coordinates across screen
    const sx = (i * 17) % 1280;
    const sy = (i * 31) % 720;
    const cmd = dispatcher.handleMouseDown(2, sx, sy, null);
    commands.push(cmd);
  }

  const elapsed = performance.now() - start;

  assertEqual(commands.length, 1000, 'Must generate exactly 1,000 commands');
  for (let i = 0; i < 1000; i++) {
    const cmd = commands[i];
    assertEqual(cmd.type, CommandType.MOVE_TO);
    assert(typeof cmd.x === 'number' && !isNaN(cmd.x));
    assert(typeof cmd.y === 'number' && !isNaN(cmd.y));
    assert(cmd.x >= 0 && cmd.x <= MAP_SIZE);
    assert(cmd.y >= 0 && cmd.y <= MAP_SIZE);
  }

  const opsPerSec = Math.round((1000 / elapsed) * 1000);
  console.log(`    ${COLORS.dim}Throughput: ${opsPerSec.toLocaleString()} ops/sec (${elapsed.toFixed(2)}ms for 1,000 clicks)${COLORS.reset}`);
  assert(elapsed < 30, `1,000 right-clicks took ${elapsed.toFixed(2)}ms, must finish in < 30ms`);
});

test('4.2 High-frequency pointermove burst during right-drag: Throttle prevents command flooding', () => {
  const camera = new Camera({ worldX: 500, worldY: 500, viewportWidth: 1280, viewportHeight: 720 });
  const inputMgr = new InputManager(null, camera);
  const hero = createMockHero();
  inputMgr.setPlayerHero(hero);

  const dispatched = [];
  inputMgr.onCommand(cmd => dispatched.push(cmd));

  // Press right mouse button down at t=0
  inputMgr.handlePointerDown({ button: 2, clientX: 640, clientY: 360 });
  assertEqual(inputMgr.isRightDown, true);
  const initialCommands = dispatched.length; // 1 initial command

  // Simulate 1,000 pointermove events in instantaneous burst (same frame, elapsed time = 0)
  const start = performance.now();
  for (let i = 0; i < 1000; i++) {
    const cx = 640 + ((i % 100) - 50);
    const cy = 360 + ((i % 100) - 50);
    inputMgr.handlePointerMove({ clientX: cx, clientY: cy });
    // Update loop running in same tick
    inputMgr.update(0.016, hero);
  }
  const elapsed = performance.now() - start;

  // Since time did not advance by >= 80ms, the throttle must prevent spamming 1,000 commands!
  const additionalCommands = dispatched.length - initialCommands;
  console.log(`    ${COLORS.dim}Burst result: 1,000 pointer events -> ${additionalCommands} throttled commands dispatched${COLORS.reset}`);
  assert(
    additionalCommands < 5,
    `Throttle failed! Dispatched ${additionalCommands} commands in instantaneous burst (expected < 5)`
  );
  assert(elapsed < 50, `1,000 pointer moves processed in ${elapsed.toFixed(2)}ms (< 50ms)`);
});

test('4.3 Continuous right-drag across 1,000 simulated frames over time: Steady throttled command rate', () => {
  const camera = new Camera({ worldX: 500, worldY: 500, viewportWidth: 1280, viewportHeight: 720 });
  const inputMgr = new InputManager(null, camera);
  const hero = createMockHero();
  inputMgr.setPlayerHero(hero);

  const dispatched = [];
  inputMgr.onCommand(cmd => dispatched.push(cmd));

  inputMgr.handlePointerDown({ button: 2, clientX: 640, clientY: 360 });
  dispatched.length = 0; // reset

  // Simulate 1,000 frames at 60 FPS (16.67ms per frame = 16.67 seconds of dragging)
  // At 80ms throttle interval, 16,667ms / 80ms ≈ 208 commands expected.
  let simulatedTime = 1000;
  const originalNow = performance.now;

  try {
    performance.now = () => simulatedTime;

    const start = originalNow.call(performance);
    for (let frame = 0; frame < 1000; frame++) {
      simulatedTime += 16.6667;
      // Mouse moves in a circle
      const angle = frame * 0.05;
      const cx = 640 + 200 * Math.cos(angle);
      const cy = 360 + 150 * Math.sin(angle);

      inputMgr.handlePointerMove({ clientX: cx, clientY: cy });
      inputMgr.update(0.0166667, hero);
    }
    const realElapsed = originalNow.call(performance) - start;

    console.log(`    ${COLORS.dim}1,000 frames (16.7s simulated): dispatched ${dispatched.length} commands in ${realElapsed.toFixed(2)}ms${COLORS.reset}`);
    // Expected around ~208 commands (tolerance 190 - 220)
    assert(
      dispatched.length >= 190 && dispatched.length <= 220,
      `Expected ~208 commands over 16.7s at 80ms throttle, got ${dispatched.length}`
    );

    // Verify all dispatched commands are valid MOVE_TO with valid clamped coordinates
    for (const cmd of dispatched) {
      assertEqual(cmd.type, CommandType.MOVE_TO);
      assert(cmd.x >= 0 && cmd.x <= MAP_SIZE);
      assert(cmd.y >= 0 && cmd.y <= MAP_SIZE);
    }
  } finally {
    performance.now = originalNow;
  }
});

test('4.4 Pointer up cleanly terminates drag and resets input flags', () => {
  const inputMgr = new InputManager();
  const hero = createMockHero();
  inputMgr.setPlayerHero(hero);

  const dispatched = [];
  inputMgr.onCommand(cmd => dispatched.push(cmd));

  inputMgr.handlePointerDown({ button: 2, clientX: 600, clientY: 300 });
  assertEqual(inputMgr.isRightDown, true);

  inputMgr.handlePointerUp({ button: 2 });
  assertEqual(inputMgr.isRightDown, false);

  const countBefore = dispatched.length;
  // Further updates do not produce drag commands
  inputMgr.update(0.1, hero);
  assertEqual(dispatched.length, countBefore, 'No commands should be dispatched after pointerup');
});

test('4.5 Memory & GC stress: 100,000 input events produce no runaway heap allocation', () => {
  const dispatcher = new InputDispatcher({ x: 0, y: 0 }, 1.0, { width: 1280, height: 720 });
  const hero = createMockHero();

  if (globalThis.gc) {
    globalThis.gc();
  }
  const memBefore = process.memoryUsage().heapUsed;

  const start = performance.now();
  for (let i = 0; i < 100000; i++) {
    dispatcher.handleMouseDown(2, (i * 13) % 1280, (i * 29) % 720, null);
    if (i % 100 === 0) {
      dispatcher.handleKeyDown('Q', hero);
      dispatcher.handleMouseDown(0, 640, 360, null);
    }
  }
  const elapsed = performance.now() - start;
  const memAfter = process.memoryUsage().heapUsed;
  const memDeltaMB = (memAfter - memBefore) / (1024 * 1024);

  console.log(`    ${COLORS.dim}100,000 events in ${elapsed.toFixed(2)}ms (heap delta: ${memDeltaMB.toFixed(2)}MB)${COLORS.reset}`);
  assert(elapsed < 500, `100,000 events took ${elapsed.toFixed(2)}ms (< 500ms)`);
  assert(memDeltaMB < 30, `Heap grew by ${memDeltaMB.toFixed(2)}MB, must be < 30MB`);
});

// ============================================================================
// SUMMARY & VERDICT
// ============================================================================
console.log(`\n${COLORS.bold}================================================================${COLORS.reset}`);
console.log(`${COLORS.bold}                     STRESS TEST SUMMARY                        ${COLORS.reset}`);
console.log(`${COLORS.bold}================================================================${COLORS.reset}`);
console.log(`Total Stress Tests:  ${testCount}`);
console.log(`Passed:              ${COLORS.green}${passCount}${COLORS.reset}`);
console.log(`Failed:              ${failCount > 0 ? COLORS.red : COLORS.green}${failCount}${COLORS.reset}`);

if (failCount > 0) {
  console.log(`\n${COLORS.red}${COLORS.bold}VERDICT: REJECT${COLORS.reset}`);
  console.log(`Failures:`);
  for (const f of failures) {
    console.log(` - ${f.name}: ${f.error.message}`);
  }
  process.exit(1);
} else {
  console.log(`\n${COLORS.green}${COLORS.bold}VERDICT: APPROVE${COLORS.reset}`);
  console.log(`All stress tests passed cleanly with 100% correctness and high-frequency stability.`);
  process.exit(0);
}
