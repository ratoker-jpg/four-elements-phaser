# Wasp Hull Placement Calibration Aid

**Date**: 2026-06-08
**Task**: PIM-HULL-WASP-ANCHOR-MAP-01
**Status**: Calibration/debug aid only — NOT the final placement fix

## Purpose

Manual QA shows the generated Wasp hull sprite is visually shifted upward / not centered inside the selection ring / tile. This tool allows Denis to see the projected ground cell, selection ring center, and hull anchor markers side-by-side, then adjust the hull offset live until it is correctly centered.

## How to Open Preview

1. Open: `https://ratoker-jpg.github.io/four-elements-phaser/pr-preview/pr-XXX/?arena=1&devtools=1`
2. Select a Wasp vehicle.
3. Press **Alt+U** to activate placement calibration mode.

## Hotkeys (Arena/devtools only, Wasp selected)

| Hotkey | Action |
|--------|--------|
| **Alt+U** | Toggle placement calibration mode on/off |
| **I** | Move hull up by 1px |
| **K** | Move hull down by 1px |
| **J** | Move hull left by 1px |
| **L** | Move hull right by 1px |
| **Shift + I** | Move hull up by 5px |
| **Shift + K** | Move hull down by 5px |
| **Shift + J** | Move hull left by 5px |
| **Shift + L** | Move hull right by 5px |
| **R** or **0** | Reset debug offset to (0, 0) |
| **P** | Print current placement values to console |
| **O** | Toggle placement overlay visibility |

### Why I/K/J/L instead of Arrow keys?

Arrow keys are used by the camera pan system and would move the camera while calibrating. I/K/J/L are vim-style navigation keys that do not conflict with camera controls. When placement calibration is active, these keys are consumed (preventDefault + stopPropagation) so the camera does NOT move.

### Key conflicts

When placement calibration is active on a selected Wasp, the following keys are consumed by placement calibration and will NOT trigger their normal actions:
- **I** (normally: armor_plating upgrade)
- **O** (normally: weapon_tuning upgrade)
- **P** (normally: range_extender upgrade)
- **R** (normally: reset scenario)
- **U** (normally: mobility_boost upgrade)

These keys return to their normal functions when placement calibration is deactivated.

## Console API

After activating placement calibration, use the browser dev console:

```js
window.WASP_PLACE.up()       // adjust up 1px
window.WASP_PLACE.down()     // adjust down 1px
window.WASP_PLACE.left()     // adjust left 1px
window.WASP_PLACE.right()    // adjust right 1px
window.WASP_PLACE.up5()      // adjust up 5px
window.WASP_PLACE.down5()    // adjust down 5px
window.WASP_PLACE.left5()    // adjust left 5px
window.WASP_PLACE.right5()   // adjust right 5px
window.WASP_PLACE.reset()    // reset offset to (0,0)
window.WASP_PLACE.print()    // print placement values
window.WASP_PLACE.overlay()  // toggle overlay
window.WASP_PLACE.state()    // print current state
window.WASP_PLACE.set(x, y)  // set offset directly
```

## Overlay Markers

Visual language reused from ModularTankDebugOverlay:

| Marker | Color | Style | Meaning |
|--------|-------|-------|---------|
| **Tile footprint diamond** | Green `#7cff7c` | 4-cornered diamond, lineWidth 2 | Projected ground cell (1×1 tile) under Wasp |
| **Tile anchor crosshair** | Gold `#ffd54f` | circle(radius 7) + horizontal/vertical lines (arm 10) | Selection ring center / logical tile anchor |
| **Hull sprite origin** | Cyan `#26c6da` | circle(radius 6) + X pattern (arm 8) | Hull sprite origin point (includes debug offset) |
| **Hull→turret connection** | White `#ffffff` | line, lineWidth 2 | Visual connection from hull origin to turret mount |
| **Turret mount origin** | Red `#ff6b6b` | circle(radius 6) + crosshair lines (arm 8) | Projected turret mount screen position |

## Overlay Text

The placement overlay text panel is positioned like ModularTankDebugOverlay (hullX+30, hullY+28) with a compact monospace style. It shows:
- **tile: (X, Y)** — projected tile/cell coordinates
- **world: X, Y** — hull sprite screen position
- **scale / origin** — current scale and origin values
- **>> offset: (X, Y)** — current debug offset values (prominent)
- **hull → turret: dx=… dy=…** — screen-space distance from hull origin to turret mount
- Hotkey reference: Alt+U=toggle, I/K/J/L=move, R=reset, P=print, O=overlay

## What to Do

1. Activate placement calibration (Alt+U).
2. Look at the markers — the green tile diamond, gold crosshair (tile anchor), cyan X marker (hull origin), and red crosshair (turret mount) should align correctly if the hull is perfectly centered.
3. If the hull is shifted, use I/K/J/L keys to move it until the cyan X marker aligns with the gold crosshair inside the green tile diamond.
4. Once aligned, press P to print the current values.
5. Report the values in the template below.

## Result Template

After calibration, fill in and report:

```
Wasp scale =
Wasp originX =
Wasp originY =
Wasp offsetX =
Wasp offsetY =
uiOffsetY =
```

## Important Notes

- The debug offset affects visual sprite position **only**.
- Selection ring, movement, pathfinding are **unchanged**.
- The direction remap is **unchanged**.
- Turret aim is **unchanged**.
- Deactivating placement calibration resets the offset to (0, 0).
- This is NOT the final placement fix — values must be applied to the hull profile system after calibration.
- While placement calibration is active, I/K/J/L/O/P/R keys are consumed and will NOT trigger upgrades or other actions.
