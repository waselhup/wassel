-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_steps enable row level security;
alter table public.leads enable row level security;
alter table public.action_queue enable row level security;
alter table public.message_templates enable row level security;
alter table public.events enable row level security;
alter table public.credit_transactions enable row level security;

-- ============================================================================
-- PROFILES POLICIES
-- ============================================================================

-- Users can view their own profile
create policy "Users view own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Admins can view all profiles
create policy "Admins view all profiles"
  on public.profiles for select
  using ((select is_admin from public.profiles where id = auth.uid()) = true);

-- Users can update their own profile
create policy "Users update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ============================================================================
-- TEAMS POLICIES
-- ============================================================================

-- Team owners and members can view their teams
create policy "Team members view teams"
  on public.teams for select
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.team_members
      where team_id = teams.id and user_id = auth.uid()
    )
  );

-- Only team owners can update team settings
create policy "Team owners update teams"
  on public.teams for update
  using (owner_id = auth.uid());

-- Only team owners can delete teams
create policy "Team owners delete teams"
  on public.teams for delete
  using (owner_id = auth.uid());

-- ============================================================================
-- TEAM MEMBERS POLICIES
-- ============================================================================

-- Team members can view team membership
create policy "Team members view team members"
  on public.team_members for select
  using (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = team_members.team_id and tm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.teams t
      where t.id = team_members.team_id and t.owner_id = auth.uid()
    )
  );

-- Team owners can manage team members
create policy "Team owners manage team members"
  on public.team_members for all
  using (
    exists (
      select 1 from public.teams
      where id = team_members.team_id and owner_id = auth.uid()
    )
  );

-- ============================================================================
-- CAMPAIGNS POLICIES
-- ============================================================================

-- Team members can view campaigns
create policy "Team members view campaigns"
  on public.campaigns for select
  using (
    exists (
      select 1 from public.team_members
      where team_id = campaigns.team_id and user_id = auth.uid()
    )
    or exists (
      select 1 from public.teams
      where id = campaigns.team_id and owner_id = auth.uid()
    )
  );

-- Team members can create campaigns
create policy "Team members create campaigns"
  on public.campaigns for insert
  with check (
    exists (
      select 1 from public.team_members
      where team_id = campaigns.team_id and user_id = auth.uid()
    )
    or exists (
      select 1 from public.teams
      where id = campaigns.team_id and owner_id = auth.uid()
    )
  );

-- Team members can update campaigns
create policy "Team members update campaigns"
  on public.campaigns for update
  using (
    exists (
      select 1 from public.team_members
      where team_id = campaigns.team_id and user_id = auth.uid()
    )
    or exists (
      select 1 from public.teams
      where id = campaigns.team_id and owner_id = auth.uid()
    )
  );

-- Team members can delete campaigns
create policy "Team members delete campaigns"
  on public.campaigns for delete
  using (
    exists (
      select 1 from public.team_members
      where team_id = campaigns.team_id and user_id = auth.uid()
    )
    or exists (
      select 1 from public.teams
      where id = campaigns.team_id and owner_id = auth.uid()
    )
  );

-- ============================================================================
-- CAMPAIGN STEPS POLICIES
-- ============================================================================

-- Team members can view campaign steps
create policy "Team members view campaign steps"
  on public.campaign_steps for select
  using (
    exists (
      select 1 from public.campaigns c
      where c.id = campaign_steps.campaign_id
      and (
        exists (
          select 1 from public.team_members
          where team_id = c.team_id and user_id = auth.uid()
        )
        or exists (
          select 1 from public.teams
          where id = c.team_id and owner_id = auth.uid()
        )
      )
    )
  );

-- Team members can manage campaign steps
create policy "Team members manage campaign steps"
  on public.campaign_steps for all
  using (
    exists (
      select 1 from public.campaigns c
      where c.id = campaign_steps.campaign_id
      and (
        exists (
          select 1 from public.team_members
          where team_id = c.team_id and user_id = auth.uid()
        )
        or exists (
          select 1 from public.teams
          where id = c.team_id and owner_id = auth.uid()
        )
      )
    )
  );

-- ============================================================================
-- LEADS POLICIES
-- ============================================================================

-- Team members can view leads
create policy "Team members view leads"
  on public.leads for select
  using (
    exists (
      select 1 from public.team_members
      where team_id = leads.team_id and user_id = auth.uid()
    )
    or exists (
      select 1 from public.teams
      where id = leads.team_id and owner_id = auth.uid()
    )
  );

-- Team members can create leads
create policy "Team members create leads"
  on public.leads for insert
  with check (
    exists (
      select 1 from public.team_members
      where team_id = leads.team_id and user_id = auth.uid()
    )
    or exists (
      select 1 from public.teams
      where id = leads.team_id and owner_id = auth.uid()
    )
  );

-- Team members can update leads
create policy "Team members update leads"
  on public.leads for update
  using (
    exists (
      select 1 from public.team_members
      where team_id = leads.team_id and user_id = auth.uid()
    )
    or exists (
      select 1 from public.teams
      where id = leads.team_id and owner_id = auth.uid()
    )
  );

-- Team members can delete leads
create policy "Team members delete leads"
  on public.leads for delete
  using (
    exists (
      select 1 from public.team_members
      where team_id = leads.team_id and user_id = auth.uid()
    )
    or exists (
      select 1 from public.teams
      where id = leads.team_id and owner_id = auth.uid()
    )
  );

-- ============================================================================
-- ACTION QUEUE POLICIES
-- ============================================================================

-- Team members can view action queue
create policy "Team members view action queue"
  on public.action_queue for select
  using (
    exists (
      select 1 from public.team_members
      where team_id = action_queue.team_id and user_id = auth.uid()
    )
    or exists (
      select 1 from public.teams
      where id = action_queue.team_id and owner_id = auth.uid()
    )
  );

-- Team members can create action queue items
create policy "Team members create action queue"
  on public.action_queue for insert
  with check (
    exists (
      select 1 from public.team_members
      where team_id = action_queue.team_id and user_id = auth.uid()
    )
    or exists (
      select 1 from public.teams
      where id = action_queue.team_id and owner_id = auth.uid()
    )
  );

-- Team members can update action queue items
create policy "Team members update action queue"
  on public.action_queue for update
  using (
    exists (
      select 1 from public.team_members
      where team_id = action_queue.team_id and user_id = auth.uid()
    )
    or exists (
      select 1 from public.teams
      where id = action_queue.team_id and owner_id = auth.uid()
    )
  );

-- ============================================================================
-- MESSAGE TEMPLATES POLICIES
-- ============================================================================

-- Team members can view team templates
create policy "Team members view message templates"
  on public.message_templates for select
  using (
    team_id is null
    or exists (
      select 1 from public.team_members
      where team_id = message_templates.team_id and user_id = auth.uid()
    )
    or exists (
      select 1 from public.teams
      where id = message_templates.team_id and owner_id = auth.uid()
    )
  );

-- Team members can create templates
create policy "Team members create message templates"
  on public.message_templates for insert
  with check (
    team_id is null
    or exists (
      select 1 from public.team_members
      where team_id = message_templates.team_id and user_id = auth.uid()
    )
    or exists (
      select 1 from public.teams
      where id = message_templates.team_id and owner_id = auth.uid()
    )
  );

-- Team members can update their templates
create policy "Team members update message templates"
  on public.message_templates for update
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.teams
      where id = message_templates.team_id and owner_id = auth.uid()
    )
  );

-- ============================================================================
-- EVENTS POLICIES
-- ============================================================================

-- Team members can view events
create policy "Team members view events"
  on public.events for select
  using (
    exists (
      select 1 from public.team_members
      where team_id = events.team_id and user_id = auth.uid()
    )
    or exists (
      select 1 from public.teams
      where id = events.team_id and owner_id = auth.uid()
    )
  );

-- System can create events
create policy "System creates events"
  on public.events for insert
  with check (true);

-- ============================================================================
-- CREDIT TRANSACTIONS POLICIES
-- ============================================================================

-- Team members can view credit transactions
create policy "Team members view credit transactions"
  on public.credit_transactions for select
  using (
    exists (
      select 1 from public.team_members
      where team_id = credit_transactions.team_id and user_id = auth.uid()
    )
    or exists (
      select 1 from public.teams
      where id = credit_transactions.team_id and owner_id = auth.uid()
    )
  );

-- System can create transactions
create policy "System creates credit transactions"
  on public.credit_transactions for insert
  with check (true);
