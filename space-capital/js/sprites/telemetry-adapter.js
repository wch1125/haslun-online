/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SPACE CAPITAL - Telemetry Adapter
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Single source of truth for converting market data → sprite engine format.
 * 
 * Inputs: ShipTelemetry, positions, stats from Store
 * Output: Normalized telemetry object for PixelShipEngine
 * 
 * Rule: NO fake data. If market data is missing, return defaults that
 *       produce a "neutral" visual state, not random/arbitrary values.
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function(global) {
  'use strict';

  /**
   * Default telemetry when no market data available
   * Results in a "neutral" ship appearance
   */
  const DEFAULT_TELEMETRY = {
    regime: 'RANGE',
    signalState: 'neutral',
    thrust: 0.5,
    damage: 0,
    momentum: 0,
    jitter: 0.2,
    glow: 0.4,
  };

  /**
   * Clamp a value between min and max
   */
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Normalize a value from a range to 0-1
   */
  function normalize(value, min, max) {
    if (max === min) return 0.5;
    return clamp((value - min) / (max - min), 0, 1);
  }

  /**
   * Convert ShipTelemetry data to engine format
   * 
   * @param {string} ticker - Stock ticker
   * @param {object} options - Optional overrides
   * @returns {object} - Telemetry for PixelShipEngine
   */
  function fromShipTelemetry(ticker, options = {}) {
    // Get telemetry from global ShipTelemetry module
    if (!global.ShipTelemetry) {
      console.warn('[TelemetryAdapter] ShipTelemetry not loaded, using defaults');
      return { ...DEFAULT_TELEMETRY, ...options };
    }

    const t = global.ShipTelemetry.getEffectiveTelemetry 
      ? global.ShipTelemetry.getEffectiveTelemetry(ticker)
      : global.ShipTelemetry.getTelemetry(ticker);

    if (!t) {
      return { ...DEFAULT_TELEMETRY, ...options };
    }

    // Map telemetry traits to engine format
    return {
      // Regime: TREND, RANGE, or CHAOTIC
      regime: t.regimeBias === 'trend' ? 'TREND' : 
              t.regimeBias === 'chaotic' ? 'CHAOTIC' : 'RANGE',
      
      // Signal state: bull if positive momentum, bear if negative
      signalState: (t.thrustPotential || 0) > 0.55 ? 'bull' :
                   (t.thrustPotential || 0) < 0.45 ? 'bear' : 'neutral',
      
      // Thrust: based on trend strength / thrust potential (0-1)
      thrust: clamp(t.thrustPotential || 0.5, 0, 1),
      
      // Damage: inverse of stability, high chop = more damage (0-1)
      damage: clamp(1 - (t.maneuverStability || 0.7), 0, 0.8),
      
      // Momentum: trend strength normalized (can be negative)
      momentum: t.thrustPotential > 0.5 ? (t.thrustPotential - 0.5) * 2 :
                t.thrustPotential < 0.5 ? (t.thrustPotential - 0.5) * 2 : 0,
      
      // Jitter: chop sensitivity (0-1)
      jitter: clamp(t.chopSensitivity || 0.3, 0, 1),
      
      // Glow: signal clarity (0-1)
      glow: clamp(t.signalClarity || 0.5, 0, 1),
      
      // Allow explicit overrides
      ...options
    };
  }

  /**
   * Convert raw market stats to engine format
   * Used when you have stats but not full ShipTelemetry
   * 
   * @param {object} stats - Market statistics
   * @returns {object} - Telemetry for PixelShipEngine
   */
  function fromMarketStats(stats = {}) {
    if (!stats || Object.keys(stats).length === 0) {
      return { ...DEFAULT_TELEMETRY };
    }

    // Normalize stats to 0-1 ranges
    const todayPnl = stats.todayPnlPct || stats.return_1d || 0;
    const weekPnl = stats.weekPnlPct || stats.return_1w || 0;
    const volatility = stats.volatility || 0.03;
    const winRate = stats.winRate || 0.5;
    const drawdown = Math.abs(stats.maxDrawdownPct || stats.drawdown || 10);

    return {
      regime: Math.abs(weekPnl) > 5 ? 'TREND' : 
              volatility > 0.05 ? 'CHAOTIC' : 'RANGE',
      
      signalState: todayPnl > 1 ? 'bull' : todayPnl < -1 ? 'bear' : 'neutral',
      
      thrust: normalize(winRate, 0.3, 0.8),
      
      damage: normalize(drawdown, 0, 30),
      
      momentum: clamp(todayPnl / 5, -1, 1),
      
      jitter: normalize(volatility, 0.01, 0.08),
      
      glow: normalize(1 - volatility / 0.1, 0, 1),
    };
  }

  /**
   * Convert position data to engine format
   * Used for position-specific rendering (P&L affects appearance)
   * 
   * @param {object} position - Position data
   * @returns {object} - Telemetry for PixelShipEngine
   */
  function fromPosition(position = {}) {
    if (!position) {
      return { ...DEFAULT_TELEMETRY };
    }

    const pnlPct = position.unrealizedPnlPct || position.pnlPct || 0;
    const dayChange = position.dayChangePct || 0;
    const costBasis = position.costBasis || 0;
    const marketValue = position.marketValue || costBasis;

    // Calculate position health
    const gainLoss = costBasis > 0 ? (marketValue - costBasis) / costBasis : 0;
    
    return {
      regime: Math.abs(dayChange) > 3 ? 'TREND' : 'RANGE',
      
      signalState: pnlPct > 5 ? 'bull' : pnlPct < -5 ? 'bear' : 'neutral',
      
      thrust: normalize(pnlPct, -20, 50),
      
      damage: pnlPct < 0 ? normalize(Math.abs(pnlPct), 0, 30) : 0,
      
      momentum: clamp(dayChange / 5, -1, 1),
      
      jitter: Math.abs(dayChange) > 2 ? 0.6 : 0.2,
      
      glow: gainLoss > 0 ? clamp(0.5 + gainLoss, 0.5, 1) : 0.3,
    };
  }

  /**
   * Merge multiple telemetry sources with priority
   * Later sources override earlier ones
   * 
   * @param {...object} sources - Telemetry objects to merge
   * @returns {object} - Merged telemetry
   */
  function merge(...sources) {
    return Object.assign({}, DEFAULT_TELEMETRY, ...sources.filter(Boolean));
  }

  /**
   * Get telemetry for a ticker using all available data sources
   * This is the main entry point for UI code
   * 
   * @param {string} ticker - Stock ticker
   * @param {object} options - Additional options
   * @param {object} options.position - Position data to incorporate
   * @param {object} options.stats - Stats to incorporate
   * @param {object} options.overrides - Explicit overrides
   * @returns {object} - Complete telemetry for engine
   */
  function getTelemetry(ticker, options = {}) {
    // Start with ShipTelemetry (market-derived)
    let telemetry = fromShipTelemetry(ticker);

    // Layer in stats if provided
    if (options.stats) {
      telemetry = merge(telemetry, fromMarketStats(options.stats));
    }

    // Layer in position data if provided
    if (options.position) {
      telemetry = merge(telemetry, fromPosition(options.position));
    }

    // Apply explicit overrides last
    if (options.overrides) {
      telemetry = merge(telemetry, options.overrides);
    }

    return telemetry;
  }

  /**
   * Get telemetry for multiple tickers at once
   * 
   * @param {string[]} tickers - Array of ticker symbols
   * @param {object} options - Options with statsMap, positionsMap
   * @returns {object} - Map of ticker → telemetry
   */
  function getFleetTelemetry(tickers, options = {}) {
    const result = {};
    const { statsMap = {}, positionsMap = {} } = options;

    for (const ticker of tickers) {
      result[ticker] = getTelemetry(ticker, {
        stats: statsMap[ticker],
        position: positionsMap[ticker],
        overrides: options.overrides
      });
    }

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  global.TelemetryAdapter = {
    // Main entry points
    getTelemetry,
    getFleetTelemetry,

    // Conversion functions
    fromShipTelemetry,
    fromMarketStats,
    fromPosition,

    // Utilities
    merge,
    normalize,
    clamp,

    // Defaults (for reference)
    DEFAULT_TELEMETRY,
  };

  console.log('[TelemetryAdapter] Initialized');

})(typeof window !== 'undefined' ? window : global);
