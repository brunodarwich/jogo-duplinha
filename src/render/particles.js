/**
 * Procedural Particle System & Floating Combat Text (FCT) Engine.
 * Lightweight 60 FPS particle emitters for spells, hits, rings, shockwaves and damage numbers.
 *
 * Source: PROJECT.md §Rendering Pipeline (Pass 5) & explorer_m1_3/handoff.md
 */

import { worldToScreen } from '../core/isometric.js';

export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.floatingTexts = [];
    this.maxParticles = 500;
    this.maxFloatingTexts = 200;
  }

  /**
   * Emits a burst of particles at world coordinates.
   * @param {string} type - 'spark' | 'fire' | 'frost' | 'heal' | 'ring' | 'shockwave'
   * @param {Object} options - { x, y, z, count, color, size, speed, life }
   */
  emit(type, options = {}) {
    const isSingleEmitter = (type === 'ring' || type === 'cc_ring');
    const defaultCount = isSingleEmitter ? 1 : (type === 'confetti' ? 20 : 12);
    const count = options.count ?? defaultCount;
    const wx = options.x ?? 0;
    const wy = options.y ?? 0;
    const wz = options.z ?? 0;

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) {
        this.particles.shift(); // Evict oldest
      }

      if (type === 'ring') {
        this.particles.push({
          type: 'ring',
          x: wx,
          y: wy,
          z: wz,
          radius: options.startRadius ?? 8,
          maxRadius: options.maxRadius ?? 28,
          growthRate: options.growthRate ?? 40,
          color: options.color || '#10b981',
          lineWidth: options.lineWidth ?? 2,
          life: options.life ?? 0.4,
          maxLife: options.life ?? 0.4,
          alpha: 1.0
        });
        continue;
      }

      if (type === 'cc_ring') {
        const ccLife = options.life ?? 0.8;
        this.particles.push({
          type: 'cc_ring',
          x: wx,
          y: wy,
          z: wz,
          overheadZ: options.overheadZ ?? 35,
          radius: options.startRadius ?? options.radius ?? 10,
          maxRadius: options.maxRadius ?? 42,
          growthRate: options.growthRate ?? 45,
          color: options.color || '#fbbf24',
          lineWidth: options.lineWidth ?? 3,
          orbCount: options.orbCount ?? options.orbitCount ?? 3,
          orbitCount: options.orbitCount ?? options.orbCount ?? 3,
          orbitRadius: options.orbitRadius ?? 22,
          orbitSpeed: options.orbitSpeed ?? 5.5,
          orbitAngle: options.orbitAngle ?? 0,
          orbColor: options.orbColor || '#fef08a',
          life: ccLife,
          maxLife: ccLife,
          alpha: 1.0
        });
        continue;
      }

      if (type === 'confetti') {
        const confettiColors = ['#f59e0b', '#ec4899', '#10b981', '#3b82f6', '#8b5cf6', '#facc15'];
        const chosenColor = options.color || confettiColors[Math.floor(Math.random() * confettiColors.length)];
        const spreadSpeed = (options.speed ?? 45) * (0.6 + Math.random() * 0.8);
        const spreadAngle = Math.random() * Math.PI * 2;
        const confLife = options.life ?? (1.2 + Math.random() * 0.6);

        this.particles.push({
          type: 'confetti',
          x: wx,
          y: wy,
          z: wz + (options.zOffset ?? 10) + Math.random() * 15,
          vx: Math.cos(spreadAngle) * spreadSpeed,
          vy: Math.sin(spreadAngle) * spreadSpeed,
          vz: (options.vz ?? 35) + Math.random() * 25,
          drag: options.drag ?? 0.94,
          color: chosenColor,
          width: options.width ?? (options.size ? options.size * 0.8 : 5),
          height: options.height ?? (options.size ? options.size * 1.6 : 9),
          size: options.size ?? 6,
          angle: Math.random() * Math.PI * 2,
          angularVelocity: (Math.random() * 8 - 4),
          life: confLife,
          maxLife: confLife,
          alpha: 1.0
        });
        continue;
      }

      if (type === 'trail') {
        const trailLife = options.life ?? 0.15;
        const initialSize = options.size ?? 4;
        const speed = (options.speed ?? 10) * Math.random();
        const angle = Math.random() * Math.PI * 2;
        this.particles.push({
          type: 'trail',
          x: wx,
          y: wy,
          z: wz,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          vz: 0,
          drag: options.drag ?? 0.92,
          color: options.color || '#60a5fa',
          size: initialSize,
          initialSize: initialSize,
          life: trailLife,
          maxLife: trailLife,
          alpha: 1.0
        });
        continue;
      }

      // Procedural directional velocity
      const angle = Math.random() * Math.PI * 2;
      const speed = (options.speed ?? 80) * (0.5 + Math.random() * 0.8);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const vz = (options.vz ?? 20) * Math.random();

      let color = options.color || '#f59e0b';
      if (type === 'fire') color = Math.random() > 0.5 ? '#ef4444' : '#f97316';
      else if (type === 'frost') color = Math.random() > 0.5 ? '#38bdf8' : '#e0f2fe';
      else if (type === 'heal') color = '#22c55e';

      this.particles.push({
        type: type || 'spark',
        x: wx,
        y: wy,
        z: wz,
        vx,
        vy,
        vz,
        drag: options.drag ?? 0.92,
        color,
        size: (options.size ?? 3) * (0.8 + Math.random() * 0.5),
        life: options.life ?? 0.6,
        maxLife: options.life ?? 0.6,
        alpha: 1.0
      });
    }
  }

  /**
   * Adds floating damage, heal, or gold text above world position.
   * @param {string} text 
   * @param {number} x 
   * @param {number} y 
   * @param {Object} [options={}]
   */
  addFloatingText(text, x, y, options = {}) {
    if (this.floatingTexts.length >= (this.maxFloatingTexts || 200)) {
      this.floatingTexts.shift();
    }
    this.floatingTexts.push({
      text: String(text),
      x,
      y,
      z: options.z ?? 40,
      vz: options.vz ?? 45,
      color: options.color || '#ffffff',
      fontSize: options.fontSize ?? (options.isCrit ? 18 : 14),
      isCrit: !!options.isCrit,
      life: options.life ?? 1.0,
      maxLife: options.life ?? 1.0,
      alpha: 1.0
    });
  }

  /**
   * Emits tactile move/attack indicator: 3 concentric 2:1 isometric expanding waves
   * and 4 converging chevrons pointing inward to (x, y).
   * @param {number} x - Target world X coordinate
   * @param {number} y - Target world Y coordinate
   * @param {string} [color='#10b981'] - Wave and reticle color
   * @param {boolean} [isAttack=false] - If true, defaults color to '#ef4444'
   */
  emitMoveIndicator(x, y, color = '#10b981', isAttack = false) {
    const indicatorColor = isAttack ? (color === '#10b981' ? '#ef4444' : color) : color;

    // 1. 3 Concentric expanding waves with staggered start delays
    const waves = [
      { delay: 0.00, startRadius: 6, maxRadius: 32, growthRate: 58, life: 0.45, lineWidth: 2.5 },
      { delay: 0.08, startRadius: 4, maxRadius: 24, growthRate: 50, life: 0.40, lineWidth: 2.0 },
      { delay: 0.16, startRadius: 2, maxRadius: 18, growthRate: 42, life: 0.35, lineWidth: 1.5 }
    ];

    for (const w of waves) {
      if (this.particles.length >= this.maxParticles) {
        this.particles.shift();
      }
      this.particles.push({
        type: 'ring',
        x,
        y,
        z: 0,
        delay: w.delay,
        radius: w.startRadius,
        maxRadius: w.maxRadius,
        growthRate: w.growthRate,
        color: indicatorColor,
        lineWidth: w.lineWidth,
        life: w.life,
        maxLife: w.life,
        alpha: 1.0
      });
    }

    // 2. 4 Central reticle chevrons converging to (x, y) along isometric axes
    const angles = [Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4];
    for (const angle of angles) {
      if (this.particles.length >= this.maxParticles) {
        this.particles.shift();
      }
      this.particles.push({
        type: 'reticle_marker',
        x,
        y,
        z: 0,
        angle,
        dist: 24,
        minDist: 4,
        convergeSpeed: 52,
        color: indicatorColor,
        life: 0.40,
        maxLife: 0.40,
        alpha: 1.0
      });
    }
  }

  /**
   * Emits hero-specific combat hit VFX presets.
   * @param {string} heroId - 'knight' | 'sorceress' | 'ranger' | 'assassin' | 'cleric'
   * @param {number} x - Target world X
   * @param {number} y - Target world Y
   * @param {boolean} [isCrit=false] - Whether hit is a critical strike
   */
  emitHeroAttackHit(heroId, x, y, isCrit = false) {
    const id = String(heroId || 'knight').toLowerCase();
    const multiplier = isCrit ? 2 : 1;

    if (id === 'knight' || id === 'guardian') {
      // Knight: faíscas branco/dourado (#fef08a), anel de impacto metálico azul (#60a5fa)
      this.emit('spark', {
        x,
        y,
        count: 14 * multiplier,
        speed: 160,
        color: '#fef08a'
      });
      this.emit('ring', {
        x,
        y,
        startRadius: 8,
        maxRadius: isCrit ? 42 : 28,
        color: '#60a5fa',
        lineWidth: isCrit ? 3.5 : 2.5,
        life: 0.35
      });
    } else if (id === 'sorceress' || id === 'mage') {
      // Sorceress: fagulhas de fogo (#f97316 / #ef4444) e anel de calor radiante
      this.emit('fire', {
        x,
        y,
        count: 16 * multiplier,
        speed: 170,
        color: '#f97316'
      });
      this.emit('ring', {
        x,
        y,
        startRadius: 10,
        maxRadius: isCrit ? 48 : 32,
        color: '#ef4444',
        lineWidth: isCrit ? 3.5 : 2.5,
        life: 0.4
      });
    } else if (id === 'ranger' || id === 'archer') {
      // Ranger: fragmentos esmeralda perfurantes (#34d399 / #10b981)
      this.emit('spark', {
        x,
        y,
        count: 12 * multiplier,
        speed: 180,
        color: '#34d399'
      });
      this.emit('spark', {
        x,
        y,
        count: 6 * multiplier,
        speed: 120,
        color: '#10b981'
      });
      if (isCrit) {
        this.emit('ring', {
          x,
          y,
          startRadius: 8,
          maxRadius: 36,
          color: '#34d399',
          lineWidth: 2.5,
          life: 0.3
        });
      }
    } else if (id === 'assassin' || id === 'shadow') {
      // Assassin: faíscas venenosas violeta (#a855f7) e fumaça sombria (#1e1b4b)
      this.emit('spark', {
        x,
        y,
        count: 16 * multiplier,
        speed: 160,
        color: '#a855f7'
      });
      this.emit('spark', {
        x,
        y,
        count: 8 * multiplier,
        speed: 70,
        size: 5,
        color: '#1e1b4b'
      });
      if (isCrit) {
        this.emit('ring', {
          x,
          y,
          startRadius: 10,
          maxRadius: 40,
          color: '#a855f7',
          lineWidth: 3.0,
          life: 0.35
        });
      }
    } else if (id === 'cleric' || id === 'priest') {
      // Cleric: partículas solares cintilantes (#fde047) e anel de irradiação sagrada (#fef08a)
      this.emit('spark', {
        x,
        y,
        count: 14 * multiplier,
        speed: 150,
        color: '#fde047'
      });
      this.emit('ring', {
        x,
        y,
        startRadius: 10,
        maxRadius: isCrit ? 44 : 30,
        color: '#fef08a',
        lineWidth: isCrit ? 3.5 : 2.5,
        life: 0.4
      });
    } else {
      this.emit('spark', {
        x,
        y,
        count: 12 * multiplier,
        speed: 150,
        color: '#f59e0b'
      });
    }

    // Se isCrit: dobra contagem de faíscas (multiplier 2x), adiciona anel extra e flash branco
    if (isCrit) {
      this.emit('ring', {
        x,
        y,
        startRadius: 12,
        maxRadius: 52,
        growthRate: 90,
        color: '#ffffff',
        lineWidth: 3.0,
        life: 0.3
      });
      this.emit('spark', {
        x,
        y,
        count: 10,
        speed: 210,
        size: 4,
        color: '#ffffff'
      });
    }
  }

  update(dt = 0.01667) {
    // 1. Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // Handle staggered wave delay
      if (typeof p.delay === 'number' && p.delay > 0) {
        p.delay -= dt;
        continue;
      }

      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      p.alpha = Math.max(0, p.life / p.maxLife);

      if (p.type === 'ring') {
        p.radius += p.growthRate * dt;
      } else if (p.type === 'reticle_marker') {
        p.dist = Math.max(p.minDist || 4, p.dist - (p.convergeSpeed || 52) * dt);
      } else if (p.type === 'confetti') {
        p.angle = (p.angle || 0) + (p.angularVelocity || 3.0) * dt;
        p.x += (p.vx + Math.sin(p.life * 10) * 18) * dt;
        p.y += (p.vy + Math.cos(p.life * 8) * 12) * dt;
        p.z = Math.max(0, p.z + p.vz * dt);
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.vz -= 30 * dt; // gentle gravity
      } else if (p.type === 'trail') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.size = (p.initialSize || p.size) * Math.max(0, p.life / p.maxLife);
      } else if (p.type === 'cc_ring') {
        p.radius += p.growthRate * dt;
        p.orbitAngle = (p.orbitAngle || 0) + (p.orbitSpeed || 5.5) * dt;
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z = Math.max(0, p.z + p.vz * dt);
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.vz -= 98 * dt; // gravity
      }
    }

    // 2. Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
        continue;
      }
      ft.z += ft.vz * dt;
      ft.vz *= 0.94;
      ft.alpha = Math.min(1.0, ft.life / (ft.maxLife * 0.4));
    }
  }

  draw(ctx, camera, zoom = 1.0) {
    if (!ctx || typeof ctx.save !== 'function') return;

    ctx.save();

    // 1. Draw particles with additive blending
    if (this.particles.length > 0) {
      if (ctx.globalCompositeOperation) {
        ctx.globalCompositeOperation = 'lighter';
      }

      for (const p of this.particles) {
        if (typeof p.delay === 'number' && p.delay > 0) continue;

        const { sx, sy } = worldToScreen(p.x, p.y, p.z || 0, camera, zoom);

        if (p.type === 'ring') {
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(sx, sy, p.radius * zoom, (p.radius * 0.5) * zoom, 0, 0, Math.PI * 2);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.lineWidth || 2;
          ctx.globalAlpha = p.alpha;
          ctx.stroke();
          ctx.restore();
        } else if (p.type === 'reticle_marker') {
          // Draw converging chevron in isometric 2:1 perspective
          const cosA = Math.cos(p.angle);
          const sinA = Math.sin(p.angle);
          const d = p.dist * zoom;
          const tipX = sx + cosA * d;
          const tipY = sy + sinA * 0.5 * d;

          const outX = cosA;
          const outY = sinA * 0.5;
          const outLen = Math.hypot(outX, outY) || 1;
          const nx = outX / outLen;
          const ny = outY / outLen;
          const px = -ny;
          const py = nx;

          const armLen = 7 * zoom;
          const armSpread = 5 * zoom;
          const p1x = tipX + nx * armLen + px * armSpread;
          const p1y = tipY + ny * armLen + py * armSpread;
          const p2x = tipX + nx * armLen - px * armSpread;
          const p2y = tipY + ny * armLen - py * armSpread;

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(p1x, p1y);
          ctx.lineTo(tipX, tipY);
          ctx.lineTo(p2x, p2y);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(1.5, 2 * zoom);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.globalAlpha = p.alpha;
          ctx.stroke();
          ctx.restore();
        } else if (p.type === 'confetti') {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(p.angle || 0);
          const w = (p.width || 5) * zoom;
          const h = (p.height || 9) * zoom;
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.fillRect(-w / 2, -h / 2, w, h);
          ctx.restore();
        } else if (p.type === 'trail') {
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(0.5, p.size * zoom), 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha * 0.85;
          ctx.fill();
        } else if (p.type === 'cc_ring') {
          // Expanding ground ellipse in 2:1 perspective
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(sx, sy, p.radius * zoom, (p.radius * 0.5) * zoom, 0, 0, Math.PI * 2);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = (p.lineWidth || 2.5) * zoom;
          ctx.globalAlpha = p.alpha;
          ctx.stroke();
          ctx.restore();

          // Overhead orbiting orbs
          const orbCount = p.orbCount || 3;
          const orbZ = p.overheadZ ?? 35;
          for (let k = 0; k < orbCount; k++) {
            const ang = (p.orbitAngle || 0) + (k * Math.PI * 2) / orbCount;
            const ox = p.x + Math.cos(ang) * (p.orbitRadius || 22);
            const oy = p.y + Math.sin(ang) * (p.orbitRadius || 22);
            const orbPos = worldToScreen(ox, oy, orbZ, camera, zoom);
            ctx.save();
            ctx.beginPath();
            ctx.arc(orbPos.sx, orbPos.sy, Math.max(1, 3.5 * zoom), 0, Math.PI * 2);
            ctx.fillStyle = p.orbColor || '#fef08a';
            ctx.globalAlpha = p.alpha;
            ctx.fill();
            ctx.restore();
          }
        } else {
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(1, p.size * zoom), 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.fill();
        }
      }

      if (ctx.globalCompositeOperation) {
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    // 2. Draw Floating Combat Text
    for (const ft of this.floatingTexts) {
      const { sx, sy } = worldToScreen(ft.x, ft.y, ft.z, camera, zoom);

      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.font = `${ft.isCrit ? 'bold ' : ''}${Math.round(ft.fontSize * zoom)}px sans-serif`;
      ctx.textAlign = 'center';

      // Outline
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = ft.isCrit ? 3 : 2;
      ctx.strokeText(ft.text, sx, sy);

      // Text Fill
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, sx, sy);

      ctx.restore();
    }

    ctx.restore();
  }

  clear() {
    this.particles = [];
    this.floatingTexts = [];
  }
}
