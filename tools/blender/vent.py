"""Builds a cast-iron floor steam grille and exports it as GLB.

    blender --background --factory-startup --python tools/blender/vent.py -- public/models/boilerbound/vent.glb

Modelled flat in Blender's XY plane (thin along Z = height) with its base at
Z=0, so after the y-up export it lies horizontally on the floor. Three.js
tints its material emissive-red during the warning / eruption states.
"""

import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import _common as C  # noqa: E402

import bpy  # noqa: E402


def main():
    C.reset_scene()
    iron = C.pbr_material("CastIron", (0.09, 0.08, 0.075), metallic=0.8, roughness=0.55)

    W, D, H = 1.56, 1.16, 0.16
    parts = []

    # Frame ring: outer slab minus the inner opening.
    frame = C.box(W, D, H, location=(0, 0, H / 2), name="frame")
    hole = C.box(W - 0.34, D - 0.34, H * 3, location=(0, 0, H / 2), name="hole")
    C.boolean_cut(frame, hole)
    C.add_bevel(frame, 0.02, 2)
    C.apply_modifiers(frame)
    parts.append(frame)

    # Slats across the opening (steam rises between them).
    inner_d = D - 0.34
    n = 6
    for i in range(n):
        t = (i + 0.5) / n
        y = -inner_d / 2 + t * inner_d
        slat = C.box(W - 0.36, 0.07, 0.12, location=(0, y, 0.1), name="slat")
        C.add_bevel(slat, 0.02, 1)
        C.apply_modifiers(slat)
        parts.append(slat)

    # Corner bolts.
    for sx in (-1, 1):
        for sy in (-1, 1):
            bolt = C.cylinder(0.05, 0.1, verts=10, location=(sx * (W / 2 - 0.11), sy * (D / 2 - 0.11), H), name="bolt")
            parts.append(bolt)

    for o in parts:
        C.set_material(o, iron)
        C.shade_smooth(o, 34)
    grille = C.join(parts, "Vent")

    path = C.out_path(os.path.join("public", "models", "boilerbound", "vent.glb"))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    C.export_glb(path, [grille])


main()
