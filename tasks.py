#!/usr/bin/env python3
"""
KalzTunz Background Tasks
RQ worker tasks: chord extraction, chord generation, pipeline, MIDI rendering.

All public functions in this module are enqueued by app.py using string
references like "tasks.extract_chords_from_file".  They MUST stay at the
project root so Python can resolve "tasks.*" from sys.path.
"""

import json
import logging
import os
import uuid
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
# MUSIC THEORY CONSTANTS  (shared by extraction + generation)
# ─────────────────────────────────────────────────────────────
CHROMATIC = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"]

SCALE_INTERVALS: Dict[str, List[int]] = {
    "major":      [0,2,4,5,7,9,11],
    "minor":      [0,2,3,5,7,8,10],
    "dorian":     [0,2,3,5,7,9,10],
    "mixolydian": [0,2,4,5,7,9,10],
    "pentatonic": [0,2,4,7,9],
    "blues":      [0,3,5,6,7,10],
}

# Chord quality per scale degree (major & minor)
SCALE_QUALITIES: Dict[str, List[str]] = {
    "major":      ["",  "m","m","", "", "m","dim"],
    "minor":      ["m","dim","", "m","m","",  "" ],
    "dorian":     ["m","m", "", "","m","dim","" ],
    "mixolydian": ["",  "m","dim","","m","m", ""],
    "pentatonic": ["",  "m","m","", ""],
    "blues":      ["m","m","m","","m",""],
}

ROMAN_MAJOR = ["I","ii","iii","IV","V","vi","vii°"]
ROMAN_MINOR = ["i","ii°","III","iv","v","VI","VII"]

# Mood → degree templates (indices into scale)
MOOD_PROGRESSIONS: Dict[str, List[List[int]]] = {
    "happy":      [[0,3,4,3],[0,4,5,3],[0,5,3,4]],
    "sad":        [[0,5,3,6],[0,3,6,4],[5,0,3,4]],
    "energetic":  [[0,4,5,4],[0,3,4,0],[0,5,4,3]],
    "calm":       [[0,5,3,4],[0,3,5,4],[3,0,4,5]],
    "dark":       [[0,6,3,7],[0,5,6,3],[6,0,5,3]],
    "romantic":   [[0,5,3,4],[0,3,5,6],[3,0,6,5]],
    "epic":       [[0,7,5,4],[0,5,7,4],[0,4,7,5]],
    "mysterious": [[0,1,5,0],[6,0,5,3],[0,7,3,5]],
    "uplifting":  [[0,4,5,3],[0,3,4,5],[0,5,4,3]],
}


# ─────────────────────────────────────────────────────────────
# AUDIO HELPERS
# ─────────────────────────────────────────────────────────────

def _load_audio(path: str) -> Tuple[Any, int]:
    """Load audio file with librosa, returns (y, sr)."""
    import librosa
    return librosa.load(path, sr=None, mono=True)


def _safe_tempo(tempo_raw: Any) -> float:
    """Safely convert librosa beat_track tempo to float."""
    import numpy as np
    return float(np.atleast_1d(tempo_raw)[0])


def _detect_key_from_chroma(chroma: Any) -> str:
    """Krumhansl-Schmuckler key detection from chroma matrix."""
    import numpy as np
    MAJOR = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88]
    MINOR = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17]
    chroma_mean = chroma.mean(axis=1)
    best_key, best_mode, best_r = "C", "major", -2.0
    for i in range(12):
        r_maj = float(np.corrcoef(chroma_mean, np.roll(MAJOR, i))[0, 1])
        r_min = float(np.corrcoef(chroma_mean, np.roll(MINOR, i))[0, 1])
        if r_maj > best_r:
            best_r, best_key, best_mode = r_maj, CHROMATIC[i], "major"
        if r_min > best_r:
            best_r, best_key, best_mode = r_min, CHROMATIC[i], "minor"
    return f"{best_key} {best_mode}"


def _recognize_chord(frame_chroma: Any) -> Tuple[str, float]:
    """Template-match a chroma frame to major/minor chord name + confidence."""
    import numpy as np
    MAJOR_T = np.array([1,0,0,0,1,0,0,1,0,0,0,0], dtype=float)
    MINOR_T = np.array([1,0,0,1,0,0,0,1,0,0,0,0], dtype=float)
    norm = np.linalg.norm(frame_chroma)
    if norm < 1e-6:
        return "N", 0.0
    chroma_norm = frame_chroma / norm
    best_chord, best_conf = "N", 0.0
    for i in range(12):
        for template, suffix in [(MAJOR_T, ""), (MINOR_T, "m")]:
            t = np.roll(template, i)
            t /= np.linalg.norm(t)
            conf = float(np.dot(chroma_norm, t))
            if conf > best_conf:
                best_conf, best_chord = conf, f"{CHROMATIC[i]}{suffix}"
    return best_chord, best_conf


def extract_audio_from_video(video_path: str) -> str:
    """Extract audio from a video file via pydub/ffmpeg."""
    from pydub import AudioSegment
    audio_path = str(Path(video_path).with_suffix(".wav"))
    AudioSegment.from_file(video_path).export(audio_path, format="wav")
    logger.info("Extracted audio: %s → %s", video_path, audio_path)
    return audio_path


# ─────────────────────────────────────────────────────────────
# PROGRESSION SUGGESTION  (used by both extraction & generation)
# ─────────────────────────────────────────────────────────────

def _suggest_progressions(chords: List[Dict], key: str) -> List[str]:
    """
    Derive up to 4 distinct 4-chord progressions from an extracted chord list.
    """
    if not chords:
        return []

    names: List[str] = []
    prev = None
    for c in chords:
        name = c.get("name", "")
        if not name or name == "N" or c.get("confidence", 0) < 0.60:
            continue
        if name != prev:
            names.append(name)
            prev = name

    if not names:
        return []

    seen: set = set()
    unique: List[str] = []
    for n in names:
        if n not in seen:
            seen.add(n)
            unique.append(n)

    progressions: List[str] = []

    # 1 — first 4 unique chords
    prog1 = unique[:4]
    progressions.append(" — ".join(prog1))

    # 2 — shifted window (chords 2–5)
    if len(unique) >= 5:
        prog2 = unique[1:5]
        if prog2 != prog1:
            progressions.append(" — ".join(prog2))

    # 3 — 4 most frequent chords
    top4 = [c for c, _ in Counter(names).most_common(4)]
    label = " — ".join(top4)
    if top4 and label not in progressions:
        progressions.append(label)

    # 4 — last 4 unique chords (outro)
    if len(unique) >= 8:
        prog4 = unique[-4:]
        label4 = " — ".join(prog4)
        if label4 not in progressions:
            progressions.append(label4)

    return progressions[:4]


# ─────────────────────────────────────────────────────────────
# TASK 1 — CHORD EXTRACTION  (enqueued by /api/extract-chords)
# ─────────────────────────────────────────────────────────────

def extract_chords_from_file(
    file_path: str,
    file_type: str,
    min_confidence: float,
    track_filter: str,
    keys_filter,        # JSON string or list
    instruments_filter, # JSON string or list
) -> Dict[str, Any]:
    """
    Extract chords, key, BPM and suggested progressions from an audio/video file.
    Returns a complete result dict that the frontend can render immediately.
    """
    import librosa
    import numpy as np

    # Normalise JSON filter args
    for attr in ("keys_filter", "instruments_filter"):
        val = locals()[attr]
        if isinstance(val, str):
            try:
                val = json.loads(val)
            except (json.JSONDecodeError, ValueError):
                val = []
            if attr == "keys_filter":
                keys_filter = val
            else:
                instruments_filter = val

    # Extract audio from video if needed
    audio_path = extract_audio_from_video(file_path) if file_type == "video" else file_path

    logger.info("Loading audio: %s", audio_path)
    y, sr = _load_audio(audio_path)

    # Chroma features
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)

    # Tempo
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    tempo = _safe_tempo(librosa.beat.beat_track(onset_envelope=onset_env, sr=sr)[0])

    # Key detection
    key = _detect_key_from_chroma(chroma)

    # Key filter
    if keys_filter and key.split()[0] not in keys_filter:
        duration = round(float(librosa.get_duration(y=y, sr=sr)), 2)
        logger.info("Key %s filtered out", key)
        return {
            "chords": [],
            "metadata": {"key": key, "bpm": round(tempo, 2), "duration": duration,
                         "time_signature": "4/4", "total_chords": 0},
            "suggested_progressions": [],
        }

    # Build chord timeline
    chords: List[Dict] = []
    prev_chord: Optional[str] = None

    for i, frame_chroma in enumerate(chroma.T):
        chord_name, confidence = _recognize_chord(frame_chroma)
        if confidence < min_confidence:
            continue
        if chord_name == prev_chord:
            if chords:
                chords[-1]["end_time"] = float(librosa.frames_to_time(i, sr=sr))
            continue
        time_s = float(librosa.frames_to_time(i, sr=sr))
        chords.append({
            "name":       chord_name,
            "time":       time_s,
            "end_time":   time_s,
            "confidence": round(confidence, 4),
            "key":        key,
        })
        prev_chord = chord_name

    duration = round(float(librosa.get_duration(y=y, sr=sr)), 2)
    logger.info("Extraction complete: %d chords, key=%s, bpm=%.1f", len(chords), key, tempo)

    return {
        "chords": chords,
        "metadata": {
            "key":            key,
            "bpm":            round(tempo, 2),
            "duration":       duration,
            "time_signature": "4/4",
            "total_chords":   len(chords),
        },
        # Progressions derived from the extracted chords — shown immediately in the UI
        "suggested_progressions": _suggest_progressions(chords, key),
    }


# ─────────────────────────────────────────────────────────────
# TASK 2 — CHORD GENERATION  (enqueued by /api/generate)
# ─────────────────────────────────────────────────────────────

def generate_chords(
    root_note: str,
    scale_mode: str,
    mood: str,
    style: str,
    bpm: int,
    duration: int,
    instruments: List[str],
    num_variations: int,
) -> Dict[str, Any]:
    """
    Real music-theory chord generation.  No AI model required — uses Krumhansl-
    Schmuckler scale theory + mood-weighted degree progressions to produce
    harmonically correct, stylistically appropriate chord sheets.

    Returns full generation data including progressions, scale reference,
    performance notes per instrument, and metadata — ready to render or export.
    """
    # ── Resolve scale ─────────────────────────────────────────
    if root_note not in CHROMATIC:
        root_note = "C"
    if scale_mode not in SCALE_INTERVALS:
        scale_mode = "major"

    root_idx   = CHROMATIC.index(root_note)
    intervals  = SCALE_INTERVALS[scale_mode]
    qualities  = SCALE_QUALITIES.get(scale_mode, SCALE_QUALITIES["major"])
    scale_notes = [CHROMATIC[(root_idx + i) % 12] for i in intervals]

    # ── Build chord vocabulary ────────────────────────────────
    chord_names = [f"{n}{q}" for n, q in zip(scale_notes, qualities)]

    # ── Generate progressions ─────────────────────────────────
    mood_templates = MOOD_PROGRESSIONS.get(mood.lower(), MOOD_PROGRESSIONS["happy"])
    progressions: List[Dict[str, Any]] = []

    for vi in range(min(num_variations, 6)):
        template   = mood_templates[vi % len(mood_templates)]
        chord_seq  = []
        for degree in template:
            idx = degree % len(chord_names)
            chord_seq.append({
                "chord":  chord_names[idx],
                "degree": idx,
                "roman":  (ROMAN_MINOR if scale_mode == "minor" else ROMAN_MAJOR)[
                    min(idx, len(ROMAN_MAJOR) - 1)
                ],
            })

        # Extend to fill the duration at 4 beats per chord, estimated bars
        beats_per_chord = 4
        beats_total = int(bpm * (duration / 60))
        repeats = max(1, beats_total // (len(template) * beats_per_chord))
        full_seq = chord_seq * repeats

        # Build time-stamped chord list
        seconds_per_chord = (60 / bpm) * beats_per_chord
        timed_chords = []
        t = 0.0
        for entry in full_seq:
            timed_chords.append({
                "name":       entry["chord"],
                "time":       round(t, 3),
                "end_time":   round(t + seconds_per_chord, 3),
                "confidence": 1.0,
                "degree":     entry["degree"],
                "roman":      entry["roman"],
            })
            t += seconds_per_chord
            if t >= duration:
                break

        progressions.append({
            "label":    f"Variation {vi + 1}" + (" ★ Primary" if vi == 0 else ""),
            "chords":   [c["name"] for c in chord_seq],
            "display":  " — ".join(c["name"] for c in chord_seq),
            "timeline": timed_chords,
        })

    # ── Scale reference ───────────────────────────────────────
    romans = ROMAN_MINOR if scale_mode == "minor" else ROMAN_MAJOR
    scale_reference = [
        {
            "note":    n,
            "chord":   chord_names[i],
            "roman":   romans[min(i, len(romans) - 1)],
            "quality": qualities[i] if i < len(qualities) else "",
        }
        for i, n in enumerate(scale_notes)
    ]

    # ── Instrument performance notes ──────────────────────────
    notes: Dict[str, str] = {}
    if "guitar" in instruments:
        notes["guitar"] = (
            f"Guitar: Capo fret 0 for {root_note}. "
            "Use open chord shapes where possible. "
            "Strum pattern: D-DU-UDU for upbeat, D--D for ballad."
        )
    if "piano" in instruments:
        notes["piano"] = (
            f"Piano: Left hand plays root octaves on beats 1 & 3. "
            "Right hand voicings: 1st inversion on beat 2 for smoother voice leading."
        )
    if "bass" in instruments:
        notes["bass"] = (
            f"Bass: Root on beat 1, 5th on beat 3. "
            f"Add chromatic passing tones to {scale_notes[3] if len(scale_notes)>3 else root_note} and "
            f"{scale_notes[4] if len(scale_notes)>4 else root_note}."
        )
    if "drums" in instruments:
        snare_feel = "on 2 & 4 (pop/rock)" if style in ("pop","rock") else "brushed (jazz/ambient)"
        notes["drums"] = (
            f"Drums: {bpm} BPM. Kick on 1, snare {snare_feel}. "
            f"Hi-hat 8th notes for {mood} feel."
        )
    if "strings" in instruments:
        notes["strings"] = (
            "Strings: Long bow on root + fifth. Add tremolo for tension. "
            "Pizzicato works well on lighter sections."
        )
    if "vocals" in instruments:
        notes["vocals"] = (
            f"Vocals: Melody built from {root_note} {scale_mode} scale. "
            "Stay within one octave for verse, push to upper register for chorus."
        )
    if "synth" in instruments:
        notes["synth"] = (
            "Synth: Pad with slow attack on sustained chords. "
            "Add a high arpeggiated line using scale tones 1–3–5–7."
        )

    return {
        "ok":             True,
        "root_note":      root_note,
        "scale_mode":     scale_mode,
        "key":            f"{root_note} {scale_mode}",
        "mood":           mood,
        "style":          style,
        "bpm":            bpm,
        "duration":       duration,
        "instruments":    instruments,
        "progressions":   progressions,
        "scale_reference":scale_reference,
        "instrument_notes": notes,
        "metadata": {
            "key":            f"{root_note} {scale_mode}",
            "bpm":            bpm,
            "duration":       duration,
            "time_signature": "4/4",
            "scale_notes":    scale_notes,
            "chord_names":    chord_names,
        },
    }


# ─────────────────────────────────────────────────────────────
# TASK 3 — FULL PIPELINE  (upload → extract → generate)
# ─────────────────────────────────────────────────────────────

def process_pipeline(
    file_path: str,
    style: str,
    use_advanced: bool,
    model_backend: str,
    use_storage: bool,
    user_id: str,
) -> Dict[str, Any]:
    """Full pipeline: chord extraction + progression suggestion."""
    logger.info("Pipeline: file=%s style=%s user=%s", file_path, style, user_id)

    extraction = extract_chords_from_file(
        file_path=file_path,
        file_type="audio",
        min_confidence=0.55,
        track_filter="all",
        keys_filter=[],
        instruments_filter=[],
    )

    chords = extraction.get("chords", [])
    meta   = extraction.get("metadata", {})

    return {
        "ok":         True,
        "user_id":    user_id,
        "extraction": extraction,
        "generation": {
            "style":                  style,
            "suggested_progressions": extraction.get("suggested_progressions", []),
            "bpm":                    meta.get("bpm", 120),
            "key":                    meta.get("key", "C major"),
            "model_backend":          model_backend,
            "advanced":               use_advanced,
        },
        "file": file_path,
    }


# ─────────────────────────────────────────────────────────────
# TASK 4 — MIDI RENDER  (called synchronously from /api/render)
# ─────────────────────────────────────────────────────────────

def render_midi(midi_name: str, force: bool = False) -> Dict[str, Any]:
    """Stub MIDI renderer — replace with fluidsynth in production."""
    output_dir  = Path(os.environ.get("UPLOAD_DIR", "uploads"))
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{midi_name}.wav"
    if output_path.exists() and not force:
        return {"ok": True, "cached": True, "output": str(output_path)}
    output_path.write_bytes(b"")
    return {"ok": True, "cached": False, "output": str(output_path)}
