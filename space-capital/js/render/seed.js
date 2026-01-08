/**
 * Seed Utilities for Deterministic Ship Generation
 * 
 * Provides stable hashing and seeded pseudo-random number generation
 * so that the same ticker always produces the same ship.
 */

(function(global) {
  'use strict';

  /**
   * FNV-1a 32-bit hash
   * Fast, good distribution, deterministic
   * @param {string} str - Input string
   * @returns {number} - Unsigned 32-bit integer
   */
  function hash32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  /**
   * Mulberry32 PRNG
   * Fast, good quality, seedable
   * @param {number} seed - 32-bit seed value
   * @returns {function} - Returns random float 0-1 on each call
   */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function rand() {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Get letter index (A=0, B=1, ... Z=25)
   * Non-letters return 0
   * @param {string} ch - Single character
   * @returns {number} - 0-25
   */
  function letterIndex(ch) {
    const c = (ch || 'A').toUpperCase().charCodeAt(0);
    if (c < 65 || c > 90) return 0;
    return c - 65;
  }

  /**
   * Generate a canonical seed for a ticker
   * @param {string} ticker - Stock ticker (e.g., 'RKLB')
   * @param {string|null} userId - Optional user ID for per-user uniqueness
   * @returns {number} - Deterministic seed
   */
  function getTickerSeed(ticker, userId = null) {
    const key = userId ? `${userId}:${ticker}` : ticker;
    return hash32(key);
  }

  /**
   * Create a block-specific PRNG for deterministic rendering
   * Combines ticker seed with frame and block indices
   * @param {number} tickerSeed - Base seed from ticker
   * @param {number} frameIndex - Animation frame (0 for static)
   * @param {number} blockIndex - Which block being rendered
   * @returns {function} - Seeded random function
   */
  function getBlockRng(tickerSeed, frameIndex = 0, blockIndex = 0) {
    // Golden ratio hash mixing
    const mixedSeed = tickerSeed ^ (frameIndex * 0x9E3779B9) ^ (blockIndex * 0x517CC1B7);
    return mulberry32(mixedSeed);
  }

  // ═══════════════════════════════════════════════════════════════════
  // EXPORTS
  // ═══════════════════════════════════════════════════════════════════

  const SeedUtils = {
    hash32,
    mulberry32,
    letterIndex,
    getTickerSeed,
    getBlockRng
  };

  // Browser global
  global.SeedUtils = SeedUtils;

  // Module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SeedUtils;
  }

})(typeof window !== 'undefined' ? window : global);
