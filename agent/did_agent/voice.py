"""Speech-to-text for Telegram voice notes.

Two backends, chosen by whether a base URL is configured:

* **Hosted** (`WHISPER_BASE_URL` set) — any OpenAI-compatible `/audio/transcriptions`
  endpoint. Groq serves `whisper-large-v3-turbo` on its free tier. Pure HTTP via the
  `openai` SDK we already depend on, so no native wheels: this is what lets a deployment
  skip `faster-whisper` (and its `av` build) and ffmpeg entirely.
* **Local** (`WHISPER_BASE_URL` empty, the default) — faster-whisper. Fully offline, audio
  never leaves the machine, but needs the `av` wheel and ffmpeg installed.

faster-whisper is imported inside its function so the module still loads where it isn't
installed — which is the whole point of the hosted path.
"""

from __future__ import annotations

import logging

log = logging.getLogger("did_agent")

_model = None
_model_name: str | None = None


def _get_model(model_name: str):
    """Load + cache the local Whisper model. First call downloads it (~140MB for 'base')."""
    global _model, _model_name
    if _model is None or _model_name != model_name:
        from faster_whisper import WhisperModel  # heavy + native deps; deferred

        log.info("Loading local Whisper model '%s' (first run downloads it)…", model_name)
        _model = WhisperModel(model_name, device="auto", compute_type="int8")
        _model_name = model_name
    return _model


def _transcribe_local(audio_path: str, model_name: str) -> str:
    model = _get_model(model_name)
    segments, _info = model.transcribe(audio_path, beam_size=5)
    return " ".join(seg.text for seg in segments).strip()


def _transcribe_hosted(audio_path: str, model_name: str, base_url: str, api_key: str) -> str:
    from openai import OpenAI  # already a hard dependency for the LLM client

    client = OpenAI(base_url=base_url, api_key=api_key or "whisper")
    # Telegram voice notes are OGG/Opus; the file's name matters because the API sniffs
    # the container from the extension, and mkstemp(suffix=".ogg") upstream provides it.
    with open(audio_path, "rb") as fh:
        resp = client.audio.transcriptions.create(model=model_name, file=fh)
    return (getattr(resp, "text", "") or "").strip()


def transcribe(
    audio_path: str,
    model_name: str = "base",
    base_url: str = "",
    api_key: str = "",
) -> str:
    """Transcribe an audio file (Telegram voice notes are OGG/Opus) to plain text.

    Routes to the hosted backend when `base_url` is set, else runs Whisper locally.
    """
    if base_url:
        log.info("Transcribing via hosted Whisper (%s, model=%s)", base_url, model_name)
        return _transcribe_hosted(audio_path, model_name, base_url, api_key)
    log.info("Transcribing via local faster-whisper (model=%s)", model_name)
    return _transcribe_local(audio_path, model_name)
