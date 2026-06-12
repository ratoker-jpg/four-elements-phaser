# task/art-sample — Generated Asset Sample Viewer

A standalone HTML viewer for visually inspecting generated asset manifests and audit reports without running the game.

## What it does

- Reads `art/generated/manifest.generated.json` and `art/generated/audit-report.json`
- Displays assets grouped by family (hq, buildings) and faction (cyan, green, yellow, purple)
- Shows each asset as a card with image preview, key, file path, and family
- Highlights cards that have warnings or errors in the audit report
- Shows a summary panel with total/valid/warning/error counts
- Lists all audit warnings and errors when present
- Provides text search/filter by key, path, or family
- Provides a family dropdown filter

## How to regenerate assets first

Before using the viewer, make sure the generated files are up to date:

```bash
npm run process:art-assets
```

This produces:
- `art/generated/manifest.generated.json`
- `art/generated/audit-report.json`

## How to open the viewer

The viewer uses `fetch()` to load JSON files, which most browsers block under `file://`. Open it through a local dev/static server or use the GitHub Pages deployment.

### Option 1: Vite dev server (local)

```bash
npm run dev
```

Then navigate to: `http://localhost:5173/task/art-sample/index.html`

### Option 2: Static server from repo root (local)

```bash
npx serve .
```

Then navigate to: `http://localhost:3000/task/art-sample/index.html`

### Option 3: GitHub Pages (online)

After the PR is deployed, the viewer is available at:

- **PR preview**: `https://ratoker-jpg.github.io/four-elements-phaser/pr-preview/pr-47/task/art-sample/index.html`
- **Main branch** (after merge): `https://ratoker-jpg.github.io/four-elements-phaser/task/art-sample/index.html`

The GitHub Pages workflow automatically copies the viewer HTML and generated JSON files into the Vite dist output.

The viewer will display a clear error message with instructions if JSON loading is blocked.

## Image paths

Manifest paths are relative to `public/` (e.g. `assets/factions/cyan/buildings/separator.png`). The viewer resolves images using the relative path `../../<manifest path>` from its own location. This works because Vite and GitHub Pages serve the contents of `public/` at the site root. No PNGs are copied or modified.

## No runtime integration yet

This viewer is purely a dev/QA tool. It does not:
- Change PreloadScene or any runtime loader
- Modify `public/assets/` PNGs
- Add npm dependencies
- Require Phaser

Runtime manifest integration is planned for ARCH-02F.

## See also

- `art/README.md` — pipeline overview
- `docs/ASSET_PIPELINE_STRATEGY.md` — full pipeline design
