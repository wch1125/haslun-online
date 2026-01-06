/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SPACE CAPITAL - REFIT BAY (Ship Paint Bay)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Redesigned to feel like a place in the world, not a settings modal.
 * "The Hangar lights dimmed, cranes engaged, your ship slid into the rig."
 * 
 * Features:
 * - Fleet grid selection (click ships, not dropdowns)
 * - Live preview (instant feedback, no heavy "apply")
 * - Animated palette generation (glazing layers fade in)
 * - Class-aware color distribution
 * - Contextual actions ("Commit Livery", "Archive Blueprint")
 * 
 * Color theory from: Haslun Watercolor Lab (glazing simulation)
 * ═══════════════════════════════════════════════════════════════════════════
 */

window.PaintBay = (function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // COLOR THEORY ENGINE (adapted from watercolor lab)
  // ═══════════════════════════════════════════════════════════════════════════

  const TRANSPARENCY_MAP = {
    'transparent': 0.45,
    'semi-transparent': 0.55,
    'semi-opaque': 0.70,
    'opaque': 0.85,
  };

  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : [0, 0, 0];
  }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b]
      .map(x => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }

  function lerpColor(colorA, colorB, t) {
    const rgbA = hexToRgb(colorA);
    const rgbB = hexToRgb(colorB);
    const mixed = rgbA.map((a, i) => Math.round(a + (rgbB[i] - a) * t));
    return rgbToHex(...mixed);
  }

  function glazeColors(baseHex, topHex, transparency = 'semi-transparent') {
    const baseRgb = hexToRgb(baseHex);
    const topRgb = hexToRgb(topHex);
    const opacity = TRANSPARENCY_MAP[transparency];

    let result;
    if (transparency === 'opaque') {
      result = baseRgb.map((v, i) => v * (1 - opacity * 0.8) + topRgb[i] * opacity * 0.8);
    } else {
      const mult = baseRgb.map((v, i) => (v / 255) * (topRgb[i] / 255) * 255);
      result = baseRgb.map((v, i) => v * (1 - opacity) + (mult[i] * 0.6 + topRgb[i] * 0.4) * opacity);
    }

    return rgbToHex(...result);
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
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
    return [h * 360, s * 100, l * 100];
  }

  function hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PALETTE GENERATION
  // ═══════════════════════════════════════════════════════════════════════════

  function generatePalette(baseColors) {
    if (!baseColors || baseColors.length < 2) return null;

    const primary = baseColors[0];
    const secondary = baseColors[1];
    const tertiary = baseColors[2] || null;

    const palette = {
      name: 'Custom Glazing',
      colors: []
    };

    // Layer 1: Primary wash (base)
    palette.colors.push({
      hex: primary,
      name: 'Primary Wash',
      layer: 'base'
    });

    // Layer 2: Secondary glaze
    palette.colors.push({
      hex: secondary,
      name: 'Secondary Glaze',
      layer: 'trim'
    });

    // Layer 3: Glazed blend
    const glazed = glazeColors(primary, secondary, 'semi-transparent');
    palette.colors.push({
      hex: glazed,
      name: 'Glazed Blend',
      layer: 'blend'
    });

    // Layer 4: Highlight (lighter primary)
    const primaryHsl = rgbToHsl(...hexToRgb(primary));
    const highlight = rgbToHex(...hslToRgb(
      primaryHsl[0],
      Math.max(0, primaryHsl[1] - 20),
      Math.min(90, primaryHsl[2] + 25)
    ));
    palette.colors.push({
      hex: highlight,
      name: 'Highlight',
      layer: 'highlight'
    });

    // Layer 5: Shadow (darker secondary)
    const secondaryHsl = rgbToHsl(...hexToRgb(secondary));
    const shadow = rgbToHex(...hslToRgb(
      secondaryHsl[0],
      Math.min(100, secondaryHsl[1] + 10),
      Math.max(10, secondaryHsl[2] - 25)
    ));
    palette.colors.push({
      hex: shadow,
      name: 'Shadow',
      layer: 'shadow'
    });

    // Layer 6: Tertiary tint (if provided)
    if (tertiary) {
      const tint = glazeColors(glazed, tertiary, 'transparent');
      palette.colors.push({
        hex: tint,
        name: 'Detail Tint',
        layer: 'detail'
      });
    }

    return palette;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SPRITE RECOLORING
  // ═══════════════════════════════════════════════════════════════════════════

  function extractDominantColors(imageData, maxColors = 8) {
    const colorCounts = new Map();
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      
      const r = Math.round(data[i] / 32) * 32;
      const g = Math.round(data[i + 1] / 32) * 32;
      const b = Math.round(data[i + 2] / 32) * 32;
      const key = `${r},${g},${b}`;
      colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
    }

    const sorted = [...colorCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxColors)
      .map(([key]) => {
        const [r, g, b] = key.split(',').map(Number);
        return rgbToHex(r, g, b);
      });

    return sorted;
  }

  function createColorMap(originalColors, palette) {
    const map = new Map();
    const paletteColors = palette.colors.map(c => c.hex);

    originalColors.forEach((original, index) => {
      const targetIndex = index % paletteColors.length;
      map.set(original, paletteColors[targetIndex]);
    });

    return map;
  }

  function applyPaletteToSprite(imageData, colorMap) {
    const data = new Uint8ClampedArray(imageData.data);

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;

      const r = Math.round(data[i] / 32) * 32;
      const g = Math.round(data[i + 1] / 32) * 32;
      const b = Math.round(data[i + 2] / 32) * 32;
      const key = rgbToHex(r, g, b);

      if (colorMap.has(key)) {
        const newColor = hexToRgb(colorMap.get(key));
        data[i] = newColor[0];
        data[i + 1] = newColor[1];
        data[i + 2] = newColor[2];
      }
    }

    return new ImageData(data, imageData.width, imageData.height);
  }

  async function recolorSprite(image, baseColors) {
    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = image.width;
        canvas.height = image.height;

        ctx.drawImage(image, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const originalColors = extractDominantColors(imageData);
        const palette = generatePalette(baseColors);
        
        if (!palette) {
          resolve(canvas);
          return;
        }

        const colorMap = createColorMap(originalColors, palette);
        const newImageData = applyPaletteToSprite(imageData, colorMap);
        ctx.putImageData(newImageData, 0, 0);
        resolve(canvas);
      } catch (err) {
        reject(err);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FLEET LIVERIES (PRESETS)
  // ═══════════════════════════════════════════════════════════════════════════

  const FLEET_LIVERIES = [
    { id: 'phosphor', name: 'Phosphor Green', hint: 'Terminal classic', colors: ['#33FF99', '#1A332E'] },
    { id: 'plasma', name: 'Plasma Core', hint: 'Reactor heat', colors: ['#FF6B35', '#FFD93D', '#4ECDC4'] },
    { id: 'void', name: 'Void Walker', hint: 'Deep space', colors: ['#7B2CBF', '#3C096C', '#10002B'] },
    { id: 'solar', name: 'Solar Flare', hint: 'Sun-powered', colors: ['#FF6B6B', '#FFE66D'] },
    { id: 'arctic', name: 'Arctic Ops', hint: 'Cold precision', colors: ['#48CAE4', '#CAF0F8', '#023E8A'] },
    { id: 'rust', name: 'Rust Belt', hint: 'Industrial', colors: ['#A44A3F', '#D4A373', '#463F3A'] },
    { id: 'neon', name: 'Neon District', hint: 'Cyberpunk', colors: ['#F72585', '#4CC9F0', '#7209B7'] },
    { id: 'forest', name: 'Forest Camo', hint: 'Concealment', colors: ['#2D5016', '#8B9A46', '#3D2914'] },
    { id: 'gold', name: 'Golden Fleet', hint: 'Prestige', colors: ['#FFD700', '#B8860B', '#1C1C1C'] },
    { id: 'stealth', name: 'Stealth Mode', hint: 'Low vis', colors: ['#2B2D42', '#8D99AE', '#14213D'] },
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════

  let state = {
    selectedShip: null,
    shipImage: null,
    baseColors: ['#33FF99', '#1A332E'],
    originalColors: ['#33FF99', '#1A332E'],
    activeLivery: null,
    isDirty: false,
    isProcessing: false,
  };

  let dom = {};
  let updateTimeout = null;

  // ═══════════════════════════════════════════════════════════════════════════
  // UI RENDERING
  // ═══════════════════════════════════════════════════════════════════════════

  function init(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = renderHTML();
    cacheDom(container);
    bindEvents();
    populateFleetGrid();
    populateCustomLiveries();
    renderPalette();
    
    // Auto-select ship from hangar if available
    const hangarShip = window.currentHangarTicker || localStorage.getItem('space_capital_selected_ship');
    if (hangarShip) {
      selectShip(hangarShip);
    }
  }

  function populateCustomLiveries() {
    if (!window.LiverySystem) return;

    const customGrid = dom.container?.querySelector('#custom-livery-grid');
    const header = dom.container?.querySelector('#custom-liveries-header');
    if (!customGrid) return;

    const customLiveries = LiverySystem.getCustomLiveries();
    
    if (customLiveries.length === 0) {
      customGrid.style.display = 'none';
      if (header) header.style.display = 'none';
      return;
    }

    if (header) header.style.display = 'block';
    customGrid.style.display = 'grid';

    customGrid.innerHTML = customLiveries.map(livery => `
      <div class="livery-card custom" data-livery="${livery.id}" data-system-livery="true" title="${livery.description || livery.name}">
        <div class="livery-preview">
          ${livery.palette.baseColors.slice(0, 3).map(c => `<span style="background: ${c}"></span>`).join('')}
        </div>
        <div class="livery-name">${livery.name}</div>
        <button class="livery-delete" data-delete="${livery.id}" title="Delete livery">×</button>
      </div>
    `).join('');

    // Bind delete handlers
    customGrid.querySelectorAll('.livery-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const liveryId = btn.dataset.delete;
        if (confirm('Delete this custom livery?')) {
          LiverySystem.deleteLivery(liveryId);
          populateCustomLiveries();
        }
      });
    });

    // Bind selection handlers
    customGrid.querySelectorAll('.livery-card').forEach(card => {
      card.addEventListener('click', () => {
        const liveryId = card.dataset.livery;
        applySystemLivery(liveryId);
      });
    });
  }

  function applySystemLivery(liveryId) {
    if (!window.LiverySystem) return;

    const livery = LiverySystem.getLivery(liveryId);
    if (!livery) return;

    // Update state with livery colors
    state.baseColors = [...livery.palette.baseColors];
    state.activeLivery = liveryId;
    setDirty(true);

    // Update color inputs
    updateColorInputs();

    // Clear old selections
    dom.liveryGrid?.querySelectorAll('.livery-card').forEach(card => {
      card.classList.remove('active');
    });
    dom.container?.querySelectorAll('#custom-livery-grid .livery-card').forEach(card => {
      card.classList.toggle('active', card.dataset.livery === liveryId);
    });

    // Update palette and preview
    renderPalette();
    debouncedUpdate();
  }

  function renderHTML() {
    return `
      <div class="refit-bay">
        <div class="refit-bay-content">
          <!-- Status Bar -->
          <div class="refit-status-bar">
            <div class="refit-status-left">
              <span class="refit-mode-badge">⚙ REFIT MODE</span>
              <div class="refit-ship-status no-ship" id="refit-ship-status">
                <span class="status-dot"></span>
                <span class="status-text">Select a ship to customize</span>
              </div>
            </div>
            <div class="refit-status-right">
              <span class="refit-dirty-indicator" id="refit-dirty">● Unsaved changes</span>
            </div>
          </div>

          <!-- Left Panel: Color Controls -->
          <div class="refit-panel-left">
            <div class="color-section">
              <h3>Glaze Layers</h3>
              <div class="color-layer">
                <input type="color" id="color-primary" value="${state.baseColors[0]}">
                <div class="color-layer-info">
                  <div class="color-layer-name">Primary Wash</div>
                  <div class="color-layer-hint">Base hull color</div>
                </div>
              </div>
              <div class="color-layer">
                <input type="color" id="color-secondary" value="${state.baseColors[1]}">
                <div class="color-layer-info">
                  <div class="color-layer-name">Secondary Glaze</div>
                  <div class="color-layer-hint">Trim & accents</div>
                </div>
              </div>
              <div class="color-layer ${state.baseColors.length < 3 ? 'disabled' : ''}" id="color-layer-tertiary">
                <input type="color" id="color-tertiary" value="${state.baseColors[2] || '#000000'}" ${state.baseColors.length < 3 ? 'disabled' : ''}>
                <div class="color-layer-info">
                  <div class="color-layer-name">Detail Tint</div>
                  <div class="color-layer-hint">Optional accent</div>
                </div>
                <label class="color-layer-toggle">
                  <input type="checkbox" id="use-tertiary" ${state.baseColors.length >= 3 ? 'checked' : ''}>
                  Use
                </label>
              </div>
            </div>

            <div class="palette-section">
              <h3>Generated Palette</h3>
              <div class="palette-layers" id="palette-layers">
                <!-- Populated dynamically -->
              </div>
            </div>
          </div>

          <!-- Center Panel: Ship Dock -->
          <div class="refit-panel-center">
            <div class="ship-dock">
              <div class="dock-gantry"></div>
              <div class="dock-canvas-wrap" id="dock-canvas-wrap">
                <div class="dock-empty" id="dock-empty">
                  <div class="dock-empty-icon">🚀</div>
                  <div class="dock-empty-text">Select a ship from your fleet<br>to begin customization</div>
                </div>
                <canvas id="dock-canvas" class="dock-canvas" style="display: none;"></canvas>
                <div class="dock-loading" id="dock-loading">
                  <span class="dock-loading-text">Applying livery...</span>
                </div>
              </div>
              <div class="dock-class-badge" id="dock-class-badge" style="display: none;">
                <span class="ticker">RKLB</span> · FLAGSHIP
              </div>
            </div>
          </div>

          <!-- Right Panel: Fleet & Liveries -->
          <div class="refit-panel-right">
            <div class="fleet-select-section">
              <h3>Select Ship</h3>
              <div class="fleet-ship-grid" id="fleet-ship-grid">
                <!-- Populated dynamically -->
              </div>
            </div>

            <div class="livery-section">
              <h3>Fleet Liveries</h3>
              <div class="livery-grid" id="livery-grid">
                ${FLEET_LIVERIES.map(livery => `
                  <div class="livery-card" data-livery="${livery.id}" title="${livery.hint}">
                    <div class="livery-preview">
                      ${livery.colors.map(c => `<span style="background: ${c}"></span>`).join('')}
                    </div>
                    <div class="livery-name">${livery.name}</div>
                  </div>
                `).join('')}
              </div>
              
              <h3 class="custom-liveries-header" id="custom-liveries-header" style="display: none;">Custom Liveries</h3>
              <div class="livery-grid custom-liveries" id="custom-livery-grid">
                <!-- Populated dynamically from LiverySystem -->
              </div>
              
              <div class="refit-actions">
                <button class="refit-btn" id="btn-reset">Reset</button>
                <button class="refit-btn primary" id="btn-commit" disabled>Commit Livery</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function cacheDom(container) {
    dom = {
      container,
      shipStatus: container.querySelector('#refit-ship-status'),
      dirtyIndicator: container.querySelector('#refit-dirty'),
      colorPrimary: container.querySelector('#color-primary'),
      colorSecondary: container.querySelector('#color-secondary'),
      colorTertiary: container.querySelector('#color-tertiary'),
      useTertiary: container.querySelector('#use-tertiary'),
      tertiaryLayer: container.querySelector('#color-layer-tertiary'),
      paletteLayers: container.querySelector('#palette-layers'),
      dockEmpty: container.querySelector('#dock-empty'),
      dockCanvas: container.querySelector('#dock-canvas'),
      dockLoading: container.querySelector('#dock-loading'),
      dockClassBadge: container.querySelector('#dock-class-badge'),
      fleetGrid: container.querySelector('#fleet-ship-grid'),
      liveryGrid: container.querySelector('#livery-grid'),
      btnReset: container.querySelector('#btn-reset'),
      btnCommit: container.querySelector('#btn-commit'),
    };
  }

  function bindEvents() {
    // Color inputs - live preview with debounce
    dom.colorPrimary?.addEventListener('input', () => handleColorChange(0, dom.colorPrimary.value));
    dom.colorSecondary?.addEventListener('input', () => handleColorChange(1, dom.colorSecondary.value));
    dom.colorTertiary?.addEventListener('input', () => handleColorChange(2, dom.colorTertiary.value));

    // Tertiary toggle
    dom.useTertiary?.addEventListener('change', () => {
      const enabled = dom.useTertiary.checked;
      dom.tertiaryLayer?.classList.toggle('disabled', !enabled);
      dom.colorTertiary.disabled = !enabled;
      
      if (enabled && state.baseColors.length < 3) {
        state.baseColors.push(dom.colorTertiary.value);
      } else if (!enabled) {
        state.baseColors = state.baseColors.slice(0, 2);
      }
      
      setDirty(true);
      debouncedUpdate();
    });

    // Livery presets
    dom.liveryGrid?.addEventListener('click', (e) => {
      const card = e.target.closest('.livery-card');
      if (card) {
        const liveryId = card.dataset.livery;
        applyLivery(liveryId);
      }
    });

    // Action buttons
    dom.btnReset?.addEventListener('click', handleReset);
    dom.btnCommit?.addEventListener('click', handleCommit);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FLEET GRID
  // ═══════════════════════════════════════════════════════════════════════════

  function populateFleetGrid() {
    if (!dom.fleetGrid) return;

    const ships = getFleetShips();
    
    dom.fleetGrid.innerHTML = ships.map(ship => `
      <div class="fleet-ship-card" data-ticker="${ship.ticker}" title="${ship.name}">
        <img src="${ship.sprite}" alt="${ship.ticker}" onerror="this.src='${ship.fallback}'">
        <span class="ship-ticker">${ship.ticker}</span>
      </div>
    `).join('');

    // Bind click events
    dom.fleetGrid.querySelectorAll('.fleet-ship-card').forEach(card => {
      card.addEventListener('click', () => selectShip(card.dataset.ticker));
    });
  }

  function getFleetShips() {
    // Use SHIP_DATA if available, otherwise defaults
    if (window.SHIP_DATA && Array.isArray(window.SHIP_DATA)) {
      return window.SHIP_DATA.map(ship => ({
        ticker: ship.ticker,
        name: ship.name || ship.ticker,
        class: ship.class || 'Ship',
        sprite: `assets/ships/animated/${ship.ticker}/${ship.ticker}_base.png`,
        fallback: `assets/ships/static/${ship.ticker}-flagship-ship.png`
      }));
    }

    // Fallback defaults
    return [
      { ticker: 'RKLB', name: 'Electron', class: 'Flagship' },
      { ticker: 'LUNR', name: 'Artemis', class: 'Lander' },
      { ticker: 'JOBY', name: 'Skyway', class: 'eVTOL' },
      { ticker: 'ACHR', name: 'Midnight', class: 'eVTOL' },
      { ticker: 'GME', name: 'Diamond', class: 'Moonshot' },
      { ticker: 'BKSY', name: 'Hawkeye', class: 'Recon' },
      { ticker: 'ASTS', name: 'BlueWalker', class: 'Relay' },
      { ticker: 'RDW', name: 'Hauler', class: 'Cargo' },
      { ticker: 'KTOS', name: 'Valkyrie', class: 'Fighter' },
    ].map(ship => ({
      ...ship,
      sprite: `assets/ships/animated/${ship.ticker}/${ship.ticker}_base.png`,
      fallback: `assets/ships/static/${ship.ticker}-flagship-ship.png`
    }));
  }

  async function selectShip(ticker) {
    if (state.selectedShip === ticker) return;

    // Update selection UI
    dom.fleetGrid?.querySelectorAll('.fleet-ship-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.ticker === ticker);
    });

    const ships = getFleetShips();
    const ship = ships.find(s => s.ticker === ticker);
    if (!ship) return;

    state.selectedShip = ticker;
    
    // Update status
    dom.shipStatus?.classList.remove('no-ship');
    dom.shipStatus.querySelector('.status-text').textContent = `${ticker} docked for livery refit`;
    
    // Update class badge
    if (dom.dockClassBadge) {
      dom.dockClassBadge.querySelector('.ticker').textContent = ticker;
      dom.dockClassBadge.innerHTML = `<span class="ticker">${ticker}</span> · ${ship.class.toUpperCase()}`;
      dom.dockClassBadge.style.display = 'block';
    }

    // Check for existing livery from LiverySystem
    if (window.LiverySystem) {
      const existingLivery = LiverySystem.getLiveryForTicker(ticker);
      if (existingLivery) {
        state.baseColors = [...existingLivery.palette.baseColors];
        state.originalColors = [...existingLivery.palette.baseColors];
        state.activeLivery = existingLivery.id;
        
        // Update color inputs
        updateColorInputs();
        renderPalette();
        
        // Show livery name in status
        dom.shipStatus.querySelector('.status-text').textContent = 
          `${ticker} docked · ${existingLivery.name}`;
      }
    }

    // Load ship image
    await loadShipImage(ship.sprite, ship.fallback);
    
    // Enable commit button
    if (dom.btnCommit) dom.btnCommit.disabled = false;
  }

  function updateColorInputs() {
    if (dom.colorPrimary && state.baseColors[0]) {
      dom.colorPrimary.value = state.baseColors[0];
    }
    if (dom.colorSecondary && state.baseColors[1]) {
      dom.colorSecondary.value = state.baseColors[1];
    }
    if (dom.colorTertiary && state.baseColors[2]) {
      dom.colorTertiary.value = state.baseColors[2];
    }
  }

  async function loadShipImage(primarySrc, fallbackSrc) {
    showLoading(true);
    dom.dockEmpty.style.display = 'none';
    dom.dockCanvas.style.display = 'block';

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = async () => {
        state.shipImage = img;
        await updatePreview();
        showLoading(false);
        resolve();
      };
      
      img.onerror = () => {
        // Try fallback
        img.src = fallbackSrc;
        img.onerror = () => {
          console.error('[RefitBay] Failed to load ship image');
          showLoading(false);
          resolve();
        };
      };
      
      img.src = primarySrc;
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LIVE PREVIEW
  // ═══════════════════════════════════════════════════════════════════════════

  function handleColorChange(index, hex) {
    state.baseColors[index] = hex.toUpperCase();
    state.activeLivery = null;
    setDirty(true);
    
    // Clear livery selection
    dom.liveryGrid?.querySelectorAll('.livery-card').forEach(card => {
      card.classList.remove('active');
    });
    
    debouncedUpdate();
  }

  function debouncedUpdate() {
    clearTimeout(updateTimeout);
    updateTimeout = setTimeout(() => {
      renderPalette();
      updatePreview();
    }, 100);
  }

  async function updatePreview() {
    if (!state.shipImage || !dom.dockCanvas) return;
    if (state.isProcessing) return;

    state.isProcessing = true;
    dom.dockCanvas.classList.add('processing');

    try {
      const recolored = await recolorSprite(state.shipImage, state.baseColors);
      
      const ctx = dom.dockCanvas.getContext('2d');
      const scale = 3;
      dom.dockCanvas.width = recolored.width * scale;
      dom.dockCanvas.height = recolored.height * scale;
      
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(recolored, 0, 0, dom.dockCanvas.width, dom.dockCanvas.height);
    } catch (err) {
      console.error('[RefitBay] Preview error:', err);
    }

    state.isProcessing = false;
    dom.dockCanvas.classList.remove('processing');
  }

  function renderPalette() {
    if (!dom.paletteLayers) return;

    const palette = generatePalette(state.baseColors);
    if (!palette) {
      dom.paletteLayers.innerHTML = '<p style="color: var(--text-muted); font-size: 0.7rem;">Select colors to generate palette</p>';
      return;
    }

    // Force re-render to trigger animations
    dom.paletteLayers.innerHTML = '';
    
    requestAnimationFrame(() => {
      dom.paletteLayers.innerHTML = palette.colors.map(c => `
        <div class="palette-layer">
          <div class="palette-swatch" style="background: ${c.hex}"></div>
          <span class="palette-layer-label">${c.name}</span>
          <span class="palette-layer-hex">${c.hex}</span>
        </div>
      `).join('');
    });
  }

  function showLoading(show) {
    if (dom.dockLoading) {
      dom.dockLoading.classList.toggle('visible', show);
    }
  }

  function setDirty(dirty) {
    state.isDirty = dirty;
    dom.dirtyIndicator?.classList.toggle('visible', dirty);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LIVERY PRESETS
  // ═══════════════════════════════════════════════════════════════════════════

  function applyLivery(liveryId) {
    const livery = FLEET_LIVERIES.find(l => l.id === liveryId);
    if (!livery) return;

    state.baseColors = [...livery.colors];
    state.activeLivery = liveryId;

    // Update color inputs
    if (dom.colorPrimary) dom.colorPrimary.value = livery.colors[0];
    if (dom.colorSecondary) dom.colorSecondary.value = livery.colors[1];
    
    if (livery.colors.length >= 3) {
      if (dom.colorTertiary) dom.colorTertiary.value = livery.colors[2];
      if (dom.useTertiary) dom.useTertiary.checked = true;
      dom.tertiaryLayer?.classList.remove('disabled');
      dom.colorTertiary.disabled = false;
    } else {
      if (dom.useTertiary) dom.useTertiary.checked = false;
      dom.tertiaryLayer?.classList.add('disabled');
      dom.colorTertiary.disabled = true;
    }

    // Update UI selection
    dom.liveryGrid?.querySelectorAll('.livery-card').forEach(card => {
      card.classList.toggle('active', card.dataset.livery === liveryId);
    });

    setDirty(true);
    renderPalette();
    updatePreview();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  function handleReset() {
    state.baseColors = [...state.originalColors];
    state.activeLivery = null;

    if (dom.colorPrimary) dom.colorPrimary.value = state.baseColors[0];
    if (dom.colorSecondary) dom.colorSecondary.value = state.baseColors[1];
    if (dom.useTertiary) dom.useTertiary.checked = false;
    dom.tertiaryLayer?.classList.add('disabled');
    dom.colorTertiary.disabled = true;

    dom.liveryGrid?.querySelectorAll('.livery-card').forEach(card => {
      card.classList.remove('active');
    });

    setDirty(false);
    renderPalette();
    updatePreview();
  }

  function handleCommit() {
    if (!state.selectedShip) return;

    const palette = generatePalette(state.baseColors);

    // Emit legacy event for backwards compatibility
    document.dispatchEvent(new CustomEvent('paintbay:apply', {
      detail: {
        ticker: state.selectedShip,
        colors: [...state.baseColors],
        palette,
        livery: state.activeLivery
      }
    }));

    // Emit new livery:create event for LiverySystem
    document.dispatchEvent(new CustomEvent('livery:create', {
      detail: {
        name: state.activeLivery 
          ? (FLEET_LIVERIES.find(l => l.id === state.activeLivery)?.name || 'Custom')
          : `${state.selectedShip} Custom`,
        description: `Applied from Refit Bay`,
        baseColors: [...state.baseColors],
        ticker: state.selectedShip,
        palette: {
          model: state.baseColors.length > 2 ? 'triple-glaze' : 'dual-glaze',
          baseColors: [...state.baseColors],
          generated: [
            { role: 'primary', hex: palette.primary },
            { role: 'secondary', hex: palette.secondary },
            { role: 'glaze', hex: palette.glaze1 || palette.glaze },
            { role: 'highlight', hex: palette.highlight },
            { role: 'shadow', hex: palette.shadow }
          ]
        }
      }
    }));

    // Update original colors
    state.originalColors = [...state.baseColors];
    setDirty(false);

    // Visual feedback
    if (dom.btnCommit) {
      const originalText = dom.btnCommit.textContent;
      dom.btnCommit.textContent = '✓ Committed!';
      dom.btnCommit.disabled = true;
      setTimeout(() => {
        dom.btnCommit.textContent = originalText;
        dom.btnCommit.disabled = false;
      }, 1500);
    }

    // Show toast if available
    if (window.showToast) {
      showToast(`Livery committed for ${state.selectedShip}`, 'info');
    }
  }

  function handleExport() {
    if (!dom.dockCanvas) return;

    const link = document.createElement('a');
    link.download = `${state.selectedShip || 'ship'}-livery-${Date.now()}.png`;
    link.href = dom.dockCanvas.toDataURL('image/png');
    link.click();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    init,
    generatePalette,
    glazeColors,
    lerpColor,
    recolorSprite,
    applyLivery,
    selectShip,
    FLEET_LIVERIES,
    TRANSPARENCY_MAP,
    getCurrentColors: () => [...state.baseColors],
    getCurrentPalette: () => generatePalette(state.baseColors),
    getSelectedShip: () => state.selectedShip,
  };

})();
