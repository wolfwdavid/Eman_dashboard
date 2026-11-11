---
phase: 08-voice-commands-for-the-did-grant-assistant
plan: 05
subsystem: docs
tags: [docs, voice, transcribe]
requires: ["08-01", "08-02"]
provides: ["HOW-TO-UPDATE section: Teach the mic a new word", "agent/README section: Voice transcription endpoint"]
key-files:
  modified: [HOW-TO-UPDATE.md, agent/README.md]
requirements-completed: [VOICE-02, VOICE-05]
metrics:
  completed: 2026-11-10
---

# Phase 8 Plan 05: Voice documentation Summary

Two additive doc sections: how a non-developer adds a spoken synonym or funder nickname, and the `POST /chat/transcribe` reference.

## Tasks

1. HOW-TO-UPDATE.md: "Teach the mic a new word" inserted before "If something breaks" (67 additions, 0 deletions). Names STATUS_SYNONYMS, GATE_SYNONYMS, TYPE_SYNONYMS, RESET_PHRASES, CLOSE_PHRASES, PANEL_PHRASES, FACT_PHRASES, FUNDER_ALIASES, all verified as exports of `src/lib/voice/commands.ts`. Examples use the real shapes.
2. agent/README.md: "Voice transcription endpoint" inserted before the final "See ..." line (74 additions, 0 deletions). Documents request format, status codes, 1,048,576 byte cap, rate limit, client IP rule with the explicit trusted network list, Whisper env vars, ffmpeg/av note, privacy, deploy check with placeholder host.

## Deviations from Plan

- [Accuracy] The plan said the endpoint is open with no token. The merged code calls `_authorized()` on transcribe, so a 401 occurs when `CHAT_API_TOKEN` is set (exempt for trycloudflare.com hosts, as for `/chat`). The README documents the real behaviour.
- The README states the endpoint ships with the next VM deploy (not yet on the VM). No source, Dockerfile or deploy files were touched.

## Self-Check: PASSED

Both verification scripts exit 0; diffs are additions only; all table names exist in source.
