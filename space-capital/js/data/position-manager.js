/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SPACE CAPITAL - POSITION MANAGER
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Manages cost basis and P&L data for fleet ships.
 * - Parses IBKR MTM CSV exports
 * - Allows manual entry/editing
 * - Persists to localStorage
 * - Feeds into ship behavior calculations
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

window.PositionManager = (function() {
  'use strict';

  const STORAGE_VERSION = 1;

  // ═══════════════════════════════════════════════════════════════════════════
  // POSITION DATA STRUCTURE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Position schema:
   * {
   *   ticker: 'RKLB',
   *   costBasis: 5000,      // Total cost invested
   *   currentValue: 7500,   // Current market value (optional, can be live)
   *   realizedPL: 1200,     // Realized P&L from closed positions
   *   unrealizedPL: 500,    // Unrealized P&L from open positions
   *   totalPL: 5756.78,     // Total P&L (from IBKR)
   *   shares: 100,          // Number of shares (optional)
   *   contracts: 5,         // Number of option contracts (optional)
   *   lastUpdated: '2026-01-07T10:00:00Z',
   *   source: 'ibkr-csv'    // 'manual', 'ibkr-csv', 'api'
   * }
   */

  let positions = {};
  let listeners = [];

  // ═══════════════════════════════════════════════════════════════════════════
  // STORAGE (Profile-aware)
  // ═══════════════════════════════════════════════════════════════════════════

  function getStorageKey() {
    // Use PlayerManager if available, otherwise fallback
    if (window.PlayerManager) {
      return window.PlayerManager.getPositionStorageKey();
    }
    return 'space-capital-positions-default';
  }

  function load() {
    try {
      const key = getStorageKey();
      const stored = localStorage.getItem(key);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.version === STORAGE_VERSION) {
          positions = data.positions || {};
          console.log('[PositionManager] Loaded', Object.keys(positions).length, 'positions for', key);
          return true;
        }
      }
    } catch (e) {
      console.warn('[PositionManager] Failed to load:', e);
    }
    positions = {};
    return false;
  }

  function save() {
    try {
      const key = getStorageKey();
      localStorage.setItem(key, JSON.stringify({
        version: STORAGE_VERSION,
        positions,
        savedAt: new Date().toISOString()
      }));
      return true;
    } catch (e) {
      console.error('[PositionManager] Failed to save:', e);
      return false;
    }
  }

  function notifyListeners() {
    listeners.forEach(fn => {
      try { fn(positions); } catch (e) { console.error(e); }
    });
  }

  // Called when profile switches - reload position data
  function switchProfile() {
    load();
    notifyListeners();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // IBKR CSV PARSER
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Parse Interactive Brokers Trade Confirms / Activity Statement CSV
   * Extracts:
   * - Open Positions (current holdings)
   * - Trade SubTotals (realized P&L per symbol)
   */
  function parseIBKRcsv(csvText) {
    const lines = csvText.split('\n');
    const results = {
      openPositions: {},   // Current holdings
      stockPL: {},         // Realized stock P&L
      optionsPL: {},       // Realized options P&L by underlying
      metadata: {}
    };

    for (const line of lines) {
      if (!line.trim()) continue;

      const fields = parseCSVLine(line);
      if (fields.length < 2) continue;

      const section = fields[0];
      const rowType = fields[1];

      // Extract metadata
      if (section === 'Statement' && rowType === 'Data') {
        const fieldName = fields[2];
        const fieldValue = fields[3];
        if (fieldName && fieldValue) {
          results.metadata[fieldName] = fieldValue;
        }
        continue;
      }

      // Open Positions - Current holdings
      if (section === 'Open Positions' && rowType === 'Data') {
        const dataType = fields[2]; // "Summary"
        const assetCategory = fields[3];
        const symbol = fields[5];
        const quantity = parseNumberWithCommas(fields[6]);
        const closePrice = parseFloat(fields[8]) || 0;
        const value = parseFloat(fields[9]) || 0;

        if (dataType === 'Summary' && symbol) {
          // Extract underlying ticker from option symbol (e.g., "ACHR 22AUG25 10 C" -> "ACHR")
          const underlying = symbol.split(' ')[0];
          
          if (!results.openPositions[underlying]) {
            results.openPositions[underlying] = {
              ticker: underlying,
              stockQty: 0,
              stockValue: 0,
              optionsQty: 0,
              optionsValue: 0,
              contracts: []
            };
          }

          if (assetCategory === 'Stocks') {
            results.openPositions[underlying].stockQty += quantity;
            results.openPositions[underlying].stockValue += value;
          } else if (assetCategory === 'Equity and Index Options') {
            results.openPositions[underlying].optionsQty += Math.abs(quantity);
            results.openPositions[underlying].optionsValue += value;
            results.openPositions[underlying].contracts.push({
              symbol,
              quantity,
              price: closePrice,
              value
            });
          }
        }
        continue;
      }

      // Trades SubTotal - Realized P&L
      // Look for SubTotal rows that have just the ticker (not "(Bought)" or "(Sold)")
      if (section === 'Trades' && rowType === 'SubTotal') {
        const assetCategory = fields[3];
        const symbol = fields[5];
        const proceeds = parseFloat(fields[9]) || 0;
        const commissions = parseFloat(fields[10]) || 0;

        // Skip "(Bought)" and "(Sold)" subtotals - we want the net
        if (!symbol || symbol.includes('(Bought)') || symbol.includes('(Sold)')) {
          continue;
        }

        // Skip "Total" rows
        if (symbol === '' && fields[2] === '') continue;

        if (assetCategory === 'Stocks') {
          const ticker = symbol;
          if (!results.stockPL[ticker]) {
            results.stockPL[ticker] = { proceeds: 0, commissions: 0 };
          }
          results.stockPL[ticker].proceeds += proceeds;
          results.stockPL[ticker].commissions += commissions;
        } 
        else if (assetCategory === 'Equity and Index Options') {
          // Extract underlying from option symbol
          const underlying = symbol.split(' ')[0];
          if (!results.optionsPL[underlying]) {
            results.optionsPL[underlying] = { proceeds: 0, commissions: 0, contracts: [] };
          }
          results.optionsPL[underlying].proceeds += proceeds;
          results.optionsPL[underlying].commissions += commissions;
          results.optionsPL[underlying].contracts.push({
            symbol,
            proceeds,
            commissions
          });
        }
      }
    }

    // Combine into final positions
    const combined = {};
    const allTickers = new Set([
      ...Object.keys(results.stockPL),
      ...Object.keys(results.optionsPL),
      ...Object.keys(results.openPositions)
    ]);

    for (const ticker of allTickers) {
      const stockData = results.stockPL[ticker] || { proceeds: 0, commissions: 0 };
      const optionsData = results.optionsPL[ticker] || { proceeds: 0, commissions: 0 };
      const openPos = results.openPositions[ticker];

      // Realized P&L = proceeds - commissions (proceeds already net of cost)
      const stockPL = stockData.proceeds + stockData.commissions; // commissions are negative
      const optionsPL = optionsData.proceeds + optionsData.commissions;
      const totalPL = stockPL + optionsPL;

      combined[ticker] = {
        ticker,
        stockPL,
        optionsPL,
        totalPL,
        commissions: stockData.commissions + optionsData.commissions,
        // Open position info
        hasOpenPosition: !!openPos,
        openStockQty: openPos?.stockQty || 0,
        openStockValue: openPos?.stockValue || 0,
        openOptionsQty: openPos?.optionsQty || 0,
        openOptionsValue: openPos?.optionsValue || 0,
        openContracts: openPos?.contracts || [],
        source: 'ibkr-csv',
        lastUpdated: new Date().toISOString()
      };
    }

    return {
      positions: combined,
      metadata: results.metadata,
      summary: {
        tickerCount: Object.keys(combined).length,
        totalStockPL: Object.values(results.stockPL).reduce((sum, s) => sum + s.proceeds + s.commissions, 0),
        totalOptionsPL: Object.values(results.optionsPL).reduce((sum, o) => sum + o.proceeds + o.commissions, 0),
        totalOpenValue: Object.values(results.openPositions).reduce((sum, p) => sum + p.stockValue + p.optionsValue, 0)
      }
    };
  }

  /**
   * Parse number that may have commas (e.g., "1,000" -> 1000)
   */
  function parseNumberWithCommas(str) {
    if (!str) return 0;
    return parseFloat(str.replace(/,/g, '')) || 0;
  }

  /**
   * Parse a single CSV line, handling quoted fields
   */
  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // POSITION CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  function get(ticker) {
    return positions[ticker] || null;
  }

  function getAll() {
    return { ...positions };
  }

  function set(ticker, data) {
    positions[ticker] = {
      ...positions[ticker],
      ...data,
      ticker,
      lastUpdated: new Date().toISOString()
    };
    save();
    notifyListeners();
    return positions[ticker];
  }

  function update(ticker, updates) {
    if (!positions[ticker]) {
      positions[ticker] = { ticker };
    }
    positions[ticker] = {
      ...positions[ticker],
      ...updates,
      lastUpdated: new Date().toISOString()
    };
    save();
    notifyListeners();
    return positions[ticker];
  }

  function remove(ticker) {
    const removed = positions[ticker];
    delete positions[ticker];
    save();
    notifyListeners();
    return removed;
  }

  function clear() {
    positions = {};
    save();
    notifyListeners();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // IMPORT/EXPORT
  // ═══════════════════════════════════════════════════════════════════════════

  function importFromCSV(csvText, options = {}) {
    const { merge = true, overwrite = true } = options;
    
    const parsed = parseIBKRcsv(csvText);
    
    if (!merge) {
      positions = {};
    }

    for (const [ticker, data] of Object.entries(parsed.positions)) {
      if (overwrite || !positions[ticker]) {
        positions[ticker] = {
          ...positions[ticker],
          ...data
        };
      }
    }

    save();
    notifyListeners();

    return parsed;
  }

  function exportToJSON() {
    return JSON.stringify({
      version: STORAGE_VERSION,
      exportedAt: new Date().toISOString(),
      positions
    }, null, 2);
  }

  function importFromJSON(jsonText) {
    try {
      const data = JSON.parse(jsonText);
      if (data.positions) {
        positions = data.positions;
        save();
        notifyListeners();
        return { success: true, count: Object.keys(positions).length };
      }
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CALCULATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Calculate P&L percentage for a position
   */
  function getPnLPercent(ticker) {
    const pos = positions[ticker];
    if (!pos) return 0;

    // If we have costBasis and currentValue, use those
    if (pos.costBasis && pos.currentValue) {
      return ((pos.currentValue - pos.costBasis) / pos.costBasis) * 100;
    }

    // If we have totalPL and costBasis, calculate from that
    if (pos.totalPL !== undefined && pos.costBasis) {
      return (pos.totalPL / pos.costBasis) * 100;
    }

    // Fallback: just return a normalized version of totalPL
    // (Assumes ~$1000 position if no cost basis)
    if (pos.totalPL !== undefined) {
      return pos.totalPL / 100; // Rough approximation
    }

    return 0;
  }

  /**
   * Get behavior-ready stats for a ticker
   */
  function getBehaviorStats(ticker) {
    const pos = positions[ticker];
    if (!pos) return null;

    const pnlPct = getPnLPercent(ticker);
    
    // Map P&L to hull damage (negative P&L = damage)
    const damage = pnlPct < 0 ? Math.min(1, Math.abs(pnlPct) / 50) : 0;
    
    // Activity based on recent trading (if tracked)
    const activity = pos.recentActivity ?? 0.5;

    return {
      pnlPercent: pnlPct,
      totalPL: pos.totalPL || 0,
      stockPL: pos.stockPL || 0,
      optionsPL: pos.optionsPL || 0,
      hull: 100 - (damage * 100),
      damage,
      activity
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT LISTENERS
  // ═══════════════════════════════════════════════════════════════════════════

  function onChange(callback) {
    listeners.push(callback);
    return () => {
      listeners = listeners.filter(fn => fn !== callback);
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════════════════════

  // Auto-load on module init
  load();

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    // CRUD
    get,
    getAll,
    set,
    update,
    remove,
    clear,

    // Import/Export
    importFromCSV,
    exportToJSON,
    importFromJSON,
    parseIBKRcsv,

    // Calculations
    getPnLPercent,
    getBehaviorStats,

    // Events
    onChange,

    // Storage
    load,
    save,
    
    // Profile switching
    switchProfile
  };

})();
