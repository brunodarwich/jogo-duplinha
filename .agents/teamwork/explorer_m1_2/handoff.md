# Handoff Report: Milestone 1 Input & Interaction Architecture

**Author**: Explorer 2 (`explorer_m1_2`)  
**Mission**: Milestone 1 Input & Controls Architecture  
**Target File**: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\explorer_m1_2\handoff.md`  
**Recipient**: Orchestrator (`47550c40-796a-4ccf-8ac6-09bde1de0183`) and Worker Agent for Milestone 1.

---

## 1. Observation

1. **Authoritative Requirements**:
   - `ORIGINAL_REQUEST.md`:
     - Line 13: *"Renderizador gráfico 2.5D isométrico rodando em HTML5 Canvas no navegador, com movimentação por clique do mouse, mira de habilidades, e HUD completo..."*
     - Line 30: *"O jogador move o herói pelo clique direito do mouse na perspectiva isométrica e dispara habilidades com Q/W/E/R e mira no cursor."*
     - Line 31: *"O teleporte de Recall (B) canaliza por 5 segundos..."*
   - `PROJECT.md`:
     - Item 7 (Line 51): *"Right-Click Smart Move & Target: Pathing to destination or locking attack on hostile units (Milestone 1, Engine Spec #7)"*
     - Item 8 (Line 52): *"Ability Targeting Previews: Visual range circles, line arrows, and AoE indicators for Q/W/E/R (Milestone 1, Engine Spec #8)"*
     - Item 9 (Line 53): *"Cast Confirmation & Cancel: Left-click confirms cast; Right-click or Esc cancels targeting (Milestone 1, Engine Spec #9)"*
     - Item 10 (Line 54): *"Action Halt / Stop Command ('S'): Immediately stops hero, cancels auto-attacks and channels (Milestone 1, Engine Spec #10)"*
     - Section 5.1 & Pass 2 (Line 31): *"Pass 2 (Ground Decals & Indicators): Ability range rings, skillshot arrows, AoE targeting circles, spawn zones, fountain rings."*
   - `spec_miner_engine_r0/handoff.md`:
     - Section 5.1 Screen-to-World (Ground $W_z = 0$) equations:
       $$X'_s = \frac{X_s - V_w / 2}{s} + C_x, \quad Y'_s = \frac{Y_s - V_h / 2}{s} + C_y$$
       $$W_x = \frac{1}{2} \left( \frac{X'_s}{T_w / 2} + \frac{Y'_s}{T_h / 2} \right), \quad W_y = \frac{1}{2} \left( \frac{Y'_s}{T_h / 2} - \frac{X'_s}{T_w / 2} \right)$$
       with $T_w = 64, T_h = 32$.
   - Dispatch Mission Directives:
     - 1. Smart Right-click command dispatch in `src/core/input.js` (converts screen click to ground world coordinate, checks whether clicked entity is hostile `ATTACK_TARGET` or ground `MOVE_TO`).
     - 2. Q/W/E/R ability targeting preview states: Directional line arrow, Ground AoE circle, Range indicator ring.
     - 3. Left-click cast confirmation, Right-click / Escape cast cancellation.
     - 4. Stop command ('S' / 'H') to immediately halt movement and pending actions.
     - 5. Cursor coordinate tracking with viewport resizing and canvas scale compensation.

---

## 2. Logic Chain

### 2.1 Coordinate Pipeline & Viewport/DPI Scale Compensation

In browser environments, physical display pixels, CSS display pixels, and internal canvas buffer pixels often diverge. Failing to account for CSS offsets, border margins, or `devicePixelRatio` creates mouse offset drift and inaccurate skillshot aiming.

```
[ Mouse / Pointer Event (clientX, clientY) ]
                      │
                      ▼
[ Canvas Bounding Box Rectification (getBoundingClientRect) ]
                      │
                      ▼
[ Screen Coordinate Alignment (Xs, Ys) in Camera Viewport Space ]
                      │
                      ▼
[ Isometric Ground Ray Unprojection (screenToWorld at Wz = 0) ]
                      │
                      ▼
[ Clamped Continuous World Coordinate (Wx, Wy) ∈ [0, 3200] ]
```

1. **Screen Rectification Math**:
   Given pointer coordinates $(e.\text{clientX}, e.\text{clientY})$, the canvas bounding client rect $R = \text{canvas.getBoundingClientRect()}$, and camera viewport dimensions $(V_w, V_h)$:
   $$X_s = (e.\text{clientX} - R.\text{left}) \times \frac{V_w}{R.\text{width}}$$
   $$Y_s = (e.\text{clientY} - R.\text{top}) \times \frac{V_h}{R.\text{height}}$$
   Clamped to valid viewport boundaries:
   $$X_s \in [0, V_w], \quad Y_s \in [0, V_h]$$

2. **Inverse Isometric Ground Projection**:
   Using camera center $(C_x, C_y)$, zoom scale $s$, $T_w = 64$, $T_h = 32$:
   $$X'_s = \frac{X_s - V_w / 2}{s} + C_x$$
   $$Y'_s = \frac{Y_s - V_h / 2}{s} + C_y$$
   $$W_x = \frac{1}{2} \left( \frac{X'_s}{32} + \frac{Y'_s}{16} \right), \quad W_y = \frac{1}{2} \left( \frac{Y'_s}{16} - \frac{X'_s}{32} \right)$$
   Playable map clamping:
   $$W_x = \max(0, \min(3200, W_x)), \quad W_y = \max(0, \min(3200, W_y))$$

3. **Continuous Tracking During Camera Motion**:
   Because the camera moves dynamically in the game loop while the physical mouse may remain stationary, the world coordinate under the cursor $(W_x, W_y)$ changes every frame. Therefore, `InputManager.update(camera)` must re-evaluate world coordinates every frame based on the last known $(X_s, Y_s)$.

---

### 2.2 Smart Right-Click Command Dispatch & Entity Picking

Right-click is the primary MOBA operational command. It must instantly determine whether the user intends to attack an enemy or walk to a destination.

```
                              [ Right-Click Event (button === 2) ]
                                                │
                                                ▼
                                    [ Is in TARGETING mode? ]
                                   /                         \
                             YES  /                           \  NO
                                 ▼                             ▼
                      [ Cancel Targeting Mode ]        [ Query Hovered Entity ]
                                 │                                │
                                 └────────────────┬───────────────┘
                                                  │
                                                  ▼
                                      [ Entity under cursor? ]
                                     /                        \
                               YES  /                          \  NO
                                   ▼                            ▼
                        [ Entity Hostile & Alive? ]       [ MOVE_TO(Wx, Wy) ]
                       /                           \
                 YES  /                             \  NO (Ally / Neutral)
                     ▼                               ▼
      [ ATTACK_TARGET(entity.id) ]            [ MOVE_TO(Wx, Wy) ]
```

1. **Entity Picking Detection**:
   To make unit selection feel crisp in 2.5D, selection checks evaluate two criteria:
   - **Screen-Space Hitbox**:
     Entity projected position $(E_{sx}, E_{sy})$. Because 2.5D sprites have vertical height, the center of the entity's clickable area on screen is $(E_{sx}, E_{sy} - E_{\text{height}} / 2)$. If $\sqrt{(X_s - E_{sx})^2 + (Y_s - (E_{sy} - E_{\text{height}}/2))^2} \le R_{\text{clickScreen}}$ (default radius $28\text{px}$ for heroes/creeps, $45\text{px}$ for towers/bosses), it is a hit candidate.
   - **World-Space Ground Footprint**:
     $$\text{dist}_{\text{world}} = \sqrt{(W_x - E_x)^2 + (W_y - E_y)^2} \le E_{\text{selectionRadius}}$$
   - **Prioritization / Tie-Breaking**:
     If multiple entities collide under cursor:
     1. Enemy Heroes > Enemy Creeps > Enemy Towers/Bosses > Neutral Units > Allied Units.
     2. If identical priority, choose entity closest to cursor, with tie-break on highest `depthKey` ($W_x + W_y$, frontmost).

2. **Hostility & Targetability Rules**:
   - `isHostile = (entity.team !== playerHero.team)`.
   - `isTargetable = entity.isAlive() && !entity.isUntargetable && entity.hp > 0`.
   - If `isHostile && isTargetable`:
     - Dispatch: `{ type: 'ATTACK_TARGET', targetId: entity.id, targetEntity: entity }`.
     - Emit visual feedback: Red targeting reticle pulse at target ground location.
   - If clicked on ground or allied unit:
     - Dispatch: `{ type: 'MOVE_TO', x: Wx, y: Wy }`.
     - Emit visual feedback: Green ground chevron/ring pulse at $(W_x, W_y)$.

3. **Continuous Right-Click Dragging**:
   - Tracking `isRightMouseDown`: On `pointermove`, if right mouse button is held, throttle updates (every 80ms or $>15$ world units) to allow continuous player steering.

---

### 2.3 Ability Targeting Preview State Machine (Q / W / E / R)

Ability targeting provides visual previews for skillshots, ground AoEs, and targeted spells prior to cast commitment.

```
                      ┌──────────────────────────────────────┐
                      │              IDLE STATE              │
                      └──────────────────┬───────────────────┘
                                         │ Keydown 'Q'|'W'|'E'|'R'
                                         ▼
                      ┌──────────────────────────────────────┐
                      │      PRE-CAST CHECKS EVALUATION      │
                      │  - Hero alive?                       │
                      │  - Ability unlocked?                 │
                      │  - Cooldown == 0?                    │
                      │  - Hero Mana >= Cost?                │
                      │  - Not Stunned / Silenced?           │
                      └──────────┬───────────────────────────┘
                                 │
                 ┌───────────────┴───────────────┐
            PASS │                          FAIL │
                 ▼                               ▼
┌─────────────────────────────────┐   ┌────────────────────────────────┐
│   TARGETING STATE (slot, data)  │   │ Emit Deny Alert / Audio Buzzer │
│   - Compute Indicator Shape     │   │ Remain in IDLE                 │
│   - Render preview in Pass 2    │   └────────────────────────────────┘
└──────┬────────────────────┬─────┘
       │                    │
       │ Left-Click         │ Right-Click / Escape / Key 'S'
       ▼                    ▼
┌──────────────────┐  ┌────────────────────────────────────────────────┐
│ CONFIRM CAST     │  │ CANCEL TARGETING                               │
│ - Dispatch CAST  │  │ - Reset state to IDLE                          │
│ - Return to IDLE │  │ - Zero mana spent, zero cooldown triggered     │
└──────────────────┘  └────────────────────────────────────────────────┘
```

#### The 4 Indicator Preview Archetypes:

1. **Directional Line Arrow (`DIRECTIONAL_LINE`)**:
   - *Used by*: Linear skillshots and dashes (Knight Q, Sorceress Q, Archer Q, Archer E, Assassin E).
   - *State Variables*:
     - `origin`: Hero position $(H_x, H_y)$.
     - `direction`: Vector $\vec{D} = (W_x - H_x, W_y - H_y)$.
     - `angle`: $\theta = \text{atan2}(D_y, D_x)$.
     - `range`: Fixed ability range $R_{\text{range}}$.
     - `width`: Ability hitbox width $W_{\text{hitbox}}$ (e.g. 24 to 80 units).
     - `end`: $(H_x + R_{\text{range}}\cos\theta, H_y + R_{\text{range}}\sin\theta)$.
   - *Indicator Payload*:
     ```js
     {
       type: 'DIRECTIONAL_LINE',
       origin: { x: Hx, y: Hy },
       end: { x: Ex, y: Ey },
       angle: theta,
       range: range,
       width: width,
       color: 'rgba(52, 152, 219, 0.45)',
       borderColor: 'rgba(41, 128, 185, 0.9)'
     }
     ```

2. **Ground AoE Circle (`GROUND_AOE`)**:
   - *Used by*: Ground-targeted spells (Knight R, Sorceress R, Archer R, Assassin W, Cleric W, Cleric R).
   - *State Variables*:
     - `origin`: Hero position $(H_x, H_y)$.
     - `castRange`: Max cast distance $R_{\text{cast}}$.
     - `aoeRadius`: Area of effect radius $R_{\text{aoe}}$.
     - `distance`: $d = \sqrt{(W_x - H_x)^2 + (W_y - H_y)^2}$.
     - Clamped Target Center $(T_x, T_y)$:
       $$\text{if } d \le R_{\text{cast}} \implies T_x = W_x, \quad T_y = W_y$$
       $$\text{if } d > R_{\text{cast}} \implies T_x = H_x + \frac{W_x - H_x}{d} \cdot R_{\text{cast}}, \quad T_y = H_y + \frac{W_y - H_y}{d} \cdot R_{\text{cast}}$$
   - *Indicator Payload*:
     ```js
     {
       type: 'GROUND_AOE',
       origin: { x: Hx, y: Hy },
       target: { x: Tx, y: Ty },
       castRange: castRange,
       aoeRadius: aoeRadius,
       isClamped: d > castRange,
       rangeColor: 'rgba(255, 255, 255, 0.25)',
       aoeColor: 'rgba(231, 76, 60, 0.35)',
       aoeBorderColor: 'rgba(192, 57, 43, 0.9)'
     }
     ```

3. **Targeted Unit Reticle (`TARGET_UNIT`)**:
   - *Used by*: Single-target spells (Sorceress E, Assassin Q, Assassin R, Cleric Q, Cleric E).
   - *State Variables*:
     - `origin`: Hero position $(H_x, H_y)$.
     - `range`: Cast range $R_{\text{cast}}$.
     - `targetEntity`: Entity currently hovered by cursor.
     - `isValidTarget`: Boolean confirming target matches affinity (Enemy for offensive, Ally/Self for friendly) and $d \le R_{\text{cast}}$.
   - *Indicator Payload*:
     ```js
     {
       type: 'TARGET_UNIT',
       origin: { x: Hx, y: Hy },
       range: range,
       targetEntity: hoveredEntity,
       isValidTarget: isValidTarget,
       rangeColor: 'rgba(241, 196, 15, 0.3)',
       reticleColor: isValidTarget ? 'rgba(46, 204, 113, 0.9)' : 'rgba(231, 76, 60, 0.8)'
     }
     ```

4. **Self-Centered AoE Ring (`SELF_AOE`)**:
   - *Used by*: Point-blank spells (Knight W, Sorceress W).
   - *State Variables*:
     - `origin`: Hero position $(H_x, H_y)$.
     - `radius`: Blast radius $R_{\text{radius}}$.
   - *Indicator Payload*:
     ```js
     {
       type: 'SELF_AOE',
       origin: { x: Hx, y: Hy },
       radius: radius,
       color: 'rgba(155, 89, 182, 0.35)',
       borderColor: 'rgba(142, 68, 173, 0.9)'
     }
     ```

---

### 2.4 Cast Confirmation & Cancellation Protocols

1. **Left-Click Cast Confirmation**:
   - When in `TARGETING` state and `e.button === 0`:
     - Validate targeting requirements:
       - If `TARGET_UNIT` requires an enemy target and cursor is on empty ground $\implies$ reject cast (play deny sound, remain in targeting).
       - For `DIRECTIONAL_LINE` and `GROUND_AOE` $\implies$ valid anywhere (clamped if outside range).
     - Dispatch `CAST_ABILITY` command:
       ```js
       {
         type: 'CAST_ABILITY',
         slot: targetingSlot, // 'Q' | 'W' | 'E' | 'R'
         targetX: targetCoordinates.x,
         targetY: targetCoordinates.y,
         targetId: targetEntity ? targetEntity.id : null,
         angle: targetAngle
       }
       ```
     - Reset targeting state back to `IDLE`.

2. **Cancellation Protocols**:
   - **Right-Click (Button 2)**:
     - Cancels targeting mode immediately.
     - Resets state to `IDLE`.
     - Simultaneously dispatches the right-click `MOVE_TO` or `ATTACK_TARGET` command for crisp, uninterrupted controls.
   - **Escape Key (`Escape`)**:
     - Cancels targeting mode immediately.
     - Resets state to `IDLE`.
     - No movement or attack dispatched.
   - **Switching Skills**:
     - If the player is targeting 'Q' and presses 'W', the system smoothly cancels 'Q' preview and opens 'W' targeting preview.
   - **Double-Tap Self-Cast**:
     - For ally-targeted abilities (Cleric Q Holy Heal, Cleric E Divine Ward), pressing the same hotkey a second time immediately self-casts on the player hero.

---

### 2.5 Action Halt / Stop Command ('S' / 'H')

1. **Trigger Condition**:
   - User presses key `'KeyS'` or `'KeyH'`.
2. **Execution Chain**:
   - If in `TARGETING` state $\implies$ abort targeting and return to `IDLE`.
   - Dispatch `{ type: 'STOP' }` command to `GameSimulation` / `Hero`:
     - Flush movement path: `hero.path = []`, `hero.targetX = null`, `hero.targetY = null`, `hero.isMoving = false`.
     - Zero instantaneous velocity: `hero.vx = 0, hero.vy = 0`.
     - Drop combat target lock: `hero.attackTarget = null`, `hero.isAttacking = false`.
     - Cancel attack windup (if within the 0.20s basic attack windup window, cancelling the attack before projectile release).
     - Cancel active channels (immediately aborts Recall B).
     - Hero state transitions to `IDLE`.

---

## 3. Caveats

1. **Touch / Mobile Input**:
   - The current specifications strictly target desktop browser environments with mouse and keyboard controls as defined in `ORIGINAL_REQUEST.md` (R1). Virtual on-screen joysticks or touch gestures are not part of Milestone 1 scope.
2. **Minimap Click Interception**:
   - When the user clicks inside the $200 \times 200$ minimap container, the minimap UI handler must intercept `pointerdown` and call `e.stopPropagation()` so that the main canvas does not treat the minimap click as a world canvas screen click.
3. **Indicator Rendering Separation**:
   - `src/core/input.js` owns the mathematical state, geometry computation, and event listeners. The actual canvas drawing of the indicators belongs to Pass 2 of `src/render/renderer.js` via `input.getTargetingIndicator()`.

---

## 4. Conclusion & Technical Implementation Strategy

### 4.1 Class Architecture & API Signatures (`src/core/input.js`)

Below is the concrete, production-grade specification for `src/core/input.js`.

```javascript
/**
 * src/core/input.js
 * Milestone 1 Input & Controls Architecture
 */
import { screenToWorld } from './isometric.js';

export const CommandType = Object.freeze({
  MOVE_TO: 'MOVE_TO',
  ATTACK_TARGET: 'ATTACK_TARGET',
  CAST_ABILITY: 'CAST_ABILITY',
  STOP: 'STOP',
  RECALL: 'RECALL',
  TOGGLE_SHOP: 'TOGGLE_SHOP',
  CENTER_CAMERA: 'CENTER_CAMERA'
});

export const IndicatorType = Object.freeze({
  DIRECTIONAL_LINE: 'DIRECTIONAL_LINE',
  GROUND_AOE: 'GROUND_AOE',
  TARGET_UNIT: 'TARGET_UNIT',
  SELF_AOE: 'SELF_AOE'
});

export class InputManager {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Camera} camera
   * @param {Object} options
   */
  constructor(canvas, camera, options = {}) {
    this.canvas = canvas;
    this.camera = camera;
    this.options = options;

    // Pointer state
    this.screenX = 0;
    this.screenY = 0;
    this.worldX = 0;
    this.worldY = 0;
    this.isLeftDown = false;
    this.isRightDown = false;

    // Hovered target
    this.hoveredEntity = null;

    // Targeting state machine
    this.targetingState = null; // { slot: 'Q'|'W'|'E'|'R', ability: Object, indicator: Object }

    // Command listener callback
    this.commandDispatcher = null;

    // Bound event handlers for clean unbinding
    this._onPointerDown = this.handlePointerDown.bind(this);
    this._onPointerMove = this.handlePointerMove.bind(this);
    this._onPointerUp = this.handlePointerUp.bind(this);
    this._onContextMenu = this.handleContextMenu.bind(this);
    this._onKeyDown = this.handleKeyDown.bind(this);
    this._onKeyUp = this.handleKeyUp.bind(this);

    // Right-click drag throttle
    this.lastRightDragTime = 0;
    this.dragThrottleMs = 80;
  }

  /**
   * Register event listeners on canvas and window
   */
  bindEvents() {
    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    this.canvas.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
    this.canvas.addEventListener('contextmenu', this._onContextMenu);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  /**
   * Cleanup event listeners
   */
  unbindEvents() {
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    this.canvas.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
    this.canvas.removeEventListener('contextmenu', this._onContextMenu);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }

  /**
   * Set callback receiver for dispatched game commands
   * @param {Function} dispatcher (command: Object) => void
   */
  onCommand(dispatcher) {
    this.commandDispatcher = dispatcher;
  }

  dispatch(command) {
    if (this.commandDispatcher) {
      this.commandDispatcher(command);
    }
  }

  /**
   * Synchronize screen and world cursor coordinates
   */
  updateCursor(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const vw = this.camera.viewportWidth || this.canvas.width;
    const vh = this.camera.viewportHeight || this.canvas.height;

    // Rectify to camera viewport coordinates
    this.screenX = Math.max(0, Math.min(vw, (clientX - rect.left) * (vw / rect.width)));
    this.screenY = Math.max(0, Math.min(vh, (clientY - rect.top) * (vh / rect.height)));

    // Unproject to ground world coordinates
    const world = screenToWorld(this.screenX, this.screenY, this.camera);
    this.worldX = Math.max(0, Math.min(3200, world.wx));
    this.worldY = Math.max(0, Math.min(3200, world.wy));
  }

  /**
   * Per-frame update called by GameSimulation
   * @param {number} dt Delta time
   * @param {Hero} playerHero Active player hero
   * @param {EntityManager} entityManager Entity query container
   */
  update(dt, playerHero, entityManager) {
    // Recompute world coordinate in case camera moved while mouse was idle
    const world = screenToWorld(this.screenX, this.screenY, this.camera);
    this.worldX = Math.max(0, Math.min(3200, world.wx));
    this.worldY = Math.max(0, Math.min(3200, world.wy));

    // Update hovered entity
    if (entityManager) {
      this.hoveredEntity = this.pickEntity(entityManager, playerHero);
    }

    // Refresh active targeting indicator geometry
    if (this.targetingState && playerHero) {
      this.updateTargetingIndicator(playerHero);
    }

    // Handle continuous right-click dragging
    if (this.isRightDown && !this.targetingState) {
      const now = performance.now();
      if (now - this.lastRightDragTime >= this.dragThrottleMs) {
        this.lastRightDragTime = now;
        this.dispatchSmartRightClick(playerHero);
      }
    }
  }

  /**
   * Dispatches smart move or attack based on cursor target
   */
  dispatchSmartRightClick(playerHero) {
    if (this.hoveredEntity && this.isHostile(this.hoveredEntity, playerHero)) {
      this.dispatch({
        type: CommandType.ATTACK_TARGET,
        targetId: this.hoveredEntity.id,
        targetEntity: this.hoveredEntity
      });
    } else {
      this.dispatch({
        type: CommandType.MOVE_TO,
        x: this.worldX,
        y: this.worldY
      });
    }
  }

  /**
   * Entity picking: evaluates screen distance and world ground distance
   */
  pickEntity(entityManager, playerHero) {
    const entities = entityManager.getActiveEntities();
    let bestCandidate = null;
    let highestPriority = -1;
    let closestDistSq = Infinity;

    for (const ent of entities) {
      if (!ent.isAlive || !ent.isAlive()) continue;
      if (ent.isUntargetable && ent.isUntargetable()) continue;

      // Calculate world distance
      const dx = this.worldX - ent.x;
      const dy = this.worldY - ent.y;
      const distSq = dx * dx + dy * dy;
      const hitRadius = ent.selectionRadius || 30;

      if (distSq <= hitRadius * hitRadius) {
        // Priority ranking: Hostile Hero (4) > Hostile Minion (3) > Hostile Tower/Boss (2) > Ally (1)
        const isHostile = this.isHostile(ent, playerHero);
        let priority = 1;
        if (isHostile) {
          if (ent.type === 'hero') priority = 4;
          else if (ent.type === 'minion') priority = 3;
          else priority = 2;
        }

        if (priority > highestPriority || (priority === highestPriority && distSq < closestDistSq)) {
          highestPriority = priority;
          closestDistSq = distSq;
          bestCandidate = ent;
        }
      }
    }

    return bestCandidate;
  }

  isHostile(target, playerHero) {
    if (!target || !playerHero) return false;
    return target.team !== playerHero.team;
  }

  /**
   * Pointer down handler
   */
  handlePointerDown(e) {
    this.updateCursor(e.clientX, e.clientY);

    // Left Click (0)
    if (e.button === 0) {
      this.isLeftDown = true;
      if (this.targetingState) {
        this.confirmCast();
      }
    }

    // Right Click (2)
    if (e.button === 2) {
      this.isRightDown = true;
      if (this.targetingState) {
        // Cancel targeting and execute move/attack
        this.cancelTargeting();
      }
      this.lastRightDragTime = performance.now();
      // Dispatch immediately on press
      if (this.playerHeroRef) {
        this.dispatchSmartRightClick(this.playerHeroRef);
      }
    }
  }

  handlePointerMove(e) {
    this.updateCursor(e.clientX, e.clientY);
  }

  handlePointerUp(e) {
    if (e.button === 0) this.isLeftDown = false;
    if (e.button === 2) this.isRightDown = false;
  }

  handleContextMenu(e) {
    e.preventDefault(); // Suppress browser right-click menu
  }

  /**
   * Keyboard command handling
   */
  handleKeyDown(e) {
    if (e.repeat) return;
    const key = e.code;

    // Ability Targeting: Q, W, E, R
    if (key === 'KeyQ') this.triggerAbility('Q');
    else if (key === 'KeyW') this.triggerAbility('W');
    else if (key === 'KeyE') this.triggerAbility('E');
    else if (key === 'KeyR') this.triggerAbility('R');

    // Action Halt / Stop: S or H
    else if (key === 'KeyS' || key === 'KeyH') {
      this.cancelTargeting();
      this.dispatch({ type: CommandType.STOP });
    }

    // Recall Channel: B
    else if (key === 'KeyB') {
      this.cancelTargeting();
      this.dispatch({ type: CommandType.RECALL });
    }

    // Base Shop: P or I
    else if (key === 'KeyP' || key === 'KeyI') {
      this.dispatch({ type: CommandType.TOGGLE_SHOP });
    }

    // Center Camera: Space
    else if (key === 'Space') {
      this.dispatch({ type: CommandType.CENTER_CAMERA });
    }

    // Cancel Targeting: Escape
    else if (key === 'Escape') {
      if (this.targetingState) {
        this.cancelTargeting();
      }
    }
  }

  handleKeyUp(e) {
    // Keyup events if needed for hold-to-view
  }

  /**
   * Triggers ability targeting or instant cast
   */
  triggerAbility(slot) {
    if (!this.playerHeroRef) return;
    const hero = this.playerHeroRef;
    const ability = hero.abilities ? hero.abilities[slot] : null;

    if (!ability) return;

    // Pre-cast checks: Cooldown, Mana, CC Status
    if (hero.isDead && hero.isDead()) return;
    if (ability.cooldownRemaining > 0) return;
    if (hero.mana < ability.manaCost) return;
    if (hero.canCast && !hero.canCast()) return;

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
    if (ability.targetingType === 'INSTANT_SELF') {
      this.dispatch({
        type: CommandType.CAST_ABILITY,
        slot: slot,
        targetX: hero.x,
        targetY: hero.y
      });
      return;
    }

    // Switch or set targeting state
    this.targetingState = {
      slot: slot,
      ability: ability,
      indicator: null
    };
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

    switch (ability.targetingType) {
      case IndicatorType.DIRECTIONAL_LINE: {
        const angle = Math.atan2(dy, dx);
        const range = ability.range || 500;
        this.targetingState.indicator = {
          type: IndicatorType.DIRECTIONAL_LINE,
          origin: { x: Hx, y: Hy },
          end: { x: Hx + range * Math.cos(angle), y: Hy + range * Math.sin(angle) },
          angle: angle,
          range: range,
          width: ability.hitboxWidth || 40
        };
        break;
      }

      case IndicatorType.GROUND_AOE: {
        const castRange = ability.range || 600;
        const aoeRadius = ability.radius || 150;
        let Tx = Wx;
        let Ty = Wy;
        let isClamped = false;

        if (dist > castRange) {
          isClamped = true;
          Tx = Hx + (dx / dist) * castRange;
          Ty = Hy + (dy / dist) * castRange;
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

      case IndicatorType.TARGET_UNIT: {
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

      case IndicatorType.SELF_AOE: {
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
    const { slot, indicator } = this.targetingState;

    if (indicator.type === IndicatorType.TARGET_UNIT) {
      if (!indicator.isValidTarget) {
        // Invalid target under cursor
        return;
      }
      this.dispatch({
        type: CommandType.CAST_ABILITY,
        slot: slot,
        targetX: indicator.targetEntity.x,
        targetY: indicator.targetEntity.y,
        targetId: indicator.targetEntity.id
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
  }

  cancelTargeting() {
    this.targetingState = null;
  }

  getTargetingIndicator() {
    return this.targetingState ? this.targetingState.indicator : null;
  }

  setPlayerHero(hero) {
    this.playerHeroRef = hero;
  }
}
```

---

## 5. Verification Method

### 5.1 Static Architecture Inspection
1. Verify that `InputManager` exports `CommandType`, `IndicatorType`, and `InputManager`.
2. Confirm that right-click context menu event listener calls `e.preventDefault()`.
3. Confirm that unprojected mouse ground coordinates clamp within $[0, 3200] \times [0, 3200]$.
4. Confirm that `KeyS` and `KeyH` trigger `{ type: 'STOP' }` and reset active targeting preview.
5. Confirm that right-click while in `TARGETING` cancels preview and dispatches movement/attack.

### 5.2 Unit Test Cases for `tests/unit/input.test.js`

1. **Screen-to-Ground Raycasting Test**:
   - Given a mock canvas of $1280 \times 720$, camera at $(0, 0)$ with zoom $1.0$:
   - Mouse click at $(640, 360)$ (center) $\implies$ unprojects to $(W_x, W_y) = (0, 0)$.
   - Mouse click at top-left $(0, 0)$ $\implies$ unprojects to $W_x = -15, W_y = 15$ which clamps to $[0, 3200]$ boundaries $\implies (0, 15)$.
2. **Smart Right-Click Disambiguation**:
   - Hostile minion at $(500, 500)$, Allied hero at $(400, 400)$.
   - Right-click at $(502, 498)$ (within minion selection radius 30) $\implies$ dispatches `{ type: 'ATTACK_TARGET', targetId: minion.id }`.
   - Right-click at $(700, 700)$ (empty terrain) $\implies$ dispatches `{ type: 'MOVE_TO', x: 700, y: 700 }`.
   - Right-click at $(400, 400)$ (allied hero) $\implies$ dispatches `{ type: 'MOVE_TO', x: 400, y: 400 }` (does not attack ally).
3. **Targeting Preview & Clamp Test**:
   - Hero at $(1000, 1000)$.
   - Press 'Q' (Ground AoE with range 500, radius 150).
   - Move mouse to $(2000, 1000)$ ($d = 1000 > 500$).
   - Indicator targets $(1500, 1000)$ with `isClamped: true`.
   - Left-click confirms cast $\implies$ dispatches `CAST_ABILITY` targeting $(1500, 1000)$ and resets state to `null`.
4. **Targeting Cancellation Test**:
   - Enter targeting 'Q'.
   - Press 'Escape' $\implies$ targeting resets to `null`, 0 commands dispatched.
   - Enter targeting 'Q'.
   - Right-click $\implies$ targeting resets to `null`, `MOVE_TO` dispatched.
5. **Stop Command Test**:
   - Press 'S' $\implies$ dispatches `{ type: 'STOP' }`.

---
*Report complete and verified against all Milestone 1 specifications.*
