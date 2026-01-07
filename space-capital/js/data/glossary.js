// =========================================================================
// PARALLAX GLOSSARY — Tooltips, flavor text, and lore system
// Extracted from app.js for modularity
// =========================================================================

(function() {
  const PARALLAX_GLOSSARY = {
  // ---------- CORE PORTFOLIO METRICS ----------
  today_pnl: {
    label: "Today's P&L",
    category: "metric",
    unit: "USD",
    tooltip: "Profit or loss generated since the start of the current trading day.",
    flavor: "How much the market liked you today, before feelings reset at the open."
  },
  total_pnl: {
    label: "Total P&L",
    category: "metric",
    unit: "USD",
    tooltip: "Cumulative profit or loss for this simulation since inception.",
    flavor: "Lifetime score since the moment you pressed START on this universe."
  },
  positions_count: {
    label: "Positions",
    category: "metric",
    tooltip: "Number of tickers currently held in the portfolio.",
    flavor: "How many plates you're spinning in zero gravity."
  },
  win_rate: {
    label: "Win Rate",
    category: "metric",
    unit: "%",
    tooltip: "Percentage of closed trades that ended with positive P&L.",
    flavor: "Hit rate. Accuracy stat. Bragging-rights fuel."
  },
  portfolio_value: {
    label: "Portfolio Value",
    category: "metric",
    unit: "USD",
    tooltip: "Current market value of all open positions plus cash.",
    flavor: "What your empire is worth if you slammed the SELL ALL button."
  },
  total_delta: {
    label: "Total Delta",
    category: "metric",
    tooltip: "Sensitivity of the options book to a $1 move in the underlying basket.",
    flavor: "How violently the cockpit shakes when prices nudge."
  },
  days_to_expiry: {
    label: "Days to Expiry",
    category: "metric",
    tooltip: "Time remaining until the primary options cycle expires.",
    flavor: "How long until the clock runs out on this particular boss fight."
  },
  
  // ---------- MACD & MOMENTUM ----------
  macd: {
    label: "MACD",
    category: "metric",
    tooltip: "Moving Average Convergence Divergence: fast EMA minus slow EMA of price.",
    flavor: "Momentum gauge. Shows when rockets are over-fuelled or stalling out."
  },
  macd_signal: {
    label: "Signal",
    category: "metric",
    tooltip: "EMA of the MACD line. Crossovers often signal trend shifts.",
    flavor: "The grown-up in the room telling MACD to calm down (or speed up)."
  },
  macd_histogram: {
    label: "Histogram",
    category: "metric",
    tooltip: "MACD minus Signal. Bars above/below zero show relative momentum.",
    flavor: "The heartbeat monitor for trend strength. Flatline not recommended."
  },
  
  // ---------- TREND STATUS STATES ----------
  trend_analyzing: {
    label: "ANALYZING…",
    category: "state",
    icon: "◌",
    color: "var(--text-muted)",
    tooltip: "System is ingesting data and calculating trend classification.",
    flavor: "Coffee being poured into the machine. Please stand by.",
    subtitle: "Awaiting data…",
    body: "Scanning telemetry feed for recognizable patterns."
  },
  trend_full_thrust: {
    label: "FULL THRUST",
    category: "state",
    icon: "▲",
    color: "var(--phosphor)",
    tooltip: "Price above long-term averages with bullish momentum.",
    flavor: "Engines lit, nose up, telemetry green. Strap in.",
    subtitle: "All systems green.",
    body: "Price above 200-day line with positive momentum. Trend uptrend confirmed until proven otherwise."
  },
  trend_reversal_attempt: {
    label: "REVERSAL ATTEMPT",
    category: "state",
    icon: "◈",
    color: "var(--amber)",
    tooltip: "Price recovering above short/mid MAs but below long-term baseline.",
    flavor: "Ship has stopped crashing. Jury still out on actual flying.",
    subtitle: "Course correction underway.",
    body: "Price has climbed back above the short-term baseline but hasn't cleared the long-term ceiling. Reversal in progress; turbulence expected."
  },
  trend_drifting: {
    label: "DRIFTING",
    category: "state",
    icon: "◇",
    color: "#47d4ff",
    tooltip: "Price oscillating around key averages with weak directional bias.",
    flavor: "Coasting in orbit. Safe, but nothing cinematic.",
    subtitle: "Stable orbit.",
    body: "Price hugging moving averages with low momentum. No clear directional bias; good time for coffee or long emails."
  },
  trend_reentry_risk: {
    label: "REENTRY RISK",
    category: "state",
    icon: "▼",
    color: "#ff6b6b",
    tooltip: "Price below major moving averages with bearish momentum.",
    flavor: "Heat shield glowing. Consider which side of the planet you want to land on.",
    subtitle: "Altitude loss detected.",
    body: "Price below long-term trend with negative momentum. Downside pressure present; check heat shield and position sizing."
  },
  trend_nebula: {
    label: "NEBULOUS",
    category: "state",
    icon: "※",
    color: "#b388ff",
    tooltip: "High volatility and conflicting signals; no clear trend.",
    flavor: "In a cosmic dust cloud. Instruments insist everything is 'fine'.",
    subtitle: "Signal degraded.",
    body: "Choppy, sideways, mean-reverting mess. Indicators argue with each other; system recommends humility."
  },
  
  // ---------- SIGNAL PROCESSING ARRAY ----------
  sig_smoothing: {
    label: "Signal Smoothing",
    category: "control",
    tooltip: "Adjusts how much short-term noise is filtered from price and MACD.",
    flavor: "Turn right to make charts look wise and slow. Turn left for chaos TV."
  },
  sig_forecast_range: {
    label: "Forecast Range",
    category: "control",
    tooltip: "How far into the future the simulation projects price paths.",
    flavor: "How many days ahead you want to pretend you can see."
  },
  sig_risk_exposure: {
    label: "Risk Exposure",
    category: "control",
    tooltip: "Scenario profile from defensive to aggressive. Scales drift and leverage in simulations.",
    flavor: "How spicy you want the universe to feel right now."
  },
  sig_vol_index: {
    label: "Volatility Index",
    category: "metric",
    tooltip: "Synthetic volatility score derived from recent price swings.",
    flavor: "How much the market is wiggling while you try to act composed."
  },
  sig_display_momentum: {
    label: "Momentum Overlay",
    category: "control",
    tooltip: "Toggle MACD / trend overlays on the main chart.",
    flavor: "Draws the invisible wind the rockets are flying through."
  },
  sig_display_heatmap: {
    label: "Volume Heatmap",
    category: "control",
    tooltip: "Show volume intensity as background shading on the chart.",
    flavor: "Where the crowd actually showed up versus where they just talked big."
  },
  sig_display_alerts: {
    label: "Alert Markers",
    category: "control",
    tooltip: "Display crossover events and custom triggers as icons on the chart.",
    flavor: "Little neon post-its on the timeline saying 'something weird happened here'."
  },
  sig_alert_sensitivity: {
    label: "Alert Sensitivity",
    category: "control",
    tooltip: "Controls how easily the system raises visual alerts.",
    flavor: "Slide right to let the system panic for you. Slide left if you enjoy surprises."
  },
  sig_market_scanner: {
    label: "Market Scanner",
    category: "metric",
    tooltip: "Compressed view of recent signals across the watchlist.",
    flavor: "Radar sweep. Blips mean 'look here', not 'buy here'. Probably."
  },
  
  // ---------- DERIVATIVES / OPTIONS ----------
  strat_naked_leap: {
    label: "Naked LEAP",
    category: "strategy",
    tooltip: "Long-dated call with no offsetting hedge.",
    flavor: "Maximum optimism. Minimum adult supervision."
  },
  strat_bull_spread: {
    label: "Bull Spread",
    category: "strategy",
    tooltip: "Call spread benefitting from moderate price appreciation.",
    flavor: "Not trying to reach Mars. Just happy to clear the atmosphere."
  },
  strat_bear_spread: {
    label: "Bear Spread",
    category: "strategy",
    tooltip: "Put or call spread positioned for a controlled downside move.",
    flavor: "You don't need a crash, just a dignified stumble."
  },
  derivatives_tab: {
    label: "Derivatives",
    category: "navigation",
    tooltip: "Options and structured positions with defined risk profiles.",
    flavor: "Levers, pulleys, and very opinionated probability curves."
  },
  greek_delta: {
    label: "Delta",
    category: "metric",
    tooltip: "First derivative of option price with respect to underlying price.",
    flavor: "How loudly this option screams when the stock twitches."
  },
  greek_theta: {
    label: "Theta",
    category: "metric",
    tooltip: "Daily time decay of the option's value.",
    flavor: "Rent you pay for living in the future."
  },
  greek_gamma: {
    label: "Gamma",
    category: "metric",
    tooltip: "Rate of change of delta as the underlying moves.",
    flavor: "How quickly a calm trade turns dramatic when price gets ideas."
  },
  greek_vega: {
    label: "Vega",
    category: "metric",
    tooltip: "Sensitivity of option price to changes in volatility.",
    flavor: "Mood swing multiplier. When volatility sulks, these feel it first."
  },
  
  // ---------- GLOBAL STATES ----------
  mode_simulation: {
    label: "Simulation Mode",
    category: "state",
    tooltip: "All data and trades are running in sandbox mode.",
    flavor: "Play money. Real feelings."
  },
  status_uplink_active: {
    label: "Uplink Active",
    category: "state",
    tooltip: "Connection to data stream is healthy.",
    flavor: "Someone, somewhere, is still sending numbers."
  },
  status_system_nominal: {
    label: "System Nominal",
    category: "state",
    tooltip: "No major errors or warnings detected.",
    flavor: "Everything is fine, which is statistically suspicious."
  },
  status_mkt_closed: {
    label: "Market Closed",
    category: "state",
    tooltip: "Exchange session has ended; prices are static.",
    flavor: "The casino lights are off, but the spreadsheets are still awake."
  },
  abort_all_trades: {
    label: "Abort All Trades",
    category: "control",
    tooltip: "Emergency liquidation of all open positions.",
    flavor: "Emergency exit. Does not apply to your feelings."
  }
};

// Portfolio mood states based on daily P&L percentage
const PORTFOLIO_MOODS = {
  thruster_boost: { threshold: 2, label: "THRUSTER BOOST", color: "var(--phosphor)", copy: "Portfolio making energetic upward noises." },
  steady_climb: { threshold: 0, label: "STEADY CLIMB", color: "var(--phosphor-dim)", copy: "Green enough to feel smug, not enough to tweet about." },
  minor_turbulence: { threshold: -1, label: "MINOR TURBULENCE", color: "var(--amber)", copy: "Seatbelts on, beverage carts still operational." },
  hull_rattle: { threshold: -999, label: "HULL RATTLE", color: "#ff6b6b", copy: "Today's lesson: gravity always wins eventually." }
};

// MACD status messages
const MACD_STATES = {
  bullish_cross: { label: "Bullish crossover", copy: "Engines pushing above baseline." },
  bearish_cross: { label: "Bearish crossover", copy: "Thrust vector pointing down." },
  weak_signal: { label: "Momentum quiet", copy: "Coasting on inertia." },
  divergence: { label: "Divergence watch", copy: "Price and momentum disagree." }
};

// Expose globally for use by other modules
  window.PARALLAX_GLOSSARY = PARALLAX_GLOSSARY;
  window.PORTFOLIO_MOODS = PORTFOLIO_MOODS;
  window.MACD_STATES = MACD_STATES;
})();
