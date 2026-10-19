# Handoff Report: Reviewer & Adversarial Critic — Milestone 1

**Author**: Reviewer 1 (`reviewer_m1_1`)  
**Mission**: Milestone 1 Objective Quality Review & Adversarial Stress Challenge  
**Target Milestone**: Milestone 1 (Engine Foundation, 2.5D Isometric Renderer & HUD)  
**Date**: 2026-10-17T00:52:00Z  
**Recipient**: Orchestrator (`47550c40-796a-4ccf-8ac6-09bde1de0183`)

---

## 1. Observation

### 1.1 Test Suite & Verification Tool Execution
1. **Full Automated Test Runner**:
   ```pwsh
   node tests/runner.js
   ```
   - **Exit Code**: 0
   - **Result**: 17 test files passed (17 total), 115 tests passed, 0 failed. Execution duration: ~231ms.
2. **Milestone 1 Dedicated Math Tests**:
   ```pwsh
   node tests/runner.js m1_math
   ```
   - **Exit Code**: 0
   - **Result**: 1 test file passed, 12 tests passed, 0 failed.
3. **Adversarial Stress Test Suite**:
   ```pwsh
   node tests/stress_m1_math.js
   ```
   - **Exit Code**: 0
   - **Result**: 203 checks passed, 0 checks failed. 10,000 randomized world coordinate roundtrips verified with maximum error $< 10^{-12}$. 1,000 overlapping entities sorted with 100% stability.

### 1.2 Integrity Check
No integrity violations detected:
- No hardcoded test results embedded in source modules.
- No dummy or facade implementations bypassing logic.
- Real mathematical transformations, exponential lerp camera smoothing, fixed-timestep accumulator with spiral-of-death cap, entity picking priority, procedural particles, and HUD DOM updates implemented throughout.

### 1.3 Key Source Code Observations
1. **Projection Formula in `src/core/isometric.js` (lines 70-75)**:
   ```javascript
   const isoX = (safeWx - safeWy) * halfTw; // halfTw = 32
   const isoY = (safeWx + safeWy) * halfTh - safeWz; // halfTh = 16
   const sx = (isoX - camX) * s + vw / 2;
   const sy = (isoY - camY) * s + vh / 2;
   ```
   Observation: A change of $+1$ unit in $W_x$ produces a screen offset of $\Delta X_s = +32$ px and $\Delta Y_s = +16$ px.
2. **Terrain Loop in `src/render/renderer.js` (lines 33-34, 129-142)**:
   ```javascript
   this.tileStep = 64; // World units per tile
   ...
   const S = this.tileStep;
   const X0 = Math.floor(minWx / S);
   const X1 = Math.ceil(maxWx / S);
   for (let ty = Y0; ty <= Y1; ty++) {
     for (let tx = X0; tx <= X1; tx++) {
       const wx = tx * S + S / 2;
       const wy = ty * S + S / 2;
       const { sx, sy } = worldToScreen(wx, wy, 0, camera, zoom, vp);
   ```
   Observation: In `pass1_Terrain`, stepping `tx` by $+1$ increments $W_x$ by $S = 64$. Through `worldToScreen`, an increment of 64 in $W_x$ offsets screen coordinates by $\Delta X_s = 64 \times 32 = 2048$ px and $\Delta Y_s = 64 \times 16 = 1024$ px. The drawn diamond tile has semi-axes $hw = 32$ px and $hh = 16$ px (bounding diamond $64 \times 32$ px).
   Measured result: On a $1280 \times 720$ viewport with camera focused at $(650, 650)$, exactly 25 tiles are processed across the entire map, and only 1 or 2 tiles touch the viewport. The rest of the viewport is blank black canvas.
3. **Decal and Tower Radii in `src/render/renderer.js` (lines 189-191, 221-223)**:
   ```javascript
   // Fountain (world radius 250)
   ctx.ellipse(allyF.sx, allyF.sy, 250 * zoom, (250 * 0.5) * zoom, 0, 0, Math.PI * 2);
   ...
   // Tower (world radius 400)
   ctx.ellipse(sx, sy, 400 * zoom, (400 * 0.5) * zoom, 0, 0, Math.PI * 2);
   ```
   Observation: In `pass2_GroundDecals`, radii (250 and 400) are drawn directly as screen pixel radii ($R_x = 250$ px, $R_x = 400$ px). However, an entity positioned 400 world units away has screen distance $\Delta X_s = 400 \times 32 = 12,800$ px.
4. **Targeting Indicator in `src/render/renderer.js` (lines 266-273)**:
   ```javascript
   // Cast range circle
   ctx.ellipse(origin.sx, origin.sy, ind.castRange * zoom, (ind.castRange * 0.5) * zoom, 0, 0, Math.PI * 2);
   // Target circle
   const target = worldToScreen(ind.target.x, ind.target.y, 0, camera, zoom, vp);
   ctx.ellipse(target.sx, target.sy, ind.aoeRadius * zoom, (ind.aoeRadius * 0.5) * zoom, 0, 0, Math.PI * 2);
   ```
   Measured result: For an ability with `castRange = 600`, the range circle has screen radius $600$ px, but when targeting near max range (600 world units), `target` is projected via `worldToScreen`, yielding a screen distance from hero of $21,466$ px (over 35 times larger than the drawn range circle).
5. **Camera Follow Velocity & Screen Escape (`src/core/camera.js`, `src/entities/entity.js`)**:
   Hero speed is $325$ world units/second. At $32$ pixels per unit horizontally, the hero moves across screen at $325 \times 32 = 10,400$ pixels/second. In 7 simulation ticks (0.11 seconds), the hero traverses from $sx = 791$ to $sx = 1534$, fleeing completely beyond the boundaries of a 1280px screen while the camera lerp ($\lambda = 8.0$) lags behind.
6. **Minimap Camera Frustum (`src/ui/hud.js`, lines 171-194)**:
   On the $200 \times 200$ minimap, the camera frustum polygon unprojected from the 1280x720 screen measures only $1.76$ pixels wide.
7. **Camera / GameLoop NaN Handling**:
   - `Camera.update()` (line 182): `const targetX = this.target.x ?? this.worldX;`. When `target.x` is `NaN`, nullish coalescing does not trigger (`NaN !== null`), permanently setting `cam.worldX = NaN`.
   - `GameLoop.step(deltaMs)` (line 90): If `deltaMs` is `NaN`, `this.accumulator` becomes `NaN`.

---

## 2. Logic Chain

1. **Root Cause of the Projection Inconsistency**:
   - The formula $X_s = (W_x - W_y) \cdot \frac{T_w}{2} = (W_x - W_y) \cdot 32$ is mathematically designed for **tile-indexed coordinates** where $W_x \in [0, 50]$ is the discrete column of a tile. In tile coordinates, advancing by $+1$ tile shifts the screen by 32px horizontally and 16px vertically, creating an exact, seamless 2:1 diamond tile grid.
   - However, the game map geometry in `PROJECT.md` was specified with continuous Euclidean coordinates: Map $= 3200 \times 3200$, Bases at $(400, 400)$ and $(2800, 2800)$, Hero Speed $= 325$, Tower Range $= 400$, and Tile Width $= 64$.
   - A $3200 \times 3200$ map with $64$-unit tiles consists of $3200 / 64 = 50$ tiles!
   - Tile indices are therefore $t_x = W_x / 64, t_y = W_y / 64$.
   - The projection from continuous world units should have been:
     $$X_s = \frac{W_x - W_y}{64} \cdot 32 = (W_x - W_y) \cdot 0.5$$
     $$Y_s = \frac{W_x + W_y}{64} \cdot 16 = (W_x + W_y) \cdot 0.25$$
   - Because the division by $64$ was omitted in `spec_miner_engine_r0 §5.1` and `PROJECT.md`, the projection scales all world distances by a factor of 64 too large ($32$ instead of $0.5$).
2. **Manifestation in Terrain Rendering**:
   - The author of `src/render/renderer.js` knew tiles were 64 units wide and wrote `this.tileStep = 64;` and `const wx = tx * S + S / 2;`.
   - Stepping $tx$ by $+1$ stepped $W_x$ by 64. Because `worldToScreen` already multiplied $W_x$ by 32, the step on canvas was $64 \times 32 = 2048$ px!
   - Each tile is drawn with $hw = 32, hh = 16$ ($64 \times 32$ px).
   - Thus, diamond tiles are drawn with 2016-pixel black gaps between them. The terrain does not render as a contiguous corridor.
3. **Manifestation in Decals, Indicators, and Gameplay**:
   - In `pass2_GroundDecals`, radii were drawn as pixels ($R = 250, R = 400$), while entity coordinates are in world space (scaled by 32). This produces a 32-to-1 mismatch between the visual circle on screen and the actual gameplay/hitbox radius.
   - In ability targeting, the range circle is drawn at 600px radius, while the ground targeting indicator point is projected via `worldToScreen` to 21,466px distance.
   - Hero movement at 325 world units/s moves at 10,400 px/s, breaking camera follow and flying off-screen.
4. **Verification Failure**:
   - Worker M1 claimed in `handoff.md §5.3` that opening `index.html` displays:
     *"Fullscreen 2.5D canvas displays diamond terrain tiles and cobblestone lane corridor"* and *"displays skillshot arrow or AoE indicators"*.
   - Direct empirical measurement proves the canvas displays 2048px gaps and indicators displaced by 20,000+ pixels. This violates the verification requirement and requires remediation before Milestone 2 can build map geometry and towers on top of the engine.

---

## 3. Caveats

- **Test Suite Status**: All 115 tests in `node tests/runner.js` pass because the unit test `m1_math.test.js` (TC-M1-01) and `tests/oracles/core/isometric.js` were written assuming the unnormalized formula ($Y_s = 32300$). The bug is an architectural impedance mismatch between the mathematical formula and the canvas rendering/gameplay constants.
- **Browser Compatibility**: The underlying ES module architecture, headless Node.js compatibility, DOM HUD controllers, and fixed-timestep loop are cleanly coded with high quality.

---

## 4. Conclusion & Review Summary

**Verdict**: **REQUEST_CHANGES**

### Findings Summary

| # | Severity | Category | Location | Issue | Fix Direction |
|---|----------|----------|----------|-------|---------------|
| 1 | **Critical** | Rendering / Math | `src/render/renderer.js` (lines 34, 129-142) | Terrain tiles are spaced 2048px apart due to `tileStep = 64` multiplying against the 32x projection scale, leaving 99% of the ground canvas blank. | Reconcile tile step and projection scale (see Fix Options below). |
| 2 | **Major** | Visual / Math | `src/render/renderer.js` (lines 189, 221, 266-273) | 32x mismatch between visual indicator radii (drawn in screen pixels) and world unit positions (projected at 32x scale). Target indicator draws 21,466px away. | Scale visual indicator radii consistently or normalize world coordinate projection. |
| 3 | **Minor** | Robustness | `src/core/camera.js` (line 182), `src/core/loop.js` (line 90) | Camera and GameLoop vulnerable to `NaN` poisoning when `target.x = NaN` or `step(NaN)` is called. | Add `Number.isFinite()` guards. |
| 4 | **Minor** | UI / Minimap | `src/ui/hud.js` (lines 171-194) | Minimap camera frustum polygon is sub-pixel (1.76px) due to the 32x world-to-screen scale. | Automatically resolved when Finding 1/2 is resolved. |

---

### Concrete Fix Recommendations

The team should choose one of two clean architectural resolutions:

#### Option A: Normalize Projection by Tile Size (Recommended)
Make continuous world units $(W_x, W_y) \in [0, 3200]$ directly represent Euclidean world units where 1 tile = 64 world units:
1. In `src/core/isometric.js` and `tests/oracles/core/isometric.js`:
   ```javascript
   // Normalize continuous world units by tile dimensions (64x32)
   const isoX = (safeWx - safeWy) * (halfTw / TILE_WIDTH);  // (wx - wy) * 0.5
   const isoY = (safeWx + safeWy) * (halfTh / TILE_WIDTH) - safeWz; // (wx + wy) * 0.25 - wz
   ```
   And its inverse:
   ```javascript
   const xp = (safeSx - vw / 2) / s + camX;
   const yp = (safeSy - vh / 2) / s + camY;
   const wx = xp + 2 * yp;
   const wy = 2 * yp - xp;
   ```
2. In `tests/unit/m1_math.test.js`: Update TC-M1-01 baseline expected screen Y from 32300 to $(2000 \times 0.25) + 300 = 800$.
3. Result: Hero speed 325 units/s translates to $162.5$ px/s. Tower range 400 translates to 200px. Pass 1 `tileStep = 64` produces seamless diamond tiles. Minimap frustum becomes $\approx 160 \times 90$ px.

#### Option B: Keep Formula & Fix Tile Step + Radii
If the orchestrator strictly preserves `isoX = (wx - wy) * 32`:
1. In `src/render/renderer.js`: Set `this.tileStep = 1;` so tiles step by $\Delta W_x = 1$ (32px offset), creating a continuous terrain.
2. Scale indicator radii by `halfTw` ($R \times 32$), or scale all map coordinates, speeds, and ranges down by 64 (Map = 50, Speed = 5.0, Tower Range = 6.25).

---

## 5. Verification Method

1. **Verify Test Suite**:
   ```pwsh
   node tests/runner.js
   ```
   Must exit with code 0 and all tests passing.
2. **Verify Adversarial Stress Suite**:
   ```pwsh
   node tests/stress_m1_math.js
   ```
   Must exit with code 0.
3. **Verify Canvas Visual Output in Node**:
   Run the following verification script:
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
   // Must draw seamless grid across viewport with adjacent tiles spaced 32px / 16px, not 2048px
   ```
4. **Invalidation Conditions**:
   - Any test failure in `node tests/runner.js`.
   - Terrain tiles in Pass 1 having $>0$ pixel gaps or spacing $>64$ px.
   - Targeting preview indicator endpoint deviating by more than ability range from hero origin.
