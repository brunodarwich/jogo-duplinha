# Handoff Report: Attack-Move Path Continuation, Destination Arrival Clearance & Pursuit CC Guard

**Role**: M2 Targeting Explorer 2  
**Milestone**: Milestone 2 (Target Click, Auto-Attack & Hold/Stop Mechanics)  
**Target File**: `src/game.js` (with complementary recommendation for `src/entities/entity.js`)  
**Date**: 2026-10-17T15:55:00Z  

---

## 1. Observation

Direct code inspection of `src/game.js`, `src/entities/entity.js`, and `tests/unit/player_attack.test.js` revealed the following exact lines and behaviors:

### 1.1 Attack-Move Destination Path Continuation Defect
In `src/game.js` (`GameSimulation.updateHeroCombat`, lines 722–753):
```javascript
722:     // 2. Attack-move behavior
723:     if (hero.attackMoveDestination && !hero.attackTarget) {
724:       const searchRadius = Math.max(hero.attackRange + 60, 280);
725:       const enemy = this.findNearestEnemy(hero.x, hero.y, searchRadius, hero.team);
726:       if (enemy) {
727:         hero.attackTarget = enemy;
728:       }
729:     }
730: 
731:     // 3. Process current attack target
732:     if (hero.attackTarget) {
733:       let target = hero.attackTarget;
734:       let isTargetAlive = target && (typeof target.isAlive === 'function' ? target.isAlive() : target.hp > 0);
735:       let isUntargetable = target && typeof target.isUntargetable === 'function' && target.isUntargetable();
736: 
737:       if (!isTargetAlive || isUntargetable) {
738:         // Combat Chaining: se o monstro/inimigo atual morreu, encadeia no próximo mais próximo
739:         const chainRadius = Math.max(hero.attackRange + 150, 500);
740:         const nextEnemy = this.findNearestEnemy(hero.x, hero.y, chainRadius, hero.team, target?.team, target?.id);
741:         if (nextEnemy && !hero.holdPosition) {
742:           hero.attackTarget = nextEnemy;
743:           target = nextEnemy;
744:           isTargetAlive = true;
745:           isUntargetable = false;
746:         } else {
747:           hero.attackTarget = null;
748:           hero.isMoving = false;
749:           hero.vx = 0;
750:           hero.vy = 0;
751:           return;
752:         }
753:       }
```
And in `src/game.js` (`applyHeroHit`, lines 942–946):
```javascript
942:       if (hero && hero.attackTarget?.id === target.id) {
943:         const chainRadius = Math.max(hero.attackRange + 150, 500);
944:         const nextEnemy = this.findNearestEnemy(hero.x, hero.y, chainRadius, hero.team, target.team, target.id);
945:         hero.attackTarget = (nextEnemy && !hero.holdPosition) ? nextEnemy : null;
946:       }
```
**Defect Analysis**:
1. When a hero is ordered to Attack-Move (`hero.attackMoveDestination = { x, y }`), the hero moves toward the destination and scans for enemies.
2. When an enemy is acquired (`hero.attackTarget = enemy`), the hero engages. Upon entering attack range (`dist <= effectiveRange`), line 766 sets `hero.isMoving = false; hero.targetX = null; hero.targetY = null; hero.vx = 0; hero.vy = 0;`.
3. When that enemy dies:
   - If no secondary enemy is within `chainRadius`, line 747 in `updateHeroCombat` (or line 945 in `applyHeroHit`) sets `hero.attackTarget = null`.
   - In `updateHeroCombat`, line 748–751 sets `hero.isMoving = false; hero.vx = 0; hero.vy = 0; return;`.
   - On subsequent frames, section 2 (lines 723–729) checks if another enemy is within `searchRadius`. If none is found, **nothing happens**. `hero.isMoving` remains `false`, and `hero.targetX/targetY` remain `null`. The hero freezes in place and never continues walking toward `hero.attackMoveDestination`.

### 1.2 Attack-Move Destination Arrival Clearance Defect
In `src/game.js` (`updateHeroCombat`, lines 722–730) and `src/entities/entity.js` (`Entity.update`, lines 173–195):
- When the hero marches along an Attack-Move path and reaches the vicinity of `attackMoveDestination`, `Entity.update` sets `this.isMoving = false; this.targetX = null; this.targetY = null;` when within step distance.
- However, `hero.attackMoveDestination` is **never cleared** to `null`! It remains an active destination object `{ x: ..., y: ... }` indefinitely on the hero entity until a different command (e.g. `MOVE_TO` or `STOP`) is issued.
- PROJECT.md Interface Contract §2 explicitly requires: *"Arrival within 10 units clears `attackMoveDestination = null`."*

### 1.3 Missing Crowd Control Guard in Pursuit Movement
In `src/game.js` (`updateHeroCombat`, lines 764–788):
```javascript
764:       if (dist <= effectiveRange) {
765:         // Target in range! Stop moving
766:         hero.isMoving = false;
767:         hero.targetX = null;
768:         hero.targetY = null;
769:         hero.vx = 0;
770:         hero.vy = 0;
771: 
772:         // Check if hero can attack (not stunned / silenced)
773:         if (hero.canAttack && hero.canAttack() && hero.attackCooldown <= 0) {
774:           const as = Math.max(0.2, hero.attackSpeed || 0.65);
775:           hero.attackCooldown = 1.0 / as;
776:           this.executeHeroBasicAttack(hero, target);
777:         }
778:       } else {
779:         // Pursue target
780:         const step = hero.speed * dt;
781:         hero.vx = (dx / dist) * hero.speed;
782:         hero.vy = (dy / dist) * hero.speed;
783:         hero.x += hero.vx * dt;
784:         hero.y += hero.vy * dt;
785:         hero.facing = Math.atan2(dy, dx);
786:         hero.isMoving = true;
787:       }
```
**Defect Analysis**:
- While `canAttack()` is checked on line 773 before launching an attack, `hero.canMove()` is **completely unchecked** in the pursuit branch (lines 778–787).
- If the hero is rooted (`hero.rootedUntil > Date.now()`) or stunned (`hero.stunnedUntil > Date.now()`) while pursuing an enemy that is outside `effectiveRange`, lines 783–784 directly modify `hero.x += hero.vx * dt` and `hero.y += hero.vy * dt`.
- The immobilized hero bypasses crowd control and continues pursuing the target.

---

## 2. Logic Chain

1. **Root Cause of Attack-Move Freezing**:
   - When moving towards `attackMoveDestination`, `hero.isMoving` is `true` and `hero.targetX/Y` point to the destination.
   - When an enemy is detected, `hero.attackTarget` becomes non-null. When the hero reaches attack range, `hero.isMoving = false` and `hero.targetX/Y = null`.
   - When the enemy is slain, `hero.attackTarget` is reset to `null`.
   - Without an explicit resumption block, the hero remains stationary (`isMoving = false`, `targetX = null`).
   - Therefore, whenever `hero.attackTarget` becomes `null` while `hero.attackMoveDestination` is still active and `!hero.holdPosition`:
     - If distance to destination `distToDest <= 10`, the hero has reached destination: clear `hero.attackMoveDestination = null; hero.isMoving = false; hero.vx = 0; hero.vy = 0;`.
     - Else (`distToDest > 10`), the hero must resume pathing towards `hero.attackMoveDestination` via `hero.moveTo(walkable.x, walkable.y, true)`.

2. **Tri-Layer Resumption Architecture**:
   To guarantee uninterrupted continuation regardless of how the target was eliminated:
   - **Layer 1 (Direct Kill in `applyHeroHit`)**: If the hero's basic attack or projectile kills the target and no enemies chain, immediately check `attackMoveDestination`. If `distToDest <= 10`, clear destination; otherwise call `hero.moveTo(walkable.x, walkable.y, true)`.
   - **Layer 2 (Tick Polling in `updateHeroCombat` lines 746–752)**: If the target was killed by an external source (turret, minion, allied spell, DoT) or despawned, when `updateHeroCombat` clears `hero.attackTarget = null`, also check `attackMoveDestination` and resume or clear.
   - **Layer 3 (Tick Loop Fallback in `updateHeroCombat` lines 722–730)**: When `hero.attackMoveDestination && !hero.attackTarget`:
     - First, test arrival: if `distToDest <= 10`, clear `attackMoveDestination = null; hero.isMoving = false; hero.targetX = null; hero.targetY = null; hero.vx = 0; hero.vy = 0;`.
     - Otherwise, scan `findNearestEnemy`. If enemy found, lock target. If no enemy found and `!hero.holdPosition && !hero.isMoving`, resume moving via `hero.moveTo(walkable.x, walkable.y, true)`.

3. **Pursuit Crowd Control Invariant**:
   - `HeroEntity` inherits `canMove(now = Date.now())` from `Entity`, which returns `false` if `stunnedUntil > now` or `rootedUntil > now`.
   - Adding `if (hero.canMove && !hero.canMove()) { hero.isMoving = false; hero.vx = 0; hero.vy = 0; return; }` at the very beginning of the pursuit branch (`else` on line 778) guarantees:
     - Rooted/stunned heroes cannot move towards the target.
     - Velocity is immediately zeroed (`vx = 0, vy = 0`) and `isMoving` is marked `false`.
     - Facing angle (`hero.facing`) was already computed on line 762, correctly keeping the hero facing the target they are trying to reach.
     - Rooted heroes in attack range can still attack (because line 764 handles `dist <= effectiveRange`, where `canAttack()` returns `true` for roots).
     - Stunned heroes in attack range cannot attack (because `canAttack()` returns `false` for stuns).

---

## 3. Caveats

1. **Way Walkability**: When resuming movement toward `dest`, `this.map.findNearestWalkable(dest.x, dest.y, hero.radius)` should be used defensively with a fallback `this.map ? this.map.findNearestWalkable(...) : dest` in case unit tests run in headless environments where `sim.map` is omitted or mocked.
2. **Hold / Stop Invariant**: In all resumption paths, `!hero.holdPosition` must be strictly enforced. If a player presses 'S' or 'H', `holdPosition` is set to `true` and `attackMoveDestination` is set to `null`. The hero must never resume autonomous pathing while holding.
3. **General Entity Movement**: In `src/entities/entity.js` (`Entity.update`, line 173), waypoint movement from regular right-click `moveTo` does not check `canMove()`. While the primary requirement is guarding combat pursuit in `src/game.js`, adding a check in `entity.js` ensures complete consistency across all movement types.

---

## 4. Conclusion & Exact Code Replacements

The following exact, copy-paste ready code replacements for `src/game.js` resolve all three assigned issues:

### Change 1: In `src/game.js` — `updateHeroCombat` (Attack-Move Arrival Clearance & Continuation)
**Location**: Replace lines 722–730 in `src/game.js`.

```javascript
<<<<
    // 2. Attack-move behavior
    if (hero.attackMoveDestination && !hero.attackTarget) {
      const searchRadius = Math.max(hero.attackRange + 60, 280);
      const enemy = this.findNearestEnemy(hero.x, hero.y, searchRadius, hero.team);
      if (enemy) {
        hero.attackTarget = enemy;
      }
    }
====
    // 2. Attack-move behavior & destination arrival clearance
    if (hero.attackMoveDestination && !hero.attackTarget) {
      const dest = hero.attackMoveDestination;
      const distToDest = Math.hypot(dest.x - hero.x, dest.y - hero.y);

      // Arrival threshold: arrived within 10 units of destination -> clear destination and stop
      if (distToDest <= 10) {
        hero.attackMoveDestination = null;
        hero.isMoving = false;
        hero.targetX = null;
        hero.targetY = null;
        hero.vx = 0;
        hero.vy = 0;
      } else {
        const searchRadius = Math.max(hero.attackRange + 60, 280);
        const enemy = this.findNearestEnemy(hero.x, hero.y, searchRadius, hero.team);
        if (enemy) {
          hero.attackTarget = enemy;
        } else if (!hero.holdPosition && !hero.isMoving) {
          // Resume pathing towards destination if no enemies encountered
          const walkable = this.map ? this.map.findNearestWalkable(dest.x, dest.y, hero.radius) : dest;
          hero.moveTo(walkable.x, walkable.y, true);
        }
      }
    }
>>>>
```

### Change 2: In `src/game.js` — `updateHeroCombat` (Target Death Resumption)
**Location**: Replace lines 746–752 in `src/game.js`.

```javascript
<<<<
        } else {
          hero.attackTarget = null;
          hero.isMoving = false;
          hero.vx = 0;
          hero.vy = 0;
          return;
        }
====
        } else {
          hero.attackTarget = null;
          hero.isMoving = false;
          hero.vx = 0;
          hero.vy = 0;
          if (hero.attackMoveDestination && !hero.holdPosition) {
            const dest = hero.attackMoveDestination;
            const distToDest = Math.hypot(dest.x - hero.x, dest.y - hero.y);
            if (distToDest <= 10) {
              hero.attackMoveDestination = null;
            } else {
              const walkable = this.map ? this.map.findNearestWalkable(dest.x, dest.y, hero.radius) : dest;
              hero.moveTo(walkable.x, walkable.y, true);
            }
          }
          return;
        }
>>>>
```

### Change 3: In `src/game.js` — `updateHeroCombat` (Pursuit Crowd Control Guard)
**Location**: Replace lines 778–787 in `src/game.js`.

```javascript
<<<<
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
====
      } else {
        // Pursue target
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
>>>>
```

### Change 4: In `src/game.js` — `applyHeroHit` (Immediate Resumption on Direct Kill)
**Location**: Replace lines 942–946 in `src/game.js`.

```javascript
<<<<
      if (hero && hero.attackTarget?.id === target.id) {
        const chainRadius = Math.max(hero.attackRange + 150, 500);
        const nextEnemy = this.findNearestEnemy(hero.x, hero.y, chainRadius, hero.team, target.team, target.id);
        hero.attackTarget = (nextEnemy && !hero.holdPosition) ? nextEnemy : null;
      }
====
      if (hero && hero.attackTarget?.id === target.id) {
        const chainRadius = Math.max(hero.attackRange + 150, 500);
        const nextEnemy = this.findNearestEnemy(hero.x, hero.y, chainRadius, hero.team, target.team, target.id);
        hero.attackTarget = (nextEnemy && !hero.holdPosition) ? nextEnemy : null;

        // Attack-move continuation: resume pathing towards destination if intermediate target died and no chain target
        if (!hero.attackTarget && hero.attackMoveDestination && !hero.holdPosition) {
          const dest = hero.attackMoveDestination;
          const distToDest = Math.hypot(dest.x - hero.x, dest.y - hero.y);
          if (distToDest <= 10) {
            hero.attackMoveDestination = null;
            hero.isMoving = false;
            hero.targetX = null;
            hero.targetY = null;
            hero.vx = 0;
            hero.vy = 0;
          } else {
            const walkable = this.map ? this.map.findNearestWalkable(dest.x, dest.y, hero.radius) : dest;
            hero.moveTo(walkable.x, walkable.y, true);
          }
        }
      }
>>>>
```

### Complementary Recommendation for Worker M2: In `src/entities/entity.js` (`Entity.update`)
In `src/entities/entity.js` line 173, guard waypoint movement with `canMove()`:
```javascript
<<<<
    // Move towards target
    if (this.isMoving && this.targetX !== null && this.targetY !== null) {
      const dx = this.targetX - this.x;
====
    // Move towards target
    if (this.isMoving && this.targetX !== null && this.targetY !== null) {
      if (typeof this.canMove === 'function' && !this.canMove()) {
        this.vx = 0;
        this.vy = 0;
        return;
      }
      const dx = this.targetX - this.x;
>>>>
```

---

## 5. Verification Method

### Test Suite Execution
Run the full test suite to guarantee zero regression:
```bash
npm test
```
Run targeted player attack unit tests:
```bash
node tests/runner.js tests/unit/player_attack.test.js
```

### Formulated Unit Test Specifications (for `tests/unit/player_attack.test.js`)

```javascript
  it('TC-ATK-25: Attack-move resumes pathing to destination after killing enemy and clears on arrival', () => {
    const sim = new GameSimulation({ heroClass: 'knight' });
    const hero = sim.playerHero;
    hero.x = 500;
    hero.y = 500;

    // Intermediate enemy minion with low HP along path
    const enemyMinion = new MinionUnit({
      id: 'path_minion_1',
      team: 'enemy',
      x: 600,
      y: 500,
      hp: 10,
      maxHp: 10
    });
    sim.entities.push(enemyMinion);

    // Issue Attack-Move towards (800, 500)
    sim.handleCommand({
      type: CommandType.ATTACK_TARGET,
      targetId: null,
      targetX: 800,
      targetY: 500,
      attackMove: true
    });

    assertTrue(hero.attackMoveDestination !== null, 'attackMoveDestination set');

    // Tick 1: Hero acquires and engages intermediate enemy
    sim.update(0.05);
    assertEqual(hero.attackTarget?.id, 'path_minion_1', 'Hero acquires path minion');

    // Simulate killing minion
    enemyMinion.hp = 0;
    enemyMinion.isDeadState = true;
    sim.update(0.05);

    // Verify hero resumed moving towards attackMoveDestination
    assertEqual(hero.attackTarget, null, 'No enemies in chain range');
    assertTrue(hero.attackMoveDestination !== null, 'attackMoveDestination preserved');
    assertTrue(hero.isMoving === true, 'Hero resumed moving towards destination');
    assertEqual(hero.targetX, 800, 'targetX restored to destination');
    assertEqual(hero.targetY, 500, 'targetY restored to destination');

    // Teleport hero to within 5 units of destination to simulate arrival
    hero.x = 798;
    hero.y = 500;
    sim.update(0.05);

    // Destination cleared within 10 units threshold and hero halts
    assertEqual(hero.attackMoveDestination, null, 'attackMoveDestination cleared on arrival within 10 units');
    assertEqual(hero.isMoving, false, 'Hero stops upon arrival');
    assertEqual(hero.vx, 0, 'Velocity X is 0');
    assertEqual(hero.vy, 0, 'Velocity Y is 0');
  });

  it('TC-ATK-26: Rooted or stunned hero cannot pursue out-of-range target', () => {
    const sim = new GameSimulation({ heroClass: 'knight' });
    const hero = sim.playerHero;
    hero.x = 1000;
    hero.y = 1000;

    // Distant enemy (300 units away, effectiveRange ~150)
    const distantEnemy = new MinionUnit({
      id: 'distant_enemy_cc',
      team: 'enemy',
      x: 1300,
      y: 1000,
      hp: 200
    });
    sim.entities.push(distantEnemy);

    // Order attack on distant enemy
    sim.handleCommand({
      type: CommandType.ATTACK_TARGET,
      targetEntity: distantEnemy,
      targetId: distantEnemy.id
    });

    // Apply Root CC to hero for 5000ms
    const now = Date.now();
    hero.rootedUntil = now + 5000;

    // Run simulation tick
    sim.update(0.05);

    // Hero must NOT pursue while rooted
    assertEqual(hero.x, 1000, 'Rooted hero X must remain stationary');
    assertEqual(hero.y, 1000, 'Rooted hero Y must remain stationary');
    assertEqual(hero.isMoving, false, 'Hero isMoving must be false while rooted');
    assertEqual(hero.vx, 0, 'Hero vx must be 0');
    assertEqual(hero.vy, 0, 'Hero vy must be 0');
    // Facing should still orient towards target
    assertTrue(Math.abs(hero.facing) < 0.01, 'Hero faces toward the target (angle 0 rad)');

    // Clear root and verify pursuit resumes
    hero.rootedUntil = 0;
    sim.update(0.05);
    assertTrue(hero.x > 1000, 'Hero pursues target after root expires');
    assertTrue(hero.isMoving === true, 'Hero isMoving is true after root expires');
  });
```

### Invalidation Conditions
- If hero does not resume moving toward `attackMoveDestination` after killing an intermediate minion along the path.
- If `attackMoveDestination` remains non-null after hero reaches the clicked destination coordinate.
- If a rooted or stunned hero modifies its world coordinates `(x, y)` when pursuing an out-of-range target.
- If any of the 162 existing tests fail.
