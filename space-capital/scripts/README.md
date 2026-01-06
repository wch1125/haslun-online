# Space Capital - Data Pipeline Scripts

## Overview

These scripts process raw market data (TradingView CSV exports) into JSON summaries that drive the game's telemetry enrichment system.

## Folder Structure

```
space-capital/
├── scripts/               <- You are here
│   ├── telemetry_updater.py   # Main CSV → JSON processor
│   ├── telemetry_ui.py        # Simple UI wrapper (optional)
│   ├── summarize-market-data.py  # Legacy/alternative summarizer
│   └── requirements.txt       # Python dependencies
├── assets/
│   └── tickers/
│       └── csv/           # Drop TradingView exports here
├── data/
│   ├── market_summaries/  # Generated JSON per ticker
│   ├── options_summaries/ # Options data
│   └── tickers.json       # Canonical fleet registry
```

## Quick Start

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Export CSVs from TradingView
- Use 45-minute timeframe
- Include indicators: Kernel Regression, Volume, MACD
- Save to `assets/tickers/csv/` folder
- Filename should include ticker (e.g., `BATS_RKLB, 45_xyz.csv`)

### 3. Run the updater
```bash
# From scripts/ folder:
python telemetry_updater.py --csv-dir ../assets/tickers/csv --repo ..

# With auto-commit:
python telemetry_updater.py --csv-dir ../assets/tickers/csv --repo .. --commit
```

## Output Format

Each ticker gets a JSON file in `data/market_summaries/`:

```json
{
  "ticker": "RKLB",
  "bars": 2384,
  "timeRange": {"start": 1704067200, "end": 1736121600},
  
  "kernelRespectPct": 0.50,      // How well price respects kernel estimate
  "bandCompression": 0.76,       // MA band tightness (consolidation)
  "signalFollowThrough": 0.50,   // Buy/Sell signal success rate
  "stopHuntFrequency": 0.0,      // Stop-loss trigger frequency
  "volumeReliability": 0.37,     // Volume stability
  "macdPersistence": 1.0,        // Trend coherence
  
  "volatility": 0.02,
  "avg_return": 0.001,
  "max_drawdown": -0.15,
  
  "generatedAtUtc": "2026-01-06T20:00:00Z"
}
```

## How Metrics Drive Ship Behavior

| Metric | Ship Behavior |
|--------|---------------|
| `kernelRespectPct` | Flight path smoothness |
| `bandCompression` | Shield strength during consolidation |
| `signalFollowThrough` | Weapon accuracy |
| `stopHuntFrequency` | Damage taken frequency |
| `volumeReliability` | Engine stability |
| `macdPersistence` | Thrust consistency |
| `volatility` | Overall ship "nervousness" |

See `js/data/telemetry-enrichment.js` for the full mapping logic.
