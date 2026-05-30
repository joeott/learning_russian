---
description: Generate any missing ElevenLabs audio, then restage the Anki deck
argument-hint: "[--force] [--voice <id>] [--ids id1,id2]"
---
Synthesize high-quality native-Russian audio for phrases that don't have it yet
(voice: Elena, `eleven_multilingual_v2`). Pass `$ARGUMENTS` straight through.

Run:
```bash
tools/zastolom audio generate $ARGUMENTS
tools/zastolom build anki      # re-embed [sound:] tags + copy mp3s into anki/media/
tools/zastolom audio coverage
```

Notes:
- The API key is resolved automatically from `~/Projects/ott_law_redesign/.env`
  — never print or commit it.
- To change voice: `/audio --voice <id>` (see `tools/zastolom audio voices` for
  native Russian options). To revoice everything: `/audio --force`.
- Report how many clips were synthesized and the final coverage %.
