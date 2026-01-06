/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PARALLAX EVENT BUS (Progression Architecture)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Global event bus for communication between components.
 * Works across pages (index.html, derivatives.html).
 * 
 * Events:
 *   - training:result     { ticker, gameId, score, outcome }
 *   - mission:complete    { ticker, missionType, difficulty, duration }
 *   - mission:damaged     { ticker, missionType }
 *   - progress:xp         { ticker, amount, reason, meta }
 *   - progress:level      { ticker, from, to }
 *   - progress:equip      { ticker, slot, id }
 * 
 * Usage:
 *   PARALLAX_BUS.on('training:result', (e) => console.log(e.ticker, e.score))
 *   PARALLAX_BUS.emit('training:result', { ticker: 'RKLB', score: 500, ... })
 *   const unsub = PARALLAX_BUS.on('event', handler); unsub(); // cleanup
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';

  // Avoid re-initialization if already loaded (cross-page safety)
  if (window.PARALLAX_BUS && typeof window.PARALLAX_BUS.emit === 'function') {
    return;
  }

  // Listener storage: Map<eventName, Set<handlerFn>>
  const listeners = new Map();

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} fn - Handler function
   * @returns {Function} Unsubscribe function
   */
  function on(event, fn) {
    if (typeof fn !== 'function') {
      console.warn('[PARALLAX_BUS] on() requires a function handler');
      return () => {};
    }
    
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event).add(fn);
    
    // Return unsubscribe function
    return () => off(event, fn);
  }

  /**
   * Unsubscribe from an event
   * @param {string} event - Event name
   * @param {Function} fn - Handler function to remove
   */
  function off(event, fn) {
    const set = listeners.get(event);
    if (!set) return;
    set.delete(fn);
    if (set.size === 0) {
      listeners.delete(event);
    }
  }

  /**
   * Emit an event to all subscribers
   * @param {string} event - Event name
   * @param {*} payload - Data to pass to handlers
   */
  function emit(event, payload) {
    const set = listeners.get(event);
    if (!set) return;
    
    for (const fn of set) {
      try {
        fn(payload);
      } catch (e) {
        console.warn('[PARALLAX_BUS] Error in handler for', event, e);
      }
    }
  }

  /**
   * Subscribe to an event (fires only once)
   * @param {string} event - Event name
   * @param {Function} fn - Handler function
   * @returns {Function} Unsubscribe function
   */
  function once(event, fn) {
    const wrapper = (payload) => {
      off(event, wrapper);
      fn(payload);
    };
    return on(event, wrapper);
  }

  /**
   * Get count of listeners for an event (debug utility)
   * @param {string} event - Event name
   * @returns {number}
   */
  function listenerCount(event) {
    const set = listeners.get(event);
    return set ? set.size : 0;
  }

  // Export to window
  const BusAPI = {
    on,
    off,
    emit,
    once,
    listenerCount
  };

  window.PARALLAX_BUS = BusAPI;
  window.Bus = BusAPI;  // Shorter alias for convenience

  console.log('[PARALLAX] Event bus initialized');
})();
