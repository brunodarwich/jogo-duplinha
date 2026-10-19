# Handoff Report: Milestone 2 Implementation — Targeting, Attack-Move & Hold/Stop Mechanics

**Agent**: M2 Targeting Worker (`m2_targeting_worker`)  
**Milestone**: Milestone 2 (Target Click, Auto-Attack & Hold/Stop Mechanics)  
**Date**: 2026-10-17T16:04:00Z  

---

## 1. Observation

Direct code examination and execution of tests revealed the following:

1. **Duplicate `attackCooldown` Decrement**:
   In `src/game.js`, `updateHeroCombat` lines 708–711 contained:
   ```javascript
   // Cooldown ticks
   if (hero.attackCooldown > 0) {
     hero.attackCooldown = Math.max(0, hero.attackCooldown - dt);
   }
   ```
   Concurrently, `HeroEntity.update(dt)` in `src/entities/entity.js` (lines 506–508) already executed:
   ```javascript
   if (this.attackCooldown > 0) {
     this.attackCooldown = Math.max(0, this.attackCooldown - dt);
   }
   ```
   Both ran during every simulation frame in `GameSimulation.update(dt)`, causing attack cooldown to decay at $2.0 \times dt$ per second.

2. **Cast Facing Orientation Gap**:
   In `src/game.js`, `executeHeroSkill` lines 458–466 previously lacked any update to `hero.facing` or `hero.targetFacing`. When a player fired a targeted ability, the hero retained their prior movement orientation instead of pivoting toward `(targetX, targetY)`.

3. **Attack-Move Path Freezing & Missing Arrival Clearance**:
   In `src/game.js`, `updateHeroCombat` lines 722–753 and `applyHeroHit` lines 942–946 stopped the hero upon acquiring and attacking an enemy (`isMoving = false; targetX = null; targetY = null;`). When that enemy died and no subsequent enemies remained in chain range, `hero.attackTarget` was cleared, but pathing toward `hero.attackMoveDestination` was never resumed. The hero froze in place with `attackMoveDestination` non-null indefinitely, violating the requirement that arrival within 10 units clears `attackMoveDestination = null` and that pathing resumes toward destination when enemies are cleared.

4. **Crowd Control Bypass in Pursuit**:
   In `src/game.js`, `updateHeroCombat` lines 778–787 directly added velocity and advanced `hero.x += hero.vx * dt` and `hero.y += hero.vy * dt` without verifying `hero.canMove()`. Stunned or rooted heroes continued pursuing out-of-range targets.

5. **Missing 'A' Key Handling in `InputDispatcher`**:
   In `src/core/input.js`, `InputDispatcher.handleKeyDown` lines 113–177 handled `Q, W, E, R`, `S, H`, `B`, and `Escape`, but had no branch for `'A'` or `'KeyA'`, returning `null` for headless attack-move commands.

6. **Automated Test Run Baseline & Regression**:
   Baseline suite had 162 passing tests. After implementing the 1.0x cooldown decrement rate, `TC-ATK-23` in `tests/unit/player_attack.test.js` failed because its inner loop ran only 25 ticks (1.25s), which was calibrated for the 2.0x bug rather than Knight's genuine base cooldown (1.538s). Extending the loop to 35 ticks (1.75s) resolved the test. Full suite now executes 167 tests across 22 test files with 0 failures in 644.8ms.

---

## 2. Logic Chain

1. **Restoring Single-Rate Cooldown Law (Observation 1)**:
   - Cooldown decay belongs to entity lifecycle updates in `HeroEntity.update(dt)`.
   - Removing lines 708–711 in `src/game.js` ensures that `hero.attackCooldown` decreases by exactly $1.0 \times dt$ per frame ($1.0\text{s}/\text{s}$), eliminating the double attack speed bug.

2. **Cast Facing Synchronization (Observation 2)**:
   - In `executeHeroSkill`, whenever `targetX !== hero.x || targetY !== hero.y`, setting `hero.facing = Math.atan2(targetY - hero.y, targetX - hero.x)` immediately pivots the hero toward the skill target.
   - Synchronizing `if ('targetFacing' in hero) hero.targetFacing = hero.facing;` ensures forward compatibility with Milestone 3's smooth facing lerp.

3. **Attack-Move Pathing Continuation & Clearance (Observation 3)**:
   - When `hero.attackMoveDestination` is active and `!hero.attackTarget`:
     - If `distToDest <= 10`, the hero has arrived: clear `attackMoveDestination = null`, stop moving, reset velocity.
     - If `distToDest > 10` and `!hero.holdPosition && !hero.isMoving`, call `hero.moveTo(walkable.x, walkable.y, true)` to resume pathing.
   - When an intermediate enemy target dies in `applyHeroHit` or `updateHeroCombat`, if no secondary enemy is found in chaining range and `!hero.holdPosition`, check `attackMoveDestination`: if within 10 units clear it; otherwise call `hero.moveTo(walkable.x, walkable.y, true)`.

4. **Crowd Control Pursuit Guard (Observation 4)**:
   - Adding `if (hero.canMove && !hero.canMove()) { hero.isMoving = false; hero.vx = 0; hero.vy = 0; return; }` at the beginning of the pursuit branch ensures immobilized or stunned heroes cannot move toward targets while preserving their target reference.

5. **Headless 'A' Dispatch Parity (Observation 5)**:
   - In `InputDispatcher.handleKeyDown`, parsing `upperKey === 'A' || upperKey === 'KEYA'`:
     - Checks hero alive state (returns `null` if dead).
     - If hovering over an enemy or neutral unit, returns `{ type: CommandType.ATTACK_TARGET, targetId: ent.id, targetX: ent.x, targetY: ent.y, targetEntity: ent }`.
     - Otherwise unprojects screen coordinates (or uses hero/camera fallback) and returns `{ type: CommandType.ATTACK_TARGET, targetId: null, targetX: wx, targetY: wy, attackMove: true }`.

6. **Test Calibration & Expansion (Observation 6)**:
   - `TC-ATK-25`: Validates that `hero.attackCooldown` recovers at exactly $1.0\text{s}/\text{s}$ during `sim.update`.
   - `TC-ATK-26`: Validates that attack-move resumes toward destination after slaying intermediate enemies and clears on arrival ($\le 10$ units).
   - `TC-ATK-27`: Validates that stunned/rooted heroes cannot advance toward targets during pursuit.
   - `TC-ATK-28`: Validates that skill casts orient `hero.facing` toward target coordinates.
   - `TC-INP-08`: Validates `InputDispatcher` handling of ground attack-move, direct target attack, and dead hero rejection.
   - `TC-ATK-23`: Calibrated loop ticks from 25 to 35 so the melee hero's genuine 1.54s cooldown can complete before the second strike.

---

## 3. Caveats

No caveats. All requirements from DISPATCH.md and PROJECT.md Milestone 2 have been implemented strictly within exclusive write ownership files without hardcoding or facades.

---

## 4. Conclusion

Milestone 2 implementation is 100% complete:
- Duplicate attack cooldown decrement removed from `src/game.js`.
- Hero facing updated on skill cast in `src/game.js`.
- Attack-move path continuation and arrival clearance implemented across `updateHeroCombat` and `applyHeroHit`.
- Pursuit movement guarded with `hero.canMove()`.
- 'A' key handling implemented in `InputDispatcher.handleKeyDown` in `src/core/input.js`.
- Unit tests `TC-ATK-25` through `TC-ATK-28` and `TC-INP-08` added and passing cleanly.
- Full test suite passes: 167/167 tests passing (0 failures).

---

## 5. Verification Method

### 5.1 Verification Commands
Run the automated test runner:
```bash
npm test
```
Run targeted player attack unit tests:
```bash
node tests/runner.js player_attack
```

### 5.2 Files to Inspect
- `src/game.js`: lines 458–466 (skill cast facing), lines 716–718 (cooldown comment), lines 724–751 (attack-move destination clearance and continuation), lines 770–783 (target death resumption), lines 808–820 (pursuit CC guard), lines 980–1005 (slain target attack-move continuation).
- `src/core/input.js`: lines 113–218 (`InputDispatcher.handleKeyDown` 'A' handling).
- `tests/unit/player_attack.test.js`: lines 5 (import `InputDispatcher`), lines 663–672 (calibrated loop in `TC-ATK-23`), lines 715–929 (tests `TC-ATK-25` through `TC-ATK-28` and `TC-INP-08`).

### 5.3 Invalidation Conditions
- If `hero.attackCooldown` decrements by more than `dt` per simulation tick.
- If an alive hero in attack-move stops permanently after killing an intermediate minion along the path.
- If `hero.attackMoveDestination` remains non-null after the hero arrives within 10 units.
- If a stunned or rooted hero advances world coordinates while pursuing an out-of-range enemy.
- If `InputDispatcher.handleKeyDown('A')` returns `null` for a living hero.
- If `npm test` has any failures.
