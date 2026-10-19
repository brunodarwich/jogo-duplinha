# Project: MOBA Duplinha 2.5D Isometric Co-op

## Architecture

### System Architecture Overview
A 2.5D isometric cooperative MOBA / Lane Push browser game built with HTML5 Canvas 2D and modern JavaScript (ES Modules). The game supports 1 to 3 players via WebRTC P2P (PeerJS) using a host-authoritative star topology, with a 100% offline solo mode fallback requiring zero network dependencies.

```
                          [ Browser Viewport ]
                                   │
               ┌───────────────────┴───────────────────┐
               ▼                                       ▼
     [ HTML5 Canvas 2D ]                       [ DOM / HUD Overlay ]
  (7-layer isometric render)                (Ability bar, Minimap, Shop)
               │                                       │
               └───────────────────┬───────────────────┘
                                   │
                           [ Game Simulation ]
             (Fixed 60 FPS loop, state updates, collision)
                                   │
         ┌──────────────┬──────────┴───┬──────────────┬──────────────┐
         ▼              ▼              ▼              ▼              ▼
     [ World ]      [ Heroes ]     [ Combat ]     [ Systems ]     [ Netcode ]
  (Map, Towers,   (5 Classes,    (Formulas, CC,  (Gold, Shop,    (PeerJS P2P,
   Minions, Boss)  Passives, QWER) Projectiles)   6-Slot Inv,     Host-Auth,
                                                  5s Recall)      Solo Fallback)
```

### Rendering Pipeline (7 Passes)
1. **Pass 1 (Terrain Grid)**: 2:1 dimetric tiles ($T_w = 64, T_h = 32$), lane ground textures, base grounds.
2. **Pass 2 (Ground Decals & Indicators)**: Ability range rings, skillshot arrows, AoE targeting circles, spawn zones, fountain rings.
3. **Pass 3 (Ground Shadows)**: Elliptical shadows under all dynamic and static units.
4. **Pass 4 (Y-Depth Sorted Entities)**: Dynamic units (heroes, minions, bosses, towers, nexus) sorted strictly by depth key $\text{DepthKey} = W_x + W_y$.
5. **Pass 5 (VFX & Particles)**: Procedural canvas spell animations (fireballs, ice spikes, arrows, smoke, holy light, beams).
6. **Pass 6 (Entity Overhead HUD)**: Floating health bars, mana bars, status icons (stun, taunt, root, silence), channel bars (Recall).
7. **Pass 7 (Screen HUD)**: Bottom ability bar (Q/W/E/R, cooldown sweeps, mana costs), inventory (6 slots), gold counter, match timer, interactive minimap.

---

## Feature Inventory
Every feature identified during Survey Phase 0 is categorized and assigned to an authoritative milestone. No feature is left unassigned.

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | 2:1 Dimetric Isometric Projection | Converts $(W_x, W_y, W_z)$ to canvas screen $(X_s, Y_s)$ | M1 | Engine Spec #1 |
| 2 | Screen-to-World Ray Unprojection | Inverts mouse click $(M_x, M_y)$ to ground coordinates $(W_x, W_y)$ | M1 | Engine Spec #2 |
| 3 | Camera Viewport & Smooth Follow | Dampened camera follow on hero with map boundaries clamping | M1 | Engine Spec #3 |
| 4 | 7-Pass Canvas 2D Render Pipeline | Layered draw loop ensuring proper visual occlusion and depth | M1 | Engine Spec #4 |
| 5 | Dynamic Y-Depth Sorting | Entity sorting by $W_x + W_y$ with ID tie-breaking | M1 | Engine Spec #5 |
| 6 | Deterministic 60 FPS Game Loop | `requestAnimationFrame` with fixed timestep $\Delta t = 16.67$ms | M1 | Engine Spec #6 |
| 7 | Right-Click Smart Move & Target | Pathing to destination or locking attack on hostile units | M1 | Engine Spec #7 |
| 8 | Ability Targeting Previews | Visual range circles, line arrows, and AoE indicators for Q/W/E/R | M1 | Engine Spec #8 |
| 9 | Cast Confirmation & Cancel | Left-click confirms cast; Right-click or Esc cancels targeting | M1 | Engine Spec #9 |
| 10 | Action Halt / Stop Command ('S') | Immediately stops hero, cancels auto-attacks and channels | M1 | Engine Spec #10 |
| 11 | Overhead Health & Mana Bars | Floating status indicators above heroes, minions, and structures | M1 | Engine Spec #11 |
| 12 | Bottom Hero HUD & Stat Panel | Displays Level, Portrait, AD, AP, Armor, MR, and Move Speed | M1 | Engine Spec #12 |
| 13 | Q/W/E/R Ability Buttons & Cooldowns | Radial cooldown clock sweep, mana badges, hotkey triggers | M1 | Engine Spec #13 |
| 14 | Match Timer & Objective Tracker | Elapsed match time (MM:SS) and active tower status display | M1 | Engine Spec #14 |
| 15 | Interactive Minimap Widget | $200 \times 200$ minimap with lane, towers, bases, unit dots, and click nav | M1 | Engine Spec #15 |
| 16 | Progressive Lane Map Geometry | $3200 \times 3200$ map with Allied Base $(400, 400)$ and Enemy Base $(2800, 2800)$ | M2 | Engine Spec #16 |
| 17 | Base Fountains & Regeneration Auras | Rapid +10% HP/s and +15% Mana/s within 250 units of fountain center | M2 | Engine Spec #17 |
| 18 | Structure Colliders & Terrain Walls | Impassable circular collision meshes for towers ($r=40$) and nexus ($r=70$) | M2 | Engine Spec #19 |
| 19 | Defensive Tower Range & True Sight | 400-unit attack radius detecting all enemies and revealing stealth | M2 | Engine Spec #20 |
| 20 | Tower Targeting Priority & Aggro Switch | Prioritizes heroes attacking allies, units attacking tower, then minions | M2 | Engine Spec #21 |
| 21 | Tower Heat Scaling (+25% per hit) | Consecutive attacks on same hero scale damage up to +100% | M2 | Engine Spec #22 |
| 22 | Homing Tower Projectiles | Guided magic projectiles (750 speed) dealing physical damage | M2 | Engine Spec #23 |
| 23 | Structure Invulnerability Hierarchy | Inner Tower protected until Outer falls; Nexus protected until Inner falls | M2 | Engine Spec #24 |
| 24 | Periodic Minion Wave Spawning (60s) | Waves spawn simultaneously at Allied and Enemy bases every 60s | M2 | Engine Spec #25 |
| 25 | Wave Composition Scaling | 3 Melee + 3 Ranged minions; Cannon siege minion every 3rd wave | M2 | Engine Spec #26 |
| 26 | Minion Waypoint Lane Navigation | Minions march down lane waypoints $WP_0 \dots WP_6$ | M2 | Engine Spec #27 |
| 27 | Minion AI & Leash Boundaries | AI state machine (March, Acquire, Attack, Leash Return >400 units) | M2 | Engine Spec #28 |
| 28 | Wave 5 Mini-Boss: Stone Colossus | Spawns wave 5; 3500 HP; Ground Slam AoE stun; -40% tower damage taken | M2 | Engine Spec #30 |
| 29 | Wave 10 Mini-Boss: Abyssal Behemoth | Spawns wave 10; 6000 HP; Acid pools (DOT + armor shred), AoE Silence | M2 | Engine Spec #31 |
| 30 | Supreme Boss: Nexus Guardian | Stations in front of Enemy Nexus; 12000 HP; 3-phase endgame encounter | M2 | Engine Spec #32 |
| 31 | Victory & Defeat Game-Over Triggers | Slaying Supreme Boss + destroying Enemy Nexus = Win; Allied Nexus down = Defeat | M2 | Engine Spec #33 |
| 32 | Combat Damage Mitigation Formulas | Armor and Magic Resist mitigation: $100 / (100 + \text{Resistance})$ | M3 | Heroes Spec #3 |
| 33 | True Damage Calculation | Direct damage bypassing armor and magic resistance completely | M3 | Heroes Spec #3 |
| 34 | Critical Strike & Lifesteal Engine | Critical hit chance multiplier ($2.0\times$) and % physical lifesteal | M3 | Heroes Spec #3 |
| 35 | Crowd Control State Machine Matrix | Handles Stun, Taunt, Root, Silence, Slow, Stealth orthogonality | M3 | Heroes Spec #4 |
| 36 | Canvas Procedural VFX Particle System | Lightweight 60 FPS particle emitters for spells, hits, and auras | M3 | Heroes Spec #5 |
| 37 | Hero 1: Cavaleiro Guardião Complete Kit | Tank: Passive Barrier, Q Shield Slam, W Taunt, E Cleave, R Fortress | M3 | Heroes Spec §3.2 |
| 38 | Hero 2: Feiticeira Elemental Complete Kit | Mage: Passive Overload, Q Fireball, W Frost Nova, E Lightning, R Cataclysm | M3 | Heroes Spec §3.3 |
| 39 | Hero 3: Patrulheiro Arqueiro Complete Kit | Marksman: Passive Focus, Q Piercing Shot, W Volley, E Dash, R Arrow Storm | M3 | Heroes Spec §3.4 |
| 40 | Hero 4: Sombra Assassina Complete Kit | Assassin: Passive Backstab, Q Shadow Strike, W Smoke, E Shuriken, R Death Mark | M3 | Heroes Spec §3.5 |
| 41 | Hero 5: Clérigo da Luz Complete Kit | Support: Passive Grace, Q Holy Heal, W Smite, E Divine Ward, R Sanctuary | M3 | Heroes Spec §3.6 |
| 42 | Hero Selection Screen & Balance Model | Hero picker interface with role descriptions and balanced base stats | M3 | ORIGINAL_REQUEST R2 |
| 43 | Starting Match Gold (500g) | All heroes initialize with 500 gold for starter item purchases | M4 | Systems Spec #1 |
| 44 | Passive Gold Accrual (2.0 gold/sec) | Continuous baseline income for all active heroes | M4 | Systems Spec #2 |
| 45 | Minion Last-Hit Bounties | Melee (+21g), Ranged (+14g), Cannon (+45g) credited on fatal hero blow | M4 | Systems Spec #3-5 |
| 46 | Tower & Boss Objective Bounties | Tower (+100g killer / +150g team), Mini-Boss (+150g killer / +150g team) | M4 | Systems Spec #6-8 |
| 47 | Co-op Proximity Assist Gold (+30%) | Nearby teammates within 400 units receive assist gold share | M4 | Systems Spec #9 |
| 48 | 6-Slot Hero Inventory System | 6 item slots with item data, tooltips, drag/drop, and full handling | M4 | Systems Spec #10 |
| 49 | Real-Time Dynamic Stat Recalculation | Instant recomputation of AD, AP, HP, Armor, MR, MS, Lifesteal, CDR (40% cap) | M4 | Systems Spec #11 |
| 50 | 18-Item Base Shop Catalog | 3-tier catalog covering Tank, Mage, Marksman, Assassin, and Support builds | M4 | Systems Spec #12 |
| 51 | Base Shop Fountain Zone Boundary | Shop enabled only within 250 units radius of allied fountain | M4 | Systems Spec #13 |
| 52 | Item Purchase & 70% Sell Refund | Purchasing items with gold, selling equipped items for 70% refund | M4 | Systems Spec #14-15 |
| 53 | Base Fountain Rapid Regeneration | +10% Max HP/s and +10% Max Mana/s while stationed in fountain | M4 | Systems Spec #17 |
| 54 | 5-Second Recall Channeling (Key B) | Channeled teleport with progress bar and ground visual runes | M4 | Systems Spec #18 |
| 55 | Recall Interruption Logic | Strict cancellation upon taking damage (>0), moving, casting, or CC | M4 | Systems Spec #19 |
| 56 | Recall Teleport Completion | Instant displacement to fountain center upon 5000ms uninterrupted channel | M4 | Systems Spec #20 |
| 57 | Host-Authoritative WebRTC Architecture | Host simulates authoritative world; syncs clients via DataChannels | M5 | Systems Spec #21 |
| 58 | 6-Character Room Code System | Host creates room code; players join cooperative match via code | M5 | Systems Spec #22 |
| 59 | P2P Connection Handshake Protocol | Validates joining players, assigns player slots [0..2], syncs lobby | M5 | Systems Spec #23 |
| 60 | Client Input Command Streaming | Clients stream move, attack, skill, buy, sell, and recall commands to host | M5 | Systems Spec #24 |
| 61 | 20 Hz Authoritative State Snapshots | Host broadcasts delta state (entities, health, mana, cooldowns, positions) | M5 | Systems Spec #25 |
| 62 | Peer Ping / Latency Heartbeat | Periodic RTT latency measurement and disconnect detection | M5 | Systems Spec #26 |
| 63 | Graceful Client Disconnect Handling | Client timeout retains stationary hero without crashing host match | M5 | Systems Spec #27 |
| 64 | Complete Offline Solo Mode Fallback | Zero-latency local simulation loop requiring no network, peer, or server | M5 | Systems Spec #28 |
| 65 | E2E Testing Suite (Tiers 1-4) | Comprehensive opaque-box test suite passing 100% of acceptance criteria | M6 | E2E Testing Track |
| 66 | Adversarial Coverage Hardening (Tier 5) | White-box stress tests, invariant fuzzing, and boundary verification | M6 | Final Hardening |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Engine Foundation, 2.5D Isometric Renderer & HUD | Isometric math, 7-layer canvas renderer, mouse/keyboard input, camera follow, HUD & minimap widgets | none | DONE |
| M2 | Map Geometry, Towers, Minion Waves & Bosses | Progressive lane map, bases, fountains, collision, defensive towers, 60s minion waves, mini-bosses, Supreme Boss, win/loss triggers | M1 | DONE |
| M3 | 5 Playable Heroes, Skills Q/W/E/R, VFX & Combat Engine | 5 heroes (Knight, Sorceress, Ranger, Assassin, Cleric), 25 skills/passives, procedural canvas VFX, combat damage/mitigation math, CC matrix | M1 | IN_PROGRESS |
| M4 | Economy, 6-Slot Inventory, Base Shop & Recall | Last-hit gold, assist gold, 18-item catalog, 6 slots, stat recomputation, base shop zone, 5.0s channeled Recall (B) with interruption | M1, M3 | PLANNED |
| M5 | WebRTC P2P Multiplayer (PeerJS 1-3P) & Solo Mode | Host-authoritative star topology, 6-char room codes, 20Hz snapshots, input streaming, peer ping, and 100% offline Solo Mode | M1, M2, M3, M4 | PLANNED |
| M6 | Final Verification: 100% E2E Test Suite & Adversarial Hardening | Phase 1: Pass 100% E2E test suite (Tiers 1-4). Phase 2: Adversarial coverage hardening (Tier 5) with Challenger/Auditor verification | M1, M2, M3, M4, M5, TEST_READY.md | PLANNED |

*Note: E2E Testing Track runs concurrently with Milestones 1–5 to build the test suite and publish `TEST_READY.md`.*

---

## Interface Contracts

### 1. `Engine` $\leftrightarrow$ `World / Entities`
- **Coordinate Space**: All entities store continuous world coordinates $(x, y, z)$ where $z=0$ is ground level.
- **Isometric Projection**:
  - `worldToScreen(wx, wy, wz, camera, zoom)` $\to$ `{ sx, sy }`
  - `screenToWorld(sx, sy, camera, zoom)` $\to$ `{ wx, wy }`
- **Render Entity Protocol**:
  Each renderable entity must implement:
  - `getDepthKey()`: returns $wx + wy$
  - `draw(ctx, camera, zoom)`: draws sprite/shape centered at projected screen position
  - `drawHUD(ctx, camera, zoom)`: draws overhead health/mana/channel bar

### 2. `Combat Engine` $\leftrightarrow$ `Entities (Heroes, Minions, Towers, Bosses)`
- **Damage Envelope**:
  ```ts
  interface DamageEvent {
    sourceId: string;
    sourceType: 'hero' | 'minion' | 'tower' | 'boss';
    targetId: string;
    amount: number;
    type: 'physical' | 'magical' | 'true';
    isCrit?: boolean;
    appliesLifesteal?: boolean;
  }
  ```
- **Resolution**:
  - `applyDamage(target, damageEvent)`: calculates mitigation based on target's Armor or Magic Resist, reduces target HP, triggers lifesteal heal on attacker, and checks for lethal last-hit.
  - Returns: `{ finalDamage: number, wasLethal: boolean, killerId: string }`

### 3. `Combat Engine` $\leftrightarrow$ `Crowd Control State Machine`
- **CC Status Flags**:
  ```ts
  interface CCState {
    stunnedUntil: number;
    rootedUntil: number;
    silencedUntil: number;
    tauntedUntil: number;
    tauntTargetId: string | null;
    slowedUntil: number;
    slowPercentage: number;
    stealthedUntil: number;
  }
  ```
- Methods:
  - `canMove(entity)`: `now >= stunnedUntil && now >= rootedUntil && now >= tauntedUntil`
  - `canAttack(entity)`: `now >= stunnedUntil && now >= silencedUntil`
  - `canCast(entity)`: `now >= stunnedUntil && now >= silencedUntil && now >= tauntedUntil`
  - `breaksChannel(ccType)`: Stun, Taunt, and Silence immediately abort Recall channeling.

### 4. `Economy / Shop` $\leftrightarrow$ `Hero Entity`
- **Gold & Inventory Interface**:
  - `hero.gold`: number
  - `hero.inventory`: Array of 6 slots (`Item | null`)
  - `buyItem(hero, itemId)`: boolean (checks gold, shop proximity, empty slot; deducts gold, equips item, recalculates stats)
  - `sellItem(hero, slotIndex)`: boolean (checks shop proximity, non-empty slot; refunds 70%, clears slot, recalculates stats)
  - `recalculateHeroStats(hero)`: resets stats to base + level growth, adds item bonuses, clamps CDR to 40%, clamps current HP to new max HP.

### 5. `Recall System` $\leftrightarrow$ `Hero Entity & Game Simulation`
- `startRecall(hero)`: initiates 5000ms channel if not dead/disabled.
- `updateRecall(hero, dt)`: increments channel progress; if `elapsed >= 5000`, teleports hero to fountain center and resets velocity.
- `interruptRecall(hero, reason)`: triggered on damage > 0, movement command, ability cast, or CC; cancels channel, flashes channel bar red, applies 1.0s cooldown.

### 6. `Networking` $\leftrightarrow$ `Game Simulation`
- **Star Topology Handshake**:
  - Host creates peer room code `ROOM_XXXXXX`.
  - Client sends `JOIN_REQ { heroChoice: string }`.
  - Host responds `JOIN_ACK { playerId: number, gameState: Snapshot }`.
- **Client Input Message**:
  - `INPUT_CMD { seq: number, type: 'MOVE'|'CAST'|'ATTACK'|'BUY'|'SELL'|'RECALL', data: any }`
- **Host Snapshot (20 Hz)**:
  - `SNAPSHOT { tick: number, timestamp: number, heroes: HeroState[], minions: MinionState[], towers: TowerState[], bosses: BossState[], projectiles: ProjectileState[] }`
- **Solo Mode**: Bypasses network transport entirely; local input commands execute directly against `GameSimulation`.

---

## Code Layout

```
c:\Users\Bruno\Downloads\jogo-duplinha\
├── index.html                   # Entry point (Canvas viewport, UI/HUD overlays, modals)
├── style.css                    # Responsive HUD, minimap, shop modal, lobby styling
├── package.json                 # Project configuration, test scripts (npm test)
├── src/
│   ├── main.js                  # Application bootstrapper (Lobby, mode select, init)
│   ├── game.js                  # GameSimulation orchestrator (State, fixed 60fps loop)
│   ├── core/
│   │   ├── isometric.js         # 2:1 dimetric projection & unprojection math
│   │   ├── camera.js            # Viewport follow, smooth lerp, boundary clamping
│   │   ├── input.js             # Mouse click unprojection, QWER keys, cancel handling
│   │   └── loop.js              # Fixed-timestep loop (16.67ms) with frame limiter
│   ├── render/
│   │   ├── renderer.js          # 7-pass canvas draw pipeline, viewport culling
│   │   └── particles.js         # Procedural 2D particle emitters (fire, ice, arrows, vfx)
│   ├── world/
│   │   ├── map.js               # Map layout, terrain tiles, fountain zones, collision
│   │   ├── tower.js             # Tower targeting, aggro switch, heat scaling, projectiles
│   │   ├── minion.js            # 60s wave spawner, melee/ranged/cannon, waypoint AI
│   │   └── boss.js              # Wave 5/10 mini-bosses, Supreme Nexus Guardian Boss
│   ├── entities/
│   │   ├── entity.js            # Base entity class (coordinates, collider, health, mana)
│   │   ├── hero.js              # Hero base class (stats, level growth, inventory, recall)
│   │   └── heroes/
│   │       ├── knight.js        # Cavaleiro Guardião implementation
│   │       ├── sorceress.js     # Feiticeira Elemental implementation
│   │       ├── ranger.js        # Patrulheiro Arqueiro implementation
│   │       ├── assassin.js      # Sombra Assassina implementation
│   │       └── cleric.js        # Clérigo da Luz implementation
│   ├── combat/
│   │   ├── combat.js            # Damage formulas, Armor/MR mitigation, True damage, crits
│   │   └── cc.js                # Crowd control state machine (Stun, Taunt, Root, Silence)
│   ├── systems/
│   │   ├── economy.js           # Gold accumulation, last-hit detection, assist gold
│   │   ├── items.js             # 18-item catalog, 6-slot inventory, stat recomputation
│   │   └── recall.js            # 5-second channeled recall, interruption rules
│   ├── net/
│   │   ├── netcode.js           # WebRTC PeerJS wrapper, host-authoritative star sync
│   │   └── protocol.js          # Packet formats (snapshots, input commands, ping)
│   └── ui/
│       ├── hud.js               # Bottom ability bar, cooldowns, stats, timer, minimap
│       ├── shop_ui.js           # Base shop modal, item purchase/sell buttons
│       └── lobby_ui.js          # Solo / Multiplayer lobby, room code create/join
└── tests/
    ├── runner.js                # Automated test runner with exit code 0/1
    ├── e2e/                     # Opaque-box E2E test suite (Tiers 1-4)
    └── unit/                    # Core unit tests (math, combat, items, inventory, recall)
```
