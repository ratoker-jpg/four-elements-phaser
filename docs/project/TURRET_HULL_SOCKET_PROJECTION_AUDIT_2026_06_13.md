# TURRET_HULL_SOCKET_PROJECTION_AUDIT_2026_06_13.md

Task: Audit PR #263 socket pipeline against the original 3D-projection contract.
Mode: AUDIT + minimal non-guessing pipeline restoration.
Repo: `ratoker-jpg/four-elements-phaser`
PR under audit: #263 (`turret-hull-contract-pr-f2`), head `538e5b7`.
Date: 2026-06-13.

Hard constraints honored (from the task):
- One physical socket in hull/model space is the only allowed source of truth.
- Per-dir 2D coordinates are allowed **only** as generated projection output.
- Do **not** hand-calibrate `perDir` values as source of truth.
- Do **not** change renderer math, turret pivot, or tune offsets by eye.

> This document does **not** write any socket coordinate into the runtime
> profile and does **not** change renderer math, the turret pivot, or any
> offset. It states precisely why the current data is wrong, what data is
> missing, and restores the deterministic projection stage that was never
> actually built — so that, once the single missing input (the model-space
> mount marker) is supplied, per-dir socket values are *generated*, not tuned.

---

## 0. TL;DR

1. **The runtime attachment math is already correct.** PR #263's own
   `?turretAnchorDebug=1` diagnostic proves the computed hull-socket world
   point and the computed turret-pivot world point coincide (Δ ≈ 0). The
   detachment Denis sees is **not** a renderer-math bug.

2. **The Wasp hull socket `perDir` data is wrong because it was never a real
   projection.** The values in `WASP_HULL_VISUAL_PROFILE.sockets[0].perDir`
   are a smooth synthetic ellipse recovered from a *"manual current Blender
   scene"* whose **original exporter manifest was not found** (so stated
   in-source). They are explicitly labelled *"projection candidates only …
   LOW confidence."* They do not correspond to the camera/scale/centering
   that produced the **shipped** 512×512 Wasp hull PNGs.

3. **The projection-backed socket stage does not exist in the committed
   pipeline.** `tools/blender/render_tank_sprite.py` renders the hull and
   writes a manifest, but it **never projects any mount marker** into sprite
   space. So there was no code path that could have produced contract-correct
   per-dir socket values; the ellipse came from out-of-tree approximation.

4. **The current "fix" in the branch is exactly what the task forbids.**
   `WaspSocketCalibrator` (`?turretSocketCalibrate=1`) is a manual,
   per-direction, move-the-marker-by-eye tool that prints copy-ready
   `dirNN: { nx, ny }` lines for a human to paste into the profile. That is
   hand-calibration as source of truth — the practice we are told to stop.

5. **Enough data does NOT exist to *generate* correct values inside this
   repo.** The one physical hull mount marker lives in the `.3ds` source
   (`art/source/tankviewer/`, **gitignored**, not present), and the exact
   exporter parameters used for the **shipped** 512px hulls are unverified
   (the committed script defaults to 256px / ortho_scale 4.0). Per the task's
   explicit fallback, this document is the **precise missing-data report**,
   plus the restored projection stage that consumes the marker once provided.

---

## 1. The intended contract (restated from the audit)

`docs/project/TURRET_HULL_ATTACHMENT_AUDIT_2026_06_12.md` §5–§7 defines the
socket as a single mount point authored **once**, in hull-local/model space,
projected into the sprite frame by the renderer/exporter — never authored
per-direction in screen pixels. The task sharpens this to the asset-generation
side:

> Use the **3D hull mount marker** as the single physical socket source.
> Project that marker into the **same 512×512 generated Wasp hull PNG space**
> that the runtime loads. Per-dir 2D coordinates are allowed only as the
> *output* of that projection.

So the contract is a function:

```
perDir[d].{nx, ny}  =  Project( hullMountMarker_modelSpace , Camera_d )
```

where `Camera_d` is the exact camera/orthographic-scale/resolution/centering
used to render `wasp_<faction>_m0_hull_dir<d>_<DIR>.png`, and the marker is a
single 3D point fixed in the hull model. Everything on the right-hand side
must come from the asset pipeline, not from a human nudging pixels.

---

## 2. What PR #263 actually does (pipeline trace)

### 2.1 Runtime consumption chain (correct, keep as-is)

```
bodyAngle ──bodyAngleToDir8──► dir8 ──×2──► logical dir16 ──Wasp visual remap──► hullVisualDir16
                                                                                      │
turretAngle ─► turretAngleToVisualDir16(weapon) ─► turretVisualDir16 ─► pivot lookup  │
                                                                                      ▼
   resolveSocketNormForDir('wasp','turret_main', hullVisualDir16)  ──►  socket {nx,ny}
   resolveTurretPivotForDirByBasis('smoky', basis, turretVisualDir16) ─►  pivot {px,py}
                                                                                      │
   computeTurretSpriteCenterOffsetForSocket(socketNorm, pivotNorm, origins, sizes) ──► offset
```

Files:
- `src/config/turretSpriteMountingAdapter.ts` — `bodyAngleToHullVisualDir16`,
  `turretAngleToVisualDir16`, `resolveTurretSpriteMountingData`.
- `src/config/turretAttachmentMath.ts` — `resolveSocketNormForDir`,
  `computeTurretSpriteCenterOffsetForSocket`.
- `src/config/hullTurretVisualProfiles.ts` — `WASP_HULL_VISUAL_PROFILE`
  (the `perDir` socket table).
- `src/phaser/render/BlockoutVehicleRenderer.ts` — applies the offset.

This chain is **internally consistent and origin-aware** (hull origin
`(0.5, 0.75)`, turret origin `(0.5, 0.5)`). It is **not** the problem. The
direction-source split (hull socket dir from `bodyAngle`, turret pivot dir
from `turretAngle`) is correct and must be preserved.

### 2.2 The data the chain reads (the problem)

`WASP_HULL_VISUAL_PROFILE.sockets[0].perDir` (hullTurretVisualProfiles.ts) is
a 16-entry table. Plotting it, it is a near-perfect ellipse centred at
≈`(0.5, 0.459)`, x∈[0.360, 0.640], y∈[0.407, 0.512] — i.e. a smooth
parametric curve, the signature of "project a guessed offset through a guessed
camera," not a measurement of the real hull pixels. The in-source comment is
explicit:

> *"Per-direction overrides come from Codex projection recovery … LOW
> confidence because the recovered hull exporter used a manual current Blender
> scene. The original manifest was not found. Do NOT treat these as final
> hand-approved values — they are projection candidates only."*

So the runtime is consuming **approximated** projection output whose camera
basis does not match the shipped PNGs. That is the direct cause of the
mis-seated turret in Denis' screenshots.

### 2.3 The current remediation is hand-calibration (forbidden)

`src/phaser/debug/WaspSocketCalibrator.ts` + the `?turretSocketCalibrate=1`
path in `BlockoutVehicleRenderer.ts` let a human move the socket marker per
direction and emit `dirNN: { nx, ny }` lines to paste back into the profile.
The PR comment thread confirms the intended workflow: *"Step through the
directions, align the marker to the real turret mount … Send back the
copy-ready lines … Those values will then replace the perDir candidates."*

This makes **eye-tuned per-dir pixels the source of truth** — exactly the
anti-pattern the task and the §3.6 audit verdict reject. It should not be the
path to ground truth (it is fine to keep strictly as a *visual verification*
overlay, but not as the data source).

---

## 3. Why the data does not match the hull PNG — root cause

| # | Cause | Evidence |
|---|---|---|
| RC-A | Socket values are synthetic, not projected from the shipped render | Perfect ellipse; in-source "LOW confidence / manifest not found" |
| RC-B | The projection stage was never implemented in the committed exporter | `render_tank_sprite.py` renders + writes a manifest but contains **no** marker→pixel projection; no socket field in its manifest schema |
| RC-C | The marker (single model-space socket) is unavailable in-repo | `.3ds` sources live under `art/source/tankviewer/` which is **gitignored**; no `.3ds`, no marker JSON, no `hull_mount_sockets.json` is committed |
| RC-D | The exact shipped-render camera params are unverified | Shipped hulls are 512×512; the committed script + README command use `--resolution 256` and `--orthographic-scale 4.0`. The ortho-scale/centering/tool actually used for the shipped 512 PNGs is not recorded anywhere in the repo |

Net: the right-hand side of the contract function (§1) is **not reconstructable
from committed data**. Any number written today would be a guess. The runtime
math (§2.1) is correct, so once the inputs are real, attachment is solved with
no renderer change.

The five files the task lists as "relevant local files"
(`asset_socket_projection_report.md`, `asset_socket_projection_plan.json`,
`hull_mount_socket_report.md`, `project_3d_markers_to_sprite_space.py`,
`hull_mount_sockets.json`) are **not present in the working tree, the PR
branch, or any git history**. They are uncommitted local artifacts. They are
the very projection contract the runtime should consume; the fact that the
runtime instead consumes "recovery candidates" is itself the regression.

---

## 4. What is present vs missing (the missing-data report)

### 4.1 Present and trustworthy (in-repo)

- **Camera orientation contract** — `tools/blender/render_tank_sprite.py` and
  `src/config/cameraProjectionContract.ts`:
  - `basisX = {38, 19}`, `basisY = {-38, 19}`, `basisZ = {0, -60}`.
  - Azimuth `45°`, elevation `arctan(1/√2) ≈ 35.264°`, orthographic camera.
  - `ROTATION_OFFSET_DEG = 225` (model default forward +Y → dir0 = screen-E).
  - Vertical stretch `|basisZ.y| / (TILE_H/2) = 60/19 ≈ 3.158`.
- **Per-direction step** — 16 dirs, `angle_d = 225 + d·22.5°`.
- **The shipped 512×512 Wasp hull PNGs** — `public/assets/units/hulls/wasp/…`.
- **A correct, origin-aware runtime attachment chain** (§2.1) and a proven
  self-consistency diagnostic (`?turretAnchorDebug=1`).

### 4.2 Missing — required to *generate* contract-correct values

| Missing input | Where it must come from | Blocking? |
|---|---|---|
| **M1. Hull mount marker** — one 3D point in `wasp.3ds` model space (the turret ring centre / socket), authored once | A named `Empty` placed in the Blender scene / `.3ds`, under `art/source/tankviewer/` (gitignored). Owner: Denis (art truth) | **Yes** — this is the single physical socket |
| **M2. Exact shipped-render parameters** for the 512px hulls: `ortho_scale`, `resolution`, camera, any post-crop/recenter | The tool + arguments actually used to produce `public/.../hulls/wasp/...`. Must be confirmed (Blender script vs `tools/tankviewer-web-exporter/`) and pinned | **Yes** — the projection must use the *same* camera that made the shipped pixels |
| **M3. Model origin / framing** — where the model origin sits relative to canvas centre at render time | Determined automatically by M2 if projection is done **inside** the render (see §5); otherwise must be measured | Resolved by §5 |

If M1 + M2 are supplied, M3 is automatic and the projection is exact (no
guessing). Without M1 or M2, **stop** — do not write numbers.

---

## 5. Restored projection stage (this PR's only code change)

The cleanest way to guarantee the projection uses the *same* camera that
rendered the shipped pixels is to project **inside the renderer**, using
Blender's own camera transform — never a re-specified/approximated camera (the
mistake that produced the bad ellipse).

This PR adds a socket-projection stage to `tools/blender/render_tank_sprite.py`:

- For each rendered direction, after the model is rotated, any scene object
  whose name starts with `socket_` (e.g. `socket_turret_main`) is projected to
  normalized sprite coordinates via
  `bpy_extras.object_utils.world_to_camera_view(scene, camera, marker.world)`,
  which returns camera-space `(u, v)` in `[0..1]` using the **actual**
  `ortho_scale`, resolution, and camera pose of that very render.
- The result is converted to the sprite convention used by the runtime
  (`nx = u`, `ny = 1 − v`, because Blender's camera-view origin is
  bottom-left while sprite-space `ny` is top-down) and written into each
  manifest entry as `sockets: { socket_turret_main: { nx, ny } }`, plus a
  top-level `socketProjection` block describing the camera used.

Properties:
- **Exact, not guessed** — it reuses the render camera; if M2 is correct
  (same tool/params as the shipped PNGs), the output matches the shipped
  pixels to sub-pixel precision.
- **One physical socket** — a single `Empty` in model space; all 16 per-dir
  values are *derived* output. This is precisely the contract.
- **No eye-tuning, no runtime change** — the script only emits manifest data;
  nothing is written into `WASP_HULL_VISUAL_PROFILE` until Denis runs it and
  the values are reviewed as projection output.

The manifest the runtime should then consume is the generation output — the
same role the missing `hull_mount_sockets.json` was meant to play.

> Note on tooling (M2): if the shipped 512 hulls were produced by
> `tools/tankviewer-web-exporter/` rather than the Blender script, the same
> `world_to_camera_view`-equivalent projection must be added **there** so the
> camera matches. The report flags this as a required confirmation, not an
> assumption.

---

## 6. Recommended sequence (no guessing at any step)

1. **Confirm M2** — record the exact tool + parameters that produced the
   shipped 512×512 Wasp hull PNGs. Pin them into `render_tank_sprite.py`
   defaults (or the web exporter) so re-renders are byte-comparable.
2. **Author M1** — Denis places one `Empty` named `socket_turret_main` at the
   turret ring centre in the Wasp model (art truth; done once).
3. **Generate** — re-render Wasp M0 with the restored stage. The manifest now
   carries projection-derived per-dir `nx/ny`.
4. **Adopt** — replace `WASP_HULL_VISUAL_PROFILE.sockets[0].perDir` with the
   manifest values **as projection output** (ideally loaded/generated, not
   hand-copied), and add a `usesEvenDirOnly` note since only even dir16 frames
   are displayed.
5. **Verify, don't tune** — use `?turretAnchorDebug=1` to confirm Δ≈0 (already
   true) and visually confirm the marker now sits on the real mount. Keep
   `WaspSocketCalibrator` strictly as a *verification* overlay; demote its
   "copy-ready paste into profile" role.
6. **Generalize** — the same `Empty`-projection stage produces sockets for
   every hull with zero new code or calibration (closes the audit's RC-2 for
   all future hulls).

---

## 7. Explicit non-actions (constraint compliance)

- Did **not** modify `WASP_HULL_VISUAL_PROFILE.sockets[0].perDir` (would be
  guessing without M1/M2).
- Did **not** change renderer math (`turretAttachmentMath.ts`,
  `turretSpriteMountingAdapter.ts`, `BlockoutVehicleRenderer.ts`).
- Did **not** change the turret pivot or any `pivot`/basis value.
- Did **not** tune any offset by eye; added no per-dir constant.
- Did **not** touch gameplay angles, target-lock/rest, combat, preload, or
  the shipped hull/turret PNGs.

The only code change is the additive, offline socket-projection stage in the
Blender exporter (§5), which is the deterministic generation path the contract
requires and which the committed pipeline was missing.
