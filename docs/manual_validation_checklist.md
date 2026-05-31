# Manual Validation Checklist

Use this checklist from a fresh browser profile or an incognito window before a
family-demo pass. The local demo target is:

```bash
tools/zastolom serve --port 8000
open http://localhost:8000/web/#/learn
```

## Preflight

- [ ] `npm run check:js` passes.
- [ ] `tools/zastolom verify` passes with 420 audio files and 420 Anki rows.
- [ ] `tools/zastolom test` passes.
- [ ] `tools/zastolom browser http://127.0.0.1:8000/web/#/learn --desktop --fail-on-errors` passes.
- [ ] `tools/zastolom preflight http://127.0.0.1:8000/web/#/learn --mobile --offline` passes.
- [ ] `git status --short` is clean after generated artifacts are committed.

## Learn Screen

- [ ] Open `#/learn` and confirm the curriculum lock shows 420 total phrases across 24 modules.
- [ ] Select `Pronouns & Possession` and confirm 16 cards are available.
- [ ] Move through previous/next, play, mark-known, module filter, and P1/P2/P3 filters.
- [ ] Toggle `Hide English`; English and pronunciation helper blur, then reveal on hover/tap.
- [ ] Test readback speeds: `0.65x`, `0.85x`, `1x`, `1.15x`, and `1.3x`.
- [ ] Confirm the selected speed survives a page reload.
- [ ] On a core verb card, click `Conjugate` and confirm the conjugation panel opens and closes.
- [ ] Click `Record`, allow microphone permission, say the phrase, click `Stop`, then `Play mine`.
- [ ] Click `Sonograph` and confirm the native row renders; after recording, confirm the `Mine` row renders.
- [ ] Change cards and confirm the old recording is cleared for the new card.

## Drill Screen

- [ ] Open `#/drill`.
- [ ] Verify all 12 stages are visible: recognition, recall, conjugate, cloze, dictation, stress, pronounce, back-translation, contrast, produce, listen, role-play.
- [ ] Run one recognition card and confirm progress/analytics update.
- [ ] Run one conjugation card and confirm incorrect answers produce a repair focus.
- [ ] Run one pronunciation card: native audio, record, play mine, self-rate.
- [ ] Run one listening ladder card: captioned pass, slow audio, table speed, room-noise pass.
- [ ] Run one role-play card and self-rate at least one criterion as missed; confirm Home shows a repair signal.

## Persistence And Statistics

- [ ] Reload the app and confirm known/stuck/progress state persists locally.
- [ ] Visit Home and confirm readiness, delayed recall, due reviews, role-play pass rate, repair focus, and history panels render.
- [ ] Optional Postgres sync: start Postgres, run `npm run db:migrate`, then `npm run sync:serve`.
- [ ] In DevTools, set `localStorage.setItem("zastolom.russian_family_visit.v2.sync_api", "http://127.0.0.1:8787")`, reload, complete a card, and confirm `/api/learning/state?learner_id=joe` returns the event-backed state.
- [ ] Confirm no microphone recordings or sonograph buffers are persisted to Postgres.

## Offline And Installability

- [ ] Open `#/learn`, then set the browser offline.
- [ ] Reload and confirm the app shell, content, audio manifest, and existing progress still load.
- [ ] Confirm the service worker reports cached app assets in DevTools.
- [ ] Confirm install prompt/PWA installability is available in Chrome.

## Content And Study Coverage

- [ ] Confirm `docs/original_guide_coverage.md` reports 420 items, 24 modules, 38 scenarios, and 60 conjugation drills.
- [ ] Confirm the new `source/research/pronouns_possession.md` provenance file exists.
- [ ] Spot-check the new pronoun cards for stress marks, English gloss, audio, and tags.
- [ ] Spot-check Budva travel, health, family, work, and home-life modules for mission fit.
- [ ] Confirm rehearse-only sensitive lines are still marked and not treated as default production lines.

## Manual Demo Path

- [ ] Start at Home and show readiness/statistics.
- [ ] Go to Learn, select `First Contact`, play a card, and show speed controls.
- [ ] Select `Pronouns & Possession`, show the new lane, record a phrase, play it back, and open `Sonograph`.
- [ ] Select `Core Verbs`, click `Conjugate`, and show the mini conjugation panel.
- [ ] Go to Drill and show the 12-stage training path.
- [ ] Go offline and reload the page to show demo resilience.
