---
name: manage-content
description: >
  The content → build → audio → verify pipeline for the За столо́м repo. Use when
  adding/editing phrases, regenerating artifacts, generating ElevenLabs audio, or
  troubleshooting the zastolom CLI / generators.
---

# Managing content & artifacts

`content/content.json` is the **single source of truth**, produced by
`scripts/build_content.py`. Everything else is generated — never hand-edit
`web/content.js`, `web/audio.js`, `anki/*.txt`, `anki/media/`, or
`printable/cheatsheet.html`.

## Add or change a phrase
1. Edit the data tables in `scripts/build_content.py` with the `add()` helper:
   `add(module, ru_with_stress, en, hint, priority, **flags)`.
   - modules: first_contact, politeness, toasts, family, food, smalltalk, listening, verbs
   - priority: 1 (doorway), 2 (high), 3 (recognition/bonus)
   - flags: `conf="med"`, `gender="m"`, `recognize=True`, `rehearse=True`, `note=`, `tags=[]`
   - stress = combining acute U+0301 after the stressed vowel
2. **Verify the Russian first** (see the content-curator agent / `/add-phrase`).
   Save sources under `source/research/`. Uncertain → `rehearse=True`.

## Rebuild everything
```bash
tools/zastolom build        # content.json + web/content.js + anki(+media) + cheatsheet
tools/zastolom verify       # JSON, JS syntax, audio coverage, deck rows
```
The generator is **deterministic** and **rejects duplicates** (same stripped
Russian twice → hard error). IDs are `{module[:4]}{NNN}`.

## Audio (ElevenLabs)
```bash
tools/zastolom audio generate          # synth only missing clips (idempotent)
tools/zastolom audio generate --force  # re-voice everything
tools/zastolom audio voices            # list native Russian voices
tools/zastolom audio coverage
```
- Defaults: voice Elena (`ScaQ3utur72x93jqMMeU`), `eleven_multilingual_v2`,
  `mp3_44100_128`. Override with `--voice <id>` or `$ZASTOLOM_VOICE`.
- Key auto-resolves from `~/Projects/ott_law_redesign/.env`. **Never commit it.**
- Output → `web/assets/audio/{id}.mp3` + manifest `web/audio.js`. Then
  `tools/zastolom build anki` restages `anki/media/` and `[sound:]` tags.

## Gotchas
- The repo runs ruff/black on save (a PostToolUse hook). If you add an import
  before its first use across multiple edits, ruff may strip it — add import +
  usage together, or re-check after editing `scripts/`.
- Web app reads embedded `content.js`/`audio.js` (no fetch) so it works on
  `file://` and offline; always rebuild after content changes.
- TTS in the app strips stress marks (uses `ru_plain`); the displayed Cyrillic keeps them.
