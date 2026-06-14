# MODULAR_VEHICLE_ASSET_RUNTIME_SYSTEM_AUDIT_2026_06_14

Status: proposed audit, no code/assets changed
Author: Opus (system architect / deep auditor)
Inputs used: Graphify artifact `graphify-out-d525d9c…` (2330 nodes / 6674 edges / 107 communities, built at `d525d9cd2d08e3f70340cffeb79d848b104cfe5a`), live repo at that exact commit, all mandatory source-of-truth docs, and four targeted read-only code sub-audits (renderer, asset-loader, Arena/state, legacy/Wasp/metadata).
Scope guard: this document changes nothing in the repo. It is the durable plan that downstream GLM/Opus High/High+ steps execute from.

---

## Executive summary

**Repo state.** The repository is at the graph commit and is clean. It is **much further along the modular-vehicle path than the roadmap language implies**, because two large prior cycles already landed:

- **HULL-ASSET-01** shipped the *entire* hull half: 1792 hull PNGs on disk (`public/assets/units/hulls/<hull>/<faction>/<mod>/`, 7 hulls × 4 factions × 4 mods × 16 dirs, 512×512 RGBA), a hand-maintained registry/loader `src/assets/generatedHullAssets.ts` with **per-set lazy loading** (16 PNGs at a time — it explicitly does *not* preload), texture-key + path builders, and live render integration in `BlockoutVehicleRenderer`.
- **TURRET-HULL-CONTRACT** (PRs A–F1) shipped a **pure, tested, forward-compatible normalized socket/pivot math layer** (`src/config/turretAttachmentMath.ts`, `hullTurretVisualProfiles.ts`, `directionalTurretProfiles.ts`, `visualDirectionRemap.ts`) that is **not wired into any renderer yet**.

**Can modular runtime be integrated safely?** Yes — and more cheaply than assumed, *if* cleanup precedes wiring. The missing pieces are narrow and well-defined:

1. **Turret art** — no turret PNG exists anywhere on disk (`find public art -iname "*smoky*"` = nothing). The 640 staging turret PNGs are the real new asset payload. (The 448 staging *hull* PNGs largely duplicate hulls already in the repo — see below.)
2. **A turret asset registry + loader** mirroring the hull one (none exists; there is no `generated_turret_*` key namespace).
3. **One renderer that composes hull sprite + turret sprite via the existing socket/pivot math** (today no renderer reads that math).
4. **Removal of a competing eye-tuned screen-pixel offset stack** that contradicts normalized sockets.

**Biggest blockers (in priority order):**

- **B1 — Two competing vehicle render paths, both dev-gated.** `BlockoutVehicleRenderer` (Arena, hull = sprite / turret = *procedural box*) and `ModularTankRenderer` (the `modular-combat` dev entity, hull *and* turret = sprites but placed by hand-tuned per-direction pixel tables). A modular runtime needs **one** owner; shipping into either without retiring the other risks double-composition (both place a Wasp hull + `getGeneratedHullPlacementOffset`).
- **B2 — Legacy pixel-offset stack vs normalized socket model.** `MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR` / `_HULL_OFFSETS_BY_BODY_DIR` (`worldConfig.ts:37–66`), `MODULAR_SCALE_RATIO` + `MODULAR_ANCHOR_CORRECTION` (`unitRenderConfig.ts`), and `WASP_HULL_OFFSET_X/Y = {-1,12}` are eye-calibrated screen-pixel hacks. They are exactly what "no manual per-PNG offset tuning" forbids, and they must be removed/superseded — not extended.
- **B3 — Pivot data is real but Smoky-only and partly placeholder.** `directionalTurretProfiles.ts` has high-confidence projection-recovered per-direction pivots **only for Smoky**; the single `PivotProfile {0.5,0.5}` and the Wasp socket `{nx:0.5,ny:0.5}` are explicit placeholders the recovery handoff flags as NEEDS-PROOF. The other 6 hulls / 10 weapons have no profiles.
- **B4 — PR #263 (HOLD).** It would ship Smoky art + wire directional turret rendering, but is on hold because Wasp socket data is not projection-backed. **Do not continue it by inertia** (every governance doc says so). This audit supersedes it with a clean-room sequence.
- **B5 — Metadata has no home or schema for the staging package.** Hulls live *outside* the auto-generated manifest; there is no turret registry; image size is passed by callers, not stored. The incoming staging metadata needs a typed, generated home.

**Immediate next implementation step:** **CLEANUP-01 (docs source-of-truth cleanup, GLM, docs-only)** in parallel with authoring **RUNTIME-01 (turret asset resolver + metadata contract, pure TS + tests, GLM)**. Neither touches art or renderer; both are bounded and reference-checkable; together they unblock the pilot. Do **not** import the staging package or touch a renderer first.

**GLM vs Opus split (detail in §15):**

- **GLM** (bounded, audit-backed): docs cleanup; turret registry/loader + metadata contract (pure TS + tests); tiny cyan Wasp+Smoky pilot import + lazy-load; full cyan turret import after proof; Arena/debug QA controls.
- **Opus** (cohesive, cross-system, high regression surface): the **renderer composition + legacy px-stack retirement** (B1+B2 together) — this single step rewires two renderers, deletes the pixel tables, and is the one place where "local patches without whole-system understanding" would do real damage.

---

## 2. Graphify-informed repo map

The graph (2330 nodes, 6674 edges, 107 communities) confirms the active clusters by relationship, not just filename. Highest-degree nodes (centrality): `GameScene.ts` (152) — the god-scene wiring everything; `state/types.ts` + `GameState` (114/84); `blockoutDamage.ts` (75); `BlockoutVehicleInputController.ts` (69); `blockoutVehicleState.ts` (65); `BlockoutVehicleRenderer.ts` (58); `isometric.ts`/`tileToScreen` (59/55); `EntityRenderer.ts` (44). Community→directory mapping yields the clusters the audit cares about:

| Cluster | Graph evidence (community → dominant dirs) | Active code | Verdict |
|---|---|---|---|
| **Renderer** | comm 6 (`phaser/render` + `cameraProjectionContract`), 15, 22, 23 | `BlockoutVehicleRenderer.ts` (1332L), `ModularTankRenderer.ts` (390L), `blockoutVehicleGeometry.ts`, `EntityRenderer.ts`, `depthSorting.ts`, `isometric.ts`, `projectedGroundPrimitives.ts` | **Active**; needs one modular owner |
| **Turret/socket math** | comm 11 (`hullTurretVisualProfiles` + `turretAttachmentMath`) | `config/turretAttachmentMath.ts`, `hullTurretVisualProfiles.ts`, `directionalTurretProfiles.ts`, `visualDirectionRemap.ts` | **Active data layer, unwired** — the intended clean model |
| **Generated asset loader/registry** | comm 18 (`assets/assetDiagnostics` + `runtimeAssetDiagnostics`) | `assets/generatedHullAssets.ts`, `runtimeGeneratedAssets.ts`, `generatedAssetManifest.ts`, `assetManifest.ts`, `assetDiagnostics.ts`, `modularUnitAssets.ts` | **Active** (hull lazy-loader is the reusable precedent); `modularUnitAssets` legacy |
| **Arena UI** | comm 8 (`phaser/ui` + `arenaRoster`), 17 (`arenaInspection`) | `ui/ArenaMenu.ts`, `ArenaUnitComposer.ts`, `DevtoolsPanel.ts`, `AssetViewerPanel.ts`, `state/arenaRoster.ts`, `arenaInspection.ts` | **Active**; host for QA controls |
| **State / runtime vehicle** | comm 4 (`types`+`createInitialState`), 5 (`updateGameState`+`occupancy`), 0/3 (input) | `state/blockoutVehicleState.ts`, `createInitialState.ts`, `devArena.ts`, `coreMechanicsTypes.ts`, `m0m3Scaling.ts` | **Active**; single `modificationLevel`, no hull/turretMod |
| **Old/legacy asset experiments** | inside comm 18 + render | `assets/modularUnitAssets.ts` (8-dir `wasp_m0_hull_*`/`smoky_m0_turret_*`, `enabled:false`), `phaser/debug/Wasp*` (3 files), `ModularTankDebugOverlay.ts` | **Legacy**; archive/remove (see §8) |
| **Tools / scripts** | comm 1 (`tools/process_art_assets.mjs` + tests), comm 16/21 (`phaser/dev` AssetPreview, 62 nodes) | `tools/process_art_assets.mjs`, `qa_smoke.mjs`, `validate_hull_assets.mjs`, `phaser/dev/AssetPreview*` | **Active tooling**; AssetPreview is dev-only |
| **Docs / governance** | comm 14 (`_inbox/visual_proofs`) + non-code docs | `docs/project/*` | Mixed; see §3 |

Graph caveat used responsibly: this is a **code-only** corpus (no docs/image semantics), so the docs inventory (§3) and asset inventory (§4) are filesystem-derived, not graph-derived.

---

## 3. Active vs legacy docs inventory

Classification by each doc's own `Status:`/`Updated:` header plus reference-checking against the current orchestration model.

**Active source-of-truth (keep; all `Updated: 2026-06-14`):** `AGENTS.md`, `README.md`, `docs/project/PROJECT_STATE.md`, `CURRENT_NEXT_STEP.md`, `GPT_WORKFLOW.md`, `AI_ORCHESTRATION_RULES_2026_06_14.md`, `AI_GRAPHIFY_WORKFLOW.md`, `MODULAR_VEHICLE_ASSET_RUNTIME_ROADMAP_2026_06_14.md`, `CAMERA_PROJECTION_CONTRACT.md` (CAMERA-00, accepted), and the four role docs (`GPT_PROJECT_LEAD_INSTRUCTIONS.md`, `GLM_EXECUTOR_RULES.md`, `OPUS_ARCHITECT_AUDIT_RULES.md`, `CODEX_LOCAL_AUDITOR_RULES.md`). **This audit becomes the source-of-truth for the modular runtime design** once committed.

**Already correctly archived/deprecated (leave as-is):** `docs/CURRENT_PROJECT_GUARDRAILS.md`, `docs/archive/*`, `docs/project/archive/*`, `PHASE_2_ROADMAP*`, `MAPLIFE_01_ASSET_READINESS.md`, `docs/ROADMAP.md`, `TERRAIN_02_…`, `NEW_CHAT_HANDOFF.md`.

**Looks active but should be deprecated/archived (FLAG — reference-check first):**

- `START_HERE_FOR_GPT.md` (Status: onboarding, `2026-06-03`) — predates the new orchestration model; superseded by `CURRENT_NEXT_STEP.md` + role docs.
- `NEW_CHAT_HANDOFF_VISUAL.md` (Status: "active handoff for a new GPT/GLM chat") — handoffs are point-in-time; conflicts with "active docs must be few."
- `BLOCKOUT_MVP_ROADMAP.md` (Status: "active roadmap draft") **directly conflicts** with `BLOCKOUT_MVP_CLOSURE_REPORT.md` (Status: "closed"). One must win — closure should.
- `FIX_BACKLOG.md` / `FIX_BACKLOG_ROADMAP_2026_06_12.md` / `FIX_BACKLOG_AUDIT_2026_06_12.md` ("ACCEPTED / SOURCE OF TRUTH") — a parallel "source of truth" that is not referenced by any active reading list; reconcile or archive to avoid two competing backlogs.
- `PHASE_1_FREEZE.md` ("active checkpoint"), `STRONG_MODEL_EXPERIMENTS_2026_06_12.md` ("ACTIVE EXPERIMENT PLAN"), `CODEMAP.md` ("routing map for AI agents") — stale-active; either fold into PROJECT_STATE or mark historical.
- The `VISUAL_*`, `MECHANICS_*`, `PHASER4_*` spike/candidate docs — legitimately historical references; keep but ensure none sit on a required-reading list.

**Modular-relevant docs to mark "superseded by this audit" (keep as reference):** `TURRET_HULL_ATTACHMENT_AUDIT_2026_06_12.md` ("design proposal for review"), `TURRET_HULL_SOCKET_RECOVERY_HANDOFF_2026_06_13.md` ("handoff / stop-point"), `WASP_HULL_DIRECTION_CALIBRATION_AID_2026_06_08.md`, `WASP_HULL_PLACEMENT_CALIBRATION_AID_2026_06_08.md`. These contain the RC-x root-cause analysis and the projection-recovery method — valuable history, but they must not read as active queues.

**Stale `Жду Делай`-style workflow language (reference-check before edit):** present in `docs/project/BLOCKOUT_MVP_ROADMAP.md` and `docs/PR1_TASK.md` (the matches in `AI_ORCHESTRATION_RULES`, the modular roadmap, and `AGENTS.md` are the *prohibition* of the phrase, not usage — leave those). Confirm with `grep -n "Жду\|Делай"` per file before removing.

**Reference-check approach (no deletion by guess):** for each FLAG doc, before archiving run `grep -rn "<doc-basename>" docs README.md AGENTS.md .github` to confirm nothing on an active reading list links to it; move to `docs/project/archive/` (the archive policy already exists) and update any pointer. Do not delete; archive.

---

## 4. Active vs legacy asset paths

Filesystem ground truth (1846 PNG under `public/assets`):

| Path | Contents | Count | Status |
|---|---|---|---|
| `public/assets/units/hulls/<hull>/<faction>/<mod>/` | Generated hull sprites `<hull>_<faction>_<mod>_hull_dirNN_<DIR>.png`, 512×512 | **1792** (448/faction) | **KEEP** — active, lazy-loaded |
| `public/assets/factions/<faction>/{buildings,units}/` | HQ, separator, power_plant, storages, builder/harvester | ~36 | **KEEP** — active |
| `public/assets/environment/resources/` + `resource_asset_manifest.json` | resource field art | — | **KEEP** |
| `public/assets/tiles/`, `public/dev-visual/**` | terrain tiles, visual-02a/04 frames | 13 in dev-visual | **KEEP** (dev-visual is preview-only) |
| `public/assets/units/chassis/wasp_m0/…` | legacy 8-dir modular chassis referenced by `modularUnitAssets.ts` | **absent** (paths dead) | **REMOVE refs** |
| **Turret art (any)** | — | **0** | **MISSING** — the real gap |
| `art/{source,staged,generated}` | scaffolding + sample manifests | 8 files | **KEEP** (pipeline staging) |
| `_inbox/visual_proofs/**`, `task/art-sample/` | historical proofs / sample viewer | — | **ARCHIVE-candidate** (non-runtime) |

**Critical reconciliation — the staging package vs what's already in the repo.** `modular_cyan_v1` reports `hull sets 28 (=7×4 mods, cyan) / 448 PNG` and `turret sets 40 (=10 weapons×4 mods, cyan, Shaft excluded) / 640 PNG`. The repo **already contains the 448 cyan hull PNGs** (and 1344 more for the other three factions). Therefore:

- The staging **hull** payload is *redundant with existing cyan hulls* except possibly as a re-baselined v1 with corrected socket metadata. **Do not blindly overwrite** the existing hulls; first confirm provenance (Codex, read-only) whether staging cyan hulls are byte-identical or a corrected re-export. The practical new payload is **turrets (640) + metadata**.
- This means the roadmap's "import 1088 PNG" should be read as "import ~640 turret PNG + reconcile hull metadata," materially smaller and lower-risk.

**Naming-conflict check vs staging:** existing hull key namespace is `generated_hull_<hull>_<faction>_<mod>_dirNN`; the planned turret namespace (from the recovery handoff) is `generated_turret_<weapon>_<faction>_<mod>_dirNN`. The legacy `modularUnitAssets.ts` still defines `wasp_m0_hull_<faction>_dir<0-7>` and `smoky_m0_turret_<faction>_dir<0-7>` (8-dir, single-digit). The `generated_` prefix was added *specifically* to avoid colliding with those legacy keys (`generatedHullAssets.ts:117`). **Keep the `generated_turret_` prefix; do not reuse `smoky_m0_turret_*`.**

**Keep / deprecate / reference-check / archive-after-proof:**

- **Keep:** `units/hulls/**`, `factions/**`, `environment/**`, `tiles/**`, `art/**`.
- **Deprecate (remove path references, not files — files already absent):** `units/chassis/wasp_m0/**` references in `modularUnitAssets.ts` and the `modularUnits` manifest family.
- **Reference-check before removal:** any `smoky_m0_turret_*` / `wasp_m0_hull_*` key (imported by `ModularTankRenderer` via `resolveModularTurretSpriteKey`) — must be unwired with the renderer step, not before.
- **Archive after proof:** `_inbox/visual_proofs/**`, `task/art-sample/**` — non-runtime; move out of repo root after confirming no tooling references them.

---

## 5. Active vs legacy generated asset registries

**Two distinct "generated" regimes coexist — this is the #1 regeneration hazard:**

1. **`src/assets/generatedAssetManifest.ts` — auto-generated, DO-NOT-EDIT** (written by `tools/process_art_assets.mjs`). Shape: `{ version, generatedAt, families:{ name:{ keys[], loadType:'image'|'spritesheet', frameConfig?, enabled } }, paths:{} }`. Consumed by `runtimeGeneratedAssets.ts` + diagnostics. **Hulls are NOT in it.** Its only "modular" entries are the legacy 8-dir `modularUnits` family, `enabled:false`, pointing at the removed `chassis/` paths.
2. **`src/assets/generatedHullAssets.ts` — hand-maintained** (HULL-ASSET-01), despite the name. Holds the hull dimensions (`GENERATED_HULL_IDS` ×7, `GENERATED_HULL_FACTIONS` ×4, `GENERATED_HULL_MODS` ×4), key/path builders, the **per-set lazy loader** `preloadGeneratedHullSet`, resolvers (`resolveGeneratedHullKey` → key or `null`), the Wasp visual-dir remap, and the hand-tuned Wasp offsets/scale. **This is the reusable precedent for turrets.**

**Runtime loader:** `runtimeGeneratedAssets.ts` loads the *manifest* families and re-exports the hull loader. `loadArenaVisualAssets(scene)` is the only hull entry point and is **hard-wired to `DEFAULT_GENERATED_HULL='wasp'` + `'m0'`** across 4 factions (64 PNG). `modularUnitAssets.ts` is the **legacy 8-dir module**: `loadModularUnitAssets` is `@deprecated` and uncalled, but `resolveModularTurretSpriteKey()` + `MODULAR_TURRET_SPRITE_WEAPONS` are still *imported by* `ModularTankRenderer`.

**Naming mismatch with staging:** the existing hull **path** carries the compass suffix (`…_hull_dir00_E.png`) but the **key** drops it (`…dir00`). The staging "generated TS draft" must follow the same convention or the loader will miss files.

**Decisions:**

- **Reuse** `generatedHullAssets.ts` as the *pattern* (not by extension) for a new sibling **`src/assets/generatedTurretAssets.ts`** (registry + path/key builders + `preloadGeneratedTurretSet` lazy loader). Mirroring keeps one mental model and the existing tests' shape.
- **Create new** the turret registry + a **typed socket/pivot metadata registry** (see §9). Do not stuff turret data into the auto-generated manifest (it would be clobbered by `process_art_assets.mjs`).
- **Migrate** the manifest's `modularUnits` family to `enabled:false`/removed-and-documented (it already is `false`); ensure the generator won't resurrect it.
- **Deprecate** `modularUnitAssets.ts` entirely *with the renderer step* (its only live consumer is `ModularTankRenderer`).

**Generated-file ownership rule (must be written down):** the staging tool must regenerate **only** the new turret registry + metadata TS, and must **not** write to `generatedAssetManifest.ts` (DO-NOT-EDIT) nor clobber the hand-tuned `generatedHullAssets.ts`. State which file the generator owns before any import.

---

## 6. Current renderer ownership

**`BlockoutVehicleRenderer` (1332L, the live Arena path).** Hybrid: body = procedural pseudo-iso box **or** generated hull PNG sprite (`scene.add.image(0,0,hullKey)`, ~`:351`); **turret + barrel are always procedural Graphics** (`:973–1056`). Its `renderVehicle` is a ~750-line god-method owning hull placement, body box, turret box, selection ring (projected ground ellipse via `drawProjectedGroundRing`, `:635–670`), hover ring, target indicator + target-lock dot + enemy diamond (`:678–710`), destroyed state, HP bar + five weapon-resource bars (`:833–942`), damage flash, and three Wasp debug overlays. Depth is owned in `syncFromState` (`:412–483`) via `sortByDepth` + `setDepth(BLOCKOUT_DEPTH+order)` with `HULL_SPRITE_DEPTH_BIAS=-0.5`. Turret mount is **not** from socket metadata — it is `MOUNT_FRACTION_MAP[category]×bodyWidth` along the body axis (`blockoutVehicleGeometry.ts:48–54`), turret angle = gameplay `turretAngle`. Header comment "Uses no PNG assets" is **stale** (it loads hull PNGs) — a documented sign of drift.

**`ModularTankRenderer` (390L, the dev `modular-combat` path).** The only renderer that already composes **hull Image + turret Image as separate sprites** — the planned model. But placement is via **hand-tuned per-direction screen-pixel tables** (`MODULAR_TANK_HULL_OFFSETS_BY_BODY_DIR`, `MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR` in `worldConfig.ts`), turret origin fixed `(0.5,0.5)`, turret key via legacy `getSmokyTurretKey` (8-dir). Live only for `kind:'modular-combat'` entities, which exist only in devtools/arena (`createInitialState.ts:91–114`), so it is **instantiated but idle in normal play**.

**The socket/pivot math layer is unwired** (see §9). No renderer imports `turretAttachmentMath`/`hullTurretVisualProfiles`/`directionalTurretProfiles`.

**Decisions:**

- **Where modular composition belongs:** a single **`ModularVehicleRenderer`** that owns hull sprite + turret sprite composition. Practically, **rewrite `ModularTankRenderer` into it** (it already owns two sprites + direction swaps + a debug overlay), replacing the pixel tables with `resolveTurretAttachmentProfile` + directional pivots. `BlockoutVehicleRenderer` is the **wrong host** for sprite composition (its turrets are procedural and its god-method is high-risk to touch), but it remains the owner of rings/HP/target visuals/depth — which the modular renderer must **reuse, not reimplement**.
- **What must not break:** selection rings, hover rings, target-lock visuals, enemy diamond, HP + resource bars, damage flash, destroyed handling, and depth sorting. These stay where they are; the modular renderer slots the composed sprite into the existing depth/overlay pipeline (extract the overlay widgets into a shared helper if needed, but that extraction is optional and must not change visuals).
- **One cohesive Opus task, not split.** Wiring socket math + retiring the pixel stack + unifying the two render paths is **one** change with a single correctness contract (turret pivot lands on hull socket, per-direction, height-correct). Splitting it invites a half-migrated state where both paths place a hull. This is the strongest Opus-vs-GLM call in the audit.

---

## 7. Current Arena body/weapon/mod/faction flow

- **Unit model:** `BlockoutVehicleState` (`blockoutVehicleState.ts`): `bodyId: BodyId`, `weaponId: WeaponId`, `faction: Faction`, `team: 'ally'|'enemy'`, `bodyAngle`/`turretAngle`/`turretTargetAngle`, and a **single `modificationLevel: number` (M0–M3)** shared by body stats, weapon stats, *and* hull-sprite selection. **There is no `hullMod`/`turretMod` in runtime `src/`** (those tokens appear only in roadmap docs + tankviewer tooling). Separating them is genuinely net-new state.
- **Body selection / weapon selection:** `ArenaUnitComposer` exposes a body grid (`ALL_BODY_IDS`, 7), a weapon grid (`ALL_WEAPON_IDS`, 11), a team toggle, and an AI-mode picker (enemy only). `getSelections()` returns `{body, weapon, team, aiMode}` — **no mod, no faction**.
- **Faction flow:** `Faction = 'cyan'|'green'|'yellow'|'purple'`. Arena hardcodes **ally→cyan, enemy→green** (`devArena.ts:121`); there is no faction picker. For "cyan-only V1," allies already comply; only enemy spawning needs constraining/overriding.
- **Mod model:** `ModificationLevel`/`MODIFICATION_LEVELS` (=4) in `coreMechanicsTypes.ts`; `getMLevelValue`/`clampModificationLevel` in `m0m3Scaling.ts`. `bodyId+mod→asset` mapping lives in `generatedHullAssets.ts` (`modificationLevelToMod`, `resolveGeneratedHullKey`). **Mod is uneditable in Arena today** — created `0`, never reassigned by any UI/key. Turret assets use **no mod** at all.
- **`hullMod`/`turretMod` existence:** **no.** One shared field only.
- **Where debug/QA controls live:** `ArenaMenu` has an **"Inspection" section** (`:268–299`) with Prev/Next Body, Prev/Next Weapon, Reset Pose → `cycleArenaInspectionBody/Weapon` (`arenaInspection.ts`), which live-mutate the selected vehicle and rebuild weapon runtime at the current mod (`:68`). **This is the established pattern and the natural home for mod/faction QA controls + a loaded/fallback readout.** `DevtoolsPanel`/`AssetViewerPanel` already render `buildRuntimeAssetDiagnostics(scene)` and are reachable in Arena (Arena always launches `?devtools=1`).

**UX policy compliance:** add controls into ArenaMenu Inspection / ArenaUnitComposer / DevtoolsPanel — **no new URL flags** (inventory in §13).

---

## 8. Old Wasp/Smoky/manual-offset cleanup

The cleanup target is the **screen-pixel offset stack**, *not* the normalized math layer. Classified:

| Item | Location | Class | Why |
|---|---|---|---|
| `MODULAR_TANK_TURRET_MOUNT_BY_BODY_DIR` / `_HULL_OFFSETS_BY_BODY_DIR` | `worldConfig.ts:37–66` | **REMOVE** | Per-direction screen-px mount tables — the most direct contradiction of "one normalized socket projected per frame." |
| `MODULAR_SCALE_RATIO`, `MODULAR_ANCHOR_CORRECTION` | `unitRenderConfig.ts:79,97` | **REMOVE** | The `0.24→0.12` rescale scar; normalized coords exist to eliminate it. |
| `WASP_HULL_OFFSET_X/Y={-1,12}`, `getGeneratedHullPlacementOffset` | `generatedHullAssets.ts:541,550,558` | **REWRITE** | Permanent Wasp px offset; fold into normalized socket/origin, drop the px form. |
| `WaspHullPlacementCalibrator.ts` + `WaspPlacementCalibrationPanel.ts` | `phaser/debug/` | **REMOVE** | The apparatus that *produces* `{-1,12}`; brittle, Wasp-only, scale-fragile. Unwire from input controller + renderer. |
| `WaspHullDirectionCalibrator.ts` | `phaser/debug/` | **ARCHIVE** | Its result is already baked into the `+4` remap; Wasp-only, won't generalize to 7 hulls. |
| `WASP_HULL_VISUAL_DIR16_REMAP` | `generatedHullAssets.ts:317` | **KEEP-TEMP** | Still the live, correct `+4` remap; retire once profile-driven `remapVisualDir(facingOffset)` fully owns it (already mirrored in `WASP_HULL_DIRECTION_REMAP_PROFILE`). |
| `ModularTankRenderer` + `modular-combat` entity + `ModularTankDebugOverlay` | `render/`, `createInitialState.ts:114` | **REWRITE/retire** | The legacy static path; home of the px tables. Becomes the modular renderer. |
| `modularUnitAssets.ts` (8-dir `wasp_m0_hull_*` / `smoky_m0_turret_*`) | `assets/` | **REMOVE (with renderer step)** | Legacy keys; only consumer is `ModularTankRenderer`. |
| `turretAttachmentMath.ts` | `config/` | **KEEP** | Correct normalized socket/pivot math — the target model, not legacy. |
| `hullTurretVisualProfiles.ts` (types + math) | `config/` | **KEEP; values NEEDS-PROOF** | Normalized types are forward-compatible; Wasp socket `{0.5,0.5}` and Smoky pivot `{0.5,0.5}` and embedded `placementOffset{-1,12}` are placeholders. |
| `PivotProfile` / `resolveTurretPivot` (single-pivot) | `hullTurretVisualProfiles.ts:107,310` | **REMOVE (with renderer step)** | `@deprecated`; superseded by `resolveTurretPivotForDir` (per-direction). |
| `directionalTurretProfiles.ts` (Smoky pivot/muzzle) | `config/` | **KEEP; NEEDS-PROOF tie** | High-confidence projection-recovered Smoky data, but dead until Smoky art lands. |
| PR #263 (HOLD) + unshipped Smoky 512² assets | — | **DO NOT CONTINUE** | Wasp socket not projection-backed; superseded by this audit's sequence. |

**PR #263 footprint:** zero code/comment references — docs-only. It was `TURRET-HULL-CONTRACT-PR-F2` (wire directional Smoky turret rendering + ship Smoky art + remove legacy 256px paths + anchor/socket debug overlays). It is on hold because the Wasp socket value is eyeballed, not projected from the `mount` cube center in `Wasp_0123.3ds`. **Hard rule: do not merge or build on #263; re-derive cleanly.**

---

## 9. Metadata schema decision

**Consume as generated TypeScript constants, not runtime JSON.** Rationale: matches the existing zero-fetch pattern (`generatedAssetManifest.ts`, `directionalTurretProfiles.ts`), is typecheck- and unit-test-validated, tree-shakeable, has no async/load-failure surface, and is deterministic for QA. The staging package ships JSON/manifest + a "generated TS draft"; a **build-time generator** (sibling of `process_art_assets.mjs` / `generate_building_meta`) transforms staging JSON → committed TS. Runtime never reads JSON.

**Schema (reuse what exists, fill the gaps).** The repo already defines the right shapes; the modular contract should standardize on them and add the missing image-size field:

```ts
// Hull socket (exists: hullTurretVisualProfiles.SocketProfile)
interface SocketProfile {
  id: string;                       // 'turret_main'
  normalized: { nx: number; ny: number };          // 0..1 in hull image space
  zHeight: number;                  // world Z above body top (basisZ)
  perDir?: Partial<Record<number, { nx: number; ny: number }>>; // per-dir16 override
}
// Turret pivot/muzzle (exists: directionalTurretProfiles) — PER-DIRECTION, not single
interface DirectionalPivotProfile  { byDir: Record<Dir16Index, {x:number;y:number}> }
interface DirectionalMuzzleProfile { byDir: Record<Dir16Index, {x:number;y:number}[]> } // optional
// Family-level (ADD imageSize; today it is passed by callers — a gap)
interface ModularFamilyMeta {
  family: 'hull'|'turret';
  id: string;                       // hull id or weapon id
  imageSize: { w: number; h: number };  // e.g. 512×512 — REQUIRED, not assumed
  textureScale: number;             // display px = imageSize * textureScale
  facingOffset: number;             // DirectionRemapProfile (replaces per-hull remap table)
  dirCount: 8 | 16;
}
```

- **Hull socket metadata:** `SocketProfile` with optional `perDir`. Authored from the 3D `mount` cube center (projection recovery), **not** eyeballed. Default socket `{0.5,0.5}` is a *fallback*, never a shipped value.
- **Turret pivot metadata:** **per-direction** (`resolveTurretPivotForDir(weaponId, level, dir16)`) — the single `PivotProfile` is deprecated (causes the RC-6 orbit bug). Muzzle metadata optional (for VFX recoil/aim line), same per-direction form.
- **Image size + 512-frame strategy:** store `imageSize` explicitly per family. The repo is 512×512 hulls; confirm turret source size from staging (Codex) — do **not** hardcode 256 (the renderer currently infers it from the caller).
- **Crop/anchor data:** if the staging exports trim/crop boxes, fold them into `normalized` socket/pivot at generation time so runtime always sees full-frame normalized coords (keeps the renderer crop-agnostic).
- **Path/key metadata:** generator emits `generated_turret_<weapon>_<faction>_<mod>_dirNN` keys + `assets/units/turrets/<weapon>/<faction>/<mod>/…` paths, mirroring hull conventions (compass suffix in path, dropped in key).

**Validation tests:** (a) every shipped turret/hull family has a family-meta + (turret) directional pivot profile; (b) all `nx/ny/x/y ∈ [0,1]`; (c) `dirCount` matches the authored file count; (d) key uniqueness across hull+turret namespaces; (e) generator round-trip (staging JSON → TS → re-parse equals input). **Fallback when metadata missing:** resolver returns `null`/center-default; renderer draws the blockout/procedural turret and flags a visible "fallback" diagnostic (§12).

---

## 10. Loader / lazy-loading architecture

**Hard rule (already honored for hulls): never preload all 1088/1792 PNG.** Today boot loads **0 hull PNG in standard mode, 64 in devtools** (Wasp-m0 only). Extend the *same* pattern to turrets.

- **Where it lives:** new `src/assets/generatedTurretAssets.ts` with `preloadGeneratedTurretSet(scene, weaponId, faction, mod)` (16 PNG/set), mirroring `preloadGeneratedHullSet`. Add a thin `src/assets/modularVehicleLoader.ts` that, given a selected `{bodyId, weaponId, faction, hullMod, turretMod}`, requests **exactly the hull set (16) + turret set (16) = 32 PNG** and nothing else.
- **How it's called:** from Arena selection/placement (ArenaMenu/composer), not at boot. `loadArenaVisualAssets` is currently Wasp-m0-hardwired; replace its call sites with the selected-set loader so picking a unit triggers its 32-PNG load. The pilot loads on demand when the user composes Wasp+Smoky cyan.
- **Reuse vs replace:** reuse `preloadGeneratedHullSet` and the `scene.textures.exists(key)` skip-guard. **Replace** the Wasp-m0 hardcoding in `loadArenaVisualAssets`.
- **Avoiding duplicate keys:** keep the per-call `Set` + `textures.exists()` guards, **and add a small module-level "requested sets" ledger** (keyed by the composed set id) to fix the current cross-call gap — both `PreloadScene` and `NewGameSetupScene` call the loader, so a global ledger prevents re-queue churn. Distinct prefixes (`generated_hull_*` vs `generated_turret_*`) prevent cross-family collisions; never reuse legacy `smoky_m0_turret_*`.
- **Cache + fallback:** cache by `hull/turret/faction/hullMod/turretMod` set id; while loading or on miss, render the blockout fallback (§12). No runtime PNG pixel reads.
- **How to test:** unit-test that the selected-set loader queues exactly 32 keys for a valid combo and 0 duplicates; that an unknown weapon queues 0 turret keys (fallback); a Playwright `qa:smoke` arena assertion that composing Wasp+Smoky loads textures without Phaser duplicate-key warnings; assert the boot-load count is unchanged (no preload regression).

---

## 11. Renderer composition plan

Use the **existing** `turretAttachmentMath` formula (it is correct and scale-surviving) rather than the audit prompt's re-origin approach — it keeps both sprites at their natural origin and offsets only the turret center:

```
hullDir16    = remapVisualDir(logicalBodyDir,  hullFacingProfile)     // existing
turretDir16  = remapVisualDir(logicalTurretDir, turretFacingProfile)  // existing

hullCenterToSocketPx  = (socketNorm(hullDir16)  - 0.5) * hullDisplaySize    // perDir socket
turretCenterToPivotPx = (pivotNorm(turretDir16) - 0.5) * turretDisplaySize  // perDir pivot
turretSpriteCenterOffset = hullCenterToSocketPx - turretCenterToPivotPx     // pivot lands on socket

hullScreen   = projectWorldPoint(vehicle.world, z=0)        // ground-contact anchor (contract)
turretScreen = hullScreen + turretSpriteCenterOffset + projectZ(socket.zHeight)  // height via basisZ
hull.setDepth(D);  turret.setDepth(D + ε)                   // existing depthSorting + small bias
```

- **Validate against the camera/projection contract — do not change it.** Hull anchor stays ground-contact/bottom-center (contract §4). Turret **height** must come from `socket.zHeight` projected through `basisZ` via `projectWorldPoint` (the camera-projection-contract path), **not** flat `tileToScreen` — `ModularTankRenderer` currently uses flat `tileToScreen` and would lose turret elevation. Selection rings/ranges/shadows remain projected ground primitives (already correct in `BlockoutVehicleRenderer`).
- **No manual per-PNG offsets.** Delete the `worldConfig` per-dir tables and the scale-correction constants; the normalized socket/pivot replaces them. The only legitimate per-asset numbers are `textureScale` and the projection-recovered `normalized` coords.
- **Direction reconciliation:** hulls are dir16 (with `usesEvenDirOnly` quantization + `facingOffset:4`); legacy turrets were dir8 (`facingOffset:2`); directional pivots are dir16. Standardize the modular turret on **dir16** to match the pivot data; map continuous `turretAngle` → dir16 once, consistently.
- **Ownership:** this lives in the single `ModularVehicleRenderer` (§6), reusing `BlockoutVehicleRenderer`'s ring/HP/target/depth machinery. One owner avoids the double-hull-placement hazard.

---

## 12. Fallback behavior

Every fallback must be **visible and diagnosable, never a crash**. Resolver returns `null`/defaults; renderer degrades gracefully and surfaces a reason.

| Condition | Behavior |
|---|---|
| Unsupported faction (non-cyan in V1) | Use cyan assets if present, else blockout hull + procedural turret; status: `fallback: faction→cyan`. |
| Missing body/hull profile or texture | Procedural blockout body (existing `skipBlockoutBody=false` path); status: `fallback: hull blockout`. |
| Missing weapon/turret texture | Procedural turret box (today's default); status: `fallback: turret blockout`. |
| Missing mod | Clamp to nearest available `m0..m3`; status notes the clamp. |
| Missing direction frame | Use nearest dir (even-dir quantization already exists); status: `fallback: dir nearest`. |
| Missing socket/pivot metadata | Center default `{0.5,0.5}` (acknowledged imperfect) + visible `metadata-missing` flag; never silently ship center as truth. |
| Failed lazy load (loaderror) | Keep blockout, retry-once guard (pattern exists in `NewGameSetupScene` loaderror fallback); status: `load-failed`. |
| Shaft / weapon with no staging asset | Procedural turret (Shaft is excluded from the 40 turret sets by design); status: `no-asset (expected)`. |
| Non-Arena / standard mode | Unchanged behavior; modular composition is Arena/debug-gated, standard play untouched. |

Surface the status via `resolveHullDirectionDiagnostic`-style readouts in the Arena Inspection panel and the DevtoolsPanel asset section (both already exist).

---

## 13. Arena/debug UX plan

**No new URL flags.** Current flag surface (do not extend): `devtools`, `arena`, `skipMenu`, `autostart`, `visual02a/03a/04a`, `map`. Arena = `?devtools=1&arena=1&skipMenu=1`. Query flags remain for automation/smoke only.

- **Choose body / weapon:** already in `ArenaUnitComposer`. Extend `getSelections()` to also carry `{faction, hullMod, turretMod}`.
- **Choose hull mod / turret mod:** add two small steppers. **Per-selected-unit** controls go in `ArenaMenu`'s Inspection section (mirror `cycleArenaInspectionBody/Weapon` → add `cycleArenaHullMod/TurretMod` in `arenaInspection.ts`, rebuilding weapon runtime at the new mod as the existing weapon-cycle already does). **Compose-time defaults** go in the composer.
- **Cyan only for V1:** default faction = cyan; gate non-cyan behind a disabled/"V1: cyan only" affordance; allies are already cyan, constrain enemy spawn (`devArena.ts:121`) to cyan for V1.
- **Show loaded/fallback status:** reuse `buildRuntimeAssetDiagnostics(scene)` in DevtoolsPanel/AssetViewerPanel **plus** a per-unit line in the Inspection panel driven by the resolver `null`/diagnostic. (Note: generated hulls/turrets are currently invisible to diagnostics because they live outside the manifest — add a lightweight "modular sets loaded" probe so the panels report them.)
- **Roster:** `ArenaRosterRow` carries only `bodyId/weaponId/team/hp`; extend with `faction`/`mod` only if rows must display them.

Separating `hullMod`/`turretMod` from the single `modificationLevel` is **net-new state**; keep gameplay stats on the existing single field for V1 and let `hullMod`/`turretMod` drive **asset selection only**, to avoid touching combat balance (a strict non-goal).

---

## 14. Cleanup candidates and order

Ordered so each step de-risks the next; every item lists evidence / risk / reference-check / executor / validation.

1. **Docs source-of-truth cleanup** — *Evidence:* §3 FLAG list + `Жду Делай` in `BLOCKOUT_MVP_ROADMAP.md`/`PR1_TASK.md`. *Risk:* low. *Ref-check:* `grep` each basename across active reading lists before archiving. *Executor:* **GLM** (docs-only). *Validation:* links resolve; required-reading lists consistent.
2. **Asset-path/reference cleanup** — *Evidence:* dead `chassis/wasp_m0` refs; `_inbox`/`task` non-runtime. *Risk:* low–med. *Ref-check:* `grep` for `chassis`, `wasp_m0_hull_`, `smoky_m0_turret_` before touching. *Executor:* **GLM**, but defer the `modularUnitAssets` key removal to the renderer step. *Validation:* typecheck/build; qa:smoke.
3. **Turret registry + metadata contract (additive, no deletions)** — *Evidence:* §5/§9. *Risk:* med. *Executor:* **GLM** (pure TS + tests). *Validation:* new unit tests; typecheck.
4. **Renderer composition + legacy px-stack retirement (the big one)** — *Evidence:* §6/§8/§11. *Risk:* **High+**. *Ref-check:* every consumer of `MODULAR_TANK_*`, `MODULAR_SCALE_RATIO`, `MODULAR_ANCHOR_CORRECTION`, `WASP_HULL_OFFSET_*`, `modularUnitAssets` keys, the 3 Wasp debug files. *Executor:* **Opus** (cohesive, two renderers). *Validation:* full suite + manual Arena QA.
5. **Old tool/script cleanup** — *Evidence:* none required beyond confirming the generator owns only the turret TS. *Risk:* low. *Executor:* **GLM**. *Validation:* generator round-trip test.
6. **Archive plan** — move FLAG docs + `_inbox`/`task` proofs to `docs/project/archive/` / out of root **after proof**, using the existing archive policy. *Executor:* **GLM**.

No broad deletion without the reference inventory above. The Wasp debug files and `modularUnitAssets.ts` are removed **only** as part of step 4 (their consumers die there).

---

## 15. Implementation plan (High / High+)

Sequenced; each step bounded with explicit non-goals and stop rules. Two steps may run in parallel (CLEANUP-01 ∥ RUNTIME-01).

### CLEANUP-01 — Docs source-of-truth cleanup
- **Risk:** High · **Executor:** **GLM** · **Why:** mechanical, reference-checkable, no architecture judgment.
- **Touched:** `docs/**`, `README.md` reading lists, `docs/project/archive/`.
- **Allowed:** mark/move FLAG docs (§3) to archive; remove `Жду Делай` usage in `BLOCKOUT_MVP_ROADMAP.md`/`PR1_TASK.md`; reconcile the BLOCKOUT_MVP roadmap-vs-closure conflict; fix pointers. **Forbidden:** deleting historical docs; touching code/assets; changing the four role docs' policies.
- **Validation:** grep that no active reading list references an archived doc. **QA:** none (docs). **Stop:** if a doc looks active and is referenced by code/CI, leave it and report.

### RUNTIME-01 — Modular turret resolver + metadata contract (pure TS)
- **Risk:** High · **Executor:** **GLM** · **Why:** additive pure TS with tests; hull precedent exists.
- **Touched:** new `src/assets/generatedTurretAssets.ts`, new `src/assets/modularVehicleLoader.ts`, new/extended metadata TS (§9), tests in `src/__tests__/`.
- **Allowed:** turret id/key/path builders; `preloadGeneratedTurretSet`; selected-set loader (32-PNG); family-meta with `imageSize`; resolver returning `null` on miss. **Forbidden:** importing any PNG; wiring into a renderer; editing `generatedAssetManifest.ts`; touching combat/movement/economy.
- **Validation:** typecheck; new unit tests (key uniqueness, [0,1] bounds, 32-key load, fallback nulls). **QA:** none yet. **Stop:** if turret source image size or staging key convention is unknown — raise as open question (Codex), do not guess.

### RUNTIME-02 — Tiny pilot import + lazy load (cyan Wasp + Smoky)
- **Risk:** High+ · **Executor:** **GLM** · **Why:** small, bounded once RUNTIME-01 lands.
- **Touched:** import **only** cyan Smoky turret set(s) (16–64 PNG) under `public/assets/units/turrets/smoky/cyan/m0/…`; wire the selected-set loader to the pilot; (hulls already present).
- **Allowed:** pilot turret PNGs + their generated metadata TS; on-demand load. **Forbidden:** importing the full 640 turret set; preloading; renderer composition; per-PNG offset tuning.
- **Validation:** typecheck/build; loader test asserts 32 keys, no duplicate-key warnings. **QA:** Arena loads Wasp+Smoky cyan without console errors; textures present. **Stop:** if pilot needs >64 PNG or any startup preload — stop and re-scope.

### RUNTIME-03 — Renderer composition in Arena/debug UI (the cohesive step)
- **Risk:** **High+** · **Executor:** **Opus** · **Why:** rewires two renderers, deletes the px stack, single correctness contract (pivot-on-socket, per-direction, height-correct) — splitting risks a half-migrated double-hull state.
- **Touched:** rewrite `ModularTankRenderer`→`ModularVehicleRenderer`; remove `worldConfig` per-dir tables + `unitRenderConfig` correction constants + `WASP_HULL_OFFSET_*` + 3 Wasp debug files + `modularUnitAssets` legacy keys; wire `turretAttachmentMath` + `directionalTurretProfiles`; reuse `BlockoutVehicleRenderer` rings/HP/target/depth.
- **Allowed:** composition math, depth, fallback, Arena gating. **Forbidden:** changing `CAMERA_PROJECTION_CONTRACT.md`; touching combat/movement/economy/mapgen/save-load; new URL flags; eye-tuned offsets.
- **Validation:** full suite (typecheck/test/build/qa:smoke). **QA:** the Arena manual pass (turret pivot stays on hull socket across all 16 dirs and independent turret rotation; rings/HP/target-lock intact; standard mode unchanged). **Stop:** if any per-PNG offset is "needed," the socket/pivot data is wrong — stop and re-derive (Codex/projection), don't tune by eye.

### RUNTIME-04 — Full cyan turret import (after proof)
- **Risk:** High+ · **Executor:** **GLM** (Opus if packaging stays coupled) · **Why:** mechanical once the path is proven.
- **Touched:** import remaining cyan turret sets (up to 640 PNG) + metadata TS; reconcile cyan hull provenance vs staging (Codex-confirmed) — **keep existing hulls unless staging is a verified corrected re-export.**
- **Allowed:** cyan turret PNG + metadata. **Forbidden:** non-cyan import; startup preload of the set; combined matrix.
- **Validation:** `validate_hull_assets`-style turret count check; build; qa:smoke. **QA:** spot-check several weapons across dirs/mods. **Stop:** if any combo wants a manual offset — fix the metadata, not the renderer.

### RUNTIME-05 — Broaden Arena modular QA UI
- **Risk:** High · **Executor:** **GLM** · **Why:** UI within existing surfaces.
- **Touched:** `ArenaUnitComposer` (mod/faction selectors), `ArenaMenu` Inspection (`cycleArenaHullMod/TurretMod` + status readout), `arenaInspection.ts`, optionally `ArenaRosterRow`, DevtoolsPanel modular-set probe.
- **Allowed:** choose body/weapon/hullMod/turretMod (cyan only V1), loaded/fallback status. **Forbidden:** new URL flags; balance changes (mods drive *assets* only in V1); non-cyan.
- **Validation:** typecheck/test/build/qa:smoke (arena run). **QA:** pick each body × Smoky, toggle mods, confirm correct set loads + status. **Stop:** if mod separation forces combat-stat changes — descope to asset-only.

---

## 16. Validation plan

- **Per implementation PR:** `npm run typecheck`, `npm run test` (vitest; baseline ~1700 tests at last Arena closure), `npm run build` (`tsc && vite build`), `npm run qa:smoke` (Playwright dual-mode: standard + devtools/arena, via `qa-smoke.yml`). If a command cannot run, say why — never claim a pass that did not execute.
- **Targeted asset/loader tests:** selected-set = 32 keys; key uniqueness across hull/turret namespaces; metadata bounds [0,1]; generator round-trip; **boot-load count unchanged** (no preload regression — assert standard=0, devtools=baseline hull set).
- **Graphify rerun:** re-run the GitHub Actions Graphify workflow **after RUNTIME-03** (architecture changes) to refresh the renderer/asset communities for the next audit; do not commit the artifact.
- **Manual Arena QA (RUNTIME-03 gate):** place ally Wasp+Smoky cyan; rotate body through all 16 dirs and confirm the turret pivot stays glued to the hull socket; rotate the turret independently of the hull; confirm selection ring/HP/target-lock/enemy-diamond and depth ordering are unchanged; confirm standard Normal Game is visually unchanged; confirm a missing-asset combo shows a visible blockout fallback, not a crash.

---

## 17. Strict non-goals

- No combined hull × turret production matrix (the rejected direction).
- No startup preload of all 1088/1792 PNG; boot-load count must not regress.
- No all-factions in V1 — **cyan only**; mods drive asset selection only (no combat-balance change).
- No new URL flag sprawl — QA lives in Arena/debug DOM surfaces.
- No combat / movement / economy / pathfinding / mapgen / save-load changes during this work unless a step explicitly scopes it.
- No PR #263 continuation; no building on its branch.
- No manual per-PNG offset tuning as source of truth; sockets/pivots come from projection recovery.
- No broad deletion without the §14 reference inventory.
- No `CAMERA_PROJECTION_CONTRACT.md` changes; no camera rotation; no Canvas/dual renderer/renderer bridge/legacy GameWorld (per AGENTS.md non-goals).
- No local-first repo validation requirement — use GitHub Actions/artifacts.

---

## 18. Open questions for Denis / GPT

1. **Hull provenance:** are the staging `modular_cyan_v1` cyan hulls byte-identical to the 448 cyan hulls already in the repo, or a corrected re-export with new socket metadata? (Codex read-only check.) Drives whether RUNTIME-04 overwrites hulls or only imports turrets.
2. **Turret source image size:** are staging turrets 512×512 16-dir (like hulls) or 256×256? Needed to set `imageSize` in the metadata contract (do not hardcode).
3. **Wasp socket value:** confirm the projection-recovered Wasp `turret_main` socket (center of the `mount` cube in `Wasp_0123.3ds`) so we never ship the placeholder `{0.5,0.5}`. This is the exact blocker that put PR #263 on hold.
4. **hullMod vs turretMod semantics:** for V1, is it acceptable that separate hull/turret mods affect **assets only** (gameplay stats stay on the single `modificationLevel`)? This keeps combat untouched.
5. **Pilot scope:** is the pilot strictly cyan Wasp+Smoky (recommended), or should it include a second weapon to prove the per-weapon directional-pivot path earlier?
6. **Generator ownership:** confirm the staging tool writes **only** the new turret registry + metadata TS, never `generatedAssetManifest.ts` (DO-NOT-EDIT) or the hand-tuned `generatedHullAssets.ts`.
7. **Doc conflicts:** OK to let `BLOCKOUT_MVP_CLOSURE_REPORT.md` win over `BLOCKOUT_MVP_ROADMAP.md`, and to archive `START_HERE_FOR_GPT.md` / `NEW_CHAT_HANDOFF_VISUAL.md` / the `FIX_BACKLOG*` trio?

---

Recommended next step: GPT should review this audit, then create the first High/High+ implementation prompt for the chosen executor.
