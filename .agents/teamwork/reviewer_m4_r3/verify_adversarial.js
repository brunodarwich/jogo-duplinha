import { SoundEngine } from '../../../src/audio/sound.js';
import { HUDController } from '../../../src/ui/hud.js';

class MockAudioParam {
  constructor(val = 0) {
    this.value = val;
    this.history = [];
  }
  setValueAtTime(v, t) {
    this.value = v;
    this.history.push({ op: 'set', v, t });
  }
  exponentialRampToValueAtTime(v, t) {
    this.value = v;
    this.history.push({ op: 'expRamp', v, t });
  }
  linearRampToValueAtTime(v, t) {
    this.value = v;
    this.history.push({ op: 'linRamp', v, t });
  }
}

class MockAudioNode {
  constructor() {
    this.destinations = [];
  }
  connect(dest) {
    this.destinations.push(dest);
    return dest;
  }
  disconnect() {
    this.destinations = [];
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
    this.startTime = 0;
    this.stopTime = 0;
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
    this.frequency = new MockAudioParam(1000);
    this.Q = new MockAudioParam(1);
  }
}

class MockAudioBuffer {
  constructor(channels, length, sampleRate) {
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.channelData = [new Float32Array(length)];
  }
  getChannelData(idx) {
    return this.channelData[idx] || this.channelData[0];
  }
}

class MockAudioBufferSourceNode extends MockAudioNode {
  constructor() {
    super();
    this.buffer = null;
    this.started = false;
    this.stopped = false;
  }
  start(t = 0) {
    this.started = true;
  }
  stop(t = 0) {
    this.stopped = true;
  }
}

class MockAudioContext {
  constructor() {
    this.sampleRate = 44100;
    this.currentTime = 1.0;
    this.state = 'suspended';
    this.destination = new MockAudioNode();
  }
  createGain() { return new MockGainNode(); }
  createOscillator() { return new MockOscillatorNode(); }
  createBiquadFilter() { return new MockBiquadFilterNode(); }
  createBuffer(channels, length, sampleRate) { return new MockAudioBuffer(channels, length, sampleRate); }
  createBufferSource() { return new MockAudioBufferSourceNode(); }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
}

async function runAdversarialAudit() {
  console.log('=== STARTING INDEPENDENT ADVERSARIAL AUDIT ===');
  let passCount = 0;
  let failCount = 0;

  function assert(cond, msg) {
    if (cond) {
      passCount++;
    } else {
      failCount++;
      console.error(`FAIL: ${msg}`);
    }
  }

  // 1. Contract adherence check
  const requiredMethods = [
    'init', 'resume', 'setMuted', 'toggleMute', 'setVolume', 'play',
    'playUiClick', 'playAttack', 'playHit', 'playSkill', 'playLevelUp',
    'playShopBuy', 'playShopSell', 'playRecallStart', 'playRecallInterrupt',
    'playRecallComplete', 'playAlertBoss', 'playVictory', 'playDefeat'
  ];
  const headlessEngine = new SoundEngine();
  for (const m of requiredMethods) {
    assert(typeof headlessEngine[m] === 'function', `SoundEngine must implement ${m}()`);
  }

  // 2. Headless safety
  assert(headlessEngine.isSupported === false, 'Headless must have isSupported=false');
  for (const m of requiredMethods) {
    if (m === 'init') {
      assert(headlessEngine.init() === headlessEngine, 'init() returns instance');
    } else if (m === 'resume') {
      const p = await headlessEngine.resume();
      assert(p === true, 'resume() resolves true');
    } else if (m === 'setMuted' || m === 'toggleMute') {
      assert(typeof headlessEngine[m](true) === 'boolean', `${m} returns boolean`);
    } else if (m === 'setVolume') {
      assert(typeof headlessEngine[m](0.5) === 'number', `${m} returns number`);
    } else {
      const res = headlessEngine[m]('arg1', 'arg2');
      assert(res === null, `${m} returns null in headless mode without errors`);
    }
  }

  // 3. Mock Web Audio Graph & Synthesis
  const mockCtx = new MockAudioContext();
  const engine = new SoundEngine({ audioContext: mockCtx, volume: 0.65 });
  assert(engine.isSupported === true, 'Supported with mock context');
  assert(engine.masterGain !== null, 'masterGain created');
  assert(engine.sfxGain !== null, 'sfxGain created');
  assert(engine.sfxGain.destinations[0] === engine.masterGain, 'sfxGain connects to masterGain');
  assert(engine.masterGain.destinations[0] === mockCtx.destination, 'masterGain connects to destination');
  assert(engine.noiseBuffer.length === 44100, 'Noise buffer has 1 sec of samples');

  // Verify bounded lifetime on all recipes
  const recipes = [
    () => engine.playUiClick(),
    () => engine.playAttack('knight', false),
    () => engine.playAttack('ranger', true),
    () => engine.playAttack('sorceress', true),
    () => engine.playAttack('cleric', true),
    () => engine.playHit(false),
    () => engine.playHit(true),
    () => engine.playSkill('Q', 'knight'),
    () => engine.playSkill('W', 'sorceress'),
    () => engine.playSkill('E', 'ranger'),
    () => engine.playSkill('R', 'assassin'),
    () => engine.playLevelUp(),
    () => engine.playShopBuy(),
    () => engine.playShopSell(),
    () => engine.playAlertBoss(),
    () => engine.playVictory(),
    () => engine.playDefeat()
  ];

  for (let i = 0; i < recipes.length; i++) {
    const res = recipes[i]();
    assert(res !== null, `Recipe #${i} must return synthesized node(s)`);
  }

  // Recall lifecycle
  const rec = engine.playRecallStart();
  assert(rec !== null, 'playRecallStart returns active source');
  assert(engine.activeRecallSource === rec, 'activeRecallSource tracked');
  engine.playRecallInterrupt();
  assert(engine.activeRecallSource === null, 'activeRecallSource cleared after interrupt');

  engine.playRecallStart();
  engine.playRecallComplete();
  assert(engine.activeRecallSource === null, 'activeRecallSource cleared after complete');

  // Consecutive stops
  engine.stopActiveRecall();
  engine.stopActiveRecall();
  assert(engine.activeRecallSource === null, 'Consecutive stopActiveRecall is safe');

  // 4. Input bounds and clamping
  assert(engine.setVolume(-5) === 0.0, 'Negative volume clamped to 0');
  assert(engine.setVolume(100) === 1.0, 'Large volume clamped to 1');
  assert(engine.setVolume(NaN) === 0.7, 'NaN volume defaults to 0.7');
  assert(engine.setVolume(undefined) === 0.7, 'Undefined volume defaults to 0.7');

  // 5. HUD Audio Controls & keyboard 'M'
  const mockButton = {
    textContent: '🔊',
    classList: {
      classes: new Set(),
      add(c) { this.classes.add(c); },
      remove(c) { this.classes.delete(c); },
      contains(c) { return this.classes.has(c); }
    },
    title: '',
    addEventListener(evt, fn) { this[evt] = fn; }
  };
  const mockSlider = {
    value: '0.65',
    addEventListener(evt, fn) { this[evt] = fn; }
  };
  let keyHandler = null;

  globalThis.window = {
    addEventListener(type, fn) {
      if (type === 'keydown') keyHandler = fn;
    }
  };
  globalThis.document = {
    getElementById(id) {
      if (id === 'btn-audio-toggle') return mockButton;
      if (id === 'sound-volume-slider') return mockSlider;
      return null;
    },
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };

  const hud = new HUDController();
  hud.setupAudioControls(engine);

  assert(mockButton.textContent === '🔊', 'Initial icon 🔊');
  assert(mockSlider.value === String(engine.getVolume()), 'Slider matches volume');

  // Press 'm'
  let defaultPrevented = false;
  keyHandler({ key: 'm', preventDefault() { defaultPrevented = true; } });
  assert(engine.isMuted === true, 'm key toggled mute on');
  assert(mockButton.textContent === '🔇', 'Muted icon 🔇');
  assert(mockButton.classList.contains('muted'), 'Has muted class');

  // Press 'M' inside text input -> should be ignored!
  keyHandler({ key: 'm', target: { tagName: 'INPUT' }, preventDefault() {} });
  assert(engine.isMuted === true, 'm key ignored inside input');

  // Press 'M' outside input -> toggles back
  keyHandler({ key: 'M', preventDefault() {} });
  assert(engine.isMuted === false, 'M key toggled mute off');
  assert(mockButton.textContent === '🔊', 'Restored icon 🔊');

  // Restore environment for pure headless simulation
  delete globalThis.window;
  delete globalThis.document;

  // 6. Test GameSimulation integration with a Spy SoundEngine
  const { GameSimulation } = await import('../../../src/game.js');
  const audioCalls = [];
  const spySound = {
    isMuted: false,
    getVolume() { return 0.7; },
    setVolume(v) { return v; },
    toggleMute() { this.isMuted = !this.isMuted; return this.isMuted; },
    setMuted(m) { this.isMuted = m; return m; },
    playUiClick() { audioCalls.push('playUiClick'); },
    playAttack(hero, ranged) { audioCalls.push(`playAttack:${hero}:${ranged}`); },
    playHit(isCrit) { audioCalls.push(`playHit:${isCrit}`); },
    playSkill(slot, heroId) { audioCalls.push(`playSkill:${slot}:${heroId}`); },
    playLevelUp() { audioCalls.push('playLevelUp'); },
    playShopBuy() { audioCalls.push('playShopBuy'); },
    playShopSell() { audioCalls.push('playShopSell'); },
    playRecallStart() { audioCalls.push('playRecallStart'); },
    playRecallInterrupt() { audioCalls.push('playRecallInterrupt'); },
    playRecallComplete() { audioCalls.push('playRecallComplete'); },
    playAlertBoss() { audioCalls.push('playAlertBoss'); },
    playVictory() { audioCalls.push('playVictory'); },
    playDefeat() { audioCalls.push('playDefeat'); }
  };

  const game = new GameSimulation({ soundEngine: spySound });
  assert(game.sound === spySound, 'GameSimulation attached spySound');

  // Trigger basic attack
  const dummyHero = {
    heroId: 'knight',
    heroClass: 'knight',
    attackRange: 120,
    critChance: 0,
    attackDamage: 50,
    lifesteal: 0,
    x: 100,
    y: 100
  };
  const dummyTarget = {
    isAlive() { return true; },
    armor: 10,
    magicResist: 10,
    hp: 100,
    maxHp: 100,
    x: 120,
    y: 100,
    takeDamage(dmg) { this.hp -= dmg; return dmg; }
  };

  game.executeHeroBasicAttack(dummyHero, dummyTarget);
  assert(audioCalls.includes('playAttack:knight:false'), 'executeHeroBasicAttack triggered playAttack');
  assert(audioCalls.includes('playHit:false'), 'applyHeroHit triggered playHit');

  // Trigger skill
  const dummySkill = { cooldown: 5, manaCost: 20 };
  dummyHero.mana = 50;
  dummyHero.abilities = { Q: dummySkill };
  game.executeHeroSkill('Q', dummySkill, { targetX: 200, targetY: 200 }, dummyHero);
  assert(audioCalls.includes('playSkill:Q:knight'), 'executeHeroSkill triggered playSkill');

  // Trigger level up
  game.triggerLevelUpVFX(dummyHero, 2);
  assert(audioCalls.includes('playLevelUp'), 'triggerLevelUpVFX triggered playLevelUp');

  // Trigger boss alert
  game.bossManager = {
    colossusSpawned: false,
    behemothSpawned: false,
    checkWaveSpawns(w) {
      if (w === 5) this.colossusSpawned = true;
    },
    update() {},
    isSupremeBossAlive() { return true; }
  };
  game.waveSpawner = { waveIndex: 5, update() {} };
  game.entities = [];
  game.towers = [];
  game.projectiles = [];
  game.minions = [];
  game.update(0.016);
  assert(audioCalls.includes('playAlertBoss'), 'Boss spawn triggered playAlertBoss');

  // Trigger victory & defeat
  game.isVictory = false;
  game.alliedNexus = { hp: 1000 };
  game.enemyNexus = { hp: 0 };
  game.bossManager.isSupremeBossAlive = () => false;
  game.showGameOverModal = () => {};
  game.update(0.016);
  assert(audioCalls.includes('playVictory'), 'Victory triggered playVictory');

  game.isVictory = false;
  game.isDefeat = false;
  game.alliedNexus = { hp: 0 };
  game.enemyNexus = { hp: 1000 };
  game.update(0.016);
  assert(audioCalls.includes('playDefeat'), 'Defeat triggered playDefeat');

  console.log(`=== AUDIT COMPLETE: ${passCount} PASSED, ${failCount} FAILED ===`);
  if (failCount > 0) process.exit(1);
}

runAdversarialAudit().catch(err => {
  console.error(err);
  process.exit(1);
});
