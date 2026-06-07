# Candidate A — Heavy Mining Platform

Status: visual direction candidate — not approved for runtime integration  
Project: Four Elements Phaser  
Date: 2026-05-30

---

## Visual approach

The map surface reads as a heavy industrial mining platform — large slabs of dark concrete and worn metal plates bolted together, forming a continuous constructed surface. The visual language evokes a functional extraction facility: heavy-duty flooring, rust streaks, industrial drainage channels, and deep-set panel seams. The surface should feel like you are standing on a real industrial installation, not a painted grid.

The key differentiator from Candidates B and C is that this direction leans into the **weight and substance** of the surface. Materials are thick, worn, and grounded. The surface reads as something that could support heavy machinery — because it does support harvesters, factories, and mining rigs in the game's fiction.

---

## Surface material

Primary: **Dark poured concrete with aggregate texture**

- Base color: deep charcoal-gray with subtle aggregate speckling
- Surface variation: hairline cracks, cured pour lines, patch repairs
- Accent material: **Worn steel plates** bolted over high-traffic zones
- Secondary: **Rust-stained concrete** — areas where water and mineral runoff have discolored the surface over time

The concrete is the dominant material (approximately 70-80% of visible surface). Steel plates appear as modular overlays in areas that receive heavy equipment traffic — near factories, resource processing, and vehicle paths. The steel is painted industrial gray-green or olive, with paint chipping to reveal rust underneath.

---

## Color palette

| Role | Color | Hex (approximate) | Usage |
|------|-------|-------------------|-------|
| Primary | Deep charcoal concrete | `#3a3a3c` | Main surface |
| Secondary | Warm dark gray | `#4a4540` | Concrete variation |
| Accent 1 | Rust/bronze | `#8b6b3d` | Stains, worn edges, highlights |
| Accent 2 | Industrial olive | `#5a5e4a` | Steel plate painted surfaces |
| Highlight | Pale mineral dust | `#b8a88a` | Light wear, dust accumulation |
| Shadow | Near-black | `#1e1e20` | Cracks, drainage, depth |

Variation range: ±5% brightness variation across tiles, with tint shifts toward warm (rust) or cool (steel) depending on zone. This is wider than the current sand terrain's ±2% to prevent the concrete from looking monotonous.

---

## Tile structure

Tiles are 256x128 isometric diamonds, same as the current sand terrain. The visual trick is to make adjacent tiles read as a **continuous poured surface** rather than individual diamonds.

### How tiles connect into a continuous surface

1. **Pour-line alignment**: Concrete pour lines (subtle horizontal bands from the curing process) run continuously across tile boundaries. These lines are faint (2-3% brightness variation) but create a sense that the surface was poured in large sections.

2. **Crack propagation**: Hairline cracks in the concrete start in one tile and continue into adjacent tiles. This is achieved by designing tile variants with crack patterns that align at edges — for example, a crack starting at the right edge of tile variant A continues from the left edge of tile variant B.

3. **Panel seam system**: Steel plate edges align on a 2x2 tile grid. Four tiles form one "panel" of steel plating. The seams between panels are visible as dark lines with bolt details. Within a panel, the surface is continuous.

4. **Tint blending**: The ±5% tint variation is zone-based, not random per tile. Large patches (8-12 tiles) share a similar tint, creating the impression of different concrete pours or different ages of concrete.

### Tile variants needed

| Variant | Description | Frequency |
|---------|-------------|-----------|
| `heavy_clean` | Smooth concrete, minimal wear | 30% |
| `heavy_cracked` | Concrete with hairline cracks | 25% |
| `heavy_worn` | Worn concrete with exposed aggregate | 15% |
| `heavy_plate` | Steel plate overlay on concrete base | 15% |
| `heavy_rust` | Rust-stained concrete near drainage | 10% |
| `heavy_drain` | Drainage channel / groove detail | 5% |

---

## Edge treatment

The platform edge is a heavy industrial rim — like the edge of a constructed platform or a loading dock. Options for the visual boundary:

1. **Reinforced concrete lip**: A thick concrete border that extends slightly beyond the playable area, with visible rebar ends and rust staining. Beyond the lip, the outer world surface is darker, rougher concrete or compacted earth.

2. **Steel beam rim**: I-beam or channel steel running along the platform edge, with bolted connections visible. The beam creates a clear visual boundary between the "finished" playable surface and the "rough" outer world.

3. **Worn boundary**: The concrete surface gradually thins and crumbles at the edges, revealing compacted mineral soil underneath. This creates an organic boundary that suggests the platform has been in use for a long time.

**Recommended**: Option 3 (Worn boundary) for the initial implementation. It is the most forgiving visually — slight misalignment at edges looks natural rather than wrong. Options 1 and 2 require precise alignment that could be tricky with isometric tile edges.

---

## Resource integration

Mineral/ore deposits sit **on top of** the concrete surface, not embedded in it. The visual story is:

- The mining platform was built over a mineral-rich area
- Resource nodes are exposed ore deposits that have been cleared of surface material
- Small ore deposits sit in shallow excavations in the concrete (like potholes filled with glowing mineral)
- Large deposits are open mining pits cut into the platform floor

Visual details:
- **Small ore**: A cluster of glowing mineral crystals sitting in a shallow crack/hole in the concrete. The surrounding concrete shows stress marks and mineral staining.
- **Medium ore**: A wider excavation with more exposed mineral. Edges of the cut show drill marks or blast patterns.
- **Large ore**: An open pit with visible mineral veins in the walls. The pit edge has industrial markings (hazard stripes, survey marks).
- **Infinite deposit**: A large mining excavation with industrial rig infrastructure (conveyor frame, support beams) surrounding a deep mineral well.

The glowing mineral provides strong visual contrast against the dark concrete — ore deposits should be immediately readable as "valuable thing on the ground."

---

## Why this candidate fits Four Elements Phaser

1. **Grounded and substantial**: The heavy materials make the map feel like a real place — a constructed industrial installation. This directly addresses the "floating grid" problem.

2. **RTS readability**: Dark concrete provides excellent contrast for units, buildings, and resources. Light-colored or glowing elements (minerals, unit sprites, selection highlights) stand out clearly against the dark surface.

3. **Consistent with StarCraft structural lessons**: StarCraft's industrial tilesets (like the Space Platform or Installations) achieve readability through dark, consistent base surfaces with bright accents. This candidate follows the same principle without copying any StarCraft visual.

4. **Forgiving for tile repetition**: Concrete is naturally monotonous — real concrete floors are large, flat, and uniform. This means tile repetition is expected and natural, unlike sand where each tile should look different but often just looks repetitive.

5. **Wear and age tell a story**: Rust, cracks, and worn steel suggest a platform that has been in operation for years. This adds visual richness without requiring complex per-tile art.

---

## Risks / weaknesses

1. **Monotony risk**: Dark concrete can become visually monotonous if tint variation is insufficient. The ±5% variation range must be tested carefully — too little looks flat, too much looks noisy. Mitigation: use zone-based tint patches, not per-tile random variation.

2. **Too dark overall**: If the concrete is too dark, units and buildings may not stand out enough. The current harvester and builder sprites use relatively dark colors. Mitigation: ensure the concrete base is no darker than `#3a3a3c` average, and that resources have strong glow/contrast.

3. **Cold/sterile feel**: Concrete and steel can feel cold and lifeless compared to sand. This is appropriate for an industrial platform but may not match the "Four Elements" theme. Mitigation: use warm rust/bronze accents and warm mineral glow to add life.

4. **Distinguishing playable from background**: If the outer world surface is also concrete, the platform edge may not be clear. Mitigation: the outer surface should be noticeably different — darker, rougher, or with different material (compacted earth, rock).

5. **Asset generation difficulty**: Generating convincing concrete and steel textures with AI tools may be harder than generating natural terrain. Concrete has subtle surface detail (aggregate, pour lines) that AI may over-stylize. Mitigation: use simpler, flatter concrete as the base and add detail through overlay variants.

---

## What not to copy from references

- **StarCraft Space Platform**: Do not copy the blue/gray color scheme, the specific tile shapes, or the animated border effects. The structural lesson (dark base + bright accents) is useful; the visual style is not.

- **StarCraft Installation**: Do not copy the indoor floor tile patterns, wall textures, or door frames. This candidate is for an outdoor industrial platform, not an indoor facility.

- **Command & Conquer Tiberian Sun**: Do not copy the tiberium glow style or the specific concrete tile shapes. The lesson about industrial maps with resource-infused terrain is useful.

- **Age of Empires II paved areas**: Do not copy the brick/stone patterns. This is poured concrete and steel, not masonry.

---

## Candidate tile image

See: `candidate-A-tile.png` (if generated)

This would show a single 256x128 isometric diamond tile of the heavy mining platform surface — dark charcoal concrete with subtle aggregate texture, a faint hairline crack, and a slight warm tint from mineral dust accumulation.
