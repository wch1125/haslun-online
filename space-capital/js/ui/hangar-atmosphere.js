/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SPACE CAPITAL - HANGAR ATMOSPHERE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Makes the hangar feel ALIVE with:
 * - Animated starfield background
 * - Telemetry-reactive ship ring (pulses, wobbles based on stats)
 * - Radar sweep effect
 * - Floating particles (dust motes, data fragments)
 * - Ambient light pulses
 * 
 * "The hangar is where you build attachment"
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

window.HangarAtmosphere = (function() {
  'use strict';

  // State
  let canvas = null;
  let ctx = null;
  let active = false;
  let rafId = null;
  let lastTime = 0;
  
  // Current ship data
  let currentShip = {
    ticker: null,
    thrust: 0.5,
    stability: 0.5,
    volatility: 0.3,
    signal: 0.5,
    hull: 0.8
  };

  // Particles
  const stars = [];
  const dustMotes = [];
  const dataFragments = [];
  
  // Ring state
  const ring = {
    baseRadius: 120,
    currentRadius: 120,
    pulsePhase: 0,
    wobblePhase: 0,
    rotationAngle: 0,
    segments: 64,
    glowIntensity: 0.5,
    centerX: 0,
    centerY: 0
  };

  // Update ring size based on canvas
  function updateRingSize() {
    if (!canvas) return;
    const minDim = Math.min(canvas.width, canvas.height);
    ring.baseRadius = Math.max(60, Math.min(120, minDim * 0.35));
    ring.centerX = canvas.width / 2;
    ring.centerY = canvas.height / 2 - 20;
  }
  
  // Radar sweep
  const radar = {
    angle: 0,
    speed: 0.8,
    opacity: 0.3
  };

  // Colors
  const COLORS = {
    starDim: 'rgba(100, 150, 180, 0.3)',
    starBright: 'rgba(180, 220, 255, 0.8)',
    ringBase: '#33ff99',
    ringGlow: 'rgba(51, 255, 153, 0.4)',
    radarSweep: 'rgba(51, 255, 153, 0.15)',
    dustMote: 'rgba(100, 200, 180, 0.3)',
    dataFragment: 'rgba(0, 255, 200, 0.5)',
    volatileRing: '#ff6644',
    stableRing: '#33ff99',
    warningRing: '#ffaa00'
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  function init() {
    const viewport = document.getElementById('hangar-ship-viewport');
    if (!viewport) {
      console.warn('[HangarAtmosphere] Viewport not found');
      return false;
    }

    // Create canvas if not exists
    canvas = viewport.querySelector('.atmosphere-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'atmosphere-canvas';
      canvas.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 0;
      `;
      viewport.insertBefore(canvas, viewport.firstChild);
    }

    ctx = canvas.getContext('2d');
    resizeCanvas();

    // Detect mobile for performance scaling
    const isMobile = window.innerWidth < 768 || ('ontouchstart' in window);
    
    // Initialize particles (reduced count on mobile)
    initStars(isMobile ? 40 : 80);
    initDustMotes(isMobile ? 12 : 25);
    initDataFragments(isMobile ? 4 : 8);

    // Listen for resize
    window.addEventListener('resize', resizeCanvas);

    console.log('[HangarAtmosphere] Initialized');
    return true;
  }

  function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    // Update ring size based on new canvas dimensions
    updateRingSize();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PARTICLE SYSTEMS
  // ═══════════════════════════════════════════════════════════════════════════

  function initStars(count) {
    stars.length = 0;
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random(),
        size: Math.random() * 1.5 + 0.5,
        brightness: Math.random(),
        twinkleSpeed: Math.random() * 2 + 1,
        twinklePhase: Math.random() * Math.PI * 2
      });
    }
  }

  function initDustMotes(count) {
    dustMotes.length = 0;
    for (let i = 0; i < count; i++) {
      dustMotes.push(createDustMote());
    }
  }

  function createDustMote() {
    return {
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.02,
      vy: (Math.random() - 0.5) * 0.015,
      size: Math.random() * 2 + 1,
      opacity: Math.random() * 0.3 + 0.1,
      life: Math.random()
    };
  }

  function initDataFragments(count) {
    dataFragments.length = 0;
    for (let i = 0; i < count; i++) {
      dataFragments.push(createDataFragment());
    }
  }

  function createDataFragment() {
    const angle = Math.random() * Math.PI * 2;
    const dist = ring.baseRadius + 40 + Math.random() * (ring.baseRadius * 0.5);
    return {
      angle,
      dist,
      targetDist: dist,
      char: String.fromCharCode(0x2588 + Math.floor(Math.random() * 8)), // Block chars
      opacity: 0,
      fadeIn: true,
      speed: Math.random() * 0.3 + 0.1,
      life: Math.random() * 3 + 2
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UPDATE LOOP
  // ═══════════════════════════════════════════════════════════════════════════

  function update(dt) {
    updateRing(dt);
    updateRadar(dt);
    updateStars(dt);
    updateDustMotes(dt);
    updateDataFragments(dt);
  }

  function updateRing(dt) {
    // Pulse based on thrust
    ring.pulsePhase += dt * (1.5 + currentShip.thrust * 2);
    const pulse = Math.sin(ring.pulsePhase) * (5 + currentShip.thrust * 10);
    
    // Wobble based on volatility
    ring.wobblePhase += dt * (2 + currentShip.volatility * 4);
    const wobble = Math.sin(ring.wobblePhase * 3) * currentShip.volatility * 8;
    
    ring.currentRadius = ring.baseRadius + pulse + wobble;
    
    // Rotation
    ring.rotationAngle += dt * (0.1 + currentShip.signal * 0.2);
    
    // Glow intensity from stability
    ring.glowIntensity = 0.3 + currentShip.stability * 0.5;
  }

  function updateRadar(dt) {
    radar.angle += dt * radar.speed;
    if (radar.angle > Math.PI * 2) {
      radar.angle -= Math.PI * 2;
    }
  }

  function updateStars(dt) {
    for (const star of stars) {
      star.twinklePhase += dt * star.twinkleSpeed;
    }
  }

  function updateDustMotes(dt) {
    for (let i = 0; i < dustMotes.length; i++) {
      const mote = dustMotes[i];
      
      // Apply velocity with volatility influence
      mote.x += mote.vx * (1 + currentShip.volatility);
      mote.y += mote.vy * (1 + currentShip.volatility);
      
      // Add slight drift toward ring center
      const cx = 0.5, cy = 0.45;
      const dx = cx - mote.x;
      const dy = cy - mote.y;
      mote.vx += dx * 0.0001;
      mote.vy += dy * 0.0001;
      
      // Wrap around
      if (mote.x < -0.1) mote.x = 1.1;
      if (mote.x > 1.1) mote.x = -0.1;
      if (mote.y < -0.1) mote.y = 1.1;
      if (mote.y > 1.1) mote.y = -0.1;
      
      // Life cycle
      mote.life -= dt * 0.1;
      if (mote.life <= 0) {
        dustMotes[i] = createDustMote();
      }
    }
  }

  function updateDataFragments(dt) {
    for (let i = 0; i < dataFragments.length; i++) {
      const frag = dataFragments[i];
      
      // Orbit around ring
      frag.angle += dt * frag.speed;
      
      // Fade in/out
      if (frag.fadeIn) {
        frag.opacity = Math.min(1, frag.opacity + dt * 0.5);
        if (frag.opacity >= 1) frag.fadeIn = false;
      }
      
      // Life
      frag.life -= dt;
      if (frag.life <= 0.5) {
        frag.opacity = Math.max(0, frag.opacity - dt * 2);
      }
      if (frag.life <= 0) {
        dataFragments[i] = createDataFragment();
      }
      
      // Distance pulse
      frag.dist = frag.targetDist + Math.sin(frag.angle * 2) * 5;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  function render() {
    if (!ctx || !canvas) return;
    
    const w = canvas.width;
    const h = canvas.height;
    
    ctx.clearRect(0, 0, w, h);
    
    // Background gradient
    const bgGrad = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w * 0.7);
    bgGrad.addColorStop(0, 'rgba(10, 20, 30, 0.3)');
    bgGrad.addColorStop(1, 'rgba(5, 10, 15, 0.1)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);
    
    renderStars(w, h);
    renderDustMotes(w, h);
    renderRadarSweep(w, h);
    renderRing(w, h);
    renderDataFragments(w, h);
    renderAmbientGlow(w, h);
  }

  function renderStars(w, h) {
    for (const star of stars) {
      const twinkle = (Math.sin(star.twinklePhase) + 1) / 2;
      const brightness = star.brightness * 0.5 + twinkle * 0.5;
      
      ctx.beginPath();
      ctx.arc(star.x * w, star.y * h, star.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180, 220, 255, ${brightness * 0.6})`;
      ctx.fill();
    }
  }

  function renderDustMotes(w, h) {
    for (const mote of dustMotes) {
      ctx.beginPath();
      ctx.arc(mote.x * w, mote.y * h, mote.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(100, 200, 180, ${mote.opacity * mote.life})`;
      ctx.fill();
    }
  }

  function renderRadarSweep(w, h) {
    const cx = ring.centerX || w / 2;
    const cy = ring.centerY || h / 2;
    const radius = ring.currentRadius + 50;
    
    ctx.save();
    ctx.translate(cx, cy);
    
    // Sweep gradient
    const sweepGrad = ctx.createConicGradient(radar.angle - Math.PI/2, 0, 0);
    sweepGrad.addColorStop(0, 'rgba(51, 255, 153, 0)');
    sweepGrad.addColorStop(0.1, `rgba(51, 255, 153, ${radar.opacity * currentShip.signal})`);
    sweepGrad.addColorStop(0.15, 'rgba(51, 255, 153, 0)');
    sweepGrad.addColorStop(1, 'rgba(51, 255, 153, 0)');
    
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = sweepGrad;
    ctx.fill();
    
    ctx.restore();
  }

  function renderRing(w, h) {
    const cx = ring.centerX || w / 2;
    const cy = ring.centerY || h / 2;
    const r = ring.currentRadius;
    
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ring.rotationAngle);
    
    // Determine ring color based on ship state
    let ringColor = COLORS.stableRing;
    if (currentShip.volatility > 0.7) {
      ringColor = COLORS.volatileRing;
    } else if (currentShip.hull < 0.4) {
      ringColor = COLORS.warningRing;
    }
    
    // Outer glow
    ctx.shadowColor = ringColor;
    ctx.shadowBlur = 20 * ring.glowIntensity;
    
    // Main ring
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Inner ring (slightly smaller, dimmer)
    ctx.beginPath();
    ctx.arc(0, 0, r - 8, 0, Math.PI * 2);
    ctx.strokeStyle = ringColor + '44';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Segment markers
    ctx.shadowBlur = 0;
    const segmentCount = 8;
    for (let i = 0; i < segmentCount; i++) {
      const angle = (i / segmentCount) * Math.PI * 2;
      const x1 = Math.cos(angle) * (r - 4);
      const y1 = Math.sin(angle) * (r - 4);
      const x2 = Math.cos(angle) * (r + 4);
      const y2 = Math.sin(angle) * (r + 4);
      
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = ringColor + '88';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
    // Pulsing nodes at cardinal points
    const nodePhase = ring.pulsePhase * 2;
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + ring.rotationAngle;
      const pulse = 0.5 + 0.5 * Math.sin(nodePhase + i);
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      
      ctx.beginPath();
      ctx.arc(x, y, 3 + pulse * 2, 0, Math.PI * 2);
      ctx.fillStyle = ringColor;
      ctx.shadowColor = ringColor;
      ctx.shadowBlur = 10 * pulse;
      ctx.fill();
    }
    
    ctx.restore();
  }

  function renderDataFragments(w, h) {
    const cx = ring.centerX || w / 2;
    const cy = ring.centerY || h / 2;
    
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    for (const frag of dataFragments) {
      const x = cx + Math.cos(frag.angle) * frag.dist;
      const y = cy + Math.sin(frag.angle) * frag.dist;
      
      ctx.fillStyle = `rgba(0, 255, 200, ${frag.opacity * 0.6})`;
      ctx.fillText(frag.char, x, y);
    }
  }

  function renderAmbientGlow(w, h) {
    const cx = ring.centerX || w / 2;
    const cy = ring.centerY || h / 2;
    
    // Central ambient glow
    const glowGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, ring.baseRadius * 0.8);
    const glowStrength = 0.05 + currentShip.signal * 0.1;
    glowGrad.addColorStop(0, `rgba(51, 255, 153, ${glowStrength})`);
    glowGrad.addColorStop(1, 'rgba(51, 255, 153, 0)');
    
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, w, h);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN LOOP
  // ═══════════════════════════════════════════════════════════════════════════

  function loop(now) {
    if (!active) return;
    
    const dt = Math.min(0.033, (now - lastTime) / 1000);
    lastTime = now;
    
    update(dt);
    render();
    
    rafId = requestAnimationFrame(loop);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  function start() {
    if (active) return;
    
    // Skip on battery mode or reduced motion
    if (document.body.classList.contains('battery-mode') ||
        document.body.classList.contains('reduced-motion') ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      console.log('[HangarAtmosphere] Skipped - reduced motion or battery mode');
      return false;
    }
    
    if (!canvas && !init()) {
      return false;
    }
    
    active = true;
    lastTime = performance.now();
    loop(lastTime);
    
    console.log('[HangarAtmosphere] Started');
    return true;
  }

  function stop() {
    active = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    console.log('[HangarAtmosphere] Stopped');
  }

  function setShipData(data) {
    if (!data) return;
    
    currentShip.ticker = data.ticker || currentShip.ticker;
    
    // Get telemetry if available
    if (window.ShipTelemetry?.hasData(data.ticker)) {
      const bias = window.ShipTelemetry.getPaletteBias(data.ticker);
      if (bias) {
        currentShip.thrust = bias.thrustPotential || 0.5;
        currentShip.stability = bias.maneuverStability || 0.5;
        currentShip.volatility = bias.chopSensitivity || 0.3;
        currentShip.signal = bias.macdPersistence || 0.5;
        currentShip.hull = bias.hullResilience || 0.8;
      }
    }
    
    // Direct overrides
    if (data.thrust !== undefined) currentShip.thrust = data.thrust;
    if (data.stability !== undefined) currentShip.stability = data.stability;
    if (data.volatility !== undefined) currentShip.volatility = data.volatility;
    if (data.signal !== undefined) currentShip.signal = data.signal;
    if (data.hull !== undefined) currentShip.hull = data.hull;
    
    console.log('[HangarAtmosphere] Ship data updated:', currentShip.ticker);
  }

  function setRingColor(color) {
    COLORS.stableRing = color;
    COLORS.ringBase = color;
  }

  // Visibility handling
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && active) {
      cancelAnimationFrame(rafId);
    } else if (!document.hidden && active) {
      lastTime = performance.now();
      loop(lastTime);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    init,
    start,
    stop,
    setShipData,
    setRingColor,
    isActive: () => active
  };

})();

// Auto-init when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Small delay to let other systems initialize
  setTimeout(() => {
    if (window.HangarAtmosphere) {
      window.HangarAtmosphere.start();
    }
  }, 500);
});

console.log('🌌 HangarAtmosphere module loaded');
