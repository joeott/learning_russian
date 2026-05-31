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

Audio recordings and sonograph data are intentionally not persisted.

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
- `POST /api/learning/snapshots`

Events are idempotent by `event_id`, so retrying a failed sync is safe.
