import { HeroEntity, Entity } from '../src/entities/entity.js';
import { calculateRespawnTime, HERO_DEFINITIONS, calculateHeroStatsAtLevel, getHeroKit } from '../src/entities/heroes.js';
import { GameSimulation } from '../src/game.js';
import { InputManager, InputDispatcher, CommandType } from '../src/core/input.js';

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;
const failureDetails = [];

function assert(condition, message, details = {}) {
  totalAssertions++;
  if (!condition) {
    failedAssertions++;
    const err = `FAIL: ${message} | Context: ${JSON.stringify(details)}`;
    failureDetails.push(err);
    console.error(`  ❌ ${err}`);
  } else {
    passedAssertions++;
  }
}

console.log('================================================================');
console.log('  M1 DEATH CHALLENGER 2: ADVERSARIAL FUZZING & TIMING HARNESS   ');
console.log('================================================================\n');

// =============================================================================
// TEST SUITE 1: Level Boundary Calculations & Math Robustness
// =============================================================================
console.log('>>> [1/4] Fuzzing Level Boundary Calculations (calculateRespawnTime)...');

// 1.1 Deterministic boundary checks
const deterministicCases = [
  { input: 0, expected: 5.0, desc: 'Level 0 -> clamped to level 1 (5.0s)' },
  { input: -5, expected: 5.0, desc: 'Level -5 -> clamped to level 1 (5.0s)' },
  { input: -100, expected: 5.0, desc: 'Level -100 -> clamped to level 1 (5.0s)' },
  { input: 1, expected: 5.0, desc: 'Level 1 -> 4 + 1 = 5.0s' },
  { input: 2, expected: 6.0, desc: 'Level 2 -> 4 + 2 = 6.0s' },
  { input: 6, expected: 10.0, desc: 'Level 6 -> 4 + 6 = 10.0s' },
  { input: 12, expected: 16.0, desc: 'Level 12 -> 4 + 12 = 16.0s' },
  { input: 18, expected: 22.0, desc: 'Level 18 -> 4 + 18 = 22.0s' },
  { input: 100, expected: 104.0, desc: 'Level 100 -> 4 + 100 = 104.0s' },
  { input: 2.5, expected: 6.0, desc: 'Level 2.5 (fractional) -> Math.floor(2.5)=2 -> 6.0s' },
  { input: 1.999, expected: 5.0, desc: 'Level 1.999 (fractional) -> Math.floor(1.999)=1 -> 5.0s' },
  { input: 0.1, expected: 5.0, desc: 'Level 0.1 -> Math.floor(0.1)=0 -> clamped to 1 -> 5.0s' },
  { input: NaN, expected: 5.0, desc: 'Level NaN -> clamped to 1 (5.0s)' },
  { input: undefined, expected: 5.0, desc: 'Level undefined -> default param 1 (5.0s)' },
  { input: null, expected: 5.0, desc: 'Level null -> clamped to 1 (5.0s)' },
  { input: '12', expected: 16.0, desc: 'Level "12" (string numeric) -> 16.0s' },
  { input: 'invalid', expected: 5.0, desc: 'Level "invalid" string -> clamped to 1 (5.0s)' },
  { input: {}, expected: 5.0, desc: 'Level {} object -> clamped to 1 (5.0s)' },
  { input: [], expected: 5.0, desc: 'Level [] array -> clamped to 1 (5.0s)' },
  { input: true, expected: 5.0, desc: 'Level true boolean -> 5.0s' },
  { input: false, expected: 5.0, desc: 'Level false boolean -> 5.0s' },
  { input: -0, expected: 5.0, desc: 'Level -0 -> clamped to 1 (5.0s)' },
  { input: -Infinity, expected: 5.0, desc: 'Level -Infinity -> clamped to 1 (5.0s)' }
];

for (const c of deterministicCases) {
  const result = calculateRespawnTime(c.input);
  assert(
    typeof result === 'number' && !Number.isNaN(result) && result === c.expected,
    `calculateRespawnTime: ${c.desc}`,
    { input: c.input, result, expected: c.expected }
  );
  assert(
    result >= 5.0,
    `calculateRespawnTime(${String(c.input)}) must be >= 5.0`,
    { result }
  );
}

// 1.2 Stochastic / Fuzzing inputs (10,000 pseudo-random numbers)
let fuzzFailures = 0;
for (let i = 0; i < 10000; i++) {
  // Generate wild values: negative, massive, fractional, subnormal
  const randLvl = (Math.random() - 0.5) * 2000;
  const res = calculateRespawnTime(randLvl);
  if (typeof res !== 'number' || Number.isNaN(res) || res < 5.0 || !Number.isFinite(res)) {
    fuzzFailures++;
  }
}
assert(fuzzFailures === 0, '10,000 random floating levels produce valid finite positive numbers >= 5.0', { fuzzFailures });

console.log(`  ✔ Suite 1 Complete: All boundary and fuzz cases passed.\n`);

// =============================================================================
// TEST SUITE 2: Simulation Tick Granularity & Monotonic Decay Fuzzing
// =============================================================================
console.log('>>> [2/4] Fuzzing Simulation Tick Granularity & Timer Monotonicity...');

const granularities = [
  { name: '1ms ticks (dt = 0.001)', dt: 0.001, expectedTicks: 5000 },
  { name: '60 FPS fixed (dt = 0.01667)', dt: 0.01667, expectedTicks: 300 },
  { name: '30 FPS fixed (dt = 0.03333)', dt: 0.03333, expectedTicks: 151 },
  { name: '10 FPS fixed (dt = 0.1)', dt: 0.1, expectedTicks: 50 },
  { name: '2 FPS fixed (dt = 0.5)', dt: 0.5, expectedTicks: 10 },
  { name: '1 FPS fixed (dt = 1.0)', dt: 1.0, expectedTicks: 5 },
  { name: 'Exact single step (dt = 5.0)', dt: 5.0, expectedTicks: 1 },
  { name: 'Overshoot in single step (dt = 10.0)', dt: 10.0, expectedTicks: 1 },
  { name: 'Massive overshoot (dt = 100.0)', dt: 100.0, expectedTicks: 1 }
];

for (const g of granularities) {
  const hero = new HeroEntity({
    heroId: 'knight',
    hp: 680,
    maxHp: 680,
    mana: 300,
    maxMana: 300,
    level: 1,
    x: 1800,
    y: 1800
  });

  hero.takeDamage(1000);
  assert(hero.isDead, `${g.name}: Hero transitions to dead state on lethal damage`);
  assert(hero.respawnTimer === 5.0, `${g.name}: Initial respawnTimer is 5.0s`);

  let prevTimer = hero.respawnTimer;
  let ticksRun = 0;
  let sawNegativeTimer = false;
  let sawTimerIncrease = false;
  let sawPositionDriftWhileDead = false;

  while (hero.isDead && ticksRun < 20000) {
    hero.update(g.dt);
    ticksRun++;

    if (hero.isDead) {
      if (hero.respawnTimer < 0) sawNegativeTimer = true;
      if (hero.respawnTimer > prevTimer) sawTimerIncrease = true;
      if (hero.x !== 1800 || hero.y !== 1800) sawPositionDriftWhileDead = true;
      prevTimer = hero.respawnTimer;
    }
  }

  assert(!sawNegativeTimer, `${g.name}: respawnTimer never underflowed below 0`);
  assert(!sawTimerIncrease, `${g.name}: respawnTimer was strictly monotonic decreasing`);
  assert(!sawPositionDriftWhileDead, `${g.name}: Hero position remained frozen during death`);
  assert(hero.isDead === false, `${g.name}: Hero successfully resurrected (isDead = false)`);
  assert(hero.isAlive() === true, `${g.name}: Hero isAlive() returns true after resurrection`);
  assert(hero.respawnTimer === 0, `${g.name}: respawnTimer is exactly 0 after resurrection`);
  assert(hero.x === 400 && hero.y === 400, `${g.name}: Hero teleported to Fountain (400, 400)`);
  assert(hero.hp === 680, `${g.name}: HP fully restored to maxHp (680)`);
  assert(hero.mana === 300, `${g.name}: Mana fully restored to maxMana (300)`);
}

// 2.2 Chaotic / Random Jitter dt Fuzzing (50 independent runs with jitter dt)
let jitterRunsPassed = 0;
for (let run = 0; run < 50; run++) {
  const hero = new HeroEntity({
    heroId: 'sorceress',
    hp: 480,
    maxHp: 480,
    level: 2, // 6.0 seconds respawn
    x: 2500,
    y: 2500
  });
  hero.takeDamage(1000);

  let prevT = hero.respawnTimer;
  let valid = true;
  let steps = 0;

  while (hero.isDead && steps < 10000) {
    // Random dt between 0.0005s and 0.45s
    const randomDt = 0.0005 + Math.random() * 0.45;
    hero.update(randomDt);
    steps++;

    if (hero.isDead) {
      if (hero.respawnTimer < 0 || hero.respawnTimer > prevT) {
        valid = false;
        break;
      }
      prevT = hero.respawnTimer;
    }
  }

  if (valid && hero.isAlive() && hero.x === 400 && hero.y === 400 && hero.hp === hero.maxHp && hero.respawnTimer === 0) {
    jitterRunsPassed++;
  }
}
assert(jitterRunsPassed === 50, '50 independent chaotic jitter dt runs all resurrect cleanly with zero defects', { jitterRunsPassed });

// 2.3 Edge values of dt: dt = 0, dt < 0, dt = NaN
{
  const hero = new HeroEntity({ heroId: 'ranger', hp: 520, maxHp: 520, level: 1 });
  hero.die();
  const initTimer = hero.respawnTimer;

  // dt = 0 should not change timer
  hero.update(0);
  assert(hero.respawnTimer === initTimer, 'update(dt = 0) does not alter respawnTimer');

  // dt = -1.0 increases timer because Math.max(0, timer - (-1)) = timer + 1
  hero.update(-1.0);
  assert(hero.respawnTimer >= initTimer, 'update(dt < 0) does not cause unexpected early resurrection');

  // dt = NaN: Adversarial edge case analysis
  // When dt = NaN, timer becomes NaN. On subsequent tick, (NaN || 0) - dt triggers immediate respawn.
  const nanHero = new HeroEntity({ heroId: 'ranger', hp: 520, maxHp: 520, level: 1 });
  nanHero.die();
  nanHero.update(NaN);
  const nanTimerBecomesNaN = Number.isNaN(nanHero.respawnTimer);
  assert(nanTimerBecomesNaN, 'ADVERSARIAL PROOF: update(dt = NaN) poisons respawnTimer to NaN');

  nanHero.update(0.01667);
  const resurrectedOnNextTick = nanHero.isAlive() && nanHero.respawnTimer === 0;
  assert(resurrectedOnNextTick, 'ADVERSARIAL PROOF: Next tick with poisoned NaN timer triggers instant premature resurrection');
}

console.log(`  ✔ Suite 2 Complete: Granularity and monotonic decay verified.\n`);

// =============================================================================
// TEST SUITE 3: 1,000 Command Bombardment During Death State
// =============================================================================
console.log('>>> [3/4] Bombarding Dead Hero with 1,000 Randomized Commands & Input Events...');

{
  const sim = new GameSimulation();
  const hero = sim.playerHero;
  hero.x = 1500;
  hero.y = 1500;
  hero.vx = 0;
  hero.vy = 0;
  hero.level = 6; // 10.0s respawn duration

  // Kill player hero
  hero.takeDamage(5000);
  assert(hero.isDead, 'Hero is dead before bombardment');
  assert(hero.respawnTimer === 10.0, 'Respawn timer initialized to 10.0s');

  const baselineState = {
    x: hero.x,
    y: hero.y,
    vx: hero.vx,
    vy: hero.vy,
    hp: hero.hp,
    targetX: hero.targetX,
    targetY: hero.targetY,
    attackTarget: hero.attackTarget,
    isMoving: hero.isMoving,
    isRecalling: hero.isRecalling,
    holdPosition: hero.holdPosition
  };

  const commandTypes = [
    CommandType.MOVE_TO,
    CommandType.ATTACK_TARGET,
    CommandType.CAST_ABILITY,
    CommandType.CAST_SKILL,
    CommandType.STOP,
    CommandType.RECALL,
    CommandType.CENTER_CAMERA,
    CommandType.SELECT,
    'UNKNOWN_CORRUPT_CMD'
  ];

  const skillSlots = ['Q', 'W', 'E', 'R', 'D', 'F', 'INVALID', null];

  let droppedCommands = 0;
  let stateCorruptions = 0;

  for (let i = 0; i < 1000; i++) {
    const chosenType = commandTypes[Math.floor(Math.random() * commandTypes.length)];
    const randX = (Math.random() - 0.2) * 4000;
    const randY = (Math.random() - 0.2) * 4000;
    const randSlot = skillSlots[Math.floor(Math.random() * skillSlots.length)];

    const cmd = {
      type: chosenType,
      x: randX,
      y: randY,
      targetX: randX,
      targetY: randY,
      slot: randSlot,
      skill: randSlot,
      targetId: 'min_enemy_1',
      attackMove: Math.random() < 0.5
    };

    try {
      sim.handleCommand(cmd);
      droppedCommands++;
    } catch (err) {
      stateCorruptions++;
    }

    // Verify invariant after each command
    if (
      hero.x !== baselineState.x ||
      hero.y !== baselineState.y ||
      hero.vx !== 0 ||
      hero.vy !== 0 ||
      hero.targetX !== null ||
      hero.targetY !== null ||
      hero.isMoving !== false ||
      hero.attackTarget !== null ||
      hero.isRecalling !== false ||
      hero.hp !== 0 ||
      hero.isDead !== true
    ) {
      stateCorruptions++;
    }
  }

  assert(droppedCommands === 1000, '1,000 commands dispatched to dead hero via handleCommand', { droppedCommands });
  assert(stateCorruptions === 0, 'Zero state corruptions or position shifts detected across 1,000 commands', { stateCorruptions });

  // 3.2 InputManager event bombardment while dead (200 events)
  const input = sim.input;
  input.playerHeroRef = hero;
  let inputCorruptions = 0;

  for (let i = 0; i < 200; i++) {
    const randScreenX = Math.random() * 1280;
    const randScreenY = Math.random() * 720;

    // Pointer down left/right
    input.handlePointerDown({ button: i % 2 === 0 ? 0 : 2, clientX: randScreenX, clientY: randScreenY });
    input.handlePointerMove({ clientX: randScreenX, clientY: randScreenY });
    input.handlePointerUp({ button: i % 2 === 0 ? 0 : 2 });

    // Key downs: Q, W, E, R, A, S, H, B
    const keys = ['KeyA', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyS', 'KeyH', 'KeyB', 'KeyP'];
    const chosenKey = keys[i % keys.length];
    input.handleKeyDown({ code: chosenKey, key: chosenKey.slice(-1).toLowerCase() });

    // Direct trigger
    input.triggerAbility('Q');
    input.confirmCast();
    input.dispatchSmartRightClick(hero);

    if (
      hero.x !== baselineState.x ||
      hero.y !== baselineState.y ||
      hero.targetX !== null ||
      hero.targetY !== null ||
      hero.isMoving !== false ||
      hero.isRecalling !== false ||
      hero.hp !== 0
    ) {
      inputCorruptions++;
    }
  }

  assert(inputCorruptions === 0, 'Zero state corruptions across 200 InputManager mouse/key events while dead', { inputCorruptions });

  // 3.3 Direct entity method attack while dead
  hero.moveTo(3000, 3000);
  assert(hero.targetX === null && hero.targetY === null && !hero.isMoving, 'hero.moveTo() rejected while dead');

  hero.setAttackTarget({ id: 'dummy', isAlive: () => true });
  assert(hero.attackTarget === null, 'hero.setAttackTarget() rejected while dead');

  assert(hero.canMove() === false, 'hero.canMove() returns false while dead');
  assert(hero.canAttack() === false, 'hero.canAttack() returns false while dead');
  assert(hero.canCast() === false, 'hero.canCast() returns false while dead');

  const damageTaken = hero.takeDamage(500);
  assert(damageTaken === 0, 'hero.takeDamage() returns 0 and does not re-damage dead hero');

  const healed = hero.heal(500);
  assert(healed === 0 && hero.hp === 0, 'hero.heal() returns 0 and cannot revive dead hero');
}

console.log(`  ✔ Suite 3 Complete: 100% rejection rate with zero state drift.\n`);

// =============================================================================
// TEST SUITE 4: Concurrency, Overkill & Complete Status Cleanse
// =============================================================================
console.log('>>> [4/4] Testing Overkill, Recall Interruption & Crowd Control Cleanse...');

// 4.1 Multiple lethal hits in rapid succession (Overkill / Double-Die prevention)
{
  const hero = new HeroEntity({ heroId: 'knight', hp: 100, maxHp: 680, level: 3 });
  hero.takeDamage(200); // Fatal hit 1
  assert(hero.isDead, 'Fatal hit 1 kills hero');
  assert(hero.respawnTimer === 7.0, 'Respawn timer initialized to 7.0s (level 3: 4 + 3)');

  // Advance 2.0s
  hero.update(2.0);
  assert(hero.respawnTimer === 5.0, 'Respawn timer decremented to 5.0s');

  // Hit 2 dealt post-mortem
  const hit2Dealt = hero.takeDamage(9999);
  assert(hit2Dealt === 0, 'Post-mortem lethal hit dealt 0 damage');
  assert(hero.respawnTimer === 5.0, 'Post-mortem lethal hit did NOT reset respawn timer');
}

// 4.2 Recall channel interrupted by lethal damage
{
  const hero = new HeroEntity({ heroId: 'ranger', hp: 100, maxHp: 520, level: 1, x: 2000, y: 2000 });
  hero.isRecalling = true;
  hero.recallElapsed = 4900; // 100ms from completing recall!

  hero.takeDamage(500); // Fatal damage!
  assert(hero.isDead, 'Hero is dead');
  assert(hero.isRecalling === false, 'isRecalling cleared to false upon death');
  assert(hero.recallElapsed === 0, 'recallElapsed reset to 0 upon death');

  // Advance time by 0.5s (which would have completed recall if not interrupted)
  hero.update(0.5);
  assert(hero.x === 2000 && hero.y === 2000, 'Hero did NOT teleport via completed recall while dead');
  assert(hero.isDead === true, 'Hero is still dead');
}

// 4.3 Cleanse of all Crowd Control upon resurrection
{
  const hero = new HeroEntity({ heroId: 'assassin', hp: 540, maxHp: 540, level: 1 });
  hero.die();

  // Infect with massive debuffs
  const farFuture = Date.now() + 1000000;
  hero.stunnedUntil = farFuture;
  hero.silencedUntil = farFuture;
  hero.rootedUntil = farFuture;
  hero.tauntedUntil = farFuture;
  hero.tauntTargetId = 'enemy_boss';
  hero.slowedUntil = farFuture;
  hero.slowPercentage = 0.8;
  hero.stealthedUntil = farFuture;
  hero.holdPosition = true;
  hero.attackCooldown = 5.0;

  // Run full respawn time (5.0s)
  hero.update(5.0);

  assert(hero.isAlive(), 'Hero resurrected');
  assert(hero.stunnedUntil === 0, 'stunnedUntil cleansed to 0');
  assert(hero.silencedUntil === 0, 'silencedUntil cleansed to 0');
  assert(hero.rootedUntil === 0, 'rootedUntil cleansed to 0');
  assert(hero.tauntedUntil === 0, 'tauntedUntil cleansed to 0');
  assert(hero.tauntTargetId === null, 'tauntTargetId cleansed to null');
  assert(hero.slowedUntil === 0, 'slowedUntil cleansed to 0');
  assert(hero.slowPercentage === 0, 'slowPercentage cleansed to 0');
  assert(hero.stealthedUntil === 0, 'stealthedUntil cleansed to 0');
  assert(hero.holdPosition === false, 'holdPosition reset to false');
  assert(hero.attackCooldown === 0, 'attackCooldown reset to 0');
  assert(hero.canMove(), 'canMove() returns true immediately after cleanse');
  assert(hero.canAttack(), 'canAttack() returns true immediately after cleanse');
  assert(hero.canCast(), 'canCast() returns true immediately after cleanse');
}

// 4.4 Retention in simulation array across 100 simulation ticks
{
  const sim = new GameSimulation();
  const hero = sim.playerHero;
  hero.takeDamage(10000);
  assert(hero.isDead, 'Player hero killed in simulation');

  for (let tick = 0; tick < 100; tick++) {
    sim.update(0.01667);
  }

  const retained = sim.entities.some(e => e.id === hero.id);
  assert(retained, 'Dead hero entity is retained in sim.entities array across 100 ticks of simulation loop');
}

console.log(`  ✔ Suite 4 Complete: Concurrency, overkill & CC cleanse verified.\n`);

// =============================================================================
// SUMMARY
// =============================================================================
console.log('================================================================');
console.log('                      HARNESS SUMMARY                           ');
console.log('================================================================');
console.log(`Total Assertions Checked: ${totalAssertions}`);
console.log(`Passed:                   ${passedAssertions}`);
console.log(`Failed:                   ${failedAssertions}`);

if (failedAssertions > 0) {
  console.log('\n❌ EMPIRICAL HARNESS FAILED WITH FAILURES:');
  for (const f of failureDetails) {
    console.error(`  - ${f}`);
  }
  process.exit(1);
} else {
  console.log('\n✔ ALL EMPIRICAL FUZZING HARNESS TESTS PASSED WITH 100% SUCCESS!');
  process.exit(0);
}
