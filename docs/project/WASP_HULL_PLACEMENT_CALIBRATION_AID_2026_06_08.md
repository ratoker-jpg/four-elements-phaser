# Wasp Hull Placement Calibration Aid

**Date**: 2026-06-08
**Task**: PIM-HULL-WASP-ANCHOR-MAP-01
**Status**: Calibration/debug aid only — NOT the final placement fix

## Purpose

Manual QA shows the generated Wasp hull sprite is visually shifted upward / not centered inside the selection ring / tile. This tool allows Denis to see the projected ground cell, selection ring center, and hull anchor markers side-by-side, then adjust the hull offset live until it is correctly centered.

## How to Open Preview

1. Open: `https://ratoker-jpg.github.io/four-elements-phaser/pr-preview/pr-XXX/?arena=1&devtools=1`
2. Select a Wasp vehicle.
3. Press **U** to activate placement calibration mode.

## Hotkeys (Arena/devtools only, Wasp selected)

| Hotkey | Action |
|--------|--------|
| **U** | Toggle placement calibration mode on/off |
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

| Marker | Color | Label | Meaning |
|--------|-------|-------|---------|
| **Thick diamond** | Yellow `#ffff00` | TILE | Projected ground cell (1x1 tile) under Wasp |
| **Cross** | Magenta `#ff00ff` | RING CENTER | Selection ring center (where the game thinks the vehicle is) |
| **Cross** | Cyan `#00ffff` | HULL ANCHOR | Hull sprite origin (where the hull PNG origin is placed) |
| **Rectangle** | Green `#00ff00` | BOUNDS | Hull sprite bounds (full visible area of the PNG) |
| **Dot** | White `#ffffff` | GROUND | Ground anchor point (projected ground contact) |

## Overlay Text

The placement overlay text panel is positioned to the RIGHT of the hull (not above) to avoid overlapping the vehicle. It shows:
- **OFFSET: (X, Y)** — prominently at the top (current debug offset values)
- hull: wasp
- selected vehicle id
- current scale / originX / originY
- current texture key
- projected tile/cell coordinates
- whether placement calibration is active
- hotkey reference: I/K/J/L=1px, Shift=5px, R/0=reset, P=print, O=overlay

## What to Do

1. Activate placement calibration (U).
2. Look at the markers — the yellow tile diamond, magenta cross (RING CENTER), and cyan cross (HULL ANCHOR) should overlap if the hull is perfectly centered.
3. If the hull is shifted, use I/K/J/L keys to move it until the cyan cross aligns with the magenta cross inside the yellow tile diamond.
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
- While placement calibration is active, I/K/J/L/O/P/R/U keys are consumed and will NOT trigger upgrades or other actions.
