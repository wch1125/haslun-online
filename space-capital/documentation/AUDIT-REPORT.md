# SPACE CAPITAL: Architecture & Design Audit Report

**Date:** January 2025  
**Focus:** Hangar/Fleet redesign, design consistency, bloat reduction

---

## Executive Summary

The project has **diverged into three competing design directions** that need reconciliation:

| Component | Branding | Primary Color | Design System |
|-----------|----------|---------------|---------------|
| `index.html` (main) | PARALLAX/SPACE CAPITAL | Green phosphor `#33ff99` | Clean sci-fi cockpit |
| `html/space-capital.html` | SPACE CAPITAL | Magenta `#FF2975` | **Hotline Miami** ✓ |
| `html/derivatives.html` | PARALLAX | Green phosphor | Pip-Boy/Fallout |
| `html/ship-select.html` | PARALLAX | Green phosphor | Mario Kart |

**The Hotline Miami aesthetic was implemented in `space-capital.html` but never propagated to the main entry point.**

---

## Problem #1: The Cockpit System Hides Everything Good

The current `index.html` loads a 3-pillar navigation system (`cockpit-nav.js` + `cockpit-hud.css`) that:

```
✗ Hides the original sidebar with market data
✗ Hides the chart/telemetry panel
✗ Hides the fleet command grid
✗ Hides the derivatives panel
✗ Prioritizes Battle Arena (now deprioritized)
```

**The HANGAR panel shows an RPG-style character sheet** that doesn't showcase market data meaningfully.

**Recommendation:** Disable the cockpit overlay system and restore the dashboard architecture.

---

## Problem #2: Fragmented Page Architecture

### Currently Active
- `index.html` — Entry point, but most content hidden by cockpit overlay

### Excellent But Orphaned
| File | Purpose | Status |
|------|---------|--------|
| `html/space-capital.html` | Fleet dashboard with proper Hotline Miami aesthetic | **Best implementation, unused** |
| `html/derivatives.html` | Options/positions dashboard with scrolling ticker | Complete, linked but not primary |
| `html/ship-select.html` | Mario Kart-style ship selection | Functional, wrong branding |

### Demo/Legacy
- `html/ship-behavior-demo.html` — Technical demo
- `html/sprite-upgrades.html` — Sprite testing
- `html/paint-bay.html` — Livery customization stub
- `html/parallax-run.html` — Racing game stub
- `html/index-legacy.html` — Old version backup

---

## Problem #3: CSS Bloat & Conflicts

### File Sizes
```
css/styles.css           — 11,412 lines (!)
css/cockpit-hud.css      — 810 lines
css/bey-arena.css        — (Battle Arena specific)
css/fleet-command.css    — Fleet grid styles
css/ship-select.css      — Ship selection styles
css/ship-states.css      — Animation states
css/crt-effects.css      — VHS/CRT overlays
css/ship-brief.css       — Modal dialog
css/paint-bay.css        — Livery editor
css/accessibility.css    — A11y utilities
```

### The Problem
- `styles.css` contains **everything** — loading screens, charts, modals, games, mobile
- Cockpit CSS uses `!important` to override original styles
- Two different color systems (CSS vars vs hardcoded)

---

## Problem #4: Underutilized Data

You have rich data that's barely visible:

### Available Data
```
data/telemetry/fleet.json    — Real-time ship stats (trend, momentum, volatility)
data/timeseries/*.json       — Historical candle data per ticker
data/stats.json              — Aggregated ticker statistics
```

### What `space-capital.html` Does Right
- Fleet cards showing price, trend, momentum, volatility
- Visual signal states (bull/bear/neutral)
- Catalyst timeline
- Sector themes with color coding
- Proper P&L display

### What Current Hangar Shows
- Generic stat bars (Thrust, Stability, Hull, Signal, Volatility)
- No actual price data
- No P&L information
- No charts
- No options/derivatives data

---

## Recommended Architecture

### Option A: Promote `space-capital.html` to Main Entry

```
index.html           → Redirect to html/space-capital.html
                       OR copy space-capital.html content to index.html

html/space-capital.html  → Primary dashboard (Hotline Miami)
html/derivatives.html    → Options/positions detail view
html/ship-select.html    → Fleet hangar (restyle to match)
```

**Pros:** Best aesthetic already implemented, minimal new work  
**Cons:** Requires updating paths, losing some index.html features

### Option B: Rebuild `index.html` with Hotline Miami System

1. **Remove cockpit overlay system**
2. **Port color palette from `space-capital.html`**
3. **Restore original tab-based navigation**
4. **Add Hotline Miami effects (scanlines, noise, chromatic aberration)**

**Pros:** Keeps existing functionality, cleaner architecture  
**Cons:** More work, risk of regression

### Option C: Hybrid Multi-Page App

```
index.html              → Landing/loading → redirects to:
  ├── fleet.html        → Fleet overview dashboard
  ├── hangar.html       → Individual ship detail + charts
  ├── derivatives.html  → Options positions
  └── arena.html        → Games (low priority)
```

**Pros:** Clean separation, easier maintenance  
**Cons:** More files to maintain, shared state complexity

---

## Immediate Action Items

### Phase 1: Design Consolidation (This Session)

1. **Define canonical color palette** (Hotline Miami magenta-first)
2. **Create shared CSS variables file** that all pages import
3. **Disable cockpit overlay** in `index.html`
4. **Restore dashboard functionality** with updated styling

### Phase 2: Data Integration

1. **Fleet dashboard** showing real telemetry data
2. **Interactive ship cards** with price, P&L, trend indicators
3. **Chart integration** for individual ship drill-down
4. **News/catalyst feed** with market events

### Phase 3: Cleanup

1. **Archive unused CSS** from `styles.css`
2. **Remove Bey Arena prominence** (keep code, remove from nav)
3. **Consolidate JS modules**
4. **Document final architecture**

---

## Files to Keep vs Archive

### Keep (Active)
```
index.html                    (after redesign)
css/styles.css                (after pruning)
css/crt-effects.css
css/fleet-command.css
js/core/*
js/data/*
js/ui/fleet-command.js
js/ui/shipBrief.js
```

### Archive (Move to _archive/)
```
css/cockpit-hud.css           (replaced by new system)
css/bey-arena.css             (low priority feature)
js/cockpit-nav.js             (replaced)
js/games/bey-arena.js         (low priority)
js/games/space-run.js         (low priority)
html/paint-bay.html           (incomplete)
html/parallax-run.html        (incomplete)
```

### Promote (Integrate or Replace Main)
```
html/space-capital.html       → Source for new main design
html/derivatives.html         → Keep as secondary page
html/ship-select.html         → Restyle and integrate
```

---

## Proposed Design System

### Hotline Miami Color Palette
```css
:root {
  /* Primary - Hot Magenta */
  --magenta: #FF2975;
  --magenta-dark: #CC1F5C;
  --magenta-glow: rgba(255, 41, 117, 0.4);
  
  /* Accent - Electric Cyan */
  --cyan: #00FFFF;
  --cyan-dim: rgba(0, 255, 255, 0.3);
  
  /* Warning/Data - Neon Yellow */
  --yellow: #FFE600;
  
  /* Success - Toxic Green */
  --green-neon: #39FF14;
  
  /* Danger - Blood Orange */
  --orange: #FF6B35;
  --red-alert: #FF0040;
  
  /* Backgrounds - Deep Purple-Black */
  --bg-void: #0A0A0F;
  --bg-panel: #12121A;
  --bg-surface: #1A1A24;
  --bg-elevated: #22222E;
  
  /* Text */
  --text-primary: #F0F0F0;
  --text-dim: #888899;
  --text-muted: #555566;
  
  /* Borders */
  --border-harsh: var(--magenta);
  --border-dim: #333344;
}
```

### Typography
```css
--font-display: 'VT323', monospace;     /* Headers, titles */
--font-body: 'IBM Plex Mono', monospace; /* Body text */
--font-data: 'IBM Plex Mono', monospace; /* Numbers, data */
```

### Effects
- CRT scanlines (subtle, 0.03 opacity)
- VHS noise overlay (animated, 0.02 opacity)  
- Chromatic aberration on hover
- Phosphor glow on active elements
- Sharp corners (2-4px radius max)

---

## Questions for Will

1. **Entry point preference:** Keep `index.html` or promote `space-capital.html`?
2. **Multi-page vs SPA:** Separate pages for different views, or tabs within one page?
3. **Data priority:** What telemetry data is most important to showcase?
4. **Game features:** Archive Bey Arena entirely or keep accessible but hidden?
5. **Derivatives view:** Important enough to keep prominent, or secondary?

---

## Next Steps

Once you confirm direction, I can:

1. Create the unified CSS design system
2. Rebuild the fleet dashboard with Hotline Miami aesthetic
3. Wire up telemetry data to interactive ship cards
4. Consolidate/archive bloated files
5. Document the final architecture

Ready when you are! 🚀
