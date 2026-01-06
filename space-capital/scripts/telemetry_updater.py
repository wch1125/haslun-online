#!/usr/bin/env python3
"""
telemetry_updater.py

Offline summarizer for TradingView 45-min CSV exports.
Reads one or many CSVs and writes compact per-ticker JSON summaries to the game repo.

Design goals:
- NO CSV parsing in the browser
- Output per ticker is small (<2KB typically)
- Metrics are stable + interpretable for gameplay telemetry enrichment

Expected CSV columns (subset is OK):
- time, open, high, low, close
- Kernel Regression Estimate
- Buy, Sell, StopBuy, StopSell
- Volume, Volume MA
- MACD, Signal Line, Histogram

Usage:
  python telemetry_updater.py --csv-dir ../assets/tickers/csv --repo ..
  python telemetry_updater.py --csv-dir /path/to/csvs --repo /path/to/space-capital --commit
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd


# ---------------------------
# Utilities
# ---------------------------

TICKER_RE = re.compile(r"(?:BATS_)?([A-Z]{1,6})", re.IGNORECASE)

def infer_ticker_from_filename(path: str) -> str:
    base = os.path.basename(path)
    # Handles: "BATS_RKLB, 45_ccede.csv" or "RKLB.csv"
    m = TICKER_RE.search(base.replace(" ", "").replace("-", "_"))
    if not m:
        raise ValueError(f"Could not infer ticker from filename: {base}")
    return m.group(1).upper()

def safe_col(df: pd.DataFrame, name: str) -> Optional[str]:
    """Return matching column name if exists (case-insensitive exact), else None."""
    lower = {c.lower(): c for c in df.columns}
    return lower.get(name.lower())

def pct_true(series: pd.Series) -> float:
    if series is None or series.empty:
        return 0.0
    s = series.dropna()
    if s.empty:
        return 0.0
    if s.dtype == bool:
        return float(s.mean())
    try:
        return float((s.astype(float) != 0).mean())
    except Exception:
        return float((s.astype(str).str.strip().str.lower().isin(["1", "true", "yes", "buy", "sell"])).mean())

def clamp01(x: float) -> float:
    return float(max(0.0, min(1.0, x)))

def rolling_mad(x: np.ndarray) -> float:
    """Median absolute deviation estimate scaled to std-ish."""
    med = np.nanmedian(x)
    mad = np.nanmedian(np.abs(x - med))
    return float(1.4826 * mad)

def git_run(repo_root: str, args: List[str]) -> Tuple[int, str]:
    p = subprocess.run(["git"] + args, cwd=repo_root, capture_output=True, text=True)
    out = (p.stdout or "") + (p.stderr or "")
    return p.returncode, out.strip()


# ---------------------------
# Core summarization
# ---------------------------

@dataclass
class MarketSummary:
    ticker: str
    bars: int
    start_time: int
    end_time: int

    # Key gameplay-facing metrics (0..1 where possible)
    kernelRespectPct: float
    bandCompression: float
    signalFollowThrough: float
    stopHuntFrequency: float
    volumeReliability: float
    macdPersistence: float

    # Extra context
    volatility: float
    avg_return: float
    max_drawdown: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "ticker": self.ticker,
            "bars": self.bars,
            "timeRange": {"start": self.start_time, "end": self.end_time},

            "kernelRespectPct": self.kernelRespectPct,
            "bandCompression": self.bandCompression,
            "signalFollowThrough": self.signalFollowThrough,
            "stopHuntFrequency": self.stopHuntFrequency,
            "volumeReliability": self.volumeReliability,
            "macdPersistence": self.macdPersistence,

            "volatility": self.volatility,
            "avg_return": self.avg_return,
            "max_drawdown": self.max_drawdown,

            "generatedAtUtc": datetime.now(timezone.utc).isoformat()
        }


def compute_kernel_respect(df: pd.DataFrame) -> float:
    """How often close stays near kernel estimate (normalized by local volatility)."""
    kcol = safe_col(df, "Kernel Regression Estimate")
    ccol = safe_col(df, "close")
    if not kcol or not ccol:
        return 0.0

    close = df[ccol].astype(float)
    kern = df[kcol].astype(float)
    diff = (close - kern).abs().to_numpy()

    rets = close.pct_change().to_numpy()
    scale = rolling_mad(rets[~np.isnan(rets)]) or np.nanstd(rets) or 1e-6
    within = diff < (close.abs().to_numpy() * scale * 2.0)
    return clamp01(float(np.nanmean(within)))


def compute_band_compression(df: pd.DataFrame) -> float:
    """Compression is high when G-bands are close together relative to price."""
    ccol = safe_col(df, "close")
    if not ccol:
        return 0.0
    close = df[ccol].astype(float)

    g100 = safe_col(df, "G100")
    g200 = safe_col(df, "G200")
    g150 = safe_col(df, "G150")

    if g100 and g200:
        width = (df[g200].astype(float) - df[g100].astype(float)).abs()
    elif g150 and g200:
        width = (df[g200].astype(float) - df[g150].astype(float)).abs()
    else:
        hcol = safe_col(df, "high")
        lcol = safe_col(df, "low")
        if not (hcol and lcol):
            return 0.0
        width = (df[hcol].astype(float) - df[lcol].astype(float)).abs()

    norm_width = (width / close.replace(0, np.nan)).to_numpy()
    p10, p90 = np.nanpercentile(norm_width, [10, 90])
    if not np.isfinite(p10) or not np.isfinite(p90) or p90 <= p10:
        return 0.0
    score = 1.0 - (np.nanmedian(norm_width) - p10) / (p90 - p10)
    return clamp01(float(score))


def compute_macd_persistence(df: pd.DataFrame) -> float:
    """Persistence of histogram sign (trend coherence proxy)."""
    hcol = safe_col(df, "Histogram")
    if not hcol:
        return 0.0
    hist = df[hcol].astype(float).to_numpy()
    sign = np.sign(hist)
    sign = sign[sign != 0]
    if sign.size < 10:
        return 0.0
    majority = 1 if np.sum(sign > 0) >= np.sum(sign < 0) else -1
    return clamp01(float(np.mean(sign == majority)))


def compute_stop_hunt(df: pd.DataFrame) -> float:
    """How often StopBuy/StopSell triggers per bar (0..1)."""
    sb = safe_col(df, "StopBuy")
    ss = safe_col(df, "StopSell")
    if not sb and not ss:
        return 0.0

    sb_pct = pct_true(df[sb]) if sb else 0.0
    ss_pct = pct_true(df[ss]) if ss else 0.0
    return clamp01(float(sb_pct + ss_pct))


def compute_volume_reliability(df: pd.DataFrame) -> float:
    """Stability of volume vs its MA. Higher = smoother, more reliable."""
    vcol = safe_col(df, "Volume")
    vm = safe_col(df, "Volume MA")
    if not vcol:
        return 0.5
    vol = df[vcol].astype(float).replace([np.inf, -np.inf], np.nan)
    if vol.dropna().empty:
        return 0.5

    if vm:
        vma = df[vm].astype(float).replace([np.inf, -np.inf], np.nan)
        ratio = (vol / vma.replace(0, np.nan)).to_numpy()
    else:
        ratio = (vol / (vol.rolling(40, min_periods=10).mean())).to_numpy()

    dispersion = np.nanstd(ratio)
    score = 1.0 / (1.0 + dispersion)
    return clamp01(float(score))


def compute_signal_follow_through(df: pd.DataFrame) -> float:
    """Of Buy/Sell signals, how often price moves favorably within N bars."""
    buy = safe_col(df, "Buy")
    sell = safe_col(df, "Sell")
    ccol = safe_col(df, "close")
    if not ccol or (not buy and not sell):
        return 0.0

    close = df[ccol].astype(float).to_numpy()

    buy_idx = np.where(~pd.isna(df[buy]).to_numpy())[0] if buy else np.array([], dtype=int)
    sell_idx = np.where(~pd.isna(df[sell]).to_numpy())[0] if sell else np.array([], dtype=int)

    if buy:
        buy_idx = np.where((pd.to_numeric(df[buy], errors="coerce").fillna(0).to_numpy() != 0))[0] \
            if df[buy].dtype != object else np.where(df[buy].astype(str).str.strip().ne("nan").to_numpy())[0]
    if sell:
        sell_idx = np.where((pd.to_numeric(df[sell], errors="coerce").fillna(0).to_numpy() != 0))[0] \
            if df[sell].dtype != object else np.where(df[sell].astype(str).str.strip().ne("nan").to_numpy())[0]

    if buy_idx.size + sell_idx.size == 0:
        return 0.0

    horizon = 8  # ~6 hours (8*45min)
    target = 0.012  # 1.2% favorable move
    outcomes: List[bool] = []

    for i in buy_idx:
        if i + 1 >= close.size: 
            continue
        end = min(close.size, i + 1 + horizon)
        entry = close[i]
        if not np.isfinite(entry) or entry == 0:
            continue
        max_fwd = np.nanmax(close[i+1:end])
        outcomes.append(((max_fwd / entry) - 1.0) >= target)

    for i in sell_idx:
        if i + 1 >= close.size:
            continue
        end = min(close.size, i + 1 + horizon)
        entry = close[i]
        if not np.isfinite(entry) or entry == 0:
            continue
        min_fwd = np.nanmin(close[i+1:end])
        outcomes.append(((entry / min_fwd) - 1.0) >= target)

    if not outcomes:
        return 0.0
    return clamp01(float(np.mean(outcomes)))


def compute_basic_stats(df: pd.DataFrame) -> Tuple[float, float, float]:
    ccol = safe_col(df, "close")
    if not ccol:
        return 0.0, 0.0, 0.0
    close = df[ccol].astype(float)
    rets = close.pct_change()
    vol = float(rets.std(skipna=True) or 0.0)
    avg = float(rets.mean(skipna=True) or 0.0)
    dd = float((close / close.cummax() - 1).min(skipna=True) or 0.0)
    return vol, avg, dd


def summarize_csv(path: str) -> MarketSummary:
    df = pd.read_csv(path)

    time_col = safe_col(df, "time")
    if not time_col:
        raise ValueError(f"{path}: missing required 'time' column")

    ticker = infer_ticker_from_filename(path)
    bars = int(len(df))
    start_time = int(df[time_col].iloc[0])
    end_time = int(df[time_col].iloc[-1])

    kernelRespectPct = compute_kernel_respect(df)
    bandCompression = compute_band_compression(df)
    signalFollowThrough = compute_signal_follow_through(df)
    stopHuntFrequency = compute_stop_hunt(df)
    volumeReliability = compute_volume_reliability(df)
    macdPersistence = compute_macd_persistence(df)

    volatility, avg_return, max_drawdown = compute_basic_stats(df)

    return MarketSummary(
        ticker=ticker,
        bars=bars,
        start_time=start_time,
        end_time=end_time,
        kernelRespectPct=kernelRespectPct,
        bandCompression=bandCompression,
        signalFollowThrough=signalFollowThrough,
        stopHuntFrequency=stopHuntFrequency,
        volumeReliability=volumeReliability,
        macdPersistence=macdPersistence,
        volatility=volatility,
        avg_return=avg_return,
        max_drawdown=max_drawdown
    )


# ---------------------------
# Main CLI
# ---------------------------

def main():
    ap = argparse.ArgumentParser(
        description="Process TradingView CSV exports into JSON summaries for Space Capital",
        epilog="""
Example usage (run from scripts/ folder):
  python telemetry_updater.py --csv-dir ../assets/tickers/csv --repo ..
  python telemetry_updater.py --csv-dir /path/to/csvs --repo /path/to/space-capital --commit
        """
    )
    ap.add_argument("--csv-dir", required=True, 
                    help="Folder containing TradingView CSVs (e.g., assets/tickers/csv)")
    ap.add_argument("--repo", required=True, 
                    help="Path to space-capital game root")
    ap.add_argument("--out-rel", default="data/market_summaries", 
                    help="Output path relative to repo root")
    ap.add_argument("--commit", action="store_true", 
                    help="Run git add/commit after writing summaries")
    ap.add_argument("--push", action="store_true", 
                    help="Also git push (implies --commit)")
    args = ap.parse_args()

    repo_root = os.path.abspath(args.repo)
    out_dir = os.path.join(repo_root, args.out_rel)
    os.makedirs(out_dir, exist_ok=True)

    csv_dir = os.path.abspath(args.csv_dir)
    csvs = [os.path.join(csv_dir, f) for f in os.listdir(csv_dir) if f.lower().endswith(".csv")]
    if not csvs:
        raise SystemExit(f"No CSV files found in: {csv_dir}")

    written = []
    for p in sorted(csvs):
        try:
            summary = summarize_csv(p)
        except Exception as e:
            print(f"[SKIP] {os.path.basename(p)}: {e}")
            continue

        out_path = os.path.join(out_dir, f"{summary.ticker}.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(summary.to_dict(), f, indent=2)
        written.append(out_path)
        print(f"[OK] {summary.ticker} -> {os.path.relpath(out_path, repo_root)}")

    if not written:
        raise SystemExit("No summaries written. Check CSV format / filenames.")

    if args.push:
        args.commit = True

    if args.commit:
        rels = [os.path.relpath(p, repo_root) for p in written]
        code, out = git_run(repo_root, ["add"] + rels)
        print(out if out else "[git add] ok")

        msg = f"Update market summaries ({len(written)} tickers)"
        code, out = git_run(repo_root, ["commit", "-m", msg])
        print(out if out else "[git commit] ok")

        if args.push:
            code, out = git_run(repo_root, ["push"])
            print(out if out else "[git push] ok")


if __name__ == "__main__":
    main()
