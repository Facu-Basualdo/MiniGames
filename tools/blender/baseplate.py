"""Renders a clean, well-lit COMPOSITION guide (base-plate) for img2img.

    blender --background --factory-startup --python tools/blender/baseplate.py -- docs/boilerbound-baseplate.png

Not a final asset: it gives an image generator (Krea, img2img) a clear layout to
paint over — arches, gears at several depths, pipes, lanterns, crystals and the
floor, in the game's 16:9 framing. Lit brighter/flatter than the in-game backdrop
on purpose (the generator needs to read the structure; the final darkness is
applied in-engine). Same convention as backdrop.py: X horizontal, Y up, depth -Z.
"""

import os
import sys
import math
import random

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import _common as C  # noqa: E402

import bpy  # noqa: E402

random.seed(11)
CY = 4.5


def out_path():
    argv = sys.argv
    if "--" in argv and argv[argv.index("--") + 1:]:
        return argv[argv.index("--") + 1]
    return os.path.join("docs", "boilerbound-baseplate.png")


def mat(name, color, rough=0.6, metallic=0.8, emis=None, emis_s=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metallic
    if emis:
        b.inputs["Emission Color"].default_value = (*emis, 1.0)
        b.inputs["Emission Strength"].default_value = emis_s
    return m


def cog(x, y, z, r, teeth, m):
    disc = C.cylinder(r, 0.4, verts=32, location=(x, y, z), name="d")
    C.set_material(disc, m)
    rim = C.torus(r * 0.96, r * 0.11, 28, 8, location=(x, y, z), name="rim")
    C.set_material(rim, m)
    for i in range(teeth):
        a = (i / teeth) * math.tau
        t = C.box(r * 0.24, r * 0.24, 0.42, location=(x + math.cos(a) * r, y + math.sin(a) * r, z), name="t")
        C.set_material(t, m)
    hub = C.cylinder(r * 0.32, 0.55, verts=16, location=(x, y, z + 0.05), name="h")
    C.set_material(hub, m)


def pipe(x0, y0, x1, y1, z, r, m):
    dx, dy = x1 - x0, y1 - y0
    length = math.hypot(dx, dy)
    a = math.atan2(dy, dx)
    p = C.cylinder(r, length, verts=16, name="p")
    p.rotation_euler = (0, math.radians(90), a)
    p.location = ((x0 + x1) / 2, (y0 + y1) / 2, z)
    bpy.context.view_layer.objects.active = p
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=False)
    C.set_material(p, m)
    C.set_material(C.sphere(r * 1.5, 2, location=(x1, y1, z), name="j"), m)


def main():
    C.reset_scene()
    scn = bpy.context.scene

    wall = mat("wall", (0.10, 0.14, 0.14), rough=0.9, metallic=0.3)
    dark_bronze = mat("dbz", (0.18, 0.14, 0.06), rough=0.7, metallic=0.7)
    bronze = mat("bz", (0.42, 0.28, 0.10), rough=0.45, metallic=0.9)
    iron = mat("iron", (0.10, 0.11, 0.11), rough=0.6, metallic=0.75)
    crystal = mat("cry", (0.2, 0.7, 0.7), emis=(0.25, 0.85, 0.85), emis_s=2.2)
    lantern = mat("lan", (1.0, 0.6, 0.25), emis=(1.0, 0.6, 0.25), emis_s=3.0)

    # Back wall.
    C.set_material(C.box(30, 18, 0.6, location=(0, CY, -8.0), name="wall"), wall)

    # Ornate arch frame: side pillars + a top beam + banding.
    for sx in (-1, 1):
        pil = C.box(1.6, 11, 1.6, location=(sx * 9.6, CY, -1.2), name="pillar")
        C.add_bevel(pil, 0.15, 2)
        C.apply_modifiers(pil)
        C.set_material(pil, iron)
        for by in (1.5, 4.5, 7.5):
            band = C.box(2.0, 0.5, 2.0, location=(sx * 9.6, by, -1.2), name="band")
            C.add_bevel(band, 0.08, 1)
            C.apply_modifiers(band)
            C.set_material(band, bronze)
    top = C.box(21, 1.6, 1.6, location=(0, 9.6, -1.2), name="topbeam")
    C.add_bevel(top, 0.15, 2)
    C.apply_modifiers(top)
    C.set_material(top, iron)

    # Background gears (dim, far).
    for (x, y, z, r, teeth) in [(-6, 8, -6, 2.4, 20), (5.5, 8.5, -6.2, 2.9, 22),
                                (0.5, 3, -6, 3.2, 24), (9, 4, -6, 2.1, 16), (-9.5, 4.5, -6, 2.4, 20)]:
        cog(x, y, z, r, teeth, dark_bronze)

    # Foreground gears (bright, close) — the hero machinery.
    cog(-5.0, 6.5, -1.6, 2.2, 18, bronze)
    cog(4.8, 6.8, -1.6, 2.6, 22, bronze)
    cog(0.0, 7.8, -1.7, 1.5, 14, bronze)
    cog(7.2, 4.3, -1.6, 1.7, 14, bronze)
    cog(-8.0, 3.0, -1.6, 1.4, 12, bronze)

    # Pipe network.
    pipe(-11, 2.0, -4, 1.4, -1.4, 0.3, iron)
    pipe(-4, 1.4, 4, 2.6, -1.4, 0.3, iron)
    pipe(4, 2.6, 11, 1.8, -1.4, 0.3, iron)
    pipe(3.0, 7.5, 3.0, 10, -1.5, 0.26, iron)
    pipe(-6.5, 9, -6.5, 11, -1.5, 0.26, iron)

    # Hanging lanterns + point lights.
    for (lx, ly) in ((-8.5, 6.8), (-2.5, 5.5), (6.5, 6.2), (9.2, 3.5)):
        C.set_material(C.box(0.12, 0.8, 0.12, location=(lx, ly + 0.5, -1.3), name="br"), iron)
        C.set_material(C.uvsphere(0.3, 16, 12, location=(lx, ly, -1.3), name="lan"), lantern)
        li = bpy.data.lights.new("ll", "POINT")
        li.energy = 60
        li.color = (1.0, 0.6, 0.3)
        lo = bpy.data.objects.new("ll", li)
        lo.location = (lx, ly, -0.2)
        scn.collection.objects.link(lo)

    # Crystal clusters low corners.
    for (cx, sign) in ((-10.5, 1), (10.5, -1)):
        for k in range(5):
            cr = C.cone(0.24 + random.random() * 0.15, 0.02, 1.5 + random.random() * 1.2, verts=6,
                        location=(cx + sign * k * 0.5, 0.4 + k * 0.35, -1.0), name="cr")
            cr.rotation_euler = (random.uniform(-0.3, 0.3), random.uniform(-0.4, 0.4), 0)
            bpy.context.view_layer.objects.active = cr
            bpy.ops.object.transform_apply(rotation=True)
            C.set_material(cr, crystal)

    # Grated metal floor across the bottom (keep the play area readable).
    C.set_material(C.box(24, 1.2, 4, location=(0, -0.2, 0.0), name="floor"), iron)
    for i in range(9):
        gx = -8 + i * 2.0
        slat = C.box(1.7, 0.14, 1.3, location=(gx, 0.5, 0.6), name="slat")
        C.add_bevel(slat, 0.03, 1)
        C.apply_modifiers(slat)
        C.set_material(slat, dark_bronze)

    # --- Lighting: clearer/brighter than the in-game backdrop (structure for img2img). ---
    world = bpy.data.worlds.new("W")
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs[0].default_value = (0.04, 0.07, 0.08, 1.0)
    bg.inputs[1].default_value = 0.6
    scn.world = world

    key = bpy.data.lights.new("key", "AREA")
    key.energy = 1300
    key.size = 12
    key.color = (1.0, 0.8, 0.55)
    ko = bpy.data.objects.new("key", key)
    ko.location = (-5, 10, 8)
    ko.rotation_euler = (math.radians(35), math.radians(-22), 0)
    scn.collection.objects.link(ko)

    teal = bpy.data.lights.new("teal", "AREA")
    teal.energy = 700
    teal.size = 16
    teal.color = (0.35, 0.85, 0.95)
    to = bpy.data.objects.new("teal", teal)
    to.location = (8, 6, 3)
    to.rotation_euler = (0, math.radians(-40), 0)
    scn.collection.objects.link(to)

    fur = bpy.data.lights.new("fur", "POINT")
    fur.energy = 300
    fur.color = (1.0, 0.5, 0.18)
    fo = bpy.data.objects.new("fur", fur)
    fo.location = (0, 0.5, 2)
    scn.collection.objects.link(fo)

    # --- Ortho camera at +Z looking -Z, 16:9. ---
    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 23
    cam = bpy.data.objects.new("cam", cam_data)
    cam.location = (0, CY, 16)
    scn.collection.objects.link(cam)
    scn.camera = cam

    for name in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
        try:
            scn.render.engine = name
            break
        except TypeError:
            continue
    scn.render.resolution_x = 1920
    scn.render.resolution_y = 1080
    scn.render.image_settings.file_format = "PNG"
    path = out_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    scn.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("RENDERED", path)


main()
