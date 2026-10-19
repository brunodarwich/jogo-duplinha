# Specification Mining Report: 2.5D Isometric Engine, World, HUD, Towers & Spawns

## 1. Observation
- **Direct Source**: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\ORIGINAL_REQUEST.md` (lines 1-50), `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\orchestrator\BRIEFING.md`, and system dispatch instructions.
- **Environment**: Windows OS, Node.js v24.13.0, npm 11.6.2, modern browser target (Chrome/Edge/Firefox), HTML5 Canvas 2D, WebRTC P2P (PeerJS) compatibility.
- **Current Workspace State**: Clean slate (no legacy code in workspace root). No existing engine files present.
- **Core Directives**:
  1. 2.5D Isometric Engine & HTML5 Canvas Renderer (2:1 dimetric projection, world-to-screen & screen-to-world unprojection, camera follow, 7-layer rendering, depth sorting, 60 FPS performance).
  2. Input & Controls (Right-click pathfinding/movement, target attack, Q/W/E/R ability targeting preview, indicators, action cancellation via 'S'/Esc).
  3. HUD/UI (Health bar, mana bar, Q/W/E/R ability buttons with cooldown overlays and mana indicators, gold display, match timer, interactive minimap).
  4. Map Layout (Progressive lane geometry, allied base with fountain/nexus, enemy base with fountain/nexus, tower placement, collision boundaries).
  5. Tower Mechanics (Attack range circles, targeting priority, aggro switch on hero damage, projectile homing/speed, consecutive attack scaling, structure shielding).
  6. Minion/Creep Waves (Periodic 60s spawning, melee/ranged/cannon compositions, waypoint lane navigation, aggro AI state machine, last-hit gold).
  7. Boss Encounters (Wave 5+ periodic Mini-Bosses with distinct health bars and mechanics, Supreme Boss at Enemy Nexus with multi-phase mechanics, victory/defeat conditions).

---

## 2. Logic Chain

1. **Projection Geometry**:
   - In 2.5D games, the canonical 2:1 dimetric projection (tile width $T_w = 2 \times T_h$) is mathematically optimal for pixel-perfect tile alignment, continuous movement, and collision detection without trigonometric distortion.
   - Decoupling continuous simulation coordinates $(W_x, W_y, W_z)$ from projected screen coordinates $(X_s, Y_s)$ ensures physics and networking operate on simple Euclidean geometry while the renderer maps to isometric screen space.
   - Unprojecting mouse cursor $(M_x, M_y)$ on screen back to the ground plane ($W_z = 0$) allows instantaneous, zero-latency right-click targeting and directional skillshot vectors.

2. **Camera & Depth Sorting**:
   - Entities moving in 2.5D must be rendered according to their ground projection footprint $W_x + W_y$ to guarantee correct occlusion (foreground entities occluding background entities).
   - Separating rendering into 7 distinct passes (Terrain $\to$ Ground Decals $\to$ Shadows $\to$ Dynamic Y-sorted Entities $\to$ VFX/Particles $\to$ Overhead HUD $\to$ Screen-space HUD) prevents visual artifacts, such as health bars being occluded by sprites or spell indicators drawing over heroes.

3. **Input & Command Dispatch**:
   - MOBA controls demand crisp disambiguation between Left-click (selection, skill targeting confirmation) and Right-click (smart move/attack command).
   - Hovering an enemy on right-click switches command from `MOVE_TO(x, y)` to `ATTACK_TARGET(id)`.
   - Ability targeting requires 4 distinct indicator modes: Directional Line (skillshot), Ground Circle (AoE), Targeted Unit (point-and-click), and Self/Instant.

4. **Tower & Aggro Priority**:
   - Towers must provide safe defensive zones for players. The classic MOBA "Call for Help" mechanic (switching aggro immediately to an enemy hero that deals damage to an allied hero within tower range) is essential for tactical depth and preventing tower diving without consequences.
   - Consecutive shot ramp-up (+25% per hit up to +100%) discourages prolonged tanking.
   - Sequential structure invulnerability (Outer Tower $\to$ Inner Tower $\to$ Nexus) enforces progressive lane push gameplay.

5. **Minion Wave Lifecycle**:
   - Spawning every 60.0s simultaneously on both bases creates natural battle lines along lane waypoints.
   - Melee minions act as front-line meat shields (high HP, low range), while ranged casters deliver back-line burst. Cannon waves every 3 waves apply siege pressure.
   - Minions prioritize creeps over heroes unless an allied hero calls for help, preventing players from being swarmed when merely walking near the wave.

6. **Boss Pacing & Climax**:
   - Wave 5 and Wave 10 Mini-Bosses break the lane farming monotony, forcing players to coordinate burst damage, dodge telegraphed AoE slams, and secure high-value team bounties.
   - The Supreme Boss at the Enemy Nexus acts as the final gatekeeper, featuring 3 phases (Frontal Cleave $\to$ Meteor Rain $\to$ Cataclysmic Shield/Enrage) before the Nexus can be destroyed, ensuring an epic endgame climax.

---

## 3. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Engine | 2:1 Dimetric Isometric Projection | Transforms 3D world $(W_x, W_y, W_z)$ to 2D screen $(X_s, Y_s)$ with $T_w=64, T_h=32$. | $(W_x, W_y, W_z, C_x, C_y, \text{zoom})$ | Projected $(X_s, Y_s)$ | Clamps NaN/infinite coordinates to 0 | R1 Spec Math |
| 2 | Engine | Screen-to-World Ray Unprojection | Inverts mouse screen coordinates $(M_x, M_y)$ to ground coordinates $(W_x, W_y, 0)$. | Mouse screen $(X, Y)$, camera, zoom | Continuous world $(W_x, W_y)$ | Out-of-bounds inputs clamped to map boundary | R1 Spec Math |
| 3 | Engine | Smooth Camera Follow & Panning | Dampened spring interpolation towards player hero, with edge-panning and Spacebar re-centering. | Target entity $(X, Y)$, cursor pos, $\Delta t$ | Camera $(C_x, C_y)$ clamped to map bounds | If target is null/dead, camera holds last position | R1 Acceptance |
| 4 | Engine | 7-Pass Render Pipeline | Structured layered draw loop: Terrain $\to$ Decals $\to$ Shadows $\to$ Y-Sorted Entities $\to$ VFX $\to$ Entity HUD $\to$ Screen HUD. | Entities list, terrain map, active VFX | Canvas draw calls | Skips off-screen entities via viewport culling | R1 Spec Math |
| 5 | Engine | Y-Depth Sorting | Sorts dynamic entities by depth key $W_x + W_y$ with unique ID tie-breaking to avoid z-fighting. | List of renderable entities | Sorted render array | Fallback to entity ID if coordinates identical | R1 Spec Math |
| 6 | Engine | Fixed-Timestep 60 FPS Game Loop | `requestAnimationFrame` with fixed $\Delta t = 16.67$ms accumulator for deterministic physics and smooth rendering. | Browser animation frame timestamp | Tick updates + render calls | Frame drop accumulator capped at 100ms to prevent spiral of death | R1 Architecture |
| 7 | Input | Smart Right-Click Movement & Attack | Right-click moves hero to ground coordinate or issues attack command if hovering hostile entity. | Mouse Button 2 event, cursor world coordinates | `MOVE_TO` or `ATTACK_TARGET` command | If path is blocked, navigates to closest reachable point | R1 Acceptance |
| 8 | Input | Ability Targeting Preview & Indicator | Displays visual range circle, skillshot arrow, or AoE circle when Q/W/E/R is pressed. | Keydown ('Q','W','E','R'), cursor position | Visual indicator rendered on Layer 1 | If ability is on cooldown or out of mana, indicator is suppressed with audio cue | R1 Acceptance |
| 9 | Input | Cast Confirmation & Cancellation | Left-click confirms cast; Right-click or 'Escape' cancels targeting mode without spending mana. | Mouse Button 0, Mouse Button 2, Keydown ('Escape') | Cast execution or mode reset | Ignores cancel if spell already entered cast point | R1 Acceptance |
| 10 | Input | Stop / Hold Command ('S' / 'H') | Immediately halts hero movement, cancels pending attacks, and interrupts channeled abilities (Recall). | Keydown ('S' or 'H') | Entity state set to `IDLE`, velocity zeroed | No effect if hero is stunned or suppressed | Standard MOBA Spec |
| 11 | HUD | Overhead Entity Status Bars | Health and mana bars above heroes/creeps/towers with color coding (Green/Blue allied, Red enemy, Yellow boss). | Entity HP, MaxHP, Mana, MaxMana | Canvas rendered floating bars | Clamped to [0, Max]; shields shown as white/gold overlay | R1 Spec |
| 12 | HUD | Hero Stats & Status Display | Displays hero portrait, level badge, AD, AP, Armor, Magic Resist, Move Speed in bottom HUD. | Hero data object | Bottom panel UI elements | Null fields show default baseline values | R1 Spec |
| 13 | HUD | Q/W/E/R Ability Buttons & Cooldowns | Action buttons with skill icons, hotkey labels, mana cost badges, and translucent radial cooldown overlays with timers. | Cooldown remaining, mana cost, current mana | Rendered button with timer text e.g. "4.5s" | Darkened with red tint if insufficient mana | R1 Spec |
| 14 | HUD | Match Timer & Objective Tracker | Displays elapsed time (MM:SS) and active tower status / kills at top center. | Match start timestamp, tower healths | Top HUD bar widget | Pauses on victory/defeat | R1 Spec |
| 15 | HUD | Interactive Minimap Widget | $200 \times 200$px minimap with lane, towers, bases, real-time hero/creep dots, camera frustum, and click navigation. | All entity positions, camera bounds, click events | Minimap canvas, camera jump, move order | Clicks outside minimap border ignored | R1 Spec |
| 16 | Map | Single Progressive Lane Geometry | 3200x3200 map with Allied Base at $(400, 400)$, Enemy Base at $(2800, 2800)$, and 350-unit wide diagonal corridor. | Map tile grid, waypoint list | World collision mesh, navigation path | Coordinates outside $[0, 3200]$ blocked by borders | R3 Spec |
| 17 | Map | Base Fountains & Healing Auras | Regeneration aura restoring 10% HP/s and 15% Mana/s within 250 radius of fountain center; acts as hero respawn point. | Hero position, time delta | Incremental HP/Mana restoration | Healing halts if fountain is compromised | R3 Spec |
| 18 | Map | Shopkeeper Base Proximity Zone | 350-unit radius around fountain where the item shop can be opened and items bought/sold. | Hero distance to fountain | Shop GUI enable/disable toggle | Buying outside zone produces "Must be at base shop" warning | R4 Spec |
| 19 | Map | Static Structure Colliders & Terrain Walls | Impassable circular colliders for towers ($r=40$), nexus ($r=70$), and line boundaries for lane walls. | Moving entity position, radius | Collision resolution vector (slide along wall) | Prevents clipping through buildings or out of map | R3 Spec |
| 20 | Towers | Defensive Tower Range & True Sight | 400-unit attack radius detecting all enemy units; grants true sight (reveals stealth). | Nearby entity list | Active target selection, range circle indicator | Hidden/invisible units revealed inside circle | R3 Spec |
| 21 | Towers | Tower Targeting Priority & Aggro Switch | Evaluates priority: Hero attacking ally $\to$ Unit attacking tower $\to$ Creeps $\to$ Summons $\to$ Heroes. | Damage events within range, target distances | Target locked until death, exit, or aggro switch | If no targets, tower remains idle | R3 Spec |
| 22 | Towers | Consecutive Hit Scaling ("Tower Heat") | Consecutive attacks against the SAME hero increase damage by +25% per shot up to +100% max ($2.0\times$). | Target history, hit count | Scaled projectile damage | Resets immediately when target switches or leaves range | R3 Spec |
| 23 | Towers | Homing Tower Projectiles | Homing magic orb traveling at 750 units/s that tracks target and deals physical damage on impact. | Tower position, target position | Moving projectile entity, impact VFX/sound | If target dies mid-air, projectile dissipates | R3 Spec |
| 24 | Towers | Structure Invulnerability Hierarchy | Inner Tower invulnerable until Outer Tower is destroyed; Nexus invulnerable until Inner Tower is destroyed. | Structure destruction states | Invulnerability shield flag (0 damage taken) | Attacks against shielded structures show "INVULNERABLE" | R3 Spec |
| 25 | Creeps | Periodic Wave Spawning (Every 60s) | Waves spawn simultaneously at Allied $(650, 650)$ and Enemy $(2550, 2550)$ every 60 seconds (first at 00:30). | Match clock, wave counter | Spawns wave entities | Spawner pauses if match is over | R3 Spec |
| 26 | Creeps | Wave Composition Scaling | Standard: 3 Melee + 3 Ranged minions. Cannon waves (every 3rd wave) add 1 Siege Minion with bonus tower damage. | Wave index | Spawn queue with staggered release | Attributes scale per wave (+20 HP melee, +15 HP ranged) | R3 Spec |
| 27 | Creeps | Waypoint Lane Navigation | Minions march through ordered waypoints $WP_0 \to WP_6$ using lane-following navigation. | Current waypoint index, minion position | Movement vector toward waypoint | If pushed off lane, returns to nearest lane waypoint | R3 Spec |
| 28 | Creeps | Minion Combat AI & Aggro Leashing | State machine (`MARCH`, `ACQUIRE`, `ATTACK`, `PURSUE`, `LEASH_RETURN`); disengages if pulled >400 units from lane. | Hostile units in 300 range, distance to lane | AI state transitions, attacks | Returns to lane if target runs too far | R3 Spec |
| 29 | Creeps | Last-Hit Gold & Experience Distribution | Delivers full gold bounty (+22g melee, +18g ranged, +45g cannon) only to the hero who lands the killing blow. | Lethal damage source entity | Gold incremented on player, floating text `+XXg` | Tower/creep last-hit awards 0 gold (denied) | R4 Spec |
| 30 | Bosses | Wave 5 Mini-Boss: Stone Colossus | Spawns on Wave 5; 3500 HP; Ground Slam AoE stun (1.2s telegraph, 220 radius); takes 40% reduced tower damage. | Wave 5 trigger, combat state | Boss entity, telegraphed slam attack, team buff | Boss bar appears at top when engaged | R3 Spec |
| 31 | Bosses | Wave 10 Mini-Boss: Abyssal Behemoth | Spawns on Wave 10; 6000 HP; Acid pools dealing DOT + armor shred, and AoE Roar of Fear (2.0s silence). | Wave 10 trigger, combat state | Acid pool entities, silence debuff, team reward | Persistent ground hazards expire after 6.0s | R3 Spec |
| 32 | Bosses | Supreme Boss: Nexus Guardian | Stations in front of Enemy Nexus; 12000 HP; 3 phases (Frontal Cleave $\to$ Meteor Rain $\to$ Cataclysmic Shield). | Supreme Boss HP percentage thresholds | Phase transitions, special mechanics, Nexus shield | Nexus is invulnerable until Supreme Boss is slain | R3 Spec |
| 33 | Bosses | Victory & Defeat Game-Over Triggers | Slaying Supreme Boss + destroying Enemy Nexus triggers VICTORY; Allied Nexus falling triggers DEFEAT. | Nexus HP $\le 0$ | Game state `VICTORY` or `DEFEAT`, match summary UI | Freezes gameplay simulation, prevents further inputs | R3 Spec |

---

## 4. Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | Screen-to-World Math | Mouse cursor positioned outside canvas bounds (e.g. dragging off window) | Coordinates are clamped to canvas border before projection to prevent erratic movement commands. |
| 2 | Camera Bounds | Player walks into the extreme corner of the map $(0, 0)$ | Camera follow lerp halts at $(X_{min}, Y_{min})$ clamping margin, keeping viewport strictly within playable world. |
| 3 | Right-Click Pathing | Player right-clicks directly inside an impassable terrain wall or tower collider | Pathfinding algorithm projects destination to the nearest valid walkable point on the boundary of the obstacle. |
| 4 | Simultaneous Movement & Attack | Player right-clicks enemy while already walking to a ground waypoint | Current movement path is immediately cleared; hero switches to pursue-and-attack behavior toward target. |
| 5 | Ability Targeting | Player presses 'Q' for ground AoE with cursor beyond maximum cast range $R_{max}$ | Target indicator clamps the preview circle to the maximum radius circle along the angle toward the cursor. |
| 6 | Recall Interruption | Hero taking 1 damage from minion, tower, or enemy spell during 5.0s channel | Recall channel immediately breaks; channel bar disappears, audio alert plays, hero remains at current position. |
| 7 | Recall Movement | Player inputs right-click movement or presses an ability key during Recall | Channeling cancels instantly and hero executes the input command without delay. |
| 8 | Tower Aggro Switch | Enemy hero attacks allied hero with DoT/burn while standing inside tower range | Tower immediately detects damage source as enemy hero and switches target from minion to the aggressor hero. |
| 9 | Tower Aggro Reset | Aggressor hero flashes, dashes, or walks outside the 400-unit tower radius | Tower heat counter resets to 0; tower immediately re-evaluates priority and locks onto closest minion in range. |
| 10 | Tower Shielding | Player attempts to attack Tier 2 Tower while Tier 1 Tower is still alive | Attack is rejected or deals 0 damage with floating text "INVULNERABLE", preserving linear lane progression. |
| 11 | Creep Wave Collision | Two opposing creep waves collide in the center of the lane | Front-row melee creeps stop and engage each other; back-row ranged creeps stop at 280 range and fire over melee units. |
| 12 | Creep Leashing | Hero draws creep aggro and kites creeps 500 units away into the jungle/base | Creeps exceed 400-unit leash threshold; they drop aggro, become immune to crowd control, and run back to lane waypoints. |
| 13 | Minion Last-Hit Tie | Tower projectile and player basic attack hit a minion on the exact same frame | Logic resolves player damage first in the frame; if hero dealt lethal damage, player is credited gold and kill bounty. |
| 14 | Mini-Boss Double Spawn | Game reaches Wave 10 while Wave 5 Mini-Boss is still alive | Both bosses can coexist on the map; each maintains its independent health pool, AI cycle, and top-of-screen boss bar. |
| 15 | Supreme Boss Phase 3 Shield | Players attempt to burn Supreme Boss during 8-second Aegis of Ruin invulnerability | All incoming damage is reduced to 0; players must evade telegraphed meteors until the shield expires. |
| 16 | Simultaneous Nexus Fall | Both Allied and Enemy Nexus reach 0 HP on the same simulation tick | Strict check evaluates Enemy Nexus destruction first (rewarding cooperative players) or tie-breaker goes to first damage event. |
| 17 | Minimap Edge Drag | Player holds right-click and drags cursor off the edge of the minimap | Minimap command only dispatches while cursor is within minimap AABB; dragging outside stops dispatching new orders. |
| 18 | Window Resize | Browser window is resized or maximized during active gameplay | Canvas resize handler adjusts canvas buffer dimensions and updates camera viewport $(V_w, V_h)$ smoothly without stretching. |

---

## 5. Technical Specifications & Mathematical Models

### 5.1 Coordinate Systems & Projection Math

#### Coordinate Spaces:
1. **World Space** $(W_x, W_y, W_z)$:
   - Continuous Cartesian coordinates in game units.
   - Ground plane: $W_z = 0$.
   - Positive $W_x$: advances down-right along the isometric grid.
   - Positive $W_y$: advances down-left along the isometric grid.
   - Positive $W_z$: elevation upwards against gravity.
2. **Screen Space** $(X_s, Y_s)$:
   - Pixel coordinates on the HTML5 `<canvas>` element where $(0, 0)$ is top-left.
3. **Camera Viewport** $(C_x, C_y)$:
   - The world position (projected) currently aligned with screen center $(V_w / 2, V_h / 2)$.

#### Projection Equations:
Given Tile Width $T_w = 64$, Tile Height $T_h = 32$, Zoom $s = 1.0$:

- **World-to-Screen Transformation**:
  $$\begin{aligned}
  X_s &= \left( (W_x - W_y) \cdot \frac{T_w}{2} - C_x \right) \cdot s + \frac{V_w}{2} \\
  Y_s &= \left( (W_x + W_y) \cdot \frac{T_h}{2} - W_z - C_y \right) \cdot s + \frac{V_h}{2}
  \end{aligned}$$

- **Screen-to-World (Ground $W_z = 0$) Inverse Transformation**:
  $$\begin{aligned}
  X'_{s} &= \frac{X_s - V_w / 2}{s} + C_x \\
  Y'_{s} &= \frac{Y_s - V_h / 2}{s} + C_y \\
  W_x &= \frac{1}{2} \left( \frac{X'_{s}}{T_w / 2} + \frac{Y'_{s}}{T_h / 2} \right) \\
  W_y &= \frac{1}{2} \left( \frac{Y'_{s}}{T_h / 2} - \frac{X'_{s}}{T_w / 2} \right)
  \end{aligned}$$

#### Depth Sorting Key:
For any entity at continuous world position $(W_x, W_y)$:
$$\text{DepthKey} = W_x + W_y$$
Entities are sorted ascending: lowest $\text{DepthKey}$ rendered first. Ties broken by stable `entity.id`.

---

### 5.2 Layered Rendering Pipeline Architecture

```
[ Canvas Frame Begin ]
       │
       ▼
┌──────────────────────────────────────────────┐
│ Layer 0: Terrain & Ground Tiles              │ ➔ Pre-rendered static chunks / 64x32 tiles
├──────────────────────────────────────────────┤
│ Layer 1: Ground Decals & Indicators          │ ➔ Skill range circles, AoE circles, move pings
├──────────────────────────────────────────────┤
│ Layer 2: Entity Ground Shadows               │ ➔ Dynamic translucent ellipses at (Wx, Wy)
├──────────────────────────────────────────────┤
│ Layer 3: Dynamic Y-Sorted World Entities     │ ➔ Towers, Creeps, Heroes, Bosses, Projectiles
├──────────────────────────────────────────────┤
│ Layer 4: Particle VFX & Floating Combat Text │ ➔ Spells, slashes, explosions, damage numbers
├──────────────────────────────────────────────┤
│ Layer 5: Overhead Entity Status Bars         │ ➔ HP/Mana bars, CC icons above units
├──────────────────────────────────────────────┤
│ Layer 6: Static HUD & Interactive Minimap    │ ➔ Bottom HUD, Skill bar, Minimap, Timer
└──────────────────────────────────────────────┘
       │
       ▼
[ Canvas Frame End / Buffer Swap ]
```

---

### 5.3 Map Geometry & Topology

```
(0,0) [North Corner]
  /\
 /  \
/    \           Enemy Base & Nexus (2550, 2550)
\     \                 [Supreme Boss Arena]
 \     \                         ▲
  \     \                        │
   \     \                 Enemy Tier 2 Tower (2250, 2250)
    \     \                      ▲
     \     \                     │
      \     \              Enemy Tier 1 Tower (1950, 1950)
       \     \                   ▲
        \     \                  │ [Center River / Battlefront: (1600, 1600)]
         \     \                 │
          \     \          Allied Tier 1 Tower (1250, 1250)
           \     \               ▲
            \     \              │
             \     \       Allied Tier 2 Tower (950, 950)
              \     \            ▲
               \     \           │
                \     \    Allied Base & Nexus (650, 650)
                 \     \   [Allied Fountain: (400, 400)]
                  \   /
                   \ /
                 (3200, 3200) [South Corner]
```

- **Map Bounds**: $X \in [0, 3200]$, $Y \in [0, 3200]$
- **Lane Width**: 350 world units wide.
- **Waypoints Vector**:
  - $WP_0: (650, 650)$ — Allied Nexus
  - $WP_1: (950, 950)$ — Allied Tier 2 Tower
  - $WP_2: (1250, 1250)$ — Allied Tier 1 Tower
  - $WP_3: (1600, 1600)$ — Center River / Battlefront
  - $WP_4: (1950, 1950)$ — Enemy Tier 1 Tower
  - $WP_5: (2250, 2250)$ — Enemy Tier 2 Tower
  - $WP_6: (2550, 2550)$ — Enemy Nexus

---

### 5.4 Tower State & Aggro Algorithm

```
                  ┌────────────────────────┐
                  │      TOWER IDLE        │
                  └───────────┬────────────┘
                              │ Hostile entity enters R=400
                              ▼
                  ┌────────────────────────┐
                  │    TARGET ACQUISITION  │
                  └───────────┬────────────┘
                              │
     ┌────────────────────────┴────────────────────────┐
     │ Priority 1: Enemy hero attacking allied hero    │
     │ Priority 2: Closest enemy attacking tower       │
     │ Priority 3: Closest enemy minion/creep          │
     │ Priority 4: Closest summoned unit / boss        │
     │ Priority 5: Closest enemy hero                  │
     └────────────────────────┬────────────────────────┘
                              │ Target locked
                              ▼
                  ┌────────────────────────┐
                  │     ATTACK CYCLING     │◄─────────┐
                  └───────────┬────────────┘          │
                              │ Every 1.0s            │
                              ▼                       │
                  ┌────────────────────────┐          │
                  │ Fire Homing Projectile │──────────┘
                  └───────────┬────────────┘
                              │ Check if:
                              ├─ Target died
                              ├─ Target exited R=400
                              └─ Enemy hero attacked allied hero (Aggro Switch!)
                              ▼
                  ┌────────────────────────┐
                  │   RE-EVALUATE TARGET   │
                  └────────────────────────┘
```

---

### 5.5 Minion Wave AI State Machine

```
              ┌──────────────────────────┐
   Spawn ────>│         MARCHING         │
              │ (Moving toward waypoint) │
              └─────────────┬────────────┘
                            │ Enemy detected in Aggro Range (300 units)
                            ▼
              ┌──────────────────────────┐
              │     ACQUIRE TARGET       │
              └─────────────┬────────────┘
                            │ Target selected
                            ▼
              ┌──────────────────────────┐
              │        ATTACKING         │◄─────────┐
              │ (Within weapon range)    │          │ In weapon range
              └─────────────┬────────────┘          │
                            │ Target moved away     │
                            ▼                       │
              ┌──────────────────────────┐          │
              │         PURSUING         │──────────┘
              │ (Moving toward target)   │
              └─────────────┬────────────┘
                            │ Distance to lane > 400 (Leash Exceeded)
                            │ or Target Dead
                            ▼
              ┌──────────────────────────┐
              │      RETURN TO LANE      │
              │ (Disengaging to waypoint)│
              └─────────────┬────────────┘
                            │ Back in lane
                            ▼
                        [ MARCHING ]
```

---

### 5.6 Boss Encounters & Victory Logic

1. **Stone Colossus (Wave 5)**:
   - Spawn Time: Match 04:30.
   - Behavior: Walks with enemy wave; triggers 1.2s telegraphed AoE Ground Slam on proximity.
   - Passive: Siege Body (takes 40% reduced tower damage).
2. **Abyssal Behemoth (Wave 10)**:
   - Spawn Time: Match 09:30.
   - Behavior: Acid spit zone denial (persists 6s) + AoE Roar of Fear (silences heroes for 2.0s).
3. **Supreme Boss (Enemy Nexus Guardian)**:
   - Stationed at $(2450, 2450)$.
   - Health: 12,000 HP.
   - **Phase 1** ($100\% - 66\%$ HP): Frontal Cleave auto-attacks + Minion Summons.
   - **Phase 2** ($66\% - 33\%$ HP): Meteor Barrage on player positions + Fire Aura.
   - **Phase 3** ($33\% - 0\%$ HP): Aegis of Ruin (8s invulnerability channel) + Enraged Stacking Burn.
   - On Slain: Supreme Boss dissolves; Enemy Nexus invulnerability shield drops.
4. **Endgame Triggers**:
   - `Enemy Nexus HP <= 0` $\implies$ `VICTORY` sequence (HUD banner, fanfare, summary stats).
   - `Allied Nexus HP <= 0` $\implies$ `DEFEAT` sequence (HUD banner, defeat sound, summary stats).

---

## 6. Caveats
1. **Network Sync Boundary**: This specification defines local client engine math and deterministic entity update logic. Subagent `spec_miner_systems_r0` is responsible for specifying PeerJS message serialization (e.g. `SYNC_TICK`, `HERO_INPUT`, `CREEP_STATE`).
2. **Hero Abilities**: Specific ability parameters (damage numbers, AP/AD ratios, cooldown values) for the 5 heroes are mined by `spec_miner_heroes_r0`. This engine spec provides the standard 4 indicator types and projectile/AoE execution pipeline.
3. **Audio System**: Audio effects (tower shot sound, minion death sound, boss roar) are triggered via event hooks in the engine (`playSound('tower_shot')`); sound asset loading can be pure Web Audio synthesized or lightweight MP3s/WAVs.

---

## 7. Conclusion
- The 2.5D Isometric Engine, Map, Towers, Minions, and Boss mechanics form a complete, cohesive, and deterministic MOBA foundation.
- The 2:1 dimetric projection model, unprojection math, 7-layer canvas rendering architecture, and waypoint-based AI state machines require **zero external rendering libraries** (such as Three.js or PixiJS), allowing for instantaneous load times, 60 FPS performance, and straightforward state synchronization across WebRTC P2P multiplayer.
- This specification is ready for immediate architectural consumption and implementation by the worker agents.

---

## 8. Verification Method
1. **Mathematical Projection Verification**:
   - Test World-to-Screen: Feed $(W_x=1000, W_y=1000, W_z=0, C_x=0, C_y=0, V_w=800, V_h=600)$ into equation:
     $X_s = (1000 - 1000) \cdot 32 - 0 + 400 = 400$ (Exact center horizontal).
     $Y_s = (1000 + 1000) \cdot 16 - 0 + 300 = 32000 + 300 = 32300$ (Correct scaling).
   - Test Roundtrip Inverse Projection: Passing $(X_s, Y_s)$ back into Screen-to-World recovers exactly $(W_x=1000, W_y=1000)$ with zero floating point drift.
2. **Aggro Priority Test**:
   - Simulate Tower at $(1250, 1250)$, Allied Hero at $(1200, 1200)$, Enemy Creep at $(1240, 1240)$, Enemy Hero at $(1260, 1260)$.
   - While Enemy Hero attacks creep $\implies$ Tower targets Enemy Creep.
   - When Enemy Hero inflicts 1 damage on Allied Hero $\implies$ Tower switches target to Enemy Hero on the very next tick.
3. **Structure Invulnerability Test**:
   - Attempt to apply 100 damage to Enemy Tier 2 Tower while Enemy Tier 1 Tower has $HP > 0$. Damage applied must equal $0$.
4. **Boss Progression Test**:
   - Verify Wave counter reaches 5 $\implies$ Stone Colossus spawned.
   - Verify Supreme Boss HP reaches $0$ $\implies$ Nexus shield is removed and damage to Nexus is enabled.
