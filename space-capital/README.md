# Space Capital — Kitbash Ship System

**Version:** 3.0  
**Date:** 2026-01-09

---

## What This Is

A **mold-based ship rendering system** that uses your real pixel art sprites as base templates, then applies:

1. **Deterministic palette recoloring** — Each ticker gets unique colors
2. **Telemetry-driven effects** — Glow, damage, bull/bear indicators
3. **Block fallback** — Unknown tickers get procedural ships

**Result:** High-quality ships that look like your original art, not rectangles.

---

## Quick Start

### 1. Extract to your repo root

```
your-repo/
├── assets/molds/          ← Ship sprite molds
├── js/render/             ← Engine files
├── js/sprites/            ← Facade layer
├── js/lib/watercolor/     ← Palette system
└── test-molds.html        ← Test page
```

### 2. Add scripts to your HTML

```html
<!-- Core -->
<script src="js/render/seed.js"></script>
<script src="js/lib/watercolor/watercolor-engine.js"></script>

<!-- Mold System -->
<script src="js/render/mold-composer.js"></script>
<script src="js/render/pixel-ship-engine.js"></script>
<script src="js/render/shippix-bootstrap.js"></script>

<!-- Optional: Full facade -->
<script src="js/data/telemetry.js"></script>
<script src="js/sprites/telemetry-adapter.js"></script>
<script src="js/sprites/ship-sprite-manager.js"></script>
```

### 3. Render ships

```javascript
// Wait for engine
await ShipPixReady;

// Render to any canvas
const canvas = document.getElementById('myShip');
ShipPix.renderToCanvas(canvas, 'RKLB', { thrust: 0.7 }, 128);

// Or use the facade (recommended)
await ShipSprites.renderToCanvas(canvas, 'RKLB', 128);
```

---

## File Reference

### Render Engine (`js/render/`)

| File | Purpose |
|------|---------|
| `seed.js` | Deterministic random from ticker |
| `mold-composer.js` | Loads sprite molds, applies palette tinting |
| `pixel-ship-engine.js` | Main engine (molds + block fallback) |
| `shippix-bootstrap.js` | Initializes engine, exposes `ShipPix` |

### Facade (`js/sprites/`)

| File | Purpose |
|------|---------|
| `ship-sprite-manager.js` | `ShipSprites` API — UI calls this |
| `telemetry-adapter.js` | Converts market data → engine format |

### Assets (`assets/molds/`)

| File | Purpose |
|------|---------|
| `atlas.json` | Ship metadata (class, traits, palette zones) |
| `base/*.png` | 16 base sprite molds (256×256) |

---

## API Reference

### ShipPix (Low-level)

```javascript
// Render to canvas
ShipPix.renderToCanvas(canvas, ticker, telemetry, size);

// Get ship info
const info = ShipPix.getShipInfo('RKLB');
// { shipName, shipClass, className, traits, hasMold, upgrades }

// Check if mold exists
ShipPix.hasMold('RKLB');  // true
ShipPix.hasMold('AAPL');  // false (uses block fallback)

// Get available molds
ShipPix.getAvailableMolds();  // ['RKLB', 'LUNR', ...]
```

### ShipSprites (High-level Facade)

```javascript
// Render (auto-gets telemetry)
await ShipSprites.renderToCanvas(canvas, 'RKLB', 128);

// Render fleet
await ShipSprites.renderFleet({ RKLB: canvas1, LUNR: canvas2 }, 128);

// Get sprite as data URL
const sprite = await ShipSprites.getSprite('RKLB');
img.src = sprite.src;
```

### Telemetry Format

```javascript
const telemetry = {
  signalState: 'bull' | 'bear' | 'neutral',  // Bull/bear glow
  thrust: 0.0 - 1.0,      // Engine intensity
  damage: 0.0 - 1.0,      // Damage desaturation + sparks
  momentum: -1.0 - 1.0,   // Trend direction
  glow: 0.0 - 1.0,        // Edge neon glow
};
```

---

## Updating Fleet + Hangar

### Before (legacy img)

```html
<img class="ship-sprite-img" src="assets/ships/animated/gifs/RKLB_idle.gif">
```

### After (mold canvas)

```html
<canvas class="ship-sprite-canvas" data-ticker="RKLB" width="128" height="128"></canvas>

<script>
document.querySelectorAll('.ship-sprite-canvas').forEach(async canvas => {
  const ticker = canvas.dataset.ticker;
  await ShipSprites.renderToCanvas(canvas, ticker, 128);
});
</script>
```

---

## Console Output (Success)

```
[MoldComposer] Loaded 16 ship molds
[PixelShipEngine] Initialized (molds: true)
[ShipPix] Engine initialized (16 molds loaded) + WatercolorEngine
[ShipSprites] Module loaded
```

---

## Future: True Part Kitbashing

Current system uses **whole sprites** as molds. To enable true kitbashing:

1. In Aseprite, split each sprite into layers: hull, wings, cockpit, engine
2. Export each layer as `molds/hull/RKLB_hull.png`, etc.
3. Update `atlas.json` parts section with anchor points
4. MoldComposer will automatically use parts when available

The architecture supports this — just needs the art assets.

---

## Troubleshooting

### Ships not rendering
- Check console for `[MoldComposer] Loaded X ship molds`
- Verify `assets/molds/base/*.png` files exist
- Ensure scripts loaded in correct order

### Wrong colors
- Telemetry affects palette — try neutral telemetry first
- Check `signalState` isn't forcing bull/bear tint

### Fallback blocks appearing
- Ticker doesn't have a mold — add to `atlas.json` + base sprite
- Or accept block fallback for unknown tickers
