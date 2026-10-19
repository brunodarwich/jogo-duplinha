# Milestone 2 Explorer 3 Handoff Report: Minion Waves, Boss Encounters & Game-Over Triggers

## 1. Observation
- **Direct Sources**:
  - `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\ORIGINAL_REQUEST.md` (lines 19-20, 39-41):
    > "R3. Estrutura do Mapa, Hordas e Bosses: Mapa de trilha progressiva com base aliada e base inimiga, torres com raio de ataque e projéteis em ambos os lados, hordas de lacaios (corpo a corpo e à distância) geradas a cada 60s, mini-bosses periódicos a cada 5 ondas com mecânicas especiais, e o Boss Supremo no Nexus inimigo."
    > "Ao atingir a onda 5, o primeiro Mini-Boss surge na trilha com barra de vida de chefe e habilidades especiais."
    > "A destruição do Nexus Inimigo/Boss Supremo gera tela de Vitória; a queda do Nexus Aliado gera Derrota."
  - `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\orchestrator\PROJECT.md` (lines 68-75, 226-227):
    - Feature 24: Periodic Minion Wave Spawning (60s) simultaneously at bases.
    - Feature 25: Wave composition (3 Melee + 3 Ranged, Cannon minion every 3rd wave).
    - Feature 26: Minion Waypoint Lane Navigation ($WP_0 \dots WP_6$).
    - Feature 27: Minion AI state machine (`MARCH`, `ACQUIRE`, `ATTACK`, `LEASH_RETURN` if pulled >400 units).
    - Feature 28: Wave 5 Mini-Boss Stone Colossus (3500 HP, Ground Slam AoE stun, -40% tower damage taken).
    - Feature 29: Wave 10 Mini-Boss Abyssal Behemoth (6000 HP, Acid pools DoT + armor shred, AoE silence).
    - Feature 30: Supreme Boss Nexus Guardian (12000 HP, 3-phase encounter, Enemy Nexus invulnerable while alive).
    - Feature 31: Victory & Defeat Game-Over Triggers.
  - `tests/unit/minion.test.js` (TC-MIN-01 to TC-MIN-07) and `tests/oracles/world/minion.js`:
    - `WAVE_INTERVAL = 60.0`
    - `LEASH_MAX_DISTANCE = 400`
    - `LANE_WAYPOINTS`: 7 points:
      - `[ { x: 400, y: 400 }, { x: 800, y: 800 }, { x: 1200, y: 1200 }, { x: 1600, y: 1600 }, { x: 2000, y: 2000 }, { x: 2400, y: 2400 }, { x: 2800, y: 2800 } ]`
    - `getWaveComposition(waveIndex)`: returns `{ waveIndex, meleeCount: 3, rangedCount: 3, cannonCount: isCannonWave ? 1 : 0, totalUnits: isCannonWave ? 7 : 6 }` where `isCannonWave = waveIndex % 3 === 0`.
    - `shouldDisengageLeash(minionPos, currentWaypointPos)`: `Math.hypot(minionPos.x - currentWaypointPos.x, minionPos.y - currentWaypointPos.y) > LEASH_MAX_DISTANCE`.
    - `resolveMinionDeath(minionType, killerEntity, nearbyAllies)`:
      - Bounties: Melee 21g, Ranged 14g, Cannon 45g.
      - Hero killer: awards killer full bounty; assists get `Math.floor(baseBounty * 0.30)`.
      - Non-hero killer: awards 0g, reason: `'denied_by_non_hero'`.
  - `tests/unit/boss.test.js` (TC-BOS-01 to TC-BOS-07) and `tests/oracles/world/boss.js`:
    - `BOSS_CONFIGS`:
      - `colossus`: spawnWave 5, maxHp 3500, towerDamageReduction 0.40, slamRadius 220, slamStunDuration 1.5, bountyKiller 150, bountyTeam 150, buff { name: 'Colossus Might', duration: 60, adBonusPercent: 0.15, apBonusPercent: 0.15 }.
      - `behemoth`: spawnWave 10, maxHp 6000, silenceDuration 2.0, bountyKiller 150, bountyTeam 150.
      - `supreme`: id `'boss_supreme'`, name `'Nexus Guardian'`, maxHp 12000, bountyKiller 500, bountyTeam 500.
    - `SupremeBoss` class:
      - `this.hp`, `this.maxHp = 12000`, `this.shieldActive = false`.
      - `phase` getter: ratio > 0.66 => 1; ratio > 0.33 => 2; else 3.
      - `takeDamage(amount)`: if `this.shieldActive`, returns `{ damageTaken: 0, shielded: true, isDead: false }`; else inflicts damage.
    - `evaluateMatchOutcome(alliedNexusHp, enemyNexusHp, supremeBossAlive)`:
      - `alliedNexusHp <= 0` => `{ outcome: 'DEFEAT', isOver: true }`.
      - `enemyNexusHp <= 0 && !supremeBossAlive` => `{ outcome: 'VICTORY', isOver: true }`.
      - Otherwise => `{ outcome: 'IN_PROGRESS', isOver: false }`.
  - `src/game.js`:
    - Currently contains static dummy minions (`min_ally_1`, `min_ally_2`, `min_enemy_1`, `min_enemy_2`) for M1 demo.
    - Possesses `matchTime`, `entities`, `isVictory`, `isDefeat`, and hooks `update(dt)` and `render(alpha)`.
  - `src/render/renderer.js`:
    - Pass 6 renders overhead HUD (`drawHUD`).
    - Pass 7 renders "VITÓRIA" or "DERROTA" screen announcements when `gameState.isVictory` or `gameState.isDefeat` is true.
  - `src/ui/hud.js`:
    - Minimap displays allied/enemy towers, bases, heroes, and minions.

---

## 2. Logic Chain

1. **Automated Test Contract Compliance**:
   - `tests/helpers/module_resolver.js` attempts to import `src/world/minion.js` and `src/world/boss.js` first.
   - When the Worker creates these files, `minion.test.js`, `boss.test.js`, and `real_world_match.test.js` will immediately test the real files instead of the oracles.
   - Therefore, `src/world/minion.js` and `src/world/boss.js` MUST implement and export every single constant, function, and class expected by the test suites with 100% exact signatures and return types.

2. **Minion Wave Pacing & Spawning Loop**:
   - First wave spawns at $t = 30.0$ seconds (00:30).
   - Subsequent waves spawn every 60.0 seconds ($t = 90.0, 150.0, 210.0, \dots$).
   - Wave index starts at 1. Wave 1 and 2: 3 Melee + 3 Ranged (6 units). Wave 3, 6, 9: 3 Melee + 3 Ranged + 1 Cannon (7 units).
   - Waves spawn simultaneously at Allied Base $(400, 400)$ and Enemy Base $(2800, 2800)$.
   - To prevent all 6 or 7 units from stacking onto the exact same pixel, a spawn queue with a stagger interval of $0.35$ seconds releases units sequentially (Melee $\to$ Ranged $\to$ Cannon) with slight lateral offsets ($\pm 15$ units perpendicular to lane).

3. **Waypoint Navigation & Leash Boundary AI**:
   - Minions do not blindly wander; they traverse `LANE_WAYPOINTS`:
     - Allied minions start at index 0 and progress toward index 6: $0 \to 1 \to 2 \to 3 \to 4 \to 5 \to 6$.
     - Enemy minions start at index 6 and progress toward index 0: $6 \to 5 \to 4 \to 3 \to 2 \to 1 \to 0$.
   - Waypoint advance threshold: when a minion is within 45 units of its target waypoint, its waypoint index increments (allied) or decrements (enemy).
   - AI State Machine:
     - `MARCH`: moves along current waypoint. Every 0.2s or frame, scans for hostiles within aggro radius ($R = 300$). If found $\to$ `ACQUIRE`.
     - `ACQUIRE`: picks highest priority target (Enemy minion attacking this minion > Closest enemy minion > Closest enemy hero > Closest enemy tower/nexus). If target selected $\to$ `PURSUE` or `ATTACK`.
     - `ATTACK`: if within weapon attack range (Melee 110, Ranged 350, Cannon 450), halts movement and fires attack cycle.
     - `PURSUE`: if target moves beyond weapon range but within aggro/leash, moves toward target.
     - `LEASH_RETURN`: if distance from minion to current waypoint exceeds 400 units (`dist(minion, wp) > 400`), aggro immediately breaks! Minion gains untargetable / CC immune flag, stops pursuing, and marches directly back to the lane waypoint. Upon reaching $\le 50$ units from the waypoint, resumes `MARCH`.

4. **Boss Encounters Architecture**:
   - **Stone Colossus (Wave 5 Mini-Boss)**:
     - Spawns at Wave 5 ($t = 270.0\text{s} = 04:30$) at Enemy Base $(2800, 2800)$ and marches down lane like a massive siege titan.
     - 3500 HP, takes -40% damage from defensive towers.
     - Ground Slam: when hostile units are within 220 units, Colossus channels for 1.2s (spawns telegraphed ground circle on Layer 1), then slams dealing 250 physical damage and applying a 1.5s Stun to all enemies caught.
     - Slaying grants 150g killer + 150g team (+300g total in solo mode) and the "Colossus Might" buff (+15% AD/AP for 60s).
   - **Abyssal Behemoth (Wave 10 Mini-Boss)**:
     - Spawns at Wave 10 ($t = 570.0\text{s} = 09:30$) at Enemy Base $(2800, 2800)$.
     - 6000 HP.
     - Acid Pool: shoots an acidic puddle at target; pool lingers for 6.0s, dealing 40 DoT magic damage and shredding 20% armor.
     - Roar of Fear: AoE silence shockwave (radius 350) silencing all enemies for 2.0s.
     - Slaying grants 150g killer + 150g team (+300g total).
   - **Supreme Boss: Nexus Guardian**:
     - Stationed as the final gatekeeper in front of the Enemy Nexus $(2450, 2450)$.
     - 12000 HP.
     - Enemy Nexus has `invulnerable = true` as long as Nexus Guardian is alive!
     - 3 Phases:
       - Phase 1 (HP $>66\%$): Frontal Cleave auto-attacks (180° frontal cone, 180 radius, 120 physical damage) + summons 2 void minions every 20s.
       - Phase 2 ($33\% < \text{HP} \le 66\%$): Meteor Rain (targets player positions with 1.5s delay warning circles, deals 300 magic damage) + passive Fire Aura (25 magic dmg/s in 200 radius).
       - Phase 3 ($\text{HP} \le 33\%$): Cataclysmic Shield (activates 8.0s Aegis of Ruin where all incoming damage is 0, during which it enrages with rapid attacks).
     - Slaying grants 500g killer + 500g team, dissolves boss, and permanently removes the Enemy Nexus invulnerability shield.

5. **Endgame Victory / Defeat Triggers**:
   - `evaluateMatchOutcome(alliedNexusHp, enemyNexusHp, supremeBossAlive)` evaluates match state:
     - If `alliedNexusHp <= 0` $\to$ `DEFEAT` (immediate game over).
     - If `enemyNexusHp <= 0 && !supremeBossAlive` $\to$ `VICTORY`.
     - Otherwise $\to$ `IN_PROGRESS`.
   - In `GameSimulation`, when `outcome.isOver` is true:
     - `this.isVictory = (outcome.outcome === 'VICTORY')`
     - `this.isDefeat = (outcome.outcome === 'DEFEAT')`
     - Halts input commands, and `Renderer.pass7_ScreenHUD` displays the full-screen "VITÓRIA" or "DERROTA" announcement.

---

## 3. Caveats
- **Nexus Invulnerability Link**: The Enemy Nexus must query `supremeBoss.isAlive()` or `bossManager.isSupremeBossAlive()` in its `isInvulnerable()` or `takeDamage()` check. If players attack the Enemy Nexus before the Supreme Boss dies, damage must be 0 and floating text "INVULNERABLE" should appear.
- **Wave Spawning Stagger**: Spawning 6 or 7 minions on the exact same coordinate without stagger causes them to overlap completely, making them look like a single minion until they collide with enemies. A staggered release queue (0.35s delay) with minor lateral spacing ($\pm 15$ units) provides clean visual separation.
- **Leash Aggro Exploit Prevention**: During `LEASH_RETURN`, minions must not re-acquire targets until they have returned within 50 units of their lane waypoint. Otherwise, players can repeatedly leash minions back and forth in an infinite aggro loop.

---

## 4. Conclusion & Concrete Instructions for Worker

The Worker should implement two new modules (`src/world/minion.js` and `src/world/boss.js`) and integrate them into `src/game.js`:

### 4.1 Specification for `src/world/minion.js`

#### Required Exports:
```javascript
export const WAVE_INTERVAL = 60.0; // 60s between waves
export const FIRST_WAVE_TIME = 30.0; // First wave spawns at 00:30
export const LEASH_MAX_DISTANCE = 400; // Leash break distance

export const LANE_WAYPOINTS = [
  { x: 400, y: 400 },   // WP0: Allied base
  { x: 800, y: 800 },   // WP1: Outer allied
  { x: 1200, y: 1200 }, // WP2: Inner allied
  { x: 1600, y: 1600 }, // WP3: Center river
  { x: 2000, y: 2000 }, // WP4: Inner enemy
  { x: 2400, y: 2400 }, // WP5: Outer enemy
  { x: 2800, y: 2800 }  // WP6: Enemy base
];

export const MinionAIState = {
  MARCH: 'MARCH',
  ACQUIRE: 'ACQUIRE',
  ATTACK: 'ATTACK',
  PURSUE: 'PURSUE',
  LEASH_RETURN: 'LEASH_RETURN'
};

export const MINION_BASE_STATS = {
  melee: {
    hp: 450, hpGrowth: 20,
    ad: 20, adGrowth: 2,
    armor: 10, mr: 0,
    speed: 280, range: 110,
    attackSpeed: 1.0,
    bounty: 21,
    radius: 14, height: 26
  },
  ranged: {
    hp: 280, hpGrowth: 15,
    ad: 28, adGrowth: 2,
    armor: 0, mr: 0,
    speed: 280, range: 350,
    attackSpeed: 0.8,
    projectileSpeed: 600,
    bounty: 14,
    radius: 14, height: 26
  },
  cannon: {
    hp: 800, hpGrowth: 40,
    ad: 45, adGrowth: 3,
    armor: 20, mr: 10,
    speed: 260, range: 450,
    attackSpeed: 0.65,
    projectileSpeed: 700,
    bounty: 45,
    structureDamageMultiplier: 1.5,
    radius: 20, height: 34
  }
};

export function getWaveComposition(waveIndex) {
  const isCannonWave = waveIndex % 3 === 0;
  return {
    waveIndex,
    meleeCount: 3,
    rangedCount: 3,
    cannonCount: isCannonWave ? 1 : 0,
    totalUnits: isCannonWave ? 7 : 6
  };
}

export function shouldDisengageLeash(minionPos, currentWaypointPos) {
  const dist = Math.hypot(minionPos.x - currentWaypointPos.x, minionPos.y - currentWaypointPos.y);
  return dist > LEASH_MAX_DISTANCE;
}

export function resolveMinionDeath(minionType, killerEntity, nearbyAllies = []) {
  const bounties = {
    melee: 21,
    ranged: 14,
    cannon: 45
  };

  const baseBounty = bounties[minionType] || 0;

  if (!killerEntity || killerEntity.type !== 'hero') {
    return {
      awardedKillerGold: 0,
      awardedAssistGold: [],
      reason: 'denied_by_non_hero'
    };
  }

  const assists = [];
  if (nearbyAllies.length > 0) {
    const assistAmount = Math.floor(baseBounty * 0.30);
    for (const ally of nearbyAllies) {
      if (ally.id !== killerEntity.id) {
        assists.push({
          heroId: ally.id,
          gold: assistAmount
        });
      }
    }
  }

  return {
    awardedKillerGold: baseBounty,
    awardedAssistGold: assists,
    reason: 'hero_last_hit'
  };
}
```

#### Minion Class: `MinionUnit` (extends `Entity`)
- Properties:
  - `subType`: `'melee' | 'ranged' | 'cannon'`
  - `team`: `'allied' | 'enemy'`
  - `waveIndex`: number
  - `waypointIndex`: `team === 'allied' ? 0 : 6`
  - `targetWaypoint`: `LANE_WAYPOINTS[this.waypointIndex]`
  - `aiState`: `MinionAIState.MARCH`
  - `targetEntity`: `null`
  - `attackCooldown`: `0`
  - `leashOrigin`: `null`
- Methods:
  - `update(dt, entities, projectiles, particles)`:
    1. If dead, stop.
    2. Tick `attackCooldown = Math.max(0, attackCooldown - dt)`.
    3. State Machine:
       - `MARCH`:
         - Move toward `LANE_WAYPOINTS[this.waypointIndex]`.
         - If `distToWaypoint <= 45`:
           - If allied and `waypointIndex < 6`: `waypointIndex++`.
           - If enemy and `waypointIndex > 0`: `waypointIndex--`.
         - Scan for enemies within 300 radius. If found, pick best target $\to$ transition to `ACQUIRE`.
       - `ACQUIRE`:
         - If target invalid or dead, return to `MARCH`.
         - If distance to target $\le$ weapon range $\to$ `ATTACK`.
         - Else $\to$ `PURSUE`.
       - `PURSUE`:
         - Check leash: `shouldDisengageLeash(this, currentWaypoint)`. If true $\to$ `LEASH_RETURN`.
         - Move toward target. If within range $\to$ `ATTACK`.
         - If target dies or lost $\to$ `MARCH`.
       - `ATTACK`:
         - Check leash: if exceeded $\to$ `LEASH_RETURN`.
         - If target out of weapon range $\to$ `PURSUE`.
         - If `attackCooldown <= 0`:
           - Face target.
           - If melee: deal instant damage via `combat.applyDamage` or `target.takeDamage`.
           - If ranged/cannon: spawn projectile moving at projectileSpeed toward target.
           - Reset `attackCooldown = 1.0 / this.attackSpeed`.
       - `LEASH_RETURN`:
         - Drop target (`targetEntity = null`).
         - Move toward `LANE_WAYPOINTS[this.waypointIndex]`.
         - If `distToWaypoint <= 50` $\to$ resume `MARCH`.
  - `draw(ctx, camera, zoom)`:
    - 2.5D styled cylinder/disc with color coding (Allied `#0284c7`, Enemy `#b91c1c`).
    - Facing direction indicator.
    - Cannon minion draws larger body with gold armor trim and siege barrel.
  - `drawHUD(ctx, camera, zoom)`:
    - Overhead health bar (width 36 for melee/ranged, width 46 for cannon).

#### Spawner Class: `WaveSpawner`
- Properties:
  - `matchTime`: 0
  - `waveIndex`: 0
  - `nextWaveTime`: `FIRST_WAVE_TIME` (30.0s)
  - `spawnQueue`: array of `{ team, subType, waveIndex, delayRemaining, spawnX, spawnY }`
- Methods:
  - `update(dt, entities, onMinionSpawned)`:
    - `matchTime += dt`
    - If `matchTime >= nextWaveTime`:
      - `waveIndex++`
      - Queue allied wave at $(400, 400)$ and enemy wave at $(2800, 2800)$ using `getWaveComposition(waveIndex)`.
      - `nextWaveTime += WAVE_INTERVAL`
    - Process `spawnQueue`:
      - Decrement `delayRemaining`.
      - When $\le 0$, instantiate `MinionUnit` and add to `entities`.

---

### 4.2 Specification for `src/world/boss.js`

#### Required Exports:
```javascript
export const BOSS_CONFIGS = {
  colossus: {
    id: 'boss_colossus',
    name: 'Stone Colossus',
    spawnWave: 5,
    maxHp: 3500,
    towerDamageReduction: 0.40, // takes 40% less damage from towers
    slamRadius: 220,
    slamStunDuration: 1.5,
    bountyKiller: 150,
    bountyTeam: 150,
    buff: { name: 'Colossus Might', duration: 60, adBonusPercent: 0.15, apBonusPercent: 0.15 }
  },
  behemoth: {
    id: 'boss_behemoth',
    name: 'Abyssal Behemoth',
    spawnWave: 10,
    maxHp: 6000,
    silenceDuration: 2.0,
    bountyKiller: 150,
    bountyTeam: 150
  },
  supreme: {
    id: 'boss_supreme',
    name: 'Nexus Guardian',
    maxHp: 12000,
    bountyKiller: 500,
    bountyTeam: 500
  }
};

export class SupremeBoss {
  constructor() {
    this.id = BOSS_CONFIGS.supreme.id;
    this.name = BOSS_CONFIGS.supreme.name;
    this.maxHp = BOSS_CONFIGS.supreme.maxHp;
    this.hp = this.maxHp;
    this.shieldActive = false;
  }

  get phase() {
    const ratio = this.hp / this.maxHp;
    if (ratio > 0.66) return 1; // Frontal Cleave
    if (ratio > 0.33) return 2; // Meteor Rain
    return 3;                   // Cataclysmic Shield / Enrage
  }

  takeDamage(amount) {
    if (this.shieldActive) {
      return { damageTaken: 0, shielded: true, isDead: false };
    }
    const taken = Math.min(this.hp, amount);
    this.hp -= taken;
    return { damageTaken: taken, shielded: false, isDead: this.hp <= 0 };
  }
}

export function evaluateMatchOutcome(alliedNexusHp, enemyNexusHp, supremeBossAlive) {
  if (alliedNexusHp <= 0) {
    return { outcome: 'DEFEAT', isOver: true };
  }
  if (enemyNexusHp <= 0 && !supremeBossAlive) {
    return { outcome: 'VICTORY', isOver: true };
  }
  return { outcome: 'IN_PROGRESS', isOver: false };
}
```

#### Concrete Boss Classes (extending `Entity`):
1. **`StoneColossusBoss`**:
   - `maxHp = 3500`, `hp = 3500`, `radius = 35`, `height = 70`, `speed = 220`, `team = 'enemy'`, `type = 'boss'`.
   - `towerDamageReduction = 0.40`.
   - Ability: `Ground Slam`:
     - Triggers when target in 220 radius; channels 1.2s with visible expanding telegraph circle.
     - On completion: 250 physical damage + applies 1.5s Stun to all player heroes / allied creeps in range.
     - Cooldown 10s.
   - On Slain: awards 150g killer + 150g team, grants "Colossus Might" (+15% AD/AP for 60s).

2. **`AbyssalBehemothBoss`**:
   - `maxHp = 6000`, `hp = 6000`, `radius = 42`, `height = 80`, `speed = 210`, `team = 'enemy'`, `type = 'boss'`.
   - Ability 1: `Acid Spit`:
     - Leaves 6.0s ground acid pool (radius 100) dealing 40 DoT magic damage and shredding 20% armor.
   - Ability 2: `Roar of Fear`:
     - Emits shockwave (radius 350) silencing all enemies for 2.0s. Cooldown 12s.
   - On Slain: awards 150g killer + 150g team.

3. **`NexusGuardianBoss`** (combines `SupremeBoss` contract with `Entity`):
   - `maxHp = 12000`, `hp = 12000`, `radius = 50`, `height = 95`, `team = 'enemy'`, `type = 'boss'`.
   - Stationed at $(2450, 2450)$.
   - `get phase()`: 1 ($>66\%$), 2 ($>33\%$), 3 ($\le 33\%$).
   - Phase 1: Frontal Cleave (180° cone, 180 range, 120 dmg) + Void Minion Summons (2 void minions every 20s).
   - Phase 2: Meteor Rain (3-5 target circles with 1.5s delay, 300 magic damage) + Fire Aura (25 magic dmg/s in 200 radius).
   - Phase 3: Cataclysmic Shield / Aegis of Ruin (8.0s invulnerability `shieldActive = true`, absorbs all damage) + Enrage (+30% attack speed).
   - Keeps Enemy Nexus invulnerable while alive.
   - On Slain: Enemy Nexus invulnerability shield drops permanently; awards 500g killer + 500g team.

#### Boss Manager: `BossManager`
- Manages active bosses, hazards (acid pools, meteor telegraphs), ability timers, and top-of-screen Boss Health Bar.
- Provides `isSupremeBossAlive()` for Nexus invulnerability and victory checks.

---

### 4.3 Integration into `GameSimulation` (`src/game.js`)

1. Import `WaveSpawner` and `MinionUnit` from `./world/minion.js`.
2. Import `BossManager`, `SupremeBoss`, and `evaluateMatchOutcome` from `./world/boss.js`.
3. In `init()`:
   - Initialize `this.waveSpawner = new WaveSpawner(this);`
   - Initialize `this.bossManager = new BossManager(this);`
   - Ensure `enemyNexus` links invulnerability to `this.bossManager.isSupremeBossAlive()`.
4. In `update(dt)`:
   - `this.waveSpawner.update(dt, this.entities);`
   - `this.bossManager.update(dt, this.entities);`
   - Evaluate match outcome:
     ```javascript
     const alliedNexus = this.entities.find(e => e.id === 'nexus_allied');
     const enemyNexus = this.entities.find(e => e.id === 'nexus_enemy');
     const outcome = evaluateMatchOutcome(
       alliedNexus ? alliedNexus.hp : 0,
       enemyNexus ? enemyNexus.hp : 0,
       this.bossManager.isSupremeBossAlive()
     );
     if (outcome.isOver) {
       if (outcome.outcome === 'VICTORY') this.isVictory = true;
       if (outcome.outcome === 'DEFEAT') this.isDefeat = true;
     }
     ```

---

## 5. Verification Method

To independently verify the implementation:
1. **Minion Unit Tests**:
   ```bash
   node tests/runner.js minion
   ```
   *Expected*: All 7 tests in `tests/unit/minion.test.js` pass cleanly (TC-MIN-01 to TC-MIN-07).
2. **Boss Unit Tests**:
   ```bash
   node tests/runner.js boss
   ```
   *Expected*: All 7 tests in `tests/unit/boss.test.js` pass cleanly (TC-BOS-01 to TC-BOS-07).
3. **End-to-End Real Match Walkthrough**:
   ```bash
   node tests/runner.js real_world_match
   ```
   *Expected*: TC-E2E-MATCH-01 passes cleanly from wave spawning through boss fights to Victory.
4. **Full Test Suite & Combinatorial Stress**:
   ```bash
   node tests/runner.js
   ```
   *Expected*: 100% of tests (118+ tests) pass with 0 failures.

### Invalidation Conditions:
- If `LANE_WAYPOINTS[0].x !== 400` or `LANE_WAYPOINTS[6].x !== 2800`, TC-MIN-03 will fail.
- If `getWaveComposition(3).cannonCount !== 1`, TC-MIN-02 will fail.
- If `shouldDisengageLeash` does not use `> 400`, TC-MIN-04 will fail.
- If `SupremeBoss.phase` transitions do not occur at 66% and 33%, TC-BOS-04 will fail.
- If `evaluateMatchOutcome` declares victory while `supremeBossAlive === true`, TC-BOS-06 will fail.
