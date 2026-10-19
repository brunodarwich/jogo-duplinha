/**
 * Specification Reference: 18-Item Catalog, 6-Slot Inventory & Stat Recomputation
 */

export const CDR_CAP = 0.40; // 40% max CDR
export const MAX_INVENTORY_SLOTS = 6;

export const ITEM_CATALOG = {
  item_dagger: {
    id: 'item_dagger', name: 'Adaga Ágil', tier: 1, cost: 300, icon: '🗡️',
    stats: { attackDamage: 10, movementSpeedPercent: 0.05 },
    description: '+10 Dano de Ataque, +5% Velocidade de Movimento'
  },
  item_boots_1: {
    id: 'item_boots_1', name: 'Botas Simples', tier: 1, cost: 300, icon: '👞',
    stats: { movementSpeed: 25 },
    description: '+25 Velocidade de Movimento'
  },
  item_ruby: {
    id: 'item_ruby', name: 'Cristal de Rubi', tier: 1, cost: 400, icon: '💎',
    stats: { hp: 150 },
    description: '+150 Vida Máxima'
  },
  item_sword_1: {
    id: 'item_sword_1', name: 'Espada Curta', tier: 1, cost: 450, icon: '⚔️',
    stats: { attackDamage: 15, lifesteal: 0.05 },
    description: '+15 Dano de Ataque, +5% Roubo de Vida'
  },
  item_tome_1: {
    id: 'item_tome_1', name: 'Tomo Arcano', tier: 1, cost: 450, icon: '📖',
    stats: { ap: 25, cdr: 0.05 },
    description: '+25 Poder Mágico, +5% Redução de Recarga'
  },
  item_cloth_1: {
    id: 'item_cloth_1', name: 'Colete de Malha', tier: 1, cost: 400, icon: '🥋',
    stats: { armor: 20, hp: 50 },
    description: '+20 Armadura, +50 Vida'
  },
  item_boots_warrior: {
    id: 'item_boots_warrior', name: 'Grevas de Batalha', tier: 2, cost: 900, icon: '🥾',
    stats: { movementSpeed: 45, attackDamage: 15, armor: 10 },
    description: '+45 Velocidade, +15 Dano, +10 Armadura'
  },
  item_boots_sorcerer: {
    id: 'item_boots_sorcerer', name: 'Passo do Arcano', tier: 2, cost: 900, icon: '👢',
    stats: { movementSpeed: 45, ap: 25, cdr: 0.10 },
    description: '+45 Velocidade, +25 Poder Mágico, +10% CDR'
  },
  item_hammer_war: {
    id: 'item_hammer_war', name: 'Martelo de Guerra', tier: 2, cost: 1200, icon: '🔨',
    stats: { attackDamage: 30, cdr: 0.10, hp: 100 },
    description: '+30 Dano, +10% CDR, +100 Vida'
  },
  item_scepter_magic: {
    id: 'item_scepter_magic', name: 'Cetro Esmeralda', tier: 2, cost: 1200, icon: '🪄',
    stats: { ap: 50, hp: 100, cdr: 0.10 },
    description: '+50 Poder Mágico, +100 Vida, +10% CDR'
  },
  item_vampire_scythe: {
    id: 'item_vampire_scythe', name: 'Foice Sangrenta', tier: 2, cost: 1100, icon: '🪓',
    stats: { attackDamage: 25, lifesteal: 0.12 },
    description: '+25 Dano de Ataque, +12% Roubo de Vida'
  },
  item_chain_mail: {
    id: 'item_chain_mail', name: 'Armadura de Ferro', tier: 2, cost: 1000, icon: '🛡️',
    stats: { armor: 40, hp: 150 },
    description: '+40 Armadura, +150 Vida'
  },
  item_infinity_edge: {
    id: 'item_infinity_edge', name: 'Lâmina do Destino', tier: 3, cost: 3000, icon: '🗡️',
    stats: { attackDamage: 75, lifesteal: 0.15, movementSpeedPercent: 0.10, critChance: 0.25 },
    description: '+75 Dano, +15% Roubo de Vida, +10% Velocidade, +25% Crítico'
  },
  item_rabadon: {
    id: 'item_rabadon', name: 'Báculo Celestial', tier: 3, cost: 3000, icon: '👑',
    stats: { ap: 90, cdr: 0.15, hp: 150, apMultiplier: 0.15 },
    description: '+90 Poder Mágico, +15% CDR, +150 Vida, +15% AP Total'
  },
  item_heart_colossus: {
    id: 'item_heart_colossus', name: 'Coração do Colosso', tier: 3, cost: 2800, icon: '❤️',
    stats: { hp: 700, armor: 35, cdr: 0.10 },
    description: '+700 Vida Máxima, +35 Armadura, +10% CDR'
  },
  item_thornmail: {
    id: 'item_thornmail', name: 'Égide dos Espinhos', tier: 3, cost: 2600, icon: '🌵',
    stats: { hp: 450, armor: 65, reflectDamage: 25 },
    description: '+450 Vida, +65 Armadura, Reflete 25 de dano físico'
  },
  item_shadow_blade: {
    id: 'item_shadow_blade', name: 'Glaive Sombria', tier: 3, cost: 2900, icon: '🌑',
    stats: { attackDamage: 65, cdr: 0.15, movementSpeedPercent: 0.12 },
    description: '+65 Dano, +15% CDR, +12% Velocidade'
  },
  item_dawn_chalice: {
    id: 'item_dawn_chalice', name: 'Cálice da Alvorada', tier: 3, cost: 2500, icon: '🏆',
    stats: { ap: 50, hp: 350, cdr: 0.20, healShieldBonus: 0.20 },
    description: '+50 AP, +350 Vida, +20% CDR, +20% Bônus de Cura e Escudos'
  }
};

export function getSellRefund(cost) {
  return Math.floor(cost * 0.70);
}

export class HeroInventory {
  constructor(hero = null) {
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
    const item = typeof itemId === 'string' ? ITEM_CATALOG[itemId] : itemId;
    if (!item) return { success: false, reason: 'invalid_item' };
    const emptyIndex = this.getFirstEmptySlot();
    if (emptyIndex === -1) return { success: false, reason: 'inventory_full' };

    this.slots[emptyIndex] = item;
    this.recomputeStats(item.stats?.hp || 0);
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
    if (!this.hero) return;
    const h = this.hero;
    const base = h.baseStats || {
      hp: h.baseHp || h.maxHp || 680,
      attackDamage: h.baseAd || h.attackDamage || 58,
      armor: h.baseArmor || h.armor || 38,
      magicResist: h.baseMr || h.magicResist || 32,
      movementSpeed: h.baseSpeed || h.movementSpeed || 325,
      mana: h.baseMana || h.maxMana || 300
    };

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

    const newMaxHp = base.hp + bonusHp;
    h.maxHp = newMaxHp;

    if (hpGainedFromNewItem > 0) {
      h.hp = Math.min(newMaxHp, (h.hp ?? base.hp) + hpGainedFromNewItem);
    } else {
      h.hp = Math.min(newMaxHp, h.hp ?? base.hp);
    }

    h.attackDamage = base.attackDamage + bonusAd;
    let totalAp = bonusAp;
    if (apMultiplier > 0) {
      totalAp = totalAp * (1 + apMultiplier);
    }
    h.ap = totalAp;
    h.abilityPower = totalAp;
    h.armor = base.armor + bonusArmor;
    h.magicResist = base.magicResist + bonusMr;
    h.movementSpeed = (base.movementSpeed + bonusMs) * (1 + bonusMsPercent);
    h.speed = h.movementSpeed;
    h.lifesteal = bonusLifesteal;
    h.cdr = Math.min(CDR_CAP, bonusCdr);
  }

  getItem(slotIndex) {
    return this.slots[slotIndex] || null;
  }

  getEquippedItems() {
    return this.slots.filter(item => item !== null);
  }
}

export function recalculateHeroStats(hero) {
  if (hero && hero.inventoryInstance) {
    hero.inventoryInstance.recomputeStats();
  }
}

