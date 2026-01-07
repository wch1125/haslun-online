# Space Capital Restructure - Implementation Summary

**Date:** January 2025

---

## What Was Done

### 1. Entry Point Change
- **`index.html`** → Now a simple redirect to `html/space-capital.html`
- The Hotline Miami dashboard (`space-capital.html`) is now the canonical entry point
- Old cockpit-based index preserved as `html/index-legacy.html`

### 2. Shared Theme System Created
- **`css/theme.css`** — Canonical Hotline Miami color palette as CSS variables
- All pages can now import this for consistent styling
- Colors: Magenta (`#FF2975`), Cyan (`#00FFFF`), etc.

### 3. Module Viewer Integration
- **`css/module-viewer.css`** — Overlay styling for iframe viewer
- **`js/ui/module-viewer.js`** — Controller for loading orphan pages
- Added to `space-capital.html` with "🧰 MODULES" button in header
- Allows safe access to all secondary pages without CSS conflicts

#### Available Modules:
| Module | Description |
|--------|-------------|
| Derivatives Console | Options positions dashboard |
| Ship Select | Mario Kart-style hangar selection |
| Paint Bay | Ship livery customization |
| Sprite Tests | Animation testing |
| Behavior Demo | Ship behavior testing |
| Parallax Run | Racing game |
| Legacy Index | Old cockpit system |

### 4. Files Deleted (Bloat Removal)
- `css/cockpit-hud.css` — Replaced by space-capital.html's built-in styles
- `css/cockpit-hud-legacy.css` — No longer needed
- `js/cockpit-nav.js` — Replaced by module viewer
- `js/cockpit-nav-legacy.js` — No longer needed

### 5. Path Fixes
- Updated `html/derivatives.html` — Fixed CSS import paths, added theme.css
- Updated `html/ship-select.html` — Fixed CSS/JS/data import paths, added theme.css
- Consolidated data directories into `data/` folder

### 6. Data Structure Organized
```
data/
├── index.json
├── stats.json
├── telemetry/
│   ├── fleet.json      ← Real-time ship telemetry
│   └── manifest.json
└── timeseries/
    ├── rklb.json       ← Historical candle data
    ├── lunr.json
    └── ... (per ticker)
```

---

## Current Architecture

```
space-capital/
├── index.html                  ← Redirect to html/space-capital.html
├── html/
│   ├── space-capital.html     ← PRIMARY ENTRY (Hotline Miami Fleet Dashboard)
│   ├── derivatives.html       ← Options console (via Module Viewer)
│   ├── ship-select.html       ← Ship selection hangar
│   ├── paint-bay.html         ← Livery customization
│   ├── ship-behavior-demo.html
│   ├── sprite-upgrades.html
│   ├── parallax-run.html
│   └── index-legacy.html      ← Old cockpit system (archived)
├── css/
│   ├── theme.css              ← NEW: Canonical Hotline Miami palette
│   ├── module-viewer.css      ← NEW: Iframe overlay styles
│   ├── crt-effects.css        ← VHS/scanline effects
│   ├── ship-select.css
│   ├── ship-brief.css
│   ├── fleet-command.css
│   ├── paint-bay.css
│   ├── ship-states.css
│   ├── accessibility.css
│   ├── bey-arena.css          ← Kept but de-emphasized
│   └── styles.css             ← Legacy (305KB - needs future pruning)
├── js/
│   ├── ui/
│   │   ├── module-viewer.js   ← NEW: Iframe page loader
│   │   ├── fleet-command.js
│   │   ├── ship-select.js
│   │   └── ...
│   ├── games/
│   │   ├── bey-arena.js       ← Kept but not prominent
│   │   └── ...
│   └── ...
└── data/
    ├── telemetry/fleet.json   ← Ship stats from market data
    └── timeseries/*.json      ← Historical price data
```

---

## How to Use

1. **Open the app:** Navigate to `index.html` or `html/space-capital.html`
2. **View fleet:** Main dashboard shows all ships with telemetry data
3. **Access modules:** Click "🧰 MODULES" button to open secondary pages
4. **Select module:** Choose from dropdown to load Derivatives, Ship Select, etc.

---

## Next Steps (Recommendations)

1. **Prune `styles.css`** — It's 305KB of accumulated CSS; most is likely unused
2. **Restyle Ship Select** — Update to match Hotline Miami palette
3. **Add chart integration** — Wire up timeseries data to ship detail views
4. **Mobile optimization** — Test module viewer on mobile devices
5. **Consider full merge** — Eventually port key features from orphan pages into main dashboard

---

## Design System Reference

### Colors (from theme.css)
```css
--magenta: #FF2975      /* Primary accent */
--cyan: #00FFFF         /* Secondary accent */
--yellow: #FFE600       /* Data/warning */
--green-neon: #39FF14   /* Success/positive */
--orange: #FF6B35       /* Action/danger */
--red-alert: #FF0040    /* Alert */
--bg-void: #0A0A0F      /* Deepest background */
--bg-panel: #12121A     /* Panel background */
```

### Fonts
- **Display:** VT323 (retro terminal)
- **Body/Data:** IBM Plex Mono
