# Dispatch: M3 Zoom & Rotation Worker — Implementation of R4 & R5 Core Mechanics

## Identity
- Role: Implementation Worker
- Working directory: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m3_zoom_worker\
- Parent Orchestrator: orchestrator_r2

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Mandatory Input Documents
- Authoritative User Request: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\ORIGINAL_REQUEST.md` (read `## 2026-10-17T14:55:25Z`)
- Master Plan: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\orchestrator_r2\PROJECT.md`
- Survey Explorer 3 Report: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\survey_explorer_r2_3\handoff.md`

## Exclusive Write Ownership
You have exclusive write access to:
1. `src/core/isometric.js`
2. `src/core/camera.js`
3. `src/core/input.js`
4. `src/entities/entity.js`
5. `src/game.js`
6. `tests/unit/zoom.test.js`
7. `tests/unit/rotation.test.js`

## Implementation Tasks
1. `src/core/isometric.js`:
   - In `worldToScreen` and `screenToWorld`: change default parameter from `zoom = 1.0` to `zoom = null`.
   - Resolve `effectiveZoom = sanitize(zoom ?? camera?.zoom, 1.0)`.
   - Support camera perspective rotation $\theta = camera.rotation || camera.angle || 0$:
     - In `worldToScreen`:
       $dx = safeWx - camX$, $dy = safeWy - camY$.
       $rx = dx \cos\theta - dy \sin\theta$, $ry = dx \sin\theta + dy \cos\theta$.
       $isoX = (rx - ry) \times 0.5$, $isoY = (rx + ry) \times 0.25 - safeWz$.
       $sx = isoX \times s + vw / 2$, $sy = isoY \times s + vh / 2$.
     - In `screenToWorld`:
       $xp = (safeSx - vw / 2) / s$, $yp = (safeSy - vh / 2) / s$.
       $rx = xp + 2 \times yp$, $ry = 2 \times yp - xp$.
       $dx = rx \cos\theta + ry \sin\theta$, $dy = -rx \sin\theta + ry \cos\theta$.
       $wx = camX + dx$, $wy = camY + dy$.
       (Preserving exact 1:1 round-trip identity).
   - In `getDepthKey(wx, wy, camera)` and `compareDepth(a, b, camera)`: when $\theta \neq 0$, use $rx + ry$ along the rotated camera axis.
2. `src/core/camera.js`:
   - Add zoom limits: `this.minZoom = 0.6; this.maxZoom = 1.6;`.
   - Add `this.targetZoom = this.zoom;` and methods `setZoom(z)` (clamping to `[0.6, 1.6]`), `zoomBy(delta)`.
   - In `update(dt)`: smoothly interpolate `this.zoom` towards `this.targetZoom` via exponential decay: `this.zoom += (this.targetZoom - this.zoom) * (1 - Math.exp(-12.0 * dt));`.
   - Add perspective rotation: `this.rotation = 0; this.targetRotation = 0;` and methods `setRotation(angle)`, `rotatePerspective(step)`, `cyclePerspective()`.
   - In `update(dt)`: smooth lerp for `this.rotation` towards `this.targetRotation`.
3. `src/core/input.js`:
   - In `bindEvents()` and `unbindEvents()`: attach non-passive `'wheel'` event listener on canvas.
   - Implement `handleWheel(e)`: `e.preventDefault()`, adjust zoom via `camera.zoomBy`, and recalculate cursor world coordinates.
   - In `InputDispatcher`: dynamically resolve `effectiveZoom = this.camera?.zoom ?? this.zoom ?? 1.0`.
   - Add key 'C' / 'V' binding in `handleKeyDown` to dispatch `CYCLE_PERSPECTIVE`.
   - In `InputManager.update`: when targeting abilities, update `playerHeroRef.targetFacing = Math.atan2(this.worldY - playerHeroRef.y, this.worldX - playerHeroRef.x)`.
4. `src/entities/entity.js`:
   - In `Entity`: add `this.targetFacing = options.facing ?? 0;` and `this.turnSpeed = options.turnSpeed ?? 15.0;`.
   - In `update(dt)`: smooth shortest-arc angular lerp from `this.facing` towards `this.targetFacing`:
     `const diff = Math.atan2(Math.sin(this.targetFacing - this.facing), Math.cos(this.targetFacing - this.facing));`
     `this.facing += Math.sign(diff) * Math.min(Math.abs(diff), this.turnSpeed * dt);`
   - In `moveTo(wx, wy)`: set `this.targetFacing = Math.atan2(wy - this.y, wx - this.x);`.
   - In `HeroEntity.draw`: project forward vector via `worldToScreen` for visual facing notch so it stays aligned under any camera rotation angle.
5. `src/game.js`:
   - In `handleCommand`: handle `CYCLE_PERSPECTIVE` by calling `this.camera.cyclePerspective()`.
6. Unit Tests:
   - Create `tests/unit/zoom.test.js`: validate zoom clamping `[0.6, 1.6]`, exponential lerp, wheel event handling, and 1,000-point round-trip coordinate unprojection at 0.6x, 1.0x, 1.6x.
   - Create `tests/unit/rotation.test.js`: validate smooth facing lerp towards move/target/cast, perspective cycling, rotated coordinate unprojection, and rotated depth sorting.

## Verification
Run tests via:
`npm test`
Verify that all test suites pass with 0 failures.

## Deliverable
Write your report to `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m3_zoom_worker\handoff.md`.
Notify the orchestrator via send_message when finished.


## 2026-10-17T16:06:25Z
You are M3 Zoom & Rotation Worker for Milestone 3 (Dynamic Camera Zoom, Rotation & Perspective) and Milestone 4 (Test Expansion).
Your working directory is: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m3_zoom_worker\
Read assignment at: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m3_zoom_worker\DISPATCH.md
MANDATORY: Read ORIGINAL_REQUEST.md at c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\ORIGINAL_REQUEST.md (header ## 2026-10-17T14:55:25Z).
Read PROJECT.md at c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\orchestrator_r2\PROJECT.md
Read the complete technical blueprint at:
c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\survey_explorer_r2_3\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your exclusive write ownership:
1. src/core/isometric.js
2. src/core/camera.js
3. src/core/input.js
4. src/entities/entity.js
5. src/game.js
6. tests/unit/zoom.test.js
7. tests/unit/rotation.test.js

Your implementation tasks:
1. src/core/isometric.js: default zoom = null in worldToScreen & screenToWorld; camera perspective rotation theta support ((rx, ry) projection and unprojection); depth key rx + ry when rotated.
2. src/core/camera.js: zoom clamping [0.6, 1.6], smooth exponential decay lerp to targetZoom, setZoom, zoomBy, perspective rotation theta & cyclePerspective().
3. src/core/input.js: non-passive wheel event listener on canvas with preventDefault(); handleWheel; InputDispatcher dynamic zoom resolution; key 'C'/'V' cycle perspective dispatch; hero facing on ability aim.
4. src/entities/entity.js: targetFacing and turnSpeed in Entity, smooth angular shortest-arc lerp in update(dt); project visual facing notch via worldToScreen in HeroEntity.draw.
5. src/game.js: handleCommand CYCLE_PERSPECTIVE calling camera.cyclePerspective().
6. tests/unit/zoom.test.js & tests/unit/rotation.test.js: create comprehensive unit test suites covering all R4 & R5 acceptance criteria.

Execute:
npm test
Verify that all test suites pass with 100% clean results (0 failures).

Write your report to: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m3_zoom_worker\handoff.md
Notify the orchestrator via send_message when complete.


## 2026-10-17T16:20:24Z
**Context**: M3 Zoom & Rotation Worker
**Content**: Checking on your progress across the implementation steps (isometric.js, camera.js, input.js, entity.js, game.js, and tests).
**Action**: Please report your current step and status.
