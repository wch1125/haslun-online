/**
 * PARALLAX Pixel Icon System
 * Replaces emojis with retro 8-bit style SVG icons
 * All icons are 12x12 pixel art rendered as inline SVG
 */

window.PixelIcons = (function() {
  'use strict';
  
  // Icon definitions as pixel grids (1 = fill, 0 = empty)
  // Each icon is 12x12 for crisp rendering
  const PATTERNS = {
    // ★ Star (filled) - for heroes/elite
    star: [
      '000001000000',
      '000001000000',
      '000011100000',
      '000011100000',
      '111111111100',
      '011111111000',
      '001111110000',
      '001111110000',
      '011100111000',
      '011000011000',
      '010000001000',
      '000000000000'
    ],
    
    // ☆ Star (empty) - for difficulty unfilled
    starEmpty: [
      '000001000000',
      '000001000000',
      '000010100000',
      '000010100000',
      '111100011100',
      '010000001000',
      '001000010000',
      '001000010000',
      '010100101000',
      '010010010000',
      '010000001000',
      '000000000000'
    ],
    
    // 🎖️ Medal - for level up
    medal: [
      '001111110000',
      '011111111000',
      '001111110000',
      '000011100000',
      '000111110000',
      '001111111000',
      '001111111000',
      '001111111000',
      '001111111000',
      '000111110000',
      '000011100000',
      '000000000000'
    ],
    
    // 🏆 Trophy - for all missions complete
    trophy: [
      '011111111100',
      '011111111100',
      '111111111110',
      '111111111110',
      '011111111100',
      '001111111000',
      '000111110000',
      '000011100000',
      '000011100000',
      '000111110000',
      '001111111000',
      '000000000000'
    ],
    
    // ⚡ Lightning - for energy/comms/firepower
    lightning: [
      '000001110000',
      '000011100000',
      '000111000000',
      '001110000000',
      '011111110000',
      '000011100000',
      '000111000000',
      '001110000000',
      '011100000000',
      '111000000000',
      '110000000000',
      '000000000000'
    ],
    
    // 🛸 UFO - for invader attack
    ufo: [
      '000111110000',
      '001111111000',
      '011111111100',
      '111111111110',
      '111111111110',
      '011111111100',
      '001000001000',
      '010000000100',
      '000000000000',
      '000000000000',
      '000000000000',
      '000000000000'
    ],
    
    // 🚀 Rocket - for mission launch
    rocket: [
      '000011000000',
      '000111100000',
      '000111100000',
      '001111110000',
      '001111110000',
      '001111110000',
      '011111111000',
      '011111111000',
      '010011001000',
      '110011001100',
      '100000000100',
      '000000000000'
    ],
    
    // ✓ Check - for success/soft landing
    check: [
      '000000000000',
      '000000000110',
      '000000001100',
      '000000011000',
      '000000110000',
      '000001100000',
      '110011000000',
      '011110000000',
      '001100000000',
      '000000000000',
      '000000000000',
      '000000000000'
    ],
    
    // 🛡️ Shield - for hull/escort
    shield: [
      '001111110000',
      '011111111000',
      '111111111100',
      '111111111100',
      '111111111100',
      '111111111100',
      '011111111000',
      '011111111000',
      '001111110000',
      '000111100000',
      '000011000000',
      '000000000000'
    ],
    
    // 🔧 Wrench - for utility
    wrench: [
      '110000000000',
      '111100000000',
      '011110000000',
      '001111000000',
      '000111100000',
      '000011110000',
      '000001111000',
      '000000111100',
      '000000011110',
      '000000001111',
      '000000000011',
      '000000000000'
    ],
    
    // 📡 Satellite - for sensors/support
    satellite: [
      '111100000000',
      '111110000000',
      '111111000000',
      '011111100000',
      '000111110000',
      '000011111000',
      '000001111100',
      '000000111110',
      '000000011110',
      '000000001110',
      '000000000110',
      '000000000000'
    ],
    
    // ⚔️ Sword - for attack
    sword: [
      '000000001110',
      '000000011100',
      '000000111000',
      '000001110000',
      '000011100000',
      '000111000000',
      '001110000000',
      '011100001000',
      '111000011100',
      '100000011000',
      '000000100000',
      '000000000000'
    ],
    
    // ⚠️ Warning triangle - for alerts/threat
    warning: [
      '000011000000',
      '000011000000',
      '000111100000',
      '000111100000',
      '001111110000',
      '001101110000',
      '011101111000',
      '011101111000',
      '111100111100',
      '111111111100',
      '111111111100',
      '000000000000'
    ],
    
    // 🔥 Fire - for engine burn
    fire: [
      '000100010000',
      '001100110000',
      '001101110000',
      '011111111000',
      '011111111000',
      '111111111100',
      '111111111100',
      '111111111100',
      '011111111000',
      '001111110000',
      '000111100000',
      '000000000000'
    ],
    
    // 🎯 Target - for course correction
    target: [
      '000111110000',
      '001111111000',
      '011100011100',
      '011000001100',
      '110011100110',
      '110011100110',
      '110011100110',
      '011000001100',
      '011100011100',
      '001111111000',
      '000111110000',
      '000000000000'
    ],
    
    // ⛽ Fuel - for carrier resupply  
    fuel: [
      '001111100000',
      '011111110000',
      '011000110000',
      '011111110000',
      '011111110000',
      '011111110000',
      '011111110000',
      '011111110000',
      '011111110000',
      '011111110000',
      '001111100000',
      '000000000000'
    ],
    
    // 🛰️ Scout - for scout missions
    scout: [
      '000011100000',
      '000111110000',
      '111111111110',
      '111111111110',
      '000111110000',
      '000111110000',
      '000011100000',
      '000011100000',
      '001111111000',
      '000000000000',
      '000000000000',
      '000000000000'
    ]
  };
  
  // Default colors
  const COLORS = {
    phosphor: '#33ff99',
    amber: '#ffaa33',
    red: '#ff4444',
    cyan: '#47d4ff',
    white: '#e0e8f0'
  };
  
  /**
   * Generate SVG string from pattern
   * @param {string} iconName - Name of the icon
   * @param {string} color - Fill color (default: phosphor)
   * @param {number} size - Size in pixels (default: 12)
   * @returns {string} Inline SVG string
   */
  function toSvg(iconName, color = COLORS.phosphor, size = 12) {
    const pattern = PATTERNS[iconName];
    if (!pattern) return '';
    
    const scale = size / 12;
    let rects = '';
    
    for (let y = 0; y < pattern.length; y++) {
      const row = pattern[y];
      for (let x = 0; x < row.length; x++) {
        if (row[x] === '1') {
          rects += `<rect x="${x * scale}" y="${y * scale}" width="${scale}" height="${scale}" fill="${color}"/>`;
        }
      }
    }
    
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="vertical-align: middle; display: inline-block;">${rects}</svg>`;
  }
  
  /**
   * Generate a CSS class-based icon span
   * @param {string} iconName - Name of the icon
   * @param {string} colorClass - CSS color class (default: 'phosphor')
   * @returns {string} HTML span with inline SVG
   */
  function toSpan(iconName, colorClass = 'phosphor') {
    const colorMap = {
      phosphor: COLORS.phosphor,
      amber: COLORS.amber,
      red: COLORS.red,
      cyan: COLORS.cyan,
      white: COLORS.white
    };
    const color = colorMap[colorClass] || COLORS.phosphor;
    return `<span class="px-icon px-icon-${iconName}">${toSvg(iconName, color, 14)}</span>`;
  }
  
  /**
   * Replace emoji with pixel icon in text
   * @param {string} text - Text containing emojis
   * @returns {string} Text with emojis replaced by SVG icons
   */
  function replaceEmojis(text) {
    const replacements = [
      { emoji: '🛡️', icon: 'shield', color: COLORS.cyan },
      { emoji: '⚡', icon: 'lightning', color: COLORS.amber },
      { emoji: '🛸', icon: 'ufo', color: COLORS.red },
      { emoji: '🚀', icon: 'rocket', color: COLORS.phosphor },
      { emoji: '✓', icon: 'check', color: COLORS.phosphor },
      { emoji: '🔧', icon: 'wrench', color: COLORS.amber },
      { emoji: '📡', icon: 'satellite', color: COLORS.cyan },
      { emoji: '⚔️', icon: 'sword', color: COLORS.red },
      { emoji: '⚠️', icon: 'warning', color: COLORS.amber },
      { emoji: '🔥', icon: 'fire', color: COLORS.amber },
      { emoji: '🎯', icon: 'target', color: COLORS.phosphor },
      { emoji: '⛽', icon: 'fuel', color: COLORS.amber },
      { emoji: '🛰️', icon: 'scout', color: COLORS.cyan },
      { emoji: '🎖️', icon: 'medal', color: COLORS.amber },
      { emoji: '🏆', icon: 'trophy', color: COLORS.amber },
      { emoji: '★', icon: 'star', color: COLORS.amber },
      { emoji: '☆', icon: 'starEmpty', color: COLORS.amber }
    ];
    
    let result = text;
    for (const { emoji, icon, color } of replacements) {
      result = result.split(emoji).join(toSvg(icon, color, 14));
    }
    return result;
  }
  
  /**
   * Get star rating HTML (filled + empty stars)
   * @param {number} filled - Number of filled stars
   * @param {number} total - Total stars (default: 3)
   * @returns {string} HTML string with star icons
   */
  function starRating(filled, total = 3) {
    let html = '';
    for (let i = 0; i < total; i++) {
      html += toSvg(i < filled ? 'star' : 'starEmpty', COLORS.amber, 12);
    }
    return html;
  }
  
  // Public API
  return {
    toSvg,
    toSpan,
    replaceEmojis,
    starRating,
    COLORS,
    PATTERNS
  };
})();
