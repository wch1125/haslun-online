/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SHIP BRIEF — Unified Ship Dialog Component
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * A single, shared dialog for viewing ship/vessel details across all pages.
 * Replaces multiple popup variants with one consistent interface.
 * 
 * Usage:
 *   ShipBrief.open('RKLB', { source: 'fleet' })
 *   ShipBrief.close()
 *   ShipBrief.isOpen()
 * 
 * Events:
 *   window.addEventListener('shipbrief:open', e => console.log(e.detail.ticker))
 *   window.addEventListener('shipbrief:close', e => console.log(e.detail.ticker))
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

window.ShipBrief = (function() {
  'use strict';
  
  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════
  
  let dialogEl = null;
  let currentTicker = null;
  let previousFocus = null;
  let isVisible = false;
  let options = {};
  
  // Timer references (for cleanup on close)
  let bootTimer = null;
  let barTimer = null;
  let focusTimer = null;
  let closeTimer = null;
  
  // Default fallback sprite
  const DEFAULT_SPRITE = 'assets/ships/static/Unclaimed-Drone-ship.png';
  
  // Ship taglines for display
  const SHIP_TAGLINES = {
    RKLB: 'Spearhead command ship.<br>Victory follows in its wake.',
    LUNR: 'Lunar surface specialist.<br>First boots, lasting impact.',
    ACHR: 'Precision carrier class.<br>Silent approach, swift arrival.',
    BKSY: 'Eyes in the dark.<br>Nothing escapes detection.',
    JOBY: 'Light assault craft.<br>Speed is survival.',
    ASTS: 'Communication relay hub.<br>The signal never sleeps.',
    GME: 'Wildcard interceptor.<br>Expect the unexpected.',
    PL: 'Long-range scout.<br>Charting the unknown.',
    KTOS: 'Combat superiority fighter.<br>Dominance through firepower.',
    GE: 'Heavy strike platform.<br>Overwhelming force on call.',
    LHX: 'Surveillance drone.<br>Invisible. Omnipresent.',
    RTX: 'Officer command vessel.<br>Strategic precision.',
    COHR: 'Optical specialist.<br>Light is the weapon.',
    RDW: 'Logistics hauler.<br>Supply line lifeline.',
    EVEX: 'Troop transport.<br>Delivering the payload.'
  };
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SOUND CONFIGURATION
  // Global flag to enable/disable UI sounds (default: OFF for accessibility)
  // Set window.UI_SOUND_ENABLED = true to enable sounds
  // ═══════════════════════════════════════════════════════════════════════════
  
  function isSoundEnabled() {
    return window.UI_SOUND_ENABLED === true;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // DIALOG HTML TEMPLATE
  // ═══════════════════════════════════════════════════════════════════════════
  
  function createDialogHTML() {
    return `
      <div class="ship-brief-backdrop"></div>
      <div class="ship-brief-container" role="dialog" aria-modal="true" aria-labelledby="ship-brief-title">
        <!-- Boot Animation Overlay -->
        <div class="ship-brief-boot" id="ship-brief-boot">
          <div class="ship-brief-boot-line"></div>
          <div class="ship-brief-boot-text">ACCESSING FLEET REGISTRY...</div>
        </div>
        
        <!-- Close Button -->
        <button class="ship-brief-close" id="ship-brief-close" aria-label="Close dialog">
          <span class="ship-brief-close-icon">×</span>
          <span class="ship-brief-close-text">ESC</span>
        </button>
        
        <!-- Main Content -->
        <div class="ship-brief-content">
          <!-- Left Panel: Ship Visual -->
          <div class="ship-brief-visual">
            <div class="ship-brief-display">
              <!-- Scan Frame -->
              <div class="ship-brief-scan-frame">
                <div class="ship-brief-scan-corner tl"></div>
                <div class="ship-brief-scan-corner tr"></div>
                <div class="ship-brief-scan-corner bl"></div>
                <div class="ship-brief-scan-corner br"></div>
                <div class="ship-brief-scan-line"></div>
              </div>
              <!-- Ship Image -->
              <img id="ship-brief-img" src="" alt="" class="ship-brief-img">
            </div>
            
            <!-- Role Badge -->
            <div class="ship-brief-role" id="ship-brief-role">FLAGSHIP</div>
            
            <!-- Ship Name & Tagline -->
            <div class="ship-brief-title-section">
              <div class="ship-brief-title-name" id="ship-brief-title-name">RKLB · FLAGSHIP</div>
              <div class="ship-brief-title-tagline" id="ship-brief-title-tagline">Spearhead command ship.<br>Victory follows in its wake.</div>
            </div>
            
            <!-- Status Line -->
            <div class="ship-brief-authority" id="ship-brief-authority">
              <span class="ship-brief-authority-icon">◈</span>
              <span class="ship-brief-authority-text">COMMAND AUTHORITY ACTIVE</span>
            </div>
          </div>
          
          <!-- Right Panel: Ship Data -->
          <div class="ship-brief-data">
            <!-- Identity -->
            <div class="ship-brief-section ship-brief-identity">
              <div class="ship-brief-ticker" id="ship-brief-ticker">RKLB</div>
              <div class="ship-brief-name" id="ship-brief-name">ELECTRON</div>
              <div class="ship-brief-designation" id="ship-brief-designation">FSC-001</div>
            </div>
            
            <!-- Systems Status -->
            <div class="ship-brief-section">
              <div class="ship-brief-section-header">
                <span class="ship-brief-marker">▸</span>
                <span>SYSTEMS STATUS</span>
              </div>
              <div class="ship-brief-stats">
                <div class="ship-brief-stat">
                  <div class="ship-brief-stat-header">
                    <span class="ship-brief-stat-label">HULL INTEGRITY</span>
                    <span class="ship-brief-stat-value" id="ship-brief-hull-val">—</span>
                  </div>
                  <div class="ship-brief-stat-bar">
                    <div class="ship-brief-stat-fill hull" id="ship-brief-hull-bar"></div>
                  </div>
                </div>
                <div class="ship-brief-stat">
                  <div class="ship-brief-stat-header">
                    <span class="ship-brief-stat-label">CARGO HOLD</span>
                    <span class="ship-brief-stat-value" id="ship-brief-cargo-val">—</span>
                  </div>
                  <div class="ship-brief-stat-bar">
                    <div class="ship-brief-stat-fill cargo" id="ship-brief-cargo-bar"></div>
                  </div>
                </div>
                <div class="ship-brief-stat">
                  <div class="ship-brief-stat-header">
                    <span class="ship-brief-stat-label">FUEL RESERVES</span>
                    <span class="ship-brief-stat-value" id="ship-brief-fuel-val">—</span>
                  </div>
                  <div class="ship-brief-stat-bar">
                    <div class="ship-brief-stat-fill fuel" id="ship-brief-fuel-bar"></div>
                  </div>
                </div>
              </div>
              
              <!-- Ship Mood / Behavior Status -->
              <div class="ship-brief-mood" id="ship-brief-mood">
                <span class="mood-indicator mood-neutral"></span>
                <span class="mood-text">Standard operations</span>
              </div>
              
              <!-- Telemetry Traits (from 45-min data) -->
              <div class="ship-brief-traits" id="ship-brief-traits">
                <div class="trait-row" id="trait-hull" data-trait="hull">
                  <span class="trait-label">Hull:</span>
                  <span class="trait-value">—</span>
                </div>
                <div class="trait-row" id="trait-engine" data-trait="engine">
                  <span class="trait-label">Engine:</span>
                  <span class="trait-value">—</span>
                </div>
                <div class="trait-row" id="trait-stability" data-trait="stability">
                  <span class="trait-label">Stability:</span>
                  <span class="trait-value">—</span>
                </div>
                <div class="trait-row" id="trait-signal" data-trait="signal">
                  <span class="trait-label">Signal:</span>
                  <span class="trait-value">—</span>
                </div>
                <div class="trait-personality" id="trait-personality">
                  <span class="personality-archetype">—</span>
                  <span class="personality-summary">—</span>
                </div>
              </div>
            </div>
            
            <!-- Step 8: Pilot Progression -->
            <div class="ship-brief-section" id="ship-brief-progression-section">
              <div class="ship-brief-section-header">
                <span class="ship-brief-marker">▸</span>
                <span>PILOT PROGRESSION</span>
              </div>
              <div class="ship-brief-progression">
                <div class="ship-brief-level-row">
                  <span class="ship-brief-level-badge" id="ship-brief-level">LVL 1</span>
                  <div class="ship-brief-xp-bar">
                    <div class="ship-brief-xp-fill" id="ship-brief-xp-bar"></div>
                  </div>
                  <span class="ship-brief-xp-text" id="ship-brief-xp-text">0 / 100 XP</span>
                </div>
                <div class="ship-brief-upgrades" id="ship-brief-upgrades">
                  <span class="ship-brief-upgrade-slot" title="Thrusters" data-slot="thrusters">THR: —</span>
                  <span class="ship-brief-upgrade-slot" title="Hull" data-slot="hull">HUL: —</span>
                  <span class="ship-brief-upgrade-slot" title="Sensors" data-slot="sensors">SEN: —</span>
                  <span class="ship-brief-upgrade-slot" title="Weapons" data-slot="weapons">WPN: —</span>
                  <span class="ship-brief-upgrade-slot" title="Core" data-slot="core">COR: —</span>
                </div>
              </div>
            </div>
            
            <!-- Operations Data -->
            <div class="ship-brief-section">
              <div class="ship-brief-section-header">
                <span class="ship-brief-marker">▸</span>
                <span>OPERATIONS DATA</span>
              </div>
              <div class="ship-brief-ops">
                <div class="ship-brief-ops-item">
                  <span class="ship-brief-ops-label">POSITION VALUE</span>
                  <span class="ship-brief-ops-value" id="ship-brief-value">—</span>
                </div>
                <div class="ship-brief-ops-item">
                  <span class="ship-brief-ops-label">P&L STATUS</span>
                  <span class="ship-brief-ops-value" id="ship-brief-pnl">—</span>
                </div>
                <div class="ship-brief-ops-item">
                  <span class="ship-brief-ops-label">RETURN</span>
                  <span class="ship-brief-ops-value" id="ship-brief-return">—</span>
                </div>
                <div class="ship-brief-ops-item">
                  <span class="ship-brief-ops-label">MISSION STATUS</span>
                  <span class="ship-brief-ops-value" id="ship-brief-mission">—</span>
                </div>
              </div>
            </div>
            
            <!-- Observation Mode Notice -->
            <div class="ship-brief-notice" id="ship-brief-notice" style="display: none;">
              <span class="ship-brief-notice-icon">◎</span>
              <span class="ship-brief-notice-text">NO POSITION — OBSERVATION MODE</span>
            </div>
          </div>
        </div>
        
        <!-- Footer Actions -->
        <div class="ship-brief-footer">
          <button class="ship-brief-action secondary" id="ship-brief-action-mission">
            <span class="ship-brief-action-icon">⚔</span>
            ASSIGN MISSION
          </button>
          <button class="ship-brief-action primary" id="ship-brief-action-telemetry">
            <span class="ship-brief-action-icon">◈</span>
            VIEW TELEMETRY
          </button>
        </div>
      </div>
    `;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // DIALOG CREATION
  // ═══════════════════════════════════════════════════════════════════════════
  
  function ensureDialog() {
    if (dialogEl) return;
    
    dialogEl = document.createElement('div');
    dialogEl.id = 'ship-brief-dialog';
    dialogEl.className = 'ship-brief-dialog';
    dialogEl.innerHTML = createDialogHTML();
    document.body.appendChild(dialogEl);
    
    // Wire up event listeners
    const backdrop = dialogEl.querySelector('.ship-brief-backdrop');
    const closeBtn = dialogEl.querySelector('#ship-brief-close');
    const telemetryBtn = dialogEl.querySelector('#ship-brief-action-telemetry');
    const missionBtn = dialogEl.querySelector('#ship-brief-action-mission');
    
    backdrop.addEventListener('click', close);
    closeBtn.addEventListener('click', close);
    
    telemetryBtn.addEventListener('click', () => {
      if (currentTicker) {
        navigateToTelemetry(currentTicker);
      }
    });
    
    missionBtn.addEventListener('click', () => {
      if (currentTicker) {
        navigateToMissions(currentTicker);
      }
    });
    
    // Keyboard handling
    dialogEl.addEventListener('keydown', handleKeydown);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // DATA RESOLUTION
  // ═══════════════════════════════════════════════════════════════════════════
  
  function resolveShipData(ticker) {
    const data = {
      ticker: ticker,
      name: ticker,
      designation: 'UNK-XXX',
      sector: 'UNKNOWN',
      sprite: DEFAULT_SPRITE,
      color: '#33ff99',
      role: 'UTILITY',
      hasPosition: false,
      value: 0,
      pnl: 0,
      pnlPct: 0,
      shares: 0,
      hull: 50,
      cargo: 0,
      fuel: 50,
      isOperational: true,
      lore: SHIP_TAGLINES[ticker] || 'Unknown vessel. No registry data available.'
    };
    
    // Get ship names from global
    if (window.SHIP_NAMES && SHIP_NAMES[ticker]) {
      data.name = SHIP_NAMES[ticker].name || ticker;
      data.designation = SHIP_NAMES[ticker].designation || 'UNK-XXX';
    }
    
    // Get sprite from global
    if (window.SHIP_SPRITES && SHIP_SPRITES[ticker]) {
      data.sprite = SHIP_SPRITES[ticker];
    }
    
    // Get ticker color from global
    if (window.tickerColors && tickerColors[ticker]) {
      data.color = tickerColors[ticker];
    }
    
    // Get sector/theme from global
    if (window.tickerThemes && tickerThemes[ticker]) {
      data.sector = tickerThemes[ticker].toUpperCase();
    }
    
    // Get profile data (don't overwrite custom taglines)
    if (window.TICKER_PROFILES && TICKER_PROFILES[ticker]) {
      const profile = TICKER_PROFILES[ticker];
      // Only use profile description if we don't have a custom tagline
      if (!SHIP_TAGLINES[ticker]) {
        data.lore = profile.briefDescription || profile.overview || data.lore;
      }
    }
    
    // Get position data (check multiple sources)
    let position = null;
    
    // Check DEMO_STOCK_POSITIONS (index.html)
    if (window.DEMO_STOCK_POSITIONS) {
      position = DEMO_STOCK_POSITIONS.find(p => p.ticker === ticker);
    }
    
    // Check holdings from holdings manager if available
    if (!position && window.HoldingsManager) {
      const holdings = HoldingsManager.getAll?.() || [];
      position = holdings.find(h => h.ticker === ticker);
    }
    
    if (position) {
      data.hasPosition = true;
      data.shares = position.shares || 0;
      data.value = (position.shares || 0) * (position.current_price || position.price || 0);
      data.pnl = ((position.current_price || position.price || 0) - (position.entry_price || position.avgCost || 0)) * (position.shares || 0);
      data.pnlPct = position.entry_price ? ((position.current_price - position.entry_price) / position.entry_price * 100) : 0;
      data.isOperational = data.pnlPct >= 0;
      
      // Calculate stats based on position
      data.hull = Math.max(10, Math.min(100, 50 + data.pnlPct * 2));
      
      // Cargo as % of total portfolio
      if (window.DEMO_STOCK_POSITIONS) {
        const totalShares = DEMO_STOCK_POSITIONS.reduce((s, p) => s + (p.shares || 0), 0);
        data.cargo = totalShares > 0 ? Math.round((data.shares / totalShares) * 100) : 0;
      } else {
        data.cargo = Math.min(100, data.shares);
      }
      
      // Fuel is semi-random but deterministic per ticker
      data.fuel = 60 + (ticker.charCodeAt(0) % 30);
    }
    
    // Determine role based on data
    data.role = determineRole(ticker, data);
    
    // Get lore from pixel ship mapping if available (but keep custom taglines)
    if (window.mapTickerToPixelShip && window.PIXEL_SHIP_LORE) {
      const shipMeta = mapTickerToPixelShip(ticker, data.sector, data.pnlPct);
      const shipLore = PIXEL_SHIP_LORE[shipMeta?.pattern] || {};
      if (shipLore.label) data.role = shipLore.label;
      // Only use pixel ship lore if we don't have a custom tagline
      if (shipLore.lore && !SHIP_TAGLINES[ticker]) {
        data.lore = shipLore.lore;
      }
    }
    
    return data;
  }
  
  function determineRole(ticker, data) {
    // Flagship: highest value position or RKLB
    if (ticker === 'RKLB') return 'FLAGSHIP';
    
    // Check if this is the highest value position
    if (window.DEMO_STOCK_POSITIONS && data.hasPosition) {
      const sorted = [...DEMO_STOCK_POSITIONS].sort((a, b) => 
        (b.shares * b.current_price) - (a.shares * a.current_price)
      );
      if (sorted[0]?.ticker === ticker) return 'FLAGSHIP';
    }
    
    // Sector-based roles
    const sectorRoles = {
      'SPACE': 'ORBITAL',
      'EVTOL': 'ESCORT',
      'DEFENSE': 'TACTICAL',
      'MEME': 'WILDCARD',
      'MATERIALS': 'HAULER',
      'INDUSTRIAL': 'UTILITY'
    };
    
    return sectorRoles[data.sector] || 'UTILITY';
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // UI UPDATES
  // ═══════════════════════════════════════════════════════════════════════════
  
  function updateDialog(data) {
    // Set CSS custom property for ship color
    dialogEl.style.setProperty('--ship-color', data.color);
    
    // Ship image
    const img = dialogEl.querySelector('#ship-brief-img');
    img.src = data.sprite;
    img.alt = data.ticker + ' vessel';
    
    // Identity
    const tickerEl = dialogEl.querySelector('#ship-brief-ticker');
    tickerEl.textContent = data.ticker;
    tickerEl.style.color = data.color;
    
    dialogEl.querySelector('#ship-brief-name').textContent = data.name;
    dialogEl.querySelector('#ship-brief-designation').textContent = data.designation;
    
    // Role badge
    const roleEl = dialogEl.querySelector('#ship-brief-role');
    roleEl.textContent = data.role;
    roleEl.style.color = data.color;
    roleEl.style.borderColor = data.color;
    
    // Title section (name and tagline)
    const titleNameEl = dialogEl.querySelector('#ship-brief-title-name');
    const titleTaglineEl = dialogEl.querySelector('#ship-brief-title-tagline');
    if (titleNameEl) {
      titleNameEl.textContent = data.ticker + ' · ' + data.role;
      titleNameEl.style.color = data.color;
    }
    if (titleTaglineEl) {
      titleTaglineEl.innerHTML = data.lore || 'Unknown vessel configuration.';
    }
    
    // Authority line (show only for flagship or operational)
    const authorityEl = dialogEl.querySelector('#ship-brief-authority');
    if (data.role === 'FLAGSHIP') {
      authorityEl.querySelector('.ship-brief-authority-text').textContent = 'COMMAND AUTHORITY ACTIVE';
      authorityEl.style.display = '';
    } else if (data.hasPosition && data.isOperational) {
      authorityEl.querySelector('.ship-brief-authority-text').textContent = 'SYSTEMS NOMINAL';
      authorityEl.style.display = '';
    } else {
      authorityEl.style.display = 'none';
    }
    
    // Status bars (reset for animation)
    const hullBar = dialogEl.querySelector('#ship-brief-hull-bar');
    const cargoBar = dialogEl.querySelector('#ship-brief-cargo-bar');
    const fuelBar = dialogEl.querySelector('#ship-brief-fuel-bar');
    
    hullBar.style.width = '0%';
    cargoBar.style.width = '0%';
    fuelBar.style.width = '0%';
    
    hullBar.classList.toggle('damaged', !data.isOperational);
    
    dialogEl.querySelector('#ship-brief-hull-val').textContent = data.hasPosition ? data.hull.toFixed(0) + '%' : '—';
    dialogEl.querySelector('#ship-brief-cargo-val').textContent = data.hasPosition ? data.shares + ' UNITS' : '—';
    dialogEl.querySelector('#ship-brief-fuel-val').textContent = data.hasPosition ? data.fuel.toFixed(0) + '%' : '—';
    
    // Step 8: Pilot Progression
    updateProgressionSection(data.ticker);
    
    // Telemetry Traits (language that mirrors data)
    updateTelemetryTraits(data.ticker);
    
    // Operations data
    if (data.hasPosition) {
      dialogEl.querySelector('#ship-brief-value').textContent = '$' + data.value.toLocaleString(undefined, { maximumFractionDigits: 0 });
      
      const pnlEl = dialogEl.querySelector('#ship-brief-pnl');
      pnlEl.textContent = (data.pnl >= 0 ? '+' : '') + '$' + Math.abs(data.pnl).toFixed(0);
      pnlEl.className = 'ship-brief-ops-value ' + (data.pnl >= 0 ? 'positive' : 'negative');
      
      const returnEl = dialogEl.querySelector('#ship-brief-return');
      returnEl.textContent = (data.pnlPct >= 0 ? '+' : '') + data.pnlPct.toFixed(1) + '%';
      returnEl.className = 'ship-brief-ops-value ' + (data.pnlPct >= 0 ? 'positive' : 'negative');
      
      const missionEl = dialogEl.querySelector('#ship-brief-mission');
      missionEl.textContent = data.isOperational ? 'OPERATIONAL' : 'DAMAGED';
      missionEl.className = 'ship-brief-ops-value status-' + (data.isOperational ? 'operational' : 'damaged');
      
      dialogEl.querySelector('#ship-brief-notice').style.display = 'none';
    } else {
      // Observation mode
      dialogEl.querySelector('#ship-brief-value').textContent = '—';
      dialogEl.querySelector('#ship-brief-pnl').textContent = '—';
      dialogEl.querySelector('#ship-brief-pnl').className = 'ship-brief-ops-value';
      dialogEl.querySelector('#ship-brief-return').textContent = '—';
      dialogEl.querySelector('#ship-brief-return').className = 'ship-brief-ops-value';
      dialogEl.querySelector('#ship-brief-mission').textContent = 'STANDBY';
      dialogEl.querySelector('#ship-brief-mission').className = 'ship-brief-ops-value status-standby';
      
      dialogEl.querySelector('#ship-brief-notice').style.display = '';
    }
  }
  
  /**
   * Step 8: Update progression section in dialog
   */
  function updateProgressionSection(ticker) {
    const levelEl = dialogEl.querySelector('#ship-brief-level');
    const xpBarEl = dialogEl.querySelector('#ship-brief-xp-bar');
    const xpTextEl = dialogEl.querySelector('#ship-brief-xp-text');
    const upgradesEl = dialogEl.querySelector('#ship-brief-upgrades');
    
    // Get progression data
    const summary = window.Progression?.getShipSummary(ticker);
    const effects = window.Progression?.computeEffects(ticker);
    
    if (summary && effects) {
      // Level badge
      levelEl.textContent = 'LVL ' + summary.level;
      levelEl.style.color = summary.level >= 5 ? '#ffd700' : summary.level >= 3 ? '#47d4ff' : '#33ff99';
      
      // XP bar
      const xpProgress = Math.min(100, summary.progress * 100);
      xpBarEl.style.width = xpProgress + '%';
      xpTextEl.textContent = summary.xpIntoLevel + ' / ' + summary.nextXP + ' XP';
      
      // Upgrade slots
      const slotLabels = { thrusters: 'THR', hull: 'HUL', sensors: 'SEN', weapons: 'WPN', core: 'COR' };
      const slots = upgradesEl.querySelectorAll('.ship-brief-upgrade-slot');
      
      slots.forEach(slotEl => {
        const slotName = slotEl.dataset.slot;
        const upgradeId = effects.upgrades[slotName];
        const label = slotLabels[slotName] || slotName.toUpperCase().slice(0, 3);
        
        if (upgradeId) {
          const upgrade = window.ShipUpgrades?.getUpgrade(upgradeId);
          if (upgrade) {
            slotEl.textContent = label + ': T' + upgrade.tier;
            slotEl.title = upgrade.name;
            slotEl.classList.add('equipped');
          } else {
            slotEl.textContent = label + ': —';
            slotEl.classList.remove('equipped');
          }
        } else {
          slotEl.textContent = label + ': —';
          slotEl.classList.remove('equipped');
        }
      });
    } else {
      // No progression data
      levelEl.textContent = 'LVL 1';
      levelEl.style.color = '#33ff99';
      xpBarEl.style.width = '0%';
      xpTextEl.textContent = '0 / 100 XP';
      
      const slots = upgradesEl.querySelectorAll('.ship-brief-upgrade-slot');
      slots.forEach(slotEl => {
        const slotName = slotEl.dataset.slot;
        const slotLabels = { thrusters: 'THR', hull: 'HUL', sensors: 'SEN', weapons: 'WPN', core: 'COR' };
        slotEl.textContent = (slotLabels[slotName] || slotName.toUpperCase().slice(0, 3)) + ': —';
        slotEl.classList.remove('equipped');
      });
    }
  }
  
  /**
   * Update telemetry traits section with descriptive language
   * Shows traits as words, not numbers - making telemetry visible through language
   */
  function updateTelemetryTraits(ticker) {
    const traitsEl = dialogEl.querySelector('#ship-brief-traits');
    if (!traitsEl) return;
    
    // Check if telemetry is available
    if (!window.ShipTelemetry?.hasData(ticker)) {
      traitsEl.style.display = 'none';
      return;
    }
    
    traitsEl.style.display = '';
    const traits = ShipTelemetry.getTraitDescriptors(ticker);
    
    // Hull trait
    const hullRow = traitsEl.querySelector('#trait-hull');
    if (hullRow && traits.hull) {
      hullRow.querySelector('.trait-value').textContent = traits.hull.label;
      hullRow.title = traits.hull.tooltip;
      hullRow.dataset.mood = traits.hull.mood;
    }
    
    // Engine trait
    const engineRow = traitsEl.querySelector('#trait-engine');
    if (engineRow && traits.engine) {
      engineRow.querySelector('.trait-value').textContent = traits.engine.label;
      engineRow.title = traits.engine.tooltip;
      engineRow.dataset.mood = traits.engine.mood;
    }
    
    // Stability trait
    const stabilityRow = traitsEl.querySelector('#trait-stability');
    if (stabilityRow && traits.stability) {
      stabilityRow.querySelector('.trait-value').textContent = traits.stability.label;
      stabilityRow.title = traits.stability.tooltip;
      stabilityRow.dataset.mood = traits.stability.mood;
    }
    
    // Signal trait
    const signalRow = traitsEl.querySelector('#trait-signal');
    if (signalRow && traits.signal) {
      signalRow.querySelector('.trait-value').textContent = traits.signal.label;
      signalRow.title = traits.signal.tooltip;
      signalRow.dataset.mood = traits.signal.mood;
    }
    
    // Personality
    const personalityEl = traitsEl.querySelector('#trait-personality');
    if (personalityEl && traits.personality) {
      personalityEl.querySelector('.personality-archetype').textContent = traits.personality.archetype;
      personalityEl.querySelector('.personality-summary').textContent = traits.personality.summary;
      personalityEl.title = traits.personality.fantasy;
    }
  }
  
  function animateBars(data) {
    const hullBar = dialogEl.querySelector('#ship-brief-hull-bar');
    const cargoBar = dialogEl.querySelector('#ship-brief-cargo-bar');
    const fuelBar = dialogEl.querySelector('#ship-brief-fuel-bar');
    
    if (data.hasPosition) {
      hullBar.style.width = data.hull + '%';
      cargoBar.style.width = data.cargo + '%';
      fuelBar.style.width = data.fuel + '%';
    } else {
      hullBar.style.width = '50%';
      cargoBar.style.width = '0%';
      fuelBar.style.width = '50%';
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SCROLL & FOCUS MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  
  function lockScroll() {
    document.body.style.overflow = 'hidden';
    document.body.classList.add('ship-brief-open');
  }
  
  function unlockScroll() {
    document.body.style.overflow = '';
    document.body.classList.remove('ship-brief-open');
  }
  
  function trapFocus() {
    const focusable = dialogEl.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusable.length > 0) {
      focusable[0].focus();
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════
  
  function handleKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
    
    // Tab trapping
    if (e.key === 'Tab') {
      const focusable = dialogEl.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
  
  // Global ESC handler (in case focus is outside dialog)
  function globalKeydown(e) {
    if (e.key === 'Escape' && isVisible) {
      e.preventDefault();
      close();
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // NAVIGATION
  // ═══════════════════════════════════════════════════════════════════════════
  
  function navigateToTelemetry(ticker) {
    close();
    
    // If on index.html, switch to chart tab and select ticker
    if (window.selectTicker && window.switchTab) {
      selectTicker(ticker);
      switchTab('chart');
    } else {
      // Navigate to index.html with ticker param
      window.location.href = 'index.html?ticker=' + encodeURIComponent(ticker);
    }
  }
  
  function navigateToMissions(ticker) {
    close();
    
    // Navigate to derivatives.html (Mission Command) with ticker
    window.location.href = 'derivatives.html?ticker=' + encodeURIComponent(ticker);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SOUND EFFECTS (gated behind UI_SOUND_ENABLED)
  // ═══════════════════════════════════════════════════════════════════════════
  
  function playOpenSound() {
    if (!isSoundEnabled()) return;
    
    if (window.beep) {
      beep(220, 0.1);
      setTimeout(() => beep(330, 0.08), 100);
      setTimeout(() => beep(440, 0.08), 200);
    } else if (window.SoundFX) {
      SoundFX.play('click');
    }
  }
  
  function playCloseSound() {
    if (!isSoundEnabled()) return;
    
    if (window.beep) {
      beep(330, 0.05);
    } else if (window.SoundFX) {
      SoundFX.play('click');
    }
  }
  
  function playBarSound() {
    if (!isSoundEnabled()) return;
    
    if (window.beep) {
      beep(523, 0.05);
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Open the ship brief dialog
   * @param {string} ticker - Ticker symbol
   * @param {Object} opts - Options { source: 'fleet'|'telemetry'|'missions', ... }
   */
  function open(ticker, opts = {}) {
    if (!ticker) {
      console.warn('[ShipBrief] No ticker provided');
      return;
    }
    
    ensureDialog();
    
    currentTicker = ticker;
    options = opts;
    
    // Resolve ship data
    const data = resolveShipData(ticker);
    
    // Update dialog content
    updateDialog(data);
    
    // Store previous focus
    previousFocus = document.activeElement;
    
    // Lock scroll
    lockScroll();
    
    // Clear any existing timers from previous open
    clearAllTimers();
    
    // Reset boot animation
    const bootOverlay = dialogEl.querySelector('#ship-brief-boot');
    bootOverlay.classList.remove('done');
    
    // Show dialog
    dialogEl.classList.remove('hidden');
    requestAnimationFrame(() => {
      dialogEl.classList.add('visible');
    });
    
    isVisible = true;
    
    // Play sound
    playOpenSound();
    
    // Add global ESC listener
    document.addEventListener('keydown', globalKeydown);
    
    // Boot animation sequence (tracked for cleanup)
    bootTimer = setTimeout(() => {
      if (!isVisible) return; // Guard against close during animation
      bootOverlay.classList.add('done');
      
      // Animate bars after boot
      barTimer = setTimeout(() => {
        if (!isVisible) return;
        animateBars(data);
        playBarSound();
      }, 200);
      
      // Trap focus after animation
      focusTimer = setTimeout(() => {
        if (!isVisible) return;
        trapFocus();
      }, 100);
    }, 600);
    
    // Dispatch event (include dialog reference for behavior system)
    window.dispatchEvent(new CustomEvent('shipbrief:open', { 
      detail: { 
        ticker, 
        source: opts.source || 'unknown',
        dialog: dialogEl
      } 
    }));
    
    // Initialize ship behavior system
    if (window.ShipBehaviorBridge) {
      setTimeout(() => {
        ShipBehaviorBridge.initShipBrief(dialogEl, ticker);
      }, 650); // After boot animation
    }
    
    // Log if terminal available
    if (window.logTerminal) {
      logTerminal('SHIP BRIEF: ' + ticker + ' [' + data.name + '] accessed');
    }
  }
  
  /**
   * Clear all pending timers
   */
  function clearAllTimers() {
    if (bootTimer) { clearTimeout(bootTimer); bootTimer = null; }
    if (barTimer) { clearTimeout(barTimer); barTimer = null; }
    if (focusTimer) { clearTimeout(focusTimer); focusTimer = null; }
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
  }
  
  /**
   * Close the ship brief dialog
   */
  function close() {
    if (!dialogEl || !isVisible) return;
    
    const closingTicker = currentTicker;
    
    // Clear all pending timers
    clearAllTimers();
    
    // Hide dialog
    dialogEl.classList.remove('visible');
    
    closeTimer = setTimeout(() => {
      dialogEl.classList.add('hidden');
      currentTicker = null;
      isVisible = false;
    }, 300);
    
    // Unlock scroll
    unlockScroll();
    
    // Remove global ESC listener
    document.removeEventListener('keydown', globalKeydown);
    
    // Restore focus
    if (previousFocus && previousFocus.focus) {
      previousFocus.focus();
    }
    previousFocus = null;
    
    // Play sound
    playCloseSound();
    
    // Dispatch event
    window.dispatchEvent(new CustomEvent('shipbrief:close', { 
      detail: { ticker: closingTicker } 
    }));
    
    // Log if terminal available
    if (window.logTerminal) {
      logTerminal('ship brief closed');
    }
  }
  
  /**
   * Check if dialog is currently open
   * @returns {boolean}
   */
  function isOpen() {
    return isVisible;
  }
  
  /**
   * Get current ticker shown in dialog
   * @returns {string|null}
   */
  function getCurrentTicker() {
    return currentTicker;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // LEGACY COMPATIBILITY
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Alias for backward compatibility
  window.openShipBrief = open;
  window.closeShipBrief = close;
  window.isShipBriefOpen = isOpen;
  
  // Replace legacy openVesselDossier if it exists
  // This allows existing code to continue working
  window.openVesselDossier = function(ticker) {
    open(ticker, { source: 'legacy' });
  };
  
  window.closeVesselDossier = close;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RETURN PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════
  
  return {
    open,
    close,
    isOpen,
    getCurrentTicker
  };
  
})();
