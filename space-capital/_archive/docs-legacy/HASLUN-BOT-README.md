# HASLUN-BOT: Pilot's Cockpit

## Project Overview

HASLUN-BOT is a **trading dashboard disguised as a retro sci-fi space fleet command center**. It transforms traditional financial portfolio tracking into an immersive gaming-inspired experience, presenting stock positions as spaceships in a fleet, charts as telemetry readouts, and market data through the lens of NASA Mission Control meets 1980s anime mecha aesthetics.

**This is web art as much as it is functional software.**

### Design Philosophy

The core aesthetic draws from:
- **NASA Mission Control / NORAD** — Dense information displays, monospace typography, status indicators
- **Spielberg-era sci-fi** — Close Encounters, E.T., warm amber and phosphor green CRT aesthetics
- **Anime mecha HUDs** — Gundam, Evangelion-style cockpit readouts and targeting displays
- **No Man's Sky / Elite Dangerous** — Fleet management screens, ship cards, status bars
- **Retro arcade games** — Space Invaders pixel art, CRT scanlines, 8-bit sound design

### Key Principle
> Every UI element should feel like it belongs in a spacecraft cockpit, not a Bloomberg terminal.

---

## File Structure

```
/
├── index.html          # Single-file application (~14,000 lines)
│                       # Contains all HTML, CSS, and JavaScript
│
└── data/
    ├── stats.json      # Aggregated ticker statistics
    ├── rklb.json       # Per-ticker price/MACD data
    ├── lunr.json
    ├── asts.json
    ├── achr.json
    ├── joby.json
    ├── ... (other tickers)
    └── index.json      # Market index data
```

### Why Single-File?
The project is intentionally a single HTML file for:
1. Portability — Can be opened directly in any browser
2. Simplicity — No build process required
3. Self-contained — All dependencies loaded via CDN

---

## Architecture Overview

### HTML Structure (Top to Bottom)

```
<html>
├── <head>
│   ├── Meta tags, favicon
│   ├── Google Fonts (IBM Plex Mono, Orbitron, Space Grotesk)
│   ├── Chart.js + date-fns adapter (CDN)
│   └── <style> (ALL CSS ~5000 lines)
│
├── <body>
│   ├── Loading Screen (Space Invaders army animation)
│   │
│   ├── #app (main application container)
│   │   ├── SVG Ship Definitions (<defs> with reusable ship symbols)
│   │   ├── Header (logo, nav tabs, status indicators)
│   │   ├── Mobile Drawer (slide-out navigation)
│   │   ├── <main>
│   │   │   ├── Sidebar (stats, MACD, trend, watchlist)
│   │   │   ├── Content Area
│   │   │   │   ├── #chart-panel (Telemetry)
│   │   │   │   ├── #positions-panel (Holdings/Fleet Command)
│   │   │   │   ├── #options-panel (Derivatives)
│   │   │   │   └── #catalysts-panel (Events)
│   │   │   └── Right Sidebar (hidden in current mode)
│   │   │
│   │   ├── Mobile Bottom Nav
│   │   ├── Mobile Quick Stats Bar
│   │   ├── Mobile FAB (Floating Action Button)
│   │   ├── Status Strip (desktop footer)
│   │   └── Watermark
│   │
│   ├── Overlays
│   │   ├── Pip-Boy Dossier (ticker detail modal)
│   │   ├── About Panel
│   │   ├── Admin Console (easter egg)
│   │   └── Arcade Games (Signal Invaders, Terrain Lander)
│   │
│   └── <script> (ALL JavaScript ~8000 lines)
```

---

## CSS Organization

### CSS Custom Properties (Design Tokens)

```css
:root {
  /* Backgrounds - dark space theme */
  --bg-void: #050608;      /* Deepest black */
  --bg-deep: #0a0c0f;      /* Main background */
  --bg-panel: #0d1117;     /* Panel backgrounds */
  --bg-card: #151b23;      /* Card backgrounds */
  --bg-input: #1a222c;     /* Input fields */
  
  /* Borders */
  --border: #1e2832;
  --border-glow: #2a3a4a;
  
  /* Text hierarchy */
  --text-bright: #f0f8f4;  /* Primary text */
  --text: #b8d0c8;         /* Body text */
  --text-muted: #6a8078;   /* Secondary */
  --text-dim: #4a5a54;     /* Tertiary */
  
  /* Accent colors - HSL-based for hue shifting */
  --accent-hue: 150;       /* Green by default, user-adjustable */
  --phosphor: hsl(var(--accent-hue), 100%, 60%);
  --phosphor-dim: hsla(var(--accent-hue), 100%, 60%, 0.6);
  --phosphor-glow: hsla(var(--accent-hue), 100%, 60%, 0.15);
  --phosphor-ghost: hsla(var(--accent-hue), 100%, 60%, 0.08);
  
  /* Signal colors */
  --signal-up: hsl(var(--accent-hue), 100%, 60%);  /* Green/positive */
  --signal-down: #ff6b6b;   /* Red/negative */
  --signal-warn: #ffb347;   /* Amber/warning */
  
  /* Typography */
  --font-display: 'Orbitron', sans-serif;   /* Headers, callouts */
  --font-body: 'IBM Plex Mono', monospace;  /* Body text */
  --font-mono: 'IBM Plex Mono', monospace;  /* Data, code */
}
```

### CSS Sections (in order)

1. **Command Center Mode Overrides** (~lines 57-450)
   - Hides redundant elements
   - Streamlines sidebar
   - Configures metrics grid

2. **Fleet Management System** (~lines 74-400)
   - Ship card styles
   - Fleet grid layout
   - Status bars and indicators

3. **Telemetry Cockpit Shell** (~lines 400-950)
   - Viewport with grid overlay
   - Side console panels
   - Bridge feed log

4. **Base Styles** (~lines 950-1200)
   - Body, resets, CRT effects
   - Scanlines animation
   - Grid background

5. **Loading Screen** (~lines 1200-1500)
   - Space Invaders army
   - Countdown animation
   - Pixel art mothership

6. **Layout Components** (~lines 1500-2000)
   - Header, sidebar, main content
   - Navigation tabs
   - Status strip

7. **Chart Styles** (~lines 2000-2200)
   - Chart containers
   - Control buttons
   - Timeframe selectors

8. **Data Tables** (~lines 2200-2400)
   - Table styling
   - Row hover states
   - Ticker badges

9. **Sidebar Components** (~lines 2400-2700)
   - Stats grid
   - MACD display
   - Trend status
   - Watchlist

10. **Control Panel** (~lines 2700-3200)
    - Vacuum tubes
    - Knobs and sliders
    - Scanner display

11. **Overlays & Modals** (~lines 3200-4000)
    - Pip-Boy dossier
    - About panel
    - Admin console

12. **Arcade Games** (~lines 4000-4700)
    - Signal Invaders
    - Terrain Lander
    - Touch controls

13. **Mobile Responsive** (~lines 4700-5500)
    - Breakpoints: 1200px, 1024px, 900px, 768px, 480px
    - Touch-friendly targets
    - Safe area insets
    - Bottom navigation
    - FAB menu

14. **Animations** (scattered throughout)
    - `@keyframes scanline`
    - `@keyframes pulse-glow`
    - `@keyframes blink`
    - `@keyframes hover-ship`
    - `@keyframes radar-sweep`

---

## JavaScript Organization

### Global State

```javascript
let currentTicker = 'RKLB';      // Active ticker symbol
let currentTimeframe = '1D';     // '1D' (daily) or '45' (45-min)
let currentRange = '3M';         // '1W', '1M', '3M', '6M', '1Y', 'ALL'
let showMA = true;               // Show moving averages on chart
let priceChart = null;           // Chart.js instance
let macdChart = null;            // Chart.js instance
let tickerData = {};             // Cached ticker data
let statsData = {};              // Aggregated stats
```

### Key Data Structures

```javascript
// Ticker colors (per-ticker accent)
const tickerColors = {
  'RKLB': '#33ff99', 'LUNR': '#47d4ff', 'ASTS': '#ffb347',
  'ACHR': '#ff6b9d', 'JOBY': '#b388ff', 'GME': '#ff6b6b', ...
};

// Ticker sector themes
const tickerThemes = {
  'RKLB': 'SPACE', 'LUNR': 'SPACE', 'ACHR': 'eVTOL',
  'JOBY': 'eVTOL', 'GME': 'MEME', 'KTOS': 'DEFENSE', ...
};

// Range to days mapping
const rangeDays = { '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365, 'ALL': 9999 };

// Demo stock positions (simulated portfolio)
const DEMO_STOCK_POSITIONS = [
  { ticker: 'RKLB', shares: 75, entry_price: 68.45, current_price: 72.80 },
  { ticker: 'ASTS', shares: 50, entry_price: 78.20, current_price: 83.47 },
  ...
];

// Ticker profiles (Pip-Boy dossier content)
const TICKER_PROFILES = {
  RKLB: {
    name: "Rocket Lab USA",
    codename: "ELECTRON",
    sector: "Space Launch & Satellites",
    threat_level: "MODERATE",
    summary: "...",
    thesis: "...",
    catalysts: [...],
    risks: [...],
    vitals: {...},
    lore: "..."
  },
  ...
};

// Pixel ship patterns (17x11 grids)
const PIXEL_SHIPS = {
  flagship: ["00000011100000000", ...],
  dreadnought: [...],
  carrier: [...],
  lander: [...],
  drone: [...],
  cruiser: [...],
  station: [...],
  probe: [...],
  hauler: [...]
};

// Ship name assignments
const SHIP_NAMES = {
  RKLB: { name: "ELECTRON", designation: "FSC-001" },
  LUNR: { name: "ODYSSEY", designation: "LNR-002" },
  ...
};
```

### Core Functions

#### Data Loading
```javascript
async function init()                    // Bootstrap application
async function loadTicker(ticker)        // Fetch and display ticker data
function buildWatchlist(tickers)         // Populate watchlist UI
```

#### Chart Rendering
```javascript
function updateCharts()                  // Render price + MACD charts
function setTimeframe(tf)                // Switch 1D/45M
function setRange(range)                 // Switch time range
function toggleMA()                      // Toggle moving averages
```

#### Telemetry Console
```javascript
function updateTelemetryConsole(source, closes)  // Update side panel
function renderConsoleShip(ticker, pnl)          // Draw pixel ship
function addBridgeFeedEntry(ticker, latest, pnl) // Add log entry
```

#### Fleet Management (Holdings)
```javascript
function renderFleetGrid()               // Render ship cards
function renderStockPositions()          // Legacy table + fleet grid
function generateShipSvgString(pattern, color, pnl)  // SVG generation
function setFleetView(view)              // Toggle grid/table view
```

#### Pixel Ship System
```javascript
function renderPixelShip(svgEl, patternKey, opts)  // Render to SVG element
function mapTickerToPixelShip(ticker, sector, pnl) // Assign ship type
function getPixelShipLore(patternKey)              // Get ship metadata
```

#### UI Interactions
```javascript
function switchTab(tabName)              // Desktop tab switching
function switchTabMobile(tabName)        // Mobile bottom nav
function toggleMobileDrawer()            // Slide-out menu
function toggleFabMenu()                 // FAB expand/collapse
function openTickerDossier(ticker)       // Open Pip-Boy modal
```

#### Sound System
```javascript
const SoundFX = {
  enabled: true,
  play(name) { ... }  // 'click', 'blip', 'alert', etc.
};

const BGMSystem = {
  playing: false,
  start() { ... },    // Procedural anime mecha music
  stop() { ... }
};
```

#### Arcade Games
```javascript
const SignalInvaders = { ... }  // Space Invaders clone
const LandingGame = { ... }     // Lunar lander game
```

---

## Data Format

### stats.json
```json
{
  "RKLB": {
    "current": 72.43,
    "return_1d": 2.16,
    "return_1w": 5.23,
    "return_1m": 12.45,
    "volume": 1234567,
    "avg_volume": 987654
  },
  ...
}
```

### [ticker].json
```json
{
  "daily": [
    {
      "t": 1704067200000,  // Unix timestamp (ms)
      "o": 70.50,          // Open
      "h": 73.20,          // High
      "l": 70.10,          // Low
      "c": 72.43,          // Close
      "v": 1234567,        // Volume
      "g100": 68.50,       // MA-100
      "g150": 65.20,       // MA-150
      "g200": 62.10,       // MA-200
      "macd": 0.3642,      // MACD line
      "signal": 0.2570,    // Signal line
      "hist": 0.1073       // Histogram
    },
    ...
  ],
  "intraday": [...]  // Same format, 45-minute candles
}
```

---

## Key UI Components

### 1. Telemetry Shell (Chart Panel)
- **Header**: Ship callout, status meters (SIGNAL, HULL bar, RISK, UPLINK)
- **Viewport**: Chart with grid overlay and crosshair
- **Side Console**: Active vessel ship, sensor bank (MAs), thrust vector (MACD), bridge feed log
- **Footer**: Status chips

### 2. Fleet Command (Holdings Panel)
- **Header**: "FLEET COMMAND" title, mini stats (P&L, value, count)
- **Ship Cards**: Pixel ship visualization, status bars (HULL, CARGO, FUEL), P&L display
- **Summary Bar**: Operational/Damaged counts, win rate, view toggle

### 3. Mobile Navigation
- **Bottom Nav**: 5 buttons (Telemetry, Holdings, Derivatives, Events, More)
- **Quick Stats Bar**: Scrollable status indicators
- **FAB**: Expandable menu for SFX/BGM toggles, About

### 4. Sidebar
- **Portfolio Status**: 2x2 stats grid
- **MACD Signal**: Current values
- **Trend Status**: Bull/bear/nebula indicator
- **Watchlist**: Scrollable ticker list

### 5. Loading Screen
- Space Invaders army marching
- Mothership with tractor beam
- Countdown timer

---

## Known Issues / Areas for Review

### Potential Bugs
1. **Chart Y-axis on very short ranges** — 1W may still appear flat if data has minimal variance
2. **Mobile drawer scroll lock** — Sometimes body scroll isn't restored after closing
3. **Watchlist click on mobile** — May not always close drawer after selection
4. **Side console on tablets** — 900px breakpoint may be too aggressive

### UI Improvement Opportunities
1. **Telemetry panel density** — Side console could show more data
2. **Fleet card interactions** — Could add hover states, expand for details
3. **Chart tooltips** — Could be more informative with lore text
4. **Loading screen** — Could be skippable or shorter
5. **Derivatives/Events panels** — Less developed than Telemetry/Holdings
6. **Accessibility** — Missing ARIA labels, focus states could be improved
7. **Dark mode variants** — Could offer different color schemes beyond hue slider

### Performance Considerations
1. **Chart rebuilding** — Currently destroys and recreates Chart.js instances on every update
2. **Pixel ship rendering** — Creates many SVG rects; could use canvas for better performance
3. **Large DOM** — Single file with many hidden elements

---

## Design Guidelines for Future Work

### DO:
- Use the existing color variables (`--phosphor`, `--signal-up`, etc.)
- Maintain monospace typography for data
- Keep information density high but organized
- Add lore/flavor text where appropriate
- Consider touch targets (minimum 44px)
- Test on mobile viewports

### DON'T:
- Use pure white backgrounds
- Add generic UI elements (standard dropdowns, default buttons)
- Break the "cockpit/command center" metaphor
- Remove existing functionality without replacement
- Use CSS frameworks (Tailwind, Bootstrap) that conflict with existing styles

### Aesthetic Checklist:
- [ ] Does it look like it belongs in a spacecraft?
- [ ] Would this feel at home in an 80s sci-fi film?
- [ ] Is the typography consistent (IBM Plex Mono / Orbitron)?
- [ ] Are status indicators clear (green = good, amber = warn, red = bad)?
- [ ] Does it work on mobile without losing the aesthetic?

---

## Quick Reference: Element IDs

### Charts
- `#price-chart` — Main price chart canvas
- `#macd-chart` — MACD indicator chart canvas

### Telemetry Console
- `#telemetry-ship-name` — Header callout
- `#tm-signal` — Signal status text
- `#tm-hull-fill` — Hull bar fill element
- `#tm-risk-vel` — Risk velocity value
- `#tm-ma100`, `#tm-ma150`, `#tm-ma200` — MA values
- `#tm-macd`, `#tm-sig`, `#tm-histo` — MACD values
- `#telemetry-log` — Bridge feed container
- `#console-ship-svg` — Side console ship SVG

### Fleet Command
- `#fleet-grid` — Ship cards container
- `#fleet-total-pnl`, `#fleet-total-value`, `#fleet-ship-count` — Header stats
- `#fleet-operational-count`, `#fleet-damaged-count`, `#fleet-win-rate` — Summary stats

### Mobile
- `#mobile-bottom-nav` — Bottom navigation bar
- `#mobile-quick-stats` — Stats bar above bottom nav
- `#mobile-fab` — Floating action button container
- `#mobile-ticker-carousel` — Horizontal ticker scroller
- `#mobile-drawer` — Slide-out navigation panel

### Global
- `#chart-ticker`, `#chart-price`, `#chart-change` — Current ticker display
- `#watchlist` — Sidebar watchlist container
- `#stock-tbody` — Holdings table body (legacy view)

---

## Testing Checklist

### Desktop (1200px+)
- [ ] All four tabs render correctly
- [ ] Chart updates on ticker/range change
- [ ] Side console shows correct data
- [ ] Fleet cards display with ship visualizations
- [ ] Watchlist selection updates everything

### Tablet (768px - 1200px)
- [ ] Sidebar collapses appropriately
- [ ] Telemetry side console hidden
- [ ] Charts remain readable

### Mobile (< 768px)
- [ ] Bottom nav is visible and functional
- [ ] Mobile drawer opens/closes smoothly
- [ ] FAB menu works
- [ ] Ticker carousel scrolls horizontally
- [ ] Safe areas respected on notched devices

### Interactions
- [ ] Sound effects play (when enabled)
- [ ] BGM starts/stops correctly
- [ ] Hue slider changes accent color
- [ ] Pip-Boy dossier opens for tickers with profiles

---

*Last updated: January 2025*
*For questions about the codebase, reference the inline comments in index.html*
