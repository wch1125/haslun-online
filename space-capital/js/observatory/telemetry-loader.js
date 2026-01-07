/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TELEMETRY DATA LOADER
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Loads real telemetry data from the data pipeline:
 * - data/telemetry/combined.telemetry.json (all tickers, all timeframes)
 * - Provides fallback to simulated data if files unavailable
 * 
 * Data flow: raw CSV → canonical JSON → telemetry JSON → this loader → Observatory
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // TELEMETRY DATA STORE
  // ═══════════════════════════════════════════════════════════════════════════
  
  const TelemetryData = {
    manifest: null,
    telemetry: {
      '1D': {},
      '45m': {},
      '15m': {}
    },
    portfolio: {
      '1D': null,
      '45m': null,
      '15m': null
    },
    isLoaded: false,
    currentTimeframe: '1D',
    
    // ─────────────────────────────────────────────────────────────────────────
    // LOADING
    // ─────────────────────────────────────────────────────────────────────────
    
    async load() {
      try {
        // Try to load combined telemetry file
        const response = await fetch('data/telemetry/combined.telemetry.json');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        this.manifest = data.manifest;
        this.telemetry = data.telemetry || {};
        
        // Load portfolio telemetry for each timeframe
        for (const tf of ['1D', '45m', '15m']) {
          try {
            const portfolioResponse = await fetch(`data/telemetry/${tf}/portfolio.telemetry.json`);
            if (portfolioResponse.ok) {
              this.portfolio[tf] = await portfolioResponse.json();
            }
          } catch (e) {
            console.warn(`[TelemetryData] Could not load portfolio for ${tf}`);
          }
        }
        
        this.isLoaded = true;
        console.log('[TelemetryData] Loaded real telemetry data');
        console.log(`  Symbols: ${this.manifest?.symbols?.length || 0}`);
        console.log(`  Timeframes: ${this.manifest?.timeframes?.join(', ')}`);
        
        return true;
        
      } catch (error) {
        console.warn('[TelemetryData] Could not load telemetry files, using simulated data');
        console.warn(error);
        this.isLoaded = false;
        return false;
      }
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // GETTERS
    // ─────────────────────────────────────────────────────────────────────────
    
    setTimeframe(tf) {
      if (['1D', '45m', '15m'].includes(tf)) {
        this.currentTimeframe = tf;
      }
    },
    
    getSymbols() {
      if (this.manifest?.symbols) {
        return this.manifest.symbols;
      }
      // Fallback default list
      return ['RKLB', 'ACHR', 'LUNR', 'JOBY', 'ASTS', 'BKSY', 'GME', 'GE', 'KTOS', 'PL', 'RDW', 'RTX', 'LHX', 'COHR', 'EVEX'];
    },
    
    getBenchmarks() {
      if (this.manifest?.benchmarks) {
        return this.manifest.benchmarks;
      }
      return ['XAR', 'SPY', 'QQQ'];
    },
    
    get(symbol, timeframe = null) {
      const tf = timeframe || this.currentTimeframe;
      
      if (this.isLoaded && this.telemetry[tf] && this.telemetry[tf][symbol]) {
        return this.telemetry[tf][symbol];
      }
      
      // Return simulated data if not available
      return this.simulateTelemetry(symbol, tf);
    },
    
    getPortfolio(timeframe = null) {
      const tf = timeframe || this.currentTimeframe;
      
      if (this.isLoaded && this.portfolio[tf]) {
        return this.portfolio[tf];
      }
      
      // Return simulated portfolio
      return this.simulatePortfolio();
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // BUILD SNAPSHOT (for Observatory)
    // ─────────────────────────────────────────────────────────────────────────
    
    buildSnapshot(timeframe = null) {
      const tf = timeframe || this.currentTimeframe;
      const snapshot = {};
      
      // Portfolio (becomes _portfolio)
      snapshot._portfolio = this.getPortfolio(tf);
      
      // All symbols
      const symbols = this.getSymbols();
      symbols.forEach(symbol => {
        const telem = this.get(symbol, tf);
        if (telem) {
          // Map telemetry to observatory format
          snapshot[symbol] = {
            // Performance metrics
            relativePerformance: telem.relativePerformance || 0,
            momentum: telem.momentum || 0,
            drawdown: telem.risk?.drawdown || 0,
            
            // Activity metrics
            volumePercentile: telem.activity || 0.5,
            volumeZ: (telem.activity - 0.5) * 4, // Convert to z-score-ish
            realizedVol: telem.volatility || 0.3,
            
            // Options/risk
            ivRank: telem.volatility || 0.3, // Use volatility as IV proxy
            gammaExposure: Math.abs(telem.momentum || 0),
            
            // Position
            portfolioWeight: 0.1, // Could be from portfolio data
            price: telem.price || 0,
            dayChange: (telem.chgPct || 0) / 100,
            
            // Visual overrides from telemetry
            visual: telem.visual
          };
        }
      });
      
      // Benchmarks
      const benchmarks = this.getBenchmarks();
      benchmarks.forEach(symbol => {
        const telem = this.get(symbol, tf);
        if (telem) {
          snapshot[symbol] = {
            momentum: telem.momentum || 0,
            volatility: telem.volatility || 0.15
          };
        }
      });
      
      return snapshot;
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // SIMULATION FALLBACK
    // ─────────────────────────────────────────────────────────────────────────
    
    simulateTelemetry(symbol, tf) {
      // Generate consistent pseudo-random values based on symbol
      const hash = this.hashSymbol(symbol);
      const time = Date.now() / 10000;
      
      return {
        symbol: symbol,
        tf: tf,
        asOf: Date.now(),
        
        price: 50 + (hash % 100),
        chgPct: Math.sin(time + hash) * 3,
        
        trend: Math.sin(time * 0.1 + hash) * 0.8,
        momentum: Math.sin(time * 0.2 + hash * 2) * 0.5,
        volatility: 0.2 + (hash % 30) / 100,
        activity: 0.5 + Math.sin(time * 0.3 + hash * 3) * 0.3,
        signalState: hash % 3 === 0 ? 'bull' : hash % 3 === 1 ? 'bear' : 'neutral',
        relativePerformance: Math.sin(time * 0.15 + hash * 4) * 0.4,
        
        risk: {
          drawdown: -Math.abs(Math.sin(time * 0.05 + hash * 5)) * 0.15,
          stress: 0.3 + Math.abs(Math.sin(time * 0.1 + hash * 6)) * 0.4
        },
        
        visual: {
          glow: 0.3 + Math.abs(Math.sin(time * 0.4 + hash)) * 0.5,
          jitter: 0.2 + (hash % 20) / 50,
          thrust: Math.abs(Math.sin(time * 0.2 + hash * 2)) * 0.6,
          cohesion: 0.7 - (hash % 20) / 50,
          ring: 0.2 + (hash % 15) / 50
        }
      };
    },
    
    simulatePortfolio() {
      const time = Date.now() / 10000;
      
      return {
        type: 'portfolio',
        asOf: Date.now(),
        
        healthScore: 0.65 + Math.sin(time * 0.1) * 0.15,
        volatility: 0.25 + Math.sin(time * 0.15) * 0.1,
        drawdown: -Math.abs(Math.sin(time * 0.05)) * 0.1,
        sentiment: 0.5 + Math.sin(time * 0.08) * 0.3,
        dayChange: Math.sin(time * 0.2) * 0.02
      };
    },
    
    hashSymbol(symbol) {
      let hash = 0;
      for (let i = 0; i < symbol.length; i++) {
        hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
      }
      return Math.abs(hash);
    }
  };
  
  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════════════
  
  window.TelemetryData = TelemetryData;
  
  // Auto-load on module init
  TelemetryData.load().then(success => {
    if (success) {
      window.dispatchEvent(new CustomEvent('telemetry-loaded', { detail: TelemetryData.manifest }));
    }
  });
  
  console.log('[TelemetryDataLoader] Module loaded');
  
})();
