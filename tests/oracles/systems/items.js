/**
 * Specification Reference Oracle: 18-Item Catalog, 6-Slot Inventory & Stat Recomputation
 * Source: PROJECT.md §4 & spec_miner_systems_r0/handoff.md §4.3 (B)
 */

export const CDR_CAP = 0.40; // 40% max CDR
export const MAX_INVENTORY_SLOTS = 6;

export const ITEM_CATALOG = {
  item_dagger: {
    id: 'item_dagger', name: 'Adaga Ágil', tier: 1, cost: 300,
    stats: { attackDamage: 10, movementSpeedPercent: 0.05 }
  },
  item_boots_1: {
    id: 'item_boots_1', name: 'Botas Simples', tier: 1, cost: 300,
    stats: { movementSpeed: 25 }
  },
  item_ruby: {
    id: 'item_ruby', name: 'Cristal de Rubi', tier: 1, cost: 400,
    stats: { hp: 150 }
  },
  item_sword_1: {
    id: 'item_sword_1', name: 'Espada Curta', tier: 1, cost: 450,
    stats: { attackDamage: 15, lifesteal: 0.05 }
  },
  item_tome_1: {
    id: 'item_tome_1', name: 'Tomo Arcano', tier: 1, cost: 450,
    stats: { ap: 25, cdr: 0.05 }
  },
  item_cloth_1: {
    id: 'item_cloth_1', name: 'Colete de Malha', tier: 1, cost: 400,
    stats: { armor: 20, hp: 50 }
  },
  item_boots_warrior: {
    id: 'item_boots_warrior', name: 'Grevas de Batalha', tier: 2, cost: 900,
    stats: { movementSpeed: 45, attackDamage: 15, armor: 10 }
  },
  item_boots_sorcerer: {
    id: 'item_boots_sorcerer', name: 'Passo do Arcano', tier: 2, cost: 900,
    stats: { movementSpeed: 45, ap: 25, cdr: 0.10 }
  },
  item_hammer_war: {
    id: 'item_hammer_war', name: 'Martelo de Guerra', tier: 2, cost: 1200,
    stats: { attackDamage: 30, cdr: 0.10, hp: 100 }
  },
  item_scepter_magic: {
    id: 'item_scepter_magic', name: 'Cetro Esmeralda', tier: 2, cost: 1200,
    stats: { ap: 50, hp: 100, cdr: 0.10 }
  },
  item_vampire_scythe: {
    id: 'item_vampire_scythe', name: 'Foice Sangrenta', tier: 2, cost: 1100,
    stats: { attackDamage: 25, lifesteal: 0.12 }
  },
  item_chain_mail: {
    id: 'item_chain_mail', name: 'Armadura de Ferro', tier: 2, cost: 1000,
    stats: { armor: 40, hp: 150 }
  },
  item_infinity_edge: {
    id: 'item_infinity_edge', name: 'Lâmina do Destino', tier: 3, cost: 3000,
    stats: { attackDamage: 75, lifesteal: 0.15, movementSpeedPercent: 0.10, critChance: 0.25 }
  },
  item_rabadon: {
    id: 'item_rabadon', name: 'Báculo Celestial', tier: 3, cost: 3000,
    stats: { ap: 90, cdr: 0.15, hp: 150, apMultiplier: 0.15 }
  },
  item_heart_colossus: {
    id: 'item_heart_colossus', name: 'Coração do Colosso', tier: 3, cost: 2800,
    stats: { hp: 700, armor: 35, cdr: 0.10 }
  },
  item_thornmail: {
    id: 'item_thornmail', name: 'Égide dos Espinhos', tier: 3, cost: 2600,
    stats: { hp: 450, armor: 65, reflectDamage: 25 }
  },
  item_shadow_blade: {
    id: 'item_shadow_blade', name: 'Glaive Sombria', tier: 3, cost: 2900,
    stats: { attackDamage: 65, cdr: 0.15, movementSpeedPercent: 0.12 }
  },
  item_dawn_chalice: {
    id: 'item_dawn_chalice', name: 'Cálice da Alvorada', tier: 3, cost: 2500,
    stats: { ap: 50, hp: 350, cdr: 0.20, healShieldBonus: 0.20 }
  }
};

export function getSellRefund(cost) {
  return Math.floor(cost * 0.70);
}

export class HeroInventory {
  constructor(hero) {
    this.hero = hero;
    this.slots = new Array(MAX_INVENTORY_SLOTS).fill(null);
  }

  isFull() {
    return this.slots.every(slot => slot !== null);
  }

  getFirstEmptySlot() {
    return this.slots.findIndex(slot => slot === null);
  }

  addItem(itemId) {
    const item = ITEM_CATALOG[itemId];
    if (!item) return { success: false, reason: 'invalid_item' };
    const emptyIndex = this.getFirstEmptySlot();
    if (emptyIndex === -1) return { success: false, reason: 'inventory_full' };

    this.slots[emptyIndex] = item;
    this.recomputeStats(item.stats.hp || 0);
    return { success: true, slotIndex: emptyIndex, item };
  }

  removeItem(slotIndex) {
    if (slotIndex < 0 || slotIndex >= MAX_INVENTORY_SLOTS) {
      return { success: false, reason: 'invalid_slot' };
    }
    const item = this.slots[slotIndex];
    if (!item) return { success: false, reason: 'slot_empty' };

    this.slots[slotIndex] = null;
    this.recomputeStats(0);
    return { success: true, item, refund: getSellRefund(item.cost) };
  }

  recomputeStats(hpGainedFromNewItem = 0) {
    const h = this.hero;
    const base = h.baseStats;

    let bonusHp = 0;
    let bonusAd = 0;
    let bonusAp = 0;
    let bonusArmor = 0;
    let bonusMr = 0;
    let bonusMs = 0;
    let bonusMsPercent = 0;
    let bonusLifesteal = 0;
    let bonusCdr = 0;
    let apMultiplier = 0;

    for (const item of this.slots) {
      if (!item || !item.stats) continue;
      const s = item.stats;
      if (s.hp) bonusHp += s.hp;
      if (s.attackDamage) bonusAd += s.attackDamage;
      if (s.ap) bonusAp += s.ap;
      if (s.armor) bonusArmor += s.armor;
      if (s.magicResist) bonusMr += s.magicResist;
      if (s.movementSpeed) bonusMs += s.movementSpeed;
      if (s.movementSpeedPercent) bonusMsPercent += s.movementSpeedPercent;
      if (s.lifesteal) bonusLifesteal += s.lifesteal;
      if (s.cdr) bonusCdr += s.cdr;
      if (s.apMultiplier) apMultiplier += s.apMultiplier;
    }

    const previousMaxHp = h.maxHp || base.hp;
    const newMaxHp = base.hp + bonusHp;

    h.maxHp = newMaxHp;
    // Current HP adjustments
    if (hpGainedFromNewItem > 0) {
      h.hp = Math.min(newMaxHp, (h.hp || base.hp) + hpGainedFromNewItem);
    } else {
      h.hp = Math.min(newMaxHp, h.hp || base.hp);
    }

    h.attackDamage = base.attackDamage + bonusAd;
    let totalAp = bonusAp;
    if (apMultiplier > 0) {
      totalAp = totalAp * (1 + apMultiplier);
    }
    h.ap = totalAp;
    h.armor = base.armor + bonusArmor;
    h.magicResist = base.magicResist + bonusMr;
    h.movementSpeed = (base.movementSpeed + bonusMs) * (1 + bonusMsPercent);
    h.lifesteal = bonusLifesteal;
    // 40% CDR clamp
    h.cdr = Math.min(CDR_CAP, bonusCdr);
  }
}

export function recalculateHeroStats(hero) {
  if (hero && hero.inventoryInstance) {
    hero.inventoryInstance.recomputeStats();
  }
}

