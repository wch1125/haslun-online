/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PARALLAX - Sprite Upgrades Data Table
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Table-driven upgrade system. Ships visually evolve based on performance.
 * Change thresholds and parts here without touching rendering logic.
 * 
 * Stats → Normalized (0-1) → Tier Selection → Visual Modules
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Upgrade tiers for each module type.
 * Each tier has: { min, max, id, ...extra props }
 * - min/max: normalized stat range (0-1)
 * - id: sprite part identifier (null = no part)
 * - Additional props: scale, glow, tint, etc.
 */
export const SPRITE_UPGRADES = {
  // Wings: Based on momentum (recent price movement)
  // Fast movers get bigger, more aggressive wings
  wings: [
    { min: -Infinity, max: 0.25, id: 'wing_small',  scale: 1.0, label: 'Scout Wings' },
    { min: 0.25,      max: 0.50, id: 'wing_mid',    scale: 1.0, label: 'Standard Wings' },
    { min: 0.50,      max: 0.75, id: 'wing_large',  scale: 1.0, label: 'Combat Wings' },
    { min: 0.75,      max: Infinity, id: 'wing_elite', scale: 1.05, label: 'Elite Wings' },
  ],

  // Engines: Based on overall strength/win rate
  // Strong performers get more powerful thrusters
  engines: [
    { min: -Infinity, max: 0.33, id: 'thruster_1', glow: 0.3, label: 'Basic Thruster' },
    { min: 0.33,      max: 0.66, id: 'thruster_2', glow: 0.6, label: 'Ion Drive' },
    { min: 0.66,      max: Infinity, id: 'thruster_3', glow: 1.0, label: 'Plasma Core' },
  ],

  // Armor: Based on volatility/risk
  // High volatility = more armor plating for "battle damage" aesthetic
  armor: [
    { min: -Infinity, max: 0.40, id: null, label: 'No Armor' },
    { min: 0.40,      max: 0.70, id: 'plate_1', label: 'Light Plating' },
    { min: 0.70,      max: Infinity, id: 'plate_2', label: 'Heavy Armor' },
  ],

  // Antenna: Based on volume/activity
  // High activity = communication arrays
  antenna: [
    { min: -Infinity, max: 0.50, id: null, label: 'No Antenna' },
    { min: 0.50,      max: 0.80, id: 'antenna_1', label: 'Comm Array' },
    { min: 0.80,      max: Infinity, id: 'antenna_2', label: 'Command Array' },
  ],

  // Weapons: Based on gain magnitude
  // Big movers get weapon systems
  weapons: [
    { min: -Infinity, max: 0.60, id: null, label: 'Unarmed' },
    { min: 0.60,      max: 0.85, id: 'weapon_1', label: 'Laser Banks' },
    { min: 0.85,      max: Infinity, id: 'weapon_2', label: 'Missile Pods' },
  ],

  // Shield: Based on consistency (low drawdown)
  // Consistent performers get shield effects
  shield: [
    { min: -Infinity, max: 0.70, id: null, glow: 0, label: 'No Shield' },
    { min: 0.70,      max: Infinity, id: 'shield_1', glow: 0.4, label: 'Energy Shield' },
  ],
};

/**
 * Anchor points for attaching parts to base sprites.
 * Coordinates are in base sprite pixel space.
 * These are approximate - adjust per ship type if needed.
 */
export const PART_ANCHORS = {
  // Wing attachment points (left side - right is mirrored)
  wing_left:    { x: 8,  y: 20 },
  wing_right:   { x: 56, y: 20 },  // For non-mirrored setups
  
  // Engine position (center-bottom)
  engine:       { x: 32, y: 50 },
  engine_left:  { x: 20, y: 48 },
  engine_right: { x: 44, y: 48 },
  
  // Armor overlay position
  armor:        { x: 16, y: 24 },
  
  // Antenna position (top-center)
  antenna:      { x: 30, y: 4 },
  
  // Weapon mount points
  weapon_left:  { x: 6,  y: 28 },
  weapon_right: { x: 58, y: 28 },
  
  // Shield center
  shield:       { x: 32, y: 32 },
};

/**
 * Part definitions - maps part IDs to sprites and rendering info.
 * z-index determines draw order (lower = behind)
 */
export const PART_DEFS = {
  // Wings
  wing_small:  { src: 'assets/ships/parts/wings/wing_small.png',  anchor: 'wing_left', z: 2, mirror: true },
  wing_mid:    { src: 'assets/ships/parts/wings/wing_mid.png',    anchor: 'wing_left', z: 2, mirror: true },
  wing_large:  { src: 'assets/ships/parts/wings/wing_large.png',  anchor: 'wing_left', z: 2, mirror: true },
  wing_elite:  { src: 'assets/ships/parts/wings/wing_elite.png',  anchor: 'wing_left', z: 2, mirror: true },

  // Engines (drawn behind hull)
  thruster_1:  { src: 'assets/ships/parts/engines/thruster_1.png', anchor: 'engine', z: 0, animated: true },
  thruster_2:  { src: 'assets/ships/parts/engines/thruster_2.png', anchor: 'engine', z: 0, animated: true },
  thruster_3:  { src: 'assets/ships/parts/engines/thruster_3.png', anchor: 'engine', z: 0, animated: true },

  // Armor (overlay on hull)
  plate_1:     { src: 'assets/ships/parts/armor/plate_1.png', anchor: 'armor', z: 3 },
  plate_2:     { src: 'assets/ships/parts/armor/plate_2.png', anchor: 'armor', z: 3 },

  // Antenna
  antenna_1:   { src: 'assets/ships/parts/antenna/antenna_1.png', anchor: 'antenna', z: 4 },
  antenna_2:   { src: 'assets/ships/parts/antenna/antenna_2.png', anchor: 'antenna', z: 4 },

  // Weapons
  weapon_1:    { src: 'assets/ships/parts/weapons/weapon_1.png', anchor: 'weapon_left', z: 2, mirror: true },
  weapon_2:    { src: 'assets/ships/parts/weapons/weapon_2.png', anchor: 'weapon_left', z: 2, mirror: true },

  // Shield (full ship overlay with glow)
  shield_1:    { src: 'assets/ships/parts/shield/shield_1.png', anchor: 'shield', z: 5, centered: true },
};

/**
 * Stat mapping configuration.
 * Defines how raw stats map to normalized 0-1 values.
 */
export const STAT_MAPPINGS = {
  // Momentum: based on today's P&L percentage
  momentum: {
    stat: 'todayPnlPct',
    min: -5,   // -5% = 0
    max: 5,    // +5% = 1
    default: 0
  },
  
  // Strength: based on win rate or overall gain
  strength: {
    stat: 'winRate',
    min: 0.3,  // 30% win rate = 0
    max: 0.8,  // 80% win rate = 1
    default: 0.5
  },
  
  // Risk: based on volatility
  risk: {
    stat: 'volatility',
    min: 0.01, // 1% volatility = 0
    max: 0.08, // 8% volatility = 1
    default: 0.03
  },
  
  // Activity: based on relative volume
  activity: {
    stat: 'relativeVolume',
    min: 0.5,  // 50% of avg = 0
    max: 3.0,  // 300% of avg = 1
    default: 1.0
  },
  
  // Magnitude: based on absolute gain
  magnitude: {
    stat: 'totalGainPct',
    min: -20,  // -20% = 0
    max: 50,   // +50% = 1
    default: 0
  },
  
  // Consistency: inverse of max drawdown
  consistency: {
    stat: 'maxDrawdownPct',
    min: 20,   // 20% drawdown = 0 (inverted)
    max: 0,    // 0% drawdown = 1
    default: 10
  }
};

/**
 * Which stat drives which upgrade slot
 */
export const SLOT_STAT_MAP = {
  wings:    'momentum',
  engines:  'strength',
  armor:    'risk',
  antenna:  'activity',
  weapons:  'magnitude',
  shield:   'consistency'
};

/**
 * Tier color tints for visual feedback
 */
export const TIER_TINTS = {
  poor:     { hue: 0,   saturation: 0.3 },  // Desaturated
  standard: { hue: 0,   saturation: 0 },    // Normal
  good:     { hue: 120, saturation: 0.2 },  // Slight green
  elite:    { hue: 60,  saturation: 0.3 },  // Golden
};

/**
 * Damage/status overlays based on conditions
 */
export const STATUS_OVERLAYS = {
  damage: {
    condition: (stats) => stats.todayPnlPct < -3,
    overlay: 'assets/ships/overlays/damage.png',
    opacity: 0.4,
    animation: 'flicker'
  },
  boost: {
    condition: (stats) => stats.todayPnlPct > 5,
    overlay: 'assets/ships/overlays/boost.png',
    opacity: 0.6,
    animation: 'pulse'
  },
  alert: {
    condition: (stats) => stats.volatility > 0.06,
    overlay: 'assets/ships/overlays/alert.png',
    opacity: 0.3,
    animation: 'blink'
  }
};

export default {
  SPRITE_UPGRADES,
  PART_ANCHORS,
  PART_DEFS,
  STAT_MAPPINGS,
  SLOT_STAT_MAP,
  TIER_TINTS,
  STATUS_OVERLAYS
};
