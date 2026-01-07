/**
 * PARALLAX Mission System v2
 * NMS-inspired expedition system for derivatives training
 * 
 * STEP 2: Full play loop with simulation, logs, and scoring
 * 
 * Derived stats from TradingView 45m data:
 * - Hull: trend stability / structural integrity
 * - Firepower: volatility / thrust  
 * - Sensors: flow quality / signal clarity
 * - Fuel: time tolerance / patience buffer
 * - Threat: regime risk / storm probability
 */

const MissionSystem = (function() {
  'use strict';
  
  // Pixel icon helper - uses PixelIcons if available, else returns text fallback
  function pxIcon(name, color = '#33ff99', size = 12) {
    if (window.PixelIcons) {
      return window.PixelIcons.toSvg(name, color, size);
    }
    // Fallback text symbols
    const fallbacks = {
      scout: '[SCT]', shield: '[SHD]', fuel: '[FUL]', wrench: '[UTL]',
      rocket: '[RKT]', warning: '[!]', lightning: '[ZAP]', fire: '[FIR]',
      satellite: '[SAT]', target: '[TGT]', sword: '[ATK]'
    };
    return fallbacks[name] || '[?]';
  }
  
  const STORAGE_KEY = 'PARALLAX_MISSIONS_V1';
  const DEFAULT_LOOKBACK = 32; // bars for stat computation
  
  // ═══════════════════════════════════════════════════════════════════
  // SIMULATION CONSTANTS
  // ═══════════════════════════════════════════════════════════════════
  
  const SIM_SPEEDS = {
    '1x': 0.25,    // 1 bar every 4 seconds
    '5x': 1.25,    // 1 bar every 0.8 seconds
    '20x': 5.0     // 5 bars per second
  };
  
  const DEFAULT_SIM_SPEED = '1x';
  const MAX_LOGS_PER_MISSION = 20;
  
  // Duration presets (in bars, where 1 bar = 45 minutes)
  const DURATION_PRESETS = {
    '45m': { targetBars: 1, label: '45 minutes' },
    '4H': { targetBars: 5, label: '4 hours' },
    '1D': { targetBars: 32, label: '1 day' },
    '1W': { targetBars: 160, label: '1 week' },
    '2W': { targetBars: 320, label: '2 weeks' },
    '1M': { targetBars: 640, label: '1 month' }
  };
  
  // ═══════════════════════════════════════════════════════════════════
  // STEP 3: SUPPORT ROLES & MODIFIERS
  // ═══════════════════════════════════════════════════════════════════
  
  const SUPPORT_ROLES = {
    SCOUT: {
      id: 'SCOUT',
      name: 'Scout Wing',
      get icon() { return pxIcon('scout', '#47d4ff', 14); },
      description: 'Improves signal clarity and recon quality',
      mods: {
        sensorsBoost: 0.15,
        threatDamp: 1.0,
        stabilityBoost: 0,
        timeBuffer: 0
      },
      get launchLog() { return pxIcon('scout', '#47d4ff', 12) + ' Scout wing expanded sensor range (+15% flow clarity)'; },
      get interventionLog() { return pxIcon('scout', '#47d4ff', 12) + ' Scout interpreted flow anomaly'; }
    },
    ESCORT: {
      id: 'ESCORT',
      name: 'Escort Formation',
      get icon() { return pxIcon('shield', '#47d4ff', 14); },
      description: 'Reduces storm damage and turbulence impact',
      mods: {
        sensorsBoost: 0,
        threatDamp: 0.85,
        stabilityBoost: 0.10,
        timeBuffer: 0
      },
      get launchLog() { return pxIcon('shield', '#47d4ff', 12) + ' Escort formation deployed (storm impact -15%)'; },
      get interventionLog() { return pxIcon('shield', '#47d4ff', 12) + ' Escort dampened storm impact'; }
    },
    CARRIER: {
      id: 'CARRIER',
      name: 'Carrier Resupply',
      get icon() { return pxIcon('fuel', '#ffaa33', 14); },
      description: 'Extends operational endurance and patience buffer',
      mods: {
        sensorsBoost: 0,
        threatDamp: 1.0,
        stabilityBoost: 0.05,
        timeBuffer: 0.10
      },
      get launchLog() { return pxIcon('fuel', '#ffaa33', 12) + ' Carrier resupply extended operational endurance'; },
      get interventionLog() { return pxIcon('fuel', '#ffaa33', 12) + ' Carrier reserves maintained mission stability'; }
    },
    UTILITY: {
      id: 'UTILITY',
      name: 'Utility Craft',
      get icon() { return pxIcon('wrench', '#ffaa33', 14); },
      description: 'General mission support and resilience',
      mods: {
        sensorsBoost: 0,
        threatDamp: 1.0,
        stabilityBoost: 0.05,
        timeBuffer: 0
      },
      get launchLog() { return pxIcon('wrench', '#ffaa33', 12) + ' Utility craft improved mission resilience'; },
      get interventionLog() { return pxIcon('wrench', '#ffaa33', 12) + ' Utility craft provided auxiliary support'; }
    }
  };
  
  // Fleet environment cache (computed once, reused)
  const FleetCache = {
    envs: {},        // ticker -> env object
    roles: {},       // ticker -> role id
    loaded: false
  };
  
  /**
   * Classify a ticker's support role based on its environment stats
   */
  function classifyRole(env) {
    const { hull, sensors, fuel, threat } = env;
    
    // SCOUT: Sensors is highest stat and >= 60
    if (sensors >= 60 && sensors >= hull && sensors >= fuel) {
      return 'SCOUT';
    }
    
    // ESCORT: Hull high AND Threat moderate/high
    if (hull >= 60 && threat >= 45) {
      return 'ESCORT';
    }
    
    // CARRIER: Fuel high AND Hull moderate
    if (fuel >= 60 && hull >= 50) {
      return 'CARRIER';
    }
    
    // Default: UTILITY
    return 'UTILITY';
  }
  
  /**
   * Get support role info for a ticker
   */
  function getTickerRole(ticker) {
    const roleId = FleetCache.roles[ticker] || 'UTILITY';
    return SUPPORT_ROLES[roleId];
  }
  
  /**
   * Check if a ticker is locked to an ACTIVE mission
   */
  function isTickerLocked(ticker) {
    const missions = loadMissions();
    for (const m of missions) {
      if (m.status !== 'ACTIVE') continue;
      if (!m.support?.slots) continue;
      for (const slot of m.support.slots) {
        if (slot.ticker === ticker) {
          return { locked: true, missionId: m.id, missionType: m.typeName };
        }
      }
    }
    return { locked: false };
  }
  
  /**
   * Get all locked tickers (for UI display)
   */
  function getLockedTickers() {
    const locked = {};
    const missions = loadMissions();
    for (const m of missions) {
      if (m.status !== 'ACTIVE') continue;
      if (!m.support?.slots) continue;
      for (const slot of m.support.slots) {
        if (slot.ticker) {
          locked[slot.ticker] = { missionId: m.id, missionType: m.typeName };
        }
      }
    }
    return locked;
  }
  
  /**
   * Assign a support ship to a mission slot
   */
  function assignSupport(missionId, slotIndex, ticker) {
    if (slotIndex < 0 || slotIndex > 1) throw new Error('Invalid slot index');
    
    // Check if ticker is locked
    const lockStatus = isTickerLocked(ticker);
    if (lockStatus.locked && lockStatus.missionId !== missionId) {
      throw new Error(`${ticker} is already assigned to ${lockStatus.missionType}`);
    }
    
    const missions = loadMissions();
    const mission = missions.find(m => m.id === missionId);
    if (!mission) throw new Error('Mission not found');
    if (mission.status !== 'ACTIVE') throw new Error('Can only assign supports to active missions');
    
    // Can't assign the mission's own ticker as support
    if (ticker === mission.ticker) {
      throw new Error('Cannot assign mission ticker as its own support');
    }
    
    // Initialize support structure if needed
    if (!mission.support) {
      mission.support = {
        slots: [
          { ticker: null, role: null, mods: null },
          { ticker: null, role: null, mods: null }
        ]
      };
    }
    
    // Check if ticker is already in the other slot
    const otherSlot = slotIndex === 0 ? 1 : 0;
    if (mission.support.slots[otherSlot].ticker === ticker) {
      throw new Error(`${ticker} is already in slot ${otherSlot === 0 ? 'A' : 'B'}`);
    }
    
    const role = getTickerRole(ticker);
    mission.support.slots[slotIndex] = {
      ticker: ticker,
      role: role.id,
      mods: { ...role.mods }
    };
    
    // Add log entry
    mission.logs.push({
      tMs: Date.now(),
      barIndex: mission._lastProcessedBarIndex || mission.start?.barIndex || 0,
      kind: 'EVENT',
      msg: pxIcon('satellite', '#47d4ff', 12) + ` Support assigned: ${ticker} (${role.name})`
    });
    
    saveMissions(missions);
    return mission;
  }
  
  /**
   * Remove a support ship from a mission slot
   */
  function removeSupport(missionId, slotIndex) {
    if (slotIndex < 0 || slotIndex > 1) throw new Error('Invalid slot index');
    
    const missions = loadMissions();
    const mission = missions.find(m => m.id === missionId);
    if (!mission) throw new Error('Mission not found');
    
    if (!mission.support?.slots?.[slotIndex]?.ticker) {
      return mission; // Already empty
    }
    
    const removedTicker = mission.support.slots[slotIndex].ticker;
    mission.support.slots[slotIndex] = { ticker: null, role: null, mods: null };
    
    // Add log entry
    mission.logs.push({
      tMs: Date.now(),
      barIndex: mission._lastProcessedBarIndex || mission.start?.barIndex || 0,
      kind: 'INFO',
      msg: pxIcon('satellite', '#47d4ff', 12) + ` Support detached: ${removedTicker}`
    });
    
    saveMissions(missions);
    return mission;
  }
  
  /**
   * Compute combined modifiers from all support slots
   */
  function getCombinedMods(mission) {
    const mods = {
      sensorsBoost: 0,
      threatDamp: 1.0,
      stabilityBoost: 0,
      timeBuffer: 0
    };
    
    if (!mission.support?.slots) return mods;
    
    for (const slot of mission.support.slots) {
      if (!slot.mods) continue;
      mods.sensorsBoost += slot.mods.sensorsBoost || 0;
      mods.threatDamp *= slot.mods.threatDamp || 1.0;
      mods.stabilityBoost += slot.mods.stabilityBoost || 0;
      mods.timeBuffer += slot.mods.timeBuffer || 0;
    }
    
    return mods;
  }
  
  /**
   * Check if mission has a specific support role
   */
  function hasRole(mission, roleId) {
    if (!mission.support?.slots) return false;
    return mission.support.slots.some(s => s.role === roleId);
  }
  
  
  // ═══════════════════════════════════════════════════════════════════
  // MISSION ARCHETYPES
  // ═══════════════════════════════════════════════════════════════════
  
  const MISSION_TYPES = {
    RECON: {
      id: 'RECON',
      name: 'RECON SWEEP',
      get icon() { return pxIcon('scout', '#47d4ff', 14); },
      concept: 'Teaches regime/flow awareness',
      description: 'Scout the sector for signal clarity and flow patterns. High sensor readings improve success.',
      teaches: 'How to read market flow and identify regime changes before committing capital.',
      bettingOn: 'Information quality and timing',
      durationBands: ['45m', '4H', '1D'],
      defaultDuration: '4H',
      idealConditions: { sensors: 'high', threat: 'low-moderate' },
      riskProfile: 'Low capital at risk, high information value'
    },
    CARGO: {
      id: 'CARGO',
      name: 'CARGO RUN',
      get icon() { return pxIcon('fuel', '#ffaa33', 14); },
      concept: 'Teaches theta/time cost',
      description: 'Transport value across time. Stable hull and fuel reserves are critical for the journey.',
      teaches: 'How time decay (theta) erodes option value, and why patience has a cost.',
      bettingOn: 'Time passage without adverse movement',
      durationBands: ['1D', '1W', '2W'],
      defaultDuration: '1D',
      idealConditions: { hull: 'high', fuel: 'high', threat: 'low' },
      riskProfile: 'Moderate capital, success requires discipline'
    },
    ESCORT: {
      id: 'ESCORT',
      name: 'ESCORT FORMATION',
      get icon() { return pxIcon('shield', '#47d4ff', 14); },
      concept: 'Teaches structure/hedging reduces variance',
      description: 'Protect the convoy with coordinated positioning. Spreads and hedges reduce damage exposure.',
      teaches: 'How structured positions (spreads) trade upside for reduced risk.',
      bettingOn: 'Defined risk/reward within a range',
      durationBands: ['1D', '1W', '2W'],
      defaultDuration: '1W',
      idealConditions: { hull: 'moderate-high', threat: 'moderate' },
      riskProfile: 'Capped loss, capped gain, high probability'
    },
    STRIKE: {
      id: 'STRIKE',
      name: 'DEEP SPACE STRIKE',
      get icon() { return pxIcon('sword', '#ff4444', 14); },
      concept: 'Teaches convexity/asymmetry sizing',
      description: 'High-risk assault on distant targets. Requires firepower and directional conviction.',
      teaches: 'How to size asymmetric bets where small losses can lead to large gains.',
      bettingOn: 'Large directional movement',
      durationBands: ['1D', '1W', '2W'],
      defaultDuration: '1W',
      idealConditions: { firepower: 'high', hull: 'directionally clear' },
      riskProfile: 'High risk of total loss, potential for outsized returns'
    },
    HARVEST: {
      id: 'HARVEST',
      name: 'HARVEST OPERATION',
      get icon() { return pxIcon('target', '#33ff99', 14); },
      concept: 'Teaches range/mean reversion / premium intuition',
      description: 'Extract value from stable zones. Low volatility and clear boundaries maximize yield.',
      teaches: 'How to profit from range-bound conditions by selling premium.',
      bettingOn: 'Price staying within a defined range',
      durationBands: ['45m', '1D', '1W'],
      defaultDuration: '1D',
      idealConditions: { firepower: 'low-moderate', threat: 'low' },
      riskProfile: 'High win rate, occasional large losses'
    }
  };
  
  // ═══════════════════════════════════════════════════════════════════
  // UTILITY FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════
  
  function linearRegressionSlope(values) {
    const n = values.length;
    if (n < 2) return 0;
    
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }
  
  function countSignFlips(values) {
    let flips = 0;
    for (let i = 1; i < values.length; i++) {
      if ((values[i] >= 0) !== (values[i-1] >= 0)) {
        flips++;
      }
    }
    return flips;
  }
  
  function normalize(value, min, max) {
    if (max === min) return 50;
    return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  }
  
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
  
  function generateUUID() {
    return 'MSN-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // STAT DERIVATION (same as Step 1.1)
  // ═══════════════════════════════════════════════════════════════════
  
  function computeHull(bars) {
    const n = bars.length;
    if (n < 5) return { value: 50, why: 'Insufficient data' };
    
    const kreSeries = [];
    for (const b of bars) {
      if (b.kernelRegression != null && !isNaN(b.kernelRegression)) kreSeries.push(b.kernelRegression);
    }
    const kreSlope = kreSeries.length >= 2 ? linearRegressionSlope(kreSeries) : 0;
    const slopeScore = Math.min(Math.abs(kreSlope) * 500, 50);
    
    const deviations = [];
    for (const b of bars) {
      if (b.close != null && b.kernelRegression != null && !isNaN(b.kernelRegression)) {
        deviations.push(b.close - b.kernelRegression);
      }
    }
    const chopFlips = deviations.length >= 2 ? countSignFlips(deviations) : 0;
    const chopPenalty = Math.min(chopFlips * 3, 30);
    
    const latestClose = bars[n - 1].close;
    let latestG200 = null;
    for (let i = n - 1; i >= 0; i--) {
      if (bars[i].G200 != null && !isNaN(bars[i].G200)) {
        latestG200 = bars[i].G200;
        break;
      }
    }
    if (latestG200 == null) latestG200 = latestClose;
    
    const anchorDist = Math.abs((latestClose - latestG200) / latestClose);
    const anchorScore = Math.max(0, 30 - anchorDist * 200);
    
    const rawHull = 40 + slopeScore + anchorScore - chopPenalty;
    const hull = clamp(Math.round(rawHull), 0, 100);
    
    const slopeDir = kreSlope > 0.001 ? 'upward' : kreSlope < -0.001 ? 'downward' : 'flat';
    const chopDesc = chopFlips <= 5 ? 'low chop' : chopFlips <= 10 ? 'moderate chop' : 'high chop';
    const anchorDesc = anchorDist < 0.03 ? 'close to G200' : anchorDist < 0.08 ? 'moderate distance from G200' : 'far from G200';
    
    return {
      value: hull,
      why: `KRE slope ${slopeDir}; ${chopDesc} (${chopFlips} flips); ${anchorDesc}`
    };
  }
  
  function computeFirepower(bars) {
    const n = bars.length;
    if (n < 5) return { value: 50, why: 'Insufficient data' };
    
    let atrSum = 0;
    let atrCount = 0;
    for (const bar of bars) {
      if (bar.high != null && bar.low != null && bar.close != null && bar.close !== 0) {
        atrSum += (bar.high - bar.low) / bar.close;
        atrCount++;
      }
    }
    const avgATR = atrCount > 0 ? atrSum / atrCount : 0.03;
    const atrScore = normalize(avgATR, 0.01, 0.06) * 0.6;
    
    const histValues = [];
    for (const bar of bars) {
      if (bar.histogram != null && !isNaN(bar.histogram)) {
        histValues.push(Math.abs(bar.histogram));
      }
    }
    
    let histScore = 0;
    let avgHist = 0;
    let histDesc = 'momentum unavailable';
    
    if (histValues.length > 0) {
      avgHist = histValues.reduce((a, b) => a + b, 0) / histValues.length;
      histScore = normalize(avgHist, 0, 0.3) * 0.4;
      histDesc = avgHist < 0.1 ? 'weak momentum' : avgHist < 0.2 ? 'moderate momentum' : 'strong momentum';
    }
    
    const firepower = clamp(Math.round(atrScore + histScore), 0, 100);
    const atrDesc = avgATR < 0.02 ? 'low range' : avgATR < 0.04 ? 'moderate range' : 'high range';
    
    return {
      value: firepower,
      why: `${atrDesc} (${(avgATR * 100).toFixed(1)}% ATR); ${histDesc}`
    };
  }
  
  function computeSensors(bars) {
    const n = bars.length;
    if (n < 5) return { value: 50, why: 'Insufficient data' };
    
    let aboveMACount = 0;
    let totalRatio = 0;
    let validCount = 0;
    
    for (const bar of bars) {
      if (bar.volume != null && bar.volumeMA != null && bar.volumeMA > 0) {
        const ratio = bar.volume / bar.volumeMA;
        totalRatio += ratio;
        validCount++;
        if (ratio > 1) aboveMACount++;
      }
    }
    
    if (validCount === 0) return { value: 50, why: 'No volume data' };
    
    const avgRatio = totalRatio / validCount;
    const aboveMAPercent = aboveMACount / validCount;
    
    const ratioScore = normalize(avgRatio, 0.7, 1.5) * 0.5;
    const consistencyScore = aboveMAPercent * 50;
    
    const sensors = clamp(Math.round(ratioScore + consistencyScore), 0, 100);
    
    const flowDesc = avgRatio < 0.9 ? 'below-average flow' : avgRatio < 1.1 ? 'neutral flow' : 'above-average flow';
    const consistDesc = aboveMAPercent < 0.4 ? 'inconsistent' : aboveMAPercent < 0.6 ? 'mixed' : 'consistent';
    
    return {
      value: sensors,
      why: `${flowDesc} (${avgRatio.toFixed(2)}x MA); ${consistDesc} (${Math.round(aboveMAPercent * 100)}% above MA)`
    };
  }
  
  function computeFuel(bars) {
    const n = bars.length;
    if (n < 5) return { value: 50, why: 'Insufficient data' };
    
    let barsSinceSignal = n;
    for (let i = n - 1; i >= 0; i--) {
      const hasBuy = bars[i].buy != null && bars[i].buy !== 0 && !isNaN(bars[i].buy);
      const hasSell = bars[i].sell != null && bars[i].sell !== 0 && !isNaN(bars[i].sell);
      if (hasBuy || hasSell) {
        barsSinceSignal = n - 1 - i;
        break;
      }
    }
    
    const persistenceScore = normalize(barsSinceSignal, 0, 32) * 0.6;
    
    const deviations = [];
    for (const b of bars) {
      if (b.close != null && b.kernelRegression != null && !isNaN(b.kernelRegression)) {
        deviations.push(b.close - b.kernelRegression);
      }
    }
    const chopFlips = deviations.length >= 2 ? countSignFlips(deviations) : 0;
    const lowChopBonus = Math.max(0, 40 - chopFlips * 4);
    
    const fuel = clamp(Math.round(persistenceScore + lowChopBonus), 0, 100);
    
    const persistDesc = barsSinceSignal < 5 ? 'recent signal' : barsSinceSignal < 15 ? 'signal aging' : 'mature trend';
    const chopDesc = chopFlips <= 5 ? 'steady path' : chopFlips <= 10 ? 'some turbulence' : 'choppy conditions';
    
    return {
      value: fuel,
      why: `${persistDesc} (${barsSinceSignal} bars ago); ${chopDesc}`
    };
  }
  
  function computeThreat(bars) {
    const n = bars.length;
    if (n < 5) return { value: 50, why: 'Insufficient data' };
    
    const latest = bars[n - 1];
    
    const bandKeys = [
      'A1', 'A2', 'A3', 'A4', 'A5',
      'B1', 'B2', 'B3', 'B4', 'B5',
      'C1', 'C2', 'C3', 'C4', 'C5',
      'D1', 'D2', 'D3', 'D4', 'D5',
      'E1', 'E2', 'E3', 'E4', 'E5',
      'F1', 'F2', 'F3', 'F4', 'F5'
    ];
    
    const bandValues = bandKeys.map(k => latest[k]).filter(v => v != null && !isNaN(v));
    
    let bandProximityScore = 50;
    if (bandValues.length > 0) {
      const lower = Math.min(...bandValues);
      const upper = Math.max(...bandValues);
      const close = latest.close;
      
      if (upper > lower) {
        const pos = (close - lower) / (upper - lower);
        const distFromCenter = Math.abs(pos - 0.5) * 2;
        bandProximityScore = distFromCenter * 50;
      }
    }
    
    const histValues = bars.map(b => b.histogram).filter(v => v != null);
    const flipRate = countSignFlips(histValues);
    const flipScore = normalize(flipRate, 0, n / 2) * 30;
    
    const firepower = computeFirepower(bars).value;
    const volContribution = (firepower / 100) * 20;
    
    const threat = clamp(Math.round(bandProximityScore + flipScore + volContribution), 0, 100);
    
    const bandDesc = bandProximityScore < 20 ? 'mid-range' : bandProximityScore < 35 ? 'approaching bands' : 'near band extreme';
    const flipDesc = flipRate <= 5 ? 'stable regime' : flipRate <= 12 ? 'some chop' : 'high chop';
    
    return {
      value: threat,
      why: `${bandDesc}; histogram ${flipDesc} (${flipRate} flips); volatility ${firepower < 40 ? 'low' : firepower < 70 ? 'moderate' : 'elevated'}`
    };
  }
  
  async function computeEnvironment(ticker, lookback = DEFAULT_LOOKBACK) {
    const bars = await IndicatorLoader.getRecentBars(ticker, lookback);
    
    if (bars.length < 5) {
      throw new Error(`Insufficient data for ${ticker}: only ${bars.length} bars`);
    }
    
    const hull = computeHull(bars);
    const firepower = computeFirepower(bars);
    const sensors = computeSensors(bars);
    const fuel = computeFuel(bars);
    const threat = computeThreat(bars);
    
    return {
      ticker: ticker,
      computedAt: new Date().toISOString(),
      barsUsed: bars.length,
      
      hull: hull.value,
      firepower: firepower.value,
      sensors: sensors.value,
      fuel: fuel.value,
      threat: threat.value,
      
      why: {
        hull: hull.why,
        firepower: firepower.why,
        sensors: sensors.why,
        fuel: fuel.why,
        threat: threat.why
      },
      
      latestBar: {
        time: new Date(bars[bars.length - 1].time * 1000).toISOString(),
        close: bars[bars.length - 1].close,
        volume: bars[bars.length - 1].volume
      }
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // MISSION RECOMMENDATIONS
  // ═══════════════════════════════════════════════════════════════════
  
  function computeDifficulty(missionType, env) {
    const t = env.threat;
    const h = env.hull;
    const f = env.fuel;
    const fp = env.firepower;
    const s = env.sensors;
    
    switch (missionType) {
      case 'RECON': {
        let stars = t > 60 ? 3 : t > 35 ? 2 : 1;
        if (s >= 70 && stars > 1) stars -= 1;
        if (s <= 35 && stars < 3) stars += 1;
        return stars;
      }
      case 'CARGO':
        const cargoRisk = t * 0.5 + (100 - f) * 0.5;
        return cargoRisk > 60 ? 3 : cargoRisk > 35 ? 2 : 1;
      case 'ESCORT':
        return t > 70 || t < 20 ? 2 : 1;
      case 'STRIKE':
        return t > 65 ? 3 : t > 40 ? 2 : 1;
      case 'HARVEST':
        const harvestRisk = fp * 0.5 + t * 0.5;
        return harvestRisk > 55 ? 3 : harvestRisk > 35 ? 2 : 1;
      default:
        return 2;
    }
  }
  
  function computeSuitability(missionType, env) {
    const { hull, firepower, sensors, fuel, threat } = env;
    
    switch (missionType) {
      case 'RECON':
        return (sensors * 0.5) + ((100 - threat) * 0.3) + (fuel * 0.2);
      case 'CARGO':
        return (hull * 0.35) + (fuel * 0.35) + ((100 - threat) * 0.3);
      case 'ESCORT':
        const threatPenalty = Math.abs(threat - 45) * 0.5;
        return (hull * 0.5) + (50 - threatPenalty) + (sensors * 0.2);
      case 'STRIKE':
        return (firepower * 0.5) + (hull * 0.3) + ((100 - threat) * 0.2);
      case 'HARVEST':
        return ((100 - firepower) * 0.4) + ((100 - threat) * 0.4) + (sensors * 0.2);
      default:
        return 50;
    }
  }
  
  function generateWhyNow(missionType, env) {
    const { hull, firepower, sensors, fuel, threat } = env;
    
    switch (missionType) {
      case 'RECON':
        if (sensors >= 60) return 'Flow signals are clear—good conditions for reconnaissance.';
        if (threat < 40) return 'Low threat environment allows for safe scouting.';
        return 'Standard conditions for sector reconnaissance.';
      case 'CARGO':
        if (hull >= 60 && fuel >= 60) return 'Stable trend with high fuel reserves—ideal for time-based transport.';
        if (threat < 35) return 'Calm sector reduces journey risk.';
        return 'Conditions acceptable for cargo operations.';
      case 'ESCORT':
        if (threat >= 30 && threat <= 60) return 'Moderate threat level—hedged formations add value here.';
        if (hull >= 55) return 'Solid hull integrity supports structured positioning.';
        return 'Standard escort formation conditions.';
      case 'STRIKE':
        if (firepower >= 65) return 'High volatility provides thrust for directional assault.';
        if (hull >= 60 && firepower >= 50) return 'Clear trend direction with adequate firepower.';
        return 'Conditions support tactical strike operations.';
      case 'HARVEST':
        if (firepower <= 40 && threat <= 40) return 'Low volatility, low threat—prime harvesting conditions.';
        if (sensors >= 55) return 'Clear flow signals help identify range boundaries.';
        return 'Range conditions may support premium collection.';
      default:
        return 'Standard operating conditions.';
    }
  }
  
  function generateRecommendations(env) {
    const recommendations = [];
    
    for (const [key, type] of Object.entries(MISSION_TYPES)) {
      const suitability = computeSuitability(key, env);
      const difficulty = computeDifficulty(key, env);
      const whyNow = generateWhyNow(key, env);
      
      recommendations.push({
        type: key,
        ...type,
        suitability: Math.round(suitability),
        difficulty: difficulty,
        whyNow: whyNow,
        recommended: suitability >= 55
      });
    }
    
    recommendations.sort((a, b) => b.suitability - a.suitability);
    return recommendations;
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // MISSION LIFECYCLE (Step 2: Full Play Loop)
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * Create a new mission with full schema
   */
  function createMission(ticker, type, options = {}) {
    const missionType = MISSION_TYPES[type];
    if (!missionType) throw new Error(`Unknown mission type: ${type}`);
    
    const durationKey = options.durationKey || missionType.defaultDuration;
    const duration = DURATION_PRESETS[durationKey] || DURATION_PRESETS['1D'];
    
    return {
      id: generateUUID(),
      createdAt: new Date().toISOString(),
      ticker: ticker.toUpperCase(),
      type: type,
      typeName: missionType.name,
      icon: missionType.icon,
      
      difficulty: options.difficulty || 2,
      duration: {
        key: durationKey,
        targetBars: duration.targetBars,
        label: duration.label
      },
      
      thesis: {
        primary: options.thesis || missionType.bettingOn,
        notes: options.notes || ''
      },
      
      env: options.env || null,
      
      // Step 2: Simulation state
      start: null,  // Set when launched
      sim: {
        speed: options.simSpeed || DEFAULT_SIM_SPEED,
        speedBarsPerSec: SIM_SPEEDS[options.simSpeed || DEFAULT_SIM_SPEED]
      },
      end: null,    // Set when launched
      
      // Step 3: Support slots
      support: {
        slots: [
          { ticker: null, role: null, mods: null },
          { ticker: null, role: null, mods: null }
        ]
      },
      
      status: 'PLANNING',
      logs: [],
      outcome: null,
      
      // Track which bars have been processed for logs
      _lastProcessedBarIndex: null
    };
  }
  
  /**
   * Launch a mission (transition from PLANNING to ACTIVE)
   * STEP 2.1 FIX: Now starts earlier in the CSV so mission can progress through bars
   */
  function launchMission(missionId, tickerData) {
    const missions = loadMissions();
    const mission = missions.find(m => m.id === missionId);
    
    if (!mission) throw new Error(`Mission not found: ${missionId}`);
    if (mission.status !== 'PLANNING') throw new Error(`Mission already launched: ${mission.status}`);
    
    const rows = tickerData.rows;
    const requestedTargetBars = mission.duration.targetBars;
    
    // Choose a start that leaves enough bars to simulate forward
    // End at the last available bar, work backwards to find start
    const endBarIndex = rows.length - 1;
    const startBarIndex = Math.max(0, endBarIndex - requestedTargetBars);
    const effectiveTargetBars = endBarIndex - startBarIndex; // Could be < requested near beginning
    
    mission.start = {
      wallClockMs: Date.now(),
      barIndex: startBarIndex,
      barTime: rows[startBarIndex].time,
      price: rows[startBarIndex].close
    };
    
    mission.end = {
      targetBars: effectiveTargetBars,
      requestedTargetBars: requestedTargetBars,
      endBarIndex: endBarIndex,
      endBarTime: rows[endBarIndex].time
    };
    
    mission.status = 'ACTIVE';
    mission._lastProcessedBarIndex = startBarIndex;
    
    mission.logs.push({
      tMs: Date.now(),
      barIndex: startBarIndex,
      kind: 'EVENT',
      msg: pxIcon('rocket', '#33ff99', 12) + ` Mission launched from ${mission.ticker} @ $${rows[startBarIndex].close.toFixed(2)}`
    });
    
    // Warn if mission window was shortened due to limited data
    if (effectiveTargetBars < requestedTargetBars) {
      mission.logs.push({
        tMs: Date.now(),
        barIndex: startBarIndex,
        kind: 'INFO',
        msg: pxIcon('satellite', '#47d4ff', 12) + ` Note: Mission window shortened to ${effectiveTargetBars} bars due to limited chart history`
      });
    }
    
    saveMissions(missions);
    return mission;
  }
  
  /**
   * Calculate mission progress
   * STEP 2.1 FIX: Safe division to avoid NaN
   */
  function getMissionProgress(mission) {
    if (mission.status === 'PLANNING') {
      return { barsElapsed: 0, currentBarIndex: 0, progress: 0, timeRemaining: mission.duration.label };
    }
    
    if (mission.status === 'COMPLETE' || mission.status === 'DAMAGED') {
      const targetBars = mission.end?.targetBars || 1;
      return { barsElapsed: targetBars, currentBarIndex: mission.end?.endBarIndex || 0, progress: 1, timeRemaining: 'Complete' };
    }
    
    const elapsed = (Date.now() - mission.start.wallClockMs) / 1000;
    const barsElapsed = Math.floor(elapsed * mission.sim.speedBarsPerSec);
    const currentBarIndex = clamp(mission.start.barIndex + barsElapsed, mission.start.barIndex, mission.end.endBarIndex);
    
    // Safe division to avoid NaN
    const denom = Math.max(1, mission.end.targetBars);
    const progress = Math.min(barsElapsed / denom, 1);
    
    const barsRemaining = mission.end.targetBars - barsElapsed;
    const secsRemaining = barsRemaining / mission.sim.speedBarsPerSec;
    
    let timeRemaining;
    if (secsRemaining <= 0) {
      timeRemaining = 'Completing...';
    } else if (secsRemaining < 60) {
      timeRemaining = `${Math.ceil(secsRemaining)}s`;
    } else if (secsRemaining < 3600) {
      timeRemaining = `${Math.ceil(secsRemaining / 60)}m`;
    } else {
      timeRemaining = `${(secsRemaining / 3600).toFixed(1)}h`;
    }
    
    return { barsElapsed, currentBarIndex, progress, timeRemaining, secsRemaining };
  }
  
  /**
   * Fast-forward mission by N bars
   */
  function fastForwardMission(missionId, bars) {
    const missions = loadMissions();
    const mission = missions.find(m => m.id === missionId);
    
    if (!mission || mission.status !== 'ACTIVE') return null;
    
    // Adjust wall clock time backwards to simulate elapsed time
    const secsToSubtract = bars / mission.sim.speedBarsPerSec;
    mission.start.wallClockMs -= secsToSubtract * 1000;
    
    saveMissions(missions);
    return mission;
  }
  
  /**
   * Complete mission immediately
   */
  function completeMissionNow(missionId) {
    const missions = loadMissions();
    const mission = missions.find(m => m.id === missionId);
    
    if (!mission || mission.status !== 'ACTIVE') return null;
    
    // Set wall clock so full duration has elapsed
    const totalSecs = mission.end.targetBars / mission.sim.speedBarsPerSec;
    mission.start.wallClockMs = Date.now() - (totalSecs * 1000) - 1000;
    
    saveMissions(missions);
    return mission;
  }
  
  /**
   * Abort a mission
   */
  function abortMission(missionId) {
    const missions = loadMissions();
    const mission = missions.find(m => m.id === missionId);
    
    if (!mission) return null;
    
    // Store ticker before changing status for event
    const missionTicker = mission.ticker;
    const missionType = mission.type;
    
    mission.status = 'DAMAGED';
    mission.outcome = {
      grade: 'D',
      score: 0,
      explanation: 'Mission aborted by command. No data collected.',
      whatHelped: [],
      whatHurt: ['Mission terminated prematurely']
    };
    mission.logs.push({
      tMs: Date.now(),
      barIndex: mission._lastProcessedBarIndex || 0,
      kind: 'WARN',
      msg: pxIcon('warning', '#ffaa33', 12) + ' Mission aborted by operator command'
    });
    
    saveMissions(missions);
    
    // Step 8: Emit mission:damaged event for progression system
    if (window.PARALLAX_BUS) {
      window.PARALLAX_BUS.emit('mission:damaged', {
        ticker: missionTicker,
        missionType: missionType
      });
    }
    
    return mission;
  }
  
  /**
   * Delete a mission
   */
  function deleteMission(missionId) {
    let missions = loadMissions();
    missions = missions.filter(m => m.id !== missionId);
    saveMissions(missions);
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // LOG GENERATION (Step 2)
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * Generate logs for bars that have elapsed since last check
   */
  function generateLogsForMission(mission, tickerData) {
    if (mission.status !== 'ACTIVE') return [];
    
    const rows = tickerData.rows;
    const progress = getMissionProgress(mission);
    const currentBarIndex = progress.currentBarIndex;
    const lastProcessed = mission._lastProcessedBarIndex || mission.start.barIndex;
    
    if (currentBarIndex <= lastProcessed) return [];
    
    const newLogs = [];
    
    // Step 3: Track support intervention cooldowns (1 per role per mission)
    if (!mission._supportInterventionCount) {
      mission._supportInterventionCount = { SCOUT: 0, ESCORT: 0, CARRIER: 0, UTILITY: 0 };
    }
    const MAX_INTERVENTIONS_PER_ROLE = 2;
    
    // Process each new bar
    for (let i = lastProcessed + 1; i <= currentBarIndex && i < rows.length; i++) {
      if (mission.logs.length >= MAX_LOGS_PER_MISSION) break;
      
      const bar = rows[i];
      const prevBar = i > 0 ? rows[i - 1] : bar;
      const triggers = evaluateLogTriggers(bar, prevBar, rows, i);
      
      // Add up to 2 logs per bar
      let logsThisBar = 0;
      for (const trigger of triggers) {
        if (logsThisBar >= 2) break;
        if (mission.logs.length >= MAX_LOGS_PER_MISSION) break;
        
        const log = {
          tMs: Date.now(),
          barIndex: i,
          kind: trigger.kind,
          msg: trigger.msg
        };
        newLogs.push(log);
        mission.logs.push(log);
        logsThisBar++;
        
        // Step 3: Add support intervention log if applicable
        if (mission.logs.length < MAX_LOGS_PER_MISSION && logsThisBar < 2) {
          const intervention = generateSupportIntervention(mission, trigger, mission._supportInterventionCount, MAX_INTERVENTIONS_PER_ROLE);
          if (intervention) {
            const interventionLog = {
              tMs: Date.now(),
              barIndex: i,
              kind: 'INFO',
              msg: intervention.msg
            };
            newLogs.push(interventionLog);
            mission.logs.push(interventionLog);
            mission._supportInterventionCount[intervention.role]++;
            logsThisBar++;
          }
        }
      }
    }
    
    mission._lastProcessedBarIndex = currentBarIndex;
    return newLogs;
  }
  
  /**
   * Generate a support intervention log based on trigger type (Step 3)
   */
  function generateSupportIntervention(mission, trigger, counts, maxPerRole) {
    if (!mission.support?.slots) return null;
    
    // Storm triggers → ESCORT intervenes
    if (trigger.msg.includes('Storm front') || trigger.msg.includes('Turbulence') || trigger.msg.includes('Engine burn')) {
      if (hasRole(mission, 'ESCORT') && counts.ESCORT < maxPerRole) {
        return { role: 'ESCORT', msg: SUPPORT_ROLES.ESCORT.interventionLog };
      }
    }
    
    // Flow triggers → SCOUT intervenes
    if (trigger.msg.includes('flow') || trigger.msg.includes('Sensors')) {
      if (hasRole(mission, 'SCOUT') && counts.SCOUT < maxPerRole) {
        return { role: 'SCOUT', msg: SUPPORT_ROLES.SCOUT.interventionLog };
      }
    }
    
    // Time/endurance triggers → CARRIER intervenes
    if (trigger.msg.includes('Course correction') || trigger.msg.includes('Signal flare')) {
      if (hasRole(mission, 'CARRIER') && counts.CARRIER < maxPerRole) {
        return { role: 'CARRIER', msg: SUPPORT_ROLES.CARRIER.interventionLog };
      }
    }
    
    return null;
  }
  
  /**
   * Evaluate log triggers for a specific bar
   */
  function evaluateLogTriggers(bar, prevBar, rows, barIndex) {
    const triggers = [];
    
    // --- Band extremes ---
    const bandKeys = ['A1','A2','A3','A4','A5','B1','B2','B3','B4','B5','C1','C2','C3','C4','C5','D1','D2','D3','D4','D5','E1','E2','E3','E4','E5','F1','F2','F3','F4','F5'];
    const bandValues = bandKeys.map(k => bar[k]).filter(v => v != null && !isNaN(v));
    
    if (bandValues.length > 0) {
      const lower = Math.min(...bandValues);
      const upper = Math.max(...bandValues);
      const range = upper - lower;
      
      if (range > 0) {
        const pos = (bar.close - lower) / range;
        if (pos > 0.95) {
          triggers.push({ kind: 'WARN', msg: pxIcon('warning', '#ffaa33', 12) + ' Storm front: price approaching upper envelope extreme' });
        } else if (pos < 0.05) {
          triggers.push({ kind: 'WARN', msg: pxIcon('warning', '#ffaa33', 12) + ' Storm front: price approaching lower envelope extreme' });
        }
      }
    }
    
    // --- Histogram flip ---
    if (bar.histogram != null && prevBar.histogram != null) {
      const currSign = bar.histogram >= 0;
      const prevSign = prevBar.histogram >= 0;
      if (currSign !== prevSign) {
        triggers.push({ kind: 'WARN', msg: pxIcon('lightning', '#ffaa33', 12) + ' Turbulence: momentum flip detected (histogram sign change)' });
      }
    }
    
    // --- Firepower spike (STEP 2.1: adaptive threshold) ---
    if (bar.high != null && bar.low != null && bar.close != null && bar.close > 0) {
      const currentATR = (bar.high - bar.low) / bar.close;
      
      // Compute adaptive threshold using last 32 bars
      const lookback = Math.min(32, barIndex);
      if (lookback >= 5) {
        const recentATRs = [];
        for (let j = Math.max(0, barIndex - lookback); j < barIndex; j++) {
          const r = rows[j];
          if (r.high && r.low && r.close && r.close > 0) {
            recentATRs.push((r.high - r.low) / r.close);
          }
        }
        
        if (recentATRs.length >= 5) {
          // Sort and find 80th percentile
          recentATRs.sort((a, b) => a - b);
          const p80Index = Math.floor(recentATRs.length * 0.8);
          const threshold = recentATRs[p80Index];
          
          if (currentATR > threshold && currentATR > 0.02) { // Also require minimum 2%
            triggers.push({ kind: 'EVENT', msg: pxIcon('fire', '#ffaa33', 12) + ` Engine burn: high volatility bar (${(currentATR * 100).toFixed(1)}% range, above 80th percentile)` });
          }
        }
      } else if (currentATR > 0.05) {
        // Fallback for insufficient history
        triggers.push({ kind: 'EVENT', msg: pxIcon('fire', '#ffaa33', 12) + ` Engine burn: high volatility bar (${(currentATR * 100).toFixed(1)}% range)` });
      }
    }
    
    // --- Volume surge/drought ---
    if (bar.volume != null && bar.volumeMA != null && bar.volumeMA > 0) {
      const ratio = bar.volume / bar.volumeMA;
      if (ratio > 1.5) {
        triggers.push({ kind: 'INFO', msg: pxIcon('satellite', '#47d4ff', 12) + ` Sensors: flow surge detected (${ratio.toFixed(2)}x Volume MA)` });
      } else if (ratio < 0.7) {
        triggers.push({ kind: 'INFO', msg: pxIcon('satellite', '#47d4ff', 12) + ` Sensors: flow drought (${ratio.toFixed(2)}x Volume MA)` });
      }
    }
    
    // --- KRE cross ---
    if (bar.kernelRegression != null && prevBar.kernelRegression != null) {
      const currAbove = bar.close > bar.kernelRegression;
      const prevAbove = prevBar.close > prevBar.kernelRegression;
      if (currAbove !== prevAbove) {
        const direction = currAbove ? 'above' : 'below';
        triggers.push({ kind: 'EVENT', msg: pxIcon('target', '#33ff99', 12) + ` Course correction: price crossed ${direction} trend line` });
      }
    }
    
    // --- Buy/Sell signal ---
    const hasBuy = bar.buy != null && bar.buy !== 0 && !isNaN(bar.buy);
    const hasSell = bar.sell != null && bar.sell !== 0 && !isNaN(bar.sell);
    if (hasBuy) {
      triggers.push({ kind: 'EVENT', msg: '🟢 Signal flare: BUY indicator triggered' });
    }
    if (hasSell) {
      triggers.push({ kind: 'EVENT', msg: '🔴 Signal flare: SELL indicator triggered' });
    }
    
    return triggers;
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // MISSION RESOLUTION & SCORING (Step 2)
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * Compute summary features from mission window
   */
  function computeMissionWindowFeatures(mission, tickerData) {
    const rows = tickerData.rows;
    const startIdx = mission.start.barIndex;
    const endIdx = mission.end.endBarIndex;
    
    // Clamp indices
    const actualEnd = Math.min(endIdx, rows.length - 1);
    const windowBars = rows.slice(startIdx, actualEnd + 1);
    
    if (windowBars.length < 2) {
      return { returnPct: 0, rangePct: 0, chop: 0, extremes: 0, flowAvg: 1, trendClarity: 0 };
    }
    
    const closeStart = windowBars[0].close;
    const closeEnd = windowBars[windowBars.length - 1].close;
    const returnPct = (closeEnd - closeStart) / closeStart;
    
    // Average range
    let rangeSum = 0;
    let rangeCount = 0;
    for (const bar of windowBars) {
      if (bar.high && bar.low && bar.close && bar.close > 0) {
        rangeSum += (bar.high - bar.low) / bar.close;
        rangeCount++;
      }
    }
    const rangePct = rangeCount > 0 ? rangeSum / rangeCount : 0;
    
    // Histogram chop
    const histValues = windowBars.map(b => b.histogram).filter(v => v != null);
    const chop = countSignFlips(histValues);
    
    // Envelope extremes
    let extremes = 0;
    const bandKeys = ['A1','A2','A3','A4','A5','B1','B2','B3','B4','B5','C1','C2','C3','C4','C5','D1','D2','D3','D4','D5','E1','E2','E3','E4','E5','F1','F2','F3','F4','F5'];
    
    for (const bar of windowBars) {
      const bandValues = bandKeys.map(k => bar[k]).filter(v => v != null && !isNaN(v));
      if (bandValues.length > 0) {
        const lower = Math.min(...bandValues);
        const upper = Math.max(...bandValues);
        const range = upper - lower;
        if (range > 0) {
          const pos = (bar.close - lower) / range;
          if (pos > 0.95 || pos < 0.05) extremes++;
        }
      }
    }
    
    // Flow average
    let flowSum = 0;
    let flowCount = 0;
    for (const bar of windowBars) {
      if (bar.volume && bar.volumeMA && bar.volumeMA > 0) {
        flowSum += bar.volume / bar.volumeMA;
        flowCount++;
      }
    }
    const flowAvg = flowCount > 0 ? flowSum / flowCount : 1;
    
    // Trend clarity (KRE slope)
    const kreSeries = windowBars.map(b => b.kernelRegression).filter(v => v != null && !isNaN(v));
    const kreSlope = kreSeries.length >= 2 ? linearRegressionSlope(kreSeries) : 0;
    const trendClarity = Math.min(Math.abs(kreSlope) * 100, 1); // Normalized 0-1
    
    // Max adverse excursion
    let maxDrawdown = 0;
    for (const bar of windowBars) {
      const drawdown = (closeStart - bar.low) / closeStart;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
    
    return {
      returnPct,
      rangePct,
      chop,
      extremes,
      flowAvg,
      trendClarity,
      maxDrawdown,
      closeStart,
      closeEnd,
      barsActual: windowBars.length
    };
  }
  
  /**
   * Score mission by type (Step 3: Support modifiers applied)
   */
  function scoreMission(mission, features) {
    const type = mission.type;
    const startingThreat = mission.env?.threat || 50;
    const startingSensors = mission.env?.sensors || 50;
    const startingHull = mission.env?.hull || 50;
    const startingFirepower = mission.env?.firepower || 50;
    
    // Step 3: Get combined modifiers from support slots
    const mods = getCombinedMods(mission);
    const hasSupport = mission.support?.slots?.some(s => s.ticker);
    
    // Apply sensorsBoost to flow quality
    const flowAvgEffective = features.flowAvg * (1 + mods.sensorsBoost);
    
    // Track penalty dampening for explanation
    let penaltiesDampened = 0;
    
    let score = 50; // Base score
    const whatHelped = [];
    const whatHurt = [];
    
    switch (type) {
      case 'RECON': {
        // Reward when threat prediction matched reality
        const realizedChaos = (features.chop + features.extremes) / (features.barsActual || 1);
        const predictedChaos = startingThreat > 50;
        const actualChaos = realizedChaos > 0.3;
        
        if ((predictedChaos && actualChaos) || (!predictedChaos && !actualChaos)) {
          score += 25;
          whatHelped.push('Threat assessment matched realized conditions');
        } else {
          const penalty = Math.round(15 * mods.threatDamp);
          score -= penalty;
          if (penalty < 15) penaltiesDampened += (15 - penalty);
          whatHurt.push('Threat prediction did not match market behavior');
        }
        
        // Reward high flow (using effective flow with sensors boost)
        if (flowAvgEffective > 1.2) {
          score += 15;
          whatHelped.push(`Strong flow quality (${flowAvgEffective.toFixed(2)}x effective)`);
        } else if (flowAvgEffective < 0.8) {
          score -= 10;
          whatHurt.push('Low flow quality degraded reconnaissance');
        }
        
        // Bonus for low chop
        if (features.chop <= 3) {
          score += 10;
          whatHelped.push('Stable regime made pattern recognition easier');
        }
        break;
      }
      
      case 'CARGO': {
        // Apply time buffer to volatility penalty threshold
        const volThreshold = 0.05 * (1 + mods.timeBuffer);
        
        // Reward quiet markets
        if (features.rangePct < 0.025) {
          score += 25;
          whatHelped.push('Low volatility—smooth passage');
        } else if (features.rangePct > volThreshold) {
          const penalty = Math.round(20 * mods.threatDamp);
          score -= penalty;
          if (penalty < 20) penaltiesDampened += (20 - penalty);
          whatHurt.push('High volatility disrupted cargo transport');
        }
        
        // Extremes penalty dampened by threat damp
        if (features.extremes <= 1) {
          score += 15;
          whatHelped.push('Price stayed within safe corridor');
        } else if (features.extremes >= 5) {
          const penalty = Math.round(15 * mods.threatDamp);
          score -= penalty;
          if (penalty < 15) penaltiesDampened += (15 - penalty);
          whatHurt.push('Multiple envelope breaches caused damage');
        }
        
        // Chop penalty dampened by time buffer
        if (features.chop <= 4) {
          score += 10;
          whatHelped.push('Consistent direction minimized time cost');
        } else if (features.chop >= 10) {
          const penalty = Math.round(10 * (1 - mods.timeBuffer));
          score -= penalty;
          if (penalty < 10) penaltiesDampened += (10 - penalty);
          whatHurt.push('Excessive chop eroded time value');
        }
        break;
      }
      
      case 'ESCORT': {
        // Reward low drawdown
        const drawdownThreshold = 0.02 * (1 + mods.stabilityBoost);
        if (features.maxDrawdown < drawdownThreshold) {
          score += 30;
          whatHelped.push('Excellent risk control—minimal adverse excursion');
        } else if (features.maxDrawdown > 0.08) {
          const penalty = Math.round(25 * mods.threatDamp);
          score -= penalty;
          if (penalty < 25) penaltiesDampened += (25 - penalty);
          whatHurt.push('Large drawdown exceeded hedge coverage');
        }
        
        // Extremes penalty dampened
        if (features.extremes <= 2) {
          score += 15;
          whatHelped.push('Stable path within formation parameters');
        } else {
          const penalty = Math.round(10 * mods.threatDamp);
          score -= penalty;
          if (penalty < 10) penaltiesDampened += (10 - penalty);
          whatHurt.push('Envelope breaches stressed formation');
        }
        
        // Moderate conditions are ideal
        if (features.rangePct > 0.02 && features.rangePct < 0.05) {
          score += 5;
          whatHelped.push('Volatility within hedge-profitable range');
        }
        break;
      }
      
      case 'STRIKE': {
        // Reward strong directional move
        const absReturn = Math.abs(features.returnPct);
        if (absReturn > 0.05) {
          score += 30;
          whatHelped.push(`Strong directional move (${(features.returnPct * 100).toFixed(1)}%)`);
        } else if (absReturn < 0.02) {
          const penalty = Math.round(20 * (1 - mods.timeBuffer));
          score -= penalty;
          if (penalty < 20) penaltiesDampened += (20 - penalty);
          whatHurt.push('Insufficient directional movement');
        }
        
        // Reward alignment with trend
        if (features.trendClarity > 0.3) {
          score += 15;
          whatHelped.push('Clear trend supported strike trajectory');
        }
        
        // Penalize chop (dampened by threat damp)
        if (features.chop >= 8) {
          const penalty = Math.round(15 * mods.threatDamp);
          score -= penalty;
          if (penalty < 15) penaltiesDampened += (15 - penalty);
          whatHurt.push('Choppy conditions wasted strike energy');
        } else if (features.chop <= 3) {
          score += 10;
          whatHelped.push('Clean momentum maintained strike efficiency');
        }
        break;
      }
      
      case 'HARVEST': {
        // Reward staying in range (dampened by threat damp)
        if (features.extremes <= 1) {
          score += 30;
          whatHelped.push('Price remained within harvest zone');
        } else if (features.extremes >= 5) {
          const penalty = Math.round(25 * mods.threatDamp);
          score -= penalty;
          if (penalty < 25) penaltiesDampened += (25 - penalty);
          whatHurt.push('Multiple breakouts ruined harvest conditions');
        }
        
        // Low range is good
        if (features.rangePct < 0.025) {
          score += 20;
          whatHelped.push('Low volatility maximized premium capture');
        } else if (features.rangePct > 0.05) {
          const penalty = Math.round(20 * mods.threatDamp);
          score -= penalty;
          if (penalty < 20) penaltiesDampened += (20 - penalty);
          whatHurt.push('High volatility exceeded harvest parameters');
        }
        
        // Low chop
        if (features.chop <= 4) {
          score += 10;
          whatHelped.push('Stable regime supported range strategy');
        }
        break;
      }
    }
    
    // Step 3: Add support effects to score and explanations
    if (hasSupport) {
      // Bonus for having support
      const stabilityBonus = Math.round(mods.stabilityBoost * 50);
      score += stabilityBonus;
      
      // Add support-specific "what helped" entries
      if (hasRole(mission, 'SCOUT') && mods.sensorsBoost > 0) {
        whatHelped.push('Scout wing increased effective flow quality');
      }
      if (hasRole(mission, 'ESCORT') && penaltiesDampened > 0) {
        whatHelped.push('Escort formation reduced turbulence penalties');
      }
      if (hasRole(mission, 'CARRIER') && mods.timeBuffer > 0) {
        whatHelped.push('Carrier resupply extended operational endurance');
      }
      if (hasRole(mission, 'UTILITY')) {
        whatHelped.push('Utility craft improved overall resilience');
      }
    }
    
    // Clamp score
    score = clamp(score, 0, 100);
    
    // Convert to grade
    let grade;
    if (score >= 90) grade = 'S';
    else if (score >= 80) grade = 'A';
    else if (score >= 70) grade = 'B';
    else if (score >= 60) grade = 'C';
    else grade = 'D';
    
    return { score, grade, whatHelped, whatHurt, supportApplied: hasSupport };
  }
  
  /**
   * Generate explanation paragraph
   */
  function generateExplanation(mission, features, scoreResult) {
    const type = MISSION_TYPES[mission.type];
    const returnDesc = features.returnPct >= 0 
      ? `gained ${(features.returnPct * 100).toFixed(1)}%`
      : `lost ${(Math.abs(features.returnPct) * 100).toFixed(1)}%`;
    
    const gradeDesc = {
      'S': 'exceptional',
      'A': 'strong',
      'B': 'solid',
      'C': 'acceptable',
      'D': 'poor'
    }[scoreResult.grade];
    
    let explanation = `This ${type.name} mission concluded with a ${gradeDesc} Grade ${scoreResult.grade} (score: ${scoreResult.score}/100). `;
    explanation += `Over ${features.barsActual} bars, ${mission.ticker} ${returnDesc}. `;
    
    if (scoreResult.whatHelped.length > 0) {
      explanation += `Key factors that supported success: ${scoreResult.whatHelped.slice(0, 2).join('; ')}. `;
    }
    
    if (scoreResult.whatHurt.length > 0) {
      explanation += `Challenges encountered: ${scoreResult.whatHurt.slice(0, 2).join('; ')}. `;
    }
    
    explanation += `This teaches: ${type.teaches}`;
    
    return explanation;
  }
  
  /**
   * Resolve a completed mission
   */
  function resolveMission(missionId, tickerData) {
    const missions = loadMissions();
    const mission = missions.find(m => m.id === missionId);
    
    if (!mission || mission.status !== 'ACTIVE') return null;
    
    const features = computeMissionWindowFeatures(mission, tickerData);
    const scoreResult = scoreMission(mission, features);
    const explanation = generateExplanation(mission, features, scoreResult);
    
    mission.status = 'COMPLETE';
    mission.completedAt = new Date().toISOString();
    mission.outcome = {
      grade: scoreResult.grade,
      score: scoreResult.score,
      explanation: explanation,
      whatHelped: scoreResult.whatHelped,
      whatHurt: scoreResult.whatHurt,
      features: features
    };
    
    mission.logs.push({
      tMs: Date.now(),
      barIndex: mission.end.endBarIndex,
      kind: 'EVENT',
      msg: `🏁 Mission complete — Grade ${scoreResult.grade} (${scoreResult.score}/100)`
    });
    
    saveMissions(missions);
    
    // Step 8: Emit mission:complete event for progression system
    if (window.PARALLAX_BUS) {
      window.PARALLAX_BUS.emit('mission:complete', {
        ticker: mission.ticker,
        missionType: mission.type,
        difficulty: mission.difficulty || 1,
        duration: mission.duration?.label || null,
        grade: scoreResult.grade,
        score: scoreResult.score
      });
    }
    
    return mission;
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // PERSISTENCE
  // ═══════════════════════════════════════════════════════════════════
  
  function loadMissions() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('[MissionSystem] Failed to load missions:', e);
      return [];
    }
  }
  
  function saveMissions(missions) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(missions));
    } catch (e) {
      console.error('[MissionSystem] Failed to save missions:', e);
    }
  }
  
  function getMission(missionId) {
    const missions = loadMissions();
    return missions.find(m => m.id === missionId) || null;
  }
  
  function getActiveMissions() {
    return loadMissions().filter(m => m.status === 'ACTIVE');
  }
  
  function getActiveMissionForTicker(ticker) {
    return loadMissions().find(m => m.ticker === ticker.toUpperCase() && m.status === 'ACTIVE') || null;
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════
  
  return {
    // Constants
    SIM_SPEEDS,
    DURATION_PRESETS,
    DEFAULT_SIM_SPEED,
    DEFAULT_LOOKBACK,
    MISSION_TYPES,
    SUPPORT_ROLES,
    
    // Stat computation
    computeEnvironment,
    
    // Recommendations
    generateRecommendations,
    computeSuitability,
    computeDifficulty,
    
    // Mission lifecycle
    createMission,
    launchMission,
    getMissionProgress,
    fastForwardMission,
    completeMissionNow,
    abortMission,
    deleteMission,
    resolveMission,
    
    // Logs
    generateLogsForMission,
    
    // Persistence
    loadMissions,
    saveMissions,
    getMission,
    getActiveMissions,
    getActiveMissionForTicker,
    
    // Step 3: Fleet Support
    FleetCache,
    classifyRole,
    getTickerRole,
    isTickerLocked,
    getLockedTickers,
    assignSupport,
    removeSupport,
    getCombinedMods,
    hasRole,
    
    // Mission type info
    getMissionType: (type) => MISSION_TYPES[type] || null,
    getAllMissionTypes: () => Object.values(MISSION_TYPES)
  };
  
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MissionSystem;
}
