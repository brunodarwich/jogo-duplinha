import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue, assertFalse } from '../helpers/assert.js';
import { GameSimulation } from '../../src/game.js';

function host() {
  const sim = new GameSimulation({ roster: [{ id: 'player_remote_2', heroId: 'sorceress' }] });
  sim.network = { authoritativeWorld: true, isSoloMode: false, broadcast() {} };
  return sim;
}
describe('Authoritative game commands', () => {
  it('moves the identified remote hero without changing the local player', () => {
    const sim = host(), local = sim.playerHero;
    const remote = sim.remoteHeroes.get('player_remote_2');
    assertTrue(sim.handlePlayerCommand(remote.id, { type: 'MOVE_TO', x: 900, y: 900 }));
    assertEqual(local.targetX, null);
    assertEqual(remote.targetX, 900);
    assertFalse(sim.handlePlayerCommand(remote.id, { type: 'MOVE_TO', x: NaN, y: 900 }));
  });
  it('validates remote purchases and upgrades on the owning hero', () => {
    const sim = host(), remote = sim.remoteHeroes.get('player_remote_2'), localGold = sim.playerHero.gold;
    assertTrue(sim.handlePlayerCommand(remote.id, { type: 'BUY_ITEM', itemId: 'item_dagger' }));
    assertTrue(remote.gold < 1200);
    assertEqual(sim.playerHero.gold, localGold);
    remote.x = remote.y = 1500;
    assertFalse(sim.handlePlayerCommand(remote.id, { type: 'BUY_ITEM', itemId: 'item_dagger' }));
    assertTrue(sim.handlePlayerCommand(remote.id, { type: 'UPGRADE_ABILITY', slot: 'Q' }));
    assertEqual(remote.abilities.Q.rank, 1);
    assertEqual(sim.playerHero.abilities.Q.rank, 0);
    assertFalse(sim.handlePlayerCommand(remote.id, { type: 'BOOST' }));
  });
  it('never advances the guest world or gold without host snapshots', () => {
    const sim = host();
    sim.isHost = false;
    const time = sim.matchTime, gold = sim.playerHero.gold;
    for (let i = 0; i < 120; i++) sim.update(1 / 60, i);
    assertEqual(sim.matchTime, time);
    assertEqual(sim.playerHero.gold, gold);
  });
  it('removes tooltip listeners when a match is stopped', () => {
    const sim = new GameSimulation();
    const priorDocument = globalThis.document;
    const listeners = new Map();
    const button = {
      querySelector() { return null; },
      addEventListener(type, fn) { listeners.set(type, fn); },
      removeEventListener(type, fn) { if (listeners.get(type) === fn) listeners.delete(type); }
    };
    try {
      globalThis.document = { getElementById: id => id === 'ability-q' ? button : null };
      sim.updateHUDForHero({}, sim.playerHero.abilities);
      assertEqual(listeners.size, 4);
      sim.stop();
      assertEqual(listeners.size, 0);
    } finally {
      if (priorDocument === undefined) delete globalThis.document; else globalThis.document = priorDocument;
    }
  });
});
