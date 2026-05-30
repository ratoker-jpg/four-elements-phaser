# VISUAL CANDIDATE SUMMARY — Four Elements Phaser

Status: approved direction summary — Candidate A selected for VISUAL roadmap  
Project: Four Elements Phaser  
Date: 2026-05-30

---

## Purpose

This document summarizes the three visual direction candidates for the industrial map surface in Four Elements Phaser and records the project owner decision after review.

VISUAL-01 is complete.

The approved primary direction is:

```text
Candidate A — Heavy Mining Platform
```

Allowed secondary enrichment:

```text
Selected Candidate C elements only as secondary detail
```

Candidate B is not approved as primary because its visible grid/panel structure risks turning the map back into a readable board rather than a grounded battlefield.

Runtime implementation should not jump directly into production terrain replacement. The next step is the documented VISUAL-01B layered platform frame checkpoint, followed by a dev-only VISUAL-02A prototype.

---

## Candidate list

| ID | Name | Key quality | Key risk | Decision |
|----|------|-------------|----------|----------|
| A | Heavy Mining Platform | Grounded, substantial, best RTS readability | May be too dark or monotonous | **Approved primary** |
| B | Modular Sci-Fi Floor Grid | Systematic, clean, most readable | Reinforces diamond grid (opposite of VISUAL goal) | **Rejected as primary** |
| C | Industrial Mineral Wasteland | Atmospheric, organic, strongest sense of place | May drift back toward desert/sand | **Allowed only as secondary enrichment** |

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

## Approved direction

**Candidate A — Heavy Mining Platform** is approved as the primary visual direction, with selected Candidate C elements allowed as secondary enrichment.

### Reasoning

1. **Best balance of readability and atmosphere**: Candidate A provides excellent RTS readability (dark base, bright accents) while still feeling grounded and industrial.

2. **Lowest risk of sand drift**: Candidate C's warm soil tones and mineral presence create a real risk of visually drifting back toward the rejected desert direction. Candidate A's dark concrete is unmistakably industrial.

3. **Addresses the core VISUAL problem**: The VISUAL roadmap says the map "reads as a grid of diamond tiles rather than a grounded surface." Candidate A's continuous concrete / industrial platform direction directly addresses this.

4. **Forgiving for asset generation**: Concrete/asphalt/composite industrial surfaces are easier to normalize into reusable floor tiles than precise sci-fi panel seams.

5. **Strong resource contrast**: Dark concrete provides strong contrast for glowing mineral deposits, making resources immediately readable.

---

## Approved hybrid treatment

Candidate C may enrich Candidate A, but must not replace it as primary.

Allowed Candidate C-style details:

- mineral dust accumulation in specific zones;
- hairline cracks with faint blue-cyan crystal traces;
- compacted-soil or grime patches where concrete has worn down;
- outer-world wasteland feel around the platform;
- sparse vegetation / moss / weeds in the non-playable background layer.

Not allowed:

- returning to sand/desert as the main terrain;
- making the playable platform look like compacted dirt first;
- turning the primary map into natural wasteland instead of industrial platform;
- making organic detail more important than RTS readability.

---

## Why not Candidate B as primary

Candidate B's visible panel grid directly contradicts the VISUAL roadmap goal of making the map not look like a grid of diamond tiles. Making the grid visible and intentional is a bold choice, but it risks looking like a chess board with chrome trim.

B-style details can appear as rare accents only if they do not create strong edge-to-edge grid lines.

---

## Why not Candidate C as primary

Candidate C is visually interesting, but it carries the sand-drift risk. After the VISUAL roadmap pivot was caused by sand terrain not meeting the quality bar, choosing a direction that could be perceived as "desert with concrete" would be risky.

C is better as enrichment on top of A's readable industrial foundation.

---

## Follow-up decision after visual proof exploration

After visual proof exploration outside the repo, the practical map rendering approach was refined.

The accepted practical model is now documented in:

```text
docs/project/VISUAL_01B_LAYERED_PLATFORM_FRAME.md
```

Summary:

```text
background world + tile-filled platform center + arena frame overlay + invisible grid
```

This means Candidate A remains the visual direction, but runtime work should prototype a layered platform frame rather than a single huge baked map image or a naive tile-only terrain.

---

## Runtime approval status

Approved:

```text
Candidate A as primary visual direction.
Layered Platform Frame + Tile Fill as practical prototype direction.
VISUAL-02A may proceed only after VISUAL-01B is reviewed and merged.
```

Not approved:

```text
Production terrain replacement before dev-only prototype.
Gameplay/pathfinding/economy changes inside VISUAL-02A.
Mass asset generation inside docs PRs.
Copying StarCraft assets/UI directly.
```

---

## Candidate documents

- `docs/project/visual-candidates/candidate-A.md` — Heavy Mining Platform
- `docs/project/visual-candidates/candidate-B.md` — Modular Sci-Fi Floor Grid
- `docs/project/visual-candidates/candidate-C.md` — Industrial Mineral Wasteland

---

## Candidate tile images

Image generation was attempted during VISUAL-01 but could not be completed in the build environment. Later external visual proof exploration produced the accepted layered platform direction and tile standard documented in VISUAL-01B.

Do not treat this file as a request to generate more candidate sets. The direction is selected; the next work is scoped technical prototyping.
