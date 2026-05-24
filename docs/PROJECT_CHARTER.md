# PROJECT_CHARTER — Four Elements Phaser

## 1. Final decision

We are creating a new Phaser-first repository for Four Elements.

Final decisions:

- New repository: `four-elements-phaser`.
- Engine: Phaser 4.
- Copy policy: approved assets only.
- Donor repo: `ratoker-jpg/four-elements-next`.
- Donor repo usage: reference/specification only.
- Old TypeScript code is not copied as implementation.
- Canvas → Phaser bridge development is stopped as the main direction.

## 2. Product goal

Build a browser-playable isometric RTS / civil sandbox.

Initial product focus:

- base/HQ;
- desert/sand terrain;
- resources/minerals;
- harvester movement;
- gather/deliver loop;
- resource counter;
- one constructible building;
- readable VFX/feedback;
- civil loop that feels good before combat.

## 3. What we are not building yet

Blocked until civil loop is stable and fun:

- combat;
- enemy AI;
- factions/bonuses;
- save/load;
- map editor;
- tech tree;
- fog of war;
- advanced economy;
- multiplayer.

## 4. Architecture principles

| Area | Owner | Rule |
|---|---|---|
| Boot/preload | Phaser scenes | load assets only, no gameplay rules |
| Game lifecycle | Phaser GameScene | orchestration only |
| Game state | Pure TypeScript | single source of truth |
| Systems | Pure TypeScript where practical | mutate/update state, no Phaser imports |
| Input | Phaser input module | translates player actions into commands |
| Rendering | Phaser render modules | mirrors state into visuals |
| VFX | Phaser VFX modules | visual only, no rule changes |
| UI/HUD | DOM or dedicated UI module | reads state, sends commands |
| Assets | Asset manifest + Phaser loader | explicit approved assets only |
| Tests | Vitest/Playwright | logic tests + browser smoke |

## 5. Hard architecture rules

- No Canvas renderer.
- No renderer bridge.
- No dual renderer.
- No old `GameWorld`.
- No `WorldRenderSnapshot`.
- No migration scaffolding.
- No old systems copied as implementation.
- No feature flags for architecture alternatives.
- Debug flags are allowed only if isolated and explicitly scoped.
- GameScene must not become a God Object.
- Game rules must be testable without Phaser where practical.

## 6. Copy/reference/reject policy

### Copy allowed

Only approved assets:

- terrain/sand;
- HQ/building sprites;
- harvester/builder/unit sprites;
- minerals/resources;
- obstacles/decor;
- UI icons only if explicitly approved.

### Reference only

- gameplay ideas;
- economy rules;
- harvesting/construction behavior;
- mapgen lessons;
- sprite profile values;
- VFX behavior;
- old tests as scenario examples;
- docs/roadmap decisions.

### Forbidden to copy

- old Canvas renderer;
- old Phaser bridge;
- old `GameWorld`;
- old systems implementation;
- old pathfinding implementation;
- old E2E tests;
- old devtools/editor implementation;
- renderer feature flags;
- migration scaffolding.

## 7. File size guidance

- Target: under 150 lines where practical.
- Warning: 150–250 lines.
- Hard stop: 300+ lines without explicit justification.
- `GameScene` must stay orchestration-only even if under the line limit.

Line count is a guardrail, not a religion. Clear ownership matters more than artificial micro-files.

## 8. PR rules

Every PR must include:

- goal;
- allowed files;
- forbidden files;
- Phaser skills read;
- acceptance checklist;
- validation commands/results;
- manual QA;
- rollback plan;
- out-of-scope list.

Do not merge a PR that:

- copies old implementation code;
- introduces Canvas/fallback/bridge;
- hides architecture decisions inside feature code;
- expands beyond its acceptance checklist;
- adds “temporary” code that is expected to be cleaned later;
- starts combat/editor/save-load before approved.

## 9. Stop conditions

Stop and rethink if:

- old source code starts being copied;
- Phaser APIs are repeatedly wrong;
- GameScene starts owning rules;
- PR scope grows during implementation;
- visual output is worse than approved assets allow;
- civil loop is not fun/readable by PR5;
- an agent proposes bridge/fallback/dual renderer;
- tests start protecting bad architecture instead of behavior.

## 10. Success criteria after PR5

The restart is successful if:

- app boots in browser;
- real approved assets render;
- camera pan/zoom works;
- HQ/resources/harvester are visible and grounded;
- harvester gathers/delivers;
- resource counter updates;
- one building can be constructed;
- basic VFX makes loop feel alive;
- no Canvas renderer exists;
- no bridge exists;
- no old code was copied.
