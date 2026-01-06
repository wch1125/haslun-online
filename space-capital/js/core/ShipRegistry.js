// =========================================================================
// SHIP REGISTRY — Central authority for all ship/ticker data
// 
// This module unifies:
//   - data/tickers.json (identity, lore, static properties)
//   - stats.json (performance metrics)
//   - Computed properties (tier, role, squadSize, spriteUpgrades)
//
// Usage:
//   await ShipRegistry.init();
//   const ship = ShipRegistry.get('RKLB');
//   const allShips = ShipRegistry.all();
//   const elites = ShipRegistry.byTier('S');
// =========================================================================

(function() {
  'use strict';

  const ShipRegistry = {
    _ships: {},
    _initialized: false,
    _tickersData: null,
    _statsData: null,

    // -----------------------------------------------------------------------
    // Initialization
    // -----------------------------------------------------------------------
    async init() {
      if (this._initialized) return this;

      try {
        // Load both data sources in parallel
        const [tickersRes, statsRes] = await Promise.all([
          fetch('data/tickers.json').then(r => r.ok ? r.json() : null),
          fetch('stats.json').then(r => r.ok ? r.json() : null)
        ]);

        this._tickersData = tickersRes?.tickers || {};
        // stats.json has { tickers: [...], stats: { TICKER: {...} } }
        this._statsData = statsRes?.stats || statsRes || {};

        // Build unified ship records
        this._buildRegistry();
        this._initialized = true;

        console.log(`[ShipRegistry] Initialized with ${Object.keys(this._ships).length} ships`);
      } catch (err) {
        console.error('[ShipRegistry] Init failed:', err);
        // Fallback: build with whatever we have
        this._buildRegistry();
        this._initialized = true;
      }

      return this;
    },

    // -----------------------------------------------------------------------
    // Registry Builder
    // -----------------------------------------------------------------------
    _buildRegistry() {
      // Collect all known tickers from both sources
      const allTickers = new Set([
        ...Object.keys(this._tickersData || {}),
        ...Object.keys(this._statsData || {})
      ]);

      // Compute global stats for percentile ranking
      const allReturns = [];
      const allVolatility = [];
      
      for (const ticker of allTickers) {
        const stats = this._statsData[ticker];
        if (stats?.return_1m != null) allReturns.push(stats.return_1m);
        if (stats?.volatility != null) allVolatility.push(stats.volatility);
      }

      // Sort for percentile calculation
      allReturns.sort((a, b) => a - b);
      allVolatility.sort((a, b) => a - b);

      // Build each ship record
      for (const ticker of allTickers) {
        const identity = this._tickersData[ticker] || {};
        const stats = this._statsData[ticker] || {};

        const ship = this._buildShip(ticker, identity, stats, allReturns, allVolatility);
        this._ships[ticker] = ship;
      }
    },

    _buildShip(ticker, identity, stats, allReturns, allVolatility) {
      // === Identity (from tickers.json) ===
      const name = identity.name || ticker;
      const codename = identity.codename || ticker;
      const sector = identity.sector || 'UNKNOWN';
      const basePattern = identity.pixelShipPattern || 'drone';
      const color = identity.color || '#33ff99';
      const threatLevel = identity.threatLevel || 'MODERATE';
      const hasOptions = identity.hasOptions || false;
      const hasAnimatedSprite = identity.hasAnimatedSprite !== false;
      const specialEffect = identity.specialEffect || null;
      const description = identity.description || '';

      // === Performance Metrics (field names from stats.json) ===
      const return1d = stats.return_1d || 0;
      const return1w = stats.return_1w || 0;
      const return1m = stats.return_1m || 0;
      const return3m = stats.return_3m || 0;
      const currentPrice = stats.current || 0;
      const high52w = stats.high_52w || currentPrice;
      const low52w = stats.low_52w || currentPrice;

      // === Computed Scores (0-1 range) ===
      const momentum = this._computeMomentum(return1d, return1w, return1m);
      const strength = this._computeStrength(return1m, allReturns);
      
      // Volatility proxy: 52w range as % of current price
      const priceRange = high52w - low52w;
      const rangeVolatility = currentPrice > 0 ? priceRange / currentPrice : 0.5;
      const volatility = Math.min(1, rangeVolatility / 2); // Scale: 200% range = max volatility
      
      // Position within range (0 = at low, 1 = at high) 
      const rangePosition = priceRange > 0 ? (currentPrice - low52w) / priceRange : 0.5;

      // Power score: weighted combination
      const powerScore = (
        strength * 0.35 +
        momentum * 0.30 +
        (1 - volatility) * 0.20 + // Lower volatility = more stable = bonus
        rangePosition * 0.15      // Being near highs is bullish
      );

      // === Tier Assignment (percentile-based) ===
      const tier = this._computeTier(powerScore);

      // === Role Assignment (derived from tier + sector) ===
      const role = this._computeRole(tier, sector, basePattern, threatLevel);

      // === Squadron Size (elite = more ships) ===
      const squadSize = this._computeSquadSize(tier, role);

      // === Sprite Upgrades (stats → visual parts) ===
      const spriteUpgrades = this._computeSpriteUpgrades(momentum, strength, volatility, tier);

      return {
        // Identity
        ticker,
        name,
        codename,
        sector,
        color,
        threatLevel,
        hasOptions,
        hasAnimatedSprite,
        specialEffect,
        description,

        // Base visual
        basePattern,

        // Raw stats
        stats: {
          return1d,
          return1w,
          return1m,
          return3m,
          currentPrice,
          high52w,
          low52w
        },

        // Computed scores (0-1)
        scores: {
          power: powerScore,
          momentum,
          strength,
          volatility,
          rangePosition
        },

        // Derived classification
        tier,
        role,
        squadSize,

        // Visual modifiers
        spriteUpgrades
      };
    },

    // -----------------------------------------------------------------------
    // Score Computations
    // -----------------------------------------------------------------------
    _computeMomentum(d1, w1, m1) {
      // Recent performance weighted more heavily
      // Normalize to 0-1 range (assumes returns are percentages like 5.2 = 5.2%)
      const weighted = (d1 * 0.5 + w1 * 0.3 + m1 * 0.2);
      // Map roughly -20% to +20% → 0 to 1
      return Math.max(0, Math.min(1, (weighted + 20) / 40));
    },

    _computeStrength(return1m, allReturns) {
      if (allReturns.length === 0) return 0.5;
      // Percentile rank
      const idx = allReturns.findIndex(r => r >= return1m);
      if (idx === -1) return 1;
      return idx / allReturns.length;
    },

    _computeVolatility(stats, allVolatility) {
      const vol = stats.volatility;
      if (vol == null || allVolatility.length === 0) {
        // Estimate from return spread if no explicit volatility
        const spread = Math.abs((stats.return_1d || 0) - (stats.return_1m || 0) / 30);
        return Math.min(1, spread / 10);
      }
      // Percentile rank
      const idx = allVolatility.findIndex(v => v >= vol);
      if (idx === -1) return 1;
      return idx / allVolatility.length;
    },

    _computeTier(powerScore) {
      // S/A/B/C/D tiers based on power percentile
      if (powerScore >= 0.85) return 'S';
      if (powerScore >= 0.70) return 'A';
      if (powerScore >= 0.50) return 'B';
      if (powerScore >= 0.30) return 'C';
      return 'D';
    },

    _computeRole(tier, sector, basePattern, threatLevel) {
      // Role combines tier with sector flavor
      // This replaces hardcoded SHIP_CLASSES
      
      if (tier === 'S') {
        if (sector === 'DEFENSE') return 'DREADNOUGHT';
        if (sector === 'SPACE') return 'FLAGSHIP';
        if (sector === 'MEME') return 'BERSERKER';
        return 'COMMANDER';
      }
      
      if (tier === 'A') {
        if (sector === 'DEFENSE') return 'DESTROYER';
        if (sector === 'SPACE') return 'CRUISER';
        if (sector === 'eVTOL') return 'INTERCEPTOR';
        return 'HEAVY';
      }
      
      if (tier === 'B') {
        if (sector === 'SPACE') return 'FRIGATE';
        if (sector === 'eVTOL') return 'TRANSPORT';
        return 'ESCORT';
      }
      
      if (tier === 'C') {
        return 'PATROL';
      }
      
      // D tier
      return 'SCOUT';
    },

    _computeSquadSize(tier, role) {
      // Elite ships command larger formations
      const tierSizes = { S: 5, A: 3, B: 2, C: 1, D: 1 };
      let size = tierSizes[tier] || 1;

      // Role modifiers
      if (role === 'FLAGSHIP' || role === 'COMMANDER') size = Math.max(size, 5);
      if (role === 'DREADNOUGHT') size = Math.max(size, 4);
      if (role === 'SCOUT') size = 1;

      return size;
    },

    _computeSpriteUpgrades(momentum, strength, volatility, tier) {
      // Map scores to visual part selections
      return {
        // Wing size: momentum-driven
        wings: momentum > 0.7 ? 'large' : momentum > 0.4 ? 'medium' : 'small',
        
        // Engine intensity: strength-driven  
        engines: strength > 0.7 ? 'thruster_3' : strength > 0.4 ? 'thruster_2' : 'thruster_1',
        
        // Armor: inverse volatility (stable = armored)
        armor: volatility < 0.3 ? 'plate_heavy' : volatility < 0.6 ? 'plate_medium' : 'plate_light',
        
        // Glow intensity: tier-driven
        glow: tier === 'S' ? 'intense' : tier === 'A' ? 'strong' : tier === 'B' ? 'normal' : 'dim',
        
        // Damage state: high volatility = battle-worn
        damage: volatility > 0.7 ? 'heavy' : volatility > 0.5 ? 'light' : 'none'
      };
    },

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------
    
    /**
     * Get a single ship by ticker
     * @param {string} ticker 
     * @returns {object|null}
     */
    get(ticker) {
      return this._ships[ticker?.toUpperCase()] || null;
    },

    /**
     * Get all ships as array
     * @returns {object[]}
     */
    all() {
      return Object.values(this._ships);
    },

    /**
     * Get all tickers
     * @returns {string[]}
     */
    tickers() {
      return Object.keys(this._ships);
    },

    /**
     * Get ships filtered by tier
     * @param {string} tier - 'S', 'A', 'B', 'C', or 'D'
     * @returns {object[]}
     */
    byTier(tier) {
      return this.all().filter(s => s.tier === tier);
    },

    /**
     * Get ships filtered by sector
     * @param {string} sector - 'SPACE', 'eVTOL', 'DEFENSE', etc.
     * @returns {object[]}
     */
    bySector(sector) {
      return this.all().filter(s => s.sector === sector);
    },

    /**
     * Get ships sorted by power score (descending)
     * @returns {object[]}
     */
    byPower() {
      return this.all().sort((a, b) => b.scores.power - a.scores.power);
    },

    /**
     * Get color for a ticker (convenience method for migration)
     * @param {string} ticker 
     * @returns {string}
     */
    getColor(ticker) {
      return this.get(ticker)?.color || '#33ff99';
    },

    /**
     * Get sector/theme for a ticker (convenience method for migration)
     * @param {string} ticker 
     * @returns {string}
     */
    getSector(ticker) {
      return this.get(ticker)?.sector || 'UNKNOWN';
    },

    /**
     * Check if registry is ready
     * @returns {boolean}
     */
    isReady() {
      return this._initialized;
    },

    /**
     * Debug: dump registry state
     */
    debug() {
      console.table(this.all().map(s => ({
        ticker: s.ticker,
        tier: s.tier,
        role: s.role,
        power: s.scores.power.toFixed(2),
        squad: s.squadSize,
        sector: s.sector
      })));
    }
  };

  // Export to global scope
  window.ShipRegistry = ShipRegistry;

  // Also export for module systems if available
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShipRegistry;
  }

})();
