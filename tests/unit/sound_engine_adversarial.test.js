import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue, assertFalse, assertCloseTo } from '../helpers/assert.js';
import { resolveModule } from '../helpers/module_resolver.js';

// =========================================================================
// MOCK WEB AUDIO API HARNESS FOR ADVERSARIAL STRESS TESTING
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

  connect(destination) {
    this.connections.push(destination);
    return destination;
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

  start(time = 0) {
    this.started = true;
    this.startTime = time;
  }

  stop(time = 0) {
    this.stopped = true;
    this.stopTime = time;
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

  getChannelData(channelIndex) {
    return this.channelData[channelIndex] || this.channelData[0];
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

  start(time = 0) {
    this.started = true;
    this.startTime = time;
  }

  stop(time = 0) {
    this.stopped = true;
    this.stopTime = time;
  }
}

class MockAudioContext {
  constructor(options = {}) {
    this.sampleRate = options.sampleRate || 44100;
    this.currentTime = options.currentTime || 10.0;
    this.state = options.state || 'running';
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

  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
}

// =========================================================================
// ADVERSARIAL STRESS TEST SUITE (M4 / R4)
// =========================================================================

describe('Tier 1 Unit: Adversarial Stress — SoundEngine Procedural SFX & Web Audio API (M4)', () => {

  it('TC-ADV-SND-01: Extreme burst spam (1,000+ rapid calls in 1 frame) across all sound recipes', async () => {
    const { module: soundMod } = await resolveModule('audio/sound');
    const mockCtx = new MockAudioContext({ currentTime: 50.0 });
    const engine = new soundMod.SoundEngine({ audioContext: mockCtx, volume: 0.85 });

    const startTime = performance.now();

    // Spam 1,200 rapid calls across playUiClick, playAttack, playHit, playSkill
    for (let i = 0; i < 300; i++) {
      engine.playUiClick();
      engine.playAttack(i % 2 === 0 ? 'knight' : 'ranger', i % 2 !== 0);
      engine.playHit(i % 3 === 0);
      engine.playSkill(i % 4 === 0 ? 'Q' : i % 4 === 1 ? 'W' : i % 4 === 2 ? 'E' : 'R', 'knight');
    }

    const duration = performance.now() - startTime;

    // Performance assertion: 1,200 synthesis calls must execute in < 60ms
    assertTrue(duration < 60.0, `1,200 synthesis calls took ${duration.toFixed(2)}ms (expected < 60ms)`);

    // Verify created nodes
    assertTrue(mockCtx.createdOscillators.length >= 600, 'Must have generated oscillators');
    assertTrue(mockCtx.createdGains.length >= 600, 'Must have generated gain nodes');

    // Engine must remain valid and operational
    assertEqual(engine.getVolume(), 0.85);
    assertFalse(engine.isMuted);
  });

  it('TC-ADV-SND-02: Rapid concurrent toggleMute during sustained sound channeling (recall & victory)', async () => {
    const { module: soundMod } = await resolveModule('audio/sound');
    const mockCtx = new MockAudioContext({ currentTime: 10.0 });
    const engine = new soundMod.SoundEngine({ audioContext: mockCtx, volume: 0.75 });

    // 1. Start continuous recall sound
    const recall = engine.playRecallStart();
    assertTrue(recall !== null, 'Recall sound must start');
    assertEqual(engine.activeRecallSource, recall);
    assertTrue(recall.osc.started);
    assertFalse(recall.osc.stopped);

    // 2. Rapidly toggle mute 400 times while recall is active
    for (let i = 0; i < 400; i++) {
      engine.toggleMute();
      if (i % 40 === 0) {
        // Interleaved calls during mute toggle
        engine.playAttack('sorceress', true);
        engine.playVictory();
      }
    }

    // 3. Ensure engine state is coherent
    assertFalse(engine.isMuted, 'Even number of toggles (400) must return to unmuted');
    assertCloseTo(engine.masterGain.gain.value, 0.75, 1e-4, 'Master gain must be restored to volume');

    // 4. Complete recall cleanly
    engine.playRecallComplete();
    assertEqual(engine.activeRecallSource, null, 'Recall complete must clear activeRecallSource');
    assertTrue(recall.osc.stopped, 'Original recall oscillator must be stopped');
  });

  it('TC-ADV-SND-03: Extreme volume boundary clamping and invalid parameter fuzzing on setVolume', async () => {
    const { module: soundMod } = await resolveModule('audio/sound');
    const mockCtx = new MockAudioContext({ currentTime: 1.0 });
    const engine = new soundMod.SoundEngine({ audioContext: mockCtx, volume: 0.5 });

    // Negative values clamped to 0.0
    assertEqual(engine.setVolume(-0.001), 0.0);
    assertEqual(engine.masterGain.gain.value, 0.0);

    assertEqual(engine.setVolume(-100.0), 0.0);
    assertEqual(engine.setVolume(-Infinity), 0.0);

    // Overflows clamped to 1.0
    assertEqual(engine.setVolume(1.0001), 1.0);
    assertEqual(engine.masterGain.gain.value, 1.0);

    assertEqual(engine.setVolume(10.0), 1.0);
    assertEqual(engine.setVolume(99999.0), 1.0);
    assertEqual(engine.setVolume(Infinity), 1.0);

    // Non-numbers and NaN safely default to 0.7 without throwing
    assertEqual(engine.setVolume(NaN), 0.7);
    assertEqual(engine.masterGain.gain.value, 0.7);

    assertEqual(engine.setVolume(null), 0.7);
    assertEqual(engine.setVolume(undefined), 0.7);
    assertEqual(engine.setVolume('0.9'), 0.7);
    assertEqual(engine.setVolume({}), 0.7);
    assertEqual(engine.setVolume([]), 0.7);

    // Setting volume while muted updates target volume but keeps master gain at 0
    engine.setMuted(true);
    assertEqual(engine.masterGain.gain.value, 0.0);
    engine.setVolume(0.42);
    assertEqual(engine.getVolume(), 0.42);
    assertEqual(engine.masterGain.gain.value, 0.0, 'Gain must remain 0 while muted');

    engine.setMuted(false);
    assertCloseTo(engine.masterGain.gain.value, 0.42, 1e-4, 'Unmuting must apply the updated volume');
  });

  it('TC-ADV-SND-04: Web Audio node lifecycle audit — 100% stop scheduled & zero orphaned node retention', async () => {
    const { module: soundMod } = await resolveModule('audio/sound');
    const mockCtx = new MockAudioContext({ currentTime: 25.0 });
    const engine = new soundMod.SoundEngine({ audioContext: mockCtx });

    // Execute 200 calls across all 18 recipes
    for (let i = 0; i < 20; i++) {
      engine.playUiClick();
      engine.playAttack('knight', false);
      engine.playAttack('ranger', true);
      engine.playAttack('sorceress', true);
      engine.playAttack('cleric', true);
      engine.playHit(false);
      engine.playHit(true);
      engine.playSkill('Q', 'knight');
      engine.playSkill('W', 'sorceress');
      engine.playSkill('E', 'ranger');
      engine.playSkill('R', 'cleric');
      engine.playLevelUp();
      engine.playShopBuy();
      engine.playShopSell();
      engine.playAlertBoss();
      engine.playVictory();
      engine.playDefeat();
    }

    // Every created oscillator MUST be scheduled to start and stop
    assertTrue(mockCtx.createdOscillators.length > 0);
    for (const osc of mockCtx.createdOscillators) {
      assertTrue(osc.started, 'Oscillator must have start() called');
      assertTrue(osc.stopped, 'Oscillator must have stop() called');
      assertTrue(osc.stopTime >= osc.startTime, 'Oscillator stop time must be >= start time');
    }

    // Every created buffer source MUST be scheduled to start and stop
    assertTrue(mockCtx.createdBufferSources.length > 0);
    for (const src of mockCtx.createdBufferSources) {
      assertTrue(src.started, 'BufferSource must have start() called');
      assertTrue(src.stopped, 'BufferSource must have stop() called');
      assertTrue(src.stopTime >= src.startTime, 'BufferSource stop time must be >= start time');
    }

    // Engine itself must not accumulate arrays or maps of played nodes
    const ownKeys = Object.keys(engine);
    for (const key of ownKeys) {
      const val = engine[key];
      if (Array.isArray(val)) {
        assertEqual(val.length, 0, `Engine array property ${key} must not accumulate nodes`);
      }
    }
  });

  it('TC-ADV-SND-05: Headless & DOM-free execution resilience in pure Node.js', async () => {
    const { module: soundMod } = await resolveModule('audio/sound');

    // Instantiate without window, without document, without AudioContext
    const headlessEngine = new soundMod.SoundEngine();
    assertFalse(headlessEngine.isSupported, 'Headless engine isSupported must be false');
    assertEqual(headlessEngine.ctx, null);
    assertEqual(headlessEngine.masterGain, null);
    assertEqual(headlessEngine.sfxGain, null);
    assertEqual(headlessEngine.noiseBuffer, null);

    // 18 recipes and generic play dispatcher must safely return null without throwing
    const methods = [
      () => headlessEngine.playUiClick(),
      () => headlessEngine.playAttack('knight', false),
      () => headlessEngine.playAttack('ranger', true),
      () => headlessEngine.playAttack('sorceress', true),
      () => headlessEngine.playAttack('cleric', true),
      () => headlessEngine.playHit(false),
      () => headlessEngine.playHit(true),
      () => headlessEngine.playSkill('Q', 'knight'),
      () => headlessEngine.playSkill('W', 'sorceress'),
      () => headlessEngine.playSkill('E', 'ranger'),
      () => headlessEngine.playSkill('R', 'cleric'),
      () => headlessEngine.playLevelUp(),
      () => headlessEngine.playShopBuy(),
      () => headlessEngine.playShopSell(),
      () => headlessEngine.playRecallStart(),
      () => headlessEngine.playRecallInterrupt(),
      () => headlessEngine.playRecallComplete(),
      () => headlessEngine.playAlertBoss(),
      () => headlessEngine.playVictory(),
      () => headlessEngine.playDefeat(),
      () => headlessEngine.play('uiclick'),
      () => headlessEngine.play('attack'),
      () => headlessEngine.play('hit'),
      () => headlessEngine.play('skill'),
      () => headlessEngine.play('unknown')
    ];

    for (const method of methods) {
      assertEqual(method(), null, 'Headless methods must safely return null');
    }

    // resume() and init() must resolve and chain safely
    const resumeRes = await headlessEngine.resume();
    assertTrue(resumeRes);
    const initRes = headlessEngine.init();
    assertEqual(initRes, headlessEngine);
  });

  it('TC-ADV-SND-06: LocalStorage sandbox error resilience (SecurityError & QuotaExceededError)', async () => {
    const { module: soundMod } = await resolveModule('audio/sound');

    // Simulate strict sandbox throwing SecurityError on getItem and QuotaExceededError on setItem
    const prevStorage = globalThis.localStorage;
    globalThis.localStorage = {
      getItem(key) {
        throw new Error(`DOMException: SecurityError: Access denied for key ${key}`);
      },
      setItem(key, val) {
        throw new Error(`DOMException: QuotaExceededError: Storage quota exceeded for ${key}`);
      }
    };

    try {
      const mockCtx = new MockAudioContext({ currentTime: 0 });
      const engine = new soundMod.SoundEngine({ audioContext: mockCtx });

      // Engine must construct with default volume without throwing
      assertEqual(engine.getVolume(), 0.7);

      // setVolume must succeed in-memory without throwing on setItem
      engine.setVolume(0.35);
      assertEqual(engine.getVolume(), 0.35);

      // setMuted and toggleMute must succeed in-memory without throwing on setItem
      engine.setMuted(true);
      assertTrue(engine.isMuted);

      engine.toggleMute();
      assertFalse(engine.isMuted);
    } finally {
      globalThis.localStorage = prevStorage;
    }
  });

});
