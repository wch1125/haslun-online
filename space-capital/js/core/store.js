/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SPACE CAPITAL - AUTHORITATIVE STATE STORE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * THE SINGLE SOURCE OF TRUTH for application state.
 * All pages MUST read from and write to this store.
 * NO local shadow state. NO query-string hacks.
 * 
 * State Schema:
 *   - activeTicker: string      — Currently selected ticker symbol
 *   - activeShip: object|null   — Full ship data for active ticker
 *   - activeMission: object|null — Currently active mission
 *   - activeTelemetryMode: string — Current telemetry view mode
 *   - route: string             — Current view route
 * 
 * Usage:
 *   Store.get()                      → returns full state object
 *   Store.get('activeTicker')        → returns just that key
 *   Store.set({ activeTicker: 'ACHR' })   → merge + persist + emit
 *   Store.setTicker('ACHR')          → convenience method
 *   Store.setMission(mission)        → set active mission
 *   const unsub = Store.subscribe(fn);    → fn(state) on every change
 *   Store.subscribeKey('activeTicker', fn) → fn(value) when key changes
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';

  // Avoid re-initialization if already loaded
  if (window.Store && typeof window.Store.get === 'function') {
    return;
  }

  const STORAGE_KEY = 'space_capital_state_v2';

  // Keys that persist to localStorage
  const PERSIST_KEYS = [
    'activeTicker',
    'route',
    'activeTelemetryMode'
  ];

  // Default state values
  const DEFAULTS = {
    activeTicker: 'RKLB',
    activeShip: null,
    activeMission: null,
    activeTelemetryMode: 'standard',
    route: '#fleet'
  };

  // Internal state
  let state = { ...DEFAULTS };

  // Subscriber callbacks
  const subscribers = new Set();
  const keySubscribers = new Map(); // key -> Set of callbacks

  /**
   * Safely load persisted state from localStorage
   */
  function hydrate() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        PERSIST_KEYS.forEach(key => {
          if (saved.hasOwnProperty(key) && saved[key] !== undefined) {
            state[key] = saved[key];
          }
        });
        console.log('[Store] Hydrated:', state.activeTicker);
      }
    } catch (err) {
      console.warn('[Store] Hydration failed:', err);
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
      console.warn('[Store] Persist failed:', err);
    }
  }

  /**
   * Notify all subscribers and emit bus event
   */
  function notify(changedKeys = []) {
    const snapshot = { ...state };
    
    // Call direct subscribers
    for (const fn of subscribers) {
      try {
        fn(snapshot);
      } catch (err) {
        console.error('[Store] Subscriber error:', err);
      }
    }
    
    // Call key-specific subscribers
    for (const key of changedKeys) {
      const keySubs = keySubscribers.get(key);
      if (keySubs) {
        for (const fn of keySubs) {
          try {
            fn(state[key], key);
          } catch (err) {
            console.error('[Store] Key subscriber error:', err);
          }
        }
      }
    }
    
    // Emit on Bus
    const bus = window.Bus || window.PARALLAX_BUS;
    if (bus && typeof bus.emit === 'function') {
      bus.emit('store:change', snapshot);
      changedKeys.forEach(key => bus.emit(`store:${key}`, state[key]));
    }
  }

  const Store = {
    /**
     * Get current state or a specific key
     */
    get(key) {
      if (key !== undefined) {
        return state[key];
      }
      return { ...state };
    },

    /**
     * Update state with partial object (merge)
     */
    set(partial) {
      if (!partial || typeof partial !== 'object') return;
      
      const changedKeys = [];
      Object.keys(partial).forEach(key => {
        if (state[key] !== partial[key]) {
          state[key] = partial[key];
          changedKeys.push(key);
        }
      });

      if (changedKeys.length > 0) {
        persist();
        notify(changedKeys);
      }
    },

    /**
     * Convenience: Set active ticker (also clears mission)
     */
    setTicker(ticker) {
      if (!ticker || ticker === state.activeTicker) return;
      
      this.set({
        activeTicker: ticker,
        activeShip: null,  // Will be populated by ship data
        activeMission: null // Clear mission when switching ships
      });
      
      console.log('[Store] Ticker set:', ticker);
    },

    /**
     * Convenience: Set active mission
     */
    setMission(mission) {
      this.set({ activeMission: mission });
      console.log('[Store] Mission set:', mission?.id || 'none');
    },

    /**
     * Convenience: Set active ship data
     */
    setShip(shipData) {
      this.set({ activeShip: shipData });
    },

    /**
     * Subscribe to all state changes
     */
    subscribe(fn) {
      if (typeof fn !== 'function') return () => {};
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },

    /**
     * Subscribe to specific key changes
     */
    subscribeKey(key, fn) {
      if (typeof fn !== 'function') return () => {};
      
      if (!keySubscribers.has(key)) {
        keySubscribers.set(key, new Set());
      }
      keySubscribers.get(key).add(fn);
      
      return () => {
        const subs = keySubscribers.get(key);
        if (subs) subs.delete(fn);
      };
    },

    /**
     * Reset state to defaults
     */
    reset() {
      state = { ...DEFAULTS };
      persist();
      notify(Object.keys(DEFAULTS));
      console.log('[Store] Reset to defaults');
    },

    /**
     * Get default values
     */
    getDefaults() {
      return { ...DEFAULTS };
    }
  };

  // Hydrate on load
  hydrate();

  // Expose globally
  window.Store = Store;

  console.log('[Store] Initialized, active ticker:', state.activeTicker);
})();
