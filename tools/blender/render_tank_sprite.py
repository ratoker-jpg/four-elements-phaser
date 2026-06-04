"""
Blender entrypoint for rendering TankViewer hull/turret assets to sprite PNGs.

This script is safe to run outside Blender for argument validation and
environment checks. The actual render path only runs when bpy is available.
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

from factory_common import (  # noqa: E402
    DIRECTION_CONVENTION_TEXT,
    GENERATED_ROOT,
    SOURCE_ROOT,
    asset_id,
    build_asset_spec,
    direction_angle,
    direction_names,
    dump_json,
    frame_filename,
    kind_to_source_dir,
)

ROTATION_OFFSET_DEG = 225.0
CAMERA_AZIMUTH_DEG = 45.0
CAMERA_ELEVATION_DEG = 35.264


def parse_args() -> dict:
    argv = sys.argv
    try:
        separator = argv.index("--")
        args = argv[separator + 1 :]
    except ValueError:
        args = argv[1:]

    parsed = {
        "kind": "hull",
        "source_root": str(SOURCE_ROOT),
        "source_name": "wasp",
        "source_dir": None,
        "model": None,
        "diffuse": None,
        "lightmap": None,
        "output": None,
        "directions": 16,
        "direction_index": None,
        "faction": "cyan",
        "m_level": 0,
        "name": None,
        "resolution": 256,
        "orthographic_scale": 4.0,
        "fit_target_size": 3.0,
        "rotation_offset_deg": ROTATION_OFFSET_DEG,
        "lightmap_strength": 0.55,
        "sun_energy": 2.5,
        "ambient_strength": 0.35,
        "render_log": None,
        "write_manifest": True,
    }

    i = 0
    while i < len(args):
        arg = args[i]
        if arg in {"--kind", "--source-root", "--source-name", "--source-dir", "--model", "--diffuse", "--lightmap", "--output", "--faction", "--name", "--render-log"} and i + 1 < len(args):
            key = arg[2:].replace("-", "_")
            parsed[key] = args[i + 1]
            i += 2
        elif arg in {"--directions", "--m-level", "--resolution", "--direction-index"} and i + 1 < len(args):
            key = arg[2:].replace("-", "_")
            parsed[key] = int(args[i + 1])
            i += 2
        elif arg in {"--orthographic-scale", "--fit-target-size", "--rotation-offset-deg", "--lightmap-strength", "--sun-energy", "--ambient-strength"} and i + 1 < len(args):
            key = arg[2:].replace("-", "_")
            parsed[key] = float(args[i + 1])
            i += 2
        elif arg == "--no-manifest":
            parsed["write_manifest"] = False
            i += 1
        else:
            i += 1

    return parsed


def resolve_request(args: dict) -> dict:
    if args["source_dir"]:
        source_dir = Path(args["source_dir"])
        source_root = source_dir.parents[2] if len(source_dir.parents) >= 3 else Path(args["source_root"])
        output_dir = Path(args["output"]) if args["output"] else GENERATED_ROOT / kind_to_source_dir(args["kind"]) / args["source_name"] / f"m{args['m_level']}" / args["faction"]
        model_path = source_dir / args["model"] if args["model"] else None
        diffuse_path = source_dir / args["diffuse"] if args["diffuse"] else None
        lightmap_path = source_dir / args["lightmap"] if args["lightmap"] else None
        name = args["name"] or asset_id(args["kind"], args["source_name"], args["m_level"])
        render_log = Path(args["render_log"]) if args["render_log"] else output_dir / "render_log.json"
        manifest_path = output_dir / "manifest.json"
        return {
            **args,
            "source_root_path": source_root,
            "source_dir_path": source_dir,
            "output_dir_path": output_dir,
            "model_path": model_path,
            "diffuse_path": diffuse_path,
            "lightmap_path": lightmap_path,
            "name": name,
            "render_log_path": render_log,
            "manifest_path": manifest_path,
        }

    spec = build_asset_spec(
        Path(args["source_root"]),
        GENERATED_ROOT,
        args["kind"],
        args["source_name"],
        args["m_level"],
        args["faction"],
        args["directions"],
    )
    output_dir = Path(args["output"]) if args["output"] else Path(spec.output_dir)
    render_log = Path(args["render_log"]) if args["render_log"] else output_dir / "render_log.json"
    return {
        **args,
        "source_root_path": Path(args["source_root"]),
        "source_dir_path": Path(spec.source_dir),
        "output_dir_path": output_dir,
        "model_path": Path(args["model"]) if args["model"] and Path(args["model"]).is_absolute() else Path(spec.model_file) if spec.model_file else None,
        "diffuse_path": (Path(args["diffuse"]) if args["diffuse"] and Path(args["diffuse"]).is_absolute() else Path(spec.source_dir) / (args["diffuse"] or spec.details_file)),
        "lightmap_path": (Path(args["lightmap"]) if args["lightmap"] and Path(args["lightmap"]).is_absolute() else Path(spec.source_dir) / (args["lightmap"] or spec.lightmap_file)),
        "name": args["name"] or asset_id(args["kind"], args["source_name"], args["m_level"]),
        "render_log_path": render_log,
        "manifest_path": output_dir / "manifest.json",
    }


def validate_request(request: dict) -> tuple[bool, list[str]]:
    errors: list[str] = []
    if request["kind"] not in {"hull", "turret"}:
        errors.append(f"Unsupported kind: {request['kind']}")
    if request["directions"] not in {8, 16}:
        errors.append("Only 8 or 16 directions are supported.")
    if request["direction_index"] is not None and not (0 <= request["direction_index"] < request["directions"]):
        errors.append("direction-index is out of range for the selected directions.")
    if request["model_path"] is None or not Path(request["model_path"]).exists():
        errors.append(f"Model file not found: {request['model_path']}")
    if not Path(request["diffuse_path"]).exists():
        errors.append(f"Details texture not found: {request['diffuse_path']}")
    if not Path(request["lightmap_path"]).exists():
        errors.append(f"Lightmap texture not found: {request['lightmap_path']}")
    return (len(errors) == 0, errors)


def environment_report(request: dict, errors: list[str], blender_available: bool) -> dict:
    return {
        "task": "CODEX-UNIT-ASSET-FACTORY-01",
        "blenderAvailable": blender_available,
        "request": {
            "kind": request["kind"],
            "sourceName": request["source_name"],
            "mLevel": request["m_level"],
            "faction": request["faction"],
            "directions": request["directions"],
            "directionIndex": request["direction_index"],
            "outputDir": str(request["output_dir_path"]),
            "modelPath": str(request["model_path"]) if request["model_path"] else None,
            "diffusePath": str(request["diffuse_path"]),
            "lightmapPath": str(request["lightmap_path"]),
        },
        "errors": errors,
        "directionConvention": DIRECTION_CONVENTION_TEXT,
    }


def resolve_3ds_import_operator(bpy):
    try:
        bpy.ops.preferences.addon_enable(module="io_scene_3ds")
    except Exception:
        pass

    if hasattr(bpy.ops.import_scene, "autodesk_3ds"):
        return bpy.ops.import_scene.autodesk_3ds
    legacy = getattr(bpy.ops.import_scene, "3ds", None)
    if legacy is not None:
        return legacy
    return None


def clear_scene(bpy) -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=True)
    for datablock_collection in (
        bpy.data.meshes,
        bpy.data.materials,
        bpy.data.images,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for datablock in list(datablock_collection):
            if datablock.users == 0:
                datablock_collection.remove(datablock)


def setup_render_scene(bpy, request: dict):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    scene.render.resolution_x = request["resolution"]
    scene.render.resolution_y = request["resolution"]
    scene.render.resolution_percentage = 100
    scene.view_settings.exposure = 0.35
    scene.render.filepath = str(request["output_dir_path"])
    return scene


def setup_camera_and_lights(bpy, mathutils, request: dict):
    cam_data = bpy.data.cameras.new("TankFactoryCamera")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = request["orthographic_scale"]
    cam_obj = bpy.data.objects.new("TankFactoryCamera", cam_data)
    bpy.context.collection.objects.link(cam_obj)

    azimuth_rad = math.radians(CAMERA_AZIMUTH_DEG)
    elevation_rad = math.radians(CAMERA_ELEVATION_DEG)
    distance = 10.0

    cam_x = distance * math.cos(elevation_rad) * math.cos(azimuth_rad)
    cam_y = distance * math.cos(elevation_rad) * math.sin(azimuth_rad)
    cam_z = distance * math.sin(elevation_rad)
    cam_obj.location = (cam_x, cam_y, cam_z)
    direction = (-cam_x, -cam_y, -cam_z)
    cam_obj.rotation_euler = mathutils.Vector(direction).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam_obj

    sun_data = bpy.data.lights.new(name="TankFactorySun", type="SUN")
    sun_data.energy = request["sun_energy"]
    sun_obj = bpy.data.objects.new("TankFactorySun", sun_data)
    bpy.context.collection.objects.link(sun_obj)
    sun_obj.location = (5, -5, 10)
    sun_obj.rotation_euler = mathutils.Vector((-5, 5, -10)).to_track_quat("-Z", "Y").to_euler()

    fill_data = bpy.data.lights.new(name="TankFactoryFill", type="AREA")
    fill_data.energy = max(1.0, request["sun_energy"] * 250.0 * request["ambient_strength"])
    fill_data.shape = "DISK"
    fill_obj = bpy.data.objects.new("TankFactoryFill", fill_data)
    bpy.context.collection.objects.link(fill_obj)
    fill_obj.location = (-4, 3, 6)
    fill_obj.rotation_euler = (math.radians(65), 0.0, math.radians(-35))


def import_model(bpy, request: dict):
    op = resolve_3ds_import_operator(bpy)
    if op is None:
        raise RuntimeError("Blender 3DS importer addon is not available.")

    before = {obj.name for obj in bpy.data.objects}
    op(filepath=str(request["model_path"]))
    imported = [obj for obj in bpy.data.objects if obj.name not in before and obj.type in {"MESH", "EMPTY"}]
    if not imported:
        raise RuntimeError("3DS import completed but no objects were created.")
    return imported


def attach_imports_to_root(bpy, imported_objects):
    root = bpy.data.objects.new("TankFactoryRoot", None)
    bpy.context.collection.objects.link(root)
    for obj in imported_objects:
        if obj.parent is None:
            obj.parent = root
    return root


def visible_meshes(root):
    result = []
    for child in root.children_recursive:
        if child.type == "MESH":
            result.append(child)
    return result


def world_bbox(bpy, mathutils, meshes):
    min_corner = mathutils.Vector((10**9, 10**9, 10**9))
    max_corner = mathutils.Vector((-10**9, -10**9, -10**9))
    for obj in meshes:
        for corner in obj.bound_box:
            world = obj.matrix_world @ mathutils.Vector(corner)
            min_corner.x = min(min_corner.x, world.x)
            min_corner.y = min(min_corner.y, world.y)
            min_corner.z = min(min_corner.z, world.z)
            max_corner.x = max(max_corner.x, world.x)
            max_corner.y = max(max_corner.y, world.y)
            max_corner.z = max(max_corner.z, world.z)
    size = max_corner - min_corner
    center = (min_corner + max_corner) * 0.5
    return min_corner, max_corner, size, center


def normalize_root(bpy, mathutils, root, fit_target_size):
    meshes = visible_meshes(root)
    bbox_min, bbox_max, size, center = world_bbox(bpy, mathutils, meshes)
    root.location = (-center.x, -center.y, -bbox_min.z)
    bpy.context.view_layer.update()
    _, _, size_after_move, _ = world_bbox(bpy, mathutils, meshes)
    max_dimension = max(size_after_move.x, size_after_move.y, size_after_move.z, 1.0)
    scale = fit_target_size / max_dimension
    root.scale = (scale, scale, scale)
    bpy.context.view_layer.update()
    final_min, final_max, final_size, final_center = world_bbox(bpy, mathutils, meshes)
    return {
        "originalBBoxMin": [round(v, 4) for v in bbox_min],
        "originalBBoxMax": [round(v, 4) for v in bbox_max],
        "originalSize": [round(v, 4) for v in size],
        "normalizeScale": round(scale, 8),
        "finalBBoxMin": [round(v, 4) for v in final_min],
        "finalBBoxMax": [round(v, 4) for v in final_max],
        "finalSize": [round(v, 4) for v in final_size],
        "finalCenter": [round(v, 4) for v in final_center],
    }


def build_readable_material(bpy, material, diffuse_path: Path, lightmap_path: Path, lightmap_strength: float):
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (620, 0)
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (340, 0)
    bsdf.inputs["Roughness"].default_value = 0.9
    bsdf.inputs["Specular IOR Level"].default_value = 0.2

    tex_coord = nodes.new("ShaderNodeTexCoord")
    tex_coord.location = (-740, -60)
    mapping = nodes.new("ShaderNodeMapping")
    mapping.location = (-540, -60)

    diffuse_tex = nodes.new("ShaderNodeTexImage")
    diffuse_tex.location = (-330, 90)
    diffuse_tex.image = bpy.data.images.load(str(diffuse_path), check_existing=True)
    diffuse_tex.image.colorspace_settings.name = "sRGB"

    lightmap_tex = nodes.new("ShaderNodeTexImage")
    lightmap_tex.location = (-330, -120)
    lightmap_tex.image = bpy.data.images.load(str(lightmap_path), check_existing=True)
    lightmap_tex.image.colorspace_settings.name = "Non-Color"

    multiply = nodes.new("ShaderNodeMixRGB")
    multiply.location = (-70, 0)
    multiply.blend_type = "MULTIPLY"
    multiply.inputs["Fac"].default_value = 1.0

    preserve = nodes.new("ShaderNodeMixRGB")
    preserve.location = (130, 0)
    preserve.blend_type = "MIX"
    preserve.inputs["Fac"].default_value = lightmap_strength

    links.new(tex_coord.outputs["UV"], mapping.inputs["Vector"])
    links.new(mapping.outputs["Vector"], diffuse_tex.inputs["Vector"])
    links.new(mapping.outputs["Vector"], lightmap_tex.inputs["Vector"])
    links.new(diffuse_tex.outputs["Color"], multiply.inputs["Color1"])
    links.new(lightmap_tex.outputs["Color"], multiply.inputs["Color2"])
    links.new(diffuse_tex.outputs["Color"], preserve.inputs["Color1"])
    links.new(multiply.outputs["Color"], preserve.inputs["Color2"])
    links.new(preserve.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])


def apply_textures(bpy, root, request: dict) -> int:
    mesh_count = 0
    for mesh in visible_meshes(root):
        mesh_count += 1
        if not mesh.data.materials:
            mesh.data.materials.append(bpy.data.materials.new(name=f"{mesh.name}_Material"))
        for material in mesh.data.materials:
            build_readable_material(
                bpy,
                material,
                Path(request["diffuse_path"]),
                Path(request["lightmap_path"]),
                request["lightmap_strength"],
            )
    return mesh_count


def render_directions(bpy, root, request: dict) -> tuple[list[dict], list[str]]:
    request["output_dir_path"].mkdir(parents=True, exist_ok=True)
    dirs = [request["direction_index"]] if request["direction_index"] is not None else list(range(request["directions"]))
    names = direction_names(request["directions"])
    rendered_files = []
    created_paths = []

    for direction in dirs:
        angle = request["rotation_offset_deg"] + direction * (360.0 / request["directions"])
        root.rotation_euler = (0.0, 0.0, math.radians(angle))
        bpy.context.view_layer.update()
        filename = frame_filename(request["kind"], request["source_name"], request["m_level"], request["faction"], direction)
        output_path = request["output_dir_path"] / filename
        bpy.context.scene.render.filepath = str(output_path)
        bpy.ops.render.render(write_still=True)
        created_paths.append(str(output_path))
        rendered_files.append(
            {
                "direction": direction,
                "directionName": names[direction],
                "angleDeg": direction_angle(direction, request["directions"]),
                "filename": filename,
                "path": str(output_path),
            }
        )
    return rendered_files, created_paths


def write_manifest(request: dict, rendered_files: list[dict]) -> None:
    manifest = {
        "id": request["name"],
        "kind": request["kind"],
        "sourceName": request["source_name"],
        "runtimeName": request["name"],
        "mLevel": request["m_level"],
        "faction": request["faction"],
        "directions": request["directions"],
        "directionConvention": DIRECTION_CONVENTION_TEXT,
        "frameDimensions": {"width": request["resolution"], "height": request["resolution"]},
        "source": {
            "model": str(Path(request["model_path"]).name),
            "details": str(Path(request["diffuse_path"]).name),
            "lightmap": str(Path(request["lightmap_path"]).name),
        },
        "frames": rendered_files,
        "anchor": {"mode": "preliminary", "description": "bottom-center ground contact"},
        "socket": {"mode": "preliminary", "description": "derive from hull/turret audit"},
        "barrel": {"mode": "preliminary", "description": "turret-only; set after asset audit"},
    }
    dump_json(request["manifest_path"], manifest)


def run_inside_blender(request: dict) -> dict:
    import bpy  # type: ignore
    import mathutils  # type: ignore

    clear_scene(bpy)
    setup_render_scene(bpy, request)
    setup_camera_and_lights(bpy, mathutils, request)
    imported_objects = import_model(bpy, request)
    root = attach_imports_to_root(bpy, imported_objects)
    mesh_count = apply_textures(bpy, root, request)
    bbox_report = normalize_root(bpy, mathutils, root, request["fit_target_size"])
    rendered_files, created_paths = render_directions(bpy, root, request)
    if request["write_manifest"]:
        write_manifest(request, rendered_files)

    report = {
        "task": "CODEX-UNIT-ASSET-FACTORY-01",
        "blenderAvailable": True,
        "blenderVersion": list(bpy.app.version),
        "meshCount": mesh_count,
        "directionConvention": DIRECTION_CONVENTION_TEXT,
        "request": {
            "kind": request["kind"],
            "sourceName": request["source_name"],
            "mLevel": request["m_level"],
            "faction": request["faction"],
            "directions": request["directions"],
            "directionIndex": request["direction_index"],
            "resolution": request["resolution"],
            "orthographicScale": request["orthographic_scale"],
            "fitTargetSize": request["fit_target_size"],
            "lightmapStrength": request["lightmap_strength"],
        },
        "bbox": bbox_report,
        "outputFiles": created_paths,
        "manifestPath": str(request["manifest_path"]) if request["write_manifest"] else None,
        "source": {
            "model": str(request["model_path"]),
            "details": str(request["diffuse_path"]),
            "lightmap": str(request["lightmap_path"]),
        },
    }
    dump_json(request["render_log_path"], report)
    return report


def main() -> None:
    args = parse_args()
    request = resolve_request(args)
    ok, errors = validate_request(request)

    try:
        import bpy  # noqa: F401
        blender_available = True
    except ImportError:
        blender_available = False

    if not blender_available or not ok:
        report = environment_report(request, errors, blender_available)
        request["render_log_path"].parent.mkdir(parents=True, exist_ok=True)
        dump_json(request["render_log_path"], report)
        print(json.dumps(report, indent=2))
        if not blender_available:
            print("Blender is not available. Install Blender 3.x+ and enable the 3DS importer addon.")
        return

    report = run_inside_blender(request)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
