/**
 * Map Geometry & World Systems Architecture.
 * Manages 3200x3200 world boundaries, 350-unit diagonal lane corridor,
 * lane waypoints, base fountains, rapid regeneration auras,
 * base shop proximity zone, and static colliders (structures & lane walls).
 *
 * Source: PROJECT.md §Feature 16-19 & spec_miner_engine_r0/handoff.md §5.3
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. Constants
// ─────────────────────────────────────────────────────────────────────────────

export const MAP_WIDTH = 3200;
export const MAP_HEIGHT = 3200;

export const MAP_BOUNDS = {
  minX: 0,
  minY: 0,
  maxX: 3200,
  maxY: 3200
};

export const LANE_WIDTH = 350;
export const HALF_LANE_WIDTH = 175; // 350 / 2

export const FOUNTAIN_RADIUS = 250.0;
export const SHOP_RADIUS = 250.0;

export const FOUNTAIN_HP_REGEN_RATE = 0.10;   // +10% Max HP / sec
export const FOUNTAIN_MANA_REGEN_RATE = 0.15; // +15% Max Mana / sec

export const TOWER_COLLIDER_RADIUS = 40;
export const NEXUS_COLLIDER_RADIUS = 70;

export const ALLIED_FOUNTAIN = {
  x: 400,
  y: 400,
  radius: FOUNTAIN_RADIUS,
  team: 'allied',
  name: 'Allied Fountain'
};

export const ENEMY_FOUNTAIN = {
  x: 2800,
  y: 2800,
  radius: FOUNTAIN_RADIUS,
  team: 'enemy',
  name: 'Enemy Fountain'
};

export const ALLIED_BASE_BOUNDS = {
  minX: 0,
  minY: 0,
  maxX: 700,
  maxY: 700
};

export const ENEMY_BASE_BOUNDS = {
  minX: 2500,
  minY: 2500,
  maxX: 3200,
  maxY: 3200
};

/**
 * Authoritative 7-step lane waypoints from Allied Nexus to Enemy Nexus.
 * Source: spec_miner_engine_r0/handoff.md §5.3
 */
export const LANE_WAYPOINTS = [
  { id: 'WP_0', x: 650, y: 650, name: 'Allied Nexus' },
  { id: 'WP_1', x: 950, y: 950, name: 'Allied Tier 2 Tower' },
  { id: 'WP_2', x: 1250, y: 1250, name: 'Allied Tier 1 Tower' },
  { id: 'WP_3', x: 1600, y: 1600, name: 'Center River / Battlefront' },
  { id: 'WP_4', x: 1950, y: 1950, name: 'Enemy Tier 1 Tower' },
  { id: 'WP_5', x: 2250, y: 2250, name: 'Enemy Tier 2 Tower' },
  { id: 'WP_6', x: 2550, y: 2550, name: 'Enemy Nexus' }
];

/**
 * Base-to-base waypoints starting at Allied Fountain and ending at Enemy Fountain.
 * Compatible with tests/oracles/world/minion.js and TC-MIN-03.
 */
export const LANE_WAYPOINTS_BASE = [
  { id: 'WP_BASE_0', x: 400, y: 400, name: 'Allied Base Fountain' },
  { id: 'WP_BASE_1', x: 800, y: 800, name: 'Allied Outer Yard' },
  { id: 'WP_BASE_2', x: 1200, y: 1200, name: 'Allied Forward Post' },
  { id: 'WP_BASE_3', x: 1600, y: 1600, name: 'Center River' },
  { id: 'WP_BASE_4', x: 2000, y: 2000, name: 'Enemy Forward Post' },
  { id: 'WP_BASE_5', x: 2400, y: 2400, name: 'Enemy Outer Yard' },
  { id: 'WP_BASE_6', x: 2800, y: 2800, name: 'Enemy Base Fountain' }
];

// Normal offset: 175 / sqrt(2) ≈ 123.7436867
const WALL_OFFSET = HALF_LANE_WIDTH * Math.SQRT1_2;

/**
 * Line segment boundaries for lane walls.
 * Segments confine lane push between Allied Base (700, 700) and Enemy Base (2500, 2500).
 */
export const LANE_WALL_SEGMENTS = [
  // Northwest Wall (Upper border of diagonal lane)
  {
    id: 'wall_nw',
    x1: 700 - WALL_OFFSET,
    y1: 700 + WALL_OFFSET,
    x2: 2500 - WALL_OFFSET,
    y2: 2500 + WALL_OFFSET
  },
  // Southeast Wall (Lower border of diagonal lane)
  {
    id: 'wall_se',
    x1: 700 + WALL_OFFSET,
    y1: 700 - WALL_OFFSET,
    x2: 2500 + WALL_OFFSET,
    y2: 2500 - WALL_OFFSET
  },
  // Allied Base NW Funnel
  {
    id: 'allied_funnel_nw',
    x1: 0,
    y1: 700,
    x2: 700 - WALL_OFFSET,
    y2: 700 + WALL_OFFSET
  },
  // Allied Base SE Funnel
  {
    id: 'allied_funnel_se',
    x1: 700,
    y1: 0,
    x2: 700 + WALL_OFFSET,
    y2: 700 - WALL_OFFSET
  },
  // Enemy Base NW Funnel
  {
    id: 'enemy_funnel_nw',
    x1: 2500 - WALL_OFFSET,
    y1: 2500 + WALL_OFFSET,
    x2: 2500,
    y2: 3200
  },
  // Enemy Base SE Funnel
  {
    id: 'enemy_funnel_se',
    x1: 2500 + WALL_OFFSET,
    y1: 2500 - WALL_OFFSET,
    x2: 3200,
    y2: 2500
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// 2. Pure Geometric Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculates perpendicular Euclidean distance from (x, y) to diagonal line y = x.
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export function distanceToLane(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return Infinity;
  return Math.abs(x - y) * Math.SQRT1_2;
}

/**
 * Checks whether (x, y) lies inside the 350-unit lane corridor.
 * @param {number} x
 * @param {number} y
 * @param {number} [halfWidth=HALF_LANE_WIDTH]
 * @returns {boolean}
 */
export function isInsideLane(x, y, halfWidth = HALF_LANE_WIDTH) {
  return distanceToLane(x, y) <= halfWidth;
}

/**
 * Checks if (x, y) is inside the Allied Base enclosure.
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function isInsideAlliedBase(x, y) {
  return x >= ALLIED_BASE_BOUNDS.minX && x <= ALLIED_BASE_BOUNDS.maxX &&
         y >= ALLIED_BASE_BOUNDS.minY && y <= ALLIED_BASE_BOUNDS.maxY;
}

/**
 * Checks if (x, y) is inside the Enemy Base enclosure.
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function isInsideEnemyBase(x, y) {
  return x >= ENEMY_BASE_BOUNDS.minX && x <= ENEMY_BASE_BOUNDS.maxX &&
         y >= ENEMY_BASE_BOUNDS.minY && y <= ENEMY_BASE_BOUNDS.maxY;
}

/**
 * Checks if (x, y) is inside Allied Base Fountain (R=250 at 400, 400).
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function isInsideAlliedFountain(x, y) {
  return Math.hypot(x - ALLIED_FOUNTAIN.x, y - ALLIED_FOUNTAIN.y) <= FOUNTAIN_RADIUS;
}

/**
 * Checks if (x, y) is inside Enemy Base Fountain (R=250 at 2800, 2800).
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function isInsideEnemyFountain(x, y) {
  return Math.hypot(x - ENEMY_FOUNTAIN.x, y - ENEMY_FOUNTAIN.y) <= FOUNTAIN_RADIUS;
}

/**
 * Validates whether an entity is inside the base shop proximity zone (R=250 at 400, 400).
 * Strictly enforces boundary <= 250.0 units.
 * @param {Object} entity - Entity with { x, y }
 * @returns {boolean}
 */
export function isInsideShopZone(entity) {
  if (!entity || !Number.isFinite(entity.x) || !Number.isFinite(entity.y)) return false;
  const dist = Math.hypot(entity.x - ALLIED_FOUNTAIN.x, entity.y - ALLIED_FOUNTAIN.y);
  return dist <= SHOP_RADIUS;
}

/**
 * Determines terrain tile category at (wx, wy).
 * @param {number} wx
 * @param {number} wy
 * @returns {'allied_base' | 'enemy_base' | 'lane' | 'river' | 'jungle'}
 */
export function getTileType(wx, wy) {
  if (isInsideAlliedBase(wx, wy)) return 'allied_base';
  if (isInsideEnemyBase(wx, wy)) return 'enemy_base';

  // Center river: perpendicular band along x + y = 3200
  const riverDist = Math.abs((wx + wy) - 3200) * Math.SQRT1_2;
  if (riverDist <= 60 && isInsideLane(wx, wy, 250)) return 'river';

  if (isInsideLane(wx, wy, HALF_LANE_WIDTH)) return 'lane';
  return 'jungle';
}

/**
 * Returns canvas color palette for tile rendering.
 * @param {string} tileType
 * @returns {{ fillStyle: string, strokeStyle: string }}
 */
export function getTileColors(tileType) {
  switch (tileType) {
    case 'lane':
      return { fillStyle: '#2d2b27', strokeStyle: '#252320' };
    case 'allied_base':
      return { fillStyle: '#1e293b', strokeStyle: '#334155' };
    case 'enemy_base':
      return { fillStyle: '#2d1b22', strokeStyle: '#451a24' };
    case 'river':
      return { fillStyle: '#172554', strokeStyle: '#1e3a8a' };
    case 'jungle':
    default:
      return { fillStyle: '#1b281d', strokeStyle: '#152017' };
  }
}

/**
 * Clamps coordinates strictly within map boundaries taking entity radius into account.
 * @param {number} x
 * @param {number} y
 * @param {number} [radius=0]
 * @returns {{ x: number, y: number }}
 */
export function clampToBounds(x, y, radius = 0) {
  const safeX = Number.isFinite(x) ? x : MAP_WIDTH / 2;
  const safeY = Number.isFinite(y) ? y : MAP_HEIGHT / 2;
  const r = Math.max(0, radius);
  return {
    x: Math.max(r, Math.min(MAP_WIDTH - r, safeX)),
    y: Math.max(r, Math.min(MAP_HEIGHT - r, safeY))
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Collision Math Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes closest point on line segment (x1, y1) -> (x2, y2) to point (px, py).
 * @param {number} px
 * @param {number} py
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @returns {{ x: number, y: number, dist: number, t: number }}
 */
export function closestPointOnSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  if (lenSq < 1e-8) {
    const dist = Math.hypot(px - x1, py - y1);
    return { x: x1, y: y1, dist, t: 0 };
  }

  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const qx = x1 + t * dx;
  const qy = y1 + t * dy;
  const dist = Math.hypot(px - qx, py - qy);

  return { x: qx, y: qy, dist, t };
}

/**
 * Resolves circle-to-circle collision between dynamic entity and static structure.
 * @param {number} px - Entity X
 * @param {number} py - Entity Y
 * @param {number} radius - Entity Radius
 * @param {number} cx - Structure Center X
 * @param {number} cy - Structure Center Y
 * @param {number} cRadius - Structure Collider Radius
 * @returns {{ collided: boolean, nx: number, ny: number, penetration: number, newX: number, newY: number }}
 */
export function resolveCircleCollision(px, py, radius, cx, cy, cRadius) {
  const dx = px - cx;
  const dy = py - cy;
  const distSq = dx * dx + dy * dy;
  const minDist = radius + cRadius;

  if (distSq >= minDist * minDist) {
    return { collided: false, nx: 0, ny: 0, penetration: 0, newX: px, newY: py };
  }

  const dist = Math.sqrt(distSq);
  let nx = 1;
  let ny = 0;
  if (dist > 1e-6) {
    nx = dx / dist;
    ny = dy / dist;
  }

  const penetration = minDist - dist;
  return {
    collided: true,
    nx,
    ny,
    penetration,
    newX: cx + nx * minDist,
    newY: cy + ny * minDist
  };
}

/**
 * Resolves collision between dynamic entity and line segment wall.
 * @param {number} px - Entity X
 * @param {number} py - Entity Y
 * @param {number} radius - Entity Radius
 * @param {Object} seg - Segment { x1, y1, x2, y2 }
 * @returns {{ collided: boolean, nx: number, ny: number, penetration: number, newX: number, newY: number }}
 */
export function resolveSegmentCollision(px, py, radius, seg) {
  const closest = closestPointOnSegment(px, py, seg.x1, seg.y1, seg.x2, seg.y2);
  if (closest.dist >= radius) {
    return { collided: false, nx: 0, ny: 0, penetration: 0, newX: px, newY: py };
  }

  const dx = px - closest.x;
  const dy = py - closest.y;
  let nx = 0;
  let ny = 0;

  if (closest.dist > 1e-6) {
    nx = dx / closest.dist;
    ny = dy / closest.dist;
  } else {
    // Entity on segment: pick perpendicular normal
    const segDx = seg.x2 - seg.x1;
    const segDy = seg.y2 - seg.y1;
    const segLen = Math.hypot(segDx, segDy);
    if (segLen > 1e-6) {
      nx = -segDy / segLen;
      ny = segDx / segLen;
    } else {
      nx = 1;
      ny = 0;
    }
  }

  const penetration = radius - closest.dist;
  return {
    collided: true,
    nx,
    ny,
    penetration,
    newX: closest.x + nx * radius,
    newY: closest.y + ny * radius
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. GameMap Class Coordinator
// ─────────────────────────────────────────────────────────────────────────────

export class GameMap {
  /**
   * @param {Object} [options={}]
   */
  constructor(options = {}) {
    this.width = options.width || MAP_WIDTH;
    this.height = options.height || MAP_HEIGHT;
    this.bounds = { minX: 0, minY: 0, maxX: this.width, maxY: this.height };

    this.fountains = {
      allied: { ...ALLIED_FOUNTAIN },
      enemy: { ...ENEMY_FOUNTAIN }
    };

    this.waypoints = [...LANE_WAYPOINTS];
    this.baseWaypoints = [...LANE_WAYPOINTS_BASE];
    this.walls = [...LANE_WALL_SEGMENTS];

    // Dynamic registry of structure colliders: Map<id, { id, x, y, radius, team, type, active }>
    this.structures = new Map();

    // Regen rates
    this.hpRegenRate = options.hpRegenRate ?? FOUNTAIN_HP_REGEN_RATE;
    this.manaRegenRate = options.manaRegenRate ?? FOUNTAIN_MANA_REGEN_RATE;
  }

  /**
   * Registers a structure collider (tower or nexus).
   * @param {string} id
   * @param {number} x
   * @param {number} y
   * @param {number} [radius]
   * @param {string} [team='allied']
   * @param {string} [type='tower']
   */
  registerStructure(id, x, y, radius, team = 'allied', type = 'tower') {
    this.structures.set(id, {
      id,
      x,
      y,
      radius: radius ?? (type === 'nexus' ? NEXUS_COLLIDER_RADIUS : TOWER_COLLIDER_RADIUS),
      team,
      type,
      active: true
    });
  }

  /**
   * Removes or deactivates a fallen structure's collision mesh.
   * @param {string} id
   */
  unregisterStructure(id) {
    this.structures.delete(id);
  }

  /**
   * Syncs active structure colliders from the current game state entity list.
   * @param {Array<Object>} entities
   */
  syncStructuresFromEntities(entities = []) {
    this.structures.clear();
    for (const ent of entities) {
      if (ent.type === 'tower' || ent.type === 'nexus') {
        const isDead = typeof ent.isDead === 'function' ? ent.isDead() : !!ent.isDead;
        if (!isDead && (typeof ent.hp !== 'number' || ent.hp > 0)) {
          const colRadius = ent.radius || (ent.type === 'nexus' ? NEXUS_COLLIDER_RADIUS : TOWER_COLLIDER_RADIUS);
          this.registerStructure(ent.id, ent.x, ent.y, colRadius, ent.team, ent.type);
        }
      }
    }
  }

  /**
   * Evaluates if a given world coordinate is walkable.
   * @param {number} x
   * @param {number} y
   * @param {number} [radius=0]
   * @returns {boolean}
   */
  isWalkable(x, y, radius = 0) {
    // 1. Map bounds
    if (x - radius < 0 || x + radius > this.width || y - radius < 0 || y + radius > this.height) {
      return false;
    }

    // 2. Structure colliders
    for (const struct of this.structures.values()) {
      if (!struct.active) continue;
      const dist = Math.hypot(x - struct.x, y - struct.y);
      if (dist < (struct.radius + radius)) {
        return false;
      }
    }

    // 3. Lane / Base walkability
    if (isInsideAlliedBase(x, y) || isInsideEnemyBase(x, y)) return true;
    if (isInsideLane(x, y, HALF_LANE_WIDTH)) return true;

    return false;
  }

  /**
   * Projects an impassable destination (e.g. inside a tower collider) to the nearest walkable point.
   * @param {number} tx
   * @param {number} ty
   * @param {number} [radius=22]
   * @returns {{ x: number, y: number }}
   */
  findNearestWalkable(tx, ty, radius = 22) {
    let bestX = tx;
    let bestY = ty;

    // Check structure overlaps
    for (const struct of this.structures.values()) {
      if (!struct.active) continue;
      const dx = bestX - struct.x;
      const dy = bestY - struct.y;
      const dist = Math.hypot(dx, dy);
      const minDist = struct.radius + radius + 4; // Margin

      if (dist < minDist) {
        let nx = 1;
        let ny = 0;
        if (dist > 1e-6) {
          nx = dx / dist;
          ny = dy / dist;
        }
        bestX = struct.x + nx * minDist;
        bestY = struct.y + ny * minDist;
      }
    }

    return clampToBounds(bestX, bestY, radius);
  }

  /**
   * Resolves collision for a moving entity with map boundaries, structures, and lane walls.
   * Implements tangential sliding vector resolution.
   * @param {Object} entity - Dynamic entity with { x, y, vx, vy, radius }
   */
  resolveEntityCollision(entity) {
    if (!entity) return;
    const isDead = typeof entity.isDead === 'function' ? entity.isDead() : !!entity.isDead;
    if (isDead || (typeof entity.hp === 'number' && entity.hp <= 0)) return;

    const r = entity.radius || 20;

    // Multi-pass relaxation (up to 3 iterations for corners / multiple colliders)
    for (let iter = 0; iter < 3; iter++) {
      let collidedAny = false;

      // 1. Structure circular colliders
      for (const struct of this.structures.values()) {
        if (!struct.active || struct.id === entity.id) continue;
        const res = resolveCircleCollision(entity.x, entity.y, r, struct.x, struct.y, struct.radius);
        if (res.collided) {
          entity.x = res.newX;
          entity.y = res.newY;
          // Tangential sliding
          if (Number.isFinite(entity.vx) && Number.isFinite(entity.vy)) {
            const vn = entity.vx * res.nx + entity.vy * res.ny;
            if (vn < 0) {
              entity.vx -= vn * res.nx;
              entity.vy -= vn * res.ny;
            }
          }
          collidedAny = true;
        }
      }

      // 2. Lane wall line segments
      for (const wall of this.walls) {
        const res = resolveSegmentCollision(entity.x, entity.y, r, wall);
        if (res.collided) {
          entity.x = res.newX;
          entity.y = res.newY;
          // Tangential sliding
          if (Number.isFinite(entity.vx) && Number.isFinite(entity.vy)) {
            const vn = entity.vx * res.nx + entity.vy * res.ny;
            if (vn < 0) {
              entity.vx -= vn * res.nx;
              entity.vy -= vn * res.ny;
            }
          }
          collidedAny = true;
        }
      }

      // 3. Map outer boundary clamping
      const clamped = clampToBounds(entity.x, entity.y, r);
      if (clamped.x !== entity.x) {
        entity.x = clamped.x;
        if (Number.isFinite(entity.vx)) entity.vx = 0;
        collidedAny = true;
      }
      if (clamped.y !== entity.y) {
        entity.y = clamped.y;
        if (Number.isFinite(entity.vy)) entity.vy = 0;
        collidedAny = true;
      }

      if (!collidedAny) break;
    }
  }

  /**
   * Applies base fountain rapid regeneration to entities in their team's fountain.
   * @param {Array<Object>} entities
   * @param {number} dt - Timestep in seconds
   * @returns {number} Count of entities regenerated
   */
  applyFountainRegen(entities = [], dt = 0.01667) {
    if (!Number.isFinite(dt) || dt <= 0) return 0;
    let count = 0;

    for (const ent of entities) {
      if (!ent) continue;
      const isDead = typeof ent.isDead === 'function' ? ent.isDead() : !!ent.isDead;
      if (isDead || (typeof ent.hp === 'number' && ent.hp <= 0)) continue;

      const isAllied = ent.team === 'allied';
      const isEnemy = ent.team === 'enemy';

      let inFountain = false;
      if (isAllied && isInsideAlliedFountain(ent.x, ent.y)) inFountain = true;
      else if (isEnemy && isInsideEnemyFountain(ent.x, ent.y)) inFountain = true;

      if (inFountain) {
        const maxHp = ent.maxHp || 1000;
        const maxMana = ent.maxMana || 500;

        // +10% Max HP/s
        if (ent.hp < maxHp) {
          ent.hp = Math.min(maxHp, ent.hp + maxHp * this.hpRegenRate * dt);
        }

        // +15% Max Mana/s
        if (typeof ent.mana === 'number' && ent.mana < maxMana) {
          ent.mana = Math.min(maxMana, ent.mana + maxMana * this.manaRegenRate * dt);
        }

        count++;
      }
    }

    return count;
  }

  /**
   * Main per-tick update for map world systems.
   * @param {number} dt
   * @param {Array<Object>} entities
   */
  update(dt, entities = []) {
    this.syncStructuresFromEntities(entities);

    for (const ent of entities) {
      if (ent.type === 'hero' || ent.type === 'minion') {
        this.resolveEntityCollision(ent);
      }
    }

    this.applyFountainRegen(entities, dt);
  }

  /**
   * Renders static minimap background decals on a 200x200 minimap canvas.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} [size=200]
   */
  renderMinimapBackground(ctx, size = 200) {
    if (!ctx) return;
    const scale = size / this.width;

    ctx.clearRect(0, 0, size, size);

    // 1. Dark terrain base
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, size, size);

    // 2. Lane corridor
    ctx.save();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = LANE_WIDTH * scale;
    ctx.beginPath();
    ctx.moveTo(400 * scale, 400 * scale);
    ctx.lineTo(2800 * scale, 2800 * scale);
    ctx.stroke();

    // 3. Center River
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(115, 85);
    ctx.lineTo(85, 115);
    ctx.stroke();

    // 4. Allied Base & Fountain
    ctx.fillStyle = 'rgba(59, 130, 246, 0.35)';
    ctx.beginPath();
    ctx.arc(400 * scale, 400 * scale, FOUNTAIN_RADIUS * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 5. Enemy Base & Fountain
    ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
    ctx.beginPath();
    ctx.arc(2800 * scale, 2800 * scale, FOUNTAIN_RADIUS * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }
}
