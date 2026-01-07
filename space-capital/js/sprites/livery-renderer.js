/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SPACE CAPITAL - LIVERY RENDERER
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Bridges the LiverySystem with sprite rendering.
 * Applies livery colors to ship sprites using canvas recoloring.
 * 
 * Works with:
 * - ShipAnimator (animated sprites in hangar)
 * - Static ship images
 * - Fleet cards and thumbnails
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

window.LiveryRenderer = (function() {
  'use strict';

  // Canvas cache for recolored sprites
  const spriteCache = new Map();

  // ═══════════════════════════════════════════════════════════════════════════
  // COLOR UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
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
    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  function hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
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
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SPRITE RECOLORING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Recolor a sprite image with a livery palette
   * Uses hue/saturation shifting to preserve luminance detail
   */
  function recolorSprite(image, colorMap, options = {}) {
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    
    if (!width || !height) return null;

    // Create offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // Draw original
    ctx.drawImage(image, 0, 0);

    // Get image data
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Get primary and secondary colors from color map
    const primary = hexToRgb(colorMap.hull || colorMap.primary || '#33ff99');
    const secondary = hexToRgb(colorMap.trim || colorMap.secondary || '#00cc77');
    const highlight = hexToRgb(colorMap.engines || colorMap.highlight || '#66ffcc');

    const primaryHsl = rgbToHsl(primary.r, primary.g, primary.b);
    const secondaryHsl = rgbToHsl(secondary.r, secondary.g, secondary.b);

    // Process each pixel
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // Skip transparent pixels
      if (a < 10) continue;

      // Skip near-black and near-white (outlines and highlights)
      const brightness = (r + g + b) / 3;
      if (brightness < 20 || brightness > 240) continue;

      // Get current HSL
      const hsl = rgbToHsl(r, g, b);

      // Determine which color to shift to based on saturation and hue
      let targetHsl;
      
      if (hsl.s > 20) {
        // Colored pixels - shift to primary or secondary based on hue region
        if (hsl.l > 60) {
          // Lighter areas get highlight treatment
          targetHsl = { h: primaryHsl.h, s: primaryHsl.s * 0.8, l: hsl.l };
        } else if (hsl.l < 40) {
          // Darker areas get secondary treatment
          targetHsl = { h: secondaryHsl.h, s: secondaryHsl.s, l: hsl.l };
        } else {
          // Mid-tones get primary
          targetHsl = { h: primaryHsl.h, s: primaryHsl.s, l: hsl.l };
        }
      } else {
        // Desaturated pixels - subtle tinting only
        targetHsl = { 
          h: primaryHsl.h, 
          s: Math.min(hsl.s + 10, primaryHsl.s * 0.3), 
          l: hsl.l 
        };
      }

      // Convert back to RGB
      const newRgb = hslToRgb(targetHsl.h, targetHsl.s, targetHsl.l);
      
      data[i] = newRgb.r;
      data[i + 1] = newRgb.g;
      data[i + 2] = newRgb.b;
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  /**
   * Apply livery to a ship image element
   */
  function applyLiveryToImage(imgElement, ticker, shipClass) {
    if (!window.LiverySystem) return;

    const colorOverride = LiverySystem.getColorOverride(ticker, shipClass);
    if (!colorOverride) return;

    // Check cache first
    const cacheKey = `${ticker}_${JSON.stringify(colorOverride.baseColors)}`;
    if (spriteCache.has(cacheKey)) {
      imgElement.src = spriteCache.get(cacheKey);
      return;
    }

    // Load and recolor
    const tempImg = new Image();
    tempImg.crossOrigin = 'anonymous';
    tempImg.onload = () => {
      const canvas = recolorSprite(tempImg, colorOverride.colorMap);
      if (canvas) {
        const dataUrl = canvas.toDataURL('image/png');
        spriteCache.set(cacheKey, dataUrl);
        imgElement.src = dataUrl;
      }
    };
    tempImg.src = imgElement.src;
  }

  /**
   * Apply livery to all ships in a container
   */
  function applyLiveriesToContainer(container) {
    if (!window.LiverySystem) return;

    const shipImages = container.querySelectorAll('[data-ticker] img, .ship-sprite[data-ticker]');
    
    shipImages.forEach(img => {
      const ticker = img.dataset.ticker || img.closest('[data-ticker]')?.dataset.ticker;
      const shipClass = img.dataset.class || img.closest('[data-class]')?.dataset.class || 'Ship';
      
      if (ticker) {
        applyLiveryToImage(img, ticker, shipClass);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FLEET GRID INTEGRATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get CSS for livery accent color (for borders, glows, etc)
   */
  function getLiveryAccentColor(ticker) {
    if (!window.LiverySystem) return null;

    const livery = LiverySystem.getLiveryForTicker(ticker);
    if (!livery) return null;

    return livery.palette.baseColors[0] || '#33ff99';
  }

  /**
   * Apply livery accent colors to fleet cards
   */
  function styleFleetCards() {
    if (!window.LiverySystem) return;

    document.querySelectorAll('.fleet-ship-card[data-ticker]').forEach(card => {
      const ticker = card.dataset.ticker;
      const accent = getLiveryAccentColor(ticker);
      
      if (accent) {
        card.style.setProperty('--livery-accent', accent);
        card.classList.add('has-livery');
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HANGAR INTEGRATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Apply livery to hangar hero ship
   */
  function applyToHangarHero() {
    const heroContainer = document.getElementById('hero-ship-container');
    if (!heroContainer) return;

    const heroImg = heroContainer.querySelector('img.ship-sprite');
    if (!heroImg) return;

    const ticker = window.currentHangarTicker;
    if (!ticker) return;

    // Get ship class
    let shipClass = 'Ship';
    if (window.SHIP_DATA) {
      const ship = window.SHIP_DATA.find(s => s.ticker === ticker);
      if (ship) shipClass = ship.class;
    }

    applyLiveryToImage(heroImg, ticker, shipClass);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION & AUTO-UPDATE
  // ═══════════════════════════════════════════════════════════════════════════

  function init() {
    // Listen for livery assignments
    document.addEventListener('livery:assigned', (e) => {
      const { ticker } = e.detail;
      
      // Update any visible sprites for this ticker
      document.querySelectorAll(`[data-ticker="${ticker}"] img, img[data-ticker="${ticker}"]`).forEach(img => {
        const shipClass = img.dataset.class || 'Ship';
        applyLiveryToImage(img, ticker, shipClass);
      });

      // Update hangar if it's the current ship
      if (ticker === window.currentHangarTicker) {
        applyToHangarHero();
      }

      styleFleetCards();
    });

    // Listen for fleet-wide livery application
    document.addEventListener('livery:fleetApplied', () => {
      applyLiveriesToContainer(document.body);
      styleFleetCards();
    });

    // Listen for hangar ship selection
    document.addEventListener('hangar:shipSelected', (e) => {
      if (e.detail && e.detail.ticker) {
        setTimeout(applyToHangarHero, 200);
      }
    });

    console.log('[LiveryRenderer] Initialized');
  }

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    recolorSprite,
    applyLiveryToImage,
    applyLiveriesToContainer,
    applyToHangarHero,
    getLiveryAccentColor,
    styleFleetCards,
    clearCache: () => spriteCache.clear()
  };

})();
