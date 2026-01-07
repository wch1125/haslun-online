// =========================================================================
// SPACE RUN
// High-Speed Market Corridor Racing Game
// Inspired by F-Zero / Captain Falcon / Wipeout
// =========================================================================

(function() {
  
  // ═══════════════════════════════════════════════════════════════════
  // Training Result Reporter (Progression Integration)
  // ═══════════════════════════════════════════════════════════════════
  
  function reportTrainingResult(ticker, gameId, score, outcome) {
    if (window.PARALLAX_BUS) {
      window.PARALLAX_BUS.emit('training:result', {
        ticker: ticker,
        gameId: gameId,
        score: score,
        outcome: outcome
      });
    }
  }
  
  // =========================================================================
  // SPACE RUN - MAIN GAME
  // =========================================================================
  const ParallaxRun = {
    canvas: null,
    ctx: null,
    active: false,
    animationId: null,
    
    // Game state
    distance: 0,
    speed: 0,
    maxSpeed: 12,
    baseSpeed: 3,
    acceleration: 0.08,
    deceleration: 0.03,
    boostSpeed: 18,
    boosting: false,
    boostFuel: 100,
    boostRechargeRate: 0.3,
    boostDrainRate: 1.5,
    
    // Hull / health
    hull: 100,
    maxHull: 100,
    
    // Player position (lateral movement)
    playerX: 0, // -1 to 1 range
    playerTargetX: 0,
    playerLateralSpeed: 0.08,
    laneWidth: 0.6,
    
    // Game objects
    obstacles: [],
    boostStreams: [],
    momentumRings: [],
    stars: [],
    tunnelRings: [],
    
    // Scoring
    multiplier: 1,
    maxMultiplier: 8,
    
    // Timing
    lastObstacle: 0,
    lastBoost: 0,
    obstacleInterval: 1200,
    
    // Visual effects
    screenShake: 0,
    flashIntensity: 0,
    tunnelHue: 160, // Green-ish
    
    // Controls
    keys: {},
    
    // Stats
    bestDistance: 0,
    gamesPlayed: 0,
    
    // Selected ship
    selectedShip: 'RKLB',
    
    init() {
      this.canvas = document.getElementById('space-run-canvas');
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');
      
      // Load saved stats
      try {
        const saved = localStorage.getItem('space_run_stats');
        if (saved) {
          const data = JSON.parse(saved);
          this.bestDistance = data.bestDistance || 0;
          this.gamesPlayed = data.gamesPlayed || 0;
        }
      } catch (e) {}
      
      // Generate initial starfield
      this.generateStars();
      this.generateTunnelRings();
      
      // Event listeners
      this.handleKeyDown = (e) => {
        if (!this.active) return;
        this.keys[e.key] = true;
        
        if (e.key === 'Escape') {
          this.close();
        }
        if (e.key === ' ' || e.key === 'ArrowUp') {
          e.preventDefault();
        }
      };
      
      this.handleKeyUp = (e) => {
        this.keys[e.key] = false;
      };
      
      document.addEventListener('keydown', this.handleKeyDown);
      document.addEventListener('keyup', this.handleKeyUp);
      
      // Close button
      const closeBtn = document.getElementById('space-run-close-btn');
      if (closeBtn) {
        closeBtn.onclick = () => this.close();
      }
      
      // Mobile touch controls
      this.setupTouchControls();
    },
    
    setupTouchControls() {
      const touchLeft = document.getElementById('run-touch-left');
      const touchRight = document.getElementById('run-touch-right');
      const touchBoost = document.getElementById('run-touch-boost');
      
      if (touchLeft) {
        touchLeft.addEventListener('touchstart', (e) => {
          e.preventDefault();
          this.keys['ArrowLeft'] = true;
        });
        touchLeft.addEventListener('touchend', () => this.keys['ArrowLeft'] = false);
        touchLeft.addEventListener('touchcancel', () => this.keys['ArrowLeft'] = false);
      }
      
      if (touchRight) {
        touchRight.addEventListener('touchstart', (e) => {
          e.preventDefault();
          this.keys['ArrowRight'] = true;
        });
        touchRight.addEventListener('touchend', () => this.keys['ArrowRight'] = false);
        touchRight.addEventListener('touchcancel', () => this.keys['ArrowRight'] = false);
      }
      
      if (touchBoost) {
        touchBoost.addEventListener('touchstart', (e) => {
          e.preventDefault();
          this.keys[' '] = true;
        });
        touchBoost.addEventListener('touchend', () => this.keys[' '] = false);
        touchBoost.addEventListener('touchcancel', () => this.keys[' '] = false);
      }
      
      // Prevent scrolling
      if (this.canvas) {
        this.canvas.addEventListener('touchmove', (e) => {
          if (this.active) e.preventDefault();
        }, { passive: false });
      }
    },
    
    generateStars() {
      this.stars = [];
      for (let i = 0; i < 100; i++) {
        this.stars.push({
          x: Math.random() * 2 - 1, // -1 to 1
          y: Math.random() * 2 - 1,
          z: Math.random() * 3 + 0.5,
          size: Math.random() * 2 + 0.5
        });
      }
    },
    
    generateTunnelRings() {
      this.tunnelRings = [];
      for (let i = 0; i < 12; i++) {
        this.tunnelRings.push({
          z: i * 0.3 + 0.5,
          alpha: 0.3
        });
      }
    },
    
    start() {
      if (!this.canvas) this.init();
      
      // Get selected ship
      if (window.SpriteCache && SpriteCache.selectedPlayerShip) {
        this.selectedShip = SpriteCache.selectedPlayerShip;
      }
      
      // Reset game state
      this.distance = 0;
      this.speed = this.baseSpeed;
      this.hull = this.maxHull;
      this.playerX = 0;
      this.playerTargetX = 0;
      this.boostFuel = 100;
      this.boosting = false;
      this.multiplier = 1;
      this.obstacles = [];
      this.boostStreams = [];
      this.momentumRings = [];
      this.screenShake = 0;
      this.flashIntensity = 0;
      
      this.generateStars();
      this.generateTunnelRings();
      
      this.updateUI();
      
      // Show overlay
      const overlay = document.getElementById('space-run-overlay');
      if (overlay) {
        overlay.classList.remove('hidden');
        overlay.classList.add('active');
      }
      
      this.active = true;
      this.gamesPlayed++;
      this.saveStats();
      this.gameLoop();
      
      if (typeof logTerminal === 'function') {
        logTerminal(`SPACE RUN initialized. Ship: ${this.selectedShip}. Threading the market corridor...`);
      }
      if (window.MechSFX) {
        MechSFX.powerUp(0.3);
      }
    },
    
    close() {
      this.active = false;
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
      }
      
      const overlay = document.getElementById('space-run-overlay');
      if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => overlay.classList.add('hidden'), 300);
      }
      
      if (typeof logTerminal === 'function') {
        logTerminal(`SPACE RUN ended. Distance: ${Math.floor(this.distance)} km`);
      }
    },
    
    saveStats() {
      try {
        localStorage.setItem('space_run_stats', JSON.stringify({
          bestDistance: this.bestDistance,
          gamesPlayed: this.gamesPlayed
        }));
      } catch (e) {}
    },
    
    spawnObstacle() {
      // Volatility shards - red danger zones
      const type = Math.random();
      
      if (type < 0.5) {
        // Volatility shard
        this.obstacles.push({
          x: Math.random() * 1.4 - 0.7,
          z: 4,
          width: 0.15 + Math.random() * 0.1,
          type: 'shard',
          color: '#ff6b6b'
        });
      } else if (type < 0.75) {
        // Compression wall - horizontal barrier
        const side = Math.random() > 0.5 ? 1 : -1;
        this.obstacles.push({
          x: side * 0.4,
          z: 4,
          width: 0.5,
          type: 'wall',
          color: '#ff4757'
        });
      } else {
        // Distortion field - larger danger zone
        this.obstacles.push({
          x: Math.random() * 1.2 - 0.6,
          z: 4,
          width: 0.25,
          type: 'distortion',
          color: 'rgba(255, 107, 107, 0.6)'
        });
      }
    },
    
    spawnBoost() {
      const type = Math.random();
      
      if (type < 0.6) {
        // Momentum ring
        this.momentumRings.push({
          x: Math.random() * 1.0 - 0.5,
          z: 4,
          collected: false
        });
      } else {
        // Slipstream - green boost lane
        this.boostStreams.push({
          x: Math.random() * 0.8 - 0.4,
          z: 4,
          length: 1.5 + Math.random(),
          active: true
        });
      }
    },
    
    updateUI() {
      const distEl = document.getElementById('run-distance');
      const speedEl = document.getElementById('run-speed');
      const hullEl = document.getElementById('run-hull');
      const boostEl = document.getElementById('run-boost');
      const multEl = document.getElementById('run-multiplier');
      
      if (distEl) distEl.textContent = Math.floor(this.distance).toLocaleString();
      if (speedEl) speedEl.textContent = Math.floor(this.speed * 100);
      if (hullEl) hullEl.textContent = Math.floor(this.hull);
      if (boostEl) boostEl.textContent = Math.floor(this.boostFuel);
      if (multEl) multEl.textContent = `×${this.multiplier.toFixed(1)}`;
      
      // Update boost bar visual
      const boostBar = document.getElementById('run-boost-bar');
      if (boostBar) {
        boostBar.style.width = `${this.boostFuel}%`;
        boostBar.style.background = this.boosting ? '#ffb347' : '#33ff99';
      }
      
      // Update hull bar visual
      const hullBar = document.getElementById('run-hull-bar');
      if (hullBar) {
        hullBar.style.width = `${this.hull}%`;
        if (this.hull < 30) {
          hullBar.style.background = '#ff6b6b';
        } else if (this.hull < 60) {
          hullBar.style.background = '#ffb347';
        } else {
          hullBar.style.background = '#33ff99';
        }
      }
    },
    
    gameLoop() {
      if (!this.active) return;
      
      this.update();
      this.render();
      this.updateUI();
      
      this.animationId = requestAnimationFrame(() => this.gameLoop());
    },
    
    update() {
      // Check game over
      if (this.hull <= 0) {
        this.endGame();
        return;
      }
      
      const now = Date.now();
      
      // Lateral movement
      if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) {
        this.playerTargetX = Math.max(-1, this.playerTargetX - this.playerLateralSpeed);
      }
      if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) {
        this.playerTargetX = Math.min(1, this.playerTargetX + this.playerLateralSpeed);
      }
      
      // Smooth movement toward target
      this.playerX += (this.playerTargetX - this.playerX) * 0.15;
      
      // Boost control
      if ((this.keys[' '] || this.keys['ArrowUp']) && this.boostFuel > 0) {
        this.boosting = true;
        this.boostFuel = Math.max(0, this.boostFuel - this.boostDrainRate);
        this.speed = Math.min(this.boostSpeed, this.speed + this.acceleration * 2);
      } else {
        this.boosting = false;
        // Recharge boost
        this.boostFuel = Math.min(100, this.boostFuel + this.boostRechargeRate);
        // Gradual speed adjustment toward base
        if (this.speed > this.baseSpeed) {
          this.speed = Math.max(this.baseSpeed, this.speed - this.deceleration);
        }
      }
      
      // Increase difficulty over time
      const difficultyMod = 1 + this.distance / 10000;
      
      // Update distance
      this.distance += this.speed * 0.5;
      
      // Spawn obstacles
      if (now - this.lastObstacle > this.obstacleInterval / difficultyMod) {
        this.spawnObstacle();
        this.lastObstacle = now;
        
        // Also spawn boosts occasionally
        if (Math.random() > 0.4) {
          this.spawnBoost();
        }
      }
      
      // Move and check obstacles
      this.obstacles = this.obstacles.filter(obs => {
        obs.z -= this.speed * 0.02;
        
        // Collision check when close
        if (obs.z < 0.3 && obs.z > 0) {
          const playerWidth = 0.12;
          const obsLeft = obs.x - obs.width / 2;
          const obsRight = obs.x + obs.width / 2;
          const playerLeft = this.playerX - playerWidth;
          const playerRight = this.playerX + playerWidth;
          
          if (playerRight > obsLeft && playerLeft < obsRight) {
            // Collision!
            this.hull -= 15 + Math.floor(this.speed);
            this.multiplier = 1;
            this.screenShake = 15;
            this.flashIntensity = 0.5;
            
            if (window.MechSFX) {
              MechSFX.impact(0.3);
            }
            
            return false; // Remove obstacle
          }
        }
        
        return obs.z > -0.5;
      });
      
      // Move and check momentum rings
      this.momentumRings = this.momentumRings.filter(ring => {
        ring.z -= this.speed * 0.02;
        
        if (ring.z < 0.3 && ring.z > 0 && !ring.collected) {
          const dx = Math.abs(ring.x - this.playerX);
          if (dx < 0.2) {
            // Collected!
            ring.collected = true;
            this.multiplier = Math.min(this.maxMultiplier, this.multiplier + 0.5);
            this.speed = Math.min(this.maxSpeed, this.speed + 0.5);
            this.flashIntensity = 0.3;
            
            if (window.MechSFX) {
              MechSFX.bassHit(120, 0.15);
            }
          }
        }
        
        return ring.z > -0.5;
      });
      
      // Move and check boost streams
      this.boostStreams = this.boostStreams.filter(stream => {
        stream.z -= this.speed * 0.02;
        
        // Check if player is in stream
        if (stream.z < 0.8 && stream.z > -0.2 && stream.active) {
          const dx = Math.abs(stream.x - this.playerX);
          if (dx < 0.15) {
            // In slipstream!
            this.speed = Math.min(this.maxSpeed, this.speed + 0.1);
            this.boostFuel = Math.min(100, this.boostFuel + 0.5);
          }
        }
        
        return stream.z > -stream.length;
      });
      
      // Update tunnel rings
      this.tunnelRings.forEach(ring => {
        ring.z -= this.speed * 0.015;
        if (ring.z < 0.2) {
          ring.z += 3.6;
        }
      });
      
      // Update stars (parallax)
      this.stars.forEach(star => {
        star.z -= this.speed * 0.01 / star.z;
        if (star.z < 0.1) {
          star.x = Math.random() * 2 - 1;
          star.y = Math.random() * 2 - 1;
          star.z = 3 + Math.random();
        }
      });
      
      // Decay effects
      this.screenShake *= 0.9;
      this.flashIntensity *= 0.9;
      
      // Tunnel hue shifts based on speed
      this.tunnelHue = 160 + (this.speed / this.maxSpeed) * 40;
    },
    
    endGame() {
      this.active = false;
      
      const finalDistance = Math.floor(this.distance);
      const isNewBest = finalDistance > this.bestDistance;
      
      if (isNewBest) {
        this.bestDistance = finalDistance;
      }
      
      this.saveStats();
      
      // Show message
      const msgEl = document.getElementById('run-message');
      if (msgEl) {
        if (isNewBest) {
          msgEl.innerHTML = `<span class="run-message-title">NEW RECORD!</span><br>Distance: ${finalDistance.toLocaleString()} km`;
          msgEl.className = 'run-message success';
        } else {
          msgEl.innerHTML = `<span class="run-message-title">HULL CRITICAL</span><br>Distance: ${finalDistance.toLocaleString()} km`;
          msgEl.className = 'run-message failure';
        }
        msgEl.style.display = 'block';
      }
      
      // Report to progression
      reportTrainingResult(
        this.selectedShip,
        'space_run',
        finalDistance,
        finalDistance >= 5000 ? 'WIN' : 'LOSS'
      );
      
      // Complete mission for long runs
      if (finalDistance >= 5000 && typeof completeMission === 'function') {
        completeMission('space_run');
      }
      
      if (typeof showToast === 'function') {
        showToast(`Space Run: ${finalDistance.toLocaleString()} km!`, isNewBest ? 'alert' : 'info');
      }
      
      if (window.MechSFX) {
        if (isNewBest) {
          MechSFX.success();
        } else {
          MechSFX.impact(0.35);
        }
      }
      
      // Update arcade stats display
      const bestEl = document.getElementById('arcade-high-score');
      const playedEl = document.getElementById('arcade-games-played');
      if (bestEl) bestEl.textContent = this.bestDistance.toLocaleString();
      if (playedEl) playedEl.textContent = this.gamesPlayed;
      
      // Restart after delay
      setTimeout(() => {
        if (msgEl) msgEl.style.display = 'none';
        const overlay = document.getElementById('space-run-overlay');
        if (overlay && overlay.classList.contains('active')) {
          this.start();
        }
      }, 3500);
    },
    
    render() {
      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;
      
      // Apply screen shake
      ctx.save();
      if (this.screenShake > 0.5) {
        ctx.translate(
          (Math.random() - 0.5) * this.screenShake,
          (Math.random() - 0.5) * this.screenShake
        );
      }
      
      // Clear with dark background
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, w, h);
      
      // Draw stars (background layer)
      this.renderStars(ctx, w, h);
      
      // Draw tunnel rings
      this.renderTunnel(ctx, w, h);
      
      // Draw boost streams
      this.renderBoostStreams(ctx, w, h);
      
      // Draw obstacles
      this.renderObstacles(ctx, w, h);
      
      // Draw momentum rings
      this.renderMomentumRings(ctx, w, h);
      
      // Draw player ship
      this.renderPlayer(ctx, w, h);
      
      // Flash overlay
      if (this.flashIntensity > 0.05) {
        ctx.fillStyle = `rgba(51, 255, 153, ${this.flashIntensity * 0.3})`;
        ctx.fillRect(0, 0, w, h);
      }
      
      // Speed lines at edges
      if (this.speed > this.baseSpeed * 1.5) {
        const lineIntensity = (this.speed - this.baseSpeed) / (this.maxSpeed - this.baseSpeed);
        ctx.strokeStyle = `rgba(51, 255, 153, ${lineIntensity * 0.4})`;
        ctx.lineWidth = 2;
        
        for (let i = 0; i < 8; i++) {
          const y = Math.random() * h;
          const len = 20 + Math.random() * 60 * lineIntensity;
          
          // Left side
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(len, y + (Math.random() - 0.5) * 10);
          ctx.stroke();
          
          // Right side
          ctx.beginPath();
          ctx.moveTo(w, y);
          ctx.lineTo(w - len, y + (Math.random() - 0.5) * 10);
          ctx.stroke();
        }
      }
      
      ctx.restore();
    },
    
    renderStars(ctx, w, h) {
      const cx = w / 2;
      const cy = h / 2;
      
      this.stars.forEach(star => {
        const scale = 1 / star.z;
        const screenX = cx + star.x * w * scale * 0.5;
        const screenY = cy + star.y * h * scale * 0.5;
        const size = star.size * scale;
        
        if (screenX > 0 && screenX < w && screenY > 0 && screenY < h) {
          const alpha = Math.min(1, scale * 0.5);
          ctx.fillStyle = `rgba(51, 255, 153, ${alpha})`;
          ctx.fillRect(screenX, screenY, size, size);
        }
      });
    },
    
    renderTunnel(ctx, w, h) {
      const cx = w / 2;
      const cy = h * 0.45; // Vanishing point slightly above center
      
      // Sort rings by z (far to near)
      const sortedRings = [...this.tunnelRings].sort((a, b) => b.z - a.z);
      
      sortedRings.forEach(ring => {
        const scale = 1 / ring.z;
        const radius = 300 * scale;
        
        if (radius > 10 && radius < 1000) {
          const alpha = Math.max(0.05, Math.min(0.4, 0.3 / ring.z));
          
          ctx.strokeStyle = `hsla(${this.tunnelHue}, 100%, 60%, ${alpha})`;
          ctx.lineWidth = Math.max(1, 3 * scale);
          
          ctx.beginPath();
          ctx.ellipse(cx, cy, radius, radius * 0.6, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      });
      
      // Center perspective lines
      ctx.strokeStyle = `hsla(${this.tunnelHue}, 100%, 60%, 0.15)`;
      ctx.lineWidth = 1;
      
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(
          cx + Math.cos(angle) * w,
          cy + Math.sin(angle) * h * 0.6
        );
        ctx.stroke();
      }
    },
    
    renderObstacles(ctx, w, h) {
      const cx = w / 2;
      const cy = h * 0.45;
      
      this.obstacles.forEach(obs => {
        if (obs.z < 0.1 || obs.z > 4) return;
        
        const scale = 1 / obs.z;
        const screenX = cx + obs.x * w * scale * 0.4;
        const screenY = cy + h * 0.4 * scale;
        const obsWidth = obs.width * w * scale * 0.3;
        const obsHeight = 40 * scale;
        
        if (screenX > -100 && screenX < w + 100) {
          ctx.save();
          
          if (obs.type === 'shard') {
            // Jagged shard shape
            ctx.fillStyle = obs.color;
            ctx.shadowColor = obs.color;
            ctx.shadowBlur = 15 * scale;
            
            ctx.beginPath();
            ctx.moveTo(screenX, screenY - obsHeight);
            ctx.lineTo(screenX + obsWidth / 2, screenY);
            ctx.lineTo(screenX + obsWidth / 3, screenY + obsHeight * 0.5);
            ctx.lineTo(screenX - obsWidth / 3, screenY + obsHeight * 0.5);
            ctx.lineTo(screenX - obsWidth / 2, screenY);
            ctx.closePath();
            ctx.fill();
          } else if (obs.type === 'wall') {
            // Horizontal barrier
            ctx.fillStyle = obs.color;
            ctx.shadowColor = obs.color;
            ctx.shadowBlur = 20 * scale;
            
            ctx.fillRect(
              screenX - obsWidth / 2,
              screenY - obsHeight / 4,
              obsWidth,
              obsHeight / 2
            );
          } else {
            // Distortion field (pulsing)
            const pulse = Math.sin(Date.now() * 0.01) * 0.3 + 0.7;
            ctx.fillStyle = `rgba(255, 107, 107, ${0.4 * pulse * scale})`;
            
            ctx.beginPath();
            ctx.arc(screenX, screenY, obsWidth * 0.6, 0, Math.PI * 2);
            ctx.fill();
          }
          
          ctx.restore();
        }
      });
    },
    
    renderBoostStreams(ctx, w, h) {
      const cx = w / 2;
      const cy = h * 0.45;
      
      this.boostStreams.forEach(stream => {
        if (stream.z > 4) return;
        
        const startZ = Math.max(0.2, stream.z);
        const endZ = stream.z + stream.length;
        
        for (let z = startZ; z < endZ; z += 0.2) {
          const scale = 1 / z;
          const screenX = cx + stream.x * w * scale * 0.4;
          const screenY = cy + h * 0.4 * scale;
          const streamWidth = 25 * scale;
          
          if (screenY > 0 && screenY < h) {
            const alpha = Math.max(0.1, 0.5 / z);
            ctx.fillStyle = `rgba(51, 255, 153, ${alpha})`;
            ctx.fillRect(
              screenX - streamWidth / 2,
              screenY - 2,
              streamWidth,
              4
            );
          }
        }
      });
    },
    
    renderMomentumRings(ctx, w, h) {
      const cx = w / 2;
      const cy = h * 0.45;
      
      this.momentumRings.forEach(ring => {
        if (ring.z < 0.2 || ring.z > 4 || ring.collected) return;
        
        const scale = 1 / ring.z;
        const screenX = cx + ring.x * w * scale * 0.4;
        const screenY = cy + h * 0.4 * scale;
        const ringRadius = 30 * scale;
        
        if (screenX > 0 && screenX < w && screenY > 0 && screenY < h) {
          const pulse = Math.sin(Date.now() * 0.008) * 0.3 + 0.7;
          
          ctx.strokeStyle = `rgba(255, 179, 71, ${pulse})`;
          ctx.lineWidth = 3 * scale;
          ctx.shadowColor = '#ffb347';
          ctx.shadowBlur = 15 * scale;
          
          ctx.beginPath();
          ctx.arc(screenX, screenY, ringRadius, 0, Math.PI * 2);
          ctx.stroke();
          
          // Inner glow
          ctx.strokeStyle = `rgba(255, 220, 150, ${pulse * 0.5})`;
          ctx.lineWidth = 1.5 * scale;
          ctx.beginPath();
          ctx.arc(screenX, screenY, ringRadius * 0.6, 0, Math.PI * 2);
          ctx.stroke();
          
          ctx.shadowBlur = 0;
        }
      });
    },
    
    renderPlayer(ctx, w, h) {
      const cx = w / 2;
      const playerScreenX = cx + this.playerX * w * 0.35;
      const playerScreenY = h * 0.82;
      
      // Ship color based on selected ticker
      const shipColor = (window.tickerColors && window.tickerColors[this.selectedShip]) || '#33ff99';
      
      ctx.save();
      ctx.translate(playerScreenX, playerScreenY);
      
      // Banking effect based on movement
      const bank = (this.playerTargetX - this.playerX) * 15;
      ctx.rotate(bank * Math.PI / 180);
      
      // Engine glow (stronger when boosting)
      const glowIntensity = this.boosting ? 25 : 12;
      ctx.shadowColor = shipColor;
      ctx.shadowBlur = glowIntensity;
      
      // Try to draw sprite, fallback to procedural
      let spriteDrawn = false;
      if (window.SpriteCache && SpriteCache.loaded) {
        spriteDrawn = SpriteCache.drawOnCanvas(
          ctx,
          this.selectedShip,
          0, 0,
          1.2,
          { glow: true, glowBlur: glowIntensity, glowColor: shipColor, width: 60, height: 45 }
        );
      }
      
      if (!spriteDrawn) {
        // Procedural ship
        ctx.fillStyle = shipColor;
        ctx.beginPath();
        ctx.moveTo(0, -25);
        ctx.lineTo(-20, 15);
        ctx.lineTo(-8, 10);
        ctx.lineTo(0, 20);
        ctx.lineTo(8, 10);
        ctx.lineTo(20, 15);
        ctx.closePath();
        ctx.fill();
        
        // Cockpit
        ctx.fillStyle = `rgba(255, 255, 255, 0.3)`;
        ctx.beginPath();
        ctx.ellipse(0, -5, 5, 10, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Boost flame
      if (this.boosting && this.boostFuel > 0) {
        ctx.shadowColor = '#ffb347';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#ffb347';
        ctx.beginPath();
        ctx.moveTo(-8, 22);
        ctx.lineTo(0, 40 + Math.random() * 20);
        ctx.lineTo(8, 22);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = '#ff6b6b';
        ctx.beginPath();
        ctx.moveTo(-4, 28);
        ctx.lineTo(0, 50 + Math.random() * 15);
        ctx.lineTo(4, 28);
        ctx.closePath();
        ctx.fill();
      }
      
      ctx.restore();
      ctx.shadowBlur = 0;
    }
  };
  
  // =========================================================================
  // EXPORTS
  // =========================================================================
  
  window.ParallaxRun = ParallaxRun;
  
  // Legacy aliases (in case any code references old games)
  window.SignalInvaders = {
    start: () => {
      console.log('Signal Invaders has been retired. Launching Space Run instead.');
      ParallaxRun.start();
    }
  };
  
  window.LandingGame = {
    start: () => {
      console.log('Terrain Lander has been retired. Launching Parallax Run instead.');
      ParallaxRun.start();
    }
  };
  
})();
