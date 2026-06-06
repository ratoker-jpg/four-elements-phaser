# TURRET_DIRECTION_REMAP_REPORT_2026_06_06

## Summary

- Applied a global filename remap to the generated turret sprite matrix under `public/assets/units/turrets`.
- Fixes the direction-label offset introduced by PR #224.
- No PNG bytes, pixels, dimensions, or compression were changed.
- No runtime or gameplay files were changed.

## Root cause

- The generated 16-frame turret rotations were visually smooth and not mirrored.
- The issue was in the filename-to-heading mapping only.
- Visual East/right was stored in old `dir02_SE`.
- Equivalent correction rule: `new_index = old_index - 2 mod 16`.

## Remap

- old `dir00_E` -> new `dir14_NE`
- old `dir01_ESE` -> new `dir15_ENE`
- old `dir02_SE` -> new `dir00_E`
- old `dir03_SSE` -> new `dir01_ESE`
- old `dir04_S` -> new `dir02_SE`
- old `dir05_SSW` -> new `dir03_SSE`
- old `dir06_SW` -> new `dir04_S`
- old `dir07_WSW` -> new `dir05_SSW`
- old `dir08_W` -> new `dir06_SW`
- old `dir09_WNW` -> new `dir07_WSW`
- old `dir10_NW` -> new `dir08_W`
- old `dir11_NNW` -> new `dir09_WNW`
- old `dir12_N` -> new `dir10_NW`
- old `dir13_NNE` -> new `dir11_NNW`
- old `dir14_NE` -> new `dir12_N`
- old `dir15_ENE` -> new `dir13_NNE`

## Validation

- PNG count before rename: `2560`
- PNG count after rename: `2560`
- Turret/faction/mod folders checked: `160`
- Each folder still contains exactly `16` PNG files
- Filename pattern check: `PASS`
- Temporary filename residue: `0`
- PNG size multiset preservation per folder: `PASS`
- PNG SHA-256 multiset preservation per folder: `PASS`
- Scope of asset changes: rename/remap only under `public/assets/units/turrets`

## Out of scope

- No runtime integration
- No preload changes
- No renderer changes
- No gameplay changes
- No source asset regeneration

## Next step

- After merge, run the hull+turret runtime integration audit against the corrected asset naming.
