-- Add missing INSERT policy for profiles table
-- This allows users to create their own profile during signup
-- and allows service role to create profiles for admin operations

create policy "Users insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Service role insert profiles"
  on public.profiles for insert
  with check (auth.role() = 'service_role');

-- Add missing INSERT policy for teams
-- Allow service role to create teams for admin operations
create policy "Service role insert teams"
  on public.teams for insert
  with check (auth.role() = 'service_role');

-- Add missing INSERT policy for team_members
-- Allow service role to create team members for admin operations
create policy "Service role insert team members"
  on public.team_members for insert
  with check (auth.role() = 'service_role');
