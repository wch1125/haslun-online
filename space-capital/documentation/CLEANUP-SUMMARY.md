# Space Capital Cleanup Summary

## Changes Made

### Pages Deleted (Incomplete/Not Needed)
- `paint-bay.html` — Only showed explanation text, no actual functionality
- `sprite-upgrades.html` — Technical demo, not needed for main app
- `parallax-run.html` — Game, deprioritized
- `index-legacy.html` — Old cockpit version, superseded

### CSS Files Deleted
- `paint-bay.css`
- `bey-arena.css`
- `cockpit-hud.css`
- `cockpit-hud-legacy.css`

### JS Files Deleted
- `cockpit-nav.js`
- `cockpit-nav-legacy.js`
- `games/bey-arena.js`
- `games/parallax-run.js`
- `ui/paint-bay.js`

### Path Fixes Applied
All files in `/html/` were loading JS/CSS/assets with incorrect paths (e.g., `js/` instead of `../js/`).

**Fixed files:**
1. **derivatives.html** — Fixed all script/css/data paths
2. **ship-behavior-demo.html** — Fixed CSS and asset paths
3. **ship-data.js** — Added auto-detection for path prefix based on page location
4. **indicator-loader.js** — Added auto-detection for data path prefix
5. **ship-select.js** — Fixed asset paths

### Module Viewer Updated
Reduced from 7 modules to 3 working modules:
- 📊 Derivatives Console
- 🚀 Ship Select  
- ⚡ Behavior Demo

---

## Final Structure

```
space-capital/
├── index.html                  ← Redirects to html/space-capital.html
├── html/
│   ├── space-capital.html     ← Main fleet dashboard (Hotline Miami)
│   ├── derivatives.html       ← Options console (FIXED)
│   ├── ship-select.html       ← Ship selection screen (FIXED)
│   └── ship-behavior-demo.html← Behavior system demo (FIXED)
├── css/
│   ├── theme.css              ← Canonical Hotline Miami palette
│   ├── module-viewer.css      ← Module overlay styles
│   ├── ship-select.css
│   ├── ship-states.css
│   ├── ship-brief.css
│   ├── crt-effects.css
│   ├── fleet-command.css
│   ├── styles.css
│   └── accessibility.css
├── js/
│   ├── ui/
│   │   ├── module-viewer.js   ← Updated (3 modules)
│   │   ├── ship-animator.js
│   │   ├── ship-select.js     ← FIXED paths
│   │   └── ...
│   ├── data/
│   │   ├── ship-data.js       ← FIXED auto-detect paths
│   │   ├── indicator-loader.js← FIXED auto-detect paths
│   │   └── ...
│   └── ...
├── assets/
│   └── ships/
│       ├── animated/gifs/     ← All ticker GIFs
│       └── static/            ← Static PNG sprites
└── data/
    ├── telemetry/fleet.json
    └── timeseries/*.json
```

---

## How the Path Fix Works

Added auto-detection in key JS files:

```javascript
// Detects if page is in /html/ subdirectory
const PATH_PREFIX = window.location.pathname.includes('/html/') ? '../' : '';

// Then uses it for asset paths
const ASSET_PATH = PATH_PREFIX + 'assets/ships/...';
```

This allows the same JS files to work from both:
- Root pages: `assets/ships/...`
- /html/ pages: `../assets/ships/...`
