/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SPACE CAPITAL - SHIP BEHAVIOR SYSTEM
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Makes ships PERFORM, not just display. Transforms static sprites into
 * live instruments that react to real-time data.
 * 
 * Features:
 * - Stat-reactive animations (P&L, volatility, hull, fuel)
 * - Class-specific idle behaviors
 * - Ship state machine (standby → active → returning)
 * - Stress indicators with visual feedback
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

window.ShipBehavior = (function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // SHIP STATES
  // ═══════════════════════════════════════════════════════════════════════════

  const STATES = {
    STANDBY: 'standby',
    DEPLOYING: 'deploying',
    ACTIVE: 'active',
    RETURNING: 'returning',
    COOLDOWN: 'cooldown',
    ALERT: 'alert',
    DAMAGED: 'damaged'
  };

  const STATE_LABELS = {
    [STATES.STANDBY]: { text: 'STANDBY', hint: 'Engines warming...' },
    [STATES.DEPLOYING]: { text: 'DEPLOYING', hint: 'Launching...' },
    [STATES.ACTIVE]: { text: 'ACTIVE', hint: 'Mission underway' },
    [STATES.RETURNING]: { text: 'RETURNING', hint: 'RTB in progress' },
    [STATES.COOLDOWN]: { text: 'COOLDOWN', hint: 'Systems check' },
    [STATES.ALERT]: { text: 'ALERT', hint: 'Volatility spike detected' },
    [STATES.DAMAGED]: { text: 'DAMAGED', hint: 'Hull integrity critical' }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CLASS-SPECIFIC BEHAVIORS
  // ═══════════════════════════════════════════════════════════════════════════

  const CLASS_BEHAVIORS = {
    'Flagship': {
      idleAnimation: 'commanding',
      driftSpeed: 0.3,
      driftAmplitude: 2,
      engineIntensity: 1.2,
      hasCommandRadius: true,
      idleDescription: 'Commanding presence, slow deliberate movements'
    },
    'Carrier': {
      idleAnimation: 'stable',
      driftSpeed: 0.2,
      driftAmplitude: 1,
      engineIntensity: 0.8,
      hasEscorts: true,
      idleDescription: 'Stable platform, escorts visible'
    },
    'Drone': {
      idleAnimation: 'nervous',
      driftSpeed: 1.5,
      driftAmplitude: 4,
      engineIntensity: 1.0,
      hasSensorPing: true,
      idleDescription: 'Rapid micro-movements, fragile'
    },
    'Lander': {
      idleAnimation: 'heavy',
      driftSpeed: 0.15,
      driftAmplitude: 1.5,
      engineIntensity: 0.9,
      verticalBias: true,
      idleDescription: 'Heavy inertia, vertical motion'
    },
    'Scout': {
      idleAnimation: 'alert',
      driftSpeed: 0.8,
      driftAmplitude: 3,
      engineIntensity: 1.1,
      hasRadarSweep: true,
      idleDescription: 'Quick darting, scanning'
    },
    'eVTOL': {
      idleAnimation: 'hovering',
      driftSpeed: 0.6,
      driftAmplitude: 2,
      engineIntensity: 1.0,
      hasRotorWash: true,
      idleDescription: 'Vertical bob, rotor wash'
    },
    'Recon': {
      idleAnimation: 'alert',
      driftSpeed: 0.7,
      driftAmplitude: 2.5,
      engineIntensity: 0.9,
      hasRadarSweep: true,
      idleDescription: 'Observant, quick responses'
    },
    'Fighter': {
      idleAnimation: 'aggressive',
      driftSpeed: 0.9,
      driftAmplitude: 3,
      engineIntensity: 1.3,
      hasWeaponGlow: true,
      idleDescription: 'Aggressive stance, ready to engage'
    },
    'Cargo': {
      idleAnimation: 'heavy',
      driftSpeed: 0.1,
      driftAmplitude: 0.5,
      engineIntensity: 0.6,
      idleDescription: 'Slow, steady, reliable'
    },
    'Relay': {
      idleAnimation: 'stable',
      driftSpeed: 0.25,
      driftAmplitude: 1,
      engineIntensity: 0.7,
      hasSignalPulse: true,
      idleDescription: 'Communication array active'
    },
    'Moonshot': {
      idleAnimation: 'volatile',
      driftSpeed: 1.2,
      driftAmplitude: 5,
      engineIntensity: 1.5,
      idleDescription: 'Unpredictable, high energy'
    },
    // Default fallback
    'Ship': {
      idleAnimation: 'standard',
      driftSpeed: 0.4,
      driftAmplitude: 2,
      engineIntensity: 1.0,
      idleDescription: 'Standard operations'
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // STAT THRESHOLDS
  // ═══════════════════════════════════════════════════════════════════════════

  const THRESHOLDS = {
    pnl: {
      strongPositive: 5,    // +5% = strong thrust
      positive: 0,          // > 0 = gentle thrust
      negative: -2,         // < -2% = backward drift
      strongNegative: -5    // < -5% = engines failing
    },
    volatility: {
      extreme: 0.08,        // 8% = violent shaking
      high: 0.05,           // 5% = noticeable jitter
      elevated: 0.03        // 3% = subtle vibration
    },
    hull: {
      optimal: 80,          // Green, clean
      stressed: 50,         // Amber, warning
      critical: 25,         // Red, cracks
      failing: 10           // Flashing, smoke
    },
    fuel: {
      full: 80,
      adequate: 50,
      low: 25,
      critical: 10
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // BEHAVIOR CONTROLLER
  // ═══════════════════════════════════════════════════════════════════════════

  class ShipBehaviorController {
    constructor(element, options = {}) {
      this.element = element;
      this.ticker = options.ticker || 'UNKNOWN';
      this.shipClass = options.shipClass || 'Ship';
      this.stats = {
        pnlPercent: 0,
        volatility: 0.02,
        hull: 100,
        fuel: 100,
        winRate: 0.5
      };
      this.currentState = STATES.STANDBY;
      this.classBehavior = { ...CLASS_BEHAVIORS[this.shipClass] || CLASS_BEHAVIORS['Ship'] };
      this.animationFrame = null;
      this.isActive = false;
      
      // Mood system
      this.mood = 'neutral';
      
      // Apply telemetry-based animation modifiers
      if (options.animationModifiers) {
        this.applyAnimationModifiers(options.animationModifiers);
      }
      
      this.init();
    }

    /**
     * Apply telemetry-derived animation modifiers to class behavior
     */
    applyAnimationModifiers(mods) {
      if (!mods) return;
      
      // Modify drift based on telemetry chop sensitivity
      if (mods.idleSpeed !== undefined) {
        this.classBehavior.driftSpeed = this.classBehavior.driftSpeed / mods.idleSpeed;
      }
      if (mods.idleAmplitude !== undefined) {
        this.classBehavior.driftAmplitude = this.classBehavior.driftAmplitude * mods.idleAmplitude;
      }
      
      // Modify engine intensity based on thrust potential
      if (mods.thrustIntensity !== undefined) {
        this.classBehavior.engineIntensity = this.classBehavior.engineIntensity * mods.thrustIntensity;
      }
      
      // Store for future use
      this.animationModifiers = mods;
    }

    init() {
      // Add base behavior class
      this.element.classList.add('ship-behavior');
      this.element.classList.add(`ship-class-${this.shipClass.toLowerCase()}`);
      
      // Set CSS custom properties for class-specific timing
      this.element.style.setProperty('--drift-speed', `${this.classBehavior.driftSpeed}s`);
      this.element.style.setProperty('--drift-amplitude', `${this.classBehavior.driftAmplitude}px`);
      this.element.style.setProperty('--engine-intensity', this.classBehavior.engineIntensity);
      
      // Set telemetry-based modifiers if available
      if (this.animationModifiers) {
        if (this.animationModifiers.signalFlicker !== undefined) {
          this.element.style.setProperty('--signal-flicker', this.animationModifiers.signalFlicker);
        }
        if (this.animationModifiers.engineStability !== undefined) {
          this.element.style.setProperty('--engine-stability', this.animationModifiers.engineStability);
        }
        if (this.animationModifiers.volatilityInfluence !== undefined) {
          this.element.style.setProperty('--volatility-influence', this.animationModifiers.volatilityInfluence);
        }
      }
      
      // Start idle animation
      this.startIdleAnimation();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STAT UPDATES
    // ─────────────────────────────────────────────────────────────────────────

    updateStats(newStats) {
      this.stats = { ...this.stats, ...newStats };
      this.applyBehaviorClasses();
      this.updateMood();
      this.checkStateTransitions();
    }

    applyBehaviorClasses() {
      const el = this.element;
      const stats = this.stats;
      const T = THRESHOLDS;

      // Clear previous stat classes
      el.classList.remove(
        'thrust-strong', 'thrust-positive', 'thrust-negative', 'thrust-failing',
        'volatile-extreme', 'volatile-high', 'volatile-elevated',
        'hull-optimal', 'hull-stressed', 'hull-critical', 'hull-failing',
        'fuel-full', 'fuel-adequate', 'fuel-low', 'fuel-critical'
      );

      // P&L → Thrust behavior
      if (stats.pnlPercent >= T.pnl.strongPositive) {
        el.classList.add('thrust-strong');
      } else if (stats.pnlPercent > T.pnl.positive) {
        el.classList.add('thrust-positive');
      } else if (stats.pnlPercent < T.pnl.strongNegative) {
        el.classList.add('thrust-failing');
      } else if (stats.pnlPercent < T.pnl.negative) {
        el.classList.add('thrust-negative');
      }

      // Volatility → Stability
      if (stats.volatility >= T.volatility.extreme) {
        el.classList.add('volatile-extreme');
      } else if (stats.volatility >= T.volatility.high) {
        el.classList.add('volatile-high');
      } else if (stats.volatility >= T.volatility.elevated) {
        el.classList.add('volatile-elevated');
      }

      // Hull → Damage state
      if (stats.hull >= T.hull.optimal) {
        el.classList.add('hull-optimal');
      } else if (stats.hull >= T.hull.stressed) {
        el.classList.add('hull-stressed');
      } else if (stats.hull >= T.hull.critical) {
        el.classList.add('hull-critical');
      } else {
        el.classList.add('hull-failing');
      }

      // Fuel → Engine state
      if (stats.fuel >= T.fuel.full) {
        el.classList.add('fuel-full');
      } else if (stats.fuel >= T.fuel.adequate) {
        el.classList.add('fuel-adequate');
      } else if (stats.fuel >= T.fuel.low) {
        el.classList.add('fuel-low');
      } else {
        el.classList.add('fuel-critical');
      }

      // Set CSS custom properties for dynamic effects
      el.style.setProperty('--pnl-factor', Math.max(-1, Math.min(1, stats.pnlPercent / 10)));
      el.style.setProperty('--volatility-factor', Math.min(1, stats.volatility / 0.1));
      el.style.setProperty('--hull-factor', stats.hull / 100);
      el.style.setProperty('--fuel-factor', stats.fuel / 100);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MOOD SYSTEM
    // ─────────────────────────────────────────────────────────────────────────

    updateMood() {
      const { pnlPercent, volatility, hull, winRate } = this.stats;
      let newMood = 'neutral';

      if (hull < 25) {
        newMood = 'critical';
      } else if (pnlPercent > 5 && winRate > 0.6) {
        newMood = 'confident';
      } else if (pnlPercent > 2) {
        newMood = 'optimistic';
      } else if (pnlPercent < -5) {
        newMood = 'strained';
      } else if (volatility > 0.06) {
        newMood = 'cautious';
      } else if (pnlPercent < -2 && volatility > 0.04) {
        newMood = 'defensive';
      }

      if (newMood !== this.mood) {
        this.element.classList.remove(`mood-${this.mood}`);
        this.element.classList.add(`mood-${newMood}`);
        this.mood = newMood;
        
        // Emit mood change event
        this.element.dispatchEvent(new CustomEvent('ship:mood', {
          detail: { ticker: this.ticker, mood: newMood }
        }));
      }
    }

    getMoodDescription() {
      const MOOD_DESCRIPTIONS = {
        'confident': 'Systems optimal, momentum strong',
        'optimistic': 'Positive trajectory confirmed',
        'neutral': 'Standard operations',
        'cautious': 'Elevated volatility detected',
        'defensive': 'Evasive protocols engaged',
        'strained': 'Performance under pressure',
        'critical': 'Hull integrity compromised'
      };
      return MOOD_DESCRIPTIONS[this.mood] || 'Status unknown';
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STATE MACHINE
    // ─────────────────────────────────────────────────────────────────────────

    setState(newState) {
      if (newState === this.currentState) return;

      const prevState = this.currentState;
      this.element.classList.remove(`state-${prevState}`);
      this.element.classList.add(`state-${newState}`);
      this.currentState = newState;

      // Emit state change event
      this.element.dispatchEvent(new CustomEvent('ship:state', {
        detail: {
          ticker: this.ticker,
          prevState,
          newState,
          label: STATE_LABELS[newState]
        }
      }));
    }

    checkStateTransitions() {
      const { hull, volatility, pnlPercent } = this.stats;

      // Auto-transition based on stats
      if (hull < THRESHOLDS.hull.critical) {
        this.setState(STATES.DAMAGED);
      } else if (volatility >= THRESHOLDS.volatility.extreme) {
        this.setState(STATES.ALERT);
      }
    }

    // Market-based state transitions
    onMarketOpen() {
      if (this.currentState === STATES.STANDBY) {
        this.setState(STATES.DEPLOYING);
        setTimeout(() => this.setState(STATES.ACTIVE), 2000);
      }
    }

    onMarketClose() {
      if (this.currentState === STATES.ACTIVE) {
        this.setState(STATES.RETURNING);
        setTimeout(() => {
          this.setState(STATES.COOLDOWN);
          setTimeout(() => this.setState(STATES.STANDBY), 3000);
        }, 2000);
      }
    }

    onPositionChange() {
      if (this.currentState === STATES.STANDBY) {
        this.setState(STATES.DEPLOYING);
        setTimeout(() => this.setState(STATES.ACTIVE), 1500);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // IDLE ANIMATIONS
    // ─────────────────────────────────────────────────────────────────────────

    startIdleAnimation() {
      this.element.classList.add(`idle-${this.classBehavior.idleAnimation}`);
      
      // Add class-specific features
      if (this.classBehavior.hasCommandRadius) {
        this.element.classList.add('has-command-radius');
      }
      if (this.classBehavior.hasRadarSweep) {
        this.element.classList.add('has-radar-sweep');
      }
      if (this.classBehavior.hasRotorWash) {
        this.element.classList.add('has-rotor-wash');
      }
      if (this.classBehavior.hasSignalPulse) {
        this.element.classList.add('has-signal-pulse');
      }
      if (this.classBehavior.hasWeaponGlow) {
        this.element.classList.add('has-weapon-glow');
      }
      if (this.classBehavior.verticalBias) {
        this.element.classList.add('has-vertical-bias');
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SPECIAL EFFECTS
    // ─────────────────────────────────────────────────────────────────────────

    triggerDamageFlash() {
      this.element.classList.add('damage-flash');
      setTimeout(() => this.element.classList.remove('damage-flash'), 300);
    }

    triggerBoost() {
      this.element.classList.add('boost-active');
      setTimeout(() => this.element.classList.remove('boost-active'), 1000);
    }

    triggerAlert() {
      this.element.classList.add('alert-pulse');
      setTimeout(() => this.element.classList.remove('alert-pulse'), 2000);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CLEANUP
    // ─────────────────────────────────────────────────────────────────────────

    destroy() {
      if (this.animationFrame) {
        cancelAnimationFrame(this.animationFrame);
      }
      // Remove all behavior classes
      this.element.classList.remove('ship-behavior');
      this.element.className = this.element.className
        .replace(/\b(thrust|volatile|hull|fuel|state|mood|idle|has)-\S+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STRESS INDICATOR SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════

  function createStressIndicator(type, value, container) {
    const T = THRESHOLDS[type];
    if (!T) return null;

    const indicator = document.createElement('div');
    indicator.className = `stress-indicator stress-${type}`;
    
    let level = 'optimal';
    let label = '';
    
    if (type === 'hull') {
      if (value >= T.optimal) { level = 'optimal'; label = 'OPTIMAL'; }
      else if (value >= T.stressed) { level = 'stressed'; label = 'STRESSED'; }
      else if (value >= T.critical) { level = 'critical'; label = 'CRITICAL'; }
      else { level = 'failing'; label = 'FAILING'; }
    } else if (type === 'fuel') {
      if (value >= T.full) { level = 'full'; label = 'FULL'; }
      else if (value >= T.adequate) { level = 'adequate'; label = 'ADEQUATE'; }
      else if (value >= T.low) { level = 'low'; label = 'LOW'; }
      else { level = 'critical'; label = 'CRITICAL'; }
    }

    indicator.innerHTML = `
      <div class="stress-bar">
        <div class="stress-fill stress-level-${level}" style="width: ${value}%"></div>
      </div>
      <span class="stress-label">${label}</span>
    `;

    indicator.dataset.level = level;
    indicator.dataset.value = value;

    if (container) {
      container.appendChild(indicator);
    }

    return indicator;
  }

  function updateStressIndicator(indicator, value) {
    if (!indicator) return;
    
    const type = indicator.classList.contains('stress-hull') ? 'hull' : 'fuel';
    const T = THRESHOLDS[type];
    
    let level = 'optimal';
    let label = '';
    
    if (type === 'hull') {
      if (value >= T.optimal) { level = 'optimal'; label = 'OPTIMAL'; }
      else if (value >= T.stressed) { level = 'stressed'; label = 'STRESSED'; }
      else if (value >= T.critical) { level = 'critical'; label = 'CRITICAL'; }
      else { level = 'failing'; label = 'FAILING'; }
    } else {
      if (value >= T.full) { level = 'full'; label = 'FULL'; }
      else if (value >= T.adequate) { level = 'adequate'; label = 'ADEQUATE'; }
      else if (value >= T.low) { level = 'low'; label = 'LOW'; }
      else { level = 'critical'; label = 'CRITICAL'; }
    }

    const fill = indicator.querySelector('.stress-fill');
    const labelEl = indicator.querySelector('.stress-label');
    
    if (fill) {
      fill.style.width = `${value}%`;
      fill.className = `stress-fill stress-level-${level}`;
    }
    if (labelEl) {
      labelEl.textContent = label;
    }
    
    indicator.dataset.level = level;
    indicator.dataset.value = value;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FACTORY & REGISTRY
  // ═══════════════════════════════════════════════════════════════════════════

  const controllers = new Map();

  function create(element, options) {
    if (!element) return null;
    
    const id = options.ticker || element.id || `ship-${Date.now()}`;
    
    // Clean up existing controller
    if (controllers.has(id)) {
      controllers.get(id).destroy();
    }
    
    const controller = new ShipBehaviorController(element, options);
    controllers.set(id, controller);
    
    return controller;
  }

  function get(tickerOrId) {
    return controllers.get(tickerOrId);
  }

  function updateAll(statsMap) {
    for (const [ticker, stats] of Object.entries(statsMap)) {
      const controller = controllers.get(ticker);
      if (controller) {
        controller.updateStats(stats);
      }
    }
  }

  function destroyAll() {
    controllers.forEach(c => c.destroy());
    controllers.clear();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    create,
    get,
    updateAll,
    destroyAll,
    createStressIndicator,
    updateStressIndicator,
    STATES,
    STATE_LABELS,
    CLASS_BEHAVIORS,
    THRESHOLDS
  };

})();
