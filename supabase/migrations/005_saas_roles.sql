-- Migration 005: Add SaaS role column to profiles
-- Adds role-based access control for multi-user SaaS
-- Roles: super_admin (platform owner), client_user (SaaS customer)

-- 1. Add role column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'client_user'
  CHECK (role IN ('super_admin', 'client_user'));

-- 2. Migrate existing is_admin flags
UPDATE profiles SET role = 'super_admin' WHERE is_admin = true AND role = 'client_user';

-- 3. Create function to auto-create team + membership on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user_team()
RETURNS TRIGGER AS $$
DECLARE
  new_team_id UUID;
  user_slug TEXT;
BEGIN
  -- Only auto-create team for client_user (super_admin manages existing teams)
  IF NEW.role = 'client_user' THEN
    -- Generate a unique slug from email
    user_slug := LOWER(REPLACE(SPLIT_PART(NEW.email, '@', 1), '.', '-')) || '-' || SUBSTRING(NEW.id::TEXT, 1, 8);

    -- Create team
    INSERT INTO public.teams (name, slug, owner_id)
    VALUES (
      COALESCE(NEW.full_name, SPLIT_PART(NEW.email, '@', 1)) || '''s Workspace',
      user_slug,
      NEW.id
    )
    RETURNING id INTO new_team_id;

    -- Add user as team owner
    INSERT INTO public.team_members (team_id, user_id, role)
    VALUES (new_team_id, NEW.id, 'owner');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create trigger (only fires on INSERT to profiles)
DROP TRIGGER IF EXISTS on_profile_created_create_team ON public.profiles;
CREATE TRIGGER on_profile_created_create_team
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_team();
