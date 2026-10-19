import { SoundEngine } from '../../../src/audio/sound.js';

console.log('--- Starting Forensic Auditor Adversarial Stress Suite ---');

// 1. Instantiation with missing / undefined / default options
const e1 = new SoundEngine();
const e3 = new SoundEngine(undefined);
if (e1.volume !== 0.7 || e3.volume !== 0.7) {
  throw new Error('Default volume failed');
}

// 2. Extreme volume
const eNeg = new SoundEngine({ volume: -999 });
if (eNeg.volume !== 0) throw new Error('Negative volume clamp failed');
const eHuge = new SoundEngine({ volume: 999 });
if (eHuge.volume !== 1) throw new Error('Huge volume clamp failed');

// 3. Dispatcher empty/invalid
if (e1.play() !== null) throw new Error('play() empty failed');
if (e1.play(null) !== null) throw new Error('play(null) failed');
if (e1.play('') !== null) throw new Error('play("") failed');
if (e1.play('nonsense_sfx') !== null) throw new Error('play(nonsense) failed');

// 4. Repeated recall stop
e1.stopActiveRecall();
e1.stopActiveRecall();
e1.stopActiveRecall();

// 5. Stress 10,000 headless calls
const start = performance.now();
for (let i = 0; i < 10000; i++) {
  e1.playUiClick();
  e1.playAttack('ranger', true);
  e1.playHit(true);
  e1.playSkill('R', 'sorceress');
  e1.playLevelUp();
  e1.playShopBuy();
  e1.playShopSell();
  e1.playRecallStart();
  e1.playRecallInterrupt();
  e1.playRecallComplete();
  e1.playAlertBoss();
  e1.playVictory();
  e1.playDefeat();
}
const elapsed = performance.now() - start;
console.log(`Executed 130,000 sound invocations in ${elapsed.toFixed(1)}ms (${(130000 / (elapsed / 1000)).toFixed(0)} calls/sec)`);

// 6. Test with Custom Mock Audio Context simulating Web Audio environment
class MockParam {
  constructor(v = 0) { this.value = v; }
  setValueAtTime(v) { this.value = v; return this; }
  exponentialRampToValueAtTime(v) { this.value = v; return this; }
  linearRampToValueAtTime(v) { this.value = v; return this; }
}
class MockNode {
  connect(d) { return d; }
  disconnect() {}
}
class MockGain extends MockNode {
  constructor() { super(); this.gain = new MockParam(1); }
}
class MockOsc extends MockNode {
  constructor() {
    super();
    this.type = 'sine';
    this.frequency = new MockParam(440);
    this.detune = new MockParam(0);
  }
  start() {}
  stop() {}
}
class MockFilter extends MockNode {
  constructor() {
    super();
    this.type = 'lowpass';
    this.frequency = new MockParam(350);
    this.Q = new MockParam(1);
  }
}
class MockBuf {
  constructor(c, l, r) {
    this.numberOfChannels = c;
    this.length = l;
    this.sampleRate = r;
    this.data = new Float32Array(l);
  }
  getChannelData() { return this.data; }
}
class MockBufSrc extends MockNode {
  constructor() { super(); this.buffer = null; }
  start() {}
  stop() {}
}
class MockCtx {
  constructor() {
    this.sampleRate = 44100;
    this.currentTime = 0;
    this.state = 'running';
    this.destination = new MockNode();
  }
  createGain() { return new MockGain(); }
  createOscillator() { return new MockOsc(); }
  createBiquadFilter() { return new MockFilter(); }
  createBuffer(c, l, r) { return new MockBuf(c, l, r); }
  createBufferSource() { return new MockBufSrc(); }
  resume() { return Promise.resolve(); }
}

const mockCtx = new MockCtx();
const activeEngine = new SoundEngine({ audioContext: mockCtx, volume: 0.5 });
if (!activeEngine.isSupported) throw new Error('isSupported should be true with mock context');
if (!activeEngine.noiseBuffer) throw new Error('noiseBuffer should be created');

// Check mock playback across all 18 recipes
const c1 = activeEngine.playUiClick();
if (!c1) throw new Error('playUiClick failed');
const a1 = activeEngine.playAttack('knight', false);
if (!a1) throw new Error('playAttack knight failed');
const a2 = activeEngine.playAttack('ranger', true);
if (!a2) throw new Error('playAttack ranger failed');
const a3 = activeEngine.playAttack('sorceress', true);
if (!a3) throw new Error('playAttack sorceress failed');
const a4 = activeEngine.playAttack('cleric', true);
if (!a4) throw new Error('playAttack cleric failed');
const h1 = activeEngine.playHit(false);
if (!h1) throw new Error('playHit normal failed');
const h2 = activeEngine.playHit(true);
if (!h2) throw new Error('playHit crit failed');
const s1 = activeEngine.playSkill('Q');
if (!s1) throw new Error('playSkill Q failed');
const s2 = activeEngine.playSkill('W');
if (!s2) throw new Error('playSkill W failed');
const s3 = activeEngine.playSkill('E');
if (!s3) throw new Error('playSkill E failed');
const s4 = activeEngine.playSkill('R');
if (!s4) throw new Error('playSkill R failed');
const lvl = activeEngine.playLevelUp();
if (!lvl || lvl.length !== 4) throw new Error('playLevelUp failed');
const buy = activeEngine.playShopBuy();
if (!buy) throw new Error('playShopBuy failed');
const sell = activeEngine.playShopSell();
if (!sell) throw new Error('playShopSell failed');
const recStart = activeEngine.playRecallStart();
if (!recStart || !activeEngine.activeRecallSource) throw new Error('playRecallStart failed');
const recInt = activeEngine.playRecallInterrupt();
if (!recInt || activeEngine.activeRecallSource !== null) throw new Error('playRecallInterrupt failed');
activeEngine.playRecallStart();
const recComp = activeEngine.playRecallComplete();
if (!recComp || activeEngine.activeRecallSource !== null) throw new Error('playRecallComplete failed');
const boss = activeEngine.playAlertBoss();
if (!boss) throw new Error('playAlertBoss failed');
const vic = activeEngine.playVictory();
if (!vic || vic.length !== 4) throw new Error('playVictory failed');
const def = activeEngine.playDefeat();
if (!def) throw new Error('playDefeat failed');

console.log('--- ALL FORENSIC ADVERSARIAL STRESS CHECKS PASSED WITH 100% SUCCESS ---');
