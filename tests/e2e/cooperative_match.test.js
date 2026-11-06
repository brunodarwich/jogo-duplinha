import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue, assertFalse } from '../helpers/assert.js';
import { PeerNetwork } from '../../src/net/peer_network.js';
import { WORLD_PROTOCOL_VERSION } from '../../src/net/world_state.js';
import { GameSimulation } from '../../src/game.js';

function trio(guestCount = 2, firstHero = 'sorceress') {
  const host = new PeerNetwork(null, { authoritativeWorld: true });
  host.isSoloMode = false;
  host.isHost = true;
  host.roster = [{ id: 'player_hero_1', heroId: 'knight', name: 'Host', isHost: true }];
  const sim = new GameSimulation({ network: host, roster: host.roster });
  const clients = [];
  function join(heroId) {
    const network = new PeerNetwork(null, { authoritativeWorld: true });
    network.isSoloMode = false;
    network.isHost = false;
    const clone = packet => JSON.parse(JSON.stringify(packet));
    const serverConnection = { open: true,
      send: packet => network.handleData(clone(packet), clientConnection), close() { this.open = false; } };
    const clientConnection = { open: true,
      send: packet => host.handleData(clone(packet), serverConnection), close() { this.open = false; } };
    network.connections.push(clientConnection);
    host.handleData({ type: 'JOIN_REQUEST', protocolVersion: WORLD_PROTOCOL_VERSION,
      authoritativeWorld: true, name: heroId, heroId }, serverConnection);
    const game = new GameSimulation({ network, isHost: false, roster: network.roster, heroClass: heroId });
    clients.push({ network, game, serverConnection });
    return clients.at(-1);
  }
  join(firstHero);
  if (guestCount > 1) join('cleric');
  host.startMatch();
  return { host, sim, clients, join };
}

describe('Cooperative match through real simulation commands', () => {
  it('keeps the selected unit identity when targets overlap and rejects guest training commands', () => {
    const { host, sim, clients } = trio(1, 'assassin');
    const guest = clients[0];
    const hero = sim.entities.find(e => e.id === guest.network.myPlayerId);
    hero.abilities.Q.rank = 1;
    const targets = sim.entities.filter(e => e.type === 'minion' && e.team === 'enemy');
    for (const target of targets) {
      target.x = hero.x + 80;
      target.y = hero.y;
      target.hp = target.maxHp = 10000;
      target.armor = 0;
    }
    host.publishWorldState();
    const gold = hero.gold;
    assertFalse(guest.network.sendCommand({ type: 'GOLD' }).success);
    assertFalse(guest.network.sendCommand({ type: 'BOOST' }).success);
    assertEqual(hero.gold, gold);
    assertTrue(guest.network.sendCommand({ type: 'CAST_SKILL', slot: 'Q',
      targetEntityId: targets[1].id, targetX: targets[1].x, targetY: targets[1].y }).success);
    assertEqual(targets[0].hp, 10000);
    assertTrue(targets[1].hp < 10000);
  });

  it('shares purchases, ranks, movement and skill kills across three independent simulations', () => {
    const { host, sim, clients } = trio();
    const guest = clients[0];
    const guestHero = sim.entities.find(e => e.id === guest.network.myPlayerId);
    const localReference = guest.game.playerHero;
    assertTrue(guest.game.worldReady);
    assertTrue(guest.game.handleCommand({ type: 'BUY_ITEM', itemId: 'item_dagger' }));
    assertEqual(guestHero.gold, 900);
    assertTrue(guest.game.handleCommand({ type: 'UPGRADE_ABILITY', slot: 'Q' }));
    assertEqual(guestHero.abilities.Q.rank, 1);
    guest.game.handleCommand({ type: 'SELL_ITEM', slot: 0 });
    assertEqual(guestHero.gold, 1110);
    guest.game.handleCommand({ type: 'MOVE_TO', x: 1000, y: 1000 });
    const startX = guestHero.x;
    for (let frame = 0; frame < 30; frame++) sim.update(1 / 60, frame);
    assertTrue(guestHero.x > startX);
    const target = sim.entities.find(e => e.type === 'minion' && e.team === 'enemy');
    target.x = guestHero.x + 80;
    target.y = guestHero.y;
    target.hp = 1;
    target.armor = 0;
    target.magicResist = 0;
    host.publishWorldState();
    const hostGold = sim.playerHero.gold;
    const beforeKill = guestHero.gold;
    guest.game.handleCommand({ type: 'CAST_SKILL', slot: 'Q', targetX: target.x, targetY: target.y });
    assertTrue(target.hp <= 0);
    assertEqual(guestHero.gold - beforeKill, target.bounty);
    assertEqual(sim.playerHero.gold - hostGold, Math.floor(target.bounty * 0.30));
    host.publishWorldState();
    for (const client of clients) {
      const observed = client.game.entities.find(e => e.id === guestHero.id);
      assertEqual(observed.gold, guestHero.gold);
      assertEqual(observed.abilities.Q.rank, guestHero.abilities.Q.rank);
      assertEqual(observed.x, guestHero.x);
      assertEqual(observed.mana, guestHero.mana);
    }
    assertEqual(guest.game.playerHero, localReference);
  });

  it('keeps clients from advancing AI/economy, then converges on terminal state and late-entry state', () => {
    const { host, sim, clients, join } = trio(1);
    const client = clients[0].game;
    const ids = client.entities.map(e => e.id).join(',');
    const time = client.matchTime;
    const gold = client.playerHero.gold;
    for (let frame = 0; frame < 120; frame++) client.update(1 / 60, frame);
    assertEqual(client.matchTime, time);
    assertEqual(client.playerHero.gold, gold);
    assertEqual(client.entities.map(e => e.id).join(','), ids);
    for (let frame = 0; frame < 120; frame++) sim.update(1 / 60, frame);
    sim.playerHero.gold = 4321;
    const late = join('cleric');
    host.publishWorldState();
    assertTrue(late.game.worldReady);
    assertEqual(late.game.matchTime, sim.matchTime);
    assertEqual(late.game.entities.find(e => e.id === sim.playerHero.id).gold, 4321);
    assertEqual(late.game.entities.map(e => e.id).join(','), sim.entities.map(e => e.id).join(','));
    sim.enemyNexus.hp = 0;
    sim.update(1 / 60);
    host.publishWorldState();
    for (const observer of clients) {
      assertTrue(observer.game.isVictory);
      assertEqual(observer.game.enemyNexus.hp, 0);
      assertFalse(observer.game.isDefeat);
    }
  });
});
