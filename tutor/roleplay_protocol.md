# AI Speaking-Tutor Role-Play Protocol

> **For:** Joe — English speaker, lawyer, reads Cyrillic, rusty from 2020–21 lessons.
> **Mission:** Be understood and understand at Kadriya's family dinner in St. Petersburg on **June 15, 2026** (secular family, they drink & toast).
> **What this is:** A reusable script for turning Claude (or any capable AI) into a live speaking partner. Speaking is your bottleneck, not reading — so this protocol is biased hard toward *talking time* and *gentle recasting* over grammar lectures.
> **Pairs with:** `content/content.json`, `schedule/16_day_plan.md` (the tutor days are 1, 4, 8, 9, 11), the Anki deck, and the printable cheat sheet.

---

## ⚠️ Three things the tutor MUST get right (these come from the verified research)

1. **You do NOT call them "тёща / тесть" to their faces.** Those are *referential* words (how people describe the relationship). You **greet and address the parents** with `Здра́вствуйте` + their **и́мя + о́тчество** (first name + patronymic) + **вы**. The tutor *plays* the тёща/тесть; you *address* them as `[Имя́ О́тчество]`. → Get the real patronymics from Kadriya and slot them in.
2. **Never «На здоро́вье» as a toast.** That's a reply to "thank you." Toasts use **За + accusative**: `За встре́чу!`, `За ва́ше здоро́вье!`, `За роди́телей!`. The tutor must recast immediately if you reach for «На здоровье».
3. **Hold the male forms.** You are male, so: `рад` (not рада), `Я наéлся` (not наелась), `Я о́чень рад быть здесь`. The tutor corrects any feminine ending.

---

## How to start a session — copy-paste kickoff prompt

Paste this to Claude at the top of each session. Edit the two bracketed lines, then tell it which **Scenario number** you want.

```
You are my Russian speaking tutor. Context: I'm an English-speaking American
lawyer, male. I read Cyrillic but I'm rusty and my stress/vowel-reduction is
weak. In a few days I'm meeting my wife Kadriya's family at a dinner in
St. Petersburg — secular family, they drink and toast. I want to SPEAK as much
as possible. My level: rebuilding from beginner.

Rules for you:
1. Speak mostly Russian, formal "вы", short natural sentences. Give an English
   gloss in (parentheses) ONLY for a phrase you think is new to me.
2. Bias toward my talking time. Keep your turns short; make me produce.
3. When I make an error, RECAST (say it back correctly in passing) and continue
   — do not stop to lecture. Only give an explicit rule if I make the SAME
   error twice, and keep it to one line.
4. Fix male/female forms (I'm male: рад, наелся), and never let me use
   «На здоровье» as a toast — recast to «За + ...». Address forms: I greet the
   parents with «Здравствуйте» + their name+patronymic + «вы», NOT «тёща/тесть».
5. Target my pronunciation: word STRESS, unstressed о→[a], soft consonants,
   and -ого/-его → spoken [-ova]. When I mangle a key word, have me repeat it
   2–3 times in isolation, then in the sentence.
6. Stay warm and encouraging. End each session with: 3 things I did well, and
   the 1–2 phrases to drill next.

Today run: SCENARIO [number] — see below. Start by setting the scene in one
line, then speak to me in character. If I'm totally lost I'll type "help" and
you may give me the line in Russian + English; I'll repeat it.
```

**Optional voice mode:** if using a voice-capable client, add: *"Speak your Russian turns aloud at ~70% normal speed; speed up as I improve."*

---

## Correction Rubric — how the tutor should correct

**Default = recast, not explicit.** Speaking fluency dies when you stop every sentence to explain a case ending. So:

| Situation | Tutor does |
|---|---|
| Minor error (ending, word order, a reduced vowel) | **Recast**: weave the correct version into the reply naturally and move on. `— Я живу в Америка. — А, вы живёте в Аме́рике, понятно. А где именно?` No commentary. |
| Same error **twice** | **One-line explicit rule**, then back to speaking. *"After в, location takes -е: в Аме́рике."* |
| Communication-breaking error (wrong word, lost meaning) | Brief clarify in Russian; if still stuck, allow English once, then re-say in Russian and have Joe repeat. |
| Wrong register (ты to an elder, «На здоровье» toast, feminine form) | **Always correct explicitly but kindly** — these are the high-stakes ones. One line, then continue. |
| Pronunciation/stress miss on a key phrase | Stop briefly, **drill it** (see below), then resume. |

**When English is allowed.** Joe may type `help` for a line, or `что это?` / "what was that?" for a gloss. The tutor gives English sparingly — a gloss or a one-line rule — never a paragraph. Target: **80%+ of the exchange in Russian** by the simulation scenarios.

**How to drill pronunciation/stress.** When Joe mangles a key word: (1) tutor says the word slowly, marking the stressed syllable; (2) Joe repeats it 2–3× in isolation; (3) Joe says it inside the full phrase; (4) move on. Don't drill every word — only the load-bearing ones for the dinner.

**How to escalate difficulty.** Start slow and scaffolded; raise the bar as Joe succeeds:
- Slower speech → normal speed.
- Glosses on everything → glosses only on new words → no glosses.
- One question at a time → follow-up questions → an unexpected tangent ("off-script").
- Quiet → background noise simulation (Scenario 7/8) — mirrors a loud St. Petersburg table.

**Keep it encouraging.** Russians will adore that he's *trying*. Tutor praises specifically ("your stress on `прия́тно` was perfect"), normalizes errors, and never piles on. Every session ends with 3 wins + 1–2 drill targets.

---

## Pronunciation focus (Joe reads Cyrillic but stress/reduction is weak)

The tutor should actively target these four — they're what make Cyrillic-readers sound off:

1. **Word stress.** Russian stress is unpredictable and *moves* the vowel sounds around it. The tutor flags the stressed syllable on any hard word. Reference the stress marks already in `content.json` (e.g. `О́чень прия́тно`, `Спаси́бо большо́е`).
2. **Unstressed о → [a].** `Хорошо́` = [ha-ra-**shó**] (both unstressed о's reduce). `Спаси́бо` = [spa-**sí**-ba]. This is the single biggest tell.
3. **Soft consonants.** `тесть` [tyest'], `дочь` [doch'], `день` [dyen'] — the softening (ь / е,и,ю,я) changes the consonant. Tutor models the soft glide.
4. **-ого / -его → spoken [-ova] / [-eva].** The г is **written г but pronounced [v]**, *and* the unstressed о still reduces — so `прия́тного` → [pri-**yát**-na-va], `сего́дня` → [si-**vód**-nya]. (Not a flat "[-ovo]": reduction applies to the unstressed vowels too.)

---

## The 36 Role-Play Scenarios (increasing difficulty)

Run them in order over your study days. Each says: **Goal · the Russian the tutor uses · what you should produce (with content.json IDs) · success criteria.** All "expected responses" are phrases already in your deck — don't invent new Russian, lean on what you've drilled.

---

### Scenario 1 — The doorway greeting (maps to Schedule Day 1) (id: doorway_greeting)
**Goal:** Walk in, greet the elders correctly, survive the first 20 seconds.
**Tutor (in character as the father-in-law opening the door):**
`Здра́вствуйте! Проходи́те, проходи́те! Как добра́лись?`
**You produce:**
- `Здра́вствуйте, [Имя́ О́тчество]!` (greeting + their name+patronymic — NOT "тёща/тесть") — `firs001`
- `О́чень прия́тно` / `Рад познако́миться` (male рад) — `firs006`, `firs008`
- `Спаси́бо, что пригласи́ли` — `firs010`
**Success:** You greet using `Здра́вствуйте` + the placeholder name+patronymic and **вы**, with eye contact, no English. You did NOT say "тёща/тесть" to their face.

---

### Scenario 2 — Introduce yourself + "I'm still learning" (id: introduce_and_learning_safety)
**Goal:** Say who you are and disarm the room by flagging your level early — your best safety net.
**Tutor:** `Как вас зову́т? Вы говори́те по-ру́сски?`
**You produce:**
- `Меня́ зову́т Джо` — `firs005`
- `Я ещё учу́ ру́сский` / `Я немно́го говорю́ по-ру́сски` — `poli009`, `smal006`
- `Я о́чень рад быть здесь` (male рад) — `firs011` *(flagged: rehearse with Kadriya)*
**Success:** You deploy "I'm still learning Russian" naturally and unembarrassed; correct male form `рад`.

---

### Scenario 3 — Accept food & compliment the cook (id: dinner_table_food_offer)
**Goal:** Praise the тёща's cooking, accept/decline more without rudeness.
**Tutor (as the mother-in-law, ladling food):** `Попро́буйте! Ещё? Бу́дете борщ?`
**You produce:**
- `О́чень вку́сно!` / `Мне о́чень нра́вится` — `food002`, `food005`
- `Мо́жно ещё?` (accept) or `Спаси́бо, не на́до` / `Я наéлся` (decline, male -лся) — `food007`, `food008`, `food006`
- `Спаси́бо, бы́ло о́чень вку́сно` (after the meal) — `food004`
**Success:** You compliment specifically, and you can decline a *third* helping politely without breaking warmth.

---

### Scenario 4 — Propose a toast (maps to Schedule Day 9) (id: first_toast)
**Goal:** Stand-ready with a short, warm toast. This lands huge.
**Tutor (raising a glass):** `Дава́йте вы́пьем! Джо, ска́жете тост?`
**You produce (pick one, then clink — eye contact):**
- `Я хочу́ сказа́ть тост за …` → `За встре́чу!` / `За знако́мство!` — `toas012`, `toas001`, `toas002`
- `За ва́ше здоро́вье!` / `За роди́телей!` / `За хозя́йку!` — `toas006`, `toas003`, `toas004`
**Tutor watches for:** if you say «На здоро́вье» → recast to `За здоро́вье!` immediately.
**Success:** A complete toast with `За + …`, eye contact on the clink, no «На здоровье», correct stress on the toast noun.

---

### Scenario 5 — Answer the questions relatives fire at you (maps to Day 5/10 listening) (id: rapid_host_questions)
**Goal:** Decode the rapid questions and answer in short, true sentences.
**Tutor asks, one at a time, then faster:** `Отку́да вы?` · `Кем вы рабо́таете?` · `Как вы познако́мились?` · `Как вам Росси́я?`
**You produce:**
- `Я из Аме́рики` / `Я из шта́та Миссу́ри` — `smal002`, `smal003` *(rehearse Missouri with Kadriya)*
- `Я юри́ст` (general — not адвокат) — `smal001`
- `Мы познако́мились …` — `smal005`
- `Хорошо́, спаси́бо` / `Норма́льно` / `Мне о́чень нра́вится` — `smal007`, `smal008`, `food005`
**Success:** You catch the **key verb** in each question and answer the right one (not your wife's question). Rescue lines ready: `Повтори́те, пожа́луйста`, `Поме́дленнее, пожа́луйста` (`poli010`, `poli011`).

---

### Scenario 6 — Small talk: how you met Kadriya (maps to Schedule Days 7–8) (id: how_we_met)
**Goal:** Deliver a 2–3 sentence "how we met" story, then field a follow-up.
**Tutor:** `Расскажи́те, как вы познако́мились?` then a follow-up like `А когда́ э́то бы́ло?` / `Где вы живёте сейча́с?`
**You produce:**
- `Мы познако́мились …` + your rehearsed script (built on Schedule Day 7 with Kadriya) — `smal005`
- `Я живу́ в Аме́рике` — `smal004`
- The table-winner when it fits: `Я люблю́ ва́шу дочь` — `fami019`
**Success:** Story flows from memory; you handle ONE unscripted follow-up without freezing (circumlocute or use a rescue line).

---

### Scenario 7 — "Things go off-script" recovery drill (id: off_script_recovery)
**Goal:** Build calm when you don't understand. This is the real skill for game day.
**Tutor:** deliberately speaks a bit too fast, uses an unknown word, or asks something random (`Вы лю́бите футбо́л?`, an idiom, an aside to "your wife"). No glosses.
**You produce (the rescue toolkit — drill until automatic):**
- `Извини́те` / `Прости́те` — `poli004`, `poli005`
- `Я не понима́ю` — `poli012`
- `Повтори́те, пожа́луйста` — `poli010`
- `Поме́дленнее, пожа́луйста` — `poli011`
- `Как по-ру́сски …?` — `poli017`
- and the anchor: `Я ещё учу́ ру́сский` — `poli009`
**Success:** When lost, you reach for a Russian rescue line (not silence, not English) and the conversation recovers. Tutor confirms you stayed in Russian.

---

### Scenario 8 — Full-dinner simulation (maps to Schedule Day 11; rehearse live Day 15) (id: full_dinner_simulation)
**Goal:** Stitch it all together under realistic pressure.
**Tutor runs ~10 minutes, in character, escalating:** opens the door → seats you → offers food → asks 2–3 questions → invites a toast → throws ONE off-script curveball → winds down with `Спаси́бо, что пришли́`.
**Optional difficulty:** add background-noise mode ("imagine music and side chatter"), per Schedule Day 12.
**You produce:** the full arc — greet (S1) → introduce + "still learning" (S2) → eat & compliment (S3) → answer questions (S5) → tell the story (S6) → toast (S4) → recover from the curveball (S7) → `Спаси́бо, бы́ло о́чень вку́сно` and `До свида́ния` (`food004`, `firs012`).
**Success:** You get through the whole dinner in **~80% Russian**, correct register/forms, at least one warm toast and one specific compliment, and you recover from the curveball without panic.

### Scenario 9 — Lawyer / Missouri small talk (id: lawyer_small_talk)
**Goal:** Handle common biographical questions confidently without saying awkward terms.
**Tutor:** `А чем вы занимаетесь? Откуда вы приехали?`
**You produce:**
- `Я юри́ст` — `smal001`
- `Я из Аме́рики` — `smal002`
- `Я из шта́та Миссу́ри` — `smal003`
- `Я о́чень рад быть здесь` — `firs011`
**Success:** Your biography is clear, correct, and natural; if asked a follow-up, recover with a repair line and continue.

### Scenario 10 — Noisy-table recovery drill (id: noisy_table)
**Goal:** Stay usable when speech gets fast and noisy.
**Tutor:** asks short questions from `listening` with short interleaved noise phrases.
**You produce:**
- `Повтори́те, пожа́луйста` — `poli010`
- `Поме́дленнее, пожа́луйста` — `poli011`
- `Я не понимаю́` — `poli012`
- Topic answers from `listening` and `smalltalk` (e.g., `Откуда вы?`, `Как вы говорите по-русски?`, `Как вы познакомились?`).
**Success:** You recover into Russian instead of freezing, and still answer at least one question correctly under speed/noise.

---

### Scenario 11 — Greetings and farewells (id: greeting_daypart_and_farewell)
**Goal:** Keep your opening and closing lines natural, polite, and short.
**Tutor:** use short scripted transitions at table boundaries.
**You produce:** `До́брый день`, `До́брый ве́чер`, `До свида́ния`, and respectful exit phrases.
**Success:** You can switch registers smoothly between greeting and close without overloading.

### Scenario 12 — Politeness baseline (id: politeness_baseline)
**Goal:** Maintain polite Russian on every request, refusal, and acknowledgment.
**Tutor:** prompt two neutral mini-dialogues; you answer each with short polite Russian.
**You produce:** `Пожа́луйста`, `Спаси́бо`, `Извини́те`, and brief acknowledgement phrases.
**Success:** Register is safe, calm, and complete even under low pressure.

### Scenario 13 — Toast repertoire recall (id: toast_repertoire_recall)
**Goal:** Choose the right toast formula quickly in likely dinner moments.
**Tutor:** gives 3 random cue stems (`За ...`) and you respond with safe toast forms.
**You produce:** safe `За ...` toast phrases, avoiding non-safe formulas.
**Success:** One correct toast comes out with clear stress and safe wording.

### Scenario 14 — Family context practice (id: family_context_practice)
**Goal:** Navigate family-relations language without overreaching.
**Tutor:** role-plays a brief kinship-safe check-in.
**You produce:** respectful kinship references and short affiliative lines from your deck.
**Success:** No avoidable register slips in family role references.

### Scenario 15 — Dinner navigation (id: dinner_navigation)
**Goal:** Mix requesting, accepting, declining, complimenting, and passing food with composure.
**Tutor:** simulates a rapid food-flow round at the table.
**You produce:** standard food request/accept/decline / compliment phrases.
**Success:** You answer naturally, and one polite decline sounds natural.

### Scenario 16 — Verb fluency check (id: verb_fluency_check)
**Goal:** Answer profile and logistics questions under mild pressure using core verbs.
**Tutor:** asks short first/second-person present-tense questions.
**You produce:** concise answers from `verbs` and `smalltalk` items.
**Success:** Core verbs are produced with expected agreement and case marking.

### Scenario 17 — Extended family tree and kinship (id: extended_family_family_tree)
**Goal:** Use family vocabulary from in-law and parent loops without overloading.
**Tutor:** asks short relationship-check prompts.
**You produce:** `сема́я́`, `жена́`, `муж`, `па́па`, `ма́ма`, `де́т`, `ба́бушка`, `де́душка`, `сы́н`, `до́чь`, `бра́т`, `сестра́` in short phrases.
**Success:** You answer with natural kinship words and correct register.

### Scenario 18 — Family mini-check-in (How are you?) (id: family_mini_checkin)
**Goal:** Handle short routine check-ins without losing rhythm.
**Tutor:** asks `Как дела́?`, `Хорошо́, спаси́бо`, and offer/recapture prompts.
**You produce:** the short answers (`Я немно́го говорю́ по-ру́сски`, `Хорошо́, спаси́бо`, `Норма́льно`, `Да, немно́го`) and keep responses short and warm.
**Success:** You can answer quickly and recover with `повтори́те`/`поме́дленнее` if needed.

### Scenario 19 — Native-speed check-ins (id: native_speed_checkins)
**Goal:** Catch recurring original-guide check-in questions at family speed.
**Tutor:** asks one fast question at a time from work, week/weekend, weather, and holiday-plan prompts.
**You produce:** first identify the rough meaning; then answer with a short already-known phrase from `daily_routine`, `work_business`, `calendar_weather`, or `celebrations`.
**Success:** You recognize the prompt quickly and use repair lines instead of freezing when a question is too fast.

### Scenario 20 — Sensitive family health and baby-readiness (id: sensitive_family_health)
**Goal:** Recognize the original-guide family health and baby-readiness questions without overproducing personal details.
**Tutor:** asks one careful prompt at a time about how Kadriya feels, whether you are ready, the baby, and leave from work.
**You produce:** the rough meaning first; then either a rehearsed short answer (`Да, мы гото́вы`) or a repair line if the topic is too personal or out of date.
**Success:** You treat these as sensitive rehearsal cards, keep the register warm, and do not volunteer unconfirmed personal information.

### Scenario 21 — Toast mechanics and table flow (id: toast_mechanics_and_table_flow)
**Goal:** Keep toast vocabulary accurate with the right social move.
**Tutor:** asks quick prompts from toast-building moments (`до дна́`, `бока́л`, `рю́мка`, and toast starters).
**You produce:** both toast formulas and proper table-item handling words.
**Success:** You switch between toast wording and glass vocabulary without register or intent errors.

### Scenario 22 — Calendar and weather check-in (id: calendar_weather_checkin)
**Goal:** Answer the original-guide day and weather questions as simple family small talk.
**Tutor:** asks `Ка́кая сего́дня пого́да?`, `Как там на у́лице?`, and `Како́й сего́дня день неде́ли?`
**You produce:** short answers from the `calendar_weather` module: today/yesterday/tomorrow weather, day names, and `на выходны́х`.
**Success:** You answer in short Russian without switching to English and keep stress clear on `сего́дня`, `пого́да`, and the day names.

### Scenario 23 — Numbers, prices, months, and quantities (id: numbers_quantities_checkin)
**Goal:** Survive source-guide number questions about time, cost, months, people, hours, and years.
**Tutor:** asks `Ско́лько сто́ит?`, `Ско́лько сейча́с вре́мени?`, `Како́й сейча́с ме́сяц?`, `Ско́лько бы́ло челове́к?`, and one hours-worked prompt.
**You produce:** either the exact known pattern (`Сейча́с три двена́дцать`, `Бы́ло се́мьдесят челове́к`) or a repair line before guessing.
**Success:** You recognize the question type, keep stress on number words clear, and do not freeze when a quantity appears inside a family/work/travel prompt.

### Scenario 24 — Quick descriptions and pace repair (id: adverb_adjective_survival)
**Goal:** Use original-guide adverbs and weather adjectives in short spoken answers.
**Tutor:** asks whether something is interesting, difficult, convenient, important, too fast, and what the weather is like.
**You produce:** compact lines from `adverbs_adjectives`: `Э́то о́чень интере́сно`, `Э́то немно́го тру́дно`, `Э́то не о́чень удо́бно`, `Ме́дленно, пожа́луйста`, and one `Пого́да ...` adjective line.
**Success:** You keep answers short and distinguish adverbs like `со́лнечно` from feminine adjective lines like `Пого́да со́лнечная`.

### Scenario 25 — Hobbies, home, and leisure places (id: leisure_places_checkin)
**Goal:** Answer dinner-safe questions about music, films, cats, home, parks, stadiums, cinema, and museums.
**Tutor:** asks what you do when you are not working, what music or films you like, what Kadriya likes, and where people play/watch things.
**You produce:** short answers from `leisure_places`, especially `Я люблю́ игра́ть на гита́ре`, `Я слу́шаю му́зыку`, `Кадри́я лю́бит рисова́ть`, and one place line.
**Success:** You keep `игра́ть на` for instruments and `игра́ть в` for sports/games, and you avoid long English hobby explanations.

### Scenario 26 — Can, want, need, and permission (id: modal_ability_survival)
**Goal:** Use source-guide modal patterns for what you can do, know how to do, want, need, and may or may not do.
**Tutor:** asks short prompts around `мо́жно`, `нельзя́`, `на́до`, `ну́жно`, `могу́`, `уме́ю`, `хочу́`, and `до́лжен`.
**You produce:** compact answers like `Мне ну́жно бо́льше вре́мени`, `Я хочу́ говори́ть по-ру́сски`, or a recognition gloss for permission/prohibition questions.
**Success:** You distinguish `могу́` from `уме́ю`, use repair instead of guessing, and keep the personal `до́лжен гото́вить ча́ще` joke rehearsed-only.

### Scenario 27 — Describing family members (id: physical_description_family)
**Goal:** Answer simple original-guide questions about what someone looks like.
**Tutor:** asks `Как он вы́глядит?`, `Как она́ вы́глядит?`, and short follow-ups about height, eyes, hair, face, smile, and resemblance.
**You produce:** short answers from `physical_description`: `Он высо́кий`, `Она́ сре́днего ро́ста`, `У него́ ка́рие глаза́`, `У неё коро́ткие прямы́е во́лосы`, `У неё краси́вая улы́бка`, and `Он похо́ж на па́пу`.
**Success:** You keep adjective agreement with the noun you are describing, avoid over-describing real relatives unless Kadriya has confirmed the details, and recover with repair lines if the follow-up is too fast.

### Scenario 28 — Health and feeling unwell (id: health_feelings_checkin)
**Goal:** Handle basic health/tiredness check-ins without giving a long medical explanation.
**Tutor:** asks `Как вы себя́ чу́вствуете?`, `Ты заболе́л?`, `Что у тебя́ боли́т?`, and one contrast line with `боле́ть за`.
**You produce:** short answers from `health_feelings`: `Я не о́чень хорошо́ себя́ чу́вствую`, `Я ещё не зна́ю`, `Наде́юсь, что нет`, `У меня́ боли́т голова́`, `Я ча́сто устаю́`, `Я хочу́ спать`, and recognition of `Я боле́ю за Кардина́лов`.
**Success:** You answer briefly, keep `у меня́ боли́т ...` automatic, distinguish `боле́ю` from `боле́ю за`, and use repair lines instead of attempting medical detail.

### Scenario 29 — Past week, trips, and what happened (id: past_week_events_checkin)
**Goal:** Answer recurring original-guide past-event questions without switching to English.
**Tutor:** asks `Что ты де́лал на про́шлой неде́ле?`, `Где ты был на про́шлой неде́ле?`, `Что вы там де́лали?`, `Куда́ ты лета́л?`, `Э́то была́ хоро́шая пое́здка?`, `Хоро́шие но́вости?`, and one `Что случи́лось?`
**You produce:** short answers from `past_events`: `На про́шлой неде́ле я был в Вирджи́нии`, `Мы говори́ли о би́знесе`, `Мы гуля́ли и смотре́ли достопримеча́тельности`, `Мы лета́ли в Ри́чмонд и в Чика́го`, `Пое́здка была́ о́чень хоро́шая`, `Мы обсуди́ли би́знес`, and one sensitive recognition-only police/car line if prompted.
**Success:** You keep male `я был`, plural `мы ...ли`, and the story short; police/car-theft details stay low-priority and recognition-first.

### Scenario 30 — Budva trip check-in (id: budva_trip_checkin)
**Goal:** Talk about arriving in Budva, the hotel, the sea, and simple plans without overexplaining.
**Tutor:** asks travel prompts around `Бу́два`, `Черного́рия`, hotel/taxi logistics, beach, sea, and dinner plans.
**You produce:** short answers from the `travel_budva` module: `Мы е́дем в Бу́дву`, `Мы бу́дем в Бу́две`, `Где на́ш о́тель?`, `Где пляж?`, and one simple plan.
**Success:** You keep the case switch clear between `в Бу́дву` and `в Бу́две`, stay in Russian, and recover with repair lines if needed.

### Scenario 31 — Daily routine check-in (id: daily_routine_checkin)
**Goal:** Answer original-guide `Мой день` questions about eating, working, resting, and evening routine.
**Tutor:** asks `Когда́ вы обе́даете?`, `Когда́ вы у́жинаете?`, `Когда́ вы рабо́таете?`, `Когда́ вы отдыха́ете?`, and `Что ты сего́дня де́лал?`
**You produce:** short answers from the `daily_routine` module: lunch/day, dinner/evening, work morning/evening, rest evening, and one worked-today answer.
**Success:** You use `у́тром`, `днём`, and `ве́чером` without switching to English and keep `рабо́таю` / `рабо́тал` distinct.

### Scenario 32 — My day mini-story (id: daily_routine_story)
**Goal:** Tell a short version of the original-guide `Мой день` essay.
**Tutor:** asks for a one-minute story about morning, work, and evening, then interrupts once with `А пото́м?` or `Что ты де́лаешь на рабо́те?`
**You produce:** four to six linked lines from `daily_routine`: early morning, coffee/guitar, work at ten, client problems/calls/court, and after-work dinner.
**Success:** You keep the story short, use `у́тром` / `по́сле` / `по́сле рабо́ты`, and only use the cooking-more-often joke if Kadriya has rehearsed it with you.

### Scenario 33 — Work and clients check-in (id: work_business_checkin)
**Goal:** Answer predictable lawyer/work questions while keeping the explanation short and beginner-safe.
**Tutor:** asks `Кем вы рабо́таете?`, `У вас мно́го клие́нтов?`, `У вас мно́го дел?`, `Ты сего́дня о́чень за́нят?`, and one court/client follow-up.
**You produce:** `Я юри́ст`, `У меня́ своя́ компа́ния`, `Да, у меня́ мно́го клие́нтов`, `Да, у меня́ мно́го дел`, and one short today-work sentence.
**Success:** You do not overexplain legal details; you answer, pause, and use repair lines if the follow-up is too fast.

### Scenario 34 — Holiday and family plans (id: holiday_celebration_checkin)
**Goal:** Answer original-guide Christmas/Thanksgiving/family-plan prompts in simple Russian.
**Tutor:** asks `Каки́е пла́ны на Рождество́?`, `Как вы с Кадри́ей отпра́здновали Рождество́?`, `Ско́лько дней вы бу́дете в О́регоне?`, and `Что вы де́лали на День Благодаре́ния?`
**You produce:** one short holiday plan, one family celebration answer, and one Thanksgiving dinner answer from the `celebrations` module.
**Success:** You keep the story to one or two sentences and recover with repair lines instead of trying a long holiday narrative.

### Scenario 35 — Cultural extras recognition (id: cultural_bonus_recognition)
**Goal:** Recognize source-guide proverbs and lawyer jokes without trying to perform them.
**Tutor:** plays or says one proverb/joke line at a time and asks for the rough English meaning.
**You produce:** recognition only: identify whether it is a proverb, idiom, or lawyer joke, then give the approximate meaning in English.
**Success:** You recognize the familiar lines and use repair phrases if the proverb is too fast; do not try to be funny in Russian unless Kadriya has rehearsed it with you.

### Scenario 36 — Airport and hotel arrival (id: budva_airport_hotel_checkin)
**Goal:** Handle airport and hotel arrival basics without switching to English.
**Tutor:** asks fast practical prompts around `аэропо́рт`, `бага́ж`, passport, baggage claim, hotel reservation, room, key, elevator, and check-out.
**You produce:** short survival lines from `travel_budva`: `Вот мой па́спорт`, `Я хочу́ сда́ть бага́ж`, `Где выда́ча багажа́?`, `У меня́ есть брони́рование`, `Ключ, пожа́луйста`, and one check-in/check-out question.
**Success:** You can produce the short requests and recognize receptionist prompts like `Э́то ваш ключ` and `Како́й ваш но́мер?`

---

## Session templates

### ⏱ Daily 10-minute session (busy-lawyer days)
1. **0:00–1:00** — Paste kickoff prompt, name today's scenario (rotate 1→7).
2. **1:00–8:00** — Run that ONE scenario, fast turns, you talking most of the time. Tutor recasts, doesn't lecture.
3. **8:00–10:00** — Tutor gives 3 wins + 1–2 drill phrases. You repeat those phrases aloud 3× each.
> *No new material on 10-minute days* — just protect and reactivate (matches the schedule's 10-min fallback).

### ⏱ Weekend 30–45-minute session (Sat/Sun)
1. **0–5 min** — Warm-up: tutor fires 5 quick recognition questions (Scenario 5 listening) for your ear.
2. **5–15 min** — Two scenarios back-to-back (e.g. S3 food + S4 toast), with pronunciation drills on the load-bearing words.
3. **15–30 min** — **Full or partial dinner simulation (Scenario 8)**, escalating speed; add background-noise mode in the final week.
4. **30–40 min** — Tutor debrief: your top 3 wins, your 3 weakest phrases ("leeches") → write these on the physical cheat sheet.
5. **40–45 min** — Cool-down: re-say your "how we met" story (S6) once, smoothly, for confidence.

---

## Rehearse THESE with Kadriya (not researchable / personal — AI can't verify)

The AI tutor can drill everything except the personal pieces. Lock these with your wife before game day:

- **The parents' actual name + patronymic** and the exact address form (replace the `[Имя́ О́тчество]` placeholder). This is the #1 item.
- `Я о́чень рад быть здесь` ("I'm very glad to be here") — confirm it sounds natural vs. a more idiomatic line. *(flagged MED confidence)*
- `Переда́йте, пожа́луйста …` ("please pass …") — confirm register feels right at the table. *(flagged MED)*
- `Я из шта́та Миссу́ри` — confirm how she'd pronounce/decline "Missouri." *(flagged MED)*
- Family-specific toasting customs (vodka vs. wine, who toasts first, whether they stand).

> Schedule note: Days 7, 15, and 16 are explicitly your *live rehearsal with Kadriya* days — use them to validate these flagged items, then bring them back into the AI role-play.
