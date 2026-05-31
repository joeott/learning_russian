CREATE TABLE IF NOT EXISTS learning_skill_ratings (
  learner_id TEXT NOT NULL REFERENCES learners(learner_id) ON DELETE CASCADE,
  skill_key TEXT NOT NULL,
  rating NUMERIC(8,2) NOT NULL DEFAULT 1500,
  attempts INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  assisted_correct INTEGER NOT NULL DEFAULT 0,
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (learner_id, skill_key)
);

CREATE TABLE IF NOT EXISTS learning_item_stage_ratings (
  learner_id TEXT NOT NULL REFERENCES learners(learner_id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  stage_key TEXT NOT NULL,
  difficulty NUMERIC(8,2) NOT NULL DEFAULT 1500,
  attempts INTEGER NOT NULL DEFAULT 0,
  lapses INTEGER NOT NULL DEFAULT 0,
  last_expected_success NUMERIC(5,4) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (learner_id, item_id, stage_key)
);

CREATE TABLE IF NOT EXISTS learning_rating_events (
  event_id TEXT PRIMARY KEY REFERENCES learning_attempts(event_id) ON DELETE CASCADE,
  learner_id TEXT NOT NULL REFERENCES learners(learner_id) ON DELETE CASCADE,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learning_metric_snapshots (
  learner_id TEXT NOT NULL REFERENCES learners(learner_id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  mission_ability INTEGER NOT NULL,
  grammar_control INTEGER NOT NULL,
  listening_discrimination INTEGER NOT NULL,
  production_control INTEGER NOT NULL,
  n_plus_one_fit INTEGER NOT NULL,
  friction_index INTEGER NOT NULL,
  confidence INTEGER NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (learner_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS learning_skill_ratings_rating_idx
  ON learning_skill_ratings (learner_id, rating ASC);

CREATE INDEX IF NOT EXISTS learning_item_stage_ratings_difficulty_idx
  ON learning_item_stage_ratings (learner_id, difficulty DESC);

CREATE INDEX IF NOT EXISTS learning_metric_snapshots_recent_idx
  ON learning_metric_snapshots (learner_id, snapshot_date DESC);
