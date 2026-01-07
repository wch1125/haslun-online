    // =========================================================================
    // PARALLAX :: Main Application
    // External data modules loaded via separate scripts (see index.html)
    // =========================================================================
    
    // Alias externally loaded data modules
    const TICKER_PROFILES = window.TICKER_PROFILES || {};
    const PARALLAX_GLOSSARY = window.PARALLAX_GLOSSARY || {};
    const PORTFOLIO_MOODS = window.PORTFOLIO_MOODS || {};
    const MACD_STATES = window.MACD_STATES || {};
    const SHIP_LORE = window.SHIP_LORE || {};
    const PIXEL_SHIPS = window.PIXEL_SHIPS || {};
    const PIXEL_SHIP_LORE = window.PIXEL_SHIP_LORE || {};
    const SHIP_NAMES = window.SHIP_NAMES || {};
    const SHIP_SPRITES = window.SHIP_SPRITES || {};
    const DEFAULT_SHIP_SPRITE = window.DEFAULT_SHIP_SPRITE || 'assets/ships/static/Unclaimed-Drone-ship.png';

    // =========================================================================
    // MOBILE VIEWPORT HEIGHT HELPER
    // Fixes iOS address-bar "jump" that breaks vh-based layouts.
    // Use: height: calc(var(--vh, 1vh) * 100)
    // =========================================================================
    function setViewportUnits() {
      try {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
      } catch (e) {
        // Non-fatal
      }
    }

    window.addEventListener('resize', setViewportUnits, { passive: true });
    window.addEventListener('orientationchange', setViewportUnits, { passive: true });
    document.addEventListener('DOMContentLoaded', setViewportUnits);
    
    // =========================================================================
    // CHART.JS LAZY LOADER
    // Only loads Chart.js when DATA tab is accessed (saves ~200KB initial load)
    // =========================================================================
    const ChartLoader = {
      loaded: false,
      loading: false,
      callbacks: [],
      
      async load() {
        if (this.loaded) return Promise.resolve();
        if (this.loading) {
          return new Promise(resolve => this.callbacks.push(resolve));
        }
        
        this.loading = true;
        console.log('[PERF] Lazy-loading Chart.js...');
        
        try {
          // Load Chart.js
          await this.loadScript('https://cdn.jsdelivr.net/npm/chart.js');
          // Load date adapter
          await this.loadScript('https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns');
          
          this.loaded = true;
          this.loading = false;
          console.log('[PERF] Chart.js loaded successfully');
          
          // Resolve all waiting callbacks
          this.callbacks.forEach(cb => cb());
          this.callbacks = [];
          
          return Promise.resolve();
        } catch (err) {
          this.loading = false;
          console.error('[PERF] Failed to load Chart.js:', err);
          return Promise.reject(err);
        }
      },
      
      loadScript(src) {
        return new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = src;
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      },
      
      // Check if Chart is available
      isReady() {
        return this.loaded && typeof Chart !== 'undefined';
      }
    };
    
    window.ChartLoader = ChartLoader;
    
    // Loading screen countdown (data-driven fleet)
    function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }

    const PerformanceCache = {
      byTicker: {},
      async get(ticker){
        const t = (ticker||"").toUpperCase();
        if (this.byTicker[t]) return this.byTicker[t];
        try{
          const res = await fetch('data/' + t.toLowerCase() + '.json');
          const data = await res.json();
          const daily = Array.isArray(data.daily) ? data.daily : [];
          const intra = Array.isArray(data.intraday15) ? data.intraday15 : (Array.isArray(data.intraday) ? data.intraday : []);
          const closesDaily = daily.slice(-6).map(x=>Number(x.c)).filter(Number.isFinite);
          const closesIntra  = intra.slice(-40).map(x=>Number(x.c)).filter(Number.isFinite);

          // Daily return from last two daily closes
          let r1d = 0;
          if (closesDaily.length >= 2){
            const prev = closesDaily[closesDaily.length-2];
            const last = closesDaily[closesDaily.length-1];
            if (prev) r1d = ((last-prev)/prev)*100;
          }

          // Volatility from intraday returns (std dev of pct changes)
          let vol = 0;
          if (closesIntra.length >= 6){
            const rets = [];
            for (let i=1;i<closesIntra.length;i++){
              const a = closesIntra[i-1], b = closesIntra[i];
              if (a) rets.push(((b-a)/a)*100);
            }
            if (rets.length){
              const mean = rets.reduce((s,x)=>s+x,0)/rets.length;
              const variance = rets.reduce((s,x)=>s+(x-mean)*(x-mean),0)/rets.length;
              vol = Math.sqrt(variance);
            }
          }

          // Momentum slope (simple: last - first over window, pct)
          let mom = 0;
          if (closesIntra.length >= 10){
            const first = closesIntra[0], last = closesIntra[closesIntra.length-1];
            if (first) mom = ((last-first)/first)*100;
          }

          const out = { r1d, vol, mom, closesIntra };
          this.byTicker[t] = out;
          return out;
        } catch(e){
          const out = { r1d: 0, vol: 0, mom: 0, closesIntra: [] };
          this.byTicker[t] = out;
          return out;
        }
      }
    };

    function drawSparkline(canvas, closes, color){
      if (!canvas || !canvas.getContext) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0,0,w,h);

      if (!closes || closes.length < 2) return;

      const min = Math.min(...closes);
      const max = Math.max(...closes);
      const range = Math.max(1e-9, max-min);

      // faint grid
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#ffffff';
      for (let x=0; x<w; x+=10) ctx.fillRect(x, 0, 1, h);
      for (let y=0; y<h; y+=8) ctx.fillRect(0, y, w, 1);

      // line
      ctx.globalAlpha = 0.95;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i=0;i<closes.length;i++){
        const x = (i/(closes.length-1))*(w-2)+1;
        const y = h - 2 - ((closes[i]-min)/range)*(h-4);
        if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.stroke();

      // last dot
      const lx = (w-2)+1;
      const ly = h - 2 - ((closes[closes.length-1]-min)/range)*(h-4);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(lx, ly, 2.3, 0, Math.PI*2);
      ctx.fill();
    }

    async function createLoadingFleet(){
      const fleetLayer = document.getElementById('loading-fleet');
      if (!fleetLayer || !window.SHIP_SPRITES) return;

      fleetLayer.innerHTML = '';
      const tickers = Object.keys(SHIP_SPRITES);

      // Figure out elite winners based on actual daily return from series (fallback to statsData if present)
      const perfList = [];
      for (const t of tickers){
        const perf = await PerformanceCache.get(t);
        let r = perf.r1d;
        if ((!Number.isFinite(r) || r === 0) && window.statsData && statsData[t] && Number.isFinite(statsData[t].return_1d)){
          r = statsData[t].return_1d;
        }
        perfList.push({ t, r });
      }
      perfList.sort((a,b)=> (b.r ?? -Infinity) - (a.r ?? -Infinity));
      const eliteSet = new Set(perfList.slice(0, Math.min(3, perfList.length)).map(x=>x.t));

      // Normalize returns for speed mapping
      const valid = perfList.map(x=>x.r).filter(v=>Number.isFinite(v));
      const minR = valid.length ? Math.min(...valid) : -2;
      const maxR = valid.length ? Math.max(...valid) :  2;
      const range = Math.max(0.0001, maxR-minR);

      const shipCount = Math.max(20, tickers.length * 2);

      for (let i=0;i<shipCount;i++){
        const ticker = tickers[i % tickers.length];
        const perf = await PerformanceCache.get(ticker);

        // Wrapper so we can attach sparkline + sprite together
        const wrap = document.createElement('div');
        wrap.className = 'loading-ship-wrap' + (eliteSet.has(ticker) ? ' elite' : '');
        wrap.dataset.ticker = ticker;

        // Lane placement
        const x = eliteSet.has(ticker) ? (35 + Math.random()*30) : (Math.random()*100);
        wrap.style.setProperty('--x', x + '%');

        // Glow color by ticker (fallback)
        const glow = (window.tickerColors && tickerColors[ticker]) ? tickerColors[ticker] : '#33ff99';
        wrap.style.setProperty('--shipGlow', glow);

        // Sparkline color reflects momentum (green up, red down)
        const sparkColor = (perf.mom >= 0) ? 'rgba(51,255,153,0.95)' : 'rgba(255,107,107,0.95)';
        wrap.style.setProperty('--sparkGlow', sparkColor);

        // Scale influenced by volatility (more volatile = slightly larger / more presence)
        const baseScale = 0.75 + Math.random()*0.55;
        const volBoost = 1 + clamp(perf.vol/6, 0, 0.25);
        const scale = (eliteSet.has(ticker) ? baseScale*1.12 : baseScale) * volBoost;
        wrap.style.setProperty('--scale', scale.toFixed(2));

        // Duration based on daily return: winners faster, losers slower
        let r = perf.r1d;
        if ((!Number.isFinite(r) || r === 0) && window.statsData && statsData[ticker] && Number.isFinite(statsData[ticker].return_1d)){
          r = statsData[ticker].return_1d;
        }
        const norm = clamp((r - minR) / range, 0, 1);
        const fast = 3.0, slow = 10.0;
        let duration = slow - (slow-fast)*norm;
        if (eliteSet.has(ticker)) duration *= 0.78;

        // Stagger start
        const delay = -Math.random()*duration;
        wrap.style.setProperty('--duration', duration.toFixed(2)+'s');
        wrap.style.setProperty('--delay', delay.toFixed(2)+'s');

        // Sparkline canvas (tiny HUD above ship)
        const canvas = document.createElement('canvas');
        canvas.className = 'ship-spark';
        canvas.width = 110;
        canvas.height = 34;

        // Draw from last ~30 closes
        const closes = (perf.closesIntra && perf.closesIntra.length) ? perf.closesIntra.slice(-30) : [];
        drawSparkline(canvas, closes, sparkColor);

        // Ship badge
        const badge = document.createElement('div');
        badge.className = 'ship-badge';
        badge.innerHTML = eliteSet.has(ticker) ? (ticker + ' ' + PixelIcons.toSvg('star', '#ffaa33', 10)) : ticker;

        // Sprite
        const img = document.createElement('img');
        img.src = SHIP_SPRITES[ticker];
        img.alt = ticker + ' ship';

        wrap.appendChild(canvas);
        wrap.appendChild(badge);
        wrap.appendChild(img);
        fleetLayer.appendChild(wrap);
      }
    }

    async function runCountdown() {
      const loadingOverlay = document.getElementById('loading-overlay');
      const loadingCanvas = document.getElementById('loading-canvas');
      const app = document.getElementById('app');
      
      // Also handle old loading-screen if still in DOM
      const oldLoadingScreen = document.getElementById('loading-screen');

      // Step 5: Start canvas flight scene
      let flightController = null;
      
      if (loadingCanvas && window.FlightScene) {
        try {
          // Build ship roster from mission/manifest data
          const ships = await FlightScene.buildShipRoster();
          
          flightController = FlightScene.create({
            canvas: loadingCanvas,
            ships: ships,
            mode: 'loading',
            intensity: 1.0,
            minDisplayTime: 2000, // 2 second minimum display
            onReady: () => {
              // Fade out loading overlay
              if (loadingOverlay) loadingOverlay.classList.add('hidden');
              if (oldLoadingScreen) oldLoadingScreen.classList.add('hidden');
              app.classList.add('visible');
              
              // Stop flight scene after fade
              setTimeout(() => {
                if (flightController) flightController.stop();
                // Remove overlay from DOM after animation
                if (loadingOverlay) loadingOverlay.remove();
              }, 600);
              
              // Initialize app
              init();
            }
          });
          
          // Signal ready after init tasks complete (data loads, etc.)
          // For now, trigger after a short delay to allow basic setup
          setTimeout(() => {
            if (flightController) flightController.signalReady();
          }, 800);
          
        } catch (e) {
          console.warn('[Loading] Flight scene failed, falling back:', e);
          // Fallback: just show app after delay
          setTimeout(() => {
            if (loadingOverlay) loadingOverlay.classList.add('hidden');
            if (oldLoadingScreen) oldLoadingScreen.classList.add('hidden');
            app.classList.add('visible');
            init();
          }, 1500);
        }
      } else {
        // No FlightScene available, fallback to simple timer
        setTimeout(() => {
          if (loadingOverlay) loadingOverlay.classList.add('hidden');
          if (oldLoadingScreen) oldLoadingScreen.classList.add('hidden');
          app.classList.add('visible');
          init();
        }, 1500);
      }
    }

    // Start loading on DOM ready

    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(runCountdown, 500);
    });
    
    let currentTicker = 'RKLB', currentTimeframe = '1D', currentRange = '3M', showMA = true;
    let priceChart = null, macdChart = null, tickerData = {}, statsData = {};
    let macdOrbitMode = true; // MACD orbital visualization mode (default: ORBIT)
    
    const tickerColors = {
      'RKLB': '#33ff99', 'LUNR': '#47d4ff', 'ASTS': '#ffb347', 'ACHR': '#ff6b9d',
      'JOBY': '#b388ff', 'GME': '#ff6b6b', 'BKSY': '#47d4ff', 'RDW': '#33ff99',
      'PL': '#b388ff', 'EVEX': '#ff6b9d', 'MP': '#ffb347', 'KTOS': '#47d4ff',
      'IRDM': '#33ff99', 'HON': '#b388ff', 'ATI': '#ffb347', 'CACI': '#47d4ff', 'LOAR': '#ff6b9d',
      'COHR': '#47d4ff', 'GE': '#ff6b6b', 'LHX': '#33ff99', 'RTX': '#ff6b6b'
    };
    
    const tickerThemes = {
      'RKLB': 'SPACE', 'LUNR': 'SPACE', 'ASTS': 'SPACE', 'BKSY': 'SPACE',
      'RDW': 'SPACE', 'PL': 'SPACE', 'IRDM': 'SPACE', 'KTOS': 'DEFENSE',
      'ACHR': 'eVTOL', 'JOBY': 'eVTOL', 'EVEX': 'eVTOL', 'GME': 'MEME',
      'MP': 'MATERIALS', 'HON': 'INDUSTRIAL', 'ATI': 'MATERIALS',
      'CACI': 'DEFENSE', 'LOAR': 'AEROSPACE',
      'COHR': 'OPTICS', 'GE': 'INDUSTRIAL', 'LHX': 'DEFENSE', 'RTX': 'DEFENSE'
    };
    
    const rangeDays = { '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365, 'ALL': 9999 };
    
    // =========================================================================
    // EMA RIBBON CONFIGURATION (Step 3A - Telemetry Upgrade)
    // =========================================================================
    
    // Doubled EMA ribbon for pronounced effect (12 bands)
    const RIBBON_PERIODS = [5, 8, 10, 13, 16, 21, 26, 34, 42, 55, 70, 89];
    const RIBBON_COLORS = [
      '#33ff99', // phosphor green (fast)
      '#2de8a0', // mint
      '#47d4ff', // cyan
      '#5ac8ff', // light cyan
      '#8cb4ff', // periwinkle
      '#b388ff', // violet
      '#d070ff', // orchid
      '#ff4fd8', // magenta
      '#ff6b9d', // rose
      '#ffb347', // amber
      '#ffd447', // gold
      '#e8ff47', // lime (slow)
    ];
    
    /**
     * Calculate Exponential Moving Average
     */
    function calcEMA(values, period) {
      const k = 2 / (period + 1);
      const out = new Array(values.length).fill(null);
      
      // find first finite value
      let i0 = values.findIndex(v => Number.isFinite(v));
      if (i0 < 0) return out;
      
      let ema = values[i0];
      out[i0] = ema;
      
      for (let i = i0 + 1; i < values.length; i++) {
        const v = values[i];
        if (!Number.isFinite(v)) { out[i] = ema; continue; }
        ema = v * k + ema * (1 - k);
        out[i] = ema;
      }
      return out;
    }
    
    /**
     * Convert hex color to rgba with alpha
     */
    function hexToRgba(hex, a) {
      const h = (hex || '').replace('#', '');
      if (h.length !== 6) return `rgba(51,255,153,${a})`;
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${a})`;
    }
    
    /**
     * Chart.js plugin for topographic terrain effect
     * Creates altitude-map aesthetic beneath the price ribbon
     */
    const terrainPlugin = {
      id: 'terrainPlugin',
      beforeDraw(chart) {
        const { ctx, chartArea } = chart;
        if (!chartArea) return;
        
        // Only for price chart
        if (chart.canvas.id !== 'price-chart') return;
        
        const w = chartArea.right - chartArea.left;
        const h = chartArea.bottom - chartArea.top;
        
        ctx.save();
        
        // Terrain gradient from bottom (deep) to ribbon area (high altitude)
        const terrainGrad = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
        terrainGrad.addColorStop(0, 'rgba(51, 255, 153, 0.08)');
        terrainGrad.addColorStop(0.2, 'rgba(71, 212, 255, 0.05)');
        terrainGrad.addColorStop(0.4, 'rgba(179, 136, 255, 0.03)');
        terrainGrad.addColorStop(0.7, 'rgba(51, 255, 153, 0.02)');
        terrainGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = terrainGrad;
        ctx.fillRect(chartArea.left, chartArea.top, w, h);
        
        // Subtle horizontal contour lines (like topographic map)
        ctx.strokeStyle = 'rgba(51, 255, 153, 0.03)';
        ctx.lineWidth = 1;
        const contourSpacing = 40;
        for (let y = chartArea.bottom; y > chartArea.top; y -= contourSpacing) {
          ctx.beginPath();
          ctx.moveTo(chartArea.left, y);
          ctx.lineTo(chartArea.right, y);
          ctx.stroke();
        }
        
        ctx.restore();
      }
    };
    
    /**
     * Chart.js plugin for arcade CRT glow + scanlines
     * ENHANCED: Stronger glow for EM frequency aesthetic
     */
    const arcadeCRTPlugin = {
      id: 'arcadeCRTPlugin',
      beforeDatasetDraw(chart, args) {
        const ds = chart.data.datasets[args.index];
        if (!ds || !ds.borderColor) return;
        
        // Only glow line datasets (not bands/fills)
        const isLine = (ds.type || chart.config.type) === 'line';
        const isBand = ds.label && ds.label.startsWith('BAND');
        if (!isLine || isBand) return;
        
        ds.__glowSaved = true;
        const ctx = chart.ctx;
        ctx.save();
        
        // ENHANCED: Much stronger phosphor glow
        if (ds.isRibbon) {
          ctx.shadowBlur = 20;
          ctx.shadowColor = ds.borderColor;
          ctx.globalCompositeOperation = 'lighter';
        } else {
          // Main price line gets HEAVY bloom
          ctx.shadowBlur = 25;
          ctx.shadowColor = ds.borderColor;
          ctx.globalCompositeOperation = 'lighter';
        }
      },
      afterDatasetDraw(chart, args) {
        const ds = chart.data.datasets[args.index];
        if (ds && ds.__glowSaved) {
          ds.__glowSaved = false;
          chart.ctx.restore();
        }
      },
      afterDraw(chart) {
        const { ctx, chartArea } = chart;
        if (!chartArea) return;
        
        const now = performance.now() * 0.001;
        const w = chartArea.right - chartArea.left;
        const h = chartArea.bottom - chartArea.top;
        
        // ============================================
        // SCANLINES — More visible
        // ============================================
        ctx.save();
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = '#000';
        for (let y = chartArea.top; y < chartArea.bottom; y += 3) {
          ctx.fillRect(chartArea.left, y, w, 1);
        }
        ctx.restore();
        
        // ============================================
        // PHOSPHOR BLOOM — Ambient glow overlay
        // ============================================
        ctx.save();
        const gradient = ctx.createRadialGradient(
          chartArea.left + w/2, chartArea.top + h/2, 0,
          chartArea.left + w/2, chartArea.top + h/2, Math.max(w, h) * 0.7
        );
        gradient.addColorStop(0, 'rgba(51, 255, 153, 0.06)');
        gradient.addColorStop(0.5, 'rgba(51, 255, 153, 0.03)');
        gradient.addColorStop(1, 'rgba(51, 255, 153, 0)');
        
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.5 + Math.sin(now * 0.8) * 0.15;
        ctx.fillStyle = gradient;
        ctx.fillRect(chartArea.left, chartArea.top, w, h);
        ctx.restore();
        
        // ============================================
        // VERTICAL SYNC SWEEP — Continuous scan line
        // ============================================
        ctx.save();
        const sweepY = chartArea.top + ((now * 80) % h);
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.15;
        
        const sweepGrad = ctx.createLinearGradient(0, sweepY - 30, 0, sweepY + 30);
        sweepGrad.addColorStop(0, 'rgba(51, 255, 153, 0)');
        sweepGrad.addColorStop(0.4, 'rgba(51, 255, 153, 0.4)');
        sweepGrad.addColorStop(0.5, 'rgba(71, 212, 255, 0.6)');
        sweepGrad.addColorStop(0.6, 'rgba(51, 255, 153, 0.4)');
        sweepGrad.addColorStop(1, 'rgba(51, 255, 153, 0)');
        
        ctx.fillStyle = sweepGrad;
        ctx.fillRect(chartArea.left, sweepY - 30, w, 60);
        ctx.restore();
        
        // ============================================
        // CORNER VIGNETTE — CRT tube curve simulation
        // ============================================
        ctx.save();
        const vignetteGrad = ctx.createRadialGradient(
          chartArea.left + w/2, chartArea.top + h/2, Math.min(w, h) * 0.3,
          chartArea.left + w/2, chartArea.top + h/2, Math.max(w, h) * 0.8
        );
        vignetteGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vignetteGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.1)');
        vignetteGrad.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
        
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = vignetteGrad;
        ctx.fillRect(chartArea.left, chartArea.top, w, h);
        ctx.restore();
      }
    };
    
    /**
     * Step 6B: CRT interference jitter plugin for EMA ribbon
     * ENHANCED: Heavy EM frequency stabilization effect
     * Each band jitters independently like unstable radio frequencies
     */
    // =========================================================================
    // EMA ELECTROMAGNETIC GLITCH PLUGIN — True Signal Lock Effect
    // Creates authentic 80s EM interference / signal stabilization on ribbon
    // Price trace stays clean; ribbon looks like energy being wrangled
    // Mobile-optimized: reduced effects to prevent performance issues
    // =========================================================================
    
    // Noise helpers for EM displacement
    function hashNoise(n) {
      // Deterministic pseudo-noise 0..1
      return Math.abs((Math.sin(n * 999.123) * 43758.5453) % 1);
    }
    
    function smoothNoise(y, t) {
      // y in pixels, t in seconds — creates organic wave pattern
      const a = Math.sin((y * 0.035) + (t * 2.4));
      const b = Math.sin((y * 0.011) + (t * 7.2));
      const c = Math.sin((y * 0.003) + (t * 16.0));
      return (a * 0.55 + b * 0.30 + c * 0.15);
    }
    
    // Compute Y bounds of ribbon datasets only
    function getRibbonBounds(chart) {
      let top = Infinity;
      let bottom = -Infinity;
      
      chart.data.datasets.forEach((ds, i) => {
        if (!ds || !ds.isRibbon) return;
        const meta = chart.getDatasetMeta(i);
        if (!meta || !meta.data) return;
        meta.data.forEach(pt => {
          if (!pt || !Number.isFinite(pt.y)) return;
          top = Math.min(top, pt.y);
          bottom = Math.max(bottom, pt.y);
        });
      });
      
      if (!Number.isFinite(top) || !Number.isFinite(bottom)) return null;
      
      // Pad so fills/bands are included
      const pad = 12;
      top -= pad;
      bottom += pad;
      
      return { top, bottom };
    }
    
    const ribbonEMGlitchPlugin = {
      id: 'ribbonEMGlitchPlugin',

      // Internal state for burst scheduling
      _state: {
        nextBurstAt: 0,
        burstUntil: 0,
        burstSeed: 0,
        phase: 0,
      },

      afterDatasetsDraw(chart, args, pluginOpts) {
        const { ctx, chartArea } = chart;
        if (!chartArea) return;

        // Only for the price chart
        const canvas = chart.canvas;
        if (!canvas || canvas.id !== 'price-chart') return;

        // Determine if ribbon is visible (MA/RIBBON toggle)
        const anyRibbon = chart.data.datasets.some(ds => ds && ds.isRibbon);
        if (!anyRibbon) return;

        // PERFORMANCE: skip on very small canvases
        const w = chartArea.right - chartArea.left;
        const h = chartArea.bottom - chartArea.top;
        if (w < 200 || h < 120) return;
        
        // Get ribbon-only bounds (price line stays clean!)
        const rb = getRibbonBounds(chart);
        if (!rb) return;

        const now = performance.now();
        const t = now * 0.001;

        // Mobile detection - be conservative
        const isMobile = window.innerWidth < 768 || ('ontouchstart' in window);
        const intensity = isMobile ? 0.4 : 1.0;
        
        // On mobile: skip heavy effects entirely during normal operation
        // Only show effects during bursts, and keep them minimal

        // Burst scheduling: more frequent for dynamic visuals
        const st = this._state;
        if (now > st.nextBurstAt) {
          // Next burst in 1.5s–4s (more frequent for visual interest)
          st.nextBurstAt = now + (isMobile ? 2500 : 1200) + Math.random() * (isMobile ? 3500 : 2800);
          // Burst lasts 150–400ms (longer for more impact)
          st.burstUntil = now + (150 + Math.random() * 250);
          st.burstSeed = Math.random() * 1000;
        }

        const inBurst = now < st.burstUntil;
        
        // On mobile: only render during bursts to save performance
        if (isMobile && !inBurst) return;

        // ENHANCED: Higher base intensity for constant visible effects
        const base = isMobile ? 0.1 : 0.25;
        const burst = inBurst ? (0.85 * intensity) : 0.0;
        const amt = base + burst;
        if (amt <= 0) return;
        
        // Ribbon band dimensions
        const bandTop = Math.max(chartArea.top, rb.top);
        const bandBottom = Math.min(chartArea.bottom, rb.bottom);
        const bandH = Math.max(1, bandBottom - bandTop);
        
        // Sanity check - don't process if band is too large (prevents runaway)
        if (bandH > 800) return;

        // ============================================================
        // CLIP TO RIBBON BAND ONLY — Price line stays perfectly clean
        // ============================================================
        ctx.save();
        ctx.beginPath();
        ctx.rect(chartArea.left, bandTop, w, bandH);
        ctx.clip();

        // ============================================================
        // A) SCANLINE DISPLACEMENT — Simplified for mobile
        // On mobile: just do a few strategic strips, not per-scanline
        // ============================================================
        ctx.globalCompositeOperation = 'lighter';
        
        if (isMobile) {
          // MOBILE: Just 3-5 horizontal tear strips (not per-scanline)
          const numStrips = inBurst ? 4 : 2;
          for (let i = 0; i < numStrips; i++) {
            const stripY = bandTop + (bandH * (i + 0.5)) / numStrips;
            const stripH = 8 + Math.random() * 12;
            const shift = smoothNoise(stripY, t) * 6 * amt;
            
            ctx.globalAlpha = 0.15 * intensity;
            try {
              ctx.drawImage(
                canvas,
                chartArea.left, stripY, w, stripH,
                chartArea.left + shift, stripY, w, stripH
              );
            } catch (e) { /* ignore */ }
          }
        } else {
          // DESKTOP: Full scanline displacement — MORE VISIBLE
          const step = 3;
          const maxShift = 12 * amt;
          const maxIterations = Math.min(Math.floor(bandH / step), 150); // Cap iterations
          
          for (let i = 0; i < maxIterations; i++) {
            const y = i * step;
            const yy = bandTop + y;
            
            let shift = smoothNoise(yy, t) * maxShift;
            
            if (inBurst && Math.random() < 0.08) {
              shift += (Math.random() - 0.5) * (maxShift * 4);
            }
            
            ctx.globalAlpha = inBurst ? (0.25 * intensity) : (0.12 * intensity);
            
            try {
              ctx.drawImage(
                canvas,
                chartArea.left, yy, w, step,
                chartArea.left + shift, yy, w, step
              );
            } catch (e) { /* ignore */ }
          }
        }

        // ============================================================
        // B) CHROMATIC SPLIT — Desktop only, MORE VISIBLE
        // ============================================================
        if (!isMobile && amt > 0.08) {
          const cs = (inBurst ? 3.0 : 1.5) * amt;
          ctx.globalCompositeOperation = 'screen';
          
          try {
            ctx.globalAlpha = inBurst ? 0.12 : 0.07;
            ctx.filter = 'hue-rotate(30deg) saturate(1.4)';
            ctx.drawImage(canvas, chartArea.left, bandTop, w, bandH, 
                          chartArea.left + cs, bandTop, w, bandH);
            
            ctx.filter = 'hue-rotate(-30deg) saturate(1.4)';
            ctx.drawImage(canvas, chartArea.left, bandTop, w, bandH,
                          chartArea.left - cs, bandTop, w, bandH);
            
            ctx.filter = 'none';
          } catch (e) {
            ctx.filter = 'none';
          }
        }

        // ============================================================
        // C) FIELD LOCK LINE SWEEP — CONTINUOUS + burst enhancement
        // ============================================================
        // Always show at least one sweep line
        const sweepPhase = (t * 1.5) % 1;
        const sweepY = bandTop + (sweepPhase * bandH);
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.18 * intensity;
        ctx.fillStyle = '#33ff99';
        ctx.fillRect(chartArea.left, sweepY, w, 2);
        
        // Secondary sweep (slower)
        const sweepPhase2 = ((t * 0.7) + 0.5) % 1;
        const sweepY2 = bandTop + (sweepPhase2 * bandH);
        ctx.globalAlpha = 0.10 * intensity;
        ctx.fillStyle = '#47d4ff';
        ctx.fillRect(chartArea.left, sweepY2, w, 1);
        
        if (inBurst) {
          // Extra glitch lines during burst
          const glitchY = bandTop + (hashNoise(t * 3.0) * bandH);
          ctx.globalAlpha = 0.25 * intensity;
          ctx.fillStyle = '#ff4fd8';
          ctx.fillRect(chartArea.left, glitchY, w, 2);
          
          if (Math.random() < 0.4) {
            const glitchY2 = bandTop + (hashNoise(t * 7.0 + 100) * bandH);
            ctx.globalAlpha = 0.15 * intensity;
            ctx.fillStyle = '#ffb347';
            ctx.fillRect(chartArea.left, glitchY2, w, 1);
          }
        }

        // ============================================================
        // D) PHOSPHOR ECHO — Continuous ghosting effect
        // ============================================================
        // Always have a subtle echo (persistence simulation)
        const baseEchoShift = 1.0;
        ctx.globalAlpha = 0.04 * intensity;
        ctx.globalCompositeOperation = 'screen';
        try {
          ctx.drawImage(
            canvas,
            chartArea.left, bandTop, w, bandH,
            chartArea.left + baseEchoShift, bandTop + 0.3, w, bandH
          );
        } catch (e) { /* ignore */ }
        
        if (inBurst) {
          const echoShift = 2.5 * amt;
          ctx.globalAlpha = 0.10 * intensity;
          try {
            ctx.drawImage(
              canvas,
              chartArea.left, bandTop, w, bandH,
              chartArea.left + echoShift, bandTop + 0.8, w, bandH
            );
          } catch (e) { /* ignore */ }
        }

        ctx.restore();
      }
    };
    
    // =========================================================================
    // SHIP OVERLAY PLUGIN — Draws active ship sprite at last price point
    // =========================================================================
    
    // Cache for the ship overlay image
    let shipOverlayImage = null;
    let shipOverlayTicker = null;
    
    /**
     * Load ship image for overlay (cached)
     */
    function loadShipOverlayImage(ticker) {
      if (shipOverlayTicker === ticker && shipOverlayImage) {
        return Promise.resolve(shipOverlayImage);
      }
      
      return new Promise((resolve) => {
        // Use SHIP_SPRITES for sprite paths
        const spritePath = (window.SHIP_SPRITES && window.SHIP_SPRITES[ticker]) || window.DEFAULT_SHIP_SPRITE;
        if (!spritePath) {
          resolve(null);
          return;
        }
        
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          shipOverlayImage = img;
          shipOverlayTicker = ticker;
          resolve(img);
        };
        img.onerror = () => {
          console.warn('Failed to load ship overlay for', ticker);
          resolve(null);
        };
        img.src = spritePath;
      });
    }
    
    const shipOverlayPlugin = {
      id: 'shipOverlayPlugin',
      
      afterDatasetsDraw(chart) {
        // Only draw on the main price dataset (index 0)
        const meta = chart.getDatasetMeta(0);
        if (!meta || !meta.data || !meta.data.length) return;
        
        const lastPoint = meta.data[meta.data.length - 1];
        if (!lastPoint) return;
        
        const img = shipOverlayImage;
        if (!img) return;
        
        const ctx = chart.ctx;
        const x = lastPoint.x;
        const y = lastPoint.y;
        
        // Ship size (responsive)
        const size = 28;
        const halfSize = size / 2;
        
        // Subtle hover animation
        const t = performance.now() * 0.002;
        const hoverOffset = Math.sin(t) * 2;
        
        ctx.save();
        
        // Glow effect behind ship
        ctx.shadowColor = tickerColors[currentTicker] || '#33ff99';
        ctx.shadowBlur = 12;
        ctx.globalAlpha = 0.85;
        
        // Draw ship sprite
        ctx.drawImage(
          img,
          x - halfSize,
          y - halfSize + hoverOffset,
          size,
          size
        );
        
        ctx.restore();
      }
    };
    
    // =========================================================================
    // TICKER_PROFILES — Loaded from js/data/ticker-profiles.js
    // Access via: window.TICKER_PROFILES
    // =========================================================================
    
    // =========================================================================
    // PARALLAX_GLOSSARY, PORTFOLIO_MOODS, MACD_STATES — Loaded from js/data/glossary.js
    // Access via: window.PARALLAX_GLOSSARY, window.PORTFOLIO_MOODS, window.MACD_STATES
    // =========================================================================
    
    // Glossary helper functions
    function getGlossary(id) {
      return PARALLAX_GLOSSARY[id] || null;
    }
    
    function getTooltip(id) {
      const entry = PARALLAX_GLOSSARY[id];
      return entry ? entry.tooltip : '';
    }
    
    function getFlavor(id) {
      const entry = PARALLAX_GLOSSARY[id];
      return entry ? entry.flavor : '';
    }
    
    // Get trend state based on price, MACD data, and volatility
    function getTrendState(price, ma100, ma150, ma200, macdVal, volScore) {
      if (!price || !ma200) return PARALLAX_GLOSSARY.trend_analyzing;
      
      const aboveMa100 = price > ma100;
      const aboveMa150 = price > ma150;
      const aboveMa200 = price > ma200;
      const macdPositive = macdVal > 0;
      const nearMa100 = Math.abs(price - ma100) / price < 0.015;
      const volHigh = (volScore || 0) > 30;
      
      // FULL THRUST: Above all MAs with positive momentum and calm vol
      if (aboveMa200 && aboveMa150 && macdPositive && !volHigh) {
        return PARALLAX_GLOSSARY.trend_full_thrust;
      }
      
      // REVERSAL ATTEMPT: Above short-term but below long-term, calm vol
      if (aboveMa100 && !aboveMa200 && macdPositive && !volHigh) {
        return PARALLAX_GLOSSARY.trend_reversal_attempt;
      }
      
      // DRIFTING: Near MAs with weak momentum and tame vol
      if (nearMa100 && Math.abs(macdVal) < 0.1 && !volHigh) {
        return PARALLAX_GLOSSARY.trend_drifting;
      }
      
      // REENTRY RISK: Below long-term with negative momentum
      if (!aboveMa200 && !macdPositive && !volHigh) {
        return PARALLAX_GLOSSARY.trend_reentry_risk;
      }
      
      // NEBULOUS: High volatility OR mixed signals
      return PARALLAX_GLOSSARY.trend_nebula;
    }
    
    // Get MACD status
    function getMacdStatus(macd, signal, hist) {
      if (Math.abs(hist) < 0.05) return MACD_STATES.weak_signal;
      if (macd > signal && hist > 0) return MACD_STATES.bullish_cross;
      if (macd < signal && hist < 0) return MACD_STATES.bearish_cross;
      return MACD_STATES.weak_signal;
    }
    
    // Get portfolio mood
    function getPortfolioMood(dailyPnlPercent) {
      if (dailyPnlPercent >= 2) return PORTFOLIO_MOODS.thruster_boost;
      if (dailyPnlPercent >= 0) return PORTFOLIO_MOODS.steady_climb;
      if (dailyPnlPercent >= -1) return PORTFOLIO_MOODS.minor_turbulence;
      return PORTFOLIO_MOODS.hull_rattle;
    }
    
    // Update portfolio mood display dynamically
    function updatePortfolioMood(dailyPnlPercent) {
      const mood = getPortfolioMood(dailyPnlPercent);
      const moodEl = document.getElementById('portfolio-mood');
      if (!moodEl) return;
      
      const labelEl = moodEl.querySelector('.mood-label');
      const copyEl = moodEl.querySelector('.mood-copy');
      
      if (labelEl) labelEl.textContent = mood.label;
      if (copyEl) copyEl.textContent = mood.copy;
      
      // Update mood class
      moodEl.className = 'portfolio-mood';
      if (dailyPnlPercent >= 2) moodEl.classList.add('boost');
      else if (dailyPnlPercent >= 0) moodEl.classList.add('climb');
      else if (dailyPnlPercent >= -1) moodEl.classList.add('turbulence');
      else moodEl.classList.add('rattle');
    }
    
    // Attach glossary tooltips to all elements with data-glossary-id
    function attachGlossaryTooltips() {
      document.querySelectorAll('[data-glossary-id]').forEach(el => {
        const id = el.getAttribute('data-glossary-id');
        const entry = PARALLAX_GLOSSARY[id];
        if (!entry) return;
        
        // Build tooltip with both serious and flavor text
        const tooltip = entry.tooltip + (entry.flavor ? '\n\n"' + entry.flavor + '"' : '');
        el.setAttribute('title', tooltip);
        el.style.cursor = 'help';
      });
    }
    
    // Scenario Engine: Update smoothing band label
    function updateSmoothingBandLabel(value) {
      const el = document.getElementById('smoothing-band-label');
      if (!el) return;
      let text = 'BALANCED';
      if (value < 30) text = 'RAW FEED';
      else if (value > 70) text = 'DEEP FILTER';
      el.textContent = text;
    }
    
    // Scenario Engine: Update forecast display
    function updateForecastDisplay(days) {
      const el = document.getElementById('forecast-value');
      if (el) el.textContent = days + ' DAYS';
      logTerminal('forecast range → ' + days + ' days');
    }
    
    // Scenario Engine: Update risk profile
    function updateRiskProfile(level) {
      const fill = document.getElementById('risk-fill');
      const needle = document.getElementById('risk-needle');
      const value = document.getElementById('risk-value');
      
      const profiles = {
        conservative: { height: 30, angle: 25, label: 'CONSERVATIVE' },
        moderate: { height: 50, angle: 65, label: 'MODERATE' },
        aggressive: { height: 75, angle: 105, label: 'AGGRESSIVE' },
        maximum: { height: 95, angle: 145, label: 'MAXIMUM' }
      };
      
      const profile = profiles[level] || profiles.moderate;
      if (fill) fill.style.height = profile.height + '%';
      if (needle) needle.style.transform = 'rotate(' + profile.angle + 'deg)';
      if (value) value.textContent = profile.label;
      
      logTerminal('risk exposure → ' + profile.label.toLowerCase());
    }
    
    // Get current price series for a ticker based on timeframe
    function getCurrentSeriesForTicker(data) {
      if (!data) return [];
      return currentTimeframe === '1D' ? data.daily : data.intraday;
    }
    
    // Calculate volatility score from price data (returns 0-40 scaled value)
    function calculateVolatility(data) {
      if (!data || data.length < 10) return 0;
      const returns = [];
      for (let i = 1; i < data.length; i++) {
        const prev = data[i-1].c;
        const curr = data[i].c;
        if (!prev || !curr) continue;
        const ret = (curr - prev) / prev;
        returns.push(ret);
      }
      if (returns.length < 5) return 0;
      const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
      const stdev = Math.sqrt(variance);
      // Scale roughly into a 0-40 range for LED bar (annualized %)
      const scaled = stdev * Math.sqrt(252) * 100;
      return Math.max(0, Math.min(40, scaled));
    }
    
    // Get volatility score for a specific ticker
    function getVolScoreForTicker(ticker) {
      const data = tickerData[ticker];
      const series = getCurrentSeriesForTicker(data);
      return calculateVolatility(series);
    }
    
    // Update volatility display
    function updateVolatilityDisplay(vol) {
      const display = document.getElementById('vol-display');
      if (display) display.textContent = vol.toFixed(1);
      
      // Update LED array based on volatility
      const leds = document.querySelectorAll('.led-array .array-led');
      const numLit = Math.min(8, Math.floor(vol / 10));
      leds.forEach((led, i) => {
        led.className = 'array-led';
        if (i < numLit) {
          if (i >= 6) led.classList.add('red');
          else if (i >= 4) led.classList.add('amber');
          else led.classList.add('on');
        }
      });
    }
    
    const DEMO_STOCK_POSITIONS = [
      { ticker: 'RKLB', shares: 75, entry_price: 68.45, current_price: 72.80 },
      { ticker: 'ASTS', shares: 50, entry_price: 78.20, current_price: 83.47 },
      { ticker: 'LUNR', shares: 100, entry_price: 15.20, current_price: 17.88 },
      { ticker: 'BKSY', shares: 200, entry_price: 3.85, current_price: 4.20 },
      { ticker: 'RDW', shares: 80, entry_price: 13.60, current_price: 15.00 },
      { ticker: 'PL', shares: 150, entry_price: 3.72, current_price: 4.00 },
      { ticker: 'ACHR', shares: 100, entry_price: 7.85, current_price: 8.13 },
      { ticker: 'JOBY', shares: 60, entry_price: 13.20, current_price: 14.36 },
      { ticker: 'EVEX', shares: 250, entry_price: 3.10, current_price: 2.80 },
      { ticker: 'GME', shares: 40, entry_price: 25.80, current_price: 27.50 },
      { ticker: 'KTOS', shares: 120, entry_price: 22.50, current_price: 24.80 },
      { ticker: 'COHR', shares: 30, entry_price: 85.20, current_price: 92.40 },
      { ticker: 'RTX', shares: 25, entry_price: 118.50, current_price: 124.20 },
      { ticker: 'LHX', shares: 20, entry_price: 215.00, current_price: 228.50 },
      { ticker: 'GE', shares: 45, entry_price: 168.30, current_price: 175.60 }
    ];
    
    const DEMO_OPTIONS = [
      { ticker: 'RKLB', structure: 'Naked LEAP', strikes: '$5', entry: 1.85, current: 68.50, delta: 0.95, contracts: 3 },
      { ticker: 'ASTS', structure: 'Bull Spread', strikes: '$5/$15', entry: 2.40, current: 9.85, delta: 0.48, contracts: 4 },
      { ticker: 'LUNR', structure: 'Naked LEAP', strikes: '$5', entry: 1.20, current: 13.50, delta: 0.92, contracts: 5 },
      { ticker: 'BKSY', structure: 'Bull Spread', strikes: '$2/$5', entry: 0.95, current: 2.80, delta: 0.55, contracts: 5 },
      { ticker: 'RDW', structure: 'Bull Spread', strikes: '$4/$8', entry: 1.40, current: 3.90, delta: 0.62, contracts: 3 },
      { ticker: 'PL', structure: 'Bull Spread', strikes: '$2/$4', entry: 0.55, current: 1.85, delta: 0.58, contracts: 5 },
      { ticker: 'ACHR', structure: 'Naked LEAP', strikes: '$5', entry: 1.65, current: 4.20, delta: 0.72, contracts: 3 },
      { ticker: 'JOBY', structure: 'Bull Spread', strikes: '$5/$10', entry: 1.80, current: 5.40, delta: 0.65, contracts: 3 },
      { ticker: 'EVEX', structure: 'Bull Spread', strikes: '$3/$6', entry: 0.85, current: 0.35, delta: 0.28, contracts: 4 },
      { ticker: 'GME', structure: 'Bull Spread', strikes: '$12/$20', entry: 3.20, current: 7.80, delta: 0.72, contracts: 2 },
      { ticker: 'KTOS', structure: 'Bull Spread', strikes: '$18/$25', entry: 2.15, current: 5.40, delta: 0.68, contracts: 4 },
      { ticker: 'COHR', structure: 'Naked LEAP', strikes: '$70', entry: 8.50, current: 24.20, delta: 0.88, contracts: 2 },
      { ticker: 'RTX', structure: 'Bull Spread', strikes: '$100/$120', entry: 6.80, current: 18.50, delta: 0.75, contracts: 2 },
      { ticker: 'LHX', structure: 'Naked LEAP', strikes: '$180', entry: 12.40, current: 42.80, delta: 0.82, contracts: 1 },
      { ticker: 'GE', structure: 'Bull Spread', strikes: '$150/$180', entry: 8.20, current: 22.40, delta: 0.78, contracts: 2 }
    ];
    
    const DEMO_CATALYSTS = [
      { date: '2026-01-16', ticker: 'ALL', event: 'January Options Expiration', impact: 'HIGH' },
      { date: '2026-01-21', ticker: 'RKLB', event: 'Q4 Earnings Report', impact: 'HIGH' },
      { date: '2026-01-28', ticker: 'ASTS', event: 'Q4 Earnings Report', impact: 'HIGH' },
      { date: '2026-02-10', ticker: 'LUNR', event: 'Q4 Earnings Report', impact: 'MEDIUM' },
      { date: '2026-02-15', ticker: 'LUNR', event: 'IM-2 Lunar Landing Mission', impact: 'HIGH' },
      { date: '2026-Q1', ticker: 'ACHR', event: 'FAA Type Certification Expected', impact: 'HIGH' },
      { date: '2026-Q1', ticker: 'JOBY', event: 'FAA Type Certification Expected', impact: 'HIGH' },
      { date: '2026-Q2', ticker: 'ASTS', event: 'BlueBird Commercial Service Launch', impact: 'HIGH' },
      { date: '2026-Q2', ticker: 'RKLB', event: 'Neutron Rocket First Flight', impact: 'HIGH' }
    ];
    
    const DEMO_ACTIVITY = [
      { type: 'trade', title: 'BUY LUNR', subtitle: '100 shares @ $15.20', time: '09:45' },
      { type: 'alert', title: 'MACD Crossover', subtitle: 'LUNR bullish signal', time: '09:44' },
      { type: 'trade', title: 'BUY ASTS', subtitle: '50 shares @ $78.20', time: 'PREV' },
      { type: 'trade', title: 'BUY RKLB', subtitle: '75 shares @ $68.45', time: 'PREV' },
      { type: 'alert', title: 'MACD Crossover', subtitle: 'ASTS bullish signal', time: 'JAN02' }
    ];
    
    // Arcade-style SVG icons
    const invaderSvg = '<svg viewBox="0 0 11 8" fill="currentColor"><rect x="2" y="0" width="1" height="1"/><rect x="8" y="0" width="1" height="1"/><rect x="3" y="1" width="1" height="1"/><rect x="7" y="1" width="1" height="1"/><rect x="2" y="2" width="7" height="1"/><rect x="1" y="3" width="2" height="1"/><rect x="4" y="3" width="3" height="1"/><rect x="8" y="3" width="2" height="1"/><rect x="0" y="4" width="11" height="1"/><rect x="0" y="5" width="1" height="1"/><rect x="2" y="5" width="7" height="1"/><rect x="10" y="5" width="1" height="1"/></svg>';
    const scenarioSvg = '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="7" r="5"/><path d="M7 4v3l2 2"/></svg>';
    const bonusSvg = '<svg viewBox="0 0 14 14" fill="currentColor"><path d="M7 1l1.5 4.5H13l-3.5 3 1.5 4.5L7 10l-4 3 1.5-4.5L1 5.5h4.5z"/></svg>';
    
    // Mission log helper for scenario engine
    function pushMissionLog(entry) {
      const feed = document.getElementById('activity-feed');
      if (!feed) return;
      
      const icons = { trade: tradeSvg, alert: alertSvg, invader: invaderSvg, scenario: scenarioSvg, bonus: bonusSvg };
      const time = entry.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      const item = document.createElement('div');
      item.className = 'activity-item';
      item.innerHTML = 
        '<div class="activity-icon ' + (entry.type || 'alert') + '">' + (icons[entry.type] || alertSvg) + '</div>' +
        '<div class="activity-content"><div class="activity-title' + (entry.arcade ? ' arcade' : '') + '">' + entry.title + '</div>' +
        '<div class="activity-subtitle">' + entry.subtitle + '</div></div>' +
        '<div class="activity-time">' + time + '</div>';
      
      feed.insertBefore(item, feed.firstChild);
      
      // Keep max 25 entries
      while (feed.children.length > 25) {
        feed.removeChild(feed.lastChild);
      }
    }
    
    // =========================================================================
    // FLEET HOLOBAY SYSTEM (Pro Ship Library with Universe Lore)
    // SHIP_LORE data object — Loaded from js/data/ship-data.js
    // =========================================================================
    
    // Map tickers/sectors to SVG symbols - returns {symbol, label, isHero, lore}
    function mapTickerToShip(ticker, sector) {
      ticker = (ticker || "").toUpperCase();
      sector = sector || "";

      // HERO mappings - special detailed ships
      if (ticker === "RKLB") return { symbol: "#ship-archon", label: "ORBITAL ARCHON", isHero: true };
      if (ticker === "GME")  return { symbol: "#ship-tyrant", label: "IRON TYRANT", isHero: true };
      if (ticker === "TSLA") return { symbol: "#ship-flagship", label: "FLAGSHIP SPEAR", isHero: true };
      if (ticker === "NVDA") return { symbol: "#ship-dreadnought", label: "DREADNOUGHT MECH", isHero: true };

      // Standard fleet mappings
      if (ticker === "LUNR") return { symbol: "#ship-lander", label: "LUNAR LANDER", isHero: false };
      if (/JOBY|ACHR|EVEX/.test(ticker)) return { symbol: "#ship-evtol", label: "EVTOL CARRIER", isHero: false };
      if (/ASTS/.test(ticker)) return { symbol: "#ship-phantom", label: "PHANTOM NODE", isHero: false };
      if (/IRDM/.test(ticker)) return { symbol: "#ship-relay", label: "COMM RELAY", isHero: false };
      if (/BKSY|PL/.test(ticker)) return { symbol: "#ship-drone", label: "FIREFLY DRONE", isHero: false };
      if (/KTOS|RDW/.test(ticker)) return { symbol: "#ship-patrol", label: "PATROL CORVETTE", isHero: false };
      if (/ATI/.test(ticker)) return { symbol: "#ship-hauler", label: "ATLAS HAULER", isHero: false };
      if (/CACI|HON/.test(ticker)) return { symbol: "#ship-gardener", label: "GARDENER FRAME", isHero: false };
      if (/MP|LOAR/.test(ticker)) return { symbol: "#ship-cargo", label: "CARGO HAULER", isHero: false };

      // Sector-based fallbacks
      if (/EVTOL|VTOL|air mobility/i.test(sector)) return { symbol: "#ship-evtol", label: "EVTOL CARRIER", isHero: false };
      if (/meme|retail|chaotic/i.test(sector)) return { symbol: "#ship-meme", label: "ANOMALOUS PROBE", isHero: false };
      if (/defense|military/i.test(sector)) return { symbol: "#ship-patrol", label: "PATROL CORVETTE", isHero: false };
      if (/industrial|materials|cargo|aerospace|components/i.test(sector)) return { symbol: "#ship-hauler", label: "ATLAS HAULER", isHero: false };
      if (/earth|geo|observation/i.test(sector)) return { symbol: "#ship-drone", label: "FIREFLY DRONE", isHero: false };
      if (/cellular|comms|relay|satellite/i.test(sector)) return { symbol: "#ship-relay", label: "COMM RELAY", isHero: false };
      if (/lunar/i.test(sector)) return { symbol: "#ship-lander", label: "LUNAR LANDER", isHero: false };
      if (/stealth|black|secret/i.test(sector)) return { symbol: "#ship-shadow", label: "NIGHT SHADOW", isHero: false };
      if (/experimental|biotech|pharma/i.test(sector)) return { symbol: "#ship-phantom", label: "PHANTOM NODE", isHero: false };

      // Default
      return { symbol: "#ship-frigate", label: "ORBITAL FRIGATE", isHero: false };
    }
    
    // Get ship lore for display
    function getShipLore(symbol) {
      return SHIP_LORE[symbol] || { hud: "SYSTEMS NOMINAL", lore: "Standard issue vessel." };
    }
    
    // =========================================================================
    // PIXEL SHIP RENDERING SYSTEM (8-bit Space Invaders style)
    // PIXEL_SHIPS data object — Loaded from js/data/ship-data.js
    // =========================================================================
    
    /**
     * Draw a PIXEL_SHIPS pattern on a canvas context.
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {string} patternKey - Key from PIXEL_SHIPS
     * @param {number} x - Center X position
     * @param {number} y - Center Y position  
     * @param {number} scale - Pixel scale (1 = 1px per cell)
     * @param {string} baseColor - Base color in hex (e.g., '#33ff99')
     * @param {object} opts - Options: { glow: boolean, glowBlur: number }
     */
    function drawPixelShipOnCanvas(ctx, patternKey, x, y, scale, baseColor, opts = {}) {
      const pattern = PIXEL_SHIPS[patternKey] || PIXEL_SHIPS.drone;
      const rows = pattern.length;
      const cols = pattern[0].length;
      
      // Calculate pixel dimensions
      const cellSize = scale;
      const totalWidth = cols * cellSize;
      const totalHeight = rows * cellSize;
      
      // Calculate top-left corner (centered on x,y)
      const startX = x - totalWidth / 2;
      const startY = y - totalHeight / 2;
      
      // Parse base color to HSL for shading
      const hex = baseColor.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16) / 255;
      const g = parseInt(hex.substr(2, 2), 16) / 255;
      const b = parseInt(hex.substr(4, 2), 16) / 255;
      
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h = 0, s = 0, l = (max + min) / 2;
      
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: h = ((b - r) / d + 2) / 6; break;
          case b: h = ((r - g) / d + 4) / 6; break;
        }
      }
      const baseHue = Math.round(h * 360);
      const baseSat = Math.round(s * 100);
      
      // Apply glow if requested
      if (opts.glow) {
        ctx.shadowColor = baseColor;
        ctx.shadowBlur = opts.glowBlur || 6;
      }
      
      // Draw each pixel
      for (let row = 0; row < rows; row++) {
        const rowData = pattern[row];
        for (let col = 0; col < cols; col++) {
          const digit = rowData[col];
          if (digit === '0') continue;
          
          let fill;
          if (digit === '1') {
            fill = `hsl(${baseHue}, ${Math.max(20, baseSat - 20)}%, 20%)`; // Dark edge
          } else if (digit === '2') {
            fill = `hsl(${baseHue}, ${baseSat}%, 40%)`; // Mid tone
          } else {
            fill = `hsl(${baseHue}, ${Math.min(100, baseSat + 20)}%, 60%)`; // Cockpit highlight
          }
          
          ctx.fillStyle = fill;
          ctx.fillRect(
            startX + col * cellSize,
            startY + row * cellSize,
            cellSize,
            cellSize
          );
        }
      }
      
      // Reset shadow
      if (opts.glow) {
        ctx.shadowBlur = 0;
      }
    }
    
    // PIXEL_SHIP_LORE — Loaded from js/data/ship-data.js
    
    /**
     * Render HD mech sprite into an SVG.
     * patternKey in PIXEL_SHIPS.
     * opts: { hero: bool, pnlPercent: number }
     */
    function renderPixelShip(svgEl, patternKey, opts = {}) {
      if (!svgEl) return;

      const pattern = PIXEL_SHIPS[patternKey] || PIXEL_SHIPS.flagship;
      const hero    = !!opts.hero;
      const pnl     = (typeof opts.pnlPercent === "number") ? opts.pnlPercent : null;

      // wipe previous content
      while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);

      const rows = pattern.length;
      const cols = pattern[0].length;

      const cell  = 2.9; // smaller cells = more "resolution"
      const width = cols * cell;
      const height = rows * cell;

      const viewW = 120;
      const viewH = 80;
      const offsetX = (viewW - width) / 2;
      const offsetY = (viewH - height) / 2;

      const ns = "http://www.w3.org/2000/svg";
      const g = document.createElementNS(ns, "g");
      svgEl.appendChild(g);

      for (let r = 0; r < rows; r++) {
        const row = pattern[r];
        for (let c = 0; c < cols; c++) {
          const ch = row[c];
          if (ch === "0") continue;

          const x = offsetX + c * cell;
          const y = offsetY + r * cell;

          const rect = document.createElementNS(ns, "rect");
          rect.setAttribute("x", x);
          rect.setAttribute("y", y);
          rect.setAttribute("width", cell);
          rect.setAttribute("height", cell);
          rect.setAttribute("rx", 0.6);
          rect.setAttribute("ry", 0.6);

          let cls;
          if (ch === "1") cls = "pixel-ship-outer";
          else if (ch === "2") cls = "pixel-ship-inner";
          else if (ch === "3") cls = "pixel-ship-highlight";
          else continue;

          rect.setAttribute("class", cls);
          g.appendChild(rect);
        }
      }

      // Add pixel-mode class for animations
      svgEl.classList.add("pixel-mode", "pixel-ship-glow");

      // hero / damage states on the container
      if (hero) svgEl.classList.add("hero-ship");
      else      svgEl.classList.remove("hero-ship");
      
      // Damage overlay on big losers / winning state
      svgEl.classList.remove("ship-damaged", "pixel-ship-winning", "pixel-ship-losing");
      if (pnl !== null) {
        if (pnl < -5) {
          svgEl.classList.add("ship-damaged", "pixel-ship-losing");
        } else if (pnl >= 5) {
          svgEl.classList.add("pixel-ship-winning");
        }
      }
    }
    
    // Maps ticker/sector into { pattern, hero, label }
    function mapTickerToPixelShip(ticker, sector, pnlPercent) {
      ticker = (ticker || "").toUpperCase();
      sector = sector || "";

      // Heroes
      if (ticker === "RKLB") return { pattern: "flagship", hero: true };
      if (ticker === "GME")  return { pattern: "dreadnought", hero: true };
      if (ticker === "TSLA") return { pattern: "flagship", hero: true };
      if (ticker === "NVDA") return { pattern: "dreadnought", hero: true };

      // Specific tickers
      if (ticker === "LUNR") return { pattern: "lander", hero: false };
      if (/JOBY|ACHR|EVEX/.test(ticker)) return { pattern: "carrier", hero: false };
      if (/ASTS/.test(ticker)) return { pattern: "probe", hero: false };
      if (/IRDM/.test(ticker)) return { pattern: "station", hero: false };
      if (/BKSY|PL/.test(ticker)) return { pattern: "drone", hero: false };
      if (/KTOS|RDW/.test(ticker)) return { pattern: "cruiser", hero: false };
      if (/ATI|MP|LOAR/.test(ticker)) return { pattern: "hauler", hero: false };
      if (/CACI|HON/.test(ticker)) return { pattern: "cruiser", hero: false };

      // By sector
      if (/VTOL|EVTOL|AVIATION/i.test(sector))
        return { pattern: "carrier", hero: false };

      if (/SPACE|LAUNCH|SAT|ORBITAL/i.test(sector))
        return { pattern: "flagship", hero: false };

      if (/INDUSTRIAL|MATERIALS|CARGO/i.test(sector))
        return { pattern: "hauler", hero: false };

      if (/DEFENSE|MILITARY/i.test(sector))
        return { pattern: "cruiser", hero: false };

      if (/COMMS|RELAY|CELLULAR/i.test(sector))
        return { pattern: "station", hero: false };

      if (/MEME|RETAIL|CHAOTIC/i.test(sector))
        return { pattern: "probe", hero: false };

      if (/LUNAR|SURFACE/i.test(sector))
        return { pattern: "lander", hero: false };

      if (/SURVEILLANCE|RECON|EARTH/i.test(sector))
        return { pattern: "drone", hero: false };

      // Default
      return { pattern: "lander", hero: false };
    }
    
    // Get pixel ship lore
    function getPixelShipLore(patternKey) {
      return PIXEL_SHIP_LORE[patternKey] || PIXEL_SHIP_LORE.lander;
    }
    
    // Apply ship to an SVG element with use element
    function applyShipToSvg(svgEl, useEl, mapping, pnlNum) {
      if (!svgEl || !useEl) return;
      
      useEl.setAttribute("href", mapping.symbol);
      useEl.setAttribute("xlink:href", mapping.symbol); // Legacy browser support

      // Toggle hero-ship class
      if (mapping.isHero) {
        svgEl.classList.add("hero-ship");
      } else {
        svgEl.classList.remove("hero-ship");
      }
      
      // Toggle winning/losing state for engine pulse animation
      svgEl.classList.remove("ship-winning", "ship-losing");
      if (pnlNum !== undefined) {
        if (pnlNum >= 0) {
          svgEl.classList.add("ship-winning");
        } else {
          svgEl.classList.add("ship-losing");
        }
      }
    }
    
    // Update sidebar ship profile - now using pixel ships!
    function updateSidebarShip(ticker, sector, pnlNum) {
      const svgEl = document.querySelector(".ship-profile .ship-svg");
      const caption = document.getElementById("ship-caption");
      const statusEl = document.getElementById("ship-status");
      const signalEl = document.getElementById("ship-signal");
      
      if (!svgEl) return;

      // Use pixel ship rendering
      const meta = mapTickerToPixelShip(ticker, sector, pnlNum);
      const lore = getPixelShipLore(meta.pattern);
      
      renderPixelShip(svgEl, meta.pattern, { 
        hero: meta.hero, 
        pnlPercent: pnlNum 
      });
      
      if (caption) {
        const heroMark = meta.hero ? ' ' + PixelIcons.toSvg('star', '#ffaa33', 10) : '';
        caption.innerHTML = `${ticker.toUpperCase()} · ${lore.label}${heroMark}`;
      }
      
      // Update status based on P&L
      if (statusEl && signalEl) {
        if (pnlNum >= 5) {
          statusEl.textContent = "OPTIMAL";
          statusEl.className = "vital-value positive";
          signalEl.textContent = "STRONG";
          signalEl.className = "vital-value positive";
        } else if (pnlNum >= 0) {
          statusEl.textContent = "NOMINAL";
          statusEl.className = "vital-value";
          signalEl.textContent = "STABLE";
          signalEl.className = "vital-value positive";
        } else if (pnlNum >= -5) {
          statusEl.textContent = "STRESSED";
          statusEl.className = "vital-value";
          signalEl.textContent = "WEAK";
          signalEl.className = "vital-value";
        } else {
          statusEl.textContent = "CRITICAL";
          statusEl.className = "vital-value negative";
          signalEl.textContent = "FADING";
          signalEl.className = "vital-value negative";
        }
      }
    }
    
    // Telemetry HUD ship – uses actual ship sprite (Step 6A)
    function updateTelemetryShipSprite(ticker) {
      const svgEl      = document.getElementById("telemetry-ship-svg");
      const spriteEl   = document.getElementById("primary-viewport-sprite");
      const labelEl    = document.getElementById("telemetry-ship-label");
      const captionEl  = document.getElementById("telemetry-ship-caption");
      const headerName = document.getElementById("telemetry-ship-name"); // existing title text

      if (!svgEl && !spriteEl) return;

      const upper = (ticker || "").toUpperCase();

      // Pull sector + returns from existing data sources
      const profile = (window.TICKER_PROFILES && TICKER_PROFILES[upper]) || {};
      const sector  = profile.sector || profile.theme || "Unknown";

      const stats = (window.statsData && statsData[upper]) || {};
      // Prefer "total" return; fall back to 1Y / 3M if needed
      const pnl =
        (typeof stats.return_total === "number" ? stats.return_total :
        typeof stats.return_1y    === "number" ? stats.return_1y    :
        typeof stats.return_3m    === "number" ? stats.return_3m    :
        0);

      // Step 6A: Use actual ship sprite from SHIP_SPRITES
      const spriteSrc = SHIP_SPRITES[upper] || DEFAULT_SHIP_SPRITE;
      if (spriteEl) {
        spriteEl.src = spriteSrc;
        spriteEl.alt = `${upper} vessel`;
      }
      
      // Fallback: render pixel ship to SVG if sprite fails
      const meta = mapTickerToPixelShip(upper, sector, pnl);
      if (svgEl) {
        renderPixelShip(svgEl, meta.pattern, {
          hero: meta.hero,
          pnlPercent: pnl
        });
      }

      const lore = getPixelShipLore(meta.pattern);
      const shipName = `${upper} · ${lore.label}`;

      if (labelEl)   labelEl.textContent   = shipName;
      if (captionEl) captionEl.textContent = lore.lore;
      if (headerName) headerName.textContent = shipName; // keeps header in sync
    }
    
    function initFleetHolobay() {
      const strip = document.getElementById("fleet-holo-strip");
      const svg = document.getElementById("fleet-ship-svg");
      const nameEl = document.getElementById("fleet-ship-name");
      const classEl = document.getElementById("fleet-ship-class");
      const sectorEl = document.getElementById("fleet-ship-sector");
      const hullBar = document.getElementById("fleet-hull-bar");
      const hullText = document.getElementById("fleet-hull-text");
      const cargoBar = document.getElementById("fleet-cargo-bar");
      const cargoText = document.getElementById("fleet-cargo-text");
      const velBar = document.getElementById("fleet-vel-bar");
      const velText = document.getElementById("fleet-vel-text");

      if (!strip || !svg) return;
      
      // No more <use> element needed - we render pixels directly!
      
      function pnlToHealth(pnl) {
        const raw = Math.max(-50, Math.min(150, pnl));
        return Math.round(((raw + 50) / 200) * 100);
      }

      function healthLabel(h) {
        if (h >= 85) return "OPTIMAL";
        if (h >= 65) return "NOMINAL";
        if (h >= 45) return "STRESSED";
        return "CRITICAL";
      }
      
      // Render ship using pixel ship system
      function renderFleetShipPixel(ticker, sector, pnlNum) {
        const meta = mapTickerToPixelShip(ticker, sector, pnlNum);
        renderPixelShip(svg, meta.pattern, { 
          hero: meta.hero, 
          pnlPercent: pnlNum 
        });
        return meta;
      }

      const fleet = [];

      // Build fleet from DEMO_STOCK_POSITIONS with TICKER_PROFILES data
      if (typeof DEMO_STOCK_POSITIONS !== 'undefined') {
        DEMO_STOCK_POSITIONS.forEach(pos => {
          const profile = TICKER_PROFILES[pos.ticker] || {};
          const value = pos.shares * pos.current_price;
          const pnlNum = ((pos.current_price - pos.entry_price) / pos.entry_price) * 100;
          const pnlText = (pnlNum >= 0 ? '+' : '') + pnlNum.toFixed(1) + '%';
          const sector = profile.sector || 'Unknown';
          const meta = mapTickerToPixelShip(pos.ticker, sector, pnlNum);
          const lore = getPixelShipLore(meta.pattern);

          fleet.push({
            ticker: pos.ticker,
            sector: sector,
            value: value,
            pnlText: pnlText,
            pnlNum: pnlNum,
            shipClass: lore.label,
            codename: profile.codename || pos.ticker,
            isHero: meta.hero,
            pattern: meta.pattern
          });
        });
      }

      if (!fleet.length) return;

      // Create thumbnails
      fleet.forEach(ship => {
        const thumb = document.createElement("div");
        thumb.className = "fleet-thumb " + (ship.pnlNum >= 0 ? "gain" : "loss");
        if (ship.isHero) thumb.classList.add("hero");
        thumb.dataset.ticker = ship.ticker;

        thumb.innerHTML = `
          <div class="ticker">${ship.ticker}</div>
          <div class="tag">${ship.shipClass}</div>
          <div class="pnl">${ship.pnlText}</div>
        `;

        thumb.addEventListener("click", () => {
          selectShip(ship.ticker);
        });

        strip.appendChild(thumb);
      });

      function selectShip(ticker) {
        const ship = fleet.find(s => s.ticker === ticker);
        if (!ship) return;

        // Render pixel ship in holobay
        renderFleetShipPixel(ship.ticker, ship.sector, ship.pnlNum);
        
        // Update sidebar ship profile too
        updateSidebarShip(ship.ticker, ship.sector, ship.pnlNum);
        
        // Get lore for display
        const lore = getPixelShipLore(ship.pattern);

        nameEl.textContent = `${ship.ticker} · ${ship.codename}`;
        classEl.innerHTML = ship.shipClass + (ship.isHero ? ' ' + PixelIcons.toSvg('star', '#ffaa33', 10) : '');
        sectorEl.textContent = lore.hud; // Show HUD tag instead of sector

        const health = pnlToHealth(ship.pnlNum);
        hullBar.style.width = `${Math.max(5, health)}%`;
        hullText.textContent = healthLabel(health);

        const cargoRatio = ship.value / fleet.reduce((s,x)=>s+x.value,0);
        const cargoPct = Math.round(cargoRatio * 100);
        cargoBar.style.width = `${Math.max(5, cargoPct)}%`;
        cargoText.textContent = `${cargoPct}% of fleet cargo`;

        const vel = Math.min(100, Math.abs(ship.pnlNum) * 2.5);
        velBar.style.width = `${Math.max(5, vel)}%`;
        velText.textContent = `${vel.toFixed(0)} · risk velocity`;

        if (health < 45) {
          hullBar.classList.add("fleet-danger");
        } else {
          hullBar.classList.remove("fleet-danger");
        }

        strip.querySelectorAll(".fleet-thumb").forEach(t => {
          t.classList.toggle("active", t.dataset.ticker === ticker);
        });

        // Also trigger main chart update if the function exists
        if (typeof loadTicker === 'function') {
          loadTicker(ticker);
        }
      }

      // Initial selection = biggest position
      const primary = fleet.slice().sort((a,b)=>b.value-a.value)[0];
      if (primary) selectShip(primary.ticker);
    }
    
    async function init() {
      updateTime();
      setInterval(updateTime, 1000);
      try {
        const res = await fetch('data/stats.json');
        const data = await res.json();
        statsData = data.stats;
        buildWatchlist(data.tickers);
      } catch (e) {
        buildWatchlist(['RKLB', 'LUNR', 'ASTS', 'ACHR', 'JOBY', 'BKSY', 'RDW', 'PL', 'EVEX', 'GME']);
      }
      await loadTicker(currentTicker);
      renderStockPositions();
      renderOptionsPositions();
      renderCatalysts();
      renderActivity();
      renderPositionCharts();
      
      // Initialize Fleet HoloBay
      initFleetHolobay();
      
      // Initialize Fleet Command panel (new UI)
      if (window.FleetCommand) {
        FleetCommand.init('fleet-command-container');
      }
      
      // Initialize glossary tooltips
      attachGlossaryTooltips();
      
      // Calculate and update portfolio mood based on demo data
      const totalDailyPnl = DEMO_STOCK_POSITIONS.reduce((sum, pos) => {
        const dailyChange = (pos.current_price - pos.entry_price) / pos.entry_price * 100;
        return sum + dailyChange;
      }, 0) / DEMO_STOCK_POSITIONS.length;
      updatePortfolioMood(totalDailyPnl);
      
      // Initialize volatility display using data-driven score
      const vol = getVolScoreForTicker(currentTicker);
      if (vol > 0) {
        updateVolatilityDisplay(vol);
      }
      
      // Mission log startup message
      setTimeout(() => {
        pushMissionLog({ 
          type: 'scenario', 
          title: 'UPLINK ESTABLISHED', 
          subtitle: 'Mission Control systems online · defensive grid active',
          arcade: true
        });
      }, 500);
    }
    
    function updateTime() {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      document.getElementById('time-display').innerHTML = h + '<span class="blink">:</span>' + m;
    }
    
    function buildWatchlist(tickers) {
      const watchlistHTML = tickers.map(t => {
        const stats = statsData[t] || {};
        const change = stats.return_1d || 0;
        const theme = tickerThemes[t] || '';
        const color = tickerColors[t] || '#33ff99';
        return '<div class="watchlist-item ' + (t === currentTicker ? 'active' : '') + '" data-ticker="' + t + '" onclick="selectTicker(\'' + t + '\'); if(window.innerWidth <= 768) toggleMobileDrawer();">' +
          '<div class="watchlist-info"><div class="watchlist-ticker" style="color: ' + color + '">' + t + '</div>' +
          '<div class="watchlist-meta">' + theme + '</div></div>' +
          '<div class="watchlist-data"><div class="watchlist-price">$' + (stats.current || 0).toFixed(2) + '</div>' +
          '<div class="watchlist-change ' + (change >= 0 ? 'positive' : 'negative') + '">' + (change >= 0 ? '+' : '') + change.toFixed(2) + '%</div></div></div>';
      }).join('');
      
      // Update watchlist if it exists (may be replaced by Fleet Command)
      const watchlistEl = document.getElementById('watchlist');
      if (watchlistEl) {
        watchlistEl.innerHTML = watchlistHTML;
      }
      
      // Also populate mobile watchlist
      const mobileWatchlist = document.getElementById('mobile-watchlist');
      if (mobileWatchlist) {
        mobileWatchlist.innerHTML = watchlistHTML;
      }
      
      // Also populate mobile ticker carousel
      populateMobileTickerCarousel();
    }
    
    // Mobile drawer toggle
    let scrollPosition = 0;
    function toggleMobileDrawer() {
      const drawer = document.getElementById('mobile-drawer');
      const backdrop = document.getElementById('mobile-drawer-backdrop');
      const menuBtn = document.getElementById('mobile-menu-btn');
      
      if (drawer && backdrop) {
        const isOpening = !drawer.classList.contains('open');
        drawer.classList.toggle('open');
        backdrop.classList.toggle('open');
        
        // Update ARIA expanded state
        if (menuBtn) {
          menuBtn.setAttribute('aria-expanded', isOpening ? 'true' : 'false');
        }
        
        if (isOpening) {
          // Save scroll position and lock body
          scrollPosition = window.pageYOffset;
          document.body.classList.add('modal-open');
          document.body.style.top = `-${scrollPosition}px`;
        } else {
          // Restore scroll position
          document.body.classList.remove('modal-open');
          document.body.style.top = '';
          window.scrollTo(0, scrollPosition);
        }
      }
    }
    
    async function loadTicker(ticker) {
      if (!tickerData[ticker]) {
        try { tickerData[ticker] = await (await fetch('data/' + ticker.toLowerCase() + '.json')).json(); } catch (e) { return; }
      }
      currentTicker = ticker;
      updateTickerDisplay();
      updateCharts();
      updateMACDDisplay();
      
      // Call new status functions
      const data = tickerData[ticker];
      if (data) {
        updateTrendStatus(data);
        updateVolumeStatus(data);
        resetSimulation();
        
        // Update volatility display for new ticker
        const vol = getVolScoreForTicker(ticker);
        if (vol > 0) {
          updateVolatilityDisplay(vol);
        }
      }
      
      // Update sidebar ship profile
      const profile = TICKER_PROFILES[ticker] || {};
      const sector = profile.sector || 'Unknown';
      const pos = DEMO_STOCK_POSITIONS.find(p => p.ticker === ticker);
      const pnlNum = pos ? ((pos.current_price - pos.entry_price) / pos.entry_price) * 100 : 0;
      if (typeof updateSidebarShip === 'function') {
        updateSidebarShip(ticker, sector, pnlNum);
      }
      
      // Update telemetry HUD ship sprite
      if (typeof updateTelemetryShipSprite === 'function') {
        updateTelemetryShipSprite(ticker);
      }
      
      // Load ship image for chart overlay
      loadShipOverlayImage(ticker).then(() => {
        // Redraw chart to show ship overlay
        if (priceChart) {
          priceChart.update('none');
        }
      });
      
      document.querySelectorAll('.watchlist-item').forEach(el => {
        const tickerEl = el.querySelector('.watchlist-ticker');
        el.classList.toggle('active', tickerEl && tickerEl.textContent === ticker);
      });
    }
    
    function selectTicker(ticker) { loadTicker(ticker); }
    
    // P&L Simulation
    function resetSimulation() {
      const resultEl = document.getElementById('sim-result');
      resultEl.className = 'sim-result';
      resultEl.innerHTML = '<div class="sim-result-label">Select parameters above</div>';
    }
    
    function runPnLSimulation() {
      const data = tickerData[currentTicker];
      if (!data || !data.daily || !data.daily.length) {
        showSimError('No historical data available');
        return;
      }
      
      const dateInput = document.getElementById('sim-entry-date').value;
      const capital = parseFloat(document.getElementById('sim-capital').value) || 0;
      
      if (!dateInput) {
        showSimError('Please select an entry date');
        return;
      }
      
      if (capital < 100) {
        showSimError('Minimum capital: $100');
        return;
      }
      
      const daily = data.daily;
      const entryTs = new Date(dateInput).getTime();
      const dataStartTs = daily[0].t;
      const dataEndTs = daily[daily.length - 1].t;
      
      if (entryTs < dataStartTs) {
        showSimError('Date before available data range');
        return;
      }
      
      // Find entry candle (first candle on or after entry date)
      const entryCandle = daily.find(p => p.t >= entryTs);
      if (!entryCandle) {
        showSimError('No data for selected date');
        return;
      }
      
      const lastCandle = daily[daily.length - 1];
      const entryPrice = entryCandle.c;
      const lastPrice = lastCandle.c;
      
      const shares = Math.floor(capital / entryPrice);
      const actualInvested = shares * entryPrice;
      const currentValue = shares * lastPrice;
      const pnl = currentValue - actualInvested;
      const returnPct = ((lastPrice - entryPrice) / entryPrice) * 100;
      
      const entryDate = new Date(entryCandle.t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const holdDays = Math.floor((lastCandle.t - entryCandle.t) / 86400000);
      
      const resultEl = document.getElementById('sim-result');
      const isPositive = pnl >= 0;
      
      resultEl.className = 'sim-result ' + (isPositive ? 'positive' : 'negative');
      resultEl.innerHTML = 
        '<div class="sim-result-label">Simulated P&L</div>' +
        '<div class="sim-result-value ' + (isPositive ? 'positive' : 'negative') + '">' +
          (isPositive ? '+' : '−') + '$' + Math.abs(pnl).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0}) +
        '</div>' +
        '<div class="sim-result-pct">' + (isPositive ? '+' : '') + returnPct.toFixed(1) + '% return</div>' +
        '<div class="sim-result-meta">' +
          shares + ' shares @ $' + entryPrice.toFixed(2) + ' → $' + lastPrice.toFixed(2) + '<br>' +
          'Entry: ' + entryDate + ' • ' + holdDays + ' days held' +
        '</div>';
    }
    
    function showSimError(msg) {
      const resultEl = document.getElementById('sim-result');
      resultEl.className = 'sim-result';
      resultEl.innerHTML = '<div class="sim-result-label" style="color: var(--signal-down);">' + msg + '</div>';
    }
    
    function updateTickerDisplay() {
      const stats = statsData[currentTicker] || {};
      const change = stats.return_1d || 0;
      const color = tickerColors[currentTicker] || '#33ff99';
      const tickerEl = document.getElementById('chart-ticker');
      tickerEl.textContent = currentTicker;
      tickerEl.style.color = color;
      tickerEl.style.textShadow = '0 0 20px ' + color + '40';
      document.getElementById('chart-price').textContent = '$' + (stats.current || 0).toFixed(2);
      const el = document.getElementById('chart-change');
      el.textContent = (change >= 0 ? '+' : '') + change.toFixed(2) + '%';
      el.className = 'ticker-change ' + (change >= 0 ? 'positive' : 'negative');
    }
    
    function updateMACDDisplay() {
      const data = tickerData[currentTicker];
      if (!data) return;
      const source = currentTimeframe === '1D' ? data.daily : data.intraday;
      if (!source || !source.length) return;
      const latest = source[source.length - 1];
      
      const macdVal = latest.macd || 0;
      const signalVal = latest.signal || 0;
      const histVal = latest.hist || 0;
      
      if (latest.macd !== undefined) {
        const el = document.getElementById('macd-val');
        el.textContent = latest.macd.toFixed(4);
        el.className = 'macd-value ' + (latest.macd >= 0 ? 'positive' : 'negative');
      }
      if (latest.signal !== undefined) document.getElementById('signal-val').textContent = latest.signal.toFixed(4);
      if (latest.hist !== undefined) {
        const el = document.getElementById('hist-val');
        el.textContent = latest.hist.toFixed(4);
        el.className = 'macd-value ' + (latest.hist >= 0 ? 'positive' : 'negative');
      }
      
      // Update MACD status using glossary
      const macdStatus = getMacdStatus(macdVal, signalVal, histVal);
      const statusEl = document.getElementById('macd-status');
      if (statusEl) {
        const labelEl = statusEl.querySelector('.macd-status-label');
        const copyEl = statusEl.querySelector('.macd-status-copy');
        if (labelEl) labelEl.textContent = macdStatus.label;
        if (copyEl) copyEl.textContent = macdStatus.copy;
        
        // Color based on state
        statusEl.className = 'macd-status';
        if (macdStatus === MACD_STATES.bullish_cross) statusEl.classList.add('bullish');
        else if (macdStatus === MACD_STATES.bearish_cross) statusEl.classList.add('bearish');
      }
    }
    
    function updateTrendStatus(data) {
      const source = currentTimeframe === '1D' ? data.daily : data.intraday;
      if (!source || !source.length) return;
      
      // Find the last candle with MA data
      let last = null;
      for (let i = source.length - 1; i >= 0; i--) {
        if (source[i].g100 !== undefined || source[i].g200 !== undefined) {
          last = source[i];
          break;
        }
      }
      
      if (!last) {
        document.getElementById('trend-status-label').textContent = 'NO MA DATA';
        document.getElementById('trend-status-detail').textContent = 'Moving average data unavailable for this range.';
        document.getElementById('trend-status-badge').className = 'trend-status-badge';
        return;
      }
      
      const price = last.c;
      const g100 = last.g100;
      const g150 = last.g150;
      const g200 = last.g200;
      const macdVal = last.macd || 0;
      
      // Compute volatility score for current ticker
      const volScore = getVolScoreForTicker(currentTicker);
      
      const badgeEl = document.getElementById('trend-status-badge');
      const labelEl = document.getElementById('trend-status-label');
      const detailEl = document.getElementById('trend-status-detail');
      const iconEl = document.getElementById('trend-icon');
      
      // Update MA metric values
      document.getElementById('ma100-val').textContent = g100 ? '$' + g100.toFixed(2) : '--';
      document.getElementById('ma150-val').textContent = g150 ? '$' + g150.toFixed(2) : '--';
      document.getElementById('ma200-val').textContent = g200 ? '$' + g200.toFixed(2) : '--';
      
      // Use glossary-based trend state calculation with volatility
      const trendState = getTrendState(price, g100, g150, g200, macdVal, volScore);
      
      // Determine CSS mode class
      let mode = 'neutral';
      if (trendState === PARALLAX_GLOSSARY.trend_full_thrust) mode = 'bull';
      else if (trendState === PARALLAX_GLOSSARY.trend_reentry_risk) mode = 'bear';
      else if (trendState === PARALLAX_GLOSSARY.trend_nebula) mode = 'volatile';
      else if (trendState === PARALLAX_GLOSSARY.trend_reversal_attempt) mode = 'neutral';
      else if (trendState === PARALLAX_GLOSSARY.trend_drifting) mode = 'neutral';
      
      // Update UI with glossary content
      labelEl.textContent = trendState.label;
      iconEl.textContent = trendState.icon || '◈';
      
      // Build detail text with price context
      const priceContext = `Price $${price.toFixed(2)}`;
      detailEl.innerHTML = `<span class="trend-subtitle">${trendState.subtitle}</span> ${priceContext}. ${trendState.body.split('.')[0]}.`;
      
      badgeEl.className = 'trend-status-badge trend-' + mode;
      badgeEl.title = trendState.flavor; // Add flavor as hover tooltip
      
      // Apply dynamic border color from glossary
      if (trendState.color) {
        badgeEl.style.borderColor = trendState.color;
      }
    }
    
    function updateVolumeStatus(data) {
      const source = currentTimeframe === '1D' ? data.daily : data.intraday;
      if (!source || source.length < 10) {
        document.getElementById('volume-status').textContent = '--';
        document.getElementById('volume-status').className = 'volume-badge';
        return;
      }
      
      // Get last 50 candles for average calculation
      const recent = source.slice(-50);
      const vols = recent.map(p => p.v).filter(v => v && v > 0);
      
      if (vols.length < 5) {
        document.getElementById('volume-status').textContent = 'N/A';
        return;
      }
      
      const avg = vols.reduce((a, b) => a + b, 0) / vols.length;
      const current = vols[vols.length - 1];
      const ratio = current / avg;
      
      const el = document.getElementById('volume-status');
      let label, cls;
      
      if (ratio >= 2) {
        label = 'VOL: HIGH (' + ratio.toFixed(1) + '×)';
        cls = 'vol-high';
      } else if (ratio >= 1.25) {
        label = 'VOL: ELEVATED';
        cls = 'vol-elevated';
      } else if (ratio <= 0.5) {
        label = 'VOL: QUIET';
        cls = 'vol-quiet';
      } else {
        label = 'VOL: NORMAL';
        cls = 'vol-normal';
      }
      
      el.textContent = label;
      el.className = 'volume-badge ' + cls;
    }
    
    function setTimeframe(tf) {
      currentTimeframe = tf;
      document.querySelectorAll('.ctrl-btn[data-tf]').forEach(btn => btn.classList.toggle('active', btn.dataset.tf === tf));
      updateCharts();
      updateMACDDisplay();
      // Also update trend and volume for new timeframe
      const data = tickerData[currentTicker];
      if (data) {
        updateTrendStatus(data);
        updateVolumeStatus(data);
      }
    }
    
    function setRange(range) {
      currentRange = range;
      document.querySelectorAll('.ctrl-btn[data-range]').forEach(btn => btn.classList.toggle('active', btn.dataset.range === range));
      updateCharts();
    }
    
    function toggleMA() {
      showMA = !showMA;
      document.getElementById('ma-toggle').classList.toggle('active', showMA);
      updateCharts();
    }
    
    // =========================================================================
    // CONTEXT BAY (Step 4)
    // =========================================================================
    
    function toggleContextBay(force) {
      const bay = document.getElementById('telemetry-context-bay');
      if (!bay) return;
      
      const shouldOpen = (typeof force === 'boolean')
        ? force
        : bay.classList.contains('collapsed');
      
      bay.classList.toggle('collapsed', !shouldOpen);
      
      const btn = bay.querySelector('.context-bay-handle');
      const state = document.getElementById('context-bay-state');
      if (btn) btn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
      if (state) state.textContent = shouldOpen ? 'COLLAPSE' : 'EXPAND';
    }
    
    function updateContextBay() {
      const bar = document.getElementById('ribbon-meter-bar');
      const readout = document.getElementById('ribbon-readout');
      const radar = document.getElementById('signal-radar');
      const feed = document.getElementById('bridge-feed-mini');
      
      if (!bar || !readout || !radar || !feed) return;
      if (!window.currentTicker) return;
      
      const closes = window.currentSeriesCloses || [];
      if (!closes.length) {
        readout.textContent = 'NO DATA';
        bar.style.width = '0%';
        return;
      }
      
      // Calculate EMA spread for ribbon state
      const ema8 = calcEMA(closes, 8);
      const ema89 = calcEMA(closes, 89);
      const last = closes[closes.length - 1];
      const a = ema8[ema8.length - 1];
      const b = ema89[ema89.length - 1];
      
      if (!Number.isFinite(last) || !Number.isFinite(a) || !Number.isFinite(b)) {
        readout.textContent = 'CALIBRATING...';
        bar.style.width = '0%';
        return;
      }
      
      // Calculate spread as percentage of price
      const spread = Math.abs(a - b) / Math.max(1e-6, last);
      // Map to 0..1 (tuned for visual feel)
      const norm = Math.max(0, Math.min(1, spread / 0.15));
      const pct = Math.round(norm * 100);
      
      bar.style.width = `${pct}%`;
      const state = (pct < 25) ? 'COMPRESSED' : (pct < 60) ? 'NEUTRAL' : 'EXPANDING';
      readout.textContent = state;
      
      // Signal radar: aggregate from existing UI elements
      const volBadge = document.querySelector('.vol-badge');
      const signalStatus = document.querySelector('.signal-status');
      const vol = volBadge ? volBadge.textContent.trim() : '—';
      const signal = signalStatus ? signalStatus.textContent.trim() : '—';
      radar.textContent = `VOL: ${vol}  |  SIGNAL: ${signal}  |  RIBBON: ${state}`;
      
      // Bridge feed mini: pull recent log entries
      const logLines = Array.from(document.querySelectorAll('#telemetry-log .log-entry'))
        .slice(-3)
        .map(el => el.textContent.trim())
        .filter(Boolean);
      
      if (logLines.length) {
        feed.innerHTML = logLines.map(l => `<div class="feed-line">${escapeHtml(l)}</div>`).join('');
      } else {
        feed.innerHTML = '<div class="feed-line">AWAITING TELEMETRY...</div>';
      }
    }
    
    // Simple HTML sanitizer
    function escapeHtml(s) {
      return (s || '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[c]));
    }
    
    function updateCharts() {
      // Lazy load Chart.js if not yet loaded
      if (!ChartLoader.isReady()) {
        ChartLoader.load().then(() => {
          updateCharts(); // Retry after loading
        });
        return;
      }
      
      const data = tickerData[currentTicker];
      if (!data) return;
      let source = currentTimeframe === '1D' ? data.daily : data.intraday;
      if (!source || !source.length) return;
      
      // Smart date filtering: use data's own date range if "now" filtering returns nothing
      const cutoff = Date.now() - (rangeDays[currentRange] * 86400000);
      let filtered = source.filter(d => d.t > cutoff);
      
      // If filtering removed all data (historical data), use relative filtering from data's end date
      if (filtered.length === 0 && source.length > 0) {
        const dataEnd = source[source.length - 1].t;
        const relativeCutoff = dataEnd - (rangeDays[currentRange] * 86400000);
        filtered = source.filter(d => d.t > relativeCutoff);
      }
      
      // If still no data, just use all available data
      if (filtered.length === 0) {
        filtered = source;
      }
      
      source = filtered;
      
      if (!source.length) return;
      
      const labels = source.map(d => new Date(d.t));
      const closes = source.map(d => d.c);
      const color = tickerColors[currentTicker] || '#33ff99';
      
      // Store closes for Context Bay access
      window.currentSeriesCloses = closes;
      
      // Calculate proper Y-axis bounds with padding
      const minPrice = Math.min(...closes);
      const maxPrice = Math.max(...closes);
      const priceRange = maxPrice - minPrice;
      const padding = priceRange * 0.08 || maxPrice * 0.02; // 8% padding, or 2% if flat
      
      // For short timeframes, use tighter bounds to show movement
      const isShortRange = ['1W', '1M'].includes(currentRange);
      const yPadding = isShortRange ? padding * 0.5 : padding;
      
      if (priceChart) priceChart.destroy();
      
      // Calculate EMA series for ribbon
      const emaSeries = RIBBON_PERIODS.map((p, i) => ({
        period: p,
        color: RIBBON_COLORS[i % RIBBON_COLORS.length],
        data: calcEMA(closes, p)
      }));
      
      const datasets = [];
      
      // Main price trace (hero line)
      datasets.push({ 
        label: currentTicker, 
        data: closes, 
        borderColor: color, 
        backgroundColor: 'rgba(0,0,0,0)', // Let ribbon provide the fill vibe
        borderWidth: 2, 
        fill: false, 
        tension: 0.12, 
        pointRadius: 0, 
        pointHoverRadius: 4,
        isPrice: true,    // Step: Tag as price (not ribbon)
        isRibbon: false
      });
      
      if (showMA) {
        // 1) EMA lines (thin, glowing) - track indices for band fill targets
        const emaLineIdx = [];
        emaSeries.forEach((s, idx) => {
          emaLineIdx.push(datasets.length);
          datasets.push({
            label: `EMA ${s.period}`,
            data: s.data,
            borderColor: s.color,
            borderWidth: 0.8, // Thin lines for EM frequency effect
            fill: false,
            tension: 0.15, // Slightly more curve
            pointRadius: 0,
            isRibbon: true,  // Step 6B: Tag for CRT jitter plugin
            // Faster EMAs = more reactive jitter
            jitterAmplitude: 1 + (1 - idx / emaSeries.length) * 0.5
          });
        });
        
        // 2) Filled "bands" between adjacent EMAs (ribbon effect)
        for (let i = 0; i < emaSeries.length - 1; i++) {
          const slowIdx = emaLineIdx[i + 1];
          const c = emaSeries[i].color;
          
          datasets.push({
            label: `BAND ${emaSeries[i].period}-${emaSeries[i + 1].period}`,
            data: emaSeries[i].data,
            borderColor: 'rgba(0,0,0,0)',
            pointRadius: 0,
            tension: 0.15,
            fill: { target: slowIdx },
            isRibbon: true,  // Step 6B: Tag for CRT jitter plugin
            backgroundColor: (ctx) => {
              const chart = ctx.chart;
              const { ctx: c2, chartArea } = chart;
              if (!chartArea) return hexToRgba(c, 0.06);
              const g = c2.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
              // Slightly more transparent with more bands
              g.addColorStop(0, hexToRgba(c, 0.10));
              g.addColorStop(0.6, hexToRgba(c, 0.05));
              g.addColorStop(1, hexToRgba(c, 0.00));
              return g;
            }
          });
        }
      }
      
      priceChart = new Chart(document.getElementById('price-chart'), {
        type: 'line', 
        data: { labels, datasets },
        options: {
          responsive: true, 
          maintainAspectRatio: false, 
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { 
              display: showMA, 
              position: 'top', 
              labels: { 
                boxWidth: 12, 
                font: { size: 10, family: "'IBM Plex Mono', monospace" }, 
                color: '#5a7068',
                // Filter out band datasets from legend
                filter: (item) => !item.text.startsWith('BAND')
              } 
            },
            tooltip: { 
              backgroundColor: 'rgba(10, 12, 15, 0.92)', 
              titleColor: '#33ff99', 
              bodyColor: '#e8f4f0', 
              borderColor: '#33ff99', 
              borderWidth: 1,
              padding: 8,
              titleFont: { family: "'IBM Plex Mono', monospace", size: 11 }, 
              bodyFont: { family: "'IBM Plex Mono', monospace", size: 12, weight: 'bold' }, 
              displayColors: false,
              callbacks: { 
                title: (items) => {
                  if (!items.length) return '';
                  const d = new Date(items[0].parsed.x);
                  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                },
                label: (item) => {
                  // Only show main price line, hide everything else
                  if (item.dataset.label === 'RKLB' || item.datasetIndex === 0) {
                    return '$' + item.parsed.y.toFixed(2);
                  }
                  return null;
                }
              },
              filter: (item) => item.datasetIndex === 0 // Only price, no EMAs
            }
          },
          scales: {
            x: { 
              type: 'time', 
              grid: { color: 'rgba(51, 255, 153, 0.05)' }, 
              ticks: { color: '#3a4a44', font: { family: "'IBM Plex Mono', monospace", size: 10 }, maxTicksLimit: 8 } 
            },
            y: { 
              position: 'right', 
              min: minPrice - yPadding,
              max: maxPrice + yPadding,
              grid: { color: 'rgba(51, 255, 153, 0.05)' }, 
              ticks: { color: '#5a7068', font: { family: "'IBM Plex Mono', monospace", size: 10 }, callback: v => '$' + v.toFixed(2) } 
            }
          }
        },
        plugins: [terrainPlugin, arcadeCRTPlugin, ribbonEMGlitchPlugin, shipOverlayPlugin]
      });
      
      if (macdChart) macdChart.destroy();
      const macdData = source.map(d => d.macd), signalData = source.map(d => d.signal), histData = source.map(d => d.hist);
      macdChart = new Chart(document.getElementById('macd-chart'), {
        type: 'bar', data: { labels, datasets: [
          { label: 'Histogram', data: histData, type: 'bar', order: 2, backgroundColor: histData.map(v => v >= 0 ? 'rgba(51, 255, 153, 0.5)' : 'rgba(255, 107, 107, 0.5)'), borderColor: histData.map(v => v >= 0 ? '#33ff99' : '#ff6b6b'), borderWidth: 1 },
          { label: 'MACD', data: macdData, type: 'line', order: 1, borderColor: '#47d4ff', borderWidth: 1.5, fill: false, tension: 0.1, pointRadius: 0 },
          { label: 'Signal', data: signalData, type: 'line', order: 0, borderColor: '#ffb347', borderWidth: 1.5, fill: false, tension: 0.1, pointRadius: 0 }
        ]},
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { type: 'time', display: false }, y: { position: 'right', grid: { color: 'rgba(51, 255, 153, 0.05)' }, ticks: { color: '#5a7068', font: { family: "'IBM Plex Mono', monospace", size: 9 } } } } }
      });
      
      // Update telemetry side console
      updateTelemetryConsole(source, closes);
      updateContextBay();
      
      // Update Captain's Log from MACD events
      try {
        const events = buildCaptainsLog({ labels, macd: macdData, signal: signalData, hist: histData });
        renderCaptainsLog(events);
      } catch (e) {
        // non-fatal, log for debugging
        console.warn('Captain\'s Log update failed:', e);
      }
      
      // Update Ship Systems panel (reactive to indicators)
      try {
        updateShipSystems(source, closes);
      } catch (e) {
        console.warn('Ship Systems update failed:', e);
      }
      
      // Update MACD Orbit Visualization
      const macdWrapper = document.querySelector('.macd-chart-wrapper');
      if (macdWrapper) {
        macdWrapper.classList.toggle('orbit-mode', macdOrbitMode);
      }
      if (macdOrbitMode) {
        renderMacdOrbit({ macd: macdData, signal: signalData, hist: histData, labels });
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // MACD ORBITAL VISUALIZATION — Star/Planet/Moon system from MACD data
    // ═══════════════════════════════════════════════════════════════════════════
    
    // Animation state for smooth orbital motion
    let macdOrbitAnimFrame = null;
    let macdOrbitData = null;
    
    /**
     * Clamp value between min and max
     */
    function orbitClamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    
    /**
     * Normalize value to 0-1 range
     */
    function normFromRange(v, min, max) {
      if (max - min === 0) return 0;
      return (v - min) / (max - min);
    }
    
    /**
     * Get min/max from array
     */
    function getMinMax(arr) {
      let min = Infinity, max = -Infinity;
      for (const v of arr) {
        if (v == null || !Number.isFinite(v)) continue;
        if (v < min) min = v;
        if (v > max) max = v;
      }
      if (min === Infinity) return { min: 0, max: 1 };
      return { min, max };
    }
    
    /**
     * Toggle MACD display mode (ORBIT / LINES)
     */
    function toggleMacdMode() {
      macdOrbitMode = !macdOrbitMode;
      const btn = document.getElementById('macd-mode-toggle');
      if (btn) {
        btn.classList.toggle('active', macdOrbitMode);
        btn.textContent = macdOrbitMode ? 'ORBIT' : 'LINES';
      }
      
      const macdWrapper = document.querySelector('.macd-chart-wrapper');
      if (macdWrapper) {
        macdWrapper.classList.toggle('orbit-mode', macdOrbitMode);
      }
      
      // If switching to orbit mode and we have cached data, start animation
      if (macdOrbitMode && macdOrbitData) {
        startMacdOrbitAnimation();
      } else {
        stopMacdOrbitAnimation();
      }
      
      // Play UI sound
      if (typeof playSound === 'function') playSound('click');
    }
    window.toggleMacdMode = toggleMacdMode;
    
    /**
     * Render MACD Orbital Visualization
     * Star = market center (zero line)
     * Planet = MACD line (orbit radius)
     * Moon = Signal line (sub-orbit)
     * Histogram = thrust flare intensity
     */
    function renderMacdOrbit({ macd, signal, hist, labels }) {
      // Cache data for animation loop
      macdOrbitData = { macd, signal, hist, labels };
      
      // Start animation if in orbit mode
      if (macdOrbitMode) {
        startMacdOrbitAnimation();
      }
    }
    
    /**
     * Start continuous animation loop for orbit
     */
    function startMacdOrbitAnimation() {
      if (macdOrbitAnimFrame) return; // Already running
      
      // Mobile detection for frame throttling
      const isMobile = window.innerWidth < 768 || ('ontouchstart' in window);
      let lastFrame = 0;
      const targetFps = isMobile ? 30 : 60; // Throttle on mobile
      const frameInterval = 1000 / targetFps;
      
      function animate(timestamp) {
        // Throttle frame rate on mobile
        if (isMobile && timestamp - lastFrame < frameInterval) {
          macdOrbitAnimFrame = requestAnimationFrame(animate);
          return;
        }
        lastFrame = timestamp;
        
        drawMacdOrbitFrame();
        macdOrbitAnimFrame = requestAnimationFrame(animate);
      }
      animate(0);
    }
    
    /**
     * Stop animation loop
     */
    function stopMacdOrbitAnimation() {
      if (macdOrbitAnimFrame) {
        cancelAnimationFrame(macdOrbitAnimFrame);
        macdOrbitAnimFrame = null;
      }
    }
    
    /**
     * Draw a single frame of the orbital visualization
     * ENHANCED: Larger, more atmospheric, topographic feel
     */
    function drawMacdOrbitFrame() {
      if (!macdOrbitData) return;
      
      const { macd, signal, hist, labels } = macdOrbitData;
      
      const wrapper = document.querySelector('.macd-chart-wrapper');
      const canvas = document.getElementById('macd-orbit-canvas');
      if (!wrapper || !canvas) return;
      
      const rect = wrapper.getBoundingClientRect();
      if (rect.width < 100 || rect.height < 60) return;
      
      const isMobile = window.innerWidth < 768 || ('ontouchstart' in window);
      const dpr = isMobile ? Math.min(window.devicePixelRatio, 2) : (window.devicePixelRatio || 1);
      
      const targetW = Math.max(1, Math.floor(rect.width * dpr));
      const targetH = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      
      const ctx = canvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, rect.width, rect.height);
      
      if (!macd?.length || !signal?.length) return;
      
      const N = Math.min(isMobile ? 60 : 120, macd.length);
      const start = macd.length - N;
      
      const macdSlice = macd.slice(start);
      const sigSlice = signal.slice(start);
      const histSlice = (hist || []).slice(start);
      
      const mmM = getMinMax(macdSlice);
      const mmS = getMinMax(sigSlice);
      const mmH = getMinMax(histSlice);
      
      // ENHANCED: Larger orbital elements, more centered
      const cx = rect.width * 0.5;
      const cy = rect.height * 0.48;
      const baseR = Math.min(rect.width, rect.height) * 0.18;
      const maxR = Math.min(rect.width, rect.height) * 0.42;
      
      const t = performance.now() * 0.001;
      
      const i = N - 1;
      const m = macdSlice[i] ?? 0;
      const s = sigSlice[i] ?? 0;
      const h = histSlice[i] ?? 0;
      
      const mN = normFromRange(m, mmM.min, mmM.max) * 2 - 1;
      const sN = normFromRange(s, mmS.min, mmS.max) * 2 - 1;
      const hN = normFromRange(h, mmH.min, mmH.max) * 2 - 1;
      
      const planetR = baseR + (maxR - baseR) * orbitClamp(Math.abs(mN), 0, 1);
      const moonR = planetR * (0.25 + 0.20 * orbitClamp(Math.abs(sN), 0, 1));
      
      const orbitSpeed = 0.10 + Math.abs(hN) * 0.06;
      const angle = t * orbitSpeed;
      
      const moonOrbitSpeed = 1.65;
      const moonAngle = angle * moonOrbitSpeed + sN * 0.9;
      
      const thrust = orbitClamp(Math.abs(hN), 0, 1);
      const ecc = 1 - thrust * 0.15;
      
      const px = cx + Math.cos(angle) * planetR;
      const py = cy + Math.sin(angle) * (planetR * ecc);
      
      const mx = px + Math.cos(moonAngle) * moonR;
      const my = py + Math.sin(moonAngle) * (moonR * 0.9);
      
      // --- DRAW ---
      ctx.save();
      
      // ENHANCED: Deep space nebula background
      const nebulaGrad = ctx.createRadialGradient(
        cx * 0.7, cy * 0.6, 0,
        cx, cy, rect.width * 0.6
      );
      nebulaGrad.addColorStop(0, 'rgba(71, 212, 255, 0.04)');
      nebulaGrad.addColorStop(0.3, 'rgba(179, 136, 255, 0.025)');
      nebulaGrad.addColorStop(0.6, 'rgba(51, 255, 153, 0.015)');
      nebulaGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = nebulaGrad;
      ctx.fillRect(0, 0, rect.width, rect.height);
      
      // ENHANCED: More stars, varying sizes
      ctx.globalAlpha = 0.06;
      const starSeed = Math.floor(t * 0.3);
      for (let k = 0; k < 40; k++) {
        const sx = ((k * 137.5 + starSeed * 0.3) % rect.width);
        const sy = ((k * 173.3 + starSeed * 0.7) % rect.height);
        const starSize = k % 5 === 0 ? 2 : 1;
        const twinkle = 0.5 + 0.5 * Math.sin(t * 3 + k);
        ctx.globalAlpha = 0.03 + twinkle * 0.04;
        ctx.fillStyle = k % 4 === 0 ? '#47d4ff' : k % 3 === 0 ? '#b388ff' : '#33ff99';
        ctx.beginPath();
        ctx.arc(sx, sy, starSize, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      
      // ENHANCED: Central star with corona
      const starPulse = 1 + Math.sin(t * 2.2) * 0.12;
      
      // Outer corona
      const coronaGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 2.5 * starPulse);
      coronaGrad.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
      coronaGrad.addColorStop(0.1, 'rgba(51, 255, 153, 0.25)');
      coronaGrad.addColorStop(0.25, 'rgba(71, 212, 255, 0.15)');
      coronaGrad.addColorStop(0.5, 'rgba(179, 136, 255, 0.06)');
      coronaGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = coronaGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, baseR * 2.5 * starPulse, 0, Math.PI * 2);
      ctx.fill();
      
      // Inner star glow
      const starGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 0.8 * starPulse);
      starGlow.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
      starGlow.addColorStop(0.3, 'rgba(51, 255, 153, 0.6)');
      starGlow.addColorStop(0.7, 'rgba(71, 212, 255, 0.2)');
      starGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = starGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, baseR * 0.8 * starPulse, 0, Math.PI * 2);
      ctx.fill();
      
      // Star core
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.shadowBlur = 8;
      ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      
      // ENHANCED: Multiple orbit rings (like altitude contours)
      ctx.setLineDash([3, 5]);
      for (let ring = 0; ring < 3; ring++) {
        const ringR = baseR + (maxR - baseR) * (ring / 2);
        const ringAlpha = 0.04 + (ring === 0 ? 0.04 : 0);
        ctx.strokeStyle = `rgba(51, 255, 153, ${ringAlpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(cx, cy, ringR, ringR * ecc, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      
      // Active orbit ring (brighter)
      ctx.strokeStyle = `rgba(51, 255, 153, ${0.12 + thrust * 0.15})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.ellipse(cx, cy, planetR, planetR * ecc, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // ENHANCED: Orbit trail with gradient fade
      ctx.globalCompositeOperation = 'screen';
      const trailStep = isMobile ? 3 : 2;
      for (let j = 0; j < N; j += trailStep) {
        const mj = macdSlice[j] ?? 0;
        const hj = histSlice[j] ?? 0;
        
        const mjN = normFromRange(mj, mmM.min, mmM.max) * 2 - 1;
        const hjN = normFromRange(hj, mmH.min, mmH.max) * 2 - 1;
        
        const rj = baseR + (maxR - baseR) * orbitClamp(Math.abs(mjN), 0, 1);
        const aj = (j / Math.max(1, N - 1)) * Math.PI * 2 + t * orbitSpeed;
        const eccJ = 1 - orbitClamp(Math.abs(hjN), 0, 1) * 0.15;
        
        const xj = cx + Math.cos(aj) * rj;
        const yj = cy + Math.sin(aj) * (rj * eccJ);
        
        const age = j / (N - 1);
        const trailColor = hjN > 0 ? '51, 255, 153' : '255, 107, 107';
        ctx.fillStyle = `rgba(${trailColor}, ${0.02 + age * 0.12})`;
        ctx.beginPath();
        ctx.arc(xj, yj, 1.5 + age * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      
      // ENHANCED: Planet with atmosphere
      ctx.save();
      
      // Atmospheric glow
      const atmosGrad = ctx.createRadialGradient(px, py, 0, px, py, 20 + thrust * 15);
      const planetColor = thrust > 0.5 ? 'rgba(51, 255, 153' : 'rgba(71, 212, 255';
      atmosGrad.addColorStop(0, planetColor + ', 0.9)');
      atmosGrad.addColorStop(0.4, planetColor + ', 0.4)');
      atmosGrad.addColorStop(0.7, planetColor + ', 0.15)');
      atmosGrad.addColorStop(1, planetColor + ', 0)');
      ctx.fillStyle = atmosGrad;
      ctx.beginPath();
      ctx.arc(px, py, 20 + thrust * 15, 0, Math.PI * 2);
      ctx.fill();
      
      // Planet core
      ctx.shadowBlur = 20;
      ctx.shadowColor = thrust > 0.5 ? 'rgba(51, 255, 153, 0.9)' : 'rgba(71, 212, 255, 0.8)';
      ctx.fillStyle = thrust > 0.5 ? '#33ff99' : '#47d4ff';
      ctx.beginPath();
      ctx.arc(px, py, 6 + thrust * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      
      // ENHANCED: Thrust flare with gradient
      if (thrust > 0.06) {
        const dir = h >= 0 ? 1 : -1;
        const flareLen = 20 + thrust * 40;
        const flareGrad = ctx.createLinearGradient(
          px, py,
          px - Math.cos(angle) * flareLen, 
          py - Math.sin(angle) * flareLen * ecc
        );
        const flareColor = dir > 0 ? '51, 255, 153' : '255, 107, 107';
        flareGrad.addColorStop(0, `rgba(${flareColor}, 0.8)`);
        flareGrad.addColorStop(0.5, `rgba(${flareColor}, 0.3)`);
        flareGrad.addColorStop(1, `rgba(${flareColor}, 0)`);
        
        ctx.strokeStyle = flareGrad;
        ctx.lineWidth = 3 + thrust * 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px - Math.cos(angle) * flareLen, py - Math.sin(angle) * flareLen * ecc);
        ctx.stroke();
      }
      
      // ENHANCED: Moon with glow
      ctx.save();
      const moonGlow = ctx.createRadialGradient(mx, my, 0, mx, my, 10 + thrust * 6);
      moonGlow.addColorStop(0, 'rgba(255, 179, 71, 0.9)');
      moonGlow.addColorStop(0.4, 'rgba(255, 179, 71, 0.4)');
      moonGlow.addColorStop(1, 'rgba(255, 179, 71, 0)');
      ctx.fillStyle = moonGlow;
      ctx.beginPath();
      ctx.arc(mx, my, 10 + thrust * 6, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.shadowBlur = 12;
      ctx.shadowColor = 'rgba(255, 179, 71, 0.8)';
      ctx.fillStyle = '#ffb347';
      ctx.beginPath();
      ctx.arc(mx, my, 3.5 + thrust * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      
      // Tether line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(mx, my);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // ENHANCED: Status readout (minimal, just momentum direction)
      ctx.font = "9px 'IBM Plex Mono', monospace";
      ctx.textAlign = 'center';
      const momentum = h >= 0 ? '▲ THRUST' : '▼ DRAG';
      const momentumColor = h >= 0 ? 'rgba(51, 255, 153, 0.6)' : 'rgba(255, 107, 107, 0.6)';
      ctx.fillStyle = momentumColor;
      ctx.fillText(momentum, cx, rect.height - 8);
      
      // Divergence arc indicator
      const divergence = Math.abs(m - s);
      const maxDiv = Math.max(Math.abs(mmM.max - mmS.min), Math.abs(mmM.min - mmS.max)) || 1;
      const divNorm = orbitClamp(divergence / maxDiv, 0, 1);
      if (divNorm > 0.4) {
        ctx.globalAlpha = (divNorm - 0.4) * 0.5;
        ctx.strokeStyle = m > s ? 'rgba(51, 255, 153, 0.7)' : 'rgba(255, 107, 107, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, planetR + 14, angle - 0.35, angle + 0.35);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      
      ctx.restore();
    }
    
    // Resize handler for MACD orbit canvas
    window.addEventListener('resize', () => {
      // Canvas will auto-resize on next frame draw
      // Just trigger a redraw if we're in orbit mode
      if (macdOrbitMode && macdOrbitData) {
        drawMacdOrbitFrame();
      }
    });
    
    // Initialize MACD mode button state on page load
    document.addEventListener('DOMContentLoaded', () => {
      const btn = document.getElementById('macd-mode-toggle');
      if (btn) {
        btn.classList.toggle('active', macdOrbitMode);
        btn.textContent = macdOrbitMode ? 'ORBIT' : 'LINES';
      }
      const wrapper = document.querySelector('.macd-chart-wrapper');
      if (wrapper) {
        wrapper.classList.toggle('orbit-mode', macdOrbitMode);
      }
    });
    
    // ═══════════════════════════════════════════════════════════════════════════
    // CAPTAIN'S LOG — Truth-rooted event generation from MACD data
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * Build Captain's Log events from MACD arrays
     * Detects: MACD/Signal crossovers, histogram zero-crosses, momentum acceleration
     */
    function buildCaptainsLog({ labels, macd, signal, hist }) {
      const events = [];
      const n = labels.length;
      
      function push(i, kind, dir, strength) {
        // Format time label from Date object
        const date = labels[i];
        let timeLabel;
        if (date instanceof Date) {
          const mo = (date.getMonth() + 1).toString().padStart(2, '0');
          const dy = date.getDate().toString().padStart(2, '0');
          const hr = date.getHours().toString().padStart(2, '0');
          const mn = date.getMinutes().toString().padStart(2, '0');
          timeLabel = `${mo}/${dy} ${hr}:${mn}`;
        } else {
          timeLabel = `T-${n - i}`;
        }
        
        events.push({
          i,
          t: timeLabel,
          kind,
          dir,
          strength
        });
      }
      
      for (let i = 2; i < n; i++) {
        const m0 = macd[i - 1], m1 = macd[i];
        const s0 = signal[i - 1], s1 = signal[i];
        const h0 = hist[i - 1], h1 = hist[i];
        
        // Skip if data is not valid
        if (![m0, m1, s0, s1, h0, h1].every(Number.isFinite)) continue;
        
        // 1) MACD crosses Signal (bullish/bearish crossover)
        const prevDiff = m0 - s0;
        const nextDiff = m1 - s1;
        if (prevDiff <= 0 && nextDiff > 0) {
          push(i, 'CROSSOVER', 'BULL', Math.abs(h1));
        } else if (prevDiff >= 0 && nextDiff < 0) {
          push(i, 'CROSSOVER', 'BEAR', Math.abs(h1));
        }
        
        // 2) Histogram crosses zero (momentum regime flip)
        if (h0 <= 0 && h1 > 0) {
          push(i, 'MOMENTUM', 'BULL', Math.abs(h1));
        } else if (h0 >= 0 && h1 < 0) {
          push(i, 'MOMENTUM', 'BEAR', Math.abs(h1));
        }
        
        // 3) Surge / exhaustion (acceleration detection)
        if (i >= 2) {
          const h_prev2 = hist[i - 2];
          if (Number.isFinite(h_prev2)) {
            const dh0 = h0 - h_prev2;
            const dh1 = h1 - h0;
            const accel = dh1 - dh0;
            const threshold = 0.02 * Math.max(1e-6, Math.abs(h0));
            
            if (accel > threshold && Math.abs(accel) > 0.01) {
              // Momentum building
              push(i, 'THRUST', h1 >= 0 ? 'BULL' : 'BEAR', Math.abs(accel));
            } else if (accel < -threshold && Math.abs(accel) > 0.01) {
              // Momentum fading
              push(i, 'DRAG', h1 >= 0 ? 'BULL' : 'BEAR', Math.abs(accel));
            }
          }
        }
      }
      
      // Return newest first, cap at 10 events for readability
      events.sort((a, b) => b.i - a.i);
      return events.slice(0, 10);
    }
    
    /**
     * Render Captain's Log events to the DOM
     */
    function renderCaptainsLog(events) {
      const el = document.getElementById('captains-log-list');
      if (!el) return;
      
      if (!events || !events.length) {
        el.innerHTML = `<div class="log-empty">AWAITING SIGNAL EVENTS…</div>`;
        return;
      }
      
      el.innerHTML = events.map(e => {
        const isGood = e.dir === 'BULL';
        const tagClass = isGood ? 'good' : 'bad';
        
        // Generate cockpit-style phrasing based on event type
        let msg;
        switch (e.kind) {
          case 'CROSSOVER':
            msg = isGood 
              ? 'MACD crossed above signal. Trend ignition.' 
              : 'MACD crossed below signal. Trend decay.';
            break;
          case 'MOMENTUM':
            msg = isGood 
              ? 'Histogram flipped positive. Momentum aligned.' 
              : 'Histogram flipped negative. Momentum degraded.';
            break;
          case 'THRUST':
            msg = 'Momentum acceleration detected. Thrust building.';
            break;
          case 'DRAG':
            msg = 'Momentum deceleration detected. Thrust fading.';
            break;
          default:
            msg = 'Signal event registered.';
        }
        
        return `
          <div class="log-row">
            <div class="log-time">${escapeHtml(String(e.t))}</div>
            <div class="log-msg">${escapeHtml(msg)}</div>
            <div class="log-tag ${tagClass}">${escapeHtml(e.kind)}</div>
          </div>
        `;
      }).join('');
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // SHIP SYSTEMS — Reactive state derived from indicators
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * Compute ship systems state from chart data
     * Systems react to EMA spread, MACD histogram, volatility
     */
    function computeShipSystems(source, closes) {
      if (!source || source.length < 20) {
        return getDefaultSystems();
      }
      
      const n = source.length;
      const latest = source[n - 1];
      
      // Compute EMA values for spread calculation
      const ema21 = calcEMA(closes, 21);
      const ema55 = calcEMA(closes, 55);
      const currentEma21 = ema21[ema21.length - 1] || 0;
      const currentEma55 = ema55[ema55.length - 1] || 0;
      const currentPrice = latest.c;
      
      // EMA spread (normalized)
      const emaSpread = currentEma55 > 0 ? (currentEma21 - currentEma55) / currentEma55 : 0;
      
      // MACD metrics
      const macdHist = latest.hist || 0;
      const macd = latest.macd || 0;
      const signal = latest.signal || 0;
      
      // Volatility (simple measure: range vs price)
      const recentBars = source.slice(-14);
      const highs = recentBars.map(d => d.h || d.c);
      const lows = recentBars.map(d => d.l || d.c);
      const avgRange = highs.reduce((s, h, i) => s + (h - lows[i]), 0) / recentBars.length;
      const volatility = currentPrice > 0 ? (avgRange / currentPrice) * 100 : 0;
      
      // Trend strength (count bars where EMA21 > EMA55)
      let trendBars = 0;
      for (let i = Math.max(0, n - 20); i < n; i++) {
        if (ema21[i] > ema55[i]) trendBars++;
      }
      const sustainedTrend = trendBars >= 15;
      
      // Build systems state
      const systems = [];
      
      // THRUSTERS: EMA expanding + positive momentum
      if (emaSpread > 0.03 && macdHist > 0) {
        systems.push({ name: 'THRUSTERS', state: 'UPGRADED', stateClass: 'system-upgraded' });
      } else if (emaSpread > 0 && macd > signal) {
        systems.push({ name: 'THRUSTERS', state: 'ACTIVE', stateClass: 'system-stable' });
      } else {
        systems.push({ name: 'THRUSTERS', state: 'IDLE', stateClass: 'system-idle' });
      }
      
      // HULL: Volatility stress
      if (volatility > 4) {
        systems.push({ name: 'HULL', state: 'DAMAGED', stateClass: 'system-damaged' });
      } else if (volatility > 2.5) {
        systems.push({ name: 'HULL', state: 'STRAINED', stateClass: 'system-strained' });
      } else {
        systems.push({ name: 'HULL', state: 'STABLE', stateClass: 'system-stable' });
      }
      
      // SENSORS: Vol spike + clean crossover
      const recentCrossover = Math.abs(macd - signal) > 0.1 && macdHist !== 0;
      if (volatility > 2 && recentCrossover) {
        systems.push({ name: 'SENSORS', state: 'ENHANCED', stateClass: 'system-enhanced' });
      } else if (macdHist !== 0) {
        systems.push({ name: 'SENSORS', state: 'NOMINAL', stateClass: 'system-stable' });
      } else {
        systems.push({ name: 'SENSORS', state: 'SCANNING', stateClass: 'system-idle' });
      }
      
      // WARP DRIVE: Sustained trend unlocks it
      if (sustainedTrend && emaSpread > 0.02) {
        systems.push({ name: 'WARP DRIVE', state: 'ACQUIRED', stateClass: 'system-acquired' });
      } else if (trendBars >= 10) {
        systems.push({ name: 'WARP DRIVE', state: 'CHARGING', stateClass: 'system-strained' });
      } else {
        systems.push({ name: 'WARP DRIVE', state: 'LOCKED', stateClass: 'system-locked' });
      }
      
      return systems;
    }
    
    function getDefaultSystems() {
      return [
        { name: 'THRUSTERS', state: 'IDLE', stateClass: 'system-idle' },
        { name: 'HULL', state: 'STABLE', stateClass: 'system-stable' },
        { name: 'SENSORS', state: 'NOMINAL', stateClass: 'system-stable' },
        { name: 'WARP DRIVE', state: 'LOCKED', stateClass: 'system-locked' }
      ];
    }
    
    /**
     * Render ship systems to the sidebar panel
     */
    function renderShipSystems(systems) {
      const el = document.getElementById('ship-systems-list');
      if (!el) return;
      
      el.innerHTML = systems.map(s => `
        <li class="system-row">
          <span class="system-name">${escapeHtml(s.name)}</span>
          <span class="system-state ${s.stateClass}">${escapeHtml(s.state)}</span>
        </li>
      `).join('');
    }
    
    /**
     * Compute objectives/milestones from systems and signals
     */
    function computeObjectives(systems, source) {
      const objectives = [];
      
      // Find system states
      const thrusters = systems.find(s => s.name === 'THRUSTERS');
      const hull = systems.find(s => s.name === 'HULL');
      const warp = systems.find(s => s.name === 'WARP DRIVE');
      const sensors = systems.find(s => s.name === 'SENSORS');
      
      // Thrusters upgraded achievement
      if (thrusters && thrusters.state === 'UPGRADED') {
        objectives.push({
          icon: '◆',
          text: 'Thrusters upgraded (trend acceleration)',
          type: 'achieved'
        });
      }
      
      // Hull stress warning
      if (hull && (hull.state === 'STRAINED' || hull.state === 'DAMAGED')) {
        objectives.push({
          icon: '⚠',
          text: `Hull ${hull.state.toLowerCase()} (volatility spike)`,
          type: 'warning'
        });
      }
      
      // Warp drive milestone
      if (warp && warp.state === 'ACQUIRED') {
        objectives.push({
          icon: PixelIcons.toSvg('star', '#ffaa33', 12),
          text: 'Warp capability unlocked (macro trend)',
          type: 'milestone'
        });
      } else if (warp && warp.state === 'CHARGING') {
        objectives.push({
          icon: '◇',
          text: 'Warp drive charging (trend forming)',
          type: 'pending'
        });
      }
      
      // Sensors enhanced
      if (sensors && sensors.state === 'ENHANCED') {
        objectives.push({
          icon: '◆',
          text: 'Sensors enhanced (signal clarity)',
          type: 'achieved'
        });
      }
      
      // If no notable objectives, show default
      if (objectives.length === 0) {
        objectives.push({
          icon: '◇',
          text: 'Monitoring signal conditions...',
          type: 'pending'
        });
      }
      
      return objectives.slice(0, 4); // Cap at 4 objectives
    }
    
    /**
     * Render objectives to the sidebar panel
     */
    function renderObjectives(objectives) {
      const el = document.getElementById('ship-objectives-list');
      if (!el) return;
      
      el.innerHTML = objectives.map(o => `
        <li class="objective-row ${o.type}">
          <span class="objective-icon">${o.icon}</span>
          <span class="objective-text">${escapeHtml(o.text)}</span>
        </li>
      `).join('');
    }
    
    /**
     * Master update function for Ship Systems panel
     */
    function updateShipSystems(source, closes) {
      const systems = computeShipSystems(source, closes);
      renderShipSystems(systems);
      
      const objectives = computeObjectives(systems, source);
      renderObjectives(objectives);
    }
    
    // Update the telemetry side console with current data
    function updateTelemetryConsole(source, closes) {
      if (!source || !source.length) return;
      
      const latest = source[source.length - 1];
      const first = source[0];
      const color = tickerColors[currentTicker] || '#33ff99';
      const profile = TICKER_PROFILES[currentTicker] || {};
      const shipInfo = SHIP_NAMES[currentTicker] || { name: currentTicker, designation: 'UNK-XXX' };
      
      // Calculate metrics
      const currentPrice = latest.c;
      const priceChange = ((currentPrice - first.c) / first.c * 100);
      const hullHealth = Math.max(10, Math.min(100, 50 + priceChange * 2));
      const riskVelocity = Math.min(100, Math.abs(priceChange) * 2.5).toFixed(0);
      
      // Update header callout
      const callout = document.getElementById('telemetry-ship-name');
      if (callout) callout.textContent = `${currentTicker} · ${shipInfo.name}`;
      
      // Update hull bar
      const hullFill = document.getElementById('tm-hull-fill');
      if (hullFill) {
        hullFill.style.width = `${hullHealth}%`;
        hullFill.className = 'fill' + (hullHealth < 40 ? ' danger' : '');
      }
      
      // Update risk velocity
      const riskEl = document.getElementById('tm-risk-vel');
      if (riskEl) {
        riskEl.textContent = riskVelocity;
        riskEl.className = 'value' + (parseInt(riskVelocity) > 50 ? ' warn' : '');
      }
      
      // Update signal status based on MACD
      const signalEl = document.getElementById('tm-signal');
      if (signalEl && latest.macd !== undefined) {
        const macd = latest.macd || 0;
        const sig = latest.signal || 0;
        const hist = latest.hist || 0;
        
        if (macd > sig && hist > 0) {
          signalEl.textContent = 'BULLISH';
          signalEl.className = 'value positive';
        } else if (macd < sig && hist < 0) {
          signalEl.textContent = 'BEARISH';
          signalEl.className = 'value negative';
        } else if (Math.abs(hist) < 0.05) {
          signalEl.textContent = 'DRIFTING';
          signalEl.className = 'value';
        } else {
          signalEl.textContent = 'MIXED';
          signalEl.className = 'value warn';
        }
      }
      
      // Update sensor bank (MAs)
      const ma100El = document.getElementById('tm-ma100');
      const ma150El = document.getElementById('tm-ma150');
      const ma200El = document.getElementById('tm-ma200');
      const priceEl = document.getElementById('tm-price');
      
      if (ma100El) ma100El.textContent = latest.g100 ? '$' + latest.g100.toFixed(2) : '--';
      if (ma150El) ma150El.textContent = latest.g150 ? '$' + latest.g150.toFixed(2) : '--';
      if (ma200El) ma200El.textContent = latest.g200 ? '$' + latest.g200.toFixed(2) : '--';
      if (priceEl) priceEl.textContent = '$' + currentPrice.toFixed(2);

      // --- Market snapshot (OHLC/VWAP/ATR/Volume) from current visible range ---
      const fmtPrice = (v) => Number.isFinite(v) ? '$' + v.toFixed(2) : '--';
      const fmtPct = (v) => Number.isFinite(v) ? (v >= 0 ? '+' : '') + v.toFixed(2) + '%' : '--';
      const fmtNum = (n) => {
        if (!Number.isFinite(n)) return '--';
        if (n >= 1e9) return (n/1e9).toFixed(2) + 'B';
        if (n >= 1e6) return (n/1e6).toFixed(2) + 'M';
        if (n >= 1e3) return (n/1e3).toFixed(1) + 'K';
        return String(Math.round(n));
      };

      const open = source[0]?.o;
      const high = Math.max(...source.map(d => Number(d.h)).filter(Number.isFinite));
      const low  = Math.min(...source.map(d => Number(d.l)).filter(Number.isFinite));
      const close = latest?.c;

      // VWAP over visible range using typical price
      let vwap = NaN;
      try {
        let pv = 0, vv = 0;
        for (const d of source) {
          const h = Number(d.h), l = Number(d.l), c = Number(d.c), v = Number(d.v);
          if (!Number.isFinite(h) || !Number.isFinite(l) || !Number.isFinite(c) || !Number.isFinite(v) || v <= 0) continue;
          const tp = (h + l + c) / 3;
          pv += tp * v;
          vv += v;
        }
        if (vv > 0) vwap = pv / vv;
      } catch(e) {}

      // ATR-14 (true range average)
      let atr = NaN;
      const trs = [];
      for (let i = 1; i < source.length; i++) {
        const h = Number(source[i].h), l = Number(source[i].l), pc = Number(source[i-1].c);
        if (!Number.isFinite(h) || !Number.isFinite(l) || !Number.isFinite(pc)) continue;
        const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
        trs.push(tr);
      }
      if (trs.length >= 14) {
        const window = trs.slice(-14);
        atr = window.reduce((s,x)=>s+x,0) / window.length;
      }

      // Volume + spike vs avg(20)
      const vols = source.map(d => Number(d.v)).filter(Number.isFinite);
      const lastVol = vols.length ? vols[vols.length - 1] : NaN;
      const volWindow = vols.slice(-20);
      const avgVol = volWindow.length ? (volWindow.reduce((s,x)=>s+x,0) / volWindow.length) : NaN;
      const volSpike = (Number.isFinite(lastVol) && Number.isFinite(avgVol) && avgVol > 0) ? (lastVol / avgVol) : NaN;

      const rangeAbs = (Number.isFinite(high) && Number.isFinite(low)) ? (high - low) : NaN;
      const rangePct = (Number.isFinite(rangeAbs) && Number.isFinite(close) && close) ? (rangeAbs / close) * 100 : NaN;

      // Market snapshot fields
      const openEl = document.getElementById('tm-open');
      const highEl = document.getElementById('tm-high');
      const lowEl = document.getElementById('tm-low');
      const closeEl = document.getElementById('tm-close');
      const rangeEl = document.getElementById('tm-range');
      const vwapEl = document.getElementById('tm-vwap');
      const atrEl = document.getElementById('tm-atr');
      const volEl = document.getElementById('tm-vol');
      const avgVolEl = document.getElementById('tm-avgvol');
      const volSpikeEl = document.getElementById('tm-volspike');

      if (openEl) openEl.textContent = fmtPrice(open);
      if (highEl) highEl.textContent = fmtPrice(high);
      if (lowEl) lowEl.textContent = fmtPrice(low);
      if (closeEl) closeEl.textContent = fmtPrice(close);
      if (rangeEl) rangeEl.textContent = Number.isFinite(rangeAbs) ? (fmtPrice(rangeAbs).replace('$','$') + ' · ' + fmtPct(rangePct)) : '--';
      if (vwapEl) vwapEl.textContent = fmtPrice(vwap);
      if (atrEl) atrEl.textContent = fmtPrice(atr);
      if (volEl) volEl.textContent = fmtNum(lastVol);
      if (avgVolEl) avgVolEl.textContent = fmtNum(avgVol);
      if (volSpikeEl) {
        volSpikeEl.textContent = Number.isFinite(volSpike) ? (volSpike.toFixed(2) + 'x') : '--';
        const spikeClass = (Number.isFinite(volSpike) && volSpike >= 1.6) ? 'positive' : (Number.isFinite(volSpike) && volSpike <= 0.7 ? 'negative' : '');
        volSpikeEl.parentElement && (volSpikeEl.parentElement.className = 'console-row ' + spikeClass);
      }

      // 52W + multi-horizon returns from stats.json (if present)
      const s = (window.statsData && statsData[currentTicker]) || {};
      const h52El = document.getElementById('tm-52wh');
      const l52El = document.getElementById('tm-52wl');
      if (h52El) h52El.textContent = fmtPrice(s.high_52w);
      if (l52El) l52El.textContent = fmtPrice(s.low_52w);

      const setRet = (id, val) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (!Number.isFinite(val)) { el.textContent = '--'; return; }
        el.textContent = fmtPct(val);
        const chip = el.closest('.return-chip');
        if (chip) {
          chip.classList.remove('positive','negative');
          chip.classList.add(val >= 0 ? 'positive' : 'negative');
        }
      };
      setRet('tm-r1d', Number(s.return_1d));
      setRet('tm-r1w', Number(s.return_1w));
      setRet('tm-r1m', Number(s.return_1m));
      setRet('tm-r3m', Number(s.return_3m));
      setRet('tm-r6m', Number(s.return_6m));
      setRet('tm-r1y', Number(s.return_1y));
      
      // Update thrust vector (MACD)
      const macdEl = document.getElementById('tm-macd');
      const sigEl = document.getElementById('tm-sig');
      const histoEl = document.getElementById('tm-histo');
      const macdRow = document.getElementById('tm-macd-row');
      const sigRow = document.getElementById('tm-signal-row');
      const histoRow = document.getElementById('tm-histo-row');
      
      if (latest.macd !== undefined) {
        if (macdEl) macdEl.textContent = latest.macd.toFixed(4);
        if (sigEl) sigEl.textContent = latest.signal.toFixed(4);
        if (histoEl) histoEl.textContent = latest.hist.toFixed(4);
        
        if (macdRow) macdRow.className = 'console-row ' + (latest.macd >= 0 ? 'positive' : 'negative');
        if (histoRow) histoRow.className = 'console-row ' + (latest.hist >= 0 ? 'positive' : 'negative');
      }
      
      // Update range chip
      const rangeChip = document.getElementById('tm-range-chip');
      if (rangeChip) rangeChip.innerHTML = `<span class="dot"></span>RANGE · ${currentRange}`;
      
      // Render ship in console
      renderConsoleShip(currentTicker, priceChange);
      
      // Add bridge feed entry
      addBridgeFeedEntry(currentTicker, latest, priceChange);
    }
    
    // Render the pixel ship in the side console
    function renderConsoleShip(ticker, pnlPercent) {
      const container = document.getElementById('console-ship-display');
      const labelEl = document.getElementById('console-ship-class');
      if (!container) return;
      
      ticker = ticker || 'RKLB';
      pnlPercent = pnlPercent || 0;
      
      const sector = tickerThemes[ticker] || 'UNKNOWN';
      const meta = mapTickerToPixelShip(ticker, sector, pnlPercent);
      const lore = PIXEL_SHIP_LORE[meta.pattern] || PIXEL_SHIP_LORE.drone;
      const color = tickerColors[ticker] || '#33ff99';
      
      // Use PNG sprite (custom or fallback)
      const spritePath = SHIP_SPRITES[ticker] || DEFAULT_SHIP_SPRITE;
      
      // Get or create image element
      let img = container.querySelector('img.console-ship-img');
      let svg = container.querySelector('svg#console-ship-svg');
      
      if (!img) {
        img = document.createElement('img');
        img.className = 'console-ship-img';
        img.style.cssText = 'width: 80px; height: 60px; object-fit: contain; image-rendering: pixelated;';
        container.insertBefore(img, container.firstChild);
      }
      
      // Apply ticker color glow
      img.style.filter = `drop-shadow(0 0 8px ${color})`;
      img.src = spritePath;
      img.alt = `${ticker} vessel`;
      img.style.display = 'block';
      
      if (svg) svg.style.display = 'none';
      
      if (labelEl) labelEl.textContent = lore.label;
    }
    
    // Initialize console ship on load
    function initConsoleShip() {
      const ticker = currentTicker || 'RKLB';
      renderConsoleShip(ticker, 0);
    }
    
    // Add entry to bridge feed
    function addBridgeFeedEntry(ticker, latest, priceChange) {
      const logEl = document.getElementById('telemetry-log');
      if (!logEl) return;
      
      const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
      
      // Generate status text based on data
      let statusText = '';
      let entryClass = '';
      
      const macd = latest.macd || 0;
      const sig = latest.signal || 0;
      const hist = latest.hist || 0;
      
      if (macd > sig && hist > 0.05) {
        statusText = `${ticker} thrust vector aligned · bullish crossover`;
        entryClass = 'positive';
      } else if (macd < sig && hist < -0.05) {
        statusText = `${ticker} warning · bearish divergence detected`;
        entryClass = 'negative';
      } else if (Math.abs(priceChange) > 5) {
        statusText = `${ticker} high velocity movement · ${priceChange > 0 ? 'climbing' : 'descending'}`;
        entryClass = priceChange > 0 ? 'positive' : 'negative';
      } else if (Math.abs(hist) < 0.02) {
        statusText = `${ticker} signal drifting · no clear vector`;
        entryClass = '';
      } else {
        statusText = `${ticker} telemetry nominal · monitoring`;
        entryClass = '';
      }
      
      // Create new entry
      const entry = document.createElement('div');
      entry.className = 'log-entry ' + entryClass;
      entry.innerHTML = `<span class="timestamp">[${timestamp}]</span>${statusText}`;
      
      // Add to top of log
      logEl.insertBefore(entry, logEl.firstChild);
      
      // Keep only last 8 entries
      while (logEl.children.length > 8) {
        logEl.removeChild(logEl.lastChild);
      }
    }
    
    /**
     * Get primary group for a tab
     */
    function getPrimaryGroup(tab) {
      if (tab === 'hangar') return 'hangar';
      if (tab === 'chart') return 'data';
      if (tab === 'arcade') return 'arcade';
      if (tab === 'garage' || tab === 'upgrades') return 'garage';
      if (tab === 'positions' || tab === 'options' || tab === 'catalysts') return 'command';
      return 'hangar'; // Default to hangar
    }
    
    function switchTab(tabName) {
      // Toggle panel visibility
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === tabName + '-panel'));
      
      // Auto-collapse Context Bay when leaving Telemetry
      if (tabName !== 'chart') {
        toggleContextBay(false);
      }
      
      // Preload Chart.js when switching to data/chart tab
      if (tabName === 'chart' && !ChartLoader.isReady()) {
        ChartLoader.load().then(() => {
          updateCharts();
        });
      }
      
      // Determine which group this tab belongs to
      const group = getPrimaryGroup(tabName);
      
      // Update primary nav buttons (data-group) and ARIA states
      document.querySelectorAll('.nav-tab[data-group]').forEach(btn => {
        const isActive = btn.dataset.group === group;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
      
      // Show/hide subtabs based on group
      const commandSubtabs = document.getElementById('command-subtabs');
      const garageSubtabs = document.getElementById('garage-subtabs');
      
      if (commandSubtabs) {
        commandSubtabs.style.display = (group === 'command') ? 'flex' : 'none';
      }
      
      if (garageSubtabs) {
        garageSubtabs.style.display = (group === 'garage') ? 'flex' : 'none';
      }
      
      // Update subtab active states
      document.querySelectorAll('#command-subtabs .subtab[data-tab]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
      });
      
      document.querySelectorAll('#garage-subtabs .subtab[data-tab]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
      });
      
      // Initialize Paint Bay when switching to garage
      if (tabName === 'garage' && window.PaintBay) {
        setTimeout(() => {
          const container = document.getElementById('paint-bay-container');
          if (container && !container.dataset.initialized) {
            PaintBay.init('paint-bay-container');
            container.dataset.initialized = 'true';
          }
        }, 100);
      }
      
      // Initialize Upgrades panel when switching to upgrades
      if (tabName === 'upgrades' && window.initUpgradesPanel) {
        setTimeout(() => initUpgradesPanel(), 100);
      }
      
      // Step 5.1: Start/stop fleet background animation
      handleFleetBackground(tabName);
      
      // Initialize hangar when switching to it
      if (tabName === 'hangar' && window.initHangarPanel) {
        window.initHangarPanel();
      }
      
      // Set SpaceScene mode based on current tab
      if (window.SpaceScene && window.SpaceScene.setMode) {
        SpaceScene.setMode(group);
      }
      
      // Refresh arcade previews when switching to arcade tab
      if (tabName === 'arcade' && window.SpriteCache && SpriteCache.loaded) {
        setTimeout(() => SpriteCache.renderGamePreviews(), 100);
      }
      
      // Re-initialize trajectory canvas when switching to holdings/options tab
      if (tabName === 'options' && window.initTrajectoryCanvas) {
        setTimeout(() => window.initTrajectoryCanvas(), 100);
      }
      
      // Update URL hash (without triggering hashchange)
      if (history.replaceState) {
        history.replaceState(null, '', '#' + tabName);
      }
    }
    
    // Hash-based navigation support
    function handleHashNavigation() {
      const hash = window.location.hash.slice(1); // Remove #
      if (hash) {
        const validTabs = ['hangar', 'positions', 'arcade', 'garage', 'upgrades', 'chart', 'catalysts', 'options'];
        if (validTabs.includes(hash)) {
          switchTab(hash);
        }
      }
    }
    
    // Listen for hash changes
    window.addEventListener('hashchange', handleHashNavigation);
    
    // Handle initial hash on page load
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(handleHashNavigation, 500); // Allow other init to complete first
    });
    
    // Step 5.1: Fleet background controller
    let arcadeFlightController = null;
    let hangarFlightController = null; // Step 5: Fleet Hangar
    
    async function handleFleetBackground(tabName) {
      if (!window.FlightScene) return;
      
      const arcadeCanvas = document.getElementById('arcade-bg-canvas');
      const hangarCanvas = document.getElementById('fleet-hangar-canvas');
      
      // Step 5: Fleet Hangar background for positions panel
      if (tabName === 'positions' && hangarCanvas) {
        if (!hangarFlightController) {
          try {
            const ships = await FlightScene.buildShipRoster();
            hangarFlightController = FlightScene.create({
              canvas: hangarCanvas,
              ships: ships,
              mode: 'hangar', // Step 5: depth bands mode
              intensity: 0.55
            });
          } catch (e) {
            console.warn('[FleetBg] Failed to start hangar background:', e);
          }
        }
      } else {
        // Stop hangar background when leaving positions
        if (hangarFlightController) {
          hangarFlightController.stop();
          hangarFlightController = null;
          FlightScene.clearFocus();
        }
      }
      
      if (tabName === 'arcade' && arcadeCanvas) {
        // Start fleet background for arcade
        if (!arcadeFlightController) {
          try {
            const ships = await FlightScene.buildShipRoster();
            arcadeFlightController = FlightScene.create({
              canvas: arcadeCanvas,
              ships: ships,
              mode: 'fleet', // Reduced intensity
              intensity: 0.6
            });
          } catch (e) {
            console.warn('[FleetBg] Failed to start arcade background:', e);
          }
        }
      } else {
        // Stop fleet background when leaving arcade
        if (arcadeFlightController) {
          arcadeFlightController.stop();
          arcadeFlightController = null;
        }
      }
    }
    
    /**
     * Navigate to Mission Command (derivatives.html)
     * Passes currently selected ticker if available
     */
    function launchMissionCommand() {
      // Get current ticker from app state if available
      const currentTicker = window.currentTicker || window.AppState?.selectedTicker || null;
      
      let url = 'derivatives.html';
      if (currentTicker) {
        url += `?ticker=${encodeURIComponent(currentTicker)}`;
      }
      
      // Play navigation sound if available
      if (window.SoundFX) SoundFX.play('click');
      
      window.location.href = url;
    }
    
    // Make launchMissionCommand available globally
    window.launchMissionCommand = launchMissionCommand;
    
    // =========================================================================
    // MOBILE UI FUNCTIONS
    // =========================================================================
    
    function switchTabMobile(tabName) {
      // Update mobile bottom nav (by group)
      const group = getPrimaryGroup(tabName);
      document.querySelectorAll('.mobile-nav-item').forEach(t => {
        // Support both data-tab and data-group
        const btnGroup = t.dataset.group || getPrimaryGroup(t.dataset.tab);
        t.classList.toggle('active', btnGroup === group);
      });
      
      // Update desktop nav tabs (keep in sync - use group)
      document.querySelectorAll('.nav-tab[data-group]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.group === group);
      });
      
      // Update desktop subtabs
      const opsSubtabs = document.getElementById('ops-subtabs');
      const trainingSubtabs = document.getElementById('training-subtabs');
      if (opsSubtabs) opsSubtabs.style.display = (group === 'ops') ? 'flex' : 'none';
      if (trainingSubtabs) trainingSubtabs.style.display = (group === 'training') ? 'flex' : 'none';
      
      document.querySelectorAll('#ops-subtabs .subtab[data-tab]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
      });
      document.querySelectorAll('#training-subtabs .subtab[data-tab]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
      });
      
      // Update panels
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === tabName + '-panel'));
      
      // Play sound
      if (window.SoundFX) SoundFX.play('click');
      
      // Step 5.1: Start/stop fleet background animation
      handleFleetBackground(tabName);
      
      // Re-initialize trajectory canvas when switching to holdings/options tab
      if (tabName === 'options' && window.initTrajectoryCanvas) {
        setTimeout(() => window.initTrajectoryCanvas(), 150);
      }
    }
    
    function populateMobileTickerCarousel() {
      const carouselInner = document.getElementById('ticker-carousel-inner');
      if (!carouselInner) return;
      
      const tickers = Object.keys(statsData).filter(t => t && statsData[t]);
      if (tickers.length === 0) return;
      
      carouselInner.innerHTML = tickers.map(ticker => {
        const stats = statsData[ticker] || {};
        const price = stats.current || 0;
        const change = stats.return_1d || 0;
        const changeClass = change >= 0 ? 'positive' : 'negative';
        const isActive = ticker === currentTicker;
        const color = tickerColors[ticker] || '#33ff99';
        
        return '<div class="carousel-ticker ' + (isActive ? 'active' : '') + '" data-ticker="' + ticker + '" onclick="selectTickerFromCarousel(\'' + ticker + '\')" style="--ticker-color: ' + color + '">' +
          '<div class="carousel-ticker-symbol" style="color: ' + color + '">' + ticker + '</div>' +
          '<div class="carousel-ticker-price">$' + price.toFixed(2) + '</div>' +
          '<div class="carousel-ticker-change ' + changeClass + '">' + (change >= 0 ? '+' : '') + change.toFixed(1) + '%</div>' +
        '</div>';
      }).join('');
    }
    
    function selectTickerFromCarousel(ticker) {
      selectTicker(ticker);
      // Update carousel active state
      document.querySelectorAll('.carousel-ticker').forEach(t => {
        t.classList.toggle('active', t.dataset.ticker === ticker);
      });
      if (window.SoundFX) SoundFX.play('click');
    }
    
    function updateMobileUptime() {
      const uptimeEl = document.getElementById('mobile-uptime');
      const desktopUptimeEl = document.getElementById('uptime');
      if (uptimeEl && desktopUptimeEl) {
        const uptimeText = desktopUptimeEl.textContent.replace('UPTIME: ', '');
        // Shorten for mobile: "00:12:34" -> "12:34"
        const parts = uptimeText.split(':');
        if (parts.length === 3 && parts[0] === '00') {
          uptimeEl.textContent = parts[1] + ':' + parts[2];
        } else {
          uptimeEl.textContent = uptimeText;
        }
      }
    }
    
    // Initialize mobile-specific features
    function initMobileUI() {
      // Populate ticker carousel after data loads
      setTimeout(populateMobileTickerCarousel, 1500);
      
      // Update mobile uptime periodically
      setInterval(updateMobileUptime, 1000);
      
      // Close FAB menu when clicking outside
      document.addEventListener('click', (e) => {
        const fab = document.getElementById('mobile-fab');
        const fabMain = document.getElementById('fab-main');
        const fabMenu = document.getElementById('fab-menu');
        if (fab && fabMain && fabMenu && fabMenu.classList.contains('open')) {
          if (!fab.contains(e.target)) {
            fabMain.classList.remove('open');
            fabMenu.classList.remove('open');
          }
        }
      });
      
      // Swipe gesture for mobile drawer
      let touchStartX = 0;
      let touchEndX = 0;
      
      document.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
      }, { passive: true });
      
      document.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipeGesture();
      }, { passive: true });
      
      function handleSwipeGesture() {
        const swipeDistance = touchEndX - touchStartX;
        const minSwipeDistance = 80;
        const drawer = document.getElementById('mobile-drawer');
        const isDrawerOpen = drawer && drawer.classList.contains('open');
        
        // Swipe right from left edge to open drawer
        if (touchStartX < 30 && swipeDistance > minSwipeDistance && !isDrawerOpen) {
          toggleMobileDrawer();
        }
        // Swipe left to close drawer
        if (isDrawerOpen && swipeDistance < -minSwipeDistance) {
          toggleMobileDrawer();
        }
      }
      
      // Pull to refresh visual (doesn't actually refresh, just visual feedback)
      let pullStartY = 0;
      const pullIndicator = document.getElementById('pull-indicator');
      
      document.addEventListener('touchstart', (e) => {
        if (window.scrollY === 0) {
          pullStartY = e.changedTouches[0].screenY;
        }
      }, { passive: true });
      
      document.addEventListener('touchmove', (e) => {
        if (pullStartY > 0 && window.scrollY === 0) {
          const pullDistance = e.changedTouches[0].screenY - pullStartY;
          if (pullDistance > 60 && pullIndicator) {
            pullIndicator.classList.add('visible');
          }
        }
      }, { passive: true });
      
      document.addEventListener('touchend', () => {
        pullStartY = 0;
        if (pullIndicator) {
          pullIndicator.classList.remove('visible');
        }
      }, { passive: true });
      
      // Sync FAB toggle states on load
      const sfxToggle = document.getElementById('sfx-toggle');
      const fabSfx = document.getElementById('fab-sfx');
      if (sfxToggle && fabSfx) {
        fabSfx.innerHTML = '<span class="fab-icon">🔊</span><span>SFX ' + (sfxToggle.checked ? 'ON' : 'OFF') + '</span>';
        fabSfx.classList.toggle('active', sfxToggle.checked);
      }
    }
    
    // Call initMobileUI when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initMobileUI);
    } else {
      initMobileUI();
    }
    
    function switchChartTab(chartName) {
      document.querySelectorAll('.chart-tab').forEach(t => t.classList.toggle('active', t.dataset.chart === chartName));
      document.querySelectorAll('.chart-panel').forEach(p => p.classList.toggle('active', p.id === 'chart-' + chartName));
    }
    
    function renderStockPositions() {
      // Keep the legacy table rendering for table view
      const tbody = document.getElementById('stock-tbody');
      if (tbody) {
        tbody.innerHTML = DEMO_STOCK_POSITIONS.map(pos => {
          const value = pos.shares * pos.current_price;
          const pnl = (pos.current_price - pos.entry_price) * pos.shares;
          const pnlPct = ((pos.current_price - pos.entry_price) / pos.entry_price * 100);
          const color = tickerColors[pos.ticker] || '#33ff99';
          const hasDossier = TICKER_PROFILES[pos.ticker] ? true : false;
          const dossierBtn = hasDossier ? '<button class="dossier-btn" onclick="openTickerDossier(\'' + pos.ticker + '\')">◉</button>' : '';
          return '<tr class="position-row" data-ticker="' + pos.ticker + '">' +
            '<td><span class="ticker-tag">' + dossierBtn + '<span class="ticker-dot" style="background: ' + color + '"></span>' + pos.ticker + '</span></td>' +
            '<td style="color: var(--text-dim); font-size: 0.65rem; letter-spacing: 0.05em;">' + (tickerThemes[pos.ticker] || '') + '</td>' +
            '<td>' + pos.shares + '</td><td>$' + pos.entry_price.toFixed(2) + '</td><td>$' + pos.current_price.toFixed(2) + '</td>' +
            '<td>$' + value.toLocaleString() + '</td>' +
            '<td class="' + (pnl >= 0 ? 'pnl-positive' : 'pnl-negative') + '">' + (pnl >= 0 ? '+' : '') + '$' + pnl.toFixed(0) + ' (' + (pnlPct >= 0 ? '+' : '') + pnlPct.toFixed(1) + '%)</td></tr>';
        }).join('');
      }
      
      // Render the fleet grid
      renderFleetGrid();
    }
    
    // =========================================================================
    // SHIP_NAMES, SHIP_SPRITES, DEFAULT_SHIP_SPRITE — Loaded from js/data/ship-data.js
    // =========================================================================
    
    // =========================================================================
    // SPRITE CACHE SYSTEM - Preload PNG sprites for canvas games
    // =========================================================================
    const SpriteCache = {
      images: {},
      loaded: false,
      selectedPlayerShip: 'RKLB',
      
      // Preload all ship sprites
      preload() {
        const allSprites = { ...SHIP_SPRITES, DEFAULT: DEFAULT_SHIP_SPRITE };
        const promises = Object.entries(allSprites).map(([key, src]) => {
          return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              this.images[key] = img;
              resolve();
            };
            img.onerror = () => resolve(); // Continue even if one fails
            img.src = src;
          });
        });
        
        Promise.all(promises).then(() => {
          this.loaded = true;
          console.log('[SpriteCache] All ship sprites loaded');
          this.renderArcadeShipGrid();
          this.renderGamePreviews();
        });
      },
      
      // Get a sprite image (returns Image object or null)
      get(ticker) {
        return this.images[ticker] || this.images['DEFAULT'] || null;
      },
      
      // Get random fleet ship (for enemies)
      getRandomFleetShip() {
        const tickers = Object.keys(SHIP_SPRITES);
        const randomTicker = tickers[Math.floor(Math.random() * tickers.length)];
        return { ticker: randomTicker, image: this.get(randomTicker) };
      },
      
      // Draw sprite on canvas with options
      drawOnCanvas(ctx, ticker, x, y, scale = 1, options = {}) {
        const img = this.get(ticker);
        if (!img) return false;
        
        const width = (options.width || 60) * scale;
        const height = (options.height || 45) * scale;
        
        ctx.save();
        
        // Glow effect
        if (options.glow) {
          ctx.shadowColor = options.glowColor || tickerColors[ticker] || '#33ff99';
          ctx.shadowBlur = options.glowBlur || 10;
        }
        
        // Flip if specified (for enemies facing down)
        if (options.flipY) {
          ctx.translate(x, y);
          ctx.scale(1, -1);
          ctx.drawImage(img, -width / 2, -height / 2, width, height);
        } else {
          ctx.drawImage(img, x - width / 2, y - height / 2, width, height);
        }
        
        ctx.restore();
        return true;
      },
      
      // Render the arcade ship selection grid
      renderArcadeShipGrid() {
        const grid = document.getElementById('arcade-ship-grid');
        if (!grid) return;
        
        const tickers = Object.keys(SHIP_SPRITES);
        grid.innerHTML = tickers.map(ticker => {
          const color = tickerColors[ticker] || '#33ff99';
          const isSelected = ticker === this.selectedPlayerShip;
          
          // Step 8: Get ship level for display
          const summary = window.Progression?.getShipSummary(ticker);
          const level = summary?.level || 1;
          const levelColor = level >= 5 ? '#ffd700' : level >= 3 ? '#47d4ff' : '#33ff99';
          
          return `
            <div class="ship-select-item ${isSelected ? 'selected' : ''}" 
                 style="--ship-color: ${color}"
                 onclick="SpriteCache.selectShip('${ticker}')"
                 data-ticker="${ticker}">
              <div class="ship-select-level" style="color: ${levelColor}">LVL ${level}</div>
              <img src="${SHIP_SPRITES[ticker]}" alt="${ticker}">
              <span class="ship-ticker">${ticker}</span>
            </div>
          `;
        }).join('');
      },
      
      // Select a ship for the player
      selectShip(ticker) {
        this.selectedPlayerShip = ticker;
        // Update UI
        document.querySelectorAll('.ship-select-item').forEach(el => {
          el.classList.toggle('selected', el.dataset.ticker === ticker);
        });
        // Play sound
        if (window.MechSFX) MechSFX.click();
        // Toast
        if (typeof showToast === 'function') {
          const shipName = SHIP_NAMES[ticker]?.name || ticker;
          showToast(`${shipName} selected as your ship`, 'info');
        }
      },
      
      // Render game preview canvases
      renderGamePreviews() {
        this.renderInvadersPreview();
        this.renderLanderPreview();
      },
      
      renderInvadersPreview() {
        const canvas = document.getElementById('invaders-preview-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        // Dark background
        ctx.fillStyle = '#050608';
        ctx.fillRect(0, 0, 280, 160);
        
        // Stars
        ctx.fillStyle = 'rgba(51, 255, 153, 0.3)';
        for (let i = 0; i < 30; i++) {
          ctx.fillRect(Math.random() * 280, Math.random() * 160, 1, 1);
        }
        
        // Draw some enemy ships
        const enemyTickers = ['GE', 'KTOS', 'RTX', 'COHR'];
        enemyTickers.forEach((ticker, i) => {
          const x = 50 + (i % 4) * 55;
          const y = 30 + Math.floor(i / 4) * 40;
          this.drawOnCanvas(ctx, ticker, x, y, 0.6, { flipY: true, glow: true, glowBlur: 4 });
        });
        
        // Draw player ship at bottom
        this.drawOnCanvas(ctx, this.selectedPlayerShip, 140, 130, 0.7, { glow: true, glowBlur: 6 });
        
        // Draw some bullets
        ctx.fillStyle = '#33ff99';
        ctx.shadowColor = '#33ff99';
        ctx.shadowBlur = 4;
        ctx.fillRect(138, 100, 4, 10);
        ctx.fillRect(138, 70, 4, 10);
        ctx.shadowBlur = 0;
      },
      
      renderLanderPreview() {
        const canvas = document.getElementById('lander-preview-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        // Dark background
        ctx.fillStyle = '#050608';
        ctx.fillRect(0, 0, 280, 160);
        
        // Stars
        ctx.fillStyle = 'rgba(51, 255, 153, 0.2)';
        for (let i = 0; i < 20; i++) {
          ctx.fillRect(Math.random() * 280, Math.random() * 100, 1, 1);
        }
        
        // Draw terrain
        ctx.strokeStyle = '#33ff99';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 140);
        ctx.lineTo(40, 130);
        ctx.lineTo(80, 145);
        ctx.lineTo(120, 120);
        ctx.lineTo(140, 120); // Landing zone
        ctx.lineTo(160, 120);
        ctx.lineTo(200, 140);
        ctx.lineTo(240, 125);
        ctx.lineTo(280, 135);
        ctx.stroke();
        
        // Landing zone highlight
        ctx.strokeStyle = '#ffb347';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(120, 120);
        ctx.lineTo(160, 120);
        ctx.stroke();
        
        // Draw lander ship
        this.drawOnCanvas(ctx, 'LUNR', 140, 60, 0.7, { glow: true, glowBlur: 8 });
        
        // Thrust flame
        ctx.fillStyle = '#ffb347';
        ctx.shadowColor = '#ffb347';
        ctx.shadowBlur = 8;
        ctx.fillRect(136, 80, 8, 12);
        ctx.shadowBlur = 0;
      }
    };
    
    // Initialize sprite cache on load
    SpriteCache.preload();
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Step 8: Progression System Event Listeners
    // ═══════════════════════════════════════════════════════════════════════════
    
    if (window.PARALLAX_BUS) {
      // Training game results → XP
      window.PARALLAX_BUS.on('training:result', (e) => {
        const t = e?.ticker;
        if (!t || !window.Progression) return;
        
        // Base XP: WIN = 80, LOSS = 30
        // Bonus: up to 120 based on score (10 XP per 100 points, capped at 1200 score)
        const base = e.outcome === 'WIN' ? 80 : 30;
        const bonus = Math.min(120, Math.floor((e.score || 0) / 10));
        const totalXP = base + bonus;
        
        window.Progression.awardXP(t, totalXP, 'Training Simulation', {
          gameId: e.gameId,
          score: e.score,
          outcome: e.outcome
        });
        
        // Feedback
        if (typeof logTerminal === 'function') {
          logTerminal(`[PROGRESS] ${t} earned ${totalXP} XP from training`);
        }
      });
      
      // Mission completions → XP + random upgrade drop
      window.PARALLAX_BUS.on('mission:complete', (e) => {
        const t = e?.ticker;
        if (!t || !window.Progression) return;
        
        // Base: 120 + difficulty * 40
        const difficulty = e.difficulty || 1;
        const amt = 120 + Math.floor(difficulty * 40);
        
        window.Progression.awardXP(t, amt, 'Mission Complete', {
          missionType: e.missionType,
          difficulty: difficulty,
          duration: e.duration
        });
        
        // 20% chance to drop an upgrade
        if (Math.random() < 0.20 && window.ShipUpgrades?.getAllUpgrades) {
          const shipEffects = window.Progression.computeEffects(t);
          const shipLevel = shipEffects?.level || 1;
          
          // Pool = upgrades available at level + 1 (gives something to grow into)
          const pool = window.ShipUpgrades.getAllUpgrades().filter(u => u.reqLevel <= shipLevel + 1);
          if (pool.length > 0) {
            const pick = pool[Math.floor(Math.random() * pool.length)];
            const result = window.Progression.equipUpgrade(t, pick.id);
            if (result.ok) {
              if (typeof showToast === 'function') {
                showToast(`🎁 ${t} acquired: ${pick.name}!`, 'alert');
              }
              if (typeof logTerminal === 'function') {
                logTerminal(`[LOOT] ${t} received ${pick.name} upgrade`);
              }
            }
          }
        }
        
        // Feedback
        if (typeof logTerminal === 'function') {
          logTerminal(`[PROGRESS] ${t} earned ${amt} XP from mission`);
        }
      });
      
      // Mission damaged/aborted → small XP for participation
      window.PARALLAX_BUS.on('mission:damaged', (e) => {
        const t = e?.ticker;
        if (!t || !window.Progression) return;
        
        // Small consolation XP (20)
        window.Progression.awardXP(t, 20, 'Mission Aborted', {
          missionType: e.missionType
        });
        
        if (typeof logTerminal === 'function') {
          logTerminal(`[PROGRESS] ${t} earned 20 XP (mission aborted)`);
        }
      });
      
      // Level up notifications
      window.PARALLAX_BUS.on('progress:level', (e) => {
        if (typeof showToast === 'function') {
          showToast(`${PixelIcons.toSvg('medal', '#ffaa33', 14)} ${e.ticker} reached Level ${e.to}!`, 'alert');
        }
        if (window.MechSFX) {
          MechSFX.success();
        }
      });
      
      console.log('[App] Progression event listeners registered');
    }
    
    function renderFleetGrid() {
      const fleetGrid = document.getElementById('fleet-grid');
      if (!fleetGrid) return;
      
      // Calculate totals
      let totalValue = 0;
      let totalPnl = 0;
      let operational = 0;
      let damaged = 0;
      const maxShares = Math.max(...DEMO_STOCK_POSITIONS.map(p => p.shares));
      const totalShares = DEMO_STOCK_POSITIONS.reduce((s, p) => s + p.shares, 0);
      
      // Build ship cards
      const shipCards = DEMO_STOCK_POSITIONS.map(pos => {
        const value = pos.shares * pos.current_price;
        const pnl = (pos.current_price - pos.entry_price) * pos.shares;
        const pnlPct = ((pos.current_price - pos.entry_price) / pos.entry_price * 100);
        const color = tickerColors[pos.ticker] || '#33ff99';
        const profile = TICKER_PROFILES[pos.ticker] || {};
        const shipInfo = SHIP_NAMES[pos.ticker] || { name: pos.ticker, designation: 'UNK-XXX' };
        const sector = tickerThemes[pos.ticker] || 'UNKNOWN';
        
        totalValue += value;
        totalPnl += pnl;
        
        // Map to ship type
        const shipMeta = mapTickerToPixelShip(pos.ticker, sector, pnlPct);
        const shipLore = PIXEL_SHIP_LORE[shipMeta.pattern] || PIXEL_SHIP_LORE.drone;
        
        // Calculate stats for bars
        const hullHealth = Math.max(10, Math.min(100, 50 + pnlPct * 2)); // P&L affects hull
        const cargoPercent = Math.round((pos.shares / totalShares) * 100);
        const fuelPercent = Math.max(10, Math.min(100, Math.random() * 40 + 60)); // Random fuel level
        
        const isOperational = pnlPct >= 0;
        if (isOperational) operational++;
        else damaged++;
        
        // Sprite if available; otherwise use fallback sprite (all ships now have sprites)
        const spritePath = SHIP_SPRITES[pos.ticker] || DEFAULT_SHIP_SPRITE;
        const shipVisualMarkup = `<img src="${spritePath}" alt="${pos.ticker} ship" loading="lazy" decoding="async">`;
        
        return `
          <div class="ship-card ${isOperational ? '' : 'negative'}" data-ticker="${pos.ticker}" style="--ship-color: ${color}" onclick="openVesselDossier('${pos.ticker}');">
            <div class="ship-card-inner">
              <div class="ship-visual">
                ${shipVisualMarkup}
                <span class="ship-class-badge">${shipLore.label}</span>
              </div>
              <div class="ship-info">
                <div class="ship-header">
                  <div>
                    <div class="ship-name">${pos.ticker}</div>
                    <div class="ship-designation">${shipInfo.name} · ${shipInfo.designation}</div>
                  </div>
                  <div class="ship-status-indicator ${isOperational ? 'operational' : 'damaged'}">
                    <span class="dot"></span>
                    ${isOperational ? 'OPERATIONAL' : 'DAMAGED'}
                  </div>
                </div>
                <div class="ship-stats">
                  <div class="ship-stat-row">
                    <span class="ship-stat-label">HULL</span>
                    <div class="ship-stat-bar">
                      <div class="ship-stat-fill hull ${isOperational ? '' : 'damaged'}" style="width: ${hullHealth}%"></div>
                    </div>
                    <span class="ship-stat-value">${hullHealth.toFixed(0)}%</span>
                  </div>
                  <div class="ship-stat-row">
                    <span class="ship-stat-label">CARGO</span>
                    <div class="ship-stat-bar">
                      <div class="ship-stat-fill cargo" style="width: ${cargoPercent}%"></div>
                    </div>
                    <span class="ship-stat-value">${pos.shares} units</span>
                  </div>
                  <div class="ship-stat-row">
                    <span class="ship-stat-label">FUEL</span>
                    <div class="ship-stat-bar">
                      <div class="ship-stat-fill fuel" style="width: ${fuelPercent}%"></div>
                    </div>
                    <span class="ship-stat-value">${fuelPercent.toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="ship-footer">
              <div class="ship-value">$${value.toLocaleString()}</div>
              <div class="ship-pnl">
                <span class="ship-pnl-amount ${pnl >= 0 ? 'positive' : 'negative'}">${pnl >= 0 ? '+' : ''}$${Math.abs(pnl).toFixed(0)}</span>
                <span class="ship-pnl-percent ${pnlPct >= 0 ? 'positive' : 'negative'}">${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        `;
      }).join('');
      
      fleetGrid.innerHTML = shipCards;
      
      // Update summary stats
      const todayPnl = document.getElementById('fleet-total-pnl');
      const fleetValue = document.getElementById('fleet-total-value');
      const shipCount = document.getElementById('fleet-ship-count');
      const opCount = document.getElementById('fleet-operational-count');
      const dmgCount = document.getElementById('fleet-damaged-count');
      const winRate = document.getElementById('fleet-win-rate');
      
      if (todayPnl) {
        todayPnl.textContent = (totalPnl >= 0 ? '+' : '') + '$' + Math.abs(totalPnl).toLocaleString(undefined, {maximumFractionDigits: 0});
        todayPnl.className = 'value ' + (totalPnl >= 0 ? 'positive' : 'negative');
      }
      if (fleetValue) fleetValue.textContent = '$' + totalValue.toLocaleString(undefined, {maximumFractionDigits: 0});
      if (shipCount) shipCount.textContent = DEMO_STOCK_POSITIONS.length;
      if (opCount) opCount.textContent = operational;
      if (dmgCount) dmgCount.textContent = damaged;
      if (winRate) winRate.textContent = Math.round((operational / DEMO_STOCK_POSITIONS.length) * 100) + '%';
      
      // Update Command Brief
      updateCommandBrief(totalPnl, operational, damaged, DEMO_STOCK_POSITIONS);
      
      // Step 5: Add hover handlers for hangar focus
      bindFleetCardHoverHandlers();
    }
    
    /**
     * Update Command Brief panel with fleet intelligence
     */
    function updateCommandBrief(totalPnl, operational, damaged, positions) {
      const statusEl = document.getElementById('brief-status');
      const postureEl = document.getElementById('brief-posture');
      const concentrationEl = document.getElementById('brief-concentration');
      const riskEl = document.getElementById('brief-risk');
      const outcomeEl = document.getElementById('brief-outcome');
      const notesEl = document.getElementById('brief-notes');
      
      if (!statusEl) return;
      
      // Determine overall status
      const winRate = operational / (operational + damaged);
      const pnlPositive = totalPnl >= 0;
      
      let status = 'NOMINAL';
      let statusClass = '';
      if (winRate < 0.6 || totalPnl < -500) {
        status = 'CAUTION';
        statusClass = 'warning';
      }
      if (winRate < 0.4 || totalPnl < -2000) {
        status = 'ALERT';
        statusClass = 'alert';
      }
      statusEl.textContent = status;
      statusEl.className = 'command-brief-status ' + statusClass;
      
      // Determine posture
      const postures = [
        { threshold: 0.9, label: 'Aggressive Expansion' },
        { threshold: 0.75, label: 'Controlled Expansion' },
        { threshold: 0.5, label: 'Defensive Positioning' },
        { threshold: 0, label: 'Damage Control' }
      ];
      const posture = postures.find(p => winRate >= p.threshold)?.label || 'Unknown';
      if (postureEl) postureEl.textContent = posture;
      
      // Analyze sector concentration
      const sectors = {};
      positions.forEach(p => {
        const sector = p.sector || 'Unknown';
        sectors[sector] = (sectors[sector] || 0) + 1;
      });
      const topSectors = Object.entries(sectors)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([s]) => s);
      if (concentrationEl) concentrationEl.textContent = topSectors.join(' & ') || 'Diversified';
      
      // Risk assessment
      const riskLevels = [
        { threshold: 0.85, label: 'Minimal', cls: 'positive' },
        { threshold: 0.7, label: 'Acceptable', cls: '' },
        { threshold: 0.5, label: 'Elevated', cls: 'warning' },
        { threshold: 0, label: 'Critical', cls: 'negative' }
      ];
      const risk = riskLevels.find(r => winRate >= r.threshold);
      if (riskEl) {
        riskEl.textContent = risk?.label || 'Unknown';
        riskEl.className = 'brief-value ' + (risk?.cls || '');
      }
      
      // Expected outcome
      const outcomes = [
        { pnl: 1000, rate: 0.8, label: 'Strong Favorable Drift', cls: 'positive' },
        { pnl: 0, rate: 0.6, label: 'Favorable Drift', cls: 'positive' },
        { pnl: -500, rate: 0.4, label: 'Uncertain Trajectory', cls: 'warning' },
        { pnl: -Infinity, rate: 0, label: 'Recovery Mode', cls: 'negative' }
      ];
      const outcome = outcomes.find(o => totalPnl >= o.pnl && winRate >= o.rate);
      if (outcomeEl) {
        outcomeEl.textContent = outcome?.label || 'Uncertain';
        outcomeEl.className = 'brief-value ' + (outcome?.cls || '');
      }
      
      // Generate dynamic notes
      const notes = [];
      if (pnlPositive && winRate > 0.7) {
        notes.push('• Fleet momentum aligned with sector trends');
      } else if (!pnlPositive) {
        notes.push('• Temporary headwinds affecting fleet performance');
      }
      
      if (operational > damaged * 3) {
        notes.push('• Primary vessels showing hull integrity');
      } else if (damaged > 0) {
        notes.push('• ' + damaged + ' vessel(s) require attention');
      }
      
      if (winRate > 0.8) {
        notes.push('• Recommend maintaining current trajectory');
      } else if (winRate > 0.5) {
        notes.push('• Consider rebalancing underperformers');
      } else {
        notes.push('• Strategic review recommended');
      }
      
      if (notesEl) {
        notesEl.innerHTML = notes.map(n => `<div class="brief-note">${n}</div>`).join('');
      }
    }
    
    // Step 5: Bind hover handlers to fleet cards for hangar focus
    function bindFleetCardHoverHandlers() {
      if (!window.FlightScene) return;
      
      const cards = document.querySelectorAll('.ship-card[data-ticker]');
      cards.forEach(card => {
        const ticker = card.dataset.ticker;
        
        card.addEventListener('mouseenter', () => {
          FlightScene.setFocus(ticker, 1500); // Focus for 1.5s after hover ends
        });
        
        card.addEventListener('mouseleave', () => {
          // Focus will auto-clear after 1.5s via setFocus duration
        });
      });
    }
    
    // Generate SVG string for a pixel ship
    function generateShipSvgString(patternKey, color, pnlPercent) {
      const pattern = PIXEL_SHIPS[patternKey] || PIXEL_SHIPS.drone;
      const rows = pattern.length;
      const cols = pattern[0].length;
      
      const cell = 2.9;
      const width = cols * cell;
      const height = rows * cell;
      
      const viewW = 120;
      const viewH = 80;
      const offsetX = (viewW - width) / 2;
      const offsetY = (viewH - height) / 2;
      
      // Parse color to get HSL values
      const baseHue = getHueFromColor(color);
      
      let svgContent = '';
      
      for (let r = 0; r < rows; r++) {
        const row = pattern[r];
        for (let c = 0; c < cols; c++) {
          const digit = row[c];
          if (digit === '0') continue;
          
          let fill;
          if (digit === '1') {
            fill = `hsl(${baseHue}, 40%, 25%)`; // Dark edge
          } else if (digit === '2') {
            fill = `hsl(${baseHue}, 60%, 45%)`; // Mid tone
          } else {
            fill = `hsl(${baseHue}, 80%, 65%)`; // Cockpit highlight
          }
          
          const x = offsetX + c * cell;
          const y = offsetY + r * cell;
          
          svgContent += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${fill}" />`;
        }
      }
      
      return svgContent;
    }
    
    // Extract hue from hex color
    function getHueFromColor(hexColor) {
      const hex = hexColor.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16) / 255;
      const g = parseInt(hex.substr(2, 2), 16) / 255;
      const b = parseInt(hex.substr(4, 2), 16) / 255;
      
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h = 0;
      
      if (max !== min) {
        const d = max - min;
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: h = ((b - r) / d + 2) / 6; break;
          case b: h = ((r - g) / d + 4) / 6; break;
        }
      }
      
      return Math.round(h * 360);
    }
    
    // Toggle between fleet grid view and table view
    function setFleetView(view) {
      const gridView = document.getElementById('fleet-grid-view');
      const tableView = document.getElementById('fleet-table-view');
      const btns = document.querySelectorAll('.fleet-view-btn');
      
      if (view === 'grid') {
        if (gridView) gridView.classList.remove('hidden');
        if (tableView) tableView.classList.remove('active');
      } else {
        if (gridView) gridView.classList.add('hidden');
        if (tableView) tableView.classList.add('active');
      }
      
      btns.forEach(btn => {
        btn.classList.toggle('active', btn.textContent.toLowerCase().includes(view));
      });
      
      if (window.SoundFX) SoundFX.play('click');
    }
    
    function renderOptionsPositions() {
      document.getElementById('options-tbody').innerHTML = DEMO_OPTIONS.map(pos => {
        const pnl = (pos.current - pos.entry) * pos.contracts * 100;
        const pnlPct = ((pos.current - pos.entry) / pos.entry * 100);
        const color = tickerColors[pos.ticker] || '#33ff99';
        const hasDossier = TICKER_PROFILES[pos.ticker] ? true : false;
        const dossierBtn = hasDossier ? '<button class="dossier-btn" onclick="openTickerDossier(\'' + pos.ticker + '\')">◉</button>' : '';
        const shipSrc = SHIP_SPRITES[pos.ticker] || DEFAULT_SHIP_SPRITE;
        return '<tr class="position-row" data-ticker="' + pos.ticker + '">' +
          '<td><span class="ticker-tag">' + dossierBtn + 
          '<img src="' + shipSrc + '" class="option-ship-icon" style="width: 24px; height: 18px; object-fit: contain; image-rendering: pixelated; vertical-align: middle; margin-right: 6px; filter: drop-shadow(0 0 3px ' + color + ');">' +
          '<span class="ticker-dot" style="background: ' + color + '"></span>' + pos.ticker + '</span></td>' +
          '<td><span class="structure-tag">' + pos.structure + '</span></td><td>' + pos.strikes + '</td>' +
          '<td>$' + pos.entry.toFixed(2) + '</td><td>$' + pos.current.toFixed(2) + '</td>' +
          '<td class="' + (pnl >= 0 ? 'pnl-positive' : 'pnl-negative') + '">' + (pnl >= 0 ? '+' : '') + '$' + pnl.toFixed(0) + ' (' + (pnlPct >= 0 ? '+' : '') + pnlPct.toFixed(0) + '%)</td>' +
          '<td>' + pos.delta.toFixed(2) + '</td></tr>';
      }).join('');
    }
    
    function renderPositionCharts() {
      const chartSizes = document.getElementById('chart-sizes');
      const chartPnl = document.getElementById('chart-pnl');
      
      if (!chartSizes || !chartPnl) return;
      if (!DEMO_OPTIONS || !DEMO_OPTIONS.length) return;
      
      const positions = DEMO_OPTIONS.map(pos => ({ ticker: pos.ticker, value: pos.current * pos.contracts * 100, color: tickerColors[pos.ticker] || '#33ff99' })).sort((a, b) => b.value - a.value);
      const maxValue = Math.max(...positions.map(p => p.value));
      const totalValue = positions.reduce((s, x) => s + x.value, 0);
      chartSizes.innerHTML = '<div class="bar-chart">' + positions.map(p =>
        '<div class="bar-row"><span class="bar-ticker" style="color: ' + p.color + '">' + p.ticker + '</span>' +
        '<div class="bar-container"><div class="bar-fill" style="width: ' + (p.value/maxValue*100) + '%; background: ' + p.color + '">' + Math.round(p.value/totalValue*100) + '%</div></div>' +
        '<span class="bar-value">$' + p.value.toLocaleString() + '</span></div>'
      ).join('') + '</div>';
      
      const pnlData = DEMO_OPTIONS.map(pos => ({ ticker: pos.ticker, pnl: (pos.current - pos.entry) * pos.contracts * 100, pct: ((pos.current - pos.entry) / pos.entry * 100), color: tickerColors[pos.ticker] || '#33ff99' })).sort((a, b) => b.pnl - a.pnl);
      const maxPnl = Math.max(...pnlData.map(p => Math.abs(p.pnl)));
      let winners = 0, losers = 0, totalPnl = 0;
      pnlData.forEach(p => { if (p.pnl >= 0) winners++; else losers++; totalPnl += p.pnl; });
      chartPnl.innerHTML = '<div class="bar-chart">' + pnlData.map(p =>
        '<div class="pnl-row"><span class="bar-ticker" style="color: ' + p.color + '">' + p.ticker + '</span>' +
        '<div class="pnl-bar-container"><div class="pnl-center-line"></div>' +
        '<div class="pnl-bar ' + (p.pnl >= 0 ? 'positive' : 'negative') + '" style="width: ' + (Math.abs(p.pnl)/maxPnl*50) + '%">' + (p.pnl >= 0 ? '+' : '') + p.pct.toFixed(0) + '%</div></div>' +
        '<span class="pnl-amount ' + (p.pnl >= 0 ? 'positive' : 'negative') + '">' + (p.pnl >= 0 ? '+' : '') + '$' + Math.abs(p.pnl).toLocaleString() + '</span></div>'
      ).join('') + '</div>' +
      '<div class="summary-row"><div class="summary-item"><div class="summary-value positive">' + winners + '</div><div class="summary-label">Winners</div></div>' +
      '<div class="summary-item"><div class="summary-value positive">+$' + totalPnl.toLocaleString() + '</div><div class="summary-label">Total P&L</div></div>' +
      '<div class="summary-item"><div class="summary-value negative">' + losers + '</div><div class="summary-label">Losers</div></div></div>';
    }
    
    function renderCatalysts() {
      document.getElementById('catalyst-list').innerHTML = DEMO_CATALYSTS.map(cat => {
        const color = tickerColors[cat.ticker] || '#5a7068';
        return '<div class="catalyst-item"><span class="catalyst-date">' + cat.date + '</span>' +
          '<span class="catalyst-ticker" style="color: ' + color + '">' + cat.ticker + '</span>' +
          '<span class="catalyst-event">' + cat.event + '</span>' +
          '<span class="catalyst-impact ' + cat.impact.toLowerCase() + '">' + cat.impact + '</span></div>';
      }).join('');
    }
    
    function renderActivity() {
      const tradeSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>';
      const alertSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
      document.getElementById('activity-feed').innerHTML = DEMO_ACTIVITY.map(act =>
        '<div class="activity-item"><div class="activity-icon ' + act.type + '">' + (act.type === 'trade' ? tradeSvg : alertSvg) + '</div>' +
        '<div class="activity-content"><div class="activity-title">' + act.title + '</div><div class="activity-subtitle">' + act.subtitle + '</div></div>' +
        '<div class="activity-time">' + act.time + '</div></div>'
      ).join('');
    }
    
    function toggleKillSwitch() {
      const btn = document.querySelector('.kill-switch-btn');
      const status = document.querySelector('.kill-switch-status');
      if (btn.classList.contains('stop')) {
        btn.classList.replace('stop', 'resume');
        btn.textContent = 'RESUME OPERATIONS';
        status.textContent = 'Trading halted';
      } else {
        btn.classList.replace('resume', 'stop');
        btn.textContent = 'ABORT ALL TRADES';
        status.textContent = 'System operational';
      }
    }
    
    function toggleDevConsole() {
      const console = document.getElementById('dev-console');
      console.classList.toggle('visible');
    }
    
    // ============================================
    // CONTROL PANEL INTERACTIVITY
    // ============================================
    
    const controlState = {
      smoothing: 50,
      forecast: 30,
      sensitivity: 65,
      momentum: true,
      heatmap: false,
      alerts: true,
      risk: 60
    };
    
    // Knob rotation values
    const knobSettings = {
      smoothing: { values: [0, 25, 50, 75, 100], labels: ['0%', '25%', '50%', '75%', '100%'], current: 2 },
      forecast: { values: [7, 14, 30, 60, 90], labels: ['7 DAYS', '14 DAYS', '30 DAYS', '60 DAYS', '90 DAYS'], current: 2 }
    };
    
    function cycleKnob(knobId) {
      const settings = knobSettings[knobId];
      settings.current = (settings.current + 1) % settings.values.length;
      
      const knob = document.getElementById('knob-' + knobId);
      const valueEl = document.getElementById(knobId + '-value');
      
      // Rotate knob (each step is ~60 degrees)
      const rotation = (settings.current - 2) * 60;
      knob.style.transform = 'rotate(' + rotation + 'deg)';
      
      // Update value display
      valueEl.textContent = settings.labels[settings.current];
      controlState[knobId] = settings.values[settings.current];
      
      // Visual feedback
      knob.style.boxShadow = '0 4px 8px rgba(0,0,0,0.5), 0 0 20px var(--phosphor-glow), inset 0 2px 4px rgba(255,255,255,0.1)';
      setTimeout(() => {
        knob.style.boxShadow = '';
      }, 200);
      
      // Update band label for smoothing knob
      if (knobId === 'smoothing') {
        updateSmoothingBandLabel(settings.values[settings.current]);
      }
      
      // Update forecast display for forecast knob
      if (knobId === 'forecast') {
        updateForecastDisplay(settings.values[settings.current]);
      }
      
      // Trigger chart update effect
      flashUpdate();
      logControlChange(knobId.toUpperCase() + ' set to ' + settings.labels[settings.current]);
    }
    
    function toggleSwitch(switchId) {
      const toggle = document.getElementById('toggle-' + switchId);
      const isActive = toggle.classList.toggle('active');
      controlState[switchId] = isActive;
      
      // Visual feedback in log
      logControlChange(switchId.toUpperCase() + ' ' + (isActive ? 'ENABLED' : 'DISABLED'));
      
      // Apply effects based on switch
      if (switchId === 'momentum' && priceChart) {
        // Toggle MA visibility
        showMA = isActive;
        document.getElementById('ma-toggle').classList.toggle('active', isActive);
        updateCharts();
      }
      
      flashUpdate();
    }
    
    function handleSliderClick(event, sliderId) {
      const track = document.getElementById(sliderId + '-track');
      const fill = document.getElementById(sliderId + '-fill');
      const thumb = document.getElementById(sliderId + '-thumb');
      
      const rect = track.getBoundingClientRect();
      const percent = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
      
      fill.style.width = percent + '%';
      thumb.style.left = percent + '%';
      controlState[sliderId] = Math.round(percent);
      
      // Update risk gauge based on sensitivity
      updateRiskGauge(percent);
      logControlChange('SENSITIVITY adjusted to ' + Math.round(percent) + '%');
      flashUpdate();
    }
    
    function updateRiskGauge(sensitivity) {
      // Risk inversely correlates with sensitivity (more sensitive = catches more risk)
      const riskLevel = 100 - (sensitivity * 0.4);
      const needle = document.getElementById('risk-needle');
      const fill = document.getElementById('risk-fill');
      const value = document.getElementById('risk-value');
      
      // Needle rotation: -45deg (low) to 225deg (high)
      const rotation = -45 + (riskLevel / 100 * 180);
      needle.style.transform = 'rotate(' + rotation + 'deg)';
      fill.style.height = riskLevel + '%';
      
      if (riskLevel < 33) {
        value.textContent = 'LOW';
        fill.style.background = 'var(--phosphor)';
      } else if (riskLevel < 66) {
        value.textContent = 'MODERATE';
        fill.style.background = 'linear-gradient(0deg, var(--amber) 0%, var(--phosphor) 100%)';
      } else {
        value.textContent = 'HIGH';
        fill.style.background = 'linear-gradient(0deg, #ff4444 0%, var(--amber) 100%)';
      }
      
      controlState.risk = riskLevel;
    }
    
    function runAnalysis(e) {
      const btn = e && e.currentTarget ? e.currentTarget : document.getElementById('run-analysis-btn');
      btn.textContent = '◌ ANALYZING...';
      btn.disabled = true;
      
      // Animate LED array
      const leds = document.querySelectorAll('.led-array .array-led');
      let ledIndex = 0;
      const ledInterval = setInterval(() => {
        leds.forEach((led, i) => {
          led.classList.remove('on', 'amber');
          if (i <= ledIndex) led.classList.add('on');
        });
        ledIndex++;
        if (ledIndex > leds.length) {
          clearInterval(ledInterval);
          
          // Compute data-driven volatility score
          const volScore = getVolScoreForTicker(currentTicker) || (15 + Math.random() * 20);
          const newVol = volScore.toFixed(1);
          document.getElementById('vol-display').textContent = newVol;
          
          // Update LED array based on volatility (0-40 mapped to 0-8 LEDs)
          const volLevel = Math.ceil((volScore / 40) * leds.length);
          leds.forEach((led, i) => {
            led.classList.remove('on', 'amber', 'red');
            if (i < volLevel) {
              if (i < 4) led.classList.add('on');
              else if (i < 6) led.classList.add('amber');
              else led.classList.add('red');
            }
          });
          
          btn.textContent = '▸ RUN ANALYSIS';
          btn.disabled = false;
          
          logControlChange('ANALYSIS COMPLETE — Vol: ' + newVol + 'σ');
        }
      }, 100);
      
      flashUpdate();
    }
    
    function resetControls() {
      // Reset knobs
      knobSettings.smoothing.current = 2;
      knobSettings.forecast.current = 2;
      document.getElementById('knob-smoothing').style.transform = 'rotate(0deg)';
      document.getElementById('knob-forecast').style.transform = 'rotate(0deg)';
      document.getElementById('smoothing-value').textContent = '50%';
      document.getElementById('forecast-value').textContent = '30 DAYS';
      
      // Reset toggles
      document.getElementById('toggle-momentum').classList.add('active');
      document.getElementById('toggle-heatmap').classList.remove('active');
      document.getElementById('toggle-alerts').classList.add('active');
      
      // Reset slider
      document.getElementById('sensitivity-fill').style.width = '65%';
      document.getElementById('sensitivity-thumb').style.left = '65%';
      
      // Reset gauge
      updateRiskGauge(65);
      
      // Reset state
      Object.assign(controlState, {
        smoothing: 50,
        forecast: 30,
        sensitivity: 65,
        momentum: true,
        heatmap: false,
        alerts: true
      });
      
      logControlChange('ALL CONTROLS RESET TO DEFAULTS');
      flashUpdate();
    }
    
    function flashUpdate() {
      // Flash the panel header to show update
      const header = document.querySelector('.panel-header');
      if (header) {
        header.style.background = 'rgba(51, 255, 153, 0.1)';
        setTimeout(() => {
          header.style.background = '';
        }, 150);
      }
    }
    
    function logControlChange(message) {
      // Add to activity feed
      const feed = document.getElementById('activity-feed');
      if (!feed) return;
      
      const now = new Date();
      const time = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      
      const alertSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
      
      const item = document.createElement('div');
      item.className = 'activity-item';
      item.innerHTML = '<div class="activity-icon alert">' + alertSvg + '</div>' +
        '<div class="activity-content"><div class="activity-title">Control Update</div><div class="activity-subtitle">' + message + '</div></div>' +
        '<div class="activity-time">' + time + '</div>';
      
      feed.insertBefore(item, feed.firstChild);
      
      // Keep only last 10 items
      while (feed.children.length > 10) {
        feed.removeChild(feed.lastChild);
      }
    }
    
    // Animate scanner blips periodically
    setInterval(() => {
      const blips = document.querySelectorAll('.scanner-blips .blip');
      blips.forEach(blip => {
        blip.style.top = (10 + Math.random() * 70) + '%';
        blip.style.left = (10 + Math.random() * 70) + '%';
      });
    }, 3000);
    
    let startTime = null;
    function updateUptime() {
      if (!startTime) startTime = Date.now();
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
      const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
      const s = String(elapsed % 60).padStart(2, '0');
      const el = document.getElementById('uptime');
      if (el) el.textContent = 'UPTIME: ' + h + ':' + m + ':' + s;
    }
    setInterval(updateUptime, 1000);
    
    // =========================================================================
    // ARCADE EXTRAS MODULE – HUD, SFX, themes, terminal, toasts, Konami code
    // =========================================================================
    (function() {
      // Config
      const ARCADE_MISSIONS = [
        { id:'tabs',      text:'Explore 3 panels', done:false },
        { id:'analysis',  text:'Run analysis once', done:false },
        { id:'simulation', text:'Run P&L simulation', done:false },
        { id:'find_invader', text:'Find the hidden invader', done:false },
        { id:'arcade_score', text:'Score 500+ in Signal Invaders', done:false },
        { id:'space_run', text:'Complete a Space Run of 5000+ km', done:false },
        { id:'snoop_master', text:'Trigger 5 access denials', done:false }
      ];
      
      const THEMES = {
        Terminal: { '--phosphor': '#33ff99', '--amber': '#ffb347' },
        Arcade:   { '--phosphor': '#7cff00', '--amber': '#ffd93d' },
        NeonNoir: { '--phosphor': '#7afcff', '--amber': '#ff6fd8' }
      };
      
      // State
      let sfxEnabled = true;
      let tabsVisited = new Set();
      const root = document.documentElement;
      
      // =========================================================================
      // AUDIO SYSTEM — Loaded from js/audio/audio-system.js
      // MechSFX, MechaBGM, getAudioContext, beep exposed via window object
      // =========================================================================
      
      // Toast notifications
      window.showToast = function(message, level = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const div = document.createElement('div');
        div.className = 'toast' + (level !== 'info' ? ' ' + level : '');
        // Use innerHTML to support pixel icon SVGs
        div.innerHTML = message;
        container.appendChild(div);
        requestAnimationFrame(() => div.classList.add('show'));
        setTimeout(() => {
          div.classList.remove('show');
          setTimeout(() => div.remove(), 300);
        }, 2300);
      };
      
      // Terminal log
      window.logTerminal = function(msg) {
        const el = document.getElementById('terminal-log');
        if (!el) return;
        const line = document.createElement('div');
        line.className = 'terminal-log-line';
        const now = new Date();
        const hh = String(now.getHours()).padStart(2,'0');
        const mm = String(now.getMinutes()).padStart(2,'0');
        const ss = String(now.getSeconds()).padStart(2,'0');
        line.innerHTML = '<span class="time">['+hh+':'+mm+':'+ss+']</span> ' + msg;
        el.appendChild(line);
        el.scrollTop = el.scrollHeight;
        // Keep max 50 lines
        while (el.children.length > 50) el.removeChild(el.firstChild);
      };
      
      // Periodic uplink messages
      const uplinkMessages = [
        'uplink stable · packet OK',
        'telemetry sync · nominal',
        'signal lock · holding',
        'data stream · active',
        'quantum link · stable'
      ];
      setInterval(() => {
        const msg = uplinkMessages[Math.floor(Math.random() * uplinkMessages.length)];
        logTerminal(msg);
      }, 7000);
      
      // Missions HUD
      function renderMissions() {
        const hud = document.getElementById('arcade-hud');
        const list = document.getElementById('mission-list');
        if (!hud || !list) return;
        hud.classList.remove('hidden');
        list.innerHTML = ARCADE_MISSIONS.map(m =>
          '<li class="arcade-mission'+(m.done?' completed':'')+'">'+m.text+'</li>'
        ).join('');
      }
      
      window.completeMission = function(id) {
        const mission = ARCADE_MISSIONS.find(m => m.id === id);
        if (!mission || mission.done) return;
        mission.done = true;
        renderMissions();
        showToast('Mission complete: ' + mission.text);
        logTerminal('mission complete · ' + mission.id);
        beep(800, 0.12);
        
        // Check if all missions complete
        if (ARCADE_MISSIONS.every(m => m.done)) {
          setTimeout(() => {
            showToast(PixelIcons.toSvg('trophy', '#ffaa33', 14) + ' ALL MISSIONS COMPLETE!', 'alert');
            beep(1000, 0.15);
          }, 500);
        }
      };
      
      // Theme switching
      function initThemeSelect() {
        const select = document.getElementById('theme-select');
        if (!select) return;
        select.addEventListener('change', () => {
          const theme = THEMES[select.value];
          if (!theme) return;
          Object.entries(theme).forEach(([k,v]) => root.style.setProperty(k, v));
          logTerminal('theme applied · ' + select.value);
          beep(600, 0.07);
        });
      }
      
      // SFX toggle
      function initSfxToggle() {
        const toggle = document.getElementById('sfx-toggle');
        if (!toggle) return;
        sfxEnabled = toggle.checked;
        toggle.addEventListener('change', () => {
          sfxEnabled = toggle.checked;
          logTerminal('sfx ' + (sfxEnabled ? 'enabled' : 'muted'));
        });
      }
      
      // BGM toggle (Epic Anime Mecha Music)
      function initBgmToggle() {
        const toggle = document.getElementById('bgm-toggle');
        if (!toggle) return;
        toggle.addEventListener('change', () => {
          if (toggle.checked) {
            MechaBGM.playLoop();
            showToast('♫ MECHA SORTIE - BGM Active', 'info');
          } else {
            MechaBGM.stop();
            showToast('BGM Stopped', 'info');
          }
        });
      }
      
      // Tab visit tracking
      function initTabTracking() {
        const tabs = document.querySelectorAll('.nav-tab');
        tabs.forEach(btn => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-tab') || btn.textContent.trim();
            tabsVisited.add(id);
            if (tabsVisited.size >= 3) completeMission('tabs');
            beep(500, 0.05);
          });
        });
      }
      
      // Wrap runPnLSimulation for mission tracking
      const originalSimulation = window.runPnLSimulation;
      if (typeof originalSimulation === 'function') {
        window.runPnLSimulation = function() {
          completeMission('simulation');
          logTerminal('P&L simulation executed');
          beep(520, 0.08);
          return originalSimulation.apply(this, arguments);
        };
      }
      
      // Wrap runAnalysis if it exists
      const originalRunAnalysis = window.runAnalysis;
      if (typeof originalRunAnalysis === 'function') {
        window.runAnalysis = function() {
          completeMission('analysis');
          logTerminal('scenario analysis · control panel executed');
          showToast('Analysis fired');
          beep(520, 0.08);
          return originalRunAnalysis.apply(this, arguments);
        };
      }
      
      // Konami code -> activate pixel beam easter egg
      const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
      let konamiIndex = 0;
      
      window.addEventListener('keydown', (e) => {
        const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        const target = KONAMI[konamiIndex].toLowerCase();
        if (key === target) {
          konamiIndex++;
          if (konamiIndex === KONAMI.length) {
            konamiIndex = 0;
            // Activate the pixel beam
            const beam = document.getElementById('pixel-beam');
            const ground = document.getElementById('pixel-ground');
            if (beam) beam.classList.add('active');
            if (ground) ground.classList.add('active');
            completeMission('secret');
            showToast('👾 INVADER DEFENSE GRID UNLOCKED', 'alert');
            logTerminal('konami code accepted · easter egg revealed');
            beep(900, 0.15);
          }
        } else {
          konamiIndex = 0;
        }
      });
      
      // Initialize on DOM ready
      function initArcade() {
        initThemeSelect();
        initSfxToggle();
        initBgmToggle();
        initTabTracking();
        renderMissions();
        initAboutOverlay();
        initPipboyDossier();
        initVesselDossier();
        logTerminal('arcade module initialized');
        logTerminal('system ready · awaiting input');
      }
      
      // =========================================================================
      // PIP-BOY TICKER DOSSIER CONTROLLER
      // =========================================================================
      function initPipboyDossier() {
        const overlay = document.getElementById('pipboy-overlay');
        const closeBtn = document.getElementById('pipboy-close-btn');
        const dials = document.querySelectorAll('.pipboy-dial');
        
        if (!overlay || !closeBtn) return;
        
        let currentDossierTicker = null;
        
        // Open dossier for a specific ticker
        window.openTickerDossier = function(ticker) {
          const profile = TICKER_PROFILES[ticker];
          if (!profile) {
            logTerminal('ERROR: No dossier found for ' + ticker);
            return;
          }
          
          currentDossierTicker = ticker;
          const color = tickerColors[ticker] || 'var(--phosphor)';
          
          // Update header
          document.getElementById('pipboy-codename').textContent = 'CODENAME: ' + profile.codename;
          const tickerNameEl = document.getElementById('pipboy-ticker-name');
          tickerNameEl.textContent = ticker + ' — ' + profile.name;
          tickerNameEl.style.color = color;
          document.getElementById('pipboy-sector').textContent = profile.sector;
          
          // Update threat level
          const threatEl = document.getElementById('pipboy-threat');
          const threatClass = profile.threat_level.toLowerCase().replace(' ', '');
          threatEl.textContent = profile.threat_level;
          threatEl.className = 'pipboy-threat-level ' + threatClass;
          
          // Update overview panel
          document.getElementById('pipboy-summary').textContent = profile.summary;
          document.getElementById('pipboy-lore').textContent = '"' + profile.lore + '"';
          
          // Update thesis panel
          document.getElementById('pipboy-thesis').textContent = profile.thesis;
          
          // Update catalysts panel
          const catalystsEl = document.getElementById('pipboy-catalysts-list');
          catalystsEl.innerHTML = profile.catalysts.map(cat => `
            <div class="pipboy-catalyst">
              <div class="pipboy-catalyst-date">${cat.date}</div>
              <div class="pipboy-catalyst-event">${cat.event}</div>
              <div class="pipboy-catalyst-impact ${cat.impact.toLowerCase()}">${cat.impact}</div>
            </div>
          `).join('');
          
          // Update risks panel
          const risksEl = document.getElementById('pipboy-risks-list');
          risksEl.innerHTML = profile.risks.map(risk => `
            <div class="pipboy-risk">${risk}</div>
          `).join('');
          
          // Update vitals panel
          const vitalsEl = document.getElementById('pipboy-vitals-grid');
          vitalsEl.innerHTML = Object.entries(profile.vitals).map(([key, val]) => `
            <div class="pipboy-vital">
              <div class="pipboy-vital-value">${val}</div>
              <div class="pipboy-vital-label">${key.replace(/_/g, ' ')}</div>
            </div>
          `).join('');
          
          // Update stats bar with live data if available
          updatePipboyStats(ticker);
          
          // Reset to overview panel
          dials.forEach(d => d.classList.remove('active'));
          dials[0].classList.add('active');
          document.querySelectorAll('.pipboy-panel').forEach(p => p.classList.remove('active'));
          document.getElementById('panel-overview').classList.add('active');
          
          // Show overlay
          overlay.classList.remove('hidden');
          requestAnimationFrame(() => {
            overlay.classList.add('visible');
          });
          
          logTerminal('DOSSIER ACCESSED: ' + ticker + ' [' + profile.codename + ']');
          beep(523, 0.06);
          setTimeout(() => beep(659, 0.06), 80);
        };
        
        // Update live stats in the stats bar
        function updatePipboyStats(ticker) {
          const statsBar = document.getElementById('pipboy-stats-bar');
          const data = tickerData[ticker];
          
          if (!data) {
            statsBar.innerHTML = `
              <div class="pipboy-stat">
                <div class="pipboy-stat-value">--</div>
                <div class="pipboy-stat-label">Price</div>
              </div>
              <div class="pipboy-stat">
                <div class="pipboy-stat-value">--</div>
                <div class="pipboy-stat-label">Change</div>
              </div>
              <div class="pipboy-stat">
                <div class="pipboy-stat-value">--</div>
                <div class="pipboy-stat-label">Volume</div>
              </div>
              <div class="pipboy-stat">
                <div class="pipboy-stat-value">--</div>
                <div class="pipboy-stat-label">Volatility</div>
              </div>
            `;
            return;
          }
          
          const series = data.daily || data.intraday || [];
          const last = series[series.length - 1] || {};
          const prev = series[series.length - 2] || {};
          
          const price = last.c || 0;
          const change = prev.c ? ((last.c - prev.c) / prev.c * 100) : 0;
          const volume = last.v || 0;
          const vol = getVolScoreForTicker(ticker) || 0;
          
          const changeClass = change >= 0 ? 'positive' : 'negative';
          const changeSign = change >= 0 ? '+' : '';
          
          statsBar.innerHTML = `
            <div class="pipboy-stat">
              <div class="pipboy-stat-value">$${price.toFixed(2)}</div>
              <div class="pipboy-stat-label">Price</div>
            </div>
            <div class="pipboy-stat">
              <div class="pipboy-stat-value ${changeClass}">${changeSign}${change.toFixed(2)}%</div>
              <div class="pipboy-stat-label">Change</div>
            </div>
            <div class="pipboy-stat">
              <div class="pipboy-stat-value">${formatVolume(volume)}</div>
              <div class="pipboy-stat-label">Volume</div>
            </div>
            <div class="pipboy-stat">
              <div class="pipboy-stat-value">${vol.toFixed(1)}σ</div>
              <div class="pipboy-stat-label">Volatility</div>
            </div>
          `;
        }
        
        function formatVolume(v) {
          if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
          if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
          if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
          return v.toString();
        }
        
        // Close dossier
        function closeDossier() {
          overlay.classList.remove('visible');
          setTimeout(() => overlay.classList.add('hidden'), 200);
          beep(330, 0.05);
          logTerminal('dossier closed');
        }
        
        closeBtn.addEventListener('click', closeDossier);
        
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay || e.target.classList.contains('pipboy-backdrop')) {
            closeDossier();
          }
        });
        
        window.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && overlay.classList.contains('visible')) {
            closeDossier();
          }
        });
        
        // Dial navigation
        dials.forEach(dial => {
          dial.addEventListener('click', () => {
            const panel = dial.dataset.panel;
            
            dials.forEach(d => d.classList.remove('active'));
            dial.classList.add('active');
            
            document.querySelectorAll('.pipboy-panel').forEach(p => p.classList.remove('active'));
            document.getElementById('panel-' + panel).classList.add('active');
            
            beep(440, 0.04);
          });
        });
        
        // Keyboard navigation with left/right arrows
        window.addEventListener('keydown', (e) => {
          if (!overlay.classList.contains('visible')) return;
          
          const dialArr = Array.from(dials);
          const activeIdx = dialArr.findIndex(d => d.classList.contains('active'));
          
          if (e.key === 'ArrowRight' && activeIdx < dialArr.length - 1) {
            dialArr[activeIdx + 1].click();
          } else if (e.key === 'ArrowLeft' && activeIdx > 0) {
            dialArr[activeIdx - 1].click();
          }
        });
        
        // Wire up watchlist items to open dossier on double-click or info button
        document.querySelectorAll('.watchlist-item').forEach(item => {
          const tickerEl = item.querySelector('.watchlist-ticker');
          if (!tickerEl) return;
          
          const ticker = tickerEl.textContent.trim();
          
          // Add info button
          const infoBtn = document.createElement('button');
          infoBtn.className = 'watchlist-info-btn';
          infoBtn.innerHTML = '◉';
          infoBtn.title = 'Open Dossier';
          infoBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openTickerDossier(ticker);
          });
          
          // Insert before the ticker name or at the start
          const wrapper = item.querySelector('.watchlist-info') || item;
          wrapper.style.position = 'relative';
          item.insertBefore(infoBtn, item.firstChild);
        });
        
        logTerminal('pip-boy dossier system initialized');
      }
      
      // =========================================================================
      // VESSEL DOSSIER CONTROLLER — (DEPRECATED: Now uses unified ShipBrief)
      // =========================================================================
      function initVesselDossier() {
        // If ShipBrief module is loaded, skip legacy vessel dossier
        // ShipBrief provides a unified dialog component across all pages
        if (window.ShipBrief) {
          logTerminal('vessel dossier → using unified ShipBrief module');
          return;
        }
        
        const overlay = document.getElementById('vessel-dossier');
        const closeBtn = document.getElementById('vessel-close-btn');
        const bootOverlay = document.getElementById('vessel-boot');
        const viewChartBtn = document.getElementById('vessel-view-chart');
        
        if (!overlay || !closeBtn) return;
        
        let currentVesselTicker = null;
        
        // Open vessel dossier for a specific ticker
        window.openVesselDossier = function(ticker) {
          const pos = DEMO_STOCK_POSITIONS.find(p => p.ticker === ticker);
          if (!pos) {
            logTerminal('ERROR: No vessel data found for ' + ticker);
            return;
          }
          
          currentVesselTicker = ticker;
          const color = tickerColors[ticker] || '#33ff99';
          const profile = TICKER_PROFILES[ticker] || {};
          const shipInfo = SHIP_NAMES[ticker] || { name: ticker, designation: 'UNK-XXX' };
          const sector = tickerThemes[ticker] || 'UNKNOWN';
          const spritePath = SHIP_SPRITES[ticker] || DEFAULT_SHIP_SPRITE;
          
          // Calculate ship stats
          const value = pos.shares * pos.current_price;
          const pnl = (pos.current_price - pos.entry_price) * pos.shares;
          const pnlPct = ((pos.current_price - pos.entry_price) / pos.entry_price * 100);
          const totalShares = DEMO_STOCK_POSITIONS.reduce((s, p) => s + p.shares, 0);
          
          // Map to ship type
          const shipMeta = mapTickerToPixelShip(ticker, sector, pnlPct);
          const shipLore = PIXEL_SHIP_LORE[shipMeta.pattern] || PIXEL_SHIP_LORE.drone;
          
          // Calculate status bars
          const hullHealth = Math.max(10, Math.min(100, 50 + pnlPct * 2));
          const cargoPercent = Math.round((pos.shares / totalShares) * 100);
          const fuelPercent = Math.max(10, Math.min(100, Math.random() * 40 + 60));
          const isOperational = pnlPct >= 0;
          
          // Set CSS custom property for ship color
          overlay.style.setProperty('--ship-color', color);
          
          // Update ship visual
          const shipImg = document.getElementById('vessel-ship-img');
          shipImg.src = spritePath;
          shipImg.alt = ticker + ' vessel';
          
          // Update identity section
          document.getElementById('vessel-ticker').textContent = ticker;
          document.getElementById('vessel-ticker').style.color = color;
          document.getElementById('vessel-name').textContent = shipInfo.name;
          document.getElementById('vessel-designation').textContent = shipInfo.designation;
          document.getElementById('vessel-sector').textContent = sector.toUpperCase();
          
          // Update class badge
          const classBadge = document.getElementById('vessel-class');
          classBadge.textContent = shipLore.label;
          classBadge.style.color = color;
          classBadge.style.borderColor = color;
          
          // Update HUD message
          const hudText = document.querySelector('.vessel-hud-text');
          hudText.textContent = shipLore.hud;
          
          // Update status bars (initially at 0 for animation)
          const hullBar = document.getElementById('vessel-hull-bar');
          const cargoBar = document.getElementById('vessel-cargo-bar');
          const fuelBar = document.getElementById('vessel-fuel-bar');
          
          hullBar.style.width = '0%';
          cargoBar.style.width = '0%';
          fuelBar.style.width = '0%';
          
          document.getElementById('vessel-hull-val').textContent = hullHealth.toFixed(0) + '%';
          document.getElementById('vessel-cargo-val').textContent = pos.shares + ' UNITS';
          document.getElementById('vessel-fuel-val').textContent = fuelPercent.toFixed(0) + '%';
          
          // Update hull bar damage state
          hullBar.classList.toggle('damaged', !isOperational);
          
          // Update operations data
          document.getElementById('vessel-value').textContent = '$' + value.toLocaleString();
          
          const pnlEl = document.getElementById('vessel-pnl');
          pnlEl.textContent = (pnl >= 0 ? '+' : '') + '$' + Math.abs(pnl).toFixed(0);
          pnlEl.className = 'vessel-ops-value ' + (pnl >= 0 ? 'positive' : 'negative');
          
          const returnEl = document.getElementById('vessel-return');
          returnEl.textContent = (pnlPct >= 0 ? '+' : '') + pnlPct.toFixed(1) + '%';
          returnEl.className = 'vessel-ops-value ' + (pnlPct >= 0 ? 'positive' : 'negative');
          
          const missionEl = document.getElementById('vessel-mission');
          missionEl.textContent = isOperational ? 'OPERATIONAL' : 'DAMAGED';
          missionEl.className = 'vessel-ops-value status-' + (isOperational ? 'operational' : 'damaged');
          
          // Update lore
          document.getElementById('vessel-lore').textContent = shipLore.lore;
          
          // Reset boot overlay
          bootOverlay.classList.remove('done');
          
          // Reset section animations by forcing reflow
          const sections = overlay.querySelectorAll('.vessel-section');
          sections.forEach(s => {
            s.style.animation = 'none';
            s.offsetHeight; // Force reflow
            s.style.animation = '';
          });
          
          // Show overlay
          overlay.classList.remove('hidden');
          requestAnimationFrame(() => {
            overlay.classList.add('visible');
          });
          
          // Play boot sound
          beep(220, 0.1);
          setTimeout(() => beep(330, 0.08), 100);
          setTimeout(() => beep(440, 0.08), 200);
          
          // Boot animation sequence
          setTimeout(() => {
            bootOverlay.classList.add('done');
            // Now animate the bars
            setTimeout(() => {
              hullBar.style.width = hullHealth + '%';
              cargoBar.style.width = cargoPercent + '%';
              fuelBar.style.width = fuelPercent + '%';
              beep(523, 0.05);
            }, 200);
          }, 700);
          
          logTerminal('VESSEL DOSSIER: ' + ticker + ' [' + shipInfo.name + '] accessed');
        };
        
        // Close vessel dossier
        window.closeVesselDossier = function() {
          overlay.classList.remove('visible');
          setTimeout(() => {
            overlay.classList.add('hidden');
            currentVesselTicker = null;
          }, 300);
          beep(330, 0.05);
          logTerminal('vessel dossier closed');
        };
        
        // Event listeners
        closeBtn.addEventListener('click', closeVesselDossier);
        
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay || e.target.classList.contains('vessel-backdrop')) {
            closeVesselDossier();
          }
        });
        
        window.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && overlay.classList.contains('visible')) {
            closeVesselDossier();
          }
        });
        
        // View Telemetry button - go to chart
        if (viewChartBtn) {
          viewChartBtn.addEventListener('click', () => {
            if (currentVesselTicker) {
              closeVesselDossier();
              setTimeout(() => {
                selectTicker(currentVesselTicker);
                switchTab('chart');
              }, 200);
            }
          });
        }
        
        logTerminal('vessel dossier system initialized');
      }
      
      // About Overlay Controller
      function initAboutOverlay() {
        const overlay = document.getElementById('about-overlay');
        const trigger = document.getElementById('about-trigger-btn');
        const closeBtn = document.getElementById('about-close-btn');

        if (!overlay || !trigger || !closeBtn) return;

        function openAbout() {
          overlay.classList.remove('hidden');
          requestAnimationFrame(() => {
            overlay.classList.add('visible');
          });
          logTerminal('about overlay opened · simulation dossier viewed');
          beep(440, 0.08);
        }

        function closeAbout() {
          overlay.classList.remove('visible');
          setTimeout(() => overlay.classList.add('hidden'), 260);
          beep(330, 0.06);
        }

        trigger.addEventListener('click', openAbout);
        closeBtn.addEventListener('click', closeAbout);

        overlay.addEventListener('click', (e) => {
          if (e.target === overlay || e.target.classList.contains('about-backdrop')) {
            closeAbout();
          }
        });

        window.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && overlay.classList.contains('visible')) {
            closeAbout();
          }
        });
      }
      
      // =========================================================================
      // INVADER ARMY INITIALIZATION
      // =========================================================================
      function initInvaderArmy() {
        const army = document.getElementById('invader-army');
        if (!army) return;

        const spriteSvg = `
          <svg class="invader-sprite-small" viewBox="0 0 11 8">
            <rect x="3" y="0" width="1" height="1" />
            <rect x="7" y="0" width="1" height="1" />
            <rect x="2" y="1" width="1" height="1" />
            <rect x="3" y="1" width="1" height="1" />
            <rect x="4" y="1" width="1" height="1" />
            <rect x="6" y="1" width="1" height="1" />
            <rect x="7" y="1" width="1" height="1" />
            <rect x="8" y="1" width="1" height="1" />
            <rect x="1" y="2" width="1" height="1" />
            <rect x="2" y="2" width="1" height="1" />
            <rect x="3" y="2" width="1" height="1" />
            <rect x="4" y="2" width="1" height="1" />
            <rect x="5" y="2" width="1" height="1" />
            <rect x="6" y="2" width="1" height="1" />
            <rect x="7" y="2" width="1" height="1" />
            <rect x="8" y="2" width="1" height="1" />
            <rect x="9" y="2" width="1" height="1" />
            <rect x="0" y="3" width="1" height="1" />
            <rect x="2" y="3" width="1" height="1" />
            <rect x="3" y="3" width="1" height="1" />
            <rect x="4" y="3" width="1" height="1" />
            <rect x="5" y="3" width="1" height="1" />
            <rect x="6" y="3" width="1" height="1" />
            <rect x="7" y="3" width="1" height="1" />
            <rect x="8" y="3" width="1" height="1" />
            <rect x="10" y="3" width="1" height="1" />
            <rect x="0" y="4" width="1" height="1" />
            <rect x="3" y="4" width="1" height="1" />
            <rect x="7" y="4" width="1" height="1" />
            <rect x="10" y="4" width="1" height="1" />
            <rect x="1" y="5" width="1" height="1" />
            <rect x="2" y="5" width="1" height="1" />
            <rect x="3" y="5" width="1" height="1" />
            <rect x="7" y="5" width="1" height="1" />
            <rect x="8" y="5" width="1" height="1" />
            <rect x="9" y="5" width="1" height="1" />
            <rect x="4" y="6" width="1" height="1" />
            <rect x="5" y="6" width="1" height="1" />
            <rect x="6" y="6" width="1" height="1" />
            <rect x="2" y="7" width="1" height="1" />
            <rect x="3" y="7" width="1" height="1" />
            <rect x="7" y="7" width="1" height="1" />
            <rect x="8" y="7" width="1" height="1" />
          </svg>
        `;

        const rows = 5;
        const invadersPerRow = 10;
        const topOffset = 80;
        const rowSpacing = 45;

        for (let r = 0; r < rows; r++) {
          const row = document.createElement('div');
          row.className = 'invader-row';
          row.style.top = (topOffset + r * rowSpacing) + 'px';

          const marchDuration = 8 + r * 1.2;
          const marchDelay = r * 0.4;
          row.style.animation = `invader-army-march ${marchDuration}s linear ${marchDelay}s infinite alternate`;

          row.innerHTML = new Array(invadersPerRow).fill(spriteSvg).join('');
          army.appendChild(row);
        }
      }

      // =========================================================================
      // COLOR PROFILE CONTROL (Pip-Boy Style)
      // =========================================================================
      function initColorProfileControl() {
        const slider = document.getElementById('color-hue-slider');
        const preview = document.getElementById('color-hue-preview');
        if (!slider || !preview) return;

        const root = document.documentElement;

        function setHue(h) {
          root.style.setProperty('--accent-hue', h);
          preview.style.background = `hsl(${h},100%,60%)`;
          if (typeof logTerminal === 'function') {
            logTerminal(`color profile set · hue ${h}`);
          }
        }

        slider.addEventListener('input', (e) => {
          setHue(e.target.value);
        });

        // Initialize
        setHue(slider.value);
      }

      // =========================================================================
      // HOLOGRAPHIC SHIP PANEL — Loaded from js/data/holo-ships.js
      // =========================================================================

      // =========================================================================
      // TUBE OVERLOAD ON RUN ANALYSIS
      // =========================================================================
      function initTubeOverload() {
        const originalRunAnalysis = window.runAnalysis;
        if (typeof originalRunAnalysis === 'function') {
          window.runAnalysis = function(e) {
            const tubes = document.getElementById('tube-cluster');
            if (tubes) {
              tubes.classList.add('overload');
              setTimeout(() => tubes.classList.remove('overload'), 900);
            }
            return originalRunAnalysis.apply(this, arguments);
          };
        }
      }

      // =========================================================================
      // CLOSE ENCOUNTERS SIGNAL BOARD
      // =========================================================================
      function initEncountersBoard() {
        const lights = [...document.querySelectorAll('.encounters-board .enc-light')];
        const status = document.getElementById('signal-status');
        if (!lights.length || !status) return;

        let userInteracting = false;
        let interactionTimeout;

        function setStatus(text, mode) {
          status.innerHTML = text;
          status.className = 'signal-status ' + mode;
        }

        function updateSignalLevel(value) {
          value = Number(value);
          const activeCount = Math.round((value / 100) * lights.length);

          lights.forEach((l, i) => l.classList.toggle('active', i < activeCount));

          if (value < 20) {
            setStatus("STATIC / NOISE", "noise");
          } else if (value < 80) {
            setStatus("LISTENING…", "");
          } else {
            setStatus(PixelIcons.toSvg('lightning', '#ffaa33', 12) + " COMMS LOCKED " + PixelIcons.toSvg('lightning', '#ffaa33', 12), "locked");
            if (typeof beep === 'function') beep(660, 0.08);
          }
        }

        // Hook into sliders, knobs, etc.
        document.querySelectorAll('input[type="range"]').forEach(slider => {
          slider.addEventListener('input', () => {
            userInteracting = true;
            clearTimeout(interactionTimeout);
            updateSignalLevel(slider.value);
            interactionTimeout = setTimeout(() => { userInteracting = false; }, 3000);
          });
        });

        // Knob clicks also affect signal
        document.querySelectorAll('.knob').forEach(knob => {
          knob.addEventListener('click', () => {
            userInteracting = true;
            clearTimeout(interactionTimeout);
            const val = parseInt(knob.dataset.value) || 50;
            updateSignalLevel(val);
            interactionTimeout = setTimeout(() => { userInteracting = false; }, 3000);
          });
        });

        // Atmospheric idle animation - alien pulse when not interacting
        setInterval(() => {
          if (userInteracting) return;
          const random = Math.floor(Math.random() * 100);
          updateSignalLevel(random);
        }, 1200);

        logTerminal('encounters signal array online');
      }

      // =========================================================================
      // CARGO BAY HEALTH SYSTEM
      // =========================================================================
      const CARGO_SYSTEMS = {
        'RKLB': { name: 'NAV THRUSTERS', critical: true },
        'LUNR': { name: 'SOLAR ARRAY', critical: true },
        'JOBY': { name: 'EVTOL DECK', critical: false },
        'ASTS': { name: 'COMMS RELAY', critical: true },
        'ACHR': { name: 'LIFT JETS', critical: false },
        'EVEX': { name: 'SUPPORT DRONE', critical: false },
        'BKSY': { name: 'OPTICS BAY', critical: false },
        'GME': { name: 'POWER CORE', critical: true }
      };

      function updateCargoHealth(ticker, pnl) {
        const item = document.querySelector(`.cargo-item[data-ticker="${ticker}"]`);
        if (!item) return;

        const health = item.querySelector('.cargo-health');
        item.classList.remove('damaged', 'optimal');

        if (pnl < -5) {
          item.classList.add('damaged');
          health.textContent = "CRITICAL";
        } else if (pnl < 0) {
          item.classList.add('damaged');
          health.textContent = "FAULT";
        } else if (pnl > 10) {
          item.classList.add('optimal');
          health.textContent = "OPTIMAL+";
        } else if (pnl > 0) {
          item.classList.add('optimal');
          health.textContent = "OPTIMAL";
        } else {
          health.textContent = "NOMINAL";
        }
      }

      function initCargoBay() {
        // Update cargo bay based on demo positions
        if (typeof DEMO_STOCK_POSITIONS !== 'undefined') {
          DEMO_STOCK_POSITIONS.forEach(pos => {
            const pnlPct = ((pos.current_price - pos.entry_price) / pos.entry_price) * 100;
            updateCargoHealth(pos.ticker, pnlPct);
          });
        }
        logTerminal('cargo bay manifest synchronized');
      }

      // =========================================================================
      // TRAJECTORY NAVIGATOR (Derivatives Path Simulator)
      // =========================================================================
      function initTrajectoryCanvas() {
        const canvas = document.getElementById('trajectory-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        // Set actual canvas size
        function resizeCanvas() {
          const rect = canvas.getBoundingClientRect();
          canvas.width = rect.width * window.devicePixelRatio;
          canvas.height = rect.height * window.devicePixelRatio;
          ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        }
        
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Star field with more variety
        const stars = [];
        for (let i = 0; i < 60; i++) {
          stars.push({
            x: Math.random() * 100,
            y: Math.random() * 100,
            size: Math.random() * 1.5 + 0.5,
            alpha: Math.random() * 0.5 + 0.2,
            twinkle: Math.random() * Math.PI * 2,
            twinkleSpeed: Math.random() * 0.02 + 0.01
          });
        }

        let risk = 0.5;
        let horizon = 0.5;
        let phase = 0;

        const hue = () => getComputedStyle(document.documentElement).getPropertyValue('--accent-hue') || 150;

        function drawTrajectory() {
          const w = canvas.getBoundingClientRect().width;
          const h = canvas.getBoundingClientRect().height;
          
          ctx.clearRect(0, 0, w, h);
          
          // Background gradient
          const bg = ctx.createLinearGradient(0, 0, 0, h);
          bg.addColorStop(0, "#020813");
          bg.addColorStop(1, "#000408");
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, w, h);

          // Draw twinkling stars
          stars.forEach(star => {
            star.twinkle += star.twinkleSpeed;
            const flicker = 0.5 + Math.sin(star.twinkle) * 0.3;
            ctx.beginPath();
            ctx.arc(star.x / 100 * w, star.y / 100 * h, star.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(140, 255, 210, ${star.alpha * flicker})`;
            ctx.fill();
          });

          // Grid lines
          ctx.strokeStyle = `hsla(${hue()}, 100%, 60%, 0.12)`;
          ctx.lineWidth = 0.4;
          for (let x = 0; x < w; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
          }
          for (let y = 0; y < h; y += 30) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
          }

          // Key positions
          const baseY = h * 0.75;
          const apexX = w * 0.08;
          const apexY = h * 0.25;
          const spread = 30 + risk * 60;
          const horizonStretch = 40 + horizon * 90;
          const riskBend = risk * 70;

          // "Safe corridor" cone
          ctx.beginPath();
          ctx.moveTo(apexX, baseY);
          ctx.lineTo(w - spread, apexY - 12);
          ctx.lineTo(w - spread, apexY + 24);
          ctx.closePath();

          const coneGrad = ctx.createLinearGradient(apexX, baseY, w, apexY);
          coneGrad.addColorStop(0, `hsla(${hue()}, 100%, 60%, 0.15)`);
          coneGrad.addColorStop(1, `hsla(${hue()}, 100%, 60%, 0)`);
          ctx.fillStyle = coneGrad;
          ctx.fill();

          // Ghost "alternative" path (dashed)
          ctx.beginPath();
          ctx.lineWidth = 1;
          ctx.moveTo(apexX, baseY);
          ctx.bezierCurveTo(
            w * 0.35, baseY - riskBend * 0.3,
            w * 0.65, baseY - riskBend * 0.1,
            w - horizonStretch * 0.7, apexY + 20
          );
          ctx.setLineDash([6, 6]);
          ctx.strokeStyle = `hsla(${hue()}, 100%, 65%, 0.35)`;
          ctx.stroke();
          ctx.setLineDash([]);

          // Main trajectory line
          ctx.beginPath();
          ctx.lineWidth = 2.5;
          ctx.moveTo(apexX, baseY);
          
          // Bezier curve with animated wobble
          const wobble = Math.sin(phase * 0.03) * 8;
          ctx.bezierCurveTo(
            w * 0.35, baseY - riskBend + wobble,
            w * 0.65, baseY - riskBend * 0.6 - wobble * 0.5,
            w - horizonStretch, apexY + 10
          );

          // Color by risk
          let pathColor;
          if (risk > 0.7) {
            pathColor = "#ff6b6b";
          } else if (risk < 0.35) {
            pathColor = `hsl(${hue()}, 100%, 60%)`;
          } else {
            pathColor = "#ffb347";
          }
          
          ctx.strokeStyle = pathColor;
          ctx.shadowColor = pathColor;
          ctx.shadowBlur = 10;
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Waypoints
          function drawWaypoint(x, y, label, isActive) {
            // Outer ring
            ctx.beginPath();
            ctx.arc(x, y, isActive ? 8 : 5, 0, Math.PI * 2);
            ctx.strokeStyle = `hsla(${hue()}, 100%, 60%, 0.6)`;
            ctx.lineWidth = 1;
            ctx.stroke();
            
            // Inner dot
            ctx.beginPath();
            ctx.arc(x, y, isActive ? 4 : 3, 0, Math.PI * 2);
            ctx.fillStyle = `hsl(${hue()}, 100%, 60%)`;
            ctx.shadowColor = `hsl(${hue()}, 100%, 60%)`;
            ctx.shadowBlur = isActive ? 12 : 6;
            ctx.fill();
            ctx.shadowBlur = 0;

            // Label
            ctx.font = "10px 'IBM Plex Mono', monospace";
            ctx.fillStyle = `hsla(${hue()}, 100%, 75%, 0.9)`;
            ctx.fillText(label, x + 10, y - 6);
          }

          drawWaypoint(apexX, baseY, "NOW", true);
          drawWaypoint(w - horizonStretch, apexY + 10, "EXPIRY", false);

          // Ship marker moving along path
          const t = Math.min(1, Math.max(0, horizon * 0.8 + 0.1));
          const shipX = apexX + (w - horizonStretch - apexX) * t;
          const shipY = baseY - riskBend * t + Math.sin(phase * 0.05) * 3;

          ctx.save();
          ctx.translate(shipX, shipY);
          ctx.rotate(-0.3); // Slight angle
          
          // Ship triangle
          ctx.beginPath();
          ctx.moveTo(0, -6);
          ctx.lineTo(-5, 6);
          ctx.lineTo(5, 6);
          ctx.closePath();
          ctx.fillStyle = `hsl(${hue()}, 100%, 75%)`;
          ctx.shadowColor = `hsl(${hue()}, 100%, 60%)`;
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
          
          // Engine glow
          ctx.beginPath();
          ctx.moveTo(-3, 6);
          ctx.lineTo(0, 10 + Math.random() * 4);
          ctx.lineTo(3, 6);
          ctx.closePath();
          ctx.fillStyle = risk > 0.5 ? "#ffb347" : `hsl(${hue()}, 100%, 60%)`;
          ctx.fill();
          
          ctx.restore();

          // Status text
          const statusEl = document.getElementById("traj-risk");
          if (statusEl) {
            if (risk > 0.7) {
              statusEl.textContent = "HIGH";
              statusEl.style.color = "#ff6b6b";
            } else if (risk < 0.35) {
              statusEl.textContent = "LOW";
              statusEl.style.color = `hsl(${hue()}, 100%, 60%)`;
            } else {
              statusEl.textContent = "MODERATE";
              statusEl.style.color = "#ffb347";
            }
          }

          phase += 1;
        }

        // Animate
        function animate() {
          drawTrajectory();
          requestAnimationFrame(animate);
        }
        animate();

        // Hook into controls
        document.querySelectorAll('input[type="range"]').forEach(slider => {
          slider.addEventListener('input', () => {
            risk = slider.value / 100;
          });
        });

        document.querySelectorAll('.knob').forEach(knob => {
          knob.addEventListener('click', () => {
            const val = parseInt(knob.dataset.value) || 45;
            horizon = val / 100;
          });
        });

        logTerminal('trajectory navigator online — cinematic mode enabled');
      }
      
      // Expose to window for tab switching
      window.initTrajectoryCanvas = initTrajectoryCanvas;

      // =========================================================================
      // LORE ENGINE - Random In-World Events
      // =========================================================================
      const LORE_EVENTS = [
        "Unknown beacon pinged portside array.",
        "Telemetry drift corrected automatically.",
        "Cargo handlers report minor anomalies.",
        "Charts updated to reflect stellar winds.",
        "Crew reports strange vibrations in deck 3.",
        "AI suggests caution in derivatives bay.",
        "Solar flare activity detected — shields nominal.",
        "Quantum entanglement stable at 99.7%.",
        "Navigation computer recalibrating...",
        "Distant signal classified as potential artificial.",
        "Life support cycling — all systems green.",
        "Hull integrity scan complete. No breaches.",
        "Spectral analysis of nearby object complete.",
        "FTL drive cooling cycle initiated.",
        "Crew morale index: NOMINAL.",
        "Market anomaly detected in sector 7-G.",
        "Thermal signature identified — classifying...",
        "Backup power reserves at 94%.",
        "Long-range sensors detect movement.",
        "Docking bay pressure equalized.",
        "Encrypted transmission received. Decoding...",
        "Asteroid field mapped. Course adjusted.",
        "Bio-scanner reports all crew accounted for.",
        "Reactor output stable at 87%.",
        "External cameras detect debris field ahead."
      ];

      function initLoreEngine() {
        setInterval(() => {
          const event = LORE_EVENTS[Math.floor(Math.random() * LORE_EVENTS.length)];
          if (typeof logTerminal === 'function') {
            logTerminal(event);
          }
        }, 18000); // Every 18 seconds

        // Initial lore message
        setTimeout(() => {
          logTerminal('Lore engine initialized. Monitoring all frequencies.');
        }, 2000);
      }

      // =========================================================================
      // AMBIENT PARTICLES
      // =========================================================================
      function initAmbientParticles() {
        const container = document.getElementById('ambient-particles');
        if (!container) return;

        const particleCount = 15;
        
        for (let i = 0; i < particleCount; i++) {
          const particle = document.createElement('div');
          particle.className = 'particle';
          particle.style.left = Math.random() * 100 + '%';
          particle.style.animationDelay = Math.random() * 15 + 's';
          particle.style.animationDuration = (12 + Math.random() * 8) + 's';
          container.appendChild(particle);
        }
      }

      // =========================================================================
      // KONAMI CODE EASTER EGG - INVADER ATTACK
      // =========================================================================
      function initKonamiCode() {
        const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
        let konamiIndex = 0;
        let konamiUnlocked = false;

        document.addEventListener('keydown', (e) => {
          const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
          
          if (key === KONAMI[konamiIndex]) {
            konamiIndex++;
            
            if (konamiIndex === KONAMI.length) {
              konamiIndex = 0;
              if (!konamiUnlocked) {
                triggerInvaderAttack();
                konamiUnlocked = true;
                setTimeout(() => { konamiUnlocked = false; }, 10000);
              }
            }
          } else {
            konamiIndex = 0;
          }
        });
      }

      function triggerInvaderAttack() {
        const overlay = document.getElementById('invader-attack-overlay');
        const flash = document.getElementById('attack-flash');
        if (!overlay) return;

        // Play mech impact sounds
        if (window.MechSFX) {
          MechSFX.impact(0.4);
          setTimeout(() => MechSFX.alert(400, 150, 0.3), 150);
        }

        // Screen flash
        flash.classList.add('flash');
        setTimeout(() => flash.classList.remove('flash'), 150);

        // Toast notification
        if (typeof showToast === 'function') {
          showToast(PixelIcons.toSvg('ufo', '#ff4444', 14) + ' INVADER ATTACK DETECTED!', 'alert');
        }

        // Log to terminal
        if (typeof logTerminal === 'function') {
          logTerminal(PixelIcons.toSvg('warning', '#ffaa33', 12) + ' ALERT: Hostile formation detected! Shields up!');
        }

        // Create invader wave
        overlay.classList.add('active');
        overlay.innerHTML = '';

        const invaderCount = 15;
        const invaderSVG = `<svg viewBox="0 0 11 8" class="attack-invader">
          <rect x="2" y="0" width="1" height="1"/><rect x="8" y="0" width="1" height="1"/>
          <rect x="3" y="1" width="1" height="1"/><rect x="7" y="1" width="1" height="1"/>
          <rect x="2" y="2" width="7" height="1"/>
          <rect x="1" y="3" width="2" height="1"/><rect x="4" y="3" width="3" height="1"/><rect x="8" y="3" width="2" height="1"/>
          <rect x="0" y="4" width="11" height="1"/>
          <rect x="0" y="5" width="1" height="1"/><rect x="2" y="5" width="7" height="1"/><rect x="10" y="5" width="1" height="1"/>
          <rect x="0" y="6" width="1" height="1"/><rect x="2" y="6" width="1" height="1"/><rect x="8" y="6" width="1" height="1"/><rect x="10" y="6" width="1" height="1"/>
          <rect x="3" y="7" width="2" height="1"/><rect x="6" y="7" width="2" height="1"/>
        </svg>`;

        for (let i = 0; i < invaderCount; i++) {
          const wrapper = document.createElement('div');
          wrapper.innerHTML = invaderSVG;
          const invader = wrapper.firstChild;
          invader.style.left = (5 + Math.random() * 90) + '%';
          invader.style.animationDelay = (Math.random() * 2) + 's';
          invader.style.animationDuration = (2 + Math.random() * 2) + 's';
          overlay.appendChild(invader);
        }

        // Clear after animation
        setTimeout(() => {
          overlay.classList.remove('active');
          overlay.innerHTML = '';
          if (typeof logTerminal === 'function') {
            logTerminal('Invader threat neutralized. Shields nominal.');
          }
        }, 5000);

        // Complete arcade mission if available
        if (typeof completeMission === 'function') {
          completeMission('find_invader');
        }
      }

      // =========================================================================
      // MINI-GAMES — Loaded from js/games/mini-games.js
      // SpaceRun exposed via window object
      // =========================================================================

      // =========================================================================
      // ENHANCED EVENTS TIMELINE RENDERING
      // =========================================================================
      function initEnhancedCatalysts() {
        const originalRenderCatalysts = window.renderCatalysts;
        
        window.renderCatalysts = function() {
          const container = document.getElementById('catalyst-list');
          if (!container) return;

          // Gather all catalysts from ticker profiles
          const allCatalysts = [];
          const TICKER_PROFILES = window.TICKER_PROFILES || {};
          
          Object.entries(TICKER_PROFILES).forEach(([ticker, profile]) => {
            if (profile.catalysts) {
              profile.catalysts.forEach(cat => {
                allCatalysts.push({
                  ticker,
                  date: cat.date,
                  event: cat.event,
                  impact: cat.impact || 'medium'
                });
              });
            }
          });

          // Sort by date
          allCatalysts.sort((a, b) => new Date(a.date) - new Date(b.date));

          // Render as timeline
          if (allCatalysts.length > 0) {
            container.innerHTML = '<div class="events-timeline">' + 
              allCatalysts.slice(0, 12).map(cat => {
                const impactClass = cat.impact.toLowerCase() + '-impact';
                const daysUntil = Math.ceil((new Date(cat.date) - new Date()) / (1000 * 60 * 60 * 24));
                const countdownText = daysUntil > 0 ? `T-${daysUntil} DAYS` : daysUntil === 0 ? 'TODAY' : `T+${Math.abs(daysUntil)} DAYS`;
                
                return `
                  <div class="timeline-event ${impactClass}" onclick="if(window.openTickerDossier) openTickerDossier('${cat.ticker}')">
                    <div class="timeline-header">
                      <span class="timeline-ticker">${cat.ticker}</span>
                      <span class="timeline-date">${cat.date}</span>
                    </div>
                    <div class="timeline-title">${cat.event}</div>
                    <div class="timeline-meta">
                      <span class="timeline-countdown">${countdownText}</span>
                      <span class="catalyst-impact ${cat.impact.toLowerCase()}">${cat.impact.toUpperCase()}</span>
                    </div>
                  </div>
                `;
              }).join('') + 
            '</div>';
          } else if (typeof originalRenderCatalysts === 'function') {
            originalRenderCatalysts();
          }
        };
      }

      // =========================================================================
      // BUTTON RIPPLE EFFECT
      // =========================================================================
      function initRippleEffects() {
        document.addEventListener('click', (e) => {
          const button = e.target.closest('.push-btn, .sim-btn, .nav-tab, .chart-tab, .cargo-item');
          if (!button) return;

          const rect = button.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;

          const ripple = document.createElement('span');
          ripple.className = 'ripple';
          ripple.style.left = x + 'px';
          ripple.style.top = y + 'px';

          button.style.position = 'relative';
          button.style.overflow = 'hidden';
          button.appendChild(ripple);

          setTimeout(() => ripple.remove(), 600);
        });
      }

      // Run initializations immediately
      initInvaderArmy();
      initColorProfileControl();
      initAmbientParticles();
      initKonamiCode();
      initRippleEffects();
      
      // SpaceRun loaded from js/games/mini-games.js
      
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initArcade);
        document.addEventListener('DOMContentLoaded', initTubeOverload);
        document.addEventListener('DOMContentLoaded', initEncountersBoard);
        document.addEventListener('DOMContentLoaded', initCargoBay);
        document.addEventListener('DOMContentLoaded', initTrajectoryCanvas);
        document.addEventListener('DOMContentLoaded', initLoreEngine);
        document.addEventListener('DOMContentLoaded', initEnhancedCatalysts);
        document.addEventListener('DOMContentLoaded', () => window.SpaceRun && window.SpaceRun.init());
        document.addEventListener('DOMContentLoaded', () => window.AdminConsole && window.AdminConsole.init());
        
        // Livery system integration - redraw sprites when colors change
        document.addEventListener('paintbay:apply', (e) => {
          if (e.detail?.ticker) {
            console.log(`[APP] Livery applied to ${e.detail.ticker}, triggering sprite refresh`);
            // Refresh hangar display if showing this ship
            if (typeof updateHangarDisplay === 'function') {
              updateHangarDisplay();
            }
          }
        });
        
        // Listen for sprite redraw requests
        document.addEventListener('sprite:redraw', (e) => {
          if (e.detail?.ticker) {
            console.log(`[APP] Sprite redraw requested for ${e.detail.ticker}`);
            // Force hangar refresh
            if (typeof updateHangarDisplay === 'function') {
              updateHangarDisplay();
            }
          }
        });
        
        document.addEventListener('DOMContentLoaded', initConsoleShip);
        document.addEventListener('DOMContentLoaded', initMissionPanel); // Step 4
        document.addEventListener('DOMContentLoaded', initHangarFocusEvents); // Step 5
        document.addEventListener('DOMContentLoaded', () => window.initHangarPanel && window.initHangarPanel()); // Step 6: Living Hangar
      } else {
        initArcade();
        initTubeOverload();
        initEncountersBoard();
        initCargoBay();
        initTrajectoryCanvas();
        initLoreEngine();
        initEnhancedCatalysts();
        window.SpaceRun && window.SpaceRun.init();
        window.AdminConsole && window.AdminConsole.init();
        initConsoleShip();
        initMissionPanel(); // Step 4
        initHangarFocusEvents(); // Step 5
        window.initHangarPanel && window.initHangarPanel(); // Step 6: Living Hangar
      }
    })();
    
    // ═══════════════════════════════════════════════════════════════════
    // STEP 5: HANGAR FOCUS EVENTS (ShipBrief ↔ Fleet Highlight)
    // ═══════════════════════════════════════════════════════════════════
    
    function initHangarFocusEvents() {
      if (!window.FlightScene) return;
      
      // ShipBrief opens → focus that ticker in hangar
      window.addEventListener('shipbrief:open', (e) => {
        const ticker = e.detail?.ticker;
        if (ticker) {
          FlightScene.setFocus(ticker, 0); // Focus until close
        }
      });
      
      // ShipBrief closes → clear focus
      window.addEventListener('shipbrief:close', () => {
        FlightScene.clearFocus();
      });
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // STEP 4: MISSION PANEL (Dashboard Mission Awareness)
    // ═══════════════════════════════════════════════════════════════════
    
    function initMissionPanel() {
      if (!window.MissionBridge) {
        console.warn('[MissionPanel] MissionBridge not loaded');
        return;
      }
      
      // Initial render
      updateMissionPanel();
      
      // Poll every 2 seconds for mission state changes
      setInterval(updateMissionPanel, 2000);
    }
    
    function updateMissionPanel() {
      if (!window.MissionBridge) return;
      
      try {
        const counts = MissionBridge.getCounts();
        const recentCompleted = MissionBridge.getRecentCompleted(3);
        
        // Update active count badge
        const countBadge = document.getElementById('active-mission-count');
        if (countBadge) {
          countBadge.textContent = counts.active;
          countBadge.classList.toggle('zero', counts.active === 0);
        }
        
        // Update summary counts
        const activeCount = document.getElementById('mission-active-count');
        const completeCount = document.getElementById('mission-complete-count');
        if (activeCount) activeCount.textContent = counts.active;
        if (completeCount) completeCount.textContent = counts.complete;
        
        // Update recent missions list
        const recentList = document.getElementById('recent-missions-list');
        if (recentList) {
          if (recentCompleted.length === 0) {
            // Polish: Improved zero state copy
            recentList.innerHTML = '<div class="no-missions">Launch missions to track regime evolution over time.</div>';
          } else {
            recentList.innerHTML = recentCompleted.map(m => {
              const grade = m.outcome?.grade || '?';
              return `
                <div class="recent-mission-item grade-${grade}">
                  <div>
                    <span class="recent-mission-ticker">${m.ticker}</span>
                    <span class="recent-mission-type">${m.typeName || m.type}</span>
                  </div>
                  <span class="recent-mission-grade ${grade}">${grade}</span>
                </div>
              `;
            }).join('');
          }
        }
        
        // Update mission context for selected ticker (if telemetry is showing)
        updateMissionContext();
        
      } catch (e) {
        console.warn('[MissionPanel] Update failed:', e);
      }
    }
    
    /**
     * Update mission context card in telemetry for selected ticker
     */
    function updateMissionContext() {
      if (!window.MissionBridge) return;
      
      const contextContainer = document.getElementById('mission-context-container');
      if (!contextContainer) return;
      
      // Get currently selected ticker from app state
      const ticker = window.currentTicker || null;
      if (!ticker) {
        contextContainer.innerHTML = '<div class="mission-context-none">Select a ticker to see mission context</div>';
        return;
      }
      
      const activeMission = MissionBridge.getActiveForTicker(ticker);
      
      if (!activeMission) {
        contextContainer.innerHTML = `
          <div class="mission-context-none">
            No active mission for ${ticker}
            <br><a href="derivatives.html?ticker=${ticker}" style="color:var(--cyan);font-size:0.65rem;">Launch from Mission Command →</a>
          </div>
        `;
        return;
      }
      
      // Render active mission context
      const progress = MissionBridge.getMissionProgress(activeMission);
      const supports = MissionBridge.getSupportSummary(activeMission);
      const recentLogs = MissionBridge.getRecentLogs(activeMission, 3);
      const stars = PixelIcons.starRating(activeMission.difficulty || 2, 3);
      
      let supportsHtml = '';
      if (supports.length > 0) {
        supportsHtml = `
          <div class="mission-context-supports">
            ${supports.map(s => `<span class="mission-support-badge">${s.ticker} (${s.role})</span>`).join('')}
          </div>
        `;
      }
      
      let logsHtml = '';
      if (recentLogs.length > 0) {
        logsHtml = `
          <div class="mission-context-logs">
            ${recentLogs.map(l => `<div class="mission-context-log">${PixelIcons.replaceEmojis(l.msg)}</div>`).join('')}
          </div>
        `;
      }
      
      const missionIcon = activeMission.icon ? PixelIcons.replaceEmojis(activeMission.icon) : PixelIcons.toSvg('rocket', '#33ff99', 14);
      
      contextContainer.innerHTML = `
        <div class="mission-context-card">
          <div class="mission-context-header">
            <span class="mission-context-type">${missionIcon} ${activeMission.typeName || activeMission.type}</span>
            <span class="mission-context-difficulty">${stars}</span>
          </div>
          <div class="mission-context-progress">
            <div class="mission-context-progress-fill" style="width:${(progress?.progress || 0) * 100}%"></div>
          </div>
          <div class="mission-context-meta">
            <span>${progress?.barsElapsed || 0} / ${activeMission.end?.targetBars || activeMission.duration?.targetBars || '?'} bars</span>
            <span>${progress?.timeRemaining || '--'}</span>
          </div>
          ${supportsHtml}
          ${logsHtml}
          <a href="derivatives.html?ticker=${ticker}" style="color:var(--cyan);font-size:0.65rem;display:block;text-align:center;margin-top:0.5rem;">
            Open Mission Command →
          </a>
        </div>
      `;
    }
    
    /**
     * Get mission badge for a ticker (for fleet display)
     * Returns { type: 'deployed'|'escorting'|'benchmark'|null, label: string }
     */
    function getMissionBadgeForTicker(ticker) {
      if (!window.MissionBridge) return null;
      
      // Check if ticker is XAR (benchmark)
      if (ticker === 'XAR') {
        return { type: 'benchmark', label: 'BENCHMARK' };
      }
      
      // Check if ticker is deployed (has active mission)
      const activeMission = MissionBridge.getActiveForTicker(ticker);
      if (activeMission) {
        return { type: 'deployed', label: 'DEPLOYED' };
      }
      
      // Check if ticker is escorting (assigned as support)
      const supportInfo = MissionBridge.getAssignedSupportForTicker(ticker);
      if (supportInfo) {
        return { type: 'escorting', label: supportInfo.role || 'ESCORTING' };
      }
      
      return null;
    }
    
    // Make getMissionBadgeForTicker available globally for fleet rendering
    window.getMissionBadgeForTicker = getMissionBadgeForTicker;
    
    // ═══════════════════════════════════════════════════════════════════
    // HANGAR BAY :: Ship Selection Modal
    // ═══════════════════════════════════════════════════════════════════
    
    /**
     * Open the Hangar Bay ship selection modal
     * Uses real financial data to generate Mario Kart-style stats
     */
    function openHangarBay() {
      // Check if ShipSelect module is loaded
      if (!window.ShipSelect) {
        console.warn('[Hangar] ShipSelect module not loaded');
        // Fallback: navigate to standalone page
        window.location.href = 'ship-select.html';
        return;
      }
      
      // Get stats data (should be loaded by now)
      const statsData = window.statsData || {};
      
      // Show the modal
      ShipSelect.showShipSelectModal(statsData, (ticker, shipData) => {
        console.log('[Hangar] Ship selected:', ticker, shipData);
        
        // Store selection
        localStorage.setItem('space_capital_selected_ship', ticker);
        
        // Update the current ticker display if available
        if (typeof selectTicker === 'function') {
          selectTicker(ticker);
        } else if (typeof window.selectTicker === 'function') {
          window.selectTicker(ticker);
        }
        
        // Play selection sound if audio system available
        if (window.MechaAudio && MechaAudio.ctx) {
          MechaAudio.playUISound('select');
        }
        
        // Flash notification
        if (typeof showNotification === 'function') {
          showNotification(`${ticker} selected as primary vessel`, 'success');
        }
      });
    }
    
    // Make openHangarBay globally available
    window.openHangarBay = openHangarBay;
    
    /**
     * Get currently selected ship from localStorage
     */
    function getSelectedShip() {
      return localStorage.getItem('space_capital_selected_ship') || null;
    }
    
    window.getSelectedShip = getSelectedShip;
    
    /**
     * HANGAR PANEL - Dense Command Interface
     * Fleet Command sidebar + Framed viewport + Bottom dossier
     * Mobile carousel + Touch swipe + Animated sprites
     */
    let hangarShipIndex = 0;
    let hangarShipList = [];
    let carouselTouchStartX = 0;
    let carouselTouchEndX = 0;
    let heroAnimator = null; // ShipAnimator instance for viewport
    let floatingAnimators = []; // Animators for floating fleet
    
    // Performance mode settings
    const perfModes = {
      full: { animatedSprites: true, fleetFlybys: true, parallax: true, debris: true, scanlines: true },
      balanced: { animatedSprites: true, fleetFlybys: true, parallax: true, debris: true, scanlines: false },
      battery: { animatedSprites: false, fleetFlybys: false, parallax: false, debris: false, scanlines: false }
    };
    let currentPerfMode = 'balanced';
    
    function setPerformanceMode(mode) {
      currentPerfMode = mode;
      const settings = perfModes[mode];
      
      // Update space scene
      if (window.SpaceScene && SpaceScene.setPerformance) {
        SpaceScene.setPerformance(settings);
      }
      
      // Toggle scanlines
      document.body.classList.toggle('no-scanlines', !settings.scanlines);
      
      // Update hero animator - switch between frame animation and static
      if (heroAnimator) {
        if (settings.animatedSprites) {
          heroAnimator.play('idle');
        } else {
          heroAnimator.stop();
          heroAnimator._loadStaticFallback();
        }
      }
      
      // Update floating animators
      floatingAnimators.forEach(anim => {
        if (settings.animatedSprites) {
          anim.play('idle');
        } else {
          anim.stop();
          anim._loadStaticFallback();
        }
      });
      
      // Save preference
      localStorage.setItem('space_capital_perf_mode', mode);
      
      console.log(`[PERF] Mode set to: ${mode}`, settings);
    }
    
    async function initHangarPanel() {
      // Build ship roster if not already done
      if (hangarShipList.length === 0) {
        hangarShipList = await buildHangarShipList();
      }
      
      // Get current selected ship or default to first
      const selectedTicker = getSelectedShip() || (hangarShipList[0]?.ticker || 'RKLB');
      hangarShipIndex = Math.max(0, hangarShipList.findIndex(s => s.ticker === selectedTicker));
      
      // Populate all sections
      populateFleetSidebar();
      populateFloatingFleet();
      populateMobileCarousel();
      
      // Initialize hero ship animator
      initHeroAnimator();
      
      updateHangarDisplay();
      
      // Initialize touch swipe for viewport
      initViewportSwipe();
      
      // Load saved performance mode
      const savedPerfMode = localStorage.getItem('space_capital_perf_mode');
      if (savedPerfMode && perfModes[savedPerfMode]) {
        currentPerfMode = savedPerfMode;
        const selector = document.getElementById('perf-mode-select');
        if (selector) selector.value = savedPerfMode;
        setPerformanceMode(savedPerfMode);
      }
    }
    
    function initHeroAnimator() {
      const animContainer = document.getElementById('hero-ship-container');
      if (!animContainer || !window.ShipAnimator) {
        console.warn('[HANGAR] ShipAnimator not available, using static images');
        return;
      }
      
      const ship = hangarShipList[hangarShipIndex];
      if (!ship) return;
      
      // Destroy old animator
      if (heroAnimator) {
        heroAnimator.destroy();
      }
      
      // Clear container
      animContainer.innerHTML = '';
      
      // Create new animator with frame-by-frame animation
      heroAnimator = new ShipAnimator(ship.ticker, animContainer, {
        autoplay: perfModes[currentPerfMode].animatedSprites,
        defaultAnimation: 'idle',
        preloadAll: true  // Preload all frames for smooth animation
      });
      
      // Style the animated image
      setTimeout(() => {
        const img = animContainer.querySelector('img.ship-sprite');
        if (img) {
          img.style.width = '140px';
          img.style.height = 'auto';
          img.style.filter = 'drop-shadow(0 0 20px var(--phosphor-glow))';
          img.style.imageRendering = 'pixelated';
          img.id = 'hangar-hero-sprite';
        }
      }, 50);
      
      console.log(`[HANGAR] Hero animator initialized for ${ship.ticker}`);
    }
    
    async function buildHangarShipList() {
      const ships = [];
      
      // Ship type mappings from ticker to sprite filename
      const shipTypeMap = {
        'RKLB': 'flagship-ship',
        'LUNR': 'lander-ship',
        'JOBY': 'eVTOL-light-class-ship',
        'ACHR': 'eVTOL-ship',
        'ASTS': 'Communications-Relay-Ship',
        'GME': 'moonshot-ship',
        'BKSY': 'recon-ship',
        'PL': 'scout-ship',
        'KTOS': 'Fighter-Ship',
        'RDW': 'Hauler-ship',
        'RTX': 'Officer-Class-Ship',
        'LHX': 'Drone-ship',
        'GE': 'Stealth-Bomber-ship',
        'COHR': 'Glass-Reflector-ship',
        'EVEX': 'Transport-Ship'
      };
      
      // Ship class mappings
      const shipClassMap = {
        'RKLB': 'FLAGSHIP',
        'LUNR': 'LANDER',
        'GME': 'DREADNOUGHT',
        'ASTS': 'RELAY',
        'JOBY': 'EVTOL',
        'ACHR': 'CARRIER',
        'BKSY': 'DRONE',
        'PL': 'SCOUT',
        'KTOS': 'FIGHTER',
        'RDW': 'HAULER',
        'RTX': 'OFFICER',
        'LHX': 'DRONE',
        'GE': 'STEALTH',
        'COHR': 'REFLECTOR',
        'EVEX': 'TRANSPORT'
      };
      
      // Codename mappings
      const codenameMap = {
        'RKLB': 'ELECTRON',
        'LUNR': 'MOONSHOT',
        'JOBY': 'SKYPORT',
        'ACHR': 'MIDNIGHT',
        'ASTS': 'BLUEBIRD',
        'GME': 'DIAMOND',
        'BKSY': 'BLACKSKY',
        'PL': 'PELICAN',
        'KTOS': 'KRATOS',
        'RDW': 'REDWIRE',
        'RTX': 'RAYTHEON',
        'LHX': 'L3HARRIS',
        'GE': 'VERNOVA',
        'COHR': 'COHERENT',
        'EVEX': 'EVEX'
      };
      
      // Lore mappings
      const loreMap = {
        'RKLB': 'Spearhead command ship. Victory follows in its wake.',
        'LUNR': 'Lunar descent specialist. Hope and precision in equal measure.',
        'JOBY': 'Sky taxi of the future. Vertical freedom.',
        'ACHR': 'Urban air mobility pioneer. The city is now 3D.',
        'ASTS': 'Direct-to-cell satellite constellation. Signal from the void.',
        'GME': 'Meme-forged dreadnought. Refuses to die.',
        'BKSY': 'Eyes in the sky. Watching. Always watching.',
        'PL': 'Earth observation fleet. Data is the new oil.',
        'KTOS': 'Defense systems online. Autonomous and relentless.',
        'RDW': 'Space infrastructure backbone. Quietly essential.',
        'RTX': 'Aerospace titan. When you need it done right.',
        'LHX': 'Multi-domain ops. From seabed to orbit.',
        'GE': 'Energy transition flagship. Powering tomorrow.',
        'COHR': 'Photonics mastery. Light becomes leverage.',
        'EVEX': 'Electric aviation pioneer. Silent thunder.'
      };
      
      // Get ticker profiles and stats
      const profiles = window.tickerProfiles || window.TICKER_PROFILES || {};
      let statsData = {};
      
      if (window.statsData && window.statsData.stats) {
        statsData = window.statsData.stats;
      }
      
      // Priority tickers to show
      const priorityTickers = ['RKLB', 'BKSY', 'ACHR', 'LUNR', 'JOBY', 'ASTS', 'GME', 'PL', 'KTOS', 'RDW'];
      
      for (const ticker of priorityTickers) {
        const profile = profiles[ticker] || {};
        const stats = statsData[ticker] || {};
        const shipType = shipTypeMap[ticker] || 'ship';
        
        // Generate random but consistent stats based on ticker
        const seed = ticker.charCodeAt(0) + ticker.charCodeAt(1);
        const hull = 60 + (seed % 30);
        const cargo = 50 + ((seed * 3) % 45);
        const fuel = 70 + ((seed * 7) % 25);
        
        ships.push({
          ticker,
          name: codenameMap[ticker] || profile.codename || ticker,
          class: shipClassMap[ticker] || 'STANDARD',
          designation: `${shipClassMap[ticker]?.substring(0,3) || 'STD'}-${String(seed % 100).padStart(3, '0')}`,
          sector: profile.sector || 'SPACE SYSTEMS',
          sprite: `assets/ships/${ticker}-${shipType}.png`,
          animatedSprite: `assets/ships/animated/gifs/${ticker}_idle.gif`,
          fallbackSprite: `assets/ships/static/${ticker}-${shipType}.png`,
          value: stats.value || Math.round((stats.current || 10) * (50 + seed % 100)),
          pnl: Math.round((stats.return_1d || (Math.random() * 10 - 3)) * 30),
          pnlPercent: stats.return_1d || (Math.random() * 10 - 3),
          status: (stats.return_1d || 0) >= 0 ? 'OPERATIONAL' : 'CAUTIONARY',
          hull,
          cargo,
          fuel,
          cargoUnits: Math.round(cargo * 2.5),
          lore: loreMap[ticker] || profile.lore || 'Status nominal.'
        });
      }
      
      return ships;
    }
    
    function populateFleetSidebar() {
      const container = document.getElementById('hangar-fleet-list');
      if (!container) return;
      
      container.innerHTML = '';
      
      hangarShipList.forEach((ship, idx) => {
        const card = document.createElement('div');
        card.className = `fleet-ship-card ${idx === hangarShipIndex ? 'active' : ''}`;
        card.onclick = () => selectHangarShip(idx);
        
        const pnlClass = ship.pnl >= 0 ? 'positive' : 'negative';
        const pnlStr = ship.pnl >= 0 ? `+$${ship.pnl}` : `-$${Math.abs(ship.pnl)}`;
        const pnlPctStr = ship.pnlPercent >= 0 ? `+${ship.pnlPercent.toFixed(1)}%` : `${ship.pnlPercent.toFixed(1)}%`;
        
        card.innerHTML = `
          <div>
            <img class="fleet-card-sprite" src="${ship.sprite}" alt="${ship.ticker}" onerror="this.src='${ship.fallbackSprite}'">
            <div class="fleet-card-class">${ship.class}</div>
          </div>
          <div class="fleet-card-info">
            <div class="fleet-card-ticker">${ship.ticker}</div>
            <div class="fleet-card-name">${ship.name} · ${ship.designation}</div>
            <div class="fleet-card-bars">
              <div class="fleet-bar-row">
                <span class="fleet-bar-label">HULL</span>
                <div class="fleet-bar-track"><div class="fleet-bar-fill hull" style="width:${ship.hull}%"></div></div>
                <span class="fleet-bar-val">${ship.hull}%</span>
              </div>
              <div class="fleet-bar-row">
                <span class="fleet-bar-label">CARGO</span>
                <div class="fleet-bar-track"><div class="fleet-bar-fill cargo" style="width:${ship.cargo}%"></div></div>
                <span class="fleet-bar-val">${ship.cargoUnits} UNITS</span>
              </div>
              <div class="fleet-bar-row">
                <span class="fleet-bar-label">FUEL</span>
                <div class="fleet-bar-track"><div class="fleet-bar-fill fuel" style="width:${ship.fuel}%"></div></div>
                <span class="fleet-bar-val">${ship.fuel}%</span>
              </div>
            </div>
          </div>
          <div class="fleet-card-status">
            <span class="fleet-status-badge">● ${ship.status}</span>
            <div class="fleet-card-value">$${ship.value.toLocaleString()}</div>
            <div class="fleet-card-pnl ${pnlClass}">${pnlStr} ${pnlPctStr}</div>
          </div>
        `;
        
        container.appendChild(card);
      });
    }
    
    function populateMobileCarousel() {
      const track = document.getElementById('carousel-track');
      const indicators = document.getElementById('carousel-indicators');
      if (!track || !indicators) return;
      
      track.innerHTML = '';
      indicators.innerHTML = '';
      
      hangarShipList.forEach((ship, idx) => {
        // Ship card
        const card = document.createElement('div');
        card.className = `carousel-ship-card ${idx === hangarShipIndex ? 'active' : ''}`;
        card.onclick = () => selectHangarShip(idx);
        card.dataset.index = idx;
        
        const pnlClass = ship.pnl >= 0 ? 'positive' : 'negative';
        const pnlStr = ship.pnl >= 0 ? `+$${ship.pnl}` : `-$${Math.abs(ship.pnl)}`;
        
        card.innerHTML = `
          <img class="carousel-ship-sprite" src="${ship.sprite}" alt="${ship.ticker}" onerror="this.src='${ship.fallbackSprite}'">
          <div class="carousel-ship-ticker">${ship.ticker}</div>
          <div class="carousel-ship-class">${ship.class}</div>
          <div class="carousel-ship-pnl ${pnlClass}">${pnlStr}</div>
        `;
        
        track.appendChild(card);
        
        // Indicator dot
        const dot = document.createElement('div');
        dot.className = `carousel-dot ${idx === hangarShipIndex ? 'active' : ''}`;
        dot.onclick = () => {
          selectHangarShip(idx);
          scrollCarouselTo(idx);
        };
        indicators.appendChild(dot);
      });
      
      // Touch swipe handlers for carousel
      track.addEventListener('touchstart', (e) => {
        carouselTouchStartX = e.changedTouches[0].screenX;
      }, { passive: true });
      
      track.addEventListener('touchend', (e) => {
        carouselTouchEndX = e.changedTouches[0].screenX;
        handleCarouselSwipe();
      }, { passive: true });
    }
    
    function handleCarouselSwipe() {
      const diff = carouselTouchStartX - carouselTouchEndX;
      const threshold = 50;
      
      if (Math.abs(diff) > threshold) {
        if (diff > 0) {
          carouselNext();
        } else {
          carouselPrev();
        }
      }
    }
    
    function scrollCarouselTo(index) {
      const track = document.getElementById('carousel-track');
      const card = track?.querySelector(`[data-index="${index}"]`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
    
    function carouselNext() {
      const newIndex = (hangarShipIndex + 1) % hangarShipList.length;
      selectHangarShip(newIndex);
      scrollCarouselTo(newIndex);
    }
    
    function carouselPrev() {
      const newIndex = (hangarShipIndex - 1 + hangarShipList.length) % hangarShipList.length;
      selectHangarShip(newIndex);
      scrollCarouselTo(newIndex);
    }
    
    window.carouselNext = carouselNext;
    window.carouselPrev = carouselPrev;
    
    // Touch swipe for main viewport
    function initViewportSwipe() {
      const viewport = document.getElementById('hangar-ship-viewport');
      if (!viewport) return;
      
      let touchStartX = 0;
      
      viewport.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
      }, { passive: true });
      
      viewport.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;
        const threshold = 50;
        
        if (Math.abs(diff) > threshold) {
          if (diff > 0) {
            cycleHangarShip(1);
          } else {
            cycleHangarShip(-1);
          }
        }
      }, { passive: true });
    }
    
    function populateFloatingFleet() {
      const container = document.getElementById('hangar-floating-fleet');
      if (!container) return;
      
      container.innerHTML = '';
      
      // Destroy old floating animators
      floatingAnimators.forEach(a => a.destroy());
      floatingAnimators = [];
      
      // Create formation: 1 top, 2 middle, 1 bottom
      const formation = [
        [hangarShipList[0]],
        [hangarShipList[1], hangarShipList[2]],
        [hangarShipList[3]]
      ];
      
      formation.forEach((row, rowIdx) => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'floating-ship-row';
        
        row.forEach((ship, shipIdx) => {
          if (!ship) return;
          
          const shipDiv = document.createElement('div');
          shipDiv.className = 'floating-ship';
          shipDiv.onclick = () => {
            const idx = hangarShipList.findIndex(s => s.ticker === ship.ticker);
            if (idx >= 0) selectHangarShip(idx);
          };
          
          // Create animator container
          const animContainer = document.createElement('div');
          animContainer.className = 'floating-ship-anim';
          animContainer.dataset.ticker = ship.ticker;
          shipDiv.appendChild(animContainer);
          
          // Add label
          const label = document.createElement('span');
          label.className = 'floating-ship-label';
          label.textContent = ship.class;
          shipDiv.appendChild(label);
          
          rowDiv.appendChild(shipDiv);
          
          // Create animator for this floating ship
          if (window.ShipAnimator && perfModes[currentPerfMode].animatedSprites) {
            const anim = new ShipAnimator(ship.ticker, animContainer, {
              autoplay: true,
              defaultAnimation: 'idle'
            });
            // Style the floating ship
            const img = animContainer.querySelector('img');
            if (img) {
              img.style.width = '64px';
              img.style.height = '64px';
              img.style.objectFit = 'contain';
              img.classList.add('floating-ship-sprite');
            }
            floatingAnimators.push(anim);
          } else {
            // Fallback to static image
            animContainer.innerHTML = `<img class="floating-ship-sprite" src="${ship.sprite}" alt="${ship.ticker}" onerror="this.src='${ship.fallbackSprite}'">`;
          }
        });
        
        container.appendChild(rowDiv);
      });
    }
    
    function selectHangarShip(index) {
      const previousIndex = hangarShipIndex;
      hangarShipIndex = index;
      
      // Trigger special animation on selection
      if (heroAnimator && previousIndex !== index) {
        heroAnimator.triggerSpecial();
      }
      
      updateHangarDisplay();
      
      // Update sidebar active states
      document.querySelectorAll('.fleet-ship-card').forEach((el, idx) => {
        el.classList.toggle('active', idx === index);
      });
      
      // Update carousel active states
      document.querySelectorAll('.carousel-ship-card').forEach((el, idx) => {
        el.classList.toggle('active', idx === index);
      });
      document.querySelectorAll('.carousel-dot').forEach((el, idx) => {
        el.classList.toggle('active', idx === index);
      });
      
      // Store selection
      const ship = hangarShipList[index];
      if (ship) {
        localStorage.setItem('space_capital_selected_ship', ship.ticker);
        window.currentHangarTicker = ship.ticker;
        
        // Update global ticker selection if available
        if (typeof selectTicker === 'function') {
          selectTicker(ship.ticker);
        }
        
        // Initialize ship behavior system
        if (window.ShipBehaviorBridge) {
          setTimeout(() => ShipBehaviorBridge.initHangarHero(), 150);
        }
        
        // Emit selection event for other systems
        document.dispatchEvent(new CustomEvent('hangar:shipSelected', {
          detail: { ticker: ship.ticker, index }
        }));
      }
      
      // Play UI sound
      if (window.MechaAudio && MechaAudio.ctx) {
        MechaAudio.playUISound('blip');
      }
    }
    
    function cycleHangarShip(direction) {
      const newIndex = (hangarShipIndex + direction + hangarShipList.length) % hangarShipList.length;
      selectHangarShip(newIndex);
      scrollCarouselTo(newIndex);
    }
    
    function updateHangarDisplay() {
      const ship = hangarShipList[hangarShipIndex];
      if (!ship) return;
      
      // Update hero animator to new ship
      const animContainer = document.getElementById('hero-ship-container');
      
      if (animContainer && window.ShipAnimator) {
        // Check if we need to create a new animator for a different ship
        if (!heroAnimator || heroAnimator.ticker !== ship.ticker) {
          if (heroAnimator) {
            heroAnimator.destroy();
          }
          
          animContainer.innerHTML = '';
          
          heroAnimator = new ShipAnimator(ship.ticker, animContainer, {
            autoplay: perfModes[currentPerfMode].animatedSprites,
            defaultAnimation: 'idle',
            preloadAll: true
          });
          
          // Style after a brief delay to ensure image is created
          setTimeout(() => {
            const img = animContainer.querySelector('img.ship-sprite');
            if (img) {
              img.style.width = '140px';
              img.style.height = 'auto';
              img.style.filter = 'drop-shadow(0 0 20px var(--phosphor-glow))';
              img.style.imageRendering = 'pixelated';
            }
          }, 50);
          
          console.log(`[HANGAR] Switched to ${ship.ticker} with frame animation`);
        }
        
        // NEW: Start idle animation on the hero ship container
        if (window.ShipIdleAnimation) {
          ShipIdleAnimation.attachToHeroShip(animContainer, {
            ticker: ship.ticker,
            class: ship.class
          });
        }
      } else if (animContainer) {
        // Fallback: use static image if ShipAnimator not available
        const staticPath = ship.sprite;
        animContainer.innerHTML = `<img class="ship-sprite" src="${staticPath}" alt="${ship.ticker}" style="width:140px;height:auto;image-rendering:pixelated;">`;
        
        // Still apply idle animation to static sprite
        if (window.ShipIdleAnimation) {
          setTimeout(() => {
            ShipIdleAnimation.attachToHeroShip(animContainer, {
              ticker: ship.ticker,
              class: ship.class
            });
          }, 50);
        }
      }
      
      // Update viewport labels
      const callsign = document.getElementById('hangar-callsign');
      const shipClass = document.getElementById('hangar-class');
      const lore = document.getElementById('hangar-lore');
      
      if (callsign) callsign.textContent = ship.ticker;
      if (shipClass) shipClass.textContent = ship.class;
      if (lore) lore.textContent = ship.lore;
      
      // Update dossier panel
      const dossierImg = document.getElementById('dossier-ship-img');
      const dossierBadge = document.getElementById('dossier-class-badge');
      const dossierTicker = document.getElementById('dossier-ticker');
      const dossierName = document.getElementById('dossier-name');
      const dossierDesig = document.getElementById('dossier-designation');
      const dossierHull = document.getElementById('dossier-hull');
      const dossierCargo = document.getElementById('dossier-cargo');
      const dossierFuel = document.getElementById('dossier-fuel');
      const dossierValue = document.getElementById('dossier-value');
      const dossierPnl = document.getElementById('dossier-pnl');
      const dossierReturn = document.getElementById('dossier-return');
      const dossierMission = document.getElementById('dossier-mission');
      const dossierNote = document.getElementById('dossier-note');
      
      if (dossierImg) {
        dossierImg.src = ship.sprite;
        dossierImg.onerror = () => { dossierImg.src = ship.fallbackSprite; };
      }
      if (dossierBadge) dossierBadge.textContent = ship.class;
      if (dossierTicker) dossierTicker.textContent = ship.ticker;
      if (dossierName) dossierName.textContent = ship.name;
      if (dossierDesig) dossierDesig.textContent = ship.designation;
      if (dossierHull) dossierHull.style.width = `${ship.hull}%`;
      if (dossierCargo) dossierCargo.style.width = `${ship.cargo}%`;
      if (dossierFuel) dossierFuel.style.width = `${ship.fuel}%`;
      if (dossierValue) dossierValue.textContent = `$${ship.value.toLocaleString()}`;
      if (dossierPnl) {
        const pnlStr = ship.pnl >= 0 ? `+$${ship.pnl}` : `-$${Math.abs(ship.pnl)}`;
        dossierPnl.textContent = pnlStr;
        dossierPnl.className = `ops-value ${ship.pnl >= 0 ? 'positive' : 'negative'}`;
      }
      if (dossierReturn) {
        const retStr = ship.pnlPercent >= 0 ? `+${ship.pnlPercent.toFixed(1)}%` : `${ship.pnlPercent.toFixed(1)}%`;
        dossierReturn.textContent = retStr;
      }
      if (dossierMission) dossierMission.textContent = ship.status === 'OPERATIONAL' ? 'STANDBY' : 'CAUTION';
      if (dossierNote) {
        dossierNote.textContent = ship.value > 0 ? `POSITION ACTIVE — ${ship.sector}` : 'NO POSITION — OBSERVATION MODE';
      }
      
      // Store current ticker
      window.currentHangarTicker = ship.ticker;
    }
    
    // Trigger special animation on hero ship (callable from anywhere)
    function triggerHeroSpecial() {
      if (heroAnimator) {
        heroAnimator.triggerSpecial();
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // UPGRADES PANEL - Interactive ship upgrade preview
    // ═══════════════════════════════════════════════════════════════════════════
    
    let upgradesPanelInitialized = false;
    
    function initUpgradesPanel() {
      if (upgradesPanelInitialized) return;
      upgradesPanelInitialized = true;
      
      const canvas = document.getElementById('upgrade-preview-canvas');
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      
      // Sliders
      const sliders = {
        pnl: document.getElementById('upgrade-pnl'),
        winrate: document.getElementById('upgrade-winrate'),
        volatility: document.getElementById('upgrade-volatility'),
        volume: document.getElementById('upgrade-volume'),
        gain: document.getElementById('upgrade-gain'),
        drawdown: document.getElementById('upgrade-drawdown')
      };
      
      // Value displays
      const values = {
        pnl: document.getElementById('upgrade-pnl-value'),
        winrate: document.getElementById('upgrade-winrate-value'),
        volatility: document.getElementById('upgrade-volatility-value'),
        volume: document.getElementById('upgrade-volume-value'),
        gain: document.getElementById('upgrade-gain-value'),
        drawdown: document.getElementById('upgrade-drawdown-value')
      };
      
      const tickerSelect = document.getElementById('upgrade-ticker-select');
      const powerValue = document.getElementById('upgrade-power-value');
      const powerBar = document.getElementById('upgrade-power-bar');
      const upgradeList = document.getElementById('upgrade-breakdown-list');
      const upgradeSummary = document.getElementById('upgrade-summary-text');
      
      // Stat thresholds for upgrades (simplified version)
      const UPGRADE_TIERS = {
        wings: [
          { min: -Infinity, max: 0.25, id: 'wing_small', label: 'Scout Wings' },
          { min: 0.25, max: 0.50, id: 'wing_mid', label: 'Standard Wings' },
          { min: 0.50, max: 0.75, id: 'wing_large', label: 'Combat Wings' },
          { min: 0.75, max: Infinity, id: 'wing_elite', label: 'Elite Wings' }
        ],
        engines: [
          { min: -Infinity, max: 0.33, id: 'thruster_1', label: 'Basic Thruster' },
          { min: 0.33, max: 0.66, id: 'thruster_2', label: 'Ion Drive' },
          { min: 0.66, max: Infinity, id: 'thruster_3', label: 'Plasma Core' }
        ],
        armor: [
          { min: -Infinity, max: 0.40, id: null, label: 'No Armor' },
          { min: 0.40, max: 0.70, id: 'plate_1', label: 'Light Plating' },
          { min: 0.70, max: Infinity, id: 'plate_2', label: 'Heavy Armor' }
        ],
        antenna: [
          { min: -Infinity, max: 0.50, id: null, label: 'No Antenna' },
          { min: 0.50, max: 0.80, id: 'antenna_1', label: 'Comm Array' },
          { min: 0.80, max: Infinity, id: 'antenna_2', label: 'Command Array' }
        ],
        weapons: [
          { min: -Infinity, max: 0.60, id: null, label: 'Unarmed' },
          { min: 0.60, max: 0.85, id: 'weapon_1', label: 'Laser Banks' },
          { min: 0.85, max: Infinity, id: 'weapon_2', label: 'Missile Pods' }
        ],
        shield: [
          { min: -Infinity, max: 0.70, id: null, label: 'No Shield' },
          { min: 0.70, max: Infinity, id: 'shield_1', label: 'Energy Shield' }
        ]
      };
      
      function clamp01(x) { return Math.max(0, Math.min(1, x)); }
      function mapRange(v, a, b) { return a === b ? 0 : (v - a) / (b - a); }
      
      function pickTier(tiers, val) {
        for (const t of tiers) {
          if (val >= t.min && val < t.max) return t;
        }
        return tiers[tiers.length - 1];
      }
      
      function getCurrentStats() {
        return {
          todayPnlPct: parseFloat(sliders.pnl?.value || 0),
          winRate: parseFloat(sliders.winrate?.value || 50) / 100,
          volatility: parseFloat(sliders.volatility?.value || 3) / 100,
          relativeVolume: parseFloat(sliders.volume?.value || 1),
          totalGainPct: parseFloat(sliders.gain?.value || 0),
          maxDrawdownPct: parseFloat(sliders.drawdown?.value || 10)
        };
      }
      
      function updateValueDisplays() {
        if (values.pnl) values.pnl.textContent = (sliders.pnl?.value || 0) + '%';
        if (values.winrate) values.winrate.textContent = (sliders.winrate?.value || 50) + '%';
        if (values.volatility) values.volatility.textContent = (sliders.volatility?.value || 3) + '%';
        if (values.volume) values.volume.textContent = parseFloat(sliders.volume?.value || 1).toFixed(1) + 'x';
        if (values.gain) values.gain.textContent = (sliders.gain?.value || 0) + '%';
        if (values.drawdown) values.drawdown.textContent = (sliders.drawdown?.value || 10) + '%';
      }
      
      function mapStatsToUpgrades(stats) {
        const momentum = clamp01(mapRange(stats.todayPnlPct, -5, 5));
        const strength = clamp01(mapRange(stats.winRate, 0.3, 0.8));
        const risk = clamp01(mapRange(stats.volatility, 0.01, 0.08));
        const activity = clamp01(mapRange(stats.relativeVolume, 0.5, 3.0));
        const magnitude = clamp01(mapRange(stats.totalGainPct, -20, 50));
        const consistency = clamp01(mapRange(20 - stats.maxDrawdownPct, 0, 20));
        
        return {
          wings: { ...pickTier(UPGRADE_TIERS.wings, momentum), val: momentum },
          engines: { ...pickTier(UPGRADE_TIERS.engines, strength), val: strength },
          armor: { ...pickTier(UPGRADE_TIERS.armor, risk), val: risk },
          antenna: { ...pickTier(UPGRADE_TIERS.antenna, activity), val: activity },
          weapons: { ...pickTier(UPGRADE_TIERS.weapons, magnitude), val: magnitude },
          shield: { ...pickTier(UPGRADE_TIERS.shield, consistency), val: consistency }
        };
      }
      
      function calculatePowerLevel(upgrades) {
        const weights = { engines: 1.5, wings: 1.2, weapons: 1.3, armor: 1.0, antenna: 0.8, shield: 1.4 };
        let total = 0, count = 0;
        for (const [slot, data] of Object.entries(upgrades)) {
          const w = weights[slot] || 1;
          total += (data.val || 0) * w;
          count += w;
        }
        return Math.round((total / count) * 100);
      }
      
      function renderUpgradeList(upgrades) {
        if (!upgradeList) return;
        const slots = ['wings', 'engines', 'armor', 'antenna', 'weapons', 'shield'];
        upgradeList.innerHTML = slots.map(slot => {
          const tier = upgrades[slot];
          const hasUpgrade = tier?.id != null;
          return `<div class="upgrade-item">
            <span class="upgrade-slot">${slot}</span>
            <span class="upgrade-value ${hasUpgrade ? '' : 'none'}">${tier?.label || 'None'}</span>
          </div>`;
        }).join('');
      }
      
      function getSummary(upgrades) {
        const parts = [];
        for (const [slot, tier] of Object.entries(upgrades)) {
          if (tier?.id) parts.push(tier.label);
        }
        return parts.join(', ') || 'Stock Configuration';
      }
      
      async function updatePreview() {
        const ticker = tickerSelect?.value || 'RKLB';
        const stats = getCurrentStats();
        const upgrades = mapStatsToUpgrades(stats);
        const power = calculatePowerLevel(upgrades);
        
        // Update UI
        if (powerValue) powerValue.textContent = power;
        if (powerBar) powerBar.style.width = power + '%';
        if (upgradeSummary) upgradeSummary.textContent = getSummary(upgrades);
        renderUpgradeList(upgrades);
        
        // Draw ship preview (placeholder with procedural upgrades)
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Try to load base ship image
        const baseSrc = `assets/ships/animated/${ticker}/${ticker}_base.png`;
        try {
          const img = new Image();
          img.src = baseSrc;
          await new Promise((res, rej) => {
            img.onload = res;
            img.onerror = () => {
              // Fallback to static
              img.src = `assets/ships/static/${ticker}-flagship-ship.png`;
              img.onload = res;
              img.onerror = rej;
            };
          });
          
          // Draw scaled up 3x
          const scale = 3;
          const x = (canvas.width - img.width * scale) / 2;
          const y = (canvas.height - img.height * scale) / 2;
          ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
          
          // Draw procedural upgrade indicators
          drawUpgradeEffects(ctx, upgrades, canvas.width / 2, canvas.height / 2);
        } catch (e) {
          // Draw placeholder
          drawPlaceholderShip(ctx, canvas.width / 2, canvas.height / 2, upgrades);
        }
      }
      
      function drawUpgradeEffects(ctx, upgrades, cx, cy) {
        ctx.save();
        
        // Engine glow
        if (upgrades.engines?.id) {
          const glow = upgrades.engines.val || 0.5;
          const gradient = ctx.createRadialGradient(cx, cy + 40, 0, cx, cy + 40, 30 * glow);
          gradient.addColorStop(0, `rgba(255, ${150 + glow * 100}, 50, ${glow * 0.8})`);
          gradient.addColorStop(1, 'rgba(255, 50, 0, 0)');
          ctx.fillStyle = gradient;
          ctx.fillRect(cx - 40, cy + 20, 80, 60);
        }
        
        // Shield effect
        if (upgrades.shield?.id) {
          ctx.strokeStyle = `rgba(51, 255, 153, ${0.3 + upgrades.shield.val * 0.3})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(cx, cy, 70, 60, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        
        ctx.restore();
      }
      
      function drawPlaceholderShip(ctx, cx, cy, upgrades) {
        ctx.save();
        ctx.fillStyle = '#334455';
        ctx.strokeStyle = '#556677';
        ctx.lineWidth = 2;
        
        // Basic ship shape
        ctx.beginPath();
        ctx.moveTo(cx, cy - 50);
        ctx.lineTo(cx + 30, cy + 30);
        ctx.lineTo(cx + 10, cy + 40);
        ctx.lineTo(cx, cy + 25);
        ctx.lineTo(cx - 10, cy + 40);
        ctx.lineTo(cx - 30, cy + 30);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        drawUpgradeEffects(ctx, upgrades, cx, cy);
        ctx.restore();
      }
      
      // Bind events
      Object.values(sliders).forEach(slider => {
        if (slider) {
          slider.addEventListener('input', () => {
            updateValueDisplays();
            updatePreview();
          });
        }
      });
      
      if (tickerSelect) {
        tickerSelect.addEventListener('change', updatePreview);
      }
      
      // Initial render
      updateValueDisplays();
      updatePreview();
    }
    
    // Make functions globally available
    window.initHangarPanel = initHangarPanel;
    window.cycleHangarShip = cycleHangarShip;
    window.selectHangarShip = selectHangarShip;
    window.setPerformanceMode = setPerformanceMode;
    window.triggerHeroSpecial = triggerHeroSpecial;
    window.initUpgradesPanel = initUpgradesPanel;
