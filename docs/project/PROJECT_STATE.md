# PROJECT_STATE.md

Status: operational project state  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Current phase: VISUAL roadmap — industrial biome visual direction

---

## Current mode

VISUAL roadmap is the active planning direction.

The previous Phase 2 (sand-terrain-focused) roadmap is archived. The current visual direction is an industrial RTS battlefield / mining platform / industrial mineral wasteland.

This pivot happened after:

```text
PR #119 — TERRAIN-02A 256x128 terrain integration (sand pipeline, merged)
PR #120 — MAPLIFE decor (visually rejected, not merged)
VISUAL-ROADMAP-01 — Archive old roadmap and add VISUAL_ROADMAP.md
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
- **Sand terrain**: Paused as primary direction. Sand assets remain in repo as fallback.
- **MAPLIFE #120**: Rejected. Desert decor must not be continued.
- **Map presentation**: Grounded industrial platform with irregular edges and outer world frame
- **Start position**: Lower-left start zone (future change)
- **HUD target**: Bottom bar — minimap left, info center, commands right (StarCraft-inspired)
- **Menu**: Preserve cinematic central composition, update background to industrial

---

## Current source-of-truth docs

Read these before any task:

```text
docs/project/VISUAL_ROADMAP.md
docs/project/VISUAL_SYSTEM_AUDIT.md
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/GPT_WORKFLOW.md
docs/project/GLM_EXECUTOR_RULES.md
```

Important:

```text
VISUAL_ROADMAP.md is the accepted planning direction.
Implementation requires separate audit/design PR (VISUAL-AUDIT-01) first.
```

---

## Active next work

```text
VISUAL-01 — Industrial map visual candidate workflow (docs/assets only)
```

VISUAL-AUDIT-01 is complete. See `docs/project/VISUAL_SYSTEM_AUDIT.md` for the full audit with 12-PR staged implementation sequence.

After VISUAL-01 (visual candidates approved):

```text
VISUAL-02 — Map rendering prototype spike (dev-mode preview)
```

Do not start VISUAL implementation before the audit is accepted and visual candidates are approved.

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

Still needed (not yet started, can proceed in parallel with VISUAL phases):

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
MAPLIFE-01 (#112) — Desert decor asset readiness — rejected visual direction
MAPLIFE #120 — Desert decor PR — visually rejected, not merged
```

Sand assets and code remain in repo as fallback/reference. Future terrain work targets the industrial biome (VISUAL Phase V3).

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
