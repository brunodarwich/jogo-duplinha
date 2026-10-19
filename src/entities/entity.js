/**
 * Entity Base Architecture.
 * Standardized coordinate space, depth sorting, collision radii, and procedural 2.5D rendering.
 *
 * Source: PROJECT.md §Interface Contract 1 & explorer_m1_1/m1_3 handoffs
 */

import { worldToScreen, getDepthKey } from '../core/isometric.js';
import { calculateRespawnTime, calculateHeroStatsAtLevel } from './heroes.js';
import { getXpForNextLevel, canUpgradeAbility, MAX_LEVEL } from '../systems/leveling.js';
import { getHeroSprite, getMinionSprite, drawChibiSprite, drawDetailed3DStructure } from '../render/sprite_loader.js';

export class Entity {
  /**
   * @param {Object} [options={}]
   */
  constructor(options = {}) {
    this.id = options.id || `ent_${Math.random().toString(36).substring(2, 9)}`;
    this.name = options.name || '';
    this.type = options.type || 'entity'; // 'hero' | 'minion' | 'tower' | 'boss' | 'nexus' | 'projectile'
    this.team = options.team || 'neutral'; // 'allied' | 'enemy' | 'neutral'

    // Continuous 3D world coordinates
    this.x = options.x ?? 0;
    this.y = options.y ?? 0;
    this.z = options.z ?? 0;

    // Movement & physics
    this.vx = 0;
    this.vy = 0;
    this.speed = options.speed ?? 300;
    this.facing = options.facing ?? 0;
    this.targetFacing = options.targetFacing ?? options.facing ?? 0;
    this.turnSpeed = options.turnSpeed ?? 15.0;
    this.targetX = null;
    this.targetY = null;
    this.isMoving = false;

    // Geometry & selection
    this.radius = options.radius ?? 20;
    this.selectionRadius = options.selectionRadius ?? (this.radius + 10);
    this.height = options.height ?? 40;

    // Health, Mana & Barrier
    this.maxHp = options.maxHp ?? 500;
    this.hp = options.hp ?? this.maxHp;
    this.hpRegen = options.hpRegen ?? 1.0;
    this.maxMana = options.maxMana ?? 200;
    this.mana = options.mana ?? this.maxMana;
    this.manaRegen = options.manaRegen ?? 1.0;
    this.barrier = options.barrier ?? 0;

    // Combat & state
    this.level = options.level ?? 1;
    this.attackDamage = options.attackDamage ?? 0;
    this.armor = options.armor ?? 0;
    this.magicResist = options.magicResist ?? 0;
    this.isDeadState = false;
    this.isUntargetableFlag = false;

    // Crowd Control state fields (PROJECT.md §Interface Contract 3)
    this.stunnedUntil = options.stunnedUntil || 0;
    this.silencedUntil = options.silencedUntil || 0;
    this.rootedUntil = options.rootedUntil || 0;
    this.tauntedUntil = options.tauntedUntil || 0;
    this.slowedUntil = options.slowedUntil || 0;

    // Flags
    this.isLocalPlayer = !!options.isLocalPlayer;
    this.isRecalling = false;
    this.recallElapsed = 0;
  }

  get isDead() {
    return this.isDeadState || this.hp <= 0;
  }

  set isDead(val) {
    this.isDeadState = !!val;
  }

  isAlive() {
    return !this.isDead && this.hp > 0;
  }

  isUntargetable() {
    return this.isUntargetableFlag || !this.isAlive();
  }

  getDepthKey() {
    return getDepthKey(this.x, this.y);
  }

  canMove(now = Date.now()) {
    if (!this.isAlive()) return false;
    if (this.stunnedUntil && now < this.stunnedUntil) return false;
    if (this.rootedUntil && now < this.rootedUntil) return false;
    return true;
  }

  canAttack(now = Date.now()) {
    if (!this.isAlive()) return false;
    if (this.stunnedUntil && now < this.stunnedUntil) return false;
    return true;
  }

  canCast(now = Date.now()) {
    if (!this.isAlive()) return false;
    if (this.stunnedUntil && now < this.stunnedUntil) return false;
    if (this.silencedUntil && now < this.silencedUntil) return false;
    if (this.tauntedUntil && now < this.tauntedUntil) return false;
    return true;
  }

  moveTo(wx, wy) {
    if (!this.isAlive()) return;
    this.targetX = wx;
    this.targetY = wy;
    this.isMoving = true;
    const dx = wx - this.x;
    const dy = wy - this.y;
    if (Math.hypot(dx, dy) > 1e-3) {
      this.targetFacing = Math.atan2(dy, dx);
    }
  }

  stop() {
    this.targetX = null;
    this.targetY = null;
    this.vx = 0;
    this.vy = 0;
    this.isMoving = false;
    if (this.isRecalling) {
      this.isRecalling = false;
      this.recallElapsed = 0;
    }
  }

  takeDamage(amount, type = 'physical') {
    if (!this.isAlive() || amount <= 0) return 0;

    let remaining = amount;
    if (this.barrier > 0) {
      const absorbed = Math.min(this.barrier, remaining);
      this.barrier -= absorbed;
      remaining -= absorbed;
    }

    this.hp = Math.max(0, this.hp - remaining);
    if (this.hp <= 0) {
      this.isDeadState = true;
      this.stop();
    }

    if (this.isRecalling) {
      this.isRecalling = false;
      this.recallElapsed = 0;
    }

    return amount;
  }

  heal(amount) {
    if (!this.isAlive() || amount <= 0) return 0;
    const oldHp = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    return this.hp - oldHp;
  }

  update(dt = 0.01667) {
    if (!this.isAlive()) return;

    // Natural regeneration
    if (this.hp < this.maxHp && this.hpRegen > 0) {
      this.hp = Math.min(this.maxHp, this.hp + this.hpRegen * dt);
    }
    if (this.mana < this.maxMana && this.manaRegen > 0) {
      this.mana = Math.min(this.maxMana, this.mana + this.manaRegen * dt);
    }

    // Smooth shortest-arc angular lerp from this.facing towards this.targetFacing
    if (typeof this.targetFacing === 'number' && typeof this.facing === 'number') {
      const diff = Math.atan2(Math.sin(this.targetFacing - this.facing), Math.cos(this.targetFacing - this.facing));
      const turnStep = this.turnSpeed * dt;
      if (Math.abs(diff) <= turnStep) {
        this.facing = this.targetFacing;
      } else {
        this.facing += Math.sign(diff) * turnStep;
      }
    }

    // Move towards target
    if (this.isMoving && this.targetX !== null && this.targetY !== null) {
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const dist = Math.hypot(dx, dy);
      const step = this.speed * dt;

      if (dist <= step || dist < 2) {
        this.x = this.targetX;
        this.y = this.targetY;
        this.vx = 0;
        this.vy = 0;
        this.isMoving = false;
        this.targetX = null;
        this.targetY = null;
      } else {
        this.vx = (dx / dist) * this.speed;
        this.vy = (dy / dist) * this.speed;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.targetFacing = Math.atan2(dy, dx);
      }
    }
  }

  /**
   * Procedural 2.5D rendering
   */
  draw(ctx, camera, zoom = 1.0) {
    if (!ctx || !this.isAlive()) return;
    const { sx, sy } = worldToScreen(this.x, this.y, this.z, camera, zoom);

    ctx.save();

    const isAllied = this.team === 'allied';
    const mainColor = isAllied ? '#3b82f6' : (this.team === 'enemy' ? '#ef4444' : '#94a3b8');
    const r = Math.max(8, this.radius * zoom);

    // Procedural 2.5D cylinder / disc
    ctx.beginPath();
    ctx.ellipse(sx, sy, r, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = mainColor;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Facing direction notch
    if (this.isMoving || this.facing !== 0) {
      const notchDist = (this.radius || 20) * 1.2;
      const worldNotchX = this.x + Math.cos(this.facing) * notchDist;
      const worldNotchY = this.y + Math.sin(this.facing) * notchDist;
      const notchScreen = worldToScreen(worldNotchX, worldNotchY, this.z, camera, zoom);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(notchScreen.sx, notchScreen.sy);
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Overhead health/mana HUD drawing
   */
  drawHUD(ctx, camera, zoom = 1.0) {
    if (!ctx || !this.isAlive()) return;
    const { sx, sy } = worldToScreen(this.x, this.y, this.z, camera, zoom);

    const isHero = this.type === 'hero';
    const isLocal = this.isLocalPlayer;
    const isAllied = this.team === 'allied';

    const w = isHero ? (isLocal ? 72 : 68) : (this.type === 'tower' ? 100 : (this.type === 'boss' ? 140 : 36));
    const hpHeight = isHero ? 5 : (this.type === 'tower' ? 8 : (this.type === 'boss' ? 9 : 4));
    const manaHeight = isHero ? 3 : 0;
    const totalH = hpHeight + (manaHeight > 0 ? manaHeight + 1 : 0);

    const offset = (this.height || 40) * zoom;
    const x = Math.round(sx - w / 2);
    const y = Math.round(sy - offset);

    ctx.save();

    // 0. Hero Name Label
    if (isHero && this.name) {
      ctx.save();
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = isLocal ? '#fbbf24' : (isAllied ? '#38bdf8' : '#f87171');
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 4;
      ctx.fillText(this.name, sx, y - 5);
      ctx.restore();
    }

    // 1. Dark container
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(x - 1, y - 1, w + 2, totalH + 2);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 1, y - 1, w + 2, totalH + 2);

    // 2. Health bar
    const hpRatio = Math.max(0, Math.min(1, this.hp / (this.maxHp || 1)));
    const hpWidth = Math.round(w * hpRatio);
    ctx.fillStyle = isAllied ? '#22c55e' : '#ef4444';
    ctx.fillRect(x, y, hpWidth, hpHeight);

    // 3. Shield barrier
    if (this.barrier > 0) {
      const shieldRatio = Math.min(1 - hpRatio, this.barrier / (this.maxHp || 1));
      const shieldWidth = Math.round(w * shieldRatio);
      ctx.fillStyle = 'rgba(253, 224, 71, 0.85)';
      ctx.fillRect(x + hpWidth, y, shieldWidth, hpHeight);
    }

    // 4. Health segment notches (every 250 HP)
    if (this.maxHp >= 500) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      const notchStep = (250 / this.maxHp) * w;
      for (let nx = notchStep; nx < w; nx += notchStep) {
        ctx.fillRect(Math.round(x + nx), y, 1, hpHeight);
      }
    }

    // 5. Mana bar
    if (manaHeight > 0) {
      const manaY = y + hpHeight + 1;
      const manaRatio = Math.max(0, Math.min(1, (this.mana || 0) / (this.maxMana || 1)));
      const manaWidth = Math.round(w * manaRatio);
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(x, manaY, manaWidth, manaHeight);
    }

    // 6. Local Player Golden Chevron
    if (isLocal) {
      ctx.beginPath();
      ctx.moveTo(sx - 4, y - 7);
      ctx.lineTo(sx + 4, y - 7);
      ctx.lineTo(sx, y - 2);
      ctx.closePath();
      ctx.fillStyle = '#fbbf24';
      ctx.fill();
    }

    // 7. Recall Channel Progress Bar
    if (this.isRecalling) {
      const channelW = w;
      const channelH = 5;
      const channelY = y + totalH + 3;
      const progress = Math.min(1, (this.recallElapsed || 0) / 5000);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(x, channelY, channelW, channelH);
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(x, channelY, Math.round(channelW * progress), channelH);

      ctx.fillStyle = '#ffffff';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('RECALL', sx, channelY + channelH + 8);
    }

    ctx.restore();
  }
}

/**
 * Specialized Hero Entity with stats and ability kit slots.
 */
export class HeroEntity extends Entity {
  constructor(options = {}) {
    super({
      type: 'hero',
      team: options.team || 'allied',
      radius: 22,
      selectionRadius: 32,
      height: 48,
      speed: options.movementSpeed || options.speed || 325,
      maxHp: options.hp || 680,
      hp: options.hp || 680,
      maxMana: options.mana || 300,
      mana: options.mana || 300,
      ...options
    });

    this.heroId = options.heroId || 'knight';
    this.name = options.name || 'Cavaleiro Guardião';
    this.role = options.role || 'Tank';

    // Combat attributes
    this.attackDamage = options.attackDamage || 58;
    this.abilityPower = options.abilityPower || 0;
    this.armor = options.armor || 38;
    this.magicResist = options.magicResist || 32;
    this.attackSpeed = options.attackSpeed || 0.65;
    this.attackRange = options.attackRange || 130;
    this.gold = options.gold ?? 500;
    this.inventory = options.inventory || new Array(6).fill(null);

    // Basic attack tracking & state
    this.attackCooldown = 0;
    this.attackTarget = null;
    this.holdPosition = false;
    this.attackMoveDestination = null;
    this.critChance = options.critChance || 0;
    this.lifesteal = options.lifesteal || 0;

    // Respawn state properties (PROJECT.md M1 / R1)
    this.respawnTimer = options.respawnTimer ?? 0;
    this.respawnDuration = options.respawnDuration ?? 0;

    // Progression & Leveling (Levels 1 to 15)
    this.level = options.level ?? 1;
    this.xp = options.xp ?? 0;
    this.maxXp = options.maxXp ?? getXpForNextLevel(this.level);
    this.skillPoints = options.skillPoints ?? this.level;
    this.onLevelUp = options.onLevelUp || null;

    // Abilities dictionary (Q, W, E, R)
    this.abilities = options.abilities || {
      Q: { id: 'Q', name: 'Shield Slam', manaCost: 50, cooldown: 8, cooldownRemaining: 0, range: 450, targetingType: 'DIRECTIONAL_LINE' },
      W: { id: 'W', name: 'Taunt', manaCost: 60, cooldown: 12, cooldownRemaining: 0, radius: 250, targetingType: 'SELF_AOE' },
      E: { id: 'E', name: 'Cleave', manaCost: 40, cooldown: 6, cooldownRemaining: 0, range: 300, targetingType: 'DIRECTIONAL_LINE' },
      R: { id: 'R', name: 'Fortress', manaCost: 100, cooldown: 60, cooldownRemaining: 0, radius: 400, targetingType: 'GROUND_AOE' }
    };

    // Ensure all ability slots have a numeric rank tracked (0 to 4)
    for (const key of ['Q', 'W', 'E', 'R']) {
      if (this.abilities[key]) {
        this.abilities[key].rank = typeof this.abilities[key].rank === 'number' ? this.abilities[key].rank : 0;
      }
    }
  }

  // Alias for input compatibility
  get skills() {
    return this.abilities;
  }

  /**
   * Adds XP, handles multiple level transitions up to level 15,
   * increments skill points, updates base/current stats and HP/mana restoration.
   * @param {number} amount 
   * @returns {number}
   */
  gainXp(amount) {
    if (this.level >= MAX_LEVEL || amount <= 0) return 0;
    this.xp += amount;

    while (this.level < MAX_LEVEL && this.xp >= this.maxXp && this.maxXp > 0) {
      this.xp -= this.maxXp;
      const oldMaxHp = this.maxHp;
      const oldMaxMana = this.maxMana;

      this.level++;
      this.skillPoints++;

      // Recalculate stats via calculateHeroStatsAtLevel
      if (this.heroId) {
        try {
          const newStats = calculateHeroStatsAtLevel(this.heroId, this.level);
          const deltaMaxHp = Math.max(0, newStats.hp - oldMaxHp);
          const deltaMaxMana = Math.max(0, newStats.mana - oldMaxMana);

          this.baseStats = newStats;
          this.maxHp = newStats.hp;
          this.maxMana = newStats.mana;
          this.hp = Math.min(this.maxHp, this.hp + deltaMaxHp);
          this.mana = Math.min(this.maxMana, this.mana + deltaMaxMana);
          this.hpRegen = newStats.hpRegen;
          this.manaRegen = newStats.manaRegen;
          this.armor = newStats.armor;
          this.magicResist = newStats.magicResist;
          this.attackDamage = newStats.attackDamage;
          this.attackSpeed = newStats.attackSpeed;
          this.attackRange = newStats.attackRange;
          this.speed = newStats.movementSpeed;
          this.movementSpeed = newStats.movementSpeed;

          // Re-apply item bonuses if inventory exists
          if (this.inventoryInstance && typeof this.inventoryInstance.recomputeStats === 'function') {
            this.inventoryInstance.recomputeStats();
          }
        } catch (e) {
          console.warn('[HeroEntity] Error calculating hero stats at level:', e);
        }
      }

      this.maxXp = getXpForNextLevel(this.level);

      if (typeof this.onLevelUp === 'function') {
        this.onLevelUp(this.level);
      }
    }

    if (this.level >= MAX_LEVEL) {
      this.xp = 0;
      this.maxXp = 0;
    }

    return amount;
  }

  /**
   * Spends a skill point to upgrade the specified ability slot.
   * @param {'Q' | 'W' | 'E' | 'R'} slot 
   * @returns {boolean}
   */
  upgradeAbility(slot) {
    if (!slot) return false;
    const key = String(slot).toUpperCase();
    if (!canUpgradeAbility(this, key)) return false;

    const ability = this.abilities ? this.abilities[key] : (this.skills ? this.skills[key] : null);
    if (!ability) return false;

    ability.rank = (ability.rank || 0) + 1;
    this.skillPoints = Math.max(0, this.skillPoints - 1);
    return true;
  }

  setAttackTarget(target) {
    if (!this.isAlive()) return;
    this.attackTarget = target;
    this.holdPosition = false;
    this.attackMoveDestination = null;
    if (this.isRecalling) {
      this.isRecalling = false;
      this.recallElapsed = 0;
    }
  }

  moveTo(wx, wy, isAttackMove = false) {
    if (!this.isAlive()) return;
    super.moveTo(wx, wy);
    this.attackTarget = null;
    if (!isAttackMove) {
      this.attackMoveDestination = null;
    }
    this.holdPosition = false;
  }

  stop() {
    super.stop();
    this.attackTarget = null;
    this.attackMoveDestination = null;
    this.holdPosition = true;
  }

  /**
   * Enters dead state: clamps HP to 0, stops movement, cancels recall, clears targets,
   * and initializes level-scaled respawn countdown.
   */
  die() {
    this.hp = 0;
    this.isDeadState = true;
    this.stop();
    this.attackTarget = null;
    this.attackMoveDestination = null;
    if (this.isRecalling) {
      this.isRecalling = false;
      this.recallElapsed = 0;
    }
    this.respawnDuration = calculateRespawnTime(this.level);
    this.respawnTimer = this.respawnDuration;
  }

  /**
   * Resurrects hero at Allied Fountain (400, 400) with full HP/Mana,
   * reset velocity, cleansed crowd control effects, and cleared hold/attack states.
   */
  respawn() {
    this.x = 400;
    this.y = 400;
    this.z = 0;
    this.vx = 0;
    this.vy = 0;
    this.targetX = null;
    this.targetY = null;
    this.isMoving = false;
    this.hp = this.maxHp;
    this.mana = this.maxMana;
    this.barrier = 0;
    this.isDeadState = false;
    this.respawnTimer = 0;
    this.respawnDuration = 0;
    this.holdPosition = false;
    this.attackTarget = null;
    this.attackMoveDestination = null;
    this.attackCooldown = 0;
    if (this.isRecalling) {
      this.isRecalling = false;
      this.recallElapsed = 0;
    }

    // Cleanse all crowd control debuffs
    this.stunnedUntil = 0;
    this.silencedUntil = 0;
    this.rootedUntil = 0;
    this.tauntedUntil = 0;
    this.tauntTargetId = null;
    this.slowedUntil = 0;
    this.slowPercentage = 0;
    this.stealthedUntil = 0;
  }

  /**
   * Applies damage, cancels recall, and triggers die() if damage is lethal.
   */
  takeDamage(amount, type = 'physical') {
    if (!this.isAlive() || amount <= 0) return 0;
    const dealt = super.takeDamage(amount, type);
    if (this.hp <= 0) {
      this.die();
    }
    return dealt;
  }

  update(dt = 0.01667) {
    // 1. Dead Hero Lifecycle
    if (this.isDead) {
      // Cooldown ticks for abilities continue ticking while dead
      for (const key of Object.keys(this.abilities)) {
        const ab = this.abilities[key];
        if (ab && ab.cooldownRemaining > 0) {
          ab.cooldownRemaining = Math.max(0, ab.cooldownRemaining - dt);
        }
      }

      // Decrement respawn countdown
      this.respawnTimer = Math.max(0, (this.respawnTimer || 0) - dt);
      if (this.respawnTimer === 0) {
        this.respawn();
      }
      return;
    }

    super.update(dt);

    // Basic attack cooldown tick
    if (this.attackCooldown > 0) {
      this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    }

    // Cooldown ticks for abilities
    for (const key of Object.keys(this.abilities)) {
      const ab = this.abilities[key];
      if (ab && ab.cooldownRemaining > 0) {
        ab.cooldownRemaining = Math.max(0, ab.cooldownRemaining - dt);
      }
    }

    // Recall channel update
    if (this.isRecalling) {
      this.recallElapsed += dt * 1000;
      if (this.recallElapsed >= 5000) {
        this.isRecalling = false;
        this.recallElapsed = 0;
        this.x = 400; // Fountain center
        this.y = 400;
        this.stop();
      }
    }
  }

  draw(ctx, camera, zoom = 1.0) {
    if (!ctx || !this.isAlive()) return;
    const { sx, sy } = worldToScreen(this.x, this.y, this.z, camera, zoom);

    ctx.save();
    const isAllied = this.team === 'allied';
    const bodyColor = isAllied ? '#2563eb' : '#dc2626';
    const r = Math.max(10, this.radius * zoom);
    const h = 24 * zoom;

    // Ground team ring / selection pedestal
    ctx.beginPath();
    ctx.ellipse(sx, sy, r * 1.05, (r * 1.05) * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = this.isLocalPlayer
      ? 'rgba(251, 191, 36, 0.22)'
      : (isAllied ? 'rgba(37, 99, 235, 0.22)' : 'rgba(220, 38, 38, 0.22)');
    ctx.fill();
    ctx.strokeStyle = this.isLocalPlayer ? '#fbbf24' : (isAllied ? '#60a5fa' : '#f87171');
    ctx.lineWidth = 2;
    ctx.stroke();

    // Facing orientation calculation
    const notchDist = (this.radius || 20) * 1.3;
    const worldNotchX = this.x + Math.cos(this.facing) * notchDist;
    const worldNotchY = this.y + Math.sin(this.facing) * notchDist;
    const notchScreen = worldToScreen(worldNotchX, worldNotchY, this.z, camera, zoom);
    const fx = notchScreen.sx;
    const fy = notchScreen.sy - h * 0.5;

    // Attempt to render Chibi 1.5-head transparent PNG sprite
    const sprite = getHeroSprite(this.heroId);
    const spriteW = 78 * zoom;
    const spriteH = 78 * zoom;
    const flipX = (fx - sx) < -1.5;
    const drewSprite = drawChibiSprite(ctx, sprite, sx, sy + 6 * zoom, spriteW, spriteH, {
      isMoving: this.isMoving,
      flipX
    });

    if (!drewSprite) {
      // Fallback 2.5D Body (Cylinder) for headless tests or while image loads
      ctx.beginPath();
      ctx.ellipse(sx, sy, r, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = bodyColor;
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(sx, sy - h, r * 0.85, (r * 0.85) * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = isAllied ? '#60a5fa' : '#f87171';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Facing orientation indicator (kept at end of draw for camera rotation compatibility)
    ctx.beginPath();
    ctx.moveTo(sx, sy - h * 0.5);
    ctx.lineTo(fx, fy);
    ctx.strokeStyle = drewSprite ? 'rgba(251, 191, 36, 0.55)' : '#fbbf24';
    ctx.lineWidth = drewSprite ? 1.5 : 2.5;
    ctx.stroke();

    ctx.restore();
  }
}

/**
 * Defensive Tower Structure
 */
export class TowerEntity extends Entity {
  constructor(options = {}) {
    super({
      type: 'tower',
      team: options.team || 'allied',
      radius: 40,
      selectionRadius: 50,
      height: 90,
      speed: 0,
      maxHp: options.maxHp || 3000,
      hp: options.hp || 3000,
      ...options
    });
    this.attackRadius = 400;
  }

  draw(ctx, camera, zoom = 1.0) {
    if (!ctx || !this.isAlive()) return;
    const { sx, sy } = worldToScreen(this.x, this.y, this.z, camera, zoom);
    drawDetailed3DStructure(ctx, this, sx, sy, zoom, camera);
  }
}

/**
 * Minion Entity
 */
export class MinionEntity extends Entity {
  constructor(options = {}) {
    super({
      type: 'minion',
      team: options.team || 'allied',
      radius: options.subType === 'cannon' ? 20 : 14,
      selectionRadius: 22,
      height: options.subType === 'cannon' ? 34 : 26,
      speed: 280,
      maxHp: options.maxHp || 450,
      hp: options.hp || 450,
      ...options
    });
    this.subType = options.subType || 'melee'; // 'melee' | 'ranged' | 'cannon'
  }

  draw(ctx, camera, zoom = 1.0) {
    if (!ctx || !this.isAlive()) return;
    const { sx, sy } = worldToScreen(this.x, this.y, this.z, camera, zoom);

    ctx.save();
    const isAllied = this.team === 'allied';
    const r = this.radius * zoom;
    const sprite = getMinionSprite(this.subType, this.team);
    const size = (this.subType === 'cannon' ? 62 : 46) * zoom;
    const flipX = Math.cos(this.facing || 0) < -0.1;

    const drewSprite = drawChibiSprite(ctx, sprite, sx, sy + 4 * zoom, size, size, {
      isMoving: true,
      flipX
    });

    if (!drewSprite) {
      ctx.fillStyle = isAllied ? '#0284c7' : '#b91c1c';
      ctx.beginPath();
      ctx.ellipse(sx, sy - 6 * zoom, r, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }
}
