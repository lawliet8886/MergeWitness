"""Generate one bounded MergeWitness demo narration with Google Cloud TTS.

Requires explicit CLI credit acknowledgement. Never prints credentials or retries
provider calls automatically. Existing output is preserved.
"""

import argparse
import base64
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import urllib.error
import urllib.request
import wave


MODEL = "gemini-3.1-flash-tts-preview"
VOICE = "Sulafat"
PROMPT = (
    "Speak in natural, clear American English, as an engineer showing a working "
    "product to a colleague. Sound warm, confident, and curious, with a conversational "
    "pace around 145 words per minute. Keep precise technical terms easy to hear. "
    "Use brief pauses between ideas. Avoid an advertisement tone. Read only the text."
)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--authorized-credits", action="store_true")
    parser.add_argument("--project", required=True)
    parser.add_argument("--text", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if not args.authorized_credits:
        parser.error("Cloud TTS credit acknowledgement is required")
    if args.output.exists():
        parser.error("Output already exists; refusing to overwrite it")

    narration = args.text.read_text(encoding="utf-8").strip()
    if not narration or len(narration.encode("utf-8")) > 4000:
        parser.error("Narration must contain 1–4000 UTF-8 bytes")
    if len(PROMPT.encode("utf-8")) > 4000:
        parser.error("Style prompt exceeds provider limit")

    gcloud = Path(os.environ["LOCALAPPDATA"]) / "Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd"
    token = subprocess.run(
        [str(gcloud), "auth", "print-access-token"],
        check=True, capture_output=True, text=True,
    ).stdout.strip()
    if not token:
        raise SystemExit("Google Cloud authentication returned no token")

    payload = {
        "input": {"text": narration, "prompt": PROMPT},
        "voice": {"languageCode": "en-US", "name": VOICE, "modelName": MODEL},
        "audioConfig": {"audioEncoding": "LINEAR16", "sampleRateHertz": 24000},
    }
    request = urllib.request.Request(
        "https://texttospeech.googleapis.com/v1/text:synthesize",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": "Bearer " + token,
            "x-goog-user-project": args.project,
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            data = base64.b64decode(json.load(response)["audioContent"], validate=True)
    except urllib.error.HTTPError as error:
        raise SystemExit(f"Cloud TTS returned HTTP {error.code}; no retry attempted") from error

    with wave.open(io.BytesIO(data)) as audio:
        if (audio.getnchannels(), audio.getsampwidth(), audio.getframerate()) != (1, 2, 24000):
            raise SystemExit("Unexpected WAV format from provider")
        duration = audio.getnframes() / audio.getframerate()
    if not 20 <= duration <= 180:
        raise SystemExit(f"Unexpected narration duration: {duration:.1f}s")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("xb") as destination:
        destination.write(data)
    evidence = {
        "provider": "Google Cloud Text-to-Speech",
        "model": MODEL,
        "voice": VOICE,
        "language": "en-US",
        "narrationTextSha256": hashlib.sha256(narration.encode("utf-8")).hexdigest(),
        "audioSha256": hashlib.sha256(data).hexdigest(),
        "durationSeconds": round(duration, 3),
        "estimatedOutputUsd": round(duration * 0.0005, 6),
    }
    args.output.with_suffix(".json").write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(evidence))


if __name__ == "__main__":
    main()
