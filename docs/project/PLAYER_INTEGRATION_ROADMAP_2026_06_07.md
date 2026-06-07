# PLAYER_INTEGRATION_ROADMAP_2026_06_07.md

Status: accepted current roadmap, docs-only  
Project: Four Elements Phaser  
Main repo: `ratoker-jpg/four-elements-phaser`  
Source audit: `FOUR ELEMENTS PHASER — NEXT ROADMAP SYSTEM AUDIT`, 2026-06-07  
Roadmap mode: Player-facing integration MVP  
Risk policy: every implementation step in this roadmap is classified as `High` or `High+`  
Bot policy: enemy bot / strategic AI development is explicitly out of scope

---

## 1. Purpose

This roadmap turns the accepted user wishlist and the GLM huge system audit into the current implementation direction.

The goal is not to build a larger engine. The goal is to make the existing engine and asset work visible and usable as a player-facing RTS loop.

Current product problem:

```text
Generated hull and turret assets exist, but the normal public game flow still does not feel like a playable tank RTS.
Assets are visible mostly through dev/Arena flows.
Production, HUD, unit identity, smooth movement, fog/territory/minimap, and player-facing commands are incomplete.
```

Target outcome:

```text
A player opens the normal game, sees generated tanks, understands selected units/buildings/resources through a proper RTS HUD, can produce body+turret tanks through Unit Factory, and movement/combat visuals no longer feel like a blockout prototype.
```

---

## 2. Accepted source inputs

This roadmap is based on:

```text
1. Denis product direction:
   - generated hulls/turrets must work in Standard, Debug, and Arena flows;
   - English player-facing IDs must be replaced by Russian labels;
   - asset calibration must become systemic, not endless one-off tuning;
   - body/weapon configs must include HP, speed, cost, role, tier and balance data;
   - Unit Factory must produce selected body+turret tanks;
   - T1/T2/T3 progression must exist;
   - starter game should include 2 harvesters, 1 builder, and 1 Wasp + Smoky combat unit;
   - movement should feel smooth, with inertia/dust/start/stop behavior;
   - body/turret direction changes need smoothing;
   - Standard mode needs fog of war, territory coloring, minimap, and RTS HUD;
   - combat VFX should come late, after the playable loop.

2. GLM huge system audit:
   - identified 16 product gaps;
   - proposed asset integration, localization, systemic profiles, production/factory, movement feel, fog/territory/minimap, RTS HUD and VFX tracks;
   - proposed High / High+ classification;
   - confirmed no enemy bot / strategic AI work in this cycle.

3. Current repo state:
   - Core Mechanics roadmap is closed after PR #207;
   - generated hull matrix is merged after PR #220/#221/#222;
   - generated turret runtime integration is merged after PR #226/#228;
   - per-hull visual profile fixup is merged after PR #230;
   - Player Integration is the next accepted direction.
```

---

## 3. Execution model

Use this workflow for this roadmap:

```text
1. Roadmap accepted.
2. One detailed implementation audit across ALL roadmap steps.
3. GPT/Denis review and accept the audit as the implementation sequence.
4. Implement Step 1.
5. Review PR.
6. Merge.
7. Implement Step 2.
8. Continue sequentially.
```

Do not use this weaker pattern for the main roadmap:

```text
step audit -> implementation -> next step audit -> implementation
```

That pattern is only allowed if a later implementation step exposes a new unknown blocker that was not covered by the full roadmap implementation audit.

Required next action before any implementation:

```text
PIM-IMPLEMENTATION-AUDIT-01 — Full implementation audit for all Player Integration High/High+ steps.
```

The audit must cover the implementation approach, files/functions, dependency order, risks, validation and manual QA for every track in this document. After the audit is accepted, GLM should implement the agreed steps one by one without re-auditing every step by default.

---

## 4. Non-negotiables

```text
- No enemy bot / strategic AI / base-building AI in this roadmap.
- No full matrix preload of hulls/turrets.
- No copying Canvas implementation code from old repos.
- Reference repos are specification/design sources only.
- Preserve fixed isometric/axonometric projection contract.
- Preserve architecture layers:
  - Pure TS state/logic
  - Phaser rendering
  - DOM HUD/UI
- Renderer must not become gameplay logic.
- DOM HUD must not pull Phaser rendering logic into itself.
- GameScene should remain orchestration-only.
- Each implementation PR must stay scoped and reviewed before merge.
```

---

## 5. High / High+ policy

This roadmap intentionally contains only `High` and `High+` implementation steps.

```text
High+ = blocks visible player-facing progress or foundational architecture.
High  = required for the accepted roadmap, but can come after a High+ prerequisite.
```

Anything below High is not part of the active roadmap. It may be recorded as backlog only.

---

## 6. Pre-implementation audit gate

| ID | Risk | Step | Scope |
|---|---:|---|---|
| PIM-IMPLEMENTATION-AUDIT-01 | High+ | Full implementation audit for all Player Integration steps | One large audit covering Tracks A-J, exact implementation order, files/functions, dependencies, risks, validation and manual QA. No code changes. |

Expected audit output:

```text
- per-track implementation strategy;
- exact PR sequence;
- files/functions likely touched per step;
- risk notes for every High/High+ step;
- dependency graph;
- what can run in parallel and what cannot;
- where GLM is enough;
- where Codex/Blender/local asset analysis may be needed;
- validation commands per step;
- manual QA checklist per step;
- explicit out-of-scope list;
- final implementation order for Step 1, Step 2, Step 3, etc.
```

---

## 7. Accepted tracks

### Track A — Asset visibility across player modes

Goal: generated hulls and turrets must appear in Standard, Debug, and Arena through normal game flows, not only obscure query strings.

| ID | Risk | Step | Scope |
|---|---:|---|---|
| PIM-A01 | High+ | Bounded generated asset loading for public game flow | Load only the current faction / needed M0 sets / visible mode subset. No full matrix preload. |
| PIM-A02 | High+ | Generated hull/turret rendering in Standard + Debug + Arena | Use the same renderer contract and fallback policy across modes. |
| PIM-A03 | High | Public mode entry cleanup | Player should not need obscure query strings to see the game’s current visual baseline. |
| PIM-A04 | High | Asset loading validation docs/tests | Validate no 1792/2560 full preload, no 404, fallback remains safe. |

Acceptance:

```text
- generated Wasp + Smoky is visible in Standard flow;
- Arena still works;
- Debug mode still works;
- missing texture falls back safely;
- Network does not show full matrix preload.
```

---

### Track B — Russian unit identity and player-facing labels

Goal: internal English IDs stay in code, but player-facing UI uses Russian names.

| ID | Risk | Step | Scope |
|---|---:|---|---|
| PIM-B01 | High | Unit localization map | Add canonical Russian labels for 7 hulls and 10 weapons. |
| PIM-B02 | High | Arena/UI label replacement | Replace player-facing `wasp`, `smoky`, etc. in Arena roster, labels, tooltips, selected info. |
| PIM-B03 | High | Composite display names | Show tank identity as `Оса + Смоки`, `Викинг + Рельса`, etc. |

Initial canonical labels:

```text
Bodies:
wasp -> Оса
hornet -> Шершень
hunter -> Хантер
viking -> Викинг
dictator -> Диктатор
titan -> Титан
mammoth -> Мамонт

Weapons:
smoky -> Смоки
railgun -> Рельса
thunder -> Гром
twins -> Близнецы
freeze -> Фриз
firebird/flamethrower -> Огнемёт
isida -> Изида
ricochet -> Рикошет
vulcan -> Вулкан
hammer -> Молот
shaft -> Шафт, fallback/procedural until generated assets exist
```

---

### Track C — Systemic asset profile contract

Goal: stop treating per-hull/per-turret placement as endless manual tuning.

Important: this track should not block the first playable tank production MVP. Current per-hull profiles may remain as runtime bridge while the systemic contract is designed.

| ID | Risk | Step | Scope |
|---|---:|---|---|
| PIM-C01 | High+ | AssetProfile contract doc | Define profile fields: art bounds, ground anchor, mount point, scale, origin, offsets, UI offset. |
| PIM-C02 | High+ | Runtime profile interface | Add typed profile model that can support generated metadata later. |
| PIM-C03 | High | Profile validation tests | Validate finite/sane values for all current hulls/turrets. |
| PIM-C04 | High | Blender pipeline metadata design | Define how future render scripts should output profile metadata. No mass asset rewrite in this step. |
| PIM-C05 | High | Runtime migration plan from hardcoded values | Replace manual constants when metadata is trustworthy. |

Potentially needs Codex/Blender/local analysis:

```text
PIM-C04 may need local PNG analysis or Blender render-script inspection to design automatic artBounds / groundAnchor / mountPoint extraction.
```

Do not do now:

```text
- do not rerender assets just to satisfy the profile contract;
- do not block factory MVP on perfect metadata generation;
- do not preload all profiles/assets through a broad runtime rewrite.
```

---

### Track D — Body/weapon balance and production data

Goal: bodies and weapons become game objects that can be balanced, priced, tiered, produced and displayed.

| ID | Risk | Step | Scope |
|---|---:|---|---|
| PIM-D01 | High+ | Body production config | HP, armor, speed, acceleration, braking, turn speed, mass, role, cost, tier, production time. |
| PIM-D02 | High+ | Weapon production config | Damage, range, reload, projectile speed/type, turret turn speed, cost, tier, VFX profile. |
| PIM-D03 | High+ | T1/T2/T3 config model | Config-only tech tiers, unlocks, prerequisites. No full upgrade UI yet. |
| PIM-D04 | High | Body/weapon compatibility rules | Initially allow most combinations, but encode constraints and future balance hooks. |
| PIM-D05 | High | Balance table doc | Human-readable body/weapon matrix with roles and intended use. |

Initial accepted direction:

```text
T1: Wasp, Hornet, Hunter / Smoky, Railgun
T2: Viking, Dictator / Thunder, Twins, Freeze
T3: Titan, Mammoth / Flamethrower, Isida, Ricochet, Vulcan, Hammer
Shaft remains fallback/special until generated visual support is ready.
```

Open balance values are allowed to be approximate in the first PRs, as long as they are config-driven.

---

### Track E — Unit Factory tank production MVP

Goal: player can build/choose/produce body+turret combat units.

| ID | Risk | Step | Scope |
|---|---:|---|---|
| PIM-E01 | High+ | Tank production state model | Body selection, weapon selection, cost calculation, queue item, M0 default. |
| PIM-E02 | High+ | Unit Factory composer UI MVP | Click factory -> choose body -> choose weapon -> see cost/stats/time -> confirm. |
| PIM-E03 | High+ | Tank production queue and spawn | Produced tank spawns near factory with correct hull/turret/faction/M0. |
| PIM-E04 | High | Tier gating in factory UI | Lock unavailable T2/T3 bodies/weapons with visible requirement. |
| PIM-E05 | High | Starter combat unit | Normal game starts with 2 harvesters, 1 builder, 1 Wasp + Smoky M0. |

Acceptance:

```text
- player can produce at least Wasp + Smoky and Hunter + Railgun at T1;
- cost and production time are visible;
- produced unit has generated sprites if loaded;
- no gameplay systems outside production/factory are rewritten.
```

---

### Track F — Movement feel and visual smoothing

Goal: movement must stop looking like tile-step micro-stutter.

| ID | Risk | Step | Scope |
|---|---:|---|---|
| PIM-F01 | High+ | Visual interpolation between logical tile positions | Render-only smoothing. Logic/pathfinding/occupancy remain tile-safe. |
| PIM-F02 | High | Acceleration/braking visual easing | Start/stop smoothing without changing combat/pathfinding logic. |
| PIM-F03 | High | Dust MVP by body weight | Light/medium/heavy dust profiles, stops when unit stops. |
| PIM-F04 | High | Inertia MVP | Light bodies lift/lean more; heavy bodies less; no idle bobbing. |
| PIM-F05 | High | Body/turret direction smoothing MVP | Reduce slideshow feel with easing/crossfade strategy if feasible. No 32-dir asset expansion by default. |

Rules:

```text
- logical state remains authoritative;
- visual state can interpolate;
- no unit overlap regression;
- no pathfinding rewrite;
- no idle wobble.
```

---

### Track G — RTS HUD MVP

Goal: replace economy-only HUD with basic RTS player-facing layout.

| ID | Risk | Step | Scope |
|---|---:|---|---|
| PIM-G01 | High+ | RTS HUD shell | Bottom-left minimap placeholder, center info panel, bottom-right command grid. DOM/CSS. |
| PIM-G02 | High+ | Selected object info panel | Unit/building/resource info: name, HP, stats, M-level, kills/damage, resource amount, queue. |
| PIM-G03 | High | Command grid skeleton | Stop, attack, hold, upgrade placeholder, build/factory actions, hotkey labels. |
| PIM-G04 | High | Factory HUD integration | Body/weapon composer hooks into command/info panels. |
| PIM-G05 | High | Multi-select info MVP | Show selected group icons/counts without complex control groups expansion. |

Do not copy StarCraft assets. Use only layout logic.

---

### Track H — Upgrade / M-level progression

Goal: M0-M3 becomes player-facing progression, not just config scaling.

| ID | Risk | Step | Scope |
|---|---:|---|---|
| PIM-H01 | High | Combat contribution tracking | Track kills + damage dealt. Healing/support contribution for Isida can be added later. |
| PIM-H02 | High | Upgrade availability state | M1/M2/M3 thresholds and available body/turret upgrade choices. |
| PIM-H03 | High | Upgrade UI MVP | Select unit -> show upgrade option -> choose body or turret upgrade. |
| PIM-H04 | High | T3 direct higher-mod production design | Config/design first; implementation only if approved after MVP. |

Initial contribution rule can start as:

```text
combatContribution = kills * KILL_WEIGHT + damageDealt * DAMAGE_WEIGHT
```

Exact constants are balance config, not hardcoded logic.

---

### Track I — Strategic layer: fog, territory, minimap

Goal: add RTS information warfare and map control after the basic playable loop is visible.

| ID | Risk | Step | Scope |
|---|---:|---|---|
| PIM-I01 | High | Vision/fog architecture | Pure TS visible/explored model, no Phaser imports. |
| PIM-I02 | High | Fog renderer MVP | unexplored / explored-not-visible / visible overlay. Standard mode first. |
| PIM-I03 | High | Territory architecture | Tile ownership and spread model. Reference sandbox/next specs. |
| PIM-I04 | High | Territory renderer MVP | Faction-colored isometric tile overlays. Projection-compliant. |
| PIM-I05 | High | Minimap MVP | Terrain bounds, units/buildings/resources, fog/territory, camera viewport. |

Ordering rule:

```text
Fog architecture before territory rendering.
Territory can grant vision only after fog/vision exists.
Minimap can be placeholder in HUD first, then functional after fog/territory MVP.
```

---

### Track J — Combat VFX late slice

Goal: make combat readable and satisfying after unit production/HUD/movement foundation exists.

| ID | Risk | Step | Scope |
|---|---:|---|---|
| PIM-J01 | High | Weapon VFX profile design | Map weapon -> muzzle/projectile/hit/explosion profile. |
| PIM-J02 | High | Muzzle flash MVP | Visual-only fire feedback. |
| PIM-J03 | High | Projectile/beam renderer MVP | Shell/beam/rocket styles where appropriate. |
| PIM-J04 | High | Hit/explosion effects MVP | Hit confirmation, splash readability. |

Do not start Track J before Tracks A, D, E, F and G have usable MVP results.

---

## 8. Recommended implementation order

The final order must be confirmed by `PIM-IMPLEMENTATION-AUDIT-01` before implementation starts. Current roadmap-preferred order is:

```text
0. PIM-IMPLEMENTATION-AUDIT-01 — full implementation audit across Tracks A-J
1. Track A — asset visibility across player modes
2. Track B — Russian names and unit identity
3. Track F — movement feel / jerk reduction MVP
4. Track D — body/weapon production configs and tiers
5. Track E — Unit Factory tank production MVP
6. Track G — RTS HUD MVP
7. Track H — M-level progression
8. Track I — fog / territory / minimap
9. Track J — combat VFX late slice
10. Track C — systemic asset profile contract can run in parallel as docs/design, but must not block Track E MVP
```

Rationale:

```text
- First audit the implementation route for every step.
- Then make current assets visible in real game flows.
- Then make them understandable to the player.
- Then fix the most visible feel issue: jerky movement.
- Then make tanks producible.
- Then expose state/actions through HUD.
- Then add progression and strategic layers.
```

---

## 9. Current next action

Before any implementation PR, run:

```text
PIM-IMPLEMENTATION-AUDIT-01 — Full implementation audit for all Player Integration High/High+ steps.
```

This audit replaces separate per-step audits by default.

Only after GPT/Denis accept that audit should implementation begin with the first agreed step.

---

## 10. Out of scope for this roadmap

```text
- enemy bot / strategic AI;
- enemy economy / base-building AI;
- enemy attack-wave AI;
- new 3D render batch generation unless required by asset profile work;
- 32-direction sprite expansion by default;
- mass asset rerendering;
- full matrix preload;
- copying old Canvas runtime code;
- replacing Phaser renderer architecture wholesale;
- broad economy redesign unrelated to tank production;
- victory/loss campaign layer.
```

---

## 11. Validation baseline

Every implementation PR must run or explicitly report why it could not run:

```bash
npm run typecheck
npm run test
npm run build
npm run qa:smoke
```

Asset-related PRs should also run when applicable:

```bash
node tools/validate_hull_assets.mjs
node tools/validate_turret_assets.mjs
```

Manual QA must be specific to the track.

---

## 12. Manual QA baseline by track

```text
Track A:
- Standard, Debug, Arena show generated hull/turret where expected;
- no full preload;
- no 404;
- fallback still works.

Track B:
- player-facing labels are Russian;
- internal IDs remain stable.

Track F:
- moving units no longer visibly step cell-by-cell;
- dust starts/stops correctly;
- no idle bobbing;
- direction smoothing improves rotation without wrong aim.

Track E:
- Unit Factory can produce selected body+turret M0 tank;
- spawned tank has correct sprites, team, stats and selection behavior.

Track G:
- selected unit/building/resource shows useful info;
- command grid changes by context;
- UI remains readable at normal resolution.

Track I:
- fog has visible/explored/unexplored states;
- territory spreads by cells;
- minimap reflects camera and known entities.
```

---

## 13. Docs to create during roadmap

Create these only when their track starts, not all at once:

```text
docs/project/PLAYER_INTEGRATION_IMPLEMENTATION_AUDIT_2026_06_07.md
docs/project/ASSET_PROFILE_CONTRACT.md
docs/project/BODY_WEAPON_PRODUCTION_MODEL.md
docs/project/TIER_PROGRESSION_MODEL.md
docs/project/MOVEMENT_FEEL_SPEC.md
docs/project/RTS_HUD_LAYOUT.md
docs/project/FOG_TERRITORY_MINIMAP_ARCH.md
docs/project/COMBAT_VFX_SPEC.md
```

---

## 14. Final decision

This roadmap accepts the GLM audit as source material, but trims it into a current High / High+ roadmap.

Current accepted direction:

```text
PLAYER-INTEGRATION-MVP
```

Required next action:

```text
PIM-IMPLEMENTATION-AUDIT-01 — full implementation audit across every roadmap step.
```

After that audit is accepted, implement the agreed steps sequentially. Do not start bot work. Do not expand scope without Denis/GPT approval.

Audit complete. Ready for GPT review.
