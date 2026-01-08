/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SHIP SIGNATURE RADAR
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * A radar/spider chart that visualizes ship traits as a gestalt shape.
 * Users learn to recognize ship "personalities" at a glance.
 * 
 * Traits map to real market data:
 *   HULL     → Liquidity / spread / depth
 *   FIREPOWER → Momentum / trend strength / ADX
 *   SENSORS  → Volume flow / signal quality
 *   FUEL     → Time decay / theta / trend age
 *   THREAT   → Volatility / IV rank / regime stress
 *   ANOMALY  → Options weirdness (IV-RV spread, skew, gamma)
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

const ShipSignatureRadar = (function() {
  'use strict';

  /**
   * Draw a radar chart on a canvas
   * @param {HTMLCanvasElement} canvas - Target canvas element
   * @param {Array} traits - Array of {label, value} objects (value 0-100)
   * @param {Object} opts - Optional styling overrides
   */
  function drawRadar(canvas, traits, opts = {}) {
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2;
    const radius = Math.min(w, h) * 0.36;

    const labels = traits.map(t => t.label);
    const values = traits.map(t => clamp01((t.value || 0) / 100));

    // Styling options with Hotline Miami defaults
    const rings = opts.rings ?? 5;
    const lineColor = opts.line ?? "rgba(255,41,117,0.9)";      // Magenta
    const fillColor = opts.fill ?? "rgba(255,41,117,0.15)";
    const gridColor = opts.grid ?? "rgba(0,255,255,0.12)";      // Cyan grid
    const textColor = opts.text ?? "rgba(0,255,255,0.7)";
    const accentColor = opts.accent ?? "rgba(57,255,20,0.8)";   // Green accent

    ctx.clearRect(0, 0, w, h);

    // ─────────────────────────────────────────────────────────────────────
    // Grid rings (concentric polygons)
    // ─────────────────────────────────────────────────────────────────────
    ctx.lineWidth = 1;
    for (let r = 1; r <= rings; r++) {
      const rr = (r / rings) * radius;
      drawPolygon(ctx, cx, cy, rr, labels.length, 0, gridColor);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Spokes (axis lines)
    // ─────────────────────────────────────────────────────────────────────
    for (let i = 0; i < labels.length; i++) {
      const a = (Math.PI * 2 * i) / labels.length - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
      ctx.strokeStyle = gridColor;
      ctx.stroke();
    }

    // ─────────────────────────────────────────────────────────────────────
    // Data polygon (the "signature")
    // ─────────────────────────────────────────────────────────────────────
    const pts = values.map((v, i) => {
      const a = (Math.PI * 2 * i) / labels.length - Math.PI / 2;
      return [
        cx + Math.cos(a) * radius * v,
        cy + Math.sin(a) * radius * v
      ];
    });

    // Fill
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Stroke
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Vertex dots
    ctx.fillStyle = lineColor;
    for (const pt of pts) {
      ctx.beginPath();
      ctx.arc(pt[0], pt[1], 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // ─────────────────────────────────────────────────────────────────────
    // Labels (positioned around the perimeter)
    // ─────────────────────────────────────────────────────────────────────
    ctx.font = "11px 'VT323', monospace";
    ctx.fillStyle = textColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    for (let i = 0; i < labels.length; i++) {
      const a = (Math.PI * 2 * i) / labels.length - Math.PI / 2;
      const lx = cx + Math.cos(a) * (radius + 18);
      const ly = cy + Math.sin(a) * (radius + 18);
      ctx.fillText(labels[i], lx, ly);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Center dot
    // ─────────────────────────────────────────────────────────────────────
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Draw a second polygon overlay (for mission ideal comparison)
   */
  function drawOverlay(canvas, traits, opts = {}) {
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2;
    const radius = Math.min(w, h) * 0.36;

    const values = traits.map(t => clamp01((t.value || 0) / 100));
    const strokeColor = opts.stroke ?? "rgba(255,230,0,0.6)";  // Yellow outline

    const pts = values.map((v, i) => {
      const a = (Math.PI * 2 * i) / traits.length - Math.PI / 2;
      return [
        cx + Math.cos(a) * radius * v,
        cy + Math.sin(a) * radius * v
      ];
    });

    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /**
   * Helper: Draw a regular polygon
   */
  function drawPolygon(ctx, cx, cy, r, n, rot, strokeStyle) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = rot + (Math.PI * 2 * i) / n - Math.PI / 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /**
   * Clamp value between 0 and 1
   */
  function clamp01(x) {
    return Math.max(0, Math.min(1, isNaN(x) ? 0 : x));
  }

  // Public API
  return {
    drawRadar,
    drawOverlay
  };

})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ShipSignatureRadar;
}
