# Space Capital - Combined Feature Patch
## Ship Behavior Integration + Position Manager

This patch combines two features:
1. **Ship Behavior System** - Ships visually react to P&L, volatility, and hull status
2. **Position Manager** - Import IBKR Trade Confirms CSV and manually edit P&L data

---

## Quick Start

1. Extract this patch to your `SPACE-CAPITAL/` project root
2. Load the app - ships now have behavior states and status badges
3. Click **📊 POSITIONS** button to import your trading P&L data
4. Ships will update in real-time based on your imported positions!

---

## Position Manager

### Importing IBKR CSV
1. In Interactive Brokers, run an Activity Statement report
2. Export as CSV (Trade Confirms format, ~300KB vs 2.5MB for full HTML)
3. Click **📊 POSITIONS** → **IMPORT** tab
4. Drop the CSV file
5. Ships immediately reflect your P&L!

### What Gets Imported

| Data | Source |
|------|--------|
| Stock P&L | Trades SubTotal rows for stocks |
| Options P&L | Trades SubTotal rows for options (aggregated by underlying) |
| Open Positions | Open Positions section (current holdings) |
| Commissions | Included in P&L calculation |

### CSV Format

The parser reads these sections:

**Open Positions** - Current holdings:
```csv
Open Positions,Data,Summary,Equity and Index Options,USD,ACHR 22AUG25 10 C,5,100,0.07,35,
```

**Trades SubTotal** - Realized P&L (rows without "(Bought)"/"(Sold)"):
```csv
Trades,SubTotal,,Stocks,USD,ACHR,,-63,,7252.528,-16.22,
Trades,SubTotal,,Equity and Index Options,USD,RKLB 17JAN27 10 C,,0,,4591.81,-5.23,
```

---

## Ship Behavior System

Ships now have CSS-driven visual states based on P&L:

| P&L | Badge | Visual Effect |
|-----|-------|---------------|
| ≥ +5% | THRUST++ | Strong forward motion, bright glow |
| 0 to +5% | THRUST+ | Gentle forward motion |
| -5% to 0% | DRIFT | Backward drift |
| ≤ -5% | FAIL | Heavy drift, dim engines, damage effects |

### Behavior Badges

Each ship card shows three status badges:
- **THRUST** - P&L-driven engine state
- **STABILITY** - Volatility level
- **HULL** - Damage state (negative P&L = damage)

---

## Files Included

| File | Purpose |
|------|---------|
| `html/space-capital.html` | Main app with all integrations |
| `html/ship-select.html` | Ship select with behavior states |
| `html/ship-behavior-demo.html` | Behavior demo with postMessage receiver |
| `css/ship-states.css` | Behavior CSS animations |
| `js/ships/ship-behavior.js` | Behavior state machine engine |
| `js/data/position-manager.js` | P&L data management + CSV parser |
| `js/ui/position-manager-ui.js` | Position manager modal UI |
| `js/ui/ship-select.js` | Ship select with behavior init |

---

## Data Flow

```
IBKR CSV → PositionManager.importFromCSV()
              ↓
        localStorage (persists)
              ↓
        PositionManager.getBehaviorStats(ticker)
              ↓
        ShipBehavior.updateStats({ pnlPercent, hull, ... })
              ↓
        CSS classes applied (thrust-strong, hull-critical, etc.)
              ↓
        Visual animations!
```

---

## Manual Entry

Don't have IBKR? You can manually enter positions:

1. Click **📊 POSITIONS** → **ADD/EDIT** tab
2. Enter ticker + P&L values
3. Click **SAVE POSITION**

---

## Features

- ✅ Import IBKR Trade Confirms CSV
- ✅ Manual position entry/editing
- ✅ localStorage persistence (survives refresh)
- ✅ Export/import JSON backups
- ✅ Real-time ship behavior updates
- ✅ Open position tracking with indicators
- ✅ Click ship → open Behavior Demo with that ship's stats

---

## Installation

This patch **replaces** these files:
- `html/space-capital.html`
- `html/ship-select.html`
- `html/ship-behavior-demo.html`
- `js/ui/ship-select.js`

And **adds** these new files:
- `css/ship-states.css` (if not present)
- `js/ships/ship-behavior.js`
- `js/data/position-manager.js`
- `js/ui/position-manager-ui.js`

Extract to your project root and overwrite when prompted.
