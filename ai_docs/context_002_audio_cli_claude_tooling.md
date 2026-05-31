# context_002 — Audio, CLI, .claude tooling, verification (resume point)

- **Date:** 2026-05-30
- **Repo:** `/Users/joe/Projects/learning_russian` (git `main`; latest commit `84f029e`)
- **State:** ✅ complete & verified. `tools/zastolom verify` passes; audio 109/109.

## What this session added (on top of context_001)
1. **Native Russian audio (ElevenLabs)** — 109 MP3s in `web/assets/audio/`, voice
   **Elena «Warm, Calm & Clear»** (`ScaQ3utur72x93jqMMeU`), `eleven_multilingual_v2`.
   Integration pattern copied from `~/Projects/ott_law_redesign` (`xi-api-key`).
   - Web app `speak()` plays the MP3, falls back to browser TTS. Manifest: `web/audio.js`.
   - Anki deck embeds `[sound:zastolom_<id>.mp3]`; files staged in `anki/media/` (gitignored — regenerable).
2. **`tools/zastolom`** — stdlib CLI: `build · audio generate|voices|coverage · serve · verify · stats`.
   Key auto-resolves from `~/Projects/ott_law_redesign/.env` (never committed).
3. **`.claude/` tooling** — `settings.json` (permissions), repo `CLAUDE.md`, commands
   (`/rebuild /audio /add-phrase /study`), agents (`russian-tutor`, `content-curator`),
   skills (`study-session`, `manage-content`).
4. **Verification pass** — every previously-flagged phrase checked vs Wiktionary +
   native usage. **0 rehearse / 0 med-confidence flags remain.** Notable fixes:
   - «Я очень рад быть здесь» (calque) → **«Спаси́бо, что приня́ли»** (при́няли = 1st-syll stress)
   - «своя́ченица» (dated) → **«сестра́ жены́»**
   - confirmed Миссу́ри indeclinable; Переда́йте example; stress on all P1 toasts.

## How to resume (fresh window)
```bash
cd /Users/joe/Projects/learning_russian
tools/zastolom verify          # health
tools/zastolom serve           # app at http://localhost:8000/web/
```
Read repo `CLAUDE.md` first. Source of truth = `scripts/build_content.py` → `content/content.json`.
Never hand-edit generated files; rebuild with the CLI.

## OPEN — only Kadriya can confirm these (not researchable)
1. **Parents' first names + patronymics** (о́тчество) + pronunciation — for вы-address. Highest value.
2. A **personalized toast/greeting** using those names (e.g. «За Ва́ше здоро́вье, Еле́на Серге́евна!»).
3. Which **toast** to actually deliver, and whether to.
4. The **real dishes** she/her mother will serve (so compliments + «Переда́йте…» name them).
5. **ты vs вы** timing (default: stay on вы until invited).

## Offered next steps (not yet done — await user)
- Once names given: generate personalized toast/greeting + **native ElevenLabs audio**, add as ★ personal cards (app + cheat sheet).
- Optional: male-voice variant for toasts; "play all P1" review button in the app.
