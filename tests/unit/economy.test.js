import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue } from '../helpers/assert.js';
import { resolveModule } from '../helpers/module_resolver.js';

describe('Tier 1 Unit: Gold Economy, Passive Income & Objective Bounties', () => {
  it('TC-ECO-01: Initializes each player with exactly 1200 starting gold', async () => {
    const { module: ecoMod } = await resolveModule('systems/economy');
    const heroes = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }];
    const eco = new ecoMod.EconomyManager(heroes);

    assertEqual(eco.getGold('p1'), 1200);
    assertEqual(eco.getGold('p2'), 1200);
    assertEqual(eco.getGold('p3'), 1200);
  });

  it('TC-ECO-02: Passive gold accrual delivers exactly 10 gold per second', async () => {
    const { module: ecoMod } = await resolveModule('systems/economy');
    const eco = new ecoMod.EconomyManager([{ id: 'p1' }]);

    // Advance 0.5s => +5 gold
    eco.updatePassiveGold(0.5);
    assertEqual(eco.getGold('p1'), 1205);

    // Advance 1.0s => +10 gold
    eco.updatePassiveGold(1.0);
    assertEqual(eco.getGold('p1'), 1215);

    // Advance 10.0s => +100 gold
    eco.updatePassiveGold(10.0);
    assertEqual(eco.getGold('p1'), 1315);
  });

  it('TC-ECO-03: Minion last-hits increment gold pouch correctly', async () => {
    const { module: ecoMod } = await resolveModule('systems/economy');
    const eco = new ecoMod.EconomyManager([{ id: 'p1' }]);

    eco.awardLastHit('p1', 21); // Melee
    assertEqual(eco.getGold('p1'), 1221);

    eco.awardLastHit('p1', 14); // Ranged
    assertEqual(eco.getGold('p1'), 1235);

    eco.awardLastHit('p1', 45); // Cannon
    assertEqual(eco.getGold('p1'), 1280);
  });

  it('TC-ECO-04: Tower destruction awards 250g killer bonus and 350g team bounty', async () => {
    const { module: ecoMod } = await resolveModule('systems/economy');
    const eco = new ecoMod.EconomyManager([{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }]);

    // p1 destroys tower
    eco.awardTowerBounty('p1', ['p1', 'p2', 'p3']);

    // p1 gets 250 + 350 = 600
    assertEqual(eco.getGold('p1'), 1200 + 600);
    // p2 and p3 get team bounty 350
    assertEqual(eco.getGold('p2'), 1200 + 350);
    assertEqual(eco.getGold('p3'), 1200 + 350);
  });

  it('TC-ECO-05: Mini-Boss awards 300g killer bonus and 600g team bounty', async () => {
    const { module: ecoMod } = await resolveModule('systems/economy');
    const eco = new ecoMod.EconomyManager([{ id: 'p1' }, { id: 'p2' }]);

    eco.awardBossBounty('p2', ['p1', 'p2'], false);

    assertEqual(eco.getGold('p2'), 1200 + 900); // 300 killer + 600 team
    assertEqual(eco.getGold('p1'), 1200 + 600); // team bounty
  });

  it('TC-ECO-06: Supreme Boss awards 1500g bounty to killer', async () => {
    const { module: ecoMod } = await resolveModule('systems/economy');
    const eco = new ecoMod.EconomyManager([{ id: 'p1' }]);

    eco.awardBossBounty('p1', ['p1'], true);
    assertEqual(eco.getGold('p1'), 1200 + 1500);
  });

  it('TC-ECO-07: Passive gold accrual continues steadily regardless of player state', async () => {
    const { module: ecoMod } = await resolveModule('systems/economy');
    const eco = new ecoMod.EconomyManager([{ id: 'dead_hero' }]);

    // 15 seconds dead
    eco.updatePassiveGold(15.0);
    assertEqual(eco.getGold('dead_hero'), 1200 + 150);
  });
});
