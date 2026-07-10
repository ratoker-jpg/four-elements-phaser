from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text(encoding='utf-8')
    if new in text:
        return
    if old not in text:
        raise SystemExit(f'marker not found: {path}: {old!r}')
    target.write_text(text.replace(old, new, 1), encoding='utf-8')


replace_once(
    'src/state/combatUnitMovement.ts',
    "export type CombatMoveResult =\n",
    "export type CombatStopResult =\n"
    "  | { ok: true }\n"
    "  | { ok: false; reason: 'no-unit-selected' | 'unit-destroyed' };\n\n"
    "export type CombatMoveResult =\n",
)
replace_once(
    'src/state/combatUnitMovement.ts',
    "export function stopCombatUnit(state: GameState, unitId: string): CombatMoveResult {",
    "export function stopCombatUnit(state: GameState, unitId: string): CombatStopResult {",
)
replace_once(
    'src/state/unitCommands.ts',
    "  | { ok: false; reason: 'no-unit-selected' | 'unit-busy' };",
    "  | { ok: false; reason: 'no-unit-selected' | 'unit-destroyed' | 'unit-busy' };",
)
replace_once(
    'src/state/updateGameState.ts',
    "import { directionFromDelta } from './unitDirection';\nexport { directionFromDelta } from './unitDirection';",
    "export { directionFromDelta } from './unitDirection';",
)

print('SKIRMISH-P2A type fixup applied')
