# Handoff Report: R2 (Target Click & Auto-Attack Mechanics) & R3 (Movement & Hold/Stop Command)

## 1. Observation

Direct code inspection of `src/core/input.js`, `src/game.js`, `src/entities/entity.js`, `src/entities/heroes.js`, `src/combat/combat.js`, `src/combat/projectile.js`, `src/combat/cc.js`, `src/world/map.js`, and `tests/unit/player_attack.test.js` revealed the following exact behaviors and code patterns:

### 1.1 Right-Click & Left-Click Targeting (R2)
- **Hostile entity picking**: In `src/core/input.js` (`InputManager.pickEntity`, lines 351–423), entities are filtered by viability (not dead, not untargetable) and checked against ground distance (`Math.max(36, hitRadius * 1.3)`) and 2.5D screen bounds (accounting for `ent.height` up to 32px above base). Hostile priority hierarchy is strictly ordered: Hostile Hero (5) > Hostile Minion (4) > Hostile Structure/Boss (3) > Neutral (2) > Allied (1).
- **Left-Click (Button 0)**:
  - In `InputManager.handlePointerDown` (lines 447–456):
    ```javascript
    if (this.hoveredEntity && this.isHostile(this.hoveredEntity, this.playerHeroRef)) {
      this.isAttackingTargetDown = true;
      this.dispatch({
        type: CommandType.ATTACK_TARGET,
        targetId: this.hoveredEntity.id,
        targetX: this.hoveredEntity.x,
        targetY: this.hoveredEntity.y,
        targetEntity: this.hoveredEntity
      });
      return;
    }
    ```
  - In `InputDispatcher.handleMouseDown` (headless, lines 102–107): returns `CommandType.SELECT`. Then `GameSimulation.handleCommand` (lines 306–318) intercepts `SELECT` and converts it to `CommandType.ATTACK_TARGET` if target is hostile.
- **Right-Click (Button 2)**:
  - In `InputManager.handlePointerDown` (lines 461–470): calls `dispatchSmartRightClick`.
  - In `InputManager.dispatchSmartRightClick` (lines 332–349):
    ```javascript
    if (this.hoveredEntity && this.isHostile(this.hoveredEntity, playerHero)) {
      this.isAttackingTargetDown = true;
      this.dispatch({
        type: CommandType.ATTACK_TARGET,
        targetId: this.hoveredEntity.id,
        targetX: this.hoveredEntity.x,
        targetY: this.hoveredEntity.y,
        targetEntity: this.hoveredEntity
      });
    } else if (!this.isAttackingTargetDown) {
      this.dispatch({
        type: CommandType.MOVE_TO,
        x: this.worldX,
        y: this.worldY
      });
    }
    ```
  - In `InputDispatcher.handleMouseDown` (lines 72–80): if `hoveredEntity && (hoveredEntity.team === 'enemy' || hoveredEntity.isEnemy || hoveredEntity.team === 'neutral')`, returns `CommandType.ATTACK_TARGET`.

### 1.2 Target Pursuit up to `attackRange + targetRadius` & Combat Loop (R2)
- In `src/game.js` (`GameSimulation.updateHeroCombat`, lines 740–773):
  - `const targetRadius = target.selectionRadius || target.radius || 20;`
  - `const effectiveRange = hero.attackRange + targetRadius;`
  - `hero.facing = Math.atan2(dy, dx);`
  - **In range (`dist <= effectiveRange`)**:
    - Halts movement: `hero.isMoving = false; hero.targetX = null; hero.targetY = null; hero.vx = 0; hero.vy = 0;`
    - Checks attack eligibility: `if (hero.canAttack && hero.canAttack() && hero.attackCooldown <= 0)`
    - Resets attack cooldown: `hero.attackCooldown = 1.0 / as;` (where `as = Math.max(0.2, hero.attackSpeed || 0.65)`)
    - Executes attack via `this.executeHeroBasicAttack(hero, target);`
  - **Out of range (`dist > effectiveRange`)**:
    - Pursues target:
      ```javascript
      const step = hero.speed * dt;
      hero.vx = (dx / dist) * hero.speed;
      hero.vy = (dy / dist) * hero.speed;
      hero.x += hero.vx * dt;
      hero.y += hero.vy * dt;
      hero.facing = Math.atan2(dy, dx);
      hero.isMoving = true;
      ```

### 1.3 Attack Cooldown Double-Decrement Defect (R2)
- In `src/entities/entity.js` (`HeroEntity.update`, lines 411–413):
  ```javascript
  if (this.attackCooldown > 0) {
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
  }
  ```
- In `src/game.js` (`GameSimulation.updateHeroCombat`, lines 694–696):
  ```javascript
  if (hero.attackCooldown > 0) {
    hero.attackCooldown = Math.max(0, hero.attackCooldown - dt);
  }
  ```
- In `src/game.js` (`GameSimulation.update`, lines 957–966):
  ```javascript
  for (const ent of this.entities) {
    if (ent.type === 'hero' && typeof ent.update === 'function') {
      ent.update(dt); // <--- First decrement of hero.attackCooldown by dt
    }
  }
  if (this.playerHero) {
    this.updateHeroCombat(dt, this.playerHero); // <--- Second decrement of hero.attackCooldown by dt!
  }
  ```
  `playerHero.attackCooldown` is decremented twice in every simulation tick (`2 * dt`), causing basic attack cooldown to recover at 200% speed when simulated via `sim.update(dt)`.

### 1.4 Attack-Move ('A') Mechanics (R2)
- In `src/core/input.js` (`InputManager.handleKeyDown`, lines 550–570):
  - If hovering a hostile entity: dispatches `CommandType.ATTACK_TARGET` with target entity.
  - If on ground: dispatches `CommandType.ATTACK_TARGET` with `targetId: null, targetX: this.worldX, targetY: this.worldY, attackMove: true`.
- In `src/game.js` (`GameSimulation.handleCommand`, lines 230–243):
  - Stores `hero.attackMoveDestination = { x: cmd.targetX, y: cmd.targetY };`
  - Calls `hero.moveTo(walkable.x, walkable.y, true);`
- In `src/game.js` (`GameSimulation.updateHeroCombat`, lines 708–714):
  - When idle during attack-move: checks `findNearestEnemy(hero.x, hero.y, Math.max(hero.attackRange + 60, 280), hero.team)`. If found, locks `hero.attackTarget = enemy;`.
- **Gaps Observed**:
  1. `InputDispatcher.handleKeyDown` (lines 113–172) completely lacks handling for key `'A'`. Headless test dispatchers calling `dispatcher.handleKeyDown('A')` return `null`.
  2. In `GameSimulation.updateHeroCombat` (lines 722–737): when the target dies and no additional enemies are within `chainRadius`, line 732 sets `hero.attackTarget = null; hero.isMoving = false; hero.vx = 0; hero.vy = 0; return;`. It does NOT resume movement towards `hero.attackMoveDestination`.
  3. When an entity arrives at `attackMoveDestination` without encountering enemies, `attackMoveDestination` is never cleared on arrival.

### 1.5 Target Chaining after Kills (R2)
- In `src/game.js`:
  - In `applyHeroHit` (lines 927–931):
    ```javascript
    if (hero && hero.attackTarget?.id === target.id) {
      const chainRadius = Math.max(hero.attackRange + 150, 500);
      const nextEnemy = this.findNearestEnemy(hero.x, hero.y, chainRadius, hero.team, target.team, target.id);
      hero.attackTarget = (nextEnemy && !hero.holdPosition) ? nextEnemy : null;
    }
    ```
  - In `updateHeroCombat` (lines 722–737): if current `attackTarget` is dead or untargetable, searches `nextEnemy` within `chainRadius`. If found and `!hero.holdPosition`, sets `hero.attackTarget = nextEnemy`. If not found or if `hero.holdPosition` is true, clears `hero.attackTarget = null`.

### 1.6 Movement & Continuous Right-Drag (R3)
- In `src/core/input.js` (`InputManager`):
  - Pointer down right-click sets `this.isRightDown = true` (line 462).
  - In `InputManager.update` (lines 312–318):
    ```javascript
    if (this.isRightDown && !this.targetingState && typeof performance !== 'undefined') {
      const now = performance.now();
      if (now - this.lastRightDragTime >= this.dragThrottleMs) {
        this.lastRightDragTime = now;
        this.dispatchSmartRightClick(this.playerHeroRef);
      }
    }
    ```
  - Throttle interval is 80ms (`this.dragThrottleMs = 80`).
  - Right-drag protection: `isAttackingTargetDown` prevents right-drag over ground from cancelling an intentional target attack command (verified by `TC-ATK-21`).
  - Releasing pointer (lines 486–490) resets `this.isRightDown = false` and `this.isAttackingTargetDown = false`.

### 1.7 Stop / Hold Command ('S' / 'H') (R3)
- In `src/core/input.js`:
  - `InputManager.handleKeyDown` (lines 577–580): `'KeyS'`, `'s'`, `'S'`, `'KeyH'`, `'h'`, `'H'` triggers `this.cancelTargeting(); this.dispatch({ type: CommandType.STOP });`.
  - `InputDispatcher.handleKeyDown` (lines 150–153): `'S'`, `'H'` sets `this.targetingSkill = null; return { type: CommandType.STOP };`.
- In `src/game.js` (`GameSimulation.handleCommand`, lines 271–277):
  ```javascript
  case CommandType.STOP: {
    this.playerHero.stop();
    this.playerHero.setAttackTarget(null);
    this.playerHero.attackMoveDestination = null;
    this.playerHero.holdPosition = true;
    break;
  }
  ```
- In `src/entities/entity.js`:
  - `HeroEntity.stop()` (lines 400–405): sets `this.attackTarget = null; this.attackMoveDestination = null; this.holdPosition = true; super.stop();`.
  - `Entity.stop()` (lines 116–126): clears `targetX = null; targetY = null; vx = 0; vy = 0; isMoving = false;` and interrupts recall: `if (this.isRecalling) { this.isRecalling = false; this.recallElapsed = 0; }`.
- In `src/game.js` (`updateHeroCombat`):
  - Line 699: `if (!hero.attackTarget && !hero.isMoving && !hero.isRecalling && !hero.holdPosition)` -> idle target acquisition is suppressed while holding.
  - Line 726: `if (nextEnemy && !hero.holdPosition)` -> combat chaining is suppressed while holding.
  - Line 930: `hero.attackTarget = (nextEnemy && !hero.holdPosition) ? nextEnemy : null;` -> kill chaining is suppressed while holding.

### 1.8 Missing Crowd Control Check in Movement & Pursuit
- In `src/entities/entity.js`:
  - `Entity.canMove(now)` checks stun (`stunnedUntil`) and root (`rootedUntil`).
  - However, in `Entity.update` (line 171) and `updateHeroCombat` pursuit branch (line 764 of `game.js`), `hero.canMove()` is NOT checked before modifying coordinates `(hero.x, hero.y)`.

---

## 2. Logic Chain

1. **Right-Click & Left-Click on Hostile Targets**:
   - `InputManager.pickEntity` accurately unprojects 2.5D coordinates and elevation. Left-click and right-click both dispatch `CommandType.ATTACK_TARGET`.
   - `GameSimulation.handleCommand` correctly routes both `ATTACK_TARGET` and `SELECT` to `hero.setAttackTarget(target)`.
   - In `updateHeroCombat`, the distance check strictly enforces `effectiveRange = hero.attackRange + targetRadius`. If `dist > effectiveRange`, hero advances towards target. If `dist <= effectiveRange`, hero stops moving and attacks periodically.
   - This satisfies Acceptance Criteria "Clicar com botão direito em uma unidade hostil comanda perseguição até o alcance efetivo de ataque e executa ataques básicos periódicos" and "Clicar com botão esquerdo em uma unidade hostil seleciona e ataca o alvo".

2. **Attack Cooldown & Projectile Mechanics**:
   - Melee attacks (`attackRange <= 180`) damage instantly via `applyHeroHit`.
   - Ranged attacks (`attackRange > 180`) spawn homing `HeroProjectile` (speed 750) targeting elevated center of target.
   - Attack cooldown is calculated as `1.0 / hero.attackSpeed`.
   - However, because `ent.update(dt)` decrements `attackCooldown` and `updateHeroCombat(dt, hero)` ALSO decrements `attackCooldown`, attack cooldown drains twice as fast as expected per second. Only one decrement should exist (recommendation: keep in `hero.update(dt)` and remove duplicate decrement from `updateHeroCombat`).

3. **Attack-Move ('A') Mechanics**:
   - Pressing 'A' on ground sets `attackMoveDestination` and initiates movement.
   - While moving, `updateHeroCombat` checks for enemies within `attackRange + 60` (min 280 units).
   - If an enemy is encountered, hero engages and attacks.
   - Logic defect identified: When all enemies in the engagement die, `attackTarget` is set to `null`, but `hero.isMoving` remains `false` with `targetX = null`. The hero does not resume moving toward `attackMoveDestination`.
   - Recommendation: In `updateHeroCombat`, if `hero.attackMoveDestination && !hero.attackTarget`, if no enemies are in acquisition range, the hero should re-issue movement toward `attackMoveDestination`. When arriving within distance threshold (`dist <= 5`), clear `attackMoveDestination = null`.
   - Additionally, `InputDispatcher.handleKeyDown` must support key `'A'` for complete headless and unit test parity.

4. **Target Chaining**:
   - Both in `applyHeroHit` (immediate kill) and in `updateHeroCombat` (tick polling), after a target dies, the system looks for the next nearest enemy within `Math.max(hero.attackRange + 150, 500)`.
   - If found and `!hero.holdPosition`, `attackTarget` immediately switches to that next unit.
   - If `hero.holdPosition` is true, chaining is blocked, hero stays still.
   - This satisfies Acceptance Criterion "Eliminar o alvo transfere o ataque para o inimigo mais próximo no raio de encadeamento se não estiver em Hold/Stop".

5. **Movement, Right-Drag & Ground Deselection**:
   - Clicking ground with right mouse dispatches `MOVE_TO`, which calls `hero.setAttackTarget(null)`, `hero.attackMoveDestination = null`, `hero.holdPosition = false`.
   - Continuous right-click drag is throttled at 80ms, updating destination while protecting active attack commands (`isAttackingTargetDown`).
   - This satisfies Acceptance Criterion "Clicar no chão com botão direito direciona o herói ao ponto clicado e desvincula alvos de ataque".

6. **Stop / Hold Command ('S' or 'H')**:
   - Keys 'S' and 'H' immediately dispatch `STOP`.
   - `sim.handleCommand(STOP)` calls `hero.stop()`, clears `attackTarget = null`, clears `attackMoveDestination = null`, and sets `hero.holdPosition = true`.
   - `hero.stop()` immediately cancels movement vectors and interrupts recall (`isRecalling = false, recallElapsed = 0`).
   - `holdPosition = true` disables idle auto-attack and target chaining.
   - This satisfies Acceptance Criterion "Pressionar 'S' interrompe movimento e combate imediatamente, ativando holdPosition".

---

## 3. Caveats & Dependencies

1. **Hero Death (R1 Interaction)**:
   - When hero dies (`hp <= 0`), `takeDamage` calls `stop()`.
   - `handleCommand` rejects all incoming commands when `!this.playerHero.isAlive()`.
   - `updateHeroCombat` early-exits when `!hero.isAlive()`.
   - However, in `src/game.js` line 984, `this.entities.filter` must be updated (by R1 implementer) to preserve dead heroes (`ent.type === 'hero'`) so that the entity is not destroyed while waiting for the resurrection countdown.
2. **Crowd Control (CC Interaction)**:
   - Silenced units can perform basic attacks (`canAttack` returns true), as verified by `TC-ATK-12`.
   - Stunned units cannot attack (`canAttack` returns false in `updateHeroCombat`).
   - However, during pursuit (line 764 of `game.js`), `canMove()` is not checked. If stunned or rooted while pursuing, the hero continues advancing. A guard `if (hero.canMove && !hero.canMove()) { hero.isMoving = false; return; }` must be added.
3. **Facing / Rotation (R5 Interaction)**:
   - `hero.facing` is snapped in `updateHeroCombat` (`Math.atan2(dy, dx)`).
   - In `executeHeroSkill` (line 445 of `game.js`), `hero.facing` is currently not updated toward `(targetX, targetY)`. Adding `hero.facing = Math.atan2(targetY - hero.y, targetX - hero.x)` will unify facing with skill aim.

---

## 4. Conclusion & Recommended Implementation Plan

The R2 and R3 mechanics are structurally sound and already pass 24 comprehensive unit tests (`tests/unit/player_attack.test.js` TC-ATK-01 through TC-ATK-24).
To achieve complete robustness and full compliance with the authoritative requirements, the following localized refinements are recommended:

### Recommended Plan of Action:
1. **Fix Attack Cooldown Double Decrement**:
   - Remove lines 694–696 in `src/game.js` (`if (hero.attackCooldown > 0) hero.attackCooldown = Math.max(0, hero.attackCooldown - dt);`), because `hero.update(dt)` in `src/entities/entity.js` (line 412) already handles this.
2. **Add 'A' Key Handling to `InputDispatcher`**:
   - In `src/core/input.js` (`InputDispatcher.handleKeyDown`), add:
     ```javascript
     if (upperKey === 'A') {
       if (hoveredEntity && (hoveredEntity.team === 'enemy' || hoveredEntity.isEnemy || hoveredEntity.team === 'neutral')) {
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
     ```
3. **Enhance Attack-Move Continuation & Clearance**:
   - In `src/game.js` (`updateHeroCombat`), if `hero.attackMoveDestination && !hero.attackTarget`:
     - Calculate distance to `attackMoveDestination`. If `dist < 10`, clear `hero.attackMoveDestination = null`.
     - Else if no enemies are found, ensure `hero.isMoving` is true and hero marches towards `attackMoveDestination`.
4. **Guard Pursuit with `canMove()`**:
   - In `src/game.js` (`updateHeroCombat`, line 764):
     ```javascript
     if (hero.canMove && !hero.canMove()) {
       hero.isMoving = false;
       hero.vx = 0;
       hero.vy = 0;
       return;
     }
     ```
5. **Update Hero Facing on Ability Cast**:
   - In `src/game.js` (`executeHeroSkill`, line 449):
     ```javascript
     if (targetX !== hero.x || targetY !== hero.y) {
       hero.facing = Math.atan2(targetY - hero.y, targetX - hero.x);
     }
     ```

---

## 5. Verification Method

### Test Commands
Run the complete unit and e2e test suite:
```bash
npm test
```
Run the dedicated player attack and input tests:
```bash
node tests/runner.js tests/unit/player_attack.test.js
node tests/runner.js tests/unit/input.test.js
```

### Specific Test Cases to Verify
1. **Right-Click Hostile**: `TC-ATK-01`, `TC-ATK-02`, `TC-ATK-18`, `TC-ATK-19`, `TC-ATK-20` (validates pursuit up to `attackRange + targetRadius`, stopping, and executing periodic attacks).
2. **Left-Click Hostile**: `TC-ATK-11` (verifies left-click on enemy minion dispatches `ATTACK_TARGET`).
3. **Attack-Move ('A')**: `TC-ATK-08` (validates attack-move destination and path engagement).
4. **Target Chaining**: `TC-ATK-22`, `TC-ATK-23` (verifies kill chaining to next monster/minion in range).
5. **Hold / Stop ('S'/'H')**: `TC-ATK-07`, `TC-ATK-24`, `TC-INP-06` (verifies immediate halt, clearing targets, and suppression of idle auto-attack and chaining).
6. **Right-Drag Movement**: `TC-ATK-21` (verifies right-drag target protection and move dispatch).

### Invalidation Conditions
- If hero moves during Stop/Hold mode without a new command.
- If hero auto-acquires enemies while `hero.holdPosition === true`.
- If attack cooldown ticks down faster than real-time seconds (`dt`).
- If left-click or right-click fails to acquire elevation-offset targets in 2.5D space.
