# Space Capital — Ship System Integration Roadmap

**Created:** 2026-01-08  
**Goal:** Unified procedural ship rendering with proper architecture

---

## Current State Summary

You have TWO codebases that got "divorced":

| Codebase | What It Has | What It's Missing |
|----------|-------------|-------------------|
| **Live repo** | Working pages, some procedural ship code | Fragmented rendering (each page wires ships differently) |
| **Legacy zip** | Proper architecture (Store, Bus, facades) | Disconnected from procedural engine |

**The fix:** Merge them properly so there's ONE way to render ships.

---

## Architecture Target

```
┌─────────────────────────────────────────────────────────────┐
│  UI LAYER (html pages + js/ui/*.js)                         │
│  Fleet Command, Hangar, Ship Select, Derivatives            │
│                                                             │
│  Rule: ONLY calls ShipSprites.renderToCanvas()              │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│  FACADE: js/sprites/ship-sprite-manager.js                  │
│                                                             │
│  - ShipSprites.renderToCanvas(canvas, ticker, size)         │
│  - ShipSprites.getShipInfo(ticker)                          │
│  - Internally converts Store/Telemetry → engine format      │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│  DATA LAYER: js/data/telemetry.js + positions-store.js      │
│                                                             │
│  - Market-derived stats (real data only)                    │
│  - Feeds into sprite rendering                              │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│  RENDER ENGINE: js/render/*                                 │
│                                                             │
│  - seed.js (deterministic hashing)                          │
│  - pixel-ship-engine.js (procedural rendering)              │
│  - shippix-bootstrap.js (initialization)                    │
│                                                             │
│  Rule: UI NEVER touches this directly                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Milestones

### ✅ MILESTONE 1: Procedural Engine (COMPLETE)
- [x] seed.js — deterministic ticker hashing
- [x] pixel-ship-engine.js — 15 unique ship geometries
- [x] sprite-upgrades.js — stats → visual upgrades
- [x] shippix-bootstrap.js — global initialization
- [x] Watercolor palette integration

**Deliverable:** `space-capital-v1.0-unified.zip` ✅

---

### 🔄 MILESTONE 2: Facade Integration (THIS SESSION)
**Goal:** Single API that all UI calls

- [x] **2.1** Rewrite `js/sprites/ship-sprite-manager.js` as facade
  - Wraps PixelShipEngine
  - Provides `ShipSprites.renderToCanvas(canvas, ticker, size)`
  - Internally fetches telemetry from Store/Telemetry modules
  
- [x] **2.2** Create `js/sprites/telemetry-adapter.js`
  - Converts market data → engine telemetry format
  - Single source of truth for data transformation
  
- [x] **2.3** Update script loading order
  - Documented in SCRIPT_LOAD_ORDER.md
  - All dependencies properly chained

**Deliverable:** `space-capital-milestone2.zip` ✅

---

### ⏳ MILESTONE 3: UI Wiring (NEXT SESSION)
**Goal:** All pages use the facade

- [ ] **3.1** Fleet Command cards → `<canvas>` + `ShipSprites.renderToCanvas()`
- [ ] **3.2** Ship Select grid → `<canvas>` + `ShipSprites.renderToCanvas()`
- [ ] **3.3** Hangar hero ship → `<canvas>` + `ShipSprites.renderToCanvas()`
- [ ] **3.4** Remove ad-hoc `window.renderShipToCanvas()` calls

**Deliverable:** Updated HTML pages

---

### ⏳ MILESTONE 4: Data Pipeline Cleanup (FUTURE)
**Goal:** All telemetry from real market data

- [ ] **4.1** Connect to live telemetry.js data
- [ ] **4.2** Remove any fake/fallback data paths
- [ ] **4.3** Validate guest data flows correctly

---

### ⏳ MILESTONE 5: Polish & Extras (FUTURE)
- [ ] Animation system (idle, thrust, special)
- [ ] Paint bay / livery integration
- [ ] GIF fallback for non-canvas contexts
- [ ] Mobile optimizations

---

## File Inventory

### Render Engine (js/render/) — DONE ✅
```
js/render/
├── seed.js                 ✅ Deterministic hashing
├── pixel-ship-engine.js    ✅ 15 unique ships + upgrades
├── sprite-upgrades.js      ✅ Stats → visual mapping
└── shippix-bootstrap.js    ✅ Global init + helpers
```

### Sprite Facade (js/sprites/) — BUILDING NOW 🔄
```
js/sprites/
├── ship-sprite-manager.js  🔄 REWRITE as facade
├── telemetry-adapter.js    🔄 NEW - data conversion
├── sprite-composer.js      ❌ DEPRECATED (was PNG-based)
├── upgrade-mapper.js       ❌ DEPRECATED (merged into engine)
└── livery-renderer.js      ⏳ FUTURE (paint bay)
```

### Data Layer (js/data/) — KEEP AS-IS
```
js/data/
├── telemetry.js            ✅ Keep - market data
├── positions-store.js      ✅ Keep - position tracking
├── holo-ships.js           ✅ Keep - SVG wireframes
├── pixel-icons.js          ✅ Keep - UI icons
└── ... (other data files)
```

### UI Layer (js/ui/) — UPDATE IN MILESTONE 3
```
js/ui/
├── fleet-command.js        ⏳ Update to use facade
├── ship-select.js          ⏳ Update to use facade  
├── hangar-watercolor.js    ⏳ Update to use facade
└── ... (other UI files)
```

---

## Current Session Focus

**We are at:** Milestone 2 — Facade Integration

**Immediate tasks:**
1. Create new `ship-sprite-manager.js` that wraps procedural engine
2. Create `telemetry-adapter.js` for data conversion
3. Package as drop-in files

**You will have:** A single `ShipSprites` API that any UI can call.

---

## Quick Reference

**To render a ship (after Milestone 2):**
```javascript
// Any UI component just does this:
const canvas = document.querySelector('.ship-canvas');
await ShipSprites.renderToCanvas(canvas, 'RKLB', 128);
```

**The facade internally:**
1. Gets telemetry from Store/Telemetry modules
2. Converts to engine format
3. Calls PixelShipEngine.renderToCanvas()
4. Handles caching, errors, fallbacks

**UI never knows** if ships are procedural, PNGs, or GIFs.
