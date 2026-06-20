# VISUAL HUD AUDIT — Four Elements Phaser

Status: **Audit/design document — docs only, no runtime changes**
Project: Four Elements Phaser
Active repo: `ratoker-jpg/four-elements-phaser`
Phaser version: 4.1.0
Date: 2026-06-20

---

## 1. Executive summary

### What this audit is for

The Four Elements Phaser project has a functional economy loop, combat system, and modular vehicle renderer — but the HUD is still a playtest/debug-style sidebar rather than a real RTS game interface. The VISUAL roadmap (Phase V7: `VISUAL-HUD-01`) calls for a StarCraft-inspired bottom bar with minimap left, selection panel center, and command panel right.

This audit inventories every existing UI/HUD component, defines the target layout in detail, designs each panel area (minimap, selection, command, resource/status), recommends an architecture, and proposes a staged implementation PR sequence. It does NOT implement any runtime HUD code.

### Key findings

1. **Standard player-facing HUD is mostly DOM-based; Arena/debug overlays include Phaser GameObjects.** PlaytestHud, ArenaMenu, PauseMenu, DevtoolsPanel, AssetViewerPanel, and ModularVehicleDevtoolsPanel are all pure HTML/CSS overlays with `position: fixed`. BlockoutSandboxHudRenderer (Arena/dev help + vehicle status) and DebugOverlayRenderer (passability/footprint/resource markers) use Phaser GameObjects (Text and Graphics respectively). This mixed architecture is architecturally clean for the new HUD: the bottom bar should be DOM, with the minimap as the sole new Phaser-rendered component.

2. **No minimap exists.** The game has no strategic overview. Adding a minimap is the single highest-impact HUD change. The recommended approach is a Phaser second-camera viewport, which automatically renders a zoomed-out view of the entire map without custom rendering.

3. **No player-facing selection panel exists.** Unit selection display is only in the dev-only BlockoutSandboxHudRenderer (Phaser text in top-right corner). Normal Game mode has zero selection feedback — no name, no HP bar, no weapon readout, no status. This is the second-highest-impact gap.

4. **PlaytestHud is a catch-all.** It combines economy readout, build buttons, production buttons, factory queue, harvester status, unit count, and status feedback in a single 700px-wide bottom panel. The new layout must decompose this into distinct panels with clear separation of concerns.

5. **Devtools and player HUD are interleaved.** DevtoolsPanel, AssetViewerPanel, ModularVehicleDevtoolsPanel, BlockoutSandboxHudRenderer, and DebugOverlayRenderer are all dev-only but share the same screen space and lifecycle as player-facing UI. The new HUD must isolate devtools behind a toggle that completely separates it from player-visible panels.

6. **CommandRegistry exists and is well-structured.** The hotkey system (`src/state/commandRegistry.ts`) already defines build, produce, camera, and debug commands with categories, keys, and labels. The new command panel can consume this data directly.

---

## 2. Current HUD inventory

### 2.1 Player-facing UI components

| Component | Rendering | Position | Purpose | Data Source | Interactions |
|-----------|-----------|----------|---------|-------------|--------------|
| **PlaytestHud** | DOM (`position: fixed; bottom: 0; left: 50%; transform: translateX(-50%)`) | Bottom-center, ~700px wide | Economy readout, build/produce buttons, factory queue, harvester status, unit count, status feedback | GameState (raw/matter/elements/power/caps, buildings, construction, factory queue, harvester states, unit counts) | Build buttons → onBuild; Produce buttons → onProduce; Factory cancel → onCancelFactoryItem; Hotkey labels from commandRegistry; Hover tooltips |
| **ArenaMenu** | DOM (`position: fixed; top: 48px; right: 8px; width: 268px`) | Top-right sidebar | Arena unit composer (body/weapon/team/AI-mode), roster (ally/enemy list), help overlay, reset scenario | GameState, ArenaPlacementState, BlockoutVehicleState[], BODY_PROFILES, WEAPON_PROFILES | Body/weapon/team/AI selection; Place unit; Cancel placement; Roster select/delete; Clear allies/enemies; Help toggle; Reset |
| **PauseMenu** | DOM (`position: fixed; inset: 0`) | Full-screen overlay | Pause/resume, save/load, restart, main menu, hotkey reference | GameSetupConfig, Faction, save system | Resume; Save; Load (slot select); Delete save; Restart; Main Menu; ESC to close |

### 2.2 Dev/debug-only UI components

| Component | Rendering | Position | Purpose | Data Source |
|-----------|-----------|----------|---------|-------------|
| **DevtoolsPanel** | DOM (`position: fixed; top: 48px; left: 8px; width: 220px; z-index: 25`) | Top-left | Resource cheats, spawn units, diagnostics readout, asset diagnostics, overlay toggles | GameState, devGetDiagnostics(), runtimeAssetDiagnostics |
| **AssetViewerPanel** | DOM (`position: fixed; top: 48px; left: 236px; width: 420px; z-index: 26`) | Left, right of DevtoolsPanel | Asset manifest summary, faction gaps, asset categories | RuntimeAssetDiagnostics |
| **ModularVehicleDevtoolsPanel** | DOM (`position: fixed; top: 8px; right: 268px; width: 248px; z-index: 30`) | Right, left of ArenaMenu | Modular vehicle preview controls (faction/hull/turret/mods/direction/scale/position) | GeneratedModularVehicleRenderer state |
| **BlockoutSandboxHudRenderer** | Phaser (GameObjects.Text, scrollFactor=0) | Help: top-left (8,8); Status: top-right (camera.width-8, 8) | Arena/dev help overlay, selected vehicle status (body/weapon/HP/upgrade/fire state/weapon resource) | BlockoutVehicleState[], weapon runtime data |
| **DebugOverlayRenderer** | Phaser (GameObjects.Graphics) | World-space isometric overlay | Passability diamonds, building footprint diamonds, resource markers | GameState (mapData, buildings, construction, resources, occupancy) |

### 2.3 Pure data/state (no rendering)

| Component | Purpose | Used by |
|-----------|---------|---------|
| **CommandRegistry** | Centralized hotkey/command definitions (id, label, key, category, enabled, execute) | PlaytestHud (hotkey labels), GameInputController (execute callbacks) |
| **ArenaModeContext** | Arena mode activation state (arenaMode, runCivilLoop, showPlaytestHud, showArenaMenu, createObstaclesOnReset) | GameScene (decides which UI to create, whether to run civil loop) |
| **GameInputController** | Normal Game input routing (keyboard/mouse → game actions, wires commandRegistry callbacks) | GameScene |
| **BlockoutVehicleInputController** | Arena/dev input routing (selection, turret aim, movement, firing, upgrades) | GameScene (devtools/arena mode) |

### 2.4 What overlaps game camera/arena

| Component | Overlap? | Notes |
|-----------|----------|-------|
| PlaytestHud | Partial — bottom of screen | Fixed at bottom-center, ~200px tall, covers bottom edge of game viewport |
| ArenaMenu | Yes — top-right corner | 268px wide, from top: 48px down. Covers top-right game area |
| PauseMenu | Full-screen | Intentional — pause overlay covers everything |
| DevtoolsPanel | Yes — top-left corner | 220px wide, covers top-left game area |
| BlockoutSandboxHudRenderer | Yes — top corners | Help text top-left, status text top-right. Semi-transparent |
| DebugOverlayRenderer | Yes — world-space | Drawn on the game world (passability, footprints, resources) |

### 2.5 What should be removed, moved, or hidden

| Component | Action | Reason |
|-----------|--------|--------|
| PlaytestHud | **Decompose and replace** | Single monolithic panel must become separate minimap, selection, command, and resource panels |
| ArenaMenu | **Keep for Arena mode only** | Arena-specific UI, not part of normal game HUD. Eventually needs layout refresh but not in first HUD pass |
| DevtoolsPanel | **Move to separate toggle layer** | Currently interleaved with game screen. Should be a sliding drawer or completely separate overlay that does not overlap player HUD |
| AssetViewerPanel | **Keep as devtools sub-panel** | Already behind devtools toggle. No change needed |
| ModularVehicleDevtoolsPanel | **Keep as devtools sub-panel** | Already behind devtools toggle. No change needed |
| BlockoutSandboxHudRenderer | **Keep for Arena/dev mode** | Provides selection feedback that normal game mode lacks. Once a proper selection panel exists for normal mode, this can be simplified |
| DebugOverlayRenderer | **Keep behind devtools toggle** | Already conditional. No change needed |
| PauseMenu | **Keep, minor visual refresh** | Functional, covers game appropriately for pause state |

---

## 3. Target RTS HUD layout

### 3.1 Layout diagram

```
+-------------------------------------------------------------------+
|                                                                     |
|                          GAME VIEWPORT                              |
|                                                                     |
|                                                                     |
|                                                                     |
|                                                                     |
+-------------+---------------------------+---------------------------+
|   MINIMAP   |    SELECTED UNIT/         |    COMMAND/ACTION/        |
|             |    BUILDING INFO          |    PRODUCTION PANEL       |
|   200×150   |    ~300px wide            |    ~300px wide            |
|             |                           |                           |
+-------------+---------------------------+---------------------------+
|              RESOURCE/STATUS STRIP (full width)                      |
+-------------------------------------------------------------------+
```

### 3.2 Bottom bar dimensions

The bottom bar occupies the full width of the screen at a fixed height. Recommended dimensions:

- **Total bar height**: 180px (minimap 150px + resource strip 30px)
- **Minimap**: 200×150px, bottom-left
- **Selection panel**: ~300px wide, bottom-center-left
- **Command panel**: remaining width (~300px+ on 1080p), bottom-center-right
- **Resource strip**: full-width, 30px tall, below the three panels

These are initial proportions. The selection panel and command panel should flex to fill available width, with the minimap at fixed size.

### 3.3a HUD/camera contract

**Main camera viewport excludes the bottom HUD height.** The Phaser canvas renders the game world in the main camera viewport, which is sized to `canvas.height - HUD_BAR_HEIGHT` (approximately `canvas.height - 180px`). The DOM bottom bar overlays the lower portion of the canvas, covering it visually, but the main camera's `worldView` does not extend into the HUD area. This means:

- The main camera's scroll bounds and worldView are reduced by the HUD bar height so the camera never scrolls content behind the HUD.
- The game world is rendered only in the visible viewport above the HUD.
- Camera panning near the bottom edge stops at the reduced boundary, not at the canvas edge.

**Pointer input safe area.** DOM panels with `pointer-events: auto` consume pointer events in their bounding boxes. The Phaser pointer system receives events only in the area not covered by interactive DOM elements. Concretely:

- The bottom bar DOM container has `pointer-events: none` on the background and `pointer-events: auto` only on interactive children (buttons, tooltips).
- Camera edge-pan (WASD or cursor-at-edge) is unaffected because it is keyboard-driven, not pointer-driven.
- Click-to-select and right-click-to-move are routed through the Phaser pointer system, which only fires when the pointer is over the canvas area outside DOM interactive elements.
- Minimap pointer events are handled by the Phaser second camera viewport (see Section 4.3), not by DOM elements.

**Minimap second camera placement.** The minimap second camera renders into a Phaser viewport rectangle positioned at the bottom-left of the canvas, at coordinates `(0, canvas.height - 150, 200, 150)`. The DOM minimap frame is a `position: fixed` container at the same screen position with a transparent center (so the Phaser-rendered minimap shows through) and styled border/background around the edges. The DOM frame sits on top of the Phaser viewport (higher z-index) but does not block the rendered content because its center area is transparent.

### 3.3 Panel definitions

#### Panel 1: Minimap (bottom-left)

| Attribute | Value |
|-----------|-------|
| Purpose | Strategic overview of the entire map; camera viewport indicator; unit positions |
| Size | 200×150px (fixed) |
| Data shown | Terrain outline, camera viewport rectangle, player/allied units (colored dots), own buildings/resources (simplified markers). Enemy units and fog of war are deferred |
| Data source | Phaser second camera (renders same scene at low zoom); camera worldView for viewport indicator |
| Player interactions | Click to move camera (MVP: later); viewport drag indicator (later) |
| MVP vs later | MVP: minimap renders terrain + units + viewport rectangle. Later: click-to-move, fog of war overlay, unit type differentiation |
| Risk | High — second camera doubles render pass; requires camera.ignore() for all UI/debug Phaser elements; viewport rectangle and entity dot markers must be drawn on a Graphics layer excluded from the second camera; performance must be profiled for large maps; coordinate translation between main camera worldView and minimap viewport is error-prone |

#### Panel 2: Selection panel (bottom-center-left)

| Attribute | Value |
|-----------|-------|
| Purpose | Show details of currently selected unit or building |
| Size | ~300px wide, flex height within bar |
| Data shown | **Unit**: name (body+weapon), faction, HP bar (current/max), status (idle/moving/attacking/harvesting/building), upgrade levels, weapon cooldown; **Building**: name, faction, HP bar, production queue/progress, active task; **Multi-select**: unit count, average HP, type composition; **Empty**: "No selection" placeholder |
| Data source | Selected entity state from GameState; building runtime data; unit runtime data; weapon cooldown/harvester state |
| Player interactions | Click unit portrait to center camera (later); click HP bar for detail (later) |
| MVP vs later | MVP: unit name, HP bar, faction, basic status. Later: upgrade levels, weapon detail, production progress, multi-select detail, center-camera-on-click |
| Risk | Medium — new SelectionState module is a prerequisite; click-to-select must be wired into GameInputController without breaking existing pointer routing; selection feedback must not interfere with unit movement commands |

#### Panel 3: Command/action panel (bottom-center-right)

| Attribute | Value |
|-----------|-------|
| Purpose | Context-sensitive action buttons (build, produce, attack-move, stop, etc.) |
| Size | Remaining width, ~300px+ on 1080p |
| Data shown | Grid of action buttons; hotkey labels; disabled state with reason tooltip; production progress (factory queue) |
| Data source | CommandRegistry (commands, categories, keys, enabled predicates); GameState (factory queue, build availability, production status) |
| Player interactions | Click button → execute command; hotkey press → execute command; hover → tooltip with description + hotkey |
| MVP vs later | MVP: migrate existing build/produce buttons from PlaytestHud; show hotkey labels; disable with reason. Later: context-sensitive panels (building selected → show production; unit selected → show move/attack/stop), button grid layout, tooltip polish |
| Risk | Medium — must not break existing hotkey wiring during migration; block-reason extraction from PlaytestHud is a logic move that can introduce regressions; button state must stay consistent between old PlaytestHud (still partially alive) and new CommandPanel during the transition period |

#### Panel 4: Resource/status strip (bottom, full width)

| Attribute | Value |
|-----------|-------|
| Purpose | Always-visible economy readout |
| Size | Full width, 30px tall |
| Data shown | Raw / Matter / Elements counts with delta indicators; Power / Power cap; Unit count / Unit cap |
| Data source | GameState.economy (raw, matter, elements, power, unitCount, unitCap, storage caps) |
| Player interactions | None in MVP (read-only display). Later: click resource for detail popup |
| MVP vs later | MVP: migrate existing economy readout from PlaytestHud. Later: delta feedback animations, resource warning states, per-second income display |
| Risk | Low — pure read-only display of existing state |

---

## 4. Minimap design

### 4.1 What the minimap should show in MVP

| Element | Included in MVP | Notes |
|---------|-----------------|-------|
| Terrain bounds | Yes | The entire playable map area rendered as a miniature |
| Camera viewport rectangle | Yes | White/bright rectangle showing what the main camera sees |
| Player units | Yes | Colored dots (faction color) for each player-owned unit/building |
| Enemy units | No | Deferred — requires visibility/fog-of-war state which does not exist yet. MVP shows only player/allied units and own buildings/resources. Enemy handling is added when FOG-01 provides a visibility query API |
| Buildings/resources | Yes | Simplified markers for buildings and resource nodes |
| Fog of war | No | FOG-01 is a separate task. Minimap can add fog overlay later |

### 4.2 Click-to-move-camera

**Not in MVP.** Click-to-move-camera requires:
- Translating minimap click coordinates to world coordinates
- Scrolling the main camera to that position
- Handling pointer events that do not conflict with game input
- Visual feedback on click

This is a natural follow-up after the minimap renders correctly. Estimated complexity: low-medium.

### 4.3 Expected technical approach

**Recommended: Hybrid — Phaser second camera for terrain/background + Phaser Graphics overlay for entity dots and viewport rectangle.**

The minimap rendering is split into two layers:

1. **Second camera** renders the simplified game world (terrain, buildings, resource nodes) into a small viewport at the bottom-left of the canvas. This camera shows the full map at a fixed zoom level. All UI/debug Phaser elements (BlockoutSandboxHudRenderer text, DebugOverlayRenderer graphics, selection rings, HP bars if rendered as Phaser objects) must be excluded via `camera.ignore()`.

2. **Graphics overlay** (a single Phaser `Graphics` object positioned in the minimap viewport area, scrollFactor=0, excluded from the main camera) draws:
   - **Entity dots**: Small colored circles at each player/allied unit's world position translated to minimap coordinates. Faction-colored dots for units, distinct markers for buildings.
   - **Camera viewport rectangle**: A bright rectangle showing the main camera's current `worldView` bounds, translated to minimap coordinates.

This hybrid approach avoids relying on entity sprites being visible at the second camera's low zoom level (they may be too small or incorrectly scaled). The Graphics overlay gives precise control over dot size and color, and the viewport rectangle is always crisp.

**What the second camera must ignore**: All Phaser GameObjects that are UI/debug overlays, including:
- `BlockoutSandboxHudRenderer` text objects (scrollFactor=0)
- `DebugOverlayRenderer` graphics objects
- Selection rings, HP bars, weapon VFX markers rendered as Phaser objects
- Any future Phaser-rendered UI elements

**Coordinate translation**: Entity world position `(worldX, worldY)` → minimap position `(minimapX, minimapY)`:
```
minimapX = viewportX + (worldX / mapWidthTiles) * viewportWidth
minimapY = viewportY + (worldY / mapHeightTiles) * viewportHeight
```
This assumes the second camera shows the full map. The translation is linear and does not require isometric projection because the second camera already renders the isometric view.

Alternative approaches (not recommended for MVP):

| Approach | Pros | Cons |
|----------|------|------|
| DOM Canvas | Isolated from Phaser | Manual synchronization every frame; no automatic entity rendering; higher maintenance |
| Pure second camera (no Graphics overlay) | Simplest — all automatic | Entity sprites may be invisible at low zoom; no control over dot size/color; viewport rectangle must be a Phaser object excluded from the main camera |

### 4.4 Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Performance — second camera doubles render pass | Low | Current sprite count is under 50 objects. Render pass cost is negligible. Profile before optimizing. |
| UI elements appear in minimap | Medium | Set scrollFactor=0 on all DOM UI (already done). Phaser text/graphics must use camera.ignore(). |
| Camera sync — viewport rectangle lags | Low | Viewport rectangle is a Phaser Graphics object updated each frame. One-rectangle draw is trivial. |
| Large maps cause tiny minimap units | Medium | Use entity dot markers instead of relying on sprite visibility at low zoom. Override with Graphics circles at entity positions. |
| Fog of war not ready | Low | Show all units in MVP. Fog overlay can be added as a transparent mask when FOG-01 is implemented. |
| Scaling — different screen sizes | Medium | Use percentage-based viewport sizing. Minimap should be a fixed pixel size initially, with CSS scaling for different resolutions. |

---

## 5. Selected panel design

### 5.1 Unit selected

| Field | MVP | Later | Source |
|-------|-----|-------|--------|
| Name (body type + weapon) | Yes | — | BodyProfile.weaponId / BodyProfile.bodyId display names |
| Faction | Yes | Faction icon | Faction from entity state |
| HP bar (current/max) | Yes | Animated HP change | Entity HP from damage state |
| Status (idle/moving/attacking/harvesting/building) | Yes | Detailed status with icon | Movement state, combat state, harvester task, builder task |
| Weapon name | Yes | Weapon icon + cooldown bar | WeaponId display name, weapon cooldown timer |
| Upgrade levels (M0-M3) | No | Yes | Upgrade profiles from blockoutUpgradeData |
| Ammo/resource detail | No | Yes (canister/overheat/magazine/drum) | Weapon runtime state |

### 5.2 Building selected

| Field | MVP | Later | Source |
|-------|-----|-------|--------|
| Name | Yes | — | BuildingConfig display name |
| Faction | Yes | Faction icon | Faction from building state |
| HP bar | Yes | Animated HP change | Building HP |
| Active task | Yes | Production progress bar | Factory queue, construction progress |
| Production queue | No | Yes (queue slots + progress) | Factory queue from GameState |
| Storage capacity | No | Yes (fill bar) | Economy storage from GameState |

### 5.3 Multi-select

| Field | MVP | Later | Source |
|-------|-----|-------|--------|
| Unit count | Yes | — | Selected entities array length |
| Type composition | No | Yes (icon grid) | Entity types from selection |
| Average HP | No | Yes (aggregate HP bar) | HP from selected entities |
| Common actions | No | Yes (move/attack/stop for group) | Command actions for selected unit types |

### 5.4 Empty selection state

When nothing is selected, the panel shows:
- MVP: "No unit selected" placeholder text
- Later: helpful hints ("Click a unit or building to see details") or last-selected unit summary

### 5.5 Selection state source

Currently, Normal Game mode has **no selection state**. The game has no concept of selecting a unit in normal gameplay — units are commanded implicitly through build/produce buttons. Arena mode has selection via BlockoutVehicleInputController, but that state (selectedVehicleId) is arena-specific.

**Implementation requirement**: A new `SelectionState` module is needed for Normal Game mode that tracks:
- Currently selected entity/entities
- Selection source (click, hotkey, etc.)
- Selection change events

This is a new data module, not a gameplay logic change. It reads existing entity positions and IDs without modifying movement, combat, or economy.

---

## 6. Command panel design

### 6.1 Actions/buttons

The command panel shows context-sensitive buttons based on what is selected and what the current game state allows.

**Building context (HQ/Factory/Storage/Power Plant selected):**
| Button | Hotkey | Source | MVP |
|--------|--------|--------|-----|
| Produce Builder | N | CommandRegistry `produce-builder` | Yes |
| Produce Harvester | G | CommandRegistry `produce-harvester` | Yes |
| Factory queue display | — | GameState factory queue | No (later) |

**Placement context (no building selected, build mode active):**
| Button | Hotkey | Source | MVP |
|--------|--------|--------|-----|
| Build Separator | B | CommandRegistry `build-separator` | Yes |
| Build Raw Storage | 1 | CommandRegistry `build-raw-storage` | Yes |
| Build Matter Storage | 2 | CommandRegistry `build-matter-storage` | Yes |
| Build Element Storage | 3 | CommandRegistry `build-element-storage` | Yes |
| Build Power Plant | P | CommandRegistry `build-power-plant` | Yes |
| Build Units Factory | F | CommandRegistry `build-units-factory` | Yes |

**Unit context (later — not in first HUD pass):**
| Button | Hotkey | Source | MVP |
|--------|--------|--------|-----|
| Move | RMB | GameInputController | No |
| Attack | A + click | New command | No |
| Stop | S | GameInputController | No |

**Empty context:**
| Button | Hotkey | Source | MVP |
|--------|--------|--------|-----|
| (show hints or last action) | — | — | Yes |

### 6.2 Hotkeys

All hotkeys are already defined in CommandRegistry. The command panel must:
- Display the hotkey label on each button
- Highlight the button briefly when the hotkey is pressed (visual feedback)
- Not interfere with existing hotkey wiring in GameInputController

### 6.3 Disabled states

Buttons must be disabled with a visible reason when:
- Insufficient resources (e.g., "Need 50 Raw")
- At unit cap (e.g., "Unit cap reached")
- Factory already producing (e.g., "Queue full")
- Building placement blocked (e.g., "No valid location")
- Wrong context (e.g., build buttons when a unit is selected)

The existing PlaytestHud already computes block reasons. This logic must be extracted into a shared module so both the command panel and PlaytestHud (during migration) can use it.

### 6.4 Tooltips

Each button should show a tooltip on hover with:
- Full action name
- Hotkey
- Resource cost
- Block reason (if disabled)

The existing TooltipManager can be reused for this.

### 6.5 Build/produce/repair/cancel flows

| Flow | Current (PlaytestHud) | New (Command Panel) |
|------|----------------------|---------------------|
| Build | Click build button → enters placement mode → click map to place | Same flow, button is in command panel instead of PlaytestHud |
| Produce | Click produce button → adds to factory queue | Same flow, button is in command panel |
| Cancel | Click X on factory queue item | Same flow, queue display is in command panel or selection panel |
| Repair | Not implemented | Not in MVP |

### 6.6 Input/camera control isolation

The command panel must not intercept mouse events that the game camera or input controller needs. This is achieved by:

1. **DOM panels use `pointer-events: auto` only on interactive elements** (buttons), not on the panel background
2. **Phaser pointer events** fall through to GameInputController when the pointer is not over a DOM button
3. **Minimap pointer events** are handled by the Phaser second camera viewport, not by DOM
4. **Existing hotkeys** continue to work through GameInputController — the command panel is an alternative input path, not a replacement

---

## 7. Resource/status area

### 7.1 What to display

| Resource | Display | Source | MVP |
|----------|---------|--------|-----|
| Raw | Current / Cap | GameState.economy.raw, rawStorageCap | Yes |
| Matter | Current / Cap | GameState.economy.matter, matterStorageCap | Yes |
| Elements | Current / Cap | GameState.economy.elements, elementStorageCap | Yes |
| Power | Current / Cap | GameState.economy.power, powerCap | Yes |
| Unit count | Current / Cap | GameState unitCount / unitCap | Yes |
| Resource delta (per-second) | +/- per resource | Computed from economy state changes | No (later) |

### 7.2 Existing data source

The existing PlaytestHud already reads all resource data from `GameState.economy`:
- `raw`, `matter`, `elements`, `power`
- Storage caps from `BUILDING_CONFIG` (rawStorage, matterStorage, elementStorage)
- Power capacity from power plants built
- Unit count and cap

This data access pattern should be extracted into a shared `EconomyReadout` module that both the old PlaytestHud (during migration) and the new resource strip can use.

### 7.3 Resource delta feedback

Not in MVP. Resource delta (income/spend per second) requires:
- Tracking economy state changes over time
- Computing per-second rates
- Displaying animated +/- indicators

This is a polish feature that can be added after the basic resource strip is functional.

### 7.4 Visual design

The resource strip should be a full-width bar below the three main panels. Layout:

```
[Raw: 450/500] [Matter: 120/200] [Elements: 80/300] [Power: 5/8] [Units: 12/20]
```

Each resource shows current/cap with a color-coded fill bar. Resources approaching cap get a warning tint. Resources at zero get an alert tint.

---

## 8. Architecture recommendation

### 8.1 DOM HUD vs Phaser HUD

**Recommendation: DOM HUD for all panels except the minimap.**

Rationale:
- All current UI is DOM-based. The team has extensive DOM HUD experience and patterns.
- DOM UI scales independently of the Phaser canvas, handles text rendering well, and supports CSS transitions/animations for polish.
- The minimap is the only component that needs Phaser rendering (second camera). It should be a Phaser-managed viewport that sits behind the DOM minimap frame.
- Phaser UI (GameObjects.Text, Graphics) is suitable for dev/debug overlays but not for rich interactive panels with buttons, tooltips, and state-dependent layouts.

Architecture:

```
┌──────────────────────────────────────────────────────────┐
│  Phaser Canvas (game world + minimap second camera)      │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Main Camera (game viewport)                        │ │
│  │                                                     │ │
│  │                                                     │ │
│  └─────────────────────────────────────────────────────┘ │
│  ┌──────┐                                                │
│  │Mini- │  ← Second camera viewport (200×150)           │
│  │map   │                                                │
│  └──────┘                                                │
├──────────────────────────────────────────────────────────┤
│  DOM Overlay (bottom bar + resource strip + pause menu)  │
│  ┌──────┬──────────────┬──────────────┬────────────────┐ │
│  │Mini- │ Selection    │ Command      │ (flex space)   │ │
│  │map   │ Panel        │ Panel        │                │ │
│  │frame │              │              │                │ │
│  └──────┴──────────────┴──────────────┴────────────────┘ │
│  [ Raw: 450/500  Matter: 120/200  Elements: 80/300  ...]│
└──────────────────────────────────────────────────────────┘
```

The DOM minimap frame is a transparent-bordered container that overlays the Phaser second camera viewport. This way the minimap renders in Phaser but the border/frame styling is in CSS.

### 8.2 CSS/layout strategy

- **CSS Grid** for the bottom bar: `grid-template-columns: 200px 1fr 1fr; grid-template-rows: 150px 30px`
- **CSS Custom Properties** for theming: `--hud-bg`, `--hud-border`, `--hud-accent`, `--hud-text`, `--hud-warning`
- **CSS transitions** for button hover, selection change, resource warning states
- **No CSS framework** — the project uses vanilla CSS in TypeScript string templates. Continue this pattern.
- **Responsive**: The bottom bar should work at 1280×720 minimum. Minimap is fixed-size; selection and command panels flex.

### 8.3 Event/data flow from GameScene/game state

Current flow:
```
GameScene.create() → creates PlaytestHud/ArenaMenu/PauseMenu/DevtoolsPanel
GameScene.update() → playtestHud.update() / arenaMenu.update() (every frame)
PlaytestHud reads GameState directly (no event bus)
```

Recommended flow for new HUD:
```
GameScene.create() → creates HudShell
  HudShell creates: ResourceStrip, SelectionPanel, CommandPanel, MinimapController
  HudShell reads: GameState, SelectionState, CommandRegistry

GameScene.update() → hudShell.update()
  ResourceStrip.update() → reads GameState.economy
  SelectionPanel.update() → reads SelectionState
  CommandPanel.update() → reads GameState + CommandRegistry
  MinimapController.update() → updates viewport indicator

Event-driven additions (later):
  SelectionState.on('change') → SelectionPanel.refresh()
  GameState.economy.on('change') → ResourceStrip.refresh()
```

The MVP should use the same per-frame update pattern as PlaytestHud. Event-driven updates are a later optimization.

### 8.4 Isolating player HUD from devtools

**Current problem**: DevtoolsPanel, AssetViewerPanel, and ModularVehicleDevtoolsPanel are created alongside player UI in GameScene.create(). They overlap the game viewport.

**Recommended isolation**:

1. **Devtools panels remain DOM elements** but are moved to a separate z-index layer (z-index: 50+) above the player HUD (z-index: 10+)
2. **Devtools toggle (F10/backtick) completely hides/shows** all devtools panels. When devtools are hidden, no dev DOM elements exist in the layout.
3. **BlockoutSandboxHudRenderer** stays as a Phaser overlay for arena/dev mode — it does not conflict with the new bottom bar because it draws in the top corners.
4. **DebugOverlayRenderer** stays behind devtools toggle — already conditional.
5. **ModularVehicleDevtoolsPanel** is only created when devtools are active — already conditional.

No devtools panel should appear in normal game mode without explicit activation.

### 8.5 Avoiding combat/economy/pathfinding changes

The HUD is a read-only display layer. It must NOT:

- Modify entity positions, HP, or combat state
- Change economy values (resource amounts, production rates, build costs)
- Alter pathfinding, occupancy, or movement
- Change save/load format or behavior
- Modify camera bounds or projection

The only state the HUD writes is:
- Selection state (which entity is selected — new, non-gameplay state)
- UI state (which panel is expanded, which tab is active — pure UI state)

All HUD data reads should go through existing GameState accessors. If GameState does not expose needed data (e.g., harvester task name for selection panel), add a read-only accessor to GameState — do not add gameplay logic.

---

## 9. Implementation PR breakdown with risk

### PR 1: HUD Shell

**Scope**: Create the bottom bar DOM container with three panel slots and a resource strip slot. No functional panels yet — just empty containers with the correct CSS Grid layout, theming, and z-index.

| Detail | Value |
|--------|-------|
| Files likely touched | New: `src/phaser/ui/HudShell.ts`; Modified: `src/phaser/GameScene.ts` (create/shutdown wiring) |
| Risk level | Medium — touches GameScene camera setup and introduces a safe-area contract between the main camera and the DOM HUD bar. If the safe-area calculation is wrong, the camera will scroll content behind the HUD or the game viewport will be too small |
| Validation | Visual: bottom bar appears with empty panel outlines; game viewport correctly excludes HUD bar height; camera scroll bounds reduced; typecheck; existing tests pass |
| Manual QA | Bottom bar visible; game viewport does not extend behind the HUD; camera panning stops at correct boundaries; no overlap with existing PlaytestHud (which still exists at this point) |

### PR 2: Resource strip migration

**Scope**: Extract economy readout from PlaytestHud into a standalone `ResourceStrip` component. Wire it into the HUD Shell. Remove economy readout from PlaytestHud.

| Detail | Value |
|--------|-------|
| Files likely touched | New: `src/phaser/ui/ResourceStrip.ts`; Modified: `src/phaser/ui/PlaytestHud.ts` (remove economy section), `src/phaser/ui/HudShell.ts` (add ResourceStrip) |
| Risk level | Low |
| Validation | Resource strip shows same values as old PlaytestHud economy section; typecheck; existing tests pass |
| Manual QA | Resources display correctly at bottom of screen; economy loop unchanged; build/produce still work |

### PR 3: Selection panel MVP

**Scope**: Create `SelectionPanel` component showing selected unit/building name, HP bar, faction, and basic status. Create `SelectionState` module for Normal Game mode. Wire click-to-select in GameInputController.

| Detail | Value |
|--------|-------|
| Files likely touched | New: `src/phaser/ui/SelectionPanel.ts`, `src/state/selectionState.ts`; Modified: `src/phaser/ui/HudShell.ts`, `src/phaser/input/GameInputController.ts` (add click-to-select), `src/phaser/GameScene.ts` |
| Risk level | Medium — new SelectionState module must be designed to avoid coupling with gameplay logic; click-to-select wiring in GameInputController changes pointer routing and must not break unit movement, building placement, or camera controls. Any pointer event priority bug could make the game unplayable |
| Validation | Clicking a unit/building updates the selection panel; clicking empty space clears selection; right-click still issues move commands; build/produce still work; typecheck; existing tests pass |
| Manual QA | Select unit → name/HP appears in panel; select building → name/HP appears; click empty space → "No selection"; right-click still moves units; build/produce still work; game functions unchanged |

### PR 4: Command panel MVP

**Scope**: Create `CommandPanel` component with build/produce buttons, hotkey labels, and disabled states. Extract block-reason logic from PlaytestHud into shared module. Remove build/produce buttons from PlaytestHud.

| Detail | Value |
|--------|-------|
| Files likely touched | New: `src/phaser/ui/CommandPanel.ts`, `src/state/buildBlockReasons.ts` (extracted); Modified: `src/phaser/ui/PlaytestHud.ts` (remove build/produce sections), `src/phaser/ui/HudShell.ts` |
| Risk level | Medium — block-reason extraction from PlaytestHud is a logic move that can introduce regressions if any condition is missed; during the transition both PlaytestHud and CommandPanel may coexist and must not double-execute commands; hotkey wiring must remain functional throughout migration |
| Validation | Build/produce buttons work from command panel; hotkeys still work; disabled states match old PlaytestHud exactly; factory queue displays correctly; cancel works; typecheck; existing tests pass |
| Manual QA | Build/produce from command panel works identically to old PlaytestHud; hotkeys (B, 1, 2, 3, P, F, N, G) still work; factory queue displays; cancel works |

### PR 5: Minimap MVP

**Scope**: Add Phaser second camera for minimap viewport. Create `MinimapController` to manage the second camera, viewport indicator, and entity dot markers. Add minimap frame in HUD Shell DOM overlay.

| Detail | Value |
|--------|-------|
| Files likely touched | New: `src/phaser/ui/MinimapController.ts`; Modified: `src/phaser/ui/HudShell.ts` (minimap frame), `src/phaser/GameScene.ts` (camera setup), `src/phaser/render/RenderManager.ts` |
| Risk level | High — second camera introduces a full additional render pass; camera.ignore() must exclude all UI/debug elements or they will appear in the minimap; Graphics overlay for entity dots and viewport rectangle requires correct world-to-minimap coordinate translation; performance impact must be profiled on large maps; the minimap viewport position must be coordinated with the DOM minimap frame (pixel-perfect alignment) |
| Validation | Minimap shows terrain via second camera; entity dots render at correct positions via Graphics overlay; viewport rectangle tracks main camera scroll; no UI/debug elements leak into minimap; performance acceptable (profile FPS before and after); typecheck; existing tests pass |
| Manual QA | Minimap renders in bottom-left; entity dots at correct positions; scrolling main camera moves viewport rectangle on minimap; player/allied units visible; no UI/debug elements appear in minimap; frame rate stable |

### PR 6: Dev/debug UI separation

**Scope**: Move DevtoolsPanel to a sliding drawer or separate overlay. Ensure devtools panels never overlap player HUD. Add keyboard toggle to completely hide/show devtools layer.

| Detail | Value |
|--------|-------|
| Files likely touched | Modified: `src/phaser/ui/DevtoolsPanel.ts`, `src/phaser/GameScene.ts` (devtools lifecycle) |
| Risk level | Low |
| Validation | Devtools panels hidden by default; F10 shows them without overlapping HUD; game plays normally without devtools |
| Manual QA | Normal game: no devtools visible. F10: devtools appear, do not overlap bottom bar. Devtools still work correctly |

### PR 7: Visual polish pass

**Scope**: Apply warm industrial sci-fi visual theme to all HUD panels. Add hover/active states, transitions, tooltips. Improve button readability. Add faction-colored accents.

| Detail | Value |
|--------|-------|
| Files likely touched | Modified: `src/phaser/ui/HudShell.ts`, `src/phaser/ui/ResourceStrip.ts`, `src/phaser/ui/SelectionPanel.ts`, `src/phaser/ui/CommandPanel.ts` (CSS only) |
| Risk level | Very low |
| Validation | Visual review; no functional changes; typecheck; existing tests pass |
| Manual QA | HUD looks like a real RTS game interface, not a debug panel; warm industrial theme applied; buttons readable; tooltips appear; transitions smooth |

---

## 10. Stop rules

This audit is a design document only. The following actions are explicitly **forbidden** during this PR:

1. **No runtime HUD implementation.** This PR creates a document only. No TypeScript, no CSS, no DOM elements, no Phaser objects are created or modified for HUD purposes.
2. **No gameplay logic changes.** No changes to combat, economy, pathfinding, movement, or AI.
3. **No economy rebalance.** Resource amounts, costs, and production rates are not changed.
4. **No pathfinding/save-load/bot/mapgen.** These systems are out of scope.
5. **No terrain/resource visual work.** VISUAL-06 and VISUAL-03 are separate phases.
6. **No Wasp+Smoky muzzle work.** PR #305 tracks this separately.
7. **No broad renderer rewrite.** The renderer unification is closed (PR #302). HUD work does not touch rendering architecture.
8. **No changes to existing UI during audit.** PlaytestHud, ArenaMenu, PauseMenu, and DevtoolsPanel remain unchanged until implementation PRs.

---

## 11. Final recommendation

### Recommended next step

After this audit PR is merged, the first implementation step is **PR 1: HUD Shell** — creating the empty bottom bar container with correct layout, theming, and z-index. This is the lowest-risk PR and establishes the structural foundation for all subsequent panels.

Before PR 1 begins:
- Denis must approve this audit document
- GPT must review the audit for completeness and architectural soundness
- Denis must give explicit visual approval before any runtime HUD implementation starts

### Key risks for the overall HUD work

1. **Selection state does not exist for Normal Game mode.** This is the biggest architectural gap. Creating SelectionState is a prerequisite for the selection panel (PR 3) and context-sensitive command panel (PR 4). It must be carefully designed to avoid coupling with gameplay logic.

2. **PlaytestHud decommissioning must be incremental.** Do not delete PlaytestHud in one PR. Migrate features one at a time (economy → resource strip, build/produce → command panel, etc.) and verify each migration works before removing the old code.

3. **Minimap second camera performance.** While the current sprite count makes this negligible, large maps with many entities could cause frame rate issues. Profile before and after minimap addition.

4. **Input routing conflicts.** The bottom bar occupies screen space that the game currently uses for camera panning and unit commanding. Ensure pointer events on DOM panels do not interfere with Phaser pointer events on the game canvas.

5. **Arena mode HUD is separate.** The ArenaMenu and BlockoutSandboxHudRenderer serve Arena/dev mode. The new bottom bar is for Normal Game mode. Do not try to unify them in the first pass. Arena mode can get a layout refresh later.

### Implementation order rationale

The proposed PR sequence (Shell → Resources → Selection → Commands → Minimap → Devtools → Polish) prioritizes:
1. **Lowest-risk first**: Shell and resource strip are pure display with no new state
2. **Highest-value second**: Selection panel gives the most player-facing value
3. **Medium-complexity third**: Command panel extracts existing logic
4. **Highest-complexity fourth**: Minimap requires new rendering infrastructure
5. **Cleanup fifth**: Devtools separation is important but not blocking
6. **Polish last**: Visual theme is easiest to iterate on once structure is stable

This ordering ensures that each PR is independently shippable and testable, and that no PR depends on a later PR for correctness.

---

## Appendix A: Relationship to VISUAL roadmap phases

| VISUAL Roadmap Phase | This Audit Section | Status |
|----------------------|-------------------|--------|
| V7 (VISUAL-HUD-01) | Sections 3-7 (all panel designs) | This audit provides the detailed design for Phase V7 |
| V7 target layout | Section 3.1 | Bottom bar: minimap + selection + command + resource strip |
| V7 minimap | Section 4 | Second camera approach; MVP shows terrain + units + viewport |
| V7 selection panel | Section 5 | New SelectionState module; MVP shows name/HP/faction/status |
| V7 command panel | Section 6 | Migrate from PlaytestHud; reuse CommandRegistry |
| V7 resource display | Section 7 | Extract from PlaytestHud; same data sources |
| V7 HUD architecture | Section 8 | DOM HUD + Phaser minimap; CSS Grid; per-frame update |

## Appendix B: Files likely touched across all implementation PRs

| File | PRs | Change Type |
|------|-----|-------------|
| `src/phaser/ui/HudShell.ts` | 1,2,3,4,5,7 | New — bottom bar container |
| `src/phaser/ui/ResourceStrip.ts` | 2,7 | New — resource strip |
| `src/phaser/ui/SelectionPanel.ts` | 3,7 | New — selection panel |
| `src/phaser/ui/CommandPanel.ts` | 4,7 | New — command panel |
| `src/phaser/ui/MinimapController.ts` | 5 | New — minimap second camera |
| `src/state/selectionState.ts` | 3 | New — selection state |
| `src/state/buildBlockReasons.ts` | 4 | New — extracted block reason logic |
| `src/phaser/GameScene.ts` | 1,3,5 | Modified — HUD wiring, selection, cameras |
| `src/phaser/render/RenderManager.ts` | 5 | Modified — second camera setup |
| `src/phaser/ui/PlaytestHud.ts` | 2,4 | Modified — remove migrated sections (eventually deleted) |
| `src/phaser/ui/DevtoolsPanel.ts` | 6 | Modified — layout separation |
| `src/phaser/input/GameInputController.ts` | 3 | Modified — add click-to-select |

## Appendix C: Camera projection contract compliance

All HUD work must comply with `CAMERA_PROJECTION_CONTRACT.md`:

- The minimap second camera uses the same isometric projection as the main camera
- The main camera viewport is reduced by the HUD bar height so game content is never hidden behind the DOM bottom bar
- Selection rings and HP bars continue to use ground-plane projection
- No screen-space circles for ground markers
- The HUD DOM layer does not participate in Phaser projection — it is pure screen-space
- Entity dots on the minimap Graphics overlay use a linear world-to-minimap coordinate translation (no isometric projection needed — the second camera already renders the isometric view)

## Appendix D: Arena mode coexistence

Arena mode (ArenaMenu, BlockoutSandboxHudRenderer, BlockoutVehicleInputController) is completely separate from the new Normal Game HUD:

- `ArenaModeContext.showPlaytestHud === false` in Arena mode → PlaytestHud is not created
- `ArenaModeContext.showArenaMenu === true` in Arena mode → ArenaMenu is created instead
- The new HudShell should also respect `ArenaModeContext` — it is not created in Arena mode
- Arena mode keeps its own UI (ArenaMenu, BlockoutSandboxHudRenderer)
- Arena HUD refresh is a separate future task, not part of this audit
