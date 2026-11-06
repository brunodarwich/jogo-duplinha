import { enableTouchActivation } from './touch_button.js';
/**
 * HUD & Minimap Controller.
 * Manages player stats, health/mana bars, Q/W/E/R/B ability radial cooldown sweeps,
 * 6-slot inventory, match timer, and interactive 200x200 minimap.
 *
 * Source: PROJECT.md §1 & explorer_m1_3/handoff.md
 */

import { screenToWorld } from '../core/isometric.js';
import { canUpgradeAbility } from '../systems/leveling.js';
import { EventBannerManager } from './event_banners.js';

/**
 * Formats match elapsed seconds to MM:SS string.
 * @param {number} seconds 
 * @returns {string}
 */
export function formatMatchTime(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
}

export function getObjectiveStatus(state = {}) {
  if (state.isVictory) return { objective: 'Vitória! Nexus inimigo destruído', detail: 'Sua equipe venceu.', wave: '' };
  if (state.isDefeat) return { objective: 'Seu Nexus foi destruído', detail: 'Volte à seleção para jogar novamente.', wave: '' };
  const towers = (state.entities || []).filter(e => e.type === 'tower' && e.team === 'enemy' &&
    (typeof e.isAlive === 'function' ? e.isAlive() : e.hp > 0));
  const outerAlive = towers.some(e => e.tier === 'outer' || String(e.id).includes('outer')) || towers.length >= 2;
  const objective = typeof state.currentObjective === 'string' ? state.currentObjective :
    (outerAlive ? 'Destrua a torre externa' : towers.length ? 'Destrua a torre interna' : 'Destrua o Nexus inimigo');
  const seconds = Number.isFinite(state.nextWaveIn) ? state.nextWaveIn :
    Math.max(0, (state.nextWaveTime || 60) - (state.matchTime || 0));
  const nextWave = (state.waveIndex || 0) + 1;
  let detail = towers.length ? 'Avance junto com seus lacaios.' : 'Nexus vulnerável — ataque o cristal!';
  if (nextWave === 5) detail += ' Colosso na próxima onda.';
  if (nextWave === 10) detail += ' Behemoth na próxima onda.';
  return { objective, detail, wave: 'Próxima onda em ' + formatMatchTime(Math.ceil(Math.max(0, seconds))) };
}

/** Presentation-only state for the same active boss selected by the previous canvas HUD. */
export function getBossStatus(bosses = []) {
  const boss = bosses.find(b => b && (typeof b.isAlive === 'function' ? b.isAlive() : b.hp > 0));
  if (!boss) return null;
  const maxHp = Math.max(1, boss.maxHp || 1);
  const hp = Math.max(0, Math.min(maxHp, boss.hp || 0));
  const names = { 'Nexus Guardian': 'Guardião do Nexus', 'Stone Colossus': 'Colosso de Pedra', 'Abyssal Behemoth': 'Behemoth Abissal' };
  return { label: `${names[boss.name] || boss.name || 'Guardião do Nexus'} · Fase ${boss.phase || 1}`,
    hp: `${Math.ceil(hp)} / ${maxHp}`, ratio: hp / maxHp, shielded: !!boss.shieldActive };
}

/**
 * Interactive 200x200 Minimap Widget.
 */
export class Minimap {
  /**
   * @param {HTMLCanvasElement} [canvas=null]
   */
  constructor(canvas = null) {
    this.listeners = [];
    this.canvas = canvas;
    this.ctx = canvas && typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
    this.size = 200;
    this.scale = 200 / 3200; // 0.0625 (1px = 16 world units)
    this.isDragging = false;
  }

  listen(target, name, callback, options) {
    target.addEventListener(name, callback, options);
    this.listeners.push(() => target.removeEventListener(name, callback, options));
  }

  destroy() {
    this.listeners.forEach(remove => remove());
    this.listeners = [];
    this.isDragging = false;
  }

  worldToMap(wx, wy) {
    return {
      mx: Math.max(0, Math.min(this.size, wx * this.scale)),
      my: Math.max(0, Math.min(this.size, wy * this.scale))
    };
  }

  mapToWorld(mx, my) {
    return {
      wx: Math.max(0, Math.min(3200, mx / this.scale)),
      wy: Math.max(0, Math.min(3200, my / this.scale))
    };
  }

  setupInteraction(onMoveCommand, onPanCommand) {
    if (!this.canvas) return;

    const handlePointer = (e, isClick = false) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = Math.max(0, Math.min(this.size, (e.clientX - rect.left) * (this.size / rect.width)));
      // Invert Y from screen canvas so bottom-left is (0,0) and top-right is (3200,3200)
      const rawMy = Math.max(0, Math.min(this.size, (e.clientY - rect.top) * (this.size / rect.height)));
      const my = this.size - rawMy;
      const world = this.mapToWorld(mx, my);

      if (e.button === 2 && isClick) {
        if (onMoveCommand) onMoveCommand(world.wx, world.wy);
      } else if (e.button === 0) {
        if (onPanCommand) onPanCommand(world.wx, world.wy);
      }
    };

    this.listen(this.canvas, 'pointerdown', (e) => {
      e.stopPropagation();
      this.isDragging = true;
      handlePointer(e, true);
    });

    this.listen(window, 'pointermove', (e) => {
      if (this.isDragging) {
        handlePointer(e, false);
      }
    });

    this.listen(window, 'pointerup', () => {
      this.isDragging = false;
    });

    this.listen(this.canvas, 'contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  }

  render(gameState, camera, zoom = 1.0, viewportWidth = 1280, viewportHeight = 720) {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.clearRect(0, 0, this.size, this.size);

    // 1. Terrain Base
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, this.size, this.size);

    // Lane Corridor (Diagonal path from bottom-left (25, 175) to top-right (175, 25))
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 22; // ~350 units / 16
    ctx.beginPath();
    ctx.moveTo(25, 175);
    ctx.lineTo(175, 25);
    ctx.stroke();

    // Center River accent (perpendicular to bottom-left -> top-right lane)
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(85, 85);
    ctx.lineTo(115, 115);
    ctx.stroke();

    // 2. Bases
    // Allied Base (Bottom-Left)
    ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
    ctx.beginPath();
    ctx.arc(25, 175, 15.6, 0, Math.PI * 2);
    ctx.fill();

    // Enemy Base (Top-Right)
    ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
    ctx.beginPath();
    ctx.arc(175, 25, 15.6, 0, Math.PI * 2);
    ctx.fill();

    // 3. Entities
    const entities = gameState?.entities || [];

    for (const ent of entities) {
      const isDead = typeof ent.isDead === 'function' ? ent.isDead() : !!ent.isDead;
      if (isDead || (typeof ent.hp === 'number' && ent.hp <= 0)) continue;

      const rawPos = this.worldToMap(ent.x, ent.y);
      const mx = rawPos.mx;
      const my = this.size - rawPos.my;
      const isAllied = ent.team === 'allied';

      if (ent.type === 'tower' || ent.type === 'nexus') {
        ctx.fillStyle = isAllied ? '#38bdf8' : '#f87171';
        if (ent.type === 'nexus') {
          ctx.fillRect(mx - 3, my - 3, 6, 6);
        } else {
          ctx.beginPath();
          ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (ent.type === 'minion') {
        ctx.fillStyle = isAllied ? '#67e8f9' : '#fca5a5';
        ctx.fillRect(mx - 1, my - 1, 2, 2);
      } else if (ent.type === 'hero') {
        if (ent.isLocalPlayer) {
          ctx.fillStyle = '#fbbf24'; // Gold dot
          ctx.beginPath();
          ctx.arc(mx, my, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        } else {
          ctx.fillStyle = isAllied ? '#22c55e' : '#ef4444';
          ctx.beginPath();
          ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 4. Camera Viewport Frustum Rectangle
    if (camera) {
      const vw = camera.viewportWidth || viewportWidth;
      const vh = camera.viewportHeight || viewportHeight;
      const z = camera.zoom ?? zoom;
      const vp = { width: vw, height: vh };
      const tl = screenToWorld(0, 0, camera, z, vp);
      const tr = screenToWorld(vw, 0, camera, z, vp);
      const br = screenToWorld(vw, vh, camera, z, vp);
      const bl = screenToWorld(0, vh, camera, z, vp);

      const p0 = this.worldToMap(tl.wx, tl.wy);
      const p1 = this.worldToMap(tr.wx, tr.wy);
      const p2 = this.worldToMap(br.wx, br.wy);
      const p3 = this.worldToMap(bl.wx, bl.wy);

      ctx.beginPath();
      ctx.moveTo(p0.mx, this.size - p0.my);
      ctx.lineTo(p1.mx, this.size - p1.my);
      ctx.lineTo(p2.mx, this.size - p2.my);
      ctx.lineTo(p3.mx, this.size - p3.my);
      ctx.closePath();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fill();
    }
  }
}

/**
 * HUD Controller managing DOM HUD overlays, abilities, inventory, and stats.
 */
export class HUDController {
  constructor() {
    this.listeners = [];
    this.timers = new Set();
    this.elements = {};
    this.minimap = null;
    this.eventBanners = new EventBannerManager();
    this.prevCooldowns = { Q: 0, W: 0, E: 0, R: 0, B: 0 };
    this.onAudioToggle = null;
    this.onVolumeChange = null;
    this.sound = null;
    this.cacheDOMElements();
  }

  listen(target, name, callback, options) {
    if (!target) return;
    target.addEventListener(name, callback, options);
    this.listeners.push(() => target.removeEventListener(name, callback, options));
  }

  schedule(callback, delay) {
    const timer = setTimeout(() => { this.timers.delete(timer); callback(); }, delay);
    this.timers.add(timer);
  }

  destroy() {
    this.listeners.forEach(remove => remove());
    this.listeners = [];
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
    this.minimap?.destroy();
    this.eventBanners.clear();
  }

  cacheDOMElements() {
    if (typeof document === 'undefined') return;

    this.elements = {
      // Top HUD & Audio
      matchTimer: document.getElementById('match-timer'),
      objective: document.getElementById('hud-objective'),
      objectiveExpanded: document.getElementById('hud-objective-expanded'),
      boss: document.getElementById('boss-hud'),
      bossName: document.getElementById('boss-name'),
      bossHp: document.getElementById('boss-hp-text'),
      bossFill: document.getElementById('boss-hp-fill'),
      bossShield: document.getElementById('boss-shield'),
      objectiveDetail: document.getElementById('hud-objective-detail'),
      nextWave: document.getElementById('hud-next-wave'),
      networkStatus: document.getElementById('hud-network-status'),
      alliedTowers: document.getElementById('allied-towers-count'),
      enemyTowers: document.getElementById('enemy-towers-count'),
      audioToggleBtn: document.getElementById('btn-audio-toggle'),
      bannerContainer: document.getElementById('event-banner-container'),
      endgameModal: document.getElementById('endgame-modal'),

      // Portrait & Level
      heroPortrait: document.getElementById('hero-portrait'),
      levelBadge: document.getElementById('hero-level-badge'),

      // Stats
      statAd: document.getElementById('stat-ad'),
      statAp: document.getElementById('stat-ap'),
      statArmor: document.getElementById('stat-armor'),
      statMr: document.getElementById('stat-mr'),
      statSpeed: document.getElementById('stat-speed'),
      statGold: document.getElementById('stat-gold'),
      shopGold: document.getElementById('hud-shop-gold'),

      // Status Bars
      hpContainer: document.querySelector('.bar-container.hp-bar'),
      hpFill: document.getElementById('hud-hp-fill'),
      hpText: document.getElementById('hud-hp-text'),
      manaFill: document.getElementById('hud-mana-fill'),
      manaText: document.getElementById('hud-mana-text'),
      xpFill: document.getElementById('hud-xp-fill'),
      xpText: document.getElementById('hud-xp-text'),

      // Ability Slots
      abilityQ: document.getElementById('ability-q'),
      abilityW: document.getElementById('ability-w'),
      abilityE: document.getElementById('ability-e'),
      abilityR: document.getElementById('ability-r'),
      abilityB: document.getElementById('ability-b'),

      // Ability Upgrade Buttons
      upgradeBtnQ: document.getElementById('btn-upgrade-q'),
      upgradeBtnW: document.getElementById('btn-upgrade-w'),
      upgradeBtnE: document.getElementById('btn-upgrade-e'),
      upgradeBtnR: document.getElementById('btn-upgrade-r'),

      // Ability Rank Pips
      pipsQ: document.getElementById('pips-q'),
      pipsW: document.getElementById('pips-w'),
      pipsE: document.getElementById('pips-e'),
      pipsR: document.getElementById('pips-r'),

      // Death Timer Overlay (M1 / R1)
      deathOverlay: document.getElementById('death-timer-overlay'),
      deathCountdown: document.getElementById('death-timer-countdown'),

      // Minimap Canvas
      minimapCanvas: document.getElementById('minimap-canvas'),

      // Audio Controls
      volumeSlider: document.getElementById('sound-volume-slider')
    };

    if (this.elements.audioToggleBtn) {
      this.listen(this.elements.audioToggleBtn, 'click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (typeof this.onAudioToggle === 'function') {
          this.onAudioToggle();
        }
      });
    }

    if (this.elements.volumeSlider) {
      this.listen(this.elements.volumeSlider, 'input', (e) => {
        const val = parseFloat(e.target.value);
        if (typeof this.onVolumeChange === 'function') {
          this.onVolumeChange(val);
        } else if (this.sound) {
          this.sound.setVolume(val);
        }
      });
    }

    if (this.elements.minimapCanvas) {
      this.minimap = new Minimap(this.elements.minimapCanvas);
    }
    for (const button of document.querySelectorAll('.ability-slot, .ability-levelup-btn')) {
      enableTouchActivation(button, this.listen.bind(this));
    }
    const panels = [...document.querySelectorAll('.hud-info-panel, .hud-settings-panel')];
    for (const panel of panels) {
      this.listen(panel.querySelector('summary'), 'click', () => this.cancelMovement?.());
      this.listen(document, 'pointerdown', e => {
        if (!panel.contains(e.target)) panel.open = false;
      });
      this.listen(panel, 'toggle', () => {
        if (panel.open) {
          for (const other of panels) if (other !== panel) other.open = false;
          this.cancelMovement?.();
        }
      });
      this.listen(panel, 'keydown', e => {
        if (e.key === 'Escape') {
          panel.open = false;
          panel.querySelector('summary')?.focus();
          e.preventDefault();
          e.stopPropagation();
        }
      }, { capture: true });
    }
  }

  setupSettings(helpUI, joystick) {
    this.cancelMovement = () => joystick.cancelMovement();
    const checkbox = document.getElementById('settings-reduce-motion');
    if (checkbox) {
      checkbox.checked = helpUI.reducedMotion;
      this.listen(checkbox, 'change', () => helpUI.setReducedMotion(checkbox.checked));
    }
  }

  updateBoss(bosses) {
    const view = getBossStatus(bosses);
    const el = this.elements;
    if (!el.boss) return;
    el.boss.hidden = !view;
    if (!view) return;
    el.bossName.textContent = view.label;
    el.bossName.title = view.label;
    el.bossHp.textContent = view.hp;
    el.bossFill.style.width = `${view.ratio * 100}%`;
    el.bossShield.hidden = !view.shielded;
    el.boss.classList.toggle('shielded', view.shielded);
    el.boss.querySelector('[role="progressbar"]').setAttribute('aria-valuenow', String(Math.round(view.ratio * 100)));
  }

  /**
   * Wires a SoundEngine instance to the HUD audio toggle button, volume slider, and 'M' keyboard shortcut.
   * @param {Object} soundEngine 
   */
  setupAudioControls(soundEngine) {
    if (!soundEngine) return;
    this.sound = soundEngine;

    // Sync visual icon
    this.setAudioMuted(soundEngine.isMuted);

    // Sync slider value if element exists
    if (this.elements.volumeSlider && typeof soundEngine.getVolume === 'function') {
      this.elements.volumeSlider.value = String(soundEngine.getVolume());
    }

    // Connect toggle callback
    this.onAudioToggle = () => {
      const isMuted = soundEngine.toggleMute();
      this.setAudioMuted(isMuted);
      if (!isMuted && typeof soundEngine.playUiClick === 'function') {
        soundEngine.playUiClick();
      }
    };

    // Connect volume slider callback
    this.onVolumeChange = (vol) => {
      soundEngine.setVolume(vol);
      if (soundEngine.isMuted) {
        soundEngine.setMuted(false);
        this.setAudioMuted(false);
      }
    };

    // Listen to 'M' key for quick mute toggle
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      this.listen(window, 'keydown', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        if (e.key === 'm' || e.key === 'M') {
          e.preventDefault();
          const isMuted = soundEngine.toggleMute();
          this.setAudioMuted(isMuted);
          if (!isMuted && typeof soundEngine.playUiClick === 'function') {
            soundEngine.playUiClick();
          }
        }
      });
    }
  }

  setAudioMuted(isMuted) {
    if (!this.elements.audioToggleBtn) return;
    if (isMuted) {
      this.elements.audioToggleBtn.textContent = '🔇';
      this.elements.audioToggleBtn.classList.add('muted');
      this.elements.audioToggleBtn.title = 'Áudio Silenciado (Clique para Ativar) [M]';
    } else {
      this.elements.audioToggleBtn.textContent = '🔊';
      this.elements.audioToggleBtn.classList.remove('muted');
      this.elements.audioToggleBtn.title = 'Áudio Ativado (Clique para Silenciar) [M]';
    }
  }

  setupUpgradeListeners(onUpgrade) {
    if (typeof document === 'undefined') return;
    const btns = document.querySelectorAll('.ability-levelup-btn');
    for (const btn of btns) {
      this.listen(btn, 'click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const slot = btn.dataset.upgradeSlot;
        if (slot && typeof onUpgrade === 'function') {
          onUpgrade(slot);
          if (this.sound && typeof this.sound.playUiClick === 'function') {
            this.sound.playUiClick();
          }
        }
      });
    }
  }

  update(playerHero, gameState, inputManager = null) {
    if (typeof document === 'undefined') return;

    // 1. Top HUD
    if (gameState) {
      const view = getObjectiveStatus(gameState);
      if (this.elements.objective) { this.elements.objective.textContent = view.objective; this.elements.objective.title = view.objective; }
      if (this.elements.objectiveExpanded) this.elements.objectiveExpanded.textContent = view.objective;
      if (this.elements.objectiveDetail) this.elements.objectiveDetail.textContent = view.detail;
      if (this.elements.nextWave) this.elements.nextWave.textContent = view.wave;
      if (this.elements.networkStatus) this.elements.networkStatus.textContent = gameState.networkStatus || 'Solo';
    }
    if (this.elements.matchTimer && gameState) {
      this.elements.matchTimer.textContent = formatMatchTime(gameState.matchTime || 0);
    }

    if (this.elements.alliedTowers && gameState) {
      const count = (gameState.entities || []).filter(e => e.type === 'tower' && e.team === 'allied' && (e.isAlive ? e.isAlive() : e.hp > 0)).length;
      this.elements.alliedTowers.textContent = String(count);
    }
    if (this.elements.enemyTowers && gameState) {
      const count = (gameState.entities || []).filter(e => e.type === 'tower' && e.team === 'enemy' && (e.isAlive ? e.isAlive() : e.hp > 0)).length;
      this.elements.enemyTowers.textContent = String(count);
    }

    if (!playerHero) return;

    // 2. Hero Level & Portrait
    if (this.elements.levelBadge) {
      this.elements.levelBadge.textContent = String(playerHero.level || 1);
    }
    if (this.elements.heroPortrait && playerHero.heroId) {
      this.elements.heroPortrait.className = `hero-portrait ${playerHero.heroId}`;
    }

    // 3. Stats Matrix
    if (this.elements.statAd) this.elements.statAd.textContent = String(Math.round(playerHero.attackDamage || 0));
    if (this.elements.statAp) this.elements.statAp.textContent = String(Math.round(playerHero.abilityPower || 0));
    if (this.elements.statArmor) this.elements.statArmor.textContent = String(Math.round(playerHero.armor || 0));
    if (this.elements.statMr) this.elements.statMr.textContent = String(Math.round(playerHero.magicResist || 0));
    if (this.elements.statSpeed) this.elements.statSpeed.textContent = String(Math.round(playerHero.speed || 300));
    if (this.elements.statGold) this.elements.statGold.textContent = String(Math.floor(playerHero.gold || 0));
    if (this.elements.shopGold) this.elements.shopGold.textContent = String(Math.floor(playerHero.gold || 0));

    // 4. HP, Mana and XP Bars
    const hpRatio = Math.max(0, Math.min(1, (playerHero.hp || 0) / (playerHero.maxHp || 1)));
    if (this.elements.hpFill) this.elements.hpFill.style.width = `${(hpRatio * 100).toFixed(1)}%`;
    if (this.elements.hpText) this.elements.hpText.textContent = `${Math.ceil(playerHero.hp || 0)} / ${playerHero.maxHp || 0}`;

    // Low HP Critical Pulse (HP <= 25% and hero alive)
    const isHeroDead = typeof playerHero.isDead === 'function' ? playerHero.isDead() : !!playerHero.isDead;
    const isCriticalHp = hpRatio <= 0.25 && hpRatio > 0 && !isHeroDead;
    if (this.elements.hpContainer) {
      if (isCriticalHp) {
        this.elements.hpContainer.classList.add('critical');
      } else {
        this.elements.hpContainer.classList.remove('critical');
      }
    }
    if (this.elements.hpFill) {
      if (isCriticalHp) {
        this.elements.hpFill.classList.add('critical');
      } else {
        this.elements.hpFill.classList.remove('critical');
      }
    }

    const manaRatio = Math.max(0, Math.min(1, (playerHero.mana || 0) / (playerHero.maxMana || 1)));
    if (this.elements.manaFill) this.elements.manaFill.style.width = `${(manaRatio * 100).toFixed(1)}%`;
    if (this.elements.manaText) this.elements.manaText.textContent = `${Math.ceil(playerHero.mana || 0)} / ${playerHero.maxMana || 0}`;

    if (this.elements.xpFill || this.elements.xpText) {
      const isMaxLevel = (playerHero.level || 1) >= 15;
      if (isMaxLevel) {
        if (this.elements.xpFill) this.elements.xpFill.style.width = '100%';
        if (this.elements.xpText) this.elements.xpText.textContent = 'NÍVEL MÁXIMO (15)';
      } else {
        const currXp = playerHero.xp || 0;
        const maxXp = playerHero.maxXp || 240;
        const ratio = Math.max(0, Math.min(1, currXp / (maxXp || 1)));
        if (this.elements.xpFill) this.elements.xpFill.style.width = `${(ratio * 100).toFixed(1)}%`;
        if (this.elements.xpText) this.elements.xpText.textContent = `${Math.floor(currXp)} / ${maxXp} XP`;
      }
    }

    // 5. Abilities Q, W, E, R, B
    const activeSlot = inputManager?.targetingState?.slot || inputManager?.dispatcher?.targetingSkill;
    const abilities = playerHero.abilities || playerHero.skills || {};

    // Ability Upgrade Buttons & Rank Pips
    const hasSkillPoints = (playerHero.skillPoints || 0) > 0;
    for (const slotKey of ['Q', 'W', 'E', 'R']) {
      const btn = this.elements[`upgradeBtn${slotKey}`];
      if (btn) {
        const canUpgrade = hasSkillPoints && canUpgradeAbility(playerHero, slotKey);
        if (canUpgrade) {
          btn.classList.remove('hidden');
        } else {
          btn.classList.add('hidden');
        }
      }

      const pipsContainer = this.elements[`pips${slotKey}`];
      if (pipsContainer && typeof pipsContainer.querySelectorAll === 'function') {
        const ab = abilities[slotKey];
        const rank = ab?.rank || 0;
        const pips = pipsContainer.querySelectorAll('.pip');
        pips.forEach((pip, idx) => {
          if (idx < rank) {
            pip.classList.add('active');
          } else {
            pip.classList.remove('active');
          }
        });
      }
    }

    const slots = [
      { key: 'Q', el: this.elements.abilityQ },
      { key: 'W', el: this.elements.abilityW },
      { key: 'E', el: this.elements.abilityE },
      { key: 'R', el: this.elements.abilityR },
      { key: 'B', el: this.elements.abilityB }
    ];

    for (const slotItem of slots) {
      const el = slotItem.el;
      if (!el) continue;

      if (slotItem.key === 'B') {
        // Recall slot
        const isRecalling = !!playerHero.isRecalling;
        if (isRecalling) {
          el.classList.add('targeting-active');
        } else {
          el.classList.remove('targeting-active');
        }
        continue;
      }

      const ab = abilities[slotItem.key];
      if (!ab) continue;
      const unlearned = Number.isFinite(ab.rank) && ab.rank <= 0;
      el.classList.toggle?.('unlearned', unlearned);
      const blocked = unlearned || (ab.cooldownRemaining || 0) > 0 || (playerHero.mana || 0) < (ab.manaCost || 0) || isHeroDead;
      const stateLabel = unlearned ? 'Não aprendida — use o botão mais para evoluir' :
        isHeroDead ? 'Indisponível durante a morte' : (ab.cooldownRemaining || 0) > 0 ? 'Em recarga' :
        (playerHero.mana || 0) < (ab.manaCost || 0) ? 'Mana insuficiente' : 'Pronta';
      if (typeof el.setAttribute === 'function') {
        el.setAttribute('aria-disabled', String(blocked));
        el.setAttribute('aria-label', slotItem.key + ': ' + (ab.name || 'Habilidade') + '. ' + stateLabel);
      }

      const cooldown = ab.cooldown || 10;
      const remaining = ab.cooldownRemaining || 0;
      const sweepEl = el.querySelector('.ability-cooldown-sweep');
      const textEl = el.querySelector('.cooldown-text');
      const manaBadge = el.querySelector('.mana-badge');

      if (manaBadge && typeof ab.manaCost === 'number') {
        manaBadge.textContent = String(ab.manaCost);
      }

      // Targeting active
      if (activeSlot === slotItem.key) {
        el.classList.add('targeting-active');
      } else {
        el.classList.remove('targeting-active');
      }

      // Insufficient mana
      if ((playerHero.mana || 0) < (ab.manaCost || 0)) {
        el.classList.add('insufficient-mana');
      } else {
        el.classList.remove('insufficient-mana');
      }

      // Cooldown sweep & ready burst
      const prevRemaining = this.prevCooldowns ? (this.prevCooldowns[slotItem.key] || 0) : 0;
      if (this.prevCooldowns) {
        this.prevCooldowns[slotItem.key] = remaining;
      }

      if (remaining > 0) {
        const fraction = Math.min(1.0, remaining / cooldown);
        const angle = Math.round(fraction * 360);
        if (sweepEl) sweepEl.style.setProperty('--cooldown-angle', `${angle}deg`);
        if (textEl) textEl.textContent = remaining >= 1.0 ? remaining.toFixed(0) : remaining.toFixed(1);
        el.classList.add('cooldown-active');
        el.classList.remove('ready-burst');
      } else {
        if (sweepEl) sweepEl.style.setProperty('--cooldown-angle', '0deg');
        if (textEl) textEl.textContent = '';
        el.classList.remove('cooldown-active');

        // Ability cooldown just reached zero
        if (prevRemaining > 0) {
          el.classList.add('ready-burst');
          this.schedule(() => {
            el.classList.remove('ready-burst');
          }, 600);
        }
      }
    }

    // 6. Death Timer Overlay (M1 / R1)
    if (this.elements.deathOverlay && this.elements.deathCountdown) {
      const isDead = typeof playerHero.isDead === 'function' ? playerHero.isDead() : !!playerHero.isDead;
      const respawnTimer = typeof playerHero.respawnTimer === 'number' ? playerHero.respawnTimer : 0;

      if (isDead && respawnTimer > 0) {
        this.elements.deathOverlay.classList.remove('hidden');
        this.elements.deathCountdown.textContent = `${Math.ceil(respawnTimer)}s`;
        if (this.elements.heroPortrait) {
          this.elements.heroPortrait.classList.add('is-dead');
        }
      } else {
        this.elements.deathOverlay.classList.add('hidden');
        if (this.elements.heroPortrait) {
          this.elements.heroPortrait.classList.remove('is-dead');
        }
      }
    }
  }

  /**
   * Triggers a visual tactile shake on the ability HUD button when cast fails.
   * @param {string} slot - Ability slot ('Q', 'W', 'E', 'R', 'B')
   * @param {string} [reason='cooldown'] - Error reason
   */
  flashAbilityError(slot, reason = 'cooldown') {
    const key = String(slot || 'Q').toUpperCase();
    const el = this.elements?.[`ability${key}`] || (typeof document !== 'undefined' ? document.getElementById(`ability-${key.toLowerCase()}`) : null);
    if (!el) return;
    el.classList.remove('cast-error-shake');
    // Force DOM reflow to re-trigger CSS keyframe animation
    if (typeof el.offsetWidth === 'number') void el.offsetWidth;
    el.classList.add('cast-error-shake');
    this.schedule(() => {
      el.classList.remove('cast-error-shake');
    }, 350);
  }

  getWorldHUDTop() {
    if (typeof document === 'undefined') return 112;
    const toolbar = document.querySelector('.top-hud');
    return Math.max(48, toolbar?.getBoundingClientRect?.().bottom || 0) + 8;
  }
}

