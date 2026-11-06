// Wire state contains values and IDs, never callbacks or another machine's clock.
import { Entity, HeroEntity } from '../entities/entity.js';
import { MinionUnit, MinionProjectile } from '../world/minion.js';
import { DefensiveTower, TowerProjectile } from '../world/tower.js';
import { GroundHazard, StoneColossusBoss, AbyssalBehemothBoss, NexusGuardianBoss } from '../world/boss.js';
import { HeroProjectile } from '../combat/projectile.js';
import { HeroInventory, ITEM_CATALOG } from '../systems/items.js';
import { getHeroKit } from '../entities/heroes.js';
import { serializeHeroAction, receiveHeroAction } from '../render/hero_action.js';

export const WORLD_PROTOCOL_VERSION = 2;
const CLASSES = { Entity, HeroEntity, MinionUnit, MinionProjectile, DefensiveTower, TowerProjectile,
  GroundHazard, StoneColossusBoss, AbyssalBehemothBoss, NexusGuardianBoss, HeroProjectile };
const REFS = ['parentTower', 'target', 'currentTarget', 'targetEntity', 'attackTarget', 'hero', 'tauntTarget'];
const EXCLUDED = new Set([...REFS, 'isLocalPlayer', 'visualActionSequence']);
const UNSAFE = new Set(['__proto__', 'prototype', 'constructor']);
const isScalar = value => value === null || typeof value === 'boolean' || typeof value === 'string'
  || (typeof value === 'number' && Number.isFinite(value));
const copy = value => JSON.parse(JSON.stringify(value));

function valuesOf(object, now) {
  const values = {};
  const remaining = {};
  for (const [key, value] of Object.entries(object || {})) {
    if (EXCLUDED.has(key) || UNSAFE.has(key) || !isScalar(value)) continue;
    if (key.endsWith('Until') && typeof value === 'number') remaining[key] = Math.max(0, value - now);
    else values[key] = value;
  }
  return { values, remaining };
}

function packEntity(entity, now) {
  const kind = entity.constructor.name;
  if (!CLASSES[kind]) throw new Error('Unsupported world entity: ' + kind);
  const packet = { kind, id: entity.id, ...valuesOf(entity, now), refs: {} };
  for (const key of REFS) if (entity[key]?.id) packet.refs[key] = entity[key].id;
  if (entity.type === 'hero') {
    packet.abilities = copy(entity.abilities || {});
    packet.baseStats = copy(entity.baseStats || {});
    packet.items = (entity.inventoryInstance?.slots || entity.inventory || []).map(item => item?.id || null);
    packet.visualAction = serializeHeroAction(entity, now) || null;
    packet.attackMoveDestination = entity.attackMoveDestination ? copy(entity.attackMoveDestination) : null;
  }
  if (entity.activeProjectiles) packet.projectiles = entity.activeProjectiles.map(p => packEntity(p, now));
  return packet;
}

export function createWorldSnapshot(sim, options = {}) {
  const now = options.now ?? Date.now();
  return {
    type: 'WORLD_SNAPSHOT',
    protocolVersion: WORLD_PROTOCOL_VERSION,
    matchId: options.matchId || sim.network?.matchId || 'local',
    sequence: options.sequence ?? ((sim._outgoingWorldSequence = (sim._outgoingWorldSequence || 0) + 1)),
    tick: sim.loop?.tickCount || 0,
    matchTime: sim.matchTime || 0,
    isVictory: !!sim.isVictory,
    isDefeat: !!sim.isDefeat,
    entities: sim.entities.map(entity => packEntity(entity, now)),
    heroProjectiles: (sim.heroProjectiles || []).map(p => packEntity(p, now)),
    wave: { ...valuesOf(sim.waveSpawner, now).values,
      spawnQueue: copy(sim.waveSpawner?.spawnQueue || []),
      projectiles: (sim.waveSpawner?.activeProjectiles || []).map(p => packEntity(p, now)) },
    bosses: {
      supremeId: sim.bossManager?.supremeBoss?.id || null,
      activeIds: (sim.bossManager?.activeBosses || []).map(b => b.id),
      colossusSpawned: !!sim.bossManager?.colossusSpawned,
      behemothSpawned: !!sim.bossManager?.behemothSpawned,
      hazards: (sim.bossManager?.activeHazards || []).map(h => packEntity(h, now))
    }
  };
}

function validTree(value, depth = 0) {
  if (depth > 10) return false;
  if (isScalar(value)) return typeof value !== 'string' || value.length <= 2000;
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.length <= 5000 && value.every(v => validTree(v, depth + 1));
  const entries = Object.entries(value);
  return entries.length <= 200 && entries.every(([key, item]) => !UNSAFE.has(key) && validTree(item, depth + 1));
}

function validEntity(packet, ids) {
  if (!packet || !Object.hasOwn(CLASSES, packet.kind) || typeof packet.id !== 'string'
      || !packet.id || packet.id.length > 120 || ids.has(packet.id)
      || !packet.values || !packet.remaining || !packet.refs) return false;
  ids.add(packet.id);
  if (Object.values(packet.values).some(v => !isScalar(v))
      || Object.values(packet.remaining).some(v => !Number.isFinite(v) || v < 0)
      || Object.values(packet.refs).some(v => typeof v !== 'string')) return false;
  if (packet.values.id !== packet.id) return false;
  if (!Number.isFinite(packet.values.x) || !Number.isFinite(packet.values.y)) return false;
  if (packet.kind === 'HeroEntity') {
    if (!packet.baseStats || typeof packet.baseStats !== 'object' || Array.isArray(packet.baseStats)
        || !packet.abilities || !Array.isArray(packet.items) || packet.items.length > 6
        || packet.items.some(id => id !== null && !Object.hasOwn(ITEM_CATALOG, id))
        || !Number.isFinite(packet.values.hp) || !Number.isFinite(packet.values.mana)) return false;
    for (const slot of ['Q', 'W', 'E', 'R']) {
      const ability = packet.abilities[slot];
      if (!ability || !Number.isInteger(ability.rank) || ability.rank < 0 || ability.rank > 4
          || !Number.isFinite(ability.cooldownRemaining) || ability.cooldownRemaining < 0) return false;
    }
  }
  return !packet.projectiles || (Array.isArray(packet.projectiles)
    && packet.projectiles.every(p => validEntity(p, ids)));
}

export function isWorldSnapshotValid(packet) {
  if (!packet || packet.type !== 'WORLD_SNAPSHOT' || packet.protocolVersion !== WORLD_PROTOCOL_VERSION
      || typeof packet.matchId !== 'string' || !packet.matchId || packet.matchId.length > 120
      || !Number.isSafeInteger(packet.sequence) || packet.sequence <= 0
      || !Number.isSafeInteger(packet.tick) || packet.tick < 0
      || !Number.isFinite(packet.matchTime) || packet.matchTime < 0
      || typeof packet.isVictory !== 'boolean' || typeof packet.isDefeat !== 'boolean'
      || !Array.isArray(packet.entities) || !Array.isArray(packet.heroProjectiles)
      || !packet.wave || !Array.isArray(packet.wave.projectiles) || !Array.isArray(packet.wave.spawnQueue)
      || !packet.bosses || !Array.isArray(packet.bosses.hazards) || !Array.isArray(packet.bosses.activeIds)
      || typeof packet.bosses.colossusSpawned !== 'boolean' || typeof packet.bosses.behemothSpawned !== 'boolean'
      || !validTree(packet)) return false;
  const ids = new Set();
  return [...packet.entities, ...packet.heroProjectiles, ...packet.wave.projectiles, ...packet.bosses.hazards]
    .every(entity => validEntity(entity, ids));
}

function makeEntity(packet) {
  const options = packet.values;
  if (packet.kind === 'HeroEntity') return new HeroEntity({ ...options, abilities: getHeroKit(options.heroId) });
  return new CLASSES[packet.kind](options);
}

export function applyWorldSnapshot(sim, packet, options = {}) {
  if (!isWorldSnapshotValid(packet) || (sim._worldMatchId && sim._worldMatchId !== packet.matchId)
      || packet.sequence <= (sim._worldSnapshotSequence || 0)) return false;
  const localId = sim.network?.myPlayerId || sim.playerHero?.id;
  if (!packet.entities.some(e => e.id === localId && e.kind === 'HeroEntity')) return false;
  const now = options.now ?? Date.now();
  const previousGold = sim.playerHero?.gold;
  const previousItems = sim.playerHero?.inventoryInstance?.slots.map(item => item?.id || '').join(',');
  const existing = new Map(sim.entities.map(e => [e.id, e]));
  const receivedAt = performance.now();
  const hasPreviousSnapshot = !!sim._worldSnapshotSequence;
  const allObjects = new Map();
  const pendingRefs = [];
  function hydrate(data) {
    const previous = existing.get(data.id);
    const entity = previous?.constructor.name === data.kind ? previous : makeEntity(data);
    const interpolate = hasPreviousSnapshot && previous && !previous.isDead && Number.isFinite(data.values.x)
      && Number.isFinite(data.values.y) && Math.hypot(previous.x - data.values.x, previous.y - data.values.y) <= 180;
    const presentation = {
      _snapshotPreviousX: interpolate ? previous.x : data.values.x,
      _snapshotPreviousY: interpolate ? previous.y : data.values.y,
      _snapshotInterval: Math.max(16, Math.min(150, receivedAt - (entity._snapshotReceivedAt || receivedAt - 50))),
      _snapshotReceivedAt: receivedAt
    };
    for (const [key, value] of Object.entries(presentation)) {
      Object.defineProperty(entity, key, { value, writable: true, configurable: true, enumerable: false });
    }
    for (const [key, value] of Object.entries(data.values)) {
      if (!EXCLUDED.has(key) && !UNSAFE.has(key) && typeof entity[key] !== 'function') entity[key] = value;
    }
    for (const [key, remaining] of Object.entries(data.remaining)) {
      if (key.endsWith('Until') && !UNSAFE.has(key)) entity[key] = remaining > 0 ? now + remaining : 0;
    }
    if (data.kind === 'HeroEntity') {
      entity.isLocalPlayer = data.id === localId;
      entity.abilities = copy(data.abilities);
      entity.baseStats = copy(data.baseStats);
      entity.inventoryInstance ||= new HeroInventory(entity);
      entity.inventoryInstance.slots = [...data.items.map(id => id ? ITEM_CATALOG[id] : null)];
      while (entity.inventoryInstance.slots.length < 6) entity.inventoryInstance.slots.push(null);
      entity.inventory = entity.inventoryInstance.slots;
      entity.attackMoveDestination = data.attackMoveDestination ? copy(data.attackMoveDestination) : null;
      receiveHeroAction(entity, data.visualAction, now);
    }
    allObjects.set(data.id, entity);
    pendingRefs.push([entity, data.refs]);
    if (data.projectiles) entity.activeProjectiles = data.projectiles.map(hydrate);
    return entity;
  }
  const entities = packet.entities.map(hydrate);
  const projectiles = packet.heroProjectiles.map(hydrate);
  const minionProjectiles = packet.wave.projectiles.map(hydrate);
  const hazards = packet.bosses.hazards.map(hydrate);
  for (const [entity, refs] of pendingRefs) {
    for (const key of REFS) entity[key] = refs[key] ? allObjects.get(refs[key]) || null : null;
  }
  // Preserve the array observed by input and other UI controllers.
  sim.entities.splice(0, sim.entities.length, ...entities);
  sim.playerHero = allObjects.get(localId);
  sim.remoteHeroes = new Map(entities.filter(e => e.type === 'hero' && e.id !== localId).map(e => [e.id, e]));
  sim.towers = entities.filter(e => e instanceof DefensiveTower);
  sim.alliedNexus = entities.find(e => e.type === 'nexus' && e.team === 'allied');
  sim.enemyNexus = entities.find(e => e.type === 'nexus' && e.team === 'enemy');
  sim.heroProjectiles = projectiles;
  const { projectiles: ignored, ...waveValues } = packet.wave;
  Object.assign(sim.waveSpawner, copy(waveValues), { activeProjectiles: minionProjectiles });
  Object.assign(sim.bossManager, {
    supremeBoss: allObjects.get(packet.bosses.supremeId) || null,
    activeBosses: packet.bosses.activeIds.map(id => allObjects.get(id)).filter(Boolean),
    activeHazards: hazards,
    colossusSpawned: packet.bosses.colossusSpawned,
    behemothSpawned: packet.bosses.behemothSpawned
  });
  sim.matchTime = packet.matchTime;
  sim.worldTick = packet.tick;
  sim.isVictory = packet.isVictory;
  sim.isDefeat = packet.isDefeat;
  sim._worldMatchId = packet.matchId;
  sim._worldSnapshotSequence = packet.sequence;
  sim.worldReady = true;
  if (sim.input) {
    sim.input.entityManager = sim.entities;
    sim.input.setPlayerHero?.(sim.playerHero);
  }
  sim.map?.syncStructuresFromEntities?.(sim.entities);
  if (typeof document !== 'undefined' && previousGold !== sim.playerHero.gold) sim.shopUI?.updateGoldDisplay?.();
  if (typeof document !== 'undefined' && previousItems !== sim.playerHero.inventoryInstance.slots.map(item => item?.id || '').join(',')) {
    sim.shopUI?.updateHUDInventory?.();
  }
  return true;
}
