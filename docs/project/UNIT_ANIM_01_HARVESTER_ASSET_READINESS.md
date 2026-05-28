# UNIT-ANIM-01 — Harvester Asset Readiness Report

Status: readiness assessment — approved assets NOT found  
Project: Four Elements Phaser  
Active repo: `ratoker-jpg/four-elements-phaser`  
Phaser version: 4.1.0  
Date: 2026-05-29  
Decision: **Path B — readiness report only, no runtime code changes**

---

## 1. Whether approved harvester assets exist

**No.** Approved harvester spritesheets matching the ASSET-WORKFLOW-01 specification do NOT exist in the repository.

The only harvester spritesheets present are the original `harvester_8x8_256.png` files, which contain only idle and move animation states. These do not include the gather and unload states required by ASSET-WORKFLOW-01.

---

## 2. Which files were found

### Existing harvester spritesheets (4 factions, idle+move only)

| Faction | File path | Dimensions | File size | States |
|---------|-----------|-----------|-----------|--------|
| cyan | `public/assets/factions/cyan/units/harvester_8x8_256.png` | 2048x2048 | 755.2 KB | idle, move |
| green | `public/assets/factions/green/units/harvester_8x8_256.png` | 2048x2048 | 753.5 KB | idle, move |
| yellow | `public/assets/factions/yellow/units/harvester_8x8_256.png` | 2048x2048 | 756.4 KB | idle, move |
| purple | `public/assets/factions/purple/units/harvester_8x8_256.png` | 2048x2048 | 753.8 KB | idle, move |

### Files NOT found (required by ASSET-WORKFLOW-01)

| Expected file | Status |
|---------------|--------|
| `public/assets/factions/cyan/units/harvester_8d_4s_256.png` | ❌ Missing |
| `public/assets/factions/green/units/harvester_8d_4s_256.png` | ❌ Missing |
| `public/assets/factions/yellow/units/harvester_8d_4s_256.png` | ❌ Missing |
| `public/assets/factions/purple/units/harvester_8d_4s_256.png` | ❌ Missing |

### Per-state fallback files NOT found

| Expected file pattern | Status |
|----------------------|--------|
| `public/assets/factions/{faction}/units/harvester_idle_8d_256.png` | ❌ Missing |
| `public/assets/factions/{faction}/units/harvester_move_8d_256.png` | ❌ Missing |
| `public/assets/factions/{faction}/units/harvester_gather_8d_256.png` | ❌ Missing |
| `public/assets/factions/{faction}/units/harvester_unload_8d_256.png` | ❌ Missing |

---

## 3. Whether existing assets match ASSET-WORKFLOW-01

**No.** The existing `harvester_8x8_256.png` spritesheets do not match the ASSET-WORKFLOW-01 specification:

| Requirement | ASSET-WORKFLOW-01 spec | Current asset | Match? |
|-------------|------------------------|---------------|--------|
| Animation states | 4 (idle, move, gather, unload) | 2 (idle, move) | ❌ |
| Total rows | 32 (4 states x 8 directions) | 8 (1 state block x 8 directions) | ❌ |
| Sheet dimensions | 2048 x 8192 px (single-sheet) or 4 x 2048x2048 px (per-state) | 2048 x 2048 px | ❌ |
| File naming | `harvester_8d_4s_256.png` (single-sheet) or `harvester_{state}_8d_256.png` (per-state) | `harvester_8x8_256.png` | ❌ |
| Total frames | 256 (32 rows x 8 cols) or 4 x 64 (per-state) | 64 (8 rows x 8 cols) | ❌ |
| Direction mapping | E=0, SE=1, S=2, SW=3, W=4, NW=5, N=6, NE=7 | ✅ Matches | ✅ |
| Frame size | 256x256 px | ✅ Matches | ✅ |
| Origin | (0.5, 0.75) ground contact | ✅ Matches | ✅ |
| Transparent PNG | 32-bit RGBA | ✅ Matches | ✅ |
| Gather frames | Rows 16-23, columns 1-7 | ❌ Not present | ❌ |
| Unload frames | Rows 24-31, columns 1-7 | ❌ Not present | ❌ |

---

## 4. Missing states/factions/directions/frames

### Missing animation states (all factions)

| State | State index | Direction rows | Animation columns | Status |
|-------|-------------|----------------|-------------------|--------|
| idle | 0 | 0-7 | 0 only | ✅ Exists in current sheet |
| move | 1 | 8-15 | 1-7 | ✅ Exists in current sheet |
| gather | 2 | 16-23 | 1-7 | ❌ **Missing entirely** |
| unload | 3 | 24-31 | 1-7 | ❌ **Missing entirely** |

### Missing frames per faction

Each faction needs **128 additional frames** (2 new states x 8 directions x 8 columns) beyond what currently exists. The existing idle and move frames can be reused in the new layout (rows 0-7 idle, rows 8-15 move), but gather and unload frame content must be created from scratch.

### Missing across all factions

- **4 factions** x **2 missing states** x **8 directions** x **8 columns** = **512 frames of new art** needed
- Of these, **448 frames** are animation frames (columns 1-7) and **64 are keyframes** (column 0 per state/direction)

---

## 5. Texture size / max texture risk

### Single-sheet model (harvester_8d_4s_256.png)

| Property | Value | Risk |
|----------|-------|------|
| Sheet dimensions | 2048 x 8192 px | ⚠️ High — exceeds 4096px maxTextureSize on some mobile GPUs |
| Uncompressed RGBA size | ~64 MB per faction | ⚠️ High — 4 factions = ~256 MB GPU texture memory |
| Compressed PNG size (estimated) | ~3-6 MB per faction | ✅ Acceptable disk/network size |
| Desktop browsers | Most support 8192px | ✅ Generally safe |
| Mobile browsers | Many cap at 4096px | ❌ Will fail on some devices |
| WebGL `maxTextureSize` | Varies: 2048-16384 | ⚠️ Must verify on target devices |

### Per-state split model (recommended for safety)

| Property | Value | Risk |
|----------|-------|------|
| Sheet dimensions | 2048 x 2048 px per state | ✅ Safe on all devices |
| Uncompressed RGBA size | ~16 MB per state per faction | ✅ Acceptable |
| Total sheets | 4 states x 4 factions = 16 files | ⚠️ More loader complexity |
| Max concurrent textures | 4 (one per faction, all states) | ✅ Same as current model |

### Recommendation

**Use per-state split sheets** unless target device testing confirms `maxTextureSize >= 8192` and memory is acceptable. The per-state model is safe on all devices and the loader complexity is manageable. The single-sheet model can be evaluated later as an optimization if measurements show per-state loading is too slow.

---

## 6. Recommended final sheet model

**Per-state split sheets** — four separate 2048x2048 spritesheets per faction, one per animation state.

### Rationale

1. **Device safety**: 2048x2048 is within the `maxTextureSize` of every WebGL-capable device (minimum 2048 guaranteed by spec).
2. **Memory efficiency**: Only the active state's texture needs to be in GPU memory at full resolution. Idle and move can be loaded at startup; gather and unload can be loaded lazily when first needed.
3. **Incremental delivery**: Denis can provide one state at a time (e.g., gather first, then unload), and each can be integrated independently without waiting for all four states.
4. **Loader complexity**: Modest — each state requires one `scene.load.spritesheet()` call per faction (4 calls per state), which is already handled by the existing `loadGeneratedSpritesheetAssetFamilies()` helper in `runtimeGeneratedAssets.ts`.
5. **Fallback to current**: If a per-state sheet is missing for a faction, the runtime can fall back to the idle keyframe from the existing sheet without errors.

### File layout

```text
public/assets/factions/{faction}/units/
  harvester_idle_8d_256.png       — 2048x2048, 8 rows x 8 cols (idle state only)
  harvester_move_8d_256.png       — 2048x2048, 8 rows x 8 cols (move state only)
  harvester_gather_8d_256.png     — 2048x2048, 8 rows x 8 cols (gather state only)
  harvester_unload_8d_256.png     — 2048x2048, 8 rows x 8 cols (unload state only)
```

### Asset key model

Each per-state sheet gets its own texture key:

```text
harvester_{faction}_idle    — loaded from harvester_idle_8d_256.png
harvester_{faction}_move    — loaded from harvester_move_8d_256.png
harvester_{faction}_gather  — loaded from harvester_gather_8d_256.png
harvester_{faction}_unload  — loaded from harvester_unload_8d_256.png
```

This is a change from the current single-key model (`harvester_{faction}`) and will require updates to the Animation Manager registration and the sprite creation logic in `EntityRenderer.ts`.

### Alternative: single-sheet model

If Denis prefers the single-sheet approach after verifying `maxTextureSize >= 8192`, the file naming reverts to `harvester_8d_4s_256.png` with the single `harvester_{faction}` asset key. This is the model described in ASSET-WORKFLOW-01 section 5.4. The per-state split is the safer default; the single-sheet can be adopted later as a performance optimization.

---

## 7. Exact asset file names Denis needs to provide

### Per-state split model (recommended)

For each of the 4 factions (cyan, green, yellow, purple), Denis must provide:

```text
harvester_idle_8d_256.png       — 2048 x 2048 px
harvester_move_8d_256.png       — 2048 x 2048 px
harvester_gather_8d_256.png     — 2048 x 2048 px
harvester_unload_8d_256.png     — 2048 x 2048 px
```

**Total: 16 PNG files** (4 factions x 4 states)

### Per-file specification

Each file must satisfy:

| Property | Value |
|----------|-------|
| Format | 32-bit RGBA PNG (transparent background) |
| Frame size | 256 x 256 px |
| Grid layout | 8 rows x 8 columns |
| Row 0 | Direction E (east / screen-right) |
| Row 1 | Direction SE (south-east / down-right) |
| Row 2 | Direction S (south / down) |
| Row 3 | Direction SW (south-west / down-left) |
| Row 4 | Direction W (west / screen-left) |
| Row 5 | Direction NW (north-west / up-left) |
| Row 6 | Direction N (north / up) |
| Row 7 | Direction NE (north-east / up-right) |
| Column 0 | Keyframe / primary pose |
| Columns 1-7 | Animation frames |
| Sheet width | 2048 px (8 x 256) |
| Sheet height | 2048 px (8 x 256) |
| Ground contact pixel | (128, 192) per frame — origin (0.5, 0.75) |
| Lower 25% of frame | Transparent safety/spacing area (rows 192-255) |
| No baked shadows | Shadows rendered by engine, not baked into sprite |
| No dark halo | Proper alpha-channel anti-aliasing |
| Faction color | Applied in art, not runtime tinting |

### State-specific art direction

| State | Keyframe (col 0) | Animation (cols 1-7) | FPS | Description |
|-------|-------------------|----------------------|-----|-------------|
| idle | Stationary harvester facing direction | None (only col 0 used; cols 1-7 empty/transparent) | 1 | Single-frame, no motion |
| move | Standing/ready pose | Walk/drive cycle — 7 frames of leg/tread motion | 8 | Loop, ~0.875s per cycle |
| gather | Ready-to-mine pose | Mining/drilling cycle — 7 frames of tool/drum motion | 6 | Loop, slower than move, ~1.17s per cycle |
| unload | Ready-to-unload pose | Unloading cycle — 7 frames of dumping/ejecting motion | 6 | Loop, same speed as gather |

### Delivery location

Files should be placed in:

```text
public/assets/factions/{faction}/units/harvester_{state}_8d_256.png
```

where `{faction}` is one of `cyan`, `green`, `yellow`, `purple` and `{state}` is one of `idle`, `move`, `gather`, `unload`.

### Reuse of existing idle and move art

The existing `harvester_8x8_256.png` files contain valid idle and move frames that match the direction convention. These can be re-exported as `harvester_idle_8d_256.png` and `harvester_move_8d_256.png` with the following changes:

1. **Idle sheet**: Each row should contain the idle keyframe at column 0, with columns 1-7 transparent. Currently, the idle frame is at `row * 8 + 0`, and columns 1-7 are walk frames. The re-export needs to strip walk frames from idle rows and leave columns 1-7 transparent.
2. **Move sheet**: Each row should contain the keyframe at column 0 and the existing walk cycle at columns 1-7. This maps directly from the current layout — no art changes needed, just re-export each row's 8 frames as-is.

Alternatively, Denis may prefer to generate entirely new art for all four states at once for visual consistency.

---

## 8. Exact next implementation prompt after assets are provided

After Denis provides the 16 harvester spritesheet files (or confirms a single-sheet model with 4 files), the following prompt should be used:

```text
Task:
UNIT-ANIM-01 — Harvester animated spritesheet integration

Mode:
IMPLEMENTATION ONLY.

Active repo:
ratoker-jpg/four-elements-phaser

Before doing anything:
1. Confirm active repo is ratoker-jpg/four-elements-phaser.
2. Confirm package.json has "phaser": "4.1.0".
3. Confirm harvester animated spritesheets exist in
   public/assets/factions/{faction}/units/ matching the
   ASSET-WORKFLOW-01 specification.
4. Read docs/project/ASSET_WORKFLOW_01_ANIMATED_UNIT_PIPELINE.md.
5. Read docs/project/UNIT_ANIM_01_HARVESTER_ASSET_READINESS.md.
6. Read docs/project/PHASER4_ANIM_01_SPIKE_REPORT.md.

Read first:
- docs/project/GLM_EXECUTOR_RULES.md
- docs/project/ASSET_WORKFLOW_01_ANIMATED_UNIT_PIPELINE.md
- docs/project/UNIT_ANIM_01_HARVESTER_ASSET_READINESS.md
- src/phaser/render/EntityRenderer.ts
- src/config/unitRenderConfig.ts
- src/assets/generatedAssetManifest.ts
- src/assets/runtimeGeneratedAssets.ts
- src/assets/assetManifest.ts
- src/state/types.ts

Context:
ASSET-WORKFLOW-01 is accepted and merged.
UNIT-ANIM-01 readiness report confirmed that no approved
harvester assets existed. Denis has now provided the required
spritesheets. This PR integrates them.

Goal:
Integrate the new harvester animated spritesheets into the runtime.
Add gather and unload animation support. Preserve current idle/move
behavior. Add safe fallback if gather/unload textures are missing.

Scope:
- Add new harvester spritesheet PNGs to public/assets/ (already provided by Denis)
- Update generatedAssetManifest.ts with new paths and frameConfig
- Add HARVESTER_STATE_COUNT, CIVIL_FRAMES_PER_DIR, HARVESTER_STATE_LABELS,
  HARVESTER_STATE_FPS to unitRenderConfig.ts
- Update EntityRenderer.registerHarvesterAnimations() for 4 states
  (idle, move, gather, unload) x 8 directions x 4 factions
- Update EntityRenderer.syncHarvesters() to use HarvesterPhase for
  animation selection (gathering→gather, unloading→unload)
- Add safe fallback: if gather/unload anim key doesn't exist, fall back
  to idle without throwing
- Preserve current working idle/move animation behavior exactly
- Do NOT change HarvesterPhase state machine or gameplay logic

Hard rules:
- Do not generate PNG assets (Denis provides them).
- Do not change harvester gameplay/state machine.
- Do not change economy, pathfinding, or map generation.
- Do not change builder rendering or ConstructionRenderer.
- Do not add ad-hoc runtime offset corrections.
- Do not start UNIT-ANIM-02.
- Do not start weapon/combat animation.
- Do not merge.

Validation:
- npm test
- npm run typecheck
- npm run build
- npm run qa:smoke

Manual QA checklist:
- Harvester idle displays correctly (no visual change from current)
- Harvester move animation still works (no visual change from current)
- Harvester gather animation plays during gathering phase
- Harvester unload animation plays during unloading phase
- Harvester does not float or shift between states
- Direction mapping is correct in all 8 directions
- All 4 faction variants render correct faction colors
- No missing texture errors in console
- No console errors about missing animation keys
- qa:smoke passes standard + devtools/arena

PR:
Open PR into main. Do not merge.
```

---

## 9. No runtime code changes

This readiness report makes **zero changes** to runtime code. The following files were NOT modified:

- `src/phaser/render/EntityRenderer.ts` — no changes
- `src/config/unitRenderConfig.ts` — no changes
- `src/assets/generatedAssetManifest.ts` — no changes
- `src/assets/runtimeGeneratedAssets.ts` — no changes
- `src/assets/assetManifest.ts` — no changes
- `src/state/types.ts` — no changes
- `src/state/updateGameState.ts` — no changes
- `package.json` — no changes
- `tools/qa_smoke.mjs` — no changes

The only artifact of this task is this document itself:
`docs/project/UNIT_ANIM_01_HARVESTER_ASSET_READINESS.md`

---

## Appendix A: Current runtime code gaps for reference

When assets become available, the following code changes will be needed (documented here for planning, not for implementation in this PR):

### EntityRenderer.ts

1. **Animation registration** (`registerHarvesterAnimations()`): Expand from 2 states (idle, move) to 4 states (idle, move, gather, unload). Frame ranges for gather: rows 16-23, columns 1-7. Frame ranges for unload: rows 24-31, columns 1-7. Or, with per-state split sheets, each state sheet has rows 0-7 with columns 0-7.

2. **Animation selection** (`syncHarvesters()`): Replace boolean `isMoving` with `HarvesterPhase`-aware animation key construction:
   - `idle` → `harvester_{faction}_idle_{dir}`
   - `moving-to-resource` → `harvester_{faction}_move_{dir}`
   - `gathering` → `harvester_{faction}_gather_{dir}`
   - `returning-to-hq` → `harvester_{faction}_move_{dir}`
   - `unloading` → `harvester_{faction}_unload_{dir}`
   - `manual-move` → `harvester_{faction}_move_{dir}`

3. **Safe fallback**: If the animation key for gather/unload doesn't exist in the Animation Manager, fall back to idle without throwing. This allows incremental state delivery (e.g., gather available but unload not yet).

### unitRenderConfig.ts

Add constants per ASSET-WORKFLOW-01 section 15.3:
- `HARVESTER_STATE_COUNT = 4`
- `CIVIL_FRAMES_PER_DIR = 8`
- `HARVESTER_STATE_LABELS = ['idle', 'move', 'gather', 'unload']`
- `HARVESTER_STATE_FPS = { idle: 1, move: 8, gather: 6, unload: 6 }`

### generatedAssetManifest.ts

Update paths and frameConfig per ASSET-WORKFLOW-01 section 15.1. If using per-state split sheets, each state requires its own manifest entry with its own asset key.
