/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SHIP ANIMATOR
 * Telemetry-driven sprite animation system for fleet cards
 * 
 * States:
 *   idle    - Default animation (always playing)
 *   special - Triggered by: hover, strong P&L (±5%), high activity
 *   
 * Effects (CSS classes added based on telemetry):
 *   .ship--volatile    - High volatility jitter
 *   .ship--damaged     - Low hull/trend damage overlay
 *   .ship--thrust      - Strong momentum engine boost
 *   .ship--bull        - Bullish signal state
 *   .ship--bear        - Bearish signal state
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────
  // CONFIGURATION
  // ─────────────────────────────────────────────────────────────────────────
  
  // Path relative to html/space-capital.html
  const GIF_BASE = '../assets/ships/animated/gifs/';
  const FALLBACK_TICKER = 'Unclaimed';
  
  // Available tickers with GIFs
  const AVAILABLE_TICKERS = [
    'ACHR', 'ASTS', 'BKSY', 'COHR', 'EVEX', 'GE', 'GME', 
    'JOBY', 'KTOS', 'LHX', 'LUNR', 'PL', 'RDW', 'RKLB', 'RTX', 'Unclaimed'
  ];
  
  // Thresholds for animation state changes
  const THRESHOLDS = {
    strongPnl: 5,           // ±5% triggers special animation
    highVolatility: 0.6,    // >60% volatility adds jitter
    lowHull: 0.3,           // <30% trend adds damage effect
    highThrust: 0.6,        // >60% momentum adds thrust effect
    highActivity: 0.7       // >70% activity can trigger special
  };

  // ─────────────────────────────────────────────────────────────────────────
  // UTILITY FUNCTIONS
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Build URL for a ship animation GIF
   */
  function getGifUrl(ticker, animationType) {
    const t = (ticker || FALLBACK_TICKER).toUpperCase();
    const safeTicker = AVAILABLE_TICKERS.includes(t) ? t : FALLBACK_TICKER;
    return `${GIF_BASE}${safeTicker}_${animationType}.gif`;
  }
  
  /**
   * Determine which animation type to use based on telemetry
   */
  function chooseAnimationType(telemetry) {
    const { pnlPct, activity, isHovered } = telemetry;
    
    // Hover always triggers special
    if (isHovered) return 'special';
    
    // Strong P&L (positive or negative) triggers special
    if (typeof pnlPct === 'number') {
      if (Math.abs(pnlPct) >= THRESHOLDS.strongPnl) return 'special';
    }
    
    // High activity can trigger special
    if (typeof activity === 'number' && activity >= THRESHOLDS.highActivity) {
      return 'special';
    }
    
    return 'idle';
  }
  
  /**
   * Determine CSS effect classes based on telemetry
   */
  function getEffectClasses(telemetry) {
    const classes = [];
    const { volatility, trend, momentum, signalState, damage } = telemetry;
    
    // High volatility = jitter effect
    if (typeof volatility === 'number' && volatility > THRESHOLDS.highVolatility) {
      classes.push('ship--volatile');
    }
    
    // Low trend or high damage = damage overlay
    if ((typeof trend === 'number' && trend < -0.3) || 
        (typeof damage === 'number' && damage > 0.2)) {
      classes.push('ship--damaged');
    }
    
    // High momentum = thrust effect
    if (typeof momentum === 'number' && Math.abs(momentum) > THRESHOLDS.highThrust) {
      classes.push('ship--thrust');
    }
    
    // Signal state classes
    if (signalState === 'bull') classes.push('ship--bull');
    if (signalState === 'bear') classes.push('ship--bear');
    
    return classes;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SPRITE CONTROLLER
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Set the sprite source and animation type
   */
  function setSprite(img, ticker, animationType) {
    const url = getGifUrl(ticker, animationType);
    
    // Skip if already showing this animation
    if (img.dataset.currentAnim === animationType && img.src.includes(url)) {
      return;
    }
    
    img.dataset.currentAnim = animationType;
    img.src = url;
    
    // Fallback on error
    img.onerror = () => {
      img.onerror = null;
      img.src = getGifUrl(FALLBACK_TICKER, animationType);
    };
  }
  
  /**
   * Update effect classes on the sprite wrapper
   */
  function updateEffects(wrapper, effectClasses) {
    // Remove all existing effect classes
    wrapper.classList.remove('ship--volatile', 'ship--damaged', 'ship--thrust', 'ship--bull', 'ship--bear');
    
    // Add new effect classes
    effectClasses.forEach(cls => wrapper.classList.add(cls));
  }
  
  /**
   * Wire hover events to a sprite
   */
  function wireHoverEvents(img, ticker, getTelemetry) {
    if (img.dataset.hoverWired) return;
    
    let hoverTimeout = null;
    
    img.addEventListener('mouseenter', () => {
      clearTimeout(hoverTimeout);
      setSprite(img, ticker, 'special');
    });
    
    img.addEventListener('mouseleave', () => {
      clearTimeout(hoverTimeout);
      hoverTimeout = setTimeout(() => {
        // Return to telemetry-determined state
        const telemetry = getTelemetry ? getTelemetry(ticker) : {};
        const animType = chooseAnimationType({ ...telemetry, isHovered: false });
        setSprite(img, ticker, animType);
      }, 150);
    });
    
    img.dataset.hoverWired = '1';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────
  
  const ShipAnimator = {
    /**
     * Hydrate all ship sprites on the page
     * @param {Function} getTelemetryForTicker - Returns telemetry object for a ticker
     *   Expected shape: { pnlPct, volatility, trend, momentum, activity, signalState, damage }
     */
    hydrateShipSprites(getTelemetryForTicker) {
      document.querySelectorAll('.ship-sprite-wrap').forEach(wrapper => {
        const img = wrapper.querySelector('img.ship-sprite-img');
        if (!img) return;
        
        const ticker = img.dataset.ticker;
        if (!ticker) return;
        
        // Get telemetry data
        const telemetry = getTelemetryForTicker ? getTelemetryForTicker(ticker) : {};
        
        // Determine animation and effects
        const animType = chooseAnimationType(telemetry);
        const effectClasses = getEffectClasses(telemetry);
        
        // Apply
        setSprite(img, ticker, animType);
        updateEffects(wrapper, effectClasses);
        
        // Wire hover if not already done
        wireHoverEvents(img, ticker, getTelemetryForTicker);
      });
    },
    
    /**
     * Update a single ship sprite
     * @param {string} ticker - The ticker symbol
     * @param {Object} telemetry - Telemetry data for the ship
     */
    updateShip(ticker, telemetry) {
      const wrapper = document.querySelector(`.ship-sprite-wrap [data-ticker="${ticker}"]`)?.closest('.ship-sprite-wrap');
      if (!wrapper) return;
      
      const img = wrapper.querySelector('img.ship-sprite-img');
      if (!img) return;
      
      const animType = chooseAnimationType(telemetry);
      const effectClasses = getEffectClasses(telemetry);
      
      setSprite(img, ticker, animType);
      updateEffects(wrapper, effectClasses);
    },
    
    /**
     * Force a specific animation on a ship
     * @param {string} ticker - The ticker symbol
     * @param {string} animationType - 'idle' or 'special'
     */
    forceAnimation(ticker, animationType) {
      const img = document.querySelector(`img.ship-sprite-img[data-ticker="${ticker}"]`);
      if (img) {
        setSprite(img, ticker, animationType);
      }
    },
    
    /**
     * Get the GIF URL for a ticker
     * @param {string} ticker - The ticker symbol
     * @param {string} animationType - 'idle' or 'special'
     * @returns {string} The URL to the GIF
     */
    getGifUrl,
    
    /**
     * Check if a ticker has available animations
     * @param {string} ticker - The ticker symbol
     * @returns {boolean}
     */
    hasAnimations(ticker) {
      return AVAILABLE_TICKERS.includes((ticker || '').toUpperCase());
    },
    
    /**
     * Get list of available tickers
     * @returns {string[]}
     */
    getAvailableTickers() {
      return [...AVAILABLE_TICKERS];
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // GLOBAL EXPOSURE
  // ─────────────────────────────────────────────────────────────────────────
  
  window.ShipAnimator = ShipAnimator;
  
  console.log('[ShipAnimator] Loaded with', AVAILABLE_TICKERS.length, 'tickers');

})();
