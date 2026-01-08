// =========================================================================
// SHIP SELECT :: Mario Kart-style ship selection with data-driven stats
// Stats derived from actual financial indicators
// =========================================================================

(function() {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────
  // STORE INTEGRATION - Single source of truth
  // ─────────────────────────────────────────────────────────────────────────
  
  function getStore() {
    return window.Store || null;
  }

  function commitShipSelection(ticker, shipData) {
    const store = getStore();
    if (store) {
      store.set({
        activeTicker: ticker,
        activeShip: shipData || null,
        activeMission: null  // Clear mission when switching ships
      });
      console.log('[ShipSelect] Committed to Store:', ticker);
    }
  }

  function getActiveTicker() {
    const store = getStore();
    return store ? store.get('activeTicker') : null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STAT MAPPING: Financial indicators → Ship stats (0-100 scale)
  // ─────────────────────────────────────────────────────────────────────────
  
  const STAT_CONFIG = {
    POWER: {
      label: 'PWR',
      description: 'Long-term momentum (1Y return)',
      source: 'return_1y',
      min: -50,
      max: 300,
      color: '#ff6b6b'
    },
    SPEED: {
      label: 'SPD',
      description: 'Immediate velocity (1D return)',
      source: 'return_1d',
      min: -10,
      max: 20,
      color: '#4ecdc4'
    },
    ARMOR: {
      label: 'ARM',
      description: 'Stability (proximity to 52W high)',
      source: 'armor_calc',
      min: 0,
      max: 100,
      color: '#45b7d1'
    },
    RANGE: {
      label: 'RNG',
      description: 'Operational reach (6M return)',
      source: 'return_6m',
      min: -50,
      max: 200,
      color: '#96ceb4'
    },
    TECH: {
      label: 'TCH',
      description: 'Recent capability (3M return)',
      source: 'return_3m',
      min: -30,
      max: 80,
      color: '#dda0dd'
    },
    LUCK: {
      label: 'LCK',
      description: 'Volatility factor (1W swing)',
      source: 'luck_calc',
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
    return `../assets/ships/animated/gifs/${ticker}_${type}.gif`;
  }

  function getShipStatic(ticker) {
    const sprites = window.SHIP_SPRITES || {};
    return sprites[ticker] || window.DEFAULT_SHIP_SPRITE || '../assets/ships/static/Unclaimed-Drone-ship.png';
  }

  function renderStatBar(stat, animate = true) {
    const delay = animate ? Math.random() * 0.3 : 0;
    const barWidth = animate ? 0 : stat.value;
    
    return `
      <div class="ship-stat-row" data-stat="${stat.label}">
        <div class="ship-stat-label">
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
                 class="ship-card-sprite ship-behavior"
                 data-ticker="${ticker}"
                 data-ship-class="${classData.class}"
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
            <span class="title-text">// SELECT VESSEL //</span>
          </div>
          <div class="ship-select-subtitle">Fleet Command Interface</div>
        </div>
        
        <div class="ship-select-legend">
          <div class="legend-item"><span class="legend-label">PWR</span> 1Y Return</div>
          <div class="legend-item"><span class="legend-label">SPD</span> 1D Return</div>
          <div class="legend-item"><span class="legend-label">ARM</span> 52W Position</div>
          <div class="legend-item"><span class="legend-label">RNG</span> 6M Return</div>
          <div class="legend-item"><span class="legend-label">TCH</span> 3M Return</div>
          <div class="legend-item"><span class="legend-label">LCK</span> Volatility</div>
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

      // Initialize ShipBehavior on each ship sprite
      if (window.ShipBehavior) {
        container.querySelectorAll('.ship-card-sprite').forEach(img => {
          const ticker = img.dataset.ticker;
          const shipClass = img.dataset.shipClass || 'Ship';
          const shipStats = shipData.find(s => s.ticker === ticker)?.stats;
          
          if (!img._behaviorController) {
            img._behaviorController = ShipBehavior.create(img, {
              ticker,
              shipClass
            });
          }

          // Use calculated stats to drive behavior
          if (img._behaviorController && shipStats) {
            // Map ship stats to behavior inputs:
            // - POWER (1Y return) → P&L proxy
            // - LUCK (volatility) → volatility
            // - ARMOR (52W position) → hull proxy
            // - Overall → fuel proxy
            const pnlPercent = (shipStats.POWER?.value ?? 50) - 50; // Center at 0
            const volatility = Math.max(0.01, (100 - (shipStats.LUCK?.value ?? 50)) / 1000); // Lower luck = more volatile
            const hull = shipStats.ARMOR?.value ?? 75;
            const fuel = shipStats.OVERALL ?? 50;

            img._behaviorController.updateStats({
              pnlPercent,
              volatility,
              hull,
              fuel
            });
          }
        });
      }
    });

    // Attach event listeners
    container.querySelectorAll('.ship-select-card').forEach(card => {
      const ticker = card.dataset.ticker;
      
      card.addEventListener('click', () => {
        // CRITICAL: Don't select if this was a swipe gesture
        if (swipeState.didSwipe) {
          swipeState.didSwipe = false;
          return;
        }
        
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
        // CRITICAL: Don't navigate if this was a swipe gesture
        if (swipeState.didSwipe) {
          swipeState.didSwipe = false;
          return;
        }
        
        const data = shipData.find(s => s.ticker === ticker);
        // ALWAYS commit to Store first
        commitShipSelection(ticker, data);
        onSelect(ticker, data);
      });
      
      const selectBtn = card.querySelector('.ship-select-btn');
      if (selectBtn) {
        selectBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          
          // CRITICAL: Don't navigate if this was a swipe gesture
          if (swipeState.didSwipe) {
            swipeState.didSwipe = false;
            return;
          }
          
          const data = shipData.find(s => s.ticker === ticker);
          // ALWAYS commit to Store first
          commitShipSelection(ticker, data);
          onSelect(ticker, data);
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
  // MOBILE SWIPE MODE - Full-screen cards with INERTIA + PARALLAX
  // Cards float above a slower-moving background for depth
  // ─────────────────────────────────────────────────────────────────────────

  const SWIPE_THRESHOLD = 50;         // Minimum swipe distance to trigger navigation
  const MOBILE_BREAKPOINT = 768;
  const INERTIA_FRICTION = 0.92;      // Velocity decay per frame (lower = more friction)
  const INERTIA_MIN_VELOCITY = 0.5;   // Stop inertia below this threshold
  const PARALLAX_RATIO = 0.35;        // Background moves 35% of foreground speed
  
  let swipeState = {
    enabled: false,
    currentIndex: 0,
    startX: 0,
    startY: 0,
    startTime: 0,
    isDragging: false,
    didSwipe: false,  // CRITICAL: Prevents click after swipe
    velocity: 0,
    lastX: 0,
    lastTime: 0,
    inertiaRaf: null,
    grid: null,
    parallaxBg: null,
    cards: [],
    indicator: null,
    selectedTicker: null
  };

  function isMobileViewport() {
    return window.innerWidth <= MOBILE_BREAKPOINT;
  }

  function initSwipeMode(container, selectedTicker) {
    if (!isMobileViewport()) return;
    
    const screen = container.querySelector('.ship-select-screen');
    const grid = container.querySelector('.ship-select-grid');
    const cards = container.querySelectorAll('.ship-select-card');
    
    if (!screen || !grid || cards.length === 0) return;
    
    // Enable swipe mode
    screen.classList.add('swipe-mode');
    
    // ═══════════════════════════════════════════════════════════════════
    // PARALLAX BACKGROUND - Creates depth, cards float above
    // ═══════════════════════════════════════════════════════════════════
    let parallaxBg = screen.querySelector('.swipe-parallax-bg');
    if (!parallaxBg) {
      parallaxBg = document.createElement('div');
      parallaxBg.className = 'swipe-parallax-bg';
      parallaxBg.innerHTML = `
        <div class="parallax-layer parallax-grid"></div>
        <div class="parallax-layer parallax-nebula"></div>
        <div class="parallax-layer parallax-stars"></div>
      `;
      screen.insertBefore(parallaxBg, screen.firstChild);
    }
    
    swipeState = {
      enabled: true,
      currentIndex: 0,
      startX: 0,
      startY: 0,
      startTime: 0,
      isDragging: false,
      velocity: 0,
      lastX: 0,
      lastTime: 0,
      inertiaRaf: null,
      grid,
      parallaxBg,
      cards: [...cards],
      indicator: null,
      selectedTicker
    };
    
    // Find initial index (selected ship or first)
    if (selectedTicker) {
      const selectedIndex = swipeState.cards.findIndex(c => c.dataset.ticker === selectedTicker);
      if (selectedIndex >= 0) {
        swipeState.currentIndex = selectedIndex;
      }
    }
    
    // Set initial position
    updateSwipePosition(false);
    updateParallax();
    
    // Create indicator dots
    createSwipeIndicator(container);
    
    // Show swipe hint on first visit
    showSwipeHint(container);
    
    // Attach touch handlers
    grid.addEventListener('touchstart', handleTouchStart, { passive: true });
    grid.addEventListener('touchmove', handleTouchMove, { passive: false });
    grid.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    // Handle resize
    window.addEventListener('resize', handleResize);
    
    console.log('[ShipSelect] Swipe mode with inertia + parallax,', cards.length, 'ships');
  }

  function handleTouchStart(e) {
    if (!swipeState.enabled) return;
    
    // Cancel any ongoing inertia animation
    if (swipeState.inertiaRaf) {
      cancelAnimationFrame(swipeState.inertiaRaf);
      swipeState.inertiaRaf = null;
    }
    
    const touch = e.touches[0];
    const now = performance.now();
    
    swipeState.startX = touch.clientX;
    swipeState.startY = touch.clientY;
    swipeState.startTime = now;
    swipeState.lastX = touch.clientX;
    swipeState.lastTime = now;
    swipeState.velocity = 0;
    swipeState.isDragging = true;
    swipeState.didSwipe = false;  // Reset swipe flag on new touch
    
    // Remove transitions during drag for immediate feedback
    swipeState.grid.style.transition = 'none';
    if (swipeState.parallaxBg) {
      swipeState.parallaxBg.style.transition = 'none';
    }
  }

  function handleTouchMove(e) {
    if (!swipeState.enabled || !swipeState.isDragging) return;
    
    const touch = e.touches[0];
    const now = performance.now();
    const deltaX = touch.clientX - swipeState.startX;
    const deltaY = touch.clientY - swipeState.startY;
    
    // If vertical scroll is dominant, don't hijack
    if (Math.abs(deltaY) > Math.abs(deltaX) * 1.5) {
      return;
    }
    
    // Mark as swipe if moved enough (prevents tap-after-swipe)
    if (Math.abs(deltaX) > 10) {
      swipeState.didSwipe = true;
    }
    
    // Prevent page scroll during horizontal swipe
    if (Math.abs(deltaX) > 10) {
      e.preventDefault();
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // VELOCITY TRACKING - Smoothed for natural inertia
    // ═══════════════════════════════════════════════════════════════════
    const dt = now - swipeState.lastTime;
    if (dt > 0) {
      const instantVelocity = (touch.clientX - swipeState.lastX) / dt;
      // Exponential smoothing for stable velocity reading
      swipeState.velocity = swipeState.velocity * 0.7 + instantVelocity * 0.3;
    }
    swipeState.lastX = touch.clientX;
    swipeState.lastTime = now;
    
    // Calculate drag position with rubber-band resistance at edges
    const baseOffset = -swipeState.currentIndex * window.innerWidth;
    let resistance = 1;
    
    // Add resistance at boundaries (rubber-band effect)
    if ((swipeState.currentIndex === 0 && deltaX > 0) || 
        (swipeState.currentIndex === swipeState.cards.length - 1 && deltaX < 0)) {
      resistance = 0.3;
    }
    
    const dragOffset = baseOffset + (deltaX * resistance);
    swipeState.grid.style.transform = `translateX(${dragOffset}px)`;
    
    // Parallax background follows slower
    updateParallaxDrag(dragOffset);
  }

  function handleTouchEnd(e) {
    if (!swipeState.enabled || !swipeState.isDragging) return;
    
    swipeState.isDragging = false;
    
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - swipeState.startX;
    const elapsed = performance.now() - swipeState.startTime;
    const velocity = swipeState.velocity;
    
    // Determine if this was a flick (fast swipe) vs slow drag
    const isFlick = Math.abs(velocity) > 0.4 && elapsed < 350;
    
    // ═══════════════════════════════════════════════════════════════════
    // NAVIGATION DECISION - Flick overrides distance threshold
    // ═══════════════════════════════════════════════════════════════════
    let newIndex = swipeState.currentIndex;
    
    if (isFlick) {
      // Flick: use velocity direction regardless of distance
      if (velocity < -0.2 && swipeState.currentIndex < swipeState.cards.length - 1) {
        newIndex++;
      } else if (velocity > 0.2 && swipeState.currentIndex > 0) {
        newIndex--;
      }
    } else if (Math.abs(deltaX) >= SWIPE_THRESHOLD) {
      // Drag: use distance
      if (deltaX < 0 && swipeState.currentIndex < swipeState.cards.length - 1) {
        newIndex++;
      } else if (deltaX > 0 && swipeState.currentIndex > 0) {
        newIndex--;
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // INERTIA - Continue momentum if not changing cards
    // ═══════════════════════════════════════════════════════════════════
    if (newIndex === swipeState.currentIndex && Math.abs(velocity) > INERTIA_MIN_VELOCITY) {
      // Apply inertia physics
      startInertia(velocity);
    } else {
      // Standard snap transition
      swipeState.currentIndex = newIndex;
      enableTransitions();
      updateSwipePosition(true);
      updateParallax();
      updateSwipeIndicator();
      triggerShipHighlight(swipeState.currentIndex);
    }
  }

  /**
   * INERTIA PHYSICS - Momentum-based scroll that decays naturally
   */
  function startInertia(initialVelocity) {
    let velocity = initialVelocity * 16; // Scale to pixels per frame (~60fps)
    
    // Get current position from transform
    let currentOffset = -swipeState.currentIndex * window.innerWidth;
    const transform = swipeState.grid.style.transform;
    const match = transform.match(/translateX\(([^)]+)px\)/);
    if (match) {
      currentOffset = parseFloat(match[1]);
    }
    
    // Keep transitions off during inertia
    swipeState.grid.style.transition = 'none';
    if (swipeState.parallaxBg) {
      swipeState.parallaxBg.style.transition = 'none';
    }
    
    function inertiaStep() {
      // Apply friction
      velocity *= INERTIA_FRICTION;
      currentOffset += velocity;
      
      // Boundary limits with bounce
      const minOffset = -(swipeState.cards.length - 1) * window.innerWidth;
      const maxOffset = 0;
      
      if (currentOffset > maxOffset) {
        currentOffset = maxOffset;
        velocity = -velocity * 0.25; // Soft bounce
      } else if (currentOffset < minOffset) {
        currentOffset = minOffset;
        velocity = -velocity * 0.25; // Soft bounce
      }
      
      // Apply transforms
      swipeState.grid.style.transform = `translateX(${currentOffset}px)`;
      updateParallaxDrag(currentOffset);
      
      // Continue or snap to nearest
      if (Math.abs(velocity) > INERTIA_MIN_VELOCITY) {
        swipeState.inertiaRaf = requestAnimationFrame(inertiaStep);
      } else {
        // Snap to nearest card
        const nearestIndex = Math.round(-currentOffset / window.innerWidth);
        swipeState.currentIndex = Math.max(0, Math.min(swipeState.cards.length - 1, nearestIndex));
        
        enableTransitions();
        updateSwipePosition(true);
        updateParallax();
        updateSwipeIndicator();
        triggerShipHighlight(swipeState.currentIndex);
      }
    }
    
    swipeState.inertiaRaf = requestAnimationFrame(inertiaStep);
  }

  function enableTransitions() {
    swipeState.grid.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    if (swipeState.parallaxBg) {
      swipeState.parallaxBg.style.transition = 'transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    }
  }

  /**
   * PARALLAX - Background moves slower during drag
   */
  function updateParallaxDrag(foregroundOffset) {
    if (!swipeState.parallaxBg) return;
    const parallaxOffset = foregroundOffset * PARALLAX_RATIO;
    swipeState.parallaxBg.style.transform = `translateX(${parallaxOffset}px)`;
  }

  /**
   * PARALLAX - Background position for current card
   */
  function updateParallax() {
    if (!swipeState.parallaxBg) return;
    const foregroundOffset = -swipeState.currentIndex * window.innerWidth;
    const parallaxOffset = foregroundOffset * PARALLAX_RATIO;
    swipeState.parallaxBg.style.transform = `translateX(${parallaxOffset}px)`;
  }

  function updateSwipePosition(animate = true) {
    if (!swipeState.grid) return;
    
    if (!animate) {
      swipeState.grid.style.transition = 'none';
    }
    
    const offset = -swipeState.currentIndex * window.innerWidth;
    swipeState.grid.style.transform = `translateX(${offset}px)`;
    
    if (!animate) {
      // Force reflow then restore transition
      swipeState.grid.offsetHeight;
      swipeState.grid.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    }
  }

  function createSwipeIndicator(container) {
    // Remove existing
    const existing = container.querySelector('.swipe-indicator');
    if (existing) existing.remove();
    
    const indicator = document.createElement('div');
    indicator.className = 'swipe-indicator';
    
    swipeState.cards.forEach((card, i) => {
      const dot = document.createElement('div');
      dot.className = 'swipe-dot';
      if (i === swipeState.currentIndex) dot.classList.add('active');
      if (card.dataset.ticker === swipeState.selectedTicker) dot.classList.add('selected');
      
      // Tap to navigate
      dot.addEventListener('click', () => {
        swipeState.currentIndex = i;
        updateSwipePosition(true);
        updateSwipeIndicator();
        triggerShipHighlight(i);
      });
      
      indicator.appendChild(dot);
    });
    
    container.appendChild(indicator);
    swipeState.indicator = indicator;
  }

  function updateSwipeIndicator() {
    if (!swipeState.indicator) return;
    
    const dots = swipeState.indicator.querySelectorAll('.swipe-dot');
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === swipeState.currentIndex);
    });
  }

  function triggerShipHighlight(index) {
    const card = swipeState.cards[index];
    if (!card) return;
    
    const sprite = card.querySelector('.ship-card-sprite');
    if (!sprite) return;
    
    const ticker = card.dataset.ticker;
    
    // Brief special animation
    sprite.src = getShipGif(ticker, 'special');
    setTimeout(() => {
      sprite.src = getShipGif(ticker, 'idle');
    }, 1500);
  }

  function showSwipeHint(container) {
    // Only show once per session
    if (sessionStorage.getItem('swipeHintShown')) return;
    sessionStorage.setItem('swipeHintShown', 'true');
    
    const hint = document.createElement('div');
    hint.className = 'swipe-hint';
    hint.innerHTML = `
      <span class="swipe-hint-arrow">◀</span>
      <span class="swipe-hint-text">SWIPE TO BROWSE FLEET</span>
      <span class="swipe-hint-arrow">▶</span>
    `;
    
    container.appendChild(hint);
    
    // Auto-remove after animation
    setTimeout(() => hint.remove(), 3500);
  }

  function handleResize() {
    const wasMobile = swipeState.enabled;
    const isMobile = isMobileViewport();
    
    if (wasMobile && !isMobile) {
      // Switched to desktop - disable swipe mode
      disableSwipeMode();
    } else if (!wasMobile && isMobile) {
      // Would need to re-render to enable - handled by page refresh
    } else if (isMobile && swipeState.enabled) {
      // Still mobile - just update position
      updateSwipePosition(false);
    }
  }

  function disableSwipeMode() {
    if (!swipeState.grid) return;
    
    const screen = swipeState.grid.closest('.ship-select-screen');
    if (screen) screen.classList.remove('swipe-mode');
    
    swipeState.grid.style.transform = '';
    swipeState.grid.style.transition = '';
    
    if (swipeState.indicator) {
      swipeState.indicator.remove();
      swipeState.indicator = null;
    }
    
    swipeState.enabled = false;
    console.log('[ShipSelect] Swipe mode disabled');
  }

  function goToShip(index) {
    if (!swipeState.enabled) return;
    if (index < 0 || index >= swipeState.cards.length) return;
    
    swipeState.currentIndex = index;
    updateSwipePosition(true);
    updateSwipeIndicator();
  }

  function getCurrentShipIndex() {
    return swipeState.currentIndex;
  }

  function getCurrentShipTicker() {
    if (!swipeState.enabled || !swipeState.cards[swipeState.currentIndex]) return null;
    return swipeState.cards[swipeState.currentIndex].dataset.ticker;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EXPORT
  // ─────────────────────────────────────────────────────────────────────────

  window.ShipSelect = {
    // Core functions
    calculateShipStats,
    renderShipSelectScreen,
    renderCompactShipCard,
    showShipSelectModal,
    
    // Store integration
    commitShipSelection,
    getActiveTicker,
    
    // Mobile swipe mode
    initSwipeMode,
    disableSwipeMode,
    goToShip,
    getCurrentShipIndex,
    getCurrentShipTicker,
    isMobileViewport,
    
    // Config
    STAT_CONFIG,
    SHIP_CLASSES,
    
    // Utilities
    getShipGif,
    getShipStatic
  };

})();
