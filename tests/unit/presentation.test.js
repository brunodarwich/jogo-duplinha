import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue } from '../helpers/assert.js';
import { Renderer } from '../../src/render/renderer.js';
import { getHeroAction } from '../../src/render/hero_action.js';

describe('Snapshot presentation interpolation', () => {
  it('Smooths drawing between snapshots without changing authoritative position', () => {
    const renderer = new Renderer();
    const entity = { type: 'hero', x: 150, y: 75, _snapshotPreviousX: 100, _snapshotPreviousY: 25,
      _snapshotReceivedAt: 1000, draw() { return [this.x, this.y]; } };
    const view = renderer.getPresentationEntity(entity, 1025);
    assertEqual(view.x, 125);
    assertEqual(view.y, 50);
    assertEqual(entity.x, 150);
    assertEqual(entity.y, 75);
    assertEqual(view.draw()[0], 125);
    assertEqual(renderer.getPresentationEntity(entity, 1050), entity);
  });

  it('Does not interpolate a teleport, static structure or local simulation entity', () => {
    const renderer = new Renderer();
    const hero = { type: 'hero', x: 900, y: 900, _snapshotPreviousX: 100, _snapshotPreviousY: 100, _snapshotReceivedAt: 1000 };
    const tower = { ...hero, type: 'tower' };
    const local = { type: 'hero', x: 150, y: 150 };
    assertEqual(renderer.getPresentationEntity(hero, 1025), hero);
    assertEqual(renderer.getPresentationEntity(tower, 1025), tower);
    assertEqual(renderer.getPresentationEntity(local, 1025), local);
    assertTrue(hero.x === 900);
  });

  it('An expired action on a cached view does not hide the next cast', () => {
    const renderer = new Renderer();
    const hero = { type: 'hero', hp: 100, x: 150, y: 75, _snapshotPreviousX: 100, _snapshotPreviousY: 25,
      _snapshotReceivedAt: 1000, visualAction: { action: 'attack', sequence: 1, startedAt: 0, durationMs: 100 } };
    const view = renderer.getPresentationEntity(hero, 1025);
    assertEqual(getHeroAction(view, 200), null);
    hero.visualAction = { action: 'skill_q', sequence: 2, startedAt: 200, durationMs: 500 };
    const nextView = renderer.getPresentationEntity(hero, 1030);
    assertEqual(getHeroAction(nextView, 210)?.sequence, 2);
    assertEqual(hero.x, 150);
    assertEqual(hero.y, 75);
  });
});
