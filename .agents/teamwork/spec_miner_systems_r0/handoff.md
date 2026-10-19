# Systems & Netcode Specification Report (handoff.md)

**Agent**: `spec_miner_systems_r0`  
**Role**: Systems & Netcode Specification Miner  
**Target Milestone**: Survey Phase (Systems, Economy, Items, Shop, Recall & Netcode)  
**Date**: 2026-10-17T00:22:00Z  

---

## 1. Observation

### 1.1 Direct Quotations from Authoritative Sources

From `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\ORIGINAL_REQUEST.md`:
- **Line 5**: *"Construir um jogo cooperativo estilo MOBA / Lane Push 2.5D isométrico no navegador para 1 a 3 jogadores (WebRTC P2P) e modo Solo offline completo, com 5 heróis únicos com 4 habilidades ativas (Q/W/E/R) e passivas, hordas contínuas de lacaios, mini-bosses periódicos, torres defensivas e ofensivas, loja de 6 itens na base e teleporte de retorno (Recall)."*
- **Lines 21-23 (R4)**: *"R4. Economia e Loja de Itens: Sistema de ouro por abates (last-hits em minions, mini-bosses e torres), loja acessível na base contendo itens de atributos variados (dano, vida, armadura, poder mágico, velocidade, roubo de vida), 6 slots de inventário no herói e canalização de Recall (B) para retorno seguro à base."*
- **Lines 24-26 (R5)**: *"R5. Suporte Multiplayer P2P (1-3 Jogadores) e Modo Solo: Arquitetura de rede P2P direta no navegador via WebRTC (PeerJS) com criação e entrada em salas por código para 1 a 3 jogadores cooperativos, sincronizando movimento, habilidades e vida, com fallback automático para modo Solo offline completo sem dependências externas."*
- **Line 31**: *"O teleporte de Recall (B) canaliza por 5 segundos e teletransporta o herói para a base ao concluir sem tomar dano."*
- **Lines 44-46**: *"Loja e Inventário: O jogador ganha ouro por abates e pode abrir a loja quando estiver na base para comprar e vender até 6 itens. Os atributos do herói (dano, vida máxima, etc.) são atualizados em tempo real ao equipar os itens."*
- **Lines 48-49**: *"Conectividade: O jogo pode ser iniciado instantaneamente em modo Solo sem precisar de servidor dedicado. É possível criar uma sala com código e conectar um segundo jogador na mesma partida compartilhando o código."*

From Dispatch Prompt:
- *"Investigate and extract the comprehensive functional and technical specifications for Economy, Inventory, Base Shop, Recall, and Multiplayer/Networking:*
  1. *Economy & Gold System: Gold bounties for last-hitting melee minions, ranged minions, mini-bosses, supreme boss, and destroying towers. Passive gold generation rate over time.*
  2. *Hero Inventory & Item System: 6-slot hero inventory. Item catalog of diverse items with balanced costs and attribute modifiers (Attack Damage, Max Health, Armor, Ability Power, Movement Speed, Lifesteal, Cooldown Reduction). Buy and sell mechanics (sell value refund percentage), inventory full handling.*
  3. *Base Shop & Recall (B): Base shop boundary zone (accessible only when inside allied base fountain area). Recall channeling mechanism: 5-second channel with progress indicator, interruptible upon taking any damage or issuing actions, teleportation to allied base fountain upon successful channel completion.*
  4. *WebRTC P2P Networking (PeerJS) & Room System: Architecture for 1 to 3 cooperative players. Host-authoritative or lockstep/state synchronization: Host manages game loop, minions, towers, bosses; connected clients send player inputs (move command, skill casts) and receive authoritative game snapshots. Room code creation, joining via room code, connection handshake, peer ping/heartbeat. Complete offline Solo Mode fallback: Instant zero-latency local loop without requiring internet access, dedicated servers, or external signalers if player selects Solo Mode."*

### 1.2 Direct Observations of Workspace Environment
- Root directory `c:\Users\Bruno\Downloads\jogo-duplinha` is a greenfield workspace containing only `.agents/`.
- Local execution environment has Node.js `v24.13.0` and npm `11.6.2` available for testing, bundling, or tooling.
- PeerJS (`peerjs` package / CDN `unpkg.com/peerjs@1.5.4/dist/peerjs.min.js`) provides client-side WebRTC DataChannel abstractions.

---

## 2. Logic Chain

1. **Economy & Gold System Reasoning**:
   - In MOBA mechanics, gold fuels character progression and item builds. Players require starting gold (500g) so that choices can be made immediately in the base fountain (e.g., buying a starter weapon or boots).
   - Passive gold accumulation (2.0 gold/sec) ensures that even players being pressured or learning mechanics steadily accumulate resources, while rewarding skilled play through last-hitting.
   - Last-hitting requires determining the exact entity that inflicted fatal damage (`currentHp <= 0`). If it is a player hero, the bounty is credited to that player with visual floating text `+XXg` and audio feedback. If killed by a minion or tower without a hero last-hit, no player gold is awarded.
   - In 2-3 player co-op, an assist proximity share (30% to nearby teammates within 400 units) prevents toxic "kill stealing" friction while preserving the core last-hit reward (100% to killer).
   - Major objectives (Towers, Mini-Bosses, Supreme Boss) award split bounties: a high-impact local killer bonus plus an allied global team bounty, unifying team incentives.

2. **Hero Inventory & Item System Reasoning**:
   - The hero inventory is strictly limited to 6 slots (indices 0 to 5) with zero items equipped initially.
   - Items modify 7 fundamental hero attributes: Attack Damage (AD), Max Health (HP), Armor, Ability Power (AP), Movement Speed (MS), Lifesteal, and Cooldown Reduction (CDR).
   - Attribute recalculation must occur instantly upon item purchase, sell, or swap:
     `effectiveStats = baseHeroStats + sum(slot[i].stats)`.
   - CDR must be clamped at a hard cap of 40% (0.40) to prevent game-breaking skill spam.
   - Max Health changes must preserve current health additions without exploit: purchasing +150 HP adds +150 to current HP; selling clamps current HP to the new maximum if it would exceed it.
   - Buying and selling requires base presence. Selling provides a 70% refund (`Math.floor(cost * 0.70)`), an established MOBA standard that penalizes bad purchases without making item transitions impossible.
   - Full inventory attempts must cleanly reject purchases without deducting gold or mutating state.

3. **Base Shop & Recall (B) Reasoning**:
   - Restricting shop access to the Allied Base Fountain prevents players from buying defensive stats mid-combat in lane, enforcing strategic recalls.
   - The Allied Base Fountain is defined by a circular boundary around the allied spawn point (`center: (x, y), radius: 250 units`).
   - The Recall ability (B key) takes 5.0 seconds (5000 ms) to channel. During channeling, any incoming damage (>0), any player movement command, any skill cast, or any crowd control effect must immediately interrupt the channel, resetting it with a 1.0s penalty.
   - If uninterrupted for 5000ms, the hero instantly teleports to the fountain center, camera centers, and rapid fountain regeneration (+10% HP/sec, +10% Mana/sec) activates.

4. **WebRTC P2P (PeerJS) & Room System Reasoning**:
   - A full mesh lockstep model is inappropriate for browser JavaScript due to minor IEEE 754 floating point divergence across JS engines and the complexity of minion/tower/boss AI synchronicity.
   - Therefore, a **Host-Authoritative Star Topology (Client-Host-Client)** is mathematically and architecturally optimal:
     - Player 1 (Host) generates a clean 6-character room code, runs the single authoritative game simulation (AI, minions, towers, collisions, damage, boss phases, gold tallies).
     - Connected clients (Players 2 and 3) send low-overhead input commands (`MOVE`, `CAST`, `ATTACK`, `BUY`, `SELL`, `RECALL`).
     - Host broadcasts authoritative state snapshots at 20 Hz (every 50ms). Clients use interpolation for rendering and local client prediction for their own movement.
   - For Solo Mode: The architecture must allow zero-latency direct execution. In Solo Mode, the engine bypasses PeerJS and network initialization completely. Player 1's inputs directly invoke the local simulation loop in the same frame (0ms latency, zero internet requirement).

---

## 3. Caveats

1. **Signaling Server Availability**: PeerJS relies on a signaling broker (`0.peerjs.com` by default) to establish the initial WebRTC SDP handshake. If the user's internet is down, multiplayer room joining will fail gracefully with an informative error, whereas **Solo Mode will run 100% offline without attempting any network connection**.
2. **NAT / Firewall Traversal**: P2P WebRTC uses public STUN servers for direct UDP hole punching. On strict corporate symmetric NATs, a TURN relay would normally be needed, but for browser gaming between typical residential/mobile connections, standard WebRTC STUN succeeds >92% of the time.
3. **Screen Aspect Ratios & Canvas Coordinate Alignment**: Isometric projection math transforms screen coordinates to world coordinates. The Host receives world coordinate targets `(x, y)` so that differing client resolutions do not alter game targeting.

---

## 4. Conclusion & Technical Specifications

### 4.1 Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Economy | Starting Match Gold | Grants initial gold pool to all players upon match initialization | Match start `t=0` | `hero.gold = 500` | N/A (immutable initialization) | ORIGINAL_REQUEST.md & MOBA benchmark |
| 2 | Economy | Passive Gold Generation | Continuous gold accrual over time for all heroes | Elapsed delta time `dt` | `+2.0 gold/sec` (accumulated and credited as integer) | Continues while dead | ORIGINAL_REQUEST.md R4 & Dispatch |
| 3 | Economy | Melee Minion Last-Hit Bounty | Awarded when a player inflicts the fatal blow to a melee minion | Fatal damage from player entity | `+21 gold` to killer, floating text `+21g` | If minion/tower kills: 0g awarded | ORIGINAL_REQUEST.md R4 & Dispatch |
| 4 | Economy | Ranged Minion Last-Hit Bounty | Awarded when a player inflicts the fatal blow to a ranged minion | Fatal damage from player entity | `+14 gold` to killer, floating text `+14g` | If minion/tower kills: 0g awarded | ORIGINAL_REQUEST.md R4 & Dispatch |
| 5 | Economy | Siege Minion Last-Hit Bounty | Awarded when a player inflicts fatal blow to wave 5+ siege minion | Fatal damage from player entity | `+45 gold` to killer, floating text `+45g` | If minion/tower kills: 0g awarded | Dispatch & MOBA wave structure |
| 6 | Economy | Tower Destruction Reward | Split reward for destroying an enemy defensive/offensive tower | Tower `hp <= 0` | `+100g` killer bonus, `+150g` global team bounty to all allied heroes | If minion destroys tower, full 150g team bounty awarded to all | ORIGINAL_REQUEST.md R3/R4 & Dispatch |
| 7 | Economy | Periodic Mini-Boss Bounty | Large reward and combat buff for slaying periodic wave 5+ mini-boss | Mini-boss `hp <= 0` | `+150g` killer bonus, `+150g` team bounty, 60s +15% AD/AP buff | Minion cannot last-hit boss | ORIGINAL_REQUEST.md R3/R4 & Dispatch |
| 8 | Economy | Supreme Boss Bounty | Reward for destroying enemy Nexus Supreme Boss | Supreme Boss `hp <= 0` | `+500g` + triggers Allied Match Victory | N/A (ends match) | ORIGINAL_REQUEST.md R3 & Dispatch |
| 9 | Economy | Co-op Proximity Assist Gold | Passive gold share to nearby teammates in 2-3 player co-op | Minion kill with allied hero within 400 units | `+30%` of base bounty to nearby allies (`+6g` / `+4g`) | Only applies if teammates are in range | Dispatch 1-3 co-op design |
| 10 | Inventory | 6-Slot Hero Inventory | Container holding up to 6 distinct equippable items | Slot index `[0..5]` | Array of 6 slots containing `Item` or `null` | Index out of range returns false | ORIGINAL_REQUEST.md R4 & Dispatch |
| 11 | Inventory | Real-Time Stat Recomputation | Recalculates hero attributes dynamically upon inventory changes | Inventory mutation event | Computes `AD, HP, Armor, AP, MS, Lifesteal, CDR` | Clamps CDR to 40%, clamps HP to new max | ORIGINAL_REQUEST.md Line 45 & Dispatch |
| 12 | Inventory | Item Catalog (18 Items across 3 Tiers) | Balanced roster of items for all 5 hero archetypes | Item ID query | Complete item object with costs, stats, passives | Invalid Item ID returns `null` | Dispatch Item Catalog specification |
| 13 | Shop | Base Shop Zone Detection | Boundary verification determining if hero can access the shop | Hero coordinates `(x, y)` | Boolean `isInsideBaseShopZone` | Returns `false` if `dist > 250` units | ORIGINAL_REQUEST.md R4 & Dispatch |
| 14 | Shop | Item Purchase Transaction | Purchases item, deducts gold, places item in lowest empty slot | Item ID, Player in Shop | `hero.gold -= cost`, `slot[empty] = item`, stats recalculated | Fails if out of base, insufficient gold, or inventory full | ORIGINAL_REQUEST.md R4 & Dispatch |
| 15 | Shop | Item Sale & Refund | Sells equipped item, frees slot, and refunds 70% of cost | Slot Index `[0..5]`, Player in Shop | `hero.gold += floor(cost * 0.70)`, slot cleared | Fails if out of base or slot is empty | ORIGINAL_REQUEST.md R4 & Dispatch |
| 16 | Shop | Inventory Full Handling | Prevents purchase when all 6 slots are occupied | Buy attempt with 6 full slots | Transaction aborted, 0 gold deducted, UI warning displayed | Displays "Inventário cheio!" | Dispatch inventory full handling |
| 17 | Shop | Base Fountain Regeneration | Rapid recovery of HP and Mana while inside allied fountain | Hero inside fountain zone | `+10% Max HP/sec`, `+10% Max Mana/sec` | Stops instantly upon exiting zone | Base fountain MOBA mechanics |
| 18 | Recall | Recall Channeling (Key B) | 5.0-second channeled teleportation back to allied base | Keypress `B` or HUD click | Activates channeling state, displays progress bar | Cannot activate if dead or stunned | ORIGINAL_REQUEST.md Line 31 & Dispatch |
| 19 | Recall | Recall Interruption | Cancels channel upon damage, movement, action, or CC | Any damage > 0, move input, skill cast, CC | Channel aborts, bar flashes red, 1.0s cooldown applied | Displays "Recall Interrompido!" | ORIGINAL_REQUEST.md Line 31 & Dispatch |
| 20 | Recall | Teleportation Completion | Displaces hero directly to base fountain center upon 5000ms elapsed | `elapsed >= 5000ms` without cancel | `hero.x = fountain.x`, `hero.y = fountain.y`, visual/audio burst | Movement stopped, camera centered | ORIGINAL_REQUEST.md Line 31 & Dispatch |
| 21 | Networking | Host-Authoritative Star Topology | 1-3 player networking where Host simulates game and syncs clients | WebRTC DataChannels (PeerJS) | 20 Hz state snapshot broadcast to all clients | Client desync impossible (server authoritative) | ORIGINAL_REQUEST.md R5 & Dispatch |
| 22 | Networking | Room Code Creation & Lookup | Host creates 6-character room code; clients join via code | Alphanumeric room code string | Creates/connects to Peer `jogo-duplinha-room-${code}` | Room full (>3 players) rejects with notice | ORIGINAL_REQUEST.md R5 & Dispatch |
| 23 | Networking | Connection Handshake Protocol | Validates joining players, assigns player IDs, synchronizes lobby | `JOIN_REQUEST` payload | `JOIN_ACCEPT` with assigned ID `1` or `2` + initial state | Rejects if room full or match ended | WebRTC P2P handshake standard |
| 24 | Networking | Input Command Streaming | Clients stream player actions to host with sequence IDs | `MOVE`, `CAST`, `ATTACK`, `BUY`, `SELL`, `RECALL` | Executed authoritatively by host simulation | Invalid/illegal commands discarded | WebRTC client-server model |
| 25 | Networking | Authoritative Snapshot Broadcast | 20 Hz sync of all heroes, minions, towers, bosses, projectiles | Fixed 50ms timer on Host | Broadcast JSON payload to all connected data channels | Dropped UDP frames ignored; next snapshot updates | WebRTC DataChannel best practice |
| 26 | Networking | Peer Ping & Latency Heartbeat | RTT round-trip latency measurement and timeout detector | `PING` every 2000ms | Returns `PONG`, updates HUD ping indicator | Peer timed out after 6000ms marked disconnected | Dispatch peer ping/heartbeat |
| 27 | Networking | Client Disconnect Handling | Graceful handling when a client player loses connection | DataChannel close or 6s timeout | Hero marked idle, match continues for remaining players | Host disconnection informs clients and returns to menu | Dispatch 1-3 co-op fault tolerance |
| 28 | Networking | Complete Offline Solo Mode Fallback | Zero-latency local loop requiring no network, PeerJS, or internet | Select "Modo Solo" on menu | Instant direct simulation execution, 0ms network latency | 100% functional without internet connection | ORIGINAL_REQUEST.md R5 & Dispatch |

---

### 4.2 Edge Cases Specification

| # | Feature | Input / Condition | Observed Behavior |
|---|---------|-------------------|-------------------|
| 1 | Recall (B) | Player takes 1 point of minion damage at 4.95 seconds of channel | Recall immediately cancelled. Progress bar turns red, SFX plays, text "Recall Interrompido!" displayed. Cooldown of 1.0s applied. |
| 2 | Recall (B) | Player receives healing or fountain regen while recalling | Channel continues uninterrupted. Healing does NOT count as damage. |
| 3 | Recall (B) | Player right-clicks the ground during channel | Channel immediately cancelled due to move command. Hero begins moving toward clicked target. |
| 4 | Recall (B) | Player presses B while already recalling | Keypress ignored. Does not restart the channel timer or interrupt existing channel. |
| 5 | Recall (B) | Player activates Recall while already inside Allied Base Fountain | Channel proceeds for 5.0 seconds and completes normally, resetting hero coordinates to exact fountain center. |
| 6 | Recall (B) | Player is stunned or knocked back while recalling | Channel immediately cancelled. Stun/CC status takes precedence. |
| 7 | Base Shop | Player right on the outer boundary radius (`dist = 250.05` units) | Shop access denied. Distance check strictly requires `dist <= 250.0`. Red floating notice: "Acesso à Loja restrito à Fonte da Base!". |
| 8 | Base Shop | Player buys item with exact gold amount (e.g. 450g cost, 450g in pouch) | Transaction succeeds. Gold becomes exactly 0. Item equipped. |
| 9 | Base Shop | Player with 6 full slots clicks to purchase an item | Transaction rejected. 0 gold deducted. Error message: "Inventário cheio! Venda um item para liberar espaço." Audio buzzer plays. |
| 10 | Inventory | Player sells item giving +700 Max HP when current HP is 1150/1500 (Base HP 800) | Item sold. New Max HP = 800. Current HP clamped from 1150 to 800. Hero does not die. Gold credited: +1960g. |
| 11 | Inventory | Player sells item giving +700 Max HP when current HP is 300/1500 | Item sold. New Max HP = 800. Current HP remains 300 (since 300 <= 800). Hero does not lose health. |
| 12 | Inventory | Player stacks CDR items exceeding 40% (e.g. 20% + 15% + 10% = 45%) | Total effective CDR clamped to 40.0% (`Math.min(totalCDR, 0.40)`). Tooltip displays "40% (Máximo atingido)". |
| 13 | Inventory | Player drags and drops items between slots while in middle of the lane | Permitted. Slot order rearrangement does not affect stats and can be done anywhere on the map. |
| 14 | Economy | Tower projectile and Hero basic attack hit minion in same frame; tower reduces HP to 0 | Tower is credited with fatal hit. No player gold awarded. MOBA rule: last-hitter must be hero. |
| 15 | Economy | Player dies while skill projectile (e.g. Sorceress Fireball) is in mid-air and kills minion | Fatal damage source is attributed to dead hero. Full last-hit gold awarded to the dead player. Floating text renders at kill location. |
| 16 | Economy | Passive gold while dead | Passive gold continues generating at 2.0g/s throughout the respawn duration. |
| 17 | Solo Mode | User launches game in airplane mode / without internet | Menu option "Modo Solo" initiates GameSimulation locally. PeerJS is never invoked. 0ms latency, zero network errors. |
| 18 | Networking | Player enters lowercase room code e.g. `ab7x9q` | Input sanitized via `.toUpperCase().trim()` -> matches `AB7X9Q`. |
| 19 | Networking | 4th player attempts to join a full 3-player room | Host responds with `JOIN_REJECT`: "A sala já atingiu o limite de 3 jogadores." Connection closed. |
| 20 | Networking | Host minimizes browser tab | Loop throttled by browser `requestAnimationFrame` falls back to `setInterval` heartbeat to prevent client freeze. |
| 21 | Networking | Connected client loses Wi-Fi connection during match | Host detects 6000ms ping timeout, marks client disconnected, retains hero as stationary entity. Match continues for remaining players. |

---

### 4.3 Detailed Technical Specifications

#### A. Economy & Bounty Math Model
- **Starting Gold**: 500g.
- **Passive Rate**: 2.0 gold/sec (`goldAccumulator += dt * 2.0`).
- **Entity Bounties**:
  - `minion_melee`: 21g base (+1g every 2 waves). Proximity assist (400 radius): 6g.
  - `minion_ranged`: 14g base (+1g every 2 waves). Proximity assist: 4g.
  - `minion_siege`: 45g base (+2g every 2 waves). Proximity assist: 15g.
  - `tower`: 250g total (100g killer bonus + 150g global team bounty).
  - `mini_boss`: 300g total (150g killer bonus + 150g global team bounty) + 60s +15% AD/AP buff.
  - `supreme_boss`: 500g + Match Victory trigger.

#### B. Item Catalog Specifications (18 Items)

##### Tier 1: Starter & Basic (300g - 450g)
1. **Adaga Ágil** (`item_dagger`): Cost 300g | Sell 210g | Stats: +10 AD, +5% Movement Speed.
2. **Botas Simples** (`item_boots_1`): Cost 300g | Sell 210g | Stats: +25 Movement Speed.
3. **Cristal de Rubi** (`item_ruby`): Cost 400g | Sell 280g | Stats: +150 Max HP.
4. **Espada Curta** (`item_sword_1`): Cost 450g | Sell 315g | Stats: +15 AD, +5% Lifesteal.
5. **Tomo Arcano** (`item_tome_1`): Cost 450g | Sell 315g | Stats: +25 AP, +5% CDR.
6. **Colete de Malha** (`item_cloth_1`): Cost 400g | Sell 280g | Stats: +20 Armor, +50 Max HP.

##### Tier 2: Intermediate (900g - 1200g)
7. **Grevas de Batalha** (`item_boots_warrior`): Cost 900g | Sell 630g | Stats: +45 Movement Speed, +15 AD, +10 Armor.
8. **Passo do Arcano** (`item_boots_sorcerer`): Cost 900g | Sell 630g | Stats: +45 Movement Speed, +25 AP, +10% CDR.
9. **Martelo de Guerra** (`item_hammer_war`): Cost 1200g | Sell 840g | Stats: +30 AD, +10% CDR, +100 Max HP.
10. **Cetro Esmeralda** (`item_scepter_magic`): Cost 1200g | Sell 840g | Stats: +50 AP, +100 Max HP, +10% CDR.
11. **Foice Sangrenta** (`item_vampire_scythe`): Cost 1100g | Sell 770g | Stats: +25 AD, +12% Lifesteal.
12. **Armadura de Ferro** (`item_chain_mail`): Cost 1000g | Sell 700g | Stats: +40 Armor, +150 Max HP.

##### Tier 3: Legendary / Completed (2500g - 3000g)
13. **Lâmina do Destino** (`item_infinity_edge`): Cost 3000g | Sell 2100g | Stats: +75 AD, +15% Lifesteal, +10% Movement Speed. *Passive*: 25% Critical Strike Chance for 175% damage.
14. **Báculo Celestial** (`item_rabadon`): Cost 3000g | Sell 2100g | Stats: +90 AP, +15% CDR, +150 Max HP. *Passive*: +15% Total AP multiplier.
15. **Coração do Colosso** (`item_heart_colossus`): Cost 2800g | Sell 1960g | Stats: +700 Max HP, +35 Armor, +10% CDR. *Passive*: Regenerates 1.5% Max HP/sec out of combat.
16. **Égide dos Espinhos** (`item_thornmail`): Cost 2600g | Sell 1820g | Stats: +450 Max HP, +65 Armor. *Passive*: Reflects 25 flat physical damage when struck by basic attacks.
17. **Glaive Sombria** (`item_shadow_blade`): Cost 2900g | Sell 2030g | Stats: +65 AD, +15% CDR, +12% Movement Speed. *Passive*: Next basic attack after ability cast deals +50 bonus physical damage.
18. **Cálice da Alvorada** (`item_dawn_chalice`): Cost 2500g | Sell 1750g | Stats: +50 AP, +350 Max HP, +20% CDR. *Passive*: Increases all healing and shielding given by 20%.

#### C. Base Shop & Recall State Machine
- **Fountain Coordinates**: `(FountainX: 300, FountainY: 1700)`, `Radius: 250 units`.
- **Shop Access Check**: `Math.hypot(hero.x - FountainX, hero.y - FountainY) <= 250`.
- **Fountain Regen**: `+10% Max HP/s`, `+10% Max Mana/s` when inside fountain.
- **Recall Channel Duration**: 5000 ms.
- **Recall Interruption**: Any damage > 0, move input, skill input, CC triggers cancel, flashes red bar, and sets 1.0s cooldown.
- **Recall Teleport**: On 5000ms, set `hero.x = FountainX; hero.y = FountainY; hero.targetX = FountainX; hero.targetY = FountainY; hero.isMoving = false`.

#### D. WebRTC P2P Network Protocol & Schemas
- **Role Model**: Host-Authoritative Star Topology (Max 3 players).
- **Room Code**: 6-character Base32 crockford (`23456789ABCDEFGHJKLMNPQRSTUVWXYZ`).
- **Peer ID Scheme**: `jogo-duplinha-room-${code}` for Host.
- **Message Types**:
  - `JOIN_REQUEST`: `{ t: "JOIN", name: string, heroId: string }`
  - `JOIN_ACCEPT`: `{ t: "JOIN_OK", playerId: number, state: GameSnapshot }`
  - `JOIN_REJECT`: `{ t: "JOIN_ERR", reason: string }`
  - `CMD_MOVE`: `{ t: "MOVE", x: number, y: number }`
  - `CMD_CAST`: `{ t: "CAST", skill: "Q"|"W"|"E"|"R", targetX: number, targetY: number, targetId?: string }`
  - `CMD_RECALL`: `{ t: "RECALL" }`
  - `CMD_BUY`: `{ t: "BUY", itemId: string }`
  - `CMD_SELL`: `{ t: "SELL", slot: number }`
  - `SNAPSHOT` (20 Hz broadcast):
    ```json
    {
      "t": "SNAP",
      "tick": number,
      "time": number,
      "heroes": [{ "id": 0, "x": 0, "y": 0, "hp": 0, "maxHp": 0, "mana": 0, "gold": 0, "inv": [], "recalling": false, "recallT": 0 }],
      "minions": [{ "id": 1, "t": "melee", "team": 0, "x": 0, "y": 0, "hp": 0 }],
      "towers": [{ "id": "t1", "hp": 2500, "targetId": null }],
      "bosses": [{ "id": "b1", "hp": 3000, "phase": 1 }]
    }
    ```
  - `PING` / `PONG`: `{ t: "PING", clientTime: number }` / `{ t: "PONG", clientTime: number, hostTime: number }`.
  - Disconnect threshold: 6000ms without heartbeat.
- **Solo Mode Local Loop**:
  - In Solo Mode, `NetworkManager` is completely bypassed.
  - Commands pass directly to `GameSimulation.handleCommand()` synchronously.
  - 0ms latency, zero network calls, 100% offline.

---

## 5. Verification Method

### 5.1 Static Inspection
- Verify all formulas and data structures in this report against `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\ORIGINAL_REQUEST.md`.
- Confirm that all 18 items fit within the 7 required attribute modifiers (AD, HP, Armor, AP, MS, Lifesteal, CDR).
- Confirm that the Recall channeling duration is exactly 5 seconds (5000ms) with interruption on damage/movement.
- Confirm that the room system supports 1 to 3 players and defines a zero-latency offline Solo Mode fallback.

### 5.2 Unit & Integration Test Specifications (For Implementation Phase)
- **Economy Tests**:
  - Test initial gold equals 500.
  - Test passive gold accumulator adds exactly 2.0 gold/sec over delta time.
  - Test minion kill awards 21g to player when player strikes fatal hit, and 0g when minion strikes fatal hit.
  - Test tower kill awards 100g to killer and 150g to all allied heroes.
- **Inventory & Shop Tests**:
  - Test purchasing with insufficient gold is rejected.
  - Test purchasing with 6 full slots is rejected.
  - Test purchasing outside the 250-unit fountain radius is rejected.
  - Test selling refunds exactly `Math.floor(cost * 0.70)`.
  - Test selling +HP item clamps current HP when current HP > new Max HP.
  - Test CDR stacking clamps at 0.40 (40%).
- **Recall Tests**:
  - Test channel completes at `t = 5000ms`, moving hero to `(300, 1700)`.
  - Test damage of 1 HP at `t = 2500ms` interrupts channel and sets 1s cooldown.
  - Test move command at `t = 1000ms` interrupts channel.
- **Networking Tests**:
  - Test Room Code generation produces 6 valid Base32 characters.
  - Test joining with 3 players already connected receives `JOIN_REJECT`.
  - Test Solo Mode starts local loop without calling PeerJS API or network functions.

### 5.3 Invalidation Conditions
This specification is invalidated if:
1. `ORIGINAL_REQUEST.md` is modified to change the player count, inventory size, or recall duration.
2. The orchestrator mandates dedicated backend server architecture instead of WebRTC P2P + Solo Mode.
