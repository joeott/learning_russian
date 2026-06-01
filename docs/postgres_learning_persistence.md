# Postgres Learning Persistence

The app remains offline-first: study progress is still written to browser
`localStorage` immediately so drills work without a server. Postgres adds durable
cross-session storage, queryable statistics, and backup/sync for long-term
learning.

## What is persisted

- every graded attempt as an append-only event
- learner/device provenance
- item id, stage, lesson, scenario, success/failure, assisted status
- latency, due date, error type, repair focus, and role-play criteria payloads
- daily readiness snapshots
- adaptive Elo-style learner skill ratings
- adaptive item/stage difficulty ratings
- daily metric snapshots for mission ability, grammar control, n+1 fit, and friction
- speech-evaluation transcript, score, verdict, provider, and suggested repair
  type when pronunciation or spoken Russian text-entry analysis is accepted

Audio recordings, base64 audio payloads, and sonograph data are intentionally
not persisted.

## Local setup

```bash
createdb zastolom
export DATABASE_URL=postgres://localhost/zastolom
npm run db:migrate
npm run sync:serve
```

The sync API listens on `http://127.0.0.1:8787` by default. Override with:

```bash
export ZASTOLOM_SYNC_PORT=8790
export ZASTOLOM_LEARNER_ID=joe
```

Speech transcription uses server-side OpenAI credentials loaded from AWS
Secrets Manager through the system AWS CLI credentials. Store the required API
keys once with:

```bash
export OPENAI_API_KEY=...
export ELEVENLABS_API_KEY=...
tools/zastolom secrets put --secret-id /zastolom/dev/api-keys
```

At runtime the server reads `$OPENAI_API_KEY` first, then
`$ZASTOLOM_API_KEYS_SECRET_ID` or `/zastolom/dev/api-keys` via:

```bash
aws secretsmanager get-secret-value --secret-id /zastolom/dev/api-keys
```

The CLI wrapper is:

```bash
DATABASE_URL=postgres://localhost/zastolom tools/zastolom sync-server
```

The browser does not contact Postgres by default during demos or offline
replays. Enable sync explicitly in DevTools once the sync server is running:

```js
localStorage.setItem("zastolom.russian_family_visit.v2.sync_api", "http://127.0.0.1:8787");
location.reload();
```

## API

- `GET /api/health`
- `POST /api/learning/events`
- `GET /api/learning/state?learner_id=joe`
- `GET /api/learning/metrics?learner_id=joe`
- `GET /api/learning/recommendations?learner_id=joe&limit=20`
- `POST /api/learning/snapshots`
- `POST /api/speech/evaluate`
- `POST /api/realtime/session`
- `POST /api/realtime/call`

Events are idempotent by `event_id`, so retrying a failed sync is safe.

`POST /api/speech/evaluate` accepts a short recorded audio payload as
`audio_base64` plus `item_id`, `stage_key`, `target_ru`, and `target_ru_plain`.
It is used by pronunciation plus the Russian text-entry stages (`cloze`,
`conjugate`, `dictation`, `produce`, and back-translation rebuild). It returns a
derived transcript, normalized target/transcript, similarity score,
`correct|close|repair` verdict, provider, and suggested error type. The request
audio is passed to the transcription provider only for that request and is not
written to Postgres.

`POST /api/realtime/session` creates an OpenAI Realtime ephemeral client secret
for live browser role-play. `POST /api/realtime/call` accepts browser WebRTC SDP,
adds the role-play session configuration server-side, and returns the OpenAI SDP
answer. The live role-play default model is `gpt-realtime-2` with
`audio.output.voice` set to `marin`. The browser never receives the long-lived
OpenAI API key.

## Adaptive metrics

The browser asset `web/learning_metrics.js` and the sync-server copy
`scripts/learning_metrics.cjs` use the same Elo-style math. Each graded attempt
updates:

- learner skill ratings such as `stage:listen`, `structure:grammar:*`, and
  `mission:core`
- item/stage difficulty such as `firs001:produce`
- an expected-success estimate used to place work into `rescue`, `n+1`,
  `consolidate`, or `too_easy`

The target growth band is `0.58–0.78` predicted success. The app treats that as
the operational version of `n+1`: still mostly comprehensible, but just above
the learner's current automatic control.

## Active analysis engine

The browser keeps a local analysis engine active while the app is open. It runs
on startup, every 45 seconds, after each graded attempt, and whenever the tab
becomes visible again. The latest cycle is persisted in
`zastolom.russian_family_visit.v2.analysis_state` with:

- current mission/statistics rollup
- target n+1 band
- next recommended item/stage
- active flags such as overdue reviews, high friction, low confidence, or weak
  n+1 fit

This is intentionally local-first so Joe can study at full speed with or without
Postgres. When sync is enabled, the same attempt payloads carry adaptive
metadata to Postgres so the server can publish durable metric snapshots.

The published metrics are internal learning signals, not official CEFR/ACTFL
certifications:

- `missionAbility`: weighted ability across mission-critical structures
- `grammarControl`: rating across grammar and verb structures
- `listeningDiscrimination`: listening/dictation ability
- `productionControl`: produce/back-translate/role-play ability
- `nPlusOneFit`: share of recent attempts in the target growth band
- `frictionIndex`: share of recent attempts with a miss, assistance, or slow
  latency
