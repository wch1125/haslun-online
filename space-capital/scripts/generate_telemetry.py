#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════════════════════
TELEMETRY GENERATOR
═══════════════════════════════════════════════════════════════════════════════

Converts raw chart data → canonical format → UI-ready telemetry

Pipeline: raw/ → canonical/ → telemetry/

The app never reads from raw/ directly - only canonical/ and telemetry/
"""

import json
import os
import math
from datetime import datetime
from pathlib import Path

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

BASE_DIR = Path(__file__).parent.parent / "data"
RAW_DIR = BASE_DIR / "raw" / "charts"
CANONICAL_DIR = BASE_DIR / "canonical"
TELEMETRY_DIR = BASE_DIR / "telemetry"

# Benchmark symbols (also process these for planet telemetry)
BENCHMARKS = ["XAR", "SPY", "QQQ"]

# Timeframe mapping from raw data keys to output folders
TIMEFRAME_MAP = {
    "daily": "1D",
    "intraday": "45m",
    "intraday15": "15m"
}

# ═══════════════════════════════════════════════════════════════════════════════
# UTILITY FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def safe_float(val, default=0.0):
    """Safely convert to float"""
    if val is None:
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default

def normalize(val, min_val, max_val, clamp=True):
    """Normalize value to 0-1 range"""
    if max_val == min_val:
        return 0.5
    norm = (val - min_val) / (max_val - min_val)
    if clamp:
        norm = max(0, min(1, norm))
    return norm

def z_score(val, mean, std):
    """Calculate z-score"""
    if std == 0:
        return 0
    return (val - mean) / std

def compute_returns(bars, lookback=20):
    """Compute returns over lookback period"""
    if len(bars) < lookback + 1:
        return []
    returns = []
    for i in range(lookback, len(bars)):
        prev_close = bars[i - lookback].get('c', 0)
        curr_close = bars[i].get('c', 0)
        if prev_close > 0:
            returns.append((curr_close - prev_close) / prev_close)
        else:
            returns.append(0)
    return returns

def compute_volatility(bars, lookback=20):
    """Compute realized volatility (standard deviation of returns)"""
    if len(bars) < lookback + 1:
        return 0.3  # Default moderate volatility
    
    returns = []
    for i in range(1, min(lookback + 1, len(bars))):
        prev_close = bars[-(i+1)].get('c', 0)
        curr_close = bars[-i].get('c', 0)
        if prev_close > 0:
            returns.append((curr_close - prev_close) / prev_close)
    
    if not returns:
        return 0.3
    
    mean_ret = sum(returns) / len(returns)
    variance = sum((r - mean_ret) ** 2 for r in returns) / len(returns)
    return math.sqrt(variance)

def compute_drawdown(bars, lookback=50):
    """Compute current drawdown from recent high"""
    if len(bars) < 2:
        return 0
    
    recent_bars = bars[-min(lookback, len(bars)):]
    high_price = max(b.get('h', b.get('c', 0)) for b in recent_bars)
    current_price = recent_bars[-1].get('c', 0)
    
    if high_price <= 0:
        return 0
    
    return (current_price - high_price) / high_price

def compute_trend(bar, bars, lookback=20):
    """
    Compute trend score (-1 to +1) based on:
    - Price vs moving averages (g100, g150, g200)
    - MACD histogram direction
    """
    score = 0
    weights = 0
    
    price = bar.get('c', 0)
    
    # Price vs G100/150/200
    g100 = bar.get('g100')
    g150 = bar.get('g150')
    g200 = bar.get('g200')
    
    if g100 and price > 0:
        score += 1 if price > g100 else -1
        weights += 1
    if g150 and price > 0:
        score += 1 if price > g150 else -1
        weights += 1
    if g200 and price > 0:
        score += 1 if price > g200 else -1
        weights += 1
    
    # MACD histogram
    hist = bar.get('hist', 0)
    if hist:
        score += 1 if hist > 0 else -1
        weights += 1
    
    # Price momentum (compare to lookback bars ago)
    if len(bars) > lookback:
        old_price = bars[-lookback].get('c', price)
        if old_price > 0:
            momentum = (price - old_price) / old_price
            score += normalize(momentum, -0.2, 0.2) * 2 - 1
            weights += 1
    
    return score / weights if weights > 0 else 0

def compute_momentum(bar):
    """
    Compute momentum score (-1 to +1) from MACD
    """
    hist = safe_float(bar.get('hist'), 0)
    macd = safe_float(bar.get('macd'), 0)
    
    # Normalize histogram (typical range -0.5 to +0.5)
    hist_norm = normalize(hist, -0.5, 0.5) * 2 - 1
    
    # Normalize MACD (typical range -2 to +2)
    macd_norm = normalize(macd, -2, 2) * 2 - 1
    
    return (hist_norm * 0.7 + macd_norm * 0.3)

def compute_activity(bar, bars, lookback=20):
    """
    Compute activity score (0 to 1) based on volume vs average
    """
    current_vol = safe_float(bar.get('v'), 0)
    
    if len(bars) < lookback:
        return 0.5
    
    volumes = [safe_float(b.get('v'), 0) for b in bars[-lookback:]]
    avg_vol = sum(volumes) / len(volumes) if volumes else 1
    std_vol = math.sqrt(sum((v - avg_vol) ** 2 for v in volumes) / len(volumes)) if volumes else 1
    
    if avg_vol == 0:
        return 0.5
    
    # Z-score of current volume
    vol_z = z_score(current_vol, avg_vol, std_vol)
    
    # Convert to 0-1 range (z-score typically -3 to +3)
    return normalize(vol_z, -2, 2)

def compute_signal_state(bar):
    """
    Determine signal state: 'bull', 'bear', or 'neutral'
    Based on MACD cross and histogram
    """
    hist = safe_float(bar.get('hist'), 0)
    cross = bar.get('cross')
    macd = safe_float(bar.get('macd'), 0)
    signal = safe_float(bar.get('signal'), 0)
    
    # Recent cross?
    if cross is not None:
        return 'bear' if hist < 0 else 'bull'
    
    # Strong histogram
    if abs(hist) > 0.1:
        return 'bull' if hist > 0 else 'bear'
    
    # MACD vs Signal
    if macd > signal + 0.05:
        return 'bull'
    elif macd < signal - 0.05:
        return 'bear'
    
    return 'neutral'

def compute_relative_performance(bars, benchmark_bars, lookback=20):
    """
    Compute relative performance vs benchmark
    Returns -1 to +1 (underperform to outperform)
    """
    if len(bars) < lookback or len(benchmark_bars) < lookback:
        return 0
    
    # Get returns over lookback
    ticker_start = bars[-lookback].get('c', 1)
    ticker_end = bars[-1].get('c', 1)
    ticker_ret = (ticker_end - ticker_start) / ticker_start if ticker_start > 0 else 0
    
    bench_start = benchmark_bars[-lookback].get('c', 1)
    bench_end = benchmark_bars[-1].get('c', 1)
    bench_ret = (bench_end - bench_start) / bench_start if bench_start > 0 else 0
    
    # Relative performance
    rel_perf = ticker_ret - bench_ret
    
    # Normalize to -1 to +1 (typical range -0.3 to +0.3)
    return normalize(rel_perf, -0.3, 0.3) * 2 - 1

# ═══════════════════════════════════════════════════════════════════════════════
# TELEMETRY GENERATION
# ═══════════════════════════════════════════════════════════════════════════════

def generate_telemetry(symbol, bars, timeframe, benchmark_bars=None):
    """
    Generate telemetry object for a symbol
    """
    if not bars:
        return None
    
    bar = bars[-1]  # Most recent bar
    
    price = safe_float(bar.get('c'), 0)
    prev_price = safe_float(bars[-2].get('c'), price) if len(bars) > 1 else price
    
    # Core metrics
    trend = compute_trend(bar, bars)
    momentum = compute_momentum(bar)
    volatility = compute_volatility(bars)
    activity = compute_activity(bar, bars)
    signal_state = compute_signal_state(bar)
    drawdown = compute_drawdown(bars)
    
    # Relative performance (vs benchmark if available)
    rel_perf = 0
    if benchmark_bars:
        rel_perf = compute_relative_performance(bars, benchmark_bars)
    
    # Risk metrics
    stress = min(1, abs(drawdown) * 3 + volatility * 0.5)
    
    # Visual mappings (for the orbital observatory)
    # These drive the visual properties of ships/planets
    glow = min(1, activity * 0.7 + abs(momentum) * 0.3)
    jitter = min(1, volatility * 1.5)
    thrust = min(1, abs(momentum) * 2)
    cohesion = max(0, 1 - volatility - abs(drawdown))
    ring = min(1, volatility * 0.8)
    
    # Day change
    chg_pct = ((price - prev_price) / prev_price * 100) if prev_price > 0 else 0
    
    telemetry = {
        "symbol": symbol,
        "tf": timeframe,
        "asOf": bar.get('t', 0),
        
        # Price data
        "price": round(price, 4),
        "chgPct": round(chg_pct, 4),
        
        # Core signals (-1 to +1 or 0 to 1)
        "trend": round(trend, 4),
        "momentum": round(momentum, 4),
        "volatility": round(volatility, 4),
        "activity": round(activity, 4),
        "signalState": signal_state,
        "relativePerformance": round(rel_perf, 4),
        
        # Risk metrics
        "risk": {
            "drawdown": round(drawdown, 4),
            "stress": round(stress, 4)
        },
        
        # Raw indicator values (for reference)
        "indicators": {
            "macd": round(safe_float(bar.get('macd')), 4),
            "signal": round(safe_float(bar.get('signal')), 4),
            "hist": round(safe_float(bar.get('hist')), 4),
            "g100": bar.get('g100'),
            "g150": bar.get('g150'),
            "g200": bar.get('g200')
        },
        
        # Visual mappings (for the orbital sim)
        "visual": {
            "glow": round(glow, 4),
            "jitter": round(jitter, 4),
            "thrust": round(thrust, 4),
            "cohesion": round(cohesion, 4),
            "ring": round(ring, 4)
        }
    }
    
    return telemetry

def generate_portfolio_telemetry(ticker_telemetries, benchmark_telemetry=None):
    """
    Generate portfolio-level telemetry (for the Sun)
    """
    if not ticker_telemetries:
        return None
    
    # Aggregate metrics
    total_health = 0
    total_momentum = 0
    total_volatility = 0
    total_stress = 0
    count = 0
    
    for t in ticker_telemetries:
        if t is None:
            continue
        
        # Health = inverse of stress + positive momentum bonus
        health = max(0, 1 - t['risk']['stress']) * 0.7 + max(0, t['momentum']) * 0.3
        total_health += health
        total_momentum += t['momentum']
        total_volatility += t['volatility']
        total_stress += t['risk']['stress']
        count += 1
    
    if count == 0:
        return None
    
    avg_health = total_health / count
    avg_momentum = total_momentum / count
    avg_volatility = total_volatility / count
    avg_stress = total_stress / count
    
    # Sentiment (bullish/bearish) based on momentum
    sentiment = normalize(avg_momentum, -0.5, 0.5)
    
    portfolio = {
        "type": "portfolio",
        "asOf": ticker_telemetries[0]['asOf'] if ticker_telemetries else 0,
        
        "healthScore": round(avg_health, 4),
        "volatility": round(avg_volatility, 4),
        "drawdown": round(avg_stress * -0.3, 4),  # Approximate
        "sentiment": round(sentiment, 4),
        "dayChange": round(avg_momentum * 0.1, 4),  # Approximate
        
        "summary": {
            "avgMomentum": round(avg_momentum, 4),
            "avgVolatility": round(avg_volatility, 4),
            "avgStress": round(avg_stress, 4),
            "tickerCount": count
        }
    }
    
    return portfolio

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN PROCESSING
# ═══════════════════════════════════════════════════════════════════════════════

def process_all():
    """Process all raw data files and generate telemetry"""
    
    print("═" * 60)
    print("TELEMETRY GENERATOR")
    print("═" * 60)
    
    # Ensure output directories exist
    for tf in TIMEFRAME_MAP.values():
        (CANONICAL_DIR / tf).mkdir(parents=True, exist_ok=True)
        (TELEMETRY_DIR / tf).mkdir(parents=True, exist_ok=True)
    
    # Load benchmark data first (for relative performance)
    benchmark_data = {}
    for bench in BENCHMARKS:
        raw_path = RAW_DIR / f"{bench.lower()}.json"
        if raw_path.exists():
            with open(raw_path) as f:
                benchmark_data[bench] = json.load(f)
            print(f"✓ Loaded benchmark: {bench}")
    
    # Process each ticker file
    symbols = []
    all_telemetry = {"1D": {}, "45m": {}, "15m": {}}
    
    for raw_file in sorted(RAW_DIR.glob("*.json")):
        if raw_file.name in ["index.json", "stats.json"]:
            continue
        
        symbol = raw_file.stem.upper()
        symbols.append(symbol)
        
        print(f"\nProcessing {symbol}...")
        
        with open(raw_file) as f:
            data = json.load(f)
        
        # Get benchmark bars for relative performance
        bench_symbol = "XAR" if symbol not in ["GE", "GME", "RTX", "LHX", "COHR", "EVEX"] else "SPY"
        bench_data = benchmark_data.get(bench_symbol, {})
        
        # Process each timeframe
        for raw_key, tf in TIMEFRAME_MAP.items():
            bars = data.get(raw_key, [])
            if not bars:
                continue
            
            bench_bars = bench_data.get(raw_key, [])
            
            # Generate canonical format (already good, just save separately)
            canonical_path = CANONICAL_DIR / tf / f"{symbol}.json"
            canonical = {
                "symbol": symbol,
                "tf": tf,
                "bars": bars
            }
            with open(canonical_path, 'w') as f:
                json.dump(canonical, f)
            
            # Generate telemetry
            telemetry = generate_telemetry(symbol, bars, tf, bench_bars)
            if telemetry:
                telemetry_path = TELEMETRY_DIR / tf / f"{symbol}.telemetry.json"
                with open(telemetry_path, 'w') as f:
                    json.dump(telemetry, f, indent=2)
                
                all_telemetry[tf][symbol] = telemetry
                
                print(f"  {tf}: price=${telemetry['price']:.2f}, momentum={telemetry['momentum']:+.2f}, trend={telemetry['trend']:+.2f}")
    
    # Generate portfolio telemetry
    print("\nGenerating portfolio telemetry...")
    for tf in TIMEFRAME_MAP.values():
        tickers = [t for s, t in all_telemetry[tf].items() if s not in BENCHMARKS]
        portfolio = generate_portfolio_telemetry(tickers)
        if portfolio:
            portfolio_path = TELEMETRY_DIR / tf / "portfolio.telemetry.json"
            with open(portfolio_path, 'w') as f:
                json.dump(portfolio, f, indent=2)
            print(f"  {tf}: health={portfolio['healthScore']:.0%}, sentiment={portfolio['sentiment']:.2f}")
    
    # Generate manifest
    manifest = {
        "timeframes": list(TIMEFRAME_MAP.values()),
        "benchmarks": BENCHMARKS,
        "symbols": [s for s in symbols if s not in BENCHMARKS],
        "updatedAt": int(datetime.now().timestamp() * 1000)
    }
    
    manifest_path = TELEMETRY_DIR / "manifest.json"
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)
    
    # Generate combined telemetry file for easy loading
    combined = {
        "manifest": manifest,
        "telemetry": {}
    }
    
    for tf in TIMEFRAME_MAP.values():
        combined["telemetry"][tf] = all_telemetry[tf]
    
    combined_path = TELEMETRY_DIR / "combined.telemetry.json"
    with open(combined_path, 'w') as f:
        json.dump(combined, f)
    
    print("\n" + "═" * 60)
    print(f"✓ Generated telemetry for {len(symbols)} symbols")
    print(f"✓ Timeframes: {', '.join(TIMEFRAME_MAP.values())}")
    print(f"✓ Output: {TELEMETRY_DIR}")
    print("═" * 60)

if __name__ == "__main__":
    process_all()
