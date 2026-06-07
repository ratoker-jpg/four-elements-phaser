# PHASE_2_ROADMAP_AUDIT.md

> **DEPRECATED — This audit is no longer the active planning gate.**
> The sand-terrain-focused Phase 2 direction has been superseded by `docs/project/VISUAL_ROADMAP.md`.
> Archived copy: `docs/project/archive/PHASE_2_ROADMAP_AUDIT.md`
> Read this file only as historical reference.

Status: **archived / deprecated**
Project: Four Elements Phaser
Active repo: `ratoker-jpg/four-elements-phaser`
Phaser version: 4.1.0
Reference/donor repo: `ratoker-jpg/four-elements-next` (donor/reference only)
Date: 2026-05-29
Archived on: 2026-05-30

---

## 1. Executive summary

### Audit verdict

**Phase 2 roadmap direction is correct and should be accepted as active direction.** The pivot from engine/foundation stabilization to playability, visual identity, menu flow, animated assets, terrain, and arena is well-timed: Phase 1 delivered a functional Sandbox MVP civil loop (PR #83–#95), but the current product does not feel like an RTS prototype — it feels like a collection of debug systems with a working economy. Phase 2 addresses exactly this gap.

### Whether Phase 2 direction is correct

**Yes.** The direction correctly prioritises player-facing polish over technical cleanup. Key reasons:

1. The civil economy loop works but the game lacks a "soft goal" — the player does not know what to aim for in a 10–15 minute session.
2. Two HUD systems create confusion; the game needs a single coherent interface.
3. The map looks like a chessboard, not terrain — the most immediately visible product problem.
4. Units have walk cycle frames in spritesheets but only show idle-facing — a missed visual opportunity that Animation Manager already supports.
5. Arena mode requires URL parameters; it should be selectable from the menu.

### Top 5 roadmap risks

| # | Risk | Severity | Description |
|---|------|----------|-------------|
| 1 | ASSET-WORKFLOW-01 defines wrong conventions | high | If the animated asset pipeline specifies wrong anchor/scale/direction rules, all subsequent unit regeneration PRs (UNIT-ANIM-01, UNIT-ANIM-02, and later combat units) will need rework. This is the highest-impact design decision in Phase 2. |
| 2 | TERRAIN-01 scope creep into renderer rewrite | medium-high | The terrain visual system could expand from "add variation patches and decals on existing RenderTexture" into "replace the entire terrain renderer", which would be a high-risk, multi-PR effort. The audit constrains this risk. |
| 3 | MENU-02 mode selection breaks conditional loading | medium | Mode selection from menu must correctly gate modularUnits loading without requiring page reload. If implemented incorrectly, it could load combat assets in standard mode or fail to load them in arena mode. |
| 4 | FOG-01 touches too many systems simultaneously | medium | Fog of war affects rendering, game state, minimap, devtools, and performance. If implemented as one large PR, it creates high integration risk. |
| 5 | HOTKEYS-01 overbuilds command card | medium | The audit/design + implementation task could expand from "config-driven hotkey registry" into "full StarCraft-style command card UI", which is premature before combat exists. |

### Top 5 implementation priorities

| # | Priority | Task ID | Rationale |
|---|----------|---------|-----------|
| 1 | Define animated asset pipeline before any sprite regeneration | ASSET-WORKFLOW-01 | All subsequent unit animation PRs depend on this. Must be accepted before UNIT-ANIM-01/02. |
| 2 | Remove chessboard terrain look | TERRAIN-01 | Most visible product improvement. Can be mostly asset/generator work without renderer changes. |
| 3 | Consolidate to single HUD | HUD-01 (from Phase 1 audit) | Two HUDs confuse players. This was high-severity in Phase 1 audit and should be completed early in Phase 2. |
| 4 | Menu mode selection + proper loading screen | MENU-01 + LOADING-01 | Makes the game feel like a product, not a debug tool. Low risk, high product value. |
| 5 | Builder stable IDs + harvester reliability | BUILDER-ID + SP-01/02 (from Phase 1 audit) | Technical prerequisites for reliable unit management. Should be completed before or alongside animation work. |

### Whether the roadmap can authorize direct implementation after acceptance

**Yes, with the following constraints:**

- Tasks where this audit provides sufficient design detail can proceed directly to implementation after audit acceptance.
- Tasks that require additional mini-design despite this audit: ASSET-WORKFLOW-01 (by nature — it is a design + tooling task), HOTKEYS-01 (audit/design part must be accepted first), VISUAL-SPIKE-01 (spike by definition), WEAPON-WORKFLOW-01 (audit/design by definition).
- Implementation PRs must stay within the scope approved by this audit. If a PR expands scope or discovers new risks, a separate design doc is required before continuing.

---

## 2. Repo/version/docs confirmation

| Check | Expected | Actual | Match |
|-------|----------|--------|-------|
| Active repo | `ratoker-jpg/four-elements-phaser` | `ratoker-jpg/four-elements-phaser` | Yes |
| Phaser version | 4.1.0 | `"phaser": "4.1.0"` in package.json | Yes |
| PR #95 merged | Yes | `fc37e25` — ARCH-11A QA smoke | Yes |
| PR #96 merged | No | FULL-PROJECT-AUDIT-01 — not merged, superseded by Phase 2 roadmap direction | N/A |
| PR #97 merged | Yes | DOCS-P2-ROADMAP | Yes |
| PHASE_2_ROADMAP.md exists | Yes | Present in docs/project/ | Yes |
| PHASE_2_ROADMAP_AUDIT_PROMPT.md exists | Yes | Present in docs/project/ | Yes |

### Stale docs that need later checkpoint

- `PROJECT_STATE.md` — describes status before PR #95, does not reflect Phase 2 roadmap
- `CURRENT_NEXT_STEP.md` — points to ARCH-11A, which is complete
- `NEW_CHAT_HANDOFF.md` — does not reflect Phase 2
- `FIX_BACKLOG.md` — needs update with Phase 2 task references

These will be updated in DOCS-P2-00 after audit acceptance, not in this PR.

### Active accepted baseline

- **PR #97** (DOCS-P2-ROADMAP) is the Phase 2 roadmap draft source and is merged.
- **PR #98** (PHASE-2-ROADMAP-AUDIT, this PR) is the accepted audit gate after merge.
- **PR #96** (FULL-PROJECT-AUDIT-01) is **not merged** and is superseded / not an active baseline. `FULL_PROJECT_AUDIT_20260529.md` is not accepted source-of-truth. No future implementation prompt should require PR #96 or treat the Phase 1 audit doc as an active gate.

---

## 3. Current system model relevant to Phase 2

### Scene flow

```text
BootScene (0 assets, init only)
  → PreloadScene (loads all approved assets)
    → MainMenuScene (DOM overlay, New Game / Continue / Settings)
      → NewGameSetupScene (DOM overlay, faction/map/seed selection)
        → GameScene (main game loop, all subsystems)
```

Phaser 4 scene lifecycle: `scene.start(key, data)` passes optional data via `init(data)`. Scene shutdown triggers `Phaser.Scenes.Events.SHUTDOWN` event. No custom scene manager is used.

### Menu flow

- **MainMenuScene** (632 LOC): DOM overlay with New Game, Continue, Settings buttons. `?skipMenu` auto-advances to GameScene with defaults for QA. Continue shows save list overlay with delete controls. Settings has UI Scale selector.
- **NewGameSetupScene** (471 LOC): DOM overlay with faction (4), map mode (fixed/generated), map size, seed input. Esc returns to main menu.
- **No mode selection in menu**: Standard/Debug/Arena mode is determined by URL parameters (`?devtools=1`, `?arena=1`), not by menu buttons. This is the primary UX gap that MENU-01 addresses.

### Loading flow

- **BootScene**: 20 LOC, minimal init, immediately starts PreloadScene.
- **PreloadScene**: 55 LOC, loads terrain/resources/buildings/HQ/civilUnits via generated manifest loaders. modularUnits gated by `isDevtoolsEnabled()`. Logs progress at 25% milestones. No visual progress UI — only console logging. This is the gap that LOADING-01 addresses.
- **No loading screen**: Player sees blank canvas during asset loading. For standard mode (~42 assets) this is fast (~1-2s), but for arena/devtools mode (~106 assets) it can take 3-5s with no feedback.

### Mode detection / URL params

- `isDevtoolsEnabled()` from `src/state/devCommands.ts` checks `?devtools=1` URL parameter.
- `isArenaEnabled()` from `src/state/devArena.ts` checks `?arena=1` URL parameter.
- Arena mode requires both `?devtools=1&arena=1`.
- `shouldSkipMenu()` from `src/state/gameSetup.ts` checks `?skipMenu` or `?autostart`.
- **No session/global state for mode**: Mode is determined purely from URL at page load time. Changing mode requires page navigation with different URL params.

### PreloadScene conditional loading

```typescript
if (isDevtoolsEnabled()) {
  loadGeneratedModularUnitAssets(this);  // 64 combat images
} else {
  // skipped — standard mode loads 42 keys
}
```

This is the key constraint for MENU-02: if mode selection happens in MainMenuScene (after PreloadScene has already loaded), arena mode assets would not be available unless a late-loading mechanism or controlled page reload is implemented.

### GameScene startup

GameScene `init(data)` receives either a `GameSetupConfig` (new game) or `LoadSceneData` (loaded save). `create()` does:

1. Compute devtools/arena flags from URL params.
2. Resolve game state source: loaded save → arena → normal setup.
3. `stripModularCombatFromState()` for loaded saves in standard mode.
4. Create renderers: TerrainRenderer, EntityRenderer, BuildingStatusRenderer, FeedbackRenderer, UnitMotionFxRenderer.
5. Create input: CameraControls, GameInputController.
6. Create UI: PlaytestHud, PauseMenu, DevtoolsPanel (if devtools), DebugOverlayRenderer (if devtools).
7. Center camera on HQ, start game loop.

### Arena/devtools flow

- Arena creates a 20×20 map with `createArenaMapData()`, includes modular-combat entities.
- Devtools panel provides resource controls, spawn controls, diagnostics, overlay toggles.
- Arena reset restarts GameScene with arena config.
- **No menu entry**: Arena is accessible only via `?devtools=1&arena=1` URL.

### Input/hotkeys

- **GameInputController** (543 LOC): All keyboard/pointer input handling.
- Build hotkeys: B (separator), F (units-factory), P (power-plant).
- Production hotkeys: N (builder), G (harvester).
- Camera: drag pan, scroll zoom, R reset.
- Debug: T overlay toggle, Q/E body dir, Z/X turret dir, H/J layer select, C print offsets, F10/backtick devtools toggle.
- Selection: Left-click select unit, left-click move selected unit.
- **No command card UI**: Hotkeys are scattered, not displayed in-game, not configurable.

### HUD / DOM UI

- **PlaytestHud** (712 LOC): Fixed top-right sidebar with economy, harvesters, separators, factory, build buttons, production buttons, diagnostics. DOM overlay with inline CSS.
- **Legacy top-bar HUD**: `updateHUD()` in GameScene updates DOM elements by ID (hudCoords, hudMapName, hudEconomy, hudBuild, hudBuilder). Read-only economy/status display.
- **Two HUD problem**: Both show economy info in different formats. Player confusion documented in Phase 1 audit.
- **PlaytestHud innerHTML per frame**: All sections rebuilt via `innerHTML` each frame (~60fps). DOM churn risk at scale.
- **Inline CSS**: ~400+ lines of duplicated inline CSS across PlaytestHud, PauseMenu, DevtoolsPanel, MainMenuScene, NewGameSetupScene.

### Terrain renderer

- **TerrainRenderer** (118 LOC): Creates a RenderTexture, stamps each terrain tile once using `renderTexture.stamp()`. Three tile types: sand, sand-dark, sand-light.
- **Chessboard problem**: All tiles are identical diamond shapes with slight color variation. No patch variation, no decals, no edge blending. The grid pattern is obvious.
- **Performance**: RenderTexture is stamped once and cached. Camera scrolls over it. No per-frame terrain redraw. This is efficient and should be preserved.
- **TERRAIN_STAMP_CONFIG**: Tiles are scaled from 1180×741 source to 76×38 isometric cells.

### Entity/building renderer

- **EntityRenderer** (495 LOC): Static entities (HQ, builder, modular-combat) + dynamic entities (harvesters with Animation Manager, resources with depletion state).
- **ConstructionRenderer** (487 LOC): Construction sites + completed buildings + builder sprites.
- **BuildingStatusRenderer** (413 LOC): Progress bars + status text for separators, factories, construction sites.
- **Building grounding problem**: Buildings may appear visually offset above their footprints. generatedBuildingMeta and buildingPlacementMeta provide origin/scale data, but HQ specifically may need anchor adjustment (BASE-ANCHOR-01).

### Asset pipeline

- **generatedAssetManifest.ts** (155 LOC): Auto-generated manifest of all 106 asset keys.
- **runtimeGeneratedAssets.ts** (196 LOC): Loader helpers called by PreloadScene.
- **generatedBuildingMeta.ts** (470 LOC): Per-building PNG placement metadata.
- **buildingPlacementMeta.ts** (418 LOC): Origin/scale/anchor data for building rendering.
- **Deprecated loaders**: assetManifest.ts, buildingAssets.ts, civilUnitAssets.ts, modularUnitAssets.ts have `@deprecated` loaders but active key/path helpers.

### Animation Manager usage

- **Harvesters**: Migrated to Animation Manager (PHASER4-ANIM-02). Direction-based animation keys per faction. Walk cycle at 8fps. Idle as single-frame animation.
- **Builders**: Still use `setFrame()` with manual direction row indexing. Walk cycle frames exist in spritesheet but are unused.
- **Animation key pattern**: `{unitType}_{faction}_{state}_{direction}` — e.g., `harvester_cyan_move_s`.
- **Total registered**: 64 animation keys (4 factions × 2 states × 8 directions).

### QA smoke coverage

- **qa_smoke.mjs**: Dual-mode (standard + devtools), console markers, DOM assertion `#hud-economy`.
- **Current coverage**: Startup verification only. Does not test economy cycle, unit commands, or build flow.
- **URL shortcuts**: `?skipMenu`, `?devtools=1`, `?arena=1` — must be preserved for smoke testing.

---

## 4. Roadmap direction assessment

### The pivot is correct

The pivot from technical cleanup to playable/visual RTS feel is well-timed for these reasons:

1. **Phase 1 technical foundation is solid.** The civil economy loop, faction asset wiring, Animation Manager, conditional loading, and QA smoke are all working. No critical blockers remain in the technical layer.
2. **The product gap is visible.** A 10-minute playtest reveals: chessboard terrain, static-feeling units, two HUDs, technical feedback text, no session goal, no menu mode selection. These are product problems, not technical debt.
3. **Visual identity is the next bottleneck.** Without terrain variation, unit animation, and proper menu flow, the game cannot be meaningfully playtested by new users. Technical debt like `updateGameState.ts` decomposition is important but does not block the next product milestone.

### What technical debt can safely wait

- **updateGameState.ts decomposition** (DECOMP-01): 866 LOC monolith. Important for long-term maintainability but does not block any Phase 2 task. Can proceed in parallel during Next phase.
- **moveToward/getRingCandidates deduplication** (DEDUPE-01): Code duplication risk, but no Phase 2 task modifies movement helpers. Safe to defer.
- **Power allocation duplication**: statusHelpers replicates conditions from updateGameState. No Phase 2 task changes power allocation logic.
- **Inline CSS extraction** (CSS-01): ~400+ lines of duplicated CSS. Important for maintainability but not blocking any visual improvement.
- **PlaytestHud innerHTML optimization** (HUD-02): DOM churn at ~60fps. Noticeable at scale but not at current unit counts (~10 units).

### What technical debt still blocks Phase 2

- **Two HUD systems** (HUD-01): Directly blocks any HUD improvement because changes must be made in two places. Must be resolved before HOTKEYS-01 command card integration.
- **Builder array index identification** (BUILDER-ID): Blocks builder Animation Manager migration because animation state mapping requires stable unit identification. Must be resolved before UNIT-ANIM-02.
- **Harvester reliability** (SP-01/02): Not a direct Phase 2 blocker, but a harvester that gets stuck during a playtest undermines the entire visual/polish effort. Should be completed in parallel with early Phase 2 tasks.

---

## 5. Task-by-task audit

### DOCS-P2-00 — Phase 2 docs checkpoint after audit acceptance

**Problem statement:** PROJECT_STATE.md, CURRENT_NEXT_STEP.md, NEW_CHAT_HANDOFF.md, and FIX_BACKLOG.md are stale — they describe pre-Phase-2 status. New GPT/GLM sessions will not follow Phase 2 direction without updated docs.

**Current code support:** No code impact. Pure documentation task.

**Current blockers:** None. Depends only on this audit being accepted.

**Recommended scope:** Update PROJECT_STATE.md to reflect Phase 2 as active roadmap. Update CURRENT_NEXT_STEP.md to point to first Phase 2 task. Update NEW_CHAT_HANDOFF.md with Phase 2 context. Update FIX_BACKLOG.md with Phase 2 cross-references.

**Risk:** Low. Docs-only, no runtime impact.

**Can go directly to implementation after audit:** Yes.

**Likely touched files:** PROJECT_STATE.md, CURRENT_NEXT_STEP.md, NEW_CHAT_HANDOFF.md, FIX_BACKLOG.md.

**Validation strategy:** Docs-only. No runtime validation required.

**Manual QA:** Verify new GPT/GLM sessions read updated docs and follow Phase 2 direction.

**What not to touch:** Runtime code, tests, assets, package files.

---

### MENU-01 — Main menu mode selection

**Problem statement:** The game requires separate URL links for debug/arena modes. Users cannot select Standard/Debug/Arena from the menu. This makes the game feel like a debug tool, not a product.

**Current code support:** MainMenuScene already has a DOM overlay with buttons (New Game, Continue, Settings). Adding mode buttons fits naturally into the existing structure. The scene uses `scene.start('GameScene', config)` to pass setup configuration, which already supports faction/map/seed parameters.

**Current blockers:** None for basic mode selection. The challenge is in MENU-02 (how mode selection interacts with conditional loading).

**Recommended scope:**

1. Add mode selection to NewGameSetupScene (not MainMenuScene). Three buttons: Standard / Debug / Arena. Default: Standard.
2. Store selected mode in GameSetupConfig alongside faction/map/seed.
3. **Controlled URL launch model**: When Debug or Arena is selected, navigate/reload to the appropriate URL with existing shortcuts:
   - Standard → start normally (no URL params change)
   - Debug → `window.location.href` with `?devtools=1` appended (preserving other params)
   - Arena → `window.location.href` with `?devtools=1&arena=1` appended
4. This ensures PreloadScene loads the correct assets on the reload pass — no late-loading needed in MENU-01.
5. Preserve existing URL shortcuts (`?skipMenu`, `?devtools=1`, `?arena=1`) as dev/test overrides.
6. Do NOT implement mode-aware late-loading in this PR — that is MENU-02.
7. Do NOT change PreloadScene or asset loading behavior.
8. MENU-02 can later replace the controlled reload with true mode-aware late-loading (no page reload) if still desired.

**Risk:** Low. Adding a UI selector that triggers a controlled page reload with existing URL params. No loading or asset changes. The reload is the same as manually typing the URL, just automated from the menu.

**Can go directly to implementation after audit:** Yes. The design is straightforward.

**Likely touched files:** NewGameSetupScene.ts, gameSetup.ts (add mode to GameSetupConfig).

**Validation strategy:** npm test, typecheck, build, qa:smoke. Manual QA: menu mode buttons work, URL shortcuts still work.

**Manual QA:**
- Start Standard from menu — no devtools panel, no arena (normal launch)
- Start Debug from menu — page reloads with `?devtools=1`, devtools panel visible, modularUnits loaded
- Start Arena from menu — page reloads with `?devtools=1&arena=1`, arena map, devtools panel, modularUnits loaded
- `?skipMenu` — auto-starts with default mode (Standard)
- `?skipMenu&devtools=1&arena=1` — still works as before (URL overrides)

**What not to touch:** PreloadScene, asset loading, GameScene game loop, runtime state.

---

### MENU-02 — Mode-aware loading and launch flow

**Problem statement:** If Arena is selected from menu, modularUnits assets must still be loaded. Currently, PreloadScene loads modularUnits only when `isDevtoolsEnabled()` returns true, which checks URL params. Menu-selected mode is not available until after MainMenuScene, which runs after PreloadScene.

**Current code support:**
- PHASER4-LOAD-02 spike confirmed Phaser 4.1.0 supports late-loading via `this.load.start()` outside `preload()`.
- `this.load.addPack()` can parse pack data directly without fetching.
- `this.textures.exists(key)` is the canonical check for loaded textures.
- EntityRenderer already has `textures.exists()` fallback for faction keys.

**Current blockers:** PreloadScene runs before MainMenuScene. Mode is determined in menu, but assets are loaded before mode is known.

**Recommended scope:**

1. **PreloadScene always loads base assets** (terrain, resources, buildings, HQ, civilUnits — 42 keys).
2. **GameScene.create()** checks mode from scene data. If Debug/Arena mode and modularUnits not loaded, trigger late-loading:
   ```typescript
   if (mode === 'debug' || mode === 'arena') {
     if (!this.textures.exists('modular_wasp_cyan_e')) {
       loadGeneratedModularUnitAssets(this);
       this.load.once('complete', () => { /* proceed with setup */ });
       this.load.start();
     }
   }
   ```
3. **Show loading indicator** during late-load (can be simple text overlay, formal loading screen is LOADING-01).
4. **Preserve URL shortcuts** as overrides that set mode before PreloadScene (for qa:smoke compatibility).
5. **Do NOT add asset unloading.** Once loaded, assets remain for the session.

**Risk:** Medium-high. Late-loading must work correctly, and `isDevtoolsEnabled()` checks scattered through codebase must be updated to also check mode from game config.

**Can go directly to implementation after audit:** Yes, with constraint: must carefully audit all `isDevtoolsEnabled()` call sites and ensure they check both URL params and config-based mode.

**Likely touched files:** PreloadScene.ts, GameScene.ts, devCommands.ts (extend isDevtoolsEnabled to check config), gameSetup.ts.

**Validation strategy:** npm test, typecheck, build, qa:smoke. Manual QA: all three modes from menu + URL overrides.

**Manual QA:**
- Standard from menu — modularUnits not loaded, no modular-combat entities
- Debug from menu — modularUnits loaded via late-load, devtools panel works
- Arena from menu — modularUnits loaded, arena map, modular-combat entities rendered
- `?devtools=1&arena=1` — works as before (URL override, loads in PreloadScene)
- Save in Debug mode → Load in Standard mode — modular-combat stripped

**What not to touch:** Game loop, state logic, asset manifest, renderer code.

---

### LOADING-01 — Proper loading screen

**Problem statement:** No visual loading feedback. Player sees blank canvas during asset loading.

**Current code support:** PreloadScene already listens to `this.load.on('progress', callback)` and logs milestones. Phaser Loader events include: `loaderror`, `fileprogress`, `complete`. The infrastructure exists; only the visual display is missing.

**Current blockers:** None. Can be implemented independently.

**Recommended scope:**

1. Add a DOM overlay or Phaser Graphics/Text progress bar to PreloadScene.
2. Display: game title, loading progress bar (0–100%), current asset being loaded (optional), mode/map/faction labels (if available from scene data).
3. No fake progress — use Phaser Loader's actual progress events.
4. Style consistent with MainMenuScene direction (dark background, blue accent color).
5. Do NOT add heavy UI framework — keep it simple DOM or Phaser primitives.

**Risk:** Low. Visual-only addition to an existing scene.

**Can go directly to implementation after audit:** Yes.

**Likely touched files:** PreloadScene.ts (add progress UI), possibly src/styles.css.

**Validation strategy:** npm test, typecheck, build, qa:smoke. Manual QA: loading bar visible, progresses correctly.

**Manual QA:**
- Start new game — loading screen visible with progress
- Progress reaches 100% before menu appears
- `?skipMenu` — loading screen still visible briefly, does not block auto-start
- Arena mode — loading screen shows longer duration (106 vs 42 assets)

**What not to touch:** Asset manifest, loader configuration, MainMenuScene, GameScene.

---

### HOTKEYS-01 — Hotkeys and command card design

**Problem statement:** Hotkeys are scattered across GameInputController with no visible UI, no configurability, and no command registry. The player must memorize hotkeys or read console logs.

**Current code support:**
- GameInputController wires keyboard events via Phaser's keyboard plugin (`kb.on('keydown-B', ...)`).
- Build hotkeys: B/F/P. Production hotkeys: N/G. Camera: R. Debug: T, Q/E, Z/X, H/J, C, F10.
- PlaytestHud has build/production buttons but they call the same `requestBuild()`/`requestQueueUnit()` methods as hotkeys.
- No command registry, no hotkey display, no configurability.

**Current blockers:** Two HUD problem (HUD-01) should be resolved first so that command card has a single integration point.

**Recommended scope:**

1. **Design phase** (audit/design part): Define a command registry data structure:
   ```typescript
   interface CommandDef {
     id: string;
     label: string;       // "Build Separator"
     hotkey: string;      // "B"
     category: string;    // "build" | "produce" | "camera" | "debug"
     action: () => void;
     condition?: () => boolean;  // when button should be disabled
   }
   ```
2. **Implementation phase**: Create `src/state/commandRegistry.ts` with registered commands. Replace inline hotkey wiring in GameInputController with registry-based dispatch. Add hotkey labels to PlaytestHud buttons.
3. **Do NOT build full command card UI** — that requires combat context. Show hotkey hints on existing buttons only.

**Risk:** Medium-high. Refactoring input dispatch must not break existing controls.

**Can go directly to implementation after audit:** No — the audit/design part must be accepted first. The design doc should specify the exact registry structure, command list, and UI integration points. Implementation follows in a separate PR.

**Likely touched files:** New `src/state/commandRegistry.ts`, GameInputController.ts (refactor hotkey wiring), PlaytestHud.ts (add hotkey labels to buttons).

**Validation strategy:** npm test (add registry unit tests), typecheck, build, qa:smoke. Manual QA: all hotkeys still work, labels visible on buttons.

**Manual QA:**
- All build/production hotkeys work as before
- Hotkey labels visible on PlaytestHud buttons
- Debug hotkeys (T, Q/E, Z/X) still work
- ESC still toggles pause menu

**What not to touch:** Game loop, state logic, renderer code, asset files.

---

### TERRAIN-01 — Sand terrain visual system

**Problem statement:** The map looks like a chessboard — identical diamond tiles in a grid pattern. No natural variation, no visual patches, no decals, no edge blending. The isometric grid lines (drawn in GameScene) reinforce the chessboard feel.

**Current code support:**
- TerrainRenderer stamps tiles on a RenderTexture once. Very efficient.
- Three terrain tile types: sand, sand-dark, sand-light. Minimal visual variation.
- Grid lines are drawn in `GameScene.drawGridLines()` with 0.5px alpha 0.2 lines — barely visible but contributing to the grid feel.
- Map data: 48×48 terrain grid with deterministic generation.
- `TERRAIN_STAMP_CONFIG` scales source tiles (1180×741) to 76×38 isometric cells.

**Current blockers:** None. Terrain is purely visual and does not affect pathfinding.

**Recommended scope:**

1. **Asset work**: If approved terrain/decal PNG assets already exist, integrate them. If they do not exist, create asset requirements and a placeholder integration plan, then stop or request assets as a separate task. Do not generate final production PNG assets as part of TERRAIN-01. Placeholder assets are allowed only if explicitly marked dev-only and approved by Denis. Asset generation/art production should be a separate asset task, not hidden inside terrain code implementation.
2. **Generator work**: Update map generator to assign patch variants in clusters (Perlin/simplex noise or region-based selection) instead of alternating tile types. This can proceed regardless of asset availability — the generator logic is independent.
3. **Renderer work**: Minimal. TerrainRenderer already stamps arbitrary tiles — just pass the new patch variant key instead of the current 3-type key.
4. **Decals**: Same asset constraint as above — if decal sprites exist, integrate them; if not, create requirements and stop. Do not create low-quality final decal PNGs.
5. **Grid lines**: Make grid lines optional or remove them. They reinforce the chessboard feel.
6. **Do NOT replace the RenderTexture approach** — it is efficient and supports the target.
7. **Do NOT implement TilemapGPULayer** — rejected by PHASER4-GPU-01.

**Risk:** Medium-high. Main risk is scope: if "terrain patching" expands into "full terrain system rewrite with edge blending and zone transitions", it becomes a multi-PR effort. Secondary risk: if production terrain/decal assets do not exist, the generator and renderer changes must be implemented with clear placeholder support so that asset swap-in is trivial when assets arrive.

**Can go directly to implementation after audit:** Yes, with constraint: the scope must stay within "add patch variation and decals to existing RenderTexture pipeline". If the implementation requires renderer changes beyond stamping different tile keys, stop and create a design doc. If production terrain/decal assets do not exist, the implementation must stop at generator + renderer integration with placeholder support, and request assets as a separate task.

**Likely touched files:** TerrainRenderer.ts (minimal — accept variant keys), map generator (add cluster-based patch assignment), new decal assets, GameScene.ts (remove or toggle grid lines).

**Validation strategy:** npm test, typecheck, build, qa:smoke. Manual QA: terrain looks natural, no chessboard pattern, decals visible.

**Manual QA:**
- Terrain reads as natural desert surface, not grid (if production assets available; otherwise placeholder variation is visible)
- No visible tile repetition pattern (generator clusters work correctly)
- Decals visible on zoom (if production assets available; otherwise decal slots are ready)
- Grid lines removed or very subtle
- Pathfinding still works correctly
- Performance unchanged (RenderTexture still cached)

**What not to touch:** Pathfinding, occupancy map, game state, unit movement, renderer architecture.

---

### BASE-ANCHOR-01 — HQ/building grounding and footprint alignment

**Problem statement:** Buildings may appear visually offset above their footprints. The base "floats" above the red footprint cells. This is a visual anchor/origin issue in building placement metadata.

**Current code support:**
- `generatedBuildingMeta.ts` (470 LOC): Per-building PNG placement metadata.
- `buildingPlacementMeta.ts` (418 LOC): Origin/scale/anchor data.
- ConstructionRenderer uses metadata for building placement via `getBuildingPlacementData()`.
- HQ has 3×3 footprint. Buildings have 2×2 footprint. Footprint is used for passability/occupancy but visual placement may not align.

**Current blockers:** None. Visual-only fix.

**Recommended scope:**

1. Audit all faction HQ building placement metadata for anchor/origin alignment.
2. Fix HQ anchor so bottom edge aligns with footprint bottom row.
3. Verify other buildings (separator, power-plant, units-factory) are correctly anchored.
4. Add manual QA for all four factions (HQ sizes may differ per faction).
5. Do NOT globally shift all assets blindly — fix per-building after confirming root cause.

**Risk:** Low-medium. Visual-only changes with metadata adjustments. Risk of breaking one faction's HQ while fixing another.

**Can go directly to implementation after audit:** Yes.

**Likely touched files:** buildingPlacementMeta.ts, generatedBuildingMeta.ts, possibly ConstructionRenderer.ts (if anchor computation needs adjustment).

**Validation strategy:** typecheck, build, qa:smoke. Manual QA: all faction HQs visually grounded.

**Manual QA:**
- All 4 faction HQs — bottom edge aligns with footprint
- Separator, power-plant, units-factory — correctly anchored
- Construction sites — progress bar appears at correct position
- No visual regression for any faction

**What not to touch:** Footprint logic, pathfinding, game state, occupancy map.

---

### ASSET-WORKFLOW-01 — Animated unit asset pipeline

**Problem statement:** No defined pipeline for generating and integrating animated spritesheets. Current sprites were generated ad-hoc. If unit regeneration proceeds without a defined workflow, anchors, scales, directions, and naming will be inconsistent across unit types, requiring repeated rework.

**Current code support:**
- Harvester spritesheets: 2048×2048, 8×8 grid, 256px frames. 8 directions, columns 0=idle, 1-7=walk cycle. Pattern confirmed by PHASER4-ANIM-01 spike.
- Animation key pattern: `{unitType}_{faction}_{state}_{direction}`. 64 keys registered for harvesters.
- `generatedAssetManifest.ts`: Auto-generated, lists all asset keys with paths and load types.
- No formal naming convention doc, no anchor/grounding rules doc, no validation preview tool.

**Current blockers:** None for design. Implementation depends on this being accepted first.

**Recommended scope:**

1. **Define spritesheet layout standard**:
   - 8-direction × 8-column grid (same as current).
   - Direction rows: E=0, SE=1, S=2, SW=3, W=4, NW=5, N=6, NE=7.
   - Column 0 = idle, columns 1–7 = animation frames.
   - Frame size: 256×256 px (current standard).
   - Sheet size: 2048×2048 px (current standard).
2. **Define animation states per unit type**:
   - Harvester: idle, move, gather, unload (4 states). Gather/unload share idle visual until art provides frames.
   - Builder: idle, move, build (3 states). Build shares idle visual until art provides frames.
   - Combat units (later): idle, move, aim, recoil, fire (5+ states).
3. **Define naming convention**:
   - File: `public/assets/factions/{faction}/units/{unitType}.png`
   - Asset key: `{unitType}_{faction}` (e.g., `harvester_cyan`, `builder_green`)
   - Animation key: `{unitType}_{faction}_{state}_{direction}` (e.g., `harvester_cyan_move_s`)
4. **Define anchor/grounding rule**:
   - Origin: (0.5, 0.75) — bottom-center of frame, consistent with current harvester.
   - This places the "feet" of the unit at the tile ground position.
   - All unit types must use the same origin for consistent grounding.
5. **Define scale rules**:
   - Scale derived from `unitRenderConfig.ts` constants (HARVESTER_RENDER_SCALE, BUILDER_RENDER_SCALE).
   - Document the intended visual size relative to isometric tile (unit should fit within one tile width).
6. **Define per-faction variant rules**:
   - Each faction has its own spritesheet with faction-specific colors.
   - Same layout, same frame count, same origin/scale.
7. **Define Phaser Animation Manager integration rules**:
   - Registration: `scene.anims.create()` with `generateFrameNumbers()` per direction row.
   - Playback: `sprite.anims.play(key, ignoreIfPlaying)`.
   - Direction resolution: `directionFromDelta()` → `DIR_LABELS[]` → animation key suffix.
8. **Define validation/preview tooling**:
   - Create a simple HTML preview page that loads a spritesheet and displays all 8 directions × all states.
   - Verify anchor, scale, direction correctness before runtime integration.
9. **Define how generated art enters assets/ and manifests**:
   - New spritesheet PNG → `public/assets/factions/{faction}/units/`
   - Update `generatedAssetManifest.ts` (may need re-generation if manifest is truly auto-generated).
   - Update `unitRenderConfig.ts` if frame counts or animation speeds change.

**Risk:** High — but this is a design task, not implementation. The risk is in making wrong conventions that affect all future work. The audit mitigates this by specifying conventions that match the existing working pattern.

**Can go directly to implementation after audit:** No — this task IS the design. Its output (the workflow document) must be accepted before UNIT-ANIM-01 and UNIT-ANIM-02 can proceed.

**Likely touched files:** New `docs/project/ASSET_WORKFLOW_01_DESIGN.md`, possibly `unitRenderConfig.ts` (document constants).

**Validation strategy:** Design review by Denis. No runtime validation.

**Manual QA:** Review document for completeness and consistency with existing working patterns.

**What not to touch:** Runtime code, spritesheets, asset manifest (until workflow is accepted).

---

### UNIT-ANIM-01 — Regenerate harvester animated spritesheet

**Problem statement:** Current harvester spritesheet has walk cycle frames (columns 1–7) that are only visible via Animation Manager. The visual quality of the walk cycle has not been validated — frames may not look natural at 8fps. Gathering and unloading animations do not exist (idle frame is used).

**Current code support:**
- Animation Manager fully integrated for harvesters (PHASER4-ANIM-02).
- Walk cycle at 8fps, loop. Direction-based keys per faction.
- Current spritesheets work but may need visual polish.

**Current blockers:** Depends on ASSET-WORKFLOW-01 being accepted. Cannot regenerate sprites without defined anchor/scale/naming rules.

**Recommended scope:**

1. Generate new harvester spritesheets following ASSET-WORKFLOW-01 conventions.
2. Add gather animation frames (if art provides them) in additional columns or rows beyond current 8×8 layout.
3. Add unload animation frames (if art provides them).
4. Add optional "loaded/cargo" visual state (harvester carrying raw minerals).
5. Integrate new spritesheets into asset pipeline (manifest + PreloadScene).
6. Verify all 4 factions have correct variants.
7. Do NOT change gameplay behavior — visual improvement only.

**Risk:** High. Asset generation + runtime integration in one PR is risky. Mitigate by staging: asset generation PR first (replace PNG files only), then runtime integration PR if needed.

**Can go directly to implementation after audit:** Yes, after ASSET-WORKFLOW-01 acceptance.

**Likely touched files:** Harvester spritesheet PNGs (4 factions), generatedAssetManifest.ts, EntityRenderer.ts (if frame counts change), unitRenderConfig.ts (if animation speeds change).

**Validation strategy:** npm test, typecheck, build, qa:smoke. Manual QA: all 4 faction harvesters animate correctly.

**Manual QA:**
- Harvester walk cycle looks natural at 8fps
- Direction changes smooth (no frame skip)
- Gather animation plays (if added)
- Unload animation plays (if added)
- Cargo visual state visible (if added)
- All 4 factions correct colors
- No anchor/scale regression

**What not to touch:** Gameplay logic, pathfinding, economy, builder rendering.

---

### UNIT-ANIM-02 — Regenerate builder animated spritesheet

**Problem statement:** Builder uses `setFrame()` with manual direction indexing — no Animation Manager. Walk cycle frames exist but are unused. Builder should follow the same Animation Manager pattern as harvester.

**Current code support:**
- ConstructionRenderer handles builder rendering with `setFrame()`.
- PHASER4-ANIM-01 spike confirmed Animation Manager works for builder.
- Same spritesheet layout as harvester (8×8 grid, 256px frames).

**Current blockers:** Depends on ASSET-WORKFLOW-01. Should follow UNIT-ANIM-01 (establish pattern with harvester first).

**Recommended scope:**

1. Migrate builder rendering from `setFrame()` to Animation Manager (same pattern as harvester).
2. Generate new builder spritesheets following ASSET-WORKFLOW-01 conventions.
3. Add build/work animation frames (if art provides them).
4. Integrate into ConstructionRenderer.
5. Do NOT change construction logic — visual improvement only.

**Risk:** High. Same staging concern as UNIT-ANIM-01. Builder migration is lower risk than harvester because the pattern is already proven.

**Can go directly to implementation after audit:** Yes, after ASSET-WORKFLOW-01 and preferably after UNIT-ANIM-01.

**Likely touched files:** Builder spritesheet PNGs (4 factions), ConstructionRenderer.ts (migrate to Animation Manager), EntityRenderer.ts (if shared helpers needed), unitRenderConfig.ts.

**Validation strategy:** npm test, typecheck, build, qa:smoke. Manual QA: builder animates in all states.

**Manual QA:**
- Builder walk cycle animated (not static facing)
- Builder building animation plays (if added)
- Direction changes smooth
- All 4 factions correct
- Construction progress still works
- Builder grounding maintained

**What not to touch:** Construction logic, pathfinding, economy, harvester rendering.

---

### RESOURCE-01 — Resource node polish + depleted occupancy

**Problem statement:** Resource nodes appear as isolated crystal icons on the map — not as resource "fields". Depleted resources leave behind blocked/occupied tiles (ghost occupancy). Harvesters may try to target depleted resources.

**Current code support:**
- `ResourceNodeState` has `depleted: boolean` and `remainingRaw: number`.
- `findNearestAvailableResource()` already skips depleted resources.
- EntityRenderer shows resources as sprites. Depleted resources are visually still present (sprite shown) but may confuse players.
- Occupancy map marks resource tiles as `impassable` even when depleted. This is the ghost occupancy bug.

**Current blockers:** None. Can be implemented independently.

**Recommended scope:**

1. **Fix ghost occupancy**: When a resource depletes (`depleted === true`), remove it from the occupancy map's impassable set. This requires checking depletion in `buildOccupancyMap()`.
2. **Visual depletion**: Show depleted resources as faded/transparent sprites or remove them entirely.
3. **Resource field grouping**: Group nearby resources into named "fields" for HUD display (e.g., "Crystal Field NE").
4. **Shimmer/glow VFX**: Add subtle visual effect to non-depleted resources (Phaser Tweens for pulse/glow). Low priority.
5. **Do NOT change resource amounts** without a balance decision.

**Risk:** Medium. Ghost occupancy fix is straightforward but must be tested carefully to ensure harvesters can walk through depleted resource tiles while still respecting active resource tiles.

**Can go directly to implementation after audit:** Yes.

**Likely touched files:** occupancy.ts (skip depleted resources in impassable marking), EntityRenderer.ts (depleted visual state), updateGameState.ts (verify harvester retargeting after depletion), statusHelpers.ts.

**Validation strategy:** npm test, typecheck, build, qa:smoke. Manual QA: depleted resources no longer block movement.

**Manual QA:**
- Depleted resource disappears or fades
- Harvesters walk through depleted resource tiles
- Harvesters retarget to nearest non-depleted resource
- No ghost-occupied tiles on occupancy map debug overlay
- Resource field names visible in HUD (if grouping added)

**What not to touch:** Resource amounts, economy balance, terrain, pathfinding algorithm.

---

### MAPLIFE-01 — Environment props / doodads / decals

**Problem statement:** The map feels empty and authored — no non-harvestable environment details. No rocks, bushes, wrecks, or visual texture.

**Current code support:**
- `DecorPlacement` type exists in types.ts with `DecorType = 'bush' | 'sand-bump'`.
- Map data includes `decor: DecorPlacement[]` array.
- Current map generator does not place any decor.
- `ObstaclePlacement` type exists for blocking objects (mountains, volcanoes, rocks).

**Current blockers:** None. Decors are purely visual, non-blocking.

**Recommended scope:**

1. **Define prop/doodad types**: Rocks (small, medium), bushes, dry plants, tire marks, scorch marks, machinery wrecks. Each type: sprite asset, is-blocking flag, footprint size.
2. **Create prop assets**: Simple PNG sprites for each type.
3. **Add props to map generator**: Place props deterministically based on seed. Separate blocking props (affect pathfinding) from non-blocking props (visual only).
4. **Render props**: Add to TerrainRenderer stamp pass (static, stamped once) or separate PropRenderer.
5. **Occupancy**: Blocking props add `impassable` to occupancy map. Non-blocking props do not.
6. **No starting-area blockage**: Ensure props do not block HQ or initial resource paths.

**Risk:** Medium-high. Blocking props could accidentally block paths or starting areas. Generator must validate placement.

**Can go directly to implementation after audit:** Yes, with constraint: blocking prop placement must be validated against pathfinding.

**Likely touched files:** New prop assets, map generator, occupancy.ts (blocking props), TerrainRenderer or new PropRenderer, types.ts (add prop types).

**Validation strategy:** npm test, typecheck, build, qa:smoke. Manual QA: map feels alive, no path blockage.

**Manual QA:**
- Props visible on map
- Blocking props affect pathfinding
- Non-blocking props do not affect pathfinding
- Starting area clear of blocking props
- Props support desert/sci-fi RTS identity
- No visual overlap with resources or buildings

**What not to touch:** Economy, unit behavior, existing building types, resource amounts.

---

### FOG-01 — Two-layer fog of war

**Problem statement:** No visibility/exploration system. The entire map is always visible. RTS games need fog to create exploration and information asymmetry.

**Current code support:**
- No visibility or exploration state exists in GameState.
- The entire terrain RenderTexture is always visible.
- No minimap exists.
- Devtools mode currently shows the full map — would need fog bypass.

**Current blockers:** Should wait until terrain/render baseline is stable (after TERRAIN-01). Fog interacts with terrain rendering, entity visibility, and performance.

**Recommended scope:**

1. **Design phase**: Define fog model (black unexplored / grey explored / visible). Define visibility radius per unit type. Define state storage (per-tile explored flag in GameState). Define render strategy (alpha overlay on RenderTexture, or separate fog RenderTexture).
2. **Implementation phase**: Add explored state to GameState. Add visibility computation per frame. Render fog overlay. Add devtools bypass toggle.
3. **Staged PRs**: Separate design doc PR, then implementation PR. Do NOT combine into one large PR.

**Risk:** High. Touches rendering, game state, performance, devtools, and future minimap. Must be carefully staged.

**Can go directly to implementation after audit:** No — requires dedicated mini-design. The audit provides direction but not sufficient implementation detail for a high-risk system.

**Likely touched files:** types.ts (add exploration state), new fog renderer, GameScene.ts, EntityRenderer.ts (hide non-visible entities), devCommands.ts (fog bypass), TerrainRenderer.ts (fog overlay integration).

**Validation strategy:** npm test, typecheck, build, qa:smoke. Manual QA: fog behavior correct, devtools bypass works.

**Manual QA:**
- Unexplored areas appear black
- Explored areas appear grey when not visible
- Visible areas show full detail
- Units reveal area around them
- Fog does not affect performance significantly
- Devtools toggle removes fog

**What not to touch:** Pathfinding, economy, unit behavior, asset pipeline.

---

### ARENA-01 — Arena mode from menu

**Problem statement:** Arena is accessible only via URL parameter. It should be a first-class mode selectable from the menu, with its own map, combat sandbox label, and proper asset loading.

**Current code support:**
- Arena already works via `?devtools=1&arena=1`.
- `createArenaMapData()` creates a 20×20 arena map.
- `ARENA_MAP_ID` constant exists.
- ModularTankRenderer exists for modular combat unit rendering.
- DevtoolsPanel provides arena reset and spawn controls.

**Current blockers:** Depends on MENU-01 (mode selection) and MENU-02 (conditional loading for arena assets from menu).

**Recommended scope:**

1. Add Arena mode selection to NewGameSetupScene (as part of MENU-01).
2. Arena mode sets `isDevtoolsEnabled()=true` and `isArenaEnabled()=true` from config (not URL).
3. Arena shows a "Combat Sandbox" label and disclaimer.
4. Arena preserves URL shortcut `?devtools=1&arena=1` as dev override.
5. Do NOT add full combat system to main sandbox in this PR.

**Risk:** Medium. Mode wiring must correctly set all flags that currently depend on URL params.

**Can go directly to implementation after audit:** Yes, after MENU-01 and MENU-02.

**Likely touched files:** NewGameSetupScene.ts (add Arena mode button), GameScene.ts (set arena flags from config), devArena.ts (extend to check config-based mode).

**Validation strategy:** npm test, typecheck, build, qa:smoke. Manual QA: Arena works from menu.

**Manual QA:**
- Arena selectable from menu
- Arena map loads correctly (20×20)
- Modular combat units render
- Devtools panel visible
- Arena reset works
- `?devtools=1&arena=1` still works

**What not to touch:** Main sandbox economy, civil unit behavior, combat implementation.

---

### WEAPON-WORKFLOW-01 — Weapon VFX and recoil design

**Problem statement:** No visual model for weapon firing, recoil, projectiles, or smoke. Before combat is implemented, the visual language for weapons must be designed.

**Current code support:**
- ModularTankRenderer renders hull + turret as separate sprites.
- Phaser Tweens can animate recoil (offset turret, then return).
- Phaser Particles can create muzzle flash, smoke, sparks.
- No weapon state or weapon type system exists.

**Current blockers:** None for design. Implementation depends on combat system.

**Recommended scope:**

1. **Design document only** — no implementation in this task.
2. Define visual recoil model per weapon type:
   - Smoky: small recoil, fast firing rhythm, muzzle flash + smoke.
   - Railgun: strong recoil (Wasp chassis rocks backward/upward), bright beam/trail.
3. Define Phaser 4 implementation approach:
   - Recoil: Tween on turret offset, then return.
   - Projectiles: Moving sprite with trail (or beam line for railgun).
   - Muzzle flash: One-shot particle emitter.
   - Smoke: Particle emitter with gravity/fade.
4. Define visual-only vs gameplay state separation:
   - Recoil is visual only — does not change unit position in game state.
   - Projectile visual is tied to combat state but rendered separately.
5. Define arena test harness for validation.

**Risk:** High (design risk — wrong assumptions propagate to combat). But this is a design-only task, so implementation risk is zero.

**Can go directly to implementation after audit:** No — this is a design document. Must be accepted before any combat visual implementation.

**Likely touched files:** New `docs/project/WEAPON_WORKFLOW_01_DESIGN.md`.

**Validation strategy:** Design review only. No runtime validation.

**Manual QA:** Review document for completeness and feasibility.

**What not to touch:** Runtime code, assets, game state.

---

### VISUAL-SPIKE-01 — Normal maps / lighting feasibility

**Problem statement:** Unclear whether normal maps / lighting would improve the 2D isometric visual quality enough to justify the complexity.

**Current code support:**
- Phaser 4.1.0 supports custom shaders and post-processing pipelines.
- No normal map assets exist. Asset pipeline does not generate `*_normal.png`.
- Isometric depth sorting uses painter's algorithm — lighting must respect depth order.

**Current blockers:** None for spike. Implementation decision depends on spike results.

**Recommended scope:**

1. **Spike only** — no production implementation.
2. Create a minimal normal map for one terrain tile and one unit sprite.
3. Test with Phaser 4 custom shader pipeline.
4. Verify isometric depth sorting compatibility.
5. Evaluate visual improvement vs complexity.
6. **Recommended outcome**: Likely "not worth it now" — baked lighting/shadows in PNG assets are simpler and sufficient for the current visual target. Revisit if the project moves toward dynamic lighting requirements.

**Risk:** Low (spike only). The most likely outcome is "do not implement now", which is low-risk.

**Can go directly to implementation after audit:** No — this is a spike. The spike must be completed and accepted before any implementation decision.

**Likely touched files:** Spike report only (`docs/project/VISUAL_SPIKE_01_REPORT.md`).

**Validation strategy:** Spike report review. No runtime validation.

**Manual QA:** Review spike findings.

**What not to touch:** Production runtime code, production assets, game state.

---

## 6. High+ task authorization matrix

| Task ID | Risk | Covered by this audit for direct implementation? | Constraints / additional design needed | Stop conditions |
|---------|------|--------------------------------------------------|----------------------------------------|----------------|
| MENU-01 | medium | **Yes** | Controlled URL launch model: Debug/Arena from menu reloads page with `?devtools=1` / `?devtools=1&arena=1`. Must preserve URL shortcuts for qa:smoke. No late-loading. No PreloadScene changes. | If mode selection requires PreloadScene changes or late-loading, stop and create design doc |
| MENU-02 | medium-high | **Yes** | Must audit all `isDevtoolsEnabled()` call sites; must test late-loading | If late-loading fails for modularUnits, stop and report |
| LOADING-01 | medium | **Yes** | Use Phaser Loader events only; no fake progress | If loading screen interferes with qa:smoke, stop |
| TERRAIN-01 | medium-high | **Yes** | Scope limited to: patch assets + generator cluster logic + decals on existing RenderTexture. No renderer rewrite. Do not generate final production PNG assets — if assets do not exist, create requirements and stop or request separate asset task. | If implementation requires RenderTexture replacement or TilemapGPULayer, stop and create design doc |
| BASE-ANCHOR-01 | low-medium | **Yes** | Fix per-building after confirming root cause. No global shift. | If anchor fix breaks another faction's HQ, revert and create design doc |
| ASSET-WORKFLOW-01 | high | **No** (this IS the design task) | Must produce accepted design doc before UNIT-ANIM-01/02 | — |
| UNIT-ANIM-01 | high | **Yes** (after ASSET-WORKFLOW-01) | Must follow ASSET-WORKFLOW-01 conventions exactly. Stage: asset generation PR first, then integration PR | If new spritesheet layout differs from workflow spec, stop |
| UNIT-ANIM-02 | high | **Yes** (after ASSET-WORKFLOW-01 + UNIT-ANIM-01) | Must follow same pattern as harvester migration | If builder Animation Manager migration causes regressions, revert to setFrame() and report |
| HOTKEYS-01 | medium-high | **No** — audit/design part must be accepted first | Design doc must specify exact registry structure and command list | — |
| FOG-01 | high | **No** — requires dedicated mini-design | Audit provides direction; implementation design is separate | — |
| MAPLIFE-01 | medium-high | **Yes** | Blocking prop placement must be validated against pathfinding | If props block starting area or resource paths, stop and fix generator |
| WEAPON-WORKFLOW-01 | high | **No** (design document only) | Must produce accepted design doc before combat visual work | — |
| VISUAL-SPIKE-01 | high | **No** (spike only) | Must produce spike report before implementation decision | — |

---

## 7. Main menu and mode selection design

### Current MainMenuScene/NewGameSetupScene flow

**MainMenuScene** (632 LOC):
- DOM overlay with: New Game, Continue (if saves exist), Settings buttons.
- `?skipMenu` auto-advances to GameScene with default config.
- Continue shows save list overlay with per-slot load and delete.
- Settings has UI Scale (100/125/150%).

**NewGameSetupScene** (471 LOC):
- DOM overlay with: faction (4 buttons), map mode (fixed/generated), map size (small/standard/large), seed input, Random button.
- Start Game → `scene.start('GameScene', config)`.
- Esc → back to MainMenuScene.

### Current URL shortcuts

- `?skipMenu` — auto-start game with default config (for QA).
- `?devtools=1` — enable devtools panel, load modularUnits.
- `?arena=1` — arena mode (requires `?devtools=1`).
- `?autostart` — alias for `?skipMenu`.

### Recommended MENU-01 implementation model

**Model: Controlled URL launch via NewGameSetupScene**

Add a "Game Mode" section to NewGameSetupScene with three buttons: Standard, Debug, Arena. Default: Standard.

```text
New Game Setup
─────────────
Faction:   [Cyan] [Green] [Yellow] [Purple]
Game Mode: [Standard] [Debug] [Arena]
Map:       [Fixed] [Generated]
Seed:      [______] [Random]
           [Back]  [Start Game]
```

When Arena is selected:
- Map section hides (arena uses fixed 20×20 map).
- Seed section hides.
- A brief note: "Arena is a combat sandbox test mode."

When Debug is selected:
- Map/seed sections remain (debug can use any map).
- A brief note: "Debug mode enables developer tools and combat units."

When Standard is selected:
- All sections visible as current.

**Controlled URL launch model**:

When the user clicks "Start Game":
- **Standard** → `scene.start('GameScene', config)` as normal (no URL change).
- **Debug** → Navigate/reload to current page with `?devtools=1` appended. This causes PreloadScene to load modularUnits because `isDevtoolsEnabled()` returns true. Other params (faction, map, seed) can be passed via `sessionStorage` or URL search params on reload.
- **Arena** → Navigate/reload to current page with `?devtools=1&arena=1` appended. This causes PreloadScene to load modularUnits and GameScene to create the arena map.

**Why controlled reload**: PreloadScene runs before MainMenuScene. ModularUnits are only loaded when `isDevtoolsEnabled()` returns true (from URL params). The controlled reload ensures PreloadScene runs again with the correct URL params, loading all required assets. This is the same mechanism that QA smoke tests already use (`?skipMenu&devtools=1&arena=1`), just automated from the menu button.

**Why not late-loading in MENU-01**: Late-loading (loading assets after PreloadScene) requires careful handling of `isDevtoolsEnabled()` call sites, loading indicators, and asset availability checks. This is MENU-02's scope. MENU-01 keeps it simple: the menu button triggers a controlled page reload with the same URL params that already work.

**Mode is stored in GameSetupConfig**:
```typescript
interface GameSetupConfig {
  faction: Faction;
  mapId: string;
  mapMode: MapMode;
  mapSize: MapSizeOption;
  seed: string;
  gameMode: 'standard' | 'debug' | 'arena';  // NEW
}
```

**URL shortcuts remain as overrides**:
- `?skipMenu` → Standard mode (current behavior).
- `?skipMenu&devtools=1` → Debug mode.
- `?skipMenu&devtools=1&arena=1` → Arena mode.

These bypass the menu and set mode directly, preserving qa:smoke compatibility.

### Recommended MENU-02 implementation model

**Mode-aware late-loading flow** (replaces MENU-01's controlled reload):

MENU-01 uses controlled page reload as a simple launch path. MENU-02 replaces this with seamless mode-aware late-loading that avoids the page reload entirely.

```text
PreloadScene (always loads base 42 assets)
  → MainMenuScene (mode not yet known)
    → NewGameSetupScene (user selects mode)
      → GameScene.create() checks gameMode from config
        If debug/arena AND modularUnits not loaded:
          Late-load modularUnits via this.load.start()
          Show loading indicator
          On complete: proceed with game setup
        Else:
          Proceed normally
```

**Why late-loading is safe**: PHASER4-LOAD-01 spike confirmed Phaser 4.1.0 supports late-loading. EntityRenderer already uses `textures.exists()` fallback. ModularTankRenderer only renders modular-combat entities when they exist in state.

**MENU-02 replaces controlled reload**: After MENU-02, Debug/Arena can be selected from the menu without a page reload. The controlled reload from MENU-01 becomes a fallback or is removed.

**Preserving smoke tests**: `?skipMenu&devtools=1&arena=1` still triggers PreloadScene conditional loading (isDevtoolsEnabled() returns true from URL). No smoke test changes needed.

---

## 8. Loading screen design

### Current BootScene/PreloadScene

- **BootScene** (20 LOC): Minimal init, starts PreloadScene immediately.
- **PreloadScene** (55 LOC): Loads all assets, logs progress at 25% milestones. No visual UI.

### Phaser Loader events available

| Event | Signature | Use case |
|-------|-----------|----------|
| `progress` | `(value: number) => void` | value 0..1 — overall progress |
| `fileprogress` | `(file, progressDelta) => void` | Per-file progress |
| `loaderror` | `(file) => void` | Asset load failure |
| `complete` | `() => void` | All queued files loaded |

### Recommended LOADING-01 implementation

1. **Add progress bar to PreloadScene**: Use Phaser Graphics to draw a simple horizontal progress bar at screen center.
2. **Progress display**: Bar fills left-to-right based on `progress` event value. Show percentage text.
3. **Labels**: "Loading..." text. After complete, briefly show "Starting..." before scene transition.
4. **No fake progress**: Use Phaser Loader's actual progress value. If loading is fast (<1s), the bar appears briefly — this is acceptable.
5. **Mode/map/faction labels**: Not available in PreloadScene (selection happens later). Can show "Loading assets..." only.
6. **For late-loading (MENU-02)**: GameScene can show a similar progress overlay during modularUnits late-load.

**Style**: Dark background (#1a1a2e), blue accent (#4fc3f7), consistent with MainMenuScene.

**qa:smoke compatibility**: Progress bar is visual only. `?skipMenu` auto-starts game; the loading screen appears briefly and does not block the auto-start flow. qa:smoke asserts DOM elements after GameScene is ready, which happens after loading completes.

---

## 9. Hotkeys and command card design

### Current GameInputController hotkeys

| Key | Action | Category |
|-----|--------|----------|
| B | Build separator | build |
| F | Build units-factory | build |
| P | Build power-plant | build |
| N | Queue builder | produce |
| G | Queue harvester | produce |
| R | Reset camera | camera |
| Esc | Toggle pause menu | system |
| T | Toggle debug overlay | debug |
| Q/E | Body direction (debug) | debug |
| Z/X | Turret direction (debug) | debug |
| H/J | Layer select (debug) | debug |
| C | Print offsets (debug) | debug |
| F10 / ` | Toggle devtools | debug |
| Click | Select/move unit | input |

### Recommended HOTKEYS-01 scope

**Phase 1: Command registry (data structure only)**

```typescript
interface CommandDef {
  id: string;              // 'build-separator'
  label: string;           // 'Build Separator'
  hotkey: string;          // 'B'
  hotkeyLabel: string;     // '[B]'
  category: 'build' | 'produce' | 'camera' | 'system' | 'debug';
  action: (state: GameState) => BuildRequestResult | ProductionRequestResult | void;
  condition?: (state: GameState) => boolean;  // disabled when false
  disabledReason?: (state: GameState) => string | null;
}
```

**Phase 2: Registry-based dispatch**

Replace inline `kb.on('keydown-B', ...)` with:
```typescript
for (const cmd of commandRegistry) {
  kb.on(`keydown-${cmd.hotkey}`, () => {
    if (cmd.condition && !cmd.condition(getGameState())) return;
    cmd.action(getGameState());
  });
}
```

**Phase 3: Hotkey labels on HUD**

Add `[B]`, `[F]`, `[P]`, `[N]`, `[G]` labels to PlaytestHud build/production buttons.

**Do NOT build**: Full command card grid UI, context-sensitive command panels, multi-select commands, attack-move. These require combat.

---

## 10. Terrain and map visual system audit

### Current terrain renderer

TerrainRenderer creates a RenderTexture and stamps each terrain tile once. Three tile types (sand, sand-dark, sand-light) are placed in a deterministic pattern on the 48×48 grid. The result is a static cached image that the camera scrolls over.

### Why map looks like a chessboard

1. **Identical tiles**: Only 3 tile variants, each stamped hundreds of times. No per-tile variation.
2. **Grid pattern**: The deterministic generator alternates tile types in a regular pattern, creating visible rows/columns.
3. **Grid lines**: `GameScene.drawGridLines()` draws 0.5px alpha 0.2 diamond outlines on every tile, reinforcing the grid.
4. **No blending**: No edge transitions between tile types. Hard boundaries between sand and sand-dark.

### Terrain patching options

**Option A: More tile variants with cluster-based placement** (Recommended)

1. Generate 5–8 terrain patch variants (sand-a through sand-h) with subtle color/texture variation.
2. Use Perlin/simplex noise to assign variants in large clusters (10–20 tile diameter).
3. This creates natural-looking terrain regions instead of a checkerboard.
4. No renderer changes — just different asset keys passed to `stamp()`.

**Option B: Decal overlay**

1. After stamping base terrain tiles, stamp 10–20 decal sprites on top.
2. Decals: cracks, bumps, stones, tire marks, dry patterns, small rocks.
3. Decals are purely visual, do not affect pathfinding.
4. Can be placed randomly or based on noise function.

**Option C: Edge blending**

1. Create transition tiles for each pair of adjacent terrain types.
2. Much more complex — requires many new assets and renderer logic.
3. Not recommended for MVP. Can be added later.

**Recommended combination**: Option A + Option B. Cluster-based tile variation + decal overlay. No edge blending for now.

### Resource field integration

- Resource nodes should visually blend into the terrain, not appear as isolated icons.
- Consider a "resource field base" decal under each resource cluster (e.g., a discolored terrain patch).
- Resource depletion should show visual transition (fading, color change).

### Implications for pathfinding/passability

- Decals do NOT affect pathfinding. They are visual only.
- Blocking props (MAPLIFE-01) DO affect pathfinding and must be in the occupancy map.
- Terrain variation does not change the passability model — all sand tiles remain passable.

### Implications for RenderTexture caching

- Current approach stamps everything once. Decals and props can be stamped on the same RenderTexture.
- No per-frame terrain redraw. Performance is maintained.
- If fog of war is added later, a separate fog overlay (not re-stamping terrain) is the correct approach.

---

## 11. Building grounding / HQ anchor audit

### Current HQ/building placement

- HQ has 3×3 footprint. Buildings have 2×2 footprint.
- `buildingPlacementMeta.ts` provides per-building origin, scale, anchor data.
- `generatedBuildingMeta.ts` provides auto-generated placement metadata.
- ConstructionRenderer uses `getBuildingPlacementData()` to position building sprites.

### Footprint vs visual anchor

The footprint is the logical tile area (for pathfinding/occupancy). The visual anchor is where the sprite is drawn relative to the tile position. If the visual anchor's Y offset is too small, the building appears to "float" above its footprint.

### Recommended BASE-ANCHOR-01 implementation

1. Audit all 4 faction HQ placement data for Y offset.
2. Verify building sprite bottom edge aligns with footprint bottom row.
3. If offset is wrong, adjust in `buildingPlacementMeta.ts` — do not change footprint or occupancy.
4. Test all 4 factions — HQ art sizes may differ.

---

## 12. Animated asset workflow audit

*(Covered in detail in section 5, task ASSET-WORKFLOW-01. The key design decisions are: 8×8 spritesheet layout, 8-direction rows, column 0 = idle, columns 1–7 = animation frames, origin (0.5, 0.75), per-faction variants, naming convention `{unitType}_{faction}`, animation key `{unitType}_{faction}_{state}_{direction}`.)*

---

## 13. Harvester/builder regeneration audit

### Whether current units should be regenerated

**Yes.** Current harvester and builder spritesheets have walk cycle frames that are functional but may benefit from:
- Smoother walk animation (more frames or better frame pacing).
- Gather/unload animations for harvesters (currently idle visual).
- Build/work animation for builders (currently idle visual).
- Optional "cargo loaded" visual state for harvesters.

### How to integrate gather/unload/build animations

**Approach A: Extend current spritesheet** (Recommended for now)

Add gather and unload columns to the existing 8-direction rows. Each direction would have more columns:
- Column 0: idle
- Columns 1–7: walk cycle
- Columns 8–14: gather animation
- Columns 15–21: unload animation

This requires a wider spritesheet (8 rows × 22+ columns = 176+ frames at 256px each ≈ 45,056px wide). This exceeds the 2048×2048 standard.

**Approach B: Separate spritesheet per state**

Create separate spritesheets for each state:
- `harvester_cyan_walk.png` (8×8, current layout)
- `harvester_cyan_gather.png` (8×N, N = gather frame count)
- `harvester_cyan_unload.png` (8×N, N = unload frame count)

Animation Manager can reference different texture keys for different states. This is the more scalable approach.

**Recommended**: Start with Approach A if gather/unload frame counts are small (≤3 frames per direction). Move to Approach B when frame counts grow (combat units will need many more animation states).

### How to avoid gameplay changes

- Animation changes must NOT affect movement speed, pathfinding, or state machine transitions.
- Animation frame rate is visual-only — does not affect gameplay timing.
- Gather/unload durations remain controlled by `GATHER_DURATION_MS` and `UNLOAD_DURATION_MS` constants.

### How to stage asset generation vs runtime integration

1. **PR 1**: Asset generation only — replace PNG files. Verify spritesheet layout with preview tool.
2. **PR 2**: Runtime integration — update Animation Manager registration, add new animation states. Verify no gameplay regression.

---

## 14. Resource nodes audit

### Current resource entity/state model

- `ResourceNodeState`: id, tx, ty, resourceType, footprint, remainingRaw, depleted.
- `ResourcePlacement`: tx, ty, type (small/medium/large/infinite), footprint.
- Resources are placed by map generator. 48×48 map with deterministic seed.

### Visual resource placement

- EntityRenderer shows resources as Image sprites at tile position.
- Three size variants: small, medium, large, infinite.
- No visual grouping into "fields".

### Depleted resource behavior

- `depleted: boolean` flag set when `remainingRaw <= 0`.
- Infinite resources never deplete.
- EntityRenderer should show depletion visually (currently may not change appearance).

### Ghost occupancy risk

**Confirmed bug.** In `occupancy.ts`, resources are marked `impassable` regardless of depletion status:
```typescript
for (const r of state.mapData.resources) {
  markFootprint(flags, width, r.tx, r.ty, r.footprint, r.footprint,
    'impassable', 'unbuildable', 'resource');
}
```

This means depleted resources continue to block movement and construction. Fix: check `state.resourceNodes` for depletion and skip impassable marking for depleted resources.

---

## 15. Fog of war audit

### Current visibility/exploration state

None. No visibility or exploration system exists in GameState.

### Standard RTS model

- **Black**: Never explored. Player has no information.
- **Grey**: Previously explored but not currently visible. Player sees terrain but not units.
- **Visible**: Currently in vision range. Player sees everything.

### Render strategy

**Option A: Fog RenderTexture overlay** (Recommended)

1. Create a separate RenderTexture the same size as terrain.
2. Fill with black (alpha 1.0).
3. For visible tiles: clear to transparent (alpha 0.0).
4. For explored tiles: fill with semi-transparent grey (alpha 0.5).
5. Render fog overlay on top of terrain with high depth.
6. Update fog texture when vision changes (not every frame — throttle to ~2Hz).

**Option B: Per-entity visibility check**

1. Check each entity against visibility state before rendering.
2. Hide non-visible entities. Show explored-area entities as grey silhouettes.
3. Simpler but less visual impact.

**Recommended**: Option A for terrain fog, combined with per-entity visibility for unit/building hiding.

### Whether FOG-01 belongs early or later in Phase 2

**Later within Phase 2.** Fog depends on:
1. Terrain visual system being stable (after TERRAIN-01).
2. Entity rendering being stable (after UNIT-ANIM-01/02).
3. Performance budget being understood (fog overlay has render cost).

Recommend: FOG-01 in the second half of Phase 2, after terrain and animation work is complete.

---

## 16. Arena and combat sandbox audit

### Current arena/devtools mode

- Arena is accessed via `?devtools=1&arena=1`.
- 20×20 map with `createArenaMapData()`.
- ModularTankRenderer renders Wasp + Smoky combat units.
- DevtoolsPanel provides spawn controls and diagnostics.
- Arena reset restarts GameScene.

### How Arena should be selected from menu

Covered in MENU-01/MENU-02 design (section 7). Arena mode button in NewGameSetupScene.

### How arena should support weapon/chassis testing later

- Arena should be the controlled test environment for combat mechanics.
- WEAPON-WORKFLOW-01 defines visual recoil/projectile model.
- Arena allows spawning units, firing weapons, testing VFX without affecting main sandbox.
- Keep arena game state separate from sandbox state.

### What minimum arena UX is required now

1. Selectable from menu (MENU-01).
2. Correct asset loading (MENU-02).
3. Arena map loads and displays.
4. Modular combat units render and respond to direction controls.
5. Devtools panel available for diagnostics.
6. No combat implementation yet — that is a later phase.

---

## 17. Weapon VFX / recoil design audit

### How to model visual recoil with Phaser Tweens

```typescript
// Simplified recoil example
this.tweens.add({
  targets: turretSprite,
  x: turretSprite.x - recoilOffsetX,
  y: turretSprite.y - recoilOffsetY,
  duration: 50,   // quick push back
  yoyo: true,     // return to original position
  ease: 'Quad.easeOut',
});
```

### How to model projectiles/beams/smoke with Phaser tools

- **Projectiles**: Moving sprite with `this.tweens.add()` for trajectory. Trail effect via particle emitter following the projectile.
- **Beams** (railgun): Line drawn from muzzle to target, fade out over 200ms.
- **Smoke**: Particle emitter with `{ lifespan: 500, gravityY: -20, alpha: { start: 0.6, end: 0 } }`.
- **Muzzle flash**: One-shot particle burst at firing position.

### What should be visual only vs gameplay state

- **Visual only**: Recoil animation, muzzle flash, smoke trails. These do not change game state.
- **Gameplay state**: Projectile damage, hit detection, weapon cooldown. These are combat mechanics and are parked for now.

---

## 18. Normal maps / lighting feasibility audit

### Phaser 4.1.0 lighting/normal map possibilities

Phaser 4.1.0 supports custom shaders via the Pipeline system. A normal-map lighting shader could be created that:
1. Takes a normal map texture alongside the diffuse texture.
2. Computes per-pixel lighting from a directional light source.
3. Outputs lit pixels to the frame buffer.

### Whether custom shader/pipeline is required

**Yes.** Phaser 4 does not have built-in 2D normal map support. A custom pipeline would be needed.

### Interaction with isometric depth sorting

**This is the main concern.** Isometric depth sorting uses painter's algorithm (draw back-to-front based on worldY). A lighting pipeline that processes all sprites in a single pass would not respect per-sprite depth. Possible workarounds:
1. Per-sprite lighting shader — expensive, one draw call per sprite.
2. Light map overlay — render lighting to a separate texture, composite on top.

### Whether baked lighting/shadows are better now

**Yes, for the current scope.** Baking shadows and highlights into PNG assets is:
- Simpler to implement.
- Consistent with RenderTexture approach.
- No shader complexity.
- No depth-sorting interaction issues.
- Sufficient for the current visual target.

### Recommendation

VISUAL-SPIKE-01 should produce a spike report, but the likely outcome is "baked lighting is better now; revisit dynamic lighting only when the project has a specific need for real-time light sources."

---

## 19. Phaser 4 API usage matrix

| API / Feature | Current usage | Phase 2 use case | Safe now? | Risks | Recommended task |
|---------------|---------------|------------------|-----------|-------|-------------------|
| Scene lifecycle | Boot → Preload → Menu → Setup → Game | MENU-01/02: mode-aware scene transitions | Safe | Low | MENU-01/02 |
| Loader events | progress logging only | LOADING-01: progress bar | Safe | Low | LOADING-01 |
| Animation Manager | Harvester walk cycle | UNIT-ANIM-01/02: builder + improved harvester | Safe | Low (proven pattern) | UNIT-ANIM-01/02 |
| Tweens | Visual pulses, gathering, construction | WEAPON-WORKFLOW-01: recoil, UI transitions | Safe | Low | WEAPON-WORKFLOW-01 |
| Particles | Not used (Graphics circles for dust) | WEAPON-WORKFLOW-01: muzzle flash, smoke; MAPLIFE-01: resource shimmer | Later | Medium (untested in project) | WEAPON-WORKFLOW-01 |
| RenderTexture | Terrain stamp | TERRAIN-01: decal overlay; FOG-01: fog overlay | Safe | Low | TERRAIN-01, FOG-01 |
| Cameras | Pan/zoom/reset | CAMERA-01: follow selected unit | Later | Low | Later |
| Input | GameInputController | HOTKEYS-01: command registry | Safe | Medium (refactor risk) | HOTKEYS-01 |
| DOMElement | Not used (raw DOM overlays) | Not planned | Avoid | High (migration cost) | — |
| Containers | Not used | Potentially for entity grouping | Later | Medium (depth sorting) | Later |
| Groups | Not used | Potentially for unit collection management | Later | Low | Later |
| Events | Direct calls | Not planned | Avoid | Low (not needed now) | — |
| Data Manager | Not used | Not needed | Avoid | — | — |
| SpriteGPULayer | Not used | **Avoid** | **No** | Isometric depth blocker (PHASER4-GPU-01) | — |
| TilemapGPULayer | Not used | **Avoid** | **No** | Orthographic-only (PHASER4-GPU-01) | — |

---

## 20. Recommended Phase 2 implementation sequence

| # | Task ID | Type | Risk | Direct impl after audit? | Dependencies | Touched files | Validation | Manual QA | Rollback plan | What stays out of scope |
|---|---------|------|------|--------------------------|--------------|---------------|------------|-----------|---------------|------------------------|
| 0 | DOCS-P2-00 | docs | low | Yes | This audit accepted | PROJECT_STATE.md, CURRENT_NEXT_STEP.md, NEW_CHAT_HANDOFF.md, FIX_BACKLOG.md | Docs-only | New session follows Phase 2 | Revert commit | Runtime code, tests |
| 1 | MENU-01 | implementation | medium | Yes | None | NewGameSetupScene.ts, gameSetup.ts | npm test, typecheck, build, qa:smoke | Mode buttons work, controlled URL launch works, URL shortcuts preserved | Revert PR | PreloadScene, asset loading, GameScene |
| 2 | LOADING-01 | implementation | medium | Yes | None | PreloadScene.ts, src/styles.css | typecheck, build, qa:smoke | Loading bar visible, progresses correctly | Revert PR | Asset manifest, MainMenuScene |
| 3 | HUD-01 | implementation | low-medium | Yes | None | GameScene.ts, index.html, PlaytestHud.ts | typecheck, build, qa:smoke | One HUD, no duplicates | Revert PR | PlaytestHud layout redesign |
| 4 | TERRAIN-01 | implementation | medium-high | Yes | None | TerrainRenderer.ts, map generator, new assets, GameScene.ts | typecheck, build, qa:smoke | Terrain looks natural | Revert PR + assets | Renderer architecture, pathfinding |
| 5 | BASE-ANCHOR-01 | implementation | low-medium | Yes | None | buildingPlacementMeta.ts, generatedBuildingMeta.ts | typecheck, build | All faction HQs grounded | Revert PR | Footprint logic, occupancy |
| 6 | MENU-02 | implementation | medium-high | Yes | MENU-01 | PreloadScene.ts, GameScene.ts, devCommands.ts | npm test, typecheck, build, qa:smoke | All modes work from menu | Revert PR | Asset unloading, broad loading changes |
| 7 | ASSET-WORKFLOW-01 | docs/design + tooling | high | No (design task) | None | New design doc | Design review | Review document | — | Runtime code, spritesheets |
| 8 | UNIT-ANIM-01 | asset + integration | high | Yes (after ASSET-WORKFLOW-01) | ASSET-WORKFLOW-01 | Harvester spritesheets, EntityRenderer.ts, unitRenderConfig.ts | npm test, typecheck, build, qa:smoke | Harvester animations correct | Revert PR + assets | Gameplay logic, builder rendering |
| 9 | UNIT-ANIM-02 | asset + integration | high | Yes (after ASSET-WORKFLOW-01 + UNIT-ANIM-01) | ASSET-WORKFLOW-01, UNIT-ANIM-01 | Builder spritesheets, ConstructionRenderer.ts | npm test, typecheck, build, qa:smoke | Builder animations correct | Revert PR + assets | Construction logic, harvester rendering |
| 10 | HOTKEYS-01 | audit/design + impl | medium-high | No (design first) | HUD-01 | New commandRegistry.ts, GameInputController.ts, PlaytestHud.ts | npm test, typecheck, build, qa:smoke | All hotkeys work, labels visible | Revert PR | Full command card UI, combat commands |
| 11 | RESOURCE-01 | implementation | medium | Yes | None | occupancy.ts, EntityRenderer.ts, updateGameState.ts | npm test, typecheck, build, qa:smoke | Depleted resources don't block | Revert PR | Resource amounts, economy |
| 12 | BUILDER-ID | implementation | medium | Yes | None | types.ts, builder.ts, construction.ts, updateGameState.ts, saveGame.ts | npm test, typecheck, build, qa:smoke | Builder selection/save/load works | Revert PR | Harvester logic, renderer visual behavior |
| 13 | FIX-05 | implementation | low | Yes | None | CameraControls.ts | npm test, typecheck, build | Destroy doesn't break input | Revert PR | Game input, state logic |
| 14 | MAPLIFE-01 | asset + implementation | medium-high | Yes | TERRAIN-01 | New prop assets, map generator, occupancy.ts, TerrainRenderer or new PropRenderer | typecheck, build, qa:smoke | Map feels alive, no path blocks | Revert PR + assets | Economy, unit behavior |
| 15 | ARENA-01 | implementation | medium | Yes | MENU-01, MENU-02 | NewGameSetupScene.ts, GameScene.ts, devArena.ts | npm test, typecheck, build, qa:smoke | Arena works from menu | Revert PR | Main sandbox, combat |
| 16 | FOG-01 | design + implementation | high | No (mini-design first) | TERRAIN-01, UNIT-ANIM-01 | types.ts, new fog renderer, GameScene.ts, EntityRenderer.ts, devCommands.ts | npm test, typecheck, build, qa:smoke | Fog behavior correct | Revert PR | Economy, pathfinding algorithm |
| 17 | WEAPON-WORKFLOW-01 | audit/design | high | No (design task) | None | New design doc | Design review | Review document | — | Runtime code, combat implementation |
| 18 | VISUAL-SPIKE-01 | spike | high | No (spike task) | None | Spike report | Spike review | Review findings | — | Production code, assets |

**Notes on sequencing**:
- MENU-01 and LOADING-01 have no dependencies and can proceed in parallel.
- TERRAIN-01 can proceed independently and should be early — highest visible impact.
- ASSET-WORKFLOW-01 gates UNIT-ANIM-01/02 and must be completed first.
- HUD-01 should be completed before HOTKEYS-01 (command card integrates with single HUD).
- MENU-02 depends on MENU-01 (mode selection must exist before mode-aware loading).
- FOG-01 and WEAPON-WORKFLOW-01 are later-phase tasks and do not block the core Phase 2 deliverable.

---

## 21. First 5 ready-to-send implementation prompts

> **Note on prompt order vs roadmap order.** The first 5 ready-to-send prompts are: MENU-01, LOADING-01, HUD-01, TERRAIN-01, BASE-ANCHOR-01. These correspond to the first 5 implementation-eligible tasks in the recommended sequence. DOCS-P2-00 is a docs task that should happen immediately after audit acceptance but is straightforward. ASSET-WORKFLOW-01 is a design task — its prompt is included as prompt 6 (design-only, not implementation). Tasks requiring additional design despite this audit (HOTKEYS-01, FOG-01, WEAPON-WORKFLOW-01, VISUAL-SPIKE-01) are not included as ready-to-send implementation prompts.

### Prompt 1: MENU-01 — Main menu mode selection

```text
Task:
MENU-01 — Main menu mode selection

Mode:
IMPLEMENTATION ONLY

Active repo:
ratoker-jpg/four-elements-phaser

Reference/donor repo:
ratoker-jpg/four-elements-next (reference only)

Critical repo rule:
four-elements-next is donor/reference only.
Do not treat it as active implementation baseline.
You may inspect it only for comparison/reference where useful.
Do not copy donor implementation blindly.

Before doing anything:
1. Confirm active repo is ratoker-jpg/four-elements-phaser.
2. Confirm package.json has "phaser": "4.1.0".
3. Confirm main includes merged PR #98 / PHASE-2-ROADMAP-AUDIT.
4. Read docs/project/PHASE_2_ROADMAP_AUDIT.md.
5. If repo/version/docs/main mismatch, stop and report.

Read first:
- docs/project/GLM_EXECUTOR_RULES.md
- docs/project/GPT_WORKFLOW.md
- docs/project/PROJECT_STATE.md
- docs/project/CURRENT_NEXT_STEP.md
- docs/project/PHASE_2_ROADMAP_AUDIT.md
- src/phaser/NewGameSetupScene.ts
- src/phaser/MainMenuScene.ts
- src/phaser/GameScene.ts
- src/state/gameSetup.ts
- src/state/devCommands.ts
- src/state/devArena.ts

Context:
The game currently requires separate URL links for debug/arena modes.
Users cannot select Standard/Debug/Arena from the menu.
NewGameSetupScene already has faction/map/seed selection.
Mode selection should be added as a "Game Mode" section with three buttons:
Standard, Debug, Arena (default: Standard).

CONTROLLED URL LAUNCH MODEL:
- Standard starts normally (no URL params change).
- Debug from menu navigates/reloads to `?devtools=1` (existing URL shortcut).
- Arena from menu navigates/reloads to `?devtools=1&arena=1` (existing URL shortcut).
- This ensures PreloadScene loads the correct assets on reload — no late-loading.
- MENU-02 can later replace controlled reload with true mode-aware late-loading.

URL shortcuts (?skipMenu, ?devtools=1, ?arena=1) must be preserved as
dev/test overrides that bypass menu selection. qa:smoke must continue to work.

Do NOT implement mode-aware late-loading in this PR — that is MENU-02.
Do NOT change PreloadScene or asset loading behavior.

Goal:
Add mode selection (Standard / Debug / Arena) to NewGameSetupScene.
Controlled URL launch: Debug/Arena reload page with appropriate URL params.
URL shortcuts preserved as overrides.

Scope:
- Add `gameMode: 'standard' | 'debug' | 'arena'` to GameSetupConfig in gameSetup.ts
- Add "Game Mode" section to NewGameSetupScene DOM overlay with 3 buttons
- When Debug selected + Start Game: reload page with `?devtools=1`
  (pass faction/map/seed via sessionStorage or URL search params on reload)
- When Arena selected + Start Game: reload page with `?devtools=1&arena=1`
- When Standard selected + Start Game: scene.start('GameScene', config) as normal
- Default gameMode: 'standard'
- When Arena selected: hide map/seed sections, show "Combat Sandbox" note
- When Debug selected: show note about developer tools
- URL shortcuts override config-based mode selection

Hard rules:
- Do not change PreloadScene
- Do not change asset loading
- Do not implement late-loading (that is MENU-02)
- Do not change GameScene game loop or state logic
- Do not break qa:smoke (?skipMenu must still work)
- Do not add new dependencies
- Do not merge

Validation:
- npm test
- npm run typecheck
- npm run build
- npm run qa:smoke

Manual QA:
- Start Standard from menu — normal launch, no devtools panel
- Start Debug from menu — page reloads with ?devtools=1, devtools panel visible
- Start Arena from menu — page reloads with ?devtools=1&arena=1, arena map, devtools panel
- ?skipMenu — auto-starts with Standard mode
- ?skipMenu&devtools=1&arena=1 — still works as before (URL overrides)
- qa:smoke passes

PR body must include:
- Goal
- Files changed
- Root cause / current limitation
- What changed or findings
- What was intentionally not changed
- Validation results / commands run
- Risks / rollback
- Next recommended task

Open PR into main.
Do not merge.

Telegram notification:
At task completion, send Telegram notification using
/home/z/my-project/.telegram-notify.json if available.
Do not expose token.
Missing/invalid config or send failure must not block the task.
Report notification status in the final summary:
- sent
- skipped: config missing
- failed: <reason>
```

### Prompt 2: LOADING-01 — Proper loading screen

```text
Task:
LOADING-01 — Proper loading screen

Mode:
IMPLEMENTATION ONLY

Active repo:
ratoker-jpg/four-elements-phaser

Reference/donor repo:
ratoker-jpg/four-elements-next (reference only)

Critical repo rule:
four-elements-next is donor/reference only.
Do not treat it as active implementation baseline.

Before doing anything:
1. Confirm active repo is ratoker-jpg/four-elements-phaser.
2. Confirm package.json has "phaser": "4.1.0".
3. Confirm main includes merged PR #98 / PHASE-2-ROADMAP-AUDIT.
4. Read docs/project/PHASE_2_ROADMAP_AUDIT.md.
5. If repo/version/docs/main mismatch, stop and report.

Read first:
- docs/project/GLM_EXECUTOR_RULES.md
- docs/project/GPT_WORKFLOW.md
- docs/project/PROJECT_STATE.md
- docs/project/CURRENT_NEXT_STEP.md
- docs/project/PHASE_2_ROADMAP_AUDIT.md
- src/phaser/BootScene.ts
- src/phaser/PreloadScene.ts
- src/phaser/MainMenuScene.ts
- src/styles.css

Context:
PreloadScene currently has no visual loading feedback — only console
log milestones at 25% intervals. The player sees a blank canvas
during asset loading. Phaser Loader events (progress, complete,
loaderror) are already wired for logging but not for display.

Goal:
Add a visual loading screen to PreloadScene with progress bar,
percentage display, and game title.

Scope:
- Add progress bar using Phaser Graphics or DOM overlay in PreloadScene
- Display "Loading..." text and percentage (0-100%)
- Use Phaser Loader's `progress` event for actual progress — no fake progress
- Style: dark background (#1a1a2e), blue accent (#4fc3f7) — consistent with MainMenuScene
- After loading completes, briefly show "Starting..." then transition
- Do NOT add heavy UI framework
- Do NOT change asset manifest or loading configuration
- Do NOT block qa:smoke auto-start (?skipMenu flow)

Hard rules:
- Do not change asset loading logic
- Do not change MainMenuScene or GameScene
- Do not add new dependencies
- Do not break qa:smoke
- Do not merge

Validation:
- npm test
- npm run typecheck
- npm run build
- npm run qa:smoke

Manual QA:
- Start new game — loading screen visible with progress bar
- Progress reaches 100% before menu appears
- ?skipMenu — loading screen appears briefly, does not block auto-start
- Arena mode — loading screen shows longer duration

PR body must include:
- Goal
- Files changed
- Root cause / current limitation
- What changed or findings
- What was intentionally not changed
- Validation results / commands run
- Risks / rollback
- Next recommended task

Open PR into main.
Do not merge.

Telegram notification:
At task completion, send Telegram notification using
/home/z/my-project/.telegram-notify.json if available.
Do not expose token.
Missing/invalid config or send failure must not block the task.
Report notification status in the final summary:
- sent
- skipped: config missing
- failed: <reason>
```

### Prompt 3: HUD-01 — Legacy HUD removal + HUD consolidation

```text
Task:
HUD-01 — Legacy HUD removal + HUD consolidation

Mode:
IMPLEMENTATION ONLY

Active repo:
ratoker-jpg/four-elements-phaser

Reference/donor repo:
ratoker-jpg/four-elements-next (reference only)

Critical repo rule:
four-elements-next is donor/reference only.
Do not treat it as active implementation baseline.

Before doing anything:
1. Confirm active repo is ratoker-jpg/four-elements-phaser.
2. Confirm package.json has "phaser": "4.1.0".
3. Confirm main includes merged PR #98 / PHASE-2-ROADMAP-AUDIT.
4. Read docs/project/PHASE_2_ROADMAP_AUDIT.md.
5. If repo/version/docs/main mismatch, stop and report.

Read first:
- docs/project/GLM_EXECUTOR_RULES.md
- docs/project/GPT_WORKFLOW.md
- docs/project/PROJECT_STATE.md
- docs/project/CURRENT_NEXT_STEP.md
- docs/project/PHASE_2_ROADMAP_AUDIT.md
- src/phaser/GameScene.ts
- src/phaser/ui/PlaytestHud.ts
- index.html
- src/styles.css

Context:
The project has two HUD systems:
1. Legacy top-bar HUD in GameScene.updateHUD() — reads DOM elements by ID
2. PlaytestHud — DOM overlay sidebar with full economy, build, production controls

The Phase 1 audit and Phase 2 audit both rate two HUDs as high-severity.
The legacy HUD should be removed. PlaytestHud should become the single HUD.
Camera info should be moved into PlaytestHud or removed.

Goal:
Remove the legacy HUD system and make PlaytestHud the single source of
economy/status/controls information.

Scope:
- Remove legacy HUD DOM elements from GameScene (hudCoords, hudMapName,
  hudEconomy, hudBuild, hudBuilder)
- Remove updateHUD() method from GameScene
- Remove or comment out legacy HUD DOM elements in index.html
- Optionally move camera info into PlaytestHud diagnostics section
- Do NOT redesign PlaytestHud layout
- Do NOT add new UI features
- Do NOT change PlaytestHud styling significantly

Hard rules:
- Do not change gameplay state logic
- Do not change renderer code
- Do not change assets
- Do not add new dependencies
- Do not break qa:smoke (DOM assertion for #hud-economy must still work)
- If removing #hud-economy from legacy HUD, ensure PlaytestHud has an
  equivalent element that qa:smoke can assert
- Do not merge

Validation:
- npm test
- npm run typecheck
- npm run build
- npm run qa:smoke

Manual QA:
- Start standard game — only one HUD visible
- Economy readout works in PlaytestHud
- Build/production buttons work
- Camera info visible somewhere
- No empty DOM areas where legacy HUD was
- qa:smoke passes

PR body must include:
- Goal
- Files changed
- Root cause / current limitation
- What changed or findings
- What was intentionally not changed
- Validation results / commands run
- Risks / rollback
- Next recommended task

Open PR into main.
Do not merge.

Telegram notification:
At task completion, send Telegram notification using
/home/z/my-project/.telegram-notify.json if available.
Do not expose token.
Missing/invalid config or send failure must not block the task.
Report notification status in the final summary:
- sent
- skipped: config missing
- failed: <reason>
```

### Prompt 4: TERRAIN-01 — Sand terrain visual system

```text
Task:
TERRAIN-01 — Sand terrain visual system

Mode:
IMPLEMENTATION ONLY

Active repo:
ratoker-jpg/four-elements-phaser

Reference/donor repo:
ratoker-jpg/four-elements-next (reference only)

Critical repo rule:
four-elements-next is donor/reference only.
Do not treat it as active implementation baseline.

Before doing anything:
1. Confirm active repo is ratoker-jpg/four-elements-phaser.
2. Confirm package.json has "phaser": "4.1.0".
3. Confirm main includes merged PR #98 / PHASE-2-ROADMAP-AUDIT.
4. Read docs/project/PHASE_2_ROADMAP_AUDIT.md.
5. If repo/version/docs/main mismatch, stop and report.

Read first:
- docs/project/GLM_EXECUTOR_RULES.md
- docs/project/GPT_WORKFLOW.md
- docs/project/PROJECT_STATE.md
- docs/project/CURRENT_NEXT_STEP.md
- docs/project/PHASE_2_ROADMAP_AUDIT.md
- src/phaser/render/TerrainRenderer.ts
- src/phaser/GameScene.ts
- src/state/createInitialState.ts
- src/assets/generatedAssetManifest.ts
- src/config/worldConfig.ts

Context:
The map looks like a chessboard — identical diamond tiles in a grid
pattern. No natural variation, no visual patches, no decals.
The Phase 2 audit recommends:
1. If approved terrain patch variant assets already exist, integrate them.
   If they do not exist, create asset requirements and placeholder
   integration plan, then stop or request assets as a separate task.
2. Update map generator to assign variants in clusters (noise-based)
3. If approved decal sprites already exist, integrate them.
   If they do not exist, create decal asset requirements, then stop.
4. Remove or make optional the grid lines drawn in GameScene
5. Do NOT replace the RenderTexture approach
6. Do NOT implement TilemapGPULayer
7. Do NOT generate final production PNG assets in this PR.
   Asset generation/art production is a separate task.

Goal:
Remove the chessboard look and make terrain read as natural stylized sand.

Scope:
- If terrain patch variant assets exist: integrate them (5-8 per type)
  If not: create asset requirements doc and generator+renderer support for
  patch variants with placeholder integration, then stop
- Update map generator to assign variants in clusters (noise-based)
- If decal sprites exist: add them and stamp on terrain RenderTexture after tiles
  If not: create decal asset requirements, skip decal integration, continue
  with generator and grid line changes
- Remove or toggle grid lines in GameScene.drawGridLines()
- Preserve isometric readability
- Preserve RenderTexture caching (stamp once)

Hard rules:
- Do not replace the RenderTexture terrain approach
- Do not implement TilemapGPULayer
- Do not generate final production PNG terrain/decal assets in this PR
- Do not create low-quality final PNG assets as part of this implementation
- Placeholder assets are allowed only if explicitly marked dev-only and
  approved by Denis
- If production assets do not exist, create asset requirements and stop
- Do not break pathfinding or passability
- Do not change game state logic
- Do not change unit movement code
- If this requires replacing the TerrainRenderer architecture, stop
  and create a design doc instead
- Do not merge

Validation:
- npm test
- npm run typecheck
- npm run build
- npm run qa:smoke

Manual QA:
- Terrain reads as natural desert surface, not a grid (if assets available)
- No visible tile repetition pattern (generator clusters correct)
- Decals visible on zoom (if assets available; otherwise decal slots ready)
- Grid lines removed or very subtle
- Pathfinding still works correctly
- Performance unchanged

PR body must include:
- Goal
- Files changed
- Root cause / current limitation
- What changed or findings
- What was intentionally not changed
- Validation results / commands run
- Risks / rollback
- Next recommended task

Open PR into main.
Do not merge.

Telegram notification:
At task completion, send Telegram notification using
/home/z/my-project/.telegram-notify.json if available.
Do not expose token.
Missing/invalid config or send failure must not block the task.
Report notification status in the final summary:
- sent
- skipped: config missing
- failed: <reason>
```

### Prompt 5: BASE-ANCHOR-01 — HQ/building grounding and footprint alignment

```text
Task:
BASE-ANCHOR-01 — HQ/building grounding and footprint alignment

Mode:
IMPLEMENTATION ONLY

Active repo:
ratoker-jpg/four-elements-phaser

Reference/donor repo:
ratoker-jpg/four-elements-next (reference only)

Critical repo rule:
four-elements-next is donor/reference only.
Do not treat it as active implementation baseline.

Before doing anything:
1. Confirm active repo is ratoker-jpg/four-elements-phaser.
2. Confirm package.json has "phaser": "4.1.0".
3. Confirm main includes merged PR #98 / PHASE-2-ROADMAP-AUDIT.
4. Read docs/project/PHASE_2_ROADMAP_AUDIT.md.
5. If repo/version/docs/main mismatch, stop and report.

Read first:
- docs/project/GLM_EXECUTOR_RULES.md
- docs/project/GPT_WORKFLOW.md
- docs/project/PROJECT_STATE.md
- docs/project/CURRENT_NEXT_STEP.md
- docs/project/PHASE_2_ROADMAP_AUDIT.md
- src/phaser/render/ConstructionRenderer.ts
- src/phaser/render/EntityRenderer.ts
- src/assets/generatedBuildingMeta.ts
- src/assets/buildingPlacementMeta.ts
- src/state/types.ts
- src/state/construction.ts

Context:
Buildings may appear visually offset above their footprints. The base
"floats" above the red footprint cells. This is a visual anchor/origin
issue in building placement metadata. The fix should adjust per-building
origin/anchor in placement metadata after confirming root cause.

Goal:
Fix building visual grounding so bottom edge aligns with footprint
bottom row. Fix per-building after confirming root cause. No global
blind shift.

Scope:
- Audit all 4 faction HQ placement metadata for anchor/origin alignment
- Verify separator, power-plant, units-factory anchor correctness
- Fix misaligned building anchors in buildingPlacementMeta.ts
- Add manual QA for all four factions
- Do NOT change footprint logic or occupancy map

Hard rules:
- Do not globally shift all assets blindly
- Do not change footprint logic or occupancy map
- Do not change game state or pathfinding
- Do not change assets (PNG files)
- Do not break other buildings while fixing HQ
- Do not merge

Validation:
- npm test
- npm run typecheck
- npm run build

Manual QA:
- All 4 faction HQs — bottom edge aligns with footprint
- Separator, power-plant, units-factory — correctly anchored
- Construction sites — progress bar at correct position
- No visual regression for any faction

PR body must include:
- Goal
- Files changed
- Root cause / current limitation
- What changed or findings
- What was intentionally not changed
- Validation results / commands run
- Risks / rollback
- Next recommended task

Open PR into main.
Do not merge.

Telegram notification:
At task completion, send Telegram notification using
/home/z/my-project/.telegram-notify.json if available.
Do not expose token.
Missing/invalid config or send failure must not block the task.
Report notification status in the final summary:
- sent
- skipped: config missing
- failed: <reason>
```

---

## 22. Manual playtest checklist for Phase 2

### Menu mode selection
- [ ] Standard mode selectable from NewGameSetupScene
- [ ] Debug mode selectable — page reloads with ?devtools=1, devtools panel appears
- [ ] Arena mode selectable — page reloads with ?devtools=1&arena=1, arena map loads
- [ ] URL shortcuts (?devtools=1, ?arena=1, ?skipMenu) still work

### Standard game launch
- [ ] Loading screen shows progress bar
- [ ] Progress reaches 100% before menu
- [ ] Only one HUD visible (after HUD-01)
- [ ] Camera info visible somewhere

### Debug mode launch
- [ ] Devtools panel visible
- [ ] ModularUnits loaded (modular combat units render)
- [ ] Debug overlays toggle with T

### Arena launch
- [ ] Arena map 20×20 loads
- [ ] Modular combat units render
- [ ] Arena reset works
- [ ] "Combat Sandbox" label visible

### Loading screen
- [ ] Progress bar appears during asset loading
- [ ] Progress is real (not fake)
- [ ] Game title visible during loading
- [ ] No blank screen during loading

### Hotkeys/command card
- [ ] Build hotkeys (B/F/P) work with labels on buttons
- [ ] Production hotkeys (N/G) work with labels
- [ ] Command registry shows all registered commands
- [ ] ESC toggles pause menu

### Terrain visual review
- [ ] Terrain reads as natural desert, not chessboard (if production assets available)
- [ ] No visible grid pattern
- [ ] Terrain patches have natural clusters (generator logic correct)
- [ ] Decals (cracks, stones) visible (if production assets available)
- [ ] Grid lines removed or very subtle

### Base grounding
- [ ] All 4 faction HQs sit correctly on footprint
- [ ] Separator, power-plant, units-factory correctly anchored
- [ ] Construction progress bars at correct position

### Animated harvester
- [ ] Walk cycle animation smooth
- [ ] Direction changes natural
- [ ] Gather animation plays (if added)
- [ ] Unload animation plays (if added)
- [ ] All 4 factions correct colors

### Animated builder
- [ ] Walk cycle animation smooth
- [ ] Build/work animation plays (if added)
- [ ] Direction changes natural
- [ ] All 4 factions correct

### Resource depletion and occupancy
- [ ] Depleted resources visually fade or disappear
- [ ] Harvesters walk through depleted resource tiles
- [ ] No ghost-occupied tiles on debug overlay
- [ ] Harvesters retarget to nearest non-depleted resource

### Props/doodads
- [ ] Map has rocks, bushes, visual details
- [ ] Blocking props affect pathfinding
- [ ] Starting area clear of blocking props
- [ ] No visual overlap with resources/buildings

### Fog behavior
- [ ] Unexplored areas appear black
- [ ] Explored areas appear grey when not visible
- [ ] Visible areas show full detail
- [ ] Devtools toggle removes fog

### Arena VFX test
- [ ] Arena accessible from menu
- [ ] Weapon recoil visual (if implemented)
- [ ] Projectile visual (if implemented)
- [ ] Muzzle flash/smoke (if implemented)

---

## 23. Do not do list

1. **No bot implementation now** — bot/enemy AI is parked until visual and arena systems are ready.
2. **No enemy AI now** — parked.
3. **No full combat in main sandbox now** — arena test mode only.
4. **No elements economy now** — parked for upgrades/faction progression/combat.
5. **No SpriteGPULayer / TilemapGPULayer implementation now** — rejected by PHASER4-GPU-01 unless new evidence contradicts the spike.
6. **No broad UI framework** — do not add React/Vue/Svelte or component system.
7. **No normal maps implementation before VISUAL-SPIKE-01 acceptance** — spike must confirm feasibility first.
8. **No huge updateGameState rewrite** — staged decomposition only, never one giant PR.
9. **No asset regeneration without accepted ASSET-WORKFLOW-01** — must define pipeline first.
10. **No breaking smoke shortcuts** — `?skipMenu`, `?devtools=1`, `?arena=1` must continue to work for qa:smoke.
11. **No Playwright click tests** — no flake plan exists.
12. **No Canvas fallback rendering** — forbidden.
13. **No Rex plugins** — forbidden.
14. **No package dependency changes** — only with separate approval.
15. **No combat implementation** — visual design and arena test only.
16. **No faction-aware loading** — premature per PHASER4-LOAD-01.
17. **No final production PNG asset generation in code PRs** — if production terrain/decal/unit assets do not already exist, create asset requirements and request a separate asset task. Asset generation/art production must not be hidden inside code implementation PRs.

---

## 24. Final verdict

### Should Phase 2 roadmap be accepted as active direction?

**Yes.** The Phase 2 roadmap correctly identifies the product gap and proposes a practical sequence of tasks to close it. The pivot from technical cleanup to playability/visual identity is well-timed and addresses the most important user-facing problems.

### What must be fixed in roadmap before acceptance

1. **ASSET-WORKFLOW-01 must be elevated in sequencing.** It currently appears as task #7 in the roadmap, but UNIT-ANIM-01 and UNIT-ANIM-02 (#8 and #9) depend on it. The audit corrects this: ASSET-WORKFLOW-01 should be completed before any unit regeneration PRs.
2. **HUD-01 should be explicitly included.** The Phase 2 roadmap does not include HUD consolidation (it was in the Phase 1 audit). This audit adds it as an early Phase 2 task because two HUDs block HOTKEYS-01 command card integration and create player confusion.
3. **BUILDER-ID and FIX-05 should be included.** These are small technical fixes from the Phase 1 audit that support Phase 2 work (builder Animation Manager migration, camera cleanup).
4. **FOG-01 should be positioned later.** The roadmap lists it at #12, which is appropriate. The audit confirms: fog should wait until terrain and animation work is stable.

### Exact first implementation task

**MENU-01 — Main menu mode selection.** This is the lowest-risk, highest-product-value task. It makes the game feel like a product (not a debug tool) and unblocks MENU-02 (mode-aware loading) and ARENA-01 (arena from menu). A ready-to-send prompt is provided in section 21.

Alternative first task: **LOADING-01** or **TERRAIN-01** — both have no dependencies and can proceed in parallel with MENU-01.

### Whether docs checkpoint should follow after audit acceptance

**Yes.** DOCS-P2-00 should be the first commit after audit acceptance, updating PROJECT_STATE.md, CURRENT_NEXT_STEP.md, NEW_CHAT_HANDOFF.md, and FIX_BACKLOG.md to reflect Phase 2 as the active roadmap. This ensures new GPT/GLM sessions follow the correct direction.

---

## Приложение A: Команды валидации

| Команда | Результат | Детали |
|---------|-----------|--------|
| `npm test` | PASS | 27 test files, 751 tests passed, 2.24s |
| `npm run typecheck` | PASS | `tsc --noEmit` — без ошибок |
| `npm run build` | PASS | 61 modules, 1868.58 kB main chunk, 4.01s |
| `npm run qa:smoke` | PASS | Standard: PASS (5.1s), Devtools: PASS (2.4s), Combined: PASS (16.4s) |

---

## Приложение B: LOC сводка по модулям (подтверждённая)

| Модуль | Файлов | LOC |
|--------|--------|-----|
| src/state/ | 20 | 6800 |
| src/phaser/ | 21 | ~7200 |
| src/assets/ | 10 | 2173 |
| src/config/ | 3 | 223 |
| src/__tests__/ | 27 | 10533 |
| tools/ | 11 | ~5400 |
| docs/project/ | 16 | ~9400+ |
| **Total src** | — | **~17000** |
