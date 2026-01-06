// =========================================================================
// BEY ARENA — Illegal Spin Pit in a Backwoods Space Bar
// 
// Hotline Miami aesthetic: aggressive, unstable, dangerous, gritty
// Containment field combat, not bouncy physics demo
// =========================================================================

(function() {
  'use strict';
  
  // --- Utilities ---
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
  const len = (v) => Math.hypot(v.x, v.y);
  const norm = (v) => { const l = len(v) || 1; return { x: v.x / l, y: v.y / l }; };
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const perp = (v) => ({ x: -v.y, y: v.x });
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
    rust: '#8b4513',
    neonBlue: '#4488ff'
  };
  
  // =========================================================================
  // FX SYSTEM — More aggressive, Hotline Miami style
  // =========================================================================
  function FXSystem() {
    this.particles = [];
    this.sparks = [];
    this.rings = [];
    this.pops = [];
    this.shake = { amp: 0, time: 0, trauma: 0 };
    this.trails = new Map();
    this.screenFlash = { color: null, alpha: 0 };
    this.chromatic = 0;
    this.slowmo = 1.0;
    this.burnMarks = [];
  }
  
  FXSystem.prototype.addShake = function(amp, trauma = 0) {
    this.shake.amp = Math.min(32, this.shake.amp + amp);
    this.shake.trauma = Math.min(1, this.shake.trauma + trauma);
    this.shake.time = 0.2;
  };
  
  FXSystem.prototype.flash = function(color, intensity = 0.6) {
    this.screenFlash.color = color;
    this.screenFlash.alpha = intensity;
  };
  
  FXSystem.prototype.addChromatic = function(intensity = 0.3) {
    this.chromatic = Math.min(1, this.chromatic + intensity);
  };
  
  FXSystem.prototype.hitPause = function(duration = 0.05) {
    this.slowmo = 0.1;
    setTimeout(() => { this.slowmo = 1.0; }, duration * 1000);
  };
  
  FXSystem.prototype.pushTrail = function(id, x, y, color) {
    let arr = this.trails.get(id);
    if (!arr) { arr = []; this.trails.set(id, arr); }
    arr.push({ x, y, life: 0.35, color });
    if (arr.length > 28) arr.shift();
  };
  
  FXSystem.prototype.edgeScrape = function(x, y, normal, intensity) {
    const count = Math.floor(5 + intensity * 20);
    const tangent = perp(normal);
    
    for (let i = 0; i < count; i++) {
      const spread = rand(-0.6, 0.6);
      const dir = { 
        x: tangent.x * spread + normal.x * rand(-0.3, 0.1),
        y: tangent.y * spread + normal.y * rand(-0.3, 0.1)
      };
      const spd = rand(200, 600) * (0.5 + intensity);
      
      this.sparks.push({
        x, y,
        vx: dir.x * spd,
        vy: dir.y * spd,
        life: rand(0.15, 0.4),
        drag: rand(3, 8),
        size: rand(1.5, 4),
        color: Math.random() < 0.7 ? COLORS.burntOrange : COLORS.acidLime
      });
    }
    
    if (Math.random() < 0.3) {
      this.burnMarks.push({ x, y, alpha: 0.8, size: rand(8, 20) });
      if (this.burnMarks.length > 30) this.burnMarks.shift();
    }
    
    this.addShake(3 + intensity * 6, intensity * 0.15);
  };
  
  FXSystem.prototype.impact = function(x, y, impact01) {
    const s = clamp01(impact01);
    const count = Math.floor(12 + s * 40);
    
    this.rings.push({ 
      x, y, r: 8, grow: 600 + 800 * s, life: 0.15 + 0.12 * s, 
      color: s > 0.6 ? COLORS.violentPink : COLORS.burntOrange,
      alpha: 0.9
    });
    
    this.rings.push({
      x, y, r: 4, grow: 400, life: 0.08,
      color: '#ffffff',
      alpha: 1
    });
    
    for (let i = 0; i < count; i++) {
      const ang = rand(0, Math.PI * 2);
      const spd = rand(180, 800) * (0.5 + s);
      this.sparks.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: rand(0.12, 0.35),
        drag: rand(5, 12),
        size: rand(1.5, 4),
        color: Math.random() < 0.5 ? COLORS.violentPink : 
               Math.random() < 0.5 ? COLORS.burntOrange : '#ffffff'
      });
    }
    
    if (Math.random() < (0.35 + 0.4 * s)) {
      const words = s > 0.6 
        ? ["CRUNCH!!", "DESTROY!!", "WRECK!!", "BRUTAL!!", "SAVAGE!!"]
        : ["CLANG!", "KRAK!", "BAM!", "HIT!", "SMASH!"];
      this.popText(x + rand(-20, 20), y - 30, 
        words[randInt(0, words.length - 1)], 
        1.2 + 0.6 * s, true);
    }
    
    this.addShake(5 + 14 * s, s * 0.2);
    this.flash(COLORS.violentPink, 0.15 + s * 0.25);
    this.addChromatic(s * 0.4);
    
    if (s > 0.5) this.hitPause(0.03 + s * 0.04);
  };
  
  FXSystem.prototype.burst = function(x, y, ticker) {
    this.flash('#ffffff', 0.7);
    this.addChromatic(0.8);
    this.hitPause(0.12);
    
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        this.rings.push({ 
          x, y, r: 15 + i * 20, grow: 1400 - i * 200, life: 0.25, 
          color: i === 0 ? '#ffffff' : COLORS.hotMagenta,
          alpha: 1 - i * 0.2
        });
      }, i * 30);
    }
    
    for (let i = 0; i < 150; i++) {
      const ang = rand(0, Math.PI * 2);
      const spd = rand(300, 1200);
      this.sparks.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: rand(0.2, 0.6),
        drag: rand(4, 10),
        size: rand(2, 6),
        color: Math.random() < 0.4 ? '#ffffff' :
               Math.random() < 0.5 ? COLORS.hotMagenta : COLORS.burntOrange
      });
    }
    
    this.addShake(24, 0.8);
    this.banner("BURST FINISH!!", COLORS.warnYellow);
    this.popText(x, y - 60, ticker, 2.5, false);
    
    if (window.MechSFX) {
      window.MechSFX.alert(900, 220, 0.32);
      window.MechSFX.bassHit(54, 0.18);
    }
  };
  
  FXSystem.prototype.ringOut = function(x, y, ticker) {
    this.flash(COLORS.hotMagenta, 0.5);
    this.addChromatic(0.6);
    
    this.rings.push({ 
      x, y, r: 20, grow: 1600, life: 0.22,
      color: COLORS.hotMagenta,
      alpha: 0.9
    });
    
    this.addShake(18, 0.5);
    this.banner("RING OUT!!", COLORS.hotMagenta);
    this.popText(x, y + 20, "EJECT!!", 1.8, true);
    
    if (window.MechSFX) window.MechSFX.alert(760, 240, 0.28);
  };
  
  FXSystem.prototype.spinOut = function(x, y, ticker) {
    this.flash(COLORS.burntOrange, 0.3);
    this.addShake(12, 0.3);
    this.banner("OUT OF SPIN!!", COLORS.burntOrange);
    this.popText(x, y - 40, "DEAD", 2.0, false);
    
    if (window.MechSFX) window.MechSFX.synthStab(220, 0.12);
  };
  
  FXSystem.prototype.popText = function(x, y, text, scale, jitter) {
    this.pops.push({ 
      x, y, text, life: 0.7, float: 80, scale: scale || 1.2, 
      banner: false, jitter: !!jitter,
      color: '#ffffff'
    });
  };
  
  FXSystem.prototype.banner = function(text, color = COLORS.warnYellow) {
    this.pops.push({ 
      x: 0, y: 0, text, life: 1.2, float: 0, scale: 2.2, 
      banner: true, jitter: false, color
    });
  };
  
  FXSystem.prototype.update = function(dt) {
    const adt = dt * this.slowmo;
    
    for (const p of this.sparks) {
      p.vx *= Math.exp(-p.drag * adt);
      p.vy *= Math.exp(-p.drag * adt);
      p.x += p.vx * adt;
      p.y += p.vy * adt;
      p.life -= adt;
    }
    this.sparks = this.sparks.filter(p => p.life > 0);
    
    for (const r of this.rings) {
      r.r += r.grow * adt;
      r.life -= adt;
    }
    this.rings = this.rings.filter(r => r.life > 0);
    
    for (const t of this.pops) {
      t.y -= t.float * adt;
      t.life -= adt;
    }
    this.pops = this.pops.filter(t => t.life > 0);
    
    if (this.shake.time > 0) {
      this.shake.time -= dt;
      this.shake.amp *= Math.exp(-20 * dt);
      this.shake.trauma *= Math.exp(-3 * dt);
    } else {
      this.shake.amp = 0;
      this.shake.trauma *= Math.exp(-5 * dt);
    }
    
    this.screenFlash.alpha *= Math.exp(-12 * dt);
    if (this.screenFlash.alpha < 0.01) this.screenFlash.alpha = 0;
    
    this.chromatic *= Math.exp(-6 * dt);
    
    for (const [id, arr] of this.trails.entries()) {
      for (const pt of arr) pt.life -= adt;
      const kept = arr.filter(pt => pt.life > 0);
      if (kept.length) this.trails.set(id, kept);
      else this.trails.delete(id);
    }
    
    for (const b of this.burnMarks) {
      b.alpha *= 0.998;
    }
    this.burnMarks = this.burnMarks.filter(b => b.alpha > 0.05);
  };
  
  FXSystem.prototype.getShakeOffset = function() {
    if (this.shake.amp <= 0.5) return { x: 0, y: 0, rot: 0 };
    const trauma = this.shake.trauma;
    const amp = this.shake.amp * (1 + trauma * 2);
    return {
      x: (Math.random() - 0.5) * amp * 2,
      y: (Math.random() - 0.5) * amp * 2,
      rot: (Math.random() - 0.5) * trauma * 0.05
    };
  };
  
  FXSystem.prototype.drawTrails = function(ctx) {
    for (const arr of this.trails.values()) {
      ctx.save();
      for (let i = 0; i < arr.length; i++) {
        const pt = arr[i];
        const a = clamp01(pt.life / 0.35) * (i / arr.length);
        ctx.globalAlpha = a * 0.5;
        ctx.fillStyle = pt.color || COLORS.violentPink;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 6 * a + 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  };
  
  FXSystem.prototype.drawBurnMarks = function(ctx) {
    for (const b of this.burnMarks) {
      ctx.save();
      ctx.globalAlpha = b.alpha * 0.6;
      ctx.fillStyle = COLORS.bloodShadow;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };
  
  FXSystem.prototype.draw = function(ctx, center) {
    for (const r of this.rings) {
      const a = clamp01(r.life * 8) * r.alpha;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 4 * a;
      ctx.shadowColor = r.color;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    
    for (const p of this.sparks) {
      const a = clamp01(p.life * 4);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    
    for (const t of this.pops) {
      const a = clamp01(t.life * 2);
      ctx.save();
      ctx.globalAlpha = a;
      
      const s = Math.floor(20 * t.scale);
      ctx.font = `bold ${s}px "VT323", Orbitron, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      let tx = t.banner ? center.x : t.x;
      let ty = t.banner ? center.y - 80 : t.y;
      
      if (t.jitter) {
        tx += (Math.random() - 0.5) * 6;
        ty += (Math.random() - 0.5) * 6;
      }
      
      ctx.fillStyle = COLORS.deepBlack;
      ctx.fillText(t.text, tx + 3, ty + 3);
      ctx.fillText(t.text, tx + 2, ty + 2);
      
      ctx.shadowColor = t.color;
      ctx.shadowBlur = t.banner ? 20 : 12;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, tx, ty);
      
      ctx.restore();
    }
    
    if (this.screenFlash.alpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = this.screenFlash.alpha;
      ctx.fillStyle = this.screenFlash.color || '#ffffff';
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
    }
  };
  
  // =========================================================================
  // SPINNER CREATION
  // =========================================================================
  function spinnerFromTicker(ticker, idx) {
    const t = (window.ShipTelemetry && window.ShipTelemetry.getTelemetry)
      ? window.ShipTelemetry.getTelemetry(ticker)
      : (window.ShipTelemetry && window.ShipTelemetry._TELEMETRY && window.ShipTelemetry._TELEMETRY[ticker])
        ? window.ShipTelemetry._TELEMETRY[ticker]
        : null;
    
    const tele = Object.assign({
      thrustPotential: 0.5,
      maneuverStability: 0.5,
      hullResilience: 0.5,
      chopSensitivity: 0.5,
      signalClarity: 0.5,
      volumeReliability: 0.6,
      regimeBias: 'range'
    }, t || {});
    
    const vr = tele.volumeReliability ?? 0.6;
    const mass = 0.8 + 1.4 * (0.75 * tele.hullResilience + 0.25 * vr);
    const radius = 20 + 10 * (0.6 * tele.hullResilience + 0.4 * (1 - tele.maneuverStability));
    const omega0 = 12 + 40 * tele.thrustPotential;
    const vmax = 140 + 280 * (0.55 * tele.thrustPotential + 0.45 * (1 - tele.chopSensitivity));
    
    const stability = clamp01(
      0.55 * tele.maneuverStability +
      0.25 * tele.signalClarity +
      0.20 * vr -
      0.35 * tele.chopSensitivity
    );
    
    let shipColor = COLORS.violentPink;
    if (window.ShipRegistry && window.ShipRegistry.isReady()) {
      const ship = window.ShipRegistry.get(ticker);
      if (ship) shipColor = ship.color;
    }
    
    const spritePath = (window.SHIP_SPRITES && window.SHIP_SPRITES[ticker]) || null;
    
    return {
      id: `${ticker}_${idx}`,
      ticker,
      telemetry: tele,
      mass,
      radius,
      vmax,
      omega0,
      stability,
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      omega: omega0,
      integrity: 1.0,
      coherence: 1.0,
      angle: Math.random() * Math.PI * 2,
      alive: true,
      edgeTime: 0,
      spritePath,
      spriteImg: null,
      color: shipColor
    };
  }
  
  // =========================================================================
  // COLLISION RESOLUTION
  // =========================================================================
  function resolveCollision(a, b) {
    if (!a.alive || !b.alive) return null;
    
    const dx = a.position.x - b.position.x;
    const dy = a.position.y - b.position.y;
    const dist = Math.hypot(dx, dy);
    const minDist = a.radius + b.radius;
    if (dist >= minDist || dist === 0) return null;
    
    const n = { x: dx / dist, y: dy / dist };
    const rv = { x: a.velocity.x - b.velocity.x, y: a.velocity.y - b.velocity.y };
    const vn = dot(rv, n);
    
    const penetration = minDist - dist;
    const totalInvMass = 1 / a.mass + 1 / b.mass;
    a.position.x += n.x * penetration * (1 / a.mass) / totalInvMass;
    a.position.y += n.y * penetration * (1 / a.mass) / totalInvMass;
    b.position.x -= n.x * penetration * (1 / b.mass) / totalInvMass;
    b.position.y -= n.y * penetration * (1 / b.mass) / totalInvMass;
    
    if (vn > 0) return null;
    
    const Sa = a.stability, Sb = b.stability;
    const e = 0.2 + 0.5 * clamp01((Sa + Sb) * 0.5);
    
    const j = -(1 + e) * vn / totalInvMass;
    
    a.velocity.x += (j * n.x) / a.mass;
    a.velocity.y += (j * n.y) / a.mass;
    b.velocity.x -= (j * n.x) / b.mass;
    b.velocity.y -= (j * n.y) / b.mass;
    
    const t = perp(n);
    const vt = dot(rv, t);
    const mu = 0.03 + 0.15 * (0.5 * (1 - Sa) + 0.5 * (1 - Sb));
    const jt = clamp(-vt / totalInvMass, -mu * Math.abs(j), mu * Math.abs(j));
    
    a.velocity.x += (jt * t.x) / a.mass;
    a.velocity.y += (jt * t.y) / a.mass;
    b.velocity.x -= (jt * t.x) / b.mass;
    b.velocity.y -= (jt * t.y) / b.mass;
    
    const impact01 = clamp01(Math.abs(j) / 2.5);
    
    const damageA = impact01 * (0.08 + 0.12 * (1 - a.telemetry.hullResilience));
    const damageB = impact01 * (0.08 + 0.12 * (1 - b.telemetry.hullResilience));
    
    a.integrity = Math.max(0, a.integrity - damageA);
    b.integrity = Math.max(0, b.integrity - damageB);
    
    const spinLoss = (s) => impact01 * (1 + 2 * (1 - s.telemetry.hullResilience));
    a.omega = Math.max(0, a.omega - spinLoss(a));
    b.omega = Math.max(0, b.omega - spinLoss(b));
    
    return {
      x: (a.position.x + b.position.x) * 0.5,
      y: (a.position.y + b.position.y) * 0.5,
      impact01,
      burstA: a.integrity <= 0,
      burstB: b.integrity <= 0
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
    
    center: { x: 0, y: 0 },
    arenaRadius: 220,
    
    fx: new FXSystem(),
    spinners: [],
    
    ringInstability: 0,
    fightTime: 0,
    ringSegments: [],
    crowd: [],
    envFlicker: 0,
    neonPhase: 0,
    
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
        if (this.spinners.length >= 2) {
          const a = this.spinners[0].ticker;
          const b = this.spinners[1].ticker;
          this.start(b, a);
        }
      };
      
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.overlay?.classList.contains('active')) {
          this.close();
        }
      });
      
      this.resizeCanvas();
      window.addEventListener('resize', () => this.resizeCanvas());
      
      this.generateRingSegments();
      this.generateCrowd();
    },
    
    resizeCanvas() {
      const cssW = this.canvas.clientWidth || 520;
      const cssH = this.canvas.clientHeight || 520;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.canvas.width = Math.floor(cssW * dpr);
      this.canvas.height = Math.floor(cssH * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      
      this.center = { x: cssW / 2, y: cssH / 2 };
      this.arenaRadius = Math.min(cssW, cssH) * 0.40;
    },
    
    generateRingSegments() {
      this.ringSegments = [];
      const numSegments = randInt(8, 14);
      let angle = rand(0, 0.5);
      
      for (let i = 0; i < numSegments; i++) {
        const arcLen = rand(0.3, 0.8);
        const gap = rand(0.05, 0.2);
        const broken = Math.random() < 0.2;
        const flickerRate = rand(2, 8);
        
        this.ringSegments.push({
          startAngle: angle,
          arcLength: arcLen,
          broken,
          flickerRate,
          flickerPhase: rand(0, Math.PI * 2),
          drift: rand(-0.02, 0.02),
          radiusOffset: rand(-5, 5)
        });
        
        angle += arcLen + gap;
      }
    },
    
    generateCrowd() {
      this.crowd = [];
      const positions = [
        { x: 0.08, y: 0.3, scale: 0.8 },
        { x: 0.12, y: 0.5, scale: 1.0 },
        { x: 0.05, y: 0.7, scale: 0.7 },
        { x: 0.92, y: 0.35, scale: 0.9 },
        { x: 0.88, y: 0.55, scale: 1.1 },
        { x: 0.95, y: 0.75, scale: 0.75 },
        { x: 0.3, y: 0.92, scale: 0.6 },
        { x: 0.7, y: 0.95, scale: 0.65 },
      ];
      
      for (const p of positions) {
        this.crowd.push({
          x: p.x,
          y: p.y,
          scale: p.scale,
          bobPhase: rand(0, Math.PI * 2),
          bobSpeed: rand(1.5, 3),
          type: randInt(0, 2)
        });
      }
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
    
    rematch() {
      if (this.spinners.length >= 2) {
        this.start(this.spinners[0].ticker, this.spinners[1].ticker);
      }
    },
    
    start(tickerA, tickerB) {
      this.fx = new FXSystem();
      this.ringInstability = 0;
      this.fightTime = 0;
      this.generateRingSegments();
      
      const sA = spinnerFromTicker(tickerA, 0);
      const sB = spinnerFromTicker(tickerB, 1);
      
      const offset = this.arenaRadius * 0.55;
      sA.position = { x: this.center.x - offset, y: this.center.y };
      sB.position = { x: this.center.x + offset, y: this.center.y };
      
      sA.velocity = { x: rand(60, 120), y: rand(-40, 40) };
      sB.velocity = { x: rand(-120, -60), y: rand(-40, 40) };
      
      this.spinners = [sA, sB];
      
      for (const s of this.spinners) {
        if (s.spritePath) {
          const img = new Image();
          img.src = s.spritePath;
          img.onload = () => { s.spriteImg = img; };
        }
      }
      
      this.setBanner(`${tickerA} vs ${tickerB}`);
      this.active = true;
      this.lastTime = performance.now();
      this.raf = requestAnimationFrame((t) => this.loop(t));
      
      this.updateSidePanels();
    },
    
    setBanner(text) {
      const el = document.getElementById('bey-arena-banner');
      if (el) el.textContent = text;
    },
    
    updateSidePanels() {
      const left = document.getElementById('bey-pilot-left');
      const right = document.getElementById('bey-pilot-right');
      if (!left || !right || this.spinners.length < 2) return;
      
      const fmt = (s) => {
        const regime = s.telemetry.regimeBias?.toUpperCase() || 'RANGE';
        const thrust = Math.round(s.telemetry.thrustPotential * 100);
        const chop = Math.round(s.telemetry.chopSensitivity * 100);
        const hull = Math.round(s.integrity * 100);
        const stab = Math.round(s.stability * 100);
        const signal = Math.round(s.telemetry.signalClarity * 100);
        
        return `${s.ticker}\nREGIME: ${regime}\nTHRUST: ${thrust}  |  CHOP: ${chop}\nHULL: ${hull}     |  STAB: ${stab}\nSIGNAL: ${signal}`;
      };
      
      left.textContent = fmt(this.spinners[0]);
      right.textContent = fmt(this.spinners[1]);
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
      const adt = dt * this.fx.slowmo;
      
      this.fightTime += adt;
      this.neonPhase += dt * 3;
      
      this.ringInstability = Math.min(1, this.fightTime / 30);
      
      this.envFlicker = Math.random() < 0.02 ? rand(0.3, 0.8) : this.envFlicker * 0.95;
      
      for (const seg of this.ringSegments) {
        seg.startAngle += seg.drift * adt * (1 + this.ringInstability * 2);
        seg.flickerPhase += seg.flickerRate * adt;
      }
      
      for (const s of this.spinners) {
        if (!s.alive) continue;
        
        this.fx.pushTrail(s.id, s.position.x, s.position.y, s.color);
        
        const toCenter = norm({ 
          x: this.center.x - s.position.x, 
          y: this.center.y - s.position.y 
        });
        const tangent = { x: -toCenter.y, y: toCenter.x };
        
        let driveDir = tangent;
        if (s.telemetry.regimeBias === 'range') {
          driveDir = norm({ 
            x: tangent.x + toCenter.x * 0.2, 
            y: tangent.y + toCenter.y * 0.2 
          });
        } else if (s.telemetry.regimeBias === 'chaotic') {
          driveDir = norm({
            x: tangent.x * 0.6 + toCenter.x * -0.3 + (Math.random() - 0.5) * 1.2,
            y: tangent.y * 0.6 + toCenter.y * -0.3 + (Math.random() - 0.5) * 1.2
          });
        }
        
        const accel = 160 + 400 * s.telemetry.thrustPotential;
        s.velocity.x += driveDir.x * accel * adt;
        s.velocity.y += driveDir.y * accel * adt;
        
        const kv = 0.4 + 0.9 * (s.telemetry.chopSensitivity ** 2);
        s.velocity.x *= Math.exp(-kv * adt);
        s.velocity.y *= Math.exp(-kv * adt);
        
        const spd = len(s.velocity);
        if (spd > s.vmax) {
          const f = s.vmax / spd;
          s.velocity.x *= f;
          s.velocity.y *= f;
        }
        
        const kw = 0.08 + 0.4 * (0.6 * s.telemetry.chopSensitivity + 0.4 * (1 - s.telemetry.maneuverStability));
        s.omega *= Math.exp(-kw * adt);
        
        s.position.x += s.velocity.x * adt;
        s.position.y += s.velocity.y * adt;
        
        // === CONTAINMENT FIELD ===
        const dx = s.position.x - this.center.x;
        const dy = s.position.y - this.center.y;
        const dist = Math.hypot(dx, dy);
        const edgeThreshold = this.arenaRadius * 0.82;
        const hardEdge = this.arenaRadius - s.radius;
        
        if (dist > edgeThreshold) {
          const n = norm({ x: dx, y: dy });
          const edgeDepth = (dist - edgeThreshold) / (hardEdge - edgeThreshold);
          
          const pushForce = 800 * edgeDepth * (1 + this.ringInstability * 0.5);
          s.velocity.x -= n.x * pushForce * adt;
          s.velocity.y -= n.y * pushForce * adt;
          
          s.omega += rand(-3, 3) * edgeDepth;
          
          s.edgeTime += adt;
          const scrapeDamage = 0.04 * edgeDepth * adt * (1 + this.ringInstability);
          s.integrity = Math.max(0, s.integrity - scrapeDamage);
          
          if (Math.random() < 0.3 * edgeDepth) {
            this.fx.edgeScrape(s.position.x, s.position.y, n, edgeDepth);
          }
        } else {
          s.edgeTime = 0;
        }
        
        if (dist > this.arenaRadius + s.radius * 0.5) {
          s.alive = false;
          this.fx.ringOut(s.position.x, s.position.y, s.ticker);
          this.setBanner(`${s.ticker} RING OUT!!`);
        }
        
        if (s.integrity <= 0 && s.alive) {
          s.alive = false;
          this.fx.burst(s.position.x, s.position.y, s.ticker);
          this.setBanner(`${s.ticker} DESTROYED!!`);
        }
        
        if (s.omega < 1.5 && s.alive) {
          s.alive = false;
          this.fx.spinOut(s.position.x, s.position.y, s.ticker);
          this.setBanner(`${s.ticker} OUT OF SPIN!!`);
        }
      }
      
      // Collisions
      for (let i = 0; i < this.spinners.length; i++) {
        for (let j = i + 1; j < this.spinners.length; j++) {
          const evt = resolveCollision(this.spinners[i], this.spinners[j]);
          if (!evt) continue;
          
          this.fx.impact(evt.x, evt.y, evt.impact01);
          
          if (evt.burstA && this.spinners[i].alive) {
            this.spinners[i].alive = false;
            this.fx.burst(this.spinners[i].position.x, this.spinners[i].position.y, this.spinners[i].ticker);
            this.setBanner(`${this.spinners[i].ticker} DESTROYED!!`);
          }
          if (evt.burstB && this.spinners[j].alive) {
            this.spinners[j].alive = false;
            this.fx.burst(this.spinners[j].position.x, this.spinners[j].position.y, this.spinners[j].ticker);
            this.setBanner(`${this.spinners[j].ticker} DESTROYED!!`);
          }
        }
      }
      
      this.fx.update(dt);
      
      const alive = this.spinners.filter(s => s.alive);
      if (alive.length <= 1) {
        const winner = alive[0] ? alive[0].ticker : 'NO ONE';
        this.setBanner(`WINNER: ${winner}`);
        this.active = false;
      }
      
      this.updateSidePanels();
    },
    
    render() {
      const ctx = this.ctx;
      const w = this.canvas.clientWidth || 520;
      const h = this.canvas.clientHeight || 520;
      
      ctx.clearRect(0, 0, w, h);
      
      ctx.save();
      const shake = this.fx.getShakeOffset();
      ctx.translate(shake.x, shake.y);
      if (shake.rot) ctx.rotate(shake.rot);
      
      this.drawEnvironment(ctx, w, h);
      this.drawCrowd(ctx, w, h);
      
      this.fx.drawBurnMarks(ctx);
      
      this.drawArenaRing(ctx);
      
      this.fx.drawTrails(ctx);
      
      for (const s of this.spinners) {
        if (!s.alive) continue;
        this.drawSpinner(ctx, s);
      }
      
      this.fx.draw(ctx, this.center);
      
      this.drawVignette(ctx, w, h);
      this.drawScanlines(ctx, w, h);
      
      ctx.restore();
    },
    
    drawEnvironment(ctx, w, h) {
      const grad = ctx.createRadialGradient(
        w * 0.5, h * 0.4, 0,
        w * 0.5, h * 0.5, w * 0.7
      );
      grad.addColorStop(0, '#1a0a1a');
      grad.addColorStop(0.5, '#0f0812');
      grad.addColorStop(1, COLORS.deepBlack);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      
      ctx.save();
      ctx.globalAlpha = 0.15 + 0.1 * Math.sin(this.neonPhase);
      const neonGrad = ctx.createRadialGradient(w * 0.1, h * 0.3, 0, w * 0.1, h * 0.3, w * 0.4);
      neonGrad.addColorStop(0, COLORS.violentPink);
      neonGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = neonGrad;
      ctx.fillRect(0, 0, w, h);
      
      const neonGrad2 = ctx.createRadialGradient(w * 0.9, h * 0.6, 0, w * 0.9, h * 0.6, w * 0.35);
      neonGrad2.addColorStop(0, COLORS.toxicCyan);
      neonGrad2.addColorStop(1, 'transparent');
      ctx.fillStyle = neonGrad2;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.strokeStyle = COLORS.violentPink;
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, h * 0.5);
        ctx.lineTo(x + (x - w/2) * 0.3, h);
        ctx.stroke();
      }
      for (let y = h * 0.5; y < h; y += gridSize * 0.8) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.restore();
    },
    
    drawCrowd(ctx, w, h) {
      ctx.save();
      const time = performance.now() * 0.001;
      
      for (const c of this.crowd) {
        const bob = Math.sin(time * c.bobSpeed + c.bobPhase) * 3;
        const x = c.x * w;
        const y = c.y * h + bob;
        const scale = c.scale * 25;
        
        ctx.globalAlpha = 0.3 + this.envFlicker * 0.2;
        ctx.fillStyle = '#0a0008';
        
        ctx.beginPath();
        ctx.ellipse(x, y - scale * 0.8, scale * 0.35, scale * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x, y, scale * 0.6, scale * 0.35, 0, 0, Math.PI);
        ctx.fill();
      }
      ctx.restore();
    },
    
    drawArenaRing(ctx) {
      ctx.save();
      
      const instab = this.ringInstability;
      const time = performance.now() * 0.001;
      
      for (const seg of this.ringSegments) {
        if (seg.broken && Math.random() < 0.3 * instab) continue;
        
        const flicker = seg.broken 
          ? 0.3 + 0.7 * Math.abs(Math.sin(seg.flickerPhase))
          : 0.7 + 0.3 * Math.sin(seg.flickerPhase * 0.5);
        
        const r = this.arenaRadius + seg.radiusOffset + Math.sin(time * 2 + seg.startAngle) * 3 * instab;
        
        ctx.globalAlpha = flicker * (0.5 + 0.5 * (1 - instab));
        
        ctx.strokeStyle = seg.broken ? COLORS.burntOrange : COLORS.hotMagenta;
        ctx.lineWidth = seg.broken ? 2 : 4;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 15 + 10 * instab;
        
        ctx.beginPath();
        ctx.arc(
          this.center.x, this.center.y, r,
          seg.startAngle, seg.startAngle + seg.arcLength
        );
        ctx.stroke();
        
        if (!seg.broken) {
          ctx.globalAlpha = flicker * 0.4;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(
            this.center.x, this.center.y, r - 3,
            seg.startAngle + 0.1, seg.startAngle + seg.arcLength - 0.1
          );
          ctx.stroke();
        }
      }
      
      if (Math.random() < 0.02 * (1 + instab * 3)) {
        const ang = rand(0, Math.PI * 2);
        const sparkLen = rand(0.1, 0.3);
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 25;
        ctx.shadowColor = COLORS.acidLime;
        ctx.beginPath();
        ctx.arc(this.center.x, this.center.y, this.arenaRadius, ang, ang + sparkLen);
        ctx.stroke();
      }
      
      ctx.restore();
    },
    
    drawSpinner(ctx, s) {
      const time = performance.now() * 0.001;
      const wobble = (1 - s.stability) * (1 - Math.min(1, s.omega / s.omega0));
      const wob = wobble * Math.sin(time * (8 + 15 * (1 - s.stability))) * 0.15;
      
      s.angle += s.omega * 0.016;
      
      ctx.save();
      ctx.translate(s.position.x, s.position.y);
      ctx.rotate(s.angle + wob);
      
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = 'rgba(10,0,15,0.8)';
      ctx.beginPath();
      ctx.arc(0, 0, s.radius, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = s.color;
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 12;
      ctx.lineWidth = 3;
      
      for (let k = 0; k < 3; k++) {
        const a0 = time * (3 + k) + k * 2.1;
        ctx.globalAlpha = 0.8 - k * 0.15;
        ctx.beginPath();
        ctx.arc(0, 0, s.radius * (0.72 + 0.1 * k), a0, a0 + 1.4);
        ctx.stroke();
      }
      
      const coreR = s.radius * 0.45;
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = s.color;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(0, 0, coreR, 0, Math.PI * 2);
      ctx.fill();
      
      if (s.spriteImg) {
        ctx.globalAlpha = 0.85;
        ctx.shadowBlur = 0;
        const img = s.spriteImg;
        const scale = (coreR * 1.5) / Math.max(img.width, img.height);
        ctx.save();
        ctx.rotate(-s.angle * 0.8);
        ctx.scale(scale, scale);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        ctx.restore();
      }
      
      ctx.rotate(-s.angle);
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = s.integrity > 0.3 ? COLORS.acidLime : COLORS.hotMagenta;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 8;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, s.radius * 1.05, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * s.integrity);
      ctx.stroke();
      
      if (s.integrity < 0.3) {
        ctx.globalAlpha = 0.4 * Math.abs(Math.sin(time * 8));
        ctx.fillStyle = COLORS.hotMagenta;
        ctx.beginPath();
        ctx.arc(0, 0, s.radius * 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.restore();
    },
    
    drawVignette(ctx, w, h) {
      ctx.save();
      const g = ctx.createRadialGradient(
        w / 2, h / 2, Math.min(w, h) * 0.2,
        w / 2, h / 2, Math.min(w, h) * 0.65
      );
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.7, 'rgba(0,0,0,0.3)');
      g.addColorStop(1, 'rgba(0,0,0,0.7)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    },
    
    drawScanlines(ctx, w, h) {
      ctx.save();
      ctx.globalAlpha = 0.12 + this.envFlicker * 0.1;
      ctx.fillStyle = '#000000';
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
    return pool[randInt(0, pool.length - 1)] || 'ACHR';
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
