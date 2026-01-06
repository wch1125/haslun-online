/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SPACE CAPITAL - SHIP IDLE ANIMATION
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Adds life to static ship displays with subtle animation:
 * - Micro drift (slow horizontal sway)
 * - Vertical bob (gentle breathing motion)
 * - Telemetry-based jitter (volatility = instability)
 * - Engine glow pulse
 * 
 * "A ship at rest is never truly still"
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

window.ShipIdleAnimation = (function() {
  'use strict';

  // Active animations (element -> animation state)
  const activeAnimations = new Map();
  
  // Animation presets per ship class
  const CLASS_PRESETS = {
    Flagship: { driftScale: 0.8, bobScale: 0.6, jitterScale: 0.3 },
    Carrier: { driftScale: 0.5, bobScale: 0.4, jitterScale: 0.2 },
    Fighter: { driftScale: 1.2, bobScale: 1.0, jitterScale: 0.8 },
    Scout: { driftScale: 1.3, bobScale: 1.1, jitterScale: 0.6 },
    Drone: { driftScale: 1.5, bobScale: 0.8, jitterScale: 1.0 },
    Lander: { driftScale: 0.6, bobScale: 0.5, jitterScale: 0.4 },
    eVTOL: { driftScale: 0.9, bobScale: 1.2, jitterScale: 0.5 },
    Cargo: { driftScale: 0.4, bobScale: 0.3, jitterScale: 0.2 },
    Relay: { driftScale: 0.7, bobScale: 0.6, jitterScale: 0.3 },
    Recon: { driftScale: 1.1, bobScale: 0.9, jitterScale: 0.7 },
    Moonshot: { driftScale: 1.4, bobScale: 1.3, jitterScale: 1.2 },
    default: { driftScale: 1.0, bobScale: 1.0, jitterScale: 0.5 }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ANIMATION STATE
  // ═══════════════════════════════════════════════════════════════════════════

  function createAnimationState(options = {}) {
    return {
      t: Math.random() * Math.PI * 2, // Start at random phase for variety
      ticker: options.ticker || null,
      shipClass: options.shipClass || 'default',
      telemetryChop: options.telemetryChop || 0.3,
      
      // Tuning
      driftAmplitude: 6 * (options.driftScale || 1),
      driftSpeed: 0.4,
      bobAmplitude: 4 * (options.bobScale || 1),
      bobSpeed: 0.6,
      jitterAmplitude: 2 * (options.jitterScale || 0.5),
      jitterSpeed: 9,
      
      // Engine glow
      engineGlowEnabled: options.engineGlow !== false,
      engineGlowMin: 1.0,
      engineGlowMax: 1.35,
      engineGlowSpeed: 1.8,
      
      // State
      running: true,
      rafId: null
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ANIMATION LOOP
  // ═══════════════════════════════════════════════════════════════════════════

  function animateIdle(element, state) {
    if (!state.running || !element || !element.isConnected) {
      state.running = false;
      activeAnimations.delete(element);
      return;
    }

    const dt = 0.016; // ~60fps
    state.t += dt;

    // Calculate transforms
    const drift = Math.sin(state.t * state.driftSpeed) * state.driftAmplitude;
    const bob = Math.cos(state.t * state.bobSpeed) * state.bobAmplitude;
    
    // Jitter scales with telemetry chop (volatility)
    const jitter = state.telemetryChop * Math.sin(state.t * state.jitterSpeed) * state.jitterAmplitude;
    const rotationJitter = jitter * 0.4;

    // Apply transform
    element.style.transform = `
      translate(${drift + jitter}px, ${bob}px)
      rotate(${rotationJitter}deg)
    `;

    // Engine glow pulse
    if (state.engineGlowEnabled) {
      const glowPhase = (Math.sin(state.t * state.engineGlowSpeed) + 1) / 2;
      const brightness = state.engineGlowMin + glowPhase * (state.engineGlowMax - state.engineGlowMin);
      
      // Apply to child img if present, or to element itself
      const target = element.querySelector('img') || element;
      const currentFilter = target.style.filter || '';
      
      // Preserve drop-shadow but update brightness
      if (currentFilter.includes('drop-shadow')) {
        target.style.filter = currentFilter.replace(
          /brightness\([^)]+\)/g, 
          ''
        ) + ` brightness(${brightness.toFixed(2)})`;
      } else {
        target.style.filter = `brightness(${brightness.toFixed(2)})`;
      }
    }

    state.rafId = requestAnimationFrame(() => animateIdle(element, state));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TELEMETRY INTEGRATION
  // ═══════════════════════════════════════════════════════════════════════════

  function getTelemetryChop(ticker) {
    // Try to get real telemetry data
    if (window.ShipTelemetry?.hasData(ticker)) {
      const bias = window.ShipTelemetry.getPaletteBias(ticker);
      // chopSensitivity is 0-1, higher = more volatile
      return bias?.chopSensitivity || 0.3;
    }
    
    // Fallback: estimate from ticker characteristics
    const volatileTickers = ['GME', 'LUNR', 'JOBY', 'ACHR'];
    const stableTickers = ['RTX', 'LHX', 'GE'];
    
    if (volatileTickers.includes(ticker)) return 0.7;
    if (stableTickers.includes(ticker)) return 0.2;
    return 0.4;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Start idle animation on an element
   * @param {HTMLElement} element - The ship sprite container
   * @param {Object} options - Animation options
   * @param {string} options.ticker - Ship ticker for telemetry
   * @param {string} options.shipClass - Ship class for presets
   * @param {boolean} options.engineGlow - Enable engine glow (default true)
   */
  function start(element, options = {}) {
    if (!element) return null;

    // Stop existing animation on this element
    stop(element);

    // Get class preset
    const preset = CLASS_PRESETS[options.shipClass] || CLASS_PRESETS.default;
    
    // Get telemetry chop
    const telemetryChop = options.ticker ? getTelemetryChop(options.ticker) : 0.3;

    // Create animation state
    const state = createAnimationState({
      ...preset,
      ticker: options.ticker,
      shipClass: options.shipClass,
      telemetryChop,
      engineGlow: options.engineGlow
    });

    // Store and start
    activeAnimations.set(element, state);
    
    // Add CSS class for any additional styling
    element.classList.add('ship-idle-animated');
    
    // Start animation loop
    animateIdle(element, state);

    console.log(`[ShipIdle] Started animation for ${options.ticker || 'unknown'} (class: ${options.shipClass}, chop: ${telemetryChop.toFixed(2)})`);

    return state;
  }

  /**
   * Stop idle animation on an element
   * @param {HTMLElement} element - The animated element
   */
  function stop(element) {
    if (!element) return;

    const state = activeAnimations.get(element);
    if (state) {
      state.running = false;
      if (state.rafId) {
        cancelAnimationFrame(state.rafId);
      }
      activeAnimations.delete(element);
      
      // Reset transform
      element.style.transform = '';
      element.classList.remove('ship-idle-animated');
      
      // Reset filter on child img
      const img = element.querySelector('img');
      if (img) {
        img.style.filter = img.style.filter.replace(/brightness\([^)]+\)/g, '').trim();
      }
    }
  }

  /**
   * Update telemetry for an active animation
   * @param {HTMLElement} element - The animated element
   * @param {number} chopValue - New chop value (0-1)
   */
  function updateTelemetry(element, chopValue) {
    const state = activeAnimations.get(element);
    if (state) {
      state.telemetryChop = Math.max(0, Math.min(1, chopValue));
    }
  }

  /**
   * Stop all active animations
   */
  function stopAll() {
    activeAnimations.forEach((state, element) => {
      stop(element);
    });
  }

  /**
   * Check if element has active animation
   */
  function isAnimating(element) {
    return activeAnimations.has(element);
  }

  /**
   * Get count of active animations
   */
  function getActiveCount() {
    return activeAnimations.size;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INTEGRATION HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Auto-start animation when hero ship container is updated
   * Call this from hangar/ship selection code
   */
  function attachToHeroShip(containerSelector = '#hero-ship-container', shipData = {}) {
    const container = typeof containerSelector === 'string' 
      ? document.querySelector(containerSelector) 
      : containerSelector;
    
    if (!container) return null;

    return start(container, {
      ticker: shipData.ticker,
      shipClass: shipData.class || shipData.shipClass,
      engineGlow: true
    });
  }

  // Visibility handling - pause when tab is hidden
  document.addEventListener('visibilitychange', () => {
    activeAnimations.forEach((state, element) => {
      if (document.hidden) {
        state.running = false;
        if (state.rafId) cancelAnimationFrame(state.rafId);
      } else {
        state.running = true;
        animateIdle(element, state);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    start,
    stop,
    stopAll,
    updateTelemetry,
    isAnimating,
    getActiveCount,
    attachToHeroShip,
    CLASS_PRESETS
  };

})();

console.log('🚀 ShipIdleAnimation module loaded');
