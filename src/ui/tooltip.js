/**
 * Rich Tactical Tooltip Controller.
 * Manages singleton #game-tooltip with real-time ability scaling (AD/AP/HP),
 * item stats, buy/sell prices, badges, and boundary viewport clamping.
 *
 * Source: PROJECT.md §Interface Contracts & explorer_m2/handoff.md
 */

import { getSellRefund } from '../systems/items.js';

/**
 * Maps item stat keys to human-readable Portuguese labels and icons.
 */
export const STAT_META = {
  attackDamage: { label: 'Dano de Ataque', icon: '⚔️', suffix: '', isPercent: false },
  ap: { label: 'Poder Mágico', icon: '✨', suffix: '', isPercent: false },
  hp: { label: 'Vida Máxima', icon: '❤️', suffix: '', isPercent: false },
  armor: { label: 'Armadura', icon: '🛡️', suffix: '', isPercent: false },
  magicResist: { label: 'Resistência Mágica', icon: '🔮', suffix: '', isPercent: false },
  movementSpeed: { label: 'Velocidade de Movimento', icon: '👟', suffix: '', isPercent: false },
  movementSpeedPercent: { label: 'Velocidade de Movimento', icon: '👟', suffix: '%', isPercent: true },
  cdr: { label: 'Redução de Recarga', icon: '⏱️', suffix: '%', isPercent: true },
  lifesteal: { label: 'Roubo de Vida', icon: '🩸', suffix: '%', isPercent: true },
  critChance: { label: 'Chance de Crítico', icon: '💥', suffix: '%', isPercent: true },
  reflectDamage: { label: 'Reflexão de Dano Físico', icon: '🌵', suffix: '', isPercent: false },
  apMultiplier: { label: 'Multiplicador de AP Total', icon: '👑', suffix: '%', isPercent: true },
  healShieldBonus: { label: 'Bônus de Cura e Escudos', icon: '🌟', suffix: '%', isPercent: true }
};

export class TooltipController {
  constructor() {
    this.element = null;
    this.init();
  }

  /**
   * Initializes or binds to singleton #game-tooltip DOM element.
   * Safe in headless environments.
   */
  init() {
    if (typeof document === 'undefined') return;
    let el = document.getElementById('game-tooltip');
    if (!el) {
      el = document.createElement('div');
      el.id = 'game-tooltip';
      el.className = 'game-tooltip hidden';
      el.setAttribute('role', 'tooltip');
      el.setAttribute('aria-hidden', 'true');
      document.body.appendChild(el);
    }
    this.element = el;
  }

  /**
   * Computes base damage, real-time stat scaling, and formatted text for hero abilities.
   * @param {Object} ability 
   * @param {Object} [hero=null] 
   * @returns {Object} { base, bonus, total, ratio, stat, type, scalingText, summary }
   */
  formatAbilityScaling(ability, hero = null) {
    if (!ability) {
      return { base: 0, bonus: 0, total: 0, ratio: 0, stat: 'AD', type: 'Dano', scalingText: '', summary: '' };
    }

    const rank = Math.max(1, ability.rank || 1);
    const parseStat = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const ad = parseStat(hero?.attackDamage ?? hero?.ad);
    const ap = parseStat(hero?.ap ?? hero?.abilityPower);
    const armor = parseStat(hero?.armor);
    const slot = String(ability.id || ability.slot || '').toUpperCase();
    const heroId = String(hero?.heroId || hero?.id || '').toLowerCase();

    const getRankBase = (arr) => arr[Math.min(Math.max(0, rank - 1), arr.length - 1)] || arr[0];

    let base = 0;
    let ratio = 0;
    let stat = 'AD';
    let type = 'Dano Físico';

    if (heroId.includes('sorceress')) {
      stat = 'AP';
      type = 'Dano Mágico';
      if (slot === 'Q') {
        base = getRankBase([85, 135, 185, 235]);
        ratio = 0.75;
      } else if (slot === 'W') {
        base = getRankBase([70, 110, 150, 190]);
        ratio = 0.60;
      } else if (slot === 'E') {
        base = getRankBase([80, 125, 170, 215]);
        ratio = 0.70;
      } else if (slot === 'R') {
        base = getRankBase([220, 360, 500]);
        ratio = 0.95;
      }
    } else if (heroId.includes('knight')) {
      if (slot === 'W') {
        stat = 'Armadura';
        type = 'Dano Físico';
        base = getRankBase([40, 65, 90, 115]);
        ratio = 0.40;
      } else if (slot === 'Q') {
        stat = 'AD';
        type = 'Dano Físico';
        base = getRankBase([80, 120, 160, 200]);
        ratio = 0.60;
      } else if (slot === 'E') {
        stat = 'AD';
        type = 'Dano Físico';
        base = getRankBase([70, 110, 150, 190]);
        ratio = 0.85;
      } else if (slot === 'R') {
        stat = 'AD';
        type = 'Dano Físico';
        base = getRankBase([150, 250, 350]);
        ratio = 0.70;
      }
    } else if (heroId.includes('ranger')) {
      stat = 'AD';
      type = 'Dano Físico';
      if (slot === 'Q') {
        base = getRankBase([75, 125, 175, 225]);
        ratio = 1.00;
      } else if (slot === 'W') {
        base = getRankBase([50, 80, 110, 140]);
        ratio = 0.60;
      } else if (slot === 'E') {
        base = 0;
        ratio = 0.40;
        type = 'Velocidade / Dano';
      } else if (slot === 'R') {
        base = getRankBase([250, 380, 510]);
        ratio = 1.20;
      }
    } else if (heroId.includes('assassin')) {
      stat = 'AD';
      type = 'Dano Físico';
      if (slot === 'Q') {
        base = getRankBase([60, 95, 130, 165]);
        ratio = 0.90;
      } else if (slot === 'W') {
        base = getRankBase([50, 85, 120, 155]);
        ratio = 0.65;
      } else if (slot === 'E') {
        base = 0;
        ratio = 0;
        type = 'Invisibilidade';
      } else if (slot === 'R') {
        base = getRankBase([240, 360, 480]);
        ratio = 1.30;
      }
    } else if (heroId.includes('cleric')) {
      stat = 'AP';
      if (slot === 'Q') {
        base = getRankBase([90, 140, 190, 240]);
        ratio = 0.70;
        type = 'Cura / Dano Sagrado';
      } else if (slot === 'W') {
        base = getRankBase([75, 115, 155, 195]);
        ratio = 0.65;
        type = 'Cura / Dano Sagrado';
      } else if (slot === 'E') {
        base = getRankBase([80, 130, 180, 230]);
        ratio = 0.60;
        type = 'Escudo Sagrado';
      } else if (slot === 'R') {
        base = getRankBase([200, 350, 500]);
        ratio = 1.25;
        type = 'Cura Total';
      }
    } else {
      // Generic fallback
      base = ability.damage || ability.baseDamage || 60;
      if (ability.apRatio) {
        ratio = ability.apRatio;
        stat = 'AP';
        type = 'Dano Mágico';
      } else {
        ratio = ability.adRatio || 0.60;
        stat = 'AD';
        type = 'Dano Físico';
      }
    }

    const statVal = stat === 'AP' ? ap : (stat === 'Armadura' ? armor : ad);
    const bonus = Math.round(statVal * ratio);
    const total = base + bonus;
    const bonusSign = bonus >= 0 ? '+' : '';
    const scalingText = `${bonusSign}${bonus} [${Math.round(ratio * 100)}% ${stat}] ${type}`;
    const summaryText = `${total} (${base} ${bonusSign}${bonus} [${Math.round(ratio * 100)}% ${stat}] ${type})`;

    return { base, bonus, total, ratio, stat, type, scalingText, summary: summaryText, summaryText };
  }

  /**
   * Formats item statistics into clean badge descriptors.
   * @param {Object} item 
   * @returns {Array<Object>}
   */
  formatItemStats(item) {
    if (!item || !item.stats) return [];
    const chips = [];

    for (const [key, val] of Object.entries(item.stats)) {
      if (typeof val !== 'number' || Number.isNaN(val) || val === 0) continue;
      const meta = STAT_META[key] || { label: key, icon: '⭐', suffix: '', isPercent: false };
      const displayVal = meta.isPercent ? `${Math.round(val * 100)}%` : `${val > 0 ? '+' : ''}${val}`;
      chips.push({
        key,
        icon: meta.icon,
        label: meta.label,
        value: displayVal,
        chipText: `${meta.icon} ${displayVal} ${meta.label}`
      });
    }

    return chips;
  }

  /**
   * Displays rich ability tooltip anchored to targetEl.
   * Supports flexible argument orders: (ability, hero, targetEl) or (targetEl, ability, hero).
   * @param {Object} ability 
   * @param {Object} [hero=null] 
   * @param {HTMLElement} [targetEl=null] 
   */
  showAbilityTooltip(ability, hero = null, targetEl = null) {
    if (typeof document === 'undefined') return;

    // Resolve flexible arguments
    let ab = ability;
    let h = hero;
    let el = targetEl;

    if (ability && (ability.nodeType || ability.getBoundingClientRect || ability.classList)) {
      el = ability;
      ab = hero;
      h = targetEl;
    }

    if (!ab) return;
    this.init();
    if (!this.element) return;

    const scaling = this.formatAbilityScaling(ab, h);
    const manaCost = ab.manaCost ?? 0;
    const cooldown = ab.cooldown ?? 0;
    const cooldownRemaining = Number(ab.cooldownRemaining || 0);
    const range = ab.range ?? 0;
    const radius = ab.radius;

    const cdRemainingHtml = cooldownRemaining > 0
      ? ` <span class="cooldown-active-tag">(${cooldownRemaining.toFixed(1)}s)</span>`
      : '';

    this.element.innerHTML = `
      <div class="tooltip-header">
        <span class="tooltip-icon">${ab.icon || '✨'}</span>
        <div class="tooltip-title-box">
          <div class="tooltip-title">${ab.name || 'Habilidade'}</div>
          <div class="tooltip-subtitle">${ab.id ? `Slot [${ab.id}]` : 'Habilidade'} • Rank ${ab.rank || 1}</div>
        </div>
      </div>
      <div class="tooltip-badges">
        <span class="badge badge-mana">💧 ${manaCost} Mana</span>
        <span class="badge badge-cooldown">⏱️ ${cooldown}s Recarga${cdRemainingHtml}</span>
        ${range > 0 ? `<span class="badge badge-range">🎯 ${range} Alcance${radius ? ` • Raio: ${radius}` : ''}</span>` : ''}
      </div>
      ${scaling.base > 0 || scaling.bonus > 0 ? `
        <div class="tooltip-damage-box">
          <span class="damage-total-value">${scaling.total}</span>
          <span class="damage-formula-text">(${scaling.base} <span class="damage-scaling-highlight">${scaling.scalingText}</span>)</span>
        </div>
      ` : ''}
      <div class="tooltip-description">${ab.description || 'Nenhuma descrição disponível.'}</div>
    `;

    this.updatePosition(el);
  }

  /**
   * Displays rich item tooltip anchored to targetEl.
   * Supports flexible argument orders: (item, targetEl) or (targetEl, item).
   * @param {Object} item 
   * @param {HTMLElement} [targetEl=null] 
   */
  showItemTooltip(item, targetEl = null) {
    if (typeof document === 'undefined') return;

    let it = item;
    let el = targetEl;

    if (item && (item.nodeType || item.getBoundingClientRect || item.classList)) {
      el = item;
      it = targetEl;
    }

    if (!it) return;
    this.init();
    if (!this.element) return;

    const cost = it.cost || 0;
    const refund = getSellRefund(cost);
    const tier = it.tier || 1;
    const tierLabel = tier === 1 ? 'Básico' : (tier === 2 ? 'Intermediário' : 'Lendário');
    const statChips = this.formatItemStats(it);

    this.element.innerHTML = `
      <div class="tooltip-header">
        <span class="tooltip-icon">${it.icon || '📦'}</span>
        <div class="tooltip-title-box">
          <div class="tooltip-title">${it.name || 'Item'}</div>
          <div class="tooltip-subtitle tier-tag tier-${tier}">Tier ${tier} • ${tierLabel}</div>
        </div>
      </div>
      <div class="tooltip-badges">
        <span class="badge badge-gold-buy">💰 Compra: ${cost}</span>
        <span class="badge badge-gold-sell">💰 Venda: ${refund} (70%)</span>
      </div>
      ${statChips.length > 0 ? `
        <div class="tooltip-stats-grid">
          ${statChips.map(c => `<span class="stat-badge">${c.chipText}</span>`).join('')}
        </div>
      ` : ''}
      <div class="tooltip-description">${it.description || 'Nenhuma descrição disponível.'}</div>
    `;

    this.updatePosition(el);
  }

  /**
   * Clamps and anchors tooltip adjacent to target element without overflowing screen edges.
   * @param {HTMLElement} targetEl 
   */
  updatePosition(targetEl) {
    if (typeof document === 'undefined' || !this.element || !targetEl) return;

    const rect = typeof targetEl.getBoundingClientRect === 'function'
      ? targetEl.getBoundingClientRect()
      : { left: 100, top: 100, width: 44, height: 44, right: 144, bottom: 144 };

    const winWidth = (typeof window !== 'undefined' ? window.innerWidth : 1280) || 1280;
    const winHeight = (typeof window !== 'undefined' ? window.innerHeight : 720) || 720;

    this.element.classList.remove('hidden');
    this.element.setAttribute('aria-hidden', 'false');

    const tipWidth = this.element.offsetWidth || 280;
    const tipHeight = this.element.offsetHeight || 140;

    // Center horizontally above element
    let left = rect.left + (rect.width / 2) - (tipWidth / 2);
    let top = rect.top - tipHeight - 12;

    // Flip to below element if overflowing top
    if (top < 12) {
      top = rect.bottom + 12;
    }

    // Boundary clamping
    left = Math.max(12, Math.min(winWidth - tipWidth - 12, left));
    top = Math.max(12, Math.min(winHeight - tipHeight - 12, top));

    this.element.style.left = `${Math.round(left)}px`;
    this.element.style.top = `${Math.round(top)}px`;
  }

  /**
   * Hides the active tooltip.
   */
  hide() {
    if (typeof document === 'undefined') return;
    if (this.element) {
      this.element.classList.add('hidden');
      this.element.setAttribute('aria-hidden', 'true');
    }
  }
}
