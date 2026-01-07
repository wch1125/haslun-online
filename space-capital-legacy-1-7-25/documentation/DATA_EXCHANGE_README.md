# Space Capital: Data Exchange Protocol

## The Problem
Raw TradingView CSVs are ~1.8MB each × 15+ tickers = 30-50MB per timeframe. Claude doesn't need this data to build the UI—it needs the **derived telemetry**.

## The Solution: Three-Layer Architecture

```
space-capital/
├── data/
│   ├── raw/                    # ❌ NEVER SEND TO CLAUDE
│   │   └── indicators/
│   │       ├── 45m/            # ~30MB of CSVs
│   │       └── 1D/
│   │
│   ├── telemetry/              # ✅ ALWAYS SEND - tiny, UI-ready
│   │   ├── fleet.json          # all ships' current state (~10KB)
│   │   ├── manifest.json       # symbol list, timestamps (~1KB)
│   │   └── benchmarks.json     # SPY, XAR, etc. (~2KB)
│   │
│   └── options_summaries/      # ✅ SEND - position data (~5KB)
│       └── positions.json
│
├── html/                       # ✅ ALWAYS SEND
│   ├── space-capital.html
│   └── [other UI files]
│
├── assets/                     # ✅ SEND if sprites/images needed
│   └── sprites/
│
└── scripts/                    # ❌ KEEP LOCAL - Python processing
    └── generate_telemetry.py   # converts raw → telemetry
```

## What to Send Claude

### Always Include (~500KB max):
```
space-capital-exchange.zip
├── html/                       # UI files we're working on
├── data/
│   ├── telemetry/              # pre-computed ship states
│   └── options_summaries/      # position data
├── assets/sprites/             # if discussing visuals
└── DATA_EXCHANGE_README.md     # this file
```

### Never Include:
- `data/raw/` or `data/indicators/` (raw CSVs)
- `data/timeseries/` (historical bars)
- `node_modules/`, `.git/`, `__pycache__/`
- Any file > 500KB

## Telemetry Schema (What Claude Needs)

### fleet.json - Ship States
```json
{
  "asOf": "2026-01-07T12:00:00Z",
  "ships": [
    {
      "ticker": "RKLB",
      "price": 75.99,
      "chgPct": 2.34,
      
      "trend": 0.72,        // -1 to +1 (bearish to bullish)
      "momentum": 0.45,     // -1 to +1 (MACD-derived)
      "volatility": 0.63,   // 0 to 1 (ATR-based)
      "activity": 0.81,     // 0 to 1 (volume vs MA)
      "signalState": "bull", // bull | bear | neutral
      
      "visual": {
        "glow": 0.72,       // engine intensity
        "jitter": 0.15,     // shake amplitude
        "thrust": 0.45,     // trail length
        "damage": 0.0       // corruption level (drawdown)
      },
      
      "position": {
        "structure": "Naked LEAP",
        "strikes": [75, null],
        "expiry": "2027-01-15",
        "delta": 0.68,
        "pnl": 234.50,
        "pnlPct": 9.7
      }
    }
  ]
}
```

### manifest.json - Fleet Registry
```json
{
  "version": "1.0",
  "updatedAt": "2026-01-07T12:00:00Z",
  "timeframes": ["45m", "1D"],
  "symbols": ["ACHR", "ASTS", "BKSY", "EVEX", "GME", "JOBY", "LUNR", "PL", "RKLB", "RDW"],
  "benchmarks": ["SPY", "XAR", "PPA", "ITA", "UFO"]
}
```

### benchmarks.json - Market Regime
```json
{
  "asOf": "2026-01-07T12:00:00Z",
  "benchmarks": {
    "SPY": { "price": 478.23, "chgPct": 0.45, "trend": 0.6, "regime": "bull" },
    "XAR": { "price": 156.78, "chgPct": 1.23, "trend": 0.7, "regime": "bull" }
  },
  "marketState": "open",
  "regime": "risk-on"
}
```

## Workflow

### You (Local Processing):
1. Run TradingView exports → save to `data/raw/indicators/`
2. Run `python scripts/generate_telemetry.py` → creates `data/telemetry/`
3. Zip only the exchange folder (see above)
4. Send to Claude

### Claude (UI Development):
1. Receives lightweight telemetry + HTML
2. Builds/modifies UI to consume telemetry schema
3. Returns updated HTML files
4. You merge into your local project

### You (Integration):
1. Replace HTML files in your local `html/` folder
2. Test with live telemetry data
3. Report issues, request changes

## Generating Telemetry (Python Script Outline)

```python
# scripts/generate_telemetry.py
import pandas as pd
import json
from pathlib import Path

def compute_telemetry(csv_path: Path) -> dict:
    df = pd.read_csv(csv_path)
    latest = df.iloc[-1]
    
    # Trend: price vs moving averages
    trend = compute_trend(latest, df)
    
    # Momentum: MACD histogram normalized
    momentum = normalize(latest['Histogram'], df['Histogram'])
    
    # Volatility: ATR as % of price
    volatility = compute_atr_pct(df)
    
    # Activity: volume vs volume MA
    activity = latest['Volume'] / latest['Volume MA'] if latest['Volume MA'] > 0 else 0.5
    activity = min(1.0, activity / 2)  # normalize to 0-1
    
    return {
        "trend": clamp(trend, -1, 1),
        "momentum": clamp(momentum, -1, 1),
        "volatility": clamp(volatility, 0, 1),
        "activity": clamp(activity, 0, 1),
        "signalState": "bull" if trend > 0.2 and momentum > 0 else "bear" if trend < -0.2 else "neutral",
        "visual": {
            "glow": abs(momentum) * 0.5 + activity * 0.5,
            "jitter": volatility * 0.3,
            "thrust": max(0, momentum) * activity,
            "damage": max(0, -trend) * volatility
        }
    }

# Run for all tickers, output to data/telemetry/fleet.json
```

## Quick Reference

| Data Type | Size | Send to Claude? | Purpose |
|-----------|------|-----------------|---------|
| Raw CSVs | 1-2MB each | ❌ Never | Source of truth |
| Telemetry JSON | 5-20KB | ✅ Always | UI state |
| Options JSON | 2-5KB | ✅ Always | Position data |
| HTML/CSS/JS | 10-150KB | ✅ Always | UI code |
| Sprites/Assets | varies | ✅ If relevant | Visuals |
| Historical bars | 500KB+ | ❌ Never | Charts/backtesting |

## Notes

- **Telemetry is ephemeral**: regenerate it whenever raw data updates
- **Claude builds to schema**: as long as telemetry matches the schema, UI will work
- **Version your schema**: if telemetry format changes, note it in manifest
- **Test locally first**: ensure telemetry generates correctly before sending
