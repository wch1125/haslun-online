// =========================================================================
// SHIP DATA — All ship-related data objects for HASLUN-BOT
// Extracted from app.js for modularity
// =========================================================================

(function() {
  // =========================================================================
  // SHIP LORE — HUD tags and descriptions for SVG ships
  // =========================================================================
  const SHIP_LORE = {
  "#ship-flagship": {
    hud: "COMMAND AUTHORITY ACTIVE",
    lore: "Spearhead command carrier. Captains say it listens before it speaks."
  },
  "#ship-dreadnought": {
    hud: "LEGACY COMBAT MEMORY ENABLED",
    lore: "Heavy war machine. Refuses to die and logs its own kills without permission."
  },
  "#ship-archon": {
    hud: "AUTHORITY PROTOCOL DETECTED",
    lore: "Built to command fleets rather than win battles. Hull plating echoes cathedral geometry."
  },
  "#ship-tyrant": {
    hud: "LEGACY COMBAT MEMORY ENABLED",
    lore: "Technically illegal. Nobody remembers which war it survived."
  },
  "#ship-phantom": {
    hud: "TOPOLOGY ANOMALY — TRACED BUT UNRESOLVED",
    lore: "Appears on scans before it appears on the hull deck. Routes comms from ships that no longer exist."
  },
  "#ship-hauler": {
    hud: "CARGO MANIFEST VERIFIED",
    lore: "The Atlas doesn't have fans. It has people who quietly owe their lives to it."
  },
  "#ship-drone": {
    hud: "PASSIVE CURIOSITY RISING...",
    lore: "Buzzes. Watches. Reports. Occasionally expresses opinions in system logs."
  },
  "#ship-sojourn": {
    hud: "DESCENT TRAJECTORY LOCKED",
    lore: "Landers don't win wars. They bring people home."
  },
  "#ship-parallax": {
    hud: "BLACK CHANNEL AUTHENTICATED",
    lore: "Officially, this class does not exist. If you can see it — it chose to let you."
  },
  "#ship-gardener": {
    hud: "LEGACY ECOLOGICAL ROUTINES ACTIVE",
    lore: "Built for terraforming. Now escorts convoys because nobody funds ecosystems anymore."
  },
  "#ship-frigate": {
    hud: "PATROL SYSTEMS NOMINAL",
    lore: "Reliable, adaptable. The backbone of any fleet."
  },
  "#ship-lander": {
    hud: "SURFACE APPROACH ENABLED",
    lore: "Lunar descent specialist. Hope and precision in equal measure."
  },
  "#ship-evtol": {
    hud: "VTOL SYSTEMS ONLINE",
    lore: "Sky taxi of the future. Vertical freedom."
  },
  "#ship-cargo": {
    hud: "CARGO SECURE",
    lore: "The supply chain doesn't thank you. It just expects you to show up."
  },
  "#ship-meme": {
    hud: "SIGNAL ANOMALY DETECTED",
    lore: "Origin unknown. Trajectory chaotic. Somehow profitable."
  },
  "#ship-recon": {
    hud: "SURVEILLANCE ACTIVE",
    lore: "Eyes in the sky. Watching. Always watching."
  },
  "#ship-patrol": {
    hud: "DEFENSE GRID LINKED",
    lore: "First responder. Last line. No medals, just duty."
  },
  "#ship-relay": {
    hud: "UPLINK ESTABLISHED",
    lore: "Communication backbone. Every message passes through, trusted with all secrets."
  }
};

// =========================================================================
// PIXEL SHIPS — 17×11 pixel art patterns (8-bit Space Invaders / SNES mech style)
// Each character: "0" = empty, "1" = outer hull, "2" = inner core, "3" = highlight accent
// =========================================================================
const PIXEL_SHIPS = {
  // RKLB: long spear / command cruiser
  flagship: [
    "00000011100000000",
    "00000122210000000",
    "00001122221000000",
    "00011222222100000",
    "00112222222210000",
    "01122222322221000",
    "00112223222210000",
    "00011222222100000",
    "00001122221000000",
    "00000123210000000",
    "00000011100000000"
  ],

  // GME: chunky anime dreadnought / mech chest
  dreadnought: [
    "00000111111000000",
    "00011222222110000",
    "00122222222221000",
    "01122222222221100",
    "11222223222222110",
    "11222222222222110",
    "01122222222221100",
    "00122222222221000",
    "00011222222110000",
    "00000111111000000",
    "00000001000000000"
  ],

  // ASTS: twin-pod probe / sensor array
  probe: [
    "00001100110000000",
    "00012221122200000",
    "00122222222210000",
    "01122222222211000",
    "01222232232221000",
    "01122222222211000",
    "00122222222210000",
    "00012221122200000",
    "00001100110000000",
    "00000100010000000",
    "00000100010000000"
  ],

  // ACHR / EVEX / JOBY carriers – wide flight deck
  carrier: [
    "00000011111000000",
    "00000122222100000",
    "00001222222210000",
    "00012222222221000",
    "00122222222222100",
    "01122223222322110",
    "00122222222222100",
    "00012222222221000",
    "00001222222210000",
    "00000122222100000",
    "00000011111000000"
  ],

  // LUNR: lander / dropship
  lander: [
    "00000011100000000",
    "00000122210000000",
    "00001222221000000",
    "00012222222100000",
    "00122222222210000",
    "01122223222211000",
    "00122222222210000",
    "00012222222100000",
    "00001222221000000",
    "00000123210000000",
    "00000011100000000"
  ],

  // default drone frame – compact but still mech-y
  drone: [
    "00000011100000000",
    "00000122210000000",
    "00001222221000000",
    "00001223221000000",
    "00001222221000000",
    "00000122210000000",
    "00000122210000000",
    "00000011100000000",
    "00000001000000000",
    "00000001000000000",
    "00000000000000000"
  ],
  
  // Cruiser - defense / patrol ship
  cruiser: [
    "00000111110000000",
    "00001222221000000",
    "00012222222100000",
    "00122222222210000",
    "01122223222211000",
    "01222222222221000",
    "00122222222210000",
    "00012222222100000",
    "00001222221000000",
    "00000111110000000",
    "00000010100000000"
  ],
  
  // Station / relay - comms hub
  station: [
    "00001110111000000",
    "00011221122110000",
    "00012222222100000",
    "00011222221100000",
    "00122223222210000",
    "00011222221100000",
    "00012222222100000",
    "00011221122110000",
    "00001110111000000",
    "00000100010000000",
    "00000100010000000"
  ],
  
  // Hauler - cargo / industrial transport
  hauler: [
    "00000111111000000",
    "00001222222100000",
    "00012222222210000",
    "00122222222221000",
    "00122222222221000",
    "01122223222221100",
    "00122222222221000",
    "00122222222221000",
    "00012222222210000",
    "00001222222100000",
    "00000111111000000"
  ],
  
  // Mini-game specific sprites - smaller for arcade games
  arcade_player: [
    "00000011100000000",
    "00001122211000000",
    "00011222221100000",
    "00112222222110000",
    "01122223222211000",
    "11222222222221100",
    "11222222222221100",
    "01122222222211000",
    "00111111111110000",
    "00010001000100000",
    "00010001000100000"
  ],
  
  arcade_enemy: [
    "00100000000010000",
    "00010000000100000",
    "00111111111110000",
    "01111222221111000",
    "11112222222111100",
    "11112232322111100",
    "11112222222111100",
    "01111111111111000",
    "00011000001100000",
    "00110000000110000",
    "01100000000011000"
  ],
  
  arcade_elite: [
    "00100111110010000",
    "00011222221100000",
    "00111222222111000",
    "01112222222211100",
    "01112223222211100",
    "11122222222221110",
    "01112222222211100",
    "00111222222111000",
    "00011122211100000",
    "00010100010100000",
    "00100100010010000"
  ]
};

// =========================================================================
// PIXEL SHIP LORE — Labels and descriptions for pixel ships
// =========================================================================
const PIXEL_SHIP_LORE = {
  flagship: { label: "FLAGSHIP", hud: "COMMAND AUTHORITY ACTIVE", lore: "Spearhead command ship. Victory follows in its wake." },
  dreadnought: { label: "DREADNOUGHT", hud: "HEAVY ARMOR ENGAGED", lore: "Refuses to die. Logs its own kills without permission." },
  lander: { label: "LANDER", hud: "DESCENT LOCKED", lore: "Landers don't win wars. They bring people home." },
  carrier: { label: "CARRIER", hud: "FLIGHT OPS READY", lore: "Sky taxi of the future. Vertical freedom." },
  drone: { label: "DRONE", hud: "PASSIVE SCAN ACTIVE", lore: "Buzzes. Watches. Reports. Occasionally has opinions." },
  cruiser: { label: "CRUISER", hud: "PATROL SYSTEMS ONLINE", lore: "First responder. Last line. No medals, just duty." },
  station: { label: "STATION", hud: "UPLINK ESTABLISHED", lore: "Every message passes through. Trusted with all secrets." },
  probe: { label: "PROBE", hud: "ANOMALY DETECTED", lore: "Origin unknown. Trajectory chaotic. Somehow profitable." },
  hauler: { label: "HAULER", hud: "CARGO MANIFEST VERIFIED", lore: "Doesn't have fans. Has people who owe their lives to it." }
};

// =========================================================================
// SHIP NAMES — Codenames and designations for each ticker
// =========================================================================
const SHIP_NAMES = {
  RKLB: { name: "ELECTRON", designation: "FSC-001" },
  LUNR: { name: "ODYSSEY", designation: "LNR-002" },
  ASTS: { name: "BLUEBIRD", designation: "COM-003" },
  ACHR: { name: "MIDNIGHT", designation: "AAM-004" },
  JOBY: { name: "SKYWARD", designation: "EVT-005" },
  BKSY: { name: "BLACKSKY", designation: "RCN-006" },
  RDW: { name: "REDWIRE", designation: "INF-007" },
  PL: { name: "PLANET", designation: "SAT-008" },
  EVEX: { name: "HORIZON", designation: "AAM-009" },
  GME: { name: "DIAMOND", designation: "MEM-010" },
  MP: { name: "MAGNETO", designation: "MAT-011" },
  KTOS: { name: "KRATOS", designation: "DEF-012" },
  IRDM: { name: "IRIDIUM", designation: "COM-013" },
  HON: { name: "HONEYBEE", designation: "IND-014" },
  ATI: { name: "TITANIUM", designation: "MAT-015" },
  CACI: { name: "SENTINEL", designation: "DEF-016" },
  LOAR: { name: "PHOENIX", designation: "AER-017" },
  COHR: { name: "PRISM", designation: "OPT-018" },
  GE: { name: "SPECTRE", designation: "IND-019" },
  LHX: { name: "HELIX", designation: "AAM-020" },
  RTX: { name: "RAYTHEON", designation: "DEF-021" }
};

// =========================================================================
// SHIP SPRITES — PNG sprite paths for each ticker
// =========================================================================
const SHIP_SPRITES = {
  ACHR: 'assets/ships/ACHR-eVTOL-ship.png',
  ASTS: 'assets/ships/ASTS-Communications-Relay-Ship.png',
  BKSY: 'assets/ships/BKSY-recon-ship.png',
  COHR: 'assets/ships/COHR-Glass-Reflector-ship.png',
  EVEX: 'assets/ships/EVEX-Transport-Ship.png',
  GE: 'assets/ships/GE-Stealth-Bomber-ship.png',
  GME: 'assets/ships/GME-moonshot-ship.png',
  JOBY: 'assets/ships/JOBY-eVTOL-light-class-ship.png',
  KTOS: 'assets/ships/KTOS-Fighter-Ship.png',
  LHX: 'assets/ships/LHX-Drone-ship.png',
  LUNR: 'assets/ships/LUNR-lander-ship.png',
  PL: 'assets/ships/PL-scout-ship.png',
  RDW: 'assets/ships/RDW-Hauler-ship.png',
  RKLB: 'assets/ships/RKLB-flagship-ship.png',
  RTX: 'assets/ships/RTX-Officer-Class-Ship.png'
};

// Default fallback sprite for tickers without custom ships
const DEFAULT_SHIP_SPRITE = 'assets/ships/Unclaimed-Drone-ship.png';

// =========================================================================
  // Expose globally for use by other modules
  // =========================================================================
  window.SHIP_LORE = SHIP_LORE;
  window.PIXEL_SHIPS = PIXEL_SHIPS;
  window.PIXEL_SHIP_LORE = PIXEL_SHIP_LORE;
  window.SHIP_NAMES = SHIP_NAMES;
  window.SHIP_SPRITES = SHIP_SPRITES;
  window.DEFAULT_SHIP_SPRITE = DEFAULT_SHIP_SPRITE;
})();
