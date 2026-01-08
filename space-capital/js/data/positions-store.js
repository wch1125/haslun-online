/**
 * ═══════════════════════════════════════════════════════════════════════════
 * POSITIONS STORE - Fleet-wide Position Integration
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Global accessor for position data that feeds into:
 * - Fleet page (ownership visibility, power HUD)
 * - Hangar page (ship dossiers, visual scars)
 * - Telemetry pages (weighted presence, entry markers)
 * 
 * Architecture: Reads from PositionManager, provides derived metrics
 * ═══════════════════════════════════════════════════════════════════════════
 */

window.PositionsStore = (function() {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────
  // CACHE - Computed values refreshed on position changes
  // ─────────────────────────────────────────────────────────────────────────
  
  let _cache = {
    byTicker: {},
    fleet: {
      totalExposure: 0,
      stockExposure: 0,
      optionsExposure: 0,
      optionsRatio: 0,
      totalPnL: 0,
      positionCount: 0,
      concentration: [],
      hasPositions: false
    },
    lastUpdated: null
  };

  // ─────────────────────────────────────────────────────────────────────────
  // CORE GETTERS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get position data for a specific ticker
   * Returns null if no position exists
   */
  function get(ticker) {
    refreshIfNeeded();
    return _cache.byTicker[ticker.toUpperCase()] || null;
  }

  /**
   * Check if a position exists for ticker
   */
  function hasPosition(ticker) {
    const pos = get(ticker);
    return pos && pos.totalValue > 0;
  }

  /**
   * Get all positions as object keyed by ticker
   */
  function getAll() {
    refreshIfNeeded();
    return { ..._cache.byTicker };
  }

  /**
   * Get fleet-wide aggregated stats
   */
  function getFleetStats() {
    refreshIfNeeded();
    return { ..._cache.fleet };
  }

  /**
   * Get concentration breakdown (top N tickers by exposure)
   */
  function getConcentration(topN = 3) {
    refreshIfNeeded();
    return _cache.fleet.concentration.slice(0, topN);
  }

  /**
   * Get visual weight for a ticker (0-1 scale)
   * Higher weight = stronger UI presence
   */
  function getVisualWeight(ticker) {
    const pos = get(ticker);
    if (!pos || pos.totalValue <= 0) return 0.3; // Ghost mode
    
    const fleet = getFleetStats();
    if (fleet.totalExposure <= 0) return 0.5;
    
    // Weight based on position size relative to portfolio
    const weight = pos.totalValue / fleet.totalExposure;
    
    // Scale to 0.5-1.0 range (minimum 0.5 for owned ships)
    return Math.min(1, 0.5 + weight * 2);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DERIVED METRICS FOR UI
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get position chip data for fleet card display
   */
  function getPositionChip(ticker) {
    const pos = get(ticker);
    if (!pos) return null;
    
    return {
      ticker,
      hasPosition: pos.totalValue > 0,
      totalValue: pos.totalValue,
      stockValue: pos.stockValue,
      optionsValue: pos.optionsValue,
      optionCount: pos.optionCount,
      pnlPercent: pos.pnlPercent,
      pnlValue: pos.pnlValue,
      exposure: pos.exposure, // 'S', 'M', 'L' based on size
      hasOptions: pos.optionCount > 0
    };
  }

  /**
   * Get risk metrics for a ticker
   */
  function getRiskMetrics(ticker) {
    const pos = get(ticker);
    const fleet = getFleetStats();
    
    if (!pos || !fleet.hasPositions) {
      return {
        concentration: 0,
        optionRatio: 0,
        riskLevel: 'none'
      };
    }
    
    const concentration = fleet.totalExposure > 0 
      ? pos.totalValue / fleet.totalExposure 
      : 0;
    const optionRatio = pos.totalValue > 0 
      ? pos.optionsValue / pos.totalValue 
      : 0;
    
    // Risk level based on concentration + options
    let riskLevel = 'low';
    if (concentration > 0.3 || optionRatio > 0.5) riskLevel = 'medium';
    if (concentration > 0.5 || optionRatio > 0.7) riskLevel = 'high';
    
    return {
      concentration,
      optionRatio,
      riskLevel
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REFRESH FROM POSITION MANAGER
  // ─────────────────────────────────────────────────────────────────────────

  function refresh() {
    if (!window.PositionManager) {
      console.warn('[PositionsStore] PositionManager not available');
      return;
    }

    const positions = PositionManager.getAll();
    const byTicker = {};
    
    let totalExposure = 0;
    let stockExposure = 0;
    let optionsExposure = 0;
    let totalPnL = 0;
    let positionCount = 0;
    
    const exposures = [];

    for (const [ticker, pos] of Object.entries(positions)) {
      const stockVal = Math.abs(pos.openStockValue || 0);
      const optionsVal = Math.abs(pos.openOptionsValue || 0);
      const totalVal = stockVal + optionsVal;
      const pnlVal = pos.totalPL || 0;
      
      // Calculate P&L percent
      let pnlPct = 0;
      if (totalVal > 0) {
        pnlPct = (pnlVal / totalVal) * 100;
      } else if (pos.totalPL !== 0) {
        // Position closed, use realized P&L
        pnlPct = pos.totalPL / 100; // Rough approximation
      }
      
      // Exposure size category
      let exposure = 'S';
      if (totalVal > 10000) exposure = 'L';
      else if (totalVal > 2000) exposure = 'M';
      
      byTicker[ticker.toUpperCase()] = {
        ticker: ticker.toUpperCase(),
        stockValue: stockVal,
        optionsValue: optionsVal,
        totalValue: totalVal,
        optionCount: pos.openOptionsQty || 0,
        stockQty: pos.openStockQty || 0,
        pnlValue: pnlVal,
        pnlPercent: pnlPct,
        exposure,
        hasOpenPosition: pos.hasOpenPosition || false,
        source: pos.source || 'unknown',
        lastUpdated: pos.lastUpdated
      };
      
      if (totalVal > 0) {
        totalExposure += totalVal;
        stockExposure += stockVal;
        optionsExposure += optionsVal;
        positionCount++;
        exposures.push({ ticker, value: totalVal });
      }
      
      totalPnL += pnlVal;
    }

    // Sort for concentration
    exposures.sort((a, b) => b.value - a.value);
    const concentration = exposures.map(e => ({
      ticker: e.ticker,
      value: e.value,
      percent: totalExposure > 0 ? (e.value / totalExposure * 100) : 0
    }));

    _cache = {
      byTicker,
      fleet: {
        totalExposure,
        stockExposure,
        optionsExposure,
        optionsRatio: totalExposure > 0 ? optionsExposure / totalExposure : 0,
        totalPnL,
        positionCount,
        concentration,
        hasPositions: positionCount > 0
      },
      lastUpdated: Date.now()
    };

    console.log('[PositionsStore] Refreshed:', positionCount, 'positions, $' + totalExposure.toFixed(0), 'exposure');
    
    // Notify listeners
    _listeners.forEach(fn => {
      try { fn(_cache); } catch (e) { console.error(e); }
    });
  }

  function refreshIfNeeded() {
    // Refresh if never done or older than 5 seconds
    if (!_cache.lastUpdated || Date.now() - _cache.lastUpdated > 5000) {
      refresh();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LISTENERS
  // ─────────────────────────────────────────────────────────────────────────

  const _listeners = [];

  function onChange(callback) {
    _listeners.push(callback);
    return () => {
      const idx = _listeners.indexOf(callback);
      if (idx >= 0) _listeners.splice(idx, 1);
    };
  }

  // Auto-refresh when PositionManager changes
  if (window.PositionManager) {
    PositionManager.onChange(() => refresh());
  }

  // Initial refresh
  setTimeout(refresh, 100);

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────

  return {
    // Core getters
    get,
    hasPosition,
    getAll,
    getFleetStats,
    getConcentration,
    getVisualWeight,
    
    // UI helpers
    getPositionChip,
    getRiskMetrics,
    
    // Control
    refresh,
    onChange
  };

})();
