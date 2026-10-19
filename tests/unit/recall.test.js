import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue, assertFalse } from '../helpers/assert.js';
import { resolveModule } from '../helpers/module_resolver.js';

describe('Tier 1 Unit: 5.0-Second Recall Channeling & Interruption Logic', () => {
  it('TC-REC-01: Initiates 5000ms channeling state when off cooldown', async () => {
    const { module: recallMod } = await resolveModule('systems/recall');
    const recall = new recallMod.RecallSystem({ x: 400, y: 400 });
    const hero = { x: 1500, y: 1500, isRecalling: false, recallCooldownRemaining: 0 };

    const res = recall.startRecall(hero);
    assertTrue(res.success);
    assertTrue(hero.isRecalling);
    assertEqual(hero.recallProgress, 0.0);
  });

  it('TC-REC-02: Completes after 5000ms uninterrupted and teleports hero to fountain', async () => {
    const { module: recallMod } = await resolveModule('systems/recall');
    const recall = new recallMod.RecallSystem({ x: 400, y: 400 });
    const hero = { x: 2500, y: 2500, isRecalling: false, recallCooldownRemaining: 0 };

    recall.startRecall(hero);

    // Update 3 seconds
    const update1 = recall.update(hero, 3.0);
    assertFalse(update1.completed);
    assertEqual(hero.x, 2500);

    // Update remaining 2.0 seconds (total 5.0s)
    const update2 = recall.update(hero, 2.0);
    assertTrue(update2.completed);
    assertFalse(hero.isRecalling);
    assertEqual(hero.x, 400, 'Hero X must be reset to fountain X (400)');
    assertEqual(hero.y, 400, 'Hero Y must be reset to fountain Y (400)');
  });

  it('TC-REC-03: Taking damage cancels Recall and imposes 1.0s cooldown penalty', async () => {
    const { module: recallMod } = await resolveModule('systems/recall');
    const recall = new recallMod.RecallSystem({ x: 400, y: 400 });
    const hero = { x: 1500, y: 1500, isRecalling: false, recallCooldownRemaining: 0 };

    recall.startRecall(hero);
    recall.update(hero, 2.5); // 2.5s in

    // Hero takes damage
    const interrupted = recall.interrupt(hero, 'damage');
    assertTrue(interrupted);
    assertFalse(hero.isRecalling);
    assertEqual(hero.recallProgress, 0.0);
    assertEqual(hero.recallCooldownRemaining, 1.0, '1.0s cooldown on interruption');
  });

  it('TC-REC-04: Movement order cancels Recall channel', async () => {
    const { module: recallMod } = await resolveModule('systems/recall');
    const recall = new recallMod.RecallSystem({ x: 400, y: 400 });
    const hero = { x: 1500, y: 1500, isRecalling: false, recallCooldownRemaining: 0 };

    recall.startRecall(hero);
    const interrupted = recall.interrupt(hero, 'move');
    assertTrue(interrupted);
    assertFalse(hero.isRecalling);
  });

  it('TC-REC-05: Spell cast cancels Recall channel', async () => {
    const { module: recallMod } = await resolveModule('systems/recall');
    const recall = new recallMod.RecallSystem({ x: 400, y: 400 });
    const hero = { x: 1500, y: 1500, isRecalling: false, recallCooldownRemaining: 0 };

    recall.startRecall(hero);
    const interrupted = recall.interrupt(hero, 'cast');
    assertTrue(interrupted);
    assertFalse(hero.isRecalling);
  });

  it('TC-REC-06: Crowd control (Stun/Taunt/Silence) breaks Recall channel', async () => {
    const { module: recallMod } = await resolveModule('systems/recall');
    const recall = new recallMod.RecallSystem({ x: 400, y: 400 });
    const hero = { x: 1500, y: 1500, isRecalling: false, recallCooldownRemaining: 0 };

    recall.startRecall(hero);
    const interrupted = recall.interrupt(hero, 'stun');
    assertTrue(interrupted);
    assertFalse(hero.isRecalling);
  });

  it('TC-REC-07: Receiving healing or fountain regen does NOT interrupt Recall', async () => {
    const { module: recallMod } = await resolveModule('systems/recall');
    const recall = new recallMod.RecallSystem({ x: 400, y: 400 });
    const hero = { x: 1500, y: 1500, isRecalling: false, recallCooldownRemaining: 0 };

    recall.startRecall(hero);
    recall.update(hero, 2.0);

    const interruptedHeal = recall.interrupt(hero, 'heal');
    assertFalse(interruptedHeal, 'Healing must not break recall');
    assertTrue(hero.isRecalling);

    const interruptedRegen = recall.interrupt(hero, 'regen');
    assertFalse(interruptedRegen, 'Regen must not break recall');
    assertTrue(hero.isRecalling);
  });
});
