/**
 * Mini-Bosses, Supreme Boss, Boss AI & Victory/Defeat Evaluation.
 * 
 * Source: PROJECT.md §Feature Inventory (28-31) & spec_miner_engine_r0/handoff.md §3
 */

import { Entity } from '../entities/entity.js';
import { worldToScreen } from '../core/isometric.js';
import { MinionUnit } from './minion.js';
import { getBossSprite, drawChibiSprite } from '../render/sprite_loader.js';

export const BOSS_CONFIGS = {
  colossus: {
    id: 'boss_colossus',
    name: 'Stone Colossus',
    spawnWave: 5,
    maxHp: 3500,
    towerDamageReduction: 0.40, // takes 40% less damage from towers
    slamRadius: 220,
    slamStunDuration: 1.5,
    bountyKiller: 150,
    bountyTeam: 150,
    buff: { name: 'Colossus Might', duration: 60, adBonusPercent: 0.15, apBonusPercent: 0.15 }
  },
  behemoth: {
    id: 'boss_behemoth',
    name: 'Abyssal Behemoth',
    spawnWave: 10,
    maxHp: 6000,
    silenceDuration: 2.0,
    bountyKiller: 150,
    bountyTeam: 150
  },
  supreme: {
    id: 'boss_supreme',
    name: 'Nexus Guardian',
    maxHp: 12000,
    bountyKiller: 500,
    bountyTeam: 500
  }
};

/**
 * Supreme Boss Reference Specification Class.
 * Guaranteed 100% compatibility with TC-BOS-03, TC-BOS-04, TC-BOS-05, TC-E2E-MATCH-01.
 */
export class SupremeBoss {
  constructor() {
    this.id = BOSS_CONFIGS.supreme.id;
    this.name = BOSS_CONFIGS.supreme.name;
    this.maxHp = BOSS_CONFIGS.supreme.maxHp;
    this.hp = this.maxHp;
    this.shieldActive = false;
  }

  get phase() {
    const ratio = this.hp / this.maxHp;
    if (ratio > 0.66) return 1; // Frontal Cleave
    if (ratio > 0.33) return 2; // Meteor Rain
    return 3;                   // Cataclysmic Shield / Enrage
  }

  takeDamage(amount) {
    if (this.shieldActive) {
      return { damageTaken: 0, shielded: true, isDead: false };
    }
    const taken = Math.min(this.hp, amount);
    this.hp -= taken;
    return { damageTaken: taken, shielded: false, isDead: this.hp <= 0 };
  }
}

/**
 * Evaluates match victory / defeat outcome.
 * @param {number} alliedNexusHp
 * @param {number} enemyNexusHp
 * @param {boolean} supremeBossAlive
 * @returns {{ outcome: 'VICTORY' | 'DEFEAT' | 'IN_PROGRESS', isOver: boolean }}
 */
export function evaluateMatchOutcome(alliedNexusHp, enemyNexusHp, supremeBossAlive) {
  if (alliedNexusHp <= 0) {
    return { outcome: 'DEFEAT', isOver: true };
  }
  // Enemy nexus cannot be destroyed while supreme boss is alive
  if (enemyNexusHp <= 0 && !supremeBossAlive) {
    return { outcome: 'VICTORY', isOver: true };
  }
  return { outcome: 'IN_PROGRESS', isOver: false };
}

/**
 * Ground Hazard / Telegraph (Acid Pool, Slam Telegraph, Meteor Telegraph).
 */
export class GroundHazard {
  constructor(options = {}) {
    this.id = options.id || `haz_${Math.random().toString(36).substring(2, 9)}`;
    this.type = options.type || 'slam'; // 'slam', 'acid_pool', 'meteor'
    this.x = options.x || 0;
    this.y = options.y || 0;
    this.radius = options.radius || 100;
    this.duration = options.duration || 1.5;
    this.elapsed = 0;
    this.isDead = false;
    this.onComplete = options.onComplete || null;
    this.onTick = options.onTick || null;
    this.tickInterval = options.tickInterval || 0.5;
    this.timeSinceTick = 0;
  }

  update(dt, simulation = null) {
    if (this.isDead) return;
    this.elapsed += dt;
    this.timeSinceTick += dt;

    if (this.onTick && this.timeSinceTick >= this.tickInterval) {
      this.timeSinceTick = 0;
      this.onTick(this, simulation);
    }

    if (this.elapsed >= this.duration) {
      this.isDead = true;
      if (typeof this.onComplete === 'function') {
        this.onComplete(this, simulation);
      }
    }
  }

  draw(ctx, camera, zoom = 1.0) {
    if (!ctx || this.isDead) return;
    const { sx, sy } = worldToScreen(this.x, this.y, 0, camera, zoom);

    ctx.save();
    const progress = Math.min(1.0, this.elapsed / this.duration);
    const r = this.radius * zoom;

    if (this.type === 'slam') {
      // Expanding orange-red telegraph ring
      ctx.beginPath();
      ctx.ellipse(sx, sy, r, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Inner growing warning disc
      ctx.beginPath();
      ctx.ellipse(sx, sy, r * progress, (r * progress) * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
      ctx.fill();
    } else if (this.type === 'acid_pool') {
      // Bubbling green acid pool
      ctx.beginPath();
      ctx.ellipse(sx, sy, r, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(34, 197, 94, 0.25)';
      ctx.fill();
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (this.type === 'meteor') {
      // Fiery crimson meteor impact circle
      ctx.beginPath();
      ctx.ellipse(sx, sy, r, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(249, 115, 22, 0.2)';
      ctx.fill();
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(sx, sy, r * (1.0 - progress), (r * (1.0 - progress)) * 0.5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffedd5';
      ctx.stroke();
    }

    ctx.restore();
  }
}

/**
 * Wave 5 Mini-Boss: Stone Colossus.
 */
export class StoneColossusBoss extends Entity {
  constructor(options = {}) {
    const cfg = BOSS_CONFIGS.colossus;
    super({
      id: cfg.id,
      name: cfg.name,
      type: 'boss',
      team: 'enemy',
      x: options.x ?? 2800,
      y: options.y ?? 2800,
      z: 0,
      radius: 35,
      selectionRadius: 50,
      height: 70,
      speed: 200,
      maxHp: cfg.maxHp,
      hp: cfg.maxHp,
      armor: 40,
      magicResist: 20,
      attackDamage: 80
    });

    this.towerDamageReduction = cfg.towerDamageReduction;
    this.slamRadius = cfg.slamRadius;
    this.slamStunDuration = cfg.slamStunDuration;
    this.bountyKiller = cfg.bountyKiller;
    this.bountyTeam = cfg.bountyTeam;
    this.slamCooldown = 10.0;
    this.slamTimer = 3.0;
    this.isChannelingSlam = false;
    this.targetEntity = null;
  }

  isAlive() {
    return !this.isDead && this.hp > 0;
  }

  takeDamage(amount, type = 'physical') {
    if (!this.isAlive()) return { damageTaken: 0, isDead: true };
    const taken = Math.min(this.hp, amount);
    this.hp -= taken;
    const isDead = this.hp <= 0;
    if (isDead) this.isDead = true;
    return { damageTaken: taken, isDead };
  }

  update(dt = 0.01667, entities = [], manager = null, simulation = null) {
    if (!this.isAlive()) return;

    this.slamTimer = Math.max(0, this.slamTimer - dt);

    // Target scanning: nearest allied hero or unit
    let nearestTarget = null;
    let minDist = Infinity;

    for (const ent of entities) {
      if (!ent || ent.id === this.id) continue;
      const isDead = typeof ent.isDead === 'function' ? ent.isDead() : !!ent.isDead;
      if (isDead || (typeof ent.hp === 'number' && ent.hp <= 0)) continue;
      if (ent.team === 'allied') {
        const d = Math.hypot(ent.x - this.x, ent.y - this.y);
        if (d < minDist) {
          minDist = d;
          nearestTarget = ent;
        }
      }
    }

    this.targetEntity = nearestTarget;

    // Ground Slam ability trigger
    if (this.slamTimer <= 0 && nearestTarget && minDist <= this.slamRadius && manager) {
      this.slamTimer = this.slamCooldown;
      // Spawn ground telegraph
      manager.addHazard(new GroundHazard({
        type: 'slam',
        x: this.x,
        y: this.y,
        radius: this.slamRadius,
        duration: 1.2,
        onComplete: (haz) => {
          // Slam impact: 250 dmg + 1.5s stun to all allied in radius
          for (const ent of entities) {
            if (!ent || ent.team !== 'allied') continue;
            const isDead = typeof ent.isDead === 'function' ? ent.isDead() : !!ent.isDead;
            if (isDead || (typeof ent.hp === 'number' && ent.hp <= 0)) continue;
            if (Math.hypot(ent.x - haz.x, ent.y - haz.y) <= haz.radius) {
              if (typeof ent.takeDamage === 'function') {
                ent.takeDamage(250, 'physical');
              } else {
                ent.hp = Math.max(0, ent.hp - 250);
              }
              const now = Date.now();
              ent.stunnedUntil = Math.max(ent.stunnedUntil || 0, now + this.slamStunDuration * 1000);
            }
          }
          if (simulation?.particles) {
            simulation.particles.emit('ring', { x: haz.x, y: haz.y, color: '#f97316', startRadius: 10, maxRadius: haz.radius, life: 0.5 });
            simulation.particles.emit('spark', { x: haz.x, y: haz.y, count: 20, color: '#f59e0b' });
          }
        }
      }));
    }

    // Movement down lane toward allied base
    if (nearestTarget && minDist > 80) {
      const dx = nearestTarget.x - this.x;
      const dy = nearestTarget.y - this.y;
      const step = this.speed * dt;
      this.x += (dx / minDist) * step;
      this.y += (dy / minDist) * step;
      this.facing = Math.atan2(dy, dx);
    } else if (!nearestTarget) {
      // Advance toward allied fountain
      const dx = 400 - this.x;
      const dy = 400 - this.y;
      const d = Math.hypot(dx, dy);
      if (d > 50) {
        const step = this.speed * dt;
        this.x += (dx / d) * step;
        this.y += (dy / d) * step;
        this.facing = Math.atan2(dy, dx);
      }
    }
  }

  draw(ctx, camera, zoom = 1.0) {
    if (!ctx || !this.isAlive()) return;
    const { sx, sy } = worldToScreen(this.x, this.y, this.z, camera, zoom);

    ctx.save();
    const r = this.radius * zoom;
    const h = this.height * zoom;

    // Ground boss aura ring
    ctx.beginPath();
    ctx.ellipse(sx, sy, r * 1.15, (r * 1.15) * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.20)';
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.stroke();

    const sprite = getBossSprite('boss_colossus');
    const spriteSize = 115 * zoom;
    const flipX = Math.cos(this.facing || 0) < -0.1;
    const drewSprite = drawChibiSprite(ctx, sprite, sx, sy + 8 * zoom, spriteSize, spriteSize, {
      isMoving: true,
      flipX
    });

    if (!drewSprite) {
      // Rocky stone body fallback
      ctx.beginPath();
      ctx.ellipse(sx, sy, r, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#475569';
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Torso
      ctx.fillStyle = '#64748b';
      ctx.fillRect(sx - r * 0.6, sy - h, r * 1.2, h);
      ctx.strokeStyle = '#94a3b8';
      ctx.strokeRect(sx - r * 0.6, sy - h, r * 1.2, h);

      // Glowing Rune Core
      ctx.beginPath();
      ctx.arc(sx, sy - h * 0.6, 12 * zoom, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 14;
      ctx.fill();
    }

    ctx.restore();
  }

  drawHUD(ctx, camera, zoom = 1.0) {
    if (!ctx || !this.isAlive()) return;
    super.drawHUD(ctx, camera, zoom);
  }
}

/**
 * Wave 10 Mini-Boss: Abyssal Behemoth.
 */
export class AbyssalBehemothBoss extends Entity {
  constructor(options = {}) {
    const cfg = BOSS_CONFIGS.behemoth;
    super({
      id: cfg.id,
      name: cfg.name,
      type: 'boss',
      team: 'enemy',
      x: options.x ?? 2800,
      y: options.y ?? 2800,
      z: 0,
      radius: 42,
      selectionRadius: 60,
      height: 80,
      speed: 190,
      maxHp: cfg.maxHp,
      hp: cfg.maxHp,
      armor: 50,
      magicResist: 40,
      attackDamage: 110
    });

    this.silenceDuration = cfg.silenceDuration;
    this.bountyKiller = cfg.bountyKiller;
    this.bountyTeam = cfg.bountyTeam;
    this.acidTimer = 4.0;
    this.roarTimer = 8.0;
  }

  isAlive() {
    return !this.isDead && this.hp > 0;
  }

  takeDamage(amount, type = 'physical') {
    if (!this.isAlive()) return { damageTaken: 0, isDead: true };
    const taken = Math.min(this.hp, amount);
    this.hp -= taken;
    const isDead = this.hp <= 0;
    if (isDead) this.isDead = true;
    return { damageTaken: taken, isDead };
  }

  update(dt = 0.01667, entities = [], manager = null, simulation = null) {
    if (!this.isAlive()) return;

    this.acidTimer = Math.max(0, this.acidTimer - dt);
    this.roarTimer = Math.max(0, this.roarTimer - dt);

    let nearestTarget = null;
    let minDist = Infinity;

    for (const ent of entities) {
      if (!ent || ent.id === this.id) continue;
      const isDead = typeof ent.isDead === 'function' ? ent.isDead() : !!ent.isDead;
      if (isDead || (typeof ent.hp === 'number' && ent.hp <= 0)) continue;
      if (ent.team === 'allied') {
        const d = Math.hypot(ent.x - this.x, ent.y - this.y);
        if (d < minDist) {
          minDist = d;
          nearestTarget = ent;
        }
      }
    }

    // Ability 1: Acid Spit pool
    if (this.acidTimer <= 0 && nearestTarget && manager) {
      this.acidTimer = 7.0;
      const targetX = nearestTarget.x;
      const targetY = nearestTarget.y;

      manager.addHazard(new GroundHazard({
        type: 'acid_pool',
        x: targetX,
        y: targetY,
        radius: 100,
        duration: 6.0,
        tickInterval: 0.5,
        onTick: (haz) => {
          for (const ent of entities) {
            if (!ent || ent.team !== 'allied') continue;
            const isDead = typeof ent.isDead === 'function' ? ent.isDead() : !!ent.isDead;
            if (isDead || (typeof ent.hp === 'number' && ent.hp <= 0)) continue;
            if (Math.hypot(ent.x - haz.x, ent.y - haz.y) <= haz.radius) {
              if (typeof ent.takeDamage === 'function') {
                ent.takeDamage(20, 'magical');
              } else {
                ent.hp = Math.max(0, ent.hp - 20);
              }
            }
          }
        }
      }));
    }

    // Ability 2: Roar of Fear (AoE Silence)
    if (this.roarTimer <= 0 && nearestTarget && minDist <= 350) {
      this.roarTimer = 12.0;
      for (const ent of entities) {
        if (!ent || ent.team !== 'allied') continue;
        const isDead = typeof ent.isDead === 'function' ? ent.isDead() : !!ent.isDead;
        if (isDead || (typeof ent.hp === 'number' && ent.hp <= 0)) continue;
        if (Math.hypot(ent.x - this.x, ent.y - this.y) <= 350) {
          const now = Date.now();
          ent.silencedUntil = Math.max(ent.silencedUntil || 0, now + this.silenceDuration * 1000);
        }
      }
      if (simulation?.particles) {
        simulation.particles.emit('ring', { x: this.x, y: this.y, color: '#a855f7', startRadius: 10, maxRadius: 350, life: 0.6 });
      }
    }

    // Movement
    if (nearestTarget && minDist > 100) {
      const dx = nearestTarget.x - this.x;
      const dy = nearestTarget.y - this.y;
      const step = this.speed * dt;
      this.x += (dx / minDist) * step;
      this.y += (dy / minDist) * step;
      this.facing = Math.atan2(dy, dx);
    }
  }

  draw(ctx, camera, zoom = 1.0) {
    if (!ctx || !this.isAlive()) return;
    const { sx, sy } = worldToScreen(this.x, this.y, this.z, camera, zoom);

    ctx.save();
    const r = this.radius * zoom;
    const h = this.height * zoom;

    // Ground void aura ring
    ctx.beginPath();
    ctx.ellipse(sx, sy, r * 1.15, (r * 1.15) * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(168, 85, 247, 0.22)';
    ctx.fill();
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 2;
    ctx.stroke();

    const sprite = getBossSprite('boss_behemoth');
    const spriteSize = 132 * zoom;
    const flipX = Math.cos(this.facing || 0) < -0.1;
    const drewSprite = drawChibiSprite(ctx, sprite, sx, sy + 9 * zoom, spriteSize, spriteSize, {
      isMoving: true,
      flipX
    });

    if (!drewSprite) {
      // Dark Void Beast fallback
      ctx.beginPath();
      ctx.ellipse(sx, sy, r, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#3b0764';
      ctx.fill();

      ctx.fillStyle = '#581c87';
      ctx.fillRect(sx - r * 0.7, sy - h, r * 1.4, h);

      // Glowing Purple Eyes
      ctx.beginPath();
      ctx.arc(sx - 10 * zoom, sy - h * 0.8, 5 * zoom, 0, Math.PI * 2);
      ctx.arc(sx + 10 * zoom, sy - h * 0.8, 5 * zoom, 0, Math.PI * 2);
      ctx.fillStyle = '#c084fc';
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = 10;
      ctx.fill();
    }

    ctx.restore();
  }

  drawHUD(ctx, camera, zoom = 1.0) {
    if (!ctx || !this.isAlive()) return;
    super.drawHUD(ctx, camera, zoom);
  }
}

/**
 * Supreme Boss: Nexus Guardian Entity.
 * Integrates the SupremeBoss test contract with full 2.5D rendering and 3 encounter phases.
 */
export class NexusGuardianBoss extends Entity {
  constructor(options = {}) {
    const cfg = BOSS_CONFIGS.supreme;
    super({
      id: cfg.id,
      name: cfg.name,
      type: 'boss',
      team: 'enemy',
      x: options.x ?? 2550,
      y: options.y ?? 2550,
      z: 0,
      radius: 50,
      selectionRadius: 75,
      height: 95,
      speed: 160,
      maxHp: cfg.maxHp,
      hp: cfg.maxHp,
      armor: 60,
      magicResist: 50,
      attackDamage: 140
    });

    this.shieldActive = false;
    this.bountyKiller = cfg.bountyKiller;
    this.bountyTeam = cfg.bountyTeam;

    // Phase timers
    this.cleaveCooldown = 3.0;
    this.cleaveTimer = 0;
    this.meteorCooldown = 8.0;
    this.meteorTimer = 4.0;
    this.shieldDuration = 8.0;
    this.shieldCooldown = 25.0;
    this.shieldTimer = 0;
    this.isShieldTriggered = false;
  }

  isAlive() {
    return !this.isDead && this.hp > 0;
  }

  get phase() {
    const ratio = this.hp / this.maxHp;
    if (ratio > 0.66) return 1; // Frontal Cleave
    if (ratio > 0.33) return 2; // Meteor Rain
    return 3;                   // Cataclysmic Shield / Enrage
  }

  takeDamage(amount, type = 'physical') {
    if (this.shieldActive) {
      return { damageTaken: 0, shielded: true, isDead: false };
    }
    const taken = Math.min(this.hp, amount);
    this.hp -= taken;
    const isDead = this.hp <= 0;
    if (isDead) {
      this.isDead = true;
    }
    return { damageTaken: taken, shielded: false, isDead };
  }

  update(dt = 0.01667, entities = [], manager = null, simulation = null) {
    if (!this.isAlive()) return;

    const currentPhase = this.phase;

    // Find nearest player / allied target
    let nearestTarget = null;
    let minDist = Infinity;
    for (const ent of entities) {
      if (!ent || ent.id === this.id) continue;
      const isDead = typeof ent.isDead === 'function' ? ent.isDead() : !!ent.isDead;
      if (isDead || (typeof ent.hp === 'number' && ent.hp <= 0)) continue;
      if (ent.team === 'allied') {
        const d = Math.hypot(ent.x - this.x, ent.y - this.y);
        if (d < minDist) {
          minDist = d;
          nearestTarget = ent;
        }
      }
    }

    // Phase 1: Frontal Cleave
    this.cleaveTimer = Math.max(0, this.cleaveTimer - dt);
    if (nearestTarget && minDist <= 180 && this.cleaveTimer <= 0) {
      this.cleaveTimer = this.cleaveCooldown;
      // Frontal cone damage (120 dmg)
      if (typeof nearestTarget.takeDamage === 'function') {
        nearestTarget.takeDamage(120, 'physical');
      } else {
        nearestTarget.hp = Math.max(0, nearestTarget.hp - 120);
      }
      if (simulation?.particles) {
        simulation.particles.emit('spark', { x: nearestTarget.x, y: nearestTarget.y, count: 12, color: '#f59e0b' });
      }
    }

    // Phase 2: Meteor Rain
    if (currentPhase >= 2 && manager) {
      this.meteorTimer = Math.max(0, this.meteorTimer - dt);
      if (this.meteorTimer <= 0 && nearestTarget) {
        this.meteorTimer = this.meteorCooldown;
        // Target 2-3 impact zones near the target
        const offsets = [{ dx: 0, dy: 0 }, { dx: -80, dy: 60 }, { dx: 70, dy: -60 }];
        for (const off of offsets) {
          manager.addHazard(new GroundHazard({
            type: 'meteor',
            x: nearestTarget.x + off.dx,
            y: nearestTarget.y + off.dy,
            radius: 80,
            duration: 1.5,
            onComplete: (haz) => {
              for (const ent of entities) {
                if (!ent || ent.team !== 'allied') continue;
                if (Math.hypot(ent.x - haz.x, ent.y - haz.y) <= haz.radius) {
                  if (typeof ent.takeDamage === 'function') {
                    ent.takeDamage(300, 'magical');
                  } else {
                    ent.hp = Math.max(0, ent.hp - 300);
                  }
                }
              }
              if (simulation?.particles) {
                simulation.particles.emit('ring', { x: haz.x, y: haz.y, color: '#ea580c', startRadius: 10, maxRadius: haz.radius, life: 0.4 });
              }
            }
          }));
        }
      }
    }

    // Phase 3: Cataclysmic Shield (Aegis of Ruin)
    if (currentPhase === 3) {
      if (!this.isShieldTriggered) {
        this.isShieldTriggered = true;
        this.shieldActive = true;
        this.shieldTimer = this.shieldDuration;
      }

      if (this.shieldActive) {
        this.shieldTimer -= dt;
        if (this.shieldTimer <= 0) {
          this.shieldActive = false;
        }
      }
    }
  }

  draw(ctx, camera, zoom = 1.0) {
    if (!ctx || !this.isAlive()) return;
    const { sx, sy } = worldToScreen(this.x, this.y, this.z, camera, zoom);

    ctx.save();
    const r = this.radius * zoom;
    const h = this.height * zoom;

    // Supreme Boss Ground Aura
    ctx.beginPath();
    ctx.ellipse(sx, sy, r * 1.2, (r * 1.2) * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(220, 38, 38, 0.24)';
    ctx.fill();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    const sprite = getBossSprite('boss_supreme');
    const spriteSize = 152 * zoom;
    const flipX = Math.cos(this.facing || 0) < -0.1;
    const drewSprite = drawChibiSprite(ctx, sprite, sx, sy + 10 * zoom, spriteSize, spriteSize, {
      isMoving: false,
      flipX
    });

    if (!drewSprite) {
      // Base body fallback
      ctx.beginPath();
      ctx.ellipse(sx, sy, r, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#1e1b4b';
      ctx.fill();
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Towering armored guardian torso
      ctx.fillStyle = '#450a0a';
      ctx.fillRect(sx - r * 0.55, sy - h, r * 1.1, h);

      // Glowing Crimson Crown / Core
      ctx.beginPath();
      ctx.arc(sx, sy - h - 12 * zoom, 16 * zoom, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 20;
      ctx.fill();
    }

    // Cataclysmic Shield Dome overlay
    if (this.shieldActive) {
      ctx.beginPath();
      ctx.ellipse(sx, sy - h * 0.4, r * 1.5, (r * 1.5) * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(234, 88, 12, 0.25)';
      ctx.fill();
      ctx.strokeStyle = '#ea580c';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    ctx.restore();
  }

  drawHUD(ctx, camera, zoom = 1.0) {
    if (!ctx || !this.isAlive()) return;
    super.drawHUD(ctx, camera, zoom);

    if (this.shieldActive) {
      const { sx, sy } = worldToScreen(this.x, this.y, this.z, camera, zoom);
      ctx.save();
      ctx.fillStyle = '#ea580c';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🛡️ ESCUDO CATACLÍSMICO', sx, sy - (this.height + 20) * zoom);
      ctx.restore();
    }
  }
}

/**
 * Boss Manager coordinating encounters, timers, hazards, and boss health bar HUD.
 */
export class BossManager {
  constructor(simulation = null) {
    this.simulation = simulation;
    this.supremeBoss = new NexusGuardianBoss({ x: 2550, y: 2550 });
    this.activeBosses = [this.supremeBoss];
    this.activeHazards = [];
    this.colossusSpawned = false;
    this.behemothSpawned = false;
  }

  isSupremeBossAlive() {
    return this.supremeBoss && this.supremeBoss.isAlive();
  }

  addHazard(hazard) {
    if (hazard) {
      this.activeHazards.push(hazard);
    }
  }

  checkWaveSpawns(waveIndex, entities = []) {
    // Wave 5: Stone Colossus
    if (waveIndex >= 5 && !this.colossusSpawned) {
      this.colossusSpawned = true;
      const colossus = new StoneColossusBoss({ x: 2800, y: 2800 });
      this.activeBosses.push(colossus);
      entities.push(colossus);
      if (this.simulation?.particles) {
        this.simulation.particles.addFloatingText('⚠️ MINI-BOSS: STONE COLOSSUS SURGIU!', 1600, 1600, {
          color: '#f59e0b',
          fontSize: 22
        });
      }
    }

    // Wave 10: Abyssal Behemoth
    if (waveIndex >= 10 && !this.behemothSpawned) {
      this.behemothSpawned = true;
      const behemoth = new AbyssalBehemothBoss({ x: 2800, y: 2800 });
      this.activeBosses.push(behemoth);
      entities.push(behemoth);
      if (this.simulation?.particles) {
        this.simulation.particles.addFloatingText('⚠️ MINI-BOSS: ABYSSAL BEHEMOTH SURGIU!', 1600, 1600, {
          color: '#a855f7',
          fontSize: 22
        });
      }
    }
  }

  update(dt = 0.01667, entities = []) {
    // Update active hazards
    for (const h of this.activeHazards) {
      h.update(dt, this.simulation);
    }
    this.activeHazards = this.activeHazards.filter(h => !h.isDead);

    // Update active bosses
    for (const boss of this.activeBosses) {
      if (typeof boss.update === 'function') {
        boss.update(dt, entities, this, this.simulation);
      }
    }
  }

  drawHazards(ctx, camera, zoom = 1.0) {
    for (const h of this.activeHazards) {
      h.draw(ctx, camera, zoom);
    }
  }

  drawBossHUD(ctx, viewportWidth, viewportHeight) {
    if (!ctx) return;
    // Find active boss
    const activeBoss = this.activeBosses.find(b => b && b.isAlive());
    if (!activeBoss) return;

    ctx.save();
    const barWidth = 400;
    const barHeight = 16;
    const startX = (viewportWidth - barWidth) / 2;
    const startY = 75; // Cleanly positioned below Top HUD
    const maxHp = activeBoss.maxHp || 1;
    const ratio = Math.max(0, Math.min(1, (activeBoss.hp || 0) / maxHp));

    // Panel border
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(startX - 10, startY - 22, barWidth + 20, barHeight + 32);
    ctx.strokeStyle = '#e11d48';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(startX - 10, startY - 22, barWidth + 20, barHeight + 32);

    // Boss Name & Phase
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = '#f87171';
    ctx.textAlign = 'left';
    const bossName = (activeBoss.name || activeBoss.id || 'CHEFE').toUpperCase();
    ctx.fillText(`👑 ${bossName} (FASE ${activeBoss.phase || 1})`, startX, startY - 6);

    // HP Bar background
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(startX, startY, barWidth, barHeight);

    // HP Bar fill
    ctx.fillStyle = activeBoss.shieldActive ? '#ea580c' : '#dc2626';
    ctx.fillRect(startX, startY, barWidth * ratio, barHeight);

    // HP Text
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(activeBoss.hp || 0)} / ${maxHp}`, startX + barWidth / 2, startY + 12);

    ctx.restore();
  }
}
