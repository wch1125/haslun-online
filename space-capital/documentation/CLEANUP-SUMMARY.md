# PARALLAX Directory Cleanup Summary

## Before → After

### Root Files: 14 → 5 (64% reduction!)

| Status | File | Reason |
|--------|------|--------|
| ✅ KEEP | `index.html` | Main application |
| ✅ KEEP | `paint-bay.html` | Ship color customization tool |
| ✅ KEEP | `parallax-run.html` | Racing mini-game |
| ✅ KEEP | `README.md` | Project documentation (renamed from PARALLAX-README.md) |
| 🔧 NEW | `cleanup.sh` | This cleanup script (can delete after use) |

---

## Archived Files

### `_archive/html-legacy/` — Old HTML Pages
These were superseded by the new cockpit HUD architecture in `index.html`:

| File | What It Was |
|------|-------------|
| `derivatives.html` | Old 2000-line full-page variant |
| `ship-select.html` | Legacy ship selection interface |
| `index-legacy.html` | Backup of pre-cockpit index.html |

### `_archive/html-demos/` — Development Test Pages
These are dev tools, not user-facing pages:

| File | Purpose |
|------|---------|
| `ship-behavior-demo.html` | Testing ship animation states |
| `sprite-upgrades.html` | Sprite upgrade system testing |

### `_archive/docs-legacy/` — Old Documentation
Superseded READMEs and analysis docs:

| File | Why Archived |
|------|--------------|
| `HASLUN-BOT-README.md` | Old project name (now PARALLAX) |
| `HASLUN-BOT-Structure-Analysis.md` | One-time analysis document |
| `SPACE-CAPITAL-README.md` | Duplicate of PARALLAX-README.md |

### `_archive/docs-dev-logs/` — Build Logs
Historical records of development work:

| File | Contents |
|------|----------|
| `MODULARIZATION-LOG.md` | CSS/JS modularization history |
| `OPTIMIZATION-REPORT.md` | Performance optimization notes |
| `FLEET-ANIMATION-INTEGRATION.md` | Animation system integration guide |

---

## Clean Folder Structure

```
trading/
├── index.html              ← Main app (cockpit HUD)
├── paint-bay.html          ← Color customization
├── parallax-run.html       ← Racing game
├── README.md               ← Documentation
│
├── assets/
│   └── ships/              ← All ship sprites (static + animated)
│
├── css/
│   ├── styles.css          ← Main styles
│   ├── cockpit-hud.css     ← HUD navigation
│   ├── bey-arena.css       ← Battle arena
│   └── ... (10 total)
│
├── data/
│   ├── *.json              ← Market data files
│   └── indicators/
│
├── js/
│   ├── app.js              ← Main application
│   ├── cockpit-nav.js      ← HUD controller
│   ├── core/               ← State management
│   ├── data/               ← Telemetry & profiles
│   ├── games/              ← Mini-games
│   ├── ships/              ← Ship behavior
│   ├── sprites/            ← Sprite rendering
│   ├── state/              ← Progression system
│   └── ui/                 ← UI components
│
└── _archive/               ← Archived files (safe to delete)
    ├── html-legacy/
    ├── html-demos/
    ├── docs-legacy/
    └── docs-dev-logs/
```

---

## How to Apply

### Option 1: Run the Script
```bash
cd trading/
chmod +x cleanup.sh
./cleanup.sh
```

### Option 2: Manual Moves
Follow the "Archived Files" tables above and move files manually.

---

## After Verification

Once you've confirmed everything works:

```bash
# Remove the archive folder entirely
rm -rf _archive/

# Remove the cleanup script
rm cleanup.sh
```

This leaves you with a clean 5-file root:
- `index.html`
- `paint-bay.html`  
- `parallax-run.html`
- `README.md`
- (folders: assets, css, data, js)
