from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

selection_path = ROOT / 'src/state/unitSelection.ts'
selection = selection_path.read_text(encoding='utf-8')
old = "  const remaining = selection.units.filter(unit => isSelectableUnitHumanOwned(state, unit));"
new = """  const remaining = selection.units.filter(unit => {
    if (unit.kind === 'combat') {
      const combat = state.combatUnits.find(candidate => candidate.id === unit.id);
      if (!combat || combat.runtime?.isDestroyed) return false;
    }
    return isSelectableUnitHumanOwned(state, unit);
  });"""
if old not in selection:
    raise RuntimeError('selection filter marker not found')
selection_path.write_text(selection.replace(old, new, 1), encoding='utf-8')

test_path = ROOT / 'src/__tests__/ownerAwareControl.test.ts'
test = test_path.read_text(encoding='utf-8')
marker = """  it('rejects a foreign player attacker but keeps the generic combat runtime available', () => {"""
insert = """  it('removes destroyed human tanks from selection while preserving unit-destroyed command results', () => {
    const state = makeState();
    const humanTank = state.combatUnits.find(unit => unit.id === 'human-tank')!;
    humanTank.runtime!.isDestroyed = true;
    humanTank.runtime!.destroyedAt = 0;

    const selection = selectMany([{ kind: 'combat', id: 'human-tank' }]);
    expect(pruneMissingEntities(selection, state)).toBeNull();
    expect(issueManualMove(state, { kind: 'combat', id: 'human-tank' }, 5, 8))
      .toEqual({ ok: false, reason: 'unit-destroyed' });
    expect(stopUnitCommand(state, { kind: 'combat', id: 'human-tank' }))
      .toEqual({ ok: false, reason: 'unit-destroyed' });
  });

"""
if marker not in test:
    raise RuntimeError('destroyed test insertion marker not found')
test_path.write_text(test.replace(marker, insert + marker, 1), encoding='utf-8')

print('SKIRMISH-P4B fix2 applied')
