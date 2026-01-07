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
      
      // Also hide the sidebar on mobile when switching
      const sidebar = document.querySelector('.sidebar');
      if (sidebar && window.innerWidth < 1024) {
        sidebar.style.display = panel === 'hangar' ? 'none' : 'none';
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
