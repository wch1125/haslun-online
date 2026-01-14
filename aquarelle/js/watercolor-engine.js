/**
 * Watercolor Engine v1.0
 * Color mixing and glazing calculations based on real pigment data
 * 
 * Usage (Browser):
 *   <script src="watercolor-engine.js"></script>
 *   const engine = new WatercolorEngine();
 *   const glazed = engine.glaze('#FCFAF5', 'Indian Yellow');
 * 
 * Usage (ES Module):
 *   import { WatercolorEngine } from './watercolor-engine.js';
 */

(function(global) {
  'use strict';

  // ===========================================================================
  // PIGMENT DATA (Schmincke AKADEMIE Aquarell)
  // ===========================================================================
  const PIGMENTS = [
    { id: '111', name: 'Deckweiß', nameEn: 'Opaque White', hex: '#F5F5F0', pigments: ['PW6'], transparency: 'opaque', family: 'white' },
    { id: '222', name: 'Hellgelb zitron', nameEn: 'Lemon Yellow', hex: '#F7E855', pigments: ['PY3'], transparency: 'semi-transparent', family: 'yellow' },
    { id: '224', name: 'Kadmiumgelbton', nameEn: 'Cadmium Yellow', hex: '#F5D328', pigments: ['PY151'], transparency: 'semi-transparent', family: 'yellow' },
    { id: '225', name: 'Indischgelb', nameEn: 'Indian Yellow', hex: '#F5B830', pigments: ['PY110', 'PY154'], transparency: 'transparent', family: 'yellow' },
    { id: '226', name: 'Neapelgelb', nameEn: 'Naples Yellow', hex: '#F5D8A0', pigments: ['PW6', 'PR242', 'PY42'], transparency: 'opaque', family: 'yellow' },
    { id: '330', name: 'Orange', nameEn: 'Orange', hex: '#F58025', pigments: ['PO71'], transparency: 'semi-transparent', family: 'orange' },
    { id: '332', name: 'Kadmiumrotton', nameEn: 'Cadmium Red', hex: '#E54530', pigments: ['PR255'], transparency: 'opaque', family: 'red' },
    { id: '333', name: 'Karmin', nameEn: 'Carmine', hex: '#C42045', pigments: ['PV19'], transparency: 'semi-opaque', family: 'red' },
    { id: '336', name: 'Magenta', nameEn: 'Magenta', hex: '#C43070', pigments: ['PV42'], transparency: 'semi-transparent', family: 'red' },
    { id: '440', name: 'Violett', nameEn: 'Violet', hex: '#7A5090', pigments: ['PV55'], transparency: 'semi-transparent', family: 'violet' },
    { id: '442', name: 'Indigo', nameEn: 'Indigo', hex: '#304060', pigments: ['PB15:1', 'PB66'], transparency: 'opaque', family: 'blue' },
    { id: '443', name: 'Ultramarin', nameEn: 'Ultramarine', hex: '#2850A0', pigments: ['PB29'], transparency: 'semi-transparent', family: 'blue' },
    { id: '445', name: 'Preußischblau', nameEn: 'Prussian Blue', hex: '#1A3050', pigments: ['PB27'], transparency: 'semi-opaque', family: 'blue' },
    { id: '448', name: 'Cyan', nameEn: 'Cyan', hex: '#0088B0', pigments: ['PB15:3'], transparency: 'semi-transparent', family: 'blue' },
    { id: '551', name: 'Brillantgrün', nameEn: 'Brilliant Green', hex: '#00A070', pigments: ['PG7'], transparency: 'semi-transparent', family: 'green' },
    { id: '552', name: 'Maigrün', nameEn: 'May Green', hex: '#70C040', pigments: ['PY151', 'PG7'], transparency: 'semi-transparent', family: 'green' },
    { id: '553', name: 'Permanentgrün', nameEn: 'Permanent Green', hex: '#408050', pigments: ['PO62', 'PG7'], transparency: 'semi-opaque', family: 'green' },
    { id: '554', name: 'Oliv Gelbgrün', nameEn: 'Olive Green', hex: '#687830', pigments: ['PO62', 'PG36'], transparency: 'semi-opaque', family: 'green' },
    { id: '660', name: 'Lichter Ocker', nameEn: 'Yellow Ochre', hex: '#C8A050', pigments: ['PY42'], transparency: 'semi-opaque', family: 'earth' },
    { id: '664', name: 'Umbra gebrannt', nameEn: 'Burnt Umber', hex: '#604030', pigments: ['PBr7'], transparency: 'semi-opaque', family: 'earth' },
    { id: '665', name: 'Sepia', nameEn: 'Sepia', hex: '#483828', pigments: ['PB15:1', 'PBr7', 'PBk6'], transparency: 'semi-opaque', family: 'earth' },
    { id: '666', name: 'Englischrot', nameEn: 'English Red', hex: '#A04030', pigments: ['PR101'], transparency: 'opaque', family: 'earth' },
    { id: '770', name: 'Paynesgrau', nameEn: "Payne's Grey", hex: '#384858', pigments: ['PR101', 'PBk7', 'PB29'], transparency: 'semi-opaque', family: 'neutral' },
    { id: '782', name: 'Schwarz', nameEn: 'Black', hex: '#202020', pigments: ['PBk6'], transparency: 'opaque', family: 'neutral' },
  ];

  const TRANSPARENCY_MAP = {
    'transparent': 0.45,
    'semi-transparent': 0.55,
    'semi-opaque': 0.70,
    'opaque': 0.85,
  };

  const PAPER_WHITE = '#FCFAF5';

  // ===========================================================================
  // COLOR UTILITIES
  // ===========================================================================
  
  /**
   * Convert hex color to RGB array
   * @param {string} hex - Color in hex format (#RRGGBB or RRGGBB)
   * @returns {number[]} [r, g, b] values 0-255
   */
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result 
      ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] 
      : [0, 0, 0];
  }

  /**
   * Convert RGB values to hex string
   * @param {number} r - Red 0-255
   * @param {number} g - Green 0-255
   * @param {number} b - Blue 0-255
   * @returns {string} Hex color (#RRGGBB)
   */
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b]
      .map(x => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }

  /**
   * Convert RGB to HSL
   * @param {number} r - Red 0-255
   * @param {number} g - Green 0-255
   * @param {number} b - Blue 0-255
   * @returns {number[]} [h, s, l] where h is 0-360, s and l are 0-1
   */
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

  /**
   * Convert HSL to RGB
   * @param {number} h - Hue 0-360
   * @param {number} s - Saturation 0-1
   * @param {number} l - Lightness 0-1
   * @returns {number[]} [r, g, b] values 0-255
   */
  function hslToRgb(h, s, l) {
    h /= 360;
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

  /**
   * Linear interpolation between two colors
   * @param {string} colorA - First hex color
   * @param {string} colorB - Second hex color
   * @param {number} t - Interpolation factor 0-1
   * @returns {string} Interpolated hex color
   */
  function lerpColor(colorA, colorB, t) {
    const rgbA = hexToRgb(colorA);
    const rgbB = hexToRgb(colorB);
    const mixed = rgbA.map((a, i) => Math.round(a + (rgbB[i] - a) * t));
    return rgbToHex(...mixed);
  }

  /**
   * Calculate relative luminance (for contrast calculations)
   * @param {string} hex - Hex color
   * @returns {number} Luminance 0-1
   */
  function getLuminance(hex) {
    const rgb = hexToRgb(hex).map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  }

  /**
   * Get contrast ratio between two colors
   * @param {string} color1 - First hex color
   * @param {string} color2 - Second hex color
   * @returns {number} Contrast ratio (1-21)
   */
  function getContrastRatio(color1, color2) {
    const l1 = getLuminance(color1);
    const l2 = getLuminance(color2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  // ===========================================================================
  // GLAZING CALCULATIONS
  // ===========================================================================

  /**
   * Simulate watercolor glazing - applying a transparent layer over a base
   * This models how light passes through pigment layers to paper and back
   * 
   * @param {string} baseHex - Base color (paper or previous layer)
   * @param {object} topLayer - Pigment object with hex and transparency
   * @returns {string} Resulting glazed hex color
   */
  function glazeColors(baseHex, topLayer) {
    const baseRgb = hexToRgb(baseHex);
    const topRgb = hexToRgb(topLayer.hex);
    const opacity = TRANSPARENCY_MAP[topLayer.transparency];
    
    let result;
    if (topLayer.transparency === 'opaque') {
      // Opaque colors mostly cover the base
      result = baseRgb.map((v, i) => v * (1 - opacity * 0.8) + topRgb[i] * opacity * 0.8);
    } else {
      // Transparent/semi-transparent colors multiply with the base
      // This simulates light passing through the pigment layer
      const mult = baseRgb.map((v, i) => (v / 255) * (topRgb[i] / 255) * 255);
      result = baseRgb.map((v, i) => v * (1 - opacity) + (mult[i] * 0.6 + topRgb[i] * 0.4) * opacity);
    }
    
    return rgbToHex(...result);
  }

  /**
   * Apply multiple glaze layers in sequence
   * @param {object[]} layers - Array of pigment objects, bottom to top
   * @param {string} paper - Paper color (default: warm white)
   * @returns {string} Final glazed hex color
   */
  function glazeStack(layers, paper = PAPER_WHITE) {
    return layers.reduce((base, layer) => glazeColors(base, layer), paper);
  }

  /**
   * Glaze with dilution control
   * Dilution affects how much pigment vs water - more dilution = more transparent
   * @param {string} baseHex - Base color
   * @param {object} pigment - Pigment object
   * @param {number} dilution - 0.2 (concentrated) to 1.0 (very watery)
   * @returns {string} Resulting hex color
   */
  function glazeWithDilution(baseHex, pigment, dilution = 0.6) {
    const baseRgb = hexToRgb(baseHex);
    const pigmentRgb = hexToRgb(pigment.hex);
    
    // Base opacity from pigment transparency
    const baseOpacity = TRANSPARENCY_MAP[pigment.transparency];
    
    // Dilution inverts: high dilution = low opacity (more water)
    // dilution 0.2 = concentrated = 90% of base opacity
    // dilution 1.0 = very watery = 20% of base opacity
    const dilutionFactor = 1.1 - dilution; // 0.9 to 0.1
    const effectiveOpacity = baseOpacity * dilutionFactor;
    
    let result;
    if (pigment.transparency === 'opaque' && dilution < 0.5) {
      // Concentrated opaque pigments cover more
      result = baseRgb.map((v, i) => v * (1 - effectiveOpacity * 0.85) + pigmentRgb[i] * effectiveOpacity * 0.85);
    } else {
      // Transparent/diluted colors use glazing math
      const mult = baseRgb.map((v, i) => (v / 255) * (pigmentRgb[i] / 255) * 255);
      result = baseRgb.map((v, i) => v * (1 - effectiveOpacity) + (mult[i] * 0.6 + pigmentRgb[i] * 0.4) * effectiveOpacity);
    }
    
    return rgbToHex(...result);
  }

  /**
   * Apply multiple glazes with individual dilution values
   * @param {Array} layersWithDilution - Array of {pigment, dilution} objects
   * @param {string} paper - Paper color
   * @returns {string} Final glazed hex color
   */
  function glazeMultipleWithDilution(layersWithDilution, paper = PAPER_WHITE) {
    return layersWithDilution.reduce((base, layer) => {
      const dilution = layer.dilution !== undefined ? layer.dilution : 0.6;
      return glazeWithDilution(base, layer.pigment || layer, dilution);
    }, paper);
  }

  /**
   * Generate a gradient of glaze strengths
   * @param {object} pigment - Pigment object
   * @param {number} steps - Number of gradient steps
   * @param {string} paper - Paper color
   * @returns {string[]} Array of hex colors from light to full strength
   */
  function glazeGradient(pigment, steps = 5, paper = PAPER_WHITE) {
    const colors = [];
    for (let i = 0; i < steps; i++) {
      const strength = (i + 1) / steps;
      // Simulate dilution by interpolating toward paper
      const diluted = lerpColor(paper, pigment.hex, strength);
      const dilutedPigment = { ...pigment, hex: diluted };
      colors.push(glazeColors(paper, dilutedPigment));
    }
    return colors;
  }

  // ===========================================================================
  // WATERCOLOR ENGINE CLASS
  // ===========================================================================

  class WatercolorEngine {
    constructor() {
      this.pigments = [...PIGMENTS];
      this.paperWhite = PAPER_WHITE;
    }

    // --- Pigment Queries ---

    /**
     * Get all pigments
     * @returns {object[]} Array of all pigment objects
     */
    getAllPigments() {
      return this.pigments;
    }

    /**
     * Find pigment by ID, name, or English name
     * @param {string} query - Search term
     * @returns {object|null} Pigment object or null
     */
    findPigment(query) {
      const q = query.toLowerCase();
      return this.pigments.find(p => 
        p.id === query ||
        p.name.toLowerCase().includes(q) ||
        p.nameEn.toLowerCase().includes(q)
      ) || null;
    }

    /**
     * Get pigments by family
     * @param {string} family - Color family (yellow, red, blue, green, earth, neutral)
     * @returns {object[]} Array of pigments in that family
     */
    getByFamily(family) {
      return this.pigments.filter(p => p.family === family);
    }

    /**
     * Get pigments by transparency level
     * @param {string} transparency - transparent, semi-transparent, semi-opaque, opaque
     * @returns {object[]} Array of matching pigments
     */
    getByTransparency(transparency) {
      return this.pigments.filter(p => p.transparency === transparency);
    }

    /**
     * Get transparent pigments (best for glazing)
     * @returns {object[]} Array of transparent and semi-transparent pigments
     */
    getGlazingPigments() {
      return this.pigments.filter(p => 
        p.transparency === 'transparent' || p.transparency === 'semi-transparent'
      );
    }

    // --- Color Operations ---

    /**
     * Glaze a pigment over a base color
     * @param {string} base - Base hex color
     * @param {string|object} pigment - Pigment name/ID or pigment object
     * @returns {string} Resulting hex color
     */
    glaze(base, pigment) {
      const p = typeof pigment === 'string' ? this.findPigment(pigment) : pigment;
      if (!p) throw new Error(`Pigment not found: ${pigment}`);
      return glazeColors(base, p);
    }

    /**
     * Apply multiple glazes in sequence
     * @param {(string|object)[]} pigments - Array of pigment names/IDs or objects
     * @param {string} paper - Starting paper color
     * @returns {string} Final glazed hex color
     */
    glazeMultiple(pigments, paper = this.paperWhite) {
      const layers = pigments.map(p => 
        typeof p === 'string' ? this.findPigment(p) : p
      ).filter(Boolean);
      return glazeStack(layers, paper);
    }

    /**
     * Apply multiple glazes with individual dilution control
     * @param {Array} layersWithDilution - Array of {pigment, dilution} objects
     * @param {string} paper - Starting paper color
     * @returns {string} Final glazed hex color
     */
    glazeMultipleWithDilution(layersWithDilution, paper = this.paperWhite) {
      return glazeMultipleWithDilution(layersWithDilution, paper);
    }

    /**
     * Get a dilution gradient for a pigment
     * @param {string|object} pigment - Pigment name/ID or object
     * @param {number} steps - Number of steps
     * @returns {string[]} Array of hex colors
     */
    getDilutionGradient(pigment, steps = 5) {
      const p = typeof pigment === 'string' ? this.findPigment(pigment) : pigment;
      if (!p) throw new Error(`Pigment not found: ${pigment}`);
      return glazeGradient(p, steps, this.paperWhite);
    }

    /**
     * Compare two layer orderings
     * @param {string|object} pigmentA - First pigment
     * @param {string|object} pigmentB - Second pigment
     * @returns {object} { aOverB, bOverA } - Both ordering results
     */
    compareLayerOrders(pigmentA, pigmentB) {
      const a = typeof pigmentA === 'string' ? this.findPigment(pigmentA) : pigmentA;
      const b = typeof pigmentB === 'string' ? this.findPigment(pigmentB) : pigmentB;
      
      const aOnPaper = glazeColors(this.paperWhite, a);
      const bOnPaper = glazeColors(this.paperWhite, b);
      
      return {
        aOverB: glazeColors(bOnPaper, a),
        bOverA: glazeColors(aOnPaper, b),
        a: a,
        b: b
      };
    }

    // --- Palette Generation ---

    /**
     * Generate a harmonious palette from a starting pigment
     * @param {string|object} basePigment - Starting pigment
     * @param {string} harmony - 'complementary', 'analogous', 'triadic', 'split'
     * @returns {object[]} Array of pigment objects
     */
    generatePalette(basePigment, harmony = 'analogous') {
      const base = typeof basePigment === 'string' ? this.findPigment(basePigment) : basePigment;
      if (!base) return [];

      const baseHsl = rgbToHsl(...hexToRgb(base.hex));
      const baseHue = baseHsl[0];
      
      let targetHues = [];
      switch (harmony) {
        case 'complementary':
          targetHues = [(baseHue + 180) % 360];
          break;
        case 'analogous':
          targetHues = [(baseHue + 30) % 360, (baseHue + 330) % 360];
          break;
        case 'triadic':
          targetHues = [(baseHue + 120) % 360, (baseHue + 240) % 360];
          break;
        case 'split':
          targetHues = [(baseHue + 150) % 360, (baseHue + 210) % 360];
          break;
      }

      // Find closest pigments to target hues
      const palette = [base];
      for (const targetHue of targetHues) {
        let closest = null;
        let closestDist = Infinity;
        
        for (const p of this.pigments) {
          if (palette.includes(p)) continue;
          const hsl = rgbToHsl(...hexToRgb(p.hex));
          const dist = Math.min(
            Math.abs(hsl[0] - targetHue),
            360 - Math.abs(hsl[0] - targetHue)
          );
          if (dist < closestDist) {
            closestDist = dist;
            closest = p;
          }
        }
        if (closest) palette.push(closest);
      }
      
      return palette;
    }

    /**
     * Get the Haslun Studio signature palette
     * @returns {object[]} Array of signature pigments
     */
    getHaslunPalette() {
      // The warm earthy tones used across Haslun Studio
      return [
        this.findPigment('Indian Yellow'),
        this.findPigment('Yellow Ochre'),
        this.findPigment('Burnt Umber'),
        this.findPigment('Permanent Green'),
        this.findPigment('Payne\'s Grey'),
      ].filter(Boolean);
    }

    // --- Utility Methods ---

    /**
     * Interpolate between two colors
     * @param {string} colorA - First hex color
     * @param {string} colorB - Second hex color
     * @param {number} t - Interpolation factor 0-1
     * @returns {string} Interpolated hex color
     */
    lerp(colorA, colorB, t) {
      return lerpColor(colorA, colorB, t);
    }

    /**
     * Check if a color is light or dark
     * @param {string} hex - Hex color
     * @returns {boolean} True if light
     */
    isLight(hex) {
      return getLuminance(hex) > 0.5;
    }

    /**
     * Get appropriate text color for a background
     * @param {string} bgHex - Background hex color
     * @returns {string} '#FFFFFF' or '#000000'
     */
    getTextColor(bgHex) {
      return this.isLight(bgHex) ? '#000000' : '#FFFFFF';
    }

    /**
     * Convert hex to RGB array
     */
    hexToRgb(hex) {
      return hexToRgb(hex);
    }

    /**
     * Convert RGB to hex
     */
    rgbToHex(r, g, b) {
      return rgbToHex(r, g, b);
    }
  }

  // ===========================================================================
  // EXPORT
  // ===========================================================================

  // Browser global
  global.WatercolorEngine = WatercolorEngine;

  // Also export utilities for direct use
  global.WatercolorUtils = {
    hexToRgb,
    rgbToHex,
    rgbToHsl,
    hslToRgb,
    lerpColor,
    glazeColors,
    glazeStack,
    glazeGradient,
    getLuminance,
    getContrastRatio,
    PIGMENTS,
    TRANSPARENCY_MAP,
    PAPER_WHITE
  };

  // ES Module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WatercolorEngine, ...global.WatercolorUtils };
  }

})(typeof window !== 'undefined' ? window : global);
