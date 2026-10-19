import { TILE_WIDTH, TILE_HEIGHT } from './isometric.js';

/**
 * Smooth Viewport Camera with Lerp Dampening & Boundary Clamping.
 *
 * Tracks world focal point (worldX, worldY) and projected focal point (x, y).
 */
export class Camera {
  /**
   * @param {Object} [options={}]
   * @param {number} [options.worldX=650] - Initial world X focus
   * @param {number} [options.worldY=650] - Initial world Y focus
   * @param {number} [options.viewportWidth=1280] - Screen viewport width in pixels
   * @param {number} [options.viewportHeight=720] - Screen viewport height in pixels
   * @param {number} [options.zoom=1.0] - Viewport zoom factor
   * @param {number} [options.smoothing=8.0] - Exponential lerp decay factor
   * @param {Object} [options.bounds] - Map boundaries { minX, minY, maxX, maxY }
   * @param {Object} [options.target=null] - Initial follow target entity
   * @param {boolean} [options.isLocked=true] - Whether target tracking is locked
   */
  constructor(options = {}) {
    this.worldX = options.worldX ?? 650;
    this.worldY = options.worldY ?? 650;
    this.viewportWidth = options.viewportWidth ?? options.width ?? 1280;
    this.viewportHeight = options.viewportHeight ?? options.height ?? 720;
    this.minZoom = options.minZoom ?? 0.6;
    this.maxZoom = options.maxZoom ?? 1.6;
    const initialZoom = options.zoom ?? 0.75;
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, initialZoom));
    this.targetZoom = this.zoom;
    this.zoomSmoothing = options.zoomSmoothing ?? 12.0;

    // Perspective rotation in radians (default -3 * Math.PI / 4 for canonical MOBA bottom-left to top-right diagonal)
    this.rotation = options.rotation ?? options.angle ?? (-3 * Math.PI / 4);
    this.targetRotation = this.rotation;
    this.rotationSmoothing = options.rotationSmoothing ?? 12.0;

    this.smoothing = options.smoothing ?? 8.0;
    this.target = options.target ?? null;
    this.isLocked = options.isLocked ?? true;

    this.bounds = options.bounds ?? {
      minX: 0,
      minY: 0,
      maxX: 3200,
      maxY: 3200
    };

    // Trauma & screen shake model
    this.trauma = 0.0;
    this.traumaDecay = options.traumaDecay ?? 2.0;
    this.maxShakeX = options.maxShakeX ?? 14;
    this.maxShakeY = options.maxShakeY ?? 10;
    this.maxShakeRoll = options.maxShakeRoll ?? 0.02;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
    this.shakeRoll = 0;
    this.shakeEnabled = options.shakeEnabled ?? true;

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
   * Alias for projected X.
   * @returns {number}
   */
  get cx() {
    return this._projX;
  }

  /**
   * Alias for projected Y.
   * @returns {number}
   */
  get cy() {
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
    this._projX = (this.worldX - this.worldY) * 0.5;
    this._projY = (this.worldX + this.worldY) * 0.25;
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
    const safeWx = Number.isFinite(wx) ? wx : this.worldX;
    const safeWy = Number.isFinite(wy) ? wy : this.worldY;
    this.worldX = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, safeWx));
    this.worldY = Math.max(this.bounds.minY, Math.min(this.bounds.maxY, safeWy));
    this._updateProjected();
  }

  /**
   * Alias for lookAt.
   */
  snapTo(wx, wy) {
    this.lookAt(wx, wy);
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
   * Sets target zoom clamped to [minZoom, maxZoom].
   * @param {number} z 
   * @param {boolean} [instant=false]
   */
  setZoom(z, instant = false) {
    if (typeof z !== 'number' || !Number.isFinite(z)) return;
    this.targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, z));
    if (instant) {
      this.zoom = this.targetZoom;
    }
  }

  /**
   * Adjusts target zoom by a delta offset, clamped to [minZoom, maxZoom].
   * @param {number} delta 
   */
  zoomBy(delta) {
    if (typeof delta !== 'number' || !Number.isFinite(delta)) return;
    this.setZoom(this.targetZoom + delta);
  }

  /**
   * Instantly snaps zoom to a specific value without lerp dampening.
   * @param {number} z 
   */
  snapZoom(z) {
    this.setZoom(z, true);
  }

  /**
   * Sets target camera perspective rotation angle in radians.
   * @param {number} angle 
   * @param {boolean} [instant=false]
   */
  setRotation(angle, instant = false) {
    if (typeof angle !== 'number' || !Number.isFinite(angle)) return;
    this.targetRotation = angle;
    if (instant) {
      this.rotation = angle;
    }
  }

  /**
   * Rotates perspective by 90-degree increments (step * PI/2).
   * @param {number} [step=1] 
   */
  rotatePerspective(step = 1) {
    const delta = (Math.PI / 2) * step;
    this.setRotation(this.targetRotation + delta);
  }

  /**
   * Cycles perspective angle to the next/previous 90-degree quadrant.
   * @param {number} [direction=1] 
   */
  cyclePerspective(direction = 1) {
    this.rotatePerspective(direction);
  }

  /**
   * Adds trauma to camera, clamped to [0.0, 1.0].
   * @param {number} amount
   */
  addTrauma(amount) {
    if (typeof amount !== 'number' || !Number.isFinite(amount)) return;
    this.trauma = Math.min(1.0, this.trauma + Math.max(0, amount));
  }

  /**
   * Enables or disables screen shake. When disabled, resets shake offsets.
   * @param {boolean} enabled
   */
  setShakeEnabled(enabled) {
    this.shakeEnabled = !!enabled;
    if (!this.shakeEnabled) {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
      this.shakeRoll = 0;
    }
  }

  /**
   * Updates camera position, zoom, and perspective rotation per tick using exponential lerp dampening.
   * @param {number} dt - Timestep in seconds (e.g. 0.01667)
   */
  update(dt = 0.01667) {
    const safeDt = Number.isFinite(dt) && dt > 0 ? dt : 0;

    // Smooth exponential decay lerp for zoom clamped to [minZoom, maxZoom]
    if (Math.abs(this.targetZoom - this.zoom) > 1e-4) {
      this.zoom += (this.targetZoom - this.zoom) * (1.0 - Math.exp(-this.zoomSmoothing * safeDt));
      this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom));
    } else {
      this.zoom = this.targetZoom;
    }

    // Smooth exponential decay lerp for perspective rotation
    if (Math.abs(this.targetRotation - this.rotation) > 1e-4) {
      this.rotation += (this.targetRotation - this.rotation) * (1.0 - Math.exp(-this.rotationSmoothing * safeDt));
    } else {
      this.rotation = this.targetRotation;
    }

    // Screen shake trauma decay and non-linear displacement
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - this.traumaDecay * safeDt);
      const shake = this.trauma * this.trauma;
      if (shake > 0 && this.shakeEnabled) {
        this.shakeOffsetX = (Math.random() * 2 - 1) * this.maxShakeX * shake;
        this.shakeOffsetY = (Math.random() * 2 - 1) * this.maxShakeY * shake;
        this.shakeRoll = (Math.random() * 2 - 1) * this.maxShakeRoll * shake;
      } else {
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
        this.shakeRoll = 0;
      }
    } else {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
      this.shakeRoll = 0;
    }

    if (!this.target || !this.isLocked) {
      this._updateProjected();
      return;
    }

    // Check target liveness / validity
    const isDead = typeof this.target.isDead === 'function' ? this.target.isDead() : !!this.target.isDead;
    const isZeroHp = typeof this.target.hp === 'number' && this.target.hp <= 0;
    if (isDead || isZeroHp) {
      return; // Hold last position
    }

    const targetX = Number.isFinite(this.target?.x) ? this.target.x : this.worldX;
    const targetY = Number.isFinite(this.target?.y) ? this.target.y : this.worldY;

    // Frame-rate independent exponential decay: 1 - exp(-lambda * dt)
    const factor = 1.0 - Math.exp(-this.smoothing * safeDt);

    this.worldX += (targetX - this.worldX) * factor;
    this.worldY += (targetY - this.worldY) * factor;

    // Viewport bounds clamping
    this.worldX = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, this.worldX));
    this.worldY = Math.max(this.bounds.minY, Math.min(this.bounds.maxY, this.worldY));

    this._updateProjected();
  }
}
