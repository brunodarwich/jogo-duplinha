import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue } from '../helpers/assert.js';
import { GameSimulation } from '../../src/game.js';
import { accruePassiveGold } from '../../src/systems/economy.js';
import { HeroEntity } from '../../src/entities/entity.js';
import { ITEM_CATALOG } from '../../src/systems/items.js';
import { ShopUI } from '../../src/ui/shop_ui.js';

describe('Accelerated live economy', () => {
  it('Allows purchases at the nexus spawn and rejects the combat lane', () => {
    const hero = { x: 650, y: 650 };
    const shop = new ShopUI({ playerHero: hero });
    assertTrue(shop.isOpenShopZone());
    hero.x = 1250;
    hero.y = 1250;
    assertEqual(shop.isOpenShopZone(), false);
  });
  it('Funds a mid-tier item or a three-piece starting loadout', () => {
    const hero = new HeroEntity();
    assertEqual(hero.gold, 1200);
    assertTrue(hero.gold >= ITEM_CATALOG.item_hammer_war.cost);
    assertTrue(hero.gold >= ITEM_CATALOG.item_dagger.cost + ITEM_CATALOG.item_boots_1.cost + ITEM_CATALOG.item_ruby.cost);
  });

  it('Preserves fractional income and purchases without restoring spent gold', () => {
    const hero = { gold: 1200 };
    for (let i = 0; i < 600; i++) accruePassiveGold(hero, 1 / 60);
    assertEqual(hero.gold, 1300);
    hero.gold -= 1200;
    accruePassiveGold(hero, 1);
    assertEqual(hero.gold, 110);
    accruePassiveGold(hero, NaN);
    accruePassiveGold(hero, -1);
    assertEqual(hero.gold, 110);
  });

  it('Applies income in the real game loop, including death, and stops after victory', () => {
    const game = new GameSimulation();
    const start = game.playerHero.gold;
    game.update(0.5);
    assertEqual(game.playerHero.gold, start + 5);
    assertTrue(game.shopUI.isOpenShopZone());
    game.playerHero.hp = 0;
    game.playerHero.isDead = true;
    game.update(0.5);
    assertEqual(game.playerHero.gold, start + 10);
    game.isVictory = true;
    game.update(0.5);
    assertEqual(game.playerHero.gold, start + 10);
  });
});
