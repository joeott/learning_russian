# За столо́м — Russian for Kadriya's Family 🥂

> **Goal:** walk into your wife's family's home in St. Petersburg on **June 15** and *hold your own at the table* — greet her parents properly, understand what's asked of you, compliment the cooking, and raise a toast. Not a written exam — a **spoken**, social goal.
>
> **You** read Cyrillic comfortably, so there's **no romanization** here. Instead: **Cyrillic + stress marks (ударе́ние) + audio** — because your weak point is *which syllable is stressed*, not the letters. The stressed letter is shown in **red**.

This is a complete, evidence-backed study system built around the original guide your teacher **Ekaterina ("Kate") Anokhina** made with you in 2020–2021 — reusing its strengths (verbs, daily routine) and filling its gaps (it had **zero** toasts, thin greetings, and no in-law vocabulary).

---

## Start here (2 minutes)

```bash
# from this folder, serve the app:
python3 -m http.server 8000
# then open:  http://localhost:8000/web/
```

On the home screen: tap **Learn** → start with the red **P1** cards (that's the moment you walk in the door). Then do one **Drill** round. That's a good day.

**Put it on your phone:** open that URL in mobile Safari/Chrome → *Add to Home Screen*. It's an installable PWA and works **offline**.

---

## The six tools (and when to use each)

| # | Tool | What it's for | Where |
|---|------|---------------|-------|
| 1 | **The web app** | Daily lessons + staged drills: recognise, recall, cloze, dictation, stress, pronounce, back-translation, contrast, produce, listen, role-play. | [`web/`](web/) — serve & open |
| 2 | **AI tutor** | Live spoken role-play — Claude plays your тёща/тесть and corrects you. Highest-leverage thing you can do for a *speaking* goal. | [`tutor/roleplay_protocol.md`](tutor/roleplay_protocol.md) |
| 3 | **Anki deck** | Spaced repetition on your phone — a 109-card base deck plus optional contextual cloze/dictation/stress/pronunciation/scenario siblings. | [`anki/`](anki/) — see its README to import |
| 4 | **Cheat sheet** | One printable "table survival sheet" for your pocket on the day. | [`printable/cheatsheet.html`](printable/cheatsheet.html) → Print / Save as PDF |
| 5 | **16-day plan** | Day-by-day schedule, risk-first, light weekdays / heavy weekends, with a 10-minute fallback. | [`schedule/16_day_plan.md`](schedule/16_day_plan.md) |
| 6 | **Resources** | Curated, verified videos / podcasts / apps for listening practice. | [`RESOURCES.md`](RESOURCES.md) |

A realistic day = **Learn the day's module → one Drill round → clear your Anki → 5–10 min role-play with the AI tutor.** Listen to a podcast on the commute. Rehearse the ★ items with Kadriya.

---

## What's inside the content

**109 verified phrases** across 8 modules, doorway-first:

1. **First Contact** — greet elders (`Здра́вствуйте`), introduce yourself, "thank you for inviting me."
2. **Politeness & Repair** — thanks, sorry, and rescue lines (`Я ещё учу́ ру́сский`).
3. **Toasts** — `За встре́чу!`, `За ва́ше здоро́вье!` + etiquette.
4. **Family & In-Laws** — you're the **зять**; her parents are your **тесть** & **тёща**.
5. **Food** — compliment the cook (`О́чень вку́сно!`), accept/decline more.
6. **Small Talk** — lawyer, Missouri, how you met.
7. **Listening** — the questions relatives will fire back at you.
8. **Core Verbs** — high-frequency reactivation (я / вы).

Three things a generic phrasebook gets wrong, **fixed here** (verified against multiple sources):
- 🚫 **«На здоро́вье» is NOT a toast** — it's a reply to *thank you*. Toast with **«За здоро́вье!»**.
- You **address** the parents with **вы + name & patronymic**, not "тёща/тесть" to their faces.
- **«юри́ст»** is the safe word for "lawyer" (адвока́т = narrower, courtroom/bar).

Items flagged **★** ("rehearse with Kadriya") are personal/lower-confidence — confirm them with your wife. She's the in-house validator.

---

## How it's built (so you can change it)

The built content contract is [`content/content.json`](content/content.json), generated from the course metadata plus the verified phrase tables. Edit the course metadata in [`courses/russian_family_visit/course.yaml`](courses/russian_family_visit/course.yaml), edit phrase data in [`scripts/build_content.py`](scripts/build_content.py), and everything regenerates:

```bash
python3 scripts/build_content.py     # → content/content.json + web/content.js
python3 scripts/build_anki.py        # → anki/russian_family_visit.txt
python3 scripts/build_cheatsheet.py  # → printable/cheatsheet.html
tools/zastolom test                  # validation + generated-artifact tests
tools/zastolom flow http://localhost:8000/web/   # browser-assert core learner flow
```

```
courses/        course metadata; default = russian_family_visit/course.yaml
content/        built content contract (109 items, stress-marked)
web/            installable PWA (vanilla JS, no build step, offline-capable)
anki/           import file + how-to (with TTS template)
printable/      print-to-PDF cheat sheet
schedule/       16-day plan (researched via Gemini deep-research)
tutor/          AI role-play protocol + correction rubric
source/         Ekaterina's original guide + the verified research it was built from
scripts/        the generators
tests/          stdlib integrity checks
docs/           ICALL implementation plan and validation standard
prompts/        local iterative improvement-loop prompt
```

The web app now tracks stage-specific mastery, delayed recall, response latency, due reviews, and daily readiness history locally: recognition, recall, cloze, dictation, stress, pronunciation, back-translation, contrast, listening, production, and role-play are scheduled separately, with lapse/error data feeding repair drills. Listening practice includes a fading-caption ladder, speed controls, and a room-noise pass so assisted comprehension is scheduled as a harder review while real-world listening remains unassisted. Role-play self-rating is criterion-aware, and the Home dashboard turns cumulative missed scenario goals into targeted repair signals. The `tools/zastolom flow` check now verifies Home, Learn, recognition, cloze, dictation, back-translation, role-play, and analytics state in a real browser.

The content contract also includes a lesson-locked curriculum graph. Each item carries its lesson boundary, lexemes, structures, prerequisites, and allowed error types so dictation, stress, pronunciation, cloze, back-translation, contrast, and AI tutor features can reject out-of-sequence material instead of free-generating beyond the learner's unlocked Russian. The ongoing roadmap is tracked in [`docs/ICALL_IMPLEMENTATION_PLAN.md`](docs/ICALL_IMPLEMENTATION_PLAN.md).

---

## The evidence behind the method

- **Active recall / testing effect** — retrieval beats re-reading (≈80% vs ≈36% retention at one week). → the Drill, not passive notes.
- **Spaced repetition** — expanding intervals fight forgetting. → Anki daily.
- **Comprehensible input + audio** — the engine for an *oral* goal. → audio on every card, podcasts, role-play.
- **Interleaving & desirable difficulty** — mix modules; graduate recognition → production → speech.
- **Risk-first** — the doorway moment is locked in Days 1–2 so you're covered even if life gets busy.

Удачи! You've got this. **За встре́чу! 🥂**
