"""Record a continuous, real browser demonstration for the judge video."""

import json
import math
import os
import shutil
import time
import wave
from pathlib import Path

from playwright.sync_api import sync_playwright


HERE = Path(__file__).resolve().parent
OUT = Path(os.environ.get("MERGEWITNESS_CAPTURE_DIR", str(HERE / ".video-capture")))
URL = os.environ.get("MERGEWITNESS_CAPTURE_URL", "http://127.0.0.1:5173/MergeWitness/")
with wave.open(str(HERE / "narration_final_sulafat.wav")) as wav:
    NARRATION_DURATION = wav.getnframes() / wav.getframerate()
DURATION = math.ceil(NARRATION_DURATION) + 3


def main():
    OUT.mkdir(exist_ok=True)
    events = []
    errors = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            device_scale_factor=1,
            record_video_dir=str(OUT),
            record_video_size={"width": 1920, "height": 1080},
        )
        video_created = time.monotonic()
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(URL, wait_until="networkidle")
        page.get_by_role("button", name="Run comparison").wait_for()
        start = time.monotonic()
        preroll = start - video_created

        def at(second, name, action):
            remaining = second - (time.monotonic() - start)
            if remaining > 0:
                page.wait_for_timeout(remaining * 1000)
            action_started = time.monotonic() - start
            action()
            events.append({"scheduled": second, "started": round(action_started, 3),
                           "time": round(time.monotonic() - start, 3), "action": name})
            if action_started - second > 0.75:
                raise RuntimeError(f"Capture action missed narration cue: {name}")

        def scroll(selector):
            page.locator(selector).evaluate(
                "element => element.scrollIntoView({behavior:'smooth',block:'start'})"
            )

        def run_comparison():
            page.get_by_role("button", name="Run comparison").click()
            page.get_by_role("status").get_by_text("Interaction witness found").wait_for(timeout=20000)
            assert "$90 to Beta; expected $100" in page.get_by_role("status").inner_text()

        def run_repair():
            page.get_by_role("button", name="Run verified candidate").click()
            page.get_by_role("button", name="Run candidate again").wait_for(timeout=20000)
            assert page.locator(".repair-action .pill.pass").is_visible()

        at(1.5, "run four-snapshot comparison", run_comparison)
        at(9, "show four snapshot results", lambda: scroll("#laboratory"))
        at(24, "inspect combined witness", lambda: page.locator(".snapshot-grid .snapshot").last.hover())
        at(31, "show exact counterexample", lambda: scroll("#evidence"))
        at(51, "highlight expected and observed prices", lambda: page.get_by_role("tabpanel", name="Counterexample").hover())
        at(57.8, "open Bob session evidence", lambda: page.get_by_role("tab", name="Bob session evidence").click())
        at(73, "highlight task summaries", lambda: page.get_by_role("link", name="Probe session screenshot").hover())
        at(84.3, "open verified repair", lambda: page.get_by_role("tab", name="Verified Bob repair").click())
        at(101, "run repaired candidate in a fresh worker", run_repair)
        at(106, "inspect retained pricing and cache checks", lambda: page.locator(".repair-action").hover())
        at(111.1, "show second Bob scenario", lambda: page.get_by_role("tab", name="Bob session evidence").click())
        at(118.5, "highlight priority-cursor report", lambda: page.get_by_role("link", name="Priority-cursor evaluation report").hover())
        at(136, "return to verified repair", lambda: page.get_by_role("tab", name="Verified Bob repair").click())
        at(DURATION - 1, "finish on live verified result", lambda: scroll("#evidence"))
        assert not errors, errors
        context.close()
        source = Path(page.video.path())
        target = OUT / "browser.webm"
        if source != target:
            shutil.copy2(source, target)
        browser.close()
    manifest = {
        "source": URL,
        "viewport": [1920, 1080],
        "durationTargetSeconds": DURATION,
        "prerollSeconds": round(preroll, 3),
        "narrationDurationSeconds": round(NARRATION_DURATION, 3),
        "browserErrors": errors,
        "actions": events,
        "recording": str(target),
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
