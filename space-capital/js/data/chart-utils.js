/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CHART UTILITIES - BULLETPROOF EDITION v2
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * This version completely prevents the oscillation/spiraling bug by:
 * 1. STRICT timestamp-keyed deduplication (one price per minute)
 * 2. Pure index-based X axis (no date parsing for chart positioning)
 * 3. Aggressive validation of all numeric values
 * 4. Simple, predictable output format
 * 5. Preserves intraday structure (45m data keeps multiple points per day)
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

const ChartUtils = (function() {
  'use strict';

  /**
   * Normalize timestamp to ISO string rounded to minute
   * This preserves intraday structure while preventing micro-duplicates
   */
  function normalizeTimestamp(dateInput) {
    if (!dateInput) return null;
    
    try {
      let d;
      
      // Already a Date object
      if (dateInput instanceof Date) {
        d = dateInput;
      }
      // String input
      else if (typeof dateInput === 'string') {
        // Pure YYYY-MM-DD string - add noon time to avoid timezone issues
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
          d = new Date(dateInput + 'T12:00:00');
        } else {
          d = new Date(dateInput);
        }
      }
      // Numeric timestamp
      else if (typeof dateInput === 'number') {
        d = new Date(dateInput);
      }
      else {
        return null;
      }
      
      if (isNaN(d.getTime())) return null;
      
      // Round to minute (zero out seconds and milliseconds)
      d.setSeconds(0, 0);
      
      return d.toISOString();
    } catch {
      return null;
    }
  }

  /**
   * Extract date string for display (YYYY-MM-DD)
   */
  function extractDateForDisplay(isoTimestamp) {
    if (!isoTimestamp) return '';
    return isoTimestamp.split('T')[0];
  }

  /**
   * Parse price value to number
   */
  function parsePrice(val) {
    if (typeof val === 'number' && isFinite(val)) return val;
    const num = parseFloat(val);
    return isFinite(num) ? num : null;
  }

  /**
   * Prepare chart data - THE MAIN FUNCTION
   * 
   * @param {Array} rawData - Array of {date, close/price} objects
   * @param {Object} options - Configuration
   * @returns {Object} {labels, prices, domain, dateLabels}
   */
  function prepareChartData(rawData, options = {}) {
    const {
      targetPoints = 150,
      yPadding = 0.05
    } = options;

    // Empty check
    if (!Array.isArray(rawData) || rawData.length === 0) {
      console.warn('[ChartUtils] No data provided');
      return emptyResult();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 1: Build a Map keyed by normalized timestamp (minute-level)
    // This preserves intraday data while eliminating micro-duplicates
    // ═══════════════════════════════════════════════════════════════════════
    
    const timestampMap = new Map();
    
    for (const point of rawData) {
      // Extract timestamp
      const tsKey = normalizeTimestamp(point.date || point.time);
      if (!tsKey) continue;
      
      // Extract price
      const price = parsePrice(point.close ?? point.price ?? point.y);
      if (price === null) continue;
      
      // Store (last value wins for same timestamp)
      timestampMap.set(tsKey, { timestamp: tsKey, close: price });
    }

    if (timestampMap.size === 0) {
      console.warn('[ChartUtils] No valid data points after processing');
      return emptyResult();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 2: Sort by timestamp (ISO strings sort lexicographically correctly)
    // ═══════════════════════════════════════════════════════════════════════
    
    const sortedTimestamps = Array.from(timestampMap.keys()).sort();
    
    // ═══════════════════════════════════════════════════════════════════════
    // STEP 3: Downsample if needed (simple bucket averaging)
    // ═══════════════════════════════════════════════════════════════════════
    
    let finalTimestamps = sortedTimestamps;
    
    if (sortedTimestamps.length > targetPoints) {
      finalTimestamps = downsampleTimestamps(sortedTimestamps, timestampMap, targetPoints);
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // STEP 4: Extract final arrays
    // ═══════════════════════════════════════════════════════════════════════
    
    const prices = [];
    const dateLabels = [];
    
    for (const ts of finalTimestamps) {
      const point = timestampMap.get(ts);
      if (point) {
        prices.push(point.close);
        // Store the display date (YYYY-MM-DD) for tooltips
        dateLabels.push(extractDateForDisplay(ts));
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // STEP 5: Calculate Y domain
    // ═══════════════════════════════════════════════════════════════════════
    
    const domain = calculateYDomain(prices, yPadding);
    
    // ═══════════════════════════════════════════════════════════════════════
    // STEP 6: Generate sequential index labels (0, 1, 2, 3...)
    // This is the KEY to preventing oscillation - no date parsing on X axis
    // ═══════════════════════════════════════════════════════════════════════
    
    const labels = prices.map((_, i) => i);
    
    console.log(`[ChartUtils] Processed ${rawData.length} raw → ${prices.length} clean points`);
    
    return {
      labels,      // Sequential indices for X axis
      prices,      // Y values
      domain,      // {min, max} for Y scale
      dateLabels   // Original dates for tooltips
    };
  }

  /**
   * Downsample timestamps using min-max preservation within buckets
   * Works with ISO timestamp strings
   */
  function downsampleTimestamps(sortedTimestamps, timestampMap, targetPoints) {
    const bucketSize = Math.ceil(sortedTimestamps.length / targetPoints);
    const result = [];
    
    for (let i = 0; i < sortedTimestamps.length; i += bucketSize) {
      const bucket = sortedTimestamps.slice(i, i + bucketSize);
      
      if (bucket.length === 1) {
        result.push(bucket[0]);
      } else {
        // Find min and max price points in bucket
        let minTs = bucket[0], maxTs = bucket[0];
        let minPrice = Infinity, maxPrice = -Infinity;
        
        for (const ts of bucket) {
          const p = timestampMap.get(ts).close;
          if (p < minPrice) { minPrice = p; minTs = ts; }
          if (p > maxPrice) { maxPrice = p; maxTs = ts; }
        }
        
        // Add in chronological order (ISO strings sort correctly)
        if (minTs < maxTs) {
          result.push(minTs, maxTs);
        } else if (maxTs < minTs) {
          result.push(maxTs, minTs);
        } else {
          result.push(minTs);
        }
      }
    }
    
    // Ensure still sorted
    return result.sort();
  }

  /**
   * Legacy alias for backward compatibility
   */
  function downsampleDates(sortedDates, dateMap, targetPoints) {
    return downsampleTimestamps(sortedDates, dateMap, targetPoints);
  }

  /**
   * Calculate Y axis domain with padding
   */
  function calculateYDomain(prices, padding = 0.05) {
    if (!prices || prices.length === 0) {
      return { min: 0, max: 100 };
    }
    
    let min = Infinity, max = -Infinity;
    for (const p of prices) {
      if (p < min) min = p;
      if (p > max) max = p;
    }
    
    // Handle edge cases
    if (!isFinite(min) || !isFinite(max)) {
      return { min: 0, max: 100 };
    }
    
    if (min === max) {
      // Single value - create artificial range
      return { min: min * 0.95, max: max * 1.05 };
    }
    
    const range = max - min;
    const pad = range * padding;
    
    return {
      min: min - pad,
      max: max + pad
    };
  }

  /**
   * Format date for display
   */
  function formatDate(dateStr, format = 'short') {
    if (!dateStr) return '';
    
    try {
      const d = new Date(dateStr + 'T12:00:00'); // Add time to avoid timezone issues
      
      switch (format) {
        case 'short':
          return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        case 'medium':
          return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
        default:
          return d.toLocaleDateString();
      }
    } catch {
      return dateStr;
    }
  }

  /**
   * Create Chart.js configuration
   */
  function createChartConfig(data, options = {}) {
    const {
      color = '#39FF14',  // Default to green
      label = 'Price',
      showFill = true,
      fillOpacity = 0.1,
      tension = 0.2,
      borderWidth = 2
    } = options;

    // Format dates for display labels
    const displayLabels = data.dateLabels.map(d => formatDate(d));
    
    // Calculate fill color with opacity
    const fillHex = Math.round(fillOpacity * 255).toString(16).padStart(2, '0');

    return {
      type: 'line',
      data: {
        labels: displayLabels,
        datasets: [{
          label: label,
          data: data.prices,
          borderColor: color,
          backgroundColor: showFill ? color + fillHex : 'transparent',
          fill: showFill ? 'origin' : false,
          tension: tension,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: borderWidth,
          spanGaps: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#12121A',
            borderColor: color,
            borderWidth: 1,
            titleFont: { family: 'VT323' },
            bodyFont: { family: 'VT323' },
            callbacks: {
              title: (items) => {
                const idx = items[0]?.dataIndex;
                if (data.dateLabels && data.dateLabels[idx]) {
                  return formatDate(data.dateLabels[idx], 'medium');
                }
                return '';
              },
              label: (ctx) => {
                const val = ctx.parsed.y;
                return isFinite(val) ? `$${val.toFixed(2)}` : 'N/A';
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: '#333344', drawBorder: false },
            ticks: {
              color: '#888899',
              font: { family: 'VT323' },
              maxRotation: 45,
              autoSkip: true,
              maxTicksLimit: 10
            }
          },
          y: {
            min: data.domain.min,
            max: data.domain.max,
            grid: { color: '#333344', drawBorder: false },
            ticks: {
              color: '#888899',
              font: { family: 'VT323' },
              callback: (value) => '$' + value.toFixed(2)
            }
          }
        },
        animation: { duration: 300 }
      }
    };
  }

  /**
   * Create MACD mini-chart configuration
   */
  function createMACDConfig(macdData, options = {}) {
    const {
      macdColor = '#FF2975',
      signalColor = '#00FFFF',
      histPosColor = '#39FF14',
      histNegColor = '#FF0040'
    } = options;

    const macdLine = [];
    const signalLine = [];
    const histogram = [];
    
    for (const d of macdData) {
      const m = parsePrice(d.macd ?? d.MACD);
      const s = parsePrice(d.signal ?? d.signalLine ?? d.Signal);
      
      macdLine.push(m);
      signalLine.push(s);
      histogram.push(m !== null && s !== null ? m - s : null);
    }

    const allValues = [...macdLine, ...signalLine].filter(v => v !== null);
    const absMax = allValues.length > 0 ? Math.max(...allValues.map(Math.abs), 0.01) : 1;

    return {
      type: 'line',
      data: {
        labels: macdData.map((_, i) => i),
        datasets: [
          {
            label: 'MACD',
            data: macdLine,
            borderColor: macdColor,
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.2,
            fill: false
          },
          {
            label: 'Signal',
            data: signalLine,
            borderColor: signalColor,
            borderWidth: 1,
            pointRadius: 0,
            tension: 0.2,
            fill: false,
            borderDash: [2, 2]
          },
          {
            type: 'bar',
            label: 'Histogram',
            data: histogram,
            backgroundColor: histogram.map(h => 
              h === null ? 'transparent' : h >= 0 ? histPosColor + '80' : histNegColor + '80'
            ),
            borderWidth: 0,
            barPercentage: 0.8
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { display: false },
          y: { display: false, min: -absMax * 1.1, max: absMax * 1.1 }
        },
        animation: false
      }
    };
  }

  /**
   * Detect MACD crossovers
   */
  function detectMACDCrossovers(macdData) {
    const crossovers = [];
    
    for (let i = 1; i < macdData.length; i++) {
      const prevM = parsePrice(macdData[i-1].macd ?? macdData[i-1].MACD);
      const prevS = parsePrice(macdData[i-1].signal ?? macdData[i-1].signalLine);
      const currM = parsePrice(macdData[i].macd ?? macdData[i].MACD);
      const currS = parsePrice(macdData[i].signal ?? macdData[i].signalLine);
      
      if (prevM === null || prevS === null || currM === null || currS === null) continue;
      
      const prevDiff = prevM - prevS;
      const currDiff = currM - currS;
      
      if (prevDiff <= 0 && currDiff > 0) {
        crossovers.push({ index: i, type: 'bullish' });
      } else if (prevDiff >= 0 && currDiff < 0) {
        crossovers.push({ index: i, type: 'bearish' });
      }
    }
    
    return crossovers;
  }

  /**
   * Diagnose data issues
   */
  function diagnoseData(data) {
    if (!Array.isArray(data) || data.length === 0) {
      return { valid: false, issues: ['Empty data'] };
    }
    
    const issues = [];
    const dates = new Set();
    let nullPrices = 0;
    
    for (const d of data) {
      const dateStr = normalizeDate(d.date || d.time);
      if (dateStr) dates.add(dateStr);
      
      const price = parsePrice(d.close ?? d.price);
      if (price === null) nullPrices++;
    }
    
    if (dates.size !== data.length) {
      issues.push(`${data.length - dates.size} duplicate dates`);
    }
    if (nullPrices > 0) {
      issues.push(`${nullPrices} invalid prices`);
    }
    
    return {
      valid: issues.length === 0,
      issues,
      stats: { total: data.length, uniqueDates: dates.size, invalidPrices: nullPrices }
    };
  }

  /**
   * Empty result helper
   */
  function emptyResult() {
    return {
      labels: [],
      prices: [],
      domain: { min: 0, max: 100 },
      dateLabels: []
    };
  }

  // Public API
  return {
    prepareChartData,
    createChartConfig,
    createMACDConfig,
    detectMACDCrossovers,
    diagnoseData,
    formatDate,
    calculateYDomain
  };

})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChartUtils;
}
