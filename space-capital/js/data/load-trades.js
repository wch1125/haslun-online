/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TRADE CONFIRMS LOADER
 * Single ingestion pipeline for all trade data
 * 
 * Rules:
 * - Guest = read-only pilot with canonical CSV
 * - Uploaded CSVs override, never merge
 * - Same parsing path for both
 * ═══════════════════════════════════════════════════════════════════════════
 */

const TradeLoader = (function() {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN ENTRY POINT
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Load trade confirms based on user profile
   * @param {Object} userProfile - { type: 'guest'|'pilot', uploadedCSV?: string }
   * @returns {Promise<Array>} Parsed trade records
   */
  async function loadTradeConfirms(userProfile) {
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
  // ─────────────────────────────────────────────────────────────────────────

  function buildTradeSummary(trades) {
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
          // Derived personality traits
          personality: null
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

    // Derive personality for each ticker
    for (const ticker of Object.keys(byTicker)) {
      byTicker[ticker].uniqueDays = byTicker[ticker].uniqueDays.size;
      byTicker[ticker].strikes = [...byTicker[ticker].strikes].sort((a, b) => a - b);
      byTicker[ticker].personality = deriveShipPersonality(byTicker[ticker]);
    }

    // Sort option expiries by date
    optionExpiries.sort((a, b) => (a.expiry || '').localeCompare(b.expiry || ''));

    // Global stats
    const tickers = Object.keys(byTicker);
    const totalPNL = tickers.reduce((sum, t) => sum + byTicker[t].totalPNL, 0);
    const totalTrades = trades.length;
    const optionTrades = trades.filter(t => t.isOption).length;
    const stockTrades = trades.filter(t => !t.isOption).length;

    return {
      byTicker,
      tickers,
      tickerCount: tickers.length,
      totalTrades,
      stockTrades,
      optionTrades,
      totalPNL,
      optionExpiries,
      hasOptionsHistory: optionTrades > 0
    };
  }

  /**
   * Derive ship personality from trade history
   * "Some ships feel older or more damaged (high trade count, long history)"
   */
  function deriveShipPersonality(tickerData) {
    const { tradeCount, totalPNL, optionCount, stockCount, uniqueDays, exerciseCount, expiryCount } = tickerData;
    
    // Age: how long the pilot has been trading this ship
    const age = uniqueDays > 100 ? 'veteran' : uniqueDays > 30 ? 'seasoned' : uniqueDays > 7 ? 'familiar' : 'new';
    
    // Damage: based on losses and expired options
    const damageScore = Math.min(1, (Math.abs(Math.min(0, totalPNL)) / 5000) + (expiryCount * 0.05));
    const damage = damageScore > 0.6 ? 'scarred' : damageScore > 0.3 ? 'worn' : damageScore > 0.1 ? 'scratched' : 'clean';
    
    // Complexity: options vs stock ratio
    const optionsRatio = optionCount / (stockCount + optionCount || 1);
    const complexity = optionsRatio > 0.5 ? 'complex' : optionsRatio > 0.2 ? 'mixed' : 'simple';
    
    // Activity: trades per unique day
    const activityRate = tradeCount / (uniqueDays || 1);
    const activity = activityRate > 5 ? 'hyperactive' : activityRate > 2 ? 'active' : activityRate > 0.5 ? 'moderate' : 'calm';
    
    // Conviction: based on trade volume and consistency
    const conviction = totalPNL > 1000 ? 'confident' : totalPNL > 0 ? 'hopeful' : totalPNL > -1000 ? 'cautious' : 'desperate';

    return {
      age,
      damage,
      damageScore,
      complexity,
      activity,
      activityRate,
      conviction,
      optionsRatio,
      // Visual modifiers
      hullIntegrity: 1 - damageScore,
      wearLevel: Math.min(1, uniqueDays / 100),
      engineStress: Math.min(1, activityRate / 5)
    };
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
