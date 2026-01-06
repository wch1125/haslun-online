/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ACCESSIBILITY & KEYBOARD SHORTCUTS MODULE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Adds:
 * - Keyboard shortcuts overlay (press ?)
 * - Dynamic market status (real-time open/closed/pre-market)
 * - Skip links for keyboard navigation
 * - Focus trap for modals
 * - Data freshness indicator
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

window.ParallaxA11y = (function() {
  'use strict';
  
  // ═══════════════════════════════════════════════════════════════════════════
  // KEYBOARD SHORTCUTS REGISTRY
  // ═══════════════════════════════════════════════════════════════════════════
  
  const SHORTCUTS = {
    global: [
      { key: '?', desc: 'Show keyboard shortcuts' },
      { key: 'Esc', desc: 'Close dialogs / panels' },
      { key: '1', desc: 'Go to Hangar' },
      { key: '2', desc: 'Go to Command' },
      { key: '3', desc: 'Go to Arcade' },
      { key: '4', desc: 'Go to Data' },
      { key: 'M', desc: 'Toggle background music' },
      { key: 'S', desc: 'Toggle sound effects' },
    ],
    hangar: [
      { key: '←/→', desc: 'Navigate ships' },
      { key: 'Enter', desc: 'View ship details' },
      { key: 'Space', desc: 'Select ship' },
    ],
    data: [
      { key: '←/→', desc: 'Change time range' },
      { key: 'R', desc: 'Refresh chart' },
    ],
    arcade: [
      { key: 'Space', desc: 'Start / Action' },
      { key: '←/→', desc: 'Move left/right' },
      { key: '↑/↓', desc: 'Move up/down' },
    ]
  };
  
  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════
  
  let shortcutsOverlay = null;
  let isShortcutsVisible = false;
  let marketStatusInterval = null;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // MARKET STATUS
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Determine market status based on current time
   * US Eastern Time market hours: 9:30 AM - 4:00 PM ET
   * Pre-market: 4:00 AM - 9:30 AM ET
   * After-hours: 4:00 PM - 8:00 PM ET
   */
  function getMarketStatus() {
    const now = new Date();
    
    // Convert to ET (approximate - doesn't handle DST perfectly but good enough)
    const etOffset = -5; // EST
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const et = new Date(utc + (3600000 * etOffset));
    
    const day = et.getDay();
    const hours = et.getHours();
    const minutes = et.getMinutes();
    const time = hours * 60 + minutes;
    
    // Weekend
    if (day === 0 || day === 6) {
      return {
        status: 'closed',
        label: 'WEEKEND',
        color: 'amber',
        tooltip: 'Markets reopen Monday 9:30 AM ET'
      };
    }
    
    // Pre-market: 4:00 AM - 9:30 AM ET
    if (time >= 240 && time < 570) {
      return {
        status: 'premarket',
        label: 'PRE-MARKET',
        color: 'amber',
        tooltip: 'Pre-market trading active. Regular session opens 9:30 AM ET'
      };
    }
    
    // Regular hours: 9:30 AM - 4:00 PM ET
    if (time >= 570 && time < 960) {
      return {
        status: 'open',
        label: 'MARKET OPEN',
        color: 'green',
        tooltip: 'Regular trading session active'
      };
    }
    
    // After-hours: 4:00 PM - 8:00 PM ET
    if (time >= 960 && time < 1200) {
      return {
        status: 'afterhours',
        label: 'AFTER-HOURS',
        color: 'amber',
        tooltip: 'Extended hours trading. Volume may be lower.'
      };
    }
    
    // Closed
    return {
      status: 'closed',
      label: 'MKT CLOSED',
      color: 'amber',
      tooltip: 'Pre-market opens 4:00 AM ET'
    };
  }
  
  function updateMarketStatus() {
    const status = getMarketStatus();
    
    // Update header indicator
    const headerIndicator = document.querySelector('.header-right .status-indicator');
    if (headerIndicator) {
      const dot = headerIndicator.querySelector('.status-dot');
      const text = headerIndicator.querySelector('.status-text');
      
      if (dot) {
        dot.className = `status-dot ${status.color}`;
      }
      if (text) {
        text.textContent = status.label === 'MARKET OPEN' ? 'Market Open' : 
                          status.label === 'PRE-MARKET' ? 'Pre-Market' :
                          status.label === 'AFTER-HOURS' ? 'After Hours' :
                          status.label === 'WEEKEND' ? 'Weekend' : 'Market Closed';
      }
      headerIndicator.title = status.tooltip;
    }
    
    // Update status strip indicator
    const stripIndicator = document.querySelector('.status-strip .status-item:nth-child(3)');
    if (stripIndicator) {
      const dot = stripIndicator.querySelector('.dot');
      const value = stripIndicator.querySelector('.value');
      
      if (dot) {
        dot.className = `dot ${status.color}`;
      }
      if (value) {
        value.textContent = status.label;
      }
      stripIndicator.title = status.tooltip;
    }
    
    // Set body attribute for CSS styling hooks
    document.body.setAttribute('data-market-status', status.status);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // DATA FRESHNESS
  // ═══════════════════════════════════════════════════════════════════════════
  
  function formatTimeSince(dateString) {
    if (!dateString) return 'Unknown';
    
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
  }
  
  async function updateDataFreshness() {
    try {
      const res = await fetch('data/stats.json');
      const data = await res.json();
      
      if (data.updated) {
        const freshness = formatTimeSince(data.updated);
        
        // Add or update freshness indicator
        let indicator = document.getElementById('data-freshness');
        if (!indicator) {
          const strip = document.querySelector('.status-strip');
          if (strip) {
            indicator = document.createElement('div');
            indicator.id = 'data-freshness';
            indicator.className = 'status-item';
            indicator.innerHTML = `<span class="value" title="Last data update">📡 ${freshness}</span>`;
            strip.insertBefore(indicator, strip.querySelector('.status-item:nth-child(4)'));
          }
        } else {
          const value = indicator.querySelector('.value');
          if (value) {
            value.textContent = `📡 ${freshness}`;
            value.title = `Data updated: ${new Date(data.updated).toLocaleString()}`;
          }
        }
      }
    } catch (e) {
      // Silently fail
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // KEYBOARD SHORTCUTS OVERLAY
  // ═══════════════════════════════════════════════════════════════════════════
  
  function createShortcutsOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'shortcuts-overlay';
    overlay.className = 'shortcuts-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Keyboard shortcuts');
    
    overlay.innerHTML = `
      <div class="shortcuts-backdrop" onclick="ParallaxA11y.hideShortcuts()"></div>
      <div class="shortcuts-panel">
        <div class="shortcuts-header">
          <h2 class="shortcuts-title">⌨ KEYBOARD SHORTCUTS</h2>
          <button class="shortcuts-close" onclick="ParallaxA11y.hideShortcuts()" aria-label="Close">×</button>
        </div>
        <div class="shortcuts-content">
          ${renderShortcutSection('GLOBAL', SHORTCUTS.global)}
          ${renderShortcutSection('HANGAR', SHORTCUTS.hangar)}
          ${renderShortcutSection('DATA VIEW', SHORTCUTS.data)}
          ${renderShortcutSection('ARCADE', SHORTCUTS.arcade)}
        </div>
        <div class="shortcuts-footer">
          <span class="shortcuts-hint">Press <kbd>?</kbd> or <kbd>Esc</kbd> to close</span>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    return overlay;
  }
  
  function renderShortcutSection(title, shortcuts) {
    return `
      <div class="shortcuts-section">
        <h3 class="shortcuts-section-title">${title}</h3>
        <div class="shortcuts-list">
          ${shortcuts.map(s => `
            <div class="shortcut-item">
              <kbd class="shortcut-key">${s.key}</kbd>
              <span class="shortcut-desc">${s.desc}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  function showShortcuts() {
    if (!shortcutsOverlay) {
      shortcutsOverlay = createShortcutsOverlay();
    }
    
    shortcutsOverlay.classList.add('visible');
    isShortcutsVisible = true;
    
    // Focus the close button
    setTimeout(() => {
      const closeBtn = shortcutsOverlay.querySelector('.shortcuts-close');
      if (closeBtn) closeBtn.focus();
    }, 50);
    
    // Play sound if enabled
    if (window.MechSFX && window.UI_SOUND_ENABLED) {
      MechSFX.synthStab(660, 0.05);
    }
  }
  
  function hideShortcuts() {
    if (shortcutsOverlay) {
      shortcutsOverlay.classList.remove('visible');
      isShortcutsVisible = false;
      
      if (window.MechSFX && window.UI_SOUND_ENABLED) {
        MechSFX.synthStab(440, 0.05);
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SKIP LINKS
  // ═══════════════════════════════════════════════════════════════════════════
  
  function createSkipLinks() {
    const skipNav = document.createElement('nav');
    skipNav.className = 'skip-links';
    skipNav.setAttribute('aria-label', 'Skip links');
    
    skipNav.innerHTML = `
      <a href="#main-content" class="skip-link">Skip to main content</a>
      <a href="#mobile-bottom-nav" class="skip-link">Skip to navigation</a>
    `;
    
    document.body.insertBefore(skipNav, document.body.firstChild);
    
    // Add ID to main content area if missing
    const main = document.querySelector('main') || document.querySelector('.main-content');
    if (main && !main.id) {
      main.id = 'main-content';
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // GLOBAL KEYBOARD HANDLER
  // ═══════════════════════════════════════════════════════════════════════════
  
  function handleGlobalKeydown(e) {
    // Ignore if typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
      return;
    }
    
    // ? - Show shortcuts
    if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      if (isShortcutsVisible) {
        hideShortcuts();
      } else {
        showShortcuts();
      }
      return;
    }
    
    // Esc - Close shortcuts or other overlays
    if (e.key === 'Escape') {
      if (isShortcutsVisible) {
        hideShortcuts();
        return;
      }
    }
    
    // Number keys for tab navigation
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      switch (e.key) {
        case '1':
          if (typeof switchTab === 'function') switchTab('hangar');
          break;
        case '2':
          if (typeof switchTab === 'function') switchTab('positions');
          break;
        case '3':
          if (typeof switchTab === 'function') switchTab('arcade');
          break;
        case '4':
          if (typeof switchTab === 'function') switchTab('chart');
          break;
        case 'm':
        case 'M':
          // Toggle BGM
          const bgmToggle = document.getElementById('bgm-toggle');
          if (bgmToggle) {
            bgmToggle.checked = !bgmToggle.checked;
            bgmToggle.dispatchEvent(new Event('change'));
          }
          break;
        case 's':
        case 'S':
          // Only if not in an overlay
          if (!document.querySelector('.ship-brief-dialog.visible') && 
              !document.querySelector('.pipboy-overlay.visible')) {
            const sfxToggle = document.getElementById('sfx-toggle');
            if (sfxToggle) {
              sfxToggle.checked = !sfxToggle.checked;
              sfxToggle.dispatchEvent(new Event('change'));
            }
          }
          break;
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // REDUCED MOTION
  // ═══════════════════════════════════════════════════════════════════════════
  
  function setupReducedMotion() {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    function handleChange(e) {
      if (e.matches) {
        document.body.classList.add('reduced-motion');
        // Set performance mode to battery if reduced motion is preferred
        if (typeof setPerformanceMode === 'function') {
          setPerformanceMode('battery');
        }
      } else {
        document.body.classList.remove('reduced-motion');
      }
    }
    
    mediaQuery.addEventListener('change', handleChange);
    handleChange(mediaQuery);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // FOCUS VISIBILITY
  // ═══════════════════════════════════════════════════════════════════════════
  
  function setupFocusVisibility() {
    // Add focus-visible class on keyboard navigation
    document.body.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        document.body.classList.add('keyboard-nav');
      }
    });
    
    document.body.addEventListener('mousedown', () => {
      document.body.classList.remove('keyboard-nav');
    });
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════
  
  function init() {
    // Create skip links
    createSkipLinks();
    
    // Set up keyboard handler
    document.addEventListener('keydown', handleGlobalKeydown);
    
    // Start market status updates
    updateMarketStatus();
    marketStatusInterval = setInterval(updateMarketStatus, 60000); // Update every minute
    
    // Update data freshness
    updateDataFreshness();
    
    // Set up reduced motion
    setupReducedMotion();
    
    // Set up focus visibility
    setupFocusVisibility();
    
    console.log('[A11y] Accessibility enhancements initialized');
  }
  
  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════
  
  return {
    showShortcuts,
    hideShortcuts,
    updateMarketStatus,
    updateDataFreshness,
    getMarketStatus,
    SHORTCUTS
  };
  
})();
