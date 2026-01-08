/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SPACE CAPITAL - Sprite Upgrades Data Table (Browser Version)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Table-driven upgrade system. Ships visually evolve based on performance.
 * Stats → Normalized (0-1) → Tier Selection → Visual Modules
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function(global) {
  'use strict';

  /**
   * Upgrade tiers for each module type.
   * Each tier has: { min, max, id, ...extra props }
   */
  const SPRITE_UPGRADES = {
    // Wings: Based on momentum (recent price movement)
    wings: [
      { min: -Infinity, max: 0.25, id: 'wing_small',  scale: 0.8, label: 'Scout Wings' },
      { min: 0.25,      max: 0.50, id: 'wing_mid',    scale: 1.0, label: 'Standard Wings' },
      { min: 0.50,      max: 0.75, id: 'wing_large',  scale: 1.15, label: 'Combat Wings' },
      { min: 0.75,      max: Infinity, id: 'wing_elite', scale: 1.3, glow: true, label: 'Elite Wings' },
    ],

    // Engines: Based on overall strength/win rate
    engines: [
      { min: -Infinity, max: 0.33, id: 'thruster_1', intensity: 0.4, flames: 1, label: 'Basic Thruster' },
      { min: 0.33,      max: 0.66, id: 'thruster_2', intensity: 0.7, flames: 2, label: 'Ion Drive' },
      { min: 0.66,      max: Infinity, id: 'thruster_3', intensity: 1.0, flames: 3, glow: true, label: 'Plasma Core' },
    ],

    // Armor: Based on volatility/risk
    armor: [
      { min: -Infinity, max: 0.40, id: null, plates: 0, label: 'No Armor' },
      { min: 0.40,      max: 0.70, id: 'plate_1', plates: 2, label: 'Light Plating' },
      { min: 0.70,      max: Infinity, id: 'plate_2', plates: 4, label: 'Heavy Armor' },
    ],

    // Antenna: Based on volume/activity
    antenna: [
      { min: -Infinity, max: 0.50, id: null, size: 0, label: 'No Antenna' },
      { min: 0.50,      max: 0.80, id: 'antenna_1', size: 4, label: 'Comm Array' },
      { min: 0.80,      max: Infinity, id: 'antenna_2', size: 8, pulse: true, label: 'Command Array' },
    ],

    // Weapons: Based on gain magnitude
    weapons: [
      { min: -Infinity, max: 0.60, id: null, label: 'Unarmed' },
      { min: 0.60,      max: 0.85, id: 'weapon_1', label: 'Laser Banks' },
      { min: 0.85,      max: Infinity, id: 'weapon_2', label: 'Missile Pods' },
    ],

    // Shield: Based on consistency (low drawdown)
    shield: [
      { min: -Infinity, max: 0.70, id: null, radius: 0, label: 'No Shield' },
      { min: 0.70,      max: Infinity, id: 'shield_1', radius: 1.2, pulse: true, label: 'Energy Shield' },
    ],
  };

  /**
   * Stat mapping configuration.
   * Defines how raw stats map to normalized 0-1 values.
   */
  const STAT_MAPPINGS = {
    momentum: {
      stat: 'todayPnlPct',
      min: -5,
      max: 5,
      default: 0
    },
    strength: {
      stat: 'winRate',
      min: 0.3,
      max: 0.8,
      default: 0.5
    },
    risk: {
      stat: 'volatility',
      min: 0.01,
      max: 0.08,
      default: 0.03
    },
    activity: {
      stat: 'relativeVolume',
      min: 0.5,
      max: 3.0,
      default: 1.0
    },
    magnitude: {
      stat: 'totalGainPct',
      min: -20,
      max: 50,
      default: 0
    },
    consistency: {
      stat: 'maxDrawdownPct',
      min: 20,
      max: 0,
      default: 10
    }
  };

  /**
   * Which stat drives which upgrade slot
   */
  const SLOT_STAT_MAP = {
    wings:    'momentum',
    engines:  'strength',
    armor:    'risk',
    antenna:  'activity',
    weapons:  'magnitude',
    shield:   'consistency'
  };

  // ═══════════════════════════════════════════════════════════════════════
  // UPGRADE MAPPER FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════

  function clamp01(x) {
    return Math.max(0, Math.min(1, x));
  }

  function mapRange(value, min, max) {
    if (min === max) return 0.5;
    return (value - min) / (max - min);
  }

  function pickTier(tiers, value01) {
    for (const tier of tiers) {
      if (value01 >= tier.min && value01 < tier.max) {
        return tier;
      }
    }
    return tiers[tiers.length - 1];
  }

  function getStatValue(stats, mapping) {
    const value = stats[mapping.stat];
    if (value === undefined || value === null || isNaN(value)) {
      return mapping.default;
    }
    return value;
  }

  function normalizeStat(stats, statKey) {
    const mapping = STAT_MAPPINGS[statKey];
    if (!mapping) return 0.5;
    
    const rawValue = getStatValue(stats, mapping);
    const normalized = mapRange(rawValue, mapping.min, mapping.max);
    return clamp01(normalized);
  }

  /**
   * Map ticker stats to upgrade selections
   */
  function mapStatsToUpgrades(stats = {}) {
    const upgrades = {};
    const normalizedStats = {};
    
    for (const [statKey] of Object.entries(STAT_MAPPINGS)) {
      normalizedStats[statKey] = normalizeStat(stats, statKey);
    }
    
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
   * Calculate power level (0-100) from upgrades
   */
  function calculatePowerLevel(upgrades) {
    let total = 0;
    let count = 0;
    
    const weights = {
      engines: 1.5,
      wings: 1.2,
      weapons: 1.3,
      armor: 1.0,
      antenna: 0.8,
      shield: 1.4
    };
    
    for (const [slot, tier] of Object.entries(upgrades)) {
      if (!tier) continue;
      const weight = weights[slot] || 1.0;
      total += (tier.normalizedValue || 0) * weight;
      count += weight;
    }
    
    return Math.round((total / count) * 100);
  }

  /**
   * Get human-readable upgrade summary
   */
  function getUpgradeSummary(upgrades) {
    const parts = [];
    for (const [slot, tier] of Object.entries(upgrades)) {
      if (tier?.id) {
        parts.push(`${slot}: ${tier.label || tier.id}`);
      }
    }
    return parts.join(', ') || 'Stock Configuration';
  }

  // ═══════════════════════════════════════════════════════════════════════
  // EXPORTS
  // ═══════════════════════════════════════════════════════════════════════

  global.SpriteUpgrades = {
    SPRITE_UPGRADES,
    STAT_MAPPINGS,
    SLOT_STAT_MAP,
    mapStatsToUpgrades,
    calculatePowerLevel,
    getUpgradeSummary,
    normalizeStat,
  };

})(typeof window !== 'undefined' ? window : global);
