from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'src/state/generatedMap.ts'
text = path.read_text(encoding='utf-8')
old = """  // ── Human Builder: one tile outside the HQ toward map center ──
  const horizontalDirection = hq.tx < W / 2 ? 1 : -1;
  const verticalDirection = hq.ty < H / 2 ? 1 : -1;
  const builderTx = hq.tx + 1 + horizontalDirection * 2;
  const builderTy = hq.ty + 1 + verticalDirection * 2;"""
new = """  // ── Human Builder: immediately outside the HQ toward map center ──
  // Preserve the legacy lower-left spawn contract (within two tiles of hq top-left).
  const builderTx = hq.tx + 1;
  const builderTy = hq.ty < H / 2
    ? hq.ty + HQ_FOOTPRINT
    : hq.ty - 1;"""
if old not in text:
    raise RuntimeError('generated Builder placement marker not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('SKIRMISH-P5A fix1 applied')
