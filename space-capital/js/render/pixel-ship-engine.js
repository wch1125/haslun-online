/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SPACE CAPITAL - Pixel Ship Engine v2.0
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Unified ship rendering engine with two-tier system:
 * 
 * TIER 1 (Primary): Mold-based rendering
 *   - Uses real sprite molds from assets/molds/
 *   - Applies deterministic palette recoloring
 *   - High-quality pixel art output
 * 
 * TIER 2 (Fallback): Block-based procedural rendering
 *   - Generates ships from geometric primitives
 *   - Used when mold not available for ticker
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // DETERMINISTIC UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  function hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    }
    return hash >>> 0;
  }

  function mulberry32(seed) {
    return function() {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function seededRandom(ticker, salt = '') {
    return mulberry32(hashString(ticker + salt));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SHIP NAME GENERATOR
  // ═══════════════════════════════════════════════════════════════════════════

  const SHIP_PREFIXES = [
    'Stellar', 'Void', 'Nova', 'Nebula', 'Quantum', 'Ion', 'Plasma', 'Photon',
    'Cosmic', 'Orbital', 'Lunar', 'Solar', 'Astral', 'Galactic', 'Crimson'
  ];

  const SHIP_SUFFIXES = [
    'Runner', 'Striker', 'Hunter', 'Seeker', 'Drifter', 'Phantom', 'Specter',
    'Blade', 'Wing', 'Core', 'Prime', 'Vector', 'Pulse', 'Storm', 'Shadow'
  ];

  const CLASS_NAMES = {
    vtol: ['Dropship', 'Skimmer', 'Hopper', 'Lifter'],
    satellite: ['Observer', 'Sentinel', 'Watcher', 'Scanner'],
    transport: ['Hauler', 'Carrier', 'Freighter', 'Shuttle'],
    heavy: ['Destroyer', 'Cruiser', 'Fortress', 'Titan'],
    scout: ['Recon', 'Pathfinder', 'Ranger', 'Explorer'],
    drone: ['Interceptor', 'Swarm', 'Probe', 'Hawk'],
    weapon: ['Striker', 'Lancer', 'Cannon', 'Beam']
  };

  function generateShipName(ticker, shipClass = 'unknown') {
    const rand = seededRandom(ticker, 'name');
    const prefix = SHIP_PREFIXES[Math.floor(rand() * SHIP_PREFIXES.length)];
    const suffix = SHIP_SUFFIXES[Math.floor(rand() * SHIP_SUFFIXES.length)];
    return `${prefix} ${suffix}`;
  }

  function generateClassName(ticker, shipClass) {
    const rand = seededRandom(ticker, 'class');
    const classOptions = CLASS_NAMES[shipClass] || CLASS_NAMES.drone;
    return classOptions[Math.floor(rand() * classOptions.length)];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOCK RENDERER (FALLBACK)
  // ═══════════════════════════════════════════════════════════════════════════

  class BlockRenderer {
    constructor() {
      this.blueprints = this._initBlueprints();
    }

    _initBlueprints() {
      return {
        // Default blocky ship
        default: {
          hull: [
            { x: -3, y: -4, w: 6, h: 8 },
          ],
          wings: [
            { x: -8, y: -1, w: 5, h: 3 },
            { x: 3, y: -1, w: 5, h: 3 },
          ],
          engines: [
            { x: -2, y: 3, w: 1, h: 2 },
            { x: 1, y: 3, w: 1, h: 2 },
          ],
          cockpit: [
            { x: -1, y: -4, w: 2, h: 2 },
          ],
        }
      };
    }

    render(ctx, ticker, telemetry, size) {
      const scale = size / 32;
      const centerX = size / 2;
      const centerY = size / 2;
      const rand = seededRandom(ticker, 'blocks');

      // Generate colors
      const hue = hashString(ticker) % 360;
      const baseColor = `hsl(${hue}, 50%, 40%)`;
      const lightColor = `hsl(${hue}, 60%, 60%)`;
      const darkColor = `hsl(${hue}, 40%, 25%)`;
      const glowColor = `hsl(${(hue + 180) % 360}, 80%, 60%)`;

      const bp = this.blueprints.default;

      // Draw parts in order: engines, hull, wings, cockpit
      ctx.save();
      ctx.translate(centerX, centerY);

      // Engines (with glow)
      ctx.fillStyle = glowColor;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 4 * scale;
      bp.engines.forEach(e => {
        ctx.fillRect(e.x * scale, e.y * scale, e.w * scale, e.h * scale);
      });
      ctx.shadowBlur = 0;

      // Hull
      ctx.fillStyle = baseColor;
      bp.hull.forEach(h => {
        ctx.fillRect(h.x * scale, h.y * scale, h.w * scale, h.h * scale);
      });

      // Wings
      ctx.fillStyle = darkColor;
      bp.wings.forEach(w => {
        ctx.fillRect(w.x * scale, w.y * scale, w.w * scale, w.h * scale);
      });

      // Cockpit
      ctx.fillStyle = lightColor;
      bp.cockpit.forEach(c => {
        ctx.fillRect(c.x * scale, c.y * scale, c.w * scale, c.h * scale);
      });

      ctx.restore();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PIXEL SHIP ENGINE CLASS
  // ═══════════════════════════════════════════════════════════════════════════

  class PixelShipEngine {
    constructor(options = {}) {
      this.moldComposer = null;
      this.blockRenderer = new BlockRenderer();
      this.watercolorEngine = options.watercolorEngine || null;
      this.ready = false;
      this.initPromise = null;
      
      // Configuration
      this.config = {
        basePath: options.basePath || 'assets/molds/',
        preferMolds: options.preferMolds !== false,
        enableCache: options.enableCache !== false,
      };
      
      // Cache
      this.renderCache = new Map();
      this.MAX_CACHE_SIZE = 50;
    }

    /**
     * Initialize the engine
     */
    async init() {
      if (this.initPromise) return this.initPromise;
      
      this.initPromise = this._doInit();
      return this.initPromise;
    }

    async _doInit() {
      try {
        // Initialize MoldComposer
        if (global.MoldComposer) {
          this.moldComposer = new global.MoldComposer({
            basePath: this.config.basePath
          });
          await this.moldComposer.load();
        } else {
          console.warn('[PixelShipEngine] MoldComposer not available, using blocks only');
        }

        this.ready = true;
        console.log(`[PixelShipEngine] Initialized (molds: ${this.moldComposer?.ready || false})`);
        return true;
      } catch (e) {
        console.error('[PixelShipEngine] Init failed:', e);
        this.ready = true; // Still usable with block renderer
        return false;
      }
    }

    /**
     * Check if engine is ready
     */
    isReady() {
      return this.ready;
    }

    /**
     * Render a ship directly to a canvas
     */
    renderToCanvas(canvas, ticker, telemetry = {}, size = null) {
      if (!canvas?.getContext) {
        console.warn('[PixelShipEngine] Invalid canvas');
        return false;
      }

      const ctx = canvas.getContext('2d');
      size = size || canvas.width || 128;

      // Resize canvas if needed
      if (canvas.width !== size || canvas.height !== size) {
        canvas.width = size;
        canvas.height = size;
      }

      ctx.clearRect(0, 0, size, size);

      // Try mold rendering first
      if (this.config.preferMolds && this.moldComposer?.ready) {
        const success = this.moldComposer.renderToCanvas(canvas, ticker, telemetry, size);
        if (success) return true;
      }

      // Fallback to block rendering
      this.blockRenderer.render(ctx, ticker, telemetry, size);
      return true;
    }

    /**
     * Render and return a new canvas
     */
    renderShip(ticker, telemetry = {}, size = 128) {
      // Check cache
      const cacheKey = this._getCacheKey(ticker, telemetry, size);
      if (this.config.enableCache && this.renderCache.has(cacheKey)) {
        const cached = this.renderCache.get(cacheKey);
        // Return a copy
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        canvas.getContext('2d').drawImage(cached, 0, 0);
        return canvas;
      }

      // Create and render
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      this.renderToCanvas(canvas, ticker, telemetry, size);

      // Cache
      if (this.config.enableCache) {
        this._setCache(cacheKey, canvas);
      }

      return canvas;
    }

    /**
     * Create an animated sprite with idle animation
     */
    createAnimatedSprite(ticker, telemetry = {}, size = 128) {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      
      let frame = 0;
      let animId = null;
      const fps = 12;
      const frameTime = 1000 / fps;
      let lastTime = 0;

      const animate = (timestamp) => {
        if (timestamp - lastTime >= frameTime) {
          frame++;
          lastTime = timestamp;

          // Update telemetry with animation
          const animTelemetry = {
            ...telemetry,
            thrust: (telemetry.thrust || 0.5) + Math.sin(frame * 0.1) * 0.1,
            glow: (telemetry.glow || 0.5) + Math.sin(frame * 0.15) * 0.1,
          };

          this.renderToCanvas(canvas, ticker, animTelemetry, size);
        }
        animId = requestAnimationFrame(animate);
      };

      // Start animation
      animId = requestAnimationFrame(animate);

      // Add control methods
      canvas.stop = () => {
        if (animId) cancelAnimationFrame(animId);
        animId = null;
      };
      canvas.start = () => {
        if (!animId) animId = requestAnimationFrame(animate);
      };
      canvas.isAnimating = () => animId !== null;

      return canvas;
    }

    /**
     * Get ship information
     */
    getShipInfo(ticker, telemetry = {}) {
      // Get from mold composer if available
      if (this.moldComposer?.ready) {
        const moldInfo = this.moldComposer.getShipInfo(ticker);
        return {
          ticker,
          shipName: generateShipName(ticker, moldInfo.shipClass),
          shipClass: moldInfo.shipClass,
          className: generateClassName(ticker, moldInfo.shipClass),
          traits: moldInfo.traits,
          hasMold: moldInfo.hasMold,
          upgrades: this._calculateUpgrades(telemetry),
        };
      }

      // Fallback
      return {
        ticker,
        shipName: generateShipName(ticker, 'drone'),
        shipClass: 'drone',
        className: generateClassName(ticker, 'drone'),
        traits: [],
        hasMold: false,
        upgrades: this._calculateUpgrades(telemetry),
      };
    }

    /**
     * Calculate visual upgrades from telemetry
     */
    _calculateUpgrades(telemetry = {}) {
      const thrust = telemetry.thrust || 0.5;
      const damage = telemetry.damage || 0;
      const glow = telemetry.glow || 0.5;
      const momentum = telemetry.momentum || 0;

      return {
        engines: {
          tier: thrust > 0.7 ? 3 : thrust > 0.4 ? 2 : 1,
          label: thrust > 0.7 ? 'Afterburner' : thrust > 0.4 ? 'Standard' : 'Economy',
          value: thrust,
        },
        armor: {
          tier: damage > 0.5 ? 1 : damage > 0.2 ? 2 : 3,
          label: damage > 0.5 ? 'Critical' : damage > 0.2 ? 'Damaged' : 'Intact',
          value: 1 - damage,
        },
        shields: {
          tier: glow > 0.7 ? 3 : glow > 0.4 ? 2 : 1,
          label: glow > 0.7 ? 'Charged' : glow > 0.4 ? 'Online' : 'Minimal',
          value: glow,
        },
        momentum: {
          tier: Math.abs(momentum) > 0.5 ? 3 : Math.abs(momentum) > 0.2 ? 2 : 1,
          label: momentum > 0.5 ? 'Bullish' : momentum < -0.5 ? 'Bearish' : 'Neutral',
          value: momentum,
        },
      };
    }

    /**
     * Check if a specific mold exists
     */
    hasMold(ticker) {
      return this.moldComposer?.hasMold(ticker) || false;
    }

    /**
     * Get list of available molds
     */
    getAvailableMolds() {
      if (!this.moldComposer?.atlas?.ships) return [];
      return Object.keys(this.moldComposer.atlas.ships);
    }

    /**
     * Cache management
     */
    _getCacheKey(ticker, telemetry, size) {
      const state = telemetry.signalState || 'neutral';
      const thrust = Math.round((telemetry.thrust || 0.5) * 10);
      const damage = Math.round((telemetry.damage || 0) * 10);
      return `${ticker}:${size}:${state}:${thrust}:${damage}`;
    }

    _setCache(key, canvas) {
      if (this.renderCache.size >= this.MAX_CACHE_SIZE) {
        const oldestKey = this.renderCache.keys().next().value;
        this.renderCache.delete(oldestKey);
      }
      this.renderCache.set(key, canvas);
    }

    clearCache() {
      this.renderCache.clear();
      this.moldComposer?.clearCache();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════════════

  global.PixelShipEngine = PixelShipEngine;

  console.log('[PixelShipEngine] Module loaded (v2.0 - mold-first)');

})(typeof window !== 'undefined' ? window : global);
