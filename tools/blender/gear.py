"""Builds a detailed bronze cog and exports it as GLB.

    blender --background --factory-startup --python tools/blender/gear.py -- public/models/boilerbound/gear.glb
"""

import os
import sys
import math
import bmesh
from mathutils import Vector

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import _common as C  # noqa: E402

import bpy  # noqa: E402


def build_gear(teeth=18, r_root=0.86, r_tip=1.0, thickness=0.26, bore=0.30):
    bm = bmesh.new()
    step = (2 * math.pi) / teeth
    # Trapezoidal teeth: narrower at the tip, plus a root point mid-gap so the
    # valley between teeth stays circular.
    gap_half = step * 0.30
    tip_half = step * 0.16
    ring = []
    for i in range(teeth):
        a = i * step
        for ang, rad in (
            (a - gap_half, r_root),
            (a - tip_half, r_tip),
            (a + tip_half, r_tip),
            (a + gap_half, r_root),
            (a + step * 0.5, r_root),
        ):
            ring.append(bm.verts.new((math.cos(ang) * rad, math.sin(ang) * rad, 0.0)))
    bm.faces.new(ring)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # Extrude to thickness.
    ret = bmesh.ops.extrude_face_region(bm, geom=bm.faces[:])
    verts = [e for e in ret["geom"] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=Vector((0, 0, thickness)), verts=verts)
    obj = C.obj_from_bmesh(bm, "Gear")
    obj.location = (0, 0, -thickness / 2)
    C.apply_modifiers(obj)  # bake the location? no-op, keep simple

    # Central bore.
    cutter = C.cylinder(bore, thickness * 3, verts=32, location=(0, 0, 0), name="bore")
    C.boolean_cut(obj, cutter)

    # Raised hub around the bore for a mechanical read.
    hub = C.cylinder(bore + 0.14, thickness + 0.12, verts=32, location=(0, 0, 0), name="hub")
    hub_bore = C.cylinder(bore, thickness * 4, verts=32, location=(0, 0, 0), name="hubbore")
    C.boolean_cut(hub, hub_bore)

    obj = C.join([obj, hub], "Gear")
    C.add_bevel(obj, width=0.02, segments=2)
    C.apply_modifiers(obj)
    C.shade_smooth(obj, angle_deg=32)

    mat = C.pbr_material("Bronze", color=(0.55, 0.36, 0.12), metallic=1.0, roughness=0.34)
    C.set_material(obj, mat)
    # Stand the disc up to face -Y (the camera after the y-up export), so it can
    # be spun in view with a single rotation.z in Three.js.
    C.orient(obj, rx=math.radians(90))
    return obj


def main():
    C.reset_scene()
    gear = build_gear()
    path = C.out_path(os.path.join("public", "models", "boilerbound", "gear.glb"))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    C.export_glb(path, [gear])


main()
