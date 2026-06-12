# TURRET_HULL_ATTACHMENT_AUDIT_2026_06_12.md

Task: TURRET-HULL-ASSET-CONTRACT-AUDIT-01
Mode: AUDIT / DESIGN ONLY — no implementation, no code, no patch, no PR.
Project: Four Elements Phaser
Repo: `ratoker-jpg/four-elements-phaser`
Date: 2026-06-12
Status: design proposal for review (GPT / Denis). Not an accepted implementation queue.

---

## 0. How to read this document

This is an audit and a **proposed contract**. It does not change runtime
behavior. It answers one question:

> How should generated hulls and modular turrets be authored, described,
> loaded, attached, directed, upgraded, and rendered so the renderer can
> attach any supported turret to any supported hull predictably — without a
> new manual AI calibration patch every time?

It honors the hard constraints in the task:

- No PNG/asset editing proposed as the first solution.
- No full hull/turret matrix preload proposed.
- No change to gameplay angle semantics.
- No change to combat / target-lock / rest behavior.
- Standard mode stays lean; Arena loads a small curated set.
- Generated hulls and modular turrets stay graceful-fallback capable.
- Manual visual acceptance by Denis remains required for final alignment.

All file references are to the state of `main` after PR #254, plus the open
PR #255 (`FIX-OPUS-TURRET-VISUAL-01` + `01B`), which is the immediate subject
of this audit.

> **Manual QA update (2026-06-12, Denis):** PR #255 + 01B **still does not
> visually pass.** The Smoky turret is now *visible*, but it does **not sit /
> align like a properly attached weapon** on the Wasp hull; direction and mount
> still feel wrong. This is the **second** calibration pass to fail visual QA
> on the same pair. This audit treats that as decisive evidence that the
> current asset *convention layer* is insufficient (see §3.6 and §13), and
> deliberately does **not** propose another remap/offset patch as the answer.

---

## 1. Executive summary

The Arena render path has **two parallel, ad-hoc visual calibration systems**
(direction and mount) that are re-derived independently per asset family. There
is no single declared contract that says "this PNG family faces this way" or
"this hull exposes a turret socket here." As a result:

- Hull direction needs an empirical remap (`WASP_HULL_VISUAL_DIR16_REMAP`,
  `+4` dir16). This remap is **Wasp-only and hardcoded**.
- The Smoky turret sprite (PR #255) had to **re-borrow the Wasp hull remap**
  to face correctly, and currently hardcodes `'wasp'` regardless of the real
  hull. That is the direct cause of the 01B "wrong visual dir" finding.
- The turret has **no real socket**. PR #255 glues the turret sprite to the
  hull sprite's center with a derived `socketLift`, while the procedural
  mount uses a different formula (`MOUNT_FRACTION_MAP`), and the legacy
  static path uses a third (`MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR`
  hand-tuned per-dir table). The 01B "double-counted hull placement offset"
  finding came from two of these systems both adding the hull offset.

These are not bugs in PR #255 specifically; PR #255 is a reasonable tactical
fix. They are **symptoms of a missing contract**. Every new hull, turret,
weapon, or mod tier will reproduce the same two calibration problems
(facing offset + socket offset) and demand another hand-tuned constant.

**Recommendation (detail in §13):** **do not merge PR #255/01B** — it failed
visual QA twice and a third small patch would not fix it (the limitation is
structural, not a wrong constant). **Keep it open as a non-merging reference**
(option 2) whose reusable parts — the turret resolver, sprite lifecycle, and
tests — fold into the contract slices; close it (option 3) the moment there is
any risk of it being merged by inertia. Then adopt the contract below. The
first contract slice (§14) is a **read-only data layer** that reproduces
today's exact numbers, so it ships with zero visual change and full test
coverage.

The contract's core idea is three small declarative profiles plus one rule:

1. **HullVisualProfile** — scale, origin, direction count, a single
   `assetFacingOffset`, placement offset, and a socket list.
2. **TurretVisualProfile** — scale, origin, direction count, a single
   `assetFacingOffset`, target socket id, recoil hooks.
3. **SocketProfile** — a named mount point in **normalized hull-local
   coordinates** (the `mountOffsetNormalized` field that already exists in
   `BodyProfile` but is currently ignored), plus a z-height.
4. **One rule:** the renderer computes the hull's composite transform **once**
   (anchor + permanent + debug + recoil), then derives every socket and the
   turret from that single transform. Turrets never re-derive hull offsets.

---

## 2. Current state map

### 2.1 Two render paths for the same assets

| Path | File | Used by | Direction model | Mount model |
|---|---|---|---|---|
| Arena / blockout | `BlockoutVehicleRenderer.ts` + `blockoutVehicleGeometry.ts` | Controllable Arena vehicles | continuous `bodyAngle`/`turretAngle` → dir8 → dir16 → Wasp remap | procedural `MOUNT_FRACTION_MAP`, plus PR #255 turret-sprite "glue to hull center" |
| Legacy / static | `ModularTankRenderer.ts` | Debug static Wasp+Smoky entity | discrete `entity.dir` / `entity.turretDir` | hand-tuned `MODULAR_TANK_*_BY_BODY_DIR` per-dir pixel tables |

CODEMAP (§11) already warns these are distinct and that controllable Arena
vehicles must not be routed through `ModularTankRenderer`. They nevertheless
**share the same PNG assets** and **disagree on how those PNGs face and mount**.

### 2.2 Asset families

| Family | Key builder | Dirs | Matrix | Loaded when |
|---|---|---|---|---|
| Generated hull | `getGeneratedHullTextureKey` → `generated_hull_<hull>_<faction>_<mod>_dirNN` | 16 | 7 hull × 4 faction × 4 mod × 16 dir = **1792** | Arena: Wasp m0 only (4×16=64) |
| Legacy modular hull | `getWaspHullKey` → `wasp_m0_hull_<faction>_dir<0-7>` | 8 | wasp m0 only, 4×8=32 | Arena visual set |
| Legacy modular turret (Smoky) | `getSmokyTurretKey` → `smoky_m0_turret_<faction>_dir<0-7>` | 8 | smoky m0 only, 4×8=32 | Arena visual set |

There is **no generated-turret family**. Turrets only exist as the legacy
8-dir Smoky set. There is no turret-per-mod and no turret-per-hull family.

### 2.3 Preload policy (today)

`PreloadScene` → standard mode skips combat assets entirely. Devtools/Arena
calls `loadArenaVisualAssets`, which loads the legacy modular set (Wasp hull +
Smoky turret, 64 images) + generated Wasp m0 hull set (4 factions × 16 = 64).
No full matrix. This is healthy and should be preserved.

### 2.4 Where the turret actually is (PR #255)

The Smoky sprite is **not** placed at the procedural mount. It is placed at:

```
turretSprite.position = (hullSprite.x, hullSprite.y - socketLift)
socketLift = hullSprite.displayHeight * (GENERATED_HULL_ORIGIN_Y - 0.5)
```

i.e. it is glued to the hull sprite's texture center, inheriting the hull's
permanent + debug + recoil offsets automatically. The procedural
`mountWorldX/Y` (from `MOUNT_FRACTION_MAP`) is used only for the **fallback**
(no generated hull) and for the aim line / fire origin. So the visual turret
and the logical barrel/fire origin sit at **two different points**.

---

## 3. Root causes of the recent Wasp+Smoky issues

PR #255 found two manual-QA defects in its first pass (01), fixed in 01B:
**wrong turret visual direction** and **wrong mount (double-counted hull
offset)**. The deeper causes:

### RC-1 — No declared "asset facing offset"

Each PNG family bakes an unknown rotation offset from its authoring tool
(the Three.js / TankViewer exporter `ROTATION_OFFSET_DEG`). Today this offset
is rediscovered empirically per family:

- Hull: discovered as `WASP_HULL_VISUAL_DIR16_REMAP` (`+4` dir16).
- Turret (01): used **raw** `turretAngle` → no offset → a quarter-turn off.
- Turret (01B): reused the **hull's** offset (`applyHullVisualDir16Remap('wasp', …)`)
  → correct **only because Smoky was authored in the same convention as Wasp**.

There is no single place that says "Smoky faces `+N`." The fix worked by
coincidence of shared authoring, and **hardcodes `'wasp'`** — see RC-3.

### RC-2 — No socket; mount is re-derived three ways

"Where does the turret sit on the hull?" has three competing answers
(procedural fraction, hand-tuned per-dir table, glue-to-center). When the
turret sprite was added, the offset stack (anchor → permanent placement →
debug → recoil → hull-origin lift) had to be reconstructed for the turret.
The 01 pass reconstructed it **on top of** a mount that already included the
hull placement offset → double count. 01B fixed it by gluing to the hull
sprite instead — correct, but it means **only "hull center" is a valid mount**.
A real off-center turret (rear-mount Mammoth, front-mount Wasp) cannot be
expressed.

### RC-3 — The turret remap ignores the actual hull

`resolveModularTurretSpriteKey` calls `applyHullVisualDir16Remap('wasp', …)`
with a literal `'wasp'`. Today every Arena hull is Wasp, so it works. The
moment a second hull ships with a **different** `assetFacingOffset`, the
turret will face one way and the hull another. This is the contract gap that
will reproduce the 01 defect for the next hull.

### RC-4 — Inconsistent remap across the two render paths

`ModularTankRenderer.setBodyDir` resolves the generated hull via
`mapRuntimeDir8ToGeneratedDir16(dir)` **without** `applyHullVisualDir16Remap`.
The Arena path **does** apply it. So the same generated Wasp PNG faces
differently in the static debug path vs the Arena path. Whichever was
calibrated, the other is wrong.

### RC-6 — No turret pivot convention; legacy mount calibration was dropped

This is the root cause the second QA pass exposes, and the reason another
offset patch will not work.

1. **Turret pivot ≠ image center.** PR #255 sets the turret sprite origin to
   `(0.5, 0.5)` — the PNG's geometric center. A barreled turret does not rotate
   about, or mount at, its image center: its **pivot** (the ring it turns on,
   the point that should coincide with the hull mount) sits toward the
   rear-center of the turret base, with the barrel extending forward of it.
   Mounting by image center pushes the whole turret forward/off by roughly half
   a barrel length, and that error **rotates with the turret**, so it reads as
   "floating / wrong attachment" differently at every angle — exactly the
   reported symptom. No single `{x,y}` offset can correct an error that rotates.
2. **The legacy mount calibration was discarded.** The Smoky PNGs were authored
   against the **legacy** `wasp_m0_hull`, and the legacy path mounts them with a
   per-direction table (`MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR`, e.g. dir2 =
   `{x:-6, y:-18}`) — i.e. **forward and up**, not at hull center. PR #255
   mounts the same PNG at the **generated** hull's center + `socketLift`,
   throwing away that calibration. So even with a correct facing, the turret
   lands at the wrong place on the body.

Together: the turret needs (a) a declared **pivot** in its own image-local
space and (b) a declared **hull socket** to mount that pivot onto. Neither
exists today, so both render paths fake it differently and neither matches the
art's authored intent. This is a missing-convention problem, not a tuning
problem.

### RC-5 — 16-dir authored, only 8 ever shown

`bodyAngleToDir8` quantizes to 8 sectors, then `mapRuntimeDir8ToGeneratedDir16`
doubles to even dir16 indices only. The 8 odd half-direction hull PNGs
(`ESE, SSE, …`) are **never displayed**. We pay matrix cost (and authoring +
load cost) for frames the runtime cannot select. Either go true 16-dir at the
angle-quantization step, or stop authoring/loading the odd frames.

### 3.6 Verdict — are the current asset conventions sufficient?

The manual preference is: *do not keep stacking calibration patches unless the
audit proves the current asset conventions are already sufficient.* The audit
**cannot** prove that. Evidence:

- Two successive, well-scoped calibration passes (01 then 01B) both failed
  Denis visual QA on the **same** pair. A convention that were sufficient would
  have produced alignment from a single declared value, not an oscillating hunt.
- The remaining misalignment (RC-6) is of a kind a scalar offset **cannot**
  fix: a wrong pivot produces an error that **rotates with the turret**, and a
  dropped per-dir mount table produces a per-direction error. Both are missing
  *metadata*, not mis-tuned numbers.

Important distinction: the **PNG art is probably fine** — each family is
internally consistent. What is insufficient is the **convention/metadata layer
around the art**: there is no declared hull socket, no declared turret pivot,
and no declared per-family facing offset. So the conclusion is **not** "re-cut
the PNGs" (that would violate the no-PNG-first constraint and is likely
unnecessary). The conclusion is: **the metadata contract is missing; build it,
and stop patching.** This is exactly what §5–§7 specify.

---

## 4. Direction convention table

All gameplay angles are **continuous radians in screen space** (X right, Y
down), per `bodyAngleToDir8` and `directionFromDelta`. **This must not change.**

| Layer | Symbol / source | Type | Convention | Remap applied? |
|---|---|---|---|---|
| Gameplay body | `vehicle.bodyAngle` | continuous rad | screen-space: E=0, SE=+π/4, S=+π/2, W=±π, N=−π/2 | none (source of truth) |
| Gameplay turret | `vehicle.turretAngle` | continuous rad | same as bodyAngle | none (source of truth) |
| Procedural body draw | `BlockoutVehicleRenderer` box | rad → tile-space rotation | uses `bodyAngle` directly; rotation done in tile space per projection contract | none (geometric, correct by construction) |
| Procedural turret/barrel draw | `blockoutVehicleGeometry` | rad → tile-space | uses `effectiveTurretAngle` (turretAngle − recoil) directly | none (geometric) |
| Generated hull sprite | `resolveGeneratedHullKey` | rad → dir8 → dir16 → remap | `bodyAngleToDir8` (8) → `×2` (even dir16) → `applyHullVisualDir16Remap` (Wasp `+4`) | **yes, Wasp-only** |
| Legacy modular turret — Arena (PR #255) | `resolveModularTurretSpriteKey` | rad → dir8 → dir16 → remap → ÷2 | `bodyAngleToDir8(turretAngle)` → `×2` → `applyHullVisualDir16Remap('wasp')` → `>>1` to dir8 | **yes, hardcoded Wasp** |
| Legacy modular turret — static | `ModularTankRenderer.setTurretDir` | discrete dir8 | `entity.turretDir` used directly as PNG dir | **none** |
| Legacy modular hull — static | `ModularTankRenderer.setBodyDir` | discrete dir8 → dir16 | `mapRuntimeDir8ToGeneratedDir16` only | **none (inconsistent w/ Arena, RC-4)** |
| Asset granularity | — | — | generated hull = 16-dir PNGs (only 8 used, RC-5); legacy hull/turret = 8-dir PNGs | — |

**Key reading:** the only thing that varies between "correct" and "wrong" is a
single integer rotation offset per PNG family (`assetFacingOffset`). Today that
integer is encoded as a 16-row table for Wasp hull, as a borrowed literal for
the turret, and as `0` everywhere else.

---

## 5. Mount / socket convention proposal

### 5.1 Where remaps and mounts live today

| Concern | Encoded in | Form |
|---|---|---|
| Hull facing remap | `generatedHullAssets.WASP_HULL_VISUAL_DIR16_REMAP` | 16-entry table, Wasp-only |
| Turret facing remap | `modularUnitAssets.resolveModularTurretSpriteKey` | borrows hull remap, literal `'wasp'` |
| Hull permanent placement | `getGeneratedHullPlacementOffset` | per-hull `{x,y}` screen px, Wasp-only |
| Hull debug placement | `WaspHullPlacementCalibrator` | runtime `{x,y}` screen px, Wasp-only |
| Procedural mount | `blockoutVehicleGeometry.MOUNT_FRACTION_MAP` | fraction of bodyWidth by `MountCategory` |
| Static mount | `worldConfig.MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR` | 8 hand-tuned `{x,y}` px |
| Turret sprite mount | `BlockoutVehicleRenderer` (PR #255) | glue to hull center + `socketLift` |
| Declared-but-unused | `BodyProfile.mountOffsetNormalized` | normalized `{x,y}` in body rect — **never read by renderer** |

So mounts are duplicated, implicit, and inconsistent (audit Q3 = **yes, all
three**). There is **no formal socket coordinate system** (audit Q5): the mount
is derived from procedural geometry in Arena and from per-dir tables in the
static path.

### 5.2 Proposed: a formal, hull-local socket

Author sockets in **normalized hull-local coordinates** (the existing,
currently-ignored `mountOffsetNormalized` semantics), promoted to a first-class
`SocketProfile`, plus a z-height. This is the **hybrid** answer to audit Q6:

- Authoring/storage space = **normalized hull-image-local** `{nx, ny}` in
  `[0..1]` relative to the hull sprite's untransformed footprint, where the
  hull's logical center is the reference. Normalized because it survives scale
  changes (the exact failure that produced `MODULAR_ANCHOR_CORRECTION` and the
  0.24→0.12 re-tuning).
- Rendering space = **world/tile-space**, derived by the renderer from the
  hull's single composite transform (per the §7 rule), then projected through
  the camera contract. Never authored in screen-space px.
- Per-dir overrides = **optional** and rare. A socket is normally
  direction-independent in hull-local space; the renderer rotates it by
  `bodyAngle` in tile space. A per-dir override map is allowed only for hulls
  whose art genuinely moves the mount per frame (escape hatch, default empty).

Why not the alternatives, explicitly:

- Pure **projected screen-space px** offsets → exactly today's brittle tables;
  they break on every scale/origin change. Rejected as the storage form.
- Pure **world/tile** offsets → fine as the derived form, but authoring in
  tiles divorces the socket from the art it must visually sit on. Use as the
  computed intermediate, not the authored value.
- **Per-dir metadata** as the default → 8–16× the data and the source of the
  static path's hand-tuning pain. Allowed only as an override.

### 5.3 Turret origin / pivot convention (the RC-6 fix)

A socket answers "where on the hull." It is only half the mount. The other
half is "**which point of the turret image** lands on that socket" — the
turret **pivot**. Today this is implicitly `(0.5, 0.5)` (image center), which
is wrong for a barreled turret (RC-6).

Proposed convention, mirroring the socket:

- Each turret declares `pivotNormalized {px, py}` in `[0..1]` of its own
  untransformed image — the point about which the turret visually rotates and
  which must coincide with the hull socket. For Smoky this is **not** the image
  center; it is the base ring, typically below/behind center
  (`py > 0.5`, the barrel extending toward the top of the frame).
- The renderer sets the turret sprite **origin to the pivot** (`px, py`) and
  positions the sprite **at the socket world point**. Then `socket == pivot` by
  construction, at every angle, with no rotating residual error.
- The pivot is authored once per turret family (art-truth, Denis-confirmed),
  exactly like the facing offset — and like the facing offset, it then never
  needs re-deriving per hull pairing.

This is why §13 rejects another offset patch: the current code has **no slot**
for a pivot distinct from the sprite origin, so no `{x,y}` constant can encode
the rotating error RC-6 describes.

---

## 6. Proposed data schema

All types are **pure TypeScript, Phaser-free**, living next to
`blockoutProfiles.ts` (state/config layer). They are **descriptive**, read by
the renderer; they do not contain rendering logic.

```ts
// ── Direction remap, as ONE integer, not a table ───────────────────
/** Number of authored directions in a sprite family. */
export type DirCount = 8 | 16;

/**
 * Declares how an authored PNG family faces relative to the logical
 * screen-space direction system. Replaces WASP_HULL_VISUAL_DIR16_REMAP.
 *
 * visualDir = (logicalDir + facingOffset) mod dirCount
 *
 * Wasp hull today == { dirCount: 16, facingOffset: 4 }.
 * A family authored "correctly" == { dirCount: N, facingOffset: 0 }.
 */
export interface DirectionRemapProfile {
  dirCount: DirCount;
  facingOffset: number; // signed, applied mod dirCount
}

// ── Socket: a named mount point in normalized hull-local space ──────
export interface SocketProfile {
  id: string;                       // e.g. 'turret_main'
  /** Normalized hull-local position; {0.5,0.5} = hull logical center. */
  normalized: { nx: number; ny: number };
  /** Height above body top in world Z units (for projection). */
  zHeight: number;
  /** Optional rare per-direction override (default: none). */
  perDir?: Partial<Record<number, { nx: number; ny: number }>>;
}

// ── Hull visual profile ─────────────────────────────────────────────
export interface HullVisualProfile {
  hullId: BodyId;
  family: 'generated' | 'legacy';   // which key builder + path
  textureScale: number;             // GENERATED_HULL_SCALE today
  origin: { x: number; y: number }; // sprite origin (0.5, 0.75 today)
  direction: DirectionRemapProfile; // {16, 4} for wasp today
  /** Permanent visual placement offset, screen px (Wasp: {-1, 12}). */
  placementOffset: { x: number; y: number };
  sockets: SocketProfile[];         // at least 'turret_main'
  /** True when the runtime may only pick even dir16 (RC-5 flag). */
  usesEvenDirOnly?: boolean;
}

// ── Turret visual profile ───────────────────────────────────────────
export interface TurretVisualProfile {
  weaponId: WeaponId;
  family: 'legacy' | 'generated';
  textureScale: number;             // MODULAR_RENDER_SCALE today
  /**
   * Turret pivot in normalized turret-image-local coords (RC-6, §5.3).
   * This IS the sprite origin the renderer applies, and it is the point that
   * coincides with the hull socket. NOT necessarily image center.
   * PR #255's implicit (0.5,0.5) is the bug; Smoky's true pivot is the base
   * ring (py > 0.5), to be Denis-confirmed.
   */
  pivotNormalized: { px: number; py: number };
  direction: DirectionRemapProfile; // smoky == { 8, +2 } (the ÷2 of wasp +4)
  mountSocketId: string;            // 'turret_main'
  /** Visual recoil hooks (default off; see §7). */
  recoil?: { followsBarrelKickback: boolean; followsTurretKickback: boolean };
}

// ── Upgrade level (M0..M3) ──────────────────────────────────────────
export interface UpgradeLevelProfile {
  level: 0 | 1 | 2 | 3;             // → 'm0'..'m3'
  /** Optional per-level visual deltas; absent => identical to M0. */
  textureModSuffix?: 'm0' | 'm1' | 'm2' | 'm3';
  scaleMultiplier?: number;
  socketOverrides?: Partial<Record<string, { nx: number; ny: number }>>;
  visualIndicator?: string;         // reuse UpgradeProfile.visualIndicator
}
```

Concrete Wasp + Smoky instantiation (today's numbers, no change):

```ts
const WASP_HULL: HullVisualProfile = {
  hullId: 'wasp', family: 'generated',
  textureScale: 0.12, origin: { x: 0.5, y: 0.75 },
  direction: { dirCount: 16, facingOffset: 4 },   // == WASP_HULL_VISUAL_DIR16_REMAP
  placementOffset: { x: -1, y: 12 },              // == getGeneratedHullPlacementOffset('wasp')
  sockets: [{ id: 'turret_main', normalized: { nx: 0.5, ny: 0.5 }, zHeight: 0.30 }],
  usesEvenDirOnly: true,
};

const SMOKY_TURRET: TurretVisualProfile = {
  weaponId: 'smoky', family: 'legacy',
  textureScale: 0.24,
  pivotNormalized: { px: 0.5, py: 0.5 /* PLACEHOLDER — Denis to confirm base-ring py>0.5 (RC-6) */ },
  direction: { dirCount: 8, facingOffset: 2 },    // == 01B remap, but explicit & per-turret
  mountSocketId: 'turret_main',
  recoil: { followsBarrelKickback: false, followsTurretKickback: false },
};
```

Crucially `facingOffset: 2` now lives on the **turret**, derived from the
turret's own authoring, not borrowed from `'wasp'` (RC-3 closed); and
`pivotNormalized` gives the renderer the turret-side mount point the current
code has no slot for (RC-6 closed). `pivotNormalized.py` is the one value the
audit cannot finalize from code — it is an art-truth measurement that needs
Denis (or a one-time calibration sweep). It is authored **once per turret**,
not once per hull pairing.

---

## 7. Proposed renderer flow

One rule: **compute the hull composite transform once; derive everything from
it.** Pseudocode (replacing the scattered offset math in
`BlockoutVehicleRenderer.renderVehicle` + the PR #255 glue):

```text
function renderVehicle(vehicle):
    hp = lookupHullVisualProfile(vehicle.bodyId)        # graceful: null => procedural
    if hp == null: drawProceduralBody(); drawProceduralTurret(); return

    # 1. Single composite hull transform (screen space)
    base   = worldToScreen(vehicle.worldX, vehicle.worldY, offset)
    recoil = backwardImpulse(vehicle.bodyAngle, vehicle.recoilBodyOffset)
    perm   = hp.placementOffset
    debug  = devtoolsActive ? waspDebugOffset() : {0,0}     # gated, unchanged
    hullPos = base + recoil + perm + debug
    hullDir = remap(bodyAngleToLogicalDir(vehicle.bodyAngle, hp.direction.dirCount),
                    hp.direction)
    drawHullSprite(hp, hullDir, hullPos)

    # 2. Socket world position, derived from the SAME transform
    socket = hp.sockets['turret_main']
    socketScreen = hullPos + normalizedToScreenOffset(socket, hp, vehicle.bodyAngle)
    socketScreen.y -= socket.zHeight * basisZ            # height via projection contract

    # 3. Turret: own profile, own facing offset, own PIVOT, mounted at socket
    tp = lookupTurretVisualProfile(vehicle.weaponId)     # graceful: null => procedural turret
    if tp != null and turretTextureLoaded(tp, vehicle):
        turretDir = remap(turretAngleToLogicalDir(vehicle.turretAngle, tp.direction.dirCount),
                          tp.direction)
        turretSprite.setOrigin(tp.pivotNormalized.px, tp.pivotNormalized.py)  # RC-6
        turretSprite.setPosition(socketScreen)            # pivot lands ON socket, every angle
        skipProceduralTurret = true
    # 4. Aim line / fire origin stay on the shared projected geometry (unchanged)
```

Properties:

- The turret never re-reads `placementOffset`, `recoilBodyOffset`, or the
  hull origin — it reads the **socket**, which is already in the composite
  frame. Double-counting (the 01 defect) becomes structurally impossible.
- `facingOffset` is per-family, so hull and turret can differ. RC-3/RC-4 closed
  by construction once both paths call the same `remap`.
- Sockets are off-center capable (`nx/ny ≠ 0.5`), so front/rear-mount hulls
  work without new code — only data.
- Procedural body/turret remain the **fallback** when no profile/texture is
  found. Graceful fallback preserved.
- `zHeight` and the height term use the camera projection contract `basisZ`;
  no top-down assumptions.

Recoil policy (audit Q7): body recoil shifts the **composite transform**, so
hull + socket + turret + barrel all move together (already true via gluing;
made explicit here). Barrel kickback and turret-angle kickback affect the
**procedural barrel and the fire origin only**, unless a turret opts in via
`recoil.followsTurretKickback`. Default off keeps the sprite turret stable and
matches today's behavior. **No combat/recoil semantics change** — these are
read-only visual hooks.

---

## 8. Proposed preload policy

Keep the current lean policy. Do **not** introduce a full matrix.

- Standard mode: unchanged — no combat assets.
- Arena/devtools: replace the hardcoded `loadArenaVisualAssets` body with a
  **declared visual bundle** — a small list of `(HullVisualProfile,
  UpgradeLevelProfile, factions)` and `(TurretVisualProfile, factions)` to
  load. Today's bundle = `{ wasp m0 × 4 factions } + { smoky m0 × 4 factions }`,
  i.e. byte-for-byte the same set.
- On-demand: `preloadGeneratedHullSet` and a parallel
  `preloadModularTurretSet` load exactly one hull/turret family set when a
  not-yet-loaded combo is first requested (e.g. a future curated Arena roster
  adds Hornet or Thunder). Probe-key guard prevents duplicate loads.
- Resolvers already return `null` when a texture is not loaded → procedural
  fallback. So an under-provisioned bundle degrades gracefully instead of
  erroring.
- RC-5 option: if `usesEvenDirOnly`, the hull loader may skip the 8 odd dir16
  PNGs, halving hull load/footprint with **zero visual change** (the runtime
  never selects them). This is a load-list change, not a PNG edit.

---

## 9. M0 / M1 / M2 / M3 upgrade model

Today: `modificationLevel (0..3)` → `modificationLevelToMod` → `'m0'..'m3'` →
baked into the **hull** texture key. Hull PNGs exist per mod (the 1792 matrix);
the **turret** (Smoky) has only `m0` and no mod dimension. `blockoutUpgradeData`
and `UpgradeProfile.visualIndicator` exist but are not wired to sprite swaps.

Proposed: represent M0–M3 as an `UpgradeLevelProfile` **delta over M0**, not a
separate matrix axis to fully populate.

- Hull: `textureModSuffix` selects the mod PNG when authored; **absent ⇒ reuse
  M0 art** + an optional additive `visualIndicator` overlay (chevrons/pips).
  This means a hull can ship M0 art only and still show M1–M3 progression via
  indicator, with no missing-texture errors.
- Turret: same. Smoky stays `m0` art at all levels until per-mod turret art
  exists; the level shows via `visualIndicator`. No turret matrix required.
- Socket may shift per level via `socketOverrides` (e.g. a bigger M3 turret
  sits slightly back) — data only.
- Gameplay/balance scaling stays where it is (`m0m3Scaling.ts`,
  `blockoutUpgradeData.ts`); this profile is **visual only**.

This keeps M-levels lean and graceful: missing higher-tier art never blocks
rendering.

---

## 10. Testing strategy

Automatable without Phaser (pure resolvers), audit Q12:

1. **Facing-offset parity (regression lock).** For Wasp hull and Smoky turret,
   assert the new `remap(logicalDir, profile)` returns exactly the same
   texture dir as today's `WASP_HULL_VISUAL_DIR16_REMAP` /
   `resolveModularTurretSpriteKey`. This guarantees the contract refactor is
   visually identical to current accepted output.
2. **Cardinal anchor tests.** Keep PR #255's four-cardinal assertions
   (E/S/W/N → expected Smoky dir) and add the hull equivalents.
3. **Hull≠turret offset divergence.** A synthetic second hull with
   `facingOffset` ≠ Wasp's must produce a turret dir that follows the
   **turret** profile, not the hull — the test that would have caught RC-3.
4. **Socket + pivot math.** `normalizedToScreenOffset` for socket `{0.5,0.5}`
   must equal the current `socketLift` result for Wasp (parity); for an
   off-center socket it must move predictably and **not** double-apply
   `placementOffset` (the test that would have caught the 01 double-count). For
   the turret pivot (RC-6): assert that with `pivotNormalized = origin`, the
   pivot lands on the socket for a full angle sweep with **zero per-angle
   residual** — the invariant a wrong image-center origin violates.
5. **Graceful fallback.** Unknown hull/weapon, or unloaded texture → resolver
   returns `null` → procedural path chosen. (Extends existing
   `modularTurretSprite.test.ts` cases.)
6. **Even-dir-only invariant.** `usesEvenDirOnly` hull never resolves an odd
   dir16 across a full angle sweep.
7. **Both-paths consistency (RC-4).** Same hull+angle resolves to the same
   texture key in the Arena resolver and the static resolver.
8. **Preload bundle = curated set.** Assert the declared Arena bundle expands
   to exactly the current 128-key set (no accidental matrix growth) — a guard
   test against the "full matrix" anti-goal.

Existing tests to keep green: `blockoutVehicleGeometry.test.ts`,
`blockoutTurretAim.test.ts`, `blockoutSelectionAim.test.ts`,
`arenaInspection.test.ts`, `combatCore.test.ts`, plus full
`typecheck / test / build / qa:smoke`.

### Still requires Denis visual QA (audit Q13)

Automation locks **consistency**, not **art truth**. Denis must still confirm,
through real menu flows (Standard / Debug / Arena):

- The authored `facingOffset` is actually correct for each **new** hull/turret
  (the PNG faces where the number claims) — this is the irreducible art-truth
  check that produced `+4`/`+2` in the first place.
- The socket `{nx, ny, zHeight}` visually sits where the turret should mount.
- Per-mod art (when introduced) and `visualIndicator` read clearly.
- Recoil/idle/target-lock/rest still look right with the sprite turret.

---

## 11. Migration plan (small PR sequence)

Each step is independently shippable, test-locked, and visually a no-op until
the explicit "enable new art" step.

- **PR-A (this doc).** Accept the contract. Docs only.
- **PR-B — read-only profile layer (the §14 first slice).** Add the four
  profile types + Wasp/Smoky instances populated from **existing constants**,
  plus adapter functions. Renderer still uses current code; adapters are
  asserted equal to today's values (test #1, #4-parity). Zero visual change.
- **PR-C — route hull direction through the profile.** Replace
  `applyHullVisualDir16Remap` internals with `remap(dir, profile.direction)`.
  Behavior identical for Wasp (`{16,+4}`). Closes RC-1 storage.
- **PR-D — route turret direction through the turret profile.** Replace the
  hardcoded `applyHullVisualDir16Remap('wasp', …)` in
  `resolveModularTurretSpriteKey` with the Smoky profile's own
  `{8,+2}`. Closes RC-3. Supersedes the ad-hoc part of PR #255.
- **PR-E — socket + pivot turret mount.** Replace the PR #255 glue with
  `normalizedToScreenOffset(socket, …)` and set the turret sprite **origin to
  `pivotNormalized`** (RC-6). This is the step that actually fixes the
  still-failing alignment: it needs the Denis-confirmed Smoky `pivotNormalized`
  and (optionally) the legacy per-dir mount values folded into the socket.
  Closes RC-2 + RC-6; enables off-center mounts. **Denis visual QA required.**
- **PR-F — reconcile the static path (RC-4)** or formally retire
  `ModularTankRenderer` as render path (keep as calibration-only), per Denis.
- **PR-G — declared preload bundle** (§8); assert == current curated set.
- **PR-H — prove generality.** Add **one** second curated hull or turret
  (e.g. Thunder turret or Hornet hull) authored purely as data + its small
  loaded set. This is the acceptance test for the whole contract: a new combo
  with **no new calibration code**. Denis visual QA on the new combo only.

Order rationale: data first (no risk), then direction (pure functions, fully
testable), then mount (the riskier geometry), then generality last.

---

## 12. Risks and open questions

- **Art-truth still manual.** The contract removes *re-deriving* the offset in
  code, not *discovering* it for new art. Each new family still needs one
  Denis-blessed `facingOffset`. That is acceptable and expected (constraint:
  "manual visual acceptance remains required").
- **Smoky `+2` is a coincidence.** It equals the Wasp hull `+4` halved only
  because Smoky and Wasp share an authoring convention. The profile must store
  it as the **turret's own** value so the coincidence is harmless if it breaks.
- **`zHeight` calibration.** Today the turret sprite ignores Z (glued in screen
  space). Introducing `zHeight` must reproduce the current look at default
  before any nonzero value is used — keep `zHeight` parity-tested.
- **Even-dir-only vs true 16-dir.** Decide whether hulls should become true
  16-direction at the quantization step (smoother turning, uses all art) or
  stay 8-dir and drop odd frames from load. This is a gameplay-feel + asset
  decision for Denis, not forced by the contract.
- **Static path fate (RC-4).** Keep reconciled, or demote
  `ModularTankRenderer` to calibration-only? Needs an owner decision.
- **`mountOffsetNormalized` reuse.** The `BodyProfile` field is currently
  unused; confirm no hidden consumer before repurposing it as the socket
  source.
- **Faction fallback.** Resolvers fall back to `cyan` for unknown factions;
  keep this, but a test should assert green/yellow/purple resolve directly.

---

## 13. Clear recommendation — what to do with PR #255

The three options posed:

1. merge as a temporary tactical improvement;
2. keep open but not merged;
3. close / replace with a contract-based implementation.

**Recommendation: option 2 — keep PR #255 open but do NOT merge it.** Flip to
option 3 (close) if there is any chance it gets merged by inertia.

**Option 1 (merge) is rejected.** The PR failed Denis visual QA twice. Merging
it would ship a turret that is visible but visibly mis-attached, and project
rules (`AI_EXECUTION_WORKFLOW` §12, `CURRENT_NEXT_STEP` "Denis visual
acceptance before merge") forbid merging a visual PR that failed visual QA. A
third small patch will not rescue it: RC-6 is a **rotating** error (wrong
pivot) plus a **per-direction** error (dropped legacy mount table), neither of
which a scalar offset can fix. Continuing here is exactly the "stacking
calibration patches" the owner asked to stop.

**Why option 2 over option 3.** PR #255 contains genuinely reusable,
contract-aligned scaffolding that we do not want to rewrite from scratch:

- `resolveModularTurretSpriteKey` + the `MODULAR_TURRET_SPRITE_WEAPONS` gate
  (graceful null-fallback) → becomes the body of the profile-driven turret
  resolver in **PR-D**.
- The turret-sprite **lifecycle** in `BlockoutVehicleRenderer`
  (`vehicleTurretSprites` map, depth band, cleanup, "skip procedural when
  sprite active") → reused almost verbatim by **PR-E**.
- `modularTurretSprite.test.ts` (7 tests) → converted into the parity/locks of
  §10 tests #1–#3.

Keeping it open preserves that as a labeled reference branch and an honest
record that the tactical route was tried and rejected. **Condition:** mark the
PR clearly — *"Superseded by TURRET-HULL-ASSET-CONTRACT; do not merge; salvage
resolver + lifecycle + tests into PR-D/PR-E"* — and **freeze** all new per-case
calibration (no new `WASP_*` constants, no hardcoded `'wasp'`, no per-dir mount
tables) from now on.

**When to pick option 3 instead.** If the team cannot reliably prevent a
merge-by-inertia, or if review prefers a clean slate, **close** PR #255 and
cherry-pick the three salvage items above into the contract slices. The
engineering outcome is identical; option 3 is purely the safer bookkeeping
choice.

In one line: **#255 proved the asset conventions are not yet sufficient — that
is its value. It should be the last hand-written calibration patch, not the
first of more.** The contract turns the next ten such patches into reviewed,
tested data.

---

## 14. First implementation slice proposal (smallest safe PR)

**PR-B — "visual profile read-only layer"** — the smallest step that creates
the contract surface with **zero behavior change**:

Scope:

- New pure-TS file (state/config layer, no Phaser): the four profile types from
  §6 + a `WASP_HULL` / `SMOKY_TURRET` instance populated **only** from existing
  exported constants (`GENERATED_HULL_SCALE`, `GENERATED_HULL_ORIGIN_*`,
  `WASP_HULL_VISUAL_DIR16_REMAP`, `getGeneratedHullPlacementOffset`,
  `MODULAR_RENDER_SCALE`, the 01B `+2`).
- A `remap(logicalDir, DirectionRemapProfile)` helper:
  `(logicalDir + facingOffset) mod dirCount`.
- Adapter shims: `hullVisualProfile(bodyId)` / `turretVisualProfile(weaponId)`
  returning `null` for unsupported ids (graceful).
- **No renderer rewiring.** Renderer and resolvers are untouched.

Tests (the value of the slice):

- `remap(logical, {16,4})` reproduces every row of
  `WASP_HULL_VISUAL_DIR16_REMAP`.
- `remap(logical, {8,2})` reproduces `resolveModularTurretSpriteKey`'s four
  cardinal results.
- Profile constants equal the live exported constants (drift guard).

Why this first:

- Risk ≈ 0 (adds code, changes nothing).
- It is the dependency for PR-C/D/E and forces the offsets to be written down
  in one place, which is the entire point of the audit.
- It is fully unit-testable without Phaser, so it can be validated cheaply
  (GLM-runnable), reserving strong-model/Denis time for PR-E/PR-H where the
  geometry and art-truth actually change.

Validation baseline for PR-B: `npm run typecheck && npm run test &&
npm run build && npm run qa:smoke`; docs/PR body states "no runtime behavior,
asset, or preload change — read-only data layer + tests."

---

## 15. Audit question → section index

| # | Question | Answered in |
|---|---|---|
| 1 | Direction conventions (body/turret/procedural/hull/turret/8v16) | §4 |
| 2 | Where visual dir remaps are encoded | §3 RC-1/RC-3, §5.1 |
| 3 | Hull/turret remaps duplicated/implicit/inconsistent? | §3 RC-3/RC-4, §5.1 (yes, all three) |
| 4 | Current mount/socket model | §2.1, §5.1 |
| 5 | Formal socket coord system? | §5.1 (no — derived) |
| 6 | Where sockets should be authored | §5.2 (normalized hull-local hybrid) + §5.3 (turret pivot) |
| 7 | Recoil/permanent/debug offsets on hull+turret | §7 |
| 8 | M0–M3 representation | §9 |
| 9 | Turret independent/overlay/socket-mounted | §5.2–§5.3, §6, §7 (socket-mounted modular w/ pivot) |
| 10 | Future weapons beyond Smoky w/o full matrix | §8 |
| 11 | Data schema (hull/turret/socket/remap/upgrade) | §6 |
| 12 | What to test automatically | §10 |
| 13 | What still needs Denis QA | §10 |
| 14 | Safest migration path | §11 |
| — | Are current asset conventions sufficient? | §3.6 (no) |
| — | PR #255: merge / keep open / close? | §13 (keep open, do not merge — option 2) |
| — | First implementation slice | §14 |
