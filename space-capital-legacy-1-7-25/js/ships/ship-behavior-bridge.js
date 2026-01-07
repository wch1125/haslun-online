/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SHIP BEHAVIOR BRIDGE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Wires the ShipBehavior system into existing UI components:
 * - Hangar hero ship
 * - Ship brief dialogs
 * - Fleet cards
 * - Position rows
 * 
 * Also handles deriving behavior stats from real portfolio data.
 * ═══════════════════════════════════════════════════════════════════════════
 */

window.ShipBehaviorBridge = (function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // STAT DERIVATION FROM PORTFOLIO DATA
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Convert portfolio position data into behavior stats
   * Now enhanced with telemetry data from 45-min CSV analysis
   */
  function deriveStats(position, ticker) {
    if (!position && !ticker) return getDefaultStats();

    const stats = {
      pnlPercent: 0,
      volatility: 0.02,
      hull: 100,
      fuel: 100,
      winRate: 0.5
    };

    // Get telemetry data if available
    const telemetry = window.ShipTelemetry?.getTelemetry(ticker);
    const animMods = window.ShipTelemetry?.getAnimationModifiers(ticker);

    // P&L percentage
    if (position?.pnlPercent !== undefined) {
      stats.pnlPercent = position.pnlPercent;
    } else if (position?.pnl !== undefined && position?.value !== undefined && position.value > 0) {
      stats.pnlPercent = (position.pnl / (position.value - position.pnl)) * 100;
    }

    // Volatility - use telemetry if available, else derive from position
    if (telemetry) {
      // Base volatility from telemetry, modulated by current position data
      stats.volatility = telemetry.volatilityFactor * 0.1; // Scale to 0-10% range
    } else if (position?.volatility !== undefined) {
      stats.volatility = position.volatility;
    } else if (position?.dayHigh !== undefined && position?.dayLow !== undefined && position?.price) {
      stats.volatility = (position.dayHigh - position.dayLow) / position.price;
    }

    // Hull = position health (based on drawdown + telemetry resilience)
    if (position?.hull !== undefined) {
      stats.hull = position.hull;
    } else if (position?.high52w !== undefined && position?.price !== undefined) {
      const drawdown = (position.high52w - position.price) / position.high52w;
      // Telemetry resilience affects how much drawdown impacts hull
      const resilienceMod = telemetry ? telemetry.hullResilience : 0.5;
      stats.hull = Math.max(10, Math.round((1 - drawdown * (1.5 - resilienceMod)) * 100));
    } else if (telemetry) {
      // Use telemetry-based hull with P&L modulation
      const baseHull = telemetry.hullResilience * 100;
      stats.hull = Math.max(10, Math.min(100, baseHull + stats.pnlPercent * 2));
    } else {
      // Derive from P&L as proxy
      stats.hull = Math.max(10, Math.min(100, 70 + stats.pnlPercent * 3));
    }

    // Fuel = trading capacity / momentum (enhanced by telemetry thrust potential)
    if (position?.fuel !== undefined) {
      stats.fuel = position.fuel;
    } else if (position?.volume !== undefined && position?.avgVolume !== undefined) {
      const relativeVolume = position.volume / position.avgVolume;
      const thrustMod = telemetry ? telemetry.thrustPotential : 0.5;
      stats.fuel = Math.min(100, Math.round(relativeVolume * 50 * (0.5 + thrustMod) + 25));
    } else if (telemetry) {
      // Use telemetry thrust potential as fuel proxy
      stats.fuel = Math.round(telemetry.thrustPotential * 60 + 40);
    } else {
      stats.fuel = 75; // Default
    }

    // Win rate (if available, or estimate from telemetry)
    if (position?.winRate !== undefined) {
      stats.winRate = position.winRate;
    } else if (telemetry) {
      // Estimate from telemetry: stable + trending = higher implied win rate
      stats.winRate = Math.min(0.8, 0.35 + telemetry.maneuverStability * 0.25 + telemetry.thrustPotential * 0.2);
    }

    // Attach animation modifiers for behavior system
    if (animMods) {
      stats._animationModifiers = animMods;
    }

    return stats;
  }

  function getDefaultStats() {
    return {
      pnlPercent: 0,
      volatility: 0.02,
      hull: 100,
      fuel: 100,
      winRate: 0.5
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SHIP CLASS DETECTION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get ship class from ticker or SHIP_DATA
   * Now uses telemetry-based suggestions as fallback
   */
  function getShipClass(ticker) {
    // Check SHIP_DATA first
    if (window.SHIP_DATA) {
      const ship = window.SHIP_DATA.find(s => s.ticker === ticker);
      if (ship && ship.class) return ship.class;
    }

    // Check ticker profiles
    if (window.TICKER_PROFILES && window.TICKER_PROFILES[ticker]) {
      const profile = window.TICKER_PROFILES[ticker];
      if (profile.class) return profile.class;
    }

    // Use telemetry-suggested class if available
    if (window.ShipTelemetry?.hasData(ticker)) {
      const suggested = ShipTelemetry.getSuggestedClass(ticker);
      if (suggested !== 'Ship') return suggested;
    }

    // Fallback class assignments (manual overrides)
    const CLASS_MAP = {
      'RKLB': 'Flagship',
      'LUNR': 'Lander',
      'JOBY': 'eVTOL',
      'ACHR': 'eVTOL',
      'GME': 'Moonshot',
      'BKSY': 'Recon',
      'ASTS': 'Relay',
      'RDW': 'Cargo',
      'KTOS': 'Fighter',
      'PL': 'Scout',
      'GE': 'Carrier',
      'RTX': 'Flagship',
      'LHX': 'Drone',
      'COHR': 'Scout',
      'EVEX': 'Cargo'
    };

    return CLASS_MAP[ticker] || 'Ship';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UI INTEGRATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Initialize behavior on hangar hero ship
   */
  function initHangarHero() {
    const heroShip = document.querySelector('#hangar-hero-ship, .hangar-ship-preview img, .hero-ship-sprite');
    if (!heroShip || !window.ShipBehavior) return null;

    const ticker = window.currentHangarTicker || 'RKLB';
    const shipClass = getShipClass(ticker);

    // Get telemetry-based animation modifiers
    const animMods = window.ShipTelemetry?.getAnimationModifiers(ticker);

    const controller = ShipBehavior.create(heroShip, {
      ticker,
      shipClass,
      animationModifiers: animMods
    });

    // Get current stats from portfolio data + telemetry
    const position = getPositionData(ticker);
    controller.updateStats(deriveStats(position, ticker));

    // Check market status for state
    if (isMarketOpen()) {
      controller.setState(ShipBehavior.STATES.ACTIVE);
    }

    return controller;
  }

  /**
   * Initialize behavior on ship brief dialog
   */
  function initShipBrief(dialog, ticker) {
    if (!dialog || !window.ShipBehavior) return null;

    const shipImg = dialog.querySelector('.brief-ship-img, .ship-preview img');
    if (!shipImg) return null;

    const shipClass = getShipClass(ticker);
    const animMods = window.ShipTelemetry?.getAnimationModifiers(ticker);
    
    const controller = ShipBehavior.create(shipImg, {
      ticker,
      shipClass,
      animationModifiers: animMods
    });

    const position = getPositionData(ticker);
    const stats = deriveStats(position, ticker);
    controller.updateStats(stats);

    // Add stress indicators
    const statsContainer = dialog.querySelector('.brief-stats, .ship-stats');
    if (statsContainer) {
      // Hull indicator
      const hullIndicator = ShipBehavior.createStressIndicator('hull', stats.hull);
      if (hullIndicator) {
        hullIndicator.classList.add('brief-stress-indicator');
        statsContainer.appendChild(hullIndicator);
      }

      // Fuel indicator  
      const fuelIndicator = ShipBehavior.createStressIndicator('fuel', stats.fuel);
      if (fuelIndicator) {
        fuelIndicator.classList.add('brief-stress-indicator');
        statsContainer.appendChild(fuelIndicator);
      }
    }

    // Add telemetry status descriptor if available
    if (window.ShipTelemetry?.hasData(ticker)) {
      const statusDesc = ShipTelemetry.getStatusDescriptor(ticker);
      const statusContainer = dialog.querySelector('.brief-status, .ship-status-desc');
      if (statusContainer) {
        statusContainer.innerHTML = `
          <div class="telemetry-status">
            <span class="status-primary">${statusDesc.primary}</span>
            <span class="status-regime">${statusDesc.regime}</span>
          </div>
        `;
      }
    }

    // Add mood display
    const moodContainer = dialog.querySelector('.brief-mood, .ship-mood');
    if (moodContainer) {
      updateMoodDisplay(moodContainer, controller);
      
      // Listen for mood changes
      shipImg.addEventListener('ship:mood', (e) => {
        updateMoodDisplay(moodContainer, controller);
      });
    }

    return controller;
  }

  /**
   * Initialize behavior on fleet position cards
   */
  function initFleetCard(card, ticker) {
    if (!card || !window.ShipBehavior) return null;

    const shipImg = card.querySelector('.fleet-ship-img, .position-ship-sprite, img');
    if (!shipImg) return null;

    const shipClass = getShipClass(ticker);
    const animMods = window.ShipTelemetry?.getAnimationModifiers(ticker);
    
    const controller = ShipBehavior.create(shipImg, {
      ticker,
      shipClass,
      animationModifiers: animMods
    });

    const position = getPositionData(ticker);
    controller.updateStats(deriveStats(position, ticker));

    return controller;
  }

  /**
   * Update mood display element
   */
  function updateMoodDisplay(container, controller) {
    if (!container || !controller) return;

    const mood = controller.mood;
    const description = controller.getMoodDescription();

    container.innerHTML = `
      <span class="mood-indicator mood-${mood}"></span>
      <span class="mood-text">${description}</span>
    `;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  function getPositionData(ticker) {
    // Try app state first
    if (window.AppState && AppState.get) {
      const positions = AppState.get('positions') || [];
      const position = positions.find(p => p.ticker === ticker);
      if (position) return position;
    }

    // Try Store
    if (window.Store && Store.get) {
      const positions = Store.get('positions') || [];
      const position = positions.find(p => p.ticker === ticker);
      if (position) return position;
    }

    // Try SHIP_DATA for static fallback
    if (window.SHIP_DATA) {
      const ship = window.SHIP_DATA.find(s => s.ticker === ticker);
      if (ship) {
        return {
          ticker: ship.ticker,
          value: ship.value || 1000,
          pnl: ship.pnl || 0,
          pnlPercent: ship.pnlPercent || 0
        };
      }
    }

    return null;
  }

  function isMarketOpen() {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const time = hour * 60 + minute;

    // Weekday check
    if (day === 0 || day === 6) return false;

    // Market hours: 9:30 AM - 4:00 PM ET
    // Simplified: assuming local time matches market time
    return time >= 570 && time <= 960;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BATCH UPDATES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Update all ship behaviors from fresh portfolio data
   */
  function refreshAllBehaviors() {
    if (!window.ShipBehavior) return;

    // Get all positions
    let positions = [];
    if (window.AppState && AppState.get) {
      positions = AppState.get('positions') || [];
    } else if (window.Store && Store.get) {
      positions = Store.get('positions') || [];
    }

    // Build stats map (now with telemetry integration)
    const statsMap = {};
    positions.forEach(pos => {
      if (pos.ticker) {
        statsMap[pos.ticker] = deriveStats(pos, pos.ticker);
      }
    });

    // Update all controllers
    ShipBehavior.updateAll(statsMap);
  }

  /**
   * Handle market state changes
   */
  function onMarketStateChange(isOpen) {
    // This would be called by the main app when market opens/closes
    document.querySelectorAll('.ship-behavior').forEach(el => {
      const ticker = el.dataset.ticker;
      if (ticker) {
        const controller = ShipBehavior.get(ticker);
        if (controller) {
          if (isOpen) {
            controller.onMarketOpen();
          } else {
            controller.onMarketClose();
          }
        }
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTO-INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Auto-init behaviors when hangar ship changes
   */
  function setupAutoInit() {
    // Listen for hangar ship selection
    document.addEventListener('hangar:shipSelected', (e) => {
      if (e.detail && e.detail.ticker) {
        setTimeout(() => initHangarHero(), 100);
      }
    });

    // Listen for ship brief dialog open
    document.addEventListener('shipbrief:open', (e) => {
      if (e.detail && e.detail.dialog && e.detail.ticker) {
        setTimeout(() => initShipBrief(e.detail.dialog, e.detail.ticker), 100);
      }
    });

    // Listen for data updates
    if (window.PARALLAX_BUS) {
      PARALLAX_BUS.on('data:refresh', refreshAllBehaviors);
      PARALLAX_BUS.on('positions:updated', refreshAllBehaviors);
    }

    // Periodic refresh (every 30 seconds)
    setInterval(refreshAllBehaviors, 30000);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  function init() {
    if (!window.ShipBehavior) {
      console.warn('[ShipBehaviorBridge] ShipBehavior not loaded');
      return;
    }

    setupAutoInit();

    // Initialize hangar hero if visible
    const hangarPanel = document.getElementById('hangar-panel');
    if (hangarPanel && hangarPanel.classList.contains('active')) {
      initHangarHero();
    }

    console.log('[ShipBehaviorBridge] Initialized');
  }

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    init,
    initHangarHero,
    initShipBrief,
    initFleetCard,
    deriveStats,
    getShipClass,
    refreshAllBehaviors,
    onMarketStateChange,
    getDefaultStats
  };

})();
