"""Compose a judge video from continuous browser footage and measured narration."""

import json
import math
import os
import subprocess
import tempfile
import textwrap
import wave
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
CAPTURE = Path(os.environ.get("MERGEWITNESS_CAPTURE_DIR", str(HERE / ".video-capture")))
SIZE = (1920, 1080)
FONT_DIR = Path("C:/Windows/Fonts")
with wave.open(str(HERE / "narration_reviewed_sulafat.wav")) as wav:
    AUDIO_SECONDS = wav.getnframes() / wav.getframerate()
DURATION = math.ceil(AUDIO_SECONDS) + 3


def font(size, bold=False):
    name = "segoeuib.ttf" if bold else "segoeui.ttf"
    return ImageFont.truetype(str(FONT_DIR / name), size)


def parse_srt(path):
    def seconds(stamp):
        hours, minutes, rest = stamp.split(":")
        secs, millis = rest.split(",")
        return int(hours) * 3600 + int(minutes) * 60 + int(secs) + int(millis) / 1000

    cues = []
    for block in path.read_text(encoding="utf-8").strip().split("\n\n"):
        _, timing, *lines = block.splitlines()
        start, end = timing.split(" --> ")
        cues.append((seconds(start), seconds(end), " ".join(lines)))
    return cues


CAPTIONS = parse_srt(HERE / "demo_final_captions_en.srt")


def phase(t):
    if t < 9:
        return "FOUR FROZEN SNAPSHOTS", "Run the same check against Base, A, B and Combined"
    if t < 31:
        return "INTERACTION WITNESS", "The combined change breaks a customer boundary"
    if t < 57.5:
        return "EXACT COUNTEREXAMPLE", "Alpha pays $90; Beta expects $100 but receives $90"
    if t < 84:
        return "BOB PROBE + INDEPENDENT AUDIT", "Original Bob probe measured separately from strengthened verification"
    if t < 110.5:
        return "BOB REPAIR + FRESH VERIFICATION", "Tenant-aware cache; retained pricing and cache behavior"
    if t < 128:
        return "SECOND SYNTHETIC CASE", "Priority plus ID cursor: a witness, with no repair claimed"
    if t < 135.5:
        return "REPRODUCIBLE EVIDENCE", "Three real Bob tasks, frozen checks, exact commits and reports"
    if t < 141:
        return "RELEASE REVIEW", "A reproduced pricing error. A repair that keeps both features."
    return "REPRODUCIBLE EVIDENCE", "Try the live lab: lawliet8886.github.io/MergeWitness/"


def bob_card(task):
    names = {
        1: "01-tenant-cache-probe-summary.png",
        2: "02-tenant-cache-repair-summary.png",
        3: "03-priority-cursor-probe-summary.png",
    }
    source = Image.open(ROOT / "bob_sessions" / names[task]).convert("RGB")
    if task == 3:
        source = source.crop((230, 45, 1040, 580))
    else:
        source = source.crop((390, 45, 1190, 585))
    source = ImageOps.contain(source, (810, 545), Image.Resampling.LANCZOS)
    card = Image.new("RGBA", (866, 645), (8, 23, 46, 242))
    draw = ImageDraw.Draw(card)
    draw.rounded_rectangle((0, 0, 865, 644), radius=18, outline="#6591c7", width=3)
    draw.text((24, 16), f"REAL IBM BOB IDE  /  TASK {task}", font=font(25, True), fill="#a7d0ff")
    card.paste(source, ((866 - source.width) // 2, 62))
    footer = {
        1: "Original Bob-authored probe; measured locally",
        2: "Bob-authored repair; independently verified",
        3: "Bob-authored probe; witness only",
    }[task]
    draw.text((25, 606), footer, font=font(22), fill="#f5f8ff")
    return card


BOB_CARDS = {task: bob_card(task) for task in (1, 2, 3)}


def frame(t):
    canvas = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 0, 1920, 125), fill=(8, 23, 46, 255))
    draw.rounded_rectangle((76, 126, 1844, 914), radius=22, outline="#476b9d", width=3)
    draw.rectangle((0, 922, 1920, 1080), fill=(8, 23, 46, 255))
    draw.line((90, 922, 1830, 922), fill="#375d91", width=2)
    label, headline = phase(t)
    draw.text((90, 15), label, font=font(23, True), fill="#80b1ff")
    draw.text((90, 52), headline, font=font(35, True), fill="#f5f8ff")
    draw.text((1640, 20), "MergeWitness", font=font(22, True), fill="#a7c5ee")

    caption = next((value for start, end, value in CAPTIONS if start <= t < end), None)
    if caption:
        lines = textwrap.wrap(caption, width=93, break_long_words=False, break_on_hyphens=False)
        if len(lines) > 2:
            raise ValueError(f"Caption exceeds two lines at {t}: {caption}")
        y = 948 if len(lines) == 2 else 972
        for line in lines:
            left, top, right, bottom = draw.textbbox((0, 0), line, font=font(32, True))
            if right - left > 1740:
                raise ValueError(f"Caption exceeds safe horizontal margins at {t}: {line}")
            draw.text(((1920 - (right - left)) // 2, y), line, font=font(32, True), fill="#f5f8ff")
            y += 45
    draw.rectangle((90, 1064, 90 + int(1740 * (t + 1) / DURATION), 1070), fill="#80b1ff")

    task = 1 if 61 <= t < 83 else 2 if 85.5 <= t < 99.5 else 3 if 114 <= t < 128 else None
    if task:
        canvas.alpha_composite(BOB_CARDS[task], (955, 222))
    return canvas


def main():
    manifest = json.loads((CAPTURE / "manifest.json").read_text(encoding="utf-8"))
    if manifest["browserErrors"]:
        raise RuntimeError(f"Browser capture had errors: {manifest['browserErrors']}")
    if len(manifest["actions"]) < 10:
        raise RuntimeError("Browser capture contains too few actual actions")
    with tempfile.TemporaryDirectory(prefix="mergewitness-continuous-") as temp:
        images = Path(temp)
        # Emit an overlay at every actual caption/scene boundary, rather than
        # rounding short phrases to whole seconds. The browser remains 30 fps.
        boundaries = sorted({0.0, float(DURATION), *range(DURATION),
                             *(value for start, end, _ in CAPTIONS for value in (start, end)),
                             57.5, 61.0, 83.0, 84.0, 85.5, 99.5, 110.5, 114.0, 128.0, 135.5, 141.0})
        concat = ["ffconcat version 1.0"]
        for index, (start, end) in enumerate(zip(boundaries, boundaries[1:])):
            name = f"overlay-{index:04}.png"
            frame(start + 0.000001).save(images / name, optimize=True)
            concat.extend([f"file '{name}'", f"duration {end - start:.6f}"])
        concat.append(f"file '{name}'")
        overlay_manifest = images / "overlays.ffconcat"
        overlay_manifest.write_text("\n".join(concat) + "\n", encoding="utf-8")
        destination = Path(os.environ.get("MERGEWITNESS_VIDEO_OUTPUT", str(HERE / "mergewitness_demo.mp4")))
        candidate = images / "mergewitness_demo.mp4"
        command = [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-ss", str(manifest["prerollSeconds"]), "-i", str(CAPTURE / "browser.webm"),
            "-f", "concat", "-safe", "0", "-i", str(overlay_manifest),
            "-i", str(HERE / "narration_reviewed_sulafat.wav"),
            "-filter_complex",
            # Keep the actual recording continuous, enlarging its repair panel
            # while the candidate runs and during the closing result.
            "[0:v]split=2[wide_source][detail_source];"
            "[wide_source]crop=1920:845:0:70,scale=1736:765:flags=lanczos,"
            "pad=1920:1080:92:134:color=0x08172e,format=rgba[wide];"
            "[detail_source]crop=800:355:1050:390,scale=1736:765:flags=lanczos,"
            "pad=1920:1080:92:134:color=0x08172e,format=rgba[detail];"
            "[wide][detail]overlay=0:0:enable='between(t,99.5,109.8)+gte(t,137)',"
            "tpad=stop_mode=clone:stop_duration=3,format=rgba[app];"
            "[1:v]fps=30,format=rgba[labels];"
            "[app][labels]overlay=0:0:shortest=1,format=yuv420p[v];"
            "[2:a]apad=pad_dur=4[a]",
            "-filter_complex_threads", "2",
            "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-threads", "4", "-preset", "medium",
            "-crf", "19", "-r", "30", "-pix_fmt", "yuv420p", "-c:a", "aac",
            "-b:a", "160k", "-ar", "48000", "-t", str(DURATION),
            "-movflags", "+faststart", str(candidate),
        ]
        subprocess.run(command, cwd=HERE, check=True)
        # Preserve the previous valid video if rendering or decoding fails.
        subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-xerror",
            "-i", str(candidate), "-f", "null", "-",
        ], check=True)
        candidate.replace(destination)
    print(f"Created {destination} ({DURATION} seconds, continuous browser video)")


if __name__ == "__main__":
    main()
