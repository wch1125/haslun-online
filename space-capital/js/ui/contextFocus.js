/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CONTEXT FOCUS — Page-Behind Awareness Module
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * When ShipBrief opens, this module subtly highlights the selected ticker
 * wherever it appears in the background UI (watchlist, fleet cards, etc.)
 * and dims non-matching elements.
 * 
 * Dependencies:
 *   - ShipBrief events (shipbrief:open, shipbrief:close)
 *   - Optional: window.loadTicker for telemetry sync
 * 
 * CSS classes applied:
 *   - body.has-context-focus — when any ticker is focused
 *   - body[data-focus-ticker="XXX"] — focused ticker symbol
 *   - .context-focus — element matching focused ticker
 *   - .context-dim — element not matching focused ticker
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function () {
  'use strict';
  
  let focusedTicker = null;

  /**
   * Add focus/dim classes to matching elements
   */
  function addFocusClasses(ticker) {
    // Generic hook for CSS
    document.body.classList.add('has-context-focus');
    document.body.dataset.focusTicker = ticker;

    // Prefer data-ticker matches (fleet cards, thumbs, etc.)
    document.querySelectorAll('[data-ticker]').forEach(el => {
      el.classList.toggle('context-focus', el.dataset.ticker === ticker);
      el.classList.toggle('context-dim', el.dataset.ticker !== ticker);
    });

    // Watchlist items: check data-ticker first, fallback to text content
    document.querySelectorAll('.watchlist-item').forEach(el => {
      const dataTicker = el.dataset.ticker;
      const textTicker = el.querySelector('.watchlist-ticker')?.textContent?.trim();
      const t = dataTicker || textTicker;
      
      el.classList.toggle('context-focus', t === ticker);
      el.classList.toggle('context-dim', t && t !== ticker);
    });
    
    // Ship cards in holdings panel
    document.querySelectorAll('.ship-card').forEach(el => {
      // Ship cards might have ticker in data attribute or need to extract from content
      const cardTicker = el.dataset.ticker || 
        el.querySelector('.ship-ticker')?.textContent?.trim();
      
      if (cardTicker) {
        el.classList.toggle('context-focus', cardTicker === ticker);
        el.classList.toggle('context-dim', cardTicker !== ticker);
      }
    });
    
    // Fleet ship elements in derivatives/mission command
    document.querySelectorAll('.fleet-ship').forEach(el => {
      const shipTicker = el.dataset.ticker;
      if (shipTicker) {
        el.classList.toggle('context-focus', shipTicker === ticker);
        el.classList.toggle('context-dim', shipTicker !== ticker);
      }
    });
  }

  /**
   * Remove all focus/dim classes
   */
  function clearFocusClasses() {
    document.body.classList.remove('has-context-focus');
    delete document.body.dataset.focusTicker;

    document.querySelectorAll('.context-focus').forEach(el => {
      el.classList.remove('context-focus');
    });
    document.querySelectorAll('.context-dim').forEach(el => {
      el.classList.remove('context-dim');
    });
  }

  /**
   * Focus on a specific ticker context
   */
  function focusTickerContext(ticker, source) {
    focusedTicker = ticker;
    addFocusClasses(ticker);

    // Optional: sync telemetry data quietly if loadTicker exists
    // Only sync if the ship brief wasn't opened from telemetry itself
    if (typeof window.loadTicker === 'function' && 
        window.currentTicker !== ticker &&
        source !== 'telemetry') {
      window.loadTicker(ticker);
    }
  }

  /**
   * Clear ticker context focus
   */
  function clearTickerContext() {
    focusedTicker = null;
    clearFocusClasses();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT LISTENERS
  // ═══════════════════════════════════════════════════════════════════════════

  window.addEventListener('shipbrief:open', (e) => {
    const ticker = e?.detail?.ticker;
    const source = e?.detail?.source || '';
    if (!ticker) return;
    focusTickerContext(ticker, source);
  });

  window.addEventListener('shipbrief:close', () => {
    clearTickerContext();
  });
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API (optional, for programmatic use)
  // ═══════════════════════════════════════════════════════════════════════════
  
  window.ContextFocus = {
    focus: focusTickerContext,
    clear: clearTickerContext,
    getFocused: () => focusedTicker
  };

})();
