# Map generation module boundaries

Status: architecture foundation only; runtime output is unchanged.

## Modules

- `generatedMap.ts` — orchestration, HQ/builder/resource assembly and deterministic retry loop.
- `generatedMapTypes.ts` — public size and validated-result types.
- `generatedMapSeed.ts` — PRNG, seed normalization, map identity and dimensions.
- `generatedMapTerrain.ts` — sand-cluster and industrial terrain generation.
- `generatedMapValidation.ts` — structural invariants and quality diagnostics.
- `mapSymmetry.ts` — footprint-safe symmetry transforms for future mirrored-map work.

## Dependency direction

```text
generatedMap.ts
  -> generatedMapSeed.ts
  -> generatedMapTerrain.ts
  -> generatedMapValidation.ts
  -> resourceAnchors.ts

mapSymmetry.ts
  -> no runtime map-generation dependency yet
```

## Phase 8 rule

Mirroring should be introduced as a separate transformation/assembly step. Do not weave symmetry branches throughout seed, terrain or validation code.

Before enabling mirrored production maps:

1. define the symmetry axis and center ownership rules;
2. mirror multi-tile footprints with `mirrorPlacement()`;
3. validate paired resources, obstacles and starting zones;
4. preserve deterministic output for the same seed and settings;
5. keep current asymmetric generation available until migration and manual QA are complete.

## Non-goals of the extraction

- no current map output changes;
- no obstacle or decor placement;
- no resource balance changes;
- no spawn relocation;
- no visual asset changes.
