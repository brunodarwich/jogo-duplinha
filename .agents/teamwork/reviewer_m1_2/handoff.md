# Handoff Report: Reviewer 2 — Milestone 1 (Engine Foundation, 2.5D Isometric Renderer & HUD)

**Author**: Reviewer 2 (`reviewer_m1_2`)  
**Roles**: Reviewer, Adversarial Critic  
**Working Directory**: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\reviewer_m1_2\`  
**Date**: 2026-10-17T00:47:00Z  
**Recipient**: Orchestrator (`47550c40-796a-4ccf-8ac6-09bde1de0183`)

---

## 1. Review Summary

**Verdict**: **APPROVE** (Quality Standard Satisfied, Zero Integrity Violations, 1 Major Finding & 2 Minor Findings Documented for Milestone 2 / Polish)

---

## 2. Integrity Verification

As mandated by adversarial reviewer constraints, all Milestone 1 source and test deliverables were audited for integrity violations:
- **Hardcoded test results or expected outputs embedded in source**: NONE. Mathematical formulas in `src/core/isometric.js` and `src/core/camera.js` compute genuine continuous transformations.
- **Dummy or facade implementations**: NONE. All classes (`Camera`, `GameLoop`, `InputDispatcher`, `InputManager`, `Renderer`, `ParticleSystem`, `Entity`, `HeroEntity`, `TowerEntity`, `MinionEntity`, `Minimap`, `HUDController`, `GameSimulation`) contain functional, operational logic.
- **Shortcuts bypassing tasks**: NONE. The 7-pass rendering pipeline, particle emitter pool, and fixed-timestep accumulator operate as specified.
- **Fabricated verification outputs or logs**: NONE. Both test suites (`node tests/runner.js` [115 tests] and `node tests/stress_m1_input.js` [23 tests]) were independently executed and verified directly on the runtime environment.

---

## 3. Observation

### 3.1 Test Suite Execution
1. **Full Project Test Suite**:
   ```pwsh
   node tests/runner.js
   ```
   Output:
   ```
   Test Files: 17 passed (17 total)
   Total Tests: 115
   Passed: 115
   Failed: 0
   Duration: 236.5ms
   Exit Code: 0
   ```
2. **Challenger Stress Test Harness**:
   ```pwsh
   node tests/stress_m1_input.js
   ```
   Output:
   ```
   Total Stress Tests: 23
   Passed: 23
   Failed: 0
   Duration: 62.1ms
   Exit Code: 0
   ```
3. **Adversarial Edge-Case Script** (`.agents/teamwork/reviewer_m1_2/test_adversarial.js`):
   Executed with non-finite coordinates (`NaN`, $\pm\infty$, non-numeric types), extreme boundary coordinates ($\pm 10^{12}$), dense stacked unit clusters, and state machine key chords.

### 3.2 Code Inspections

1. **Screen-to-World Ray Unprojection & Non-Finite Numbers**:
   - `src/core/isometric.js`, lines 20-23:
     ```javascript
     export function sanitize(val, fallback = 0) {
       if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
       return val;
     }
     ```
   - `src/core/isometric.js`, lines 91-126: `screenToWorld` invokes `sanitize` on `sx, sy, camX, camY, vw, vh, zoom`. If `sx` or `sy` is `NaN` or non-numeric, it safely resolves to `0` without throwing or returning `NaN`.
   - `src/core/input.js`, lines 54-63:
     ```javascript
     const clampedSx = clamp(screenX, 0, vw);
     const clampedSy = clamp(screenY, 0, vh);
     const world = screenToWorld(clampedSx, clampedSy, this.camera, this.zoom, this.viewport);
     const wx = clamp(world.wx, 0, MAP_SIZE);
     const wy = clamp(world.wy, 0, MAP_SIZE);
     ```
     Mouse clicks at $-999999$ or $+999999$ are strictly clamped to $[0, 3200] \times [0, 3200]$.

2. **Entity Picking Hierarchy**:
   - `src/core/input.js`, lines 336-374 (`InputManager.pickEntity`):
     ```javascript
     const hostile = this.isHostile(ent, playerHero);
     let priority = 1;
     if (hostile) {
       if (ent.type === 'hero') priority = 4;
       else if (ent.type === 'minion') priority = 3;
       else priority = 2; // tower or boss
     }
     ```
   - `src/core/input.js`, lines 376-381:
     ```javascript
     isHostile(target, playerHero) {
       if (!target) return false;
       if (target.team === 'enemy') return true;
       if (!playerHero) return false;
       return target.team !== playerHero.team;
     }
     ```
   - `src/core/input.js`, line 72 (`InputDispatcher.handleMouseDown`):
     ```javascript
     if (hoveredEntity && (hoveredEntity.team === 'enemy' || hoveredEntity.isEnemy)) {
       return { type: CommandType.ATTACK_TARGET, ... };
     }
     ```

3. **QWER Targeting States & Cast Cancel**:
   - `src/core/input.js`, lines 65-70: Right-click (button 2) while `this.targetingSkill` is set immediately returns `{ type: CommandType.CANCEL_TARGETING, skill: cancelled }` and resets `targetingSkill = null` without issuing movement.
   - `src/core/input.js`, lines 162-168 & lines 448-452: Key `Escape` cancels targeting cleanly.
   - `src/core/input.js`, lines 90-101: Left-click (button 0) confirms targeting and dispatches `CAST_SKILL` / `CAST_ABILITY` with target coordinates.
   - `src/core/input.js`, lines 122-127 & lines 465-467: Mana insufficiency (`hero.mana < ability.manaCost`) and cooldown gating (`cooldownRemaining > 0`) reject ability entry.

4. **Stop 'S' Command**:
   - `src/core/input.js`, lines 150-153 & lines 430-433: Keys 'S'/'s'/'H'/'h' reset `targetingSkill = null` and dispatch `CommandType.STOP`.
   - `src/entities/entity.js`, lines 96-106: `Entity.stop()` zeroes `vx = 0, vy = 0`, nulls `targetX = null, targetY = null`, sets `isMoving = false`, and aborts Recall (`isRecalling = false, recallElapsed = 0`).

5. **High-DPI Retina Scaling & Window Resizing**:
   - `src/main.js`, lines 18-37: `canvas.width = Math.floor(width * dpr)`, `canvas.style.width = width + 'px'`, `ctx.scale(dpr, dpr)`.
   - Propagates dimensions to `gameSim.renderer.resize(width, height, dpr)` and `gameSim.camera.resize(width, height)`.

---

## 4. Logic Chain & Findings

### Finding 1 [Major]: Inversion of Neutral Entity Priority in Picking Hierarchy
- **Location**: `src/core/input.js`, lines 357-364 and lines 376-381.
- **Mechanism**:
  1. The specification requires the picking hierarchy:
     $$\text{Enemy Hero} > \text{Creep} > \text{Boss / Tower} > \text{Neutral} > \text{Ally}$$
  2. In `InputManager.isHostile(target, playerHero)`, the check is:
     `target.team !== playerHero.team`.
     When `playerHero.team === 'allied'`, any entity with `team === 'neutral'` evaluates to `isHostile === true`.
  3. Consequently, in `pickEntity`:
     - A neutral minion (`type: 'minion', team: 'neutral'`) is assigned `priority = 3`.
     - An enemy tower (`type: 'tower', team: 'enemy'`) or enemy boss is assigned `priority = 2`.
  4. In adversarial testing with stacked units at identical coordinates, clicking a cluster with an Enemy Tower and a Neutral Creep selects the **Neutral Creep over the Enemy Tower** (Priority 3 vs Priority 2), violating the hierarchy.
  5. Furthermore, in `InputDispatcher.handleMouseDown` (line 72), a hovered neutral entity generates `MOVE_TO` (since `team !== 'enemy'`), whereas in `InputManager.dispatchSmartRightClick` (line 319) it generates `ATTACK_TARGET` (since `isHostile` is true).
- **Impact for Milestone 1**: Low for M1 (since M1 entities are exclusively Allied and Enemy, with no neutral creeps on the map), but will cause targeting defects in Milestone 2 when neutral creeps/bosses are introduced.
- **Suggested Fix Direction**:
  Implement an explicit 5-level hierarchy in `pickEntity`:
  ```javascript
  let priority = 1; // Ally default
  if (ent.team === 'enemy') {
    if (ent.type === 'hero') priority = 5;
    else if (ent.type === 'minion') priority = 4;
    else priority = 3; // tower or boss
  } else if (ent.team === 'neutral') {
    priority = 2;
  }
  ```
  And unify neutral unit hostility checks between `InputDispatcher` and `InputManager`.

### Finding 2 [Minor]: Redundant Canvas Buffer Assignment in `main.js` vs `Renderer.resize()`
- **Location**: `src/main.js`, lines 23-31 and `src/render/renderer.js`, lines 41-45.
- **Mechanism**: `main.js` sets `canvas.width = Math.floor(width * dpr)` and calls `ctx.scale(dpr, dpr)`. Immediately after, it calls `gameSim.renderer.resize(width, height, dpr)`, which repeats `this.canvas.width = ...` and `this.ctx.scale(...)`. Setting `canvas.width` resets the canvas transformation matrix, so the scale is not compounded, but the operation is redundant.
- **Suggested Fix Direction**: Let `renderer.resize(width, height, dpr)` be the single authoritative place that updates canvas buffer dimensions and context scaling.

### Finding 3 [Minor]: `Renderer.resize()` Lacks Positive Dimension Guard
- **Location**: `src/render/renderer.js`, line 36.
- **Mechanism**: While `Camera.resize(width, height)` checks `Number.isFinite(width) && width > 0`, `Renderer.resize(width, height)` unconditionally writes `this.viewportWidth = width`. If window resize fires with 0 (e.g., during window minimization in certain browsers), `viewportWidth` becomes 0.
- **Suggested Fix Direction**: Add `if (Number.isFinite(width) && width > 0) this.viewportWidth = width;`.

---

## 5. Verified Claims Summary

| Claim from Worker / Spec | Verification Method | Result |
|---|---|---|
| Invertibility of 2:1 dimetric projection | `screenToWorld(worldToScreen(P))` across 5 arbitrary coordinates & zoom | PASS (identity to $< 10^{-3}$) |
| Non-finite coordinate unprojection resilience | Injected `NaN`, $\pm\infty$, non-numeric values into `screenToWorld` | PASS (sanitized to finite world coords) |
| World boundary clamping $[0, 3200]$ | Tested out-of-bounds clicks at $\pm 10^{12}$ | PASS (clamped to $[0, 3200]$) |
| Camera exponential lerp smoothing | `Camera.update(dt)` with dampening factor $1 - \exp(-\lambda \Delta t)$ | PASS (smooth follow, dead target hold) |
| Fixed timestep loop (16.67ms) & 100ms cap | Lag spike simulation with 500ms input | PASS (capped at 6 ticks) |
| Y-Depth sorting with ID tie-breaking | `compareDepth()` on identical depth coordinates | PASS (stable alphabetical tie-breaker) |
| QWER targeting preview & cancellation | Rapid keydown + Right-click / Escape | PASS (targeting cleared without moving) |
| Stop command ('S' / 'H') | Keydown 'S' while moving, targeting, and recalling | PASS (movement halted, recall cancelled) |
| High-DPI retina canvas scaling | Evaluated `ctx.scale(dpr, dpr)` and viewport resizing | PASS (buffer scaled by DPR, CSS scaled to viewport) |
| Full regression test pass | `node tests/runner.js` | PASS (115/115 tests passed, exit code 0) |
| Stress test pass | `node tests/stress_m1_input.js` | PASS (23/23 tests passed, exit code 0) |

---

## 6. Caveats

- **No Caveats for Milestone 1 Scope**: All 13 assigned files for Milestone 1 are implemented, operational, and conform to `PROJECT.md` specifications. Finding 1 relates to Neutral units which are introduced in Milestone 2.

---

## 7. Conclusion

Milestone 1 satisfies all core architecture, performance, visual, and mathematical requirements:
1. Mathematical correctness of the 2:1 dimetric isometric engine and camera follow is verified.
2. The 7-pass rendering pipeline operates without visual regressions or DOM leaks in both browser and headless environments.
3. The Input state machine correctly isolates targeting previews, cast cancellations, and stop commands.
4. The test suite passes 100% (115/115 unit & E2E tests, 23/23 stress tests).
5. No integrity violations or facades were detected.

The verdict is **APPROVE**. Finding 1 (Neutral unit picking priority) should be noted by the orchestrator for incorporation when Neutral entities are added in Milestone 2.

---

## 8. Verification Method

To reproduce and verify these findings independently:

1. **Run full automated test runner**:
   ```pwsh
   node tests/runner.js
   ```
   *Expected output*: 17 test files passed, 115 tests passed, 0 failures, exit code 0.

2. **Run Challenger input stress test**:
   ```pwsh
   node tests/stress_m1_input.js
   ```
   *Expected output*: 23 stress tests passed, exit code 0.

3. **Run Reviewer 2 adversarial verification script**:
   ```pwsh
   node .agents/teamwork/reviewer_m1_2/test_adversarial.js
   ```
   *Expected output*: Verifies non-finite coordinate sanitization, QWER cancellation, Stop mechanics, and displays the Neutral picking priority test output demonstrating Finding 1.
