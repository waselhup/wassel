-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  
  -- Create default team
  insert into public.teams (name, slug, owner_id)
  values (
    'فريق ' || coalesce(new.raw_user_meta_data->>'full_name', 'الافتراضي'),
    'team-' || new.id,
    new.id
  );
  
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Credit deduction with balance check
create or replace function public.deduct_credits(
  p_team_id uuid,
  p_amount integer,
  p_description text default null
) returns boolean as $$
declare
  v_current_credits integer;
begin
  select credits_remaining into v_current_credits
  from public.teams where id = p_team_id;
  
  if v_current_credits < p_amount then
    return false;
  end if;
  
  update public.teams
  set credits_remaining = credits_remaining - p_amount
  where id = p_team_id;
  
  insert into public.credit_transactions (team_id, amount, type, description)
  values (p_team_id, -p_amount, 'usage', p_description);
  
  return true;
end;
$$ language plpgsql security definer;

-- Monthly credit reset (cron job)
create or replace function public.reset_monthly_credits()
returns void as $$
begin
  update public.profiles
  set credits_remaining = monthly_credits
  where subscription_status = 'active';
end;
$$ language plpgsql security definer;

-- Get current user profile
create or replace function public.get_current_user_profile()
returns public.profiles as $$
declare
  v_profile public.profiles;
begin
  select * into v_profile
  from public.profiles
  where id = auth.uid();
  
  return v_profile;
end;
$$ language plpgsql security definer;

-- Get user's teams
create or replace function public.get_user_teams()
returns table (
  id uuid,
  name text,
  slug text,
  owner_id uuid,
  subscription_tier text,
  credits_remaining integer,
  settings jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  user_role text
) as $$
begin
  return query
  select 
    t.id,
    t.name,
    t.slug,
    t.owner_id,
    t.subscription_tier,
    t.credits_remaining,
    t.settings,
    t.created_at,
    t.updated_at,
    coalesce(tm.role, case when t.owner_id = auth.uid() then 'owner' else null end) as user_role
  from public.teams t
  left join public.team_members tm on t.id = tm.team_id and tm.user_id = auth.uid()
  where t.owner_id = auth.uid() or tm.user_id = auth.uid();
end;
$$ language plpgsql security definer;
