/**
 * Peer-to-Peer WebRTC Network Layer (via PeerJS).
 * Supports 1 to 3 players (1 Host + up to 2 Clients) with automatic Solo mode fallback.
 */

import { generateRoomCode, sanitizeRoomCode, MAX_PLAYERS, HEARTBEAT_TIMEOUT_MS } from './protocol.js';
import { serializeHeroAction } from '../render/hero_action.js';
import { HERO_DEFINITIONS } from '../entities/heroes.js';
import { WORLD_PROTOCOL_VERSION, createWorldSnapshot, applyWorldSnapshot, isWorldSnapshotValid } from './world_state.js';

const NETWORK_COMMANDS = new Set(['MOVE_TO', 'ATTACK_TARGET', 'CAST_ABILITY', 'CAST_SKILL',
  'STOP', 'RECALL', 'UPGRADE_ABILITY', 'BUY_ITEM', 'SELL_ITEM']);
const safeName = name => typeof name === 'string'
  ? name.replace(/[<>&\u0000-\u001f]/g, '').trim().slice(0, 48) : '';
const safeHero = heroId => Object.hasOwn(HERO_DEFINITIONS, heroId) ? heroId : 'knight';
function cleanCommand(command) {
  if (!command || !NETWORK_COMMANDS.has(command.type)) return null;
  const result = { type: command.type };
  for (const key of ['x', 'y', 'targetX', 'targetY']) {
    if (command[key] !== undefined) {
      if (!Number.isFinite(command[key]) || command[key] < 0 || command[key] > 3200) return null;
      result[key] = command[key];
    }
  }
  for (const key of ['slot', 'skill', 'itemId', 'targetId']) {
    if (command[key] !== undefined) {
      if (key === 'slot' && command.type === 'SELL_ITEM' && Number.isInteger(command.slot)
          && command.slot >= 0 && command.slot < 6) {
        result.slot = command.slot;
        continue;
      }
      if (typeof command[key] !== 'string' || command[key].length > 120) return null;
      result[key] = command[key];
    }
  }
  if (!result.targetId) {
    const id = command.targetEntity?.id || command.targetEntityId;
    if (id !== undefined) {
      if (typeof id !== 'string' || id.length > 120) return null;
      result.targetId = id;
    }
  }
  if (typeof command.attackMove === 'boolean') result.attackMove = command.attackMove;
  if (command.slotIndex !== undefined) {
    if (!Number.isInteger(command.slotIndex) || command.slotIndex < 0 || command.slotIndex > 5) return null;
    result.slotIndex = command.slotIndex;
    if (command.type === 'SELL_ITEM') result.slot = command.slotIndex;
  }
  return result;
}

export const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:global.stun.twilio.com:3478' },
  { urls: 'stun:stun.services.mozilla.com' }
];

export class PeerNetwork {
  constructor(gameSim = null, options = {}) {
    this.gameSim = gameSim;
    this.peer = null;
    this.isHost = true;
    this.roomCode = null;
    this.myPlayerId = 'player_hero_1';
    this.connections = [];
    this.roster = [];
    this.isSoloMode = true;
    this.isMatchStarted = false;
    this.authoritativeWorld = !!options.authoritativeWorld;
    this.matchId = 'match_' + (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2));
    this.worldSequence = 0;
    this.commandSequence = 0;
    this._nextPlayerNumber = 2;
    this._connectionGeneration = 0;
    this._connectionCleanups = new Map();
    this._pendingWorldSnapshot = null;
    this.onCommandResultCallback = null;
    this.onConnectionStatusCallback = null;

    // Callbacks
    this.onPeerJoinCallback = null;
    this.onPeerLeaveCallback = null;
    this.onRosterChangeCallback = null;
    this.onMatchStartCallback = null;
    this.onPeerStateCallback = null;
  }

  setGameSim(gameSim) {
    this.gameSim = gameSim;
    if (!this.authoritativeWorld || !gameSim) return;
    // GameSimulation registers itself before finishing init().
    queueMicrotask(() => {
      if (this.gameSim !== gameSim || this.isSoloMode) return;
      if (this.isHost) {
        if (this.isMatchStarted) this.publishWorldState();
      } else {
        if (this._pendingWorldSnapshot) this.acceptWorldSnapshot(this._pendingWorldSnapshot);
        this.broadcast({ type: 'WORLD_REQUEST', protocolVersion: WORLD_PROTOCOL_VERSION });
      }
    });
  }

  publishWorldState(targetConnection = null) {
    if (!this.authoritativeWorld || this.isSoloMode || !this.isHost || !this.gameSim?.playerHero) return null;
    const packet = createWorldSnapshot(this.gameSim, {
      sequence: ++this.worldSequence, matchId: this.matchId
    });
    if (targetConnection?.open) targetConnection.send(packet);
    else this.broadcast(packet);
    return packet;
  }

  acceptWorldSnapshot(packet) {
    if (!isWorldSnapshotValid(packet)) return false;
    if (!this.gameSim?.playerHero) {
      if (!this._pendingWorldSnapshot || packet.sequence > this._pendingWorldSnapshot.sequence) this._pendingWorldSnapshot = packet;
      return true;
    }
    if (!applyWorldSnapshot(this.gameSim, packet)) return false;
    this.matchId = packet.matchId;
    this._pendingWorldSnapshot = null;
    return true;
  }

  sendCommand(command) {
    const cleaned = cleanCommand(command);
    if (!this.authoritativeWorld || this.isSoloMode || this.isHost || !cleaned) return { success: false, reason: 'invalid_command' };
    if (!this.gameSim?.worldReady) return { success: false, reason: 'world_not_ready' };
    this.broadcast({ type: 'GAME_COMMAND', protocolVersion: WORLD_PROTOCOL_VERSION,
      matchId: this.matchId, sequence: ++this.commandSequence, command: cleaned });
    return { success: true, pending: true };
  }

  reportDisconnect(message, isHostLost = false) {
    if (this._disconnecting) return;
    this.onConnectionStatusCallback?.({ connected: false, message, isHostLost });
    if (isHostLost) {
      this.gameSim?.onNetworkDisconnect?.(message);
      if (this.gameSim) this.gameSim.worldReady = false;
    }
  }

  watchConnection(connection, hostLost = !this.isHost) {
    if (this._connectionCleanups.has(connection)) return;
    const pc = connection.peerConnection;
    if (!pc?.addEventListener) return;
    const generation = this._connectionGeneration;
    let timer = null;
    const cleanup = () => {
      clearTimeout(timer);
      timer = null;
      pc.removeEventListener('connectionstatechange', check);
      pc.removeEventListener('iceconnectionstatechange', check);
      this._connectionCleanups.delete(connection);
    };
    const check = () => {
      if (connection.intentionallyClosed || connection._networkDropped || generation !== this._connectionGeneration) {
        cleanup();
        return;
      }
      const states = [pc.connectionState, pc.iceConnectionState];
      if (states.some(state => state === 'failed' || state === 'closed')) {
        this.dropConnection(connection, hostLost);
      } else if (states.includes('disconnected')) {
        if (!timer) timer = setTimeout(() => {
          timer = null;
          if (generation === this._connectionGeneration
              && [pc.connectionState, pc.iceConnectionState].includes('disconnected')) {
            this.dropConnection(connection, hostLost);
          }
        }, HEARTBEAT_TIMEOUT_MS);
      } else {
        clearTimeout(timer);
        timer = null;
      }
    };
    this._connectionCleanups.set(connection, cleanup);
    pc.addEventListener('connectionstatechange', check);
    pc.addEventListener('iceconnectionstatechange', check);
    check();
  }

  dropConnection(connection, hostLost = !this.isHost) {
    if (!connection) return false;
    this._connectionCleanups.get(connection)?.();
    if (connection._networkDropped || connection.intentionallyClosed) return false;
    connection._networkDropped = true;
    this.connections = this.connections.filter(candidate => candidate !== connection);
    if (hostLost) {
      this._pendingJoin?.reject(new Error('A conexão com a sala foi encerrada.'));
      this.onPeerLeaveCallback?.({ id: 'player_hero_1', isHost: true });
      this.reportDisconnect('O anfitrião desconectou. Volte à seleção para iniciar outra partida.', true);
    } else if (connection.assignedId) {
      this.roster = this.roster.filter(player => player.id !== connection.assignedId);
      this.broadcastRoster();
      this.onRosterChangeCallback?.(this.roster);
      this.onPeerLeaveCallback?.({ id: connection.assignedId });
      this.reportDisconnect('Um aliado desconectou.');
    }
    try { connection.close?.(); } catch (_) {}
    return true;
  }

  initSolo() {
    this.disconnect({ keepSimulation: true });
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
    const requestedCode = preferredCode ? sanitizeRoomCode(preferredCode) : null;
    if (requestedCode && this._pendingHost && requestedCode === this.roomCode) return this._pendingHost.promise;
    if (requestedCode && this.isHost && this.peer?.open && this.peer.id === 'moba-duplinha-' + requestedCode) return this.roomCode;
    this._pendingHost?.cancel(new Error('Criação de sala substituída.'));
    this._pendingJoin?.reject(new Error('Conexão substituída.'));
    this._connectionGeneration++;
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

    const generation = this._connectionGeneration;
    const pending = { promise: null, cancel: null };
    this._pendingHost = pending;
    const promise = new Promise((resolve, reject) => {
      pending.cancel = error => {
        clearTimeout(this._hostTimer);
        if (this._pendingHost === pending) this._pendingHost = null;
        reject(error);
      };
      if (typeof window === 'undefined' || typeof window.Peer === 'undefined') {
        pending.cancel(new Error('PeerJS não carregou. Verifique a conexão ou escolha Jogar Solo.'));
        return;
      }

      // If peer already exists for this room, reuse it
      if (this.peer && !this.peer.destroyed && this.peer.open && this.peer.id === peerId) {
        resolve(this.roomCode);
        return;
      }
      if (this.peer && !this.peer.destroyed) {
        for (const connection of this.connections) connection.intentionallyClosed = true;
        this.connections = [];
        try { this.peer.destroy(); } catch (e) {}
      }

      try {
        this.peer = new window.Peer(peerId, {
          debug: 1,
          config: {
            iceServers: DEFAULT_ICE_SERVERS
          }
        });
        const peer = this.peer;
        const current = () => this.peer === peer && generation === this._connectionGeneration;
        this._hostTimer = setTimeout(() => {
          if (current()) pending.cancel(new Error('Tempo limite ao criar a sala. Tente novamente.'));
        }, 15000);

        this.peer.on('open', (id) => {
          if (!current()) return;
          clearTimeout(this._hostTimer);
          if (this._pendingHost === pending) this._pendingHost = null;
          console.log(`[PeerNetwork] Sala criada com código: ${this.roomCode} (PeerID: ${id})`);
          resolve(this.roomCode);
        });

        this.peer.on('connection', (conn) => {
          if (!current()) { conn.close?.(); return; }
          this.handleIncomingConnection(conn);
        });

        this.peer.on('error', (err) => {
          if (!current()) return;
          clearTimeout(this._hostTimer);
          console.error('[PeerNetwork] Erro no Host:', err);
          if (err.type === 'unavailable-id') {
            if (this._pendingHost === pending) this._pendingHost = null;
            // Código em uso, tenta outro
            this.hostRoom(null, hostHeroId, hostName).then(resolve).catch(reject);
          } else {
            pending.cancel(err);
          }
        });
      } catch (err) {
        pending.cancel(err);
      }
    });
    pending.promise = promise;
    return promise;
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
      protocolVersion: WORLD_PROTOCOL_VERSION,
      authoritativeWorld: this.authoritativeWorld,
      matchId: this.matchId,
      roomCode: this.roomCode,
      roster: this.roster
    });
    this.publishWorldState();
  }

  async joinRoom(roomCode, clientInfo = {}) {
    this._pendingHost?.cancel(new Error('Criação de sala cancelada.'));
    this._pendingJoin?.reject(new Error('Conexão substituída.'));
    this._connectionGeneration++;
    const generation = this._connectionGeneration;
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
        for (const connection of this.connections) connection.intentionallyClosed = true;
        this.connections = [];
        try { this.peer.destroy(); } catch (e) {}
      }

      try {
        this.peer = new window.Peer({
          debug: 1,
          config: {
            iceServers: DEFAULT_ICE_SERVERS
          }
        });
        const peer = this.peer;
        const current = () => this.peer === peer && generation === this._connectionGeneration;

        let settled = false;
        let connectionTimeout = setTimeout(() => {
          this._pendingJoin?.reject(new Error('Tempo limite de conexão esgotado. Verifique se o Host já criou a sala.'));
        }, 12000);
        this._joinTimer = connectionTimeout;
        this._pendingJoin = {
          resolve: (conn) => {
            if (settled) return;
            settled = true;
            clearTimeout(connectionTimeout);
            this._joinTimer = null;
            this._pendingJoin = null;
            resolve(conn);
          },
          reject: (error) => {
            if (settled) return;
            settled = true;
            clearTimeout(connectionTimeout);
            this._joinTimer = null;
            this._pendingJoin = null;
            reject(error);
          }
        };

        this.peer.on('open', (myId) => {
          if (!current()) return;
          const conn = peer.connect(hostPeerId, { reliable: true });

          conn.on('open', () => {
            if (!current()) { conn.intentionallyClosed = true; conn.close(); return; }
            console.log(`[PeerNetwork] Conectado ao Host na sala ${this.roomCode}`);
            this.connections = [conn];
            this.watchConnection(conn, true);
            if (conn._networkDropped) return;

            // Send handshake request
            conn.send({
              type: 'JOIN_REQUEST',
              protocolVersion: WORLD_PROTOCOL_VERSION,
              authoritativeWorld: this.authoritativeWorld,
              name: clientName,
              heroId: chosenHeroId
            });

          });

          conn.on('data', (data) => {
            if (current()) this.handleData(data, conn);
          });

          conn.on('close', () => {
            if (conn.intentionallyClosed || !current()) return;
            this.dropConnection(conn, true);
          });

          conn.on('error', (err) => {
            if (!current()) return;
            if (!settled) {
              console.error('[PeerNetwork] Erro na conexão com o Host:', err);
              this._pendingJoin?.reject(err);
            }
          });
        });

        this.peer.on('error', (err) => {
          if (!current()) return;
          if (!settled) {
            console.error('[PeerNetwork] Erro no Cliente PeerJS:', err);
            if (err.type === 'peer-unavailable') {
              this._pendingJoin?.reject(new Error(`A sala "${this.roomCode}" não foi encontrada. Certifique-se de que o Host criou a sala e está esperando!`));
            } else {
              this._pendingJoin?.reject(err);
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
      this.watchConnection(conn, false);
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
      this.dropConnection(conn, false);
    });
  }

  handleData(data, senderConn) {
    if (!data || !data.type || senderConn?._networkDropped || senderConn?.intentionallyClosed) return;

    if (!this.authoritativeWorld && senderConn && !this.connections.includes(senderConn)) {
      this.connections.push(senderConn);
    }

    switch (data.type) {
      case 'JOIN_REQUEST': {
        if (!this.isHost || !senderConn) return;
        if (this.authoritativeWorld !== !!data.authoritativeWorld
            || (this.authoritativeWorld && data.protocolVersion !== WORLD_PROTOCOL_VERSION)) {
          senderConn.send({ type: 'JOIN_REJECT', reason: 'Versões incompatíveis. Atualize o jogo nos dois dispositivos.' });
          senderConn.close?.();
          return;
        }
        if (senderConn.assignedId && this.roster.some(p => p.id === senderConn.assignedId)) return;
        if (this.roster.length >= MAX_PLAYERS) {
          senderConn.send({ type: 'JOIN_REJECT', reason: 'Sala lotada (máx 3 jogadores).' });
          senderConn.close?.();
          return;
        }
        if (!this.connections.includes(senderConn)) this.connections.push(senderConn);
        while (this.roster.some(p => p.id === 'player_remote_' + this._nextPlayerNumber)) this._nextPlayerNumber++;
        const assignedId = 'player_remote_' + this._nextPlayerNumber++;
        senderConn.assignedId = assignedId;
        senderConn.lastCommandSequence = 0;

        const newPlayer = {
          id: assignedId,
          heroId: safeHero(data.heroId),
          name: safeName(data.name) || `Jogador ${this.roster.length + 1}`,
          isHost: false
        };

        this.roster.push(newPlayer);

        senderConn.send({
          type: 'JOIN_ACCEPT',
          protocolVersion: WORLD_PROTOCOL_VERSION,
          authoritativeWorld: this.authoritativeWorld,
          matchId: this.matchId,
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
        if (this.authoritativeWorld && this.gameSim && !this.gameSim.entities?.some(e => e.id === assignedId)) {
          this.gameSim.spawnRemoteHero?.(newPlayer);
        }

        // If Host already launched match, immediately send START_MATCH to late-joining player
        if (this.isMatchStarted) {
          senderConn.send({
            type: 'START_MATCH',
            protocolVersion: WORLD_PROTOCOL_VERSION,
            authoritativeWorld: this.authoritativeWorld,
            matchId: this.matchId,
            roomCode: this.roomCode,
            roster: this.roster
          });
          this.publishWorldState(senderConn);
        }
        break;
      }

      case 'JOIN_ACCEPT': {
        if (this.isHost) return;
        if (this.authoritativeWorld && (data.protocolVersion !== WORLD_PROTOCOL_VERSION || !data.authoritativeWorld)) {
          this._pendingJoin?.reject(new Error('Versões incompatíveis. Atualize o jogo nos dois dispositivos.'));
          return;
        }
        this.myPlayerId = data.assignedId;
        if (data.matchId) this.matchId = data.matchId;
        this.roomCode = data.roomCode || this.roomCode;
        if (data.roster) {
          this.roster = data.roster;
        }
        if (this.onRosterChangeCallback) {
          this.onRosterChangeCallback(this.roster);
        }
        this._pendingJoin?.resolve(senderConn);
        break;
      }

      case 'JOIN_REJECT': {
        const error = new Error(data.reason || 'Não foi possível entrar na sala.');
        this._pendingJoin?.reject(error);
        this.onConnectionStatusCallback?.({ connected: false, message: error.message });
        break;
      }

      case 'ROSTER_UPDATE': {
        if (this.authoritativeWorld && this.isHost) return;
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
          if (this.authoritativeWorld && (!senderConn?.assignedId || !this.connections.includes(senderConn)
              || this.isMatchStarted)) return;
          const playerId = this.authoritativeWorld ? senderConn.assignedId : senderConn?.assignedId || data.playerId;
          const player = this.roster.find(p => p.id === playerId);
          if (this.authoritativeWorld && (!player || player.isHost)) return;
          if (player && data.heroId) {
            player.heroId = safeHero(data.heroId);
            if (data.name) player.name = safeName(data.name) || player.name;
            this.broadcastRoster();
            if (this.onRosterChangeCallback) {
              this.onRosterChangeCallback(this.roster);
            }
          }
        }
        break;
      }

      case 'START_MATCH': {
        if (this.authoritativeWorld && (this.isHost || data.protocolVersion !== WORLD_PROTOCOL_VERSION
            || !data.authoritativeWorld)) return;
        this.isMatchStarted = true;
        if (data.matchId) this.matchId = data.matchId;
        if (data.roster) {
          this.roster = data.roster;
        }
        if (this.onMatchStartCallback) {
          this.onMatchStartCallback(this.roster);
        }
        break;
      }

      case 'WORLD_REQUEST': {
        if (this.authoritativeWorld && this.isHost && senderConn?.assignedId
            && this.roster.some(p => p.id === senderConn.assignedId)
            && data.protocolVersion === WORLD_PROTOCOL_VERSION) this.publishWorldState(senderConn);
        break;
      }

      case 'WORLD_SNAPSHOT': {
        if (this.authoritativeWorld && !this.isHost && senderConn === this.connections[0]
            && (!this.matchId || data.matchId === this.matchId || !this.gameSim?.worldReady)) this.acceptWorldSnapshot(data);
        break;
      }

      case 'GAME_COMMAND': {
        if (!this.authoritativeWorld || !this.isHost || !senderConn?.assignedId
            || !this.connections.includes(senderConn)
            || !this.roster.some(p => p.id === senderConn.assignedId)) return;
        const command = cleanCommand(data.command);
        if (data.protocolVersion !== WORLD_PROTOCOL_VERSION || data.matchId !== this.matchId || !command
            || !Number.isSafeInteger(data.sequence) || data.sequence <= (senderConn.lastCommandSequence || 0)) {
          senderConn.send({ type: 'COMMAND_RESULT', sequence: data.sequence, success: false, reason: 'invalid_command' });
          return;
        }
        senderConn.lastCommandSequence = data.sequence;
        let result;
        try {
          result = this.gameSim?.handlePlayerCommand?.(senderConn.assignedId, command);
        } catch (error) {
          console.warn('[PeerNetwork] Comando rejeitado:', error.message);
          result = { success: false, reason: 'invalid_command' };
        }
        const success = result === true || result?.success === true;
        senderConn.send({ type: 'COMMAND_RESULT', sequence: data.sequence,
          success, reason: result?.reason || (success ? null : 'command_rejected') });
        break;
      }

      case 'COMMAND_RESULT': {
        if (this.authoritativeWorld && !this.isHost && senderConn === this.connections[0]) {
          this.onCommandResultCallback?.(data);
        }
        break;
      }

      case 'HERO_UPDATE': {
        if (this.authoritativeWorld) return;
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
        if (this.authoritativeWorld) return;
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
        if (this.authoritativeWorld) return;
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
        if (this.authoritativeWorld) return;
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
      visualAction: serializeHeroAction(hero),
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

  disconnect({ keepSimulation = false } = {}) {
    this._disconnecting = true;
    for (const cleanup of this._connectionCleanups.values()) cleanup();
    this._connectionCleanups.clear();
    this._connectionGeneration++;
    clearTimeout(this._hostTimer);
    this._pendingHost?.cancel(new Error('Criação de sala cancelada.'));
    this._pendingHost = null;
    clearTimeout(this._joinTimer);
    this._joinTimer = null;
    this._pendingJoin?.reject(new Error('Conexão encerrada.'));
    this._pendingJoin = null;
    if (this.connections) {
      for (const conn of this.connections) {
        conn.intentionallyClosed = true;
        try { conn.close(); } catch (e) {}
      }
      this.connections = [];
    }
    if (this.peer && !this.peer.destroyed) {
      try { this.peer.destroy(); } catch (e) {}
    }
    this.peer = null;
    this.isMatchStarted = false;
    this._pendingWorldSnapshot = null;
    this.worldSequence = 0;
    this.commandSequence = 0;
    this.roster = [];
    this._nextPlayerNumber = 2;
    if (!keepSimulation) {
      this.gameSim = null;
      this.onPeerJoinCallback = null;
      this.onPeerLeaveCallback = null;
      this.onPeerStateCallback = null;
      this.onMatchStartCallback = null;
      this.onRosterChangeCallback = null;
      this.onCommandResultCallback = null;
      this.onConnectionStatusCallback = null;
    }
    this._disconnecting = false;
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
