/**
 * ═══════════════════════════════════════════════════════════════════
 * MISSION BRIDGE (Step 4)
 * Read-only adapter for mission state on index.html
 * 
 * This module reads localStorage WITHOUT importing mission-system.js
 * or loading CSVs. It provides query helpers for the dashboard to
 * display mission context without deep coupling.
 * ═══════════════════════════════════════════════════════════════════
 */

window.MissionBridge = (function() {
  'use strict';
  
  const STORAGE_KEY = 'PARALLAX_MISSIONS_V1';
  
  // Simulation speed constants (mirrored from mission-system.js)
  const SIM_SPEEDS = {
    '1x': 0.25,
    '5x': 1.25,
    '20x': 5.0
  };
  
  /**
   * Load all missions from localStorage (defensive parsing)
   */
  function loadAll() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      const missions = JSON.parse(data);
      if (!Array.isArray(missions)) return [];
      return missions;
    } catch (e) {
      console.warn('[MissionBridge] Failed to parse missions:', e);
      return [];
    }
  }
  
  /**
   * Get active missions only
   */
  function getActive() {
    return loadAll().filter(m => m.status === 'ACTIVE');
  }
  
  /**
   * Get completed missions
   */
  function getCompleted() {
    return loadAll().filter(m => m.status === 'COMPLETE');
  }
  
  /**
   * Get damaged/aborted missions
   */
  function getDamaged() {
    return loadAll().filter(m => m.status === 'DAMAGED');
  }
  
  /**
   * Get all missions for a specific ticker
   */
  function getForTicker(ticker) {
    if (!ticker) return [];
    const t = ticker.toUpperCase();
    return loadAll().filter(m => m.ticker === t);
  }
  
  /**
   * Get the latest mission for a ticker (any status)
   */
  function getLatestForTicker(ticker) {
    if (!ticker) return null;
    const missions = getForTicker(ticker);
    if (missions.length === 0) return null;
    
    // Sort by createdAt descending
    missions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return missions[0];
  }
  
  /**
   * Get active mission for a ticker (if any)
   */
  function getActiveForTicker(ticker) {
    if (!ticker) return null;
    const t = ticker.toUpperCase();
    return loadAll().find(m => m.ticker === t && m.status === 'ACTIVE') || null;
  }
  
  /**
   * Check if a ticker is assigned as support to any ACTIVE mission
   * Returns { missionId, missionTicker, role } or null
   */
  function getAssignedSupportForTicker(ticker) {
    if (!ticker) return null;
    const t = ticker.toUpperCase();
    const activeMissions = getActive();
    
    for (const m of activeMissions) {
      if (!m.support?.slots) continue;
      for (const slot of m.support.slots) {
        if (slot.ticker === t) {
          return {
            missionId: m.id,
            missionTicker: m.ticker,
            role: slot.role
          };
        }
      }
    }
    return null;
  }
  
  /**
   * Get mission counts by status
   */
  function getCounts() {
    const missions = loadAll();
    return {
      active: missions.filter(m => m.status === 'ACTIVE').length,
      complete: missions.filter(m => m.status === 'COMPLETE').length,
      damaged: missions.filter(m => m.status === 'DAMAGED').length,
      planning: missions.filter(m => m.status === 'PLANNING').length,
      total: missions.length
    };
  }
  
  /**
   * Get recent completed missions (sorted by completion, newest first)
   */
  function getRecentCompleted(limit = 3) {
    const completed = getCompleted();
    // Sort by createdAt descending (newest first)
    completed.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return completed.slice(0, limit);
  }
  
  /**
   * Calculate mission progress (replicated from mission-system.js)
   * Returns { barsElapsed, progress, timeRemaining }
   */
  function getMissionProgress(mission) {
    if (!mission) return null;
    
    if (mission.status === 'PLANNING') {
      return { barsElapsed: 0, progress: 0, timeRemaining: mission.duration?.label || '--' };
    }
    
    if (mission.status === 'COMPLETE' || mission.status === 'DAMAGED') {
      return { barsElapsed: mission.end?.targetBars || 0, progress: 1, timeRemaining: 'Complete' };
    }
    
    // Active mission - calculate progress
    if (!mission.start?.wallClockMs || !mission.sim?.speedBarsPerSec) {
      return { barsElapsed: 0, progress: 0, timeRemaining: '--' };
    }
    
    const elapsed = (Date.now() - mission.start.wallClockMs) / 1000;
    const barsElapsed = Math.floor(elapsed * mission.sim.speedBarsPerSec);
    const targetBars = mission.end?.targetBars || 1;
    const progress = Math.min(barsElapsed / targetBars, 1);
    
    const barsRemaining = Math.max(0, targetBars - barsElapsed);
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
    
    return { barsElapsed, progress, timeRemaining };
  }
  
  /**
   * Get support summary for a mission
   * Returns array of { ticker, role } for filled slots
   */
  function getSupportSummary(mission) {
    if (!mission?.support?.slots) return [];
    return mission.support.slots
      .filter(s => s.ticker)
      .map(s => ({ ticker: s.ticker, role: s.role }));
  }
  
  /**
   * Get last N logs from a mission
   */
  function getRecentLogs(mission, limit = 3) {
    if (!mission?.logs) return [];
    return mission.logs.slice(-limit);
  }
  
  // Public API
  return {
    loadAll,
    getActive,
    getCompleted,
    getDamaged,
    getForTicker,
    getLatestForTicker,
    getActiveForTicker,
    getAssignedSupportForTicker,
    getCounts,
    getRecentCompleted,
    getMissionProgress,
    getSupportSummary,
    getRecentLogs
  };
  
})();
