import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue, assertFalse } from '../helpers/assert.js';
import { getBossStatus } from '../../src/ui/hud.js';
import { GameSimulation } from '../../src/game.js';
import { BossManager, NexusGuardianBoss, StoneColossusBoss, AbyssalBehemothBoss } from '../../src/world/boss.js';

describe('Tier 1 Unit: Boss HUD Robustness & Boost Command Mechanics', () => {
  it('TC-BST-01: Boss entities have valid names in the DOM HUD presentation', () => {
    const mgr = new BossManager();
    const sup = mgr.supremeBoss;
    const colossus = new StoneColossusBoss();
    const behemoth = new AbyssalBehemothBoss();

    assertTrue(typeof sup.name === 'string' && sup.name.length > 0, 'Supreme boss must have a name');
    assertTrue(typeof colossus.name === 'string' && colossus.name.length > 0, 'Colossus must have a name');
    assertTrue(typeof behemoth.name === 'string' && behemoth.name.length > 0, 'Behemoth must have a name');

    const view = getBossStatus(mgr.activeBosses);
    assertTrue(view.label.includes('Guardião do Nexus'), 'HUD renders the active boss name');
    assertEqual(view.hp, `${sup.hp} / ${sup.maxHp}`);

  });

  it('TC-BST-02: GameSimulation applyBoost increases speed, damage, and grants bonus gold', () => {
    const sim = new GameSimulation({ heroClass: 'knight' });
    const hero = sim.playerHero;
    const startSpeed = hero.speed;
    const startGold = hero.gold;
    const startAd = hero.attackDamage;

    sim.handleCommand({ type: '/boost' });

    assertTrue(hero.speed > startSpeed, 'Speed should be increased by boost');
    assertTrue(hero.gold >= startGold + 1000, 'Gold should be increased by at least 1000');
    assertTrue(hero.attackDamage > startAd, 'Attack damage should be increased');
  });

  it('TC-BST-03: GameSimulation handleCommand supports CommandType.TOGGLE_SHOP cleanly', () => {
    const sim = new GameSimulation({ heroClass: 'knight' });
    // Headless shopUI is null or safe
    sim.handleCommand({ type: 'TOGGLE_SHOP' });
    assertTrue(true, 'TOGGLE_SHOP executed without error');
  });
});
