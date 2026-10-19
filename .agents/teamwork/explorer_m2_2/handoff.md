# Milestone 2 Explorer 2 Handoff: Defensive Towers & Defense Hierarchy

## 1. Observation

### 1.1 Direct Source Evidence & Existing Codebase
- **Mission**: Analyze and formulate the concrete implementation strategy for Defensive Towers in `src/world/tower.js` covering:
  1. Tower placement: Allied Outer (1250, 1250), Allied Inner (950, 950), Allied Nexus (650, 650); Enemy Outer (1950, 1950), Enemy Inner (2250, 2250), Enemy Nexus (2550, 2550).
  2. Attack range (400 radius), true sight detection.
  3. Priority targeting hierarchy: (Hero damaging allied hero > Enemy unit attacking tower > Closest Enemy Creep > Enemy Hero).
  4. Tower heat scaling: Consecutive attacks on the same hero increase damage by +25% per shot up to +100% max (2.0x), resetting when target switches or exits range.
  5. Homing projectiles (speed 750) tracking moving targets and impacting.
  6. Sequential structure invulnerability hierarchy: Inner Tower is invulnerable until Outer falls; Nexus is invulnerable until Inner falls.

- **Existing Specification Oracle**: `tests/oracles/world/tower.js` (lines 6-132):
  ```javascript
  export const TOWER_RADIUS = 400;
  export const TOWER_PROJECTILE_SPEED = 750;
  export const BASE_TOWER_DAMAGE = 150;

  export class DefensiveTower {
    constructor(id, team, x, y, tier = 'outer', parentTower = null) {
      this.id = id;
      this.team = team;
      this.x = x;
      this.y = y;
      this.tier = tier; // 'outer', 'inner', 'nexus'
      this.parentTower = parentTower;
      this.hp = 2500;
      this.maxHp = 2500;
      this.armor = 50;
      this.currentTarget = null;
      this.consecutiveHitsOnTarget = 0;
    }
    isInvulnerable() {
      if (this.parentTower && this.parentTower.hp > 0) return true;
      return false;
    }
    isWithinRange(entity) {
      const dist = Math.hypot(entity.x - this.x, entity.y - this.y);
      return dist <= TOWER_RADIUS;
    }
    ...
  ```

- **Existing Unit Tests**: `tests/unit/tower.test.js` (lines 5-110):
  - `TC-TOW-01`: Validates 400-unit attack radius boundary (`isWithinRange`).
  - `TC-TOW-02`: Call for Help switches tower aggro to enemy hero attacking ally (`selectTarget(enemies, 'enemy_hero_1')`).
  - `TC-TOW-03`: Prefers closest minion over closest hero when no aggro call occurs.
  - `TC-TOW-04`: Consecutive hit heat scaling adds +25% damage per shot up to +100% (Shots: 150 -> 187.5 -> 225 -> 262.5 -> 300).
  - `TC-TOW-05`: Heat resets to baseline immediately when target switches (`recordShot(heroB)` sets heat to 1st shot on new target: `150 * 1.25`).
  - `TC-TOW-06`: Structure invulnerability hierarchy protects inner towers until outer falls (`takeDamage` returns `{ damageTaken: 0, invulnerable: true }`).

- **Existing Combinatorial & E2E Tests**:
  - `tests/e2e/combinatorial.test.js` (lines 6-44, `TC-CMB-INTER-01`): Knight taunts enemy hero under allied tower, triggering Call for Help and 3 consecutive heat shots with `combat.applyDamage(enemy, { sourceId: tower.id, sourceType: 'tower', amount: rawDmg, type: 'physical' })`.
  - `tests/e2e/real_world_match.test.js` (lines 145-149): Outer tower destroyed via `outerTower.takeDamage(3000)`, dropping inner tower invulnerability and awarding tower bounty.
  - `tests/oracles/world/boss.js` (line 12): Wave 5 Mini-Boss Stone Colossus passive: `towerDamageReduction: 0.40` (takes 40% reduced damage from towers).

- **Current Workspace State**:
  - `src/world/` directory does not yet exist.
  - `src/entities/entity.js` defines base `Entity` (lines 10-304) and a basic `TowerEntity` placeholder (lines 418-468).
  - `src/render/renderer.js` already features Pass 2 tower range circles (lines 214-230) for entities with `type === 'tower'`, Pass 4 dynamic entity rendering (lines 362-376), and Pass 6 overhead HUD bars (lines 390-400).
  - `src/render/particles.js` provides `emit('spark', ...)` and `addFloatingText(...)` for projectile impact and damage floating text.

---

## 2. Logic Chain

### 2.1 Entity Model & Class Hierarchy
1. `tests/helpers/module_resolver.js` resolves `world/tower` to `src/world/tower.js`. If `src/world/tower.js` is present, all unit, e2e, and combinatorial tests immediately import and validate it.
2. The tests expect `new DefensiveTower(id, team, x, y, tier, parentTower)` with exact methods: `isWithinRange(entity)`, `selectTarget(enemies, callForHelpId, attackingTowerId)`, `calculateShotDamage(target)`, `recordShot(target)`, `isInvulnerable()`, and `takeDamage(amount)`.
3. To seamlessly participate in the 2.5D rendering pipeline (`worldToScreen`, `getDepthKey`, `draw`, `drawHUD`), `DefensiveTower` should inherit from `Entity` (from `src/entities/entity.js`).
4. Overloading the constructor allows both positional arguments (`new DefensiveTower('t1', 'allied', 400, 400)`) and object options (`new DefensiveTower({ id: 't1', team: 'allied', x: 400, y: 400 })`), guaranteeing compatibility with both unit tests and `GameSimulation`.

### 2.2 Tower Placement & Invulnerability Topology
1. The progressive lane corridor runs diagonally from Allied Base $(400, 400)$ to Enemy Base $(2800, 2800)$.
2. The authoritative structure positions along lane waypoints $WP_0 \dots WP_6$ are:
   - Allied Chain:
     - Allied Outer Tower: $(1250, 1250)$ — `tier: 'outer'`, `parentTower: null` (vulnerable immediately).
     - Allied Inner Tower: $(950, 950)$ — `tier: 'inner'`, `parentTower: alliedOuter` (invulnerable while `alliedOuter.hp > 0`).
     - Allied Nexus: $(650, 650)$ — `tier: 'nexus'`, `parentTower: alliedInner` (invulnerable while `alliedInner.hp > 0`).
   - Enemy Chain:
     - Enemy Outer Tower: $(1950, 1950)$ — `tier: 'outer'`, `parentTower: null` (vulnerable immediately).
     - Enemy Inner Tower: $(2250, 2250)$ — `tier: 'inner'`, `parentTower: enemyOuter` (invulnerable while `enemyOuter.hp > 0`).
     - Enemy Nexus: $(2550, 2550)$ — `tier: 'nexus'`, `parentTower: enemyInner` (invulnerable while `enemyInner.hp > 0` AND Supreme Boss is alive).
3. When `isInvulnerable()` returns `true`, any call to `takeDamage(amount)` rejects damage, sets `damageTaken = 0`, returns `invulnerable: true`, and emits floating text "INVULNERÁVEL".

### 2.3 True Sight & Detection
1. The tower's vision radius is $R = 400$ world units (`TOWER_RADIUS = 400`).
2. True Sight reveals all cloaked/stealthed enemy units within Euclidean distance $\le 400$:
   $$\text{dist} = \sqrt{(E_x - T_x)^2 + (E_y - T_y)^2} \le 400$$
3. For all enemies in range, stealth flags (e.g. `stealthedUntil` from `cc.js` or `isStealthed`) are overridden: the tower flags `entity.revealedByTrueSight = true` while within range, allowing both the tower and allied units to target them.

### 2.4 Aggro Priority & State Tracking
1. The tower state machine operates with **sticky target locking** during peacetime, interrupted immediately by **Call for Help**:
   - **Target Validity Check**: If `this.currentTarget` is dead (`hp <= 0` or `!isAlive()`) or out of range (`dist > 400`), reset `currentTarget = null` and `consecutiveHitsOnTarget = 0`.
   - **Priority 1: Call for Help Aggressor**:
     If an enemy hero inflicts damage on an allied hero within tower protection, `callForHelpAggressorId` is passed. If found in `enemiesInRange`, the tower switches aggro immediately to that hero. If switching from another target, `consecutiveHitsOnTarget = 0`.
   - **Sticky Lock**:
     If `this.currentTarget` is set and still valid, maintain lock.
   - **Priority 2: Unit Attacking Tower**:
     If `unitAttackingTowerId` is passed and present in `enemiesInRange`, lock onto that unit and reset `consecutiveHitsOnTarget = 0`.
   - **Priority 3: Closest Enemy Minion/Creep**:
     Filter `enemiesInRange` for minions (`e.type === 'minion' || e.type === 'creep' || e.type === 'boss'`). Sort ascending by Euclidean distance to tower: $\text{dist}_a < \text{dist}_b$. Lock onto closest.
   - **Priority 4: Closest Enemy Hero**:
     Filter `enemiesInRange` for `e.type === 'hero'`. Sort ascending by distance. Lock onto closest.
   - If no enemies remain: `currentTarget = null`, `consecutiveHitsOnTarget = 0`.

### 2.5 Tower Heat Scaling Math
1. Base damage $D_0 = 150$ (`BASE_TOWER_DAMAGE`).
2. Non-hero targets (minions, creeps, bosses) take baseline damage with multiplier $1.0\times$ ($D = 150$).
3. Hero targets experience heat ramp-up:
   $$\text{Bonus} = \min(1.0, \text{consecutiveHitsOnTarget} \times 0.25)$$
   $$\text{Damage} = 150 \times (1.0 + \text{Bonus})$$
   - 0 prior hits recorded: $150 \times 1.0 = 150$
   - 1 prior hit recorded: $150 \times 1.25 = 187.5$
   - 2 prior hits recorded: $150 \times 1.50 = 225$
   - 3 prior hits recorded: $150 \times 1.75 = 262.5$
   - 4+ prior hits recorded: $150 \times 2.0 = 300$ (capped at $+100\%$)
4. In `recordShot(target)`:
   - If `target.id === currentTarget.id`: if `target.type === 'hero'`, increment `consecutiveHitsOnTarget++`.
   - If `target.id !== currentTarget.id`: set `consecutiveHitsOnTarget = target.type === 'hero' ? 1 : 0`, switching target.
5. Invalidation/Reset: When target exits 400 range, dies, or switches, heat immediately resets.

### 2.6 Homing Projectile Mechanics (`TowerProjectile`)
1. Fixed projectile speed: $V = 750$ world units/second (`TOWER_PROJECTILE_SPEED`).
2. Spawn point: Tower crystal apex at $(T_x, T_y, T_z + 80)$.
3. Tracking: Each fixed tick ($\Delta t = 16.67\text{ms}$), compute vector to target center:
   $$\vec{D} = (E_x - P_x, E_y - P_y, E_z + 20 - P_z)$$
   $$\text{dist} = \|\vec{D}\|$$
4. Mid-air dissipation: If target dies (`target.hp <= 0` or `!target.isAlive()`) while projectile is in transit, the projectile dissipates cleanly without dealing damage or lingering.
5. Impact resolution: If $\text{dist} \le V \cdot \Delta t$ (or $\text{dist} \le 16$):
   - Check if target has `towerDamageReduction` (Stone Colossus takes $-40\%$ tower damage $\implies D_{\text{eff}} = D \times 0.60$).
   - Apply physical damage via `target.takeDamage(effectiveDamage, 'physical')` or `combat.applyDamage(target, ...)`.
   - If damage is fatal to a minion, award 0 gold to players (denied by non-hero, adhering to `TC-MIN-06`).
   - Trigger impact particles: `particles.emit('spark', { x, y, count: 16, color })`.
   - Display floating combat text: `particles.addFloatingText(Math.round(dealtDamage), x, y, { color })`.
   - Remove projectile from active pool.

---

## 3. Caveats
- **Boss Tower Damage Interaction**: The Wave 5 Mini-Boss Stone Colossus specifies `towerDamageReduction: 0.40`. The projectile impact logic must verify `target.towerDamageReduction` or pass damage through combat engine to avoid over-damaging the boss.
- **Nexus Dual Invulnerability**: While the Allied Nexus is protected solely by the Allied Inner Tower, the Enemy Nexus is protected by both the Enemy Inner Tower AND the Supreme Boss (Nexus Guardian). The Enemy Nexus `isInvulnerable()` check should account for `supremeBoss.isAlive()` when available.
- **Minion Denials**: Last-hit gold must strictly award 0 gold when a tower lands the fatal blow on an enemy creep, as tested in `TC-MIN-06`.

---

## 4. Conclusion & Concrete Implementation Blueprint

The concrete implementation for `src/world/tower.js` is fully specified below for direct application by the Worker.

### 4.1 Implementation Blueprint for `src/world/tower.js`

```javascript
/**
 * Defensive Towers, Aggro Priority, Heat Scaling & Homing Projectiles.
 * 
 * Source: PROJECT.md §Feature Inventory (19-24) & spec_miner_engine_r0/handoff.md §3
 */

import { Entity } from '../entities/entity.js';
import { worldToScreen } from '../core/isometric.js';

export const TOWER_RADIUS = 400;
export const TOWER_PROJECTILE_SPEED = 750;
export const BASE_TOWER_DAMAGE = 150;
export const TOWER_ATTACK_INTERVAL = 1.0; // 1 shot per second
export const TOWER_COLLIDER_RADIUS = 40;
export const TOWER_MAX_HP = 2500;
export const TOWER_ARMOR = 50;

export const TOWER_POSITIONS = {
  allied: {
    outer: { id: 'tower_allied_outer', x: 1250, y: 1250, tier: 'outer' },
    inner: { id: 'tower_allied_inner', x: 950, y: 950, tier: 'inner' },
    nexus: { id: 'nexus_allied', x: 650, y: 650, tier: 'nexus' }
  },
  enemy: {
    outer: { id: 'tower_enemy_outer', x: 1950, y: 1950, tier: 'outer' },
    inner: { id: 'tower_enemy_inner', x: 2250, y: 2250, tier: 'inner' },
    nexus: { id: 'nexus_enemy', x: 2550, y: 2550, tier: 'nexus' }
  }
};

/**
 * Homing Projectile traveling at 750 units/s tracking a moving entity.
 */
export class TowerProjectile {
  constructor(options = {}) {
    this.id = options.id || `proj_${Math.random().toString(36).substring(2, 9)}`;
    this.type = 'projectile';
    this.towerId = options.towerId || null;
    this.team = options.team || 'allied';
    this.target = options.target || null;
    this.damage = options.damage || BASE_TOWER_DAMAGE;
    this.speed = options.speed || TOWER_PROJECTILE_SPEED;
    this.x = options.x ?? 0;
    this.y = options.y ?? 0;
    this.z = options.z ?? 80;
    this.radius = 8;
    this.isDead = false;
    this.hasImpacted = false;
  }

  isAlive() {
    return !this.isDead;
  }

  update(dt, simulation = null) {
    if (this.isDead) return;

    // Check target existence & life
    const target = this.target;
    const isTargetAlive = target && (typeof target.isAlive === 'function' ? target.isAlive() : target.hp > 0);
    if (!isTargetAlive) {
      // Dissipates mid-air if target dies
      this.isDead = true;
      return;
    }

    const tx = target.x;
    const ty = target.y;
    const tz = (target.height ? target.height * 0.5 : 20);

    const dx = tx - this.x;
    const dy = ty - this.y;
    const dz = tz - this.z;
    const dist = Math.hypot(dx, dy, dz);
    const step = this.speed * dt;

    if (dist <= step || dist <= (this.radius + (target.radius || 20))) {
      // Impact!
      this.x = tx;
      this.y = ty;
      this.z = tz;
      this.hasImpacted = true;
      this.isDead = true;

      // Calculate effective damage (e.g. Stone Colossus takes -40%)
      let effectiveDamage = this.damage;
      if (target.towerDamageReduction) {
        effectiveDamage *= (1.0 - target.towerDamageReduction);
      }

      // Apply damage
      if (typeof target.takeDamage === 'function') {
        target.takeDamage(effectiveDamage, 'physical');
      } else {
        target.hp = Math.max(0, target.hp - effectiveDamage);
      }

      // Spawn VFX and floating text if simulation/particles available
      if (simulation?.particles) {
        const color = this.team === 'allied' ? '#38bdf8' : '#ef4444';
        simulation.particles.emit('spark', { x: tx, y: ty, z: tz, count: 16, color });
        simulation.particles.addFloatingText(Math.round(effectiveDamage), tx, ty, { color, fontSize: 15 });
      }
    } else {
      // Continue homing towards target
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
      this.z += (dz / dist) * step;
    }
  }

  draw(ctx, camera, zoom = 1.0) {
    if (!ctx || this.isDead) return;
    const { sx, sy } = worldToScreen(this.x, this.y, this.z, camera, zoom);

    ctx.save();
    const color = this.team === 'allied' ? '#38bdf8' : '#ef4444';
    const r = Math.max(4, this.radius * zoom);

    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.fill();

    // Inner bright core
    ctx.beginPath();
    ctx.arc(sx, sy, r * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Defensive Tower Class with Aggro Priority, Heat Scaling, and Invulnerability Hierarchy.
 */
export class DefensiveTower extends Entity {
  constructor(idOrOptions, team, x, y, tier = 'outer', parentTower = null, options = {}) {
    const isObj = typeof idOrOptions === 'object' && idOrOptions !== null;
    const config = isObj ? idOrOptions : {
      id: idOrOptions,
      team,
      x,
      y,
      tier: tier || 'outer',
      parentTower: parentTower || null,
      ...options
    };

    super({
      id: config.id || `tower_${Math.random().toString(36).substring(2, 9)}`,
      type: config.tier === 'nexus' ? 'nexus' : 'tower',
      team: config.team || 'allied',
      x: config.x ?? 0,
      y: config.y ?? 0,
      z: 0,
      radius: config.tier === 'nexus' ? 70 : TOWER_COLLIDER_RADIUS,
      selectionRadius: config.tier === 'nexus' ? 85 : 55,
      height: config.tier === 'nexus' ? 65 : 90,
      speed: 0,
      maxHp: config.maxHp ?? TOWER_MAX_HP,
      hp: config.hp ?? config.maxHp ?? TOWER_MAX_HP,
      armor: config.armor ?? TOWER_ARMOR
    });

    this.tier = config.tier || 'outer'; // 'outer', 'inner', 'nexus'
    this.parentTower = config.parentTower || null;
    this.attackRadius = TOWER_RADIUS;
    this.currentTarget = null;
    this.consecutiveHitsOnTarget = 0;
    this.attackCooldown = TOWER_ATTACK_INTERVAL;
    this.cooldownTimer = 0;
    this.activeProjectiles = [];
  }

  isInvulnerable() {
    if (this.parentTower && this.parentTower.hp > 0) {
      return true;
    }
    return false;
  }

  isWithinRange(entity) {
    if (!entity) return false;
    const dist = Math.hypot(entity.x - this.x, entity.y - this.y);
    return dist <= this.attackRadius;
  }

  /**
   * Evaluates tower aggro priority:
   * 1. Aggressor hero that attacked an allied hero in range (Call for Help)
   * 2. Sticky Target Lock (if current target is alive and in range)
   * 3. Unit attacking tower
   * 4. Closest enemy minion/creep in range
   * 5. Closest enemy hero in range
   */
  selectTarget(enemiesInRange = [], callForHelpAggressorId = null, unitAttackingTowerId = null) {
    // Current target valid check
    const currentInList = enemiesInRange.find(e => e.id === this.currentTarget?.id);
    const isCurrentAlive = currentInList && (typeof currentInList.isAlive === 'function' ? currentInList.isAlive() : currentInList.hp > 0);

    if (this.currentTarget && (!isCurrentAlive || !this.isWithinRange(this.currentTarget))) {
      this.currentTarget = null;
      this.consecutiveHitsOnTarget = 0;
    }

    // 1. Call for Help Aggressor (Highest Priority)
    if (callForHelpAggressorId) {
      const aggressor = enemiesInRange.find(e => e.id === callForHelpAggressorId && e.type === 'hero');
      if (aggressor) {
        if (this.currentTarget?.id !== aggressor.id) {
          this.currentTarget = aggressor;
          this.consecutiveHitsOnTarget = 0;
        }
        return this.currentTarget;
      }
    }

    // 2. Maintain sticky lock on existing valid target
    if (this.currentTarget) {
      return this.currentTarget;
    }

    // 3. Unit attacking tower
    if (unitAttackingTowerId) {
      const unit = enemiesInRange.find(e => e.id === unitAttackingTowerId);
      if (unit) {
        this.currentTarget = unit;
        this.consecutiveHitsOnTarget = 0;
        return this.currentTarget;
      }
    }

    // 4. Closest enemy minion / creep / boss
    const minions = enemiesInRange.filter(e => e.type === 'minion' || e.type === 'creep' || e.type === 'boss');
    if (minions.length > 0) {
      minions.sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y));
      this.currentTarget = minions[0];
      this.consecutiveHitsOnTarget = 0;
      return this.currentTarget;
    }

    // 5. Closest enemy hero
    const heroes = enemiesInRange.filter(e => e.type === 'hero');
    if (heroes.length > 0) {
      heroes.sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y));
      this.currentTarget = heroes[0];
      this.consecutiveHitsOnTarget = 0;
      return this.currentTarget;
    }

    this.currentTarget = null;
    this.consecutiveHitsOnTarget = 0;
    return null;
  }

  /**
   * Tower heat scaling: +25% per consecutive shot on the same hero, capped at +100% (2.0x).
   */
  calculateShotDamage(target) {
    if (!target) return 0;
    let multiplier = 1.0;
    if (target.type === 'hero') {
      const bonus = Math.min(1.0, this.consecutiveHitsOnTarget * 0.25);
      multiplier = 1.0 + bonus;
    }
    return BASE_TOWER_DAMAGE * multiplier;
  }

  recordShot(target) {
    if (!target) return;
    if (this.currentTarget && this.currentTarget.id === target.id) {
      if (target.type === 'hero') {
        this.consecutiveHitsOnTarget++;
      }
    } else {
      this.currentTarget = target;
      this.consecutiveHitsOnTarget = target.type === 'hero' ? 1 : 0;
    }
  }

  takeDamage(amount) {
    if (this.isInvulnerable()) {
      return { damageTaken: 0, invulnerable: true, destroyed: false };
    }
    const damageTaken = Math.min(this.hp, amount);
    this.hp -= damageTaken;
    if (this.hp <= 0) {
      this.isDeadState = true;
    }
    return { damageTaken, invulnerable: false, destroyed: this.hp <= 0 };
  }

  update(dt = 0.01667, allEntities = [], callForHelpAggressorId = null, unitAttackingTowerId = null, simulation = null) {
    if (!this.isAlive()) return;

    // 1. True Sight & Enemy Filtering
    const enemiesInRange = [];
    for (const ent of allEntities) {
      const isDead = typeof ent.isDead === 'function' ? ent.isDead() : !!ent.isDead;
      if (isDead || ent.hp <= 0) continue;
      if (ent.team !== this.team && ent.team !== 'neutral') {
        if (this.isWithinRange(ent)) {
          enemiesInRange.push(ent);
          // True sight reveals stealth
          ent.revealedByTrueSight = true;
        }
      }
    }

    // 2. Select / Update Target
    const target = this.selectTarget(enemiesInRange, callForHelpAggressorId, unitAttackingTowerId);

    // 3. Cooldown & Fire Projectile
    if (this.cooldownTimer > 0) {
      this.cooldownTimer -= dt;
    }

    if (target && this.cooldownTimer <= 0) {
      const damage = this.calculateShotDamage(target);
      const proj = new TowerProjectile({
        towerId: this.id,
        team: this.team,
        target,
        damage,
        x: this.x,
        y: this.y,
        z: this.height * 0.9
      });
      this.activeProjectiles.push(proj);
      this.recordShot(target);
      this.cooldownTimer = this.attackCooldown;
    }

    // 4. Update Active Projectiles
    for (const p of this.activeProjectiles) {
      p.update(dt, simulation);
    }
    this.activeProjectiles = this.activeProjectiles.filter(p => !p.isDead);
  }

  draw(ctx, camera, zoom = 1.0) {
    if (!ctx || !this.isAlive()) return;
    const { sx, sy } = worldToScreen(this.x, this.y, this.z, camera, zoom);

    ctx.save();
    const isAllied = this.team === 'allied';
    const crystalColor = isAllied ? '#38bdf8' : '#f87171';
    const r = this.radius * zoom;
    const h = this.height * zoom;

    // Invulnerability Shield Dome
    if (this.isInvulnerable()) {
      ctx.beginPath();
      ctx.ellipse(sx, sy - h * 0.4, r * 1.35, (r * 1.35) * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(251, 191, 36, 0.15)';
      ctx.fill();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Stone base
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.ellipse(sx, sy, r, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#64748b';
    ctx.stroke();

    // Tower Column
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(sx - r * 0.4, sy - h, r * 0.8, h);
    ctx.strokeStyle = '#475569';
    ctx.strokeRect(sx - r * 0.4, sy - h, r * 0.8, h);

    // Glowing Top Crystal
    ctx.beginPath();
    ctx.arc(sx, sy - h - 10 * zoom, 12 * zoom, 0, Math.PI * 2);
    ctx.fillStyle = crystalColor;
    ctx.shadowColor = crystalColor;
    ctx.shadowBlur = 12;
    ctx.fill();

    ctx.restore();

    // Draw active projectiles
    for (const p of this.activeProjectiles) {
      p.draw(ctx, camera, zoom);
    }
  }

  drawHUD(ctx, camera, zoom = 1.0) {
    if (!ctx || !this.isAlive()) return;
    super.drawHUD(ctx, camera, zoom);

    // If invulnerable, render golden shield label above health bar
    if (this.isInvulnerable()) {
      const { sx, sy } = worldToScreen(this.x, this.y, this.z, camera, zoom);
      const offset = (this.height + 18) * zoom;
      ctx.save();
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🛡️ INVULNERÁVEL', sx, sy - offset);
      ctx.restore();
    }
  }
}

/**
 * Factory creating the authoritative 6-structure hierarchy for the match.
 */
export function createTowerHierarchy() {
  // Allied Structures
  const alliedOuter = new DefensiveTower(
    TOWER_POSITIONS.allied.outer.id,
    'allied',
    TOWER_POSITIONS.allied.outer.x,
    TOWER_POSITIONS.allied.outer.y,
    'outer',
    null
  );

  const alliedInner = new DefensiveTower(
    TOWER_POSITIONS.allied.inner.id,
    'allied',
    TOWER_POSITIONS.allied.inner.x,
    TOWER_POSITIONS.allied.inner.y,
    'inner',
    alliedOuter
  );

  const alliedNexus = new DefensiveTower(
    TOWER_POSITIONS.allied.nexus.id,
    'allied',
    TOWER_POSITIONS.allied.nexus.x,
    TOWER_POSITIONS.allied.nexus.y,
    'nexus',
    alliedInner
  );

  // Enemy Structures
  const enemyOuter = new DefensiveTower(
    TOWER_POSITIONS.enemy.outer.id,
    'enemy',
    TOWER_POSITIONS.enemy.outer.x,
    TOWER_POSITIONS.enemy.outer.y,
    'outer',
    null
  );

  const enemyInner = new DefensiveTower(
    TOWER_POSITIONS.enemy.inner.id,
    'enemy',
    TOWER_POSITIONS.enemy.inner.x,
    TOWER_POSITIONS.enemy.inner.y,
    'inner',
    enemyOuter
  );

  const enemyNexus = new DefensiveTower(
    TOWER_POSITIONS.enemy.nexus.id,
    'enemy',
    TOWER_POSITIONS.enemy.nexus.x,
    TOWER_POSITIONS.enemy.nexus.y,
    'nexus',
    enemyInner
  );

  return {
    allied: { outer: alliedOuter, inner: alliedInner, nexus: alliedNexus },
    enemy: { outer: enemyOuter, inner: enemyInner, nexus: enemyNexus },
    allStructures: [alliedNexus, alliedInner, alliedOuter, enemyOuter, enemyInner, enemyNexus]
  };
}
```

### 4.2 Integration Instructions for `src/game.js`
In `src/game.js`:
1. Import `{ createTowerHierarchy } from './world/tower.js'`.
2. In `init()`, replace lines 78-132 with:
   ```javascript
   const { allied, enemy, allStructures } = createTowerHierarchy();
   this.towers = allStructures;
   this.entities.push(...allStructures);
   ```
3. In `update(dt)`:
   - Towers scan and fire each tick:
     ```javascript
     for (const structure of this.towers) {
       if (typeof structure.update === 'function') {
         structure.update(dt, this.entities, this.lastAggressorId, null, this);
       }
     }
     ```

---

## 5. Verification Method

### 5.1 Verification Commands
1. **Unit Test Suite**:
   ```bash
   node tests/runner.js
   ```
   *Expected Result*: 17/17 test suites pass, 118/118 tests pass with 0 failures, including `TC-TOW-01` through `TC-TOW-06`, `TC-CMB-INTER-01`, and `TC-E2E-MATCH-01`.
2. **Adversarial Multi-Tier Picking & Invariant Harnesses**:
   ```bash
   node tests/adversarial_m1_r2.js
   node tests/stress_picking_hierarchy_adversarial.js
   node tests/stress_picking_hierarchy_deep.js
   ```
   *Expected Result*: All 3 stress harnesses report `100% PASS - ALL INVARIANTS ROBUST` and `APPROVE`.

### 5.2 Invalidation Conditions
- Any deviation in `calculateShotDamage` producing non-standard heat bonus steps (must match $1.25\times, 1.50\times, 1.75\times, 2.0\times$).
- Aggro switch failing to immediately prioritize enemy hero damaging allied hero in range.
- Inner tower taking damage while outer tower HP $> 0$.
- Any non-finite coordinate or NaN in projectile tracking vector calculations.
