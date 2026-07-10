from pathlib import Path

occupancy = Path('src/state/occupancy.ts')
text = occupancy.read_text(encoding='utf-8')
old = 'for (const unit of state.combatUnits) {'
new = 'for (const unit of state.combatUnits ?? []) {'
count = text.count(old)
if count:
    text = text.replace(old, new)
elif new not in text:
    raise SystemExit('combatUnits occupancy loops not found')
occupancy.write_text(text, encoding='utf-8')

test_path = Path('src/__tests__/combatUnitMovement.test.ts')
test_text = test_path.read_text(encoding='utf-8')
marker = "  it('derives occupancy from combatUnits rather than legacy entities', () => {"
addition = """  it('keeps occupancy compatible with legacy partial GameState fixtures without combatUnits', () => {
    const state = makeState();
    const legacyFixture = { ...state, combatUnits: undefined } as unknown as typeof state;

    expect(() => buildOccupancyMap(legacyFixture)).not.toThrow();
    expect(() => isTileOccupiedByUnit(legacyFixture, 6, 6)).not.toThrow();
  });

"""
if addition not in test_text:
    if marker not in test_text:
        raise SystemExit('test insertion marker not found')
    test_text = test_text.replace(marker, addition + marker, 1)
test_path.write_text(test_text, encoding='utf-8')

print(f'SKIRMISH-P2A fixture compatibility applied to {count or 3} occupancy loops')
