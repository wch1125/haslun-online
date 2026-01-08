# Script Loading Order

**IMPORTANT:** Load scripts in this exact order to ensure all dependencies are satisfied.

---

## Core Dependencies (load first)

```html
<!-- 1. Seed utilities (no dependencies) -->
<script src="js/render/seed.js"></script>

<!-- 2. Watercolor engine (no dependencies) -->
<script src="js/lib/watercolor/watercolor-engine.js"></script>
```

## Render Engine

```html
<!-- 3. Sprite upgrades system (needs SeedUtils) -->
<script src="js/render/sprite-upgrades.js"></script>

<!-- 4. Pixel ship engine (needs SeedUtils, WatercolorEngine) -->
<script src="js/render/pixel-ship-engine.js"></script>

<!-- 5. ShipPix bootstrap - creates window.ShipPix (needs PixelShipEngine) -->
<script src="js/render/shippix-bootstrap.js"></script>
```

## Data Layer

```html
<!-- 6. Telemetry system (no render dependencies) -->
<script src="js/data/telemetry.js"></script>

<!-- 7. Telemetry adapter (needs ShipTelemetry) -->
<script src="js/sprites/telemetry-adapter.js"></script>
```

## Facade Layer

```html
<!-- 8. Ship sprite manager - THE MAIN API (needs everything above) -->
<script src="js/sprites/ship-sprite-manager.js"></script>
```

---

## Complete Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>Space Capital</title>
  
  <!-- CSS -->
  <link rel="stylesheet" href="css/fleet-command.css">
  
  <!-- Core Dependencies -->
  <script src="js/render/seed.js"></script>
  <script src="js/lib/watercolor/watercolor-engine.js"></script>
  
  <!-- Render Engine -->
  <script src="js/render/sprite-upgrades.js"></script>
  <script src="js/render/pixel-ship-engine.js"></script>
  <script src="js/render/shippix-bootstrap.js"></script>
  
  <!-- Data Layer -->
  <script src="js/data/telemetry.js"></script>
  <script src="js/sprites/telemetry-adapter.js"></script>
  
  <!-- Facade (THE MAIN API) -->
  <script src="js/sprites/ship-sprite-manager.js"></script>
</head>
<body>
  <canvas id="ship" width="128" height="128"></canvas>
  
  <script>
    // UI code - ONLY calls ShipSprites
    document.addEventListener('DOMContentLoaded', async () => {
      const canvas = document.getElementById('ship');
      await ShipSprites.renderToCanvas(canvas, 'RKLB', 128);
    });
  </script>
</body>
</html>
```

---

## Console Output (Success)

When loaded correctly, you should see:

```
[ShipTelemetry] Initialized with 15 ticker profiles
[TelemetryAdapter] Initialized
[ShipPix] Engine initialized (with WatercolorEngine) - 15 ticker-specific ships
[ShipSprites] Module loaded
[ShipSprites] Initialized with procedural engine
```

---

## API Quick Reference

### Main API (UI components use these)

```javascript
// Render a ship to a canvas
await ShipSprites.renderToCanvas(canvas, 'RKLB', 128);

// Get ship info (name, class, upgrades)
const info = await ShipSprites.getShipInfo('RKLB');

// Render entire fleet
const canvasMap = { RKLB: canvas1, LUNR: canvas2 };
await ShipSprites.renderFleet(canvasMap, 128);

// Get sprite as data URL (for <img> elements)
const sprite = await ShipSprites.getSprite('RKLB');
imgElement.src = sprite.src;
```

### Legacy API (still works)

```javascript
// Get sprite with stats
const sprite = await ShipSprites.getSprite('RKLB', stats);

// Get as Image element
const img = await ShipSprites.getSpriteImage('RKLB', stats);

// Update existing element
await ShipSprites.updateSprite('RKLB', newStats, canvasOrImg);
```

---

## Rule: UI Never Touches Engine Directly

❌ **WRONG:**
```javascript
// Don't do this in UI code
const engine = new PixelShipEngine();
engine.renderToCanvas(canvas, 'RKLB', telemetry);
```

✅ **RIGHT:**
```javascript
// Always use the facade
await ShipSprites.renderToCanvas(canvas, 'RKLB', 128);
```

This ensures:
1. Telemetry is always market-derived (no fake data)
2. Caching works correctly
3. Future changes don't break UI code
