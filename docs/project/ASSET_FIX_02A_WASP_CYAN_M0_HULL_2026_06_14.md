## ASSET-FIX-02A — Wasp cyan m0 hull sprites

Date: 2026-06-14

### Scope

- Replaced only the 16 files under `public/assets/units/hulls/wasp/cyan/m0/wasp_cyan_m0_dir*.png`.
- No runtime code changed.
- No renderer code changed.
- No loader code changed.
- No metadata JSON changed.
- No turret assets changed.

### Root Cause

The repo contained two Wasp cyan m0 hull sets in the same folder:

- bad target set: `wasp_cyan_m0_dir*.png`
- healthy sibling set: `wasp_cyan_m0_hull_dir*.png`

The bad target set used the correct filenames and 512x512 frame size, but its rendered hull occupied a much smaller alpha footprint and did not match the projection/scale family used by Wasp `m1/m2/m3` and the other approved hulls.

The sibling `_hull_` set already matched the expected fixed-frame contract and the healthy Wasp controls, so this fix replaced the bad target files one-for-one from that compatible source set.

### Replacement Count

- Replaced files: 16
- Paths and filenames preserved: yes
- Frame size preserved: `512x512`
- Alpha/transparency preserved: yes

### Validation

- `git status --short`
  - only 16 modified files, all under `public/assets/units/hulls/wasp/cyan/m0/`
- `npm run typecheck`
  - PASS
- `npm run build`
  - PASS
- `npm run test -- src/__tests__/modularRuntime01.test.ts`
  - PASS (`37` tests)

### Manual QA

Live QA was run in the devtools modular preview (`?skipMenu&devtools=1&arena=1`):

- Wasp `m0` + Smoky `m0`
  - PASS
- Wasp `m0` + Railgun `m3`
  - PASS
- Wasp `m1` + Smoky `m1` control
  - PASS
- Dictator `m0` + Smoky `m0` control
  - PASS

Observed result:

- Wasp `m0` now renders at the same projection/scale family as the healthy Wasp controls.
- Modular composition remained available in all QA combinations.
- No code-path regressions were introduced by this asset-only fix.
