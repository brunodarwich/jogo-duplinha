/**
 * Initial Loading & Splash Screen Controller (`LoadingScreen`).
 * Displays the 5-Hero Key Art (`assets/ui/splash_heroes.png`), animated hero showcase,
 * tactical gameplay tips carousel, real-time asset preloading progress bar,
 * and transitions smoothly into the Hero & Mode Selection Screen (`LobbyUI`).
 */

import { HERO_DEFINITIONS } from '../entities/heroes.js';
import { preloadAllSpritesWithProgress, SPRITE_PATHS } from '../render/sprite_loader.js';

const LOADING_TIPS = [
  '💡 Dica Tática: As torres causam dano crescente a cada disparo consecutivo. Avance junto com seus lacaios!',
  '🔥 Dica de Chefe: Na Onda 5 surge o Stone Colossus e na Onda 10 o Abyssal Behemoth com recompensas de ouro para toda a equipe!',
  '🛒 Dica de Economia: Pressione [P] ou clique no seu Ouro quando estiver na Fonte Aliada para comprar itens de até Tier 3.',
  '🌀 Dica de Sobrevivência: Pressione [B] para canalizar o Recall por 5 segundos e voltar à base recuperando Vida e Mana.',
  '🤝 Dica Cooperativa: Combine diferentes papéis! Um Cavaleiro Guardião ou Clérigo da Luz protege os causadores de dano na linha de frente.'
];

const ASSET_LABELS = {
  hero_knight: 'Cavaleiro Guardião (Herói)',
  hero_sorceress: 'Feiticeira Elemental (Herói)',
  hero_ranger: 'Patrulheiro Arqueiro (Herói)',
  hero_assassin: 'Sombra Assassina (Herói)',
  hero_cleric: 'Clérigo da Luz (Herói)',
  minion_melee_allied: 'Guerreiro Aliado (Lacaio)',
  minion_ranged_allied: 'Mago Aliado (Lacaio)',
  minion_cannon_allied: 'Canhoneiro Aliado (Cerco)',
  minion_melee_enemy: 'Guerreiro Inimigo (Horda)',
  minion_ranged_enemy: 'Mago Inimigo (Horda)',
  minion_cannon_enemy: 'Canhoneiro Inimigo (Cerco)',
  boss_colossus: 'Colosso de Pedra (Mini-Boss Onda 5)',
  boss_behemoth: 'Behemoth Abissal (Mini-Boss Onda 10)',
  boss_supreme: 'Guardião Supremo do Nexus (Boss Final)',
  tower_allied: 'Torre de Cristal Aliada 3D',
  tower_enemy: 'Torre Negra Inimiga 3D',
  nexus_allied: 'Cristal do Nexus Aliado 3D',
  nexus_enemy: 'Cristal do Nexus Inimigo 3D',
  ui_splash_heroes: 'Ilustração Oficial dos 5 Heróis'
};

export class LoadingScreen {
  /**
   * @param {{ onComplete?: () => void, autoStartOnInvite?: boolean }} [options]
   */
  constructor(options = {}) {
    this.onComplete = typeof options === 'function' ? options : (options.onComplete || null);
    this.autoStartOnInvite = options.autoStartOnInvite ?? true;
    this.container = null;
    this.tipIntervalId = null;
    this.currentTipIndex = 0;
    this.isReady = false;
    this.isClosed = false;
    this._keyHandler = null;

    if (typeof document !== 'undefined' && document.body) {
      this.render();
      this.startLoadingSequence();
    }
  }

  render() {
    const existing = document.getElementById('loading-screen-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'loading-screen-overlay';
    overlay.className = 'loading-screen-overlay';

    const heroesList = Object.values(HERO_DEFINITIONS);
    const heroesLineupHtml = heroesList.map(h => `
      <div class="splash-hero-pill" style="--hero-color: ${h.color}; --hero-accent: ${h.accentColor};" title="${h.name} — ${h.role}">
        <div class="splash-hero-avatar">
          <img src="${h.sprite}" alt="${h.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
          <span class="splash-hero-fallback" style="display:none;">${h.icon}</span>
        </div>
        <div class="splash-hero-meta">
          <span class="splash-hero-name">${h.name}</span>
          <span class="splash-hero-role">${h.role}</span>
        </div>
      </div>
    `).join('');

    overlay.innerHTML = `
      <div class="loading-ambient-glow"></div>
      <div class="loading-card">
        <!-- Top Title Badge -->
        <header class="loading-header">
          <div class="loading-edition-pill">⚔️ ARENA COOPERATIVA ISOMÉTRICA 2.5D • 1 A 3 JOGADORES</div>
          <h1 class="loading-game-title">MOBA DUPLINHA</h1>
          <p class="loading-game-subtitle">5 Heróis Lendários • Hordas, Torres de Cristal, Mini-Bosses e Guardião do Nexus</p>
        </header>

        <!-- Key Art Illustration Showcase with the 5 Heroes -->
        <div class="loading-artwork-frame">
          <img
            id="loading-splash-img"
            src="${SPRITE_PATHS.ui_splash_heroes}"
            alt="Os 5 Heróis de MOBA Duplinha 2.5D"
            class="loading-splash-img"
          >
          <div class="loading-artwork-vignette"></div>

          <!-- Floating 5-Hero Roster Strip at bottom of Key Art -->
          <div class="splash-heroes-strip">
            ${heroesLineupHtml}
          </div>
        </div>

        <!-- Progress & Action Section -->
        <div class="loading-footer-panel">
          <div id="loading-progress-Area" class="loading-progress-area">
            <div class="loading-status-row">
              <span id="loading-asset-label" class="loading-asset-label">⏳ Preparando recursos da arena...</span>
              <span id="loading-percent-text" class="loading-percent-text">0%</span>
            </div>
            <div class="loading-bar-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="loading-bar-track">
              <div id="loading-bar-fill" class="loading-bar-fill" style="width: 0%;"></div>
              <div class="loading-bar-shimmer"></div>
            </div>
          </div>

          <div class="loading-tip-box">
            <span id="loading-tip-text" class="loading-tip-text">${LOADING_TIPS[0]}</span>
          </div>

          <div class="loading-actions-row">
            <button id="loading-enter-btn" class="loading-enter-btn" disabled>
              ⏳ CARREGANDO PERSONAGENS...
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.container = overlay;

    // Start rotating gameplay tips
    this.tipIntervalId = setInterval(() => {
      this.currentTipIndex = (this.currentTipIndex + 1) % LOADING_TIPS.length;
      const tipEl = document.getElementById('loading-tip-text');
      if (tipEl) {
        tipEl.style.opacity = '0';
        setTimeout(() => {
          if (tipEl) {
            tipEl.textContent = LOADING_TIPS[this.currentTipIndex];
            tipEl.style.opacity = '1';
          }
        }, 200);
      }
    }, 4200);

    const enterBtn = document.getElementById('loading-enter-btn');
    if (enterBtn) {
      enterBtn.addEventListener('click', () => {
        if (this.isReady) {
          this.proceedToSelection();
        }
      });
    }

    this._keyHandler = (e) => {
      if (!this.isReady || this.isClosed) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.proceedToSelection();
      }
    };
    window.addEventListener('keydown', this._keyHandler);
  }

  async startLoadingSequence() {
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const minDisplayMs = 850; // Smooth visual progression even when cached locally

    let latestStatus = { loaded: 0, total: Object.keys(SPRITE_PATHS).length, percent: 0, key: '' };

    await preloadAllSpritesWithProgress((status) => {
      latestStatus = status;
      const displayPercent = Math.min(95, status.percent);
      this.updateProgressUI(displayPercent, status.key, status.loaded, status.total);
    });

    const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime;
    if (elapsed < minDisplayMs) {
      await new Promise(r => setTimeout(r, minDisplayMs - elapsed));
    }

    this.updateProgressUI(100, 'complete', latestStatus.total, latestStatus.total);
    this.markReady();
  }

  updateProgressUI(percent, key, loaded, total) {
    const fillEl = document.getElementById('loading-bar-fill');
    const trackEl = document.getElementById('loading-bar-track');
    const percentEl = document.getElementById('loading-percent-text');
    const labelEl = document.getElementById('loading-asset-label');

    if (fillEl) fillEl.style.width = `${percent}%`;
    if (trackEl) trackEl.setAttribute('aria-valuenow', String(percent));
    if (percentEl) percentEl.textContent = `${percent}%`;

    if (labelEl) {
      if (percent >= 100 || key === 'complete') {
        labelEl.textContent = `✅ Todos os ${total} recursos e personagens prontos para a batalha!`;
      } else {
        const friendlyName = ASSET_LABELS[key] || key || 'Recursos gráficos';
        labelEl.textContent = `⏳ Carregando (${loaded}/${total}): ${friendlyName}...`;
      }
    }
  }

  markReady() {
    this.isReady = true;
    const enterBtn = document.getElementById('loading-enter-btn');
    if (enterBtn) {
      enterBtn.disabled = false;
      enterBtn.classList.add('ready');
      enterBtn.innerHTML = '⚔️ SELECIONAR HERÓI E JOGAR';
    }

    // If the player opened a direct multiplayer room invite link (?room=XYZ),
    // automatically transition after a brief moment so they join smoothly.
    if (this.autoStartOnInvite && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('room')) {
        setTimeout(() => {
          if (!this.isClosed) this.proceedToSelection();
        }, 450);
      }
    }
  }

  proceedToSelection() {
    if (this.isClosed) return;
    this.isClosed = true;

    if (this.tipIntervalId) {
      clearInterval(this.tipIntervalId);
      this.tipIntervalId = null;
    }
    if (this._keyHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }

    if (this.container) {
      this.container.classList.add('fade-out');
      setTimeout(() => {
        this.container?.remove();
      }, 320);
    }

    if (typeof this.onComplete === 'function') {
      this.onComplete();
    }
  }
}
