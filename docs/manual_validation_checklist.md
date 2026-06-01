# Manual Validation Checklist

Use this checklist from a fresh browser profile or an incognito window before a
family-demo pass. The local demo target is:

```bash
tools/zastolom serve --port 8000
open http://localhost:8000/web/#/learn
```

## Preflight

- [ ] `npm run check:js` passes.
- [ ] `tools/zastolom verify` passes with 452 audio files and 452 Anki rows.
- [ ] `tools/zastolom test` passes.
- [ ] `tools/zastolom browser http://127.0.0.1:8000/web/#/learn --desktop --fail-on-errors` passes.
- [ ] `tools/zastolom preflight http://127.0.0.1:8000/web/#/learn --mobile --offline` passes.
- [ ] `git status --short` is clean after generated artifacts are committed.

## Learn Screen

- [ ] Open `#/learn` and confirm the Practice scope defaults to all units and shows 452 total phrases across 26 modules.
- [ ] Select `Pronouns & Possession` and confirm 16 cards are available.
- [ ] Select `Winter & Seasonal Activities` and confirm 16 cards are available.
- [ ] Select `Question Words & Connectors` and confirm 16 cards are available.
- [ ] Move through previous/next, play, mark-known, module filter, and P1/P2/P3 filters.
- [ ] Toggle `Hide English`; English and pronunciation helper blur, then reveal on hover/tap.
- [ ] Test readback speeds: `0.65x`, `0.85x`, `1x`, `1.15x`, and `1.3x`.
- [ ] Confirm the selected speed survives a page reload.
- [ ] On a core verb card, click `Conjugate` and confirm the conjugation panel opens and closes.
- [ ] Click `Record`, allow microphone permission, say the phrase, click `Stop`, then `Play mine`.
- [ ] With the sync server configured, click `Analyze` and confirm the app shows transcript, target, score, and `Correct`/`Close`/`Needs repair`.
- [ ] Click `Sonograph` and confirm the native row renders; after recording, confirm the `Mine` row renders.
- [ ] Change cards and confirm the old recording is cleared for the new card.

## Drill Screen

- [ ] Open `#/drill`.
- [ ] Verify all 12 stages are visible: recognition, recall, conjugate, cloze, dictation, stress, pronounce, back-translation, contrast, produce, listen, role-play.
- [ ] Run one recognition card and confirm progress/analytics update.
- [ ] Run one conjugation card and confirm incorrect answers produce a repair focus.
- [ ] On `conjugate`, `cloze`, `dictation`, `produce`, and back-translation's Russian rebuild step, click `Speak answer`, record Russian, analyze, and confirm the transcript is scored without typing.
- [ ] Run one pronunciation card: native audio, record, play mine, analyze speech, accept or mark repair, then confirm scoring advances.
- [ ] Run one listening ladder card: captioned pass, slow audio, table speed, room-noise pass.
- [ ] Run one role-play card and self-rate at least one criterion as missed; confirm Home shows a repair signal.
- [ ] On a role-play card, click `Live tutor`, allow microphone access, confirm the tutor speaks aloud over WebRTC, and confirm the transcript updates while you talk.
- [ ] Click `End + score` and confirm the two-phase debrief appears with missed phrases, pronunciation notes, repair focus, and a replay prompt.
- [ ] Confirm the live role-play debrief persists derived role-play criteria only, not raw audio.

## Review Screen

- [ ] Open `#/review`.
- [ ] Confirm the card shows Russian first with stress marks and no English answer visible.
- [ ] Click the card or `Flip to English` and confirm the English answer appears.
- [ ] Use previous/next, play audio, module filters, priority filters, and shuffle.
- [ ] Confirm no typing is required in this review lane.

## Persistence And Statistics

- [ ] Reload the app and confirm known/stuck/progress state persists locally.
- [ ] Visit Home and confirm readiness, delayed recall, due reviews, role-play pass rate, repair focus, and history panels render.
- [ ] Visit Home and confirm Mission Ability, Grammar Control, n+1 Fit, Friction Index, current bottleneck, and adaptive recommendations render.
- [ ] Confirm `Analysis engine active` renders on Home with cycle count, last analysis time, confidence, next action, and target 58-78% n+1 band.
- [ ] Complete one drill card and confirm DevTools localStorage key `zastolom.russian_family_visit.v2.analysis_state` updates `cycle`, `last_run_at`, and `next_action`.
- [ ] Open `#/drill`, click `Adaptive next drill`, and confirm it routes to the recommended stage.
- [ ] Optional Postgres sync: start Postgres, run `npm run db:migrate`, then `npm run sync:serve`.
- [ ] Optional speech setup: store API keys with `tools/zastolom secrets put`, verify AWS CLI credentials are active, and confirm `/api/speech/evaluate` does not expose keys.
- [ ] Optional live roleplay setup: confirm `/api/realtime/session` uses `gpt-realtime-2`, `audio.output.voice=marin`, and returns only an ephemeral credential.
- [ ] Optional live roleplay setup: confirm `/api/realtime/call` accepts browser SDP and returns an SDP answer without exposing `OPENAI_API_KEY`.
- [ ] Open `#/conversations`, confirm topic and level filters render, and spot-check Food, Dates & weather, Games & leisure, and Budva topic selections.
- [ ] Open one Supported conversation and confirm the guided panel appears with target phrases from the selected scenario.
- [ ] Open one Live conversation and confirm the Live Tutor panel starts from the selected scenario, not a random drill card.
- [ ] During live roleplay, confirm the timer/cost/turn meter updates and `Finish & get feedback` clearly ends the conversation before debrief.
- [ ] Click a live transcript row and confirm English translation appears without exposing `OPENAI_API_KEY`.
- [ ] In DevTools, set `localStorage.setItem("zastolom.russian_family_visit.v2.sync_api", "http://127.0.0.1:8787")`, reload, complete a card, and confirm `/api/learning/state?learner_id=joe` returns the event-backed state.
- [ ] Confirm `/api/learning/metrics?learner_id=joe` returns `missionAbility`, `missionCefr`, `grammarControl`, `grammarCefr`, `nPlusOneFit`, and rating rows.
- [ ] Confirm `/api/learning/recommendations?learner_id=joe&limit=20` returns item/stage recommendations with `rescue`, `n+1`, `consolidate`, or `too_easy` buckets plus `cefr`, `evidence`, and `challenge_score`.
- [ ] Confirm no microphone recordings, base64 audio payloads, or sonograph buffers are persisted to Postgres; only transcript/score/verdict metadata appears under `speech_eval`.
- [ ] After a live roleplay `Finish & get feedback`, confirm `roleplay_conversation_passes` has one row for the event with transcript text, met/missed criteria, `stage_complete`, `n_plus_one_ready`, `estimated_cost_usd`, `duration_ms`, and `ended_reason` fields populated.

## Offline And Installability

- [ ] Open `#/learn`, then set the browser offline.
- [ ] Reload and confirm the app shell, content, audio manifest, and existing progress still load.
- [ ] Confirm the service worker reports `zastolom-v9` and fetches app JS/CSS/content network-first so stale versions are replaced after restart.
- [ ] Confirm install prompt/PWA installability is available in Chrome.

## Content And Study Coverage

- [ ] Confirm `docs/original_guide_coverage.md` reports 452 items, 26 modules, 40 scenarios, and 60 conjugation drills.
- [ ] Confirm the new `source/research/pronouns_possession.md` provenance file exists.
- [ ] Spot-check the new pronoun cards for stress marks, English gloss, audio, and tags.
- [ ] Spot-check the new question-word/connectors cards for stress marks, English gloss, audio, and tags.
- [ ] Spot-check Budva travel, health, family, work, and home-life modules for mission fit.
- [ ] Confirm rehearse-only sensitive lines are still marked and not treated as default production lines.

## Manual Demo Path

- [ ] Start at Home and show readiness/statistics.
- [ ] Go to Learn, select `First Contact`, play a card, and show speed controls.
- [ ] Select `Pronouns & Possession`, show the new lane, record a phrase, play it back, and open `Sonograph`.
- [ ] Select `Question Words & Connectors`, play `Почему́?`, `потому́ что`, and `поэ́тому`.
- [ ] Select `Winter & Seasonal Activities`, play one winter vocabulary card and one `ката́ться на ...` activity card.
- [ ] Select `Core Verbs`, click `Conjugate`, and show the mini conjugation panel.
- [ ] Go to Drill and show the 12-stage training path.
- [ ] Go offline and reload the page to show demo resilience.
