/**
 * Minion Waves, AI State Machine, Navigation Waypoints & Leash Boundaries.
 *
 * Source: PROJECT.md §Feature Inventory (24-27) & spec_miner_engine_r0/handoff.md §3
 */

import { Entity } from '../entities/entity.js';
import { worldToScreen } from '../core/isometric.js';
import { getMinionSprite, drawChibiSprite } from '../render/sprite_loader.js';

export const WAVE_INTERVAL = 25.0; // 25s between waves (fluxo acelerado de hordas)
export const FIRST_WAVE_TIME = 8.0; // Primeira horda aos 8s de partida
export const LEASH_MAX_DISTANCE = 400; // Leash break distance

export const LANE_WAYPOINTS = [
  { x: 400, y: 400 },   // WP0: Allied base
  { x: 800, y: 800 },   // WP1: Outer allied
  { x: 1200, y: 1200 }, // WP2: Inner allied
  { x: 1600, y: 1600 }, // WP3: Center river
  { x: 2000, y: 2000 }, // WP4: Inner enemy
  { x: 2400, y: 2400 }, // WP5: Outer enemy
  { x: 2800, y: 2800 }  // WP6: Enemy base
];

export const MinionAIState = {
  MARCH: 'MARCH',
  ACQUIRE: 'ACQUIRE',
  ATTACK: 'ATTACK',
  PURSUE: 'PURSUE',
  LEASH_RETURN: 'LEASH_RETURN'
};

export const MINION_BASE_STATS = {
  melee: {
    hp: 450,
    hpGrowth: 20,
    ad: 20,
    adGrowth: 2,
    armor: 10,
    mr: 0,
    speed: 280,
    range: 110,
    attackSpeed: 1.0,
    bounty: 21,
    radius: 14,
    height: 26
  },
  ranged: {
    hp: 280,
    hpGrowth: 15,
    ad: 28,
    adGrowth: 2,
    armor: 0,
    mr: 0,
    speed: 280,
    range: 350,
    attackSpeed: 0.8,
    projectileSpeed: 600,
    bounty: 14,
    radius: 14,
    height: 26
  },
  cannon: {
    hp: 800,
    hpGrowth: 40,
    ad: 45,
    adGrowth: 3,
    armor: 20,
    mr: 10,
    speed: 260,
    range: 450,
    attackSpeed: 0.65,
    projectileSpeed: 700,
    bounty: 45,
    structureDamageMultiplier: 1.5,
    radius: 20,
    height: 34
  }
};

/**
 * Returns minion counts for a specified wave number.
 * Every 3rd wave includes a Cannon Siege Minion.
 * @param {number} waveIndex
 * @returns {{ waveIndex: number, meleeCount: number, rangedCount: number, cannonCount: number, totalUnits: number }}
 */
export function getWaveComposition(waveIndex) {
  const isCannonWave = waveIndex % 3 === 0;
  return {
    waveIndex,
    meleeCount: 3,
    rangedCount: 3,
    cannonCount: isCannonWave ? 1 : 0,
    totalUnits: isCannonWave ? 7 : 6
  };
}

/**
 * Checks whether minion has been pulled beyond leash boundary from its lane waypoint.
 * @param {{ x: number, y: number }} minionPos
 * @param {{ x: number, y: number }} currentWaypointPos
 * @returns {boolean}
 */
export function shouldDisengageLeash(minionPos, currentWaypointPos) {
  if (!minionPos || !currentWaypointPos) return false;
  const dist = Math.hypot(minionPos.x - currentWaypointPos.x, minionPos.y - currentWaypointPos.y);
  return dist > LEASH_MAX_DISTANCE;
}

/**
 * Resolves gold bounties on minion fatal blow.
 * Only awards bounty if killer is a hero.
 * @param {'melee' | 'ranged' | 'cannon'} minionType
 * @param {Object} killerEntity
 * @param {Array<Object>} [nearbyAllies=[]]
 * @returns {{ awardedKillerGold: number, awardedAssistGold: Array<{ heroId: string, gold: number }>, reason: string }}
 */
export function resolveMinionDeath(minionType, killerEntity, nearbyAllies = []) {
  const bounties = {
    melee: 21,
    ranged: 14,
    cannon: 45
  };

  const baseBounty = bounties[minionType] || 0;

  if (!killerEntity || killerEntity.type !== 'hero') {
    return {
      awardedKillerGold: 0,
      awardedAssistGold: [],
      reason: 'denied_by_non_hero'
    };
  }

  const assists = [];
  if (nearbyAllies.length > 0) {
    const assistAmount = Math.floor(baseBounty * 0.30);
    for (const ally of nearbyAllies) {
      if (ally && ally.id !== killerEntity.id) {
        assists.push({
          heroId: ally.id,
          gold: assistAmount
        });
      }
    }
  }

  return {
    awardedKillerGold: baseBounty,
    awardedAssistGold: assists,
    reason: 'hero_last_hit'
  };
}

/**
 * Ranged or Cannon minion projectile.
 */
export class MinionProjectile {
  constructor(options = {}) {
    this.id = options.id || `minproj_${Math.random().toString(36).substring(2, 9)}`;
    this.type = 'minion_projectile';
    this.sourceId = options.sourceId || null;
    this.team = options.team || 'allied';
    this.target = options.target || null;
    this.damage = Number.isFinite(options.damage) ? options.damage : 25;
    this.speed = options.speed || 600;
    this.subType = options.subType || 'ranged'; // 'ranged' | 'cannon'
    this.x = options.x ?? 0;
    this.y = options.y ?? 0;
    this.z = options.z ?? 18;
    this.radius = this.subType === 'cannon' ? 7 : 4;
    this.isDead = false;
  }

  update(dt, simulation = null) {
    if (this.isDead) return;

    const target = this.target;
    const isTargetAlive = target && (typeof target.isAlive === 'function' ? target.isAlive() : target.hp > 0);
    if (!isTargetAlive) {
      this.isDead = true;
      return;
    }

    const tx = target.x;
    const ty = target.y;
    const tz = (target.height ? target.height * 0.5 : 15);

    const dx = tx - this.x;
    const dy = ty - this.y;
    const dz = tz - this.z;
    const dist = Math.hypot(dx, dy, dz);
    const step = this.speed * dt;

    if (dist <= step || dist <= (this.radius + (target.radius || 15))) {
      this.x = tx;
      this.y = ty;
      this.z = tz;
      this.isDead = true;

      // Apply damage
      if (typeof target.takeDamage === 'function') {
        target.takeDamage(this.damage, 'physical');
      } else {
        const currentHp = Number.isFinite(target.hp) ? target.hp : 0;
        target.hp = Math.max(0, currentHp - this.damage);
      }

      if (simulation?.particles) {
        const color = this.team === 'allied' ? '#38bdf8' : '#ef4444';
        simulation.particles.emit('spark', { x: tx, y: ty, z: tz, count: 8, color });
      }
    } else {
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
      this.z += (dz / dist) * step;
    }
  }

  draw(ctx, camera, zoom = 1.0) {
    if (!ctx || this.isDead) return;
    const { sx, sy } = worldToScreen(this.x, this.y, this.z, camera, zoom);

    ctx.save();
    const color = this.team === 'allied' ? '#38bdf8' : '#f87171';
    const r = Math.max(3, this.radius * zoom);

    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fillStyle = this.subType === 'cannon' ? '#fbbf24' : color;
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Minion Unit Entity with AI State Machine and Waypoint Navigation.
 */
export class MinionUnit extends Entity {
  constructor(options = {}) {
    const subType = options.subType || 'melee';
    const waveIndex = options.waveIndex || 1;
    const baseStats = MINION_BASE_STATS[subType] || MINION_BASE_STATS.melee;

    const maxHp = options.maxHp ?? (baseStats.hp + (waveIndex - 1) * baseStats.hpGrowth);
    const ad = options.attackDamage ?? (baseStats.ad + (waveIndex - 1) * baseStats.adGrowth);

    super({
      id: options.id || `minion_${options.team || 'allied'}_${Math.random().toString(36).substring(2, 9)}`,
      name: `${options.team === 'allied' ? 'Lacaio Aliado' : 'Lacaio Inimigo'} (${subType})`,
      type: 'minion',
      team: options.team || 'allied',
      x: options.x ?? (options.team === 'allied' ? 400 : 2800),
      y: options.y ?? (options.team === 'allied' ? 400 : 2800),
      z: 0,
      radius: baseStats.radius,
      selectionRadius: baseStats.radius * 1.5,
      height: baseStats.height,
      speed: baseStats.speed,
      maxHp: maxHp,
      hp: options.hp ?? maxHp,
      armor: baseStats.armor,
      magicResist: baseStats.mr,
      attackDamage: ad
    });

    this.subType = subType;
    this.waveIndex = waveIndex;
    this.attackDamage = ad;
    this.armor = baseStats.armor;
    this.magicResist = baseStats.mr;
    this.bounty = baseStats.bounty;
    this.attackRange = baseStats.range;
    this.attackSpeed = baseStats.attackSpeed;
    this.projectileSpeed = baseStats.projectileSpeed || 0;
    this.structureDamageMultiplier = baseStats.structureDamageMultiplier || 1.0;

    this.waypointIndex = this.team === 'allied' ? 0 : (LANE_WAYPOINTS.length - 1);
    this.aiState = MinionAIState.MARCH;
    this.targetEntity = null;
    this.attackCooldown = 0;
    this.aggroRadius = 300;
  }

  isAlive() {
    return !this.isDead && this.hp > 0;
  }

  takeDamage(amount, type = 'physical', killer = null) {
    if (!this.isAlive()) return { damageTaken: 0, isFatal: false };
    const taken = Math.min(this.hp, amount);
    this.hp -= taken;
    const isFatal = this.hp <= 0;
    if (isFatal) {
      this.isDead = true;
    }
    return { damageTaken: taken, isFatal, killer };
  }

  update(dt = 0.01667, entities = [], activeProjectiles = [], particles = null) {
    if (!this.isAlive()) return;

    if (this.attackCooldown > 0) {
      this.attackCooldown -= dt;
    }

    const currentWp = LANE_WAYPOINTS[this.waypointIndex] || LANE_WAYPOINTS[0];

    // State 1: LEASH_RETURN (Returning to lane)
    if (this.aiState === MinionAIState.LEASH_RETURN) {
      const dx = currentWp.x - this.x;
      const dy = currentWp.y - this.y;
      const distToWp = Math.hypot(dx, dy);

      if (distToWp <= 50) {
        this.aiState = MinionAIState.MARCH;
        this.targetEntity = null;
      } else {
        const step = this.speed * dt;
        this.x += (dx / distToWp) * step;
        this.y += (dy / distToWp) * step;
        this.facing = Math.atan2(dy, dx);
      }
      return;
    }

    // Leash boundary check from current waypoint
    if (shouldDisengageLeash(this, currentWp)) {
      this.aiState = MinionAIState.LEASH_RETURN;
      this.targetEntity = null;
      return;
    }

    // Target validity check
    if (this.targetEntity) {
      const isTargetAlive = typeof this.targetEntity.isAlive === 'function'
        ? this.targetEntity.isAlive()
        : (this.targetEntity.hp > 0 && !this.targetEntity.isDead);

      if (!isTargetAlive) {
        this.targetEntity = null;
        this.aiState = MinionAIState.MARCH;
      }
    }

    // Scan for hostile targets if marching
    if (this.aiState === MinionAIState.MARCH) {
      let bestTarget = null;
      let highestPriority = -1;
      let closestDist = Infinity;

      for (const ent of entities) {
        if (!ent || ent.id === this.id) continue;
        const isDead = typeof ent.isDead === 'function' ? ent.isDead() : !!ent.isDead;
        if (isDead || (typeof ent.hp === 'number' && ent.hp <= 0)) continue;
        if (ent.team === this.team || ent.team === 'neutral') continue;

        const dist = Math.hypot(ent.x - this.x, ent.y - this.y);
        if (dist <= this.aggroRadius) {
          // Priority: minion (3) > hero (2) > tower/nexus/boss (1)
          let prio = 1;
          if (ent.type === 'minion') prio = 3;
          else if (ent.type === 'hero') prio = 2;

          if (prio > highestPriority || (prio === highestPriority && dist < closestDist)) {
            highestPriority = prio;
            closestDist = dist;
            bestTarget = ent;
          }
        }
      }

      if (bestTarget) {
        this.targetEntity = bestTarget;
        this.aiState = MinionAIState.ACQUIRE;
      }
    }

    // State 2: MARCH (Follow waypoints down lane)
    if (this.aiState === MinionAIState.MARCH) {
      const dx = currentWp.x - this.x;
      const dy = currentWp.y - this.y;
      const distToWp = Math.hypot(dx, dy);

      if (distToWp <= 45) {
        if (this.team === 'allied' && this.waypointIndex < LANE_WAYPOINTS.length - 1) {
          this.waypointIndex++;
        } else if (this.team === 'enemy' && this.waypointIndex > 0) {
          this.waypointIndex--;
        }
      } else {
        const step = this.speed * dt;
        this.x += (dx / distToWp) * step;
        this.y += (dy / distToWp) * step;
        this.facing = Math.atan2(dy, dx);
      }
      return;
    }

    // State 3: ACQUIRE / PURSUE / ATTACK
    if (this.targetEntity) {
      const dx = this.targetEntity.x - this.x;
      const dy = this.targetEntity.y - this.y;
      const distToTarget = Math.hypot(dx, dy);
      const targetRadius = this.targetEntity.radius || 20;
      const effectiveRange = this.attackRange + targetRadius;

      this.facing = Math.atan2(dy, dx);

      if (distToTarget <= effectiveRange) {
        this.aiState = MinionAIState.ATTACK;

        if (this.attackCooldown <= 0) {
          const baseAd = Number.isFinite(this.attackDamage) ? this.attackDamage : (MINION_BASE_STATS[this.subType]?.ad || 20);
          let damage = baseAd;
          if (this.subType === 'cannon' && (this.targetEntity.type === 'tower' || this.targetEntity.type === 'nexus')) {
            damage *= this.structureDamageMultiplier;
          }

          if (this.subType === 'melee') {
            // Direct attack
            if (typeof this.targetEntity.takeDamage === 'function') {
              this.targetEntity.takeDamage(damage, 'physical');
            } else {
              const currentHp = Number.isFinite(this.targetEntity.hp) ? this.targetEntity.hp : 0;
              this.targetEntity.hp = Math.max(0, currentHp - damage);
            }
            if (particles) {
              const color = this.team === 'allied' ? '#38bdf8' : '#ef4444';
              particles.emit('spark', { x: this.targetEntity.x, y: this.targetEntity.y, count: 6, color });
            }
          } else {
            // Ranged or Cannon projectile
            const proj = new MinionProjectile({
              sourceId: this.id,
              team: this.team,
              target: this.targetEntity,
              damage,
              speed: this.projectileSpeed,
              subType: this.subType,
              x: this.x,
              y: this.y,
              z: this.height * 0.8
            });
            activeProjectiles.push(proj);
          }

          this.attackCooldown = 1.0 / this.attackSpeed;
        }
      } else {
        // Pursue
        this.aiState = MinionAIState.PURSUE;
        const step = this.speed * dt;
        this.x += (dx / distToTarget) * step;
        this.y += (dy / distToTarget) * step;
      }
    }
  }

  draw(ctx, camera, zoom = 1.0) {
    if (!ctx || !this.isAlive()) return;
    const { sx, sy } = worldToScreen(this.x, this.y, this.z, camera, zoom);

    ctx.save();
    const isAllied = this.team === 'allied';
    const r = Math.max(8, this.radius * zoom);
    const h = this.height * zoom;

    const color = isAllied ? '#0284c7' : '#b91c1c';
    const trimColor = isAllied ? '#38bdf8' : '#f87171';

    // Subtle ground faction ring
    ctx.beginPath();
    ctx.ellipse(sx, sy, r * 0.95, (r * 0.95) * 0.48, 0, 0, Math.PI * 2);
    ctx.fillStyle = isAllied ? 'rgba(56, 189, 248, 0.20)' : 'rgba(239, 68, 68, 0.20)';
    ctx.fill();
    ctx.strokeStyle = trimColor;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Direction pointer screen projection
    const fx = sx + Math.cos(this.facing) * r * 1.2;
    const fy = sy - h * 0.35 + Math.sin(this.facing) * (r * 0.5) * 1.2;
    const flipX = (fx - sx) < -1.0;

    // Render Chibi 1.5-head Minion Sprite (melee, ranged, cannon)
    const sprite = getMinionSprite(this.subType, this.team);
    const spriteSize = (this.subType === 'cannon' ? 68 : 50) * zoom;
    const isMoving = this.aiState === MinionAIState.MARCH || this.aiState === MinionAIState.PURSUE || this.aiState === MinionAIState.LEASH_RETURN;
    const drewSprite = drawChibiSprite(ctx, sprite, sx, sy + 5 * zoom, spriteSize, spriteSize, {
      isMoving,
      flipX,
      phaseOffset: (this.x + this.y) * 0.02
    });

    if (!drewSprite) {
      // Fallback procedural 2.5D cylinder
      ctx.beginPath();
      ctx.ellipse(sx, sy, r, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(sx, sy - h * 0.7, r * 0.8, (r * 0.8) * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = trimColor;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();

      if (this.subType === 'cannon') {
        ctx.beginPath();
        ctx.arc(sx, sy - h * 0.7, 4 * zoom, 0, Math.PI * 2);
        ctx.fillStyle = '#fbbf24';
        ctx.fill();
      }

      ctx.beginPath();
      ctx.moveTo(sx, sy - h * 0.35);
      ctx.lineTo(fx, fy);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  }

  drawHUD(ctx, camera, zoom = 1.0) {
    if (!ctx || !this.isAlive()) return;
    const { sx, sy } = worldToScreen(this.x, this.y, this.z, camera, zoom);

    const barW = (this.subType === 'cannon' ? 46 : 36) * zoom;
    const barH = 4 * zoom;
    const offsetY = (this.height + 8) * zoom;
    const hpRatio = Math.max(0, Math.min(1, this.hp / this.maxHp));

    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(sx - barW * 0.5, sy - offsetY, barW, barH);

    ctx.fillStyle = this.team === 'allied' ? '#38bdf8' : '#ef4444';
    ctx.fillRect(sx - barW * 0.5 + 1, sy - offsetY + 1, (barW - 2) * hpRatio, barH - 2);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx - barW * 0.5, sy - offsetY, barW, barH);
    ctx.restore();
  }
}

/**
 * Minion Wave Spawner managing match pacing and release queues.
 */
export class WaveSpawner {
  constructor(simulation = null, options = {}) {
    this.simulation = simulation;
    this.waveInterval = options.waveInterval || WAVE_INTERVAL;
    this.firstWaveTime = options.firstWaveTime || FIRST_WAVE_TIME;
    this.autoUpdateMinions = options.autoUpdateMinions ?? (this.simulation !== null);

    this.matchTime = 0;
    this.waveIndex = 0;
    this.nextWaveTime = this.firstWaveTime;
    this.spawnQueue = [];
    this.activeProjectiles = [];
  }

  queueWave(waveIndex) {
    const comp = getWaveComposition(waveIndex);

    // Stagger minion releases by 0.22s to deploy cohesive hordes
    let delay = 0;
    const stagger = 0.22;

    // Melee units (3)
    for (let i = 0; i < comp.meleeCount; i++) {
      this.spawnQueue.push({ team: 'allied', subType: 'melee', waveIndex, delayRemaining: delay, offsetIdx: i });
      this.spawnQueue.push({ team: 'enemy', subType: 'melee', waveIndex, delayRemaining: delay, offsetIdx: i });
      delay += stagger;
    }

    // Ranged units (3)
    for (let i = 0; i < comp.rangedCount; i++) {
      this.spawnQueue.push({ team: 'allied', subType: 'ranged', waveIndex, delayRemaining: delay, offsetIdx: i + 3 });
      this.spawnQueue.push({ team: 'enemy', subType: 'ranged', waveIndex, delayRemaining: delay, offsetIdx: i + 3 });
      delay += stagger;
    }

    // Cannon unit (1 if applicable)
    if (comp.cannonCount > 0) {
      this.spawnQueue.push({ team: 'allied', subType: 'cannon', waveIndex, delayRemaining: delay, offsetIdx: 6 });
      this.spawnQueue.push({ team: 'enemy', subType: 'cannon', waveIndex, delayRemaining: delay, offsetIdx: 6 });
    }
  }

  update(dt = 0.01667, entities = []) {
    this.matchTime += dt;

    let catchUpLimit = 50;
    while (this.matchTime >= this.nextWaveTime && this.waveInterval > 0 && catchUpLimit-- > 0) {
      this.waveIndex++;
      this.queueWave(this.waveIndex);
      this.nextWaveTime += this.waveInterval;
    }
    if (this.matchTime >= this.nextWaveTime && this.waveInterval > 0) {
      this.nextWaveTime = this.matchTime + this.waveInterval;
    }

    // Process spawn queue
    const remainingQueue = [];
    for (const item of this.spawnQueue) {
      item.delayRemaining -= dt;
      if (item.delayRemaining <= 0) {
        // Lateral offset perpendicular to diagonal
        const lateral = ((item.offsetIdx % 3) - 1) * 18;
        const normX = -Math.SQRT1_2;
        const normY = Math.SQRT1_2;

        const isAllied = item.team === 'allied';
        const baseX = isAllied ? 400 : 2800;
        const baseY = isAllied ? 400 : 2800;

        const minion = new MinionUnit({
          team: item.team,
          subType: item.subType,
          waveIndex: item.waveIndex,
          x: baseX + normX * lateral,
          y: baseY + normY * lateral
        });

        entities.push(minion);
      } else {
        remainingQueue.push(item);
      }
    }
    this.spawnQueue = remainingQueue;

    // Update active minion projectiles
    for (const p of this.activeProjectiles) {
      p.update(dt, this.simulation);
    }
    this.activeProjectiles = this.activeProjectiles.filter(p => !p.isDead);

    // Update minions
    if (this.autoUpdateMinions) {
      for (const ent of entities) {
        if (ent.type === 'minion' && typeof ent.update === 'function') {
          ent.update(dt, entities, this.activeProjectiles, this.simulation?.particles);
        }
      }
    }
  }

  drawProjectiles(ctx, camera, zoom = 1.0) {
    for (const p of this.activeProjectiles) {
      p.draw(ctx, camera, zoom);
    }
  }
}
