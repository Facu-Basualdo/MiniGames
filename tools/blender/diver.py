"""Builds the player: a chunky cartoon diving-suit character, exported as GLB.

    blender --background --factory-startup --python tools/blender/diver.py -- public/models/boilerbound/diver.glb

Cartoon / chibi proportions (big round helmet, rounded barrel body, stubby
limbs, a large glowing cyan visor as the "face") so it reads as a drawn
character once cel-shaded + outlined in the game. Modelled Z-up with feet at
Z=0, facing -Y (so it faces the camera after the y-up glTF export).
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


def main():
    C.reset_scene()

    # Flat cartoon palette (metalness is ignored by toon shading in-game; base
    # colour is what reads). Brighter brass than the old PBR suit so it pops.
    brass = C.pbr_material("Brass", (0.74, 0.52, 0.18), metallic=1.0, roughness=0.35)
    dark = C.pbr_material("Joint", (0.10, 0.09, 0.09), metallic=0.9, roughness=0.5)
    glass = C.pbr_material("Port", (0.06, 0.12, 0.16), metallic=0.2, roughness=0.1,
                           emission=(0.30, 0.75, 1.0), emission_strength=1.4)

    parts_brass = []
    parts_dark = []

    # Stubby boots (chunky, rounded).
    for sx in (-0.17, 0.17):
        boot = C.box(0.30, 0.44, 0.22, location=(sx, -0.05, 0.11), name="boot")
        C.add_bevel(boot, 0.07, 3)
        C.apply_modifiers(boot)
        parts_dark.append(boot)
        # Very short legs — the round body sits low, chibi style.
        leg = C.cylinder(0.13, 0.22, verts=20, location=(sx, 0, 0.32), name="leg")
        parts_brass.append(leg)

    # Round barrel body: an egg (uvsphere squashed), soft and chunky.
    body = C.uvsphere(0.37, 32, 24, location=(0, 0, 0.62), name="body")
    body.scale = (1.0, 0.92, 1.18)
    place(body)
    C.add_subsurf(body, 1)
    C.apply_modifiers(body)
    parts_brass.append(body)
    # Belt + chest hatch rings for a bit of suit detail.
    belt = C.torus(0.37, 0.05, 32, 12, location=(0, 0, 0.42), name="belt")
    parts_dark.append(belt)
    hatch = C.torus(0.16, 0.035, 24, 10, location=(0, -0.30, 0.66), name="hatch")
    place(hatch, rot=(math.radians(90), 0, 0))
    parts_dark.append(hatch)

    # Backpack air tank (Blender +Y is behind, away from camera).
    tank = C.cylinder(0.14, 0.42, verts=20, location=(0, 0.32, 0.7), name="tank")
    C.add_bevel(tank, 0.06, 2)
    C.apply_modifiers(tank)
    parts_brass.append(tank)

    # Stubby arms with round mitt hands, angled down and slightly forward.
    for sx in (-1, 1):
        sh = C.sphere(0.16, 2, location=(sx * 0.36, 0, 0.78), name="shoulder")
        parts_dark.append(sh)
        arm = C.cylinder(0.12, 0.30, verts=16, name="arm")
        place(arm, location=(sx * 0.40, -0.04, 0.60), rot=(math.radians(16), sx * math.radians(18), 0))
        parts_brass.append(arm)
        mitt = C.sphere(0.15, 2, location=(sx * 0.46, -0.10, 0.44), name="mitt")
        parts_dark.append(mitt)

    # Neck collar + BIG round helmet (the focal point).
    neck = C.cylinder(0.21, 0.10, verts=24, location=(0, 0, 0.94), name="neck")
    parts_dark.append(neck)
    helmet = C.uvsphere(0.37, 32, 24, location=(0, 0, 1.22), name="helmet")
    parts_brass.append(helmet)

    # Large glowing cyan visor on the -Y face (the "face"): brass ring + window + bolts.
    ring = C.torus(0.22, 0.035, 32, 12, location=(0, -0.28, 1.21), name="ring")
    place(ring, rot=(math.radians(90), 0, 0))
    parts_dark.append(ring)
    window = C.cylinder(0.20, 0.06, verts=32, name="window")
    place(window, location=(0, -0.30, 1.21), rot=(math.radians(90), 0, 0))
    C.set_material(window, glass)
    bolts = []
    for i in range(8):
        a = (i / 8) * math.tau
        b = C.cylinder(0.024, 0.06, verts=8, name="bolt")
        place(b, location=(math.cos(a) * 0.22, -0.27, 1.21 + math.sin(a) * 0.22), rot=(math.radians(90), 0, 0))
        bolts.append(b)

    # Little antenna on top (rod + bulb).
    rod = C.cylinder(0.03, 0.14, verts=10, location=(0, 0, 1.66), name="rod")
    parts_dark.append(rod)
    bulb = C.sphere(0.06, 2, location=(0, 0, 1.76), name="bulb")
    C.set_material(bulb, glass)

    for o in parts_brass:
        C.set_material(o, brass)
    for o in parts_dark + bolts:
        C.set_material(o, dark)

    all_parts = parts_brass + parts_dark + bolts + [window, bulb]
    for o in all_parts:
        C.shade_smooth(o, angle_deg=35)
    diver = C.join(all_parts, "Diver")

    path = C.out_path(os.path.join("public", "models", "boilerbound", "diver.glb"))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    C.export_glb(path, [diver])


main()
