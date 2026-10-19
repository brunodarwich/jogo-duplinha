/**
 * Deep Stress Test Harness: 5-Tier Picking Hierarchy & Minimap Stress
 *
 * Verifies under empirical stress:
 * 1. 5-Tier Picking Hierarchy (Hero > Minion > Tower/Boss > Neutral > Ally)
 *    under all permutations (120 ordering combinations), exact coordinate stacking,
 *    distance-vs-priority trade-offs, and fallback cascades.
 * 2. Attack vs Move command dispatch across all 5 tiers.
 * 3. Minimap frustum & click navigation under extreme aspect ratios, zoom levels, and boundary coords.
 *
 * Run: node tests/stress_picking_hierarchy_deep.js
 */

import { performance } from 'node:perf_hooks';
import {
  InputManager,
  InputDispatcher,
  CommandType,
  MAP_SIZE
} from '../src/core/input.js';
import { Minimap } from '../src/ui/hud.js';
import { Camera } from '../src/core/camera.js';

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
    console.error(`  ✖ FAIL ${name} (${duration}ms): ${err.message}`);
    failCount++;
    failures.push({ name, error: err });
  }
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
    throw new Error(`${message ? message + ': ' : ''}Expected ${actual} close to ${expected} (eps ${epsilon})`);
  }
}

console.log('\n================================================================');
console.log('  CHALLENGER 2: Deep 5-Tier Picking Hierarchy & Minimap Stress   ');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// SECTION 1: 5-TIER HIERARCHY PERMUTATION STACKING
// -----------------------------------------------------------------------------
console.log('=== 1. 5-Tier Picking Hierarchy Permutations & Stacking ===');

test('1.1 All 120 array permutations of 5 stacked tiers always pick Priority 5 (Hostile Hero)', () => {
  const inputMgr = new InputManager();
  inputMgr.worldX = 1000;
  inputMgr.worldY = 1000;
  const playerHero = { id: 'player', team: 'allied' };

  const tier5 = { id: 't5_hero', team: 'enemy', type: 'hero', x: 1000, y: 1000, hp: 1000, radius: 30 };
  const tier4 = { id: 't4_minion', team: 'enemy', type: 'minion', x: 1000, y: 1000, hp: 200, radius: 25 };
  const tier3 = { id: 't3_tower', team: 'enemy', type: 'tower', x: 1000, y: 1000, hp: 3000, radius: 40 };
  const tier2 = { id: 't2_neutral', team: 'neutral', type: 'minion', x: 1000, y: 1000, hp: 500, radius: 30 };
  const tier1 = { id: 't1_ally', team: 'allied', type: 'hero', x: 1000, y: 1000, hp: 1000, radius: 30 };

  const units = [tier5, tier4, tier3, tier2, tier1];

  function getPermutations(arr) {
    if (arr.length <= 1) return [arr];
    const perms = [];
    for (let i = 0; i < arr.length; i++) {
      const rest = arr.slice(0, i).concat(arr.slice(i + 1));
      for (const p of getPermutations(rest)) {
        perms.push([arr[i], ...p]);
      }
    }
    return perms;
  }

  const allPerms = getPermutations(units);
  assertEqual(allPerms.length, 120, '5! = 120 permutations');

  for (let i = 0; i < allPerms.length; i++) {
    const perm = allPerms[i];
    const picked = inputMgr.pickEntity(perm, playerHero);
    assert(picked !== null, `Permutation ${i} picked null`);
    assertEqual(picked.id, 't5_hero', `Permutation ${i} failed to pick Hostile Hero`);
  }
});

test('1.2 Full 5-tier fallback cascade across all 24 permutations per step', () => {
  const inputMgr = new InputManager();
  inputMgr.worldX = 500;
  inputMgr.worldY = 500;
  const playerHero = { id: 'player', team: 'allied' };

  function getPermutations(arr) {
    if (arr.length <= 1) return [arr];
    const perms = [];
    for (let i = 0; i < arr.length; i++) {
      const rest = arr.slice(0, i).concat(arr.slice(i + 1));
      for (const p of getPermutations(rest)) {
        perms.push([arr[i], ...p]);
      }
    }
    return perms;
  }

  // Step A: T5 eliminated -> T4 (Hostile Minion) must win all 24 perms of [T4, T3, T2, T1]
  const unitsWithout5 = [
    { id: 't4_minion', team: 'enemy', type: 'minion', x: 500, y: 500, hp: 200, radius: 30 },
    { id: 't3_tower', team: 'enemy', type: 'tower', x: 500, y: 500, hp: 3000, radius: 40 },
    { id: 't2_neutral', team: 'neutral', type: 'minion', x: 500, y: 500, hp: 500, radius: 30 },
    { id: 't1_ally', team: 'allied', type: 'minion', x: 500, y: 500, hp: 200, radius: 30 }
  ];
  for (const perm of getPermutations(unitsWithout5)) {
    const picked = inputMgr.pickEntity(perm, playerHero);
    assertEqual(picked.id, 't4_minion', 'Hostile Minion must win when Hostile Hero is absent');
  }

  // Step B: T5 & T4 eliminated -> T3 (Hostile Tower) must win all 6 perms of [T3, T2, T1]
  const unitsWithout4 = [
    { id: 't3_tower', team: 'enemy', type: 'tower', x: 500, y: 500, hp: 3000, radius: 40 },
    { id: 't2_neutral', team: 'neutral', type: 'minion', x: 500, y: 500, hp: 500, radius: 30 },
    { id: 't1_ally', team: 'allied', type: 'minion', x: 500, y: 500, hp: 200, radius: 30 }
  ];
  for (const perm of getPermutations(unitsWithout4)) {
    const picked = inputMgr.pickEntity(perm, playerHero);
    assertEqual(picked.id, 't3_tower', 'Hostile Tower must win when Hostile Minion is absent');
  }

  // Step C: T5, T4, T3 eliminated -> T2 (Neutral) must win both perms of [T2, T1]
  const unitsWithout3 = [
    { id: 't2_neutral', team: 'neutral', type: 'minion', x: 500, y: 500, hp: 500, radius: 30 },
    { id: 't1_ally', team: 'allied', type: 'minion', x: 500, y: 500, hp: 200, radius: 30 }
  ];
  for (const perm of getPermutations(unitsWithout3)) {
    const picked = inputMgr.pickEntity(perm, playerHero);
    assertEqual(picked.id, 't2_neutral', 'Neutral Monster must win when Hostile Structures are absent');
  }

  // Step D: Only T1 remains -> Allied unit is picked
  const picked1 = inputMgr.pickEntity([unitsWithout3[1]], playerHero);
  assertEqual(picked1.id, 't1_ally', 'Allied unit is picked when sole candidate');
});

test('1.3 Neutral variants (team neutral vs type neutral) both achieve Priority 2', () => {
  const inputMgr = new InputManager();
  inputMgr.worldX = 400;
  inputMgr.worldY = 400;
  const playerHero = { id: 'player', team: 'allied' };

  // Variant A: team: 'neutral'
  const neutA = { id: 'neut_team', team: 'neutral', type: 'jungle_wolf', x: 400, y: 400, hp: 300, radius: 30 };
  const allyA = { id: 'ally_a', team: 'allied', type: 'minion', x: 400, y: 400, hp: 200, radius: 30 };
  assertEqual(inputMgr.pickEntity([allyA, neutA], playerHero).id, 'neut_team');

  // Variant B: type: 'neutral'
  const neutB = { id: 'neut_type', team: 'none', type: 'neutral', x: 400, y: 400, hp: 300, radius: 30 };
  const allyB = { id: 'ally_b', team: 'allied', type: 'minion', x: 400, y: 400, hp: 200, radius: 30 };
  assertEqual(inputMgr.pickEntity([allyB, neutB], playerHero).id, 'neut_type');

  // Both lose to Hostile Tower (Priority 3)
  const tower = { id: 'enemy_tower', team: 'enemy', type: 'tower', x: 400, y: 400, hp: 3000, radius: 40 };
  assertEqual(inputMgr.pickEntity([neutA, tower], playerHero).id, 'enemy_tower');
  assertEqual(inputMgr.pickEntity([neutB, tower], playerHero).id, 'enemy_tower');
});

test('1.4 Hostile Structures: Tower, Boss, and Nexus all receive Priority 3 and dominate Neutral', () => {
  const inputMgr = new InputManager();
  inputMgr.worldX = 1200;
  inputMgr.worldY = 1200;
  const playerHero = { id: 'player', team: 'allied' };

  const neutral = { id: 'neutral_golem', team: 'neutral', type: 'minion', x: 1200, y: 1200, hp: 1000, radius: 35 };

  const structures = [
    { id: 'tower', team: 'enemy', type: 'tower', x: 1200, y: 1200, hp: 3500, radius: 45 },
    { id: 'boss', team: 'enemy', type: 'boss', x: 1200, y: 1200, hp: 6000, radius: 50 },
    { id: 'nexus', team: 'enemy', type: 'nexus', x: 1200, y: 1200, hp: 8000, radius: 60 }
  ];

  for (const struct of structures) {
    const picked1 = inputMgr.pickEntity([neutral, struct], playerHero);
    assertEqual(picked1.id, struct.id, `${struct.type} must beat neutral when neutral is first`);

    const picked2 = inputMgr.pickEntity([struct, neutral], playerHero);
    assertEqual(picked2.id, struct.id, `${struct.type} must beat neutral when structure is first`);
  }
});

test('1.5 Distance-Priority Tradeoff: Higher priority dominates within radius regardless of proximity', () => {
  const inputMgr = new InputManager();
  inputMgr.worldX = 1000;
  inputMgr.worldY = 1000;
  const playerHero = { id: 'player', team: 'allied' };

  // Neutral at distance 0 (exact cursor)
  const neutralAtZero = { id: 'neutral_exact', team: 'neutral', type: 'minion', x: 1000, y: 1000, hp: 500, radius: 30 };
  // Enemy Tower at distance 25 (inside radius 40)
  const towerAtOffset = { id: 'tower_offset', team: 'enemy', type: 'tower', x: 1025, y: 1000, hp: 3000, radius: 40 };

  const picked = inputMgr.pickEntity([neutralAtZero, towerAtOffset], playerHero);
  assertEqual(picked.id, 'tower_offset', 'Priority 3 Tower at dist=25 must beat Priority 2 Neutral at dist=0');

  // Enemy Minion at distance 20 (inside radius 25) vs Enemy Tower at distance 0
  const minionAtOffset = { id: 'minion_offset', team: 'enemy', type: 'minion', x: 1020, y: 1000, hp: 200, radius: 25 };
  const towerAtZero = { id: 'tower_zero', team: 'enemy', type: 'tower', x: 1000, y: 1000, hp: 3000, radius: 40 };

  const picked2 = inputMgr.pickEntity([towerAtZero, minionAtOffset], playerHero);
  assertEqual(picked2.id, 'minion_offset', 'Priority 4 Minion at dist=20 must beat Priority 3 Tower at dist=0');

  // Enemy Hero at distance 28 (inside radius 30) vs Enemy Minion at distance 0
  const heroAtOffset = { id: 'hero_offset', team: 'enemy', type: 'hero', x: 1028, y: 1000, hp: 800, radius: 30 };
  const minionAtZero = { id: 'minion_zero', team: 'enemy', type: 'minion', x: 1000, y: 1000, hp: 200, radius: 25 };

  const picked3 = inputMgr.pickEntity([minionAtZero, heroAtOffset], playerHero);
  assertEqual(picked3.id, 'hero_offset', 'Priority 5 Hero at dist=28 must beat Priority 4 Minion at dist=0');
});

test('1.6 Outside selection radius units are ignored completely', () => {
  const inputMgr = new InputManager();
  inputMgr.worldX = 1000;
  inputMgr.worldY = 1000;
  const playerHero = { id: 'player', team: 'allied' };

  // Enemy Hero outside selection radius (dist = 31 > radius 30)
  const heroOutside = { id: 'hero_outside', team: 'enemy', type: 'hero', x: 1031, y: 1000, hp: 800, radius: 30 };
  // Enemy Minion inside selection radius (dist = 15 <= radius 25)
  const minionInside = { id: 'minion_inside', team: 'enemy', type: 'minion', x: 1015, y: 1000, hp: 200, radius: 25 };

  const picked = inputMgr.pickEntity([heroOutside, minionInside], playerHero);
  assertEqual(picked.id, 'minion_inside', 'Outside radius entity must be ignored even if higher priority');
});

test('1.7 Tie-breaking within same priority by exact Euclidean distance', () => {
  const inputMgr = new InputManager();
  inputMgr.worldX = 500;
  inputMgr.worldY = 500;
  const playerHero = { id: 'player', team: 'allied' };

  // 3 neutral monsters at varying distances
  const neut1 = { id: 'neut_dist_20', team: 'neutral', type: 'minion', x: 520, y: 500, hp: 300, radius: 30 }; // dist 20
  const neut2 = { id: 'neut_dist_10', team: 'neutral', type: 'minion', x: 510, y: 500, hp: 300, radius: 30 }; // dist 10
  const neut3 = { id: 'neut_dist_25', team: 'neutral', type: 'minion', x: 525, y: 500, hp: 300, radius: 30 }; // dist 25

  const picked = inputMgr.pickEntity([neut1, neut3, neut2], playerHero);
  assertEqual(picked.id, 'neut_dist_10', 'Tie breaking among neutrals must select closest (dist=10)');

  // 3 allied minions
  const ally1 = { id: 'ally_dist_18', team: 'allied', type: 'minion', x: 500, y: 518, hp: 200, radius: 25 };
  const ally2 = { id: 'ally_dist_5', team: 'allied', type: 'minion', x: 500, y: 505, hp: 200, radius: 25 };
  const ally3 = { id: 'ally_dist_22', team: 'allied', type: 'minion', x: 500, y: 522, hp: 200, radius: 25 };

  const pickedAlly = inputMgr.pickEntity([ally1, ally3, ally2], playerHero);
  assertEqual(pickedAlly.id, 'ally_dist_5', 'Tie breaking among allies must select closest (dist=5)');
});

// -----------------------------------------------------------------------------
// SECTION 2: COMMAND DISPATCH (ATTACK VS MOVE) ACROSS TIERS
// -----------------------------------------------------------------------------
console.log('\n=== 2. Command Dispatch Across All 5 Tiers ===');

test('2.1 Smart right-click dispatches ATTACK_TARGET for Tiers 5, 4, 3, 2, but MOVE_TO for Tier 1 (Allies)', () => {
  const inputMgr = new InputManager();
  const playerHero = { id: 'player', team: 'allied', x: 200, y: 200 };
  inputMgr.setPlayerHero(playerHero);

  const dispatched = [];
  inputMgr.onCommand(cmd => dispatched.push(cmd));

  const testCases = [
    { tier: 5, entity: { id: 'e_hero', team: 'enemy', type: 'hero', x: 600, y: 600 }, expectedType: CommandType.ATTACK_TARGET },
    { tier: 4, entity: { id: 'e_minion', team: 'enemy', type: 'minion', x: 600, y: 600 }, expectedType: CommandType.ATTACK_TARGET },
    { tier: 3, entity: { id: 'e_tower', team: 'enemy', type: 'tower', x: 600, y: 600 }, expectedType: CommandType.ATTACK_TARGET },
    { tier: 2, entity: { id: 'neut_golem', team: 'neutral', type: 'monster', x: 600, y: 600 }, expectedType: CommandType.ATTACK_TARGET },
    { tier: 1, entity: { id: 'ally_minion', team: 'allied', type: 'minion', x: 600, y: 600 }, expectedType: CommandType.MOVE_TO }
  ];

  for (const tc of testCases) {
    dispatched.length = 0;
    inputMgr.hoveredEntity = tc.entity;
    inputMgr.dispatchSmartRightClick(playerHero);

    assertEqual(dispatched.length, 1, `Must dispatch 1 command for Tier ${tc.tier}`);
    assertEqual(dispatched[0].type, tc.expectedType, `Tier ${tc.tier} command type mismatch`);
    if (tc.expectedType === CommandType.ATTACK_TARGET) {
      assertEqual(dispatched[0].targetId, tc.entity.id);
    }
  }
});

test('2.2 InputDispatcher handleMouseDown button 2 dispatches ATTACK_TARGET for Neutral units', () => {
  const dispatcher = new InputDispatcher();
  const neutralCreep = { id: 'neutral_123', team: 'neutral', x: 700, y: 700 };

  const cmd = dispatcher.handleMouseDown(2, 640, 360, neutralCreep);
  assertEqual(cmd.type, CommandType.ATTACK_TARGET, 'Right-clicking neutral unit must attack');
  assertEqual(cmd.targetId, 'neutral_123');
  assertEqual(cmd.targetX, 700);
  assertEqual(cmd.targetY, 700);
});

// -----------------------------------------------------------------------------
// SECTION 3: HUD MINIMAP STRESS UNDER EXTREME CONDITIONS
// -----------------------------------------------------------------------------
console.log('\n=== 3. HUD Minimap Stress Under Extreme Conditions ===');

test('3.1 Frustum rendering under 10 extreme aspect ratios and zoom levels', () => {
  const quadCalls = [];
  const mockCtx = {
    clearRect: () => {},
    fillRect: () => {},
    beginPath: () => {},
    moveTo: (x, y) => quadCalls.push({ op: 'moveTo', x, y }),
    lineTo: (x, y) => quadCalls.push({ op: 'lineTo', x, y }),
    closePath: () => {},
    stroke: () => {},
    fill: () => {},
    arc: () => {}
  };
  const mockCanvas = { getContext: () => mockCtx, width: 200, height: 200 };
  const minimap = new Minimap(mockCanvas);

  const configs = [
    { vw: 1280, vh: 720, zoom: 1.0, wx: 1600, wy: 1600 },   // 16:9 standard
    { vw: 1920, vh: 1080, zoom: 0.5, wx: 1600, wy: 1600 },  // 16:9 zoomed out
    { vw: 800, vh: 600, zoom: 2.0, wx: 800, wy: 800 },      // 4:3 zoomed in
    { vw: 2560, vh: 1080, zoom: 1.0, wx: 2000, wy: 2000 },  // 21:9 ultrawide
    { vw: 720, vh: 1280, zoom: 1.0, wx: 1000, wy: 2500 },   // 9:16 vertical
    { vw: 1000, vh: 1000, zoom: 0.1, wx: 1600, wy: 1600 },  // 1:1 massive zoom out
    { vw: 1000, vh: 1000, zoom: 5.0, wx: 1600, wy: 1600 },  // 1:1 massive zoom in
    { vw: 1280, vh: 720, zoom: 1.0, wx: 0, wy: 0 },         // Map corner 0,0
    { vw: 1280, vh: 720, zoom: 1.0, wx: 3200, wy: 3200 },   // Map corner 3200,3200
    { vw: 1280, vh: 720, zoom: 1.0, wx: -1000, wy: 4500 }   // Far off-map
  ];

  for (let idx = 0; idx < configs.length; idx++) {
    const cfg = configs[idx];
    quadCalls.length = 0;
    const cam = new Camera({ worldX: cfg.wx, worldY: cfg.wy, viewportWidth: cfg.vw, viewportHeight: cfg.vh, zoom: cfg.zoom });

    minimap.render({ entities: [] }, cam, cfg.zoom, cfg.vw, cfg.vh);

    // The first 4 calls are lane corridor and river; the last 4 calls are the frustum quad
    const frustumVertices = quadCalls.slice(-4);
    assertEqual(frustumVertices.length, 4, `Config ${idx} must generate 4 frustum vertices`);
    for (const pt of frustumVertices) {
      assert(Number.isFinite(pt.x), `Vertex X must be finite in config ${idx}`);
      assert(Number.isFinite(pt.y), `Vertex Y must be finite in config ${idx}`);
      assert(pt.x >= 0 && pt.x <= 200, `Vertex X (${pt.x}) clamped to [0, 200] in config ${idx}`);
      assert(pt.y >= 0 && pt.y <= 200, `Vertex Y (${pt.y}) clamped to [0, 200] in config ${idx}`);
    }
  }
});

test('3.2 Minimap high-throughput stress: 100,000 coordinate conversions in < 50ms', () => {
  const minimap = new Minimap(null);
  const start = performance.now();

  for (let i = 0; i < 50000; i++) {
    const wx = (i * 23) % 4000 - 400;
    const wy = (i * 37) % 4000 - 400;
    const mapPt = minimap.worldToMap(wx, wy);
    assert(mapPt.mx >= 0 && mapPt.mx <= 200);
    assert(mapPt.my >= 0 && mapPt.my <= 200);

    const worldPt = minimap.mapToWorld(mapPt.mx, mapPt.my);
    assert(worldPt.wx >= 0 && worldPt.wx <= 3200);
    assert(worldPt.wy >= 0 && worldPt.wy <= 3200);
  }

  const duration = performance.now() - start;
  console.log(`    Throughput: 100,000 map conversions in ${duration.toFixed(2)}ms`);
  assert(duration < 50, `Expected < 50ms, took ${duration.toFixed(2)}ms`);
});

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`Total Stress Tests: ${testCount}`);
console.log(`Passed:             ${passCount}`);
console.log(`Failed:             ${failCount}`);
console.log('================================================================\n');

if (failCount > 0) {
  console.error('VERDICT: REJECT');
  process.exit(1);
} else {
  console.log('VERDICT: APPROVE');
  process.exit(0);
}
