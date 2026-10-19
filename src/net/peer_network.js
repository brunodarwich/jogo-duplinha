/**
 * Peer-to-Peer WebRTC Network Layer (via PeerJS).
 * Supports 1 to 3 players (1 Host + up to 2 Clients) with automatic Solo mode fallback.
 */

import { generateRoomCode, sanitizeRoomCode, MAX_PLAYERS } from './protocol.js';

export const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:global.stun.twilio.com:3478' },
  { urls: 'stun:stun.services.mozilla.com' }
];

export class PeerNetwork {
  constructor(gameSim = null) {
    this.gameSim = gameSim;
    this.peer = null;
    this.isHost = true;
    this.roomCode = null;
    this.myPlayerId = 'player_hero_1';
    this.connections = [];
    this.roster = [];
    this.isSoloMode = true;
    this.isMatchStarted = false;

    // Callbacks
    this.onPeerJoinCallback = null;
    this.onPeerLeaveCallback = null;
    this.onRosterChangeCallback = null;
    this.onMatchStartCallback = null;
    this.onPeerStateCallback = null;
  }

  setGameSim(gameSim) {
    this.gameSim = gameSim;
  }

  initSolo() {
    this.isSoloMode = true;
    this.isHost = true;
    this.roomCode = 'SOLO';
    this.myPlayerId = 'player_hero_1';
    this.roster = [{
      id: 'player_hero_1',
      name: 'Você',
      heroId: this.gameSim?.heroClass || 'knight',
      isHost: true
    }];
    this.connections = [];
    console.log('[PeerNetwork] Iniciado em Modo Solo Offline.');
    return Promise.resolve(this.roomCode);
  }

  async hostRoom(preferredCode = null, hostHeroId = 'knight', hostName = 'Host') {
    this.isSoloMode = false;
    this.isHost = true;
    this.roomCode = preferredCode ? sanitizeRoomCode(preferredCode) : generateRoomCode();
    this.myPlayerId = 'player_hero_1';
    this.roster = [{
      id: 'player_hero_1',
      name: hostName || 'Host',
      heroId: hostHeroId || 'knight',
      isHost: true
    }];
    const peerId = `moba-duplinha-${this.roomCode}`;

    if (this.onRosterChangeCallback) {
      this.onRosterChangeCallback(this.roster);
    }

    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || typeof window.Peer === 'undefined') {
        console.warn('[PeerNetwork] PeerJS não carregado. Operando em modo Solo.');
        this.initSolo();
        resolve(this.roomCode);
        return;
      }

      // If peer already exists for this room, reuse it
      if (this.peer && !this.peer.destroyed && this.peer.id === peerId) {
        resolve(this.roomCode);
        return;
      }
      if (this.peer && !this.peer.destroyed) {
        try { this.peer.destroy(); } catch (e) {}
      }

      try {
        this.peer = new window.Peer(peerId, {
          debug: 1,
          config: {
            iceServers: DEFAULT_ICE_SERVERS
          }
        });

        this.peer.on('open', (id) => {
          console.log(`[PeerNetwork] Sala criada com código: ${this.roomCode} (PeerID: ${id})`);
          resolve(this.roomCode);
        });

        this.peer.on('connection', (conn) => {
          this.handleIncomingConnection(conn);
        });

        this.peer.on('error', (err) => {
          console.error('[PeerNetwork] Erro no Host:', err);
          if (err.type === 'unavailable-id') {
            // Código em uso, tenta outro
            this.hostRoom(null, hostHeroId, hostName).then(resolve).catch(reject);
          } else {
            reject(err);
          }
        });
      } catch (err) {
        console.warn('[PeerNetwork] Falha ao iniciar PeerJS:', err);
        this.initSolo();
        resolve(this.roomCode);
      }
    });
  }

  updateHostHero(heroId, name = null) {
    const hostEntry = this.roster.find(p => p.isHost);
    if (hostEntry) {
      if (heroId) hostEntry.heroId = heroId;
      if (name) hostEntry.name = name;
      this.broadcastRoster();
      if (this.onRosterChangeCallback) {
        this.onRosterChangeCallback(this.roster);
      }
    }
  }

  sendHeroSelect(heroId, name = null) {
    if (this.isHost) {
      this.updateHostHero(heroId, name);
    } else {
      // Optimistically update local client roster
      const me = this.roster.find(p => p.id === this.myPlayerId);
      if (me) {
        me.heroId = heroId;
        if (name) me.name = name;
        if (this.onRosterChangeCallback) this.onRosterChangeCallback(this.roster);
      }
      this.broadcast({
        type: 'HERO_SELECT',
        playerId: this.myPlayerId,
        heroId,
        name
      });
    }
  }

  startMatch() {
    if (!this.isHost) return;
    this.isMatchStarted = true;
    this.broadcast({
      type: 'START_MATCH',
      roomCode: this.roomCode,
      roster: this.roster
    });
  }

  async joinRoom(roomCode, clientInfo = {}) {
    this.isSoloMode = false;
    this.isHost = false;
    this.roomCode = sanitizeRoomCode(roomCode);
    const hostPeerId = `moba-duplinha-${this.roomCode}`;
    const chosenHeroId = clientInfo.heroId || 'sorceress';
    const clientName = clientInfo.name || 'Aliado';

    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || typeof window.Peer === 'undefined') {
        reject(new Error('PeerJS não está carregado no navegador.'));
        return;
      }

      if (this.peer && !this.peer.destroyed) {
        try { this.peer.destroy(); } catch (e) {}
      }

      try {
        this.peer = new window.Peer({
          debug: 1,
          config: {
            iceServers: DEFAULT_ICE_SERVERS
          }
        });

        let settled = false;
        let connectionTimeout = setTimeout(() => {
          if (!settled) {
            settled = true;
            reject(new Error('Tempo limite de conexão esgotado. Verifique se o Host já criou a sala.'));
          }
        }, 12000);

        this.peer.on('open', (myId) => {
          const conn = this.peer.connect(hostPeerId, { reliable: true });

          conn.on('open', () => {
            if (!settled) {
              settled = true;
              clearTimeout(connectionTimeout);
            }
            console.log(`[PeerNetwork] Conectado ao Host na sala ${this.roomCode}`);
            this.connections = [conn];

            // Send handshake request
            conn.send({
              type: 'JOIN_REQUEST',
              name: clientName,
              heroId: chosenHeroId
            });

            resolve(conn);
          });

          conn.on('data', (data) => {
            this.handleData(data, conn);
          });

          conn.on('close', () => {
            console.log('[PeerNetwork] Desconectado do Host.');
            this.connections = [];
            if (this.onPeerLeaveCallback) {
              this.onPeerLeaveCallback({ id: 'player_hero_1', isHost: true });
            }
          });

          conn.on('error', (err) => {
            if (!settled) {
              settled = true;
              clearTimeout(connectionTimeout);
              console.error('[PeerNetwork] Erro na conexão com o Host:', err);
              reject(err);
            }
          });
        });

        this.peer.on('error', (err) => {
          if (!settled) {
            settled = true;
            clearTimeout(connectionTimeout);
            console.error('[PeerNetwork] Erro no Cliente PeerJS:', err);
            if (err.type === 'peer-unavailable') {
              reject(new Error(`A sala "${this.roomCode}" não foi encontrada. Certifique-se de que o Host criou a sala e está esperando!`));
            } else {
              reject(err);
            }
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  handleIncomingConnection(conn) {
    if (this.connections.length >= (MAX_PLAYERS - 1)) {
      if (conn.open) {
        conn.send({ type: 'JOIN_REJECT', reason: 'Sala lotada (máx 3 jogadores)' });
        conn.close();
      } else {
        conn.on('open', () => {
          conn.send({ type: 'JOIN_REJECT', reason: 'Sala lotada (máx 3 jogadores)' });
          conn.close();
        });
      }
      return;
    }

    const registerConnection = () => {
      if (!this.connections.includes(conn)) {
        this.connections.push(conn);
        console.log(`[PeerNetwork] Novo canal de dados aberto (${this.connections.length + 1}/${MAX_PLAYERS})`);
      }
    };

    if (conn.open) {
      registerConnection();
    } else {
      conn.on('open', registerConnection);
    }

    conn.on('data', (data) => {
      this.handleData(data, conn);
    });

    conn.on('close', () => {
      this.connections = this.connections.filter(c => c !== conn);
      if (conn.assignedId) {
        this.roster = this.roster.filter(p => p.id !== conn.assignedId);
        this.broadcastRoster();
        if (this.onRosterChangeCallback) this.onRosterChangeCallback(this.roster);
        if (this.onPeerLeaveCallback) this.onPeerLeaveCallback({ id: conn.assignedId });
      }
      console.log('[PeerNetwork] Jogador desconectou.');
    });
  }

  handleData(data, senderConn) {
    if (!data || !data.type) return;

    if (senderConn && !this.connections.includes(senderConn)) {
      this.connections.push(senderConn);
    }

    switch (data.type) {
      case 'JOIN_REQUEST': {
        const assignedId = `player_remote_${this.roster.length + 1}`;
        senderConn.assignedId = assignedId;

        const newPlayer = {
          id: assignedId,
          heroId: data.heroId || 'knight',
          name: data.name || `Jogador ${this.roster.length + 1}`,
          isHost: false
        };

        this.roster.push(newPlayer);

        senderConn.send({
          type: 'JOIN_ACCEPT',
          assignedId,
          roomCode: this.roomCode,
          roster: this.roster
        });

        // Broadcast updated roster to other connected peers
        this.broadcastRoster();

        if (this.onRosterChangeCallback) {
          this.onRosterChangeCallback(this.roster);
        }
        if (this.onPeerJoinCallback) {
          this.onPeerJoinCallback(newPlayer);
        }

        // If Host already launched match, immediately send START_MATCH to late-joining player
        if (this.isMatchStarted) {
          senderConn.send({
            type: 'START_MATCH',
            roomCode: this.roomCode,
            roster: this.roster
          });
        }
        break;
      }

      case 'JOIN_ACCEPT': {
        this.myPlayerId = data.assignedId;
        this.roomCode = data.roomCode || this.roomCode;
        if (data.roster) {
          this.roster = data.roster;
        }
        if (this.onRosterChangeCallback) {
          this.onRosterChangeCallback(this.roster);
        }
        break;
      }

      case 'ROSTER_UPDATE': {
        if (data.roster) {
          this.roster = data.roster;
          if (this.onRosterChangeCallback) {
            this.onRosterChangeCallback(this.roster);
          }
        }
        break;
      }

      case 'HERO_SELECT': {
        if (this.isHost) {
          const playerId = senderConn.assignedId || data.playerId;
          const player = this.roster.find(p => p.id === playerId);
          if (player && data.heroId) {
            player.heroId = data.heroId;
            if (data.name) player.name = data.name;
            this.broadcastRoster();
            if (this.onRosterChangeCallback) {
              this.onRosterChangeCallback(this.roster);
            }
          }
        }
        break;
      }

      case 'START_MATCH': {
        if (data.roster) {
          this.roster = data.roster;
        }
        if (this.onMatchStartCallback) {
          this.onMatchStartCallback(this.roster);
        }
        break;
      }

      case 'HERO_UPDATE': {
        if (this.gameSim && typeof this.gameSim.handleRemoteHeroUpdate === 'function') {
          this.gameSim.handleRemoteHeroUpdate(data);
        }
        if (this.onPeerStateCallback) {
          this.onPeerStateCallback(data);
        }
        // Broadcast to other peers if Host
        if (this.isHost) {
          for (const conn of this.connections) {
            if (conn !== senderConn && conn.open) {
              conn.send(data);
            }
          }
        }
        break;
      }

      case 'CAST_SKILL': {
        if (this.gameSim && typeof this.gameSim.handleRemoteCast === 'function') {
          this.gameSim.handleRemoteCast(data);
        }
        if (this.isHost) {
          for (const conn of this.connections) {
            if (conn !== senderConn && conn.open) {
              conn.send(data);
            }
          }
        }
        break;
      }

      case 'CHAT_COMMAND': {
        if (this.gameSim && typeof this.gameSim.handleRemoteChatCommand === 'function') {
          this.gameSim.handleRemoteChatCommand(data);
        }
        if (this.isHost) {
          for (const conn of this.connections) {
            if (conn !== senderConn && conn.open) {
              conn.send(data);
            }
          }
        }
        break;
      }

      case 'UPGRADE_ABILITY': {
        if (this.gameSim && this.gameSim.entities) {
          const hero = this.gameSim.entities.find(e => e.id === data.heroId);
          if (hero && hero.abilities && hero.abilities[data.slot]) {
            hero.abilities[data.slot].rank = data.newRank;
            hero.skillPoints = Math.max(0, (hero.skillPoints || 1) - 1);
          }
        }
        if (this.isHost) {
          for (const conn of this.connections) {
            if (conn !== senderConn && conn.open) {
              conn.send(data);
            }
          }
        }
        break;
      }
    }
  }

  serializeHeroState(hero) {
    if (!hero) return null;
    return {
      type: 'HERO_UPDATE',
      id: hero.id,
      heroId: hero.heroId,
      name: hero.name,
      x: Math.round(hero.x * 10) / 10,
      y: Math.round(hero.y * 10) / 10,
      facing: Math.round(hero.facing * 100) / 100,
      hp: Math.round(hero.hp),
      maxHp: Math.round(hero.maxHp),
      mana: Math.round(hero.mana),
      maxMana: Math.round(hero.maxMana),
      isRecalling: !!hero.isRecalling,
      isDead: !!hero.isDead,
      speed: hero.speed,
      level: hero.level,
      xp: hero.xp || 0,
      maxXp: hero.maxXp || 0,
      skillPoints: hero.skillPoints || 0,
      abilityRanks: {
        Q: hero.abilities?.Q?.rank || 0,
        W: hero.abilities?.W?.rank || 0,
        E: hero.abilities?.E?.rank || 0,
        R: hero.abilities?.R?.rank || 0
      }
    };
  }

  sendHeroUpdate(hero) {
    const packet = this.serializeHeroState(hero);
    if (packet) {
      this.broadcast(packet);
    }
  }

  broadcastRoster() {
    this.broadcast({
      type: 'ROSTER_UPDATE',
      roster: this.roster
    });
  }

  broadcast(message) {
    if (this.isSoloMode || !this.connections) return;
    for (const conn of this.connections) {
      if (conn && conn.open) {
        try {
          conn.send(message);
        } catch (e) {
          console.warn('[PeerNetwork] Falha ao enviar pacote:', e);
        }
      }
    }
  }

  disconnect() {
    if (this.connections) {
      for (const conn of this.connections) {
        try { conn.close(); } catch (e) {}
      }
      this.connections = [];
    }
    if (this.peer && !this.peer.destroyed) {
      try { this.peer.destroy(); } catch (e) {}
    }
  }

  // Mock loopback connection for automated testing without browser PeerJS
  static createMockPair(roomCode = 'TEST_ROOM', hostHeroId = 'knight', clientHeroId = 'sorceress') {
    const host = new PeerNetwork();
    const client = new PeerNetwork();

    host.isSoloMode = false;
    host.isHost = true;
    host.roomCode = roomCode;
    host.myPlayerId = 'player_hero_1';
    host.roster = [{ id: 'player_hero_1', name: 'Host', heroId: hostHeroId, isHost: true }];

    client.isSoloMode = false;
    client.isHost = false;
    client.roomCode = roomCode;

    // Fake connection objects
    const hostConn = {
      open: true,
      assignedId: null,
      send: (data) => queueMicrotask(() => client.handleData(data, clientConn)),
      close: () => {}
    };

    const clientConn = {
      open: true,
      send: (data) => queueMicrotask(() => host.handleData(data, hostConn)),
      close: () => {}
    };

    host.connections.push(hostConn);
    client.connections.push(clientConn);

    return { host, client, hostConn, clientConn };
  }
}
