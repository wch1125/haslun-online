/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TRADE CONFIRMS LOADER
 * Single ingestion pipeline for all trade data
 * 
 * Rules:
 * - Guest = read-only pilot with canonical CSV
 * - Uploaded CSVs override, never merge
 * - Same parsing path for both
 * 
 * Architecture principles (per ChatGPT review 2026-01-08):
 * - Store NORMALIZED SCALARS, derive language at render time
 * - Dossiers are CACHED, not recomputed per render
 * - Instability is DERIVED from variance/options/clustering
 * ═══════════════════════════════════════════════════════════════════════════
 */

const TradeLoader = (function() {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────
  // DOSSIER CACHE - Never rebuild per render
  // ─────────────────────────────────────────────────────────────────────────
  
  const dossierCache = new Map();
  const expiryCache = new Map();
  let lastTradeHash = null;

  function computeTradeHash(trades) {
    if (!trades || trades.length === 0) return 'empty';
    return `${trades.length}-${trades[0]?.dateTime || ''}-${trades[trades.length - 1]?.dateTime || ''}`;
  }

  function invalidateCache() {
    dossierCache.clear();
    expiryCache.clear();
    lastTradeHash = null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN ENTRY POINT
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Load trade confirms based on user profile
   * @param {Object} userProfile - { type: 'guest'|'pilot', uploadedCSV?: string }
   * @returns {Promise<Array>} Parsed trade records
   */
  async function loadTradeConfirms(userProfile) {
    // Invalidate cache on new load
    invalidateCache();
    
    if (userProfile.type === 'guest') {
      console.log('[TradeLoader] Loading Guest pilot canonical data...');
      return loadCSV('../data/guest/trade-confirms.csv');
    }

    if (userProfile.uploadedCSV) {
      console.log('[TradeLoader] Loading uploaded CSV...');
      return loadCSV(userProfile.uploadedCSV);
    }

    console.log('[TradeLoader] No trade data available');
    return [];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CSV LOADING & PARSING
  // ─────────────────────────────────────────────────────────────────────────

  async function loadCSV(path) {
    try {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`Failed to load CSV: ${response.status}`);
      }
      const text = await response.text();
      return parseGuestTradeCSV(text);
    } catch (error) {
      console.error('[TradeLoader] Error loading CSV:', error);
      return { trades: [], summary: {}, byTicker: {}, options: [] };
    }
  }

  /**
   * Parse the canonical Guest trade CSV format
   * Header: Trades,Data,Order,Asset Category,Currency,Symbol,Date,Quantity,Price,Amount,RealizedPNL,Code
   */
  function parseGuestTradeCSV(text) {
    const lines = text.trim().split('\n');
    const trades = [];
    const options = [];
    
    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].replace(/^\uFEFF/, '').trim();
      if (!line) continue;

      const values = parseCSVLine(line);
      if (values.length < 11) continue;
      
      // Parse: Trades,Data,Order,Asset Category,Currency,Symbol,Date,Quantity,Price,Amount,RealizedPNL,Code
      const [, , , category, currency, rawSymbol, dateTime, quantity, price, amount, realizedPNL, code] = values;
      
      const isOption = category.includes('Option');
      const ticker = extractTicker(rawSymbol);
      const parsedQty = parseNumber(quantity);
      const parsedPrice = parseNumber(price);
      const parsedAmount = parseNumber(amount);
      const parsedPNL = parseNumber(realizedPNL);
      
      const trade = {
        category,
        currency,
        ticker,
        rawSymbol,
        dateTime,
        date: dateTime.split(',')[0].trim(),
        quantity: parsedQty,
        price: parsedPrice,
        amount: parsedAmount,
        realizedPNL: parsedPNL,
        code: code || '',
        isOption,
        isBuy: parsedQty > 0,
        isSell: parsedQty < 0,
        isExercise: (code || '').includes('Ex'),
        isAssignment: (code || '').includes('A'),
        isExpiry: (code || '').includes('Ep') || (code || '').includes('C;')
      };

      // Parse option details if applicable
      if (isOption) {
        const optionDetails = parseOptionSymbol(rawSymbol);
        Object.assign(trade, optionDetails);
        options.push(trade);
      }

      trades.push(trade);
    }

    console.log(`[TradeLoader] Parsed ${trades.length} trades (${options.length} options)`);

    // Build comprehensive summary
    const summary = buildTradeSummary(trades);
    
    return {
      trades,
      options,
      summary,
      byTicker: summary.byTicker
    };
  }

  /**
   * Parse option symbol to extract strike, expiry, type
   * Format: "RKLB 17JAN25 15 C" → { ticker: 'RKLB', expiry: '2025-01-17', strike: 15, optionType: 'call' }
   */
  function parseOptionSymbol(symbol) {
    const parts = symbol.split(' ');
    if (parts.length < 4) return { optionType: 'unknown' };

    const ticker = parts[0];
    const expiryStr = parts[1]; // e.g., "17JAN25"
    const strike = parseFloat(parts[2]) || 0;
    const typeCode = parts[3]; // C or P

    // Parse expiry date (17JAN25 → 2025-01-17)
    let expiry = null;
    const expiryMatch = expiryStr.match(/(\d{2})([A-Z]{3})(\d{2})/);
    if (expiryMatch) {
      const months = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
                       JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };
      const day = expiryMatch[1];
      const month = months[expiryMatch[2]] || '01';
      const year = '20' + expiryMatch[3];
      expiry = `${year}-${month}-${day}`;
    }

    return {
      optionTicker: ticker,
      expiry,
      expiryStr,
      strike,
      optionType: typeCode === 'C' ? 'call' : typeCode === 'P' ? 'put' : 'unknown',
      isCall: typeCode === 'C',
      isPut: typeCode === 'P'
    };
  }

  /**
   * Extract base ticker from option symbol
   * "ACHR 22AUG25 10 C" → "ACHR"
   * "GME" → "GME"
   */
  function extractTicker(symbol) {
    if (!symbol) return '';
    // Option format: "TICKER DATE STRIKE TYPE"
    const parts = symbol.split(' ');
    return parts[0].toUpperCase();
  }

  /**
   * Parse number, handling commas in thousands
   */
  function parseNumber(str) {
    if (!str) return 0;
    const cleaned = String(str).replace(/,/g, '').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Parse a single CSV line, handling quoted fields with commas
   */
  function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    return values;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SUMMARY COMPUTATION - Per-ship dossiers
  // "The richness is the point"
  // 
  // ARCHITECTURE: Store NORMALIZED SCALARS, derive language at render time
  // ─────────────────────────────────────────────────────────────────────────

  function buildTradeSummary(trades) {
    // Check cache first
    const hash = computeTradeHash(trades);
    if (hash === lastTradeHash && dossierCache.size > 0) {
      console.log('[TradeLoader] Using cached dossiers');
      return {
        byTicker: Object.fromEntries(dossierCache),
        tickers: [...dossierCache.keys()],
        tickerCount: dossierCache.size,
        totalTrades: trades.length,
        stockTrades: trades.filter(t => !t.isOption).length,
        optionTrades: trades.filter(t => t.isOption).length,
        totalPNL: [...dossierCache.values()].reduce((sum, d) => sum + d.totalPNL, 0),
        optionExpiries: [...expiryCache.values()].flat().sort((a, b) => (a.expiry || '').localeCompare(b.expiry || '')),
        hasOptionsHistory: trades.some(t => t.isOption)
      };
    }

    const byTicker = {};
    const optionExpiries = [];
    
    for (const trade of trades) {
      const ticker = trade.ticker;
      if (!ticker) continue;
      
      // Initialize ticker bucket
      if (!byTicker[ticker]) {
        byTicker[ticker] = {
          ticker,
          trades: [],
          stockTrades: [],
          optionTrades: [],
          totalPNL: 0,
          totalAmount: 0,
          tradeCount: 0,
          stockCount: 0,
          optionCount: 0,
          buyCount: 0,
          sellCount: 0,
          exerciseCount: 0,
          expiryCount: 0,
          firstTrade: null,
          lastTrade: null,
          uniqueDays: new Set(),
          optionExpiries: [],
          strikes: new Set(),
          // NORMALIZED METRICS (scalars only, no semantic labels)
          metrics: null
        };
      }
      
      const bucket = byTicker[ticker];
      bucket.trades.push(trade);
      bucket.tradeCount++;
      bucket.totalPNL += trade.realizedPNL;
      bucket.totalAmount += Math.abs(trade.amount);
      bucket.uniqueDays.add(trade.date);
      
      // Track trade direction
      if (trade.isBuy) bucket.buyCount++;
      if (trade.isSell) bucket.sellCount++;
      
      // Track by type
      if (trade.isOption) {
        bucket.optionTrades.push(trade);
        bucket.optionCount++;
        if (trade.strike) bucket.strikes.add(trade.strike);
        if (trade.expiry) {
          bucket.optionExpiries.push({ expiry: trade.expiry, strike: trade.strike, type: trade.optionType });
          optionExpiries.push({ ticker, ...trade });
        }
        if (trade.isExercise) bucket.exerciseCount++;
        if (trade.isExpiry) bucket.expiryCount++;
      } else {
        bucket.stockTrades.push(trade);
        bucket.stockCount++;
      }
      
      // Track date range
      if (!bucket.firstTrade || trade.date < bucket.firstTrade) {
        bucket.firstTrade = trade.date;
      }
      if (!bucket.lastTrade || trade.date > bucket.lastTrade) {
        bucket.lastTrade = trade.date;
      }
    }

    // Derive NORMALIZED METRICS for each ticker (scalars only)
    for (const ticker of Object.keys(byTicker)) {
      const bucket = byTicker[ticker];
      bucket.uniqueDays = bucket.uniqueDays.size;
      bucket.strikes = [...bucket.strikes].sort((a, b) => a - b);
      bucket.metrics = deriveShipMetrics(bucket);
      
      // Cache the dossier
      dossierCache.set(ticker, bucket);
      
      // Cache expiries grouped by ticker
      expiryCache.set(ticker, groupExpiries(trades, ticker));
    }

    // Update hash
    lastTradeHash = hash;

    // Sort option expiries by date
    optionExpiries.sort((a, b) => (a.expiry || '').localeCompare(b.expiry || ''));

    // Global stats
    const tickers = Object.keys(byTicker);
    const totalPNL = tickers.reduce((sum, t) => sum + byTicker[t].totalPNL, 0);
    const totalTrades = trades.length;
    const optionTradesCount = trades.filter(t => t.isOption).length;
    const stockTradesCount = trades.filter(t => !t.isOption).length;

    return {
      byTicker,
      tickers,
      tickerCount: tickers.length,
      totalTrades,
      stockTrades: stockTradesCount,
      optionTrades: optionTradesCount,
      totalPNL,
      optionExpiries,
      hasOptionsHistory: optionTradesCount > 0
    };
  }

  /**
   * Derive NORMALIZED SHIP METRICS from trade history
   * 
   * Returns SCALARS ONLY - semantic labels are derived at render time
   * This keeps the data model clean and future-proof for:
   * - Animation intensity
   * - Watercolor glazes
   * - Combat modifiers
   */
  function deriveShipMetrics(tickerData) {
    const { 
      tradeCount, totalPNL, totalAmount, optionCount, stockCount, 
      uniqueDays, exerciseCount, expiryCount, trades 
    } = tickerData;
    
    // Core metrics (all normalized 0-1 or raw values)
    const pnlRatio = totalAmount > 0 ? totalPNL / totalAmount : 0;
    const optionRatio = (optionCount + stockCount) > 0 
      ? optionCount / (optionCount + stockCount) 
      : 0;
    const tradesPerDay = uniqueDays > 0 ? tradeCount / uniqueDays : 0;
    const expiryDensity = optionCount > 0 ? expiryCount / optionCount : 0;
    
    // PNL variance (for instability calculation)
    const pnlValues = trades.map(t => t.realizedPNL).filter(p => p !== 0);
    const avgPNL = pnlValues.length > 0 
      ? pnlValues.reduce((a, b) => a + b, 0) / pnlValues.length 
      : 0;
    const pnlVariance = pnlValues.length > 0
      ? pnlValues.reduce((sum, p) => sum + Math.pow(p - avgPNL, 2), 0) / pnlValues.length
      : 0;
    const pnlStdDev = Math.sqrt(pnlVariance);
    const normalizedVariance = avgPNL !== 0 ? Math.min(1, Math.abs(pnlStdDev / avgPNL)) : 0;
    
    // Trade clustering (how "bursty" is trading activity)
    const tradeDates = [...new Set(trades.map(t => t.date))].sort();
    let clusterScore = 0;
    if (tradeDates.length > 1) {
      const dateGaps = [];
      for (let i = 1; i < tradeDates.length; i++) {
        const gap = (new Date(tradeDates[i]) - new Date(tradeDates[i-1])) / (1000 * 60 * 60 * 24);
        dateGaps.push(gap);
      }
      const avgGap = dateGaps.reduce((a, b) => a + b, 0) / dateGaps.length;
      const gapVariance = dateGaps.reduce((sum, g) => sum + Math.pow(g - avgGap, 2), 0) / dateGaps.length;
      clusterScore = Math.min(1, Math.sqrt(gapVariance) / 30); // Normalize against 30-day spread
    }

    // INSTABILITY: Derived from variance + options + clustering (NOT declared)
    const instability = Math.min(1, 
      normalizedVariance * 0.4 + 
      optionRatio * 0.3 + 
      clusterScore * 0.3
    );

    // Damage score (normalized 0-1)
    const damageScore = Math.min(1, 
      (Math.abs(Math.min(0, totalPNL)) / 5000) + (expiryCount * 0.05)
    );

    return {
      // Raw counts (for display)
      tradeDays: uniqueDays,
      tradeCount,
      optionCount,
      stockCount,
      expiryCount,
      exerciseCount,
      
      // Normalized ratios (0-1 scale)
      pnlRatio,
      optionRatio,
      tradesPerDay,
      expiryDensity,
      normalizedVariance,
      clusterScore,
      
      // Derived behavioral modifiers (all 0-1)
      instability,
      damageScore,
      hullIntegrity: 1 - damageScore,
      wearLevel: Math.min(1, uniqueDays / 100),
      engineStress: Math.min(1, tradesPerDay / 5),
      
      // Raw values for display
      totalPNL,
      avgPNL
    };
  }

  /**
   * PRESENTATION MAPPER - Derive semantic labels from metrics AT RENDER TIME
   * Call this in UI code, NOT in data pipeline
   */
  function describeShip(metrics) {
    if (!metrics) return { age: 'unknown', damage: 'unknown', activity: 'unknown', conviction: 'unknown' };
    
    const { tradeDays, damageScore, tradesPerDay, totalPNL, optionRatio } = metrics;
    
    return {
      age: tradeDays > 100 ? 'veteran' 
         : tradeDays > 30 ? 'seasoned' 
         : tradeDays > 7 ? 'familiar' 
         : 'green',
         
      damage: damageScore > 0.6 ? 'scarred' 
            : damageScore > 0.3 ? 'worn' 
            : damageScore > 0.1 ? 'scratched' 
            : 'clean',
            
      activity: tradesPerDay > 5 ? 'hyperactive' 
              : tradesPerDay > 2 ? 'active' 
              : tradesPerDay > 0.5 ? 'measured' 
              : 'calm',
              
      conviction: totalPNL > 1000 ? 'confident' 
                : totalPNL > 0 ? 'hopeful' 
                : totalPNL > -1000 ? 'cautious' 
                : 'desperate',
                
      complexity: optionRatio > 0.5 ? 'complex' 
                : optionRatio > 0.2 ? 'mixed' 
                : 'simple'
    };
  }

  /**
   * Group option expiries by date (for haunting/ghost effects)
   * Powers: looming expiry effects, derivatives missions, time-based distortions
   */
  function groupExpiries(trades, ticker) {
    const expiries = {};
    
    trades
      .filter(t => t.ticker === ticker && t.isOption && t.expiry)
      .forEach(t => {
        if (!expiries[t.expiry]) {
          expiries[t.expiry] = {
            expiry: t.expiry,
            count: 0,
            strikes: new Set(),
            types: new Set(),
            totalValue: 0
          };
        }
        expiries[t.expiry].count++;
        if (t.strike) expiries[t.expiry].strikes.add(t.strike);
        if (t.optionType) expiries[t.expiry].types.add(t.optionType);
        expiries[t.expiry].totalValue += Math.abs(t.amount);
      });
    
    // Convert to array sorted by expiry date
    return Object.values(expiries)
      .map(e => ({
        ...e,
        strikes: [...e.strikes].sort((a, b) => a - b),
        types: [...e.types]
      }))
      .sort((a, b) => a.expiry.localeCompare(b.expiry));
  }

  /**
   * Get looming expiries (upcoming within N days)
   * Used for haunting visual effects
   */
  function getLoomingExpiries(ticker, daysAhead = 30) {
    const cached = expiryCache.get(ticker);
    if (!cached) return [];
    
    const now = new Date();
    const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    
    return cached.filter(e => {
      const expDate = new Date(e.expiry);
      return expDate >= now && expDate <= cutoff;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PILOT STATS DERIVATION
  // "Ships now have history, not vibes"
  // "Guest feels busy, complex, slightly unstable"
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Derive pilot telemetry stats from trade history
   * These values drive:
   * - Ship temperament
   * - Watercolor glazes
   * - MACD distortion
   */
  function derivePilotStats(tradeData) {
    if (!tradeData || !tradeData.trades || tradeData.trades.length === 0) {
      return getDefaultPilotStats();
    }

    const { trades, summary, byTicker } = tradeData;
    
    // Use RealizedPNL directly from the new format
    const totalPNL = summary.totalPNL;
    const tradeCount = trades.length;
    
    // Win rate from RealizedPNL (positive PNL = profitable trade)
    const profitableTrades = trades.filter(t => t.realizedPNL > 0);
    const winRate = tradeCount > 0 ? profitableTrades.length / tradeCount : 0.5;
    
    // Calculate trade size variance for volatility exposure
    const tradeSizes = trades.map(t => Math.abs(t.amount));
    const avgSize = tradeSizes.reduce((a, b) => a + b, 0) / tradeSizes.length || 0;
    const variance = tradeSizes.reduce((sum, s) => sum + Math.pow(s - avgSize, 2), 0) / tradeSizes.length;
    const stdDev = Math.sqrt(variance);
    const volatilityExposure = Math.min(1, stdDev / (avgSize || 1));

    // Options ratio (more options = higher aggression)
    const optionTrades = summary.optionTrades;
    const stockTrades = summary.stockTrades;
    const optionsRatio = tradeCount > 0 ? optionTrades / tradeCount : 0;

    // Activity frequency (trades per unique day)
    const uniqueDays = new Set(trades.map(t => t.date)).size;
    const activityRate = uniqueDays > 0 ? Math.min(1, tradeCount / (uniqueDays * 10)) : 0.5;

    // Diversity: how many different ships
    const tickerCount = summary.tickerCount;
    const diversification = Math.min(1, tickerCount / 20);

    // Option expiry pressure (upcoming expiries = stress)
    const now = new Date();
    const upcomingExpiries = summary.optionExpiries?.filter(e => {
      const expDate = new Date(e.expiry);
      const daysUntil = (expDate - now) / (1000 * 60 * 60 * 24);
      return daysUntil > 0 && daysUntil < 30;
    }).length || 0;
    const expiryPressure = Math.min(1, upcomingExpiries / 10);

    return {
      // Core pilot attributes
      experience: Math.min(1, tradeCount / 500),           // Caps at 500 trades
      aggression: Math.min(1, optionsRatio + Math.abs(totalPNL) / 50000),
      discipline: winRate,
      volatilityExposure,
      activityRate,
      diversification,
      expiryPressure,
      
      // Derived visual modifiers
      engineGlow: 0.3 + (winRate * 0.4) + (activityRate * 0.3),
      hullIntegrity: 1 - (volatilityExposure * 0.3) - (expiryPressure * 0.2),
      thrustBias: totalPNL > 0 ? 0.6 : 0.4,
      instability: optionsRatio * 0.5 + expiryPressure * 0.3 + volatilityExposure * 0.2,
      
      // Raw stats for display
      tradeCount,
      totalPNL,
      winRate,
      optionsRatio,
      tickerCount,
      stockTrades,
      optionTrades,
      uniqueDays,
      
      // Per-ship data available
      byTicker
    };
  }

  function getDefaultPilotStats() {
    return {
      experience: 0.1,
      aggression: 0.3,
      discipline: 0.5,
      volatilityExposure: 0.5,
      activityRate: 0.3,
      diversification: 0.1,
      expiryPressure: 0,
      engineGlow: 0.5,
      hullIntegrity: 1,
      thrustBias: 0.5,
      instability: 0.2,
      tradeCount: 0,
      totalPNL: 0,
      winRate: 0.5,
      optionsRatio: 0,
      tickerCount: 0,
      stockTrades: 0,
      optionTrades: 0,
      uniqueDays: 0,
      byTicker: {}
    };
  }

  /**
   * Get trade summary for a specific ship (for tooltips/dossiers)
   */
  function getShipDossier(tradeData, ticker) {
    if (!tradeData?.byTicker?.[ticker]) return null;
    return tradeData.byTicker[ticker];
  }

  /**
   * Check if a ship has options history (for Derivatives Missions unlock)
   */
  function hasOptionsHistory(tradeData, ticker) {
    const dossier = getShipDossier(tradeData, ticker);
    return dossier ? dossier.optionCount > 0 : false;
  }

  /**
   * Get option expiries for a ship (for time-based haunting effects)
   */
  function getShipExpiries(tradeData, ticker) {
    const dossier = getShipDossier(tradeData, ticker);
    return dossier ? dossier.optionExpiries : [];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────

  return {
    loadTradeConfirms,
    derivePilotStats,
    getDefaultPilotStats,
    
    // Per-ship queries (for tooltips, dossiers, missions)
    getShipDossier,
    hasOptionsHistory,
    getShipExpiries,
    
    // NEW: Metrics-first API (2026-01-08 refactor)
    describeShip,         // UI presentation mapper - call at render time
    groupExpiries,        // Expiries by date for a ticker
    getLoomingExpiries,   // Upcoming expiries for haunting effects
    invalidateCache,      // Force cache refresh
    
    // Expose for testing
    parseCSVLine,
    extractTicker,
    parseOptionSymbol
  };

})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TradeLoader;
}
