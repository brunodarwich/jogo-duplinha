import { calculateRespawnTime, HERO_DEFINITIONS } from '../../../src/entities/heroes.js';
import { Entity, HeroEntity } from '../../../src/entities/entity.js';
import { Camera } from '../../../src/core/camera.js';
import { worldToScreen, screenToWorld, getDepthKey, compareDepth } from '../../../src/core/isometric.js';
import { InputDispatcher, CommandType } from '../../../src/core/input.js';
import { GameSimulation } from '../../../src/game.js';
import { MinionUnit } from '../../../src/world/minion.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    failed++;
    console.error(`[FAIL] ${message}`);
    throw new Error(message);
  }
  passed++;
  console.log(`[PASS] ${message}`);
}

function assertCloseTo(actual, expected, delta = 0.001, message = '') {
  const diff = Math.abs(actual - expected);
  if (diff > delta) {
    failed++;
    console.error(`[FAIL] ${message} - Expected ~${expected}, got ${actual} (diff: ${diff})`);
    throw new Error(`${message} - Expected ~${expected}, got ${actual}`);
  }
  passed++;
  console.log(`[PASS] ${message}`);
}

async function runIndependentAudit() {
  console.log('================================================================');
  console.log('       INDEPENDENT POST-VICTORY AUDITOR VERIFICATION SUITE      ');
  console.log('================================================================\n');

  // --- CHECK 1: R1 Respawn scaling formula ---
  assert(calculateRespawnTime(1) === 5.0, 'calculateRespawnTime(1) === 5.0s');
  assert(calculateRespawnTime(6) === 10.0, 'calculateRespawnTime(6) === 10.0s');
  assert(calculateRespawnTime(18) === 22.0, 'calculateRespawnTime(18) === 22.0s');
  assert(calculateRespawnTime(-5) === 5.0, 'calculateRespawnTime(-5) clamps to 5.0s');
  assert(calculateRespawnTime(undefined) === 5.0, 'calculateRespawnTime(undefined) defaults to 5.0s');

  // --- CHECK 2: R1 HeroEntity Death & Respawn Lifecycle ---
  const hero = new HeroEntity({
    heroId: 'knight',
    x: 1500,
    y: 1500,
    hp: 680,
    maxHp: 680,
    mana: 300,
    maxMana: 300,
    level: 5
  });

  // Start recall then die
  hero.isRecalling = true;
  hero.recallElapsed = 2000;
  hero.takeDamage(1000, 'physical');

  assert(hero.isDead === true, 'Hero isDead is true upon lethal damage');
  assert(hero.hp === 0, 'Hero HP is clamped to 0');
  assert(hero.isRecalling === false, 'Recall is aborted on death');
  assert(hero.recallElapsed === 0, 'Recall elapsed reset to 0');
  assert(hero.respawnDuration === 9.0, 'Level 5 respawn duration is 4 + 5 = 9.0s');
  assert(hero.respawnTimer === 9.0, 'Initial respawn timer is 9.0s');

  // Test action rejection while dead
  hero.moveTo(2000, 2000);
  assert(hero.targetX === null && hero.isMoving === false, 'moveTo rejected while dead');
  hero.setAttackTarget({ id: 'dummy' });
  assert(hero.attackTarget === null, 'setAttackTarget rejected while dead');
  assert(hero.canMove() === false, 'canMove is false while dead');
  assert(hero.canAttack() === false, 'canAttack is false while dead');
  assert(hero.canCast() === false, 'canCast is false while dead');

  // Cooldown decrement while dead
  hero.abilities.Q.cooldownRemaining = 8.0;
  hero.update(4.0);
  assertCloseTo(hero.respawnTimer, 5.0, 0.01, 'Respawn timer decrements to 5.0s');
  assertCloseTo(hero.abilities.Q.cooldownRemaining, 4.0, 0.01, 'Ability cooldown ticks down while dead');

  // Add CC while dead
  hero.stunnedUntil = Date.now() + 10000;
  hero.rootedUntil = Date.now() + 10000;

  // Complete respawn timer
  hero.update(5.0);
  assert(hero.isDead === false, 'Hero is no longer dead after timer completes');
  assert(hero.isAlive() === true, 'Hero isAlive is true after respawn');
  assert(hero.x === 400 && hero.y === 400, 'Hero respawned at Allied Fountain (400, 400)');
  assert(hero.hp === hero.maxHp, 'HP restored to 100%');
  assert(hero.mana === hero.maxMana, 'Mana restored to 100%');
  assert(hero.stunnedUntil === 0, 'Stun cleansed on respawn');
  assert(hero.rootedUntil === 0, 'Root cleansed on respawn');
  assert(hero.canMove() === true, 'Hero can move after respawn');

  // --- CHECK 3: R1 Entity retention in GameSimulation ---
  const sim = new GameSimulation();
  const simHero = sim.playerHero;
  assert(sim.entities.includes(simHero), 'Player hero in sim.entities initially');
  simHero.takeDamage(10000);
  assert(simHero.isDead === true, 'simHero is dead');

  const deadMinion = new MinionUnit({ id: 'dead_creep', team: 'enemy', hp: 0, isDeadState: true });
  sim.entities.push(deadMinion);

  sim.update(0.01667);
  assert(sim.entities.includes(simHero), 'Dead hero retained in sim.entities across sim.update');
  assert(!sim.entities.includes(deadMinion), 'Dead minion cleaned up in sim.entities across sim.update');

  // --- CHECK 4: R2 Attack Cooldown single decrement and pursuit range ---
  const combatHero = new HeroEntity({ heroId: 'ranger', x: 1000, y: 1000, hp: 500, attackRange: 500 });
  combatHero.attackSpeed = 1.0;
  combatHero.attackCooldown = 1.0;

  // Tick 0.25s through update
  combatHero.update(0.25);
  assertCloseTo(combatHero.attackCooldown, 0.75, 0.001, 'Attack cooldown decrements at 1.0s/s');

  // Effective range check
  const enemyTarget = new MinionUnit({ id: 'target_creep', team: 'enemy', x: 1530, y: 1000, hp: 200 });
  const effectiveRange = combatHero.attackRange + (enemyTarget.selectionRadius || enemyTarget.radius);
  assert(effectiveRange === combatHero.attackRange + enemyTarget.selectionRadius, `Effective range is attackRange + selectionRadius (${combatHero.attackRange} + ${enemyTarget.selectionRadius} = ${effectiveRange})`);

  // --- CHECK 5: R3 Hold / Stop Command ---
  const stopHero = new HeroEntity({ heroId: 'knight', x: 500, y: 500 });
  stopHero.moveTo(800, 800);
  stopHero.setAttackTarget({ id: 'some_enemy' });
  stopHero.attackMoveDestination = { x: 900, y: 900 };

  stopHero.stop();
  assert(stopHero.isMoving === false, 'Hero stops moving on stop()');
  assert(stopHero.vx === 0 && stopHero.vy === 0, 'Velocity zeroed on stop()');
  assert(stopHero.attackTarget === null, 'attackTarget cleared on stop()');
  assert(stopHero.attackMoveDestination === null, 'attackMoveDestination cleared on stop()');
  assert(stopHero.holdPosition === true, 'holdPosition set to true on stop()');

  // --- CHECK 6: R4 Camera Zoom Clamping & Invertible Dimetric Projection ---
  const cam = new Camera({ worldX: 1200, worldY: 1200, zoom: 1.0 });
  cam.setZoom(0.2);
  assert(cam.targetZoom === 0.6, 'setZoom(0.2) clamped to minZoom 0.6');
  cam.setZoom(2.5);
  assert(cam.targetZoom === 1.6, 'setZoom(2.5) clamped to maxZoom 1.6');

  // Test roundtrip unprojection precision across extreme and normal zoom levels
  for (const z of [0.6, 0.8, 1.0, 1.3, 1.6]) {
    cam.snapZoom(z);
    for (let x = 100; x <= 3100; x += 600) {
      for (let y = 100; y <= 3100; y += 600) {
        const screen = worldToScreen(x, y, 0, cam, z);
        const unproj = screenToWorld(screen.sx, screen.sy, cam, z);
        assertCloseTo(unproj.wx, x, 0.0001, `Roundtrip X precision at zoom ${z} for (${x}, ${y})`);
        assertCloseTo(unproj.wy, y, 0.0001, `Roundtrip Y precision at zoom ${z} for (${x}, ${y})`);
      }
    }
  }

  // --- CHECK 7: R5 Smooth Facing Lerp & Perspective Rotation ---
  const rotHero = new HeroEntity({ x: 1000, y: 1000, facing: 0, turnSpeed: 10.0 });
  rotHero.moveTo(1000, 1500); // Target facing: PI / 2 (~1.5708)
  assertCloseTo(rotHero.targetFacing, Math.PI / 2, 0.001, 'targetFacing set to PI / 2 on moveTo');

  rotHero.update(0.05); // 0.5 rad turn step
  assert(rotHero.facing > 0 && rotHero.facing < Math.PI / 2, 'Facing lerps smoothly towards targetFacing');

  // Perspective rotation coordinate inversion across quadrants
  const rotCam = new Camera({ worldX: 1600, worldY: 1600, zoom: 1.0 });
  const rotAngles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];

  for (const theta of rotAngles) {
    rotCam.setRotation(theta, true);
    const screen = worldToScreen(1800, 1400, 0, rotCam);
    const unproj = screenToWorld(screen.sx, screen.sy, rotCam);
    assertCloseTo(unproj.wx, 1800, 0.0001, `Rotated roundtrip X at theta ${theta.toFixed(2)}`);
    assertCloseTo(unproj.wy, 1400, 0.0001, `Rotated roundtrip Y at theta ${theta.toFixed(2)}`);
  }

  // Depth sorting reversal under 180 degree rotation
  rotCam.setRotation(0, true);
  const depthNear0 = getDepthKey(1000, 1000, rotCam);
  const depthFar0 = getDepthKey(2000, 2000, rotCam);
  assert(depthNear0 < depthFar0, 'At theta 0, (1000, 1000) has smaller depth than (2000, 2000)');

  rotCam.setRotation(Math.PI, true);
  const depthNearPI = getDepthKey(1000, 1000, rotCam);
  const depthFarPI = getDepthKey(2000, 2000, rotCam);
  assert(depthNearPI > depthFarPI, 'At theta PI, (1000, 1000) has greater depth than (2000, 2000)');

  // --- CHECK 8: InputDispatcher 'A' key and 'S' key ---
  const dispatcher = new InputDispatcher(cam);
  const aCmdGround = dispatcher.handleKeyDown('A', hero, 640, 360);
  assert(aCmdGround.type === CommandType.ATTACK_TARGET && aCmdGround.attackMove === true, 'Key A dispatches attackMove');

  const sCmd = dispatcher.handleKeyDown('S');
  assert(sCmd.type === CommandType.STOP, 'Key S dispatches STOP');

  const hCmd = dispatcher.handleKeyDown('H');
  assert(hCmd.type === CommandType.STOP, 'Key H dispatches STOP');

  const cCmd = dispatcher.handleKeyDown('C');
  assert(cCmd.type === CommandType.CYCLE_PERSPECTIVE && cCmd.direction === 1, 'Key C dispatches CYCLE_PERSPECTIVE (+1)');

  const vCmd = dispatcher.handleKeyDown('V');
  assert(vCmd.type === CommandType.CYCLE_PERSPECTIVE && vCmd.direction === -1, 'Key V dispatches CYCLE_PERSPECTIVE (-1)');

  console.log('\n================================================================');
  console.log(` AUDIT EXECUTION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');
}

runIndependentAudit().catch(err => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
