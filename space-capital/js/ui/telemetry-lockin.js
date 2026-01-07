/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TELEMETRY LOCK-IN TRANSITION
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Replaces the generic WARP loading transition with a data-driven lock-in
 * sequence that feels like ship configuration, not loading.
 * 
 * Sequence:
 * 1. Ship silhouette appears
 * 2. Telemetry layers snap on (engine, shield, targeting)
 * 3. Data panels populate
 * 4. Hard cut to main interface
 * 
 * Duration: <800ms total (intentional, not loading)
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';

  const TIMING = {
    LAYER_DELAY: 100,      // ms between layer activations
    DATA_DELAY: 50,        // ms between data panel activations
    HOLD_DURATION: 200,    // ms to hold complete state
    EXIT_DURATION: 200,    // ms for exit animation
    TOTAL_MAX: 800         // max total duration
  };

  const LAYERS = ['engine', 'shield', 'targeting'];
  const DATA_PANELS = ['left', 'right'];

  /**
   * Create the Lock-In screen DOM structure
   */
  function createLockInScreen() {
    const screen = document.createElement('div');
    screen.className = 'lockin-screen';
    screen.id = 'lockin-screen';
    screen.innerHTML = `
      <div class="lockin-ship">
        <div class="lockin-ship-silhouette"></div>
        
        <!-- Telemetry Layers -->
        <div class="lockin-layer lockin-layer-engine" data-layer="engine"></div>
        <div class="lockin-layer lockin-layer-shield" data-layer="shield"></div>
        <div class="lockin-layer lockin-layer-targeting" data-layer="targeting">
          <span class="corner-bl"></span>
          <span class="corner-br"></span>
        </div>
        
        <!-- Data Panels -->
        <div class="lockin-telemetry lockin-telemetry-left" data-panel="left">
          <div class="lockin-telemetry-label">SIGNAL</div>
          <div class="lockin-telemetry-value">LOCKED</div>
        </div>
        <div class="lockin-telemetry lockin-telemetry-right" data-panel="right">
          <div class="lockin-telemetry-label">STATUS</div>
          <div class="lockin-telemetry-value">READY</div>
        </div>
      </div>
      
      <div class="lockin-status" id="lockin-status">ACQUIRING TELEMETRY</div>
      
      <div class="lockin-progress" id="lockin-progress">
        <div class="lockin-progress-segment" data-segment="0"></div>
        <div class="lockin-progress-segment" data-segment="1"></div>
        <div class="lockin-progress-segment" data-segment="2"></div>
        <div class="lockin-progress-segment" data-segment="3"></div>
        <div class="lockin-progress-segment" data-segment="4"></div>
      </div>
    `;
    return screen;
  }

  /**
   * Activate a layer with snap animation
   */
  function activateLayer(screen, layerName) {
    const layer = screen.querySelector(`[data-layer="${layerName}"]`);
    if (layer) {
      layer.classList.add('active');
    }
  }

  /**
   * Activate a data panel
   */
  function activatePanel(screen, panelName) {
    const panel = screen.querySelector(`[data-panel="${panelName}"]`);
    if (panel) {
      panel.classList.add('active');
    }
  }

  /**
   * Update progress segments
   */
  function updateProgress(screen, count) {
    const segments = screen.querySelectorAll('.lockin-progress-segment');
    segments.forEach((seg, i) => {
      if (i < count) {
        seg.classList.add('filled');
      }
    });
  }

  /**
   * Update status text
   */
  function updateStatus(screen, text, active = false) {
    const status = screen.querySelector('#lockin-status');
    if (status) {
      status.textContent = text;
      status.classList.toggle('active', active);
    }
  }

  /**
   * Complete the lock-in and transition out
   */
  function complete(screen) {
    return new Promise(resolve => {
      updateStatus(screen, 'SYSTEMS LOCKED', false);
      screen.classList.add('complete');
      
      setTimeout(() => {
        screen.remove();
        resolve();
      }, TIMING.EXIT_DURATION);
    });
  }

  /**
   * Run the full lock-in sequence
   * @param {Object} options - Configuration options
   * @param {Function} options.onDataReady - Callback when data should be loaded
   * @param {Object} options.telemetryData - Optional telemetry data to display
   * @returns {Promise} Resolves when transition is complete
   */
  async function runLockIn(options = {}) {
    const { onDataReady, telemetryData } = options;
    
    // Create and insert the lock-in screen
    const screen = createLockInScreen();
    document.body.insertBefore(screen, document.body.firstChild);
    
    // Force reflow to ensure CSS is applied
    screen.offsetHeight;
    
    let progress = 0;
    
    // Stage 1: Activate layers sequentially
    updateStatus(screen, 'ACQUIRING TELEMETRY', true);
    
    for (const layer of LAYERS) {
      await delay(TIMING.LAYER_DELAY);
      activateLayer(screen, layer);
      progress++;
      updateProgress(screen, progress);
    }
    
    // Stage 2: Activate data panels
    updateStatus(screen, 'CONFIGURING SYSTEMS', true);
    
    // If we have actual telemetry data, update the panels
    if (telemetryData) {
      const leftPanel = screen.querySelector('[data-panel="left"] .lockin-telemetry-value');
      const rightPanel = screen.querySelector('[data-panel="right"] .lockin-telemetry-value');
      
      if (leftPanel && telemetryData.signal) {
        leftPanel.textContent = telemetryData.signal;
      }
      if (rightPanel && telemetryData.status) {
        rightPanel.textContent = telemetryData.status;
      }
    }
    
    for (const panel of DATA_PANELS) {
      await delay(TIMING.DATA_DELAY);
      activatePanel(screen, panel);
      progress++;
      updateProgress(screen, Math.min(progress, 5));
    }
    
    // Stage 3: Load actual data if callback provided
    if (typeof onDataReady === 'function') {
      updateStatus(screen, 'LOADING FLEET DATA', true);
      await onDataReady();
    }
    
    // Stage 4: Brief hold, then exit
    updateStatus(screen, 'LOCK CONFIRMED', false);
    await delay(TIMING.HOLD_DURATION);
    
    // Complete and exit
    await complete(screen);
    
    return true;
  }

  /**
   * Simple delay helper
   */
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Quick lock-in for page transitions (faster)
   */
  async function quickLockIn() {
    const screen = createLockInScreen();
    document.body.insertBefore(screen, document.body.firstChild);
    screen.offsetHeight;
    
    // Activate everything at once
    LAYERS.forEach(l => activateLayer(screen, l));
    DATA_PANELS.forEach(p => activatePanel(screen, p));
    updateProgress(screen, 5);
    updateStatus(screen, 'LOCK CONFIRMED', false);
    
    await delay(150);
    await complete(screen);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  window.TelemetryLockIn = {
    run: runLockIn,
    quick: quickLockIn,
    TIMING
  };

})();
