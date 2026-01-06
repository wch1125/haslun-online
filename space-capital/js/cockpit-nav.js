// =========================================================================
// COCKPIT NAVIGATION CONTROLLER
// Three pillars: HANGAR | BATTLE ARENA | NEWS
// =========================================================================

(function() {
  'use strict';

  const CockpitNav = {
    currentPanel: 'hangar',
    selectedShip: 'RKLB',
    ships: ['RKLB', 'ACHR', 'LUNR', 'JOBY', 'ASTS', 'BKSY', 'GME', 'GE', 'KTOS', 'LHX', 'PL', 'RDW', 'RTX', 'COHR', 'EVEX'],
    
    init() {
      // Add cockpit-active class to body
      document.body.classList.add('cockpit-active');
      
      this.bindNavigation();
      this.initHangar();
      this.initBattleArena();
      this.initNews();
      this.initHullColorPickers(); // Wire up hull color buttons
      
      // Start with hangar panel visible
      this.switchPanel('hangar');
      
      // Keyboard shortcuts
      document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        if (e.key === '1') this.switchPanel('hangar');
        if (e.key === '2') this.switchPanel('battle');
        if (e.key === '3') this.switchPanel('news');
        if (e.key === 'b' || e.key === 'B') this.launchBattle();
      });
      
      console.log('[CockpitNav] Initialized - 3 Panel Architecture Active');
      console.log('[CockpitNav] Hull color system wired');
      console.log('[CockpitNav] Ship idle animations enabled');
    },
    
    bindNavigation() {
      document.querySelectorAll('.hud-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const panel = btn.dataset.panel;
          if (panel) this.switchPanel(panel);
        });
      });
    },
    
    switchPanel(panel) {
      this.currentPanel = panel;
      
      // Update HUD buttons
      document.querySelectorAll('.hud-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.panel === panel);
      });
      
      // Hide ALL old tab panels
      document.querySelectorAll('.tab-panel').forEach(p => {
        p.classList.remove('active');
        p.style.display = 'none';
      });
      
      // Hide all cockpit panels first
      document.querySelectorAll('.cockpit-panel').forEach(p => {
        p.classList.remove('active');
        p.style.display = 'none';
      });
      
      // Show the appropriate panel(s)
      if (panel === 'hangar') {
        // Show the new hangar panel
        const hangarNew = document.getElementById('hangar-panel-new');
        if (hangarNew) {
          hangarNew.classList.add('active');
          hangarNew.style.display = 'block';
        }
        // Also show the old hangar for the Fleet Command sidebar data
        const hangarOld = document.getElementById('hangar-panel');
        if (hangarOld) {
          hangarOld.style.display = 'none'; // Keep old one hidden, we use new layout
        }
      } else if (panel === 'battle') {
        const battlePanel = document.getElementById('battle-panel');
        if (battlePanel) {
          battlePanel.classList.add('active');
          battlePanel.style.display = 'block';
        }
        this.showBattleReady();
      } else if (panel === 'news') {
        const newsPanel = document.getElementById('news-panel');
        if (newsPanel) {
          newsPanel.classList.add('active');
          newsPanel.style.display = 'block';
        }
        this.populateNewsFeed(); // Refresh news
      }
      
      // Hide sidebar on mobile when not in hangar
      const sidebar = document.querySelector('.sidebar');
      if (sidebar && window.innerWidth < 1024) {
        sidebar.style.display = 'none'; // Always hide sidebar on mobile for cockpit view
      }
    },
    
    // -------------------------------------------------------------------------
    // HANGAR - Ship Display & Stats
    // -------------------------------------------------------------------------
    initHangar() {
      this.renderShipSelector();
      this.updateShipDisplay();
    },
    
    renderShipSelector() {
      const grid = document.getElementById('ship-selector-grid');
      if (!grid) return;
      
      grid.innerHTML = this.ships.map(ticker => {
        const sprite = window.SHIP_SPRITES?.[ticker] || window.DEFAULT_SHIP_SPRITE;
        return `
          <button class="ship-selector-btn ${ticker === this.selectedShip ? 'active' : ''}" 
                  data-ticker="${ticker}" 
                  title="${ticker}">
            <img src="${sprite}" alt="${ticker}">
          </button>
        `;
      }).join('');
      
      grid.querySelectorAll('.ship-selector-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.selectShip(btn.dataset.ticker);
        });
      });
    },
    
    selectShip(ticker) {
      this.selectedShip = ticker;
      
      document.querySelectorAll('.ship-selector-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.ticker === ticker);
      });
      
      this.updateShipDisplay();
    },
    
    // Current livery state
    livery: {
      hull: '#33ff99',
      accent: '#33ff99'
    },
    
    updateShipDisplay() {
      const ticker = this.selectedShip;
      const tele = window.ShipTelemetry?.getTelemetry?.(ticker) || {};
      const sprite = window.SHIP_SPRITES?.[ticker] || window.DEFAULT_SHIP_SPRITE;
      const shipClass = window.ShipTelemetry?.getSuggestedClass?.(ticker) || 'UNKNOWN CLASS';
      
      // Update sprite
      const spriteEl = document.getElementById('hangar-ship-sprite');
      if (spriteEl) {
        spriteEl.src = sprite;
        spriteEl.alt = ticker;
        
        // Apply hull color tint via CSS filter
        this.applyHullColorToSprite(spriteEl);
      }
      
      // Update nameplate
      const tickerEl = document.getElementById('hangar-ship-ticker');
      const classEl = document.getElementById('hangar-ship-class');
      if (tickerEl) tickerEl.textContent = ticker;
      if (classEl) classEl.textContent = shipClass;
      
      // Update stats
      this.updateStatBars(tele);
      
      // Update battle preview
      this.updateBattlePreview();
      
      // Start idle animation on the ship showcase
      this.startShipIdleAnimation(ticker, shipClass);
    },
    
    // =========================================================================
    // HULL COLOR SYSTEM
    // =========================================================================
    
    initHullColorPickers() {
      // Find all hull color swatches
      document.querySelectorAll('.color-picker-row').forEach((row, rowIndex) => {
        const isAccent = rowIndex === 1; // Second row is accent colors
        
        row.querySelectorAll('.color-swatch').forEach(swatch => {
          swatch.style.cursor = 'pointer';
          swatch.addEventListener('click', () => {
            const color = swatch.style.background || swatch.style.backgroundColor;
            
            // Update active state
            row.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');
            
            // Update livery
            if (isAccent) {
              this.livery.accent = color;
            } else {
              this.livery.hull = color;
            }
            
            // Redraw ship with new colors
            const spriteEl = document.getElementById('hangar-ship-sprite');
            if (spriteEl) {
              this.applyHullColorToSprite(spriteEl);
            }
            
            // Log the change
            console.log(`[CockpitNav] ${isAccent ? 'Accent' : 'Hull'} color set to ${color}`);
          });
        });
      });
    },
    
    applyHullColorToSprite(spriteEl) {
      if (!spriteEl) return;
      
      const hullColor = this.livery.hull;
      
      // Convert color to HSL for filter calculation
      const hsl = this.hexToHsl(hullColor);
      
      // Build CSS filter to tint the sprite
      // sepia(1) makes it brown, then hue-rotate shifts to target color
      const hueRotate = hsl.h - 50; // Offset from sepia base
      const saturation = hsl.s / 50 * 100; // Boost saturation
      const brightness = hsl.l / 50 * 100;
      
      // Apply subtle color overlay effect
      spriteEl.style.filter = `
        drop-shadow(0 0 20px ${hullColor}40)
        drop-shadow(0 0 40px ${hullColor}20)
      `;
      
      // Add glow ring effect to showcase
      const showcase = spriteEl.closest('.ship-showcase');
      if (showcase) {
        showcase.style.setProperty('--ship-glow-color', hullColor);
        const ring = showcase.querySelector('.ship-showcase-ring');
        if (ring) {
          ring.style.borderColor = hullColor;
          ring.style.boxShadow = `0 0 30px ${hullColor}40, inset 0 0 30px ${hullColor}20`;
        }
      }
    },
    
    hexToHsl(hex) {
      // Handle rgb() format
      if (hex.startsWith('rgb')) {
        const match = hex.match(/(\d+)/g);
        if (match) {
          const [r, g, b] = match.map(Number);
          return this.rgbToHsl(r, g, b);
        }
      }
      
      // Handle hex format
      let color = hex.replace('#', '');
      if (color.length === 3) {
        color = color.split('').map(c => c + c).join('');
      }
      
      const r = parseInt(color.substr(0, 2), 16) / 255;
      const g = parseInt(color.substr(2, 2), 16) / 255;
      const b = parseInt(color.substr(4, 2), 16) / 255;
      
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h, s, l = (max + min) / 2;
      
      if (max === min) {
        h = s = 0;
      } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: h = ((b - r) / d + 2) / 6; break;
          case b: h = ((r - g) / d + 4) / 6; break;
        }
      }
      
      return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
    },
    
    rgbToHsl(r, g, b) {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h, s, l = (max + min) / 2;
      
      if (max === min) {
        h = s = 0;
      } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: h = ((b - r) / d + 2) / 6; break;
          case b: h = ((r - g) / d + 4) / 6; break;
        }
      }
      
      return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
    },
    
    // =========================================================================
    // SHIP IDLE ANIMATION
    // =========================================================================
    
    startShipIdleAnimation(ticker, shipClass) {
      // Find the ship showcase container (parent of the sprite)
      const showcase = document.querySelector('.ship-showcase');
      if (!showcase) return;
      
      // Stop any existing animation
      if (window.ShipIdleAnimation) {
        window.ShipIdleAnimation.stop(showcase);
        
        // Start new animation with ship-specific parameters
        window.ShipIdleAnimation.start(showcase, {
          ticker: ticker,
          shipClass: this.getShipClassType(shipClass),
          engineGlow: true
        });
      }
    },
    
    getShipClassType(classLabel) {
      // Map full class labels to animation preset keys
      const mapping = {
        'FLAGSHIP CLASS': 'Flagship',
        'FLAGSHIP': 'Flagship',
        'CARRIER CLASS': 'Carrier',
        'CARRIER': 'Carrier',
        'FIGHTER CLASS': 'Fighter',
        'FIGHTER': 'Fighter',
        'SCOUT CLASS': 'Scout',
        'SCOUT': 'Scout',
        'DRONE CLASS': 'Drone',
        'DRONE': 'Drone',
        'LANDER CLASS': 'Lander',
        'LANDER': 'Lander',
        'EVTOL CLASS': 'eVTOL',
        'LIGHT CLASS': 'eVTOL',
        'CARGO CLASS': 'Cargo',
        'HAULER CLASS': 'Cargo',
        'HAULER': 'Cargo',
        'RELAY CLASS': 'Relay',
        'RELAY': 'Relay',
        'COMMUNICATIONS': 'Relay',
        'RECON CLASS': 'Recon',
        'RECON': 'Recon',
        'MOONSHOT CLASS': 'Moonshot',
        'MOONSHOT': 'Moonshot',
        'WILDCARD': 'Moonshot'
      };
      
      return mapping[classLabel?.toUpperCase()] || 'default';
    },
    
    updateStatBars(tele) {
      const stats = {
        'thrust': { value: tele.thrustPotential || 0, label: 'THRUST' },
        'stability': { value: tele.maneuverStability || 0, label: 'STABILITY' },
        'hull': { value: tele.hullResilience || 0, label: 'HULL' },
        'signal': { value: tele.signalClarity || 0, label: 'SIGNAL' },
        'chop': { value: tele.chopSensitivity || 0, label: 'VOLATILITY' }
      };
      
      Object.entries(stats).forEach(([key, stat]) => {
        const bar = document.getElementById(`stat-bar-${key}`);
        const value = document.getElementById(`stat-value-${key}`);
        const pct = Math.round(stat.value * 100);
        
        if (bar) bar.style.width = `${pct}%`;
        if (value) value.textContent = pct;
      });
      
      // Regime bias
      const regimeEl = document.getElementById('ship-regime');
      if (regimeEl) {
        const regime = tele.regimeBias || 'RANGE';
        regimeEl.textContent = regime.toUpperCase();
        regimeEl.className = `regime-badge regime-${regime.toLowerCase()}`;
      }
    },
    
    // -------------------------------------------------------------------------
    // BATTLE ARENA
    // -------------------------------------------------------------------------
    initBattleArena() {
      const startBtn = document.getElementById('battle-start-btn');
      if (startBtn) {
        startBtn.addEventListener('click', () => this.launchBattle());
      }
      
      const randomBtn = document.getElementById('battle-random-btn');
      if (randomBtn) {
        randomBtn.addEventListener('click', () => this.randomizeOpponent());
      }
    },
    
    showBattleReady() {
      this.updateBattlePreview();
    },
    
    updateBattlePreview() {
      const playerSprite = document.getElementById('battle-player-sprite');
      const playerTicker = document.getElementById('battle-player-ticker');
      const opponentSprite = document.getElementById('battle-opponent-sprite');
      const opponentTicker = document.getElementById('battle-opponent-ticker');
      
      const playerShip = this.selectedShip;
      const opponentShip = this.getRandomOpponent(playerShip);
      
      if (playerSprite) playerSprite.src = window.SHIP_SPRITES?.[playerShip] || window.DEFAULT_SHIP_SPRITE;
      if (playerTicker) playerTicker.textContent = playerShip;
      if (opponentSprite) opponentSprite.src = window.SHIP_SPRITES?.[opponentShip] || window.DEFAULT_SHIP_SPRITE;
      if (opponentTicker) opponentTicker.textContent = opponentShip;
      
      this._currentOpponent = opponentShip;
    },
    
    getRandomOpponent(exclude) {
      const pool = this.ships.filter(s => s !== exclude);
      return pool[Math.floor(Math.random() * pool.length)] || 'ACHR';
    },
    
    randomizeOpponent() {
      this._currentOpponent = this.getRandomOpponent(this.selectedShip);
      
      const opponentSprite = document.getElementById('battle-opponent-sprite');
      const opponentTicker = document.getElementById('battle-opponent-ticker');
      
      if (opponentSprite) opponentSprite.src = window.SHIP_SPRITES?.[this._currentOpponent] || window.DEFAULT_SHIP_SPRITE;
      if (opponentTicker) opponentTicker.textContent = this._currentOpponent;
    },
    
    launchBattle() {
      const player = this.selectedShip;
      const opponent = this._currentOpponent || this.getRandomOpponent(player);
      
      if (window.BeyArena) {
        window.BeyArena.open(player, opponent);
      } else {
        console.warn('[CockpitNav] BeyArena not loaded');
      }
    },
    
    // -------------------------------------------------------------------------
    // NEWS Feed
    // -------------------------------------------------------------------------
    initNews() {
      this.populateNewsFeed();
    },
    
    populateNewsFeed() {
      const feed = document.getElementById('news-feed');
      if (!feed) return;
      
      // Generate some dynamic news based on telemetry
      const newsItems = this.generateNewsItems();
      
      feed.innerHTML = newsItems.map(item => `
        <div class="news-card">
          <div class="news-card-icon ${item.type}">${item.icon}</div>
          <div class="news-card-content">
            <div class="news-card-type ${item.type}">${item.typeLabel}</div>
            <div class="news-card-title">${item.title}</div>
            <div class="news-card-body">${item.body}</div>
            <div class="news-card-time">${item.time}</div>
          </div>
        </div>
      `).join('');
    },
    
    generateNewsItems() {
      const items = [];
      const tele = window.ShipTelemetry;
      
      // Find top performers by thrust
      if (tele) {
        const allTele = tele.getAllTelemetry?.() || {};
        const sorted = Object.entries(allTele)
          .sort((a, b) => (b[1].thrustPotential || 0) - (a[1].thrustPotential || 0));
        
        if (sorted[0]) {
          items.push({
            type: 'alert',
            typeLabel: 'TOP PERFORMER',
            icon: '🚀',
            title: `${sorted[0][0]} Leading Fleet Thrust Rankings`,
            body: `With a thrust potential of ${Math.round((sorted[0][1].thrustPotential || 0) * 100)}%, this vessel is currently the most aggressive in the fleet.`,
            time: 'Updated moments ago'
          });
        }
        
        // Find most stable
        const stableSorted = Object.entries(allTele)
          .sort((a, b) => (b[1].maneuverStability || 0) - (a[1].maneuverStability || 0));
        
        if (stableSorted[0]) {
          items.push({
            type: '',
            typeLabel: 'STABILITY REPORT',
            icon: '⚖️',
            title: `${stableSorted[0][0]} Maintains Steadiest Course`,
            body: `Maneuver stability at ${Math.round((stableSorted[0][1].maneuverStability || 0) * 100)}%. Recommended for defensive arena strategies.`,
            time: '3 minutes ago'
          });
        }
        
        // Find most chaotic
        const chaoticSorted = Object.entries(allTele)
          .filter(([_, t]) => t.regimeBias === 'chaotic');
        
        if (chaoticSorted.length > 0) {
          items.push({
            type: 'lore',
            typeLabel: 'VOLATILITY WARNING',
            icon: '⚡',
            title: `Chaotic Regime Detected: ${chaoticSorted.map(c => c[0]).join(', ')}`,
            body: 'These vessels are experiencing turbulent market conditions. Expect erratic arena behavior and burst potential.',
            time: '7 minutes ago'
          });
        }
      }
      
      // Static lore items
      items.push({
        type: 'lore',
        typeLabel: 'FLEET LORE',
        icon: '📜',
        title: 'The RKLB Doctrine',
        body: '"In the void between earnings calls, only thrust matters." — Admiral Electron, 3rd Fleet Commander',
        time: '1 hour ago'
      });
      
      items.push({
        type: '',
        typeLabel: 'SYSTEM',
        icon: '🛠️',
        title: 'Battle Arena Now Online',
        body: 'The new telemetry-driven arena system is active. Ship stats directly influence battle physics. May the best telemetry win.',
        time: '2 hours ago'
      });
      
      items.push({
        type: 'lore',
        typeLabel: 'INTERCEPTED TRANSMISSION',
        icon: '📡',
        title: '"They\'re not stocks, they\'re souls."',
        body: 'Unverified transmission detected from Sector GME. Analysts remain skeptical. Retail pilots remain diamond-handed.',
        time: '4 hours ago'
      });
      
      return items;
    }
  };
  
  // Expose globally
  window.CockpitNav = CockpitNav;
  
  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    // Small delay to ensure other systems are loaded
    setTimeout(() => CockpitNav.init(), 100);
  });
  
})();
