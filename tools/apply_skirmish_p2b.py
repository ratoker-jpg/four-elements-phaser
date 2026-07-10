from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text(encoding='utf-8')
    if old in text:
        target.write_text(text.replace(old, new, 1), encoding='utf-8')
        return
    if new not in text:
        raise SystemExit(f'marker not found: {path}: {old[:120]!r}')


replace_once(
    'src/state/unitDirection.ts',
    "export function directionFromDelta(dtx: number, dty: number): number {\n"
    "  const screenDx = dtx - dty;\n"
    "  const screenDy = dtx + dty;\n"
    "  if (Math.abs(screenDx) < 0.001 && Math.abs(screenDy) < 0.001) return 2;\n\n"
    "  const sector = Math.round(screenAngleFromDelta(dtx, dty) / 45);\n"
    "  const directionBySector: Record<number, number> = {\n"
    "    0: 0,\n"
    "    1: 1,\n"
    "    2: 2,\n"
    "    3: 3,\n"
    "    4: 4,\n"
    "    '-4': 4,\n"
    "    '-3': 5,\n"
    "    '-2': 6,\n"
    "    '-1': 7,\n"
    "  };\n"
    "  return directionBySector[sector] ?? 2;\n"
    "}",
    "export function directionFromDelta(dtx: number, dty: number): number {\n"
    "  const screenDx = dtx - dty;\n"
    "  const screenDy = dtx + dty;\n"
    "  if (Math.abs(screenDx) < 0.001 && Math.abs(screenDy) < 0.001) return 2;\n"
    "  return directionFromScreenAngle(screenAngleFromDelta(dtx, dty));\n"
    "}",
)

replace_once(
    'src/state/combatUnitCombat.ts',
    "function removeExpiredCombatWrecks(state: GameState, clock: number): void {\n"
    "  const survivors = (state.combatUnits ?? []).filter(unit => {\n"
    "    const runtime = normalizeCombatUnitRuntime(unit);\n"
    "    if (!runtime.isDestroyed || runtime.destroyedAt === null) return true;\n"
    "    return clock - runtime.destroyedAt < PRODUCTION_COMBAT_WRECK_LIFETIME_MS;\n"
    "  });\n"
    "  if (survivors.length !== state.combatUnits.length) state.combatUnits.splice(0, state.combatUnits.length, ...survivors);\n"
    "}",
    "function removeExpiredCombatWrecks(state: GameState, clock: number): void {\n"
    "  const units = state.combatUnits ?? [];\n"
    "  const survivors = units.filter(unit => {\n"
    "    const runtime = normalizeCombatUnitRuntime(unit);\n"
    "    if (!runtime.isDestroyed || runtime.destroyedAt === null) return true;\n"
    "    return clock - runtime.destroyedAt < PRODUCTION_COMBAT_WRECK_LIFETIME_MS;\n"
    "  });\n"
    "  if (survivors.length !== units.length) units.splice(0, units.length, ...survivors);\n"
    "}",
)

# Add explicit regression coverage for the three directions broken by the first angle refactor.
path = Path('src/__tests__/combatUnitCombat.test.ts')
text = path.read_text(encoding='utf-8')
text = text.replace(
    "import { screenAngleFromDelta } from '../state/unitDirection';",
    "import { directionFromDelta, screenAngleFromDelta } from '../state/unitDirection';",
)
marker = "describe('canonical Normal Game combat damage', () => {"
addition = """describe('shared production combat direction mapping', () => {
  it('preserves NW, N and NE after normalizing screen angles', () => {
    expect(directionFromDelta(-1, 0)).toBe(5);
    expect(directionFromDelta(-1, -1)).toBe(6);
    expect(directionFromDelta(0, -1)).toBe(7);
  });
});

"""
if addition not in text:
    if marker not in text:
        raise SystemExit('direction test insertion marker not found')
    text = text.replace(marker, addition + marker, 1)
path.write_text(text, encoding='utf-8')

print('SKIRMISH-P2B review fixup applied')
