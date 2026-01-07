/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PARALLAX PROGRESSION STORE (Step 8: Progression Architecture)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Source of truth for ship leveling and upgrades.
 * Persists to localStorage, emits events via PARALLAX_BUS.
 * 
 * State structure (per ship):
 *   { xp, level, upgrades: { thrusters, hull, sensors, weapons, core }, cosmetics, history }
 * 
 * Usage:
 *   Progression.awardXP('RKLB', 100, 'Training Simulation', { gameId: 'space_run' })
 *   Progression.equipUpgrade('RKLB', 'thrusters_mk1')
 *   Progression.computeEffects('RKLB') // { level, xp, upgrades, effects, visuals }
 *   Progression.getShipSummary('RKLB') // Quick summary for UI
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'PARALLAX_PROGRESS_V1';
  const VERSION = 1;
  const MAX_LEVEL = 30;

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Default state structure
   */
  function defaultState() {
    return {
      version: VERSION,
      ships: {},
      lastUpdated: Date.now()
    };
  }

  /**
   * Load state from localStorage
   */
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return defaultState();
      
      // Migration/validation
      if (!parsed.version) parsed.version = VERSION;
      if (!parsed.ships) parsed.ships = {};
      
      return parsed;
    } catch (e) {
      console.warn('[Progression] Failed to load state:', e);
      return defaultState();
    }
  }

  /**
   * Save state to localStorage
   */
  function save(state) {
    try {
      state.lastUpdated = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('[Progression] Failed to save state:', e);
    }
    return state;
  }

  /**
   * Get or create ship data
   */
  function getShip(state, ticker) {
    const t = (ticker || '').toUpperCase();
    if (!t) return null;
    
    if (!state.ships[t]) {
      state.ships[t] = {
        xp: 0,
        level: 1,
        upgrades: {
          thrusters: null,
          hull: null,
          sensors: null,
          weapons: null,
          core: null
        },
        cosmetics: {
          badge: null
        },
        history: []
      };
      save(state);
    }
    return state.ships[t];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LEVELING SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * XP required to reach next level (cumulative thresholds)
   * Level 1: 0 XP
   * Level 2: 100 XP
   * Level 3: 250 XP (100 + 150)
   * Level 4: 450 XP (250 + 200)
   * etc. (each level requires ~1.45x more than previous)
   */
  function xpToLevel(xp) {
    let level = 1;
    let required = 100;
    let remaining = xp;
    
    while (remaining >= required && level < MAX_LEVEL) {
      remaining -= required;
      level++;
      required = Math.floor(required * 1.45);
    }
    
    return {
      level: level,
      into: remaining,        // XP into current level
      nextReq: required,      // XP required for next level
      totalXP: xp            // Total accumulated XP
    };
  }

  /**
   * Get total XP required to reach a specific level
   */
  function getTotalXPForLevel(targetLevel) {
    let total = 0;
    let required = 100;
    
    for (let lvl = 1; lvl < targetLevel && lvl < MAX_LEVEL; lvl++) {
      total += required;
      required = Math.floor(required * 1.45);
    }
    
    return total;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // XP & LEVELING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Award XP to a ship
   * @param {string} ticker - Ship ticker
   * @param {number} amount - XP amount
   * @param {string} reason - Source description
   * @param {Object} meta - Additional metadata
   * @returns {Object|null} Updated ship data
   */
  function awardXP(ticker, amount, reason, meta) {
    const state = load();
    const ship = getShip(state, ticker);
    if (!ship) return null;

    const a = Math.max(0, Math.floor(amount || 0));
    if (a === 0) return ship;

    const prevLevel = ship.level;
    ship.xp += a;

    const lvl = xpToLevel(ship.xp);
    ship.level = lvl.level;

    // Record history (keep last 50 entries)
    ship.history.push({
      ts: Date.now(),
      type: 'XP',
      amount: a,
      reason: reason || 'Unknown',
      meta: meta || null
    });
    if (ship.history.length > 50) {
      ship.history = ship.history.slice(-50);
    }

    save(state);

    // Emit events
    if (window.PARALLAX_BUS) {
      window.PARALLAX_BUS.emit('progress:xp', {
        ticker: ticker.toUpperCase(),
        amount: a,
        reason,
        meta,
        newTotal: ship.xp,
        level: ship.level
      });

      if (ship.level !== prevLevel) {
        window.PARALLAX_BUS.emit('progress:level', {
          ticker: ticker.toUpperCase(),
          from: prevLevel,
          to: ship.level
        });
        console.log(`[Progression] ${ticker} leveled up: ${prevLevel} → ${ship.level}`);
      }
    }

    return ship;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UPGRADES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Equip an upgrade to a ship
   * @param {string} ticker - Ship ticker
   * @param {string} upgradeId - Upgrade ID
   * @returns {Object} { ok: boolean, error?: string }
   */
  function equipUpgrade(ticker, upgradeId) {
    const up = window.ShipUpgrades?.getUpgrade(upgradeId);
    if (!up) {
      return { ok: false, error: 'Unknown upgrade' };
    }

    const state = load();
    const ship = getShip(state, ticker);
    if (!ship) {
      return { ok: false, error: 'Unknown ship' };
    }

    if (ship.level < up.reqLevel) {
      return { ok: false, error: `Requires level ${up.reqLevel}` };
    }

    ship.upgrades[up.slot] = up.id;

    // Record history
    ship.history.push({
      ts: Date.now(),
      type: 'EQUIP',
      slot: up.slot,
      id: up.id,
      name: up.name
    });
    if (ship.history.length > 50) {
      ship.history = ship.history.slice(-50);
    }

    save(state);

    // Emit event
    if (window.PARALLAX_BUS) {
      window.PARALLAX_BUS.emit('progress:equip', {
        ticker: ticker.toUpperCase(),
        slot: up.slot,
        id: up.id,
        name: up.name
      });
    }

    return { ok: true };
  }

  /**
   * Unequip an upgrade from a slot
   * @param {string} ticker - Ship ticker
   * @param {string} slot - Slot name
   * @returns {Object} { ok: boolean, error?: string }
   */
  function unequipUpgrade(ticker, slot) {
    const state = load();
    const ship = getShip(state, ticker);
    if (!ship) {
      return { ok: false, error: 'Unknown ship' };
    }

    if (!ship.upgrades[slot]) {
      return { ok: false, error: 'Slot already empty' };
    }

    const removedId = ship.upgrades[slot];
    ship.upgrades[slot] = null;
    save(state);

    return { ok: true, removedId };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPUTED EFFECTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Compute aggregated effects for gameplay and visuals
   * @param {string} ticker - Ship ticker
   * @returns {Object} { level, xp, upgrades, effects, visuals }
   */
  function computeEffects(ticker) {
    const state = load();
    const ship = getShip(state, ticker);
    if (!ship) {
      return { level: 1, xp: 0, upgrades: {}, effects: {}, visuals: {} };
    }

    // Base effects
    const effects = {
      thrust: 0,
      hull: 0,
      sensors: 0,
      firepower: 0,
      trail: 0,
      mass: 0,
      warp: 0,
      scan: 0,
      jitterResist: 0
    };

    // Base visuals
    const visuals = {
      glow: 1,
      scale: 1,
      ring: null,
      aura: 0,
      scanline: 0,
      trail: null
    };

    // Aggregate from equipped upgrades
    for (const slot of Object.keys(ship.upgrades)) {
      const upgradeId = ship.upgrades[slot];
      if (!upgradeId) continue;

      const up = window.ShipUpgrades?.getUpgrade(upgradeId);
      if (!up) continue;

      // Aggregate effects (additive)
      if (up.effects) {
        for (const k of Object.keys(up.effects)) {
          effects[k] = (effects[k] || 0) + up.effects[k];
        }
      }

      // Aggregate visuals (multiplicative for glow/scale, override for colors)
      if (up.visuals) {
        if (typeof up.visuals.glow === 'number') {
          visuals.glow *= up.visuals.glow;
        }
        if (typeof up.visuals.scale === 'number') {
          visuals.scale *= up.visuals.scale;
        }
        if (up.visuals.ring) {
          visuals.ring = up.visuals.ring;
        }
        if (up.visuals.trail) {
          visuals.trail = up.visuals.trail;
        }
        if (up.visuals.aura) {
          visuals.aura = Math.max(visuals.aura, up.visuals.aura);
        }
        if (up.visuals.scanline) {
          visuals.scanline = Math.max(visuals.scanline, up.visuals.scanline);
        }
      }
    }

    // Level-based bonuses (subtle)
    const levelBonus = 1 + (ship.level - 1) * 0.02; // 2% per level
    visuals.glow *= levelBonus;

    return {
      level: ship.level,
      xp: ship.xp,
      xpInfo: xpToLevel(ship.xp),
      upgrades: { ...ship.upgrades },
      effects,
      visuals
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UI HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get a quick summary for UI display
   * @param {string} ticker - Ship ticker
   * @returns {Object} { level, xp, nextXP, progress, equippedCount }
   */
  function getShipSummary(ticker) {
    const state = load();
    const ship = getShip(state, ticker);
    if (!ship) {
      return { level: 1, xp: 0, nextXP: 100, progress: 0, equippedCount: 0 };
    }

    const xpInfo = xpToLevel(ship.xp);
    const progress = xpInfo.nextReq > 0 ? xpInfo.into / xpInfo.nextReq : 1;
    
    const equippedCount = Object.values(ship.upgrades).filter(id => id !== null).length;

    return {
      level: ship.level,
      xp: ship.xp,
      xpIntoLevel: xpInfo.into,
      nextXP: xpInfo.nextReq,
      progress: progress,
      equippedCount: equippedCount
    };
  }

  /**
   * Get recent history for a ship
   * @param {string} ticker - Ship ticker
   * @param {number} count - Number of entries to return
   * @returns {Array}
   */
  function getRecentHistory(ticker, count = 10) {
    const state = load();
    const ship = getShip(state, ticker);
    if (!ship) return [];
    return ship.history.slice(-count).reverse();
  }

  /**
   * Get all ships with progression data
   * @returns {Array} [{ ticker, level, xp, equippedCount }]
   */
  function getAllShips() {
    const state = load();
    return Object.entries(state.ships).map(([ticker, ship]) => ({
      ticker,
      level: ship.level,
      xp: ship.xp,
      equippedCount: Object.values(ship.upgrades).filter(id => id !== null).length
    })).sort((a, b) => b.level - a.level || b.xp - a.xp);
  }

  /**
   * Reset progression for a ship (debug utility)
   * @param {string} ticker - Ship ticker
   */
  function resetShip(ticker) {
    const state = load();
    const t = ticker.toUpperCase();
    if (state.ships[t]) {
      delete state.ships[t];
      save(state);
      console.log(`[Progression] Reset ship: ${t}`);
    }
  }

  /**
   * Reset all progression (debug utility)
   */
  function resetAll() {
    localStorage.removeItem(STORAGE_KEY);
    console.log('[Progression] All progression data cleared');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════════════

  window.Progression = {
    // State
    load,
    save,
    
    // XP & Leveling
    awardXP,
    xpToLevel,
    getTotalXPForLevel,
    
    // Upgrades
    equipUpgrade,
    unequipUpgrade,
    computeEffects,
    
    // UI Helpers
    getShipSummary,
    getRecentHistory,
    getAllShips,
    
    // Debug
    resetShip,
    resetAll,
    
    // Constants
    MAX_LEVEL,
    STORAGE_KEY
  };

  console.log('[Progression] Progression store initialized');
})();
