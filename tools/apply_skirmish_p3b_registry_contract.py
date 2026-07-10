from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'src/__tests__/commandRegistry.test.ts'
text = path.read_text(encoding='utf-8')

replacements = {
    "it('registers all 12 primary MVP commands + 2 legacy aliases (SELECTION-CONTROL-GROUPS-05)', () => {":
        "it('registers 14 existing commands plus 6 factory-composer commands', () => {",
    "    // 11 primary commands + 2 legacy aliases (B, P) = 13 total\n    expect(cmds).toHaveLength(14);":
        "    // Existing registry contract remains intact; P3B adds six contextual composer commands.\n    expect(cmds).toHaveLength(20);",
    "it('calling registerMvpCommands() twice keeps exactly 13 commands (SELECTION-CONTROL-GROUPS-05: 12 primary + 2 legacy)', () => {":
        "it('calling registerMvpCommands() twice keeps exactly 20 commands', () => {",
    "      expect(commandRegistry.list()).toHaveLength(14);":
        "      expect(commandRegistry.list()).toHaveLength(20);",
    "    expect(commandRegistry.list()).toHaveLength(14);":
        "    expect(commandRegistry.list()).toHaveLength(20);",
    "it('is idempotent — repeated calls keep exactly 13 commands', () => {":
        "it('is idempotent — repeated calls keep exactly 20 commands', () => {",
}
for old, new in replacements.items():
    if old in text:
        text = text.replace(old, new)
    elif new not in text:
        raise SystemExit(f'marker not found: {old}')

anchor = """  it('no duplicate keys among MVP commands', () => {
    registerMvpCommands();
    const conflicts = commandRegistry.detectDuplicateKeys();
    expect(conflicts).toHaveLength(0);
  });
"""
addition = """  it('registers all six contextual factory-composer commands', () => {
    registerMvpCommands();
    const ids = [
      'factory-body-wasp',
      'factory-body-hunter',
      'factory-weapon-smoky',
      'factory-weapon-railgun',
      'factory-queue-combat',
      'factory-cancel-first',
    ];
    for (const id of ids) expect(commandRegistry.get(id)).toBeDefined();
  });

"""
if addition not in text:
    if anchor not in text:
        raise SystemExit('composer command test insertion anchor not found')
    text = text.replace(anchor, addition + anchor, 1)

path.write_text(text, encoding='utf-8')
