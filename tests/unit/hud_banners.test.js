import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue, assertFalse } from '../helpers/assert.js';
import { resolveModule } from '../helpers/module_resolver.js';

describe('Tier 1 Unit: Dynamic Event Banners & HUD Polish (M1 / R1)', () => {
  it('TC-BNR-01: EventBannerManager initialization and headless safety', async () => {
    const { module: bannerMod } = await resolveModule('ui/event_banners');
    assertEqual(typeof bannerMod.EventBannerManager, 'function', 'EventBannerManager must be exported');
    assertEqual(typeof bannerMod.BANNER_PRIORITY, 'object', 'BANNER_PRIORITY must be exported');

    const mgr = new bannerMod.EventBannerManager();
    assertEqual(mgr.queue.length, 0, 'Initial queue must be empty');
    assertEqual(mgr.currentBanner, null, 'Initial active banner must be null');
    assertEqual(mgr.history.length, 0, 'Initial history must be empty');

    // Safe clear invocation in headless mode
    mgr.clear();
    assertEqual(mgr.queue.length, 0);
    assertEqual(mgr.currentBanner, null);
  });

  it('TC-BNR-02: Banner creation for each event type with corresponding priorities', async () => {
    const { module: bannerMod } = await resolveModule('ui/event_banners');
    const mgr = new bannerMod.EventBannerManager();

    // 1. Victory / Defeat (Priority 1)
    const vic = mgr.showVictoryBanner({ message: 'Cristal Inimigo destruído!' });
    assertEqual(vic.type, 'victory');
    assertEqual(vic.priority, bannerMod.BANNER_PRIORITY.VICTORY);
    assertEqual(vic.priority, 1);
    mgr.clear();

    const def = mgr.showDefeatBanner({ message: 'Cristal Aliado ruiu!' });
    assertEqual(def.type, 'defeat');
    assertEqual(def.priority, bannerMod.BANNER_PRIORITY.DEFEAT);
    assertEqual(def.priority, 1);
    mgr.clear();

    // 2. Boss Spawn / Slain (Priority 2)
    const bSpawn = mgr.announceBossSpawn('Stone Colossus', 5);
    assertEqual(bSpawn.type, 'boss_spawn');
    assertEqual(bSpawn.priority, bannerMod.BANNER_PRIORITY.BOSS_SPAWN);
    assertEqual(bSpawn.priority, 2);
    assertTrue(bSpawn.subtitle.includes('Stone Colossus'));
    mgr.clear();

    const bSlain = mgr.announceBossSlain('Stone Colossus', 'allied', 'Knight');
    assertEqual(bSlain.type, 'boss_slain');
    assertEqual(bSlain.priority, bannerMod.BANNER_PRIORITY.BOSS_SLAIN);
    assertEqual(bSlain.priority, 2);
    mgr.clear();

    // 3. First Blood (Priority 3)
    const fb = mgr.announceFirstBlood('Knight', 'Sorceress', 'allied');
    assertEqual(fb.type, 'first_blood');
    assertEqual(fb.priority, bannerMod.BANNER_PRIORITY.FIRST_BLOOD);
    assertEqual(fb.priority, 3);
    assertEqual(fb.icon, '🩸');
    mgr.clear();

    // 4. Tower Destroyed (Priority 4)
    const tow = mgr.announceTowerDestroyed('enemy', 'Knight');
    assertEqual(tow.type, 'tower');
    assertEqual(tow.priority, bannerMod.BANNER_PRIORITY.TOWER_DESTROYED);
    assertEqual(tow.priority, 4);
    mgr.clear();

    // 5. Kill Streaks (Priority 5)
    const streak = mgr.announceKill('Knight', 'Ranger', { streak: 3, streakName: 'FÚRIA ASSASSINA!' });
    assertEqual(streak.type, 'kill_streak');
    assertEqual(streak.priority, bannerMod.BANNER_PRIORITY.KILL_STREAK);
    assertEqual(streak.priority, 5);
    assertEqual(streak.title, 'FÚRIA ASSASSINA!');
    mgr.clear();

    // 6. Normal Kill (Priority 6)
    const kill = mgr.announceKill('Knight', 'Cleric', { streak: 1 });
    assertEqual(kill.type, 'kill');
    assertEqual(kill.priority, bannerMod.BANNER_PRIORITY.KILL);
    assertEqual(kill.priority, 6);
    assertEqual(kill.title, 'INIMIGO ABATIDO!');
    mgr.clear();
  });

  it('TC-BNR-03: Priority Queue correctly sorts events by priority (1 to 6)', async () => {
    const { module: bannerMod } = await resolveModule('ui/event_banners');
    const mgr = new bannerMod.EventBannerManager();

    // Fill queue directly via _enqueue to test sorting
    const kill = { type: 'kill', priority: 6, timestamp: 100 };
    const tower = { type: 'tower', priority: 4, timestamp: 101 };
    const firstBlood = { type: 'first_blood', priority: 3, timestamp: 102 };
    const boss = { type: 'boss_spawn', priority: 2, timestamp: 103 };
    const victory = { type: 'victory', priority: 1, timestamp: 104 };

    mgr._enqueue(kill);
    mgr._enqueue(victory);
    mgr._enqueue(tower);
    mgr._enqueue(boss);
    mgr._enqueue(firstBlood);

    assertEqual(mgr.queue.length, 5);
    assertEqual(mgr.queue[0].type, 'victory', 'Priority 1 must be at the head of the queue');
    assertEqual(mgr.queue[1].type, 'boss_spawn', 'Priority 2 must be second');
    assertEqual(mgr.queue[2].type, 'first_blood', 'Priority 3 must be third');
    assertEqual(mgr.queue[3].type, 'tower', 'Priority 4 must be fourth');
    assertEqual(mgr.queue[4].type, 'kill', 'Priority 6 must be last');
  });

  it('TC-BNR-04: Higher priority banner preempts currently active lower priority banner', async () => {
    const { module: bannerMod } = await resolveModule('ui/event_banners');
    const mgr = new bannerMod.EventBannerManager();

    // Display a normal kill banner (Priority 6)
    mgr.showBanner({ type: 'kill', priority: 6, title: 'Inimigo Abatido' });
    assertEqual(mgr.currentBanner.type, 'kill');

    // Trigger Boss Spawn (Priority 2) -> Should preempt active banner
    mgr.showBanner({ type: 'boss_spawn', priority: 2, title: 'Boss Surgiu' });
    assertEqual(mgr.currentBanner.type, 'boss_spawn', 'Boss banner must preempt lower-priority kill');

    // Preempted banner must be preserved in queue to play next
    assertEqual(mgr.queue.length, 1);
    assertEqual(mgr.queue[0].type, 'kill', 'Preempted banner must be re-queued');

    mgr.clear();
  });

  it('TC-BNR-05: Timeout dismissal and queue progression', async () => {
    const { module: bannerMod } = await resolveModule('ui/event_banners');
    const mgr = new bannerMod.EventBannerManager();

    // Show higher priority first (30ms), then lower priority (150ms) so it queues without preemption
    mgr.showBanner({ type: 'tower', duration: 30 });
    mgr.showBanner({ type: 'kill', duration: 150 });

    assertEqual(mgr.currentBanner.type, 'tower');
    assertEqual(mgr.queue.length, 1);
    assertEqual(mgr.queue[0].type, 'kill');

    // Wait 50ms for first banner to dismiss (30ms < 50ms < 180ms)
    await new Promise(resolve => setTimeout(resolve, 50));

    assertEqual(mgr.currentBanner.type, 'kill', 'Queue must advance to next banner');

    // Wait 150ms for second banner to finish
    await new Promise(resolve => setTimeout(resolve, 150));
    assertEqual(mgr.currentBanner, null, 'Active banner must be cleared when queue empties');

    mgr.clear();
  });

  it('TC-BNR-06: DOM rendering when document container is present', async () => {
    const { module: bannerMod } = await resolveModule('ui/event_banners');

    // Lightweight DOM mock
    const containerMock = {
      children: [],
      appendChild(child) {
        this.children.push(child);
      }
    };

    const prevDoc = globalThis.document;
    try {
      globalThis.document = {
        createElement(tag) {
          return {
            tagName: tag,
            className: '',
            innerHTML: '',
            classList: {
              classes: new Set(),
              add(c) { this.classes.add(c); },
              remove(c) { this.classes.delete(c); },
              contains(c) { return this.classes.has(c); }
            },
            remove() {
              const idx = containerMock.children.indexOf(this);
              if (idx >= 0) containerMock.children.splice(idx, 1);
            }
          };
        },
        contains() { return true; },
        getElementById(id) {
          if (id === 'event-banner-container') return containerMock;
          return null;
        }
      };

      const mgr = new bannerMod.EventBannerManager(containerMock);
      mgr.announceFirstBlood('Knight', 'Sorceress', 'allied');

      assertEqual(containerMock.children.length, 1, 'Banner DOM element must be appended');
      const el = containerMock.children[0];
      assertTrue(el.className.includes('event-banner'));
      assertTrue(el.className.includes('first_blood'));
      assertTrue(el.innerHTML.includes('PRIMEIRO ABATE!'));

      mgr.clear();
      assertEqual(containerMock.children.length, 0, 'Clear must remove banner DOM element');
    } finally {
      globalThis.document = prevDoc;
    }
  });

  it('TC-BNR-07: HUDController Low HP critical pulse class application', async () => {
    const { module: hudMod } = await resolveModule('ui/hud');
    const hud = new hudMod.HUDController();

    const hpContainerMock = {
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        contains(c) { return this.classes.has(c); }
      }
    };
    const hpFillMock = {
      style: {},
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        contains(c) { return this.classes.has(c); }
      }
    };

    hud.elements = {
      hpContainer: hpContainerMock,
      hpFill: hpFillMock,
      hpText: { textContent: '' }
    };

    const prevDoc = globalThis.document;
    try {
      globalThis.document = {}; // satisfy typeof document !== 'undefined'

      // Low HP (15% <= 25%)
      const lowHpHero = { hp: 150, maxHp: 1000, isDead: false };
      hud.update(lowHpHero, null);
      assertTrue(hpContainerMock.classList.contains('critical'), 'Critical class must be added when HP <= 25%');
      assertTrue(hpFillMock.classList.contains('critical'), 'Critical class must be added to fill when HP <= 25%');

      // Safe HP (60% > 25%)
      const safeHpHero = { hp: 600, maxHp: 1000, isDead: false };
      hud.update(safeHpHero, null);
      assertFalse(hpContainerMock.classList.contains('critical'), 'Critical class must be removed when HP > 25%');
      assertFalse(hpFillMock.classList.contains('critical'), 'Critical class must be removed from fill when HP > 25%');
    } finally {
      globalThis.document = prevDoc;
    }
  });

  it('TC-BNR-08: HUDController Ability ready-burst detection on cooldown expiry', async () => {
    const { module: hudMod } = await resolveModule('ui/hud');
    const hud = new hudMod.HUDController();

    const slotElMock = {
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        contains(c) { return this.classes.has(c); }
      },
      querySelector() {
        return { style: { setProperty() {} }, textContent: '' };
      }
    };

    hud.elements = {
      abilityQ: slotElMock
    };

    const hero = {
      hp: 1000,
      maxHp: 1000,
      mana: 500,
      maxMana: 500,
      abilities: {
        Q: { cooldown: 8.0, cooldownRemaining: 3.0, manaCost: 50 }
      }
    };

    const prevDoc = globalThis.document;
    try {
      globalThis.document = {}; // satisfy typeof document !== 'undefined'

      // First tick: On cooldown
      hud.update(hero, null);
      assertTrue(slotElMock.classList.contains('cooldown-active'));
      assertFalse(slotElMock.classList.contains('ready-burst'));

      // Second tick: Cooldown completes (reaches 0)
      hero.abilities.Q.cooldownRemaining = 0;
      hud.update(hero, null);
      assertFalse(slotElMock.classList.contains('cooldown-active'));
      assertTrue(slotElMock.classList.contains('ready-burst'), 'Ready-burst must trigger when cooldown completes');
    } finally {
      globalThis.document = prevDoc;
    }
  });

  it('TC-BNR-09: ShopUI formatStatChips and inventory slot tier synchronization', async () => {
    const { module: shopMod } = await resolveModule('ui/shop_ui');
    assertEqual(typeof shopMod.formatStatChips, 'function', 'formatStatChips must be exported');

    const chips = shopMod.formatStatChips({
      attackDamage: 35,
      hp: 300,
      cdr: 0.10
    });

    assertTrue(chips.includes('+35 AD'));
    assertTrue(chips.includes('+300 HP'));
    assertTrue(chips.includes('+10% CDR'));

    // Test tier styling in updateHUDInventory
    const slotMock = {
      innerHTML: '',
      classList: {
        classes: new Set(),
        add(...c) { c.forEach(cls => this.classes.add(cls)); },
        remove(...c) { c.forEach(cls => this.classes.delete(cls)); },
        contains(c) { return this.classes.has(c); }
      }
    };

    const fakeGame = {
      playerHero: {
        inventoryInstance: {
          getItem(idx) {
            if (idx === 0) return { name: 'Item Épico', tier: 2, icon: '⚔️', description: 'Desc' };
            return null;
          }
        }
      }
    };

    // Instantiate shop without document so initUI returns cleanly
    const shop = new shopMod.ShopUI(fakeGame);

    const prevDoc = globalThis.document;
    try {
      globalThis.document = {
        querySelectorAll(selector) {
          if (selector === '.hud-inventory .inv-slot') return [slotMock];
          return [];
        },
        getElementById() { return null; }
      };

      shop.updateHUDInventory();

      assertTrue(slotMock.classList.contains('occupied'));
      assertTrue(slotMock.classList.contains('tier-2'), 'Slot must reflect tier-2 class from equipped item');
    } finally {
      globalThis.document = prevDoc;
    }
  });
});
