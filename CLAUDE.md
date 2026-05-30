# CLAUDE.md — За столо́м (Russian study system)

Guide for any agent working in this repo. Read this first.

## What this is
A 16-day, evidence-backed system to get **Joe** ready to speak Russian with his
wife **Kadriya's** family (St. Petersburg, secular, they drink & toast) on
**June 15, 2026**. Goal is **oral** (be understood / understand at a dinner),
not a written exam. Joe **reads Cyrillic**, so: **Cyrillic + stress marks +
audio, no romanization** (the stressed syllable is shown in red).

## Golden rules
1. **`content/content.json` is the single source of truth.** Never hand-edit
   the generated files (`web/content.js`, `anki/*.txt`, `printable/cheatsheet.html`,
   `web/audio.js`). Edit `scripts/build_content.py` (the data) and rebuild.
2. **Never free-generate Russian.** Source + verify phrases against authoritative
   pages (use the `ff web` deep-research CLI in `~/Projects/final_fact`, or web
   search) and keep provenance in `source/research/`. Wrong Russian to in-laws is
   worse than none. Mark uncertain items `rehearse=True` → "rehearse with Kadriya".
3. **Stress marks** use the Unicode combining acute (U+0301) after the vowel.
   `ru_plain` (auto-computed) is the stress-stripped form used for audio/TTS.
4. **Rebuild + verify after any content change:** `tools/zastolom build && tools/zastolom verify`.

## The CLI (do everything through it)
`tools/zastolom` — stdlib Python, no deps. `tools/zastolom help` for full usage.
- `build [content|anki|cheatsheet|all]` — regenerate artifacts
- `audio generate [--force] [--ids …] [--voice ID]` — ElevenLabs MP3s → `web/assets/audio/`
- `audio voices` / `audio coverage`
- `serve [--port 8000]` — run locally; app at `/web/`
- `verify` — JSON + JS syntax + audio + deck checks
- `stats` — content breakdown

## Audio (ElevenLabs)
- Model `eleven_multilingual_v2`, format `mp3_44100_128`. Voice: **Elena —
  "Warm, Calm & Clear"** (`ScaQ3utur72x93jqMMeU`, native Russian, free-tier).
- Key resolves from `$ELEVENLABS_API_KEY` → `<repo>/.env` → `~/Projects/ott_law_redesign/.env` → `~/Projects/.env`. **Never print or commit the key.**
- Web app plays the MP3 and falls back to browser TTS if a file is missing.
- Anki: `build_anki.py` embeds `[sound:zastolom_<id>.mp3]` and copies files to `anki/media/`.

## Layout
```
content/        content.json  (source of truth, 109 items)
web/            installable PWA (vanilla JS); audio.js = audio manifest; assets/audio/*.mp3
anki/           deck (.txt) + media/ (mp3) + import README
printable/      cheatsheet.html (print-to-PDF)
schedule/       16_day_plan.md
tutor/          roleplay_protocol.md (AI-tutor sessions; Claude plays тёща/тесть)
source/         ekaterina_guide.md + research/ (verified provenance)
scripts/        build_content.py · build_anki.py · build_cheatsheet.py
tools/          zastolom CLI
.claude/        agents · skills · commands · settings.json
ai_docs/        context notes
```

## Conventions
- Module ids: `first_contact, politeness, toasts, family, food, smalltalk, listening, verbs`.
- Priority: `1` = doorway must-knows (Days 1–2), `2` = high, `3` = recognition/bonus.
- Item flags: `gender:"m"` (male-only form), `recognize:true` (understand-by-ear), `rehearse:true` (★).
- Verified content corrections to preserve: «На здоровье» is NOT a toast (use «За здоро́вье!»);
  address elders with **вы + name & patronymic**; "lawyer" = **юри́ст**; Joe is the **зять**.

## Where to start a task
- Add/curate phrases → `/add-phrase` command or the **content-curator** agent.
- Run a speaking session → `/study` command or the **russian-tutor** agent (uses `tutor/roleplay_protocol.md`).
- Regenerate everything → `/rebuild`. Add missing audio → `/audio`.
