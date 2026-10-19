import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue, assertFalse } from '../helpers/assert.js';
import { resolveModule } from '../helpers/module_resolver.js';

describe('Tier 1 Unit: Crowd Control State Machine Matrix', () => {
  it('TC-CC-01: Stun disables canMove, canAttack, canCast, and breaks channel', async () => {
    const { module: cc } = await resolveModule('combat/cc');
    const state = cc.createInitialCCState();
    cc.applyCC(state, 'stun', 1500, 1000); // stunned until 2500

    assertFalse(cc.canMove(state, 1500), 'Cannot move while stunned');
    assertFalse(cc.canAttack(state, 1500), 'Cannot attack while stunned');
    assertFalse(cc.canCast(state, 1500), 'Cannot cast while stunned');
    assertTrue(cc.breaksChannel('stun'), 'Stun must break channels');
  });

  it('TC-CC-02: Root disables canMove, but permits canAttack and canCast', async () => {
    const { module: cc } = await resolveModule('combat/cc');
    const state = cc.createInitialCCState();
    cc.applyCC(state, 'root', 2000, 1000); // rooted until 3000

    assertFalse(cc.canMove(state, 1500), 'Cannot move while rooted');
    assertTrue(cc.canAttack(state, 1500), 'Can attack while rooted');
    assertTrue(cc.canCast(state, 1500), 'Can cast while rooted');
    assertFalse(cc.breaksChannel('root'), 'Root does NOT break recall channel');
  });

  it('TC-CC-03: Silence disables canCast, permits canMove, and breaks channel', async () => {
    const { module: cc } = await resolveModule('combat/cc');
    const state = cc.createInitialCCState();
    cc.applyCC(state, 'silence', 1500, 1000);

    assertTrue(cc.canMove(state, 1500), 'Can move while silenced');
    assertFalse(cc.canCast(state, 1500), 'Cannot cast while silenced');
    assertTrue(cc.breaksChannel('silence'), 'Silence breaks channels');
  });

  it('TC-CC-04: Taunt disables canMove, canCast, sets tauntTargetId, and breaks channel', async () => {
    const { module: cc } = await resolveModule('combat/cc');
    const state = cc.createInitialCCState();
    cc.applyCC(state, 'taunt', 1500, 1000, { targetId: 'knight_1' });

    assertFalse(cc.canMove(state, 1500), 'Cannot move freely while taunted');
    assertFalse(cc.canCast(state, 1500), 'Cannot cast while taunted');
    assertEqual(state.tauntTargetId, 'knight_1');
    assertTrue(cc.breaksChannel('taunt'), 'Taunt breaks channels');
  });

  it('TC-CC-05: Slow reduces speed without breaking channel; cleanse restores speed', async () => {
    const { module: cc } = await resolveModule('combat/cc');
    const state = cc.createInitialCCState();
    cc.applyCC(state, 'slow', 3000, 1000, { slowPercentage: 0.40 });

    assertTrue(cc.canMove(state, 1500), 'Can still move while slowed');
    assertEqual(state.slowPercentage, 0.40);
    assertFalse(cc.breaksChannel('slow'), 'Slow does NOT break channels');

    cc.cleanseSlows(state);
    assertEqual(state.slowPercentage, 0, 'Cleanse should reset slow percentage to 0');
  });

  it('TC-CC-06: Concurrent CC applies non-stacking maximum duration rule', async () => {
    const { module: cc } = await resolveModule('combat/cc');
    const state = cc.createInitialCCState();
    cc.applyCC(state, 'stun', 1000, 1000); // until 2000
    cc.applyCC(state, 'stun', 2500, 1000); // until 3500

    assertEqual(state.stunnedUntil, 3500, 'Max duration should take precedence');
  });

  it('TC-CC-07: Expired CC automatically restores all action capabilities', async () => {
    const { module: cc } = await resolveModule('combat/cc');
    const state = cc.createInitialCCState();
    cc.applyCC(state, 'stun', 1000, 1000); // until 2000

    assertFalse(cc.canMove(state, 1999));
    assertTrue(cc.canMove(state, 2000), 'At t=2000, stun is expired');
    assertTrue(cc.canAttack(state, 2000));
    assertTrue(cc.canCast(state, 2000));
  });
});
