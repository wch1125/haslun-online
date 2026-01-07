/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ORBITAL OBSERVATORY BRIDGE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Connects the OrbitalObservatory to:
 * - Existing Telemetry system
 * - Ship sprite rendering
 * - Selection panel UI
 * - Cockpit navigation
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // OBSERVATORY CONTROLLER
  // ═══════════════════════════════════════════════════════════════════════════
  
  const ObservatoryController = {
    observatory: null,
    container: null,
    isInitialized: false,
    updateInterval: null,
    
    // ─────────────────────────────────────────────────────────────────────────
    // INITIALIZATION
    // ─────────────────────────────────────────────────────────────────────────
    
    init(containerId = 'observatory-container') {
      if (this.isInitialized) return;
      
      this.container = document.getElementById(containerId);
      if (!this.container) {
        console.warn('[ObservatoryController] Container not found:', containerId);
        return;
      }
      
      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.className = 'observatory-canvas';
      canvas.id = 'observatory-canvas';
      this.container.appendChild(canvas);
      
      // Create HUD overlay
      this.createHUD();
      
      // Initialize observatory
      this.observatory = new window.OrbitalObservatory(canvas);
      
      // Size canvas
      this.resize();
      window.addEventListener('resize', () => this.resize());
      
      // Add portfolio tickers as fleets
      this.initializeFleets();
      
      // Set up callbacks
      this.observatory.onSelect = (body) => this.onBodySelect(body);
      this.observatory.onHover = (body) => this.onBodyHover(body);
      
      // Start telemetry updates
      this.startTelemetryUpdates();
      
      // Start the simulation
      this.observatory.start();
      
      this.isInitialized = true;
      console.log('[ObservatoryController] Initialized');
    },
    
    destroy() {
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
      }
      if (this.observatory) {
        this.observatory.stop();
      }
      this.isInitialized = false;
    },
    
    resize() {
      if (this.observatory) {
        this.observatory.resize();
      }
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // FLEET INITIALIZATION
    // ─────────────────────────────────────────────────────────────────────────
    
    initializeFleets() {
      // Get tickers from existing data
      const tickers = this.getPortfolioTickers();
      
      tickers.forEach(symbol => {
        const benchmark = this.observatory.getBenchmarkForTicker(symbol);
        this.observatory.addFleet(symbol, benchmark);
      });
      
      console.log(`[ObservatoryController] Added ${tickers.length} fleets`);
    },
    
    getPortfolioTickers() {
      // Try to get from TICKER_PROFILES or SHIP_SPRITES
      if (window.TICKER_PROFILES) {
        return Object.keys(window.TICKER_PROFILES);
      }
      if (window.SHIP_SPRITES) {
        return Object.keys(window.SHIP_SPRITES);
      }
      // Fallback default list
      return ['RKLB', 'ACHR', 'LUNR', 'JOBY', 'ASTS', 'BKSY', 'GME', 'GE', 'KTOS', 'PL', 'RDW', 'RTX', 'LHX', 'COHR', 'EVEX'];
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // TELEMETRY UPDATES
    // ─────────────────────────────────────────────────────────────────────────
    
    startTelemetryUpdates() {
      // Initial update
      this.updateTelemetry();
      
      // Update every 2 seconds
      this.updateInterval = setInterval(() => {
        this.updateTelemetry();
      }, 2000);
    },
    
    updateTelemetry() {
      const snapshot = this.buildTelemetrySnapshot();
      this.observatory.updateTelemetry(snapshot);
      this.updateHeaderStats(snapshot);
    },
    
    buildTelemetrySnapshot() {
      const snapshot = {};
      
      // Portfolio summary
      snapshot._portfolio = this.getPortfolioMetrics();
      
      // Individual tickers
      const tickers = this.getPortfolioTickers();
      tickers.forEach(symbol => {
        snapshot[symbol] = this.getTickerTelemetry(symbol);
      });
      
      // Benchmarks
      ['SPY', 'XAR', 'QQQ'].forEach(symbol => {
        snapshot[symbol] = this.getBenchmarkTelemetry(symbol);
      });
      
      return snapshot;
    },
    
    getPortfolioMetrics() {
      // Try to get real portfolio data
      const portfolioData = window.portfolioData || {};
      
      return {
        healthScore: portfolioData.healthScore || 0.75,
        volatility: portfolioData.volatility || 0.25,
        drawdown: portfolioData.drawdown || -0.05,
        sentiment: portfolioData.sentiment || 0.6,
        totalValue: portfolioData.totalValue || 100000,
        dayChange: portfolioData.dayChange || 0.012
      };
    },
    
    getTickerTelemetry(symbol) {
      // Get from existing Telemetry module if available
      const telem = window.Telemetry?.get(symbol) || {};
      const profile = window.TICKER_PROFILES?.[symbol] || {};
      
      return {
        // Performance
        relativePerformance: telem.relativePerformance || (Math.random() - 0.5) * 0.4,
        momentum: telem.momentum || (Math.random() - 0.5) * 0.2,
        drawdown: telem.drawdown || -Math.random() * 0.1,
        
        // Activity
        volumePercentile: telem.volumePercentile || Math.random(),
        volumeZ: telem.volumeZ || (Math.random() - 0.5) * 2,
        realizedVol: telem.realizedVol || 0.2 + Math.random() * 0.3,
        
        // Options
        ivRank: telem.ivRank || Math.random() * 0.6,
        gammaExposure: telem.gammaExposure || Math.random(),
        skew: telem.skew || (Math.random() - 0.5) * 0.3,
        
        // Position
        portfolioWeight: profile.weight || 0.1,
        price: telem.price || 50,
        dayChange: telem.dayChange || (Math.random() - 0.5) * 0.06
      };
    },
    
    getBenchmarkTelemetry(symbol) {
      const telem = window.Telemetry?.get(symbol) || {};
      
      return {
        momentum: telem.momentum || (Math.random() - 0.5) * 0.1,
        volatility: telem.volatility || 0.15 + Math.random() * 0.1
      };
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // HUD CREATION
    // ─────────────────────────────────────────────────────────────────────────
    
    createHUD() {
      const hud = document.createElement('div');
      hud.className = 'observatory-hud';
      hud.innerHTML = `
        <!-- Header Stats -->
        <div class="observatory-header">
          <div class="observatory-title">ORBITAL OBSERVATORY</div>
          <div class="observatory-stats">
            <div class="observatory-stat">
              <span class="observatory-stat-label">Portfolio Health</span>
              <span class="observatory-stat-value" id="obs-health">—</span>
            </div>
            <div class="observatory-stat">
              <span class="observatory-stat-label">Day P&L</span>
              <span class="observatory-stat-value" id="obs-pnl">—</span>
            </div>
            <div class="observatory-stat">
              <span class="observatory-stat-label">Active Fleets</span>
              <span class="observatory-stat-value" id="obs-fleets">0</span>
            </div>
          </div>
        </div>
        
        <!-- Controls -->
        <div class="observatory-controls">
          <button class="observatory-btn" id="obs-zoom-in" title="Zoom In">+</button>
          <button class="observatory-btn" id="obs-zoom-out" title="Zoom Out">−</button>
          <button class="observatory-btn" id="obs-home" title="Reset View">⌂</button>
        </div>
        
        <!-- Selection Panel -->
        <div class="observatory-selection" id="obs-selection">
          <div class="selection-header">
            <div>
              <div class="selection-symbol" id="sel-symbol">—</div>
              <div class="selection-type" id="sel-type">—</div>
            </div>
            <button class="selection-close" id="sel-close">×</button>
          </div>
          <div class="selection-content" id="sel-content">
            <!-- Dynamic content -->
          </div>
          <div class="selection-actions">
            <button class="selection-action" id="sel-focus">Focus</button>
            <button class="selection-action" id="sel-details">Details</button>
          </div>
        </div>
        
        <!-- Legend -->
        <div class="observatory-legend">
          <div class="legend-title">LEGEND</div>
          <div class="legend-item">
            <div class="legend-icon sun"></div>
            <span>Portfolio Sun</span>
          </div>
          <div class="legend-item">
            <div class="legend-icon benchmark"></div>
            <span>Benchmark</span>
          </div>
          <div class="legend-item">
            <div class="legend-icon fleet"></div>
            <span>Fleet (Position)</span>
          </div>
        </div>
        
        <!-- Tooltip -->
        <div class="observatory-tooltip" id="obs-tooltip"></div>
      `;
      
      this.container.appendChild(hud);
      this.bindHUDEvents();
    },
    
    bindHUDEvents() {
      // Zoom controls
      document.getElementById('obs-zoom-in')?.addEventListener('click', () => {
        this.observatory.camera.zoomBy(1.3, this.observatory.camera.centerX, this.observatory.camera.centerY);
      });
      
      document.getElementById('obs-zoom-out')?.addEventListener('click', () => {
        this.observatory.camera.zoomBy(0.7, this.observatory.camera.centerX, this.observatory.camera.centerY);
      });
      
      document.getElementById('obs-home')?.addEventListener('click', () => {
        this.observatory.camera.focusOn(this.observatory.sun);
        this.observatory.camera.targetZoom = 1.0;
        this.observatory.select(null);
      });
      
      // Selection panel
      document.getElementById('sel-close')?.addEventListener('click', () => {
        this.observatory.select(null);
      });
      
      document.getElementById('sel-focus')?.addEventListener('click', () => {
        if (this.observatory.selectedBody) {
          this.observatory.camera.focusOn(this.observatory.selectedBody);
        }
      });
      
      document.getElementById('sel-details')?.addEventListener('click', () => {
        if (this.observatory.selectedBody && this.observatory.selectedBody.type === 'fleet') {
          // Open ship brief dialog
          if (window.openShipBrief) {
            window.openShipBrief(this.observatory.selectedBody.symbol);
          }
        }
      });
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // UI UPDATES
    // ─────────────────────────────────────────────────────────────────────────
    
    updateHeaderStats(snapshot) {
      const portfolio = snapshot._portfolio || {};
      
      // Health
      const healthEl = document.getElementById('obs-health');
      if (healthEl) {
        const health = Math.round((portfolio.healthScore || 0.75) * 100);
        healthEl.textContent = `${health}%`;
        healthEl.className = 'observatory-stat-value ' + (health >= 70 ? 'positive' : health >= 40 ? '' : 'negative');
      }
      
      // P&L
      const pnlEl = document.getElementById('obs-pnl');
      if (pnlEl) {
        const change = portfolio.dayChange || 0;
        const pct = (change * 100).toFixed(2);
        pnlEl.textContent = `${change >= 0 ? '+' : ''}${pct}%`;
        pnlEl.className = 'observatory-stat-value ' + (change >= 0 ? 'positive' : 'negative');
      }
      
      // Fleet count
      const fleetsEl = document.getElementById('obs-fleets');
      if (fleetsEl && this.observatory) {
        fleetsEl.textContent = this.observatory.fleets.length;
      }
    },
    
    onBodySelect(body) {
      const panel = document.getElementById('obs-selection');
      if (!panel) return;
      
      if (!body) {
        panel.classList.remove('visible');
        return;
      }
      
      panel.classList.add('visible');
      
      // Update header
      document.getElementById('sel-symbol').textContent = body.symbol || body.id;
      document.getElementById('sel-type').textContent = body.type.toUpperCase();
      
      // Update content based on type
      const content = document.getElementById('sel-content');
      if (content) {
        content.innerHTML = this.buildSelectionContent(body);
      }
      
      // Show/hide details button
      const detailsBtn = document.getElementById('sel-details');
      if (detailsBtn) {
        detailsBtn.style.display = body.type === 'fleet' ? 'block' : 'none';
      }
    },
    
    buildSelectionContent(body) {
      if (body.type === 'sun') {
        const sun = body;
        return `
          <div class="selection-metric">
            <span class="metric-label">Brightness</span>
            <span class="metric-value">${(sun.brightness.cur * 100).toFixed(0)}%</span>
          </div>
          <div class="selection-metric">
            <span class="metric-label">Turbulence</span>
            <span class="metric-value">${(sun.turbulence.cur * 100).toFixed(0)}%</span>
          </div>
          <div class="selection-metric">
            <span class="metric-label">Temperature</span>
            <span class="metric-value ${sun.temperature.cur > 0.5 ? 'positive' : 'negative'}">
              ${sun.temperature.cur > 0.5 ? 'BULLISH' : 'BEARISH'}
            </span>
          </div>
        `;
      }
      
      if (body.type === 'benchmark') {
        const benchmark = body;
        return `
          <div class="selection-metric">
            <span class="metric-label">Orbit Radius</span>
            <span class="metric-value">${benchmark.orbitRadius.toFixed(0)} AU</span>
          </div>
          <div class="selection-metric">
            <span class="metric-label">Angular Velocity</span>
            <span class="metric-value">${(benchmark.omega.cur * 100).toFixed(1)}°/s</span>
          </div>
          <div class="selection-metric">
            <span class="metric-label">Eccentricity</span>
            <span class="metric-value">${benchmark.eccentricity.cur.toFixed(3)}</span>
          </div>
          <div class="selection-metric">
            <span class="metric-label">Glow</span>
            <div class="metric-bar"><div class="metric-bar-fill" style="width: ${benchmark.glow.cur * 100}%"></div></div>
          </div>
        `;
      }
      
      if (body.type === 'fleet') {
        const fleet = body;
        const telem = fleet.telemetry || {};
        
        const momentum = telem.momentum || 0;
        const dayChange = telem.dayChange || 0;
        
        return `
          <div class="selection-metric">
            <span class="metric-label">Day Change</span>
            <span class="metric-value ${dayChange >= 0 ? 'positive' : 'negative'}">
              ${dayChange >= 0 ? '+' : ''}${(dayChange * 100).toFixed(2)}%
            </span>
          </div>
          <div class="selection-metric">
            <span class="metric-label">Momentum</span>
            <span class="metric-value ${momentum >= 0 ? 'positive' : 'negative'}">
              ${momentum >= 0 ? '+' : ''}${(momentum * 100).toFixed(1)}%
            </span>
          </div>
          <div class="selection-metric">
            <span class="metric-label">Orbit Radius</span>
            <span class="metric-value">${fleet.orbitRadius.cur.toFixed(0)}</span>
          </div>
          <div class="selection-metric">
            <span class="metric-label">Velocity</span>
            <span class="metric-value">${(fleet.omega.cur * 100).toFixed(1)}°/s</span>
          </div>
          <div class="selection-metric">
            <span class="metric-label">IV Rank</span>
            <span class="metric-value">${((telem.ivRank || 0) * 100).toFixed(0)}%</span>
          </div>
          <div class="selection-metric">
            <span class="metric-label">Stress</span>
            <div class="metric-bar"><div class="metric-bar-fill" style="width: ${fleet.stress.cur * 100}%; background: ${fleet.stress.cur > 0.5 ? '#ff3366' : '#00ffff'}"></div></div>
          </div>
        `;
      }
      
      return '';
    },
    
    onBodyHover(body) {
      const tooltip = document.getElementById('obs-tooltip');
      if (!tooltip) return;
      
      if (!body) {
        tooltip.classList.remove('visible');
        return;
      }
      
      // Position tooltip near cursor
      const canvas = this.observatory.canvas;
      const rect = canvas.getBoundingClientRect();
      const screenX = this.observatory.camera.worldToScreenX(body.x);
      const screenY = this.observatory.camera.worldToScreenY(body.y);
      
      tooltip.style.left = `${screenX + 20}px`;
      tooltip.style.top = `${screenY - 10}px`;
      
      // Content
      if (body.type === 'fleet') {
        const telem = body.telemetry || {};
        const dayChange = telem.dayChange || 0;
        tooltip.innerHTML = `
          <div class="tooltip-symbol">${body.symbol}</div>
          <div class="tooltip-row">
            <span>Day:</span>
            <span class="${dayChange >= 0 ? 'positive' : 'negative'}">${dayChange >= 0 ? '+' : ''}${(dayChange * 100).toFixed(2)}%</span>
          </div>
        `;
      } else {
        tooltip.innerHTML = `<div class="tooltip-symbol">${body.symbol || body.id}</div>`;
      }
      
      tooltip.classList.add('visible');
    }
  };
  
  // ═══════════════════════════════════════════════════════════════════════════
  // COCKPIT INTEGRATION
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Hook into CockpitNav when available
  function integrateCockpitNav() {
    const originalInit = window.CockpitNav?.initFleetStatus;
    
    if (window.CockpitNav) {
      window.CockpitNav.initFleetStatus = function() {
        // Initialize observatory when fleet status panel is ready
        setTimeout(() => {
          ObservatoryController.init('observatory-container');
        }, 100);
      };
      
      // Override switchPanel to handle observatory start/stop
      const originalSwitch = window.CockpitNav.switchPanel;
      window.CockpitNav.switchPanel = function(panel) {
        originalSwitch.call(this, panel);
        
        if (panel === 'fleet-status') {
          if (!ObservatoryController.isInitialized) {
            ObservatoryController.init('observatory-container');
          } else {
            ObservatoryController.observatory?.start();
          }
        } else {
          // Pause when not visible to save resources
          // ObservatoryController.observatory?.stop();
        }
      };
    }
  }
  
  // Auto-initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    integrateCockpitNav();
  });
  
  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════════════
  
  window.ObservatoryController = ObservatoryController;
  
  console.log('[ObservatoryBridge] Module loaded');
  
})();
