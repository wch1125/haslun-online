// =========================================================================
// BEY ARENA v3 — STATEFUL SPIN COMBAT ENGINE
// 
// Major Physics Overhaul:
// - Compound spin model (angular/coherence/bias)
// - Directional collision advantage
// - Spin transfer mechanics
// - Angular-to-linear velocity coupling
// - Edge pressure system
// - Coherence-based instability
// - Multiple distinct kill conditions
// =========================================================================

(function() {
  'use strict';
  
  // --- Utilities ---
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (min, max) => min + Math.random() * (max - min);
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  
  // Vector utilities
  const vec = {
    len: (x, y) => Math.hypot(x, y),
    norm: (x, y) => {
      const l = Math.hypot(x, y);
      return l > 0 ? { x: x/l, y: y/l } : { x: 0, y: 0 };
    },
    dot: (ax, ay, bx, by) => ax * bx + ay * by,
    perp: (x, y) => ({ x: -y, y: x }) // perpendicular (90° CCW)
  };
  
  // =========================================================================
  // MACD WALL FORCE FIELD SYSTEM
  // Nonlinear magnetic forces: bullish repels, bearish attracts
  // =========================================================================
  const MACDForceField = {
    // Configuration
    config: {
      maxRange: 150,           // Maximum influence distance
      baseStrength: 280,       // Base force magnitude
      falloffExponent: 3.5,    // Higher = sharper falloff (more magnetic feel)
      velocityBoostBullish: 1.012,   // Speed multiplier in bullish zones
      velocityDampBearish: 0.988,    // Speed multiplier in bearish zones
      coherenceEffect: 0.8,    // How much polarity affects coherence
      angularEffect: 1.5       // How much polarity affects spin
    },
    
    // Get wall sample at X position with interpolation
    sampleWallAtX(ship, xNorm, arena) {
      const curve = ship.macdCurve;
      const curveLen = curve.length;
      
      // Get interpolated index
      const exactIndex = xNorm * (curveLen - 1);
      const i0 = Math.floor(exactIndex);
      const i1 = Math.min(i0 + 1, curveLen - 1);
      const t = exactIndex - i0;
      
      // Interpolate MACD value
      const macdValue = lerp(curve[i0], curve[i1], t);
      
      // Determine if this section is bullish or bearish
      // Bullish = positive MACD (above zero), Bearish = negative
      const isBullish = macdValue > 0;
      
      // Histogram strength (magnitude of MACD)
      const histStrength = Math.abs(macdValue);
      
      // Calculate Y position of wall
      const baseY = ship.isTop 
        ? arena.chartHeight / 2
        : arena.canvas.height - arena.chartHeight / 2;
      const wallY = baseY - macdValue * (arena.chartHeight * 0.4);
      
      // Inner boundary (actual collision surface)
      const innerY = ship.isTop
        ? arena.chartHeight + 20 + Math.max(0, macdValue * 40)
        : arena.canvas.height - arena.chartHeight - 20 - Math.max(0, -macdValue * 40);
      
      return {
        macdValue,
        isBullish,
        histStrength,
        wallY,
        innerY,
        polarity: ship.isTop ? 1 : -1 // Top wall pushes down, bottom pushes up
      };
    },
    
    // Apply magnetic force from a single wall to a ship
    applyForce(targetShip, wallShip, arena, dt) {
      const xNorm = (targetShip.x - arena.arenaLeft) / (arena.arenaRight - arena.arenaLeft);
      const sample = this.sampleWallAtX(wallShip, xNorm, arena);
      
      // Calculate distance from ship to wall inner boundary
      const dy = targetShip.y - sample.innerY;
      const dist = Math.abs(dy);
      
      // Skip if too far
      if (dist > this.config.maxRange) return { strength: 0, isBullish: sample.isBullish };
      
      // NONLINEAR falloff - exponential decay (the key to magnetic feel)
      const dNorm = dist / this.config.maxRange;
      const falloff = Math.exp(-this.config.falloffExponent * dNorm);
      
      // Final strength combines falloff with histogram magnitude
      const strength = falloff * (0.3 + sample.histStrength * 0.7);
      
      // Bullish = +1 (repels, energizes), Bearish = -1 (attracts, slows)
      const polarity = sample.isBullish ? 1 : -1;
      
      // Force direction: wall polarity determines push direction
      // Top wall (polarity +1) pushes down into arena
      // Bottom wall (polarity -1) pushes up into arena
      const forceDir = -sample.polarity; // Toward arena center
      
      // MAGNETIC FORCE APPLICATION
      // Bullish: repels (pushes away from wall)
      // Bearish: attracts (pulls toward wall)
      const forceMag = polarity * strength * this.config.baseStrength;
      
      // Apply force (bullish repels = positive force away, bearish attracts = negative)
      targetShip.vy += forceDir * forceMag * dt;
      
      // Also apply slight horizontal force based on MACD slope
      const slopeForce = sample.macdValue * strength * 40;
      targetShip.vx += slopeForce * dt;
      
      return { strength, isBullish: sample.isBullish, polarity };
    },
    
    // Apply velocity modulation (bullish accelerates, bearish decelerates)
    applyVelocityModulation(ship, strength, isBullish) {
      if (strength < 0.05) return;
      
      if (isBullish) {
        // Bullish = energizing, speed boost
        const boost = lerp(1, this.config.velocityBoostBullish, strength);
        ship.vx *= boost;
        ship.vy *= boost;
      } else {
        // Bearish = dampening, speed reduction
        const damp = lerp(1, this.config.velocityDampBearish, strength);
        ship.vx *= damp;
        ship.vy *= damp;
      }
    },
    
    // Apply secondary effects (coherence, spin)
    applySecondaryEffects(ship, strength, isBullish, dt) {
      if (strength < 0.03) return;
      
      const polarity = isBullish ? 1 : -1;
      
      // Coherence: bullish stabilizes, bearish destabilizes
      ship.spin.coherence += polarity * strength * this.config.coherenceEffect * dt;
      ship.spin.coherence = clamp01(ship.spin.coherence);
      
      // Angular: bullish boosts spin, bearish drains it
      ship.spin.angular += polarity * strength * this.config.angularEffect * dt;
      ship.spin.angular = Math.max(0, ship.spin.angular);
      
      // Bias drift in bearish zones
      if (!isBullish && strength > 0.15) {
        ship.spin.bias += rand(-0.08, 0.08) * strength;
        ship.spin.bias = clamp(ship.spin.bias, -1, 1);
      }
    }
  };
  
  // --- Hotline Miami Color Palette ---
  const COLORS = {
    violentPink: '#ff2fd2',
    hotMagenta: '#ff0066',
    burntOrange: '#ff7a00',
    acidLime: '#aaff00',
    bloodShadow: '#2a001f',
    toxicCyan: '#00ffcc',
    warnYellow: '#fff04a',
    deepBlack: '#0a0008',
    bullGreen: '#00ff88',
    bearOrange: '#ff6633',
    desyncPurple: '#9933ff',
    stallGray: '#666688'
  };
  
  // --- Kill Condition Types ---
  const KILL_TYPE = {
    SHATTER: 'SHATTER',     // Hull integrity hit zero
    DESYNC: 'DESYNC',       // Coherence hit zero
    RINGOUT: 'RINGOUT',     // Sustained edge pressure
    STALL: 'STALL',         // Angular momentum below threshold too long
    VOLATILITY: 'VOLATILITY' // Zone-triggered death (bearish zone damage)
  };
  
  // =========================================================================
  // MACD CURVE GENERATOR
  // Generate smooth MACD-like curves from telemetry stats
  // =========================================================================
  function generateMACDCurve(telemetry, numPoints = 60) {
    const points = [];
    const volatility = telemetry.chopSensitivity || 0.5;
    const persistence = telemetry.macdPersistence || 0.5;
    const trendStrength = telemetry.trendAdherence || 0.5;
    
    // Generate base wave with multiple frequencies
    let value = 0;
    let velocity = rand(-0.02, 0.02);
    const noise = [];
    
    // Pre-generate noise for smoothness
    for (let i = 0; i < numPoints; i++) {
      noise.push(rand(-1, 1));
    }
    
    // Smooth the noise
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 1; i < numPoints - 1; i++) {
        noise[i] = noise[i] * 0.5 + (noise[i-1] + noise[i+1]) * 0.25;
      }
    }
    
    for (let i = 0; i < numPoints; i++) {
      // Trend component
      const trendWave = Math.sin(i * 0.1 * (1 + persistence)) * trendStrength * 0.3;
      
      // Oscillation component  
      const oscWave = Math.sin(i * 0.3 * (1 + volatility * 2)) * volatility * 0.2;
      
      // Noise component
      const noiseComponent = noise[i] * volatility * 0.15;
      
      // Random walk component
      velocity += rand(-0.01, 0.01) * volatility;
      velocity *= 0.95; // damping
      value += velocity;
      value *= 0.98; // mean reversion
      
      const finalValue = clamp(
        trendWave + oscWave + noiseComponent + value,
        -0.8, 0.8
      );
      
      points.push(finalValue);
    }
    
    return points;
  }
  
  // Detect crossover points (where curve crosses zero)
  function detectCrossovers(curve) {
    const crossovers = [];
    for (let i = 1; i < curve.length; i++) {
      if ((curve[i-1] < 0 && curve[i] >= 0) || (curve[i-1] >= 0 && curve[i] < 0)) {
        crossovers.push({
          index: i,
          x: i / curve.length,
          bullish: curve[i] > curve[i-1], // crossing up = bullish
          strength: Math.abs(curve[i] - curve[i-1]) * 5
        });
      }
    }
    return crossovers;
  }
  
  // =========================================================================
  // FX SYSTEM - Enhanced with new death effects
  // =========================================================================
  function FXSystem() {
    this.particles = [];
    this.sparks = [];
    this.pops = [];
    this.shake = { amp: 0, time: 0 };
    this.trails = new Map();
    this.screenFlash = { color: null, alpha: 0 };
    this.desyncEffects = []; // Visual glitch effects
    this.pressureRings = [];
  }
  
  FXSystem.prototype.addShake = function(amp) {
    this.shake.amp = Math.min(25, this.shake.amp + amp);
    this.shake.time = 0.2;
  };
  
  FXSystem.prototype.flash = function(color, intensity = 0.4) {
    this.screenFlash.color = color;
    this.screenFlash.alpha = intensity;
  };
  
  FXSystem.prototype.pushTrail = function(id, x, y, color, coherence = 1) {
    let arr = this.trails.get(id);
    if (!arr) { arr = []; this.trails.set(id, arr); }
    // Trail opacity affected by coherence
    arr.push({ x, y, life: 0.3, color, alpha: 0.6 * coherence });
    if (arr.length > 25) arr.shift();
  };
  
  FXSystem.prototype.impact = function(x, y, intensity, color) {
    const count = Math.floor(10 + intensity * 25);
    for (let i = 0; i < count; i++) {
      const ang = rand(0, Math.PI * 2);
      const spd = rand(120, 500) * intensity;
      this.sparks.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: rand(0.15, 0.4),
        size: rand(1.5, 4),
        color: color || (Math.random() < 0.5 ? COLORS.violentPink : COLORS.burntOrange)
      });
    }
    this.addShake(4 + intensity * 10);
  };
  
  FXSystem.prototype.emanationHit = function(x, y, bullish) {
    const color = bullish ? COLORS.bullGreen : COLORS.bearOrange;
    for (let i = 0; i < 15; i++) {
      const ang = rand(0, Math.PI * 2);
      const spd = rand(60, 180);
      this.sparks.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: rand(0.25, 0.5),
        size: rand(2.5, 5),
        color
      });
    }
    this.flash(color, 0.25);
  };
  
  FXSystem.prototype.spinTransfer = function(fromX, fromY, toX, toY, color) {
    // Visual arc showing spin being stolen
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const x = lerp(fromX, toX, t);
      const y = lerp(fromY, toY, t) - Math.sin(t * Math.PI) * 30;
      setTimeout(() => {
        this.sparks.push({
          x, y,
          vx: rand(-30, 30),
          vy: rand(-50, -20),
          life: 0.3,
          size: 3,
          color
        });
      }, i * 20);
    }
  };
  
  FXSystem.prototype.desyncPulse = function(x, y) {
    this.desyncEffects.push({
      x, y,
      radius: 10,
      maxRadius: 60,
      life: 0.4,
      color: COLORS.desyncPurple
    });
  };
  
  FXSystem.prototype.pressureWarning = function(x, y, radius) {
    this.pressureRings.push({
      x, y,
      radius,
      life: 0.3,
      color: COLORS.hotMagenta
    });
  };
  
  // Death effects for different kill types
  FXSystem.prototype.killEffect = function(x, y, killType) {
    switch(killType) {
      case KILL_TYPE.SHATTER:
        // Massive explosion
        this.impact(x, y, 1.5, COLORS.hotMagenta);
        this.flash(COLORS.hotMagenta, 0.6);
        this.addShake(20);
        break;
      case KILL_TYPE.DESYNC:
        // Glitchy fade
        for (let i = 0; i < 5; i++) {
          setTimeout(() => this.desyncPulse(x + rand(-20, 20), y + rand(-20, 20)), i * 50);
        }
        this.flash(COLORS.desyncPurple, 0.4);
        break;
      case KILL_TYPE.RINGOUT:
        // Pushed out effect
        this.impact(x, y, 1.0, COLORS.burntOrange);
        this.flash(COLORS.burntOrange, 0.5);
        break;
      case KILL_TYPE.STALL:
        // Fizzle out
        for (let i = 0; i < 20; i++) {
          this.sparks.push({
            x: x + rand(-15, 15),
            y: y + rand(-15, 15),
            vx: rand(-20, 20),
            vy: rand(-40, -10),
            life: rand(0.5, 1.0),
            size: rand(1, 2),
            color: COLORS.stallGray
          });
        }
        break;
      case KILL_TYPE.VOLATILITY:
        // Bearish zone consumed the ship - vortex implosion effect
        this.flash(COLORS.bearOrange, 0.5);
        this.addShake(12);
        for (let i = 0; i < 30; i++) {
          const angle = (i / 30) * Math.PI * 2;
          const dist = rand(30, 60);
          this.sparks.push({
            x: x + Math.cos(angle) * dist,
            y: y + Math.sin(angle) * dist,
            vx: -Math.cos(angle) * 80, // Implode toward center
            vy: -Math.sin(angle) * 80,
            life: rand(0.4, 0.8),
            size: rand(2, 4),
            color: COLORS.bearOrange
          });
        }
        // Inner swirl
        for (let i = 0; i < 15; i++) {
          this.desyncPulse(x + rand(-10, 10), y + rand(-10, 10));
        }
        break;
    }
  };
  
  FXSystem.prototype.popText = function(x, y, text, scale, color) {
    this.pops.push({ 
      x, y, text, life: 1.0, scale: scale || 1, 
      color: color || '#ffffff'
    });
  };
  
  FXSystem.prototype.update = function(dt) {
    this.shake.time -= dt;
    if (this.shake.time < 0) this.shake.amp *= 0.8;
    
    this.screenFlash.alpha *= 0.88;
    
    for (const spark of this.sparks) {
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.vx *= 0.94;
      spark.vy *= 0.94;
      spark.life -= dt;
    }
    this.sparks = this.sparks.filter(s => s.life > 0);
    
    for (const p of this.pops) {
      p.life -= dt;
      p.y -= 45 * dt;
    }
    this.pops = this.pops.filter(p => p.life > 0);
    
    for (const [id, arr] of this.trails) {
      for (const t of arr) t.life -= dt;
      this.trails.set(id, arr.filter(t => t.life > 0));
    }
    
    // Desync effects
    for (const d of this.desyncEffects) {
      d.life -= dt;
      d.radius = lerp(10, d.maxRadius, 1 - d.life / 0.4);
    }
    this.desyncEffects = this.desyncEffects.filter(d => d.life > 0);
    
    // Pressure rings
    for (const p of this.pressureRings) {
      p.life -= dt;
    }
    this.pressureRings = this.pressureRings.filter(p => p.life > 0);
  };
  
  FXSystem.prototype.getShakeOffset = function() {
    if (this.shake.amp < 0.5) return { x: 0, y: 0 };
    return {
      x: (Math.random() - 0.5) * this.shake.amp,
      y: (Math.random() - 0.5) * this.shake.amp
    };
  };
  
  FXSystem.prototype.draw = function(ctx) {
    // Draw trails
    for (const [id, arr] of this.trails) {
      for (const t of arr) {
        ctx.globalAlpha = t.life * (t.alpha || 0.6);
        ctx.fillStyle = t.color;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Draw sparks
    for (const s of this.sparks) {
      ctx.globalAlpha = s.life * 2.5;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Draw desync effects
    for (const d of this.desyncEffects) {
      ctx.globalAlpha = d.life * 0.6;
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    // Draw pressure rings
    for (const p of this.pressureRings) {
      ctx.globalAlpha = p.life * 0.4;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Draw pop text
    for (const p of this.pops) {
      ctx.globalAlpha = Math.min(1, p.life * 1.5);
      ctx.font = `bold ${Math.floor(18 * p.scale)}px "VT323", monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.fillText(p.text, p.x + 2, p.y + 2);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12;
      ctx.fillText(p.text, p.x, p.y);
      ctx.shadowBlur = 0;
    }
    
    ctx.globalAlpha = 1;
    
    // Screen flash
    if (this.screenFlash.alpha > 0.01) {
      ctx.globalAlpha = this.screenFlash.alpha;
      ctx.fillStyle = this.screenFlash.color || '#fff';
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.globalAlpha = 1;
    }
  };
  
  // =========================================================================
  // SHIP CREATION - New compound spin model
  // =========================================================================
  function createShip(ticker, isTop) {
    const tele = (window.ShipTelemetry && window.ShipTelemetry.getTelemetry)
      ? window.ShipTelemetry.getTelemetry(ticker)
      : { thrustPotential: 0.5, maneuverStability: 0.5, hullResilience: 0.5, 
          chopSensitivity: 0.5, signalClarity: 0.5, macdPersistence: 0.5,
          trendAdherence: 0.5, regimeBias: 'range' };
    
    const telemetry = Object.assign({
      thrustPotential: 0.5,
      maneuverStability: 0.5,
      hullResilience: 0.5,
      chopSensitivity: 0.5,
      signalClarity: 0.5,
      macdPersistence: 0.5,
      trendAdherence: 0.5,
      regimeBias: 'range'
    }, tele || {});
    
    // Generate MACD curve for this ship
    const macdCurve = generateMACDCurve(telemetry, 60);
    const crossovers = detectCrossovers(macdCurve);
    
    let shipColor = isTop ? COLORS.hotMagenta : COLORS.toxicCyan;
    if (window.ShipRegistry && window.ShipRegistry.isReady()) {
      const ship = window.ShipRegistry.get(ticker);
      if (ship) shipColor = ship.color;
    }
    
    const spritePath = (window.SHIP_SPRITES && window.SHIP_SPRITES[ticker]) || null;
    
    return {
      ticker,
      telemetry,
      isTop,
      macdCurve,
      crossovers,
      color: shipColor,
      spritePath,
      spriteImg: null,
      
      // Physics
      x: 0, y: 0,
      vx: rand(-40, 40),
      vy: rand(-25, 25),
      radius: 24 + 8 * telemetry.hullResilience,
      mass: 1 + telemetry.hullResilience * 0.8,
      
      // === NEW COMPOUND SPIN MODEL ===
      spin: {
        angular: 1.0,           // Raw spin speed (0-1+)
        coherence: 1.0,         // How stable the spin is (0-1)
        bias: 0                 // Directional drift tendency (-1 to 1)
      },
      
      // State
      integrity: 1.0,
      energy: 1.0,
      alive: true,
      angle: 0,
      
      // Kill condition tracking
      edgePressureTime: 0,     // Time spent under edge pressure
      stallTime: 0,            // Time spent below spin threshold
      bearishZoneTime: 0,      // Time spent in strong bearish zones
      killType: null,          // How this ship died
      
      // Derived stats (influenced by telemetry)
      maxSpeed: 160 + 180 * telemetry.thrustPotential,
      baseStability: 0.4 + 0.6 * telemetry.maneuverStability,
      volatility: telemetry.chopSensitivity,
      spinRetention: 0.5 + 0.5 * telemetry.macdPersistence // How well it holds spin
    };
  }
  
  // =========================================================================
  // ARENA CORE
  // =========================================================================
  const BeyArena = {
    canvas: null,
    ctx: null,
    overlay: null,
    active: false,
    raf: null,
    lastTime: 0,
    
    // Arena bounds
    arenaLeft: 0,
    arenaRight: 0,
    arenaTop: 100,
    arenaBottom: 420,
    chartHeight: 80,
    bufferZone: 60,
    edgePressureBand: 30, // Width of edge pressure zone
    
    ships: [],
    fx: new FXSystem(),
    fightTime: 0,
    phase: 'countdown', // 'countdown', 'fighting', 'ended'
    countdown: 3,
    
    // Configuration
    config: {
      spinDecayBase: 0.015,
      coherenceDecayBase: 0.008,
      stallThreshold: 0.15,
      stallTimeLimit: 2.5,
      edgePressureTimeLimit: 3.0,
      bearishZoneTimeLimit: 4.0, // Time in strong bearish zone before VOLATILITY kill
      spinTransferRate: 0.4,
      angularVelocityCoupling: 0.0025
    },
    
    init() {
      this.overlay = document.getElementById('bey-arena-overlay');
      this.canvas = document.getElementById('bey-arena-canvas');
      if (!this.overlay || !this.canvas) return;
      this.ctx = this.canvas.getContext('2d');
      
      const closeBtn = document.getElementById('bey-arena-close');
      if (closeBtn) closeBtn.onclick = () => this.close();
      
      const rematchBtn = document.getElementById('bey-arena-rematch');
      if (rematchBtn) rematchBtn.onclick = () => this.rematch();
      
      const swapBtn = document.getElementById('bey-arena-swap');
      if (swapBtn) swapBtn.onclick = () => {
        if (this.ships.length >= 2) {
          this.start(this.ships[1].ticker, this.ships[0].ticker);
        }
      };
      
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.overlay?.classList.contains('active')) {
          this.close();
        }
      });
      
      this.resizeCanvas();
      window.addEventListener('resize', () => this.resizeCanvas());
    },
    
    resizeCanvas() {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      this.canvas.width = rect.width || 520;
      this.canvas.height = rect.height || 520;
      
      this.arenaLeft = 40;
      this.arenaRight = this.canvas.width - 40;
      this.arenaTop = this.chartHeight + this.bufferZone;
      this.arenaBottom = this.canvas.height - this.chartHeight - this.bufferZone;
    },
    
    open(tickerA, tickerB) {
      if (!this.overlay) return;
      this.overlay.classList.add('active');
      this.start(tickerA, tickerB);
    },
    
    close() {
      if (!this.overlay) return;
      this.overlay.classList.remove('active');
      this.active = false;
      if (this.raf) cancelAnimationFrame(this.raf);
    },
    
    start(tickerA, tickerB) {
      this.resizeCanvas();
      
      // Create ships
      const shipA = createShip(tickerA, true);
      const shipB = createShip(tickerB, false);
      
      // Starting positions
      const centerX = (this.arenaLeft + this.arenaRight) / 2;
      const centerY = (this.arenaTop + this.arenaBottom) / 2;
      
      shipA.x = centerX - 80;
      shipA.y = centerY - 40;
      shipB.x = centerX + 80;
      shipB.y = centerY + 40;
      
      this.ships = [shipA, shipB];
      
      // Load sprites
      for (const ship of this.ships) {
        if (ship.spritePath) {
          const img = new Image();
          img.onload = () => { ship.spriteImg = img; };
          img.src = ship.spritePath;
        }
      }
      
      this.fx = new FXSystem();
      this.fightTime = 0;
      this.phase = 'countdown';
      this.countdown = 3;
      
      this.setBanner(`${tickerA} VS ${tickerB}`);
      this.updateSidePanels();
      
      this.active = true;
      this.lastTime = performance.now();
      this.loop(this.lastTime);
    },
    
    rematch() {
      if (this.ships.length >= 2) {
        this.start(this.ships[0].ticker, this.ships[1].ticker);
      }
    },
    
    setBanner(text) {
      const banner = document.getElementById('bey-arena-banner');
      if (banner) banner.textContent = text;
    },
    
    updateSidePanels() {
      const left = document.getElementById('bey-left-readout');
      const right = document.getElementById('bey-right-readout');
      if (!left || !right || this.ships.length < 2) return;
      
      const renderStats = (ship) => {
        const hull = Math.round(ship.integrity * 100);
        const spinAngular = Math.round(ship.spin.angular * 100);
        const spinCoherence = Math.round(ship.spin.coherence * 100);
        const energy = Math.round(ship.energy * 100);
        const regime = ship.telemetry.regimeBias?.toUpperCase() || 'RANGE';
        
        const hullColor = hull > 60 ? COLORS.acidLime : hull > 30 ? COLORS.warnYellow : COLORS.hotMagenta;
        const spinColor = spinAngular > 50 ? COLORS.acidLime : spinAngular > 25 ? COLORS.warnYellow : COLORS.hotMagenta;
        const coherenceColor = spinCoherence > 50 ? COLORS.toxicCyan : spinCoherence > 25 ? COLORS.warnYellow : COLORS.desyncPurple;
        
        // Determine status based on various conditions
        let statusClass = 'ok';
        let statusText = 'NOMINAL';
        
        if (!ship.alive) {
          statusClass = 'dead';
          statusText = ship.killType || 'DESTROYED';
        } else if (spinCoherence < 30) {
          statusClass = 'critical';
          statusText = 'DESYNCING';
        } else if (hull < 30) {
          statusClass = 'critical';
          statusText = 'CRITICAL';
        } else if (spinAngular < 25) {
          statusClass = 'warning';
          statusText = 'STALLING';
        } else if (hull < 60) {
          statusClass = 'warning';
          statusText = 'DAMAGED';
        }
        
        const bar = (val, color) => `<div class="stat-bar"><div class="stat-fill" style="width:${val}%;background:${color}"></div></div>`;
        
        // Show trend indicator based on spin bias
        const biasIndicator = ship.spin.bias > 0.2 ? '↗' : ship.spin.bias < -0.2 ? '↙' : '↔';
        
        return `
<div class="pilot-header">
  <span class="pilot-ticker">${ship.ticker}</span>
  <span class="pilot-status ${statusClass}">${statusText}</span>
</div>
<div class="pilot-regime">${regime} ${biasIndicator}</div>

<div class="stat-row"><span class="stat-label">HULL</span><span class="stat-value" style="color:${hullColor}">${hull}%</span></div>
${bar(hull, hullColor)}

<div class="stat-row"><span class="stat-label">SPIN</span><span class="stat-value" style="color:${spinColor}">${spinAngular}%</span></div>
${bar(spinAngular, spinColor)}

<div class="stat-row"><span class="stat-label">COHERENCE</span><span class="stat-value" style="color:${coherenceColor}">${spinCoherence}%</span></div>
${bar(spinCoherence, coherenceColor)}

<div class="stat-row"><span class="stat-label">ENERGY</span><span class="stat-value">${energy}%</span></div>
${bar(energy, COLORS.toxicCyan)}

<div class="stat-row"><span class="stat-label">CROSSOVERS</span><span class="stat-value">${ship.crossovers.length}</span></div>
`;
      };
      
      left.innerHTML = renderStats(this.ships[0]);
      right.innerHTML = renderStats(this.ships[1]);
    },
    
    // Get Y position of chart boundary at given X
    getChartY(ship, xNorm, isInner) {
      const curveIndex = Math.floor(xNorm * (ship.macdCurve.length - 1));
      const curveValue = ship.macdCurve[Math.min(curveIndex, ship.macdCurve.length - 1)];
      
      if (ship.isTop) {
        const baseY = this.chartHeight;
        const extension = curveValue * 40;
        return isInner ? baseY + 20 + Math.max(0, extension) : baseY;
      } else {
        const baseY = this.canvas.height - this.chartHeight;
        const extension = -curveValue * 40;
        return isInner ? baseY - 20 - Math.max(0, extension) : baseY;
      }
    },
    
    // Get MACD value at given X position (for polarity checks)
    getMacdValueAtX(ship, xNorm) {
      if (!ship || !ship.macdCurve || ship.macdCurve.length === 0) return 0;
      
      // Interpolate for smoother values
      const exactIndex = xNorm * (ship.macdCurve.length - 1);
      const i0 = Math.floor(exactIndex);
      const i1 = Math.min(i0 + 1, ship.macdCurve.length - 1);
      const t = exactIndex - i0;
      
      return lerp(ship.macdCurve[i0], ship.macdCurve[i1], t);
    },
    
    // Check if ship is in an emanation zone
    checkEmanations(ship, otherShip) {
      const xNorm = (ship.x - this.arenaLeft) / (this.arenaRight - this.arenaLeft);
      
      for (const cross of otherShip.crossovers) {
        const dist = Math.abs(xNorm - cross.x);
        if (dist < 0.08) {
          return {
            active: true,
            bullish: cross.bullish,
            strength: (1 - dist / 0.08) * cross.strength,
            x: this.arenaLeft + cross.x * (this.arenaRight - this.arenaLeft)
          };
        }
      }
      return { active: false };
    },
    
    // === NEW: Calculate edge pressure ===
    calculateEdgePressure(ship) {
      let pressure = 0;
      
      // Left edge
      const leftDist = ship.x - this.arenaLeft - ship.radius;
      if (leftDist < this.edgePressureBand) {
        pressure = Math.max(pressure, 1 - leftDist / this.edgePressureBand);
      }
      
      // Right edge
      const rightDist = this.arenaRight - ship.x - ship.radius;
      if (rightDist < this.edgePressureBand) {
        pressure = Math.max(pressure, 1 - rightDist / this.edgePressureBand);
      }
      
      // Top boundary check
      const xNorm = (ship.x - this.arenaLeft) / (this.arenaRight - this.arenaLeft);
      const topY = this.getChartY(this.ships[0], xNorm, true);
      const topDist = ship.y - topY - ship.radius;
      if (topDist < this.edgePressureBand) {
        pressure = Math.max(pressure, 1 - topDist / this.edgePressureBand);
      }
      
      // Bottom boundary check
      const bottomY = this.getChartY(this.ships[1], xNorm, true);
      const bottomDist = bottomY - ship.y - ship.radius;
      if (bottomDist < this.edgePressureBand) {
        pressure = Math.max(pressure, 1 - bottomDist / this.edgePressureBand);
      }
      
      return clamp01(pressure);
    },
    
    // === NEW: Directional collision calculation ===
    resolveCollision(a, b) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const minDist = a.radius + b.radius;
      
      if (dist >= minDist || dist === 0) return false;
      
      // Collision normal
      const nx = dx / dist;
      const ny = dy / dist;
      
      // Relative velocity
      const rvx = a.vx - b.vx;
      const rvy = a.vy - b.vy;
      const rvLen = Math.hypot(rvx, rvy);
      
      // === DIRECTIONAL ADVANTAGE CALCULATION ===
      // How directly is the collision happening?
      const rvNorm = rvLen > 0 ? { x: rvx/rvLen, y: rvy/rvLen } : { x: 0, y: 0 };
      const approach = Math.abs(vec.dot(rvNorm.x, rvNorm.y, nx, ny));
      const tangential = Math.abs(vec.dot(rvNorm.x, rvNorm.y, -ny, nx));
      
      // Attack quality: direct hits are better, but glancing blows still matter
      const attackQuality = clamp01(0.6 * approach + 0.4 * tangential);
      
      // Separate overlapping ships
      const overlap = minDist - dist;
      const totalMass = a.mass + b.mass;
      a.x -= nx * overlap * (b.mass / totalMass);
      a.y -= ny * overlap * (b.mass / totalMass);
      b.x += nx * overlap * (a.mass / totalMass);
      b.y += ny * overlap * (a.mass / totalMass);
      
      // Velocity along collision normal
      const dvn = vec.dot(rvx, rvy, nx, ny);
      
      if (dvn <= 0) return false; // Moving apart
      
      // Bounce with restitution affected by coherence
      const avgCoherence = (a.spin.coherence + b.spin.coherence) / 2;
      const restitution = 0.6 + 0.2 * avgCoherence;
      const impulse = (1 + restitution) * dvn / (1/a.mass + 1/b.mass);
      
      a.vx -= impulse * nx / a.mass;
      a.vy -= impulse * ny / a.mass;
      b.vx += impulse * nx / b.mass;
      b.vy += impulse * ny / b.mass;
      
      // === SPIN TRANSFER (THE KEY MECHANIC) ===
      const spinDiff = a.spin.angular - b.spin.angular;
      const transferAmount = attackQuality * Math.abs(spinDiff) * this.config.spinTransferRate;
      
      if (spinDiff > 0) {
        // A is spinning faster, steals from B
        a.spin.angular -= transferAmount * 0.3;
        b.spin.angular += transferAmount * 0.5;
        this.fx.spinTransfer(a.x, a.y, b.x, b.y, a.color);
      } else {
        // B is spinning faster, steals from A
        b.spin.angular -= transferAmount * 0.3;
        a.spin.angular += transferAmount * 0.5;
        this.fx.spinTransfer(b.x, b.y, a.x, a.y, b.color);
      }
      
      // === COHERENCE DAMAGE ===
      const impactSpeed = Math.abs(dvn);
      const impact = clamp01(impactSpeed / 280);
      
      // Faster spinner takes less coherence damage
      const aCoherenceDamage = impact * 0.12 * (spinDiff < 0 ? 1.2 : 0.8);
      const bCoherenceDamage = impact * 0.12 * (spinDiff > 0 ? 1.2 : 0.8);
      
      a.spin.coherence -= aCoherenceDamage * (1 - a.baseStability * 0.5);
      b.spin.coherence -= bCoherenceDamage * (1 - b.baseStability * 0.5);
      
      // Hull damage (reduced compared to before - coherence matters more now)
      a.integrity -= impact * 0.06 * (1 - a.baseStability * 0.3);
      b.integrity -= impact * 0.06 * (1 - b.baseStability * 0.3);
      
      // === BIAS SHIFT ===
      // Collisions can shift spin bias based on impact direction
      a.spin.bias += (ny * 0.3) * impact;
      b.spin.bias -= (ny * 0.3) * impact;
      a.spin.bias = clamp(a.spin.bias, -1, 1);
      b.spin.bias = clamp(b.spin.bias, -1, 1);
      
      // Visual effects
      this.fx.impact((a.x + b.x) / 2, (a.y + b.y) / 2, impact);
      
      if (impact > 0.25) {
        const words = impact > 0.55 
          ? ['CRUNCH!', 'SMASH!', 'BRUTAL!', 'DEVASTATING!']
          : ['HIT!', 'CLASH!', 'BAM!', 'IMPACT!'];
        this.fx.popText(
          (a.x + b.x) / 2, 
          (a.y + b.y) / 2 - 25, 
          words[randInt(0, words.length - 1)], 
          0.8 + impact * 0.6,
          COLORS.violentPink
        );
        
        // Show spin transfer message for significant transfers
        if (transferAmount > 0.05) {
          const winner = spinDiff > 0 ? a : b;
          setTimeout(() => {
            this.fx.popText(winner.x, winner.y - 40, 'SPIN STEAL!', 0.7, COLORS.acidLime);
          }, 150);
        }
      }
      
      return true;
    },
    
    // === NEW: Kill ship with specific type ===
    killShip(ship, killType) {
      if (!ship.alive) return;
      
      ship.alive = false;
      ship.killType = killType;
      
      this.fx.killEffect(ship.x, ship.y, killType);
      
      const messages = {
        [KILL_TYPE.SHATTER]: ['SHATTERED!', 'DESTROYED!', 'OBLITERATED!'],
        [KILL_TYPE.DESYNC]: ['DESYNCED!', 'LOST COHERENCE!', 'SIGNAL LOST!'],
        [KILL_TYPE.RINGOUT]: ['RING OUT!', 'PUSHED OUT!', 'EXPELLED!'],
        [KILL_TYPE.STALL]: ['STALLED!', 'MOMENTUM LOST!', 'DEAD SPIN!'],
        [KILL_TYPE.VOLATILITY]: ['CONSUMED!', 'VOLATILITY KO!', 'ZONE DEATH!']
      };
      
      const colors = {
        [KILL_TYPE.SHATTER]: COLORS.hotMagenta,
        [KILL_TYPE.DESYNC]: COLORS.desyncPurple,
        [KILL_TYPE.RINGOUT]: COLORS.burntOrange,
        [KILL_TYPE.STALL]: COLORS.stallGray,
        [KILL_TYPE.VOLATILITY]: COLORS.bearOrange
      };
      
      const msg = messages[killType][randInt(0, messages[killType].length - 1)];
      this.fx.popText(ship.x, ship.y, msg, 1.5, colors[killType]);
    },
    
    loop(now) {
      if (!this.active) return;
      const dt = Math.min(0.033, (now - this.lastTime) / 1000);
      this.lastTime = now;
      
      this.update(dt);
      this.render();
      
      this.raf = requestAnimationFrame((t) => this.loop(t));
    },
    
    update(dt) {
      // Countdown phase
      if (this.phase === 'countdown') {
        this.countdown -= dt;
        if (this.countdown <= 0) {
          this.phase = 'fighting';
          this.setBanner('FIGHT!');
          setTimeout(() => this.setBanner(''), 600);
        } else {
          this.setBanner(Math.ceil(this.countdown).toString());
        }
        this.fx.update(dt);
        return;
      }
      
      if (this.phase === 'ended') {
        this.fx.update(dt);
        return;
      }
      
      this.fightTime += dt;
      
      // Update ships
      for (let i = 0; i < this.ships.length; i++) {
        const ship = this.ships[i];
        const other = this.ships[1 - i];
        if (!ship.alive) continue;
        
        // === REGIME-BASED MOVEMENT ===
        const regime = ship.telemetry.regimeBias;
        let ax = 0, ay = 0;
        
        if (regime === 'trend') {
          // Trend-followers: aggressive center push with momentum
          const centerX = (this.arenaLeft + this.arenaRight) / 2;
          const centerY = (this.arenaTop + this.arenaBottom) / 2;
          ax = (centerX - ship.x) * 0.4 * ship.spin.angular;
          ay = (centerY - ship.y) * 0.4 * ship.spin.angular;
        } else if (regime === 'chaotic') {
          // Chaotic: erratic bursts affected by coherence
          const chaos = ship.volatility * (2 - ship.spin.coherence);
          ax = rand(-250, 250) * chaos;
          ay = rand(-250, 250) * chaos;
        } else {
          // Range-bound: orbital motion with bias influence
          const centerX = (this.arenaLeft + this.arenaRight) / 2;
          const centerY = (this.arenaTop + this.arenaBottom) / 2;
          const dx = ship.x - centerX;
          const dy = ship.y - centerY;
          // Bias affects orbit direction
          const biasInfluence = 1 + ship.spin.bias * 0.3;
          ax = -dy * 0.9 * biasInfluence + rand(-40, 40);
          ay = dx * 0.9 * biasInfluence + rand(-40, 40);
        }
        
        // === ANGULAR TO LINEAR COUPLING ===
        // High spin curves trajectories based on bias
        const tangent = vec.perp(ship.vx, ship.vy);
        const tangentLen = Math.hypot(tangent.x, tangent.y);
        if (tangentLen > 0) {
          const coupling = this.config.angularVelocityCoupling * ship.spin.angular;
          const biasEffect = ship.spin.bias * coupling * tangentLen;
          ax += tangent.x / tangentLen * biasEffect * 100;
          ay += tangent.y / tangentLen * biasEffect * 100;
        }
        
        // Apply acceleration
        ship.vx += ax * dt;
        ship.vy += ay * dt;
        
        // === MACD MAGNETIC FORCE FIELDS ===
        // Apply nonlinear magnetic forces from both MACD walls
        // Bullish zones repel & energize, Bearish zones attract & slow
        let topFieldResult = { strength: 0, isBullish: true };
        let bottomFieldResult = { strength: 0, isBullish: true };
        
        // Apply force from top wall (ship 0's MACD)
        if (this.ships[0] && this.ships[0].macdCurve) {
          topFieldResult = MACDForceField.applyForce(ship, this.ships[0], this, dt);
          MACDForceField.applySecondaryEffects(ship, topFieldResult.strength, topFieldResult.isBullish, dt);
        }
        
        // Apply force from bottom wall (ship 1's MACD)
        if (this.ships[1] && this.ships[1].macdCurve) {
          bottomFieldResult = MACDForceField.applyForce(ship, this.ships[1], this, dt);
          MACDForceField.applySecondaryEffects(ship, bottomFieldResult.strength, bottomFieldResult.isBullish, dt);
        }
        
        // Apply velocity modulation from strongest field
        const strongerField = topFieldResult.strength > bottomFieldResult.strength 
          ? topFieldResult : bottomFieldResult;
        MACDForceField.applyVelocityModulation(ship, strongerField.strength, strongerField.isBullish);
        
        // Visual feedback for strong field effects
        if (strongerField.strength > 0.25 && Math.random() < strongerField.strength * 0.08) {
          const fieldColor = strongerField.isBullish ? COLORS.bullGreen : COLORS.bearOrange;
          this.fx.popText(ship.x, ship.y - 20, strongerField.isBullish ? 'REPEL' : 'DRAG', 0.6, fieldColor);
        }
        
        // === BEARISH ZONE TIME TRACKING ===
        // Track time spent in strong bearish zones for VOLATILITY kill
        const inStrongBearishZone = !strongerField.isBullish && strongerField.strength > 0.3;
        if (inStrongBearishZone) {
          ship.bearishZoneTime += dt * strongerField.strength;
          // Visual warning when accumulating
          if (ship.bearishZoneTime > this.config.bearishZoneTimeLimit * 0.5 && Math.random() < 0.1) {
            this.fx.popText(ship.x, ship.y + 20, 'VOLATILE!', 0.5, COLORS.bearOrange);
          }
        } else {
          // Slowly recover when not in bearish zone
          ship.bearishZoneTime = Math.max(0, ship.bearishZoneTime - dt * 0.3);
        }
        
        // Clamp speed (affected by coherence - low coherence = slower)
        const effectiveMaxSpeed = ship.maxSpeed * (0.5 + 0.5 * ship.spin.coherence);
        const speed = Math.hypot(ship.vx, ship.vy);
        if (speed > effectiveMaxSpeed) {
          ship.vx = (ship.vx / speed) * effectiveMaxSpeed;
          ship.vy = (ship.vy / speed) * effectiveMaxSpeed;
        }
        
        // Apply velocity
        ship.x += ship.vx * dt;
        ship.y += ship.vy * dt;
        
        // Trail (coherence affects trail visibility)
        this.fx.pushTrail(ship.ticker, ship.x, ship.y, ship.color, ship.spin.coherence);
        
        // === EDGE PRESSURE SYSTEM (Replaces hard walls) ===
        const edgePressure = this.calculateEdgePressure(ship);
        
        if (edgePressure > 0) {
          // Apply pressure effects
          ship.spin.coherence -= edgePressure * 0.015 * dt * 60;
          ship.spin.angular -= edgePressure * 0.025 * dt * 60;
          ship.integrity -= edgePressure * 0.008 * dt * 60;
          
          // Track time under pressure
          ship.edgePressureTime += dt * edgePressure;
          
          // Visual warning
          if (Math.random() < edgePressure * 0.15) {
            this.fx.pressureWarning(ship.x, ship.y, ship.radius * 1.5);
          }
          
          // Soft push back toward center
          const centerX = (this.arenaLeft + this.arenaRight) / 2;
          const centerY = (this.arenaTop + this.arenaBottom) / 2;
          const pushX = (centerX - ship.x) * edgePressure * 0.5;
          const pushY = (centerY - ship.y) * edgePressure * 0.5;
          ship.vx += pushX * dt * 60;
          ship.vy += pushY * dt * 60;
        } else {
          // Recover from edge pressure when not at edge
          ship.edgePressureTime = Math.max(0, ship.edgePressureTime - dt * 0.5);
        }
        
        // Hard boundary enforcement (last resort)
        const xNorm = (ship.x - this.arenaLeft) / (this.arenaRight - this.arenaLeft);
        
        if (ship.x < this.arenaLeft + ship.radius) {
          ship.x = this.arenaLeft + ship.radius;
          ship.vx = Math.abs(ship.vx) * 0.5;
        }
        if (ship.x > this.arenaRight - ship.radius) {
          ship.x = this.arenaRight - ship.radius;
          ship.vx = -Math.abs(ship.vx) * 0.5;
        }
        
        // === MACD WALL COLLISIONS (Polarity-Aware) ===
        const topWall = this.ships[0];
        const bottomWall = this.ships[1];
        
        // Top wall collision
        const topY = this.getChartY(topWall, xNorm, true);
        if (ship.y < topY + ship.radius) {
          ship.y = topY + ship.radius;
          
          // Get wall polarity at this X position
          const topMacdVal = this.getMacdValueAtX(topWall, xNorm);
          const topBullish = topMacdVal > 0;
          const impactSpeed = Math.abs(ship.vy);
          
          if (topBullish) {
            // Bullish wall: snappy rebound, preserve coherence
            ship.vy = Math.abs(ship.vy) * 0.8;
            ship.spin.angular *= 0.92;
            ship.spin.coherence -= impactSpeed * 0.001;
            // Small energy boost
            ship.vx *= 1.05;
            if (impactSpeed > 50) {
              this.fx.popText(ship.x, ship.y - 15, 'SNAP!', 0.5, COLORS.bullGreen);
            }
          } else {
            // Bearish wall: absorbs energy, destabilizes
            ship.vy = Math.abs(ship.vy) * 0.4;
            ship.spin.angular *= 0.75;
            ship.spin.coherence -= impactSpeed * 0.004;
            ship.integrity -= impactSpeed * 0.0015;
            // Feels sticky
            ship.vx *= 0.85;
            if (impactSpeed > 50) {
              this.fx.popText(ship.x, ship.y - 15, 'STUCK!', 0.5, COLORS.bearOrange);
              this.fx.desyncPulse(ship.x, ship.y);
            }
          }
        }
        
        // Bottom wall collision
        const bottomY = this.getChartY(bottomWall, xNorm, true);
        if (ship.y > bottomY - ship.radius) {
          ship.y = bottomY - ship.radius;
          
          // Get wall polarity at this X position
          const bottomMacdVal = this.getMacdValueAtX(bottomWall, xNorm);
          const bottomBullish = bottomMacdVal > 0;
          const impactSpeed = Math.abs(ship.vy);
          
          if (bottomBullish) {
            // Bullish wall: snappy rebound
            ship.vy = -Math.abs(ship.vy) * 0.8;
            ship.spin.angular *= 0.92;
            ship.spin.coherence -= impactSpeed * 0.001;
            ship.vx *= 1.05;
            if (impactSpeed > 50) {
              this.fx.popText(ship.x, ship.y + 15, 'SNAP!', 0.5, COLORS.bullGreen);
            }
          } else {
            // Bearish wall: absorbs energy
            ship.vy = -Math.abs(ship.vy) * 0.4;
            ship.spin.angular *= 0.75;
            ship.spin.coherence -= impactSpeed * 0.004;
            ship.integrity -= impactSpeed * 0.0015;
            ship.vx *= 0.85;
            if (impactSpeed > 50) {
              this.fx.popText(ship.x, ship.y + 15, 'STUCK!', 0.5, COLORS.bearOrange);
              this.fx.desyncPulse(ship.x, ship.y);
            }
          }
        }
        
        // === EMANATION ZONES ===
        const emanation = this.checkEmanations(ship, other);
        if (emanation.active) {
          if (emanation.bullish) {
            // Boost zone: restore spin and coherence
            ship.spin.angular = Math.min(1.2, ship.spin.angular + 0.025 * emanation.strength);
            ship.spin.coherence = Math.min(1, ship.spin.coherence + 0.02 * emanation.strength);
            ship.energy = Math.min(1, ship.energy + 0.015 * emanation.strength);
            if (Math.random() < 0.04) {
              this.fx.emanationHit(ship.x, ship.y, true);
              this.fx.popText(ship.x, ship.y - 30, 'BOOST!', 0.9, COLORS.bullGreen);
            }
          } else {
            // Hazard zone: damage coherence and integrity
            ship.spin.coherence -= 0.02 * emanation.strength;
            ship.spin.angular -= 0.015 * emanation.strength;
            ship.integrity -= 0.012 * emanation.strength;
            // Add bias shift from hazard
            ship.spin.bias += rand(-0.1, 0.1) * emanation.strength;
            if (Math.random() < 0.04) {
              this.fx.emanationHit(ship.x, ship.y, false);
              this.fx.popText(ship.x, ship.y - 30, 'HAZARD!', 0.9, COLORS.bearOrange);
            }
          }
        }
        
        // === NATURAL DECAY ===
        // Spin decays based on volatility and retention stat
        const spinDecay = this.config.spinDecayBase * (1 + ship.volatility * 0.5) * (1 - ship.spinRetention * 0.3);
        ship.spin.angular -= spinDecay * dt * 60;
        
        // Coherence decays slowly
        ship.spin.coherence -= this.config.coherenceDecayBase * dt * 60;
        
        // Energy decay
        ship.energy -= dt * 0.012;
        
        // Bias drifts toward zero slowly
        ship.spin.bias *= 0.995;
        
        // === COHERENCE INSTABILITY EFFECTS ===
        if (ship.spin.coherence < 0.4) {
          // Jitter increases as coherence drops
          const jitter = (0.4 - ship.spin.coherence) * 2;
          ship.vx += rand(-30, 30) * jitter;
          ship.vy += rand(-30, 30) * jitter;
          
          // Random bias drift
          ship.spin.bias += rand(-0.15, 0.15) * jitter * dt * 60;
          
          // Visual desync effect
          if (Math.random() < 0.03 * jitter) {
            this.fx.desyncPulse(ship.x + rand(-10, 10), ship.y + rand(-10, 10));
          }
        }
        
        // Low spin affects movement (wobble)
        if (ship.spin.angular < 0.4) {
          const wobbleFactor = 1 - (ship.spin.angular / 0.4);
          ship.vx *= 1 - wobbleFactor * 0.03;
          ship.vy *= 1 - wobbleFactor * 0.03;
        }
        
        // Update visual angle (affected by angular spin and bias)
        const baseRotation = 5 + 12 * ship.spin.angular;
        const biasRotation = ship.spin.bias * 3;
        ship.angle += (baseRotation + biasRotation) * dt;
        
        // === STALL TRACKING ===
        if (ship.spin.angular < this.config.stallThreshold) {
          ship.stallTime += dt;
        } else {
          ship.stallTime = Math.max(0, ship.stallTime - dt * 0.5);
        }
        
        // === KILL CONDITION CHECKS ===
        // Clamp values
        ship.spin.angular = Math.max(0, ship.spin.angular);
        ship.spin.coherence = Math.max(0, ship.spin.coherence);
        ship.integrity = Math.max(0, ship.integrity);
        
        // Check death conditions (in priority order)
        if (ship.integrity <= 0) {
          this.killShip(ship, KILL_TYPE.SHATTER);
        } else if (ship.spin.coherence <= 0) {
          this.killShip(ship, KILL_TYPE.DESYNC);
        } else if (ship.edgePressureTime >= this.config.edgePressureTimeLimit) {
          this.killShip(ship, KILL_TYPE.RINGOUT);
        } else if (ship.stallTime >= this.config.stallTimeLimit) {
          this.killShip(ship, KILL_TYPE.STALL);
        } else if (ship.bearishZoneTime >= this.config.bearishZoneTimeLimit) {
          this.killShip(ship, KILL_TYPE.VOLATILITY);
        }
      }
      
      // Ship-to-ship collision
      if (this.ships[0].alive && this.ships[1].alive) {
        this.resolveCollision(this.ships[0], this.ships[1]);
      }
      
      // Check for winner
      const alive = this.ships.filter(s => s.alive);
      if (alive.length <= 1) {
        this.phase = 'ended';
        const winner = alive[0] ? alive[0].ticker : 'DRAW';
        this.setBanner(`WINNER: ${winner}`);
      }
      
      this.fx.update(dt);
      this.updateSidePanels();
    },
    
    render() {
      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;
      
      ctx.clearRect(0, 0, w, h);
      
      // Apply shake
      ctx.save();
      const shake = this.fx.getShakeOffset();
      ctx.translate(shake.x, shake.y);
      
      // Background
      this.drawBackground(ctx, w, h);
      
      // Draw MACD charts as boundaries
      this.drawChartBoundary(ctx, this.ships[0], true);
      this.drawChartBoundary(ctx, this.ships[1], false);
      
      // Draw MACD force field gradients (magnetic influence zones)
      this.drawForceFieldGradients(ctx);
      
      // Draw emanation zones
      this.drawEmanations(ctx);
      
      // Draw edge pressure zones
      this.drawEdgePressureZones(ctx);
      
      // Draw arena ring
      this.drawCenterRing(ctx, w, h);
      
      // Draw ships
      for (const ship of this.ships) {
        if (ship.alive) {
          this.drawShip(ctx, ship);
        }
      }
      
      // FX
      this.fx.draw(ctx);
      
      // Scanlines
      this.drawScanlines(ctx, w, h);
      
      ctx.restore();
    },
    
    drawBackground(ctx, w, h) {
      // Dark gradient
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#1a0a1a');
      grad.addColorStop(0.5, '#0a0008');
      grad.addColorStop(1, '#0f0812');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      
      // Grid
      ctx.save();
      ctx.globalAlpha = 0.1;
      ctx.strokeStyle = COLORS.hotMagenta;
      ctx.lineWidth = 1;
      
      for (let x = this.arenaLeft; x <= this.arenaRight; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, this.arenaTop);
        ctx.lineTo(x, this.arenaBottom);
        ctx.stroke();
      }
      for (let y = this.arenaTop; y <= this.arenaBottom; y += 40) {
        ctx.beginPath();
        ctx.moveTo(this.arenaLeft, y);
        ctx.lineTo(this.arenaRight, y);
        ctx.stroke();
      }
      ctx.restore();
    },
    
    drawEdgePressureZones(ctx) {
      const time = performance.now() * 0.001;
      ctx.save();
      ctx.globalAlpha = 0.1 + 0.05 * Math.sin(time * 2);
      
      // Left edge pressure zone
      const leftGrad = ctx.createLinearGradient(this.arenaLeft, 0, this.arenaLeft + this.edgePressureBand, 0);
      leftGrad.addColorStop(0, COLORS.hotMagenta);
      leftGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = leftGrad;
      ctx.fillRect(this.arenaLeft, this.arenaTop, this.edgePressureBand, this.arenaBottom - this.arenaTop);
      
      // Right edge pressure zone
      const rightGrad = ctx.createLinearGradient(this.arenaRight - this.edgePressureBand, 0, this.arenaRight, 0);
      rightGrad.addColorStop(0, 'transparent');
      rightGrad.addColorStop(1, COLORS.hotMagenta);
      ctx.fillStyle = rightGrad;
      ctx.fillRect(this.arenaRight - this.edgePressureBand, this.arenaTop, this.edgePressureBand, this.arenaBottom - this.arenaTop);
      
      ctx.restore();
    },
    
    drawChartBoundary(ctx, ship, isTop) {
      const curve = ship.macdCurve;
      const arenaWidth = this.arenaRight - this.arenaLeft;
      
      ctx.save();
      
      // Draw chart background panel
      if (isTop) {
        ctx.fillStyle = 'rgba(30, 10, 30, 0.8)';
        ctx.fillRect(this.arenaLeft - 10, 0, arenaWidth + 20, this.chartHeight + 10);
      } else {
        ctx.fillStyle = 'rgba(10, 30, 30, 0.8)';
        ctx.fillRect(this.arenaLeft - 10, this.canvas.height - this.chartHeight - 10, arenaWidth + 20, this.chartHeight + 10);
      }
      
      // Draw MACD line
      ctx.beginPath();
      ctx.strokeStyle = ship.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = ship.color;
      ctx.shadowBlur = 8;
      
      const baseY = isTop ? this.chartHeight / 2 : this.canvas.height - this.chartHeight / 2;
      
      for (let i = 0; i < curve.length; i++) {
        const x = this.arenaLeft + (i / (curve.length - 1)) * arenaWidth;
        const y = baseY - curve[i] * (this.chartHeight * 0.4);
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      
      // Draw signal line (slightly smoothed version)
      ctx.beginPath();
      ctx.strokeStyle = isTop ? COLORS.burntOrange : COLORS.acidLime;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.6;
      
      let smoothed = 0;
      for (let i = 0; i < curve.length; i++) {
        smoothed = smoothed * 0.8 + curve[i] * 0.2;
        const x = this.arenaLeft + (i / (curve.length - 1)) * arenaWidth;
        const y = baseY - smoothed * (this.chartHeight * 0.4);
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      
      // Draw histogram bars
      ctx.globalAlpha = 0.4;
      for (let i = 0; i < curve.length; i++) {
        const x = this.arenaLeft + (i / (curve.length - 1)) * arenaWidth;
        const barHeight = curve[i] * (this.chartHeight * 0.3);
        
        ctx.fillStyle = curve[i] > 0 ? COLORS.bullGreen : COLORS.bearOrange;
        ctx.fillRect(x - 2, baseY, 4, -barHeight);
      }
      
      ctx.restore();
    },
    
    drawEmanations(ctx) {
      const arenaWidth = this.arenaRight - this.arenaLeft;
      const time = performance.now() * 0.001;
      
      for (const ship of this.ships) {
        for (const cross of ship.crossovers) {
          const x = this.arenaLeft + cross.x * arenaWidth;
          const baseY = ship.isTop ? this.chartHeight : this.canvas.height - this.chartHeight;
          
          // Direction into arena
          const dir = ship.isTop ? 1 : -1;
          const emanationLength = 65 + 45 * cross.strength;
          
          // Pulsing glow
          const pulse = 0.5 + 0.5 * Math.sin(time * 4 + cross.x * 10);
          
          ctx.save();
          ctx.globalAlpha = 0.35 + 0.2 * pulse;
          
          // Gradient emanation
          const grad = ctx.createLinearGradient(x, baseY, x, baseY + dir * emanationLength);
          const color = cross.bullish ? COLORS.bullGreen : COLORS.bearOrange;
          grad.addColorStop(0, color);
          grad.addColorStop(1, 'transparent');
          
          ctx.fillStyle = grad;
          
          // Draw spike shape
          ctx.beginPath();
          ctx.moveTo(x - 18, baseY);
          ctx.lineTo(x, baseY + dir * emanationLength);
          ctx.lineTo(x + 18, baseY);
          ctx.closePath();
          ctx.fill();
          
          // Bright tip
          ctx.globalAlpha = 0.65 + 0.3 * pulse;
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = 18;
          ctx.beginPath();
          ctx.arc(x, baseY + dir * emanationLength * 0.7, 5, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.restore();
        }
      }
    },
    
    // === NEW: Draw MACD magnetic force field visualization ===
    drawForceFieldGradients(ctx) {
      const arenaWidth = this.arenaRight - this.arenaLeft;
      const time = performance.now() * 0.001;
      const maxRange = MACDForceField.config.maxRange;
      
      for (const ship of this.ships) {
        if (!ship.macdCurve) continue;
        
        const isTop = ship.isTop;
        const curve = ship.macdCurve;
        
        // Sample the curve at intervals and draw force field bands
        const numSamples = 30;
        
        for (let i = 0; i < numSamples; i++) {
          const xNorm = i / (numSamples - 1);
          const x = this.arenaLeft + xNorm * arenaWidth;
          const macdVal = this.getMacdValueAtX(ship, xNorm);
          const isBullish = macdVal > 0;
          const strength = Math.abs(macdVal);
          
          // Base position (inner boundary)
          const innerY = this.getChartY(ship, xNorm, true);
          const dir = isTop ? 1 : -1;
          
          // Field gradient depth (stronger MACD = wider field)
          const fieldDepth = maxRange * (0.4 + 0.6 * strength);
          
          // Draw gradient band
          ctx.save();
          
          const grad = ctx.createLinearGradient(x, innerY, x, innerY + dir * fieldDepth);
          const baseColor = isBullish ? COLORS.bullGreen : COLORS.bearOrange;
          
          // Pulsing based on polarity
          const pulse = 0.5 + 0.3 * Math.sin(time * (isBullish ? 3 : 2) + xNorm * 8);
          
          grad.addColorStop(0, baseColor);
          grad.addColorStop(0.5, isBullish ? 'rgba(0, 255, 170, 0.1)' : 'rgba(255, 100, 50, 0.15)');
          grad.addColorStop(1, 'transparent');
          
          ctx.globalAlpha = 0.08 + 0.05 * pulse * strength;
          ctx.fillStyle = grad;
          
          const bandWidth = arenaWidth / numSamples + 2;
          ctx.fillRect(x - bandWidth / 2, innerY, bandWidth, dir * fieldDepth);
          
          // Draw field lines for strong sections
          if (strength > 0.4 && i % 3 === 0) {
            ctx.globalAlpha = 0.15 * strength * pulse;
            ctx.strokeStyle = baseColor;
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            
            ctx.beginPath();
            ctx.moveTo(x, innerY);
            ctx.lineTo(x, innerY + dir * fieldDepth * 0.8);
            ctx.stroke();
            
            // Arrow head showing force direction
            const arrowY = innerY + dir * fieldDepth * 0.6;
            const arrowDir = isBullish ? dir : -dir; // Bullish pushes out, bearish pulls in
            
            ctx.beginPath();
            ctx.moveTo(x - 4, arrowY);
            ctx.lineTo(x, arrowY + arrowDir * 8);
            ctx.lineTo(x + 4, arrowY);
            ctx.stroke();
          }
          
          ctx.restore();
        }
      }
    },
    
    drawCenterRing(ctx, w, h) {
      const centerX = (this.arenaLeft + this.arenaRight) / 2;
      const centerY = (this.arenaTop + this.arenaBottom) / 2;
      const radius = Math.min(this.arenaRight - this.arenaLeft, this.arenaBottom - this.arenaTop) * 0.35;
      
      const time = performance.now() * 0.001;
      
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.strokeStyle = COLORS.hotMagenta;
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 10]);
      ctx.lineDashOffset = time * 20;
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.setLineDash([]);
      ctx.restore();
    },
    
    drawShip(ctx, ship) {
      const time = performance.now() * 0.001;
      
      ctx.save();
      ctx.translate(ship.x, ship.y);
      
      // Coherence affects visual stability
      const jitter = (1 - ship.spin.coherence) * 3;
      if (jitter > 0.5) {
        ctx.translate(rand(-jitter, jitter), rand(-jitter, jitter));
      }
      
      // Outer glow ring (pulsing based on spin)
      ctx.globalAlpha = 0.3 + 0.15 * Math.sin(time * 3 * ship.spin.angular);
      ctx.strokeStyle = ship.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = ship.color;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(0, 0, ship.radius * 1.35, 0, Math.PI * 2);
      ctx.stroke();
      
      // Hull integrity ring
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = ship.integrity > 0.5 ? COLORS.acidLime : ship.integrity > 0.25 ? COLORS.warnYellow : COLORS.hotMagenta;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, ship.radius * 1.15, -Math.PI/2, -Math.PI/2 + Math.PI * 2 * ship.integrity);
      ctx.stroke();
      
      // Coherence ring (inner)
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = ship.spin.coherence > 0.5 ? COLORS.toxicCyan : ship.spin.coherence > 0.25 ? COLORS.warnYellow : COLORS.desyncPurple;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, ship.radius * 0.95, -Math.PI/2, -Math.PI/2 + Math.PI * 2 * ship.spin.coherence);
      ctx.stroke();
      
      // Spin ring (rotating segments)
      ctx.save();
      ctx.rotate(ship.angle);
      ctx.globalAlpha = 0.5 + 0.2 * ship.spin.angular;
      ctx.strokeStyle = ship.color;
      ctx.lineWidth = 3;
      
      // Number of segments based on spin
      const segments = Math.max(2, Math.floor(3 + ship.spin.angular * 2));
      for (let i = 0; i < segments; i++) {
        const segAngle = (i / segments) * Math.PI * 2;
        const segLength = 0.8 + ship.spin.angular * 0.6;
        ctx.beginPath();
        ctx.arc(0, 0, ship.radius * (0.55 + i * 0.08), segAngle, segAngle + segLength);
        ctx.stroke();
      }
      ctx.restore();
      
      // Core
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = ship.color;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(0, 0, ship.radius * 0.38, 0, Math.PI * 2);
      ctx.fill();
      
      // Sprite
      if (ship.spriteImg) {
        ctx.globalAlpha = 0.85;
        ctx.shadowBlur = 0;
        const scale = (ship.radius * 1.25) / Math.max(ship.spriteImg.width, ship.spriteImg.height);
        ctx.save();
        ctx.rotate(-ship.angle * 0.3);
        ctx.scale(scale, scale);
        ctx.drawImage(ship.spriteImg, -ship.spriteImg.width/2, -ship.spriteImg.height/2);
        ctx.restore();
      }
      
      ctx.restore();
      
      // Ticker label
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.font = 'bold 12px "VT323", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = ship.color;
      ctx.shadowColor = ship.color;
      ctx.shadowBlur = 6;
      ctx.fillText(ship.ticker, ship.x, ship.y - ship.radius - 12);
      ctx.restore();
    },
    
    drawScanlines(ctx, w, h) {
      ctx.save();
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = '#000';
      for (let y = 0; y < h; y += 3) {
        ctx.fillRect(0, y, w, 1);
      }
      ctx.restore();
    }
  };
  
  // =========================================================================
  // UI WIRING
  // =========================================================================
  function getActiveTicker() {
    try {
      if (window.PaintBay?.getSelectedShip) {
        const t = window.PaintBay.getSelectedShip();
        if (t) return t;
      }
    } catch (e) {}
    try {
      if (window.SpaceRun?.selectedShip) return window.SpaceRun.selectedShip;
    } catch (e) {}
    return 'RKLB';
  }
  
  function pickOpponent(exclude) {
    const tele = window.ShipTelemetry?._TELEMETRY;
    const keys = tele ? Object.keys(tele) : ['ACHR', 'RKLB', 'GME', 'GE', 'LUNR', 'JOBY', 'ASTS', 'BKSY'];
    const pool = keys.filter(k => k && k !== exclude);
    return pool[randInt(0, pool.length - 1)] || 'ASTS';
  }
  
  function bindLaunchers() {
    const btn = document.getElementById('bey-arena-launch');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const a = getActiveTicker();
      const b = pickOpponent(a);
      BeyArena.open(a, b);
    });
  }
  
  window.BeyArena = BeyArena;
  
  window.addEventListener('DOMContentLoaded', () => {
    BeyArena.init();
    bindLaunchers();
  });
})();
