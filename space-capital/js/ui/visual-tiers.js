/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISUAL TIER SYSTEM
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Converts numeric telemetry values to Roman numeral tiers (I-X)
 * for visual display. Replaces charts with "felt" indicators.
 * 
 * Tier mapping:
 *   0-10%  → I
 *   11-20% → II
 *   21-30% → III
 *   31-40% → IV
 *   41-50% → V
 *   51-60% → VI
 *   61-70% → VII
 *   71-80% → VIII
 *   81-90% → IX
 *   91-100% → X
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';

  const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  
  /**
   * Convert a normalized value (0-1) to a tier (1-10)
   * @param {number} value - Value between 0 and 1
   * @returns {number} Tier between 1 and 10
   */
  function valueToTier(value) {
    const clamped = Math.max(0, Math.min(1, value));
    const tier = Math.ceil(clamped * 10);
    return Math.max(1, tier); // Minimum tier 1
  }

  /**
   * Get Roman numeral for a tier
   * @param {number} tier - Tier between 1 and 10
   * @returns {string} Roman numeral
   */
  function tierToRoman(tier) {
    const index = Math.max(0, Math.min(9, tier - 1));
    return ROMAN_NUMERALS[index];
  }

  /**
   * Convert a value directly to Roman numeral
   * @param {number} value - Value between 0 and 1
   * @returns {string} Roman numeral
   */
  function valueToRoman(value) {
    return tierToRoman(valueToTier(value));
  }

  /**
   * Create a tier badge element
   * @param {string} label - Label text (e.g., "VOLUME")
   * @param {number} value - Value between 0 and 1
   * @returns {HTMLElement} Tier badge element
   */
  function createTierBadge(label, value) {
    const tier = valueToTier(value);
    const roman = tierToRoman(tier);
    
    const badge = document.createElement('div');
    badge.className = 'tier-badge';
    badge.dataset.tier = roman;
    badge.innerHTML = `
      <span class="tier-badge-label">${label}</span>
      <span class="tier-badge-value">${roman}</span>
    `;
    return badge;
  }

  /**
   * Create a tier indicator (bar chart style)
   * @param {number} value - Value between 0 and 1
   * @returns {HTMLElement} Tier indicator element
   */
  function createTierIndicator(value) {
    const tier = valueToTier(value);
    const roman = tierToRoman(tier);
    
    const indicator = document.createElement('div');
    indicator.className = 'tier-indicator';
    indicator.dataset.tier = roman;
    
    // Create 10 bars
    for (let i = 1; i <= 10; i++) {
      const bar = document.createElement('div');
      bar.className = 'tier-bar';
      if (i <= tier) {
        bar.classList.add('filled');
      }
      indicator.appendChild(bar);
    }
    
    return indicator;
  }

  /**
   * Create a status readout with tier
   * @param {string} label - Label text
   * @param {number} value - Value between 0 and 1
   * @returns {HTMLElement} Status readout element
   */
  function createStatusReadout(label, value) {
    const tier = valueToTier(value);
    const roman = tierToRoman(tier);
    
    const readout = document.createElement('div');
    readout.className = 'status-readout';
    readout.innerHTML = `
      <span class="status-readout-label">${label}</span>
      <span class="status-readout-tier" data-tier="${roman}">${roman}</span>
    `;
    
    // Add indicator
    readout.appendChild(createTierIndicator(value));
    
    return readout;
  }

  /**
   * Create a telemetry cell
   * @param {string} label - Label text
   * @param {number} value - Value between 0 and 1
   * @returns {HTMLElement} Telemetry cell element
   */
  function createTelemetryCell(label, value) {
    const tier = valueToTier(value);
    const roman = tierToRoman(tier);
    
    const cell = document.createElement('div');
    cell.className = 'telemetry-cell';
    cell.dataset.tier = roman;
    cell.innerHTML = `
      <span class="telemetry-cell-label">${label}</span>
      <span class="telemetry-cell-value" style="color: var(--tier-color-${tier}, currentColor)">${roman}</span>
    `;
    return cell;
  }

  /**
   * Update an existing tier badge
   * @param {HTMLElement} badge - Existing badge element
   * @param {number} value - New value between 0 and 1
   */
  function updateTierBadge(badge, value) {
    const tier = valueToTier(value);
    const roman = tierToRoman(tier);
    
    badge.dataset.tier = roman;
    const valueEl = badge.querySelector('.tier-badge-value');
    if (valueEl) {
      valueEl.textContent = roman;
    }
  }

  /**
   * Update an existing tier indicator
   * @param {HTMLElement} indicator - Existing indicator element
   * @param {number} value - New value between 0 and 1
   */
  function updateTierIndicator(indicator, value) {
    const tier = valueToTier(value);
    const roman = tierToRoman(tier);
    
    indicator.dataset.tier = roman;
    const bars = indicator.querySelectorAll('.tier-bar');
    bars.forEach((bar, i) => {
      bar.classList.toggle('filled', i < tier);
    });
  }

  /**
   * Convert telemetry object to tier display
   * @param {Object} telemetry - Telemetry object with trend, momentum, volatility, activity
   * @returns {Object} Object with tier values
   */
  function telemetryToTiers(telemetry) {
    return {
      trend: {
        value: (telemetry.trend + 1) / 2, // Convert -1 to 1 range to 0 to 1
        tier: valueToTier((telemetry.trend + 1) / 2),
        roman: valueToRoman((telemetry.trend + 1) / 2)
      },
      momentum: {
        value: (telemetry.momentum + 1) / 2,
        tier: valueToTier((telemetry.momentum + 1) / 2),
        roman: valueToRoman((telemetry.momentum + 1) / 2)
      },
      volatility: {
        value: telemetry.volatility,
        tier: valueToTier(telemetry.volatility),
        roman: valueToRoman(telemetry.volatility)
      },
      activity: {
        value: telemetry.activity,
        tier: valueToTier(telemetry.activity),
        roman: valueToRoman(telemetry.activity)
      }
    };
  }

  /**
   * Get semantic state from telemetry tiers
   * @param {Object} tiers - Tiers object from telemetryToTiers
   * @returns {string} Semantic state: 'bullish', 'bearish', 'volatile', 'neutral'
   */
  function getSemanticState(tiers) {
    // High volatility overrides everything
    if (tiers.volatility.tier >= 8) {
      return 'volatile';
    }
    
    // Strong trend direction
    if (tiers.trend.tier >= 7 && tiers.momentum.tier >= 6) {
      return 'bullish';
    }
    
    if (tiers.trend.tier <= 3 && tiers.momentum.tier <= 4) {
      return 'bearish';
    }
    
    return 'neutral';
  }

  /**
   * Apply semantic state to body
   * @param {string} state - Semantic state
   */
  function applySemanticState(state) {
    const body = document.body;
    
    // Clear existing regime classes
    body.classList.remove('regime-bullish', 'regime-bearish', 'regime-volatile', 'regime-neutral');
    
    // Apply new state
    body.classList.add(`regime-${state}`);
  }

  /**
   * Create a complete telemetry grid
   * @param {Object} telemetry - Telemetry object
   * @returns {HTMLElement} Telemetry grid element
   */
  function createTelemetryGrid(telemetry) {
    const tiers = telemetryToTiers(telemetry);
    
    const grid = document.createElement('div');
    grid.className = 'telemetry-grid';
    
    const labels = {
      trend: 'TRD',
      momentum: 'MOM',
      volatility: 'VOL',
      activity: 'ACT'
    };
    
    Object.keys(labels).forEach(key => {
      if (tiers[key]) {
        const cell = createTelemetryCell(labels[key], tiers[key].value);
        grid.appendChild(cell);
      }
    });
    
    return grid;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  window.VisualTiers = {
    // Conversion functions
    valueToTier,
    tierToRoman,
    valueToRoman,
    telemetryToTiers,
    
    // Element creation
    createTierBadge,
    createTierIndicator,
    createStatusReadout,
    createTelemetryCell,
    createTelemetryGrid,
    
    // Element updates
    updateTierBadge,
    updateTierIndicator,
    
    // Semantic states
    getSemanticState,
    applySemanticState,
    
    // Constants
    ROMAN_NUMERALS
  };

})();
