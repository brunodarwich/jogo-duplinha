import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue, assertFalse } from '../helpers/assert.js';
import { resolveModule } from '../helpers/module_resolver.js';

describe('Tier 1 Unit: Input Dispatch & Command System', () => {
  it('TC-INP-01: Right-click on ground dispatches MOVE_TO command', async () => {
    const { module: inputMod } = await resolveModule('core/input');
    const dispatcher = new inputMod.InputDispatcher({ x: 0, y: 0 }, 1.0, { width: 1280, height: 720 });

    const cmd = dispatcher.handleMouseDown(2, 640, 360, null);
    assertEqual(cmd.type, 'MOVE_TO');
    assertEqual(cmd.x, 0);
    assertEqual(cmd.y, 0);
  });

  it('TC-INP-02: Right-click on enemy unit dispatches ATTACK_TARGET command', async () => {
    const { module: inputMod } = await resolveModule('core/input');
    const dispatcher = new inputMod.InputDispatcher();
    const enemy = { id: 'minion_enemy_1', team: 'enemy', x: 500, y: 500 };

    const cmd = dispatcher.handleMouseDown(2, 600, 300, enemy);
    assertEqual(cmd.type, 'ATTACK_TARGET');
    assertEqual(cmd.targetId, 'minion_enemy_1');
  });

  it('TC-INP-03: Pressing Q initiates skill targeting when mana and cooldown allow', async () => {
    const { module: inputMod } = await resolveModule('core/input');
    const dispatcher = new inputMod.InputDispatcher();
    const hero = {
      x: 100, y: 100, mana: 100,
      skills: {
        Q: { manaCost: 50, cooldownRemaining: 0, targetType: 'skillshot', range: 600 }
      }
    };

    const cmd = dispatcher.handleKeyDown('Q', hero);
    assertEqual(cmd.type, 'START_TARGETING');
    assertEqual(cmd.skill, 'Q');
    assertEqual(dispatcher.targetingSkill, 'Q');
  });

  it('TC-INP-04: Left-click during targeting confirms and dispatches CAST_SKILL', async () => {
    const { module: inputMod } = await resolveModule('core/input');
    const dispatcher = new inputMod.InputDispatcher();
    dispatcher.targetingSkill = 'Q';

    const cmd = dispatcher.handleMouseDown(0, 640, 360, null);
    assertEqual(cmd.type, 'CAST_SKILL');
    assertEqual(cmd.skill, 'Q');
    assertEqual(dispatcher.targetingSkill, null, 'Targeting mode should reset after cast');
  });

  it('TC-INP-05: Right-click or Escape cancels active targeting mode', async () => {
    const { module: inputMod } = await resolveModule('core/input');
    const dispatcher = new inputMod.InputDispatcher();

    // Cancel via Escape
    dispatcher.targetingSkill = 'W';
    const escCmd = dispatcher.handleKeyDown('Escape');
    assertEqual(escCmd.type, 'CANCEL_TARGETING');
    assertEqual(escCmd.skill, 'W');
    assertEqual(dispatcher.targetingSkill, null);

    // Cancel via Right-click
    dispatcher.targetingSkill = 'E';
    const rcCmd = dispatcher.handleMouseDown(2, 500, 300);
    assertEqual(rcCmd.type, 'CANCEL_TARGETING');
    assertEqual(rcCmd.skill, 'E');
    assertEqual(dispatcher.targetingSkill, null);
  });

  it('TC-INP-06: S and H keys dispatch STOP command and clear channels', async () => {
    const { module: inputMod } = await resolveModule('core/input');
    const dispatcher = new inputMod.InputDispatcher();
    dispatcher.targetingSkill = 'R';

    const cmdS = dispatcher.handleKeyDown('s');
    assertEqual(cmdS.type, 'STOP');
    assertEqual(dispatcher.targetingSkill, null);

    const cmdH = dispatcher.handleKeyDown('H');
    assertEqual(cmdH.type, 'STOP');
  });

  it('TC-INP-07: Clamps out-of-bounds mouse coordinates to map boundaries [0, 3200]', async () => {
    const { module: inputMod } = await resolveModule('core/input');
    const dispatcher = new inputMod.InputDispatcher({ x: 0, y: 0 }, 1.0, { width: 1280, height: 720 });

    const cmdFarOff = dispatcher.handleMouseDown(2, -5000, -5000);
    assertEqual(cmdFarOff.type, 'MOVE_TO');
    assertTrue(cmdFarOff.x >= 0 && cmdFarOff.x <= inputMod.MAP_SIZE);
    assertTrue(cmdFarOff.y >= 0 && cmdFarOff.y <= inputMod.MAP_SIZE);
  });
});
