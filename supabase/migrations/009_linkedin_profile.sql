-- Add profile_picture_url and headline to linkedin_connections
ALTER TABLE linkedin_connections
  ADD COLUMN IF NOT EXISTS profile_picture_url TEXT,
  ADD COLUMN IF NOT EXISTS headline TEXT;

-- Also add user_id column if not exists (some older schemas reference client_id only)
ALTER TABLE linkedin_connections
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- If the constraint on client_id is NOT NULL and no user_id exists, we need user_id
-- for the new profile API endpoint query
CREATE INDEX IF NOT EXISTS idx_linkedin_connections_user ON linkedin_connections(user_id);
