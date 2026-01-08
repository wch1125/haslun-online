# Space Capital Milestone 2 — Unified Ship Facade

**Date:** 2026-01-09  
**Status:** Complete

---

## What This Delivers

A **single API** (`ShipSprites`) that all UI components call for ship rendering. No more fragmented code where each page wires ships differently.

---

## Files in This Package

```
space-capital-milestone2.zip
├── documentation/
│   ├── ROADMAP.md              # Full implementation roadmap
│   └── SCRIPT_LOAD_ORDER.md    # How to load scripts correctly
│
├── js/
│   ├── render/                 # Engine layer (don't touch from UI)
│   │   ├── seed.js             # Deterministic hashing
│   │   ├── pixel-ship-engine.js # 15 unique procedural ships
│   │   ├── sprite-upgrades.js  # Stats → visual upgrades
│   │   └── shippix-bootstrap.js # Engine initialization
│   │
│   ├── sprites/                # Facade layer (THE MAIN API)
│   │   ├── ship-sprite-manager.js  # ShipSprites facade ⭐
│   │   └── telemetry-adapter.js    # Market data → engine format
│   │
│   └── data/                   # Data layer
│       ├── telemetry.js        # Market-derived ship behavior
│       ├── holo-ships.js       # SVG wireframes
│       └── pixel-icons.js      # UI icons
│
├── css/
│   └── fleet-command.css       # Fleet command styles
│
├── assets/
│   └── ships/animated/gifs/    # 32 animated GIFs
│
└── data/
    └── guest/
        └── trade-confirms.csv  # Real trade history
```

---

## How to Use

### 1. Load Scripts (in order)

```html
<script src="js/render/seed.js"></script>
<script src="js/lib/watercolor/watercolor-engine.js"></script>
<script src="js/render/sprite-upgrades.js"></script>
<script src="js/render/pixel-ship-engine.js"></script>
<script src="js/render/shippix-bootstrap.js"></script>
<script src="js/data/telemetry.js"></script>
<script src="js/sprites/telemetry-adapter.js"></script>
<script src="js/sprites/ship-sprite-manager.js"></script>
```

### 2. Render Ships (in UI code)

```javascript
// Render a single ship
const canvas = document.querySelector('.ship-canvas');
await ShipSprites.renderToCanvas(canvas, 'RKLB', 128);

// Render entire fleet
const canvasMap = { RKLB: canvas1, LUNR: canvas2, GME: canvas3 };
await ShipSprites.renderFleet(canvasMap, 128);

// Get ship info
const info = await ShipSprites.getShipInfo('RKLB');
console.log(info.shipName);  // "Orbital Bus"
console.log(info.shipClass); // "transport"
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  UI COMPONENTS                                              │
│  (Fleet Command, Hangar, Ship Select)                       │
│                                                             │
│  await ShipSprites.renderToCanvas(canvas, ticker, size)     │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│  FACADE: js/sprites/ship-sprite-manager.js                  │
│                                                             │
│  - Gets telemetry from TelemetryAdapter                     │
│  - Calls PixelShipEngine internally                         │
│  - Caches results                                           │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│  DATA: js/sprites/telemetry-adapter.js                      │
│        js/data/telemetry.js                                 │
│                                                             │
│  - Market-derived stats (no fake data)                      │
│  - Converts to engine format                                │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│  ENGINE: js/render/pixel-ship-engine.js                     │
│                                                             │
│  - 15 unique ship geometries                                │
│  - Watercolor palettes                                      │
│  - Stats-driven upgrades                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Rules

### ✅ DO

```javascript
// UI calls ShipSprites facade
await ShipSprites.renderToCanvas(canvas, 'RKLB', 128);
```

### ❌ DON'T

```javascript
// UI should NEVER call engine directly
const engine = new PixelShipEngine();
engine.renderToCanvas(...);

// UI should NEVER call bootstrap helpers directly
await window.renderShipToCanvas(...);  // ← Remove these from pages!
```

---

## Next Steps (Milestone 3)

Update UI components to use the facade:

1. **Fleet Command** — Replace ad-hoc canvas wiring with `ShipSprites.renderToCanvas()`
2. **Ship Select** — Same pattern
3. **Hangar** — Same pattern
4. **Remove** all `window.renderShipToCanvas()` calls from pages

---

## Console Output (Successful Load)

```
[ShipTelemetry] Initialized with 15 ticker profiles
[TelemetryAdapter] Initialized
[ShipPix] Engine initialized (with WatercolorEngine) - 15 ticker-specific ships
[ShipSprites] Module loaded
[ShipSprites] Initialized with procedural engine
```
