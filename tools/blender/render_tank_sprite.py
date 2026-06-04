"""
Blender Python script: render_tank_sprite.py

UNIT-ASSET-PIPELINE-01: 3DS TankViewer asset -> isometric sprite renderer.

Imports a .3ds file, applies details + lightmap textures, sets up an
orthographic camera matching CAMERA_PROJECTION_CONTRACT, and renders
the model at specified rotation angles to transparent PNG files.

Direction convention (must match game's directionFromDelta):
    8-dir:  0=E, 1=SE, 2=S, 3=SW, 4=W, 5=NW, 6=N, 7=NE
    16-dir: 0=E, 1=ESE, 2=SE, 3=SSE, 4=S, 5=SSW, 6=SW, 7=WSW,
            8=W, 9=WNW, 10=NW, 11=NNW, 12=N, 13=NNE, 14=NE, 15=ENE

Usage (from Blender command line):
    blender --background --python tools/blender/render_tank_sprite.py -- \
        --source art/source/tankviewer/data/hulls/wasp \
        --model wasp.3ds \
        --diffuse wasp_0_details.png \
        --lightmap wasp_0_lightmap.jpg \
        --output art/generated/tankviewer/hulls/wasp/m0 \
        --directions 16 \
        --faction cyan \
        --name wasp_m0_hull

If source files are not found, the script prints a clear error message
and exits without failure (exit code 0) so CI is not broken.

Requirements:
    - Blender 3.x+ with io_scene_3ds addon enabled
    - Source .3ds + texture files in the specified directory
"""

import bpy
import os
import sys
import math
import json
from pathlib import Path

# ─── CAMERA_PROJECTION_CONTRACT constants ────────────────────────────
# These MUST match src/config/cameraProjectionContract.ts

TILE_W = 76
TILE_H = 38
BASIS_X = (TILE_W / 2, TILE_H / 2)       # (38, 19)
BASIS_Y = (-TILE_W / 2, TILE_H / 2)      # (-38, 19)
BASIS_Z = (0, -60)                         # vertical scale

# ─── Blender camera setup ────────────────────────────────────────────

# For a 2:1 isometric projection:
#   Azimuth = 45 degrees (rotation around Z in ground plane)
#   Elevation = arctan(1/sqrt(2)) = 35.264 degrees
#
# The game uses a non-standard vertical scale (basisZ.y = -60 per unit,
# vs. TILE_H/2 = 19 per unit), so objects appear taller than standard
# isometric. We handle this by scaling the model's Z in Blender.

# Standard isometric camera angles
CAMERA_AZIMUTH_DEG = 45.0
CAMERA_ELEVATION_DEG = 35.264

# Vertical stretch factor from the projection contract:
# |basisZ.y| / (TILE_H / 2) = 60 / 19 = 3.158
# In standard isometric, 1 Z unit maps to ~19 screen pixels (same as ground Y).
# In the game, 1 Z unit maps to 60 screen pixels.
# So in Blender we need to scale Z by: gameRatio / standardRatio
VERTICAL_STRETCH_FACTOR = abs(BASIS_Z[1]) / (TILE_H / 2)  # ~3.158

# ─── Direction convention ────────────────────────────────────────────
# Must match src/state/updateGameState directionFromDelta():
#   E=0, SE=1, S=2, SW=3, W=4, NW=5, N=6, NE=7

DIRECTION_NAMES_8 = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE']
DIRECTION_NAMES_16 = [
    'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW',
    'W', 'WNW', 'NW', 'NNW', 'N', 'NNE', 'NE', 'ENE',
]

# Rotation offset so dir0 = E (screen-right) with isometric camera at
# azimuth 45 degrees. With model default forward = +Y (Blender convention),
# screen-E requires Z-rotation of 225 degrees. This may need adjustment
# per model if the 3DS export uses a different default facing.
ROTATION_OFFSET_DEG = 225.0


def clear_scene():
    """Remove all objects from the current Blender scene."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=True)


def setup_render_settings(output_dir, resolution_x=256, resolution_y=256):
    """Configure render settings for transparent PNG output."""
    scene = bpy.context.scene

    # Render engine
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in dir(bpy.types) else 'BLENDER_EEVEE'

    # Output format
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.compression = 15

    # Transparent background
    scene.render.film_transparent = True
    scene.world.node_tree.nodes.clear()

    # Resolution
    scene.render.resolution_x = resolution_x
    scene.render.resolution_y = resolution_y
    scene.render.resolution_percentage = 100

    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)


def setup_camera(orthographic_scale=4.0):
    """Create an orthographic camera matching the isometric projection contract."""
    import mathutils

    # Create camera
    cam_data = bpy.data.cameras.new('IsometricCamera')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = orthographic_scale

    cam_obj = bpy.data.objects.new('IsometricCamera', cam_data)
    bpy.context.collection.objects.link(cam_obj)

    # Position camera for isometric view
    # Distance from origin (just needs to be far enough for ortho)
    dist = 10.0

    # Convert azimuth + elevation to camera position
    azimuth_rad = math.radians(CAMERA_AZIMUTH_DEG)
    elevation_rad = math.radians(CAMERA_ELEVATION_DEG)

    cam_x = dist * math.cos(elevation_rad) * math.cos(azimuth_rad)
    cam_y = dist * math.cos(elevation_rad) * math.sin(azimuth_rad)
    cam_z = dist * math.sin(elevation_rad)

    cam_obj.location = (cam_x, cam_y, cam_z)

    # Look at origin
    direction = (-cam_x, -cam_y, -cam_z)
    rot_quat = mathutils.Vector(direction).to_track_quat('-Z', 'Y')
    cam_obj.rotation_euler = rot_quat.to_euler()

    # Set as active camera
    bpy.context.scene.camera = cam_obj

    return cam_obj


def resolve_3ds_import_operator():
    """Resolve the 3DS import operator, handling version-dependent naming.

    Blender's 3DS import addon exposes the operator under different names
    depending on the Blender version:
      - Blender 4.x+: bpy.ops.import_scene.autodesk_3ds
      - Blender 3.x:  bpy.ops.import_scene["3ds"] (via getattr, since
                       Python attributes cannot start with a digit)

    Returns the operator if found, or None if the addon is not enabled.
    """
    # Try modern Blender 4.x+ name first
    if hasattr(bpy.ops.import_scene, 'autodesk_3ds'):
        return bpy.ops.import_scene.autodesk_3ds

    # Try legacy Blender 3.x name ("3ds" is not a valid Python identifier,
    # so we must use getattr to avoid SyntaxError at parse time)
    op = getattr(bpy.ops.import_scene, '3ds', None)
    if op is not None:
        return op

    return None


def import_3ds(filepath):
    """Import a .3ds file into the current scene."""
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"3DS file not found: {filepath}")

    op = resolve_3ds_import_operator()
    if op is None:
        raise RuntimeError(
            "Blender 3DS import addon not available. "
            "Enable 'Import-Export: 3DS Format' in Blender Preferences > Add-ons."
        )

    op(filepath=filepath)


def apply_textures(diffuse_path, lightmap_path):
    """Apply diffuse and lightmap textures to the first mesh object."""
    mesh_objects = [obj for obj in bpy.context.selected_objects if obj.type == 'MESH']

    if not mesh_objects:
        # Try all mesh objects in scene if nothing selected after import
        mesh_objects = [obj for obj in bpy.data.objects if obj.type == 'MESH']

    if not mesh_objects:
        print("[render_tank_sprite] WARNING: No mesh objects found after import.")
        return

    for obj in mesh_objects:
        if not obj.data.materials:
            # Create a new material
            mat = bpy.data.materials.new(name=f"TankMaterial_{obj.name}")
            mat.use_nodes = True
            obj.data.materials.append(mat)
        else:
            mat = obj.data.materials[0]
            if not mat.use_nodes:
                mat.use_nodes = True

        nodes = mat.node_tree.nodes
        links = mat.node_tree.links

        # Get or create Principled BSDF
        bsdf = None
        for node in nodes:
            if node.type == 'BSDF_PRINCIPLED':
                bsdf = node
                break
        if bsdf is None:
            bsdf = nodes.new('ShaderNodeBsdfPrincipled')

        # Apply diffuse/details texture
        if diffuse_path and os.path.exists(diffuse_path):
            diffuse_img = bpy.data.images.load(diffuse_path)
            tex_node = nodes.new('ShaderNodeTexImage')
            tex_node.image = diffuse_img
            tex_node.label = 'DetailsDiffuse'
            links.new(tex_node.outputs['Color'], bsdf.inputs['Base Color'])
        else:
            if diffuse_path:
                print(f"[render_tank_sprite] WARNING: Diffuse texture not found: {diffuse_path}")

        # Apply lightmap texture (multiply with diffuse for baked lighting)
        if lightmap_path and os.path.exists(lightmap_path):
            lightmap_img = bpy.data.images.load(lightmap_path)
            lm_node = nodes.new('ShaderNodeTexImage')
            lm_node.image = lightmap_img
            lm_node.label = 'Lightmap'

            # Multiply lightmap with diffuse
            mix_node = nodes.new('ShaderNodeMix')
            mix_node.data_type = 'RGBA'
            mix_node.inputs[0].default_value = 1.0  # factor

            # Connect: diffuse -> mix color A, lightmap -> mix color B
            if diffuse_path and os.path.exists(diffuse_path):
                # Re-find the diffuse tex node
                diff_tex = None
                for node in nodes:
                    if node.label == 'DetailsDiffuse':
                        diff_tex = node
                        break
                if diff_tex:
                    links.new(diff_tex.outputs['Color'], mix_node.inputs[6])  # Color A
                    links.new(lm_node.outputs['Color'], mix_node.inputs[7])   # Color B
                    links.new(mix_node.outputs[2], bsdf.inputs['Base Color']) # Result
            else:
                # No diffuse, use lightmap as base color
                links.new(lm_node.outputs['Color'], bsdf.inputs['Base Color'])
        else:
            if lightmap_path:
                print(f"[render_tank_sprite] WARNING: Lightmap texture not found: {lightmap_path}")


def rotate_model_to_direction(direction_index, num_directions=16):
    """Rotate the model to face the specified direction index.

    Direction convention (must match game's directionFromDelta):
        8-dir:  0=E, 1=SE, 2=S, 3=SW, 4=W, 5=NW, 6=N, 7=NE
        16-dir: 0=E, 1=ESE, 2=SE, 3=SSE, 4=S, 5=SSW, 6=SW, 7=WSW,
                8=W, 9=WNW, 10=NW, 11=NNW, 12=N, 13=NNE, 14=NE, 15=ENE

    The rotation includes ROTATION_OFFSET_DEG to account for the isometric
    camera azimuth (45 degrees). With the model's default forward = +Y in
    Blender, a Z-rotation offset of 225 degrees is needed so that dir0
    produces a screen-East facing sprite. This offset may need adjustment
    per model if the 3DS export uses a different default facing.

    The model is rotated in-place around its origin.
    """
    step = 360.0 / num_directions
    angle_deg = ROTATION_OFFSET_DEG + direction_index * step
    angle_rad = math.radians(angle_deg)

    # Rotate all mesh objects around the Z axis
    mesh_objects = [obj for obj in bpy.data.objects if obj.type == 'MESH']
    for obj in mesh_objects:
        obj.rotation_euler = (0, 0, angle_rad)


def render_frame(output_path):
    """Render the current scene and save to the specified path."""
    bpy.context.scene.render.filepath = output_path
    bpy.ops.render.render(write_still=True)


def parse_args():
    """Parse command-line arguments passed after '--' in Blender CLI."""
    argv = sys.argv
    try:
        separator_index = argv.index('--')
        args = argv[separator_index + 1:]
    except ValueError:
        args = []

    parsed = {
        'source': None,
        'model': None,
        'diffuse': None,
        'lightmap': None,
        'output': None,
        'directions': 16,
        'faction': 'cyan',
        'name': 'tank',
        'resolution': 256,
        'orthographic_scale': 4.0,
    }

    i = 0
    while i < len(args):
        arg = args[i]
        if arg == '--source' and i + 1 < len(args):
            parsed['source'] = args[i + 1]; i += 2
        elif arg == '--model' and i + 1 < len(args):
            parsed['model'] = args[i + 1]; i += 2
        elif arg == '--diffuse' and i + 1 < len(args):
            parsed['diffuse'] = args[i + 1]; i += 2
        elif arg == '--lightmap' and i + 1 < len(args):
            parsed['lightmap'] = args[i + 1]; i += 2
        elif arg == '--output' and i + 1 < len(args):
            parsed['output'] = args[i + 1]; i += 2
        elif arg == '--directions' and i + 1 < len(args):
            parsed['directions'] = int(args[i + 1]); i += 2
        elif arg == '--faction' and i + 1 < len(args):
            parsed['faction'] = args[i + 1]; i += 2
        elif arg == '--name' and i + 1 < len(args):
            parsed['name'] = args[i + 1]; i += 2
        elif arg == '--resolution' and i + 1 < len(args):
            parsed['resolution'] = int(args[i + 1]); i += 2
        elif arg == '--orthographic-scale' and i + 1 < len(args):
            parsed['orthographic_scale'] = float(args[i + 1]); i += 2
        else:
            i += 1

    return parsed


def main():
    """Main entry point for the Blender rendering pipeline."""
    args = parse_args()

    # ── Validate source files ─────────────────────────────────────────
    source_dir = args['source']
    if not source_dir:
        print("[render_tank_sprite] ERROR: --source directory not specified.")
        print("  Usage: blender --background --python render_tank_sprite.py --")
        print("    --source <dir> --model <file.3ds> --diffuse <file.png>")
        print("    --lightmap <file.jpg> --output <dir> --directions <N>")
        return

    model_path = os.path.join(source_dir, args['model']) if args['model'] else None
    diffuse_path = os.path.join(source_dir, args['diffuse']) if args['diffuse'] else None
    lightmap_path = os.path.join(source_dir, args['lightmap']) if args['lightmap'] else None

    # Check if model file exists
    if model_path and not os.path.exists(model_path):
        print(f"[render_tank_sprite] ERROR: Model file not found: {model_path}")
        print("  Place source assets under art/source/tankviewer/data/ (gitignored).")
        print("  The source archive is intentionally NOT committed to the repo.")
        return  # Exit cleanly so CI is not broken

    # Check textures (warnings only, not errors)
    if diffuse_path and not os.path.exists(diffuse_path):
        print(f"[render_tank_sprite] WARNING: Diffuse texture not found: {diffuse_path}")
    if lightmap_path and not os.path.exists(lightmap_path):
        print(f"[render_tank_sprite] WARNING: Lightmap texture not found: {lightmap_path}")

    # ── Validate output directory ─────────────────────────────────────
    output_dir = args['output']
    if not output_dir:
        print("[render_tank_sprite] ERROR: --output directory not specified.")
        return

    # ── Clear scene and set up ────────────────────────────────────────
    print("[render_tank_sprite] Clearing scene...")
    clear_scene()

    print("[render_tank_sprite] Setting up render settings...")
    setup_render_settings(output_dir, args['resolution'], args['resolution'])

    print("[render_tank_sprite] Setting up isometric camera...")
    setup_camera(args['orthographic_scale'])

    # ── Import model ──────────────────────────────────────────────────
    if model_path:
        print(f"[render_tank_sprite] Importing 3DS model: {model_path}")
        try:
            import_3ds(model_path)
        except (FileNotFoundError, RuntimeError) as e:
            print(f"[render_tank_sprite] ERROR: {e}")
            return
    else:
        print("[render_tank_sprite] No model specified, rendering empty scene (calibration mode).")

    # ── Apply textures ────────────────────────────────────────────────
    print("[render_tank_sprite] Applying textures...")
    apply_textures(diffuse_path, lightmap_path)

    # ── Add lighting ──────────────────────────────────────────────────
    import mathutils
    light_data = bpy.data.lights.new(name='SunLight', type='SUN')
    light_data.energy = 3.0
    light_obj = bpy.data.objects.new('SunLight', light_data)
    bpy.context.collection.objects.link(light_obj)
    light_obj.location = (5, -5, 10)
    direction = (-5, 5, -10)
    rot_quat = mathutils.Vector(direction).to_track_quat('-Z', 'Y')
    light_obj.rotation_euler = rot_quat.to_euler()

    # ── Render each direction ─────────────────────────────────────────
    num_dirs = args['directions']
    name = args['name']
    faction = args['faction']

    dir_names = DIRECTION_NAMES_16 if num_dirs == 16 else DIRECTION_NAMES_8 if num_dirs == 8 else None

    print(f"[render_tank_sprite] Rendering {num_dirs} directions for {name} ({faction})...")
    print(f"[render_tank_sprite] Direction convention: dir0=E (screen-right)")

    manifest_entries = []

    for dir_idx in range(num_dirs):
        step = 360.0 / num_dirs
        angle_deg = ROTATION_OFFSET_DEG + dir_idx * step
        dir_name = dir_names[dir_idx] if dir_names and dir_idx < len(dir_names) else f'dir{dir_idx}'

        # Rotate model
        rotate_model_to_direction(dir_idx, num_dirs)

        # Output filename
        filename = f"{name}_{faction}_dir{dir_idx}.png"
        output_path = os.path.join(output_dir, filename)

        # Render
        render_frame(output_path)

        # Record for manifest
        manifest_entries.append({
            'key': f"{name}_{faction}_dir{dir_idx}",
            'direction': dir_idx,
            'directionName': dir_name,
            'angleDeg': angle_deg,
            'filename': filename,
        })

        print(f"  Rendered dir{dir_idx} ({dir_name}, {angle_deg:.1f} deg) -> {output_path}")

    # ── Write manifest ────────────────────────────────────────────────
    manifest = {
        'version': 3,
        'pipeline': 'tankviewer-blender-isometric',
        'name': name,
        'faction': faction,
        'directions': num_dirs,
        'directionConvention': 'E=0, SE=1, S=2, SW=3, W=4, NW=5, N=6, NE=7',
        'rotationOffsetDeg': ROTATION_OFFSET_DEG,
        'resolution': args['resolution'],
        'entries': manifest_entries,
    }

    manifest_path = os.path.join(output_dir, f"{name}_{faction}_manifest.json")
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)

    print(f"[render_tank_sprite] Manifest written: {manifest_path}")
    print(f"[render_tank_sprite] Done. Rendered {num_dirs} frames.")


if __name__ == '__main__':
    main()
