# HASLUN-BOT Fleet Animation Integration Guide

## Directory Structure Options

### Option A: Full Integration (Recommended for local/desktop)
```
trading/
├── assets/
│   └── ships/
│       ├── static/              # Original PNGs (~213KB) - fallback
│       │   ├── RKLB-flagship-ship.png
│       │   └── ...
│       └── animated/            # Full animation frames (~52MB)
│           ├── manifest.json
│           ├── RKLB/
│           │   ├── RKLB_base.png
│           │   ├── idle/
│           │   ├── thrust/
│           │   └── ...
│           └── [other ships]/
```

### Option B: Lightweight (GIFs only - ~3MB)
```
trading/
├── assets/
│   └── ships/
│       ├── RKLB-flagship-ship.png    # Keep originals
│       └── animated/                  # Just GIFs
│           ├── RKLB_idle.gif
│           ├── RKLB_special.gif
│           └── ...
```

### Option C: Hybrid (Idle + Special only - ~15MB)
```
trading/
├── assets/
│   └── ships/
│       ├── static/              # Original PNGs
│       └── animated/            # Only idle + special frames
│           ├── manifest.json
│           ├── RKLB/
│           │   ├── idle/        # 8 frames per ship
│           │   └── special/     # 8 frames per ship
│           └── ...
```

## Quick Integration Steps

### 1. Extract to your assets folder:
```bash
cd trading/assets/ships
unzip fleet_assets.zip
mv fleet_assets animated
```

### 2. Update ship-data.js paths:
The new `ship-animator.js` module handles this automatically.

### 3. Add the animator module to index.html:
```html
<script src="js/data/ship-animator.js"></script>
```

## File Size Summary

| Option | Size | Animations |
|--------|------|------------|
| Static only (current) | 213KB | None |
| GIFs only | ~3MB | idle, special |
| Idle + Special frames | ~15MB | idle, special (smooth) |
| Full frames | ~52MB | All 8 types |

## Recommendation

For HASLUN-BOT, I recommend **Option C (Hybrid)**:
- Keeps download reasonable (~15MB)
- Provides smooth `idle` animation for always-on hover
- Reserves `special` for ticker-specific events (earnings, price spikes)
- Can lazy-load other animations on demand
