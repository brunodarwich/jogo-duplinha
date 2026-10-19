/**
 * Defensive Towers, Aggro Priority, Heat Scaling & Homing Projectiles.
 * 
 * Source: PROJECT.md §Feature Inventory (19-24) & spec_miner_engine_r0/handoff.md §3
 */

import { Entity } from '../entities/entity.js';
import { worldToScreen } from '../core/isometric.js';
import { drawDetailed3DStructure } from '../render/sprite_loader.js';

export const TOWER_RADIUS = 400;
export const TOWER_PROJECTILE_SPEED = 750;
export const BASE_TOWER_DAMAGE = 150;
export const TOWER_ATTACK_INTERVAL = 1.0; // 1 shot per second
export const TOWER_COLLIDER_RADIUS = 40;
export const TOWER_MAX_HP = 2500;
export const TOWER_ARMOR = 50;

export const TOWER_POSITIONS = {
  allied: {
    outer: { id: 'tower_allied_outer', x: 1250, y: 1250, tier: 'outer' },
    inner: { id: 'tower_allied_inner', x: 950, y: 950, tier: 'inner' },
    nexus: { id: 'nexus_allied', x: 650, y: 650, tier: 'nexus' }
  },
  enemy: {
    outer: { id: 'tower_enemy_outer', x: 1950, y: 1950, tier: 'outer' },
    inner: { id: 'tower_enemy_inner', x: 2250, y: 2250, tier: 'inner' },
    nexus: { id: 'nexus_enemy', x: 2550, y: 2550, tier: 'nexus' }
  }
};

/**
 * Homing Projectile traveling at 750 units/s tracking a moving entity.
 */
export class TowerProjectile {
  constructor(options = {}) {
    this.id = options.id || `proj_${Math.random().toString(36).substring(2, 9)}`;
    this.type = 'projectile';
    this.towerId = options.towerId || null;
    this.team = options.team || 'allied';
    this.target = options.target || null;
    this.damage = options.damage || BASE_TOWER_DAMAGE;
    this.speed = options.speed || TOWER_PROJECTILE_SPEED;
    this.x = options.x ?? 0;
    this.y = options.y ?? 0;
    this.z = options.z ?? 80;
    this.radius = 8;
    this.isDead = false;
    this.hasImpacted = false;
  }

  isAlive() {
    return !this.isDead;
  }

  update(dt, simulation = null) {
    if (this.isDead) return;

    // Check target existence & life
    const target = this.target;
    const isTargetAlive = target && (typeof target.isAlive === 'function' ? target.isAlive() : target.hp > 0);
    if (!isTargetAlive) {
      // Dissipates mid-air if target dies
      this.isDead = true;
      return;
    }

    const tx = target.x;
    const ty = target.y;
    const tz = (target.height ? target.height * 0.5 : 20);

    const dx = tx - this.x;
    const dy = ty - this.y;
    const dz = tz - this.z;
    const dist = Math.hypot(dx, dy, dz);
    const step = this.speed * dt;

    if (dist <= step || dist <= (this.radius + (target.radius || 20))) {
      // Impact!
      this.x = tx;
      this.y = ty;
      this.z = tz;
      this.hasImpacted = true;
      this.isDead = true;

      // Calculate effective damage (e.g. Stone Colossus takes -40%)
      let effectiveDamage = this.damage;
      if (target.towerDamageReduction) {
        effectiveDamage *= (1.0 - target.towerDamageReduction);
      }

      // Apply damage
      if (typeof target.takeDamage === 'function') {
        target.takeDamage(effectiveDamage, 'physical');
      } else {
        target.hp = Math.max(0, target.hp - effectiveDamage);
      }

      // Spawn VFX and floating text if particles available
      if (simulation?.particles) {
        const color = this.team === 'allied' ? '#38bdf8' : '#ef4444';
        simulation.particles.emit('spark', { x: tx, y: ty, z: tz, count: 16, color });
        simulation.particles.addFloatingText(Math.round(effectiveDamage), tx, ty, { color, fontSize: 15 });
      }
    } else {
      // Continue homing towards target
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
      this.z += (dz / dist) * step;
    }
  }

  draw(ctx, camera, zoom = 1.0) {
    if (!ctx || this.isDead) return;
    const { sx, sy } = worldToScreen(this.x, this.y, this.z, camera, zoom);

    ctx.save();
    const color = this.team === 'allied' ? '#38bdf8' : '#ef4444';
    const r = Math.max(4, this.radius * zoom);

    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.fill();

    // Inner bright core
    ctx.beginPath();
    ctx.arc(sx, sy, r * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Defensive Tower Class with Aggro Priority, Heat Scaling, and Invulnerability Hierarchy.
 */
export class DefensiveTower extends Entity {
  constructor(idOrOptions, team, x, y, tier = 'outer', parentTower = null, options = {}) {
    const isObj = typeof idOrOptions === 'object' && idOrOptions !== null;
    const config = isObj ? idOrOptions : {
      id: idOrOptions,
      team,
      x,
      y,
      tier: tier || 'outer',
      parentTower: parentTower || null,
      ...options
    };

    const isNexus = config.tier === 'nexus';
    const colliderRadius = isNexus ? 70 : TOWER_COLLIDER_RADIUS;
    const defaultMaxHp = isNexus ? 5000 : TOWER_MAX_HP;

    super({
      id: config.id || `tower_${Math.random().toString(36).substring(2, 9)}`,
      name: config.name || (isNexus ? (config.team === 'allied' ? 'Nexus Aliado' : 'Nexus Inimigo') : 'Torre Defensiva'),
      type: isNexus ? 'nexus' : 'tower',
      team: config.team || 'allied',
      x: config.x ?? 0,
      y: config.y ?? 0,
      z: 0,
      radius: config.radius || colliderRadius,
      selectionRadius: config.selectionRadius || (isNexus ? 85 : 55),
      height: config.height || (isNexus ? 65 : 90),
      speed: 0,
      maxHp: config.maxHp ?? defaultMaxHp,
      hp: config.hp ?? config.maxHp ?? defaultMaxHp,
      armor: config.armor ?? TOWER_ARMOR
    });

    this.tier = config.tier || 'outer'; // 'outer', 'inner', 'nexus'
    this.parentTower = config.parentTower || null;
    this.attackRadius = TOWER_RADIUS;
    this.currentTarget = null;
    this.consecutiveHitsOnTarget = 0;
    this.attackCooldown = TOWER_ATTACK_INTERVAL;
    this.cooldownTimer = 0;
    this.activeProjectiles = [];
    this.isSupremeBossAlive = config.isSupremeBossAlive || null;
  }

  isInvulnerable() {
    if (this.parentTower && this.parentTower.hp > 0) {
      return true;
    }
    if (this.tier === 'nexus' && this.team === 'enemy') {
      if (typeof this.isSupremeBossAlive === 'function' && this.isSupremeBossAlive()) {
        return true;
      }
    }
    return false;
  }

  isWithinRange(entity) {
    if (!entity) return false;
    const dist = Math.hypot(entity.x - this.x, entity.y - this.y);
    return dist <= this.attackRadius;
  }

  /**
   * Evaluates tower aggro priority:
   * 1. Aggressor hero that attacked an allied hero in range (Call for Help)
   * 2. Sticky Target Lock (if current target is alive and in range)
   * 3. Unit attacking tower
   * 4. Closest enemy minion/creep in range
   * 5. Closest enemy hero in range
   */
  selectTarget(enemiesInRange = [], callForHelpAggressorId = null, unitAttackingTowerId = null) {
    // Current target valid check
    const currentInList = enemiesInRange.find(e => e.id === this.currentTarget?.id);
    const isCurrentAlive = currentInList && (typeof currentInList.isAlive === 'function' ? currentInList.isAlive() : currentInList.hp > 0);

    if (this.currentTarget && (!isCurrentAlive || !this.isWithinRange(this.currentTarget))) {
      this.currentTarget = null;
      this.consecutiveHitsOnTarget = 0;
    }

    // 1. Call for Help Aggressor (Highest Priority)
    if (callForHelpAggressorId) {
      const aggressor = enemiesInRange.find(e => e.id === callForHelpAggressorId && e.type === 'hero');
      if (aggressor) {
        if (this.currentTarget?.id !== aggressor.id) {
          this.currentTarget = aggressor;
          this.consecutiveHitsOnTarget = 0;
        }
        return this.currentTarget;
      }
    }

    // 2. Maintain sticky lock on existing valid target
    if (this.currentTarget) {
      return this.currentTarget;
    }

    // 3. Unit attacking tower
    if (unitAttackingTowerId) {
      const unit = enemiesInRange.find(e => e.id === unitAttackingTowerId);
      if (unit) {
        this.currentTarget = unit;
        this.consecutiveHitsOnTarget = 0;
        return this.currentTarget;
      }
    }

    // 4. Closest enemy minion / creep / boss
    const minions = enemiesInRange.filter(e => e.type === 'minion' || e.type === 'creep' || e.type === 'boss');
    if (minions.length > 0) {
      minions.sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y));
      this.currentTarget = minions[0];
      this.consecutiveHitsOnTarget = 0;
      return this.currentTarget;
    }

    // 5. Closest enemy hero
    const heroes = enemiesInRange.filter(e => e.type === 'hero');
    if (heroes.length > 0) {
      heroes.sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y));
      this.currentTarget = heroes[0];
      this.consecutiveHitsOnTarget = 0;
      return this.currentTarget;
    }

    this.currentTarget = null;
    this.consecutiveHitsOnTarget = 0;
    return null;
  }

  /**
   * Tower heat scaling: +25% per consecutive shot on the same hero, capped at +100% (2.0x).
   */
  calculateShotDamage(target) {
    if (!target) return 0;
    let multiplier = 1.0;
    if (target.type === 'hero') {
      const bonus = Math.min(1.0, this.consecutiveHitsOnTarget * 0.25);
      multiplier = 1.0 + bonus;
    }
    return BASE_TOWER_DAMAGE * multiplier;
  }

  recordShot(target) {
    if (!target) return;
    if (this.currentTarget && this.currentTarget.id === target.id) {
      if (target.type === 'hero') {
        this.consecutiveHitsOnTarget++;
      }
    } else {
      this.currentTarget = target;
      this.consecutiveHitsOnTarget = target.type === 'hero' ? 1 : 0;
    }
  }

  takeDamage(amount) {
    if (this.isInvulnerable()) {
      return { damageTaken: 0, invulnerable: true, destroyed: false };
    }
    const damageTaken = Math.min(this.hp, amount);
    this.hp -= damageTaken;
    if (this.hp <= 0) {
      this.isDead = true;
    }
    return { damageTaken, invulnerable: false, destroyed: this.hp <= 0 };
  }

  update(dt = 0.01667, allEntities = [], callForHelpAggressorId = null, unitAttackingTowerId = null, simulation = null) {
    if (!this.isAlive()) return;

    // 1. True Sight & Enemy Filtering
    const enemiesInRange = [];
    for (const ent of allEntities) {
      if (!ent) continue;
      const isDead = typeof ent.isDead === 'function' ? ent.isDead() : !!ent.isDead;
      if (isDead || (typeof ent.hp === 'number' && ent.hp <= 0)) continue;
      if (ent.team !== this.team && ent.team !== 'neutral') {
        if (this.isWithinRange(ent)) {
          enemiesInRange.push(ent);
          ent.revealedByTrueSight = true;
        }
      }
    }

    // 2. Select / Update Target
    const target = this.selectTarget(enemiesInRange, callForHelpAggressorId, unitAttackingTowerId);

    // 3. Cooldown & Fire Projectile
    if (this.cooldownTimer > 0) {
      this.cooldownTimer -= dt;
    }

    if (target && this.cooldownTimer <= 0) {
      const damage = this.calculateShotDamage(target);
      const proj = new TowerProjectile({
        towerId: this.id,
        team: this.team,
        target,
        damage,
        x: this.x,
        y: this.y,
        z: this.height * 0.9
      });
      this.activeProjectiles.push(proj);
      this.recordShot(target);
      this.cooldownTimer = this.attackCooldown;
    }

    // 4. Update Active Projectiles
    for (const p of this.activeProjectiles) {
      p.update(dt, simulation);
    }
    this.activeProjectiles = this.activeProjectiles.filter(p => !p.isDead);
  }

  draw(ctx, camera, zoom = 1.0) {
    if (!ctx || !this.isAlive()) return;
    const { sx, sy } = worldToScreen(this.x, this.y, this.z, camera, zoom);

    drawDetailed3DStructure(ctx, this, sx, sy, zoom, camera);

    // Draw active projectiles
    for (const p of this.activeProjectiles) {
      p.draw(ctx, camera, zoom);
    }
  }

  drawHUD(ctx, camera, zoom = 1.0) {
    if (!ctx || !this.isAlive()) return;
    super.drawHUD(ctx, camera, zoom);

    // If invulnerable, render golden shield label above health bar
    if (this.isInvulnerable()) {
      const { sx, sy } = worldToScreen(this.x, this.y, this.z, camera, zoom);
      const offset = (this.height + 18) * zoom;
      ctx.save();
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🛡️ INVULNERÁVEL', sx, sy - offset);
      ctx.restore();
    }
  }
}

/**
 * Factory creating the authoritative 6-structure hierarchy for the match.
 * @param {Object} [options={}]
 */
export function createTowerHierarchy(options = {}) {
  // Allied Structures
  const alliedOuter = new DefensiveTower(
    TOWER_POSITIONS.allied.outer.id,
    'allied',
    TOWER_POSITIONS.allied.outer.x,
    TOWER_POSITIONS.allied.outer.y,
    'outer',
    null
  );

  const alliedInner = new DefensiveTower(
    TOWER_POSITIONS.allied.inner.id,
    'allied',
    TOWER_POSITIONS.allied.inner.x,
    TOWER_POSITIONS.allied.inner.y,
    'inner',
    alliedOuter
  );

  const alliedNexus = new DefensiveTower(
    TOWER_POSITIONS.allied.nexus.id,
    'allied',
    TOWER_POSITIONS.allied.nexus.x,
    TOWER_POSITIONS.allied.nexus.y,
    'nexus',
    alliedInner
  );

  // Enemy Structures
  const enemyOuter = new DefensiveTower(
    TOWER_POSITIONS.enemy.outer.id,
    'enemy',
    TOWER_POSITIONS.enemy.outer.x,
    TOWER_POSITIONS.enemy.outer.y,
    'outer',
    null
  );

  const enemyInner = new DefensiveTower(
    TOWER_POSITIONS.enemy.inner.id,
    'enemy',
    TOWER_POSITIONS.enemy.inner.x,
    TOWER_POSITIONS.enemy.inner.y,
    'inner',
    enemyOuter
  );

  const enemyNexus = new DefensiveTower(
    TOWER_POSITIONS.enemy.nexus.id,
    'enemy',
    TOWER_POSITIONS.enemy.nexus.x,
    TOWER_POSITIONS.enemy.nexus.y,
    'nexus',
    enemyInner,
    { isSupremeBossAlive: options.isSupremeBossAlive }
  );

  return {
    allied: { outer: alliedOuter, inner: alliedInner, nexus: alliedNexus },
    enemy: { outer: enemyOuter, inner: enemyInner, nexus: enemyNexus },
    allStructures: [alliedNexus, alliedInner, alliedOuter, enemyOuter, enemyInner, enemyNexus]
  };
}
