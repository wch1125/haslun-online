// =========================================================================
// TICKER PROFILES — DISABLED (No Fake Data Policy)
// =========================================================================
// 
// This module previously contained handwritten "dossiers" with:
// - codenames (invented)
// - threat_levels (invented)
// - thesis statements (opinion)
// - catalysts (manually curated)
// - risks (opinion)
// - lore (completely fictional)
//
// Per project policy: NO FAKE STATS OR INVENTED DATA
// All UI data must be derived from actual market data.
//
// If you need this functionality in the future:
// 1. Fetch real fundamental data from an API
// 2. Fetch real news/catalysts from a news API
// 3. Derive risk metrics from volatility, drawdowns, etc.
//
// For now, this module exports an empty object to prevent errors
// in consuming code that checks for TICKER_PROFILES.
// =========================================================================

(function() {
  'use strict';
  
  // Empty profiles - all data now comes from market sources
  const TICKER_PROFILES = {};
  
  // Expose globally for backward compatibility
  // Consuming code should check for existence before use
  window.TICKER_PROFILES = TICKER_PROFILES;
  
  console.log('[TickerProfiles] Fake data disabled. All stats now market-derived.');
})();
