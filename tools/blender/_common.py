"""
Shared helpers for the Boilerbound Blender asset scripts (headless).

Run a model script with:
    blender --background --factory-startup --python tools/blender/<name>.py -- <out.glb>

These build geometry procedurally with bmesh + modifiers and export a binary
glTF (.glb) with baked PBR (Principled BSDF -> metallic/roughness). Procedural
node textures do NOT survive glTF export, so materials use solid PBR values;
surface richness comes from geometry (bevels, teeth, rivets) plus the Three.js
environment map that makes the metal reflect.
"""

import bmesh
import bpy
import math
import sys
from mathutils import Vector


def out_path(default: str) -> str:
    """The .glb path passed after `--`, or a default."""
    argv = sys.argv
    if "--" in argv:
        extra = argv[argv.index("--") + 1:]
        if extra:
            return extra[0]
    return default


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def pbr_material(name: str, color, metallic: float, roughness: float, emission=None, emission_strength: float = 2.0):
    """A Principled BSDF material with values that export cleanly to glTF."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    r, g, b = color
    bsdf.inputs["Base Color"].default_value = (r, g, b, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission is not None:
        er, eg, eb = emission
        bsdf.inputs["Emission Color"].default_value = (er, eg, eb, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat


def set_material(obj, mat) -> None:
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def apply_modifiers(obj) -> None:
    bpy.context.view_layer.objects.active = obj
    for m in list(obj.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=m.name)
        except RuntimeError:
            obj.modifiers.remove(m)


def add_bevel(obj, width: float, segments: int = 2, angle_deg: float = 45.0) -> None:
    mod = obj.modifiers.new("Bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"
    mod.angle_limit = math.radians(angle_deg)
    mod.harden_normals = True


def add_subsurf(obj, levels: int = 1) -> None:
    mod = obj.modifiers.new("Subsurf", "SUBSURF")
    mod.levels = levels
    mod.render_levels = levels


def shade_smooth(obj, angle_deg: float = 34.0) -> None:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.shade_smooth()
    # Blender 4.1+/5.x: auto-smooth is an operator (adds a weighted-normal-ish modifier).
    try:
        bpy.ops.object.shade_auto_smooth(angle=math.radians(angle_deg))
    except Exception:
        pass


def obj_from_bmesh(bm, name: str):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def boolean_cut(obj, cutter) -> None:
    mod = obj.modifiers.new("Bore", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.object = cutter
    mod.solver = "EXACT"
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)


def join(objs, name: str):
    """Joins objs into the first, renames, returns it."""
    for o in bpy.context.selected_objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    result = bpy.context.view_layer.objects.active
    result.name = name
    return result


def export_glb(path: str, objects) -> None:
    for o in bpy.context.selected_objects:
        o.select_set(False)
    for o in objects:
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
    )
    print("EXPORTED", path)


def cone(r1: float, r2: float, depth: float, verts: int = 48, location=(0, 0, 0), name="cone"):
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm, cap_ends=True, cap_tris=False, segments=verts,
        radius1=r1, radius2=r2, depth=depth,
    )
    obj = obj_from_bmesh(bm, name)
    obj.location = Vector(location)
    return obj


def cylinder(radius: float, depth: float, verts: int = 48, location=(0, 0, 0), name="cyl"):
    return cone(radius, radius, depth, verts, location, name)


def box(sx: float, sy: float, sz: float, location=(0, 0, 0), name="box"):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    obj = obj_from_bmesh(bm, name)
    obj.location = Vector(location)
    return obj


def sphere(radius: float, subdiv: int = 3, location=(0, 0, 0), name="sph"):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius)
    obj = obj_from_bmesh(bm, name)
    obj.location = Vector(location)
    return obj


def uvsphere(radius: float, segs: int = 24, rings: int = 16, location=(0, 0, 0), name="sph"):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=radius)
    obj = obj_from_bmesh(bm, name)
    obj.location = Vector(location)
    return obj


def torus(major: float, minor: float, major_seg: int = 32, minor_seg: int = 12, location=(0, 0, 0), name="torus"):
    bm = bmesh.new()
    mat = __import__("mathutils").Matrix.Translation((0, 0, 0))
    bmesh.ops.create_circle(bm, cap_ends=False, segments=major_seg, radius=major)
    # Simpler: build via a proper torus operator through bpy for reliable topology.
    bm.free()
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major, minor_radius=minor,
        major_segments=major_seg, minor_segments=minor_seg,
        location=location,
    )
    obj = bpy.context.view_layer.objects.active
    obj.name = name
    return obj


def orient(obj, rx: float = 0.0, ry: float = 0.0, rz: float = 0.0) -> None:
    """Sets an euler rotation (radians) and bakes it into the mesh."""
    obj.rotation_euler = (rx, ry, rz)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)


def scale_obj(obj, sx: float, sy: float, sz: float) -> None:
    obj.scale = (sx, sy, sz)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
