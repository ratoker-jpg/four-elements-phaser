# PROJECT_STATE.md

Status: operational project state  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Current phase: current VISUAL/UI roadmap closed — waiting for next owner-defined roadmap

---

## Current mode

```text
Roadmap closed / planning pause.
```

The completed VISUAL/UI roadmap slice ended after PR #161.

There is no active implementation task by default.

Next action must be owner-defined roadmap planning, not automatic continuation of the old queue.

Closure document:

```text
docs/project/ROADMAP_CLOSURE_2026_06_01_VISUAL_UI.md
```

---

## Current Phaser version

```text
4.1.0
```

Always confirm this in `package.json` before planning Phaser API work.

---

## Current source-of-truth docs

Read these before planning the next roadmap:

```text
docs/project/ROADMAP_CLOSURE_2026_06_01_VISUAL_UI.md
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/GPT_WORKFLOW.md
docs/project/GLM_EXECUTOR_RULES.md
```

Historical VISUAL docs remain valid background, but they are not an active implementation queue:

```text
docs/project/VISUAL_ROADMAP.md
docs/project/VISUAL_SYSTEM_AUDIT.md
docs/project/VISUAL_CANDIDATE_SUMMARY.md
docs/project/VISUAL_01B_LAYERED_PLATFORM_FRAME.md
docs/project/VISUAL_05A_PRODUCTION_INDUSTRIAL_MAP_INTEGRATION_PLAN.md
docs/project/VISUAL_06_RESOURCE_FIELD_VISUAL_MODEL.md
```

Important:

```text
Do not continue old VISUAL tasks by inertia.
Do not treat old queue items as active unless the owner explicitly reopens them.
Do not start runtime/code implementation before a new roadmap/scope is accepted.
```

---

## Current owner-facing state

The project currently has:

```text
- industrial generated map as default for new games
- mapStyle industrial/sand preserved
- sand/fixed/custom map paths preserved as fallback/reference
- production industrial terrain/frame/background layer
- lower-left HQ/start/resource composition
- approved industrial resource crystal assets in repo
- industrial resources preloaded and rendered by default for industrial mapStyle
- legacy minerals preserved for sand/legacy resourceStyle
- polished main menu
- polished New Game setup
- polished ESC menu
- polished Save/Continue flow
- polished Playtest HUD readability
```

This is the expected baseline for the next roadmap.

---

## Key decisions still in force

- **Primary biome**: Industrial RTS battlefield / mining platform, not sand desert.
- **Selected map direction**: Candidate A — Heavy Mining Platform.
- **Allowed enrichment**: selected Candidate C details as secondary visual enrichment only.
- **Rejected as primary**: Candidate B visible grid direction.
- **Practical map model**: Layered Platform Frame + Tile Fill.
- **Sand terrain**: paused as primary direction. Sand assets remain in repo as fallback.
- **MAPLIFE #120**: rejected. Desert decor must not be continued.
- **Map presentation**: grounded industrial platform with outer world frame.
- **Playable platform**: logically flat; visual height only on the outer frame / side walls.
- **Tile standard**: 384×192 source assets, 2:1 top-surface-only platform tiles.
- **Runtime logical tile**: existing isometric 2:1 map model remains the source of gameplay coordinates.
- **Start position**: lower-left start zone.
- **Target production map sizes**: 96×96 / 128×128 / 192×192 remain deferred; current production small is still 32×32.
- **Frame border**: 1 tile around playable area, visual only, not in logical grid.
- **Resource visual model**: normal resources are 1×1 visual nodes; central infinite is 2×2.
- **UI style**: industrial sci-fi, dark slate panels, bronze/gold primary accent, teal secondary accents.

---

## Active next work

```text
NONE.
```

Next action:

```text
Define a new roadmap from owner goals.
```

No code PR should be proposed until the new target is clear, unless the owner asks for a tiny concrete bugfix.

---

## Completed roadmap slice

### VISUAL-05A — Production industrial map integration

```text
PR #144 — VISUAL-05A PR1: Parameterize ?visual04a map preview 96/128/192
PR #145 — VISUAL-05A PR2: Industrial terrain behind mapStyle
PR #146 — VISUAL-05A PR3: Production industrial frame/background layer
PR #147 — VISUAL-05A PR4: Lower-left HQ/start/resources
PR #148 — VISUAL-05A PR5: Industrial generated map default
```

Final state:

```text
- industrial generated map is default for new games
- mapStyle industrial/sand remains available
- sand/fixed/custom map paths remain fallback/reference
- HQ/start/resources are lower-left for industrial generated maps
- frame/background/walls are connected in production for industrial
- save/load compatibility preserved
- current production small map remains 32x32
```

### VISUAL-06 — Resource field visual model and integration

```text
PR #150 — VISUAL-06A: Resource field visual model docs/design
PR #151 — VISUAL-06B: Resource candidate review package
PR #152 — VISUAL-06B1: Resource model pivot
PR #153 — VISUAL-06C: Approved industrial resource assets added
PR #154 — VISUAL-06D: Preload/manifest wiring behind resourceStyle
PR #155 — VISUAL-06E: Render industrial resources behind resourceStyle
PR #156 — VISUAL-06E fixup: Resolve resourceStyle from mapStyle
```

Final state:

```text
- resource visual model accepted: 1x1 normal resources + 2x2 central infinite
- approved resource PNGs are committed under public/assets/environment/resources
- assets are loaded through generated manifest/preload pipeline
- renderer maps current ResourceType values to approved industrial assets
- mapStyle=industrial resolves to resourceStyle=industrial
- mapStyle=sand resolves to resourceStyle=legacy
- old minerals remain available
- resource gameplay/economy/amount/depletion/pathfinding unchanged
```

Current production resource visual mapping:

```text
small    -> resource_industrial_poor_01
medium   -> resource_industrial_medium_01
large    -> resource_industrial_rich_01
infinite -> resource_industrial_infinite_center_2x2_01
```

Available but not production-mapped yet:

```text
resource_industrial_very_poor_01
resource_industrial_very_rich_01
```

### UI roadmap — menus, setup, pause, save/continue, HUD

```text
PR #157 — UI-01: Main menu visual polish and navigation shell
PR #158 — UI-02: New Game setup polish
PR #159 — UI-03: ESC menu polish
PR #160 — UI-04: Save/Continue flow polish
PR #161 — HUD-01: Playtest HUD readability polish
```

Final state:

```text
- main menu uses industrial UI direction
- New Game setup uses same UI direction
- ESC menu uses same UI direction
- Main Menu Continue flow is polished
- ESC Save remains functional
- ESC Load opens save slot list using existing loadGame flow
- save format/schema unchanged
- Playtest HUD readability polished
- HUD callbacks and gameplay logic preserved
```

---

## Completed foundation from previous Phase 2

These tasks remain useful foundation and should not be re-assigned as pending work:

```text
MENU-01 (#100) — Main menu mode selection via controlled URL launch ✓
MENU-02 (#105) — Mode-aware late-loading / seamless mode switching ✓
LOADING-01 (#101) — Proper loading screen with progress bar ✓
BASE-ANCHOR-01 (#104) — HQ/building grounding and south-vertex placement ✓
HOTKEYS-01 (#111) — Command registry / hotkey system ✓
BUILDER-ID (#109) — Builder stable IDs ✓
RESOURCE-01 (#108) — Depleted resource ghost occupancy fix ✓
HUD-01 (#102) — Legacy HUD removal and consolidation ✓
WEAPON-WORKFLOW-01 (#114) — Weapon VFX / recoil design document ✓
ASSET-WORKFLOW-01 (#106) — Animated unit asset pipeline design ✓
TERRAIN-02A (#119) — 256×128 terrain integration foundation ✓
TERRAIN-FIX-01 (#121) — Grid seam removal foundation ✓
```

---

## Known deferred topics

These are known future candidates, not current tasks:

```text
- production map size migration to 96/128/192
- full RTS bottom-bar HUD with minimap/info/commands
- fog of war
- arena mode
- unit visual workflow
- combat/enemy/bot/AI systems
- upgrades/progression
- deeper economy/resource mechanics
- save schema/migration/autosave/cloud saves
- resource richness gameplay/mapgen beyond small/medium/large/infinite
```

Each needs a new roadmap, audit, or explicit scoped task before implementation.

---

## Paused / superseded

Sand terrain polish as the primary direction is paused. MAPLIFE desert decor is rejected. These must not be continued as-is:

```text
TERRAIN-01 (#103) — Sand visual system — merged, but sand direction paused as primary biome
TERRAIN-02 (#118) — Sand quality audit — merged, pipeline learnings preserved
TERRAIN-FIX-01 (#121) — Sand grid seam removal — merged, code remains as fallback
MAPLIFE-01 (#112) — Desert decor asset readiness — rejected
MAPLIFE #120 — Desert decor PR — visually rejected, not merged
```

Sand assets and code remain in repo as fallback/reference.

---

## Constraints before next roadmap

Do not start these as immediate implementation without a new owner-approved roadmap:

```text
- bot / enemy AI
- full combat in main sandbox
- attack waves
- elements economy expansion
- upgrades / progression
- SpriteGPULayer / TilemapGPULayer implementation
- normal maps implementation before feasibility spike
- sand terrain as primary visual direction
- MAPLIFE #120 continuation
- mass image generation in docs PRs
- runtime implementation without accepted audit/design
- mass asset generation without visual approval
- fixing bad art by code-only patches
- four-biome system
- copying StarCraft assets/UI exactly
- production map size migration without separate scoped task
- silently changing map dimensions from current production behavior
- changing save schema during UI polish
- changing economy/resource values during visual/UI work
```

---

## Next roadmap workflow

Use this sequence for the next major workstream:

```text
1. owner defines target outcome
2. GPT writes/updates roadmap document
3. roadmap audit/design if scope is broad or risky
4. implementation split into small scoped PRs
5. GLM executes only accepted scopes
6. GPT reviews every PR before merge
```

For small bugfixes:

```text
A tiny, concrete, low-risk bugfix can proceed without a new roadmap if it does not change direction, gameplay, economy, save schema, or asset contracts.
```

---

## Archived docs

The following documents are archived or historical reference only:

```text
docs/project/PHASE_2_ROADMAP.md → deprecated, see closure/current roadmap docs
docs/project/PHASE_2_ROADMAP_AUDIT.md → deprecated
docs/project/PHASE_2_ROADMAP_AUDIT_PROMPT.md → deprecated
docs/project/TERRAIN_02_QUALITY_AUDIT_AND_PIPELINE.md → paused/superseded
docs/project/MAPLIFE_01_ASSET_READINESS.md → rejected
```
