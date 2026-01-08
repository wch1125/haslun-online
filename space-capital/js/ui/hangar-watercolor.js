/**
 * ═══════════════════════════════════════════════════════════════════════════
 * HANGAR WATERCOLOR SYSTEM
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Integrates the Watercolor Engine with Space Capital's telemetry system
 * to create ambient lighting and ship patina effects.
 * 
 * Philosophy: "Let the market leave pigment residue in the hangar."
 * 
 * This is a thin wrapper that:
 *   - Prevents misuse (opacity caps, no text colors)
 *   - Maps telemetry → pigments
 *   - Provides page-specific color memory
 * 
 * SAFE ZONES:
 *   ✓ Hangar ambient lighting
 *   ✓ Ship patina overlays (≤8% opacity)
 *   ✓ Mission Command mood
 *   ✗ Never: UI text, status indicators, critical contrast
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

const HangarWatercolor = (function() {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────
  // CONFIGURATION
  // ─────────────────────────────────────────────────────────────────────────
  
  const CONFIG = {
    // Opacity caps (safety guardrails)
    maxAmbientOpacity: 0.12,
    maxPatinaOpacity: 0.08,
    
    // Base colors
    hangarBase: '#0B0F14',      // Dark space background
    paperWhite: '#FCFAF5',      // Watercolor paper
    
    // Page-specific pigment recipes
    pageRecipes: {
      'hangar': ['Yellow Ochre', 'Burnt Umber'],           // Warm, lived-in
      'fleet': ['Indian Yellow', "Payne's Grey"],          // Operational
      'derivatives': ['Prussian Blue', "Payne's Grey"],    // Cool, analytical
      'missions': ['Burnt Umber', 'Sepia'],                // Weathered
      'telemetry': ['Cyan', "Payne's Grey"],               // Technical
      'battle': ['Carmine', 'Sepia'],                      // Danger, aged
    },
    
    // Sin-based patina (connects to ship psychology)
    sinPatinas: {
      'OBSESSION': ['Indian Yellow', 'Orange'],            // Burning focus
      'RAGE': ['Carmine', 'English Red'],                  // Fury
      'GLUTTONY': ['May Green', 'Yellow Ochre'],           // Excess
      'PATIENCE': ['Prussian Blue', 'Permanent Green'],    // Calm depth
      'MYSTERY': ["Payne's Grey", 'Violet'],               // Unknown
      'DEFIANCE': ['Magenta', 'Carmine'],                  // Rebellion
      'RESILIENCE': ['Burnt Umber', 'Yellow Ochre'],       // Endurance
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────────────────
  
  let engine = null;
  let initialized = false;
  let currentAmbient = null;
  let currentPatina = null;

  // ─────────────────────────────────────────────────────────────────────────
  // INITIALIZATION
  // ─────────────────────────────────────────────────────────────────────────
  
  function init() {
    if (initialized) return true;
    
    if (typeof WatercolorEngine === 'undefined') {
      console.warn('[HangarWatercolor] WatercolorEngine not loaded');
      return false;
    }
    
    engine = new WatercolorEngine();
    initialized = true;
    console.log('[HangarWatercolor] Initialized with', engine.getAllPigments().length, 'pigments');
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AMBIENT LIGHTING
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Compute hangar ambient wash from market conditions
   * @param {Object} env - Environment stats from telemetry
   * @returns {string} Ambient color hex
   */
  function computeAmbientFromEnv(env) {
    if (!init()) return CONFIG.hangarBase;
    
    const pigments = [];
    
    // Threat → cool, bruised tones
    if (env.threat > 80) {
      pigments.push("Payne's Grey");
    } else if (env.threat > 60) {
      pigments.push('Prussian Blue');
    }
    
    // Firepower/momentum → warm tones
    if (env.firepower > 70) {
      pigments.push('Indian Yellow');
    } else if (env.firepower > 50) {
      pigments.push('Yellow Ochre');
    }
    
    // Low hull → distressed earth tones
    if (env.hull < 30) {
      pigments.push('Burnt Umber');
    }
    
    // High sensors → clarity, cyan undertone
    if (env.sensors > 70) {
      pigments.push('Cyan');
    }
    
    // Default to neutral if no conditions
    if (pigments.length === 0) {
      pigments.push("Payne's Grey");
    }
    
    return computeAmbient(pigments);
  }

  /**
   * Compute ambient from explicit pigment list
   * @param {string[]} pigmentNames - Array of pigment names
   * @returns {string} Ambient color hex
   */
  function computeAmbient(pigmentNames) {
    if (!init()) return CONFIG.hangarBase;
    
    // Filter to glazing pigments only (transparent/semi-transparent)
    const pigments = pigmentNames
      .map(name => engine.findPigment(name))
      .filter(p => p && p.transparency !== 'opaque');
    
    if (pigments.length === 0) {
      return CONFIG.hangarBase;
    }
    
    // Glaze over dark base
    const glazed = engine.glazeMultiple(pigments, CONFIG.hangarBase);
    
    // Blend back toward base to cap opacity
    currentAmbient = engine.lerp(CONFIG.hangarBase, glazed, CONFIG.maxAmbientOpacity * 8);
    
    return currentAmbient;
  }

  /**
   * Get page-specific ambient
   * @param {string} pageName - Page identifier (hangar, fleet, derivatives, etc.)
   * @returns {string} Ambient color hex
   */
  function getPageAmbient(pageName) {
    const recipe = CONFIG.pageRecipes[pageName] || CONFIG.pageRecipes['fleet'];
    return computeAmbient(recipe);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SHIP PATINA
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Compute ship patina based on its sin archetype
   * @param {string} sin - Ship's sin (OBSESSION, RAGE, etc.)
   * @returns {string} Patina color hex
   */
  function computePatinaBySin(sin) {
    if (!init()) return null;
    
    const recipe = CONFIG.sinPatinas[sin] || CONFIG.sinPatinas['MYSTERY'];
    return computePatina(recipe);
  }

  /**
   * Compute ship patina from environment
   * @param {Object} env - Environment stats
   * @returns {string} Patina color hex
   */
  function computePatinaFromEnv(env) {
    if (!init()) return null;
    
    const pigments = [];
    
    // Map market conditions to weathering
    if (env.threat > 70) {
      pigments.push('Sepia');
    }
    if (env.firepower > 60) {
      pigments.push('Burnt Umber');
    }
    if (env.hull < 40) {
      pigments.push('English Red');  // Battle damage
    }
    
    if (pigments.length === 0) {
      pigments.push('Yellow Ochre');  // Default gentle patina
    }
    
    return computePatina(pigments);
  }

  /**
   * Compute patina from explicit pigment list
   * @param {string[]} pigmentNames - Array of pigment names
   * @returns {string} Patina color hex
   */
  function computePatina(pigmentNames) {
    if (!init()) return null;
    
    const pigments = pigmentNames
      .map(name => engine.findPigment(name))
      .filter(Boolean);
    
    if (pigments.length === 0) return null;
    
    // Glaze over paper white (simulates the patina color itself)
    currentPatina = engine.glazeMultiple(pigments, CONFIG.paperWhite);
    
    return currentPatina;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CSS VARIABLE APPLICATION
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Apply ambient wash to CSS custom properties
   * @param {string} ambient - Ambient color hex
   */
  function applyAmbient(ambient) {
    if (!ambient) return;
    
    const root = document.documentElement;
    root.style.setProperty('--hangar-ambient', ambient);
    root.style.setProperty('--hangar-ambient-opacity', CONFIG.maxAmbientOpacity);
    
    console.log('[HangarWatercolor] Applied ambient:', ambient);
  }

  /**
   * Apply patina to a ship element
   * @param {HTMLElement} el - Ship element
   * @param {string} patina - Patina color hex
   */
  function applyPatina(el, patina) {
    if (!el || !patina) return;
    
    el.style.setProperty('--ship-patina', patina);
    el.style.setProperty('--ship-patina-opacity', CONFIG.maxPatinaOpacity);
    
    console.log('[HangarWatercolor] Applied patina to ship:', patina);
  }

  /**
   * Full page setup - applies ambient and prepares patina system
   * @param {string} pageName - Page identifier
   * @param {Object} env - Optional environment stats
   */
  function setupPage(pageName, env = null) {
    if (!init()) return;
    
    // Compute ambient
    const ambient = env 
      ? computeAmbientFromEnv(env) 
      : getPageAmbient(pageName);
    
    applyAmbient(ambient);
    
    // Add CSS for patina overlays if not already present
    injectPatinaStyles();
    
    console.log('[HangarWatercolor] Page setup complete:', pageName);
  }

  /**
   * Inject CSS for ship patina overlays
   */
  function injectPatinaStyles() {
    if (document.getElementById('watercolor-patina-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'watercolor-patina-styles';
    style.textContent = `
      /* Watercolor Patina System */
      :root {
        --hangar-ambient: ${CONFIG.hangarBase};
        --hangar-ambient-opacity: ${CONFIG.maxAmbientOpacity};
        --ship-patina: transparent;
        --ship-patina-opacity: ${CONFIG.maxPatinaOpacity};
      }
      
      /* Hangar ambient wash - subtle radial gradient */
      .watercolor-ambient {
        background: radial-gradient(
          ellipse at center,
          var(--hangar-ambient),
          ${CONFIG.hangarBase} 70%
        ) !important;
      }
      
      /* Ship patina overlay - multiply blend */
      .ship-patina-enabled::after {
        content: '';
        position: absolute;
        inset: 0;
        background: var(--ship-patina);
        mix-blend-mode: multiply;
        opacity: var(--ship-patina-opacity);
        pointer-events: none;
        border-radius: inherit;
      }
      
      /* Softer patina variant */
      .ship-patina-soft::after {
        mix-blend-mode: soft-light;
        opacity: calc(var(--ship-patina-opacity) * 1.5);
      }
    `;
    
    document.head.appendChild(style);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UTILITIES
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Get a dilution gradient for visualization
   * @param {string} pigmentName - Pigment name
   * @param {number} steps - Number of steps
   * @returns {string[]} Array of hex colors
   */
  function getDilutionGradient(pigmentName, steps = 5) {
    if (!init()) return [];
    return engine.getDilutionGradient(pigmentName, steps);
  }

  /**
   * Get current state for debugging
   */
  function getState() {
    return {
      initialized,
      currentAmbient,
      currentPatina,
      config: CONFIG
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────
  
  return {
    // Initialization
    init,
    
    // Ambient
    computeAmbient,
    computeAmbientFromEnv,
    getPageAmbient,
    applyAmbient,
    
    // Patina
    computePatina,
    computePatinaBySin,
    computePatinaFromEnv,
    applyPatina,
    
    // Page setup
    setupPage,
    
    // Utilities
    getDilutionGradient,
    getState,
    
    // Constants (read-only)
    get CONFIG() { return { ...CONFIG }; }
  };

})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HangarWatercolor;
}
