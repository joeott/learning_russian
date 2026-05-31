# Anki Deck — Russian for Meeting Kadriya's Family

`russian_family_visit.txt` is a TAB-separated Anki import file (420 cards across
24 modules). `russian_family_visit_contextual.txt` is a companion import with
typed cloze, dictation, stress, pronunciation, back-translation, contrast, and
scenario cards generated from the same verified phrases. Both are generated
deterministically from `../content/content.json` by `../scripts/build_anki.py`.
**Edit the source content/build scripts, then rebuild — never hand-edit the .txt files.**

```bash
cd /Users/joe/Projects/learning_russian
python3 scripts/build_anki.py
```

The base file format:
- `#separator:tab` — fields are split on TAB (Russian glosses contain commas, so CSV is wrong)
- `#html:true` — the Russian field is wrapped in `<div>` so it renders large
- `#columns:English  Russian  Pronunciation  Note  Tags`

| Column | Source | Role |
|---|---|---|
| **English** | `en` gloss | **PROMPT** (front) — you produce the Russian |
| **Russian** | `ru` with stress marks (large; `(male form)` when `gender=="m"`) | **ANSWER** (back) |
| **Pronunciation** | `hint` | helper on the back |
| **Note** | `note` + `(focus: understand when heard)` if recognize + rehearse reminder | back |
| **Tags** | module id, `p1`/`p2`/`p3`, `recognize` | filtering |

The goal is **speaking**, so the default direction is **English → Russian** (you read the English, say the Russian out loud, then flip to check).

The contextual file uses:

- `#columns:CardType  SourceId  Prompt  Answer  Audio  Context  Tags`
- `CardType` values such as `cloze`, `dictation`, `stress`, `pronunciation`,
  `backtranslation`, `contrast`, and `scenario`
- tags like `type_dictation`, `source_food006`, `p1`, and module names so
  siblings can be filtered, buried, or suspended by type

Import the base deck first. Treat the contextual deck as optional add-on cards:
enable the types that support the current study phase, and bury related siblings
so one phrase does not crowd the same review day.

---

## 1. Import into Anki

### Desktop (Anki on Mac/Windows/Linux)
1. **File → Import**, choose `russian_family_visit.txt`.
2. Anki reads the header block automatically. Confirm:
   - **Field separator: Tab**
   - **Allow HTML in fields: ON** (checkbox checked)
   - **Notetype: Basic** (Field 1 → Front, Field 2 → Back). Map the extra
     columns: Field 3 (Pronunciation), Field 4 (Note) — if you use plain Basic,
     append them to the Back, or use the **Basic** type and add the snippet below.
   - **Tags column: 5** (the importer offers "Tags" mapping — point it at column 5).
3. Pick/create a deck, e.g. **"Russian — Family Visit"**, then **Import**.

> Tip: the cleanest setup is a custom notetype with five fields
> (English, Russian, Pronunciation, Note, Tags). Then the templates below
> reference fields by name. With plain **Basic** you only get Front/Back, so
> concatenate Russian + Pronunciation + Note on the back.

### AnkiMobile (iOS) / AnkiDroid (Android)
Mobile apps import poorly from raw text. The reliable path:
1. Import the `.txt` on **Anki desktop** (above).
2. **File → Export**, choose **"Anki Deck Package (.apkg)"**, include scheduling/media, export.
3. Move the `.apkg` to your phone (AirDrop, Drive, email) and open it with AnkiMobile/AnkiDroid — it imports the deck *and* the card templates (including TTS).

(If you must import the text directly on AnkiDroid: long-press the deck → no — use the desktop→apkg route; it carries the TTS template, which a raw text import does not.)

---

## 2. Card direction: EN → RU (and optional reverse)

With the **Basic** notetype you already get **Front = English → Back = Russian**.
That is the priority direction for a speaking goal: read English, say the Russian aloud, flip to verify.

To **also** drill RU → EN (recognition), change the notetype to
**"Basic (and reversed card)"** before/after import:
- **Tools → Manage Note Types → (your type) → Cards…**, or
- select the notes → **Notes → Change Notetype** → Basic (and reversed card).

This generates a second card per note (Russian prompt → English answer). For the
141 `recognize`-tagged items (questions relatives will fire at you), the reverse
direction is exactly what you want — those are about understanding when heard.

---

## 3. Audio — make Anki SPEAK the Russian (important)

The goal is **oral**, so the Russian must be spoken aloud.

### ★ Option 0 — Bundled native audio (recommended, already done for you)
Every card already contains a `[sound:zastolom_<id>.mp3]` tag, and the matching
**real ElevenLabs recordings** (voice: *Elena — native Russian*) are staged in
[`anki/media/`](media/) (420 files). To make them play:

1. Import the deck (section 2 above).
2. Copy the audio into Anki's media folder so it finds the files:
   - **Desktop:** copy everything in `anki/media/` into your profile's
     `collection.media` folder (Anki: **Tools → Add-ons → View Files** is nearby;
     the media folder sits next to `collection.anki2`, e.g.
     `~/Library/Application Support/Anki2/<Profile>/collection.media/` on macOS).
   - Then the `[sound:…]` tags resolve and audio plays on the answer side.
3. **For phone:** do the copy on desktop first, then **File → Export → .apkg**
   with *Include media* checked → open the `.apkg` on AnkiMobile/AnkiDroid. The
   recordings travel inside the package and play offline.

To regenerate or revoice the audio: `tools/zastolom audio generate --force`
(then `tools/zastolom build anki` restages `anki/media/`).

If you'd rather have Anki synthesize speech itself instead, use one of these:

### Option A — Anki's built-in TTS (no add-on, free)
Add a `{{tts}}` replacement to the **Back** template so Anki reads the Russian
when the answer is shown. **Tools → Manage Note Types → (type) → Cards…**, then
in the **Back Template** paste:

```html
{{FrontSide}}
<hr id="answer">
<div style="font-size:2em">{{Russian}}</div>

{{#Pronunciation}}<div style="color:#666">{{Pronunciation}}</div>{{/Pronunciation}}
{{#Note}}<div style="color:#a33;margin-top:.5em">{{Note}}</div>{{/Note}}

{{tts ru_RU voices=Microsoft_Irina:Russian}}
```

If you imported into plain **Basic** (fields are Front/Back, not named
`Russian`), use the Back field instead:

```html
{{FrontSide}}
<hr id="answer">
{{Back}}
{{tts ru_RU voices=Microsoft_Irina:Russian}}
```

Notes on the TTS line:
- `ru_RU` = Russian language. `voices=Microsoft_Irina:Russian` requests that
  specific voice **if installed**; Anki falls back to any available `ru_RU`
  system voice if not.
- **Install a Russian voice first** or you'll hear silence:
  - **macOS:** System Settings → Accessibility → Spoken Content → System Voice →
    Manage Voices → add a **Russian** voice (e.g. Milena).
  - **Windows:** Settings → Time & Language → Speech → add a Russian voice
    (Microsoft Irina).
  - **AnkiDroid/AnkiMobile:** use the OS TTS engine; install the Russian
    language pack in the phone's text-to-speech settings.
- Anki's `{{tts}}` reads the field **text**. The stress acute marks (U+0301)
  are harmless to most engines; if a voice mispronounces them, switch the
  template to read a stress-free field. (The source JSON keeps a `ru_plain`
  stress-stripped field for exactly this — regenerate with that field if needed.)

To hear it **automatically** without clicking, enable **Tools → Preferences →
Review → "Automatically play audio"** (desktop) or the equivalent on mobile.

### Option B — HyperTTS / AwesomeTTS add-on (higher-quality, can pre-bake audio)
1. **Tools → Add-ons → Get Add-ons**, paste the HyperTTS code (AwesomeTTS's
   successor) from ankiweb.net, restart Anki.
2. **HyperTTS → Add Audio**, pick a Russian voice (Google/Azure/Amazon Polly —
   e.g. Polly "Tatyana"), set source field = **Russian**, choose
   "on-the-fly" (template tag) or generate **stored media** into a new field.
3. If stored, add `{{Audio}}` (or whatever field it created) to your Back
   template. Stored audio survives export to `.apkg` and plays offline on mobile.

HyperTTS gives more natural neural voices than the OS TTS — recommended for the
phrases you'll actually rehearse out loud.

---

## 4. Study settings

- **New cards/day: 10–15.** With 420 cards that ramps you in fully over ~4
  weeks while leaving review headroom. Set in the deck's **Options → New cards →
  New cards/day**.
- **FSRS:** turn it **on** (Deck Options → FSRS toggle, then "Optimize" once you
  have a few days of reviews). FSRS schedules far more efficiently than the old
  SM-2 algorithm — worth it for a deadline-driven push.
- **Study priority phrases first.** The deck has **420 cards across 24 modules**,
  tagged `p1`/`p2`/`p3`. Drill the **p1** essentials before anything else:
  - **Tools → Create Filtered Deck** (or **Custom Study → Study by tag**),
    search `tag:p1`, build it, and grind those greetings/politeness/rescue lines
    until automatic. Then add `p2` (toasts, family, food), then `p3` (extras).
  - Module tags also work for focused sessions, e.g. `tag:toasts` before a
  dinner, `tag:listening` to train your ear for questions.
- **Contextual siblings:** if you import `russian_family_visit_contextual.txt`,
  start with `tag:type_dictation` and `tag:type_pronunciation` for oral work, or
  `tag:type_cloze` and `tag:type_backtranslation` for sentence-level recall.
  Keep Anki's sibling burying on so one source phrase does not appear in several
  forms in the same session.

---

## Card counts (for reference)

- 420 cards total, 24 modules:
  first_contact (13), politeness (17), toasts (16), family (28), food (16),
  smalltalk (9), listening (18), calendar_weather (19), numbers_quantities (28),
  adverbs_adjectives (14), daily_routine (29), leisure_places (21),
  physical_description (18), health_feelings (16), past_events (17), home_life (17),
  pronouns_possession (16), modal_ability (16), work_business (16), legal_recognition (15),
  celebrations (14), cultural_bonus (9), travel_budva (28), verbs (10).
- 141 cards tagged `recognize` (questions and phrases you mainly need to
  *understand when heard*).
- 11 cards currently carry a "⚠ rehearse with your wife" reminder.
- 21 cards show a "(male form)" marker — say these in the masculine.
- The web app also generates 60 typed conjugation drills from the core verb
  cards; these are app practice cards, not Anki import rows.
