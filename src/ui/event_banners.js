/**
 * Event Banner Manager (M1 / R1).
 * Manages match event notifications (First Blood, Kills, Towers, Bosses, Victory/Defeat)
 * with a strict priority queue, CSS-driven entry/exit animations, and headless resilience.
 */

export const BANNER_PRIORITY = {
  VICTORY: 1,
  DEFEAT: 1,
  BOSS_SPAWN: 2,
  BOSS_SLAIN: 2,
  FIRST_BLOOD: 3,
  TOWER_DESTROYED: 4,
  KILL_STREAK: 5,
  KILL: 6
};

export function getDefaultPriority(type) {
  switch (type) {
    case 'victory':
    case 'defeat':
      return BANNER_PRIORITY.VICTORY;
    case 'boss_spawn':
    case 'boss_slain':
      return BANNER_PRIORITY.BOSS_SPAWN;
    case 'first_blood':
      return BANNER_PRIORITY.FIRST_BLOOD;
    case 'tower':
    case 'tower_destroyed':
      return BANNER_PRIORITY.TOWER_DESTROYED;
    case 'kill_streak':
      return BANNER_PRIORITY.KILL_STREAK;
    case 'kill':
    default:
      return BANNER_PRIORITY.KILL;
  }
}

export class EventBannerManager {
  /**
   * @param {HTMLElement|string|null} [containerEl=null]
   */
  constructor(containerEl = null) {
    this.containerEl = null;
    this.queue = [];
    this.currentBanner = null;
    this.bannerElement = null;
    this.timeoutId = null;
    this.exitTimeoutId = null;
    this.history = [];
    this.onEventPlaySound = null;

    if (containerEl) {
      if (typeof containerEl === 'string' && typeof document !== 'undefined') {
        this.containerEl = document.querySelector(containerEl);
      } else {
        this.containerEl = containerEl;
      }
    } else if (typeof document !== 'undefined') {
      this.containerEl = document.getElementById('event-banner-container');
    }
  }

  /**
   * Dispatches a banner notification.
   * If priority is higher than currently active banner, preempts it.
   * Otherwise queues the banner based on priority (lower number = higher priority).
   *
   * @param {Object} bannerConfig
   * @param {string} bannerConfig.type
   * @param {string} bannerConfig.title
   * @param {string} [bannerConfig.subtitle='']
   * @param {string} [bannerConfig.icon='⚔️']
   * @param {string} [bannerConfig.team='allied']
   * @param {number} [bannerConfig.priority]
   * @param {number} [bannerConfig.duration=3500]
   * @returns {Object} banner instance
   */
  showBanner(bannerConfig = {}) {
    const cfg = bannerConfig || {};
    const banner = {
      id: `banner_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: cfg.type || 'kill',
      title: cfg.title || 'NOTIFICAÇÃO',
      subtitle: cfg.subtitle || '',
      icon: cfg.icon || '⚔️',
      team: cfg.team || 'allied',
      priority: typeof cfg.priority === 'number' ? cfg.priority : getDefaultPriority(cfg.type),
      duration: typeof cfg.duration === 'number' ? cfg.duration : 3500,
      timestamp: Date.now()
    };

    this.history.push(banner);

    if (typeof this.onEventPlaySound === 'function') {
      try {
        this.onEventPlaySound(banner.type, banner);
      } catch {
        // Sound callback error protection
      }
    }

    if (!this.currentBanner) {
      this._displayBanner(banner);
    } else if (banner.priority < this.currentBanner.priority) {
      // Preemption: Higher priority (lower numeric value) preempts current banner
      const preempted = this.currentBanner;
      this._teardownCurrentBanner(false);
      // Re-queue preempted banner so it plays later
      this._enqueue(preempted);
      this._displayBanner(banner);
    } else {
      // Add to priority queue
      this._enqueue(banner);
    }

    return banner;
  }

  _enqueue(banner) {
    this.queue.push(banner);
    // Sort: lower priority number first, then older timestamp first
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.timestamp - b.timestamp;
    });
  }

  _displayBanner(banner) {
    this.currentBanner = banner;

    if (typeof document !== 'undefined') {
      const container = this._resolveContainer();
      if (container) {
        const el = document.createElement('div');
        el.className = `event-banner ${banner.type} ${banner.team}`;
        el.id = banner.id;
        el.innerHTML = `
          <div class="banner-icon">${banner.icon}</div>
          <div class="banner-content">
            <div class="banner-title">${banner.title}</div>
            ${banner.subtitle ? `<div class="banner-subtitle">${banner.subtitle}</div>` : ''}
          </div>
        `;
        container.appendChild(el);
        this.bannerElement = el;
      }
    }

    // Timer to dismiss banner after duration
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    this.timeoutId = setTimeout(() => {
      this._dismissCurrentBanner();
    }, banner.duration);
  }

  _dismissCurrentBanner() {
    if (!this.currentBanner) return;

    if (this.bannerElement && typeof document !== 'undefined') {
      this.bannerElement.classList.add('exiting');
      this.exitTimeoutId = setTimeout(() => {
        this._teardownCurrentBanner(true);
        this._playNextInQueue();
      }, 300);
    } else {
      this._teardownCurrentBanner(true);
      this._playNextInQueue();
    }
  }

  _teardownCurrentBanner(removeFromDom = true) {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.exitTimeoutId) {
      clearTimeout(this.exitTimeoutId);
      this.exitTimeoutId = null;
    }
    if (removeFromDom && this.bannerElement) {
      this.bannerElement.remove();
      this.bannerElement = null;
    } else if (!removeFromDom && this.bannerElement) {
      this.bannerElement.remove();
      this.bannerElement = null;
    }
    this.currentBanner = null;
  }

  _playNextInQueue() {
    if (this.queue.length > 0) {
      const nextBanner = this.queue.shift();
      this._displayBanner(nextBanner);
    }
  }

  _resolveContainer() {
    if (this.containerEl && typeof document !== 'undefined' && document.contains(this.containerEl)) {
      return this.containerEl;
    }
    if (typeof document !== 'undefined') {
      this.containerEl = document.getElementById('event-banner-container');
      return this.containerEl;
    }
    return null;
  }

  announceFirstBlood(killerName = 'Aliado', victimName = 'Inimigo', team = 'allied') {
    const kName = killerName || 'Aliado';
    const vName = victimName || 'Inimigo';
    const t = team || 'allied';
    return this.showBanner({
      type: 'first_blood',
      priority: BANNER_PRIORITY.FIRST_BLOOD,
      title: 'PRIMEIRO ABATE!',
      subtitle: `${kName} abateu ${vName}!`,
      icon: '🩸',
      team: t,
      duration: 4000
    });
  }

  announceKill(killerName = 'Herói', victimName = 'Inimigo', streakInfo = {}) {
    const info = streakInfo || {};
    const kName = killerName || 'Herói';
    const vName = victimName || 'Inimigo';
    const isStreak = info.isStreak || (info.streak && info.streak >= 2) || (info.multiKill && info.multiKill >= 2);
    let title = 'INIMIGO ABATIDO!';
    let type = 'kill';
    let icon = '⚔️';
    let priority = BANNER_PRIORITY.KILL;

    if (isStreak) {
      type = 'kill_streak';
      priority = BANNER_PRIORITY.KILL_STREAK;
      icon = '⚡';
      if (info.streakName) {
        title = info.streakName;
      } else if (info.multiKill === 2) {
        title = 'DOUBLE KILL!';
      } else if (info.multiKill === 3) {
        title = 'TRIPLE KILL!';
      } else if (info.streak === 3) {
        title = 'FÚRIA ASSASSINA!';
      } else if (info.streak === 4) {
        title = 'EM CHAMAS!';
      } else if (info.streak >= 5) {
        title = 'LENDÁRIO!';
      } else {
        title = 'SEQUÊNCIA DE ABATES!';
      }
    }

    return this.showBanner({
      type,
      priority,
      title,
      subtitle: `${kName} eliminou ${vName}`,
      icon,
      team: info.team || 'allied',
      duration: 3500
    });
  }

  announceTowerDestroyed(towerTeam = 'enemy', killerName = null) {
    const isEnemyTower = (towerTeam || 'enemy') === 'enemy';
    return this.showBanner({
      type: 'tower',
      priority: BANNER_PRIORITY.TOWER_DESTROYED,
      title: isEnemyTower ? 'TORRE INIMIGA DESTRUÍDA!' : 'TORRE ALIADA RUÍDA!',
      subtitle: killerName
        ? `${killerName} destruiu a torre!`
        : (isEnemyTower ? 'Avanço nas defesas inimigas!' : 'Nossas defesas foram violadas!'),
      icon: '🏰',
      team: isEnemyTower ? 'allied' : 'enemy',
      duration: 3500
    });
  }

  announceBossSpawn(bossName = 'Stone Colossus', waveNumber = 5) {
    const bName = bossName || 'Stone Colossus';
    const wave = waveNumber || 5;
    return this.showBanner({
      type: 'boss_spawn',
      priority: BANNER_PRIORITY.BOSS_SPAWN,
      title: 'CHEFE EMERGIU!',
      subtitle: `${bName} surgiu no campo de batalha (Onda ${wave})!`,
      icon: '👹',
      team: 'neutral',
      duration: 4500
    });
  }

  announceBossSlain(bossName = 'Stone Colossus', killerTeam = 'allied', killerName = null) {
    const bName = bossName || 'Stone Colossus';
    const team = killerTeam || 'allied';
    const isAllied = team === 'allied';
    return this.showBanner({
      type: 'boss_slain',
      priority: BANNER_PRIORITY.BOSS_SLAIN,
      title: isAllied ? 'CHEFE DERROTADO!' : 'CHEFE ABATIDO PELO INIMIGO!',
      subtitle: killerName
        ? `${killerName} aniquilou ${bName}!`
        : (isAllied ? `Equipe Aliada triunfou sobre ${bName}!` : `Inimigos conquistaram ${bName}!`),
      icon: '👑',
      team: team,
      duration: 4500
    });
  }

  showVictoryBanner(stats = {}) {
    const s = stats || {};
    return this.showBanner({
      type: 'victory',
      priority: BANNER_PRIORITY.VICTORY,
      title: 'VITÓRIA ÉPICA!',
      subtitle: s.message || 'O Nexus Inimigo e o Boss Supremo foram aniquilados!',
      icon: '🏆',
      team: 'allied',
      duration: 8000
    });
  }

  showDefeatBanner(stats = {}) {
    const s = stats || {};
    return this.showBanner({
      type: 'defeat',
      priority: BANNER_PRIORITY.DEFEAT,
      title: 'DERROTA...',
      subtitle: s.message || 'O Nexus Aliado sucumbiu perante o avanço inimigo.',
      icon: '💀',
      team: 'enemy',
      duration: 8000
    });
  }

  clear() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.exitTimeoutId) {
      clearTimeout(this.exitTimeoutId);
      this.exitTimeoutId = null;
    }
    if (this.bannerElement) {
      this.bannerElement.remove();
      this.bannerElement = null;
    }
    this.currentBanner = null;
    this.queue = [];
  }
}
