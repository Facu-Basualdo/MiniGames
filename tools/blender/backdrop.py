"""Builds and renders the deep background diorama to a JPG backdrop image.

    blender --background --factory-startup --python tools/blender/backdrop.py -- public/models/boilerbound/backdrop.jpg

Unlike the GLB props this is *rendered* to an image (so it can use rich
procedural materials, haze and atmospheric depth that don't survive glTF). The
game maps it onto a large plane behind the live foreground gears/pipes/diver.
Built in the game's own convention: X horizontal, Y up, depth along -Z (more
negative = further, fading into teal haze). Ortho camera at +Z looking -Z, so
it reads as a flat painted backdrop that lines up with the play area.
"""

import os
import sys
import math
import random

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import _common as C  # noqa: E402

import bpy  # noqa: E402

random.seed(7)


def out_path():
    argv = sys.argv
    if "--" in argv and argv[argv.index("--") + 1:]:
        return argv[argv.index("--") + 1]
    return os.path.join("public", "models", "boilerbound", "backdrop.jpg")


def rock_mat(name, color, rough=0.9, bump_scale=7.0, bump_strength=0.25, metallic=0.2):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metallic
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = bump_scale
    noise.inputs["Detail"].default_value = 6.0
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = bump_strength
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def emit_mat(name, color, strength):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Emission Color"].default_value = (*color, 1.0)
    bsdf.inputs["Emission Strength"].default_value = strength
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    return mat


def haze(name, color, alpha):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    trans = nt.nodes.new("ShaderNodeBsdfTransparent")
    emis = nt.nodes.new("ShaderNodeEmission")
    mix = nt.nodes.new("ShaderNodeMixShader")
    emis.inputs["Color"].default_value = (*color, 1.0)
    emis.inputs["Strength"].default_value = 1.0
    mix.inputs["Fac"].default_value = alpha
    nt.links.new(trans.outputs["BSDF"], mix.inputs[1])
    nt.links.new(emis.outputs["Emission"], mix.inputs[2])
    nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])
    mat.blend_method = "BLEND"
    return mat


def cog(x, y, z, r, teeth, mat):
    """A toothed cog centred at (x, y) at depth z; faces the camera (+Z)."""
    disc = C.cylinder(r, 0.4, verts=32, location=(x, y, z), name="cogdisc")
    C.set_material(disc, mat)
    rim = C.torus(r * 0.96, r * 0.1, 28, 8, location=(x, y, z), name="cogrim")
    C.set_material(rim, mat)
    for i in range(teeth):
        a = (i / teeth) * math.tau
        t = C.box(r * 0.22, r * 0.22, 0.42, location=(x + math.cos(a) * r, y + math.sin(a) * r, z), name="tooth")
        C.set_material(t, mat)
    hub = C.cylinder(r * 0.3, 0.55, verts=16, location=(x, y, z + 0.05), name="coghub")
    C.set_material(hub, mat)


def pipe(x0, y0, x1, y1, z, r, mat):
    dx, dy = x1 - x0, y1 - y0
    length = math.hypot(dx, dy)
    a = math.atan2(dy, dx)
    p = C.cylinder(r, length, verts=16, name="bpipe")
    p.rotation_euler = (0, math.radians(90), a)  # Z-axis -> along X, then spin into the XY direction
    p.location = ((x0 + x1) / 2, (y0 + y1) / 2, z)
    bpy.context.view_layer.objects.active = p
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=False)
    C.set_material(p, mat)
    j = C.sphere(r * 1.5, 2, location=(x1, y1, z), name="joint")
    C.set_material(j, mat)


def main():
    C.reset_scene()
    scn = bpy.context.scene

    wall_mat = rock_mat("Wall", (0.04, 0.07, 0.072), rough=0.95, bump_scale=9, bump_strength=0.5)
    rock_far = rock_mat("RockFar", (0.06, 0.10, 0.10), rough=0.95, bump_scale=5, bump_strength=0.6)
    moss_bronze = rock_mat("MossBronze", (0.16, 0.15, 0.07), rough=0.8, bump_scale=12, bump_strength=0.35, metallic=0.6)
    bronze = C.pbr_material("Bronze2", (0.34, 0.23, 0.09), metallic=0.9, roughness=0.5)
    iron = C.pbr_material("Iron2", (0.06, 0.07, 0.07), metallic=0.7, roughness=0.6)
    crystal = emit_mat("Crystal", (0.22, 0.8, 0.78), 1.7)
    lantern = emit_mat("Lantern", (1.0, 0.58, 0.22), 1.9)

    CY = 4.5  # vertical centre (matches the game's camCenterY)

    # Back wall (far) + rocky side outcrops.
    wall = C.box(28, 16, 0.6, location=(0, CY, -8.0), name="wall")
    C.set_material(wall, wall_mat)
    for sx in (-1, 1):
        rock = C.box(6, 16, 4, location=(sx * 12, CY, -6.0), name="rock")
        C.add_bevel(rock, 0.3, 2)
        C.apply_modifiers(rock)
        C.set_material(rock, rock_far)

    # Far mossy gears (dim, set back).
    cog(-6.5, 8.0, -6.2, 2.4, 20, moss_bronze)
    cog(5.5, 8.5, -6.4, 2.9, 22, moss_bronze)
    cog(0.5, 2.5, -6.0, 3.3, 24, moss_bronze)
    cog(9.5, 3.5, -6.2, 2.1, 16, moss_bronze)
    cog(-10.0, 4.5, -6.1, 2.5, 20, moss_bronze)

    # Teal atmospheric haze between far and mid layers (subtle — just depth).
    h1 = C.box(34, 22, 0.05, location=(0, CY, -5.0), name="haze1")
    C.set_material(h1, haze("Haze1", (0.05, 0.16, 0.18), 0.12))

    # Mid gears + pipe network.
    cog(-3.5, 6.5, -3.6, 1.7, 16, bronze)
    cog(3.5, 6.0, -3.4, 2.0, 18, bronze)
    cog(-8.0, 2.5, -3.6, 1.5, 14, bronze)
    cog(7.5, 2.0, -3.5, 1.6, 14, bronze)
    pipe(-12, 1.0, -3, 0.6, -3.3, 0.28, iron)
    pipe(-3, 0.6, 5, 2.0, -3.3, 0.28, iron)
    pipe(5, 2.0, 12, 1.4, -3.3, 0.28, iron)
    pipe(2.5, 7.5, 2.5, 10.5, -3.4, 0.24, iron)
    pipe(-6, 9, -6, 11.5, -3.4, 0.24, iron)

    # Near haze band.
    h2 = C.box(34, 22, 0.05, location=(0, CY, -2.4), name="haze2")
    C.set_material(h2, haze("Haze2", (0.04, 0.13, 0.16), 0.08))

    # Crystal clusters low in the corners.
    for (cx, sign) in ((-11, 1), (11, -1)):
        for k in range(5):
            cr = C.cone(0.22 + random.random() * 0.15, 0.02, 1.4 + random.random() * 1.3, verts=6,
                        location=(cx + sign * k * 0.5 + random.uniform(-0.3, 0.3), -0.2 + k * 0.35, -1.6), name="crystal")
            cr.rotation_euler = (random.uniform(-0.35, 0.35), random.uniform(-0.4, 0.4), 0)
            bpy.context.view_layer.objects.active = cr
            bpy.ops.object.transform_apply(rotation=True)
            C.set_material(cr, crystal)

    # Hanging lanterns (emissive globe + bracket + a real warm point light).
    for (lx, ly) in ((-9.5, 6.5), (-2.5, 5.0), (7.0, 6.0), (10.0, 3.5)):
        bracket = C.box(0.1, 0.8, 0.1, location=(lx, ly + 0.5, -1.4), name="bracket")
        C.set_material(bracket, iron)
        glob = C.uvsphere(0.28, 16, 12, location=(lx, ly, -1.4), name="lantern")
        C.set_material(glob, lantern)
        light = bpy.data.lights.new("ll", "POINT")
        light.energy = 45
        light.color = (1.0, 0.6, 0.3)
        lo = bpy.data.objects.new("ll", light)
        lo.location = (lx, ly, -0.4)
        scn.collection.objects.link(lo)

    # --- World + lights. ---
    world = bpy.data.worlds.new("W")
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs[0].default_value = (0.015, 0.035, 0.04, 1.0)
    bg.inputs[1].default_value = 0.22
    scn.world = world

    # Warm key from upper-left (makes the gears read bronze, not grey).
    key = bpy.data.lights.new("key", "AREA")
    key.energy = 800
    key.size = 9
    key.color = (1.0, 0.74, 0.44)
    ko = bpy.data.objects.new("key", key)
    ko.location = (-4, 9, 7)
    ko.rotation_euler = (math.radians(35), math.radians(-20), 0)
    scn.collection.objects.link(ko)

    # Cool teal rim from the right for the cavern atmosphere (kept a rim, not a fill).
    teal = bpy.data.lights.new("teal", "AREA")
    teal.energy = 320
    teal.size = 14
    teal.color = (0.3, 0.85, 0.9)
    to = bpy.data.objects.new("teal", teal)
    to.location = (10, 6, 2)
    to.rotation_euler = (0, math.radians(-45), 0)
    scn.collection.objects.link(to)

    # Warm furnace glow from below-centre for contrast against the teal.
    furnace = bpy.data.lights.new("furnace", "POINT")
    furnace.energy = 220
    furnace.color = (1.0, 0.5, 0.18)
    fo = bpy.data.objects.new("furnace", furnace)
    fo.location = (0, -1, 2)
    scn.collection.objects.link(fo)

    # --- Ortho camera at +Z looking -Z (default orientation), flat projection. ---
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
    scn.render.image_settings.file_format = "JPEG"
    scn.render.image_settings.quality = 90
    path = out_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    scn.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("RENDERED", path)


main()
