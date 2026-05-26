# art/ — Four Elements Phaser Asset Pipeline

This directory holds the asset pipeline working tree for Four Elements Phaser.

**Do not place binary assets (PNGs, PSDs, etc.) in this PR.**
Binary asset staging belongs to future ARCH-02D+ phases.

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
- Family subdirectories with runtime-ready PNGs (future ARCH-02D)

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

| Script | Purpose |
|--------|---------|
| `tools/validate_manifest.mjs` | Validate manifest JSON structure, keys, naming |
| `tools/process_art_assets.mjs` | Unified asset processor (future ARCH-02D) |
| `tools/generate_building_meta.py` | Building placement metadata generator |

## See also

- `docs/ASSET_PIPELINE_STRATEGY.md` — full pipeline design
- `docs/ASSET_POLICY.md` — asset copy and quality rules
