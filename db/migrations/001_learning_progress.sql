CREATE TABLE IF NOT EXISTS learners (
  learner_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS devices (
  device_id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(learner_id) ON DELETE CASCADE,
  user_agent TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learning_attempts (
  event_id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(learner_id) ON DELETE CASCADE,
  device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  stage_key TEXT NOT NULL,
  ok BOOLEAN,
  assisted BOOLEAN NOT NULL DEFAULT false,
  latency_ms INTEGER,
  error_type TEXT,
  lesson_id TEXT,
  scenario_id TEXT,
  due_at TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  client_created_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learning_snapshots (
  learner_id TEXT NOT NULL REFERENCES learners(learner_id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  readiness INTEGER NOT NULL,
  delayed_recall INTEGER NOT NULL,
  due_count INTEGER NOT NULL,
  overdue_count INTEGER NOT NULL,
  roleplay_misses INTEGER NOT NULL,
  average_response_ms INTEGER NOT NULL,
  touched_count INTEGER NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (learner_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS sync_cursors (
  learner_id TEXT NOT NULL REFERENCES learners(learner_id) ON DELETE CASCADE,
  device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  last_event_id TEXT,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (learner_id, device_id)
);

CREATE INDEX IF NOT EXISTS learning_attempts_learner_received_idx
  ON learning_attempts (learner_id, received_at DESC);
CREATE INDEX IF NOT EXISTS learning_attempts_item_stage_idx
  ON learning_attempts (learner_id, item_id, stage_key);
CREATE INDEX IF NOT EXISTS learning_attempts_due_idx
  ON learning_attempts (learner_id, due_at);
CREATE INDEX IF NOT EXISTS learning_attempts_error_idx
  ON learning_attempts (learner_id, error_type)
  WHERE error_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS learning_attempts_scenario_idx
  ON learning_attempts (learner_id, scenario_id)
  WHERE scenario_id IS NOT NULL;

INSERT INTO learners (learner_id, display_name)
VALUES ('joe', 'Joe')
ON CONFLICT (learner_id) DO NOTHING;
