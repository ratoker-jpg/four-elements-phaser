# TURRET_HULL_SOCKET_RECOVERY_HANDOFF_2026_06_13.md

Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Date: 2026-06-13  
Status: **handoff / stop-point document**  
Scope: Wasp hull socket + Smoky turret attachment recovery  

---

## 0. Why this document exists

This document freezes the current conclusion so the project does not continue in the wrong direction.

The Wasp+Smoky attachment work went through several code and asset fixups. Runtime debug now proves the renderer math can make the computed hull socket and turret pivot coincide, but the visible turret still does not sit correctly unless the Wasp socket data is corrected. The next work must therefore focus on the **3D socket projection source**, not more renderer offset patches.

---

## 1. Current PR status

### PR #263

```text
PR #263 — TURRET-HULL-CONTRACT-PR-F2: wire directional Smoky turret rendering
URL: https://github.com/ratoker-jpg/four-elements-phaser/pull/263
Branch: turret-hull-contract-pr-f2
Status: HOLD / DO NOT MERGE
```

PR #263 currently contains useful work:

```text
- generated Smoky M0 turret resolver/pathing;
- real Smoky M0 512x512 16-dir assets for 4 factions;
- removal of legacy Wasp/Smoky 256 runtime paths from main/PR state;
- Wasp+Smoky renderer path;
- turret anchor debug overlay;
- Wasp socket calibration/debug tool.
```

But PR #263 must not be merged yet because:

```text
- Wasp socket data is still not projection-backed from the confirmed 3D source;
- visible Wasp+Smoky attachment still fails manual QA;
- current socket profile values are low-confidence candidates / temporary data;
- renderer math is not the remaining blocker.
```

### PR #264

If a PR #264 exists from `claude/cool-cerf-lms8s4`, it is a duplicate/side branch created by tooling. The calibration commit was moved into PR #263. Close #264 as duplicate if still open.

---

## 2. Debug evidence from PR #263

Runtime debug with:

```text
?turretAnchorDebug=1
```

showed:

```json
{
  "bodyAngle": 0,
  "turretAngle": 0,
  "hullTextureKey": "generated_hull_wasp_cyan_m0_dir04",
  "turretTextureKey": "generated_turret_smoky_cyan_m0_dir04",
  "hullVisualDir16": 4,
  "turretDir16": 4,
  "socketNorm": { "x": 0.401, "y": 0.422 },
  "pivotNorm": { "x": 0.499, "y": 0.515 },
  "deltaX": 0,
  "deltaY": 0,
  "distance": 0
}
```

Interpretation:

```text
computed hull socket world point == computed turret pivot world point
```

Therefore:

```text
renderer attachment math is working for the data it receives.
```

The visual failure means:

```text
Wasp socket profile data is wrong for the actual visible Wasp hull PNG / projection basis.
```

---

## 3. Manual runtime calibration reference only

Denis used `?turretSocketCalibrate=1` to find a visually plausible runtime value for current frame `dir04`:

```ts
dir04: { nx: 0.506821, ny: 0.326525 }
```

This value is useful as a **sanity check** only.

It must **not** become the production source of truth by itself.

Correct production source:

```text
single 3D socket point on Wasp source model
-> projected through the accepted hull render/export pipeline
-> per-dir 2D socket values generated from that projection
```

---

## 4. Correct conceptual model

Denis clarified the core rule:

```text
There is one physical attachment point on the hull.
The turret rotates around this point.
```

This is correct.

For 2D sprites, this becomes:

```text
one 3D socket point in hull/model space
-> one projected 2D point per rendered hull frame
```

So `perDir` values are allowed only as **projection output**, not as hand-calibrated source values.

Do not frame this as "16 different sockets." Frame it as:

```text
one physical 3D socket, projected into 16 visible hull frames
```

---

## 5. Original contract to preserve

The earlier attachment audit already warned against ad-hoc tuning:

```text
docs/project/TURRET_HULL_ATTACHMENT_AUDIT_2026_06_12.md
```

Important rule from that design:

```text
- Hull socket is a hull-local/model-space concept.
- Turret pivot is a turret-local/image-space concept.
- The renderer should attach pivot to socket through a declared contract.
- Repeated manual offset patches are a failure mode, not the production path.
```

Current work must follow that contract.

---

## 6. What was confirmed locally in Blender

Local Wasp source exists:

```text
D:\Desktop\Модели\3ds\Wasp_0123.3ds
```

The source contains at least:

```text
- hull
- mount
```

After opening the generated `.blend`, the first generated Empty was wrong because of a coordinate-basis mistake. A Blender scene audit showed it had been placed far from the hull.

Denis then corrected the intended socket definition:

```text
socket source = center of the `mount` cube
```

Not:

```text
- top face center
- manual runtime calibration marker
- arbitrary offset
```

Current accepted 3D source point:

```text
turret_mount_socket should be at the center of the Wasp `mount` object.
```

This is considered the correct 3D source-of-truth for Wasp.

---

## 7. Important local files and tools

These files may exist only on Denis' local machine or in chat artifacts, not necessarily in the repo:

```text
D:\Desktop\Модели\3ds\Wasp_0123.3ds
D:\Desktop\Модели\tools\extract_3ds_mount_offsets.py
D:\Desktop\Модели\tools\blender_place_mount_empty.py
D:\Desktop\Модели\tools\audit_blender_scene.py
D:\Desktop\Модели\tools\fix_wasp_mount_empty_center.py
D:\Desktop\Модели\docs\wasp_projection_recovery_runbook.md
D:\Desktop\Модели\Wasp_mount_socket.blend
D:\Desktop\Модели\Wasp_mount_socket_audit.json
```

Known issue found:

```text
The previous helper placed the Empty using the wrong coordinate basis.
The fix is to place `turret_mount_socket` at the world bbox center of object `mount`.
```

Use the `center of mount` rule unless Denis explicitly changes it.

---

## 8. What not to do next

Do **not** do any of the following by default:

```text
- do not merge PR #263;
- do not close PR #263 until the next project decision is made;
- do not continue blind renderer formula fixes;
- do not tune x/y offsets by eye;
- do not use manual `dir04` calibration as production source;
- do not update runtime Wasp socket data from guesses;
- do not change Smoky pivot data;
- do not change generated Smoky assets;
- do not touch `public/assets/units/hulls/` unless an explicit asset replacement PR is approved;
- do not render all hulls/weapons in one broad PR;
- do not commit `.3ds` source files to the game repo;
- do not let GLM plan this pipeline.
```

---

## 9. Next correct task

The next task is **not runtime implementation**.

It is projection pipeline recovery:

```text
WASP-SOCKET-PROJECTION-F3C
```

Goal:

```text
Use Wasp_0123.3ds and the confirmed mount-center socket to produce projection-backed per-dir socket coordinates for the Wasp 512x512 hull render basis.
```

Minimum accepted output:

```text
- a report explaining which render/export basis was used;
- projected Wasp socket perDir values for dir00..dir15;
- comparison against Denis dir04 runtime calibration as sanity check;
- a clear statement whether the output matches current shipped Wasp PNGs or requires a Wasp re-baseline;
- no runtime code changes unless explicitly approved after review.
```

---

## 10. Decision still open: match old PNGs or re-baseline Wasp

An agent found the current shipped Wasp PNG generator is not recorded clearly in the repo and may not be the committed Blender script.

There are two possible future paths:

### Path A — match current shipped Wasp PNGs

```text
Recover the exact generator/camera/crop/postprocess used by current `public/assets/units/hulls/wasp/...` PNGs, then project the confirmed 3D socket through that basis.
```

Pros:

```text
- lowest visual churn;
- keeps current hull PNGs.
```

Cons:

```text
- depends on recovering unknown generator params.
```

### Path B — re-baseline Wasp through Blender

```text
Render Wasp M0 hull PNGs and project socket in one controlled Blender pipeline.
```

Pros:

```text
- clean source of truth;
- socket projection guaranteed to match new Wasp PNGs.
```

Cons:

```text
- replaces Wasp hull matrix;
- needs Denis visual approval for visual churn.
```

No one should choose A/B by inertia. GPT/Denis must decide explicitly.

---

## 11. Recommended immediate stop state

Current best stop state:

```text
PR #263: HOLD / DO NOT MERGE
Projection recovery branch: leave as research/tooling
Runtime renderer math: stop changing
Wasp socket: confirmed 3D source = center of mount cube
Next action: GPT/Denis decide Path A or Path B before implementation
```

---

## 12. Prompt for the next GPT chat

Use this in a fresh GPT project chat:

```text
We are in Four Elements Phaser.
Repo: ratoker-jpg/four-elements-phaser.

Do not work from memory. Read the current repo docs before planning:
- docs/project/PROJECT_STATE.md
- docs/project/CURRENT_NEXT_STEP.md
- docs/project/TURRET_HULL_SOCKET_RECOVERY_HANDOFF_2026_06_13.md
- docs/project/TURRET_HULL_ATTACHMENT_AUDIT_2026_06_12.md
- docs/project/CAMERA_PROJECTION_CONTRACT.md
- docs/project/GLM_EXECUTOR_RULES.md

Current critical status:
PR #263 is open and must stay HOLD / DO NOT MERGE. It contains useful generated Smoky M0 assets, renderer wiring, debug overlay, and calibration tooling, but Wasp+Smoky visual QA still fails because Wasp socket data is not projection-backed.

Runtime debug proved renderer math is correct: socket == pivot, distance ~= 0. So do not change renderer math, origins, scales, or Smoky pivot as the next move.

The important discovery:
The correct Wasp 3D socket source is the CENTER of the `mount` cube in `Wasp_0123.3ds`, not the top face and not manual per-dir calibration. This is one physical 3D point. Per-dir 2D socket values should only be generated projection output.

Manual runtime calibration found a visual sanity-check value for current Wasp dir04:
dir04: { nx: 0.506821, ny: 0.326525 }
Use this only as a validation reference, not as source of truth.

Local files may exist on Denis' machine:
D:\Desktop\Модели\3ds\Wasp_0123.3ds
D:\Desktop\Модели\tools\extract_3ds_mount_offsets.py
D:\Desktop\Модели\tools\blender_place_mount_empty.py
D:\Desktop\Модели\tools\audit_blender_scene.py
D:\Desktop\Модели\tools\fix_wasp_mount_empty_center.py
D:\Desktop\Модели\docs\wasp_projection_recovery_runbook.md
D:\Desktop\Модели\Wasp_mount_socket.blend
D:\Desktop\Модели\Wasp_mount_socket_audit.json

Next task is NOT implementation. It is to decide and scope projection recovery:
Path A: recover/match the current shipped Wasp PNG generator.
Path B: re-baseline Wasp through Blender and produce Wasp PNGs + projected sockets from one source.

Do not give GLM a broad task. If implementation is needed, GPT must write a narrow task after reading the docs and current PR state.
```

---

## 13. Validation commands to keep using

Implementation PRs still need:

```text
npm run typecheck
npm run test
npm run build
npm run qa:smoke
```

Turret asset/runtime PRs additionally need:

```text
npm run qa:turret-assets
```

Manual visual QA remains mandatory for Wasp+Smoky attachment.
