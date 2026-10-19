/**
 * Input & Controls Architecture.
 * Handles mouse unprojection, smart move/attack dispatch, QWER targeting preview state machine,
 * cast confirm/cancel, and Stop command.
 *
 * Source: PROJECT.md §1 & explorer_m1_2/handoff.md
 */

import { screenToWorld, worldToScreen } from './isometric.js';

export const MAP_SIZE = 3200;

export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export const CommandType = Object.freeze({
  MOVE_TO: 'MOVE_TO',
  ATTACK_TARGET: 'ATTACK_TARGET',
  CAST_ABILITY: 'CAST_ABILITY',
  CAST_SKILL: 'CAST_SKILL',
  START_TARGETING: 'START_TARGETING',
  CANCEL_TARGETING: 'CANCEL_TARGETING',
  SELECT: 'SELECT',
  STOP: 'STOP',
  RECALL: 'RECALL',
  TOGGLE_SHOP: 'TOGGLE_SHOP',
  CENTER_CAMERA: 'CENTER_CAMERA',
  CYCLE_PERSPECTIVE: 'CYCLE_PERSPECTIVE',
  UPGRADE_ABILITY: 'UPGRADE_ABILITY'
});

export const IndicatorType = Object.freeze({
  DIRECTIONAL_LINE: 'DIRECTIONAL_LINE',
  GROUND_AOE: 'GROUND_AOE',
  TARGET_UNIT: 'TARGET_UNIT',
  SELF_AOE: 'SELF_AOE'
});

/**
 * Headless-compatible InputDispatcher for unit tests and simulation command generation.
 */
export class InputDispatcher {
  /**
   * @param {Object} [camera={ x: 0, y: 0 }]
   * @param {number} [zoom=1.0]
   * @param {Object} [viewport={ width: 1280, height: 720 }]
   */
  constructor(camera = { x: 0, y: 0 }, zoom = 1.0, viewport = { width: 1280, height: 720 }) {
    this.camera = camera;
    this.zoom = zoom;
    this.viewport = viewport;
    this.targetingSkill = null;
  }

  get effectiveZoom() {
    return this.camera?.zoom ?? this.zoom ?? 1.0;
  }

  handleMouseDown(button, screenX, screenY, hoveredEntity = null) {
    const vw = this.viewport?.width ?? 1280;
    const vh = this.viewport?.height ?? 720;
    const clampedSx = clamp(screenX, 0, vw);
    const clampedSy = clamp(screenY, 0, vh);

    const world = screenToWorld(clampedSx, clampedSy, this.camera, this.effectiveZoom, this.viewport);
    const wx = clamp(world.wx, 0, MAP_SIZE);
    const wy = clamp(world.wy, 0, MAP_SIZE);

    // Right-click (button 2)
    if (button === 2) {
      if (this.targetingSkill) {
        const cancelled = this.targetingSkill;
        this.targetingSkill = null;
        return { type: CommandType.CANCEL_TARGETING, skill: cancelled };
      }

      if (hoveredEntity && (hoveredEntity.team === 'enemy' || hoveredEntity.isEnemy || hoveredEntity.team === 'neutral')) {
        return {
          type: CommandType.ATTACK_TARGET,
          targetId: hoveredEntity.id,
          targetX: hoveredEntity.x,
          targetY: hoveredEntity.y,
          targetEntity: hoveredEntity
        };
      }

      return {
        type: CommandType.MOVE_TO,
        x: wx,
        y: wy
      };
    }

    // Left-click (button 0)
    if (button === 0) {
      if (this.targetingSkill) {
        const skill = this.targetingSkill;
        this.targetingSkill = null;
        return {
          type: CommandType.CAST_SKILL,
          skill,
          targetX: wx,
          targetY: wy,
          targetEntityId: hoveredEntity ? hoveredEntity.id : null
        };
      }
      return {
        type: CommandType.SELECT,
        targetEntityId: hoveredEntity ? hoveredEntity.id : null,
        x: wx,
        y: wy
      };
    }

    return null;
  }

  handleKeyDown(key, hero = null, screenXOrEntity = null, screenY = null, hoveredEntity = null) {
    let keyStr = '';
    let isCtrl = false;
    if (typeof key === 'string') {
      keyStr = key;
    } else if (key && typeof key === 'object') {
      keyStr = key.code || key.key || '';
      isCtrl = !!key.ctrlKey;
    }
    const upperKey = (keyStr || '').toUpperCase();
    const cleanSlot = upperKey.startsWith('KEY') ? upperKey.substring(3) : upperKey;

    if (isCtrl && ['Q', 'W', 'E', 'R'].includes(cleanSlot)) {
      return {
        type: CommandType.UPGRADE_ABILITY,
        slot: cleanSlot
      };
    }

    // Hotkeys Q, W, E, R
    if (['Q', 'W', 'E', 'R'].includes(upperKey)) {
      if (!hero) return null;
      const isDead = typeof hero.isDead === 'function' ? hero.isDead() : !!hero.isDead;
      const isAlive = typeof hero.isAlive === 'function'
        ? hero.isAlive()
        : (!isDead && (typeof hero.hp !== 'number' || hero.hp > 0));
      if (isDead || !isAlive) return { type: 'SKILL_ERROR', error: 'Hero is dead' };

      const skill = hero.skills ? hero.skills[upperKey] : (hero.abilities ? hero.abilities[upperKey] : null);
      if (!skill) return { type: 'SKILL_ERROR', error: 'Skill not found' };

      if (typeof hero.mana === 'number' && typeof skill.manaCost === 'number' && hero.mana < skill.manaCost) {
        return { type: 'SKILL_ERROR', error: 'Insufficient mana' };
      }
      if (typeof skill.cooldownRemaining === 'number' && skill.cooldownRemaining > 0) {
        return { type: 'SKILL_ERROR', error: 'Skill on cooldown' };
      }

      if (skill.targetType === 'self' || skill.targetType === 'instant' || skill.targetingType === 'INSTANT_SELF') {
        return {
          type: CommandType.CAST_SKILL,
          skill: upperKey,
          targetX: hero.x,
          targetY: hero.y,
          instant: true
        };
      }

      this.targetingSkill = upperKey;
      return {
        type: CommandType.START_TARGETING,
        skill: upperKey,
        targetType: skill.targetType || skill.targetingType,
        range: skill.range,
        radius: skill.radius
      };
    }

    // Attack-Move command 'A'
    if (upperKey === 'A' || upperKey === 'KEYA') {
      this.targetingSkill = null;

      if (hero) {
        const isDead = typeof hero.isDead === 'function' ? hero.isDead() : !!hero.isDead;
        const isAlive = typeof hero.isAlive === 'function'
          ? hero.isAlive()
          : (!isDead && (typeof hero.hp !== 'number' || hero.hp > 0));
        if (isDead || !isAlive) return null;
      }

      let ent = hoveredEntity;
      let sx = screenXOrEntity;
      let sy = screenY;

      // Polymorphic argument handling: if screenXOrEntity is an entity or options object
      if (sx && typeof sx === 'object') {
        if (sx.id || sx.team || sx.isEnemy) {
          ent = sx;
          sx = null;
          sy = null;
        } else {
          ent = sx.hoveredEntity || ent;
          sy = sx.screenY ?? sx.y ?? sy;
          sx = sx.screenX ?? sx.x ?? sx;
        }
      }

      // If targeting a hostile or neutral entity, attack it directly
      if (ent && (ent.team === 'enemy' || ent.isEnemy || ent.team === 'neutral')) {
        return {
          type: CommandType.ATTACK_TARGET,
          targetId: ent.id,
          targetX: ent.x,
          targetY: ent.y,
          targetEntity: ent
        };
      }

      // Otherwise attack-move towards ground coordinates
      let wx = 0;
      let wy = 0;
      if (typeof sx === 'number' && typeof sy === 'number') {
        const vw = this.viewport?.width ?? 1280;
        const vh = this.viewport?.height ?? 720;
        const clampedSx = clamp(sx, 0, vw);
        const clampedSy = clamp(sy, 0, vh);
        const world = screenToWorld(clampedSx, clampedSy, this.camera, this.effectiveZoom, this.viewport);
        wx = clamp(world.wx, 0, MAP_SIZE);
        wy = clamp(world.wy, 0, MAP_SIZE);
      } else if (hero && typeof hero.x === 'number' && typeof hero.y === 'number') {
        wx = hero.x;
        wy = hero.y;
      } else if (this.camera && typeof this.camera.x === 'number' && typeof this.camera.y === 'number') {
        wx = this.camera.x;
        wy = this.camera.y;
      }

      return {
        type: CommandType.ATTACK_TARGET,
        targetId: null,
        targetX: wx,
        targetY: wy,
        attackMove: true
      };
    }

    // Stop command
    if (upperKey === 'S' || upperKey === 'H' || upperKey === 'KEYS' || upperKey === 'KEYH') {
      this.targetingSkill = null;
      return { type: CommandType.STOP };
    }

    // Recall key 'B'
    if (upperKey === 'B' || upperKey === 'KEYB') {
      this.targetingSkill = null;
      return { type: CommandType.RECALL };
    }

    // Cycle Perspective command 'C' / 'V'
    if (upperKey === 'C' || upperKey === 'KEYC' || upperKey === 'V' || upperKey === 'KEYV') {
      const direction = (upperKey === 'V' || upperKey === 'KEYV') ? -1 : 1;
      return { type: CommandType.CYCLE_PERSPECTIVE, direction };
    }

    // Escape cancels targeting
    if (key === 'Escape' || upperKey === 'ESCAPE') {
      if (this.targetingSkill) {
        const cancelled = this.targetingSkill;
        this.targetingSkill = null;
        return { type: CommandType.CANCEL_TARGETING, skill: cancelled };
      }
    }

    return null;
  }
}

export const CURSOR_SVGS = {
  default: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M3 2l6 17 3-5 5 7 2-1-5-7 6-2L3 2z' fill='%23f59e0b' stroke='%230f172a' stroke-width='1.5' stroke-linejoin='round'/%3E%3C/svg%3E") 0 0, default`,
  attack: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'%3E%3Cpath d='M4 24l4-4 2 2-4 4H4v-2zm5-5l9-9 2 2-9 9-2-2zm10-10l2-2 1 1-1 3-2-2zm3-3l1.5-1.5c.8-.8 2-.8 2.8 0 .8.8.8 2 0 2.8L25 9l-3-3z' fill='%23ef4444' stroke='%23450a0a' stroke-width='1.2'/%3E%3Ccircle cx='8' cy='8' r='5' fill='none' stroke='%23ef4444' stroke-width='1.5' stroke-dasharray='3 2'/%3E%3C/svg%3E") 4 4, crosshair`,
  ally: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='8' fill='none' stroke='%2338bdf8' stroke-width='2'/%3E%3Cpath d='M12 6v12M6 12h12' stroke='%2338bdf8' stroke-width='2' stroke-linecap='round'/%3E%3Ccircle cx='12' cy='12' r='2' fill='%2338bdf8'/%3E%3C/svg%3E") 12 12, pointer`,
  shop: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='9' fill='%23fbbf24' stroke='%2378350f' stroke-width='1.5'/%3E%3Ctext x='12' y='16' font-size='12' font-weight='bold' text-anchor='middle' fill='%2378350f'%3E$%3C/text%3E%3C/svg%3E") 12 12, pointer`,
  target: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'%3E%3Ccircle cx='14' cy='14' r='10' fill='none' stroke='%2300e5ff' stroke-width='1.8'/%3E%3Ccircle cx='14' cy='14' r='3' fill='none' stroke='%2300e5ff' stroke-width='1.5'/%3E%3Cline x1='14' y1='2' x2='14' y2='9' stroke='%2300e5ff' stroke-width='2'/%3E%3Cline x1='14' y1='19' x2='14' y2='26' stroke='%2300e5ff' stroke-width='2'/%3E%3Cline x1='2' y1='14' x2='9' y2='14' stroke='%2300e5ff' stroke-width='2'/%3E%3Cline x1='19' y1='14' x2='26' y2='14' stroke='%2300e5ff' stroke-width='2'/%3E%3C/svg%3E") 14 14, crosshair`
};

/**
 * Interactive InputManager for browser Canvas & DOM integration.
 */
export class InputManager {
  /**
   * @param {HTMLCanvasElement} [canvas=null]
   * @param {Camera} [camera=null]
   * @param {Object} [options={}]
   */
  constructor(canvas = null, camera = null, options = {}) {
    this.canvas = canvas;
    this.camera = camera;
    this.options = options;

    this.dispatcher = new InputDispatcher(camera, camera?.zoom ?? 1.0, {
      width: camera?.viewportWidth ?? 1280,
      height: camera?.viewportHeight ?? 720
    });

    // Pointer state
    this.screenX = 0;
    this.screenY = 0;
    this.worldX = 0;
    this.worldY = 0;
    this.isLeftDown = false;
    this.isRightDown = false;

    // Hovered target
    this.hoveredEntity = null;
    this.playerHeroRef = null;

    // Targeting state machine
    this.targetingState = null; // { slot: 'Q'|'W'|'E'|'R', ability: Object, indicator: Object }

    // Adaptive cursor state
    this.currentCursorType = 'default';

    // Skill error callback
    this.onSkillError = null;

    // Command listener callback
    this.commandDispatcher = null;

    // Bound event handlers
    this._onPointerDown = this.handlePointerDown.bind(this);
    this._onPointerMove = this.handlePointerMove.bind(this);
    this._onPointerUp = this.handlePointerUp.bind(this);
    this._onContextMenu = this.handleContextMenu.bind(this);
    this._onKeyDown = this.handleKeyDown.bind(this);
    this._onKeyUp = this.handleKeyUp.bind(this);
    this._onWheel = this.handleWheel.bind(this);

    // Right-click drag throttle
    this.lastRightDragTime = 0;
    this.dragThrottleMs = 80;
    this.isAttackingTargetDown = false;
  }

  get targetingSkill() {
    return this.targetingState ? this.targetingState.slot : this.dispatcher.targetingSkill;
  }

  set targetingSkill(slot) {
    this.dispatcher.targetingSkill = slot;
    if (!slot) {
      this.targetingState = null;
    }
  }

  bindEvents() {
    if (!this.canvas || typeof window === 'undefined') return;
    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    this.canvas.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
    this.canvas.addEventListener('contextmenu', this._onContextMenu);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    this.canvas.addEventListener('wheel', this._onWheel, { passive: false });
  }

  unbindEvents() {
    if (!this.canvas || typeof window === 'undefined') return;
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    this.canvas.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
    this.canvas.removeEventListener('contextmenu', this._onContextMenu);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this.canvas.removeEventListener('wheel', this._onWheel);
  }

  handleWheel(e) {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (!this.camera) return;

    // Negative deltaY means wheel up (zoom in), positive means wheel down (zoom out)
    const deltaY = e.deltaY || 0;
    const zoomStep = deltaY < 0 ? 0.1 : (deltaY > 0 ? -0.1 : 0);
    if (zoomStep !== 0) {
      if (typeof this.camera.zoomBy === 'function') {
        this.camera.zoomBy(zoomStep);
      } else if (typeof this.camera.zoom === 'number') {
        this.camera.zoom = Math.max(0.6, Math.min(1.6, this.camera.zoom + zoomStep));
      }

      if (typeof e.clientX === 'number' && typeof e.clientY === 'number') {
        this.updateCursor(e.clientX, e.clientY);
      } else {
        const world = screenToWorld(this.screenX, this.screenY, this.camera);
        this.worldX = clamp(world.wx, 0, MAP_SIZE);
        this.worldY = clamp(world.wy, 0, MAP_SIZE);
      }
    }
  }

  onCommand(dispatcher) {
    this.commandDispatcher = dispatcher;
  }

  dispatch(command) {
    if (this.commandDispatcher && command) {
      this.commandDispatcher(command);
    }
  }

  updateCursor(clientX, clientY) {
    if (!this.canvas) {
      this.screenX = clientX;
      this.screenY = clientY;
      const world = screenToWorld(this.screenX, this.screenY, this.camera);
      this.worldX = clamp(world.wx, 0, MAP_SIZE);
      this.worldY = clamp(world.wy, 0, MAP_SIZE);
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const vw = this.camera?.viewportWidth || this.canvas.width || 1280;
    const vh = this.camera?.viewportHeight || this.canvas.height || 720;

    const scaleX = rect.width > 0 ? vw / rect.width : 1;
    const scaleY = rect.height > 0 ? vh / rect.height : 1;

    this.screenX = clamp((clientX - rect.left) * scaleX, 0, vw);
    this.screenY = clamp((clientY - rect.top) * scaleY, 0, vh);

    const world = screenToWorld(this.screenX, this.screenY, this.camera);
    this.worldX = clamp(world.wx, 0, MAP_SIZE);
    this.worldY = clamp(world.wy, 0, MAP_SIZE);
  }

  update(dt, playerHero = null, entityManager = null) {
    if (playerHero) this.playerHeroRef = playerHero;
    if (entityManager) this.entityManager = entityManager;

    // Refresh world coordinates as camera moves
    const world = screenToWorld(this.screenX, this.screenY, this.camera);
    this.worldX = clamp(world.wx, 0, MAP_SIZE);
    this.worldY = clamp(world.wy, 0, MAP_SIZE);

    // Update hovered entity
    if (this.entityManager) {
      this.hoveredEntity = this.pickEntity(this.entityManager, this.playerHeroRef);
    }
    this.updateCanvasCursor();

    // Refresh active targeting indicator geometry and orient hero toward cursor
    if (this.targetingState && this.playerHeroRef) {
      this.updateTargetingIndicator(this.playerHeroRef);
      if (typeof this.playerHeroRef.targetFacing !== 'undefined') {
        this.playerHeroRef.targetFacing = Math.atan2(this.worldY - this.playerHeroRef.y, this.worldX - this.playerHeroRef.x);
      }
    }

    // Handle continuous right-click dragging (disabled while dead)
    const isHeroAlive = this.playerHeroRef && (typeof this.playerHeroRef.isAlive === 'function'
      ? this.playerHeroRef.isAlive()
      : (!this.playerHeroRef.isDead && (typeof this.playerHeroRef.hp !== 'number' || this.playerHeroRef.hp > 0)));

    if (this.isRightDown && !this.targetingState && isHeroAlive && typeof performance !== 'undefined') {
      const now = performance.now();
      if (now - this.lastRightDragTime >= this.dragThrottleMs) {
        this.lastRightDragTime = now;
        this.dispatchSmartRightClick(this.playerHeroRef);
      }
    }
  }

  isNearShopOrFountain(wx = this.worldX, wy = this.worldY) {
    const shopX = 400;
    const shopY = 400;
    const shopRadius = 280;
    return Math.hypot(wx - shopX, wy - shopY) <= shopRadius;
  }

  updateCanvasCursor() {
    let cursorType = 'default';

    if (this.targetingState) {
      cursorType = 'target';
    } else if (this.hoveredEntity && this.isHostile(this.hoveredEntity, this.playerHeroRef)) {
      cursorType = 'attack';
    } else if (this.hoveredEntity && !this.isHostile(this.hoveredEntity, this.playerHeroRef) && this.hoveredEntity !== this.playerHeroRef) {
      cursorType = 'ally';
    } else if (this.isNearShopOrFountain()) {
      cursorType = 'shop';
    } else {
      cursorType = 'default';
    }

    this.currentCursorType = cursorType;

    if (!this.canvas || !this.canvas.style) return;
    this.canvas.style.cursor = CURSOR_SVGS[cursorType] || 'default';
  }

  dispatchSmartRightClick(playerHero) {
    if (!playerHero) return;
    const isHeroAlive = typeof playerHero.isAlive === 'function'
      ? playerHero.isAlive()
      : (!playerHero.isDead && (typeof playerHero.hp !== 'number' || playerHero.hp > 0));
    if (!isHeroAlive) return;

    if (this.hoveredEntity && this.isHostile(this.hoveredEntity, playerHero)) {
      this.isAttackingTargetDown = true;
      this.dispatch({
        type: CommandType.ATTACK_TARGET,
        targetId: this.hoveredEntity.id,
        targetX: this.hoveredEntity.x,
        targetY: this.hoveredEntity.y,
        targetEntity: this.hoveredEntity
      });
    } else if (!this.isAttackingTargetDown) {
      this.dispatch({
        type: CommandType.MOVE_TO,
        x: this.worldX,
        y: this.worldY
      });
    }
  }

  pickEntity(entityManager, playerHero) {
    const entities = typeof entityManager?.getActiveEntities === 'function'
      ? entityManager.getActiveEntities()
      : (Array.isArray(entityManager) ? entityManager : (entityManager?.entities || []));

    let bestCandidate = null;
    let highestPriority = -1;
    let closestDistSq = Infinity;

    for (const ent of entities) {
      if (!ent) continue;
      const isDead = typeof ent.isDead === 'function' ? ent.isDead() : !!ent.isDead;
      if (isDead || (typeof ent.hp === 'number' && ent.hp <= 0)) continue;
      if (typeof ent.isUntargetable === 'function' && ent.isUntargetable()) continue;

      const groundDx = this.worldX - ent.x;
      const groundDy = this.worldY - ent.y;
      const groundDistSq = groundDx * groundDx + groundDy * groundDy;
      const hitRadius = ent.selectionRadius || ent.radius || 30;

      let isHit = false;
      let effectiveDistSq = groundDistSq;

      // 1. Direct ground coordinate distance with generous margin
      const generousGroundRadius = Math.max(36, hitRadius * 1.3);
      if (groundDistSq <= generousGroundRadius * generousGroundRadius) {
        isHit = true;
      }
      // 2. 2.5D screen-space bounds check when camera & screen coords are present
      else if (this.camera && typeof this.screenX === 'number' && typeof this.screenY === 'number') {
        const vp = {
          width: this.camera.viewportWidth || this.canvas?.width || 1280,
          height: this.camera.viewportHeight || this.canvas?.height || 720
        };
        const zoom = this.camera.zoom || 1.0;
        const { sx, sy } = worldToScreen(ent.x, ent.y, ent.z || 0, this.camera, zoom, vp);
        const entH = (ent.height || 36) * zoom;
        const screenHitR = Math.max(34, hitRadius * 1.15 * zoom);

        const horizontalDist = Math.abs(this.screenX - sx);
        const verticalOk = this.screenY >= (sy - entH - 32 * zoom) && this.screenY <= (sy + 20 * zoom);

        if (horizontalDist <= screenHitR && verticalOk) {
          isHit = true;
          const centerY = sy - entH * 0.5;
          effectiveDistSq = horizontalDist * horizontalDist + (this.screenY - centerY) * (this.screenY - centerY);
        }
      }

      if (isHit) {
        let priority = 1; // Default: Allied / friendly
        if (ent.team === 'neutral' || ent.type === 'neutral') {
          priority = 2; // Neutral creep or jungle monster
        } else if (this.isHostile(ent, playerHero)) {
          if (ent.type === 'hero') {
            priority = 5; // Hostile Hero (highest precedence)
          } else if (ent.type === 'minion') {
            priority = 4; // Hostile Lane Minion / Creep
          } else {
            priority = 3; // Hostile Tower, Boss, or Structure
          }
        }

        if (priority > highestPriority || (priority === highestPriority && effectiveDistSq < closestDistSq)) {
          highestPriority = priority;
          closestDistSq = effectiveDistSq;
          bestCandidate = ent;
        }
      }
    }

    return bestCandidate;
  }

  isHostile(target, playerHero) {
    if (!target) return false;
    if (target.team === 'enemy') return true;
    if (!playerHero) return false;
    return target.team !== playerHero.team;
  }

  handlePointerDown(e) {
    this.updateCursor(e.clientX, e.clientY);
    if (this.entityManager) {
      this.hoveredEntity = this.pickEntity(this.entityManager, this.playerHeroRef);
    }
    this.updateCanvasCursor();

    const hero = this.playerHeroRef;
    const isHeroAlive = hero && (typeof hero.isAlive === 'function'
      ? hero.isAlive()
      : (!hero.isDead && (typeof hero.hp !== 'number' || hero.hp > 0)));

    // Left Click (0)
    if (e.button === 0) {
      this.isLeftDown = true;
      if (this.targetingState) {
        if (!isHeroAlive) {
          this.cancelTargeting();
          return;
        }
        this.confirmCast();
        return;
      }
      // Left-clicking a hostile target immediately initiates attack!
      if (this.hoveredEntity && this.isHostile(this.hoveredEntity, this.playerHeroRef)) {
        if (!isHeroAlive) return;
        this.isAttackingTargetDown = true;
        this.dispatch({
          type: CommandType.ATTACK_TARGET,
          targetId: this.hoveredEntity.id,
          targetX: this.hoveredEntity.x,
          targetY: this.hoveredEntity.y,
          targetEntity: this.hoveredEntity
        });
        return;
      }

      // Tap-to-move for mobile touch:
      if (e.pointerType === 'touch') {
        if (!isHeroAlive) return;
        const world = screenToWorld(this.screenX, this.screenY, this.camera);
        this.dispatch({
          type: CommandType.MOVE_TO,
          x: world.wx,
          y: world.wy
        });
        return;
      }
    }

    // Right Click (2)
    if (e.button === 2) {
      this.isRightDown = true;
      if (this.targetingState) {
        this.cancelTargeting();
      }
      if (!isHeroAlive) return;
      this.lastRightDragTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (this.playerHeroRef) {
        this.dispatchSmartRightClick(this.playerHeroRef);
      }
    }
  }

  handlePointerMove(e) {
    this.updateCursor(e.clientX, e.clientY);
    if (this.entityManager) {
      this.hoveredEntity = this.pickEntity(this.entityManager, this.playerHeroRef);
    }
    this.updateCanvasCursor();
  }

  handlePointerUp(e) {
    if (e.button === 0) {
      this.isLeftDown = false;
      this.isAttackingTargetDown = false;
    }
    if (e.button === 2) {
      this.isRightDown = false;
      this.isAttackingTargetDown = false;
    }
  }

  handleContextMenu(e) {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
  }

  handleKeyDown(e) {
    // If typing in input element or chat bar, ignore MOBA hotkeys
    if (typeof document !== 'undefined' && document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
      if (e.key === 'Escape') {
        const chatInput = document.getElementById('chat-command-input');
        if (chatInput && document.activeElement === chatInput) {
          chatInput.value = '';
          chatInput.blur();
          document.getElementById('chat-command-bar')?.classList.add('hidden');
        }
      }
      return;
    }

    // Toggle Chat / Command Console on Enter or '/'
    if (e.key === 'Enter' || e.key === '/') {
      if (typeof document !== 'undefined') {
        const chatBar = document.getElementById('chat-command-bar');
        const chatInput = document.getElementById('chat-command-input');
        if (chatBar && chatInput) {
          chatBar.classList.remove('hidden');
          chatInput.focus();
          if (e.key === '/') {
            chatInput.value = '/';
            setTimeout(() => {
              chatInput.selectionStart = chatInput.selectionEnd = 1;
            }, 0);
          }
          if (typeof e.preventDefault === 'function') e.preventDefault();
          return;
        }
      }
    }

    if (e.key && e.key.length === 1) {
      this._recentKeys = ((this._recentKeys || '') + e.key.toLowerCase()).slice(-10);
      if (this._recentKeys.endsWith('/boost') || this._recentKeys.endsWith('boost')) {
        this.dispatch({ type: CommandType.STOP });
        this.dispatch({ type: 'BOOST' });
        this._recentKeys = '';
        return;
      }
      if (this._recentKeys.endsWith('/plan') || this._recentKeys.endsWith('plan')) {
        this.dispatch({ type: CommandType.STOP });
        this.dispatch({ type: 'PLAN' });
        this._recentKeys = '';
        return;
      }
    }

    const key = e.code || e.key;
    const hero = this.playerHeroRef;
    const isHeroAlive = hero && (typeof hero.isAlive === 'function'
      ? hero.isAlive()
      : (!hero.isDead && (typeof hero.hp !== 'number' || hero.hp > 0)));

    if (e.ctrlKey) {
      const k = (e.key || '').toUpperCase();
      const c = (e.code || '').toUpperCase();
      let slot = null;
      if (k === 'Q' || c === 'KEYQ') slot = 'Q';
      else if (k === 'W' || c === 'KEYW') slot = 'W';
      else if (k === 'E' || c === 'KEYE') slot = 'E';
      else if (k === 'R' || c === 'KEYR') slot = 'R';

      if (slot) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        this.dispatch({
          type: CommandType.UPGRADE_ABILITY,
          slot
        });
        return;
      }
    }

    if (key === 'KeyA' || key === 'a' || key === 'A') {
      if (this.playerHeroRef && isHeroAlive) {
        if (this.hoveredEntity && this.isHostile(this.hoveredEntity, this.playerHeroRef)) {
          this.dispatch({
            type: CommandType.ATTACK_TARGET,
            targetId: this.hoveredEntity.id,
            targetX: this.hoveredEntity.x,
            targetY: this.hoveredEntity.y,
            targetEntity: this.hoveredEntity
          });
        } else {
          this.dispatch({
            type: CommandType.ATTACK_TARGET,
            targetId: null,
            targetX: this.worldX,
            targetY: this.worldY,
            attackMove: true
          });
        }
      }
    }

    else if (key === 'KeyQ' || key === 'q' || key === 'Q') this.triggerAbility('Q');
    else if (key === 'KeyW' || key === 'w' || key === 'W') this.triggerAbility('W');
    else if (key === 'KeyE' || key === 'e' || key === 'E') this.triggerAbility('E');
    else if (key === 'KeyR' || key === 'r' || key === 'R') this.triggerAbility('R');

    else if (key === 'KeyS' || key === 's' || key === 'S' || key === 'KeyH' || key === 'h' || key === 'H') {
      this.cancelTargeting();
      if (!isHeroAlive) return;
      this.dispatch({ type: CommandType.STOP });
    }

    else if (key === 'KeyB' || key === 'b' || key === 'B') {
      this.cancelTargeting();
      if (!isHeroAlive) return;
      this.dispatch({ type: CommandType.RECALL });
    }

    else if (key === 'KeyP' || key === 'p' || key === 'P' || key === 'KeyI' || key === 'i' || key === 'I') {
      this.dispatch({ type: CommandType.TOGGLE_SHOP });
    }

    else if (key === 'Space' || key === ' ') {
      this.dispatch({ type: CommandType.CENTER_CAMERA });
    }

    else if (key === 'KeyC' || key === 'c' || key === 'C' || key === 'KeyV' || key === 'v' || key === 'V') {
      const direction = (key === 'KeyV' || key === 'v' || key === 'V') ? -1 : 1;
      this.dispatch({ type: CommandType.CYCLE_PERSPECTIVE, direction });
    }

    else if (key === 'Escape') {
      if (this.targetingState) {
        this.cancelTargeting();
      }
      if (typeof document !== 'undefined') {
        document.getElementById('battle-plan-modal')?.remove();
        const chatBar = document.getElementById('chat-command-bar');
        if (chatBar && !chatBar.classList.contains('hidden')) {
          chatBar.classList.add('hidden');
          document.getElementById('chat-command-input')?.blur();
        }
      }
      this.dispatch({ type: 'CLOSE_MODALS' });
    }
  }

  handleKeyUp(e) {}

  triggerAbility(slot) {
    const hero = this.playerHeroRef;
    if (!hero) return;
    const ability = hero.abilities ? hero.abilities[slot] : (hero.skills ? hero.skills[slot] : null);
    if (!ability) return;

    const isDead = typeof hero.isDead === 'function' ? hero.isDead() : !!hero.isDead;
    const isAlive = typeof hero.isAlive === 'function'
      ? hero.isAlive()
      : (!isDead && (typeof hero.hp !== 'number' || hero.hp > 0));
    if (isDead || !isAlive) return;
    if (typeof ability.cooldownRemaining === 'number' && ability.cooldownRemaining > 0) {
      this.onSkillError?.(slot, 'cooldown', ability.cooldownRemaining);
      return;
    }
    if (typeof hero.mana === 'number' && typeof ability.manaCost === 'number' && hero.mana < ability.manaCost) {
      this.onSkillError?.(slot, 'mana', ability.manaCost - hero.mana);
      return;
    }
    if (typeof hero.canCast === 'function' && !hero.canCast()) {
      this.onSkillError?.(slot, 'cc');
      return;
    }

    // Double-tap self cast check for ally/self abilities
    if (this.targetingState && this.targetingState.slot === slot) {
      if (ability.targetingType === IndicatorType.TARGET_UNIT && ability.canSelfCast) {
        this.dispatch({
          type: CommandType.CAST_ABILITY,
          slot: slot,
          targetX: hero.x,
          targetY: hero.y,
          targetId: hero.id
        });
        this.cancelTargeting();
        return;
      }
    }

    // Instant / Self spells without targeting
    if (ability.targetingType === 'INSTANT_SELF' || ability.targetType === 'self' || ability.targetType === 'instant') {
      this.dispatch({
        type: CommandType.CAST_ABILITY,
        slot: slot,
        targetX: hero.x,
        targetY: hero.y
      });
      return;
    }

    // Set targeting state
    this.targetingState = {
      slot: slot,
      ability: ability,
      indicator: null
    };
    this.dispatcher.targetingSkill = slot;
    this.updateTargetingIndicator(hero);
  }

  updateTargetingIndicator(hero) {
    if (!this.targetingState) return;
    const ability = this.targetingState.ability;
    const Hx = hero.x;
    const Hy = hero.y;
    const Wx = this.worldX;
    const Wy = this.worldY;
    const dx = Wx - Hx;
    const dy = Wy - Hy;
    const dist = Math.hypot(dx, dy);

    const type = ability.targetingType || ability.targetType || IndicatorType.GROUND_AOE;

    switch (type) {
      case IndicatorType.DIRECTIONAL_LINE:
      case 'skillshot':
      case 'linear': {
        const angle = Math.atan2(dy, dx);
        const range = ability.range || 500;
        this.targetingState.indicator = {
          type: IndicatorType.DIRECTIONAL_LINE,
          origin: { x: Hx, y: Hy },
          end: { x: Hx + range * Math.cos(angle), y: Hy + range * Math.sin(angle) },
          angle: angle,
          range: range,
          width: ability.hitboxWidth || ability.width || 40
        };
        break;
      }

      case IndicatorType.GROUND_AOE:
      case 'aoe':
      case 'ground': {
        const castRange = ability.range || 600;
        const aoeRadius = ability.radius || ability.aoeRadius || 150;
        let Tx = Wx;
        let Ty = Wy;
        let isClamped = false;

        if (dist > castRange) {
          isClamped = true;
          const factor = castRange / (dist || 1);
          Tx = Hx + dx * factor;
          Ty = Hy + dy * factor;
        }

        this.targetingState.indicator = {
          type: IndicatorType.GROUND_AOE,
          origin: { x: Hx, y: Hy },
          target: { x: Tx, y: Ty },
          castRange: castRange,
          aoeRadius: aoeRadius,
          isClamped: isClamped
        };
        break;
      }

      case IndicatorType.TARGET_UNIT:
      case 'unit':
      case 'target': {
        const castRange = ability.range || 500;
        const target = this.hoveredEntity;
        const isValid = target && Math.hypot(target.x - Hx, target.y - Hy) <= castRange;

        this.targetingState.indicator = {
          type: IndicatorType.TARGET_UNIT,
          origin: { x: Hx, y: Hy },
          range: castRange,
          targetEntity: target,
          isValidTarget: !!isValid
        };
        break;
      }

      case IndicatorType.SELF_AOE:
      default: {
        this.targetingState.indicator = {
          type: IndicatorType.SELF_AOE,
          origin: { x: Hx, y: Hy },
          radius: ability.radius || 250
        };
        break;
      }
    }
  }

  confirmCast() {
    if (!this.targetingState || !this.targetingState.indicator) return;
    const hero = this.playerHeroRef;
    if (hero) {
      const isDead = typeof hero.isDead === 'function' ? hero.isDead() : !!hero.isDead;
      const isAlive = typeof hero.isAlive === 'function'
        ? hero.isAlive()
        : (!isDead && (typeof hero.hp !== 'number' || hero.hp > 0));
      if (isDead || !isAlive) {
        this.cancelTargeting();
        return;
      }
    }
    const { slot, indicator } = this.targetingState;

    if (indicator.type === IndicatorType.TARGET_UNIT) {
      if (!indicator.isValidTarget || !indicator.targetEntity) {
        return;
      }
      this.dispatch({
        type: CommandType.CAST_ABILITY,
        slot: slot,
        targetX: indicator.targetEntity.x,
        targetY: indicator.targetEntity.y,
        targetId: indicator.targetEntity.id,
        targetEntity: indicator.targetEntity
      });
    } else if (indicator.type === IndicatorType.GROUND_AOE) {
      this.dispatch({
        type: CommandType.CAST_ABILITY,
        slot: slot,
        targetX: indicator.target.x,
        targetY: indicator.target.y
      });
    } else if (indicator.type === IndicatorType.DIRECTIONAL_LINE) {
      this.dispatch({
        type: CommandType.CAST_ABILITY,
        slot: slot,
        targetX: indicator.end.x,
        targetY: indicator.end.y,
        angle: indicator.angle
      });
    } else if (indicator.type === IndicatorType.SELF_AOE) {
      this.dispatch({
        type: CommandType.CAST_ABILITY,
        slot: slot,
        targetX: indicator.origin.x,
        targetY: indicator.origin.y
      });
    }

    this.targetingState = null;
    this.dispatcher.targetingSkill = null;
  }

  cancelTargeting() {
    const cancelled = this.targetingState ? this.targetingState.slot : this.dispatcher.targetingSkill;
    this.targetingState = null;
    this.dispatcher.targetingSkill = null;
    if (cancelled) {
      this.dispatch({ type: CommandType.CANCEL_TARGETING, skill: cancelled });
    }
  }

  getTargetingIndicator() {
    return this.targetingState ? this.targetingState.indicator : null;
  }

  setPlayerHero(hero) {
    this.playerHeroRef = hero;
  }
}
