# Project: 2.5D Isometric MOBA — Core Mechanics Consolidation (R1–R6)

## Architecture

### System Architecture Overview
The 2.5D Isometric MOBA game runs on HTML5 Canvas 2D and modern ES Modules with fixed 60 FPS simulation loop.
This consolidation phase enhances the core gameplay loop across 6 critical pillars:
1. **Hero Death & Resurrection Lifecycle**: Entities preserved in simulation, scaling countdown ($4 + L$), actions disabled, fountain respawn at $(400, 400)$ with full HP/Mana.
2. **Targeting & Combat System**: Right-click & left-click pursuit up to $R_{\text{attack}} + R_{\text{target}}$, single attack cooldown recovery per second, Attack-Move ('A') handling & path continuation, intelligent kill chaining.
3. **Movement & Hold/Stop**: Continuous right-drag pathing, immediate action cancellation on 'S'/'H' keypress with `holdPosition = true`.
4. **Camera Viewport & Unprojection**: Smooth mouse wheel zoom clamped to $[0.6\times, 1.6\times]$ with mathematically exact `screenToWorld` ray unprojection at any zoom level.
5. **Directional Rotation & Perspective**: Smooth hero `facing` angular lerp tracking movement, targets, and skill aim; rotated dimetric projection/unprojection ($rx, ry$) with perspective cycling.
6. **Automated Verification**: Complete regression safety maintaining 100% pass rate across baseline tests and new unit test suites.

```
       [ InputManager / InputDispatcher ] (Clicks, Wheel [0.6x-1.6x], 'S'/'H', 'A', 'C')
                       │
                       ▼
            [ GameSimulation Loop ] ──────────┐
      (Fixed 60 FPS, Command Dispatch)         │
          │                       │            ▼
          ▼                       ▼       [ Camera & Isometric Math ]
    [ HeroEntity ]          [ Combat ]    (worldToScreen, screenToWorld,
 (Death/Respawn,         (Pursuit Range,   Zoom Lerp, Rotated Dimetric)
  Facing Lerp,            Single Cooldown,     │
  Hold Position)          Kill Chaining)       ▼
          │                               [ 7-Pass Renderer ]
          ▼                             (Depth Sorting rx + ry,
     [ HUD / UI ]                        Visual Facing Notch,
  (Death Overlay &                        Death VFX/Indicators)
   Countdown Timer)
```

---

## Feature Inventory

Every feature from user request `## 2026-10-17T14:55:25Z` and survey reports is assigned to a milestone.

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Hero Entity Array Retention | Dead heroes preserved in `sim.entities` via filter update | M1 | R1 Spec §1.1 |
| 2 | Level-Scaling Respawn Formula | $4s + 1s \times \text{level}$ duration calculation | M1 | R1 Spec §1.2 |
| 3 | Death State Lifecycle | `HeroEntity` enters dead state, decrements timer, cleanses CC | M1 | R1 Spec §1.2 |
| 4 | Action & Collision Rejection | Move, attack, cast rejected during death; collisions bypassed | M1 | R1 Spec §1.3 |
| 5 | Fountain Respawn at (400, 400) | Full HP/Mana restoration, CC clean, coordinate teleport | M1 | R1 Spec §1.5 |
| 6 | Death Timer HUD Overlay | `#death-timer-overlay` modal & countdown timer in HUD | M1 | R1 Spec §1.6 |
| 7 | Target Click Pursuit | Pursuit up to $R_{\text{attack}} + R_{\text{target}}$ on right/left click | M2 | R2 Spec §1.1 |
| 8 | Single Cooldown Decrement | Eliminate duplicate `attackCooldown` decrement in `game.js` | M2 | R2 Spec §1.3 |
| 9 | 'A' Key Attack-Move Dispatch | Add key 'A' handling in `InputDispatcher.handleKeyDown` | M2 | R2 Spec §1.4 |
| 10 | Attack-Move Path Continuation | Resume pathing when target dies; clear destination on arrival | M2 | R2 Spec §1.4 |
| 11 | Intelligent Kill Chaining | Retarget nearest enemy in range on kill if not holding | M2 | R2 Spec §1.5 |
| 12 | Continuous Right-Drag Movement | 80ms throttled drag pathing with attack target protection | M2 | R2 Spec §1.6 |
| 13 | Hold / Stop Command ('S'/'H') | Immediate halt, clear targets, cancel recall, set `holdPosition` | M2 | R3 Spec §1.7 |
| 14 | Pursuit Crowd Control Guard | Guard pursuit movement with `hero.canMove()` | M2 | R2 Spec §1.8 |
| 15 | Cast Direction Facing Update | Update `hero.facing` toward target point when casting skills | M2 | R2 Spec §1.8 |
| 16 | Unprojection Parameter Fix | Change default `zoom = null` in `worldToScreen` & `screenToWorld` | M3 | R4 Spec §1.1 |
| 17 | Camera Zoom Bounds & Lerp | Clamp zoom to $[0.6, 1.6]$ with exponential decay lerp in Camera | M3 | R4 Spec §1.2 |
| 18 | Wheel Event Listener on Canvas | Attach non-passive wheel listener with `preventDefault()` | M3 | R4 Spec §1.3 |
| 19 | Hero Smooth Directional Facing | Angular lerp for `facing` with `targetFacing` and `turnSpeed` | M3 | R5 Spec §1.1 |
| 20 | Rotated Dimetric Projection | Rotate coordinate vectors $(rx, ry)$ preserving 1:1 round-trip | M3 | R5 Spec §1.4 |
| 21 | Perspective Rotation Cycling | Hotkey 'C'/'V' cycle perspective without breaking controls/depth | M3 | R5 Spec §1.4 |
| 22 | Respawn Unit Test Suite | `tests/unit/respawn.test.js` validating all R1 acceptance criteria | M4 | R6 Spec §1.6 |
| 23 | Zoom & Unprojection Test Suite | `tests/unit/zoom.test.js` validating all R4 acceptance criteria | M4 | R6 Spec §1.6 |
| 24 | Rotation & Perspective Test Suite | `tests/unit/rotation.test.js` validating all R5 acceptance criteria | M4 | R6 Spec §1.6 |
| 25 | Full Test Suite 100% Pass Rate | All 147 baseline tests + new unit tests passing cleanly | M4 | R6 Spec §1.6 |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Hero Death & Resurrection System (R1) | Features 1–6 (`heroes.js`, `entity.js`, `game.js`, `hud.js`, `index.html`, `style.css`) | Survey | DONE |
| M2 | Target Click, Auto-Attack & Hold/Stop (R2, R3) | Features 7–15 (`input.js`, `game.js`, `entity.js`) | M1 | DONE |
| M3 | Dynamic Camera Zoom, Rotation & Perspective (R4, R5) | Features 16–21 (`isometric.js`, `camera.js`, `input.js`, `entity.js`, `game.js`) | M2 | DONE |
| M4 | Test Suite Expansion & Integrity Verification (R6) | Features 22–25 (`tests/unit/*.test.js`, runner.js, full suite) | M1, M2, M3 | DONE |

---

## Interface Contracts

### 1. Hero Death & Respawn Lifecycle
- `calculateRespawnTime(level: number = 1): number`
  - Formula: `4.0 + Math.max(1, Math.floor(level)) * 1.0`
- `HeroEntity` state:
  - `respawnTimer: number` (seconds remaining)
  - `respawnDuration: number` (total initial duration)
  - `die()`: clamps HP to 0, sets `isDeadState = true`, stops movement, clears attack targets, cancels recall, sets `respawnTimer = calculateRespawnTime(level)`.
  - `respawn()`: sets coordinates to Allied Fountain `(400, 400)`, resets velocity, restores `hp = maxHp` and `mana = maxMana`, resets `isDeadState = false`, resets CC timers to 0, resets `holdPosition = false`.
- Entity cleanup in `sim.update`:
  - `if (ent.type === 'tower' || ent.type === 'nexus' || ent.type === 'hero') return true;`

### 2. Targeting, Combat & Stop/Hold
- Cooldown recovery:
  - Only `HeroEntity.update(dt)` decrements `this.attackCooldown = Math.max(0, this.attackCooldown - dt);`.
  - Duplicate decrement in `GameSimulation.updateHeroCombat` removed.
- Attack-Move:
  - `InputDispatcher.handleKeyDown` supports upperKey `'A'` -> returns `CommandType.ATTACK_TARGET`.
  - If target dies and no enemies in range, hero resumes moving towards `attackMoveDestination`.
  - Arrival within 10 units clears `attackMoveDestination = null`.
- Stop/Hold:
  - Key 'S' or 'H' sets `hero.holdPosition = true`, `hero.stop()`, `hero.attackTarget = null`, `hero.attackMoveDestination = null`.
  - While `hero.holdPosition === true`, idle acquisition and kill chaining are disabled.

### 3. Camera Zoom & Isometric Rotation
- Isometric signatures:
  - `worldToScreen(wx, wy, wz = 0, camera = null, zoom = null, ...)`
  - `screenToWorld(sx, sy, camera = null, zoom = null, ...)`
  - Parameter resolution: `effectiveZoom = sanitize(zoom ?? camera?.zoom, 1.0)`.
- Perspective Rotation $\theta = camera.rotation || 0$:
  - $dx = wx - camWx$, $dy = wy - camWy$.
  - $rx = dx \cos\theta - dy \sin\theta$, $ry = dx \sin\theta + dy \cos\theta$.
  - $sx = (rx - ry) \times 0.5 \times s + vw / 2$, $sy = ((rx + ry) \times 0.25 - wz) \times s + vh / 2$.
  - Invertible: $screenToWorld(worldToScreen(wx, wy)) \equiv (wx, wy)$.
- Depth sorting key:
  - `getDepthKey(wx, wy, camera)`: if $\theta \neq 0$, returns $rx + ry$; otherwise $wx + wy$.

---

## Code Layout & File Write Ownership

| Milestone | Worker Exclusive Write Ownership |
|-----------|----------------------------------|
| M1 | `src/entities/heroes.js`, `src/entities/entity.js`, `src/game.js`, `src/ui/hud.js`, `index.html`, `style.css` |
| M2 | `src/core/input.js`, `src/game.js`, `src/entities/entity.js` |
| M3 | `src/core/isometric.js`, `src/core/camera.js`, `src/core/input.js`, `src/entities/entity.js`, `src/game.js` |
| M4 | `tests/unit/respawn.test.js`, `tests/unit/zoom.test.js`, `tests/unit/rotation.test.js` |
