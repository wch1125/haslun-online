// =========================================================================
// BEY ARENA v2 — MACD Chart Arena
// 
// The arena boundaries ARE the price data:
// - Top boundary = Player A's MACD curve
// - Bottom boundary = Player B's MACD curve  
// - Signal crossovers create emanation zones (boost/hazard)
// - Ships battle between the two charts
// =========================================================================

(function() {
  'use strict';
  
  // --- Utilities ---
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (min, max) => min + Math.random() * (max - min);
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  
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
    bearOrange: '#ff6633'
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
  // FX SYSTEM
  // =========================================================================
  function FXSystem() {
    this.particles = [];
    this.sparks = [];
    this.pops = [];
    this.shake = { amp: 0, time: 0 };
    this.trails = new Map();
    this.screenFlash = { color: null, alpha: 0 };
  }
  
  FXSystem.prototype.addShake = function(amp) {
    this.shake.amp = Math.min(20, this.shake.amp + amp);
    this.shake.time = 0.15;
  };
  
  FXSystem.prototype.flash = function(color, intensity = 0.4) {
    this.screenFlash.color = color;
    this.screenFlash.alpha = intensity;
  };
  
  FXSystem.prototype.pushTrail = function(id, x, y, color) {
    let arr = this.trails.get(id);
    if (!arr) { arr = []; this.trails.set(id, arr); }
    arr.push({ x, y, life: 0.3, color });
    if (arr.length > 20) arr.shift();
  };
  
  FXSystem.prototype.impact = function(x, y, intensity) {
    const count = Math.floor(8 + intensity * 20);
    for (let i = 0; i < count; i++) {
      const ang = rand(0, Math.PI * 2);
      const spd = rand(100, 400) * intensity;
      this.sparks.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: rand(0.1, 0.3),
        size: rand(1, 3),
        color: Math.random() < 0.5 ? COLORS.violentPink : COLORS.burntOrange
      });
    }
    this.addShake(3 + intensity * 8);
  };
  
  FXSystem.prototype.emanationHit = function(x, y, bullish) {
    const color = bullish ? COLORS.bullGreen : COLORS.bearOrange;
    for (let i = 0; i < 12; i++) {
      const ang = rand(0, Math.PI * 2);
      const spd = rand(50, 150);
      this.sparks.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: rand(0.2, 0.4),
        size: rand(2, 4),
        color
      });
    }
    this.flash(color, 0.2);
  };
  
  FXSystem.prototype.popText = function(x, y, text, scale, color) {
    this.pops.push({ 
      x, y, text, life: 0.8, scale: scale || 1, 
      color: color || '#ffffff'
    });
  };
  
  FXSystem.prototype.update = function(dt) {
    this.shake.time -= dt;
    if (this.shake.time < 0) this.shake.amp *= 0.85;
    
    this.screenFlash.alpha *= 0.9;
    
    for (const spark of this.sparks) {
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.vx *= 0.95;
      spark.vy *= 0.95;
      spark.life -= dt;
    }
    this.sparks = this.sparks.filter(s => s.life > 0);
    
    for (const p of this.pops) {
      p.life -= dt;
      p.y -= 40 * dt;
    }
    this.pops = this.pops.filter(p => p.life > 0);
    
    for (const [id, arr] of this.trails) {
      for (const t of arr) t.life -= dt;
      this.trails.set(id, arr.filter(t => t.life > 0));
    }
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
        ctx.globalAlpha = t.life * 0.6;
        ctx.fillStyle = t.color;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Draw sparks
    for (const s of this.sparks) {
      ctx.globalAlpha = s.life * 2;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Draw pop text
    for (const p of this.pops) {
      ctx.globalAlpha = p.life;
      ctx.font = `bold ${Math.floor(16 * p.scale)}px "VT323", monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.fillText(p.text, p.x + 2, p.y + 2);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
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
  // SHIP CREATION
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
      vx: rand(-50, 50),
      vy: rand(-30, 30),
      radius: 22 + 8 * telemetry.hullResilience,
      mass: 1 + telemetry.hullResilience,
      
      // State
      integrity: 1.0,
      spin: 1.0,
      energy: 1.0,
      alive: true,
      angle: 0,
      
      // Derived stats
      maxSpeed: 150 + 200 * telemetry.thrustPotential,
      stability: 0.3 + 0.7 * telemetry.maneuverStability,
      volatility: telemetry.chopSensitivity
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
    
    ships: [],
    fx: new FXSystem(),
    fightTime: 0,
    phase: 'countdown', // 'countdown', 'fighting', 'ended'
    countdown: 3,
    
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
        const spin = Math.round(ship.spin * 100);
        const energy = Math.round(ship.energy * 100);
        const regime = ship.telemetry.regimeBias?.toUpperCase() || 'RANGE';
        
        const hullColor = hull > 60 ? COLORS.acidLime : hull > 30 ? COLORS.warnYellow : COLORS.hotMagenta;
        const spinColor = spin > 50 ? COLORS.acidLime : spin > 25 ? COLORS.warnYellow : COLORS.hotMagenta;
        
        const statusClass = ship.alive ? (hull < 30 ? 'critical' : hull < 60 ? 'warning' : 'ok') : 'dead';
        const statusText = ship.alive ? (hull < 30 ? 'CRITICAL' : hull < 60 ? 'DAMAGED' : 'NOMINAL') : 'DESTROYED';
        
        const bar = (val, color) => `<div class="stat-bar"><div class="stat-fill" style="width:${val}%;background:${color}"></div></div>`;
        
        return `
<div class="pilot-header">
  <span class="pilot-ticker">${ship.ticker}</span>
  <span class="pilot-status ${statusClass}">${statusText}</span>
</div>
<div class="pilot-regime">${regime}</div>

<div class="stat-row"><span class="stat-label">HULL</span><span class="stat-value" style="color:${hullColor}">${hull}%</span></div>
${bar(hull, hullColor)}

<div class="stat-row"><span class="stat-label">SPIN</span><span class="stat-value" style="color:${spinColor}">${spin}%</span></div>
${bar(spin, spinColor)}

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
        // Top chart: higher curveValue = wall extends DOWN into arena
        const baseY = this.chartHeight;
        const extension = curveValue * 40; // How far wall extends
        return isInner ? baseY + 20 + Math.max(0, extension) : baseY;
      } else {
        // Bottom chart: lower curveValue = wall extends UP into arena
        const baseY = this.canvas.height - this.chartHeight;
        const extension = -curveValue * 40;
        return isInner ? baseY - 20 - Math.max(0, extension) : baseY;
      }
    },
    
    // Check if ship is in an emanation zone
    checkEmanations(ship, otherShip) {
      const xNorm = (ship.x - this.arenaLeft) / (this.arenaRight - this.arenaLeft);
      
      // Check other ship's crossovers (you're affected by opponent's chart)
      for (const cross of otherShip.crossovers) {
        const dist = Math.abs(xNorm - cross.x);
        if (dist < 0.08) { // Within emanation zone
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
          setTimeout(() => this.setBanner(''), 500);
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
        
        // Apply movement based on regime
        const regime = ship.telemetry.regimeBias;
        let ax = 0, ay = 0;
        
        if (regime === 'trend') {
          // Trend-followers move toward center and accelerate
          const centerX = (this.arenaLeft + this.arenaRight) / 2;
          const centerY = (this.arenaTop + this.arenaBottom) / 2;
          ax = (centerX - ship.x) * 0.3;
          ay = (centerY - ship.y) * 0.3;
        } else if (regime === 'chaotic') {
          // Chaotic movement
          ax = rand(-200, 200) * ship.volatility;
          ay = rand(-200, 200) * ship.volatility;
        } else {
          // Range-bound: orbit around center
          const centerX = (this.arenaLeft + this.arenaRight) / 2;
          const centerY = (this.arenaTop + this.arenaBottom) / 2;
          const dx = ship.x - centerX;
          const dy = ship.y - centerY;
          ax = -dy * 0.8 + rand(-50, 50);
          ay = dx * 0.8 + rand(-50, 50);
        }
        
        // Apply thrust
        const thrust = 80 + 120 * ship.telemetry.thrustPotential;
        ship.vx += ax * dt;
        ship.vy += ay * dt;
        
        // Clamp speed
        const speed = Math.hypot(ship.vx, ship.vy);
        if (speed > ship.maxSpeed) {
          ship.vx = (ship.vx / speed) * ship.maxSpeed;
          ship.vy = (ship.vy / speed) * ship.maxSpeed;
        }
        
        // Apply velocity
        ship.x += ship.vx * dt;
        ship.y += ship.vy * dt;
        
        // Trail
        this.fx.pushTrail(ship.ticker, ship.x, ship.y, ship.color);
        
        // Left/right bounds
        if (ship.x < this.arenaLeft + ship.radius) {
          ship.x = this.arenaLeft + ship.radius;
          ship.vx = Math.abs(ship.vx) * 0.7;
          ship.integrity -= 0.02;
        }
        if (ship.x > this.arenaRight - ship.radius) {
          ship.x = this.arenaRight - ship.radius;
          ship.vx = -Math.abs(ship.vx) * 0.7;
          ship.integrity -= 0.02;
        }
        
        // Chart boundary collision (top chart = ships[0], bottom = ships[1])
        const xNorm = (ship.x - this.arenaLeft) / (this.arenaRight - this.arenaLeft);
        
        // Top boundary (opponent A's chart if this is ship B, or own chart)
        const topChart = this.ships[0];
        const topY = this.getChartY(topChart, xNorm, true);
        if (ship.y < topY + ship.radius) {
          ship.y = topY + ship.radius;
          ship.vy = Math.abs(ship.vy) * 0.6;
          ship.integrity -= 0.03;
          this.fx.impact(ship.x, topY, 0.3);
        }
        
        // Bottom boundary
        const bottomChart = this.ships[1];
        const bottomY = this.getChartY(bottomChart, xNorm, true);
        if (ship.y > bottomY - ship.radius) {
          ship.y = bottomY - ship.radius;
          ship.vy = -Math.abs(ship.vy) * 0.6;
          ship.integrity -= 0.03;
          this.fx.impact(ship.x, bottomY, 0.3);
        }
        
        // Check emanation zones
        const emanation = this.checkEmanations(ship, other);
        if (emanation.active) {
          if (emanation.bullish) {
            // Boost!
            ship.spin = Math.min(1, ship.spin + 0.02 * emanation.strength);
            ship.energy = Math.min(1, ship.energy + 0.01 * emanation.strength);
            if (Math.random() < 0.05) {
              this.fx.emanationHit(ship.x, ship.y, true);
              this.fx.popText(ship.x, ship.y - 30, 'BOOST!', 0.8, COLORS.bullGreen);
            }
          } else {
            // Hazard!
            ship.spin = Math.max(0, ship.spin - 0.015 * emanation.strength);
            ship.integrity -= 0.01 * emanation.strength;
            if (Math.random() < 0.05) {
              this.fx.emanationHit(ship.x, ship.y, false);
              this.fx.popText(ship.x, ship.y - 30, 'HAZARD!', 0.8, COLORS.bearOrange);
            }
          }
        }
        
        // Natural decay
        ship.spin -= dt * 0.02 * (1 + ship.volatility);
        ship.energy -= dt * 0.01;
        
        // Spin affects movement
        if (ship.spin < 0.3) {
          ship.vx *= 0.98;
          ship.vy *= 0.98;
        }
        
        // Update angle
        ship.angle += (5 + 10 * ship.spin) * dt;
        
        // Check death conditions
        if (ship.integrity <= 0) {
          ship.alive = false;
          this.fx.impact(ship.x, ship.y, 1);
          this.fx.popText(ship.x, ship.y, 'DESTROYED!', 1.5, COLORS.hotMagenta);
        }
        if (ship.spin <= 0) {
          ship.alive = false;
          this.fx.popText(ship.x, ship.y, 'OUT OF SPIN!', 1.2, COLORS.warnYellow);
        }
      }
      
      // Ship-to-ship collision
      if (this.ships[0].alive && this.ships[1].alive) {
        const a = this.ships[0];
        const b = this.ships[1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = a.radius + b.radius;
        
        if (dist < minDist && dist > 0) {
          const nx = dx / dist;
          const ny = dy / dist;
          
          // Separate
          const overlap = minDist - dist;
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;
          
          // Bounce
          const dvx = a.vx - b.vx;
          const dvy = a.vy - b.vy;
          const dvn = dvx * nx + dvy * ny;
          
          if (dvn > 0) {
            const restitution = 0.7;
            const impulse = (1 + restitution) * dvn / (1/a.mass + 1/b.mass);
            
            a.vx -= impulse * nx / a.mass;
            a.vy -= impulse * ny / a.mass;
            b.vx += impulse * nx / b.mass;
            b.vy += impulse * ny / b.mass;
            
            // Damage based on impact
            const impactSpeed = Math.abs(dvn);
            const impact = clamp01(impactSpeed / 300);
            
            a.integrity -= impact * 0.1 * (1 - a.stability);
            b.integrity -= impact * 0.1 * (1 - b.stability);
            a.spin -= impact * 0.05;
            b.spin -= impact * 0.05;
            
            this.fx.impact((a.x + b.x) / 2, (a.y + b.y) / 2, impact);
            
            if (impact > 0.3) {
              const words = impact > 0.6 
                ? ['CRUNCH!', 'SMASH!', 'BRUTAL!']
                : ['HIT!', 'CLASH!', 'BAM!'];
              this.fx.popText((a.x + b.x) / 2, (a.y + b.y) / 2 - 20, 
                words[randInt(0, words.length - 1)], 
                0.8 + impact * 0.5,
                COLORS.violentPink);
            }
          }
        }
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
      
      // Draw emanation zones
      this.drawEmanations(ctx);
      
      // Draw arena ring (simplified center ring)
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
          const emanationLength = 60 + 40 * cross.strength;
          
          // Pulsing glow
          const pulse = 0.5 + 0.5 * Math.sin(time * 4 + cross.x * 10);
          
          ctx.save();
          ctx.globalAlpha = 0.3 + 0.2 * pulse;
          
          // Gradient emanation
          const grad = ctx.createLinearGradient(x, baseY, x, baseY + dir * emanationLength);
          const color = cross.bullish ? COLORS.bullGreen : COLORS.bearOrange;
          grad.addColorStop(0, color);
          grad.addColorStop(1, 'transparent');
          
          ctx.fillStyle = grad;
          
          // Draw spike shape
          ctx.beginPath();
          ctx.moveTo(x - 15, baseY);
          ctx.lineTo(x, baseY + dir * emanationLength);
          ctx.lineTo(x + 15, baseY);
          ctx.closePath();
          ctx.fill();
          
          // Bright tip
          ctx.globalAlpha = 0.6 + 0.3 * pulse;
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = 15;
          ctx.beginPath();
          ctx.arc(x, baseY + dir * emanationLength * 0.7, 4, 0, Math.PI * 2);
          ctx.fill();
          
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
      
      // Outer glow ring
      ctx.globalAlpha = 0.3 + 0.1 * Math.sin(time * 3);
      ctx.strokeStyle = ship.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = ship.color;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(0, 0, ship.radius * 1.3, 0, Math.PI * 2);
      ctx.stroke();
      
      // Hull integrity ring
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = ship.integrity > 0.5 ? COLORS.acidLime : ship.integrity > 0.25 ? COLORS.warnYellow : COLORS.hotMagenta;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, ship.radius * 1.1, -Math.PI/2, -Math.PI/2 + Math.PI * 2 * ship.integrity);
      ctx.stroke();
      
      // Spin ring
      ctx.save();
      ctx.rotate(ship.angle);
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = ship.color;
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, ship.radius * (0.6 + i * 0.1), i * 0.5, i * 0.5 + 1.2);
        ctx.stroke();
      }
      ctx.restore();
      
      // Core
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = ship.color;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(0, 0, ship.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
      
      // Sprite
      if (ship.spriteImg) {
        ctx.globalAlpha = 0.85;
        ctx.shadowBlur = 0;
        const scale = (ship.radius * 1.2) / Math.max(ship.spriteImg.width, ship.spriteImg.height);
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
      ctx.fillText(ship.ticker, ship.x, ship.y - ship.radius - 10);
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
