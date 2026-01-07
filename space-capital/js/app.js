    // =========================================================================
    // HASLUN-BOT :: Main Application
    // External data modules loaded via separate scripts (see index.html)
    // =========================================================================
    
    // Alias externally loaded data modules
    const TICKER_PROFILES = window.TICKER_PROFILES || {};
    const HASLUN_GLOSSARY = window.HASLUN_GLOSSARY || {};
    const PORTFOLIO_MOODS = window.PORTFOLIO_MOODS || {};
    const MACD_STATES = window.MACD_STATES || {};
    const SHIP_LORE = window.SHIP_LORE || {};
    const PIXEL_SHIPS = window.PIXEL_SHIPS || {};
    const PIXEL_SHIP_LORE = window.PIXEL_SHIP_LORE || {};
    const SHIP_NAMES = window.SHIP_NAMES || {};
    const SHIP_SPRITES = window.SHIP_SPRITES || {};
    const DEFAULT_SHIP_SPRITE = window.DEFAULT_SHIP_SPRITE || 'assets/ships/Unclaimed-Drone-ship.png';
    
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
        badge.textContent = eliteSet.has(ticker) ? (ticker + ' ★') : ticker;

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
      const countdown = document.getElementById('countdown');
      const status = document.getElementById('loading-status');
      const beam = document.getElementById('pixel-beam');
      const ground = document.getElementById('pixel-ground');
      const loadingScreen = document.getElementById('loading-screen');
      const app = document.getElementById('app');

      let count = 3;

      const arcadeMessages = [
        'ESTABLISHING UPLINK...',
        'SYNCHING FLEET TELEMETRY...',
        'CALIBRATING THRUST VECTORS...'
      ];

      // Start the animated, data-driven fleet
      createLoadingFleet();

      const interval = setInterval(() => {
        count--;
        if (count > 0) {
          countdown.textContent = count;
          status.textContent = arcadeMessages[3 - count - 1] || 'INITIALIZING...';
        } else if (count === 0) {
          countdown.textContent = 'GO';
          countdown.classList.add('go');
          if (beam) beam.classList.add('active');
          if (ground) ground.classList.add('active');
          status.textContent = 'COCKPIT ONLINE — CLEAR FOR LAUNCH';
        } else {
          clearInterval(interval);
          loadingScreen.classList.add('hidden');
          app.classList.add('visible');
          init();
        }
      }, 1000);
    }

    // Start countdown on load

    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(runCountdown, 500);
    });
    
    let currentTicker = 'RKLB', currentTimeframe = '1D', currentRange = '3M', showMA = true;
    let priceChart = null, macdChart = null, tickerData = {}, statsData = {};
    
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
    // TICKER_PROFILES — Loaded from js/data/ticker-profiles.js
    // Access via: window.TICKER_PROFILES
    // =========================================================================
    
    // =========================================================================
    // HASLUN_GLOSSARY, PORTFOLIO_MOODS, MACD_STATES — Loaded from js/data/glossary.js
    // Access via: window.HASLUN_GLOSSARY, window.PORTFOLIO_MOODS, window.MACD_STATES
    // =========================================================================
    
    // Glossary helper functions
    function getGlossary(id) {
      return HASLUN_GLOSSARY[id] || null;
    }
    
    function getTooltip(id) {
      const entry = HASLUN_GLOSSARY[id];
      return entry ? entry.tooltip : '';
    }
    
    function getFlavor(id) {
      const entry = HASLUN_GLOSSARY[id];
      return entry ? entry.flavor : '';
    }
    
    // Get trend state based on price, MACD data, and volatility
    function getTrendState(price, ma100, ma150, ma200, macdVal, volScore) {
      if (!price || !ma200) return HASLUN_GLOSSARY.trend_analyzing;
      
      const aboveMa100 = price > ma100;
      const aboveMa150 = price > ma150;
      const aboveMa200 = price > ma200;
      const macdPositive = macdVal > 0;
      const nearMa100 = Math.abs(price - ma100) / price < 0.015;
      const volHigh = (volScore || 0) > 30;
      
      // FULL THRUST: Above all MAs with positive momentum and calm vol
      if (aboveMa200 && aboveMa150 && macdPositive && !volHigh) {
        return HASLUN_GLOSSARY.trend_full_thrust;
      }
      
      // REVERSAL ATTEMPT: Above short-term but below long-term, calm vol
      if (aboveMa100 && !aboveMa200 && macdPositive && !volHigh) {
        return HASLUN_GLOSSARY.trend_reversal_attempt;
      }
      
      // DRIFTING: Near MAs with weak momentum and tame vol
      if (nearMa100 && Math.abs(macdVal) < 0.1 && !volHigh) {
        return HASLUN_GLOSSARY.trend_drifting;
      }
      
      // REENTRY RISK: Below long-term with negative momentum
      if (!aboveMa200 && !macdPositive && !volHigh) {
        return HASLUN_GLOSSARY.trend_reentry_risk;
      }
      
      // NEBULOUS: High volatility OR mixed signals
      return HASLUN_GLOSSARY.trend_nebula;
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
        const entry = HASLUN_GLOSSARY[id];
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
      if (/stealth|black|secret/i.test(sector)) return { symbol: "#ship-parallax", label: "NIGHT PARALLAX", isHero: false };
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
        const label = meta.hero ? lore.label + " ★" : lore.label;
        caption.textContent = `${ticker.toUpperCase()} · ${label}`;
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
    
    // Telemetry HUD ship – uses the same pixel mech system
    function updateTelemetryShipSprite(ticker) {
      const svgEl      = document.getElementById("telemetry-ship-svg");
      const labelEl    = document.getElementById("telemetry-ship-label");
      const captionEl  = document.getElementById("telemetry-ship-caption");
      const headerName = document.getElementById("telemetry-ship-name"); // existing title text

      if (!svgEl) return;

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

      // Map into a sprite pattern
      const meta = mapTickerToPixelShip(upper, sector, pnl);
      renderPixelShip(svgEl, meta.pattern, {
        hero: meta.hero,
        pnlPercent: pnl
      });

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
        classEl.textContent = ship.shipClass + (ship.isHero ? ' ★' : '');
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
        return '<div class="watchlist-item ' + (t === currentTicker ? 'active' : '') + '" onclick="selectTicker(\'' + t + '\'); if(window.innerWidth <= 768) toggleMobileDrawer();">' +
          '<div class="watchlist-info"><div class="watchlist-ticker" style="color: ' + color + '">' + t + '</div>' +
          '<div class="watchlist-meta">' + theme + '</div></div>' +
          '<div class="watchlist-data"><div class="watchlist-price">$' + (stats.current || 0).toFixed(2) + '</div>' +
          '<div class="watchlist-change ' + (change >= 0 ? 'positive' : 'negative') + '">' + (change >= 0 ? '+' : '') + change.toFixed(2) + '%</div></div></div>';
      }).join('');
      
      document.getElementById('watchlist').innerHTML = watchlistHTML;
      
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
      if (drawer && backdrop) {
        const isOpening = !drawer.classList.contains('open');
        drawer.classList.toggle('open');
        backdrop.classList.toggle('open');
        
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
      if (trendState === HASLUN_GLOSSARY.trend_full_thrust) mode = 'bull';
      else if (trendState === HASLUN_GLOSSARY.trend_reentry_risk) mode = 'bear';
      else if (trendState === HASLUN_GLOSSARY.trend_nebula) mode = 'volatile';
      else if (trendState === HASLUN_GLOSSARY.trend_reversal_attempt) mode = 'neutral';
      else if (trendState === HASLUN_GLOSSARY.trend_drifting) mode = 'neutral';
      
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
    
    function updateCharts() {
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
      
      // Calculate proper Y-axis bounds with padding
      const minPrice = Math.min(...closes);
      const maxPrice = Math.max(...closes);
      const priceRange = maxPrice - minPrice;
      const padding = priceRange * 0.08 || maxPrice * 0.02; // 8% padding, or 2% if flat
      
      // For short timeframes, use tighter bounds to show movement
      const isShortRange = ['1W', '1M'].includes(currentRange);
      const yPadding = isShortRange ? padding * 0.5 : padding;
      
      if (priceChart) priceChart.destroy();
      const datasets = [{ 
        label: currentTicker, 
        data: closes, 
        borderColor: color, 
        backgroundColor: color + '15', 
        borderWidth: 2, 
        fill: true, 
        tension: 0.1, 
        pointRadius: 0, 
        pointHoverRadius: 4 
      }];
      
      if (showMA) {
        if (source.some(d => d.g100)) datasets.push({ label: 'MA 100', data: source.map(d => d.g100), borderColor: '#ffb347', borderWidth: 1, fill: false, tension: 0.1, pointRadius: 0 });
        if (source.some(d => d.g150)) datasets.push({ label: 'MA 150', data: source.map(d => d.g150), borderColor: '#b388ff', borderWidth: 1, fill: false, tension: 0.1, pointRadius: 0 });
        if (source.some(d => d.g200)) datasets.push({ label: 'MA 200', data: source.map(d => d.g200), borderColor: '#47d4ff', borderWidth: 1, fill: false, tension: 0.1, pointRadius: 0 });
      }
      
      priceChart = new Chart(document.getElementById('price-chart'), {
        type: 'line', 
        data: { labels, datasets },
        options: {
          responsive: true, 
          maintainAspectRatio: false, 
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: showMA, position: 'top', labels: { boxWidth: 12, font: { size: 10, family: "'IBM Plex Mono', monospace" }, color: '#5a7068' } },
            tooltip: { backgroundColor: 'rgba(10, 12, 15, 0.95)', titleColor: '#e8f4f0', bodyColor: '#a8c0b8', borderColor: '#1e2832', borderWidth: 1, titleFont: { family: "'IBM Plex Mono', monospace" }, bodyFont: { family: "'IBM Plex Mono', monospace" }, callbacks: { label: i => i.dataset.label + ': $' + i.parsed.y.toFixed(2) } }
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
        }
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
    
    function switchTab(tabName) {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === tabName + '-panel'));
      
      // Refresh arcade previews when switching to arcade tab
      if (tabName === 'arcade' && window.SpriteCache && SpriteCache.loaded) {
        setTimeout(() => SpriteCache.renderGamePreviews(), 100);
      }
      
      // Re-initialize trajectory canvas when switching to holdings/options tab
      if (tabName === 'options' && window.initTrajectoryCanvas) {
        setTimeout(() => window.initTrajectoryCanvas(), 100);
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
      // Update mobile bottom nav
      document.querySelectorAll('.mobile-nav-item').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabName);
      });
      // Update desktop nav tabs (keep in sync)
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
      // Update panels
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === tabName + '-panel'));
      // Play sound
      if (window.SoundFX) SoundFX.play('click');
      
      // Re-initialize trajectory canvas when switching to holdings/options tab
      if (tabName === 'options' && window.initTrajectoryCanvas) {
        setTimeout(() => window.initTrajectoryCanvas(), 150);
      }
    }
    
    function toggleFabMenu() {
      const fabMain = document.getElementById('fab-main');
      const fabMenu = document.getElementById('fab-menu');
      if (fabMain && fabMenu) {
        fabMain.classList.toggle('open');
        fabMenu.classList.toggle('open');
        if (window.SoundFX) SoundFX.play('click');
      }
    }
    
    function toggleFabSFX() {
      const sfxToggle = document.getElementById('sfx-toggle');
      const fabSfx = document.getElementById('fab-sfx');
      if (sfxToggle) {
        sfxToggle.checked = !sfxToggle.checked;
        sfxToggle.dispatchEvent(new Event('change'));
        if (fabSfx) {
          fabSfx.innerHTML = '<span class="fab-icon">🔊</span><span>SFX ' + (sfxToggle.checked ? 'ON' : 'OFF') + '</span>';
          fabSfx.classList.toggle('active', sfxToggle.checked);
        }
      }
    }
    
    function toggleFabBGM() {
      const bgmToggle = document.getElementById('bgm-toggle');
      const fabBgm = document.getElementById('fab-bgm');
      if (bgmToggle) {
        bgmToggle.checked = !bgmToggle.checked;
        bgmToggle.dispatchEvent(new Event('change'));
        if (fabBgm) {
          fabBgm.innerHTML = '<span class="fab-icon">🎵</span><span>BGM ' + (bgmToggle.checked ? 'ON' : 'OFF') + '</span>';
          fabBgm.classList.toggle('active', bgmToggle.checked);
        }
      }
    }
    
    function showAboutOverlay() {
      const aboutTrigger = document.getElementById('about-trigger-btn');
      if (aboutTrigger) {
        aboutTrigger.click();
      }
      toggleFabMenu();
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
          return `
            <div class="ship-select-item ${isSelected ? 'selected' : ''}" 
                 style="--ship-color: ${color}"
                 onclick="SpriteCache.selectShip('${ticker}')"
                 data-ticker="${ticker}">
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
          <div class="ship-card ${isOperational ? '' : 'negative'}" style="--ship-color: ${color}" onclick="openVesselDossier('${pos.ticker}');">
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
        { id:'terrain_lander', text:'Soft land on the terrain', done:false },
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
        div.textContent = message;
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
            showToast('🏆 ALL MISSIONS COMPLETE!', 'alert');
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
      // VESSEL DOSSIER CONTROLLER — Cinematic Ship Information Card
      // =========================================================================
      function initVesselDossier() {
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
          status.textContent = text;
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
            setStatus("⚡ COMMS LOCKED ⚡", "locked");
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
          showToast('🛸 INVADER ATTACK DETECTED!', 'alert');
        }

        // Log to terminal
        if (typeof logTerminal === 'function') {
          logTerminal('⚠ ALERT: Hostile formation detected! Shields up!');
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
      // SignalInvaders, AdminConsole, LandingGame exposed via window object
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
      
      // SignalInvaders, AdminConsole, LandingGame loaded from js/games/mini-games.js
      
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initArcade);
        document.addEventListener('DOMContentLoaded', initTubeOverload);
        document.addEventListener('DOMContentLoaded', initEncountersBoard);
        document.addEventListener('DOMContentLoaded', initCargoBay);
        document.addEventListener('DOMContentLoaded', initTrajectoryCanvas);
        document.addEventListener('DOMContentLoaded', initLoreEngine);
        document.addEventListener('DOMContentLoaded', initEnhancedCatalysts);
        document.addEventListener('DOMContentLoaded', () => window.SignalInvaders && window.SignalInvaders.init());
        document.addEventListener('DOMContentLoaded', () => window.AdminConsole && window.AdminConsole.init());
        document.addEventListener('DOMContentLoaded', () => window.LandingGame && window.LandingGame.init());
        document.addEventListener('DOMContentLoaded', initConsoleShip);
      } else {
        initArcade();
        initTubeOverload();
        initEncountersBoard();
        initCargoBay();
        initTrajectoryCanvas();
        initLoreEngine();
        initEnhancedCatalysts();
        window.SignalInvaders && window.SignalInvaders.init();
        window.AdminConsole && window.AdminConsole.init();
        window.LandingGame && window.LandingGame.init();
        initConsoleShip();
      }
    })();
