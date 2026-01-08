/**
 * Seed Utilities for Deterministic Ship Generation
 * Provides stable hashing and seeded PRNG so same ticker = same ship
 */

(function(global) {
  'use strict';

  // FNV-1a 32-bit hash - fast, good distribution, deterministic
  function hash32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  // Mulberry32 PRNG - fast, seedable, good quality
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

  // Letter index (A=0, B=1, ... Z=25)
  function letterIndex(ch) {
    const c = (ch || 'A').toUpperCase().charCodeAt(0);
    if (c < 65 || c > 90) return 0;
    return c - 65;
  }

  // Canonical seed for ticker (optionally per-user)
  function getTickerSeed(ticker, userId = null) {
    const key = userId ? `${userId}:${ticker}` : ticker;
    return hash32(key);
  }

  // Block-specific PRNG for deterministic rendering
  function getBlockRng(tickerSeed, frameIndex = 0, blockIndex = 0) {
    const mixedSeed = tickerSeed ^ (frameIndex * 0x9E3779B9) ^ (blockIndex * 0x517CC1B7);
    return mulberry32(mixedSeed);
  }

  global.SeedUtils = { hash32, mulberry32, letterIndex, getTickerSeed, getBlockRng };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.SeedUtils;
  }

})(typeof window !== 'undefined' ? window : global);
