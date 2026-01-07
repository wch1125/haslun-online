/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ORBITAL OBSERVATORY BRIDGE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Connects the OrbitalObservatory to:
 * - Real Telemetry data from TelemetryData loader
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
    currentTimeframe: '1D',
    
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
      
      // Wait for telemetry data to load, then add fleets
      if (window.TelemetryData?.isLoaded) {
        this.initializeFleets();
      } else {
        window.addEventListener('telemetry-loaded', () => {
          this.initializeFleets();
          this.updateTelemetry();
        });
        // Also try after a short delay as fallback
        setTimeout(() => this.initializeFleets(), 500);
      }
      
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
        // Ensure container is visible and has dimensions
        const container = this.container;
        if (container) {
          // Force layout recalculation
          container.offsetHeight;
        }
        this.observatory.resize();
      }
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // FLEET INITIALIZATION
    // ─────────────────────────────────────────────────────────────────────────
    
    initializeFleets() {
      // Wait for telemetry to be ready
      if (!window.TelemetryData?.isLoaded && !window.TICKER_PROFILES) {
        console.log('[ObservatoryController] Waiting for telemetry data...');
        return;
      }
      
      // Get tickers from real telemetry data
      const tickers = this.getPortfolioTickers();
      
      // Preload sprites for all tickers
      if (window.OrbitalSpriteCache) {
        window.OrbitalSpriteCache.preload(tickers);
      }
      
      // Clear existing fleets from observatory and benchmarks
      this.observatory.fleets = [];
      this.observatory.benchmarks.forEach(b => {
        b.fleets = [];
      });
      
      // Add fleets
      tickers.forEach(symbol => {
        const benchmark = this.observatory.getBenchmarkForTicker(symbol);
        this.observatory.addFleet(symbol, benchmark);
      });
      
      console.log(`[ObservatoryController] Added ${tickers.length} fleets from telemetry data`);
    },
    
    getPortfolioTickers() {
      // Use TelemetryData if available
      if (window.TelemetryData?.isLoaded) {
        return window.TelemetryData.getSymbols();
      }
      
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
    // TIMEFRAME SWITCHING
    // ─────────────────────────────────────────────────────────────────────────
    
    setTimeframe(tf) {
      if (['1D', '45m', '15m'].includes(tf)) {
        this.currentTimeframe = tf;
        if (window.TelemetryData) {
          window.TelemetryData.setTimeframe(tf);
        }
        this.updateTelemetry();
        
        // Update UI
        const tfBtn = document.getElementById('obs-timeframe');
        if (tfBtn) {
          tfBtn.textContent = tf;
        }
      }
    },
    
    cycleTimeframe() {
      const timeframes = ['1D', '45m', '15m'];
      const currentIndex = timeframes.indexOf(this.currentTimeframe);
      const nextIndex = (currentIndex + 1) % timeframes.length;
      this.setTimeframe(timeframes[nextIndex]);
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
      // Use real TelemetryData if available
      if (window.TelemetryData) {
        return window.TelemetryData.buildSnapshot(this.currentTimeframe);
      }
      
      // Fallback to simulated data
      const snapshot = {};
      snapshot._portfolio = this.getPortfolioMetrics();
      
      const tickers = this.getPortfolioTickers();
      tickers.forEach(symbol => {
        snapshot[symbol] = this.getTickerTelemetry(symbol);
      });
      
      ['SPY', 'XAR', 'QQQ'].forEach(symbol => {
        snapshot[symbol] = this.getBenchmarkTelemetry(symbol);
      });
      
      return snapshot;
    },
    
    getPortfolioMetrics() {
      if (window.TelemetryData?.isLoaded) {
        return window.TelemetryData.getPortfolio(this.currentTimeframe);
      }
      
      // Fallback
      return {
        healthScore: 0.75,
        volatility: 0.25,
        drawdown: -0.05,
        sentiment: 0.6,
        totalValue: 100000,
        dayChange: 0.012
      };
    },
    
    getTickerTelemetry(symbol) {
      if (window.TelemetryData) {
        return window.TelemetryData.get(symbol, this.currentTimeframe);
      }
      
      // Fallback simulated
      return {
        relativePerformance: (Math.random() - 0.5) * 0.4,
        momentum: (Math.random() - 0.5) * 0.2,
        drawdown: -Math.random() * 0.1,
        volumePercentile: Math.random(),
        volumeZ: (Math.random() - 0.5) * 2,
        realizedVol: 0.2 + Math.random() * 0.3,
        ivRank: Math.random() * 0.6,
        portfolioWeight: 0.1,
        price: 50,
        dayChange: (Math.random() - 0.5) * 0.06
      };
    },
    
    getBenchmarkTelemetry(symbol) {
      if (window.TelemetryData) {
        const data = window.TelemetryData.get(symbol, this.currentTimeframe);
        return {
          momentum: data?.momentum || 0,
          volatility: data?.volatility || 0.15
        };
      }
      
      return {
        momentum: (Math.random() - 0.5) * 0.1,
        volatility: 0.15 + Math.random() * 0.1
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
              <span class="observatory-stat-label">Timeframe</span>
              <span class="observatory-stat-value" id="obs-timeframe">1D</span>
            </div>
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
          <button class="observatory-btn" id="obs-tf-cycle" title="Cycle Timeframe (T)">◷</button>
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
            <span>Your Portfolio</span>
          </div>
          <div class="legend-item">
            <div class="legend-icon benchmark"></div>
            <span>Benchmark Zone</span>
          </div>
          <div class="legend-item">
            <div class="legend-icon fleet"></div>
            <span>Fleet (Position)</span>
          </div>
          <div class="legend-glyphs">
            <div class="glyph-item">
              <span class="glyph-icon up">▲</span>
              <span>Up</span>
            </div>
            <div class="glyph-item">
              <span class="glyph-icon neutral">■</span>
              <span>Flat</span>
            </div>
            <div class="glyph-item">
              <span class="glyph-icon down">▼</span>
              <span>Down</span>
            </div>
          </div>
          <div class="legend-divider"></div>
          <div class="legend-item" id="obs-data-source">
            <span style="font-size: 9px; opacity: 0.6;">Loading data...</span>
          </div>
          <div class="legend-item" style="margin-top: 8px;">
            <button class="guide-btn" id="obs-show-guide" style="font-size: 10px; padding: 4px 8px; border-width: 1px;">
              ? Help
            </button>
          </div>
        </div>
        
        <!-- Tooltip -->
        <div class="observatory-tooltip" id="obs-tooltip"></div>
      `;
      
      this.container.appendChild(hud);
      this.bindHUDEvents();
      
      // Create guided overlay
      this.createGuide();
      
      // Update data source indicator
      this.updateDataSourceIndicator();
      
      // Show guide on first visit
      this.checkFirstVisit();
    },
    
    createGuide() {
      const guide = document.createElement('div');
      guide.className = 'observatory-guide';
      guide.id = 'observatory-guide';
      guide.innerHTML = `
        <div class="guide-content">
          <!-- Step 1: Sun -->
          <div class="guide-step" data-step="1">
            <div class="guide-icon sun">☀</div>
            <div class="guide-title">Your Portfolio</div>
            <div class="guide-text">
              The sun at the center represents your entire portfolio. 
              Its brightness shows overall health, and turbulence indicates market volatility.
              The colored ring segments show different health metrics.
            </div>
          </div>
          
          <!-- Step 2: Benchmarks -->
          <div class="guide-step" data-step="2">
            <div class="guide-icon planet">◉</div>
            <div class="guide-title">Benchmark Zones</div>
            <div class="guide-text">
              Planets represent market benchmarks like SPY, XAR, and QQQ.
              They define "zones" where your positions operate.
              Each zone represents a different market sector or style.
            </div>
          </div>
          
          <!-- Step 3: Fleets -->
          <div class="guide-step" data-step="3">
            <div class="guide-icon fleet">▲</div>
            <div class="guide-title">Your Positions</div>
            <div class="guide-text">
              Each fleet represents one of your holdings. 
              More ships = larger position size.
              The formation shape reflects volatility: tight rings are calm, scattered swarms are stressed.
            </div>
          </div>
          
          <!-- Step 4: State Glyphs -->
          <div class="guide-step" data-step="4">
            <div class="guide-icon motion">⬡</div>
            <div class="guide-title">Reading the Glyphs</div>
            <div class="guide-text">
              Each fleet has a status glyph above it:<br>
              <span style="color: #33ff99">▲ Green = Trending up</span><br>
              <span style="color: #ffb347">■ Amber = Consolidating</span><br>
              <span style="color: #ff3366">▼ Red = Trending down</span><br>
              The border color shows risk level.
            </div>
          </div>
          
          <!-- Step 5: Interaction -->
          <div class="guide-step" data-step="5">
            <div class="guide-icon fleet">✦</div>
            <div class="guide-title">Interact & Explore</div>
            <div class="guide-text">
              <b>Click</b> any object to see details.<br>
              <b>Double-click</b> to focus camera.<br>
              <b>Drag</b> to pan around.<br>
              <b>Scroll</b> to zoom in/out.<br>
              Press <b>T</b> to switch timeframes.
            </div>
          </div>
          
          <div class="guide-progress">
            <div class="guide-dot" data-step="1"></div>
            <div class="guide-dot" data-step="2"></div>
            <div class="guide-dot" data-step="3"></div>
            <div class="guide-dot" data-step="4"></div>
            <div class="guide-dot" data-step="5"></div>
          </div>
          
          <div class="guide-buttons">
            <button class="guide-btn skip" id="guide-skip">Skip</button>
            <button class="guide-btn" id="guide-next">Next →</button>
          </div>
        </div>
      `;
      
      this.container.appendChild(guide);
      this.bindGuideEvents();
    },
    
    bindGuideEvents() {
      this.guideStep = 1;
      
      document.getElementById('guide-next')?.addEventListener('click', () => {
        this.nextGuideStep();
      });
      
      document.getElementById('guide-skip')?.addEventListener('click', () => {
        this.closeGuide();
      });
      
      document.getElementById('obs-show-guide')?.addEventListener('click', () => {
        this.showGuide();
      });
    },
    
    showGuide() {
      const guide = document.getElementById('observatory-guide');
      if (guide) {
        this.guideStep = 1;
        this.updateGuideStep();
        guide.classList.add('visible');
      }
    },
    
    closeGuide() {
      const guide = document.getElementById('observatory-guide');
      if (guide) {
        guide.classList.remove('visible');
        localStorage.setItem('observatory-guide-seen', 'true');
      }
    },
    
    nextGuideStep() {
      const totalSteps = 5;
      if (this.guideStep >= totalSteps) {
        this.closeGuide();
      } else {
        this.guideStep++;
        this.updateGuideStep();
      }
    },
    
    updateGuideStep() {
      // Update step visibility
      document.querySelectorAll('.guide-step').forEach(step => {
        step.classList.remove('active');
        if (parseInt(step.dataset.step) === this.guideStep) {
          step.classList.add('active');
        }
      });
      
      // Update dots
      document.querySelectorAll('.guide-dot').forEach(dot => {
        const step = parseInt(dot.dataset.step);
        dot.classList.remove('active', 'completed');
        if (step === this.guideStep) dot.classList.add('active');
        else if (step < this.guideStep) dot.classList.add('completed');
      });
      
      // Update button text
      const nextBtn = document.getElementById('guide-next');
      if (nextBtn) {
        nextBtn.textContent = this.guideStep >= 5 ? 'Done ✓' : 'Next →';
      }
    },
    
    checkFirstVisit() {
      if (!localStorage.getItem('observatory-guide-seen')) {
        // Show guide after a short delay
        setTimeout(() => this.showGuide(), 1000);
      }
    },
    
    updateDataSourceIndicator() {
      const indicator = document.getElementById('obs-data-source');
      if (indicator) {
        if (window.TelemetryData?.isLoaded) {
          const count = window.TelemetryData.getSymbols().length;
          indicator.innerHTML = `<span style="font-size: 9px; color: var(--hotline-green, #33ff99);">◉ LIVE DATA (${count} tickers)</span>`;
        } else {
          indicator.innerHTML = `<span style="font-size: 9px; color: var(--hotline-amber, #ffb347);">◎ SIMULATED</span>`;
        }
      }
    },
    
    bindHUDEvents() {
      // Timeframe cycle
      document.getElementById('obs-tf-cycle')?.addEventListener('click', () => {
        this.cycleTimeframe();
      });
      
      // Keyboard shortcut for timeframe
      document.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 't' && !e.ctrlKey && !e.metaKey) {
          const panel = document.getElementById('fleet-status-panel');
          if (panel && panel.classList.contains('active')) {
            this.cycleTimeframe();
          }
        }
      });
      
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
        const health = sun.brightness.cur;
        const turb = sun.turbulence.cur;
        const temp = sun.temperature.cur;
        
        // Semantic assessment
        let overallStatus = 'Stable';
        let statusClass = '';
        if (health > 0.7 && turb < 0.4) {
          overallStatus = 'Healthy';
          statusClass = 'positive';
        } else if (health < 0.5 || turb > 0.6) {
          overallStatus = 'Under Stress';
          statusClass = 'negative';
        }
        
        return `
          <div class="selection-summary">
            <div class="summary-status ${statusClass}">${overallStatus}</div>
            <div class="summary-text">
              ${health > 0.6 ? 'Portfolio is performing well' : 'Portfolio needs attention'}. 
              ${turb > 0.5 ? 'High market volatility detected.' : 'Market conditions are calm.'}
            </div>
          </div>
          <div class="selection-metric">
            <span class="metric-label">Overall Health</span>
            <span class="metric-value">${(health * 100).toFixed(0)}%</span>
          </div>
          <div class="selection-metric">
            <span class="metric-label">Market Regime</span>
            <span class="metric-value ${temp > 0.5 ? 'positive' : 'negative'}">
              ${temp > 0.5 ? 'BULLISH' : 'BEARISH'}
            </span>
          </div>
          <div class="selection-metric">
            <span class="metric-label">Volatility</span>
            <div class="metric-bar"><div class="metric-bar-fill" style="width: ${turb * 100}%; background: ${turb > 0.5 ? '#ffb347' : '#33ff99'}"></div></div>
          </div>
        `;
      }
      
      if (body.type === 'benchmark') {
        const benchmark = body;
        const glow = benchmark.glow?.cur || 0;
        
        return `
          <div class="selection-summary">
            <div class="summary-status">${benchmark.roleLabel}</div>
            <div class="summary-text">
              This benchmark defines a market zone. Fleets near this planet track ${benchmark.symbol}'s performance.
            </div>
          </div>
          <div class="selection-metric">
            <span class="metric-label">Sector</span>
            <span class="metric-value">${benchmark.roleLabel}</span>
          </div>
          <div class="selection-metric">
            <span class="metric-label">Activity</span>
            <div class="metric-bar"><div class="metric-bar-fill" style="width: ${glow * 100}%"></div></div>
          </div>
          <div class="selection-metric">
            <span class="metric-label">Fleets in Zone</span>
            <span class="metric-value">${benchmark.fleets?.length || 0}</span>
          </div>
        `;
      }
      
      if (body.type === 'fleet') {
        const fleet = body;
        const telem = fleet.telemetry || {};
        
        const dayChange = (telem.chgPct || telem.dayChange || 0);
        const price = telem.price || 0;
        
        // Semantic descriptions
        const trendDesc = {
          'favorable': 'Positive trend',
          'neutral': 'Consolidating',
          'adverse': 'Negative trend'
        }[fleet.trendState] || 'Unknown';
        
        const riskDesc = {
          'controlled': 'Low risk',
          'watch': 'Elevated risk',
          'stressed': 'High stress'
        }[fleet.riskState] || 'Unknown';
        
        // Formation explanation
        const formationDesc = {
          'ring': 'Stable patrol formation',
          'arrow': 'Aggressive momentum formation',
          'swarm': 'Scattered (high volatility)',
          'line': 'Defensive alignment'
        }[fleet.formationType] || fleet.formationType;
        
        // Overall assessment
        let overallStatus = 'Stable';
        let statusClass = '';
        if (fleet.trendState === 'favorable' && fleet.riskState === 'controlled') {
          overallStatus = 'Healthy';
          statusClass = 'positive';
        } else if (fleet.riskState === 'stressed' || fleet.trendState === 'adverse') {
          overallStatus = 'Needs Attention';
          statusClass = 'negative';
        }
        
        return `
          <div class="selection-summary">
            <div class="summary-status ${statusClass}">${overallStatus}</div>
            <div class="summary-text">
              ${trendDesc} vs ${fleet.benchmark?.symbol || 'benchmark'}. 
              ${riskDesc}. 
              ${formationDesc}.
            </div>
          </div>
          <div class="selection-metric">
            <span class="metric-label">Price</span>
            <span class="metric-value">$${price.toFixed(2)}</span>
          </div>
          <div class="selection-metric">
            <span class="metric-label">Day Change</span>
            <span class="metric-value ${dayChange >= 0 ? 'positive' : 'negative'}">
              ${dayChange >= 0 ? '+' : ''}${dayChange.toFixed(2)}%
            </span>
          </div>
          <div class="selection-metric">
            <span class="metric-label">Trend</span>
            <span class="metric-value ${fleet.trendState === 'favorable' ? 'positive' : fleet.trendState === 'adverse' ? 'negative' : ''}">
              ${trendDesc}
            </span>
          </div>
          <div class="selection-metric">
            <span class="metric-label">Ships</span>
            <span class="metric-value">${fleet.shipCount} vessels</span>
          </div>
          <div class="selection-metric">
            <span class="metric-label">Stress Level</span>
            <div class="metric-bar"><div class="metric-bar-fill" style="width: ${fleet.stress.cur * 100}%; background: ${fleet.stress.cur > 0.5 ? '#ff3366' : fleet.stress.cur > 0.3 ? '#ffb347' : '#33ff99'}"></div></div>
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
