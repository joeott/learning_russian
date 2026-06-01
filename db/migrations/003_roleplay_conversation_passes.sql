CREATE TABLE IF NOT EXISTS roleplay_conversation_passes (
  event_id TEXT PRIMARY KEY REFERENCES learning_attempts(event_id) ON DELETE CASCADE,
  learner_id TEXT NOT NULL REFERENCES learners(learner_id) ON DELETE CASCADE,
  device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  stage_key TEXT NOT NULL DEFAULT 'roleplay',
  scenario_id TEXT,
  lesson_id TEXT,
  ok BOOLEAN NOT NULL DEFAULT false,
  assisted BOOLEAN NOT NULL DEFAULT false,
  stage_complete BOOLEAN NOT NULL DEFAULT false,
  n_plus_one_ready BOOLEAN NOT NULL DEFAULT false,
  met_criteria TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  missed_criteria TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  summary TEXT,
  transcript JSONB NOT NULL DEFAULT '[]'::jsonb,
  transcript_text TEXT,
  pronunciation_issues TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  missed_phrases TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  repair_focus TEXT,
  replay_prompt TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  client_created_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS roleplay_conversation_passes_learner_recent_idx
  ON roleplay_conversation_passes (learner_id, client_created_at DESC, received_at DESC);

CREATE INDEX IF NOT EXISTS roleplay_conversation_passes_stage_idx
  ON roleplay_conversation_passes (learner_id, stage_key, stage_complete, n_plus_one_ready);

CREATE INDEX IF NOT EXISTS roleplay_conversation_passes_scenario_idx
  ON roleplay_conversation_passes (learner_id, scenario_id, client_created_at DESC)
  WHERE scenario_id IS NOT NULL;
