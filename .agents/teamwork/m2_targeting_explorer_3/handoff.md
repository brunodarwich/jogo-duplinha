# Handoff Report: Cast Facing, Hold/Stop Invariants & Unit Test Specifications

## 1. Observation

Direct inspection of `src/game.js`, `src/core/input.js`, `src/entities/entity.js`, `tests/unit/player_attack.test.js`, and `tests/unit/input.test.js` revealed the following exact lines and behaviors:

### 1.1 Hero Facing Orientation During Ability Cast
- In `src/game.js` (`GameSimulation.executeHeroSkill`, lines 449–466):
  ```javascript
  executeHeroSkill(slot, ability, cmd) {
    const hero = this.playerHero;
    if (!hero) return;
    const isHeroAlive = typeof hero.isAlive === 'function'
      ? hero.isAlive()
      : (!hero.isDead && (typeof hero.hp !== 'number' || hero.hp > 0));
    if (!isHeroAlive) return;
    if (typeof hero.canCast === 'function' && !hero.canCast()) return;

    const targetX = cmd.targetX ?? hero.x;
    const targetY = cmd.targetY ?? hero.y;

    // Deduct mana & set cooldown
    hero.mana = Math.max(0, hero.mana - (ability.manaCost || 0));
    const effectiveCooldown = ability.cooldown * (1 - (hero.cdr || 0));
    ability.cooldownRemaining = Math.max(1.0, effectiveCooldown);
  ```
  `hero.facing` is never updated when executing a skill. The hero remains oriented in their previous movement or basic attack direction regardless of where the skill was aimed.

### 1.2 Stop / Hold ('S' / 'H') Invariant Verification
Inspection of the full command dispatch and combat state pipeline confirmed that Stop / Hold invariants hold across the following locations:
- **Velocity zeroing & recall cancellation**:
  In `src/entities/entity.js` (`Entity.stop`, lines 118–128):
  ```javascript
  stop() {
    this.targetX = null;
    this.targetY = null;
    this.vx = 0;
    this.vy = 0;
    this.isMoving = false;
    if (this.isRecalling) {
      this.isRecalling = false;
      this.recallElapsed = 0;
    }
  }
  ```
- **Target clearing & hold position state**:
  In `src/entities/entity.js` (`HeroEntity.stop`, lines 408–413):
  ```javascript
  stop() {
    super.stop();
    this.attackTarget = null;
    this.attackMoveDestination = null;
    this.holdPosition = true;
  }
  ```
- **Command handler**:
  In `src/game.js` (`GameSimulation.handleCommand`, lines 275–281):
  ```javascript
  case CommandType.STOP: {
    this.playerHero.stop();
    this.playerHero.setAttackTarget(null);
    this.playerHero.attackMoveDestination = null;
    this.playerHero.holdPosition = true;
    break;
  }
  ```
- **Idle auto-attack suppression**:
  In `src/game.js` (`GameSimulation.updateHeroCombat`, line 714):
  ```javascript
  if (!hero.attackTarget && !hero.isMoving && !hero.isRecalling && !hero.holdPosition) {
  ```
  While `hero.holdPosition === true`, idle acquisition is completely suppressed.
- **Combat & kill chaining suppression**:
  In `src/game.js` (`updateHeroCombat`, line 741):
  ```javascript
  if (nextEnemy && !hero.holdPosition) {
  ```
  In `src/game.js` (`applyHeroHit`, line 945):
  ```javascript
  hero.attackTarget = (nextEnemy && !hero.holdPosition) ? nextEnemy : null;
  ```
  Both locations prevent acquiring or chaining to subsequent enemies when `hero.holdPosition` is `true`.
- **Keyboard mapping**:
  In `src/core/input.js` (`InputManager.handleKeyDown`, lines 608–612):
  `key === 'KeyS' || key === 's' || key === 'S' || key === 'KeyH' || key === 'h' || key === 'H'` -> dispatches `{ type: CommandType.STOP }`.
  In `src/core/input.js` (`InputDispatcher.handleKeyDown`, lines 156–159):
  `upperKey === 'S' || upperKey === 'H'` -> returns `{ type: CommandType.STOP }`.

### 1.3 Attack Cooldown Double Decrement Defect
- In `src/entities/entity.js` (`HeroEntity.update`, lines 506–508):
  ```javascript
  if (this.attackCooldown > 0) {
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
  }
  ```
- In `src/game.js` (`GameSimulation.updateHeroCombat`, lines 709–711):
  ```javascript
  if (hero.attackCooldown > 0) {
    hero.attackCooldown = Math.max(0, hero.attackCooldown - dt);
  }
  ```
- In `src/game.js` (`GameSimulation.update`, lines 990 & 1026):
  ```javascript
  ent.update(dt); // Decrement 1
  ...
  this.updateHeroCombat(dt, this.playerHero); // Decrement 2
  ```
  `playerHero.attackCooldown` is decremented twice in every simulation tick (`2 * dt`), doubling the recovery speed of basic attacks.

### 1.4 Attack-Move ('A') Key Handling Gap in `InputDispatcher`
- In `src/core/input.js` (`InputDispatcher.handleKeyDown`, lines 113–177):
  The method handles `Q, W, E, R`, `S, H`, `B`, and `Escape`. It contains NO handling for `A` or `KeyA`. Calling `dispatcher.handleKeyDown('A')` returns `null`.

### 1.5 Attack-Move Continuation & Destination Clearance Defect
- In `src/game.js` (`GameSimulation.updateHeroCombat`, lines 722–752):
  When `hero.attackMoveDestination` is active and an enemy is encountered, lines 766–770 stop the hero to attack (`hero.isMoving = false; hero.targetX = null; hero.targetY = null; hero.vx = 0; hero.vy = 0;`).
  When that enemy is slain and no further enemies are within `searchRadius`, lines 747–751 clear `hero.attackTarget = null` and return.
  The hero remains stationary with `targetX = null` and never resumes moving toward `hero.attackMoveDestination`.
  Furthermore, when the hero walks to `hero.attackMoveDestination` without enemies, `attackMoveDestination` is never cleared on arrival (`dist <= 10`).

### 1.6 Missing Crowd Control Guard During Pursuit
- In `src/game.js` (`GameSimulation.updateHeroCombat`, lines 778–787):
  ```javascript
  } else {
    // Pursue target
    const step = hero.speed * dt;
    hero.vx = (dx / dist) * hero.speed;
    hero.vy = (dy / dist) * hero.speed;
    hero.x += hero.vx * dt;
    hero.y += hero.vy * dt;
    hero.facing = Math.atan2(dy, dx);
    hero.isMoving = true;
  }
  ```
  `hero.canMove()` is not checked. If the hero is Stunned (`hero.stunnedUntil`) or Rooted (`hero.rootedUntil`) while pursuing a target out of attack range, their coordinates continue to advance.

### 1.7 Baseline Test Suite Run
Executing `npm test` verified that all 22 test files and 162 existing tests pass with 0 errors in 579ms.

---

## 2. Logic Chain

1. **Hero Facing Update (Observation 1.1)**:
   - When a player fires an ability with `CAST_SKILL` or `CAST_ABILITY`, `targetX` and `targetY` denote the targeted world position.
   - Requirement R5 mandates: "O herói orienta suavemente seu ângulo de visão (facing) na direção em que se move, na direção do alvo de ataque ou da habilidade mirada."
   - In `executeHeroSkill`, calculating `hero.facing = Math.atan2(targetY - hero.y, targetX - hero.x)` whenever `targetX !== hero.x || targetY !== hero.y` ensures that cast animation, visual facing notches, and downstream projectile spawns match the player's targeting direction.
   - For forward-compatibility with Milestone 3's smooth facing lerp, setting `if ('targetFacing' in hero) hero.targetFacing = hero.facing;` ensures instant synchronization.

2. **Hold/Stop Invariants (Observation 1.2)**:
   - Verification confirms that dispatching `STOP` triggers `Entity.stop()`, resetting `vx = 0`, `vy = 0`, `isMoving = false`, `targetX = null`, `targetY = null`, cancelling active Recall (`isRecalling = false, recallElapsed = 0`).
   - `HeroEntity.stop()` explicitly sets `attackTarget = null`, `attackMoveDestination = null`, and `holdPosition = true`.
   - `updateHeroCombat` lines 714, 741 and `applyHeroHit` line 945 all guard with `!hero.holdPosition`. Thus, neither idle aggression nor chaining can reactivate combat until the player explicitly issues a new `MOVE_TO` or `ATTACK_TARGET` command.

3. **Attack Cooldown Rate (Observation 1.3)**:
   - In standard game loop architecture, entity cooldowns must decrement by exactly `dt` seconds per elapsed tick.
   - Because `HeroEntity.update(dt)` already decrements `this.attackCooldown = Math.max(0, this.attackCooldown - dt)`, the decrement in `GameSimulation.updateHeroCombat` is redundant.
   - Removing lines 709–711 in `src/game.js` restores single cooldown recovery rate: exactly `1.0s` of cooldown recovered per `1.0s` of game simulation time.

4. **'A' Key Handling in InputDispatcher (Observation 1.4)**:
   - `InputDispatcher` is the headless command synthesizer used by test suites and simulation clients.
   - To match `InputManager.handleKeyDown`, `InputDispatcher.handleKeyDown` must parse `'A'` and `'KeyA'`.
   - If an enemy entity is provided/hovered, it dispatches `ATTACK_TARGET` targeting that entity (`targetId`, `targetEntity`).
   - If ground coordinates or default mouse context are provided, it dispatches `ATTACK_TARGET` with `attackMove: true`, `targetId: null`, and unprojected world coordinates `targetX: wx, targetY: wy`.
   - If the hero is dead, it returns `{ type: 'ATTACK_ERROR', error: 'Hero is dead' }`.

5. **Attack-Move Path Continuation & Destination Arrival (Observation 1.5)**:
   - When intermediate targets die, `hero.attackTarget` becomes `null`.
   - In `updateHeroCombat`, if `hero.attackMoveDestination && !hero.attackTarget`, the system should:
     1. Search for enemies in range.
     2. If found, lock `hero.attackTarget = enemy`.
     3. If no enemies are in range, check distance to `hero.attackMoveDestination`. If `dist <= 10`, arrival is complete: clear `hero.attackMoveDestination = null`, stop moving.
     4. If `dist > 10` and the hero is not currently moving toward `attackMoveDestination`, call `hero.moveTo(hero.attackMoveDestination.x, hero.attackMoveDestination.y, true)`.

6. **Crowd Control Halt During Pursuit (Observation 1.6)**:
   - `Entity.canMove()` checks `stunnedUntil` and `rootedUntil`.
   - When pursuing an enemy (`dist > effectiveRange`), checking `if (hero.canMove && !hero.canMove()) { hero.isMoving = false; hero.vx = 0; hero.vy = 0; return; }` immediately freezes movement for the duration of the crowd control effect without dropping the target reference.

---

## 3. Caveats

- **No Caveats** on Stop/Hold invariants: all code paths strictly enforce immediate cessation and idle suppression.
- **Facing Lerp Transition (M3)**: In M2, `hero.facing` is updated directly. In M3, an angular lerp using `hero.targetFacing` and `hero.turnSpeed` will be layered on top. Setting both `hero.facing` and `hero.targetFacing` (if present) ensures total backward and forward compatibility.
- **Headless Screen Unprojection**: `InputDispatcher.handleKeyDown` accepts optional `(targetOrScreenX, screenYOrEntity, hoveredEntity)` arguments so headless unit tests can test both direct entity hover and screen unprojection.

---

## 4. Conclusion & Actionable Code Replacements

The exact, machine-applicable code changes and test specifications are formulated below.

### 4.1 Exact Code Replacement 1: Hero Facing Update on Ability Cast
**Target File**: `src/game.js`  
**Location**: `executeHeroSkill(slot, ability, cmd)`, lines 458–466  

**Target Content**:
```javascript
    const targetX = cmd.targetX ?? hero.x;
    const targetY = cmd.targetY ?? hero.y;

    // Deduct mana & set cooldown
    hero.mana = Math.max(0, hero.mana - (ability.manaCost || 0));
    const effectiveCooldown = ability.cooldown * (1 - (hero.cdr || 0));
    ability.cooldownRemaining = Math.max(1.0, effectiveCooldown);
```

**Replacement Content**:
```javascript
    const targetX = cmd.targetX ?? hero.x;
    const targetY = cmd.targetY ?? hero.y;

    // Orient hero towards skill target on cast
    if (targetX !== hero.x || targetY !== hero.y) {
      hero.facing = Math.atan2(targetY - hero.y, targetX - hero.x);
      if ('targetFacing' in hero) {
        hero.targetFacing = hero.facing;
      }
    }

    // Deduct mana & set cooldown
    hero.mana = Math.max(0, hero.mana - (ability.manaCost || 0));
    const effectiveCooldown = ability.cooldown * (1 - (hero.cdr || 0));
    ability.cooldownRemaining = Math.max(1.0, effectiveCooldown);
```

---

### 4.2 Exact Code Replacement 2: Remove Duplicate Attack Cooldown Decrement
**Target File**: `src/game.js`  
**Location**: `updateHeroCombat(dt, hero)`, lines 708–711  

**Target Content**:
```javascript
    // Cooldown ticks
    if (hero.attackCooldown > 0) {
      hero.attackCooldown = Math.max(0, hero.attackCooldown - dt);
    }
```

**Replacement Content**:
```javascript
    // Attack cooldown is decremented solely in HeroEntity.update(dt) to maintain exact 1.0s/s rate
```

---

### 4.3 Exact Code Replacement 3: Attack-Move Continuation & Arrival Clearance
**Target File**: `src/game.js`  
**Location**: `updateHeroCombat(dt, hero)`, lines 722–730  

**Target Content**:
```javascript
    // 2. Attack-move behavior
    if (hero.attackMoveDestination && !hero.attackTarget) {
      const searchRadius = Math.max(hero.attackRange + 60, 280);
      const enemy = this.findNearestEnemy(hero.x, hero.y, searchRadius, hero.team);
      if (enemy) {
        hero.attackTarget = enemy;
      }
    }
```

**Replacement Content**:
```javascript
    // 2. Attack-move behavior & path continuation
    if (hero.attackMoveDestination && !hero.attackTarget) {
      const searchRadius = Math.max(hero.attackRange + 60, 280);
      const enemy = this.findNearestEnemy(hero.x, hero.y, searchRadius, hero.team);
      if (enemy) {
        hero.attackTarget = enemy;
      } else {
        const destDx = hero.attackMoveDestination.x - hero.x;
        const destDy = hero.attackMoveDestination.y - hero.y;
        const destDist = Math.hypot(destDx, destDy);
        if (destDist <= 10) {
          hero.attackMoveDestination = null;
          hero.isMoving = false;
          hero.targetX = null;
          hero.targetY = null;
          hero.vx = 0;
          hero.vy = 0;
        } else if (!hero.isMoving || hero.targetX !== hero.attackMoveDestination.x || hero.targetY !== hero.attackMoveDestination.y) {
          hero.moveTo(hero.attackMoveDestination.x, hero.attackMoveDestination.y, true);
        }
      }
    }
```

---

### 4.4 Exact Code Replacement 4: Crowd Control Movement Guard During Pursuit
**Target File**: `src/game.js`  
**Location**: `updateHeroCombat(dt, hero)`, lines 778–788  

**Target Content**:
```javascript
      } else {
        // Pursue target
        const step = hero.speed * dt;
        hero.vx = (dx / dist) * hero.speed;
        hero.vy = (dy / dist) * hero.speed;
        hero.x += hero.vx * dt;
        hero.y += hero.vy * dt;
        hero.facing = Math.atan2(dy, dx);
        hero.isMoving = true;
      }
```

**Replacement Content**:
```javascript
      } else {
        // Pursue target if not crowd controlled (stunned/rooted)
        if (hero.canMove && !hero.canMove()) {
          hero.isMoving = false;
          hero.vx = 0;
          hero.vy = 0;
          return;
        }

        const step = hero.speed * dt;
        hero.vx = (dx / dist) * hero.speed;
        hero.vy = (dy / dist) * hero.speed;
        hero.x += hero.vx * dt;
        hero.y += hero.vy * dt;
        hero.facing = Math.atan2(dy, dx);
        hero.isMoving = true;
      }
```

---

### 4.5 Exact Code Replacement 5: 'A' Key Handling in `InputDispatcher`
**Target File**: `src/core/input.js`  
**Location**: `InputDispatcher.handleKeyDown`, lines 154–160  

**Target Content**:
```javascript
    // Stop command
    if (upperKey === 'S' || upperKey === 'H') {
      this.targetingSkill = null;
      return { type: CommandType.STOP };
    }
```

**Replacement Content**:
```javascript
    // Attack-Move command 'A'
    if (upperKey === 'A' || upperKey === 'KEYA') {
      this.targetingSkill = null;
      if (hero) {
        const isDead = typeof hero.isDead === 'function' ? hero.isDead() : !!hero.isDead;
        const isAlive = typeof hero.isAlive === 'function'
          ? hero.isAlive()
          : (!isDead && (typeof hero.hp !== 'number' || hero.hp > 0));
        if (isDead || !isAlive) return { type: 'ATTACK_ERROR', error: 'Hero is dead' };
      }

      let hoveredEntity = null;
      let wx = hero ? hero.x : 0;
      let wy = hero ? hero.y : 0;

      if (arg3 && typeof arg3 === 'object' && ('id' in arg3 || 'team' in arg3)) {
        hoveredEntity = arg3;
        if (typeof arg4 === 'number') wx = arg4;
        if (typeof arg5 === 'number') wy = arg5;
      } else if (typeof arg3 === 'number' && typeof arg4 === 'number') {
        const world = screenToWorld(arg3, arg4, this.camera, this.zoom, this.viewport);
        wx = clamp(world.wx, 0, MAP_SIZE);
        wy = clamp(world.wy, 0, MAP_SIZE);
        hoveredEntity = arg5;
      }

      const isHostile = hoveredEntity && (hoveredEntity.team === 'enemy' || hoveredEntity.isEnemy || hoveredEntity.team === 'neutral');
      if (isHostile) {
        return {
          type: CommandType.ATTACK_TARGET,
          targetId: hoveredEntity.id,
          targetX: hoveredEntity.x,
          targetY: hoveredEntity.y,
          targetEntity: hoveredEntity
        };
      }

      return {
        type: CommandType.ATTACK_TARGET,
        targetId: null,
        targetX: wx,
        targetY: wy,
        attackMove: true
      };
    }

    // Stop command
    if (upperKey === 'S' || upperKey === 'H') {
      this.targetingSkill = null;
      return { type: CommandType.STOP };
    }
```
*Note: Also update signature at line 113 to `handleKeyDown(key, hero = null, arg3 = null, arg4 = null, arg5 = null)`.*

---

### 4.6 Unit Test Specifications

#### Test 1: Single Attack Cooldown Recovery Rate
**Target File**: `tests/unit/player_attack.test.js`
```javascript
  it('TC-ATK-25: Basic attack cooldown recovers at exactly 1.0s per second during sim.update', () => {
    const sim = new GameSimulation({ heroClass: 'knight' });
    const hero = sim.playerHero;
    hero.attackSpeed = 1.0;
    hero.attackCooldown = 1.0;

    // Advance simulation by 0.25 seconds
    sim.update(0.25);

    // With single decrement, remaining cooldown should be 0.75s (not 0.50s from double decrement)
    const expected = 0.75;
    const diff = Math.abs(hero.attackCooldown - expected);
    assertTrue(diff < 0.001, `Attack cooldown should recover at 1.0s/s: expected ~${expected}, got ${hero.attackCooldown}`);

    // Advance another 0.50 seconds
    sim.update(0.50);
    const expected2 = 0.25;
    const diff2 = Math.abs(hero.attackCooldown - expected2);
    assertTrue(diff2 < 0.001, `Attack cooldown should recover at 1.0s/s: expected ~${expected2}, got ${hero.attackCooldown}`);
  });
```

#### Test 2: 'A' Key Handling in `InputDispatcher`
**Target File**: `tests/unit/input.test.js`
```javascript
  it('TC-INP-08: A key in InputDispatcher dispatches ATTACK_TARGET for ground attack-move and enemy target', async () => {
    const { module: inputMod } = await resolveModule('core/input');
    const dispatcher = new inputMod.InputDispatcher({ x: 0, y: 0 }, 1.0, { width: 1280, height: 720 });
    const hero = { x: 500, y: 500, hp: 500, isAlive: () => true };

    // 1. Ground attack-move
    const cmdGround = dispatcher.handleKeyDown('A', hero);
    assertEqual(cmdGround.type, 'ATTACK_TARGET');
    assertEqual(cmdGround.targetId, null);
    assertEqual(cmdGround.attackMove, true);
    assertEqual(cmdGround.targetX, 500);
    assertEqual(cmdGround.targetY, 500);

    // 2. Direct enemy target
    const enemy = { id: 'enemy_minion_99', team: 'enemy', x: 700, y: 700 };
    const cmdEnemy = dispatcher.handleKeyDown('a', hero, enemy);
    assertEqual(cmdEnemy.type, 'ATTACK_TARGET');
    assertEqual(cmdEnemy.targetId, 'enemy_minion_99');
    assertEqual(cmdEnemy.targetX, 700);
    assertEqual(cmdEnemy.targetY, 700);

    // 3. Dead hero rejection
    const deadHero = { x: 500, y: 500, hp: 0, isAlive: () => false };
    const cmdDead = dispatcher.handleKeyDown('A', deadHero);
    assertEqual(cmdDead.type, 'ATTACK_ERROR');
  });
```

#### Test 3: Attack-Move Continuation After Intermediate Slay
**Target File**: `tests/unit/player_attack.test.js`
```javascript
  it('TC-ATK-26: Hero in attack-move resumes movement to destination after slaying intermediate enemy', () => {
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
  });
```

#### Test 4: Crowd Control Halt During Pursuit
**Target File**: `tests/unit/player_attack.test.js`
```javascript
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
```

#### Test 5: Hero Facing Orientation Update on Ability Cast
**Target File**: `tests/unit/player_attack.test.js`
```javascript
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
```

---

## 5. Verification Method

### 5.1 Test Execution Commands
Run the complete automated regression test suite:
```bash
npm test
```
Run the dedicated player attack unit suite:
```bash
node tests/runner.js tests/unit/player_attack.test.js
```
Run the dedicated input unit suite:
```bash
node tests/runner.js tests/unit/input.test.js
```

### 5.2 Independent Verification Invariants
1. **Cooldown Invariant**: `hero.attackCooldown` must decrease by exactly `dt` across any `sim.update(dt)` step.
2. **Facing Invariant**: `Math.atan2(targetY - hero.y, targetX - hero.x)` must equal `hero.facing` immediately after `CAST_SKILL` execution whenever `targetX !== hero.x || targetY !== hero.y`.
3. **Hold/Stop Invariant**: After `STOP`, `hero.vx === 0`, `hero.vy === 0`, `hero.attackTarget === null`, `hero.attackMoveDestination === null`, and `hero.holdPosition === true`. Zero automatic attacks or movements occur on subsequent ticks until a new command is issued.
4. **Attack-Move Path Invariant**: If an intermediate target is slain during an attack-move, the hero continues marching toward `hero.attackMoveDestination` until arriving within 10 units.
5. **Crowd Control Invariant**: Stunned or rooted heroes cannot advance their coordinates during pursuit.
