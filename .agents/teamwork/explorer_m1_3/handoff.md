# Milestone 1 Investigation & Implementation Strategy: Renderer & HUD Architecture

**Author**: Explorer 3 (`explorer_m1_3`)  
**Mission**: Formulate the concrete implementation strategy for Milestone 1 Renderer & HUD Overlays  
**Target Milestone**: Milestone 1 (Engine Foundation, 2.5D Isometric Renderer & HUD)  
**Date**: 2026-10-17T00:30:00Z  
**Target Directory**: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\explorer_m1_3\`  

---

## 1. Observation

### 1.1 Direct Quotations from Authoritative Sources

From `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\ORIGINAL_REQUEST.md`:
- **Requirement R1 (Lines 12–14)**:
  > *"Renderizador gráfico 2.5D isométrico rodando em HTML5 Canvas no navegador, com movimentação por clique do mouse, mira de habilidades, e HUD completo (vida, mana, barra de habilidades Q/W/E/R, ouro, cronômetro de partida e minimapa)."*
- **Acceptance Criteria (Lines 30, 35)**:
  > *"O jogador move o herói pelo clique direito do mouse na perspectiva isométrica e dispara habilidades com Q/W/E/R e mira no cursor."*  
  > *"Cada habilidade possui partículas/efeitos visuais no canvas, alcance visível e respeita recargas e custos de mana."*

From `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\orchestrator\PROJECT.md`:
- **7-Pass Rendering Pipeline (Lines 29–37)**:
  > *"1. Pass 1 (Terrain Grid): 2:1 dimetric tiles ($T_w = 64, T_h = 32$), lane ground textures, base grounds.*  
  > *2. Pass 2 (Ground Decals & Indicators): Ability range rings, skillshot arrows, AoE targeting circles, spawn zones, fountain rings.*  
  > *3. Pass 3 (Ground Shadows): Elliptical shadows under all dynamic and static units.*  
  > *4. Pass 4 (Y-Depth Sorted Entities): Dynamic units (heroes, minions, bosses, towers, nexus) sorted strictly by depth key $\text{DepthKey} = W_x + W_y$.*  
  > *5. Pass 5 (VFX & Particles): Procedural canvas spell animations (fireballs, ice spikes, arrows, smoke, holy light, beams).*  
  > *6. Pass 6 (Entity Overhead HUD): Floating health bars, mana bars, status icons (stun, taunt, root, silence), channel bars (Recall).*  
  > *7. Pass 7 (Screen HUD): Bottom ability bar (Q/W/E/R, cooldown sweeps, mana costs), inventory (6 slots), gold counter, match timer, interactive minimap."*
- **Interface Contract 1: Engine $\leftrightarrow$ World / Entities (Lines 131–141)**:
  > *"All entities store continuous world coordinates $(x, y, z)$ where $z=0$ is ground level.*  
  > *Each renderable entity must implement:*  
  > *- getDepthKey(): returns $W_x + W_y$*  
  > *- draw(ctx, camera, zoom): draws sprite/shape centered at projected screen position*  
  > *- drawHUD(ctx, camera, zoom): draws overhead health/mana/channel bar"*
- **Code Layout (Lines 208–255)**:
  - `src/render/renderer.js` — 7-pass canvas draw pipeline, viewport culling
  - `src/render/particles.js` — Procedural 2D particle emitters (fire, ice, arrows, vfx)
  - `src/ui/hud.js` — Bottom ability bar, cooldowns, stats, timer, minimap
  - `index.html` & `style.css` — Viewport Canvas, UI overlays, responsive layout

From `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\spec_miner_engine_r0\handoff.md`:
- **Projection Equations (Lines 134–146)**:
  - World-to-Screen:  
    $$X_s = \left( (W_x - W_y) \cdot \frac{T_w}{2} - C_x \right) \cdot s + \frac{V_w}{2}$$
    $$Y_s = \left( (W_x + W_y) \cdot \frac{T_h}{2} - W_z - C_y \right) \cdot s + \frac{V_h}{2}$$
  - Screen-to-World (Ground $W_z = 0$):  
    $$X'_{s} = \frac{X_s - V_w / 2}{s} + C_x, \quad Y'_{s} = \frac{Y_s - V_h / 2}{s} + C_y$$
    $$W_x = \frac{1}{2} \left( \frac{X'_{s}}{T_w / 2} + \frac{Y'_{s}}{T_h / 2} \right), \quad W_y = \frac{1}{2} \left( \frac{Y'_{s}}{T_h / 2} - \frac{X'_{s}}{T_w / 2} \right)$$
- **Depth Sorting Key (Line 150)**: $\text{DepthKey} = W_x + W_y$. Lowest rendered first; tie-broken by entity ID.
- **Map Boundaries (Lines 213–223)**: Map size is $3200 \times 3200$. Allied Base $(400, 400)$, Allied Nexus $(650, 650)$, Towers at $(950, 950)$ and $(1250, 1250)$, Center River $(1600, 1600)$, Enemy Towers $(1950, 1950)$ and $(2250, 2250)$, Enemy Base $(2800, 2800)$.

From `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\spec_miner_heroes_r0\handoff.md`:
- **Hero Attributes Matrix (Lines 60–77)**:
  - Knight: HP 680, Mana 300, Armor 38, MR 32, AD 58, MS 325.
  - Sorceress: HP 480, Mana 460, Armor 18, MR 30, AD 45, MS 315.
  - Ranger: HP 520, Mana 320, Armor 24, MR 30, AD 55, MS 335.
  - Assassin: HP 540, Mana 300, Armor 26, MR 32, AD 62, MS 345.
  - Cleric: HP 530, Mana 440, Armor 24, MR 32, AD 48, MS 320.

---

## 2. Logic Chain

1. **Ordering of the 7-Pass Rendering Pipeline**:
   - *Pass 1 (Terrain)*: Must render first at the absolute background layer. Drawing diamond tiles $(64 \times 32)$ with viewport culling ensures we only draw tiles within the camera's bounding box, avoiding unnecessary draw calls.
   - *Pass 2 (Ground Decals & Targeting Indicators)*: Must render directly onto the ground plane before units. Targeting rings, skillshot directional arrows, AoE ellipses, and fountain circles must visually lie flat beneath heroes and minions.
   - *Pass 3 (Ground Unit Drop Shadows)*: Must render immediately before entities. Because entities are rendered with vertical depth, drawing shadows in a dedicated pre-pass prevents background entity sprites from accidentally rendering behind foreground shadows.
   - *Pass 4 (Y-Depth Sorted Entities)*: Entities (towers, heroes, creeps, bosses, nexus, projectiles) must be sorted by $\text{DepthKey} = W_x + W_y$. Sorting ascending ensures entities with lower depth keys (further up-left in the isometric plane) are drawn first, correctly occluded by entities in front.
   - *Pass 5 (VFX & Active Particles)*: Spell bursts, shockwaves, arrows, fireballs, and floating combat text (`-120`, `+21g`) must render on top of entities with additive blending (`ctx.globalCompositeOperation = 'lighter'`) so visual effects remain vibrant and unoccluded.
   - *Pass 6 (Overhead Health & Mana Bars)*: Floating overhead bars must render *after* all entity sprites and particles. If drawn during Pass 4, a tall foreground tower or giant boss sprite would cover a hero's overhead health bar. Decoupling into Pass 6 guarantees 100% legibility in teamfights.
   - *Pass 7 (Screen HUD Overlays)*: Static screen elements (bottom ability bar, inventory, minimap, match timer) are unaffected by camera panning and zoom.

2. **Decoupled DOM HUD vs. Canvas Architecture**:
   - Rendering the entire HUD inside Canvas 2D leads to blurry text, complex click-hit detection, and cumbersome UI state handling.
   - By creating a hybrid model — HTML5 Canvas 2D for the game simulation world (Passes 1–6) and a responsive glassmorphic DOM overlay with a dedicated $200 \times 200$ `<canvas id="minimap-canvas">` for Pass 7:
     - Text rendering (stats, cooldown numbers, item tooltips) is crisp, hardware-accelerated, and responsive.
     - Cooldown radial sweeps can leverage CSS `conic-gradient`, which requires zero canvas redraw overhead.
     - Mouse events on UI buttons and inventory slots cleanly stop event propagation, preventing unwanted hero movement commands when clicking the UI.

3. **Isometric Circle Projection Math**:
   - In 2:1 dimetric projection, any circle of radius $R$ on the ground plane $(W_z = 0)$ projects to an ellipse on screen.
   - If horizontal radius is $R_x = R \cdot s$, then the vertical radius is $R_y = R_x \times 0.5$.
   - Using HTML5 Canvas `ctx.ellipse(screenX, screenY, Rx, Ry, 0, 0, Math.PI * 2)` accurately renders ground decal rings, fountain zones, and AoE indicators without distortion.

4. **Interactive Minimap Orthographic Projection**:
   - The map bounds are $[0, 3200] \times [0, 3200]$.
   - The minimap is a $200 \times 200$ pixel canvas.
   - Scale factor is $k = \frac{200}{3200} = \frac{1}{16} = 0.0625$.
   - Forward mapping (World to Minimap): $X_m = W_x / 16$, $Y_m = W_y / 16$.
   - Inverse mapping (Minimap to World): $W_x = X_m \times 16$, $W_y = Y_m \times 16$.
   - Camera frustum unprojection: By unprojecting the four canvas screen corners $(0, 0), (V_w, 0), (V_w, V_h), (0, V_h)$ via `screenToWorld` and mapping to minimap space, the camera's view is rendered on the minimap as an exact translucent diamond/polygon.
   - Right-clicking the minimap instantly converts $(X_m, Y_m) \to (W_x, W_y)$ and dispatches a move order. Left-clicking pans the camera.

5. **High-DPI / Retina Responsiveness**:
   - Setting `canvas.width = window.innerWidth * window.devicePixelRatio` and `canvas.height = window.innerHeight * window.devicePixelRatio` while maintaining `canvas.style.width = window.innerWidth + 'px'` and executing `ctx.scale(dpr, dpr)` eliminates blurriness on 4K and Retina screens.

---

## 3. Caveats

1. **Node.js Headless Execution**:
   - In automated test runners (`tests/runner.js`), `window`, `document`, and HTML5 Canvas are not present natively.
   - To make `src/render/renderer.js` and `src/ui/hud.js` 100% testable in Node.js:
     - Math, culling, sorting, and format methods must be pure functions or modular class methods.
     - DOM queries and Canvas context operations must be guarded with environment checks or accept mock objects.
2. **Radial Sweep CSS Compatibility**:
   - CSS `conic-gradient` is standard across modern Chromium, Edge, Safari, and Firefox. For environments lacking CSS custom property animations, a fallback Canvas 2D arc sweep or opacity overlay is specified.
3. **Procedural Rendering vs External Assets**:
   - Milestone 1 does not load external image files, avoiding asynchronous asset download failures. All heroes, creeps, towers, and effects are rendered procedurally using geometric 2.5D shapes, gradients, and drop shadows.

---

## 4. Conclusion & Technical Specifications

### 4.1 System Overview & File Structure

```
c:\Users\Bruno\Downloads\jogo-duplinha\
├── index.html                   # Responsive Canvas container & DOM HUD overlay
├── style.css                    # Glassmorphic MOBA HUD, radial cooldowns, minimap styling
└── src/
    ├── render/
    │   ├── renderer.js          # 7-Pass Canvas 2D render pipeline, culling & sorting
    │   └── particles.js         # 2D Procedural Particle & Floating Combat Text engine
    └── ui/
        └── hud.js               # HUD Controller (Hero stats, QWER buttons, Timer, Minimap)
```

---

### 4.2 Module 1: 7-Pass Canvas 2D Pipeline (`src/render/renderer.js`)

#### Class Signature & Lifecycle:
```js
import { worldToScreen, screenToWorld } from '../core/isometric.js';

export class Renderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    this.viewportWidth = 0;
    this.viewportHeight = 0;
    this.tileSize = { width: 64, height: 32 };
    this.mapSize = { width: 3200, height: 3200 };
    this.margin = 120; // Culling margin in screen pixels
  }

  resize(width, height) { ... }
  render(gameState, camera, inputState) { ... }
}
```

#### Detailed Pass Implementations:

#### **Pass 1: Terrain Tile Grid with Viewport Culling**
- **Method**: `pass1_Terrain(ctx, camera, zoom)`
- **Algorithm**:
  1. Determine viewport world bounding box by unprojecting the four canvas corners:
     ```js
     const tl = screenToWorld(0, 0, camera, zoom);
     const tr = screenToWorld(this.viewportWidth, 0, camera, zoom);
     const br = screenToWorld(this.viewportWidth, this.viewportHeight, camera, zoom);
     const bl = screenToWorld(0, this.viewportHeight, camera, zoom);
     
     const minWx = Math.max(0, Math.min(tl.wx, tr.wx, br.wx, bl.wx) - 64);
     const maxWx = Math.min(this.mapSize.width, Math.max(tl.wx, tr.wx, br.wx, bl.wx) + 64);
     const minWy = Math.max(0, Math.min(tl.wy, tr.wy, br.wy, bl.wy) - 64);
     const maxWy = Math.min(this.mapSize.height, Math.max(tl.wy, tr.wy, br.wy, bl.wy) + 64);
     ```
  2. Map world bounds to tile coordinates:
     - Tile step $S = 64$ world units.
     - Min tile index $X_0 = \lfloor minWx / S \rfloor$, $X_1 = \lceil maxWx / S \rceil$.
     - Min tile index $Y_0 = \lfloor minWy / S \rfloor$, $Y_1 = \lceil maxWy / S \rceil$.
  3. Draw visible diamond tiles:
     ```js
     for (let ty = Y_0; ty <= Y_1; ty++) {
       for (let tx = X_0; tx <= X_1; tx++) {
         const wx = tx * S + S / 2;
         const wy = ty * S + S / 2;
         const { sx, sy } = worldToScreen(wx, wy, 0, camera, zoom);
         
         // Lane identification: distance from line y = x <= 220
         const distToLane = Math.abs(wx - wy) / Math.SQRT2;
         const isLane = distToLane <= 175; // 350-unit wide lane
         const isAlliedBase = (wx <= 700 && wy <= 700);
         const isEnemyBase = (wx >= 2500 && wy >= 2500);
         
         let fillStyle = '#1b281d'; // Jungle/Grass
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
         
         const hw = (this.tileSize.width / 2) * zoom;
         const hh = (this.tileSize.height / 2) * zoom;
         
         ctx.beginPath();
         ctx.moveTo(sx, sy - hh);
         ctx.lineTo(sx + hw, sy);
         ctx.lineTo(sx, sy + hh);
         ctx.lineTo(sx - hw, sy);
         ctx.closePath();
         ctx.fillStyle = fillStyle;
         ctx.fill();
         ctx.strokeStyle = strokeStyle;
         ctx.lineWidth = 1;
         ctx.stroke();
       }
     }
     ```

#### **Pass 2: Ground Decals & Ability Targeting Indicators**
- **Method**: `pass2_GroundDecals(ctx, gameState, inputState, camera, zoom)`
- **Components**:
  1. **Fountain Zones**:
     - Allied Fountain: $(400, 400)$, radius $250$.
       `worldToScreen(400, 400, 0)`.
       Draw 2:1 ground ellipse with $R_x = 250 \cdot zoom$, $R_y = R_x / 2$. Fill: `rgba(59, 130, 246, 0.12)`, border: `#3b82f6` (width 2px, dashed `[8, 6]`).
     - Enemy Fountain: $(2800, 2800)$, radius $250$.
       Fill: `rgba(239, 68, 68, 0.12)`, border: `#ef4444`.
  2. **Tower Attack Range Indicator**:
     - If player is within 600 units of an allied or enemy tower:
       Draw ground ellipse at tower position with radius $400 \cdot zoom$.
       Color: Allied `rgba(59, 130, 246, 0.2)`, Enemy `rgba(239, 68, 68, 0.25)`.
  3. **Right-Click Move Destination Decal**:
     - Expanding ripple ring (radius 8px $\to$ 24px over 400ms) with emerald green `#10b981`.
  4. **Ability Targeting Indicator (Input Driven)**:
     - If `inputState.targetingActive`:
       - **Ground Range Circle**: Ellipse centered at hero $(H_x, H_y)$ with $R = \text{range} \cdot zoom$, fill `rgba(0, 229, 255, 0.08)`, border `#00e5ff`.
       - **Skillshot Arrow (Directional)**:
         Compute unit vector $\hat{u}$ from hero to mouse ground position.
         Width $W = \text{ability.width} \cdot zoom$, Length $L = \text{ability.range} \cdot zoom$.
         Construct 7-point polygon on ground, project each vertex using `worldToScreen`, fill `rgba(0, 229, 255, 0.25)`, stroke `#00e5ff`.
       - **AoE Circle**:
         Ellipse centered at target mouse ground coordinates (clamped to max range), radius $R_{aoe} \cdot zoom$, fill `rgba(245, 158, 11, 0.25)`, stroke `#f59e0b`.

#### **Pass 3: Ground Unit Drop Shadows**
- **Method**: `pass3_GroundShadows(ctx, entities, camera, zoom)`
- **Algorithm**:
  For each visible entity:
  ```js
  const { sx, sy } = worldToScreen(entity.x, entity.y, 0, camera, zoom);
  const baseRadius = entity.radius || 22;
  const shadowRx = baseRadius * 1.15 * zoom;
  const shadowRy = shadowRx * 0.5; // 2:1 dimetric ratio
  
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(sx, sy, shadowRx, shadowRy, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fill();
  ctx.restore();
  ```

#### **Pass 4: Y-Depth Sorted Dynamic Entities**
- **Method**: `pass4_SortedEntities(ctx, entities, camera, zoom)`
- **Sorting Criterion**:
  ```js
  const visible = entities.filter(e => this.isEntityInViewport(e, camera, zoom));
  visible.sort((a, b) => {
    const diff = a.getDepthKey() - b.getDepthKey();
    if (Math.abs(diff) > 0.001) return diff;
    return (a.id || '').localeCompare(b.id || '');
  });
  
  for (const entity of visible) {
    entity.draw(ctx, camera, zoom);
  }
  ```
- **Fallback Entity Renderers (Procedural 2.5D Sprites)**:
  - *Hero*:
    Render cylinder base (`#3b82f6` allied, `#ef4444` enemy) with height 36px, directional heading pointer indicating facing angle, and hero emblem.
  - *Defensive Tower*:
    Stone obelisk base with beveling, top crystal (pulsing blue/red glow with `ctx.shadowBlur = 15`), height 90px.
  - *Nexus*:
    Large hexagonal pedestal ($r = 70$), rotating inner power gem, height 60px.
  - *Minion*:
    Small round warrior ($r = 14$), silver armor plate, weapon indicator.
  - *Projectiles*:
    Magic orb with trailing comet tail (`ctx.createRadialGradient`).

#### **Pass 5: Active Particle Effects (VFX)**
- **Method**: `pass5_Particles(ctx, particleSystem, camera, zoom)`
- **Features**:
  - Sets `ctx.globalCompositeOperation = 'lighter'`.
  - Iterates active particle pool: expands shockwave rings, fireball flame sparks, frost spikes, and lightning arcs.
  - Restores `ctx.globalCompositeOperation = 'source-over'`.
  - Floating Combat Text (FCT):
    Renders floating damage numbers (White for physical, Cyan for magical, Bold Yellow `#eab308` with `[CRIT]` for crits, Green for heals, Gold for `+XXg`).

#### **Pass 6: Overhead Health and Mana Bars**
- **Method**: `pass6_OverheadHUD(ctx, entities, camera, zoom)`
- *(Detailed specifications in Section 4.3 below)*.

#### **Pass 7: Screen-Space HUD Overlays**
- **Method**: `pass7_ScreenHUD(ctx, gameState)`
- Handles canvas screen-space notices:
  - Match announcements: "MINION WAVES HAVE SPAWNED", "MINI-BOSS APPROACHING", "VICTORY", "DEFEAT".
  - Low HP red vignette screen pulse when player health $< 25\%$.
  - Triggers or synchronizes `hud.update(playerHero, gameState, inputState)`.

---

### 4.3 Module 2: Overhead Health & Mana Bar Specifications

#### Geometry & Styling:

| Entity Type | Bar Width ($W$) | HP Bar Height | Mana Bar Height | Vertical Offset from Base ($H_{off}$) |
|---|---|---|---|---|
| **Local Player Hero** | 72px | 6px | 3px | 52px |
| **Allied Co-op Hero** | 68px | 5px | 3px | 50px |
| **Enemy Hero** | 68px | 5px | 3px | 50px |
| **Defensive Tower** | 100px | 8px | None (Shield) | 110px |
| **Minion (Melee/Ranged)** | 36px | 4px | None | 28px |
| **Cannon Minion** | 46px | 5px | None | 34px |
| **Wave 5/10 Mini-Boss** | 130px | 9px | None | 85px |
| **Supreme Nexus Guardian** | 160px | 12px | None | 105px |

#### Drawing Implementation:
```js
export function drawOverheadBar(ctx, entity, camera, zoom) {
  const { sx, sy } = worldToScreen(entity.x, entity.y, entity.z || 0, camera, zoom);
  const isHero = entity.type === 'hero';
  const isLocal = entity.isLocalPlayer;
  const isAllied = entity.team === 'allied';
  
  const w = isHero ? (isLocal ? 72 : 68) : (entity.type === 'tower' ? 100 : 36);
  const hpHeight = isHero ? 5 : (entity.type === 'tower' ? 8 : 4);
  const manaHeight = isHero ? 3 : 0;
  const totalH = hpHeight + (manaHeight > 0 ? manaHeight + 1 : 0);
  
  const offset = (entity.height || 40) * zoom;
  const x = Math.round(sx - w / 2);
  const y = Math.round(sy - offset);
  
  // 1. Dark Background Container
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(x - 1, y - 1, w + 2, totalH + 2);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 1, y - 1, w + 2, totalH + 2);
  
  // 2. Health Bar Fill
  const hpRatio = Math.max(0, Math.min(1, entity.hp / entity.maxHp));
  const hpWidth = Math.round(w * hpRatio);
  ctx.fillStyle = isAllied ? '#22c55e' : '#ef4444';
  ctx.fillRect(x, y, hpWidth, hpHeight);
  
  // 3. Shield / Barrier Overlay (Knight Passive, etc.)
  if (entity.barrier && entity.barrier > 0) {
    const shieldRatio = Math.min(1 - hpRatio, entity.barrier / entity.maxHp);
    const shieldWidth = Math.round(w * shieldRatio);
    ctx.fillStyle = 'rgba(253, 224, 71, 0.85)'; // Luminous Gold
    ctx.fillRect(x + hpWidth, y, shieldWidth, hpHeight);
  }
  
  // 4. Health Segment Notches (Every 250 HP)
  if (entity.maxHp >= 500) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    const notchStep = (250 / entity.maxHp) * w;
    for (let nx = notchStep; nx < w; nx += notchStep) {
      ctx.fillRect(Math.round(x + nx), y, 1, hpHeight);
    }
  }
  
  // 5. Mana Bar (Heroes only)
  if (manaHeight > 0) {
    const manaY = y + hpHeight + 1;
    const manaRatio = Math.max(0, Math.min(1, (entity.mana || 0) / (entity.maxMana || 1)));
    const manaWidth = Math.round(w * manaRatio);
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(x, manaY, manaWidth, manaHeight);
  }
  
  // 6. Local Player Golden Chevron
  if (isLocal) {
    ctx.beginPath();
    ctx.moveTo(sx - 4, y - 7);
    ctx.lineTo(sx + 4, y - 7);
    ctx.lineTo(sx, y - 2);
    ctx.closePath();
    ctx.fillStyle = '#fbbf24';
    ctx.fill();
  }
  
  // 7. Recall Channel Progress Bar
  if (entity.isRecalling) {
    const channelW = w;
    const channelH = 5;
    const channelY = y + totalH + 3;
    const progress = Math.min(1, (entity.recallElapsed || 0) / 5000);
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(x, channelY, channelW, channelH);
    ctx.fillStyle = '#06b6d4'; // Cyan
    ctx.fillRect(x, channelY, Math.round(channelW * progress), channelH);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RECALL', sx, channelY + channelH + 8);
  }
}
```

---

### 4.4 Module 3: Bottom HUD & Action Console (`src/ui/hud.js`)

#### Components & Architecture:
1. **Hero Portrait & Level Badge**:
   - Class-specific circular portrait (`knight`, `sorceress`, `ranger`, `assassin`, `cleric`).
   - Circular level badge in bottom-right corner of portrait displaying `entity.level`.
2. **Hero Stats Matrix Panel**:
   - Attack Damage (AD) with icon ⚔️
   - Ability Power (AP) with icon ✨
   - Armor with icon 🛡️
   - Magic Resist (MR) with icon 🔮
   - Movement Speed (MS) with icon 👟
   - Gold counter with icon 💰
3. **Player Health & Mana Bars**:
   - Large central status bars with numerical labels: `680 / 680` HP and `300 / 300` Mana.
4. **Q/W/E/R Ability Action Slots**:
   - Icons for Q, W, E, R and Recall (B).
   - Hotkey letter pill (`Q`, `W`, `E`, `R`, `B`).
   - Mana cost badge in top-right corner.
   - **Radial Cooldown Sweep**:
     Calculates `--cooldown-angle: ${(remaining / total) * 360}deg`.
     Applies `.cooldown-active` and updates countdown text (e.g. `4.2s` or `9s`).
   - Insufficient Mana styling: Applies `.insufficient-mana` (dark blue-red overlay, disabled cursor).
   - Targeting Active styling: Applies `.targeting-active` (neon cyan glowing outline).
5. **6-Slot Item Inventory**:
   - 6 rectangular slots ($2 \times 3$ grid) displaying equipped items or empty dashed borders.
   - Tooltips on hover showing item stats and sell value.

#### Radial Cooldown CSS & JS Binding:
```css
.ability-slot {
  position: relative;
  width: 52px;
  height: 52px;
  background: #1e293b;
  border: 2px solid #334155;
  border-radius: 8px;
  cursor: pointer;
  overflow: hidden;
}

.ability-slot.targeting-active {
  border-color: #00e5ff;
  box-shadow: 0 0 12px rgba(0, 229, 255, 0.6);
}

.ability-slot.insufficient-mana {
  filter: grayscale(60%) brightness(50%);
  border-color: #64748b;
}

.ability-cooldown-sweep {
  position: absolute;
  inset: 0;
  background: conic-gradient(rgba(0, 0, 0, 0.78) var(--cooldown-angle, 0deg), transparent var(--cooldown-angle, 0deg));
  pointer-events: none;
}

.cooldown-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-weight: bold;
  font-size: 16px;
  text-shadow: 0 2px 4px #000;
  pointer-events: none;
}
```

---

### 4.5 Module 4: Top HUD (Timer & Objectives)

- **Match Timer**:
  - Displays elapsed simulation time as `MM:SS`.
  - Computed via:
    ```js
    export function formatMatchTime(seconds) {
      const s = Math.max(0, Math.floor(seconds));
      const m = Math.floor(s / 60);
      const rem = s % 60;
      return `${m.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
    }
    ```
- **Objective Tracker**:
  - Allied Towers Alive: Status icons (Tier 1, Tier 2).
  - Enemy Towers Alive: Status icons (Tier 1, Tier 2).
  - Mini-Boss Alert: At wave 4 / wave 9, displays "MINI-BOSS IN: 00:30".

---

### 4.6 Module 5: Interactive Minimap Widget ($200 \times 200$)

#### Specifications & Coordinates:
- Size: $200 \times 200$ pixels.
- World Bounds: $[0, 3200] \times [0, 3200]$.
- Scale: $1\text{px on minimap} = 16\text{ world units}$ ($X_m = W_x / 16, Y_m = W_y / 16$).

#### Drawing Routine:
```js
export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scale = 200 / 3200; // 0.0625
  }

  worldToMap(wx, wy) {
    return {
      mx: wx * this.scale,
      my: wy * this.scale
    };
  }

  mapToWorld(mx, my) {
    return {
      wx: mx / this.scale,
      wy: my / this.scale
    };
  }

  render(gameState, camera, zoom, viewportWidth, viewportHeight) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, 200, 200);

    // 1. Terrain & Lane Corridor
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 200, 200);

    // Lane path (diagonal corridor from (25, 25) to (175, 175))
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 22; // 350 world units / 16
    ctx.beginPath();
    ctx.moveTo(25, 25);
    ctx.lineTo(175, 175);
    ctx.stroke();

    // Center River accent
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(115, 85);
    ctx.lineTo(85, 115);
    ctx.stroke();

    // 2. Bases & Fountains
    ctx.fillStyle = 'rgba(59, 130, 246, 0.25)';
    ctx.beginPath();
    ctx.arc(25, 25, 15.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
    ctx.beginPath();
    ctx.arc(175, 175, 15.6, 0, Math.PI * 2);
    ctx.fill();

    // 3. Structures (Towers & Nexus)
    for (const struct of gameState.structures) {
      if (struct.hp <= 0) continue;
      const { mx, my } = this.worldToMap(struct.x, struct.y);
      ctx.fillStyle = struct.team === 'allied' ? '#38bdf8' : '#f87171';
      if (struct.type === 'nexus') {
        ctx.fillRect(mx - 3, my - 3, 6, 6);
      } else {
        ctx.beginPath();
        ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 4. Minion Dots
    for (const minion of gameState.minions) {
      if (minion.hp <= 0) continue;
      const { mx, my } = this.worldToMap(minion.x, minion.y);
      ctx.fillStyle = minion.team === 'allied' ? '#67e8f9' : '#fca5a5';
      ctx.fillRect(mx - 1, my - 1, 2, 2);
    }

    // 5. Heroes
    for (const hero of gameState.heroes) {
      if (hero.hp <= 0) continue;
      const { mx, my } = this.worldToMap(hero.x, hero.y);
      if (hero.isLocalPlayer) {
        ctx.fillStyle = '#fbbf24'; // Gold
        ctx.beginPath();
        ctx.arc(mx, my, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.fillStyle = hero.team === 'allied' ? '#22c55e' : '#ef4444';
        ctx.beginPath();
        ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 6. Camera Viewport Frustum Rectangle
    const tl = screenToWorld(0, 0, camera, zoom);
    const tr = screenToWorld(viewportWidth, 0, camera, zoom);
    const br = screenToWorld(viewportWidth, viewportHeight, camera, zoom);
    const bl = screenToWorld(0, viewportHeight, camera, zoom);

    const p0 = this.worldToMap(tl.wx, tl.wy);
    const p1 = this.worldToMap(tr.wx, tr.wy);
    const p2 = this.worldToMap(br.wx, br.wy);
    const p3 = this.worldToMap(bl.wx, bl.wy);

    ctx.beginPath();
    ctx.moveTo(p0.mx, p0.my);
    ctx.lineTo(p1.mx, p1.my);
    ctx.lineTo(p2.mx, p2.my);
    ctx.lineTo(p3.mx, p3.my);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fill();
  }
}
```

#### Minimap Interaction Handling:
- **Right-Click on Minimap**:
  Dispatches a ground move order to $(W_x, W_y) = \text{mapToWorld}(M_x, M_y)$.
- **Left-Click / Left-Drag on Minimap**:
  Immediately re-centers the camera on $(W_x, W_y)$.

---

### 4.7 Module 6: HTML5 Canvas Setup, Full-Window Responsive Viewport & DOM Layout

#### `index.html` Hierarchy:
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>MOBA Duplinha 2.5D</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <!-- Fullscreen Game Canvas -->
  <canvas id="game-canvas"></canvas>

  <!-- HUD Overlays (Pointer-events transparent, children interactive) -->
  <div id="hud-overlay" class="hud-overlay">
    <!-- Top HUD -->
    <header class="top-hud">
      <div class="tower-status allied">
        <span class="icon">🛡️</span>
        <span id="allied-towers-count">Towers: 2</span>
      </div>
      <div class="match-timer-container">
        <span id="match-timer">00:00</span>
      </div>
      <div class="tower-status enemy">
        <span class="icon">💀</span>
        <span id="enemy-towers-count">Towers: 2</span>
      </div>
    </header>

    <!-- Bottom HUD Console -->
    <footer class="bottom-hud">
      <!-- Portrait & Level -->
      <div class="hud-portrait-box">
        <div id="hero-portrait" class="hero-portrait knight"></div>
        <div id="hero-level-badge" class="level-badge">1</div>
      </div>

      <!-- Stats Matrix -->
      <div class="hud-stats-box">
        <div class="stat-item"><span class="stat-icon">⚔️</span><span id="stat-ad">58</span></div>
        <div class="stat-item"><span class="stat-icon">✨</span><span id="stat-ap">0</span></div>
        <div class="stat-item"><span class="stat-icon">🛡️</span><span id="stat-armor">38</span></div>
        <div class="stat-item"><span class="stat-icon">🔮</span><span id="stat-mr">32</span></div>
        <div class="stat-item"><span class="stat-icon">👟</span><span id="stat-speed">325</span></div>
        <div class="stat-item gold"><span class="stat-icon">💰</span><span id="stat-gold">500</span></div>
      </div>

      <!-- Center Console (HP, Mana, Abilities) -->
      <div class="hud-center-console">
        <div class="status-bars">
          <div class="bar-container hp-bar">
            <div id="hud-hp-fill" class="bar-fill" style="width: 100%;"></div>
            <span id="hud-hp-text" class="bar-text">680 / 680</span>
          </div>
          <div class="bar-container mana-bar">
            <div id="hud-mana-fill" class="bar-fill" style="width: 100%;"></div>
            <span id="hud-mana-text" class="bar-text">300 / 300</span>
          </div>
        </div>

        <div class="ability-bar">
          <div id="ability-q" class="ability-slot" data-key="Q">
            <div class="ability-icon icon-q"></div>
            <div class="ability-cooldown-sweep"></div>
            <span class="cooldown-text"></span>
            <span class="mana-badge">50</span>
            <span class="hotkey-label">Q</span>
          </div>
          <div id="ability-w" class="ability-slot" data-key="W">
            <div class="ability-icon icon-w"></div>
            <div class="ability-cooldown-sweep"></div>
            <span class="cooldown-text"></span>
            <span class="mana-badge">60</span>
            <span class="hotkey-label">W</span>
          </div>
          <div id="ability-e" class="ability-slot" data-key="E">
            <div class="ability-icon icon-e"></div>
            <div class="ability-cooldown-sweep"></div>
            <span class="cooldown-text"></span>
            <span class="mana-badge">40</span>
            <span class="hotkey-label">E</span>
          </div>
          <div id="ability-r" class="ability-slot ultimate" data-key="R">
            <div class="ability-icon icon-r"></div>
            <div class="ability-cooldown-sweep"></div>
            <span class="cooldown-text"></span>
            <span class="mana-badge">100</span>
            <span class="hotkey-label">R</span>
          </div>
          <div id="ability-b" class="ability-slot recall" data-key="B">
            <div class="ability-icon icon-b">🌀</div>
            <div class="ability-cooldown-sweep"></div>
            <span class="cooldown-text"></span>
            <span class="hotkey-label">B</span>
          </div>
        </div>
      </div>

      <!-- 6-Slot Inventory -->
      <div class="hud-inventory">
        <div class="inv-slot" data-slot="0"></div>
        <div class="inv-slot" data-slot="1"></div>
        <div class="inv-slot" data-slot="2"></div>
        <div class="inv-slot" data-slot="3"></div>
        <div class="inv-slot" data-slot="4"></div>
        <div class="inv-slot" data-slot="5"></div>
      </div>

      <!-- Interactive Minimap (Bottom-Right) -->
      <div id="minimap-container" class="minimap-container">
        <canvas id="minimap-canvas" width="200" height="200"></canvas>
      </div>
    </footer>
  </div>

  <script type="module" src="src/main.js"></script>
</body>
</html>
```

#### Responsive Viewport & Canvas Management:
```js
export function setupResponsiveCanvas(canvas, onResizeCallback) {
  function handleResize() {
    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    if (onResizeCallback) {
      onResizeCallback(width, height, dpr);
    }
  }

  window.addEventListener('resize', handleResize);
  handleResize();
}
```

---

## 5. Verification Method

### 5.1 Independent Automated Unit Tests

A comprehensive unit test file `tests/unit/test_renderer.js` and `tests/unit/test_hud.js` will verify:
1. **Depth Sorting Invariant**:
   - Entities at positions $(100, 200)$, $(50, 50)$, $(300, 100)$ sort strictly by $W_x + W_y$:
     - $E_1(50, 50) \implies 100$ (first)
     - $E_2(100, 200) \implies 300$ (second)
     - $E_3(300, 100) \implies 400$ (third)
   - Tie-breaker: Entities with identical depth keys sort alphabetically by `entity.id`.
2. **Minimap Coordinate Round-Trip**:
   - `minimap.worldToMap(1600, 1600)` returns `{ mx: 100, my: 100 }`.
   - `minimap.mapToWorld(100, 100)` returns `{ wx: 1600, wy: 1600 }`.
   - Boundary tests: $(0, 0) \to (0, 0)$ and $(3200, 3200) \to (200, 200)$.
3. **Match Timer Formatter**:
   - `formatMatchTime(0)` $\to$ `"00:00"`.
   - `formatMatchTime(65)` $\to$ `"01:05"`.
   - `formatMatchTime(3599)` $\to$ `"59:59"`.
4. **Mocked 7-Pass Execution**:
   - Running `renderer.render(gameState, camera, inputState)` against a mock canvas 2D context executes all 7 passes without uncaught exceptions or NaN parameters.

### 5.2 Browser Invalidation & E2E Verification
- Launch local static server (`npx serve .` or `node tests/runner.js`).
- Inspect in browser:
  - Canvas fills viewport completely with 0px margin/padding and no scrollbars.
  - Minimap renders at bottom-right with diagonal lane, base circles, hero gold dot, and camera frustum rectangle.
  - Hovering and clicking ability buttons triggers radial cooldown sweep test animations.
  - Right-clicking ground displays green ripple indicator; pressing Q/W/E/R displays ground targeting indicators.
