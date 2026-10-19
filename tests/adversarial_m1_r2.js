import { Camera } from '../src/core/camera.js';
import { GameLoop, FIXED_TIMESTEP, MAX_ACCUMULATOR } from '../src/core/loop.js';
import { InputManager, InputDispatcher, CommandType } from '../src/core/input.js';
import { Minimap } from '../src/ui/hud.js';
import { worldToScreen, screenToWorld } from '../src/core/isometric.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    failed++;
    console.error(`FAIL: ${message}`);
    throw new Error(`FAIL: ${message}`);
  } else {
    passed++;
    console.log(`PASS: ${message}`);
  }
}

console.log('================================================================');
console.log(' ADVERSARIAL STRESS TEST SUITE: REVIEWER 2 (ITERATION 2)');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// SECTION 1: Camera Finiteness & Boundary Robustness
// -----------------------------------------------------------------------------
console.log('>>> [1/4] Testing Camera LookAt & Update Finiteness Guards...');

{
  const cam = new Camera({ worldX: 1000, worldY: 1000, bounds: { minX: 0, minY: 0, maxX: 3200, maxY: 3200 } });

  // 1.1 Non-finite lookAt calls
  cam.lookAt(NaN, NaN);
  assert(cam.worldX === 1000 && cam.worldY === 1000, 'lookAt(NaN, NaN) leaves camera unchanged');
  assert(Number.isFinite(cam.x) && Number.isFinite(cam.y), 'Projected camera x/y remain finite after lookAt(NaN)');

  cam.lookAt(Infinity, -Infinity);
  assert(cam.worldX === 1000 && cam.worldY === 1000, 'lookAt(Infinity, -Infinity) leaves camera unchanged');

  cam.lookAt(undefined, null);
  assert(cam.worldX === 1000 && cam.worldY === 1000, 'lookAt(undefined, null) leaves camera unchanged');

  // 1.2 Boundary clamping
  cam.lookAt(-500, 5000);
  assert(cam.worldX === 0 && cam.worldY === 3200, 'lookAt clamps to bounds [0, 3200]');

  // 1.3 Target tracking with non-finite target coordinates
  const poisonTarget = { x: NaN, y: Infinity, hp: 100, isDead: false };
  cam.follow(poisonTarget);
  cam.update(0.01667);
  assert(cam.worldX === 0 && cam.worldY === 3200, 'update with NaN target coordinates preserves camera position');
  assert(Number.isFinite(cam.worldX) && Number.isFinite(cam.worldY), 'camera.worldX/Y remain finite with poisoned target');

  // 1.4 Non-finite dt inputs
  cam.update(NaN);
  assert(Number.isFinite(cam.worldX) && Number.isFinite(cam.worldY), 'update(NaN) does not corrupt camera position');

  cam.update(-1.0);
  assert(Number.isFinite(cam.worldX) && Number.isFinite(cam.worldY), 'update(-1.0) does not reverse or corrupt camera');

  cam.update(0);
  assert(Number.isFinite(cam.worldX) && Number.isFinite(cam.worldY), 'update(0) does not corrupt camera');

  // 1.5 Recovery when target recovers
  poisonTarget.x = 1600;
  poisonTarget.y = 1600;
  cam.update(1.0); // 1 second smoothing
  assert(cam.worldX > 0 && cam.worldY < 3200, 'Camera recovers and tracks target once coordinates become finite');

  // 1.6 Target death holds camera
  poisonTarget.isDead = true;
  const lockedX = cam.worldX;
  const lockedY = cam.worldY;
  poisonTarget.x = 2500;
  poisonTarget.y = 2500;
  cam.update(0.5);
  assert(cam.worldX === lockedX && cam.worldY === lockedY, 'Dead target (isDead=true) freezes camera tracking');
}

// -----------------------------------------------------------------------------
// SECTION 2: GameLoop Accumulator & Step Guard
// -----------------------------------------------------------------------------
console.log('\n>>> [2/4] Testing GameLoop Step Finiteness & Spiral-of-Death Protection...');

{
  let ticks = 0;
  const loop = new GameLoop({
    fixedTimestep: 16.6667,
    maxAccumulator: 100,
    onUpdate: () => ticks++
  });

  // 2.1 Non-finite and invalid deltaMs
  loop.step(NaN);
  assert(loop.accumulator === 0 && ticks === 0, 'step(NaN) does not poison accumulator or execute ticks');

  loop.step(Infinity);
  assert(loop.accumulator === 0 && ticks === 0, 'step(Infinity) does not execute ticks');

  loop.step(-100);
  assert(loop.accumulator === 0 && ticks === 0, 'step(-100) does not decrement accumulator');

  loop.step(0);
  assert(loop.accumulator === 0 && ticks === 0, 'step(0) does nothing');

  // 2.2 Massive lag spike cap
  loop.step(10000); // 10 seconds lag spike
  assert(ticks === 6, '10s lag spike is capped at maxAccumulator (100ms) resulting in exactly 6 ticks');
  assert(loop.accumulator < 16.6667, 'Accumulator drained below fixedTimestep after lag spike');

  // 2.3 Resumption on valid deltaMs
  ticks = 0;
  loop.step(16.6667);
  assert(ticks >= 1, 'Valid deltaMs steps simulation normally');
}

// -----------------------------------------------------------------------------
// SECTION 3: 5-Tier Entity Picking Hierarchy & Neutral Hostility
// -----------------------------------------------------------------------------
console.log('\n>>> [3/4] Testing 5-Tier Entity Picking Hierarchy & Hostility...');

{
  const inputMgr = new InputManager();
  inputMgr.worldX = 500;
  inputMgr.worldY = 500;
  const playerHero = { id: 'player_hero', team: 'allied' };

  const enemyHero = { id: 'enemy_hero', team: 'enemy', type: 'hero', x: 500, y: 500, hp: 500, radius: 30 };
  const enemyMinion = { id: 'enemy_minion', team: 'enemy', type: 'minion', x: 500, y: 500, hp: 200, radius: 30 };
  const enemyTower = { id: 'enemy_tower', team: 'enemy', type: 'tower', x: 500, y: 500, hp: 2000, radius: 40 };
  const enemyBoss = { id: 'enemy_boss', team: 'enemy', type: 'boss', x: 500, y: 500, hp: 5000, radius: 50 };
  const neutralCreep = { id: 'neutral_creep', team: 'neutral', type: 'minion', x: 500, y: 500, hp: 300, radius: 30 };
  const neutralMonster = { id: 'neutral_monster', team: 'neutral', type: 'neutral', x: 500, y: 500, hp: 800, radius: 35 };
  const allyHero = { id: 'ally_hero', team: 'allied', type: 'hero', x: 500, y: 500, hp: 500, radius: 30 };
  const allyMinion = { id: 'ally_minion', team: 'allied', type: 'minion', x: 500, y: 500, hp: 200, radius: 30 };
  const allyTower = { id: 'ally_tower', team: 'allied', type: 'tower', x: 500, y: 500, hp: 2000, radius: 40 };

  // 3.1 Pairwise Priority Tests:
  // Priority 5 (Hostile Hero) vs Priority 4 (Hostile Minion)
  assert(inputMgr.pickEntity([enemyMinion, enemyHero], playerHero).id === 'enemy_hero', 'Hostile Hero (5) > Hostile Minion (4)');
  assert(inputMgr.pickEntity([enemyHero, enemyMinion], playerHero).id === 'enemy_hero', 'Hostile Hero (5) > Hostile Minion (4) order-independent');

  // Priority 4 (Hostile Minion) vs Priority 3 (Hostile Tower / Boss)
  assert(inputMgr.pickEntity([enemyTower, enemyMinion], playerHero).id === 'enemy_minion', 'Hostile Minion (4) > Hostile Tower (3)');
  assert(inputMgr.pickEntity([enemyBoss, enemyMinion], playerHero).id === 'enemy_minion', 'Hostile Minion (4) > Hostile Boss (3)');

  // Priority 3 (Hostile Tower / Boss) vs Priority 2 (Neutral Creep / Monster)
  assert(inputMgr.pickEntity([neutralCreep, enemyTower], playerHero).id === 'enemy_tower', 'Hostile Tower (3) > Neutral Creep (2)');
  assert(inputMgr.pickEntity([neutralMonster, enemyTower], playerHero).id === 'enemy_tower', 'Hostile Tower (3) > Neutral Monster (2)');
  assert(inputMgr.pickEntity([neutralCreep, enemyBoss], playerHero).id === 'enemy_boss', 'Hostile Boss (3) > Neutral Creep (2)');

  // Priority 2 (Neutral) vs Priority 1 (Allied Units)
  assert(inputMgr.pickEntity([allyHero, neutralCreep], playerHero).id === 'neutral_creep', 'Neutral Creep (2) > Allied Hero (1)');
  assert(inputMgr.pickEntity([allyMinion, neutralCreep], playerHero).id === 'neutral_creep', 'Neutral Creep (2) > Allied Minion (1)');
  assert(inputMgr.pickEntity([allyTower, neutralCreep], playerHero).id === 'neutral_creep', 'Neutral Creep (2) > Allied Tower (1)');

  // 3.2 Full stack of all 9 entities at exact identical coordinates
  const allStacked = [allyTower, allyMinion, allyHero, neutralMonster, neutralCreep, enemyBoss, enemyTower, enemyMinion, enemyHero];
  assert(inputMgr.pickEntity(allStacked, playerHero).id === 'enemy_hero', 'Full stack selects Hostile Hero (5)');

  // Remove Hostile Hero -> selects Hostile Minion (4)
  const stackNoHero = allStacked.filter(e => e.id !== 'enemy_hero');
  assert(inputMgr.pickEntity(stackNoHero, playerHero).id === 'enemy_minion', 'Stack without Hero selects Hostile Minion (4)');

  // Remove Minion -> selects Hostile Tower or Boss (3)
  const stackNoMinion = stackNoHero.filter(e => e.id !== 'enemy_minion');
  const picked3 = inputMgr.pickEntity(stackNoMinion, playerHero);
  assert(picked3.id === 'enemy_tower' || picked3.id === 'enemy_boss', 'Stack without Minion selects Tower or Boss (3)');

  // Remove Tower & Boss -> selects Neutral (2)
  const stackNeutral = stackNoMinion.filter(e => e.type !== 'tower' && e.type !== 'boss');
  const picked2 = inputMgr.pickEntity(stackNeutral, playerHero);
  assert(picked2.id === 'neutral_creep' || picked2.id === 'neutral_monster', 'Stack selects Neutral (2)');

  // Remove Neutrals -> selects Ally (1)
  const stackAlly = stackNeutral.filter(e => e.team !== 'neutral' && e.type !== 'neutral');
  assert(inputMgr.pickEntity(stackAlly, playerHero).team === 'allied', 'Stack selects Allied (1)');

  // 3.3 Dead and untargetable handling
  const deadHero = { ...enemyHero, hp: 0 };
  assert(inputMgr.pickEntity([deadHero, enemyMinion], playerHero).id === 'enemy_minion', 'Dead hero is skipped in favor of minion');

  const untargetableHero = { ...enemyHero, isUntargetable: () => true };
  assert(inputMgr.pickEntity([untargetableHero, enemyMinion], playerHero).id === 'enemy_minion', 'Untargetable hero is skipped in favor of minion');

  // 3.4 Tie-breaking by distance
  const farNeutral = { id: 'far_neutral', team: 'neutral', type: 'minion', x: 520, y: 500, hp: 100, radius: 30 };
  const nearNeutral = { id: 'near_neutral', team: 'neutral', type: 'minion', x: 505, y: 500, hp: 100, radius: 30 };
  assert(inputMgr.pickEntity([farNeutral, nearNeutral], playerHero).id === 'near_neutral', 'Distance tie-breaking picks closest entity');

  // 3.5 Hostility check & InputDispatcher command generation
  const dispatcher = new InputDispatcher({ x: 0, y: 0 }, 1.0, { width: 1280, height: 720 });
  const neutralCmd = dispatcher.handleMouseDown(2, 640, 360, neutralCreep);
  assert(neutralCmd.type === CommandType.ATTACK_TARGET, 'Right-clicking neutral creep issues ATTACK_TARGET in InputDispatcher');
  assert(neutralCmd.targetId === 'neutral_creep', 'TargetId matches neutral creep');

  const enemyCmd = dispatcher.handleMouseDown(2, 640, 360, enemyHero);
  assert(enemyCmd.type === CommandType.ATTACK_TARGET, 'Right-clicking enemy hero issues ATTACK_TARGET in InputDispatcher');

  const allyCmd = dispatcher.handleMouseDown(2, 640, 360, allyHero);
  assert(allyCmd.type === CommandType.MOVE_TO, 'Right-clicking ally unit issues MOVE_TO in InputDispatcher');

  const groundCmd = dispatcher.handleMouseDown(2, 640, 360, null);
  assert(groundCmd.type === CommandType.MOVE_TO, 'Right-clicking ground issues MOVE_TO');
}

// -----------------------------------------------------------------------------
// SECTION 4: Minimap Camera Frustum Geometry
// -----------------------------------------------------------------------------
console.log('\n>>> [4/4] Testing Minimap Camera Frustum Diamond Geometry...');

{
  const minimap = new Minimap({ mapSize: 3200, width: 200, height: 200 });
  const camera = {
    worldX: 1600,
    worldY: 1600,
    x: 0,
    y: 800,
    viewportWidth: 1280,
    viewportHeight: 720,
    zoom: 1.0
  };

  const path = [];
  const mockCtx = {
    clearRect: () => {},
    fillRect: () => {},
    beginPath: () => path.length = 0,
    moveTo: (x, y) => path.push({ x, y }),
    lineTo: (x, y) => path.push({ x, y }),
    closePath: () => {},
    stroke: () => {},
    fill: () => {},
    arc: () => {}
  };
  minimap.ctx = mockCtx;

  minimap.render({ entities: [] }, camera, 1.0, 1280, 720);

  assert(path.length >= 4, 'Minimap renders 4-vertex frustum polygon');
  const p0 = path[0];
  const p1 = path[1];
  const p2 = path[2];
  const p3 = path[3];

  // Diagonal distance between opposite corners p0 and p2
  const diag1 = Math.hypot(p2.x - p0.x, p2.y - p0.y);
  // Diagonal distance between opposite corners p1 and p3
  const diag2 = Math.hypot(p3.x - p1.x, p3.y - p1.y);

  console.log(`Minimap Frustum Diagonals: ${diag1.toFixed(2)}px by ${diag2.toFixed(2)}px`);
  assert(Math.abs(diag1 - 170.29) < 0.5, `Frustum diagonal 1 is ~170.29px (actual: ${diag1.toFixed(2)}px)`);
  assert(Math.abs(diag2 - 170.29) < 0.5, `Frustum diagonal 2 is ~170.29px (actual: ${diag2.toFixed(2)}px)`);

  // Side lengths:
  const side1 = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  const side2 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  console.log(`Minimap Frustum Sides: ${side1.toFixed(2)}px by ${side2.toFixed(2)}px`);
  assert(Math.abs(side1 - 113.14) < 0.5, `Side 1 width is ~113.14px (actual: ${side1.toFixed(2)}px)`);
  assert(Math.abs(side2 - 127.28) < 0.5, `Side 2 height is ~127.28px (actual: ${side2.toFixed(2)}px)`);

  // Test at extreme corner of map (0, 0)
  camera.worldX = 0;
  camera.worldY = 0;
  camera.x = 0;
  camera.y = 0;
  minimap.render({ entities: [] }, camera, 1.0, 1280, 720);
  assert(path.every(pt => Number.isFinite(pt.x) && Number.isFinite(pt.y)), 'Minimap frustum points at map corner (0,0) are all finite');

  // Test at extreme corner of map (3200, 3200)
  camera.worldX = 3200;
  camera.worldY = 3200;
  camera.x = 0;
  camera.y = 1600;
  minimap.render({ entities: [] }, camera, 1.0, 1280, 720);
  assert(path.every(pt => Number.isFinite(pt.x) && Number.isFinite(pt.y)), 'Minimap frustum points at map corner (3200,3200) are all finite');
}

console.log('\n================================================================');
console.log(` ADVERSARIAL STRESS TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('ADVERSARIAL VERDICT: 100% PASS - ALL INVARIANTS ROBUST');
}
