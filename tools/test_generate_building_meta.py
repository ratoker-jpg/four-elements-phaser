#!/usr/bin/env python3
"""
Unit tests for the building metadata generator's pure helper functions.

Run:
    python3 tools/test_generate_building_meta.py

These tests validate the deterministic, pure computation logic of the
offline generator without requiring actual PNG files on disk.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

# Add tools/ to sys.path so we can import the generator module directly
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from generate_building_meta import (
    compute_alpha_bounds,
    compute_ground_line_ratio,
    compute_origin_x,
    compute_target_display_width,
    detect_category,
    CONFIRMED_FOOTPRINTS,
    DEFAULT_FOOTPRINT,
    FACTIONS,
    BUILDING_TYPES,
    BUILDING_KEY_SUFFIXES,
    BUILDING_FILE_NAMES,
)
from PIL import Image


# ─── compute_alpha_bounds ────────────────────────────────────────────


class TestComputeAlphaBounds(unittest.TestCase):
    """Tests for compute_alpha_bounds: bounding box of non-transparent pixels."""

    def _make_rgba(self, w: int, h: int, fill_alpha: int = 0) -> Image.Image:
        """Create an RGBA image of size (w, h) with uniform fill_alpha."""
        img = Image.new("RGBA", (w, h), (0, 0, 0, fill_alpha))
        return img

    def test_fully_transparent_returns_none(self):
        """A fully transparent image has no alpha bounds."""
        img = self._make_rgba(100, 100, fill_alpha=0)
        self.assertIsNone(compute_alpha_bounds(img))

    def test_fully_opaque_returns_full_bounds(self):
        """A fully opaque image has bounds matching the full image."""
        img = self._make_rgba(100, 100, fill_alpha=255)
        result = compute_alpha_bounds(img)
        self.assertIsNotNone(result)
        self.assertEqual(result, {"left": 0, "top": 0, "right": 100, "bottom": 100})

    def test_top_left_corner_pixel(self):
        """A single opaque pixel at (0,0) has tight bounds."""
        img = self._make_rgba(50, 50, fill_alpha=0)
        img.putpixel((0, 0), (255, 0, 0, 255))
        result = compute_alpha_bounds(img)
        self.assertEqual(result, {"left": 0, "top": 0, "right": 1, "bottom": 1})

    def test_bottom_right_corner_pixel(self):
        """A single opaque pixel at the bottom-right corner."""
        img = self._make_rgba(50, 50, fill_alpha=0)
        img.putpixel((49, 49), (0, 255, 0, 255))
        result = compute_alpha_bounds(img)
        self.assertEqual(result, {"left": 49, "top": 49, "right": 50, "bottom": 50})

    def test_padding_on_all_sides(self):
        """10px transparent padding on all sides of a 100x100 image."""
        img = self._make_rgba(100, 100, fill_alpha=0)
        # Fill center region with opaque pixels
        for y in range(10, 90):
            for x in range(10, 90):
                img.putpixel((x, y), (128, 128, 128, 255))
        result = compute_alpha_bounds(img)
        self.assertEqual(result, {"left": 10, "top": 10, "right": 90, "bottom": 90})

    def test_exclusive_right_bottom_bounds(self):
        """right and bottom are exclusive (like array slice end)."""
        img = self._make_rgba(200, 300, fill_alpha=0)
        # Opaque rectangle from (3,3) to (99, 199) inclusive
        for y in range(3, 200):
            for x in range(3, 100):
                img.putpixel((x, y), (200, 100, 50, 255))
        result = compute_alpha_bounds(img)
        # right = 100 (exclusive), bottom = 200 (exclusive)
        self.assertEqual(result, {"left": 3, "top": 3, "right": 100, "bottom": 200})

    def test_rgb_image_converted_to_rgba(self):
        """An RGB image (no alpha channel) is handled by converting to RGBA."""
        img = Image.new("RGB", (50, 50), (255, 128, 0))
        result = compute_alpha_bounds(img)
        # All pixels should be opaque after conversion
        self.assertIsNotNone(result)
        self.assertEqual(result, {"left": 0, "top": 0, "right": 50, "bottom": 50})

    def test_partial_alpha_pixel_detected(self):
        """A pixel with alpha > 0 (even alpha=1) is considered visible."""
        img = self._make_rgba(20, 20, fill_alpha=0)
        img.putpixel((5, 5), (0, 0, 0, 1))  # barely visible
        result = compute_alpha_bounds(img)
        self.assertIsNotNone(result)
        self.assertEqual(result, {"left": 5, "top": 5, "right": 6, "bottom": 6})


# ─── compute_ground_line_ratio ──────────────────────────────────────


class TestComputeGroundLineRatio(unittest.TestCase):
    """Tests for compute_ground_line_ratio: alpha-bottom / source-height."""

    def test_full_alpha_bottom_equals_one(self):
        """When alpha extends to the bottom edge, ratio = 1.0."""
        img = Image.new("RGBA", (100, 100), (128, 128, 128, 255))
        alpha_bounds = {"left": 0, "top": 0, "right": 100, "bottom": 100}
        result = compute_ground_line_ratio(img, alpha_bounds)
        self.assertAlmostEqual(result, 1.0, places=4)

    def test_alpha_bottom_halfway(self):
        """When alpha bottom is at 50% of source height."""
        img = Image.new("RGBA", (100, 200), (0, 0, 0, 0))
        alpha_bounds = {"left": 0, "top": 0, "right": 100, "bottom": 100}
        result = compute_ground_line_ratio(img, alpha_bounds)
        self.assertAlmostEqual(result, 0.5, places=4)

    def test_small_alpha_near_bottom(self):
        """Typical isometric building: alpha extends nearly to bottom."""
        img = Image.new("RGBA", (800, 600), (0, 0, 0, 0))
        alpha_bounds = {"left": 3, "top": 3, "right": 797, "bottom": 597}
        result = compute_ground_line_ratio(img, alpha_bounds)
        self.assertAlmostEqual(result, 597 / 600, places=4)
        # Should be close to 1.0 for isometric buildings
        self.assertGreater(result, 0.95)

    def test_rounded_to_six_decimals(self):
        """Result is rounded to 6 decimal places for stability."""
        img = Image.new("RGBA", (100, 760), (0, 0, 0, 0))
        alpha_bounds = {"left": 0, "top": 0, "right": 100, "bottom": 757}
        result = compute_ground_line_ratio(img, alpha_bounds)
        # 757 / 760 = 0.996052631578...
        self.assertAlmostEqual(result, 0.996053, places=5)


# ─── compute_origin_x ──────────────────────────────────────────────


class TestComputeOriginX(unittest.TestCase):
    """Tests for compute_origin_x: visible horizontal center / source width."""

    def test_centered_content(self):
        """Content centered in source → originX ≈ 0.5."""
        alpha_bounds = {"left": 50, "top": 0, "right": 150, "bottom": 100}
        result = compute_origin_x(alpha_bounds, 200)
        # (50 + 150) / 2 = 100; 100 / 200 = 0.5
        self.assertAlmostEqual(result, 0.5, places=4)

    def test_content_shifted_left(self):
        """Content shifted to the left → originX < 0.5."""
        alpha_bounds = {"left": 0, "top": 0, "right": 100, "bottom": 100}
        result = compute_origin_x(alpha_bounds, 200)
        # (0 + 100) / 2 = 50; 50 / 200 = 0.25
        self.assertAlmostEqual(result, 0.25, places=4)

    def test_content_shifted_right(self):
        """Content shifted to the right → originX > 0.5."""
        alpha_bounds = {"left": 100, "top": 0, "right": 200, "bottom": 100}
        result = compute_origin_x(alpha_bounds, 200)
        # (100 + 200) / 2 = 150; 150 / 200 = 0.75
        self.assertAlmostEqual(result, 0.75, places=4)

    def test_narrow_centered_content(self):
        """Narrow content centered in a wider image."""
        alpha_bounds = {"left": 90, "top": 0, "right": 110, "bottom": 100}
        result = compute_origin_x(alpha_bounds, 200)
        # (90 + 110) / 2 = 100; 100 / 200 = 0.5
        self.assertAlmostEqual(result, 0.5, places=4)

    def test_rounded_to_six_decimals(self):
        """Result is rounded to 6 decimal places."""
        alpha_bounds = {"left": 3, "top": 0, "right": 1005, "bottom": 100}
        result = compute_origin_x(alpha_bounds, 1008)
        # (3 + 1005) / 2 = 504; 504 / 1008 = 0.5
        self.assertAlmostEqual(result, 0.5, places=5)


# ─── detect_category ────────────────────────────────────────────────


class TestDetectCategory(unittest.TestCase):
    """Tests for detect_category: visual category from aspect ratio."""

    def test_structure_balanced(self):
        """Square content → structure."""
        self.assertEqual(detect_category(200, 200), "structure")

    def test_structure_moderate_height(self):
        """Moderate height/width ratio → structure."""
        self.assertEqual(detect_category(200, 280), "structure")

    def test_tower_tall_narrow(self):
        """Height/width > 1.5 → tower."""
        self.assertEqual(detect_category(100, 200), "tower")

    def test_tower_exactly_1_5(self):
        """Height/width > 1.5 (boundary: 1.51) → tower."""
        self.assertEqual(detect_category(100, 151), "tower")

    def test_flat_wide_short(self):
        """Height/width < 0.7 → flat."""
        self.assertEqual(detect_category(200, 100), "flat")

    def test_flat_exactly_below_0_7(self):
        """Height/width < 0.7 (boundary: 0.69) → flat."""
        self.assertEqual(detect_category(100, 69), "flat")

    def test_zero_width_returns_structure(self):
        """Zero width → structure (safe default)."""
        self.assertEqual(detect_category(0, 100), "structure")

    def test_current_power_plant_dimensions(self):
        """Power-plant visible content is typically ~1202x813 → flat."""
        self.assertEqual(detect_category(1202, 813), "flat")

    def test_current_separator_dimensions(self):
        """Separator visible content is typically ~1002x754 → structure."""
        self.assertEqual(detect_category(1002, 754), "structure")


# ─── compute_target_display_width ───────────────────────────────────


class TestComputeTargetDisplayWidth(unittest.TestCase):
    """Tests for compute_target_display_width: footprint → display pixels."""

    def test_1x1_footprint(self):
        self.assertEqual(compute_target_display_width(1, 1), 65)

    def test_2x2_footprint(self):
        self.assertEqual(compute_target_display_width(2, 2), 128)

    def test_3x3_footprint(self):
        self.assertEqual(compute_target_display_width(3, 3), 200)

    def test_non_square_uses_larger_dimension(self):
        """2x3 footprint uses max dim = 3 → 200px."""
        self.assertEqual(compute_target_display_width(2, 3), 200)
        self.assertEqual(compute_target_display_width(3, 2), 200)

    def test_1x2_uses_larger_dimension(self):
        """1x2 footprint uses max dim = 2 → 128px."""
        self.assertEqual(compute_target_display_width(1, 2), 128)
        self.assertEqual(compute_target_display_width(2, 1), 128)

    def test_extrapolation_4x4(self):
        """4x4: 200 + (4-3)*72 = 272."""
        self.assertEqual(compute_target_display_width(4, 4), 272)

    def test_extrapolation_5x5(self):
        """5x5: 200 + (5-3)*72 = 344."""
        self.assertEqual(compute_target_display_width(5, 5), 344)

    def test_extrapolation_6x4(self):
        """6x4: max dim = 6 → 200 + (6-3)*72 = 416."""
        self.assertEqual(compute_target_display_width(6, 4), 416)


# ─── Constants consistency ──────────────────────────────────────────


class TestConstantsConsistency(unittest.TestCase):
    """Cross-check that Python constants match TypeScript sources."""

    def test_factions_match_typescript(self):
        """FACTIONS must match Faction type in state/types.ts."""
        expected = ["cyan", "green", "yellow", "purple"]
        self.assertEqual(FACTIONS, expected)

    def test_building_types_match_typescript(self):
        """BUILDING_TYPES must match BuildingType in state/types.ts."""
        expected = [
            "separator",
            "raw-storage",
            "matter-storage",
            "power-plant",
            "command-relay",
            "units-factory",
        ]
        self.assertEqual(BUILDING_TYPES, expected)

    def test_confirmed_footprints_subset_of_building_types(self):
        """All CONFIRMED_FOOTPRINTS keys must be valid BUILDING_TYPES."""
        for bt in CONFIRMED_FOOTPRINTS:
            self.assertIn(bt, BUILDING_TYPES)

    def test_key_suffixes_match_file_names(self):
        """BUILDING_KEY_SUFFIXES values should match filename stems."""
        for bt, suffix in BUILDING_KEY_SUFFIXES.items():
            filename = BUILDING_FILE_NAMES[bt]
            stem = filename.replace(".png", "")
            self.assertEqual(suffix, stem,
                             f"Key suffix for {bt} ({suffix}) doesn't match filename stem ({stem})")

    def test_all_building_types_have_file_names(self):
        """Every BUILDING_TYPE must have a file name mapping."""
        for bt in BUILDING_TYPES:
            self.assertIn(bt, BUILDING_FILE_NAMES)

    def test_all_building_types_have_key_suffixes(self):
        """Every BUILDING_TYPE must have a key suffix mapping."""
        for bt in BUILDING_TYPES:
            self.assertIn(bt, BUILDING_KEY_SUFFIXES)

    def test_confirmed_footprints_match_building_config(self):
        """CONFIRMED_FOOTPRINTS must match BUILDING_CONFIG in construction.ts.

        Current BUILDING_CONFIG entries (from src/state/construction.ts):
          separator:      2x2
          power-plant:    2x2
          units-factory:  2x2
        """
        expected = {
            "separator": (2, 2),
            "power-plant": (2, 2),
            "units-factory": (2, 2),
        }
        self.assertEqual(CONFIRMED_FOOTPRINTS, expected)

    def test_default_footprint_is_2x2(self):
        """DEFAULT_FOOTPRINT should be (2,2) for unconfigured building types."""
        self.assertEqual(DEFAULT_FOOTPRINT, (2, 2))


if __name__ == "__main__":
    unittest.main()
