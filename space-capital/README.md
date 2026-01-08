# Procedural Ship Engine v0.2

## What This Is

A **deterministic** real-time pixel art ship renderer. The same ticker ALWAYS produces the same ship - no randomness, no server storage needed.

**30MB of PNGs → 20KB of code = 99.9% reduction**

## Key Principle: Determinism

```
RKLB will always look like RKLB.
Telemetry modifies appearance (glow, damage) but not identity.
```

### How Determinism Works

| Source | Controls |
|--------|----------|
| Ticker hash | Blueprint selection (within regime pool) |
| Ticker letters | Base color palette (R→hull, K→wing, L→accent, B→engine) |
| Ticker seed | Geometric variations (wing span, nose length) |
| Seeded PRNG | All "random" effects (jitter, damage sparks, engine flicker) |

### Two Persistence Modes

```js
// Global canonical (same ship for everyone)
const engine = new PixelShipEngine();
// seed = hash("RKLB")

// Per-user canonical (each user has unique fleet)
const engine = new PixelShipEngine({ userId: 'user_123' });
// seed = hash("user_123:RKLB")
```

## Architecture

```
Ship = Blueprint + Palette + Telemetry Modifiers

Blueprint (geometry)     → from ticker hash + regime
Palette (colors)         → from ticker letters + signal state glaze
Modifiers (effects)      → from telemetry (thrust, damage, jitter)
```

### Blueprint Format
Each ship is defined as an array of rectangular blocks:
```js
// [x, y, width, height, shadeIndex, layer]
[28, 20, 8, 28, 0, 'hull'],  // Main hull block
[29, 18, 6, 6, 0, 'accent'], // Cockpit
[28, 54, 8, 4, 0, 'engine'], // Engine glow
```

- Coordinates are on a 64x64 grid
- `shadeIndex` (0-3) indexes into a 4-color palette ramp
- `layer` determines which palette ramp to use: 'hull', 'accent', 'engine'

### Palette Generation
Palettes are generated via WatercolorEngine based on telemetry:
- **signalState** (bull/bear/neutral) → base pigment family
- **momentum** → engine color temperature
- **damage** → stress glaze overlay
- **getDilutionGradient()** → 4-color shading ramp

### Telemetry Modifiers
- `thrust` (0-1) → engine plume length
- `damage` (0-1) → missing pixels, spark effects
- `jitter` (0-1) → positional instability
- `signalState` → palette selection
- `momentum` → color temperature shifts

## Files

```
proc-sprites/
├── demo.html                           # Interactive demo
├── README.md                           # This file
└── js/
    ├── lib/
    │   └── watercolor/
    │       ├── watercolor-engine.js    # Palette generation
    │       └── pigments.json           # Schmincke pigment data
    └── render/
        ├── seed.js                     # Hash + PRNG utilities (~50 lines)
        └── pixel-ship-engine.js        # Core engine (~450 lines)
```

## v0.2 Fixes (from ChatGPT review)

### ✅ Bug Fixes
1. **Cache no longer nuked every animation frame** - `createAnimatedSprite()` bypasses cache instead of clearing it
2. **All randomness is now seeded** - `Math.random()` replaced with `SeedUtils.getBlockRng()`
3. **Cache hash includes all factors** - momentum and jitter now included in cache key

### ✅ New Features
1. **Letter→pigment mapping** - First 4 letters of ticker determine hull/wing/accent/engine colors
2. **Deterministic blueprint selection** - Ticker hash picks from regime pool consistently
3. **Geometric params from seed** - Wing span, nose length vary per-ticker but stay stable
4. **Per-user seed support** - Optional `userId` for unique fleets per player

## Usage

```js
// Initialize (optional: pass userId for per-user ships)
const engine = new PixelShipEngine();

// Render a ship - DETERMINISTIC from ticker
const canvas = engine.renderShip('RKLB', {
  signalState: 'bull',   // Affects palette tint
  thrust: 0.7,           // Engine plume length
  damage: 0.1,           // Missing pixels, sparks
  momentum: 0.5,         // Engine color temperature
  regime: 'UPTREND'      // Affects blueprint pool
}, 64);

// Get ship info (for debugging/display)
const info = engine.getShipInfo('RKLB', { regime: 'UPTREND' });
// { ticker: 'RKLB', seed: 0x..., blueprint: 'interceptor', params: {...} }

// Create animated sprite (continuous render loop)
const animatedCanvas = engine.createAnimatedSprite('RKLB', telemetry, 96);
document.body.appendChild(animatedCanvas);
animatedCanvas.stopAnimation();  // Stop when offscreen
```

## Letter → Color Mapping

Each ticker letter maps to a pigment from the WatercolorEngine:

| Position | Controls | Example (RKLB) |
|----------|----------|----------------|
| 1st letter | Hull color | R → pigment[17*7 % 24] |
| 2nd letter | Wing color | K → pigment[10*11 % 24] |
| 3rd letter | Accent color | L → pigment[11*13 % 24] |
| 4th letter | Engine color | B → pigment[1*17 % 24] |

This means:
- **RKLB** always has the same base colors
- **AAAA** vs **ZZZZ** look completely different
- Telemetry only *glazes* over the base (signal state tint, stress overlay)

## Regime → Blueprint Pools

```js
UPTREND:   ['interceptor', 'scout', 'corvette']
DOWNTREND: ['dreadnought', 'freighter', 'hauler']
BREAKOUT:  ['interceptor', 'dreadnought', 'corvette']
CHOP:      ['drone', 'scout']
RANGE:     ['freighter', 'corvette', 'hauler', 'scout']
```

The ticker hash picks consistently from the pool, so RKLB in UPTREND always gets the same blueprint.

---

## FOR CHATGPT: Next Steps

The v0.2 implementation addresses all your feedback. Remaining work:

### 1. Blueprint Quality
The 7 blueprints are functional but basic. Consider:
- More distinctive silhouettes
- Better pixel proportions
- More detail blocks for visual interest

### 2. Param Tag Coverage
Currently only `wing-left`, `wing-right`, `nose` tags are handled. Should we add:
- `pod-left/right` for freighter cargo pods
- `weapon-left/right` for dreadnought
- `bridge` for tower height variations

### 3. Integration Plan
Ready to integrate into Space Capital:
- Replace `renderShipCard()` sprite section
- Update dial selector
- Test performance at scale

Please review the updated code and suggest any final refinements!

---

## Memory Comparison

| Approach | Size |
|----------|------|
| Current PNGs | ~30MB |
| Procedural (v0.2) | ~20KB |
| **Reduction** | **99.93%** |
