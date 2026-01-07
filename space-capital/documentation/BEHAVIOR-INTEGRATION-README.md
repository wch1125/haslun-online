# Ship Behavior Integration Patch

This patch integrates the ship behavior system from the demo page across the entire Space Capital application.

## What Changed

### Files Modified

| File | Changes |
|------|---------|
| `html/space-capital.html` | Added CSS import, behavior badges, click-to-module handler |
| `html/ship-select.html` | Added CSS & JS imports for behavior system |
| `html/ship-behavior-demo.html` | Added postMessage receiver for context-aware loading |
| `js/ui/ship-select.js` | Added behavior initialization on ship cards |
| `js/ships/ship-behavior.js` | Copied from existing (ensure in js/ships/) |

### New Behavior

**Fleet Dashboard (space-capital.html):**
- Ships now have `.ship-behavior` class and receive behavior state classes
- Behavior badges under each ship show: THRUST, STABILITY, HULL status
- Clicking a ship card opens the Behavior Demo module with that ship's current stats
- CSS from `ship-states.css` applies thrust/drift/damage animations

**Ship Select (ship-select.html):**
- Ship sprites now initialize ShipBehavior controllers
- Stats are mapped to behavior inputs (POWER→P&L, LUCK→volatility, etc.)
- Ships "perform" based on their market-derived stats

**Behavior Demo (ship-behavior-demo.html):**
- Now listens for `postMessage` from parent iframe
- When opened from a ship card, auto-loads that ship + its current stats
- Sliders update to reflect the selected ship's telemetry

## Integration Architecture

```
space-capital.html
├── Loads: ship-states.css (behavior animations)
├── Loads: ship-behavior.js (behavior engine)
├── Loads: ship-animator.js (GIF selection)
│
├── renderShipCard()
│   └── Adds: .ship-behavior class, data-attributes, behavior-badges div
│
├── hydrateSprites()
│   ├── ShipAnimator.hydrateShipSprites() → GIF selection
│   └── ShipBehavior.create() → State machine + CSS classes
│       └── updateStats() → Applies thrust/volatile/hull classes
│       └── Updates badge text: THRUST++, STABLE, HULL OK, etc.
│
└── Click handler
    └── Opens module-viewer → ship-behavior-demo.html
    └── postMessage({ type: 'SHIP_BEHAVIOR_SET', ticker, stats })
```

## Behavior State Mapping

| Telemetry Input | Behavior Output | Visual Effect |
|-----------------|-----------------|---------------|
| P&L ≥ +5% | thrust-strong | Forward motion + bright glow |
| P&L 0-5% | thrust-positive | Gentle forward motion |
| P&L -5-0% | thrust-negative | Backward drift |
| P&L ≤ -5% | thrust-failing | Heavy drift + dim engines |
| Vol ≥ 8% | volatile-extreme | Violent shaking |
| Vol 5-8% | volatile-high | Noticeable jitter |
| Vol 3-5% | volatile-elevated | Subtle vibration |
| Hull ≥ 80% | hull-optimal | Clean, no damage |
| Hull 50-80% | hull-stressed | Amber warning |
| Hull 25-50% | hull-critical | Red, cracks |
| Hull < 25% | hull-failing | Flashing, smoke |

## Installation

1. Extract this patch into your `SPACE-CAPITAL/` project root
2. Ensure `js/ships/ship-behavior.js` exists (copy from patch if not)
3. Ensure `css/ship-states.css` exists (should already be there)
4. Test by loading space-capital.html and clicking a ship card

## Badge Reference

The behavior badges show at-a-glance status:

| Badge | Values | Meaning |
|-------|--------|---------|
| Thrust | THRUST++ / THRUST+ / DRIFT / FAIL | P&L-driven engine state |
| Stability | STABLE / ELEV / HIGH / EXTREME | Volatility level |
| Hull | HULL OK / STRESS / CRIT / HULL! | Damage state |

Badges change color based on severity (green → yellow → orange → red).
