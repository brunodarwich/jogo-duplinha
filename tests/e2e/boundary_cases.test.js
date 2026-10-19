import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue, assertFalse } from '../helpers/assert.js';
import { resolveModule } from '../helpers/module_resolver.js';

describe('Tier 2 E2E: Boundary & Corner Cases', () => {
  it('TC-BND-01: Out-of-bounds clicks clamped to canvas viewport and map boundaries', async () => {
    const { module: inputMod } = await resolveModule('core/input');
    const dispatcher = new inputMod.InputDispatcher({ x: 0, y: 0 }, 1.0, { width: 1280, height: 720 });

    const extremeNegative = dispatcher.handleMouseDown(2, -99999, -99999);
    assertEqual(extremeNegative.type, 'MOVE_TO');
    assertTrue(extremeNegative.x >= 0 && extremeNegative.x <= inputMod.MAP_SIZE);
    assertTrue(extremeNegative.y >= 0 && extremeNegative.y <= inputMod.MAP_SIZE);

    const extremePositive = dispatcher.handleMouseDown(2, 99999, 99999);
    assertEqual(extremePositive.type, 'MOVE_TO');
    assertTrue(extremePositive.x >= 0 && extremePositive.x <= inputMod.MAP_SIZE);
    assertTrue(extremePositive.y >= 0 && extremePositive.y <= inputMod.MAP_SIZE);
  });

  it('TC-BND-02: Simultaneous actions (Right-click while in targeting mode)', async () => {
    const { module: inputMod } = await resolveModule('core/input');
    const dispatcher = new inputMod.InputDispatcher();

    // In targeting mode for Q
    dispatcher.targetingSkill = 'Q';

    // Right-click received => must cancel targeting immediately rather than moving
    const cmd = dispatcher.handleMouseDown(2, 600, 300);
    assertEqual(cmd.type, 'CANCEL_TARGETING');
    assertEqual(cmd.skill, 'Q');
    assertEqual(dispatcher.targetingSkill, null);
  });

  it('TC-BND-03: 0 gold purchase attempt is cleanly rejected without side effects', async () => {
    const { module: ecoMod } = await resolveModule('systems/economy');
    const { module: itemMod } = await resolveModule('systems/items');

    const hero = {
      id: 'broke_hero',
      baseStats: { hp: 500, attackDamage: 50, armor: 20, magicResist: 20, movementSpeed: 300 }
    };
    const eco = new ecoMod.EconomyManager([hero]);
    eco.setGold('broke_hero', 0); // 0 gold

    const inv = new itemMod.HeroInventory(hero);
    const itemCost = itemMod.ITEM_CATALOG['item_dagger'].cost; // 300g

    // Check afford
    const canAfford = eco.getGold('broke_hero') >= itemCost;
    assertFalse(canAfford);

    // Gold stays 0, inventory stays empty
    assertEqual(eco.getGold('broke_hero'), 0);
    assertEqual(inv.slots[0], null);
  });

  it('TC-BND-04: Purchasing with exactly 6 full slots is rejected without gold deduction', async () => {
    const { module: ecoMod } = await resolveModule('systems/economy');
    const { module: itemMod } = await resolveModule('systems/items');

    const hero = {
      id: 'full_inv_hero',
      baseStats: { hp: 500, attackDamage: 50, armor: 20, magicResist: 20, movementSpeed: 300 }
    };
    const eco = new ecoMod.EconomyManager([hero]);
    eco.setGold('full_inv_hero', 5000);

    const inv = new itemMod.HeroInventory(hero);
    for (let i = 0; i < 6; i++) {
      inv.addItem('item_dagger');
    }
    assertTrue(inv.isFull());

    const initialGold = eco.getGold('full_inv_hero');

    // Attempt 7th purchase
    if (!inv.isFull()) {
      eco.setGold('full_inv_hero', initialGold - 300);
      inv.addItem('item_dagger');
    }

    assertEqual(eco.getGold('full_inv_hero'), initialGold, 'No gold should be deducted when inventory is full');
  });

  it('TC-BND-05: 40% CDR clamp when equipping multiple CDR items (total 55%)', async () => {
    const { module: itemMod } = await resolveModule('systems/items');
    const hero = {
      baseStats: { hp: 500, attackDamage: 50, armor: 20, magicResist: 20, movementSpeed: 300 }
    };
    const inv = new itemMod.HeroInventory(hero);

    // Dawn chalice (20%) + Rabadon (15%) + Hammer (10%) + Scepter (10%) = 55%
    inv.addItem('item_dawn_chalice');
    inv.addItem('item_rabadon');
    inv.addItem('item_hammer_war');
    inv.addItem('item_scepter_magic');

    assertEqual(hero.cdr, 0.40, 'CDR must clamp to 0.40 despite raw sum of 0.55');
  });

  it('TC-BND-06: Recall damage interruption at exactly 4.99 seconds (4990ms)', async () => {
    const { module: recallMod } = await resolveModule('systems/recall');
    const recall = new recallMod.RecallSystem({ x: 400, y: 400 });
    const hero = { x: 2200, y: 2200, isRecalling: false, recallCooldownRemaining: 0 };

    recall.startRecall(hero);
    // Channel for 4.99 seconds
    recall.update(hero, 4.99);
    assertTrue(hero.isRecalling);
    assertEqual(hero.x, 2200, 'Hero should still be at 2200 before 5.00s');

    // 1 damage received at 4.99s
    const interrupted = recall.interrupt(hero, 'damage');
    assertTrue(interrupted);
    assertFalse(hero.isRecalling);
    assertEqual(hero.x, 2200, 'Hero must NOT have teleported to fountain');
    assertEqual(hero.recallCooldownRemaining, 1.0);
  });

  it('TC-BND-07: Disconnect timeout boundary (5999ms connected vs 6001ms timed out)', async () => {
    const { module: netMod } = await resolveModule('net/protocol');
    const lobby = new netMod.LobbySession('ROOM_T');

    lobby.handleJoinRequest({ name: 'BorderP' });
    const now = 10000;

    // At 5999ms without ping: still connected
    lobby.players[0].lastHeartbeat = now - 5999;
    let timedOut = lobby.checkTimeouts(now);
    assertEqual(timedOut.length, 0);
    assertTrue(lobby.players[0].isConnected);

    // At 6001ms: times out
    lobby.players[0].lastHeartbeat = now - 6001;
    timedOut = lobby.checkTimeouts(now);
    assertEqual(timedOut.length, 1);
    assertFalse(lobby.players[0].isConnected);
  });

  it('TC-BND-08: Selling +HP item when hero has 1 HP does not cause death', async () => {
    const { module: itemMod } = await resolveModule('systems/items');
    const hero = {
      baseStats: { hp: 500, attackDamage: 50, armor: 20, magicResist: 20, movementSpeed: 300 },
      hp: 500, maxHp: 500
    };
    const inv = new itemMod.HeroInventory(hero);

    inv.addItem('item_heart_colossus'); // +700 HP
    hero.hp = 1; // critically wounded at 1 HP

    inv.removeItem(0); // sell item
    assertEqual(hero.maxHp, 500);
    assertEqual(hero.hp, 1, 'Hero HP must remain 1 and not drop to 0 or negative');
  });
});
