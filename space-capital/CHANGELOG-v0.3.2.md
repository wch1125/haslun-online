# Space Capital v0.3.2 - Bug Fixes + Procedural Integration

**Date:** 2026-01-08  
**Based on:** ChatGPT code review of v0.3 + integration feedback

---

## Summary

All three critical bugs fixed, embedded data payload removed, and **procedural ship engine now integrated across all UI surfaces** (Fleet Command, Ship Select, Hangar).

---

## Bug Fixes Applied

### 1. ✅ Duplicate watercolor-engine.js Include (CRITICAL)

**Problem:** `space-capital.html` was loading `watercolor-engine.js` twice, causing `const PIGMENTS` redeclaration errors.

**Fix:** Removed the duplicate, kept only the versioned include at line 4543.

---

### 2. ✅ Fake Data Fallbacks Removed + Embedded Payload Deleted

**Problem:** Code contained fake `price * 1.2/0.8` approximations AND a 26-line embedded `FALLBACK_DATA` blob.

**Fixes applied:**
- Fake 52w approximations → `null`
- Embedded FALLBACK_DATA → **DELETED ENTIRELY**
- Dev workflow via `?dev=1` query param loads `fleet.dev.json`

---

### 3. ✅ Cache Stores ImageBitmap Instead of Canvas

**Problem:** Caching canvas elements caused "teleportation" when same ship rendered in multiple DOM locations.

**Fix:** `RenderCache` now stores `ImageBitmap`, draws to fresh canvas on cache hit.

---

### 4. ✅ ShipRenderer Cached Per Size (Performance)

**Fix:** Renderers cached in `this._renderers` Map by size.

---

## NEW: Procedural Ship Integration

### 5. ✅ Created `shippix-bootstrap.js` - Global Engine Bootstrap

New file that provides:
- `window.ShipPixReady` - Promise that resolves when engine is ready
- `window.ShipPix` - Global engine instance
- `window.renderShipToCanvas(canvas, ticker, telemetry)` - Helper function
- `window.createShipCanvas(ticker, telemetry, size)` - Create rendered canvas
- `window.buildShipTelemetry(data)` - Normalize data for engine

**Usage:**
```javascript
await window.ShipPixReady;
window.ShipPix.renderToCanvas(canvas, ticker, telemetry);
```

---

### 6. ✅ Fleet Command - Procedural Ships

**Before:** `<img src="assets/ships/static/...">` static images

**After:** 
- Cards now include `<canvas class="vessel-sprite-canvas">`
- `renderProceduralShips()` renders all visible ship canvases
- Telemetry built from fleet data for accurate visualization

---

### 7. ✅ Ship Select (Dial) - Procedural Ships

**Before:** `<img>` tags with static GIFs

**After:**
- Cards use `<canvas class="ship-sprite-canvas">`
- `renderProceduralShips()` renders on init
- `MutationObserver` watches for new cards as user scrolls dial
- Debounced re-rendering prevents performance issues

---

### 8. ✅ Hangar - Procedural Hero Ship

**Before:** `<img>` tag with animated GIF

**After:**
- Hero section uses `<canvas id="hangarShipCanvas">`
- `renderProceduralShip()` called on load
- Re-renders with full telemetry after fleet data loads
- 256x256 canvas for high-quality hero display

---

### 9. ✅ CSS Fixes for Canvas Visibility

**Problem:** Canvas elements were rendering but potentially invisible due to CSS issues.

**Fixes:**
- Added explicit `width`/`height` to all `.ship-sprite-canvas` elements
- Fixed z-index layering: canvas slot above background grid layers
- Used `display: grid; place-items: center` for proper canvas centering
- Added `filter: drop-shadow()` for consistent glow effects

```css
.ship-sprite-canvas {
  width: 80px;
  height: 80px;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  filter: drop-shadow(0 0 10px var(--ship-color, #FF2975));
}
```

---

## Files Modified

1. **`html/space-capital.html`**
   - Removed duplicate script include
   - Removed all fake data approximations  
   - Deleted embedded FALLBACK_DATA
   - Added `?dev=1` query param for dev mode

2. **`js/render/pixel-ship-engine.js`**
   - RenderCache stores ImageBitmap (not canvas)
   - ShipRenderer cached per size
   - Proper memory management for bitmaps

3. **`js/render/shippix-bootstrap.js`** *(NEW)*
   - Global engine initialization
   - Ready promise for async loading
   - Helper functions for rendering

4. **`js/ui/fleet-command.js`**
   - Switched from static `<img>` to procedural `<canvas>`
   - Added `renderProceduralShips()` function
   - Builds telemetry from stats and fleet data

5. **`css/fleet-command.css`**
   - Added `.vessel-sprite-slot` and `.vessel-sprite-canvas` styles
   - Proper z-indexing for canvas layer

6. **`html/ship-select.html`**
   - Added procedural engine script includes
   - Cards use canvas instead of img
   - Added MutationObserver for dial scroll rendering
   - CSS for `.ship-sprite-canvas`

7. **`html/hangar.html`**
   - Added procedural engine script includes
   - Hero sprite is now canvas
   - `renderProceduralShip()` function
   - Re-renders with full telemetry after data loads

---

## Script Include Order

For pages using procedural ships:

```html
<script src="../js/render/seed.js"></script>
<script src="../js/lib/watercolor/watercolor-engine.js"></script>
<script src="../js/render/pixel-ship-engine.js"></script>
<script src="../js/render/shippix-bootstrap.js"></script>
```

---

## Dev Workflow

To test locally without live `fleet.json`:

1. Create `data/telemetry/fleet.dev.json` (copy structure from real fleet.json)
2. Add to `.gitignore`: `fleet.dev.json`
3. Open `space-capital.html?dev=1`

---

## Testing Checklist

- [ ] Page loads without script errors
- [ ] Console shows `[ShipPix] Engine initialized`
- [ ] Ships render in GENESIS panel
- [ ] Ships render in Fleet Command cards (console shows `[FleetCommand] Successfully rendered X`)
- [ ] Ships render in Ship Select dial (console shows `[ShipSelect] Successfully rendered X`)
- [ ] Ships render in Hangar hero section (console shows `[Hangar] Successfully rendered X`)
- [ ] Same ship in multiple locations: no teleportation

---

## Debugging

All procedural rendering functions now include comprehensive console logging:

```
[ShipPix] Engine initialized (with WatercolorEngine)
[FleetCommand] renderProceduralShips called
[FleetCommand] ShipPix engine: true
[FleetCommand] Found 10 canvases to render
[FleetCommand] Rendering RKLB canvas: 128 x 128
[FleetCommand] Successfully rendered RKLB
...
```

If ships are not rendering:
1. Check console for `[ShipPix] Engine initialized` - if missing, scripts aren't loading
2. Check for `ShipPix engine: true` - if false, engine failed to init
3. Check canvas dimensions - should be non-zero
4. Check z-index - canvas might be behind other layers

CSS changes ensure canvas visibility:
- `.vessel-sprite-slot` has `z-index: 2`
- `.ship-sprite-canvas` has explicit width/height matching render size
- `.ship-sprite-wrap` uses `display: grid; place-items: center`
