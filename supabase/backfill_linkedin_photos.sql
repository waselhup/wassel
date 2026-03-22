-- ============================================================
-- Backfill: Copy LinkedIn profile photos from auth.users
-- to linkedin_connections for existing users
-- Run this in Supabase SQL Editor
-- ============================================================

-- Step 1: Backfill profile_picture_url from auth.users metadata
UPDATE linkedin_connections lc
SET profile_picture_url = COALESCE(
  lc.profile_picture_url,
  (
    SELECT u.raw_user_meta_data->>'picture'
    FROM auth.users u
    WHERE u.id = lc.user_id
    LIMIT 1
  ),
  (
    SELECT u.raw_user_meta_data->>'avatar_url'
    FROM auth.users u
    WHERE u.id = lc.user_id
    LIMIT 1
  )
)
WHERE lc.profile_picture_url IS NULL
  AND lc.user_id IS NOT NULL;

-- Step 2: If linkedin_connections has no user_id,
-- try matching via team_id + team_members
UPDATE linkedin_connections lc
SET profile_picture_url = COALESCE(
  lc.profile_picture_url,
  (
    SELECT u.raw_user_meta_data->>'picture'
    FROM auth.users u
    INNER JOIN team_members tm ON tm.user_id = u.id
    WHERE tm.team_id = (
      SELECT c.team_id FROM clients c WHERE c.id = lc.client_id LIMIT 1
    )
    LIMIT 1
  )
)
WHERE lc.profile_picture_url IS NULL
  AND lc.user_id IS NULL;

-- Verify results
SELECT
  id,
  linkedin_name,
  profile_picture_url,
  headline,
  user_id
FROM linkedin_connections
ORDER BY updated_at DESC;
