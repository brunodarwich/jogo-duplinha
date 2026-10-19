/**
 * Hero Basic Attack Projectiles.
 * Tracks and moves homing basic attack projectiles for ranged heroes (Ranger, Sorceress, Cleric).
 */

import { worldToScreen } from '../core/isometric.js';

export class HeroProjectile {
  constructor(options = {}) {
    this.id = options.id || `heroproj_${Math.random().toString(36).substring(2, 9)}`;
    this.type = 'hero_projectile';
    this.hero = options.hero || null;
    this.sourceId = this.hero?.id || options.sourceId || null;
    this.team = this.hero?.team || options.team || 'allied';
    this.target = options.target || null;
    this.damage = options.damage || 50;
    this.damageType = options.damageType || 'physical';
    this.isCrit = !!options.isCrit;
    this.lifesteal = options.lifesteal || 0;
    this.speed = options.speed || 750;
    this.x = options.x ?? 0;
    this.y = options.y ?? 0;
    this.z = options.z ?? 25;
    this.radius = 6;
    this.isDead = false;
    this.heroClass = options.heroClass || this.hero?.heroId || 'ranger';
  }

  isAlive() {
    return !this.isDead;
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
    const tz = (target.height ? target.height * 0.5 : 20);

    const dx = tx - this.x;
    const dy = ty - this.y;
    const dz = tz - this.z;
    const dist = Math.hypot(dx, dy, dz);
    const step = this.speed * dt;

    if (dist <= step || dist <= (this.radius + (target.radius || 20))) {
      this.isDead = true;
      this.x = tx;
      this.y = ty;
      this.z = tz;

      if (simulation && typeof simulation.applyHeroHit === 'function') {
        simulation.applyHeroHit(this.hero, target, this.damage, this.damageType, this.isCrit, this.lifesteal);
      }
    } else {
      // Emit 'trail' particle at current position during flight towards target
      if (simulation && simulation.particles && typeof simulation.particles.emit === 'function') {
        let trailColor = '#34d399';
        if (this.heroClass === 'sorceress') trailColor = '#f97316';
        else if (this.heroClass === 'cleric') trailColor = '#fde047';
        else if (this.heroClass === 'assassin') trailColor = '#a855f7';
        else if (this.heroClass === 'knight') trailColor = '#60a5fa';

        simulation.particles.emit('trail', {
          x: this.x,
          y: this.y,
          z: this.z,
          count: 1,
          color: trailColor,
          size: 3.5,
          life: 0.15
        });
      }

      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
      this.z += (dz / dist) * step;
      this.facing = Math.atan2(dy, dx);
    }
  }

  draw(ctx, camera, zoom = 1.0) {
    if (!ctx || this.isDead) return;
    const { sx, sy } = worldToScreen(this.x, this.y, this.z, camera, zoom);

    ctx.save();
    let color = '#34d399'; // ranger green arrow / bolt
    let glow = '#10b981';
    let r = 5 * zoom;

    if (this.heroClass === 'sorceress') {
      color = '#f97316'; // sorceress fire
      glow = '#ef4444';
      r = 7 * zoom;
    } else if (this.heroClass === 'cleric') {
      color = '#fde047'; // cleric light
      glow = '#fbbf24';
      r = 6 * zoom;
    }

    ctx.shadowColor = glow;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }
}
