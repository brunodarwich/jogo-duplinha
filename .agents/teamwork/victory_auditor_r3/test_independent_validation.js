import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Mock Web Audio Context for Node.js
class MockParam {
  constructor(val = 0) {
    this.value = val;
    this.events = [];
  }
  setValueAtTime(val, t) {
    this.value = val;
    this.events.push({ type: 'setValueAtTime', val, t });
  }
  exponentialRampToValueAtTime(val, t) {
    this.value = val;
    this.events.push({ type: 'exponentialRamp', val, t });
  }
  linearRampToValueAtTime(val, t) {
    this.value = val;
    this.events.push({ type: 'linearRamp', val, t });
  }
}

class MockAudioNode {
  constructor() {
    this.connectedTo = [];
  }
  connect(dest) {
    this.connectedTo.push(dest);
    return dest;
  }
  disconnect() {
    this.connectedTo = [];
  }
}

class MockGainNode extends MockAudioNode {
  constructor(initialVal = 1.0) {
    super();
    this.gain = new MockParam(initialVal);
  }
}

class MockOscillatorNode extends MockAudioNode {
  constructor() {
    super();
    this.type = 'sine';
    this.frequency = new MockParam(440);
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
    this.frequency = new MockParam(350);
    this.Q = new MockParam(1);
    this.gain = new MockParam(0);
  }
}

class MockAudioBuffer {
  constructor(channels = 1, length = 48000, sampleRate = 48000) {
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    this._data = new Float32Array(length);
  }
  getChannelData(c) {
    return this._data;
  }
}

class MockAudioBufferSourceNode extends MockAudioNode {
  constructor() {
    super();
    this.buffer = null;
    this.playbackRate = new MockParam(1);
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
    this.currentTime = 0;
    this.state = 'suspended';
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

async function runAuditorValidation() {
  console.log('===============================================================');
  console.log('INDEPENDENT FORENSIC VALIDATION — VICTORY AUDITOR R3');
  console.log('===============================================================\n');

  let passedAll = true;
  function assert(condition, message) {
    if (!condition) {
      console.error(`[FAIL] ${message}`);
      passedAll = false;
      throw new Error(`Assertion failed: ${message}`);
    } else {
      console.log(`[PASS] ${message}`);
    }
  }

  // -----------------------------------------------------------------
  // 1. REQUIREMENT R1: Modern & Responsive UI
  // -----------------------------------------------------------------
  console.log('--- Checking R1: Modern & Responsive UI ---');
  const { EventBannerManager, BANNER_PRIORITY } = await import('../../../src/ui/event_banners.js');
  const bannerMgr = new EventBannerManager();
  assert(bannerMgr !== null, 'EventBannerManager instantiates cleanly in headless Node');
  
  let soundPlayed = null;
  bannerMgr.onEventPlaySound = (type, b) => {
    soundPlayed = type;
  };

  const b1 = bannerMgr.showBanner({ type: 'kill', title: 'Abate Aliado', priority: BANNER_PRIORITY.KILL });
  assert(bannerMgr.currentBanner.type === 'kill', 'First banner is displayed immediately');
  assert(soundPlayed === 'kill', 'Sound callback is fired on banner show');

  // Test Preemption: Boss spawn (priority 2) should preempt Kill (priority 6)
  const b2 = bannerMgr.showBanner({ type: 'boss_spawn', title: 'Chefe Surgiu!', priority: BANNER_PRIORITY.BOSS_SPAWN });
  assert(bannerMgr.currentBanner.type === 'boss_spawn', 'Higher priority banner preempts lower priority banner');
  assert(bannerMgr.queue.some(b => b.type === 'kill'), 'Preempted banner is re-enqueued for later display');

  // Test Victory preemption (priority 1)
  const b3 = bannerMgr.showVictoryBanner({ message: 'O Cristal Inimigo caiu!' });
  assert(bannerMgr.currentBanner.type === 'victory', 'Victory banner preempts boss banner');

  // Verify formatMatchTime
  const { formatMatchTime, Minimap } = await import('../../../src/ui/hud.js');
  assert(formatMatchTime(0) === '00:00', 'formatMatchTime(0) is 00:00');
  assert(formatMatchTime(65) === '01:05', 'formatMatchTime(65) is 01:05');
  assert(formatMatchTime(720) === '12:00', 'formatMatchTime(720) is 12:00');

  // Verify Minimap coordinate math
  const minimap = new Minimap(null);
  const mPos = minimap.worldToMap(1600, 1600);
  assert(mPos.mx === 100 && mPos.my === 100, 'Minimap worldToMap(1600, 1600) maps to center (100, 100)');
  const wPos = minimap.mapToWorld(100, 100);
  assert(wPos.wx === 1600 && wPos.wy === 1600, 'Minimap mapToWorld(100, 100) maps back to (1600, 1600)');

  // Verify ShopUI formatStatChips
  const { formatStatChips } = await import('../../../src/ui/shop_ui.js');
  const chips = formatStatChips({ attackDamage: 40, ap: 60, movementSpeedPercent: 0.1 });
  assert(chips.includes('+40 AD'), 'formatStatChips formats +40 AD');
  assert(chips.includes('+60 AP'), 'formatStatChips formats +60 AP');
  assert(chips.includes('+10% Vel'), 'formatStatChips formats +10% Vel');

  // -----------------------------------------------------------------
  // 2. REQUIREMENT R2: Tactile UX, Waves, Cursors, Tooltips
  // -----------------------------------------------------------------
  console.log('\n--- Checking R2: Tactile UX, Cursors & Tooltips ---');
  const { TooltipController } = await import('../../../src/ui/tooltip.js');
  const tooltip = new TooltipController();
  assert(tooltip !== null, 'TooltipController instantiates in headless Node');

  // Verify scaling formulas for 5 heroes
  const heroes = [
    { id: 'knight', heroId: 'knight', ad: 80, ap: 0, armor: 50 },
    { id: 'sorceress', heroId: 'sorceress', ad: 40, ap: 120, armor: 25 },
    { id: 'ranger', heroId: 'ranger', ad: 110, ap: 0, armor: 30 },
    { id: 'assassin', heroId: 'assassin', ad: 100, ap: 0, armor: 35 },
    { id: 'cleric', heroId: 'cleric', ad: 50, ap: 90, armor: 40 }
  ];

  for (const h of heroes) {
    for (const slot of ['Q', 'W', 'E', 'R']) {
      const scaling = tooltip.formatAbilityScaling({ slot, rank: 2 }, h);
      assert(typeof scaling.base === 'number' && scaling.base >= 0, `${h.id} [${slot}] has valid base >= 0 (found ${scaling.base})`);
      assert(typeof scaling.total === 'number' && scaling.total >= scaling.base, `${h.id} [${slot}] total >= base`);
      assert(typeof scaling.scalingText === 'string' && scaling.scalingText.length > 0, `${h.id} [${slot}] has non-empty scaling text`);
    }
  }

  // Verify CURSOR_SVGS
  const { CURSOR_SVGS } = await import('../../../src/core/input.js');
  assert(typeof CURSOR_SVGS === 'object', 'CURSOR_SVGS is exported');
  for (const type of ['default', 'attack', 'ally', 'shop', 'target']) {
    assert(typeof CURSOR_SVGS[type] === 'string' && CURSOR_SVGS[type].includes('data:image/svg+xml'), `CURSOR_SVGS[${type}] is valid inline SVG`);
  }

  // Verify ParticleSystem emitMoveIndicator
  const { ParticleSystem } = await import('../../../src/render/particles.js');
  const ps = new ParticleSystem();
  ps.emitMoveIndicator(500, 500, '#10b981', false);
  // 3 waves + 4 reticle chevrons = 7 particles
  assert(ps.particles.length === 7, 'emitMoveIndicator creates exactly 7 particles (3 waves + 4 reticles)');
  const rings = ps.particles.filter(p => p.type === 'ring');
  const reticles = ps.particles.filter(p => p.type === 'reticle_marker');
  assert(rings.length === 3, 'Created 3 concentric expanding rings');
  assert(reticles.length === 4, 'Created 4 converging reticle chevrons');

  // -----------------------------------------------------------------
  // 3. REQUIREMENT R3: VFX, Dynamic Camera, Screen Shake
  // -----------------------------------------------------------------
  console.log('\n--- Checking R3: Dynamic Camera, Trauma & VFX ---');
  const { Camera } = await import('../../../src/core/camera.js');
  const camera = new Camera({ viewportWidth: 1280, viewportHeight: 720 });
  assert(camera.trauma === 0, 'Camera trauma starts at 0');

  camera.addTrauma(0.5);
  assert(Math.abs(camera.trauma - 0.5) < 1e-4, 'addTrauma(0.5) sets trauma to 0.5');

  camera.addTrauma(1.0);
  assert(camera.trauma === 1.0, 'Trauma clamps at max 1.0');

  camera.update(0.1);
  // traumaDecay = 2.0/s -> after 0.1s trauma should decay by 0.2 -> 0.8
  assert(Math.abs(camera.trauma - 0.8) < 1e-3, 'Trauma decays exponentially/linearly over time');
  assert(camera.shakeOffsetX !== 0 || camera.shakeOffsetY !== 0, 'Displacement offsets generated during trauma');

  camera.setShakeEnabled(false);
  assert(camera.shakeOffsetX === 0 && camera.shakeOffsetY === 0, 'setShakeEnabled(false) resets offsets to 0');

  // Verify 5 Hero combat hit VFX presets
  for (const h of ['knight', 'sorceress', 'ranger', 'assassin', 'cleric']) {
    const prevCount = ps.particles.length;
    ps.emitHeroAttackHit(h, 400, 400, false);
    assert(ps.particles.length > prevCount, `emitHeroAttackHit for ${h} creates particles`);
  }

  // Verify FIFO memory limits
  console.log('Testing FIFO memory limit (500 particles, 200 floating texts)...');
  for (let i = 0; i < 2000; i++) {
    ps.emit('spark', { x: i, y: i, count: 5 });
    ps.addFloatingText(`DMG ${i}`, i, i);
  }
  assert(ps.particles.length <= 500, `Particle count strictly capped at <= 500 (current: ${ps.particles.length})`);
  assert(ps.floatingTexts.length <= 200, `Floating texts strictly capped at <= 200 (current: ${ps.floatingTexts.length})`);

  // Natural drainage
  for (let t = 0; t < 100; t++) {
    ps.update(0.05);
  }
  assert(ps.particles.length === 0, 'All particles naturally drain to 0 after life expiry');
  assert(ps.floatingTexts.length === 0, 'All floating texts naturally drain to 0 after life expiry');

  // -----------------------------------------------------------------
  // 4. REQUIREMENT R4: Procedural Web Audio Engine
  // -----------------------------------------------------------------
  console.log('\n--- Checking R4: Procedural Web Audio Engine ---');
  const { SoundEngine } = await import('../../../src/audio/sound.js');
  
  // Test headless safety without AudioContext
  const headlessSound = new SoundEngine({ audioContext: null });
  assert(headlessSound.isSupported === false, 'SoundEngine in headless mode marks isSupported = false without error');
  assert(headlessSound.playUiClick() === null, 'Calling audio methods in headless mode returns null gracefully');

  // Test full engine with MockAudioContext
  const mockCtx = new MockAudioContext({ sampleRate: 48000 });
  const sound = new SoundEngine({ audioContext: mockCtx, volume: 0.7 });
  assert(sound.isSupported === true, 'SoundEngine initialized with mock context');
  assert(sound.noiseBuffer !== null, 'Noise buffer pre-compiled in memory');
  assert(sound.noiseBuffer.length === 48000, 'Noise buffer is exactly 48,000 samples (1.0s at 48kHz)');

  // Autoplay unlock
  assert(sound.unlocked === false, 'Audio starts locked when context is suspended');
  await sound.resume();
  assert(sound.unlocked === true, 'resume() transitions to unlocked state');

  // Volume & Mute control
  sound.setVolume(1.5);
  assert(sound.getVolume() === 1.0, 'setVolume clamps at max 1.0');
  sound.setVolume(-0.5);
  assert(sound.getVolume() === 0.0, 'setVolume clamps at min 0.0');
  sound.setVolume(0.8);
  assert(sound.getVolume() === 0.8, 'setVolume applies valid 0.8');

  assert(sound.getIsMuted() === false, 'Sound starts unmuted');
  const muteState = sound.toggleMute();
  assert(muteState === true, 'toggleMute() mutes sound');
  assert(sound.playUiClick() === null, 'Muted engine returns null on play');
  sound.toggleMute();
  assert(sound.getIsMuted() === false, 'toggleMute() restores unmuted state');

  // Test 14 synthesis recipes
  const s1 = sound.playUiClick();
  assert(s1 !== null && s1.osc.started && s1.osc.stopped, 'playUiClick synthesizes and schedules start & stop');

  const s2 = sound.playAttack('knight');
  assert(s2 !== null, 'playAttack(knight) synthesizes melee hit');

  const s3 = sound.playAttack('ranger', true);
  assert(s3 !== null && s3.tone && s3.noise, 'playAttack(ranger) synthesizes arrow shot & noise');

  const s4 = sound.playHit(false);
  assert(s4 !== null, 'playHit(normal) synthesizes');

  const s5 = sound.playHit(true);
  assert(s5 !== null, 'playHit(crit) synthesizes heavy impact');

  const s6 = sound.playSkill('Q', 'knight');
  assert(s6 !== null, 'playSkill(Q) synthesizes');

  const s7 = sound.playLevelUp();
  assert(s7 !== null && s7.length === 4, 'playLevelUp synthesizes 4-note victory arpeggio (C4-E4-G4-C5)');

  const s8 = sound.playShopBuy();
  assert(s8 !== null, 'playShopBuy synthesizes coin cha-ching');

  const s9 = sound.playShopSell();
  assert(s9 !== null, 'playShopSell synthesizes');

  const s10 = sound.playRecallStart();
  assert(s10 !== null, 'playRecallStart synthesizes warp resonance');

  const s11 = sound.playRecallInterrupt();
  assert(s11 !== null, 'playRecallInterrupt synthesizes error buzz');

  const s12 = sound.playRecallComplete();
  assert(s12 !== null, 'playRecallComplete synthesizes teleport flash');

  const s13 = sound.playAlertBoss();
  assert(s13 !== null, 'playAlertBoss synthesizes boss war horn');

  const s14 = sound.playVictory();
  assert(s14 !== null, 'playVictory synthesizes epic major fanfarre');

  const s15 = sound.playDefeat();
  assert(s15 !== null, 'playDefeat synthesizes minor funeral cadence');

  // Verify all created nodes have scheduled stop
  const unstoppedOscs = mockCtx.createdOscillators.filter(o => o.started && !o.stopped);
  assert(unstoppedOscs.length === 0, `All ${mockCtx.createdOscillators.length} oscillators have scheduled stop times (zero leaks)`);
  const unstoppedSources = mockCtx.createdBufferSources.filter(s => s.started && !s.stopped);
  assert(unstoppedSources.length === 0, `All ${mockCtx.createdBufferSources.length} buffer sources have scheduled stop times (zero leaks)`);

  // -----------------------------------------------------------------
  // 5. INVARIANTS & 60 FPS SIMULATION BENCHMARK
  // -----------------------------------------------------------------
  console.log('\n--- Checking Performance Benchmark: 1,000 Frames Simulation ---');
  const { GameSimulation } = await import('../../../src/game.js');
  const sim = new GameSimulation({
    heroClass: 'knight',
    isHost: true,
    soundEngine: sound
  });

  const startTime = performance.now();
  const frameCount = 1000;
  const dt = 1 / 60; // 16.67ms per frame

  for (let frame = 0; frame < frameCount; frame++) {
    sim.update(dt);
    if (frame % 30 === 0) {
      sim.handleCommand({ type: 'MOVE_TO', x: 800 + (frame % 400), y: 800 + (frame % 400) });
      sim.particles.emit('spark', { x: 500, y: 500, count: 6 });
    }
  }

  const durationMs = performance.now() - startTime;
  const avgFrameMs = durationMs / frameCount;
  console.log(`Executed ${frameCount} frames in ${durationMs.toFixed(1)}ms (avg: ${avgFrameMs.toFixed(3)}ms/frame).`);
  assert(avgFrameMs < 16.67, `Average frame time ${avgFrameMs.toFixed(3)}ms is well within 60 FPS budget (<16.67ms)`);

  console.log('\n===============================================================');
  console.log('ALL INDEPENDENT VERIFICATION CHECKS PASSED WITH 100% SUCCESS!');
  console.log('===============================================================\n');
}

runAuditorValidation().catch(err => {
  console.error('Validation Error:', err);
  process.exit(1);
});
