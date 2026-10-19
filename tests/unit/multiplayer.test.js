import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue, assertFalse } from '../helpers/assert.js';
import { PeerNetwork } from '../../src/net/peer_network.js';
import { GameSimulation } from '../../src/game.js';

describe('Tier 1 Unit: Multiplayer Architecture & Real-Time Sync', () => {
  it('TC-MP-01: Handshake exchanges JOIN_REQUEST, JOIN_ACCEPT, assigns client ID and shares roster', async () => {
    const { host, client } = PeerNetwork.createMockPair('ROOM99', 'knight', 'sorceress');

    let clientReceivedRoster = null;
    client.onRosterChangeCallback = (roster) => {
      clientReceivedRoster = roster;
    };

    // Client sends handshake request
    client.broadcast({
      type: 'JOIN_REQUEST',
      name: 'Maga Amiga',
      heroId: 'sorceress'
    });

    // Wait a tick for microtask delivery
    await new Promise(r => setTimeout(r, 20));

    // Verify Host registered player in roster
    assertEqual(host.roster.length, 2);
    assertEqual(host.roster[0].id, 'player_hero_1');
    assertEqual(host.roster[0].isHost, true);
    assertEqual(host.roster[1].heroId, 'sorceress');
    assertEqual(host.roster[1].name, 'Maga Amiga');

    // Verify Client received assigned ID and roster
    assertEqual(client.myPlayerId, 'player_remote_2');
    assertTrue(Array.isArray(clientReceivedRoster), 'Client must have received roster');
    assertEqual(clientReceivedRoster.length, 2);
  });

  it('TC-MP-02: Live hero selection and match start synchronization', async () => {
    const { host, client } = PeerNetwork.createMockPair('ROOM77', 'knight', 'sorceress');

    // Simulate joined state
    host.roster.push({ id: 'player_remote_2', name: 'Aliado', heroId: 'sorceress', isHost: false });
    client.myPlayerId = 'player_remote_2';

    let matchStartedRoster = null;
    client.onMatchStartCallback = (roster) => {
      matchStartedRoster = roster;
    };

    // Client switches hero to Ranger
    client.sendHeroSelect('ranger');
    await new Promise(r => setTimeout(r, 20));

    assertEqual(host.roster[1].heroId, 'ranger', 'Host must have updated client hero to ranger');

    // Host starts match
    host.startMatch();
    await new Promise(r => setTimeout(r, 20));

    assertTrue(matchStartedRoster !== null, 'Client must have received START_MATCH event');
    assertEqual(matchStartedRoster.length, 2);
  });

  it('TC-MP-03: GameSimulation spawns both local hero and remote HeroEntity from roster', () => {
    const roster = [
      { id: 'player_hero_1', heroId: 'knight', name: 'Host (Cavaleiro)', isHost: true },
      { id: 'player_remote_2', heroId: 'sorceress', name: 'Aliado (Maga)', isHost: false }
    ];

    // Host simulation
    const hostSim = new GameSimulation({
      heroClass: 'knight',
      roster,
      isHost: true
    });

    assertEqual(hostSim.playerHero.id, 'player_hero_1');
    assertTrue(hostSim.playerHero.isLocalPlayer);
    assertEqual(hostSim.playerHero.heroId, 'knight');

    // Verify remote hero was spawned
    const remoteOnHost = hostSim.entities.find(e => e.id === 'player_remote_2');
    assertTrue(!!remoteOnHost, 'Remote hero must exist in entities list on host');
    assertEqual(remoteOnHost.heroId, 'sorceress');
    assertFalse(remoteOnHost.isLocalPlayer);
    assertEqual(remoteOnHost.team, 'allied');
    assertEqual(remoteOnHost.type, 'hero');

    // Client simulation
    const mockNet = new PeerNetwork();
    mockNet.myPlayerId = 'player_remote_2';
    const clientSim = new GameSimulation({
      heroClass: 'sorceress',
      roster,
      isHost: false,
      network: mockNet
    });

    assertEqual(clientSim.playerHero.id, 'player_remote_2');
    assertTrue(clientSim.playerHero.isLocalPlayer);
    const hostOnClient = clientSim.entities.find(e => e.id === 'player_hero_1');
    assertTrue(!!hostOnClient, 'Host hero must exist as remote ally on client');
    assertFalse(hostOnClient.isLocalPlayer);
  });

  it('TC-MP-04: 20Hz HERO_UPDATE state sync interpolates position and updates status', () => {
    const roster = [
      { id: 'player_hero_1', heroId: 'knight', name: 'Host', isHost: true },
      { id: 'player_remote_2', heroId: 'sorceress', name: 'Aliado', isHost: false }
    ];

    const hostSim = new GameSimulation({
      heroClass: 'knight',
      roster,
      isHost: true
    });

    const remoteHero = hostSim.entities.find(e => e.id === 'player_remote_2');
    assertTrue(!!remoteHero);

    // Simulate receiving 20Hz update from remote player
    hostSim.handleRemoteHeroUpdate({
      id: 'player_remote_2',
      x: 750,
      y: 720,
      facing: 1.57,
      hp: 450,
      maxHp: 600,
      mana: 120,
      maxMana: 300,
      isRecalling: true,
      speed: 350
    });

    assertEqual(remoteHero.targetX, 750);
    assertEqual(remoteHero.targetY, 720);
    assertEqual(remoteHero.hp, 450);
    assertEqual(remoteHero.mana, 120);
    assertEqual(remoteHero.isRecalling, true);
    assertEqual(remoteHero.facing, 1.57);

    // Teleport snapping on large jump (>180 units)
    hostSim.handleRemoteHeroUpdate({
      id: 'player_remote_2',
      x: 2000,
      y: 2000,
      hp: 400
    });
    assertEqual(remoteHero.x, 2000, 'Large jump must immediately snap position');
    assertEqual(remoteHero.y, 2000);
  });

  it('TC-MP-05: CAST_SKILL and /boost chat commands synchronize effects between players', () => {
    const roster = [
      { id: 'player_hero_1', heroId: 'knight', name: 'Host', isHost: true },
      { id: 'player_remote_2', heroId: 'sorceress', name: 'Aliado', isHost: false }
    ];

    const hostSim = new GameSimulation({
      heroClass: 'knight',
      roster,
      isHost: true
    });

    const remoteHero = hostSim.entities.find(e => e.id === 'player_remote_2');
    assertTrue(!!remoteHero);

    // Remote cast Sorceress Fireball (Q)
    const startMana = remoteHero.mana;
    hostSim.handleRemoteCast({
      heroId: 'player_remote_2',
      slot: 'Q',
      targetX: 1000,
      targetY: 1000
    });

    assertTrue(remoteHero.mana < startMana, 'Remote cast must consume caster mana');
    assertTrue(remoteHero.abilities.Q.cooldownRemaining > 0, 'Remote cast must start cooldown');

    // Remote /boost chat command sync
    const startSpeed = remoteHero.speed;
    const startAd = remoteHero.attackDamage;
    hostSim.handleRemoteChatCommand({
      command: 'boost',
      senderId: 'player_remote_2'
    });

    assertTrue(remoteHero.speed > startSpeed, 'Remote hero speed boosted');
    assertTrue(remoteHero.attackDamage > startAd, 'Remote hero damage boosted');
  });

  it('TC-MP-06: Late-joining client immediately receives START_MATCH if host already launched match', async () => {
    const { host, client } = PeerNetwork.createMockPair('ROOM88', 'knight', 'sorceress');

    // Host launches match beforehand
    host.startMatch();
    assertTrue(host.isMatchStarted, 'Host match must be flagged as started');

    let clientReceivedMatchStart = false;
    client.onMatchStartCallback = () => {
      clientReceivedMatchStart = true;
    };

    // Late client connects
    client.broadcast({
      type: 'JOIN_REQUEST',
      name: 'Amigo Atrasado',
      heroId: 'cleric'
    });

    await new Promise(r => setTimeout(r, 20));

    assertTrue(clientReceivedMatchStart, 'Late-joining client must receive START_MATCH immediately upon join');
  });

  it('TC-MP-07: Remote hero position is immune to autonomous local pursuit during combat update', () => {
    const roster = [
      { id: 'player_hero_1', heroId: 'knight', name: 'Host', isHost: true },
      { id: 'player_remote_2', heroId: 'sorceress', name: 'Aliado', isHost: false }
    ];

    const hostSim = new GameSimulation({
      heroClass: 'knight',
      roster,
      isHost: true
    });

    const remoteHero = hostSim.entities.find(e => e.id === 'player_remote_2');
    assertTrue(!!remoteHero);
    const initialX = remoteHero.x;
    const initialY = remoteHero.y;

    // Simulate an enemy far away
    const farEnemy = {
      id: 'far_enemy',
      team: 'enemy',
      x: initialX + 500,
      y: initialY + 500,
      radius: 20,
      isAlive: () => true
    };
    remoteHero.attackTarget = farEnemy;

    // Run combat update on remote hero
    hostSim.updateHeroCombat(0.016, remoteHero);

    // Verify remote hero DID NOT move or pursue enemy
    assertEqual(remoteHero.x, initialX, 'Remote hero must not move autonomously to pursue enemy');
    assertEqual(remoteHero.y, initialY, 'Remote hero must not move autonomously to pursue enemy');
    assertEqual(remoteHero.attackTarget, null, 'Out of range target for remote hero must be discarded without moving');
  });
});
