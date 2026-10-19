import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue, assertFalse } from '../helpers/assert.js';
import { resolveModule } from '../helpers/module_resolver.js';

describe('Tier 1 Unit: M1 Adversarial Stress & Empirical Challenge', () => {

  it('ADV-M1-01: Massive simultaneous event spam (100 events) maintains queue integrity and priority hierarchy', async () => {
    const { module: bannerMod } = await resolveModule('ui/event_banners');
    const mgr = new bannerMod.EventBannerManager();

    // Spam 100 events rapidly: 50 kills (p6), 25 streaks (p5), 15 towers (p4), 5 first bloods (p3), 4 boss events (p2), 1 victory (p1)
    const types = [
      ...Array(50).fill('kill'),
      ...Array(25).fill('kill_streak'),
      ...Array(15).fill('tower'),
      ...Array(5).fill('first_blood'),
      ...Array(4).fill('boss_spawn'),
      'victory'
    ];

    for (const t of types) {
      mgr.showBanner({
        type: t,
        title: `Spam ${t}`,
        duration: 5000
      });
    }

    assertEqual(mgr.history.length, 100, 'History must record all 100 spammed events');
    assertEqual(mgr.queue.length, 99, 'Queue must hold 99 items (1 currently displayed)');
    assertEqual(mgr.currentBanner.type, 'victory', 'Priority 1 (victory) must preempt and be currently active');
    assertEqual(mgr.currentBanner.priority, 1);

    // Verify queue priority monotonicity (each element must have priority >= previous)
    for (let i = 0; i < mgr.queue.length - 1; i++) {
      const curr = mgr.queue[i];
      const next = mgr.queue[i + 1];
      assertTrue(
        curr.priority <= next.priority,
        `Queue priority order violated at index ${i}: priority ${curr.priority} > ${next.priority}`
      );
    }

    mgr.clear();
    assertEqual(mgr.queue.length, 0);
    assertEqual(mgr.currentBanner, null);
  });

  it('ADV-M1-02: Strict priority preemption and re-queueing (Priority 1 pre-empts Priority 6, cascading chains)', async () => {
    const { module: bannerMod } = await resolveModule('ui/event_banners');
    const mgr = new bannerMod.EventBannerManager();

    // Step 1: Start with priority 6 (normal kill)
    const bKill = mgr.showBanner({ type: 'kill', priority: 6, title: 'Kill 1', duration: 10000 });
    assertEqual(mgr.currentBanner.id, bKill.id);
    assertEqual(mgr.queue.length, 0);

    // Step 2: Fire priority 4 (tower destroyed) -> should preempt kill
    const bTower = mgr.showBanner({ type: 'tower', priority: 4, title: 'Tower 1', duration: 10000 });
    assertEqual(mgr.currentBanner.id, bTower.id, 'Priority 4 must preempt Priority 6');
    assertEqual(mgr.queue.length, 1);
    assertEqual(mgr.queue[0].id, bKill.id, 'Preempted kill must be re-queued');

    // Step 3: Fire priority 2 (boss spawn) -> should preempt tower
    const bBoss = mgr.showBanner({ type: 'boss_spawn', priority: 2, title: 'Boss 1', duration: 10000 });
    assertEqual(mgr.currentBanner.id, bBoss.id, 'Priority 2 must preempt Priority 4');
    assertEqual(mgr.queue.length, 2);
    assertEqual(mgr.queue[0].id, bTower.id, 'Priority 4 must be first in queue');
    assertEqual(mgr.queue[1].id, bKill.id, 'Priority 6 must be second in queue');

    // Step 4: Fire priority 1 (victory) -> should preempt boss
    const bVic = mgr.showBanner({ type: 'victory', priority: 1, title: 'Victory', duration: 10000 });
    assertEqual(mgr.currentBanner.id, bVic.id, 'Priority 1 must preempt Priority 2');
    assertEqual(mgr.queue.length, 3);
    assertEqual(mgr.queue[0].id, bBoss.id, 'Priority 2 must be first in queue');
    assertEqual(mgr.queue[1].id, bTower.id, 'Priority 4 must be second in queue');
    assertEqual(mgr.queue[2].id, bKill.id, 'Priority 6 must be third in queue');

    // Step 5: Advance queue by dismissing Victory
    mgr._dismissCurrentBanner();
    assertEqual(mgr.currentBanner.id, bBoss.id, 'After victory dismissal, boss must play next');

    // Step 6: Advance queue by dismissing Boss
    mgr._dismissCurrentBanner();
    assertEqual(mgr.currentBanner.id, bTower.id, 'After boss dismissal, tower must play next');

    // Step 7: Advance queue by dismissing Tower
    mgr._dismissCurrentBanner();
    assertEqual(mgr.currentBanner.id, bKill.id, 'After tower dismissal, kill must play next');

    // Step 8: Final dismissal
    mgr._dismissCurrentBanner();
    assertEqual(mgr.currentBanner, null, 'Active banner must be null after all are dismissed');
    assertEqual(mgr.queue.length, 0);

    mgr.clear();
  });

  it('ADV-M1-03: Defensive resilience with null, undefined, and empty parameters', async () => {
    const { module: bannerMod } = await resolveModule('ui/event_banners');
    const mgr = new bannerMod.EventBannerManager();

    let threwError = false;

    // Test showBanner with empty object
    try {
      const bEmpty = mgr.showBanner({});
      assertTrue(typeof bEmpty.id === 'string');
      assertEqual(bEmpty.priority, 6);
    } catch {
      threwError = true;
    }
    assertFalse(threwError, 'showBanner({}) must not throw');

    // Test announceFirstBlood with undefined / null
    try {
      mgr.announceFirstBlood();
      mgr.announceFirstBlood(undefined, undefined, undefined);
    } catch {
      threwError = true;
    }
    assertFalse(threwError, 'announceFirstBlood with undefined must not throw');

    // Test announceTowerDestroyed with undefined
    try {
      mgr.announceTowerDestroyed();
      mgr.announceTowerDestroyed(undefined, undefined);
    } catch {
      threwError = true;
    }
    assertFalse(threwError, 'announceTowerDestroyed with undefined must not throw');

    // Test announceBossSpawn and announceBossSlain with undefined
    try {
      mgr.announceBossSpawn();
      mgr.announceBossSlain();
    } catch {
      threwError = true;
    }
    assertFalse(threwError, 'Boss announcements with undefined must not throw');

    // Test showVictoryBanner and showDefeatBanner with undefined
    try {
      mgr.showVictoryBanner();
      mgr.showDefeatBanner();
    } catch {
      threwError = true;
    }
    assertFalse(threwError, 'Victory and defeat banners with undefined must not throw');

    // Check specific null parameter handling
    // (a) showBanner(null) or showBanner()
    let nullBannerFailed = false;
    try {
      mgr.showBanner(null);
    } catch {
      nullBannerFailed = true;
    }

    let noArgBannerFailed = false;
    try {
      mgr.showBanner();
    } catch {
      noArgBannerFailed = true;
    }

    // (b) announceKill(hero, victim, null)
    let nullStreakFailed = false;
    try {
      mgr.announceKill('Hero', 'Enemy', null);
    } catch {
      nullStreakFailed = true;
    }

    // (c) showVictoryBanner(null)
    let nullVictoryFailed = false;
    try {
      mgr.showVictoryBanner(null);
    } catch {
      nullVictoryFailed = true;
    }

    // (d) showDefeatBanner(null)
    let nullDefeatFailed = false;
    try {
      mgr.showDefeatBanner(null);
    } catch {
      nullDefeatFailed = true;
    }

    mgr.clear();

    // Verify whether any of the null inputs threw exceptions
    const failures = [];
    if (nullBannerFailed) failures.push('showBanner(null)');
    if (noArgBannerFailed) failures.push('showBanner()');
    if (nullStreakFailed) failures.push('announceKill(hero, victim, null)');
    if (nullVictoryFailed) failures.push('showVictoryBanner(null)');
    if (nullDefeatFailed) failures.push('showDefeatBanner(null)');

    assertEqual(
      failures.length,
      0,
      `EventBannerManager crashed on null/empty arguments: ${failures.join(', ')}`
    );
  });

  it('ADV-M1-04: Timeout cancellation and leak safety with clear() in active and exiting states', async () => {
    const { module: bannerMod } = await resolveModule('ui/event_banners');

    // Mock DOM container
    let removedCount = 0;
    const domElementMock = {
      classList: {
        add() {},
        remove() {}
      },
      remove() {
        removedCount++;
      }
    };

    const containerMock = {
      children: [],
      appendChild(child) {
        this.children.push(child);
      }
    };

    const prevDoc = globalThis.document;
    try {
      globalThis.document = {
        createElement() {
          return domElementMock;
        },
        contains() { return true; },
        getElementById() { return containerMock; }
      };

      const mgr = new bannerMod.EventBannerManager(containerMock);

      // Display banner
      mgr.showBanner({ type: 'kill', duration: 1000 });
      assertTrue(mgr.timeoutId !== null, 'Timeout ID must be scheduled');
      assertTrue(mgr.bannerElement !== null, 'Banner element must be stored');

      // Call clear() during active display
      mgr.clear();
      assertEqual(mgr.timeoutId, null, 'clear() must cancel active timeoutId');
      assertEqual(mgr.exitTimeoutId, null, 'clear() must cancel exitTimeoutId');
      assertEqual(mgr.bannerElement, null, 'clear() must nullify bannerElement reference');
      assertEqual(mgr.currentBanner, null, 'clear() must nullify currentBanner');
      assertEqual(mgr.queue.length, 0, 'clear() must empty queue');
      assertTrue(removedCount >= 1, 'DOM element must have been removed from container');

      // Now test clear() during exiting phase (exitTimeoutId active)
      mgr.showBanner({ type: 'boss_spawn', duration: 1000 });
      // Trigger dismissal to enter exiting state
      mgr._dismissCurrentBanner();
      assertTrue(mgr.exitTimeoutId !== null, 'exitTimeoutId must be active during exit animation');

      // Clear immediately while exit animation is running
      mgr.clear();
      assertEqual(mgr.exitTimeoutId, null, 'clear() must cancel pending exitTimeoutId');
      assertEqual(mgr.currentBanner, null);

      // Wait 350ms to ensure the exitTimeoutId callback does NOT fire after clear
      await new Promise(resolve => setTimeout(resolve, 350));
      assertEqual(mgr.currentBanner, null, 'No delayed callback must execute after clear()');
      assertEqual(mgr.queue.length, 0);

      // Idempotency: Multiple consecutive clear() calls must be safe
      for (let i = 0; i < 20; i++) {
        mgr.clear();
      }
      assertEqual(mgr.queue.length, 0);
      assertEqual(mgr.currentBanner, null);
    } finally {
      globalThis.document = prevDoc;
    }
  });

  it('ADV-M1-05: Sound callback fault-tolerance (throwing errors inside sound handler)', async () => {
    const { module: bannerMod } = await resolveModule('ui/event_banners');
    const mgr = new bannerMod.EventBannerManager();

    // Case 1: Callback throws an error
    let soundCalls = 0;
    mgr.onEventPlaySound = () => {
      soundCalls++;
      throw new Error('Simulated WebAudio / Media exception in sound engine');
    };

    let dispatchThrew = false;
    try {
      mgr.showBanner({ type: 'victory', title: 'Vitória' });
    } catch {
      dispatchThrew = true;
    }

    assertFalse(dispatchThrew, 'showBanner must be resilient against sound callback errors');
    assertEqual(soundCalls, 1, 'Sound callback must have been invoked');

    // Case 2: Non-function assigned to onEventPlaySound
    mgr.onEventPlaySound = 'invalid_string';
    try {
      mgr.showBanner({ type: 'defeat', title: 'Derrota' });
    } catch {
      dispatchThrew = true;
    }
    assertFalse(dispatchThrew, 'Non-function onEventPlaySound must not throw');

    mgr.clear();
  });

  it('ADV-M1-06: ShopUI formatStatChips defensive handling with edge-case attributes', async () => {
    const { module: shopMod } = await resolveModule('ui/shop_ui');

    // 1. null / undefined stats
    let threwNull = false;
    let nullChips = null;
    try {
      nullChips = shopMod.formatStatChips(null);
    } catch {
      threwNull = true;
    }
    assertFalse(threwNull, 'formatStatChips(null) must not throw');
    assertTrue(Array.isArray(nullChips) && nullChips.length === 0, 'null stats must produce empty array');

    const undefChips = shopMod.formatStatChips(undefined);
    assertTrue(Array.isArray(undefChips) && undefChips.length === 0, 'undefined stats must produce empty array');

    const emptyChips = shopMod.formatStatChips({});
    assertTrue(Array.isArray(emptyChips) && emptyChips.length === 0, 'empty stats must produce empty array');

    // 2. Non-numeric or partial stats
    const partialChips = shopMod.formatStatChips({
      attackDamage: 25,
      abilityPower: 0, // 0 should not render
      hp: null,
      mana: undefined,
      armor: 15
    });

    assertTrue(partialChips.includes('+25 AD'));
    assertTrue(partialChips.includes('+15 Armor'));
    assertFalse(partialChips.includes('AP'), '0 AP should not render chip');
    assertFalse(partialChips.includes('HP'), 'null HP should not render chip');
  });

  it('ADV-M1-07: HUDController resilience with null, dead, or corrupted hero states', async () => {
    const { module: hudMod } = await resolveModule('ui/hud');
    const hud = new hudMod.HUDController();

    // 1. Updating with null hero & null gameState
    let threw = false;
    try {
      hud.update(null, null);
    } catch {
      threw = true;
    }
    assertFalse(threw, 'hud.update(null, null) must not throw');

    // 2. Updating with empty/corrupted hero object
    const prevDoc = globalThis.document;
    try {
      globalThis.document = {}; // satisfy typeof document !== 'undefined'
      hud.elements = {};

      const corruptedHero = {
        hp: NaN,
        maxHp: 0,
        mana: null,
        maxMana: undefined,
        level: null,
        abilities: null,
        isDead: true,
        respawnTimer: -5
      };

      hud.update(corruptedHero, {});
    } catch {
      threw = true;
    } finally {
      globalThis.document = prevDoc;
    }
    assertFalse(threw, 'hud.update with corrupted hero must not throw');
  });
});
