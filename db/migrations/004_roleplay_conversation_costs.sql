ALTER TABLE roleplay_conversation_passes
  ADD COLUMN IF NOT EXISTS realtime_model TEXT,
  ADD COLUMN IF NOT EXISTS usage JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_source TEXT NOT NULL DEFAULT 'client_estimate',
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ended_reason TEXT;

CREATE INDEX IF NOT EXISTS roleplay_conversation_passes_cost_idx
  ON roleplay_conversation_passes (learner_id, estimated_cost_usd DESC, client_created_at DESC);
