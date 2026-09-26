"""Remove an unsupported attribution while retaining original TTS evidence."""
import hashlib
import json
import wave
from array import array
from pathlib import Path
HERE = Path(__file__).resolve().parent
SOURCE_SHA256 = 'd07b72859ad75eeb1bdd47804f919ab5011a3d68c7f39c3bf4ec5b871fdd2c60'
MUTE_START, RESUME, FADE_SECONDS = 94.50, 95.24, 0.005

def main():
    source = HERE / 'narration_final_sulafat.wav'
    assert hashlib.sha256(source.read_bytes()).hexdigest() == SOURCE_SHA256
    with wave.open(str(source), 'rb') as wav:
        params = wav.getparams()
        assert params.nchannels == 1 and params.sampwidth == 2
        original = wav.readframes(params.nframes)
    samples = array('h', original)
    start, end = round(MUTE_START * params.framerate), round(RESUME * params.framerate)
    fade = round(FADE_SECONDS * params.framerate)
    samples[start:end] = array('h', [0]) * (end - start)
    for offset in range(fade):
        samples[end + offset] = round(samples[end + offset] * offset / fade)
    output = HERE / 'narration_reviewed_sulafat.wav'
    with wave.open(str(output), 'wb') as wav:
        wav.setparams(params)
        wav.writeframes(samples.tobytes())
    assert samples.tobytes()[:start * 2] == original[:start * 2]
    assert samples.tobytes()[(end + fade) * 2:] == original[(end + fade) * 2:]
    text = (HERE / 'narration_final.txt').read_text(encoding='utf-8')
    assert text.count('Human review caught') == 1
    (HERE / 'narration_reviewed.txt').write_text(text.replace('Human review caught', 'Review caught'), encoding='utf-8')
    (HERE / 'narration_reviewed_sulafat.json').write_text(json.dumps({
        'source': source.name, 'sourceSha256': SOURCE_SHA256,
        'output': output.name, 'outputSha256': hashlib.sha256(output.read_bytes()).hexdigest(),
        'edit': 'Replace the unsupported word Human with silence; retain original timeline and Sulafat voice',
        'muteStartSeconds': MUTE_START, 'resumeSeconds': RESUME,
        'fadeInSeconds': FADE_SECONDS, 'durationSeconds': params.nframes / params.framerate,
        'unchangedSamplesOutsideEdit': True,
        'validation': 'Offline ASR without a reference prompt recovered Review caught a collision risk; not a human listening assessment',
    }, indent=2) + '\n', encoding='utf-8')

if __name__ == '__main__':
    main()
