/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PARALLAX - Ship Sprite Manager
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Main API for getting upgraded ship sprites.
 * Coordinates between upgrade mapper, sprite composer, and paint bay.
 * 
 * Usage:
 *   const sprite = await ShipSprites.getSprite('RKLB', stats);
 *   imgElement.src = sprite.src;
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { mapStatsToUpgrades, calculatePowerLevel, getUpgradeSummary, generateUpgradeKey, upgradesChanged } from './upgrade-mapper.js';
import { composeSprite, getDataUrl, clearCache, preloadSprites } from './sprite-composer.js';

// Store current upgrades for each ticker to detect changes
const tickerUpgrades = new Map();

// Store composed sprites
const spriteCache = new Map();

// Custom color overrides from Paint Bay
const colorOverrides = new Map();

/**
 * Configuration
 */
const CONFIG = {
  // Base sprite paths (in order of preference)
  basePaths: [
    (ticker) => `assets/ships/animated/${ticker}/${ticker}_base.png`,
    (ticker) => `assets/ships/base/${ticker}.png`,
    (ticker) => `assets/ships/static/${ticker}.png`,
    (ticker) => `assets/ships/${ticker}-flagship-ship.png`,
  ],
  
  // Fallback sprite
  fallbackSprite: 'assets/ships/Unclaimed-Drone-ship.png',
  
  // Auto-recompose when stats change significantly
  autoRecompose: true,
  
  // Include status overlays (damage, boost, etc.)
  includeStatus: true
};

/**
 * Find the base sprite path for a ticker
 */
async function findBasePath(ticker) {
  for (const pathFn of CONFIG.basePaths) {
    const path = pathFn(ticker);
    try {
      const response = await fetch(path, { method: 'HEAD' });
      if (response.ok) return path;
    } catch (e) {
      // Path doesn't exist, try next
    }
  }
  
  // Try loading directly (will use cache/placeholder if needed)
  return CONFIG.basePaths[0](ticker);
}

/**
 * Get an upgraded sprite for a ticker
 * 
 * @param {string} ticker - Stock ticker
 * @param {Object} stats - Ticker statistics
 * @param {Object} options - Additional options
 * @returns {Promise<{src, upgrades, powerLevel, summary, key}>}
 */
export async function getSprite(ticker, stats = {}, options = {}) {
  // Calculate upgrades from stats
  const upgrades = mapStatsToUpgrades(stats);
  const key = generateUpgradeKey(ticker, upgrades);
  
  // Check if we have a cached sprite and if upgrades haven't changed
  const oldUpgrades = tickerUpgrades.get(ticker);
  if (!options.forceRefresh && spriteCache.has(key) && !upgradesChanged(oldUpgrades, upgrades)) {
    return spriteCache.get(key);
  }
  
  // Store new upgrades
  tickerUpgrades.set(ticker, upgrades);
  
  // Find base sprite
  const baseSrc = options.baseSrc || await findBasePath(ticker);
  
  // Compose the sprite
  const composed = await composeSprite({
    baseSrc,
    upgrades,
    stats,
    options: {
      ...options,
      includeStatus: CONFIG.includeStatus,
      colorOverride: colorOverrides.get(ticker)
    }
  });
  
  // Build result
  const result = {
    src: getDataUrl(composed),
    canvas: composed.canvas,
    upgrades,
    powerLevel: calculatePowerLevel(upgrades),
    summary: getUpgradeSummary(upgrades),
    key,
    ticker,
    width: composed.width,
    height: composed.height
  };
  
  // Cache it
  spriteCache.set(key, result);
  
  return result;
}

/**
 * Get sprite as an Image element
 */
export async function getSpriteImage(ticker, stats = {}, options = {}) {
  const sprite = await getSprite(ticker, stats, options);
  
  const img = new Image();
  img.src = sprite.src;
  img.dataset.ticker = ticker;
  img.dataset.powerLevel = sprite.powerLevel;
  
  return new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
}

/**
 * Update a specific ticker's sprite in-place
 * Call this when stats change
 */
export async function updateSprite(ticker, stats, imgElement) {
  const sprite = await getSprite(ticker, stats, { forceRefresh: true });
  
  if (imgElement) {
    imgElement.src = sprite.src;
    imgElement.dataset.powerLevel = sprite.powerLevel;
  }
  
  return sprite;
}

/**
 * Apply custom colors from Paint Bay
 */
export function setColorOverride(ticker, colors) {
  colorOverrides.set(ticker, colors);
  
  // Clear cached sprites for this ticker
  for (const key of spriteCache.keys()) {
    if (key.startsWith(ticker)) {
      spriteCache.delete(key);
    }
  }
}

/**
 * Clear color override for a ticker
 */
export function clearColorOverride(ticker) {
  colorOverrides.delete(ticker);
  
  for (const key of spriteCache.keys()) {
    if (key.startsWith(ticker)) {
      spriteCache.delete(key);
    }
  }
}

/**
 * Get all sprites for a fleet
 */
export async function getFleetSprites(tickers, statsMap = {}) {
  const sprites = {};
  
  await Promise.all(tickers.map(async (ticker) => {
    const stats = statsMap[ticker] || {};
    sprites[ticker] = await getSprite(ticker, stats);
  }));
  
  return sprites;
}

/**
 * Preload sprites for a list of tickers
 */
export async function preload(tickers) {
  await preloadSprites(tickers);
}

/**
 * Get upgrade preview without composing
 * Useful for UI that just needs to show upgrade tier names
 */
export function previewUpgrades(stats) {
  return mapStatsToUpgrades(stats);
}

/**
 * Clear all caches
 */
export function clearAllCaches() {
  spriteCache.clear();
  tickerUpgrades.clear();
  clearCache();
}

/**
 * Listen for Paint Bay color changes
 */
function initPaintBayListener() {
  document.addEventListener('paintbay:apply', (e) => {
    const { ticker, colors, palette } = e.detail;
    if (ticker && colors) {
      setColorOverride(ticker, { colors, palette });
    }
  });
}

// Initialize on load
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPaintBayListener);
  } else {
    initPaintBayListener();
  }
}

// Export as module
export default {
  getSprite,
  getSpriteImage,
  updateSprite,
  setColorOverride,
  clearColorOverride,
  getFleetSprites,
  preload,
  previewUpgrades,
  clearAllCaches,
  CONFIG
};

// Also expose globally for non-module usage
if (typeof window !== 'undefined') {
  window.ShipSprites = {
    getSprite,
    getSpriteImage,
    updateSprite,
    setColorOverride,
    clearColorOverride,
    getFleetSprites,
    preload,
    previewUpgrades,
    clearAllCaches,
    CONFIG
  };
}
