/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SPACE CAPITAL - Mold Composer
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Renders ships from high-quality sprite molds with:
 * - Deterministic palette recoloring (ticker → unique colors)
 * - Telemetry-driven effects (glow, damage, stress)
 * - Support for future part-based kitbashing
 * 
 * This replaces the block-based procedural rendering with real pixel art.
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // DETERMINISTIC RANDOM (from seed.js)
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
  // COLOR UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  function hslToRgb(h, s, l) {
    h = h / 360;
    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return [h * 360, s, l];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PALETTE GENERATOR
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generate a deterministic color palette for a ticker
   */
  function generatePalette(ticker, telemetry = {}) {
    const rand = seededRandom(ticker, 'palette');
    
    // Base hue from ticker hash
    const baseHue = (hashString(ticker) % 360);
    
    // Shift hue based on signal state
    let hueShift = 0;
    if (telemetry.signalState === 'bull') hueShift = -20;  // Warmer
    if (telemetry.signalState === 'bear') hueShift = 20;   // Cooler
    
    const primaryHue = (baseHue + hueShift + 360) % 360;
    const accentHue = (primaryHue + 120 + rand() * 60) % 360;
    const glowHue = (primaryHue + 180 + rand() * 40) % 360;
    
    // Saturation based on thrust/momentum
    const thrust = telemetry.thrust || 0.5;
    const baseSat = 0.3 + thrust * 0.4;
    
    // Generate the palette
    return {
      primary: {
        dark:   hslToRgb(primaryHue, baseSat * 0.6, 0.15),
        mid:    hslToRgb(primaryHue, baseSat, 0.35),
        light:  hslToRgb(primaryHue, baseSat * 0.8, 0.55),
        bright: hslToRgb(primaryHue, baseSat * 0.5, 0.75),
      },
      accent: {
        dark:   hslToRgb(accentHue, baseSat * 0.8, 0.25),
        mid:    hslToRgb(accentHue, baseSat, 0.45),
        light:  hslToRgb(accentHue, baseSat * 0.9, 0.65),
        bright: hslToRgb(accentHue, baseSat * 0.6, 0.85),
      },
      glow: {
        core:   hslToRgb(glowHue, 0.9, 0.6),
        outer:  hslToRgb(glowHue, 0.7, 0.4),
      },
      // Hotline Miami neon accents
      neon: {
        magenta: [255, 0, 128],
        cyan:    [0, 255, 255],
        yellow:  [255, 255, 0],
      },
      hue: primaryHue,
      saturation: baseSat,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MOLD COMPOSER CLASS
  // ═══════════════════════════════════════════════════════════════════════════

  class MoldComposer {
    constructor(options = {}) {
      this.basePath = options.basePath || 'assets/molds/';
      this.atlas = null;
      this.imageCache = new Map();
      this.bitmapCache = new Map();
      this.ready = false;
      this.loadPromise = null;
    }

    /**
     * Load the atlas and preload all mold images
     */
    async load(atlasData = null) {
      if (this.loadPromise) return this.loadPromise;
      
      this.loadPromise = this._doLoad(atlasData);
      return this.loadPromise;
    }

    async _doLoad(atlasData) {
      try {
        // Load atlas
        if (atlasData) {
          this.atlas = atlasData;
        } else {
          const response = await fetch(this.basePath + 'atlas.json');
          this.atlas = await response.json();
        }

        // Preload all ship images
        const loadPromises = [];
        for (const [ticker, shipData] of Object.entries(this.atlas.ships)) {
          loadPromises.push(this._loadImage(ticker, shipData.src));
        }
        
        await Promise.all(loadPromises);
        
        this.ready = true;
        console.log(`[MoldComposer] Loaded ${Object.keys(this.atlas.ships).length} ship molds`);
        return true;
      } catch (e) {
        console.error('[MoldComposer] Failed to load:', e);
        return false;
      }
    }

    /**
     * Load and cache an image
     */
    async _loadImage(ticker, src) {
      const fullPath = this.basePath + src;
      
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = async () => {
          this.imageCache.set(ticker, img);
          
          // Create ImageBitmap for faster rendering
          try {
            const bitmap = await createImageBitmap(img);
            this.bitmapCache.set(ticker, bitmap);
          } catch (e) {
            // ImageBitmap not supported, use Image
          }
          
          resolve(img);
        };
        
        img.onerror = () => {
          console.warn(`[MoldComposer] Failed to load image for ${ticker}: ${fullPath}`);
          resolve(null); // Don't reject, just resolve with null
        };
        
        img.src = fullPath;
      });
    }

    /**
     * Check if a mold exists for a ticker
     */
    hasMold(ticker) {
      return this.atlas?.ships?.[ticker] != null || this.imageCache.has(ticker);
    }

    /**
     * Get the source image for a ticker (with fallback)
     */
    getSourceImage(ticker) {
      // Direct match
      if (this.bitmapCache.has(ticker)) return this.bitmapCache.get(ticker);
      if (this.imageCache.has(ticker)) return this.imageCache.get(ticker);
      
      // Fallback to Unclaimed
      if (this.bitmapCache.has('Unclaimed')) return this.bitmapCache.get('Unclaimed');
      if (this.imageCache.has('Unclaimed')) return this.imageCache.get('Unclaimed');
      
      return null;
    }

    /**
     * Get ship metadata
     */
    getShipData(ticker) {
      return this.atlas?.ships?.[ticker] || this.atlas?.ships?.['Unclaimed'] || {
        class: 'unknown',
        traits: [],
        paletteZones: {}
      };
    }

    /**
     * Render a ship to a canvas with palette recoloring and effects
     */
    renderToCanvas(canvas, ticker, telemetry = {}, size = 128) {
      if (!this.ready) {
        console.warn('[MoldComposer] Not ready yet');
        return false;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return false;

      // Ensure canvas is sized correctly
      if (canvas.width !== size || canvas.height !== size) {
        canvas.width = size;
        canvas.height = size;
      }

      // Clear canvas
      ctx.clearRect(0, 0, size, size);

      // Get source image
      const sourceImg = this.getSourceImage(ticker);
      if (!sourceImg) {
        console.warn(`[MoldComposer] No image for ${ticker}`);
        return false;
      }

      // Generate palette
      const palette = generatePalette(ticker, telemetry);
      const shipData = this.getShipData(ticker);

      // Create offscreen canvas for processing
      const offscreen = document.createElement('canvas');
      offscreen.width = 256;  // Work at full resolution
      offscreen.height = 256;
      const offCtx = offscreen.getContext('2d');

      // Draw base image
      offCtx.drawImage(sourceImg, 0, 0, 256, 256);

      // Apply palette tinting
      this._applyPaletteTint(offCtx, palette, telemetry);

      // Apply telemetry effects
      this._applyTelemetryEffects(offCtx, telemetry, palette);

      // Draw to target canvas (scaled)
      ctx.imageSmoothingEnabled = false; // Crisp pixel art
      ctx.drawImage(offscreen, 0, 0, 256, 256, 0, 0, size, size);

      return true;
    }

    /**
     * Apply palette-based tinting to the image
     */
    _applyPaletteTint(ctx, palette, telemetry) {
      const imageData = ctx.getImageData(0, 0, 256, 256);
      const data = imageData.data;

      const thrust = telemetry.thrust || 0.5;
      const damage = telemetry.damage || 0;
      
      // Calculate tint color based on palette
      const tintStrength = 0.3 + thrust * 0.2;
      const [tintR, tintG, tintB] = palette.primary.mid;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a === 0) continue; // Skip transparent pixels

        // Get pixel luminance
        const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;

        // Apply tint based on luminance zones
        if (lum > 0.6) {
          // Highlights - subtle tint
          data[i]     = Math.min(255, r + (tintR - 128) * tintStrength * 0.3);
          data[i + 1] = Math.min(255, g + (tintG - 128) * tintStrength * 0.3);
          data[i + 2] = Math.min(255, b + (tintB - 128) * tintStrength * 0.3);
        } else if (lum > 0.3) {
          // Midtones - stronger tint
          data[i]     = Math.round(r * (1 - tintStrength) + tintR * tintStrength);
          data[i + 1] = Math.round(g * (1 - tintStrength) + tintG * tintStrength);
          data[i + 2] = Math.round(b * (1 - tintStrength) + tintB * tintStrength);
        } else {
          // Shadows - preserve darkness, add color
          const shadowTint = tintStrength * 0.5;
          data[i]     = Math.round(r * (1 - shadowTint) + palette.primary.dark[0] * shadowTint);
          data[i + 1] = Math.round(g * (1 - shadowTint) + palette.primary.dark[1] * shadowTint);
          data[i + 2] = Math.round(b * (1 - shadowTint) + palette.primary.dark[2] * shadowTint);
        }

        // Apply damage desaturation
        if (damage > 0) {
          const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
          const damageAmount = damage * 0.4;
          data[i]     = Math.round(data[i] * (1 - damageAmount) + gray * damageAmount);
          data[i + 1] = Math.round(data[i + 1] * (1 - damageAmount) + gray * damageAmount);
          data[i + 2] = Math.round(data[i + 2] * (1 - damageAmount) + gray * damageAmount);
        }
      }

      ctx.putImageData(imageData, 0, 0);
    }

    /**
     * Apply telemetry-driven visual effects
     */
    _applyTelemetryEffects(ctx, telemetry, palette) {
      const thrust = telemetry.thrust || 0.5;
      const glow = telemetry.glow || 0.5;
      const damage = telemetry.damage || 0;
      const signalState = telemetry.signalState || 'neutral';

      // Engine glow effect
      if (thrust > 0.3) {
        const glowIntensity = (thrust - 0.3) / 0.7;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = glowIntensity * 0.4;
        
        // Create radial gradient for engine glow
        const gradient = ctx.createRadialGradient(128, 200, 0, 128, 200, 60);
        gradient.addColorStop(0, `rgb(${palette.glow.core.join(',')})`);
        gradient.addColorStop(0.5, `rgba(${palette.glow.outer.join(',')}, 0.5)`);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(68, 160, 120, 96);
        ctx.restore();
      }

      // Signal state glow (bull/bear indicator)
      if (signalState !== 'neutral') {
        ctx.save();
        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = 0.15;
        
        if (signalState === 'bull') {
          ctx.fillStyle = 'rgba(0, 255, 128, 1)';  // Green
        } else {
          ctx.fillStyle = 'rgba(255, 64, 64, 1)';  // Red
        }
        
        ctx.fillRect(0, 0, 256, 256);
        ctx.restore();
      }

      // Damage sparks
      if (damage > 0.3) {
        const rand = seededRandom(Date.now().toString(), 'sparks');
        const sparkCount = Math.floor(damage * 8);
        
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        
        for (let i = 0; i < sparkCount; i++) {
          const x = 40 + rand() * 176;
          const y = 40 + rand() * 176;
          const sparkSize = 2 + rand() * 4;
          
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, sparkSize);
          gradient.addColorStop(0, 'rgba(255, 200, 100, 0.9)');
          gradient.addColorStop(0.5, 'rgba(255, 100, 50, 0.5)');
          gradient.addColorStop(1, 'rgba(255, 50, 0, 0)');
          
          ctx.fillStyle = gradient;
          ctx.fillRect(x - sparkSize, y - sparkSize, sparkSize * 2, sparkSize * 2);
        }
        
        ctx.restore();
      }

      // Hotline Miami neon edge glow (subtle)
      if (glow > 0.5) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = (glow - 0.5) * 0.3;
        ctx.shadowColor = `rgb(${palette.neon.magenta.join(',')})`;
        ctx.shadowBlur = 8;
        
        // Draw outline
        ctx.strokeStyle = `rgba(${palette.neon.magenta.join(',')}, 0.3)`;
        ctx.lineWidth = 2;
        ctx.strokeRect(20, 20, 216, 216);
        
        ctx.restore();
      }
    }

    /**
     * Get ship info for display
     */
    getShipInfo(ticker) {
      const shipData = this.getShipData(ticker);
      return {
        ticker,
        shipClass: shipData.class,
        traits: shipData.traits,
        hasMold: this.hasMold(ticker),
      };
    }

    /**
     * Clear all caches
     */
    clearCache() {
      this.bitmapCache.forEach(bitmap => bitmap.close?.());
      this.bitmapCache.clear();
      this.imageCache.clear();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════════════

  global.MoldComposer = MoldComposer;
  global.generateShipPalette = generatePalette;

  console.log('[MoldComposer] Module loaded');

})(typeof window !== 'undefined' ? window : global);
