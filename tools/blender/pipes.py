"""Builds a wall pipe cluster (pipes + flanges + valve wheel + pressure gauge), GLB.

    blender --background --factory-startup --python tools/blender/pipes.py -- public/models/boilerbound/pipes.glb

Wall-mounted relief: laid out in Blender's X (horizontal) / Z (vertical) plane
with depth toward -Y, so after the y-up export it stands flat on a vertical wall
with the valve + gauge facing the camera.
"""

import os
import sys
import math

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import _common as C  # noqa: E402

import bpy  # noqa: E402


def place(obj, location=None, rot=None):
    if location is not None:
        obj.location = location
    if rot is not None:
        obj.rotation_euler = rot
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def pipe_z(z0, z1, x, r=0.11):
    """A vertical pipe segment along Blender Z."""
    p = C.cylinder(r, z1 - z0, verts=20, location=(x, 0, (z0 + z1) / 2), name="pipe")
    return p


def pipe_x(x0, x1, z, r=0.11):
    p = C.cylinder(r, x1 - x0, verts=20, name="pipe")
    place(p, location=((x0 + x1) / 2, 0, z), rot=(0, math.radians(90), 0))
    return p


def flange(x, z, r=0.17):
    f = C.cylinder(r, 0.06, verts=20, name="flange")
    place(f, location=(x, -0.02, z), rot=(math.radians(90), 0, 0))
    C.add_bevel(f, 0.015, 1)
    C.apply_modifiers(f)
    return f


def main():
    C.reset_scene()
    brass = C.pbr_material("Brass", (0.60, 0.42, 0.15), metallic=1.0, roughness=0.32)
    iron = C.pbr_material("Iron", (0.11, 0.10, 0.09), metallic=0.9, roughness=0.5)
    dial = C.pbr_material("Dial", (0.85, 0.68, 0.42), metallic=0.1, roughness=0.45,
                          emission=(1.0, 0.66, 0.22), emission_strength=0.7)

    brass_parts = []
    iron_parts = []

    # Main plumbing: an L of pipe with a joint sphere and flanges.
    brass_parts.append(pipe_z(0.2, 1.55, 0.0))
    joint = C.sphere(0.15, 2, location=(0.0, 0, 1.5), name="joint")
    brass_parts.append(joint)
    brass_parts.append(pipe_x(0.0, 0.78, 1.5))
    for (fx, fz) in ((0.0, 0.45), (0.0, 1.2), (0.6, 1.5)):
        brass_parts.append(flange(fx, fz))

    # Valve wheel facing the camera (-Y), mounted on a short stub.
    stub = C.cylinder(0.06, 0.16, verts=14, name="stub")
    place(stub, location=(0.0, -0.14, 0.85), rot=(math.radians(90), 0, 0))
    brass_parts.append(stub)
    rim = C.torus(0.24, 0.035, 28, 10, location=(0.0, -0.22, 0.85), name="rim")
    place(rim, rot=(math.radians(90), 0, 0))
    iron_parts.append(rim)
    hubv = C.cylinder(0.06, 0.08, verts=14, name="hubv")
    place(hubv, location=(0.0, -0.22, 0.85), rot=(math.radians(90), 0, 0))
    iron_parts.append(hubv)
    for k in range(3):
        a = k * (math.tau / 3)
        spoke = C.box(0.24 * 2, 0.03, 0.05, name="spoke")
        place(spoke, location=(0.0, -0.22, 0.85), rot=(0, a, 0))
        # rotate spoke into the wheel plane (facing -Y): spin around Y then tilt
        iron_parts.append(spoke)

    # Pressure gauge facing the camera near the top elbow.
    case = C.cylinder(0.19, 0.1, verts=28, name="case")
    place(case, location=(0.62, -0.1, 1.5), rot=(math.radians(90), 0, 0))
    C.add_bevel(case, 0.02, 1)
    C.apply_modifiers(case)
    iron_parts.append(case)
    face = C.cylinder(0.15, 0.03, verts=28, name="face")
    place(face, location=(0.62, -0.16, 1.5), rot=(math.radians(90), 0, 0))
    C.set_material(face, dial)
    needle = C.box(0.02, 0.02, 0.13, location=(0.62, -0.18, 1.53), name="needle")
    place(needle, location=None, rot=(0, math.radians(35), 0))
    C.set_material(needle, iron)

    for o in brass_parts:
        C.set_material(o, brass)
    for o in iron_parts:
        C.set_material(o, iron)

    everything = brass_parts + iron_parts + [face, needle]
    for o in everything:
        C.shade_smooth(o, 34)
    cluster = C.join(everything, "Pipes")

    path = C.out_path(os.path.join("public", "models", "boilerbound", "pipes.glb"))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    C.export_glb(path, [cluster])


main()
