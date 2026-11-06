import { enableTouchActivation } from './touch_button.js';
/**
 * Virtual Joystick & Mobile Touch Controls for MOBA Duplinha 2.5D.
 * Provides:
 * 1. Fixed joystick in the bottom-left corner.
 * 2. Dedicated Touch Attack Button (auto-targets nearest enemy or moves).
 * 3. Screen-relative to world-space continuous movement mapping.
 */

import { worldToScreen, screenToWorld } from '../core/isometric.js';
import { CommandType } from '../core/input.js';

export class VirtualJoystick {
  constructor(gameSim) {
    this.gameSim = gameSim;
    this.active = false;
    this.touchId = null;
    this.baseX = 0;
    this.baseY = 0;
    this.currX = 0;
    this.currY = 0;
    this.dirX = 0;
    this.dirY = 0;
    this.magnitude = 0;
    this.maxRadius = 60; // Max joystick thumb displacement

    this.container = null;
    this.baseEl = null;
    this.knobEl = null;
    this.attackBtnEl = null;

    this.updateInterval = null;
    this.listeners = [];

    this.initDOM();
    this.bindTouchEvents();
  }

  initDOM() {
    // Container for mobile controls
    const container = document.createElement('div');
    container.id = 'mobile-touch-controls';
    container.className = 'mobile-touch-controls';

    // Joystick visual elements
    const base = document.createElement('div');
    base.className = 'v-joystick-base';
    base.setAttribute('aria-label', 'Arraste para mover seu herói');
    base.setAttribute('role', 'group');
    const knob = document.createElement('div');
    knob.className = 'v-joystick-knob';
    base.appendChild(knob);
    container.appendChild(base);

    // Dedicated Touch Attack button (Bottom Right)
    const attackBtn = document.createElement('button');
    attackBtn.id = 'mobile-attack-btn';
    attackBtn.className = 'mobile-action-btn mobile-attack-btn';
    attackBtn.setAttribute('type', 'button');
    attackBtn.innerHTML = `
      <svg class="btn-icon" viewBox="0 0 48 48" aria-hidden="true"><path d="M8 5l26 25-5 5L4 9V4zm32 0L14 30l5 5L44 9V4z" fill="#e2e8f0" stroke="#64748b" stroke-width="2"/><path d="M25 31l13 13m-4-9l6-6M23 31L10 44m4-9l-6-6" stroke="#d7b75d" stroke-width="5"/></svg>
      <span class="btn-label">ATACAR</span>
    `;
    document.getElementById('combat-controls').appendChild(attackBtn);

    document.body.appendChild(container);

    this.container = container;
    this.baseEl = base;
    this.knobEl = knob;
    this.attackBtnEl = attackBtn;

    this.checkOrientation();
    this.listen(window, 'resize', () => this.checkOrientation());
    this.listen(window, 'orientationchange', () => this.checkOrientation());
  }

  listen(target, name, handler, options) {
    target.addEventListener(name, handler, options);
    this.listeners.push(() => target.removeEventListener(name, handler, options));
  }

  prefersTouchControls() {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
  }

  checkOrientation() {
    const alertEl = document.getElementById('orientation-warning-overlay');
    const isMobile = this.prefersTouchControls();
    this.container?.classList.toggle('desktop-mode', !isMobile);
    this.cancelMovement();
    alertEl?.classList.add('hidden');
  }

  bindTouchEvents() {
    if (!this.prefersTouchControls()) {
      // Desktop default: hide joystick by default unless touch simulated
      this.container.classList.add('desktop-mode');
    }

    enableTouchActivation(this.attackBtnEl, this.listen.bind(this));

    // Touch Attack Button Handler
    // A native click is emitted once for a tap, mouse click or keyboard activation.
    this.listen(this.attackBtnEl, 'click', (e) => {
      e.stopPropagation();
      this.handleTouchAttack();
    });

    if (this.baseEl) {
      this.listen(this.baseEl, 'pointerdown', e => this.beginPointer(e));
      this.listen(this.baseEl, 'pointermove', e => this.movePointer(e));
      this.listen(this.baseEl, 'pointerup', e => this.endPointer(e));
      this.listen(this.baseEl, 'pointercancel', e => this.endPointer(e));
      this.listen(this.baseEl, 'lostpointercapture', e => this.endPointer(e));
    }
    this.listen(window, 'blur', () => this.cancelMovement());
    if (typeof document !== 'undefined') this.listen(document, 'visibilitychange', () => {
      if (document.hidden) this.cancelMovement();
    });
  }

  beginPointer(e) {
    if (this.active || !this.prefersTouchControls() || e.pointerType === 'mouse') return;
    e.preventDefault(); e.stopPropagation();
    const rect = this.baseEl.getBoundingClientRect();
    this.active = true;
    this.touchId = e.pointerId;
    this.baseX = rect.left + rect.width / 2;
    this.baseY = rect.top + rect.height / 2;
    this.maxRadius = rect.width * .28;
    this.hasMoved = false;
    this.baseEl.setPointerCapture?.(e.pointerId);
    this.updateJoystickPosition(e.clientX, e.clientY);
    this.startMovementLoop();
  }

  movePointer(e) {
    if (!this.active || e.pointerId !== this.touchId) return;
    e.preventDefault();
    this.updateJoystickPosition(e.clientX, e.clientY);
  }

  endPointer(e) {
    if (e.pointerId !== this.touchId) return;
    this.cancelMovement();
  }

  cancelMovement() {
    const pointerId = this.touchId;
    const moved = this.hasMoved;
    this.active = false;
    this.touchId = null;
    this.hasMoved = false;
    this.dirX = this.dirY = this.magnitude = 0;
    this.stopMovementLoop();
    if (this.knobEl) this.knobEl.style.transform = 'translate(-50%, -50%)';
    if (pointerId != null && this.baseEl?.hasPointerCapture?.(pointerId)) this.baseEl.releasePointerCapture(pointerId);
    if (moved) this.gameSim?.handleCommand({ type: CommandType.STOP });
  }

  updateJoystickPosition(x, y) {
    this.currX = x;
    this.currY = y;
    const dx = x - this.baseX;
    const dy = y - this.baseY;
    const dist = Math.hypot(dx, dy);

    if (dist === 0) {
      this.dirX = 0;
      this.dirY = 0;
      this.magnitude = 0;
      if (this.knobEl) {
        this.knobEl.style.transform = `translate(-50%, -50%) translate(0px, 0px)`;
      }
      return;
    }

    const clampedDist = Math.min(dist, this.maxRadius);
    this.dirX = dx / dist;
    this.dirY = dy / dist;
    this.magnitude = clampedDist / this.maxRadius;

    const knobX = this.dirX * clampedDist;
    const knobY = this.dirY * clampedDist;

    if (this.knobEl) {
      this.knobEl.style.transform = `translate(-50%, -50%) translate(${knobX}px, ${knobY}px)`;
    }
  }

  startMovementLoop() {
    if (this.updateInterval) return;
    this.updateInterval = setInterval(() => {
      this.tickMovement();
    }, 50); // 20 times per second
  }

  stopMovementLoop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  tickMovement() {
    if (!this.active || this.magnitude < 0.1) return;
    const hero = this.gameSim?.playerHero;
    if (!hero) return;

    const isAlive = typeof hero.isAlive === 'function' ? hero.isAlive() : (!hero.isDead && (hero.hp > 0));
    if (!isAlive) return;

    // Convert hero current world position to screen coords
    const camera = this.gameSim.camera;
    const zoom = camera?.zoom || 1.0;
    const viewport = { width: window.innerWidth, height: window.innerHeight };

    const heroScreen = worldToScreen(hero.x, hero.y, 0, camera, zoom, viewport);
    const stepDistance = 160; // Desired target lookahead in pixels
    const targetScreenX = heroScreen.sx + this.dirX * stepDistance;
    const targetScreenY = heroScreen.sy + this.dirY * stepDistance;

    // Unproject to world coordinate
    const targetWorld = screenToWorld(targetScreenX, targetScreenY, camera, zoom, viewport);

    // Dispatch movement command without emitting spam particles
    const walkable = this.gameSim.map?.findNearestWalkable
      ? this.gameSim.map.findNearestWalkable(targetWorld.wx, targetWorld.wy, hero.radius)
      : { x: targetWorld.wx, y: targetWorld.wy };

    this.hasMoved = true;
    this.gameSim.handleCommand({ type: CommandType.MOVE_TO, x: walkable.x, y: walkable.y, silent: true });
  }

  handleTouchAttack() {
    const hero = this.gameSim?.playerHero;
    if (!hero) return;
    const isAlive = typeof hero.isAlive === 'function' ? hero.isAlive() : (!hero.isDead && (hero.hp > 0));
    if (!isAlive) return;

    // Find nearest hostile entity (enemy minion, tower, or champion)
    const entities = this.gameSim.entities || [];
    let nearestHostile = null;
    let minDist = 450; // Max auto-target search range

    for (const ent of entities) {
      if (!ent || ent === hero) continue;
      const alive = typeof ent.isAlive === 'function' ? ent.isAlive() : (!ent.isDead && (ent.hp > 0));
      if (!alive) continue;

      const isHostile = ent.team === 'enemy' || ent.team === 'neutral' || ent.isEnemy;
      if (isHostile) {
        const d = Math.hypot(ent.x - hero.x, ent.y - hero.y);
        if (d < minDist) {
          minDist = d;
          nearestHostile = ent;
        }
      }
    }

    if (nearestHostile) {
      this.gameSim.handleCommand({
        type: CommandType.ATTACK_TARGET,
        targetId: nearestHostile.id,
        targetEntity: nearestHostile
      });
    } else {
      const now = Date.now();
      if (!this.lastNoTargetAt || now - this.lastNoTargetAt >= 1000) {
        this.lastNoTargetAt = now;
        this.gameSim.particles?.addFloatingText('Nenhum alvo por perto', hero.x, hero.y - 25, { color: '#f8fafc', fontSize: 14 });
      }
    }
  }

  destroy() {
    this.active = false;
    this.stopMovementLoop();
    this.listeners.forEach(remove => remove());
    this.listeners = [];
    this.container?.remove();
    this.attackBtnEl?.remove();
  }
}
