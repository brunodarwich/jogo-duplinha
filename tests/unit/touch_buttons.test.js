import { describe, it } from '../helpers/framework.js';
import { assertEqual } from '../helpers/assert.js';
import { enableTouchActivation } from '../../src/ui/touch_button.js';

function button() {
  const element = new EventTarget();
  let activations = 0;
  element.click = () => element.dispatchEvent(new Event('click'));
  enableTouchActivation(element, (target, name, handler, options) => target.addEventListener(name, handler, options));
  element.addEventListener('click', () => activations++);
  const emit = (type, props = {}) => element.dispatchEvent(Object.assign(new Event(type, {cancelable:true}), props));
  return {element, emit, count:() => activations};
}
describe('Touch buttons support a second finger without duplicate actions', () => {
  it('A non-primary touch activates exactly once even when the browser follows with click', () => {
    const b=button();
    b.emit('pointerdown',{pointerId:2,pointerType:'touch',isPrimary:false});
    b.emit('pointerup',{pointerId:2,pointerType:'touch',isPrimary:false});
    b.emit('click',{pointerType:'touch',detail:1});
    assertEqual(b.count(),1);
  });
  it('A canceled touch does not activate; keyboard activation still works', () => {
    const b=button();
    b.emit('pointerdown',{pointerId:2,pointerType:'touch'});
    b.emit('pointercancel',{pointerId:2,pointerType:'touch'});
    b.emit('pointerup',{pointerId:2,pointerType:'touch'});
    assertEqual(b.count(),0);
    b.emit('click',{detail:0});assertEqual(b.count(),1);
  });
  it('Consecutive deliberate taps each activate once', () => {
    const b=button();
    for(const pointerId of [2,3]) {
      b.emit('pointerdown',{pointerId,pointerType:'touch'});
      b.emit('pointerup',{pointerId,pointerType:'touch'});
      b.emit('click',{pointerType:'touch',detail:1});
    }
    assertEqual(b.count(),2);
  });
  it('Dragging a touch outside the button cancels its activation', () => {
    const b=button();
    b.element.getBoundingClientRect=()=>({left:0,top:0,right:44,bottom:44});
    b.emit('pointerdown',{pointerId:2,pointerType:'touch',clientX:22,clientY:22});
    b.emit('pointerup',{pointerId:2,pointerType:'touch',clientX:100,clientY:100});
    assertEqual(b.count(),0);
  });

});
