/**
 * ═══════════════════════════════════════════════════════════════════════════
 * HANGAR WATERCOLOR SYSTEM v2
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Integrates the Watercolor Engine with Space Capital's telemetry system
 * to create ambient lighting, ship patina effects, and micro-parallax depth.
 * 
 * Philosophy: "Let the market leave pigment residue in the hangar."
 * 
 * v2 Changes (ChatGPT review):
 *   - Pigment clamping (max 2 to prevent mud)
 *   - Update debouncing (1200ms cooldown)
 *   - Reduced motion support (freeze after first render)
 *   - Blend-mode fallbacks for older browsers
 *   - Micro-parallax system (≤6px, mouse-based, inertial)
 * 
 * SAFE ZONES:
 *   ✓ Hangar ambient lighting
 *   ✓ Ship patina overlays (≤8% opacity)
 *   ✓ Micro-parallax (≤6px movement)
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
    
    // Base colors - Miami Chromatic Black (allows pigments to show)
    hangarBase: '#14000b',      // Warm magenta-tinged dark (top)
    hangarMid: '#0a0011',       // Deep purple-black (middle)
    hangarEdge: '#050008',      // Near-black with purple (bottom/edge)
    paperWhite: '#FCFAF5',      // Watercolor paper
    
    // Pigment limits (prevent mud)
    maxPigments: 2,
    updateCooldownMs: 1200,     // Debounce rapid updates
    
    // Parallax settings
    parallax: {
      maxOffset: 6,             // Never exceed ±6px
      easing: 0.08,             // Smooth inertial feel
    },
    
    // Page-specific pigment recipes
    pageRecipes: {
      'hangar': ['Yellow Ochre', 'Burnt Umber'],           // Warm, lived-in
      'fleet': ['Indian Yellow', "Payne's Grey"],          // Operational
      'derivatives': ['Prussian Blue', "Payne's Grey"],    // Cool, analytical
      'missions': ['Burnt Umber', 'Sepia'],                // Weathered
      'telemetry': ['Cyan', "Payne's Grey"],               // Technical
      'battle': ['Carmine', 'Sepia'],                      // Danger, aged
    },
    
    // Mission doctrine pigment biases
    missionDoctrines: {
      'DEEP_STRIKE': ['Carmine', "Payne's Grey"],          // High contrast, bruised
      'ESCORT': ['Yellow Ochre', 'Burnt Umber'],           // Neutral earths
      'RECON': ['Cyan', "Payne's Grey"],                   // Technical clarity
      'SIEGE': ['Sepia', 'Burnt Umber'],                   // Patience, weathered
      'INTERCEPT': ['Orange', 'Indian Yellow'],            // Swift, warm
      'PATROL': ['Permanent Green', 'Yellow Ochre'],       // Steady, natural
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
    },
    
    // Pigment priority for clamping (higher = more important)
    pigmentPriority: {
      "Payne's Grey": 10,
      'Prussian Blue': 9,
      'Burnt Umber': 8,
      'Indian Yellow': 7,
      'Yellow Ochre': 6,
      'Sepia': 5,
      'Cyan': 4,
      'Carmine': 3,
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────────────────
  
  let engine = null;
  let initialized = false;
  let currentAmbient = null;
  let currentPatina = null;
  let lastUpdateTime = 0;
  let reducedMotion = false;
  let frozenAfterFirstRender = false;
  
  // Parallax state
  let parallaxEnabled = false;
  let parallaxLayers = [];
  let targetX = 0, targetY = 0;
  let currentX = 0, currentY = 0;
  let parallaxRAF = null;

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
    
    // Check reduced motion preference
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    initialized = true;
    console.log('[HangarWatercolor] Initialized with', engine.getAllPigments().length, 'pigments', 
                reducedMotion ? '(reduced motion)' : '');
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DEBOUNCING & CLAMPING
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Check if update is allowed (debounce)
   */
  function canUpdate() {
    // If reduced motion, freeze after first render
    if (reducedMotion && frozenAfterFirstRender) {
      return false;
    }
    
    const now = Date.now();
    if (now - lastUpdateTime < CONFIG.updateCooldownMs) {
      return false;
    }
    lastUpdateTime = now;
    return true;
  }
  
  /**
   * Clamp pigment array to max count, sorted by priority
   */
  function clampPigments(pigmentNames) {
    // Sort by priority (higher first)
    const sorted = [...pigmentNames].sort((a, b) => {
      const pa = CONFIG.pigmentPriority[a] || 0;
      const pb = CONFIG.pigmentPriority[b] || 0;
      return pb - pa;
    });
    
    // Take top N
    return sorted.slice(0, CONFIG.maxPigments);
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
    
    // Debounce check (skip if too soon, unless first render)
    if (!canUpdate() && currentAmbient) {
      return currentAmbient;
    }
    
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
    
    // Clamp to prevent mud
    const clamped = clampPigments(pigments);
    
    return computeAmbient(clamped);
  }

  /**
   * Compute ambient from explicit pigment list
   * @param {string[]} pigmentNames - Array of pigment names
   * @returns {string} Ambient color hex
   */
  function computeAmbient(pigmentNames) {
    if (!init()) return CONFIG.hangarBase;
    
    // Clamp pigments
    const clamped = clampPigments(pigmentNames);
    
    // Filter to glazing pigments only (transparent/semi-transparent)
    const pigments = clamped
      .map(name => engine.findPigment(name))
      .filter(p => p && p.transparency !== 'opaque');
    
    if (pigments.length === 0) {
      return CONFIG.hangarBase;
    }
    
    // Glaze over dark base
    const glazed = engine.glazeMultiple(pigments, CONFIG.hangarBase);
    
    // Blend back toward base to cap opacity
    currentAmbient = engine.lerp(CONFIG.hangarBase, glazed, CONFIG.maxAmbientOpacity * 8);
    
    // Mark as rendered for reduced motion freeze
    frozenAfterFirstRender = true;
    
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
  
  /**
   * Get mission doctrine ambient bias
   * @param {string} missionType - Mission type (DEEP_STRIKE, ESCORT, etc.)
   * @returns {string} Ambient color hex
   */
  function getMissionDoctrineAmbient(missionType) {
    const recipe = CONFIG.missionDoctrines[missionType] || CONFIG.pageRecipes['missions'];
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
    
    // Clamp to prevent mud
    const clamped = clampPigments(pigments);
    
    return computePatina(clamped);
  }

  /**
   * Compute patina from explicit pigment list
   * @param {string[]} pigmentNames - Array of pigment names
   * @returns {string} Patina color hex
   */
  function computePatina(pigmentNames) {
    if (!init()) return null;
    
    const clamped = clampPigments(pigmentNames);
    
    const pigments = clamped
      .map(name => engine.findPigment(name))
      .filter(Boolean);
    
    if (pigments.length === 0) return null;
    
    // Glaze over paper white (simulates the patina color itself)
    currentPatina = engine.glazeMultiple(pigments, CONFIG.paperWhite);
    
    return currentPatina;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MICRO-PARALLAX SYSTEM
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Initialize parallax on layers with data-depth attribute
   * Only runs on non-touch devices with motion enabled
   */
  function initParallax() {
    // Skip on touch devices or reduced motion
    if (reducedMotion || 'ontouchstart' in window) {
      console.log('[HangarWatercolor] Parallax disabled (touch/reduced motion)');
      return;
    }
    
    parallaxLayers = document.querySelectorAll('[data-depth]');
    if (parallaxLayers.length === 0) return;
    
    parallaxEnabled = true;
    
    // Mouse move listener (throttled via RAF)
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    
    // Start animation loop
    parallaxLoop();
    
    console.log('[HangarWatercolor] Parallax enabled on', parallaxLayers.length, 'layers');
  }
  
  /**
   * Handle mouse movement - update targets
   */
  function handleMouseMove(e) {
    if (!parallaxEnabled) return;
    
    // Normalize to -0.5 to 0.5
    targetX = (e.clientX / window.innerWidth - 0.5);
    targetY = (e.clientY / window.innerHeight - 0.5);
  }
  
  /**
   * Parallax animation loop - smooth easing
   */
  function parallaxLoop() {
    if (!parallaxEnabled) return;
    
    // Ease toward target (inertial feel)
    currentX += (targetX - currentX) * CONFIG.parallax.easing;
    currentY += (targetY - currentY) * CONFIG.parallax.easing;
    
    // Apply to layers
    parallaxLayers.forEach(layer => {
      const depth = parseFloat(layer.dataset.depth) || 0;
      const maxOff = CONFIG.parallax.maxOffset;
      
      const x = currentX * depth * maxOff * 2;
      const y = currentY * depth * maxOff * 2;
      
      // Clamp to max offset
      const clampedX = Math.max(-maxOff, Math.min(maxOff, x));
      const clampedY = Math.max(-maxOff, Math.min(maxOff, y));
      
      layer.style.transform = `translate(${clampedX}px, ${clampedY}px)`;
    });
    
    parallaxRAF = requestAnimationFrame(parallaxLoop);
  }
  
  /**
   * Stop parallax system
   */
  function stopParallax() {
    parallaxEnabled = false;
    if (parallaxRAF) {
      cancelAnimationFrame(parallaxRAF);
      parallaxRAF = null;
    }
    document.removeEventListener('mousemove', handleMouseMove);
    
    // Reset transforms
    parallaxLayers.forEach(layer => {
      layer.style.transform = '';
    });
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
   * Full page setup - applies ambient, parallax, and prepares patina system
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
    
    // Initialize parallax (only on hangar and fleet, not during active UI)
    if (pageName === 'hangar' || pageName === 'fleet') {
      // Delay slightly to ensure DOM is ready
      setTimeout(initParallax, 100);
    }
    
    console.log('[HangarWatercolor] Page setup complete:', pageName);
  }

  /**
   * Inject CSS for watercolor system with proper layer structure
   * Layer order: Base gradient → Watercolor → CRT → UI
   */
  function injectPatinaStyles() {
    if (document.getElementById('watercolor-patina-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'watercolor-patina-styles';
    style.textContent = `
      /* ═══════════════════════════════════════════════════════════════════
         WATERCOLOR PATINA SYSTEM v2 - Miami Chromatic Integration
         Layer order: Base → Watercolor → CRT → UI
         ═══════════════════════════════════════════════════════════════════ */
      
      :root {
        --hangar-ambient: ${CONFIG.hangarBase};
        --hangar-ambient-opacity: ${CONFIG.maxAmbientOpacity};
        --ship-patina: transparent;
        --ship-patina-opacity: ${CONFIG.maxPatinaOpacity};
        
        /* Miami chromatic gradient */
        --bg-miami-gradient: linear-gradient(
          180deg,
          ${CONFIG.hangarBase} 0%,
          ${CONFIG.hangarMid} 45%,
          ${CONFIG.hangarEdge} 100%
        );
      }
      
      /* ─────────────────────────────────────────────────────────────────────
         BASE LAYER - Miami Chromatic Black
         This replaces the neutral green-black and gives pigments headroom
         ───────────────────────────────────────────────────────────────────── */
      .watercolor-ambient {
        background: var(--bg-miami-gradient) !important;
      }
      
      /* ─────────────────────────────────────────────────────────────────────
         WATERCOLOR LAYER - Sits above base, below CRT
         Dedicated layer prevents CRT from crushing pigment color
         ───────────────────────────────────────────────────────────────────── */
      .watercolor-layer {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 1;
        background: radial-gradient(
          ellipse at 40% 30%,
          var(--hangar-ambient) 0%,
          transparent 60%
        );
        opacity: 0.85; /* High enough to be visible against chromatic black */
        mix-blend-mode: screen;
      }
      
      /* ─────────────────────────────────────────────────────────────────────
         CRT LAYER - Above watercolor, preserves chromatic warmth
         ───────────────────────────────────────────────────────────────────── */
      .crt-layer {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 2;
      }
      
      /* ─────────────────────────────────────────────────────────────────────
         UI LAYER - All Space Capital content
         ───────────────────────────────────────────────────────────────────── */
      .ui-layer {
        position: relative;
        z-index: 3;
      }
      
      /* ─────────────────────────────────────────────────────────────────────
         PARALLAX LAYERS - Atmospheric depth
         ───────────────────────────────────────────────────────────────────── */
      .parallax-layer {
        position: fixed;
        inset: -10px;
        pointer-events: none;
      }
      
      .layer-bg {
        z-index: 0;
        background: radial-gradient(
          ellipse at center,
          rgba(20, 0, 11, 0.4) 0%,
          rgba(5, 0, 8, 0.9) 70%
        );
      }
      
      .layer-wash {
        z-index: 1;
        background: radial-gradient(
          ellipse at 30% 40%,
          rgba(200, 160, 80, 0.04) 0%,
          transparent 50%
        ),
        radial-gradient(
          ellipse at 70% 60%,
          rgba(157, 78, 221, 0.03) 0%,
          transparent 40%
        );
      }
      
      /* ─────────────────────────────────────────────────────────────────────
         SHIP PATINA - Multiply blend overlay
         ───────────────────────────────────────────────────────────────────── */
      .ship-patina-enabled {
        position: relative;
      }
      
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
      
      /* Fallback for browsers without mix-blend-mode support */
      @supports not (mix-blend-mode: multiply) {
        .ship-patina-enabled::after {
          opacity: 0.04;
          background-blend-mode: normal;
        }
      }
      
      /* Softer patina variant */
      .ship-patina-soft::after {
        mix-blend-mode: soft-light;
        opacity: calc(var(--ship-patina-opacity) * 1.5);
      }
      
      /* ─────────────────────────────────────────────────────────────────────
         PARALLAX DATA-DEPTH LAYERS
         ───────────────────────────────────────────────────────────────────── */
      [data-depth] {
        will-change: transform;
        transition: none;
      }
      
      /* ─────────────────────────────────────────────────────────────────────
         REDUCED MOTION - Accessibility
         ───────────────────────────────────────────────────────────────────── */
      @media (prefers-reduced-motion: reduce) {
        [data-depth] {
          transform: none !important;
          will-change: auto;
        }
        
        .watercolor-layer {
          opacity: calc(var(--hangar-ambient-opacity) * 0.7);
        }
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
      reducedMotion,
      frozenAfterFirstRender,
      parallaxEnabled,
      parallaxLayerCount: parallaxLayers.length,
      config: CONFIG
    };
  }
  
  /**
   * Force reset (for debugging/testing)
   */
  function reset() {
    stopParallax();
    currentAmbient = null;
    currentPatina = null;
    lastUpdateTime = 0;
    frozenAfterFirstRender = false;
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
    getMissionDoctrineAmbient,
    applyAmbient,
    
    // Patina
    computePatina,
    computePatinaBySin,
    computePatinaFromEnv,
    applyPatina,
    
    // Page setup
    setupPage,
    
    // Parallax
    initParallax,
    stopParallax,
    
    // Utilities
    getDilutionGradient,
    getState,
    reset,
    
    // Constants (read-only)
    get CONFIG() { return { ...CONFIG }; }
  };

})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HangarWatercolor;
}
