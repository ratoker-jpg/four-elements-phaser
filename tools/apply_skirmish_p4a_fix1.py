from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
for relative in ('src/state/production.ts', 'src/state/updateGameState.ts'):
    path = ROOT / relative
    text = path.read_text(encoding='utf-8')
    marker = '  DEFAULT_UNIT_CAP,\n'
    if marker not in text:
        raise RuntimeError(f'{relative}: DEFAULT_UNIT_CAP import marker not found')
    path.write_text(text.replace(marker, '', 1), encoding='utf-8')

print('SKIRMISH-P4A fix1 applied')
