/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PARALLAX - Upgrade Mapper
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Converts ticker stats into visual upgrade selections.
 * Stats → Normalized (0-1) → Tier Selection
 * 
 * This is deterministic: same stats always produce same visual.
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { 
  SPRITE_UPGRADES, 
  STAT_MAPPINGS, 
  SLOT_STAT_MAP 
} from '../../data/sprite-upgrades.js';

/**
 * Clamp value between 0 and 1
 */
function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

/**
 * Map a value from one range to 0-1
 */
function mapRange(value, min, max) {
  if (min === max) return 0.5;
  return (value - min) / (max - min);
}

/**
 * Pick the appropriate tier based on a normalized 0-1 value
 */
function pickTier(tiers, value01) {
  for (const tier of tiers) {
    if (value01 >= tier.min && value01 < tier.max) {
      return tier;
    }
  }
  // Fallback to last tier
  return tiers[tiers.length - 1];
}

/**
 * Extract a stat value from stats object, with fallback
 */
function getStatValue(stats, mapping) {
  const value = stats[mapping.stat];
  if (value === undefined || value === null || isNaN(value)) {
    return mapping.default;
  }
  return value;
}

/**
 * Normalize a raw stat to 0-1 based on mapping config
 */
function normalizeStat(stats, statKey) {
  const mapping = STAT_MAPPINGS[statKey];
  if (!mapping) return 0.5;
  
  const rawValue = getStatValue(stats, mapping);
  const normalized = mapRange(rawValue, mapping.min, mapping.max);
  return clamp01(normalized);
}

/**
 * Main function: Map ticker stats to upgrade selections
 * 
 * @param {Object} stats - Ticker statistics
 * @param {number} stats.todayPnlPct - Today's P&L percentage
 * @param {number} stats.winRate - Win rate (0-1)
 * @param {number} stats.volatility - Price volatility
 * @param {number} stats.relativeVolume - Volume vs average
 * @param {number} stats.totalGainPct - Total gain percentage
 * @param {number} stats.maxDrawdownPct - Max drawdown percentage
 * 
 * @returns {Object} Upgrade selections for each slot
 */
export function mapStatsToUpgrades(stats = {}) {
  const upgrades = {};
  const normalizedStats = {};
  
  // First, normalize all stats
  for (const [statKey, mapping] of Object.entries(STAT_MAPPINGS)) {
    normalizedStats[statKey] = normalizeStat(stats, statKey);
  }
  
  // Then, pick tiers for each upgrade slot
  for (const [slot, statKey] of Object.entries(SLOT_STAT_MAP)) {
    const tiers = SPRITE_UPGRADES[slot];
    if (!tiers) continue;
    
    const normalizedValue = normalizedStats[statKey] ?? 0.5;
    const tier = pickTier(tiers, normalizedValue);
    
    upgrades[slot] = {
      ...tier,
      normalizedValue,
      slot
    };
  }
  
  return upgrades;
}

/**
 * Calculate an overall "power level" from upgrades (for display)
 * Returns a value from 0-100
 */
export function calculatePowerLevel(upgrades) {
  let total = 0;
  let count = 0;
  
  for (const [slot, tier] of Object.entries(upgrades)) {
    if (!tier) continue;
    
    // Weight different slots differently
    const weights = {
      engines: 1.5,
      wings: 1.2,
      weapons: 1.3,
      armor: 1.0,
      antenna: 0.8,
      shield: 1.4
    };
    
    const weight = weights[slot] || 1.0;
    total += (tier.normalizedValue || 0) * weight;
    count += weight;
  }
  
  return Math.round((total / count) * 100);
}

/**
 * Get a human-readable upgrade summary
 */
export function getUpgradeSummary(upgrades) {
  const parts = [];
  
  for (const [slot, tier] of Object.entries(upgrades)) {
    if (tier?.id) {
      parts.push(`${slot}: ${tier.label || tier.id}`);
    }
  }
  
  return parts.join(', ') || 'Stock Configuration';
}

/**
 * Generate a cache key for composed sprites
 */
export function generateUpgradeKey(ticker, upgrades) {
  const partIds = Object.entries(upgrades)
    .map(([slot, tier]) => `${slot}:${tier?.id || 'none'}`)
    .sort()
    .join('|');
  
  return `${ticker}|${partIds}`;
}

/**
 * Compare two upgrade sets to see if recomposition is needed
 */
export function upgradesChanged(oldUpgrades, newUpgrades) {
  if (!oldUpgrades || !newUpgrades) return true;
  
  for (const slot of Object.keys(SLOT_STAT_MAP)) {
    const oldId = oldUpgrades[slot]?.id;
    const newId = newUpgrades[slot]?.id;
    if (oldId !== newId) return true;
  }
  
  return false;
}

/**
 * Create a mock stats object for testing/preview
 */
export function createMockStats(seed = 0.5) {
  return {
    todayPnlPct: (seed - 0.5) * 10,           // -5% to +5%
    winRate: 0.3 + seed * 0.5,                 // 30% to 80%
    volatility: 0.01 + seed * 0.07,            // 1% to 8%
    relativeVolume: 0.5 + seed * 2.5,          // 0.5x to 3x
    totalGainPct: -20 + seed * 70,             // -20% to +50%
    maxDrawdownPct: 20 - seed * 20             // 20% to 0%
  };
}

/**
 * Debug function: log upgrade mapping details
 */
export function debugUpgradeMapping(ticker, stats) {
  console.group(`[UpgradeMapper] ${ticker}`);
  
  console.log('Raw Stats:', stats);
  
  const normalizedStats = {};
  for (const [statKey, mapping] of Object.entries(STAT_MAPPINGS)) {
    normalizedStats[statKey] = normalizeStat(stats, statKey);
  }
  console.log('Normalized Stats:', normalizedStats);
  
  const upgrades = mapStatsToUpgrades(stats);
  console.log('Upgrades:', upgrades);
  
  console.log('Power Level:', calculatePowerLevel(upgrades));
  console.log('Summary:', getUpgradeSummary(upgrades));
  
  console.groupEnd();
  
  return upgrades;
}

export default {
  mapStatsToUpgrades,
  calculatePowerLevel,
  getUpgradeSummary,
  generateUpgradeKey,
  upgradesChanged,
  createMockStats,
  debugUpgradeMapping
};
