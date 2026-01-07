/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ORBITAL OBSERVATORY - Data-Driven Solar System Visualization
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Visualizes portfolio as an orbital system:
 * - Portfolio Sun (center) - overall health
 * - Benchmark Planets (SPY, sector ETFs) - stable anchors
 * - Fleet Ships (tickers) - orbit their benchmark based on telemetry
 * 
 * Telemetry → Visual Mappings:
 * - Orbit radius: relative performance vs benchmark
 * - Angular velocity: activity (volume, volatility)
 * - Eccentricity: volatility/IV rank (calm = circular, wild = elliptical)
 * - Size: market cap or position weight
 * - Glow: volume surge, unusual activity
 * - Ring: options structure (gamma, skew)
 */

(function() {
  'use strict';

  const TAU = Math.PI * 2;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════
  
  const CONFIG = {
    // Smoothing half-lives (seconds)
    smoothing: {
      radius: 4.0,
      eccentricity: 8.0,
      omega: 2.0,
      size: 3.0,
      glow: 0.6,
      ring: 2.5,
      camera: 0.3
    },
    
    // Visual defaults
    sun: {
      baseRadius: 45,
      coronaLayers: 4,
      maxFlares: 3
    },
    
    benchmark: {
      orbitRadius: 180,
      planetRadius: 18,
      angularSpeed: 0.08 // rad/sec
    },
    
    fleet: {
      baseOrbitRadius: 60,
      shipSize: 8,
      maxShipsPerFleet: 8,
      formationSpread: 25
    },
    
    // Telemetry mapping ranges
    mapping: {
      minOrbitRadius: 35,
      maxOrbitRadius: 120,
      minOmega: 0.1,
      maxOmega: 0.8,
      minEccentricity: 0.0,
      maxEccentricity: 0.5,
      minSize: 4,
      maxSize: 16
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
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SMOOTHED VALUE CLASS
  // ═══════════════════════════════════════════════════════════════════════════
  
  class SmoothedValue {
    constructor(initial, halfLife = 1.0) {
      this.cur = initial;
      this.tgt = initial;
      this.halfLife = halfLife;
    }
    
    set(target) {
      this.tgt = target;
    }
    
    update(dt) {
      this.cur = smooth(this.cur, this.tgt, this.halfLife, dt);
      return this.cur;
    }
    
    snap() {
      this.cur = this.tgt;
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // BODY BASE CLASS
  // ═══════════════════════════════════════════════════════════════════════════
  
  class Body {
    constructor(id, type) {
      this.id = id;
      this.type = type; // 'sun', 'benchmark', 'fleet', 'ship'
      this.parent = null;
      
      // World position (computed)
      this.x = 0;
      this.y = 0;
      
      // Visual properties
      this.hue = 200;
      this.flags = { alert: false, selected: false, hovered: false };
    }
    
    getScreenRadius() {
      return 10; // Override in subclasses
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PORTFOLIO SUN
  // ═══════════════════════════════════════════════════════════════════════════
  
  class PortfolioSun extends Body {
    constructor() {
      super('SUN', 'sun');
      
      this.radius = new SmoothedValue(CONFIG.sun.baseRadius, 6.0);
      this.brightness = new SmoothedValue(0.8, 4.0);
      this.turbulence = new SmoothedValue(0.2, 3.0);
      this.temperature = new SmoothedValue(0.5, 8.0); // 0=cold/bearish, 1=hot/bullish
      
      this.flares = [];
      this.coronaPhase = 0;
    }
    
    updateFromPortfolio(portfolioData) {
      if (!portfolioData) return;
      
      // Map portfolio metrics to sun visuals
      const health = portfolioData.healthScore || 0.7;
      const volatility = portfolioData.volatility || 0.2;
      const drawdown = portfolioData.drawdown || 0;
      const sentiment = portfolioData.sentiment || 0.5; // 0=bearish, 1=bullish
      
      this.radius.set(CONFIG.sun.baseRadius * (0.8 + health * 0.4));
      this.brightness.set(0.5 + health * 0.5);
      this.turbulence.set(Math.min(0.8, volatility + Math.abs(drawdown) * 2));
      this.temperature.set(sentiment);
    }
    
    update(dt) {
      this.radius.update(dt);
      this.brightness.update(dt);
      this.turbulence.update(dt);
      this.temperature.update(dt);
      
      this.coronaPhase += dt * (0.3 + this.turbulence.cur * 0.5);
    }
    
    getScreenRadius() {
      return this.radius.cur * 1.5; // Include corona
    }
    
    render(ctx, camera) {
      const screenX = camera.worldToScreenX(this.x);
      const screenY = camera.worldToScreenY(this.y);
      const screenRadius = this.radius.cur * camera.zoom;
      
      // Temperature determines color
      const temp = this.temperature.cur;
      const baseHue = 30 + (1 - temp) * 30; // 30 (orange/bullish) to 60 (yellow/neutral)
      
      // Corona glow layers
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
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // BENCHMARK PLANET
  // ═══════════════════════════════════════════════════════════════════════════
  
  class BenchmarkPlanet extends Body {
    constructor(symbol, orbitIndex, totalBenchmarks) {
      super(symbol, 'benchmark');
      this.symbol = symbol;
      
      // Spread benchmarks evenly around the sun
      this.phase = (orbitIndex / totalBenchmarks) * TAU;
      
      // Orbit properties (mostly fixed for benchmarks)
      this.orbitRadius = CONFIG.benchmark.orbitRadius + orbitIndex * 40;
      this.omega = new SmoothedValue(CONFIG.benchmark.angularSpeed * (1 - orbitIndex * 0.15), 2.0);
      this.eccentricity = new SmoothedValue(0.05, 8.0);
      
      // Visual properties
      this.radius = new SmoothedValue(CONFIG.benchmark.planetRadius, 3.0);
      this.glow = new SmoothedValue(0.4, 1.0);
      this.ringBrightness = new SmoothedValue(0.3, 2.0);
      
      // Color based on benchmark type
      this.hue = this.getHueForSymbol(symbol);
      
      // Attached fleets
      this.fleets = [];
    }
    
    getHueForSymbol(symbol) {
      const hues = {
        'SPY': 45,    // Gold
        'QQQ': 280,   // Purple
        'IWM': 120,   // Green
        'XAR': 200,   // Cyan
        'ITA': 30,    // Orange
        'UFO': 180,   // Teal
        'ARKK': 320   // Pink
      };
      return hues[symbol] || 200;
    }
    
    updateFromTelemetry(data) {
      if (!data) return;
      
      // Benchmarks have subtle variations based on their performance
      const momentum = data.momentum || 0;
      const volatility = data.volatility || 0.2;
      
      this.glow.set(0.3 + Math.abs(momentum) * 2);
      this.eccentricity.set(Math.min(0.15, volatility * 0.3));
      this.ringBrightness.set(0.2 + volatility * 0.5);
    }
    
    update(dt, sunX, sunY) {
      // Update smoothed values
      this.omega.update(dt);
      this.eccentricity.update(dt);
      this.radius.update(dt);
      this.glow.update(dt);
      this.ringBrightness.update(dt);
      
      // Advance orbital phase
      this.phase = (this.phase + this.omega.cur * dt) % TAU;
      
      // Compute position using ellipse math
      const a = this.orbitRadius;
      const e = this.eccentricity.cur;
      const b = a * Math.sqrt(1 - e * e);
      
      this.x = sunX + a * Math.cos(this.phase);
      this.y = sunY + b * Math.sin(this.phase);
    }
    
    getScreenRadius() {
      return this.radius.cur;
    }
    
    renderOrbit(ctx, camera, sunX, sunY) {
      const screenSunX = camera.worldToScreenX(sunX);
      const screenSunY = camera.worldToScreenY(sunY);
      const a = this.orbitRadius * camera.zoom;
      const e = this.eccentricity.cur;
      const b = a * Math.sqrt(1 - e * e);
      
      ctx.beginPath();
      ctx.ellipse(screenSunX, screenSunY, a, b, 0, 0, TAU);
      ctx.strokeStyle = `hsla(${this.hue}, 50%, 50%, 0.15)`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    
    render(ctx, camera) {
      const screenX = camera.worldToScreenX(this.x);
      const screenY = camera.worldToScreenY(this.y);
      const screenRadius = this.radius.cur * camera.zoom;
      
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
      
      // Ring (volatility indicator)
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
      
      // Selection/hover indicator
      if (this.flags.selected || this.flags.hovered) {
        ctx.beginPath();
        ctx.arc(screenX, screenY, screenRadius + 5, 0, TAU);
        ctx.strokeStyle = this.flags.selected ? '#00ffff' : 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      
      // Label
      ctx.font = `${11 * Math.min(camera.zoom, 1.5)}px 'IBM Plex Mono', monospace`;
      ctx.fillStyle = `hsla(${this.hue}, 70%, 80%, 0.9)`;
      ctx.textAlign = 'center';
      ctx.fillText(this.symbol, screenX, screenY + screenRadius + 14);
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // FLEET (Ticker Group)
  // ═══════════════════════════════════════════════════════════════════════════
  
  class Fleet extends Body {
    constructor(symbol, benchmark) {
      super(symbol, 'fleet');
      this.symbol = symbol;
      this.benchmark = benchmark;
      
      // Orbit around benchmark
      this.phase = Math.random() * TAU;
      this.orbitRadius = new SmoothedValue(CONFIG.fleet.baseOrbitRadius, CONFIG.smoothing.radius);
      this.omega = new SmoothedValue(0.3, CONFIG.smoothing.omega);
      this.eccentricity = new SmoothedValue(0.1, CONFIG.smoothing.eccentricity);
      
      // Visual properties
      this.size = new SmoothedValue(CONFIG.fleet.shipSize, CONFIG.smoothing.size);
      this.glow = new SmoothedValue(0.2, CONFIG.smoothing.glow);
      this.thrust = new SmoothedValue(0.3, 1.0);
      this.stress = new SmoothedValue(0, 2.0);
      
      // Ships in formation
      this.ships = [];
      this.formationJitter = 0;
      
      // Telemetry cache
      this.telemetry = null;
      
      // Color from ticker
      this.hue = this.getHueForTicker(symbol);
    }
    
    getHueForTicker(symbol) {
      // Generate consistent hue from symbol
      let hash = 0;
      for (let i = 0; i < symbol.length; i++) {
        hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
      }
      return Math.abs(hash) % 360;
    }
    
    updateFromTelemetry(data) {
      if (!data) return;
      this.telemetry = data;
      
      const { mapping } = CONFIG;
      
      // Relative performance → orbit radius (outperform = closer)
      const relPerf = data.relativePerformance || 0; // -1 to 1
      const radiusNorm = 0.5 - relPerf * 0.4; // Invert: better = closer
      this.orbitRadius.set(mapping.minOrbitRadius + radiusNorm * (mapping.maxOrbitRadius - mapping.minOrbitRadius));
      
      // Activity → angular velocity
      const activity = data.volumePercentile || 0.5;
      const volatility = data.realizedVol || 0.3;
      const activityScore = (activity + volatility) / 2;
      this.omega.set(mapping.minOmega + activityScore * (mapping.maxOmega - mapping.minOmega));
      
      // IV/Volatility → eccentricity
      const ivRank = data.ivRank || 0.3;
      this.eccentricity.set(mapping.minEccentricity + ivRank * (mapping.maxEccentricity - mapping.minEccentricity));
      
      // Position size → visual size
      const weight = data.portfolioWeight || 0.1;
      this.size.set(mapping.minSize + weight * 3 * (mapping.maxSize - mapping.minSize));
      
      // Volume anomaly → glow
      const volumeZ = data.volumeZ || 0;
      this.glow.set(Math.max(0, Math.min(1, volumeZ * 0.3)));
      
      // Momentum → thrust
      const momentum = data.momentum || 0;
      this.thrust.set(Math.abs(momentum) * 2);
      
      // Drawdown → stress
      const drawdown = Math.abs(data.drawdown || 0);
      this.stress.set(Math.min(1, drawdown * 5));
    }
    
    update(dt) {
      // Update smoothed values
      this.orbitRadius.update(dt);
      this.omega.update(dt);
      this.eccentricity.update(dt);
      this.size.update(dt);
      this.glow.update(dt);
      this.thrust.update(dt);
      this.stress.update(dt);
      
      // Advance orbital phase
      this.phase = (this.phase + this.omega.cur * dt) % TAU;
      
      // Compute position relative to benchmark
      if (this.benchmark) {
        const a = this.orbitRadius.cur;
        const e = this.eccentricity.cur;
        const b = a * Math.sqrt(1 - e * e);
        
        // Add wobble based on stress
        const wobble = this.stress.cur * Math.sin(this.phase * 3) * 5;
        
        this.x = this.benchmark.x + a * Math.cos(this.phase) + wobble;
        this.y = this.benchmark.y + b * Math.sin(this.phase);
      }
      
      // Update formation jitter
      this.formationJitter += dt * (1 + this.stress.cur * 2);
    }
    
    getScreenRadius() {
      return this.size.cur * 2;
    }
    
    renderOrbit(ctx, camera) {
      if (!this.benchmark) return;
      
      const centerX = camera.worldToScreenX(this.benchmark.x);
      const centerY = camera.worldToScreenY(this.benchmark.y);
      const a = this.orbitRadius.cur * camera.zoom;
      const e = this.eccentricity.cur;
      const b = a * Math.sqrt(1 - e * e);
      
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, a, b, 0, 0, TAU);
      ctx.strokeStyle = `hsla(${this.hue}, 40%, 50%, 0.1)`;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 8]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    render(ctx, camera) {
      const screenX = camera.worldToScreenX(this.x);
      const screenY = camera.worldToScreenY(this.y);
      const screenSize = this.size.cur * camera.zoom;
      
      // Thrust trail
      if (this.thrust.cur > 0.2) {
        const trailLength = screenSize * 2 * this.thrust.cur;
        const trailAngle = this.phase + Math.PI; // Behind the ship
        
        const gradient = ctx.createLinearGradient(
          screenX, screenY,
          screenX + Math.cos(trailAngle) * trailLength,
          screenY + Math.sin(trailAngle) * trailLength
        );
        gradient.addColorStop(0, `hsla(${this.hue}, 80%, 60%, ${this.thrust.cur * 0.5})`);
        gradient.addColorStop(1, `hsla(${this.hue}, 80%, 60%, 0)`);
        
        ctx.beginPath();
        ctx.moveTo(screenX, screenY);
        ctx.lineTo(
          screenX + Math.cos(trailAngle) * trailLength,
          screenY + Math.sin(trailAngle) * trailLength
        );
        ctx.strokeStyle = gradient;
        ctx.lineWidth = screenSize * 0.5;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
      
      // Glow
      if (this.glow.cur > 0.1) {
        const glowRadius = screenSize * (2 + this.glow.cur * 2);
        const glowGradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, glowRadius);
        glowGradient.addColorStop(0, `hsla(${this.hue}, 100%, 70%, ${this.glow.cur * 0.4})`);
        glowGradient.addColorStop(1, `hsla(${this.hue}, 100%, 70%, 0)`);
        
        ctx.beginPath();
        ctx.arc(screenX, screenY, glowRadius, 0, TAU);
        ctx.fillStyle = glowGradient;
        ctx.fill();
      }
      
      // Ship body (diamond shape for fleet lead)
      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.rotate(this.phase + Math.PI / 2);
      
      // Stress affects color saturation
      const saturation = 70 - this.stress.cur * 30;
      const lightness = 60 - this.stress.cur * 20;
      
      ctx.beginPath();
      ctx.moveTo(0, -screenSize);
      ctx.lineTo(screenSize * 0.6, screenSize * 0.3);
      ctx.lineTo(0, screenSize * 0.6);
      ctx.lineTo(-screenSize * 0.6, screenSize * 0.3);
      ctx.closePath();
      
      ctx.fillStyle = `hsla(${this.hue}, ${saturation}%, ${lightness}%, 0.9)`;
      ctx.fill();
      ctx.strokeStyle = `hsla(${this.hue}, ${saturation}%, ${lightness + 20}%, 1)`;
      ctx.lineWidth = 1;
      ctx.stroke();
      
      ctx.restore();
      
      // Selection/hover indicator
      if (this.flags.selected || this.flags.hovered) {
        ctx.beginPath();
        ctx.arc(screenX, screenY, screenSize + 8, 0, TAU);
        ctx.strokeStyle = this.flags.selected ? '#00ffff' : 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      
      // Label (only if zoomed in enough or selected/hovered)
      if (camera.zoom > 0.6 || this.flags.selected || this.flags.hovered) {
        ctx.font = `${10 * Math.min(camera.zoom, 1.2)}px 'VT323', monospace`;
        ctx.fillStyle = `hsla(${this.hue}, 60%, 80%, 0.9)`;
        ctx.textAlign = 'center';
        ctx.fillText(this.symbol, screenX, screenY + screenSize + 12);
      }
    }
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
      this.rotation = 0;
      
      this.focusTarget = null;
      this.isDragging = false;
      this.lastMouse = { x: 0, y: 0 };
    }
    
    get width() { return this.canvas.width; }
    get height() { return this.canvas.height; }
    get centerX() { return this.width / 2; }
    get centerY() { return this.height / 2; }
    
    worldToScreenX(wx) {
      return this.centerX + (wx - this.x.cur) * this.zoom;
    }
    
    worldToScreenY(wy) {
      return this.centerY + (wy - this.y.cur) * this.zoom;
    }
    
    screenToWorldX(sx) {
      return (sx - this.centerX) / this.zoom + this.x.cur;
    }
    
    screenToWorldY(sy) {
      return (sy - this.centerY) / this.zoom + this.y.cur;
    }
    
    focusOn(body, instant = false) {
      this.focusTarget = body;
      if (body) {
        this.x.set(body.x);
        this.y.set(body.y);
        if (instant) {
          this.x.snap();
          this.y.snap();
        }
      }
    }
    
    clearFocus() {
      this.focusTarget = null;
    }
    
    pan(dx, dy) {
      this.focusTarget = null;
      this.x.set(this.x.tgt - dx / this.zoom);
      this.y.set(this.y.tgt - dy / this.zoom);
    }
    
    zoomBy(factor, centerX, centerY) {
      const oldZoom = this.targetZoom;
      this.targetZoom = Math.max(0.3, Math.min(3.0, this.targetZoom * factor));
      
      // Zoom toward mouse position
      const worldX = this.screenToWorldX(centerX);
      const worldY = this.screenToWorldY(centerY);
      
      this.x.set(worldX - (centerX - this.centerX) / this.targetZoom);
      this.y.set(worldY - (centerY - this.centerY) / this.targetZoom);
    }
    
    update(dt) {
      this.x.update(dt);
      this.y.update(dt);
      
      // Smooth zoom
      this.zoom = smooth(this.zoom, this.targetZoom, 0.15, dt);
      
      // Follow focus target
      if (this.focusTarget) {
        this.x.set(this.focusTarget.x);
        this.y.set(this.focusTarget.y);
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ORBITAL OBSERVATORY (Main System)
  // ═══════════════════════════════════════════════════════════════════════════
  
  class OrbitalObservatory {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.camera = new Camera(canvas);
      
      // Bodies
      this.sun = new PortfolioSun();
      this.benchmarks = [];
      this.fleets = [];
      
      // State
      this.running = false;
      this.lastTime = 0;
      this.hoveredBody = null;
      this.selectedBody = null;
      
      // Callbacks
      this.onSelect = null;
      this.onHover = null;
      
      // Initialize
      this.setupDefaultBenchmarks();
      this.bindEvents();
    }
    
    setupDefaultBenchmarks() {
      const benchmarkSymbols = ['SPY', 'XAR', 'QQQ'];
      benchmarkSymbols.forEach((symbol, i) => {
        const planet = new BenchmarkPlanet(symbol, i, benchmarkSymbols.length);
        planet.parent = this.sun;
        this.benchmarks.push(planet);
      });
    }
    
    addFleet(symbol, benchmarkSymbol = 'SPY') {
      const benchmark = this.benchmarks.find(b => b.symbol === benchmarkSymbol) || this.benchmarks[0];
      const fleet = new Fleet(symbol, benchmark);
      this.fleets.push(fleet);
      return fleet;
    }
    
    removeFleet(symbol) {
      const index = this.fleets.findIndex(f => f.symbol === symbol);
      if (index >= 0) {
        this.fleets.splice(index, 1);
      }
    }
    
    getBenchmarkForTicker(symbol) {
      // Simple sector mapping - could be enhanced
      const sectorMap = {
        'RKLB': 'XAR', 'ACHR': 'XAR', 'LUNR': 'XAR', 'JOBY': 'XAR',
        'ASTS': 'XAR', 'BKSY': 'XAR', 'PL': 'XAR', 'RDW': 'XAR',
        'GME': 'SPY', 'GE': 'SPY', 'RTX': 'SPY', 'LHX': 'SPY',
        'KTOS': 'XAR', 'COHR': 'QQQ', 'EVEX': 'QQQ'
      };
      return sectorMap[symbol] || 'SPY';
    }
    
    updateTelemetry(telemetrySnapshot) {
      // Update sun from portfolio data
      if (telemetrySnapshot._portfolio) {
        this.sun.updateFromPortfolio(telemetrySnapshot._portfolio);
      }
      
      // Update benchmarks
      this.benchmarks.forEach(benchmark => {
        const data = telemetrySnapshot[benchmark.symbol];
        benchmark.updateFromTelemetry(data);
      });
      
      // Update fleets
      this.fleets.forEach(fleet => {
        const data = telemetrySnapshot[fleet.symbol];
        fleet.updateFromTelemetry(data);
      });
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // EVENT HANDLING
    // ─────────────────────────────────────────────────────────────────────────
    
    bindEvents() {
      this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
      this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
      this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
      this.canvas.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
      this.canvas.addEventListener('click', this.onClick.bind(this));
      this.canvas.addEventListener('dblclick', this.onDoubleClick.bind(this));
      
      // Touch events
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
        // Hit test for hover
        this.updateHover(x, y);
      }
    }
    
    onMouseUp() {
      this.camera.isDragging = false;
    }
    
    onWheel(e) {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      this.camera.zoomBy(factor, x, y);
    }
    
    onClick(e) {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const body = this.hitTest(x, y);
      this.select(body);
    }
    
    onDoubleClick(e) {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const body = this.hitTest(x, y);
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
    
    onTouchEnd() {
      this.camera.isDragging = false;
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // HIT TESTING
    // ─────────────────────────────────────────────────────────────────────────
    
    hitTest(screenX, screenY) {
      // Test fleets first (front)
      for (const fleet of this.fleets) {
        const fx = this.camera.worldToScreenX(fleet.x);
        const fy = this.camera.worldToScreenY(fleet.y);
        const dist = Math.hypot(screenX - fx, screenY - fy);
        if (dist < fleet.getScreenRadius() * this.camera.zoom + 10) {
          return fleet;
        }
      }
      
      // Test benchmarks
      for (const benchmark of this.benchmarks) {
        const bx = this.camera.worldToScreenX(benchmark.x);
        const by = this.camera.worldToScreenY(benchmark.y);
        const dist = Math.hypot(screenX - bx, screenY - by);
        if (dist < benchmark.getScreenRadius() * this.camera.zoom + 5) {
          return benchmark;
        }
      }
      
      // Test sun
      const sx = this.camera.worldToScreenX(this.sun.x);
      const sy = this.camera.worldToScreenY(this.sun.y);
      const sunDist = Math.hypot(screenX - sx, screenY - sy);
      if (sunDist < this.sun.getScreenRadius() * this.camera.zoom) {
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
    // SIMULATION LOOP
    // ─────────────────────────────────────────────────────────────────────────
    
    start() {
      if (this.running) return;
      this.running = true;
      this.lastTime = performance.now();
      this.tick();
    }
    
    stop() {
      this.running = false;
    }
    
    tick() {
      if (!this.running) return;
      
      const now = performance.now();
      const dt = Math.min((now - this.lastTime) / 1000, 0.1); // Cap dt
      this.lastTime = now;
      
      this.update(dt);
      this.render();
      
      requestAnimationFrame(() => this.tick());
    }
    
    update(dt) {
      // Update camera
      this.camera.update(dt);
      
      // Update sun
      this.sun.update(dt);
      
      // Update benchmarks
      this.benchmarks.forEach(b => b.update(dt, this.sun.x, this.sun.y));
      
      // Update fleets
      this.fleets.forEach(f => f.update(dt));
    }
    
    render() {
      const ctx = this.ctx;
      const camera = this.camera;
      
      // Clear with dark background
      ctx.fillStyle = '#050608';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      
      // Draw starfield (simple)
      this.renderStarfield();
      
      // Draw benchmark orbits
      this.benchmarks.forEach(b => b.renderOrbit(ctx, camera, this.sun.x, this.sun.y));
      
      // Draw fleet orbits (faint)
      this.fleets.forEach(f => f.renderOrbit(ctx, camera));
      
      // Draw tether lines from fleets to sun
      this.fleets.forEach(f => this.renderTether(f));
      
      // Draw sun
      this.sun.render(ctx, camera);
      
      // Draw benchmarks
      this.benchmarks.forEach(b => b.render(ctx, camera));
      
      // Draw fleets
      this.fleets.forEach(f => f.render(ctx, camera));
    }
    
    renderStarfield() {
      const ctx = this.ctx;
      
      // Simple deterministic stars
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      for (let i = 0; i < 100; i++) {
        const x = ((i * 137.5) % this.canvas.width);
        const y = ((i * 97.3) % this.canvas.height);
        const size = (i % 3) === 0 ? 1.5 : 1;
        ctx.fillRect(x, y, size, size);
      }
    }
    
    renderTether(fleet) {
      const ctx = this.ctx;
      const camera = this.camera;
      
      const sx = camera.worldToScreenX(this.sun.x);
      const sy = camera.worldToScreenY(this.sun.y);
      const fx = camera.worldToScreenX(fleet.x);
      const fy = camera.worldToScreenY(fleet.y);
      
      // Faint line to sun representing portfolio connection
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(fx, fy);
      ctx.strokeStyle = `hsla(${fleet.hue}, 50%, 50%, 0.05)`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // RESIZE
    // ─────────────────────────────────────────────────────────────────────────
    
    resize() {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      this.canvas.width = rect.width;
      this.canvas.height = rect.height;
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════════════
  
  window.OrbitalObservatory = OrbitalObservatory;
  window.OrbitalConfig = CONFIG;
  
  console.log('[OrbitalObservatory] Module loaded');
  
})();
