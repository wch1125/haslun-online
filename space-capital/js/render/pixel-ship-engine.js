/**
 * PixelShipEngine v0.2 - Deterministic Procedural Ship Renderer
 * 
 * KEY PRINCIPLE: The same ticker ALWAYS produces the same ship.
 * Telemetry modifies appearance (glow, damage, thrust) but not identity.
 * 
 * Determinism sources:
 *   - Ticker letters → base palette (R=hull, K=accent, L=engine, B=detail)
 *   - Ticker hash → blueprint selection within regime pool
 *   - Ticker seed → geometric variation params
 *   - Seeded PRNG → all "random" effects are reproducible
 * 
 * @requires SeedUtils (seed.js)
 * @requires WatercolorEngine (optional, for rich palettes)
 */

(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════
  
  const CONFIG = {
    baseSize: 64,
    enableCache: true,
    maxCacheSize: 100,
    animationFps: 12,
  };

  // ═══════════════════════════════════════════════════════════════════
  // SHIP BLUEPRINTS - Compact geometry definitions
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * Block format: [x, y, width, height, shadeIndex, layer, tag?]
   * shadeIndex: 0=darkest, 3=lightest
   * layer: 'hull' | 'accent' | 'engine' | 'wing'
   * tag: optional for param-based offsets
   */
  
  const BLUEPRINTS = {
    interceptor: {
      name: 'Interceptor',
      params: { wingSpan: [-2, 3], noseLen: [0, 4], engineWidth: [-1, 2] },
      blocks: [
        [28, 20, 8, 28, 0, 'hull'],
        [24, 24, 4, 20, 1, 'hull'],
        [36, 24, 4, 20, 1, 'hull'],
        [26, 22, 2, 24, 2, 'hull'],
        [36, 22, 2, 24, 2, 'hull'],
        [30, 12, 4, 8, 2, 'hull', 'nose'],
        [31, 8, 2, 4, 3, 'hull', 'nose-tip'],
        [12, 32, 12, 4, 1, 'wing', 'wing-left'],
        [8, 34, 8, 3, 0, 'wing', 'wing-left-outer'],
        [4, 36, 6, 2, 0, 'wing', 'wing-left-tip'],
        [40, 32, 12, 4, 1, 'wing', 'wing-right'],
        [48, 34, 8, 3, 0, 'wing', 'wing-right-outer'],
        [54, 36, 6, 2, 0, 'wing', 'wing-right-tip'],
        [29, 18, 6, 6, 0, 'accent'],
        [30, 19, 4, 4, 1, 'accent'],
        [26, 48, 12, 6, 0, 'hull', 'engine-housing'],
        [28, 54, 8, 4, 0, 'engine'],
        [29, 56, 6, 4, 1, 'engine'],
        [30, 58, 4, 4, 2, 'engine'],
      ],
      enginePoints: [[30, 58, 4, 6]],
      beaconPoints: [[31, 10]],
    },

    freighter: {
      name: 'Freighter',
      params: { cargoWidth: [-2, 4], podSize: [-1, 2], bridgeHeight: [0, 3] },
      blocks: [
        [18, 18, 28, 32, 0, 'hull'],
        [20, 16, 24, 4, 1, 'hull'],
        [22, 14, 20, 2, 2, 'hull'],
        [20, 22, 24, 2, 2, 'hull'],
        [20, 32, 24, 2, 2, 'hull'],
        [20, 42, 24, 2, 2, 'hull'],
        [26, 8, 12, 8, 1, 'hull', 'bridge'],
        [28, 6, 8, 4, 2, 'hull', 'bridge-top'],
        [29, 10, 6, 4, 0, 'accent'],
        [30, 11, 4, 2, 1, 'accent'],
        [8, 28, 10, 16, 0, 'wing', 'pod-left'],
        [6, 30, 4, 12, 1, 'wing', 'pod-left-outer'],
        [46, 28, 10, 16, 0, 'wing', 'pod-right'],
        [54, 30, 4, 12, 1, 'wing', 'pod-right-outer'],
        [22, 50, 6, 4, 0, 'hull'],
        [30, 50, 4, 4, 0, 'hull'],
        [38, 50, 6, 4, 0, 'hull'],
        [23, 54, 4, 3, 0, 'engine'],
        [31, 54, 2, 3, 1, 'engine'],
        [39, 54, 4, 3, 0, 'engine'],
      ],
      enginePoints: [[23, 54, 4, 5], [31, 54, 2, 4], [39, 54, 4, 5]],
      beaconPoints: [[30, 7], [10, 30], [52, 30]],
    },

    scout: {
      name: 'Scout',
      params: { dishSize: [0, 3], wingAngle: [-2, 2] },
      blocks: [
        [26, 22, 12, 20, 0, 'hull'],
        [28, 20, 8, 4, 1, 'hull'],
        [24, 26, 4, 12, 1, 'hull'],
        [36, 26, 4, 12, 1, 'hull'],
        [28, 10, 8, 4, 2, 'hull', 'dish'],
        [30, 8, 4, 4, 1, 'accent', 'dish-inner'],
        [31, 6, 2, 4, 2, 'accent', 'dish-antenna'],
        [16, 30, 10, 3, 1, 'wing', 'wing-left'],
        [14, 32, 6, 2, 0, 'wing', 'wing-left-tip'],
        [38, 30, 10, 3, 1, 'wing', 'wing-right'],
        [44, 32, 6, 2, 0, 'wing', 'wing-right-tip'],
        [29, 24, 6, 4, 0, 'accent'],
        [30, 25, 4, 2, 1, 'accent'],
        [29, 42, 6, 4, 0, 'hull'],
        [30, 46, 4, 3, 0, 'engine'],
        [31, 48, 2, 3, 1, 'engine'],
      ],
      enginePoints: [[30, 48, 4, 4]],
      beaconPoints: [[31, 7], [16, 31], [46, 31]],
    },

    dreadnought: {
      name: 'Dreadnought',
      params: { armorThickness: [0, 3], weaponSize: [-1, 2], towerHeight: [0, 4] },
      blocks: [
        [20, 12, 24, 40, 0, 'hull'],
        [16, 16, 8, 32, 1, 'hull'],
        [40, 16, 8, 32, 1, 'hull'],
        [24, 6, 16, 8, 1, 'hull', 'prow'],
        [28, 2, 8, 6, 2, 'hull', 'prow-tip'],
        [30, 0, 4, 4, 3, 'hull', 'prow-point'],
        [22, 20, 20, 2, 2, 'hull'],
        [22, 30, 20, 2, 2, 'hull'],
        [22, 40, 20, 2, 2, 'hull'],
        [8, 20, 8, 6, 0, 'wing', 'weapon-left'],
        [6, 22, 4, 2, 1, 'accent', 'weapon-left-barrel'],
        [48, 20, 8, 6, 0, 'wing', 'weapon-right'],
        [54, 22, 4, 2, 1, 'accent', 'weapon-right-barrel'],
        [28, 14, 8, 6, 2, 'hull', 'bridge'],
        [29, 12, 6, 4, 0, 'accent', 'bridge-window'],
        [30, 13, 4, 2, 1, 'accent'],
        [18, 52, 6, 4, 0, 'hull'],
        [26, 52, 4, 4, 0, 'hull'],
        [34, 52, 4, 4, 0, 'hull'],
        [42, 52, 6, 4, 0, 'hull'],
        [19, 56, 4, 4, 0, 'engine'],
        [27, 56, 2, 3, 1, 'engine'],
        [35, 56, 2, 3, 1, 'engine'],
        [43, 56, 4, 4, 0, 'engine'],
      ],
      enginePoints: [[19, 56, 4, 6], [27, 56, 2, 4], [35, 56, 2, 4], [43, 56, 4, 6]],
      beaconPoints: [[31, 1], [8, 22], [56, 22]],
    },

    drone: {
      name: 'Drone',
      params: { bodyShape: [0, 2], sensorSize: [0, 2] },
      blocks: [
        [28, 24, 8, 16, 0, 'hull'],
        [26, 28, 4, 8, 1, 'hull'],
        [34, 28, 4, 8, 1, 'hull'],
        [30, 20, 4, 6, 2, 'hull', 'sensor'],
        [31, 18, 2, 4, 0, 'accent', 'sensor-eye'],
        [20, 30, 8, 4, 1, 'wing', 'wing-left'],
        [36, 30, 8, 4, 1, 'wing', 'wing-right'],
        [30, 40, 4, 4, 0, 'hull'],
        [31, 44, 2, 3, 0, 'engine'],
      ],
      enginePoints: [[31, 44, 2, 3]],
      beaconPoints: [[31, 19]],
    },

    corvette: {
      name: 'Corvette',
      params: { hullLength: [-2, 4], wingStyle: [0, 2] },
      blocks: [
        [26, 16, 12, 32, 0, 'hull'],
        [24, 20, 4, 24, 1, 'hull'],
        [36, 20, 4, 24, 1, 'hull'],
        [28, 10, 8, 8, 1, 'hull'],
        [30, 6, 4, 6, 2, 'hull'],
        [14, 28, 12, 4, 1, 'wing'],
        [10, 30, 8, 3, 0, 'wing'],
        [38, 28, 12, 4, 1, 'wing'],
        [46, 30, 8, 3, 0, 'wing'],
        [29, 14, 6, 6, 0, 'accent'],
        [30, 15, 4, 4, 1, 'accent'],
        [26, 48, 5, 4, 0, 'hull'],
        [33, 48, 5, 4, 0, 'hull'],
        [27, 52, 3, 4, 0, 'engine'],
        [34, 52, 3, 4, 0, 'engine'],
      ],
      enginePoints: [[27, 52, 3, 5], [34, 52, 3, 5]],
      beaconPoints: [[31, 7], [12, 29], [50, 29]],
    },

    hauler: {
      name: 'Hauler',
      params: { cargoDepth: [0, 4], strutLength: [-1, 2] },
      blocks: [
        [14, 20, 36, 24, 0, 'hull'],
        [16, 18, 32, 4, 1, 'hull'],
        [18, 16, 28, 2, 2, 'hull'],
        [16, 24, 32, 2, 2, 'hull'],
        [16, 32, 32, 2, 2, 'hull'],
        [28, 10, 8, 8, 1, 'hull'],
        [30, 12, 4, 4, 0, 'accent'],
        [10, 26, 6, 12, 0, 'wing'],
        [48, 26, 6, 12, 0, 'wing'],
        [18, 44, 8, 4, 0, 'hull'],
        [30, 44, 4, 4, 0, 'hull'],
        [38, 44, 8, 4, 0, 'hull'],
        [20, 48, 4, 3, 0, 'engine'],
        [31, 48, 2, 3, 1, 'engine'],
        [40, 48, 4, 3, 0, 'engine'],
      ],
      enginePoints: [[20, 48, 4, 4], [31, 48, 2, 3], [40, 48, 4, 4]],
      beaconPoints: [[31, 11], [12, 28], [52, 28]],
    },
  };

  // ═══════════════════════════════════════════════════════════════════
  // BLUEPRINT SELECTION - Deterministic from ticker + regime
  // ═══════════════════════════════════════════════════════════════════
  
  const REGIME_POOLS = {
    'UPTREND':   ['interceptor', 'scout', 'corvette'],
    'DOWNTREND': ['dreadnought', 'freighter', 'hauler'],
    'BREAKOUT':  ['interceptor', 'dreadnought', 'corvette'],
    'CHOP':      ['drone', 'scout'],
    'RANGE':     ['freighter', 'corvette', 'hauler', 'scout'],
    'UNKNOWN':   ['drone', 'scout']
  };

  function chooseBlueprint(ticker, telemetry, seed) {
    const regime = telemetry.regime || 'RANGE';
    const pool = REGIME_POOLS[regime] || REGIME_POOLS['UNKNOWN'];
    const rand = SeedUtils.mulberry32(seed);
    return pool[Math.floor(rand() * pool.length)];
  }

  function getShipParams(seed, blueprint) {
    const bp = typeof blueprint === 'string' ? BLUEPRINTS[blueprint] : blueprint;
    if (!bp || !bp.params) return {};
    
    const rand = SeedUtils.mulberry32(seed);
    const params = {};
    
    for (const [key, [min, max]] of Object.entries(bp.params)) {
      params[key] = Math.round(min + (max - min) * rand());
    }
    
    return params;
  }

  // ═══════════════════════════════════════════════════════════════════
  // PALETTE GENERATION - Deterministic from ticker letters
  // ═══════════════════════════════════════════════════════════════════
  
  class PaletteGenerator {
    constructor(watercolorEngine = null) {
      this.wc = watercolorEngine;
    }

    generate(ticker, telemetry = {}) {
      const signalState = telemetry.signalState || 'neutral';
      const stress = telemetry.damage || 0;
      const momentum = Math.max(-1, Math.min(1, Math.round((telemetry.momentum || 0) * 4) / 4));
      
      if (this.wc) {
        return this._generateWithWatercolor(ticker, signalState, stress, momentum);
      }
      return this._generateFallback(ticker, signalState, stress, momentum);
    }

    _generateWithWatercolor(ticker, signalState, stress, momentum) {
      const wc = this.wc;
      const letters = (ticker || 'AAA').toUpperCase().padEnd(4, 'A');
      
      const all = wc.getAllPigments ? wc.getAllPigments() : [];
      const n = all.length || 1;
      
      // Letter → pigment mapping (prime multipliers for distribution)
      const hullPigment = all[(SeedUtils.letterIndex(letters[0]) * 7) % n];
      const wingPigment = all[(SeedUtils.letterIndex(letters[1]) * 11) % n];
      const accentPigment = all[(SeedUtils.letterIndex(letters[2]) * 13) % n];
      const engineBasePigment = all[(SeedUtils.letterIndex(letters[3]) * 17) % n];
      
      let hullRamp = wc.getDilutionGradient(hullPigment, 4);
      let wingRamp = wc.getDilutionGradient(wingPigment, 4);
      
      const accentPalette = wc.generatePalette(accentPigment, 'complementary');
      const accentColor = accentPalette[1]?.hex || accentPigment?.hex || '#00FFFF';
      
      let enginePigment = engineBasePigment;
      if (momentum > 0.25) {
        enginePigment = wc.findPigment('Indian Yellow') || engineBasePigment;
      } else if (momentum < -0.25) {
        enginePigment = wc.findPigment('Carmine') || engineBasePigment;
      }
      const engineRamp = wc.getDilutionGradient(enginePigment, 4);
      
      // Signal state tint
      if (signalState === 'bull') {
        const cyanPig = wc.findPigment('Cyan');
        if (cyanPig) hullRamp = hullRamp.map(c => wc.lerp(c, cyanPig.hex, 0.15));
      } else if (signalState === 'bear') {
        const magentaPig = wc.findPigment('Magenta') || wc.findPigment('Carmine');
        if (magentaPig) hullRamp = hullRamp.map(c => wc.lerp(c, magentaPig.hex, 0.15));
      }
      
      // Stress glaze
      if (stress > 0.3) {
        const stressPigment = wc.findPigment("Payne's Grey") || wc.findPigment('English Red');
        if (stressPigment) {
          hullRamp = hullRamp.map(c => wc.lerp(c, stressPigment.hex, stress * 0.35));
          wingRamp = wingRamp.map(c => wc.lerp(c, stressPigment.hex, stress * 0.25));
        }
      }
      
      return { hull: hullRamp, wing: wingRamp, accent: accentColor, engine: engineRamp, damage: '#FF2975' };
    }

    _generateFallback(ticker, signalState, stress, momentum) {
      const letters = (ticker || 'AAA').toUpperCase().padEnd(4, 'A');
      
      const hullHue = (SeedUtils.letterIndex(letters[0]) / 26) * 360;
      const wingHue = (SeedUtils.letterIndex(letters[1]) / 26) * 360;
      const accentHue = (SeedUtils.letterIndex(letters[2]) / 26) * 360;
      const engineHue = (SeedUtils.letterIndex(letters[3]) / 26) * 360;
      
      const hullRamp = this._generateRamp(hullHue, signalState, stress);
      const wingRamp = this._generateRamp(wingHue, signalState, stress * 0.7);
      const accentColor = `hsl(${accentHue}, 70%, 60%)`;
      
      const adjustedEngineHue = momentum > 0.25 ? 45 : momentum < -0.25 ? 350 : engineHue;
      const engineRamp = [
        `hsl(${adjustedEngineHue}, 90%, 50%)`,
        `hsl(${adjustedEngineHue}, 85%, 65%)`,
        `hsl(${adjustedEngineHue}, 80%, 80%)`,
        `hsl(${adjustedEngineHue}, 70%, 95%)`
      ];
      
      return { hull: hullRamp, wing: wingRamp, accent: accentColor, engine: engineRamp, damage: '#FF2975' };
    }

    _generateRamp(hue, signalState, stress) {
      let sat = signalState === 'bull' ? 50 : signalState === 'bear' ? 35 : 40;
      sat = sat * (1 - stress * 0.3);
      
      return [
        `hsl(${hue}, ${sat}%, 15%)`,
        `hsl(${hue}, ${sat}%, 25%)`,
        `hsl(${hue}, ${sat}%, 35%)`,
        `hsl(${hue}, ${sat}%, 45%)`
      ];
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // CANVAS RENDERER - Seeded PRNG for all randomness
  // ═══════════════════════════════════════════════════════════════════
  
  class ShipRenderer {
    constructor(size = CONFIG.baseSize) {
      this.size = size;
      this.scale = size / CONFIG.baseSize;
    }

    render(blueprint, palette, telemetry = {}, tickerSeed = 0, frameIndex = 0) {
      const canvas = document.createElement('canvas');
      canvas.width = this.size;
      canvas.height = this.size;
      const ctx = canvas.getContext('2d');
      
      ctx.clearRect(0, 0, this.size, this.size);
      
      const bp = typeof blueprint === 'string' ? BLUEPRINTS[blueprint] : blueprint;
      if (!bp) return canvas;
      
      const params = getShipParams(tickerSeed, bp);
      const thrust = telemetry.thrust ?? 0.5;
      const damage = telemetry.damage ?? 0;
      const jitter = telemetry.jitter ?? 0;
      
      this._renderBlocks(ctx, bp.blocks, palette, damage, jitter, tickerSeed, frameIndex, params);
      this._renderEngines(ctx, bp.enginePoints, palette.engine, thrust, tickerSeed, frameIndex);
      this._renderBeacons(ctx, bp.beaconPoints, palette.accent, telemetry.signalState, frameIndex);
      
      if (damage > 0.2) {
        this._renderDamage(ctx, damage, tickerSeed, frameIndex);
      }
      
      return canvas;
    }

    _renderBlocks(ctx, blocks, palette, damage, jitter, tickerSeed, frameIndex, params) {
      const scale = this.scale;
      
      blocks.forEach((block, blockIndex) => {
        const [x, y, w, h, shadeIndex, layer, tag] = block;
        const rand = SeedUtils.getBlockRng(tickerSeed, frameIndex, blockIndex);
        
        const jx = jitter > 0 ? (rand() - 0.5) * jitter * 2 : 0;
        const jy = jitter > 0 ? (rand() - 0.5) * jitter * 2 : 0;
        
        let offsetX = 0, offsetY = 0, offsetW = 0, offsetH = 0;
        if (tag && params) {
          if (tag.includes('wing-left') && params.wingSpan !== undefined) {
            offsetX = -params.wingSpan;
            offsetW = params.wingSpan;
          }
          if (tag.includes('wing-right') && params.wingSpan !== undefined) {
            offsetW = params.wingSpan;
          }
          if (tag.includes('nose') && params.noseLen !== undefined) {
            offsetY = -params.noseLen;
            offsetH = params.noseLen;
          }
        }
        
        let colorRamp;
        switch (layer) {
          case 'accent':
            ctx.fillStyle = typeof palette.accent === 'string' ? palette.accent : palette.accent[shadeIndex];
            break;
          case 'engine':
            ctx.fillStyle = palette.engine[shadeIndex] || palette.engine[0];
            break;
          case 'wing':
            colorRamp = palette.wing || palette.hull;
            ctx.fillStyle = colorRamp[shadeIndex] || colorRamp[0];
            break;
          default:
            ctx.fillStyle = palette.hull[shadeIndex] || palette.hull[0];
        }
        
        if (damage > 0.3 && (layer === 'hull' || layer === 'wing') && rand() < damage * 0.3) {
          return;
        }
        
        ctx.fillRect(
          Math.round((x + jx + offsetX) * scale),
          Math.round((y + jy + offsetY) * scale),
          Math.ceil((w + offsetW) * scale),
          Math.ceil((h + offsetH) * scale)
        );
      });
    }

    _renderEngines(ctx, enginePoints, engineColors, thrust, tickerSeed, frameIndex) {
      if (!enginePoints) return;
      const scale = this.scale;
      const thrustLength = thrust * 1.5;
      
      enginePoints.forEach((point, pointIndex) => {
        const [x, y, w, maxLen] = point;
        const len = maxLen * thrustLength;
        const rand = SeedUtils.getBlockRng(tickerSeed, frameIndex, 1000 + pointIndex);
        
        for (let i = 0; i < len; i++) {
          const colorIndex = Math.min(Math.floor((i / len) * engineColors.length), engineColors.length - 1);
          ctx.fillStyle = engineColors[colorIndex];
          ctx.globalAlpha = 1 - (i / len) * 0.7;
          
          const flickerW = w * (0.8 + rand() * 0.4);
          ctx.fillRect(
            Math.round((x + (w - flickerW) / 2) * scale),
            Math.round((y + i) * scale),
            Math.ceil(flickerW * scale),
            Math.ceil(scale)
          );
        }
      });
      ctx.globalAlpha = 1;
    }

    _renderBeacons(ctx, beaconPoints, accentColor, signalState, frameIndex) {
      if (!beaconPoints) return;
      const scale = this.scale;
      const pulseSpeed = signalState === 'bull' ? 6 : signalState === 'bear' ? 3 : 8;
      const pulse = (Math.sin(frameIndex / pulseSpeed) + 1) / 2;
      
      beaconPoints.forEach(([x, y]) => {
        ctx.globalAlpha = 0.5 + pulse * 0.5;
        ctx.fillStyle = accentColor;
        ctx.fillRect(Math.round(x * scale), Math.round(y * scale), Math.ceil(2 * scale), Math.ceil(2 * scale));
      });
      ctx.globalAlpha = 1;
    }

    _renderDamage(ctx, damage, tickerSeed, frameIndex) {
      const scale = this.scale;
      const rand = SeedUtils.getBlockRng(tickerSeed, frameIndex, 2000);
      
      ctx.fillStyle = '#FF2975';
      for (let i = 0; i < Math.floor(damage * 10); i++) {
        ctx.globalAlpha = 0.3 + rand() * 0.7;
        ctx.fillRect(
          Math.round((20 + rand() * 24) * scale),
          Math.round((10 + rand() * 44) * scale),
          Math.ceil(2 * scale),
          Math.ceil(2 * scale)
        );
      }
      ctx.globalAlpha = 1;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER CACHE - Includes all telemetry factors
  // ═══════════════════════════════════════════════════════════════════
  
  class RenderCache {
    constructor(maxSize = CONFIG.maxCacheSize) {
      this.cache = new Map();
      this.maxSize = maxSize;
    }

    _hashTelemetry(telemetry) {
      const regime = telemetry.regime || 'RANGE';
      const signal = telemetry.signalState || 'neutral';
      const thrust = Math.round((telemetry.thrust ?? 0.5) * 10);
      const damage = Math.round((telemetry.damage ?? 0) * 10);
      const momentum = Math.round((telemetry.momentum ?? 0) * 10);
      const jitter = Math.round((telemetry.jitter ?? 0) * 10);
      return `${regime}:${signal}:${thrust}:${damage}:${momentum}:${jitter}`;
    }

    get(ticker, size, telemetry) {
      if (!CONFIG.enableCache) return null;
      return this.cache.get(`${ticker}:${size}:${this._hashTelemetry(telemetry)}`);
    }

    set(ticker, size, telemetry, canvas) {
      if (!CONFIG.enableCache) return;
      const key = `${ticker}:${size}:${this._hashTelemetry(telemetry)}`;
      if (this.cache.size >= this.maxSize) {
        this.cache.delete(this.cache.keys().next().value);
      }
      this.cache.set(key, canvas);
    }

    clear() { this.cache.clear(); }
  }

  // ═══════════════════════════════════════════════════════════════════
  // MAIN ENGINE CLASS
  // ═══════════════════════════════════════════════════════════════════
  
  class PixelShipEngine {
    constructor(options = {}) {
      this.watercolorEngine = options.watercolorEngine || 
        (typeof WatercolorEngine !== 'undefined' ? new WatercolorEngine() : null);
      this.paletteGenerator = new PaletteGenerator(this.watercolorEngine);
      this.cache = new RenderCache();
      this.userId = options.userId || null;
    }

    getSeed(ticker) {
      return SeedUtils.getTickerSeed(ticker, this.userId);
    }

    renderShip(ticker, telemetry = {}, size = CONFIG.baseSize) {
      const cached = this.cache.get(ticker, size, telemetry);
      if (cached) return cached;
      
      const seed = this.getSeed(ticker);
      const blueprintName = chooseBlueprint(ticker, telemetry, seed);
      const palette = this.paletteGenerator.generate(ticker, telemetry);
      
      const renderer = new ShipRenderer(size);
      const canvas = renderer.render(blueprintName, palette, telemetry, seed, 0);
      
      this.cache.set(ticker, size, telemetry, canvas);
      return canvas;
    }

    renderToDataURL(ticker, telemetry = {}, size = CONFIG.baseSize) {
      return this.renderShip(ticker, telemetry, size).toDataURL('image/png');
    }

    renderToCanvas(targetCanvas, ticker, telemetry = {}) {
      const size = Math.min(targetCanvas.width, targetCanvas.height);
      const shipCanvas = this.renderShip(ticker, telemetry, size);
      const ctx = targetCanvas.getContext('2d');
      ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
      ctx.drawImage(shipCanvas, (targetCanvas.width - size) / 2, (targetCanvas.height - size) / 2);
    }

    createAnimatedSprite(ticker, telemetry = {}, size = CONFIG.baseSize) {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      canvas.dataset.ticker = ticker;
      
      const seed = this.getSeed(ticker);
      const blueprintName = chooseBlueprint(ticker, telemetry, seed);
      const renderer = new ShipRenderer(size);
      
      let frameIndex = 0;
      let animating = true;
      let lastTime = 0;
      const frameInterval = 1000 / CONFIG.animationFps;
      
      const animate = (time) => {
        if (!animating) return;
        
        if (time - lastTime >= frameInterval) {
          frameIndex++;
          lastTime = time;
          
          const thrustVar = Math.sin(frameIndex * 0.5) * 0.1;
          const animTelemetry = { ...telemetry, thrust: (telemetry.thrust ?? 0.5) + thrustVar };
          const palette = this.paletteGenerator.generate(ticker, animTelemetry);
          const frame = renderer.render(blueprintName, palette, animTelemetry, seed, frameIndex);
          
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, size, size);
          ctx.drawImage(frame, 0, 0);
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
      return {
        ticker,
        seed,
        blueprint: chooseBlueprint(ticker, telemetry, seed),
        params: getShipParams(seed, chooseBlueprint(ticker, telemetry, seed)),
        regime: telemetry.regime || 'RANGE'
      };
    }

    getBlueprints() { return Object.keys(BLUEPRINTS); }
    clearCache() { this.cache.clear(); }
  }

  // ═══════════════════════════════════════════════════════════════════
  // EXPORTS
  // ═══════════════════════════════════════════════════════════════════
  
  global.PixelShipEngine = PixelShipEngine;
  global.SHIP_BLUEPRINTS = BLUEPRINTS;
  global.ShipRenderer = ShipRenderer;
  
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PixelShipEngine, BLUEPRINTS, ShipRenderer };
  }

})(typeof window !== 'undefined' ? window : global);
