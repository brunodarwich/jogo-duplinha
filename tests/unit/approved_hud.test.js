import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue, assertFalse } from '../helpers/assert.js';
import * as hud from '../../src/ui/hud.js';
import { VirtualJoystick } from '../../src/ui/virtual_joystick.js';

function joystick() {
  const j = Object.create(VirtualJoystick.prototype);
  const commands = [];
  Object.assign(j, { prefersTouchControls: () => true, active: false, maxRadius: 30, dirX: 0, dirY: 0, magnitude: 0,
    baseEl: { getBoundingClientRect: () => ({left: 8, top: 300, width: 112, height: 112}), setPointerCapture() {}, releasePointerCapture() {} },
    knobEl: { style: {} }, gameSim: { handleCommand: c => commands.push(c) },
    startMovementLoop() {}, stopMovementLoop() {} });
  return {j, commands};
}

describe('Approved HUD: boss state and fixed joystick', () => {
  it('Boss status hides dead bosses and clamps replicated HP', () => {
    assertEqual(hud.getBossStatus([]), null);
    const status = hud.getBossStatus([{hp:0,maxHp:100}, {name:'Guardian',hp:150,maxHp:100,phase:2,shieldActive:true}]);
    assertEqual(status.ratio, 1);
    assertTrue(status.label.includes('2'));
    assertEqual(status.hp, '100 / 100');
    assertTrue(status.shielded);
  });
  it('Fixed joystick starts at its center, captures one pointer and ignores other fingers', () => {
    const {j} = joystick();
    j.beginPointer({pointerId:7,pointerType:'touch',clientX:64,clientY:356,preventDefault(){},stopPropagation(){}});
    assertTrue(j.active); assertEqual(j.baseX,64); assertEqual(j.baseY,356);
    j.movePointer({pointerId:9,clientX:400,clientY:200,preventDefault(){}});
    assertEqual(j.magnitude,0);
    j.movePointer({pointerId:7,clientX:164,clientY:356,preventDefault(){}});
    assertEqual(j.magnitude,1); assertEqual(j.dirX,1);
  });
  it('Releasing movement sends STOP once and resets the thumb even outside the joystick', () => {
    const {j,commands} = joystick();
    j.active=true; j.touchId=7; j.hasMoved=true; j.magnitude=1;
    j.endPointer({pointerId:9}); assertTrue(j.active);
    j.endPointer({pointerId:7}); j.cancelMovement();
    assertFalse(j.active); assertEqual(j.magnitude,0);
    assertEqual(commands.length,1); assertEqual(commands[0].type,'STOP');
  });
  it('Tapping without moving never cancels a combat command', () => {
    const {j,commands} = joystick(); j.active=true; j.touchId=7;
    j.endPointer({pointerId:7}); assertEqual(commands.length,0);
  });
});
