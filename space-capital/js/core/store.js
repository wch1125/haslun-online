/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PARALLAX APP STATE STORE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Global application state with localStorage persistence.
 * Integrates with Event Bus for reactive updates.
 * 
 * State Schema:
 *   - activeTicker: string   — Currently selected ticker symbol
 *   - route: string          — Current view route (e.g., '#telemetry')
 *   - opsSub: string         — Operations sub-route ('holdings', etc.)
 *   - trainingSub: string    — Training sub-route ('arcade', etc.)
 *   - activeMissionId: string|null — Currently active mission
 * 
 * Usage:
 *   Store.get()                     → returns full state object
 *   Store.get('activeTicker')       → returns just that key
 *   Store.set({ activeTicker: 'ACHR' })  → merge + persist + emit
 *   const unsub = Store.subscribe(fn);   → fn(state) on every change
 *   Bus.on('store:change', handler)      → also fires on changes
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';

  // Avoid re-initialization if already loaded
  if (window.Store && typeof window.Store.get === 'function') {
    return;
  }

  const STORAGE_KEY = 'space_capital_state_v1';

  // Keys that persist to localStorage
  const PERSIST_KEYS = [
    'activeTicker',
    'route',
    'opsSub',
    'trainingSub',
    'activeMissionId'
  ];

  // Default state values
  const DEFAULTS = {
    activeTicker: 'RKLB',
    route: '#telemetry',
    opsSub: 'holdings',
    trainingSub: 'arcade',
    activeMissionId: null
  };

  // Internal state
  let state = { ...DEFAULTS };

  // Subscriber callbacks
  const subscribers = new Set();

  /**
   * Safely load persisted state from localStorage
   */
  function hydrate() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        // Only merge valid persisted keys
        PERSIST_KEYS.forEach(key => {
          if (saved.hasOwnProperty(key) && saved[key] !== undefined) {
            state[key] = saved[key];
          }
        });
        console.log('[Store] Hydrated from localStorage:', state);
      }
    } catch (err) {
      console.warn('[Store] Failed to hydrate from localStorage:', err);
    }
  }

  /**
   * Persist relevant state keys to localStorage
   */
  function persist() {
    try {
      const toSave = {};
      PERSIST_KEYS.forEach(key => {
        toSave[key] = state[key];
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (err) {
      console.warn('[Store] Failed to persist to localStorage:', err);
    }
  }

  /**
   * Notify all subscribers and emit bus event
   */
  function notify() {
    const snapshot = { ...state };
    
    // Call direct subscribers
    for (const fn of subscribers) {
      try {
        fn(snapshot);
      } catch (err) {
        console.error('[Store] Error in subscriber:', err);
      }
    }
    
    // Emit on Bus (supports both aliases)
    const bus = window.Bus || window.PARALLAX_BUS;
    if (bus && typeof bus.emit === 'function') {
      bus.emit('store:change', snapshot);
    }
  }

  const Store = {
    /**
     * Get current state or a specific key
     * @param {string} [key] - Optional key to retrieve
     * @returns {Object|*} Full state snapshot or specific value
     */
    get(key) {
      if (key !== undefined) {
        return state[key];
      }
      return { ...state };
    },

    /**
     * Update state with partial object (merge)
     * @param {Object} partial - Key/value pairs to merge into state
     */
    set(partial) {
      if (!partial || typeof partial !== 'object') return;
      
      let changed = false;
      Object.keys(partial).forEach(key => {
        if (state[key] !== partial[key]) {
          state[key] = partial[key];
          changed = true;
        }
      });

      if (changed) {
        persist();
        notify();
      }
    },

    /**
     * Subscribe to state changes
     * @param {Function} fn - Called with state snapshot on every change
     * @returns {Function} Unsubscribe function
     */
    subscribe(fn) {
      if (typeof fn !== 'function') {
        console.warn('[Store] subscribe() requires a function');
        return () => {};
      }
      subscribers.add(fn);
      // Return unsubscribe function
      return () => subscribers.delete(fn);
    },

    /**
     * Reset state to defaults (useful for testing/debugging)
     */
    reset() {
      state = { ...DEFAULTS };
      persist();
      notify();
      console.log('[Store] Reset to defaults');
    },

    /**
     * Get default values (for reference)
     */
    getDefaults() {
      return { ...DEFAULTS };
    }
  };

  // Hydrate on load
  hydrate();

  // Expose globally
  window.Store = Store;

  console.log('[PARALLAX] Store initialized');
})();
