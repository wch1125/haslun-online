/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SPACE RUN - F-Zero 99 Style Racing Game
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * A Mode 7-style pseudo-3D racing game inspired by F-Zero 99.
 * Built for the SPACE CAPITAL trading dashboard arcade section.
 * 
 * Features:
 * - Mode 7 perspective track rendering
 * - 99 AI racers (represented as sprites)
 * - Boost mechanics tied to portfolio performance
 * - Multiple track themes
 * - Ship selection from your fleet
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

window.ParallaxRun = (function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════
  
  const CONFIG = {
    // Display
    width: 800,
    height: 500,
    
    // Road rendering
    roadWidth: 2000,        // Width of road in world units
    segmentLength: 200,     // Length of each road segment
    rumbleLength: 3,        // Segments per rumble strip
    drawDistance: 300,      // How far ahead to render
    cameraHeight: 1000,     // Camera height above road
    cameraDepth: null,      // Calculated based on FOV
    fieldOfView: 100,       // Degrees
    
    // Player
    maxSpeed: 15000,        // Max speed (units/sec)
    accel: 10000,           // Acceleration
    braking: 15000,         // Braking force
    decel: 8000,            // Natural deceleration (off-road)
    offRoadDecel: 12000,    // Deceleration when off road
    offRoadLimit: 0.4,      // Speed limit multiplier off-road
    centrifugal: 0.3,       // Centrifugal force on curves
    
    // Boost
    boostPower: 1.5,        // Speed multiplier when boosting
    boostDrain: 0.5,        // Boost meter drain per second
    boostRegen: 0.1,        // Passive boost regeneration
    
    // AI
    totalRacers: 99,
    aiSpeedVariance: 0.15,  // AI speed varies ±15%
    aiUpdateRate: 100,      // ms between AI position updates
    
    // Track
    trackLength: null,      // Calculated from segments
    laps: 3,
    
    // Colors (F-Zero 99 style)
    colors: {
      sky: { top: '#ff6b35', bottom: '#ffd93d' },  // Sunset theme
      road: { dark: '#3d3d3d', light: '#4a4a4a' },
      grass: { dark: '#2d5016', light: '#3d6b1f' },
      rumble: { dark: '#ff0000', light: '#ffffff' },
      lane: '#ffffff',
      startLine: '#ffffff',
      hazard: '#ff4400'
    }
  };
  
  // Calculate camera depth from FOV
  CONFIG.cameraDepth = 1 / Math.tan((CONFIG.fieldOfView / 2) * Math.PI / 180);

  // ═══════════════════════════════════════════════════════════════════════════
  // GAME STATE
  // ═══════════════════════════════════════════════════════════════════════════
  
  let canvas = null;
  let ctx = null;
  let gameState = 'loading'; // loading, ready, countdown, racing, finished, paused
  
  // Track data
  let segments = [];
  let trackLength = 0;
  
  // Player state
  let player = {
    x: 0,              // Position across road (-1 to 1, 0 = center)
    z: 0,              // Position along track
    speed: 0,          // Current speed
    boost: 1.0,        // Boost meter (0-1)
    boosting: false,
    lap: 1,
    position: 50,      // Race position
    lapTimes: [],
    currentLapStart: 0,
    finished: false,
    shipTicker: 'RKLB' // Selected ship
  };
  
  // AI racers
  let racers = [];
  
  // Timing
  let lastTime = 0;
  let raceTime = 0;
  let countdownTime = 0;
  
  // Input state
  let keys = {
    left: false,
    right: false,
    up: false,
    down: false,
    boost: false
  };
  
  // Animation frame
  let animationId = null;
  let isRunning = false;

  // ═══════════════════════════════════════════════════════════════════════════
  // TRACK GENERATION
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Road segment structure
   */
  function Segment(index) {
    return {
      index: index,
      p1: { world: { z: index * CONFIG.segmentLength }, camera: {}, screen: {} },
      p2: { world: { z: (index + 1) * CONFIG.segmentLength }, camera: {}, screen: {} },
      curve: 0,
      hill: 0,
      sprites: [],
      cars: [],
      color: Math.floor(index / CONFIG.rumbleLength) % 2 ? 
        { road: CONFIG.colors.road.dark, grass: CONFIG.colors.grass.dark, rumble: CONFIG.colors.rumble.dark } :
        { road: CONFIG.colors.road.light, grass: CONFIG.colors.grass.light, rumble: CONFIG.colors.rumble.light }
    };
  }
  
  /**
   * Add road segment
   */
  function addSegment(curve, hill) {
    const n = segments.length;
    const seg = Segment(n);
    seg.curve = curve;
    seg.hill = hill;
    segments.push(seg);
  }
  
  /**
   * Add straight road section
   */
  function addStraight(num = 25) {
    for (let i = 0; i < num; i++) {
      addSegment(0, 0);
    }
  }
  
  /**
   * Add curved section (easing in and out)
   */
  function addCurve(num = 25, curve = 2, hill = 0) {
    const halfNum = Math.floor(num / 2);
    // Ease in
    for (let i = 0; i < halfNum; i++) {
      addSegment(easeIn(0, curve, i / halfNum), easeIn(0, hill, i / halfNum));
    }
    // Ease out
    for (let i = 0; i < halfNum; i++) {
      addSegment(easeOut(curve, 0, i / halfNum), easeOut(hill, 0, i / halfNum));
    }
  }
  
  /**
   * Add hill section
   */
  function addHill(num = 25, height = 20) {
    const halfNum = Math.floor(num / 2);
    // Going up
    for (let i = 0; i < halfNum; i++) {
      addSegment(0, easeIn(0, height, i / halfNum));
    }
    // Going down
    for (let i = 0; i < halfNum; i++) {
      addSegment(0, easeOut(height, -height, i / halfNum));
    }
    // Level out
    for (let i = 0; i < halfNum; i++) {
      addSegment(0, easeIn(-height, 0, i / halfNum));
    }
  }
  
  /**
   * Add S-curve
   */
  function addSCurve() {
    addCurve(20, 4, 0);
    addCurve(20, -4, 0);
  }
  
  /**
   * Generate a complete track
   */
  function generateTrack(trackType = 'mute_city') {
    segments = [];
    
    // Start/finish straight
    addStraight(50);
    
    // First corner (wide right)
    addCurve(40, 3, 0);
    
    // Hill section
    addStraight(20);
    addHill(30, 30);
    
    // S-curves
    addSCurve();
    
    // Long straight (for drafting)
    addStraight(80);
    
    // Tight left hairpin
    addCurve(30, -5, 0);
    
    // Rolling hills with gentle curves
    addCurve(25, 2, 15);
    addCurve(25, -2, -10);
    
    // Another straight
    addStraight(40);
    
    // Final chicane before finish
    addCurve(15, 4, 0);
    addCurve(15, -4, 0);
    
    // Approach to start/finish
    addStraight(30);
    
    // Calculate track length
    trackLength = segments.length * CONFIG.segmentLength;
    CONFIG.trackLength = trackLength;
    
    // Mark start line
    segments[0].color.road = '#ffffff';
    segments[1].color.road = '#ffffff';
    
    console.log(`[ParallaxRun] Track generated: ${segments.length} segments, ${trackLength} units`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AI RACERS
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Initialize AI racers
   */
  function initRacers() {
    racers = [];
    
    // AI ship designs (color schemes)
    const shipColors = [
      '#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff', '#44ffff',
      '#ff8844', '#88ff44', '#4488ff', '#ff4488', '#88ff88', '#8844ff'
    ];
    
    for (let i = 0; i < CONFIG.totalRacers - 1; i++) {
      racers.push({
        x: (Math.random() * 2 - 1) * 0.8,  // Random lane position
        z: Math.random() * trackLength,      // Spread around track
        speed: CONFIG.maxSpeed * (0.85 + Math.random() * CONFIG.aiSpeedVariance * 2),
        lap: 1,
        finished: false,
        color: shipColors[i % shipColors.length],
        name: generateRacerName(),
        isEliminated: false
      });
    }
    
    // Sort by starting position
    racers.sort((a, b) => a.z - b.z);
  }
  
  /**
   * Generate random racer name
   */
  function generateRacerName() {
    const prefixes = ['Neo', 'Dark', 'Flash', 'Star', 'Zero', 'Max', 'Red', 'Blue', 'Gold', 'Iron'];
    const suffixes = ['Runner', 'Wing', 'Blaze', 'Storm', 'Hawk', 'Wolf', 'Knight', 'Ace', 'Fox', 'X'];
    return prefixes[Math.floor(Math.random() * prefixes.length)] + 
           suffixes[Math.floor(Math.random() * suffixes.length)];
  }
  
  /**
   * Update AI racer positions
   */
  function updateRacers(dt) {
    for (let i = 0; i < racers.length; i++) {
      const racer = racers[i];
      if (racer.finished || racer.isEliminated) continue;
      
      // Basic AI movement
      racer.z += racer.speed * dt;
      
      // Lap counting
      if (racer.z >= trackLength) {
        racer.z -= trackLength;
        racer.lap++;
        if (racer.lap > CONFIG.laps) {
          racer.finished = true;
        }
      }
      
      // Simple lane wandering
      racer.x += (Math.random() - 0.5) * 0.02;
      racer.x = clamp(racer.x, -0.9, 0.9);
      
      // Get current segment for curve following
      const segIndex = Math.floor(racer.z / CONFIG.segmentLength) % segments.length;
      const seg = segments[segIndex];
      
      // AI follows road curves somewhat
      if (seg.curve !== 0) {
        racer.x -= seg.curve * 0.0005 * dt * 60;
        racer.x = clamp(racer.x, -0.9, 0.9);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PLAYER CONTROLS & PHYSICS
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Update player state
   */
  function updatePlayer(dt) {
    if (gameState !== 'racing') return;
    
    const seg = findSegment(player.z);
    const speedPercent = player.speed / CONFIG.maxSpeed;
    
    // Steering
    const steerSpeed = 3.0 - (speedPercent * 1.5); // Slower steering at high speed
    if (keys.left) {
      player.x -= steerSpeed * dt;
    }
    if (keys.right) {
      player.x += steerSpeed * dt;
    }
    
    // Centrifugal force from curves
    player.x += seg.curve * speedPercent * CONFIG.centrifugal * dt;
    
    // Acceleration / Braking
    if (keys.up) {
      player.speed += CONFIG.accel * dt;
    } else if (keys.down) {
      player.speed -= CONFIG.braking * dt;
    } else {
      // Natural deceleration
      player.speed -= CONFIG.decel * dt;
    }
    
    // Boost
    if (keys.boost && player.boost > 0) {
      player.boosting = true;
      player.speed *= (1 + (CONFIG.boostPower - 1) * dt * 2);
      player.boost -= CONFIG.boostDrain * dt;
      player.boost = Math.max(0, player.boost);
    } else {
      player.boosting = false;
      // Regenerate boost slowly
      player.boost += CONFIG.boostRegen * dt;
      player.boost = Math.min(1, player.boost);
    }
    
    // Off-road penalty
    if (Math.abs(player.x) > 1) {
      player.speed -= CONFIG.offRoadDecel * dt;
      player.speed = Math.min(player.speed, CONFIG.maxSpeed * CONFIG.offRoadLimit);
    }
    
    // Speed limits
    player.speed = clamp(player.speed, 0, CONFIG.maxSpeed * (player.boosting ? CONFIG.boostPower : 1));
    
    // Position limits
    player.x = clamp(player.x, -2, 2);
    
    // Move forward
    player.z += player.speed * dt;
    
    // Lap tracking
    if (player.z >= trackLength) {
      player.z -= trackLength;
      player.lap++;
      
      // Record lap time
      const lapTime = raceTime - player.currentLapStart;
      player.lapTimes.push(lapTime);
      player.currentLapStart = raceTime;
      
      if (player.lap > CONFIG.laps) {
        player.finished = true;
        gameState = 'finished';
      }
    }
    
    // Calculate position
    updatePosition();
  }
  
  /**
   * Calculate race position
   */
  function updatePosition() {
    // Count how many racers are ahead
    let ahead = 0;
    const playerProgress = (player.lap - 1) * trackLength + player.z;
    
    for (const racer of racers) {
      if (racer.finished) {
        ahead++;
      } else {
        const racerProgress = (racer.lap - 1) * trackLength + racer.z;
        if (racerProgress > playerProgress) {
          ahead++;
        }
      }
    }
    
    player.position = ahead + 1;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDERING - Mode 7 Style
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Project world coordinates to screen
   */
  function project(p, cameraX, cameraY, cameraZ, cameraDepth, width, height, roadWidth) {
    p.camera.x = (p.world.x || 0) - cameraX;
    p.camera.y = (p.world.y || 0) - cameraY;
    p.camera.z = (p.world.z || 0) - cameraZ;
    
    p.screen.scale = cameraDepth / p.camera.z;
    p.screen.x = Math.round((width / 2) + (p.screen.scale * p.camera.x * width / 2));
    p.screen.y = Math.round((height / 2) - (p.screen.scale * p.camera.y * height / 2));
    p.screen.w = Math.round(p.screen.scale * roadWidth * width / 2);
  }
  
  /**
   * Render the road and scenery
   */
  function render() {
    // Clear canvas with sky gradient
    const skyGradient = ctx.createLinearGradient(0, 0, 0, CONFIG.height / 2);
    skyGradient.addColorStop(0, CONFIG.colors.sky.top);
    skyGradient.addColorStop(1, CONFIG.colors.sky.bottom);
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height / 2);
    
    // Ground (far grass)
    ctx.fillStyle = CONFIG.colors.grass.dark;
    ctx.fillRect(0, CONFIG.height / 2, CONFIG.width, CONFIG.height / 2);
    
    // Find base segment
    const baseSegment = findSegment(player.z);
    const basePercent = percentRemaining(player.z, CONFIG.segmentLength);
    const playerSegment = findSegment(player.z + CONFIG.cameraHeight * CONFIG.cameraDepth);
    const playerY = interpolate(playerSegment.p1.world.y || 0, playerSegment.p2.world.y || 0, percentRemaining(player.z, CONFIG.segmentLength));
    
    let maxy = CONFIG.height;
    let x = 0;
    let dx = -(baseSegment.curve * basePercent);
    
    // Render road segments back to front
    for (let n = 0; n < CONFIG.drawDistance; n++) {
      const segIndex = (baseSegment.index + n) % segments.length;
      const seg = segments[segIndex];
      const looped = segIndex < baseSegment.index;
      
      // Calculate world Y with hills
      const segY1 = seg.p1.world.y || 0;
      const segY2 = seg.p2.world.y || 0;
      
      seg.p1.world.y = segY1;
      seg.p2.world.y = segY2;
      
      // Project segment points
      project(seg.p1, 
        player.x * CONFIG.roadWidth,
        CONFIG.cameraHeight + playerY,
        player.z - (looped ? trackLength : 0),
        CONFIG.cameraDepth,
        CONFIG.width,
        CONFIG.height,
        CONFIG.roadWidth
      );
      
      project(seg.p2,
        player.x * CONFIG.roadWidth - dx,
        CONFIG.cameraHeight + playerY,
        player.z - (looped ? trackLength : 0),
        CONFIG.cameraDepth,
        CONFIG.width,
        CONFIG.height,
        CONFIG.roadWidth
      );
      
      x += dx;
      dx += seg.curve;
      
      // Clip if behind camera or beyond screen
      if (seg.p1.camera.z <= CONFIG.cameraDepth ||
          seg.p2.screen.y >= maxy ||
          seg.p2.screen.y >= seg.p1.screen.y) {
        continue;
      }
      
      // Render segment
      renderSegment(
        seg.p1.screen.x, seg.p1.screen.y, seg.p1.screen.w,
        seg.p2.screen.x, seg.p2.screen.y, seg.p2.screen.w,
        seg.color
      );
      
      maxy = seg.p2.screen.y;
    }
    
    // Render cars (sorted by distance)
    renderCars(baseSegment.index);
    
    // Render player ship
    renderPlayerShip();
    
    // Render HUD
    renderHUD();
    
    // Render game state overlays
    renderOverlays();
  }
  
  /**
   * Render a single road segment
   */
  function renderSegment(x1, y1, w1, x2, y2, w2, color) {
    // Grass
    ctx.fillStyle = color.grass;
    ctx.fillRect(0, y2, CONFIG.width, y1 - y2);
    
    // Rumble strips
    ctx.fillStyle = color.rumble;
    drawPolygon(x1 - w1 - w1/5, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 - w2/5, y2);
    drawPolygon(x1 + w1 + w1/5, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 + w2/5, y2);
    
    // Road
    ctx.fillStyle = color.road;
    drawPolygon(x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2);
    
    // Center line (dashed)
    if (color.road !== '#ffffff') { // Not start line
      ctx.fillStyle = CONFIG.colors.lane;
      const lineWidth = w1 / 30;
      drawPolygon(x1 - lineWidth, y1, x1 + lineWidth, y1, x2 + lineWidth * w2/w1, y2, x2 - lineWidth * w2/w1, y2);
    }
  }
  
  /**
   * Draw a filled polygon
   */
  function drawPolygon(x1, y1, x2, y2, x3, y3, x4, y4) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.lineTo(x4, y4);
    ctx.closePath();
    ctx.fill();
  }
  
  /**
   * Render AI cars
   */
  function renderCars(playerSegmentIndex) {
    // Collect visible cars with their projected positions
    const visibleCars = [];
    
    for (const racer of racers) {
      if (racer.finished || racer.isEliminated) continue;
      
      // Calculate distance from player
      let relZ = racer.z - player.z;
      if (relZ < -trackLength / 2) relZ += trackLength;
      if (relZ > trackLength / 2) relZ -= trackLength;
      
      // Only render if in front and within draw distance
      if (relZ > 0 && relZ < CONFIG.drawDistance * CONFIG.segmentLength) {
        const scale = CONFIG.cameraDepth / relZ;
        const screenX = CONFIG.width / 2 + scale * (racer.x - player.x) * CONFIG.roadWidth * CONFIG.width / 4;
        const screenY = CONFIG.height / 2 - scale * CONFIG.cameraHeight * CONFIG.height / 4;
        const screenW = 40 * scale;
        
        visibleCars.push({
          racer,
          screenX,
          screenY,
          screenW,
          relZ
        });
      }
    }
    
    // Sort by distance (furthest first)
    visibleCars.sort((a, b) => b.relZ - a.relZ);
    
    // Render
    for (const car of visibleCars) {
      renderCarSprite(car.screenX, car.screenY, car.screenW, car.racer.color);
    }
  }
  
  /**
   * Render a simple car sprite
   */
  function renderCarSprite(x, y, w, color) {
    const h = w * 0.6;
    
    // Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.lineTo(x - w/2, y);
    ctx.lineTo(x - w/3, y + h/4);
    ctx.lineTo(x + w/3, y + h/4);
    ctx.lineTo(x + w/2, y);
    ctx.closePath();
    ctx.fill();
    
    // Cockpit
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.ellipse(x, y - h/3, w/4, h/4, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Engine glow
    ctx.fillStyle = '#ff6600';
    ctx.beginPath();
    ctx.ellipse(x, y + h/3, w/6, h/6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  
  /**
   * Render player's ship
   */
  function renderPlayerShip() {
    const centerX = CONFIG.width / 2;
    const centerY = CONFIG.height - 80;
    const shipW = 80;
    const shipH = 50;
    
    // Determine tilt based on steering
    let tilt = 0;
    if (keys.left) tilt = -0.15;
    if (keys.right) tilt = 0.15;
    
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(tilt);
    
    // Ship body
    ctx.fillStyle = '#33ff99';
    ctx.beginPath();
    ctx.moveTo(0, -shipH);
    ctx.lineTo(-shipW/2, shipH/2);
    ctx.lineTo(-shipW/4, shipH/2);
    ctx.lineTo(0, shipH/4);
    ctx.lineTo(shipW/4, shipH/2);
    ctx.lineTo(shipW/2, shipH/2);
    ctx.closePath();
    ctx.fill();
    
    // Cockpit
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.ellipse(0, -shipH/3, shipW/4, shipH/3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Engine glow
    const glowIntensity = player.boosting ? 1.5 : 0.8 + (player.speed / CONFIG.maxSpeed) * 0.4;
    ctx.fillStyle = player.boosting ? '#ff3300' : '#ff6600';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 20 * glowIntensity;
    ctx.beginPath();
    ctx.ellipse(-shipW/4, shipH/2 + 5, 8 * glowIntensity, 12 * glowIntensity, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(shipW/4, shipH/2 + 5, 8 * glowIntensity, 12 * glowIntensity, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    ctx.restore();
  }
  
  /**
   * Render HUD elements
   */
  function renderHUD() {
    // Position badge (top left)
    ctx.fillStyle = '#000000cc';
    ctx.fillRect(10, 10, 90, 70);
    ctx.strokeStyle = '#33ff99';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, 90, 70);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Orbitron", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(player.position.toString(), 20, 55);
    
    ctx.fillStyle = '#888888';
    ctx.font = '16px "IBM Plex Mono", monospace';
    ctx.fillText('/' + CONFIG.totalRacers, 55, 55);
    
    // Lap counter
    ctx.fillStyle = '#33ff99';
    ctx.font = '14px "IBM Plex Mono", monospace';
    ctx.fillText(`LAP ${Math.min(player.lap, CONFIG.laps)}/${CONFIG.laps}`, 20, 72);
    
    // Speed (top right)
    ctx.fillStyle = '#000000cc';
    ctx.fillRect(CONFIG.width - 150, 10, 140, 60);
    ctx.strokeStyle = '#33ff99';
    ctx.strokeRect(CONFIG.width - 150, 10, 140, 60);
    
    const speed = Math.floor(player.speed / 100);
    ctx.fillStyle = '#33ff99';
    ctx.font = 'bold 28px "Orbitron", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(speed.toString(), CONFIG.width - 50, 45);
    
    ctx.fillStyle = '#888888';
    ctx.font = '12px "IBM Plex Mono", monospace';
    ctx.fillText('km/h', CONFIG.width - 20, 45);
    
    // Timer
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px "IBM Plex Mono", monospace';
    ctx.fillText(formatTime(raceTime), CONFIG.width - 20, 62);
    
    // Boost gauge (right side vertical)
    const boostBarHeight = 150;
    const boostBarX = CONFIG.width - 30;
    const boostBarY = 90;
    
    ctx.fillStyle = '#000000cc';
    ctx.fillRect(boostBarX - 10, boostBarY, 25, boostBarHeight + 10);
    ctx.strokeStyle = '#444444';
    ctx.strokeRect(boostBarX - 10, boostBarY, 25, boostBarHeight + 10);
    
    // Boost fill
    const boostFill = player.boost * boostBarHeight;
    const boostGradient = ctx.createLinearGradient(0, boostBarY + boostBarHeight, 0, boostBarY);
    boostGradient.addColorStop(0, '#00ff00');
    boostGradient.addColorStop(0.5, '#ffff00');
    boostGradient.addColorStop(1, '#ff0000');
    ctx.fillStyle = boostGradient;
    ctx.fillRect(boostBarX - 5, boostBarY + boostBarHeight - boostFill + 5, 15, boostFill);
    
    // Boost label
    ctx.fillStyle = '#888888';
    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BOOST', boostBarX + 2, boostBarY + boostBarHeight + 20);
    
    ctx.textAlign = 'left';
  }
  
  /**
   * Render game state overlays
   */
  function renderOverlays() {
    if (gameState === 'countdown') {
      const count = Math.ceil(3 - countdownTime);
      ctx.fillStyle = '#000000aa';
      ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
      
      ctx.fillStyle = count > 0 ? '#ffffff' : '#33ff99';
      ctx.font = 'bold 120px "Orbitron", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(count > 0 ? count.toString() : 'GO!', CONFIG.width / 2, CONFIG.height / 2 + 40);
      ctx.textAlign = 'left';
    }
    
    if (gameState === 'finished') {
      ctx.fillStyle = '#000000cc';
      ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
      
      ctx.fillStyle = '#33ff99';
      ctx.font = 'bold 48px "Orbitron", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('RACE COMPLETE', CONFIG.width / 2, CONFIG.height / 2 - 40);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 72px "Orbitron", sans-serif';
      ctx.fillText(`#${player.position}`, CONFIG.width / 2, CONFIG.height / 2 + 40);
      
      ctx.fillStyle = '#888888';
      ctx.font = '24px "IBM Plex Mono", monospace';
      ctx.fillText(`Total Time: ${formatTime(raceTime)}`, CONFIG.width / 2, CONFIG.height / 2 + 90);
      
      ctx.fillStyle = '#33ff99';
      ctx.font = '18px "IBM Plex Mono", monospace';
      ctx.fillText('Press SPACE to race again', CONFIG.width / 2, CONFIG.height / 2 + 140);
      ctx.textAlign = 'left';
    }
    
    if (gameState === 'ready') {
      ctx.fillStyle = '#000000cc';
      ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
      
      ctx.fillStyle = '#33ff99';
      ctx.font = 'bold 48px "Orbitron", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PARALLAX RUN', CONFIG.width / 2, CONFIG.height / 2 - 60);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = '24px "IBM Plex Mono", monospace';
      ctx.fillText(`${CONFIG.totalRacers} RACERS · ${CONFIG.laps} LAPS`, CONFIG.width / 2, CONFIG.height / 2);
      
      ctx.fillStyle = '#888888';
      ctx.font = '18px "IBM Plex Mono", monospace';
      ctx.fillText('↑/↓ Accelerate/Brake · ←/→ Steer', CONFIG.width / 2, CONFIG.height / 2 + 50);
      ctx.fillText('SHIFT = Boost', CONFIG.width / 2, CONFIG.height / 2 + 80);
      
      ctx.fillStyle = '#33ff99';
      ctx.fillText('Press SPACE to start', CONFIG.width / 2, CONFIG.height / 2 + 130);
      ctx.textAlign = 'left';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GAME LOOP
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Main game loop
   */
  function gameLoop(timestamp) {
    if (!isRunning) return;
    
    const dt = Math.min(0.05, (timestamp - lastTime) / 1000); // Cap at 50ms
    lastTime = timestamp;
    
    // Update
    update(dt);
    
    // Render
    render();
    
    // Next frame
    animationId = requestAnimationFrame(gameLoop);
  }
  
  /**
   * Update game state
   */
  function update(dt) {
    switch (gameState) {
      case 'countdown':
        countdownTime += dt;
        if (countdownTime >= 3.5) {
          gameState = 'racing';
          player.currentLapStart = 0;
          raceTime = 0;
        }
        break;
        
      case 'racing':
        raceTime += dt;
        updatePlayer(dt);
        updateRacers(dt);
        break;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INPUT HANDLING
  // ═══════════════════════════════════════════════════════════════════════════
  
  function handleKeyDown(e) {
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        keys.left = true;
        e.preventDefault();
        break;
      case 'ArrowRight':
      case 'KeyD':
        keys.right = true;
        e.preventDefault();
        break;
      case 'ArrowUp':
      case 'KeyW':
        keys.up = true;
        e.preventDefault();
        break;
      case 'ArrowDown':
      case 'KeyS':
        keys.down = true;
        e.preventDefault();
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        keys.boost = true;
        e.preventDefault();
        break;
      case 'Space':
        if (gameState === 'ready' || gameState === 'finished') {
          startRace();
        }
        e.preventDefault();
        break;
      case 'Escape':
        if (gameState === 'racing') {
          gameState = 'paused';
        } else if (gameState === 'paused') {
          gameState = 'racing';
        }
        break;
    }
  }
  
  function handleKeyUp(e) {
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        keys.left = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        keys.right = false;
        break;
      case 'ArrowUp':
      case 'KeyW':
        keys.up = false;
        break;
      case 'ArrowDown':
      case 'KeyS':
        keys.down = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        keys.boost = false;
        break;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
  
  function interpolate(a, b, percent) {
    return a + (b - a) * percent;
  }
  
  function easeIn(a, b, percent) {
    return a + (b - a) * (percent * percent);
  }
  
  function easeOut(a, b, percent) {
    return a + (b - a) * (1 - (1 - percent) * (1 - percent));
  }
  
  function easeInOut(a, b, percent) {
    return a + (b - a) * ((-Math.cos(percent * Math.PI) / 2) + 0.5);
  }
  
  function percentRemaining(n, total) {
    return (n % total) / total;
  }
  
  function findSegment(z) {
    return segments[Math.floor(z / CONFIG.segmentLength) % segments.length];
  }
  
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}'${secs.toString().padStart(2, '0')}"${ms.toString().padStart(2, '0')}`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Initialize the game
   */
  function init(canvasElement) {
    canvas = canvasElement;
    ctx = canvas.getContext('2d');
    
    // Set canvas size
    canvas.width = CONFIG.width;
    canvas.height = CONFIG.height;
    
    // Generate track
    generateTrack();
    
    // Initialize racers
    initRacers();
    
    // Set up input
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // Set initial state
    gameState = 'ready';
    
    console.log('[ParallaxRun] Initialized');
  }
  
  /**
   * Start a new race
   */
  function startRace() {
    // Reset player
    player.x = 0;
    player.z = 0;
    player.speed = 0;
    player.boost = 1.0;
    player.boosting = false;
    player.lap = 1;
    player.position = CONFIG.totalRacers;
    player.lapTimes = [];
    player.currentLapStart = 0;
    player.finished = false;
    
    // Reinitialize racers
    initRacers();
    
    // Start countdown
    countdownTime = 0;
    raceTime = 0;
    gameState = 'countdown';
    
    console.log('[ParallaxRun] Race starting...');
  }
  
  /**
   * Start the game loop
   */
  function start() {
    if (isRunning) return;
    
    isRunning = true;
    lastTime = performance.now();
    animationId = requestAnimationFrame(gameLoop);
    
    console.log('[ParallaxRun] Game loop started');
  }
  
  /**
   * Stop the game loop
   */
  function stop() {
    isRunning = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    
    console.log('[ParallaxRun] Game loop stopped');
  }
  
  /**
   * Clean up
   */
  function destroy() {
    stop();
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    canvas = null;
    ctx = null;
  }
  
  /**
   * Set theme colors
   */
  function setTheme(theme) {
    const themes = {
      mute_city: {
        sky: { top: '#1a0033', bottom: '#4a0066' },
        colors: { ...CONFIG.colors }
      },
      big_blue: {
        sky: { top: '#0066cc', bottom: '#99ccff' },
        colors: { ...CONFIG.colors, grass: { dark: '#004488', light: '#0066aa' } }
      },
      sand_ocean: {
        sky: { top: '#ff6b35', bottom: '#ffd93d' },
        colors: { ...CONFIG.colors, grass: { dark: '#c4a35a', light: '#d4b36a' } }
      },
      death_wind: {
        sky: { top: '#2d1f3d', bottom: '#5a3d6a' },
        colors: { ...CONFIG.colors }
      }
    };
    
    if (themes[theme]) {
      CONFIG.colors.sky = themes[theme].sky;
      Object.assign(CONFIG.colors, themes[theme].colors);
    }
  }
  
  return {
    init,
    start,
    stop,
    destroy,
    startRace,
    setTheme,
    getState: () => gameState,
    getPlayer: () => ({ ...player }),
    CONFIG
  };
  
})();
