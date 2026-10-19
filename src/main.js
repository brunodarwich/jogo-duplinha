/**
 * Application Entry Point.
 * Boots the game simulation, sets up high-DPI canvas scaling, binds HUD events,
 * and launches the 5-Hero Selection Lobby & Multiplayer connection.
 */

import { GameSimulation } from './game.js';
import { LobbyUI } from './ui/lobby_ui.js';
import { LoadingScreen } from './ui/loading_screen.js';
import { PeerNetwork } from './net/peer_network.js';
import { VirtualJoystick } from './ui/virtual_joystick.js';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) {
    console.error('Fatal: #game-canvas not found in document!');
    return;
  }

  // High-DPI Canvas Scaling
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx && typeof ctx.scale === 'function') {
      ctx.scale(dpr, dpr);
    }

    if (window.gameSim) {
      window.gameSim.renderer.resize(width, height, dpr);
      window.gameSim.camera.resize(width, height);
    }
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Setup Network Layer beforehand so LobbyUI can use it for waiting room & peer registration
  const net = new PeerNetwork();

  function openSelectionScreen() {
    new LobbyUI({
      network: net,
      onBackToSplash: () => {
        openLoadingScreen(false);
      },
      onStartGame: async (options) => {
        console.log('[Main] Inicializando partida com configurações:', options);

        // Initialize Simulation with Chosen Hero and Multiplayer Roster
        const gameSim = new GameSimulation({
          canvas: canvas,
          heroClass: options.heroId || 'knight',
          roster: options.roster || [],
          isHost: options.isHost ?? true,
          network: net
        });
      window.gameSim = gameSim;

      // Mobile Virtual Joystick & Touch Controls
      const joystick = new VirtualJoystick(gameSim);
      gameSim.virtualJoystick = joystick;

      // Resize camera and renderer for current canvas
      resizeCanvas();

      // Connect simulation with network layer
      gameSim.network = net;
      net.setGameSim(gameSim);

      if (options.mode === 'solo') {
        net.initSolo();
      } else if (options.mode === 'host') {
        if (!net.peer || net.peer.destroyed) {
          try {
            await net.hostRoom(options.roomCode, options.heroId);
          } catch (err) {
            console.warn('Falha no Host P2P, caindo para Solo:', err);
          }
        }
      } else if (options.mode === 'join') {
        if (net.connections.length === 0) {
          try {
            await net.joinRoom(options.roomCode, { heroId: options.heroId });
          } catch (err) {
            alert('Não foi possível conectar à sala informada. Iniciando em modo offline.');
            net.initSolo();
          }
        }
      }

    // Ability Button Click Handlers in HUD
    const abilityButtons = [
      { id: 'ability-q', slot: 'Q' },
      { id: 'ability-w', slot: 'W' },
      { id: 'ability-e', slot: 'E' },
      { id: 'ability-r', slot: 'R' },
      { id: 'ability-b', slot: 'B' }
    ];

    for (const btnInfo of abilityButtons) {
      const btn = document.getElementById(btnInfo.id);
      if (btn) {
        btn.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          if (btnInfo.slot === 'B') {
            gameSim.handleCommand({ type: 'RECALL' });
          } else {
            gameSim.input.triggerAbility(btnInfo.slot);
          }
        });
      }
    }

    // In-game Chat & Command Console handler
    const chatBar = document.getElementById('chat-command-bar');
    const chatInput = document.getElementById('chat-command-input');
    const chatSubmit = document.getElementById('chat-command-submit');

    function executeChatCommand() {
      if (!chatInput) return;
      const text = chatInput.value.trim().toLowerCase();
      if (text === '/boost' || text === 'boost') {
        gameSim.applyBoost();
      } else if (text === '/plan' || text === 'plan' || text === '/help' || text === 'help') {
        gameSim.applyPlan();
      } else if (text.startsWith('/gold') || text === 'gold') {
        gameSim.playerHero.gold = (gameSim.playerHero.gold || 0) + 1000;
        if (gameSim.shopUI) gameSim.shopUI.updateGoldDisplay();
        gameSim.particles.addFloatingText('+1000 Ouro!', gameSim.playerHero.x, gameSim.playerHero.y - 30, { color: '#fbbf24', fontSize: 18 });
      } else if (text === '/horde' || text === 'horde' || text === '/hordas' || text === 'hordas' || text === '/waves' || text === 'waves' || text === '/onda' || text === 'onda') {
        gameSim.spawnExtraWave();
      }
      chatInput.value = '';
      chatInput.blur();
      chatBar?.classList.add('hidden');
    }

    if (chatSubmit && chatInput) {
      chatSubmit.addEventListener('click', (e) => {
        e.stopPropagation();
        executeChatCommand();
      });
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          executeChatCommand();
        } else if (e.key === 'Escape') {
          chatInput.value = '';
          chatInput.blur();
          chatBar?.classList.add('hidden');
        }
      });
    }

    // Start simulation loop
    gameSim.start();
    window.boost = () => window.gameSim?.applyBoost();
    window['/boost'] = () => window.gameSim?.applyBoost();
    window.plan = () => window.gameSim?.applyPlan();
    window['/plan'] = () => window.gameSim?.applyPlan();
    window.horde = () => window.gameSim?.spawnExtraWave();
    window['/horde'] = () => window.gameSim?.spawnExtraWave();
    console.log('Project Duplinha — Jogo iniciado com sucesso com o herói:', options.heroId);
      }
    });
  }

  function openLoadingScreen(autoStartOnInvite = true) {
    new LoadingScreen({
      autoStartOnInvite,
      onComplete: () => {
        openSelectionScreen();
      }
    });
  }

  // Launch Initial Splash & Loading Screen first
  openLoadingScreen(true);
});


