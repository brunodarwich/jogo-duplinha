/**
 * Virtual Joystick & Mobile Touch Controls for MOBA Duplinha 2.5D.
 * Provides:
 * 1. Floating Dynamic Joystick on the left half of the screen.
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
    base.className = 'v-joystick-base hidden';
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
      <span class="btn-icon">⚔️</span>
      <span class="btn-label">ATACAR</span>
    `;
    container.appendChild(attackBtn);

    document.body.appendChild(container);

    this.container = container;
    this.baseEl = base;
    this.knobEl = knob;
    this.attackBtnEl = attackBtn;

    // Orientation Warning Overlay
    const rotateAlert = document.createElement('div');
    rotateAlert.id = 'orientation-warning-overlay';
    rotateAlert.className = 'orientation-warning-overlay hidden';
    rotateAlert.innerHTML = `
      <div class="orientation-card">
        <div class="rotate-phone-icon">🔄📱</div>
        <h2>Gire seu Celular</h2>
        <p>Para a melhor experiência, jogue com o celular na horizontal (modo paisagem).</p>
      </div>
    `;
    document.body.appendChild(rotateAlert);

    this.checkOrientation();
    window.addEventListener('resize', () => this.checkOrientation());
    window.addEventListener('orientationchange', () => this.checkOrientation());
  }

  checkOrientation() {
    const alertEl = document.getElementById('orientation-warning-overlay');
    if (!alertEl) return;
    const isMobile = window.matchMedia('(max-width: 900px)').matches || ('ontouchstart' in window);
    const isPortrait = window.innerHeight > window.innerWidth;

    if (isMobile && isPortrait) {
      alertEl.classList.remove('hidden');
    } else {
      alertEl.classList.add('hidden');
    }
  }

  bindTouchEvents() {
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (!isTouchDevice && window.innerWidth > 900) {
      // Desktop default: hide joystick by default unless touch simulated
      this.container.classList.add('desktop-mode');
    }

    // Touch Attack Button Handler
    this.attackBtnEl.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleTouchAttack();
    }, { passive: false });

    this.attackBtnEl.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.handleTouchAttack();
    });

    // Window-level touch tracking for joystick on left side of screen
    window.addEventListener('touchstart', (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        // If touch is on left 45% of screen and not on a button/input
        const isLeftHalf = touch.clientX < (window.innerWidth * 0.45);
        const isInteractiveTarget = touch.target.closest('button, input, select, .inv-slot, .ability-slot, #lobby-overlay');

        if (!this.active && isLeftHalf && !isInteractiveTarget) {
          e.preventDefault();
          this.active = true;
          this.touchId = touch.identifier;
          this.baseX = touch.clientX;
          this.baseY = touch.clientY;
          this.currX = touch.clientX;
          this.currY = touch.clientY;
          this.dirX = 0;
          this.dirY = 0;
          this.magnitude = 0;

          this.showJoystick(this.baseX, this.baseY);
          this.startMovementLoop();
          break;
        }
      }
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (!this.active) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.touchId) {
          e.preventDefault();
          this.updateJoystickPosition(touch.clientX, touch.clientY);
          break;
        }
      }
    }, { passive: false });

    const endHandler = (e) => {
      if (!this.active) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.touchId) {
          this.active = false;
          this.touchId = null;
          this.dirX = 0;
          this.dirY = 0;
          this.magnitude = 0;
          this.hideJoystick();
          this.stopMovementLoop();
          break;
        }
      }
    };

    window.addEventListener('touchend', endHandler);
    window.addEventListener('touchcancel', endHandler);
  }

  showJoystick(x, y) {
    if (!this.baseEl) return;
    this.baseEl.style.left = `${x}px`;
    this.baseEl.style.top = `${y}px`;
    this.baseEl.classList.remove('hidden');
    if (this.knobEl) {
      this.knobEl.style.transform = `translate(-50%, -50%) translate(0px, 0px)`;
    }
  }

  hideJoystick() {
    if (!this.baseEl) return;
    this.baseEl.classList.add('hidden');
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

    hero.setAttackTarget(null);
    hero.attackMoveDestination = null;
    hero.holdPosition = false;
    hero.moveTo(walkable.x, walkable.y);
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
      // Trigger default basic attack or attack-move forward
      this.gameSim.input?.triggerAbility('Q');
    }
  }
}
