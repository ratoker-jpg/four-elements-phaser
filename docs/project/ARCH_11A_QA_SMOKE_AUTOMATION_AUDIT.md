# ARCH-11A — QA Smoke Automation / Sandbox MVP Regression Coverage Audit

Status: audit / design report
Project: Four Elements Phaser
Active repo: `ratoker-jpg/four-elements-phaser`
Phaser version: 4.1.0
Reference repo: `ratoker-jpg/four-elements-next` (donor/reference only)
Date: 2026-05-29

---

## 1. Executive Summary

The current QA smoke test (`tools/qa_smoke.mjs`) verifies only basic game startup: 3 console markers, no console errors, no page errors, no failed asset requests, and a canvas element exists. This was adequate before PR #83–#92, but the Sandbox MVP now has 10 additional features with zero automated regression coverage.

**Key findings:**

- The existing smoke test covers startup-only. It does not verify faction selection, harvester behavior, factory production, unit cap enforcement, factory cancel, or devtools/arena mode.
- Many PR #83–#92 features are already covered by unit tests at the state layer (production, cap, cancel, stripModularCombatFromState), but browser-level regression (correct rendering, no console errors after interactions) is untested.
- The highest-value, lowest-risk improvement is **expanding the Playwright smoke test with additional console markers and a separate devtools/arena URL run**, not adding Playwright interaction tests.
- Playwright interaction tests (clicking HUD buttons, verifying DOM text) are feasible but carry flake risk from async DOM rendering, animation timing, and browser startup variance. They should be deferred or kept minimal.
- **Recommendation:** ARCH-11A implementation should be Option B — expand console markers + dual-mode smoke (standard + devtools) + minimal DOM assertion for HUD text content. This provides meaningful regression coverage without introducing flaky tests.

---

## 2. Repo/Version/Checkpoint Confirmation

| Check | Result |
|-------|--------|
| Active repo | `ratoker-jpg/four-elements-phaser` |
| `package.json` phaser version | `"phaser": "4.1.0"` |
| PR #93 (DOCS-CHECKPOINT-01) merged to main | Yes (commit `2dec6c3`) |
| Source-of-truth audit | `docs/project/PHASER4_AUDIT_CLARIFICATION_RETRY.md` |
| Checkpoint | `docs/project/CHECKPOINT_20260528_SANDBOX_MVP_ENGINE.md` |

All checks passed. No mismatch.

---

## 3. Current QA/Smoke Setup

### 3.1 Scripts in package.json

```text
"qa:smoke": "node tools/qa_smoke.mjs"
"test": "vitest run"
"test:watch": "vitest"
"typecheck": "tsc --noEmit"
"build": "tsc && vite build"
```

No `playwright.config.*` file exists. The Playwright dependency (`@playwright/test: ^1.60.0`) is installed but only used programmatically in `qa_smoke.mjs`, not via the Playwright test runner.

### 3.2 What qa_smoke.mjs currently does

1. Runs `npm run build`
2. Starts `vite preview --port 4173`
3. Launches Chromium via Playwright
4. Navigates to `http://localhost:4173?skipMenu`
5. Collects console output, page errors, failed requests
6. Waits for 3 required markers (30s timeout)
7. Checks canvas element exists
8. Takes a screenshot
9. Writes JSON + Markdown report to `_reports/`

### 3.3 Required markers

```text
[PreloadScene] All assets loaded.
[GameScene] All asset textures verified.
[GameScene] State-driven scene ready.
```

### 3.4 Pass criteria

- Zero smoke/script errors
- Zero console errors
- Zero page errors
- Zero failed requests (for .js/.css/.json/.png/.jpg/.webp)
- All 3 required markers found
- Canvas element exists

### 3.5 Artifacts

- `_reports/qa-smoke-screenshot.png` — viewport screenshot (1280x720)
- `_reports/qa-smoke-report.json` — structured report
- `_reports/qa-smoke-report.md` — human-readable report

### 3.6 URL parameters

The test uses `?skipMenu` which triggers `shouldSkipMenu()` in `MainMenuScene.create()`, auto-advancing to `GameScene` with `DEFAULT_SETUP` (cyan faction, fixed map). No devtools, no arena.

### 3.7 Ignored warnings

AudioContext/autoplay/user-gesture/audio-policy/play-rejected warnings are filtered and do not cause failure.

---

## 4. Current Coverage Map

### 4.1 Unit test coverage (Vitest)

27 test files covering state-layer logic:

| Test file | Coverage area |
|-----------|---------------|
| `createInitialState.test.ts` | State creation, modularCombat gating, stripModularCombatFromState |
| `production.test.ts` | Factory queue, spawn, cap recheck, cancel |
| `updateGameState.test.ts` | Harvester movement, gathering, economy |
| `devCommands.test.ts` | Devtools commands, resource add, spawn |
| `statusHelpers.test.ts` | isHarvesterBlocked, getUnitCount, getUnitCap |
| `feedbackEvents.test.ts` | Feedback event creation |
| `construction.test.ts` | Construction site progress |
| `builder.test.ts` | Builder assignment, movement |
| `playtestHud.test.ts` | HUD rendering logic |
| `gameSetup.test.ts` | shouldSkipMenu, getMapDataFromConfig |
| `devArena.test.ts` | Arena map creation, isArenaEnabled |
| `saveGame.test.ts` | Save/load round-trip |
| `occupancy.test.ts` | Build occupancy map |
| `pathfinding.test.ts` | Pathfinding |
| `unitMovement.test.ts` | Unit movement commands |
| `isometric.test.ts` | tileToScreen / screenToTile |
| `separatorProcessing.test.ts` | Separator conversion |
| `directionFromDelta.test.ts` | Direction calculation |
| `unitRenderConfig.test.ts` | Render config mapping |
| `motionFx.test.ts` | Motion dust particle data |
| `mapValidation.test.ts` | Map validation |
| `generatedMap.test.ts` | Generated map creation |
| `buildingPlacementMeta.test.ts` | Building metadata |
| `buildSiteSelection.test.ts` | Build site selection |
| `assetDiagnostics.test.ts` | Asset diagnostics |
| `runtimeGeneratedAssets.test.ts` | Asset manifest validation |
| `uiSettings.test.ts` | UI scale settings |

### 4.2 Browser/Playwright smoke coverage

| Feature | Covered by smoke | Covered by unit tests |
|---------|------------------|-----------------------|
| Build succeeds | Yes (qa_smoke runs build) | N/A |
| Game starts without errors | Yes (3 markers + error checks) | N/A |
| Canvas renders | Yes (canvas check) | N/A |
| Asset loading succeeds | Yes (failed request check) | N/A |
| Faction-specific assets | **No** | Partial (state layer) |
| Harvester walk animation | **No** | **No** |
| Harvester blocked feedback | **No** | Yes (statusHelpers) |
| Factory production | **No** | Yes (production.test) |
| Unit cap enforcement | **No** | Yes (production.test) |
| Factory cancel | **No** | Yes (production.test) |
| ModularUnits skipped (standard) | **No** | Yes (createInitialState.test) |
| ModularUnits loaded (devtools) | **No** | Yes (createInitialState.test) |
| No console errors | Yes (error check) | N/A |
| HUD renders | **No** | **No** |

---

## 5. Coverage Gaps After PR #83–#92

### 5.1 High-value, low-risk gaps

| Gap | Why high-value | Why low-risk to automate |
|-----|---------------|-------------------------|
| Standard mode: modularUnits skipped | Verifies PHASER4-LOAD-02 gate works at browser level | Console marker check only |
| Devtools mode: modularUnits enabled | Verifies PHASER4-LOAD-02 loads 64 extra assets | Console marker check only |
| Faction selection produces correct markers | Verifies FIX-01 wiring for non-cyan | Console marker + DOM check |
| No missing textures | Verifies all faction assets load without errors | Existing error-check infrastructure |

### 5.2 Medium-value, medium-risk gaps

| Gap | Why medium-value | Why medium-risk |
|-----|-----------------|-----------------|
| HUD shows correct economy/unit data | Verifies GameScene → HUD data flow | DOM text is async; timing-sensitive |
| Factory queue visible in HUD | Verifies production rendering | DOM query after state change; flake risk |

### 5.3 Low-value or high-risk gaps (leave for manual QA)

| Gap | Why low-value or high-risk |
|-----|---------------------------|
| Harvester walk animation visual correctness | Visual verification; screenshot comparison is flaky; unit test covers animation play() |
| Selection ring position | Render-dependent; pixel-level; flaky |
| Factory cancel button click | Requires Playwright click on DOM element; timing + async HUD |
| Screenshot comparison / pixel diff | Highly flaky across CI environments, browser versions, font rendering |

---

## 6. Test-Layer Recommendation by Target

| Coverage Target | Unit Test | Integration/State Test | Playwright Marker | Playwright DOM Assert | Screenshot | Not Worth Automating Now |
|----------------|-----------|----------------------|-------------------|----------------------|------------|-------------------------|
| New game start | — | — | **Yes** (existing markers) | — | — | — |
| Faction selection | — | — | **Yes** (add marker) | **Yes** (HUD faction text) | — | — |
| Harvester movement/animation | Yes (state) | Yes (state) | **Yes** (add marker) | — | — | Visual correctness of animation frames |
| Harvester blocked status | Yes (statusHelpers) | — | **Yes** (add marker on blocked) | — | — | Blocked indicator visual |
| Factory production | Yes (production.test) | — | **Yes** (add marker on spawn) | — | — | Production progress bar visual |
| Unit cap | Yes (production.test) | — | **Yes** (add marker on cap hit) | **Yes** (HUD cap text) | — | — |
| Factory cancel | Yes (production.test) | — | — | — | — | Cancel button click interaction |
| Standard mode: modularUnits skipped | Yes (createInitialState) | — | **Yes** (already logged) | — | — | — |
| Devtools mode: modularUnits enabled | Yes (createInitialState) | — | **Yes** (already logged) | — | — | — |
| No console errors | — | — | **Yes** (existing check) | — | — | — |

---

## 7. Flake-Risk Analysis

### 7.1 High flake risk

| Area | Risk | Mitigation |
|------|------|------------|
| Screenshot comparison | Browser rendering varies across OS, GPU, font availability, DPI, anti-aliasing | Do not use screenshot diff for pass/fail; keep screenshots as visual artifacts only |
| DOM HUD text assertions | HUD updates each frame; query timing may miss intermediate state | Use `waitForFunction` or poll with retry; assert only stable end-state |
| Click interactions (factory buttons) | DOM overlay click targets depend on Phaser render completion; async HUD | Defer to later phase; not worth the flake risk now |

### 7.2 Medium flake risk

| Area | Risk | Mitigation |
|------|------|------------|
| Asset loading timeout | Slow CI or network may cause 30s timeout to expire | Keep 30s timeout (generous); log progress milestones |
| Console marker timing | Markers may arrive late if asset loading is slow | Already using polling loop with 500ms intervals |
| Browser startup variance | Chromium launch time varies | Already using `waitForServer()` with 10s timeout |

### 7.3 Low flake risk

| Area | Risk | Mitigation |
|------|------|------------|
| Console marker strings | Markers are deterministic string literals | Exact string matching is reliable |
| Error count checks | Console/page error collection is synchronous | Simple count check is reliable |
| Canvas element check | Canvas exists after Phaser init | Already reliable |

---

## 8. Implementation Options

### Option A: Minimal marker-only smoke expansion

**What it is:** Add 3–4 new console markers in runtime code. Expand `REQUIRED_MARKERS` in `qa_smoke.mjs`. Run once with standard URL.

| Aspect | Detail |
|--------|--------|
| **New markers** | `[GameScene] Faction: {faction}` after state creation; `[PreloadScene] modularUnits loading skipped (standard mode).` (already exists); `[GameScene] Harvester animation ready.` after animation setup |
| **Risk** | Very low — only adds console.log lines and marker checks |
| **Benefit** | Confirms faction state, modularUnits gate, and animation setup at browser level |
| **Touched files** | `GameScene.ts` (add 1–2 console.log), `qa_smoke.mjs` (expand REQUIRED_MARKERS) |
| **Expected flake** | Near zero — no timing-sensitive checks |
| **Validation needed** | Run qa:smoke, verify markers appear in report |
| **Worth doing now?** | Yes, but insufficient on its own — does not test devtools/arena mode |

### Option B: Console markers + dual-mode smoke + minimal DOM assertion

**What it is:** Add markers, split qa_smoke into two runs (standard + devtools), add one stable DOM text assertion for HUD economy readout.

| Aspect | Detail |
|--------|--------|
| **New markers** | `[GameScene] Faction: {faction}`; `[GameScene] Harvester animation ready.`; verify `[PreloadScene] modularUnits loading enabled (devtools/arena mode).` appears only in devtools run |
| **Dual-mode** | Run 1: `?skipMenu` (standard); Run 2: `?skipMenu&devtools=1&arena=1` (devtools/arena). Each run has its own marker set and report. |
| **DOM assertion** | After markers, assert `#hud-economy` element contains "Raw:" and "Units:" text (stable end-state after scene ready) |
| **Risk** | Low — markers are deterministic; DOM assertion waits for stable state |
| **Benefit** | Covers standard vs devtools loading paths; verifies HUD renders; catches faction asset errors at browser level |
| **Touched files** | `GameScene.ts` (add 1–2 console.log), `qa_smoke.mjs` (dual-mode logic, DOM assertion, expanded markers) |
| **Expected flake** | Low — marker checks are deterministic; DOM assertion uses retry/poll |
| **Validation needed** | Run qa:smoke; verify both runs pass; verify devtools run loads modularUnits; verify HUD assertion passes |
| **Worth doing now?** | **Yes — this is the recommended option** |

### Option C: Broader regression suite with production/cancel/cap interactions

**What it is:** Full Playwright test suite with click interactions, production queue verification, cancel button testing, and cap enforcement UI checks.

| Aspect | Detail |
|--------|--------|
| **Scope** | Option B + Playwright click on HUD production buttons, verify queue DOM updates, verify cancel button removes queue item, verify cap reached indicator |
| **Risk** | Medium-high — Playwright click targets on async DOM overlays are timing-sensitive; HUD updates each frame; factory queue state changes are asynchronous |
| **Benefit** | End-to-end verification of production/cancel/cap UI flow |
| **Touched files** | Same as Option B + significant qa_smoke.mjs expansion or new Playwright test files |
| **Expected flake** | Medium — click timing on DOM overlays, async state updates, animation-dependent rendering |
| **Validation needed** | Run qa:smoke 10+ times to measure flake rate; CI matrix across OS |
| **Worth doing now?** | **No** — too much flake risk for the first iteration. Defer to a follow-up after Option B is stable. |

---

## 9. Recommended ARCH-11A Implementation Scope

**Option B: Console markers + dual-mode smoke + minimal DOM assertion**

### 9.1 Specific changes

#### 9.1.1 New console markers in GameScene.ts

Add after state creation in `create()`:

```typescript
console.log(`[GameScene] Faction: ${this.gameState.playerFaction}`);
```

Add after animation setup in `EntityRenderer.renderDynamicInit()` or after the harvester sprites are created:

```typescript
console.log(`[GameScene] Harvester animation ready.`);
```

The following markers already exist and will be used for devtools/arena verification:

```text
[PreloadScene] modularUnits loading skipped (standard mode).     // standard run
[PreloadScene] modularUnits loading enabled (devtools/arena mode). // devtools run
```

#### 9.1.2 Marker sets for qa_smoke.mjs

Standard mode markers:

```text
[PreloadScene] All assets loaded.
[GameScene] All asset textures verified.
[GameScene] State-driven scene ready.
[GameScene] Faction: cyan
[PreloadScene] modularUnits loading skipped (standard mode).
[GameScene] Harvester animation ready.
```

Devtools/arena mode markers:

```text
[PreloadScene] All assets loaded.
[GameScene] All asset textures verified.
[GameScene] State-driven scene ready.
[GameScene] Faction: cyan
[PreloadScene] modularUnits loading enabled (devtools/arena mode).
[GameScene] Harvester animation ready.
```

#### 9.1.3 Dual-mode smoke runs

Split `qa_smoke.mjs` into two sequential runs:

1. **Standard run**: URL `http://localhost:4173/?skipMenu`
   - Verifies: 6 markers, no errors, canvas, HUD text
   - Must NOT find: `[PreloadScene] modularUnits loading enabled`

2. **Devtools/arena run**: URL `http://localhost:4173/?skipMenu&devtools=1&arena=1`
   - Verifies: 6 markers (with devtools marker), no errors, canvas, HUD text
   - Must find: `[PreloadScene] modularUnits loading enabled`

Each run gets its own screenshot and report.

#### 9.1.4 Minimal DOM assertion

After all markers are found, check:

```typescript
const hudEconomy = await page.locator('#hud-economy').textContent();
assert(hudEconomy?.includes('Raw:'), 'HUD economy should show raw resources');
assert(hudEconomy?.includes('Units:'), 'HUD economy should show unit count');
```

This is a stable check because `#hud-economy` is updated each frame and will contain text after the scene is ready.

#### 9.1.5 Report improvements

- Combined pass/fail across both runs
- Per-run screenshots: `qa-smoke-standard.png` and `qa-smoke-devtools.png`
- Per-run JSON reports

### 9.2 What this does NOT include

- No Playwright click interactions
- No screenshot diff comparison
- No factory production/cancel/cap UI testing via Playwright
- No animation frame verification
- No faction-switching smoke (uses default cyan via `?skipMenu`)
- No `playwright.config.ts` (keeps existing programmatic approach)

### 9.3 Expected outcome

- Confidence that standard mode starts correctly with modularUnits skipped
- Confidence that devtools/arena mode starts correctly with modularUnits loaded
- Confidence that faction-specific assets load without errors
- Confidence that harvester animation initializes
- Confidence that HUD renders basic economy readout
- Near-zero flake risk

---

## 10. Files Likely to Change in Implementation

| File | Change type | Description |
|------|------------|-------------|
| `src/phaser/GameScene.ts` | Minor | Add 1–2 console.log markers (faction, animation ready) |
| `tools/qa_smoke.mjs` | Significant | Dual-mode run logic, expanded marker sets, DOM assertion, per-run reports |

Files NOT changed:

- `src/phaser/PreloadScene.ts` — already has correct modularUnits markers
- `src/phaser/render/EntityRenderer.ts` — animation marker may go here instead of GameScene
- `package.json` — no new scripts or dependencies
- No new Playwright test files (keeps existing programmatic approach)

---

## 11. Validation Plan

### 11.1 Implementation validation

| Step | Command | Expected result |
|------|---------|----------------|
| Unit tests | `npm test` | All existing tests pass; test count does not drop |
| Typecheck | `npm run typecheck` | No type errors |
| Build | `npm run build` | Build succeeds |
| Standard smoke | `npm run qa:smoke` | Both runs pass; standard report shows modularUnits skipped; devtools report shows modularUnits enabled |

### 11.2 Manual verification

- Open `?skipMenu` in browser; verify console shows `[GameScene] Faction: cyan` and `[GameScene] Harvester animation ready.`
- Open `?skipMenu&devtools=1&arena=1`; verify console shows `[PreloadScene] modularUnits loading enabled (devtools/arena mode).`
- Verify `#hud-economy` contains "Raw:" and "Units:" text

### 11.3 Flake testing

- Run `npm run qa:smoke` 5 times consecutively
- All 5 runs should pass
- If any run fails, investigate and fix before merging

---

## 12. Reject Criteria / What Not to Automate Yet

### 12.1 Do not add to ARCH-11A

- **Screenshot diff / pixel comparison** — flaky across environments, not worth the maintenance
- **Playwright click interactions** (factory buttons, cancel, build) — timing-sensitive, high flake risk
- **Animation frame visual verification** — cannot reliably verify sprite frames in headless browser
- **Faction-switching smoke** — would require Playwright interaction with NewGameSetupScene DOM; defer
- **Production queue visual check** — requires Playwright interaction; defer
- **Cap enforcement visual indicator** — requires Playwright interaction; defer
- **playwright.config.ts** — not needed for the programmatic approach; adding it would change the test runner paradigm unnecessarily

### 12.2 Reject conditions for the implementation PR

- Any test count drop
- Typecheck or build failure
- qa:smoke fails more than 1 in 5 runs (flake rate > 20%)
- New console markers appear in production game loop hot path (should only be in create/init)
- DOM assertion depends on specific numeric values (use contains checks, not exact match)
- Any change to gameplay behavior, state logic, or renderer logic beyond adding console.log

---

## 13. Ready-to-Send Implementation Prompt for ARCH-11A

```text
Task: ARCH-11A — QA smoke automation / Sandbox MVP regression coverage
Mode: IMPLEMENTATION ONLY

Read first:
- docs/project/GLM_EXECUTOR_RULES.md
- docs/project/ARCH_11A_QA_SMOKE_AUTOMATION_AUDIT.md
- tools/qa_smoke.mjs
- src/phaser/GameScene.ts
- src/phaser/PreloadScene.ts

Goal:
Implement Option B from the audit report: console markers + dual-mode
smoke + minimal DOM assertion.

Scope:
1. Add console markers in GameScene.ts:
   - `[GameScene] Faction: {faction}` after state creation in create()
   - `[GameScene] Harvester animation ready.` after entityRenderer.renderDynamicInit()
2. Expand qa_smoke.mjs:
   - Split into two runs: standard (?skipMenu) and devtools (?skipMenu&devtools=1&arena=1)
   - Define separate REQUIRED_MARKERS for each run
   - Standard run must find "modularUnits loading skipped" marker
   - Devtools run must find "modularUnits loading enabled" marker
   - After markers found, assert #hud-economy contains "Raw:" and "Units:"
   - Per-run screenshots: qa-smoke-standard.png and qa-smoke-devtools.png
   - Per-run JSON reports
   - Combined pass/fail result
3. Do NOT add Playwright click interactions
4. Do NOT add screenshot diff comparison
5. Do NOT change gameplay behavior
6. Do NOT add new dependencies or playwright.config.ts

Hard rules:
- Do not change gameplay logic, state logic, or renderer logic (only add console.log)
- Do not add Playwright interaction tests
- Do not add screenshot comparison
- Do not change package.json
- Do not add combat/enemy/bot/upgrades/progression
- Do not recommend GPU implementation
- Do not change faction from cyan in the default smoke (use DEFAULT_SETUP)

Validation:
npm test
npm run typecheck
npm run build
npm run qa:smoke

Run qa:smoke 5 times and report flake rate.

Telegram notification:
At task completion, send Telegram notification using /home/z/my-project/.telegram-notify.json if available.
Do not expose token. Missing/invalid config or send failure must not block the task.
Report notification status in the final summary:
- sent
- skipped: config missing
- failed: <reason>

Open PR into main.
Do not merge.
```
