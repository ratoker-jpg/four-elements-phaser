# MODULAR-RUNTIME-04B — Unified Modular Vehicle Renderer Corrective Fix

Project: Four Elements Phaser
Task: OPUS-MODULAR-RUNTIME-04B
Date: 2026-06-16
Status: Implementation PR (GPT review required before merge)

---

## 1. Manual QA problem summary

After 04A made modular PNG rendering the default in theory, manual QA still
showed the game out of target state:

1. Some vehicles rendered as modular PNGs, others still as turquoise/green
   blockout placeholders.
2. Vehicles sometimes flickered back to old placeholders.
3. Turret offsets / socket placement were not correct.
4. The mount-slot model (front / center / rear) was not applied.
5. Only cyan appeared reliably connected to the modular PNG path.
6. Live gameplay still showed debug/aim artifacts: green movement line, red
   dashed line, arrow/marker on the selection ring, turret-to-cursor tracking.
7. Different modes appeared to use different render logic.

Product decision: **all live modes must use one canonical modular PNG vehicle
rendering path.** Modes may add debug panels, but must not have separate default
vehicle render architectures.

---

## 2. Root cause

The orchestrated audit (Workers A–F) found four concrete root causes, not a
missing renderer:

- **Flicker back to blockout.** `composeModularVehicle()` sets
  `plan.available = hullTextureExists && turretTextureExists` for the *current*
  direction frame. The live adapter (`ModularVehicleLiveAdapter.syncVehicle` /
  `placeModularCombat`) treated `plan.available === false` as "hide modular,
  show blockout" **every frame**, with no memory that modular was already
  active. When a vehicle rotated to a new dir whose frame had not yet streamed
  in (lazy load is per-set but a frame can lag), the adapter reverted to the
  blockout placeholder for a frame or two — the observed flicker.

- **Faction collapse to cyan.** The Arena path already passed the real faction.
  The normal-runtime path defaulted a missing `entity.faction` to `'cyan'`
  silently (`entity.faction ?? 'cyan'` in two places), masking any upstream
  faction gap and making only cyan look reliable.

- **Mount slot not modelled.** Export metadata places every hull socket and
  turret pivot at frame centre (`nx=ny=0.5`). That is correct for centre-mount
  hulls but wrong for front-mount (mammoth/titan) and rear-mount
  (wasp/dictator) hulls, whose weapon clearly sits off-centre. There was no
  production model to express this — only devtools-only calibration offsets.

- **Debug artifacts always-on.** The green movement line, red dashed aim line,
  selection-ring direction arrow, mount-point circles, and turret-to-cursor
  tracking were drawn whenever a vehicle was selected (or, for cursor aim, in
  any non-Arena devtools mode), with no production gate.

The renderers themselves were *already unified enough*: both Arena
(`BlockoutVehicleRenderer`) and normal runtime (`ModularTankRenderer`) route
through the **same** `ModularVehicleLiveAdapter` → `composeModularVehicle()`
path. The fix is corrective, not a rewrite.

---

## 3. Architecture before / after

### Before

```
Arena devtools      ─┐
                     ├─► ModularVehicleLiveAdapter ─► composeModularVehicle ─► sprites
normal runtime      ─┘        │  (per-frame: available? → else hide+blockout)
                              │
debug overlays drawn unconditionally on selection (green/red/arrow/cursor-aim)
faction: entity.faction ?? 'cyan'  (silent)
turret socket: frame-centre only (no mount model)
```

### After

```
Arena devtools      ─┐
                     ├─► ModularVehicleLiveAdapter ─► composeModularVehicle ─► sprites
normal runtime      ─┘        │  (sticky-hold: stay modular while same visual
                              │   identity & last textures valid)
                              │
                              ├─ mount-slot layer (front/center/rear) shifts the
                              │  composition socket along hull facing
                              └─ resolveModularFaction() (diagnostic, not silent)

debug overlays gated by vehicleDebugOverlays (all default OFF)
```

The canonical path is unchanged in shape — it is now made *robust* and *clean*.

---

## 4. Unified render path

`composeModularVehicle()` (pure, engine-agnostic) remains the single source of
composition for **every** live modular vehicle, and `ModularVehicleLiveAdapter`
remains the single live adapter used by both Arena and normal runtime. The
devtools preview (`GeneratedModularVehicleRenderer`) continues to share the same
`MODULAR_VEHICLE_BASE_SCALE` and composition math, so preview == live.

No mode chooses a different default vehicle renderer. The blockout procedural
draw remains **emergency fallback only** (used while the initial visual set is
still loading, or when a visual cannot be mapped).

---

## 5. Mount-slot implementation

New file: `src/modular/modularVehicleMountSlots.ts`.

- `type ModularVehicleMountSlot = 'front' | 'center' | 'rear'`
- `HULL_MOUNT_SLOTS` production config (single source of truth):
  - front: `mammoth`, `titan`
  - center: `viking`, `hunter`, `hornet`
  - rear: `wasp`, `dictator`
- `getHullMountSlot(hullId)` → unknown hulls fall back to `center` (zero shift,
  non-regressing).
- `MOUNT_SLOT_FORWARD_FRACTION` → `{ front: +0.16, center: 0, rear: -0.16 }`
  expressed as a fraction of the hull display size (the **only** tunable).
- `getMountSlotSocketShift(hullId, hullDir16, hullDisplaySize)` → computes a
  screen-space shift **along the hull's facing direction** (derived from
  `hullDir16`, iso vertical compression `0.5`). No per-direction table; one
  fraction covers all 16 directions for every hull in a slot.

### What the mount slot affects (explicit)

| Target | Affected? |
|---|---|
| Hull socket metadata (nx/ny) | **No** — untouched |
| Turret pivot metadata (nx/ny) | **No** — untouched |
| Hull sprite position / scale | **No** — hull stays on the anchor |
| Composition offset (socket screen point) | **Yes** — the only thing shifted |
| Selected metadata socket source | **No** — metadata still drives base |

Integration: in `composeModularVehicle()` the mount shift is added to
`socketScreen` (where the turret pivot lands). For `center` hulls the shift is
exactly `{0,0}` so frame-centre-correct hulls are never overcorrected. Adding a
new hull only requires choosing one category. **No calibration data is written
into metadata or assets.**

---

## 6. Faction fix

New file: `src/modular/modularFactionResolver.ts`.

- `resolveModularFaction(faction, context)` passes valid factions through
  unchanged and only falls back to `cyan` for a missing/invalid value — emitting
  a **one-shot diagnostic** `console.warn` so the gap is visible, not hidden.
- The two silent `entity.faction ?? 'cyan'` sites in
  `ModularVehicleLiveAdapter` now call `resolveModularFaction(..., 'normal-runtime-combat')`.
- The Arena path already passes the real faction (`blockoutToModularVisual`),
  and `createInitialState` populates `RenderableEntity.faction`, so all four
  factions (cyan/green/yellow/purple) generate correct texture keys end to end.
- Tests cover all four factions through the live composition path.

---

## 7. Debug artifact cleanup

New file: `src/phaser/render/vehicleDebugFlags.ts` — a single `vehicleDebugOverlays`
flag object, **all default `false`**:

| Flag | Gated artifact | Default |
|---|---|---|
| `movementLine` | green vehicle→target line | off |
| `aimLine` | red dashed turret aim line | off |
| `directionArrow` | arrow/marker on selection ring | off |
| `mountPoints` | red socket/mount-point circles | off |
| `turretCursorAim` | turret rotates to raw mouse cursor | off |

Wiring:
- `BlockoutVehicleRenderer`: green movement line, selection-ring direction arrow,
  and red dashed aim line are each gated behind their flag. `showMountPoints`
  default changed `true → false`.
- `BlockoutVehicleInputController`: the non-Arena turret-to-cursor tracking is
  gated behind `turretCursorAim`. By default the turret direction comes from
  vehicle/target/controlled-demo state, never from raw cursor hover.

Selection rings, hover rings, HP bars, target indicators and labels remain —
they are legitimate gameplay/devtools UI, not debug artifacts. A debug panel can
flip any flag on via `setVehicleDebugOverlay` / `toggleVehicleDebugOverlay` /
`enableAllVehicleDebugOverlays`.

---

## 8. Fallback behavior

- Modular PNG is the primary render (`ENABLE_MODULAR_VEHICLE_RENDER = true`, from
  04A — unchanged).
- While a visual set is still loading or a visual cannot be mapped, the legacy
  blockout/generated path renders as **emergency fallback only**. No vehicle
  disappears during loading.
- **Anti-flicker sticky-hold (new):** once a fully-available modular plan has
  been applied for a vehicle, a transiently-unavailable later plan keeps the last
  good modular sprites visible (`usedModular` stays `true`) **as long as the
  visual identity (hull/turret/faction/mod) is unchanged and the last applied
  textures still exist**. A change of hull/turret/faction/mod releases the hold
  so the new set takes over cleanly; invalid textures also release the hold.
  Direction is intentionally excluded from the identity key so rotation never
  triggers a flicker.

---

## 9. Lazy loading

Unchanged and preserved:
- One visual set = max 32 PNG (16 hull + 16 turret), enforced by
  `MAX_MODULAR_VEHICLE_SET_PNG` in `modularVehicleRuntimeLoader`.
- No full-matrix preload; sets are requested per visual on demand.
- Hull key `modular_hull_*`, turret key `generated_turret_*` namespaces
  unchanged. No regression to `generated_hull_*`. Wasp m0 does not use
  `_hull_dir`.

---

## 10. Tests

- `src/__tests__/modularRuntime04b.test.ts` (new):
  - mount-slot categories for all seven hulls + the three categories;
  - unknown-hull fallback to center (zero shift);
  - mount-slot shift direction/sign/scale behavior (computed, not a table);
  - mount-slot integrates into composition (front ahead, rear behind, center on
    centre); hull sprite untouched;
  - Dictator +9% hull-only survives the mount-slot layer;
  - all four factions produce correct, distinct texture keys;
  - faction safety net passes valid factions / diagnoses missing;
  - debug overlays default off + can be enabled;
  - one visual set = 16 hull + 16 turret = 32 keys; frame size 512 unchanged.
- `src/__tests__/modularLiveAdapter04bSticky.test.ts` (new): sticky-hold keeps
  modular across a transient unavailable frame (same visual), releases on visual
  change, and does not claim modular before any assets load.
- `src/__tests__/modularRuntime01.test.ts` (updated): the "turret centre on hull
  centre" assertion now uses a center-mount hull (viking); hull-at-anchor
  assertions unchanged.

---

## 11. Validation

```
npm run typecheck   → PASS
npm test            → PASS (4679 tests, 91 files)
npm run build       → PASS (vite production build)
npm run qa:smoke    → PASS (2/2: standard + devtools/arena)
```

Note: `qa:smoke` requires the Playwright chromium-headless-shell browser; it had
to be installed in-container (`npx playwright install chromium`) before the run.
After install both standard and devtools/arena modes passed with no console
errors, canvas present, and HUD economy DOM present.

---

## 12. Manual QA plan / checklist

1. **Arena/default view:** no turquoise/green blockout boxes when modular assets
   are available; PNG hull+turret by default.
2. **Normal runtime:** PNG modular vehicle by default; no manual toggle.
3. **Factions:** spawn cyan/green/yellow/purple — each uses the correct PNG set.
4. **Hull/turret:** Wasp, Hornet, Hunter, Viking, Dictator, Titan, Mammoth render
   correctly; Smoky/Twins/Ricochet/Railgun/Firebird/Vulcan render if spawnable.
5. **Mount slots:** mammoth/titan turret sits front; viking/hunter/hornet centre;
   wasp/dictator rear. Verify across several directions.
6. **Debug artifacts:** no green line, no red dashed line, no arrow-on-ring, no
   turret-to-cursor by default; confirm a debug panel/flag can re-enable them.
7. **Stability:** no unit disappears; no flicker back to placeholders after assets
   load; no all-asset preload; no 404 spam.

---

## 13. Risks / rollback

- **Mount-slot magnitude is a single tunable** (`MOUNT_SLOT_FORWARD_FRACTION`).
  If front/rear shift looks too strong/weak in manual QA, adjust the fraction
  only — no per-hull or per-dir edits. Risk is purely visual; collision /
  hitbox / gameplay are untouched.
- **Iso vertical scale** for the facing projection is a documented constant
  (`MOUNT_SLOT_ISO_VERTICAL_SCALE = 0.5`); if the depicted forward looks off on
  the diagonal directions it is the one place to tune.
- **Sticky-hold** could in theory hold a stale frame if a texture is evicted
  mid-session; it guards against that by re-checking `textures.exists` on the
  last applied keys and releasing the hold if they are gone.
- **Rollback:** revert this PR. The 04A default-modular behavior and emergency
  fallback remain intact; mount slots, faction resolver, debug flags, and
  sticky-hold are additive modules plus small call-site edits.

## 14. Explicitly NOT changed

No assets regenerated; no PNG/metadata JSON modified; no full preload; no
combined hull×turret matrix; no new query-string flags; no production manual
pixel offsets; no per-direction offset tables; no changes to combat, movement,
economy, mapgen, pathfinding, save/load, or collision/hitboxes/footprints/stats.
