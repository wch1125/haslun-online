# Space Capital - AI Collaboration Guide

## Legend
```
✅ INCLUDE  - Always send to Claude
⚠️ SELECTIVE - Send config/manifest only, not bulk data
❌ EXCLUDE  - Never send (large assets, binary files, archives)
📝 CONTEXT  - Send only when relevant to the task
```

---

## Directory Tree with AI Inclusion Markers

```
SPACE-CAPITAL/
│
├── index.html                          ✅ INCLUDE
│
├───assets/                             
│   └───ships/
│       ├───animated/
│       │   ├── manifest.json           ✅ INCLUDE (config)
│       │   ├───gifs/                   ❌ EXCLUDE (1.5MB+ binary)
│       │   │   └── *.gif               ❌ EXCLUDE
│       │   └───{TICKER}/               ❌ EXCLUDE (frame PNGs)
│       │       ├── *_base.png          ❌ EXCLUDE
│       │       ├── idle/*.png          ❌ EXCLUDE
│       │       └── special/*.png       ❌ EXCLUDE
│       ├───static/                     ❌ EXCLUDE (static PNGs)
│       │   └── *.png                   ❌ EXCLUDE
│       ├───base/                       ❌ EXCLUDE
│       └───parts/                      
│           └── README.md               📝 CONTEXT (if discussing sprites)
│
├───css/                                ✅ INCLUDE (all CSS)
│   ├── theme.css                       ✅ INCLUDE (primary)
│   ├── module-viewer.css               ✅ INCLUDE
│   ├── ship-select.css                 ✅ INCLUDE
│   ├── ship-states.css                 ✅ INCLUDE
│   ├── ship-brief.css                  ✅ INCLUDE
│   ├── crt-effects.css                 ✅ INCLUDE
│   ├── fleet-command.css               ✅ INCLUDE
│   ├── accessibility.css               📝 CONTEXT
│   └── styles.css                      ⚠️ SELECTIVE (305KB - send excerpts)
│
├───html/                               ✅ INCLUDE (all HTML)
│   ├── space-capital.html              ✅ INCLUDE (primary)
│   ├── derivatives.html                ✅ INCLUDE
│   ├── ship-select.html                ✅ INCLUDE
│   └── ship-behavior-demo.html         ✅ INCLUDE
│
├───js/                                 
│   ├── app.js                          ⚠️ SELECTIVE (306KB - send excerpts)
│   ├── mission-system.js               📝 CONTEXT (62KB)
│   ├── flight-scene.js                 📝 CONTEXT
│   ├── space-scene.js                  📝 CONTEXT
│   ├── mission-bridge.js               📝 CONTEXT
│   │
│   ├───core/                           ✅ INCLUDE (all)
│   │   ├── constants.js                ✅ INCLUDE
│   │   ├── bus.js                      ✅ INCLUDE
│   │   └── store.js                    ✅ INCLUDE
│   │
│   ├───data/                           ✅ INCLUDE (all)
│   │   ├── ship-data.js                ✅ INCLUDE
│   │   ├── ticker-profiles.js          ✅ INCLUDE
│   │   ├── ship-animator.js            ✅ INCLUDE
│   │   ├── indicator-loader.js         ✅ INCLUDE
│   │   ├── telemetry.js                ✅ INCLUDE
│   │   ├── holo-ships.js               📝 CONTEXT
│   │   ├── pixel-icons.js              📝 CONTEXT
│   │   └── glossary.js                 📝 CONTEXT
│   │
│   ├───ui/                             ✅ INCLUDE (all)
│   │   ├── module-viewer.js            ✅ INCLUDE
│   │   ├── ship-animator.js            ✅ INCLUDE
│   │   ├── ship-select.js              ✅ INCLUDE
│   │   ├── fleet-command.js            ✅ INCLUDE
│   │   ├── shipBrief.js                ✅ INCLUDE
│   │   ├── ship-idle.js                📝 CONTEXT
│   │   ├── contextFocus.js             📝 CONTEXT
│   │   └── accessibility.js            📝 CONTEXT
│   │
│   ├───ships/                          📝 CONTEXT
│   │   ├── ship-behavior.js            📝 CONTEXT
│   │   └── ship-behavior-bridge.js     📝 CONTEXT
│   │
│   ├───sprites/                        📝 CONTEXT
│   │   ├── sprite-composer.js          📝 CONTEXT
│   │   ├── ship-sprite-manager.js      📝 CONTEXT
│   │   ├── livery-renderer.js          📝 CONTEXT
│   │   └── upgrade-mapper.js           📝 CONTEXT
│   │
│   ├───state/                          📝 CONTEXT
│   │   ├── upgrades.js                 📝 CONTEXT
│   │   ├── progression.js              📝 CONTEXT
│   │   └── liveries.js                 📝 CONTEXT
│   │
│   ├───games/                          📝 CONTEXT (deprioritized)
│   │   ├── mini-games.js               📝 CONTEXT
│   │   └── space-run.js                📝 CONTEXT
│   │
│   └───audio/                          📝 CONTEXT
│       └── audio-system.js             📝 CONTEXT
│
├───data/                               
│   ├── index.json                      ✅ INCLUDE
│   ├── stats.json                      ✅ INCLUDE
│   ├── tickers.txt                     ✅ INCLUDE
│   ├── generate_telemetry.py           📝 CONTEXT (Python script)
│   │
│   ├───telemetry/                      ✅ INCLUDE
│   │   ├── fleet.json                  ✅ INCLUDE (5KB)
│   │   └── manifest.json               ✅ INCLUDE
│   │
│   ├───timeseries/                     ⚠️ SELECTIVE
│   │   ├── index.json                  ✅ INCLUDE (manifest)
│   │   └── *.json                      ❌ EXCLUDE (1MB+ each)
│   │
│   ├───indicators/                     ⚠️ SELECTIVE
│   │   └───45m/
│   │       ├── manifest.json           ✅ INCLUDE
│   │       └── *.csv                   ❌ EXCLUDE (large CSVs)
│   │
│   ├───options_summaries/              📝 CONTEXT
│   └───market_summaries/               📝 CONTEXT
│
├───documentation/                      ✅ INCLUDE (all docs)
│   ├── README.md                       ✅ INCLUDE
│   ├── SPACE-CAPITAL-README.md         ✅ INCLUDE (primary)
│   ├── AUDIT-REPORT.md                 ✅ INCLUDE
│   ├── CLEANUP-SUMMARY.md              ✅ INCLUDE
│   ├── IMPLEMENTATION-SUMMARY.md       ✅ INCLUDE
│   └── *.md                            📝 CONTEXT (other docs)
│
└───_archive/                           ❌ EXCLUDE (entire folder)
    └── *                               ❌ EXCLUDE
```

---

## Quick Reference: What to Zip for Claude

### 🎯 LITE ZIP (Recommended for most tasks)
Best for: Bug fixes, UI changes, feature additions
```
html/*.html
css/*.css (except styles.css if not needed)
js/core/*
js/data/*
js/ui/*
data/telemetry/*
data/stats.json
documentation/SPACE-CAPITAL-README.md
```
**Approximate size: ~500KB**

### 📦 STANDARD ZIP (Full working context)
Best for: Major refactoring, architecture changes
```
Everything in LITE, plus:
js/ships/*
js/sprites/*
js/state/*
css/styles.css
data/indicators/45m/manifest.json
documentation/*.md
```
**Approximate size: ~1.5MB**

### 🚫 NEVER INCLUDE
```
assets/ships/animated/gifs/*
assets/ships/animated/{TICKER}/*
assets/ships/static/*
data/timeseries/*.json (except index.json)
data/indicators/45m/*.csv
_archive/*
js/app.js (306KB monolith - send excerpts only)
```

---

## File Size Reference

| File/Folder | Size | Include? |
|-------------|------|----------|
| `js/app.js` | 306KB | ⚠️ Excerpts only |
| `css/styles.css` | 305KB | ⚠️ Excerpts only |
| `js/mission-system.js` | 62KB | 📝 Context |
| `assets/ships/animated/gifs/` | ~2MB | ❌ Never |
| `data/timeseries/*.json` | ~1MB each | ❌ Never |
| `data/indicators/45m/*.csv` | ~500KB each | ❌ Never |
| All HTML files | ~180KB total | ✅ Always |
| Core JS (`core/`, `data/`, `ui/`) | ~150KB | ✅ Always |

