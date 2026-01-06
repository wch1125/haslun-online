/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TELEMETRY ENRICHMENT MODULE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Merges pre-computed market summaries and options data into ship telemetry.
 * 
 * Data sources:
 *   - data/market_summaries/{TICKER}.json  (computed offline from 45-min CSVs)
 *   - data/options_summaries/{TICKER}.json (computed from options_data.json)
 * 
 * This module does NOT:
 *   - Parse CSVs in browser
 *   - Fetch raw indicator data
 *   - Touch UI directly
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

window.TelemetryEnrichment = (function() {
  'use strict';

  // Cached summaries
  const marketSummaries = new Map();
  const optionsSummaries = new Map();
  
  // Loading state
  let isLoaded = false;
  let loadingPromise = null;

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Load all summary JSONs
   * Call once at startup
   */
  async function loadSummaries() {
    if (isLoaded) return true;
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
      const tickers = [
        'RKLB', 'LUNR', 'ASTS', 'ACHR', 'JOBY', 'GME', 'BKSY', 
        'RDW', 'PL', 'EVEX', 'GE', 'RTX', 'LHX', 'KTOS', 'XAR', 'COHR'
      ];

      // Load market summaries
      await Promise.all(tickers.map(async ticker => {
        try {
          const res = await fetch(`data/market_summaries/${ticker}.json`);
          if (res.ok) {
            const data = await res.json();
            marketSummaries.set(ticker, data);
          }
        } catch (e) {
          // Silent fail - not all tickers have summaries
        }
      }));

      // Load options summaries
      await Promise.all(tickers.map(async ticker => {
        try {
          const res = await fetch(`data/options_summaries/${ticker}.json`);
          if (res.ok) {
            const data = await res.json();
            optionsSummaries.set(ticker, data);
          }
        } catch (e) {
          // Silent fail
        }
      }));

      isLoaded = true;
      console.log(`[TelemetryEnrichment] Loaded ${marketSummaries.size} market summaries, ${optionsSummaries.size} options summaries`);
      return true;
    })();

    return loadingPromise;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENRICHMENT FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get market summary for a ticker
   */
  function getMarketSummary(ticker) {
    return marketSummaries.get(ticker) || null;
  }

  /**
   * Get options summary for a ticker
   */
  function getOptionsSummary(ticker) {
    return optionsSummaries.get(ticker) || null;
  }

  /**
   * Enrich base telemetry with legacy indicator insights
   * @param {Object} baseTelemetry - Current telemetry from ShipTelemetry
   * @param {string} ticker - The ticker symbol
   * @returns {Object} - Enriched telemetry
   */
  function enrichTelemetry(baseTelemetry, ticker) {
    const market = getMarketSummary(ticker);
    const options = getOptionsSummary(ticker);
    
    // Start with base telemetry
    const enriched = { ...baseTelemetry };

    // Add market-derived insights
    if (market) {
      enriched.legacy = enriched.legacy || {};
      
      // Core metrics from indicator analysis
      enriched.legacy.kernelRespect = market.kernelRespectPct;
      enriched.legacy.bandCompression = market.bandCompression;
      enriched.legacy.signalFollowThrough = market.signalFollowThrough;
      enriched.legacy.stopHuntFrequency = market.stopHuntFrequency;
      enriched.legacy.volumeReliability = market.volumeReliability;
      enriched.legacy.macdPersistence = market.macdPersistence;
      enriched.legacy.volatilityFactor = market.volatilityFactor;
      
      // Derived personality traits
      enriched.legacy.trendAdherence = market.trendAdherence;
      enriched.legacy.chopSensitivity = market.chopSensitivity;
      
      // Blend with existing telemetry
      // If chop sensitivity exists in both, average them
      if (baseTelemetry.chopSensitivity !== undefined && market.chopSensitivity !== undefined) {
        enriched.chopSensitivity = (baseTelemetry.chopSensitivity + market.chopSensitivity) / 2;
      }
    }

    // Add options-derived insights
    if (options) {
      enriched.options = {
        structure: options.structure,
        deltaExposure: options.deltaExposure,
        timeHorizonDays: options.timeHorizonDays,
        leverageFactor: options.leverageFactor,
        upcomingCatalysts: options.upcomingCatalysts,
        riskPosture: options.riskPosture,
        catalystPressure: options.catalystPressure
      };
      
      // Options influence on ship behavior
      // High leverage = more reactive
      if (options.leverageFactor > 1.5) {
        enriched.leverageModifier = Math.min(1.5, options.leverageFactor / 2);
      }
      
      // Catalyst pressure affects "tension"
      if (options.catalystPressure === 'high') {
        enriched.catalystTension = 0.7;
      } else {
        enriched.catalystTension = 0.3;
      }
    }

    return enriched;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BEHAVIOR MODIFIERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get animation intensity modifier based on enriched data
   * Used by ship-idle animations
   */
  function getAnimationIntensity(ticker) {
    const market = getMarketSummary(ticker);
    const options = getOptionsSummary(ticker);
    
    let intensity = 1.0;
    
    // Volatility increases animation
    if (market?.volatilityFactor) {
      intensity *= (0.7 + market.volatilityFactor * 0.6);
    }
    
    // Leverage increases tension/energy
    if (options?.leverageFactor > 1.5) {
      intensity *= 1.1;
    }
    
    // Catalysts add nervous energy
    if (options?.catalystPressure === 'high') {
      intensity *= 1.15;
    }
    
    return Math.min(2.0, intensity);
  }

  /**
   * Get combat stats modifier for Bey Arena
   * Higher trend adherence = more consistent damage
   * Higher chop = more critical hits but also misses
   */
  function getCombatModifiers(ticker) {
    const market = getMarketSummary(ticker);
    const options = getOptionsSummary(ticker);
    
    const modifiers = {
      damageConsistency: 1.0,
      criticalChance: 0.1,
      defenseBonus: 0,
      speedBonus: 0
    };
    
    if (market) {
      // Trend followers deal consistent damage
      modifiers.damageConsistency = 0.7 + market.trendAdherence * 0.6;
      
      // Choppy stocks have higher crit chance but less consistency
      modifiers.criticalChance = 0.05 + market.chopSensitivity * 0.2;
      
      // Band compression = tighter defense
      modifiers.defenseBonus = market.bandCompression * 0.3;
    }
    
    if (options) {
      // Leverage = glass cannon (more damage, less defense)
      if (options.leverageFactor > 2) {
        modifiers.damageConsistency *= 1.2;
        modifiers.defenseBonus -= 0.1;
      }
      
      // Delta exposure affects speed
      modifiers.speedBonus = (options.deltaExposure - 0.5) * 0.2;
    }
    
    return modifiers;
  }

  /**
   * Get fleet status text based on options positions
   */
  function getFleetStatusText(ticker) {
    const options = getOptionsSummary(ticker);
    
    if (!options) return null;
    
    const status = [];
    
    if (options.structure === 'Naked LEAP') {
      status.push('LEAP DEPLOYED');
    } else if (options.structure === 'Bull Spread') {
      status.push('SPREAD ACTIVE');
    }
    
    if (options.catalystPressure === 'high') {
      status.push('CATALYST ALERT');
    }
    
    if (options.timeHorizonDays < 90) {
      status.push('TIME DECAY CRITICAL');
    } else if (options.timeHorizonDays > 300) {
      status.push('LONG RANGE MISSION');
    }
    
    return status.length > 0 ? status.join(' | ') : null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DEBUG & INSPECTION
  // ═══════════════════════════════════════════════════════════════════════════

  function debugTicker(ticker) {
    console.group(`[TelemetryEnrichment] ${ticker}`);
    console.log('Market:', getMarketSummary(ticker));
    console.log('Options:', getOptionsSummary(ticker));
    console.log('Animation Intensity:', getAnimationIntensity(ticker));
    console.log('Combat Modifiers:', getCombatModifiers(ticker));
    console.log('Fleet Status:', getFleetStatusText(ticker));
    console.groupEnd();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    loadSummaries,
    getMarketSummary,
    getOptionsSummary,
    enrichTelemetry,
    getAnimationIntensity,
    getCombatModifiers,
    getFleetStatusText,
    debugTicker,
    
    // State inspection
    get isLoaded() { return isLoaded; },
    get marketCount() { return marketSummaries.size; },
    get optionsCount() { return optionsSummaries.size; }
  };

})();

// Auto-load on script inclusion
document.addEventListener('DOMContentLoaded', () => {
  window.TelemetryEnrichment.loadSummaries();
});

console.log('📊 TelemetryEnrichment module loaded');
