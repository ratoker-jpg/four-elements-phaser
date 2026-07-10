# RTS-FND-P2 Combat Runtime Fixup

Status: implemented in PR #325

## Canonical state

Produced combat units live in `GameState.combatUnits`.

They are not duplicated into `GameState.entities`. `EntityRenderer` derives live render input from the canonical combat-unit objects each frame through `CombatUnitRenderer`.

`extraModularCombat` remains legacy starter/dev compatibility only and is not used for produced units.

## Multi-unit rendering

`CombatUnitRenderer` owns one isolated `ModularVehicleLiveAdapter` per produced unit ID. This prevents the adapter's normal-runtime pending-load state for one unit from overwriting another unit while modular assets load on demand.

## Production contract

The current UI keeps the compatibility command ID `wasp-smoky`, but queue items carry a structured `UnitProductionRequest`. Combat requests include:

- `bodyId`
- `weaponId`
- `hullMod`
- `turretMod`

This allows Phase 3 to supply arbitrary legal hull/turret combinations without replacing the Phase 2 queue model.

## Save compatibility

Save version 4 adds canonical combat state normalization:

- missing `combatUnits` becomes an empty array;
- legacy combined `mod` migrates to `hullMod` and `turretMod`;
- duplicate or missing IDs are repaired;
- `nextCombatUnitId` is reconstructed deterministically;
- standard-mode legacy modular entity stripping does not remove produced units because produced units no longer depend on `entities`.

## ID contract

Produced unit IDs are monotonic and deterministic:

```text
combat-unit-0
combat-unit-1
combat-unit-2
```

`Date.now()` is not used.

## Validation

The fixup workflow passed:

- TypeScript typecheck;
- 5,254 Vitest tests across 108 test files;
- npm audit with high-severity threshold;
- whitespace validation before commit.

Full build, smoke, Pages preview and repository Validation run on the final PR commit.
