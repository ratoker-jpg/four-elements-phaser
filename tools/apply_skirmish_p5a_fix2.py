from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

resource_path = ROOT / 'src/config/resourceAnchors.ts'
text = resource_path.read_text(encoding='utf-8')
old = """  for (const off of starterOffsets) {
    anchors.push({
      tx: hq.tx + off.dx,
      ty: hq.ty + off.dy,
      resourceClass: off.cls,
      zone: 'starter',
      variationRadius: 0, // No variation for starter — must be reliable
      mandatory: true,
    });
  }"""
new = """  const starterDirectionX = Math.sign(dxToCenter) || 1;
  const starterDirectionY = Math.sign(dyToCenter) || -1;
  for (const off of starterOffsets) {
    // The accepted offsets were authored for the south-west start. Convert
    // them to center-relative magnitudes and orient them toward the map center
    // so every selected corner remains in bounds before P5B mirrors all zones.
    const relativeX = Math.abs(off.dx - 1) * starterDirectionX;
    const relativeY = Math.abs(off.dy - 1) * starterDirectionY;
    anchors.push({
      tx: hqCenterX + relativeX,
      ty: hqCenterY + relativeY,
      resourceClass: off.cls,
      zone: 'starter',
      variationRadius: 0, // No variation for starter — must be reliable
      mandatory: true,
    });
  }"""
if old not in text:
    raise RuntimeError('starter resource orientation marker not found')
resource_path.write_text(text.replace(old, new, 1), encoding='utf-8')

# Strengthen P5A test coverage for all selected corners and validation.
test_path = ROOT / 'src/__tests__/fourHeadquarters.test.ts'
test = test_path.read_text(encoding='utf-8')
test = test.replace(
    "import { createGeneratedMapData } from '../state/generatedMap';",
    "import { createGeneratedMapData, createValidatedGeneratedMapData } from '../state/generatedMap';",
    1,
)
marker = """  it('creates four rendered HQ entities and binds every TeamState to its map HQ center', () => {"""
insert = """  it.each(['cyan', 'green', 'yellow', 'purple'] as Faction[])(
    'keeps starter resources in bounds and validates the selected %s corner',
    faction => {
      const result = createValidatedGeneratedMapData(`corner-validation-${faction}`, 'standard', faction);
      expect(result.valid).toBe(true);
      for (const resource of result.mapData.resources) {
        expect(resource.tx).toBeGreaterThanOrEqual(0);
        expect(resource.ty).toBeGreaterThanOrEqual(0);
        expect(resource.tx + resource.footprint).toBeLessThanOrEqual(result.mapData.width);
        expect(resource.ty + resource.footprint).toBeLessThanOrEqual(result.mapData.height);
      }
    },
  );

"""
if marker not in test:
    raise RuntimeError('corner resource test insertion marker not found')
test_path.write_text(test.replace(marker, insert + marker, 1), encoding='utf-8')

print('SKIRMISH-P5A fix2 applied')
