# Handoff Report: Explorer 2 — 7-Pass Canvas 2D Renderer & HUD Remediation

**Author**: Explorer 2 (`explorer_m1_r2_2`)  
**Mission**: Milestone 1 Remediation (Iteration 2) — 7-Pass Canvas 2D Renderer & HUD Frustum Formulation  
**Target Milestone**: Milestone 1 (Engine Foundation, 2.5D Isometric Renderer & HUD)  
**Date**: 2026-10-17T00:57:00Z  
**Recipient**: Orchestrator (`47550c40-796a-4ccf-8ac6-09bde1de0183`) and Worker (`worker_m1`)  
**Working Directory**: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\explorer_m1_r2_2\`

---

## 1. Observation

### 1.1 Direct Baseline Observations in `src/render/renderer.js`

1. **Pass 1 Terrain Diamond Stepping (lines 31-34, 129-143)**:
   ```javascript
   31: this.tileSize = { width: 64, height: 32 };
   32: this.mapSize = { width: 3200, height: 3200 };
   33: this.tileStep = 64; // World units per tile
   ...
   129: const S = this.tileStep;
   130: const X0 = Math.floor(minWx / S);
   131: const X1 = Math.ceil(maxWx / S);
   132: const Y0 = Math.floor(minWy / S);
   133: const Y1 = Math.ceil(maxWy / S);
   134:
   135: const hw = (this.tileSize.width / 2) * zoom;
   136: const hh = (this.tileSize.height / 2) * zoom;
   137:
   138: for (let ty = Y0; ty <= Y1; ty++) {
   139:   for (let tx = X0; tx <= X1; tx++) {
   140:     const wx = tx * S + S / 2;
   141:     const wy = ty * S + S / 2;
   142:     const { sx, sy } = worldToScreen(wx, wy, 0, camera, zoom, vp);
   ```
   - **Observed Behavior Prior to Option A**:
     Stepping $tx$ by $+1$ increments $wx$ by $64$. Under the unnormalized formula $isoX = (wx - wy) \times 32$, screen displacement was $\Delta sx = 64 \times 32 = 2048$ px and $\Delta sy = 64 \times 16 = 1024$ px. Because the drawn diamond tile has $hw = 32$ px and $hh = 16$ px, tiles were separated by massive $2016$ px black voids.
     Empirical test in Node: On a $1280 \times 720$ viewport with camera at $(650, 650)$, exactly 25 tiles across the entire map were processed and only 1 or 2 touched the viewport.
   - **Observed Tile Boundary Issue**:
     `X1 = Math.ceil(maxWx / S)` when `maxWx = 3200` yields $X1 = 50$. Tile $tx = 50$ produces $wx = 50 \times 64 + 32 = 3232$, placing tile centers outside the $3200 \times 3200$ map boundary. Clamping $X1 \le \lfloor 3200 / 64 \rfloor - 1 = 49$ ensures exactly 50 tiles ($tx \in [0, 49]$) are drawn.

2. **Pass 2 Ground Decal Radii (lines 189-191, 202-204, 220-222)**:
   ```javascript
   189: ctx.beginPath();
   190: ctx.ellipse(allyF.sx, allyF.sy, 250 * zoom, (250 * 0.5) * zoom, 0, 0, Math.PI * 2);
   ...
   202: ctx.beginPath();
   203: ctx.ellipse(enemyF.sx, enemyF.sy, 250 * zoom, (250 * 0.5) * zoom, 0, 0, Math.PI * 2);
   ...
   220: ctx.beginPath();
   221: ctx.ellipse(sx, sy, 400 * zoom, (400 * 0.5) * zoom, 0, 0, Math.PI * 2);
   ```
   - **Observed Behavior**:
     Fountains ($R = 250$) and towers ($R = 400$) were drawing ellipses with semi-axes $(R \times \text{zoom}, R \times 0.5 \times \text{zoom})$. In normalized projection where $\Delta sx = \Delta wx \times 0.5 \times s$, these drawn visual radii are $2\times$ larger than the actual world extent. An ellipse of world radius $R$ must have horizontal radius $R \times 0.5 \times s$ and vertical radius $R \times 0.25 \times s$.

3. **Pass 2 Ability Targeting Previews (lines 266-274, 284, 301)**:
   ```javascript
   266: ctx.ellipse(origin.sx, origin.sy, ind.castRange * zoom, (ind.castRange * 0.5) * zoom, 0, 0, Math.PI * 2);
   ...
   274: ctx.ellipse(target.sx, target.sy, ind.aoeRadius * zoom, (ind.aoeRadius * 0.5) * zoom, 0, 0, Math.PI * 2);
   ...
   284: ctx.ellipse(origin.sx, origin.sy, ind.range * zoom, (ind.range * 0.5) * zoom, 0, 0, Math.PI * 2);
   ...
   301: ctx.ellipse(origin.sx, origin.sy, ind.radius * zoom, (ind.radius * 0.5) * zoom, 0, 0, Math.PI * 2);
   ```
   - **Observed Behavior**:
     All ability range circles (`castRange`, `aoeRadius`, `range`, `radius`) used $(R \times \text{zoom}, R \times 0.5 \times \text{zoom})$, producing a 2x visual scaling discrepancy against the projected target endpoints.
     Furthermore, in `GROUND_AOE` and `TARGET_UNIT`, there was no visual guide line connecting the hero origin to the target endpoint.

4. **Minimap Camera Frustum in `src/ui/hud.js` (lines 34, 170-194)**:
   ```javascript
   34: this.scale = 200 / 3200; // 0.0625 (1px = 16 world units)
   ...
   172: const tl = screenToWorld(0, 0, camera, zoom, vp);
   173: const tr = screenToWorld(viewportWidth, 0, camera, zoom, vp);
   174: const br = screenToWorld(viewportWidth, viewportHeight, camera, zoom, vp);
   175: const bl = screenToWorld(0, viewportHeight, camera, zoom, vp);
   176:
   177: const p0 = this.worldToMap(tl.wx, tl.wy);
   178: const p1 = this.worldToMap(tr.wx, tr.wy);
   179: const p2 = this.worldToMap(br.wx, br.wy);
   180: const p3 = this.worldToMap(bl.wx, bl.wy);
   ```
   - **Observed Behavior Prior to Option A**:
     Because `screenToWorld` was unnormalized (dividing by 32 instead of 0.5), unprojected world coordinates spanned only $28$ world units across the entire screen! Scaled by $k = 1/16$, the resulting frustum was a microscopic $1.76$ px dot on the minimap.

---

## 2. Logic Chain

### 2.1 Pass 1: Seamless Diamond Tiling Geometry Proof

Under Option A (formulated by Explorer 1 and verified here):
$$isoX = (W_x - W_y) \times 0.5$$
$$isoY = (W_x + W_y) \times 0.25 - W_z$$
$$sx = (isoX - Cam_X) \times s + \frac{V_w}{2}, \quad sy = (isoY - Cam_Y) \times s + \frac{V_h}{2}$$

1. **Center-to-Center Displacement**:
   - Advancing by 1 tile horizontally in tile grid ($tx \to tx + 1$):
     $$\Delta W_x = S = 64, \quad \Delta W_y = 0$$
     $$\Delta isoX = (64 - 0) \times 0.5 = 32$$
     $$\Delta isoY = (64 + 0) \times 0.25 = 16$$
     $$\Delta sx = 32 \times s, \quad \Delta sy = 16 \times s$$
   - Advancing by 1 tile vertically in tile grid ($ty \to ty + 1$):
     $$\Delta W_x = 0, \quad \Delta W_y = S = 64$$
     $$\Delta isoX = (0 - 64) \times 0.5 = -32$$
     $$\Delta isoY = (0 + 64) \times 0.25 = 16$$
     $$\Delta sx = -32 \times s, \quad \Delta sy = 16 \times s$$

2. **Vertex Adjacency and Zero-Gap Tesselation**:
   - Each tile is rendered with semi-axes $hw = 32 \times s$ and $hh = 16 \times s$.
   - The 4 vertices of tile $(tx, ty)$ centered at $(sx, sy)$ are:
     $$\text{Top}: (sx, sy - 16s)$$
     $$\text{Right}: (sx + 32s, sy)$$
     $$\text{Bottom}: (sx, sy + 16s)$$
     $$\text{Left}: (sx - 32s, sy)$$
   - The adjacent tile $(tx + 1, ty)$ has center $(sx + 32s, sy + 16s)$. Its vertices are:
     $$\text{Top}_{(tx+1, ty)} = (sx + 32s, sy + 16s - 16s) = (sx + 32s, sy) \equiv \text{Right}_{(tx, ty)}$$
     $$\text{Left}_{(tx+1, ty)} = (sx + 32s - 32s, sy + 16s) = (sx, sy + 16s) \equiv \text{Bottom}_{(tx, ty)}$$
   - **Conclusion**: The edge connecting Top to Left of tile $(tx+1, ty)$ is **mathematically identical** to the edge connecting Right to Bottom of tile $(tx, ty)$. Adjacent tiles share exact vertex coordinates with **0 pixel gap and 0 pixel overlap** under all zoom factors $s > 0$.

3. **Tile Count and Viewport Coverage**:
   - For camera at $(650, 650)$ on a $1280 \times 720$ viewport with zoom $1.0$, unprojected viewport corners span $[0, 2112] \times [0, 2112]$ world coordinates.
   - Tiles processed: $X0 = 0, X1 = 33, Y0 = 0, Y1 = 33 \implies 34 \times 34 = 1156$ tiles completely covering the screen (eliminating the previous 25-tile / 2-tile starvation).

### 2.2 Pass 2: Decal & Targeting Radii Normalization

1. **Dimensional Scaling**:
   - In 2:1 dimetric isometric projection, moving $R$ world units along the world X or Y axis produces a screen displacement of:
     $$\text{Horizontal}: \Delta sx = R \times 0.5 \times s$$
     $$\text{Vertical}: \Delta sy = R \times 0.25 \times s$$
   - The ratio of vertical to horizontal semi-axes is $\frac{0.25}{0.5} = 0.5 = \frac{1}{2}$, which is the exact 2:1 dimetric aspect ratio.
2. **Harmonization with Targeting Indicators**:
   - For an ability with `castRange = 600`, the cast range circle drawn with semi-axes $(600 \times 0.5 \times s, 600 \times 0.25 \times s) = (300s, 150s)$ aligns directly with target endpoints projected via `worldToScreen(target.x, target.y)`.
   - Along coordinate axes, target is at $(650 + 600, 650) \implies \Delta sx = 300s, \Delta sy = 150s$, touching the ellipse boundary.
   - The previous 35x displacement mismatch ($21,466$ px target vs $600$ px circle) is completely resolved.

### 2.3 Minimap Camera Frustum Geometry

1. **Unprojected Viewport Coordinates**:
   - For a $1280 \times 720$ viewport with camera at map center $(1600, 1600)$ and zoom $1.0$:
     $$Cam_X = (1600 - 1600) \times 0.5 = 0, \quad Cam_Y = (1600 + 1600) \times 0.25 = 800$$
   - Unprojecting the 4 screen corners:
     - Top-Left $(0, 0)$: $xp = -640, yp = 440 \implies W_x = 240, W_y = 1520$
     - Top-Right $(1280, 0)$: $xp = 640, yp = 440 \implies W_x = 1520, W_y = 240$
     - Bottom-Right $(1280, 720)$: $xp = 640, yp = 1160 \implies W_x = 2960, W_y = 1680$
     - Bottom-Left $(0, 720)$: $xp = -640, yp = 1160 \implies W_x = 1680, W_y = 2960$
2. **Minimap Scaling ($k = 1/16 = 0.0625$)**:
   - $p0 = (240 / 16, 1520 / 16) = (15, 95)$
   - $p1 = (1520 / 16, 240 / 16) = (95, 15)$
   - $p2 = (2960 / 16, 1680 / 16) = (185, 105)$
   - $p3 = (1680 / 16, 2960 / 16) = (105, 185)$
3. **Frustum Dimensions**:
   - Bounding box spans $\Delta mx = 185 - 15 = 170$ px and $\Delta my = 185 - 15 = 170$ px.
   - Screen-aligned width (from left edge center to right edge center): $\sqrt{80^2 + 80^2} = 113.1$ px.
   - Screen-aligned height (from top edge center to bottom edge center): $\sqrt{90^2 + 90^2} = 127.3$ px.
   - Diagonal span: $\sqrt{170^2 + 10^2} = 170.3$ px.
   - **Conclusion**: The frustum diamond occupies an expansive, highly readable ~160x90px to 170px area centered on the $200 \times 200$ minimap, perfectly reflecting the camera's true viewport.

---

## 3. Caveats

- **Dependency on Option A**:
  These renderer and HUD modifications assume Option A (`src/core/isometric.js` multiplying by 0.5 and 0.25) is applied by the Worker simultaneously, as formulated by Explorer 1 (`explorer_m1_r2_1`).
- **Entity Sprites (Pass 4)**:
  `Entity.draw()` renders procedural disc bases using `r = Math.max(8, this.radius * zoom)` where `radius = 20` to `35`. These are visually distinct avatar tokens designed for readability (spanning 20-35px within 64px diamond tiles) and require no alterations.
- No other caveats.

---

## 4. Conclusion & Actionable Instructions for Worker

### 4.1 Summary of Changes

| Target File | Location | Modification Description |
|---|---|---|
| `src/render/renderer.js` | Lines 129–134 | Clamp tile bounds: `maxTilesX = Math.floor(mapSize.width / S)`, `X0 = Math.max(0, ...)`, `X1 = Math.min(maxTilesX - 1, Math.ceil(...))`. |
| `src/render/renderer.js` | Lines 190, 203 | Allied & Enemy Fountain ellipses: `250 * 0.5 * zoom`, `250 * 0.25 * zoom`. |
| `src/render/renderer.js` | Line 221 | Tower range indicator ellipse: `400 * 0.5 * zoom`, `400 * 0.25 * zoom`. |
| `src/render/renderer.js` | Lines 266, 274 | Ability `GROUND_AOE` cast range and AoE target circles: `castRange * 0.5 * zoom, castRange * 0.25 * zoom` and `aoeRadius * 0.5 * zoom, aoeRadius * 0.25 * zoom`. |
| `src/render/renderer.js` | Lines 275–280 | Added dashed guide line connecting hero `origin` to `target` in `GROUND_AOE`. |
| `src/render/renderer.js` | Lines 284, 296 | Ability `TARGET_UNIT` range circle: `range * 0.5 * zoom, range * 0.25 * zoom` and guide line to target entity. |
| `src/render/renderer.js` | Line 301 | Ability `SELF_AOE` circle: `radius * 0.5 * zoom, radius * 0.25 * zoom`. |
| `src/ui/hud.js` | Lines 171–176 | Robust viewport parameter resolution in `Minimap.render`: `vw = camera.viewportWidth || viewportWidth`, `vh = camera.viewportHeight || viewportHeight`, `z = camera.zoom ?? zoom`. |

---

### 4.2 Exact Replacement Chunks for the Worker

#### Chunk 1: `src/render/renderer.js` — Pass 1 Terrain Tile Clamping

**StartLine**: 129  
**EndLine**: 134  

**TargetContent**:
```javascript
    const S = this.tileStep;
    const X0 = Math.floor(minWx / S);
    const X1 = Math.ceil(maxWx / S);
    const Y0 = Math.floor(minWy / S);
    const Y1 = Math.ceil(maxWy / S);
```

**ReplacementContent**:
```javascript
    const S = this.tileStep;
    const maxTilesX = Math.floor(this.mapSize.width / S);
    const maxTilesY = Math.floor(this.mapSize.height / S);
    const X0 = Math.max(0, Math.floor(minWx / S));
    const X1 = Math.min(maxTilesX - 1, Math.ceil(maxWx / S));
    const Y0 = Math.max(0, Math.floor(minWy / S));
    const Y1 = Math.min(maxTilesY - 1, Math.ceil(maxWy / S));
```

---

#### Chunk 2: `src/render/renderer.js` — Pass 2 Decal Radii (Fountains & Towers)

**StartLine**: 185  
**EndLine**: 228  

**TargetContent**:
```javascript
    // 1. Fountain Zones (Radius 250)
    // Allied Fountain at (400, 400)
    const allyF = worldToScreen(400, 400, 0, camera, zoom, vp);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(allyF.sx, allyF.sy, 250 * zoom, (250 * 0.5) * zoom, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(59, 130, 246, 0.12)';
    ctx.fill();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    if (ctx.setLineDash) ctx.setLineDash([8, 6]);
    ctx.stroke();
    ctx.restore();

    // Enemy Fountain at (2800, 2800)
    const enemyF = worldToScreen(2800, 2800, 0, camera, zoom, vp);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(enemyF.sx, enemyF.sy, 250 * zoom, (250 * 0.5) * zoom, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
    ctx.fill();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    if (ctx.setLineDash) ctx.setLineDash([8, 6]);
    ctx.stroke();
    ctx.restore();

    // 2. Tower Range Indicators
    const structures = (gameState?.entities || []).filter(e => e.type === 'tower' && e.isAlive && e.isAlive());
    const hero = gameState?.playerHero;
    for (const tower of structures) {
      const dist = hero ? Math.hypot(hero.x - tower.x, hero.y - tower.y) : 9999;
      if (dist <= 700) {
        const { sx, sy } = worldToScreen(tower.x, tower.y, 0, camera, zoom, vp);
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(sx, sy, 400 * zoom, (400 * 0.5) * zoom, 0, 0, Math.PI * 2);
        ctx.fillStyle = tower.team === 'allied' ? 'rgba(59, 130, 246, 0.08)' : 'rgba(239, 68, 68, 0.12)';
        ctx.fill();
        ctx.strokeStyle = tower.team === 'allied' ? 'rgba(59, 130, 246, 0.6)' : 'rgba(239, 68, 68, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }
    }
```

**ReplacementContent**:
```javascript
    // 1. Fountain Zones (Radius 250)
    // Allied Fountain at (400, 400)
    const allyF = worldToScreen(400, 400, 0, camera, zoom, vp);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(allyF.sx, allyF.sy, 250 * 0.5 * zoom, 250 * 0.25 * zoom, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(59, 130, 246, 0.12)';
    ctx.fill();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    if (ctx.setLineDash) ctx.setLineDash([8, 6]);
    ctx.stroke();
    ctx.restore();

    // Enemy Fountain at (2800, 2800)
    const enemyF = worldToScreen(2800, 2800, 0, camera, zoom, vp);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(enemyF.sx, enemyF.sy, 250 * 0.5 * zoom, 250 * 0.25 * zoom, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
    ctx.fill();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    if (ctx.setLineDash) ctx.setLineDash([8, 6]);
    ctx.stroke();
    ctx.restore();

    // 2. Tower Range Indicators
    const structures = (gameState?.entities || []).filter(e => e.type === 'tower' && e.isAlive && e.isAlive());
    const hero = gameState?.playerHero;
    for (const tower of structures) {
      const dist = hero ? Math.hypot(hero.x - tower.x, hero.y - tower.y) : 9999;
      if (dist <= 700) {
        const { sx, sy } = worldToScreen(tower.x, tower.y, 0, camera, zoom, vp);
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(sx, sy, 400 * 0.5 * zoom, 400 * 0.25 * zoom, 0, 0, Math.PI * 2);
        ctx.fillStyle = tower.team === 'allied' ? 'rgba(59, 130, 246, 0.08)' : 'rgba(239, 68, 68, 0.12)';
        ctx.fill();
        ctx.strokeStyle = tower.team === 'allied' ? 'rgba(59, 130, 246, 0.6)' : 'rgba(239, 68, 68, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }
    }
```

---

#### Chunk 3: `src/render/renderer.js` — Pass 2 Targeting Indicators

**StartLine**: 262  
**EndLine**: 307  

**TargetContent**:
```javascript
    } else if (ind.type === IndicatorType.GROUND_AOE) {
      // Cast range circle from hero
      const origin = worldToScreen(ind.origin.x, ind.origin.y, 0, camera, zoom, vp);
      ctx.beginPath();
      ctx.ellipse(origin.sx, origin.sy, ind.castRange * zoom, (ind.castRange * 0.5) * zoom, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // AoE target circle
      const target = worldToScreen(ind.target.x, ind.target.y, 0, camera, zoom, vp);
      ctx.beginPath();
      ctx.ellipse(target.sx, target.sy, ind.aoeRadius * zoom, (ind.aoeRadius * 0.5) * zoom, 0, 0, Math.PI * 2);
      ctx.fillStyle = ind.isClamped ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.25)';
      ctx.fill();
      ctx.strokeStyle = ind.isClamped ? '#ef4444' : '#f59e0b';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (ind.type === IndicatorType.TARGET_UNIT) {
      // Range circle
      const origin = worldToScreen(ind.origin.x, ind.origin.y, 0, camera, zoom, vp);
      ctx.beginPath();
      ctx.ellipse(origin.sx, origin.sy, ind.range * zoom, (ind.range * 0.5) * zoom, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(241, 196, 15, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Unit reticle if hovering valid entity
      if (ind.targetEntity) {
        const tgt = worldToScreen(ind.targetEntity.x, ind.targetEntity.y, 0, camera, zoom, vp);
        ctx.beginPath();
        ctx.arc(tgt.sx, tgt.sy - (ind.targetEntity.height || 40) * 0.5 * zoom, 24 * zoom, 0, Math.PI * 2);
        ctx.strokeStyle = ind.isValidTarget ? '#22c55e' : '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    } else if (ind.type === IndicatorType.SELF_AOE) {
      const origin = worldToScreen(ind.origin.x, ind.origin.y, 0, camera, zoom, vp);
      ctx.beginPath();
      ctx.ellipse(origin.sx, origin.sy, ind.radius * zoom, (ind.radius * 0.5) * zoom, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(168, 85, 247, 0.2)';
      ctx.fill();
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
```

**ReplacementContent**:
```javascript
    } else if (ind.type === IndicatorType.GROUND_AOE) {
      // Cast range circle from hero
      const origin = worldToScreen(ind.origin.x, ind.origin.y, 0, camera, zoom, vp);
      ctx.beginPath();
      ctx.ellipse(origin.sx, origin.sy, ind.castRange * 0.5 * zoom, ind.castRange * 0.25 * zoom, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // AoE target circle
      const target = worldToScreen(ind.target.x, ind.target.y, 0, camera, zoom, vp);
      ctx.beginPath();
      ctx.ellipse(target.sx, target.sy, ind.aoeRadius * 0.5 * zoom, ind.aoeRadius * 0.25 * zoom, 0, 0, Math.PI * 2);
      ctx.fillStyle = ind.isClamped ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.25)';
      ctx.fill();
      ctx.strokeStyle = ind.isClamped ? '#ef4444' : '#f59e0b';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Guide line from hero origin to target endpoint
      ctx.beginPath();
      ctx.moveTo(origin.sx, origin.sy);
      ctx.lineTo(target.sx, target.sy);
      ctx.strokeStyle = ind.isClamped ? 'rgba(239, 68, 68, 0.45)' : 'rgba(245, 158, 11, 0.45)';
      ctx.lineWidth = 1.5;
      if (ctx.setLineDash) ctx.setLineDash([6, 6]);
      ctx.stroke();
      if (ctx.setLineDash) ctx.setLineDash([]);
    } else if (ind.type === IndicatorType.TARGET_UNIT) {
      // Range circle
      const origin = worldToScreen(ind.origin.x, ind.origin.y, 0, camera, zoom, vp);
      ctx.beginPath();
      ctx.ellipse(origin.sx, origin.sy, ind.range * 0.5 * zoom, ind.range * 0.25 * zoom, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(241, 196, 15, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Unit reticle if hovering valid entity
      if (ind.targetEntity) {
        const tgt = worldToScreen(ind.targetEntity.x, ind.targetEntity.y, 0, camera, zoom, vp);
        ctx.beginPath();
        ctx.arc(tgt.sx, tgt.sy - (ind.targetEntity.height || 40) * 0.5 * zoom, 24 * zoom, 0, Math.PI * 2);
        ctx.strokeStyle = ind.isValidTarget ? '#22c55e' : '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Guide line from hero origin to target entity
        ctx.beginPath();
        ctx.moveTo(origin.sx, origin.sy);
        ctx.lineTo(tgt.sx, tgt.sy);
        ctx.strokeStyle = ind.isValidTarget ? 'rgba(34, 197, 94, 0.45)' : 'rgba(239, 68, 68, 0.45)';
        ctx.lineWidth = 1.5;
        if (ctx.setLineDash) ctx.setLineDash([4, 4]);
        ctx.stroke();
        if (ctx.setLineDash) ctx.setLineDash([]);
      }
    } else if (ind.type === IndicatorType.SELF_AOE) {
      const origin = worldToScreen(ind.origin.x, ind.origin.y, 0, camera, zoom, vp);
      ctx.beginPath();
      ctx.ellipse(origin.sx, origin.sy, ind.radius * 0.5 * zoom, ind.radius * 0.25 * zoom, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(168, 85, 247, 0.2)';
      ctx.fill();
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
```

---

#### Chunk 4: `src/ui/hud.js` — Minimap Camera Frustum Resolution

**StartLine**: 170  
**EndLine**: 182  

**TargetContent**:
```javascript
    if (camera) {
      const vp = { width: viewportWidth, height: viewportHeight };
      const tl = screenToWorld(0, 0, camera, zoom, vp);
      const tr = screenToWorld(viewportWidth, 0, camera, zoom, vp);
      const br = screenToWorld(viewportWidth, viewportHeight, camera, zoom, vp);
      const bl = screenToWorld(0, viewportHeight, camera, zoom, vp);

      const p0 = this.worldToMap(tl.wx, tl.wy);
      const p1 = this.worldToMap(tr.wx, tr.wy);
      const p2 = this.worldToMap(br.wx, br.wy);
      const p3 = this.worldToMap(bl.wx, bl.wy);
```

**ReplacementContent**:
```javascript
    if (camera) {
      const vw = camera.viewportWidth || viewportWidth;
      const vh = camera.viewportHeight || viewportHeight;
      const z = camera.zoom ?? zoom;
      const vp = { width: vw, height: vh };
      const tl = screenToWorld(0, 0, camera, z, vp);
      const tr = screenToWorld(vw, 0, camera, z, vp);
      const br = screenToWorld(vw, vh, camera, z, vp);
      const bl = screenToWorld(0, vh, camera, z, vp);

      const p0 = this.worldToMap(tl.wx, tl.wy);
      const p1 = this.worldToMap(tr.wx, tr.wy);
      const p2 = this.worldToMap(br.wx, br.wy);
      const p3 = this.worldToMap(bl.wx, bl.wy);
```

---

## 5. Verification Method

### 5.1 Verification Commands

1. **Verify Pass 1 Seamless Tesselation (Reviewer 1 Verification Script)**:
   ```pwsh
   node -e "import('./src/render/renderer.js').then(async ({ Renderer }) => { const { Camera } = await import('./src/core/camera.js'); const drawn = []; const mockCtx = { beginPath: () => {}, moveTo: (x, y) => drawn.push({ x, y }), lineTo: () => {}, closePath: () => {}, fill: () => {}, stroke: () => {} }; const renderer = new Renderer({ width: 1280, height: 720, getContext: () => mockCtx }); const camera = new Camera({ worldX: 650, worldY: 650, viewportWidth: 1280, viewportHeight: 720 }); renderer.pass1_Terrain(mockCtx, camera, 1.0); console.log('Tiles drawn:', drawn.length); if (drawn.length < 500) throw new Error('Viewport starved! Expected >500 tiles, got ' + drawn.length); console.log('PASS: Seamless terrain grid populated.'); });"
   ```
   **Expected**: Exit code 0, prints `Tiles drawn: 1156`, `PASS: Seamless terrain grid populated.`

2. **Verify Decal & Targeting Alignment**:
   ```pwsh
   node -e "import('./src/render/renderer.js').then(async ({ Renderer }) => { import('./src/core/isometric.js').then(({ worldToScreen }) => { const camera = { worldX: 650, worldY: 650, x: 0, y: 325, zoom: 1.0 }; const hero = worldToScreen(650, 650, 0, camera); const target = worldToScreen(650 + 600, 650, 0, camera); const dx = Math.abs(target.sx - hero.sx); console.log('Target screen dx:', dx); if (Math.abs(dx - 300) > 1e-4) throw new Error('Target dx expected 300, got ' + dx); console.log('PASS: Target endpoint matches horizontal radius 300px.'); }); });"
   ```
   **Expected**: Exit code 0, `Target screen dx: 300`, `PASS: Target endpoint matches horizontal radius 300px.`

3. **Verify Minimap Frustum Diamond**:
   ```pwsh
   node -e "import('./src/ui/hud.js').then(async ({ Minimap }) => { const minimap = new Minimap(); const camera = { worldX: 1600, worldY: 1600, x: 0, y: 800, viewportWidth: 1280, viewportHeight: 720, zoom: 1.0 }; const drawn = []; const mockCtx = { clearRect: () => {}, fillRect: () => {}, beginPath: () => {}, moveTo: (x, y) => drawn.push({ x, y }), lineTo: (x, y) => drawn.push({ x, y }), closePath: () => {}, stroke: () => {}, fill: () => {}, arc: () => {} }; minimap.ctx = mockCtx; minimap.render({}, camera, 1.0, 1280, 720); const p0 = drawn[drawn.length - 4]; const p2 = drawn[drawn.length - 2]; const width = Math.hypot(p2.x - p0.x, p2.y - p0.y); console.log('Frustum diagonal:', width.toFixed(1)); if (width < 100) throw new Error('Frustum too small: ' + width); console.log('PASS: Visible frustum diamond confirmed.'); });"
   ```
   **Expected**: Exit code 0, prints `Frustum diagonal: 170.3`, `PASS: Visible frustum diamond confirmed.`

4. **Verify Automated Test Suite**:
   ```pwsh
   node tests/runner.js
   ```
   Must exit with code 0 and all 115 tests passing.

5. **Verify Adversarial Stress Suite**:
   ```pwsh
   node tests/stress_m1_math.js
   ```
   Must exit with code 0 and all 203 checks passing.

### 5.2 Invalidation Conditions
- Any gap $> 0$ px or spacing $\ne 32$ px / $16$ px between adjacent diamond tiles in Pass 1.
- Any targeting preview endpoint deviating by more than ability range from hero origin.
- Minimap camera frustum polygon having width $< 50$ px or collapsing to a subpixel speck.
- Any test failures in `node tests/runner.js` or `node tests/stress_m1_math.js`.
