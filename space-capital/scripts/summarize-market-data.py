#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════════════════════
MARKET DATA SUMMARIZER
═══════════════════════════════════════════════════════════════════════════════

Extracts semantic summaries from 45-minute CSV indicator data.
Output: Small per-ticker JSON files for use in telemetry enrichment.

This is an OFFLINE script - run once to generate static JSON summaries.
The browser never sees CSV data directly.

Usage:
  python3 summarize-market-data.py path/to/45-min-charts/

Output:
  data/market_summaries/RKLB.json
  data/market_summaries/LUNR.json
  ...
"""

import os
import sys
import json
import csv
from pathlib import Path
from statistics import mean, stdev
from datetime import datetime

def parse_csv(filepath):
    """Parse a 45-min CSV file and return rows as dicts."""
    rows = []
    with open(filepath, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Convert numeric fields
            parsed = {}
            for k, v in row.items():
                try:
                    parsed[k] = float(v) if v and v != '' else None
                except (ValueError, TypeError):
                    parsed[k] = v
            rows.append(parsed)
    return rows

def compute_kernel_respect(rows):
    """
    How often does price respect the Kernel Regression Estimate?
    Returns 0-1 value (1 = very respectful of trend)
    """
    if not rows or len(rows) < 10:
        return 0.5
    
    respect_count = 0
    total = 0
    
    for row in rows:
        kernel = row.get('Kernel Regression Estimate')
        close = row.get('close')
        
        if kernel is None or close is None:
            continue
        
        total += 1
        # Price within 2% of kernel = respecting
        if abs(close - kernel) / kernel < 0.02:
            respect_count += 1
    
    return respect_count / total if total > 0 else 0.5

def compute_band_compression(rows):
    """
    Measure band compression (tight bands = compressed, wide = expanded)
    Uses the A/B/C/D/E band columns
    Returns 0-1 (1 = very compressed bands)
    """
    if not rows or len(rows) < 10:
        return 0.5
    
    compressions = []
    
    for row in rows:
        # Get band extremes (A5 is typically outer, A1 inner, etc.)
        a5 = row.get('A5')
        e5 = row.get('E5')
        close = row.get('close')
        
        if a5 is None or e5 is None or close is None or close == 0:
            continue
        
        # Band width as percentage of price
        band_width = abs(a5 - e5) / close
        compressions.append(band_width)
    
    if not compressions:
        return 0.5
    
    avg_compression = mean(compressions)
    # Invert and normalize: smaller width = higher compression score
    # Typical range is 0.05 to 0.30
    score = 1 - min(1, avg_compression / 0.25)
    return round(score, 3)

def compute_signal_follow_through(rows):
    """
    When Buy/Sell signals fire, does price follow through?
    Returns 0-1 (1 = signals are reliable)
    """
    if not rows or len(rows) < 20:
        return 0.5
    
    successes = 0
    signals = 0
    
    for i, row in enumerate(rows[:-5]):  # Leave room for follow-through check
        buy = row.get('Buy')
        sell = row.get('Sell')
        close_at_signal = row.get('close')
        
        if close_at_signal is None:
            continue
        
        # Check 5 bars ahead
        future_closes = [r.get('close') for r in rows[i+1:i+6] if r.get('close') is not None]
        if not future_closes:
            continue
        
        future_max = max(future_closes)
        future_min = min(future_closes)
        
        if buy and buy == 1:
            signals += 1
            # Buy signal success = price went up
            if future_max > close_at_signal * 1.005:
                successes += 1
        
        if sell and sell == 1:
            signals += 1
            # Sell signal success = price went down
            if future_min < close_at_signal * 0.995:
                successes += 1
    
    return round(successes / signals, 3) if signals > 0 else 0.5

def compute_stop_hunt_frequency(rows):
    """
    How often do StopBuy/StopSell signals fire?
    High frequency = choppy, low = trending
    Returns 0-1 (1 = very choppy, lots of stops)
    """
    if not rows or len(rows) < 10:
        return 0.3
    
    stop_count = 0
    
    for row in rows:
        stop_buy = row.get('StopBuy')
        stop_sell = row.get('StopSell')
        
        if stop_buy and stop_buy == 1:
            stop_count += 1
        if stop_sell and stop_sell == 1:
            stop_count += 1
    
    # Normalize: more than 20% of bars having stops = very choppy
    frequency = stop_count / len(rows)
    return round(min(1, frequency / 0.2), 3)

def compute_volume_reliability(rows):
    """
    Is volume consistent and meaningful?
    Returns 0-1 (1 = reliable volume patterns)
    """
    if not rows or len(rows) < 10:
        return 0.5
    
    volumes = [r.get('Volume') for r in rows if r.get('Volume') is not None and r.get('Volume') > 0]
    
    if len(volumes) < 10:
        return 0.5
    
    avg_vol = mean(volumes)
    vol_std = stdev(volumes) if len(volumes) > 1 else 0
    
    # Coefficient of variation (lower = more consistent)
    cv = vol_std / avg_vol if avg_vol > 0 else 1
    
    # Map CV to reliability: CV of 0.5 is "normal", lower is more reliable
    reliability = 1 - min(1, cv / 1.5)
    return round(reliability, 3)

def compute_macd_persistence(rows):
    """
    How long do MACD trends persist before reversing?
    Returns 0-1 (1 = long persistent trends)
    """
    if not rows or len(rows) < 20:
        return 0.5
    
    # Track streak lengths
    streaks = []
    current_streak = 0
    current_sign = None
    
    for row in rows:
        hist = row.get('Histogram')
        if hist is None:
            continue
        
        sign = 1 if hist > 0 else -1
        
        if current_sign is None:
            current_sign = sign
            current_streak = 1
        elif sign == current_sign:
            current_streak += 1
        else:
            streaks.append(current_streak)
            current_sign = sign
            current_streak = 1
    
    if current_streak > 0:
        streaks.append(current_streak)
    
    if not streaks:
        return 0.5
    
    avg_streak = mean(streaks)
    # Normalize: streak of 10+ bars = very persistent
    return round(min(1, avg_streak / 10), 3)

def compute_volatility_factor(rows):
    """
    Raw price volatility measure
    Returns 0-1 (1 = very volatile)
    """
    if not rows or len(rows) < 10:
        return 0.5
    
    returns = []
    prev_close = None
    
    for row in rows:
        close = row.get('close')
        if close is None or close == 0:
            continue
        
        if prev_close is not None:
            ret = (close - prev_close) / prev_close
            returns.append(abs(ret))
        
        prev_close = close
    
    if len(returns) < 5:
        return 0.5
    
    avg_return = mean(returns)
    # Normalize: 1% average move per bar = moderate volatility
    return round(min(1, avg_return / 0.015), 3)

def summarize_ticker(csv_path):
    """Generate summary JSON for a single ticker."""
    rows = parse_csv(csv_path)
    
    if not rows:
        return None
    
    # Extract ticker from filename (e.g., "BATS_RKLB, 45_ccede.csv" -> "RKLB")
    filename = os.path.basename(csv_path)
    parts = filename.split('_')
    ticker = parts[1].split(',')[0] if len(parts) > 1 else 'UNKNOWN'
    
    summary = {
        'ticker': ticker,
        'dataPoints': len(rows),
        'lastUpdated': datetime.now().isoformat(),
        
        # Core metrics
        'kernelRespectPct': compute_kernel_respect(rows),
        'bandCompression': compute_band_compression(rows),
        'signalFollowThrough': compute_signal_follow_through(rows),
        'stopHuntFrequency': compute_stop_hunt_frequency(rows),
        'volumeReliability': compute_volume_reliability(rows),
        'macdPersistence': compute_macd_persistence(rows),
        'volatilityFactor': compute_volatility_factor(rows),
        
        # Derived personality traits
        'trendAdherence': 0,  # Will compute
        'chopSensitivity': 0,  # Will compute
    }
    
    # Compute derived traits
    summary['trendAdherence'] = round(
        (summary['kernelRespectPct'] * 0.4 + 
         summary['macdPersistence'] * 0.3 + 
         summary['signalFollowThrough'] * 0.3), 3
    )
    
    summary['chopSensitivity'] = round(
        (summary['stopHuntFrequency'] * 0.5 +
         (1 - summary['bandCompression']) * 0.3 +
         summary['volatilityFactor'] * 0.2), 3
    )
    
    return summary

def summarize_options(options_path):
    """Generate options summaries from options_data.json."""
    with open(options_path, 'r') as f:
        data = json.load(f)
    
    summaries = {}
    positions = data.get('positions', [])
    catalysts = data.get('catalysts', [])
    
    # Count catalysts per ticker
    catalyst_counts = {}
    for cat in catalysts:
        ticker = cat.get('ticker')
        if ticker:
            catalyst_counts[ticker] = catalyst_counts.get(ticker, 0) + 1
    
    for pos in positions:
        ticker = pos.get('ticker')
        if not ticker:
            continue
        
        # Calculate days to expiry
        expiry_str = pos.get('expiry', '')
        try:
            expiry = datetime.strptime(expiry_str, '%Y-%m-%d')
            days_to_expiry = (expiry - datetime.now()).days
        except:
            days_to_expiry = 365
        
        # Determine leverage factor based on structure
        structure = pos.get('structure', '')
        if 'LEAP' in structure.upper():
            leverage = 1.5 + pos.get('delta', 0.5) * 2
        elif 'SPREAD' in structure.upper():
            leverage = 1.2
        else:
            leverage = 1.0
        
        summaries[ticker] = {
            'ticker': ticker,
            'structure': structure,
            'deltaExposure': pos.get('delta', 0.5),
            'timeHorizonDays': max(0, days_to_expiry),
            'leverageFactor': round(leverage, 2),
            'upcomingCatalysts': catalyst_counts.get(ticker, 0),
            'riskPosture': 'leveraged' if leverage > 1.3 else 'moderate',
            'catalystPressure': 'high' if catalyst_counts.get(ticker, 0) >= 2 else 'low'
        }
    
    return summaries

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 summarize-market-data.py path/to/45-min-charts/ [path/to/options_data.json]")
        sys.exit(1)
    
    csv_dir = Path(sys.argv[1])
    options_path = sys.argv[2] if len(sys.argv) > 2 else None
    
    # Create output directories
    market_out = Path('data/market_summaries')
    options_out = Path('data/options_summaries')
    market_out.mkdir(parents=True, exist_ok=True)
    options_out.mkdir(parents=True, exist_ok=True)
    
    # Process CSVs
    print(f"Processing CSVs in {csv_dir}...")
    csv_files = list(csv_dir.glob('*.csv'))
    
    for csv_file in csv_files:
        print(f"  {csv_file.name}...", end=' ')
        summary = summarize_ticker(csv_file)
        if summary:
            out_path = market_out / f"{summary['ticker']}.json"
            with open(out_path, 'w') as f:
                json.dump(summary, f, indent=2)
            print(f"✓ ({summary['dataPoints']} rows)")
        else:
            print("✗ (no data)")
    
    # Process options
    if options_path and os.path.exists(options_path):
        print(f"\nProcessing options from {options_path}...")
        options_summaries = summarize_options(options_path)
        
        for ticker, summary in options_summaries.items():
            out_path = options_out / f"{ticker}.json"
            with open(out_path, 'w') as f:
                json.dump(summary, f, indent=2)
            print(f"  {ticker}: {summary['structure']} → {out_path}")
    
    print("\n✓ Done! Summaries written to data/market_summaries/ and data/options_summaries/")

if __name__ == '__main__':
    main()
