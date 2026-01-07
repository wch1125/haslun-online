/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FLEET COMMAND — Active Vessel Management UI
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Renders and manages the Fleet Command panel showing all tracked vessels
 * with their status, stats bars, and P&L data.
 * 
 * Dependencies:
 *   - js/data/ship-data.js (SHIP_SPRITES, SHIP_CLASSES)
 *   - js/data/ticker-profiles.js (TICKER_PROFILES)
 *   - js/ui/shipBrief.js (openShipBrief)
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';
  
  /**
   * Ship class designations by ticker
   */
  const SHIP_DESIGNATIONS = {
    RKLB: { class: 'FLAGSHIP', code: 'FSC-001', name: 'ELECTRON' },
    LUNR: { class: 'LANDER', code: 'LND-002', name: 'LUNAR' },
    JOBY: { class: 'LIGHT', code: 'EVT-003', name: 'EVTOL' },
    ACHR: { class: 'CARRIER', code: 'AXM-004', name: 'MIDNIGHT' },
    ASTS: { class: 'RELAY', code: 'COM-005', name: 'BLUEWALKER' },
    GME: { class: 'WILDCARD', code: 'MSN-006', name: 'MOONSHOT' },
    BKSY: { class: 'DRONE', code: 'RCN-006', name: 'BLACKSKY' },
    PL: { class: 'SCOUT', code: 'PLT-007', name: 'PELICAN' },
    KTOS: { class: 'FIGHTER', code: 'KRT-008', name: 'KRATOS' },
    LHX: { class: 'DRONE', code: 'LHX-009', name: 'L3HARRIS' },
    RTX: { class: 'OFFICER', code: 'RTX-010', name: 'RAYTHEON' },
    GE: { class: 'BOMBER', code: 'GEA-011', name: 'AEROSPACE' },
    COHR: { class: 'REFLECTOR', code: 'COH-012', name: 'COHERENT' },
    RDW: { class: 'HAULER', code: 'RDW-013', name: 'REDWIRE' },
    EVEX: { class: 'TRANSPORT', code: 'EVX-014', name: 'EVEX' }
  };
  
  /**
   * Calculate vessel stats from market data
   */
  function calculateVesselStats(ticker, stats) {
    if (!stats) return { hull: 50, cargo: 50, fuel: 50 };
    
    // Hull: Based on distance from 52w high (closer = higher hull)
    const priceRange = stats.high_52w - stats.low_52w;
    const fromHigh = stats.high_52w - stats.current;
    const hull = priceRange > 0 
      ? Math.max(10, Math.min(100, 100 - (fromHigh / priceRange * 100)))
      : 50;
    
    // Cargo: Based on volume relative to average (simplified)
    const cargo = Math.max(10, Math.min(100, 50 + (stats.return_1m || 0) * 2));
    
    // Fuel: Based on momentum (3m return)
    const fuel = Math.max(10, Math.min(100, 50 + (stats.return_3m || 0)));
    
    return {
      hull: Math.round(hull),
      cargo: Math.round(cargo),
      fuel: Math.round(fuel)
    };
  }
  
  /**
   * Determine operational status
   */
  function getOperationalStatus(stats) {
    if (!stats) return 'standby';
    
    const momentum = stats.return_1m || 0;
    const volatility = Math.abs(stats.return_1w || 0);
    
    if (momentum > 5 || (momentum > 0 && volatility < 3)) {
      return 'operational';
    } else if (momentum < -10 || volatility > 10) {
      return 'damaged';
    }
    return 'standby';
  }
  
  /**
   * Render a single vessel card
   */
  function renderVesselCard(ticker, stats, sprite) {
    const designation = SHIP_DESIGNATIONS[ticker] || { 
      class: 'UNKNOWN', 
      code: 'UNK-000', 
      name: ticker 
    };
    
    const vesselStats = calculateVesselStats(ticker, stats);
    const status = getOperationalStatus(stats);
    const price = stats?.current?.toFixed(2) || '--';
    const pnl = stats?.return_1d || 0;
    const pnlStr = pnl >= 0 ? `+$${Math.abs(pnl * (stats?.current || 0) / 100).toFixed(0)}` : `-$${Math.abs(pnl * (stats?.current || 0) / 100).toFixed(0)}`;
    const pnlPct = pnl >= 0 ? `+${pnl.toFixed(1)}%` : `${pnl.toFixed(1)}%`;
    const pnlClass = pnl >= 0 ? 'positive' : 'negative';
    
    return `
      <div class="vessel-card" data-ticker="${ticker}" onclick="FleetCommand.openVessel('${ticker}')">
        <div class="vessel-sprite-frame">
          <span class="vessel-sprite-corner tl"></span>
          <span class="vessel-sprite-corner tr"></span>
          <span class="vessel-sprite-corner bl"></span>
          <span class="vessel-sprite-corner br"></span>
          <img class="vessel-sprite-img" src="${sprite}" alt="${ticker}" onerror="this.src='assets/ships/static/Unclaimed-Drone-ship.png'">
          <span class="vessel-sprite-class">${designation.class}</span>
        </div>
        
        <div class="vessel-info">
          <div class="vessel-header">
            <div class="vessel-identity">
              <div class="vessel-ticker">${ticker}</div>
              <div class="vessel-designation">${designation.name} · ${designation.code}</div>
            </div>
            <div class="vessel-status ${status}">
              <span class="vessel-status-dot"></span>
              ${status.toUpperCase()}
            </div>
          </div>
          
          <div class="vessel-stats">
            <div class="vessel-stat">
              <span class="vessel-stat-label">HULL</span>
              <div class="vessel-stat-bar">
                <div class="vessel-stat-fill hull" style="width: ${vesselStats.hull}%"></div>
              </div>
              <span class="vessel-stat-value">${vesselStats.hull}%</span>
            </div>
            <div class="vessel-stat">
              <span class="vessel-stat-label">CARGO</span>
              <div class="vessel-stat-bar">
                <div class="vessel-stat-fill cargo" style="width: ${vesselStats.cargo}%"></div>
              </div>
              <span class="vessel-stat-value">${Math.round(vesselStats.cargo * 2)} units</span>
            </div>
            <div class="vessel-stat">
              <span class="vessel-stat-label">FUEL</span>
              <div class="vessel-stat-bar">
                <div class="vessel-stat-fill fuel" style="width: ${vesselStats.fuel}%"></div>
              </div>
              <span class="vessel-stat-value">${vesselStats.fuel}%</span>
            </div>
          </div>
          
          <div class="vessel-footer">
            <div class="vessel-price">$${price}</div>
            <div class="vessel-pnl">
              <span class="vessel-pnl-value ${pnlClass}">${pnlStr}</span>
              <span class="vessel-pnl-percent ${pnlClass}">${pnlPct}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Render Portfolio Status panel
   */
  function renderPortfolioStatus(statsData, positions) {
    const tickers = positions || Object.keys(statsData?.stats || {}).slice(0, 10);
    let todayPnl = 0;
    let totalValue = 0;
    let winners = 0;
    
    tickers.forEach(ticker => {
      const s = statsData?.stats?.[ticker];
      if (s) {
        const dayChange = (s.return_1d || 0) * (s.current || 0) / 100;
        todayPnl += dayChange;
        totalValue += s.current || 0;
        if ((s.return_1d || 0) >= 0) winners++;
      }
    });
    
    const winRate = tickers.length > 0 ? Math.round((winners / tickers.length) * 100) : 0;
    const totalPnl = totalValue * 0.15; // Simulated total P&L
    
    return `
      <div class="portfolio-status">
        <div class="portfolio-status-title">// PORTFOLIO STATUS</div>
        <div class="portfolio-status-grid">
          <div class="portfolio-stat">
            <div class="portfolio-stat-label">TODAY P&L</div>
            <div class="portfolio-stat-value ${todayPnl >= 0 ? 'positive' : 'negative'}">
              ${todayPnl >= 0 ? '+' : ''}$${Math.abs(todayPnl).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            </div>
          </div>
          <div class="portfolio-stat">
            <div class="portfolio-stat-label">TOTAL P&L</div>
            <div class="portfolio-stat-value positive">
              +$${totalPnl.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            </div>
          </div>
          <div class="portfolio-stat">
            <div class="portfolio-stat-label">POSITIONS</div>
            <div class="portfolio-stat-value neutral">${tickers.length}</div>
          </div>
          <div class="portfolio-stat">
            <div class="portfolio-stat-label">WIN RATE</div>
            <div class="portfolio-stat-value positive">${winRate}%</div>
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Main Fleet Command module
   */
  window.FleetCommand = {
    container: null,
    statsData: null,
    positions: ['RKLB', 'BKSY', 'ACHR', 'LUNR', 'ASTS', 'GME', 'JOBY', 'PL', 'KTOS', 'GE'],
    
    /**
     * Initialize Fleet Command
     */
    async init(containerId) {
      this.container = document.getElementById(containerId);
      if (!this.container) {
        console.warn('FleetCommand: Container not found:', containerId);
        return;
      }
      
      // Load stats data
      try {
        const response = await fetch('data/stats.json');
        this.statsData = await response.json();
      } catch (e) {
        console.warn('FleetCommand: Failed to load stats:', e);
        this.statsData = { stats: {} };
      }
      
      this.render();
    },
    
    /**
     * Render the Fleet Command panel
     */
    render() {
      if (!this.container) return;
      
      const sprites = window.SHIP_SPRITES || {};
      const defaultSprite = 'assets/ships/static/Unclaimed-Drone-ship.png';
      
      let cardsHtml = '';
      this.positions.forEach(ticker => {
        const stats = this.statsData?.stats?.[ticker];
        const sprite = sprites[ticker] || defaultSprite;
        cardsHtml += renderVesselCard(ticker, stats, sprite);
      });
      
      this.container.innerHTML = `
        <div class="fleet-command">
          <div class="fleet-command-header">
            <span class="fleet-command-icon">▲</span>
            <div class="fleet-command-titles">
              <h2 class="fleet-command-title">FLEET COMMAND</h2>
              <div class="fleet-command-subtitle">ACTIVE VESSEL MANIFEST</div>
            </div>
          </div>
          <div class="fleet-command-body">
            ${cardsHtml}
          </div>
        </div>
      `;
    },
    
    /**
     * Render Portfolio Status (for sidebar)
     */
    renderPortfolio(containerId) {
      const container = document.getElementById(containerId);
      if (!container) return;
      container.innerHTML = renderPortfolioStatus(this.statsData, this.positions);
    },
    
    /**
     * Open vessel details (Ship Brief)
     */
    openVessel(ticker) {
      if (typeof openShipBrief === 'function') {
        openShipBrief(ticker);
      } else if (window.ShipBrief?.open) {
        window.ShipBrief.open(ticker);
      } else {
        console.warn('FleetCommand: Ship Brief not available');
      }
    },
    
    /**
     * Update positions list
     */
    setPositions(tickers) {
      this.positions = tickers;
      this.render();
    },
    
    /**
     * Refresh data
     */
    async refresh() {
      try {
        const response = await fetch('data/stats.json');
        this.statsData = await response.json();
        this.render();
      } catch (e) {
        console.warn('FleetCommand: Refresh failed:', e);
      }
    }
  };
  
})();
