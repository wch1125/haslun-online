/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SHIPPIX BOOTSTRAP - Global Procedural Ship Renderer
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Provides a single global `window.ShipPix` instance with an async ready
 * promise `window.ShipPixReady` to prevent race conditions with pigment loading.
 * 
 * Usage:
 *   // In any page that needs procedural ships:
 *   <script src="../js/render/seed.js"></script>
 *   <script src="../js/lib/watercolor/watercolor-engine.js"></script>
 *   <script src="../js/render/pixel-ship-engine.js"></script>
 *   <script src="../js/render/shippix-bootstrap.js"></script>
 * 
 *   // Then in your UI code:
 *   await window.ShipPixReady;
 *   window.ShipPix.renderToCanvas(canvasEl, ticker, telemetry);
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
   * Initialize the engine with pigments loaded
   * Returns a promise that resolves to the engine instance
   */
  global.ShipPixReady = (async function initShipPix() {
    try {
      // Wait for dependencies
      if (typeof PixelShipEngine === 'undefined') {
        console.warn('[ShipPix] PixelShipEngine not loaded');
        return null;
      }

      if (typeof SeedUtils === 'undefined') {
        console.warn('[ShipPix] SeedUtils not loaded');
        return null;
      }

      // Create WatercolorEngine if available
      let wcEngine = null;
      if (typeof WatercolorEngine !== 'undefined') {
        wcEngine = new WatercolorEngine();
        // WatercolorEngine loads pigments synchronously from embedded data
        // but if it had an async init, we'd await it here:
        // if (wcEngine.init) await wcEngine.init();
      }

      // Create the main engine instance
      global.ShipPix = new PixelShipEngine({ watercolorEngine: wcEngine });
      
      console.log('[ShipPix] Engine initialized', wcEngine ? '(with WatercolorEngine)' : '(fallback palette)');
      
      return global.ShipPix;
    } catch (e) {
      console.error('[ShipPix] Initialization failed:', e);
      return null;
    }
  })();

  /**
   * Helper: Render a ship to a canvas element
   * Automatically waits for engine to be ready
   * 
   * @param {HTMLCanvasElement} canvas - Target canvas element
   * @param {string} ticker - Stock ticker symbol
   * @param {object} telemetry - Telemetry data (regime, signalState, thrust, etc.)
   * @returns {Promise<boolean>} - True if render succeeded
   */
  global.renderShipToCanvas = async function(canvas, ticker, telemetry = {}) {
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
      engine.renderToCanvas(canvas, ticker, telemetry);
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
      engine.renderToCanvas(canvas, ticker, telemetry);
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

})(typeof window !== 'undefined' ? window : global);
