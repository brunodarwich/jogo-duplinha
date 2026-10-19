/**
 * Specification Reference Oracle: WebRTC P2P Protocol, Room Codes & Solo Mode Fallback
 * Source: PROJECT.md §6 & spec_miner_systems_r0/handoff.md §4.3 (D)
 */

export const ROOM_CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const MAX_PLAYERS = 3;
export const HEARTBEAT_TIMEOUT_MS = 6000;

export function generateRoomCode(length = 6) {
  let result = '';
  for (let i = 0; i < length; i++) {
    const idx = Math.floor(Math.random() * ROOM_CODE_CHARS.length);
    result += ROOM_CODE_CHARS[idx];
  }
  return result;
}

export function sanitizeRoomCode(code) {
  if (typeof code !== 'string') return '';
  return code.toUpperCase().trim();
}

export class LobbySession {
  constructor(roomCode = null) {
    this.roomCode = roomCode || generateRoomCode();
    this.players = [];
    this.isMatchStarted = false;
  }

  handleJoinRequest(request) {
    if (this.players.length >= MAX_PLAYERS) {
      return {
        type: 'JOIN_REJECT',
        reason: 'Room is full (maximum 3 players)'
      };
    }
    if (this.isMatchStarted) {
      return {
        type: 'JOIN_REJECT',
        reason: 'Match is already in progress'
      };
    }

    const assignedId = this.players.length;
    const player = {
      id: assignedId,
      name: request.name || `Player ${assignedId + 1}`,
      heroId: request.heroId || 'knight',
      lastHeartbeat: Date.now(),
      isConnected: true
    };
    this.players.push(player);

    return {
      type: 'JOIN_ACCEPT',
      playerId: assignedId,
      players: this.players.map(p => ({ id: p.id, name: p.name, heroId: p.heroId }))
    };
  }

  checkTimeouts(now = Date.now()) {
    const disconnected = [];
    for (const player of this.players) {
      if (player.isConnected && now - player.lastHeartbeat > HEARTBEAT_TIMEOUT_MS) {
        player.isConnected = false;
        disconnected.push(player.id);
      }
    }
    return disconnected;
  }
}

export class SoloModeSimulator {
  constructor(heroId = 'knight') {
    this.isSoloMode = true;
    this.networkLatency = 0; // 0ms local latency
    this.isOffline = true;
    this.heroId = heroId;
    this.executedCommands = [];
  }

  dispatchCommand(command) {
    // Synchronous immediate execution
    this.executedCommands.push({
      ...command,
      executedAt: Date.now()
    });
    return { success: true, localSync: true };
  }
}
