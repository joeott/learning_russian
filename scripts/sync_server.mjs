#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import pg from "pg";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { compareSpeech } from "./speech_eval.mjs";
import { runtimeSecret } from "./secrets.mjs";
import { transcribeRussianAudio } from "./speech_transcription.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.env.ZASTOLOM_SYNC_PORT || 8787);
const LEARNER_ID = process.env.ZASTOLOM_LEARNER_ID || "joe";
const DATABASE_URL = process.env.DATABASE_URL;
const require = createRequire(import.meta.url);
const METRICS = require("./learning_metrics.cjs");
const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2";
const REALTIME_VOICE = process.env.OPENAI_REALTIME_VOICE || "marin";

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

async function readText(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function validateSpeechBody(body) {
  const itemId = body.item_id || "";
  const target = body.target_ru_plain || body.target_ru || "";
  if (!itemId) return "item_id is required";
  if (!target) return "target_ru_plain is required";
  if (body.audio_base64 && String(body.audio_base64).length > 10 * 1024 * 1024) return "audio payload is too large";
  return "";
}

let contentCache = null;
function contentData() {
  if (!contentCache) {
    contentCache = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "content.json"), "utf8"));
  }
  return contentCache;
}

function roleplayContext(itemId, scenarioId) {
  const data = contentData();
  const items = data.items || [];
  const scenarios = data.scenarios || [];
  const tutorCards = data.tutor_cards || [];
  const criteria = data.roleplay_criteria || {};
  const item = items.find((row) => row.id === itemId);
  const scenario = scenarios.find((row) => row.id === scenarioId) ||
    scenarios.find((row) => (row.required_items || []).includes(itemId));
  const tutor = tutorCards.find((row) => scenario && row.scenario_id === scenario.id) ||
    tutorCards.find((row) => (row.required_items || []).includes(itemId));
  if (!item) return { error: "unknown item_id" };
  if (!scenario && !tutor) return { error: "unknown scenario_id" };
  return { item, scenario: scenario || null, tutor: tutor || null, criteria };
}

function criterionRows(ids, criteria) {
  return (ids || []).map((id) => ({
    id,
    label: criteria[id] && criteria[id].label ? criteria[id].label : id,
    error_type: criteria[id] && criteria[id].error_type ? criteria[id].error_type : "forgot_phrase",
  }));
}

function realtimeInstructions(ctx) {
  const item = ctx.item;
  const scenario = ctx.scenario || {};
  const tutor = ctx.tutor || {};
  const phrases = (tutor.required_phrases || []).map((p) => `- ${p.ru_plain || p.ru}: ${p.en}`).join("\n");
  const criteria = criterionRows(tutor.success_criteria || scenario.success_criteria || [], ctx.criteria)
    .map((c) => `- ${c.id}: ${c.label} (${c.error_type})`).join("\n");
  return `You are Joe's live Russian speaking tutor for the За столом family-visit course.

Run a two-phase roleplay.

Conversation mode:
- Stay mostly in Russian. Keep turns short and natural.
- You are playing: ${tutor.tutor_role || "host family member"}.
- Joe is: ${tutor.learner_role || "guest"}.
- Setting: ${tutor.setting || scenario.setting || "family dinner"}.
- Goal: ${tutor.goal || scenario.goal || item.en}.
- Start in character with one short Russian line and wait for Joe.
- Minimize interruption. Recast small errors naturally and continue.
- Explicitly correct only high-stakes errors: wrong register, feminine forms for Joe, or using На здоровье as a toast.
- If Joe is lost, prompt him to use a Russian repair phrase.
- Use only vocabulary from the current lesson when possible.

Required phrase target:
${phrases || `- ${item.ru_plain}: ${item.en}`}

Success criteria:
${criteria || "- stays_in_russian: stays in Russian"}

Debrief mode:
- When Joe says he is done, or the app asks for scoring, switch to brief English/Russian feedback.
- Then call submit_roleplay_score exactly once.
- Include missed phrases, pronunciation issues, one repair drill, and one replay prompt.
- Do not claim criteria were met unless Joe actually produced evidence in the conversation.`;
}

function realtimeTools(ctx) {
  const allowedCriteria = (ctx.tutor && ctx.tutor.success_criteria) ||
    (ctx.scenario && ctx.scenario.success_criteria) || [];
  const allowedErrorTypes = (ctx.tutor && ctx.tutor.allowed_error_types) ||
    (ctx.item && ctx.item.allowed_error_types) || ["forgot_phrase"];
  return [{
    type: "function",
    name: "submit_roleplay_score",
    description: "Submit the final roleplay score after the live conversation debrief.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        met: { type: "array", items: { type: "string", enum: allowedCriteria.length ? allowedCriteria : ["stays_in_russian"] } },
        missed: { type: "array", items: { type: "string", enum: allowedCriteria.length ? allowedCriteria : ["stays_in_russian"] } },
        summary: { type: "string" },
        pronunciation_issues: { type: "array", items: { type: "string" } },
        missed_phrases: { type: "array", items: { type: "string" } },
        repair_focus: { type: "string", enum: allowedErrorTypes.length ? allowedErrorTypes : ["forgot_phrase"] },
        replay_prompt: { type: "string" },
      },
      required: ["met", "missed", "summary", "pronunciation_issues", "missed_phrases", "repair_focus", "replay_prompt"],
    },
  }];
}

function realtimeSessionConfig(ctx) {
  return {
    type: "realtime",
    model: REALTIME_MODEL,
    output_modalities: ["audio"],
    instructions: realtimeInstructions(ctx),
    audio: {
      input: {
        transcription: { model: "gpt-4o-mini-transcribe", language: "ru" },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
          create_response: true,
          interrupt_response: true,
        },
      },
      output: {
        voice: REALTIME_VOICE,
        speed: 0.9,
      },
    },
    tools: realtimeTools(ctx),
    tool_choice: "auto",
    truncation: "auto",
  };
}

function safetyIdentifier(body) {
  const raw = `${body.learner_id || LEARNER_ID}:${body.device_id || "browser"}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

async function openaiKey() {
  const key = await runtimeSecret("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  return key;
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

async function loadRatings(client, learnerId) {
  const ratings = METRICS.emptyRatings();
  const skillRows = await client.query(
    `SELECT skill_key, rating, attempts, correct, assisted_correct, confidence, last_attempt_at
     FROM learning_skill_ratings
     WHERE learner_id = $1`,
    [learnerId]
  );
  const itemRows = await client.query(
    `SELECT item_id, stage_key, difficulty, attempts, lapses, last_expected_success, updated_at
     FROM learning_item_stage_ratings
     WHERE learner_id = $1`,
    [learnerId]
  );
  for (const row of skillRows.rows) {
    ratings.skills[row.skill_key] = {
      skill_key: row.skill_key,
      rating: Number(row.rating),
      attempts: Number(row.attempts || 0),
      correct: Number(row.correct || 0),
      assisted_correct: Number(row.assisted_correct || 0),
      confidence: Number(row.confidence || 0),
      last_attempt_at: row.last_attempt_at ? row.last_attempt_at.toISOString() : "",
    };
  }
  for (const row of itemRows.rows) {
    ratings.items[`${row.item_id}:${row.stage_key}`] = {
      item_id: row.item_id,
      stage_key: row.stage_key,
      difficulty: Number(row.difficulty),
      attempts: Number(row.attempts || 0),
      lapses: Number(row.lapses || 0),
      last_expected_success: Number(row.last_expected_success || 0),
      updated_at: row.updated_at ? row.updated_at.toISOString() : "",
    };
  }
  return ratings;
}

async function persistRatings(client, learnerId, ratings) {
  for (const row of Object.values(ratings.skills || {})) {
    await client.query(
      `INSERT INTO learning_skill_ratings (
        learner_id, skill_key, rating, attempts, correct, assisted_correct,
        confidence, last_attempt_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
      ON CONFLICT (learner_id, skill_key) DO UPDATE SET
        rating = EXCLUDED.rating,
        attempts = EXCLUDED.attempts,
        correct = EXCLUDED.correct,
        assisted_correct = EXCLUDED.assisted_correct,
        confidence = EXCLUDED.confidence,
        last_attempt_at = EXCLUDED.last_attempt_at,
        updated_at = now()`,
      [
        learnerId,
        row.skill_key,
        row.rating,
        row.attempts || 0,
        row.correct || 0,
        row.assisted_correct || 0,
        row.confidence || 0,
        row.last_attempt_at || null,
      ]
    );
  }
  for (const row of Object.values(ratings.items || {})) {
    await client.query(
      `INSERT INTO learning_item_stage_ratings (
        learner_id, item_id, stage_key, difficulty, attempts, lapses,
        last_expected_success, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,now())
      ON CONFLICT (learner_id, item_id, stage_key) DO UPDATE SET
        difficulty = EXCLUDED.difficulty,
        attempts = EXCLUDED.attempts,
        lapses = EXCLUDED.lapses,
        last_expected_success = EXCLUDED.last_expected_success,
        updated_at = now()`,
      [
        learnerId,
        row.item_id,
        row.stage_key,
        row.difficulty,
        row.attempts || 0,
        row.lapses || 0,
        row.last_expected_success || 0,
      ]
    );
  }
}

function metricRollup(ratings, recentAttempts) {
  const snapshot = METRICS.metricSnapshot(ratings);
  const rows = recentAttempts || [];
  const nPlusOne = rows.filter(row => {
    const expected = row.payload && row.payload.adaptive ? Number(row.payload.adaptive.expected_success || 0) : 0;
    return expected >= METRICS.TARGET_LOW && expected <= METRICS.TARGET_HIGH;
  }).length;
  const friction = rows.filter(row =>
    !row.ok ||
    row.assisted ||
    (row.latency_ms && row.latency_ms > METRICS.targetLatency(row.stage_key))
  ).length;
  return Object.assign(snapshot, {
    nPlusOneFit: rows.length ? Math.round(nPlusOne / rows.length * 100) : 0,
    frictionIndex: rows.length ? Math.round(friction / rows.length * 100) : 0,
  });
}

function ratedItemDto(row) {
  const expected = Number(row.last_expected_success || row.expected_success || 0);
  const difficulty = Number(row.difficulty);
  const attempts = Number(row.attempts || 0);
  const calibration = METRICS.calibration({ difficulty, attempts });
  return {
    item_id: row.item_id,
    stage_key: row.stage_key,
    difficulty,
    cefr: calibration.cefr,
    actfl: calibration.actfl,
    evidence: calibration.evidence,
    confidence: calibration.confidence,
    attempts,
    lapses: Number(row.lapses || 0),
    expected_success: expected,
    challenge_score: METRICS.challengeScore(expected),
    bucket: METRICS.bucket(expected),
    updated_at: row.updated_at,
  };
}

async function processAttemptRatings(learnerId, events) {
  if (!events.length) return { processed: 0 };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ratings = await loadRatings(client, learnerId);
    let processed = 0;
    for (const event of events) {
      const marker = await client.query(
        `INSERT INTO learning_rating_events (event_id, learner_id)
         VALUES ($1, $2)
         ON CONFLICT (event_id) DO NOTHING`,
        [event.event_id, learnerId]
      );
      if (!marker.rowCount) continue;
      const payload = event.payload || {};
      METRICS.applyAttempt(ratings, {
        item_id: event.item_id,
        stage_key: event.stage_key,
        ok: !!event.ok,
        assisted: !!event.assisted,
        latency_ms: Number(event.latency_ms || 0),
        meta: payload.item_meta || {},
        at: event.client_created_at || new Date().toISOString(),
      });
      processed += 1;
    }
    await persistRatings(client, learnerId, ratings);
    const recent = await client.query(
      `SELECT ok, assisted, latency_ms, stage_key, payload
       FROM learning_attempts
       WHERE learner_id = $1
       ORDER BY client_created_at DESC, received_at DESC
       LIMIT 200`,
      [learnerId]
    );
    const rollup = metricRollup(ratings, recent.rows);
    await client.query(
      `INSERT INTO learning_metric_snapshots (
        learner_id, snapshot_date, mission_ability, grammar_control,
        listening_discrimination, production_control, n_plus_one_fit,
        friction_index, confidence, payload
      )
      VALUES ($1,current_date,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (learner_id, snapshot_date) DO UPDATE SET
        mission_ability = EXCLUDED.mission_ability,
        grammar_control = EXCLUDED.grammar_control,
        listening_discrimination = EXCLUDED.listening_discrimination,
        production_control = EXCLUDED.production_control,
        n_plus_one_fit = EXCLUDED.n_plus_one_fit,
        friction_index = EXCLUDED.friction_index,
        confidence = EXCLUDED.confidence,
        payload = EXCLUDED.payload,
        updated_at = now()`,
      [
        learnerId,
        rollup.missionAbility,
        rollup.grammarControl,
        rollup.listeningDiscrimination,
        rollup.productionControl,
        rollup.nPlusOneFit,
        rollup.frictionIndex,
        rollup.confidence,
        rollup,
      ]
    );
    await client.query("COMMIT");
    return { processed };
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "42P01") return { processed: 0, warning: "learning metrics migration has not been applied" };
    throw error;
  } finally {
    client.release();
  }
}

function textArray(value) {
  return Array.isArray(value) ? value.filter((row) => typeof row === "string" && row.trim()).map((row) => row.trim()) : [];
}

function compactTranscript(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-80).map((row) => ({
    role: row && row.role === "assistant" ? "assistant" : row && row.role === "system" ? "system" : "user",
    text: String((row && row.text) || "").slice(0, 1000),
    at: String((row && row.at) || ""),
  })).filter((row) => row.text);
}

function transcriptText(rows) {
  return compactTranscript(rows)
    .map((row) => `${row.role}: ${row.text}`)
    .join("\n")
    .slice(0, 20000);
}

function usagePayload(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

async function persistRoleplayConversationPass(client, learnerId, deviceId, event) {
  if (event.stage_key !== "roleplay") return;
  const payload = event.payload || {};
  const roleplay = payload.roleplay || {};
  if (!roleplay || !roleplay.live_realtime) return;
  const met = textArray(roleplay.met);
  const missed = textArray(roleplay.missed);
  const transcript = compactTranscript(roleplay.transcript);
  const assisted = !!event.assisted || !!roleplay.assisted_rescue;
  const ok = !!event.ok;
  const stageComplete = ok && missed.length === 0 && met.length > 0 && !assisted;
  const nPlusOneReady = stageComplete && Number(payload.adaptive && payload.adaptive.expected_success || 0) >= 0.78;
  const usage = usagePayload(roleplay.usage);
  try {
    await client.query(
      `INSERT INTO roleplay_conversation_passes (
      event_id, learner_id, device_id, course_id, item_id, stage_key,
      scenario_id, lesson_id, ok, assisted, stage_complete, n_plus_one_ready,
      met_criteria, missed_criteria, summary, transcript, transcript_text,
      pronunciation_issues, missed_phrases, repair_focus, replay_prompt,
      payload, client_created_at, realtime_model, usage, estimated_cost_usd,
      cost_source, duration_ms, ended_reason
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)
    ON CONFLICT (event_id) DO UPDATE SET
      ok = EXCLUDED.ok,
      assisted = EXCLUDED.assisted,
      stage_complete = EXCLUDED.stage_complete,
      n_plus_one_ready = EXCLUDED.n_plus_one_ready,
      met_criteria = EXCLUDED.met_criteria,
      missed_criteria = EXCLUDED.missed_criteria,
      summary = EXCLUDED.summary,
      transcript = EXCLUDED.transcript,
      transcript_text = EXCLUDED.transcript_text,
      pronunciation_issues = EXCLUDED.pronunciation_issues,
      missed_phrases = EXCLUDED.missed_phrases,
      repair_focus = EXCLUDED.repair_focus,
      replay_prompt = EXCLUDED.replay_prompt,
      payload = EXCLUDED.payload,
      realtime_model = EXCLUDED.realtime_model,
      usage = EXCLUDED.usage,
      estimated_cost_usd = EXCLUDED.estimated_cost_usd,
      cost_source = EXCLUDED.cost_source,
      duration_ms = EXCLUDED.duration_ms,
      ended_reason = EXCLUDED.ended_reason`,
    [
      event.event_id,
      learnerId,
      deviceId,
      event.course_id || "russian_family_visit",
      event.item_id,
      event.stage_key,
      event.scenario_id || roleplay.scenario_id || null,
      event.lesson_id || null,
      ok,
      assisted,
      stageComplete,
      nPlusOneReady,
      met,
      missed,
      roleplay.summary || "",
      JSON.stringify(transcript),
      transcriptText(transcript),
      textArray(roleplay.pronunciation_issues),
      textArray(roleplay.missed_phrases),
      roleplay.repair_focus || "",
      roleplay.replay_prompt || "",
      JSON.stringify(payload),
      event.client_created_at || new Date().toISOString(),
      roleplay.realtime_model || "",
      JSON.stringify(usage),
      Number(roleplay.estimated_cost_usd || 0),
      roleplay.cost_source || "client_estimate",
      Math.max(0, Math.round(Number(roleplay.duration_ms || event.latency_ms || 0))),
      roleplay.ended_reason || "",
    ]
    );
  } catch (error) {
    if (error.code !== "42P01") throw error;
  }
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
    const insertedEvents = [];
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
      if (result.rowCount) {
        const insertedEvent = Object.assign({}, event, { course_id: event.course_id || "russian_family_visit" });
        insertedEvents.push(insertedEvent);
        await persistRoleplayConversationPass(client, learnerId, deviceId, insertedEvent);
      }
    }
    await client.query(
      `INSERT INTO sync_cursors (learner_id, device_id, last_event_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (learner_id, device_id) DO UPDATE
         SET last_event_id = EXCLUDED.last_event_id, last_synced_at = now()`,
      [learnerId, deviceId, events.length ? events[events.length - 1].event_id : null]
    );
    await client.query("COMMIT");
    const ratings = await processAttemptRatings(learnerId, insertedEvents);
    json(res, 200, { ok: true, received: events.length, inserted, ratings });
  } catch (error) {
    await client.query("ROLLBACK");
    json(res, 500, { error: error.message });
  } finally {
    client.release();
  }
}

async function metrics(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const learnerId = url.searchParams.get("learner_id") || LEARNER_ID;
  const client = await pool.connect();
  try {
    const ratings = await loadRatings(client, learnerId);
    const recent = await client.query(
      `SELECT ok, assisted, latency_ms, stage_key, payload
       FROM learning_attempts
       WHERE learner_id = $1
       ORDER BY client_created_at DESC, received_at DESC
       LIMIT 200`,
      [learnerId]
    );
    const rollup = metricRollup(ratings, recent.rows);
    json(res, 200, {
      learner_id: learnerId,
      metrics: rollup,
      skills: Object.values(ratings.skills || {}).sort((a, b) => a.rating - b.rating).slice(0, 50),
      items: Object.values(ratings.items || {}).sort((a, b) => b.difficulty - a.difficulty).slice(0, 50).map(ratedItemDto),
    });
  } finally {
    client.release();
  }
}

async function recommendations(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const learnerId = url.searchParams.get("learner_id") || LEARNER_ID;
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 20)));
  const rows = await pool.query(
    `SELECT item_id, stage_key, difficulty, attempts, lapses, last_expected_success, updated_at
     FROM learning_item_stage_ratings
     WHERE learner_id = $1
     ORDER BY
       CASE
         WHEN last_expected_success < 0.55 THEN 0
         WHEN last_expected_success BETWEEN 0.58 AND 0.78 THEN 1
         WHEN last_expected_success < 0.90 THEN 2
         ELSE 3
       END,
       lapses DESC,
       updated_at ASC
     LIMIT $2`,
    [learnerId, limit]
  );
  const recommendations = rows.rows.map(ratedItemDto).sort((a, b) => {
    const as = METRICS.recommendationSortKey(a);
    const bs = METRICS.recommendationSortKey(b);
    for (let i = 0; i < as.length; i++) if (as[i] !== bs[i]) return as[i] - bs[i];
    return a.item_id.localeCompare(b.item_id);
  });
  json(res, 200, {
    learner_id: learnerId,
    recommendations,
  });
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

async function speechEvaluate(req, res) {
  const body = await readJson(req);
  const invalid = validateSpeechBody(body);
  if (invalid) return json(res, 400, { error: invalid });
  let transcription = { provider: "unavailable", transcript: "", confidence: 0, error: "audio transcription unavailable" };
  if (body.audio_base64) {
    transcription = await transcribeRussianAudio({
      audio_base64: body.audio_base64,
      mime_type: body.mime_type || "audio/webm",
      filename: body.filename || `${body.item_id}.webm`,
      prompt: body.target_ru_plain || body.target_ru || "",
    });
  } else if (body.transcript) {
    transcription = { provider: "client", transcript: body.transcript, confidence: 0.75 };
  }
  const score = compareSpeech({
    transcript: transcription.transcript || "",
    target: body.target_ru_plain || body.target_ru || "",
    confidence: transcription.confidence || 0,
  });
  json(res, 200, Object.assign(score, {
    provider: transcription.provider,
    model: transcription.model || "",
    error: transcription.error || "",
    item_id: body.item_id,
    stage_key: body.stage_key || "pronounce",
  }));
}

async function realtimeSession(req, res) {
  const body = await readJson(req);
  const ctx = roleplayContext(body.item_id || "", body.scenario_id || "");
  if (ctx.error) return json(res, 400, { error: ctx.error });
  let key = "";
  try {
    key = await openaiKey();
  } catch (error) {
    return json(res, 503, { error: error.message });
  }
  const session = realtimeSessionConfig(ctx);
  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      "OpenAI-Safety-Identifier": safetyIdentifier(body),
    },
    body: JSON.stringify({
      expires_after: { anchor: "created_at", seconds: 600 },
      session,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.error && payload.error.message ? payload.error.message : `Realtime client secret failed (${response.status})`;
    return json(res, response.status, { error: message });
  }
  json(res, 200, {
    value: payload.value || (payload.client_secret && payload.client_secret.value) || "",
    expires_at: payload.expires_at || (payload.client_secret && payload.client_secret.expires_at) || 0,
    session: payload.session || session,
    model: session.model,
    voice: session.audio.output.voice,
    scenario_id: (ctx.scenario && ctx.scenario.id) || (ctx.tutor && ctx.tutor.scenario_id) || "",
  });
}

async function realtimeCall(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
  const itemId = url.searchParams.get("item_id") || "";
  const scenarioId = url.searchParams.get("scenario_id") || "";
  const deviceId = url.searchParams.get("device_id") || "";
  const learnerId = url.searchParams.get("learner_id") || LEARNER_ID;
  const ctx = roleplayContext(itemId, scenarioId);
  if (ctx.error) return json(res, 400, { error: ctx.error });
  const sdp = await readText(req);
  if (!sdp.trim()) return json(res, 400, { error: "SDP body is required" });
  let key = "";
  try {
    key = await openaiKey();
  } catch (error) {
    return json(res, 503, { error: error.message });
  }
  const fd = new FormData();
  const session = realtimeSessionConfig(ctx);
  fd.set("sdp", sdp);
  fd.set("session", JSON.stringify(session));
  const response = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "OpenAI-Safety-Identifier": safetyIdentifier({ learner_id: learnerId, device_id: deviceId }),
    },
    body: fd,
  });
  const answer = await response.text();
  if (!response.ok) {
    let message = answer;
    try {
      const payload = JSON.parse(answer);
      message = payload.error && payload.error.message ? payload.error.message : message;
    } catch (error) {}
    return json(res, response.status, { error: message || `Realtime call failed (${response.status})` });
  }
  res.writeHead(200, {
    "content-type": "application/sdp",
    "access-control-allow-origin": "*",
  });
  res.end(answer);
}

async function translateText(req, res) {
  const body = await readJson(req);
  const text = String(body.text || "").trim();
  if (!text) return json(res, 400, { error: "text is required" });
  if (text.length > 1200) return json(res, 400, { error: "text is too long" });
  let key = "";
  try {
    key = await openaiKey();
  } catch (error) {
    return json(res, 503, { error: error.message });
  }
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      "OpenAI-Safety-Identifier": safetyIdentifier(body),
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TRANSLATION_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: "Translate Russian family-table roleplay transcript turns into concise natural English. Return only the translation.",
        },
        { role: "user", content: text },
      ],
      max_output_tokens: 120,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.error && payload.error.message ? payload.error.message : `Translation failed (${response.status})`;
    return json(res, response.status, { error: message });
  }
  const translation = payload.output_text ||
    (payload.output || []).flatMap((item) => item.content || []).map((part) => part.text || "").join("").trim();
  json(res, 200, {
    translation,
    model: payload.model || process.env.OPENAI_TRANSLATION_MODEL || "gpt-4.1-mini",
    usage: payload.usage || {},
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") return json(res, 200, { ok: true });
    if (req.method === "GET" && req.url === "/api/health") return json(res, 200, { ok: true });
    if (req.method === "POST" && req.url === "/api/learning/events") return insertEvents(req, res);
    if (req.method === "POST" && req.url === "/api/learning/snapshots") return insertSnapshot(req, res);
    if (req.method === "POST" && req.url === "/api/speech/evaluate") return speechEvaluate(req, res);
    if (req.method === "POST" && req.url === "/api/translate") return translateText(req, res);
    if (req.method === "POST" && req.url === "/api/realtime/session") return realtimeSession(req, res);
    if (req.method === "POST" && req.url.startsWith("/api/realtime/call")) return realtimeCall(req, res);
    if (req.method === "GET" && req.url.startsWith("/api/learning/state")) return state(req, res);
    if (req.method === "GET" && req.url.startsWith("/api/learning/metrics")) return metrics(req, res);
    if (req.method === "GET" && req.url.startsWith("/api/learning/recommendations")) return recommendations(req, res);
    json(res, 404, { error: "not found" });
  } catch (error) {
    json(res, 500, { error: error.message });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`zastolom sync server listening on http://127.0.0.1:${PORT}`);
});
