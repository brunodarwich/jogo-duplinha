# Handoff Report: M2 Targeting Explorer 1
**Milestone 2**: Target Click, Auto-Attack & Hold/Stop Mechanics  
**Focus**: Duplicate `attackCooldown` Decrement Elimination (`src/game.js`) & 'A' Key Handling in `InputDispatcher.handleKeyDown` (`src/core/input.js`)

---

## 1. Observation

Direct code analysis of `src/game.js`, `src/entities/entity.js`, `src/core/input.js`, and test suites revealed the following exact facts:

### 1.1 Duplicate `attackCooldown` Decrement in `src/game.js`
In `src/game.js`, the primary simulation update loop (`GameSimulation.update(dt)`) executes the following sequence:

1. **First Decrement** (`src/game.js:972–990`):
   ```javascript
   for (const ent of this.entities) {
     if (ent.type === 'hero' && typeof ent.update === 'function') {
       ...
       ent.update(dt);
       ...
     }
   }
   ```
   `ent.update(dt)` executes `HeroEntity.update(dt)` in `src/entities/entity.js:505–508`:
   ```javascript
   // Basic attack cooldown tick
   if (this.attackCooldown > 0) {
     this.attackCooldown = Math.max(0, this.attackCooldown - dt);
   }
   ```
   This decrements `attackCooldown` by `dt`.

2. **Second Decrement** (`src/game.js:1025–1027` and `src/game.js:708–711`):
   Immediately following the entity loop, `GameSimulation.update` calls:
   ```javascript
   if (this.playerHero) {
     this.updateHeroCombat(dt, this.playerHero);
   }
   ```
   Inside `updateHeroCombat(dt, hero)` at `src/game.js:708–711`:
   ```javascript
   // Cooldown ticks
   if (hero.attackCooldown > 0) {
     hero.attackCooldown = Math.max(0, hero.attackCooldown - dt);
   }
   ```
   This decrements `hero.attackCooldown` by `dt` a second time within the exact same frame.

3. **Attack Cooldown Setting** (`src/game.js:773–775`):
   When attacking, cooldown is initialized to:
   ```javascript
   if (hero.canAttack && hero.canAttack() && hero.attackCooldown <= 0) {
     const as = Math.max(0.2, hero.attackSpeed || 0.65);
     hero.attackCooldown = 1.0 / as;
     this.executeHeroBasicAttack(hero, target);
   }
   ```
   Because `playerHero.attackCooldown` is decremented by `2 * dt` per frame, basic attack cooldown drains at 200% speed, allowing the player hero to attack twice as often as intended.

### 1.2 Missing 'A' Key Handling in `InputDispatcher.handleKeyDown`
1. In `src/core/input.js`, `InputManager.handleKeyDown` (`lines 581–600`) handles 'A'/'KeyA' by dispatching `CommandType.ATTACK_TARGET`:
   ```javascript
   if (key === 'KeyA' || key === 'a' || key === 'A') {
     if (this.playerHeroRef && isHeroAlive) {
       if (this.hoveredEntity && this.isHostile(this.hoveredEntity, this.playerHeroRef)) {
         this.dispatch({
           type: CommandType.ATTACK_TARGET,
           targetId: this.hoveredEntity.id,
           targetX: this.hoveredEntity.x,
           targetY: this.hoveredEntity.y,
           targetEntity: this.hoveredEntity
         });
       } else {
         this.dispatch({
           type: CommandType.ATTACK_TARGET,
           targetId: null,
           targetX: this.worldX,
           targetY: this.worldY,
           attackMove: true
         });
       }
     }
     return;
   }
   ```
2. In contrast, `InputDispatcher.handleKeyDown` (`src/core/input.js:113–177`) completely omits 'A' key handling:
   - Lines 117–153 handle `Q`, `W`, `E`, `R`.
   - Lines 156–159 handle `S`, `H`.
   - Lines 162–165 handle `B`.
   - Lines 168–174 handle `Escape`.
   - Any invocation with key `'A'` falls through to line 176: `return null;`.
   - Headless unit test environments and bots that use `InputDispatcher` cannot dispatch Attack-Move or target attack via key `'A'`.

---

## 2. Logic Chain

1. **Single-Rate Cooldown Law**:
   - Per game design specifications, an entity's cooldown properties (`attackCooldown`, `abilities[k].cooldownRemaining`, `respawnTimer`) are entity state variables updated during `HeroEntity.update(dt)`.
   - `HeroEntity.update(dt)` already safely decrements `this.attackCooldown` using `Math.max(0, this.attackCooldown - dt)`.
   - Therefore, having `updateHeroCombat(dt, hero)` also decrement `hero.attackCooldown` is redundant and mathematically invalid ($2\times dt$ total reduction).
   - Removing lines 708–711 in `src/game.js` ensures that `attackCooldown` decreases by exactly $1.0 \times dt$ per second.

2. **InputDispatcher Parity**:
   - `InputDispatcher` provides a headless command generation interface for unit tests and headless agents, mirroring `InputManager`.
   - Key 'A' (or 'KeyA') must cancel active skill targeting (`this.targetingSkill = null;`) and return a `CommandType.ATTACK_TARGET` command.
   - If the player hero is provided and dead (`!hero.isAlive()`), the command must be rejected (return `null`), matching `TC-INPUT-DEAD-01`.
   - If hovering over an enemy or neutral unit, it must return a direct target attack command (`targetId`, `targetX`, `targetY`, `targetEntity`).
   - If targeting ground (or no entity is hovered), it must calculate world coordinates (via `screenToWorld` or hero/camera fallback) and return `{ type: CommandType.ATTACK_TARGET, targetId: null, targetX: wx, targetY: wy, attackMove: true }`.
   - Supporting flexible argument forms (keyboard event object or string key, screen coordinates or entity reference) ensures complete compatibility with existing and future tests.

---

## 3. Caveats

- **Scope Boundary**: This investigation focuses strictly on eliminating duplicate cooldown decrement in `src/game.js` and adding 'A' key dispatch to `InputDispatcher.handleKeyDown` in `src/core/input.js`. Related M2 tasks (such as attack-move path continuation when target dies or hold/stop command chaining guards in `updateHeroCombat`) are explored by peer agents and coordinated by the orchestrator.
- **Hero State Prerequisite**: `HeroEntity.update(dt)` in `src/entities/entity.js` is the sole source of `attackCooldown` decay. When dead, `respawn()` explicitly resets `this.attackCooldown = 0`.
- No other caveats.

---

## 4. Conclusion & Proposed Code Replacements

### 4.1 Replacement 1: `src/game.js`
**Target File**: `src/game.js`  
**Target Lines**: 708–711  
**Action**: Replace lines 708–711 in `updateHeroCombat(dt, hero)` to eliminate the duplicate decrement.

#### Target Content (Before):
```javascript
    // Cooldown ticks
    if (hero.attackCooldown > 0) {
      hero.attackCooldown = Math.max(0, hero.attackCooldown - dt);
    }
```

#### Replacement Content (After):
```javascript
    // Note: hero.attackCooldown is decremented in HeroEntity.update(dt) (single decrement per tick)
```

---

### 4.2 Replacement 2: `src/core/input.js`
**Target File**: `src/core/input.js`  
**Target Lines**: 113–178 (`InputDispatcher.handleKeyDown`)  
**Action**: Replace `InputDispatcher.handleKeyDown` to add 'A' / 'KeyA' handling with full coordinate unprojection, entity targeting, and dead hero rejection.

#### Target Content (Before):
```javascript
  handleKeyDown(key, hero = null) {
    const upperKey = (key || '').toUpperCase();

    // Hotkeys Q, W, E, R
    if (['Q', 'W', 'E', 'R'].includes(upperKey)) {
      if (!hero) return null;
      const isDead = typeof hero.isDead === 'function' ? hero.isDead() : !!hero.isDead;
      const isAlive = typeof hero.isAlive === 'function'
        ? hero.isAlive()
        : (!isDead && (typeof hero.hp !== 'number' || hero.hp > 0));
      if (isDead || !isAlive) return { type: 'SKILL_ERROR', error: 'Hero is dead' };

      const skill = hero.skills ? hero.skills[upperKey] : (hero.abilities ? hero.abilities[upperKey] : null);
      if (!skill) return { type: 'SKILL_ERROR', error: 'Skill not found' };

      if (typeof hero.mana === 'number' && typeof skill.manaCost === 'number' && hero.mana < skill.manaCost) {
        return { type: 'SKILL_ERROR', error: 'Insufficient mana' };
      }
      if (typeof skill.cooldownRemaining === 'number' && skill.cooldownRemaining > 0) {
        return { type: 'SKILL_ERROR', error: 'Skill on cooldown' };
      }

      if (skill.targetType === 'self' || skill.targetType === 'instant' || skill.targetingType === 'INSTANT_SELF') {
        return {
          type: CommandType.CAST_SKILL,
          skill: upperKey,
          targetX: hero.x,
          targetY: hero.y,
          instant: true
        };
      }

      this.targetingSkill = upperKey;
      return {
        type: CommandType.START_TARGETING,
        skill: upperKey,
        targetType: skill.targetType || skill.targetingType,
        range: skill.range,
        radius: skill.radius
      };
    }

    // Stop command
    if (upperKey === 'S' || upperKey === 'H') {
      this.targetingSkill = null;
      return { type: CommandType.STOP };
    }

    // Recall key 'B'
    if (upperKey === 'B') {
      this.targetingSkill = null;
      return { type: CommandType.RECALL };
    }

    // Escape cancels targeting
    if (key === 'Escape') {
      if (this.targetingSkill) {
        const cancelled = this.targetingSkill;
        this.targetingSkill = null;
        return { type: CommandType.CANCEL_TARGETING, skill: cancelled };
      }
    }

    return null;
  }
```

#### Replacement Content (After):
```javascript
  handleKeyDown(key, hero = null, screenX = null, screenY = null, hoveredEntity = null) {
    let keyStr = '';
    if (typeof key === 'string') {
      keyStr = key;
    } else if (key && typeof key === 'object') {
      keyStr = key.code || key.key || '';
    }
    const upperKey = (keyStr || '').toUpperCase();

    // Hotkeys Q, W, E, R
    if (['Q', 'W', 'E', 'R'].includes(upperKey)) {
      if (!hero) return null;
      const isDead = typeof hero.isDead === 'function' ? hero.isDead() : !!hero.isDead;
      const isAlive = typeof hero.isAlive === 'function'
        ? hero.isAlive()
        : (!isDead && (typeof hero.hp !== 'number' || hero.hp > 0));
      if (isDead || !isAlive) return { type: 'SKILL_ERROR', error: 'Hero is dead' };

      const skill = hero.skills ? hero.skills[upperKey] : (hero.abilities ? hero.abilities[upperKey] : null);
      if (!skill) return { type: 'SKILL_ERROR', error: 'Skill not found' };

      if (typeof hero.mana === 'number' && typeof skill.manaCost === 'number' && hero.mana < skill.manaCost) {
        return { type: 'SKILL_ERROR', error: 'Insufficient mana' };
      }
      if (typeof skill.cooldownRemaining === 'number' && skill.cooldownRemaining > 0) {
        return { type: 'SKILL_ERROR', error: 'Skill on cooldown' };
      }

      if (skill.targetType === 'self' || skill.targetType === 'instant' || skill.targetingType === 'INSTANT_SELF') {
        return {
          type: CommandType.CAST_SKILL,
          skill: upperKey,
          targetX: hero.x,
          targetY: hero.y,
          instant: true
        };
      }

      this.targetingSkill = upperKey;
      return {
        type: CommandType.START_TARGETING,
        skill: upperKey,
        targetType: skill.targetType || skill.targetingType,
        range: skill.range,
        radius: skill.radius
      };
    }

    // Attack-Move command 'A'
    if (upperKey === 'A' || upperKey === 'KEYA') {
      this.targetingSkill = null;

      if (hero) {
        const isDead = typeof hero.isDead === 'function' ? hero.isDead() : !!hero.isDead;
        const isAlive = typeof hero.isAlive === 'function'
          ? hero.isAlive()
          : (!isDead && (typeof hero.hp !== 'number' || hero.hp > 0));
        if (isDead || !isAlive) return null;
      }

      let ent = hoveredEntity;
      let sx = screenX;
      let sy = screenY;

      // Polymorphic argument handling: if screenX is an entity or options object
      if (sx && typeof sx === 'object') {
        if (sx.id || sx.team || sx.isEnemy) {
          ent = sx;
          sx = null;
          sy = null;
        } else {
          ent = sx.hoveredEntity || ent;
          sy = sx.screenY ?? sx.y ?? sy;
          sx = sx.screenX ?? sx.x ?? sx;
        }
      }

      // If targeting a hostile or neutral entity, attack it directly
      if (ent && (ent.team === 'enemy' || ent.isEnemy || ent.team === 'neutral')) {
        return {
          type: CommandType.ATTACK_TARGET,
          targetId: ent.id,
          targetX: ent.x,
          targetY: ent.y,
          targetEntity: ent
        };
      }

      // Otherwise attack-move towards ground coordinates
      let wx = 0;
      let wy = 0;
      if (typeof sx === 'number' && typeof sy === 'number') {
        const vw = this.viewport?.width ?? 1280;
        const vh = this.viewport?.height ?? 720;
        const clampedSx = clamp(sx, 0, vw);
        const clampedSy = clamp(sy, 0, vh);
        const world = screenToWorld(clampedSx, clampedSy, this.camera, this.zoom, this.viewport);
        wx = clamp(world.wx, 0, MAP_SIZE);
        wy = clamp(world.wy, 0, MAP_SIZE);
      } else if (hero && typeof hero.x === 'number' && typeof hero.y === 'number') {
        wx = hero.x;
        wy = hero.y;
      } else if (this.camera && typeof this.camera.x === 'number' && typeof this.camera.y === 'number') {
        wx = this.camera.x;
        wy = this.camera.y;
      }

      return {
        type: CommandType.ATTACK_TARGET,
        targetId: null,
        targetX: wx,
        targetY: wy,
        attackMove: true
      };
    }

    // Stop command
    if (upperKey === 'S' || upperKey === 'H' || upperKey === 'KEYS' || upperKey === 'KEYH') {
      this.targetingSkill = null;
      return { type: CommandType.STOP };
    }

    // Recall key 'B'
    if (upperKey === 'B' || upperKey === 'KEYB') {
      this.targetingSkill = null;
      return { type: CommandType.RECALL };
    }

    // Escape cancels targeting
    if (key === 'Escape' || upperKey === 'ESCAPE') {
      if (this.targetingSkill) {
        const cancelled = this.targetingSkill;
        this.targetingSkill = null;
        return { type: CommandType.CANCEL_TARGETING, skill: cancelled };
      }
    }

    return null;
  }
```

---

## 5. Verification Method

### 5.1 Verification Commands
1. Run full baseline suite:
   ```bash
   npm test
   ```
2. Run target and input suites:
   ```bash
   node tests/runner.js tests/unit/player_attack.test.js
   node tests/runner.js tests/unit/input.test.js
   ```

### 5.2 Recommended New Unit Tests

#### A. Attack Cooldown 1x Recovery Test (`tests/unit/player_attack.test.js`)
```javascript
it('TC-ATK-25: Attack cooldown recovers at exactly 1.0x dt rate per simulation tick', () => {
  const sim = new GameSimulation({ heroClass: 'knight' });
  const hero = sim.playerHero;
  hero.attackCooldown = 1.0;

  // Advance simulation by dt = 0.1s
  sim.update(0.1);

  // Must equal 0.9s (single decrement), NOT 0.8s (duplicate decrement)
  const expected = 0.9;
  const diff = Math.abs(hero.attackCooldown - expected);
  assertTrue(diff < 1e-4, `Expected attackCooldown ~0.9s but got ${hero.attackCooldown}s`);
});
```

#### B. InputDispatcher 'A' Key Tests (`tests/unit/input.test.js`)
```javascript
it('TC-INP-08: A key on ground dispatches ATTACK_TARGET with attackMove: true', async () => {
  const { module: inputMod } = await resolveModule('core/input');
  const dispatcher = new inputMod.InputDispatcher({ x: 0, y: 0 }, 1.0, { width: 1280, height: 720 });
  const hero = { x: 500, y: 500, isAlive: () => true };

  const cmd = dispatcher.handleKeyDown('A', hero, 640, 360);
  assertEqual(cmd.type, 'ATTACK_TARGET');
  assertEqual(cmd.targetId, null);
  assertEqual(cmd.attackMove, true);
  assertEqual(cmd.targetX, 0);
  assertEqual(cmd.targetY, 0);
});

it('TC-INP-09: A key on enemy unit dispatches direct ATTACK_TARGET command', async () => {
  const { module: inputMod } = await resolveModule('core/input');
  const dispatcher = new inputMod.InputDispatcher();
  const hero = { x: 500, y: 500, isAlive: () => true };
  const enemy = { id: 'minion_enemy_9', team: 'enemy', x: 600, y: 600 };

  const cmd = dispatcher.handleKeyDown('A', hero, enemy);
  assertEqual(cmd.type, 'ATTACK_TARGET');
  assertEqual(cmd.targetId, 'minion_enemy_9');
  assertEqual(cmd.targetX, 600);
  assertEqual(cmd.targetY, 600);
  assertEqual(cmd.targetEntity, enemy);
});

it('TC-INP-10: A key is rejected when hero is in dead state', async () => {
  const { module: inputMod } = await resolveModule('core/input');
  const dispatcher = new inputMod.InputDispatcher();
  const deadHero = { x: 500, y: 500, isAlive: () => false, isDead: true, hp: 0 };

  const cmd = dispatcher.handleKeyDown('A', deadHero);
  assertEqual(cmd, null);
});
```

### 5.3 Invalidation Conditions
- If `hero.attackCooldown` decreases by more than `dt` during a single call to `sim.update(dt)`.
- If `dispatcher.handleKeyDown('A')` returns `null` for a living hero.
- If `dispatcher.handleKeyDown('A')` dispatches an action for a dead hero.
- If any of the 162 existing tests in `npm test` fail.
