/**
 * 7-Pass Canvas 2D Isometric Rendering Pipeline.
 *
 * Pass 1: Terrain Tile Grid with Viewport Culling (2:1 dimetric tiles)
 * Pass 2: Ground Decals & Ability Targeting Indicators
 * Pass 3: Ground Unit Drop Shadows
 * Pass 4: Y-Depth Sorted Dynamic Entities (Wx + Wy)
 * Pass 5: Active VFX Particles & Floating Combat Text
 * Pass 6: Entity Overhead Health/Mana/Channel Bars
 * Pass 7: Screen-Space HUD Notifications & Low HP Vignette
 *
 * Source: PROJECT.md §Rendering Pipeline & explorer_m1_3/handoff.md
 */

import { worldToScreen, screenToWorld, compareDepth } from '../core/isometric.js';
import { IndicatorType } from '../core/input.js';

export class Renderer {
  /**
   * @param {HTMLCanvasElement} [canvas=null]
   * @param {Object} [options={}]
   */
  constructor(canvas = null, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas && typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
    this.dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

    this.viewportWidth = options.width || (canvas ? canvas.width : 1280);
    this.viewportHeight = options.height || (canvas ? canvas.height : 720);

    this.tileSize = { width: 64, height: 32 };
    this.mapSize = { width: 3200, height: 3200 };
    this.tileStep = 64; // World units per tile
  }

  resize(width, height, dpr = 1) {
    this.viewportWidth = width;
    this.viewportHeight = height;
    this.dpr = dpr;
    if (this.canvas) {
      this.canvas.width = Math.floor(width * dpr);
      this.canvas.height = Math.floor(height * dpr);
      if (this.ctx && typeof this.ctx.scale === 'function') {
        this.ctx.scale(dpr, dpr);
      }
    }
  }

  isEntityInViewport(entity, camera, zoom = 1.0, margin = 120) {
    const { sx, sy } = worldToScreen(entity.x, entity.y, entity.z || 0, camera, zoom, {
      width: this.viewportWidth,
      height: this.viewportHeight
    });
    return (
      sx >= -margin &&
      sx <= this.viewportWidth + margin &&
      sy >= -margin &&
      sy <= this.viewportHeight + margin
    );
  }

  /**
   * Main render method executing all 7 passes.
   */
  render(gameState, camera, inputManager = null, particleSystem = null) {
    const ctx = this.ctx;
    if (!ctx || typeof ctx.beginPath !== 'function') return;

    const zoom = camera?.zoom ?? 1.0;
    const entities = gameState?.entities || [];
    const playerHero = gameState?.playerHero || null;

    // Clear canvas
    if (typeof ctx.clearRect === 'function') {
      ctx.clearRect(0, 0, this.viewportWidth, this.viewportHeight);
    }

    // ─────────────────────────────────────────────────────────────
    // Passes 1 to 6: World, Entities, VFX & Overhead Bars with Screen Shake
    // ─────────────────────────────────────────────────────────────
    if (typeof ctx.save === 'function') {
      ctx.save();
    }
    if (camera && camera.shakeEnabled && (camera.shakeOffsetX || camera.shakeOffsetY || camera.shakeRoll)) {
      if (typeof ctx.translate === 'function') {
        ctx.translate(camera.shakeOffsetX, camera.shakeOffsetY);
      }
      if (camera.shakeRoll) {
        if (typeof ctx.translate === 'function' && typeof ctx.rotate === 'function') {
          ctx.translate(this.viewportWidth / 2, this.viewportHeight / 2);
          ctx.rotate(camera.shakeRoll);
          ctx.translate(-this.viewportWidth / 2, -this.viewportHeight / 2);
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // Pass 1: Terrain Tile Grid with Viewport Culling
    // ─────────────────────────────────────────────────────────────
    this.pass1_Terrain(ctx, camera, zoom);

    // ─────────────────────────────────────────────────────────────
    // Pass 2: Ground Decals & Ability Targeting Indicators
    // ─────────────────────────────────────────────────────────────
    this.pass2_GroundDecals(ctx, gameState, inputManager, camera, zoom);

    // ─────────────────────────────────────────────────────────────
    // Pass 3: Ground Unit Drop Shadows
    // ─────────────────────────────────────────────────────────────
    this.pass3_GroundShadows(ctx, entities, camera, zoom);

    // ─────────────────────────────────────────────────────────────
    // Pass 4: Y-Depth Sorted Dynamic Entities (Wx + Wy)
    // ─────────────────────────────────────────────────────────────
    this.pass4_SortedEntities(ctx, entities, camera, zoom);

    // ─────────────────────────────────────────────────────────────
    // Pass 5: Active VFX Particles & Floating Combat Text
    // ─────────────────────────────────────────────────────────────
    this.pass5_Particles(ctx, particleSystem, camera, zoom);

    // ─────────────────────────────────────────────────────────────
    // Pass 6: Overhead Health and Mana Bars
    // ─────────────────────────────────────────────────────────────
    this.pass6_OverheadHUD(ctx, entities, camera, zoom);

    if (typeof ctx.restore === 'function') {
      ctx.restore();
    }

    // ─────────────────────────────────────────────────────────────
    // Pass 7: Screen-Space HUD Notifications & Low HP Vignette (Static)
    // ─────────────────────────────────────────────────────────────
    this.pass7_ScreenHUD(ctx, gameState, playerHero);
  }

  // ───────────────────────────────────────────────────────────────
  // Pass 1: Terrain Grid
  // ───────────────────────────────────────────────────────────────
  pass1_Terrain(ctx, camera, zoom) {
    const vp = { width: this.viewportWidth, height: this.viewportHeight };
    const tl = screenToWorld(0, 0, camera, zoom, vp);
    const tr = screenToWorld(this.viewportWidth, 0, camera, zoom, vp);
    const br = screenToWorld(this.viewportWidth, this.viewportHeight, camera, zoom, vp);
    const bl = screenToWorld(0, this.viewportHeight, camera, zoom, vp);

    const minWx = Math.max(0, Math.min(tl.wx, tr.wx, br.wx, bl.wx) - this.tileStep);
    const maxWx = Math.min(this.mapSize.width, Math.max(tl.wx, tr.wx, br.wx, bl.wx) + this.tileStep);
    const minWy = Math.max(0, Math.min(tl.wy, tr.wy, br.wy, bl.wy) - this.tileStep);
    const maxWy = Math.min(this.mapSize.height, Math.max(tl.wy, tr.wy, br.wy, bl.wy) + this.tileStep);

    const S = this.tileStep;
    const maxTilesX = Math.floor(this.mapSize.width / S);
    const maxTilesY = Math.floor(this.mapSize.height / S);
    const X0 = Math.max(0, Math.floor(minWx / S));
    const X1 = Math.min(maxTilesX - 1, Math.ceil(maxWx / S));
    const Y0 = Math.max(0, Math.floor(minWy / S));
    const Y1 = Math.min(maxTilesY - 1, Math.ceil(maxWy / S));

    const halfS = S / 2;

    for (let ty = Y0; ty <= Y1; ty++) {
      for (let tx = X0; tx <= X1; tx++) {
        const wx = tx * S + halfS;
        const wy = ty * S + halfS;

        // Project the 4 corners of the world tile so rotation never causes gaps or overlaps
        const c0 = worldToScreen(wx - halfS, wy - halfS, 0, camera, zoom, vp);
        const c1 = worldToScreen(wx + halfS, wy - halfS, 0, camera, zoom, vp);
        const c2 = worldToScreen(wx + halfS, wy + halfS, 0, camera, zoom, vp);
        const c3 = worldToScreen(wx - halfS, wy + halfS, 0, camera, zoom, vp);

        // Lane identification (diagonal y = x corridor with width 350)
        const distToLane = Math.abs(wx - wy) / Math.SQRT2;
        const isLane = distToLane <= 175;
        const isAlliedBase = (wx <= 700 && wy <= 700);
        const isEnemyBase = (wx >= 2500 && wy >= 2500);

        let fillStyle = '#1b281d'; // Forest/Jungle ground
        let strokeStyle = '#152017';
        if (isLane) {
          fillStyle = '#2d2b27'; // Cobblestone lane
          strokeStyle = '#252320';
        } else if (isAlliedBase) {
          fillStyle = '#1e293b'; // Slate base
          strokeStyle = '#334155';
        } else if (isEnemyBase) {
          fillStyle = '#2d1b22'; // Crimson base
          strokeStyle = '#451a24';
        }

        ctx.beginPath();
        ctx.moveTo(c0.sx, c0.sy);
        ctx.lineTo(c1.sx, c1.sy);
        ctx.lineTo(c2.sx, c2.sy);
        ctx.lineTo(c3.sx, c3.sy);
        ctx.closePath();

        ctx.fillStyle = fillStyle;
        ctx.fill();
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  // ───────────────────────────────────────────────────────────────
  // Pass 2: Ground Decals & Targeting Indicators
  // ───────────────────────────────────────────────────────────────
  pass2_GroundDecals(ctx, gameState, inputManager, camera, zoom) {
    const vp = { width: this.viewportWidth, height: this.viewportHeight };

    // 1. Fountain Zones (Radius 250)
    // Allied Fountain at (400, 400)
    const allyF = worldToScreen(400, 400, 0, camera, zoom, vp);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(allyF.sx, allyF.sy, 250 * 0.5 * zoom, 250 * 0.25 * zoom, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(59, 130, 246, 0.12)';
    ctx.fill();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    if (ctx.setLineDash) ctx.setLineDash([8, 6]);
    ctx.stroke();
    ctx.restore();

    // Enemy Fountain at (2800, 2800)
    const enemyF = worldToScreen(2800, 2800, 0, camera, zoom, vp);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(enemyF.sx, enemyF.sy, 250 * 0.5 * zoom, 250 * 0.25 * zoom, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
    ctx.fill();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    if (ctx.setLineDash) ctx.setLineDash([8, 6]);
    ctx.stroke();
    ctx.restore();

    // 2. Tower Range Indicators
    const structures = (gameState?.entities || []).filter(e => e.type === 'tower' && e.isAlive && e.isAlive());
    const hero = gameState?.playerHero;
    for (const tower of structures) {
      const dist = hero ? Math.hypot(hero.x - tower.x, hero.y - tower.y) : 9999;
      if (dist <= 700) {
        const { sx, sy } = worldToScreen(tower.x, tower.y, 0, camera, zoom, vp);
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(sx, sy, 400 * 0.5 * zoom, 400 * 0.25 * zoom, 0, 0, Math.PI * 2);
        ctx.fillStyle = tower.team === 'allied' ? 'rgba(59, 130, 246, 0.08)' : 'rgba(239, 68, 68, 0.12)';
        ctx.fill();
        ctx.strokeStyle = tower.team === 'allied' ? 'rgba(59, 130, 246, 0.6)' : 'rgba(239, 68, 68, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }
    }

    // 2b. Locked Attack Target Reticle
    const attackTarget = hero?.attackTarget;
    if (attackTarget && (typeof attackTarget.isAlive === 'function' ? attackTarget.isAlive() : (attackTarget.hp > 0))) {
      const { sx, sy } = worldToScreen(attackTarget.x, attackTarget.y, 0, camera, zoom, vp);
      const targetR = Math.max(18, (attackTarget.selectionRadius || attackTarget.radius || 24) * 1.35 * zoom);
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const pulse = 1.0 + Math.sin(now * 0.008) * 0.12;

      ctx.save();
      // Outer pulsing dashed ring
      ctx.beginPath();
      ctx.ellipse(sx, sy, targetR * pulse, (targetR * 0.5) * pulse, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.5;
      if (ctx.setLineDash) ctx.setLineDash([6, 4]);
      ctx.stroke();

      // Red center bullseye
      ctx.beginPath();
      ctx.arc(sx, sy, 3.5 * zoom, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      ctx.restore();
    }

    // 3. Ability Targeting Indicators (Driven by inputManager)
    const indicator = inputManager && typeof inputManager.getTargetingIndicator === 'function'
      ? inputManager.getTargetingIndicator()
      : null;

    if (indicator && hero) {
      this.drawTargetingIndicator(ctx, indicator, camera, zoom, vp);
    }
  }

  drawTargetingIndicator(ctx, ind, camera, zoom, vp) {
    ctx.save();

    if (ind.type === IndicatorType.DIRECTIONAL_LINE) {
      const start = worldToScreen(ind.origin.x, ind.origin.y, 0, camera, zoom, vp);
      const end = worldToScreen(ind.end.x, ind.end.y, 0, camera, zoom, vp);

      ctx.beginPath();
      ctx.moveTo(start.sx, start.sy);
      ctx.lineTo(end.sx, end.sy);
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = Math.max(3, (ind.width || 30) * 0.5 * zoom);
      ctx.globalAlpha = 0.5;
      ctx.stroke();

      // Arrow head
      ctx.beginPath();
      ctx.arc(end.sx, end.sy, 8 * zoom, 0, Math.PI * 2);
      ctx.fillStyle = '#00e5ff';
      ctx.globalAlpha = 0.8;
      ctx.fill();
    } else if (ind.type === IndicatorType.GROUND_AOE) {
      // Cast range circle from hero
      const origin = worldToScreen(ind.origin.x, ind.origin.y, 0, camera, zoom, vp);
      ctx.beginPath();
      ctx.ellipse(origin.sx, origin.sy, ind.castRange * 0.5 * zoom, ind.castRange * 0.25 * zoom, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // AoE target circle
      const target = worldToScreen(ind.target.x, ind.target.y, 0, camera, zoom, vp);
      ctx.beginPath();
      ctx.ellipse(target.sx, target.sy, ind.aoeRadius * 0.5 * zoom, ind.aoeRadius * 0.25 * zoom, 0, 0, Math.PI * 2);
      ctx.fillStyle = ind.isClamped ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.25)';
      ctx.fill();
      ctx.strokeStyle = ind.isClamped ? '#ef4444' : '#f59e0b';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Guide line from hero origin to target endpoint
      ctx.beginPath();
      ctx.moveTo(origin.sx, origin.sy);
      ctx.lineTo(target.sx, target.sy);
      ctx.strokeStyle = ind.isClamped ? 'rgba(239, 68, 68, 0.45)' : 'rgba(245, 158, 11, 0.45)';
      ctx.lineWidth = 1.5;
      if (ctx.setLineDash) ctx.setLineDash([6, 6]);
      ctx.stroke();
      if (ctx.setLineDash) ctx.setLineDash([]);
    } else if (ind.type === IndicatorType.TARGET_UNIT) {
      // Range circle
      const origin = worldToScreen(ind.origin.x, ind.origin.y, 0, camera, zoom, vp);
      ctx.beginPath();
      ctx.ellipse(origin.sx, origin.sy, ind.range * 0.5 * zoom, ind.range * 0.25 * zoom, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(241, 196, 15, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Unit reticle if hovering valid entity
      if (ind.targetEntity) {
        const tgt = worldToScreen(ind.targetEntity.x, ind.targetEntity.y, 0, camera, zoom, vp);
        ctx.beginPath();
        ctx.arc(tgt.sx, tgt.sy - (ind.targetEntity.height || 40) * 0.5 * zoom, 24 * zoom, 0, Math.PI * 2);
        ctx.strokeStyle = ind.isValidTarget ? '#22c55e' : '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Guide line from hero origin to target entity
        ctx.beginPath();
        ctx.moveTo(origin.sx, origin.sy);
        ctx.lineTo(tgt.sx, tgt.sy);
        ctx.strokeStyle = ind.isValidTarget ? 'rgba(34, 197, 94, 0.45)' : 'rgba(239, 68, 68, 0.45)';
        ctx.lineWidth = 1.5;
        if (ctx.setLineDash) ctx.setLineDash([4, 4]);
        ctx.stroke();
        if (ctx.setLineDash) ctx.setLineDash([]);
      }
    } else if (ind.type === IndicatorType.SELF_AOE) {
      const origin = worldToScreen(ind.origin.x, ind.origin.y, 0, camera, zoom, vp);
      ctx.beginPath();
      ctx.ellipse(origin.sx, origin.sy, ind.radius * 0.5 * zoom, ind.radius * 0.25 * zoom, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(168, 85, 247, 0.2)';
      ctx.fill();
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  }

  // ───────────────────────────────────────────────────────────────
  // Pass 3: Ground Shadows
  // ───────────────────────────────────────────────────────────────
  pass3_GroundShadows(ctx, entities, camera, zoom) {
    const vp = { width: this.viewportWidth, height: this.viewportHeight };

    for (const ent of entities) {
      const isDead = typeof ent.isDead === 'function' ? ent.isDead() : !!ent.isDead;
      if (isDead || (typeof ent.hp === 'number' && ent.hp <= 0)) continue;
      if (!this.isEntityInViewport(ent, camera, zoom)) continue;

      const { sx, sy } = worldToScreen(ent.x, ent.y, 0, camera, zoom, vp);
      const baseR = ent.radius || 20;
      const sRx = baseR * 1.15 * zoom;
      const sRy = sRx * 0.5;

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(sx, sy, sRx, sRy, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fill();
      ctx.restore();
    }
  }

  // ───────────────────────────────────────────────────────────────
  // Pass 4: Dynamic Y-Depth Sorted Entities
  // ───────────────────────────────────────────────────────────────
  pass4_SortedEntities(ctx, entities, camera, zoom) {
    const visible = entities.filter(e => {
      const isDead = typeof e.isDead === 'function' ? e.isDead() : !!e.isDead;
      if (isDead || (typeof e.hp === 'number' && e.hp <= 0)) return false;
      return this.isEntityInViewport(e, camera, zoom);
    });

    visible.sort(compareDepth);

    for (const ent of visible) {
      if (typeof ent.draw === 'function') {
        ent.draw(ctx, camera, zoom);
      }
    }
  }

  // ───────────────────────────────────────────────────────────────
  // Pass 5: VFX Particles & Floating Combat Text
  // ───────────────────────────────────────────────────────────────
  pass5_Particles(ctx, particleSystem, camera, zoom) {
    if (particleSystem && typeof particleSystem.draw === 'function') {
      particleSystem.draw(ctx, camera, zoom);
    }
  }

  // ───────────────────────────────────────────────────────────────
  // Pass 6: Overhead Health & Mana Bars
  // ───────────────────────────────────────────────────────────────
  pass6_OverheadHUD(ctx, entities, camera, zoom) {
    for (const ent of entities) {
      const isDead = typeof ent.isDead === 'function' ? ent.isDead() : !!ent.isDead;
      if (isDead || (typeof ent.hp === 'number' && ent.hp <= 0)) continue;
      if (!this.isEntityInViewport(ent, camera, zoom)) continue;

      if (typeof ent.drawHUD === 'function') {
        ent.drawHUD(ctx, camera, zoom);
      }
    }
  }

  // ───────────────────────────────────────────────────────────────
  // Pass 7: Screen-Space HUD Notifications & Low HP Vignette
  // ───────────────────────────────────────────────────────────────
  pass7_ScreenHUD(ctx, gameState, playerHero) {
    // Low HP Red Vignette Screen Pulse
    if (playerHero && playerHero.isAlive && playerHero.isAlive()) {
      const hpRatio = playerHero.hp / (playerHero.maxHp || 1);
      if (hpRatio < 0.25) {
        ctx.save();
        const pulse = Math.sin(Date.now() * 0.006) * 0.5 + 0.5;
        const alpha = (0.25 - hpRatio) * 2 * (0.4 + 0.3 * pulse);
        ctx.fillStyle = `rgba(239, 68, 68, ${alpha.toFixed(3)})`;
        ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);
        ctx.restore();
      }
    }

    // Match Announcements (Victory / Defeat)
    if (gameState?.isVictory || gameState?.isDefeat) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);

      const title = gameState.isVictory ? 'VITÓRIA' : 'DERROTA';
      const color = gameState.isVictory ? '#fbbf24' : '#ef4444';

      ctx.font = 'bold 54px sans-serif';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.shadowColor = color;
      ctx.shadowBlur = 20;
      ctx.fillText(title, this.viewportWidth / 2, this.viewportHeight / 2 - 20);

      ctx.font = '20px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 0;
      ctx.fillText('Pressione ESC ou recarregue para reiniciar', this.viewportWidth / 2, this.viewportHeight / 2 + 35);

      ctx.restore();
    }
  }
}
