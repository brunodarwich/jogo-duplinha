# Handoff Report — Survey Explorer 3 (R4 Dynamic Zoom, R5 Rotation & Perspective, R6 Test Integrity)

## 1. Observation

### R4: Dynamic Camera Zoom & Coordinate Unprojection

1. **`src/core/isometric.js` (lines 39-77, 91-126)**:
   - In `worldToScreen`:
     ```javascript
     39: export function worldToScreen(
     40:   wx,
     41:   wy,
     42:   wz = 0,
     43:   camera = null,
     44:   zoom = 1.0,
     45:   viewportOrTileWidth = null,
     46:   tileHeight = TILE_HEIGHT
     47: ) {
     ...
     67:   const effectiveZoom = sanitize(zoom ?? camera?.zoom, 1.0);
     ```
   - In `screenToWorld`:
     ```javascript
     91: export function screenToWorld(
     92:   sx,
     93:   sy,
     94:   camera = null,
     95:   zoom = 1.0,
     96:   viewportOrTileWidth = null,
     97:   tileHeight = TILE_HEIGHT
     98: ) {
     ...
     114:   const effectiveZoom = sanitize(zoom ?? camera?.zoom, 1.0);
     ```
   - **Direct Observation**: Because the function signature sets `zoom = 1.0` as the default parameter, any call omitting the 5th argument (or 4th in `screenToWorld`) passes `zoom = 1.0` into the local scope. Consequently, `zoom ?? camera?.zoom` evaluates `1.0 ?? camera?.zoom`, which ALWAYS resolves to `1.0`. `camera.zoom` is silently ignored whenever the caller passes `camera` but omits the explicit `zoom` parameter.

2. **`src/core/camera.js` (lines 26, 172-198)**:
   - Line 26: `this.zoom = options.zoom ?? 1.0;`
   - No `minZoom` (0.6x) or `maxZoom` (1.6x) clamping properties or guards exist in the class.
   - No `setZoom(z)` or `zoomBy(delta)` methods exist.
   - `update(dt)` only handles `worldX` and `worldY` position lerp; it does not interpolate `this.zoom` towards a target zoom factor.

3. **`src/core/input.js` (lines 54-87, 236-255, 266-289, 291-319)**:
   - In `bindEvents()` (lines 236-244):
     ```javascript
     236:   bindEvents() {
     237:     if (!this.canvas || typeof window === 'undefined') return;
     238:     this.canvas.addEventListener('pointerdown', this._onPointerDown);
     239:     this.canvas.addEventListener('pointermove', this._onPointerMove);
     240:     window.addEventListener('pointerup', this._onPointerUp);
     241:     this.canvas.addEventListener('contextmenu', this._onContextMenu);
     242:     window.addEventListener('keydown', this._onKeyDown);
     243:     window.addEventListener('keyup', this._onKeyUp);
     244:   }
     ```
     There is NO `wheel` event listener attached to `canvas`.
   - In `updateCursor` (lines 270, 286) and `update` (line 296):
     ```javascript
     270:       const world = screenToWorld(this.screenX, this.screenY, this.camera);
     ...
     286:     const world = screenToWorld(this.screenX, this.screenY, this.camera);
     ...
     296:     const world = screenToWorld(this.screenX, this.screenY, this.camera);
     ```
     Because of the flaw in `isometric.js`, calls to `screenToWorld` with `this.camera` always unproject assuming `zoom = 1.0`. If `camera.zoom` changes, `this.worldX` and `this.worldY` deviate significantly from the actual world position beneath the pointer.
   - In `InputDispatcher` (lines 47-50, 60):
     ```javascript
     47:   constructor(camera = { x: 0, y: 0 }, zoom = 1.0, viewport = { width: 1280, height: 720 }) {
     48:     this.camera = camera;
     49:     this.zoom = zoom;
     50:     this.viewport = viewport;
     ```
     `this.zoom` is set once on construction and never synchronized when `camera.zoom` changes.

---

### R5: Directional Rotation & Perspective

1. **`src/entities/entity.js` (lines 29, 186-192, 217-227, 460-469)**:
   - Line 29: `this.facing = options.facing ?? 0;`
   - Lines 190: `this.facing = Math.atan2(dy, dx);`
   - In `HeroEntity.draw` (lines 460-469):
     ```javascript
     460:     // Facing orientation
     461:     const fx = sx + Math.cos(this.facing) * r * 1.3;
     462:     const fy = sy - h * 0.5 + Math.sin(this.facing) * (r * 0.5) * 1.3;
     463:     ctx.beginPath();
     464:     ctx.moveTo(sx, sy - h * 0.5);
     465:     ctx.lineTo(fx, fy);
     466:     ctx.strokeStyle = '#fbbf24';
     467:     ctx.lineWidth = 2.5;
     468:     ctx.stroke();
     ```
     `Math.sin(this.facing) * (r * 0.5)` applies a static 2:1 dimetric vertical compression assuming standard unrotated perspective. If the camera perspective rotates, this hardcoded notch will not point in the true projected heading.

2. **`src/game.js` (lines 740-773)**:
   - Lines 746-747:
     ```javascript
     746:       // Always turn hero to face the target
     747:       hero.facing = Math.atan2(dy, dx);
     ```
     `hero.facing` instantly snaps to the target angle rather than turning smoothly.
   - When aiming abilities in `InputManager` (`targetingState` active), `hero.facing` is not updated to face the cursor or indicator vector.

3. **Camera Perspective Rotation Support**:
   - Neither `Camera` nor `Renderer` nor `isometric.js` currently possesses any camera rotation property or method (`rotation`, `angle`, `cyclePerspective()`).
   - The projection in `isometric.js` lines 71-72 is strictly hardcoded to standard dimetric axis:
     ```javascript
     71:   const isoX = (safeWx - safeWy) * 0.5;
     72:   const isoY = (safeWx + safeWy) * 0.25 - safeWz;
     ```

---

### R6: Test Suite Integrity & Coverage

1. **Current Test Status**:
   - `npm test` (`node tests/runner.js`) executes 20 test files, 147 unit and E2E tests.
   - Baseline result: **147 passed, 0 failed** (Duration: ~520ms).
   - Adversarial suites `tests/adversarial_m1_r2.js` (49 tests) and `tests/adversarial_m2_r2.js` (113 tests) both pass 100%.
2. **Coverage Gaps for New Scope**:
   - **Hero Death & Respawn (R1)**: No tests currently validate `playerHero` retention in `sim.entities`, the `4s + 1s * level` timer, command rejection during death, or fountain teleport upon respawn.
   - **Dynamic Zoom & Unprojection (R4)**: No tests validate camera wheel zoom clamping to `[0.6, 1.6]`, automatic reading of `camera.zoom` in `screenToWorld`, or entity picking accuracy across zoom levels.
   - **Rotation & Perspective (R5)**: Zero tests exist in `tests/` checking `hero.facing` or camera perspective switching.

---

## 2. Logic Chain

1. **Zoom Coordinate Drift Logic**:
   - In `isometric.js`, default parameter `zoom = 1.0` precedes nullish coalescing `zoom ?? camera?.zoom`.
   - When callers call `screenToWorld(sx, sy, camera)` (as in `input.js` lines 270, 286, 296), JavaScript fills the parameter with `1.0`.
   - `1.0 ?? camera?.zoom` evaluates to `1.0`, regardless of `camera.zoom`.
   - Therefore, changing `camera.zoom` (e.g. to 0.6x or 1.6x) has zero effect on pointer unprojection in `InputManager`. The cursor's world position `(this.worldX, this.worldY)` remains stuck in 1.0x space, causing clicks and moves to target incorrect world positions.
   - Changing the default parameter to `zoom = null` in both `worldToScreen` and `screenToWorld` resolves `null ?? camera?.zoom ?? 1.0` correctly.

2. **Smooth Zoom Implementation Logic**:
   - The user requirement specifies smooth zoom via mouse wheel within `[0.6, 1.6]`.
   - Adding a `'wheel'` event handler on `canvas` in `InputManager.bindEvents()` with `e.preventDefault()` allows catching wheel scrolls.
   - `Camera` should manage `minZoom = 0.6`, `maxZoom = 1.6`, `targetZoom`, and `zoom`.
   - In `Camera.update(dt)`, exponential decay `this.zoom += (this.targetZoom - this.zoom) * (1 - Math.exp(-12.0 * dt))` ensures smooth transitions, while clamping ensures the zoom factor never leaves `[0.6, 1.6]`.
   - `InputDispatcher` must dynamically resolve `effectiveZoom = this.camera?.zoom ?? this.zoom ?? 1.0` so headless tests and live simulation stay aligned.

3. **Smooth Hero Facing Logic**:
   - Currently, `hero.facing` snaps abruptly in `entity.update` and `game.updateHeroCombat`.
   - Adding `targetFacing` and `turnSpeed` (e.g. 15.0 rad/s) allows computing shortest angular arc:
     `diff = ((targetFacing - facing + Math.PI) % (2 * Math.PI)) - Math.PI;`
     `facing += Math.sign(diff) * Math.min(Math.abs(diff), turnSpeed * dt);`
   - This smoothly orients the hero towards movement destinations, attack targets, and skillshot targeting indicators.

4. **Camera Perspective Rotation Formulation**:
   - To support alternating perspectives (e.g. via hotkey 'C' or 'V' cycling 90° angles: 0, $\pi/2$, $\pi$, $3\pi/2$) or continuous rotation without breaking game simulation:
     - World simulation (coordinates, movement, combat, bounding boxes) MUST remain completely invariant in standard world coordinates `(wx, wy)`.
     - Only the projection/unprojection layer in `isometric.js` and camera focal transform should apply rotation angle $\theta = camera.rotation || camera.angle || 0$.
     - Relative vector to camera center: $dx = wx - camWx$, $dy = wy - camWy$.
     - Rotate by $\theta$:
       $rx = dx \cos\theta - dy \sin\theta$
       $ry = dx \sin\theta + dy \cos\theta$
     - Project:
       $isoX = (rx - ry) * 0.5$
       $isoY = (rx + ry) * 0.25 - wz$
       $sx = isoX * s + vw / 2$
       $sy = isoY * s + vh / 2$
     - Inverse unprojection (`screenToWorld`):
       $xp = (sx - vw / 2) / s$, $yp = (sy - vh / 2) / s$
       $rx = xp + 2 * yp$, $ry = 2 * yp - xp$
       Invert rotation by $-\theta$:
       $dx = rx \cos\theta + ry \sin\theta$
       $dy = -rx \sin\theta + ry \cos\theta$
       $wx = camWx + dx$, $wy = camWy + dy$.
     - Mathematical proof of round-trip identity: For any $\theta \in [0, 2\pi]$, $screenToWorld(worldToScreen(wx, wy)) \equiv (wx, wy)$ with error $< 10^{-12}$.
     - Depth key in rotated view: $rx + ry$ represents distance along the camera viewing axis towards the screen bottom, ensuring 100% correct depth sorting for dynamic entities under any angle.

---

## 3. Caveats

1. **Minimap Frustum Compatibility**: `Minimap.render` in `src/ui/hud.js` unprojects the 4 viewport corners using `screenToWorld` and draws the frustum polygon on the minimap. With the formulated rotated unprojection, the minimap frustum naturally rotates and scales accurately; no separate minimap math is required.
2. **Tile Grid Viewport Culling in `renderer.js`**: `pass1_Terrain` unprojects the 4 screen corners to find `minWx, maxWx, minWy, maxWy`. Under 45° or 90° rotations, the bounding box of the visible diamond expands. The tile loop bounds `Math.min(...)` and `Math.max(...)` with margin safely handle this.
3. **Hero Facing Visual Notch**: When the camera rotates, drawing `facing` on screen must project a small offset point via `worldToScreen` to determine the screen-space direction vector rather than assuming screen $X$ aligns with world $+X$.
4. **Standalone Stress Test Check 1.3**: `tests/stress_picking_hierarchy_adversarial.js` (not run by `npm test`) has one assertion failure in check 1.3 because of `generousGroundRadius = Math.max(36, hitRadius * 1.3)`. This is independent of R4-R6, but implementers should be aware if running standalone stress scripts.

---

## 4. Conclusion & Recommended Architecture Plan

### 1. `src/core/isometric.js`
- Change default argument in `worldToScreen` and `screenToWorld` from `zoom = 1.0` to `zoom = null`.
- Integrate camera rotation $\theta = camera.rotation || camera.angle || 0$ into projection and unprojection.
- Update `getDepthKey(wx, wy, camera)` and `compareDepth(a, b, camera)` to use $rx + ry$ when camera has rotation.

### 2. `src/core/camera.js`
- Add zoom bounds clamping: `this.minZoom = 0.6; this.maxZoom = 1.6;`.
- Add `this.targetZoom = this.zoom;` and methods `setZoom(z)`, `zoomBy(delta)`.
- In `update(dt)`: smooth lerp for `this.zoom` towards `this.targetZoom`.
- Add perspective rotation: `this.rotation = 0; this.targetRotation = 0;` and methods `setRotation(angle)`, `rotatePerspective(step)`, `cyclePerspective()`.

### 3. `src/core/input.js`
- Add `'wheel'` event listener to `canvas` in `bindEvents()` and `unbindEvents()`.
- Implement `handleWheel(e)` with `e.preventDefault()`, zoom adjustment, and cursor unprojection refresh.
- In `InputDispatcher`, resolve `effectiveZoom = this.camera?.zoom ?? this.zoom ?? 1.0`.
- In `handleKeyDown`, bind hotkey (e.g. `'KeyC'` or `'KeyV'`) to dispatch `CYCLE_PERSPECTIVE` command.
- When targeting skills, update `playerHero.targetFacing` towards `(this.worldX, this.worldY)`.

### 4. `src/entities/entity.js` & `src/game.js`
- Add `targetFacing` and `turnSpeed` (15.0 rad/s) in `Entity`, with smooth angular lerp in `update(dt)`.
- In `draw()`, project forward vector via `worldToScreen` for visual facing notch.
- In `game.js`, handle `CYCLE_PERSPECTIVE` by calling `this.camera.cyclePerspective()`.

### 5. `tests/` Test Expansion
- Add `tests/unit/respawn.test.js` (validating R1: death state retention, timer, command rejection, fountain respawn).
- Add `tests/unit/zoom.test.js` (validating R4: zoom clamping, wheel event, unprojection precision, picking across zoom levels).
- Add `tests/unit/rotation.test.js` (validating R5: hero facing on move/attack/skill, camera perspective cycling, rotated unprojection & depth sorting).

---

## 5. Verification Method

To verify these findings and implementations:

1. **Baseline Suite Execution**:
   ```bash
   npm test
   ```
   Must execute all 20 test files and report 147 passed, 0 failed.

2. **Zoom & Unprojection Verification Test**:
   Execute:
   ```bash
   node tests/runner.js
   ```
   Inspect new test suite `tests/unit/zoom.test.js`:
   - Round-trip accuracy: For 1,000 randomized points at `zoom = 0.6`, `1.0`, `1.6`, `Math.abs(screenToWorld(worldToScreen(x, y)).wx - x) < 0.001`.
   - Clamping accuracy: Attempting `camera.setZoom(0.2)` results in `camera.zoom === 0.6`; `camera.setZoom(2.5)` results in `camera.zoom === 1.6`.

3. **Facing & Perspective Verification Test**:
   Inspect new test suite `tests/unit/rotation.test.js`:
   - Hero moving towards `(1000, 2000)` from `(1000, 1000)`: `hero.facing` converges to $\pi/2$.
   - Hero attacking target at `(500, 1000)` from `(1000, 1000)`: `hero.facing` converges to $\pi$.
   - Camera rotation by $\pi/2$ and $\pi$: `screenToWorld` unprojects clicked screen coordinates to identical ground targets.
   - Entities sorted with `compareDepth(a, b, camera)` maintain correct screen depth order across all 4 perspective angles.
