# AoE4-Inspired UX Redesign Roadmap — Four Elements Phaser

Status: **Design/roadmap document — docs only, no runtime changes**
Project: Four Elements Phaser
Active repo: `ratoker-jpg/four-elements-phaser`
Phaser version: 4.1.0
Date: 2026-06-20

---

## 0. Purpose and decision context

Denis rejected the current HUD/command panel/minimap direction (PRs #308–#310) visually and UX-wise. The current implementation is treated as a **technical prototype**, not an accepted final UX direction.

This document replaces the "continue integrating existing HUD" plan. It rebuilds the Visual Roadmap around **Age of Empires IV-like RTS UX principles**, adapted for Four Elements — not cloned from AoE4.

**Important:**
- AoE4 is used **only as a UX reference** for interaction patterns, not as a visual design source.
- Do NOT copy AoE4 assets, icons, textures, fonts, sounds, exact layout dimensions, terminology, or proprietary files.
- Do NOT decompile or inspect protected AoE4 binaries.
- PRs #308–#310 remain in the codebase as technical scaffolding. They are not the final UX.

---

## A. Current implementation rejection analysis

### A.1 What exists now (PRs #308–#310)

| Component | File(s) | What it does |
|-----------|---------|--------------|
| **VisualHudCore** | `src/phaser/ui/hud/VisualHudCore.ts` | Bottom bar container composing minimap, selection, command, and resource panels |
| **HudCommandPanel** | `src/phaser/ui/hud/HudCommandPanel.ts` | 3-column button grid; context-sensitive commands; descriptorMap for fresh click state; aria-disabled + CSS |
| **commandPanelViewModel** | `src/phaser/ui/hud/commandPanelViewModel.ts` | Pure function: selection → command descriptors (builder→6 build, harvester→stop, none→empty) |
| **HudSelectionPanel** | `src/phaser/ui/hud/HudSelectionPanel.ts` | Name, kind, faction, HP bar, status text |
| **selectionViewModel** | `src/phaser/ui/hud/selectionViewModel.ts` | Pure function: selection → display data |
| **HudResourceStrip** | `src/phaser/ui/hud/HudResourceStrip.ts` | Raw/Matter/Elements/Power/Units readout, 30px tall, full width |
| **HudMinimap** | `src/phaser/ui/hud/HudMinimap.ts` | Canvas 2D minimap, 200×150, entity markers, camera viewport rect, pointer event isolation |
| **minimapViewModel** | `src/phaser/ui/hud/minimapViewModel.ts` | Pure function: tile coords → minimap coords; 4-corner viewport conversion via screenToTile(); entity markers |
| **hudLayout** | `src/phaser/ui/hud/hudLayout.ts` | Constants: HUD_BAR_HEIGHT=180, minimap 200×150, resource strip 30; shouldUseBottomHudSafeArea(), isScreenPointInHud() |
| **PlaytestHud** | `src/phaser/ui/PlaytestHud.ts` | Legacy bottom-center ~700px panel: economy, build/produce buttons, factory queue, harvester status, unit count |
| **GameInputController** | `src/phaser/input/GameInputController.ts` | LMB=select, RMB=command, S=stop, ESC=priority chain, cursor feedback, HUD pointer guard |
| **commandRegistry** | `src/state/commandRegistry.ts` | Singleton command definitions with hotkeys; execute() wiring |
| **commandRouter** | `src/state/commandRouter.ts` | Pure routing: LMB/RMB/S/ESC → action results |

### A.2 Why it is not enough as final UX

1. **No stable command surface.** The command panel is a flat list of 3-column buttons that changes completely when selection changes. There is no grid stability — a builder shows 6 build commands, a harvester shows 1 stop command, and no selection shows nothing. An AoE4-like command card has a stable grid where the same slot position always means the same category of action, even when the content changes.

2. **Hotkey badges are afterthoughts.** Hotkeys are shown as `[B]` text after button labels. They are not prominently visible, not grid-aligned with the command card, and do not follow a logical spatial pattern. In AoE4, hotkeys are large badges in the corner of each command card slot, spatially corresponding to the keyboard row (Q/W/E/R top row, A/S/D/F middle row, Z/X/C/V bottom row).

3. **Number keys are overloaded.** `1`/`2`/`3` are currently mapped to `build-raw-storage`, `build-matter-storage`, `build-element-storage`. This directly conflicts with the universal RTS convention of using number keys for control groups. AoE4 and most RTS games reserve `1`–`9` for control group recall. This conflict must be resolved before control groups can be added.

4. **Minimap is passive decoration.** The current minimap renders entity dots and a camera viewport rectangle but has zero interactivity. You cannot click to move the camera, drag to pan, or use it for strategic navigation. In AoE4, the minimap is a primary navigation and awareness tool.

5. **Selection panel is text-only and shallow.** The selection panel shows name, kind, faction, HP bar, and a status word. There is no unit portrait, no production queue preview, no multi-selection summary, no idle-worker indicator, no building construction progress. AoE4 shows a rich selection panel with icon, name, HP, active production queue, and context.

6. **No feedback/alert system.** There is no toast/notification lane for "insufficient resources", "building complete", "unit trained", "idle worker", or "under attack". The only feedback is the PlaytestHud status line and the FeedbackRenderer diamonds. AoE4 uses a status/toast lane and audible/visual alerts.

7. **PlaytestHud still coexists.** The old PlaytestHud is still active in Normal Game mode, showing duplicate economy data, build buttons, and production buttons alongside the new bottom HUD. This creates visual noise and conflicting interaction surfaces.

8. **Layout feels prototype/debug-like.** The bottom bar uses generic Segoe UI fonts, flat dark background, minimal visual hierarchy, and no industrial/RTS aesthetic. It reads as a debug panel, not a game interface.

9. **No fog/vision layer.** The minimap and game view show everything. There is no unexplored/explored/visible distinction, no fog-of-war. AoE4 treats fog/vision as a core strategic layer that affects both the main view and the minimap.

10. **No control groups.** There is no way to assign units to number-key groups for quick recall. This is a fundamental RTS UX feature that AoE4 supports from the start.

### A.3 What should not be polished further until redesign is accepted

- The command panel button styling and layout (3-column flat grid)
- The minimap rendering (passive canvas-only, no interaction)
- The selection panel text layout
- The resource strip styling
- The HUD bar background/border styling
- Any integration that locks in the current layout proportions or slot positions

These should be treated as frozen prototype — functional but not final.

---

## B. AoE4-like target UX principles for Four Elements

### B.1 Principles we adopt

| # | Principle | Description |
|---|-----------|-------------|
| P1 | **One stable bottom command surface** | The bottom bar is the single player-facing HUD surface. It is always present, always in the same position, and its structure does not change between selection contexts. Individual slots may show different content, but the grid structure is stable. |
| P2 | **No fake active buttons** | Every button on the command card corresponds to a real action the player can take. Disabled buttons exist (and show why they are disabled), but there are no placeholder or decorative buttons that look interactive but do nothing. Empty slots are visually empty or show a subtle grid pattern, not fake buttons. |
| P3 | **Command card with stable grid slots** | The command card is a fixed grid (e.g., 3×4 or 4×3). Each slot position has a consistent semantic meaning: top-left is always the first unit action, top-right is always the last, bottom row is always "utility" actions. When the selection context changes, the content of each slot changes, but the grid position meaning stays consistent. |
| P4 | **Hotkey badges always visible** | Every command card slot shows its hotkey as a prominent badge in the corner. Hotkeys follow a spatial keyboard layout (Q/W/E/R for top row, A/S/D/F for middle, Z/X/C/V for bottom). The player can learn hotkeys by looking at the card. |
| P5 | **Disabled reasons are clear** | When a command is disabled, hovering shows the specific reason (e.g., "Insufficient matter — need 60, have 42", "No idle builder", "Requires Units Factory"). The tooltip is the source of truth for why the player cannot take the action. |
| P6 | **Minimap as navigation/control tool** | The minimap is not a decoration. It is an interactive tool: click to move camera, drag to pan, and it always reflects the current game state. It is the player's primary strategic awareness surface. |
| P7 | **Selection context drives command card** | The command card content is derived from what is selected. No selection → general/info card. Builder → build commands. Building → production/upgrade. Multi-select → group actions. The card always shows the most relevant actions for the current context. |
| P8 | **Control groups use number keys** | `1`–`9` are reserved for control group recall. `Ctrl+1`–`Ctrl+9` assign groups. Double-tap centers camera on group. This is non-negotiable for RTS UX. Current `1`/`2`/`3` build hotkeys MUST be remapped. |
| P9 | **Camera controls are predictable** | MMB drag = pan. Arrow keys = pan. Scroll wheel = zoom. R = reset to HQ. Camera bounds keep the map in view. No surprises. |
| P10 | **Fog/vision affects both map and minimap** | Unexplored areas are hidden on both the game view and the minimap. Explored-but-not-currently-visible areas show terrain but not units. Currently visible areas show everything. This is a strategic layer, not decoration. |
| P11 | **Feedback/alerts are actionable** | When something happens (building complete, unit trained, resources insufficient, under attack), the player is notified in a way they can act on. Alerts are not just text — they offer click-to-focus or click-to-acknowledge. |

### B.2 What we explicitly do NOT copy from AoE4

| Category | What we do NOT copy |
|----------|-------------------|
| Assets | AoE4 unit/building icons, UI textures, background art, button frames, panel decorations |
| Typography | AoE4 font families, font sizes, text styling |
| Layout dimensions | Exact pixel measurements, panel proportions, button sizes |
| Terminology | AoE4-specific terms (e.g., "Landmark", "Age Up", "Villager") |
| Color scheme | AoE4's specific palette (we use our industrial bronze/teal/dark palette) |
| Sound design | AoE4 alert sounds, UI click sounds, voice-over lines |
| Exact interaction model | AoE4's specific multi-select behavior, specific control group mechanics — we adapt the principle, not the exact implementation |
| Proprietary systems | AoE4's civilization system, age advancement, specific tech trees |

---

## C. Target HUD layout spec

### C.1 Desktop 16:9 layout (1280×720 minimum, 1920×1080 target)

```
+-------------------------------------------------------------------+
| [Resource Strip — top-left corner, horizontal]                      |
|                                                                     |
|                          GAME VIEWPORT                              |
|                       (camera safe-area applies)                    |
|                                                                     |
|                                                                     |
+-------------+---------------------------+---------------------------+
|   MINIMAP   |    SELECTION PANEL        |    COMMAND CARD           |
|   240×180   |    (flex width)           |    4×3 grid              |
|   click/drag|    portrait + HP + status |    hotkey badges visible  |
|   to camera |    + production queue     |    stable slot positions  |
+-------------+---------------------------+---------------------------+
|              STATUS/TOAST LANE (full width, 28px)                   |
+-------------------------------------------------------------------+
```

### C.2 Layout dimensions

| Element | 1280×720 | 1920×1080 | Notes |
|---------|----------|-----------|-------|
| Bottom bar total height | 200px | 220px | Slightly larger on 1080p for readability |
| Minimap slot | 240×180 | 260×195 | Fixed aspect, scales with bar height |
| Selection panel | flex, ~350px | flex, ~500px | Grows with screen width |
| Command card | ~300px (4×3 grid) | ~400px (4×3 grid) | Fixed grid, grows with bar height |
| Resource strip | Top-left corner | Top-left corner | Moved from bottom to top-left; always visible |
| Status/toast lane | 28px, full width | 28px, full width | Below main panels |
| Camera safe-area | canvas.height - bar height | canvas.height - bar height | Main camera viewport excludes bar |

### C.3 Key layout changes from current prototype

1. **Resource strip moves to top-left corner.** Currently at the bottom of the HUD bar. In AoE4, the resource strip is at the top of the screen so it never competes with the command surface. This frees vertical space in the bottom bar.

2. **Minimap grows from 200×150 to 240×180 (minimum).** A larger minimap is more readable and more usable as a click-to-navigate tool. The extra size is justified by moving the resource strip out.

3. **Status/toast lane added at the bottom of the bar.** This is the notification area for "building complete", "insufficient resources", "idle worker", etc.

4. **Command card is a stable 4×3 grid** instead of a fluid 3-column auto-flow grid. This enables hotkey badge spatial mapping.

5. **Selection panel includes production queue preview** when a factory is selected.

### C.4 Camera safe-area behavior

- Main camera viewport height = `canvas.height - BOTTOM_BAR_HEIGHT`
- Camera scroll bounds are clamped so the camera never shows content behind the bar
- `setViewport` is called before `centerOn` (already fixed in PR #308)
- Edge-pan camera when cursor is near screen edges (additive to current keyboard pan)

### C.5 Input safe zones

- Bottom bar: `pointer-events: none` on background, `pointer-events: auto` on interactive children only
- Minimap: click/drag consumed by minimap handler; no click fallthrough to game canvas
- Command card buttons: click consumed; no fallthrough
- Resource strip: read-only (MVP), no pointer consumption
- Status lane: click on alert = focus/acknowledge (future); no fallthrough

---

## D. Command card spec

### D.1 Grid structure

```
     Col 1    Col 2    Col 3    Col 4
Row 1  [Q]     [W]     [E]     [R]
Row 2  [A]     [S]     [D]     [F]
Row 3  [Z]     [X]     [C]     [V]
```

- **Grid size**: 4 columns × 3 rows = 12 slots
- **Each slot** has: icon/label area, hotkey badge (corner), cost display, enabled/disabled state
- **Slot positions are stable** — the same grid position always maps to the same hotkey
- **Empty slots** show a subtle grid pattern, not a fake button

### D.2 Slot content rules by selection context

| Context | Row 1 (Q/W/E/R) | Row 2 (A/S/D/F) | Row 3 (Z/X/C/V) |
|---------|------------------|------------------|------------------|
| **No selection** | Empty | Empty | Z: idle worker find, C: camera reset, V: toggle pause |
| **Builder selected** | Q: Separator, W: Raw Storage, E: Matter Storage, R: Element Storage | A: Power Plant, S: Units Factory, D: (future), F: (future) | Z: Stop, X: (future), C: (future), V: (future) |
| **Harvester selected** | Empty | Empty | Z: Stop |
| **Factory selected** | Q: Train Builder, W: Train Harvester, E: (future), R: (future) | A-X: (upgrades, future) | Z: (cancel), X: (cancel all) |
| **Multi-select** | Context-dependent group commands | | Z: Stop All |

### D.3 Hotkey strategy

**Critical resolution: Number keys are for control groups, NOT build commands.**

Current state (from `commandRegistry.ts`):
- `ONE` → `build-raw-storage`
- `TWO` → `build-matter-storage`
- `THREE` → `build-element-storage`

These MUST be remapped. Proposed mapping:

| Key | Current use | New use |
|-----|-------------|---------|
| `1`–`9` | Build commands (1/2/3) | Control group recall |
| `Ctrl+1`–`Ctrl+9` | — | Assign control group |
| `Q` | — | Command card slot (1,1) |
| `W` | — | Command card slot (1,2) |
| `E` | — | Command card slot (1,3) |
| `R` | Camera reset | Command card slot (1,4) — camera reset moves to `Home` or `Ctrl+R` |
| `A` | — | Command card slot (2,1) |
| `S` | Stop unit | Command card slot (2,2) — stop is now context-dependent in the card |
| `D` | — | Command card slot (2,3) |
| `F` | Build Units Factory | Command card slot (2,4) |
| `Z` | — | Command card slot (3,1) |
| `X` | — | Command card slot (3,2) |
| `C` | — | Command card slot (3,3) |
| `V` | — | Command card slot (3,4) |
| `B` | Build Separator | Replaced by Q in builder context |
| `P` | Build Power Plant | Replaced by A in builder context |
| `N` | Train Builder | Replaced by Q in factory context |
| `G` | Train Harvester | Replaced by W in factory context |
| `Home` or `Ctrl+R` | — | Camera reset (new home for R) |
| `Esc` | Pause/deselect | Unchanged |

**Migration plan:**
1. Phase 1: Add Q/W/E/R/A/S/D/F/Z/X/C/V hotkey definitions to command registry alongside current hotkeys. Both sets work simultaneously during transition.
2. Phase 2: Remove old 1/2/3/B/P/N/G hotkey bindings once the command card is the primary interaction surface.
3. Phase 3: Implement control groups on 1–9 keys.

### D.4 Disabled state rules

- Disabled buttons show: reduced opacity (0.4–0.5), distinct border color, `aria-disabled="true"` + CSS
- Hovering a disabled button shows a tooltip with the specific reason
- Reasons are derived from existing `getBuildBlockReason()`, `getProductionBlockReason()`, and new predicates
- Examples: "Insufficient matter (need 60, have 42)", "No idle builder", "Factory at capacity", "Requires Power Plant"

### D.5 Tooltip rules

- Tooltip appears on hover, shows: action name, hotkey, cost, disabled reason (if any)
- Tooltip positioning: above the button, centered, does not overflow the screen
- Tooltip is dismissed on mouse leave or after a timeout
- No tooltip on empty slots

### D.6 Cost display

- Cost is shown below the label in smaller text: "60 M" (matter), "30 M, 20 E" (matter + elements)
- Color-code: matter in teal, elements in gold, power in yellow
- When insufficient: cost text turns red for the insufficient resource

### D.7 No fake buttons

- Slots with no command for the current context are visually empty (subtle grid cell, no interactive element)
- The player should never see a button that looks clickable but does nothing
- Hidden commands (`state: 'hidden'`) do not occupy a slot — the slot is empty instead

---

## E. Minimap spec

### E.1 Design philosophy: minimap as control tool, not decoration

The minimap must be a primary navigation and strategic awareness surface. The player should be able to play using primarily the minimap for camera control and situational awareness.

### E.2 Visible layers (priority order, back to front)

| Priority | Layer | Color/Style | MVP | Later |
|----------|-------|-------------|-----|-------|
| 1 | Terrain/background | Dark fill with subtle grid | Yes | Textured background |
| 2 | Fog of war | Black overlay (unexplored), dark overlay (explored-not-visible) | — | Yes, after FOG-VISION-AUDIT-07 |
| 3 | Resources | Orange dots (2px) | Yes | Resource type differentiation |
| 4 | Own buildings | Blue rectangles (3×3 or 2×2 footprint scaled) | Yes | Building type colors |
| 5 | Construction sites | Yellow rectangles | Yes | Progress indicator |
| 6 | Own units | Green/cyan dots (2–3px) | Yes | Unit type differentiation |
| 7 | Selected unit marker | Bright white circle outline | Yes | Pulsing indicator |
| 8 | Camera viewport rectangle | White/bright stroke, semi-transparent fill | Yes | — |
| 9 | Alerts/pings | Red/orange flash at alert location | — | Yes, after FEEDBACK-ALERTS-06 |

### E.3 Interactions

| Interaction | Behavior | MVP | Later |
|-------------|----------|-----|-------|
| **Click** | Camera jumps to clicked position (center on minimap-to-world coordinate) | Yes | — |
| **Drag** | Camera pans continuously while dragging on minimap | — | Yes |
| **Right-click** | Same as left-click (camera jump) | — | Yes |
| **No fallthrough** | Pointer events are consumed; never pass to game canvas | Yes | — |
| **Minimap pings** | (Later) Alt+click sends a ping visible to allies | — | Future |

### E.4 Marker priority and rendering order

- Render in back-to-front order: terrain → fog → resources → buildings → construction → units → selected → viewport → alerts
- Buildings are rectangles scaled to their footprint size
- Units are circles (2–3px diameter)
- Selected unit has a bright white outline circle (3px stroke)
- Camera viewport is a white-stroke, semi-transparent-fill rectangle

### E.5 Performance expectations

- Canvas 2D rendering (current approach) is sufficient for MVP
- Redraw only when state changes or every 2–3 frames (not every frame)
- Entity marker count: < 100 total (current game has ~10 buildings, ~10 units, ~30 resources)
- No need for Phaser second camera (current Canvas 2D approach is correct)

### E.6 Key differences from current minimap (PR #310)

1. **Interactive**: Click-to-camera is mandatory, not deferred
2. **Larger**: 240×180 minimum (up from 200×150)
3. **Selected unit marker**: Bright outline for the selected entity
4. **Alert layer**: Reserved for future alert/ping integration
5. **Fog layer**: Reserved for future fog-of-war overlay

---

## F. Selection and control groups spec

### F.1 Selection model

| Action | Behavior |
|--------|----------|
| **LMB click on own unit** | Select that unit (replace current selection) |
| **LMB click on own building** | Select that building (replace current selection) |
| **LMB click on ground** | Deselect (if something selected), else no-op |
| **LMB drag (box select)** | Select all own units within the selection box (future — requires drag-box rendering) |
| **Shift+LMB click** | Add/remove from current selection (toggle) |
| **Double-click own unit** | Select all units of the same type on screen |
| **RMB with selection** | Issue command (move/harvest/attack) — already implemented via commandRouter |

### F.2 Multi-selection model

- Current: single-unit selection only (`UnitSelection = { kind, id } | null`)
- Target: support selecting multiple units: `UnitSelection = SingleSelection | MultiSelection | null`
- Multi-selection shows: unit count, type composition, average HP in selection panel
- Command card shows group-applicable commands (Stop All, Move All)

### F.3 Control groups

| Action | Behavior |
|--------|----------|
| **Ctrl+1 through Ctrl+9** | Assign current selection to control group 1–9 |
| **1 through 9** | Recall control group (select the assigned units) |
| **Double-tap 1–9** | Recall + center camera on group center |

### F.4 Number key conflict resolution

**Current conflict:**
- `1`/`2`/`3` are bound to build-raw-storage, build-matter-storage, build-element-storage
- These conflict with the universal RTS convention of 1–9 = control groups

**Resolution:**
1. Build commands move to Q/W/E/R/A/S/D/F grid hotkeys (see Section D.3)
2. Number keys 1–9 are reserved exclusively for control groups
3. During transition, both old and new hotkey bindings may coexist
4. Old number-key build hotkeys are removed once command card is the primary interface

### F.5 Interaction with command panel

- Selection change → command card content updates immediately
- If selection is a control group, the command card shows group-applicable actions
- If selection includes mixed types (builders + harvesters), show common commands only

---

## G. Fog / vision spec direction

### G.1 Roadmap (do not implement without audit)

Fog/vision is a **separate audit item** that must be designed before any code is written. This section defines the direction only.

### G.2 Target fog/vision states

| State | Game view | Minimap | Description |
|-------|-----------|---------|-------------|
| **Unexplored** | Black/dark overlay, no terrain visible | Black overlay | The player has never had vision here |
| **Explored** | Terrain visible, no units/buildings shown | Terrain visible, no units shown | The player had vision but does not currently |
| **Currently visible** | Everything visible | Everything visible | The player has active vision here |

### G.3 Vision sources

- Buildings provide vision in a radius around their position
- Units provide vision in a smaller radius
- HQ provides the largest vision radius
- Vision is computed per-frame based on entity positions

### G.4 Minimap fog

- Unexplored: black overlay on minimap
- Explored: dimmed terrain only on minimap
- Currently visible: full detail on minimap

### G.5 Entity visibility

- Enemy units/buildings are only visible in currently-visible areas
- Resources in explored areas remain visible (terrain knowledge)
- Own entities are always visible on the minimap regardless of fog

### G.6 Devtools bypass

- Devtools mode can toggle fog off entirely for debugging
- `isFogDisabled` flag controlled by devtools toggle
- When fog is disabled, everything is visible (current behavior)

### G.7 Save/load implications

- Fog state (which tiles are explored) must be saved and loaded
- Current vision is computed from entity positions at load time
- This requires adding explored-tiles data to the save format

### G.8 Why separate audit is required before code

- Fog/vision touches: game state (new explored-tiles map), entity system (vision radius), renderer (fog overlay), minimap (fog layer), save/load (new data), networking (future), and performance (per-frame visibility computation for potentially large maps)
- The implementation scope is large enough to warrant its own audit with risk assessment and staged rollout
- Rushing fog implementation without audit risks performance regressions, save-format breakage, and UX issues

---

## H. Alerts / feedback spec

### H.1 Alert types

| Alert | Trigger | Display | Action |
|-------|---------|---------|--------|
| **Insufficient resources** | Player tries to build/produce without enough resources | Red flash on resource strip + toast "Not enough Matter (need 60, have 42)" | Click toast → focus on relevant building |
| **Idle worker** | Builder/Harvester idle for > 5 seconds | Idle worker counter button in bottom bar (e.g., "3 Idle") | Click → select and center on next idle worker |
| **Production complete** | Factory finishes producing a unit | Toast "Builder trained" + brief flash on factory | Click toast → select factory |
| **Building complete** | Construction site finishes | Toast "Separator complete" + brief flash on building | Click toast → center on building |
| **Under attack** (future) | Enemy attacks player unit/building | Alert ping on minimap + toast "Unit under attack!" | Click → center on attacked entity |
| **Minimap ping** (future) | Ally sends a ping | Colored ping on minimap | Click minimap at ping → center camera |

### H.2 Status/toast lane

- Position: bottom of the HUD bar, full width, 28px tall
- Toasts appear on the right side, stack upward, auto-dismiss after 4 seconds
- Toasts are clickable (where applicable) to focus on the relevant entity
- Toast types: info (neutral), success (green), warning (yellow), error (red)

### H.3 Command confirmation

- RMB move/harvest/attack: green diamond at target (already implemented in FeedbackRenderer)
- Build placement: green diamond at site (already implemented)
- Failed command: red diamond at target (already implemented)
- Production queued: brief green flash on the Train button in the command card

### H.4 Visual feedback hierarchy

| Priority | Feedback type | Rendering |
|----------|---------------|-----------|
| 1 | Command confirmation (move/attack) | FeedbackRenderer diamonds (world-space) |
| 2 | Resource gain/loss | Floating text near HQ (world-space) |
| 3 | Gathering activity | Pulsing diamond at resource (world-space) |
| 4 | Toasts/alerts | Status/toast lane (HUD DOM) |
| 5 | Idle worker indicator | Persistent button in HUD bar |

---

## I. New roadmap (High+ / Very High+ sequence)

### Step 1: VISUAL-AOE4-UX-REDESIGN-ROADMAP-01 — docs/design

| Attribute | Value |
|-----------|-------|
| **Goal** | Define AoE4-inspired UX redesign roadmap; replace "continue integrating current HUD" plan |
| **Scope** | This document. Docs-only. No runtime code. No tests. No assets. |
| **Non-goals** | Implementation of any HUD changes. Runtime code changes. Asset creation. |
| **Files touched** | `docs/project/VISUAL_AOE4_UX_REDESIGN_ROADMAP_2026_06_20.md` (new), `docs/project/CURRENT_NEXT_STEP.md` (updated), `docs/project/PROJECT_STATE.md` (updated) |
| **Risk** | Low — docs only |
| **Dependencies** | None |
| **Tests** | None (docs only) |
| **Manual QA** | Denis reviews and accepts/rejects the roadmap direction |
| **Accept/reject** | Denis must explicitly accept this roadmap before Step 2 begins |

---

### Step 2: HUD-LAYOUT-REBUILD-02-VERYHIGHPLUS

| Attribute | Value |
|-----------|-------|
| **Goal** | Rebuild the bottom HUD layout to match the new spec: resource strip to top-left, larger minimap slot, command card area, selection panel, status/toast lane. Remove PlaytestHud from normal game mode. |
| **Scope** | Restructure `VisualHudCore`, `hudLayout`, CSS; move resource strip to top-left; add status/toast lane placeholder; gate PlaytestHud behind dev flag in normal game mode |
| **Non-goals** | Command card redesign (Step 3). Minimap interaction (Step 4). Control groups (Step 5). Fog/vision (Steps 7–8). |
| **Likely files touched** | `src/phaser/ui/hud/VisualHudCore.ts`, `src/phaser/ui/hud/hudLayout.ts`, `src/phaser/ui/hud/HudResourceStrip.ts`, `src/phaser/GameScene.ts`, `src/phaser/ui/PlaytestHud.ts` (gating), `src/phaser/ui/hud/HudMinimap.ts` (resize) |
| **Risk** | High — layout restructuring affects camera safe-area, input safe zones, all panel positions. Must not break existing input routing. |
| **Dependencies** | Step 1 accepted |
| **Tests** | Layout constants test, camera safe-area test, input guard test, PlaytestHud gating test |
| **Manual QA** | Denis visual approval at 1280×720 and 1920×1080. PlaytestHud hidden in normal mode. Devtools mode shows PlaytestHud. Camera safe-area correct. Input not broken. |
| **Accept/reject** | Denis must approve the visual layout before proceeding to Step 3 |

---

### Step 3: COMMAND-CARD-REBUILD-03-VERYHIGHPLUS

| Attribute | Value |
|-----------|-------|
| **Goal** | Rebuild the command panel as a stable 4×3 grid with Q/W/E/R/A/S/D/F/Z/X/C/V hotkey badges. Add grid hotkey definitions to command registry. Migrate build/produce hotkeys from number keys and B/P/N/G to grid positions. |
| **Scope** | Rewrite `HudCommandPanel` as a 4×3 grid; update `commandPanelViewModel` for stable slot positions; add Q/W/E/R/A/S/D/F/Z/X/C/V hotkey definitions; update `commandRegistry` with new hotkey bindings; wire grid hotkeys in `GameInputController` |
| **Non-goals** | Remove old hotkeys immediately (dual-binding during transition is OK). Control groups (Step 5). Production queue UI (future). |
| **Likely files touched** | `src/phaser/ui/hud/HudCommandPanel.ts`, `src/phaser/ui/hud/commandPanelViewModel.ts`, `src/state/commandRegistry.ts`, `src/phaser/input/GameInputController.ts` |
| **Risk** | High — hotkey remapping can confuse players during transition. Must support both old and new hotkeys simultaneously until old bindings are removed. |
| **Dependencies** | Step 2 accepted |
| **Tests** | Grid slot position test, hotkey badge visibility test, command execution test, dual-hotkey test, disabled reason tooltip test |
| **Manual QA** | Denis visual approval. All commands work via both old and new hotkeys. Grid layout is readable. Hotkey badges are visible. Disabled reasons are clear. |
| **Accept/reject** | Denis must approve the command card before old hotkeys can be removed (Step 5 transition) |

---

### Step 4: MINIMAP-INTERACTION-04-VERYHIGHPLUS

| Attribute | Value |
|-----------|-------|
| **Goal** | Make the minimap interactive: click-to-camera, no fallthrough. Add selected-unit marker. Increase minimap size to 240×180 minimum. |
| **Scope** | Add click-to-camera handler to HudMinimap; convert minimap click coordinates to world coordinates; move camera to clicked position; add selected unit bright marker; resize minimap slot |
| **Non-goals** | Drag-to-pan (future). Fog of war overlay (Steps 7–8). Alert pings (Step 6). |
| **Likely files touched** | `src/phaser/ui/hud/HudMinimap.ts`, `src/phaser/ui/hud/minimapViewModel.ts`, `src/phaser/ui/hud/hudLayout.ts`, `src/phaser/GameScene.ts` (camera control callback) |
| **Risk** | Medium — coordinate translation between minimap pixels and world camera position. Must not break existing camera bounds. |
| **Dependencies** | Step 2 accepted |
| **Tests** | Click-to-camera coordinate test, minimap-to-world transform test, selected marker test, pointer event isolation test |
| **Manual QA** | Denis visual approval. Click minimap → camera jumps. Click minimap → no map click falls through. Selected unit has bright marker. Minimap is larger and readable. |
| **Accept/reject** | Denis must approve minimap interaction before drag-to-pan or fog overlay is added |

---

### Step 5: SELECTION-CONTROL-GROUPS-05-VERYHIGHPLUS

| Attribute | Value |
|-----------|-------|
| **Goal** | Implement multi-selection model, box select, control groups (Ctrl+1–9 assign, 1–9 recall, double-tap center). Remove old number-key build hotkeys. |
| **Scope** | Extend `UnitSelection` type for multi-selection; add box-select rendering and logic to GameInputController; implement control group storage and recall; remove 1/2/3 build hotkey bindings from commandRegistry; update command card for multi-select context |
| **Non-goals** | Double-click same-type select (future). Control group UI indicators (future). |
| **Likely files touched** | `src/state/unitSelection.ts`, `src/phaser/input/GameInputController.ts`, `src/state/commandRegistry.ts`, `src/phaser/ui/hud/commandPanelViewModel.ts`, `src/phaser/ui/hud/HudSelectionPanel.ts` |
| **Risk** | Very High — this changes the fundamental input model. Number keys changing from build to control groups is a significant UX change. Must be carefully communicated and tested. |
| **Dependencies** | Step 3 accepted (command card with grid hotkeys must be the primary interface before old number-key hotkeys are removed) |
| **Tests** | Multi-selection type test, control group assign/recall/center test, box-select area test, hotkey conflict resolution test, old number-key removal verification test |
| **Manual QA** | Denis must verify: Ctrl+1 assigns, 1 recalls, double-tap centers. Old 1/2/3 build hotkeys no longer work. Box select selects multiple units. Command card updates for multi-select. |
| **Accept/reject** | Denis must explicitly approve the input model change. This is the most disruptive step. |

---

### Step 6: FEEDBACK-ALERTS-06-HIGHPLUS

| Attribute | Value |
|-----------|-------|
| **Goal** | Implement status/toast lane for game alerts. Add idle worker counter. Add resource-insufficient feedback. Add production/building complete toasts. |
| **Scope** | Create toast lane component; wire game events to toast triggers; add idle worker detection and counter button; add resource-insufficient flash on resource strip; connect production/building completion events |
| **Non-goals** | Under-attack alerts (future — requires combat event system). Minimap pings (future — requires multiplayer). Sound alerts (future). |
| **Likely files touched** | New: `src/phaser/ui/hud/HudToastLane.ts`, `src/phaser/ui/hud/toastViewModel.ts`; Modified: `src/phaser/ui/hud/VisualHudCore.ts`, `src/phaser/ui/hud/HudResourceStrip.ts`, `src/phaser/GameScene.ts` |
| **Risk** | Medium — new DOM components, event wiring. Must not spam the player with toasts. Rate limiting and deduplication required. |
| **Dependencies** | Step 2 accepted (layout must have toast lane placeholder) |
| **Tests** | Toast display test, idle worker detection test, resource flash test, rate limiting test |
| **Manual QA** | Denis verifies toast behavior: not too many, actionable, not annoying. Idle worker button works. Resource flash is visible. |
| **Accept/reject** | Denis visual and UX approval |

---

### Step 7: FOG-VISION-AUDIT-07-HIGHPLUS-DOCS

| Attribute | Value |
|-----------|-------|
| **Goal** | Audit fog/vision requirements in detail. Define implementation plan with performance analysis, save/load impact, and staged rollout. Do NOT implement. |
| **Scope** | Docs-only audit. Analyze: map size vs. visibility computation cost; explored-tiles data structure; save/load format changes; minimap fog rendering; entity vision radius; devtools bypass; game balance implications |
| **Non-goals** | Implementation. Runtime code changes. |
| **Likely files touched** | New: `docs/project/FOG_VISION_AUDIT_2026_06_20.md` |
| **Risk** | Low — docs only |
| **Dependencies** | None (can run in parallel with Steps 2–6) |
| **Tests** | None (docs only) |
| **Manual QA** | Denis reviews audit and accepts/rejects the direction |
| **Accept/reject** | Denis must accept the fog audit before Step 8 begins |

---

### Step 8: FOG-VISION-IMPLEMENTATION-08-VERYHIGHPLUS

| Attribute | Value |
|-----------|-------|
| **Goal** | Implement fog/vision system based on accepted audit (Step 7). Three visibility states. Minimap fog. Devtools bypass. Save/load support. |
| **Scope** | Depends on audit results. Likely: explored-tiles map in GameState; per-frame visibility computation; fog overlay renderer; minimap fog layer; devtools toggle; save/load format extension |
| **Non-goals** | Depends on audit |
| **Likely files touched** | Depends on audit. Likely: GameState, new FogVisionSystem, EntityRenderer, HudMinimap, minimapViewModel, GameScene, save/load system |
| **Risk** | Very High — affects game state, rendering, save format, performance. Must be staged carefully. |
| **Dependencies** | Step 7 accepted |
| **Tests** | Visibility computation test, explored-tiles test, save/load round-trip test, fog overlay rendering test, devtools bypass test |
| **Manual QA** | Denis must verify: fog looks correct, explored vs. unexplored vs. visible are distinguishable, minimap fog matches game fog, devtools toggle works, save/load preserves fog state |
| **Accept/reject** | Denis must explicitly approve fog behavior. This is a gameplay-affecting change. |

---

## J. Stop rules

1. **Do not continue polishing the current HUD as final.** PRs #308–#310 are technical prototypes. Their layout, styling, and interaction model are not the accepted direction. Do not spend time refining button styles, adding tooltips, or improving the 3-column grid layout of the current command panel.

2. **Do not implement HUD integration cleanup as the next step.** The VISUAL-HUD-INTEGRATION-04 task is cancelled. Do not merge the current bottom HUD with the PlaytestHud behind dev flags — that work is superseded by this redesign.

3. **Do not copy AoE4 assets or exact layout.** Use AoE4 as a UX reference for interaction patterns only. Do not use AoE4 icons, fonts, color schemes, textures, sounds, exact dimensions, or proprietary terminology.

4. **Do not implement fog without audit.** Fog/vision is a complex system with game state, rendering, save/load, and performance implications. Step 7 (audit) must be accepted before Step 8 (implementation) begins.

5. **Do not mix control groups with current 1/2/3 build hotkeys without resolving the conflict.** The conflict between number-key build commands and number-key control groups must be resolved before control groups are implemented. The resolution is defined in Section D.3: build commands move to Q/W/E/R grid, number keys become control groups.

6. **Do not implement minimap interaction until the input contract is explicit.** Click-to-camera requires a clear contract for: (a) minimap coordinate → world coordinate transform, (b) camera movement callback, (c) pointer event consumption, (d) no fallthrough to game canvas. Define this contract before implementing.

7. **Do not merge High+ visual PRs without Denis manual visual approval.** Every visual/HUD step (2–6, 8) requires Denis to visually inspect the result before merging. Automated tests are necessary but not sufficient for visual/UX changes.

8. **Do not change the input model (number keys, S key, ESC chain) without explicit Denis approval.** The hotkey remapping in Step 3 and the control group assignment in Step 5 change fundamental input behavior. Denis must approve these changes explicitly.

---

## K. Docs updates

### K.1 CURRENT_NEXT_STEP.md updates

- Current direction changed from "HUD integration" to "AoE4-like UX redesign spec"
- PRs #308–#310 are technical prototypes, not final accepted UX
- Next implementation step is `HUD-LAYOUT-REBUILD-02-VERYHIGHPLUS` (after Denis accepts this roadmap)
- The VISUAL-HUD-INTEGRATION-04 task is cancelled/superseded

### K.2 PROJECT_STATE.md updates

- Add visual HUD direction: "AoE4-inspired UX redesign"
- PRs #308–#310 status: technical prototype / current implementation, not final accepted UX
- Add stop rule: "Do not continue polishing current HUD as final until redesign spec is accepted"
- Add active next work item: "VISUAL-AOE4-UX-REDESIGN-ROADMAP-01 — docs/design PR"

---

## Appendix: Relationship to existing documents

| Document | Relationship |
|----------|-------------|
| `VISUAL_ROADMAP.md` | Phase V7 (VISUAL-HUD-01) is updated by this roadmap. The StarCraft reference in V7 is replaced by AoE4-like UX principles. The bottom bar layout target remains the same (minimap left, selection center, commands right), but the implementation details change significantly. |
| `VISUAL_HUD_AUDIT_2026_06_20.md` | The audit's inventory and analysis remain valid. Its specific recommendations (e.g., Phaser second camera for minimap) are superseded where this roadmap disagrees (e.g., Canvas 2D minimap is kept, but made interactive). |
| `CAMERA_PROJECTION_CONTRACT.md` | Unchanged. All minimap coordinate transforms must respect the isometric projection contract. The 4-corner viewport conversion in `minimapViewModel.ts` remains correct. |
| `CURRENT_NEXT_STEP.md` | Updated to reflect the new direction. |
| `PROJECT_STATE.md` | Updated to reflect the new direction. |
