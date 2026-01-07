// =========================================================================
// HASLUN-BOT MINI-GAMES
// Signal Invaders, Admin Console Trap, and Terrain Lander
// Extracted from app.js for modularity
// =========================================================================

(function() {
      // =========================================================================
      // SIGNAL INVADERS - PLAYABLE ARCADE GAME
      // =========================================================================
      const SignalInvaders = {
        canvas: null,
        ctx: null,
        active: false,
        animationId: null,
        
        // Game state
        score: 0,
        lives: 3,
        wave: 1,
        gameOver: false,
        paused: false,
        
        // Player
        player: { x: 270, y: 360, width: 26, height: 16, speed: 5 },
        
        // Game objects
        bullets: [],
        enemies: [],
        enemyBullets: [],
        particles: [],
        stars: [],
        
        // Timing
        lastEnemyShot: 0,
        enemyDirection: 1,
        enemyDropAmount: 0,
        
        // Keys
        keys: {},
        
        init() {
          this.canvas = document.getElementById('invaders-canvas');
          if (!this.canvas) return;
          this.ctx = this.canvas.getContext('2d');
          
          // Generate starfield
          this.stars = [];
          for (let i = 0; i < 50; i++) {
            this.stars.push({
              x: Math.random() * 600,
              y: Math.random() * 400,
              size: Math.random() * 1.5 + 0.5,
              alpha: Math.random() * 0.5 + 0.2
            });
          }
          
          // Event listeners
          this.handleKeyDown = (e) => {
            if (!this.active) return;
            this.keys[e.key] = true;
            if (e.key === ' ' && !this.gameOver) {
              e.preventDefault();
              this.shoot();
            }
            if (e.key === 'Escape') {
              this.close();
            }
          };
          
          this.handleKeyUp = (e) => {
            this.keys[e.key] = false;
          };
          
          document.addEventListener('keydown', this.handleKeyDown);
          document.addEventListener('keyup', this.handleKeyUp);
          
          // Close button
          const closeBtn = document.getElementById('invaders-close-btn');
          if (closeBtn) {
            closeBtn.onclick = () => this.close();
          }
          
          // Mobile touch controls
          const touchLeft = document.getElementById('touch-left');
          const touchRight = document.getElementById('touch-right');
          const touchFire = document.getElementById('touch-fire');
          
          if (touchLeft) {
            touchLeft.addEventListener('touchstart', (e) => {
              e.preventDefault();
              this.keys['ArrowLeft'] = true;
            });
            touchLeft.addEventListener('touchend', () => {
              this.keys['ArrowLeft'] = false;
            });
            touchLeft.addEventListener('touchcancel', () => {
              this.keys['ArrowLeft'] = false;
            });
          }
          
          if (touchRight) {
            touchRight.addEventListener('touchstart', (e) => {
              e.preventDefault();
              this.keys['ArrowRight'] = true;
            });
            touchRight.addEventListener('touchend', () => {
              this.keys['ArrowRight'] = false;
            });
            touchRight.addEventListener('touchcancel', () => {
              this.keys['ArrowRight'] = false;
            });
          }
          
          if (touchFire) {
            touchFire.addEventListener('touchstart', (e) => {
              e.preventDefault();
              if (!this.gameOver && this.active) {
                this.shoot();
              }
            });
          }
          
          // Prevent scrolling while playing on mobile
          this.canvas.addEventListener('touchmove', (e) => {
            if (this.active) e.preventDefault();
          }, { passive: false });
        },
        
        start() {
          if (!this.canvas) this.init();
          
          // Reset game state
          this.score = 0;
          this.lives = 3;
          this.wave = 1;
          this.gameOver = false;
          this.player.x = 270;
          this.bullets = [];
          this.enemies = [];
          this.enemyBullets = [];
          this.particles = [];
          this.enemyDirection = 1;
          
          this.spawnWave();
          this.updateUI();
          
          // Show overlay
          const overlay = document.getElementById('signal-invaders-overlay');
          if (overlay) {
            overlay.classList.remove('hidden');
            overlay.classList.add('active');
          }
          
          this.active = true;
          this.gameLoop();
          
          if (typeof logTerminal === 'function') {
            logTerminal('SIGNAL INVADERS initialized. Defend the array!');
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
          
          const overlay = document.getElementById('signal-invaders-overlay');
          if (overlay) {
            overlay.classList.remove('active');
            setTimeout(() => overlay.classList.add('hidden'), 300);
          }
          
          // Log final score
          if (typeof logTerminal === 'function') {
            logTerminal(`SIGNAL INVADERS ended. Final score: ${this.score}`);
          }
        },
        
        spawnWave() {
          this.enemies = [];
          const rows = Math.min(4 + Math.floor(this.wave / 2), 6);
          const cols = Math.min(8 + this.wave, 10);
          
          // Get available fleet tickers for enemies
          const fleetTickers = Object.keys(SHIP_SPRITES);
          
          for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
              // Assign a random fleet ship to each enemy
              const ticker = fleetTickers[Math.floor(Math.random() * fleetTickers.length)];
              const isElite = row < 2;
              
              this.enemies.push({
                x: 60 + col * 52,
                y: 40 + row * 36,
                width: 32,
                height: 24,
                type: isElite ? 'elite' : 'normal',
                ticker: ticker,
                color: tickerColors[ticker] || '#33ff99',
                points: isElite ? 30 : 10
              });
            }
          }
          
          document.getElementById('invaders-message').textContent = `WAVE ${this.wave} - HOSTILE FLEET INCOMING!`;
          setTimeout(() => {
            document.getElementById('invaders-message').textContent = '';
          }, 2000);
        },
        
        shoot() {
          if (this.bullets.length < 3) { // Max 3 bullets at once
            this.bullets.push({
              x: this.player.x + this.player.width / 2 - 2,
              y: this.player.y - 8,
              width: 4,
              height: 8
            });
            if (window.MechSFX) {
              MechSFX.weaponFire(0.1);
            }
          }
        },
        
        updateUI() {
          document.getElementById('invaders-score').textContent = this.score;
          document.getElementById('invaders-lives').textContent = '♥'.repeat(Math.max(0, this.lives));
          document.getElementById('invaders-wave').textContent = this.wave;
        },
        
        gameLoop() {
          if (!this.active) return;
          
          this.update();
          this.render();
          
          this.animationId = requestAnimationFrame(() => this.gameLoop());
        },
        
        update() {
          if (this.gameOver) return;
          
          // Player movement
          if (this.keys['ArrowLeft'] || this.keys['a']) {
            this.player.x = Math.max(10, this.player.x - this.player.speed);
          }
          if (this.keys['ArrowRight'] || this.keys['d']) {
            this.player.x = Math.min(600 - this.player.width - 10, this.player.x + this.player.speed);
          }
          
          // Update bullets
          this.bullets = this.bullets.filter(b => {
            b.y -= 7;
            return b.y > -10;
          });
          
          // Update enemy bullets
          this.enemyBullets = this.enemyBullets.filter(b => {
            b.y += 4;
            return b.y < 420;
          });
          
          // Move enemies
          let hitEdge = false;
          this.enemies.forEach(e => {
            e.x += this.enemyDirection * (1 + this.wave * 0.3);
            if (e.x < 10 || e.x > 600 - e.width - 10) hitEdge = true;
          });
          
          if (hitEdge) {
            this.enemyDirection *= -1;
            this.enemies.forEach(e => e.y += 12);
          }
          
          // Enemy shooting
          if (Date.now() - this.lastEnemyShot > Math.max(500, 2000 - this.wave * 200)) {
            const shooters = this.enemies.filter(e => 
              !this.enemies.some(other => other.x === e.x && other.y > e.y)
            );
            if (shooters.length > 0) {
              const shooter = shooters[Math.floor(Math.random() * shooters.length)];
              this.enemyBullets.push({
                x: shooter.x + shooter.width / 2 - 2,
                y: shooter.y + shooter.height,
                width: 4,
                height: 6
              });
              this.lastEnemyShot = Date.now();
            }
          }
          
          // Collision: bullets vs enemies
          this.bullets.forEach((bullet, bi) => {
            this.enemies.forEach((enemy, ei) => {
              if (this.collides(bullet, enemy)) {
                // Create particles using enemy's fleet color
                for (let i = 0; i < 10; i++) {
                  this.particles.push({
                    x: enemy.x + enemy.width / 2,
                    y: enemy.y + enemy.height / 2,
                    vx: (Math.random() - 0.5) * 8,
                    vy: (Math.random() - 0.5) * 8,
                    life: 35,
                    color: enemy.color || '#33ff99'
                  });
                }
                
                this.bullets.splice(bi, 1);
                this.enemies.splice(ei, 1);
                this.score += enemy.points || (enemy.type === 'elite' ? 30 : 10);
                this.updateUI();
                
                // Show ticker when destroyed
                if (typeof showToast === 'function' && Math.random() > 0.7) {
                  showToast(`${enemy.ticker} neutralized!`, 'info');
                }
                
                if (window.MechSFX) {
                  MechSFX.bassHit(80, 0.15);
                }
              }
            });
          });
          
          // Collision: enemy bullets vs player
          this.enemyBullets.forEach((bullet, bi) => {
            if (this.collides(bullet, this.player)) {
              this.enemyBullets.splice(bi, 1);
              this.lives--;
              this.updateUI();
              
              // Player hit particles
              for (let i = 0; i < 12; i++) {
                this.particles.push({
                  x: this.player.x + this.player.width / 2,
                  y: this.player.y + this.player.height / 2,
                  vx: (Math.random() - 0.5) * 8,
                  vy: (Math.random() - 0.5) * 8,
                  life: 40,
                  color: '#ff6b6b'
                });
              }
              
              if (window.MechSFX) {
                MechSFX.impact(0.25);
              }
              
              if (this.lives <= 0) {
                this.endGame();
              }
            }
          });
          
          // Enemy reaches bottom
          if (this.enemies.some(e => e.y > 340)) {
            this.endGame();
          }
          
          // Wave cleared
          if (this.enemies.length === 0) {
            this.wave++;
            this.spawnWave();
            this.updateUI();
            if (window.MechSFX) {
              MechSFX.success();
            }
          }
          
          // Update particles
          this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
            return p.life > 0;
          });
        },
        
        collides(a, b) {
          return a.x < b.x + b.width &&
                 a.x + a.width > b.x &&
                 a.y < b.y + b.height &&
                 a.y + a.height > b.y;
        },
        
        endGame() {
          this.gameOver = true;
          document.getElementById('invaders-message').textContent = `GAME OVER - SCORE: ${this.score}`;
          
          if (typeof showToast === 'function') {
            showToast(`Signal Invaders: ${this.score} points!`, 'info');
          }
          
          // Complete arcade mission for high score
          if (this.score >= 500 && typeof completeMission === 'function') {
            completeMission('arcade_score');
          }
          
          // Restart after delay
          setTimeout(() => {
            if (this.active) {
              this.start();
            }
          }, 3000);
        },
        
        render() {
          const ctx = this.ctx;
          ctx.clearRect(0, 0, 600, 400);
          
          // Draw starfield
          this.stars.forEach(star => {
            ctx.fillStyle = `rgba(51, 255, 153, ${star.alpha})`;
            ctx.fillRect(star.x, star.y, star.size, star.size);
          });
          
          // Draw player ship using selected sprite (with fallback)
          const playerTicker = (window.SpriteCache && SpriteCache.selectedPlayerShip) || 'RKLB';
          const playerColor = tickerColors[playerTicker] || '#33ff99';
          
          let playerDrawn = false;
          if (window.SpriteCache && SpriteCache.loaded) {
            playerDrawn = SpriteCache.drawOnCanvas(
              ctx,
              playerTicker,
              this.player.x + this.player.width / 2,
              this.player.y + this.player.height / 2,
              1.0,
              { glow: true, glowBlur: 10, glowColor: playerColor, width: 50, height: 38 }
            );
          }
          
          // Fallback to procedural ship
          if (!playerDrawn) {
            drawPixelShipOnCanvas(
              ctx, 
              'arcade_player', 
              this.player.x + this.player.width / 2, 
              this.player.y + this.player.height / 2, 
              1.8, 
              playerColor,
              { glow: true, glowBlur: 8 }
            );
          }
          
          // Draw bullets with player color
          ctx.fillStyle = playerColor;
          ctx.shadowColor = playerColor;
          ctx.shadowBlur = 6;
          this.bullets.forEach(b => {
            ctx.fillRect(b.x, b.y, b.width, b.height);
          });
          ctx.shadowBlur = 0;
          
          // Draw enemies using their assigned fleet sprites (with fallback)
          this.enemies.forEach(e => {
            let enemyDrawn = false;
            const glowIntensity = e.type === 'elite' ? 8 : 4;
            
            if (window.SpriteCache && SpriteCache.loaded && e.ticker) {
              enemyDrawn = SpriteCache.drawOnCanvas(
                ctx,
                e.ticker,
                e.x + e.width / 2,
                e.y + e.height / 2,
                0.65,
                { 
                  glow: true, 
                  glowBlur: glowIntensity, 
                  glowColor: e.color,
                  flipY: true,
                  width: 50,
                  height: 38
                }
              );
            }
            
            // Fallback to procedural
            if (!enemyDrawn) {
              const enemyPattern = e.type === 'elite' ? 'arcade_elite' : 'arcade_enemy';
              drawPixelShipOnCanvas(
                ctx,
                enemyPattern,
                e.x + e.width / 2,
                e.y + e.height / 2,
                1.4,
                e.color || '#33ff99',
                { glow: true, glowBlur: glowIntensity }
              );
            }
            
            // Elite indicator ring
            if (e.type === 'elite') {
              ctx.strokeStyle = '#ffb347';
              ctx.lineWidth = 1;
              ctx.globalAlpha = 0.5;
              ctx.beginPath();
              ctx.arc(e.x + e.width / 2, e.y + e.height / 2, 18, 0, Math.PI * 2);
              ctx.stroke();
              ctx.globalAlpha = 1;
            }
          });
          
          // Draw enemy bullets
          ctx.fillStyle = '#ff6b6b';
          ctx.shadowColor = '#ff6b6b';
          ctx.shadowBlur = 4;
          this.enemyBullets.forEach(b => {
            ctx.fillRect(b.x, b.y, b.width, b.height);
          });
          ctx.shadowBlur = 0;
          
          // Draw particles
          this.particles.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life / 40;
            ctx.fillRect(p.x, p.y, 3, 3);
          });
          ctx.globalAlpha = 1;
          
          // Game over overlay
          if (this.gameOver) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, 600, 400);
            ctx.fillStyle = '#ff6b6b';
            ctx.font = '24px Orbitron';
            ctx.textAlign = 'center';
            ctx.fillText('SIGNAL LOST', 300, 180);
            ctx.fillStyle = '#33ff99';
            ctx.font = '16px "IBM Plex Mono"';
            ctx.fillText(`Final Score: ${this.score}`, 300, 220);
            ctx.fillStyle = '#888';
            ctx.font = '12px "IBM Plex Mono"';
            ctx.fillText('Restarting...', 300, 260);
          }
        }
      };

      // Cheat code listener for multiple codes
      let cheatBuffer = '';
      document.addEventListener('keydown', (e) => {
        if (e.key.length === 1) {
          cheatBuffer += e.key.toUpperCase();
          cheatBuffer = cheatBuffer.slice(-12);
          
          if (cheatBuffer.includes('INVADER')) {
            cheatBuffer = '';
            SignalInvaders.start();
          }
          
          if (cheatBuffer.includes('LAND')) {
            cheatBuffer = '';
            LandingGame.start();
          }
          
          if (cheatBuffer.includes('ADMIN')) {
            cheatBuffer = '';
            AdminConsole.open();
          }
        }
      });

      // =========================================================================
      // ADMIN CONSOLE - Snoop Trap System
      // =========================================================================
      const AdminConsole = {
        overlay: null,
        attempts: 0,
        snoopCounts: {},
        
        RESPONSES: [
          "ACCESS DENIED: This cockpit runs on story mode only.",
          "AUTH CORE: Incorrect. Impressively committed, but still incorrect.",
          "SYSTEM: We cross-checked that password against seven parallel universes. No luck.",
          "NOTE: If this actually logged in, several lawyers would materialize instantly.",
          "SECURITY: At this point we're evaluating *you*, not the password.",
          "FOURTH WALL: There is no version of reality where guessing this works.",
          "CONCLUSION: The only winning move is to appreciate the UI and move on.",
          "SYSTEM: We admire your persistence. It changes nothing.",
          "AUTH: Even the raccoons running this server are impressed. Still no.",
          "FINAL: This field has rejected credentials from 47 dimensions. Yours included."
        ],
        
        SNOOP_MESSAGES: {
          buy: [
            "TRADE BLOCKED: This cockpit runs on vibes, not orders.",
            "SYSTEM: You don't actually think this connects to a broker, right?",
            "RISK ENGINE: Nice enthusiasm. Still can't buy anything here.",
            "ALERT: Excessive button pressing detected. Consider a demo account."
          ],
          sell: [
            "LIQUIDATION ERROR: Emotional damage cannot be realized as gains.",
            "SYSTEM: Nothing to sell. This is a diorama, not a brokerage.",
            "RISK ENGINE: Imagine if this worked. SEC shows up, everyone cries.",
            "NOTE: The 'SELL' button is legally ornamental."
          ],
          withdraw: [
            "WITHDRAWAL FAILED: Funds are imaginary. The attachment is real.",
            "BANK: We regret to inform you this ATM dispenses only vibes.",
            "SYSTEM: Request forwarded to the Department of Wishful Thinking."
          ],
          leverage: [
            "MARGIN CALL: You can't lever up on pretend positions.",
            "RISK CORE: The only thing getting leveraged here is your curiosity.",
            "SYSTEM: 10x leverage on zero is still zero. Math is brutal."
          ],
          override: [
            "OVERRIDE REJECTED: You are Mission Guest, not Mission Control.",
            "SYSTEM: Override codes are stored in a vault made of pure fiction.",
            "AUTH: The override button is connected to a very convincing LED."
          ],
          default: [
            "INPUT IGNORED: This section is for narrative purposes only.",
            "SYSTEM: You've discovered a prop. Congratulations, stagehand.",
            "FOURTH WALL: Hi, yes, I can see you clicking that."
          ]
        },
        
        init() {
          this.overlay = document.getElementById('admin-overlay');
          if (!this.overlay) return;
          
          const closeBtn = document.getElementById('admin-close');
          const submitBtn = document.getElementById('admin-submit');
          const passInput = document.getElementById('admin-pass');
          const userInput = document.getElementById('admin-user');
          
          if (closeBtn) closeBtn.onclick = () => this.close();
          if (submitBtn) submitBtn.onclick = () => this.attemptLogin();
          if (passInput) passInput.onkeydown = (e) => { if (e.key === 'Enter') this.attemptLogin(); };
          if (userInput) userInput.onkeydown = (e) => { if (e.key === 'Enter') passInput.focus(); };
          
          this.overlay.onclick = (e) => {
            if (e.target === this.overlay || e.target.classList.contains('admin-backdrop')) {
              this.close();
            }
          };
          
          document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.overlay.classList.contains('visible')) {
              this.close();
            }
          });
          
          // Hook dummy controls
          this.initSnoopTraps();
        },
        
        initSnoopTraps() {
          document.querySelectorAll('.dummy-control').forEach(el => {
            el.addEventListener('click', (e) => {
              e.preventDefault();
              const action = el.dataset.dummyAction || 'default';
              
              if (action === 'admin' || action === 'override') {
                this.open();
              } else {
                this.showSnoopMessage(action);
              }
            });
          });
        },
        
        showSnoopMessage(action) {
          const messages = this.SNOOP_MESSAGES[action] || this.SNOOP_MESSAGES.default;
          const count = this.snoopCounts[action] || 0;
          this.snoopCounts[action] = count + 1;
          
          const msg = count < messages.length ? messages[count] : messages[Math.floor(Math.random() * messages.length)];
          
          if (typeof showToast === 'function') {
            showToast(msg, 'warn');
          }
          if (typeof logTerminal === 'function') {
            logTerminal('snoop trap • ' + action.toUpperCase());
          }
          if (window.MechSFX) {
            MechSFX.alert(300, 150, 0.15);
          }
          
          // Glitch effect on repeated attempts
          if (count >= 3) {
            document.body.classList.add('screen-glitch');
            setTimeout(() => document.body.classList.remove('screen-glitch'), 200);
          }
        },
        
        open() {
          if (!this.overlay) return;
          this.attempts = 0;
          
          this.overlay.classList.remove('hidden');
          setTimeout(() => this.overlay.classList.add('visible'), 10);
          
          const textEl = document.getElementById('admin-text');
          if (textEl) {
            textEl.innerHTML = 'Unauthorized console access attempt detected.<br>Please authenticate to continue ruining the narrative.';
          }
          
          const userInput = document.getElementById('admin-user');
          const passInput = document.getElementById('admin-pass');
          if (userInput) userInput.value = '';
          if (passInput) passInput.value = '';
          
          setTimeout(() => userInput?.focus(), 100);
          
          if (typeof logTerminal === 'function') {
            logTerminal('security: admin console probe detected');
          }
        },
        
        close() {
          if (!this.overlay) return;
          this.overlay.classList.remove('visible');
          setTimeout(() => this.overlay.classList.add('hidden'), 250);
        },
        
        attemptLogin() {
          const userInput = document.getElementById('admin-user');
          const passInput = document.getElementById('admin-pass');
          const textEl = document.getElementById('admin-text');
          const windowEl = this.overlay.querySelector('.admin-window');
          
          const user = userInput?.value.trim() || 'GUEST';
          const pass = passInput?.value.trim() || '••••••';
          
          const response = this.attempts < this.RESPONSES.length 
            ? this.RESPONSES[this.attempts] 
            : this.RESPONSES[Math.floor(Math.random() * this.RESPONSES.length)];
          
          this.attempts++;
          
          if (textEl) {
            textEl.innerHTML = `
              <span class="warning">USER:</span> ${user}<br>
              <span class="warning">INPUT:</span> "${pass}"<br><br>
              <span class="error">${response}</span>
            `;
          }
          
          // Shake effect
          if (windowEl) {
            windowEl.classList.add('shake');
            setTimeout(() => windowEl.classList.remove('shake'), 300);
          }
          
          if (typeof showToast === 'function') {
            showToast(response, 'alert');
          }
          if (typeof logTerminal === 'function') {
            logTerminal(`auth attempt #${this.attempts} • user=${user}`);
          }
          if (window.MechSFX) {
            MechSFX.error();
          }
          
          // Easter egg at attempt 5
          if (this.attempts === 5 && typeof completeMission === 'function') {
            completeMission('snoop_master');
          }
        }
      };
      
      window.AdminConsole = AdminConsole;

      window.SignalInvaders = SignalInvaders;

      // =========================================================================
      // TERRAIN LANDER - Chart Landing Mini-Game
      // =========================================================================
      const LandingGame = {
        canvas: null,
        ctx: null,
        active: false,
        animationId: null,
        
        // Ship state
        ship: { x: 100, y: 50, vx: 0, vy: 0, fuel: 100, landed: false, crashed: false },
        
        // Physics
        gravity: 0.02,
        thrust: 0.08,
        maxLandingSpeed: 1.5,
        
        // Terrain (generated from "price data")
        terrain: [],
        stars: [],
        
        // Controls
        keys: {},
        
        init() {
          this.canvas = document.getElementById('landing-canvas');
          if (!this.canvas) return;
          
          this.ctx = this.canvas.getContext('2d');
          this.resizeCanvas();
          
          window.addEventListener('resize', () => this.resizeCanvas());
          
          // Keyboard controls
          document.addEventListener('keydown', (e) => {
            if (!this.active) return;
            this.keys[e.key] = true;
            if (e.key === 'Escape') this.close();
          });
          
          document.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
          });
          
          // Close button
          const closeBtn = document.getElementById('landing-close');
          if (closeBtn) closeBtn.onclick = () => this.close();
          
          // Touch controls
          this.initTouchControls();
          
          // Generate starfield
          this.generateStars();
        },
        
        initTouchControls() {
          const leftBtn = document.getElementById('land-touch-left');
          const rightBtn = document.getElementById('land-touch-right');
          const thrustBtn = document.getElementById('land-touch-thrust');
          
          if (leftBtn) {
            leftBtn.ontouchstart = (e) => { e.preventDefault(); this.keys['ArrowLeft'] = true; };
            leftBtn.ontouchend = () => { this.keys['ArrowLeft'] = false; };
          }
          if (rightBtn) {
            rightBtn.ontouchstart = (e) => { e.preventDefault(); this.keys['ArrowRight'] = true; };
            rightBtn.ontouchend = () => { this.keys['ArrowRight'] = false; };
          }
          if (thrustBtn) {
            thrustBtn.ontouchstart = (e) => { e.preventDefault(); this.keys['ArrowUp'] = true; };
            thrustBtn.ontouchend = () => { this.keys['ArrowUp'] = false; };
          }
        },
        
        resizeCanvas() {
          if (!this.canvas) return;
          const container = this.canvas.parentElement;
          // Get actual container width, fallback to reasonable default
          const containerWidth = container?.clientWidth || 800;
          // Set canvas intrinsic dimensions to match CSS
          this.canvas.width = Math.max(containerWidth, 400);
          this.canvas.height = 400;
          // Regenerate terrain for new width
          if (this.active && this.terrain.length > 0) {
            this.generateTerrain();
          }
        },
        
        generateStars() {
          this.stars = [];
          const w = this.canvas?.width || 800;
          for (let i = 0; i < 80; i++) {
            this.stars.push({
              x: Math.random() * w,
              y: Math.random() * 400,
              size: Math.random() * 1.5 + 0.5,
              alpha: Math.random() * 0.6 + 0.2,
              twinkle: Math.random() * 0.02
            });
          }
        },
        
        generateTerrain() {
          this.terrain = [];
          const w = this.canvas?.width || 800;
          const h = this.canvas?.height || 400;
          const segments = 60;
          
          // Generate mountainous terrain with flat landing zones
          let y = h * 0.6;
          for (let i = 0; i <= segments; i++) {
            const x = (i / segments) * w;
            
            // Add some randomness but keep landing zones flat
            const isLandingZone = (i > 15 && i < 20) || (i > 35 && i < 42) || (i > 50 && i < 55);
            
            if (isLandingZone) {
              y = y; // Keep flat
            } else {
              y += (Math.random() - 0.5) * 40;
              y = Math.max(h * 0.4, Math.min(h * 0.85, y));
            }
            
            this.terrain.push({ x, y, isLanding: isLandingZone });
          }
        },
        
        start() {
          if (!this.canvas) this.init();
          
          // Ensure canvas is properly sized before starting
          this.resizeCanvas();
          this.generateStars();
          
          // Reset ship
          this.ship = {
            x: 80,
            y: 40,
            vx: 0.5,
            vy: 0,
            fuel: 100,
            landed: false,
            crashed: false
          };
          
          this.generateTerrain();
          this.updateUI();
          
          // Show overlay
          const overlay = document.getElementById('landing-game-overlay');
          if (overlay) overlay.classList.add('active');
          
          const msgEl = document.getElementById('landing-message');
          if (msgEl) {
            msgEl.textContent = 'Land gently on flat terrain zones!';
            msgEl.className = 'landing-message';
          }
          
          this.active = true;
          this.gameLoop();
          
          if (typeof logTerminal === 'function') {
            logTerminal('TERRAIN LANDER initialized. Good luck, pilot.');
          }
          if (window.MechSFX) {
            MechSFX.powerUp(0.2);
          }
        },
        
        close() {
          this.active = false;
          if (this.animationId) cancelAnimationFrame(this.animationId);
          
          const overlay = document.getElementById('landing-game-overlay');
          if (overlay) overlay.classList.remove('active');
        },
        
        updateUI() {
          const fuelEl = document.getElementById('landing-fuel');
          const velEl = document.getElementById('landing-velocity');
          const altEl = document.getElementById('landing-alt');
          
          if (fuelEl && this.ship) fuelEl.textContent = Math.round(this.ship.fuel || 0);
          if (velEl && this.ship) velEl.textContent = Math.abs(this.ship.vy || 0).toFixed(1);
          if (altEl && this.ship && this.canvas && this.terrain && this.terrain.length > 0) {
            const groundY = this.getTerrainY(this.ship.x);
            const alt = Math.max(0, Math.round((groundY || 0) - (this.ship.y || 0) - 10));
            altEl.textContent = isNaN(alt) ? '0' : alt;
          } else if (altEl) {
            altEl.textContent = '0';
          }
        },
        
        getTerrainY(x) {
          if (!this.terrain || this.terrain.length < 2 || !this.canvas) return 100;
          
          const w = this.canvas.width || 400;
          if (w === 0) return 100;
          const idx = ((x || 0) / w) * (this.terrain.length - 1);
          const i = Math.floor(idx);
          const t = idx - i;
          
          const p1 = this.terrain[Math.max(0, Math.min(i, this.terrain.length - 1))];
          const p2 = this.terrain[Math.max(0, Math.min(i + 1, this.terrain.length - 1))];
          
          return p1.y + (p2.y - p1.y) * t;
        },
        
        isLandingZone(x) {
          const w = this.canvas.width;
          const idx = Math.floor((x / w) * (this.terrain.length - 1));
          const point = this.terrain[Math.max(0, Math.min(idx, this.terrain.length - 1))];
          return point?.isLanding || false;
        },
        
        gameLoop() {
          if (!this.active) return;
          
          this.update();
          this.render();
          this.updateUI();
          
          this.animationId = requestAnimationFrame(() => this.gameLoop());
        },
        
        update() {
          if (this.ship.landed || this.ship.crashed) return;
          
          const ship = this.ship;
          
          // Apply gravity
          ship.vy += this.gravity;
          
          // Controls
          if (this.keys['ArrowUp'] && ship.fuel > 0) {
            ship.vy -= this.thrust;
            ship.fuel -= 0.3;
          }
          if (this.keys['ArrowLeft']) ship.vx -= 0.03;
          if (this.keys['ArrowRight']) ship.vx += 0.03;
          
          // Apply velocity
          ship.x += ship.vx;
          ship.y += ship.vy;
          
          // Bounds
          ship.x = Math.max(10, Math.min(this.canvas.width - 10, ship.x));
          if (ship.y < 5) {
            ship.y = 5;
            ship.vy = 0;
          }
          
          // Terrain collision
          const groundY = this.getTerrainY(ship.x);
          if (ship.y + 12 >= groundY) {
            const speed = Math.abs(ship.vy);
            const isFlat = this.isLandingZone(ship.x);
            
            if (speed < this.maxLandingSpeed && isFlat) {
              // Successful landing!
              ship.landed = true;
              ship.y = groundY - 12;
              this.onLand(true);
            } else {
              // Crash!
              ship.crashed = true;
              this.onLand(false);
            }
          }
        },
        
        onLand(success) {
          const msgEl = document.getElementById('landing-message');
          
          if (success) {
            if (msgEl) {
              msgEl.textContent = '✓ SOFT LANDING — DATA SECURED';
              msgEl.className = 'landing-message success';
            }
            if (typeof showToast === 'function') {
              showToast('Perfect landing! The terrain is yours.', 'alert');
            }
            if (typeof completeMission === 'function') {
              completeMission('terrain_lander');
            }
            if (window.MechSFX) {
              MechSFX.success();
            }
          } else {
            if (msgEl) {
              msgEl.textContent = '✗ CRASH — VOLATILITY TOO HIGH';
              msgEl.className = 'landing-message failure';
            }
            if (window.MechSFX) {
              MechSFX.impact(0.35);
            }
          }
          
          if (typeof logTerminal === 'function') {
            logTerminal(success ? 'Terrain Lander: successful touchdown!' : 'Terrain Lander: impact detected');
          }
          
          // Restart after delay
          setTimeout(() => {
            if (this.active) this.start();
          }, 2500);
        },
        
        render() {
          const ctx = this.ctx;
          const w = this.canvas.width;
          const h = this.canvas.height;
          
          ctx.clearRect(0, 0, w, h);
          
          // Draw stars with twinkle
          this.stars.forEach(star => {
            star.alpha += star.twinkle;
            if (star.alpha > 0.8 || star.alpha < 0.2) star.twinkle *= -1;
            ctx.fillStyle = `rgba(51, 255, 153, ${star.alpha})`;
            ctx.fillRect(star.x % w, star.y, star.size, star.size);
          });
          
          // Draw terrain
          ctx.beginPath();
          ctx.moveTo(0, h);
          this.terrain.forEach((p, i) => {
            if (i === 0) ctx.lineTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          });
          ctx.lineTo(w, h);
          ctx.closePath();
          
          // Terrain gradient
          const terrainGrad = ctx.createLinearGradient(0, h * 0.5, 0, h);
          terrainGrad.addColorStop(0, 'rgba(51, 255, 153, 0.3)');
          terrainGrad.addColorStop(1, 'rgba(51, 255, 153, 0.1)');
          ctx.fillStyle = terrainGrad;
          ctx.fill();
          
          // Terrain line
          ctx.beginPath();
          this.terrain.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          });
          ctx.strokeStyle = '#33ff99';
          ctx.lineWidth = 2;
          ctx.shadowColor = '#33ff99';
          ctx.shadowBlur = 8;
          ctx.stroke();
          ctx.shadowBlur = 0;
          
          // Highlight landing zones
          this.terrain.forEach((p, i) => {
            if (p.isLanding && i > 0) {
              ctx.beginPath();
              ctx.moveTo(this.terrain[i-1].x, this.terrain[i-1].y);
              ctx.lineTo(p.x, p.y);
              ctx.strokeStyle = '#ffb347';
              ctx.lineWidth = 3;
              ctx.stroke();
            }
          });
          
          // Draw ship
          const ship = this.ship;
          ctx.save();
          ctx.translate(ship.x, ship.y);
          
          if (ship.crashed) {
            // Explosion particles
            const crashColor = tickerColors[SpriteCache?.selectedPlayerShip] || '#ff6b6b';
            ctx.fillStyle = crashColor;
            for (let i = 0; i < 12; i++) {
              const angle = (i / 12) * Math.PI * 2;
              const dist = 10 + Math.random() * 20;
              ctx.fillRect(
                Math.cos(angle) * dist - 2,
                Math.sin(angle) * dist - 2,
                4, 4
              );
            }
          } else {
            // Try to draw sprite, fallback to simple shape if not loaded
            const landerTicker = (window.SpriteCache && SpriteCache.selectedPlayerShip) || 'LUNR';
            const landerColor = tickerColors[landerTicker] || '#33ff99';
            
            let spriteDrawn = false;
            if (window.SpriteCache && SpriteCache.loaded) {
              spriteDrawn = SpriteCache.drawOnCanvas(ctx, landerTicker, 0, 0, 0.8, { 
                glow: true, 
                glowBlur: 12, 
                glowColor: landerColor,
                width: 50,
                height: 38
              });
            }
            
            // Fallback to simple triangle ship if sprite not available
            if (!spriteDrawn) {
              ctx.fillStyle = landerColor;
              ctx.shadowColor = landerColor;
              ctx.shadowBlur = 10;
              ctx.beginPath();
              ctx.moveTo(0, -15);
              ctx.lineTo(-12, 12);
              ctx.lineTo(12, 12);
              ctx.closePath();
              ctx.fill();
              ctx.shadowBlur = 0;
            }
            
            // Thrust flame
            if (this.keys['ArrowUp'] && ship.fuel > 0) {
              ctx.fillStyle = '#ffb347';
              ctx.shadowColor = '#ffb347';
              ctx.shadowBlur = 10;
              ctx.fillRect(-5, 14, 10, 6 + Math.random() * 8);
              ctx.fillStyle = '#ff6b6b';
              ctx.fillRect(-3, 20, 6, 4 + Math.random() * 6);
              ctx.shadowBlur = 0;
            }
          }
          
          ctx.restore();
          
          // HUD overlay
          ctx.fillStyle = 'rgba(51, 255, 153, 0.6)';
          ctx.font = '10px "IBM Plex Mono", monospace';
          ctx.fillText('LANDING ZONES', 10, 20);
          ctx.fillStyle = '#ffb347';
          ctx.fillRect(100, 14, 30, 3);
        }
      };
      
      window.LandingGame = LandingGame;
})();
