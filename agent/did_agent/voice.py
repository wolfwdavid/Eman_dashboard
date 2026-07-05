"""Local speech-to-text for Telegram voice notes — free & private via faster-whisper.

Whisper runs on the same machine as everything else (no cloud, no cost). The model is loaded lazily
and cached, and faster-whisper is imported inside the function so the rest of the agent imports fine
even where faster-whisper isn't installed (e.g. this dev box; it's needed on the runtime Mac).
"""

from __future__ import annotations

import logging

log = logging.getLogger("did_agent")

_model = None
_model_name: str | None = None


def _get_model(model_name: str):
    """Load + cache the Whisper model. First call downloads it (~140MB for 'base')."""
    global _model, _model_name
    if _model is None or _model_name != model_name:
        from faster_whisper import WhisperModel  # heavy; deferred

        log.info("Loading Whisper model '%s' (first run downloads it)…", model_name)
        _model = WhisperModel(model_name, device="auto", compute_type="int8")
        _model_name = model_name
    return _model


def transcribe(audio_path: str, model_name: str = "base") -> str:
    """Transcribe an audio file (Telegram voice notes are OGG/Opus) to plain text."""
    model = _get_model(model_name)
    segments, _info = model.transcribe(audio_path, beam_size=5)
    return " ".join(seg.text for seg in segments).strip()
