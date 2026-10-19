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
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;

    const frameTime = Math.min(deltaMs, this.maxAccumulator);
    this.accumulator += frameTime;

    while (this.accumulator >= this.fixedTimestep - 1e-3) {
      this.onUpdate(this.fixedTimestep, this.tickCount);
      this.accumulator = Math.max(0, this.accumulator - this.fixedTimestep);
      this.tickCount++;
    }

    const alpha = this.fixedTimestep > 0 ? this.accumulator / this.fixedTimestep : 0;
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
      while (this.accumulator >= this.fixedTimestep - 1e-3) {
        this.onUpdate(this.fixedTimestep, this.tickCount);
        this.accumulator = Math.max(0, this.accumulator - this.fixedTimestep);
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
