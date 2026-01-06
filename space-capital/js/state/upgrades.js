/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PARALLAX UPGRADE CATALOG (Step 8: Progression Architecture)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Data-only upgrade definitions. No DOM, no side-effects.
 * Effects are numbers used by gameplay and visuals.
 * 
 * Slots: thrusters, hull, sensors, weapons, core
 * 
 * Usage:
 *   ShipUpgrades.getUpgrade('thrusters_mk1')
 *   ShipUpgrades.getAllUpgrades()
 *   ShipUpgrades.getSlots()
 *   ShipUpgrades.getUpgradesForSlot('thrusters')
 *   ShipUpgrades.getUpgradesForLevel(3)
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';

  // Available equipment slots
  const SLOTS = ['thrusters', 'hull', 'sensors', 'weapons', 'core'];

  // Upgrade definitions
  // Effects: gameplay modifiers (numbers)
  // Visuals: rendering modifiers (glow, scale, ring color, etc.)
  const UPGRADE_CATALOG = {
    // ═══════════════════════════════════════════════════════════════════════
    // THRUSTERS — Speed, trails, jitter resistance
    // ═══════════════════════════════════════════════════════════════════════
    'thrusters_mk1': {
      id: 'thrusters_mk1',
      slot: 'thrusters',
      name: 'Thrusters MK-I',
      tier: 1,
      reqLevel: 1,
      description: 'Basic thruster upgrade. Improved acceleration.',
      effects: { thrust: +0.08, trail: +0.10, jitterResist: +0.03 },
      visuals: { glow: 1.05 }
    },
    'thrusters_mk2': {
      id: 'thrusters_mk2',
      slot: 'thrusters',
      name: 'Thrusters MK-II',
      tier: 2,
      reqLevel: 4,
      description: 'Enhanced thrusters with extended burn trails.',
      effects: { thrust: +0.16, trail: +0.18, jitterResist: +0.06 },
      visuals: { glow: 1.12 }
    },
    'thrusters_mk3': {
      id: 'thrusters_mk3',
      slot: 'thrusters',
      name: 'Thrusters MK-III',
      tier: 3,
      reqLevel: 8,
      description: 'Military-grade propulsion system.',
      effects: { thrust: +0.24, trail: +0.25, jitterResist: +0.10 },
      visuals: { glow: 1.20, trail: '#00d4ff' }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // HULL — Structural integrity, mass
    // ═══════════════════════════════════════════════════════════════════════
    'hull_plating_1': {
      id: 'hull_plating_1',
      slot: 'hull',
      name: 'Hull Plating',
      tier: 1,
      reqLevel: 2,
      description: 'Additional armor plating for basic protection.',
      effects: { hull: +0.10, mass: +0.04 },
      visuals: { scale: 1.02 }
    },
    'hull_plating_2': {
      id: 'hull_plating_2',
      slot: 'hull',
      name: 'Reinforced Hull',
      tier: 2,
      reqLevel: 5,
      description: 'Composite armor with improved shock absorption.',
      effects: { hull: +0.18, mass: +0.06 },
      visuals: { scale: 1.04 }
    },
    'hull_plating_3': {
      id: 'hull_plating_3',
      slot: 'hull',
      name: 'Battleship Armor',
      tier: 3,
      reqLevel: 10,
      description: 'Capital-class defensive plating.',
      effects: { hull: +0.28, mass: +0.08 },
      visuals: { scale: 1.06, ring: '#888888' }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // SENSORS — Detection, scanning, flow clarity
    // ═══════════════════════════════════════════════════════════════════════
    'sensors_array_1': {
      id: 'sensors_array_1',
      slot: 'sensors',
      name: 'Sensor Array',
      tier: 1,
      reqLevel: 2,
      description: 'Extended range sensor package.',
      effects: { sensors: +0.12, scan: +0.10 },
      visuals: { scanline: 1 }
    },
    'sensors_array_2': {
      id: 'sensors_array_2',
      slot: 'sensors',
      name: 'Deep Scanner',
      tier: 2,
      reqLevel: 6,
      description: 'High-resolution flow analysis sensors.',
      effects: { sensors: +0.20, scan: +0.18 },
      visuals: { scanline: 1, glow: 1.05 }
    },
    'sensors_array_3': {
      id: 'sensors_array_3',
      slot: 'sensors',
      name: 'Quantum Array',
      tier: 3,
      reqLevel: 12,
      description: 'Predictive signal processing system.',
      effects: { sensors: +0.30, scan: +0.25 },
      visuals: { scanline: 1, glow: 1.10, ring: '#00d4ff' }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // WEAPONS — Firepower, offensive capability
    // ═══════════════════════════════════════════════════════════════════════
    'weapons_pulse_1': {
      id: 'weapons_pulse_1',
      slot: 'weapons',
      name: 'Pulse Cannons',
      tier: 1,
      reqLevel: 3,
      description: 'Standard energy weapons.',
      effects: { firepower: +0.10 },
      visuals: { ring: '#ffaa33' }
    },
    'weapons_pulse_2': {
      id: 'weapons_pulse_2',
      slot: 'weapons',
      name: 'Heavy Cannons',
      tier: 2,
      reqLevel: 7,
      description: 'High-yield plasma emitters.',
      effects: { firepower: +0.18 },
      visuals: { ring: '#ff6633', glow: 1.08 }
    },
    'weapons_pulse_3': {
      id: 'weapons_pulse_3',
      slot: 'weapons',
      name: 'Ion Array',
      tier: 3,
      reqLevel: 11,
      description: 'Capital-ship grade weapon systems.',
      effects: { firepower: +0.28 },
      visuals: { ring: '#ff3366', glow: 1.15, aura: 1 }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // CORE — Warp capability, power generation
    // ═══════════════════════════════════════════════════════════════════════
    'core_warp_1': {
      id: 'core_warp_1',
      slot: 'core',
      name: 'Warp Core',
      tier: 1,
      reqLevel: 5,
      description: 'Basic FTL capability.',
      effects: { warp: +0.10, thrust: +0.05 },
      visuals: { aura: 1 }
    },
    'core_warp_2': {
      id: 'core_warp_2',
      slot: 'core',
      name: 'Hyperdrive',
      tier: 2,
      reqLevel: 9,
      description: 'Enhanced warp field generator.',
      effects: { warp: +0.18, thrust: +0.08 },
      visuals: { aura: 1, glow: 1.12 }
    },
    'core_warp_3': {
      id: 'core_warp_3',
      slot: 'core',
      name: 'Quantum Core',
      tier: 3,
      reqLevel: 15,
      description: 'Experimental quantum tunneling drive.',
      effects: { warp: +0.28, thrust: +0.12 },
      visuals: { aura: 1, glow: 1.20, ring: '#9933ff' }
    }
  };

  /**
   * Get an upgrade by ID
   * @param {string} id - Upgrade ID
   * @returns {Object|null}
   */
  function getUpgrade(id) {
    return UPGRADE_CATALOG[id] || null;
  }

  /**
   * Get all upgrades as an array
   * @returns {Array}
   */
  function getAllUpgrades() {
    return Object.values(UPGRADE_CATALOG);
  }

  /**
   * Get available slots
   * @returns {Array}
   */
  function getSlots() {
    return SLOTS.slice();
  }

  /**
   * Get all upgrades for a specific slot
   * @param {string} slot - Slot name
   * @returns {Array}
   */
  function getUpgradesForSlot(slot) {
    return getAllUpgrades().filter(u => u.slot === slot);
  }

  /**
   * Get all upgrades available at or below a level
   * @param {number} level - Player level
   * @returns {Array}
   */
  function getUpgradesForLevel(level) {
    return getAllUpgrades().filter(u => u.reqLevel <= level);
  }

  /**
   * Get the best upgrade for a slot at a given level
   * @param {string} slot - Slot name
   * @param {number} level - Player level
   * @returns {Object|null}
   */
  function getBestUpgradeForSlot(slot, level) {
    const available = getUpgradesForSlot(slot).filter(u => u.reqLevel <= level);
    if (available.length === 0) return null;
    // Sort by tier descending, return best
    available.sort((a, b) => b.tier - a.tier);
    return available[0];
  }

  // Export to window
  window.ShipUpgrades = {
    getUpgrade,
    getAllUpgrades,
    getSlots,
    getUpgradesForSlot,
    getUpgradesForLevel,
    getBestUpgradeForSlot,
    CATALOG: UPGRADE_CATALOG,
    SLOTS
  };

  console.log('[ShipUpgrades] Upgrade catalog loaded:', Object.keys(UPGRADE_CATALOG).length, 'upgrades');
})();
