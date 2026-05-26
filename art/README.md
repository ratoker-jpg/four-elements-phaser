# art/ — Four Elements Phaser Asset Pipeline

This directory holds the asset pipeline working tree for Four Elements Phaser.

Binary asset staging is not part of the current MVP.
The processor scans current approved runtime assets in `public/assets/` and
generates manifest/report only — no PNG copying yet.

## Directory layout

```
art/
├── source/       # Original authoring files (not committed to git)
├── staged/       # Approved assets ready for processing
└── generated/    # Processor output: manifests, reports, runtime-ready PNGs
```

### source/

Authoring and reference input. Source sheets, PSDs, high-resolution originals.
This directory is gitignored — artists work here locally but the repo does not
carry large source files.

### staged/

Approved assets that have passed visual review and are ready for the processor.
Assets here follow the naming conventions from
`docs/ASSET_PIPELINE_STRATEGY.md` section 6. The processor reads from this
directory when generating runtime assets.

Staged assets may be selectively committed if they serve as reference or if the
project decides to track them.

### generated/

Output of the asset processor and validation tools:

- `manifest.generated.json` — machine-readable manifest of all processed assets
- `audit-report.json` — validation results, warnings, and errors
- Family subdirectories with runtime-ready PNGs (future)

**Runtime integration is not yet active.** The current runtime loaders in
`src/assets/` continue to load directly from `public/assets/`. Migration to
manifest-driven loading is planned for ARCH-02F.

## Pipeline flow

```
art/source/ → art/staged/ → art/generated/ → public/assets/
  (author)     (review)      (process)         (runtime)
```

1. **Author** creates or edits source sheets in `art/source/`.
2. **Stage** — approved assets are copied/renamed to `art/staged/`.
3. **Generate** — the processor validates, transforms, and outputs to
   `art/generated/`, producing a manifest and audit report.
4. **Integrate** — validated assets are copied to `public/assets/` and the
   TypeScript manifest is imported by PreloadScene (ARCH-02F).

Steps 2–4 are tooling-supported. Step 1 is always manual.

## Tooling

| Script | Command | Purpose |
|--------|---------|--------|
| `tools/process_art_assets.mjs` | `npm run process:art-assets` | Generate manifest + audit report for buildings family |
| `tools/validate_manifest.mjs` | `npm run validate:asset-manifest` | Validate manifest JSON structure, keys, naming |
| `tools/generate_building_meta.py` | `npm run generate:building-meta` | Building placement metadata generator |

### process:art-assets

The building asset processor MVP scans current approved runtime assets under
`public/assets/factions/{cyan,green,yellow,purple}/buildings/` and produces:

- `art/generated/manifest.generated.json` — manifest with hq + buildings families
- `art/generated/audit-report.json` — validation results

Current MVP behavior:
- Processes buildings family only.
- Scans runtime assets in `public/assets/` as input (not `art/staged/`).
- No PNG copying or modification.
- Runs the existing building metadata generator as a sub-step.
- Runtime integration remains ARCH-02F.

## Sample viewer

A standalone HTML viewer for visually inspecting generated assets is located at
`task/art-sample/index.html`. It reads the manifest and audit report and displays
asset previews grouped by family and faction.

Accessible online via GitHub Pages after deployment, or locally with a dev server:

```bash
npm run dev
# Then open http://localhost:5173/task/art-sample/index.html
```

Online: `https://ratoker-jpg.github.io/four-elements-phaser/task/art-sample/index.html`

See `task/art-sample/README.md` for full usage instructions.

## See also

- `docs/ASSET_PIPELINE_STRATEGY.md` — full pipeline design
- `docs/ASSET_POLICY.md` — asset copy and quality rules
- `task/art-sample/README.md` — sample viewer usage
