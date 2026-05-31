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
- **Production map sizes**: 96×96 (small), 128×128 (medium), 192×192 (large).
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
VISUAL-05A PR 3 — Production frame/background layer
```

Reason:

```text
VISUAL-05A PR 2 (#145) added industrial terrain behind mapStyle flag. Now we
need the visual frame border and background/world layer for industrial maps.

VISUAL-05A PR 3 adds:
- IndustrialFrameRenderer for frame top blocks, wall face blocks, background
- Background/world image layer beneath the arena
- Frame top surfaces using frame_top_block.png
- Wall face blocks using frame_wall_face_block_left.png with mirroring and tint
- Extended camera bounds to show frame and margin
- Frame is visual-only — no pathfinding/occupancy/save format changes
- Only active when mapStyle === 'industrial'
```

Production map sizes:

```text
Small:  96×96 playable,  98×98 outer (with 1-tile frame border)
Medium: 128×128 playable, 130×130 outer
Large:  192×192 playable, 194×194 outer
```

Key integration steps (see VISUAL_05A doc for full PR sequence):

```text
PR 1 — Parameterize dev preview to 96/128/192 and camera pan/zoom
PR 2 — Production terrain/platform assets behind mapStyle flag
PR 3 — Production frame/background layer
PR 4 — Lower-left HQ/camera/resource composition
PR 5 — Make industrial map default for new games after QA
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
