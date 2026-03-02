-- Add user_id column to agent_conversations for ownership tracking
ALTER TABLE agent_conversations
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for efficient lookup by user
CREATE INDEX IF NOT EXISTS idx_agent_conversations_user_id
  ON agent_conversations(user_id);

-- Backfill: existing conversations get no user_id (NULL is acceptable)
