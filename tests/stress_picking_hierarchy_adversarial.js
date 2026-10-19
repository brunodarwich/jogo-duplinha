/**
 * Adversarial Stress Harness: Advanced Multi-Tier Stacking & Edge Scenarios
 *
 * Verifies:
 * 1. Multi-unit stacked clusters: Neutral monsters + Allied minions + Enemy minions + Towers
 * 2. Cascading untargetability across all 5 tiers
 * 3. Irregular selection radii & boundary-edge distance calculations
 * 4. 10,000-unit mixed entity swarm stress test (< 100ms)
 * 5. Minimap NaN resilience, 0-dimension canvas resilience, and frustum integrity
 *
 * Run: node tests/stress_picking_hierarchy_adversarial.js
 */

import { performance } from 'node:perf_hooks';
import {
  InputManager,
  InputDispatcher,
  CommandType
} from '../src/core/input.js';
import { Minimap } from '../src/ui/hud.js';
import { Camera } from '../src/core/camera.js';
import { screenToWorld } from '../src/core/isometric.js';

let passed = 0;
let failed = 0;

function assert(condition, message = 'Assertion failed') {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message ? message + ': ' : ''}Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function runTest(desc, fn) {
  const t0 = performance.now();
  try {
    fn();
    const dt = (performance.now() - t0).toFixed(2);
    console.log(`  ✔ [PASS] ${desc} (${dt}ms)`);
    passed++;
  } catch (err) {
    const dt = (performance.now() - t0).toFixed(2);
    console.error(`  ✖ [FAIL] ${desc} (${dt}ms): ${err.message}`);
    failed++;
  }
}

console.log('\n================================================================');
console.log('  CHALLENGER 2: Adversarial Multi-Tier Stacking & HUD Hardening ');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// SCENARIO 1: COMPLEX MULTI-UNIT MIXED STACK
// -----------------------------------------------------------------------------
console.log('=== Scenario 1: Complex Multi-Unit Mixed Stack ===');

runTest('1.1 Stacked Neutral Monster, Allied Minion, Enemy Minion, and Enemy Tower', () => {
  const inputMgr = new InputManager();
  inputMgr.worldX = 1500;
  inputMgr.worldY = 1500;
  const playerHero = { id: 'player_hero', team: 'allied' };

  // 4 units all located within selection distance
  const allyMinion = { id: 'ally_creep', team: 'allied', type: 'minion', x: 1500, y: 1500, hp: 200, radius: 25 };
  const neutralMonster = { id: 'neutral_golem', team: 'neutral', type: 'minion', x: 1500, y: 1500, hp: 800, radius: 35 };
  const enemyTower = { id: 'enemy_turret', team: 'enemy', type: 'tower', x: 1500, y: 1500, hp: 3000, radius: 45 };
  const enemyMinion = { id: 'enemy_creep', team: 'enemy', type: 'minion', x: 1500, y: 1500, hp: 250, radius: 25 };

  // Initial pick with all 4 alive: Enemy Minion (T4) must win over Tower (T3), Neutral (T2), and Ally (T1)
  const picked1 = inputMgr.pickEntity([allyMinion, neutralMonster, enemyTower, enemyMinion], playerHero);
  assertEqual(picked1.id, 'enemy_creep', 'Enemy Minion (T4) must win over Tower, Neutral, Ally');

  // Enemy Minion killed -> Enemy Tower (T3) must win over Neutral and Ally
  enemyMinion.hp = 0;
  const picked2 = inputMgr.pickEntity([allyMinion, neutralMonster, enemyTower, enemyMinion], playerHero);
  assertEqual(picked2.id, 'enemy_turret', 'Enemy Tower (T3) must win over Neutral and Ally once minion dies');

  // Enemy Tower destroyed -> Neutral Monster (T2) must win over Ally (T1)
  enemyTower.isDead = true;
  const picked3 = inputMgr.pickEntity([allyMinion, neutralMonster, enemyTower, enemyMinion], playerHero);
  assertEqual(picked3.id, 'neutral_golem', 'Neutral Monster (T2) must win over Ally (T1) once tower is destroyed');

  // Neutral Monster dies -> Allied Minion (T1) is picked
  neutralMonster.hp = -5;
  const picked4 = inputMgr.pickEntity([allyMinion, neutralMonster, enemyTower, enemyMinion], playerHero);
  assertEqual(picked4.id, 'ally_creep', 'Allied Minion (T1) is picked when all higher tiers are dead');

  // Allied Minion dies -> Returns null
  allyMinion.isDead = () => true;
  const picked5 = inputMgr.pickEntity([allyMinion, neutralMonster, enemyTower, enemyMinion], playerHero);
  assertEqual(picked5, null, 'Returns null when all stacked entities are dead');
});

runTest('1.2 Untargetability cascades correctly down the 5-tier stack', () => {
  const inputMgr = new InputManager();
  inputMgr.worldX = 2000;
  inputMgr.worldY = 2000;
  const playerHero = { id: 'player_hero', team: 'allied' };

  const enemyHero = { id: 'e_hero', team: 'enemy', type: 'hero', x: 2000, y: 2000, hp: 1000, radius: 30, isUntargetable: () => true };
  const enemyMinion = { id: 'e_minion', team: 'enemy', type: 'minion', x: 2000, y: 2000, hp: 200, radius: 25, isUntargetable: () => true };
  const enemyTower = { id: 'e_tower', team: 'enemy', type: 'tower', x: 2000, y: 2000, hp: 3000, radius: 40, isUntargetable: () => true };
  const neutralMonster = { id: 'neutral_wolf', team: 'neutral', type: 'minion', x: 2000, y: 2000, hp: 400, radius: 30, isUntargetable: () => false };
  const alliedMinion = { id: 'ally_m', team: 'allied', type: 'minion', x: 2000, y: 2000, hp: 200, radius: 25 };

  // When T5, T4, T3 are all untargetable, Neutral Monster (T2) must be selected!
  const picked = inputMgr.pickEntity([enemyHero, enemyMinion, enemyTower, neutralMonster, alliedMinion], playerHero);
  assertEqual(picked.id, 'neutral_wolf', 'Untargetable T5/T4/T3 must bypass to T2 Neutral Monster');

  // When Neutral becomes untargetable too, Allied Minion is selected!
  neutralMonster.isUntargetable = () => true;
  const pickedAlly = inputMgr.pickEntity([enemyHero, enemyMinion, enemyTower, neutralMonster, alliedMinion], playerHero);
  assertEqual(pickedAlly.id, 'ally_m', 'Untargetable T5/T4/T3/T2 must bypass to T1 Allied Minion');
});

runTest('1.3 Radii overlap with differing centers: Spatial precision test', () => {
  const inputMgr = new InputManager();
  const playerHero = { id: 'player_hero', team: 'allied' };

  // Tower center at (1000, 1000), radius 50 (covers 950 to 1050)
  const tower = { id: 'tower', team: 'enemy', type: 'tower', x: 1000, y: 1000, hp: 3000, radius: 50 };
  // Neutral Monster center at (970, 1000), radius 20 (covers 950 to 990)
  const neutral = { id: 'neutral', team: 'neutral', type: 'minion', x: 970, y: 1000, hp: 500, radius: 20 };

  // Point A: Cursor at (965, 1000)
  // Distance to neutral: |965 - 970| = 5 <= 20 (INSIDE neutral)
  // Distance to tower: |965 - 1000| = 35 <= 50 (INSIDE tower)
  // Both are hit. Tower (T3) must defeat Neutral (T2)!
  inputMgr.worldX = 965;
  inputMgr.worldY = 1000;
  assertEqual(inputMgr.pickEntity([neutral, tower], playerHero).id, 'tower', 'Inside both -> Tower wins (T3 > T2)');

  // Point B: Cursor at (955, 1000)
  // Distance to neutral: |955 - 970| = 15 <= 20 (INSIDE neutral)
  // Distance to tower: |955 - 1000| = 45 <= 50 (INSIDE tower)
  // Tower still wins!
  inputMgr.worldX = 955;
  inputMgr.worldY = 1000;
  assertEqual(inputMgr.pickEntity([neutral, tower], playerHero).id, 'tower', 'Inside both -> Tower wins');

  // Point C: Cursor at (945, 1000)
  // Distance to neutral: |945 - 970| = 25 > 20 (OUTSIDE neutral)
  // Distance to tower: |945 - 1000| = 55 > 50 (OUTSIDE tower)
  inputMgr.worldX = 945;
  inputMgr.worldY = 1000;
  assertEqual(inputMgr.pickEntity([neutral, tower], playerHero), null, 'Outside both -> Returns null');

  // Point D: Cursor at (1040, 1000)
  // Distance to neutral: |1040 - 970| = 70 > 20 (OUTSIDE neutral)
  // Distance to tower: |1040 - 1000| = 40 <= 50 (INSIDE tower)
  inputMgr.worldX = 1040;
  inputMgr.worldY = 1000;
  assertEqual(inputMgr.pickEntity([neutral, tower], playerHero).id, 'tower', 'Inside tower only -> Tower picked');
});

runTest('1.4 Massive mixed swarm performance: 10,000 units processed in < 30ms', () => {
  const inputMgr = new InputManager();
  inputMgr.worldX = 1600;
  inputMgr.worldY = 1600;
  const playerHero = { id: 'player_hero', team: 'allied' };

  const swarm = [];
  // 3,000 Allies
  for (let i = 0; i < 3000; i++) {
    swarm.push({ id: `ally_${i}`, team: 'allied', type: 'minion', x: 1600 + (i % 20) - 10, y: 1600 + (i % 20) - 10, hp: 150, radius: 25 });
  }
  // 3,000 Neutrals
  for (let i = 0; i < 3000; i++) {
    swarm.push({ id: `neut_${i}`, team: 'neutral', type: 'minion', x: 1600 + (i % 20) - 10, y: 1600 + (i % 20) - 10, hp: 400, radius: 25 });
  }
  // 2,000 Towers & Structures
  for (let i = 0; i < 2000; i++) {
    swarm.push({ id: `tower_${i}`, team: 'enemy', type: 'tower', x: 1600 + (i % 20) - 10, y: 1600 + (i % 20) - 10, hp: 2500, radius: 35 });
  }
  // 1,999 Enemy Minions
  for (let i = 0; i < 1999; i++) {
    swarm.push({ id: `eminion_${i}`, team: 'enemy', type: 'minion', x: 1600 + (i % 20) - 10, y: 1600 + (i % 20) - 10, hp: 200, radius: 25 });
  }
  // 1 Enemy Hero at the very end
  swarm.push({ id: 'boss_enemy_hero', team: 'enemy', type: 'hero', x: 1600, y: 1600, hp: 1500, radius: 30 });

  const t0 = performance.now();
  const picked = inputMgr.pickEntity(swarm, playerHero);
  const elapsed = performance.now() - t0;

  assertEqual(picked.id, 'boss_enemy_hero', 'Hostile Hero must be picked across 10,000 mixed entities');
  assert(elapsed < 30, `Picking across 10,000 units took ${elapsed.toFixed(2)}ms (< 30ms required)`);
});

// -----------------------------------------------------------------------------
// SCENARIO 2: HUD MINIMAP HARDENING & BOUNDARY STRESS
// -----------------------------------------------------------------------------
console.log('\n=== Scenario 2: HUD Minimap Hardening & Boundary Stress ===');

runTest('2.1 Camera with non-finite coordinates renders safely without poisoning minimap', () => {
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

  const rawPoisonedCamera = {
    x: NaN,
    y: Infinity,
    worldX: NaN,
    worldY: -Infinity,
    zoom: NaN,
    viewportWidth: NaN,
    viewportHeight: NaN
  };

  minimap.render({ entities: [] }, rawPoisonedCamera, 1.0, 1280, 720);

  // Verify all draw calls contain strictly finite coordinates
  for (const call of drawCalls) {
    const [_, x, y] = call;
    assert(Number.isFinite(x), `Minimap draw call X must be finite: ${x}`);
    assert(Number.isFinite(y), `Minimap draw call Y must be finite: ${y}`);
  }
});

runTest('2.2 Zero-dimension and negative-dimension canvas bounds handle gracefully', () => {
  const eventListeners = {};
  const mockCanvas = {
    getBoundingClientRect: () => ({ left: 500, top: 300, width: 0, height: 0 }), // collapsed canvas
    addEventListener: (type, fn) => { eventListeners[type] = fn; }
  };

  const savedWindow = globalThis.window;
  globalThis.window = { addEventListener: () => {} };

  try {
    const minimap = new Minimap(mockCanvas);
    let panTarget = null;
    minimap.setupInteraction(null, (wx, wy) => { panTarget = { wx, wy }; });

    // Click on 0-width canvas does not throw divide-by-zero exception and clamps safely
    eventListeners['pointerdown']({
      button: 0,
      clientX: 550,
      clientY: 350,
      stopPropagation: () => {}
    });

    assert(panTarget !== null, 'Pan command dispatched');
    assert(Number.isFinite(panTarget.wx), 'WX must be finite');
    assert(Number.isFinite(panTarget.wy), 'WY must be finite');
    assert(panTarget.wx >= 0 && panTarget.wx <= 3200, 'WX must clamp to [0, 3200]');
    assert(panTarget.wy >= 0 && panTarget.wy <= 3200, 'WY must clamp to [0, 3200]');
  } finally {
    globalThis.window = savedWindow;
  }
});

runTest('2.3 Minimap entity rendering handles mixed entity roster cleanly', () => {
  const drawnEntities = [];
  const mockCtx = {
    clearRect: () => {},
    fillRect: (x, y, w, h) => drawnEntities.push({ type: 'rect', x, y, w, h }),
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    stroke: () => {},
    fill: () => {},
    arc: (x, y, r) => drawnEntities.push({ type: 'arc', x, y, r })
  };
  const mockCanvas = { getContext: () => mockCtx, width: 200, height: 200 };
  const minimap = new Minimap(mockCanvas);

  const gameState = {
    entities: [
      { id: 'h1', type: 'hero', team: 'allied', x: 400, y: 400, hp: 1000, isLocalPlayer: true },
      { id: 'h2', type: 'hero', team: 'enemy', x: 2800, y: 2800, hp: 1000, isLocalPlayer: false },
      { id: 't1', type: 'tower', team: 'allied', x: 950, y: 950, hp: 3500 },
      { id: 't2', type: 'tower', team: 'enemy', x: 2250, y: 2250, hp: 3500 },
      { id: 'nx1', type: 'nexus', team: 'allied', x: 250, y: 250, hp: 8000 },
      { id: 'm1', type: 'minion', team: 'allied', x: 1200, y: 1200, hp: 200 },
      { id: 'm2', type: 'minion', team: 'enemy', x: 1300, y: 1300, hp: 200 },
      { id: 'dead_m', type: 'minion', team: 'enemy', x: 1300, y: 1300, hp: 0, isDead: true } // should be skipped
    ]
  };

  const camera = new Camera({ worldX: 400, worldY: 400, viewportWidth: 1280, viewportHeight: 720 });
  minimap.render(gameState, camera, 1.0, 1280, 720);

  // 7 alive entities rendered (dead_m skipped)
  assert(drawnEntities.length >= 7, `Expected at least 7 entities rendered, got ${drawnEntities.length}`);
});

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`Adversarial Checks: ${passed + failed}`);
console.log(`Passed:             ${passed}`);
console.log(`Failed:             ${failed}`);
console.log('================================================================\n');

if (failed > 0) {
  console.error('VERDICT: REJECT');
  process.exit(1);
} else {
  console.log('VERDICT: APPROVE');
  process.exit(0);
}
