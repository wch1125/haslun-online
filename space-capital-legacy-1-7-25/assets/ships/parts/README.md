# SPACE CAPITAL Ship Parts - Sprite Asset Guide

This document specifies the modular sprite parts needed for the upgrade system.
All sprites should match your existing pixel art style (16-bit aesthetic, nearest neighbor, crisp edges).

## Directory Structure

```
assets/ships/
├── base/                   # Base hull sprites (copy from animated/TICKER/TICKER_base.png)
│   ├── RKLB.png
│   ├── LUNR.png
│   └── ...
├── parts/
│   ├── wings/
│   │   ├── wing_small.png
│   │   ├── wing_mid.png
│   │   ├── wing_large.png
│   │   └── wing_elite.png
│   ├── engines/
│   │   ├── thruster_1.png
│   │   ├── thruster_2.png
│   │   └── thruster_3.png
│   ├── armor/
│   │   ├── plate_1.png
│   │   └── plate_2.png
│   ├── antenna/
│   │   ├── antenna_1.png
│   │   └── antenna_2.png
│   ├── weapons/
│   │   ├── weapon_1.png
│   │   └── weapon_2.png
│   ├── shield/
│   │   └── shield_1.png
│   └── overlays/
│       ├── damage.png
│       ├── boost.png
│       └── alert.png
```

---

## Part Specifications

### Wings (`parts/wings/`)

Wings attach to the left side and are automatically mirrored to the right.

| File | Size | Description | Anchor Point |
|------|------|-------------|--------------|
| `wing_small.png` | 16×12px | Basic scout wing, angular, minimal | x:8, y:20 |
| `wing_mid.png` | 20×14px | Standard wing, more surface area | x:8, y:20 |
| `wing_large.png` | 28×18px | Combat wing, aggressive angle | x:8, y:20 |
| `wing_elite.png` | 32×20px | Elite wing, detailed, with trim | x:8, y:20 |

**Design Notes:**
- Wings should point outward/backward
- Include engine pods or hard points on larger wings
- Use metallic base color with accent highlights
- Left-facing (system mirrors automatically)

---

### Engines (`parts/engines/`)

Engines render BEHIND the hull (z-index 0) to show exhaust.

| File | Size | Description | Glow Level |
|------|------|-------------|------------|
| `thruster_1.png` | 12×16px | Basic thruster, small flame | 0.3 |
| `thruster_2.png` | 16×20px | Ion drive, blue-white glow | 0.6 |
| `thruster_3.png` | 20×24px | Plasma core, intense orange/white | 1.0 |

**Design Notes:**
- Include the exhaust flame/glow in the sprite
- Use gradients: white center → color → transparent edges
- Keep horizontal width constrained (engines are centered)
- thruster_3 should feel POWERFUL

---

### Armor (`parts/armor/`)

Armor overlays on the hull body, adding visual bulk.

| File | Size | Description |
|------|------|-------------|
| `plate_1.png` | 24×16px | Light plating, angular panels |
| `plate_2.png` | 32×24px | Heavy armor, riveted, battle-worn |

**Design Notes:**
- Semi-transparent so hull shows through slightly
- Add panel lines, rivets, battle scarring
- Gray/metallic base, maybe rust or scorch marks
- Should look "bolted on"

---

### Antenna (`parts/antenna/`)

Antenna attaches to top-center of ship.

| File | Size | Description |
|------|------|-------------|
| `antenna_1.png` | 8×16px | Comm array, single dish/spike |
| `antenna_2.png` | 14×20px | Command array, multiple elements |

**Design Notes:**
- Vertical orientation
- Include small blinking lights (1-2 pixels)
- antenna_2 should look like a command ship sensor suite

---

### Weapons (`parts/weapons/`)

Weapons attach to wing mounts, mirrored automatically.

| File | Size | Description |
|------|------|-------------|
| `weapon_1.png` | 10×14px | Laser banks, glowing barrels |
| `weapon_2.png` | 16×18px | Missile pods, visible ordnance |

**Design Notes:**
- Left-side mount (system mirrors to right)
- Include subtle glow/charging effect
- weapon_2 should have visible missiles/torpedoes

---

### Shield (`parts/shield/`)

Shield is a full-ship overlay effect.

| File | Size | Description |
|------|------|-------------|
| `shield_1.png` | 80×80px | Energy shield bubble |

**Design Notes:**
- Centered around ship (anchor is center)
- Semi-transparent oval/hexagonal pattern
- Use phosphor green with low opacity (0.2-0.4)
- Include some energy crackle/hex grid pattern

---

### Status Overlays (`parts/overlays/`)

Full-ship overlays for status conditions.

| File | Size | Description |
|------|------|-------------|
| `damage.png` | 64×64px | Red sparks, smoke wisps |
| `boost.png` | 64×64px | Green energy trails |
| `alert.png` | 64×64px | Yellow warning border/pulse |

**Design Notes:**
- Keep opacity low (these layer on top)
- damage: random spark pixels, smoke
- boost: trailing energy from engines
- alert: thin border or corner indicators

---

## Creating Sprites in Photoshop

### Settings
1. Document: Transparent background
2. Pixel grid: Enabled
3. Image interpolation: Nearest Neighbor (no smoothing)
4. Export: PNG-24 with transparency

### Color Palette Suggestions

**Hull Metals:**
- Base: #445566
- Highlight: #667788  
- Shadow: #223344

**Engines (warm):**
- Core: #FFFFFF
- Mid: #FFAA44
- Edge: #FF4400
- Fade: transparent

**Engines (cool ion):**
- Core: #FFFFFF
- Mid: #88CCFF
- Edge: #3366FF
- Fade: transparent

**Armor:**
- Base: #556677
- Panel lines: #334455
- Rivets: #778899
- Scorch: #443322

**Shield:**
- Main: #33FF99 at 20% opacity
- Grid: #33FF99 at 40% opacity

---

## Testing

1. Open `sprite-upgrades.html` in browser
2. The system shows procedural placeholders until you add actual sprites
3. Adjust sliders to see how upgrades change
4. Drop new sprites into the folders and refresh

---

## Stat → Upgrade Mapping

| Stat | Drives | Logic |
|------|--------|-------|
| Today P&L % | Wings | Fast movers get bigger wings |
| Win Rate | Engines | Strong performers = powerful engines |
| Volatility | Armor | High risk = more protective plating |
| Relative Volume | Antenna | Active stocks need more comms |
| Total Gain % | Weapons | Big winners get firepower |
| Max Drawdown (inv) | Shield | Consistent performers get shields |

---

## Files Checklist

```
[ ] parts/wings/wing_small.png
[ ] parts/wings/wing_mid.png
[ ] parts/wings/wing_large.png
[ ] parts/wings/wing_elite.png
[ ] parts/engines/thruster_1.png
[ ] parts/engines/thruster_2.png
[ ] parts/engines/thruster_3.png
[ ] parts/armor/plate_1.png
[ ] parts/armor/plate_2.png
[ ] parts/antenna/antenna_1.png
[ ] parts/antenna/antenna_2.png
[ ] parts/weapons/weapon_1.png
[ ] parts/weapons/weapon_2.png
[ ] parts/shield/shield_1.png
[ ] parts/overlays/damage.png
[ ] parts/overlays/boost.png
[ ] parts/overlays/alert.png
```

Total: 17 sprite files needed
