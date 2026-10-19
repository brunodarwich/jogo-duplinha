# Handoff Report: Explorer 1 — Milestone 1 Remediation (Iteration 2)

**Author**: Explorer 1 (`explorer_m1_r2_1`)  
**Mission**: Milestone 1 Remediation — Option A (Projection Normalization) Analysis & Code Specification  
**Target Milestone**: Milestone 1 (Engine Foundation, 2.5D Isometric Renderer & HUD)  
**Date**: 2026-10-17T00:55:00Z  
**Recipient**: Orchestrator (`47550c40-796a-4ccf-8ac6-09bde1de0183`) and Worker 1  

---

## 1. Observation

### 1.1 Direct Baseline Observations
1. **Projection Formula in `src/core/isometric.js` (lines 70-75)**:
   ```javascript
   // Current code:
   const isoX = (safeWx - safeWy) * halfTw; // halfTw = 32
   const isoY = (safeWx + safeWy) * halfTh - safeWz; // halfTh = 16
   const sx = (isoX - camX) * s + vw / 2;
   const sy = (isoY - camY) * s + vh / 2;
   ```
   - Current scale: An advance of $+1$ world unit shifts screen $X$ by $+32$ px and screen $Y$ by $+16$ px.
   - For an entity at $(1000, 1000)$ with camera at $(0, 0)$ and viewport $800 \times 600$, $sy = (1000 + 1000) \times 16 + 300 = 32300$ px.

2. **Inverse Transformation in `src/core/isometric.js` (lines 117-125)**:
   ```javascript
   // Current code:
   const xp = (safeSx - vw / 2) / s + camX;
   const yp = (safeSy - vh / 2) / s + camY;

   const wx = 0.5 * (xp / halfTw + yp / halfTh);
   const wy = 0.5 * (yp / halfTh - xp / halfTw);
   ```

3. **Test Oracle in `tests/oracles/core/isometric.js` (lines 28-29, 49-50)**:
   - Mirrors the unnormalized formula using `halfTw = 32` and `halfTh = 16`.

4. **Camera Projected Coordinates in `src/core/camera.js` (lines 96-101)**:
   ```javascript
   _updateProjected() {
     const halfTw = TILE_WIDTH / 2;
     const halfTh = TILE_HEIGHT / 2;
     this._projX = (this.worldX - this.worldY) * halfTw;
     this._projY = (this.worldX + this.worldY) * halfTh;
   }
   ```
   - Observation: `Camera.x` and `Camera.y` return `this._projX` and `this._projY`. If `isometric.js` normalizes projection by dividing by tile dimensions, `Camera._updateProjected()` MUST use the identical scaling factor (`* 0.5` and `* 0.25`), otherwise `isoX - camX` in `worldToScreen` will subtract mismatched coordinate systems.

5. **Camera & GameLoop Robustness (`src/core/camera.js` line 125, 182; `src/core/loop.js` line 89)**:
   - `Camera.lookAt(NaN, NaN)` currently does not guard against `NaN`, poisoning `cam.worldX`.
   - `Camera.update()` uses `this.target.x ?? this.worldX`; when `this.target.x` is `NaN`, nullish coalescing does not trigger (`NaN !== null`), propagating `NaN`.
   - `GameLoop.step(NaN)` adds `NaN` to `this.accumulator`.

6. **Unit Test TC-M1-01 in `tests/unit/m1_math.test.js` (line 19)**:
   ```javascript
   assertCloseTo(sy, 32300, 0.001, 'Baseline worldToScreen SY must equal 32300');
   ```

---

## 2. Logic Chain

### 2.1 Mathematical Derivation for Option A (Projection Normalization)
1. **Coordinate Normalization**:
   - The map dimensions are defined as $3200 \times 3200$ continuous Euclidean units (`PROJECT.md` §16).
   - Dimetric tiles are $64 \times 32$ pixels (`PROJECT.md` §1).
   - Therefore, 1 tile corresponds to $64$ continuous world units. The tile index is $t_x = W_x / 64, t_y = W_y / 64$.
   - In 2:1 dimetric projection, advancing 1 tile shifts the screen horizontally by $\frac{T_w}{2} = 32$ px and vertically by $\frac{T_h}{2} = 16$ px.
   - Normalizing continuous world coordinates:
     $$isoX = \frac{W_x - W_y}{64} \times 32 = (W_x - W_y) \times 0.5$$
     $$isoY = \frac{W_x + W_y}{64} \times 16 - W_z = (W_x + W_y) \times 0.25 - W_z$$

2. **Exact Algebraic Inversion**:
   - Given unprojected screen offsets:
     $$xp = \frac{S_x - V_w / 2}{s} + Cam_X = isoX$$
     $$yp = \frac{S_y - V_h / 2}{s} + Cam_Y = isoY$$
   - On the ground plane ($W_z = 0$):
     $$xp = 0.5 (W_x - W_y) \implies 2 xp = W_x - W_y \quad \text{(Eq. 1)}$$
     $$yp = 0.25 (W_x + W_y) \implies 4 yp = W_x + W_y \quad \text{(Eq. 2)}$$
   - Adding (Eq. 1) and (Eq. 2):
     $$2 W_x = 2 xp + 4 yp \implies W_x = xp + 2 yp$$
   - Subtracting (Eq. 1) from (Eq. 2):
     $$2 W_y = 4 yp - 2 xp \implies W_y = 2 yp - xp$$
   - **Numerical Property**: Because $0.5$, $0.25$, and $2.0$ are exact powers of 2 ($2^{-1}, 2^{-2}, 2^1$), IEEE-754 floating point arithmetic computes both forward and inverse transforms with ZERO fractional rounding error.

3. **Camera Synchronization**:
   - In `worldToScreen`, `camX` and `camY` are subtracted from `isoX` and `isoY`:
     $$sx = (isoX - camX) \cdot s + \frac{vw}{2}$$
     $$sy = (isoY - camY) \cdot s + \frac{vh}{2}$$
   - When the camera is focused on $(W_{cx}, W_{cy})$, `camX` must equal $(W_{cx} - W_{cy}) \times 0.5$ and `camY` must equal $(W_{cx} + W_{cy}) \times 0.25$.
   - Therefore, `Camera._updateProjected()` must be updated to use $0.5$ and $0.25$.

4. **Baseline Unit Test Expectation (TC-M1-01)**:
   - For point $(1000, 1000, 0)$ with camera at $(0, 0)$ and viewport $800 \times 600$:
     $$isoX = (1000 - 1000) \times 0.5 = 0 \implies sx = 0 + 400 = 400$$
     $$isoY = (1000 + 1000) \times 0.25 - 0 = 500 \implies sy = 500 + 300 = 800$$
   - Expected screen Y changes from $32300$ to $800$.

5. **Impact on Terrain Rendering (`src/render/renderer.js`)**:
   - In `pass1_Terrain`, tile step is $S = 64$.
   - Stepping $tx$ by $+1$ increments $W_x$ by 64.
   - Projected screen delta: $\Delta X_s = 64 \times 0.5 = 32$ px, $\Delta Y_s = 64 \times 0.25 = 16$ px.
   - Tile diamond vertices have semi-axes $hw = 32$ px and $hh = 16$ px.
   - Right vertex of tile $(tx, ty)$ is at $(sx + 32, sy)$.
   - Top vertex of tile $(tx+1, ty)$ is at $((sx + 32), (sy + 16) - 16) = (sx + 32, sy)$.
   - The vertices touch exactly. The 2048px gaps are completely eliminated.

6. **Impact on Decals and Minimap**:
   - Ground decals with radius $R = 250$ (fountain) and $R = 400$ (tower) drawn with screen semi-axes $(R \cdot s, 0.5 R \cdot s)$ match world entities at distance $R$, because a world displacement $(R, -R)$ along the horizontal isometric diagonal produces screen distance $\Delta X_s = (R - (-R)) \times 0.5 = R$.
   - Minimap frustum unprojection of $1280 \times 720$ screen spans $\Delta W_x \approx 2000$ world units, mapping to $\approx 125$ px on the $200 \times 200$ minimap.

---

## 3. Caveats

1. **Test Expectation Update**: Any external test or assertion checking for the old unnormalized value of $sy = 32300$ must be updated to $800$. Grep analysis confirmed this occurs exclusively in `tests/unit/m1_math.test.js` at line 19.
2. **Camera In-Sync Requirement**: Updating `isometric.js` without updating `Camera._updateProjected()` in `src/core/camera.js` will cause camera-centered projections (such as TC-M1-04) to fail with a 20,000+ pixel offset. Both must be updated simultaneously.
3. **No Breaking Changes to Depth Sorting**: `getDepthKey(wx, wy) = wx + wy` is unchanged and retains strict monotonic ordering.

---

## 4. Conclusion & Concrete Implementation Specifications for Worker

The Worker must execute the following 5 precise edits:

### Edit 1: `src/core/isometric.js`
- **File**: `c:\Users\Bruno\Downloads\jogo-duplinha\src\core\isometric.js`
- **Location**: Lines 70-75 (worldToScreen) and Lines 117-126 (screenToWorld)
- **Target Line 70-75 Replacement**:
```javascript
<<<<
  // 2:1 Dimetric Isometric Projection
  const isoX = (safeWx - safeWy) * halfTw;
  const isoY = (safeWx + safeWy) * halfTh - safeWz;

  const sx = (isoX - camX) * s + vw / 2;
  const sy = (isoY - camY) * s + vh / 2;
====
  // 2:1 Dimetric Isometric Projection (Normalized by tile dimensions 64x32)
  const isoX = (safeWx - safeWy) * 0.5;
  const isoY = (safeWx + safeWy) * 0.25 - safeWz;

  const sx = (isoX - camX) * s + vw / 2;
  const sy = (isoY - camY) * s + vh / 2;
>>>>
```

- **Target Line 117-126 Replacement**:
```javascript
<<<<
  // Unproject from screen pixels to camera-relative projected space
  const xp = (safeSx - vw / 2) / s + camX;
  const yp = (safeSy - vh / 2) / s + camY;

  // Invert 2x2 dimetric system for ground plane (wz = 0)
  const wx = 0.5 * (xp / halfTw + yp / halfTh);
  const wy = 0.5 * (yp / halfTh - xp / halfTw);

  return { wx, wy };
====
  // Unproject from screen pixels to camera-relative projected space
  const xp = (safeSx - vw / 2) / s + camX;
  const yp = (safeSy - vh / 2) / s + camY;

  // Invert 2x2 dimetric system for ground plane (wz = 0, normalized by tile dimensions 64x32)
  const wx = xp + 2 * yp;
  const wy = 2 * yp - xp;

  return { wx, wy };
>>>>
```

---

### Edit 2: `tests/oracles/core/isometric.js`
- **File**: `c:\Users\Bruno\Downloads\jogo-duplinha\tests\oracles\core\isometric.js`
- **Location**: Lines 25-31 (worldToScreen) and Lines 43-52 (screenToWorld)
- **Target Line 25-31 Replacement**:
```javascript
<<<<
  const halfTw = TILE_WIDTH / 2;   // 32
  const halfTh = TILE_HEIGHT / 2;  // 16

  const sx = ((safeWx - safeWy) * halfTw - camX) * z + vw / 2;
  const sy = ((safeWx + safeWy) * halfTh - safeWz - camY) * z + vh / 2;

  return { sx, sy };
====
  const isoX = (safeWx - safeWy) * 0.5;
  const isoY = (safeWx + safeWy) * 0.25 - safeWz;

  const sx = (isoX - camX) * z + vw / 2;
  const sy = (isoY - camY) * z + vh / 2;

  return { sx, sy };
>>>>
```

- **Target Line 43-52 Replacement**:
```javascript
<<<<
  const halfTw = TILE_WIDTH / 2;   // 32
  const halfTh = TILE_HEIGHT / 2;  // 16

  const xp = (safeSx - vw / 2) / z + camX;
  const yp = (safeSy - vh / 2) / z + camY;

  const wx = 0.5 * (xp / halfTw + yp / halfTh);
  const wy = 0.5 * (yp / halfTh - xp / halfTw);

  return { wx, wy };
====
  const xp = (safeSx - vw / 2) / z + camX;
  const yp = (safeSy - vh / 2) / z + camY;

  const wx = xp + 2 * yp;
  const wy = 2 * yp - xp;

  return { wx, wy };
>>>>
```

---

### Edit 3: `src/core/camera.js`
- **File**: `c:\Users\Bruno\Downloads\jogo-duplinha\src\core\camera.js`
- **Location**: Lines 96-101 (`_updateProjected`), Lines 125-129 (`lookAt`), Lines 182-183 (`update`)
- **Target Lines 96-101 Replacement**:
```javascript
<<<<
  _updateProjected() {
    const halfTw = TILE_WIDTH / 2;
    const halfTh = TILE_HEIGHT / 2;
    this._projX = (this.worldX - this.worldY) * halfTw;
    this._projY = (this.worldX + this.worldY) * halfTh;
  }
====
  _updateProjected() {
    this._projX = (this.worldX - this.worldY) * 0.5;
    this._projY = (this.worldX + this.worldY) * 0.25;
  }
>>>>
```

- **Target Lines 125-129 Replacement (lookAt NaN robustness)**:
```javascript
<<<<
  lookAt(wx, wy) {
    this.worldX = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, wx));
    this.worldY = Math.max(this.bounds.minY, Math.min(this.bounds.maxY, wy));
    this._updateProjected();
  }
====
  lookAt(wx, wy) {
    const safeWx = Number.isFinite(wx) ? wx : this.worldX;
    const safeWy = Number.isFinite(wy) ? wy : this.worldY;
    this.worldX = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, safeWx));
    this.worldY = Math.max(this.bounds.minY, Math.min(this.bounds.maxY, safeWy));
    this._updateProjected();
  }
>>>>
```

- **Target Lines 182-183 Replacement (update NaN robustness)**:
```javascript
<<<<
    const targetX = this.target.x ?? this.worldX;
    const targetY = this.target.y ?? this.worldY;
====
    const targetX = Number.isFinite(this.target?.x) ? this.target.x : this.worldX;
    const targetY = Number.isFinite(this.target?.y) ? this.target.y : this.worldY;
>>>>
```

---

### Edit 4: `src/core/loop.js`
- **File**: `c:\Users\Bruno\Downloads\jogo-duplinha\src\core\loop.js`
- **Location**: Line 89 (`step` method)
- **Target Replacement**:
```javascript
<<<<
  step(deltaMs) {
    if (this.paused) return;
====
  step(deltaMs) {
    if (this.paused || !Number.isFinite(deltaMs)) return;
>>>>
```

---

### Edit 5: `tests/unit/m1_math.test.js`
- **File**: `c:\Users\Bruno\Downloads\jogo-duplinha\tests\unit\m1_math.test.js`
- **Location**: Lines 18-20 (TC-M1-01 assertion)
- **Target Replacement**:
```javascript
<<<<
    assertCloseTo(sx, 400, 0.001, 'Baseline worldToScreen SX must equal 400');
    assertCloseTo(sy, 32300, 0.001, 'Baseline worldToScreen SY must equal 32300');
====
    assertCloseTo(sx, 400, 0.001, 'Baseline worldToScreen SX must equal 400');
    assertCloseTo(sy, 800, 0.001, 'Baseline worldToScreen SY must equal 800');
>>>>
```

---

## 5. Verification Method

Once Worker implements the above edits, run the following verification steps:

1. **Verify All Automated Tests**:
   ```pwsh
   node tests/runner.js
   ```
   **Expected**: All 17 test files and 115 tests pass with 0 failures.

2. **Verify Milestone 1 Math Tests**:
   ```pwsh
   node tests/runner.js m1_math
   ```
   **Expected**: 12/12 tests pass (including TC-M1-01 with expected `sy = 800` and TC-M1-04 camera centering).

3. **Verify Adversarial Stress Suite**:
   ```pwsh
   node tests/stress_m1_math.js
   ```
   **Expected**: 203 checks pass with 0 failures, 10,000 randomized roundtrips pass with error $< 10^{-12}$, and 0 adversarial NaN findings.

4. **Verify Input & Minimap Stress Suite**:
   ```pwsh
   node tests/stress_m1_input.js
   ```
   **Expected**: 23 stress tests pass cleanly with 100% throughput and correct minimap bounds.

5. **Verify Terrain Tiling Seamlessness (Node Script)**:
   ```javascript
   import { Renderer } from './src/render/renderer.js';
   import { Camera } from './src/core/camera.js';
   const drawn = [];
   const mockCtx = {
     beginPath: () => {}, moveTo: (x, y) => drawn.push({ x, y }),
     lineTo: () => {}, closePath: () => {}, fill: () => {}, stroke: () => {}
   };
   const renderer = new Renderer({ width: 1280, height: 720, getContext: () => mockCtx });
   const camera = new Camera({ worldX: 650, worldY: 650, viewportWidth: 1280, viewportHeight: 720 });
   renderer.pass1_Terrain(mockCtx, camera, 1.0);
   // Adjacent diamond tile vertices must have spacing of 32px / 16px with zero gaps across viewport
   ```

6. **Invalidation Conditions**:
   - Any test failure in `node tests/runner.js`.
   - Any non-zero exit code in `node tests/stress_m1_math.js` or `node tests/stress_m1_input.js`.
   - Camera centering in TC-M1-04 failing to project hero to viewport center `(400, 300)`.
