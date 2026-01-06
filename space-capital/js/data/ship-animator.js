// =========================================================================
// SHIP ANIMATOR — Animated sprite system for HASLUN-BOT fleet
// Drop-in module that works alongside ship-data.js
// =========================================================================

(function() {
  'use strict';

  // =========================================================================
  // CONFIGURATION
  // =========================================================================
  const CONFIG = {
    basePath: 'assets/ships/animated',
    staticPath: 'assets/ships',
    defaultFPS: 8,
    animations: {
      idle:    { frames: 8,  fps: 8,  loop: true },
      thrust:  { frames: 6,  fps: 10, loop: true },
      pulse:   { frames: 12, fps: 8,  loop: true },
      shield:  { frames: 8,  fps: 6,  loop: true },
      charge:  { frames: 10, fps: 8,  loop: false },
      drone:   { frames: 16, fps: 6,  loop: true },
      refuel:  { frames: 12, fps: 8,  loop: false },
      special: { frames: 8,  fps: 8,  loop: true }
    }
  };

  // =========================================================================
  // SHIP ANIMATION MANIFEST
  // Maps tickers to their animation capabilities and special effects
  // =========================================================================
  const SHIP_ANIMATIONS = {
    ACHR:      { class: 'eVTOL',          special: 'vtol_hover',      hasAnimations: true },
    ASTS:      { class: 'Communications', special: 'signal_pulse',    hasAnimations: true },
    BKSY:      { class: 'Recon',          special: 'stealth_shimmer', hasAnimations: true },
    COHR:      { class: 'Reflector',      special: 'crystal_refract', hasAnimations: true },
    EVEX:      { class: 'Transport',      special: 'cargo_pulse',     hasAnimations: true },
    GE:        { class: 'Stealth',        special: 'afterburner',     hasAnimations: true },
    GME:       { class: 'Moonshot',       special: 'rocket_boost',    hasAnimations: true },
    JOBY:      { class: 'Light-eVTOL',    special: 'rotor_spin',      hasAnimations: true },
    KTOS:      { class: 'Fighter',        special: 'weapon_glow',     hasAnimations: true },
    LHX:       { class: 'Drone',          special: 'swarm_pulse',     hasAnimations: true },
    LUNR:      { class: 'Lander',         special: 'landing_jets',    hasAnimations: true },
    PL:        { class: 'Scout',          special: 'sensor_sweep',    hasAnimations: true },
    RDW:       { class: 'Hauler',         special: 'tractor_beam',    hasAnimations: true },
    RKLB:      { class: 'Flagship',       special: 'command_aura',    hasAnimations: true },
    RTX:       { class: 'Officer',        special: 'rank_insignia',   hasAnimations: true },
    Unclaimed: { class: 'Drone',          special: 'idle_drift',      hasAnimations: true }
  };

  // =========================================================================
  // SHIP ANIMATOR CLASS
  // =========================================================================
  class ShipAnimator {
    constructor(ticker, containerOrId, options = {}) {
      this.ticker = ticker.toUpperCase();
      this.container = typeof containerOrId === 'string' 
        ? document.getElementById(containerOrId) 
        : containerOrId;
      
      this.options = {
        autoplay: true,
        defaultAnimation: 'idle',
        useStaticFallback: true,
        preloadAll: false,
        ...options
      };

      this.currentAnimation = null;
      this.frameIndex = 0;
      this.interval = null;
      this.preloadedFrames = {};
      this.img = null;
      this.isPlaying = false;

      this._init();
    }

    _init() {
      // Create or find image element
      this.img = this.container.querySelector('img.ship-sprite');
      if (!this.img) {
        this.img = document.createElement('img');
        this.img.className = 'ship-sprite';
        this.img.style.imageRendering = 'pixelated';
        this.img.style.imageRendering = 'crisp-edges';
        this.img.alt = `${this.ticker} ship`;
        this.container.appendChild(this.img);
      }

      // Check if animations are available for this ticker
      const shipData = SHIP_ANIMATIONS[this.ticker];
      if (!shipData?.hasAnimations) {
        this._loadStaticFallback();
        return;
      }

      // Preload if requested
      if (this.options.preloadAll) {
        this._preloadAllAnimations();
      }

      // Start default animation
      if (this.options.autoplay) {
        this.play(this.options.defaultAnimation);
      }
    }

    // -------------------------------------------------------------------------
    // Path Helpers
    // -------------------------------------------------------------------------
    _getFramePath(animation, frameNum) {
      const paddedFrame = String(frameNum).padStart(2, '0');
      return `${CONFIG.basePath}/${this.ticker}/${animation}/${this.ticker}_${animation}_${paddedFrame}.png`;
    }

    _getStaticPath() {
      // Use window.SHIP_SPRITES if available (from ship-data.js)
      if (window.SHIP_SPRITES && window.SHIP_SPRITES[this.ticker]) {
        return window.SHIP_SPRITES[this.ticker];
      }
      return window.DEFAULT_SHIP_SPRITE || `${CONFIG.staticPath}/Unclaimed-Drone-ship.png`;
    }

    _getGifPath(animation) {
      return `${CONFIG.basePath}/gifs/${this.ticker}_${animation}.gif`;
    }

    // -------------------------------------------------------------------------
    // Preloading
    // -------------------------------------------------------------------------
    _preloadAnimation(animation) {
      return new Promise((resolve) => {
        const animConfig = CONFIG.animations[animation];
        if (!animConfig) {
          resolve([]);
          return;
        }

        const frames = [];
        let loaded = 0;
        const total = animConfig.frames;

        for (let i = 0; i < total; i++) {
          const img = new Image();
          img.onload = () => {
            loaded++;
            if (loaded === total) {
              this.preloadedFrames[animation] = frames;
              resolve(frames);
            }
          };
          img.onerror = () => {
            loaded++;
            if (loaded === total) resolve(frames);
          };
          img.src = this._getFramePath(animation, i);
          frames.push(img);
        }
      });
    }

    _preloadAllAnimations() {
      const animations = Object.keys(CONFIG.animations);
      return Promise.all(animations.map(anim => this._preloadAnimation(anim)));
    }

    _loadStaticFallback() {
      this.img.src = this._getStaticPath();
    }

    // -------------------------------------------------------------------------
    // Playback Control
    // -------------------------------------------------------------------------
    play(animation = 'idle', options = {}) {
      const animConfig = CONFIG.animations[animation];
      if (!animConfig) {
        console.warn(`Unknown animation: ${animation}`);
        return this;
      }

      this.stop();
      this.currentAnimation = animation;
      this.frameIndex = 0;
      this.isPlaying = true;

      const fps = options.fps || animConfig.fps || CONFIG.defaultFPS;
      const frameDelay = 1000 / fps;

      // Update frame immediately
      this._updateFrame();

      // Start animation loop
      this.interval = setInterval(() => {
        this.frameIndex++;
        
        if (this.frameIndex >= animConfig.frames) {
          if (animConfig.loop) {
            this.frameIndex = 0;
          } else {
            this.stop();
            if (options.onComplete) options.onComplete();
            // Return to idle after non-looping animation
            if (animation !== 'idle') {
              this.play('idle');
            }
            return;
          }
        }

        this._updateFrame();
      }, frameDelay);

      return this;
    }

    _updateFrame() {
      const src = this._getFramePath(this.currentAnimation, this.frameIndex);
      
      // Use preloaded frame if available
      if (this.preloadedFrames[this.currentAnimation]?.[this.frameIndex]) {
        this.img.src = this.preloadedFrames[this.currentAnimation][this.frameIndex].src;
      } else {
        this.img.src = src;
      }
    }

    stop() {
      if (this.interval) {
        clearInterval(this.interval);
        this.interval = null;
      }
      this.isPlaying = false;
      return this;
    }

    pause() {
      if (this.interval) {
        clearInterval(this.interval);
        this.interval = null;
      }
      return this;
    }

    resume() {
      if (!this.isPlaying || this.interval) return this;
      return this.play(this.currentAnimation);
    }

    // -------------------------------------------------------------------------
    // Convenience Methods
    // -------------------------------------------------------------------------
    
    /** Play animation once, then return to idle */
    playOnce(animation, callback) {
      return this.play(animation, { onComplete: callback });
    }

    /** Trigger special effect animation for this ship */
    triggerSpecial() {
      return this.playOnce('special');
    }

    /** Show thrust animation (for price movement) */
    thrust() {
      return this.play('thrust');
    }

    /** Show shield animation (for stop-loss) */
    shield() {
      return this.playOnce('shield');
    }

    /** Show charge animation (for pending orders) */
    charge() {
      return this.playOnce('charge');
    }

    /** Show refuel animation (for dividends) */
    refuel() {
      return this.playOnce('refuel');
    }

    /** Show pulse animation (for selection) */
    pulse() {
      return this.play('pulse');
    }

    /** Return to idle state */
    idle() {
      return this.play('idle');
    }

    /** Use static GIF instead of frame animation (lighter weight) */
    useGif(animation = 'idle') {
      this.stop();
      this.img.src = this._getGifPath(animation);
      return this;
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------
    getState() {
      return {
        ticker: this.ticker,
        animation: this.currentAnimation,
        frame: this.frameIndex,
        isPlaying: this.isPlaying
      };
    }

    destroy() {
      this.stop();
      if (this.img && this.img.parentNode) {
        this.img.parentNode.removeChild(this.img);
      }
      this.preloadedFrames = {};
    }
  }

  // =========================================================================
  // FLEET ANIMATOR MANAGER
  // Manages multiple ship animators across the dashboard
  // =========================================================================
  class FleetAnimatorManager {
    constructor() {
      this.animators = new Map();
    }

    /** Create animator for a ship */
    create(ticker, containerOrId, options) {
      const key = ticker.toUpperCase();
      
      // Destroy existing animator for this ticker
      if (this.animators.has(key)) {
        this.animators.get(key).destroy();
      }

      const animator = new ShipAnimator(ticker, containerOrId, options);
      this.animators.set(key, animator);
      return animator;
    }

    /** Get animator by ticker */
    get(ticker) {
      return this.animators.get(ticker.toUpperCase());
    }

    /** Trigger animation on specific ship */
    trigger(ticker, animation) {
      const animator = this.get(ticker);
      if (animator) {
        animator.play(animation);
      }
      return this;
    }

    /** Trigger special effect on ship */
    triggerSpecial(ticker) {
      const animator = this.get(ticker);
      if (animator) {
        animator.triggerSpecial();
      }
      return this;
    }

    /** Set all ships to specific animation */
    setAll(animation) {
      this.animators.forEach(animator => animator.play(animation));
      return this;
    }

    /** Pause all animations */
    pauseAll() {
      this.animators.forEach(animator => animator.pause());
      return this;
    }

    /** Resume all animations */
    resumeAll() {
      this.animators.forEach(animator => animator.resume());
      return this;
    }

    /** Stop all animations */
    stopAll() {
      this.animators.forEach(animator => animator.stop());
      return this;
    }

    /** Destroy all animators */
    destroyAll() {
      this.animators.forEach(animator => animator.destroy());
      this.animators.clear();
      return this;
    }

    /** Get all animator states */
    getStates() {
      const states = {};
      this.animators.forEach((animator, key) => {
        states[key] = animator.getState();
      });
      return states;
    }
  }

  // =========================================================================
  // UTILITY: Auto-initialize animators on elements with data attributes
  // =========================================================================
  function autoInitAnimators(selector = '[data-ship-animator]') {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      const ticker = el.dataset.shipAnimator || el.dataset.ticker;
      if (ticker && !el._shipAnimator) {
        const options = {
          autoplay: el.dataset.autoplay !== 'false',
          defaultAnimation: el.dataset.animation || 'idle'
        };
        el._shipAnimator = new ShipAnimator(ticker, el, options);
      }
    });
  }

  // =========================================================================
  // EXPOSE GLOBALLY
  // =========================================================================
  window.ShipAnimator = ShipAnimator;
  window.FleetAnimatorManager = FleetAnimatorManager;
  window.SHIP_ANIMATIONS = SHIP_ANIMATIONS;
  window.autoInitAnimators = autoInitAnimators;

  // Create global fleet manager instance
  window.fleetAnimator = new FleetAnimatorManager();

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => autoInitAnimators());
  } else {
    autoInitAnimators();
  }

  console.log('🚀 Ship Animator module loaded');

})();
