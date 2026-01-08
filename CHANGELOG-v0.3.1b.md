# Space Capital v0.3.1 - Bug Fixes

**Date:** 2026-01-08  
**Based on:** ChatGPT code review of v0.3

---

## Bug Fixes Applied

### 1. ✅ Duplicate watercolor-engine.js Include (CRITICAL)

**Problem:** `space-capital.html` was loading `watercolor-engine.js` twice:
- Line 4543: `../js/lib/watercolor/watercolor-engine.js?v=20260108`
- Line 5406: `../js/lib/watercolor/watercolor-engine.js` (no version)

This caused `const PIGMENTS` redeclaration errors or silent breakage.

**Fix:** Removed the duplicate at line 5406, keeping only the versioned include. Added a comment to prevent future duplicates.

---

### 2. ✅ Fake Data Fallbacks Removed ("All data market-derived" enforcement)

**Problem:** Despite "strip fake data" direction, code still contained:
- `FALLBACK_DATA` object with embedded position data
- Fake 52-week high/low approximations: `price * 1.2` / `price * 0.8`

**Fixes applied:**

#### a) `deriveTickerConfig()` (line ~3043)
- Changed from `price * 1.2/0.8` fallback to returning `null` for missing 52w data
- Returns `{ regime: 'UNKNOWN', rangePosition: null, volatilityProxy: null }` when data unavailable

#### b) `generateRegistryData()` (line ~4990)  
- Changed from fake 52w fallback to computing `rangePos: null` when data missing
- UI should display `--` for null values

#### c) History enrichment in `loadData()` (line ~4333)
- Changed from `ship.price * 1.2/0.8` to `null` for missing historical stats
- All return values now `null` instead of `0` when stats unavailable

#### d) Fail-closed fallback (line ~4354)
- **Before:** `return FALLBACK_DATA` (silent fake data usage)
- **After:** `throw new Error('FLEET_DATA_MISSING: Cannot render without fleet.json')`

#### e) DEV_MODE gate for FALLBACK_DATA
- `FALLBACK_DATA` is now gated behind `DEV_MODE = false`
- In production, `FALLBACK_DATA` is `null`
- Developers can set `DEV_MODE = true` for local testing without data files

---

### 3. ✅ Cache Stores ImageBitmap Instead of Canvas (DOM Node Fix)

**Problem:** `RenderCache` stored actual canvas elements. Canvas elements can only exist in one DOM location at a time. When rendering the same ship in multiple places (fleet grid, detail view, etc.), the cached canvas would "teleport" from the old location to the new one.

**Fix in `pixel-ship-engine.js`:**

#### RenderCache class changes:
```javascript
// Before: cache.set(key, canvas)
// After:  cache.set(key, await createImageBitmap(canvas))
```

- `set()` is now async and stores `ImageBitmap` instead of `canvas`
- `get()` returns `ImageBitmap` which can be drawn to any canvas
- `clear()` now calls `bitmap.close()` to release GPU memory
- Added memory cleanup on cache eviction

#### PixelShipEngine.renderShip() changes:
- When cache hit: creates new canvas and draws cached bitmap to it
- No longer returns cached canvas directly
- `renderToCanvas()` always renders fresh (bypasses cache for direct renders)

---

## Files Modified

1. **`html/space-capital.html`**
   - Removed duplicate script include
   - Removed fake data approximations
   - Added DEV_MODE gate for FALLBACK_DATA
   - Added fail-closed error for missing fleet data

2. **`js/render/pixel-ship-engine.js`**
   - RenderCache now stores ImageBitmap
   - Added proper memory management for cached bitmaps
   - Updated renderShip() to handle bitmap cache

---

## Testing Checklist

- [ ] Page loads without `const PIGMENTS` redeclaration error
- [ ] With valid `fleet.json`, dashboard renders normally
- [ ] Without `fleet.json`, throws clear error (doesn't silently use fake data)
- [ ] Ships render correctly in GENESIS panel
- [ ] Same ship can appear in multiple locations without "teleporting"
- [ ] No console errors about ImageBitmap

---

## Notes for Future Integration

Per ChatGPT's review, the following items are still TODO:

1. **Fleet grid integration:** `js/ui/fleet-command.js` still uses `<img src="ships/...">` static sprites. Should switch to `<canvas>` with `renderToCanvas()`.

2. **Dial selector integration:** Should use procedural render for 128px off-focus/256px focus ships.

3. **Optional enhancement:** Add `keel` param tag to blueprints for "heavy vs light" silhouette distinction.
