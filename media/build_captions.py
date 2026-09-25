"""Time the final narration's exact sentences to measured speech intervals."""

import re
import textwrap
from pathlib import Path


HERE = Path(__file__).resolve().parent
sentences = re.split(r"(?<=[.!?])\s+", (HERE / "narration.txt").read_text(encoding="utf-8").strip())
# Speech boundaries measured from narration_sulafat.wav with FFmpeg silencedetect.
intervals = [
    (0.36,4.81), (5.48,9.17), (9.84,14.30), (14.85,18.67),
    (19.29,21.66), (22.56,25.11), (25.82,28.68), (29.48,34.62),
    (35.40,37.50), (38.14,42.53), (43.39,47.50), (48.14,51.43),
    (52.13,54.47), (55.51,60.10), (60.64,63.83), (64.55,68.50),
    (68.95,72.99), (73.90,75.75), (76.30,82.69), (83.41,87.15),
    (87.96,95.00),
]
assert len(sentences) == len(intervals) == 21


def stamp(t):
    ms = round(t * 1000)
    s, ms = divmod(ms, 1000)
    m, s = divmod(s, 60)
    h, m = divmod(m, 60)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


captions = []
for index, (sentence, (start, end)) in enumerate(zip(sentences, intervals), 1):
    lines = textwrap.wrap(sentence, width=62, break_long_words=False)
    captions.append(f"{index}\n{stamp(start)} --> {stamp(end)}\n" + "\n".join(lines))
(HERE / "demo_captions_en.srt").write_text("\n\n".join(captions) + "\n", encoding="utf-8")
