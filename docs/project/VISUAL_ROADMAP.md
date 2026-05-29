# VISUAL ROADMAP — Four Elements Phaser

Status: **Accepted planning direction.** Implementation requires separate audit/design PR first.
Project: Four Elements Phaser
Active repo: `ratoker-jpg/four-elements-phaser`
Phaser version: 4.1.0
Date: 2026-05-30

---

## 1. Purpose

This document defines the new visual direction for Four Elements Phaser. It replaces the previous sand-terrain-focused Phase 2 roadmap as the active planning direction. The previous roadmap documents (`PHASE_2_ROADMAP.md`, `PHASE_2_ROADMAP_AUDIT.md`, `TERRAIN_02_QUALITY_AUDIT_AND_PIPELINE.md`, `MAPLIFE_01_ASSET_READINESS.md`) are archived and should be read only as historical reference.

The current visual state of the game does not meet the quality bar for a real RTS prototype. Sand terrain, MAPLIFE auto-generated decor, and the current map presentation are not acceptable. This roadmap establishes a new visual direction before any further visual implementation work proceeds.

---

## 2. Goal

Bring the game visuals to a real RTS quality bar across all visual layers:

- map visual style — the terrain/platform surface the game is played on
- terrain/platform style — how the ground reads, not as a grid of diamond tiles but as a grounded surface
- map frame / grounded presentation — the map should feel placed on a world, not floating in empty space
- resource field visuals — harvestable resources should match the new industrial biome
- environment assets — props, details, atmospheric elements appropriate for an industrial battlefield
- harvester/builder visual refresh — civil units should match the new visual direction
- menu visual style — main menu composition with cinematic feel
- HUD / command panel / selection info / minimap — StarCraft-inspired RTS interface layout
- visual interaction feedback — selection, hover, commands, production feedback

---

## 3. Core decisions

These decisions are accepted as the planning direction. Each implementation phase may refine details, but the core direction must not be silently changed without updating this document.

### 3.1 One strong primary biome first

Do not build four biomes now. Build one biome that is visually strong, readable, and complete. Additional biomes are a future concern, not a current task.

### 3.2 Stop treating sand as mandatory

Sand was the first biome attempted. It did not meet the quality bar. The sand terrain direction is paused/rejected as the primary visual direction. Sand assets and code may remain in the repository as fallback or reference, but no further sand-focused visual work should be prioritized until the primary biome is established.

### 3.3 New primary direction: industrial RTS battlefield / mining platform / industrial mineral wasteland

The game map should feel like a grounded industrial platform or battlefield surface — not tiles floating in empty space. The visual language should evoke a functional industrial mining operation: metal platforms, concrete surfaces, mineral deposits, industrial structures, worn machinery areas, and strategic zones marked by human/industrial activity. This is a deliberate pivot away from natural desert terrain toward a constructed, industrial environment that reads as a real RTS map.

### 3.4 Grounded map presentation

The playable area should have irregular/organic industrial edges, not a perfect clean rectangle or diamond. The map should visually sit on a larger non-playable world, surface, or background. The player should feel that the battlefield is a zone within a larger world, not a detached puzzle board. This means the map needs an outer visual frame — terrain, environment, or background that extends beyond the playable grid and gives the map spatial context.

### 3.5 StarCraft as visual/system reference

StarCraft is the reference for industrial terrain readability, grounded map presentation, RTS HUD layout, command panel structure, and minimap placement. This does not mean copying StarCraft assets or exact UI. It means learning from how StarCraft achieves: (a) terrain that reads as a surface rather than a grid, (b) maps that feel like places rather than boards, (c) HUD that is functional, game-like, and not web-demo-like, (d) command panel that is context-sensitive and readable, (e) minimap that provides real-time strategic overview.

### 3.6 Sand terrain is paused/rejected

The current sand terrain direction (TERRAIN-01, TERRAIN-02, TERRAIN-FIX-01) produced results that do not meet the quality bar. The sand-terrain pipeline may remain as a technical foundation, but the primary visual direction is now industrial, not desert. Future terrain work should target the industrial biome.

### 3.7 PR #120 MAPLIFE decor is rejected

PR #120 MAPLIFE auto-generated decor was visually rejected after QA. The MAPLIFE-01 direction as originally scoped (desert props, bushes, rocks) must not be continued. Environment assets in the new visual roadmap should match the industrial biome direction, not the desert aesthetic.

### 3.8 Start position: lower-left start zone

The player start position should move to the lower-left start zone. This is a composition and camera decision that supports the new map layout and player orientation.

### 3.9 Resource field reconsideration

Resource fields should be reconsidered after the map style is approved. Current resource node visuals (mineral crystals) may need to change to match the industrial biome aesthetic. The 1x1 resource node model is preferred over larger multi-tile nodes, with resource fields composed of groups of 1x1 nodes.

### 3.10 Harvester and Builder visual refresh

Harvester and Builder visuals should be refreshed later to match the industrial biome. This is not an immediate task — it comes after the map and terrain direction is established — but it is part of the overall visual roadmap.

### 3.11 Existing combat 3D assets preserved

Existing tank/Wasp combat 3D assets should not be restyled in this roadmap unless a later separate task explicitly decides otherwise. The visual roadmap focuses on terrain, map, UI, and civil unit presentation. Combat unit visual changes are out of scope unless separately approved.

### 3.12 Main menu: preserve successful composition, update background art

The main menu should preserve the older successful composition: cinematic background plus central panel plus warm bronze/gold buttons. The background art should be replaced later to match the new industrial biome. The menu structure and interaction model are good; only the visual theme needs updating.

### 3.13 HUD target: StarCraft-inspired RTS layout

The target HUD layout is:

- bottom-left: minimap
- bottom-center: selected unit/building info
- bottom-right: command/actions/production/hotkeys
- overall style: warm industrial sci-fi
- readable, game-like, not web-demo-like

This is a significant redesign from the current top-right sidebar PlaytestHud. The HUD should feel like a real RTS game interface, not a debug panel.

---

## 4. Roadmap phases

### Phase V0 — Documentation reset

Status: **This PR (VISUAL-ROADMAP-01)**

Actions:

- Archive old active roadmap documents (PHASE_2_ROADMAP.md, PHASE_2_ROADMAP_AUDIT.md, PHASE_2_ROADMAP_AUDIT_PROMPT.md, TERRAIN_02_QUALITY_AUDIT_AND_PIPELINE.md, MAPLIFE_01_ASSET_READINESS.md)
- Add VISUAL_ROADMAP.md
- Update project state and current next step documents

Deliverable: Docs-only PR. No runtime changes. No assets. No implementation.

---

### Phase V1 — Visual audit/design

Task ID: `VISUAL-AUDIT-01`

Status: **Next implementation step after this PR is merged**

Goal: Audit the current renderer, UI, and assets. Determine what Phaser 4 can support. Determine which work is asset pipeline, which is renderer, and which is UI layout. Produce an implementation sequence with specific PR breakdown.

The audit must answer:

1. What is the current visual state of each layer (terrain, map frame, resources, units, buildings, HUD, menu)?
2. Which Phaser 4 rendering capabilities can support the industrial biome target?
3. What is the asset pipeline for the new industrial terrain/platform?
4. What renderer changes are needed (if any) beyond the current RenderTexture stamp model?
5. How should the map frame / grounded presentation be implemented?
6. How should the HUD be redesigned to the target layout?
7. What is the exact implementation sequence for the remaining phases (V2–V9)?
8. What are the risks and stop conditions for each phase?

Deliverable: `docs/project/VISUAL_AUDIT_01.md` — audit/design document only, no runtime changes.

Hard rules:

- Do not implement during the audit
- Do not generate assets during the audit
- Do not change runtime code during the audit
- The audit may reference existing spike reports (PHASER4_GPU_01, PHASER4_LOAD_01, VISUAL_SPIKE_01) but must not assume their conclusions are still valid without re-verification

---

### Phase V2 — Map direction prototype

Task ID: `VISUAL-PROTO-01`

Goal: Produce 2–3 static visual candidates for the industrial map ground/platform. These are visual mockups — not runtime integration. One visual direction must be approved by the project owner before any runtime work begins.

Possible approaches:

- Rendered mockups in image editing software
- Static HTML/Canvas prototypes
- Single-scene Phaser test with placeholder assets
- Reference images from comparable games

Deliverable: Visual candidates for review. No runtime integration until one direction is approved.

Hard rules:

- No runtime integration until visual direction is approved
- Do not modify the existing terrain renderer until the direction is approved
- Do not remove current sand assets until replacement assets are ready

---

### Phase V3 — Terrain/platform integration

Task ID: `VISUAL-TERRAIN-01`

Goal: Integrate the approved map surface into the runtime. Remove the cheap sand look. Avoid visible chessboard/grid patterns. Keep gameplay unchanged.

This phase is implementation — it requires the audit (V1) and approved visual direction (V2) to be complete first.

Scope (to be refined by audit):

- Replace terrain asset family with approved industrial platform assets
- Update terrain renderer if needed (preserve RenderTexture stamp model if possible)
- Update map generator for industrial terrain types
- Ensure no visible grid/chessboard
- Preserve pathfinding, occupancy, and logical map structure
- Preserve camera system

Hard rules:

- Do not change gameplay
- Do not change pathfinding
- Do not change the isometric coordinate system
- Do not break save/load compatibility

---

### Phase V4 — Map frame / grounded presentation

Task ID: `VISUAL-FRAME-01`

Goal: Add non-playable outer visual layer/background. The map should feel placed on a world/surface. No height gameplay yet — this is purely visual.

The outer frame can be:

- Extended terrain rendering beyond the playable grid
- Background image or parallax layer
- Environmental decoration at map edges
- Irregular/organic edge shaping to break the rectangular grid boundary

Hard rules:

- No height gameplay
- No pathfinding changes for non-playable areas
- The playable grid must remain the same logical structure

---

### Phase V5 — Start position and map composition

Task ID: `VISUAL-START-01`

Goal: Move player start/HQ to lower-left start zone. Adjust camera start. Rework starting resource composition after visual map direction is accepted.

Scope:

- Move default player start position to lower-left
- Adjust camera initial position
- Rework starting resource placement to match new map layout
- Verify economy loop still works after position change

Hard rules:

- Do not change economy values without explicit approval
- Do not break save/load compatibility for existing saves
- Verify all game systems still function after position change

---

### Phase V6 — Resource field visual refresh

Task ID: `VISUAL-RESOURCE-01`

Goal: Update resource node visuals to match the new industrial map style. 1x1 resource node model preferred. Resource fields are groups of 1x1 nodes. Visual style must match the industrial biome.

Scope:

- Replace resource node sprites with industrial-themed assets
- Update resource field placement and composition
- Fix depleted resource occupancy issues (carry over from RESOURCE-01)
- Ensure resource visuals integrate with the new terrain/platform

Hard rules:

- Do not change resource amounts or economy values without explicit approval
- Do not change resource gameplay mechanics
- Depleted cells must be freed for movement/occupancy

---

### Phase V7 — UI/HUD visual redesign

Task ID: `VISUAL-HUD-01`

Goal: StarCraft-inspired RTS layout — minimap left, selected-object panel center, commands right. Warm bronze/industrial style. Improve hover, states, readability, and hotkey display.

Target layout:

```
+---------------------------------------------------+
|                                                     |
|                  GAME VIEWPORT                      |
|                                                     |
|                                                     |
+----------+-------------------+---------------------+
| MINIMAP  | SELECTED UNIT/    | COMMAND/ACTIONS/    |
|          | BUILDING INFO     | PRODUCTION/HOTKEYS  |
+----------+-------------------+---------------------+
```

Scope:

- Replace top-right sidebar PlaytestHud with bottom bar layout
- Add minimap component (bottom-left)
- Add selected object info panel (bottom-center)
- Add command/action panel (bottom-right)
- Apply warm industrial sci-fi visual style
- Add hotkey labels on command buttons
- Improve hover and selection states
- Consolidate legacy HUD into the new layout

Hard rules:

- Do not break existing hotkey functionality during migration
- Do not remove game functionality — only reorganize the visual layout
- Preserve URL shortcuts for dev/arena modes
- The HUD must be functional, not just visual — all current interactions must work

---

### Phase V8 — Main menu visual refresh

Task ID: `VISUAL-MENU-01`

Goal: Preserve old successful central menu composition. Replace background art with new industrial world art. Keep warm cinematic tone.

Scope:

- Update main menu background to match industrial biome
- Verify menu composition still works (central panel, bronze/gold buttons)
- Update loading screen styling if needed for consistency
- Ensure menu flow still works (Standard/Debug/Arena selection)

Hard rules:

- Do not redesign menu layout — only update visual theme
- Do not break menu mode selection functionality
- Preserve URL shortcuts for smoke/dev

---

### Phase V9 — Unit/building visual cleanup

Task ID: `VISUAL-UNITS-01`

Goal: Harvester and Builder visual refresh to match the industrial biome. Do not restyle ready combat 3D assets by default.

Scope:

- Regenerate harvester spritesheets in industrial visual style
- Regenerate builder spritesheets in industrial visual style
- Update building sprites if needed to match industrial environment
- Do not change Wasp/Smoky combat assets unless a later separate task decides otherwise

Hard rules:

- Follow ASSET-WORKFLOW-01 conventions for all sprite generation
- Do not change gameplay behavior
- Do not change pathfinding
- Combat unit restyling requires separate explicit approval

---

## 5. Non-goals

These are explicitly not part of this visual roadmap:

- **No four-biome system now.** One primary biome first. Additional biomes are future work.
- **No StarCraft asset copying.** StarCraft is a visual/system reference only. Do not copy assets, exact UI, or copyrighted material.
- **No gameplay economy changes in VISUAL roadmap PRs.** Visual changes must not alter economy values, resource amounts, or production rates unless explicitly approved by the project owner.
- **No pathfinding changes in VISUAL roadmap PRs.** Visual improvements must preserve the existing pathfinding and occupancy systems.
- **No MAPLIFE #120 continuation.** The MAPLIFE-01 desert decor direction is rejected. Environment assets in this roadmap must follow the industrial biome direction.
- **No mass image generation in docs PRs.** This PR is documentation only. Image generation happens in implementation PRs.
- **No runtime implementation in this docs PR.** This PR changes documentation only.

---

## 6. Acceptance criteria

This PR (VISUAL-ROADMAP-01) is accepted when:

- [ ] Active docs point to `VISUAL_ROADMAP.md` as the next planning direction
- [ ] Old roadmap is archived/deprecated, not presented as active
- [ ] `CURRENT_NEXT_STEP.md` says the next step is `VISUAL-AUDIT-01`
- [ ] No runtime files changed
- [ ] No assets changed
- [ ] No implementation started

---

## 7. Relationship to previous work

### Completed foundation from Phase 2

These Phase 2 tasks are already merged. They remain useful foundation for VISUAL phases but are not pending work:

- **MENU-01 (#100) / MENU-02 (#105)**: Main menu mode selection — done, styling will update in VISUAL Phase V8
- **LOADING-01 (#101)**: Proper loading screen — done, styling will follow new industrial direction
- **BASE-ANCHOR-01 (#104)**: HQ/building grounding — done, visual integration will match new biome in V3
- **ASSET-WORKFLOW-01 (#106)**: Animated unit asset pipeline — done, will produce industrial-styled units in V9
- **HOTKEYS-01 (#111)**: Command registry / hotkey system — done, will integrate with new HUD in V7
- **HUD-01 (#102)**: Legacy HUD removal — done, new HUD layout deferred to V7
- **BUILDER-ID (#109)**: Builder stable IDs — done, prerequisite for unit animation work
- **RESOURCE-01 (#108)**: Depleted resource ghost occupancy fix — done, visual refresh deferred to V6
- **WEAPON-WORKFLOW-01 (#114)**: Weapon VFX / recoil design — done, unchanged
- **TERRAIN-02A (#119)**: 256×128 terrain integration — done, pipeline learnings preserved for V3
- **TERRAIN-FIX-01 (#121)**: Grid seam removal — done, code remains as fallback

Still needed (not yet started):

- **FOG-01**: Two-layer fog of war — can proceed in parallel with VISUAL phases
- **ARENA-01**: Arena mode from menu — can proceed in parallel with VISUAL phases

### What is paused / superseded from Phase 2

- **TERRAIN-01 (#103) / TERRAIN-02 (#118) / TERRAIN-FIX-01 (#121)**: Sand terrain code is merged, but sand as primary visual direction is paused. Terrain visual work resumes as Phase V3 with industrial direction.
- **MAPLIFE-01 (#112)**: Desert decor asset readiness — rejected visual direction. Environment assets will be re-scoped as industrial props in Phase V3/V4.
- **MAPLIFE #120**: Desert decor PR — visually rejected, not merged.

### What is deferred from Phase 2 (until VISUAL audit/design)

- **Resource visual refresh**: RESOURCE-01 (#108) occupancy fix is done; visual refresh deferred to Phase V6 after map style is approved.
- **UNIT-ANIM-01 (#107) / UNIT-ANIM-02**: Unit asset readiness report is done; unit visual regeneration deferred to Phase V9 after industrial biome is established.
- **VISUAL-SPIKE-01 (#113)**: Normal maps / lighting feasibility — remains relevant, timing to be determined by V1 audit.

### What is new in VISUAL roadmap

- Map frame / grounded presentation (Phase V4) — new concept, not in Phase 2
- Start position move to lower-left (Phase V5) — new composition decision
- HUD redesign to StarCraft-inspired layout (Phase V7) — significantly expanded from Phase 2 HUD-01
- Industrial biome direction — fundamentally different from sand

---

## 8. Implementation gate

The VISUAL roadmap is an accepted planning direction, not an implementation authorization. Each phase requires its own audit/design PR before implementation begins, as specified in the phase descriptions above.

The first implementation step is `VISUAL-AUDIT-01` (Phase V1), which will produce the detailed audit/design that authorizes subsequent implementation phases.

Do not start implementation of any VISUAL phase without the corresponding audit/design being accepted.

---

## 9. Read before any VISUAL task

Before working on any VISUAL roadmap task, read:

```text
docs/project/VISUAL_ROADMAP.md
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/GPT_WORKFLOW.md
docs/project/GLM_EXECUTOR_RULES.md
```

Read archived docs only as historical reference:

```text
docs/project/archive/PHASE_2_ROADMAP.md
docs/project/archive/PHASE_2_ROADMAP_AUDIT.md
docs/project/archive/TERRAIN_02_QUALITY_AUDIT_AND_PIPELINE.md
docs/project/archive/MAPLIFE_01_ASSET_READINESS.md
```
