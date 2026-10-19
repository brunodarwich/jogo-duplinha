/**
 * Procedural Web Audio API Sound Engine (SFX).
 * Pure procedural synthesis without external audio files or network downloads.
 * Uses Oscillators, BiquadFilter, Gain ADSR envelopes, and in-memory White Noise Buffer.
 *
 * Requirements:
 * - Strict headless compatibility (safe null fallback if window/AudioContext is undefined).
 * - Autoplay compliance (automatic unlock on first user gesture).
 * - Volume [0, 1] clamped & mute controls with localStorage persistence.
 * - 18 procedural synthesis recipes for combat, skills, UI, shop, recall, bosses and victory/defeat.
 *
 * Source: Milestone 4 & survey_explorer_r3_3/handoff.md
 */

export class SoundEngine {
  /**
   * @param {Object} [options={}]
   * @param {Function|Object} [options.audioContext] Optional custom AudioContext class or instance (e.g. mock for tests)
   * @param {number} [options.volume=0.7] Initial volume [0, 1]
   * @param {boolean} [options.muted=false] Initial mute state
   */
  constructor(options = {}) {
    // 1. Initial configuration
    let initialVolume = (typeof options.volume === 'number' && !isNaN(options.volume)) ? options.volume : 0.7;
    let initialMuted = !!options.muted;

    // Load saved preferences from localStorage if available
    try {
      if (typeof localStorage !== 'undefined') {
        const savedVol = localStorage.getItem('moba_sound_volume');
        if (savedVol !== null) {
          const parsed = parseFloat(savedVol);
          if (!isNaN(parsed)) initialVolume = parsed;
        }
        const savedMute = localStorage.getItem('moba_sound_muted');
        if (savedMute !== null) {
          initialMuted = savedMute === 'true';
        }
      }
    } catch (_) {
      // Defensive localStorage fallback (e.g. security sandbox)
    }

    this.volume = Math.max(0, Math.min(1, initialVolume));
    this.isMuted = initialMuted;
    this.unlocked = false;
    this.activeRecallSource = null;

    // 2. Headless & AudioContext detection
    let AudioCtx = options.audioContext || null;
    if (!AudioCtx && typeof window !== 'undefined') {
      AudioCtx = window.AudioContext || window.webkitAudioContext || null;
    }

    if (!AudioCtx) {
      // Headless / unsupported fallback
      this.isSupported = false;
      this.ctx = null;
      this.masterGain = null;
      this.sfxGain = null;
      this.noiseBuffer = null;
      return;
    }

    this.isSupported = true;
    this.initContext(AudioCtx);
  }

  /**
   * Initializes the AudioContext, master gain nodes, and in-memory noise buffer.
   * @param {Function|Object} AudioCtx - AudioContext constructor or existing instance
   */
  initContext(AudioCtx) {
    try {
      if (typeof AudioCtx === 'function') {
        this.ctx = new AudioCtx();
      } else if (typeof AudioCtx === 'object' && AudioCtx !== null) {
        this.ctx = AudioCtx;
      } else {
        this.isSupported = false;
        this.ctx = null;
        return;
      }

      // Master and SFX gain chain: [SFX Gain] -> [Master Gain] -> [Destination]
      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      this.sfxGain.connect(this.masterGain);
      if (this.ctx.destination) {
        this.masterGain.connect(this.ctx.destination);
      }

      // Apply initial volume & mute
      const t = this.ctx.currentTime || 0;
      const initialGain = this.isMuted ? 0 : this.volume;
      if (this.masterGain.gain && typeof this.masterGain.gain.setValueAtTime === 'function') {
        this.masterGain.gain.setValueAtTime(initialGain, t);
      }

      // Precompile 1.0 second White Noise Buffer in memory for zero-GC allocation
      const sampleRate = this.ctx.sampleRate || 44100;
      const bufferSize = Math.max(1, Math.floor(sampleRate));
      if (typeof this.ctx.createBuffer === 'function') {
        this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
        const channelData = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          channelData[i] = Math.random() * 2 - 1;
        }
      } else {
        this.noiseBuffer = null;
      }

      // Autoplay state check
      if (this.ctx.state === 'running') {
        this.unlocked = true;
      } else {
        this.setupAutoplayUnlock();
      }
    } catch (_) {
      this.isSupported = false;
      this.ctx = null;
    }
  }

  /**
   * Safe browser & headless initialization / re-initialization.
   * Matches PROJECT.md interface contract.
   * @param {Object} [options={}]
   */
  init(options = {}) {
    if (this.isSupported && this.ctx) return this;
    const AudioCtx = options.audioContext || (typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null);
    if (AudioCtx) {
      this.isSupported = true;
      this.initContext(AudioCtx);
    }
    return this;
  }

  /**
   * Listens for first user gesture to unlock browser AudioContext.
   */
  setupAutoplayUnlock() {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;

    const unlockHandler = () => {
      this.resume();
      try {
        window.removeEventListener('pointerdown', unlockHandler);
        window.removeEventListener('keydown', unlockHandler);
        window.removeEventListener('touchstart', unlockHandler);
      } catch (_) {}
    };

    try {
      window.addEventListener('pointerdown', unlockHandler, { passive: true });
      window.addEventListener('keydown', unlockHandler, { passive: true });
      window.addEventListener('touchstart', unlockHandler, { passive: true });
    } catch (_) {}
  }

  /**
   * Unlocks / resumes the AudioContext if suspended.
   * @returns {Promise<boolean>}
   */
  resume() {
    if (!this.ctx) {
      this.unlocked = true;
      return Promise.resolve(true);
    }

    if (this.ctx.state === 'suspended' && typeof this.ctx.resume === 'function') {
      return this.ctx.resume().then(() => {
        this.unlocked = true;
        return true;
      }).catch(() => {
        this.unlocked = true;
        return false;
      });
    }

    this.unlocked = true;
    return Promise.resolve(true);
  }

  /**
   * Sets master volume with [0, 1] boundary clamping and saves preference.
   * @param {number} volume - Volume level
   * @returns {number} The clamped volume applied
   */
  setVolume(volume) {
    const parsed = typeof volume === 'number' && !isNaN(volume) ? volume : 0.7;
    this.volume = Math.max(0, Math.min(1, parsed));

    if (this.masterGain && this.ctx && !this.isMuted) {
      const t = this.ctx.currentTime || 0;
      try {
        this.masterGain.gain.setValueAtTime(this.volume, t);
      } catch (_) {}
    }

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('moba_sound_volume', String(this.volume));
      }
    } catch (_) {}

    return this.volume;
  }

  /**
   * Returns current master volume.
   * @returns {number}
   */
  getVolume() {
    return this.volume;
  }

  /**
   * Sets mute status and updates gain node and persistence.
   * @param {boolean} muted 
   * @returns {boolean}
   */
  setMuted(muted) {
    this.isMuted = !!muted;

    if (this.masterGain && this.ctx) {
      const t = this.ctx.currentTime || 0;
      const targetGain = this.isMuted ? 0 : this.volume;
      try {
        this.masterGain.gain.setValueAtTime(targetGain, t);
      } catch (_) {}
    }

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('moba_sound_muted', String(this.isMuted));
      }
    } catch (_) {}

    return this.isMuted;
  }

  /**
   * Toggles mute state between active and muted.
   * @returns {boolean} New mute state
   */
  toggleMute() {
    return this.setMuted(!this.isMuted);
  }

  /**
   * Getter helper for checking mute state.
   * @returns {boolean}
   */
  getIsMuted() {
    return this.isMuted;
  }

  /**
   * Checks whether sounds can currently play.
   * @private
   * @returns {boolean}
   */
  _canPlay() {
    return Boolean(this.isSupported && !this.isMuted && this.ctx && this.volume > 0);
  }

  /**
   * Internal helper to synthesize a tonal oscillator with frequency and gain envelopes.
   * @private
   */
  _playTone({ type = 'sine', startFreq = 440, endFreq = null, duration = 0.1, gain = 0.3, startTime = null }) {
    if (!this._canPlay()) return null;

    try {
      const t = startTime !== null ? startTime : (this.ctx.currentTime || 0);
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(1, startFreq), t);
      if (endFreq !== null && endFreq !== startFreq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t + duration);
      }

      gainNode.gain.setValueAtTime(Math.max(0.0001, gain), t);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, t + duration);

      osc.connect(gainNode);
      gainNode.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + duration);

      return { osc, gainNode };
    } catch (_) {
      return null;
    }
  }

  /**
   * Internal helper to synthesize filtered white noise burst from the precompiled buffer.
   * @private
   */
  _playNoise({ filterType = 'bandpass', filterFreq = 800, filterQ = 1, duration = 0.1, gain = 0.25, startTime = null }) {
    if (!this._canPlay() || !this.noiseBuffer) return null;

    try {
      const t = startTime !== null ? startTime : (this.ctx.currentTime || 0);
      const source = this.ctx.createBufferSource();
      source.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.setValueAtTime(Math.max(20, filterFreq), t);
      if (filter.Q && typeof filter.Q.setValueAtTime === 'function') {
        filter.Q.setValueAtTime(filterQ, t);
      }

      const gainNode = this.ctx.createGain();
      gainNode.gain.setValueAtTime(Math.max(0.0001, gain), t);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, t + duration);

      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.sfxGain);

      source.start(t);
      source.stop(t + duration);

      return { source, filter, gainNode };
    } catch (_) {
      return null;
    }
  }

  // =========================================================================
  // 18 PROCEDURAL SYNTHESIS RECIPES
  // =========================================================================

  /**
   * 1. UI Click: Smooth clean click for HUD buttons and modal actions.
   * Sine 800Hz -> 400Hz (0.04s, gain 0.2).
   */
  playUiClick() {
    return this._playTone({
      type: 'sine',
      startFreq: 800,
      endFreq: 400,
      duration: 0.04,
      gain: 0.2
    });
  }

  /**
   * 2. Basic Attack: Thematic attack sounds for all 5 hero archetypes.
   * - Melee (Knight / Assassin): Noise + Bandpass 800Hz + Sine 180Hz -> 60Hz (0.09s).
   * - Ranged (Ranger): Triangle 500Hz -> 950Hz + Highpass Noise 2000Hz (0.06s).
   * - Mage (Sorceress): Sawtooth with Lowpass 900Hz (350Hz -> 150Hz) + Noise (0.14s).
   * - Cleric: Chord of two sines at C5 (523Hz) and E5 (659Hz) (0.20s).
   * @param {string} [heroType='knight'] 
   * @param {boolean} [isRanged=false]
   */
  playAttack(heroType = 'knight', isRanged = false) {
    if (!this._canPlay()) return null;

    const normalizedHero = String(heroType || '').toLowerCase();
    const t = this.ctx.currentTime || 0;

    if (normalizedHero === 'ranger' || (isRanged && normalizedHero !== 'sorceress' && normalizedHero !== 'cleric')) {
      // Ranger: Arrow string snap & highpass whoosh
      const tone = this._playTone({
        type: 'triangle',
        startFreq: 500,
        endFreq: 950,
        duration: 0.06,
        gain: 0.25,
        startTime: t
      });
      const noise = this._playNoise({
        filterType: 'highpass',
        filterFreq: 2000,
        filterQ: 1.5,
        duration: 0.05,
        gain: 0.15,
        startTime: t
      });
      return { tone, noise };
    }

    if (normalizedHero === 'sorceress') {
      // Mage: Burning fireball ignition (sawtooth + lowpass + noise crackle)
      try {
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gainNode = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(350, t);
        osc.frequency.exponentialRampToValueAtTime(150, t + 0.14);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(900, t);

        gainNode.gain.setValueAtTime(0.28, t);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);

        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.sfxGain);

        osc.start(t);
        osc.stop(t + 0.14);

        const noise = this._playNoise({
          filterType: 'bandpass',
          filterFreq: 600,
          filterQ: 2,
          duration: 0.12,
          gain: 0.18,
          startTime: t
        });

        return { osc, noise };
      } catch (_) {
        return null;
      }
    }

    if (normalizedHero === 'cleric') {
      // Cleric: Sacred dual sine chord in C5 (523Hz) and E5 (659Hz)
      const tone1 = this._playTone({
        type: 'sine',
        startFreq: 523.25,
        duration: 0.20,
        gain: 0.22,
        startTime: t
      });
      const tone2 = this._playTone({
        type: 'sine',
        startFreq: 659.25,
        duration: 0.20,
        gain: 0.20,
        startTime: t
      });
      return { tone1, tone2 };
    }

    // Default Melee (Knight / Assassin): Blade slash + impact
    const tone = this._playTone({
      type: 'sine',
      startFreq: 180,
      endFreq: 60,
      duration: 0.09,
      gain: 0.32,
      startTime: t
    });
    const noise = this._playNoise({
      filterType: 'bandpass',
      filterFreq: 800,
      filterQ: 1.8,
      duration: 0.09,
      gain: 0.24,
      startTime: t
    });
    return { tone, noise };
  }

  /**
   * 3. Hit Impact: Physical hit vs Critical strike.
   * - Normal: Sine 160Hz -> 45Hz + Lowpass noise 300Hz (0.08s).
   * - Crit: Sub-bass 110Hz -> 30Hz + Highpass noise 1500Hz (0.22s, gain 0.5).
   * @param {boolean} [isCrit=false]
   */
  playHit(isCrit = false) {
    if (!this._canPlay()) return null;
    const t = this.ctx.currentTime || 0;

    if (isCrit) {
      // Critical strike concussion
      const subBass = this._playTone({
        type: 'sine',
        startFreq: 110,
        endFreq: 30,
        duration: 0.22,
        gain: 0.50,
        startTime: t
      });
      const crackle = this._playNoise({
        filterType: 'highpass',
        filterFreq: 1500,
        filterQ: 2,
        duration: 0.20,
        gain: 0.35,
        startTime: t
      });
      return { subBass, crackle };
    }

    // Normal hit
    const tone = this._playTone({
      type: 'sine',
      startFreq: 160,
      endFreq: 45,
      duration: 0.08,
      gain: 0.28,
      startTime: t
    });
    const noise = this._playNoise({
      filterType: 'lowpass',
      filterFreq: 300,
      filterQ: 1.2,
      duration: 0.08,
      gain: 0.20,
      startTime: t
    });
    return { tone, noise };
  }

  /**
   * 4. Skill Execution: Distinct procedural audio for Q, W, E, R slots.
   * - Q: Explosive Impact (Sine 300Hz -> 50Hz + Bandpass noise, 0.25s).
   * - W: Resonant sweep 200Hz -> 800Hz (0.40s, aura/buff).
   * - E: Rapid chirp sweep 200Hz -> 1200Hz (0.12s, dash/teleport).
   * - R: Harmonic triple chord + sub-bass rumble 45Hz (0.8s, ultimate).
   * @param {string} [slot='Q']
   * @param {string} [heroId='knight']
   */
  playSkill(slot = 'Q', heroId = 'knight') {
    if (!this._canPlay()) return null;
    const key = String(slot || 'Q').toUpperCase();
    const t = this.ctx.currentTime || 0;

    if (key === 'Q') {
      // Q: Explosive impact
      const tone = this._playTone({
        type: 'sine',
        startFreq: 300,
        endFreq: 50,
        duration: 0.25,
        gain: 0.45,
        startTime: t
      });
      const noise = this._playNoise({
        filterType: 'bandpass',
        filterFreq: 500,
        filterQ: 1.5,
        duration: 0.20,
        gain: 0.35,
        startTime: t
      });
      return { tone, noise };
    }

    if (key === 'W') {
      // W: Resonant filter sweep 200Hz -> 800Hz
      try {
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gainNode = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(260, t);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(200, t);
        filter.frequency.exponentialRampToValueAtTime(800, t + 0.40);
        if (filter.Q) filter.Q.setValueAtTime(3.0, t);

        gainNode.gain.setValueAtTime(0.35, t);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, t + 0.40);

        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.sfxGain);

        osc.start(t);
        osc.stop(t + 0.40);
        return { osc, filter, gainNode };
      } catch (_) {
        return null;
      }
    }

    if (key === 'E') {
      // E: Fast chirp sweep 200Hz -> 1200Hz (dash / mobility)
      return this._playTone({
        type: 'sine',
        startFreq: 200,
        endFreq: 1200,
        duration: 0.12,
        gain: 0.32,
        startTime: t
      });
    }

    if (key === 'R') {
      // R: Epic ultimate triple harmonic chord + sub-bass rumble
      const sub = this._playTone({
        type: 'sine',
        startFreq: 45,
        endFreq: 40,
        duration: 0.80,
        gain: 0.45,
        startTime: t
      });
      const note1 = this._playTone({
        type: 'sawtooth',
        startFreq: 220,
        endFreq: 260,
        duration: 0.75,
        gain: 0.20,
        startTime: t
      });
      const note2 = this._playTone({
        type: 'triangle',
        startFreq: 330,
        endFreq: 390,
        duration: 0.75,
        gain: 0.22,
        startTime: t
      });
      const note3 = this._playTone({
        type: 'sine',
        startFreq: 440,
        endFreq: 520,
        duration: 0.80,
        gain: 0.25,
        startTime: t
      });
      return { sub, note1, note2, note3 };
    }

    // Fallback: generic ability tone
    return this._playTone({
      type: 'sine',
      startFreq: 400,
      endFreq: 200,
      duration: 0.15,
      gain: 0.3,
      startTime: t
    });
  }

  /**
   * 5. Level Up: Ascending major arpeggio fanfare C4-E4-G4-C5 (261, 329, 392, 523 Hz, 65ms per note).
   */
  playLevelUp() {
    if (!this._canPlay()) return null;
    const t = this.ctx.currentTime || 0;
    const notes = [261.63, 329.63, 392.00, 523.25];
    const results = [];

    notes.forEach((freq, idx) => {
      const noteTime = t + idx * 0.065;
      const res = this._playTone({
        type: 'triangle',
        startFreq: freq,
        duration: 0.28,
        gain: 0.26 + (idx * 0.04),
        startTime: noteTime
      });
      if (res) results.push(res);
    });

    return results;
  }

  /**
   * 6. Shop Buy: Two high bell notes B5 (987Hz) -> E6 (1318Hz), 0.15s, gold coins.
   */
  playShopBuy() {
    if (!this._canPlay()) return null;
    const t = this.ctx.currentTime || 0;

    const n1 = this._playTone({
      type: 'triangle',
      startFreq: 987.77,
      duration: 0.10,
      gain: 0.30,
      startTime: t
    });
    const n2 = this._playTone({
      type: 'triangle',
      startFreq: 1318.51,
      duration: 0.15,
      gain: 0.32,
      startTime: t + 0.07
    });

    return { n1, n2 };
  }

  /**
   * 7. Shop Sell: Descending medium note A5 (880Hz) -> E5 (659Hz), 0.12s.
   */
  playShopSell() {
    return this._playTone({
      type: 'triangle',
      startFreq: 880,
      endFreq: 659.25,
      duration: 0.12,
      gain: 0.28
    });
  }

  /**
   * 8. Recall Start: Continuous mysterious tone at 220Hz with soft fade-in.
   */
  playRecallStart() {
    if (!this._canPlay()) return null;
    const t = this.ctx.currentTime || 0;

    // Stop prior active recall if any
    this.stopActiveRecall();

    try {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, t);

      // Subtle warm detune vibrato
      if (osc.detune && typeof osc.detune.setValueAtTime === 'function') {
        osc.detune.setValueAtTime(3, t);
      }

      // Smooth fade-in
      gainNode.gain.setValueAtTime(0.001, t);
      gainNode.gain.linearRampToValueAtTime(0.22, t + 0.35);

      osc.connect(gainNode);
      gainNode.connect(this.sfxGain);

      osc.start(t);
      this.activeRecallSource = { osc, gainNode };
      return this.activeRecallSource;
    } catch (_) {
      return null;
    }
  }

  /**
   * 9. Recall Interrupt: Dissonant buzzer 440Hz -> 100Hz (0.10s) and cuts channeling tone.
   */
  playRecallInterrupt() {
    this.stopActiveRecall();
    return this._playTone({
      type: 'sawtooth',
      startFreq: 440,
      endFreq: 100,
      duration: 0.10,
      gain: 0.35
    });
  }

  /**
   * 10. Recall Complete: Ascending resonant beam up to 1400Hz + shimmer chime.
   */
  playRecallComplete() {
    this.stopActiveRecall();
    if (!this._canPlay()) return null;
    const t = this.ctx.currentTime || 0;

    const beam = this._playTone({
      type: 'sine',
      startFreq: 300,
      endFreq: 1400,
      duration: 0.38,
      gain: 0.36,
      startTime: t
    });

    const shimmer = this._playTone({
      type: 'triangle',
      startFreq: 1760,
      duration: 0.25,
      gain: 0.18,
      startTime: t + 0.15
    });

    return { beam, shimmer };
  }

  /**
   * Stops active ongoing recall channel source safely.
   */
  stopActiveRecall() {
    if (this.activeRecallSource) {
      try {
        const t = this.ctx ? (this.ctx.currentTime || 0) : 0;
        const { osc, gainNode } = this.activeRecallSource;
        if (gainNode?.gain?.linearRampToValueAtTime) {
          gainNode.gain.linearRampToValueAtTime(0.0001, t + 0.03);
        }
        if (osc?.stop) {
          osc.stop(t + 0.03);
        }
      } catch (_) {}
      this.activeRecallSource = null;
    }
  }

  /**
   * 11. Boss Alert: Two-tone war horn (330Hz and 440Hz in 2 pulses).
   */
  playAlertBoss() {
    if (!this._canPlay()) return null;
    const t = this.ctx.currentTime || 0;

    const pulse1 = this._playTone({
      type: 'sawtooth',
      startFreq: 330,
      endFreq: 440,
      duration: 0.14,
      gain: 0.38,
      startTime: t
    });

    const pulse2 = this._playTone({
      type: 'sawtooth',
      startFreq: 330,
      endFreq: 440,
      duration: 0.18,
      gain: 0.42,
      startTime: t + 0.18
    });

    return { pulse1, pulse2 };
  }

  /**
   * 12. Victory: Triumphant sustained major chord C-E-G-C (2.0s duration).
   */
  playVictory() {
    if (!this._canPlay()) return null;
    const t = this.ctx.currentTime || 0;
    const chord = [261.63, 329.63, 392.00, 523.25];
    const results = [];

    chord.forEach((freq, idx) => {
      const res = this._playTone({
        type: 'triangle',
        startFreq: freq,
        duration: 2.0,
        gain: 0.25 + (idx * 0.03),
        startTime: t
      });
      if (res) results.push(res);
    });

    return results;
  }

  /**
   * 13. Defeat: Dark minor tone falling in free fall (150Hz -> 40Hz, 1.8s).
   */
  playDefeat() {
    return this._playTone({
      type: 'sawtooth',
      startFreq: 150,
      endFreq: 40,
      duration: 1.8,
      gain: 0.38
    });
  }

  /**
   * Generic dispatcher for playing sounds by name.
   * Matches PROJECT.md interface contract: play(soundName, options = {})
   * @param {string} soundName 
   * @param {Object} [options={}]
   */
  play(soundName, options = {}) {
    const name = String(soundName || '').toLowerCase();
    switch (name) {
      case 'uiclick':
      case 'click':
        return this.playUiClick();
      case 'attack':
        return this.playAttack(options.heroType, options.isRanged);
      case 'hit':
        return this.playHit(options.isCrit);
      case 'skill':
        return this.playSkill(options.slot, options.heroId);
      case 'levelup':
        return this.playLevelUp();
      case 'shopbuy':
      case 'buy':
        return this.playShopBuy();
      case 'shopsell':
      case 'sell':
        return this.playShopSell();
      case 'recallstart':
        return this.playRecallStart();
      case 'recallinterrupt':
        return this.playRecallInterrupt();
      case 'recallcomplete':
        return this.playRecallComplete();
      case 'alertboss':
      case 'boss':
        return this.playAlertBoss();
      case 'victory':
        return this.playVictory();
      case 'defeat':
        return this.playDefeat();
      default:
        return null;
    }
  }
}
