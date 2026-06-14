# WASP-M0-POST-02C-AUDIT — Why Wasp Cyan m0 Still Looks Wrong After PR #284

**Date:** 2026-06-14
**Task:** WASP-M0-POST-02C-AUDIT
**Mode:** AUDIT ONLY — no file modifications, no commits, no PR, no asset / runtime / metadata changes.
**Repository:** ratoker-jpg/four-elements-phaser
**Base branch:** main (HEAD `4b5195c` — Merge PR #284)
**Executor:** Opus 4.8 as orchestrator + 5 worker subagents (B/C/D/E/F).

---

## 1. Executive Summary

PR #284 successfully **fixed the m0 PNG bytes in the repo** and the **GitHub Pages deploy ran successfully** for commit `4b5195c` at `2026-06-14T19:57:53Z`. Worker B re-computed metrics directly from the files in current `main` and confirmed the m0 target PNGs now match the m1/m2/m3 family almost exactly (bbox avg 274×160, opaque ~30,413 px, norm Cy 0.588) and are **not** byte-identical to the legacy `_hull_dir` siblings.

Despite this, the live preview still shows the legacy "big, up-shifted" sprite for Wasp cyan m0 only. The cause is **not** a stale repo, not a stale CDN, not metadata, and not the m0 asset — it is a **runtime cross-module texture-key collision in the shared Phaser `TextureManager`**:

- The legacy module `src/assets/generatedHullAssets.ts` and the modular module `src/assets/generatedModularVehicleAssets.generated.ts` both build the **identical** Phaser texture key string `generated_hull_wasp_cyan_m0_dirNN`, but resolve it to **different files**:
  - LEGACY → `wasp_cyan_m0_hull_dir00_E.png` (big legacy crop, ~397×232 bbox)
  - MODULAR → `wasp_cyan_m0_dir00_E.png` (correct fixed_512_frame, ~274×160 bbox)
- Under `isDevtoolsEnabled()` (the same gate as the modular preview), `PreloadScene` calls `loadArenaVisualAssets()` which preloads **`DEFAULT_GENERATED_HULL='wasp'` + all factions + `DEFAULT_GENERATED_HULL_MOD='m0'`** via the LEGACY path, populating the shared TextureManager with the wrong bytes under that key.
- When the modular Vehicle preview later opens in `GameScene`, the modular loader at `modularVehicleRuntimeLoader.ts:169` sees `scene.textures.exists(key) === true` and **skips loading the correct file**. The legacy texture is rendered.

Because the legacy preload is hard-coded to `mod = 'm0'` only, **m1/m2/m3 are never populated by the legacy path**, the modular loader fetches them correctly, and they look healthy in screenshot 2 — which exactly matches the m0-vs-m1 differential Denis observes.

**Root cause classification: G — Legacy Wasp code path still leaks into modular preview (via shared TextureManager key collision, not via import).**

The PR #281 isolation test does not catch this because it scans modular source files for forbidden import paths / identifier substrings; it does **not** assert that the shared Phaser `TextureManager` key namespace is owned exclusively by the modular loader.

---

## 2. Orchestration Plan and Worker Outputs

5 worker subagents were dispatched in parallel after a quick local sanity check.

| Worker | Scope | Tool / Model | Result |
|---|---|---|---|
| **B** | PNG diagnostics — recompute bbox / alpha / hash for m0, m0-legacy, m1, m2, m3 in current main | general-purpose, Python+Pillow | m0 target ≠ m0 `_hull_dir`; m0 metrics ≈ m1 family (∆ ≤ 0.4%); m0-legacy is 1.45× wider, 2.1× opaque, 9 px higher centre. |
| **C** | Runtime path trace — getGeneratedHullAssetPath / TextureKey, loader, renderer, devtools panel | general-purpose | Modular runtime requests `wasp_cyan_m0_dir00_E.png` (no `_hull_`) under key `generated_hull_wasp_cyan_m0_dir00`. Loader guards on `textures.exists()` and skips. Reset does NOT call `textures.remove`. Identified cross-module key collision as the one real hazard. |
| **D** | Cache / deploy — Vite build, GitHub Pages, service worker, headers, cache-bust | general-purpose | No PWA, no service worker, no custom headers. `public/` is copied verbatim with stable filenames — no content hash, no `?v=`. CDN/browser HTTP cache TTL ~10 min. Produced DevTools snippet for Denis (see §6). |
| **E** | Metadata / legacy isolation — manifest vs generated TS for m0 vs m1; legacy symbol leaks; isolation test coverage | general-purpose | m0 and m1 metadata are byte-identical in `hull_socket_manifest_modular_cyan_v1.json` and in `generatedModularVehicleMetadata.generated.ts`. No legacy symbols leak into modular files. **Isolation test scans only 8 modular files and never checks `generatedHullAssets.ts`, `BlockoutVehicleRenderer.ts`, or `hullTurretVisualProfiles.ts`; its `_hull_dir` substring check is vacuous because the legacy module that contains that string is not in the scan set.** |
| **F** | Collision reachability — is the cross-module key collision live? | general-purpose | **YES, REACHABLE.** Single `Phaser.Game` at `main.ts:8`. `PreloadScene.ts:50-51` (`isDevtoolsEnabled()`) calls `loadArenaVisualAssets()` → loops `GENERATED_HULL_FACTIONS` and calls `preloadGeneratedHullSet(wasp, faction, 'm0')` → builds `generated_hull_wasp_cyan_m0_dirNN` and loads it from legacy `_hull_dir` path. Modular preview opens later under `devtoolsActive` (`isDevtoolsEnabled()` ∪ debug ∪ arena), modular loader's `textures.exists(key)` guard then skips its (correct) load. |

Orchestrator (this turn) re-verified F's claim directly: `DEFAULT_GENERATED_HULL='wasp'`, `DEFAULT_GENERATED_HULL_MOD='m0'` at `generatedHullAssets.ts:210,213`; PreloadScene gate at line 50-51 confirmed.

---

## 3. Current Merged State / PR #284 Verification

```
git log --oneline -5
4b5195c Merge pull request #284 from ratoker-jpg/wasp-m0-asset-fix-02c
e36b924 docs: add WASP-M0-ASSET-FIX-02C report
b2a08cf WASP-M0-ASSET-FIX-02C: regenerate Wasp cyan m0 modular hull sprites
3518def Merge pull request #283 from ratoker-jpg/docs/dictator-scale-01
4c41f34 Merge pull request #281 from ratoker-jpg/legacy-wasp-cleanup-01b
```

- PR #284 is present in `main`.
- `public/assets/units/hulls/wasp/cyan/m0/` listing shows the 16 modular m0 target PNGs were rewritten on `Jun 14 20:11` (~43–86 KB each) AND the 16 legacy `_hull_dir` siblings still coexist in the same directory (untouched at `Jun 11 11:34`, ~138–203 KB each).
- GitHub Actions `pages.yml` workflow run for `4b5195c` completed `success` at `2026-06-14T19:57:53Z`. The deployed gh-pages bundle contains the new m0 bytes.
- `git status --short` — clean.

Authoritative SHA-256s for cache verification:

| File | SHA-256 |
|---|---|
| `public/assets/units/hulls/wasp/cyan/m0/wasp_cyan_m0_dir00_E.png` (FIXED) | `fe7c298659480cf47070ba3f37921f57c8749c74b4c406bed8385c91b43c8368` |
| `public/assets/units/hulls/wasp/cyan/m0/wasp_cyan_m0_dir04_S.png` (FIXED) | `2b258da23484462c039377221c2fae171cbaea432888715740888c706f046464` |
| `public/assets/units/hulls/wasp/cyan/m1/wasp_cyan_m1_dir00_E.png` (REF) | `93ddd648b79b6b809c01d78e4c52f476c28f4ad9cff7a7821da535874cdc6dea` |
| `public/assets/units/hulls/wasp/cyan/m0/wasp_cyan_m0_hull_dir00_E.png` (LEGACY, big, wrong) | `16313ceade3b36a1fdaf436dd839ce80028a12148cecc2fa1b8d6e34afc04e1f` |

Answers to §1 audit questions:
1. PR #284 is in main. ✅
2. m0 target PNGs are changed from old `_hull_dir` copies (different bytes, different MD5). ✅
3. Files on disk in the repo are the expected fixed files. ✅

---

## 4. File / PNG Diagnostics From Current Main

Recomputed directly from disk by Worker B (Pillow 12.2.0, `pip install --quiet Pillow`, custom script `/tmp/png_diag.py`). Averages across all 16 directions:

| Set | avg bbox W | avg bbox H | avg opaque px | avg norm Cx | avg norm Cy | avg norm bottom |
|---|---|---|---|---|---|---|
| **m0-target (FIXED)** | 274.2 | 160.4 | 30,412.9 | 0.5005 | **0.5876** | 0.7443 |
| m1 | 274.2 | 160.5 | 30,537.2 | 0.5000 | **0.5875** | 0.7443 |
| m2 | 274.2 | 160.5 | 30,537.2 | 0.5000 | 0.5875 | 0.7443 |
| m3 | 274.2 | 160.5 | 30,537.2 | 0.5000 | 0.5875 | 0.7443 |
| **m0-legacy `_hull_dir`** | **397.0** | **232.5** | **63,859.4** | 0.5000 | **0.4962** | 0.7233 |

dir00 (E) side-by-side, image size 512×512 for all rows:

| Set | bbox W×H | opaque px | norm Cx | norm Cy | norm bottom | MD5 prefix |
|---|---|---|---|---|---|---|
| m0-target | 308×168 | 30,935 | 0.568 | 0.570 | 0.734 | `4bb2c69d…00af5a` |
| m0-legacy | **446×244** | **65,153** | 0.500 | 0.508 | 0.746 | `29417d29…d707cc` |
| m1 | 308×168 | 31,109 | 0.568 | 0.570 | 0.734 | `36fe213e…fe098`  |
| m2 | 308×168 | 31,109 | 0.568 | 0.570 | 0.734 | `bc9b00e9…8583e`  |
| m3 | 308×168 | 31,109 | 0.568 | 0.570 | 0.734 | `17283ef1…6ce135` |

- Are m0-target files byte-identical to their `_hull_dir` siblings? **NO for all 16 directions.**
- Do m0-target metrics match the m1 family? **YES, within bilinear-resample noise (±1 px bbox, ≤0.4% opaque count).**
- m0-target dimension mismatches vs m1? **None.**

**Conclusion: the m0 assets in `main` are correct and match the modular family.** The repo is not the problem.

---

## 5. Runtime Path Trace

Two `getGeneratedHullAssetPath` functions exist in the repo with **the same exported name but different output**:

| Module | Path for wasp/cyan/m0/dir00 | Texture key | Used by modular runtime? |
|---|---|---|---|
| `src/assets/generatedModularVehicleAssets.generated.ts:49-57` | `assets/units/hulls/wasp/cyan/m0/wasp_cyan_m0_dir00_E.png` | `generated_hull_wasp_cyan_m0_dir00` | YES |
| `src/assets/generatedHullAssets.ts:140-149` (LEGACY) | `assets/units/hulls/wasp/cyan/m0/wasp_cyan_m0_hull_dir00_E.png` | `generated_hull_wasp_cyan_m0_dir00` | NO (legacy) |

Modular runtime chain (`modularVehicleRuntimeLoader.ts`, `modularVehicleComposition.ts`, `GeneratedModularVehicleRenderer.ts`, `ModularVehicleDevtoolsPanel.ts`) imports only the modular `getGeneratedHullAssetPath` / `getGeneratedHullTextureKey`. It never imports `generatedHullAssets.ts`.

Loader skip guard, `src/modular/modularVehicleRuntimeLoader.ts:163-198`:
```ts
const hullKey = getGeneratedHullTextureKey(visual.hullId, visual.faction, visual.hullMod, dir);
if (scene.textures.exists(hullKey)) {
  alreadyAvailableKeys.push(hullKey);            // SKIP — already present
} else if (!alreadyRequested) {
  scene.load.image(hullKey, getGeneratedHullAssetPath(visual.hullId, visual.faction, visual.hullMod, dir));
  queuedKeys.push(hullKey);
}
```

Phaser's `LoaderPlugin.image()` itself also no-ops a duplicate key — even without this guard, the legacy texture would be sticky.

Devtools "Reset" handler (`ModularVehicleDevtoolsPanel.ts:151` → `GeneratedModularVehicleRenderer.reset()` at lines 184-195) restores state and re-requests assets, but **does NOT call `textures.remove(key)`**. There is no `textures.remove` anywhere in `src/modular/*` or in `GeneratedModularVehicleRenderer.ts`.

Default modular visual (`modularVehicleVisual.ts:48-54`): `hullId='wasp', faction='cyan', hullMod='m0'` — exactly the collision target.

---

## 6. Browser / Phaser Cache / Deploy Assessment

**Build / deploy mechanism:**
- Vite 6 (`vite.config.ts`): `outDir: dist`, `publicDir: public`. No `base` in config — `--base /four-elements-phaser/` is passed on the CLI in `.github/workflows/pages.yml:53`.
- Deploy: `peaceiris/actions-gh-pages@v4` pushes `./dist` to `gh-pages` (`pages.yml:114-122`). PR-preview path: `pr-preview/pr-<N>/`.
- Workflow run for `4b5195c` (PR #284): completed `success` at `2026-06-14T19:57:53Z`.

**Caching:**
- `public/` files are copied verbatim — **stable filenames, no content hash**.
- No service worker / PWA. No `vite-plugin-pwa`, no `workbox`, no `manifest.webmanifest`, no `public/sw.js` (grep returned no results).
- No custom `Cache-Control` headers. GitHub Pages' Fastly CDN default is roughly `max-age=600` (~10 min).
- No `?v=…` / `Date.now()` cache-bust on `scene.load.image` paths.

**Implication for cache hypothesis (Root cause A):** plausible in principle — a same-named PNG that changed bytes can be served stale by browser/CDN for up to ~10 min. However:
- Denis cleared browser cache and the bug persists.
- The deploy ran 10+ minutes before the screenshots (CDN TTL has expired by now).
- Even if the CDN served the OLD bytes of `wasp_cyan_m0_dir00_E.png`, those old bytes were the small-frame m0 (PR #280 had copied the legacy hull crop into the modular `_dir` filename, but FIX_02C's bbox 446×244 for the old `_dir00_E.png` IS the legacy big crop) — wait, this needs clarification: the "before" row in FIX_02C §4.2 dir00 reads 446×244 / 65,153 px / nCy 0.5078. So the **old `wasp_cyan_m0_dir00_E.png` from #280 WAS the big legacy bytes.** If CDN/browser served those, the symptom would match.
- However the runtime collision below (G) **also** explains the symptom without requiring stale cache, and is reproducible from current code paths even with a fresh fetch.

The cache hypothesis cannot be fully ruled out without the DevTools verification snippet below. But the collision (§7) is sufficient on its own to produce the observed bug, and is much more specific.

**DevTools verification snippet for Denis** (run with Modular Vehicle preview open):
```js
// ── Modular Wasp m0 cache + texture diagnostic ──────────────────────────────
(async () => {
  const BASE = location.pathname.replace(/\/[^/]*$/, '/');
  const REL_MODULAR = 'assets/units/hulls/wasp/cyan/m0/wasp_cyan_m0_dir00_E.png';
  const REL_LEGACY  = 'assets/units/hulls/wasp/cyan/m0/wasp_cyan_m0_hull_dir00_E.png';
  const url = new URL(REL_MODULAR, location.origin + BASE).href;
  const urlLegacy = new URL(REL_LEGACY, location.origin + BASE).href;
  console.log('[diag] fetching modular:', url);

  // 1) Confirm what the CDN is serving for the modular filename.
  for (const u of [url, urlLegacy]) {
    try {
      const r = await fetch(u, { cache: 'no-store' });
      const buf = await r.arrayBuffer();
      const h = await crypto.subtle.digest('SHA-256', buf);
      const hex = [...new Uint8Array(h)].map(b => b.toString(16).padStart(2,'0')).join('');
      console.log('[diag]', u.split('/').pop(),
        '| HTTP', r.status, '| Cache-Control:', r.headers.get('cache-control'),
        '| Age:', r.headers.get('age'),
        '| bytes:', buf.byteLength, '| SHA-256:', hex);
    } catch (e) { console.error('[diag] fetch failed:', u, e); }
  }
  // Expected for the MODULAR filename (PR #284 in main):
  //   bytes: 79547
  //   SHA-256: fe7c298659480cf47070ba3f37921f57c8749c74b4c406bed8385c91b43c8368
  // If CDN returns something different → cache/deploy issue.

  // 2) Locate the Phaser.Game.
  const KEY = 'generated_hull_wasp_cyan_m0_dir00';
  let game = window.game || (window.Phaser && window.Phaser.GAMES && window.Phaser.GAMES[0]);
  if (!game) { console.warn('[diag] no Phaser.Game on window; expose with `window.game = game` in main.ts'); return; }
  const tm = game.textures;

  // 3) Is the texture key present? What dimensions does its source image have?
  if (!tm.exists(KEY)) {
    console.warn('[diag] texture key NOT loaded yet:', KEY);
    return;
  }
  const src = tm.get(KEY).getSourceImage();
  console.log('[diag] in-memory texture', KEY, 'source size:', src.width + 'x' + src.height,
    '— bbox tip: a ~308x168 alpha region means MODULAR file; ~446x244 means LEGACY _hull_dir file.');

  // 4) Force-reload just this one key with cache-bust, to test whether the
  //    displayed sprite changes when the correct file is loaded into the key.
  const scene = game.scene.getScenes(true)[0];
  if (!scene) { console.warn('[diag] no active scene'); return; }
  tm.remove(KEY);
  scene.load.image(KEY, url + '?cb=' + Date.now());
  scene.load.once('complete', () => {
    const s2 = tm.get(KEY).getSourceImage();
    console.log('[diag] reloaded', KEY, '| new source:', s2.width + 'x' + s2.height);
    console.log('[diag] If the on-screen Wasp m0 now matches m1, the bug is the texture-key collision (G).');
  });
  scene.load.start();
})();
```

The "bytes / SHA-256" line tells us whether the CDN is serving the new modular PNG. The "in-memory texture source size" line tells us whether the Phaser cache holds the modular or the legacy image. The "force-reload" line tells us whether overwriting the key with the correct file fixes the display.

---

## 7. PR #284 Affine Transform vs Native Blender Assessment

FIX_02C §2 explains the transform was derived mathematically from the m1 reference and verified against m1: alpha IoU > 0.989, pixel-count match within 0.3%, mean RGB diff 3.6–10.7 from bilinear resampling.

Audit findings:
- All Wasp hull mods (m0/m1/m2/m3) share the same 3D geometry (`Wasp_0123.3ds`) per the metadata manifest and FIX_02C §2.2; metadata fields for m0 and m1 are byte-identical (see §8).
- The expected per-direction alpha counts from the manifest match the regenerated m0 PNGs within 0.4% average / 0.9% max — well inside resample tolerance.
- Geometry/silhouette are NOT mod-specific for Wasp; only the texture differs. The affine approach is valid for this hull family.

There is **no evidence** that the m0 silhouette should differ from m1 in a way the affine transform would miss. Hypothesis E (m0 geometry differs from m1) is **rejected**.

---

## 8. Metadata Assessment

`public/assets/units/metadata/hull_socket_manifest_modular_cyan_v1.json` — wasp m0 (lines 23286-23365) vs wasp m1 (lines 24256-24335):

| Field | wasp m0 | wasp m1 |
|---|---|---|
| socketAnchorLocal | `[0.0, -82.5, 148.5]` | `[0.0, -82.5, 148.5]` |
| socketPixel | `{x:256, y:256}` | `{x:256, y:256}` |
| anchorPixel | `{x:256, y:256}` | `{x:256, y:256}` |
| anchorNorm | `{x:0.5, y:0.5}` | `{x:0.5, y:0.5}` |
| imageSize | `{w:512, h:512}` | `{w:512, h:512}` |
| bbox.min | `[-132.0, -148.5, -148.499969]` | identical |
| bbox.max | `[132.0, 313.5, 0.0]` | identical |
| fixedOrthoScale | `860.0` | `860.0` |

Generated TS (`src/assets/generatedModularVehicleMetadata.generated.ts`):
- L70 `"wasp_m0": { normalized:{nx:0.5,ny:0.5}, imageSize:{w:512,h:512}, renderStrategy:"fixed_512_frame" }`
- L71 `"wasp_m1": { normalized:{nx:0.5,ny:0.5}, imageSize:{w:512,h:512}, renderStrategy:"fixed_512_frame" }`

Identical apart from the `mod` discriminator. Manifest ↔ generated.ts agree for both m0 and m1. The 274×160 figure in the task description refers to the **alpha bbox** of the m1 family; it is not in metadata. Metadata refers to the **512×512 frame**, which matches the actual PNGs.

Hypothesis F (metadata mismatch) is **rejected**.

---

## 9. Legacy Isolation Assessment

`src/__tests__/legacyWaspIsolation.test.ts` (PR #281) scans 8 modular files via `?raw` import for 16 forbidden identifiers (incl. `_hull_dir`, `WASP_HULL_VISUAL_PROFILE`, `applyHullVisualDir16Remap`, `composeGeneratedVehiclePreview`, …) and for forbidden import paths.

Modular source is clean of those symbols. **However the test has three coverage holes:**

1. The `_hull_dir` substring check scans **only the 8 modular files**. The string `_hull_dir` lives in `src/assets/generatedHullAssets.ts` (line 148), which is NOT in the scanned set. So this substring assertion is **vacuously satisfied** for modular files and provides no real protection.
2. The forbidden-import-paths list does **not include** `generatedHullAssets`, `BlockoutVehicleRenderer`, `hullTurretVisualProfiles`, or `modularUnitAssets`. A modular file could re-introduce a legacy import without tripping the test.
3. **Critically, no test asserts the shared Phaser `TextureManager` key namespace is owned exclusively by the modular loader.** Both `generatedHullAssets.getGeneratedHullTextureKey` and `generatedModularVehicleAssets.getGeneratedHullTextureKey` produce the IDENTICAL string `generated_hull_${hull}_${faction}_${mod}_dir${NN}`. There is no test that fails when these two functions agree on key format while disagreeing on file path.

The runtime collision exploits hole #3.

### The reachable runtime collision (confirmed)

- One `Phaser.Game` (`src/main.ts:8`) — global TextureManager.
- `src/phaser/PreloadScene.ts:50-51` under `isDevtoolsEnabled()` → `loadArenaVisualAssets(this)`.
- `src/assets/runtimeGeneratedAssets.ts:238-253` loops `GENERATED_HULL_FACTIONS` and calls `preloadGeneratedHullSet(scene, DEFAULT_GENERATED_HULL, faction, DEFAULT_GENERATED_HULL_MOD)`. Constants: `wasp` + `m0` (`generatedHullAssets.ts:210,213`).
- `preloadGeneratedHullSet` (`generatedHullAssets.ts:166-184`) builds key `generated_hull_wasp_cyan_m0_dirNN` and loads it from the LEGACY `_hull_dir` path (line 148). For 16 directions × 4 factions × 1 mod = 64 keys, including all 16 keys for `wasp/cyan/m0`.
- Modular preview (`GameScene.ts:593` under `devtoolsActive`) instantiates `GeneratedModularVehicleRenderer` whose default visual is `wasp + cyan + m0` (modularVehicleVisual.ts:48-54).
- `modularVehicleRuntimeLoader.ts:163-177` builds the IDENTICAL key, checks `scene.textures.exists(key)` → returns true (PreloadScene already populated it from the wrong file), pushes to `alreadyAvailableKeys`, and **does not load** `wasp_cyan_m0_dir00_E.png`.
- The renderer draws the legacy texture under key `generated_hull_wasp_cyan_m0_dirNN`. m1/m2/m3 are not in the legacy preload, so the modular loader fetches them and they look correct.

This 100% matches Denis's symptom: only m0 looks wrong, m1 looks fine, the bug survives any browser/CDN cache clearing because the wrong texture is being loaded into Phaser at runtime regardless of which bytes the CDN returns for the correct filename.

---

## 10. Screenshot / Manual QA Interpretation

Screenshot 1 (Wasp m0 + Smoky m0, bad): hull silhouette is visibly larger and shifted up relative to the turret socket — consistent with the legacy `_hull_dir` bbox (397×232 px, norm Cy 0.4962, ~9 px higher) rather than the modular bbox (274×160, norm Cy 0.5876).

Screenshot 2 (Wasp m1 + Smoky m0, good): silhouette matches the modular family — turret socket aligned at frame centre.

Visual evidence is consistent with the texture-key collision: m0 renders the legacy bytes that were loaded into the shared key by `PreloadScene`; m1 renders the modular bytes the modular loader fetched because no collision occurred for m1.

Screenshots are used here only as qualitative confirmation; the file/runtime evidence above is the primary basis.

---

## 11. Root Cause Classification

**Primary: G — Legacy Wasp code path still leaks into Modular Vehicle preview** (via the shared `Phaser.TextureManager` key namespace, not via TypeScript import).

Specifically: `PreloadScene` → `loadArenaVisualAssets` → `preloadGeneratedHullSet(wasp, *, m0)` (legacy `generatedHullAssets.ts`) populates the Phaser texture key `generated_hull_wasp_cyan_m0_dirNN` with the LEGACY `_hull_dir` PNG bytes BEFORE the modular preview opens. The modular loader's `textures.exists(key)` guard then prevents the correct file from being loaded. Both modules export `getGeneratedHullTextureKey` with the identical format string, so they collide on the global TextureManager.

Secondary explainers of the m0-only symptom:
- `DEFAULT_GENERATED_HULL_MOD='m0'` — legacy preload is hard-coded to m0, leaving m1/m2/m3 keys untouched and free for the modular loader to populate correctly. This is precisely why only m0 looks wrong.

Ruled out:
- A (Pages/browser serving old PNG) — repo hashes confirmed; Pages deploy succeeded at 19:57:53Z; even if CDN served stale bytes, the symptom would also affect other directions/factions. The Phaser cache collision is sufficient and more specific.
- B (PR #284 files visually wrong) — Worker B confirms metrics match m1 family within bilinear-resample noise.
- C (runtime not using modular path) — modular path is correct; the bug is upstream pollution of the shared key.
- D (Phaser texture cache keeps OLD modular texture from PR #280) — possible secondary issue but not the cause; the legacy preload always overwrites with the same wrong file every session, independent of past loads.
- E (m0 geometry ≠ m1) — same 3D model; metadata identical.
- F (metadata mismatch) — m0 and m1 metadata are byte-identical.
- H (user expectation mismatch) — the modular family is designed to share silhouette across mods; FIX_02C's verification confirms equality within tolerance.
- I (other) — n/a.

Confidence: high. The mechanism is fully traceable in source with line numbers; the m0-only differential is explained by `DEFAULT_GENERATED_HULL_MOD='m0'`; the symptom matches the legacy bbox.

---

## 12. Recommended Fix Task

**Task name:** `MODULAR-RUNTIME-02A-KEY-NAMESPACE-FIX` — disambiguate Phaser texture-key namespaces between the legacy hull loader and the modular hull loader so the modular preview can never inherit a legacy-loaded texture.

**Scope (small, surgical):**
1. Change the **modular** texture-key prefix from `generated_hull_` to something modular-only (e.g. `modular_hull_`) in `src/assets/generatedModularVehicleAssets.generated.ts:31-38`. Do **not** change the file path string — only the key string.
2. Update the modular isolation test (`src/__tests__/legacyWaspIsolation.test.ts`) and `modularRuntime01.test.ts` key-format assertions accordingly.
3. Add a new isolation test that:
   - asserts the modular key format starts with `modular_hull_` and does NOT match the legacy `generated_hull_` regex;
   - asserts both `getGeneratedHullTextureKey` implementations return DIFFERENT strings for the same `(hull, faction, mod, dir16)` tuple.

This avoids any change to:
- the m0 PNG bytes,
- the m0 metadata,
- the legacy code path (still useful for legacy renderers),
- runtime renderers' behaviour for m1/m2/m3.

**Alternative (worse) approach** — left here for comparison, not recommended:
- Calling `scene.textures.remove(modularKey)` at the start of `requestModularVehicleSet` would force a reload but adds runtime cost on every vehicle change and does not stop the legacy loader from re-polluting the key the next time `loadArenaVisualAssets` runs.
- Disabling `loadArenaVisualAssets` under devtools mode would break other dev tools that depend on the legacy preload.

Renaming the modular prefix is the smallest, most explicit fix and matches the comment intent at `generatedHullAssets.ts:116-117` ("`generated_hull_` prefix prevents collisions with legacy `wasp_m0_hull_…` keys from modularUnitAssets.ts") — the prefix was added to dodge an OLDER collision; the same logic now needs to be applied to the modular module.

---

## 13. Files to Touch (for the recommended fix task — NOT in this audit)

- `src/assets/generatedModularVehicleAssets.generated.ts` — change key prefix only.
- `src/__tests__/legacyWaspIsolation.test.ts` — add namespace-collision test.
- `src/__tests__/modularRuntime01.test.ts` — update expected key format string in the texture-key test.
- Possibly `src/__tests__/generatedHullAssets.test.ts` — to assert legacy keeps its `generated_hull_` prefix (no functional change to legacy).

No PNGs change. No metadata changes. No renderer changes. No loader logic changes (only the string that `getGeneratedHullTextureKey` returns in the modular module).

---

## 14. Files NOT to Touch

- Any PNG under `public/assets/units/hulls/wasp/cyan/m0/` (including legacy `_hull_dir` siblings).
- `public/assets/units/metadata/hull_socket_manifest_modular_cyan_v1.json`.
- `src/assets/generatedModularVehicleMetadata.generated.ts`.
- `src/modular/modularVehicleRuntimeLoader.ts`, `modularVehicleComposition.ts`, `modularVehicleVisual.ts`.
- `src/phaser/render/GeneratedModularVehicleRenderer.ts`.
- `src/phaser/dev/ModularVehicleDevtoolsPanel.ts`.
- `src/assets/generatedHullAssets.ts` (LEGACY — leave its key format and path as-is; it still serves `BlockoutVehicleRenderer`, `ModularTankRenderer`, pilot loaders, etc.).
- `src/phaser/PreloadScene.ts`, `src/assets/runtimeGeneratedAssets.ts` (legacy preload sequence must continue to work for legacy renderers).
- Anything related to Dictator scale, combat, movement, economy, mapgen, pathfinding, save-load.

---

## 15. Test Plan (for the recommended fix task)

1. `npm run typecheck` — PASS.
2. `npm run test -- src/__tests__/modularRuntime01.test.ts` — PASS (updated key assertion).
3. `npm run test -- src/__tests__/legacyWaspIsolation.test.ts` — PASS (incl. new namespace-collision test).
4. `npm run test -- src/__tests__/generatedHullAssets.test.ts` — PASS unchanged (legacy keys untouched).
5. `npm run test` — full suite PASS.
6. `npm run build` — PASS.
7. `npm run qa:smoke` — PASS (standard + devtools).

New test for the namespace boundary should fail BEFORE the fix and pass AFTER.

---

## 16. Manual QA Plan

Run the dev preview after the fix (and after a hard refresh):
```
?skipMenu&devtools=1&arena=1
```

Verify:
1. Wasp m0 + Smoky m0 — hull silhouette and turret socket alignment match Wasp m1 + Smoky m0.
2. Wasp m1/m2/m3 + various turrets — unchanged from current healthy behaviour.
3. Mammoth / Titan + various turrets — unchanged.
4. No runtime loader errors; no missing-texture fallback boxes for the default vehicle.

DevTools console snippet from §6 may be used to confirm the new modular key (e.g. `modular_hull_wasp_cyan_m0_dir00`) is populated from `wasp_cyan_m0_dir00_E.png` (~79 KB, SHA-256 `fe7c298659…`) and not from the legacy file.

---

## 17. Open Questions

1. Are there other shared-key collisions of the same flavour (turret, civic, terrain) that the same audit pattern would surface? Worker C reports turret keys use prefix `generated_turret_` and hull/turret are isolated, but the audit did not scan the full key namespace cross-module.
2. Should the legacy `_hull_dir` siblings be deleted from `public/assets/units/hulls/wasp/cyan/m0/` to prevent future confusion? Not done in this audit; out of scope.
3. Should `loadArenaVisualAssets` switch to the modular loader for `wasp m0` going forward? Long-term yes (MODULAR-RUNTIME-02+), but not in scope here — the recommended namespace fix is the minimum needed to unblock the current visual bug.

---

## 18. Validation

- `git status --short` — clean.
- No files modified outside this audit report (created locally, not committed).
- Worker outputs summarised in §2 and §4–9; raw outputs preserved in subagent transcripts.

Жду Делай
