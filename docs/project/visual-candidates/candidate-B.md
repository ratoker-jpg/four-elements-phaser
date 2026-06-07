# Candidate B — Modular Sci-Fi Floor Grid

Status: visual direction candidate — not approved for runtime integration  
Project: Four Elements Phaser  
Date: 2026-05-30

---

## Visual approach

The map surface reads as a modular industrial floor — manufactured metal panels locked together in a grid, with visible seams, maintenance strips, and subtle embedded lighting. The visual language is cleaner and more deliberate than Candidate A: this is a purpose-built facility floor, not aged infrastructure. The surface looks like it was designed and installed, not poured and weathered.

The key differentiator from Candidates A and C is that this direction is **systematic and clean**. The grid of panel seams is visible and intentional — part of the design, not something to hide. The surface reads as modular, with each panel a distinct unit. This is the most "constructed" of the three candidates.

---

## Surface material

Primary: **Manufactured metal floor panels**

- Base color: medium-dark gunmetal gray with subtle brushed-metal texture
- Surface variation: panel seam lines, slight reflectivity differences between panels
- Accent material: **Maintenance strips** — narrow channels between panels for conduit, pipes, and drainage
- Secondary: **Tactile warning strips** — textured hazard zones near edges and heavy machinery areas

The metal panels are the dominant material (approximately 80% of visible surface). Maintenance strips appear as dark channels between panels. Warning strips appear as textured or colored bands in specific zones — near platform edges, around resource extraction areas, and along vehicle lanes.

---

## Color palette

| Role | Color | Hex (approximate) | Usage |
|------|-------|-------------------|-------|
| Primary | Gunmetal gray | `#4a4e52` | Panel surface |
| Secondary | Brushed steel | `#5a5e62` | Panel variation |
| Accent 1 | Cool teal stripe | `#3a6b6b` | Maintenance strip, conduit access |
| Accent 2 | Amber warning | `#8b7a3d` | Hazard zones, edge markings |
| Highlight | Pale steel | `#8a8e92` | Worn panel edges, high-traffic wear |
| Shadow | Dark channel | `#1e2226` | Seam gaps, drainage channels |

Variation range: ±3% brightness across panels, with panel-to-panel tint shifts suggesting different manufacturing batches. This is tighter than Candidate A because the modular system is more uniform by nature.

---

## Tile structure

Tiles are 256x128 isometric diamonds, same as current sand terrain. The modular panel system creates a deliberate grid — the key is making the grid feel intentional and functional, not like a chess board.

### How tiles connect into a continuous surface

1. **Panel alignment**: Each 256x128 tile represents one floor panel. The panel edges are visible as thin dark lines (1-2px) with subtle bolt/fastener details at corners. This makes the grid visible but functional — it looks like a real raised-floor system.

2. **Maintenance strip continuity**: Dark channels between panels run continuously across multiple tiles. These strips suggest conduit routing and drainage. They appear on approximately 30% of tile edges and always connect to adjacent tile edges.

3. **Batch variation**: Panels in a 4x4 or 6x6 area share a similar tint (same manufacturing batch). Adjacent batch areas have slightly different tint. This creates large-scale visual organization without random noise.

4. **Wear patterns**: High-traffic areas (near buildings, along vehicle paths) show subtle directional wear — faint polishing of the brushed-metal surface. Low-traffic areas retain more of the original surface texture.

### Tile variants needed

| Variant | Description | Frequency |
|---------|-------------|-----------|
| `grid_standard` | Standard floor panel, brushed metal | 35% |
| `grid_channel` | Panel with maintenance channel edge | 20% |
| `grid_worn` | Worn/polished panel in high-traffic zone | 15% |
| `grid_hazard` | Panel with amber warning strip zone | 10% |
| `grid_access` | Access panel (subtle hatch lines) | 10% |
| `grid_marked` | Panel with surface markings (direction arrows, zone IDs) | 10% |

---

## Edge treatment

The platform edge is a manufactured boundary — clean, deliberate, and industrial. Options:

1. **Frame beam**: A structural beam running around the platform perimeter. The beam is visible as a thick metal border with bolt connections. Beyond the beam, the outer world drops away slightly (visually) to a lower level.

2. **Warning perimeter**: The outermost row of panels is marked with amber/yellow hazard striping. Beyond the warning zone, panels transition to a rougher, unprocessed surface (unfinished rock or raw excavation).

3. **Edge glow**: Subtle edge lighting (cool blue or amber) along the platform boundary, suggesting safety lighting. The glow fades into the darker outer surface.

**Recommended**: Option 2 (Warning perimeter) for the initial implementation. It uses the existing panel system rather than requiring separate edge assets, and the amber hazard striping adds visual interest and readability.

---

## Resource integration

Resources are accessed through **built-in extraction points** in the floor panels. The visual story is:

- The facility was built over mineral deposits on purpose
- Resource extraction is integrated into the floor infrastructure
- Small deposits use floor-mounted extraction nodes
- Large deposits use dedicated extraction rigs mounted to the floor

Visual details:
- **Small ore**: A floor-mounted extraction node — a small industrial fixture with a glowing mineral core visible through a viewport or extraction grill. The surrounding panels show conduit routing to the node.
- **Medium ore**: A larger extraction assembly — multiple nodes clustered around a floor cutout, with visible mineral glow from below the floor level.
- **Large ore**: A floor section removed to expose a mineral deposit below. The cut edges show the floor panel cross-section (metal top, structural fill, mineral layer). Industrial extraction equipment surrounds the opening.
- **Infinite deposit**: A dedicated extraction platform — a reinforced floor section with a central mining shaft, surrounded by processing equipment and conveyor connections.

The extraction infrastructure adds visual richness and makes resources feel like part of the facility, not random crystals scattered on the ground.

---

## Why this candidate fits Four Elements Phaser

1. **Systematic and readable**: The modular grid makes the map extremely readable. Each tile is clearly defined. Units and buildings sit on a predictable, organized surface. This is the most "board game readable" of the three candidates.

2. **Clean RTS aesthetic**: Many successful RTS games (including StarCraft installations, Command & Conquer bases) use clean, systematic floor surfaces for base/facility areas. This candidate captures that feeling.

3. **Consistent with industrial fiction**: A manufactured floor system fits the mining platform concept — this is a facility that was designed, built, and installed, not a natural surface.

4. **Good contrast for units**: The medium-dark metal surface provides good contrast for both dark and light unit sprites. Buildings with warm tones (bronze, amber) stand out well.

5. **Maintenance strips add visual interest**: The dark channels between panels break up the flat metal surface without requiring complex texturing. They also serve as visual guides for the eye, directing attention along paths and between zones.

---

## Risks / weaknesses

1. **Too grid-like**: The visible panel seams reinforce the diamond tile grid, which is exactly what the VISUAL roadmap wants to move away from. This is the most serious risk. The current sand terrain already looks like a grid of diamonds — this candidate makes the grid visible and intentional, which could be worse if the visual result still reads as "chess board" rather than "industrial floor."

   Mitigation: Use large-scale tint batch variation to break the grid visually. Ensure panel seams are thin and subtle (1-2px dark lines, not bright borders). Use the maintenance channel system to create larger visual structures that span multiple tiles.

2. **Too artificial/sterile**: The clean, manufactured aesthetic may feel cold and lifeless. This is a deliberate choice for this candidate, but it may not match the "battlefield" feeling that the VISUAL roadmap targets.

   Mitigation: Add atmospheric elements — mineral dust accumulation, rust staining at edges, wear patterns — to soften the sterility.

3. **Distinguishing panel variants**: With six variants at ±3% tint variation, the panels may look too similar. The grid may appear as a uniform gray field rather than a varied industrial floor.

   Mitigation: Make the hazard and marked variants visually distinct (amber striping, surface markings). Ensure the channel variant has clearly visible dark lines.

4. **Unit visibility on medium-gray**: Medium-dark gray (#4a4e52) provides less contrast for dark units than Candidate A's dark concrete. Harvester and builder sprites in darker faction colors may not stand out as clearly.

   Mitigation: Add subtle rim lighting or ground shadow effects to units. Ensure resource nodes have strong glow contrast.

5. **Less atmospheric than A or C**: This candidate sacrifices atmosphere for readability. The facility floor looks functional but may not evoke the "industrial mineral wasteland" feeling as strongly as the other candidates.

---

## What not to copy from references

- **StarCraft Space Platform tileset**: Do not copy the blue-tinted metal panels, the specific border designs, or the animated edge lights. The structural lesson (modular floor panels with visible seams) is useful; the visual style is too clean and sci-fi for this project.

- **StarCraft Installation floors**: Do not copy the indoor facility patterns, wall-mounted lights, or specific tile connection designs.

- **Command & Conquer bases**: Do not copy the concrete/metal paving patterns used for base floors. The lesson about systematic floor readability is useful.

- **Warhammer 40K industrial tiles**: Do not copy the gothic-industrial aesthetic, skull motifs, or specific hazard stripe patterns. The structural reference is useful; the visual identity is not.

---

## Candidate tile image

See: `candidate-B-tile.png` (if generated)

This would show a single 256x128 isometric diamond tile of the modular sci-fi floor — gunmetal gray panel with visible seam edges, a faint brushed-metal texture, and a thin maintenance channel along one edge.
