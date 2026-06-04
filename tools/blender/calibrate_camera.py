"""
Calibration helper for the Blender TankViewer sprite pipeline.

This script never hard-fails CI. If Blender is unavailable it still writes the
expected projection report so Denis can compare it later after installing
Blender.
"""

from __future__ import annotations

import json
import math
import os
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from factory_common import BASIS_X, BASIS_Y, BASIS_Z, dump_json  # noqa: E402

CALIBRATION_POINTS = [
    (0, 0, 0, "ground_origin"),
    (1, 0, 0, "plus_X_tile_step"),
    (0, 1, 0, "plus_Y_tile_step"),
    (0, 0, 1, "plus_Z_height"),
    (1, 1, 1, "combined_1_1_1"),
]
ACCEPTANCE_TOLERANCE_PX = 1.0


def parse_args() -> dict:
    argv = sys.argv
    try:
        separator = argv.index("--")
        args = argv[separator + 1 :]
    except ValueError:
        args = argv[1:]

    parsed = {
        "output": "art/generated/tankviewer/calibration",
        "resolution": 512,
        "orthographic_scale": 5.0,
        "compare_only": False,
    }

    i = 0
    while i < len(args):
        arg = args[i]
        if arg == "--output" and i + 1 < len(args):
            parsed["output"] = args[i + 1]
            i += 2
        elif arg == "--resolution" and i + 1 < len(args):
            parsed["resolution"] = int(args[i + 1])
            i += 2
        elif arg == "--orthographic-scale" and i + 1 < len(args):
            parsed["orthographic_scale"] = float(args[i + 1])
            i += 2
        elif arg == "--compare-only":
            parsed["compare_only"] = True
            i += 1
        else:
            i += 1
    return parsed


def project_point(wx: float, wy: float, wz: float, origin_x: float, origin_y: float) -> dict:
    return {
        "expectedScreenX": origin_x + wx * BASIS_X["x"] + wy * BASIS_Y["x"] + wz * BASIS_Z["x"],
        "expectedScreenY": origin_y + wx * BASIS_X["y"] + wy * BASIS_Y["y"] + wz * BASIS_Z["y"],
    }


def build_report(output_dir: Path, resolution: int) -> dict:
    center_x = resolution / 2
    center_y = resolution / 2
    positions = {}
    for wx, wy, wz, label in CALIBRATION_POINTS:
        positions[label] = {
            "worldX": wx,
            "worldY": wy,
            "worldZ": wz,
            **project_point(wx, wy, wz, center_x, center_y),
        }
    report = {
        "version": 1,
        "pipeline": "tankviewer-blender-isometric",
        "renderResolution": resolution,
        "renderCenter": {"x": center_x, "y": center_y},
        "projectionContract": {
            "basisX": BASIS_X,
            "basisY": BASIS_Y,
            "basisZ": BASIS_Z,
            "formula": "screen = origin + worldX * basisX + worldY * basisY + worldZ * basisZ",
        },
        "calibrationPoints": positions,
        "acceptanceTolerancePx": ACCEPTANCE_TOLERANCE_PX,
        "renderPath": str(output_dir / "calibration_render.png"),
    }
    return report


def run_compare_only(output_dir: Path, resolution: int) -> None:
    report = build_report(output_dir, resolution)
    dump_json(output_dir / "calibration_report.json", report)
    print(json.dumps(report, indent=2))


def run_blender(output_dir: Path, resolution: int, orthographic_scale: float) -> None:
    import bpy  # type: ignore
    import mathutils  # type: ignore

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=True)

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.render.resolution_x = resolution
    scene.render.resolution_y = resolution
    scene.render.resolution_percentage = 100
    scene.view_settings.exposure = 0.0

    cam_data = bpy.data.cameras.new("CalibrationCamera")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = orthographic_scale
    cam = bpy.data.objects.new("CalibrationCamera", cam_data)
    bpy.context.collection.objects.link(cam)

    azimuth = math.radians(45.0)
    elevation = math.radians(35.264)
    distance = 10.0
    cam_x = distance * math.cos(elevation) * math.cos(azimuth)
    cam_y = distance * math.cos(elevation) * math.sin(azimuth)
    cam_z = distance * math.sin(elevation)
    cam.location = (cam_x, cam_y, cam_z)
    cam.rotation_euler = mathutils.Vector((-cam_x, -cam_y, -cam_z)).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam

    colors = [
        (1.0, 1.0, 1.0, 1.0),
        (1.0, 0.0, 0.0, 1.0),
        (0.0, 1.0, 0.0, 1.0),
        (0.0, 0.2, 1.0, 1.0),
        (1.0, 1.0, 0.0, 1.0),
    ]
    for idx, (wx, wy, wz, label) in enumerate(CALIBRATION_POINTS):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.06, location=(wx, wy, wz))
        obj = bpy.context.active_object
        obj.name = label
        mat = bpy.data.materials.new(name=f"Marker_{label}")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = colors[idx]
            bsdf.inputs["Emission Color"].default_value = colors[idx]
            bsdf.inputs["Emission Strength"].default_value = 2.0
        obj.data.materials.append(mat)

    light = bpy.data.lights.new(name="CalibrationSun", type="SUN")
    light.energy = 2.5
    light_obj = bpy.data.objects.new("CalibrationSun", light)
    bpy.context.collection.objects.link(light_obj)
    light_obj.location = (5, -5, 10)

    output_dir.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(output_dir / "calibration_render.png")
    bpy.ops.render.render(write_still=True)

    report = build_report(output_dir, resolution)
    report["blenderAvailable"] = True
    dump_json(output_dir / "calibration_report.json", report)
    print(json.dumps(report, indent=2))


def main() -> None:
    args = parse_args()
    output_dir = Path(args["output"])
    output_dir.mkdir(parents=True, exist_ok=True)

    if args["compare_only"]:
        run_compare_only(output_dir, args["resolution"])
        return

    try:
        import bpy  # noqa: F401
    except ImportError:
        run_compare_only(output_dir, args["resolution"])
        print("Blender not available. Install Blender 3.x+ and rerun this script inside Blender for the PNG render.")
        return

    run_blender(output_dir, args["resolution"], args["orthographic_scale"])


if __name__ == "__main__":
    main()
