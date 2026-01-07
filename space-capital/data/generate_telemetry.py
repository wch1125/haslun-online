#!/usr/bin/env python3
"""
generate_telemetry.py

Converts raw TradingView CSV exports into lightweight telemetry JSON
for the Space Capital UI.

Place this file in: space-capital/data/generate_telemetry.py
Run from anywhere:  python path/to/generate_telemetry.py

Input:  indicators/45m/*.csv (relative to this script)
Output: telemetry/fleet.json (relative to this script)
"""

import pandas as pd
import numpy as np
import json
from pathlib import Path
from datetime import datetime

# Get the directory where this script lives
SCRIPT_DIR = Path(__file__).parent.resolve()

# Paths relative to script location (works from any working directory)
INPUT_DIR = SCRIPT_DIR / "indicators" / "45m"
OUTPUT_DIR = SCRIPT_DIR / "telemetry"


def clamp(value, min_val, max_val):
    """Clamp a value between min and max."""
    if pd.isna(value):
        return (min_val + max_val) / 2
    return max(min_val, min(max_val, float(value)))


def normalize(value, series, center=0):
    """Normalize a value to -1..+1 based on historical range."""
    series = series.dropna()
    if len(series) == 0 or series.std() == 0:
        return 0
    z = (value - series.mean()) / series.std()
    return clamp(z / 3, -1, 1)


def compute_trend(df, lookback=20):
    """
    Compute trend score from -1 (bearish) to +1 (bullish).
    Uses price vs moving averages and slope.
    """
    if len(df) < lookback:
        return 0
    
    latest = df.iloc[-1]
    
    # Try to get close price from various column names
    close_col = None
    for col in ['close', 'Close', 'CLOSE']:
        if col in df.columns:
            close_col = col
            break
    
    if close_col is None:
        return 0
        
    close = latest[close_col]
    
    # Price vs key MAs (G100, G150, G200 if available)
    ma_scores = []
    for col in ['G100', 'G150', 'G200', 'g100', 'g150', 'g200']:
        if col in df.columns and pd.notna(latest.get(col)):
            ma_val = latest[col]
            if ma_val > 0:
                score = (close - ma_val) / ma_val
                ma_scores.append(clamp(score * 5, -1, 1))
    
    # Slope of recent closes
    recent = df[close_col].tail(lookback)
    if len(recent) >= 2 and recent.iloc[0] != 0:
        slope = (recent.iloc[-1] - recent.iloc[0]) / recent.iloc[0]
        slope_score = clamp(slope * 10, -1, 1)
    else:
        slope_score = 0
    
    # Combine scores
    if ma_scores:
        return (sum(ma_scores) / len(ma_scores) * 0.6) + (slope_score * 0.4)
    return slope_score


def compute_momentum(df):
    """
    Compute momentum score from -1 to +1.
    Uses MACD histogram normalized to recent range.
    """
    hist_col = None
    for col in ['Histogram', 'histogram', 'HISTOGRAM', 'hist']:
        if col in df.columns:
            hist_col = col
            break
    
    if hist_col is None:
        return 0
    
    hist = df[hist_col].dropna()
    if len(hist) == 0:
        return 0
    
    latest = hist.iloc[-1]
    return normalize(latest, hist.tail(100))


def compute_volatility(df, lookback=20):
    """
    Compute volatility score from 0 to 1.
    Uses ATR as percentage of price.
    """
    if len(df) < lookback:
        return 0.5
    
    # Find column names
    high_col = close_col = low_col = None
    for col in ['high', 'High', 'HIGH']:
        if col in df.columns:
            high_col = col
            break
    for col in ['low', 'Low', 'LOW']:
        if col in df.columns:
            low_col = col
            break
    for col in ['close', 'Close', 'CLOSE']:
        if col in df.columns:
            close_col = col
            break
    
    if not all([high_col, low_col, close_col]):
        return 0.5
    
    # True Range
    high = df[high_col].tail(lookback)
    low = df[low_col].tail(lookback)
    close = df[close_col].tail(lookback)
    
    tr1 = high - low
    tr2 = abs(high - close.shift(1))
    tr3 = abs(low - close.shift(1))
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr = tr.mean()
    
    # Normalize: ATR as % of price, scaled
    atr_pct = atr / close.iloc[-1] if close.iloc[-1] > 0 else 0
    return clamp(atr_pct * 10, 0, 1)


def compute_activity(df):
    """
    Compute activity score from 0 to 1.
    Uses volume vs volume MA.
    """
    latest = df.iloc[-1]
    
    # Find volume columns
    vol = None
    vol_ma = None
    
    for col in ['Volume', 'volume', 'VOLUME', 'vol']:
        if col in df.columns:
            vol = latest.get(col, 0)
            break
    
    for col in ['Volume MA', 'volume_ma', 'Vol MA', 'volMA']:
        if col in df.columns:
            vol_ma = latest.get(col)
            break
    
    if vol is None:
        return 0.5
    if vol_ma is None or vol_ma <= 0:
        vol_ma = vol
    
    ratio = vol / vol_ma if vol_ma > 0 else 1
    return clamp(ratio / 2, 0, 1)


def determine_signal_state(trend, momentum):
    """Determine bull/bear/neutral signal state."""
    if trend > 0.2 and momentum > 0:
        return "bull"
    elif trend < -0.2 and momentum < 0:
        return "bear"
    return "neutral"


def compute_visual_params(trend, momentum, volatility, activity):
    """Compute visual parameters for ship rendering."""
    return {
        "glow": clamp(abs(momentum) * 0.5 + activity * 0.5, 0.2, 1.0),
        "jitter": volatility * 0.3,
        "thrust": clamp(max(0, momentum) * activity, 0, 1),
        "damage": clamp(max(0, -trend) * volatility, 0, 1)
    }


def get_latest_price(df):
    """Get the latest closing price."""
    for col in ['close', 'Close', 'CLOSE']:
        if col in df.columns:
            return df[col].iloc[-1]
    return 0


def get_price_change(df):
    """Get percentage change from previous bar."""
    for col in ['close', 'Close', 'CLOSE']:
        if col in df.columns:
            if len(df) > 1:
                prev = df[col].iloc[-2]
                curr = df[col].iloc[-1]
                if prev > 0:
                    return ((curr - prev) / prev) * 100
    return 0


def process_csv(csv_path):
    """Process a single CSV file and return telemetry dict."""
    ticker = csv_path.stem.split('_')[0].upper()
    
    try:
        df = pd.read_csv(csv_path)
    except Exception as e:
        print(f"  ⚠ Error reading {csv_path.name}: {e}")
        return None
    
    if len(df) == 0:
        print(f"  ⚠ Empty CSV: {csv_path.name}")
        return None
    
    df.columns = df.columns.str.strip()
    
    price = get_latest_price(df)
    chg_pct = get_price_change(df)
    trend = compute_trend(df)
    momentum = compute_momentum(df)
    volatility = compute_volatility(df)
    activity = compute_activity(df)
    signal_state = determine_signal_state(trend, momentum)
    visual = compute_visual_params(trend, momentum, volatility, activity)
    
    return {
        "ticker": ticker,
        "price": round(price, 2),
        "chgPct": round(chg_pct, 2),
        "trend": round(trend, 3),
        "momentum": round(momentum, 3),
        "volatility": round(volatility, 3),
        "activity": round(activity, 3),
        "signalState": signal_state,
        "visual": {k: round(v, 3) for k, v in visual.items()}
    }


def main():
    print("=" * 60)
    print("Space Capital Telemetry Generator")
    print("=" * 60)
    print(f"\nScript location: {SCRIPT_DIR}")
    print(f"Input folder:    {INPUT_DIR}")
    print(f"Output folder:   {OUTPUT_DIR}")
    
    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    csv_files = list(INPUT_DIR.glob("*.csv"))
    print(f"\nFound {len(csv_files)} CSV files")
    
    if not csv_files:
        print(f"\n⚠ No CSV files found!")
        print(f"  Expected: {INPUT_DIR}")
        return
    
    ships = []
    for csv_path in sorted(csv_files):
        print(f"  Processing {csv_path.name}...")
        telemetry = process_csv(csv_path)
        if telemetry:
            ships.append(telemetry)
            icon = {"bull": "🟢", "bear": "🔴", "neutral": "🟡"}[telemetry["signalState"]]
            print(f"    {icon} {telemetry['ticker']}: ${telemetry['price']} | trend={telemetry['trend']:.2f} | mom={telemetry['momentum']:.2f}")
    
    output = {
        "asOf": datetime.now().isoformat(),
        "ships": ships
    }
    
    output_path = OUTPUT_DIR / "fleet.json"
    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"\n✓ Generated {output_path}")
    print(f"  {len(ships)} ships | {output_path.stat().st_size / 1024:.1f} KB")
    
    manifest = {
        "version": "1.0",
        "updatedAt": datetime.now().isoformat(),
        "timeframes": ["45m"],
        "symbols": [s["ticker"] for s in ships]
    }
    
    manifest_path = OUTPUT_DIR / "manifest.json"
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)
    
    print(f"✓ Generated {manifest_path}")
    print("\n" + "=" * 60)


if __name__ == "__main__":
    main()
