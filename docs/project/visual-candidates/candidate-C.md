# Candidate C — Industrial Mineral Wasteland

Status: visual direction candidate — not approved for runtime integration  
Project: Four Elements Phaser  
Date: 2026-05-30

---

## Visual approach

The map surface reads as an industrial wasteland — cracked concrete and compacted mineral soil fused together by years of mining activity, machinery traffic, and mineral runoff. The visual language sits between Candidates A and B: it has the substance and age of A, but with more organic, terrain-like qualities. The surface feels like ground that was once an industrial installation but has been partially reclaimed by the minerals it was built to extract.

The key differentiator from Candidates A and B is the **organic, atmospheric quality**. This is not a pristine platform (A) or a clean modular floor (B). This is a surface where industrial infrastructure and natural mineral forces have merged into something new — concrete cracked by mineral crystal growth, soil stained with ore dust, machine paths worn into the ground. The surface feels lived-in and weathered, with a strong sense of place.

---

## Surface material

Primary: **Cracked and mineral-stained concrete / compacted mineral soil blend**

- Base color: warm dark gray-brown — concrete that has been stained by mineral dust and ore runoff over years of operation
- Surface variation: cracks filled with mineral crystal growth, exposed subsoil, machine-worn paths
- Accent material: **Mineral dust deposits** — areas where ore processing has left fine mineral powder on the surface, creating subtle color variations (blue-gray, rust-orange, pale green depending on mineral type)
- Secondary: **Compacted soil** — areas where the concrete has been completely worn away or removed, revealing the mineral-rich earth underneath

The blend of concrete and soil is the defining feature. Approximately 50-60% of the surface is concrete (in varying states of decay), 30-40% is compacted mineral soil, and 10% is mineral dust/deposit accumulation. This ratio creates a surface that reads as "industrial ground" rather than "desert with concrete pieces."

---

## Color palette

| Role | Color | Hex (approximate) | Usage |
|------|-------|-------------------|-------|
| Primary | Warm dark gray-brown | `#3e3832` | Concrete base (mineral-stained) |
| Secondary | Mineral brown | `#4a3e32` | Compacted soil |
| Accent 1 | Rust-orange | `#8b5e3d` | Mineral staining, ore dust |
| Accent 2 | Cool mineral blue-gray | `#4a5058` | Crystal deposits in cracks |
| Highlight | Pale mineral dust | `#b0a08a` | Surface dust, wear |
| Shadow | Dark earth | `#1e1a16` | Deep cracks, soil pockets |

Variation range: ±6% brightness with strong warm/cool tint variation. The wider range is needed because this surface has more natural variation (concrete vs. soil vs. mineral) than A or B. Zone-based tinting creates areas that are warmer (mineral dust, rust) or cooler (exposed concrete, crystal deposits).

---

## Tile structure

Tiles are 256x128 isometric diamonds. The challenge is making tiles with mixed materials (concrete + soil + mineral) read as a continuous ground surface rather than a patchwork.

### How tiles connect into a continuous surface

1. **Concrete fragmentation continuity**: Concrete areas in each tile show fragmentation patterns that continue across tile boundaries. A crack in one tile continues into the next. Concrete "islands" are surrounded by soil, not floating in isolation.

2. **Soil blending**: The soil areas have no hard edges — they blend into concrete via gradual transitions (2-3 tiles of mixed concrete/soil). This prevents visible tile boundaries at soil/concrete transitions.

3. **Mineral vein system**: Subtle mineral deposits (blue-gray crystal veins, rust-orange dust patches) follow continuous paths across multiple tiles, creating a larger visual structure that ignores tile boundaries.

4. **Worn path network**: Machine-worn paths (darker, smoother soil or polished concrete) follow logical routes across the map, connecting areas where buildings and resources would be. These paths span multiple tiles and create natural visual flow.

### Tile variants needed

| Variant | Description | Frequency |
|---------|-------------|-----------|
| `wasteland_concrete` | Mostly intact concrete with mineral staining | 25% |
| `wasteland_cracked` | Cracked concrete with soil showing through | 25% |
| `wasteland_soil` | Compacted mineral soil with sparse concrete fragments | 20% |
| `wasteland_dusty` | Surface with mineral dust accumulation | 15% |
| `wasteland_worn` | Machine-worn path (polished concrete or smooth soil) | 10% |
| `wasteland_crystal` | Area with visible mineral crystal growth in cracks | 5% |

---

## Edge treatment

The platform boundary is the most organic of the three candidates. The surface simply **fades and thins** at the edges:

1. **Concrete dissolution**: Concrete areas become smaller and more fragmented toward the map edge. Beyond the playable area, there are only scattered concrete fragments in raw mineral soil.

2. **Mineral outcrop boundary**: The outer world surface is raw mineral earth with exposed rock and ore deposits. The transition from "industrial ground" to "raw earth" is gradual (3-5 tiles of mixed area).

3. **Abandoned infrastructure**: At the edges, remnants of old industrial infrastructure (broken pipe sections, collapsed drainage, abandoned equipment foundations) suggest the facility once extended further but was abandoned at the current boundary.

**Recommended**: Option 2 (Mineral outcrop boundary) for the initial implementation. The gradual transition is the most forgiving for visual alignment and creates a natural, organic edge that reinforces the "wasteland" feeling.

---

## Resource integration

Resources are **emerging from the ground itself** — the minerals that the facility was built to extract are visible everywhere. The visual story is:

- The mining facility was built here because of the rich mineral deposits
- Resource nodes are places where mineral concentrations are dense enough to harvest
- The ground everywhere shows signs of mineral presence (crystal veins, ore dust)
- Harvestable deposits are simply the richest concentrations

Visual details:
- **Small ore**: A cluster of mineral crystals growing from a crack in the concrete, with surrounding mineral dust staining. The crystals glow faintly (cool blue or warm amber depending on type).
- **Medium ore**: An exposed mineral vein — a section of ground where the surface has eroded or been removed to reveal a rich vein of ore below. The vein shows crystal growth in multiple colors.
- **Large ore**: A mineral excavation — a wider area where mining has exposed a large deposit. The walls of the excavation show layered mineral deposits with visible crystal formations.
- **Infinite deposit**: A mineral geyser or fissure — a natural feature where mineral-rich material continuously wells up from below. Industrial collection infrastructure (pipes, funnels) surrounds the feature.

Resources feel like part of the ground rather than objects placed on it. This is the key differentiator — minerals are emerging from the surface, not sitting on top of it.

---

## Why this candidate fits Four Elements Phaser

1. **Most atmospheric of the three**: The industrial wasteland aesthetic creates a strong sense of place. The ground tells a story — this was a mining facility, the minerals are everywhere, the infrastructure is decaying. This is the most visually evocative candidate.

2. **Natural transition from sand**: The sand terrain direction is paused, not deleted. This candidate shares some natural terrain qualities (soil, mineral deposits) while firmly moving away from "desert." The transition from sand to industrial wasteland is more gradual than to heavy platform or modular floor.

3. **Resources feel integrated**: Because minerals are part of the ground everywhere, resource nodes feel like natural concentrations rather than random crystal clusters. This creates visual coherence across the map.

4. **Irregular edges are natural**: The wasteland boundary doesn't need to be a sharp industrial edge — the surface naturally thins and fades at the edges. This makes the "irregular playable edges" target easy to achieve.

5. **Strong visual identity**: The blend of industrial decay and mineral growth creates a unique visual that doesn't look like any existing RTS game. This is not StarCraft, not C&C, not AoE — it is "Four Elements industrial wasteland."

---

## Risks / weaknesses

1. **Drifts back toward desert/terrain**: This is the most serious risk. If the soil areas are too prominent, too warm, or too natural-looking, the surface may read as "desert with concrete pieces" rather than "industrial wasteland." The visual line between "mineral wasteland" and "sandy terrain with some concrete" is thin.

   Mitigation: Keep the color palette distinctly cooler and more gray-brown than the current sand terrain. Concrete must be the dominant visual impression, not soil. Mineral colors should be blue-gray and rust-orange (industrial), not warm yellow-brown (desert).

2. **Visual noise**: The mix of concrete, soil, mineral, and crystal creates more visual detail per tile than Candidates A or B. This can make the surface look busy or noisy, especially when scrolling quickly.

   Mitigation: Use large-scale zone tinting to create visual calm at a distance. Keep crystal and mineral details small and subtle — they should be discoverable on closer inspection, not shouting from across the map.

3. **Harder to generate assets**: The mixed-material surface is more complex to produce than pure concrete (A) or pure metal (B). Each tile needs a believable blend of materials. AI image generation may struggle with the "part concrete, part soil, part mineral" concept.

   Mitigation: Generate simpler base tiles (mostly concrete with subtle mineral staining) and add detail through overlay variants (crack mineral growth, dust accumulation).

4. **Resource visibility**: If minerals are "part of the ground," harvestable resource nodes may not stand out enough. If the ground everywhere has mineral presence, how does the player quickly identify which crystals are harvestable?

   Mitigation: Harvestable resource nodes should have a distinct glow, scale, and animation that non-harvestable mineral decoration does not. The contrast must be immediate and obvious.

5. **Four Elements theme mismatch**: The "Four Elements" name suggests classical elements (fire, water, earth, air). An industrial wasteland may feel disconnected from the elemental theme.

   Mitigation: The mineral deposits can represent "earth element," and the industrial infrastructure represents human interaction with elemental forces. The wasteland is the result of extracting elemental resources. This narrative framing connects the visual to the theme.

---

## What not to copy from references

- **StarCraft badlands/ash world**: Do not copy the specific cracked-earth texture, the lava glow, or the volcanic color scheme. The structural lesson (terrain with visible mineral presence) is useful; the volcanic aesthetic is not.

- **Tiberian Sun tiberium fields**: Do not copy the green crystal aesthetic, the specific crystal shapes, or the "tiberium spreading" visual. The lesson about integrating resources into the terrain is useful; the green crystal look is too closely associated with C&C.

- **Current Four Elements sand terrain**: Do not simply re-skin the sand tiles with a slightly different color. The wasteland must read as fundamentally different — concrete and industrial decay, not recolored desert. The soil must feel compacted and mineral-stained, not sandy.

- **Wasteland/Mad Max aesthetic**: Do not drift into post-apocalyptic rust and decay. This is an active industrial facility, not an abandoned wasteland. The decay is from ongoing use, not from abandonment.

---

## Candidate tile image

See: `candidate-C-tile.png` (if generated)

This would show a single 256x128 isometric diamond tile of the industrial mineral wasteland — warm gray-brown cracked concrete with mineral staining, a hairline crack filled with faint blue-gray crystal growth, and a patch of compacted mineral soil showing through at one edge.
