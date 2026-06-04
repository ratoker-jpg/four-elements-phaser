# PROJECT_STATE.md

Status: operational project state  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Updated: 2026-06-04

---

## Current mode

```text
NO ACTIVE IMPLEMENTATION ROADMAP.
CORE MECHANICS ROADMAP: CLOSED / IMPLEMENTED.
NO NEW CODE WITHOUT A NEW ACCEPTED ROADMAP/AUDIT.
```

Closed / accepted cycles:

```text
VISUAL/UI roadmap slice: CLOSED.
BLOCKOUT-MVP roadmap slice: CLOSED.
CAMERA-00 projection contract: IMPLEMENTED / ACCEPTED.
PROJECTION-01 ground-plane retrofit: IMPLEMENTED / ACCEPTED.
Arena Sandbox roadmap/audit cycle: CLOSED after PR #184.
Core Mechanics roadmap/audit cycle: CLOSED after PR #207.
```

Current default action:

```text
Choose the next product direction and create a new roadmap audit before implementation.
```

---

## Current Phaser version

```text
4.1.0
```

Always confirm this in `package.json` before planning Phaser API work.

---

## Current source-of-truth docs

Read these before doing project work:

```text
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/GPT_WORKFLOW.md
docs/project/GLM_EXECUTOR_RULES.md
docs/project/CAMERA_PROJECTION_CONTRACT.md
docs/project/ARENA_SANDBOX_CLOSURE_REPORT.md
docs/project/CORE_MECHANICS_CLOSURE_REPORT_2026_06_04.md
```

Closed roadmap/audit references:

```text
docs/project/VISUAL_ROADMAP.md
docs/project/VISUAL_SYSTEM_AUDIT.md
docs/project/BLOCKOUT_MVP_ROADMAP.md
docs/project/BLOCKOUT_MVP_CLOSURE_REPORT.md
docs/project/ARENA_SANDBOX_ROADMAP.md
docs/project/ARENA_SANDBOX_SYSTEM_AUDIT.md
docs/project/CORE_MECHANICS_ROADMAP_2026_06_03.md
docs/project/CORE_MECHANICS_SYSTEM_AUDIT_2026_06_03.md
docs/project/MECHANICS_DECISIONS_2026_06_03.md
```

Closed docs are references, not active implementation queues.

---

## Current owner-facing state

The project currently has:

```text
- industrial generated map as default for new games
- mapStyle industrial/sand preserved where needed for fallback/reference
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
- projection contract for fixed isometric/axonometric 2.5D camera
- ground-plane retrofit for selection/hover/range/marker/shadow style blockout visuals
- standalone Arena mode
- ArenaMenu as primary Arena UX
- manual Arena unit creation: body + weapon + team
- projected click placement through CAMERA_PROJECTION_CONTRACT.md
- Arena ally/enemy model
- ally controllable, enemy target-only
- target-lock turret behavior in Arena
- Arena roster/control panel/help/status messages
- simple Arena enemy behavior modes: passive, stationary_shooter, chaser, hold_position
- Russian-facing UX/config baseline for core mechanics
- 6-class industrial resource model with deterministic generated placement anchors
- gameplay-ready core buildings and core economy loop
- unified RTS controls: LMB select/inspect, RMB command, S stop, Esc priority, MMB/arrow camera
- grid/tile movement with occupancy, reservation, no overlap, physical turns, acceleration/braking
- runtime isometric depth sorting for units/buildings/construction/HQ
- target-lock combat core with projected hit model, stopDistance, aim forgiveness, point-blank assist, cone/splash/direct hit logic
- accepted weapon runtime mechanics for 10 weapons, excluding Shaft
- body armor/damage reduction, body/weapon M0-M3 runtime scaling, mass-dependent recoil
- minimal weapon runtime feedback/state display and track-animation hook
```

---

## Core Mechanics closure baseline

Core Mechanics implementation is closed after PR #207.

Closed sequence:

```text
STEP 01H+ — UI / Localization / Start Flow / Faction Display
STEP 02H+ — Config and Data Model Foundation
STEP 03H+ — Industrial Map and Resource Layout
STEP 04H+ — Buildings and Core Economy Loop
STEP 05H+ — Unified RTS Controls and Command Routing
STEP 06H+ — Movement / Occupancy / Depth Sorting
STEP 07H+ — Combat Core / Targeting / Hit Model
STEP 08H+ — Weapons / Bodies / M0-M3 / Animation Feel
```

Closure report:

```text
docs/project/CORE_MECHANICS_CLOSURE_REPORT_2026_06_04.md
```

Important: Core Mechanics is closed as an implementation roadmap, not as a claim that the game is final. Next work should start from a new direction/audit.

---

## Arena baseline after closure

Arena is now a standalone combat sandbox and a validation environment for the core combat/movement model.

It has:

```text
- no HQ/base
- no harvesters
- no resource nodes
- no economy HUD
- no production HUD
- no gameplay obstacles unless explicitly placed by current mode/tools
- no DevTools dependency as primary UX
- unit creation by explicit body + weapon + team selection
- AI mode selection for newly placed enemies
- click placement using unprojectScreenToGround()
- projected ground-plane placement marker
- target-lock firing rules
- runtime weapon resources and weapon-specific mechanics
- real VFX/damage path for AI and player target-lock weapons
```

Arena intentionally does not have:

```text
- save/load setups
- JSON import/export
- attack waves
- strategic/economy/base-building AI
- final combat balance
- final art
```

Closure report:

```text
docs/project/ARENA_SANDBOX_CLOSURE_REPORT.md
```

---

## Projection contract baseline

All visual/world-space/rendering/asset work must use:

```text
docs/project/CAMERA_PROJECTION_CONTRACT.md
```

Non-negotiables:

```text
- fixed isometric / axonometric 2.5D camera
- not top-down
- not side-view
- pan + zoom allowed
- camera rotation forbidden
- projection formula: screen = origin + x*basisX + y*basisY + z*basisZ
- ground markers/rings/shadows/ranges/footprints must be projected onto ground plane
- no top-down screen circles for ground-space concepts
```

---

## Active next work

```text
No active implementation roadmap.
```

Allowed next work:

```text
- manual QA of the closed Core Mechanics cycle
- docs cleanup
- next roadmap/audit planning
- review of existing open PRs, if any
```

Recommended next planning options:

```text
1. Core Mechanics manual QA + polish/fix backlog audit.
2. Normal Game player loop roadmap: onboarding, goals, victory/loss, progression.
3. Production visual/world-space roadmap using CAMERA_PROJECTION_CONTRACT.md.
4. Final asset integration roadmap for units/buildings/tanks.
5. Arena combat balance/readability roadmap.
```

---

## Stop rules

Do not start implementation if:

```text
- there is no accepted roadmap/audit for the requested direction
- the task continues a closed roadmap by inertia
- docs contradict the current repo state
- visual/world-space work ignores CAMERA_PROJECTION_CONTRACT.md
- task asks for Arena save/load/waves/strategic AI without new roadmap/audit
- task asks for final assets without accepted asset/integration plan
```

---

## Working model

```text
idea -> GPT checks fit -> roadmap -> huge/system audit -> High+/High PR sequence -> GLM implementation PR -> GPT review -> Denis merge -> docs update
```

GLM is executor, not planner. GPT coordinates, writes tasks, reviews PRs and keeps docs current.
