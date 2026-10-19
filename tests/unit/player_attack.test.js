import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue, assertFalse } from '../helpers/assert.js';
import { GameSimulation } from '../../src/game.js';
import { MinionUnit } from '../../src/world/minion.js';
import { CommandType, InputDispatcher } from '../../src/core/input.js';
import { worldToScreen, screenToWorld } from '../../src/core/isometric.js';

describe('Tier 1 Unit: Player Hero Basic Attack & Combat Engine', () => {
  it('TC-ATK-01: Melee hero basic attack damages enemy in range and incurs attack cooldown', () => {
    const sim = new GameSimulation({ heroClass: 'knight' });
    const hero = sim.playerHero;
    hero.x = 1000;
    hero.y = 1000;

    // Create an enemy minion right in front of the knight (within 130 range)
    const enemyMinion = new MinionUnit({
      id: 'target_minion_1',
      team: 'enemy',
      x: 1050,
      y: 1000,
      hp: 200,
      maxHp: 200
    });
    sim.entities.push(enemyMinion);

    // Command hero to attack target
    sim.handleCommand({
      type: CommandType.ATTACK_TARGET,
      targetEntity: enemyMinion,
      targetId: enemyMinion.id
    });

    assertEqual(hero.attackTarget?.id, 'target_minion_1');

    // Run simulation tick (dt = 0.05s)
    sim.update(0.05);

    // Enemy should have taken damage
    assertTrue(enemyMinion.hp < 200, 'Enemy minion should have taken damage from melee attack');
    assertTrue(hero.attackCooldown > 0, 'Attack cooldown should be ticking');
  });

  it('TC-ATK-02: Hero pursues moving enemy when out of range until effective range is reached', () => {
    const sim = new GameSimulation({ heroClass: 'knight' });
    const hero = sim.playerHero;
    hero.x = 1000;
    hero.y = 1000;

    // Place enemy far away (300 units)
    const enemyMinion = new MinionUnit({
      id: 'target_minion_far',
      team: 'enemy',
      x: 1300,
      y: 1000,
      hp: 200
    });
    sim.entities.push(enemyMinion);

    sim.handleCommand({
      type: CommandType.ATTACK_TARGET,
      targetEntity: enemyMinion,
      targetId: enemyMinion.id
    });

    const initialDistance = Math.hypot(enemyMinion.x - hero.x, enemyMinion.y - hero.y);

    // Run simulation ticks for 0.4s
    for (let i = 0; i < 8; i++) {
      sim.update(0.05);
    }

    const newDistance = Math.hypot(enemyMinion.x - hero.x, enemyMinion.y - hero.y);
    assertTrue(newDistance < initialDistance, 'Hero should have moved closer to enemy target');
    assertTrue(hero.isMoving, 'Hero should be in moving state while pursuing');
  });

  it('TC-ATK-03: Slaying enemy minion with basic attack grants full gold bounty and clears target', () => {
    const sim = new GameSimulation({ heroClass: 'knight' });
    const hero = sim.playerHero;
    hero.x = 1000;
    hero.y = 1000;
    const initialGold = hero.gold;

    // Enemy minion with low HP (10 HP)
    const enemyMinion = new MinionUnit({
      id: 'target_minion_low_hp',
      team: 'enemy',
      subType: 'melee',
      x: 1050,
      y: 1000,
      hp: 10,
      maxHp: 200
    });
    sim.entities.push(enemyMinion);

    sim.handleCommand({
      type: CommandType.ATTACK_TARGET,
      targetEntity: enemyMinion,
      targetId: enemyMinion.id
    });

    sim.update(0.05);

    assertTrue(enemyMinion.hp <= 0 || enemyMinion.isDead, 'Minion should be slain');
    assertTrue(hero.gold >= initialGold + 21, 'Hero should have received melee minion bounty (21g)');
    assertEqual(hero.attackTarget, null, 'Attack target should be cleared upon death');
  });

  it('TC-ATK-04: Ranged hero (Ranger) basic attack spawns projectile that travels and hits target', () => {
    const sim = new GameSimulation({ heroClass: 'ranger' });
    const hero = sim.playerHero;
    hero.x = 1000;
    hero.y = 1000;

    // Place enemy at 350 range (within ranger range 520)
    const enemyMinion = new MinionUnit({
      id: 'target_ranged_test',
      team: 'enemy',
      x: 1350,
      y: 1000,
      hp: 250,
      maxHp: 250
    });
    sim.entities.push(enemyMinion);

    sim.handleCommand({
      type: CommandType.ATTACK_TARGET,
      targetEntity: enemyMinion,
      targetId: enemyMinion.id
    });

    // 1st tick: hero fires projectile
    sim.update(0.05);
    assertTrue(sim.heroProjectiles.length > 0, 'Hero projectile should have spawned');
    assertEqual(sim.heroProjectiles[0].target.id, 'target_ranged_test');

    // Run ticks until projectile reaches target (speed is 750, dist is ~350, takes ~0.5s)
    for (let i = 0; i < 15; i++) {
      sim.update(0.05);
    }

    assertTrue(enemyMinion.hp < 250, 'Enemy minion should take damage after projectile impact');
  });

  it('TC-ATK-05: Lifesteal on basic attack restores hero health', () => {
    const sim = new GameSimulation({ heroClass: 'knight' });
    const hero = sim.playerHero;
    hero.x = 1000;
    hero.y = 1000;
    hero.hp = 300; // Damaged hero
    hero.lifesteal = 0.20; // 20% lifesteal

    const enemyMinion = new MinionUnit({
      id: 'target_lifesteal',
      team: 'enemy',
      x: 1050,
      y: 1000,
      hp: 500,
      maxHp: 500
    });
    sim.entities.push(enemyMinion);

    sim.handleCommand({
      type: CommandType.ATTACK_TARGET,
      targetEntity: enemyMinion,
      targetId: enemyMinion.id
    });

    sim.update(0.05);

    assertTrue(hero.hp > 300, 'Hero should be healed by lifesteal');
  });

  it('TC-ATK-06: Idle hero automatically acquires and attacks nearby enemy within range', () => {
    const sim = new GameSimulation({ heroClass: 'knight' });
    const hero = sim.playerHero;
    hero.x = 1000;
    hero.y = 1000;
    hero.stop();
    hero.holdPosition = false;

    const nearbyEnemy = new MinionUnit({
      id: 'auto_enemy',
      team: 'enemy',
      x: 1080,
      y: 1000,
      hp: 200
    });
    sim.entities.push(nearbyEnemy);

    sim.update(0.05);

    assertEqual(hero.attackTarget?.id, 'auto_enemy', 'Hero should auto-acquire nearby enemy');
    assertTrue(nearbyEnemy.hp < 200, 'Enemy should be attacked automatically');
  });

  it('TC-ATK-07: STOP command (S/H) halts hero and prevents idle auto-attack', () => {
    const sim = new GameSimulation({ heroClass: 'knight' });
    const hero = sim.playerHero;
    hero.x = 1000;
    hero.y = 1000;

    const nearbyEnemy = new MinionUnit({
      id: 'ignored_enemy',
      team: 'enemy',
      x: 1080,
      y: 1000,
      hp: 200
    });
    sim.entities.push(nearbyEnemy);

    // Issue STOP command
    sim.handleCommand({ type: CommandType.STOP });

    assertTrue(hero.holdPosition, 'holdPosition must be true');
    assertEqual(hero.attackTarget, null, 'attackTarget must be null');

    sim.update(0.05);

    assertEqual(hero.attackTarget, null, 'Held hero must not auto-attack');
    assertEqual(nearbyEnemy.hp, 200, 'Enemy must remain undamaged');
  });

  it('TC-ATK-08: Attack-move (attackMove: true) moves and engages enemies along the path', () => {
    const sim = new GameSimulation({ heroClass: 'knight' });
    const hero = sim.playerHero;
    hero.x = 500;
    hero.y = 500;

    const ambushMinion = new MinionUnit({
      id: 'ambush_minion',
      team: 'enemy',
      x: 600,
      y: 500,
      hp: 150
    });
    sim.entities.push(ambushMinion);

    // Attack-move towards 1500, 500
    sim.handleCommand({
      type: CommandType.ATTACK_TARGET,
      targetId: null,
      targetX: 1500,
      targetY: 500,
      attackMove: true
    });

    assertTrue(hero.attackMoveDestination !== null, 'Attack move destination should be recorded');

    // Run simulation ticks
    sim.update(0.05);

    assertEqual(hero.attackTarget?.id, 'ambush_minion', 'Hero should engage enemy found along the path');
  });

  it('TC-ATK-09: /plan and /boost commands execute cleanly without error', () => {
    const sim = new GameSimulation({ heroClass: 'knight' });
    const hero = sim.playerHero;

    // Boost command
    sim.handleCommand({ type: '/boost' });
    assertTrue(hero.speed > 325);
    assertTrue(hero.attackDamage > 58);
    assertTrue(hero.attackSpeed > 0.65);
    assertTrue(hero.armor > 38);

    // Plan command
    sim.handleCommand({ type: '/plan' });
    sim.handleCommand({ type: 'PLAN' });
    assertTrue(true, '/plan executed smoothly');
  });

  it('TC-ATK-10: 2.5D screen/sprite picking detects click on elevated body of minion', () => {
    const sim = new GameSimulation({ heroClass: 'knight' });
    const input = sim.input;

    const minion = new MinionUnit({
      id: 'elevated_minion',
      team: 'enemy',
      x: 1000,
      y: 1000,
      hp: 200,
      height: 26,
      radius: 14,
      selectionRadius: 24
    });

    // In isometric projection with camera looking at (650, 650):
    // Calculate the screen coords for minion's base
    const vp = { width: 1280, height: 720 };
    const screenBase = worldToScreen(1000, 1000, 0, input.camera, input.camera.zoom, vp);

    // Set cursor 15 pixels UP on screen (clicking the torso of the minion sprite)
    input.screenX = screenBase.sx;
    input.screenY = screenBase.sy - 15;
    const world = screenToWorld(input.screenX, input.screenY, input.camera, input.camera.zoom, vp);
    input.worldX = world.wx;
    input.worldY = world.wy;

    // Call pickEntity with the minion
    const picked = input.pickEntity([minion], sim.playerHero);
    assertTrue(picked !== null, 'Clicking elevated 2.5D sprite should successfully pick minion');
    assertEqual(picked.id, 'elevated_minion');
  });

  it('TC-ATK-11: Left-click (button 0) on hostile entity dispatches ATTACK_TARGET command', () => {
    const sim = new GameSimulation({ heroClass: 'knight' });
    const input = sim.input;

    const hostileMinion = new MinionUnit({
      id: 'hostile_target',
      team: 'enemy',
      x: 1000,
      y: 1000,
      hp: 200
    });
    input.entityManager = [hostileMinion];
    const vp = { width: 1280, height: 720 };
    const screenPos = worldToScreen(1000, 1000, 0, input.camera, input.camera.zoom, vp);

    let dispatchedCmd = null;
    input.onCommand((cmd) => { dispatchedCmd = cmd; });

    // Left-click (button 0) at entity's screen position
    input.handlePointerDown({ clientX: screenPos.sx, clientY: screenPos.sy, button: 0 });

    assertTrue(dispatchedCmd !== null, 'Left-click should dispatch a command');
    assertEqual(dispatchedCmd.type, CommandType.ATTACK_TARGET);
    assertEqual(dispatchedCmd.targetId, 'hostile_target');
  });

  it('TC-ATK-12: Silenced hero or unit can still perform basic attacks', () => {
    const sim = new GameSimulation({ heroClass: 'knight' });
    const hero = sim.playerHero;
    const now = Date.now();

    // Hero is silenced for 5 seconds
    hero.silencedUntil = now + 5000;

    // canAttack must remain TRUE (silence only prevents abilities)
    assertTrue(hero.canAttack(), 'Silenced hero must still be able to basic attack');
    assertFalse(hero.canCast(), 'Silenced hero must not be able to cast abilities');
  });

  it('TC-ATK-13: Taunted entity can still move to engage the taunter', () => {
    const sim = new GameSimulation({ heroClass: 'knight' });
    const hero = sim.playerHero;
    const now = Date.now();

    // Hero is taunted for 2 seconds
    hero.tauntedUntil = now + 2000;

    // canMove must remain TRUE so entity can walk towards target
    assertTrue(hero.canMove(), 'Taunted entity must be able to move to engage');
  });

  it('TC-ATK-14: Basic attack hit does not apply double damage', () => {
    const sim = new GameSimulation({ heroClass: 'knight' });
    const hero = sim.playerHero;
    hero.attackDamage = 50;

    const targetMinion = new MinionUnit({
      id: 'single_hit_minion',
      team: 'enemy',
      x: 1000,
      y: 1000,
      hp: 500
    });
    targetMinion.armor = 0; // 0 armor = 50 damage exactly

    sim.applyHeroHit(hero, targetMinion, 50, 'physical', false, 0);

    // Target HP should be exactly 500 - 50 = 450 (NOT 400 from double damage!)
    assertEqual(targetMinion.hp, 450, 'Damage must be applied exactly once, not twice');
  });

  it('TC-ATK-15: Basic attack damage absorbs from barrier before reducing health', () => {
    const sim = new GameSimulation({ heroClass: 'knight' });
    const hero = sim.playerHero;

    const shieldedTarget = new MinionUnit({
      id: 'shielded_target',
      team: 'enemy',
      x: 1000,
      y: 1000,
      hp: 300
    });
    shieldedTarget.armor = 0;
    shieldedTarget.barrier = 40; // 40 barrier

    sim.applyHeroHit(hero, shieldedTarget, 50, 'physical', false, 0);

    // 40 barrier absorbs 40 damage, remaining 10 damage hits HP: 300 - 10 = 290 HP
    assertEqual(shieldedTarget.barrier, 0, 'Barrier should be completely depleted');
    assertEqual(shieldedTarget.hp, 290, 'Remaining damage should subtract from HP');
  });

  it('TC-ATK-16: Hero spells successfully damage neutral monsters and creeps', () => {
    const sim = new GameSimulation({ heroClass: 'sorceress' });

    const neutralGolem = new MinionUnit({
      id: 'neutral_golem',
      team: 'neutral',
      x: 1000,
      y: 1000,
      hp: 500
    });
    sim.entities.push(neutralGolem);

    // Sorceress casts Fireball AoE at (1000, 1000)
    sim.damageEnemiesInRadius(1000, 1000, 100, 120, 'magical');

    assertTrue(neutralGolem.hp < 500, 'Neutral unit should take damage from AoE spell');
  });

  it('TC-ATK-17: findNearestEnemy ignores invulnerable structures and prioritizes units', () => {
    const sim = new GameSimulation({ heroClass: 'knight' });

    // Invulnerable inner tower at dist = 50
    const invulnerableTower = {
      id: 'inner_tower',
      team: 'enemy',
      type: 'tower',
      x: 1050,
      y: 1000,
      hp: 2500,
      isAlive: () => true,
      isInvulnerable: () => true
    };

    // Vulnerable minion at dist = 100
    const minion = new MinionUnit({
      id: 'priority_minion',
      team: 'enemy',
      x: 1100,
      y: 1000,
      hp: 200
    });

    sim.entities.push(invulnerableTower, minion);

    const target = sim.findNearestEnemy(1000, 1000, 200, 'allied');
    assertEqual(target?.id, 'priority_minion', 'Must ignore invulnerable tower and acquire minion');
  });

  it('TC-ATK-18: Ranged hero stops at attack range boundary and attacks from afar without entering melee', () => {
    const sim = new GameSimulation({ heroClass: 'ranger' }); // Ranger attackRange = 520
    const hero = sim.playerHero;
    hero.x = 1400;
    hero.y = 1400;

    // Enemy minion placed along diagonal lane at (1800, 1800), dist = ~565 (outside 520 range)
    const enemyMinion = new MinionUnit({
      id: 'far_ranged_target',
      team: 'enemy',
      x: 1800,
      y: 1800,
      hp: 300,
      radius: 20
    });
    sim.entities.push(enemyMinion);

    sim.handleCommand({
      type: CommandType.ATTACK_TARGET,
      targetEntity: enemyMinion,
      targetId: enemyMinion.id
    });

    // Run simulation ticks until hero enters attack range
    for (let i = 0; i < 20; i++) {
      sim.update(0.05);
      if (sim.heroProjectiles.length > 0) break;
    }

    const dist = Math.hypot(enemyMinion.x - hero.x, enemyMinion.y - hero.y);
    assertTrue(dist >= 500, `Ranged hero must remain at range (dist was ${dist.toFixed(1)}, expected >= 500)`);
    assertTrue(sim.heroProjectiles.length > 0, 'Ranged hero should fire projectile from range');
    assertFalse(hero.isMoving, 'Ranged hero should stop moving once in range');
  });

  it('TC-ATK-19: Melee hero navigates all the way to target position and attacks in melee range', () => {
    const sim = new GameSimulation({ heroClass: 'knight' }); // Knight attackRange = 130
    const hero = sim.playerHero;
    hero.x = 1400;
    hero.y = 1400;

    // Enemy placed along diagonal lane at (1600, 1600), dist = ~283
    const enemyMinion = new MinionUnit({
      id: 'far_melee_target',
      team: 'enemy',
      x: 1600,
      y: 1600,
      hp: 300,
      radius: 20
    });
    enemyMinion.speed = 0; // Stationary target
    sim.entities.push(enemyMinion);

    sim.handleCommand({
      type: CommandType.ATTACK_TARGET,
      targetEntity: enemyMinion,
      targetId: enemyMinion.id
    });

    // Hero must travel until dist <= 130 + 20 = 150. Distance to travel: 283 - 150 = 133 units
    for (let i = 0; i < 20; i++) {
      sim.update(0.05);
      if (enemyMinion.hp < 300) break;
    }

    const dist = Math.hypot(enemyMinion.x - hero.x, enemyMinion.y - hero.y);
    assertTrue(dist <= 155, `Melee hero must reach melee range (dist was ${dist.toFixed(1)}, expected <= 155)`);
    assertTrue(enemyMinion.hp < 300, 'Enemy must take damage from melee attack');
  });

  it('TC-ATK-20: Hero continuously pursues target that moves away', () => {
    const sim = new GameSimulation({ heroClass: 'knight' });
    const hero = sim.playerHero;
    hero.x = 1000;
    hero.y = 1000;

    const enemy = new MinionUnit({
      id: 'fleeing_target',
      team: 'enemy',
      x: 1080,
      y: 1080,
      hp: 300
    });
    sim.entities.push(enemy);

    sim.handleCommand({
      type: CommandType.ATTACK_TARGET,
      targetEntity: enemy,
      targetId: enemy.id
    });

    sim.update(0.05);

    // Now enemy moves further away along lane to (1300, 1300)
    enemy.x = 1300;
    enemy.y = 1300;
    sim.update(0.05);

    assertTrue(hero.isMoving, 'Hero must resume moving to pursue fleeing enemy');
    assertTrue(hero.vx > 0, 'Hero velocity must face towards target');
  });

  it('TC-ATK-21: Right-drag started on hostile target protects attack command from MOVE_TO override', () => {
    const sim = new GameSimulation({ heroClass: 'knight' });
    const input = sim.input;

    const hostile = new MinionUnit({
      id: 'drag_target',
      team: 'enemy',
      x: 1000,
      y: 1000,
      hp: 300
    });
    input.entityManager = [hostile];

    const vp = { width: 1280, height: 720 };
    const screenPos = worldToScreen(1000, 1000, 0, input.camera, input.camera.zoom, vp);

    let dispatched = [];
    input.onCommand((cmd) => dispatched.push(cmd));

    // Pointer down on hostile
    input.handlePointerDown({ clientX: screenPos.sx, clientY: screenPos.sy, button: 2 });
    assertTrue(input.isAttackingTargetDown, 'isAttackingTargetDown must be set to true on hostile target');
    assertEqual(dispatched[0].type, CommandType.ATTACK_TARGET);

    // Mouse drifts onto empty ground while holding right button
    input.hoveredEntity = null;
    dispatched = [];
    input.dispatchSmartRightClick(sim.playerHero);

    // MOVE_TO must be suppressed while isAttackingTargetDown is active
    assertEqual(dispatched.length, 0, 'MOVE_TO must not be dispatched while attacking target');

    // Pointer up resets the protection
    input.handlePointerUp({ button: 2 });
    assertFalse(input.isAttackingTargetDown, 'isAttackingTargetDown must be cleared on pointerup');
  });

  it('TC-ATK-22: Slaying first monster in a camp automatically chains attack to next nearby monster', () => {
    const sim = new GameSimulation({ heroClass: 'ranger' });
    const hero = sim.playerHero;
    hero.x = 1400;
    hero.y = 1400;

    // Monster 1 (10 HP, will die in 1 hit)
    const monster1 = new MinionUnit({
      id: 'camp_monster_1',
      team: 'neutral',
      x: 1500,
      y: 1500,
      hp: 10,
      maxHp: 200
    });

    // Monster 2 (200 HP, in the same camp at dist 180 from hero)
    const monster2 = new MinionUnit({
      id: 'camp_monster_2',
      team: 'neutral',
      x: 1530,
      y: 1530,
      hp: 200,
      maxHp: 200
    });
    sim.entities.push(monster1, monster2);

    sim.handleCommand({
      type: CommandType.ATTACK_TARGET,
      targetEntity: monster1,
      targetId: monster1.id
    });

    // Run ticks until Ranger projectile hits monster1
    for (let i = 0; i < 10; i++) {
      sim.update(0.05);
      if (monster1.hp <= 0 || monster1.isDead) break;
    }

    assertTrue(monster1.hp <= 0 || monster1.isDead, 'First monster must be dead');
    assertEqual(hero.attackTarget?.id, 'camp_monster_2', 'Hero must chain attack to the second monster');
  });

  it('TC-ATK-23: Melee hero advances to and strikes second monster after first dies', () => {
    const sim = new GameSimulation({ heroClass: 'knight' });
    const hero = sim.playerHero;
    hero.x = 1400;
    hero.y = 1400;

    const monster1 = new MinionUnit({
      id: 'pack_1',
      team: 'neutral',
      x: 1470,
      y: 1470, // In melee range
      hp: 10,
      maxHp: 200
    });
    monster1.speed = 0;

    const monster2 = new MinionUnit({
      id: 'pack_2',
      team: 'neutral',
      x: 1620,
      y: 1620, // Further away (~311 units)
      hp: 300,
      maxHp: 300
    });
    monster2.speed = 0;
    sim.entities.push(monster1, monster2);

    sim.handleCommand({
      type: CommandType.ATTACK_TARGET,
      targetEntity: monster1,
      targetId: monster1.id
    });

    // Tick 1: Slays pack_1
    sim.update(0.05);
    assertTrue(monster1.hp <= 0 || monster1.isDead, 'Pack 1 must be slain');
    assertEqual(hero.attackTarget?.id, 'pack_2', 'Hero must target pack 2');

    // Run ticks: Melee hero pursues and damages pack_2 (at 1.0x cooldown recovery, 1.54s / 0.05s = ~31 ticks)
    for (let i = 0; i < 35; i++) {
      sim.update(0.05);
      if (monster2.hp < 300) break;
    }

    assertTrue(monster2.hp < 300, 'Hero should have closed in and damaged pack 2');
  });

  it('TC-ATK-24: STOP command halts hero and cancels combat chaining to other monsters', () => {
    const sim = new GameSimulation({ heroClass: 'knight' });
    const hero = sim.playerHero;
    hero.x = 1400;
    hero.y = 1400;

    const monster1 = new MinionUnit({
      id: 'stop_pack_1',
      team: 'neutral',
      x: 1460,
      y: 1460,
      hp: 10
    });
    monster1.speed = 0;

    const monster2 = new MinionUnit({
      id: 'stop_pack_2',
      team: 'neutral',
      x: 1550,
      y: 1550,
      hp: 300
    });
    monster2.speed = 0;
    sim.entities.push(monster1, monster2);

    sim.handleCommand({
      type: CommandType.ATTACK_TARGET,
      targetEntity: monster1,
      targetId: monster1.id
    });

    // Player presses STOP (S/H)
    sim.handleCommand({ type: CommandType.STOP });

    assertTrue(hero.holdPosition, 'Hero holdPosition must be true');
    assertEqual(hero.attackTarget, null, 'Hero attack target must be cleared');

    sim.update(0.05);
    assertEqual(hero.attackTarget, null, 'Hero must not acquire monster 2 when holding position');
  });

  it('TC-ATK-25: Basic attack cooldown recovers at exactly 1.0s per second during sim.update', () => {
    const sim = new GameSimulation({ heroClass: 'knight' });
    const hero = sim.playerHero;
    hero.attackSpeed = 1.0;
    hero.attackCooldown = 1.0;

    // Advance simulation by 0.25 seconds
    sim.update(0.25);

    // With single decrement, remaining cooldown should be 0.75s (not 0.50s from duplicate decrement)
    const expected = 0.75;
    const diff = Math.abs(hero.attackCooldown - expected);
    assertTrue(diff < 0.001, `Attack cooldown should recover at 1.0s/s: expected ~${expected}, got ${hero.attackCooldown}`);

    // Advance another 0.50 seconds
    sim.update(0.50);
    const expected2 = 0.25;
    const diff2 = Math.abs(hero.attackCooldown - expected2);
    assertTrue(diff2 < 0.001, `Attack cooldown should recover at 1.0s/s: expected ~${expected2}, got ${hero.attackCooldown}`);
  });

  it('TC-ATK-26: Hero in attack-move resumes movement to destination after slaying intermediate enemy and clears on arrival', () => {
    const sim = new GameSimulation({ heroClass: 'knight' });
    const hero = sim.playerHero;
    hero.x = 1000;
    hero.y = 1000;

    // Issue Attack-Move toward (1500, 1000)
    sim.handleCommand({
      type: CommandType.ATTACK_TARGET,
      targetId: null,
      targetX: 1500,
      targetY: 1000,
      attackMove: true
    });

    assertEqual(hero.attackMoveDestination?.x, 1500);
    assertEqual(hero.attackMoveDestination?.y, 1000);

    // Place low-HP enemy in path at (1150, 1000)
    const intermediateEnemy = new MinionUnit({
      id: 'intermediate_enemy',
      team: 'enemy',
      x: 1150,
      y: 1000,
      hp: 10,
      maxHp: 100
    });
    intermediateEnemy.speed = 0;
    sim.entities.push(intermediateEnemy);

    // Run simulation ticks: hero engages and slays the intermediate enemy
    for (let i = 0; i < 15; i++) {
      sim.update(0.05);
      if (intermediateEnemy.hp <= 0 || intermediateEnemy.isDead) break;
    }

    assertTrue(intermediateEnemy.hp <= 0 || intermediateEnemy.isDead, 'Intermediate enemy must be slain');
    assertEqual(hero.attackTarget, null, 'Hero attack target should be cleared');

    // Run subsequent ticks: hero must resume moving toward attackMoveDestination (1500, 1000)
    const xAfterKill = hero.x;
    for (let i = 0; i < 10; i++) {
      sim.update(0.05);
    }

    assertTrue(hero.x > xAfterKill, 'Hero should have resumed moving toward destination');
    assertTrue(hero.isMoving, 'Hero must be moving toward attack-move destination');

    // Teleport hero to within 5 units of destination to simulate arrival
    hero.x = 1496;
    hero.y = 1000;
    sim.update(0.05);

    // Destination cleared within 10 units threshold and hero halts
    assertEqual(hero.attackMoveDestination, null, 'attackMoveDestination cleared on arrival within 10 units');
    assertEqual(hero.isMoving, false, 'Hero stops upon arrival');
    assertEqual(hero.vx, 0, 'Velocity X is 0');
    assertEqual(hero.vy, 0, 'Velocity Y is 0');
  });

  it('TC-ATK-27: Crowd control (stun/root) halts hero pursuit of enemy target', () => {
    const sim = new GameSimulation({ heroClass: 'knight' });
    const hero = sim.playerHero;
    hero.x = 1000;
    hero.y = 1000;

    // Place enemy far away (out of attack range)
    const enemyMinion = new MinionUnit({
      id: 'cc_test_target',
      team: 'enemy',
      x: 1400,
      y: 1000,
      hp: 300
    });
    enemyMinion.speed = 0;
    sim.entities.push(enemyMinion);

    sim.handleCommand({
      type: CommandType.ATTACK_TARGET,
      targetEntity: enemyMinion,
      targetId: enemyMinion.id
    });

    // Tick 1: Hero begins pursuing
    sim.update(0.05);
    assertTrue(hero.x > 1000, 'Hero should advance toward enemy target');
    const posXBeforeStun = hero.x;

    // Apply Stun for 5 seconds
    hero.stunnedUntil = Date.now() + 5000;
    assertFalse(hero.canMove(), 'Hero should not be able to move while stunned');

    // Run simulation ticks while stunned
    for (let i = 0; i < 5; i++) {
      sim.update(0.05);
    }

    // Hero position must remain frozen
    assertEqual(hero.x, posXBeforeStun, 'Hero position must not advance while stunned');
    assertFalse(hero.isMoving, 'Hero isMoving flag must be false while stunned');

    // Cleanse stun
    hero.stunnedUntil = 0;
    assertTrue(hero.canMove(), 'Hero should be able to move after stun expires');

    // Run ticks: pursuit resumes
    sim.update(0.05);
    assertTrue(hero.x > posXBeforeStun, 'Hero should resume advancing once stun ends');
  });

  it('TC-ATK-28: Hero facing orientation updates toward skill target point on ability cast', () => {
    const sim = new GameSimulation({ heroClass: 'sorceress' });
    const hero = sim.playerHero;
    hero.x = 1000;
    hero.y = 1000;
    hero.facing = 0; // Facing East

    // Cast skill Q directly South (targetX: 1000, targetY: 1500) -> angle = Math.PI / 2
    sim.handleCommand({
      type: CommandType.CAST_SKILL,
      skill: 'Q',
      targetX: 1000,
      targetY: 1500
    });

    const expectedSouthAngle = Math.PI / 2; // ~1.5708
    const diffSouth = Math.abs(hero.facing - expectedSouthAngle);
    assertTrue(diffSouth < 0.001, `Hero facing should point South (~1.5708 rad), got ${hero.facing}`);

    // Reset cooldown and mana for next cast
    hero.mana = 500;
    hero.abilities.W.cooldownRemaining = 0;

    // Cast skill W directly West (targetX: 500, targetY: 1000) -> angle = Math.PI
    sim.handleCommand({
      type: CommandType.CAST_SKILL,
      skill: 'W',
      targetX: 500,
      targetY: 1000
    });

    const expectedWestAngle = Math.PI; // ~3.1416
    const diffWest = Math.abs(Math.abs(hero.facing) - expectedWestAngle);
    assertTrue(diffWest < 0.001, `Hero facing should point West (~3.1416 rad), got ${hero.facing}`);

    // Self-cast (targetX === hero.x, targetY === hero.y) should preserve previous facing
    const facingBeforeSelfCast = hero.facing;
    hero.mana = 500;
    hero.abilities.E.cooldownRemaining = 0;
    sim.handleCommand({
      type: CommandType.CAST_SKILL,
      skill: 'E',
      targetX: 1000,
      targetY: 1000
    });
    assertEqual(hero.facing, facingBeforeSelfCast, 'Self-cast at hero position must retain current facing');
  });

  it('TC-INP-08: A key in InputDispatcher dispatches ATTACK_TARGET for ground attack-move and enemy target', () => {
    const dispatcher = new InputDispatcher({ x: 0, y: 0 }, 1.0, { width: 1280, height: 720 });
    const hero = { x: 500, y: 500, hp: 500, isAlive: () => true };

    // 1. Ground attack-move with coordinates (center screen 640, 360 -> world 0, 0)
    const cmdGround = dispatcher.handleKeyDown('A', hero, 640, 360);
    assertEqual(cmdGround.type, CommandType.ATTACK_TARGET);
    assertEqual(cmdGround.targetId, null);
    assertEqual(cmdGround.attackMove, true);
    assertEqual(cmdGround.targetX, 0);
    assertEqual(cmdGround.targetY, 0);

    // 2. Direct enemy target
    const enemy = { id: 'enemy_minion_99', team: 'enemy', x: 700, y: 700 };
    const cmdEnemy = dispatcher.handleKeyDown('a', hero, enemy);
    assertEqual(cmdEnemy.type, CommandType.ATTACK_TARGET);
    assertEqual(cmdEnemy.targetId, 'enemy_minion_99');
    assertEqual(cmdEnemy.targetX, 700);
    assertEqual(cmdEnemy.targetY, 700);
    assertEqual(cmdEnemy.targetEntity, enemy);

    // 3. Ground fallback to hero position when no coordinates passed
    const cmdHeroGround = dispatcher.handleKeyDown('A', hero);
    assertEqual(cmdHeroGround.type, CommandType.ATTACK_TARGET);
    assertEqual(cmdHeroGround.targetId, null);
    assertEqual(cmdHeroGround.attackMove, true);
    assertEqual(cmdHeroGround.targetX, 500);
    assertEqual(cmdHeroGround.targetY, 500);

    // 4. Dead hero rejection
    const deadHero = { x: 500, y: 500, hp: 0, isAlive: () => false, isDead: true };
    const cmdDead = dispatcher.handleKeyDown('A', deadHero);
    assertEqual(cmdDead, null);
  });
});
