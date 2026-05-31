# PROJECT_STATE.md

Status: operational project state  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Current phase: VISUAL roadmap — layered industrial platform direction

---

## Current mode

VISUAL roadmap is the active planning direction.

The previous Phase 2 sand-terrain-focused roadmap is archived. The current visual direction is an industrial RTS battlefield / mining platform / industrial mineral wasteland.

This pivot happened after:

```text
PR #119 — TERRAIN-02A 256x128 terrain integration (sand pipeline, merged)
PR #120 — MAPLIFE decor (visually rejected, not merged)
VISUAL-ROADMAP-01 — Archive old roadmap and add VISUAL_ROADMAP.md
VISUAL-AUDIT-01 — Full visual system audit and implementation plan
VISUAL-01 — Industrial map visual candidates, Candidate A selected
VISUAL-01B — Layered Platform Frame Direction checkpoint
VISUAL-02A — Dev-only layered platform preview, merged
VISUAL-02B — Exact 2:1 frame geometry proof, merged
VISUAL-02C — Static PNG tilefill/frame art proof, closed/rejected
```

---

## Current Phaser version

```text
4.1.0
```

Always confirm this in `package.json` before planning Phaser API work.

---

## Key decisions

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
- **Start position**: lower-left start zone (VISUAL-05A PR 4).
- **Target production map sizes**: 96×96 (small), 128×128 (medium), 192×192 (large) — deferred migration; current production small is still 32×32 until a separate scoped task/PR sequence changes map dimensions.
- **Frame border**: 1 tile around playable area (visual only, not in logical grid).
- **HUD target**: bottom bar — minimap left, info center, commands right.
- **Menu**: preserve cinematic central composition, update background to industrial.

---

## Current source-of-truth docs

Read these before any task:

```text
docs/project/VISUAL_ROADMAP.md
docs/project/VISUAL_SYSTEM_AUDIT.md
docs/project/VISUAL_CANDIDATE_SUMMARY.md
docs/project/VISUAL_01B_LAYERED_PLATFORM_FRAME.md
docs/project/VISUAL_05A_PRODUCTION_INDUSTRIAL_MAP_INTEGRATION_PLAN.md
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
VISUAL_05A_PRODUCTION_INDUSTRIAL_MAP_INTEGRATION_PLAN.md records the production integration plan with PR sequence.
Implementation tasks covered by the audit can proceed without a new mini-audit if they do not expand scope.
If a task expands scope, touches gameplay/pathfinding/economy unexpectedly, or combines multiple phases, stop and request approval.
```

---

## Active next work

```text
VISUAL-06 — Resource field visual model design
```

Alternative:

```text
Post-VISUAL-05A QA polish backlog
```

Reason:

```text
VISUAL-05A production industrial map integration is complete.
All five PRs in the VISUAL-05A sequence are merged.
The industrial generated map is now the default for new games.

Next logical step is VISUAL-06 (resource field visual model design),
or a QA polish pass to address any remaining visual integration issues.
```

---

## Completed VISUAL work

```text
VISUAL-00 — Docs reset / visual roadmap direction — done
VISUAL-AUDIT-01 — Full visual audit/design — done
VISUAL-01 — Industrial map visual candidates — done / PR #125 merged
VISUAL-01B — Layered Platform Frame checkpoint — done / PR #127 merged
VISUAL-01C — Tile visual balancing proof — done / PR #128 merged
VISUAL-02A — Layered Platform Frame Prototype — done / PR #129 merged
VISUAL-02B — Production Frame Geometry Proof — done / PR #130 merged
VISUAL-02C — Final static frame art proof — closed/rejected / PR #131 not merged
VISUAL-03A — Runtime modular frame preview (?visual03a) — done / merged
VISUAL-04A — Modular frame placeholder (?visual04a) — done / merged
VISUAL-04B — Procedural wall polish — done / merged
VISUAL-04D — Single PNG frame top block — done / PR #139 merged
VISUAL-04F — Single PNG wall face block — done / PR #142 merged
VISUAL-05A PR1 — Parameterize dev preview 96/128/192 — done / PR #144 merged
VISUAL-05A PR2 — Production terrain behind mapStyle flag — done / PR #145 merged
VISUAL-05A PR3 — Production frame/background layer — done / PR #146 merged
VISUAL-05A PR4 — Lower-left HQ/camera/resource composition — done / PR #147 merged
VISUAL-05A PR5 — Make industrial generated map default for new games — done / PR #148 merged
```

VISUAL-05A production industrial map integration is complete. All five PRs merged.

VISUAL-05A completion status:

```text
- VISUAL-05A production industrial map integration is COMPLETE.
- PR #144, #145, #146, #147, #148 are all merged/done.
- Industrial generated map is now the default for new games.
- mapStyle 'industrial' and 'sand' both remain available.
- Sand/fixed/custom map paths remain as fallback/reference, not active primary direction.
- HQ/start/resources are now lower-left for industrial generated maps.
- Frame/background/walls are connected in production for industrial.
- Save/load compatibility is preserved: old saves load as saved.
```

Production map size note:

```text
Current production small map is still 32×32.
The 96×96 / 128×128 / 192×192 production size migration is deferred
and must be handled as a separate scoped task/PR sequence.
Do NOT silently change map dimensions without an explicit task.
```

VISUAL-02C rejection note:

```text
Static PNG proof was not a reliable way to validate the final composition.
The correct next implementation direction is runtime layering with mask/clip, not more merged proof PNG attempts.
```

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

Still needed, not yet started, and can proceed in parallel only where they do not conflict:

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
- production terrain replacement before dev-only proof
- gameplay/pathfinding/economy changes inside VISUAL runtime prototype PRs
- using PR #131 / VISUAL-02C static proof as approved production art
- production map size migration (96/128/192) without separate scoped task
- silently changing map dimensions from current 32/48/64
```

---

## Archived docs

The following documents are archived, read as historical reference only:

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
