/**
 * GameSimulation Orchestrator.
 * Coordinates fixed 60fps simulation, entities, camera follow, input dispatch, 7-pass rendering, and HUD.
 * Supports all 5 Heroes (Knight, Sorceress, Ranger, Assassin, Cleric), Shop, and Win/Loss screens.
 */

import { Camera } from './core/camera.js';
import { GameLoop, FIXED_TIMESTEP } from './core/loop.js';
import { InputManager, CommandType } from './core/input.js';
import { HeroEntity } from './entities/entity.js';
import { HERO_DEFINITIONS, calculateHeroStatsAtLevel, getHeroKit } from './entities/heroes.js';
import { HeroInventory } from './systems/items.js';
import { ShopUI } from './ui/shop_ui.js';
import { Renderer } from './render/renderer.js';
import { ParticleSystem } from './render/particles.js';
import { HUDController } from './ui/hud.js';
import { TooltipController } from './ui/tooltip.js';
import { SoundEngine } from './audio/sound.js';
import { GameMap } from './world/map.js';
import { createTowerHierarchy, DefensiveTower, TowerProjectile } from './world/tower.js';
import { WaveSpawner, MinionUnit, getWaveComposition, resolveMinionDeath } from './world/minion.js';
import { BossManager, SupremeBoss, evaluateMatchOutcome } from './world/boss.js';
import { applyDamage } from './combat/combat.js';
import { HeroProjectile } from './combat/projectile.js';
import { calculateKillXp, resolveMinionXpDistribution } from './systems/leveling.js';
import { preloadAllSprites } from './render/sprite_loader.js';

export class GameSimulation {
  /**
   * @param {Object} [options={}]
   * @param {HTMLCanvasElement} [options.canvas=null]
   * @param {string} [options.heroClass='knight']
   * @param {Array} [options.roster=[]]
   * @param {boolean} [options.isHost=true]
   * @param {Object} [options.network=null]
   */
  constructor(options = {}) {
    this.canvas = options.canvas || null;
    this.heroClass = options.heroClass || 'knight';
    this.roster = options.roster || [];
    this.isHost = options.isHost ?? true;
    this.network = options.network || null;
    this.remoteHeroes = new Map();
    this.netSyncAccumulator = 0;

    // Core systems
    this.camera = new Camera({
      worldX: 650,
      worldY: 650,
      viewportWidth: this.canvas ? this.canvas.width : 1280,
      viewportHeight: this.canvas ? this.canvas.height : 720,
      smoothing: 8.0,
      bounds: { minX: 0, minY: 0, maxX: 3200, maxY: 3200 }
    });

    this.particles = new ParticleSystem();
    this.renderer = new Renderer(this.canvas, {
      width: this.camera.viewportWidth,
      height: this.camera.viewportHeight
    });
    this.sound = options.soundEngine || new SoundEngine(options);
    this.hud = new HUDController();
    this.hud.setupAudioControls(this.sound);
    this.tooltip = new TooltipController();
    this.input = new InputManager(this.canvas, this.camera);

    this.wasPlayerRecalling = false;
    this.lastPlayerRecallElapsed = 0;

    // World & Boss systems
    this.map = new GameMap();
    this.bossManager = new BossManager(this);
    this.waveSpawner = new WaveSpawner(this);
    this.towers = [];
    this.alliedNexus = null;
    this.enemyNexus = null;
    this.lastAggressorId = null;

    // Simulation state
    this.matchTime = 0;
    this.isVictory = false;
    this.isDefeat = false;
    this.firstBloodClaimed = false;
    this.heroKillStreaks = new Map();

    this.entities = [];
    this.playerHero = null;
    this.shopUI = null;
    this.heroProjectiles = [];

    // Game loop
    this.loop = new GameLoop({
      fixedTimestep: FIXED_TIMESTEP,
      onUpdate: (dtMs, tickIndex) => this.update(dtMs / 1000, tickIndex),
      onRender: (alpha, frameTime) => this.render(alpha, frameTime)
    });

    this.init();
  }

  init() {
    preloadAllSprites();
    const heroDef = HERO_DEFINITIONS[this.heroClass] || HERO_DEFINITIONS.knight;
    const baseStats = calculateHeroStatsAtLevel(this.heroClass, 1);
    const heroKit = getHeroKit(this.heroClass);

    // 1. Create Selected Player Hero
    const isHost = this.isHost;
    const localId = (this.network && this.network.myPlayerId) ? this.network.myPlayerId : (isHost ? 'player_hero_1' : 'player_remote_2');
    const spawnX = (this.roster && this.roster.length > 1 && !isHost) ? 620 : 650;
    const spawnY = (this.roster && this.roster.length > 1 && !isHost) ? 650 : 650;

    this.playerHero = new HeroEntity({
      id: localId,
      heroId: this.heroClass,
      name: isHost ? heroDef.name : `${heroDef.name} (Aliado)`,
      role: heroDef.role,
      team: 'allied',
      x: spawnX,
      y: spawnY,
      isLocalPlayer: true,
      hp: baseStats.hp,
      maxHp: baseStats.hp,
      hpRegen: baseStats.hpRegen,
      mana: baseStats.mana,
      maxMana: baseStats.mana,
      manaRegen: baseStats.manaRegen,
      armor: baseStats.armor,
      magicResist: baseStats.magicResist,
      attackDamage: baseStats.attackDamage,
      attackSpeed: baseStats.attackSpeed,
      attackRange: baseStats.attackRange,
      speed: baseStats.movementSpeed,
      movementSpeed: baseStats.movementSpeed,
      abilities: heroKit,
      gold: 500
    });

    // Setup hero inventory
    this.playerHero.baseStats = baseStats;
    this.playerHero.inventoryInstance = new HeroInventory(this.playerHero);
    this.playerHero.onLevelUp = (lvl) => {
      this.triggerLevelUpVFX(this.playerHero, lvl);
    };

    if (this.hud && typeof this.hud.setupUpgradeListeners === 'function') {
      this.hud.setupUpgradeListeners((slot) => {
        this.handleCommand({
          type: CommandType.UPGRADE_ABILITY,
          slot
        });
      });
    }

    this.entities.push(this.playerHero);
    this.camera.follow(this.playerHero);
    this.input.setPlayerHero(this.playerHero);
    this.input.entityManager = this.entities;

    // Spawn remote heroes from initial roster
    if (this.roster && this.roster.length > 0) {
      for (const p of this.roster) {
        if (p.id !== localId) {
          this.spawnRemoteHero(p);
        }
      }
    }

    // Connect network callbacks if network present
    if (this.network) {
      this.network.setGameSim(this);
      this.network.onPeerJoinCallback = (p) => this.spawnRemoteHero(p);
      this.network.onPeerLeaveCallback = (p) => this.removeRemoteHero(p?.id);
    }

    // Update HUD buttons with hero's skills and portrait
    this.updateHUDForHero(heroDef, heroKit);

    // 2. Initialize Shop UI
    this.shopUI = new ShopUI(this);
    if (this.shopUI) {
      const origBuy = this.shopUI.buyItem.bind(this.shopUI);
      this.shopUI.buyItem = (item) => {
        const goldBefore = this.playerHero?.gold ?? 0;
        origBuy(item);
        if (this.playerHero && this.playerHero.gold < goldBefore) {
          if (this.sound) this.sound.playShopBuy();
        }
      };

      const origHandleSlot = this.shopUI.handleInventorySlotClick.bind(this.shopUI);
      this.shopUI.handleInventorySlotClick = (slotIdx) => {
        origHandleSlot(slotIdx);
        if (typeof document !== 'undefined') {
          const sellBtn = document.getElementById('sell-item-btn');
          if (sellBtn && !sellBtn._hasSoundHook) {
            sellBtn._hasSoundHook = true;
            sellBtn.addEventListener('click', () => {
              if (this.sound) this.sound.playShopSell();
            });
          }
        }
      };
    }

    // 3. Create Structures via Authoritative Hierarchy
    const { allied, enemy, allStructures } = createTowerHierarchy({
      isSupremeBossAlive: () => this.bossManager.isSupremeBossAlive()
    });
    this.towers = allStructures;
    this.alliedNexus = allied.nexus;
    this.enemyNexus = enemy.nexus;
    this.entities.push(...allStructures);

    // Register active structure colliders in GameMap
    this.map.syncStructuresFromEntities(this.entities);

    // 4. Station Supreme Boss (Nexus Guardian)
    if (this.bossManager.supremeBoss) {
      this.entities.push(this.bossManager.supremeBoss);
    }

    // 5. Create Initial Minion Squad
    const allyMinion1 = new MinionUnit({ id: 'min_ally_1', team: 'allied', x: 800, y: 800, subType: 'melee' });
    const allyMinion2 = new MinionUnit({ id: 'min_ally_2', team: 'allied', x: 770, y: 830, subType: 'ranged' });
    const enemyMinion1 = new MinionUnit({ id: 'min_enemy_1', team: 'enemy', x: 1600, y: 1600, subType: 'melee' });
    const enemyMinion2 = new MinionUnit({ id: 'min_enemy_2', team: 'enemy', x: 1630, y: 1570, subType: 'ranged' });
    this.entities.push(allyMinion1, allyMinion2, enemyMinion1, enemyMinion2);

    // 6. Bind Input Commands & Error Feedback
    this.input.onCommand((cmd) => this.handleCommand(cmd));
    this.input.onSkillError = (slot, reason, details) => {
      this.handleSkillError(slot, reason, details);
    };
    this.input.bindEvents();

    // 7. Setup Minimap Interactions
    if (this.hud && this.hud.minimap) {
      this.hud.minimap.setupInteraction(
        (wx, wy) => {
          this.handleCommand({ type: CommandType.MOVE_TO, x: wx, y: wy });
        },
        (wx, wy) => {
          this.camera.lookAt(wx, wy);
        }
      );
    }
  }

  handleSkillError(slot, reason, details) {
    if (this.hud && typeof this.hud.flashAbilityError === 'function') {
      this.hud.flashAbilityError(slot, reason);
    }

    let text = 'Falha!';
    let color = '#ef4444';

    if (reason === 'mana' || reason === 'insufficient_mana') {
      text = 'Sem Mana!';
      color = '#38bdf8';
    } else if (reason === 'cooldown') {
      text = 'Em Recarga!';
      color = '#f59e0b';
    } else if (reason === 'cc' || reason === 'crowd_control') {
      text = 'Impossibilitado!';
      color = '#c084fc';
    }

    if (this.particles && typeof this.particles.addFloatingText === 'function') {
      const hx = this.playerHero?.x ?? this.camera?.worldX ?? 0;
      const hy = this.playerHero?.y ?? this.camera?.worldY ?? 0;
      this.particles.addFloatingText(text, hx, hy, { color, fontSize: 16, z: 45 });
    }
  }

  updateHUDForHero(heroDef, heroKit) {
    if (typeof document === 'undefined') return;
    const portrait = document.getElementById('hero-portrait');
    if (portrait) {
      if (heroDef.sprite) {
        portrait.innerHTML = `<img src="${heroDef.sprite}" alt="${heroDef.name}" class="hud-portrait-img">`;
      } else {
        portrait.textContent = heroDef.icon || '🛡️';
      }
      portrait.className = `hero-portrait ${heroDef.id}`;
    }

    // Update ability button slots in DOM
    const slots = ['Q', 'W', 'E', 'R'];
    for (const key of slots) {
      const btn = document.getElementById(`ability-${key.toLowerCase()}`);
      const ab = heroKit[key];
      if (btn && ab) {
        btn.title = `${key}: ${ab.name} — ${ab.description}`;
        const iconEl = btn.querySelector('.ability-icon');
        if (iconEl) iconEl.textContent = ab.icon || '✨';
        const manaBadge = btn.querySelector('.mana-badge');
        if (manaBadge) manaBadge.textContent = ab.manaCost || 0;

        // Rich tooltip listeners
        if (this.tooltip) {
          btn.addEventListener('mouseenter', () => {
            const currentAb = this.playerHero?.abilities?.[key] || ab;
            this.tooltip.showAbilityTooltip(currentAb, this.playerHero, btn);
          });
          btn.addEventListener('mouseleave', () => {
            this.tooltip.hide();
          });
        }
      }
    }
  }

  handleCommand(cmd) {
    if (!cmd) return;

    if (cmd.type === CommandType.CYCLE_PERSPECTIVE || cmd.type === 'CYCLE_PERSPECTIVE') {
      if (this.camera && typeof this.camera.cyclePerspective === 'function') {
        this.camera.cyclePerspective(cmd.direction || 1);
      }
      return;
    }

    if (!this.playerHero) return;
    const isHeroAlive = typeof this.playerHero.isAlive === 'function'
      ? this.playerHero.isAlive()
      : (!this.playerHero.isDead && (typeof this.playerHero.hp !== 'number' || this.playerHero.hp > 0));
    if (!isHeroAlive) return;

    switch (cmd.type) {
      case CommandType.MOVE_TO: {
        this.playerHero.setAttackTarget(null);
        this.playerHero.attackMoveDestination = null;
        this.playerHero.holdPosition = false;
        const walkable = this.map.findNearestWalkable(cmd.x, cmd.y, this.playerHero.radius);
        this.playerHero.moveTo(walkable.x, walkable.y);
        // Visual tactile indicator: concentric waves + reticle
        if (typeof this.particles.emitMoveIndicator === 'function') {
          this.particles.emitMoveIndicator(walkable.x, walkable.y, '#10b981', false);
        } else {
          this.particles.emit('ring', {
            x: walkable.x,
            y: walkable.y,
            color: '#10b981',
            startRadius: 6,
            maxRadius: 24,
            life: 0.35
          });
        }
        break;
      }

      case CommandType.ATTACK_TARGET: {
        let target = cmd.targetEntity;
        if (!target && cmd.targetId) {
          target = this.entities.find(e => e.id === cmd.targetId);
        }

        if (target && (typeof target.isAlive === 'function' ? target.isAlive() : target.hp > 0)) {
          this.playerHero.setAttackTarget(target);
          if (typeof this.particles.emitMoveIndicator === 'function') {
            this.particles.emitMoveIndicator(target.x, target.y, '#ef4444', true);
          } else {
            this.particles.emit('ring', {
              x: target.x,
              y: target.y,
              color: '#ef4444',
              startRadius: 10,
              maxRadius: 28,
              life: 0.4
            });
          }
        } else if (cmd.attackMove) {
          this.playerHero.setAttackTarget(null);
          this.playerHero.attackMoveDestination = { x: cmd.targetX, y: cmd.targetY };
          const walkable = this.map.findNearestWalkable(cmd.targetX, cmd.targetY, this.playerHero.radius);
          this.playerHero.moveTo(walkable.x, walkable.y, true);
          if (typeof this.particles.emitMoveIndicator === 'function') {
            this.particles.emitMoveIndicator(walkable.x, walkable.y, '#ef4444', true);
          } else {
            this.particles.emit('ring', {
              x: walkable.x,
              y: walkable.y,
              color: '#ef4444',
              startRadius: 10,
              maxRadius: 28,
              life: 0.4
            });
          }
        } else {
          this.playerHero.setAttackTarget(null);
          const targetX = cmd.targetX ?? cmd.x;
          const targetY = cmd.targetY ?? cmd.y;
          this.playerHero.moveTo(targetX, targetY);
          if (typeof this.particles.emitMoveIndicator === 'function') {
            this.particles.emitMoveIndicator(targetX, targetY, '#ef4444', true);
          } else {
            this.particles.emit('ring', {
              x: targetX,
              y: targetY,
              color: '#ef4444',
              startRadius: 10,
              maxRadius: 28,
              life: 0.4
            });
          }
        }
        break;
      }

      case CommandType.CAST_ABILITY:
      case CommandType.CAST_SKILL: {
        const slot = cmd.slot || cmd.skill;
        const ability = this.playerHero.abilities ? this.playerHero.abilities[slot] : null;

        if (ability && (this.playerHero.mana || 0) >= (ability.manaCost || 0) && (!ability.cooldownRemaining || ability.cooldownRemaining <= 0)) {
          this.executeHeroSkill(slot, ability, cmd);
        }
        break;
      }

      case CommandType.STOP: {
        this.playerHero.stop();
        this.playerHero.setAttackTarget(null);
        this.playerHero.attackMoveDestination = null;
        this.playerHero.holdPosition = true;
        break;
      }

      case CommandType.RECALL: {
        this.playerHero.setAttackTarget(null);
        this.playerHero.attackMoveDestination = null;
        if (!this.playerHero.isRecalling) {
          this.playerHero.stop();
          this.playerHero.isRecalling = true;
          this.playerHero.recallElapsed = 0;
          if (this.sound) {
            this.sound.playRecallStart();
          }
          this.particles.addFloatingText('Canalizando Recall...', this.playerHero.x, this.playerHero.y, {
            color: '#06b6d4',
            fontSize: 14
          });
        }
        break;
      }

      case CommandType.CENTER_CAMERA: {
        this.camera.recenter();
        break;
      }

      case CommandType.TOGGLE_SHOP: {
        if (this.shopUI) {
          this.shopUI.toggle();
        }
        break;
      }

      case CommandType.UPGRADE_ABILITY: {
        const slot = cmd.slot;
        if (this.playerHero && typeof this.playerHero.upgradeAbility === 'function') {
          const success = this.playerHero.upgradeAbility(slot);
          if (success) {
            this.particles.addFloatingText(`+1 ${slot}!`, this.playerHero.x, this.playerHero.y - 35, {
              color: '#fbbf24',
              fontSize: 14
            });
            if (this.network && !this.network.isSoloMode) {
              this.network.broadcast({
                type: 'UPGRADE_ABILITY',
                heroId: this.playerHero.id,
                slot,
                newRank: this.playerHero.abilities?.[slot]?.rank || 1
              });
            }
          }
        }
        break;
      }

      case CommandType.SELECT: {
        let target = cmd.targetEntity;
        if (!target && cmd.targetEntityId) {
          target = this.entities.find(e => e.id === cmd.targetEntityId);
        }
        if (target && this.input && this.input.isHostile(target, this.playerHero)) {
          this.handleCommand({
            type: CommandType.ATTACK_TARGET,
            targetEntity: target,
            targetId: target.id
          });
        }
        break;
      }

      case 'CLOSE_MODALS': {
        if (this.shopUI && this.shopUI.isOpen) {
          this.shopUI.close();
        }
        break;
      }

      case 'BOOST':
      case '/boost': {
        this.applyBoost();
        break;
      }

      case 'PLAN':
      case '/plan': {
        this.applyPlan();
        break;
      }

      case 'HORDE':
      case '/horde':
      case '/hordas':
      case '/onda':
      case '/waves': {
        this.spawnExtraWave();
        break;
      }
    }
  }

  spawnRemoteHero(playerData) {
    if (!playerData || !playerData.id) return null;
    const existing = this.entities.find(e => e.id === playerData.id);
    if (existing) return existing;

    const heroId = playerData.heroId || 'sorceress';
    const def = HERO_DEFINITIONS[heroId] || HERO_DEFINITIONS.sorceress;
    const stats = calculateHeroStatsAtLevel(heroId, 1);
    const kit = getHeroKit(heroId);

    const spawnX = playerData.x ?? (playerData.isHost ? 650 : 620);
    const spawnY = playerData.y ?? (playerData.isHost ? 620 : 650);

    const remoteHero = new HeroEntity({
      id: playerData.id,
      heroId: heroId,
      name: playerData.name || def.name,
      role: def.role,
      team: 'allied',
      x: spawnX,
      y: spawnY,
      isLocalPlayer: false,
      hp: stats.hp,
      maxHp: stats.hp,
      hpRegen: stats.hpRegen,
      mana: stats.mana,
      maxMana: stats.mana,
      manaRegen: stats.manaRegen,
      armor: stats.armor,
      magicResist: stats.magicResist,
      attackDamage: stats.attackDamage,
      attackSpeed: stats.attackSpeed,
      attackRange: stats.attackRange,
      speed: stats.movementSpeed,
      movementSpeed: stats.movementSpeed,
      abilities: kit,
      gold: 500
    });

    remoteHero.baseStats = stats;
    remoteHero.inventoryInstance = new HeroInventory(remoteHero);
    remoteHero.onLevelUp = (lvl) => {
      this.triggerLevelUpVFX(remoteHero, lvl);
    };

    this.entities.push(remoteHero);
    this.remoteHeroes.set(playerData.id, remoteHero);

    if (this.particles) {
      this.particles.emit('spark', { x: spawnX, y: spawnY, count: 25, speed: 120, color: '#38bdf8' });
      this.particles.addFloatingText(`${def.name} Entrou!`, spawnX, spawnY - 30, { color: '#38bdf8', fontSize: 16 });
    }

    return remoteHero;
  }

  removeRemoteHero(playerId) {
    if (!playerId) return;
    this.entities = this.entities.filter(e => e.id !== playerId);
    this.remoteHeroes.delete(playerId);
  }

  handleRemoteHeroUpdate(data) {
    if (!data || !data.id || data.id === this.playerHero?.id) return;

    let hero = this.remoteHeroes.get(data.id) || this.entities.find(e => e.id === data.id);
    if (!hero) {
      hero = this.spawnRemoteHero(data);
    }
    if (!hero) return;

    const dist = Math.hypot(data.x - hero.x, data.y - hero.y);
    if (dist > 180) {
      hero.x = data.x;
      hero.y = data.y;
      hero.vx = 0;
      hero.vy = 0;
      hero.isMoving = false;
      hero.targetX = null;
      hero.targetY = null;
    } else if (dist > 2) {
      hero.targetX = data.x;
      hero.targetY = data.y;
      hero.isMoving = true;
      if (data.speed) hero.speed = data.speed;
    } else {
      hero.isMoving = false;
      hero.targetX = null;
      hero.targetY = null;
      hero.vx = 0;
      hero.vy = 0;
    }

    if (typeof data.facing === 'number') {
      hero.facing = data.facing;
      if ('targetFacing' in hero) hero.targetFacing = data.facing;
    }

    if (typeof data.hp === 'number') hero.hp = data.hp;
    if (typeof data.maxHp === 'number') hero.maxHp = data.maxHp;
    if (typeof data.mana === 'number') hero.mana = data.mana;
    if (typeof data.maxMana === 'number') hero.maxMana = data.maxMana;
    if (typeof data.isRecalling === 'boolean') hero.isRecalling = data.isRecalling;
    if (typeof data.level === 'number') hero.level = data.level;
    if (typeof data.xp === 'number') hero.xp = data.xp;
    if (typeof data.maxXp === 'number') hero.maxXp = data.maxXp;
    if (typeof data.skillPoints === 'number') hero.skillPoints = data.skillPoints;
    if (data.abilityRanks && hero.abilities) {
      for (const slot of ['Q', 'W', 'E', 'R']) {
        if (typeof data.abilityRanks[slot] === 'number' && hero.abilities[slot]) {
          hero.abilities[slot].rank = data.abilityRanks[slot];
        }
      }
    }

    if (typeof data.isDead === 'boolean') {
      if (data.isDead && hero.isAlive()) {
        hero.die();
      } else if (!data.isDead && hero.isDead) {
        hero.respawn();
      }
    }
  }

  handleRemoteCast(data) {
    if (!data || !data.slot) return;
    const caster = (data.heroId && data.heroId !== this.playerHero?.id)
      ? (this.remoteHeroes.get(data.heroId) || this.entities.find(e => e.id === data.heroId))
      : null;

    if (!caster) return;

    const ability = caster.abilities ? caster.abilities[data.slot] : null;
    if (!ability) return;

    this.executeHeroSkill(data.slot, ability, {
      targetX: data.targetX,
      targetY: data.targetY
    }, caster);
  }

  handleRemoteChatCommand(data) {
    if (!data || !data.command) return;
    if (data.command === 'boost') {
      const sender = this.entities.find(e => e.id === data.senderId);
      const target = sender || this.playerHero;
      if (sender) {
        sender.speed = Math.min(600, (sender.speed || 325) + 120);
        sender.attackDamage = (sender.attackDamage || 60) + 60;
        sender.attackSpeed = Math.min(2.5, +( (sender.attackSpeed || 0.65) + 0.4 ).toFixed(2));
        sender.abilityPower = (sender.abilityPower || 0) + 80;
        sender.armor = (sender.armor || 30) + 30;
        sender.magicResist = (sender.magicResist || 30) + 30;
        sender.hp = sender.maxHp;
        sender.mana = sender.maxMana;
      }
      if (this.playerHero && this.playerHero !== sender) {
        this.playerHero.speed = Math.min(600, (this.playerHero.speed || 325) + 120);
        this.playerHero.attackDamage = (this.playerHero.attackDamage || 60) + 60;
        this.playerHero.attackSpeed = Math.min(2.5, +( (this.playerHero.attackSpeed || 0.65) + 0.4 ).toFixed(2));
        this.playerHero.abilityPower = (this.playerHero.abilityPower || 0) + 80;
        this.playerHero.armor = (this.playerHero.armor || 30) + 30;
        this.playerHero.magicResist = (this.playerHero.magicResist || 30) + 30;
        this.playerHero.hp = this.playerHero.maxHp;
        this.playerHero.mana = this.playerHero.maxMana;
        if (this.shopUI) this.shopUI.updateGoldDisplay();
      }
      this.particles.emit('spark', {
        x: target.x,
        y: target.y,
        count: 40,
        speed: 250,
        color: '#fbbf24'
      });
      this.particles.addFloatingText('🚀 ALIADO ATIVOU O BOOST!', target.x, target.y - 30, {
        color: '#fbbf24',
        fontSize: 18
      });
    } else if (data.command === 'horde') {
      this.spawnExtraWave(false);
    }
  }

  spawnExtraWave(broadcast = true) {
    if (this.waveSpawner) {
      this.waveSpawner.waveIndex++;
      this.waveSpawner.queueWave(this.waveSpawner.waveIndex);
      if (this.particles && this.playerHero) {
        this.particles.addFloatingText('⚔️ NOVA HORDA DE LACAIOS!', this.playerHero.x, this.playerHero.y - 40, {
          color: '#f59e0b',
          fontSize: 16
        });
      }
      if (broadcast && this.network && !this.network.isSoloMode) {
        this.network.broadcast({
          type: 'CHAT_COMMAND',
          command: 'horde',
          senderId: this.playerHero?.id
        });
      }
    }
  }

  applyBoost(broadcast = true) {
    if (!this.playerHero) return;
    this.playerHero.speed = Math.min(600, (this.playerHero.speed || 325) + 120);
    this.playerHero.attackDamage = (this.playerHero.attackDamage || 60) + 60;
    this.playerHero.attackSpeed = Math.min(2.5, +( (this.playerHero.attackSpeed || 0.65) + 0.4 ).toFixed(2));
    this.playerHero.abilityPower = (this.playerHero.abilityPower || 0) + 80;
    this.playerHero.armor = (this.playerHero.armor || 30) + 30;
    this.playerHero.magicResist = (this.playerHero.magicResist || 30) + 30;
    this.playerHero.gold = (this.playerHero.gold || 0) + 1000;
    this.playerHero.hp = this.playerHero.maxHp;
    this.playerHero.mana = this.playerHero.maxMana;
    if (this.shopUI) this.shopUI.updateGoldDisplay();
    this.particles.emit('spark', {
      x: this.playerHero.x,
      y: this.playerHero.y,
      count: 40,
      speed: 250,
      color: '#fbbf24'
    });
    this.particles.addFloatingText('🚀 BOOST ATIVADO! (+Speed, +Damage, +AS, +Armor, +1000g)', this.playerHero.x, this.playerHero.y - 30, {
      color: '#fbbf24',
      fontSize: 18
    });

    if (broadcast && this.network && !this.network.isSoloMode) {
      this.network.broadcast({
        type: 'CHAT_COMMAND',
        command: 'boost',
        senderId: this.playerHero.id
      });
    }
  }

  applyPlan() {
    if (!this.playerHero) return;
    this.particles.emit('spark', {
      x: this.playerHero.x,
      y: this.playerHero.y,
      count: 35,
      speed: 200,
      color: '#38bdf8'
    });
    this.particles.emit('ring', {
      x: this.playerHero.x,
      y: this.playerHero.y,
      startRadius: 10,
      maxRadius: 80,
      color: '#fbbf24',
      life: 0.8
    });
    this.particles.addFloatingText('📋 PLANO DE BATALHA ATIVADO!', this.playerHero.x, this.playerHero.y - 30, {
      color: '#38bdf8',
      fontSize: 18
    });
    this.showPlanModal();
  }

  showPlanModal() {
    if (typeof document === 'undefined') return;
    const existing = document.getElementById('battle-plan-modal');
    if (existing) {
      existing.remove();
      return;
    }

    const modal = document.createElement('div');
    modal.id = 'battle-plan-modal';
    modal.className = 'battle-plan-modal';
    modal.innerHTML = `
      <div class="battle-plan-card">
        <h2 class="battle-plan-title">⚔️ PLANO DE BATALHA & GUIA DE COMBATE</h2>
        <div class="battle-plan-steps">
          <p><strong>1. Rota & Minions:</strong> Avance pela rota eliminando os lacaios inimigos para juntar ouro (last-hit concede recompensa total).</p>
          <p><strong>2. Ataque Básico:</strong> Clique com botão direito ou pressione <strong>'A'</strong> no alvo inimigo. Heróis corpo a corpo desferem golpes contínuos e atiradores/magas disparam projéteis automáticos!</p>
          <p><strong>3. Habilidades (Q, W, E, R):</strong> Combine suas magias e golpes especiais para controle de multidão (Stun/Slow) e alto dano.</p>
          <p><strong>4. Loja da Base (P):</strong> Perto da fonte aliada, pressione <strong>P</strong> para comprar espadas, cajados e armaduras.</p>
          <p><strong>5. Retorno à Base (B):</strong> Canalize o recall por 5 segundos sem tomar dano para se curar totalmente na fonte.</p>
          <p><strong>6. Torres, Bosses & Vitória:</strong> Derrube a Torre Externa e a Torre Interna. Destrua o Guardião Supremo e o Cristal Nexus Inimigo!</p>
        </div>
        <button id="close-plan-btn" class="close-plan-btn">Entendido! Voltar à Batalha</button>
      </div>
    `;

    document.body.appendChild(modal);
    document.getElementById('close-plan-btn')?.addEventListener('click', () => {
      modal.remove();
    });
  }

  triggerLevelUpVFX(hero, newLevel) {
    if (!hero || !this.particles) return;

    if (this.sound) {
      this.sound.playLevelUp();
    }

    // 1. Texto flutuante épico
    this.particles.addFloatingText(`⭐ LEVEL UP! NÍVEL ${newLevel} ⭐`, hero.x, hero.y - 60, {
      color: '#facc15',
      fontSize: 18,
      isCrit: true
    });

    // 2. 2 Anéis dourados concêntricos
    this.particles.emit('ring', {
      x: hero.x,
      y: hero.y,
      startRadius: 15,
      maxRadius: 120,
      growthRate: 110,
      color: '#fbbf24',
      lineWidth: 3.5,
      life: 0.8
    });
    this.particles.emit('ring', {
      x: hero.x,
      y: hero.y,
      startRadius: 5,
      maxRadius: 75,
      growthRate: 70,
      color: '#fef08a',
      lineWidth: 2.5,
      life: 0.65
    });

    // 3. 25 faíscas ascendentes
    this.particles.emit('spark', {
      x: hero.x,
      y: hero.y,
      z: 10,
      count: 25,
      vz: 140,
      speed: 60,
      color: '#fef08a',
      life: 0.7
    });

    // 4. 40 confetes coloridos ('confetti')
    this.particles.emit('confetti', {
      x: hero.x,
      y: hero.y,
      z: 25,
      count: 40,
      life: 1.4
    });
  }

  awardDeathXp(target, killer = null) {
    if (!target || target.xpAwarded) return;
    target.xpAwarded = true;

    if (target.type === 'minion') {
      const distributions = resolveMinionXpDistribution(target, this.entities, killer);
      for (const { hero, xp, isLastHit } of distributions) {
        if (typeof hero.gainXp === 'function') {
          hero.gainXp(xp);
          if (hero.isLocalPlayer && this.particles) {
            this.particles.addFloatingText(isLastHit ? `+${xp} XP` : `+${xp} XP`, hero.x, hero.y - 45, {
              color: isLastHit ? '#fbbf24' : '#a855f7',
              fontSize: 13
            });
          }
        }
      }
    } else if (target.type === 'hero') {
      const killerId = killer ? (killer.id || killer.heroClass || 'killer') : null;
      const victimId = target.id || target.heroClass || 'victim';
      const killerName = killer ? (killer.name || killer.heroClass || 'Aliado') : 'Inimigo';
      const victimName = target.name || target.heroClass || 'Inimigo';
      const killerTeam = killer?.team || (target.team === 'allied' ? 'enemy' : 'allied');

      let currentStreak = 1;
      if (killerId && this.heroKillStreaks) {
        currentStreak = (this.heroKillStreaks.get(killerId) || 0) + 1;
        this.heroKillStreaks.set(killerId, currentStreak);
      }
      if (this.heroKillStreaks) {
        this.heroKillStreaks.set(victimId, 0);
      }

      if (!this.firstBloodClaimed) {
        this.firstBloodClaimed = true;
        if (this.hud?.eventBanners) {
          this.hud.eventBanners.announceFirstBlood(killerName, victimName, killerTeam);
        }
      } else if (this.hud?.eventBanners) {
        let streakName = null;
        if (currentStreak === 2) streakName = 'DOUBLE KILL!';
        else if (currentStreak === 3) streakName = 'TRIPLE KILL!';
        else if (currentStreak === 4) streakName = 'EM CHAMAS!';
        else if (currentStreak >= 5) streakName = 'LENDÁRIO!';

        this.hud.eventBanners.announceKill(killerName, victimName, {
          streak: currentStreak,
          isStreak: currentStreak >= 2,
          streakName,
          team: killerTeam
        });
      }

      const heroXp = calculateKillXp('hero', target.level || 1);
      const eligibleHeroes = this.entities.filter(e => e.type === 'hero' && e.team !== target.team && (e.isAlive ? e.isAlive() : (!e.isDead && (e.hp > 0 || typeof e.hp !== 'number'))));
      if (killer && killer.type === 'hero' && killer.team !== target.team) {
        if (typeof killer.gainXp === 'function') {
          killer.gainXp(heroXp);
          if (killer.isLocalPlayer && this.particles) {
            this.particles.addFloatingText(`+${heroXp} XP (Abate!)`, killer.x, killer.y - 50, {
              color: '#f59e0b',
              fontSize: 15
            });
          }
        }
      } else if (eligibleHeroes.length > 0) {
        for (const h of eligibleHeroes) {
          if (Math.hypot(h.x - target.x, h.y - target.y) <= 1000) {
            if (typeof h.gainXp === 'function') {
              h.gainXp(heroXp);
              if (h.isLocalPlayer && this.particles) {
                this.particles.addFloatingText(`+${heroXp} XP`, h.x, h.y - 50, {
                  color: '#f59e0b',
                  fontSize: 15
                });
              }
            }
          }
        }
      }
    } else if (target.type === 'tower') {
      const killerName = killer ? (killer.name || killer.heroClass || null) : null;
      if (this.hud?.eventBanners) {
        this.hud.eventBanners.announceTowerDestroyed(target.team, killerName);
      }
      if (this.camera && typeof this.camera.addTrauma === 'function') {
        this.camera.addTrauma(0.50);
      }

      const towerXp = calculateKillXp('tower');
      const alliedHeroes = this.entities.filter(e => e.type === 'hero' && e.team !== target.team && (e.isAlive ? e.isAlive() : (!e.isDead && (e.hp > 0 || typeof e.hp !== 'number'))));
      for (const h of alliedHeroes) {
        if (typeof h.gainXp === 'function') {
          h.gainXp(towerXp);
          if (h.isLocalPlayer && this.particles) {
            this.particles.addFloatingText(`+${towerXp} XP (Torre)`, h.x, h.y - 50, {
              color: '#38bdf8',
              fontSize: 14
            });
          }
        }
      }
    } else if (target.type === 'boss') {
      const isSupreme = !!(target.name?.includes('Supreme') || target.name?.includes('Guardian'));
      const bossXp = calculateKillXp('boss', 1, { isSupreme });
      const alliedTeam = killer?.team || (this.playerHero ? this.playerHero.team : 'allied');
      const killerName = killer ? (killer.name || killer.heroClass || null) : null;
      if (this.hud?.eventBanners) {
        this.hud.eventBanners.announceBossSlain(target.name || (isSupreme ? 'Boss Supremo' : 'Colosso'), alliedTeam, killerName);
      }
      if (this.camera && typeof this.camera.addTrauma === 'function') {
        this.camera.addTrauma(0.65);
      }

      const heroes = this.entities.filter(e => e.type === 'hero' && e.team === alliedTeam && (e.isAlive ? e.isAlive() : (!e.isDead && (e.hp > 0 || typeof e.hp !== 'number'))));
      for (const h of heroes) {
        if (typeof h.gainXp === 'function') {
          h.gainXp(bossXp);
          if (h.isLocalPlayer && this.particles) {
            this.particles.addFloatingText(`+${bossXp} XP (Chefe Derrotado!)`, h.x, h.y - 50, {
              color: '#ec4899',
              fontSize: 15
            });
          }
        }
      }
    }
  }

  executeHeroSkill(slot, ability, cmd, hero = this.playerHero) {
    if (!hero) return;
    const isHeroAlive = typeof hero.isAlive === 'function'
      ? hero.isAlive()
      : (!hero.isDead && (typeof hero.hp !== 'number' || hero.hp > 0));
    if (!isHeroAlive) return;
    if (hero.isLocalPlayer && typeof hero.canCast === 'function' && !hero.canCast()) return;

    const targetX = cmd.targetX ?? hero.x;
    const targetY = cmd.targetY ?? hero.y;

    // Orient hero towards skill target on cast
    if (targetX !== hero.x || targetY !== hero.y) {
      hero.facing = Math.atan2(targetY - hero.y, targetX - hero.x);
      if ('targetFacing' in hero) {
        hero.targetFacing = hero.facing;
      }
    }

    // Deduct mana & set cooldown
    hero.mana = Math.max(0, hero.mana - (ability.manaCost || 0));
    const effectiveCooldown = ability.cooldown * (1 - (hero.cdr || 0));
    ability.cooldownRemaining = Math.max(1.0, effectiveCooldown);

    // Audio SFX skill execution
    if (this.sound) {
      this.sound.playSkill(slot, hero.heroId || hero.heroClass || 'knight');
    }

    // Broadcast if cast by local hero
    if (hero.isLocalPlayer && this.network && !this.network.isSoloMode) {
      this.network.broadcast({
        type: 'CAST_SKILL',
        heroId: hero.id,
        slot,
        targetX,
        targetY,
        originX: hero.x,
        originY: hero.y
      });
    }

    const heroId = hero.heroId;

    // -----------------------------------------------------------------
    // Skill Implementations per Hero
    // -----------------------------------------------------------------
    if (heroId === 'sorceress') {
      if (slot === 'Q') { // Fireball
        this.particles.emit('spark', { x: targetX, y: targetY, count: 30, speed: 180, color: '#f97316' });
        this.particles.emit('ring', { x: targetX, y: targetY, startRadius: 10, maxRadius: 90, color: '#ef4444', life: 0.5 });
        this.damageEnemiesInRadius(targetX, targetY, 90, 85 + (hero.abilityPower || 0) * 0.75, 'magical');
      } else if (slot === 'W') { // Frost Blizzard
        this.particles.emit('ring', { x: targetX, y: targetY, startRadius: 20, maxRadius: 140, color: '#38bdf8', life: 0.8 });
        this.particles.emit('spark', { x: targetX, y: targetY, count: 25, speed: 80, color: '#bae6fd' });
        this.damageEnemiesInRadius(targetX, targetY, 140, 70 + (hero.abilityPower || 0) * 0.60, 'magical', { slow: 0.5, slowDuration: 2.5 });
      } else if (slot === 'E') { // Arcane Blink
        this.particles.emit('spark', { x: hero.x, y: hero.y, count: 20, speed: 120, color: '#a855f7' });
        const blinkDest = this.map.findNearestWalkable(targetX, targetY, hero.radius);
        hero.x = blinkDest.x;
        hero.y = blinkDest.y;
        hero.stop();
        this.particles.emit('ring', { x: hero.x, y: hero.y, startRadius: 8, maxRadius: 40, color: '#c084fc', life: 0.4 });
      } else if (slot === 'R') { // Meteor Devastation
        this.particles.emit('ring', { x: targetX, y: targetY, startRadius: 20, maxRadius: 200, color: '#ea580c', life: 1.0 });
        this.particles.emit('spark', { x: targetX, y: targetY, count: 60, speed: 250, color: '#ffedd5' });
        this.damageEnemiesInRadius(targetX, targetY, 200, 220 + (hero.abilityPower || 0) * 0.95, 'magical', { stun: 1.2 });
      }
    } else if (heroId === 'ranger') {
      if (slot === 'Q') { // Piercing Arrow
        const angle = Math.atan2(targetY - hero.y, targetX - hero.x);
        for (let d = 50; d <= 650; d += 80) {
          const px = hero.x + Math.cos(angle) * d;
          const py = hero.y + Math.sin(angle) * d;
          this.particles.emit('spark', { x: px, y: py, count: 6, speed: 60, color: '#10b981' });
        }
        this.damageEnemiesInLine(hero.x, hero.y, targetX, targetY, 650, 40, 75 + (hero.attackDamage || 0) * 1.0);
      } else if (slot === 'W') { // Volley of Arrows
        this.particles.emit('ring', { x: targetX, y: targetY, startRadius: 15, maxRadius: 130, color: '#34d399', life: 0.6 });
        this.damageEnemiesInRadius(targetX, targetY, 130, 60 + (hero.attackDamage || 0) * 0.70, 'physical', { slow: 0.35, slowDuration: 2.0 });
      } else if (slot === 'E') { // Acrobatic Dash
        const angle = Math.atan2(targetY - hero.y, targetX - hero.x);
        const dashDist = 280;
        const dest = this.map.findNearestWalkable(hero.x + Math.cos(angle) * dashDist, hero.y + Math.sin(angle) * dashDist, hero.radius);
        hero.x = dest.x;
        hero.y = dest.y;
        hero.stop();
        hero.speed += 80;
        setTimeout(() => { if (hero) hero.speed = Math.max(hero.speed - 80, 325); }, 2000);
        this.particles.emit('ring', { x: hero.x, y: hero.y, startRadius: 10, maxRadius: 40, color: '#6ee7b7', life: 0.35 });
      } else if (slot === 'R') { // Snipe of Judgment
        const angle = Math.atan2(targetY - hero.y, targetX - hero.x);
        this.particles.emit('ring', { x: targetX, y: targetY, startRadius: 20, maxRadius: 80, color: '#facc15', life: 0.6 });
        this.damageEnemiesInLine(hero.x, hero.y, targetX, targetY, 900, 50, 240 + (hero.attackDamage || 0) * 1.30);
      }
    } else if (heroId === 'assassin') {
      if (slot === 'Q') { // Shadow Step
        const target = this.findNearestEnemy(targetX, targetY, 400);
        if (target) {
          hero.x = target.x - 30;
          hero.y = target.y - 30;
          hero.stop();
          this.particles.emit('spark', { x: target.x, y: target.y, count: 25, speed: 140, color: '#a855f7' });
          target.takeDamage(90 + (hero.attackDamage || 0) * 1.20, 'physical');
        }
      } else if (slot === 'W') { // Poison Blades
        this.particles.emit('ring', { x: hero.x, y: hero.y, startRadius: 10, maxRadius: 180, color: '#22c55e', life: 0.4 });
        this.damageEnemiesInRadius(hero.x, hero.y, 180, 65 + (hero.attackDamage || 0) * 0.75, 'physical');
      } else if (slot === 'E') { // Smoke Shroud
        this.particles.emit('ring', { x: hero.x, y: hero.y, startRadius: 10, maxRadius: 100, color: '#64748b', life: 0.8 });
        hero.isUntargetableFlag = true;
        hero.speed += 100;
        setTimeout(() => {
          if (hero) {
            hero.isUntargetableFlag = false;
            hero.speed = Math.max(hero.speed - 100, 325);
          }
        }, 2500);
      } else if (slot === 'R') { // Lethal Dance
        this.particles.emit('ring', { x: hero.x, y: hero.y, startRadius: 20, maxRadius: 300, color: '#9333ea', life: 0.8 });
        this.particles.emit('spark', { x: hero.x, y: hero.y, count: 40, speed: 220, color: '#c084fc' });
        this.damageEnemiesInRadius(hero.x, hero.y, 300, 240 + (hero.attackDamage || 0) * 1.30, 'physical');
      }
    } else if (heroId === 'cleric') {
      if (slot === 'Q') { // Sacred Light
        this.particles.emit('spark', { x: targetX, y: targetY, count: 20, speed: 120, color: '#fde047' });
        this.healAlliesInRadius(targetX, targetY, 150, 90 + (hero.abilityPower || 0) * 0.70);
        this.damageEnemiesInRadius(targetX, targetY, 150, 75 + (hero.abilityPower || 0) * 0.65, 'magical');
      } else if (slot === 'W') { // Radiant Sanctuary
        this.particles.emit('ring', { x: targetX, y: targetY, startRadius: 20, maxRadius: 150, color: '#fbbf24', life: 1.2 });
        this.healAlliesInRadius(targetX, targetY, 150, 120 + (hero.abilityPower || 0) * 0.80);
      } else if (slot === 'E') { // Solar Judgment
        this.particles.emit('ring', { x: targetX, y: targetY, startRadius: 10, maxRadius: 100, color: '#f59e0b', life: 0.6 });
        this.damageEnemiesInRadius(targetX, targetY, 100, 80 + (hero.abilityPower || 0) * 0.60, 'magical', { stun: 1.5 });
      } else if (slot === 'R') { // Divine Miracle
        this.particles.emit('ring', { x: hero.x, y: hero.y, startRadius: 30, maxRadius: 350, color: '#fef08a', life: 1.5 });
        this.healAlliesInRadius(hero.x, hero.y, 350, 250 + (hero.abilityPower || 0) * 1.0);
        hero.barrier = (hero.barrier || 0) + 300 + (hero.abilityPower || 0) * 0.8;
      }
    } else { // Knight Vanguard
      if (slot === 'Q') { // Shield Slam
        this.particles.emit('ring', { x: targetX, y: targetY, startRadius: 10, maxRadius: 80, color: '#38bdf8', life: 0.4 });
        this.damageEnemiesInRadius(targetX, targetY, 80, 80 + (hero.attackDamage || 0) * 0.60, 'physical', { stun: 1.2 });
      } else if (slot === 'W') { // Taunt / Shield Barrier
        this.particles.emit('ring', { x: hero.x, y: hero.y, startRadius: 10, maxRadius: 260, color: '#3b82f6', life: 0.5 });
        hero.barrier = (hero.barrier || 0) + 120 + (hero.armor || 0) * 1.2;
        this.damageEnemiesInRadius(hero.x, hero.y, 260, 40 + (hero.armor || 0) * 0.40, 'physical');
      } else if (slot === 'E') { // Cleave
        this.particles.emit('ring', { x: hero.x, y: hero.y, startRadius: 10, maxRadius: 160, color: '#60a5fa', life: 0.4 });
        this.damageEnemiesInRadius(hero.x, hero.y, 160, 70 + (hero.attackDamage || 0) * 0.85, 'physical');
      } else if (slot === 'R') { // Heroic Leap Fortress
        this.particles.emit('ring', { x: targetX, y: targetY, startRadius: 20, maxRadius: 280, color: '#1d4ed8', life: 0.9 });
        this.particles.emit('spark', { x: targetX, y: targetY, count: 40, speed: 200, color: '#93c5fd' });
        this.damageEnemiesInRadius(targetX, targetY, 280, 150 + (hero.attackDamage || 0) * 0.70, 'physical', { slow: 0.5, slowDuration: 3.0 });
      }
    }

    this.particles.addFloatingText(`${ability.name}!`, hero.x, hero.y, {
      color: '#38bdf8',
      fontSize: 16
    });
  }

  damageEnemiesInRadius(x, y, radius, damage, type = 'physical', cc = null) {
    for (const ent of this.entities) {
      if ((ent.team === 'enemy' || ent.team === 'neutral') && ent.isAlive()) {
        const dist = Math.hypot(ent.x - x, ent.y - y);
        if (dist <= radius + ent.radius) {
          const dealt = ent.takeDamage(damage, type);
          if (cc) {
            const now = Date.now();
            if (cc.stun) {
              ent.stunnedUntil = Math.max(ent.stunnedUntil || 0, now + cc.stun * 1000);
              if (this.particles && typeof this.particles.emit === 'function') {
                this.particles.emit('cc_ring', {
                  x: ent.x,
                  y: ent.y,
                  color: '#fbbf24',
                  life: cc.stun
                });
              }
            }
            if (cc.slow) {
              ent.slowedUntil = Math.max(ent.slowedUntil || 0, now + (cc.slowDuration || 2.0) * 1000);
              ent.slowPercentage = Math.max(ent.slowPercentage || 0, cc.slow);
              if (this.particles && typeof this.particles.emit === 'function') {
                this.particles.emit('cc_ring', {
                  x: ent.x,
                  y: ent.y,
                  color: '#38bdf8',
                  life: cc.slowDuration || 2.0
                });
              }
            }
          }
          if (ent.isDead && this.playerHero) {
            let bounty = 25;
            if (ent.type === 'minion') {
              const killRes = resolveMinionDeath(ent.subType || 'melee', this.playerHero, this.entities.filter(e => e.team === this.playerHero.team && e.type === 'hero'));
              bounty = killRes.awardedKillerGold;
            } else if (ent.type === 'tower') {
              bounty = 300;
            } else if (ent.type === 'boss') {
              bounty = (ent.name?.includes('Supreme') || ent.name?.includes('Guardian')) ? 500 : 300;
            }
            this.playerHero.gold = (this.playerHero.gold || 0) + bounty;
            if (this.shopUI) this.shopUI.updateGoldDisplay();
            this.awardDeathXp(ent, this.playerHero);
          }
        }
      }
    }
  }

  damageEnemiesInLine(x1, y1, x2, y2, maxDist, width, damage) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    for (const ent of this.entities) {
      if ((ent.team === 'enemy' || ent.team === 'neutral') && ent.isAlive()) {
        const dx = ent.x - x1;
        const dy = ent.y - y1;
        const distAlong = dx * Math.cos(angle) + dy * Math.sin(angle);
        const distPerp = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));

        if (distAlong >= 0 && distAlong <= maxDist && distPerp <= width + ent.radius) {
          ent.takeDamage(damage, 'physical');
          if (ent.isDead && this.playerHero) {
            let bounty = 25;
            if (ent.type === 'minion') {
              const killRes = resolveMinionDeath(ent.subType || 'melee', this.playerHero, this.entities.filter(e => e.team === this.playerHero.team && e.type === 'hero'));
              bounty = killRes.awardedKillerGold;
            } else if (ent.type === 'tower') {
              bounty = 300;
            } else if (ent.type === 'boss') {
              bounty = (ent.name?.includes('Supreme') || ent.name?.includes('Guardian')) ? 500 : 300;
            }
            this.playerHero.gold = (this.playerHero.gold || 0) + bounty;
            if (this.shopUI) this.shopUI.updateGoldDisplay();
            this.awardDeathXp(ent, this.playerHero);
          }
        }
      }
    }
  }

  healAlliesInRadius(x, y, radius, amount) {
    for (const ent of this.entities) {
      if (ent.team === 'allied' && ent.isAlive()) {
        const dist = Math.hypot(ent.x - x, ent.y - y);
        if (dist <= radius + ent.radius) {
          ent.heal(amount);
          this.particles.addFloatingText(`+${Math.round(amount)}`, ent.x, ent.y - 20, { color: '#22c55e', fontSize: 14 });
        }
      }
    }
  }

  findNearestEnemy(x, y, maxRadius, heroTeam = 'allied', preferredTeam = null, excludeId = null) {
    let nearest = null;
    let minD = maxRadius;
    let highestPriority = -1;

    for (const ent of this.entities) {
      if (!ent) continue;
      if (excludeId && ent.id === excludeId) continue;
      const isAlive = typeof ent.isAlive === 'function' ? ent.isAlive() : (typeof ent.hp === 'number' ? ent.hp > 0 : !ent.isDead);
      if (!isAlive) continue;
      if (typeof ent.isUntargetable === 'function' && ent.isUntargetable()) continue;
      if (typeof ent.isInvulnerable === 'function' && ent.isInvulnerable()) continue;

      const isHostile = (ent.team === 'enemy' || ent.team === 'neutral' || ent.team !== heroTeam) && ent.team !== 'allied';
      if (isHostile) {
        const dist = Math.hypot(ent.x - x, ent.y - y);
        if (dist <= maxRadius) {
          // Priority: Hero (5) > Minion (4) > Boss (3) > Structure/Tower (2) > Neutral (1)
          let prio = 2;
          if (ent.type === 'hero') prio = 5;
          else if (ent.type === 'minion') prio = 4;
          else if (ent.type === 'boss') prio = 3;
          else if (ent.team === 'neutral') prio = (preferredTeam === 'neutral' ? 5 : 1);

          if (preferredTeam && ent.team === preferredTeam) {
            prio += 2;
          }

          if (prio > highestPriority || (prio === highestPriority && dist < minD)) {
            highestPriority = prio;
            minD = dist;
            nearest = ent;
          }
        }
      }
    }
    return nearest;
  }

  updateHeroCombat(dt, hero) {
    if (!hero) return;
    const isHeroAlive = typeof hero.isAlive === 'function'
      ? hero.isAlive()
      : (!hero.isDead && (typeof hero.hp !== 'number' || hero.hp > 0));
    if (!isHeroAlive) return;

    // Attack cooldown is decremented solely in HeroEntity.update(dt) (single decrement per tick)

    // 1. Auto-target acquisition when idle (local player only)
    if (hero.isLocalPlayer && !hero.attackTarget && !hero.isMoving && !hero.isRecalling && !hero.holdPosition) {
      const searchRadius = Math.max(hero.attackRange + 40, 250);
      const enemy = this.findNearestEnemy(hero.x, hero.y, searchRadius, hero.team);
      if (enemy) {
        hero.attackTarget = enemy;
      }
    }

    // 2. Attack-move behavior & destination arrival clearance
    if (hero.attackMoveDestination && !hero.attackTarget) {
      const dest = hero.attackMoveDestination;
      const distToDest = Math.hypot(dest.x - hero.x, dest.y - hero.y);

      // Arrival threshold: arrived within 10 units of destination -> clear destination and stop
      if (distToDest <= 10) {
        hero.attackMoveDestination = null;
        hero.isMoving = false;
        hero.targetX = null;
        hero.targetY = null;
        hero.vx = 0;
        hero.vy = 0;
      } else {
        const searchRadius = Math.max(hero.attackRange + 60, 280);
        const enemy = this.findNearestEnemy(hero.x, hero.y, searchRadius, hero.team);
        if (enemy) {
          hero.attackTarget = enemy;
        } else if (!hero.holdPosition && !hero.isMoving) {
          // Resume pathing towards destination if no enemies encountered
          const walkable = this.map ? this.map.findNearestWalkable(dest.x, dest.y, hero.radius) : dest;
          hero.moveTo(walkable.x, walkable.y, true);
        }
      }
    }

    // 3. Process current attack target
    if (hero.attackTarget) {
      let target = hero.attackTarget;
      let isTargetAlive = target && (typeof target.isAlive === 'function' ? target.isAlive() : target.hp > 0);
      let isUntargetable = target && typeof target.isUntargetable === 'function' && target.isUntargetable();

      if (!isTargetAlive || isUntargetable) {
        // Combat Chaining: se o monstro/inimigo atual morreu, encadeia no próximo mais próximo
        const chainRadius = Math.max(hero.attackRange + 150, 500);
        const nextEnemy = this.findNearestEnemy(hero.x, hero.y, chainRadius, hero.team, target?.team, target?.id);
        if (nextEnemy && !hero.holdPosition) {
          hero.attackTarget = nextEnemy;
          target = nextEnemy;
          isTargetAlive = true;
          isUntargetable = false;
        } else {
          hero.attackTarget = null;
          hero.isMoving = false;
          hero.vx = 0;
          hero.vy = 0;
          if (hero.attackMoveDestination && !hero.holdPosition) {
            const dest = hero.attackMoveDestination;
            const distToDest = Math.hypot(dest.x - hero.x, dest.y - hero.y);
            if (distToDest <= 10) {
              hero.attackMoveDestination = null;
            } else {
              const walkable = this.map ? this.map.findNearestWalkable(dest.x, dest.y, hero.radius) : dest;
              hero.moveTo(walkable.x, walkable.y, true);
            }
          }
          return;
        }
      }

      const dx = target.x - hero.x;
      const dy = target.y - hero.y;
      const dist = Math.hypot(dx, dy);
      const targetRadius = target.selectionRadius || target.radius || 20;
      const effectiveRange = hero.attackRange + targetRadius;

      // Always turn hero to face the target
      hero.facing = Math.atan2(dy, dx);
      if ('targetFacing' in hero) {
        hero.targetFacing = hero.facing;
      }

      if (dist <= effectiveRange) {
        // Target in range! Stop moving
        hero.isMoving = false;
        hero.targetX = null;
        hero.targetY = null;
        hero.vx = 0;
        hero.vy = 0;

        // Check if hero can attack (not stunned / silenced)
        if (hero.canAttack && hero.canAttack() && hero.attackCooldown <= 0) {
          const as = Math.max(0.2, hero.attackSpeed || 0.65);
          hero.attackCooldown = 1.0 / as;
          this.executeHeroBasicAttack(hero, target);
        }
      } else {
        // Remote heroes' positions and movement are strictly driven by network HERO_UPDATE packets
        if (!hero.isLocalPlayer) {
          hero.attackTarget = null;
          return;
        }

        // Pursue target if not crowd controlled (stunned/rooted)
        if (hero.canMove && !hero.canMove()) {
          hero.isMoving = false;
          hero.vx = 0;
          hero.vy = 0;
          return;
        }

        const step = hero.speed * dt;
        hero.vx = (dx / dist) * hero.speed;
        hero.vy = (dy / dist) * hero.speed;
        hero.x += hero.vx * dt;
        hero.y += hero.vy * dt;
        hero.facing = Math.atan2(dy, dx);
        hero.isMoving = true;
      }
    }
  }

  executeHeroBasicAttack(hero, target) {
    if (!hero || !target || !target.isAlive()) return;

    const isMelee = (hero.attackRange || 130) <= 180;
    const isCrit = Math.random() < (hero.critChance || 0);

    // Audio SFX basic attack
    if (this.sound) {
      this.sound.playAttack(hero.heroId || hero.heroClass || 'knight', !isMelee);
    }

    if (isMelee) {
      this.applyHeroHit(
        hero,
        target,
        hero.attackDamage || 50,
        'physical',
        isCrit,
        hero.lifesteal || 0
      );
      this.particles.emit('spark', {
        x: target.x,
        y: target.y,
        count: isCrit ? 20 : 12,
        speed: 160,
        color: hero.heroId === 'assassin' ? '#a855f7' : '#38bdf8'
      });
      this.particles.emit('ring', {
        x: target.x,
        y: target.y,
        startRadius: 8,
        maxRadius: 28,
        color: '#fbbf24',
        life: 0.25
      });
      // Slash flash between hero and target
      const midX = (hero.x + target.x) * 0.5;
      const midY = (hero.y + target.y) * 0.5;
      this.particles.emit('spark', {
        x: midX,
        y: midY,
        count: 8,
        speed: 120,
        color: '#f8fafc'
      });
    } else {
      const proj = new HeroProjectile({
        hero,
        target,
        damage: hero.attackDamage || 50,
        damageType: (hero.heroId === 'sorceress') ? 'magical' : 'physical',
        isCrit,
        lifesteal: hero.lifesteal || 0,
        speed: 750,
        x: hero.x,
        y: hero.y,
        z: (hero.height || 40) * 0.7,
        heroClass: hero.heroId
      });
      this.heroProjectiles.push(proj);
      this.particles.emit('spark', {
        x: hero.x,
        y: hero.y,
        count: 6,
        speed: 90,
        color: hero.heroId === 'sorceress' ? '#f97316' : (hero.heroId === 'cleric' ? '#fde047' : '#34d399')
      });
    }
  }

  applyHeroHit(hero, target, damage, damageType, isCrit = false, lifesteal = 0) {
    if (!target || (typeof target.isAlive === 'function' ? !target.isAlive() : target.hp <= 0)) return;

    // Check invulnerability (e.g. inner towers protected by outer tower, nexus)
    if (typeof target.isInvulnerable === 'function' && target.isInvulnerable()) {
      this.particles.addFloatingText('INVULNERÁVEL', target.x, target.y - 20, {
        color: '#94a3b8',
        fontSize: 13
      });
      return;
    }

    // Check boss shield (Supreme Boss Phase 3 Cataclysmic Shield)
    if (target.shieldActive) {
      this.particles.addFloatingText('ESCUDO ATIVO', target.x, target.y - 20, {
        color: '#38bdf8',
        fontSize: 13
      });
      return;
    }

    // Apply combat damage with mitigation, crit, and lifesteal
    const res = applyDamage(target, {
      sourceId: hero?.id || 'player_hero',
      sourceType: 'hero',
      amount: damage,
      type: damageType,
      isCrit,
      critMultiplier: 2.0,
      lifesteal
    });

    // Lifesteal heal
    if (res.lifestealHealed > 0 && hero && hero.isAlive()) {
      hero.heal(res.lifestealHealed);
      this.particles.addFloatingText(`+${Math.round(res.lifestealHealed)}`, hero.x, hero.y - 20, {
        color: '#22c55e',
        fontSize: 13
      });
    }

    // Audio SFX hit impact
    if (this.sound) {
      this.sound.playHit(isCrit);
    }

    // Floating damage text & hero-specific hit particles
    const color = isCrit ? '#ef4444' : (damageType === 'magical' ? '#c084fc' : '#ffffff');
    this.particles.addFloatingText(
      isCrit ? `💥 ${Math.round(res.finalDamage)}!` : `${Math.round(res.finalDamage)}`,
      target.x,
      target.y - 20,
      { color, fontSize: isCrit ? 16 : 13, isCrit }
    );

    // Screen shake on critical strikes
    if (isCrit && this.camera && typeof this.camera.addTrauma === 'function') {
      this.camera.addTrauma(0.18);
    }

    // Hero-specific attack hit VFX preset
    if (this.particles && typeof this.particles.emitHeroAttackHit === 'function') {
      this.particles.emitHeroAttackHit(hero?.heroId || hero?.heroClass || 'knight', target.x, target.y, isCrit);
    } else if (this.particles) {
      this.particles.emit('spark', {
        x: target.x,
        y: target.y,
        count: isCrit ? 16 : 8,
        speed: 140,
        color: isCrit ? '#ef4444' : (damageType === 'magical' ? '#c084fc' : '#38bdf8')
      });
    }

    // Screen shake on player hero death
    if ((target.isLocalPlayer || target === this.playerHero) && (target.hp <= 0 || target.isDead)) {
      if (this.camera && typeof this.camera.addTrauma === 'function') {
        this.camera.addTrauma(0.35);
      }
    }

    // Aggro: If attacking enemy under tower or attacking allied hero
    if (target.type === 'hero' && target.team === 'allied') {
      this.lastAggressorId = hero?.id || null;
    }

    // Check if target died from this hit -> award bounty!
    const isTargetDead = target.hp <= 0 || target.isDead;
    if (isTargetDead) {
      let bounty = 0;
      if (target.type === 'minion') {
        const killRes = resolveMinionDeath(target.subType || 'melee', hero, this.entities.filter(e => e.team === hero.team && e.type === 'hero'));
        bounty = killRes.awardedKillerGold;
      } else if (target.type === 'tower') {
        bounty = 300;
      } else if (target.type === 'boss') {
        bounty = (target.name?.includes('Supreme') || target.name?.includes('Guardian')) ? 500 : 300;
      } else if (target.type === 'hero') {
        bounty = 300;
      }

      if (bounty > 0 && hero) {
        hero.gold = (hero.gold || 0) + bounty;
        if (this.shopUI) this.shopUI.updateGoldDisplay();
        this.particles.addFloatingText(`+${bounty}g`, target.x, target.y - 35, {
          color: '#fbbf24',
          fontSize: 16
        });
      }

      this.awardDeathXp(target, hero);

      if (hero && hero.attackTarget?.id === target.id) {
        const chainRadius = Math.max(hero.attackRange + 150, 500);
        const nextEnemy = this.findNearestEnemy(hero.x, hero.y, chainRadius, hero.team, target.team, target.id);
        hero.attackTarget = (nextEnemy && !hero.holdPosition) ? nextEnemy : null;

        // Attack-move continuation: resume pathing towards destination if intermediate target died and no chain target
        if (!hero.attackTarget && hero.attackMoveDestination && !hero.holdPosition) {
          const dest = hero.attackMoveDestination;
          const distToDest = Math.hypot(dest.x - hero.x, dest.y - hero.y);
          if (distToDest <= 10) {
            hero.attackMoveDestination = null;
            hero.isMoving = false;
            hero.targetX = null;
            hero.targetY = null;
            hero.vx = 0;
            hero.vy = 0;
          } else {
            const walkable = this.map ? this.map.findNearestWalkable(dest.x, dest.y, hero.radius) : dest;
            hero.moveTo(walkable.x, walkable.y, true);
          }
        }
      }
    }
  }

  update(dt = 0.01667, tickIndex = 0) {
    this.matchTime += dt;

    // 0. 20Hz Real-Time Network State Sync
    this.netSyncAccumulator = (this.netSyncAccumulator || 0) + dt;
    if (this.netSyncAccumulator >= 0.05) { // 20Hz (every 50ms)
      this.netSyncAccumulator = 0;
      if (this.network && !this.network.isSoloMode && this.playerHero) {
        this.network.broadcast({
          type: 'HERO_UPDATE',
          id: this.playerHero.id,
          heroId: this.playerHero.heroId,
          name: this.playerHero.name,
          x: Math.round(this.playerHero.x * 10) / 10,
          y: Math.round(this.playerHero.y * 10) / 10,
          facing: Math.round(this.playerHero.facing * 100) / 100,
          hp: Math.round(this.playerHero.hp),
          maxHp: Math.round(this.playerHero.maxHp),
          mana: Math.round(this.playerHero.mana),
          maxMana: Math.round(this.playerHero.maxMana),
          isRecalling: !!this.playerHero.isRecalling,
          isDead: !!this.playerHero.isDead,
          speed: this.playerHero.speed,
          level: this.playerHero.level,
          xp: this.playerHero.xp || 0,
          maxXp: this.playerHero.maxXp || 0,
          skillPoints: this.playerHero.skillPoints || 0,
          abilityRanks: {
            Q: this.playerHero.abilities?.Q?.rank || 0,
            W: this.playerHero.abilities?.W?.rank || 0,
            E: this.playerHero.abilities?.E?.rank || 0,
            R: this.playerHero.abilities?.R?.rank || 0
          }
        });
      }
    }

    // Recall audio lifecycle check for player hero
    if (this.playerHero) {
      const isRecallingNow = !!this.playerHero.isRecalling;
      if (this.wasPlayerRecalling && !isRecallingNow) {
        if (this.lastPlayerRecallElapsed >= 4900 || (this.playerHero.x === 400 && this.playerHero.y === 400)) {
          if (this.sound) this.sound.playRecallComplete();
        } else {
          if (this.sound) this.sound.playRecallInterrupt();
        }
      }
      this.wasPlayerRecalling = isRecallingNow;
      this.lastPlayerRecallElapsed = this.playerHero.recallElapsed || 0;
    }

    // 1. Minion wave spawner tick & queue release
    if (this.waveSpawner) {
      this.waveSpawner.update(dt, this.entities);
    }

    // 2. Boss encounters & ground hazard updates
    if (this.bossManager) {
      const colossusBefore = this.bossManager.colossusSpawned;
      const behemothBefore = this.bossManager.behemothSpawned;
      const waveIdx = this.waveSpawner ? this.waveSpawner.waveIndex : 0;
      this.bossManager.checkWaveSpawns(waveIdx, this.entities);
      if (!colossusBefore && this.bossManager.colossusSpawned) {
        if (this.sound) {
          this.sound.playAlertBoss();
        }
        if (this.hud?.eventBanners) {
          this.hud.eventBanners.announceBossSpawn('Stone Colossus', 5);
        }
      }
      if (!behemothBefore && this.bossManager.behemothSpawned) {
        if (this.sound) {
          this.sound.playAlertBoss();
        }
        if (this.hud?.eventBanners) {
          this.hud.eventBanners.announceBossSpawn('Abyssal Behemoth', 10);
        }
      }
      this.bossManager.update(dt, this.entities);
    }

    // 3. Defensive Towers scanning & projectile firing
    for (const structure of this.towers) {
      if (typeof structure.update === 'function') {
        structure.update(dt, this.entities, this.lastAggressorId, null, this);
      }
    }

    // 4. Update dynamic heroes & monitor death / resurrection lifecycle
    for (const ent of this.entities) {
      if (ent.type === 'hero' && typeof ent.update === 'function') {
        const wasAlive = typeof ent.isAlive === 'function'
          ? ent.isAlive()
          : (!ent.isDead && (typeof ent.hp !== 'number' || ent.hp > 0));

        // Check if hero died earlier in this tick (e.g. from tower or projectile)
        if (ent._lastKnownAlive && !wasAlive) {
          ent._lastKnownAlive = false;
          if ((ent.isLocalPlayer || ent === this.playerHero) && this.camera && typeof this.camera.addTrauma === 'function') {
            this.camera.addTrauma(0.35);
          }
          if (this.particles) {
            this.particles.emit('spark', { x: ent.x, y: ent.y, count: 25, speed: 100, color: '#ef4444' });
            this.particles.addFloatingText('💀 MORREU!', ent.x, ent.y - 30, {
              color: '#ef4444',
              fontSize: 16
            });
          }
        }

        ent.update(dt);

        const isAliveNow = typeof ent.isAlive === 'function'
          ? ent.isAlive()
          : (!ent.isDead && (typeof ent.hp !== 'number' || ent.hp > 0));

        // Hero died during update
        if (wasAlive && !isAliveNow) {
          ent._lastKnownAlive = false;
          if ((ent.isLocalPlayer || ent === this.playerHero) && this.camera && typeof this.camera.addTrauma === 'function') {
            this.camera.addTrauma(0.35);
          }
          if (this.particles) {
            this.particles.emit('spark', { x: ent.x, y: ent.y, count: 25, speed: 100, color: '#ef4444' });
            this.particles.addFloatingText('💀 MORREU!', ent.x, ent.y - 30, {
              color: '#ef4444',
              fontSize: 16
            });
          }
        }
        // Hero resurrected during update
        else if (!wasAlive && isAliveNow) {
          ent._lastKnownAlive = true;
          if (this.particles) {
            this.particles.emit('spark', { x: ent.x, y: ent.y, count: 35, speed: 150, color: '#10b981' });
            this.particles.emit('ring', { x: ent.x, y: ent.y, startRadius: 10, maxRadius: 50, color: '#10b981', life: 0.5 });
            this.particles.addFloatingText('✨ RESSURGIU!', ent.x, ent.y - 30, {
              color: '#10b981',
              fontSize: 16
            });
          }
        } else if (isAliveNow) {
          ent._lastKnownAlive = true;
        }
      }
    }

    // 4a. Update player hero combat & auto-attack loop
    if (this.playerHero) {
      this.updateHeroCombat(dt, this.playerHero);
    }
    if (this.remoteHeroes && this.remoteHeroes.size > 0) {
      for (const rHero of this.remoteHeroes.values()) {
        this.updateHeroCombat(dt, rHero);
      }
    }

    // 4b. Update hero projectiles
    if (this.heroProjectiles && this.heroProjectiles.length > 0) {
      for (const p of this.heroProjectiles) {
        p.update(dt, this);
      }
      this.heroProjectiles = this.heroProjectiles.filter(p => !p.isDead);
    }

    // 5. GameMap collision resolution & fountain regeneration
    if (this.map) {
      this.map.update(dt, this.entities);
    }

    // 6. Clean up dead dynamic units (preserve towers, nexus, and heroes for respawn)
    for (const ent of this.entities) {
      const isDead = typeof ent.isDead === 'function' ? ent.isDead() : !!ent.isDead;
      if ((isDead || (typeof ent.hp === 'number' && ent.hp <= 0)) && !ent.xpAwarded) {
        this.awardDeathXp(ent, null);
      }
    }

    this.entities = this.entities.filter(ent => {
      if (ent.type === 'tower' || ent.type === 'nexus' || ent.type === 'hero') return true;
      const isDead = typeof ent.isDead === 'function' ? ent.isDead() : !!ent.isDead;
      return !isDead && (typeof ent.hp !== 'number' || ent.hp > 0);
    });

    // 7. Evaluate Match Endgame Triggers (Victory / Defeat)
    const alliedNexusHp = this.alliedNexus ? this.alliedNexus.hp : 0;
    const enemyNexusHp = this.enemyNexus ? this.enemyNexus.hp : 0;
    const supremeAlive = this.bossManager ? this.bossManager.isSupremeBossAlive() : false;

    const outcome = evaluateMatchOutcome(alliedNexusHp, enemyNexusHp, supremeAlive);
    if (outcome.isOver) {
      if (outcome.outcome === 'VICTORY' && !this.isVictory) {
        this.isVictory = true;
        if (this.sound) {
          this.sound.playVictory();
        }
        if (this.hud?.eventBanners) {
          this.hud.eventBanners.showVictoryBanner({
            message: 'Parabéns! O Boss Supremo e o Cristal Inimigo foram aniquilados!'
          });
        }
        this.showGameOverModal('VITÓRIA!', 'Parabéns! O Boss Supremo e o Cristal Inimigo foram aniquilados!', 'victory');
      } else if (outcome.outcome === 'DEFEAT' && !this.isDefeat) {
        this.isDefeat = true;
        if (this.sound) {
          this.sound.playDefeat();
        }
        if (this.hud?.eventBanners) {
          this.hud.eventBanners.showDefeatBanner({
            message: 'O Cristal Aliado ruiu perante as hordas inimigas!'
          });
        }
        this.showGameOverModal('DERROTA...', 'O Cristal Aliado ruiu perante as hordas inimigas!', 'defeat');
      }
    }

    // 8. Update visual particle effects
    this.particles.update(dt);

    // 9. Update camera follow
    this.camera.update(dt);

    // 10. Update input interactions
    this.input.update(dt, this.playerHero, this.entities);

    // 11. Update HUD
    this.hud.update(this.playerHero, this.getState(), this.input);
  }

  showGameOverModal(title, message, type) {
    if (typeof document === 'undefined') return;

    // Check if pre-rendered endgame-modal exists in DOM (index.html)
    const endgameModal = document.getElementById('endgame-modal');
    if (endgameModal) {
      endgameModal.className = `endgame-modal ${type}`;
      const titleEl = document.getElementById('endgame-title');
      const subtitleEl = document.getElementById('endgame-subtitle');
      const timeEl = document.getElementById('endgame-match-time');
      const iconEl = document.getElementById('endgame-badge-icon');
      const restartBtn = document.getElementById('endgame-restart-btn');

      if (titleEl) titleEl.textContent = title;
      if (subtitleEl) subtitleEl.textContent = message;
      if (timeEl) timeEl.textContent = `${Math.floor(this.matchTime / 60)}m ${Math.floor(this.matchTime % 60)}s`;
      if (iconEl) iconEl.textContent = type === 'victory' ? '🏆' : '💀';

      if (restartBtn) {
        restartBtn.onclick = () => {
          window.location.reload();
        };
      }
      return;
    }

    const existing = document.getElementById('game-over-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'game-over-modal';
    modal.className = `game-over-modal ${type}`;
    modal.innerHTML = `
      <div class="game-over-card">
        <h1 class="game-over-title">${title}</h1>
        <p class="game-over-desc">${message}</p>
        <div class="game-over-time">Tempo de Batalha: ${Math.floor(this.matchTime / 60)}m ${Math.floor(this.matchTime % 60)}s</div>
        <button id="restart-game-btn" class="restart-game-btn">Jogar Novamente</button>
      </div>
    `;

    document.body.appendChild(modal);
    const restartBtn = document.getElementById('restart-game-btn');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        window.location.reload();
      });
    }
  }

  render(alpha = 1.0, frameTime = 16.67) {
    const state = this.getState();
    this.renderer.render(state, this.camera, this.input, this.particles);

    // Draw world decals (boss hazards, active minion projectiles, boss health bar)
    if (this.renderer.ctx) {
      if (this.bossManager) {
        this.bossManager.drawHazards(this.renderer.ctx, this.camera, this.camera.zoom);
        this.bossManager.drawBossHUD(this.renderer.ctx, this.renderer.viewportWidth, this.renderer.viewportHeight);
      }
      if (this.waveSpawner) {
        this.waveSpawner.drawProjectiles(this.renderer.ctx, this.camera, this.camera.zoom);
      }
      if (this.heroProjectiles && this.heroProjectiles.length > 0) {
        for (const p of this.heroProjectiles) {
          p.draw(this.renderer.ctx, this.camera, this.camera.zoom);
        }
      }
    }

    // Render Minimap
    if (this.hud && this.hud.minimap) {
      this.hud.minimap.render(
        state,
        this.camera,
        this.camera.zoom,
        this.renderer.viewportWidth,
        this.renderer.viewportHeight
      );
    }
  }

  getState() {
    return {
      matchTime: this.matchTime,
      entities: this.entities,
      playerHero: this.playerHero,
      isVictory: this.isVictory,
      isDefeat: this.isDefeat
    };
  }

  start() {
    this.loop.start();
  }

  stop() {
    this.loop.stop();
    this.input.unbindEvents();
  }

  pause() {
    this.loop.pause();
  }

  resume() {
    this.loop.resume();
  }
}
