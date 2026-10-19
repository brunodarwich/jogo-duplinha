/**
 * 2:1 Dimetric Isometric Projection & Coordinate Transformation Engine.
 * Tile Width: 64px, Tile Height: 32px (2:1 dimetric ratio).
 *
 * Source: PROJECT.md §1 & spec_miner_engine_r0/handoff.md §5.1
 */

export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;
export const HALF_TILE_WIDTH = 32;
export const HALF_TILE_HEIGHT = 16;
export const DEFAULT_ZOOM = 1.0;

/**
 * Validates and sanitizes a coordinate value.
 * @param {number} val 
 * @param {number} fallback 
 * @returns {number}
 */
export function sanitize(val, fallback = 0) {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return val;
}

/**
 * Converts 3D continuous world coordinates (wx, wy, wz) to 2D canvas screen coordinates (sx, sy).
 * 
 * Supports both camera instance/object and optional viewport parameter.
 * 
 * @param {number} wx - World X coordinate
 * @param {number} wy - World Y coordinate
 * @param {number} [wz=0] - World Z coordinate (elevation above ground)
 * @param {Object} [camera=null] - Camera object containing { x, y, width, height, zoom, viewportWidth, viewportHeight }
 * @param {number} [zoom=1.0] - Zoom multiplier override
 * @param {Object|number} [viewportOrTileWidth=null] - Viewport object { width, height } OR custom tile width
 * @param {number} [tileHeight=TILE_HEIGHT] - Custom tile height
 * @returns {{ sx: number, sy: number }}
 */
export function worldToScreen(
  wx,
  wy,
  wz = 0,
  camera = null,
  zoom = null,
  viewportOrTileWidth = null,
  tileHeight = TILE_HEIGHT
) {
  const safeWx = sanitize(wx, 0);
  const safeWy = sanitize(wy, 0);
  const safeWz = sanitize(wz, 0);

  const customTw = typeof viewportOrTileWidth === 'number' ? viewportOrTileWidth : TILE_WIDTH;
  const customTh = typeof tileHeight === 'number' ? tileHeight : TILE_HEIGHT;
  const halfTw = customTw / 2;
  const halfTh = customTh / 2;

  // Camera focal coordinates (world space)
  const camWx = sanitize(camera?.worldX ?? (camera?.x !== undefined && camera?.y !== undefined ? camera.x + 2 * camera.y : 0), 0);
  const camWy = sanitize(camera?.worldY ?? (camera?.x !== undefined && camera?.y !== undefined ? 2 * camera.y - camera.x : 0), 0);

  // Viewport dimensions resolution
  const vpObj = (typeof viewportOrTileWidth === 'object' && viewportOrTileWidth !== null) ? viewportOrTileWidth : null;
  const vw = sanitize(vpObj?.width ?? camera?.viewportWidth ?? camera?.width, 1280);
  const vh = sanitize(vpObj?.height ?? camera?.viewportHeight ?? camera?.height, 720);

  // Zoom resolution
  const effectiveZoom = sanitize(zoom ?? camera?.zoom, 1.0);
  const s = effectiveZoom > 0 ? effectiveZoom : 1.0;

  // Camera perspective rotation angle
  const theta = sanitize(camera?.rotation ?? camera?.angle ?? 0, 0);

  const dx = safeWx - camWx;
  const dy = safeWy - camWy;

  let rx = dx;
  let ry = dy;
  if (theta !== 0) {
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    rx = dx * cosT - dy * sinT;
    ry = dx * sinT + dy * cosT;
  }

  // 2:1 Dimetric Isometric Projection (Normalized by tile dimensions 64x32)
  const isoX = (rx - ry) * 0.5;
  const isoY = (rx + ry) * 0.25 - safeWz;

  const sx = isoX * s + vw / 2;
  const sy = isoY * s + vh / 2;

  return { sx, sy };
}

/**
 * Inverts 2D canvas screen coordinates (sx, sy) to continuous ground world coordinates (wx, wy) where wz = 0.
 * 
 * @param {number} sx - Screen pixel X
 * @param {number} sy - Screen pixel Y
 * @param {Object} [camera=null] - Camera object containing { x, y, width, height, zoom, viewportWidth, viewportHeight, rotation }
 * @param {number|null} [zoom=null] - Zoom multiplier override
 * @param {Object|number} [viewportOrTileWidth=null] - Viewport object { width, height } OR custom tile width
 * @param {number} [tileHeight=TILE_HEIGHT] - Custom tile height
 * @returns {{ wx: number, wy: number }}
 */
export function screenToWorld(
  sx,
  sy,
  camera = null,
  zoom = null,
  viewportOrTileWidth = null,
  tileHeight = TILE_HEIGHT
) {
  const safeSx = sanitize(sx, 0);
  const safeSy = sanitize(sy, 0);

  const customTw = typeof viewportOrTileWidth === 'number' ? viewportOrTileWidth : TILE_WIDTH;
  const customTh = typeof tileHeight === 'number' ? tileHeight : TILE_HEIGHT;
  const halfTw = customTw / 2;
  const halfTh = customTh / 2;

  const camWx = sanitize(camera?.worldX ?? (camera?.x !== undefined && camera?.y !== undefined ? camera.x + 2 * camera.y : 0), 0);
  const camWy = sanitize(camera?.worldY ?? (camera?.x !== undefined && camera?.y !== undefined ? 2 * camera.y - camera.x : 0), 0);

  const vpObj = (typeof viewportOrTileWidth === 'object' && viewportOrTileWidth !== null) ? viewportOrTileWidth : null;
  const vw = sanitize(vpObj?.width ?? camera?.viewportWidth ?? camera?.width, 1280);
  const vh = sanitize(vpObj?.height ?? camera?.viewportHeight ?? camera?.height, 720);

  const effectiveZoom = sanitize(zoom ?? camera?.zoom, 1.0);
  const s = effectiveZoom > 0 ? effectiveZoom : 1.0;

  // Unproject from screen pixels to camera-relative projected space
  const xp = (safeSx - vw / 2) / s;
  const yp = (safeSy - vh / 2) / s;

  // Invert 2x2 dimetric system for ground plane (wz = 0, normalized by tile dimensions 64x32)
  const rx = xp + 2 * yp;
  const ry = 2 * yp - xp;

  // Camera perspective rotation angle (invert by -theta)
  const theta = sanitize(camera?.rotation ?? camera?.angle ?? 0, 0);
  let dx = rx;
  let dy = ry;
  if (theta !== 0) {
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    dx = rx * cosT + ry * sinT;
    dy = -rx * sinT + ry * cosT;
  }

  const wx = camWx + dx;
  const wy = camWy + dy;

  return { wx, wy };
}

/**
 * Calculates the depth key for painter's algorithm rendering.
 * @param {number} wx 
 * @param {number} wy 
 * @param {Object} [camera=null]
 * @returns {number}
 */
export function getDepthKey(wx, wy, camera = null) {
  const safeWx = sanitize(wx, 0);
  const safeWy = sanitize(wy, 0);
  const theta = sanitize(camera?.rotation ?? camera?.angle ?? 0, 0);
  if (theta !== 0) {
    const camWx = sanitize(camera?.worldX ?? (camera?.x !== undefined && camera?.y !== undefined ? camera.x + 2 * camera.y : 0), 0);
    const camWy = sanitize(camera?.worldY ?? (camera?.x !== undefined && camera?.y !== undefined ? 2 * camera.y - camera.x : 0), 0);
    const dx = safeWx - camWx;
    const dy = safeWy - camWy;
    const rx = dx * Math.cos(theta) - dy * Math.sin(theta);
    const ry = dx * Math.sin(theta) + dy * Math.cos(theta);
    return rx + ry;
  }
  return safeWx + safeWy;
}

/**
 * Stable depth comparator for sorting dynamic entities.
 * Ties are broken using unique entity ID to eliminate z-fighting.
 * 
 * @param {Object} a - Entity A
 * @param {Object} b - Entity B
 * @param {Object} [camera=null]
 * @returns {number}
 */
export function compareDepth(a, b, camera = null) {
  const cam = camera ?? a?.camera ?? b?.camera ?? null;
  const depthA = typeof a.getDepthKey === 'function' ? a.getDepthKey(cam) : getDepthKey(a.x, a.y, cam);
  const depthB = typeof b.getDepthKey === 'function' ? b.getDepthKey(cam) : getDepthKey(b.x, b.y, cam);

  if (Math.abs(depthA - depthB) > 1e-4) {
    return depthA - depthB;
  }

  // Stable tie-breaker by entity id
  const idA = String(a.id ?? '');
  const idB = String(b.id ?? '');
  return idA.localeCompare(idB);
}

/**
 * Euclidean distance helper between two points in continuous world space.
 * @param {number} x1 
 * @param {number} y1 
 * @param {number} x2 
 * @param {number} y2 
 * @returns {number}
 */
export function worldDistance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.hypot(dx, dy);
}
