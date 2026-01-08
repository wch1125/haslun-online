// =========================================================================
// DIAL SELECTOR :: Weighted wheel ship selection with physics
// Arc-based layout with inertia, friction, and snap
// Uses 3x virtual copies for smoother rotation (user never sees duplicates)
// Properly decouples swipe from select (swipe != navigation)
// =========================================================================

(function() {
  'use strict';

  const TAU = Math.PI * 2;

  /**
   * Creates a dial selector with weighted physics
   */
  function createDialSelector(options) {
    const {
      mount,
      items,
      renderCard,
      onActiveChange = () => {},
      onSelect = () => {},
      windowSize = 7,
      copies = 3  // Virtual copies for smoother rotation
    } = options;

    if (!mount || !items || items.length === 0) {
      console.warn('[DialSelector] Missing mount or items');
      return null;
    }

    // Physics uses expanded wheel (3x copies) for smoother rotation
    const N = items.length;           // Unique tickers
    const expandedN = N * copies;     // Virtual wheel size
    const step = TAU / expandedN;     // Smaller steps = smoother feel

    // Physics constants - tuned for "heavy wheel" feel
    const friction = 0.92;       // Velocity decay per frame
    const snapStrength = 0.12;   // How quickly it snaps to nearest
    const maxVel = 0.15;         // Cap velocity (radians per frame)

    // State
    let angle = 0;               // Current rotation (radians)
    let velocity = 0;            // Angular velocity
    let dragging = false;
    let lastX = 0;
    let lastT = 0;
    let pointerX = 0;            // For parallax
    let pointerY = 0;
    let didSwipe = false;        // Prevents tap after swipe

    // Helper
    const mod = (n, m) => ((n % m) + m) % m;

    // DOM
    const ring = document.createElement('div');
    ring.className = 'dial-ring';
    mount.appendChild(ring);

    // Track which cards are currently in DOM
    const cardMap = new Map();   // ticker -> DOM node

    /**
     * Get index on the EXPANDED wheel (0 to expandedN-1)
     */
    function expandedIndex() {
      return mod(Math.round(angle / step), expandedN);
    }

    /**
     * Get index of currently active UNIQUE item (0 to N-1)
     */
    function activeIndex() {
      return expandedIndex() % N;
    }

    /**
     * Get ticker of currently active item
     */
    function activeTicker() {
      return items[activeIndex()];
    }

    /**
     * Render only cards within the visible window
     * Uses virtual recycling - removes cards outside window, adds new ones
     */
    function renderWindow() {
      const ai = activeIndex();
      const half = Math.floor(windowSize / 2);
      const visible = new Set();

      // Determine which tickers should be visible
      for (let d = -half; d <= half; d++) {
        const idx = mod(ai + d, N);
        visible.add(items[idx]);
      }

      // Remove cards no longer visible
      for (const [ticker, node] of cardMap) {
        if (!visible.has(ticker)) {
          node.remove();
          cardMap.delete(ticker);
        }
      }

      // Add cards that should be visible but aren't
      for (const ticker of visible) {
        if (!cardMap.has(ticker)) {
          const card = renderCard(ticker);
          card.classList.add('dial-card');
          card.dataset.ticker = ticker;
          
          // Click handler - only fires if not swiping
          card.addEventListener('click', (e) => {
            if (didSwipe) {
              didSwipe = false;
              return;
            }
            // Only select if this is the active (center) card
            if (ticker === activeTicker()) {
              onSelect(ticker);
            } else {
              // Rotate to this card (find nearest copy)
              const targetIdx = items.indexOf(ticker);
              let bestAngle = targetIdx * step;
              let bestDist = Infinity;
              for (let c = 0; c < copies; c++) {
                const candidateAngle = (targetIdx + c * N) * step;
                let dist = Math.abs(angle - candidateAngle);
                dist = Math.min(dist, TAU - dist);
                if (dist < bestDist) {
                  bestDist = dist;
                  bestAngle = candidateAngle;
                }
              }
              angle = bestAngle;
            }
          });

          ring.appendChild(card);
          cardMap.set(ticker, card);
        }
      }

      ring.dataset.center = activeTicker();
    }

    /**
     * Position all visible cards based on current angle
     * Uses velocity-based offset for smooth motion feel
     */
    function layout() {
      const ai = activeIndex();
      const half = Math.floor(windowSize / 2);
      
      // Motion offset based on velocity - creates smooth sliding feel
      const motionOffset = velocity * 3000;

      cardMap.forEach((node, ticker) => {
        const idx = items.indexOf(ticker);
        
        // Calculate relative position from center
        let delta = idx - ai;
        // Handle wrap-around
        if (delta > N / 2) delta -= N;
        if (delta < -N / 2) delta += N;

        // Skip if outside window
        if (Math.abs(delta) > half) {
          node.style.display = 'none';
          return;
        }
        node.style.display = '';

        // Arc-based positioning
        const baseAngle = delta * (Math.PI / 6);
        const radius = 480;
        
        // Add motion offset for smooth sliding during drag/inertia
        const spreadX = Math.sin(baseAngle) * radius + motionOffset;
        const spreadY = (1 - Math.cos(baseAngle)) * 80;
        
        // Scale: center is 1.0, edges are smaller (based on visual position)
        const visualDist = Math.abs(spreadX) / radius;
        const scale = 1 - Math.min(0.3, visualDist * 0.25);
        
        // Opacity: center is full, edges fade
        const opacity = 1 - Math.min(0.6, visualDist * 0.5);

        // Z-index: center on top
        node.style.zIndex = 100 - Math.abs(delta);

        // Apply transforms
        node.style.transform = `translate3d(${spreadX}px, ${spreadY}px, 0) scale(${scale})`;
        node.style.opacity = opacity;

        // Active styling
        node.classList.toggle('is-active', ticker === items[ai]);

        // Parallax: update layers inside card
        const layers = node.querySelectorAll('[data-depth]');
        layers.forEach((layer) => {
          const depth = parseFloat(layer.dataset.depth || '0');
          const p = parseFloat(layer.dataset.parallax || '0.2');
          const px = pointerX * 40 * p;
          const py = pointerY * 26 * p;
          const mv = velocity * 1200 * p;
          layer.style.transform = `translate3d(${px + mv}px, ${py}px, ${depth}px)`;
        });
      });
    }

    /**
     * Animation loop - physics simulation
     */
    function tick() {
      if (!dragging) {
        // Apply velocity
        angle += velocity * 16;
        
        // Apply friction
        velocity *= friction;
        
        // Clamp velocity
        velocity = Math.max(-maxVel, Math.min(maxVel, velocity));

        // Snap to nearest detent on EXPANDED wheel when nearly stopped
        if (Math.abs(velocity) < 0.002) {
          const target = expandedIndex() * step;
          angle += (target - angle) * snapStrength;
        }
      }

      // Normalize angle to [0, TAU)
      angle = (angle % TAU + TAU) % TAU;

      // Check if UNIQUE ticker changed (not expanded index)
      const center = activeTicker();
      if (ring.dataset.center !== center) {
        renderWindow();
        onActiveChange(center);
      }

      layout();
      requestAnimationFrame(tick);
    }

    /**
     * Pointer/touch handlers
     */
    function onDown(x) {
      dragging = true;
      lastX = x;
      lastT = performance.now();
      velocity = 0;
      didSwipe = false;
    }

    function onMove(x) {
      if (!dragging) return;
      
      const now = performance.now();
      const dx = x - lastX;
      const dt = Math.max(8, now - lastT);

      // Mark as swipe if moved enough
      if (Math.abs(dx) > 10) {
        didSwipe = true;
      }

      // Convert pixels to radians
      const dA = -dx / 650;  // Tune: px -> radians sensitivity
      angle += dA;
      
      // Calculate velocity (ms-normalized)
      velocity = (dA / dt) * 16;
      velocity = Math.max(-maxVel, Math.min(maxVel, velocity));

      lastX = x;
      lastT = now;
    }

    function onUp() {
      dragging = false;
      // Reset didSwipe after a short delay (allows click to fire first)
      setTimeout(() => { didSwipe = false; }, 50);
    }

    // Pointer events (unified touch/mouse)
    mount.addEventListener('pointerdown', (e) => {
      mount.setPointerCapture(e.pointerId);
      onDown(e.clientX);
    }, { passive: true });

    mount.addEventListener('pointermove', (e) => {
      pointerX = (e.clientX / window.innerWidth) - 0.5;
      pointerY = (e.clientY / window.innerHeight) - 0.5;
      onMove(e.clientX);
    }, { passive: true });

    mount.addEventListener('pointerup', onUp, { passive: true });
    mount.addEventListener('pointercancel', onUp, { passive: true });

    // Keyboard support
    mount.setAttribute('tabindex', '0');
    mount.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        velocity = -0.05;
        e.preventDefault();
      } else if (e.key === 'ArrowRight') {
        velocity = 0.05;
        e.preventDefault();
      } else if (e.key === 'Enter' || e.key === ' ') {
        onSelect(activeTicker());
        e.preventDefault();
      }
    });

    // Initial render
    renderWindow();
    requestAnimationFrame(tick);

    // Public API
    return {
      /**
       * Set the active ticker (rotates to nearest copy)
       */
      setActiveTicker(ticker) {
        const idx = items.indexOf(ticker);
        if (idx >= 0) {
          // Find the nearest copy of this ticker on the expanded wheel
          // Copies are at expanded indices: idx, idx+N, idx+2N, etc.
          let bestAngle = idx * step;  // First copy
          let bestDist = Infinity;
          
          // Check all copies to find nearest to current angle
          for (let c = 0; c < copies; c++) {
            const candidateAngle = (idx + c * N) * step;
            // Handle wrap-around distance
            let dist = Math.abs(angle - candidateAngle);
            dist = Math.min(dist, TAU - dist);
            if (dist < bestDist) {
              bestDist = dist;
              bestAngle = candidateAngle;
            }
          }
          angle = bestAngle;
        }
      },
      
      /**
       * Get currently active ticker
       */
      getActiveTicker() {
        return activeTicker();
      },
      
      /**
       * Destroy the dial (cleanup)
       */
      destroy() {
        ring.remove();
        cardMap.clear();
      }
    };
  }

  // Export
  window.DialSelector = {
    create: createDialSelector
  };

})();
