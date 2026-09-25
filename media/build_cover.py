"""Render the exact-text LabLab poster for MergeWitness."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


HERE = Path(__file__).resolve().parent
SCALE = 2
W, H = 1200 * SCALE, 630 * SCALE
NAVY = "#0b1832"
INK = "#f7f9ff"
BLUE = "#6fa7ff"
MUTED = "#a9bddc"
RED = "#ff6b73"
GREEN = "#6bd3a2"


def font(name: str, size: int):
    return ImageFont.truetype(str(Path("C:/Windows/Fonts") / name), size * SCALE)


img = Image.new("RGB", (W, H), NAVY)
d = ImageDraw.Draw(img)
for x in range(0, W, 56 * SCALE):
    d.line((x, 0, x, H), fill="#132344", width=1)
for y in range(0, H, 56 * SCALE):
    d.line((0, y, W, y), fill="#132344", width=1)

def box(x0, y0, x1, y1, fill, outline=None, radius=18):
    d.rounded_rectangle((x0*SCALE, y0*SCALE, x1*SCALE, y1*SCALE), radius*SCALE,
                        fill=fill, outline=outline, width=2*SCALE)

box(66, 50, 291, 89, "#183669", "#285aa7", 19)
d.text((87*SCALE, 59*SCALE), "IBM BOB 2.0 HACKATHON", font=font("segoeuib.ttf", 17), fill="#d3e5ff")
d.text((65*SCALE, 113*SCALE), "MergeWitness", font=font("segoeuib.ttf", 75), fill=INK)
d.text((68*SCALE, 216*SCALE), "Two green changes. One broken price.", font=font("segoeui.ttf", 35), fill="#d3e5ff")
d.text((68*SCALE, 273*SCALE), "A reproducible interaction witness before release.", font=font("segoeui.ttf", 24), fill=MUTED)
d.text((69*SCALE, 332*SCALE), "SAME INVARIANT ACROSS FOUR SNAPSHOTS", font=font("segoeuib.ttf", 17), fill=BLUE)

cards = [
    (68, 367, 295, 481, "BASE", "PASS", GREEN),
    (345, 367, 572, 481, "CHANGE A", "PASS", GREEN),
    (622, 367, 849, 481, "CHANGE B", "PASS", GREEN),
    (899, 367, 1126, 481, "COMBINED", "FAIL", RED),
]
for x0,y0,x1,y1,label,state,color in cards:
    box(x0,y0,x1,y1,"#142544", "#31527f")
    d.text(((x0+20)*SCALE,(y0+20)*SCALE),label,font=font("segoeuib.ttf",19),fill=MUTED)
    d.text(((x0+20)*SCALE,(y0+54)*SCALE),state,font=font("segoeuib.ttf",31),fill=color)
d.text((68*SCALE, 540*SCALE), "Alpha $90  →  Beta should be $100  →  observes $90", font=font("segoeui.ttf",23),fill="#e2ecff")
d.text((855*SCALE, 582*SCALE), "signal-foundry / MergeWitness", font=font("segoeui.ttf",15),fill="#8fa8cb")
art = img.resize((1200, 630), Image.Resampling.LANCZOS)
canvas = Image.new("RGB", (1440, 810), NAVY)
background = ImageDraw.Draw(canvas)
for x in range(0, 1440, 56):
    background.line((x, 0, x, 810), fill="#132344", width=1)
for y in range(0, 810, 56):
    background.line((0, y, 1440, y), fill="#132344", width=1)
canvas.paste(art, (120, 90))
canvas.save(HERE / "cover.png", optimize=True)
