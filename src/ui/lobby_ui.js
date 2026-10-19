/**
 * Lobby & 5-Hero Selection UI Controller with Pre-Game Waiting Room.
 * Supports choosing among Knight, Sorceress, Ranger, Assassin, Cleric,
 * selecting Solo Offline or Multiplayer (1-3 Players via WebRTC P2P),
 * waiting room roster exchange, and synchronized match start.
 */

import { HERO_DEFINITIONS, getHeroKit } from '../entities/heroes.js';
import { generateRoomCode } from '../net/protocol.js';
import { PeerNetwork } from '../net/peer_network.js';
import { preloadAllSprites } from '../render/sprite_loader.js';

export class LobbyUI {
  constructor(optionsOrCb, maybeNet = null) {
    let onStartGame = null;
    let network = null;

    if (typeof optionsOrCb === 'function') {
      onStartGame = optionsOrCb;
      network = maybeNet;
    } else if (optionsOrCb && typeof optionsOrCb === 'object') {
      onStartGame = optionsOrCb.onStartGame;
      network = optionsOrCb.network;
    }

    this.onStartGame = onStartGame;
    this.onBackToSplash = (optionsOrCb && typeof optionsOrCb === 'object') ? optionsOrCb.onBackToSplash : null;
    this.network = network || new PeerNetwork();
    this.selectedHeroId = 'knight';
    this.roomCode = generateRoomCode();
    this.isClientConnected = false;

    // Check if entered via direct room invite link (?room=XYZ)
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const roomParam = urlParams ? urlParams.get('room') : null;
    if (roomParam) {
      this.selectedMode = 'join';
      this.prefillRoomCode = roomParam.trim().toUpperCase();
      this.roomCode = this.prefillRoomCode;
    } else {
      this.selectedMode = 'solo'; // 'solo' | 'host' | 'join'
      this.prefillRoomCode = '';
    }

    this.container = null;

    // Hook network callbacks
    this.network.onRosterChangeCallback = (roster) => this.updateRosterUI(roster);
    this.network.onMatchStartCallback = (roster) => this.onMatchStartedByHost(roster);

    preloadAllSprites();
    this.render();

    // If loaded via invite link, switch immediately to join view
    if (this.selectedMode === 'join' && this.prefillRoomCode) {
      this.updateModeUI('join');
    }
  }

  render() {
    const existing = document.getElementById('lobby-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'lobby-overlay';
    overlay.className = 'lobby-overlay';

    overlay.innerHTML = `
      <div class="lobby-card">
        <header class="lobby-header">
          <div class="lobby-header-banner">
            <img src="assets/ui/splash_heroes.png" alt="Banner MOBA Duplinha" class="lobby-banner-img">
            <div class="lobby-banner-overlay">
              <button type="button" id="back-to-splash-btn" class="back-to-splash-btn" title="Voltar para a Tela Inicial">
                🏠 Tela Inicial
              </button>
              <div class="lobby-title-group">
                <span class="lobby-step-pill">TELA DE SELEÇÃO DE CAMPEÕES</span>
                <h1 class="game-logo">⚔️ MOBA DUPLINHA 2.5D</h1>
                <p class="game-subtitle">Cooperativo Isométrico: 1 a 3 Jogadores • Hordas, Torres, Mini-Bosses e Base Final</p>
              </div>
            </div>
          </div>
        </header>

        <!-- Section 1: Hero Selection (5 Heroes) -->
        <section class="hero-selection-section">
          <h2 class="section-title">1. Escolha seu Herói</h2>
          <div class="hero-cards-grid" id="hero-cards-grid"></div>

          <!-- Hero Details Preview -->
          <div class="selected-hero-preview" id="hero-preview"></div>
        </section>

        <!-- Section 2: Game Mode Selection (Solo or Multiplayer P2P) -->
        <section class="mode-selection-section">
          <h2 class="section-title">2. Escolha o Modo de Jogo</h2>
          <div class="mode-buttons-row">
            <button class="mode-btn ${this.selectedMode === 'solo' ? 'active' : ''}" data-mode="solo">
              <span class="mode-icon">👤</span>
              <div class="mode-info">
                <strong>Jogar Solo (Offline)</strong>
                <small>Partida individual instantânea</small>
              </div>
            </button>
            <button class="mode-btn ${this.selectedMode === 'host' ? 'active' : ''}" data-mode="host">
              <span class="mode-icon">🌐</span>
              <div class="mode-info">
                <strong>Criar Sala Multiplayer</strong>
                <small>Jogue com até 2 amigos (P2P)</small>
              </div>
            </button>
            <button class="mode-btn ${this.selectedMode === 'join' ? 'active' : ''}" data-mode="join">
              <span class="mode-icon">🔗</span>
              <div class="mode-info">
                <strong>Entrar em Sala</strong>
                <small>Digite o código de um amigo</small>
              </div>
            </button>
          </div>

          <!-- Multiplayer Room Inputs -->
          <div id="multiplayer-panel" class="multiplayer-panel ${this.selectedMode === 'solo' ? 'hidden' : ''}">
            <!-- Host View -->
            <div id="host-panel-view" class="mp-view ${this.selectedMode === 'host' ? '' : 'hidden'}">
              <p>Código da sua sala para compartilhar:</p>
              <div class="room-code-badge" id="host-room-code">${this.roomCode}</div>
              <div class="invite-actions-row">
                <button type="button" id="copy-invite-link-btn" class="invite-action-btn">
                  📋 Copiar Link de Convite
                </button>
                <button type="button" id="share-whatsapp-btn" class="invite-action-btn whatsapp">
                  💬 Compartilhar (WhatsApp)
                </button>
              </div>
              <div id="copy-feedback" class="copy-feedback hidden">✅ Link copiado! Envie para seu amigo.</div>
              <div class="qr-code-wrapper">
                <img id="qr-code-img" src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent((typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '') + '?room=' + this.roomCode)}" alt="QR Code da Sala" class="qr-code-img" loading="lazy">
                <span class="qr-hint">📱 Aponte a câmera do celular para entrar direto</span>
              </div>

              <!-- Host Waiting Room Roster -->
              <div class="roster-container">
                <div class="roster-header">👥 Jogadores na Sala (<span id="roster-count">1</span>/2):</div>
                <div id="roster-list" class="roster-list"></div>
              </div>
            </div>

            <!-- Join View -->
            <div id="join-panel-view" class="mp-view ${this.selectedMode === 'join' ? '' : 'hidden'}">
              <p>Digite o código da sala do seu amigo:</p>
              <div style="display:flex; justify-content:center; gap: 10px; align-items:center;">
                <input type="text" id="join-code-input" class="room-input" placeholder="Ex: SALA77" maxlength="8" value="${this.prefillRoomCode || ''}">
                <button type="button" id="join-room-btn" class="join-room-btn">🔗 Conectar à Sala</button>
              </div>
              ${this.prefillRoomCode ? '<small class="prefill-notice" style="display:block; margin-top:6px; color:#38bdf8;">✨ Código preenchido via link de convite!</small>' : ''}
              
              <div id="join-status" class="join-status-box hidden"></div>

              <!-- Client Waiting Room Roster -->
              <div class="roster-container" id="join-roster-container" style="display: none;">
                <div class="roster-header">👥 Jogadores na Sala (<span id="join-roster-count">2</span>/2):</div>
                <div id="join-roster-list" class="roster-list"></div>
              </div>
            </div>
          </div>
        </section>

        <!-- Start Button -->
        <footer class="lobby-footer">
          <button id="start-game-btn" class="start-game-btn">
            ⚔️ ENTRAR NO CAMPO DE BATALHA
          </button>
        </footer>
      </div>
    `;

    document.body.appendChild(overlay);
    this.container = overlay;

    this.renderHeroCards();
    this.updateHeroPreview();
    this.bindEvents();
    this.updateRosterUI(this.network.roster);
  }

  renderHeroCards() {
    const grid = document.getElementById('hero-cards-grid');
    if (!grid) return;
    grid.innerHTML = '';

    for (const hero of Object.values(HERO_DEFINITIONS)) {
      const card = document.createElement('div');
      card.className = `hero-select-card ${hero.id === this.selectedHeroId ? 'active' : ''}`;
      card.dataset.heroId = hero.id;
      card.style.setProperty('--card-hero-color', hero.color);
      card.style.setProperty('--card-hero-accent', hero.accentColor);

      const iconHtml = hero.sprite
        ? `<img src="${hero.sprite}" alt="${hero.name}" class="hero-chibi-img">`
        : hero.icon;

      card.innerHTML = `
        <span class="hero-card-selected-badge">✓ SELECIONADO</span>
        <div class="hero-select-icon" style="background: ${hero.color}22; border-color: ${hero.color};">${iconHtml}</div>
        <div class="hero-select-name">${hero.name}</div>
        <div class="hero-select-role" style="color: ${hero.accentColor};">${hero.role}</div>
      `;

      card.addEventListener('click', () => {
        grid.querySelectorAll('.hero-select-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.selectedHeroId = hero.id;
        this.updateHeroPreview();

        // Broadcast hero update to lobby peers
        if (this.selectedMode === 'host') {
          this.network.updateHostHero(hero.id, hero.name);
          this.updateRosterUI(this.network.roster);
        } else if (this.selectedMode === 'join') {
          if (this.isClientConnected) {
            this.network.sendHeroSelect(hero.id, hero.name);
            this.updateRosterUI(this.network.roster);
          } else if (this.prefillRoomCode) {
            this.connectToHost(this.prefillRoomCode);
          }
        }
      });

      grid.appendChild(card);
    }
  }

  updateHeroPreview() {
    const preview = document.getElementById('hero-preview');
    if (!preview) return;

    const hero = HERO_DEFINITIONS[this.selectedHeroId];
    const kit = getHeroKit(this.selectedHeroId);
    const previewVisual = hero.sprite
      ? `<img src="${hero.sprite}" alt="${hero.name}" class="preview-chibi-img">`
      : `<span class="preview-icon" style="color: ${hero.accentColor}">${hero.icon}</span>`;

    const hpPct = Math.min(100, Math.round((hero.base.hp / 700) * 100));
    const manaPct = Math.min(100, Math.round((hero.base.mana / 480) * 100));
    const adPct = Math.min(100, Math.round((hero.base.attackDamage / 65) * 100));
    const defPct = Math.min(100, Math.round(((hero.base.armor + hero.base.magicResist) / 75) * 100));
    const spdPct = Math.min(100, Math.round(((hero.base.movementSpeed - 280) / 75) * 100));

    preview.style.borderColor = `${hero.color}55`;

    preview.innerHTML = `
      <div class="preview-top-layout">
        <div class="preview-header">
          <div class="preview-avatar-pedestal" style="border-color: ${hero.color}; background: radial-gradient(circle, ${hero.color}33 0%, rgba(15,23,42,0.8) 75%);">
            ${previewVisual}
          </div>
          <div class="preview-bio">
            <div class="preview-title-row">
              <h3>${hero.name}</h3>
              <span class="role-badge-pill" style="background: ${hero.color}28; border-color: ${hero.accentColor}; color: ${hero.accentColor};">${hero.icon} ${hero.role}</span>
            </div>
            <p>${hero.description}</p>
            <div class="preview-stats-bar">
              <span>❤️ Vida: <strong>${hero.base.hp}</strong></span>
              <span>💧 Mana: <strong>${hero.base.mana}</strong></span>
              <span>⚔️ Dano: <strong>${hero.base.attackDamage}</strong></span>
              <span>🛡️ Armadura: <strong>${hero.base.armor}</strong></span>
              <span>🔮 MR: <strong>${hero.base.magicResist}</strong></span>
              <span>🎯 Alcance: <strong>${hero.base.attackRange}</strong></span>
              <span>👟 Velocidade: <strong>${hero.base.movementSpeed}</strong></span>
            </div>
          </div>
        </div>

        <div class="preview-bars-grid">
          <div class="attr-meter-row">
            <span class="attr-meter-label">Vitalidade</span>
            <div class="attr-meter-track"><div class="attr-meter-fill hp" style="width:${hpPct}%"></div></div>
          </div>
          <div class="attr-meter-row">
            <span class="attr-meter-label"> Energia Arcana</span>
            <div class="attr-meter-track"><div class="attr-meter-fill mana" style="width:${manaPct}%"></div></div>
          </div>
          <div class="attr-meter-row">
            <span class="attr-meter-label">Poder de Ataque</span>
            <div class="attr-meter-track"><div class="attr-meter-fill ad" style="width:${adPct}%"></div></div>
          </div>
          <div class="attr-meter-row">
            <span class="attr-meter-label">Resistência</span>
            <div class="attr-meter-track"><div class="attr-meter-fill def" style="width:${defPct}%"></div></div>
          </div>
          <div class="attr-meter-row">
            <span class="attr-meter-label">Mobilidade</span>
            <div class="attr-meter-track"><div class="attr-meter-fill spd" style="width:${spdPct}%"></div></div>
          </div>
        </div>
      </div>

      <div class="preview-abilities">
        <div class="ability-tag" title="${kit.Q.description}">
          <strong>[Q] ${kit.Q.icon} ${kit.Q.name}</strong>
          <small>${kit.Q.description}</small>
        </div>
        <div class="ability-tag" title="${kit.W.description}">
          <strong>[W] ${kit.W.icon} ${kit.W.name}</strong>
          <small>${kit.W.description}</small>
        </div>
        <div class="ability-tag" title="${kit.E.description}">
          <strong>[E] ${kit.E.icon} ${kit.E.name}</strong>
          <small>${kit.E.description}</small>
        </div>
        <div class="ability-tag ultimate" title="${kit.R.description}">
          <strong>[R] ${kit.R.icon} ${kit.R.name}</strong>
          <small>${kit.R.description}</small>
        </div>
      </div>
    `;
  }

  updateModeUI(mode) {
    this.selectedMode = mode;
    const modeBtns = this.container.querySelectorAll('.mode-btn');
    const mpPanel = document.getElementById('multiplayer-panel');
    const hostView = document.getElementById('host-panel-view');
    const joinView = document.getElementById('join-panel-view');
    const startBtn = document.getElementById('start-game-btn');

    modeBtns.forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });

    if (mode === 'solo') {
      mpPanel.classList.add('hidden');
      hostView.classList.add('hidden');
      joinView.classList.add('hidden');
      if (startBtn) {
        startBtn.innerHTML = '⚔️ ENTRAR NO CAMPO DE BATALHA (SOLO)';
        startBtn.disabled = false;
        startBtn.classList.remove('waiting', 'ready-multiplayer');
      }
    } else if (mode === 'host') {
      mpPanel.classList.remove('hidden');
      hostView.classList.remove('hidden');
      joinView.classList.add('hidden');
      this.initHostSession();
    } else if (mode === 'join') {
      mpPanel.classList.remove('hidden');
      hostView.classList.add('hidden');
      joinView.classList.remove('hidden');
      if (startBtn) {
        if (this.isClientConnected) {
          startBtn.innerHTML = '⏳ AGUARDANDO O HOST INICIAR A PARTIDA...';
          startBtn.disabled = true;
          startBtn.classList.add('waiting');
        } else {
          startBtn.innerHTML = '🔗 CONECTAR À SALA';
          startBtn.disabled = false;
          startBtn.classList.remove('waiting', 'ready-multiplayer');
        }
      }
    }
  }

  async initHostSession() {
    const heroDef = HERO_DEFINITIONS[this.selectedHeroId] || HERO_DEFINITIONS.knight;
    try {
      const activeCode = await this.network.hostRoom(this.roomCode, this.selectedHeroId, heroDef.name);
      if (activeCode && activeCode !== this.roomCode) {
        this.roomCode = activeCode;
        const codeBadge = document.getElementById('host-room-code');
        if (codeBadge) codeBadge.textContent = this.roomCode;
        const qrImg = document.getElementById('qr-code-img');
        if (qrImg && typeof window !== 'undefined') {
          const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${this.roomCode}`;
          qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(inviteUrl)}`;
        }
      }
      this.updateRosterUI(this.network.roster);
    } catch (err) {
      console.warn('[LobbyUI] Falha ao registrar Host:', err);
    }
  }

  async connectToHost(code) {
    const statusBox = document.getElementById('join-status');
    const joinBtn = document.getElementById('join-room-btn');
    const startBtn = document.getElementById('start-game-btn');
    const codeInput = document.getElementById('join-code-input');

    if (!code) {
      alert('Por favor, digite o código da sala!');
      return;
    }

    if (statusBox) {
      statusBox.className = 'join-status-box connecting';
      statusBox.innerHTML = `⏳ Conectando ao Host na sala <strong>${code}</strong>... Aguarde...`;
      statusBox.classList.remove('hidden');
    }
    if (joinBtn) joinBtn.disabled = true;

    try {
      const heroDef = HERO_DEFINITIONS[this.selectedHeroId] || HERO_DEFINITIONS.sorceress;
      await this.network.joinRoom(code, {
        heroId: this.selectedHeroId,
        name: heroDef.name
      });

      this.isClientConnected = true;
      if (codeInput) codeInput.disabled = true;
      if (joinBtn) {
        joinBtn.textContent = '✅ Conectado!';
        joinBtn.style.background = '#22c55e';
      }

      if (statusBox) {
        statusBox.className = 'join-status-box connected';
        statusBox.innerHTML = `✅ Conectado ao Host na sala <strong>${code}</strong>!<br>⏳ Aguardando o Host iniciar a partida...`;
      }

      const joinRosterContainer = document.getElementById('join-roster-container');
      if (joinRosterContainer) joinRosterContainer.style.display = 'block';

      this.updateRosterUI(this.network.roster);

      if (startBtn) {
        startBtn.innerHTML = '⏳ AGUARDANDO O HOST INICIAR A PARTIDA...';
        startBtn.disabled = true;
        startBtn.classList.add('waiting');
      }
    } catch (err) {
      this.isClientConnected = false;
      if (joinBtn) joinBtn.disabled = false;
      if (statusBox) {
        statusBox.className = 'join-status-box error';
        statusBox.innerHTML = `❌ ${err.message || 'Falha ao conectar com o Host.'}`;
      }
    }
  }

  updateRosterUI(roster) {
    const safeRoster = (roster && roster.length > 0)
      ? roster
      : [{ id: 'player_hero_1', heroId: this.selectedHeroId, name: HERO_DEFINITIONS[this.selectedHeroId]?.name || 'Você', isHost: true }];

    const hostRosterList = document.getElementById('roster-list');
    const joinRosterList = document.getElementById('join-roster-list');
    const rosterCount = document.getElementById('roster-count');
    const joinRosterCount = document.getElementById('join-roster-count');
    const startBtn = document.getElementById('start-game-btn');

    if (rosterCount) rosterCount.textContent = safeRoster.length;
    if (joinRosterCount) joinRosterCount.textContent = safeRoster.length;

    const buildRosterHTML = () => {
      let html = '';
      for (const p of safeRoster) {
        const hDef = HERO_DEFINITIONS[p.heroId] || HERO_DEFINITIONS.knight;
        const isMe = (this.selectedMode === 'host' && p.isHost) || (this.selectedMode === 'join' && !p.isHost);
        const badgeText = p.isHost ? '👑 HOST' : 'ALIADO';
        const badgeClass = p.isHost ? 'host' : 'ally';
        const statusText = isMe ? 'VOCÊ (PRONTO)' : (p.isHost ? 'HOST (PRONTO)' : 'CONECTADO');

        html += `
          <div class="roster-player-item ${p.isHost ? 'host' : 'ally'}">
            <span class="roster-badge ${badgeClass}">${badgeText}</span>
            <span class="roster-hero-icon" style="border-color: ${hDef.color};">${hDef.icon}</span>
            <div class="roster-player-info">
              <strong class="roster-player-name">${p.name || hDef.name} ${isMe ? '(Você)' : ''}</strong>
              <small class="roster-player-hero">${hDef.name} • ${hDef.role}</small>
            </div>
            <span class="roster-status connected">${statusText}</span>
          </div>
        `;
      }

      if (safeRoster.length < 2) {
        html += `
          <div class="roster-player-item waiting">
            <span class="roster-badge pending">ALIADO</span>
            <span class="roster-hero-icon">⏳</span>
            <div class="roster-player-info">
              <strong class="roster-player-name">Aguardando amigo entrar...</strong>
              <small class="roster-player-hero">Envie o código ou link acima</small>
            </div>
            <span class="roster-status pending">AGUARDANDO</span>
          </div>
        `;
      }
      return html;
    };

    const rosterHTML = buildRosterHTML();
    if (hostRosterList) hostRosterList.innerHTML = rosterHTML;
    if (joinRosterList) joinRosterList.innerHTML = rosterHTML;

    // Update Host Start Button
    if (startBtn && this.selectedMode === 'host') {
      if (safeRoster.length >= 2) {
        startBtn.innerHTML = `⚔️ INICIAR PARTIDA COOPERATIVA (${safeRoster.length}/2 JOGADORES) 🚀`;
        startBtn.classList.add('ready-multiplayer');
        startBtn.disabled = false;
      } else {
        startBtn.innerHTML = `⚔️ INICIAR PARTIDA (SOLO / AGUARDANDO AMIGO)`;
        startBtn.classList.remove('ready-multiplayer');
        startBtn.disabled = false;
      }
    }
  }

  onMatchStartedByHost(roster) {
    console.log('[LobbyUI] Host iniciou a partida! Entrando no campo de batalha...', roster);
    this.close();
    if (this.onStartGame) {
      this.onStartGame({
        heroId: this.selectedHeroId,
        mode: 'join',
        roomCode: this.network.roomCode || this.roomCode,
        roster: roster || this.network.roster,
        isHost: false,
        network: this.network
      });
    }
  }

  bindEvents() {
    const backBtn = document.getElementById('back-to-splash-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this.close();
        if (typeof this.onBackToSplash === 'function') {
          this.onBackToSplash();
        }
      });
    }

    const modeBtns = this.container.querySelectorAll('.mode-btn');
    modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.updateModeUI(btn.dataset.mode);
      });
    });

    // Copy Invite Link & WhatsApp Share Handlers
    const copyBtn = document.getElementById('copy-invite-link-btn');
    const shareBtn = document.getElementById('share-whatsapp-btn');
    const feedback = document.getElementById('copy-feedback');

    const getInviteUrl = () => {
      const base = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
      return `${base}?room=${this.roomCode}`;
    };

    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        const url = getInviteUrl();
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(url);
          } else {
            const input = document.createElement('input');
            input.value = url;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            input.remove();
          }
          if (feedback) {
            feedback.classList.remove('hidden');
            setTimeout(() => feedback.classList.add('hidden'), 3500);
          }
        } catch (err) {
          prompt('Copie o link abaixo:', url);
        }
      });
    }

    if (shareBtn) {
      shareBtn.addEventListener('click', async () => {
        const url = getInviteUrl();
        const text = `⚔️ Bora jogar MOBA Duplinha 2.5D comigo! Entre na minha sala com o link:\n${url}`;
        if (navigator.share) {
          try {
            await navigator.share({
              title: 'MOBA Duplinha 2.5D',
              text: text,
              url: url
            });
            return;
          } catch (e) {}
        }
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
      });
    }

    // Join Button Handler
    const joinBtn = document.getElementById('join-room-btn');
    const joinInput = document.getElementById('join-code-input');
    if (joinBtn && joinInput) {
      joinBtn.addEventListener('click', () => {
        this.connectToHost(joinInput.value.trim().toUpperCase());
      });
      joinInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.connectToHost(joinInput.value.trim().toUpperCase());
        }
      });
    }

    // Start Button Handler
    const startBtn = document.getElementById('start-game-btn');
    startBtn.addEventListener('click', () => {
      if (this.selectedMode === 'solo') {
        this.close();
        if (this.onStartGame) {
          this.onStartGame({
            heroId: this.selectedHeroId,
            mode: 'solo',
            roomCode: 'SOLO',
            roster: [{ id: 'player_hero_1', heroId: this.selectedHeroId, name: 'Você', isHost: true }],
            isHost: true,
            network: this.network
          });
        }
      } else if (this.selectedMode === 'host') {
        // Host launches the match for everyone!
        this.network.startMatch();
        this.close();
        if (this.onStartGame) {
          this.onStartGame({
            heroId: this.selectedHeroId,
            mode: 'host',
            roomCode: this.roomCode,
            roster: this.network.roster,
            isHost: true,
            network: this.network
          });
        }
      } else if (this.selectedMode === 'join') {
        if (!this.isClientConnected) {
          const code = document.getElementById('join-code-input')?.value.trim().toUpperCase();
          this.connectToHost(code);
        }
      }
    });
  }

  close() {
    if (this.container) {
      this.container.classList.add('hidden');
      setTimeout(() => {
        this.container?.remove();
      }, 300);
    }
  }
}
