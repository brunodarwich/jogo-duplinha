import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue, assertFalse, assertLess, assertLessOrEqual, assertGreater } from '../helpers/assert.js';
import { resolveModule } from '../helpers/module_resolver.js';

// =========================================================================
// MOCK WEB AUDIO INFRASTRUCTURE FOR M5 VALIDATION
// =========================================================================

class MockAudioParam {
  constructor(defaultValue = 0) {
    this.value = defaultValue;
    this.calls = [];
  }
  setValueAtTime(val, time) {
    this.value = val;
    this.calls.push({ method: 'setValueAtTime', value: val, time });
    return this;
  }
  exponentialRampToValueAtTime(val, time) {
    this.value = val;
    this.calls.push({ method: 'exponentialRampToValueAtTime', value: val, time });
    return this;
  }
  linearRampToValueAtTime(val, time) {
    this.value = val;
    this.calls.push({ method: 'linearRampToValueAtTime', value: val, time });
    return this;
  }
}

class MockAudioNode {
  constructor() {
    this.connections = [];
  }
  connect(dest) {
    this.connections.push(dest);
    return dest;
  }
  disconnect() {
    this.connections = [];
  }
}

class MockGainNode extends MockAudioNode {
  constructor(defaultGain = 1.0) {
    super();
    this.gain = new MockAudioParam(defaultGain);
  }
}

class MockOscillatorNode extends MockAudioNode {
  constructor() {
    super();
    this.type = 'sine';
    this.frequency = new MockAudioParam(440);
    this.detune = new MockAudioParam(0);
    this.started = false;
    this.stopped = false;
    this.startTime = null;
    this.stopTime = null;
  }
  start(t = 0) {
    this.started = true;
    this.startTime = t;
  }
  stop(t = 0) {
    this.stopped = true;
    this.stopTime = t;
  }
}

class MockBiquadFilterNode extends MockAudioNode {
  constructor() {
    super();
    this.type = 'lowpass';
    this.frequency = new MockAudioParam(350);
    this.Q = new MockAudioParam(1);
  }
}

class MockAudioBuffer {
  constructor(numberOfChannels, length, sampleRate) {
    this.numberOfChannels = numberOfChannels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.channelData = [new Float32Array(length)];
  }
  getChannelData(index) {
    return this.channelData[index] || this.channelData[0];
  }
}

class MockAudioBufferSourceNode extends MockAudioNode {
  constructor() {
    super();
    this.buffer = null;
    this.loop = false;
    this.started = false;
    this.stopped = false;
    this.startTime = null;
    this.stopTime = null;
  }
  start(t = 0) {
    this.started = true;
    this.startTime = t;
  }
  stop(t = 0) {
    this.stopped = true;
    this.stopTime = t;
  }
}

class MockAudioContext {
  constructor(options = {}) {
    this.sampleRate = options.sampleRate || 48000;
    this.currentTime = options.currentTime || 0;
    this.state = options.state || 'suspended';
    this.destination = new MockAudioNode();
    this.createdOscillators = [];
    this.createdGains = [];
    this.createdFilters = [];
    this.createdBufferSources = [];
    this.createdBuffers = [];
  }
  createGain() {
    const node = new MockGainNode();
    this.createdGains.push(node);
    return node;
  }
  createOscillator() {
    const node = new MockOscillatorNode();
    this.createdOscillators.push(node);
    return node;
  }
  createBiquadFilter() {
    const node = new MockBiquadFilterNode();
    this.createdFilters.push(node);
    return node;
  }
  createBuffer(channels, length, sampleRate) {
    const buf = new MockAudioBuffer(channels, length, sampleRate);
    this.createdBuffers.push(buf);
    return buf;
  }
  createBufferSource() {
    const node = new MockAudioBufferSourceNode();
    this.createdBufferSources.push(node);
    return node;
  }
  async resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  async close() {
    this.state = 'closed';
    return Promise.resolve();
  }
}

// =========================================================================
// MARCO 5 TEST SUITE: INTEGRATION, E2E, 60 FPS BENCHMARK & INVARIANTS
// =========================================================================

describe('Tier 4 E2E: Marco 5 — Final Integration, 60 FPS Stability & System Invariants', () => {

  it('TC-M5-01: 1,000-Frame GameSimulation Benchmark (60 FPS Stability < 16.6ms/frame)', async () => {
    const { module: gameMod } = await resolveModule('game');
    const { module: soundMod } = await resolveModule('audio/sound');
    assertEqual(typeof gameMod.GameSimulation, 'function', 'GameSimulation must be exported');

    const mockCtx = new MockAudioContext({ sampleRate: 48000 });
    const soundEngine = new soundMod.SoundEngine({ audioContext: mockCtx, volume: 0.8 });

    const sim = new gameMod.GameSimulation({
      heroClass: 'knight',
      isHost: true,
      soundEngine
    });

    assertTrue(!!sim.playerHero, 'Player hero must be initialized');
    assertTrue(sim.entities.length > 0, 'Entities array must be populated with towers and nexus');

    const TOTAL_FRAMES = 1000;
    const DT = 0.01667; // 60 FPS frame step (16.67ms)
    const frameTimes = [];

    const benchStartTime = performance.now();

    for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
      const frameStart = performance.now();

      // Periodically inject varied game actions (combat, moves, spells, floating text)
      if (frame % 30 === 0) {
        sim.handleCommand({
          type: 'MOVE',
          targetX: 800 + (frame % 400),
          targetY: 800 + (frame % 400)
        });
      }

      if (frame % 45 === 0) {
        sim.particles.emitHeroAttackHit('knight', sim.playerHero.x, sim.playerHero.y, frame % 90 === 0);
        sim.sound.playAttack('knight', false);
      }

      if (frame % 60 === 0) {
        sim.handleSkillError('Q', 'cooldown', 2.5);
      }

      if (frame % 120 === 0 && sim.camera) {
        sim.camera.addTrauma(0.25);
      }

      // Step the simulation
      sim.update(DT, frame);

      const frameDuration = performance.now() - frameStart;
      frameTimes.push(frameDuration);
    }

    const totalBenchDuration = performance.now() - benchStartTime;
    const avgFrameTime = totalBenchDuration / TOTAL_FRAMES;
    const maxFrameTime = Math.max(...frameTimes);

    // Assert that average frame time is well within the 16.6ms budget (< 8.0ms target in Node.js)
    assertLess(avgFrameTime, 16.6, `Average frame time must be < 16.6ms for 60 FPS. Got: ${avgFrameTime.toFixed(3)}ms`);
    assertLess(maxFrameTime, 50.0, `Spike frame time must not exceed 50.0ms. Got: ${maxFrameTime.toFixed(3)}ms`);

    // Invariant assertions
    assertEqual(sim.matchTime > 0, true, 'Match time must advance');
    assertLessOrEqual(sim.particles.particles.length, 500, 'Particles must stay within 500 cap');
    assertLessOrEqual(sim.particles.floatingTexts.length, 200, 'Floating texts must stay within 200 cap');
  });

  it('TC-M5-02: ParticleSystem Memory Containment & FIFO Eviction Invariants', async () => {
    const { module: particleMod } = await resolveModule('render/particles');
    assertEqual(typeof particleMod.ParticleSystem, 'function', 'ParticleSystem must be exported');

    const ps = new particleMod.ParticleSystem();
    assertEqual(ps.maxParticles, 500, 'maxParticles must strictly equal 500');
    assertEqual(ps.maxFloatingTexts, 200, 'maxFloatingTexts must strictly equal 200');

    // 1. Emit 2,500 particles of diverse types
    const types = ['burst', 'spark', 'fire', 'frost', 'heal', 'ring', 'cc_ring', 'confetti', 'trail'];
    for (let i = 0; i < 250; i++) {
      const t = types[i % types.length];
      ps.emit(t, { x: 100 + i, y: 100 + i, count: 10 });
      assertLessOrEqual(ps.particles.length, 500, 'Particle pool must never exceed 500');
    }
    assertEqual(ps.particles.length, 500, 'Particle pool must cap at exactly 500');

    // 2. FIFO order verification: the oldest particles must have been evicted
    const firstRemaining = ps.particles[0];
    assertTrue(firstRemaining.x > 100, 'Oldest particles from initial burst must have been evicted');

    // 3. Floating combat text containment: spam 500 floating texts
    for (let i = 0; i < 500; i++) {
      ps.addFloatingText(`Damage ${i}`, 200, 200, { fontSize: 14 });
      assertLessOrEqual(ps.floatingTexts.length, 200, 'Floating texts must never exceed maxFloatingTexts (200)');
    }
    assertEqual(ps.floatingTexts.length, 200, 'Floating texts must cap at 200');

    // FIFO check on floating texts
    assertEqual(ps.floatingTexts[ps.floatingTexts.length - 1].text, 'Damage 499', 'Latest floating text must be preserved');
    assertEqual(ps.floatingTexts[0].text, 'Damage 300', 'Oldest floating texts (0-299) must have been evicted');

    // 4. Update until natural lifecycle drainage
    for (let step = 0; step < 40; step++) {
      ps.update(0.05); // 2.0s total (all particles have life <= 1.2s)
    }
    assertEqual(ps.particles.length, 0, 'All particles must expire and be collected cleanly');
    assertEqual(ps.floatingTexts.length, 0, 'All floating texts must expire cleanly');

    // 5. Clear method reset verification
    ps.emit('fire', { x: 50, y: 50, count: 20 });
    ps.addFloatingText('Test', 50, 50);
    assertTrue(ps.particles.length > 0);
    assertTrue(ps.floatingTexts.length > 0);
    ps.clear();
    assertEqual(ps.particles.length, 0, 'clear() must reset particles array');
    assertEqual(ps.floatingTexts.length, 0, 'clear() must reset floatingTexts array');
  });

  it('TC-M5-03: SoundEngine Zero-Leak Architecture & Web Audio Lifecycle Invariants', async () => {
    const { module: soundMod } = await resolveModule('audio/sound');
    assertEqual(typeof soundMod.SoundEngine, 'function', 'SoundEngine must be exported');

    const mockCtx = new MockAudioContext({ sampleRate: 48000, currentTime: 1.0 });
    const sound = new soundMod.SoundEngine({ audioContext: mockCtx, volume: 0.7 });

    // 1. Static noise buffer verification
    assertTrue(!!sound.noiseBuffer, 'Noise buffer must be initialized');
    assertEqual(sound.noiseBuffer.length, 48000, 'Noise buffer must be exactly 48,000 samples (1.0s at 48kHz)');
    assertEqual(sound.noiseBuffer.sampleRate, 48000, 'Noise buffer sample rate must match context');

    // 2. Execute 1,000 diverse procedural SFX calls
    const initialOscCount = mockCtx.createdOscillators.length;
    const initialBufferSourceCount = mockCtx.createdBufferSources.length;

    for (let i = 0; i < 50; i++) {
      sound.playUiClick();
      sound.playAttack('knight', false);
      sound.playAttack('ranger', true);
      sound.playAttack('sorceress', false);
      sound.playAttack('cleric', false);
      sound.playAttack('assassin', false);
      sound.playHit(false);
      sound.playHit(true);
      sound.playSkill('Q', 'knight');
      sound.playSkill('W', 'sorceress');
      sound.playSkill('E', 'ranger');
      sound.playSkill('R', 'assassin');
      sound.playLevelUp();
      sound.playShopBuy();
      sound.playShopSell();
      sound.playAlertBoss();
      sound.playVictory();
      sound.playDefeat();
    }

    // Confirm node creation occurred
    assertGreater(mockCtx.createdOscillators.length, initialOscCount);
    assertGreater(mockCtx.createdBufferSources.length, initialBufferSourceCount);

    // Verify all created oscillators have start() and stop() scheduled properly
    for (const osc of mockCtx.createdOscillators) {
      assertTrue(osc.started, 'All created oscillators must have started');
      assertTrue(osc.stopped, 'All created oscillators must have stopped to prevent audio engine leak');
      assertTrue(osc.stopTime >= osc.startTime, 'Oscillator stopTime must be >= startTime');
    }

    // Verify all buffer sources have start() and stop() scheduled properly
    for (const src of mockCtx.createdBufferSources) {
      assertTrue(src.started, 'All buffer sources must have started');
      assertTrue(src.stopped, 'All buffer sources must have stopped');
      assertTrue(src.stopTime >= src.startTime, 'Buffer source stopTime must be >= startTime');
    }

    // 3. Confirm SoundEngine instance does NOT retain an array or set of past sound nodes
    const soundKeys = Object.keys(sound);
    for (const key of soundKeys) {
      const val = sound[key];
      if (Array.isArray(val)) {
        assertEqual(val.length === 0, true, `SoundEngine property ${key} must not retain arrays of past nodes`);
      }
    }

    // 4. Recall sustained channel lifecycle check
    assertEqual(sound.activeRecallSource, null, 'No active recall initially');
    sound.playRecallStart();
    assertTrue(sound.activeRecallSource !== null, 'activeRecallSource must track the active recall node pair');

    // Interrupt recall
    sound.playRecallInterrupt();
    assertEqual(sound.activeRecallSource, null, 'activeRecallSource must be cleaned up on interruption');

    // Start again and complete recall
    sound.playRecallStart();
    assertTrue(sound.activeRecallSource !== null);
    sound.playRecallComplete();
    assertEqual(sound.activeRecallSource, null, 'activeRecallSource must be cleaned up on completion');
  });

  it('TC-M5-04: Headless Safety & Pure Node.js Environmental Robustness', async () => {
    // Verify that every module instantiates and executes without Canvas, DOM, or Web Audio
    const { module: soundMod } = await resolveModule('audio/sound');
    const { module: particleMod } = await resolveModule('render/particles');
    const { module: cameraMod } = await resolveModule('core/camera');
    const { module: bannerMod } = await resolveModule('ui/event_banners');
    const { module: tooltipMod } = await resolveModule('ui/tooltip');
    const { module: hudMod } = await resolveModule('ui/hud');
    const { module: gameMod } = await resolveModule('game');

    // 1. Headless SoundEngine
    const headlessSound = new soundMod.SoundEngine();
    assertFalse(headlessSound.isSupported, 'Headless SoundEngine must report isSupported=false');
    assertEqual(headlessSound.ctx, null);
    assertEqual(headlessSound.playUiClick(), null);
    assertEqual(headlessSound.playAttack('knight', false), null);
    assertEqual(headlessSound.playHit(true), null);
    assertEqual(headlessSound.play('unknown_sound'), null);

    // 2. Headless ParticleSystem
    const ps = new particleMod.ParticleSystem();
    ps.emit('fire', { x: 10, y: 10 });
    ps.addFloatingText('Test', 10, 10);
    ps.update(0.016);
    ps.draw(null, null, 1.0); // Null canvas context must be a safe no-op

    // 3. Headless Camera
    const cam = new cameraMod.Camera();
    cam.addTrauma(0.5);
    cam.update(0.016);
    assertTrue(Number.isFinite(cam.shakeOffsetX));
    assertTrue(Number.isFinite(cam.shakeOffsetY));
    assertTrue(Number.isFinite(cam.shakeRoll));

    // 4. Headless EventBannerManager
    const banners = new bannerMod.EventBannerManager(null);
    banners.announceFirstBlood('Knight', 'Sorceress', 'allied');
    banners.announceBossSpawn('Stone Colossus', 5);
    banners.showVictoryBanner();
    banners.clear();

    // 5. Headless TooltipController
    const tooltip = new tooltipMod.TooltipController();
    tooltip.showAbilityTooltip({}, {}, null);
    tooltip.showItemTooltip({}, null);
    tooltip.hide();

    // 6. Headless HUDController
    const hud = new hudMod.HUDController();
    hud.update(null, {}, null);

    // 7. Headless GameSimulation
    const sim = new gameMod.GameSimulation({ heroClass: 'ranger', isHost: true });
    sim.update(0.016);
    assertTrue(sim.matchTime > 0);
  });

  it('TC-M5-05: Web Audio Autoplay Policy Compliance & Gesture Unlock', async () => {
    const { module: soundMod } = await resolveModule('audio/sound');

    // Mock browser window and DOM event listeners
    const registeredListeners = new Map();
    const mockWindow = {
      addEventListener(type, listener, opts) {
        if (!registeredListeners.has(type)) registeredListeners.set(type, []);
        registeredListeners.get(type).push({ listener, opts });
      },
      removeEventListener(type, listener) {
        if (!registeredListeners.has(type)) return;
        const list = registeredListeners.get(type);
        const idx = list.findIndex(entry => entry.listener === listener);
        if (idx >= 0) list.splice(idx, 1);
      }
    };

    const mockCtx = new MockAudioContext({ state: 'suspended' });

    // Save global window if existing
    const prevWindow = globalThis.window;
    globalThis.window = mockWindow;

    try {
      const sound = new soundMod.SoundEngine({ audioContext: mockCtx });

      assertEqual(sound.ctx.state, 'suspended', 'Audio context must remain suspended initially');
      assertTrue(registeredListeners.has('pointerdown'), 'pointerdown listener must be attached');
      assertTrue(registeredListeners.has('keydown'), 'keydown listener must be attached');
      assertTrue(registeredListeners.has('touchstart'), 'touchstart listener must be attached');

      // Simulate user gesture unlock via pointerdown
      const pointerDownEntries = registeredListeners.get('pointerdown') || [];
      assertTrue(pointerDownEntries.length > 0, 'At least one pointerdown listener attached');

      const unlockHandler = pointerDownEntries[0].listener;
      await unlockHandler();

      // Audio context state should transition to running
      assertEqual(mockCtx.state, 'running', 'Audio context must transition to running on gesture');

      // Test explicit resume() method
      await sound.resume();
      assertEqual(mockCtx.state, 'running', 'Explicit resume() must ensure running state');
    } finally {
      // Restore previous global window
      if (prevWindow === undefined) {
        delete globalThis.window;
      } else {
        globalThis.window = prevWindow;
      }
    }
  });

  it('TC-M5-06: Responsive CSS Multi-Resolution Breakpoints & Layout Contracts', async () => {
    const cssPath = path.resolve(process.cwd(), 'style.css');
    assertTrue(fs.existsSync(cssPath), 'style.css must exist at root');

    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    // 1. Breakpoint 1: Base desktop layout (>1200px)
    assertTrue(cssContent.includes('.hud-overlay'), 'HUD overlay container must be styled');
    assertTrue(cssContent.includes('.bottom-hud'), 'Bottom HUD must be styled');
    assertTrue(cssContent.includes('.minimap-container'), 'Minimap container must be styled');

    // 2. Breakpoint 2: Compact Desktop (961px - 1200px)
    assertTrue(
      cssContent.includes('@media (min-width: 961px) and (max-width: 1200px)'),
      'CSS must contain media query for Breakpoint 2 (961px - 1200px)'
    );

    // 3. Breakpoint 3: Tablet with preserved mini-strip inventory (641px - 960px)
    assertTrue(
      cssContent.includes('@media (min-width: 641px) and (max-width: 960px)'),
      'CSS must contain media query for Breakpoint 3 (641px - 960px)'
    );
    // Ensure inventory is preserved in mini-strip row (not hidden)
    const bp3Index = cssContent.indexOf('@media (min-width: 641px) and (max-width: 960px)');
    const bp3Block = cssContent.slice(bp3Index, bp3Index + 1200);
    assertTrue(
      bp3Block.includes('.hud-inventory'),
      'Breakpoint 3 must configure .hud-inventory mini-strip'
    );
    assertTrue(
      bp3Block.includes('flex-direction: row'),
      'Breakpoint 3 must arrange inventory horizontally in a mini-strip'
    );

    // 4. Breakpoint 4: Mobile (<=640px)
    assertTrue(
      cssContent.includes('@media (max-width: 640px)'),
      'CSS must contain media query for Breakpoint 4 (<= 640px)'
    );

    // 5. Audio controls styling present
    assertTrue(cssContent.includes('.audio-controls-container'), 'Audio controls container must be styled');
    assertTrue(cssContent.includes('.audio-toggle-btn'), 'Audio toggle button must be styled');
    assertTrue(cssContent.includes('#sound-volume-slider'), 'Sound volume slider must be styled');
  });

});
