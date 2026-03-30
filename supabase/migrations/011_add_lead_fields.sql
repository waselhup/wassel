-- Add missing fields to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS company TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;
