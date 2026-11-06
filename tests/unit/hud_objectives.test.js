import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue } from '../helpers/assert.js';
import * as hud from '../../src/ui/hud.js';

describe('Contextual match objectives', () => {
  it('Advances from outer tower to inner tower to vulnerable Nexus', () => {
    const outer = { id: 'outer', type: 'tower', tier: 'outer', team: 'enemy', hp: 100 };
    const inner = { id: 'inner', type: 'tower', tier: 'inner', team: 'enemy', hp: 100 };
    const boss = { type: 'boss', team: 'enemy', hp: 12000 };
    const state = { entities: [outer, inner, boss], matchTime: 10, nextWaveIn: 50 };
    assertTrue(hud.getObjectiveStatus(state).objective.includes('externa'));
    outer.hp = 0;
    assertTrue(hud.getObjectiveStatus(state).objective.includes('interna'));
    inner.hp = 0;
    assertTrue(hud.getObjectiveStatus(state).objective.includes('Nexus'));
    assertTrue(hud.getObjectiveStatus(state).detail.includes('vulnerável'));
  });

  it('Uses replicated wave timing and identifies the next boss wave', () => {
    const view = hud.getObjectiveStatus({ entities: [], matchTime: 65, waveIndex: 4, nextWaveIn: 55 });
    assertEqual(view.wave, 'Próxima onda em 00:55');
    assertTrue(view.detail.includes('Colosso'));
    assertEqual(hud.getObjectiveStatus({ isVictory: true }).objective, 'Vitória! Nexus inimigo destruído');
  });
});
