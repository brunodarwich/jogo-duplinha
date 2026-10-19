# Technical Architecture & Implementation Report: Milestone 1 Engine & Isometric Math

## 1. Observation

### 1.1 Direct Source References
- **`ORIGINAL_REQUEST.md`** (Lines 12–14):
  > "Renderizador gráfico 2.5D isométrico rodando em HTML5 Canvas no navegador, com movimentação por clique do mouse, mira de habilidades, e HUD completo (vida, mana, barra de habilidades Q/W/E/R, ouro, cronômetro de partida e minimapa)."
- **`orchestrator/PROJECT.md`** (Lines 45–50, 131–141, 212–220):
  - Feature 1: "2:1 Dimetric Isometric Projection: Converts $(W_x, W_y, W_z)$ to canvas screen $(X_s, Y_s)$."
  - Feature 2: "Screen-to-World Ray Unprojection: Inverts mouse click $(M_x, M_y)$ to ground coordinates $(W_x, W_y)$."
  - Feature 3: "Camera Viewport & Smooth Follow: Dampened camera follow on hero with map boundaries clamping."
  - Feature 5: "Dynamic Y-Depth Sorting: Entity sorting by $W_x + W_y$ with ID tie-breaking."
  - Feature 6: "Deterministic 60 FPS Game Loop: `requestAnimationFrame` with fixed timestep $\Delta t = 16.67$ms."
  - Interface Contract 1 (`Engine` $\leftrightarrow$ `World / Entities`):
    - Continuous world coordinates $(x, y, z)$ with $z=0$ at ground level.
    - `worldToScreen(wx, wy, wz, camera, zoom)` $\to$ `{ sx, sy }`
    - `screenToWorld(sx, sy, camera, zoom)` $\to$ `{ wx, wy }`
    - `getDepthKey()`: returns $wx + wy$.
- **`spec_miner_engine_r0/handoff.md`** (Lines 117–152, 343–346):
  - Tile dimensions: $T_w = 64, T_h = 32$.
  - World-to-Screen Equation:
    $$X_s = \left( (W_x - W_y) \cdot \frac{T_w}{2} - C_x \right) \cdot s + \frac{V_w}{2}$$
    $$Y_s = \left( (W_x + W_y) \cdot \frac{T_h}{2} - W_z - C_y \right) \cdot s + \frac{V_h}{2}$$
  - Screen-to-World Inverse Equation (Ground $W_z = 0$):
    $$X'_s = \frac{X_s - V_w / 2}{s} + C_x$$
    $$Y'_s = \frac{Y_s - V_h / 2}{s} + C_y$$
    $$W_x = \frac{1}{2} \left( \frac{X'_s}{T_w / 2} + \frac{Y'_s}{T_h / 2} \right)$$
    $$W_y = \frac{1}{2} \left( \frac{Y'_s}{T_h / 2} - \frac{X'_s}{T_w / 2} \right)$$
  - Depth sorting key: $\text{DepthKey} = W_x + W_y$.
  - Verification baseline: $W_x = 1000, W_y = 1000, W_z = 0, C_x = 0, C_y = 0, V_w = 800, V_h = 600 \implies X_s = 400, Y_s = 32300$.

### 1.2 Execution Environment & Constraints
- Platform: Windows Node.js v24.13.0, npm 11.6.2.
- Target: Modern browser (HTML5 Canvas 2D) + headless Node.js test runner (`node tests/runner.js`).
- Key Constraint: Core engine modules (`src/core/isometric.js`, `src/core/camera.js`, `src/core/loop.js`) must be completely pure ES Modules with zero un-guarded DOM/window references, ensuring instant loading and 100% pass rate in headless unit testing while powering the browser game.

---

## 2. Logic Chain

### 2.1 Isometric Dimetric Math (2:1 Ratio)
1. **Geometric Rationale**:
   A 2:1 dimetric projection defines a diamond tile where the horizontal diagonal is exactly twice the vertical diagonal ($T_w = 2 \times T_h$). With $T_w = 64$ and $T_h = 32$, half-extents are $T_w / 2 = 32$ and $T_h / 2 = 16$.
2. **Forward Transformation (`worldToScreen`)**:
   - The projected horizontal offset is $(W_x - W_y) \cdot (T_w / 2)$.
   - The projected vertical offset is $(W_x + W_y) \cdot (T_h / 2) - W_z$.
   - Subtracting the camera's projected focal point $(C_x, C_y)$, scaling by zoom $s$, and translating by half-viewport $(V_w / 2, V_h / 2)$ places the camera's focal point at the exact center of the screen:
     $$X_s = \left( (W_x - W_y) \cdot 32 - C_x \right) \cdot s + \frac{V_w}{2}$$
     $$Y_s = \left( (W_x + W_y) \cdot 16 - W_z - C_y \right) \cdot s + \frac{V_h}{2}$$
3. **Inverse Transformation (`screenToWorld`)**:
   - For ground plane interactions ($W_z = 0$), mouse screen pixels $(X_s, Y_s)$ are first converted to camera-relative projected coordinates:
     $$X'_s = \frac{X_s - V_w / 2}{s} + C_x$$
     $$Y'_s = \frac{Y_s - V_h / 2}{s} + C_y$$
   - Solving the linear 2x2 system:
     $$\begin{cases} X'_s = (W_x - W_y) \cdot 32 \\ Y'_s = (W_x + W_y) \cdot 16 \end{cases}$$
     $$\implies \frac{X'_s}{32} = W_x - W_y, \quad \frac{Y'_s}{16} = W_x + W_y$$
     Adding the equations: $2 W_x = \frac{X'_s}{32} + \frac{Y'_s}{16} \implies W_x = 0.5 \cdot \left( \frac{X'_s}{32} + \frac{Y'_s}{16} \right)$
     Subtracting the equations: $2 W_y = \frac{Y'_s}{16} - \frac{X'_s}{32} \implies W_y = 0.5 \cdot \left( \frac{Y'_s}{16} - \frac{X'_s}{32} \right)$
   - Because $32, 16, 0.5$ are exact powers of 2, the inverse transformation is bitwise exact in IEEE 754 floating point arithmetic, resulting in zero round-trip drift.

### 2.2 Camera Architecture & Dampening
1. **Dual Representation**:
   - The camera tracks the world focal position $(W_{cx}, W_{cy})$ as well as the projected screen focal position $(C_x, C_y)$:
     $$C_x = (W_{cx} - W_{cy}) \cdot 32, \quad C_y = (W_{cx} + W_{cy}) \cdot 16$$
   - This dual exposure allows game logic to query camera world position (e.g. for audio listeners or culling) while the renderer directly accesses $(C_x, C_y)$ without recomputation.
2. **Smooth Follow (Exponential Lerp Dampening)**:
   - To prevent stutter across variable display refresh rates (60Hz, 120Hz, 144Hz), the camera follow uses frame-rate independent exponential decay:
     $$\text{decayFactor} = 1.0 - \exp(-\lambda \cdot \Delta t)$$
     $$W_{cx} \mathrel{+}= (W_{target\_x} - W_{cx}) \cdot \text{decayFactor}$$
     $$W_{cy} \mathrel{+}= (W_{target\_y} - W_{cy}) \cdot \text{decayFactor}$$
   - When $\lambda = 8.0$, camera motion is snappy, responsive, and free of overshoot or oscillation.
3. **Boundary Clamping**:
   - The playable map is defined as $[0, 3200] \times [0, 3200]$.
   - The camera focal point $(W_{cx}, W_{cy})$ is strictly clamped to $[minX, maxX] \times [minY, maxY]$.
   - When the hero approaches map corners (e.g., $(0, 0)$ or $(3200, 3200)$), the camera smoothly halts at the margin, keeping the viewport within the valid world.
4. **Instant Centering & Jump**:
   - Spacebar re-centering and minimap left-click require instantaneous repositioning (`snapTo(wx, wy)` / `lookAt(wx, wy)`), bypassing smoothing.

### 2.3 Deterministic Fixed-Timestep Game Loop
1. **Decoupled Simulation vs. Render**:
   - MOBA mechanics (cooldowns, projectile movement, CC duration, collision) require 100% deterministic physics updates.
   - Fixed update step: $\Delta t_{fixed} = 1000 / 60 \approx 16.6667$ ms ($0.016667$s).
2. **Accumulator & Spiral-of-Death Protection**:
   - Frame delta time: $\Delta t_{frame} = \text{currentTime} - \text{lastTime}$.
   - If the browser tab is backgrounded or a heavy garbage collection pause occurs, $\Delta t_{frame}$ could spike to 1000ms. If unchecked, the loop would attempt 60 physics updates in a single frame, locking the main thread.
   - Max accumulator cap: $\Delta t_{max} = 100$ms ($\le 6$ simulation ticks per frame).
3. **Interpolation Alpha**:
   - Variable rendering receives interpolation factor $\alpha = \text{accumulator} / \Delta t_{fixed} \in [0.0, 1.0)$, enabling sub-frame render smoothing if desired.
4. **Headless & Unit-Test Support**:
   - The loop encapsulates `requestAnimationFrame` with a fallback to `setTimeout` or manual stepping (`step(dt)` / `tick()`), allowing unit tests to advance simulation time deterministically in Node.js without browser APIs.

### 2.4 Entity Coordinate System & Depth Sorting
1. **World Coordinate Standard**:
   - Ground plane is $W_z = 0$.
   - Positive $W_x$ extends down-right; positive $W_y$ extends down-left; positive $W_z$ extends upward.
2. **Depth Key Calculation**:
   - Ground screen Y coordinate is proportional to $(W_x + W_y) \cdot 16$.
   - Any entity at $(W_x, W_y)$ has depth key:
     $$\text{DepthKey} = W_x + W_y$$
   - Sorting entities ascending by $\text{DepthKey}$ guarantees that entities with higher $W_x + W_y$ (foreground) render after entities with lower $W_x + W_y$ (background), achieving painter's algorithm occlusion.
3. **Stable Tie-Breaking**:
   - When two entities share identical $W_x + W_y$, comparing floats can cause frame-to-frame z-fighting.
   - Tie-breaker: lexicographical comparison of unique entity IDs (`entityA.id < entityB.id ? -1 : 1`).

---

## 3. Caveats
1. **Zoom Factor**: Zoom $s$ must be validated against non-positive or non-finite values ($s \le 0$ or `!Number.isFinite(s)`). If invalid, fallback to $s = 1.0$ to prevent divide-by-zero exceptions in `screenToWorld`.
2. **Viewport Dimensions**: Viewport width and height must default to standard dimensions (800x600) when running in headless unit tests where `canvas.width` and `canvas.height` may not be present.
3. **Camera Projection Alignment**: When `camera` is passed to `worldToScreen`, $C_x$ and $C_y$ must represent the projected center, NOT the unprojected world coordinates. Our `Camera` class automatically provides `camera.x` and `camera.y` as the projected coordinates, matching `worldToScreen` seamlessly.
4. **Z-Elevation in Screen-to-World**: The mouse cursor interacts with the 2D canvas, which represents a 2D projection of 3D space. The unprojection specifically calculates the intersection with the ground plane ($W_z = 0$).

---

## 4. Conclusion & Concrete Implementation Specifications

The Worker should implement the following three core engine files and entity protocol:

### 4.1 `src/core/isometric.js`
Complete specification and exports:

```js
/**
 * 2:1 Dimetric Isometric Projection & Coordinate Transformation Engine.
 * Tile Width: 64px, Tile Height: 32px (2:1 dimetric ratio).
 */

export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;
export const HALF_TILE_WIDTH = 32;
export const HALF_TILE_HEIGHT = 16;

/**
 * Validates and sanitizes a coordinate value.
 * @param {number} val 
 * @param {number} fallback 
 * @returns {number}
 */
function sanitize(val, fallback = 0) {
  return Number.isFinite(val) ? val : fallback;
}

/**
 * Converts 3D continuous world coordinates (wx, wy, wz) to 2D canvas screen coordinates (sx, sy).
 * 
 * @param {number} wx - World X coordinate
 * @param {number} wy - World Y coordinate
 * @param {number} [wz=0] - World Z coordinate (elevation above ground)
 * @param {Object} [camera=null] - Camera object containing { x, y, width, height, zoom }
 * @param {number} [zoom=1.0] - Zoom multiplier override
 * @param {number} [tileWidth=TILE_WIDTH] - Custom tile width
 * @param {number} [tileHeight=TILE_HEIGHT] - Custom tile height
 * @returns {{ sx: number, sy: number }}
 */
export function worldToScreen(
  wx,
  wy,
  wz = 0,
  camera = null,
  zoom = 1.0,
  tileWidth = TILE_WIDTH,
  tileHeight = TILE_HEIGHT
) {
  const safeWx = sanitize(wx, 0);
  const safeWy = sanitize(wy, 0);
  const safeWz = sanitize(wz, 0);

  const tw2 = tileWidth / 2;
  const th2 = tileHeight / 2;

  // Camera parameters
  const cx = sanitize(camera?.x ?? camera?.cx, 0);
  const cy = sanitize(camera?.y ?? camera?.cy, 0);
  const vw = sanitize(camera?.viewportWidth ?? camera?.width, 800);
  const vh = sanitize(camera?.viewportHeight ?? camera?.height, 600);

  const effectiveZoom = sanitize(zoom ?? camera?.zoom, 1.0);
  const s = effectiveZoom > 0 ? effectiveZoom : 1.0;

  // 2:1 Dimetric Isometric Projection
  const isoX = (safeWx - safeWy) * tw2;
  const isoY = (safeWx + safeWy) * th2 - safeWz;

  const sx = (isoX - cx) * s + vw / 2;
  const sy = (isoY - cy) * s + vh / 2;

  return { sx, sy };
}

/**
 * Inverts 2D canvas screen coordinates (sx, sy) to continuous ground world coordinates (wx, wy) where wz = 0.
 * 
 * @param {number} sx - Screen pixel X
 * @param {number} sy - Screen pixel Y
 * @param {Object} [camera=null] - Camera object containing { x, y, width, height, zoom }
 * @param {number} [zoom=1.0] - Zoom multiplier override
 * @param {number} [tileWidth=TILE_WIDTH] - Custom tile width
 * @param {number} [tileHeight=TILE_HEIGHT] - Custom tile height
 * @returns {{ wx: number, wy: number }}
 */
export function screenToWorld(
  sx,
  sy,
  camera = null,
  zoom = 1.0,
  tileWidth = TILE_WIDTH,
  tileHeight = TILE_HEIGHT
) {
  const safeSx = sanitize(sx, 0);
  const safeSy = sanitize(sy, 0);

  const tw2 = tileWidth / 2;
  const th2 = tileHeight / 2;

  const cx = sanitize(camera?.x ?? camera?.cx, 0);
  const cy = sanitize(camera?.y ?? camera?.cy, 0);
  const vw = sanitize(camera?.viewportWidth ?? camera?.width, 800);
  const vh = sanitize(camera?.viewportHeight ?? camera?.height, 600);

  const effectiveZoom = sanitize(zoom ?? camera?.zoom, 1.0);
  const s = effectiveZoom > 0 ? effectiveZoom : 1.0;

  // Unproject from screen pixels to camera-relative projected space
  const isoX = (safeSx - vw / 2) / s + cx;
  const isoY = (safeSy - vh / 2) / s + cy;

  // Invert 2x2 dimetric system for ground plane (wz = 0)
  const wx = 0.5 * (isoX / tw2 + isoY / th2);
  const wy = 0.5 * (isoY / th2 - isoX / tw2);

  return { wx, wy };
}

/**
 * Calculates the depth key for painter's algorithm rendering.
 * @param {number} wx 
 * @param {number} wy 
 * @returns {number}
 */
export function getDepthKey(wx, wy) {
  return sanitize(wx, 0) + sanitize(wy, 0);
}

/**
 * Stable depth comparator for sorting dynamic entities.
 * Ties are broken using unique entity ID to eliminate z-fighting.
 * 
 * @param {Object} a - Entity A
 * @param {Object} b - Entity B
 * @returns {number}
 */
export function compareDepth(a, b) {
  const depthA = typeof a.getDepthKey === 'function' ? a.getDepthKey() : getDepthKey(a.x, a.y);
  const depthB = typeof b.getDepthKey === 'function' ? b.getDepthKey() : getDepthKey(b.x, b.y);

  if (Math.abs(depthA - depthB) > 1e-6) {
    return depthA - depthB;
  }

  // Stable tie-breaker by entity id
  const idA = String(a.id ?? '');
  const idB = String(b.id ?? '');
  return idA.localeCompare(idB);
}

/**
 * Euclidean distance helper between two points in continuous world space.
 * @param {number} x1 
 * @param {number} y1 
 * @param {number} x2 
 * @param {number} y2 
 * @returns {number}
 */
export function worldDistance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}
```

---

### 4.2 `src/core/camera.js`
Complete specification and exports:

```js
import { TILE_WIDTH, TILE_HEIGHT } from './isometric.js';

/**
 * Smooth Viewport Camera with Lerp Dampening & Boundary Clamping.
 */
export class Camera {
  /**
   * @param {Object} [options={}]
   * @param {number} [options.worldX=650] - Initial world X focus
   * @param {number} [options.worldY=650] - Initial world Y focus
   * @param {number} [options.viewportWidth=800] - Screen viewport width in pixels
   * @param {number} [options.viewportHeight=600] - Screen viewport height in pixels
   * @param {number} [options.zoom=1.0] - Viewport zoom factor
   * @param {number} [options.smoothing=8.0] - Exponential lerp decay factor
   * @param {Object} [options.bounds] - Map boundaries { minX, minY, maxX, maxY }
   * @param {Object} [options.target=null] - Initial follow target entity
   */
  constructor(options = {}) {
    this.worldX = options.worldX ?? 650;
    this.worldY = options.worldY ?? 650;
    this.viewportWidth = options.viewportWidth ?? options.width ?? 800;
    this.viewportHeight = options.viewportHeight ?? options.height ?? 600;
    this.zoom = options.zoom ?? 1.0;
    this.smoothing = options.smoothing ?? 8.0;
    this.target = options.target ?? null;
    this.isLocked = options.isLocked ?? true;

    this.bounds = options.bounds ?? {
      minX: 0,
      minY: 0,
      maxX: 3200,
      maxY: 3200
    };

    // Cached projected screen coordinates
    this._projX = 0;
    this._projY = 0;
    this._updateProjected();
  }

  /**
   * Projected focal X coordinate (Cx).
   * @returns {number}
   */
  get x() {
    return this._projX;
  }

  /**
   * Projected focal Y coordinate (Cy).
   * @returns {number}
   */
  get y() {
    return this._projY;
  }

  /**
   * Alias for viewportWidth.
   * @returns {number}
   */
  get width() {
    return this.viewportWidth;
  }

  /**
   * Alias for viewportHeight.
   * @returns {number}
   */
  get height() {
    return this.viewportHeight;
  }

  /**
   * Updates cached projected coordinates from world coordinates.
   * @private
   */
  _updateProjected() {
    const tw2 = TILE_WIDTH / 2;
    const th2 = TILE_HEIGHT / 2;
    this._projX = (this.worldX - this.worldY) * tw2;
    this._projY = (this.worldX + this.worldY) * th2;
  }

  /**
   * Sets target entity to follow smoothly.
   * @param {Object} target - Entity with { x, y } world coordinates
   */
  follow(target) {
    this.target = target;
    this.isLocked = true;
  }

  /**
   * Unbinds the camera from any target entity.
   */
  unfollow() {
    this.target = null;
    this.isLocked = false;
  }

  /**
   * Instantly snaps camera to a specific world location.
   * @param {number} wx 
   * @param {number} wy 
   */
  lookAt(wx, wy) {
    this.worldX = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, wx));
    this.worldY = Math.max(this.bounds.minY, Math.min(this.bounds.maxY, wy));
    this._updateProjected();
  }

  /**
   * Instantly centers camera on the current follow target if present.
   */
  recenter() {
    if (this.target && Number.isFinite(this.target.x) && Number.isFinite(this.target.y)) {
      this.lookAt(this.target.x, this.target.y);
    }
  }

  /**
   * Pans camera by a relative world delta.
   * @param {number} dx 
   * @param {number} dy 
   */
  pan(dx, dy) {
    this.worldX = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, this.worldX + dx));
    this.worldY = Math.max(this.bounds.minY, Math.min(this.bounds.maxY, this.worldY + dy));
    this._updateProjected();
  }

  /**
   * Resizes viewport dimensions on window resize.
   * @param {number} width 
   * @param {number} height 
   */
  resize(width, height) {
    if (Number.isFinite(width) && width > 0) this.viewportWidth = width;
    if (Number.isFinite(height) && height > 0) this.viewportHeight = height;
  }

  /**
   * Updates camera position per tick using exponential lerp dampening.
   * @param {number} dt - Timestep in seconds (e.g. 0.01667)
   */
  update(dt = 0.01667) {
    if (!this.target || !this.isLocked) return;

    // Check target liveness / validity
    if (this.target.isDead || (typeof this.target.hp === 'number' && this.target.hp <= 0)) {
      return; // Hold last position
    }

    const targetX = this.target.x ?? this.worldX;
    const targetY = this.target.y ?? this.worldY;

    // Frame-rate independent exponential decay: 1 - exp(-lambda * dt)
    const factor = 1.0 - Math.exp(-this.smoothing * Math.max(0, dt));

    this.worldX += (targetX - this.worldX) * factor;
    this.worldY += (targetY - this.worldY) * factor;

    // Viewport bounds clamping
    this.worldX = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, this.worldX));
    this.worldY = Math.max(this.bounds.minY, Math.min(this.bounds.maxY, this.worldY));

    this._updateProjected();
  }
}
```

---

### 4.3 `src/core/loop.js`
Complete specification and exports:

```js
/**
 * Deterministic Fixed-Timestep Game Loop with Spiral-of-Death Protection.
 * Standard update step: 16.67ms (60 Hz simulation).
 */

export const FIXED_TIMESTEP = 1000 / 60; // 16.6667 ms
export const MAX_ACCUMULATOR = 100; // 100 ms max frame accumulation cap

const safeRAF = typeof requestAnimationFrame !== 'undefined'
  ? requestAnimationFrame
  : (cb) => setTimeout(() => cb(Date.now()), 16);

const safeCAF = typeof cancelAnimationFrame !== 'undefined'
  ? cancelAnimationFrame
  : (id) => clearTimeout(id);

export class GameLoop {
  /**
   * @param {Object} [options={}]
   * @param {Function} [options.onUpdate] - Fixed update callback: (dtMs, tickIndex) => void
   * @param {Function} [options.onRender] - Variable render callback: (alpha, frameTimeMs) => void
   * @param {number} [options.fixedTimestep=FIXED_TIMESTEP] - Fixed step duration in ms
   * @param {number} [options.maxAccumulator=MAX_ACCUMULATOR] - Max frame time cap in ms
   */
  constructor(options = {}) {
    this.onUpdate = options.onUpdate ?? (() => {});
    this.onRender = options.onRender ?? (() => {});
    this.fixedTimestep = options.fixedTimestep ?? FIXED_TIMESTEP;
    this.maxAccumulator = options.maxAccumulator ?? MAX_ACCUMULATOR;

    this.accumulator = 0;
    this.lastTime = 0;
    this.tickCount = 0;
    this.frameCount = 0;
    this.fps = 60;
    this._fpsTimer = 0;
    this._fpsFrames = 0;

    this.running = false;
    this.paused = false;
    this._rafId = null;

    this._frameBound = this._frame.bind(this);
  }

  /**
   * Starts the game loop.
   */
  start() {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.lastTime = 0;
    this.accumulator = 0;
    this._rafId = safeRAF(this._frameBound);
  }

  /**
   * Stops and resets the game loop.
   */
  stop() {
    this.running = false;
    this.paused = false;
    if (this._rafId !== null) {
      safeCAF(this._rafId);
      this._rafId = null;
    }
  }

  /**
   * Pauses simulation updates while maintaining current time.
   */
  pause() {
    this.paused = true;
  }

  /**
   * Resumes paused simulation.
   */
  resume() {
    this.paused = false;
    this.lastTime = 0; // reset to avoid accumulator burst on unpause
  }

  /**
   * Manual step method for headless testing or deterministic replay.
   * @param {number} deltaMs - Elapsed time in milliseconds
   */
  step(deltaMs) {
    const frameTime = Math.min(deltaMs, this.maxAccumulator);
    this.accumulator += frameTime;

    while (this.accumulator >= this.fixedTimestep) {
      this.onUpdate(this.fixedTimestep, this.tickCount);
      this.accumulator -= this.fixedTimestep;
      this.tickCount++;
    }

    const alpha = this.accumulator / this.fixedTimestep;
    this.onRender(alpha, frameTime);
  }

  /**
   * Internal animation frame processor.
   * @private
   * @param {number} timestamp 
   */
  _frame(timestamp) {
    if (!this.running) return;

    if (this.lastTime === 0) {
      this.lastTime = timestamp;
    }

    let frameTime = timestamp - this.lastTime;
    this.lastTime = timestamp;

    // FPS calculation
    this._fpsTimer += frameTime;
    this._fpsFrames++;
    if (this._fpsTimer >= 1000) {
      this.fps = Math.round((this._fpsFrames * 1000) / this._fpsTimer);
      this._fpsTimer = 0;
      this._fpsFrames = 0;
    }

    if (!this.paused) {
      // Spiral-of-death protection
      if (frameTime > this.maxAccumulator) {
        frameTime = this.maxAccumulator;
      }
      this.accumulator += frameTime;

      // Drain fixed update ticks
      while (this.accumulator >= this.fixedTimestep) {
        this.onUpdate(this.fixedTimestep, this.tickCount);
        this.accumulator -= this.fixedTimestep;
        this.tickCount++;
      }
    }

    // Render with interpolation fraction
    const alpha = this.fixedTimestep > 0 ? this.accumulator / this.fixedTimestep : 0;
    this.onRender(alpha, frameTime);
    this.frameCount++;

    if (this.running) {
      this._rafId = safeRAF(this._frameBound);
    }
  }

  /**
   * Retrieves runtime performance statistics.
   * @returns {{ fps: number, tickCount: number, frameCount: number, running: boolean, paused: boolean }}
   */
  getStats() {
    return {
      fps: this.fps,
      tickCount: this.tickCount,
      frameCount: this.frameCount,
      running: this.running,
      paused: this.paused
    };
  }
}
```

---

### 4.4 Entity Coordinate Standard (`src/entities/entity.js`)
All game entities (Hero, Minion, Tower, Boss, Projectile) must adhere to the following contract:
- **Continuous Coordinates**:
  - `this.x`: Continuous world X coordinate ($[0, 3200]$)
  - `this.y`: Continuous world Y coordinate ($[0, 3200]$)
  - `this.z`: Continuous elevation ($0$ for ground units; $>0$ for airborne projectiles)
- **Depth Protocol**:
  ```js
  getDepthKey() {
    return this.x + this.y;
  }
  ```
- **Radius / Colliders**:
  - `this.radius`: Continuous circular collision radius (Hero: 20–25, Tower: 40, Nexus: 70).
- **Liveness**:
  - `this.isDead`: boolean (Camera stops following when true).

---

## 5. Verification Method

To verify the core engine math and architecture independently, execute these tests in Node.js or the browser:

### 5.1 Verification Test Script (`tests/unit/m1_math.test.js`)
```js
import { worldToScreen, screenToWorld, getDepthKey, compareDepth } from '../../src/core/isometric.js';
import { Camera } from '../../src/core/camera.js';
import { GameLoop, FIXED_TIMESTEP } from '../../src/core/loop.js';

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion Failed: ${message}`);
}

function assertClose(actual, expected, eps = 1e-4, message = '') {
  if (Math.abs(actual - expected) > eps) {
    throw new Error(`Assertion Failed: ${message} (Expected ${expected}, got ${actual})`);
  }
}

console.log('Running Milestone 1 Engine Math Verification...');

// 1. Spec Miner Baseline Test
{
  const camera = { x: 0, y: 0, width: 800, height: 600, zoom: 1.0 };
  const { sx, sy } = worldToScreen(1000, 1000, 0, camera, 1.0);
  assertClose(sx, 400, 1e-4, 'Baseline worldToScreen SX must equal 400');
  assertClose(sy, 32300, 1e-4, 'Baseline worldToScreen SY must equal 32300');

  // Inverse Round-Trip Identity
  const { wx, wy } = screenToWorld(sx, sy, camera, 1.0);
  assertClose(wx, 1000, 1e-4, 'Baseline screenToWorld WX must equal 1000');
  assertClose(wy, 1000, 1e-4, 'Baseline screenToWorld WY must equal 1000');
}

// 2. Camera Centering Test
{
  const hero = { x: 650, y: 650 };
  const camera = new Camera({ worldX: 650, worldY: 650, width: 800, height: 600 });
  const { sx, sy } = worldToScreen(hero.x, hero.y, 0, camera);
  assertClose(sx, 400, 1e-4, 'Camera-centered hero must be at screen X center (400)');
  assertClose(sy, 300, 1e-4, 'Camera-centered hero must be at screen Y center (300)');
}

// 3. Camera Boundary Clamping & Follow Lerp Test
{
  const hero = { x: -500, y: 4000 };
  const camera = new Camera({ bounds: { minX: 0, minY: 0, maxX: 3200, maxY: 3200 } });
  camera.follow(hero);
  camera.update(1.0); // 1s lerp
  assert(camera.worldX >= 0, 'Camera worldX clamped to minX');
  assert(camera.worldY <= 3200, 'Camera worldY clamped to maxY');
}

// 4. GameLoop Deterministic Fixed Timestep Test
{
  let updates = 0;
  const loop = new GameLoop({
    fixedTimestep: 16.6667,
    onUpdate: () => { updates++; }
  });
  // Simulate 100ms lag
  loop.step(100);
  assert(updates === 6, `100ms must trigger exactly 6 ticks (got ${updates})`);

  // Test accumulator cap (300ms spike capped at 100ms -> 6 ticks)
  updates = 0;
  loop.step(300);
  assert(updates === 6, `300ms spike must be capped at 100ms -> 6 ticks (got ${updates})`);
}

// 5. Depth Sorting & Stable Tie-Breaking Test
{
  const entities = [
    { id: 'b', x: 10, y: 20 }, // depth 30
    { id: 'a', x: 20, y: 10 }, // depth 30
    { id: 'c', x: 5, y: 5 },   // depth 10
    { id: 'd', x: 50, y: 50 }  // depth 100
  ];
  entities.sort(compareDepth);
  assert(entities[0].id === 'c', 'Depth 10 entity must come first');
  assert(entities[1].id === 'a', 'Depth 30 tie-breaker id "a" must precede "b"');
  assert(entities[2].id === 'b', 'Depth 30 tie-breaker id "b"');
  assert(entities[3].id === 'd', 'Depth 100 entity must come last');
}

console.log('All Milestone 1 Engine Math Verification tests passed successfully!');
```
