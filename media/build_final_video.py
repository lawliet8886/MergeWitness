"""Rebuild the narrated judge demo from captured application and Bob evidence.

The optional .ui-action-frames sequence is captured from the running browser.
If absent, the six checked-in UI states are used so the edit remains repeatable.
"""

import shutil
import subprocess
import tempfile
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps
from build_captions import intervals, sentences


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
FPS_SOURCE = 1
DURATION = 96
SIZE = (1920, 1080)
FONT_DIR = Path("C:/Windows/Fonts")


def font(size, bold=False):
    return ImageFont.truetype(str(FONT_DIR / ("segoeuib.ttf" if bold else "segoeui.ttf")), size)


def scene(t):
    if t < 10:
        return "01 / THE PROBLEM", "Two green changes can still fail together", "ui-final-hero.png"
    if t < 25:
        return "02 / FOUR SNAPSHOTS", "Base + A + B pass. Combined reveals a witness.", "ui-final-matrix.png"
    if t < 55:
        return "03 / FROZEN COUNTEREXAMPLE", "Alpha $90  →  Beta expected $100, observed $90", "ui-final-witness.png"
    if t < 61:
        return "04 / IBM BOB TASK 1", "Original probe and feature-retention checks", "ui-final-bob-evidence.png"
    if t < 74:
        return "05 / IBM BOB TASK 2", "Focused tenant-aware cache repair", "ui-final-repair-before.png"
    if t < 89:
        return "06 / INDEPENDENT VERIFICATION", "Candidate passes the probe and retains both features", "ui-final-repair-after.png"
    return "07 / REPRODUCIBLE REPORT", "One witness, one repair, measurable evidence", "ui-final-repair-after.png"


def bob_evidence(t, canvas):
    if not (55 <= t < 74):
        return
    task = 1 if t < 61 else 2
    path = ROOT / "bob_sessions" / f"0{task}-tenant-cache-{'probe' if task == 1 else 'repair'}-summary.png"
    original = Image.open(path).convert("RGB")
    # The exact IBM IDE consumption pane is shown, not a recreated UI.
    crop = original.crop((390, 48, 1190, 432))
    crop = ImageOps.contain(crop, (745, 358), Image.Resampling.LANCZOS)
    d = ImageDraw.Draw(canvas)
    x, y = 1086, 435
    d.rounded_rectangle((x-20, y-61, 1848, 865), radius=20, fill="#0b1832", outline="#5b85bd", width=3)
    d.text((x, y-43), f"REAL IBM BOB IDE • TASK {task}", font=font(28, True), fill="#d9e8ff")
    canvas.paste(crop, (x, y))
    value = "0.953 Bobcoins" if task == 1 else "0.637 Bobcoins"
    d.text((x, 818), value, font=font(25, True), fill="#a4d6ff")


def draw_caption(t, canvas):
    d = ImageDraw.Draw(canvas)
    d.rectangle((0, 922, 1920, 1080), fill="#08172e")
    d.line((90, 922, 1830, 922), fill="#375d91", width=2)
    current = next((sentence for sentence, (start, end) in zip(sentences, intervals)
                    if start <= t + 0.5 <= end), None)
    if current is None:
        return
    lines = textwrap.wrap(current, width=95, break_long_words=False)
    if len(lines) > 2:
        raise ValueError(f"Caption exceeds two lines: {current}")
    start_y = 950 if len(lines) == 2 else 974
    for line_number, line in enumerate(lines):
        bounds = d.textbbox((0, 0), line, font=font(34, True))
        x = (1920 - (bounds[2] - bounds[0])) // 2
        d.text((x, start_y + line_number * 47), line, font=font(34, True), fill="#f5f8ff")


def build_frame(t, action_dir):
    stage, headline, fallback = scene(t)
    action = action_dir / f"frame_{t:03}.png"
    source = action if action.exists() else HERE / fallback
    shot = Image.open(source).convert("RGB")
    if shot.size != SIZE:
        shot = ImageOps.fit(shot, SIZE, Image.Resampling.LANCZOS)
    # Remove mostly empty browser margins while retaining the actual screen.
    shot = shot.crop((0, 70, 1920, 915))
    shot = shot.resize((1736, 765), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", SIZE, "#08172e")
    d = ImageDraw.Draw(canvas)
    d.rounded_rectangle((76, 126, 1844, 914), radius=22, fill="#0f2a51", outline="#476b9d", width=3)
    canvas.paste(shot, (92, 134))
    d.text((90, 22), stage, font=font(25, True), fill="#80b1ff")
    d.text((90, 57), headline, font=font(39, True), fill="#f5f8ff")
    d.text((1550, 44), "MergeWitness", font=font(25, True), fill="#a7c5ee")
    bob_evidence(t, canvas)
    if t >= 89:
        d.rounded_rectangle((112, 698, 1810, 815), radius=17, fill="#0b1832", outline="#5b85bd", width=3)
        d.text((145, 714), "TRY THE LIVE LAB", font=font(25, True), fill="#80b1ff")
        d.text((145, 750), "lawliet8886.github.io/MergeWitness/", font=font(36, True), fill="#f5f8ff")
    draw_caption(t, canvas)
    return canvas


def main():
    action_dir = HERE / ".ui-action-frames"
    if action_dir.exists():
        present = sum((action_dir / f"frame_{i:03}.png").exists() for i in range(DURATION))
        if present != DURATION:
            raise RuntimeError(f"Action capture incomplete: {present}/{DURATION} frames")
    with tempfile.TemporaryDirectory(prefix="mergewitness-video-") as temp:
        frames = Path(temp)
        for t in range(DURATION):
            build_frame(t, action_dir).save(frames / f"frame-{t:03}.png", optimize=True)
        draft = frames / "draft.mp4"
        command = [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-framerate", str(FPS_SOURCE), "-i", str(frames / "frame-%03d.png"),
            "-i", str(HERE / "narration_sulafat.wav"),
            "-vf", "fps=30",
            "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-t", str(DURATION),
            "-movflags", "+faststart", str(draft),
        ]
        subprocess.run(command, cwd=HERE, check=True)
        shutil.copy2(draft, HERE / "mergewitness_demo.mp4")


if __name__ == "__main__":
    main()
