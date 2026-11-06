import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue, assertFalse } from '../helpers/assert.js';
import { GameSimulation } from '../../src/game.js';
import { createWorldSnapshot, applyWorldSnapshot, WORLD_PROTOCOL_VERSION } from '../../src/net/world_state.js';
import { GroundHazard } from '../../src/world/boss.js';
import { MinionUnit } from '../../src/world/minion.js';
import { HeroProjectile } from '../../src/combat/projectile.js';
import { PeerNetwork } from '../../src/net/peer_network.js';

describe('Authoritative world snapshots', () => {
  it('round-trips the playable world while retaining the local hero and real prototypes', () => {
    const host = new GameSimulation();
    const client = new GameSimulation();
    const localHero = client.playerHero;
    host.playerHero.gold = 321;
    host.playerHero.abilities.Q.rank = 3;
    host.playerHero.abilities.Q.cooldownRemaining = 2.5;
    host.playerHero.inventoryInstance.addItem('item_dagger');
    host.playerHero.barrier = 75;
    host.playerHero.stunnedUntil = 11200;
    host.enemyNexus.hp = 456;
    host.waveSpawner.waveIndex = 7;
    host.waveSpawner.nextWaveTime = 90;
    const minion = new MinionUnit({ id: 'shared-minion', team: 'enemy', x: 1200, y: 1200 });
    host.entities.push(minion);
    host.heroProjectiles.push(new HeroProjectile({ hero: host.playerHero, target: minion }));
    host.bossManager.activeHazards.push(new GroundHazard({ id: 'shared-hazard', type: 'slam' }));
    const packet = createWorldSnapshot(host, { sequence: 1, matchId: 'roundtrip', now: 10000 });
    assertEqual(packet.protocolVersion, WORLD_PROTOCOL_VERSION);
    assertTrue(applyWorldSnapshot(client, packet, { now: 50000 }));
    assertEqual(client.playerHero, localHero);
    assertEqual(client.playerHero.gold, 321);
    assertEqual(client.playerHero.abilities.Q.rank, 3);
    assertEqual(client.playerHero.abilities.Q.cooldownRemaining, 2.5);
    assertEqual(client.playerHero.inventoryInstance.slots[0].id, 'item_dagger');
    assertEqual(client.playerHero.barrier, 75);
    assertEqual(client.playerHero.stunnedUntil, 51200);
    assertEqual(client.enemyNexus.hp, 456);
    assertEqual(client.waveSpawner.waveIndex, 7);
    assertEqual(client.waveSpawner.nextWaveTime, 90);
    assertTrue(client.entities.find(e => e.id === minion.id) instanceof MinionUnit);
    assertTrue(client.heroProjectiles[0] instanceof HeroProjectile);
    assertEqual(client.heroProjectiles[0].target, client.entities.find(e => e.id === minion.id));
    assertTrue(client.bossManager.activeHazards[0] instanceof GroundHazard);
    assertEqual(typeof client.enemyNexus.isInvulnerable, 'function');
    assertEqual(client.entities.length, host.entities.length);
    packet.entities.find(e => e.id === host.playerHero.id).abilities.Q.rank = 0;
    assertEqual(host.playerHero.abilities.Q.rank, 3);
    assertEqual(client.playerHero.abilities.Q.rank, 3);
  });

  it('ignores stale, duplicate, foreign and malformed snapshots atomically', () => {
    const host = new GameSimulation();
    const client = new GameSimulation();
    const packet = createWorldSnapshot(host, { sequence: 2, matchId: 'one' });
    assertTrue(applyWorldSnapshot(client, packet));
    const hp = client.playerHero.hp;
    for (const invalid of [
      packet,
      { ...packet, sequence: 1 },
      { ...packet, sequence: 3, matchId: 'other' },
      { ...packet, sequence: 3, protocolVersion: -1 },
      { ...packet, sequence: 3, entities: packet.entities.map((e, i) => i ? e : { ...e, baseStats: null }) },
      { ...packet, sequence: 3, entities: packet.entities.map((e, i) => i ? e : { ...e, abilities: {} }) },
      { ...packet, sequence: 3, entities: [{ ...packet.entities[0], values: { x: NaN } }] },
      { ...packet, sequence: 3, entities: [packet.entities[0], packet.entities[0]] }
    ]) assertFalse(applyWorldSnapshot(client, invalid));
    assertEqual(client.playerHero.hp, hp);
    assertEqual(client._worldSnapshotSequence, 2);
  });

  it('reconciles entity removals, tower references and a terminal result', () => {
    const host = new GameSimulation();
    const client = new GameSimulation();
    const victim = host.entities.find(e => e.type === 'minion');
    host.entities = host.entities.filter(e => e.id !== victim.id);
    host.isVictory = true;
    host.matchTime = 123;
    assertTrue(applyWorldSnapshot(client, createWorldSnapshot(host, { sequence: 1, matchId: 'terminal' })));
    assertFalse(client.entities.some(e => e.id === victim.id));
    assertEqual(client.isVictory, true);
    assertEqual(client.matchTime, 123);
    const inner = client.towers.find(t => t.tier === 'inner');
    assertTrue(client.towers.includes(inner.parentTower));
  });
});

describe('Authoritative transport', () => {
  it('binds hero selection to an accepted guest connection and freezes selection after start', () => {
    const host = new PeerNetwork(null, { authoritativeWorld: true });
    host.isHost = true;
    host.isSoloMode = false;
    host.roster = [{ id: 'player_hero_1', heroId: 'knight', isHost: true },
      { id: 'guest', heroId: 'sorceress', isHost: false }];
    const anonymous = { open: true, send() {} };
    host.connections.push(anonymous);
    host.handleData({ type: 'HERO_SELECT', playerId: 'player_hero_1', heroId: 'assassin' }, anonymous);
    assertEqual(host.roster[0].heroId, 'knight');
    const guest = { open: true, assignedId: 'guest', send() {} };
    host.connections.push(guest);
    host.handleData({ type: 'HERO_SELECT', playerId: 'player_hero_1', heroId: 'cleric' }, guest);
    assertEqual(host.roster[0].heroId, 'knight');
    assertEqual(host.roster[1].heroId, 'cleric');
    host.isMatchStarted = true;
    host.handleData({ type: 'HERO_SELECT', heroId: 'assassin' }, guest);
    assertEqual(host.roster[1].heroId, 'cleric');
  });
  it('rejects incompatible joins before altering roster and preserves late-entry state', () => {
    const host = new PeerNetwork(null, { authoritativeWorld: true });
    host.isSoloMode = false;
    host.isHost = true;
    host.roster = [{ id: 'player_hero_1', heroId: 'knight', isHost: true }];
    host.gameSim = new GameSimulation({ network: host });
    const sent = [];
    const rejected = { open: true, send: p => sent.push(p), close() {} };
    host.handleData({ type: 'JOIN_REQUEST', protocolVersion: -1, authoritativeWorld: true }, rejected);
    assertEqual(host.roster.length, 1);
    assertEqual(sent[0].type, 'JOIN_REJECT');
    host.isMatchStarted = true;
    sent.length = 0;
    const accepted = { open: true, send: p => sent.push(p), close() {} };
    host.handleData({ type: 'JOIN_REQUEST', protocolVersion: WORLD_PROTOCOL_VERSION, authoritativeWorld: true,
      heroId: 'cleric', name: 'Tarde' }, accepted);
    assertEqual(host.roster.length, 2);
    assertTrue(sent.some(p => p.type === 'START_MATCH'));
    const snapshot = sent.find(p => p.type === 'WORLD_SNAPSHOT');
    assertTrue(!!snapshot);
    assertTrue(snapshot.entities.some(e => e.id === accepted.assignedId));
  });

  it('executes commands using connection identity and ignores duplicates and forged state', () => {
    const host = new PeerNetwork(null, { authoritativeWorld: true });
    host.isSoloMode = false;
    host.isHost = true;
    host.roster = [{ id: 'player_hero_1', isHost: true }, { id: 'guest', isHost: false }];
    const results = [];
    const conn = { open: true, assignedId: 'guest', send: p => results.push(p) };
    host.connections.push(conn);
    const calls = [];
    host.gameSim = { handlePlayerCommand: (id, command) => { calls.push({ id, command }); return { success: true }; } };
    const packet = { type: 'GAME_COMMAND', protocolVersion: WORLD_PROTOCOL_VERSION, matchId: host.matchId,
      sequence: 1, playerId: 'player_hero_1', command: { type: 'MOVE_TO', x: 800, y: 900, gold: 999999 } };
    host.handleData(packet, conn);
    host.handleData(packet, conn);
    host.handleData({ ...packet, sequence: 2, command: { type: 'BOOST' } }, conn);
    assertEqual(calls.length, 1);
    assertEqual(calls[0].id, 'guest');
    assertEqual(calls[0].command.gold, undefined);
    assertEqual(results[0].success, true);
  });

  it('applies host snapshots and queues commands until the initial world is available', () => {
    const host = new GameSimulation();
    const client = new PeerNetwork(null, { authoritativeWorld: true });
    client.isSoloMode = false;
    client.isHost = false;
    const sim = new GameSimulation({ network: client });
    const sent = [];
    const conn = { open: true, send: p => sent.push(p) };
    client.connections = [conn];
    assertFalse(client.sendCommand({ type: 'MOVE_TO', x: 800, y: 800 }).success);
    const snapshot = createWorldSnapshot(host, { sequence: 1, matchId: 'network' });
    client.handleData(snapshot, conn);
    assertTrue(sim.worldReady);
    assertTrue(client.sendCommand({ type: 'MOVE_TO', x: 800, y: 800 }).success);
    assertEqual(sent[0].matchId, 'network');
    assertEqual(sent[0].type, 'GAME_COMMAND');
  });

  it('surfaces host loss and clears session resources without retaining old game callbacks', () => {
    const network = new PeerNetwork(null, { authoritativeWorld: true });
    let message = null;
    let closed = 0;
    const game = { worldReady: true, onNetworkDisconnect: value => { message = value; } };
    network.gameSim = game;
    network.isSoloMode = false;
    network.isHost = false;
    network.connections = [{ open: true, close: () => { closed++; } }];
    network.peer = { destroyed: false, destroy: () => { closed++; } };
    network.onPeerJoinCallback = () => {};
    network.isMatchStarted = true;
    network.reportDisconnect('Anfitrião ausente', true);
    assertEqual(message, 'Anfitrião ausente');
    assertFalse(game.worldReady);
    network.disconnect();
    assertEqual(closed, 2);
    assertEqual(network.gameSim, null);
    assertEqual(network.onPeerJoinCallback, null);
    assertEqual(network.connections.length, 0);
    assertFalse(network.isMatchStarted);
  });

  it('cancels room creation and ignores events from a superseded Peer instance', async () => {
    const previousWindow = globalThis.window;
    const peers = [];
    class FakePeer {
      constructor(id) { this.id = id; this.open = false; this.destroyed = false; this.handlers = {}; peers.push(this); }
      on(type, handler) { this.handlers[type] = handler; }
      destroy() { this.destroyed = true; }
      emit(type, value) { this.handlers[type]?.(value); }
    }
    globalThis.window = { Peer: FakePeer };
    try {
      const network = new PeerNetwork(null, { authoritativeWorld: true });
      let cancelled = false;
      const first = network.hostRoom('ROOMA').catch(() => { cancelled = true; });
      const oldPeer = peers[0];
      network.disconnect();
      const second = network.hostRoom('ROOMB');
      peers[1].open = true;
      peers[1].emit('open', peers[1].id);
      assertEqual(await second, 'ROOMB');
      oldPeer.emit('error', { type: 'unavailable-id' });
      oldPeer.emit('open', oldPeer.id);
      await first;
      assertTrue(cancelled);
      assertEqual(network.roomCode, 'ROOMB');
      assertEqual(peers.length, 2);
      network.disconnect();
    } finally {
      if (previousWindow === undefined) delete globalThis.window;
      else globalThis.window = previousWindow;
    }
  });
});

class MockRTC extends EventTarget {
  constructor() {
    super();
    this.connectionState = 'connected';
    this.iceConnectionState = 'connected';
    this.listeners = 0;
  }
  addEventListener(...args) { super.addEventListener(...args); this.listeners++; }
  removeEventListener(...args) { super.removeEventListener(...args); this.listeners--; }
  change(connectionState, iceConnectionState = connectionState) {
    this.connectionState = connectionState;
    this.iceConnectionState = iceConnectionState;
    this.dispatchEvent(new Event('connectionstatechange'));
    this.dispatchEvent(new Event('iceconnectionstatechange'));
  }
}
function rtcConnection(id, pc) {
  const handlers = {};
  return { open: true, assignedId: id, peerConnection: pc, send() {},
    on: (type, handler) => { handlers[type] = handler; },
    close() { this.open = false; handlers.close?.(); } };
}

describe('WebRTC transport loss independent of PeerJS close', () => {
  it('drops a failed guest exactly once even when the data channel still reports open', () => {
    const host = new PeerNetwork(null, { authoritativeWorld: true });
    host.isSoloMode = false;
    host.roster = [{ id: 'player_hero_1', heroId: 'knight', isHost: true },
      { id: 'guest', heroId: 'cleric', isHost: false }];
    const game = new GameSimulation({ network: host, roster: host.roster });
    let leaves = 0;
    const originalLeave = host.onPeerLeaveCallback;
    host.onPeerLeaveCallback = player => { leaves++; originalLeave(player); };
    const pc = new MockRTC();
    const connection = rtcConnection('guest', pc);
    host.handleIncomingConnection(connection);
    assertTrue(connection.open);
    pc.change('failed');
    assertEqual(host.connections.length, 0);
    assertEqual(host.roster.length, 1);
    assertFalse(game.entities.some(entity => entity.id === 'guest'));
    assertEqual(leaves, 1);
    assertEqual(pc.listeners, 0);
    pc.change('closed');
    assertEqual(leaves, 1);
  });

  it('gives disconnected RTC six seconds to recover and cleans timers on recovery and shutdown', () => {
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    const timers = [];
    globalThis.setTimeout = (callback, delay) => { const timer = { callback, delay }; timers.push(timer); return timer; };
    globalThis.clearTimeout = timer => { if (timer) timer.cancelled = true; };
    try {
      const guest = new PeerNetwork(null, { authoritativeWorld: true });
      guest.isSoloMode = false;
      guest.isHost = false;
      let losses = 0;
      guest.gameSim = { worldReady: true, onNetworkDisconnect() { losses++; } };
      const pc = new MockRTC();
      const connection = rtcConnection(null, pc);
      guest.connections = [connection];
      guest.watchConnection(connection, true);
      pc.change('disconnected');
      assertEqual(timers.length, 1);
      assertEqual(timers[0].delay, 6000);
      pc.change('connected');
      assertTrue(timers[0].cancelled);
      assertEqual(losses, 0);
      pc.change('disconnected');
      timers[1].callback();
      assertEqual(losses, 1);
      assertEqual(guest.connections.length, 0);
      assertEqual(pc.listeners, 0);
      pc.change('failed');
      assertEqual(losses, 1);
      const freshPc = new MockRTC();
      const fresh = rtcConnection(null, freshPc);
      guest.connections = [fresh];
      guest.watchConnection(fresh, true);
      freshPc.change('disconnected');
      guest.disconnect();
      assertTrue(timers.at(-1).cancelled);
      assertEqual(freshPc.listeners, 0);
      assertEqual(losses, 1);
    } finally {
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearTimeout = originalClearTimeout;
    }
  });
});
