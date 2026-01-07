/**
 * HASLUN-BOT Indicator Loader
 * Loads and parses TradingView 45m CSV exports for the mission system
 * 
 * CSV Structure (51 columns):
 * - time, open, high, low, close
 * - Band ladders: A1..A5, B1..B5, C1..C5, D1..D5, E1..E5, F1..F5
 * - Moving averages: G100, G150, G200
 * - Kernel Regression Estimate
 * - Buy, Sell, StopBuy, StopSell (StopBuy/StopSell are empty - ignored)
 * - Volume, Volume MA
 * - MACD, Signal Line, Histogram
 * - Cross, Main Line, Gobble Line
 */

const IndicatorLoader = (function() {
  'use strict';
  
  const BASE_PATH = 'data/indicators/45m/';
  let manifest = null;
  let cache = {};
  
  // Column name mapping (TradingView headers → clean keys)
  const COLUMN_MAP = {
    'time': 'time',
    'open': 'open',
    'high': 'high',
    'low': 'low',
    'close': 'close',
    'A1': 'A1', 'A2': 'A2', 'A3': 'A3', 'A4': 'A4', 'A5': 'A5',
    'B1': 'B1', 'B2': 'B2', 'B3': 'B3', 'B4': 'B4', 'B5': 'B5',
    'C1': 'C1', 'C2': 'C2', 'C3': 'C3', 'C4': 'C4', 'C5': 'C5',
    'D1': 'D1', 'D2': 'D2', 'D3': 'D3', 'D4': 'D4', 'D5': 'D5',
    'E1': 'E1', 'E2': 'E2', 'E3': 'E3', 'E4': 'E4', 'E5': 'E5',
    'F1': 'F1', 'F2': 'F2', 'F3': 'F3', 'F4': 'F4', 'F5': 'F5',
    'G100': 'G100', 'G150': 'G150', 'G200': 'G200',
    'Kernel Regression Estimate': 'kernelRegression',
    'Buy': 'buy',
    'Sell': 'sell',
    'StopBuy': 'stopBuy',   // Empty - ignored
    'StopSell': 'stopSell', // Empty - ignored
    'Volume': 'volume',
    'Volume MA': 'volumeMA',
    'MACD': 'macd',
    'Signal Line': 'signalLine',
    'Histogram': 'histogram',
    'Cross': 'cross',
    'Main Line': 'mainLine',
    'Gobble Line': 'gobbleLine'
  };
  
  /**
   * Load the manifest file
   */
  async function loadManifest() {
    if (manifest) return manifest;
    
    try {
      const response = await fetch(BASE_PATH + 'manifest.json');
      if (!response.ok) throw new Error('Manifest not found');
      manifest = await response.json();
      console.log('[IndicatorLoader] Manifest loaded:', manifest.tickers.length, 'tickers available');
      return manifest;
    } catch (err) {
      console.error('[IndicatorLoader] Failed to load manifest:', err);
      throw err;
    }
  }
  
  /**
   * Get list of available tickers
   */
  async function getAvailableTickers() {
    const m = await loadManifest();
    return m.tickers.map(t => ({
      ticker: t.ticker,
      name: t.name || t.ticker,
      file: t.file
    }));
  }
  
  /**
   * Quote-safe CSV line splitter
   * Handles fields wrapped in quotes that may contain commas
   */
  function splitCSVLine(line) {
    const out = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === ',' && !inQuotes) {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  }
  
  /**
   * Parse CSV text into array of objects
   * Now uses quote-safe parsing and logs dropped rows
   */
  function parseCSV(csvText, ticker) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV has no data rows');
    }
    
    // Parse header using quote-safe splitter
    const headers = splitCSVLine(lines[0]).map(h => h.trim());
    
    // Map headers to clean keys
    const keyMap = headers.map(h => COLUMN_MAP[h] || h);
    
    // Parse data rows
    const rows = [];
    let dropped = 0;
    
    for (let i = 1; i < lines.length; i++) {
      const values = splitCSVLine(lines[i]);
      
      if (values.length !== headers.length) {
        dropped++;
        if (dropped <= 5) {
          console.warn(`[IndicatorLoader] Bad CSV row ${i} for ${ticker}: got ${values.length} cols, expected ${headers.length}`);
        }
        continue;
      }
      
      const row = {};
      for (let j = 0; j < keyMap.length; j++) {
        const key = keyMap[j];
        const val = values[j].trim();
        
        // Parse as number (most values are numeric)
        // Empty strings become null
        row[key] = val === '' ? null : parseFloat(val);
        
        // Keep time as integer (Unix seconds)
        if (key === 'time') {
          row[key] = parseInt(val, 10);
        }
      }
      
      rows.push(row);
    }
    
    if (dropped > 0) {
      console.warn(`[IndicatorLoader] Dropped ${dropped} malformed rows for ${ticker}`);
    }
    
    console.log(`[IndicatorLoader] Parsed ${rows.length} rows for ${ticker}`);
    return rows;
  }
  
  /**
   * Load indicator data for a specific ticker
   */
  async function loadTicker(ticker) {
    ticker = ticker.toUpperCase();
    
    // Check cache
    if (cache[ticker]) {
      console.log(`[IndicatorLoader] Using cached data for ${ticker}`);
      return cache[ticker];
    }
    
    // Get manifest
    const m = await loadManifest();
    const tickerInfo = m.tickers.find(t => t.ticker === ticker);
    
    if (!tickerInfo) {
      throw new Error(`Ticker ${ticker} not found in manifest. Available: ${m.tickers.map(t => t.ticker).join(', ')}`);
    }
    
    // Fetch CSV
    const csvPath = BASE_PATH + tickerInfo.file;
    console.log(`[IndicatorLoader] Fetching ${csvPath}...`);
    
    const response = await fetch(csvPath);
    if (!response.ok) {
      throw new Error(`Failed to load CSV for ${ticker}: ${response.status}`);
    }
    
    const csvText = await response.text();
    const rows = parseCSV(csvText, ticker);
    
    // Build result object
    const result = {
      ticker: ticker,
      name: tickerInfo.name || ticker,
      timeframe: '45m',
      rows: rows,
      rowCount: rows.length,
      dateRange: {
        start: new Date(rows[0].time * 1000).toISOString(),
        end: new Date(rows[rows.length - 1].time * 1000).toISOString()
      },
      lastUpdated: m.lastUpdated
    };
    
    // Cache it
    cache[ticker] = result;
    
    return result;
  }
  
  /**
   * Get the last N rows for a ticker (for stat computation)
   * @param {string} ticker 
   * @param {number} n - Number of bars (default 32)
   */
  async function getRecentBars(ticker, n = 32) {
    const data = await loadTicker(ticker);
    const rows = data.rows;
    
    if (rows.length < n) {
      console.warn(`[IndicatorLoader] Only ${rows.length} bars available for ${ticker}, requested ${n}`);
      return rows.slice();
    }
    
    return rows.slice(-n);
  }
  
  /**
   * Get the latest bar for a ticker
   */
  async function getLatestBar(ticker) {
    const data = await loadTicker(ticker);
    return data.rows[data.rows.length - 1];
  }
  
  /**
   * Clear the cache (useful if CSVs are updated)
   */
  function clearCache() {
    cache = {};
    manifest = null;
    console.log('[IndicatorLoader] Cache cleared');
  }
  
  /**
   * Get manifest metadata
   */
  async function getMetadata() {
    const m = await loadManifest();
    return {
      timeframe: m.timeframe,
      source: m.source,
      lastUpdated: m.lastUpdated,
      tickerCount: m.tickers.length,
      notes: m.notes
    };
  }
  
  // Public API
  return {
    loadManifest,
    getAvailableTickers,
    loadTicker,
    getRecentBars,
    getLatestBar,
    clearCache,
    getMetadata
  };
  
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = IndicatorLoader;
}
