# CAMERA_PROJECTION_CONTRACT

Status: accepted  
Project: Four Elements Phaser  
Date: 2026-06-02

## Camera model

The game uses a fixed isometric / axonometric 2.5D camera.

- Pan: yes
- Zoom: yes
- Rotation: no

All world-space markers, sprites, shadows, and rendered assets must assume this fixed camera.

## Projection formula

```text
screen = origin + worldX * basisX + worldY * basisY + worldZ * basisZ
```

Ground plane:

```text
screen = origin + worldX * basisX + worldY * basisY
```

## Constants

| Constant | Value |
|---|---|
| `TILE_W` | `76` |
| `TILE_H` | `38` |
| `basisX` | `{ x: 38, y: 19 }` |
| `basisY` | `{ x: -38, y: 19 }` |
| `basisZ` | `{ x: 0, y: -60 }` |

Source of truth in runtime: `src/config/worldConfig.ts` plus the documented projection rules above.

## Anchor rule

All objects are anchored at the ground contact point / bottom center.

- Buildings: south vertex of the footprint diamond.
- Units: body position projected to the ground plane.
- Height offsets: move upward using `basisZ`.

## Implications for rendered sprites

- No top-down assumptions.
- No screen-space circles for ground markers.
- No circular top-down shadows.
- Hull and turret sprite renders must match this fixed isometric view.
- Contact sheets and manifests should preserve the canonical direction naming.

## Required direction conventions

### Runtime 8-dir

`E=0, SE=1, S=2, SW=3, W=4, NW=5, N=6, NE=7`

### Production 16-dir

`dir0=E, dir1=ESE, dir2=SE, dir3=SSE, dir4=S, dir5=SSW, dir6=SW, dir7=WSW, dir8=W, dir9=WNW, dir10=NW, dir11=NNW, dir12=N, dir13=NNE, dir14=NE, dir15=ENE`

## Blender factory note

The Blender render factory in `tools/blender/` is expected to target this projection contract. Camera calibration is handled by `tools/blender/calibrate_camera.py`.
