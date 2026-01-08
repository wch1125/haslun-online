/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SPACE CAPITAL - PLAYER MANAGER
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Manages pilot profiles for the fleet command system.
 * - Profile CRUD (create, read, update, delete)
 * - Profile switching
 * - Callsign management
 * - Links to PositionManager for per-profile positions
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

window.PlayerManager = (function() {
  'use strict';

  const STORAGE_PROFILES_KEY = 'space-capital-profiles';
  const STORAGE_ACTIVE_KEY = 'space-capital-active-profile';
  const STORAGE_VERSION = 1;
  const MAX_PROFILES = 8;

  // Halloween pilot avatars (PNG format)
  const PILOT_AVATARS = [
    { id: 'vampire', name: 'Vampire', file: 'vampire-pilot.png' },
    { id: 'werewolf', name: 'Werewolf', file: 'werewolf-pilot.png' },
    { id: 'witch', name: 'Witch', file: 'witch-pilot.png' },
    { id: 'skeleton', name: 'Skeleton', file: 'skeleton-pilot.png' },
    { id: 'zombie', name: 'Zombie', file: 'zombie-pilot.png' },
    { id: 'ghost', name: 'Ghost', file: 'ghost-pilot.png' },
    { id: 'pumpkin', name: 'Pumpkin', file: 'pumpkin-pilot.png' },
    { id: 'franken', name: 'Franken', file: 'frankenstein-pilot.png' }
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // GUEST PILOT - Read-only with canonical trade data
  // "You inherited someone else's cockpit"
  // ═══════════════════════════════════════════════════════════════════════════
  const GUEST_PROFILE = {
    id: 'guest',
    name: 'GUEST PILOT',
    callsign: 'GHOST-00',
    avatar: 'ghost',
    created: '2024-01-01T00:00:00Z',
    lastActive: null,
    type: 'guest',          // Guest = read-only pilot
    locked: true,           // Cannot modify
    subtitle: 'ARCHIVED FLIGHT DATA',
    source: 'canonical',
    tradeDataPath: '../data/guest/trade-confirms.csv'
  };

  // Legacy alias
  const DEMO_PROFILE = GUEST_PROFILE;

  let profiles = {};
  let activeProfileId = null;
  let listeners = [];
  
  // Cached trade data and pilot stats
  let guestTradeData = null;
  let guestPilotStats = null;

  // ═══════════════════════════════════════════════════════════════════════════
  // STORAGE
  // ═══════════════════════════════════════════════════════════════════════════

  function load() {
    try {
      // Load profiles
      const stored = localStorage.getItem(STORAGE_PROFILES_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.version === STORAGE_VERSION) {
          profiles = data.profiles || {};
        }
      }

      // Ensure guest profile exists (canonical, read-only)
      // Use 'guest' as primary, keep 'demo' for backward compatibility
      if (!profiles['guest']) {
        profiles['guest'] = { ...GUEST_PROFILE };
      }
      // Migrate old 'demo' to 'guest'
      if (profiles['demo'] && !profiles['guest']) {
        profiles['guest'] = { ...GUEST_PROFILE };
      }
      delete profiles['demo']; // Remove legacy demo

      // Load active profile
      activeProfileId = localStorage.getItem(STORAGE_ACTIVE_KEY);
      
      // Migrate 'demo' to 'guest'
      if (activeProfileId === 'demo') {
        activeProfileId = 'guest';
      }
      
      // Default to guest
      if (!activeProfileId || !profiles[activeProfileId]) {
        activeProfileId = 'guest';
      }

      console.log('[PlayerManager] Loaded', Object.keys(profiles).length, 'profiles, active:', activeProfileId);
      
      // Load Guest trade data asynchronously
      loadGuestTradeData();
      
      return true;
    } catch (e) {
      console.warn('[PlayerManager] Failed to load:', e);
      profiles = { 'guest': { ...GUEST_PROFILE } };
      activeProfileId = 'guest';
      return false;
    }
  }

  /**
   * Load canonical trade data for Guest pilot
   * "Recovered trade confirms loaded - Pilot memory reconstructed"
   */
  async function loadGuestTradeData() {
    if (guestTradeData) return guestTradeData; // Already loaded
    
    try {
      if (typeof TradeLoader !== 'undefined') {
        console.log('[PlayerManager] Loading Guest canonical trade data...');
        guestTradeData = await TradeLoader.loadTradeConfirms({ type: 'guest' });
        guestPilotStats = TradeLoader.derivePilotStats(guestTradeData);
        
        console.log('[PlayerManager] Guest pilot stats derived:', guestPilotStats);
        notifyListeners('guestDataLoaded', { tradeData: guestTradeData, stats: guestPilotStats });
        
        return guestTradeData;
      }
    } catch (e) {
      console.warn('[PlayerManager] Failed to load Guest trade data:', e);
    }
    return null;
  }

  /**
   * Get Guest pilot stats (derived from real trade data)
   */
  function getGuestPilotStats() {
    return guestPilotStats || (typeof TradeLoader !== 'undefined' ? TradeLoader.getDefaultPilotStats() : null);
  }

  /**
   * Get Guest trade data
   */
  function getGuestTradeData() {
    return guestTradeData;
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_PROFILES_KEY, JSON.stringify({
        version: STORAGE_VERSION,
        profiles,
        savedAt: new Date().toISOString()
      }));
      localStorage.setItem(STORAGE_ACTIVE_KEY, activeProfileId);
      return true;
    } catch (e) {
      console.error('[PlayerManager] Failed to save:', e);
      return false;
    }
  }

  function notifyListeners(event, data) {
    listeners.forEach(fn => {
      try { fn(event, data); } catch (e) { console.error(e); }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROFILE CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  function generateId() {
    return 'pilot-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  function create(data = {}) {
    const profileCount = Object.keys(profiles).filter(id => id !== 'demo').length;
    if (profileCount >= MAX_PROFILES - 1) { // -1 for demo slot
      console.warn('[PlayerManager] Max profiles reached');
      return null;
    }

    const id = generateId();
    const profile = {
      id,
      name: data.name || 'NEW PILOT',
      callsign: data.callsign || generateCallsign(),
      avatar: data.avatar || PILOT_AVATARS[Math.floor(Math.random() * PILOT_AVATARS.length)].id,
      created: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      isDemo: false,
      source: data.source || 'manual'
    };

    profiles[id] = profile;
    save();
    notifyListeners('created', profile);
    
    return profile;
  }

  function get(id) {
    return profiles[id] || null;
  }

  function getAll() {
    return { ...profiles };
  }

  function getAllSlots() {
    // Returns array of 8 slots (for UI), with profiles or null
    const slots = [];
    const profileList = Object.values(profiles);
    
    // Guest always first
    slots.push(profiles['guest'] || null);
    
    // Fill remaining slots
    const nonGuest = profileList.filter(p => p.id !== 'guest');
    for (let i = 0; i < MAX_PROFILES - 1; i++) {
      slots.push(nonGuest[i] || null);
    }
    
    return slots;
  }

  function update(id, updates) {
    if (!profiles[id]) return null;
    
    // Guest profile is read-only
    if (id === 'guest' || profiles[id].type === 'guest') {
      console.warn('[PlayerManager] Guest profile is read-only');
      return profiles[id];
    }
    
    if (id === 'demo' && updates.isDemo === false) {
      // Can't convert demo to non-demo
      delete updates.isDemo;
    }

    profiles[id] = {
      ...profiles[id],
      ...updates,
      lastActive: new Date().toISOString()
    };

    save();
    notifyListeners('updated', profiles[id]);
    return profiles[id];
  }

  function remove(id) {
    if (id === 'guest' || id === 'demo') {
      console.warn('[PlayerManager] Cannot delete guest profile');
      return false;
    }

    if (!profiles[id]) return false;

    const removed = profiles[id];
    delete profiles[id];

    // Also clear position data for this profile
    localStorage.removeItem(`space-capital-positions-${id}`);

    // If this was active, switch to guest
    if (activeProfileId === id) {
      activeProfileId = 'guest';
    }

    save();
    notifyListeners('deleted', removed);
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIVE PROFILE
  // ═══════════════════════════════════════════════════════════════════════════

  function getActive() {
    return profiles[activeProfileId] || profiles['guest'];
  }

  function getActiveId() {
    return activeProfileId;
  }

  function setActive(id) {
    if (!profiles[id]) {
      console.warn('[PlayerManager] Profile not found:', id);
      return false;
    }

    const previous = activeProfileId;
    activeProfileId = id;
    
    // Update last active timestamp
    profiles[id].lastActive = new Date().toISOString();
    
    save();
    notifyListeners('switched', { from: previous, to: id, profile: profiles[id] });
    
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CALLSIGN GENERATION
  // ═══════════════════════════════════════════════════════════════════════════

  const CALLSIGN_PREFIXES = [
    'SHADOW', 'PHANTOM', 'SPECTER', 'WRAITH', 'REAPER',
    'VIPER', 'COBRA', 'RAPTOR', 'FALCON', 'HAWK',
    'NOVA', 'PULSAR', 'QUASAR', 'NEBULA', 'COMET',
    'IRON', 'STEEL', 'CHROME', 'TITAN', 'APEX',
    'GHOST', 'DEMON', 'RAVEN', 'WOLF', 'STORM'
  ];

  function generateCallsign() {
    const prefix = CALLSIGN_PREFIXES[Math.floor(Math.random() * CALLSIGN_PREFIXES.length)];
    const number = String(Math.floor(Math.random() * 99) + 1).padStart(2, '0');
    return `${prefix}-${number}`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AVATARS
  // ═══════════════════════════════════════════════════════════════════════════

  function getAvatars() {
    return [...PILOT_AVATARS];
  }

  function getAvatarPath(avatarId) {
    const avatar = PILOT_AVATARS.find(a => a.id === avatarId);
    return avatar ? `../assets/pilots/${avatar.file}` : '../assets/pilots/ghost-pilot.png';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // POSITION DATA LINKING
  // ═══════════════════════════════════════════════════════════════════════════

  function getPositionStorageKey(profileId = null) {
    const id = profileId || activeProfileId;
    return `space-capital-positions-${id}`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // IMPORT/EXPORT
  // ═══════════════════════════════════════════════════════════════════════════

  function exportProfile(id) {
    const profile = profiles[id];
    if (!profile) return null;

    // Get position data for this profile
    const positionsKey = getPositionStorageKey(id);
    const positionsData = localStorage.getItem(positionsKey);

    return JSON.stringify({
      version: STORAGE_VERSION,
      exportedAt: new Date().toISOString(),
      profile,
      positions: positionsData ? JSON.parse(positionsData) : null
    }, null, 2);
  }

  function importProfile(jsonText) {
    try {
      const data = JSON.parse(jsonText);
      if (!data.profile) {
        return { success: false, error: 'Invalid profile data' };
      }

      // Generate new ID to avoid conflicts
      const newId = generateId();
      const profile = {
        ...data.profile,
        id: newId,
        imported: new Date().toISOString(),
        isDemo: false
      };

      profiles[newId] = profile;

      // Import positions if present
      if (data.positions) {
        const positionsKey = getPositionStorageKey(newId);
        localStorage.setItem(positionsKey, JSON.stringify(data.positions));
      }

      save();
      notifyListeners('imported', profile);

      return { success: true, profile };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT LISTENERS
  // ═══════════════════════════════════════════════════════════════════════════

  function onChange(callback) {
    listeners.push(callback);
    return () => {
      listeners = listeners.filter(fn => fn !== callback);
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════════════════════

  load();

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    // Constants
    MAX_PROFILES,
    PILOT_AVATARS,
    GUEST_PROFILE,

    // Profile CRUD
    create,
    get,
    getAll,
    getAllSlots,
    update,
    remove,

    // Active profile
    getActive,
    getActiveId,
    setActive,

    // Guest pilot data (canonical trade history)
    loadGuestTradeData,
    getGuestTradeData,
    getGuestPilotStats,
    isGuestProfile: (id) => id === 'guest' || profiles[id]?.type === 'guest',

    // Callsigns
    generateCallsign,

    // Avatars
    getAvatars,
    getAvatarPath,

    // Position data linking
    getPositionStorageKey,

    // Import/Export
    exportProfile,
    importProfile,

    // Events
    onChange,

    // Storage
    load,
    save
  };

})();
