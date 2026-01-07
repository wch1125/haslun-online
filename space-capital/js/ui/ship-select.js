// =========================================================================
// SHIP SELECT :: Mario Kart-style ship selection with data-driven stats
// Stats derived from actual financial indicators
// =========================================================================

(function() {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────
  // STAT MAPPING: Financial indicators → Ship stats (0-100 scale)
  // ─────────────────────────────────────────────────────────────────────────
  
  const STAT_CONFIG = {
    POWER: {
      label: 'POWER',
      icon: '⚡',
      description: 'Long-term momentum (1Y return)',
      source: 'return_1y',
      // Expected range for normalization
      min: -50,
      max: 300,
      color: '#ff6b6b'
    },
    SPEED: {
      label: 'SPEED',
      icon: '🚀',
      description: 'Immediate velocity (1D return)',
      source: 'return_1d',
      min: -10,
      max: 20,
      color: '#4ecdc4'
    },
    ARMOR: {
      label: 'ARMOR',
      icon: '🛡️',
      description: 'Stability (proximity to 52W high)',
      source: 'armor_calc', // Special calculation
      min: 0,
      max: 100,
      color: '#45b7d1'
    },
    RANGE: {
      label: 'RANGE',
      icon: '📡',
      description: 'Operational reach (6M return)',
      source: 'return_6m',
      min: -50,
      max: 200,
      color: '#96ceb4'
    },
    TECH: {
      label: 'TECH',
      icon: '⚙️',
      description: 'Recent capability (3M return)',
      source: 'return_3m',
      min: -30,
      max: 80,
      color: '#dda0dd'
    },
    LUCK: {
      label: 'LUCK',
      icon: '🎲',
      description: 'Volatility factor (1W swing)',
      source: 'luck_calc', // Special calculation
      min: 0,
      max: 100,
      color: '#ffeaa7'
    }
  };

  // Ship class archetypes based on sector
  const SHIP_CLASSES = {
    RKLB: { class: 'FLAGSHIP', tier: 'S', specialty: 'Command' },
    LUNR: { class: 'LANDER', tier: 'A', specialty: 'Lunar Ops' },
    ASTS: { class: 'RELAY', tier: 'S', specialty: 'Comms' },
    ACHR: { class: 'EVTOL', tier: 'B', specialty: 'Air Taxi' },
    JOBY: { class: 'EVTOL', tier: 'A', specialty: 'Air Mobility' },
    GME: { class: 'DREADNOUGHT', tier: '?', specialty: 'Chaos' },
    BKSY: { class: 'RECON', tier: 'B', specialty: 'Intel' },
    RDW: { class: 'HAULER', tier: 'B', specialty: 'Infrastructure' },
    PL: { class: 'SCOUT', tier: 'A', specialty: 'Imaging' },
    EVEX: { class: 'TRANSPORT', tier: 'C', specialty: 'Cargo' },
    KTOS: { class: 'FIGHTER', tier: 'A', specialty: 'Defense' },
    COHR: { class: 'REFLECTOR', tier: 'A', specialty: 'Optics' },
    GE: { class: 'BOMBER', tier: 'S', specialty: 'Aerospace' },
    LHX: { class: 'DRONE', tier: 'A', specialty: 'Electronics' },
    RTX: { class: 'OFFICER', tier: 'S', specialty: 'Defense Prime' }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // STAT CALCULATOR
  // ─────────────────────────────────────────────────────────────────────────

  function normalizeValue(value, min, max) {
    if (!Number.isFinite(value)) return 50; // Default to middle
    const clamped = Math.max(min, Math.min(max, value));
    return Math.round(((clamped - min) / (max - min)) * 100);
  }

  function calculateArmorStat(tickerStats) {
    // Armor = how close current price is to 52-week high (higher = more armored)
    const current = tickerStats.current || 0;
    const high52 = tickerStats.high_52w || current;
    const low52 = tickerStats.low_52w || current;
    
    if (high52 === low52) return 50;
    
    const range = high52 - low52;
    const position = (current - low52) / range;
    return Math.round(position * 100);
  }

  function calculateLuckStat(tickerStats) {
    // Luck = absolute weekly swing magnitude (volatile = high luck/chaos factor)
    const weekReturn = Math.abs(tickerStats.return_1w || 0);
    const monthReturn = Math.abs(tickerStats.return_1m || 0);
    
    // Average of weekly volatility and monthly swing
    const avgSwing = (weekReturn + monthReturn / 4) / 2;
    return normalizeValue(avgSwing, 0, 15);
  }

  function calculateShipStats(ticker, statsData) {
    const tickerStats = statsData[ticker] || {};
    const stats = {};

    for (const [key, config] of Object.entries(STAT_CONFIG)) {
      let value;
      
      if (config.source === 'armor_calc') {
        value = calculateArmorStat(tickerStats);
      } else if (config.source === 'luck_calc') {
        value = calculateLuckStat(tickerStats);
      } else {
        const rawValue = tickerStats[config.source] || 0;
        value = normalizeValue(rawValue, config.min, config.max);
      }
      
      stats[key] = {
        value,
        raw: tickerStats[config.source],
        ...config
      };
    }

    // Calculate overall rating (weighted average)
    const weights = { POWER: 1.5, SPEED: 1.0, ARMOR: 1.2, RANGE: 1.0, TECH: 1.1, LUCK: 0.5 };
    let totalWeight = 0;
    let weightedSum = 0;
    
    for (const [key, stat] of Object.entries(stats)) {
      const w = weights[key] || 1;
      weightedSum += stat.value * w;
      totalWeight += w;
    }
    
    stats.OVERALL = Math.round(weightedSum / totalWeight);

    return stats;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UI RENDERER
  // ─────────────────────────────────────────────────────────────────────────

  function getShipGif(ticker, type = 'idle') {
    return `assets/ships/animated/gifs/${ticker}_${type}.gif`;
  }

  function getShipStatic(ticker) {
    const sprites = window.SHIP_SPRITES || {};
    return sprites[ticker] || window.DEFAULT_SHIP_SPRITE || 'assets/ships/static/Unclaimed-Drone-ship.png';
  }

  function renderStatBar(stat, animate = true) {
    const delay = animate ? Math.random() * 0.3 : 0;
    const barWidth = animate ? 0 : stat.value;
    
    return `
      <div class="ship-stat-row" data-stat="${stat.label}">
        <div class="ship-stat-label">
          <span class="ship-stat-icon">${stat.icon}</span>
          <span class="ship-stat-name">${stat.label}</span>
        </div>
        <div class="ship-stat-bar-container">
          <div class="ship-stat-bar" 
               style="--stat-color: ${stat.color}; --stat-value: ${stat.value}%; --anim-delay: ${delay}s; width: ${barWidth}%"
               data-value="${stat.value}">
          </div>
          <div class="ship-stat-value">${stat.value}</div>
        </div>
      </div>
    `;
  }

  function renderShipCard(ticker, stats, profile, shipClass, isSelected = false) {
    const name = window.SHIP_NAMES?.[ticker] || { name: ticker, designation: 'UNK-000' };
    const profileData = profile || {};
    const classData = shipClass || { class: 'UNKNOWN', tier: 'C', specialty: 'General' };
    
    const statOrder = ['POWER', 'SPEED', 'ARMOR', 'RANGE', 'TECH', 'LUCK'];
    const statsHtml = statOrder.map(key => renderStatBar(stats[key])).join('');
    
    // Tier color coding
    const tierColors = {
      'S': '#ffaa33',
      'A': '#33ff99',
      'B': '#4ecdc4',
      'C': '#888',
      '?': '#ff6b6b'
    };
    const tierColor = tierColors[classData.tier] || '#888';

    return `
      <div class="ship-select-card ${isSelected ? 'selected' : ''}" data-ticker="${ticker}">
        <div class="ship-card-header">
          <div class="ship-card-tier" style="--tier-color: ${tierColor}">${classData.tier}</div>
          <div class="ship-card-class">${classData.class}</div>
          <div class="ship-card-designation">${name.designation}</div>
        </div>
        
        <div class="ship-card-visual">
          <div class="ship-card-sprite-container">
            <img src="${getShipGif(ticker, 'idle')}" 
                 alt="${ticker}" 
                 class="ship-card-sprite"
                 onerror="this.src='${getShipStatic(ticker)}'">
            <div class="ship-card-glow"></div>
          </div>
        </div>
        
        <div class="ship-card-info">
          <div class="ship-card-name">${name.name}</div>
          <div class="ship-card-ticker">${ticker}</div>
          <div class="ship-card-specialty">${classData.specialty}</div>
        </div>
        
        <div class="ship-card-stats">
          ${statsHtml}
        </div>
        
        <div class="ship-card-overall">
          <span class="overall-label">OVERALL</span>
          <span class="overall-value">${stats.OVERALL}</span>
        </div>
        
        <div class="ship-card-footer">
          <div class="ship-card-codename">"${profileData.codename || ticker}"</div>
          <div class="ship-card-sector">${profileData.sector || 'Unknown Sector'}</div>
        </div>
        
        <button class="ship-select-btn" data-ticker="${ticker}">
          <span class="btn-text">SELECT</span>
          <span class="btn-glow"></span>
        </button>
      </div>
    `;
  }

  function renderShipSelectScreen(container, statsData, options = {}) {
    const {
      onSelect = () => {},
      selectedTicker = null,
      showAll = true
    } = options;

    // Get available tickers (those with ship sprites)
    const availableTickers = Object.keys(window.SHIP_SPRITES || {});
    const profiles = window.TICKER_PROFILES || {};

    // Calculate stats for all ships
    const shipData = availableTickers.map(ticker => ({
      ticker,
      stats: calculateShipStats(ticker, statsData),
      profile: profiles[ticker],
      shipClass: SHIP_CLASSES[ticker]
    }));

    // Sort by overall rating (descending)
    shipData.sort((a, b) => b.stats.OVERALL - a.stats.OVERALL);

    // Build the screen
    const html = `
      <div class="ship-select-screen">
        <div class="ship-select-header">
          <div class="ship-select-title">
            <span class="title-icon">🚀</span>
            <span class="title-text">CHOOSE YOUR SHIP</span>
            <span class="title-icon">🚀</span>
          </div>
          <div class="ship-select-subtitle">Fleet Command Interface // Pilot Registration</div>
        </div>
        
        <div class="ship-select-legend">
          <div class="legend-item"><span class="legend-icon">⚡</span> POWER: 1Y Return</div>
          <div class="legend-item"><span class="legend-icon">🚀</span> SPEED: 1D Return</div>
          <div class="legend-item"><span class="legend-icon">🛡️</span> ARMOR: 52W Position</div>
          <div class="legend-item"><span class="legend-icon">📡</span> RANGE: 6M Return</div>
          <div class="legend-item"><span class="legend-icon">⚙️</span> TECH: 3M Return</div>
          <div class="legend-item"><span class="legend-icon">🎲</span> LUCK: Volatility</div>
        </div>
        
        <div class="ship-select-grid">
          ${shipData.map(({ ticker, stats, profile, shipClass }) => 
            renderShipCard(ticker, stats, profile, shipClass, ticker === selectedTicker)
          ).join('')}
        </div>
        
        <div class="ship-select-footer">
          <div class="footer-hint">Click a ship to view details • Double-click to select</div>
          <div class="footer-stats">
            <span class="fleet-count">${shipData.length} ships in fleet</span>
            <span class="data-source">Stats derived from market data</span>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Animate stat bars after render
    requestAnimationFrame(() => {
      container.querySelectorAll('.ship-stat-bar').forEach(bar => {
        const value = bar.dataset.value;
        bar.style.width = value + '%';
      });
    });

    // Attach event listeners
    container.querySelectorAll('.ship-select-card').forEach(card => {
      const ticker = card.dataset.ticker;
      
      card.addEventListener('click', () => {
        // Remove selection from others
        container.querySelectorAll('.ship-select-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        
        // Trigger special animation
        const sprite = card.querySelector('.ship-card-sprite');
        if (sprite) {
          sprite.src = getShipGif(ticker, 'special');
          setTimeout(() => {
            sprite.src = getShipGif(ticker, 'idle');
          }, 2000);
        }
      });
      
      card.addEventListener('dblclick', () => {
        onSelect(ticker, shipData.find(s => s.ticker === ticker));
      });
      
      const selectBtn = card.querySelector('.ship-select-btn');
      if (selectBtn) {
        selectBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelect(ticker, shipData.find(s => s.ticker === ticker));
        });
      }
    });

    return shipData;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // COMPACT CARD (for inline use in dashboard)
  // ─────────────────────────────────────────────────────────────────────────

  function renderCompactShipCard(ticker, statsData) {
    const stats = calculateShipStats(ticker, statsData);
    const name = window.SHIP_NAMES?.[ticker] || { name: ticker, designation: 'UNK-000' };
    const shipClass = SHIP_CLASSES[ticker] || { class: 'UNKNOWN', tier: 'C', specialty: 'General' };
    
    const tierColors = {
      'S': '#ffaa33',
      'A': '#33ff99', 
      'B': '#4ecdc4',
      'C': '#888',
      '?': '#ff6b6b'
    };
    
    // Mini stat bars (just the key 4)
    const keyStats = ['POWER', 'SPEED', 'ARMOR', 'TECH'];
    const miniStats = keyStats.map(key => {
      const s = stats[key];
      return `<div class="mini-stat" title="${s.label}: ${s.value}">
        <div class="mini-stat-fill" style="width:${s.value}%; background:${s.color}"></div>
      </div>`;
    }).join('');

    return `
      <div class="compact-ship-card" data-ticker="${ticker}">
        <div class="compact-tier" style="color:${tierColors[shipClass.tier]}">${shipClass.tier}</div>
        <img src="${getShipGif(ticker, 'idle')}" class="compact-sprite" onerror="this.src='${getShipStatic(ticker)}'">
        <div class="compact-info">
          <div class="compact-name">${name.name}</div>
          <div class="compact-class">${shipClass.class}</div>
        </div>
        <div class="compact-stats">${miniStats}</div>
        <div class="compact-overall">${stats.OVERALL}</div>
      </div>
    `;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MODAL VERSION (overlay on existing page)
  // ─────────────────────────────────────────────────────────────────────────

  function showShipSelectModal(statsData, onSelect) {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.className = 'ship-select-modal';
    modal.innerHTML = `
      <div class="ship-select-modal-backdrop"></div>
      <div class="ship-select-modal-content">
        <button class="ship-select-modal-close" title="Close">✕</button>
        <div class="ship-select-modal-body"></div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Render the selection screen inside
    const body = modal.querySelector('.ship-select-modal-body');
    renderShipSelectScreen(body, statsData, {
      onSelect: (ticker, data) => {
        modal.classList.add('closing');
        setTimeout(() => {
          modal.remove();
          onSelect(ticker, data);
        }, 300);
      }
    });
    
    // Close handlers
    modal.querySelector('.ship-select-modal-close').addEventListener('click', () => {
      modal.classList.add('closing');
      setTimeout(() => modal.remove(), 300);
    });
    
    modal.querySelector('.ship-select-modal-backdrop').addEventListener('click', () => {
      modal.classList.add('closing');
      setTimeout(() => modal.remove(), 300);
    });
    
    // Animate in
    requestAnimationFrame(() => modal.classList.add('open'));
    
    return modal;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EXPORT
  // ─────────────────────────────────────────────────────────────────────────

  window.ShipSelect = {
    calculateShipStats,
    renderShipSelectScreen,
    renderCompactShipCard,
    showShipSelectModal,
    STAT_CONFIG,
    SHIP_CLASSES,
    getShipGif,
    getShipStatic
  };

})();
