# Aquarelle

A watercolor mixing puzzle game where players match target colors by layering pigments. The game simulates real watercolor glazing physics using transparency values from Schmincke AKADEMIE Aquarell pigments.

**Design Philosophy:** Playful exploration through trial and error. Discovery happens through doing, not reading.

## Play

Open `index.html` in any modern browser. No build step required.

## How to Play

1. **Match the target color** by selecting pigments from the palette
2. **Layer order matters** — drag to reorder layers (just like real watercolor glazing)
3. **Get 70%+ match** to advance to the next level
4. **Earn stars** for better matches: 70%+ = 1 star, 85%+ = 2 stars, 95%+ = 3 stars

## Features

- **Drag & Drop Reordering** — Reorder layers by dragging, or use arrow keys when focused
- **Undo/Redo** — Ctrl+Z / Ctrl+Y to undo and redo layer changes
- **Ghost Preview** — After clearing or failing, see a ghost of your previous attempt
- **Transparency Preview** — Hover over pigments to see their opacity level
- **Visual Feedback** — When you fail, see what adjustments are needed (warmer/cooler, lighter/darker)
- **Keyboard Shortcuts** — Enter to submit, Escape to clear, arrow keys to reorder

## Project Structure

```
glaze-master/
├── index.html              # Main game page
├── css/
│   └── style.css           # All styles
├── js/
│   ├── watercolor-engine.js  # Reusable color mixing library
│   └── game.js              # Game logic (v2.1)
└── README.md
```

## Technical Details

### Watercolor Engine

The `watercolor-engine.js` file is a standalone library that simulates watercolor glazing:

- **24 pigments** based on Schmincke AKADEMIE Aquarell series
- **Realistic transparency** — transparent, semi-transparent, semi-opaque, and opaque pigments behave differently
- **Glazing simulation** — models how light passes through pigment layers to paper and back

### Color Matching

Uses weighted Euclidean distance in RGB space, adjusted for human color perception.

## Browser Support

Chrome 80+, Firefox 75+, Safari 13+, Edge 80+

## Version History

- **v2.1** — Removed hints/time pressure/daily challenge. Added drag-drop reordering, ghost preview, transparency indicators, visual feedback for failures.
- **v2.0** — Refactored to use watercolor-engine.js, added undo/redo.
- **v1.0** — Initial release.

## License

MIT
