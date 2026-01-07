/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CHART UTILITIES - Robust Price Chart Rendering
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Fixes common chart rendering issues:
 * 1. Duplicate X values causing vertical "needle" spikes
 * 2. Non-monotonic timestamps
 * 3. Too many data points for display width
 * 4. Y-axis scaling issues with area fills
 * 5. NaN/undefined values causing spiraling lines
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

const ChartUtils = (function() {
  'use strict';

  /**
   * Validate and clean a single data point
   * Returns null if the point is invalid
   */
  function validatePoint(point) {
    if (!point || typeof point !== 'object') return null;
    
    // Extract price value
    const price = parseFloat(point.close ?? point.price ?? point.y);
    if (!isFinite(price) || isNaN(price)) return null;
    
    // Extract date/time
    let time;
    if (point.time && typeof point.time === 'number') {
      time = point.time;
    } else if (point.date) {
      time = new Date(point.date).getTime();
    } else {
      return null;
    }
    
    if (!isFinite(time) || isNaN(time)) return null;
    
    return {
      date: point.date || new Date(time).toISOString().split('T')[0],
      close: price,
      time: time
    };
  }

  /**
   * Validate and clean an entire dataset
   * Removes invalid points and ensures all values are numeric
   */
  function validateData(data) {
    if (!Array.isArray(data)) return [];
    
    const cleaned = [];
    for (const point of data) {
      const valid = validatePoint(point);
      if (valid) cleaned.push(valid);
    }
    
    console.log(`[ChartUtils] Validated ${data.length} → ${cleaned.length} points`);
    return cleaned;
  }

  /**
   * Ensure data is sorted by time in ascending order
   * @param {Array} data - Array of {date, close/price} objects
   * @returns {Array} Sorted array
   */
  function sortByTime(data) {
    return [...data].sort((a, b) => {
      const timeA = a.time || new Date(a.date).getTime();
      const timeB = b.time || new Date(b.date).getTime();
      return timeA - timeB;
    });
  }

  /**
   * Remove duplicate X values - keeps the LAST value for each unique X
   * This prevents vertical lines when multiple points share the same X
   * @param {Array} data - Array of data points
   * @param {string} xKey - Key for X value (default: 'date')
   * @returns {Array} Deduplicated array
   */
  function deduplicateByX(data, xKey = 'date') {
    const seen = new Map();
    
    // Process in order, keeping last occurrence
    for (const point of data) {
      const x = point[xKey];
      seen.set(x, point);
    }
    
    return Array.from(seen.values());
  }

  /**
   * Enforce monotonic X values - removes any out-of-order points
   * @param {Array} data - Sorted array of data points
   * @param {string} xKey - Key for X value
   * @returns {Array} Monotonic array
   */
  function enforceMonotonic(data, xKey = 'date') {
    if (data.length === 0) return [];
    
    const result = [data[0]];
    let lastX = data[0][xKey];
    
    for (let i = 1; i < data.length; i++) {
      const currentX = data[i][xKey];
      if (currentX > lastX) {
        result.push(data[i]);
        lastX = currentX;
      }
    }
    
    return result;
  }

  /**
   * Downsample data for display using LTTB algorithm (Largest-Triangle-Three-Buckets)
   * This preserves visual shape while reducing points
   * @param {Array} data - Array of {x, y} points
   * @param {number} targetPoints - Target number of points
   * @returns {Array} Downsampled array
   */
  function downsampleLTTB(data, targetPoints) {
    if (data.length <= targetPoints) return data;
    
    const sampled = [];
    const bucketSize = (data.length - 2) / (targetPoints - 2);
    
    // Always keep first point
    sampled.push(data[0]);
    
    for (let i = 0; i < targetPoints - 2; i++) {
      // Calculate bucket boundaries
      const bucketStart = Math.floor((i) * bucketSize) + 1;
      const bucketEnd = Math.floor((i + 1) * bucketSize) + 1;
      const nextBucketStart = Math.floor((i + 1) * bucketSize) + 1;
      const nextBucketEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, data.length);
      
      // Calculate average point in next bucket (for triangle calculation)
      let avgX = 0, avgY = 0;
      for (let j = nextBucketStart; j < nextBucketEnd; j++) {
        avgX += data[j].x;
        avgY += data[j].y;
      }
      avgX /= (nextBucketEnd - nextBucketStart);
      avgY /= (nextBucketEnd - nextBucketStart);
      
      // Find point in current bucket that creates largest triangle
      const prevPoint = sampled[sampled.length - 1];
      let maxArea = -1;
      let maxIndex = bucketStart;
      
      for (let j = bucketStart; j < bucketEnd; j++) {
        // Triangle area formula
        const area = Math.abs(
          (prevPoint.x - avgX) * (data[j].y - prevPoint.y) -
          (prevPoint.x - data[j].x) * (avgY - prevPoint.y)
        ) / 2;
        
        if (area > maxArea) {
          maxArea = area;
          maxIndex = j;
        }
      }
      
      sampled.push(data[maxIndex]);
    }
    
    // Always keep last point
    sampled.push(data[data.length - 1]);
    
    return sampled;
  }

  /**
   * Simple min-max downsampling (faster, preserves extremes)
   * Takes min and max from each bucket
   * @param {Array} data - Array of price data
   * @param {number} targetPoints - Target number of points
   * @returns {Array} Downsampled array
   */
  function downsampleMinMax(data, targetPoints) {
    if (data.length <= targetPoints) return data;
    
    const bucketSize = Math.ceil(data.length / (targetPoints / 2));
    const sampled = [];
    
    for (let i = 0; i < data.length; i += bucketSize) {
      const bucket = data.slice(i, Math.min(i + bucketSize, data.length));
      if (bucket.length === 0) continue;
      
      let min = bucket[0];
      let max = bucket[0];
      
      for (const point of bucket) {
        const price = point.close || point.price || point.y;
        if (price < (min.close || min.price || min.y)) min = point;
        if (price > (max.close || max.price || max.y)) max = point;
      }
      
      // Add in chronological order
      if (min !== max) {
        const minTime = min.time || new Date(min.date).getTime();
        const maxTime = max.time || new Date(max.date).getTime();
        if (minTime < maxTime) {
          sampled.push(min, max);
        } else {
          sampled.push(max, min);
        }
      } else {
        sampled.push(min);
      }
    }
    
    return sampled;
  }

  /**
   * Calculate padded Y domain to prevent fills from slamming against edges
   * @param {Array} prices - Array of price values
   * @param {number} padding - Padding factor (default 0.05 = 5%)
   * @returns {Object} {min, max} domain
   */
  function calculateYDomain(prices, padding = 0.05) {
    if (prices.length === 0) return { min: 0, max: 100 };
    
    let min = Infinity;
    let max = -Infinity;
    
    for (const p of prices) {
      if (p < min) min = p;
      if (p > max) max = p;
    }
    
    const range = max - min;
    const pad = range * padding;
    
    return {
      min: min - pad,
      max: max + pad
    };
  }

  /**
   * Prepare data for Chart.js rendering
   * Applies all fixes: validate, sort, dedupe, monotonic, downsample
   * Uses INDEX-BASED X values for maximum stability
   * @param {Array} rawData - Raw data array with {date, close/price} objects
   * @param {Object} options - Configuration options
   * @returns {Object} {labels, prices, domain, indices}
   */
  function prepareChartData(rawData, options = {}) {
    const {
      xKey = 'date',
      yKey = 'close',
      yKeyFallback = 'price',
      targetPoints = 200,
      useMinMaxDownsample = true,
      yPadding = 0.05,
      useIndexBasedX = true  // Force index-based X for stability
    } = options;

    if (!rawData || rawData.length === 0) {
      return { labels: [], prices: [], domain: { min: 0, max: 100 }, indices: [] };
    }

    // Step 0: Validate all data points (removes NaN, undefined, invalid)
    let processed = validateData(rawData);

    if (processed.length === 0) {
      console.warn('[ChartUtils] All data points invalid after validation');
      return { labels: [], prices: [], domain: { min: 0, max: 100 }, indices: [] };
    }

    // Step 1: Sort by time
    processed = sortByTime(processed);

    // Step 2: Deduplicate
    processed = deduplicateByX(processed, xKey);

    // Step 3: Enforce monotonic
    processed = enforceMonotonic(processed, xKey);

    // Step 4: Downsample if needed
    if (processed.length > targetPoints) {
      if (useMinMaxDownsample) {
        processed = downsampleMinMax(processed, targetPoints);
      } else {
        // Convert to {x, y} format for LTTB
        const xyData = processed.map(p => ({
          x: new Date(p[xKey]).getTime(),
          y: p[yKey] || p[yKeyFallback],
          original: p
        }));
        const downsampled = downsampleLTTB(xyData, targetPoints);
        processed = downsampled.map(d => d.original);
      }
    }

    // Extract prices (validated to be numeric)
    const prices = processed.map(p => {
      const val = p[yKey] || p[yKeyFallback];
      return isFinite(val) ? val : null;
    }).filter(v => v !== null);

    // Generate labels - use index-based for stability
    const labels = useIndexBasedX 
      ? processed.map((_, i) => i)
      : processed.map(p => p[xKey]);
    
    // Keep original dates for tooltips
    const dateLabels = processed.map(p => p[xKey]);

    // Calculate Y domain with safety checks
    const domain = calculateYDomain(prices, yPadding);

    // Debug info
    console.log(`[ChartUtils] Prepared: ${rawData.length} → ${processed.length} points, domain: [${domain.min.toFixed(2)}, ${domain.max.toFixed(2)}]`);

    return { 
      labels, 
      prices, 
      domain,
      dateLabels,  // Original dates for display
      indices: labels
    };
  }

  /**
   * Format date for chart labels
   * @param {string|number|Date} date - Date value
   * @param {string} format - Format type: 'short', 'medium', 'full'
   * @returns {string} Formatted date string
   */
  function formatDate(date, format = 'short') {
    const d = new Date(date);
    
    switch (format) {
      case 'short':
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      case 'medium':
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
      case 'full':
        return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      default:
        return d.toLocaleDateString();
    }
  }

  /**
   * Create optimal Chart.js configuration for price charts
   * @param {Object} data - Prepared chart data {labels, prices, domain, dateLabels}
   * @param {Object} options - Chart options
   * @returns {Object} Chart.js configuration object
   */
  function createChartConfig(data, options = {}) {
    const {
      color = '#FF2975',
      label = 'Price',
      showFill = true,
      fillOpacity = 0.12,  // Reduced from 0x20 (~12.5%) to prevent visual domination
      tension = 0.1,
      pointRadius = 0,
      borderWidth = 2
    } = options;

    // Use dateLabels for display if available
    const displayLabels = data.dateLabels 
      ? data.dateLabels.map(l => formatDate(l))
      : data.labels.map(l => typeof l === 'number' ? `#${l}` : formatDate(l));

    // Calculate fill opacity hex
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
          fill: showFill ? 'origin' : false,  // Fill from origin, not from min
          tension: tension,
          pointRadius: pointRadius,
          pointHoverRadius: 4,
          borderWidth: borderWidth,
          // Prevent vertical line drawing on hover
          spanGaps: false,  // Don't connect across gaps
          segment: {
            // Skip segments with missing data
            borderColor: ctx => {
              const p0 = ctx.p0.parsed.y;
              const p1 = ctx.p1.parsed.y;
              if (!isFinite(p0) || !isFinite(p1)) return 'transparent';
              return undefined;
            }
          }
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
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: '#12121A',
            borderColor: color,
            borderWidth: 1,
            titleFont: { family: 'VT323' },
            bodyFont: { family: 'VT323' },
            callbacks: {
              title: (items) => {
                // Show the actual date in tooltip
                const idx = items[0]?.dataIndex;
                if (data.dateLabels && data.dateLabels[idx]) {
                  return formatDate(data.dateLabels[idx], 'medium');
                }
                return items[0]?.label || '';
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
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 8
            }
          },
          y: {
            // Explicit domain prevents edge-slamming
            min: data.domain.min,
            max: data.domain.max,
            grid: { color: '#333344', drawBorder: false },
            ticks: { 
              color: '#888899', 
              font: { family: 'VT323' },
              callback: (value) => isFinite(value) ? '$' + value.toFixed(2) : ''
            }
          }
        },
        // Disable animations that might cause visual glitches
        animation: {
          duration: 300
        },
        // Segment styling to prevent vertical spikes
        elements: {
          line: {
            borderJoinStyle: 'round',
            borderCapStyle: 'round'
          }
        }
      }
    };
  }

  /**
   * Debug utility: check data for issues
   * @param {Array} data - Raw data array
   * @returns {Object} Diagnostic info
   */
  function diagnoseData(data) {
    const issues = [];
    
    if (!data || data.length === 0) {
      return { valid: false, issues: ['Empty data array'] };
    }

    // Check for duplicates
    const xValues = data.map(d => d.date || d.time);
    const uniqueX = new Set(xValues);
    if (uniqueX.size !== xValues.length) {
      const duplicateCount = xValues.length - uniqueX.size;
      issues.push(`${duplicateCount} duplicate X values found`);
    }

    // Check monotonicity
    let nonMonotonic = 0;
    for (let i = 1; i < data.length; i++) {
      const prevX = data[i-1].date || data[i-1].time;
      const currX = data[i].date || data[i].time;
      if (new Date(currX) <= new Date(prevX)) {
        nonMonotonic++;
      }
    }
    if (nonMonotonic > 0) {
      issues.push(`${nonMonotonic} non-monotonic X values found`);
    }

    // Check for null/undefined/NaN prices
    const invalidPrices = data.filter(d => {
      const p = d.close ?? d.price;
      return p == null || !isFinite(p);
    }).length;
    if (invalidPrices > 0) {
      issues.push(`${invalidPrices} invalid price values (null/NaN/undefined)`);
    }

    // Check data density
    if (data.length > 500) {
      issues.push(`High density: ${data.length} points (consider downsampling)`);
    }

    return {
      valid: issues.length === 0,
      issues: issues,
      stats: {
        totalPoints: data.length,
        uniqueXValues: uniqueX.size,
        invalidPrices: invalidPrices,
        nonMonotonic: nonMonotonic
      }
    };
  }

  /**
   * Create MACD mini-chart configuration
   * For use in ship cards - shows MACD line, signal line, and histogram
   * @param {Array} macdData - Array of {macd, signal, histogram} values
   * @param {Object} options - Chart options
   * @returns {Object} Chart.js configuration
   */
  function createMACDConfig(macdData, options = {}) {
    const {
      height = 40,
      showHistogram = true,
      macdColor = '#FF2975',
      signalColor = '#00FFFF',
      histPosColor = '#39FF14',
      histNegColor = '#FF0040'
    } = options;

    // Validate and extract data
    const macdLine = [];
    const signalLine = [];
    const histogram = [];
    
    for (const d of macdData) {
      const m = parseFloat(d.macd ?? d.MACD);
      const s = parseFloat(d.signal ?? d.signalLine ?? d.Signal);
      const h = parseFloat(d.histogram ?? d.Histogram ?? (m - s));
      
      macdLine.push(isFinite(m) ? m : null);
      signalLine.push(isFinite(s) ? s : null);
      histogram.push(isFinite(h) ? h : null);
    }

    // Calculate domain
    const allValues = [...macdLine, ...signalLine, ...histogram].filter(v => v !== null);
    const absMax = Math.max(...allValues.map(Math.abs), 0.01);
    const domain = { min: -absMax * 1.1, max: absMax * 1.1 };

    const datasets = [
      {
        label: 'MACD',
        data: macdLine,
        borderColor: macdColor,
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.2,
        fill: false,
        order: 1
      },
      {
        label: 'Signal',
        data: signalLine,
        borderColor: signalColor,
        borderWidth: 1,
        pointRadius: 0,
        tension: 0.2,
        fill: false,
        borderDash: [2, 2],
        order: 2
      }
    ];

    if (showHistogram) {
      datasets.push({
        label: 'Histogram',
        data: histogram,
        type: 'bar',
        backgroundColor: histogram.map(h => h >= 0 ? histPosColor + '80' : histNegColor + '80'),
        borderWidth: 0,
        barPercentage: 0.8,
        categoryPercentage: 1.0,
        order: 3
      });
    }

    return {
      type: 'line',
      data: {
        labels: macdData.map((_, i) => i),
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        },
        scales: {
          x: {
            display: false,
            grid: { display: false }
          },
          y: {
            display: false,
            min: domain.min,
            max: domain.max,
            grid: { display: false }
          }
        },
        animation: false,
        elements: {
          line: { borderJoinStyle: 'round' }
        }
      }
    };
  }

  /**
   * Detect MACD crossover signals
   * @param {Array} macdData - Array of {macd, signal} values
   * @returns {Array} Array of {index, type: 'bullish'|'bearish'} crossovers
   */
  function detectMACDCrossovers(macdData) {
    const crossovers = [];
    
    for (let i = 1; i < macdData.length; i++) {
      const prevM = macdData[i-1].macd ?? macdData[i-1].MACD;
      const prevS = macdData[i-1].signal ?? macdData[i-1].signalLine;
      const currM = macdData[i].macd ?? macdData[i].MACD;
      const currS = macdData[i].signal ?? macdData[i].signalLine;
      
      if (!isFinite(prevM) || !isFinite(prevS) || !isFinite(currM) || !isFinite(currS)) {
        continue;
      }
      
      const prevDiff = prevM - prevS;
      const currDiff = currM - currS;
      
      // Bullish crossover: MACD crosses above signal
      if (prevDiff <= 0 && currDiff > 0) {
        crossovers.push({ index: i, type: 'bullish' });
      }
      // Bearish crossover: MACD crosses below signal
      else if (prevDiff >= 0 && currDiff < 0) {
        crossovers.push({ index: i, type: 'bearish' });
      }
    }
    
    return crossovers;
  }

  // Public API
  return {
    // Data validation
    validateData,
    validatePoint,
    
    // Data processing
    sortByTime,
    deduplicateByX,
    enforceMonotonic,
    downsampleLTTB,
    downsampleMinMax,
    calculateYDomain,
    prepareChartData,
    
    // Chart creation
    formatDate,
    createChartConfig,
    createMACDConfig,
    
    // MACD utilities
    detectMACDCrossovers,
    
    // Diagnostics
    diagnoseData
  };

})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChartUtils;
}
