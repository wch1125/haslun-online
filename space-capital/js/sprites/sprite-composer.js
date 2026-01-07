/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SPACE CAPITAL - Sprite Composer
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Composes ship sprites with modular upgrade parts.
 * Handles layering, anchoring, mirroring, and effects.
 * Now includes hull color overlay support for livery system.
 * 
 * Uses offscreen canvas for pixel-art safe rendering.
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { PART_DEFS, PART_ANCHORS, STATUS_OVERLAYS } from '../../data/sprite-upgrades.js';

// Image cache to avoid reloading
const imageCache = new Map();

// Composed sprite cache
const composedCache = new Map();

/**
 * Load an image with caching
 */
async function loadImage(src) {
  if (!src) return null;
  
  // Check cache
  if (imageCache.has(src)) {
    const cached = imageCache.get(src);
    // If it's a promise, await it; if it's an image, return it
    if (cached instanceof Promise) {
      return cached;
    }
    return cached;
  }
  
  // Create loading promise
  const loadPromise = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      imageCache.set(src, img); // Replace promise with image
      resolve(img);
    };
    
    img.onerror = () => {
      console.warn(`[SpriteComposer] Failed to load: ${src}`);
      imageCache.delete(src);
      resolve(null); // Resolve with null instead of rejecting
    };
    
    img.src = src;
  });
  
  imageCache.set(src, loadPromise);
  return loadPromise;
}

/**
 * Get anchor point, with fallback to center
 */
function getAnchor(anchorName, baseWidth, baseHeight) {
  const anchor = PART_ANCHORS[anchorName];
  if (anchor) return anchor;
  
  // Fallback to center
  return { x: baseWidth / 2, y: baseHeight / 2 };
}

/**
 * Draw a single part onto the canvas
 */
async function drawPart(ctx, partId, tier, baseWidth, baseHeight, options = {}) {
  const def = PART_DEFS[partId];
  if (!def) return;
  
  const partImg = await loadImage(def.src);
  if (!partImg) {
    // If part image doesn't exist, draw a procedural placeholder
    drawProceduralPart(ctx, partId, tier, baseWidth, baseHeight);
    return;
  }
  
  const anchor = getAnchor(def.anchor, baseWidth, baseHeight);
  const scale = tier.scale || 1;
  const glow = tier.glow || 0;
  
  // Calculate position (anchor point on base where part attaches)
  const x = Math.round(anchor.x - (def.centered ? partImg.width * scale / 2 : 0));
  const y = Math.round(anchor.y - (def.centered ? partImg.height * scale / 2 : 0));
  
  ctx.save();
  
  // Apply glow effect for engines, shields, etc.
  if (glow > 0) {
    ctx.shadowColor = options.glowColor || '#33ff99';
    ctx.shadowBlur = glow * 15;
    ctx.globalAlpha = 0.5 + glow * 0.5;
  }
  
  // Draw the part
  if (scale !== 1) {
    ctx.drawImage(partImg, x, y, partImg.width * scale, partImg.height * scale);
  } else {
    ctx.drawImage(partImg, x, y);
  }
  
  // Mirror for wings/weapons if specified
  if (def.mirror) {
    ctx.save();
    ctx.translate(baseWidth, 0);
    ctx.scale(-1, 1);
    
    const mirrorX = baseWidth - x - partImg.width * scale;
    if (scale !== 1) {
      ctx.drawImage(partImg, mirrorX, y, partImg.width * scale, partImg.height * scale);
    } else {
      ctx.drawImage(partImg, mirrorX, y);
    }
    ctx.restore();
  }
  
  ctx.restore();
}

/**
 * Draw a procedural placeholder when part images don't exist yet
 */
function drawProceduralPart(ctx, partId, tier, baseWidth, baseHeight) {
  const anchor = getAnchor(PART_DEFS[partId]?.anchor || 'engine', baseWidth, baseHeight);
  const glow = tier.glow || 0;
  
  ctx.save();
  
  // Determine part type and draw appropriate shape
  if (partId.startsWith('thruster') || partId.startsWith('engine')) {
    // Engine: glowing exhaust
    const intensity = glow || 0.5;
    const gradient = ctx.createRadialGradient(
      anchor.x, anchor.y + 10, 0,
      anchor.x, anchor.y + 10, 12 * intensity
    );
    gradient.addColorStop(0, `rgba(255, ${150 + intensity * 100}, 50, ${intensity})`);
    gradient.addColorStop(0.5, `rgba(255, ${100 + intensity * 50}, 0, ${intensity * 0.6})`);
    gradient.addColorStop(1, 'rgba(255, 50, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(anchor.x - 15, anchor.y, 30, 20);
    
  } else if (partId.startsWith('wing')) {
    // Wings: angular shapes
    const size = partId.includes('large') ? 16 : partId.includes('mid') ? 12 : 8;
    
    ctx.fillStyle = 'rgba(100, 150, 200, 0.6)';
    ctx.beginPath();
    ctx.moveTo(anchor.x, anchor.y);
    ctx.lineTo(anchor.x - size * 2, anchor.y + size);
    ctx.lineTo(anchor.x - size, anchor.y + size / 2);
    ctx.closePath();
    ctx.fill();
    
    // Mirror
    ctx.beginPath();
    ctx.moveTo(baseWidth - anchor.x, anchor.y);
    ctx.lineTo(baseWidth - anchor.x + size * 2, anchor.y + size);
    ctx.lineTo(baseWidth - anchor.x + size, anchor.y + size / 2);
    ctx.closePath();
    ctx.fill();
    
  } else if (partId.startsWith('plate') || partId.startsWith('armor')) {
    // Armor: angular overlay
    ctx.fillStyle = 'rgba(80, 80, 100, 0.4)';
    ctx.fillRect(anchor.x - 8, anchor.y - 4, 16, 12);
    
  } else if (partId.startsWith('antenna')) {
    // Antenna: vertical line with tip
    ctx.strokeStyle = '#88aacc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(anchor.x, anchor.y + 8);
    ctx.lineTo(anchor.x, anchor.y);
    ctx.stroke();
    
    ctx.fillStyle = '#33ff99';
    ctx.beginPath();
    ctx.arc(anchor.x, anchor.y, 2, 0, Math.PI * 2);
    ctx.fill();
    
  } else if (partId.startsWith('weapon')) {
    // Weapons: small rectangles
    ctx.fillStyle = 'rgba(200, 100, 100, 0.6)';
    ctx.fillRect(anchor.x - 2, anchor.y - 4, 4, 8);
    ctx.fillRect(baseWidth - anchor.x - 2, anchor.y - 4, 4, 8);
    
  } else if (partId.startsWith('shield')) {
    // Shield: glowing oval
    const gradient = ctx.createRadialGradient(
      baseWidth / 2, baseHeight / 2, 0,
      baseWidth / 2, baseHeight / 2, baseWidth * 0.6
    );
    gradient.addColorStop(0, 'rgba(51, 255, 153, 0)');
    gradient.addColorStop(0.7, 'rgba(51, 255, 153, 0.1)');
    gradient.addColorStop(1, 'rgba(51, 255, 153, 0.3)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(baseWidth / 2, baseHeight / 2, baseWidth * 0.55, baseHeight * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
}

/**
 * Apply status overlays (damage, boost, alert)
 */
async function applyStatusOverlays(ctx, stats, baseWidth, baseHeight) {
  for (const [status, config] of Object.entries(STATUS_OVERLAYS)) {
    if (config.condition && config.condition(stats)) {
      // For now, draw procedural overlays
      drawStatusOverlay(ctx, status, config, baseWidth, baseHeight);
    }
  }
}

/**
 * Draw procedural status overlay
 */
function drawStatusOverlay(ctx, status, config, baseWidth, baseHeight) {
  ctx.save();
  ctx.globalAlpha = config.opacity || 0.3;
  
  if (status === 'damage') {
    // Red flickering damage effect
    ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
    // Random "sparks"
    for (let i = 0; i < 5; i++) {
      const x = Math.random() * baseWidth;
      const y = Math.random() * baseHeight;
      ctx.fillRect(x, y, 2, 2);
    }
  } else if (status === 'boost') {
    // Green boost glow
    const gradient = ctx.createRadialGradient(
      baseWidth / 2, baseHeight, 0,
      baseWidth / 2, baseHeight, baseHeight
    );
    gradient.addColorStop(0, 'rgba(51, 255, 153, 0.4)');
    gradient.addColorStop(1, 'rgba(51, 255, 153, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, baseWidth, baseHeight);
  } else if (status === 'alert') {
    // Yellow warning pulse
    ctx.strokeStyle = 'rgba(255, 200, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, baseWidth - 4, baseHeight - 4);
  }
  
  ctx.restore();
}

/**
 * Main composition function
 * 
 * @param {Object} options
 * @param {string} options.baseSrc - Path to base ship sprite
 * @param {Object} options.upgrades - Upgrade selections from mapper
 * @param {Object} options.stats - Raw stats (for status overlays)
 * @param {Object} options.options - Additional rendering options
 * 
 * @returns {Promise<{canvas, key, width, height}>}
 */
export async function composeSprite({ baseSrc, upgrades, stats = {}, options = {} }) {
  // Generate cache key
  const key = generateCacheKey(baseSrc, upgrades);
  
  // Check cache (unless force refresh)
  if (!options.forceRefresh && composedCache.has(key)) {
    return composedCache.get(key);
  }
  
  // Load base image
  const baseImg = await loadImage(baseSrc);
  
  // Determine canvas size
  const width = baseImg?.width || 64;
  const height = baseImg?.height || 64;
  
  // Create offscreen canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  // Pixel art mode - no smoothing
  ctx.imageSmoothingEnabled = false;
  
  // Build render layers sorted by z-index
  const layers = [];
  
  for (const [slot, tier] of Object.entries(upgrades)) {
    if (!tier?.id) continue;
    
    const def = PART_DEFS[tier.id];
    if (!def) continue;
    
    layers.push({
      slot,
      tier,
      partId: tier.id,
      z: def.z ?? 2
    });
  }
  
  // Sort by z-index
  layers.sort((a, b) => a.z - b.z);
  
  // Draw layers behind hull (z <= 1)
  for (const layer of layers.filter(l => l.z <= 1)) {
    await drawPart(ctx, layer.partId, layer.tier, width, height, options);
  }
  
  // Draw base hull (z = 2)
  if (baseImg) {
    ctx.drawImage(baseImg, 0, 0);
  } else {
    // No base image - draw placeholder hull
    drawPlaceholderHull(ctx, width, height);
  }
  
  // Draw layers on top of hull (z > 1, excluding shield at z=5)
  for (const layer of layers.filter(l => l.z > 1 && l.z < 5)) {
    await drawPart(ctx, layer.partId, layer.tier, width, height, options);
  }
  
  // Apply status overlays
  if (options.includeStatus) {
    await applyStatusOverlays(ctx, stats, width, height);
  }
  
  // Draw shield last (z = 5)
  for (const layer of layers.filter(l => l.z >= 5)) {
    await drawPart(ctx, layer.partId, layer.tier, width, height, options);
  }
  
  // Create result object
  const result = {
    canvas,
    key,
    width,
    height,
    dataUrl: null // Lazy-generated
  };
  
  // Cache it
  composedCache.set(key, result);
  
  return result;
}

/**
 * Draw a placeholder hull when base image doesn't exist
 */
function drawPlaceholderHull(ctx, width, height) {
  const cx = width / 2;
  const cy = height / 2;
  
  ctx.fillStyle = '#334455';
  ctx.strokeStyle = '#556677';
  ctx.lineWidth = 1;
  
  // Simple ship shape
  ctx.beginPath();
  ctx.moveTo(cx, cy - height * 0.4);
  ctx.lineTo(cx + width * 0.3, cy + height * 0.3);
  ctx.lineTo(cx + width * 0.1, cy + height * 0.35);
  ctx.lineTo(cx, cy + height * 0.25);
  ctx.lineTo(cx - width * 0.1, cy + height * 0.35);
  ctx.lineTo(cx - width * 0.3, cy + height * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  
  // Cockpit
  ctx.fillStyle = '#223344';
  ctx.beginPath();
  ctx.ellipse(cx, cy - height * 0.1, width * 0.1, height * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Generate cache key from base + upgrades
 */
function generateCacheKey(baseSrc, upgrades) {
  const parts = Object.entries(upgrades)
    .filter(([, tier]) => tier?.id)
    .map(([slot, tier]) => `${slot}:${tier.id}`)
    .sort()
    .join(',');
  
  return `${baseSrc}|${parts}`;
}

/**
 * Get data URL from composed sprite (lazy generation)
 */
export function getDataUrl(result) {
  if (!result.dataUrl) {
    result.dataUrl = result.canvas.toDataURL('image/png');
  }
  return result.dataUrl;
}

/**
 * Clear composed sprite cache
 */
export function clearCache() {
  composedCache.clear();
}

/**
 * Clear specific cache entry
 */
export function clearCacheEntry(key) {
  composedCache.delete(key);
}

/**
 * Apply hull color overlay to a canvas
 * This is the key function that was missing - allows liveries to tint sprites
 * 
 * @param {HTMLCanvasElement} canvas - The sprite canvas
 * @param {string} hullColor - Hex color for hull tint
 * @param {number} intensity - Blend intensity (0-1, default 0.4)
 * @returns {HTMLCanvasElement} - The modified canvas
 */
export function applyHullColor(canvas, hullColor, intensity = 0.4) {
  if (!canvas || !hullColor) return canvas;
  
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  
  ctx.save();
  
  // Use source-atop to only color non-transparent pixels
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = intensity;
  ctx.fillStyle = hullColor;
  ctx.fillRect(0, 0, width, height);
  
  ctx.restore();
  
  return canvas;
}

/**
 * Apply full livery to a sprite
 * Handles multiple color zones based on ship class
 * 
 * @param {HTMLCanvasElement} canvas - The sprite canvas  
 * @param {Object} livery - Livery object with palette
 * @param {string} shipClass - Ship class for zone mapping
 * @returns {HTMLCanvasElement} - The modified canvas
 */
export function applyLivery(canvas, livery, shipClass = 'default') {
  if (!canvas || !livery?.palette?.generated) return canvas;
  
  // Get the primary hull color from livery
  const hullRole = window.LiverySystem?.CLASS_APPLICATION_DEFAULTS?.[shipClass]?.hull || 'primary';
  const hullColorEntry = livery.palette.generated.find(c => c.role === hullRole);
  
  if (hullColorEntry?.hex) {
    applyHullColor(canvas, hullColorEntry.hex, 0.45);
  }
  
  return canvas;
}

/**
 * Compose sprite with livery support
 * Wrapper around composeSprite that automatically applies assigned livery
 * 
 * @param {Object} options - Same as composeSprite, plus ticker for livery lookup
 * @returns {Promise<{canvas, key, width, height}>}
 */
export async function composeSpriteWithLivery(options) {
  const result = await composeSprite(options);
  
  // Check if ticker has an assigned livery
  if (options.ticker && window.LiverySystem) {
    const livery = window.LiverySystem.getLiveryForTicker(options.ticker);
    if (livery) {
      applyLivery(result.canvas, livery, options.shipClass);
      // Invalidate dataUrl since canvas changed
      result.dataUrl = null;
    }
  }
  
  return result;
}

/**
 * Trigger a redraw of the active ship's sprite with current livery
 * This is what should be called when hull colors change
 */
export function redrawActiveShip(ticker) {
  // Dispatch event for UI systems to handle
  document.dispatchEvent(new CustomEvent('sprite:redraw', {
    detail: { ticker }
  }));
  
  // Clear cache for this ticker's sprites
  composedCache.forEach((value, key) => {
    if (key.includes(ticker)) {
      composedCache.delete(key);
    }
  });
  
  console.log(`[SpriteComposer] Triggered redraw for ${ticker}`);
}

/**
 * Preload images for a set of tickers
 */
export async function preloadSprites(tickers) {
  const promises = [];
  
  for (const ticker of tickers) {
    // Preload base sprites
    promises.push(loadImage(`assets/ships/base/${ticker}.png`));
    promises.push(loadImage(`assets/ships/animated/${ticker}/${ticker}_base.png`));
  }
  
  // Preload common parts
  for (const [partId, def] of Object.entries(PART_DEFS)) {
    if (def.src) {
      promises.push(loadImage(def.src));
    }
  }
  
  await Promise.all(promises);
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    images: imageCache.size,
    composed: composedCache.size
  };
}

export default {
  composeSprite,
  composeSpriteWithLivery,
  getDataUrl,
  clearCache,
  clearCacheEntry,
  preloadSprites,
  getCacheStats,
  loadImage,
  applyHullColor,
  applyLivery,
  redrawActiveShip
};
