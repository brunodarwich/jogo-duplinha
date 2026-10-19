import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue, assertFalse } from '../helpers/assert.js';
import { resolveModule } from '../helpers/module_resolver.js';

describe('Tier 1 Unit: WebRTC Protocol, Room Codes & Solo Mode Fallback', () => {
  it('TC-NET-01: Generates 6-character Base32 room codes matching Crockford alphabet', async () => {
    const { module: netMod } = await resolveModule('net/protocol');

    for (let i = 0; i < 10; i++) {
      const code = netMod.generateRoomCode(6);
      assertEqual(code.length, 6);
      for (const ch of code) {
        assertTrue(netMod.ROOM_CODE_CHARS.includes(ch), `Character ${ch} not in Crockford set`);
      }
    }
  });

  it('TC-NET-02: Sanitizes room code input converting to uppercase and trimming whitespace', async () => {
    const { module: netMod } = await resolveModule('net/protocol');

    assertEqual(netMod.sanitizeRoomCode('  ab7x9q  '), 'AB7X9Q');
    assertEqual(netMod.sanitizeRoomCode('3k8m2p'), '3K8M2P');
    assertEqual(netMod.sanitizeRoomCode(null), '');
  });

  it('TC-NET-03: Handshake admits up to 3 players assigning sequential IDs', async () => {
    const { module: netMod } = await resolveModule('net/protocol');
    const lobby = new netMod.LobbySession('ROOM01');

    const p1 = lobby.handleJoinRequest({ name: 'Alice', heroId: 'knight' });
    assertEqual(p1.type, 'JOIN_ACCEPT');
    assertEqual(p1.playerId, 0);

    const p2 = lobby.handleJoinRequest({ name: 'Bob', heroId: 'sorceress' });
    assertEqual(p2.type, 'JOIN_ACCEPT');
    assertEqual(p2.playerId, 1);

    const p3 = lobby.handleJoinRequest({ name: 'Charlie', heroId: 'ranger' });
    assertEqual(p3.type, 'JOIN_ACCEPT');
    assertEqual(p3.playerId, 2);

    assertEqual(lobby.players.length, 3);
  });

  it('TC-NET-04: Rejects 4th player join request when lobby reaches 3 players', async () => {
    const { module: netMod } = await resolveModule('net/protocol');
    const lobby = new netMod.LobbySession('ROOM01');

    lobby.handleJoinRequest({ name: 'P1' });
    lobby.handleJoinRequest({ name: 'P2' });
    lobby.handleJoinRequest({ name: 'P3' });

    const p4 = lobby.handleJoinRequest({ name: 'P4' });
    assertEqual(p4.type, 'JOIN_REJECT');
    assertTrue(p4.reason.includes('full'));
  });

  it('TC-NET-05: Disconnect detection triggers when peer heartbeat exceeds 6000ms', async () => {
    const { module: netMod } = await resolveModule('net/protocol');
    const lobby = new netMod.LobbySession('ROOM01');

    lobby.handleJoinRequest({ name: 'P1' });
    lobby.handleJoinRequest({ name: 'P2' });

    const now = Date.now();
    lobby.players[0].lastHeartbeat = now - 2000; // active
    lobby.players[1].lastHeartbeat = now - 6500; // timed out

    const timedOut = lobby.checkTimeouts(now);
    assertEqual(timedOut.length, 1);
    assertEqual(timedOut[0], 1); // player 1 timed out
    assertFalse(lobby.players[1].isConnected);
    assertTrue(lobby.players[0].isConnected);
  });

  it('TC-NET-06: Solo Mode fallback executes commands locally with zero latency', async () => {
    const { module: netMod } = await resolveModule('net/protocol');
    const solo = new netMod.SoloModeSimulator('knight');

    assertTrue(solo.isSoloMode);
    assertTrue(solo.isOffline);
    assertEqual(solo.networkLatency, 0);

    const res = solo.dispatchCommand({ type: 'MOVE', x: 500, y: 500 });
    assertTrue(res.success);
    assertTrue(res.localSync);
    assertEqual(solo.executedCommands.length, 1);
  });
});
