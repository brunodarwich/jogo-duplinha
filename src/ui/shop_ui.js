/**
 * Shop UI Controller.
 * Manages item browsing, purchases, sales, and 6-slot inventory visualization.
 */

import { ITEM_CATALOG, getSellRefund, HeroInventory } from '../systems/items.js';

export function renderItemImage(item) {
  return `<img class="item-art" src="${item.image}" alt="${item.name}" width="64" height="64">`;
}

export function formatStatChips(stats = {}) {
  if (!stats || typeof stats !== 'object') {
    return [];
  }
  const chips = [];
  if (stats.attackDamage > 0) chips.push(`+${stats.attackDamage} AD`);
  const ap = stats.ap || stats.abilityPower;
  if (ap > 0) chips.push(`+${ap} AP`);
  if (stats.hp > 0) chips.push(`+${stats.hp} HP`);
  if (stats.armor > 0) chips.push(`+${stats.armor} Armor`);
  if (stats.magicResist > 0) chips.push(`+${stats.magicResist} MR`);
  if (stats.movementSpeed > 0) chips.push(`+${stats.movementSpeed} Vel`);
  if (stats.movementSpeedPercent > 0) chips.push(`+${Math.round(stats.movementSpeedPercent * 100)}% Vel`);
  if (stats.lifesteal > 0) chips.push(`+${Math.round(stats.lifesteal * 100)}% Vamp`);
  if (stats.critChance > 0) chips.push(`+${Math.round(stats.critChance * 100)}% Crítico`);
  if (stats.cdr > 0) chips.push(`+${Math.round(stats.cdr * 100)}% CDR`);
  if (stats.healShieldBonus > 0) chips.push(`+${Math.round(stats.healShieldBonus * 100)}% Cura`);
  return chips;
}

export class ShopUI {
  constructor(gameSim) {
    this.listeners = [];
    this.gameSim = gameSim;
    this.isOpen = false;
    this.activeCategory = 'all'; // 'all' | 'attack' | 'magic' | 'defense' | 'boots'
    this.container = null;
    this.inventorySlotsElements = [];

    this.initUI();
  }

  listen(target, name, callback, options) {
    if (!target) return;
    target.addEventListener(name, callback, options);
    this.listeners.push(() => target.removeEventListener(name, callback, options));
  }

  destroy() {
    this.listeners.forEach(remove => remove());
    this.listeners = [];
    this.container?.remove();
    this.container = null;
    this.isOpen = false;
  }

  initUI() {
    if (typeof document === 'undefined') return;
    // Create Shop Modal Container
    const modal = document.createElement('div');
    modal.id = 'shop-modal';
    modal.className = 'shop-modal hidden';
    modal.innerHTML = `
      <div class="shop-backdrop"></div>
      <div class="shop-window" role="dialog" aria-modal="true" aria-labelledby="shop-title">
        <header class="shop-header">
          <div class="shop-title">
            <span class="shop-icon">🛒</span>
            <h2 id="shop-title">Loja de Itens da Base</h2>
          </div>
          <div class="shop-player-gold">
            <span class="coin-icon">💰</span>
            <span id="shop-gold-val">1200</span>
          </div>
          <button id="shop-close-btn" class="shop-close-btn" aria-label="Fechar loja" title="Fechar (P ou ESC)">✖</button>
        </header>

        <div class="shop-body">
          <!-- Categories Filter -->
          <nav class="shop-categories">
            <button class="cat-btn active" data-cat="all">Todos</button>
            <button class="cat-btn" data-cat="attack">⚔️ Ataque</button>
            <button class="cat-btn" data-cat="magic">✨ Magia</button>
            <button class="cat-btn" data-cat="defense">🛡️ Defesa</button>
            <button class="cat-btn" data-cat="boots">👟 Botas</button>
          </nav>

          <!-- Items Grid -->
          <div class="shop-items-grid" id="shop-items-grid"></div>

          <!-- Item Details / Buy / Sell Panel -->
          <aside class="shop-details" id="shop-details">
            <div class="details-placeholder">Selecione um item para ver detalhes</div>
          </aside>
        </div>

        <footer class="shop-footer">
          <div class="shop-hint">💡 <em>Você só pode comprar e vender itens enquanto estiver dentro da Base / Fonte.</em></div>
        </footer>
      </div>
    `;

    document.body.appendChild(modal);
    this.container = modal;

    // Cache elements & bind events
    modal.querySelector('.shop-backdrop').addEventListener('click', () => this.close());
    modal.querySelector('#shop-close-btn').addEventListener('click', () => this.close());

    // Category buttons
    modal.querySelectorAll('.cat-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        modal.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeCategory = btn.dataset.cat;
        this.renderItemsGrid();
      });
    });

    // Keyboard Escape to close
    this.listen(window, 'keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
      if (e.key !== 'Tab' || !this.isOpen) return;
      const buttons = [...modal.querySelectorAll('button:not(:disabled)')];
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (!modal.contains(document.activeElement)) { e.preventDefault(); first?.focus(); return; }
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    });

    // Bind inventory click on bottom HUD to sell or view
    const hudSlots = document.querySelectorAll('.hud-inventory .inv-slot');
    hudSlots.forEach((slotEl, idx) => {
      this.listen(slotEl, 'click', () => {
        this.handleInventorySlotClick(idx);
      });
    });

    // Shop trigger button on HUD stats
    const goldStat = document.querySelector('.stat-item.gold');
    if (goldStat) {
      goldStat.style.cursor = 'pointer';
      this.listen(goldStat, 'click', () => this.toggle());
      goldStat.setAttribute('role', 'button');
      goldStat.tabIndex = 0;
      goldStat.setAttribute('aria-label', 'Abrir loja de itens');
      this.listen(goldStat, 'keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); this.toggle(); }
      });
    }
    this.listen(document.getElementById('btn-shop-toggle'), 'click', () => this.toggle());

    this.renderItemsGrid();
  }

  isOpenShopZone() {
    if (!this.gameSim || !this.gameSim.playerHero) return false;
    const hero = this.gameSim.playerHero;
    const fountain = { x: 400, y: 400 };
    const dist = Math.hypot(hero.x - fountain.x, hero.y - fountain.y);
    // Include the nexus spawn and the space occupied after structure collision resolution.
    return dist <= 450;
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.gameSim?.virtualJoystick?.cancelMovement();
    if (!this.isOpen && typeof document !== 'undefined') this.returnFocus = document.activeElement;
    this.isOpen = true;
    if (this.container) {
      this.container.classList.remove('hidden');
    }
    this.updateGoldDisplay();
    this.renderItemsGrid();
    this.container?.querySelector('#shop-close-btn')?.focus();
    if (typeof document !== 'undefined') document.querySelector('.hud-info-panel')?.removeAttribute('open');
  }

  close() {
    this.isOpen = false;
    if (this.container) {
      this.container.classList.add('hidden');
    }
    if (typeof document !== 'undefined') {
      const target = this.returnFocus?.getClientRects?.().length ? this.returnFocus : document.getElementById('btn-shop-toggle');
      target?.focus?.();
    }
  }

  updateGoldDisplay() {
    if (typeof document === 'undefined') return;
    const goldEl = document.getElementById('shop-gold-val');
    if (goldEl && this.gameSim?.playerHero) {
      goldEl.textContent = Math.floor(this.gameSim.playerHero.gold || 0);
      if (this.isOpen) {
        const gold = this.gameSim.playerHero.gold || 0;
        const affordability = Object.values(ITEM_CATALOG).map(item => gold >= item.cost ? '1' : '0').join('');
        if (affordability !== this.lastAffordability) {
          this.lastAffordability = affordability;
          this.renderItemsGrid();
        }
        const selectionState = this.selectedItem
          ? `${this.selectedItem.id}:${gold >= this.selectedItem.cost}:${this.isOpenShopZone()}` : '';
        if (this.selectedItem && selectionState !== this.lastSelectionState) {
          this.lastSelectionState = selectionState;
          this.selectItem(this.selectedItem);
        }
      }
    }
  }

  filterItems() {
    const list = Object.values(ITEM_CATALOG);
    if (this.activeCategory === 'all') return list;

    return list.filter(item => {
      const s = item.stats || {};
      if (this.activeCategory === 'attack') return !!(s.attackDamage || s.lifesteal || s.critChance);
      if (this.activeCategory === 'magic') return !!(s.ap || s.cdr || s.healShieldBonus);
      if (this.activeCategory === 'defense') return !!(s.armor || s.magicResist || s.hp);
      if (this.activeCategory === 'boots') return !!(s.movementSpeed);
      return true;
    });
  }

  renderItemsGrid() {
    if (typeof document === 'undefined') return;
    const grid = document.getElementById('shop-items-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const hero = this.gameSim?.playerHero;
    const currentGold = hero ? (hero.gold || 0) : 0;
    const items = this.filterItems();
    for (const item of items) {
      const card = document.createElement('button');
      card.type = 'button';
      const canAfford = currentGold >= item.cost;
      card.className = `shop-item-card tier-${item.tier || 1}${canAfford ? ' can-afford' : ''}`;

      const chips = formatStatChips(item.stats);
      const chipsHtml = chips.length > 0
        ? `<div class="item-stat-chips">${chips.map(c => `<span class="stat-chip">${c}</span>`).join('')}</div>`
        : '';

      card.innerHTML = `
        <div class="item-icon">${renderItemImage(item)}</div>
        <div class="item-info">
          <div class="item-name">${item.name}</div>
          <div class="item-cost">💰 ${item.cost}</div>
          ${chipsHtml}
        </div>
      `;

      card.addEventListener('click', () => {
        this.selectItem(item);
      });

      grid.appendChild(card);
    }
  }

  selectItem(item) {
    const details = document.getElementById('shop-details');
    if (!details || !this.gameSim?.playerHero) return;

    this.selectedItem = item;
    const hero = this.gameSim.playerHero;
    const canAfford = (hero.gold || 0) >= item.cost;
    const insideBase = this.isOpenShopZone();
    // Avoid replacing the focused buy button again on the next simulation tick.
    this.lastSelectionState = `${item.id}:${canAfford}:${insideBase}`;

    details.innerHTML = `
      <div class="details-content">
        <div class="details-header">
          <span class="details-icon">${renderItemImage(item)}</span>
          <div>
            <h3>${item.name}</h3>
            <span class="details-tier">Tier ${item.tier} • 💰 ${item.cost} de Ouro</span>
          </div>
        </div>
        <p class="details-desc">${item.description}</p>
        
        <div class="details-actions">
          <button id="buy-item-btn" class="buy-btn ${canAfford && insideBase ? '' : 'disabled'}" ${canAfford && insideBase ? '' : 'disabled'}>
            ${!insideBase ? 'Fora da Base' : (!canAfford ? 'Ouro Insuficiente' : `Comprar (💰 ${item.cost})`)}
          </button>
        </div>
      </div>
    `;

    const buyBtn = document.getElementById('buy-item-btn');
    if (buyBtn && canAfford && insideBase) {
      buyBtn.addEventListener('click', () => {
        this.buyItem(item);
      });
    }
  }

  buyItem(item) {
    if (!this.gameSim?.playerHero) return;
    if (this.gameSim.network?.authoritativeWorld && !this.gameSim.network.isSoloMode) {
      this.gameSim.handleCommand({ type: 'BUY_ITEM', itemId: item.id });
      return;
    }
    const hero = this.gameSim.playerHero;

    if (!this.isOpenShopZone()) {
      alert('Você precisa estar dentro da base/fonte para comprar itens!');
      return;
    }

    if ((hero.gold || 0) < item.cost) {
      return;
    }

    // Ensure inventory exists
    if (!hero.inventoryInstance) {
      hero.inventoryInstance = new HeroInventory(hero);
    }

    const res = hero.inventoryInstance.addItem(item.id);
    if (!res.success) {
      alert('Inventário cheio! Venda um item para liberar espaço.');
      return;
    }

    hero.gold -= item.cost;
    this.renderItemsGrid();
    this.updateGoldDisplay();
    this.updateHUDInventory();
    this.selectItem(item); // Refresh buy button state

    // Audio/visual feedback
    if (this.gameSim.particles) {
      this.gameSim.particles.addFloatingText(`+ ${item.name}`, hero.x, hero.y, {
        color: '#fbbf24',
        fontSize: 16
      });
    }
  }

  handleInventorySlotClick(slotIdx) {
    if (!this.gameSim?.playerHero) return;
    const hero = this.gameSim.playerHero;
    if (!hero.inventoryInstance) return;

    const item = hero.inventoryInstance.getItem(slotIdx);
    if (!item) return;

    this.selectedItem = null;
    // Open shop and show sell option
    this.open();
    const details = document.getElementById('shop-details');
    if (!details) return;

    const refund = getSellRefund(item.cost);
    const insideBase = this.isOpenShopZone();

    details.innerHTML = `
      <div class="details-content">
        <div class="details-header">
          <span class="details-icon">${renderItemImage(item)}</span>
          <div>
            <h3>${item.name} (Equipado)</h3>
            <span class="details-tier">Slot ${slotIdx + 1} • Valor de Venda: 💰 ${refund}</span>
          </div>
        </div>
        <p class="details-desc">${item.description}</p>
        
        <div class="details-actions">
          <button id="sell-item-btn" class="sell-btn ${insideBase ? '' : 'disabled'}" ${insideBase ? '' : 'disabled'}>
            ${!insideBase ? 'Fora da Base para Vender' : `Vender por 💰 ${refund}`}
          </button>
        </div>
      </div>
    `;

    const sellBtn = document.getElementById('sell-item-btn');
    if (sellBtn && insideBase) {
      sellBtn.addEventListener('click', () => {
        if (this.gameSim.network?.authoritativeWorld && !this.gameSim.network.isSoloMode) {
          this.gameSim.handleCommand({ type: 'SELL_ITEM', slot: slotIdx });
          return;
        }
        const removed = hero.inventoryInstance.removeItem(slotIdx);
        if (removed.success) {
          hero.gold = (hero.gold || 0) + refund;
          this.renderItemsGrid();
          this.updateGoldDisplay();
          this.updateHUDInventory();
          details.innerHTML = '<div class="details-placeholder">Item vendido com sucesso!</div>';
        }
      });
    }
  }

  updateHUDInventory() {
    if (!this.gameSim?.playerHero) return;
    const hero = this.gameSim.playerHero;
    const inv = hero.inventoryInstance;
    if (!inv) return;

    const hudSlots = document.querySelectorAll('.hud-inventory .inv-slot');
    hudSlots.forEach((slotEl, idx) => {
      const item = inv.getItem(idx);
      slotEl.setAttribute?.('aria-label', 'Espaço ' + (idx + 1) + ': ' + (item ? item.name + '. Abrir detalhes de venda' : 'vazio'));
      slotEl.classList.remove('tier-1', 'tier-2', 'tier-3');
      if (item) {
        slotEl.innerHTML = `<span class="slot-item-icon" title="${item.name}: ${item.description}">${renderItemImage(item)}</span>`;
        slotEl.classList.add('occupied', `tier-${item.tier || 1}`);
      } else {
        slotEl.innerHTML = '';
        slotEl.classList.remove('occupied');
      }
    });

    // Update hero stats display on HUD (defensive checks for headless tests)
    const adEl = document.getElementById('stat-ad');
    const apEl = document.getElementById('stat-ap');
    const armorEl = document.getElementById('stat-armor');
    const mrEl = document.getElementById('stat-mr');
    const speedEl = document.getElementById('stat-speed');
    const goldEl = document.getElementById('stat-gold');

    if (adEl) adEl.textContent = Math.round(hero.attackDamage || 0);
    if (apEl) apEl.textContent = Math.round(hero.abilityPower || 0);
    if (armorEl) armorEl.textContent = Math.round(hero.armor || 0);
    if (mrEl) mrEl.textContent = Math.round(hero.magicResist || 0);
    if (speedEl) speedEl.textContent = Math.round(hero.speed || 325);
    if (goldEl) goldEl.textContent = Math.floor(hero.gold || 0);
  }
}
