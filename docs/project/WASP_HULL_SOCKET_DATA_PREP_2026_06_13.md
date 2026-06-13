# WASP_HULL_SOCKET_DATA_PREP_2026_06_13.md

Task: Data preparation for projection-backed Wasp turret socket (steps 1–5).
Branch: `claude/friendly-einstein-0ho784` (tooling / projection-recovery only).
Date: 2026-06-13.
Status: **Step 1 done (in-repo investigation); steps 2–5 are LOCAL** (need the
gitignored `.3ds` source + a renderer; this container has neither).

Hard rules (unchanged): no renderer-math change, no turret-pivot change, no
hand-calibrated per-dir socket values as source of truth, do not merge #263.

---

## Step 1 — Which exact Wasp 3D source generated the shipped PNGs?

**Finding: the repository does not record it, and the shipped pixels were
almost certainly NOT produced by the committed Blender script.** This is itself
a data gap that must be closed locally before re-rendering.

### 1.1 What the repo records

- Shipped hulls were added in commit `f7ce69c` *"ASSET: add generated hull
  sprite matrix"* (ratoker, 2026-06-06). The only companion file is
  `public/assets/units/hulls/README.md`, which says merely *"Generated 512x512
  transparent hull sprites … 7 hulls × 4 factions × 4 mods × 16 directions"* —
  **no source filename, no tool, no camera/scale, no manifest**.
- Two **different** source-naming conventions appear in docs, unreconciled:
  - `wasp.3ds` (+ `wasp_0_details.png`, `wasp_0_lightmap.jpg`) — the Blender
    pipeline README/roadmap (`tools/blender/README.md`,
    `UNIT_ASSET_PIPELINE_ROADMAP_2026_06_04.md`).
  - `Wasp_0123.3ds` style — the TankViewer `config.xml` convention used by the
    web exporter (`tools/tankviewer-web-exporter/`, `tankviewerManifest.test.ts`).
    `config.xml` is the **source-of-truth for file mapping** and also carries
    `camera-radius` (default 750).
- The `.3ds` sources live under `art/source/tankviewer/` which is **gitignored**
  and absent here. So the actual file that was used cannot be inspected in-repo.

### 1.2 Technical fingerprint of the shipped PNG (generator evidence)

Decoded `public/assets/units/hulls/wasp/cyan/m0/wasp_cyan_m0_hull_dir00_E.png`:

- `512×512`, RGBA8 (color type 6).
- Ancillary chunks: `sRGB, gAMA, cHRM, eXIf, oFFs, pHYs`.
- `pHYs = 2834×2834 px/m` (= **72 DPI**), `oFFs = (0,0)`, `eXIf` present.
- **No `tEXt`/`iTXt` "Software" chunk.**

Blender EEVEE PNG output does **not** add `eXIf`, a 72-DPI `pHYs`, or `oFFs` by
default, and the committed `render_tank_sprite.py` writes no text metadata
either. The `eXIf`+`oFFs`+72-DPI `pHYs` combination is the signature of a
post-processed / image-library re-save (or a non-Blender exporter), **not** the
committed Blender path. ⇒ Re-rendering Wasp with `render_tank_sprite.py` will
not, by default, reproduce the shipped framing/scale unless its parameters are
matched to whatever actually made these PNGs.

### 1.3 Geometric fingerprint of the shipped framing (verification baseline)

Alpha bounding box + alpha centroid per direction, Wasp cyan m0 (canvas 512,
center = 255.5):

| dir | bbox (minx,miny,maxx,maxy) | w | h | bboxCx | bboxCy |
|----:|---|---:|---:|------:|------:|
| 0 E   | (33,139,478,380) | 446 | 242 | **255.5** | 259.5 |
| 1 ESE | (27,150,484,370) | 458 | 221 | **255.5** | 260.0 |
| 2 SE  | (55,161,456,351) | 402 | 191 | **255.5** | 256.0 |
| 3 SSE | (27,139,484,366) | 458 | 228 | **255.5** | 252.5 |
| 4 S   | (33,124,478,372) | 446 | 249 | **255.5** | 248.0 |
| 5 SSW | (73,118,438,369) | 366 | 252 | **255.5** | 243.5 |
| 6 SW  | (141,124,370,356)| 230 | 233 | **255.5** | 240.0 |
| 7 WSW | (73,118,438,369) | 366 | 252 | **255.5** | 243.5 |
| 8 W   | (33,124,478,372) | 446 | 249 | **255.5** | 248.0 |
| 9 WNW | (27,139,484,366) | 458 | 228 | **255.5** | 252.5 |
| 10 NW | (55,161,456,351) | 402 | 191 | **255.5** | 256.0 |
| 11 NNW| (27,150,484,370) | 458 | 221 | **255.5** | 260.0 |
| 12 N  | (33,139,478,380) | 446 | 242 | **255.5** | 259.5 |
| 13 NNE| (73,139,438,379) | 366 | 241 | **255.5** | 259.0 |
| 14 NE | (141,150,370,367)| 230 | 218 | **255.5** | 258.5 |
| 15 ENE| (73,139,438,379) | 366 | 241 | **255.5** | 259.0 |

Reads:

- **Horizontally fixed-camera centered.** `bboxCx ≡ 255.5` for **every**
  direction. This is consistent with a fixed orthographic camera where the
  model's vertical (Z) rotation axis sits at world origin and projects to
  canvas x-center (`basisZ.x = 0` ⇒ height never moves x; origin ⇒ center). It
  is **not** per-frame re-cropping. Good news: `render_tank_sprite.py`'s
  fixed-camera-about-origin model reproduces this **iff** the model origin is on
  the turret axis and `ortho_scale` matches.
- **Clean E↔W mirror symmetry** (dir1≡11, 3≡9, 4≡8, 5≡7, 13≡15, 0/12, 2/10),
  confirming a symmetric isometric render — the socket's projected `nx` must be
  mirror-symmetric too (a correctness check on the projection output).
- **Vertical position tracks direction** (`bboxCy` 240→260): this is exactly
  why one physical socket projects to a different `ny` per frame.
- **Ground-contact cross-check.** Hull bottom (`maxy` ≈ 351–380) sits near
  `0.75·512 = 384`, matching `GENERATED_HULL_ORIGIN_Y = 0.75` (anchor =
  bottom-center). The runtime hull origin is consistent with the art.

This table is the **acceptance fingerprint**: any re-render intended to back the
socket projection must reproduce `bboxCx ≈ 255.5` for all dirs and the same
`bboxCy`/`w`/`h` profile (±~1–2 px). If it does not, the re-render used a
different camera/scale than the shipped PNGs and its projected sockets must
**not** be adopted against the shipped pixels.

(Reproduce locally with the decoder in §3.4.)

### 1.4 Step-1 conclusion

The exact generator is **unconfirmed in-repo**. Before step 3, Denis must
establish, from the **local** TankViewer archive, which `.3ds` + which tool +
which exact parameters produced the shipped 512² hulls — or decide to
re-baseline (strategy B below).

---

## Decision before steps 2–5: which pipeline backs the pixels?

Because the original generator is unrecorded, there are two clean ways forward.
Pick one **before** placing the Empty, because it changes whether the shipped
hull PNGs stay or get replaced:

- **Strategy A — match the original generator (keep shipped PNGs).**
  Identify the exact tool+params (from local `config.xml` / the original render
  command), add `socket_turret_main` in that pipeline's scene, re-project the
  socket through *that* camera, and adopt the per-dir values against the
  **existing** shipped PNGs. Lowest blast radius (no asset churn) but requires
  recovering the original generator faithfully; the §1.3 fingerprint must match.

- **Strategy B — re-baseline on `render_tank_sprite.py` (replace Wasp PNGs).**
  Render the Wasp m0 hull **and** project the socket from the *same* Blender
  camera in one pass (the §5 socket stage already in this branch), then ship the
  new Wasp hull PNGs alongside the projected sockets. Guarantees pixels and
  socket share one camera by construction; cost is replacing the Wasp hull
  matrix (at least m0) and re-confirming `ortho_scale`/centering to keep the
  runtime look. The §1.3 fingerprint becomes the new baseline.

Strategy B is more robust (no reverse-engineering); Strategy A is less invasive.
This is an owner call — see the open question at the end.

---

## Steps 2–5 — local runbook (Denis)

> All steps run on the machine that holds `art/source/tankviewer/…`. Nothing
> here is auto-runnable in the web container.

### Step 2 — place ONE Empty `socket_turret_main`
- Open the Wasp model used for the shipped render (Strategy A) or `wasp.3ds`
  (Strategy B) in Blender.
- Add a single **Empty** named exactly `socket_turret_main` at the **turret
  ring centre** (the physical mount), in the unrotated/rest model frame, on the
  model's Z rotation axis at the correct height. One physical socket — no
  per-direction authoring.
- Optional: an Empty named `socket_<other>` adds more sockets; each is projected
  independently.

### Step 3 — re-render Wasp with the SAME 512² pipeline
- Strategy B (Blender), cyan m0, with the socket stage already in this branch:
  ```bash
  blender --background --python tools/blender/render_tank_sprite.py -- \
      --source art/source/tankviewer/data/hulls/wasp \
      --model wasp.3ds \
      --diffuse wasp_0_details.png \
      --lightmap wasp_0_lightmap.jpg \
      --output art/generated/tankviewer/hulls/wasp/m0 \
      --directions 16 --faction cyan --name wasp_m0_hull \
      --resolution 512 --orthographic-scale <CONFIRMED>
  ```
  `--orthographic-scale` must be the value that reproduces the §1.3 fingerprint
  (verify, do not guess). Strategy A: run the original tool with the socket
  Empty added, exporting the same per-dir framing.

### Step 4 — emit projected socket per-dir values
- The branch's `render_tank_sprite.py` now writes, per manifest entry:
  ```json
  "sockets": { "turret_main": { "nx": <projected>, "ny": <projected> } }
  ```
  plus a top-level `socketProjection` block (method = `world_to_camera_view`,
  space = normalized sprite, marker = `socket_turret_main`). These are
  **generated projection output** of one model-space marker — never eye-tuned.
- Sanity: the manifest `nx` series must be E↔W mirror-symmetric (per §1.3); if
  not, the Empty is off-axis.

### Step 5 — replace the low-confidence socket data
- Swap `WASP_HULL_VISUAL_PROFILE.sockets[0].perDir` in
  `src/config/hullTurretVisualProfiles.ts` with the manifest values, citing the
  manifest as projection output (remove the "LOW confidence / candidates"
  notice). Map manifest dir index → the runtime `perDir` keys (dir16).
- Keep the runtime `resolveSocketNormForDir`/attachment math unchanged (already
  correct). Re-validate with `?turretAnchorDebug=1` (Δ≈0 already) and visual QA.
- `WaspSocketCalibrator` reverts to a **verification** overlay only; it is no
  longer a data source.

---

## §3.4 — Re-render verification decoder (no PIL/numpy needed)

The pure-`zlib` PNG alpha-bbox decoder used to produce §1.3 is reproducible:
decode IDAT, unfilter (PNG filters 0–4), threshold alpha > 16, report
`bbox`/`bboxCx`/`bboxCy` per direction, and compare against §1.3 (±1–2 px). A
matching fingerprint is the gate that lets the projected sockets be trusted
against the shipped pixels. (Script kept ad-hoc; can be promoted to
`tools/` if we adopt Strategy B and want a CI framing guard.)

---

## Open question for the owner

Was the shipped Wasp hull matrix rendered by the Blender
`render_tank_sprite.py` path, the `tankviewer-web-exporter`, or the original
TankViewer tool + a post-process? The answer selects **Strategy A vs B** and
determines whether the shipped Wasp PNGs are kept or replaced. Until it is
answered, no socket values are adopted (no guessing).
