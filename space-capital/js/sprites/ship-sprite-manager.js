/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SPACE CAPITAL - Ship Sprite Manager (Unified Facade)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * SINGLE API for all ship rendering across the application.
 * 
 * UI components call this facade. They never touch:
 * - PixelShipEngine directly
 * - WatercolorEngine directly  
 * - TelemetryAdapter directly
 * 
 * This facade:
 * 1. Gets telemetry from TelemetryAdapter (market-derived data)
 * 2. Renders via PixelShipEngine (procedural generation)
 * 3. Caches results for performance
 * 4. Provides consistent API regardless of rendering backend
 * 
 * Usage:
 *   await ShipSprites.renderToCanvas(canvas, 'RKLB', 128);
 *   const info = await ShipSprites.getShipInfo('RKLB');
 * 
 * Dependencies (load in order):
 *   1. seed.js
 *   2. watercolor-engine.js
 *   3. sprite-upgrades.js (optional)
 *   4. pixel-ship-engine.js
 *   5. shippix-bootstrap.js
 *   6. telemetry.js
 *   7. telemetry-adapter.js
 *   8. ship-sprite-manager.js (this file)
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════

  // Sprite cache (ticker:size → ImageBitmap)
  const _cache = new Map();
  const MAX_CACHE_SIZE = 100;

  // Color overrides from Paint Bay
  const _colorOverrides = new Map();

  // Engine reference (set on init)
  let _engine = null;
  let _ready = false;

  // Configuration
  const CONFIG = {
    defaultSize: 128,
    enableCache: true,
    animationFps: 12,
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Initialize the sprite manager
   * Waits for PixelShipEngine to be ready
   */
  async function init() {
    if (_ready) return true;

    try {
      // Wait for ShipPixReady (from shippix-bootstrap.js)
      if (global.ShipPixReady) {
        _engine = await global.ShipPixReady;
      } else if (global.ShipPix) {
        _engine = global.ShipPix;
      } else if (typeof PixelShipEngine !== 'undefined') {
        // Fallback: create engine directly
        const wcEngine = typeof WatercolorEngine !== 'undefined' 
          ? new WatercolorEngine() 
          : null;
        _engine = new PixelShipEngine({ watercolorEngine: wcEngine });
      }

      if (!_engine) {
        console.warn('[ShipSprites] Engine not available');
        return false;
      }

      _ready = true;
      console.log('[ShipSprites] Initialized with procedural engine');
      return true;
    } catch (e) {
      console.error('[ShipSprites] Initialization failed:', e);
      return false;
    }
  }

  /**
   * Ensure engine is ready before any operation
   */
  async function ensureReady() {
    if (!_ready) {
      await init();
    }
    return _ready;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CORE API
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Render a ship to a canvas element
   * THIS IS THE MAIN API - UI should call this
   * 
   * @param {HTMLCanvasElement} canvas - Target canvas element
   * @param {string} ticker - Stock ticker symbol
   * @param {number} size - Canvas size (default 128)
   * @param {object} options - Additional options
   * @returns {Promise<boolean>} - True if render succeeded
   */
  async function renderToCanvas(canvas, ticker, size = CONFIG.defaultSize, options = {}) {
    if (!canvas || !canvas.getContext) {
      console.warn('[ShipSprites] Invalid canvas for', ticker);
      return false;
    }

    if (!await ensureReady()) {
      console.warn('[ShipSprites] Engine not ready, cannot render', ticker);
      return false;
    }

    try {
      // Ensure canvas is sized correctly
      if (canvas.width !== size || canvas.height !== size) {
        canvas.width = size;
        canvas.height = size;
      }

      // Get telemetry (market-derived data)
      const telemetry = _getTelemetry(ticker, options);

      // Render via engine
      _engine.renderToCanvas(canvas, ticker, telemetry);

      // Set data attributes for debugging
      canvas.dataset.ticker = ticker;
      canvas.dataset.rendered = Date.now();

      return true;
    } catch (e) {
      console.error('[ShipSprites] Render failed for', ticker, e);
      return false;
    }
  }

  /**
   * Get a sprite as a data URL
   * Useful for contexts that need an image src
   * 
   * @param {string} ticker - Stock ticker
   * @param {object} stats - Optional stats (for upgrade calculation)
   * @param {object} options - Additional options
   * @returns {Promise<{src, ticker, width, height, upgrades, powerLevel, summary}>}
   */
  async function getSprite(ticker, stats = {}, options = {}) {
    if (!await ensureReady()) {
      return _getFallbackSprite(ticker);
    }

    const size = options.size || CONFIG.defaultSize;
    const telemetry = _getTelemetry(ticker, { stats, ...options });
    
    // Check cache
    const cacheKey = _getCacheKey(ticker, size, telemetry);
    if (CONFIG.enableCache && !options.forceRefresh && _cache.has(cacheKey)) {
      return _cache.get(cacheKey);
    }

    try {
      // Render to get canvas
      const canvas = _engine.renderShip(ticker, telemetry, size);
      
      // Get ship info
      const info = _engine.getShipInfo(ticker, telemetry);
      
      // Build result (legacy-compatible format)
      const result = {
        src: canvas.toDataURL('image/png'),
        canvas: canvas,
        ticker: ticker,
        width: size,
        height: size,
        upgrades: info.upgrades || {},
        powerLevel: _calculatePowerLevel(info.upgrades),
        summary: _getUpgradeSummary(info.upgrades),
        shipName: info.shipName,
        shipClass: info.shipClass,
        key: cacheKey,
      };

      // Cache result
      if (CONFIG.enableCache) {
        _setCache(cacheKey, result);
      }

      return result;
    } catch (e) {
      console.error('[ShipSprites] getSprite failed for', ticker, e);
      return _getFallbackSprite(ticker);
    }
  }

  /**
   * Get sprite as an Image element
   * 
   * @param {string} ticker - Stock ticker
   * @param {object} stats - Optional stats
   * @param {object} options - Additional options
   * @returns {Promise<HTMLImageElement>}
   */
  async function getSpriteImage(ticker, stats = {}, options = {}) {
    const sprite = await getSprite(ticker, stats, options);
    
    const img = new Image();
    img.src = sprite.src;
    img.dataset.ticker = ticker;
    img.dataset.powerLevel = sprite.powerLevel;
    
    return new Promise((resolve, reject) => {
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load sprite for ${ticker}`));
    });
  }

  /**
   * Update a sprite in-place when stats change
   * 
   * @param {string} ticker - Stock ticker
   * @param {object} stats - New stats
   * @param {HTMLElement} element - Canvas or img element to update
   * @returns {Promise<object>} - Updated sprite info
   */
  async function updateSprite(ticker, stats, element) {
    if (element instanceof HTMLCanvasElement) {
      await renderToCanvas(element, ticker, element.width, { stats, forceRefresh: true });
      return { success: true, ticker };
    }
    
    if (element instanceof HTMLImageElement) {
      const sprite = await getSprite(ticker, stats, { forceRefresh: true });
      element.src = sprite.src;
      element.dataset.powerLevel = sprite.powerLevel;
      return sprite;
    }

    console.warn('[ShipSprites] updateSprite: invalid element type');
    return null;
  }

  /**
   * Get ship information without rendering
   * 
   * @param {string} ticker - Stock ticker
   * @param {object} options - Additional options
   * @returns {Promise<object>} - Ship info (name, class, upgrades)
   */
  async function getShipInfo(ticker, options = {}) {
    if (!await ensureReady()) {
      return { ticker, shipName: 'Unknown', shipClass: 'unknown', upgrades: {} };
    }

    const telemetry = _getTelemetry(ticker, options);
    return _engine.getShipInfo(ticker, telemetry);
  }

  /**
   * Get sprites for all ships in a fleet
   * 
   * @param {string[]} tickers - Array of ticker symbols
   * @param {object} statsMap - Map of ticker → stats
   * @returns {Promise<object>} - Map of ticker → sprite
   */
  async function getFleetSprites(tickers, statsMap = {}) {
    const sprites = {};
    
    await Promise.all(tickers.map(async (ticker) => {
      sprites[ticker] = await getSprite(ticker, statsMap[ticker] || {});
    }));

    return sprites;
  }

  /**
   * Render fleet to multiple canvases
   * 
   * @param {object} canvasMap - Map of ticker → canvas element
   * @param {number} size - Size for all canvases
   * @param {object} options - Additional options
   */
  async function renderFleet(canvasMap, size = CONFIG.defaultSize, options = {}) {
    const tickers = Object.keys(canvasMap);
    
    await Promise.all(tickers.map(async (ticker) => {
      const canvas = canvasMap[ticker];
      if (canvas) {
        await renderToCanvas(canvas, ticker, size, options);
      }
    }));
  }

  /**
   * Create an animated sprite (returns canvas with animation loop)
   * 
   * @param {string} ticker - Stock ticker
   * @param {number} size - Canvas size
   * @param {object} options - Animation options
   * @returns {Promise<HTMLCanvasElement>} - Animated canvas with stop/start methods
   */
  async function createAnimatedSprite(ticker, size = CONFIG.defaultSize, options = {}) {
    if (!await ensureReady()) {
      return null;
    }

    const telemetry = _getTelemetry(ticker, options);
    return _engine.createAnimatedSprite(ticker, telemetry, size);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COLOR / LIVERY API
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Apply custom colors from Paint Bay
   * 
   * @param {string} ticker - Stock ticker
   * @param {object} colors - Color overrides
   */
  function setColorOverride(ticker, colors) {
    _colorOverrides.set(ticker, colors);
    _clearCacheForTicker(ticker);
  }

  /**
   * Clear color override for a ticker
   */
  function clearColorOverride(ticker) {
    _colorOverrides.delete(ticker);
    _clearCacheForTicker(ticker);
  }

  /**
   * Get current color override for a ticker
   */
  function getColorOverride(ticker) {
    return _colorOverrides.get(ticker);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CACHE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Clear all caches
   */
  function clearAllCaches() {
    _cache.clear();
    if (_engine?.clearCache) {
      _engine.clearCache();
    }
    console.log('[ShipSprites] Caches cleared');
  }

  /**
   * Clear cache for a specific ticker
   */
  function _clearCacheForTicker(ticker) {
    const keysToDelete = [];
    _cache.forEach((_, key) => {
      if (key.startsWith(ticker + ':')) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => _cache.delete(key));
  }

  /**
   * Get cache key for a sprite
   */
  function _getCacheKey(ticker, size, telemetry) {
    const state = telemetry.signalState || 'neutral';
    const thrust = Math.round((telemetry.thrust || 0.5) * 10);
    return `${ticker}:${size}:${state}:${thrust}`;
  }

  /**
   * Set cache entry with LRU eviction
   */
  function _setCache(key, value) {
    if (_cache.size >= MAX_CACHE_SIZE) {
      const oldestKey = _cache.keys().next().value;
      _cache.delete(oldestKey);
    }
    _cache.set(key, value);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get telemetry for a ticker from available sources
   */
  function _getTelemetry(ticker, options = {}) {
    // Use TelemetryAdapter if available
    if (global.TelemetryAdapter) {
      return global.TelemetryAdapter.getTelemetry(ticker, options);
    }

    // Fallback: use buildShipTelemetry from bootstrap
    if (global.buildShipTelemetry && options.data) {
      return global.buildShipTelemetry(options.data);
    }

    // Fallback: use statsToTelemetry from bootstrap
    if (global.statsToTelemetry && options.stats) {
      return global.statsToTelemetry(options.stats);
    }

    // Last resort: defaults
    return {
      regime: 'RANGE',
      signalState: 'neutral',
      thrust: 0.5,
      damage: 0,
      momentum: 0,
      jitter: 0.2,
      glow: 0.5,
    };
  }

  /**
   * Calculate power level from upgrades (0-100)
   */
  function _calculatePowerLevel(upgrades) {
    if (!upgrades) return 50;
    
    let total = 0;
    let count = 0;
    
    const weights = {
      engines: 1.5,
      wings: 1.2,
      weapons: 1.3,
      armor: 1.0,
      antenna: 0.8,
      shield: 1.4
    };

    for (const [slot, data] of Object.entries(upgrades)) {
      if (!data) continue;
      const weight = weights[slot] || 1.0;
      const value = data.normalizedValue ?? data.thrust ?? 0.5;
      total += value * weight;
      count += weight;
    }

    return count > 0 ? Math.round((total / count) * 100) : 50;
  }

  /**
   * Get human-readable upgrade summary
   */
  function _getUpgradeSummary(upgrades) {
    if (!upgrades) return 'Stock Configuration';
    
    const parts = [];
    for (const [slot, data] of Object.entries(upgrades)) {
      if (data?.label) {
        parts.push(`${slot}: ${data.label}`);
      }
    }
    
    return parts.length > 0 ? parts.join(', ') : 'Stock Configuration';
  }

  /**
   * Get fallback sprite when engine unavailable
   */
  function _getFallbackSprite(ticker) {
    return {
      src: '',
      canvas: null,
      ticker: ticker,
      width: CONFIG.defaultSize,
      height: CONFIG.defaultSize,
      upgrades: {},
      powerLevel: 50,
      summary: 'Stock Configuration',
      shipName: 'Unknown Vessel',
      shipClass: 'unknown',
      key: `${ticker}:fallback`,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT LISTENERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Listen for Paint Bay color changes
   */
  function _initEventListeners() {
    if (typeof document === 'undefined') return;

    document.addEventListener('paintbay:apply', (e) => {
      const { ticker, colors, palette } = e.detail || {};
      if (ticker && colors) {
        setColorOverride(ticker, { colors, palette });
      }
    });

    document.addEventListener('paintbay:reset', (e) => {
      const { ticker } = e.detail || {};
      if (ticker) {
        clearColorOverride(ticker);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  // Auto-init on load
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        _initEventListeners();
        init();
      });
    } else {
      _initEventListeners();
      init();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  global.ShipSprites = {
    // Core rendering (MAIN API)
    renderToCanvas,
    renderFleet,
    createAnimatedSprite,

    // Legacy-compatible sprite API
    getSprite,
    getSpriteImage,
    updateSprite,
    getFleetSprites,

    // Ship info
    getShipInfo,

    // Color/livery
    setColorOverride,
    clearColorOverride,
    getColorOverride,

    // Cache management
    clearAllCaches,

    // Initialization
    init,
    ensureReady,

    // Config (read-only)
    CONFIG: { ...CONFIG },
  };

  console.log('[ShipSprites] Module loaded');

})(typeof window !== 'undefined' ? window : global);
