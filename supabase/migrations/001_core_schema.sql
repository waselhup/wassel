-- Enable extensions
create extension if not exists "pgcrypto";

-- Profiles (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  full_name text,
  avatar_url text,
  company_name text,
  job_title text,
  linkedin_url text,
  phone text,
  timezone text default 'Asia/Riyadh',
  locale text default 'ar' check (locale in ('ar', 'en')),
  subscription_tier text default 'free' check (subscription_tier in ('free', 'starter', 'pro', 'enterprise')),
  subscription_status text default 'inactive' check (subscription_status in ('active', 'inactive', 'past_due', 'canceled')),
  credits_remaining integer default 25,
  monthly_credits integer default 25,
  is_admin boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Teams (multi-tenant)
create table public.teams (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  slug text unique not null,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  subscription_tier text default 'free' check (subscription_tier in ('free', 'starter', 'pro', 'enterprise')),
  credits_remaining integer default 25,
  settings jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Team Members
create table public.team_members (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz default now(),
  unique(team_id, user_id)
);

-- Campaigns
create table public.campaigns (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  name text not null,
  description text,
  status text default 'draft' check (status in ('draft', 'active', 'paused', 'completed', 'archived')),
  type text not null check (type in ('invitation', 'message', 'invitation_message', 'visit', 'email_finder', 'combined')),
  configuration jsonb not null default '{}',
  schedule_settings jsonb default '{}',
  stats jsonb default '{"total_leads": 0, "completed": 0, "pending": 0, "failed": 0}',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  started_at timestamptz,
  completed_at timestamptz
);

-- Campaign Steps (sequence)
create table public.campaign_steps (
  id uuid default gen_random_uuid() primary key,
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  step_number integer not null,
  step_type text not null check (step_type in ('visit', 'follow', 'invitation', 'message', 'email', 'delay', 'condition')),
  name text not null,
  configuration jsonb not null,
  delay_hours integer default 0,
  created_at timestamptz default now()
);

-- Leads
create table public.leads (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  linkedin_id text,
  linkedin_url text not null,
  profile_data jsonb not null default '{}',
  first_name text,
  last_name text,
  full_name text generated always as (coalesce(first_name, '') || ' ' || coalesce(last_name, '')) stored,
  headline text,
  company text,
  industry text,
  location text,
  email text,
  phone text,
  website text,
  status text default 'new' check (status in ('new', 'in_progress', 'completed', 'failed', 'skipped')),
  priority integer default 5 check (priority between 1 and 10),
  tags text[] default '{}',
  notes text,
  imported_by uuid references public.profiles(id) on delete set null,
  imported_at timestamptz default now(),
  last_activity_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(team_id, linkedin_url)
);

-- Action Queue (human-in-the-loop)
create table public.action_queue (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  lead_id uuid references public.leads(id) on delete cascade not null,
  step_id uuid references public.campaign_steps(id) on delete set null,
  action_type text not null check (action_type in ('visit', 'follow', 'invitation', 'message', 'email')),
  status text default 'pending' check (status in ('pending', 'ready', 'completed', 'failed', 'skipped')),
  content text,
  personalized_content text,
  scheduled_at timestamptz,
  executed_at timestamptz,
  requires_approval boolean default true,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  result_data jsonb,
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Message Templates
create table public.message_templates (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  name text not null,
  category text,
  subject text,
  content text not null,
  variables text[] default '{}',
  is_public boolean default false,
  usage_count integer default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- Events (analytics)
create table public.events (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- Credit Transactions
create table public.credit_transactions (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete set null,
  amount integer not null,
  type text not null check (type in ('purchase', 'usage', 'refund', 'bonus', 'monthly_reset')),
  description text,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- Create indexes for performance
create index idx_profiles_email on public.profiles(email);
create index idx_teams_owner_id on public.teams(owner_id);
create index idx_team_members_user_id on public.team_members(user_id);
create index idx_campaigns_team_id on public.campaigns(team_id);
create index idx_leads_team_id on public.leads(team_id);
create index idx_leads_campaign_id on public.leads(campaign_id);
create index idx_action_queue_team_id on public.action_queue(team_id);
create index idx_action_queue_status on public.action_queue(status);
create index idx_events_team_id on public.events(team_id);
create index idx_credit_transactions_team_id on public.credit_transactions(team_id);
