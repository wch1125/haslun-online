/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SPACE CAPITAL - Unified Pixel Ship Engine v1.0
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Merges three systems:
 * 1. HOLO_SHIPS - Unique per-ticker SVG geometry → pixel silhouettes
 * 2. SPRITE_UPGRADES - Stats-driven visual upgrades (wings, engines, etc.)
 * 3. WatercolorEngine - Deterministic color palettes from ticker seed
 * 
 * Every ticker gets a unique ship shape. Stats determine upgrade parts.
 * Same ticker + stats always produces identical visual.
 * 
 * @requires SeedUtils (seed.js)
 * @requires WatercolorEngine (optional, for rich palettes)
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function(global) {
  'use strict';

  const CONFIG = {
    baseSize: 64,
    enableCache: true,
    maxCacheSize: 100,
    animationFps: 12,
  };

  // ═══════════════════════════════════════════════════════════════════════
  // TICKER-SPECIFIC SHIP GEOMETRY (converted from holo-ships.js SVG)
  // Each ship has unique silhouette blocks
  // ═══════════════════════════════════════════════════════════════════════

  const TICKER_SHIPS = {
    RKLB: {
      name: 'Orbital Bus',
      class: 'transport',
      // Main hull - hexagonal bus shape
      hull: [
        [10, 30, 20, 8, 0],   // left hull
        [34, 30, 20, 8, 0],   // right hull
        [30, 10, 10, 20, 1],  // center body
        [20, 14, 24, 12, 0],  // main cabin
      ],
      // Nose section
      nose: [
        [30, 5, 4, 8, 2],     // top spike
        [26, 8, 12, 6, 1],    // nose cone
      ],
      // Wings - angled panels
      wings: [
        [6, 28, 16, 4, 0],    // left wing
        [42, 28, 16, 4, 0],   // right wing
      ],
      // Engine section
      engines: [
        [26, 50, 6, 6, 0],    // left engine
        [32, 50, 6, 6, 0],    // right engine
      ],
      engineGlow: [[28, 56, 4, 8], [34, 56, 4, 8]],
      beacons: [[32, 6]],
    },

    LUNR: {
      name: 'Lunar Scout',
      class: 'scout',
      hull: [
        [10, 35, 15, 10, 0],  // left body
        [39, 35, 15, 10, 0],  // right body
        [25, 20, 14, 25, 1],  // center spine
      ],
      nose: [
        [28, 14, 8, 10, 1],   // sensor dome
        [30, 10, 4, 6, 2],    // antenna
      ],
      wings: [
        [4, 32, 18, 6, 0],    // left swept wing
        [42, 32, 18, 6, 0],   // right swept wing
      ],
      engines: [
        [28, 48, 8, 6, 0],    // center engine
      ],
      engineGlow: [[30, 54, 4, 8]],
      beacons: [[31, 11], [8, 34], [54, 34]],
    },

    JOBY: {
      name: 'eVTOL Frame',
      class: 'vtol',
      hull: [
        [15, 35, 15, 10, 0],  // left fuselage
        [34, 35, 15, 10, 0],  // right fuselage
        [26, 25, 12, 20, 1],  // center body
      ],
      nose: [
        [28, 18, 8, 10, 1],   // cockpit
      ],
      // Rotors instead of wings
      wings: [
        [20, 12, 14, 14, 0],  // left rotor disc
        [30, 12, 14, 14, 0],  // right rotor disc
      ],
      rotors: [
        { cx: 27, cy: 19, r: 7 },
        { cx: 37, cy: 19, r: 7 },
      ],
      engines: [
        [24, 48, 6, 4, 0],
        [34, 48, 6, 4, 0],
      ],
      engineGlow: [[26, 52, 3, 6], [36, 52, 3, 6]],
      beacons: [[27, 12], [37, 12]],
    },

    ACHR: {
      name: 'Archer VTOL',
      class: 'vtol',
      hull: [
        [20, 30, 15, 15, 0],  // left hull
        [29, 30, 15, 15, 0],  // right hull
        [26, 15, 12, 30, 1],  // spine
      ],
      nose: [
        [28, 10, 8, 8, 1],    // cockpit bubble
      ],
      wings: [
        [25, 14, 10, 10, 0],  // left rotor
        [29, 14, 10, 10, 0],  // right rotor
      ],
      rotors: [
        { cx: 30, cy: 19, r: 5 },
        { cx: 34, cy: 19, r: 5 },
      ],
      engines: [
        [28, 48, 8, 6, 0],
      ],
      engineGlow: [[30, 54, 4, 8]],
      beacons: [[32, 11]],
    },

    ASTS: {
      name: 'Bluebird Sat',
      class: 'satellite',
      hull: [
        [24, 20, 16, 20, 0],  // main body
        [26, 22, 12, 16, 1],  // inner core
      ],
      nose: [
        [28, 14, 8, 8, 2],    // antenna array
      ],
      // Solar panels instead of wings
      wings: [
        [4, 26, 20, 8, 0],    // left panel
        [40, 26, 20, 8, 0],   // right panel
        [6, 28, 16, 4, 1],    // left panel detail
        [42, 28, 16, 4, 1],   // right panel detail
      ],
      engines: [
        [28, 42, 8, 4, 0],
      ],
      engineGlow: [[30, 46, 4, 4]],
      beacons: [[31, 15], [12, 29], [52, 29]],
    },

    BKSY: {
      name: 'BlackSky Sat',
      class: 'satellite',
      hull: [
        [26, 18, 12, 24, 0],  // cylindrical body
        [28, 20, 8, 20, 1],   // inner
      ],
      nose: [
        [30, 12, 4, 8, 2],    // sensor pod
      ],
      wings: [
        [6, 24, 20, 12, 0],   // left array
        [38, 24, 20, 12, 0],  // right array
        [8, 28, 16, 4, 1],
        [40, 28, 16, 4, 1],
      ],
      engines: [
        [28, 44, 8, 4, 0],
      ],
      engineGlow: [[30, 48, 4, 4]],
      beacons: [[31, 13], [14, 29], [50, 29]],
    },

    GME: {
      name: 'Power Core',
      class: 'heavy',
      // Hexagonal power core shape
      hull: [
        [24, 10, 16, 45, 0],  // main hex body
        [20, 18, 24, 30, 1],  // outer ring
        [26, 22, 12, 22, 2],  // inner core
      ],
      nose: [
        [28, 6, 8, 8, 2],     // top vertex
      ],
      wings: [
        [14, 25, 12, 16, 0],  // left facet
        [38, 25, 12, 16, 0],  // right facet
      ],
      engines: [
        [26, 52, 12, 6, 0],
      ],
      engineGlow: [[29, 58, 6, 6]],
      beacons: [[31, 7]],
    },

    EVEX: {
      name: 'Transport',
      class: 'transport',
      hull: [
        [15, 32, 20, 10, 0],
        [29, 32, 20, 10, 0],
        [24, 22, 16, 20, 1],
      ],
      nose: [
        [28, 16, 8, 8, 1],
      ],
      wings: [
        [22, 12, 12, 12, 0],  // left rotor
        [30, 12, 12, 12, 0],  // right rotor
      ],
      rotors: [
        { cx: 28, cy: 18, r: 6 },
        { cx: 36, cy: 18, r: 6 },
      ],
      engines: [
        [26, 48, 6, 4, 0],
        [32, 48, 6, 4, 0],
      ],
      engineGlow: [[28, 52, 3, 5], [34, 52, 3, 5]],
      beacons: [[28, 13], [36, 13]],
    },

    GE: {
      name: 'Aerospace',
      class: 'heavy',
      hull: [
        [20, 35, 15, 15, 0],
        [29, 35, 15, 15, 0],
        [26, 20, 12, 30, 1],
      ],
      nose: [
        [28, 12, 8, 10, 1],
      ],
      wings: [
        [8, 30, 18, 8, 0],
        [38, 30, 18, 8, 0],
      ],
      // Center turbine
      turbine: { cx: 32, cy: 35, r: 8 },
      engines: [
        [28, 52, 8, 6, 0],
      ],
      engineGlow: [[30, 58, 4, 6]],
      beacons: [[31, 13], [14, 33], [50, 33]],
    },

    LHX: {
      name: 'Helix UAV',
      class: 'drone',
      hull: [
        [26, 20, 12, 20, 0],  // elliptical body
        [28, 22, 8, 16, 1],
      ],
      nose: [
        [30, 16, 4, 6, 2],
      ],
      // X-wing configuration
      wings: [
        [10, 16, 18, 4, 0],   // upper left
        [36, 16, 18, 4, 0],   // upper right
        [10, 36, 18, 4, 0],   // lower left
        [36, 36, 18, 4, 0],   // lower right
      ],
      engines: [
        [28, 42, 8, 4, 0],
      ],
      engineGlow: [[30, 46, 4, 5]],
      beacons: [[31, 17]],
    },

    RTX: {
      name: 'Defense Sys',
      class: 'heavy',
      hull: [
        [15, 30, 15, 15, 0],
        [34, 30, 15, 15, 0],
        [24, 15, 16, 30, 1],
      ],
      nose: [
        [28, 10, 8, 8, 1],
      ],
      wings: [
        [6, 26, 20, 8, 0],
        [38, 26, 20, 8, 0],
      ],
      // Targeting cross
      targeting: { cx: 32, cy: 30, size: 6 },
      engines: [
        [26, 48, 6, 4, 0],
        [32, 48, 6, 4, 0],
      ],
      engineGlow: [[28, 52, 3, 5], [34, 52, 3, 5]],
      beacons: [[31, 11], [12, 29], [52, 29]],
    },

    KTOS: {
      name: 'Strike Drone',
      class: 'drone',
      // Aggressive angular shape
      hull: [
        [24, 20, 16, 25, 0],
        [28, 24, 8, 18, 1],
      ],
      nose: [
        [30, 12, 4, 10, 2],   // sharp nose
        [28, 16, 8, 6, 1],
      ],
      wings: [
        [4, 28, 22, 6, 0],    // swept left
        [38, 28, 22, 6, 0],   // swept right
        [8, 30, 14, 3, 1],
        [42, 30, 14, 3, 1],
      ],
      engines: [
        [28, 48, 8, 4, 0],
      ],
      engineGlow: [[30, 52, 4, 6]],
      beacons: [[31, 13], [10, 30], [54, 30]],
    },

    PL: {
      name: 'Planet Labs',
      class: 'satellite',
      hull: [
        [22, 20, 20, 20, 0],
        [24, 22, 16, 16, 1],
      ],
      nose: [
        [28, 14, 8, 8, 2],    // camera array
      ],
      wings: [
        [4, 22, 18, 6, 0],    // solar panel left
        [42, 22, 18, 6, 0],   // solar panel right
        [4, 32, 18, 6, 0],
        [42, 32, 18, 6, 0],
      ],
      engines: [
        [28, 42, 8, 4, 0],
      ],
      engineGlow: [[30, 46, 4, 4]],
      beacons: [[31, 15]],
    },

    RDW: {
      name: 'Recon Sat',
      class: 'satellite',
      hull: [
        [24, 18, 16, 24, 0],
        [26, 20, 12, 20, 1],
      ],
      nose: [
        [30, 12, 4, 8, 2],
      ],
      wings: [
        [8, 18, 16, 10, 0],   // left dish
        [40, 18, 16, 10, 0],  // right dish
      ],
      engines: [
        [28, 44, 8, 4, 0],
      ],
      engineGlow: [[30, 48, 4, 4]],
      beacons: [[31, 13], [14, 22], [50, 22]],
    },

    COHR: {
      name: 'Laser Array',
      class: 'weapon',
      hull: [
        [24, 22, 16, 16, 0],
        [26, 24, 12, 12, 1],
      ],
      nose: [
        [28, 16, 8, 8, 2],
      ],
      // Laser emitters
      wings: [
        [4, 28, 20, 4, 0],
        [40, 28, 20, 4, 0],
      ],
      lasers: [
        { x: 4, y: 29, dir: 'left' },
        { x: 60, y: 29, dir: 'right' },
      ],
      engines: [
        [28, 40, 8, 4, 0],
      ],
      engineGlow: [[30, 44, 4, 4]],
      beacons: [[31, 17]],
    },
  };

  // Fallback ship for unknown tickers
  const DEFAULT_SHIP = {
    name: 'Unknown Vessel',
    class: 'drone',
    hull: [
      [24, 20, 16, 24, 0],
      [26, 22, 12, 20, 1],
    ],
    nose: [
      [28, 14, 8, 8, 1],
    ],
    wings: [
      [12, 28, 14, 4, 0],
      [38, 28, 14, 4, 0],
    ],
    engines: [
      [28, 46, 8, 4, 0],
    ],
    engineGlow: [[30, 50, 4, 6]],
    beacons: [[31, 15]],
  };

  // ═══════════════════════════════════════════════════════════════════════
  // UPGRADE PARTS - Visual enhancements based on stats
  // Imported from sprite-upgrades.js concept
  // ═══════════════════════════════════════════════════════════════════════

  const UPGRADE_PARTS = {
    // Wings: Based on momentum
    wings: {
      tiers: [
        { min: 0.00, max: 0.25, scale: 0.8,  label: 'Scout' },
        { min: 0.25, max: 0.50, scale: 1.0,  label: 'Standard' },
        { min: 0.50, max: 0.75, scale: 1.15, label: 'Combat' },
        { min: 0.75, max: 1.00, scale: 1.3,  label: 'Elite', glow: true },
      ],
      stat: 'momentum',
    },
    
    // Engines: Based on strength/thrust
    engines: {
      tiers: [
        { min: 0.00, max: 0.33, intensity: 0.4, flames: 1, label: 'Basic' },
        { min: 0.33, max: 0.66, intensity: 0.7, flames: 2, label: 'Ion' },
        { min: 0.66, max: 1.00, intensity: 1.0, flames: 3, label: 'Plasma', glow: true },
      ],
      stat: 'thrust',
    },
    
    // Armor: Based on damage/volatility
    armor: {
      tiers: [
        { min: 0.00, max: 0.30, plates: 0, label: 'None' },
        { min: 0.30, max: 0.60, plates: 2, label: 'Light' },
        { min: 0.60, max: 1.00, plates: 4, label: 'Heavy' },
      ],
      stat: 'damage',
    },
    
    // Antenna: Based on signal activity
    antenna: {
      tiers: [
        { min: 0.00, max: 0.40, size: 0, label: 'None' },
        { min: 0.40, max: 0.70, size: 4, label: 'Comm' },
        { min: 0.70, max: 1.00, size: 8, label: 'Command', pulse: true },
      ],
      stat: 'activity',
    },
    
    // Shield: Based on consistency/low jitter
    shield: {
      tiers: [
        { min: 0.00, max: 0.60, radius: 0, label: 'None' },
        { min: 0.60, max: 1.00, radius: 1.2, label: 'Active', pulse: true },
      ],
      stat: 'consistency',
    },
  };

  // ═══════════════════════════════════════════════════════════════════════
  // UTILITY FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════

  function getTickerShip(ticker) {
    return TICKER_SHIPS[ticker?.toUpperCase()] || DEFAULT_SHIP;
  }

  function getUpgradeTier(partType, normalizedValue) {
    const part = UPGRADE_PARTS[partType];
    if (!part) return null;
    
    for (const tier of part.tiers) {
      if (normalizedValue >= tier.min && normalizedValue < tier.max) {
        return tier;
      }
    }
    return part.tiers[part.tiers.length - 1];
  }

  function buildUpgrades(telemetry) {
    const upgrades = {};
    
    // Map telemetry to normalized 0-1 values
    const stats = {
      momentum: Math.abs(telemetry.momentum || 0),
      thrust: telemetry.thrust ?? 0.5,
      damage: telemetry.damage ?? 0,
      activity: telemetry.jitter ?? 0.3,
      consistency: 1 - (telemetry.jitter ?? 0.3),
    };
    
    for (const [partType, config] of Object.entries(UPGRADE_PARTS)) {
      const statValue = stats[config.stat] ?? 0.5;
      upgrades[partType] = getUpgradeTier(partType, statValue);
    }
    
    return upgrades;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PALETTE GENERATION
  // ═══════════════════════════════════════════════════════════════════════

  class PaletteGenerator {
    constructor(watercolorEngine = null) {
      this.wc = watercolorEngine;
      this._pigments = watercolorEngine?.getAllPigments?.() || null;
    }

    generate(ticker, telemetry = {}) {
      const signalState = telemetry.signalState || 'neutral';
      
      if (this.wc && this._pigments) {
        return this._generateWithWatercolor(ticker, signalState, telemetry);
      }
      return this._generateFallback(ticker, signalState);
    }

    _generateWithWatercolor(ticker, signalState, telemetry) {
      const wc = this.wc;
      const all = this._pigments;
      const n = all.length || 1;
      const letters = (ticker || 'AAA').toUpperCase().padEnd(4, 'A');

      // Letter → pigment with prime multipliers
      const hullPig = all[(SeedUtils.letterIndex(letters[0]) * 7) % n];
      const wingPig = all[(SeedUtils.letterIndex(letters[1]) * 11) % n];
      const accentPig = all[(SeedUtils.letterIndex(letters[2]) * 13) % n];
      const enginePig = all[(SeedUtils.letterIndex(letters[3]) * 17) % n];

      let hullRamp = wc.getDilutionGradient(hullPig, 4);
      let wingRamp = wc.getDilutionGradient(wingPig, 4);
      const engineRamp = wc.getDilutionGradient(enginePig, 4);

      const accentPalette = wc.generatePalette(accentPig, 'complementary');
      const accentColor = accentPalette[1]?.hex || accentPig?.hex || '#00FFFF';

      // Signal state tint
      if (signalState === 'bull') {
        const tint = wc.findPigment('Cyan');
        if (tint) hullRamp = hullRamp.map(c => wc.lerp(c, tint.hex, 0.15));
      } else if (signalState === 'bear') {
        const tint = wc.findPigment('Carmine');
        if (tint) hullRamp = hullRamp.map(c => wc.lerp(c, tint.hex, 0.15));
      }

      return {
        hull: hullRamp,
        wing: wingRamp,
        accent: accentColor,
        engine: engineRamp,
        shield: 'rgba(51, 255, 153, 0.3)',
        beacon: accentColor,
      };
    }

    _generateFallback(ticker, signalState) {
      const seed = SeedUtils.getTickerSeed(ticker);
      const rand = SeedUtils.mulberry32(seed);
      
      const hue = rand() * 360;
      const sat = 40 + rand() * 30;
      
      const hullBase = `hsl(${hue}, ${sat}%, 45%)`;
      const hullLight = `hsl(${hue}, ${sat}%, 55%)`;
      const hullDark = `hsl(${hue}, ${sat}%, 35%)`;
      
      const wingHue = (hue + 30) % 360;
      const wingBase = `hsl(${wingHue}, ${sat}%, 50%)`;
      
      return {
        hull: [hullDark, hullBase, hullLight, `hsl(${hue}, ${sat}%, 65%)`],
        wing: [wingBase, `hsl(${wingHue}, ${sat}%, 60%)`],
        accent: '#00FFFF',
        engine: ['#FF6600', '#FFAA00', '#FFDD44', '#FFFFAA'],
        shield: 'rgba(51, 255, 153, 0.3)',
        beacon: '#33FF99',
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SHIP RENDERER
  // ═══════════════════════════════════════════════════════════════════════

  class ShipRenderer {
    constructor(size = CONFIG.baseSize) {
      this.size = size;
      this.scale = size / 64;
    }

    render(ticker, palette, telemetry, seed, frameIndex, targetCanvas) {
      const canvas = targetCanvas || document.createElement('canvas');
      if (!targetCanvas) {
        canvas.width = this.size;
        canvas.height = this.size;
      }
      
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, this.size, this.size);

      const ship = getTickerShip(ticker);
      const upgrades = buildUpgrades(telemetry);
      const scale = this.scale;

      // 1. Render shield (behind everything if active)
      if (upgrades.shield?.radius > 0) {
        this._renderShield(ctx, upgrades.shield, palette, frameIndex);
      }

      // 2. Render engines (behind hull)
      this._renderEngines(ctx, ship, palette, upgrades.engines, telemetry.thrust ?? 0.5, seed, frameIndex);

      // 3. Render wings with upgrade scaling
      this._renderWings(ctx, ship, palette, upgrades.wings, seed);

      // 4. Render main hull
      this._renderHull(ctx, ship, palette, telemetry.damage ?? 0, seed);

      // 5. Render nose
      this._renderNose(ctx, ship, palette);

      // 6. Render armor plates
      if (upgrades.armor?.plates > 0) {
        this._renderArmor(ctx, ship, upgrades.armor, palette, seed);
      }

      // 7. Render antenna
      if (upgrades.antenna?.size > 0) {
        this._renderAntenna(ctx, ship, upgrades.antenna, palette, frameIndex);
      }

      // 8. Render beacons
      this._renderBeacons(ctx, ship, palette, telemetry.signalState, frameIndex);

      // 9. Render special features (rotors, lasers, etc.)
      this._renderSpecialFeatures(ctx, ship, palette, frameIndex);

      // 10. Render damage sparks
      if ((telemetry.damage ?? 0) > 0.2) {
        this._renderDamage(ctx, telemetry.damage, seed, frameIndex);
      }

      return canvas;
    }

    _renderHull(ctx, ship, palette, damage, seed) {
      const scale = this.scale;
      const rand = SeedUtils.mulberry32(seed);
      
      (ship.hull || []).forEach(([x, y, w, h, shade]) => {
        // Skip some blocks if damaged
        if (damage > 0.4 && rand() < damage * 0.2) return;
        
        ctx.fillStyle = palette.hull[shade] || palette.hull[0];
        ctx.fillRect(
          Math.round(x * scale),
          Math.round(y * scale),
          Math.ceil(w * scale),
          Math.ceil(h * scale)
        );
      });
    }

    _renderNose(ctx, ship, palette) {
      const scale = this.scale;
      
      (ship.nose || []).forEach(([x, y, w, h, shade]) => {
        ctx.fillStyle = palette.hull[shade] || palette.hull[0];
        ctx.fillRect(
          Math.round(x * scale),
          Math.round(y * scale),
          Math.ceil(w * scale),
          Math.ceil(h * scale)
        );
      });
    }

    _renderWings(ctx, ship, palette, wingTier, seed) {
      const scale = this.scale;
      const wingScale = wingTier?.scale ?? 1.0;
      const centerX = 32;
      
      (ship.wings || []).forEach(([x, y, w, h, shade]) => {
        // Scale wings from center
        const offsetX = (x - centerX) * wingScale + centerX;
        const scaledW = w * wingScale;
        
        ctx.fillStyle = palette.wing[shade] || palette.wing[0];
        ctx.fillRect(
          Math.round(offsetX * scale),
          Math.round(y * scale),
          Math.ceil(scaledW * scale),
          Math.ceil(h * scale)
        );
      });
      
      // Wing glow for elite tier
      if (wingTier?.glow) {
        ctx.shadowColor = palette.accent;
        ctx.shadowBlur = 8 * scale;
      }
    }

    _renderEngines(ctx, ship, palette, engineTier, thrust, seed, frameIndex) {
      const scale = this.scale;
      const intensity = engineTier?.intensity ?? 0.5;
      const flames = engineTier?.flames ?? 1;
      
      // Engine housings
      (ship.engines || []).forEach(([x, y, w, h, shade]) => {
        ctx.fillStyle = palette.hull[0];
        ctx.fillRect(
          Math.round(x * scale),
          Math.round(y * scale),
          Math.ceil(w * scale),
          Math.ceil(h * scale)
        );
      });
      
      // Engine glow/flames
      (ship.engineGlow || []).forEach(([x, y, w, maxLen], i) => {
        const rand = SeedUtils.getBlockRng(seed, frameIndex, 1000 + i);
        const len = maxLen * thrust * intensity;
        
        for (let j = 0; j < len; j++) {
          const ci = Math.min(Math.floor((j / len) * palette.engine.length), palette.engine.length - 1);
          ctx.fillStyle = palette.engine[ci];
          ctx.globalAlpha = (1 - j / len) * intensity;
          
          const flickerW = w * (0.7 + rand() * 0.6);
          ctx.fillRect(
            Math.round((x + (w - flickerW) / 2) * scale),
            Math.round((y + j) * scale),
            Math.ceil(flickerW * scale),
            Math.ceil(scale)
          );
        }
      });
      
      ctx.globalAlpha = 1;
    }

    _renderArmor(ctx, ship, armorTier, palette, seed) {
      const scale = this.scale;
      const plates = armorTier.plates || 0;
      const rand = SeedUtils.mulberry32(seed + 500);
      
      // Add armor plates on hull
      for (let i = 0; i < plates; i++) {
        const x = 20 + rand() * 24;
        const y = 18 + rand() * 28;
        const w = 4 + rand() * 6;
        const h = 3 + rand() * 4;
        
        ctx.fillStyle = 'rgba(100, 120, 140, 0.6)';
        ctx.fillRect(
          Math.round(x * scale),
          Math.round(y * scale),
          Math.ceil(w * scale),
          Math.ceil(h * scale)
        );
      }
    }

    _renderAntenna(ctx, ship, antennaTier, palette, frameIndex) {
      const scale = this.scale;
      const size = antennaTier.size || 0;
      
      // Antenna mast
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      ctx.moveTo(32 * scale, 12 * scale);
      ctx.lineTo(32 * scale, (12 - size) * scale);
      ctx.stroke();
      
      // Antenna tip with pulse
      if (antennaTier.pulse) {
        const pulse = (Math.sin(frameIndex * 0.3) + 1) / 2;
        ctx.globalAlpha = 0.5 + pulse * 0.5;
      }
      
      ctx.fillStyle = palette.beacon;
      ctx.beginPath();
      ctx.arc(32 * scale, (12 - size) * scale, 2 * scale, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.globalAlpha = 1;
    }

    _renderShield(ctx, shieldTier, palette, frameIndex) {
      const scale = this.scale;
      const radius = shieldTier.radius || 0;
      const pulse = shieldTier.pulse ? (Math.sin(frameIndex * 0.15) + 1) / 2 : 1;
      
      ctx.globalAlpha = 0.15 + pulse * 0.1;
      ctx.fillStyle = palette.shield;
      ctx.beginPath();
      ctx.ellipse(
        32 * scale, 32 * scale,
        28 * radius * scale, 30 * radius * scale,
        0, 0, Math.PI * 2
      );
      ctx.fill();
      
      ctx.globalAlpha = 1;
    }

    _renderBeacons(ctx, ship, palette, signalState, frameIndex) {
      const scale = this.scale;
      const pulseSpeed = signalState === 'bull' ? 6 : signalState === 'bear' ? 3 : 8;
      const pulse = (Math.sin(frameIndex / pulseSpeed) + 1) / 2;

      (ship.beacons || []).forEach(([x, y]) => {
        ctx.globalAlpha = 0.4 + pulse * 0.6;
        ctx.fillStyle = palette.beacon;
        ctx.fillRect(
          Math.round((x - 1) * scale),
          Math.round((y - 1) * scale),
          Math.ceil(2 * scale),
          Math.ceil(2 * scale)
        );
      });
      
      ctx.globalAlpha = 1;
    }

    _renderSpecialFeatures(ctx, ship, palette, frameIndex) {
      const scale = this.scale;
      
      // Rotors (for VTOL ships)
      if (ship.rotors) {
        const rotorAngle = frameIndex * 0.5;
        ship.rotors.forEach(({ cx, cy, r }) => {
          ctx.save();
          ctx.translate(cx * scale, cy * scale);
          ctx.rotate(rotorAngle);
          
          ctx.strokeStyle = palette.accent;
          ctx.lineWidth = 1.5 * scale;
          ctx.globalAlpha = 0.7;
          
          // Rotor blades
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(r * scale, 0);
            ctx.stroke();
            ctx.rotate(Math.PI * 2 / 3);
          }
          
          ctx.restore();
        });
        ctx.globalAlpha = 1;
      }
      
      // Turbine (for GE)
      if (ship.turbine) {
        const { cx, cy, r } = ship.turbine;
        ctx.strokeStyle = palette.hull[2] || palette.hull[0];
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.arc(cx * scale, cy * scale, r * scale, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      // Targeting reticle (for RTX)
      if (ship.targeting) {
        const { cx, cy, size } = ship.targeting;
        ctx.strokeStyle = palette.accent;
        ctx.lineWidth = 1 * scale;
        
        // Crosshairs
        ctx.beginPath();
        ctx.moveTo((cx - size) * scale, cy * scale);
        ctx.lineTo((cx + size) * scale, cy * scale);
        ctx.moveTo(cx * scale, (cy - size) * scale);
        ctx.lineTo(cx * scale, (cy + size) * scale);
        ctx.stroke();
      }
      
      // Lasers (for COHR)
      if (ship.lasers) {
        const pulse = (Math.sin(frameIndex * 0.4) + 1) / 2;
        ctx.fillStyle = `rgba(255, 100, 100, ${0.3 + pulse * 0.4})`;
        
        ship.lasers.forEach(({ x, y, dir }) => {
          const length = dir === 'left' ? -12 : 12;
          ctx.fillRect(
            Math.round(x * scale),
            Math.round((y - 1) * scale),
            Math.ceil(length * scale),
            Math.ceil(2 * scale)
          );
        });
      }
    }

    _renderDamage(ctx, damage, seed, frameIndex) {
      const scale = this.scale;
      const rand = SeedUtils.getBlockRng(seed, frameIndex, 2000);
      
      ctx.fillStyle = '#FF2975';
      const sparkCount = Math.floor(damage * 8);
      
      for (let i = 0; i < sparkCount; i++) {
        ctx.globalAlpha = 0.3 + rand() * 0.7;
        ctx.fillRect(
          Math.round((18 + rand() * 28) * scale),
          Math.round((10 + rand() * 44) * scale),
          Math.ceil(2 * scale),
          Math.ceil(2 * scale)
        );
      }
      
      ctx.globalAlpha = 1;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER CACHE - ImageBitmap storage
  // ═══════════════════════════════════════════════════════════════════════

  class RenderCache {
    constructor(maxSize = CONFIG.maxCacheSize) {
      this.cache = new Map();
      this.maxSize = maxSize;
    }

    _hashTelemetry(telemetry) {
      const signal = telemetry.signalState || 'neutral';
      const thrust = Math.round((telemetry.thrust ?? 0.5) * 10);
      const damage = Math.round((telemetry.damage ?? 0) * 10);
      const momentum = Math.round((telemetry.momentum ?? 0) * 4);
      const jitter = Math.round((telemetry.jitter ?? 0) * 10);
      return `${signal}:${thrust}:${damage}:${momentum}:${jitter}`;
    }

    get(ticker, size, telemetry) {
      if (!CONFIG.enableCache) return null;
      return this.cache.get(`${ticker}:${size}:${this._hashTelemetry(telemetry)}`);
    }

    async set(ticker, size, telemetry, canvas) {
      if (!CONFIG.enableCache) return;
      const key = `${ticker}:${size}:${this._hashTelemetry(telemetry)}`;
      
      if (this.cache.size >= this.maxSize) {
        const oldestKey = this.cache.keys().next().value;
        const oldBitmap = this.cache.get(oldestKey);
        if (oldBitmap?.close) oldBitmap.close();
        this.cache.delete(oldestKey);
      }
      
      try {
        const bitmap = await createImageBitmap(canvas);
        this.cache.set(key, bitmap);
      } catch (e) {
        console.warn('RenderCache: Failed to create ImageBitmap', e);
      }
    }

    clear() {
      this.cache.forEach(bitmap => {
        if (bitmap?.close) bitmap.close();
      });
      this.cache.clear();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MAIN ENGINE
  // ═══════════════════════════════════════════════════════════════════════

  class PixelShipEngine {
    constructor(options = {}) {
      this.watercolorEngine = options.watercolorEngine ||
        (typeof WatercolorEngine !== 'undefined' ? new WatercolorEngine() : null);
      this.paletteGenerator = new PaletteGenerator(this.watercolorEngine);
      this.cache = new RenderCache();
      this.userId = options.userId || null;
      this._renderers = new Map();
    }

    getSeed(ticker) {
      return SeedUtils.getTickerSeed(ticker, this.userId);
    }

    _getRenderer(size) {
      let renderer = this._renderers.get(size);
      if (!renderer) {
        renderer = new ShipRenderer(size);
        this._renderers.set(size, renderer);
      }
      return renderer;
    }

    renderShip(ticker, telemetry = {}, size = CONFIG.baseSize, targetCanvas = null) {
      const seed = this.getSeed(ticker);
      const palette = this.paletteGenerator.generate(ticker, telemetry);
      const renderer = this._getRenderer(size);

      if (targetCanvas) {
        renderer.render(ticker, palette, telemetry, seed, 0, targetCanvas);
        return targetCanvas;
      }

      const cachedBitmap = this.cache.get(ticker, size, telemetry);
      if (cachedBitmap) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(cachedBitmap, 0, 0);
        return canvas;
      }

      const canvas = renderer.render(ticker, palette, telemetry, seed, 0, null);
      this.cache.set(ticker, size, telemetry, canvas);
      return canvas;
    }

    renderToCanvas(targetCanvas, ticker, telemetry = {}) {
      const size = Math.min(targetCanvas.width, targetCanvas.height);
      this.renderShip(ticker, telemetry, size, targetCanvas);
    }

    renderToDataURL(ticker, telemetry = {}, size = CONFIG.baseSize) {
      return this.renderShip(ticker, telemetry, size).toDataURL('image/png');
    }

    createAnimatedSprite(ticker, telemetry = {}, size = CONFIG.baseSize) {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      canvas.dataset.ticker = ticker;

      const seed = this.getSeed(ticker);
      const renderer = this._getRenderer(size);

      let frameIndex = 0, animating = true, lastTime = 0;
      const frameInterval = 1000 / CONFIG.animationFps;

      const animate = (time) => {
        if (!animating) return;
        if (time - lastTime >= frameInterval) {
          frameIndex++;
          lastTime = time;
          const thrustVar = Math.sin(frameIndex * 0.5) * 0.1;
          const animTelemetry = { ...telemetry, thrust: (telemetry.thrust ?? 0.5) + thrustVar };
          const palette = this.paletteGenerator.generate(ticker, animTelemetry);
          renderer.render(ticker, palette, animTelemetry, seed, frameIndex, canvas);
        }
        requestAnimationFrame(animate);
      };

      requestAnimationFrame(animate);
      canvas.stopAnimation = () => { animating = false; };
      canvas.startAnimation = () => { if (!animating) { animating = true; requestAnimationFrame(animate); } };
      return canvas;
    }

    getShipInfo(ticker, telemetry = {}) {
      const seed = this.getSeed(ticker);
      const ship = getTickerShip(ticker);
      const upgrades = buildUpgrades(telemetry);
      
      return {
        ticker,
        seed,
        seedHex: seed.toString(16).toUpperCase().padStart(8, '0'),
        shipName: ship.name,
        shipClass: ship.class,
        upgrades,
        telemetry,
      };
    }

    getAvailableTickers() {
      return Object.keys(TICKER_SHIPS);
    }

    clearCache() {
      this.cache.clear();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // EXPORTS
  // ═══════════════════════════════════════════════════════════════════════

  global.PixelShipEngine = PixelShipEngine;
  global.TICKER_SHIPS = TICKER_SHIPS;
  global.UPGRADE_PARTS = UPGRADE_PARTS;
  global.ShipRenderer = ShipRenderer;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PixelShipEngine, TICKER_SHIPS, UPGRADE_PARTS, ShipRenderer };
  }

})(typeof window !== 'undefined' ? window : global);
