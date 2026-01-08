# Position Integration - Fleet Page Enhancement

**Date:** 2026-01-08  
**Based on:** ChatGPT recommendations for position-aware fleet display

---

## Summary

Positions are now visible throughout the Fleet page, transforming ship cards from a gallery into "your actual fleet." Ships with positions "wake up" with stronger visual presence, while ships without positions become "ghosts."

---

## New Components

### 1. PositionsStore (`js/data/positions-store.js`)

Global accessor that reads from PositionManager and provides derived metrics:

```javascript
// Core getters
PositionsStore.get('RKLB')           // Position data for ticker
PositionsStore.hasPosition('RKLB')   // Boolean check
PositionsStore.getAll()              // All positions
PositionsStore.getFleetStats()       // Fleet-wide aggregates

// UI helpers
PositionsStore.getPositionChip('RKLB')   // Chip data for card display
PositionsStore.getVisualWeight('RKLB')   // 0-1 scale for UI presence
PositionsStore.getRiskMetrics('RKLB')    // Concentration + option ratio
PositionsStore.getConcentration(3)       // Top N tickers by exposure
```

### 2. Fleet Power HUD

Header strip showing fleet-wide metrics:
- **EXPOSURE** - Total position value
- **OPTIONS** - Options ratio (% of portfolio in derivatives)
- **TOP 3** - Concentration breakdown
- **P&L** - Total profit/loss

### 3. Position Chips

Top-right indicator on owned ship cards:
- `POS` label
- Dollar value (compact format: $11.6k)
- Delta badge if options present (Δ3)
- Micro bar showing stock vs options split

### 4. Visual Ownership States

**Important:** Ghost/owned states only apply when the user has imported positions. Before importing any positions, all ships display normally.

**Owned ships (`.ship-card.owned`):**
- Stronger border glow
- Enhanced sprite drop-shadow
- Full MACD backdrop opacity
- Confident engine glow
- High-value positions get extra pulse animation

**Ghost ships (`.ship-card.ghost`):**
- Dimmed (60% opacity)
- Grayscale sprite with reduced glow
- Faded MACD chart
- Scanline noise overlay
- Muted ticker color

### 5. Position Meters

Bottom strip on owned cards:
- **EXPOSURE** - Position size relative to portfolio
- **RISK** - Combined concentration + options ratio

### 6. Fleet Comms

Diegetic risk alerts (not popups):
- Concentration warnings (>30% in single position)
- Options-heavy alerts (>50% derivatives)
- High exposure notifications

---

## Data Flow

```
PositionManager (localStorage)
       ↓
PositionsStore (cached + derived metrics)
       ↓
┌──────┴──────┐
│             │
Fleet Page    Hangar Page (future)
├─ Power HUD  ├─ Ship dossier
├─ Chips      └─ Visual scars
├─ Meters
└─ Comms
```

---

## CSS Classes

```css
/* Ship card ownership states */
.ship-card.owned        /* Has position - stronger presence */
.ship-card.ghost        /* No position - dimmed, noisy */
.ship-card.owned.high-value  /* >$10k position - extra glow */

/* Position UI elements */
.position-chip          /* Top-right ownership indicator */
.position-meters        /* Bottom exposure/risk bars */
.fleet-power-hud        /* Header stats strip */
.fleet-comms            /* Risk alert panel */
```

---

## Files Modified

- `html/space-capital.html` - Fleet Power HUD HTML, renderShipCard updates
- `css/fleet-command.css` - Position chip, HUD, ownership state styles
- `js/data/positions-store.js` - **NEW** - Global position accessor

---

## Integration Points

The PositionsStore automatically:
1. Refreshes when PositionManager changes
2. Updates Fleet Power HUD
3. Triggers fleet re-render for ownership state changes

Manual integration points:
- `PositionsStore.getVisualWeight(ticker)` for telemetry opacity
- `PositionsStore.getRiskMetrics(ticker)` for behavior modifiers
- `PositionsStore.getPositionChip(ticker)` for any UI needing position summary

---

## Future Enhancements (from ChatGPT spec)

1. **Sort/Filter toggles** - Owned/All, Options/NoOptions, Size S/M/L
2. **Hangar dossier** - Position summary in ship detail view
3. **Visual scars** - Options history → phase shimmer, drawdown → paint wear
4. **Telemetry weight** - Charts weighted by position size
5. **Entry point overlays** - Cost basis bands on price charts
6. **Expiry markers** - Vertical lines for option expiries
7. **Missions unlock** - Content locked to actual holdings

---

## Testing

1. **Without positions:** Open Fleet page - all ships display normally (no ghost/owned styling)
2. **Import positions:** Open Position Manager, import IBKR CSV or add manual positions
3. **Return to Fleet:** Ships with positions should "wake up" with stronger glow
4. **Ghost ships:** Ships NOT in your positions should appear dimmed with scanlines
5. **Fleet Power HUD:** Should show totals (exposure, options ratio, concentration, P&L)
6. **Comms alerts:** Concentration >30% should trigger warning
7. **Position chips:** Owned ships show POS badge with $ value and options count
8. **High-value glow:** Positions >$10k get extra pulse animation
