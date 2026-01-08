/**
 * PixelShipEngine v0.3 - Optimized Deterministic Procedural Ships
 * 
 * Performance improvements:
 *   - Optional targetCanvas to avoid allocation
 *   - Cached pigments array
 *   - Cutout layer support for negative space
 *   - More param tags for silhouette variation
 * 
 * @requires SeedUtils (seed.js)
 * @requires WatercolorEngine (optional)
 */

(function(global) {
  'use strict';

  const CONFIG = {
    baseSize: 64,
    enableCache: true,
    maxCacheSize: 100,
    animationFps: 12,
  };

  // ═══════════════════════════════════════════════════════════════════
  // SHIP BLUEPRINTS
  // Block: [x, y, w, h, shadeIndex, layer, tag?]
  // Layers: 'hull' | 'wing' | 'accent' | 'engine' | 'cutout'
  // ═══════════════════════════════════════════════════════════════════

  const BLUEPRINTS = {
    interceptor: {
      name: 'Interceptor',
      desc: 'Fast strike craft',
      params: { wingSpan: [-2, 4], noseLen: [0, 5], engineWidth: [-1, 2] },
      blocks: [
        // Core hull
        [28, 18, 8, 32, 0, 'hull'],
        [24, 22, 4, 24, 1, 'hull'],
        [36, 22, 4, 24, 1, 'hull'],
        [26, 20, 2, 28, 2, 'hull'],
        [36, 20, 2, 28, 2, 'hull'],
        // Nose - twin prongs
        [28, 10, 3, 10, 2, 'hull', 'nose'],
        [33, 10, 3, 10, 2, 'hull', 'nose'],
        [29, 6, 2, 6, 3, 'hull', 'nose-tip'],
        [33, 6, 2, 6, 3, 'hull', 'nose-tip'],
        // Cockpit notch (cutout for negative space)
        [30, 12, 4, 4, 0, 'cutout'],
        // Wings - swept back
        [10, 32, 14, 4, 1, 'wing', 'wing-left'],
        [6, 34, 10, 3, 0, 'wing', 'wing-left-outer'],
        [2, 36, 6, 2, 0, 'wing', 'wing-left-tip'],
        [40, 32, 14, 4, 1, 'wing', 'wing-right'],
        [48, 34, 10, 3, 0, 'wing', 'wing-right-outer'],
        [56, 36, 6, 2, 0, 'wing', 'wing-right-tip'],
        // Cockpit
        [29, 18, 6, 6, 0, 'accent'],
        [30, 19, 4, 4, 1, 'accent'],
        // Engine housing
        [26, 48, 12, 6, 0, 'hull', 'engine-housing'],
        // Engine glow
        [28, 54, 8, 4, 0, 'engine'],
        [30, 58, 4, 6, 1, 'engine'],
      ],
      enginePoints: [[30, 58, 4, 8]],
      beaconPoints: [[30, 8], [34, 8]],
    },

    freighter: {
      name: 'Freighter',
      desc: 'Heavy cargo hauler',
      params: { cargoWidth: [-2, 4], podSize: [-1, 3], bridgeHeight: [0, 3] },
      blocks: [
        // Main cargo hull
        [16, 16, 32, 34, 0, 'hull'],
        [18, 14, 28, 4, 1, 'hull'],
        [20, 12, 24, 2, 2, 'hull'],
        // Cargo ribs (detail)
        [18, 20, 28, 2, 2, 'hull'],
        [18, 28, 28, 2, 2, 'hull'],
        [18, 36, 28, 2, 2, 'hull'],
        [18, 44, 28, 2, 2, 'hull'],
        // Hollow cargo bay (cutout)
        [22, 22, 20, 4, 0, 'cutout'],
        [22, 30, 20, 4, 0, 'cutout'],
        // Bridge
        [26, 4, 12, 10, 1, 'hull', 'bridge'],
        [28, 2, 8, 4, 2, 'hull', 'bridge-top'],
        // Cockpit
        [29, 6, 6, 5, 0, 'accent'],
        [30, 7, 4, 3, 1, 'accent'],
        // Side pods
        [4, 26, 12, 18, 0, 'wing', 'pod-left'],
        [2, 28, 4, 14, 1, 'wing', 'pod-left-outer'],
        [48, 26, 12, 18, 0, 'wing', 'pod-right'],
        [58, 28, 4, 14, 1, 'wing', 'pod-right-outer'],
        // Engine array
        [20, 50, 8, 4, 0, 'hull'],
        [30, 50, 4, 4, 0, 'hull'],
        [40, 50, 8, 4, 0, 'hull'],
        [22, 54, 4, 4, 0, 'engine'],
        [31, 54, 2, 4, 1, 'engine'],
        [42, 54, 4, 4, 0, 'engine'],
      ],
      enginePoints: [[22, 54, 4, 6], [31, 54, 2, 4], [42, 54, 4, 6]],
      beaconPoints: [[31, 3], [6, 28], [58, 28]],
    },

    scout: {
      name: 'Scout',
      desc: 'Sensor recon vessel',
      params: { dishSize: [0, 4], wingAngle: [-2, 3], spineLen: [0, 4] },
      blocks: [
        // Long thin spine
        [30, 18, 4, 28, 0, 'hull', 'spine'],
        [28, 22, 2, 20, 1, 'hull'],
        [34, 22, 2, 20, 1, 'hull'],
        // Wide sensor dish
        [24, 6, 16, 6, 2, 'hull', 'dish'],
        [26, 4, 12, 4, 1, 'accent', 'dish-inner'],
        [30, 2, 4, 4, 2, 'accent', 'dish-antenna'],
        // Dish detail (cutout arc)
        [28, 8, 8, 2, 0, 'cutout'],
        // Small wings
        [14, 32, 14, 3, 1, 'wing', 'wing-left'],
        [10, 34, 8, 2, 0, 'wing', 'wing-left-tip'],
        [36, 32, 14, 3, 1, 'wing', 'wing-right'],
        [46, 34, 8, 2, 0, 'wing', 'wing-right-tip'],
        // Cockpit
        [29, 20, 6, 5, 0, 'accent'],
        [30, 21, 4, 3, 1, 'accent'],
        // Engine
        [29, 46, 6, 4, 0, 'hull'],
        [30, 50, 4, 4, 0, 'engine'],
        [31, 54, 2, 4, 1, 'engine'],
      ],
      enginePoints: [[30, 54, 4, 5]],
      beaconPoints: [[31, 3], [12, 33], [50, 33]],
    },

    dreadnought: {
      name: 'Dreadnought',
      desc: 'Capital warship',
      params: { armorThickness: [0, 4], weaponLen: [-1, 3], towerHeight: [0, 5] },
      blocks: [
        // Massive hammerhead hull
        [18, 10, 28, 44, 0, 'hull'],
        [14, 14, 8, 36, 1, 'hull'],
        [42, 14, 8, 36, 1, 'hull'],
        // Armored prow (hammerhead)
        [12, 4, 40, 8, 1, 'hull', 'prow'],
        [20, 2, 24, 4, 2, 'hull', 'prow-tip'],
        [28, 0, 8, 4, 3, 'hull', 'prow-point'],
        // Dorsal tower
        [28, 12, 8, 8, 2, 'hull', 'bridge'],
        [29, 10, 6, 4, 0, 'accent', 'bridge-window'],
        [30, 11, 4, 2, 1, 'accent'],
        // Hull ridges
        [20, 20, 24, 2, 2, 'hull'],
        [20, 32, 24, 2, 2, 'hull'],
        [20, 44, 24, 2, 2, 'hull'],
        // Weapon arrays
        [4, 18, 10, 8, 0, 'wing', 'weapon-left'],
        [2, 20, 4, 4, 1, 'accent', 'weapon-left-barrel'],
        [50, 18, 10, 8, 0, 'wing', 'weapon-right'],
        [58, 20, 4, 4, 1, 'accent', 'weapon-right-barrel'],
        // Engine bank
        [18, 54, 6, 4, 0, 'hull'],
        [26, 54, 4, 4, 0, 'hull'],
        [34, 54, 4, 4, 0, 'hull'],
        [42, 54, 6, 4, 0, 'hull'],
        [19, 58, 4, 4, 0, 'engine'],
        [27, 58, 2, 3, 1, 'engine'],
        [35, 58, 2, 3, 1, 'engine'],
        [43, 58, 4, 4, 0, 'engine'],
      ],
      enginePoints: [[19, 58, 4, 6], [27, 58, 2, 4], [35, 58, 2, 4], [43, 58, 4, 6]],
      beaconPoints: [[31, 1], [4, 22], [60, 22]],
    },

    drone: {
      name: 'Drone',
      desc: 'Autonomous unit',
      params: { bodyShape: [0, 3], sensorSize: [0, 2], finOffset: [-2, 2] },
      blocks: [
        // Compact body (asymmetric)
        [26, 22, 10, 18, 0, 'hull'],
        [24, 26, 4, 10, 1, 'hull'],
        [36, 28, 4, 8, 1, 'hull'],
        // Off-center sensor
        [28, 16, 6, 8, 2, 'hull', 'sensor'],
        [30, 14, 4, 4, 0, 'accent', 'sensor-eye'],
        // Asymmetric fins
        [18, 28, 8, 4, 1, 'wing', 'wing-left'],
        [38, 32, 10, 4, 1, 'wing', 'wing-right'],
        // Single engine
        [28, 40, 6, 4, 0, 'hull'],
        [30, 44, 4, 3, 0, 'engine'],
      ],
      enginePoints: [[30, 44, 4, 4]],
      beaconPoints: [[31, 15]],
    },

    corvette: {
      name: 'Corvette',
      desc: 'Multi-role frigate',
      params: { hullLength: [-2, 4], wingStyle: [0, 3], stabilizerSize: [0, 2] },
      blocks: [
        // Sleek hull
        [26, 14, 12, 36, 0, 'hull'],
        [24, 18, 4, 28, 1, 'hull'],
        [36, 18, 4, 28, 1, 'hull'],
        // Nose
        [28, 8, 8, 8, 1, 'hull'],
        [30, 4, 4, 6, 2, 'hull'],
        // Swept wings
        [12, 26, 14, 4, 1, 'wing'],
        [8, 28, 10, 3, 0, 'wing'],
        [38, 26, 14, 4, 1, 'wing'],
        [46, 28, 10, 3, 0, 'wing'],
        // Aft stabilizers
        [18, 42, 8, 3, 1, 'wing', 'stabilizer-left'],
        [38, 42, 8, 3, 1, 'wing', 'stabilizer-right'],
        // Cockpit
        [29, 12, 6, 6, 0, 'accent'],
        [30, 13, 4, 4, 1, 'accent'],
        // Dual engines
        [26, 50, 5, 4, 0, 'hull'],
        [33, 50, 5, 4, 0, 'hull'],
        [27, 54, 3, 5, 0, 'engine'],
        [34, 54, 3, 5, 0, 'engine'],
      ],
      enginePoints: [[27, 54, 3, 6], [34, 54, 3, 6]],
      beaconPoints: [[31, 5], [10, 28], [52, 28]],
    },

    hauler: {
      name: 'Hauler',
      desc: 'Bulk transport',
      params: { cargoDepth: [0, 5], strutLength: [-1, 3], moduleCount: [0, 2] },
      blocks: [
        // Wide cargo bay
        [12, 18, 40, 26, 0, 'hull'],
        [14, 16, 36, 4, 1, 'hull'],
        [16, 14, 32, 2, 2, 'hull'],
        // Modular cargo blocks
        [14, 22, 36, 2, 2, 'hull'],
        [14, 30, 36, 2, 2, 'hull'],
        [14, 38, 36, 2, 2, 'hull'],
        // Cargo bay cutouts (stacked crates look)
        [18, 24, 12, 4, 0, 'cutout'],
        [34, 24, 12, 4, 0, 'cutout'],
        [18, 32, 12, 4, 0, 'cutout'],
        [34, 32, 12, 4, 0, 'cutout'],
        // Small bridge
        [28, 8, 8, 8, 1, 'hull'],
        [30, 10, 4, 4, 0, 'accent'],
        // Support struts
        [6, 24, 8, 14, 0, 'wing'],
        [50, 24, 8, 14, 0, 'wing'],
        // Engine array
        [16, 44, 10, 4, 0, 'hull'],
        [30, 44, 4, 4, 0, 'hull'],
        [38, 44, 10, 4, 0, 'hull'],
        [18, 48, 6, 4, 0, 'engine'],
        [31, 48, 2, 3, 1, 'engine'],
        [40, 48, 6, 4, 0, 'engine'],
      ],
      enginePoints: [[18, 48, 6, 5], [31, 48, 2, 3], [40, 48, 6, 5]],
      beaconPoints: [[31, 9], [9, 26], [54, 26]],
    },
  };

  // Regime → Blueprint pools
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
  // PALETTE GENERATION - Cached pigments, letter→color mapping
  // ═══════════════════════════════════════════════════════════════════

  class PaletteGenerator {
    constructor(watercolorEngine = null) {
      this.wc = watercolorEngine;
      // Cache pigments array (ChatGPT fix)
      this._pigments = watercolorEngine?.getAllPigments?.() || null;
    }

    generate(ticker, telemetry = {}) {
      const signalState = telemetry.signalState || 'neutral';
      const stress = telemetry.damage || 0;
      const momentum = Math.max(-1, Math.min(1, Math.round((telemetry.momentum || 0) * 4) / 4));
      
      if (this.wc && this._pigments) {
        return this._generateWithWatercolor(ticker, signalState, stress, momentum);
      }
      return this._generateFallback(ticker, signalState, stress, momentum);
    }

    _generateWithWatercolor(ticker, signalState, stress, momentum) {
      const wc = this.wc;
      const all = this._pigments;
      const n = all.length || 1;
      const letters = (ticker || 'AAA').toUpperCase().padEnd(4, 'A');

      // Letter → pigment with prime multipliers
      const hullPig = all[(SeedUtils.letterIndex(letters[0]) * 7) % n];
      const wingPig = all[(SeedUtils.letterIndex(letters[1]) * 11) % n];
      const accentPig = all[(SeedUtils.letterIndex(letters[2]) * 13) % n];
      const engineBasePig = all[(SeedUtils.letterIndex(letters[3]) * 17) % n];

      let hullRamp = wc.getDilutionGradient(hullPig, 4);
      let wingRamp = wc.getDilutionGradient(wingPig, 4);

      const accentPalette = wc.generatePalette(accentPig, 'complementary');
      const accentColor = accentPalette[1]?.hex || accentPig?.hex || '#00FFFF';

      let enginePig = engineBasePig;
      if (momentum > 0.25) enginePig = wc.findPigment('Indian Yellow') || engineBasePig;
      else if (momentum < -0.25) enginePig = wc.findPigment('Carmine') || engineBasePig;
      const engineRamp = wc.getDilutionGradient(enginePig, 4);

      // Signal state tint
      if (signalState === 'bull') {
        const tint = wc.findPigment('Cyan');
        if (tint) hullRamp = hullRamp.map(c => wc.lerp(c, tint.hex, 0.15));
      } else if (signalState === 'bear') {
        const tint = wc.findPigment('Magenta') || wc.findPigment('Carmine');
        if (tint) hullRamp = hullRamp.map(c => wc.lerp(c, tint.hex, 0.15));
      }

      // Stress glaze
      if (stress > 0.3) {
        const stressPig = wc.findPigment("Payne's Grey") || wc.findPigment('English Red');
        if (stressPig) {
          hullRamp = hullRamp.map(c => wc.lerp(c, stressPig.hex, stress * 0.35));
          wingRamp = wingRamp.map(c => wc.lerp(c, stressPig.hex, stress * 0.25));
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

      let sat = signalState === 'bull' ? 50 : signalState === 'bear' ? 35 : 40;
      sat = sat * (1 - stress * 0.3);

      const makeRamp = (h, s) => [
        `hsl(${h}, ${s}%, 12%)`,
        `hsl(${h}, ${s}%, 22%)`,
        `hsl(${h}, ${s}%, 32%)`,
        `hsl(${h}, ${s}%, 42%)`
      ];

      const adjEngHue = momentum > 0.25 ? 45 : momentum < -0.25 ? 350 : engineHue;

      return {
        hull: makeRamp(hullHue, sat),
        wing: makeRamp(wingHue, sat * 0.9),
        accent: `hsl(${accentHue}, 70%, 60%)`,
        engine: [
          `hsl(${adjEngHue}, 90%, 50%)`,
          `hsl(${adjEngHue}, 85%, 65%)`,
          `hsl(${adjEngHue}, 80%, 80%)`,
          `hsl(${adjEngHue}, 70%, 95%)`
        ],
        damage: '#FF2975'
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // CANVAS RENDERER - Optional targetCanvas, cutout support
  // ═══════════════════════════════════════════════════════════════════

  class ShipRenderer {
    constructor(size = CONFIG.baseSize) {
      this.size = size;
      this.scale = size / CONFIG.baseSize;
    }

    // ChatGPT fix: optional targetCanvas to avoid allocation
    render(blueprint, palette, telemetry = {}, tickerSeed = 0, frameIndex = 0, targetCanvas = null) {
      const canvas = targetCanvas || document.createElement('canvas');
      if (!targetCanvas) {
        canvas.width = this.size;
        canvas.height = this.size;
      }
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, this.size, this.size);

      const bp = typeof blueprint === 'string' ? BLUEPRINTS[blueprint] : blueprint;
      if (!bp) return canvas;

      const params = getShipParams(tickerSeed, bp);
      const thrust = telemetry.thrust ?? 0.5;
      const damage = telemetry.damage ?? 0;
      const jitter = telemetry.jitter ?? 0;

      // Render solid layers first, then cutouts
      this._renderBlocks(ctx, bp.blocks, palette, damage, jitter, tickerSeed, frameIndex, params, false);
      this._renderBlocks(ctx, bp.blocks, palette, damage, jitter, tickerSeed, frameIndex, params, true);
      this._renderEngines(ctx, bp.enginePoints, palette.engine, thrust, tickerSeed, frameIndex);
      this._renderBeacons(ctx, bp.beaconPoints, palette.accent, telemetry.signalState, frameIndex);

      if (damage > 0.2) this._renderDamage(ctx, damage, tickerSeed, frameIndex);

      return canvas;
    }

    _renderBlocks(ctx, blocks, palette, damage, jitter, tickerSeed, frameIndex, params, cutoutPass) {
      const scale = this.scale;

      blocks.forEach((block, blockIndex) => {
        const [x, y, w, h, shadeIndex, layer, tag] = block;
        
        // Separate cutout pass
        const isCutout = layer === 'cutout';
        if (cutoutPass !== isCutout) return;

        const rand = SeedUtils.getBlockRng(tickerSeed, frameIndex, blockIndex);
        const jx = jitter > 0 ? (rand() - 0.5) * jitter * 2 : 0;
        const jy = jitter > 0 ? (rand() - 0.5) * jitter * 2 : 0;

        // Param offsets
        let offsetX = 0, offsetY = 0, offsetW = 0, offsetH = 0;
        if (tag && params) {
          if (tag.includes('wing-left') && params.wingSpan !== undefined) {
            offsetX = -params.wingSpan; offsetW = params.wingSpan;
          }
          if (tag.includes('wing-right') && params.wingSpan !== undefined) {
            offsetW = params.wingSpan;
          }
          if (tag.includes('nose') && params.noseLen !== undefined) {
            offsetY = -params.noseLen; offsetH = params.noseLen;
          }
          if (tag.includes('pod-left') && params.podSize !== undefined) {
            offsetX = -params.podSize; offsetW = params.podSize;
          }
          if (tag.includes('pod-right') && params.podSize !== undefined) {
            offsetW = params.podSize;
          }
          if (tag.includes('bridge') && params.bridgeHeight !== undefined) {
            offsetY = -params.bridgeHeight; offsetH = params.bridgeHeight;
          }
          if (tag.includes('weapon') && params.weaponLen !== undefined) {
            if (tag.includes('left')) offsetX = -params.weaponLen;
            offsetW = params.weaponLen;
          }
          if (tag.includes('spine') && params.spineLen !== undefined) {
            offsetH = params.spineLen;
          }
          if (tag.includes('dish') && params.dishSize !== undefined) {
            offsetX = -params.dishSize / 2; offsetW = params.dishSize;
          }
          if (tag.includes('stabilizer') && params.stabilizerSize !== undefined) {
            offsetW = params.stabilizerSize;
          }
        }

        // Cutouts erase pixels
        if (isCutout) {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.fillStyle = 'rgba(0,0,0,1)';
        } else {
          ctx.globalCompositeOperation = 'source-over';
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

          // Damage: skip some hull/wing blocks
          if (damage > 0.3 && (layer === 'hull' || layer === 'wing') && rand() < damage * 0.3) return;
        }

        ctx.fillRect(
          Math.round((x + jx + offsetX) * scale),
          Math.round((y + jy + offsetY) * scale),
          Math.ceil((w + offsetW) * scale),
          Math.ceil((h + offsetH) * scale)
        );
      });

      ctx.globalCompositeOperation = 'source-over';
    }

    _renderEngines(ctx, enginePoints, engineColors, thrust, tickerSeed, frameIndex) {
      if (!enginePoints) return;
      const scale = this.scale;
      const thrustLen = thrust * 1.5;

      enginePoints.forEach((pt, i) => {
        const [x, y, w, maxLen] = pt;
        const len = maxLen * thrustLen;
        const rand = SeedUtils.getBlockRng(tickerSeed, frameIndex, 1000 + i);

        for (let j = 0; j < len; j++) {
          const ci = Math.min(Math.floor((j / len) * engineColors.length), engineColors.length - 1);
          ctx.fillStyle = engineColors[ci];
          ctx.globalAlpha = 1 - (j / len) * 0.7;
          const flickerW = w * (0.8 + rand() * 0.4);
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
          Math.round((18 + rand() * 28) * scale),
          Math.round((8 + rand() * 48) * scale),
          Math.ceil(2 * scale), Math.ceil(2 * scale)
        );
      }
      ctx.globalAlpha = 1;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER CACHE - Aligned quantization
  // ═══════════════════════════════════════════════════════════════════

  class RenderCache {
    constructor(maxSize = CONFIG.maxCacheSize) {
      this.cache = new Map();
      this.maxSize = maxSize;
    }

    _hashTelemetry(telemetry) {
      const regime = telemetry.regime || 'RANGE';
      const signal = telemetry.signalState || 'neutral';
      // Align quantization with palette (ChatGPT suggestion)
      const thrust = Math.round((telemetry.thrust ?? 0.5) * 10);
      const damage = Math.round((telemetry.damage ?? 0) * 10);
      const momentum = Math.round((telemetry.momentum ?? 0) * 4); // quarters
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
  // MAIN ENGINE
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

    renderShip(ticker, telemetry = {}, size = CONFIG.baseSize, targetCanvas = null) {
      if (!targetCanvas) {
        const cached = this.cache.get(ticker, size, telemetry);
        if (cached) return cached;
      }

      const seed = this.getSeed(ticker);
      const blueprintName = chooseBlueprint(ticker, telemetry, seed);
      const palette = this.paletteGenerator.generate(ticker, telemetry);
      const renderer = new ShipRenderer(size);
      const canvas = renderer.render(blueprintName, palette, telemetry, seed, 0, targetCanvas);

      if (!targetCanvas) this.cache.set(ticker, size, telemetry, canvas);
      return canvas;
    }

    renderToDataURL(ticker, telemetry = {}, size = CONFIG.baseSize) {
      return this.renderShip(ticker, telemetry, size).toDataURL('image/png');
    }

    renderToCanvas(targetCanvas, ticker, telemetry = {}) {
      const size = Math.min(targetCanvas.width, targetCanvas.height);
      this.renderShip(ticker, telemetry, size, targetCanvas);
    }

    createAnimatedSprite(ticker, telemetry = {}, size = CONFIG.baseSize) {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      canvas.dataset.ticker = ticker;

      const seed = this.getSeed(ticker);
      const blueprintName = chooseBlueprint(ticker, telemetry, seed);
      const renderer = new ShipRenderer(size);

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
          renderer.render(blueprintName, palette, animTelemetry, seed, frameIndex, canvas);
        }
        requestAnimationFrame(animate);
      };

      requestAnimationFrame(animate);
      canvas.stopAnimation = () => { animating = false; };
      canvas.startAnimation = () => { if (!animating) { animating = true; requestAnimationFrame(animate); } };
      return canvas;
    }

    // ChatGPT fix: don't call chooseBlueprint twice
    getShipInfo(ticker, telemetry = {}) {
      const seed = this.getSeed(ticker);
      const blueprint = chooseBlueprint(ticker, telemetry, seed);
      return {
        ticker,
        seed,
        seedHex: seed.toString(16).toUpperCase().padStart(8, '0'),
        blueprint,
        blueprintData: BLUEPRINTS[blueprint],
        params: getShipParams(seed, blueprint),
        regime: telemetry.regime || 'RANGE',
        letters: (ticker || 'AAAA').toUpperCase().padEnd(4, 'A').split('')
      };
    }

    getBlueprints() { return Object.keys(BLUEPRINTS); }
    getBlueprintData(name) { return BLUEPRINTS[name]; }
    clearCache() { this.cache.clear(); }
  }

  // Exports
  global.PixelShipEngine = PixelShipEngine;
  global.SHIP_BLUEPRINTS = BLUEPRINTS;
  global.ShipRenderer = ShipRenderer;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PixelShipEngine, BLUEPRINTS, ShipRenderer };
  }

})(typeof window !== 'undefined' ? window : global);
