# Color, Held in the Hand

A design philosophy for a game whose only subject is a color. Written as the art
direction for `Hud.ts` and `style.css`; every visual decision answers to it.

The color is the protagonist, and it must be told the truth. This game asks the
player to remember a hue and rebuild it, then scores the gap — so the interface is
forbidden from lying about color. No gradient washes over the field, no bloom warms
it, no 3D shading bends its face toward or away from a light. The color is a flat,
full-bleed plane rendered in exact sRGB, edge to edge, because the moment we shade
it we are scoring the player against a color they were never shown. Fidelity is not
an aesthetic preference here; it is the rule the whole game rests on.

The surround stays neutral so the eye stays honest. A single vivid field, seen
against another vivid field, shifts — simultaneous contrast is a real force and it
would quietly cheat the player. So everything that is not the answer is greige: a
warm light-gray page, a cream card at rest, two inks and nothing else. The drama
comes from the color arriving into that calm, not from decoration competing with it.

Type is Swiss, and it is huge, and it gets out of the way. Archivo in its heavy
weights, set tight and left, with numerals that are tabular so a counter dropping
from 5000 to 0 doesn't twitch. One enormous number per screen — the seconds left to
look, the percent you earned — anchored to a corner with generous air around it, the
way a gallery hangs one painting on a large wall. Labels are small, quiet, lowercase
in spirit. Nothing is centered that could be aligned to an edge.

Two inks, chosen by contrast, never by taste. Over any given color the text is
either near-black or near-white, whichever wins the WCAG contrast — computed, not
guessed, because a fixed threshold fails exactly on the mid-luminance colors this
game loves. The split reveal card carries this per half: your color and the original
each pick their own ink. Legibility is a property of the color, so it is derived
from the color.

The controls are the only ornament, and they earn it. Three tall vertical sliders —
hue as a full spectrum, saturation and brightness as gradients built live from the
current color — each capped with one glossy white knob. They read as instruments,
not decoration: the hue track's color under the knob is exactly the hue that value
produces, so the tool never contradicts itself. The confirm and advance actions are
single white circles in the bottom corner, a target and an arrow, because a screen
this quiet needs exactly one place to press.

What remains must feel inevitable: a color, a number, a way to answer, and a lot of
deliberate emptiness. Anything a designer would still be tempted to add — a texture,
a shadow on the field, a second accent — is the thing that would make the player
trust the color less. Remove it.
