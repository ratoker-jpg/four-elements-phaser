# PHASER4-LOAD-01 — Conditional Asset Loading Spike Report

Status: spike report  
Project: Four Elements Phaser  
Active repo: `ratoker-jpg/four-elements-phaser`  
Phaser version: 4.1.0  
Reference repo: `ratoker-jpg/four-elements-next` (donor/reference only)  
Date: 2026-05-28  

---

## 1. Executive Summary

This spike investigates whether Phaser 4.1.0 supports conditional asset loading (loading only selected assets by context, rather than everything at startup), and whether implementing it would benefit the Four Elements project at its current stage.

**Key findings:**

- Phaser 4.1.0 fully supports late-loading, pack files, selective unloading, and duplicate-key-safe loading. The API surface is rich and well-documented.
- The current project loads 106 asset keys (~36 MB on disk) in PreloadScene, all at startup. Of these, 64 keys (60%) are modular combat unit images that are parked and never rendered in Sandbox MVP gameplay.
- Loading only the selected faction's assets would reduce the count from 106 to ~31 keys, but civil unit spritesheets are the largest files (~20 MB for 8 sheets) and they already have `textures.exists()` fallback in EntityRenderer.
- The most impactful immediate win is excluding modular combat assets from the preload, not faction-aware loading.
- **Recommendation**: PHASER4-LOAD-02 should be dev/arena-only conditional loading (Option B). Faction-aware loading is feasible but premature given current asset counts and the existing cyan fallback pattern.

---

## 2. Repo/Version Confirmation

| Check | Result |
|-------|--------|
| Active repo | `ratoker-jpg/four-elements-phaser` |
| `package.json` phaser version | `"phaser": "4.1.0"` |
| PR #89 (FIX-04) merged to main | Yes (commit `4b0d008`) |
| Source-of-truth audit | `docs/project/PHASER4_AUDIT_CLARIFICATION_RETRY.md` |
| Framework | Vite + TypeScript, standalone (not Next.js) |

All checks passed. No mismatch.

---

## 3. Current Asset Loading Model

### 3.1 Scene loading flow

```text
BootScene (no assets)
  → PreloadScene (loads ALL assets)
    → MainMenuScene (no assets, DOM only)
      → NewGameSetupScene (no assets, DOM only)
        → GameScene (no additional loading)
```

BootScene and all menu/setup scenes use DOM overlays only — no Phaser textures.

### 3.2 What PreloadScene loads

PreloadScene.preload() calls four generated-manifest loaders:

| Loader call | Family | Keys loaded | Asset type | Used in Sandbox MVP |
|---|---|---|---|---|
| `loadGeneratedTerrainAndResourceAssets()` | terrain + resources | 3 + 3 = 6 | image | Yes — always needed |
| `loadGeneratedBuildingAndHqAssets()` | hq + buildings | 4 + 24 = 28 | image | Yes — but only 1 faction at a time |
| `loadGeneratedCivilUnitAssets()` | civilUnits | 8 | spritesheet (256x256, 64 frames) | Yes — but only 1 faction at a time |
| `loadGeneratedModularUnitAssets()` | modularUnits | 64 | image | **No — combat only, parked** |

**Total: 106 keys loaded at startup.**

### 3.3 Asset key definition files

| File | Role | Status |
|---|---|---|
| `src/assets/assetManifest.ts` | Legacy keys (TERRAIN_SAND, HQ_CYAN, HARVESTER_CYAN, minerals). Partially deprecated. | Active but partially @deprecated |
| `src/assets/generatedAssetManifest.ts` | Auto-generated manifest with all families, keys, paths, and loadType. Do not edit manually. | Primary source of truth |
| `src/assets/runtimeGeneratedAssets.ts` | Loader helpers that read from generated manifest and call Phaser loader. | Active, called by PreloadScene |
| `src/assets/buildingAssets.ts` | Key/path helpers + legacy loader. | Key helpers active, loader @deprecated |
| `src/assets/civilUnitAssets.ts` | Key/path helpers + legacy loader. | Key helpers active, loader @deprecated |
| `src/assets/modularUnitAssets.ts` | Key/path helpers + legacy loader. | Key helpers active, loader @deprecated |

### 3.4 Which assets are always required

Regardless of faction or game mode, these assets must always be loaded:

- **terrain**: 3 sand tiles (used by TerrainRenderer for every map)
- **resources**: 3 mineral sizes (used by EntityRenderer for resource nodes)
- **hq** (at least 1): selected faction HQ sprite
- **buildings** (at least 1 faction): 6 building sprites for selected faction
- **civilUnits** (at least 1 faction): 2 spritesheets (builder + harvester) for selected faction

### 3.5 Unused/future-facing assets

| Asset group | Keys | Why unused | When needed |
|---|---|---|---|
| **modularUnits** | 64 | Combat system is parked; ModularTankRenderer exists but is never called in Sandbox MVP civil loop | When combat is implemented |
| **non-selected faction HQ** | 3 | Only selected faction's HQ is rendered | If faction switching or enemy factions are shown |
| **non-selected faction buildings** | 18 | Only selected faction buildings rendered | If enemy faction buildings are visible |
| **non-selected faction civilUnits** | 6 | Only selected faction's builder/harvester rendered | If enemy faction units are visible |

---

## 4. Phaser 4.1.0 Loader Findings

All findings below are from the installed Phaser 4.1.0 package at `node_modules/phaser/`. No Phaser 3 assumptions were used.

### 4.1 LoaderPlugin key methods

| Method | Signature | Purpose |
|---|---|---|
| `pack()` | `pack(key, url?, dataKey?, xhrSettings?): this` | Load a pack file (JSON with grouped asset definitions) |
| `addPack()` | `addPack(pack, packKey?): boolean` | Parse pack data object directly into load queue (no fetch) |
| `removePack()` | `removePack(packKey, dataKey?): void` | Remove all assets defined in a pack from caches/managers |
| `start()` | `start(): void` | Begin loading (auto-called in preload; manual outside preload) |
| `keyExists()` | `keyExists(file): boolean` | Check if key conflicts with cache or queue |
| `addFile()` | `addFile(file): void` | Low-level add file to queue (with duplicate skip) |

### 4.2 Pack file support

**Phaser 4.1.0 fully supports pack files.** The format is:

```json
{
  "sectionName": {
    "prefix": "OPTIONAL_PREFIX.",
    "path": "assets/pics",
    "baseURL": "http://example.com/",
    "defaultType": "image",
    "files": [
      { "type": "image", "key": "myImage", "url": "assets/pics/my.png" },
      { "key": "ayu" }
    ]
  }
}
```

Each section has:
- `files`: array of file entries (required)
- `baseURL`: optional URL prefix
- `path`: optional relative path prefix
- `prefix`: optional key prefix
- `defaultType`: optional fallback type when entries omit `type`

`addPack(packData, sectionName?)` can load a specific section by name, enabling grouped loading.

`removePack(packKey, dataKey?)` can unload all assets from a pack section, including destroying textures from TextureManager. This is available since Phaser 3.85.0 and confirmed in 4.1.0.

### 4.3 Late-loading (after PreloadScene)

**Fully supported.** The `this.load` reference is always available on any scene. The only requirement is calling `this.load.start()` manually when outside of `preload()`:

```typescript
// Late-load pattern in create() or any method:
this.load.image('dynamicAsset', 'assets/new.png');
this.load.once('complete', () => {
  // Safe to use the asset now
  this.add.image(400, 300, 'dynamicAsset');
});
this.load.start(); // Required outside preload()
```

Files can also be added while loading is in progress.

### 4.4 Duplicate key handling

**Silently skipped.** If `keyExists()` returns true for a key, the file is dropped without error or warning. This means:

- Loading an already-loaded key is safe (no crash, no overwrite)
- But it also means the loader won't update/replace an existing texture

**Safest pattern:**
```typescript
if (!this.textures.exists(key)) {
  this.load.image(key, path);
}
```

### 4.5 Texture existence check

**`this.textures.exists(key)`** — returns boolean, no side effects, no console warnings. This is the canonical check.

(EntityRenderer already uses this pattern for faction key fallback.)

### 4.6 Selective asset unloading

Three mechanisms available:

| Method | Effect | Safety |
|---|---|---|
| `this.textures.remove(key)` | Destroy texture and free WebGL memory | Game objects using it will error on next render |
| `this.textures.removeKey(key)` | Remove key lookup but keep texture in memory | Safe for objects still referencing the texture |
| `this.load.removePack(packKey)` | Remove all assets from a pack section | Most comprehensive; handles animations, textures, caches |

**Warning**: Removing a texture that is still referenced by a Sprite will cause a render error. Unloading must only happen after all references are cleared.

---

## 5. Asset Group Inventory

### 5.1 Current manifest families and counts

| Family | Keys | Size on disk | loadType | MVP required | Faction-specific |
|---|---|---|---|---|---|
| terrain | 3 | ~2.4 MB | image | Yes | No (neutral) |
| resources | 3 | ~132 KB | image | Yes | No (neutral) |
| hq | 4 | ~2 MB | image | Yes (1 faction) | Yes |
| buildings | 24 | ~2 MB | image | Yes (1 faction) | Yes |
| civilUnits | 8 | ~20 MB | spritesheet | Yes (1 faction) | Yes |
| modularUnits | 64 | ~2.7 MB | image | No | Yes (4 factions x 2 units x 8 dirs) |

### 5.2 Conditional loading candidate groups

| Group | Keys | When to load | How to gate |
|---|---|---|---|
| **Base core** (terrain + resources) | 6 | Always, in PreloadScene | No gating needed |
| **Selected faction HQ** | 1 | After faction selection | Filter by `playerFaction` |
| **Selected faction buildings** | 6 | After faction selection | Filter by `playerFaction` |
| **Selected faction civil units** | 2 | After faction selection | Filter by `playerFaction` |
| **All faction HQ/buildings/civil** | 36 | If all factions needed | Load all at once |
| **Modular combat units** | 64 | When combat is implemented | Feature flag or combat gate |
| **Dev/Arena/Debug assets** | 0 (currently none separate) | Only in devtools mode | `isDevtoolsEnabled()` gate |

### 5.3 Memory impact estimate

Civil unit spritesheets are the dominant cost at ~2.5 MB each (256x256, 64 frames). A single faction's builder + harvester sheets are ~5 MB. All 4 factions = ~20 MB. Terrain is ~2.4 MB but only 3 small PNGs (the rest is probably the RenderTexture).

---

## 6. Conditional Loading Options

### Option A: Keep current full preload, just document groups

**What it is:** No code changes. Add documentation to the spike report describing asset groups and when each should be loaded in the future.

| Aspect | Detail |
|---|---|
| **Risk** | None — zero code changes |
| **Expected benefit** | Knowledge only; no performance improvement |
| **Touched files** | This report only |
| **What could break** | Nothing |
| **Validation needed** | None |
| **Worth doing now?** | Yes — documentation has value, but this is the minimum |

### Option B: Split dev/arena/debug assets only (exclude modularUnits from default preload)

**What it is:** Skip loading `modularUnits` family (64 keys, ~2.7 MB) in the standard PreloadScene. Only load it when devtools/arena mode is active, or when combat is implemented. Also gate any future dev-only asset groups.

| Aspect | Detail |
|---|---|
| **Risk** | Low — modularUnits are never used in Sandbox MVP; ModularTankRenderer exists but is never called |
| **Expected benefit** | 64 fewer image loads at startup (~60% of asset key count, ~2.7 MB disk). Modest startup improvement; the dominant memory/disk weight is civil unit spritesheets (~20 MB), not modularUnits. Measurable performance benefit may be small until asset count grows |
| **Touched files** | `PreloadScene.ts` (add condition around `loadGeneratedModularUnitAssets`), possibly `runtimeGeneratedAssets.ts` (add enabled flag support) |
| **What could break** | ModularTankRenderer would fail if called without assets loaded. Currently unreachable in MVP. Devtools arena could load them separately |
| **Validation needed** | `npm test`, `typecheck`, `build`, `qa:smoke`. Manual check: arena mode still works |
| **Worth doing now?** | **Yes** — low-risk loading hygiene. Reduces key count and avoids loading parked combat assets. Measurable performance benefit may be small until asset count grows, but the cleanup is clean and safe |

### Option C: Faction-aware loading for selected faction + neutral/core assets

**What it is:** After faction selection in NewGameSetupScene, load only the selected faction's HQ, buildings, and civil unit spritesheets. Neutral assets (terrain, resources) are always loaded. Other factions' assets are not loaded.

| Aspect | Detail |
|---|---|
| **Risk** | Medium — requires loading after PreloadScene (late-loading), must handle save/load of any faction, and EntityRenderer must gracefully handle missing textures |
| **Expected benefit** | Reduces loaded keys from 106 to ~31 (~70% reduction). Reduces spritesheet memory from ~20 MB to ~5 MB |
| **Touched files** | `PreloadScene.ts`, `NewGameSetupScene.ts` or a new loading scene, `GameScene.ts`, possibly `runtimeGeneratedAssets.ts`, `generatedAssetManifest.ts` |
| **What could break** | Save/load of games with different factions (load would need to late-load that faction's assets). Faction switching. Asset diagnostics. Tests that assume all keys exist |
| **Validation needed** | Full test suite + manual multi-faction testing + save/load round-trip + arena mode. Significant validation effort |
| **Worth doing now?** | **Not yet** — the benefit is real but the current asset count is manageable (~36 MB). Faction-aware loading should be revisited when: (1) asset count grows significantly, (2) combat is implemented and adds more faction assets, (3) save/load requires loading different factions. The EntityRenderer's `textures.exists()` fallback already makes this safe architecturally, so the groundwork is laid |

---

## 7. Faction-Aware Loading Feasibility

### 7.1 Is it safe to load only selected faction assets?

**Architecturally yes, with caveats:**

EntityRenderer already uses `this.scene.textures.exists(key)` checks before rendering HQ and harvester sprites. When the key is missing, it falls back to the cyan variant:

```typescript
// EntityRenderer.ts line 275
if (!this.scene.textures.exists(hqKey)) {
  hqKey = `hq_cyan`; // fallback
}
```

This fallback pattern means that if only cyan is loaded, a non-cyan faction would display cyan visuals — which is exactly the pre-FIX-01 behavior. The fallback is safe (no crash) but defeats the purpose of faction-aware loading (you'd see wrong-color assets).

**To make faction-aware loading work correctly, you would need:**

1. Load the selected faction's assets after faction selection (late-loading or a loading scene between NewGameSetupScene and GameScene)
2. Ensure EntityRenderer's fallback still works for dev/edge cases
3. Handle save/load: when loading a save with a different faction, late-load that faction's assets before starting GameScene

### 7.2 What breaks if only selected faction is loaded?

| Scenario | Impact | Mitigation |
|---|---|---|
| Player selects green faction | Only green assets loaded; cyan/yellow/purple keys missing | EntityRenderer falls back to cyan — wrong color but no crash |
| Player loads a save with purple faction | Purple assets not loaded; would see cyan fallback | Must late-load purple assets before GameScene starts |
| Asset diagnostics check all keys | Would report missing keys as failures | Update diagnostics to only check loaded faction's keys |
| Arena mode with devtools | May want all faction assets for testing | Load all factions in arena mode |

### 7.3 Does current FIX-01 faction wiring depend on all keys being present?

**No, it does not.** FIX-01 wired faction-specific keys so that the correct texture is used when available. EntityRenderer's `textures.exists()` check provides a safe fallback when keys are missing. The design was intentional: use the correct faction key if loaded, fall back to cyan otherwise.

### 7.4 Is cyan fallback still safe if only selected faction is loaded?

**Yes for robustness, no for correctness.** The cyan fallback prevents crashes but shows wrong-colored sprites. If only the selected faction is loaded, the fallback would only trigger for edge cases (dev/arena scenarios), not normal gameplay.

---

## 8. Save/Load and Fallback Implications

### 8.1 Save/load requires the correct faction's assets

When a saved game is loaded, the `playerFaction` is stored in the save data. If only the selected faction's assets were loaded, loading a save with a different faction would require:

1. Reading the faction from save metadata before starting GameScene
2. Late-loading that faction's assets (HQ, buildings, civilUnits)
3. Optionally unloading the previous faction's assets

Phaser 4.1.0's late-loading (`this.load.start()`) and `removePack()` make this technically straightforward.

### 8.2 Current load flow

```text
MainMenuScene → "Continue" → loadGame() → scene.start('GameScene', { loadedGameState, ... })
```

GameScene.init() receives the loaded state and uses `state.playerFaction`. If faction-aware loading is implemented, a loading step would need to happen between the save selection and GameScene start.

### 8.3 Simplest approach for save/load

Add a short "AssetLoadScene" that:
1. Receives the target faction from the scene data
2. Checks `textures.exists()` for each required key
3. Late-loads any missing faction assets
4. On `load.complete`, starts GameScene

This is a clean pattern that doesn't require PreloadScene changes and works for both new games and loaded saves.

---

## 9. Recommended PHASER4-LOAD-02 Scope

### Recommendation: Option B — dev/arena-only conditional loading

**Scope for PHASER4-LOAD-02:**

1. **Skip modularUnits in standard PreloadScene** — add a condition that only calls `loadGeneratedModularUnitAssets()` when devtools/arena is active or a feature flag is set
2. **Document the faction-aware loading architecture** for future implementation, but do not implement it yet
3. **Add an `enabled` flag mechanism** to the generated manifest loader so families can be conditionally loaded based on runtime context

**Why not Option C (faction-aware) now:**

- Current asset count (~36 MB, 106 keys) is manageable for a web game
- The 64 modular unit keys (60% of key count) are the largest group of unused keys, but they represent only ~2.7 MB of disk — the dominant memory/disk weight is civil unit spritesheets at ~20 MB. Removing modularUnits reduces key count significantly, but the measurable performance benefit may be small until the asset count grows further.
- Faction-aware loading requires a loading scene, save/load integration, and more testing
- The EntityRenderer fallback already provides the safety net for future faction-aware loading
- Asset count will grow with combat, VFX, and more factions — that's when faction-aware loading becomes worth the complexity
- Option B is still acceptable as low-risk loading hygiene: it reduces key count and avoids loading parked combat assets. But it is not a major memory or startup-size win at current asset volumes.

**What PHASER4-LOAD-02 should NOT do:**

- Change PreloadScene's core loading flow
- Add a new loading scene
- Implement faction-aware loading
- Change generatedAssetManifest.ts
- Add asset unloading
- Change EntityRenderer's fallback behavior

---

## 10. Reject Criteria / Risks

### When to reject PHASER4-LOAD-02 implementation

- If `qa:smoke` fails after modular unit loading is gated
- If arena mode breaks because modular units are not available
- If the implementation requires changes to `generatedAssetManifest.ts`
- If the implementation requires changes to save/load logic
- If the implementation touches EntityRenderer, BuildingStatusRenderer, or ConstructionRenderer
- If the enabled-flag mechanism adds complexity disproportionate to the benefit

### Risks of NOT implementing any conditional loading

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Startup time grows as assets are added | High (combat will add many assets) | Medium | Implement Option B now, Option C later |
| GPU memory pressure with all factions loaded | Medium | Medium | Monitor; faction-aware loading when needed |
| Asset bloat from VFX/particles | High | Low | VFX assets can be a separate gated group |

---

## 11. Validation Plan for Future Implementation

### For PHASER4-LOAD-02 (Option B: dev/arena-only gating)

| Step | Command | Expected |
|---|---|---|
| Unit tests | `npm test` | 744+ pass, no new failures |
| Type check | `npm run typecheck` | Clean |
| Production build | `npm run build` | Success |
| Smoke test (standard) | `npm run qa:smoke` | PASS with 3 markers |
| Arena mode | Manual check with `?devtools=1&arena=1` | Modular tanks render |
| Non-arena mode | Manual check without devtools | No modular tank textures loaded |
| Asset diagnostics | Check console for missing texture warnings | No unexpected warnings |

### For future faction-aware loading (Option C)

Additional validation would be needed:

- Multi-faction startup test (cyan, green, yellow, purple)
- Save/load round-trip with different factions
- Faction switching scenario
- Asset diagnostics with partial loading
- Arena mode with all factions loaded
- Memory comparison (all factions vs selected faction)

---

## 12. Ready-to-Send Implementation Prompt

**Only if Option B is approved for PHASER4-LOAD-02:**

```text
Task: PHASER4-LOAD-02 — Dev/arena-only conditional asset loading
Mode: IMPLEMENTATION ONLY

Active repo: ratoker-jpg/four-elements-phaser
Reference/donor repo: ratoker-jpg/four-elements-next
four-elements-next is donor/reference only — do not use as implementation baseline.

Before doing anything:
1. Confirm active repo is ratoker-jpg/four-elements-phaser.
2. Confirm package.json has "phaser": "4.1.0".
3. Confirm main includes merged PR #90 / PHASER4-LOAD-01 report.
4. Read:
   - docs/project/GLM_EXECUTOR_RULES.md
   - docs/project/GPT_WORKFLOW.md
   - docs/project/PROJECT_STATE.md
   - docs/project/PHASER4_AUDIT_CLARIFICATION_RETRY.md
   - docs/project/PHASER4_LOAD_01_SPIKE_REPORT.md
   - docs/project/FIX_BACKLOG.md
   - src/phaser/PreloadScene.ts
   - src/assets/runtimeGeneratedAssets.ts
   - src/assets/generatedAssetManifest.ts
   - package.json
5. If repo/version/docs/main mismatch, stop and report. Do not continue.

Goal:
Gate modularUnits loading so it only happens when devtools/arena mode
is active. Standard game startup should skip loading 64 modular combat
unit images.

Scope (Option B only):
- PreloadScene: add condition around loadGeneratedModularUnitAssets()
- Determine how to detect devtools/arena mode at preload time
  (currently devtools is checked in GameScene.create() via
  isDevtoolsEnabled() which reads URL params)
- Do NOT add a new loading scene
- Do NOT change generatedAssetManifest.ts
- Do NOT implement faction-aware loading
- Do NOT change EntityRenderer fallback behavior
- Do NOT add asset unloading
- Do NOT change renderer code
- Do NOT change save/load logic

Hard rules:
- Do not change PreloadScene's core loading flow for core assets
- Do not change generatedAssetManifest.ts
- Do not add asset unloading
- Do not change EntityRenderer, BuildingStatusRenderer, ConstructionRenderer
- Do not change save/load logic
- Do not implement faction-aware loading
- Do not start PHASER4-GPU-01
- Do not use four-elements-next as implementation baseline

PR body requirements:
- Title: PHASER4-LOAD-02: Dev/arena-only conditional asset loading
- Reference this spike report (PHASER4-LOAD-01)
- List changed files
- Confirm all validation steps passed

Validation:
- npm test
- npm run typecheck
- npm run build
- npm run qa:smoke
- Manual: arena mode still shows modular tanks
- Manual: non-arena mode has no modular tank textures loaded

Telegram notification:
At task completion, send Telegram notification using
/home/z/my-project/.telegram-notify.json if available.
Do not expose token.
Missing/invalid config or send failure must not block the task.
Report notification status: sent / skipped: config missing / failed: <reason>

Open PR into main.
Do not merge.
```

---

## Commands Run / Verification

| Command | Result |
|---|---|
| `git remote -v` | Confirmed `ratoker-jpg/four-elements-phaser` |
| `grep '"phaser"' package.json` | `"phaser": "4.1.0"` |
| PR #89 merge check via GitHub API | `merged: True` |
| `git checkout main && git pull` | Updated to `4b0d008` |
| Phaser 4.1.0 Loader source analysis | LoaderPlugin.js, PackFile.js, TextureManager.js inspected |
| Donor repo asset loading inspection | `four-elements-next` Phaser path loads all manifests unconditionally |
| `du -sh public/assets/` | 36 MB total |
| Asset key count by family | 106 total (hq:4, buildings:24, civilUnits:8, modularUnits:64, terrain:3, resources:3) |
| `textures.exists` usage in codebase | EntityRenderer (3 checks), ConstructionRenderer, GameScene |

No runtime validation was required by the task spec. All findings are from source code inspection and Phaser 4.1.0 package analysis.
