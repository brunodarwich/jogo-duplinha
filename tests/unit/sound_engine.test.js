import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue, assertFalse, assertCloseTo } from '../helpers/assert.js';
import { resolveModule } from '../helpers/module_resolver.js';

// =========================================================================
// MOCK WEB AUDIO API FRAMEWORK FOR UNIT TESTING
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
    this.currentTime = options.currentTime || 12.5;
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

  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
}

// =========================================================================
// TEST SUITE: PROCEDURAL WEB AUDIO SFX ENGINE (M4 / R4)
// =========================================================================

describe('Tier 1 Unit: Procedural Web Audio SFX Engine & Audio Controls (M4 / R4)', () => {

  it('TC-SND-01: Headless initialization and safe fallback when Web Audio is unavailable', async () => {
    const { module: soundMod } = await resolveModule('audio/sound');
    assertEqual(typeof soundMod.SoundEngine, 'function', 'SoundEngine class must be exported');

    // In Node.js headless environment without window.AudioContext:
    const engine = new soundMod.SoundEngine();
    assertFalse(engine.isSupported, 'Must report isSupported = false in headless mode');
    assertEqual(engine.ctx, null, 'AudioContext must be null');
    assertCloseTo(engine.volume, 0.7, 1e-3, 'Default volume must be 0.7');
    assertFalse(engine.isMuted, 'Default muted must be false');
    assertFalse(engine.unlocked, 'Initial unlocked state must be false');

    // resume() must resolve cleanly without throwing
    const res = await engine.resume();
    assertTrue(res, 'resume() must resolve to true in headless mode');

    // init() matches PROJECT.md contract
    const initRes = engine.init();
    assertEqual(initRes, engine, 'init() must return instance for chaining');
  });

  it('TC-SND-02: Volume control with strict [0, 1] boundary clamping and mute toggling', async () => {
    const { module: soundMod } = await resolveModule('audio/sound');
    const engine = new soundMod.SoundEngine();

    // Volume clamping checks
    assertEqual(engine.setVolume(0.45), 0.45);
    assertEqual(engine.getVolume(), 0.45);

    // Negative overflow clamped to 0.0
    assertEqual(engine.setVolume(-1.2), 0.0);
    assertEqual(engine.getVolume(), 0.0);

    // Upper overflow clamped to 1.0
    assertEqual(engine.setVolume(2.5), 1.0);
    assertEqual(engine.getVolume(), 1.0);

    // NaN or non-number clamped safely to 0.7 fallback
    assertEqual(engine.setVolume('invalid'), 0.7);

    // Mute controls
    assertFalse(engine.isMuted);
    assertEqual(engine.getIsMuted(), false);

    assertTrue(engine.toggleMute(), 'toggleMute() must flip to true');
    assertTrue(engine.isMuted);
    assertEqual(engine.getIsMuted(), true);

    assertFalse(engine.toggleMute(), 'toggleMute() must flip back to false');
    assertFalse(engine.isMuted);

    assertTrue(engine.setMuted(true));
    assertTrue(engine.isMuted);
    assertFalse(engine.setMuted(false));
    assertFalse(engine.isMuted);
  });

  it('TC-SND-03: Headless safety across all 18 procedural recipes (safe null return, 0 exceptions)', async () => {
    const { module: soundMod } = await resolveModule('audio/sound');
    const engine = new soundMod.SoundEngine();

    // 1. UI Click
    assertEqual(engine.playUiClick(), null);

    // 2. Attack variants for all 5 hero archetypes
    assertEqual(engine.playAttack('knight', false), null);
    assertEqual(engine.playAttack('assassin', false), null);
    assertEqual(engine.playAttack('ranger', true), null);
    assertEqual(engine.playAttack('sorceress', true), null);
    assertEqual(engine.playAttack('cleric', true), null);

    // 3. Hits (Normal vs Crit)
    assertEqual(engine.playHit(false), null);
    assertEqual(engine.playHit(true), null);

    // 4. Skills Q, W, E, R
    assertEqual(engine.playSkill('Q', 'knight'), null);
    assertEqual(engine.playSkill('W', 'sorceress'), null);
    assertEqual(engine.playSkill('E', 'ranger'), null);
    assertEqual(engine.playSkill('R', 'assassin'), null);

    // 5. Level Up
    assertEqual(engine.playLevelUp(), null);

    // 6. Shop Buy & Sell
    assertEqual(engine.playShopBuy(), null);
    assertEqual(engine.playShopSell(), null);

    // 7. Recall Lifecycle
    assertEqual(engine.playRecallStart(), null);
    assertEqual(engine.playRecallInterrupt(), null);
    assertEqual(engine.playRecallComplete(), null);

    // 8. Boss Alert
    assertEqual(engine.playAlertBoss(), null);

    // 9. Victory & Defeat
    assertEqual(engine.playVictory(), null);
    assertEqual(engine.playDefeat(), null);

    // 10. Generic dispatcher play(name, options)
    assertEqual(engine.play('uiclick'), null);
    assertEqual(engine.play('attack', { heroType: 'knight' }), null);
    assertEqual(engine.play('hit', { isCrit: true }), null);
    assertEqual(engine.play('skill', { slot: 'R' }), null);
    assertEqual(engine.play('levelup'), null);
    assertEqual(engine.play('shopbuy'), null);
    assertEqual(engine.play('shopsell'), null);
    assertEqual(engine.play('recallstart'), null);
    assertEqual(engine.play('recallinterrupt'), null);
    assertEqual(engine.play('recallcomplete'), null);
    assertEqual(engine.play('boss'), null);
    assertEqual(engine.play('victory'), null);
    assertEqual(engine.play('defeat'), null);
    assertEqual(engine.play('nonexistent_sound'), null);
  });

  it('TC-SND-04: Mock Web Audio API Graph — Master & SFX gain chain and White Noise Buffer', async () => {
    const { module: soundMod } = await resolveModule('audio/sound');
    const mockCtx = new MockAudioContext({ sampleRate: 48000, currentTime: 5.0 });

    const engine = new soundMod.SoundEngine({
      audioContext: mockCtx,
      volume: 0.8,
      muted: false
    });

    assertTrue(engine.isSupported, 'Engine must be supported when mock audioContext is injected');
    assertEqual(engine.ctx, mockCtx);
    assertTrue(engine.masterGain instanceof MockGainNode);
    assertTrue(engine.sfxGain instanceof MockGainNode);

    // Audio graph connections: sfxGain -> masterGain -> destination
    assertEqual(engine.sfxGain.connections.length, 1);
    assertEqual(engine.sfxGain.connections[0], engine.masterGain);
    assertEqual(engine.masterGain.connections.length, 1);
    assertEqual(engine.masterGain.connections[0], mockCtx.destination);

    // Master gain initial volume
    assertEqual(engine.masterGain.gain.value, 0.8);

    // Noise buffer verification (zero-GC 1-second precompiled buffer)
    assertTrue(engine.noiseBuffer instanceof MockAudioBuffer);
    assertEqual(engine.noiseBuffer.length, 48000);
    assertEqual(engine.noiseBuffer.sampleRate, 48000);

    const channelData = engine.noiseBuffer.getChannelData(0);
    assertEqual(channelData.length, 48000);

    // Check non-zero random distribution in [-1, 1]
    let nonZeroCount = 0;
    for (let i = 0; i < 100; i++) {
      assertTrue(channelData[i] >= -1.0 && channelData[i] <= 1.0);
      if (channelData[i] !== 0) nonZeroCount++;
    }
    assertTrue(nonZeroCount > 80, 'Noise buffer must contain generated random noise');
  });

  it('TC-SND-05: Mock Synthesis — UI Click, Hero Attacks, and Combat Hits (Normal & Crit)', async () => {
    const { module: soundMod } = await resolveModule('audio/sound');
    const mockCtx = new MockAudioContext({ currentTime: 1.0 });
    const engine = new soundMod.SoundEngine({ audioContext: mockCtx });

    // 1. UI Click: Sine 800Hz -> 400Hz (0.04s)
    const click = engine.playUiClick();
    assertTrue(click !== null);
    assertEqual(click.osc.type, 'sine');
    assertEqual(click.osc.frequency.calls[0].value, 800);
    assertEqual(click.osc.frequency.calls[1].value, 400);
    assertTrue(click.osc.started);
    assertTrue(click.osc.stopped);
    assertCloseTo(click.osc.stopTime - click.osc.startTime, 0.04, 1e-3);

    // 2. Knight Melee Attack: Noise + Bandpass 800Hz + Sine 180Hz -> 60Hz
    const melee = engine.playAttack('knight', false);
    assertTrue(melee !== null);
    assertEqual(melee.tone.osc.type, 'sine');
    assertEqual(melee.tone.osc.frequency.calls[0].value, 180);
    assertEqual(melee.tone.osc.frequency.calls[1].value, 60);
    assertEqual(melee.noise.filter.type, 'bandpass');
    assertEqual(melee.noise.filter.frequency.value, 800);

    // 3. Ranger Attack: Triangle 500Hz -> 950Hz + Highpass Noise
    const ranger = engine.playAttack('ranger', true);
    assertTrue(ranger !== null);
    assertEqual(ranger.tone.osc.type, 'triangle');
    assertEqual(ranger.tone.osc.frequency.calls[0].value, 500);
    assertEqual(ranger.tone.osc.frequency.calls[1].value, 950);
    assertEqual(ranger.noise.filter.type, 'highpass');
    assertEqual(ranger.noise.filter.frequency.value, 2000);

    // 4. Sorceress Attack: Sawtooth Lowpass 900Hz (350Hz -> 150Hz)
    const sorc = engine.playAttack('sorceress', true);
    assertTrue(sorc !== null);
    assertEqual(sorc.osc.type, 'sawtooth');
    assertEqual(sorc.osc.frequency.calls[0].value, 350);
    assertEqual(sorc.osc.frequency.calls[1].value, 150);

    // 5. Cleric Attack: Dual sine chord C5 (523Hz) & E5 (659Hz)
    const cleric = engine.playAttack('cleric', true);
    assertTrue(cleric !== null);
    assertEqual(cleric.tone1.osc.type, 'sine');
    assertCloseTo(cleric.tone1.osc.frequency.value, 523.25, 0.1);
    assertEqual(cleric.tone2.osc.type, 'sine');
    assertCloseTo(cleric.tone2.osc.frequency.value, 659.25, 0.1);

    // 6. Normal Hit vs Critical Strike
    const normalHit = engine.playHit(false);
    assertTrue(normalHit !== null);
    assertEqual(normalHit.tone.osc.frequency.calls[0].value, 160);
    assertEqual(normalHit.tone.osc.frequency.calls[1].value, 45);
    assertEqual(normalHit.noise.filter.type, 'lowpass');

    const critHit = engine.playHit(true);
    assertTrue(critHit !== null);
    assertEqual(critHit.subBass.osc.frequency.calls[0].value, 110);
    assertEqual(critHit.subBass.osc.frequency.calls[1].value, 30);
    assertEqual(critHit.crackle.filter.type, 'highpass');
    assertEqual(critHit.crackle.filter.frequency.value, 1500);
  });

  it('TC-SND-06: Mock Synthesis — Q, W, E, R Skills, Level Up Arpeggio and Shop Buy/Sell', async () => {
    const { module: soundMod } = await resolveModule('audio/sound');
    const mockCtx = new MockAudioContext({ currentTime: 10.0 });
    const engine = new soundMod.SoundEngine({ audioContext: mockCtx });

    // 1. Skill Q: Explosive Impact (Sine 300Hz -> 50Hz + Bandpass Noise)
    const skillQ = engine.playSkill('Q', 'knight');
    assertTrue(skillQ !== null);
    assertEqual(skillQ.tone.osc.frequency.calls[0].value, 300);
    assertEqual(skillQ.tone.osc.frequency.calls[1].value, 50);
    assertEqual(skillQ.noise.filter.type, 'bandpass');

    // 2. Skill W: Resonant Filter Sweep 200Hz -> 800Hz
    const skillW = engine.playSkill('W', 'knight');
    assertTrue(skillW !== null);
    assertEqual(skillW.filter.type, 'bandpass');
    assertEqual(skillW.filter.frequency.calls[0].value, 200);
    assertEqual(skillW.filter.frequency.calls[1].value, 800);

    // 3. Skill E: Fast chirp sweep 200Hz -> 1200Hz
    const skillE = engine.playSkill('E', 'ranger');
    assertTrue(skillE !== null);
    assertEqual(skillE.osc.frequency.calls[0].value, 200);
    assertEqual(skillE.osc.frequency.calls[1].value, 1200);

    // 4. Skill R: Ultimate chord + Sub-bass 45Hz
    const skillR = engine.playSkill('R', 'sorceress');
    assertTrue(skillR !== null);
    assertEqual(skillR.sub.osc.frequency.calls[0].value, 45);
    assertTrue(skillR.note1.osc.started);
    assertTrue(skillR.note2.osc.started);
    assertTrue(skillR.note3.osc.started);

    // 5. Level Up: 4-note ascending major arpeggio C4-E4-G4-C5
    const lvlNotes = engine.playLevelUp();
    assertEqual(lvlNotes.length, 4);
    assertCloseTo(lvlNotes[0].osc.frequency.value, 261.63, 0.1);
    assertCloseTo(lvlNotes[1].osc.frequency.value, 329.63, 0.1);
    assertCloseTo(lvlNotes[2].osc.frequency.value, 392.00, 0.1);
    assertCloseTo(lvlNotes[3].osc.frequency.value, 523.25, 0.1);
    // Check staggered timing (65ms per note)
    assertCloseTo(lvlNotes[1].osc.startTime - lvlNotes[0].osc.startTime, 0.065, 1e-3);

    // 6. Shop Buy: B5 (987Hz) -> E6 (1318Hz)
    const buy = engine.playShopBuy();
    assertTrue(buy !== null);
    assertCloseTo(buy.n1.osc.frequency.value, 987.77, 0.1);
    assertCloseTo(buy.n2.osc.frequency.value, 1318.51, 0.1);

    // 7. Shop Sell: A5 (880Hz) -> E5 (659Hz)
    const sell = engine.playShopSell();
    assertTrue(sell !== null);
    assertEqual(sell.osc.frequency.calls[0].value, 880);
    assertCloseTo(sell.osc.frequency.calls[1].value, 659.25, 0.1);
  });

  it('TC-SND-07: Mock Synthesis — Recall Channel Lifecycle, Boss Alert, Victory & Defeat', async () => {
    const { module: soundMod } = await resolveModule('audio/sound');
    const mockCtx = new MockAudioContext({ currentTime: 20.0 });
    const engine = new soundMod.SoundEngine({ audioContext: mockCtx });

    // 1. Recall Start: Continuous 220Hz tone
    const recall = engine.playRecallStart();
    assertTrue(recall !== null);
    assertEqual(recall.osc.type, 'sine');
    assertEqual(recall.osc.frequency.value, 220);
    assertEqual(engine.activeRecallSource, recall);
    assertTrue(recall.osc.started);
    assertFalse(recall.osc.stopped, 'Recall channel tone must remain active until interrupted or complete');

    // 2. Recall Interrupt: Stops previous tone and fires dissonant buzzer (440Hz -> 100Hz)
    const interrupt = engine.playRecallInterrupt();
    assertTrue(recall.osc.stopped, 'Recall start tone must be stopped on interrupt');
    assertEqual(engine.activeRecallSource, null);
    assertEqual(interrupt.osc.type, 'sawtooth');
    assertEqual(interrupt.osc.frequency.calls[0].value, 440);
    assertEqual(interrupt.osc.frequency.calls[1].value, 100);

    // 3. Recall Start again & Complete: Ascending beam up to 1400Hz + Shimmer
    engine.playRecallStart();
    const complete = engine.playRecallComplete();
    assertEqual(engine.activeRecallSource, null);
    assertEqual(complete.beam.osc.frequency.calls[0].value, 300);
    assertEqual(complete.beam.osc.frequency.calls[1].value, 1400);
    assertEqual(complete.shimmer.osc.frequency.value, 1760);

    // 4. Boss Alert: 2 Pulses of War Horn (330Hz and 440Hz)
    const bossAlert = engine.playAlertBoss();
    assertTrue(bossAlert !== null);
    assertEqual(bossAlert.pulse1.osc.frequency.calls[0].value, 330);
    assertEqual(bossAlert.pulse1.osc.frequency.calls[1].value, 440);
    assertEqual(bossAlert.pulse2.osc.frequency.calls[0].value, 330);
    assertEqual(bossAlert.pulse2.osc.frequency.calls[1].value, 440);
    assertCloseTo(bossAlert.pulse2.osc.startTime - bossAlert.pulse1.osc.startTime, 0.18, 1e-3);

    // 5. Victory: Sustained 4-note major chord (C-E-G-C)
    const vicChord = engine.playVictory();
    assertEqual(vicChord.length, 4);
    assertCloseTo(vicChord[0].osc.frequency.value, 261.63, 0.1);
    assertCloseTo(vicChord[1].osc.frequency.value, 329.63, 0.1);
    assertCloseTo(vicChord[2].osc.frequency.value, 392.00, 0.1);
    assertCloseTo(vicChord[3].osc.frequency.value, 523.25, 0.1);
    assertCloseTo(vicChord[0].osc.stopTime - vicChord[0].osc.startTime, 2.0, 1e-3);

    // 6. Defeat: Free fall minor slide (150Hz -> 40Hz)
    const defeat = engine.playDefeat();
    assertEqual(defeat.osc.frequency.calls[0].value, 150);
    assertEqual(defeat.osc.frequency.calls[1].value, 40);
    assertCloseTo(defeat.osc.stopTime - defeat.osc.startTime, 1.8, 1e-3);
  });

  it('TC-SND-08: Mute and Volume interaction on Mock Web Audio API nodes', async () => {
    const { module: soundMod } = await resolveModule('audio/sound');
    const mockCtx = new MockAudioContext({ currentTime: 0 });
    const engine = new soundMod.SoundEngine({ audioContext: mockCtx, volume: 0.6 });

    assertEqual(engine.masterGain.gain.value, 0.6);

    // Setting volume while unmuted updates gain
    engine.setVolume(0.9);
    assertEqual(engine.masterGain.gain.value, 0.9);

    // Muting sets master gain to 0
    engine.setMuted(true);
    assertEqual(engine.masterGain.gain.value, 0.0);

    // When muted, all playback calls return null
    assertEqual(engine.playUiClick(), null);
    assertEqual(engine.playAttack(), null);
    assertEqual(engine.playHit(), null);
    assertEqual(engine.playSkill(), null);
    assertEqual(engine.playLevelUp(), null);

    // Unmuting restores the current volume (0.9)
    engine.toggleMute();
    assertFalse(engine.isMuted);
    assertEqual(engine.masterGain.gain.value, 0.9);

    // Sounds play normally again
    assertTrue(engine.playUiClick() !== null);
  });

  it('TC-SND-09: Autoplay unlock on first user gesture (pointerdown, keydown, touchstart)', async () => {
    const { module: soundMod } = await resolveModule('audio/sound');
    const mockCtx = new MockAudioContext({ state: 'suspended' });

    // Mock window event registration
    const registeredListeners = new Map();
    const prevWindow = globalThis.window;
    globalThis.window = {
      addEventListener(type, fn) {
        if (!registeredListeners.has(type)) registeredListeners.set(type, []);
        registeredListeners.get(type).push(fn);
      },
      removeEventListener(type, fn) {
        if (registeredListeners.has(type)) {
          const list = registeredListeners.get(type).filter(f => f !== fn);
          registeredListeners.set(type, list);
        }
      }
    };

    try {
      const engine = new soundMod.SoundEngine({ audioContext: mockCtx });
      assertFalse(engine.unlocked, 'Should be locked when context state is suspended');

      // Verify listeners attached
      assertTrue(registeredListeners.has('pointerdown'));
      assertTrue(registeredListeners.has('keydown'));
      assertTrue(registeredListeners.has('touchstart'));

      // Fire gesture event (e.g. pointerdown)
      const pointerHandlers = registeredListeners.get('pointerdown') || [];
      assertEqual(pointerHandlers.length, 1);

      pointerHandlers[0]();
      await new Promise(resolve => setTimeout(resolve, 5));

      assertEqual(mockCtx.state, 'running', 'Mock AudioContext state must be running after gesture');
      assertTrue(engine.unlocked, 'Engine must be unlocked');

      // Listeners must be removed after first gesture
      assertEqual(registeredListeners.get('pointerdown').length, 0);
      assertEqual(registeredListeners.get('keydown').length, 0);
      assertEqual(registeredListeners.get('touchstart').length, 0);
    } finally {
      globalThis.window = prevWindow;
    }
  });

  it('TC-SND-10: HUDController Audio Controls & Hotkey M integration', async () => {
    const { module: hudMod } = await resolveModule('ui/hud');
    const { module: soundMod } = await resolveModule('audio/sound');

    const mockCtx = new MockAudioContext();
    const engine = new soundMod.SoundEngine({ audioContext: mockCtx, volume: 0.75, muted: false });

    // DOM Mocks
    const audioBtnMock = {
      textContent: '🔊',
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        contains(c) { return this.classes.has(c); }
      },
      title: '',
      listeners: {},
      addEventListener(evt, fn) { this.listeners[evt] = fn; }
    };

    const sliderMock = {
      value: '0.75',
      listeners: {},
      addEventListener(evt, fn) { this.listeners[evt] = fn; }
    };

    const keyListeners = [];
    const prevWindow = globalThis.window;
    const prevDoc = globalThis.document;

    try {
      globalThis.window = {
        addEventListener(type, fn) {
          if (type === 'keydown') keyListeners.push(fn);
        },
        removeEventListener() {}
      };

      globalThis.document = {
        getElementById(id) {
          if (id === 'btn-audio-toggle') return audioBtnMock;
          if (id === 'sound-volume-slider') return sliderMock;
          return null;
        },
        querySelector() { return null; },
        querySelectorAll() { return []; }
      };

      const hud = new hudMod.HUDController();
      hud.setupAudioControls(engine);

      // Verify initial synchronization
      assertEqual(audioBtnMock.textContent, '🔊');
      assertEqual(sliderMock.value, '0.75');

      // 1. Click toggle button
      if (audioBtnMock.listeners['click']) {
        audioBtnMock.listeners['click']({ stopPropagation() {}, preventDefault() {} });
      }
      assertTrue(engine.isMuted, 'Clicking audio button must mute sound');
      assertEqual(audioBtnMock.textContent, '🔇');
      assertTrue(audioBtnMock.classList.contains('muted'));

      // 2. Press 'M' key shortcut
      for (const listener of keyListeners) {
        listener({ key: 'M', preventDefault() {} });
      }
      assertFalse(engine.isMuted, 'Pressing M key must unmute sound');
      assertEqual(audioBtnMock.textContent, '🔊');
      assertFalse(audioBtnMock.classList.contains('muted'));

      // 3. Adjust volume slider
      if (sliderMock.listeners['input']) {
        sliderMock.listeners['input']({ target: { value: '0.35' } });
      }
      assertCloseTo(engine.getVolume(), 0.35, 1e-3);
    } finally {
      globalThis.window = prevWindow;
      globalThis.document = prevDoc;
    }
  });

  it('TC-SND-11: Adversarial Stress — 1,000+ Rapid Audio Calls, Null/Extreme Inputs and Memory Stability', async () => {
    const { module: soundMod } = await resolveModule('audio/sound');
    const mockCtx = new MockAudioContext({ currentTime: 100.0 });
    const engine = new soundMod.SoundEngine({ audioContext: mockCtx });

    // Spam 1,200 audio calls across all recipes in rapid loop
    for (let i = 0; i < 100; i++) {
      engine.playUiClick();
      engine.playAttack(null, undefined);
      engine.playAttack('unknown_hero', true);
      engine.playHit(i % 2 === 0);
      engine.playSkill(null, null);
      engine.playSkill('X', 'invalid');
      engine.playLevelUp();
      engine.playShopBuy();
      engine.playShopSell();
      engine.playRecallStart();
      engine.playRecallInterrupt();
      engine.playRecallComplete();
      engine.playAlertBoss();
      engine.playVictory();
      engine.playDefeat();
      engine.play(null);
    }

    assertTrue(mockCtx.createdOscillators.length > 500, 'Oscillators should have been generated');
    assertTrue(mockCtx.createdGains.length > 500, 'Gain nodes should have been generated');

    // Extreme volume values must not throw or poison engine state
    engine.setVolume(Infinity);
    assertEqual(engine.getVolume(), 1.0);

    engine.setVolume(-Infinity);
    assertEqual(engine.getVolume(), 0.0);

    engine.setVolume(NaN);
    assertEqual(engine.getVolume(), 0.7);

    engine.setVolume(undefined);
    assertEqual(engine.getVolume(), 0.7);

    engine.setVolume(null);
    assertEqual(engine.getVolume(), 0.7);

    // Stop active recall multiple times safely
    engine.stopActiveRecall();
    engine.stopActiveRecall();
    assertEqual(engine.activeRecallSource, null);
  });

  it('TC-SND-12: Defensive Fault Tolerance — Broken AudioContext and LocalStorage Sandbox Exceptions', async () => {
    const { module: soundMod } = await resolveModule('audio/sound');

    // Simulate broken context that throws on createOscillator / createGain
    const brokenCtx = {
      sampleRate: 44100,
      currentTime: 0,
      destination: {},
      createGain() { throw new Error('Web Audio AudioHardwareException'); },
      createOscillator() { throw new Error('AudioContext crashed'); },
      createBuffer() { throw new Error('Out of memory'); }
    };

    // Constructor should not crash
    const resilientEngine = new soundMod.SoundEngine({ audioContext: brokenCtx });
    assertFalse(resilientEngine.isSupported);

    // Calling play methods on broken engine must cleanly return null without throwing
    assertEqual(resilientEngine.playUiClick(), null);
    assertEqual(resilientEngine.playAttack(), null);
    assertEqual(resilientEngine.playHit(), null);

    // Simulate localStorage sandbox error (e.g. SecurityError in iframe)
    const prevStorage = globalThis.localStorage;
    globalThis.localStorage = {
      getItem() { throw new Error('SecurityError: Access denied'); },
      setItem() { throw new Error('QuotaExceededError'); }
    };

    try {
      const storageEngine = new soundMod.SoundEngine();
      assertEqual(storageEngine.volume, 0.7);
      storageEngine.setVolume(0.5);
      storageEngine.setMuted(true);
      assertEqual(storageEngine.volume, 0.5);
      assertTrue(storageEngine.isMuted);
    } finally {
      globalThis.localStorage = prevStorage;
    }
  });
});
