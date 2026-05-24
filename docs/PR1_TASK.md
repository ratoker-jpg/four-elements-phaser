# PR1_TASK — Skeleton + terrain + camera + static entities

## Task

Create the first implementation PR for the clean Phaser-first restart.

Repository:

```text
ratoker-jpg/four-elements-phaser
```

## Mode

Implementation PR, but only after explicit approval.

Do not start PR1 unless user says:

```text
Делай PR1
```

## Required decisions

- Engine: Phaser 4.
- Version: exact pinned version, no semver range unless explicitly approved.
- Copy policy: approved assets only.
- Old repo: donor/reference/spec only.
- Old code: do not copy.
- Rex: no runtime dependency PR1.

## Required Phaser skills before implementation

Read official Phaser skills:

- `game-setup-and-config`
- `scenes`
- `loading-assets`
- `sprites-and-images`
- `cameras`
- `scale-and-responsive`
- `v4-new-features`

Source:

```text
https://github.com/phaserjs/phaser/tree/master/skills
```

## Goal

Create a clean Vite + TypeScript + Phaser 4 project skeleton that boots in browser and renders the first static scene.

PR1 must show:

- real approved sand/terrain asset visual;
- visible isometric terrain patch or 48x48 map;
- HQ visible;
- resources visible;
- one harvester visible;
- camera pan/zoom;
- basic HTML HUD placeholder;
- no console errors.

## Allowed files

Expected, adjust only if needed:

```text
package.json
package-lock.json
vite.config.ts
tsconfig.json
index.html
src/main.ts
src/phaser/BootScene.ts
src/phaser/PreloadScene.ts
src/phaser/GameScene.ts
src/phaser/input/CameraControls.ts
src/phaser/render/TerrainRenderer.ts
src/phaser/render/EntityRenderer.ts
src/assets/assetManifest.ts
src/config/gameConfig.ts
src/styles.css
public/assets/... minimal approved subset
```

## Forbidden

- no old TypeScript code copied;
- no old GameWorld;
- no Canvas;
- no renderer bridge;
- no WorldRenderSnapshot;
- no economy;
- no harvesting logic;
- no construction;
- no combat;
- no editor;
- no save/load;
- no Rex dependency;
- no flat-color terrain placeholder as primary visual;
- no large asset dump without approval.

## Acceptance checklist

- [ ] `npm install` / `npm ci` works.
- [ ] `npm run dev` boots app.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` passes.
- [ ] Phaser canvas appears.
- [ ] Real approved sand/terrain asset is visible.
- [ ] Terrain is not a flat-color board.
- [ ] HQ is visible.
- [ ] Resource/mineral is visible.
- [ ] One harvester is visible near HQ.
- [ ] Camera pans.
- [ ] Camera zooms.
- [ ] Basic HUD placeholder is visible.
- [ ] No critical console errors.
- [ ] No old source code copied.
- [ ] No Canvas/bridge/fallback renderer exists.

## Validation commands

```bash
npm install
npm run typecheck
npm run build
```

If tests are added:

```bash
npm test
```

## Manual QA

Open browser and verify:

1. app boots;
2. Phaser canvas visible;
3. sand terrain uses real asset;
4. HQ/resources/harvester visible;
5. camera pan/zoom works;
6. sprites are grounded/readable;
7. no missing asset errors;
8. no console errors.

## PR body requirements

PR must include:

- goal;
- Phaser skills read;
- files changed;
- assets copied;
- what was intentionally not copied;
- validation results;
- manual QA result;
- screenshot if possible;
- rollback plan;
- next recommended step.

## Rollback

Revert PR1. No old repo impacted.

If PR1 cannot achieve real terrain assets, stop and report. Do not replace it with a flat placeholder path.

## Output expected from agent

- PR URL;
- changed files;
- validation results;
- manual QA notes;
- confirmation no old source code was copied;
- confirmation no Canvas/bridge exists.
