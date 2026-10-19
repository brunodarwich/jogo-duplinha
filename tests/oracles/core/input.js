/**
 * Specification Reference Oracle: Input Dispatch & Command System
 * Source: PROJECT.md §1 & spec_miner_engine_r0/handoff.md §3 (Features 7-10)
 */

import { screenToWorld } from './isometric.js';

export const MAP_SIZE = 3200;

export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export class InputDispatcher {
  constructor(camera = { x: 0, y: 0 }, zoom = 1.0, viewport = { width: 1280, height: 720 }) {
    this.camera = camera;
    this.zoom = zoom;
    this.viewport = viewport;
    this.targetingSkill = null;
  }

  handleMouseDown(button, screenX, screenY, hoveredEntity = null) {
    // Clamp screen coordinates to viewport
    const clampedSx = clamp(screenX, 0, this.viewport.width);
    const clampedSy = clamp(screenY, 0, this.viewport.height);

    const world = screenToWorld(clampedSx, clampedSy, this.camera, this.zoom, this.viewport);
    const wx = clamp(world.wx, 0, MAP_SIZE);
    const wy = clamp(world.wy, 0, MAP_SIZE);

    // Right-click (button 2)
    if (button === 2) {
      if (this.targetingSkill) {
        // Cancel targeting mode on right-click
        const cancelled = this.targetingSkill;
        this.targetingSkill = null;
        return { type: 'CANCEL_TARGETING', skill: cancelled };
      }

      if (hoveredEntity && hoveredEntity.team === 'enemy') {
        return {
          type: 'ATTACK_TARGET',
          targetId: hoveredEntity.id,
          targetX: hoveredEntity.x,
          targetY: hoveredEntity.y
        };
      }

      return {
        type: 'MOVE_TO',
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
          type: 'CAST_SKILL',
          skill,
          targetX: wx,
          targetY: wy,
          targetEntityId: hoveredEntity ? hoveredEntity.id : null
        };
      }
      return {
        type: 'SELECT',
        targetEntityId: hoveredEntity ? hoveredEntity.id : null,
        x: wx,
        y: wy
      };
    }

    return null;
  }

  handleKeyDown(key, hero) {
    const upperKey = key.toUpperCase();

    // Hotkeys Q, W, E, R
    if (['Q', 'W', 'E', 'R'].includes(upperKey)) {
      if (!hero) return null;
      const skill = hero.skills ? hero.skills[upperKey] : null;
      if (!skill) return { type: 'SKILL_ERROR', error: 'Skill not found' };

      if (hero.mana < skill.manaCost) {
        return { type: 'SKILL_ERROR', error: 'Insufficient mana' };
      }
      if (skill.cooldownRemaining > 0) {
        return { type: 'SKILL_ERROR', error: 'Skill on cooldown' };
      }

      if (skill.targetType === 'self' || skill.targetType === 'instant') {
        return {
          type: 'CAST_SKILL',
          skill: upperKey,
          targetX: hero.x,
          targetY: hero.y,
          instant: true
        };
      }

      this.targetingSkill = upperKey;
      return {
        type: 'START_TARGETING',
        skill: upperKey,
        targetType: skill.targetType,
        range: skill.range,
        radius: skill.radius
      };
    }

    // Stop command
    if (upperKey === 'S' || upperKey === 'H') {
      this.targetingSkill = null;
      return { type: 'STOP' };
    }

    // Recall key 'B'
    if (upperKey === 'B') {
      this.targetingSkill = null;
      return { type: 'RECALL' };
    }

    // Escape cancels targeting
    if (key === 'Escape') {
      if (this.targetingSkill) {
        const cancelled = this.targetingSkill;
        this.targetingSkill = null;
        return { type: 'CANCEL_TARGETING', skill: cancelled };
      }
    }

    return null;
  }
}
