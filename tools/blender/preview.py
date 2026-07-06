"""Loads a .glb and renders a lit preview PNG (headless), to eyeball model quality.

    blender --background --factory-startup --python tools/blender/preview.py -- <in.glb> <out.png>
"""

import bpy
import sys
import math
from mathutils import Vector


def args():
    argv = sys.argv
    extra = argv[argv.index("--") + 1:] if "--" in argv else []
    glb = extra[0] if len(extra) > 0 else "public/models/boilerbound/gear.glb"
    png = extra[1] if len(extra) > 1 else "preview.png"
    return glb, png


def set_engine():
    scn = bpy.context.scene
    for name in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
        try:
            scn.render.engine = name
            return
        except TypeError:
            continue


def frame_all(cam):
    objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not objs:
        return
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for o in objs:
        for corner in o.bound_box:
            w = o.matrix_world @ Vector(corner)
            lo = Vector((min(lo[i], w[i]) for i in range(3)))
            hi = Vector((max(hi[i], w[i]) for i in range(3)))
    center = (lo + hi) / 2
    radius = max((hi - lo).length / 2, 0.4)
    direction = Vector((0.8, -1.0, 0.6)).normalized()
    cam.location = center + direction * radius * 3.1
    # Point the camera at the center.
    look = center - cam.location
    cam.rotation_euler = look.to_track_quat("-Z", "Y").to_euler()


def main():
    glb, png = args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=glb)

    set_engine()
    scn = bpy.context.scene
    scn.render.resolution_x = 900
    scn.render.resolution_y = 900
    scn.render.film_transparent = False
    try:
        scn.eevee.use_raytracing = True
    except Exception:
        pass

    # Warm studio world.
    world = bpy.data.worlds.new("W")
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs[0].default_value = (0.05, 0.03, 0.02, 1.0)
    bg.inputs[1].default_value = 0.4
    scn.world = world

    # Key + rim lights (warm gas-lamp mood).
    key = bpy.data.lights.new("key", "AREA")
    key.energy = 900
    key.size = 4
    key.color = (1.0, 0.82, 0.55)
    ko = bpy.data.objects.new("key", key)
    ko.location = (4, -5, 6)
    ko.rotation_euler = (math.radians(50), 0, math.radians(35))
    scn.collection.objects.link(ko)

    rim = bpy.data.lights.new("rim", "AREA")
    rim.energy = 500
    rim.size = 3
    rim.color = (1.0, 0.4, 0.2)
    ro = bpy.data.objects.new("rim", rim)
    ro.location = (-5, 3, 3)
    ro.rotation_euler = (math.radians(70), 0, math.radians(210))
    scn.collection.objects.link(ro)

    cam_data = bpy.data.cameras.new("cam")
    cam = bpy.data.objects.new("cam", cam_data)
    scn.collection.objects.link(cam)
    scn.camera = cam
    frame_all(cam)

    is_jpg = png.lower().endswith((".jpg", ".jpeg"))
    scn.render.image_settings.file_format = "JPEG" if is_jpg else "PNG"
    if is_jpg:
        scn.render.image_settings.quality = 88
    scn.render.filepath = png
    bpy.ops.render.render(write_still=True)
    print("RENDERED", png)


main()
