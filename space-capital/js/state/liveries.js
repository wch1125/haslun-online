/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SPACE CAPITAL - LIVERY SYSTEM
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * A Livery is a named, reusable, class-aware color + distribution profile
 * that can be applied to one ship or an entire fleet.
 * 
 * Paint Bay generates palettes → Liveries decide WHERE they go
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

window.LiverySystem = (function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // STORAGE
  // ═══════════════════════════════════════════════════════════════════════════

  const liveries = new Map();
  const activeLiveries = new Map(); // ticker → liveryId
  const STORAGE_KEY = 'space_capital_liveries';
  const ASSIGNMENTS_KEY = 'space_capital_livery_assignments';

  // ═══════════════════════════════════════════════════════════════════════════
  // DEFAULT APPLICATION MAPS (Per Class)
  // ═══════════════════════════════════════════════════════════════════════════

  const CLASS_APPLICATION_DEFAULTS = {
    Flagship: {
      hull: 'primary',
      trim: 'highlight',      // More trim for command presence
      engines: 'highlight',
      accents: 'secondary',
      damage: 'shadow',
      cockpit: 'glaze'
    },
    Carrier: {
      hull: 'primary',
      trim: 'secondary',
      engines: 'glaze',
      accents: 'highlight',
      damage: 'shadow',
      hangars: 'secondary'
    },
    Drone: {
      hull: 'secondary',      // High contrast body
      trim: 'primary',
      engines: 'highlight',
      accents: 'primary',
      damage: 'shadow',
      sensors: 'glaze'
    },
    Lander: {
      hull: 'primary',
      trim: 'secondary',
      engines: 'highlight',
      accents: 'glaze',
      damage: 'shadow',
      landing_gear: 'secondary'
    },
    Scout: {
      hull: 'secondary',
      trim: 'glaze',
      engines: 'highlight',
      accents: 'primary',
      damage: 'shadow',
      sensors: 'highlight'
    },
    eVTOL: {
      hull: 'primary',
      trim: 'secondary',
      engines: 'highlight',
      accents: 'glaze',
      damage: 'shadow',
      rotors: 'highlight'
    },
    Fighter: {
      hull: 'primary',
      trim: 'highlight',
      engines: 'highlight',
      accents: 'secondary',
      damage: 'shadow',
      weapons: 'glaze'
    },
    Cargo: {
      hull: 'primary',
      trim: 'secondary',
      engines: 'glaze',
      accents: 'secondary',
      damage: 'shadow',
      cargo_bay: 'primary'
    },
    Relay: {
      hull: 'secondary',
      trim: 'primary',
      engines: 'glaze',
      accents: 'highlight',
      damage: 'shadow',
      antenna: 'highlight'
    },
    Recon: {
      hull: 'secondary',
      trim: 'glaze',
      engines: 'highlight',
      accents: 'primary',
      damage: 'shadow',
      optics: 'highlight'
    },
    Moonshot: {
      hull: 'highlight',      // High visibility for volatility
      trim: 'primary',
      engines: 'highlight',
      accents: 'glaze',
      damage: 'shadow',
      thrusters: 'primary'
    },
    Ship: {
      hull: 'primary',
      trim: 'secondary',
      engines: 'highlight',
      accents: 'glaze',
      damage: 'shadow'
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // LIVERY FACTORY
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a new livery object
   */
  function createLivery(options) {
    const now = Date.now();
    
    return {
      id: options.id || `livery_${now}_${Math.random().toString(36).substr(2, 6)}`,
      name: options.name || 'Unnamed Livery',
      description: options.description || '',
      createdAt: options.createdAt || now,
      updatedAt: now,

      // Source tracking
      source: options.source || 'custom',  // 'preset' | 'custom'
      author: options.author || 'user',    // 'system' | 'user'

      // Palette data (from Paint Bay)
      palette: {
        model: options.palette?.model || 'dual-glaze',
        baseColors: options.palette?.baseColors || ['#33ff99', '#00cc77', '#0a3333'],
        generated: options.palette?.generated || generatePaletteRoles(options.palette?.baseColors)
      },

      // Distribution rules - WHERE colors go
      application: options.application || {
        hull: 'primary',
        trim: 'secondary',
        engines: 'highlight',
        accents: 'glaze',
        damage: 'shadow'
      },

      // Class-specific overrides
      classModifiers: options.classModifiers || {},

      // Scope - what this livery applies to
      appliesTo: {
        ships: options.appliesTo?.ships || [],
        classes: options.appliesTo?.classes || [],
        fleetWide: options.appliesTo?.fleetWide || false
      },

      // Metadata
      tags: options.tags || [],
      unlocked: options.unlocked !== false,
      achievementId: options.achievementId || null
    };
  }

  /**
   * Generate palette roles from base colors
   * Optionally applies telemetry-based bias for the ticker
   */
  function generatePaletteRoles(baseColors, ticker) {
    if (!baseColors || baseColors.length < 2) {
      baseColors = ['#33ff99', '#00cc77', '#0a3333'];
    }

    let primary = baseColors[0];
    let secondary = baseColors[1];
    let tertiary = baseColors[2] || blendColors(primary, secondary, 0.5);

    // Apply telemetry bias if available
    if (ticker && window.ShipTelemetry?.hasData(ticker)) {
      const bias = ShipTelemetry.getPaletteBias(ticker);
      
      // Adjust saturation based on telemetry
      primary = adjustSaturation(primary, bias.saturationBias);
      secondary = adjustSaturation(secondary, bias.saturationBias * 0.9);
      
      // Adjust brightness based on signal clarity
      primary = adjustBrightness(primary, bias.brightnessBias);
      
      // Adjust contrast between primary and shadow
      const contrastAmount = 0.3 + (bias.contrastBias * 0.2);
      
      return [
        { role: 'primary', hex: primary },
        { role: 'secondary', hex: secondary },
        { role: 'glaze', hex: blendColors(primary, secondary, 0.3) },
        { role: 'highlight', hex: lightenColor(primary, 0.25 + (bias.brightnessBias * 0.1)) },
        { role: 'shadow', hex: darkenColor(secondary, contrastAmount) }
      ];
    }

    // Default generation without bias
    return [
      { role: 'primary', hex: primary },
      { role: 'secondary', hex: secondary },
      { role: 'glaze', hex: blendColors(primary, secondary, 0.3) },
      { role: 'highlight', hex: lightenColor(primary, 0.3) },
      { role: 'shadow', hex: darkenColor(secondary, 0.4) }
    ];
  }

  /**
   * Adjust color saturation
   */
  function adjustSaturation(hex, factor) {
    const rgb = hexToRgb(hex);
    const max = Math.max(rgb.r, rgb.g, rgb.b);
    const min = Math.min(rgb.r, rgb.g, rgb.b);
    const l = (max + min) / 2 / 255;
    
    // Convert to HSL, adjust saturation, convert back
    const d = (max - min) / 255;
    if (d === 0) return hex; // Achromatic
    
    const s = l > 0.5 ? d / (2 - max/255 - min/255) : d / (max/255 + min/255);
    const newS = Math.min(1, s * factor);
    
    // Simplified: blend toward or away from gray based on factor
    const gray = (rgb.r + rgb.g + rgb.b) / 3;
    const blend = factor > 1 ? 0 : 1 - factor;
    
    return rgbToHex(
      rgb.r + (gray - rgb.r) * blend * 0.3,
      rgb.g + (gray - rgb.g) * blend * 0.3,
      rgb.b + (gray - rgb.b) * blend * 0.3
    );
  }

  /**
   * Adjust color brightness
   */
  function adjustBrightness(hex, factor) {
    const rgb = hexToRgb(hex);
    const adjustment = (factor - 0.5) * 50; // -25 to +25
    
    return rgbToHex(
      rgb.r + adjustment,
      rgb.g + adjustment,
      rgb.b + adjustment
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COLOR UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 51, g: 255, b: 153 };
  }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
      const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }

  function blendColors(hex1, hex2, ratio) {
    const c1 = hexToRgb(hex1);
    const c2 = hexToRgb(hex2);
    return rgbToHex(
      c1.r + (c2.r - c1.r) * ratio,
      c1.g + (c2.g - c1.g) * ratio,
      c1.b + (c2.b - c1.b) * ratio
    );
  }

  function lightenColor(hex, amount) {
    const c = hexToRgb(hex);
    return rgbToHex(
      c.r + (255 - c.r) * amount,
      c.g + (255 - c.g) * amount,
      c.b + (255 - c.b) * amount
    );
  }

  function darkenColor(hex, amount) {
    const c = hexToRgb(hex);
    return rgbToHex(
      c.r * (1 - amount),
      c.g * (1 - amount),
      c.b * (1 - amount)
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LIVERY STORE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  function registerLivery(livery) {
    liveries.set(livery.id, livery);
    saveToStorage();
    
    document.dispatchEvent(new CustomEvent('livery:registered', {
      detail: { livery }
    }));
    
    return livery;
  }

  function getLivery(id) {
    return liveries.get(id);
  }

  function getAllLiveries() {
    return [...liveries.values()];
  }

  function getPresetLiveries() {
    return getAllLiveries().filter(l => l.source === 'preset');
  }

  function getCustomLiveries() {
    return getAllLiveries().filter(l => l.source === 'custom');
  }

  function getUnlockedLiveries() {
    return getAllLiveries().filter(l => l.unlocked);
  }

  function deleteLivery(id) {
    const livery = liveries.get(id);
    if (!livery) return false;
    
    // Don't delete system presets
    if (livery.author === 'system') {
      console.warn('[LiverySystem] Cannot delete system liveries');
      return false;
    }
    
    // Remove assignments using this livery
    for (const [ticker, liveryId] of activeLiveries.entries()) {
      if (liveryId === id) {
        activeLiveries.delete(ticker);
      }
    }
    
    liveries.delete(id);
    saveToStorage();
    
    document.dispatchEvent(new CustomEvent('livery:deleted', {
      detail: { id }
    }));
    
    return true;
  }

  function updateLivery(id, updates) {
    const livery = liveries.get(id);
    if (!livery) return null;
    
    const updated = {
      ...livery,
      ...updates,
      id: livery.id, // Preserve ID
      updatedAt: Date.now()
    };
    
    liveries.set(id, updated);
    saveToStorage();
    
    document.dispatchEvent(new CustomEvent('livery:updated', {
      detail: { livery: updated }
    }));
    
    return updated;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LIVERY ASSIGNMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  function assignLivery(ticker, liveryId) {
    if (!liveries.has(liveryId)) {
      console.warn(`[LiverySystem] Livery ${liveryId} not found`);
      return false;
    }
    
    activeLiveries.set(ticker, liveryId);
    saveAssignments();
    
    document.dispatchEvent(new CustomEvent('livery:assigned', {
      detail: { ticker, liveryId }
    }));
    
    return true;
  }

  function unassignLivery(ticker) {
    activeLiveries.delete(ticker);
    saveAssignments();
    
    document.dispatchEvent(new CustomEvent('livery:unassigned', {
      detail: { ticker }
    }));
  }

  function getLiveryForTicker(ticker) {
    const liveryId = activeLiveries.get(ticker);
    return liveryId ? liveries.get(liveryId) : null;
  }

  function getTickersWithLivery(liveryId) {
    const tickers = [];
    for (const [ticker, id] of activeLiveries.entries()) {
      if (id === liveryId) tickers.push(ticker);
    }
    return tickers;
  }

  function applyFleetWide(liveryId) {
    const livery = liveries.get(liveryId);
    if (!livery) return false;
    
    // Get all ships from SHIP_DATA
    const allShips = window.SHIP_DATA || [];
    allShips.forEach(ship => {
      activeLiveries.set(ship.ticker, liveryId);
    });
    
    saveAssignments();
    
    document.dispatchEvent(new CustomEvent('livery:fleetApplied', {
      detail: { liveryId, count: allShips.length }
    }));
    
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RESOLVED LIVERY (For Rendering)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get the fully resolved color map for a specific ship
   * This combines: base application + class modifiers + palette
   */
  function getResolvedLivery(ticker, shipClass) {
    const livery = getLiveryForTicker(ticker);
    if (!livery) return null;

    // Start with default application for this class
    const classDefaults = CLASS_APPLICATION_DEFAULTS[shipClass] || CLASS_APPLICATION_DEFAULTS.Ship;
    
    // Layer on the livery's base application
    let application = { ...classDefaults, ...livery.application };
    
    // Apply class-specific modifiers from the livery
    if (livery.classModifiers && livery.classModifiers[shipClass]) {
      application = { ...application, ...livery.classModifiers[shipClass] };
    }

    // Build the color map from roles → actual hex values
    const paletteMap = {};
    livery.palette.generated.forEach(p => {
      paletteMap[p.role] = p.hex;
    });

    // Resolve role names to hex colors
    const colorMap = {};
    for (const [zone, role] of Object.entries(application)) {
      colorMap[zone] = paletteMap[role] || paletteMap.primary || '#33ff99';
    }

    return {
      liveryId: livery.id,
      liveryName: livery.name,
      palette: livery.palette,
      application,
      colorMap,
      baseColors: livery.palette.baseColors
    };
  }

  /**
   * Get color override object for sprite composer
   * (Backwards compatible with existing colorOverride usage)
   */
  function getColorOverride(ticker, shipClass) {
    const resolved = getResolvedLivery(ticker, shipClass);
    if (!resolved) return null;

    return {
      palette: resolved.palette,
      application: resolved.application,
      colorMap: resolved.colorMap,
      baseColors: resolved.baseColors
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERSISTENCE
  // ═══════════════════════════════════════════════════════════════════════════

  function saveToStorage() {
    try {
      const data = [];
      liveries.forEach((livery, id) => {
        // Only save custom liveries (presets are registered at boot)
        if (livery.author === 'user') {
          data.push(livery);
        }
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[LiverySystem] Failed to save liveries:', e);
    }
  }

  function saveAssignments() {
    try {
      const data = Object.fromEntries(activeLiveries);
      localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[LiverySystem] Failed to save assignments:', e);
    }
  }

  function loadFromStorage() {
    try {
      // Load custom liveries
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const customs = JSON.parse(data);
        customs.forEach(livery => {
          liveries.set(livery.id, livery);
        });
      }

      // Load assignments
      const assignData = localStorage.getItem(ASSIGNMENTS_KEY);
      if (assignData) {
        const assigns = JSON.parse(assignData);
        for (const [ticker, liveryId] of Object.entries(assigns)) {
          if (liveries.has(liveryId)) {
            activeLiveries.set(ticker, liveryId);
          }
        }
      }
    } catch (e) {
      console.warn('[LiverySystem] Failed to load from storage:', e);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DEFAULT PRESETS (Registered at Boot)
  // ═══════════════════════════════════════════════════════════════════════════

  function registerDefaultPresets() {
    const presets = [
      {
        id: 'livery_phosphor_green',
        name: 'Phosphor Green',
        description: 'High-visibility command livery. The signature Space Capital look.',
        source: 'preset',
        author: 'system',
        palette: {
          model: 'dual-glaze',
          baseColors: ['#33ff99', '#00cc77', '#0a3333'],
          generated: [
            { role: 'primary', hex: '#33ff99' },
            { role: 'secondary', hex: '#00cc77' },
            { role: 'glaze', hex: '#22dd99' },
            { role: 'highlight', hex: '#66ffcc' },
            { role: 'shadow', hex: '#006644' }
          ]
        },
        tags: ['signature', 'command', 'default']
      },
      {
        id: 'livery_void_walker',
        name: 'Void Walker',
        description: 'Deep space stealth configuration. Minimal thermal signature.',
        source: 'preset',
        author: 'system',
        palette: {
          model: 'dual-glaze',
          baseColors: ['#2a2a3d', '#1a1a2e', '#0f0f1a'],
          generated: [
            { role: 'primary', hex: '#2a2a3d' },
            { role: 'secondary', hex: '#1a1a2e' },
            { role: 'glaze', hex: '#3d3d5c' },
            { role: 'highlight', hex: '#5c5c8a' },
            { role: 'shadow', hex: '#0a0a14' }
          ]
        },
        classModifiers: {
          Scout: { hull: 'shadow', trim: 'secondary' },
          Recon: { hull: 'shadow', trim: 'secondary' }
        },
        tags: ['stealth', 'dark', 'tactical']
      },
      {
        id: 'livery_solar_flare',
        name: 'Solar Flare',
        description: 'High-energy combat livery. Maximum visual presence.',
        source: 'preset',
        author: 'system',
        palette: {
          model: 'dual-glaze',
          baseColors: ['#ff6b35', '#f7931e', '#ffcc00'],
          generated: [
            { role: 'primary', hex: '#ff6b35' },
            { role: 'secondary', hex: '#f7931e' },
            { role: 'glaze', hex: '#ff9955' },
            { role: 'highlight', hex: '#ffcc00' },
            { role: 'shadow', hex: '#993300' }
          ]
        },
        classModifiers: {
          Fighter: { engines: 'primary', weapons: 'highlight' },
          Moonshot: { hull: 'highlight', engines: 'primary' }
        },
        tags: ['combat', 'aggressive', 'bright']
      },
      {
        id: 'livery_arctic_ghost',
        name: 'Arctic Ghost',
        description: 'Cryo-cooled hull coating. Optimal for deep space operations.',
        source: 'preset',
        author: 'system',
        palette: {
          model: 'dual-glaze',
          baseColors: ['#e8f4f8', '#a8d8ea', '#6bb9d9'],
          generated: [
            { role: 'primary', hex: '#e8f4f8' },
            { role: 'secondary', hex: '#a8d8ea' },
            { role: 'glaze', hex: '#c8e8f4' },
            { role: 'highlight', hex: '#ffffff' },
            { role: 'shadow', hex: '#4a90a4' }
          ]
        },
        tags: ['cold', 'clean', 'professional']
      },
      {
        id: 'livery_crimson_tide',
        name: 'Crimson Tide',
        description: 'Battle-hardened assault configuration. Fear projection engaged.',
        source: 'preset',
        author: 'system',
        palette: {
          model: 'dual-glaze',
          baseColors: ['#8b0000', '#cc0000', '#ff3333'],
          generated: [
            { role: 'primary', hex: '#cc0000' },
            { role: 'secondary', hex: '#8b0000' },
            { role: 'glaze', hex: '#ff3333' },
            { role: 'highlight', hex: '#ff6666' },
            { role: 'shadow', hex: '#4a0000' }
          ]
        },
        classModifiers: {
          Fighter: { hull: 'primary', weapons: 'glaze' },
          Flagship: { trim: 'glaze', accents: 'highlight' }
        },
        tags: ['combat', 'aggressive', 'red']
      },
      {
        id: 'livery_nebula_drift',
        name: 'Nebula Drift',
        description: 'Cosmic dust camouflage. Blends with stellar nurseries.',
        source: 'preset',
        author: 'system',
        palette: {
          model: 'triple-glaze',
          baseColors: ['#9b59b6', '#8e44ad', '#6c3483'],
          generated: [
            { role: 'primary', hex: '#9b59b6' },
            { role: 'secondary', hex: '#8e44ad' },
            { role: 'glaze', hex: '#bb77dd' },
            { role: 'highlight', hex: '#d4a6e8' },
            { role: 'shadow', hex: '#4a235a' }
          ]
        },
        tags: ['cosmic', 'purple', 'mystical']
      },
      {
        id: 'livery_amber_alert',
        name: 'Amber Alert',
        description: 'Emergency response livery. High visibility under all conditions.',
        source: 'preset',
        author: 'system',
        palette: {
          model: 'dual-glaze',
          baseColors: ['#ffb347', '#ff9500', '#cc7700'],
          generated: [
            { role: 'primary', hex: '#ffb347' },
            { role: 'secondary', hex: '#ff9500' },
            { role: 'glaze', hex: '#ffcc77' },
            { role: 'highlight', hex: '#ffe0a0' },
            { role: 'shadow', hex: '#995500' }
          ]
        },
        tags: ['warning', 'emergency', 'amber']
      },
      {
        id: 'livery_midnight_oil',
        name: 'Midnight Oil',
        description: 'Industrial workhorse finish. Built for long hauls.',
        source: 'preset',
        author: 'system',
        palette: {
          model: 'dual-glaze',
          baseColors: ['#2c3e50', '#1a252f', '#34495e'],
          generated: [
            { role: 'primary', hex: '#2c3e50' },
            { role: 'secondary', hex: '#1a252f' },
            { role: 'glaze', hex: '#3d566e' },
            { role: 'highlight', hex: '#5d7a94' },
            { role: 'shadow', hex: '#0d1318' }
          ]
        },
        classModifiers: {
          Cargo: { hull: 'primary', cargo_bay: 'secondary' },
          Carrier: { hull: 'primary', hangars: 'secondary' }
        },
        tags: ['industrial', 'utility', 'dark']
      }
    ];

    presets.forEach(preset => {
      const livery = createLivery(preset);
      liveries.set(livery.id, livery);
    });

    console.log(`[LiverySystem] Registered ${presets.length} preset liveries`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PAINT BAY INTEGRATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create livery from Paint Bay output
   * Now applies telemetry-based palette bias when ticker is provided
   */
  function createFromPaintBay(options) {
    const livery = createLivery({
      name: options.name || 'Custom Livery',
      description: options.description || 'Created in Refit Bay',
      source: 'custom',
      author: 'user',
      palette: {
        model: 'dual-glaze',
        baseColors: options.baseColors,
        // Pass ticker for telemetry-biased palette generation
        generated: generatePaletteRoles(options.baseColors, options.ticker)
      },
      appliesTo: {
        ships: options.ticker ? [options.ticker] : [],
        fleetWide: false
      }
    });

    registerLivery(livery);

    // Auto-assign to the ship if specified
    if (options.ticker) {
      assignLivery(options.ticker, livery.id);
    }

    return livery;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT / IMPORT
  // ═══════════════════════════════════════════════════════════════════════════

  function exportLivery(id) {
    const livery = liveries.get(id);
    if (!livery) return null;
    
    return JSON.stringify(livery, null, 2);
  }

  function importLivery(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      
      // Generate new ID to avoid conflicts
      data.id = `livery_imported_${Date.now()}`;
      data.source = 'custom';
      data.author = 'user';
      data.createdAt = Date.now();
      data.updatedAt = Date.now();
      
      const livery = createLivery(data);
      registerLivery(livery);
      
      return livery;
    } catch (e) {
      console.error('[LiverySystem] Import failed:', e);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  function init() {
    // Register system presets first
    registerDefaultPresets();
    
    // Load user customs and assignments
    loadFromStorage();

    // Listen for Paint Bay events
    document.addEventListener('paintbay:apply', (e) => {
      if (e.detail && e.detail.ticker && e.detail.colors) {
        createFromPaintBay({
          ticker: e.detail.ticker,
          baseColors: e.detail.colors,
          name: `${e.detail.ticker} Custom`
        });
      }
    });

    // Listen for livery:create events (new pattern)
    document.addEventListener('livery:create', (e) => {
      if (e.detail) {
        const livery = createFromPaintBay(e.detail);
        console.log('[LiverySystem] Created livery:', livery.name);
      }
    });

    console.log('[LiverySystem] Initialized with', liveries.size, 'liveries');
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
    // Livery CRUD
    createLivery,
    registerLivery,
    getLivery,
    getAllLiveries,
    getPresetLiveries,
    getCustomLiveries,
    getUnlockedLiveries,
    deleteLivery,
    updateLivery,

    // Assignments
    assignLivery,
    unassignLivery,
    getLiveryForTicker,
    getTickersWithLivery,
    applyFleetWide,

    // Rendering support
    getResolvedLivery,
    getColorOverride,
    CLASS_APPLICATION_DEFAULTS,

    // Paint Bay integration
    createFromPaintBay,

    // Import/Export
    exportLivery,
    importLivery,

    // Color utilities (exposed for Paint Bay)
    generatePaletteRoles,
    blendColors,
    lightenColor,
    darkenColor
  };

})();
