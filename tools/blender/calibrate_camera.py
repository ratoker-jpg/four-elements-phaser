"""
Blender Python script: calibrate_camera.py

UNIT-ASSET-PIPELINE-01: Camera calibration for isometric sprite pipeline.

Renders calibration markers (axis markers, cube, ground grid) through
the Blender orthographic camera and compares pixel positions against
the CAMERA_PROJECTION_CONTRACT projection formula.

The contract defines:
  screen = origin + worldX * basisX + worldY * basisY + worldZ * basisZ
  basisX = { x: 38, y: 19 }
  basisY = { x: -38, y: 19 }
  basisZ = { x: 0, y: -60 }

This script:
  1. Creates calibration geometry in Blender at known world positions.
  2. Renders them through the isometric camera.
  3. Computes expected screen positions using the contract formula.
  4. Saves a calibration report with expected positions and tolerance.
  5. Denis inspects the rendered image and measures actual marker positions
     to determine pixel error.

Usage (from Blender command line):
    blender --background --python tools/blender/calibrate_camera.py -- \
        --output art/generated/tankviewer/calibration

Compare-only mode (no Blender needed):
    python3 tools/blender/calibrate_camera.py --compare-only \
        --output art/generated/tankviewer/calibration

The script exits with code 0 and never fails CI. Source assets are
intentionally local/uncommitted and may be absent.
"""

import json
import math
import os
import sys
from pathlib import Path

# ─── CAMERA_PROJECTION_CONTRACT constants ────────────────────────────

TILE_W = 76
TILE_H = 38
BASIS_X = {'x': TILE_W / 2, 'y': TILE_H / 2}   # {38, 19}
BASIS_Y = {'x': -TILE_W / 2, 'y': TILE_H / 2}   # {-38, 19}
BASIS_Z = {'x': 0, 'y': -60}

# ─── Calibration points ──────────────────────────────────────────────
# Each point is (worldX, worldY, worldZ, label)
# worldX/worldY are in tile units, worldZ is in height units

CALIBRATION_POINTS = [
    (0, 0, 0, 'ground_origin'),
    (1, 0, 0, 'plus_X_tile_step'),
    (0, 1, 0, 'plus_Y_tile_step'),
    (0, 0, 1, 'plus_Z_height'),
    (1, 1, 1, 'combined_1_1_1'),
    (-1, 0, 0, 'minus_X_tile_step'),
    (0, -1, 0, 'minus_Y_tile_step'),
    (1, 1, 0, 'ground_1_1'),
    (2, 0, 0, 'plus_2X_tile_step'),
    (0, 0, 0.5, 'half_Z_height'),
]

# Acceptance tolerance in pixels
ACCEPTANCE_TOLERANCE_PX = 1.0


def project_world_point(world_x, world_y, world_z, origin=None):
    """Apply the camera projection contract formula.

    screen = origin + worldX * basisX + worldY * basisY + worldZ * basisZ
    """
    if origin is None:
        origin = {'x': 0, 'y': 0}

    screen_x = origin['x'] + world_x * BASIS_X['x'] + world_y * BASIS_Y['x'] + world_z * BASIS_Z['x']
    screen_y = origin['y'] + world_x * BASIS_X['y'] + world_y * BASIS_Y['y'] + world_z * BASIS_Z['y']

    return {'x': screen_x, 'y': screen_y}


def compute_expected_positions(render_center_x, render_center_y):
    """Compute expected pixel positions for all calibration points.

    The render center corresponds to world origin (0,0,0).
    Expected positions are: renderCenter + projectWorldPoint(wx, wy, wz)
    """
    origin = {'x': render_center_x, 'y': render_center_y}
    positions = {}

    for wx, wy, wz, label in CALIBRATION_POINTS:
        proj = project_world_point(wx, wy, wz, origin)
        positions[label] = {
            'worldX': wx,
            'worldY': wy,
            'worldZ': wz,
            'expectedScreenX': proj['x'],
            'expectedScreenY': proj['y'],
        }

    return positions


def run_compare_only(output_dir):
    """Compare-only mode: read and display calibration report."""
    print("[calibrate_camera] Compare-only mode: reading calibration report...")
    report_path = os.path.join(output_dir, 'calibration_report.json')
    if os.path.exists(report_path):
        with open(report_path, 'r') as f:
            report = json.load(f)
        print(f"[calibrate_camera] Report loaded from: {report_path}")
        print(f"  Resolution: {report['renderResolution']}")
        print(f"  Calibration points: {len(report['calibrationPoints'])}")
        print(f"  Tolerance: +/-{report['acceptanceTolerancePx']} px")

        print("\n  === EXPECTED POSITIONS (from CAMERA_PROJECTION_CONTRACT) ===")
        for label, pos in report['calibrationPoints'].items():
            print(f"    {label:25s}: expected screen ({pos['expectedScreenX']:.1f}, {pos['expectedScreenY']:.1f})")

        print("\n  NOTE: Pixel-level comparison requires manual inspection of the rendered image.")
        print("  Measure marker centers in the rendered PNG and compare against expected positions.")
        print(f"  Rendered image: {os.path.join(output_dir, 'calibration_render.png')}")
    else:
        print(f"[calibrate_camera] No calibration report found at: {report_path}")
        print("  Run the Blender calibration render first:")
        print(f"    blender --background --python tools/blender/calibrate_camera.py -- --output {output_dir}")


def run_blender_calibration(output_dir, resolution, orthographic_scale):
    """Run the full calibration render inside Blender."""
    import bpy
    import mathutils

    print("[calibrate_camera] Setting up calibration scene...")

    # Clear scene
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=True)

    # Setup render
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in dir(bpy.types) else 'BLENDER_EEVEE'
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.film_transparent = False
    scene.render.resolution_x = resolution
    scene.render.resolution_y = resolution
    scene.render.resolution_percentage = 100
    os.makedirs(output_dir, exist_ok=True)

    # Set world background to dark gray
    if scene.world and scene.world.node_tree:
        bg_node = scene.world.node_tree.nodes.get('Background')
        if bg_node:
            bg_node.inputs[0].default_value = (0.15, 0.15, 0.15, 1.0)

    # Setup camera
    cam_data = bpy.data.cameras.new('CalibrationCamera')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = orthographic_scale

    cam_obj = bpy.data.objects.new('CalibrationCamera', cam_data)
    bpy.context.collection.objects.link(cam_obj)

    azimuth_rad = math.radians(45.0)
    elevation_rad = math.radians(35.264)
    dist = 10.0

    cam_x = dist * math.cos(elevation_rad) * math.cos(azimuth_rad)
    cam_y = dist * math.cos(elevation_rad) * math.sin(azimuth_rad)
    cam_z = dist * math.sin(elevation_rad)

    cam_obj.location = (cam_x, cam_y, cam_z)
    direction = (-cam_x, -cam_y, -cam_z)
    rot_quat = mathutils.Vector(direction).to_track_quat('-Z', 'Y')
    cam_obj.rotation_euler = rot_quat.to_euler()

    bpy.context.scene.camera = cam_obj

    # Create calibration markers
    marker_colors = [
        (1.0, 1.0, 1.0, 1.0),   # origin: white
        (1.0, 0.0, 0.0, 1.0),   # +X: red
        (0.0, 1.0, 0.0, 1.0),   # +Y: green
        (0.0, 0.0, 1.0, 1.0),   # +Z: blue
        (1.0, 1.0, 0.0, 1.0),   # (1,1,1): yellow
        (1.0, 0.5, 0.0, 1.0),   # -X: orange
        (0.0, 1.0, 1.0, 1.0),   # -Y: cyan
        (0.5, 0.0, 1.0, 1.0),   # ground(1,1): purple
        (1.0, 0.0, 0.5, 1.0),   # +2X: pink
        (0.5, 0.5, 1.0, 1.0),   # 0.5Z: light blue
    ]

    for i, (wx, wy, wz, label) in enumerate(CALIBRATION_POINTS):
        color = marker_colors[i] if i < len(marker_colors) else (1, 1, 1, 1)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.06, location=(wx, wy, wz))
        obj = bpy.context.active_object
        obj.name = label

        mat = bpy.data.materials.new(name=f"MarkerMat_{label}")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get('Principled BSDF')
        if bsdf:
            bsdf.inputs['Base Color'].default_value = color
            bsdf.inputs['Emission Color'].default_value = color
            bsdf.inputs['Emission Strength'].default_value = 2.0
        obj.data.materials.append(mat)

    # Add lighting
    light_data = bpy.data.lights.new(name='CalibSun', type='SUN')
    light_data.energy = 3.0
    light_obj = bpy.data.objects.new('CalibSun', light_data)
    bpy.context.collection.objects.link(light_obj)
    light_obj.location = (5, -5, 10)
    direction = (-5, 5, -10)
    rot_quat = mathutils.Vector(direction).to_track_quat('-Z', 'Y')
    light_obj.rotation_euler = rot_quat.to_euler()

    # Render
    render_path = os.path.join(output_dir, 'calibration_render.png')
    bpy.context.scene.render.filepath = render_path
    print(f"[calibrate_camera] Rendering calibration image to: {render_path}")
    bpy.ops.render.render(write_still=True)

    # Compute and save expected positions
    center_x = resolution / 2
    center_y = resolution / 2

    expected = compute_expected_positions(center_x, center_y)

    report = {
        'version': 1,
        'pipeline': 'tankviewer-blender-isometric',
        'renderResolution': resolution,
        'renderCenter': {'x': center_x, 'y': center_y},
        'projectionContract': {
            'basisX': BASIS_X,
            'basisY': BASIS_Y,
            'basisZ': BASIS_Z,
            'formula': 'screen = origin + worldX * basisX + worldY * basisY + worldZ * basisZ',
        },
        'calibrationPoints': expected,
        'acceptanceTolerancePx': ACCEPTANCE_TOLERANCE_PX,
        'note': 'Compare Blender-rendered marker positions against these expected positions. '
                'Use image analysis or manual inspection to measure actual pixel coordinates.',
    }

    report_path = os.path.join(output_dir, 'calibration_report.json')
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)

    print(f"[calibrate_camera] Calibration report written to: {report_path}")

    print("\n[calibrate_camera] === EXPECTED POSITIONS (from CAMERA_PROJECTION_CONTRACT) ===")
    for label, pos in expected.items():
        print(f"  {label:25s}: expected screen ({pos['expectedScreenX']:.1f}, {pos['expectedScreenY']:.1f})")

    print(f"\n[calibrate_camera] Acceptance tolerance: +/-{ACCEPTANCE_TOLERANCE_PX} px")
    print("[calibrate_camera] Measure marker centers in calibration_render.png to determine actual error.")


def parse_args():
    """Parse command-line arguments."""
    argv = sys.argv
    try:
        separator_index = argv.index('--')
        args = argv[separator_index + 1:]
    except ValueError:
        args = []

    parsed = {
        'output': 'art/generated/tankviewer/calibration',
        'resolution': 512,
        'orthographic_scale': 5.0,
        'compare_only': False,
    }

    i = 0
    while i < len(args):
        arg = args[i]
        if arg == '--output' and i + 1 < len(args):
            parsed['output'] = args[i + 1]; i += 2
        elif arg == '--resolution' and i + 1 < len(args):
            parsed['resolution'] = int(args[i + 1]); i += 2
        elif arg == '--orthographic-scale' and i + 1 < len(args):
            parsed['orthographic_scale'] = float(args[i + 1]); i += 2
        elif arg == '--compare-only':
            parsed['compare_only'] = True; i += 1
        else:
            i += 1

    return parsed


def main():
    """Main entry point."""
    args = parse_args()

    if args['compare_only']:
        run_compare_only(args['output'])
        return

    # Check if running inside Blender
    try:
        import bpy
        run_blender_calibration(args['output'], args['resolution'], args['orthographic_scale'])
    except ImportError:
        print("[calibrate_camera] Blender not available. Running compare-only mode.")
        print("  For full calibration, run inside Blender:")
        print(f"    blender --background --python tools/blender/calibrate_camera.py -- --output {args['output']}")
        print("\n  Generating expected positions report without render...")
        os.makedirs(args['output'], exist_ok=True)

        center_x = args['resolution'] / 2
        center_y = args['resolution'] / 2
        expected = compute_expected_positions(center_x, center_y)

        report = {
            'version': 1,
            'pipeline': 'tankviewer-blender-isometric',
            'renderResolution': args['resolution'],
            'renderCenter': {'x': center_x, 'y': center_y},
            'projectionContract': {
                'basisX': BASIS_X,
                'basisY': BASIS_Y,
                'basisZ': BASIS_Z,
                'formula': 'screen = origin + worldX * basisX + worldY * basisY + worldZ * basisZ',
            },
            'calibrationPoints': expected,
            'acceptanceTolerancePx': ACCEPTANCE_TOLERANCE_PX,
            'blenderAvailable': False,
            'note': 'Blender was not available. Only expected positions are computed. '
                    'Run inside Blender to generate the calibration render image.',
        }

        report_path = os.path.join(args['output'], 'calibration_report.json')
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)

        print(f"[calibrate_camera] Expected positions report written to: {report_path}")
        print("\n  === EXPECTED POSITIONS (from CAMERA_PROJECTION_CONTRACT) ===")
        for label, pos in expected.items():
            print(f"    {label:25s}: expected screen ({pos['expectedScreenX']:.1f}, {pos['expectedScreenY']:.1f})")


if __name__ == '__main__':
    main()
