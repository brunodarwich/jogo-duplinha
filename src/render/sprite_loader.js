/**
 * Centralized Sprite & 3D Asset Loader with In-Memory Cache and 3D/Chibi Canvas Renderers.
 * Safely degrades in headless/Node.js test environments where Image/window are unavailable.
 */

import { worldToScreen } from '../core/isometric.js';

export const SPRITE_PATHS = {
  // 5 Chibi Heroes (1.5 heads proportion, transparent PNG)
  hero_knight: 'assets/sprites/heroes/knight.png',
  hero_sorceress: 'assets/sprites/heroes/sorceress.png',
  hero_ranger: 'assets/sprites/heroes/ranger.png',
  hero_assassin: 'assets/sprites/heroes/assassin.png',
  hero_cleric: 'assets/sprites/heroes/cleric.png',

  // Allied Chibi Minions (Mobs)
  minion_melee_allied: 'assets/sprites/minions/minion_melee_allied.png',
  minion_ranged_allied: 'assets/sprites/minions/minion_ranged_allied.png',
  minion_cannon_allied: 'assets/sprites/minions/minion_cannon_allied.png',

  // Enemy Chibi Minions (Mobs)
  minion_melee_enemy: 'assets/sprites/minions/minion_melee_enemy.png',
  minion_ranged_enemy: 'assets/sprites/minions/minion_ranged_enemy.png',
  minion_cannon_enemy: 'assets/sprites/minions/minion_cannon_enemy.png',

  // Mini-Bosses & Supreme Boss
  boss_colossus: 'assets/sprites/bosses/colossus.png',
  boss_behemoth: 'assets/sprites/bosses/behemoth.png',
  boss_supreme: 'assets/sprites/bosses/nexus_guardian.png',

  // 3D Isometric Towers & Nexus Structures
  tower_allied: 'assets/sprites/structures/tower_allied.png',
  tower_enemy: 'assets/sprites/structures/tower_enemy.png',
  nexus_allied: 'assets/sprites/structures/nexus_allied.png',
  nexus_enemy: 'assets/sprites/structures/nexus_enemy.png',

  // UI Splash & Key Art
  ui_splash_heroes: 'assets/ui/splash_heroes.png'
};

const imageCache = new Map();

/**
 * Checks if current runtime supports HTMLImageElement loading.
 * @returns {boolean}
 */
function canLoadImages() {
  return typeof window !== 'undefined' && typeof Image !== 'undefined';
}

/**
 * Retrieves a loaded HTMLImageElement for the given sprite key, or initiates loading.
 * Returns null if not yet loaded or if running in headless Node.js tests.
 * @param {string} key
 * @returns {HTMLImageElement | null}
 */
export function getSprite(key) {
  if (!canLoadImages()) return null;

  const path = SPRITE_PATHS[key];
  if (!path) return null;

  let entry = imageCache.get(key);
  if (!entry) {
    const img = new Image();
    entry = { img, loaded: false, error: false, callbacks: [] };
    img.onload = () => {
      entry.loaded = true;
      if (entry.callbacks.length > 0) {
        const cbs = entry.callbacks.splice(0);
        cbs.forEach(cb => cb(true));
      }
    };
    img.onerror = () => {
      entry.error = true;
      if (entry.callbacks.length > 0) {
        const cbs = entry.callbacks.splice(0);
        cbs.forEach(cb => cb(false));
      }
    };
    img.src = path;
    imageCache.set(key, entry);
  }

  if (entry.loaded && entry.img.complete && entry.img.naturalWidth > 0) {
    return entry.img;
  }
  return null;
}

/**
 * Preloads all registered game sprites in the browser.
 */
export function preloadAllSprites() {
  if (!canLoadImages()) return;
  for (const key of Object.keys(SPRITE_PATHS)) {
    getSprite(key);
  }
}

/**
 * Preloads all registered game sprites and reports real-time progress.
 * Safe in headless Node.js environments (resolves immediately at 100%).
 * @param {(status: { loaded: number, total: number, percent: number, key: string }) => void} [onProgress]
 * @returns {Promise<{ loaded: number, total: number, percent: number }>}
 */
export function preloadAllSpritesWithProgress(onProgress = null) {
  const keys = Object.keys(SPRITE_PATHS);
  const total = keys.length;

  if (!canLoadImages() || total === 0) {
    const finalStatus = { loaded: total, total, percent: 100, key: 'done' };
    if (typeof onProgress === 'function') {
      onProgress(finalStatus);
    }
    return Promise.resolve(finalStatus);
  }

  let completedCount = 0;

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      const doneStatus = { loaded: total, total, percent: 100, key: 'complete' };
      if (typeof onProgress === 'function') {
        onProgress(doneStatus);
      }
      resolve(doneStatus);
    };

    // Safety timeout so broken/offline images never block the loading screen
    const timeoutId = setTimeout(finish, 4500);

    const markOne = (key) => {
      completedCount = Math.min(total, completedCount + 1);
      const percent = Math.round((completedCount / total) * 100);
      if (typeof onProgress === 'function') {
        onProgress({ loaded: completedCount, total, percent, key });
      }
      if (completedCount >= total) {
        clearTimeout(timeoutId);
        finish();
      }
    };

    for (const key of keys) {
      getSprite(key);
      const entry = imageCache.get(key);
      if (!entry || entry.loaded || entry.error) {
        markOne(key);
      } else {
        entry.callbacks = entry.callbacks || [];
        entry.callbacks.push(() => markOne(key));
      }
    }
  });
}

/**
 * Helper for Hero sprite lookup.
 * @param {string} heroId
 * @returns {HTMLImageElement | null}
 */
export function getHeroSprite(heroId) {
  return getSprite(`hero_${heroId || 'knight'}`);
}

/**
 * Helper for Minion sprite lookup.
 * @param {'melee' | 'ranged' | 'cannon'} subType
 * @param {'allied' | 'enemy'} team
 * @returns {HTMLImageElement | null}
 */
export function getMinionSprite(subType = 'melee', team = 'allied') {
  const safeTeam = team === 'enemy' ? 'enemy' : 'allied';
  const safeType = ['melee', 'ranged', 'cannon'].includes(subType) ? subType : 'melee';
  return getSprite(`minion_${safeType}_${safeTeam}`);
}

/**
 * Helper for Boss / Mini-Boss sprite lookup.
 * @param {string} bossId
 * @returns {HTMLImageElement | null}
 */
export function getBossSprite(bossId) {
  if (!bossId) return null;
  if (bossId.includes('colossus')) return getSprite('boss_colossus');
  if (bossId.includes('behemoth')) return getSprite('boss_behemoth');
  if (bossId.includes('supreme') || bossId.includes('guardian')) return getSprite('boss_supreme');
  return getSprite(bossId);
}

/**
 * Helper for 3D Tower / Nexus structure sprite lookup.
 * @param {'outer' | 'inner' | 'nexus'} tier
 * @param {'allied' | 'enemy'} team
 * @returns {HTMLImageElement | null}
 */
export function getStructureSprite(tier = 'outer', team = 'allied') {
  const safeTeam = team === 'enemy' ? 'enemy' : 'allied';
  if (tier === 'nexus') {
    return getSprite(`nexus_${safeTeam}`);
  }
  return getSprite(`tower_${safeTeam}`);
}

/**
 * Renders a transparent PNG Chibi sprite anchored at ground coordinates (sx, sy)
 * with subtle idle breathing / walk bobbing and horizontal facing flip.
 * Returns true if the sprite image was drawn, false if fallback should run.
 */
export function drawChibiSprite(ctx, img, sx, sy, drawW, drawH, options = {}) {
  if (!ctx || !img || typeof ctx.drawImage !== 'function') return false;

  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const isMoving = !!options.isMoving;
  const flipX = !!options.flipX;
  const phaseOffset = options.phaseOffset || 0;

  // Walk bounce vs idle breathing
  const bobY = isMoving
    ? -Math.abs(Math.sin(now * 0.012 + phaseOffset)) * (drawH * 0.055)
    : Math.sin(now * 0.004 + phaseOffset) * (drawH * 0.018);

  const scaleY = isMoving
    ? 1.0 + Math.sin(now * 0.024 + phaseOffset) * 0.025
    : 1.0 + Math.sin(now * 0.004 + phaseOffset) * 0.012;

  ctx.save();
  if (typeof ctx.translate === 'function') {
    ctx.translate(sx, sy + bobY);
    if (typeof ctx.scale === 'function') {
      ctx.scale(flipX ? -1 : 1, scaleY);
    }
    ctx.drawImage(img, -drawW * 0.5, -drawH * 0.90, drawW, drawH);
  } else {
    ctx.drawImage(img, sx - drawW * 0.5, sy - drawH * 0.90 + bobY, drawW, drawH);
  }
  ctx.restore();
  return true;
}

/**
 * Helper to draw an isometric 3D polygon safely on any 2D context (including headless test mocks).
 */
function fillAndStrokePoly(ctx, points, fillColor, strokeColor, lineWidth = 1) {
  if (!points || points.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  if (typeof ctx.closePath === 'function') ctx.closePath();
  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

/**
 * Renders a highly detailed 3D Isometric Tower or Nexus structure.
 * Combines 3D stepped octagonal stone geometry, high-res 3D isometric sprite asset (when loaded),
 * animated levitating 3D polyhedral mana crystal, rotating energy rings, heat-scaling glow,
 * and active target laser beam.
 */
export function drawDetailed3DStructure(ctx, structure, sx, sy, zoom = 1.0, camera = null) {
  if (!ctx) return;

  const isAllied = structure.team === 'allied';
  const isNexus = structure.tier === 'nexus' || structure.type === 'nexus';
  const r = (structure.radius || 40) * zoom;
  const h = (structure.height || (isNexus ? 65 : 90)) * zoom;
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const heatLevel = Math.min(4, structure.consecutiveHitsOnTarget || 0);

  const primaryGlow = isAllied ? '#38bdf8' : '#ef4444';
  const brightCore = isAllied ? '#e0f2fe' : '#fecaca';
  const midCrystal = isAllied ? '#0284c7' : '#b91c1c';
  const goldTrim = isAllied ? '#eab308' : '#d97706';

  ctx.save();

  // 1. Invulnerability Shield Dome (underlay back aura)
  const isInvuln = typeof structure.isInvulnerable === 'function' && structure.isInvulnerable();
  if (isInvuln) {
    ctx.beginPath();
    ctx.ellipse(sx, sy, r * 1.38, r * 0.69, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(251, 191, 36, 0.10)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.65)';
    ctx.lineWidth = 2 * zoom;
    ctx.stroke();
  }

  // 2. Ground Faction Aura Ring
  ctx.beginPath();
  ctx.ellipse(sx, sy, r * 1.15, r * 0.57, 0, 0, Math.PI * 2);
  ctx.fillStyle = isAllied ? 'rgba(56, 189, 248, 0.14)' : 'rgba(239, 68, 68, 0.14)';
  ctx.fill();
  ctx.strokeStyle = isAllied ? 'rgba(56, 189, 248, 0.45)' : 'rgba(239, 68, 68, 0.45)';
  ctx.lineWidth = 1.5 * zoom;
  ctx.stroke();

  // 3. Check if high-res 3D structure PNG is loaded
  const structSprite = getStructureSprite(isNexus ? 'nexus' : 'outer', structure.team);
  let drewSprite = false;

  if (structSprite && typeof ctx.drawImage === 'function') {
    const drawW = isNexus ? r * 3.4 : r * 3.1;
    const drawH = isNexus ? r * 3.4 : h * 1.75;
    const bobCrystal = Math.sin(now * 0.003) * (2.5 * zoom);
    ctx.drawImage(structSprite, sx - drawW * 0.5, sy - drawH * 0.84 + bobCrystal * 0.2, drawW, drawH);
    drewSprite = true;
  }

  // 4. Procedural 3D Multi-Faceted Architecture (runs when sprite is not loaded OR adds 3D dynamic crystal/effects)
  if (!drewSprite) {
    const stoneTop = isAllied ? '#cbd5e1' : '#334155';
    const stoneLeft = isAllied ? '#94a3b8' : '#1e293b';
    const stoneRight = isAllied ? '#475569' : '#0f172a';
    const stoneStroke = isAllied ? '#334155' : '#020617';

    // 4a. 3D Stepped Octagonal Pedestal Base (2 tiers)
    for (let tierIdx = 0; tierIdx < 2; tierIdx++) {
      const tr = r * (1.05 - tierIdx * 0.20);
      const tryY = tr * 0.5;
      const stepH = (10 - tierIdx * 2) * zoom;
      const baseY = sy - tierIdx * (9 * zoom);

      // Left lit 3D face
      fillAndStrokePoly(ctx, [
        { x: sx - tr, y: baseY - stepH },
        { x: sx, y: baseY + tryY - stepH },
        { x: sx, y: baseY + tryY },
        { x: sx - tr, y: baseY }
      ], stoneLeft, stoneStroke, 1);

      // Right shaded 3D face
      fillAndStrokePoly(ctx, [
        { x: sx, y: baseY + tryY - stepH },
        { x: sx + tr, y: baseY - stepH },
        { x: sx + tr, y: baseY },
        { x: sx, y: baseY + tryY }
      ], stoneRight, stoneStroke, 1);

      // Top isometric diamond/ellipse cap
      ctx.beginPath();
      ctx.ellipse(sx, baseY - stepH, tr, tryY, 0, 0, Math.PI * 2);
      ctx.fillStyle = stoneTop;
      ctx.fill();
      ctx.strokeStyle = goldTrim;
      ctx.lineWidth = 1.2 * zoom;
      ctx.stroke();
    }

    // 4b. 3D Faceted Tower Column (Left sunlit face, Center front face, Right shadowed face)
    const colBaseY = sy - 16 * zoom;
    const colTopY = sy - h * 0.88;
    const colW = r * 0.56;

    // Left sunlit column face
    fillAndStrokePoly(ctx, [
      { x: sx - colW, y: colTopY },
      { x: sx - colW * 0.25, y: colTopY + colW * 0.32 },
      { x: sx - colW * 0.30, y: colBaseY + colW * 0.35 },
      { x: sx - colW * 1.15, y: colBaseY }
    ], stoneTop, stoneStroke, 1.2);

    // Center front column face
    fillAndStrokePoly(ctx, [
      { x: sx - colW * 0.25, y: colTopY + colW * 0.32 },
      { x: sx + colW * 0.25, y: colTopY + colW * 0.32 },
      { x: sx + colW * 0.30, y: colBaseY + colW * 0.35 },
      { x: sx - colW * 0.30, y: colBaseY + colW * 0.35 }
    ], stoneLeft, stoneStroke, 1.2);

    // Right shaded column face
    fillAndStrokePoly(ctx, [
      { x: sx + colW * 0.25, y: colTopY + colW * 0.32 },
      { x: sx + colW, y: colTopY },
      { x: sx + colW * 1.15, y: colBaseY },
      { x: sx + colW * 0.30, y: colBaseY + colW * 0.35 }
    ], stoneRight, stoneStroke, 1.2);

    // Glowing Runic Channel on Center Face
    const runeTop = colTopY + colW * 0.45;
    const runeBot = colBaseY + colW * 0.15;
    ctx.beginPath();
    ctx.moveTo(sx, runeTop);
    ctx.lineTo(sx, runeBot);
    ctx.strokeStyle = primaryGlow;
    ctx.lineWidth = 3 * zoom;
    ctx.stroke();

    // 4c. Upper 3D Crown Battlements
    ctx.beginPath();
    ctx.ellipse(sx, colTopY, colW * 1.18, colW * 0.58, 0, 0, Math.PI * 2);
    ctx.fillStyle = stoneTop;
    ctx.fill();
    ctx.strokeStyle = goldTrim;
    ctx.lineWidth = 2 * zoom;
    ctx.stroke();
  }

  // 5. Dynamic 3D Floating Crystal & Orbital Rings at Crown
  const floatOffset = Math.sin(now * 0.0038) * (4.5 * zoom);
  const crystalY = sy - (isNexus ? h * 1.05 : h * 1.08) + floatOffset;
  const crystalW = (isNexus ? 18 : 13) * zoom;
  const crystalH = (isNexus ? 28 : 20) * zoom;

  // Rotating orbital energy ring around crystal
  const orbitAngle = (now * 0.002) % (Math.PI * 2);
  ctx.beginPath();
  ctx.ellipse(sx, crystalY, crystalW * 1.65, crystalW * 0.65, Math.sin(orbitAngle) * 0.25, 0, Math.PI * 2);
  ctx.strokeStyle = heatLevel > 0 ? '#fbbf24' : primaryGlow;
  ctx.lineWidth = (1.8 + heatLevel * 0.4) * zoom;
  ctx.stroke();

  if (!drewSprite) {
    // 3D Polyhedral Diamond Crystal (4 visible facets)
    // Left bright facet
    fillAndStrokePoly(ctx, [
      { x: sx, y: crystalY - crystalH },
      { x: sx - crystalW, y: crystalY },
      { x: sx, y: crystalY + crystalH * 0.25 }
    ], brightCore, primaryGlow, 1);

    // Right mid facet
    fillAndStrokePoly(ctx, [
      { x: sx, y: crystalY - crystalH },
      { x: sx, y: crystalY + crystalH * 0.25 },
      { x: sx + crystalW, y: crystalY }
    ], primaryGlow, midCrystal, 1);

    // Bottom-left facet
    fillAndStrokePoly(ctx, [
      { x: sx - crystalW, y: crystalY },
      { x: sx, y: crystalY + crystalH },
      { x: sx, y: crystalY + crystalH * 0.25 }
    ], primaryGlow, midCrystal, 1);

    // Bottom-right dark facet
    fillAndStrokePoly(ctx, [
      { x: sx, y: crystalY + crystalH * 0.25 },
      { x: sx, y: crystalY + crystalH },
      { x: sx + crystalW, y: crystalY }
    ], midCrystal, midCrystal, 1);
  } else {
    // Subtle pulsing energy core highlight over the 3D sprite crystal
    ctx.beginPath();
    ctx.arc(sx, crystalY, (6 + heatLevel * 2) * zoom, 0, Math.PI * 2);
    ctx.fillStyle = brightCore;
    ctx.shadowColor = primaryGlow;
    ctx.shadowBlur = (14 + heatLevel * 5) * zoom;
    ctx.fill();
  }

  // 6. Active Target Lock Warning Laser (when tower is targeting an enemy)
  if (structure.currentTarget && camera) {
    const tgt = structure.currentTarget;
    const isTgtAlive = typeof tgt.isAlive === 'function' ? tgt.isAlive() : tgt.hp > 0;
    if (isTgtAlive) {
      const tgtScreen = worldToScreen(tgt.x, tgt.y, (tgt.height || 30) * 0.5, camera, zoom);
      ctx.beginPath();
      ctx.moveTo(sx, crystalY);
      ctx.lineTo(tgtScreen.sx, tgtScreen.sy);
      ctx.strokeStyle = isAllied ? 'rgba(56, 189, 248, 0.45)' : 'rgba(239, 68, 68, 0.55)';
      ctx.lineWidth = (1.5 + heatLevel * 0.6) * zoom;
      ctx.stroke();
    }
  }

  // 7. Invulnerability 3D Dome Overlay
  if (isInvuln) {
    ctx.beginPath();
    ctx.ellipse(sx, sy - h * 0.45, r * 1.35, (r * 1.35) * 0.55, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(251, 191, 36, 0.14)';
    ctx.fill();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2 * zoom;
    ctx.stroke();
  }

  ctx.restore();
}
