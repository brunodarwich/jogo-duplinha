/**
 * Initial Loading & Splash Screen Controller (`LoadingScreen`).
 * Displays promotional key art with the five heroes and crystal towers,
 * tactical gameplay tips carousel, real-time asset preloading progress bar,
 * and transitions smoothly into the Hero & Mode Selection Screen (`LobbyUI`).
 */

import { preloadAllSpritesWithProgress, SPRITE_PATHS } from '../render/sprite_loader.js';

const ARTWORK_FALLBACK = 'assets/ui/splash_heroes.png';

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
  tower_allied: 'Torre de Cristal Aliada',
  tower_enemy: 'Torre de Cristal Inimiga',
  nexus_allied: 'Nexus Aliado',
  nexus_enemy: 'Nexus Inimigo',
  ui_splash_heroes: 'Arte dos Heróis e Torres'
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
    this.timeouts = new Set();
    this.inertSiblings = [];
    this.preloadSprites = preloadAllSpritesWithProgress;
    this.minDisplayMs = 850;
    this.artworkReady = Promise.resolve(false);
    this.cancelArtwork = null;

    if (typeof document !== 'undefined' && document.body) {
      this.render();
      this.artworkReady = this.loadArtwork(this.container.querySelector('#loading-splash-img'));
      this.readyPromise = this.startLoadingSequence();
    }
  }

  render() {
    const existing = document.getElementById('loading-screen-overlay');
    if (existing?.loadingController) existing.loadingController.destroy();
    else existing?.remove();

    const overlay = document.createElement('section');
    overlay.id = 'loading-screen-overlay';
    overlay.className = 'loading-screen-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'loading-game-title');
    overlay.loadingController = this;
    overlay.innerHTML = `
      <div class="loading-ambient-glow" aria-hidden="true"></div>
      <div class="loading-card">
        <header class="loading-header">
          <div class="loading-edition-pill"><span aria-hidden="true">◆</span> COOPERATIVO · 1 A 3 JOGADORES</div>
          <h1 id="loading-game-title" class="loading-game-title"><span>MOBA</span> DUPLINHA</h1>
          <p class="loading-game-subtitle">Reúna sua equipe. Defenda sua base. Conquiste a arena.</p>
        </header>

        <figure class="loading-artwork-frame">
          <div class="loading-artwork-media">
            <img id="loading-splash-img" src="${SPRITE_PATHS.ui_splash_heroes}"
              alt="Cavaleiro, Feiticeira, Patrulheiro, Assassina e Clérigo diante das torres de cristal azul e rubi."
              class="loading-splash-img" fetchpriority="high" decoding="async">
          </div>
          <figcaption class="loading-artwork-caption">
            <strong>CINCO HERÓIS. UMA EQUIPE.</strong>
            <span>Torres de cristal · Hordas · Guardião do Nexus</span>
          </figcaption>
        </figure>

        <div class="loading-footer-panel">
          <div class="loading-preparation">
            <div id="loading-progress-Area" class="loading-progress-area">
              <div class="loading-status-row">
                <span id="loading-asset-label" class="loading-asset-label">Preparando a arena...</span>
                <span id="loading-percent-text" class="loading-percent-text">0%</span>
              </div>
              <div class="loading-bar-track" role="progressbar" aria-label="Carregamento do jogo"
                aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="loading-bar-track">
                <div id="loading-bar-fill" class="loading-bar-fill" style="width: 0%;"></div>
              </div>
            </div>
            <div class="loading-tip-box"><span id="loading-tip-text" class="loading-tip-text">${LOADING_TIPS[0]}</span></div>
          </div>
          <div class="loading-actions-row">
            <button id="loading-enter-btn" class="loading-enter-btn" disabled>PREPARANDO A BATALHA...</button>
            <small class="loading-keyboard-hint">Enter ou Espaço para continuar</small>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    this.container = overlay;
    for (const sibling of document.body.children) {
      if (sibling === overlay) continue;
      this.inertSiblings.push([sibling, sibling.inert]);
      sibling.inert = true;
    }

    // Start rotating gameplay tips
    this.tipIntervalId = setInterval(() => {
      this.currentTipIndex = (this.currentTipIndex + 1) % LOADING_TIPS.length;
      const tipEl = this.container?.querySelector('#loading-tip-text');
      if (tipEl) {
        tipEl.style.opacity = '0';
        this.schedule(() => {
          if (tipEl) {
            tipEl.textContent = LOADING_TIPS[this.currentTipIndex];
            tipEl.style.opacity = '1';
          }
        }, 200);
      }
    }, 4200);

    const enterBtn = this.container?.querySelector('#loading-enter-btn');
    if (enterBtn) {
      enterBtn.addEventListener('click', () => {
        if (this.isReady) {
          this.proceedToSelection();
        }
      });
    }

    this._keyHandler = e => this.handleKeyDown(e);
    window.addEventListener('keydown', this._keyHandler);
  }

  handleKeyDown(e) {
    if (!this.isReady || this.isClosed || e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
    const tag = e.target?.tagName?.toLowerCase();
    if (['button', 'input', 'textarea', 'select', 'a'].includes(tag) || e.target?.isContentEditable) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.proceedToSelection();
    }
  }

  schedule(callback, delay) {
    const id = setTimeout(() => {
      this.timeouts.delete(id);
      if (!this.isClosed) callback();
    }, delay);
    this.timeouts.add(id);
    return id;
  }

  loadArtwork(image, { timeoutMs = 8000 } = {}) {
    if (!image) return Promise.resolve(false);
    return new Promise(resolve => {
      let done = false;
      let fallback = false;
      const finish = success => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        image.removeEventListener('load', loaded);
        image.removeEventListener('error', failed);
        image.dataset.artworkState = success ? (fallback ? 'fallback' : 'ready') : 'unavailable';
        this.cancelArtwork = null;
        resolve(success);
      };
      const loaded = async () => {
        try { if (image.decode) await image.decode(); } catch { /* A loaded image may still be drawable if decode is unavailable. */ }
        finish(image.naturalWidth > 0);
      };
      const failed = () => {
        if (done) return;
        if (!fallback) {
          fallback = true;
          image.src = ARTWORK_FALLBACK;
          if (image.complete && image.naturalWidth > 0) loaded();
        } else finish(false);
      };
      const timer = setTimeout(() => {
        if (!fallback) image.src = ARTWORK_FALLBACK;
        finish(false);
      }, timeoutMs);
      this.cancelArtwork = () => finish(false);
      image.addEventListener('load', loaded);
      image.addEventListener('error', failed);
      if (image.complete) {
        if (image.naturalWidth > 0) loaded();
        else failed();
      }
    });
  }

  async startLoadingSequence() {
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    let latestStatus = { loaded: 0, total: Object.keys(SPRITE_PATHS).length, percent: 0, key: '' };
    const sprites = this.preloadSprites(status => {
      if (this.isClosed) return;
      latestStatus = status;
      this.updateProgressUI(Math.min(95, status.percent), status.key, status.loaded, status.total);
    });
    await Promise.all([sprites, this.artworkReady]);
    if (this.isClosed) return;
    const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime;
    if (elapsed < this.minDisplayMs) await new Promise(resolve => setTimeout(resolve, this.minDisplayMs - elapsed));
    if (this.isClosed) return;
    this.updateProgressUI(100, 'complete', latestStatus.total, latestStatus.total);
    this.markReady();
  }

  updateProgressUI(percent, key, loaded, total) {
    const fillEl = this.container?.querySelector('#loading-bar-fill');
    const trackEl = this.container?.querySelector('#loading-bar-track');
    const percentEl = this.container?.querySelector('#loading-percent-text');
    const labelEl = this.container?.querySelector('#loading-asset-label');

    if (fillEl) fillEl.style.width = `${percent}%`;
    if (trackEl) trackEl.setAttribute('aria-valuenow', String(percent));
    if (percentEl) percentEl.textContent = `${percent}%`;

    if (labelEl) {
      if (percent >= 100) {
        labelEl.textContent = 'Arena pronta para a batalha';
      } else if (key === 'complete' || key === 'done') {
        labelEl.textContent = 'Finalizando a arte da arena...';
      } else {
        const friendlyName = ASSET_LABELS[key] || key || 'Recursos gráficos';
        labelEl.textContent = `Carregando (${loaded}/${total}): ${friendlyName}...`;
      }
    }
  }

  markReady() {
    if (this.isClosed) return;
    this.isReady = true;
    const enterBtn = this.container?.querySelector('#loading-enter-btn');
    if (enterBtn) {
      enterBtn.disabled = false;
      enterBtn.classList.add('ready');
      enterBtn.textContent = '⚔️ SELECIONAR HERÓI E JOGAR';
      enterBtn.focus({ preventScroll: true });
    }

    // If the player opened a direct multiplayer room invite link (?room=XYZ),
    // automatically transition after a brief moment so they join smoothly.
    if (this.autoStartOnInvite && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('room')) {
        this.schedule(() => {
          this.proceedToSelection();
        }, 450);
      }
    }
  }

  destroy(remove = true) {
    this.isClosed = true;
    if (this.tipIntervalId) clearInterval(this.tipIntervalId);
    this.tipIntervalId = null;
    for (const id of this.timeouts) clearTimeout(id);
    this.timeouts.clear();
    this.cancelArtwork?.();
    if (this._keyHandler && typeof window !== 'undefined') window.removeEventListener('keydown', this._keyHandler);
    this._keyHandler = null;
    for (const [sibling, wasInert] of this.inertSiblings) sibling.inert = wasInert;
    this.inertSiblings = [];
    if (remove) this.container?.remove();
  }

  proceedToSelection() {
    if (this.isClosed || !this.isReady) return false;
    this.destroy(false);
    const overlay = this.container;
    if (overlay) {
      overlay.classList.add('fade-out');
      setTimeout(() => overlay.remove(), 320);
    }
    if (typeof this.onComplete === 'function') this.onComplete();
    return true;
  }
}
