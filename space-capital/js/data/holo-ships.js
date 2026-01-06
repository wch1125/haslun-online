// =========================================================================
// HOLOGRAPHIC SHIP PANEL — SVG wireframe ship displays
// Extracted from app.js for modularity
// =========================================================================

(function() {
  const HOLO_SHIPS = {
    RKLB: {
      label: "RKLB · ORBITAL BUS",
      path: `
        <polyline points="10,30 30,10 70,10 90,30 70,50 30,50 10,30" class="holo-line"/>
        <polyline points="30,10 40,5 60,5 70,10" class="holo-line"/>
        <line x1="25" y1="30" x2="75" y2="30" class="holo-line"/>
        <line x1="40" y1="50" x2="40" y2="55" class="holo-line"/>
        <line x1="60" y1="50" x2="60" y2="55" class="holo-line"/>
      `
    },
    LUNR: {
      label: "LUNR · LUNAR SCOUT",
      path: `
        <polyline points="10,35 25,20 40,25 60,25 75,20 90,35 60,45 40,45 10,35" class="holo-line"/>
        <circle cx="50" cy="23" r="6" class="holo-line"/>
        <line x1="40" y1="45" x2="35" y2="55" class="holo-line"/>
        <line x1="60" y1="45" x2="65" y2="55" class="holo-line"/>
      `
    },
    JOBY: {
      label: "JOBY · EVTOL FRAME",
      path: `
        <polyline points="15,35 30,25 70,25 85,35 70,45 30,45 15,35" class="holo-line"/>
        <circle cx="30" cy="20" r="7" class="holo-line"/>
        <circle cx="70" cy="20" r="7" class="holo-line"/>
        <line x1="30" y1="27" x2="30" y2="35" class="holo-line"/>
        <line x1="70" y1="27" x2="70" y2="35" class="holo-line"/>
      `
    },
    ACHR: {
      label: "ACHR · ARCHER VTOL",
      path: `
        <polyline points="20,30 35,15 65,15 80,30 65,45 35,45 20,30" class="holo-line"/>
        <circle cx="35" cy="18" r="5" class="holo-line"/>
        <circle cx="65" cy="18" r="5" class="holo-line"/>
        <line x1="50" y1="15" x2="50" y2="45" class="holo-line"/>
      `
    },
    ASTS: {
      label: "ASTS · BLUEBIRD SAT",
      path: `
        <rect x="35" y="20" width="30" height="20" rx="2" class="holo-line"/>
        <line x1="20" y1="30" x2="35" y2="30" class="holo-line"/>
        <line x1="65" y1="30" x2="80" y2="30" class="holo-line"/>
        <rect x="10" y="22" width="12" height="16" rx="1" class="holo-line"/>
        <rect x="78" y="22" width="12" height="16" rx="1" class="holo-line"/>
      `
    },
    BKSY: {
      label: "BKSY · BLACKSKY SAT",
      path: `
        <circle cx="50" cy="30" r="12" class="holo-line"/>
        <line x1="15" y1="30" x2="38" y2="30" class="holo-line"/>
        <line x1="62" y1="30" x2="85" y2="30" class="holo-line"/>
        <rect x="8" y="24" width="10" height="12" rx="1" class="holo-line"/>
        <rect x="82" y="24" width="10" height="12" rx="1" class="holo-line"/>
      `
    },
    GME: {
      label: "GME · POWER CORE",
      path: `
        <polygon points="50,10 70,25 70,40 50,55 30,40 30,25" class="holo-line"/>
        <line x1="50" y1="10" x2="50" y2="55" class="holo-line"/>
        <line x1="30" y1="25" x2="70" y2="25" class="holo-line"/>
        <line x1="30" y1="40" x2="70" y2="40" class="holo-line"/>
      `
    },
    EVEX: {
      label: "EVEX · TRANSPORT",
      path: `
        <polyline points="15,32 30,22 70,22 85,32 70,42 30,42 15,32" class="holo-line"/>
        <circle cx="35" cy="18" r="6" class="holo-line"/>
        <circle cx="65" cy="18" r="6" class="holo-line"/>
        <line x1="35" y1="24" x2="35" y2="32" class="holo-line"/>
        <line x1="65" y1="24" x2="65" y2="32" class="holo-line"/>
        <line x1="50" y1="22" x2="50" y2="42" class="holo-line"/>
      `
    },
    IRDM: {
      label: "IRDM · COMM RELAY",
      path: `
        <ellipse cx="50" cy="30" rx="25" ry="15" class="holo-line"/>
        <line x1="50" y1="15" x2="50" y2="5" class="holo-line"/>
        <circle cx="50" cy="5" r="3" class="holo-line"/>
        <line x1="25" y1="30" x2="15" y2="30" class="holo-line"/>
        <line x1="75" y1="30" x2="85" y2="30" class="holo-line"/>
      `
    },
    HON: {
      label: "HON · INDUSTRIAL",
      path: `
        <rect x="25" y="15" width="50" height="30" rx="3" class="holo-line"/>
        <line x1="40" y1="15" x2="40" y2="45" class="holo-line"/>
        <line x1="60" y1="15" x2="60" y2="45" class="holo-line"/>
        <circle cx="32" cy="30" r="4" class="holo-line"/>
        <circle cx="68" cy="30" r="4" class="holo-line"/>
      `
    },
    ATI: {
      label: "ATI · FORGE MATRIX",
      path: `
        <polygon points="50,10 75,25 75,40 50,55 25,40 25,25" class="holo-line"/>
        <polygon points="50,18 62,26 62,34 50,42 38,34 38,26" class="holo-line"/>
        <line x1="50" y1="10" x2="50" y2="18" class="holo-line"/>
        <line x1="50" y1="42" x2="50" y2="55" class="holo-line"/>
      `
    },
    CACI: {
      label: "CACI · SIGINT NODE",
      path: `
        <rect x="30" y="20" width="40" height="25" rx="2" class="holo-line"/>
        <line x1="50" y1="10" x2="50" y2="20" class="holo-line"/>
        <circle cx="50" cy="8" r="3" class="holo-line"/>
        <line x1="35" y1="45" x2="30" y2="52" class="holo-line"/>
        <line x1="65" y1="45" x2="70" y2="52" class="holo-line"/>
        <line x1="40" y1="32" x2="60" y2="32" class="holo-line"/>
      `
    },
    COHR: {
      label: "COHR · LASER ARRAY",
      path: `
        <rect x="35" y="22" width="30" height="16" rx="2" class="holo-line"/>
        <line x1="20" y1="30" x2="35" y2="30" class="holo-line"/>
        <line x1="65" y1="30" x2="80" y2="30" class="holo-line"/>
        <polygon points="10,26 20,30 10,34" class="holo-line"/>
        <polygon points="90,26 80,30 90,34" class="holo-line"/>
      `
    },
    GE: {
      label: "GE · AEROSPACE",
      path: `
        <polyline points="20,35 35,20 65,20 80,35 65,50 35,50 20,35" class="holo-line"/>
        <circle cx="50" cy="35" r="8" class="holo-line"/>
        <line x1="50" y1="27" x2="50" y2="20" class="holo-line"/>
        <line x1="35" y1="35" x2="20" y2="35" class="holo-line"/>
        <line x1="65" y1="35" x2="80" y2="35" class="holo-line"/>
      `
    },
    LHX: {
      label: "LHX · HELIX UAV",
      path: `
        <ellipse cx="50" cy="30" rx="18" ry="10" class="holo-line"/>
        <line x1="32" y1="30" x2="15" y2="20" class="holo-line"/>
        <line x1="68" y1="30" x2="85" y2="20" class="holo-line"/>
        <line x1="32" y1="30" x2="15" y2="40" class="holo-line"/>
        <line x1="68" y1="30" x2="85" y2="40" class="holo-line"/>
        <circle cx="50" cy="30" r="4" class="holo-line"/>
      `
    },
    RTX: {
      label: "RTX · DEFENSE SYS",
      path: `
        <polyline points="15,30 30,15 70,15 85,30 70,45 30,45 15,30" class="holo-line"/>
        <line x1="30" y1="15" x2="30" y2="45" class="holo-line"/>
        <line x1="70" y1="15" x2="70" y2="45" class="holo-line"/>
        <circle cx="50" cy="30" r="6" class="holo-line"/>
        <line x1="44" y1="30" x2="56" y2="30" class="holo-line"/>
        <line x1="50" y1="24" x2="50" y2="36" class="holo-line"/>
      `
    },
    KTOS: {
      label: "KTOS · STRIKE DRONE",
      path: `
        <polyline points="10,30 40,15 50,20 60,15 90,30 60,45 50,40 40,45 10,30" class="holo-line"/>
        <circle cx="50" cy="30" r="5" class="holo-line"/>
        <line x1="50" y1="25" x2="50" y2="15" class="holo-line"/>
        <line x1="10" y1="30" x2="25" y2="30" class="holo-line"/>
        <line x1="75" y1="30" x2="90" y2="30" class="holo-line"/>
      `
    },
    LOAR: {
      label: "LOAR · CARGO HAULER",
      path: `
        <rect x="20" y="18" width="60" height="24" rx="4" class="holo-line"/>
        <line x1="35" y1="18" x2="35" y2="42" class="holo-line"/>
        <line x1="50" y1="18" x2="50" y2="42" class="holo-line"/>
        <line x1="65" y1="18" x2="65" y2="42" class="holo-line"/>
        <circle cx="30" cy="50" r="4" class="holo-line"/>
        <circle cx="70" cy="50" r="4" class="holo-line"/>
      `
    },
    MP: {
      label: "MP · RARE ELEMENT",
      path: `
        <polygon points="50,5 65,15 65,35 50,45 35,35 35,15" class="holo-line"/>
        <polygon points="50,15 58,20 58,30 50,35 42,30 42,20" class="holo-line"/>
        <line x1="35" y1="25" x2="20" y2="25" class="holo-line"/>
        <line x1="65" y1="25" x2="80" y2="25" class="holo-line"/>
        <line x1="50" y1="45" x2="50" y2="55" class="holo-line"/>
      `
    },
    RDW: {
      label: "RDW · RECON SAT",
      path: `
        <ellipse cx="50" cy="30" rx="20" ry="12" class="holo-line"/>
        <line x1="30" y1="30" x2="15" y2="20" class="holo-line"/>
        <line x1="70" y1="30" x2="85" y2="20" class="holo-line"/>
        <rect x="12" y="15" width="8" height="12" rx="1" class="holo-line"/>
        <rect x="80" y="15" width="8" height="12" rx="1" class="holo-line"/>
        <circle cx="50" cy="30" r="4" class="holo-line"/>
      `
    },
    PL: {
      label: "PL · PLANET LABS",
      path: `
        <rect x="30" y="20" width="40" height="20" rx="3" class="holo-line"/>
        <line x1="25" y1="25" x2="10" y2="18" class="holo-line"/>
        <line x1="25" y1="35" x2="10" y2="42" class="holo-line"/>
        <line x1="75" y1="25" x2="90" y2="18" class="holo-line"/>
        <line x1="75" y1="35" x2="90" y2="42" class="holo-line"/>
        <circle cx="50" cy="30" r="6" class="holo-line"/>
      `
    }
  };

  // Update holographic ship display for selected ticker
  function updateHoloForTicker(ticker) {
    const svg = document.getElementById('holo-ship-svg');
    const labelEl = document.getElementById('holo-ticker-label');
    if (!svg || !labelEl) return;

    const ship = HOLO_SHIPS[ticker] || HOLO_SHIPS['RKLB'];
    labelEl.textContent = ship.label;
    svg.innerHTML = ship.path;

    svg.style.opacity = '0.6';
    requestAnimationFrame(() => {
      svg.style.transition = 'opacity 0.3s ease';
      svg.style.opacity = '1';
    });
  }

  // Hook into ticker selection to update holo ship
  function initHoloShipHook() {
    const originalSelectTicker = window.selectTicker;
    if (typeof originalSelectTicker === 'function') {
      window.selectTicker = function(ticker) {
        updateHoloForTicker(ticker);
        return originalSelectTicker.apply(this, arguments);
      };
    }
  }

  // Auto-init on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHoloShipHook);
  } else {
    initHoloShipHook();
  }

  // Expose globally
  window.HOLO_SHIPS = HOLO_SHIPS;
  window.updateHoloForTicker = updateHoloForTicker;
})();
