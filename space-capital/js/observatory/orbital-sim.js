/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ORBITAL OBSERVATORY v2 - Semantic Spatial Visualization
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * KEY CHANGES from v1:
 * - Sun = "YOUR PORTFOLIO" with health halo segments
 * - Benchmarks = ZONES (fixed positions), not orbital parents
 * - Fleets = Ship FORMATIONS that patrol zones (not orbit them)
 * - State glyphs (▲ ■ ▼) above each fleet for at-a-glance health
 * - Multiple ship sprites per fleet based on position size
 * - Formation type driven by telemetry (tight = calm, scattered = stressed)
 * - Ships use actual sprite images when available
 * 
 * Design principle: The solar system is the PHYSICS layer.
 *                   The HUD is the LANGUAGE layer.
 */

(function() {
  'use strict';

  const TAU = Math.PI * 2;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════
  
  const CONFIG = {
    smoothing: {
      position: 2.0,
      size: 3.0,
      glow: 0.6,
      camera: 0.3
    },
    
    sun: {
      baseRadius: 50,
      coronaLayers: 4,
      haloSegments: 8
    },
    
    // Benchmark ZONES (fixed positions around sun)
    zones: {
      radius: 200,        // Distance from sun to zone centers
      zoneRadius: 120,    // Size of each zone's influence area
      planetRadius: 22
    },
    
    // Fleet configuration
    fleet: {
      minShips: 3,
      maxShips: 12,
      shipSize: 12,
      formationRadius: 45,
      patrolRadius: 12,    // Reduced: gentle drift, not active patrol
      patrolSpeed: 0.04    // Slower: barely perceptible motion
    },
    
    // State glyph colors
    stateColors: {
      favorable: '#33ff99',   // Green - healthy
      neutral: '#ffb347',     // Amber - watch
      adverse: '#ff3366',     // Red - stressed
      controlled: '#33ff99',
      watch: '#ffb347', 
      stressed: '#ff3366'
    }
  };
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SMOOTHING UTILITY
  // ═══════════════════════════════════════════════════════════════════════════
  
  function smooth(current, target, halfLife, dt) {
    if (halfLife <= 0) return target;
    const k = Math.pow(0.5, dt / halfLife);
    return target + (current - target) * k;
  }
  
  class SmoothedValue {
    constructor(initial, halfLife = 1.0) {
      this.cur = initial;
      this.tgt = initial;
      this.halfLife = halfLife;
    }
    set(target) { this.tgt = target; }
    update(dt) { 
      this.cur = smooth(this.cur, this.tgt, this.halfLife, dt);
      return this.cur;
    }
    snap() { this.cur = this.tgt; }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SPRITE LOADER - Load actual ship sprites
  // ═══════════════════════════════════════════════════════════════════════════
  
  const SpriteCache = {
    sprites: {},
    loading: {},
    defaultSprite: null,
    
    init() {
      // Preload default sprite
      if (!this.defaultSprite && window.DEFAULT_SHIP_SPRITE) {
        this.defaultSprite = new Image();
        this.defaultSprite.src = window.DEFAULT_SHIP_SPRITE;
      }
    },
    
    get(symbol) {
      if (this.sprites[symbol]) return this.sprites[symbol];
      if (this.loading[symbol]) return null;
      
      // Initialize default if needed
      this.init();
      
      // Try to load sprite
      this.loading[symbol] = true;
      const img = new Image();
      
      // Use SHIP_SPRITES map if available (most reliable)
      const shipSpritePath = window.SHIP_SPRITES?.[symbol];
      
      img.onload = () => {
        this.sprites[symbol] = img;
        console.log(`[SpriteCache] Loaded sprite for ${symbol}`);
      };
      
      img.onerror = () => {
        // Fallback: try static folder with various naming conventions
        const staticImg = new Image();
        staticImg.onload = () => {
          this.sprites[symbol] = staticImg;
          console.log(`[SpriteCache] Loaded static sprite for ${symbol}`);
        };
        staticImg.onerror = () => {
          // Final fallback: use default ship sprite
          if (this.defaultSprite && this.defaultSprite.complete) {
            this.sprites[symbol] = this.defaultSprite;
            console.log(`[SpriteCache] Using default sprite for ${symbol}`);
          }
        };
        staticImg.src = `assets/ships/static/${symbol}-ship.png`;
      };
      
      // Use explicit map first, then try animated base
      if (shipSpritePath) {
        img.src = shipSpritePath;
      } else {
        img.src = `assets/ships/animated/${symbol}/${symbol}_base.png`;
      }
      return null;
    },
    
    getAny(symbol) {
      // Trigger load if not cached, then return what we have
      if (!this.sprites[symbol] && !this.loading[symbol]) {
        this.get(symbol);
      }
      // Return sprite, or default sprite if available
      return this.sprites[symbol] || (this.defaultSprite?.complete ? this.defaultSprite : null);
    },
    
    // Preload sprites for all known tickers
    preload(symbols) {
      this.init();
      symbols.forEach(symbol => this.get(symbol));
    }
  };
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PORTFOLIO SUN - "YOUR PORTFOLIO" with health halo
  // ═══════════════════════════════════════════════════════════════════════════
  
  class PortfolioSun {
    constructor() {
      this.x = 0;
      this.y = 0;
      this.type = 'sun';
      this.id = 'PORTFOLIO';
      
      this.radius = new SmoothedValue(CONFIG.sun.baseRadius, 6.0);
      this.brightness = new SmoothedValue(0.8, 4.0);
      this.turbulence = new SmoothedValue(0.2, 3.0);
      this.temperature = new SmoothedValue(0.5, 8.0);
      
      // Health halo segments (8 segments, each 0-1 health)
      this.haloSegments = Array(CONFIG.sun.haloSegments).fill(0.7);
      this.coronaPhase = 0;
      
      this.flags = { selected: false, hovered: false };
    }
    
    updateFromPortfolio(data) {
      if (!data) return;
      
      const health = data.healthScore || 0.7;
      const volatility = data.volatility || 0.2;
      const drawdown = Math.abs(data.drawdown || 0);
      const sentiment = data.sentiment || 0.5;
      
      this.radius.set(CONFIG.sun.baseRadius * (0.8 + health * 0.4));
      this.brightness.set(0.5 + health * 0.5);
      this.turbulence.set(Math.min(0.8, volatility + drawdown * 2));
      this.temperature.set(sentiment);
      
      // Update halo segments based on overall health
      for (let i = 0; i < this.haloSegments.length; i++) {
        this.haloSegments[i] = health * (0.8 + Math.random() * 0.4);
      }
    }
    
    update(dt) {
      this.radius.update(dt);
      this.brightness.update(dt);
      this.turbulence.update(dt);
      this.temperature.update(dt);
      this.coronaPhase += dt * (0.3 + this.turbulence.cur * 0.5);
    }
    
    render(ctx, camera) {
      const screenX = camera.worldToScreenX(this.x);
      const screenY = camera.worldToScreenY(this.y);
      const screenRadius = this.radius.cur * camera.zoom;
      
      const temp = this.temperature.cur;
      const baseHue = 30 + (1 - temp) * 30;
      
      // Health halo ring (segmented)
      this.renderHealthHalo(ctx, screenX, screenY, screenRadius * 1.8, camera);
      
      // Corona glow
      for (let i = CONFIG.sun.coronaLayers; i > 0; i--) {
        const layerRadius = screenRadius * (1 + i * 0.4 + Math.sin(this.coronaPhase + i) * 0.1 * this.turbulence.cur);
        const alpha = (0.15 / i) * this.brightness.cur;
        
        const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, layerRadius);
        gradient.addColorStop(0, `hsla(${baseHue}, 100%, 70%, ${alpha})`);
        gradient.addColorStop(0.5, `hsla(${baseHue - 10}, 100%, 50%, ${alpha * 0.5})`);
        gradient.addColorStop(1, `hsla(${baseHue - 20}, 100%, 30%, 0)`);
        
        ctx.beginPath();
        ctx.arc(screenX, screenY, layerRadius, 0, TAU);
        ctx.fillStyle = gradient;
        ctx.fill();
      }
      
      // Core
      const coreGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, screenRadius);
      coreGradient.addColorStop(0, `hsla(${baseHue + 20}, 100%, 95%, 1)`);
      coreGradient.addColorStop(0.5, `hsla(${baseHue}, 100%, 70%, 1)`);
      coreGradient.addColorStop(1, `hsla(${baseHue - 10}, 100%, 50%, 0.9)`);
      
      ctx.beginPath();
      ctx.arc(screenX, screenY, screenRadius, 0, TAU);
      ctx.fillStyle = coreGradient;
      ctx.fill();
      
      // "YOUR PORTFOLIO" label
      ctx.font = `bold ${Math.max(10, 12 * camera.zoom)}px 'VT323', 'IBM Plex Mono', monospace`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.textAlign = 'center';
      ctx.fillText('YOUR PORTFOLIO', screenX, screenY + screenRadius + 22 * camera.zoom);
      
      // Selection indicator
      if (this.flags.selected || this.flags.hovered) {
        ctx.beginPath();
        ctx.arc(screenX, screenY, screenRadius + 8, 0, TAU);
        ctx.strokeStyle = this.flags.selected ? '#00ffff' : 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    
    renderHealthHalo(ctx, x, y, radius, camera) {
      const segmentAngle = TAU / this.haloSegments.length;
      const gap = 0.08;
      
      for (let i = 0; i < this.haloSegments.length; i++) {
        const health = this.haloSegments[i];
        const startAngle = i * segmentAngle + gap;
        const endAngle = (i + 1) * segmentAngle - gap;
        
        let color;
        if (health > 0.7) color = CONFIG.stateColors.controlled;
        else if (health > 0.4) color = CONFIG.stateColors.watch;
        else color = CONFIG.stateColors.stressed;
        
        ctx.beginPath();
        ctx.arc(x, y, radius, startAngle, endAngle);
        ctx.strokeStyle = color;
        ctx.lineWidth = 4 * camera.zoom;
        ctx.globalAlpha = 0.6;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    
    getScreenRadius() { return this.radius.cur * 1.5; }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // BENCHMARK ZONE - Fixed position, defines a "space" for fleets
  // ═══════════════════════════════════════════════════════════════════════════
  
  class BenchmarkZone {
    constructor(symbol, angleOffset, roleLabel) {
      this.symbol = symbol;
      this.type = 'benchmark';
      this.id = symbol;
      this.roleLabel = roleLabel;
      
      // Fixed position (not orbiting!)
      this.angle = angleOffset;
      this.distanceFromSun = CONFIG.zones.radius;
      this.x = Math.cos(this.angle) * this.distanceFromSun;
      this.y = Math.sin(this.angle) * this.distanceFromSun;
      
      // Visual properties
      this.radius = new SmoothedValue(CONFIG.zones.planetRadius, 3.0);
      this.glow = new SmoothedValue(0.3, 1.0);
      this.ringBrightness = new SmoothedValue(0.3, 2.0);
      
      // Zone influence radius
      this.zoneRadius = CONFIG.zones.zoneRadius;
      
      this.hue = this.getHueForSymbol(symbol);
      this.flags = { selected: false, hovered: false };
      
      // Attached fleets
      this.fleets = [];
    }
    
    getHueForSymbol(symbol) {
      const hues = {
        'SPY': 45, 'QQQ': 280, 'IWM': 120, 'XAR': 190, 'ITA': 30, 'UFO': 180, 'ARKK': 320
      };
      return hues[symbol] || 200;
    }
    
    updateFromTelemetry(data) {
      if (!data) return;
      const momentum = data.momentum || 0;
      const volatility = data.volatility || 0.2;
      this.glow.set(0.3 + Math.abs(momentum) * 2);
      this.ringBrightness.set(0.2 + volatility * 0.5);
    }
    
    update(dt) {
      this.radius.update(dt);
      this.glow.update(dt);
      this.ringBrightness.update(dt);
    }
    
    render(ctx, camera) {
      const screenX = camera.worldToScreenX(this.x);
      const screenY = camera.worldToScreenY(this.y);
      const screenRadius = this.radius.cur * camera.zoom;
      
      // Zone influence circle (very subtle)
      ctx.beginPath();
      ctx.arc(screenX, screenY, this.zoneRadius * camera.zoom, 0, TAU);
      ctx.strokeStyle = `hsla(${this.hue}, 40%, 50%, 0.06)`;
      ctx.lineWidth = 1;
      ctx.setLineDash([8, 8]);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Glow
      if (this.glow.cur > 0.1) {
        const glowRadius = screenRadius * (2 + this.glow.cur);
        const glowGradient = ctx.createRadialGradient(screenX, screenY, screenRadius, screenX, screenY, glowRadius);
        glowGradient.addColorStop(0, `hsla(${this.hue}, 70%, 60%, ${this.glow.cur * 0.3})`);
        glowGradient.addColorStop(1, `hsla(${this.hue}, 70%, 60%, 0)`);
        ctx.beginPath();
        ctx.arc(screenX, screenY, glowRadius, 0, TAU);
        ctx.fillStyle = glowGradient;
        ctx.fill();
      }
      
      // Ring
      if (this.ringBrightness.cur > 0.1) {
        ctx.beginPath();
        ctx.ellipse(screenX, screenY, screenRadius * 1.8, screenRadius * 0.5, Math.PI * 0.1, 0, TAU);
        ctx.strokeStyle = `hsla(${this.hue}, 60%, 70%, ${this.ringBrightness.cur * 0.5})`;
        ctx.lineWidth = 2 * camera.zoom;
        ctx.stroke();
      }
      
      // Planet body
      const planetGradient = ctx.createRadialGradient(
        screenX - screenRadius * 0.3, screenY - screenRadius * 0.3, 0,
        screenX, screenY, screenRadius
      );
      planetGradient.addColorStop(0, `hsla(${this.hue}, 50%, 70%, 1)`);
      planetGradient.addColorStop(0.7, `hsla(${this.hue}, 60%, 50%, 1)`);
      planetGradient.addColorStop(1, `hsla(${this.hue}, 70%, 30%, 1)`);
      
      ctx.beginPath();
      ctx.arc(screenX, screenY, screenRadius, 0, TAU);
      ctx.fillStyle = planetGradient;
      ctx.fill();
      
      // Labels
      ctx.font = `bold ${Math.max(10, 13 * camera.zoom)}px 'VT323', monospace`;
      ctx.fillStyle = `hsla(${this.hue}, 70%, 85%, 0.95)`;
      ctx.textAlign = 'center';
      ctx.fillText(this.symbol, screenX, screenY + screenRadius + 18);
      
      // Role label
      ctx.font = `${Math.max(8, 10 * camera.zoom)}px 'VT323', monospace`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fillText(this.roleLabel, screenX, screenY + screenRadius + 32);
      
      // Selection indicator
      if (this.flags.selected || this.flags.hovered) {
        ctx.beginPath();
        ctx.arc(screenX, screenY, screenRadius + 6, 0, TAU);
        ctx.strokeStyle = this.flags.selected ? '#00ffff' : 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    
    getScreenRadius() { return this.radius.cur; }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SHIP - Individual ship within a fleet formation (uses actual sprites!)
  // ═══════════════════════════════════════════════════════════════════════════
  
  class Ship {
    constructor(index, totalShips, fleetSymbol) {
      this.index = index;
      this.totalShips = totalShips;
      this.fleetSymbol = fleetSymbol;
      
      // Offset from fleet anchor
      this.offsetX = 0;
      this.offsetY = 0;
      this.targetOffsetX = 0;
      this.targetOffsetY = 0;
      
      // Individual behavior
      this.jitter = 0;
      this.thrust = 0;
      this.health = 1.0;
      this.phase = Math.random() * TAU;
      this.rotation = 0;
      
      // Try to preload sprite
      SpriteCache.get(fleetSymbol);
    }
    
    setFormationPosition(formationType, radius, cohesion) {
      const angle = (this.index / this.totalShips) * TAU + this.phase * 0.1;
      const spread = radius * (1 + (1 - cohesion) * 0.5);
      
      switch (formationType) {
        case 'ring':
          this.targetOffsetX = Math.cos(angle) * spread;
          this.targetOffsetY = Math.sin(angle) * spread;
          this.rotation = angle + Math.PI / 2;
          break;
        case 'arrow':
          const row = Math.floor(this.index / 3);
          const col = this.index % 3 - 1;
          this.targetOffsetX = row * spread * 0.6;
          this.targetOffsetY = col * spread * 0.4 * (row + 1);
          this.rotation = 0;
          break;
        case 'line':
          this.targetOffsetX = (this.index - this.totalShips / 2) * spread * 0.35;
          this.targetOffsetY = 0;
          this.rotation = 0;
          break;
        case 'swarm':
        default:
          this.targetOffsetX = (Math.random() - 0.5) * spread * 2;
          this.targetOffsetY = (Math.random() - 0.5) * spread * 2;
          this.rotation = Math.random() * TAU;
          break;
      }
    }
    
    update(dt, jitterAmount, thrustAmount) {
      this.offsetX = smooth(this.offsetX, this.targetOffsetX, 1.0, dt);
      this.offsetY = smooth(this.offsetY, this.targetOffsetY, 1.0, dt);
      this.jitter = jitterAmount;
      this.thrust = thrustAmount;
      this.phase += dt * 2;
    }
    
    render(ctx, anchorX, anchorY, camera, hue, size) {
      const jitterX = Math.sin(this.phase * 3 + this.index) * this.jitter * 5;
      const jitterY = Math.cos(this.phase * 2.5 + this.index * 1.3) * this.jitter * 5;
      
      const worldX = anchorX + this.offsetX + jitterX;
      const worldY = anchorY + this.offsetY + jitterY;
      const screenX = camera.worldToScreenX(worldX);
      const screenY = camera.worldToScreenY(worldY);
      const screenSize = size * camera.zoom;
      
      // Thrust trail
      if (this.thrust > 0.2) {
        const trailLength = screenSize * 2.5 * this.thrust;
        ctx.beginPath();
        ctx.moveTo(screenX, screenY);
        const trailX = screenX - Math.cos(this.rotation) * trailLength;
        const trailY = screenY - Math.sin(this.rotation) * trailLength;
        ctx.lineTo(trailX, trailY);
        ctx.strokeStyle = `hsla(${hue}, 80%, 60%, ${this.thrust * 0.5})`;
        ctx.lineWidth = screenSize * 0.4;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
      
      // Try to render sprite, fallback to minimal placeholder
      const sprite = SpriteCache.getAny(this.fleetSymbol);
      
      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.rotate(this.rotation);
      
      if (sprite && sprite.complete) {
        // Render actual sprite
        const scale = screenSize * 2.5 / Math.max(sprite.width, sprite.height);
        const w = sprite.width * scale;
        const h = sprite.height * scale;
        
        // Health affects opacity
        ctx.globalAlpha = 0.7 + this.health * 0.3;
        ctx.drawImage(sprite, -w/2, -h/2, w, h);
        ctx.globalAlpha = 1;
      } else {
        // Minimal placeholder while sprite loads (small glowing dot)
        const dotSize = screenSize * 0.4;
        ctx.beginPath();
        ctx.arc(0, 0, dotSize, 0, TAU);
        ctx.fillStyle = `hsla(${hue}, 70%, 60%, 0.7)`;
        ctx.fill();
      }
      
      ctx.restore();
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // FLEET - Formation of ships that patrols a benchmark zone
  // ═══════════════════════════════════════════════════════════════════════════
  
  class Fleet {
    constructor(symbol, benchmarkZone) {
      this.symbol = symbol;
      this.type = 'fleet';
      this.id = symbol;
      this.benchmark = benchmarkZone;
      
      // Anchor position (patrols within zone)
      this.anchorX = benchmarkZone.x;
      this.anchorY = benchmarkZone.y;
      this.patrolPhase = Math.random() * TAU;
      this.patrolOffset = { x: 0, y: 0 };
      
      this.x = this.anchorX;
      this.y = this.anchorY;
      
      // Ships
      this.ships = [];
      this.shipCount = 6;
      this.initShips();
      
      // Formation
      this.formationType = 'ring';
      this.formationRadius = CONFIG.fleet.formationRadius;
      this.cohesion = new SmoothedValue(0.8, 2.0);
      
      // Fleet-level telemetry
      this.trendState = 'neutral';
      this.riskState = 'controlled';
      this.momentum = new SmoothedValue(0, 1.0);
      this.volatility = new SmoothedValue(0.3, 2.0);
      this.stress = new SmoothedValue(0, 2.0);
      this.glow = new SmoothedValue(0.2, 0.6);
      
      this.hue = this.getHueForTicker(symbol);
      this.flags = { selected: false, hovered: false };
      this.telemetry = null;
    }
    
    initShips() {
      this.ships = [];
      for (let i = 0; i < this.shipCount; i++) {
        this.ships.push(new Ship(i, this.shipCount, this.symbol));
      }
      this.updateFormation();
    }
    
    setShipCount(count) {
      count = Math.max(CONFIG.fleet.minShips, Math.min(CONFIG.fleet.maxShips, count));
      if (count !== this.shipCount) {
        this.shipCount = count;
        this.initShips();
      }
    }
    
    getHueForTicker(symbol) {
      const hues = {
        'RKLB': 160, 'ACHR': 90, 'LUNR': 220, 'JOBY': 50,
        'ASTS': 300, 'BKSY': 200, 'PL': 30, 'RDW': 340,
        'KTOS': 170, 'GME': 120, 'GE': 40, 'RTX': 210,
        'LHX': 260, 'COHR': 280, 'EVEX': 320
      };
      return hues[symbol] || (Math.abs(symbol.charCodeAt(0) * 47) % 360);
    }
    
    updateFromTelemetry(data) {
      if (!data) return;
      this.telemetry = data;
      
      // Determine trend state
      const trend = data.trend || data.momentum || 0;
      if (trend > 0.2) this.trendState = 'favorable';
      else if (trend < -0.2) this.trendState = 'adverse';
      else this.trendState = 'neutral';
      
      // Determine risk state
      const stress = data.risk?.stress || Math.abs(data.drawdown || 0) * 3;
      if (stress < 0.3) this.riskState = 'controlled';
      else if (stress < 0.6) this.riskState = 'watch';
      else this.riskState = 'stressed';
      
      // Update smoothed values
      this.momentum.set(data.momentum || 0);
      this.volatility.set(data.volatility || 0.3);
      this.stress.set(stress);
      this.glow.set(Math.min(1, (data.activity || 0.5) * 0.7 + Math.abs(data.momentum || 0) * 0.3));
      
      // Cohesion
      const cohesionValue = Math.max(0.2, 1 - this.volatility.tgt - this.stress.tgt * 0.5);
      this.cohesion.set(cohesionValue);
      
      // Formation type based on state
      if (this.riskState === 'stressed') {
        this.formationType = 'swarm';
      } else if (this.trendState === 'favorable' && Math.abs(this.momentum.tgt) > 0.3) {
        this.formationType = 'arrow';
      } else {
        this.formationType = 'ring';
      }
      
      // Ship count based on weight (default 6, range 3-12)
      const weight = data.portfolioWeight || 0.1;
      const shipCount = Math.round(CONFIG.fleet.minShips + weight * 10 * (CONFIG.fleet.maxShips - CONFIG.fleet.minShips));
      this.setShipCount(Math.max(CONFIG.fleet.minShips, Math.min(CONFIG.fleet.maxShips, shipCount)));
    }
    
    updateFormation() {
      this.ships.forEach(ship => {
        ship.setFormationPosition(this.formationType, this.formationRadius, this.cohesion.cur);
      });
    }
    
    update(dt) {
      this.momentum.update(dt);
      this.volatility.update(dt);
      this.stress.update(dt);
      this.glow.update(dt);
      this.cohesion.update(dt);
      
      // Very subtle drift within zone (barely noticeable)
      this.patrolPhase += dt * CONFIG.fleet.patrolSpeed;
      const patrolDist = CONFIG.fleet.patrolRadius * (1 + this.volatility.cur * 0.3);
      this.patrolOffset.x = Math.sin(this.patrolPhase) * patrolDist;
      this.patrolOffset.y = Math.cos(this.patrolPhase * 0.7) * patrolDist * 0.6;
      
      // Base position near benchmark
      this.x = this.benchmark.x + this.patrolOffset.x;
      this.y = this.benchmark.y + this.patrolOffset.y;
      
      // Spread fleets apart (fixed angles, no motion)
      const fleetIndex = this.benchmark.fleets.indexOf(this);
      if (fleetIndex >= 0 && this.benchmark.fleets.length > 1) {
        const spreadAngle = (fleetIndex / this.benchmark.fleets.length) * TAU + Math.PI * 0.25;
        const spreadDist = 50 + fleetIndex * 20;
        this.x += Math.cos(spreadAngle) * spreadDist;
        this.y += Math.sin(spreadAngle) * spreadDist;
      }
      
      // Update formation
      this.updateFormation();
      
      // Update ships
      const jitterAmount = this.volatility.cur * 0.6; // Reduced jitter
      const thrustAmount = Math.abs(this.momentum.cur);
      this.ships.forEach(ship => {
        ship.health = 1 - this.stress.cur;
        ship.update(dt, jitterAmount, thrustAmount);
      });
    }
    
    render(ctx, camera) {
      const screenX = camera.worldToScreenX(this.x);
      const screenY = camera.worldToScreenY(this.y);
      
      // Fleet glow
      if (this.glow.cur > 0.1) {
        const glowRadius = (this.formationRadius + 25) * camera.zoom;
        const glowGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, glowRadius);
        glowGradient.addColorStop(0, `hsla(${this.hue}, 100%, 70%, ${this.glow.cur * 0.12})`);
        glowGradient.addColorStop(1, `hsla(${this.hue}, 100%, 70%, 0)`);
        ctx.beginPath();
        ctx.arc(screenX, screenY, glowRadius, 0, TAU);
        ctx.fillStyle = glowGradient;
        ctx.fill();
      }
      
      // Render ships
      this.ships.forEach(ship => {
        ship.render(ctx, this.x, this.y, camera, this.hue, CONFIG.fleet.shipSize);
      });
      
      // State glyph above fleet
      this.renderStateGlyph(ctx, screenX, screenY - this.formationRadius * camera.zoom - 20, camera);
      
      // Fleet label
      ctx.font = `bold ${Math.max(10, 12 * camera.zoom)}px 'VT323', monospace`;
      ctx.fillStyle = `hsla(${this.hue}, 60%, 85%, 0.95)`;
      ctx.textAlign = 'center';
      ctx.fillText(this.symbol, screenX, screenY + this.formationRadius * camera.zoom + 20);
      
      // Selection indicator
      if (this.flags.selected || this.flags.hovered) {
        ctx.beginPath();
        ctx.arc(screenX, screenY, this.formationRadius * camera.zoom + 12, 0, TAU);
        ctx.strokeStyle = this.flags.selected ? '#00ffff' : 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    
    renderStateGlyph(ctx, x, y, camera) {
      const size = Math.max(8, 11 * camera.zoom);
      
      // Trend glyph
      let glyph, trendColor;
      switch (this.trendState) {
        case 'favorable':
          glyph = '▲';
          trendColor = CONFIG.stateColors.favorable;
          break;
        case 'adverse':
          glyph = '▼';
          trendColor = CONFIG.stateColors.adverse;
          break;
        default:
          glyph = '■';
          trendColor = CONFIG.stateColors.neutral;
      }
      
      // Risk border color
      let riskColor;
      switch (this.riskState) {
        case 'controlled': riskColor = CONFIG.stateColors.controlled; break;
        case 'watch': riskColor = CONFIG.stateColors.watch; break;
        case 'stressed': riskColor = CONFIG.stateColors.stressed; break;
      }
      
      // Background circle with risk border
      ctx.beginPath();
      ctx.arc(x, y, size, 0, TAU);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fill();
      ctx.strokeStyle = riskColor;
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Glyph
      ctx.font = `bold ${size * 1.1}px sans-serif`;
      ctx.fillStyle = trendColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(glyph, x, y + 1);
      ctx.textBaseline = 'alphabetic';
    }
    
    getScreenRadius() { return this.formationRadius; }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CAMERA
  // ═══════════════════════════════════════════════════════════════════════════
  
  class Camera {
    constructor(canvas) {
      this.canvas = canvas;
      this.x = new SmoothedValue(0, CONFIG.smoothing.camera);
      this.y = new SmoothedValue(0, CONFIG.smoothing.camera);
      this.zoom = 1.0;
      this.targetZoom = 1.0;
      this.focusTarget = null;
      this.isDragging = false;
      this.lastMouse = { x: 0, y: 0 };
    }
    
    get width() { return this.canvas.width; }
    get height() { return this.canvas.height; }
    get centerX() { return this.width / 2; }
    get centerY() { return this.height / 2; }
    
    worldToScreenX(wx) { return this.centerX + (wx - this.x.cur) * this.zoom; }
    worldToScreenY(wy) { return this.centerY + (wy - this.y.cur) * this.zoom; }
    screenToWorldX(sx) { return (sx - this.centerX) / this.zoom + this.x.cur; }
    screenToWorldY(sy) { return (sy - this.centerY) / this.zoom + this.y.cur; }
    
    focusOn(body, instant = false) {
      this.focusTarget = body;
      if (body) {
        this.x.set(body.x);
        this.y.set(body.y);
        if (instant) { this.x.snap(); this.y.snap(); }
      }
    }
    
    clearFocus() { this.focusTarget = null; }
    
    pan(dx, dy) {
      this.focusTarget = null;
      this.x.set(this.x.tgt - dx / this.zoom);
      this.y.set(this.y.tgt - dy / this.zoom);
    }
    
    zoomBy(factor) {
      this.targetZoom = Math.max(0.3, Math.min(3.0, this.targetZoom * factor));
    }
    
    update(dt) {
      this.x.update(dt);
      this.y.update(dt);
      this.zoom = smooth(this.zoom, this.targetZoom, 0.15, dt);
      if (this.focusTarget) {
        this.x.set(this.focusTarget.x);
        this.y.set(this.focusTarget.y);
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ORBITAL OBSERVATORY v2
  // ═══════════════════════════════════════════════════════════════════════════
  
  class OrbitalObservatory {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.camera = new Camera(canvas);
      
      this.sun = new PortfolioSun();
      this.benchmarks = [];
      this.fleets = [];
      
      this.running = false;
      this.lastTime = 0;
      this.hoveredBody = null;
      this.selectedBody = null;
      
      this.onSelect = null;
      this.onHover = null;
      
      this.setupDefaultBenchmarks();
      this.bindEvents();
    }
    
    setupDefaultBenchmarks() {
      const benchmarkDefs = [
        { symbol: 'XAR', angle: -Math.PI * 0.4, role: 'Aerospace & Defense' },
        { symbol: 'SPY', angle: Math.PI * 0.15, role: 'Market Baseline' },
        { symbol: 'QQQ', angle: Math.PI * 0.75, role: 'Growth / Tech' }
      ];
      
      benchmarkDefs.forEach(def => {
        const zone = new BenchmarkZone(def.symbol, def.angle, def.role);
        this.benchmarks.push(zone);
      });
    }
    
    addFleet(symbol, benchmarkSymbol = 'XAR') {
      const benchmark = this.benchmarks.find(b => b.symbol === benchmarkSymbol) || this.benchmarks[0];
      const fleet = new Fleet(symbol, benchmark);
      benchmark.fleets.push(fleet);
      this.fleets.push(fleet);
      return fleet;
    }
    
    removeFleet(symbol) {
      const index = this.fleets.findIndex(f => f.symbol === symbol);
      if (index >= 0) {
        const fleet = this.fleets[index];
        const benchIndex = fleet.benchmark.fleets.indexOf(fleet);
        if (benchIndex >= 0) fleet.benchmark.fleets.splice(benchIndex, 1);
        this.fleets.splice(index, 1);
      }
    }
    
    getBenchmarkForTicker(symbol) {
      const sectorMap = {
        'RKLB': 'XAR', 'ACHR': 'XAR', 'LUNR': 'XAR', 'JOBY': 'XAR',
        'ASTS': 'XAR', 'BKSY': 'XAR', 'PL': 'XAR', 'RDW': 'XAR',
        'KTOS': 'XAR', 'GME': 'SPY', 'GE': 'SPY', 'RTX': 'SPY', 
        'LHX': 'SPY', 'COHR': 'QQQ', 'EVEX': 'QQQ'
      };
      return sectorMap[symbol] || 'XAR';
    }
    
    updateTelemetry(snapshot) {
      if (snapshot._portfolio) {
        this.sun.updateFromPortfolio(snapshot._portfolio);
      }
      this.benchmarks.forEach(b => b.updateFromTelemetry(snapshot[b.symbol]));
      this.fleets.forEach(f => f.updateFromTelemetry(snapshot[f.symbol]));
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // EVENTS
    // ─────────────────────────────────────────────────────────────────────────
    
    bindEvents() {
      this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
      this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
      this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
      this.canvas.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
      this.canvas.addEventListener('click', this.onClick.bind(this));
      this.canvas.addEventListener('dblclick', this.onDoubleClick.bind(this));
      this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
      this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
      this.canvas.addEventListener('touchend', this.onTouchEnd.bind(this));
    }
    
    onMouseDown(e) {
      this.camera.isDragging = true;
      this.camera.lastMouse = { x: e.clientX, y: e.clientY };
    }
    
    onMouseMove(e) {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      if (this.camera.isDragging) {
        const dx = e.clientX - this.camera.lastMouse.x;
        const dy = e.clientY - this.camera.lastMouse.y;
        this.camera.pan(dx, dy);
        this.camera.lastMouse = { x: e.clientX, y: e.clientY };
      } else {
        this.updateHover(x, y);
      }
    }
    
    onMouseUp() { this.camera.isDragging = false; }
    
    onWheel(e) {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      this.camera.zoomBy(factor);
    }
    
    onClick(e) {
      const rect = this.canvas.getBoundingClientRect();
      const body = this.hitTest(e.clientX - rect.left, e.clientY - rect.top);
      this.select(body);
    }
    
    onDoubleClick(e) {
      const rect = this.canvas.getBoundingClientRect();
      const body = this.hitTest(e.clientX - rect.left, e.clientY - rect.top);
      if (body) {
        this.camera.focusOn(body);
        this.camera.targetZoom = body.type === 'fleet' ? 1.5 : 1.0;
      } else {
        this.camera.focusOn(this.sun);
        this.camera.targetZoom = 1.0;
      }
    }
    
    onTouchStart(e) {
      e.preventDefault();
      if (e.touches.length === 1) {
        this.camera.isDragging = true;
        this.camera.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    }
    
    onTouchMove(e) {
      e.preventDefault();
      if (e.touches.length === 1 && this.camera.isDragging) {
        const dx = e.touches[0].clientX - this.camera.lastMouse.x;
        const dy = e.touches[0].clientY - this.camera.lastMouse.y;
        this.camera.pan(dx, dy);
        this.camera.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    }
    
    onTouchEnd() { this.camera.isDragging = false; }
    
    // ─────────────────────────────────────────────────────────────────────────
    // HIT TESTING
    // ─────────────────────────────────────────────────────────────────────────
    
    hitTest(screenX, screenY) {
      // Fleets first
      for (const fleet of this.fleets) {
        const fx = this.camera.worldToScreenX(fleet.x);
        const fy = this.camera.worldToScreenY(fleet.y);
        const dist = Math.hypot(screenX - fx, screenY - fy);
        if (dist < fleet.getScreenRadius() * this.camera.zoom + 20) return fleet;
      }
      // Benchmarks
      for (const benchmark of this.benchmarks) {
        const bx = this.camera.worldToScreenX(benchmark.x);
        const by = this.camera.worldToScreenY(benchmark.y);
        const dist = Math.hypot(screenX - bx, screenY - by);
        if (dist < benchmark.getScreenRadius() * this.camera.zoom + 15) return benchmark;
      }
      // Sun
      const sx = this.camera.worldToScreenX(this.sun.x);
      const sy = this.camera.worldToScreenY(this.sun.y);
      if (Math.hypot(screenX - sx, screenY - sy) < this.sun.getScreenRadius() * this.camera.zoom) {
        return this.sun;
      }
      return null;
    }
    
    updateHover(screenX, screenY) {
      const body = this.hitTest(screenX, screenY);
      if (this.hoveredBody !== body) {
        if (this.hoveredBody) this.hoveredBody.flags.hovered = false;
        if (body) body.flags.hovered = true;
        this.hoveredBody = body;
        if (this.onHover) this.onHover(body);
      }
      this.canvas.style.cursor = body ? 'pointer' : 'grab';
    }
    
    select(body) {
      if (this.selectedBody) this.selectedBody.flags.selected = false;
      if (body) body.flags.selected = true;
      this.selectedBody = body;
      if (this.onSelect) this.onSelect(body);
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // SIMULATION
    // ─────────────────────────────────────────────────────────────────────────
    
    start() {
      if (this.running) return;
      this.running = true;
      this.lastTime = performance.now();
      
      // One-time debug log
      console.log('[OrbitalObservatory] Starting simulation:', {
        canvasSize: `${this.canvas.width}x${this.canvas.height}`,
        cameraCenter: `${this.camera.centerX}, ${this.camera.centerY}`,
        sunPos: `${this.sun.x}, ${this.sun.y}`,
        benchmarks: this.benchmarks.length,
        fleets: this.fleets.length
      });
      
      this.tick();
    }
    
    stop() { this.running = false; }
    
    tick() {
      if (!this.running) return;
      const now = performance.now();
      const dt = Math.min((now - this.lastTime) / 1000, 0.1);
      this.lastTime = now;
      this.update(dt);
      this.render();
      requestAnimationFrame(() => this.tick());
    }
    
    update(dt) {
      this.camera.update(dt);
      this.sun.update(dt);
      this.benchmarks.forEach(b => b.update(dt));
      this.fleets.forEach(f => f.update(dt));
    }
    
    render() {
      const ctx = this.ctx;
      
      // Validate canvas dimensions
      if (this.canvas.width < 10 || this.canvas.height < 10) {
        console.warn('[OrbitalObservatory] Canvas too small:', this.canvas.width, 'x', this.canvas.height);
        this.resize();
        return;
      }
      
      ctx.fillStyle = '#050608';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      
      this.renderStarfield();
      
      // Subtle connections from sun to zones
      this.benchmarks.forEach(b => this.renderZoneConnection(b));
      
      this.sun.render(ctx, this.camera);
      this.benchmarks.forEach(b => b.render(ctx, this.camera));
      this.fleets.forEach(f => f.render(ctx, this.camera));
    }
    
    renderStarfield() {
      const ctx = this.ctx;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      for (let i = 0; i < 80; i++) {
        const x = ((i * 137.5) % this.canvas.width);
        const y = ((i * 97.3) % this.canvas.height);
        ctx.fillRect(x, y, (i % 3) === 0 ? 1.5 : 1, (i % 3) === 0 ? 1.5 : 1);
      }
    }
    
    renderZoneConnection(benchmark) {
      const ctx = this.ctx;
      const sx = this.camera.worldToScreenX(this.sun.x);
      const sy = this.camera.worldToScreenY(this.sun.y);
      const bx = this.camera.worldToScreenX(benchmark.x);
      const by = this.camera.worldToScreenY(benchmark.y);
      
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(bx, by);
      ctx.strokeStyle = `hsla(${benchmark.hue}, 40%, 50%, 0.08)`;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 8]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    resize() {
      const parent = this.canvas.parentElement;
      if (!parent) {
        console.warn('[OrbitalObservatory] No parent element for resize');
        return;
      }
      
      const rect = parent.getBoundingClientRect();
      
      // Use parent dimensions, fallback to window size if dimensions are invalid
      let width = rect.width;
      let height = rect.height;
      
      // If dimensions are too small, use fallback sizes
      if (width < 100) {
        width = Math.min(window.innerWidth - 40, 1200);
        console.log('[OrbitalObservatory] Width fallback:', width);
      }
      if (height < 100) {
        height = Math.min(window.innerHeight - 200, 600);
        console.log('[OrbitalObservatory] Height fallback:', height);
      }
      
      // Ensure minimum dimensions
      width = Math.max(width, 400);
      height = Math.max(height, 300);
      
      this.canvas.width = width;
      this.canvas.height = height;
      
      console.log(`[OrbitalObservatory] Resized to ${width}x${height}`);
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════════════
  
  window.OrbitalObservatory = OrbitalObservatory;
  window.OrbitalConfig = CONFIG;
  window.OrbitalSpriteCache = SpriteCache;
  
  console.log('[OrbitalObservatory v2] Loaded - Zones + Formations + State Glyphs + Sprites');
  
})();
