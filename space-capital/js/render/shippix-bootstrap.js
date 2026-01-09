/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SPACE CAPITAL - Ship Pixel Bootstrap v2.0
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Initializes the Mold-based PixelShipEngine and exposes it globally.
 * This is the single entry point for all ship rendering.
 * 
 * Rendering priority:
 *   1. MoldComposer (high-quality sprite molds with palette tinting)
 *   2. BlockRenderer (procedural fallback)
 * 
 * Load Order (IMPORTANT):
 *   <script src="js/render/seed.js"></script>
 *   <script src="js/lib/watercolor/watercolor-engine.js"></script>
 *   <script src="js/render/mold-composer.js"></script>
 *   <script src="js/render/pixel-ship-engine.js"></script>
 *   <script src="js/render/shippix-bootstrap.js"></script>
 * 
 * Exposes:
 *   - window.ShipPix: The initialized engine instance
 *   - window.ShipPixReady: Promise that resolves when engine is ready
 *   - window.renderShipToCanvas(canvas, ticker, telemetry, size): Helper
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function(global) {
  'use strict';

  // Prevent double initialization
  if (global.ShipPixReady) {
    console.log('[ShipPix] Already initialized');
    return;
  }

  /**
   * Initialize the engine with molds loaded
   * Returns a promise that resolves to the engine instance
   */
  global.ShipPixReady = (async function initShipPix() {
    try {
      // Wait for dependencies
      if (typeof PixelShipEngine === 'undefined') {
        console.warn('[ShipPix] PixelShipEngine not loaded');
        return null;
      }

      // Create WatercolorEngine if available (for fallback palette)
      let wcEngine = null;
      if (typeof WatercolorEngine !== 'undefined') {
        wcEngine = new WatercolorEngine();
      }

      // Create the main engine instance
      global.ShipPix = new PixelShipEngine({ 
        watercolorEngine: wcEngine,
        basePath: 'assets/molds/',
        preferMolds: true,
        enableCache: true,
      });
      
      // Initialize engine (loads molds)
      await global.ShipPix.init();
      
      // Check what we have
      const molds = global.ShipPix.getAvailableMolds();
      const hasMolds = global.ShipPix.moldComposer?.ready || false;
      
      console.log('[ShipPix] Engine initialized', 
        hasMolds ? `(${molds.length} molds loaded)` : '(block fallback only)',
        wcEngine ? '+ WatercolorEngine' : ''
      );
      
      return global.ShipPix;
    } catch (e) {
      console.error('[ShipPix] Initialization failed:', e);
      
      // Create fallback engine
      global.ShipPix = new PixelShipEngine({ preferMolds: false });
      global.ShipPix.ready = true;
      return global.ShipPix;
    }
  })();

  /**
   * Helper: Render a ship to a canvas element
   * Automatically waits for engine to be ready
   * 
   * @param {HTMLCanvasElement} canvas - Target canvas element
   * @param {string} ticker - Stock ticker symbol
   * @param {object} telemetry - Telemetry data (regime, signalState, thrust, etc.)
   * @param {number} size - Canvas size (optional, uses canvas width if not provided)
   * @returns {Promise<boolean>} - True if render succeeded
   */
  global.renderShipToCanvas = async function(canvas, ticker, telemetry = {}, size = null) {
    const engine = await global.ShipPixReady;
    if (!engine) {
      console.warn('[ShipPix] Engine not available, cannot render', ticker);
      return false;
    }
    
    if (!canvas || !canvas.getContext) {
      console.warn('[ShipPix] Invalid canvas element for', ticker);
      return false;
    }

    try {
      engine.renderToCanvas(canvas, ticker, telemetry, size);
      return true;
    } catch (e) {
      console.error('[ShipPix] Render failed for', ticker, e);
      return false;
    }
  };

  /**
   * Helper: Create and render a ship canvas element
   * 
   * @param {string} ticker - Stock ticker symbol
   * @param {object} telemetry - Telemetry data
   * @param {number} size - Canvas size in pixels (default 128)
   * @returns {Promise<HTMLCanvasElement|null>} - Rendered canvas or null on failure
   */
  global.createShipCanvas = async function(ticker, telemetry = {}, size = 128) {
    const engine = await global.ShipPixReady;
    if (!engine) return null;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    canvas.className = 'ship-sprite-canvas';
    canvas.dataset.ticker = ticker;
    
    try {
      engine.renderToCanvas(canvas, ticker, telemetry, size);
      return canvas;
    } catch (e) {
      console.error('[ShipPix] Create canvas failed for', ticker, e);
      return null;
    }
  };

  /**
   * Helper: Build telemetry object from position/fleet data
   * Normalizes different data structures into engine-expected format
   * 
   * @param {object} data - Position or fleet ship data
   * @returns {object} - Normalized telemetry for the engine
   */
  global.buildShipTelemetry = function(data) {
    if (!data) return {};

    // Handle different data structures
    const visual = data.visual || {};
    
    return {
      regime: data.regime || 'RANGE',
      signalState: data.signalState || 'neutral',
      thrust: visual.thrust ?? data.thrust ?? 0.5,
      damage: visual.damage ?? data.damage ?? 0,
      momentum: data.momentum ?? 0,
      jitter: visual.jitter ?? data.jitter ?? 0.1,
      glow: visual.glow ?? data.glow ?? 0.5
    };
  };

  /**
   * Helper: Convert market stats to telemetry for ship rendering
   * Uses TelemetryAdapter or SpriteUpgrades if available
   * 
   * @param {object} stats - Market statistics (winRate, volatility, etc.)
   * @returns {object} - Telemetry for the engine
   */
  global.statsToTelemetry = function(stats) {
    if (!stats) return {};

    // Use TelemetryAdapter if available
    if (global.TelemetryAdapter) {
      return global.TelemetryAdapter.fromMarketStats(stats);
    }

    // Use SpriteUpgrades for proper normalization if available
    if (global.SpriteUpgrades) {
      const upgrades = global.SpriteUpgrades.mapStatsToUpgrades(stats);
      return {
        signalState: stats.todayPnlPct > 0 ? 'bull' : stats.todayPnlPct < 0 ? 'bear' : 'neutral',
        thrust: upgrades.engines?.normalizedValue ?? 0.5,
        damage: 1 - (upgrades.armor?.normalizedValue ?? 0.5),
        momentum: upgrades.wings?.normalizedValue ?? 0.5,
        jitter: upgrades.antenna?.normalizedValue ?? 0.3,
        glow: upgrades.shield?.normalizedValue ?? 0.5,
      };
    }

    // Fallback: simple mapping
    const todayPnl = stats.todayPnlPct || stats.return_1d || 0;
    const weekPnl = stats.weekPnlPct || stats.return_1w || 0;
    const volatility = stats.volatility || 0.03;
    const drawdown = Math.abs(stats.maxDrawdownPct || stats.drawdown || 10);

    return {
      signalState: todayPnl > 1 ? 'bull' : todayPnl < -1 ? 'bear' : 'neutral',
      thrust: Math.max(0, Math.min(1, 0.5 + weekPnl / 20)),
      damage: Math.min(0.8, drawdown / 30),
      momentum: Math.max(0, Math.min(1, 0.5 + todayPnl / 10)),
      jitter: Math.min(1, volatility / 0.08),
      glow: Math.max(0.3, Math.min(1, 1 - volatility / 0.1)),
    };
  };

  /**
   * Helper: Get ship info for display (name, class, upgrades)
   */
  global.getShipInfo = async function(ticker, telemetry = {}) {
    const engine = await global.ShipPixReady;
    if (!engine) return null;
    return engine.getShipInfo(ticker, telemetry);
  };

  /**
   * Helper: Check if a ticker has a mold (high-quality sprite)
   */
  global.hasMold = async function(ticker) {
    const engine = await global.ShipPixReady;
    if (!engine) return false;
    return engine.hasMold(ticker);
  };

  /**
   * Helper: Get list of tickers with molds
   */
  global.getAvailableMolds = async function() {
    const engine = await global.ShipPixReady;
    if (!engine) return [];
    return engine.getAvailableMolds();
  };

  /**
   * Legacy compatibility: hasUniqueShip
   */
  global.hasUniqueShip = async function(ticker) {
    return global.hasMold(ticker);
  };

})(typeof window !== 'undefined' ? window : global);
