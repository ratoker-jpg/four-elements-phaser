from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'src/__tests__/centerInfinity.test.ts'
text = path.read_text(encoding='utf-8')
old = """      tx: center.tx - 2,
      ty: center.ty,"""
new = """      tx: center.tx - 1,
      ty: center.ty,"""
if old not in text:
    raise RuntimeError('center approach fixture marker not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('SKIRMISH-P5C fix1 applied')
