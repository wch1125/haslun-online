/**
 * ═══════════════════════════════════════════════════════════════════
 * FLIGHT SCENE ENGINE (Step 5)
 * Unified canvas-based ship flight animation
 * 
 * Used for:
 * - Loading screen (full intensity, many ships)
 * - Fleet page background (reduced intensity, glass effect)
 * ═══════════════════════════════════════════════════════════════════
 */

window.FlightScene = (function() {
  'use strict';
  
  // ═══════════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════
  
  const CONFIG = {
    loading: {
      maxShips: 16,
      mobileMaxShips: 8,
      trailLength: 12,
      mobileTrailLength: 4,
      glowIntensity: 1.0,
      formationInterval: 4000, // ms between formation pulses
      baseSpeed: 0.8,
      showHUD: true
    },
    fleet: {
      maxShips: 10,
      mobileMaxShips: 5,
      trailLength: 6,
      mobileTrailLength: 2,
      glowIntensity: 0.5,
      formationInterval: 8000,
      baseSpeed: 0.4,
      showHUD: false
    },
    // Step 5: Hangar mode with 3 depth bands
    hangar: {
      maxShips: 18,
      mobileMaxShips: 10,
      trailLength: 8,
      mobileTrailLength: 3,
      glowIntensity: 0.55,
      formationInterval: 10000,
      baseSpeed: 0.35,
      showHUD: false,
      useDepthBands: true
    }
  };
  
  // Depth band configurations (Step 5)
  const DEPTH_BANDS = {
    far: {
      scale: [0.35, 0.55],
      opacity: [0.12, 0.20],
      speedMult: 0.5,
      blur: 0.5,
      spawnWeight: 0.45  // 45% of ships
    },
    mid: {
      scale: [0.70, 0.95],
      opacity: [0.22, 0.35],
      speedMult: 0.85,
      blur: 0,
      spawnWeight: 0.45  // 45% of ships
    },
    near: {
      scale: [1.15, 1.6],
      opacity: [0.18, 0.28],
      speedMult: 0.7,
      blur: 0,
      spawnWeight: 0.10,  // 10% of ships (rare)
      spawnInterval: 14000 // 14 seconds between near ships
    }
  };
  
  // Ship type visual configs
  const SHIP_STYLES = {
    normal: { color: '#33ff99', glowColor: 'rgba(51, 255, 153, 0.6)', size: 1.0 },
    elite: { color: '#ffd700', glowColor: 'rgba(255, 215, 0, 0.7)', size: 1.2 },
    mission: { color: '#00d4ff', glowColor: 'rgba(0, 212, 255, 0.7)', size: 1.1 },
    support: { color: '#ffaa33', glowColor: 'rgba(255, 170, 51, 0.5)', size: 0.9 },
    benchmark: { color: '#888888', glowColor: 'rgba(136, 136, 136, 0.3)', size: 0.7 }
  };
  
  // ═══════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════
  
  let activeScenes = new Map(); // canvas -> scene state
  let focusedTicker = null;     // Currently focused ticker (Step 5)
  let focusTimeout = null;      // Auto-clear focus timeout
  
  // ═══════════════════════════════════════════════════════════════════
  // SPRITE CACHE (Step 5C) — replaces chevron rendering
  // ═══════════════════════════════════════════════════════════════════
  
  const SPRITE_CACHE = new Map();
  
  function getShipSprite(ticker) {
    const sprites = window.SHIP_SPRITES || {};
    const fallback = window.DEFAULT_SHIP_SPRITE || 'assets/ships/static/Unclaimed-Drone-ship.png';
    const src = sprites[ticker] || fallback;
    
    if (!SPRITE_CACHE.has(src)) {
      const img = new Image();
      img.src = src;
      SPRITE_CACHE.set(src, img);
    }
    return SPRITE_CACHE.get(src);
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // PERFORMANCE STATS CACHE (Step 5D fix) — avoid repeated fetches
  // ═══════════════════════════════════════════════════════════════════
  
  let cachedPerfStats = null;
  let perfStatsFetchPromise = null;
  
  async function getPerfStats() {
    // Return cached stats if available
    if (cachedPerfStats !== null) {
      return cachedPerfStats;
    }
    
    // If already fetching, wait for that promise
    if (perfStatsFetchPromise) {
      return perfStatsFetchPromise;
    }
    
    // Fetch and cache
    perfStatsFetchPromise = (async () => {
      try {
        const res = await fetch('data/stats.json');
        if (res.ok) {
          cachedPerfStats = await res.json();
        } else {
          cachedPerfStats = {};
        }
      } catch (e) {
        cachedPerfStats = {};
      }
      perfStatsFetchPromise = null;
      return cachedPerfStats;
    })();
    
    return perfStatsFetchPromise;
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // SHIP CLASS
  // ═══════════════════════════════════════════════════════════════════
  
  class Ship {
    constructor(ticker, stats, canvasW, canvasH, config, depthBand = null) {
      this.ticker = ticker;
      this.stats = stats || {};
      this.config = config;
      this.depthBand = depthBand; // Step 5: assigned depth band
      
      // Position (spawn from edge)
      const edge = Math.floor(Math.random() * 4);
      switch (edge) {
        case 0: // top
          this.x = Math.random() * canvasW;
          this.y = -30;
          break;
        case 1: // right
          this.x = canvasW + 30;
          this.y = Math.random() * canvasH;
          break;
        case 2: // bottom
          this.x = Math.random() * canvasW;
          this.y = canvasH + 30;
          break;
        case 3: // left
          this.x = -30;
          this.y = Math.random() * canvasH;
          break;
      }
      
      // Determine ship type
      this.type = this.determineType();
      this.style = SHIP_STYLES[this.type];
      
      // Motion parameters (data-driven)
      const fitPercent = stats.fit || stats.suitability || 50;
      const threat = stats.threat || 30;
      const firepower = stats.firepower || 50;
      
      // Speed based on fit% (higher fit = faster)
      const speedMultiplier = 0.5 + (fitPercent / 100) * 1.0;
      this.baseSpeed = config.baseSpeed * speedMultiplier;
      
      // Trail length based on firepower (higher = longer trail)
      this.trailMultiplier = 0.5 + (firepower / 100) * 1.0;
      
      // Glow based on threat (higher = more glow)
      this.glowMultiplier = 0.5 + (threat / 100) * 1.0;
      
      // Initial velocity (toward center-ish with variance)
      const centerX = canvasW / 2 + (Math.random() - 0.5) * canvasW * 0.6;
      const centerY = canvasH / 2 + (Math.random() - 0.5) * canvasH * 0.6;
      const angle = Math.atan2(centerY - this.y, centerX - this.x);
      this.vx = Math.cos(angle) * this.baseSpeed + (Math.random() - 0.5) * 0.3;
      this.vy = Math.sin(angle) * this.baseSpeed + (Math.random() - 0.5) * 0.3;
      
      // Step 5: Apply depth band properties if assigned
      if (this.depthBand && DEPTH_BANDS[this.depthBand]) {
        const band = DEPTH_BANDS[this.depthBand];
        const [minScale, maxScale] = band.scale;
        const [minOpacity, maxOpacity] = band.opacity;
        
        this.bandScale = minScale + Math.random() * (maxScale - minScale);
        this.bandOpacity = minOpacity + Math.random() * (maxOpacity - minOpacity);
        this.depth = this.bandScale;
        this.baseSpeed *= band.speedMult;
        this.bandBlur = band.blur || 0;
      } else {
        // Default depth for parallax (0.6 to 1.3)
        this.depth = 0.6 + Math.random() * 0.7;
        this.bandScale = this.depth;
        this.bandOpacity = null;
        this.bandBlur = 0;
      }
      
      // Rotation
      this.rotation = Math.atan2(this.vy, this.vx);
      this.rotationTarget = this.rotation;
      
      // Wobble
      this.wobblePhase = Math.random() * Math.PI * 2;
      this.wobbleSpeed = 0.02 + Math.random() * 0.02;
      this.wobbleAmount = 0.1 + Math.random() * 0.15;
      
      // Trail history
      this.trail = [];
      this.maxTrail = Math.floor(config.trailLength * this.trailMultiplier);
      
      // Step 8: Apply progression modifiers
      const prog = window.Progression?.computeEffects(ticker);
      if (prog && prog.effects) {
        const thrustBoost = 1 + (prog.effects.thrust || 0);
        const trailBoost = 1 + (prog.effects.trail || 0);
        
        // Apply speed boost
        this.baseSpeed *= thrustBoost;
        this.vx *= thrustBoost;
        this.vy *= thrustBoost;
        
        // Apply trail boost
        this.maxTrail = Math.floor(this.maxTrail * trailBoost);
        
        // Apply visual modifiers
        if (prog.visuals) {
          this.progGlow = prog.visuals.glow || 1;
          this.progScale = prog.visuals.scale || 1;
          this.progRing = prog.visuals.ring || null;
          this.progAura = prog.visuals.aura || 0;
        }
      } else {
        this.progGlow = 1;
        this.progScale = 1;
        this.progRing = null;
        this.progAura = 0;
      }
      
      // Formation state
      this.inFormation = false;
      this.formationTarget = null;
    }
    
    // Step 5: Check if this ship is focused
    get isFocused() {
      return focusedTicker && this.ticker === focusedTicker;
    }
    
    determineType() {
      if (this.stats.isBenchmark) return 'benchmark';
      if (this.stats.isSupport) return 'support';
      if (this.stats.hasMission) return 'mission';
      if (this.stats.isElite) return 'elite';
      return 'normal';
    }
    
    update(canvasW, canvasH, deltaTime) {
      // Wobble
      this.wobblePhase += this.wobbleSpeed * deltaTime;
      const wobble = Math.sin(this.wobblePhase) * this.wobbleAmount;
      
      // Apply formation steering if active
      if (this.inFormation && this.formationTarget) {
        const dx = this.formationTarget.x - this.x;
        const dy = this.formationTarget.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 10) {
          this.vx += (dx / dist) * 0.02 * deltaTime;
          this.vy += (dy / dist) * 0.02 * deltaTime;
        }
      }
      
      // Apply velocity with depth scaling
      const speedScale = this.depth * deltaTime * 0.06;
      this.x += (this.vx + wobble * 0.5) * speedScale * 60;
      this.y += (this.vy + wobble * 0.3) * speedScale * 60;
      
      // Update rotation toward velocity
      this.rotationTarget = Math.atan2(this.vy, this.vx);
      this.rotation += (this.rotationTarget - this.rotation) * 0.05 * deltaTime;
      
      // Wrap around edges
      const margin = 50;
      if (this.x < -margin) this.x = canvasW + margin;
      if (this.x > canvasW + margin) this.x = -margin;
      if (this.y < -margin) this.y = canvasH + margin;
      if (this.y > canvasH + margin) this.y = -margin;
      
      // Update trail
      this.trail.unshift({ x: this.x, y: this.y });
      if (this.trail.length > this.maxTrail) {
        this.trail.pop();
      }
    }
    
    draw(ctx, intensity) {
      const size = 8 * this.style.size * this.depth;
      const glowRadius = 15 * this.glowMultiplier * intensity * this.depth;
      
      // Step 5: Calculate effective opacity (bandOpacity or default)
      let effectiveOpacity = this.bandOpacity !== null ? this.bandOpacity : intensity;
      
      // Step 5: Focus effects
      const isFocused = this.isFocused;
      if (focusedTicker) {
        if (isFocused) {
          // Boost focused ship
          effectiveOpacity = Math.min(1, effectiveOpacity * 1.5);
        } else {
          // Dim non-focused ships slightly
          effectiveOpacity *= 0.85;
        }
      }
      
      ctx.save();
      ctx.globalAlpha = effectiveOpacity;
      
      // Draw trail
      if (this.trail.length > 1 && intensity > 0.3) {
        ctx.beginPath();
        ctx.moveTo(this.trail[0].x, this.trail[0].y);
        for (let i = 1; i < this.trail.length; i++) {
          ctx.lineTo(this.trail[i].x, this.trail[i].y);
        }
        ctx.strokeStyle = this.style.glowColor.replace(/[\d.]+\)$/, (0.4 * intensity * this.depth) + ')');
        ctx.lineWidth = 2 * this.depth;
        ctx.stroke();
      }
      
      // Draw glow (enhanced if focused + progression boost)
      const focusGlowBoost = isFocused ? 1.4 : 1.0;
      const progGlowBoost = this.progGlow || 1.0;
      const finalGlowRadius = glowRadius * focusGlowBoost * progGlowBoost;
      if (finalGlowRadius > 3) {
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, finalGlowRadius);
        gradient.addColorStop(0, this.style.glowColor);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, finalGlowRadius, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Draw ship sprite (Step 5C: pixel art instead of chevron)
      const img = getShipSprite(this.ticker);
      
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      
      // Keep pixel crisp
      ctx.imageSmoothingEnabled = false;
      
      // Size tuned for aesthetic (scale with depth + elite emphasis + progression)
      // Step 5E: reduce base size on mobile
      const isMobile = (window.innerWidth < 768 || 'ontouchstart' in window);
      const base = isMobile ? 34 : 44;
      const progScaleBoost = this.progScale || 1.0;
      const spriteSize = base * this.depth * (this.style?.size || 1) * progScaleBoost;
      
      // Slightly boost focused ship
      const focusBoost = isFocused ? 1.15 : 1.0;
      
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(
          img,
          -spriteSize * focusBoost / 2,
          -spriteSize * focusBoost / 2,
          spriteSize * focusBoost,
          spriteSize * focusBoost
        );
      } else {
        // Fallback: tiny dot if image not ready (should be rare)
        ctx.fillStyle = this.style.color;
        ctx.beginPath();
        ctx.arc(0, 0, 3 * this.depth, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Mission ring (if has active mission)
      if (this.stats.hasMission && intensity > 0.5) {
        ctx.strokeStyle = '#00d4ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, spriteSize * 0.6, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      // Step 8: Progression upgrade ring (if has equipped upgrade with ring)
      if (this.progRing && intensity > 0.4 && !this.stats.hasMission) {
        ctx.strokeStyle = this.progRing;
        ctx.globalAlpha = 0.25;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, spriteSize * 0.62, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = effectiveOpacity;
      }
      
      // Step 8: Progression aura (for high-level ships with core upgrades)
      if (this.progAura > 0 && intensity > 0.5) {
        ctx.strokeStyle = '#9933ff';
        ctx.globalAlpha = 0.12;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, spriteSize * 0.85, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = effectiveOpacity;
      }
      
      // Support chevron (if escorting)
      if (this.stats.isSupport && intensity > 0.5) {
        ctx.strokeStyle = '#ffaa33';
        ctx.lineWidth = 1.5;
        const chevSize = spriteSize * 0.35;
        ctx.beginPath();
        ctx.moveTo(-chevSize * 1.5, -chevSize * 0.8);
        ctx.lineTo(-chevSize * 2.2, 0);
        ctx.lineTo(-chevSize * 1.5, chevSize * 0.8);
        ctx.stroke();
      }
      
      ctx.restore();
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // SCENE CLASS
  // ═══════════════════════════════════════════════════════════════════
  
  class Scene {
    constructor(canvas, options) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.mode = options.mode || 'loading';
      this.config = CONFIG[this.mode];
      this.intensity = options.intensity ?? 1.0;
      this.onReady = options.onReady || null;
      this.shipData = options.ships || [];
      
      this.ships = [];
      this.running = false;
      this.lastTime = 0;
      this.formationTimer = 0;
      this.inFormation = false;
      this.startTime = Date.now();
      this.isReady = false;
      this.minDisplayTime = options.minDisplayTime ?? 1200;
      
      // Check reduced motion preference
      this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      
      // Detect mobile
      this.isMobile = window.innerWidth < 768 || 'ontouchstart' in window;
      
      // Setup canvas
      this.setupCanvas();
      
      // Create ships
      this.createShips();
      
      // Resize handler
      this.resizeHandler = () => this.setupCanvas();
      window.addEventListener('resize', this.resizeHandler);
    }
    
    setupCanvas() {
      const rect = this.canvas.parentElement?.getBoundingClientRect() || 
                   { width: window.innerWidth, height: window.innerHeight };
      const dpr = window.devicePixelRatio || 1;
      
      this.width = rect.width;
      this.height = rect.height;
      
      this.canvas.width = this.width * dpr;
      this.canvas.height = this.height * dpr;
      this.canvas.style.width = this.width + 'px';
      this.canvas.style.height = this.height + 'px';
      
      // Reset transform before scaling to prevent cumulative scaling on resize
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(dpr, dpr);
    }
    
    createShips() {
      const maxShips = this.isMobile ? this.config.mobileMaxShips : this.config.maxShips;
      const trailLength = this.isMobile ? this.config.mobileTrailLength : this.config.trailLength;
      
      // Adjust config for mobile
      const adjustedConfig = { ...this.config, trailLength };
      
      // Build ship roster from data
      const roster = this.shipData.slice(0, maxShips);
      
      // Step 5: Assign depth bands for hangar mode
      const useDepthBands = this.config.useDepthBands || false;
      
      for (let i = 0; i < roster.length; i++) {
        const data = roster[i];
        let depthBand = null;
        
        if (useDepthBands) {
          // Distribute ships across depth bands based on weights
          const roll = Math.random();
          if (roll < DEPTH_BANDS.far.spawnWeight) {
            depthBand = 'far';
          } else if (roll < DEPTH_BANDS.far.spawnWeight + DEPTH_BANDS.mid.spawnWeight) {
            depthBand = 'mid';
          } else {
            depthBand = 'near';
          }
        }
        
        const ship = new Ship(
          data.ticker,
          data,
          this.width,
          this.height,
          adjustedConfig,
          depthBand
        );
        this.ships.push(ship);
      }
      
      // If we need more ships, add generic ones
      while (this.ships.length < Math.min(maxShips, 6)) {
        let depthBand = null;
        if (useDepthBands) {
          depthBand = Math.random() < 0.6 ? 'far' : 'mid';
        }
        
        const ship = new Ship(
          'UNKNOWN',
          { fit: 50 + Math.random() * 30 },
          this.width,
          this.height,
          adjustedConfig,
          depthBand
        );
        this.ships.push(ship);
      }
    }
    
    start() {
      if (this.running) return;
      this.running = true;
      this.lastTime = performance.now();
      this.animate();
    }
    
    stop() {
      this.running = false;
      window.removeEventListener('resize', this.resizeHandler);
    }
    
    animate() {
      if (!this.running) return;
      
      const now = performance.now();
      const deltaTime = Math.min((now - this.lastTime) / 16.67, 3); // Cap at 3x normal
      this.lastTime = now;
      
      // Clear canvas
      this.ctx.fillStyle = 'rgba(10, 14, 20, 0.15)'; // Trail fade
      this.ctx.fillRect(0, 0, this.width, this.height);
      
      // Update formation timer
      if (!this.reducedMotion) {
        this.formationTimer += deltaTime * 16.67;
        if (this.formationTimer > this.config.formationInterval) {
          this.triggerFormation();
          this.formationTimer = 0;
        }
      }
      
      // Update and draw ships
      const effectiveIntensity = this.reducedMotion ? 0.3 : this.intensity * this.config.glowIntensity;
      
      for (const ship of this.ships) {
        if (!this.reducedMotion) {
          ship.update(this.width, this.height, deltaTime);
        }
        ship.draw(this.ctx, effectiveIntensity);
      }
      
      // Draw HUD (loading mode only)
      if (this.config.showHUD && this.mode === 'loading') {
        this.drawHUD();
      }
      
      requestAnimationFrame(() => this.animate());
    }
    
    triggerFormation() {
      // Pick elite/mission ships for formation
      const leaders = this.ships.filter(s => s.type === 'elite' || s.type === 'mission');
      if (leaders.length === 0) return;
      
      // Create formation point
      const centerX = this.width * (0.3 + Math.random() * 0.4);
      const centerY = this.height * (0.3 + Math.random() * 0.4);
      
      // Assign formation targets
      leaders.forEach((ship, i) => {
        ship.inFormation = true;
        ship.formationTarget = {
          x: centerX + (i - leaders.length / 2) * 40,
          y: centerY
        };
        
        // Release after 2 seconds
        setTimeout(() => {
          ship.inFormation = false;
          ship.formationTarget = null;
        }, 2000);
      });
      
      // Support ships follow loosely
      const supports = this.ships.filter(s => s.type === 'support');
      supports.forEach((ship, i) => {
        ship.inFormation = true;
        ship.formationTarget = {
          x: centerX + (i - supports.length / 2) * 30,
          y: centerY + 60
        };
        
        setTimeout(() => {
          ship.inFormation = false;
          ship.formationTarget = null;
        }, 2500);
      });
    }
    
    drawHUD() {
      const ctx = this.ctx;
      
      // Title
      ctx.font = '600 24px "IBM Plex Mono", monospace';
      ctx.fillStyle = 'rgba(51, 255, 153, 0.9)';
      ctx.textAlign = 'center';
      ctx.fillText('SPACE CAPITAL', this.width / 2, 50);
      
      // Subtitle
      ctx.font = '400 12px "IBM Plex Mono", monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText('Fleet Command System', this.width / 2, 72);
      
      // Status
      const elapsed = Date.now() - this.startTime;
      const dots = '.'.repeat(Math.floor(elapsed / 400) % 4);
      ctx.font = '400 14px "IBM Plex Mono", monospace';
      ctx.fillStyle = 'rgba(0, 212, 255, 0.8)';
      ctx.fillText(`Establishing uplink${dots}`, this.width / 2, this.height - 60);
      
      // Mission count (if available)
      if (window.MissionBridge) {
        const counts = window.MissionBridge.getCounts();
        if (counts.active > 0) {
          ctx.fillStyle = 'rgba(255, 170, 51, 0.8)';
          ctx.fillText(`Active Missions Detected: ${counts.active}`, this.width / 2, this.height - 40);
        }
      }
      
      // Progress indicator (subtle pulse bar)
      const progress = Math.min(elapsed / this.minDisplayTime, 1);
      const barWidth = 120;
      const barHeight = 2;
      const barX = (this.width - barWidth) / 2;
      const barY = this.height - 25;
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(barX, barY, barWidth, barHeight);
      
      ctx.fillStyle = 'rgba(51, 255, 153, 0.8)';
      ctx.fillRect(barX, barY, barWidth * progress, barHeight);
    }
    
    signalReady() {
      if (this.isReady) return;
      
      const elapsed = Date.now() - this.startTime;
      const remaining = Math.max(0, this.minDisplayTime - elapsed);
      
      setTimeout(() => {
        this.isReady = true;
        if (this.onReady) this.onReady();
      }, remaining);
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * Create and start a flight scene
   * @param {Object} options
   * @param {HTMLCanvasElement} options.canvas - Target canvas
   * @param {Array} options.ships - Ship data array [{ticker, fit, threat, firepower, hasMission, isSupport, isElite, isBenchmark}]
   * @param {'loading'|'fleet'} options.mode - Scene mode
   * @param {number} options.intensity - Effect intensity 0-1 (default 1)
   * @param {Function} options.onReady - Callback when scene signals ready
   * @param {number} options.minDisplayTime - Minimum ms to show (default 1200)
   */
  function create(options) {
    const { canvas } = options;
    if (!canvas) {
      console.error('[FlightScene] No canvas provided');
      return null;
    }
    
    // Stop existing scene on this canvas
    if (activeScenes.has(canvas)) {
      activeScenes.get(canvas).stop();
    }
    
    const scene = new Scene(canvas, options);
    activeScenes.set(canvas, scene);
    scene.start();
    
    return {
      stop: () => {
        scene.stop();
        activeScenes.delete(canvas);
      },
      signalReady: () => scene.signalReady(),
      scene
    };
  }
  
  /**
   * Build ship roster from MissionBridge + manifest data
   * @returns {Array} Ship data for flight scene
   */
  async function buildShipRoster() {
    const ships = [];
    
    // Step 5D: Get cached performance stats to determine elites
    const perfStats = await getPerfStats();
    let eliteTickers = new Set();
    
    // Determine top performers by return_1d
    if (perfStats && perfStats.stats) {
      const ranked = Object.entries(perfStats.stats)
        .map(([t, s]) => ({ ticker: t, r1d: Number(s.return_1d) }))
        .filter(o => Number.isFinite(o.r1d))
        .sort((a, b) => b.r1d - a.r1d);
      
      // Top 4 = elite (winners fly like winners)
      ranked.slice(0, 4).forEach(o => eliteTickers.add(o.ticker));
    }
    
    try {
      // Try to get manifest data
      if (window.IndicatorLoader) {
        const meta = await window.IndicatorLoader.getMetadata();
        const tickers = meta.tickers || [];
        
        // Get mission state
        const activeMissions = window.MissionBridge?.getActive() || [];
        const missionTickers = new Set(activeMissions.map(m => m.ticker));
        
        // Get support assignments
        const supportMap = new Map();
        for (const m of activeMissions) {
          if (m.support?.slots) {
            for (const slot of m.support.slots) {
              if (slot.ticker) {
                supportMap.set(slot.ticker, m.ticker);
              }
            }
          }
        }
        
        // Build roster
        for (const t of tickers) {
          if (t.status === 'LOCKED') continue; // Don't show locked tickers
          
          const ticker = t.ticker;
          
          // Step 5D: Use return_1d to bias speed (winners fly faster)
          const r = perfStats?.stats?.[ticker]?.return_1d;
          const perfBoost = Number.isFinite(r) ? Math.max(0.7, Math.min(1.4, 1 + r / 20)) : 1.0;
          
          ships.push({
            ticker,
            fit: (50 + Math.random() * 30) * perfBoost,
            threat: 20 + Math.random() * 60,
            firepower: 30 + Math.random() * 50,
            hasMission: missionTickers.has(ticker),
            isSupport: supportMap.has(ticker),
            isElite: eliteTickers.has(ticker),
            isBenchmark: t.status === 'BENCHMARK'
          });
        }
      }
    } catch (e) {
      console.warn('[FlightScene] Failed to build roster:', e);
    }
    
    // Fallback: generate generic ships
    if (ships.length === 0) {
      const defaultTickers = ['RKLB', 'LUNR', 'JOBY', 'ACHR', 'ASTS', 'GME', 'PL', 'BKSY'];
      for (const ticker of defaultTickers) {
        // Step 5D: Use return_1d even for fallback
        const r = perfStats?.stats?.[ticker]?.return_1d;
        const perfBoost = Number.isFinite(r) ? Math.max(0.7, Math.min(1.4, 1 + r / 20)) : 1.0;
        
        ships.push({
          ticker,
          fit: (50 + Math.random() * 30) * perfBoost,
          threat: 20 + Math.random() * 60,
          firepower: 30 + Math.random() * 50,
          hasMission: false,
          isSupport: false,
          isElite: eliteTickers.has(ticker),
          isBenchmark: false
        });
      }
    }
    
    // Step 8: Preload sprites for roster tickers (fixes "triangles" on loading screen)
    const tickerList = ships.map(s => s.ticker);
    await preloadSpritesForTickers(tickerList);
    
    return ships;
  }
  
  /**
   * Step 8: Preload ship sprites for given tickers
   * Ensures images are fully decoded before flight scene starts
   * @param {Array<string>} tickers - Array of ticker symbols
   */
  async function preloadSpritesForTickers(tickers) {
    const sprites = window.SHIP_SPRITES || {};
    const fallback = window.DEFAULT_SHIP_SPRITE || 'assets/ships/static/Unclaimed-Drone-ship.png';
    
    // Get unique sprite URLs
    const srcs = [...new Set(tickers.map(t => sprites[t] || fallback))];
    
    // Preload all in parallel
    await Promise.all(srcs.map(src => new Promise((resolve) => {
      // Check if already in cache and loaded
      if (SPRITE_CACHE.has(src)) {
        const cached = SPRITE_CACHE.get(src);
        if (cached.complete && cached.naturalWidth > 0) {
          resolve();
          return;
        }
      }
      
      const img = new Image();
      img.src = src;
      img.onload = () => {
        SPRITE_CACHE.set(src, img);
        resolve();
      };
      img.onerror = () => {
        // Don't block on failure, fallback will handle it
        resolve();
      };
    })));
  }
  
  /**
   * Stop all active scenes
   */
  function stopAll() {
    for (const [canvas, scene] of activeScenes) {
      scene.stop();
    }
    activeScenes.clear();
  }
  
  /**
   * Step 5: Set focus on a specific ticker's ship
   * @param {string} ticker - Ticker symbol to focus
   * @param {number} duration - Auto-clear after ms (0 = until manually cleared)
   */
  function setFocus(ticker, duration = 0) {
    focusedTicker = ticker;
    
    // Clear any existing timeout
    if (focusTimeout) {
      clearTimeout(focusTimeout);
      focusTimeout = null;
    }
    
    // Auto-clear focus after duration
    if (duration > 0) {
      focusTimeout = setTimeout(() => {
        focusedTicker = null;
        focusTimeout = null;
      }, duration);
    }
  }
  
  /**
   * Step 5: Clear focus
   */
  function clearFocus() {
    focusedTicker = null;
    if (focusTimeout) {
      clearTimeout(focusTimeout);
      focusTimeout = null;
    }
  }
  
  /**
   * Step 5: Get current focused ticker
   */
  function getFocusedTicker() {
    return focusedTicker;
  }
  
  return {
    create,
    buildShipRoster,
    stopAll,
    setFocus,
    clearFocus,
    getFocusedTicker,
    CONFIG
  };
  
})();
