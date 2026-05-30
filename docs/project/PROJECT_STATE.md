# PROJECT_STATE.md

Status: operational project state  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Current phase: VISUAL roadmap — layered industrial platform direction

---

## Current mode

VISUAL roadmap is the active planning direction.

The previous Phase 2 (sand-terrain-focused) roadmap is archived. The current visual direction is an industrial RTS battlefield / mining platform / industrial mineral wasteland.

This pivot happened after:

```text
PR #119 — TERRAIN-02A 256x128 terrain integration (sand pipeline, merged)
PR #120 — MAPLIFE decor (visually rejected, not merged)
VISUAL-ROADMAP-01 — Archive old roadmap and add VISUAL_ROADMAP.md
VISUAL-AUDIT-01 — Full visual system audit and implementation plan
VISUAL-01 — Industrial map visual candidates, Candidate A selected
VISUAL-01B — Layered Platform Frame Direction checkpoint
```

---

## Current Phaser version

```text
4.1.0
```

Always confirm this in `package.json` before planning Phaser API work.

---

## Key decisions

- **Primary biome**: Industrial RTS battlefield / mining platform (not sand desert)
- **Selected map direction**: Candidate A — Heavy Mining Platform
- **Allowed enrichment**: selected Candidate C details as secondary visual enrichment only
- **Rejected as primary**: Candidate B visible grid direction
- **Practical map model**: Layered Platform Frame + Tile Fill
- **Sand terrain**: Paused as primary direction. Sand assets remain in repo as fallback.
- **MAPLIFE #120**: Rejected. Desert decor must not be continued.
- **Map presentation**: Grounded industrial platform with outer world frame
- **Playable platform**: logically flat; visual height only on the outer frame / side walls
- **Tile standard**: 384×192, 2:1 top-surface-only platform tiles
- **Start position**: Lower-left start zone (future change)
- **HUD target**: Bottom bar — minimap left, info center, commands right (StarCraft-inspired)
- **Menu**: Preserve cinematic central composition, update background to industrial

---

## Current source-of-truth docs

Read these before any task:

```text
docs/project/VISUAL_ROADMAP.md
docs/project/VISUAL_SYSTEM_AUDIT.md
docs/project/VISUAL_CANDIDATE_SUMMARY.md
docs/project/VISUAL_01B_LAYERED_PLATFORM_FRAME.md
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/GPT_WORKFLOW.md
docs/project/GLM_EXECUTOR_RULES.md
```

Important:

```text
VISUAL_ROADMAP.md is the accepted planning direction.
VISUAL_SYSTEM_AUDIT.md is the accepted audit with staged PR sequence.
VISUAL_CANDIDATE_SUMMARY.md records the selected Candidate A direction.
VISUAL_01B_LAYERED_PLATFORM_FRAME.md records the accepted layered platform model.
Implementation tasks covered by the audit can proceed without a new mini-audit if they do not expand scope.
If a task expands scope, touches gameplay/pathfinding/economy unexpectedly, or combines multiple phases, stop and request approval.
```

---

## Active next work

```text
VISUAL-01B — Layered Platform Frame Direction checkpoint
```

VISUAL-01 selected the visual direction:

```text
Primary direction: Candidate A — Heavy Mining Platform
Allowed enrichment: selected Candidate C details only as secondary visual detail
Rejected as primary: Candidate B — visible grid risk
```

VISUAL-01B documents the practical rendering model:

```text
background world + tile-filled platform center + arena frame overlay + invisible grid
```

After VISUAL-01B is reviewed and merged:

```text
VISUAL-02A — Layered Platform Frame Prototype (dev-only preview)
```

Do not start VISUAL-02A until VISUAL-01B is merged.

---

## Completed foundation from previous Phase 2

These tasks are merged and remain useful foundation for the VISUAL roadmap:

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
TERRAIN-02A (#119) — 256×128 terrain integration (technical pipeline foundation) ✓
TERRAIN-FIX-01 (#121) — Grid seam removal (technical pipeline improvement) ✓
```

These are done. Do not re-assign or re-list them as pending work.

Still needed (not yet started, can proceed in parallel with VISUAL phases where they do not conflict):

```text
FOG-01 — Two-layer fog of war (design + implementation)
ARENA-01 — Arena mode from menu
```

---

## Paused / superseded

Sand terrain polish as primary direction is paused. MAPLIFE desert decor is rejected. These must not be continued as-is:

```text
TERRAIN-01 (#103) — Sand visual system — merged, but sand direction paused as primary biome
TERRAIN-02 (#118) — Sand quality audit — merged, pipeline learnings preserved
TERRAIN-FIX-01 (#121) — Sand grid seam removal — merged, code remains as fallback
MAPLIFE-01 (#112) — Desert decor asset readiness — rejected
MAPLIFE #120 — Desert decor PR — visually rejected, not merged
```

Sand assets and code remain in repo as fallback/reference. Future terrain work targets the industrial biome and the layered platform frame model.

---

## Deferred until VISUAL audit/design

These tasks depend on the industrial biome direction being established first:

```text
RESOURCE visual refresh — Deferred to VISUAL Phase V6 after map style approved
Harvester/Builder visual refresh — Deferred to VISUAL Phase V9 after industrial biome established
HUD redesign implementation — Deferred to VISUAL Phase V7 after audit and map direction approved
Map frame implementation — Deferred to VISUAL Phase V4 after terrain/platform integration
Lower-left start composition — Deferred to VISUAL Phase V5 after map frame established
```

---

## Key constraints

Do not start these as immediate implementation:

```text
- bot / enemy AI
- full combat in main sandbox
- attack waves
- elements economy
- upgrades / progression
- SpriteGPULayer / TilemapGPULayer implementation
- normal maps implementation before feasibility spike
- sand terrain as primary visual direction
- MAPLIFE #120 continuation
- mass image generation in docs PRs
- runtime implementation without accepted audit/design
- mass asset generation without visual approval
- fixing bad art by code-only patches
- four-biome system now
- copying StarCraft assets/UI exactly
- production terrain replacement before dev-only VISUAL-02A proof
- gameplay/pathfinding/economy changes inside VISUAL-02A
```

---

## Archived docs

The following documents are archived (read as historical reference only):

```text
docs/project/PHASE_2_ROADMAP.md → deprecated, see VISUAL_ROADMAP.md
docs/project/PHASE_2_ROADMAP_AUDIT.md → deprecated
docs/project/PHASE_2_ROADMAP_AUDIT_PROMPT.md → deprecated
docs/project/TERRAIN_02_QUALITY_AUDIT_AND_PIPELINE.md → paused/superseded
docs/project/MAPLIFE_01_ASSET_READINESS.md → rejected
```

Archived copies: `docs/project/archive/`

---

## Maintenance policy

Keep this file short and operational.

Detailed history belongs in:

- PR bodies
- `VISUAL_ROADMAP.md`
- Audit/design docs for each VISUAL phase
