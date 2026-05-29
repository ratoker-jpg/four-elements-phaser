# VISUAL CANDIDATE SUMMARY — Four Elements Phaser

Status: candidate review document — no direction approved for runtime integration  
Project: Four Elements Phaser  
Date: 2026-05-30

---

## Purpose

This document summarizes three visual direction candidates for the industrial map surface in Four Elements Phaser. Each candidate is described in detail in its own document. No candidate has been approved for runtime integration — the project owner (Denis) must review and choose one direction before any runtime work begins.

---

## Candidate list

| ID | Name | Key quality | Key risk |
|----|------|-------------|----------|
| A | Heavy Mining Platform | Grounded, substantial, best RTS readability | May be too dark or monotonous |
| B | Modular Sci-Fi Floor Grid | Systematic, clean, most readable | Reinforces diamond grid (opposite of VISUAL goal) |
| C | Industrial Mineral Wasteland | Atmospheric, organic, strongest sense of place | May drift back toward desert/sand |

---

## Comparison table

| Aspect | A — Heavy Mining Platform | B — Modular Sci-Fi Floor Grid | C — Industrial Mineral Wasteland |
|--------|---------------------------|-------------------------------|----------------------------------|
| **Primary material** | Dark poured concrete + worn steel | Manufactured metal panels | Cracked concrete + compacted mineral soil |
| **Base color** | `#3a3a3c` deep charcoal | `#4a4e52` gunmetal gray | `#3e3832` warm gray-brown |
| **Accent colors** | Rust/bronze, industrial olive | Cool teal, amber warning | Rust-orange, cool blue-gray crystal |
| **Grid visibility** | Hidden (continuous surface) | Visible (intentional panel seams) | Organic (no grid structure) |
| **Edge treatment** | Worn concrete boundary (organic) | Warning perimeter (systematic) | Mineral outcrop boundary (natural) |
| **Resource style** | Ore in excavations on surface | Floor-mounted extraction nodes | Minerals emerging from ground |
| **Atmosphere** | Heavy, grounded, industrial | Clean, systematic, facility | Weathered, atmospheric, wasteland |
| **Sand drift risk** | Very low (too dark, too industrial) | Very low (too clean, too metallic) | Medium (soil + mineral + warm tones) |
| **Unit contrast** | Excellent (dark base) | Good (medium-dark base) | Good (warm dark base) |
| **Tile repetition** | Forgiving (concrete is uniform) | Risky (grid is visible) | Forgiving (natural variation) |
| **Asset complexity** | Low (concrete textures) | Low-medium (metal textures) | Medium-high (mixed materials) |
| **Readability** | High | Very high | Medium-high |
| **Uniqueness** | Medium (standard industrial) | Low (many RTS games use this) | High (distinctive blend) |

---

## Recommended direction

**Candidate A — Heavy Mining Platform** is recommended as the primary direction, with select elements from Candidate C as secondary enrichment.

### Reasoning

1. **Best balance of readability and atmosphere**: Candidate A provides excellent RTS readability (dark base, bright accents) while still feeling grounded and industrial. It is not as atmospheric as C, but it is significantly more readable.

2. **Lowest risk of sand drift**: Candidate C's warm soil tones and mineral presence create a real risk of visually drifting back toward the rejected desert direction. Candidate A's dark concrete is unmistakably industrial.

3. **Addresses the core VISUAL problem**: The VISUAL roadmap says the map "reads as a grid of diamond tiles rather than a grounded surface." Candidate A's continuous concrete surface directly addresses this — concrete is poured, not tiled, and the tile boundaries disappear under the continuous material.

4. **Forgiving for asset generation**: Concrete is relatively simple to generate — flat, slightly textured, with subtle variation. This is easier to get right than the mixed-material surface of C or the precise seam patterns of B.

5. **Strong resource contrast**: Dark concrete provides excellent contrast for glowing mineral deposits, making resources immediately readable.

### Suggested hybrid approach

After Candidate A is established in runtime, consider enriching with elements from Candidate C:

- Add mineral dust accumulation in specific zones (warm tint patches over the concrete base)
- Add hairline cracks with faint crystal growth as a tile variant
- Add compacted-soil patches near resource nodes where the concrete has been worn through

This gives the atmosphere of C without the sand-drift risk, built on the solid readability foundation of A.

### Why not Candidate B as primary

Candidate B's visible panel grid directly contradicts the VISUAL roadmap goal of making the map NOT look like a grid of diamond tiles. Making the grid visible and intentional is a bold choice, but it risks looking like a chess board with chrome trim. The grid would need to be executed perfectly to look like an industrial floor rather than a game board. The risk is too high for the primary direction.

### Why not Candidate C as primary

Candidate C is the most visually interesting of the three, but it carries the sand-drift risk. After the entire VISUAL roadmap pivot was caused by sand terrain not meeting the quality bar, choosing a direction that could be perceived as "desert with concrete" would be risky. C is better as an enrichment layer on top of A's solid foundation.

---

## Open questions for Denis

1. **Warm vs. cool industrial**: Candidate A is relatively cool (gray/charcoal). Candidate C is warmer (brown-gray). Do you prefer a cooler or warmer industrial feel?

2. **Resource glow color**: Should mineral deposits glow warm (amber/orange) or cool (blue-green)? This affects the overall color temperature of the map. Warm glow on cool concrete = strong contrast. Cool glow on cool concrete = cohesive but lower contrast.

3. **Grid visibility preference**: Do you want the tile grid to be completely invisible (Candidate A approach), visible as intentional seams (Candidate B), or somewhere in between (subtle panel lines that suggest structure without forming a visible grid)?

4. **Map edge priority**: How important is the irregular/organic edge treatment? Candidate C makes this easiest. Candidate A requires more deliberate edge design. Should we invest in organic edges early (VISUAL-04) or defer until after the core surface is established?

5. **Hybrid approach**: Are you open to the recommended hybrid (A as primary, C as enrichment layer)? Or do you want a single pure direction?

6. **Candidate image review**: Image generation was not available in the build environment. Would you like candidate tile images generated separately (in a different tool/session) before making a decision? Or are the text descriptions sufficient for initial direction approval?

---

## Important note

**No runtime direction is approved until Denis chooses one.** This document recommends Candidate A, but the final decision belongs to the project owner. No VISUAL-02 (rendering prototype spike) or VISUAL-03 (terrain integration) work should begin until one direction is approved.

If Denis chooses a direction with modifications (e.g., "A but warmer" or "A with C's resource style"), those modifications should be documented in this file as an addendum before runtime work begins.

---

## Candidate documents

- `docs/project/visual-candidates/candidate-A.md` — Heavy Mining Platform
- `docs/project/visual-candidates/candidate-B.md` — Modular Sci-Fi Floor Grid
- `docs/project/visual-candidates/candidate-C.md` — Industrial Mineral Wasteland

---

## Candidate tile images

Image generation was attempted but could not be completed in the build environment (API connection timeout). The text descriptions in each candidate document are detailed enough to serve as specifications for manual or AI-assisted image generation in a separate step.

If Denis would like to review candidate tile images before choosing a direction, a separate image-generation session can be arranged. This should not block the direction decision — the textual descriptions cover material, color, tile structure, and edge treatment in sufficient detail for an informed choice.
