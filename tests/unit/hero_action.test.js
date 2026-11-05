import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue } from '../helpers/assert.js';
import { GameSimulation } from '../../src/game.js';
import { CommandType } from '../../src/core/input.js';
import { MinionUnit } from '../../src/world/minion.js';
import { readFileSync } from 'node:fs';

describe('Hero combat animation lifecycle', () => {
  it('ships all 25 RGBA action atlases with four 384px frames', async () => {
    const { SPRITE_PATHS } = await import('../../src/render/sprite_loader.js');
    const entries = Object.entries(SPRITE_PATHS).filter(([key]) => /^hero_.+_(attack|skill_[qwer])$/.test(key));
    assertEqual(entries.length, 25);
    for (const [, path] of entries) {
      const png = readFileSync(new URL(`../../${path}`, import.meta.url));
      assertEqual(png.toString('ascii', 1, 4), 'PNG');
      assertEqual(png.readUInt32BE(16), 768);
      assertEqual(png.readUInt32BE(20), 768);
      assertEqual(png[25], 6);
    }
  });

  it('renders action frames before walking, preserves facing and falls back on failed action images', async () => {
    const previousWindow = globalThis.window, previousImage = globalThis.Image;
    try {
      globalThis.window = {};
      globalThis.Image = class {
        set src(path) {
          this.path = path;
          if (path.endsWith('skill_r.png')) { this.onerror(); return; }
          this.width = this.height = this.naturalWidth = path.endsWith('knight.png') ? 384 : 768;
          this.complete = true;
          this.onload();
        }
      };
      const { getHeroSprite, drawChibiSprite } = await import('../../src/render/sprite_loader.js?combat-render-test');
      const calls = [], scales = [];
      const ctx = { save() {}, restore() {}, translate() {}, scale: (...args) => scales.push(args), drawImage: (...args) => calls.push(args) };
      const img = getHeroSprite('knight');
      drawChibiSprite(ctx, img, 100, 200, 78, 78, { isMoving: true, flipX: true, action: { action: 'skill_q', frame: 3 } });
      assertTrue(calls[0][0].path.endsWith('knight_skill_q.png'));
      assertEqual(calls[0][1], 384);
      assertEqual(calls[0][2], 384);
      assertEqual(scales[0][0], -1);
      assertEqual(calls[0][7], 78 * 1.6);
      calls.length = 0;
      drawChibiSprite(ctx, img, 100, 200, 78, 78, { action: { action: 'skill_r', frame: 2 } });
      assertTrue(calls[0][0].path.endsWith('knight_walk.png'));
      calls.length = 0;
      drawChibiSprite(ctx, img, 100, 200, 78, 78, { isMoving: false });
      assertTrue(calls[0][0].path.endsWith('knight_walk.png'));
      assertEqual(calls[0][1], 0);
      assertEqual(calls[0][2], 0);
    } finally {
      if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
      if (previousImage === undefined) delete globalThis.Image; else globalThis.Image = previousImage;
    }
  });
  it('starts only executed commands and preserves immediate combat effects', () => {
    const sim = new GameSimulation({ heroClass: 'knight' });
    const hero = sim.playerHero;
    const cmd = { type: CommandType.CAST_SKILL, slot: 'Q', targetX: hero.x, targetY: hero.y };
    hero.mana = 0;
    sim.handleCommand(cmd);
    assertEqual(hero.visualAction, undefined);
    hero.mana = hero.maxMana;
    hero.stunnedUntil = Date.now() + 5000;
    sim.handleCommand(cmd);
    assertEqual(hero.visualAction, undefined);
    hero.stunnedUntil = 0;
    sim.handleCommand(cmd);
    assertEqual(hero.visualAction.action, 'skill_q');
    assertTrue(hero.mana < hero.maxMana);
    const sequence = hero.visualAction.sequence;
    sim.handleCommand(cmd);
    assertEqual(hero.visualAction.sequence, sequence);
    const target = new MinionUnit({ team: 'enemy', x: hero.x + 10, y: hero.y, hp: 500, maxHp: 500 });
    hero.visualAction = null;
    sim.executeHeroBasicAttack(hero, target);
    assertEqual(hero.visualAction.action, 'attack');
    assertTrue(target.hp < 500);
    hero.die();
    assertEqual(hero.visualAction, null);
    hero.respawn();
    assertEqual(hero.visualAction, null);
  });

  it('connects basic attacks and Q/W/E/R for every hero', () => {
    for (const heroClass of ['knight', 'sorceress', 'ranger', 'assassin', 'cleric']) {
      const sim = new GameSimulation({ heroClass });
      const hero = sim.playerHero;
      for (const slot of ['Q', 'W', 'E', 'R']) {
        hero.mana = hero.maxMana;
        hero.abilities[slot].cooldownRemaining = 0;
        sim.handleCommand({ type: CommandType.CAST_SKILL, slot, targetX: hero.x, targetY: hero.y });
        assertEqual(hero.visualAction.action, `skill_${slot.toLowerCase()}`);
      }
      hero.visualAction = null;
      const target = new MinionUnit({ team: 'enemy', hp: 1000, maxHp: 1000 });
      sim.executeHeroBasicAttack(hero, target);
      assertEqual(hero.visualAction.action, 'attack');
      const sequence = hero.visualAction.sequence;
      sim.executeHeroBasicAttack(hero, target);
      assertEqual(hero.visualAction.sequence, sequence + 1);
    }
  });

  it('uses the same action identity in CAST_SKILL and HERO_UPDATE', async () => {
    const { PeerNetwork } = await import('../../src/net/peer_network.js');
    const sim = new GameSimulation({ heroClass: 'knight' });
    const sent = [];
    sim.network = { isSoloMode: false, broadcast: packet => sent.push(packet) };
    sim.handleCommand({ type: CommandType.CAST_SKILL, slot: 'R' });
    const cast = sent.find(packet => packet.type === 'CAST_SKILL');
    assertTrue(!!cast.visualAction);
    const update = PeerNetwork.prototype.serializeHeroState(sim.playerHero);
    assertEqual(update.visualAction.sequence, cast.visualAction.sequence);
    const remote = sim.spawnRemoteHero({ id: 'remote-action', heroId: 'knight' });
    sim.handleRemoteCast({ ...cast, heroId: remote.id });
    const startedAt = remote.visualAction.startedAt;
    sim.handleRemoteHeroUpdate({ ...update, id: remote.id });
    assertEqual(remote.visualAction.startedAt, startedAt);
  });
  it('plays once, respects attack speed and returns to locomotion', async () => {
    const { startHeroAction, getHeroAction } = await import('../../src/render/hero_action.js');
    const hero = { hp: 100, attackSpeed: 5 };
    startHeroAction(hero, 'attack', 1000);
    assertEqual(getHeroAction(hero, 1000).frame, 0);
    assertEqual(getHeroAction(hero, 1100).frame, 2);
    assertEqual(getHeroAction(hero, 1199).frame, 3);
    assertEqual(getHeroAction(hero, 1200), null);
  });

  it('lets skills replace actions while basic attacks cannot interrupt skills', async () => {
    const { startHeroAction, getHeroAction } = await import('../../src/render/hero_action.js');
    const hero = { hp: 100 };
    startHeroAction(hero, 'skill_q', 1000);
    assertEqual(startHeroAction(hero, 'attack', 1050), false);
    assertEqual(getHeroAction(hero, 1100).action, 'skill_q');
    startHeroAction(hero, 'skill_r', 1100);
    assertEqual(getHeroAction(hero, 1799).frame, 3);
    assertEqual(getHeroAction(hero, 1800), null);
    hero.hp = 0;
    assertEqual(startHeroAction(hero, 'attack', 1900), false);
  });

  it('syncs elapsed time once and rejects stale, invalid and legacy packets', async () => {
    const { startHeroAction, getHeroAction, serializeHeroAction, receiveHeroAction } = await import('../../src/render/hero_action.js');
    const local = { hp: 100 }, remote = { hp: 100 };
    startHeroAction(local, 'skill_q', 1000);
    const packet = serializeHeroAction(local, 1200);
    assertTrue(receiveHeroAction(remote, packet, 2000));
    assertEqual(getHeroAction(remote, 2000).frame, 1);
    assertEqual(receiveHeroAction(remote, packet, 2100), false);
    assertEqual(getHeroAction(remote, 2200).frame, 3);
    assertEqual(getHeroAction(remote, 2300), null);
    assertEqual(receiveHeroAction(remote, undefined), false);
    assertEqual(receiveHeroAction(remote, { ...packet, sequence: 0 }), false);
    assertEqual(receiveHeroAction(remote, { ...packet, sequence: 2, action: 'bad' }), false);
    assertEqual(receiveHeroAction(remote, { ...packet, sequence: 2, elapsedMs: NaN }), false);
  });

  it('clears actions on death without allowing repeated packets to revive them', async () => {
    const { startHeroAction, getHeroAction, serializeHeroAction, receiveHeroAction } = await import('../../src/render/hero_action.js');
    const hero = { hp: 100 };
    startHeroAction(hero, 'skill_r', 1000);
    const packet = serializeHeroAction(hero, 1100);
    hero.hp = 0;
    assertEqual(getHeroAction(hero, 1150), null);
    hero.hp = 100;
    assertEqual(receiveHeroAction(hero, packet, 1200), false);
    assertEqual(getHeroAction(hero, 1200), null);
  });
});
