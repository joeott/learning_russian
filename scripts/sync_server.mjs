#!/usr/bin/env node
import http from "node:http";
import pg from "pg";

const PORT = Number(process.env.ZASTOLOM_SYNC_PORT || 8787);
const LEARNER_ID = process.env.ZASTOLOM_LEARNER_ID || "joe";
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(2);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

function json(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function ensureDevice(client, learnerId, deviceId, userAgent) {
  await client.query(
    `INSERT INTO learners (learner_id, display_name)
     VALUES ($1, $2)
     ON CONFLICT (learner_id) DO NOTHING`,
    [learnerId, learnerId]
  );
  await client.query(
    `INSERT INTO devices (device_id, learner_id, user_agent)
     VALUES ($1, $2, $3)
     ON CONFLICT (device_id) DO UPDATE
       SET last_seen_at = now(), user_agent = EXCLUDED.user_agent`,
    [deviceId, learnerId, userAgent || ""]
  );
}

async function insertEvents(req, res) {
  const body = await readJson(req);
  const learnerId = body.learner_id || LEARNER_ID;
  const deviceId = body.device_id;
  const events = Array.isArray(body.events) ? body.events : [];
  if (!deviceId) return json(res, 400, { error: "device_id is required" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureDevice(client, learnerId, deviceId, req.headers["user-agent"]);
    let inserted = 0;
    for (const event of events) {
      if (!event || !event.event_id || !event.item_id || !event.stage_key) continue;
      const result = await client.query(
        `INSERT INTO learning_attempts (
          event_id, learner_id, device_id, course_id, item_id, stage_key, ok,
          assisted, latency_ms, error_type, lesson_id, scenario_id, due_at,
          payload, client_created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        ON CONFLICT (event_id) DO NOTHING`,
        [
          event.event_id,
          learnerId,
          deviceId,
          event.course_id || "russian_family_visit",
          event.item_id,
          event.stage_key,
          typeof event.ok === "boolean" ? event.ok : null,
          !!event.assisted,
          Number.isFinite(event.latency_ms) ? Math.round(event.latency_ms) : null,
          event.error_type || null,
          event.lesson_id || null,
          event.scenario_id || null,
          event.due_at || null,
          event.payload || {},
          event.client_created_at || new Date().toISOString(),
        ]
      );
      inserted += result.rowCount;
    }
    await client.query(
      `INSERT INTO sync_cursors (learner_id, device_id, last_event_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (learner_id, device_id) DO UPDATE
         SET last_event_id = EXCLUDED.last_event_id, last_synced_at = now()`,
      [learnerId, deviceId, events.length ? events[events.length - 1].event_id : null]
    );
    await client.query("COMMIT");
    json(res, 200, { ok: true, received: events.length, inserted });
  } catch (error) {
    await client.query("ROLLBACK");
    json(res, 500, { error: error.message });
  } finally {
    client.release();
  }
}

async function insertSnapshot(req, res) {
  const body = await readJson(req);
  const learnerId = body.learner_id || LEARNER_ID;
  const snapshot = body.snapshot || body;
  const date = snapshot.date || new Date().toISOString().slice(0, 10);
  await pool.query(
    `INSERT INTO learning_snapshots (
      learner_id, snapshot_date, readiness, delayed_recall, due_count,
      overdue_count, roleplay_misses, average_response_ms, touched_count, payload
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (learner_id, snapshot_date) DO UPDATE SET
      readiness = EXCLUDED.readiness,
      delayed_recall = EXCLUDED.delayed_recall,
      due_count = EXCLUDED.due_count,
      overdue_count = EXCLUDED.overdue_count,
      roleplay_misses = EXCLUDED.roleplay_misses,
      average_response_ms = EXCLUDED.average_response_ms,
      touched_count = EXCLUDED.touched_count,
      payload = EXCLUDED.payload,
      updated_at = now()`,
    [
      learnerId,
      date,
      snapshot.readiness || 0,
      snapshot.delayedRecall || 0,
      snapshot.due || 0,
      snapshot.overdue || 0,
      snapshot.roleplayMisses || 0,
      snapshot.averageResponseMs || 0,
      snapshot.touched || 0,
      snapshot,
    ]
  );
  json(res, 200, { ok: true });
}

async function state(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const learnerId = url.searchParams.get("learner_id") || LEARNER_ID;
  const rows = await pool.query(
    `SELECT item_id, stage_key, ok, assisted, latency_ms, error_type, lesson_id,
            scenario_id, due_at, payload, client_created_at
     FROM learning_attempts
     WHERE learner_id = $1
     ORDER BY client_created_at ASC, received_at ASC`,
    [learnerId]
  );
  const items = {};
  for (const row of rows.rows) {
    items[row.item_id] = items[row.item_id] || { seen: 0, correct: 0, stages: {}, errors: {}, last_seen_at: "" };
    const item = items[row.item_id];
    const stage = item.stages[row.stage_key] || { seen: 0, correct: 0, latency_ms_total: 0, latency_count: 0 };
    item.seen += 1;
    stage.seen += 1;
    item.last_seen_at = row.client_created_at;
    stage.last_seen_at = row.client_created_at;
    if (row.ok) {
      item.correct += 1;
      stage.correct += 1;
    }
    if (row.latency_ms) {
      stage.last_latency_ms = row.latency_ms;
      stage.latency_ms_total += row.latency_ms;
      stage.latency_count += 1;
    }
    if (row.error_type) {
      item.errors[row.error_type] = (item.errors[row.error_type] || 0) + 1;
      stage.last_error_type = row.error_type;
    }
    if (row.due_at) stage.due_at = row.due_at;
    item.stages[row.stage_key] = stage;
  }
  json(res, 200, { learner_id: learnerId, attempts: rows.rowCount, items });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") return json(res, 200, { ok: true });
    if (req.method === "GET" && req.url === "/api/health") return json(res, 200, { ok: true });
    if (req.method === "POST" && req.url === "/api/learning/events") return insertEvents(req, res);
    if (req.method === "POST" && req.url === "/api/learning/snapshots") return insertSnapshot(req, res);
    if (req.method === "GET" && req.url.startsWith("/api/learning/state")) return state(req, res);
    json(res, 404, { error: "not found" });
  } catch (error) {
    json(res, 500, { error: error.message });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`zastolom sync server listening on http://127.0.0.1:${PORT}`);
});
