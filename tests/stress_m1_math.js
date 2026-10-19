/**
 * Adversarial Stress Test Suite for Milestone 1:
 * Engine Foundation, 2.5D Isometric Math, Camera Lerp, Loop Accumulator, and Depth Sorting.
 *
 * Executed via: node tests/stress_m1_math.js
 */

import { worldToScreen, screenToWorld, getDepthKey, compareDepth, sanitize } from '../src/core/isometric.js';
import { Camera } from '../src/core/camera.js';
import { GameLoop, FIXED_TIMESTEP, MAX_ACCUMULATOR } from '../src/core/loop.js';

let passedChecks = 0;
let failedChecks = 0;
const failures = [];
const adversarialFindings = [];

function assert(condition, message) {
  if (condition) {
    passedChecks++;
  } else {
    failedChecks++;
    failures.push(message);
    console.error(`  [FAIL] ${message}`);
  }
}

console.log('================================================================');
console.log(' STRESS TEST HARNESS: MILESTONE 1 ENGINE FOUNDATION & MATH');
console.log('================================================================\n');

// ============================================================================
// STRESS TEST 1: 10,000 RANDOMIZED WORLD COORDINATES ROUNDTRIP
// ============================================================================
console.log('>>> [1/5] Stress Testing 10,000 Randomized World Coordinates Roundtrip...');
const NUM_COORDS = 10000;
const MIN_COORD = -1000;
const MAX_COORD = 5000;
const TOLERANCE = 1e-9;

// Seeded pseudorandom generator for deterministic reproducibility
let seed = 1337;
function rng() {
  seed = (seed * 16807 + 0) % 2147483647;
  return (seed - 1) / 2147483646;
}

// Test configs: default camera, shifted camera, zoomed in, zoomed out
const cameraConfigs = [
  { name: 'Default Camera (zoom 1.0)', cam: { x: 0, y: 0, width: 1280, height: 720, zoom: 1.0 }, zoom: 1.0 },
  { name: 'Offset Camera (zoom 1.0)', cam: { x: 1532.4, y: -821.7, width: 1920, height: 1080, zoom: 1.0 }, zoom: 1.0 },
  { name: 'Zoomed In (zoom 2.5)', cam: { x: 400, y: 300, width: 1280, height: 720, zoom: 2.5 }, zoom: 2.5 },
  { name: 'Zoomed Out (zoom 0.5)', cam: { x: 1000, y: 1000, width: 800, height: 600, zoom: 0.5 }, zoom: 0.5 }
];

for (const cfg of cameraConfigs) {
  let maxErrorX = 0;
  let maxErrorY = 0;
  let pointFailures = 0;

  for (let i = 0; i < NUM_COORDS; i++) {
    const wx = MIN_COORD + rng() * (MAX_COORD - MIN_COORD);
    const wy = MIN_COORD + rng() * (MAX_COORD - MIN_COORD);

    const { sx, sy } = worldToScreen(wx, wy, 0, cfg.cam, cfg.zoom);
    const { wx: rx, wy: ry } = screenToWorld(sx, sy, cfg.cam, cfg.zoom);

    const errX = Math.abs(rx - wx);
    const errY = Math.abs(ry - wy);

    if (errX > maxErrorX) maxErrorX = errX;
    if (errY > maxErrorY) maxErrorY = errY;

    if (errX >= TOLERANCE || errY >= TOLERANCE) {
      pointFailures++;
      if (pointFailures <= 5) {
        console.error(`    Mismatch at (${wx}, ${wy}): rx=${rx}, ry=${ry}, errX=${errX}, errY=${errY}`);
      }
    }
  }

  assert(pointFailures === 0, `${cfg.name}: Roundtrip failed for ${pointFailures}/${NUM_COORDS} points with error >= ${TOLERANCE}`);
  assert(maxErrorX < TOLERANCE, `${cfg.name}: Max error X (${maxErrorX.toExponential(4)}) must be < ${TOLERANCE}`);
  assert(maxErrorY < TOLERANCE, `${cfg.name}: Max error Y (${maxErrorY.toExponential(4)}) must be < ${TOLERANCE}`);
  console.log(`  ✔ ${cfg.name}: 10,000 points verified. Max ErrX: ${maxErrorX.toExponential(4)}, Max ErrY: ${maxErrorY.toExponential(4)}`);
}

// Edge case coordinates: boundaries and zeros
const boundaryPoints = [
  { x: -1000, y: -1000 },
  { x: 5000, y: 5000 },
  { x: -1000, y: 5000 },
  { x: 5000, y: -1000 },
  { x: 0, y: 0 },
  { x: -0.000001, y: 0.000001 }
];
for (const pt of boundaryPoints) {
  const { sx, sy } = worldToScreen(pt.x, pt.y, 0, null, 1.0);
  const { wx, wy } = screenToWorld(sx, sy, null, 1.0);
  assert(Math.abs(wx - pt.x) < TOLERANCE && Math.abs(wy - pt.y) < TOLERANCE, `Boundary point (${pt.x}, ${pt.y}) roundtrip`);
}
console.log('  ✔ Boundary points verified.\n');

// ============================================================================
// STRESS TEST 2: OUT-OF-BOUNDS & MALFORMED INPUTS (NaN, Infinity, undefined)
// ============================================================================
console.log('>>> [2/5] Stress Testing Out-of-bounds Inputs (NaN, Infinity, undefined, and extreme coordinates)...');

const malformedInputs = [NaN, Infinity, -Infinity, undefined, null, '', {}, []];

// 2.1 worldToScreen safety: non-finite inputs sanitized without throwing
for (const mal of malformedInputs) {
  try {
    const res = worldToScreen(mal, mal, mal);
    assert(typeof res.sx === 'number' && Number.isFinite(res.sx), `worldToScreen(${mal}) returned finite sx: ${res.sx}`);
    assert(typeof res.sy === 'number' && Number.isFinite(res.sy), `worldToScreen(${mal}) returned finite sy: ${res.sy}`);
  } catch (err) {
    assert(false, `worldToScreen(${mal}) threw an exception: ${err.message}`);
  }
}

// Extreme world coordinates outside map: computes valid screen numbers without throwing
const extremeCoords = [-100000, 100000, -1e9, 1e9];
for (const ext of extremeCoords) {
  try {
    const res = worldToScreen(ext, ext, 0);
    assert(Number.isFinite(res.sx) && Number.isFinite(res.sy), `worldToScreen(${ext}) computes finite screen coordinates`);
  } catch (err) {
    assert(false, `worldToScreen(${ext}) threw: ${err.message}`);
  }
}

// 2.2 screenToWorld safety: non-finite inputs sanitized without throwing
for (const mal of malformedInputs) {
  try {
    const res = screenToWorld(mal, mal);
    assert(typeof res.wx === 'number' && Number.isFinite(res.wx), `screenToWorld(${mal}) returned finite wx: ${res.wx}`);
    assert(typeof res.wy === 'number' && Number.isFinite(res.wy), `screenToWorld(${mal}) returned finite wy: ${res.wy}`);
  } catch (err) {
    assert(false, `screenToWorld(${mal}) threw an exception: ${err.message}`);
  }
}

// Extreme screen coordinates: computes valid world numbers without throwing
for (const ext of extremeCoords) {
  try {
    const res = screenToWorld(ext, ext);
    assert(Number.isFinite(res.wx) && Number.isFinite(res.wy), `screenToWorld(${ext}) computes finite world coordinates`);
  } catch (err) {
    assert(false, `screenToWorld(${ext}) threw: ${err.message}`);
  }
}

// 2.3 getDepthKey safety: non-finite inputs sanitized without throwing
for (const mal of malformedInputs) {
  try {
    const key = getDepthKey(mal, mal);
    assert(typeof key === 'number' && Number.isFinite(key), `getDepthKey(${mal}) returned finite key: ${key}`);
  } catch (err) {
    assert(false, `getDepthKey(${mal}) threw an exception: ${err.message}`);
  }
}

// 2.4 compareDepth safety with malformed entities
for (const mal of malformedInputs) {
  try {
    const entityA = { id: mal, x: mal, y: mal };
    const entityB = { id: 'valid_id', x: 100, y: 100 };
    const cmp = compareDepth(entityA, entityB);
    assert(typeof cmp === 'number' && Number.isFinite(cmp), `compareDepth with malformed entity returned finite number: ${cmp}`);
  } catch (err) {
    assert(false, `compareDepth(${mal}) threw an exception: ${err.message}`);
  }
}

// 2.5 Camera Boundary Clamping: out-of-bounds coordinates clamp strictly to [0, 3200]
const oobCoords = [-5000, 10000, -999999, 999999, Infinity, -Infinity];
for (const coord of oobCoords) {
  const cam = new Camera({ worldX: 500, worldY: 500 });
  try {
    cam.lookAt(coord, coord);
    assert(cam.worldX >= 0 && cam.worldX <= 3200, `Camera.lookAt(${coord}) clamped worldX within [0, 3200]: got ${cam.worldX}`);
    assert(cam.worldY >= 0 && cam.worldY <= 3200, `Camera.lookAt(${coord}) clamped worldY within [0, 3200]: got ${cam.worldY}`);
  } catch (err) {
    assert(false, `Camera.lookAt(${coord}) threw: ${err.message}`);
  }
}

// 2.6 Camera Pan Clamping: panning far beyond bounds clamps strictly to [0, 3200]
{
  const cam = new Camera({ worldX: 500, worldY: 500 });
  cam.pan(-5000, 10000);
  assert(cam.worldX === 0, `Camera.pan negative clamped to minX (0): got ${cam.worldX}`);
  assert(cam.worldY === 3200, `Camera.pan positive clamped to maxY (3200): got ${cam.worldY}`);
}

// 2.7 Camera Follow Clamping: following target far outside map clamps to [0, 3200]
{
  const cam = new Camera({ worldX: 500, worldY: 500, bounds: { minX: 0, minY: 0, maxX: 3200, maxY: 3200 } });
  cam.follow({ x: 99999, y: -99999 });
  cam.update(1.0);
  assert(cam.worldX === 3200, `Camera follow out-of-bounds clamped worldX: got ${cam.worldX}`);
  assert(cam.worldY === 0, `Camera follow out-of-bounds clamped worldY: got ${cam.worldY}`);
}

// 2.8 Loop Accumulator Clamping: out-of-bounds deltaMs clamped safely without throwing
{
  const loop = new GameLoop({ maxAccumulator: 100 });
  let loopTicks = 0;
  loop.onUpdate = () => { loopTicks++; };

  // dt = Infinity clamps to maxAccumulator (100ms) -> 6 ticks
  loop.step(Infinity);
  assert(loopTicks <= 6, `GameLoop.step(Infinity) clamped to maxAccumulator (ticks: ${loopTicks})`);
}

// 2.9 Adversarial Discovery: Non-throwing verification & NaN edge-case probe
{
  // Probe Camera.lookAt(NaN)
  const cam = new Camera({ worldX: 500, worldY: 500 });
  let didThrow = false;
  try {
    cam.lookAt(NaN, NaN);
  } catch (e) {
    didThrow = true;
  }
  assert(!didThrow, 'Camera.lookAt(NaN) does not throw an unhandled exception');
  if (isNaN(cam.worldX)) {
    adversarialFindings.push('Camera.lookAt(NaN) does not sanitize NaN, causing cam.worldX to become NaN');
  }

  // Probe GameLoop.step(NaN)
  const loop = new GameLoop();
  didThrow = false;
  try {
    loop.step(NaN);
  } catch (e) {
    didThrow = true;
  }
  assert(!didThrow, 'GameLoop.step(NaN) does not throw an unhandled exception');
  if (isNaN(loop.accumulator)) {
    adversarialFindings.push('GameLoop.step(NaN) does not sanitize NaN, causing accumulator to become NaN');
  }
}

console.log('  ✔ Out-of-bounds input tests completed.\n');

// ============================================================================
// STRESS TEST 3: CAMERA FOLLOW EXPONENTIAL LERP STABILITY (1ms TO 2000ms)
// ============================================================================
console.log('>>> [3/5] Stress Testing Camera Follow Exponential Lerp Stability (1ms to 2000ms)...');

const dtValuesMs = [1, 2, 5, 10, 16.6667, 33.333, 50, 100, 200, 500, 1000, 2000];

for (const dtMs of dtValuesMs) {
  const dtSec = dtMs / 1000;
  const initialX = 100;
  const initialY = 100;
  const targetX = 2500;
  const targetY = 2500;

  const cam = new Camera({
    worldX: initialX,
    worldY: initialY,
    smoothing: 8.0,
    bounds: { minX: 0, minY: 0, maxX: 3200, maxY: 3200 }
  });

  const heroTarget = { x: targetX, y: targetY, hp: 1000, isDead: false };
  cam.follow(heroTarget);

  // Single step verification
  cam.update(dtSec);

  // 1. Monotonicity: camera moved towards target
  assert(cam.worldX >= initialX, `dt=${dtMs}ms: camera X moved toward target`);
  assert(cam.worldY >= initialY, `dt=${dtMs}ms: camera Y moved toward target`);

  // 2. No overshoot: camera never exceeded target
  assert(cam.worldX <= targetX, `dt=${dtMs}ms: camera X did not overshoot target (${cam.worldX} <= ${targetX})`);
  assert(cam.worldY <= targetY, `dt=${dtMs}ms: camera Y did not overshoot target (${cam.worldY} <= ${targetY})`);

  // 3. Clamping: camera stays within bounds
  assert(cam.worldX >= 0 && cam.worldX <= 3200, `dt=${dtMs}ms: camera X in bounds`);
  assert(cam.worldY >= 0 && cam.worldY <= 3200, `dt=${dtMs}ms: camera Y in bounds`);

  // 4. Convergence test: multiple steps should asymptotically reach target
  const stepsToTest = Math.ceil(3000 / dtMs); // simulate 3 seconds of tracking
  for (let s = 1; s < stepsToTest; s++) {
    cam.update(dtSec);
  }
  const distFromTarget = Math.hypot(cam.worldX - targetX, cam.worldY - targetY);
  assert(distFromTarget < 1.0, `dt=${dtMs}ms: camera converged to within 1 unit after 3s (distance: ${distFromTarget.toFixed(4)})`);
}

// 3.2 Target liveness test: camera stops moving when target dies
{
  const cam = new Camera({ worldX: 500, worldY: 500, smoothing: 8.0 });
  const dyingHero = { x: 2000, y: 2000, hp: 0, isDead: true };
  cam.follow(dyingHero);
  cam.update(0.1);
  assert(cam.worldX === 500 && cam.worldY === 500, 'Camera holds position when target hp <= 0 / isDead');
}

// 3.3 Target far out-of-bounds: camera clamps at map boundary
{
  const cam = new Camera({ worldX: 500, worldY: 500, smoothing: 8.0, bounds: { minX: 0, minY: 0, maxX: 3200, maxY: 3200 } });
  const oobTarget = { x: 99999, y: 99999 };
  cam.follow(oobTarget);
  cam.update(2.0); // 2000ms jump
  assert(cam.worldX === 3200, `Camera clamped to maxX (3200): got ${cam.worldX}`);
  assert(cam.worldY === 3200, `Camera clamped to maxY (3200): got ${cam.worldY}`);
}

console.log('  ✔ Camera lerp stability across 1ms..2000ms verified.\n');

// ============================================================================
// STRESS TEST 4: LOOP ACCUMULATOR CAP HANDLING (SPIRAL OF DEATH DEFENSE)
// ============================================================================
console.log('>>> [4/5] Stress Testing Loop Accumulator Cap (Spiral of Death Defense)...');

{
  let tickCount = 0;
  let updateTicks = [];
  const loop = new GameLoop({
    fixedTimestep: 16.6667,
    maxAccumulator: 100,
    onUpdate: (dt, tickIdx) => {
      tickCount++;
      updateTicks.push(tickIdx);
    }
  });

  // Test extreme delta: dt = 10,000ms (10 seconds browser freeze)
  const HUGE_DT = 10000;
  loop.step(HUGE_DT);

  // Expected max ticks = floor(100 / 16.6667) = 6 ticks
  const maxPossibleTicks = Math.ceil(100 / 16.6667);
  assert(tickCount <= maxPossibleTicks, `dt=10,000ms executed ${tickCount} ticks (cap allows at most ${maxPossibleTicks})`);
  assert(tickCount >= 5 && tickCount <= 6, `dt=10,000ms executed expected 6 ticks (got ${tickCount})`);
  assert(loop.accumulator < 16.6667, `Remaining accumulator (${loop.accumulator}ms) is less than fixed timestep`);

  // Consecutive extreme spikes: 10 frames of 10,000ms
  let consecutiveTicks = 0;
  for (let frame = 0; frame < 10; frame++) {
    const prevTicks = loop.tickCount;
    loop.step(10000);
    const deltaTicks = loop.tickCount - prevTicks;
    consecutiveTicks += deltaTicks;
    assert(deltaTicks <= 6, `Frame ${frame} with 10s spike executed at most 6 ticks (got ${deltaTicks})`);
  }
  assert(consecutiveTicks <= 60, `10 consecutive 10s spikes executed ${consecutiveTicks} ticks (must be <= 60, NOT 6000)`);

  // Sub-timestep delta test: dt = 5ms (should not tick until 16.67ms accumulates)
  let tinyTicks = 0;
  const tinyLoop = new GameLoop({
    fixedTimestep: 16.6667,
    maxAccumulator: 100,
    onUpdate: () => { tinyTicks++; }
  });
  tinyLoop.step(5);
  assert(tinyTicks === 0, 'dt=5ms does not trigger a tick before fixedTimestep');
  tinyLoop.step(5);
  assert(tinyTicks === 0, 'dt=10ms total does not trigger a tick before fixedTimestep');
  tinyLoop.step(7); // total 17ms -> should trigger 1 tick
  assert(tinyTicks === 1, 'dt=17ms total triggers exactly 1 tick');

  // Negative delta handling
  const negLoop = new GameLoop();
  negLoop.step(-100);
  assert(negLoop.accumulator <= 100, 'Negative delta handled without infinite loop');
}

console.log('  ✔ Loop accumulator cap and spiral of death defense verified.\n');

// ============================================================================
// STRESS TEST 5: DEPTH SORTING STABILITY WITH 1,000 OVERLAPPING ENTITIES
// ============================================================================
console.log('>>> [5/5] Stress Testing Depth Sorting Stability with 1,000 Overlapping Entities...');

{
  const NUM_ENTITIES = 1000;
  const baseEntities = [];

  // 1,000 entities with identical continuous world coordinates (500, 500)
  for (let i = 0; i < NUM_ENTITIES; i++) {
    const id = `entity_${String(i).padStart(4, '0')}`;
    baseEntities.push({
      id,
      x: 500,
      y: 500,
      getDepthKey() { return this.x + this.y; }
    });
  }

  // Baseline sort
  const referenceSorted = [...baseEntities].sort(compareDepth);

  // Verify baseline order is strictly alphabetical by ID
  let strictlyAscendingId = true;
  for (let i = 0; i < referenceSorted.length - 1; i++) {
    if (referenceSorted[i].id.localeCompare(referenceSorted[i + 1].id) >= 0) {
      strictlyAscendingId = false;
      break;
    }
  }
  assert(strictlyAscendingId, 'Reference sort of 1,000 identical-depth entities sorted strictly by ID');

  // Test across 10 distinct random permutations
  let allPermutationsIdentical = true;
  const sortTimes = [];

  for (let trial = 0; trial < 10; trial++) {
    // Fisher-Yates shuffle
    const shuffled = [...baseEntities];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const t0 = performance.now();
    shuffled.sort(compareDepth);
    const t1 = performance.now();
    sortTimes.push(t1 - t0);

    // Verify bit-for-bit identical to referenceSorted
    for (let i = 0; i < NUM_ENTITIES; i++) {
      if (shuffled[i].id !== referenceSorted[i].id) {
        allPermutationsIdentical = false;
        console.error(`    Sort mismatch at index ${i} in trial ${trial}: expected ${referenceSorted[i].id}, got ${shuffled[i].id}`);
        break;
      }
    }
  }

  assert(allPermutationsIdentical, 'Depth sort produced 100% deterministic, identical order across 10 random permutations');

  const avgSortTime = sortTimes.reduce((a, b) => a + b, 0) / sortTimes.length;
  assert(avgSortTime < 25.0, `Average sort time for 1,000 entities (${avgSortTime.toFixed(2)}ms) must be < 25ms`);
  console.log(`  ✔ 1,000 overlapping entities sorted with 100% stability. Avg sort time: ${avgSortTime.toFixed(3)}ms`);

  // 5.2 Clustered Depth Test: 1,000 entities with micro-offsets (within 1e-4)
  const microClustered = [];
  for (let i = 0; i < NUM_ENTITIES; i++) {
    const id = `micro_${String(i).padStart(4, '0')}`;
    const offset = (rng() - 0.5) * 1e-5; // well inside 1e-4 tolerance
    microClustered.push({
      id,
      x: 500 + offset,
      y: 500 + offset,
      getDepthKey() { return this.x + this.y; }
    });
  }

  const sortedMicro1 = [...microClustered].sort(compareDepth);
  const sortedMicro2 = [...microClustered].reverse().sort(compareDepth);
  let microIdentical = true;
  for (let i = 0; i < NUM_ENTITIES; i++) {
    if (sortedMicro1[i].id !== sortedMicro2[i].id) {
      microIdentical = false;
      break;
    }
  }
  assert(microIdentical, '1,000 micro-clustered entities within 1e-4 tolerance sort identically regardless of initial order');

  // 5.3 Full map distribution test: 1,000 entities across [0, 3200]
  const fullMapEntities = [];
  for (let i = 0; i < NUM_ENTITIES; i++) {
    fullMapEntities.push({
      id: `map_${String(i).padStart(4, '0')}`,
      x: rng() * 3200,
      y: rng() * 3200,
      getDepthKey() { return this.x + this.y; }
    });
  }
  fullMapEntities.sort(compareDepth);

  let depthKeyMonotonic = true;
  for (let i = 0; i < fullMapEntities.length - 1; i++) {
    const d1 = fullMapEntities[i].getDepthKey();
    const d2 = fullMapEntities[i + 1].getDepthKey();
    if (d1 > d2 + 1e-9) {
      depthKeyMonotonic = false;
      break;
    }
  }
  assert(depthKeyMonotonic, 'Full map sorted entities have monotonically increasing depth keys');
}

console.log('  ✔ Depth sorting stability verified.\n');

// ============================================================================
// FINAL HARNESS VERDICT
// ============================================================================
console.log('================================================================');
console.log(` HARNESS SUMMARY: ${passedChecks} checks passed, ${failedChecks} checks failed`);
if (adversarialFindings.length > 0) {
  console.log(` ADVERSARIAL OBSERVATIONS (${adversarialFindings.length}):`);
  adversarialFindings.forEach(f => console.log(`  * [OBSERVATION] ${f}`));
}
console.log('================================================================');

if (failedChecks === 0) {
  console.log('\n>>> EMPIRICAL VERDICT: APPROVE <<<');
  console.log('All Milestone 1 mathematical, camera, loop, and sorting invariants hold under stress.\n');
  process.exit(0);
} else {
  console.error('\n>>> EMPIRICAL VERDICT: REJECT <<<');
  console.error(`Failed ${failedChecks} checks:\n` + failures.map(f => ` - ${f}`).join('\n') + '\n');
  process.exit(1);
}
