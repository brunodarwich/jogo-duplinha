/**
 * Specification Reference Oracle: 2:1 Dimetric Isometric Projection & Depth Math
 * Source: PROJECT.md §1 & spec_miner_engine_r0/handoff.md §5.1
 */

export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;
export const DEFAULT_ZOOM = 1.0;

export function sanitize(val, fallback = 0) {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return val;
}

export function worldToScreen(wx, wy, wz = 0, camera = { x: 0, y: 0 }, zoom = 1.0, viewport = { width: 1280, height: 720 }) {
  const safeWx = sanitize(wx);
  const safeWy = sanitize(wy);
  const safeWz = sanitize(wz);
  const camX = sanitize(camera?.x, 0);
  const camY = sanitize(camera?.y, 0);
  const z = sanitize(zoom, 1.0);
  const vw = sanitize(viewport?.width, 1280);
  const vh = sanitize(viewport?.height, 720);

  const isoX = (safeWx - safeWy) * 0.5;
  const isoY = (safeWx + safeWy) * 0.25 - safeWz;

  const sx = (isoX - camX) * z + vw / 2;
  const sy = (isoY - camY) * z + vh / 2;

  return { sx, sy };
}

export function screenToWorld(sx, sy, camera = { x: 0, y: 0 }, zoom = 1.0, viewport = { width: 1280, height: 720 }) {
  const safeSx = sanitize(sx);
  const safeSy = sanitize(sy);
  const camX = sanitize(camera?.x, 0);
  const camY = sanitize(camera?.y, 0);
  const z = sanitize(zoom, 1.0) || 1.0;
  const vw = sanitize(viewport?.width, 1280);
  const vh = sanitize(viewport?.height, 720);

  const xp = (safeSx - vw / 2) / z + camX;
  const yp = (safeSy - vh / 2) / z + camY;

  const wx = xp + 2 * yp;
  const wy = 2 * yp - xp;

  return { wx, wy };
}

export function getDepthKey(wx, wy) {
  return sanitize(wx) + sanitize(wy);
}
