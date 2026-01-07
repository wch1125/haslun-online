// =========================================================================
// BEY ARENA — Retro Anime Arcade Spinner Battle
// Telemetry-driven "Beyblade" physics with over-the-top stylized FX.
// No external libs. Canvas-based.
// =========================================================================

(function() {
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const len = (v) => Math.hypot(v.x, v.y);
  const norm = (v) => {
    const l = len(v) || 1;
    return { x: v.x / l, y: v.y / l };
  };
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const perp = (v) => ({ x: -v.y, y: v.x });
  const easeOut = (x) => 1 - (1 - x) * (1 - x);

  // ------------------------------
  // FX SYSTEM (particles, rings, text, screen shake, trails, "anime smear")
  // ------------------------------
  function FXSystem() {
    this.particles = [];
    this.rings = [];
    this.pops = [];
    this.shake = { amp: 0, time: 0 };
    this.trails = new Map();
    this.starBursts = [];
  }

  FXSystem.prototype._rand = function(min, max) {
    return min + Math.random() * (max - min);
  };

  FXSystem.prototype.addShake = function(amp) {
    this.shake.amp = Math.min(24, this.shake.amp + amp);
    this.shake.time = 0.13;
  };

  FXSystem.prototype.pushTrail = function(id, x, y) {
    let arr = this.trails.get(id);
    if (!arr) { arr = []; this.trails.set(id, arr); }
    arr.push({ x, y, life: 0.22 });
    if (arr.length > 22) arr.shift();
  };

  FXSystem.prototype.impact = function(x, y, impact01) {
    const s = clamp01(impact01);
    const sparks = Math.floor(10 + s * 34);

    this.rings.push({ x, y, r: 6, grow: 460 + 640 * s, life: 0.12 + 0.10 * s, a: 1 });

    for (let i = 0; i < sparks; i++) {
      const ang = this._rand(0, Math.PI * 2);
      const spd = this._rand(140, 720) * (0.55 + 0.95 * s);
      this.particles.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: this._rand(0.10, 0.30),
        drag: this._rand(6, 15),
        size: this._rand(1.1, 3.2),
        hue: this._rand(34, 70)
      });
    }

    // comedic, occasional callout
    if (Math.random() < (0.22 + 0.34 * s)) {
      const words = ["CLANG!", "DON!!", "BAM!", "KRAK!", "BONK!", "PAH!!", "GAAH!"];
      this.popText(x, y - 14, words[(Math.random() * words.length) | 0], 1.0 + 0.4 * s, true);
    }

    // starburst flare
    this.starBursts.push({ x, y, life: 0.12 + 0.08 * s, s: 0.5 + 0.8 * s });

    this.addShake(4 + 11 * s);
  };

  FXSystem.prototype.burst = function(x, y) {
    this.rings.push({ x, y, r: 10, grow: 1200, life: 0.24, a: 1 });
    for (let i = 0; i < 110; i++) {
      const ang = this._rand(0, Math.PI * 2);
      const spd = this._rand(260, 980);
      this.particles.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: this._rand(0.18, 0.48),
        drag: this._rand(5, 12),
        size: this._rand(1.2, 4.6),
        hue: this._rand(0, 62)
      });
    }
    this.addShake(18);
    this.banner("BURST FINISH!!", x, y - 60);
    if (window.MechSFX) { window.MechSFX.alert(900, 220, 0.32); window.MechSFX.bassHit(54, 0.18); }
  };

  FXSystem.prototype.ringOut = function(x, y) {
    this.rings.push({ x, y, r: 14, grow: 1400, life: 0.20, a: 1 });
    this.addShake(14);
    this.banner("RING OUT!!", x, y - 60);
    this.popText(x, y + 14, "BYE~", 1.4, false);
    if (window.MechSFX) window.MechSFX.alert(760, 240, 0.28);
  };

  FXSystem.prototype.spinOut = function(x, y) {
    this.addShake(9);
    this.banner("OUT OF SPIN!!", x, y - 60);
    if (window.MechSFX) window.MechSFX.synthStab(220, 0.12);
  };

  FXSystem.prototype.popText = function(x, y, text, scale, jitter) {
    this.pops.push({ x, y, text, life: 0.55, float: 70, scale: scale || 1.2, banner: false, jitter: !!jitter });
  };

  FXSystem.prototype.banner = function(text, x, y) {
    this.pops.push({ x, y, text, life: 0.95, float: 0, scale: 2.0, banner: true, jitter: false });
  };

  FXSystem.prototype.update = function(dt) {
    for (const p of this.particles) {
      p.vx *= Math.exp(-p.drag * dt);
      p.vy *= Math.exp(-p.drag * dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);

    for (const r of this.rings) {
      r.r += r.grow * dt;
      r.life -= dt;
    }
    this.rings = this.rings.filter(r => r.life > 0);

    for (const t of this.pops) {
      t.y -= t.float * dt;
      t.life -= dt;
    }
    this.pops = this.pops.filter(t => t.life > 0);

    for (const sb of this.starBursts) sb.life -= dt;
    this.starBursts = this.starBursts.filter(sb => sb.life > 0);

    if (this.shake.time > 0) {
      this.shake.time -= dt;
      this.shake.amp *= Math.exp(-16 * dt);
    } else {
      this.shake.amp = 0;
    }

    for (const [id, arr] of this.trails.entries()) {
      for (const pt of arr) pt.life -= dt;
      const kept = arr.filter(pt => pt.life > 0);
      if (kept.length) this.trails.set(id, kept);
      else this.trails.delete(id);
    }
  };

  FXSystem.prototype.beginShake = function(ctx) {
    if (this.shake.amp <= 0) return;
    const a = this.shake.amp;
    ctx.translate((Math.random() - 0.5) * a, (Math.random() - 0.5) * a);
  };

  FXSystem.prototype.drawTrails = function(ctx) {
    for (const arr of this.trails.values()) {
      ctx.save();
      for (const pt of arr) {
        const a = clamp01(pt.life / 0.22);
        ctx.globalAlpha = a * 0.33;
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 7 * a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  };

  FXSystem.prototype.draw = function(ctx) {
    // starburst (anime impact flare)
    for (const sb of this.starBursts) {
      const a = clamp01(sb.life / 0.16);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(sb.x, sb.y);
      ctx.strokeStyle = "white";
      ctx.lineWidth = 2;
      const k = 8;
      for (let i = 0; i < k; i++) {
        const ang = (i / k) * Math.PI * 2;
        const L = 18 * sb.s;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * 2, Math.sin(ang) * 2);
        ctx.lineTo(Math.cos(ang) * (L + 16 * (1 - a)), Math.sin(ang) * (L + 16 * (1 - a)));
        ctx.stroke();
      }
      ctx.restore();
    }

    // rings
    for (const r of this.rings) {
      const a = clamp01(r.life * 6) * r.a;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // sparks
    for (const p of this.particles) {
      const a = clamp01(p.life * 5);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = `hsl(${p.hue} 100% 60%)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // comic text
    for (const t of this.pops) {
      const a = clamp01(t.life * 2.4);
      ctx.save();
      ctx.globalAlpha = a;
      const s = Math.floor(18 * t.scale);
      ctx.font = `${s}px Orbitron, system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const jx = t.jitter ? (Math.random() - 0.5) * 4 : 0;
      const jy = t.jitter ? (Math.random() - 0.5) * 4 : 0;

      ctx.shadowColor = "black";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 3;
      ctx.lineWidth = t.banner ? 9 : 6;
      ctx.strokeStyle = "black";
      ctx.strokeText(t.text, t.x + jx, t.y + jy);
      ctx.fillStyle = t.banner ? "#fff04a" : "white";
      ctx.fillText(t.text, t.x + jx, t.y + jy);
      ctx.restore();
    }
  };

  // ------------------------------
  // Spinner creation from ship telemetry
  // ------------------------------
  function spinnerFromTicker(ticker, idx) {
    const t = (window.ShipTelemetry && window.ShipTelemetry.getTelemetry)
      ? window.ShipTelemetry.getTelemetry(ticker)
      : (window.ShipTelemetry && window.ShipTelemetry._TELEMETRY && window.ShipTelemetry._TELEMETRY[ticker])
        ? window.ShipTelemetry._TELEMETRY[ticker]
        : null;

    // Safe defaults if telemetry missing
    const tele = Object.assign({
      thrustPotential: 0.5,
      maneuverStability: 0.5,
      hullResilience: 0.5,
      chopSensitivity: 0.5,
      signalClarity: 0.5,
      volumeReliability: 0.6,
      regimeBias: 'range'
    }, t || {});

    const volumeReliability = tele.volumeReliability ?? 0.6;

    const mass = 0.8 + (2.2 - 0.8) * (0.75 * easeOut(tele.hullResilience) + 0.25 * easeOut(volumeReliability));
    const radius = 18 + (28 - 18) * (0.6 * (tele.hullResilience) + 0.4 * (1 - tele.maneuverStability));
    const omega0 = 10 + (48 - 10) * easeOut(tele.thrustPotential);
    const vmax = 120 + (380 - 120) * (0.55 * easeOut(tele.thrustPotential) + 0.45 * (1 - easeOut(tele.chopSensitivity)));

    const stability = clamp01(
      0.55 * tele.maneuverStability +
      0.25 * tele.signalClarity +
      0.20 * volumeReliability -
      0.35 * tele.chopSensitivity
    );

    const spritePath = (window.SHIP_SPRITES && window.SHIP_SPRITES[ticker]) || window.DEFAULT_SHIP_SPRITE;

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
      coherence: 1.0,
      angle: Math.random() * Math.PI * 2,
      alive: true,
      spritePath,
      spriteImg: null,
      hue: 180 + Math.floor(140 * (tele.thrustPotential - tele.chopSensitivity))
    };
  }

  // ------------------------------
  // Collision resolution (returns event payload for FX)
  // ------------------------------
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

    // Positional correction always
    const penetration = minDist - dist;
    const totalInvMass = 1 / a.mass + 1 / b.mass;
    a.position.x += n.x * penetration * (1 / a.mass) / totalInvMass;
    a.position.y += n.y * penetration * (1 / a.mass) / totalInvMass;
    b.position.x -= n.x * penetration * (1 / b.mass) / totalInvMass;
    b.position.y -= n.y * penetration * (1 / b.mass) / totalInvMass;

    if (vn > 0) return null;

    const Sa = a.stability, Sb = b.stability;
    const e = 0.15 + (0.65 - 0.15) * clamp01(0.6 * (Sa + Sb) * 0.5 + 0.4 * (a.telemetry.signalClarity + b.telemetry.signalClarity) * 0.5);

    const j = -(1 + e) * vn / (1 / a.mass + 1 / b.mass);

    a.velocity.x += (j * n.x) / a.mass;
    a.velocity.y += (j * n.y) / a.mass;
    b.velocity.x -= (j * n.x) / b.mass;
    b.velocity.y -= (j * n.y) / b.mass;

    // Scrape
    const t = perp(n);
    const vt = dot(rv, t);
    const mu = 0.02 + (0.18 - 0.02) * (0.5 * (1 - Sa) + 0.5 * (1 - Sb));
    const jt = Math.max(-mu * Math.abs(j), Math.min(mu * Math.abs(j), -vt / (1 / a.mass + 1 / b.mass)));

    a.velocity.x += (jt * t.x) / a.mass;
    a.velocity.y += (jt * t.y) / a.mass;
    b.velocity.x -= (jt * t.x) / b.mass;
    b.velocity.y -= (jt * t.y) / b.mass;

    const impact01 = clamp01(Math.abs(j) / 2.2);

    // Spin loss
    const spinLoss = (s) => impact01 * (0.8 + 2.2 * (1 - s.telemetry.hullResilience) + 1.6 * s.telemetry.chopSensitivity);
    a.omega = Math.max(0, a.omega - spinLoss(a));
    b.omega = Math.max(0, b.omega - spinLoss(b));

    // Coherence loss
    const coherenceLoss = (s) => impact01 * (0.010 + 0.020 * (1 - s.telemetry.hullResilience) + 0.014 * (1 - s.telemetry.maneuverStability));
    const aBefore = a.coherence;
    const bBefore = b.coherence;
    a.coherence = clamp01(a.coherence - coherenceLoss(a) * (1 + 0.9 * (1 - a.omega / a.omega0)));
    b.coherence = clamp01(b.coherence - coherenceLoss(b) * (1 + 0.9 * (1 - b.omega / b.omega0)));

    // Burst chance
    const burstChance = (s) => Math.pow(impact01, 1.3) * Math.pow(1 - s.coherence, 1.8) * Math.pow(1 - s.telemetry.hullResilience, 1.2) * (0.6 + 0.8 * s.telemetry.chopSensitivity);
    const burstA = aBefore > 0.08 && a.coherence <= 0.08 && Math.random() < burstChance(a);
    const burstB = bBefore > 0.08 && b.coherence <= 0.08 && Math.random() < burstChance(b);

    return {
      x: (a.position.x + b.position.x) * 0.5,
      y: (a.position.y + b.position.y) * 0.5,
      impact01,
      burstA,
      burstB
    };
  }

  // ------------------------------
  // Arena core
  // ------------------------------
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
    stars: [],

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

      // Keyboard ESC to close
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.overlay && this.overlay.classList.contains('active')) {
          this.close();
        }
      });

      // Make canvas crisp on HiDPI
      this.resizeCanvas();
      window.addEventListener('resize', () => this.resizeCanvas());

      this.generateStars();
    },

    resizeCanvas() {
      const cssW = this.canvas.clientWidth || 520;
      const cssH = this.canvas.clientHeight || 520;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.canvas.width = Math.floor(cssW * dpr);
      this.canvas.height = Math.floor(cssH * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      this.center = { x: cssW / 2, y: cssH / 2 };
      this.arenaRadius = Math.min(cssW, cssH) * 0.42;
    },

    generateStars() {
      this.stars = [];
      for (let i = 0; i < 140; i++) {
        this.stars.push({
          x: Math.random(),
          y: Math.random(),
          z: 0.2 + Math.random() * 0.8,
          tw: Math.random() * Math.PI * 2
        });
      }
    },

    loadSprite(spinner) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => { spinner.spriteImg = img; resolve(); };
        img.onerror = () => { spinner.spriteImg = null; resolve(); };
        img.src = spinner.spritePath;
      });
    },

    open(tickerA, tickerB) {
      if (!this.overlay) this.init();
      if (!this.overlay) return;

      this.overlay.classList.add('active');
      this.start(tickerA, tickerB);
    },

    close() {
      this.active = false;
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = null;
      if (this.overlay) this.overlay.classList.remove('active');
    },

    rematch() {
      if (this.spinners.length < 2) return;
      this.start(this.spinners[0].ticker, this.spinners[1].ticker);
    },

    async start(tickerA, tickerB) {
      this.active = false;
      if (this.raf) cancelAnimationFrame(this.raf);

      // default selection if none
      tickerA = tickerA || 'RKLB';
      tickerB = tickerB || (tickerA === 'ACHR' ? 'RKLB' : 'ACHR');

      // build spinners
      const s1 = spinnerFromTicker(tickerA, 1);
      const s2 = spinnerFromTicker(tickerB, 2);

      // position + initial kick
      const r = this.arenaRadius * 0.35;
      s1.position.x = this.center.x - r;
      s1.position.y = this.center.y;
      s2.position.x = this.center.x + r;
      s2.position.y = this.center.y;
      s1.velocity.x = 70; s1.velocity.y = -40;
      s2.velocity.x = -70; s2.velocity.y = 40;

      this.spinners = [s1, s2];
      this.fx = new FXSystem();

      await Promise.all([this.loadSprite(s1), this.loadSprite(s2)]);

      // UI readout
      this.updateSidePanels();
      this.setBanner(`ROUND START: ${tickerA} vs ${tickerB}`);

      if (window.MechSFX) window.MechSFX.powerUp(0.28);

      this.active = true;
      this.lastTime = performance.now();
      this.raf = requestAnimationFrame((t) => this.loop(t));
    },

    setBanner(text) {
      const el = document.getElementById('bey-arena-banner');
      if (el) el.textContent = text;
    },

    updateSidePanels() {
      const left = document.getElementById('bey-left-readout');
      const right = document.getElementById('bey-right-readout');
      if (!left || !right || this.spinners.length < 2) return;

      const fmt = (s) => {
        const t = s.telemetry;
        const pct = (x) => Math.round(clamp01(x) * 100);
        return [
          `${s.ticker}`,
          `REGIME: ${String(t.regimeBias || 'range').toUpperCase()}`,
          `THRUST: ${pct(t.thrustPotential)}  |  CHOP: ${pct(t.chopSensitivity)}`,
          `HULL: ${pct(t.hullResilience)}    |  STAB: ${Math.round(s.stability * 100)}`,
          `SIGNAL: ${pct(t.signalClarity)}`
        ].join('\n');
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
      // update spinners
      for (const s of this.spinners) {
        if (!s.alive) continue;
        this.fx.pushTrail(s.id, s.position.x, s.position.y);

        // drive direction
        const toCenter = norm({ x: this.center.x - s.position.x, y: this.center.y - s.position.y });
        const tangent = { x: -toCenter.y, y: toCenter.x };

        let driveDir = tangent;
        if (s.telemetry.regimeBias === 'range') {
          driveDir = norm({ x: tangent.x + toCenter.x * 0.18, y: tangent.y + toCenter.y * 0.18 });
        } else if (s.telemetry.regimeBias === 'chaotic') {
          driveDir = norm({
            x: tangent.x * 0.65 + toCenter.x * -0.28 + (Math.random() - 0.5) * 0.95,
            y: tangent.y * 0.65 + toCenter.y * -0.28 + (Math.random() - 0.5) * 0.95
          });
        }

        const A = 140 + (520 - 140) * (0.7 * s.telemetry.thrustPotential + 0.3 * s.telemetry.signalClarity);
        s.velocity.x += driveDir.x * A * dt;
        s.velocity.y += driveDir.y * A * dt;

        // drag
        const kv = 0.35 + (1.15 - 0.35) * (s.telemetry.chopSensitivity ** 2);
        s.velocity.x *= Math.exp(-kv * dt);
        s.velocity.y *= Math.exp(-kv * dt);

        // clamp speed
        const spd = len(s.velocity);
        if (spd > s.vmax) {
          const f = s.vmax / spd;
          s.velocity.x *= f;
          s.velocity.y *= f;
        }

        // spin decay
        const kw = 0.10 + (0.55 - 0.10) * (0.55 * s.telemetry.chopSensitivity + 0.45 * (1 - s.telemetry.maneuverStability));
        s.omega *= Math.exp(-kw * dt);

        // integrate
        s.position.x += s.velocity.x * dt;
        s.position.y += s.velocity.y * dt;

        // boundary
        const dx = s.position.x - this.center.x;
        const dy = s.position.y - this.center.y;
        const dist = Math.hypot(dx, dy);

        if (dist > this.arenaRadius - s.radius) {
          const n = norm({ x: dx, y: dy });
          const vn = s.velocity.x * n.x + s.velocity.y * n.y;
          if (vn > 0) {
            const eb = 0.25 + 0.45 * s.stability;
            s.velocity.x -= (1 + eb) * vn * n.x;
            s.velocity.y -= (1 + eb) * vn * n.y;
            this.fx.impact(s.position.x, s.position.y, 0.22);
            if (window.MechSFX) window.MechSFX.weaponFire(0.06);
          }
        }

        if (dist > this.arenaRadius + s.radius * 0.35) {
          s.alive = false;
          this.fx.ringOut(s.position.x, s.position.y);
          this.setBanner(`${s.ticker} RING OUT!!`);
        }

        if (s.omega < 2) {
          s.alive = false;
          this.fx.spinOut(s.position.x, s.position.y);
          this.setBanner(`${s.ticker} OUT OF SPIN!!`);
        }
      }

      // collisions
      for (let i = 0; i < this.spinners.length; i++) {
        for (let j = i + 1; j < this.spinners.length; j++) {
          const evt = resolveCollision(this.spinners[i], this.spinners[j]);
          if (!evt) continue;
          this.fx.impact(evt.x, evt.y, evt.impact01);
          if (window.MechSFX) window.MechSFX.bassHit(66 + Math.floor(evt.impact01 * 40), 0.08);

          if (evt.burstA) {
            this.spinners[i].alive = false;
            this.fx.burst(this.spinners[i].position.x, this.spinners[i].position.y);
            this.setBanner(`${this.spinners[i].ticker} BURST!!`);
          }
          if (evt.burstB) {
            this.spinners[j].alive = false;
            this.fx.burst(this.spinners[j].position.x, this.spinners[j].position.y);
            this.setBanner(`${this.spinners[j].ticker} BURST!!`);
          }
        }
      }

      this.fx.update(dt);

      // Win state
      const alive = this.spinners.filter(s => s.alive);
      if (alive.length <= 1) {
        const winner = alive[0] ? alive[0].ticker : 'NO ONE';
        this.setBanner(`WINNER: ${winner}  //  (MARKET IS WEIRD)`);
        this.active = false;
        // let FX fade out while frozen
        setTimeout(() => { if (this.overlay && this.overlay.classList.contains('active')) this.active = false; }, 50);
      }

      this.updateSidePanels();
    },

    render() {
      const ctx = this.ctx;
      const w = this.canvas.clientWidth || 520;
      const h = this.canvas.clientHeight || 520;

      ctx.clearRect(0, 0, w, h);
      ctx.save();
      this.fx.beginShake(ctx);

      this.drawStarfield(ctx, w, h);
      this.drawArenaRing(ctx);

      // trails (behind)
      this.fx.drawTrails(ctx);

      // spinners
      for (const s of this.spinners) {
        if (!s.alive) continue;
        const spd = len(s.velocity);
        if (spd > s.vmax * 0.72) this.drawSpeedLines(ctx, s.position.x, s.position.y, s.velocity.x, s.velocity.y);
        this.drawSpinner(ctx, s);
      }

      // foreground FX
      this.fx.draw(ctx);

      // CRT bloom-ish vignette
      this.drawVignette(ctx, w, h);

      ctx.restore();
    },

    drawStarfield(ctx, w, h) {
      // subtle parallax stars, with twinkle
      ctx.save();
      ctx.globalAlpha = 0.9;
      for (const s of this.stars) {
        s.tw += 0.9 * 0.016;
        const a = 0.25 + 0.35 * Math.sin(s.tw);
        const x = s.x * w;
        const y = s.y * h;
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.beginPath();
        ctx.arc(x, y, 0.6 + 1.4 * s.z, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // subtle scanline-like glow bands
      ctx.save();
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = '#33ff99';
      for (let i = 0; i < 8; i++) {
        const yy = (i / 8) * h;
        ctx.fillRect(0, yy, w, 2);
      }
      ctx.restore();
    },

    drawArenaRing(ctx) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(this.center.x, this.center.y, this.arenaRadius, 0, Math.PI * 2);
      ctx.stroke();

      // inner decorative rings
      ctx.globalAlpha = 0.18;
      ctx.lineWidth = 2;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(this.center.x, this.center.y, this.arenaRadius * (0.25 + i * 0.18), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    },

    drawSpeedLines(ctx, x, y, vx, vy) {
      const n = norm({ x: vx, y: vy });
      const t = { x: -n.y, y: n.x };
      ctx.save();
      ctx.globalAlpha = 0.26;
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      for (let i = 0; i < 7; i++) {
        const off = (Math.random() - 0.5) * 30;
        const L = 32 + Math.random() * 62;
        const sx = x - n.x * (10 + Math.random() * 22) + t.x * off;
        const sy = y - n.y * (10 + Math.random() * 22) + t.y * off;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - n.x * L, sy - n.y * L);
        ctx.stroke();
      }
      ctx.restore();
    },

    drawSpinner(ctx, s) {
      // wobble grows as spin drops
      const wobble = (1 - s.stability) * (1 - Math.min(1, s.omega / s.omega0));
      const time = performance.now() * 0.001;
      const wob = wobble * Math.sin(time * (6 + 12 * (1 - s.stability)));

      // update angle
      s.angle += s.omega * 0.016;

      ctx.save();
      ctx.translate(s.position.x, s.position.y);
      ctx.rotate(s.angle + wob);

      // outer ring
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.arc(0, 0, s.radius, 0, Math.PI * 2);
      ctx.fill();

      // strike arcs
      const hue = s.hue;
      ctx.strokeStyle = `hsl(${hue} 90% 60%)`;
      ctx.lineWidth = 4;
      for (let k = 0; k < 3; k++) {
        const a0 = time * (2 + k) + k * 2.1;
        ctx.beginPath();
        ctx.arc(0, 0, s.radius * (0.74 + 0.08 * k), a0, a0 + 1.2);
        ctx.stroke();
      }

      // core glow
      const coreR = s.radius * 0.46;
      ctx.globalAlpha = 0.88;
      ctx.fillStyle = `hsl(${hue} 100% 62%)`;
      ctx.beginPath();
      ctx.arc(0, 0, coreR, 0, Math.PI * 2);
      ctx.fill();

      // ship sprite stamp (tiny, spinning)
      if (s.spriteImg) {
        ctx.globalAlpha = 0.9;
        const img = s.spriteImg;
        const scale = (coreR * 1.4) / Math.max(img.width, img.height);
        ctx.save();
        ctx.rotate(-s.angle * 0.85);
        ctx.scale(scale, scale);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        ctx.restore();
      }

      // chaotic gremlin "eye"
      if (s.telemetry.regimeBias === 'chaotic') {
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(coreR * 0.35, -coreR * 0.15, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(coreR * 0.38, -coreR * 0.14, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // coherence ring (durability)
      ctx.rotate(-s.angle * 0.6);
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = 'rgba(255,255,255,0.90)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, s.radius * 0.96, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * s.coherence);
      ctx.stroke();

      ctx.restore();
    },

    drawVignette(ctx, w, h) {
      ctx.save();
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.15, w / 2, h / 2, Math.min(w, h) * 0.55);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.42)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  };

  // ------------------------------
  // UI wiring
  // ------------------------------
  function getActiveTicker() {
    // prefer PaintBay selection; fallback to SpaceRun; fallback RKLB
    try {
      if (window.PaintBay && typeof window.PaintBay.getSelectedShip === 'function') {
        const t = window.PaintBay.getSelectedShip();
        if (t) return t;
      }
    } catch (e) {}
    try {
      if (window.SpaceRun && window.SpaceRun.selectedShip) return window.SpaceRun.selectedShip;
    } catch (e) {}
    return 'RKLB';
  }

  function pickOpponent(exclude) {
    const tele = (window.ShipTelemetry && window.ShipTelemetry._TELEMETRY) 
      ? window.ShipTelemetry._TELEMETRY 
      : null;
    const keys = tele ? Object.keys(tele) : ['ACHR', 'RKLB', 'GME', 'GE', 'LUNR', 'JOBY', 'ASTS', 'BKSY'];
    const pool = keys.filter(k => k && k !== exclude);
    return pool[(Math.random() * pool.length) | 0] || 'ACHR';
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

  // Expose
  window.BeyArena = BeyArena;

  window.addEventListener('DOMContentLoaded', () => {
    BeyArena.init();
    bindLaunchers();
  });
})();
