# Wasp Hull Placement Calibration Aid

**Date**: 2026-06-08
**Task**: PIM-HULL-WASP-ANCHOR-MAP-01
**Status**: Calibration/debug aid only — NOT the final placement fix

## Purpose

Manual QA shows the generated Wasp hull sprite is visually shifted upward / not centered inside the selection ring / tile. This tool allows Denis to see the projected ground cell, selection ring center, and hull anchor markers side-by-side, then adjust the hull offset live until it is correctly centered.

## How to Open Preview

1. Open: `https://ratoker-jpg.github.io/four-elements-phaser/pr-preview/pr-XXX/?arena=1&devtools=1`
2. Select a Wasp vehicle.
3. Press **Alt + U** to activate placement calibration mode.

## Hotkeys (Arena/devtools only, Wasp selected)

| Hotkey | Action |
|--------|--------|
| **Alt + U** | Toggle placement calibration mode on/off |
| **Alt + ArrowUp** | Move hull up by 1px |
| **Alt + ArrowDown** | Move hull down by 1px |
| **Alt + ArrowLeft** | Move hull left by 1px |
| **Alt + ArrowRight** | Move hull right by 1px |
| **Shift + Alt + ArrowUp** | Move hull up by 5px |
| **Shift + Alt + ArrowDown** | Move hull down by 5px |
| **Shift + Alt + ArrowLeft** | Move hull left by 5px |
| **Shift + Alt + ArrowRight** | Move hull right by 5px |
| **Alt + 0** | Reset debug offset to (0, 0) |
| **Alt + P** | Print current placement values to console |
| **Alt + O** | Toggle placement overlay visibility |

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

| Marker | Color | Meaning |
|--------|-------|---------|
| **Yellow diamond** | `#ffff00` | Projected ground cell (1×1 tile) under Wasp |
| **Magenta cross** | `#ff00ff` | Selection ring center (where the game thinks the vehicle is) |
| **Cyan cross** | `#00ffff` | Hull sprite anchor (where the hull PNG origin is placed) |
| **Green rectangle** | `#00ff00` | Hull sprite bounds (full visible area of the PNG) |
| **White dot** | `#ffffff` | Ground anchor point (projected ground contact) |

## Overlay Text

The placement overlay shows:
- hull: wasp
- selected vehicle id/name
- current offsetX / offsetY (debug values)
- current scale / originX / originY
- current texture key
- projected tile/cell coordinates
- whether debug placement override is active

## What to Do

1. Activate placement calibration (Alt + U).
2. Look at the markers — the yellow tile diamond, magenta cross (ring center), and cyan cross (hull anchor) should overlap if the hull is perfectly centered.
3. If the hull is shifted, use Alt + Arrow keys to move it until the cyan cross aligns with the magenta cross inside the yellow tile diamond.
4. Once aligned, press Alt + P to print the current values.
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
