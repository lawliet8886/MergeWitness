"""Align final narration sentences to measured speech pauses without ASR calls."""

import re
import subprocess
import textwrap
import wave
from pathlib import Path


HERE = Path(__file__).resolve().parent
TEXT = (HERE / "narration_final.txt").read_text(encoding="utf-8").strip()
SENTENCES = re.split(r"(?<=[.!?])\s+", TEXT)
with wave.open(str(HERE / "narration_final_sulafat.wav")) as wav:
    DURATION = wav.getnframes() / wav.getframerate()
run = subprocess.run(
    ["ffmpeg", "-hide_banner", "-i", str(HERE / "narration_final_sulafat.wav"),
     "-af", "silencedetect=noise=-34dB:d=0.20", "-f", "null", "NUL"],
    capture_output=True, text=True, check=True,
)
starts = [float(value) for value in re.findall(r"silence_start: ([0-9.]+)", run.stderr)]
ends = [float(value) for value in re.findall(r"silence_end: ([0-9.]+)", run.stderr)]
assert len(starts) == len(ends) and len(starts) >= len(SENTENCES)
# Retain the genuine utterance boundaries, including the initial silence.
pauses = [(a, b) for a, b in zip(starts, ends) if b > a]
if pauses[0][0] != 0:
    pauses.insert(0, (0.0, 0.0))
total_voice = DURATION - sum(b - a for a, b in pauses)
total_chars = sum(len(sentence) for sentence in SENTENCES)

# Dynamic programming picks one real pause per sentence. Speech duration, not
# absolute timestamp, determines the fit, allowing natural variation in pace.
states = {(0, 0): (0.0, [])}
for index, sentence in enumerate(SENTENCES):
    next_states = {}
    expected = total_voice * len(sentence) / total_chars
    for (count, prior_pause), (score, choice) in states.items():
        assert count == index
        last_sentence = index == len(SENTENCES) - 1
        possible = [len(pauses)] if last_sentence else range(prior_pause + 1, len(pauses))
        for end_pause in possible:
            start = pauses[prior_pause][1]
            end = DURATION if last_sentence else pauses[end_pause][0]
            spoken = end - start
            if spoken <= 0:
                continue
            remaining = len(SENTENCES) - index - 1
            if len(pauses) - end_pause < remaining:
                continue
            deviation = (spoken - expected) ** 2 / max(expected, 1)
            weak_pause = 0 if last_sentence else max(0, 0.55 - (pauses[end_pause][1] - pauses[end_pause][0])) * 3
            candidate = (score + deviation + weak_pause, choice + [(start, end)])
            key = (index + 1, end_pause)
            if key not in next_states or candidate[0] < next_states[key][0]:
                next_states[key] = candidate
    states = next_states
_, intervals = states[(len(SENTENCES), len(pauses))]


def stamp(seconds):
    milliseconds = round(seconds * 1000)
    seconds, milliseconds = divmod(milliseconds, 1000)
    minutes, seconds = divmod(seconds, 60)
    hours, minutes = divmod(minutes, 60)
    return f"{hours:02}:{minutes:02}:{seconds:02},{milliseconds:03}"


captions = []
for index, (sentence, (start, end)) in enumerate(zip(SENTENCES, intervals), 1):
    # Preserve original timing outside the documented local narration edit.
    if sentence.startswith("Human review caught"):
        sentence = sentence.replace("Human review caught", "Review caught", 1)
        start = 95.24
    lines = textwrap.wrap(sentence, width=64, break_long_words=False, break_on_hyphens=False)
    if len(lines) > 3:
        raise ValueError(f"Caption {index} too long for display: {sentence}")
    captions.append(f"{index}\n{stamp(start)} --> {stamp(end)}\n" + "\n".join(lines))
(HERE / "demo_final_captions_en.srt").write_text("\n\n".join(captions) + "\n", encoding="utf-8")
for index, (sentence, (start, end)) in enumerate(zip(SENTENCES, intervals), 1):
    print(f"{index:02d} {start:6.2f}â€“{end:6.2f} {sentence[:65]}")
