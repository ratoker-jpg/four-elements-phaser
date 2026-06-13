# GLM Prompt — PR #263 Wasp Socket Data Fix

Repo: `ratoker-jpg/four-elements-phaser`

PR: `#263 — TURRET-HULL-CONTRACT-PR-F2: wire directional Smoky turret rendering`

Branch: `turret-hull-contract-pr-f2`

## Mode

IMPLEMENTATION — narrow data/test patch only.

Do **not** merge PR #263.  
Do **not** open a new PR.  
Do **not** create broad refactors.  
Do **not** modify renderer math.  
Do **not** change origin/scale/offset formulas.  
Do **not** change Smoky pivot.  
Do **not** modify assets.  
Do **not** touch `public/assets/units/hulls/`.  
Do **not** restore deleted legacy paths:

```text
public/assets/units/chassis/wasp_m0/
public/assets/units/weapons/smoky_m0/
```

Do **not** touch combat, movement, economy, pathfinding, save/load, mapgen.

## Read first

Read current branch files before editing:

```text
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/TURRET_HULL_SOCKET_RECOVERY_HANDOFF_2026_06_13.md
docs/project/TURRET_HULL_ATTACHMENT_AUDIT_2026_06_12.md
docs/project/CAMERA_PROJECTION_CONTRACT.md
docs/project/GLM_EXECUTOR_RULES.md
```

If a doc is missing from the PR branch but exists on current `main`, read it from `main` and mention that in the report.

## Context

PR #263 is **HOLD / DO NOT MERGE**.

Renderer math is not the blocker.

Runtime debug already proved:

```text
computed hull socket world point == computed turret pivot world point
distance ~= 0
```

Current corrective audit found:

- `src/config/hullTurretVisualProfiles.ts` already has `WASP_HULL_VISUAL_PROFILE.sockets[0].perDir`.
- `src/config/turretAttachmentMath.ts` already has `resolveSocketNormForDir()` and reads `socketProfile.perDir?.[dir16]`.
- Current Wasp `perDir` is wrong:
  - it is shifted by `+52/512` in Y;
  - it is keyed by projection direction, while runtime lookup uses `hullVisualDir16`;
  - renderer passes `md.hullVisualDir16` directly into `resolveSocketNormForDir`.
- Correct representation: **store `perDir` keyed by runtime visual dir16 with pre-shifted +2 raw values**.
- Do not add remap logic to lookup.
- Do not double-apply existing Wasp hull `+4` facingOffset.
- Do not apply +52.

## Exact data patch

In `src/config/hullTurretVisualProfiles.ts`, replace the current `WASP_HULL_VISUAL_PROFILE.sockets[0].perDir` block with this raw/no+52, runtime-keyed data:

```ts
      perDir: {
        0:  { nx: 0.360491, ny: 0.357876 },  // runtime visual dir00 -> projection dir02 raw
        1:  { nx: 0.371110, ny: 0.337738 },  // runtime visual dir01 -> projection dir03 raw
        2:  { nx: 0.401352, ny: 0.320666 },  // runtime visual dir02 -> projection dir04 raw
        3:  { nx: 0.446612, ny: 0.309258 },  // runtime visual dir03 -> projection dir05 raw
        4:  { nx: 0.500000, ny: 0.305253 },  // runtime visual dir04 -> projection dir06 raw
        5:  { nx: 0.553387, ny: 0.309258 },  // runtime visual dir05 -> projection dir07 raw
        6:  { nx: 0.598647, ny: 0.320666 },  // runtime visual dir06 -> projection dir08 raw
        7:  { nx: 0.628889, ny: 0.337738 },  // runtime visual dir07 -> projection dir09 raw
        8:  { nx: 0.639509, ny: 0.357876 },  // runtime visual dir08 -> projection dir10 raw
        9:  { nx: 0.628889, ny: 0.378015 },  // runtime visual dir09 -> projection dir11 raw
        10: { nx: 0.598647, ny: 0.395087 },  // runtime visual dir10 -> projection dir12 raw
        11: { nx: 0.553387, ny: 0.406494 },  // runtime visual dir11 -> projection dir13 raw
        12: { nx: 0.500000, ny: 0.410500 },  // runtime visual dir12 -> projection dir14 raw
        13: { nx: 0.446612, ny: 0.406494 },  // runtime visual dir13 -> projection dir15 raw
        14: { nx: 0.401352, ny: 0.395087 },  // runtime visual dir14 -> projection dir00 raw
        15: { nx: 0.371110, ny: 0.378015 },  // runtime visual dir15 -> projection dir01 raw
      },
```

Also update the nearby comment so it says:

```text
- values are projection-backed raw/no+52 candidates;
- stored keys are runtime visual dir16;
- value for runtime dir d comes from projection dir (d + 2) mod 16;
- still candidate data pending final visual acceptance / F3C;
- do not add +52 postprocess shift.
```

## Tests to update/add

Update existing tests that currently lock shifted/old values.

Likely files:

```text
src/__tests__/turretSpriteMountingAdapter.test.ts
src/__tests__/waspSocketCalibrator.test.ts
src/__tests__/turretAssetBasisBinding.test.ts
src/__tests__/turretAttachmentMath.test.ts
src/__tests__/hullTurretVisualProfiles.test.ts
```

Do not invent unrelated test rewrites. Keep changes minimal.

Required assertions:

1. `resolveSocketNormForDir('wasp', 'turret_main', 4)` returns approximately:

```ts
{ x: 0.5, y: 0.305253 }
```

This proves runtime visual dir04 maps to projection dir06 raw.

2. It is close to manual sanity check:

```ts
manual = { x: 0.506821, y: 0.326525 }
distance ≈ 0.022338846
```

Use a reasonable tolerance. Do not use the manual point as production data.

3. `+52` is not applied.

Guard example:

```ts
expect(socketDir4.y).not.toBeCloseTo(0.406815, 6);
expect(socketDir4.y).toBeCloseTo(0.305253, 6);
```

4. Add drift guard against the old shifted values:

```text
old shifted = raw + 52/512
```

5. Confirm `resolveSocketNormForDir` still uses `perDir` and falls back to base `normalized` if missing.

6. Confirm no new lookup remap was added. The `+2` must be absorbed into stored data, not runtime lookup.

## Do not change

Do not edit:

```text
src/config/turretAttachmentMath.ts
```

unless an existing test compile issue forces a tiny type-only adjustment. The audit says the helper already exists and is correct.

Do not edit:

```text
src/phaser/render/BlockoutVehicleRenderer.ts
```

Do not edit:

```text
src/config/directionalTurretProfiles.ts
```

Do not edit assets.

## Validation

Run:

```text
npm run typecheck
npm run test
npm run build
npm run qa:smoke
npm run qa:turret-assets
```

If `npm run test` wrapper has the known Vitest worker-fork teardown issue, run and report fallback:

```text
npx vitest run --root . --pool=threads
```

Do not hide failures.

## Report

After implementation, report:

```text
- exact files changed;
- exact old/new Wasp dir04 value;
- whether +52 was removed;
- whether +2 is stored in data, not lookup;
- validation results;
- whether GPT review is needed.
```

Final line:

```text
Ready for GPT review.
```

## Telegram

After completing the task, send Denis a Telegram notification if the notification config exists.  
If config is missing, report that it was skipped; do not block the task.

Message should include:

```text
- task name
- short result
- validation status
- GPT review needed: yes
```
