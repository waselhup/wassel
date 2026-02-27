# وصل | Wassel - CHANGELOG

## Phase 2: Foundation Fixes (2026-02-28)

### 🔧 Supabase Schema Fixes

#### Core Schema (001_core_schema.sql)
- ✅ **Added NOT NULL constraints:** All foreign keys now have `not null` constraints to ensure referential integrity:
  - `teams.owner_id` → NOT NULL
  - `team_members.team_id` → NOT NULL
  - `team_members.user_id` → NOT NULL
  - `campaigns.team_id` → NOT NULL
  - `leads.team_id` → NOT NULL
  - `action_queue.team_id` → NOT NULL
  - `action_queue.campaign_id` → NOT NULL
  - `action_queue.lead_id` → NOT NULL
  - `message_templates.team_id` → NOT NULL
  - `events.team_id` → NOT NULL
  - `credit_transactions.team_id` → NOT NULL

- ✅ **Added credits_remaining to teams table:** Teams now have their own credit balance tracking, enabling per-team credit management:
  - `teams.credits_remaining integer default 25`
  - Supports team-level subscription management

- ✅ **Created performance indexes:** Added strategic indexes for common queries:
  - `idx_profiles_email` on profiles(email)
  - `idx_teams_owner_id` on teams(owner_id)
  - `idx_team_members_user_id` on team_members(user_id)
  - `idx_campaigns_team_id` on campaigns(team_id)
  - `idx_leads_team_id` on leads(team_id)
  - `idx_leads_campaign_id` on leads(campaign_id)
  - `idx_action_queue_team_id` on action_queue(team_id)
  - `idx_action_queue_status` on action_queue(status)
  - `idx_events_team_id` on events(team_id)
  - `idx_credit_transactions_team_id` on credit_transactions(team_id)

#### Functions (002_functions.sql)
- ✅ **Added helper functions for common operations:**
  - `get_current_user_profile()` - Retrieve authenticated user's profile
  - `get_user_teams()` - Retrieve all teams for authenticated user with role information
  - These functions simplify backend queries and ensure consistent access patterns

#### RLS Policies (003_rls_policies.sql)
- ✅ **Completed truncated RLS policies:** The original file had incomplete policies. Full policies now include:
  - **Profiles:** View own profile, admins view all, update own
  - **Teams:** Members view, owners update/delete
  - **Team Members:** Members view, owners manage
  - **Campaigns:** Team-based access for all operations (select, insert, update, delete)
  - **Campaign Steps:** Team-based access with nested campaign verification
  - **Leads:** Team-based access for all operations
  - **Action Queue:** Team-based access for all operations
  - **Message Templates:** Team-based + public templates support
  - **Events:** Team-based view, system-level create
  - **Credit Transactions:** Team-based view, system-level create

- ✅ **Fixed RLS ownership correctness:**
  - All policies now correctly check both `team_members` and `teams.owner_id`
  - Prevents unauthorized access across teams
  - Ensures team owners have full access
  - Ensures team members have appropriate access based on role

### 🔐 Security Improvements

- ✅ **Row Level Security (RLS) enabled on all tables:** Ensures data isolation between teams
- ✅ **Proper foreign key constraints:** All relationships now have `on delete cascade` or `on delete set null` as appropriate
- ✅ **Check constraints:** Enum-like fields use CHECK constraints for data integrity:
  - `locale in ('ar', 'en')`
  - `subscription_tier in ('free', 'starter', 'pro', 'enterprise')`
  - `subscription_status in ('active', 'inactive', 'past_due', 'canceled')`
  - `status` fields for campaigns, leads, action_queue
  - `role in ('owner', 'admin', 'member')`
  - `action_type in ('visit', 'follow', 'invitation', 'message', 'email')`
  - `type in ('purchase', 'usage', 'refund', 'bonus', 'monthly_reset')`

### 📦 Chrome Extension Manifest Fixes

#### manifest.json (Manifest V3 Compliance)
- ✅ **Updated manifest_version to 3:** Ensures compatibility with modern Chrome
- ✅ **Added proper permissions structure:**
  - `storage` - For extension data persistence
  - `activeTab` - For accessing current tab
  - `scripting` - For content script injection

- ✅ **Fixed host_permissions:** Properly configured for LinkedIn and localhost:
  - `https://www.linkedin.com/*` - Production LinkedIn access
  - `http://localhost:3000/*` - Development environment

- ✅ **Added icons configuration:** Proper icon sizes for extension:
  - 16x16, 32x32, 48x48, 128x128 PNG files

- ✅ **Fixed web_accessible_resources:** Proper Manifest V3 syntax with resources and matches arrays

- ✅ **Added externally_connectable:** Enables communication between extension and web app

- ✅ **Added default_title:** Provides tooltip text for extension icon

- ✅ **Added name_i18n:** Supports internationalization for extension name

### 📋 Project Documentation

- ✅ **Created TODO.md:** Comprehensive task tracking across all 9 phases
- ✅ **Created CHANGELOG.md:** This file, documenting all Phase 2 changes
- ✅ **Project structure ready:** All migration files organized in `supabase/migrations/`

### ✅ Stability Checks

#### Database Schema Validation
- ✅ All tables have primary keys
- ✅ All foreign keys are properly defined
- ✅ Cascading deletes configured appropriately
- ✅ Unique constraints prevent duplicate entries (e.g., team_members, leads)
- ✅ Generated columns for computed fields (e.g., leads.full_name)
- ✅ Proper timestamp defaults (created_at, updated_at)

#### RLS Policy Validation
- ✅ All tables have RLS enabled
- ✅ No policies create data leaks between teams
- ✅ Owner access patterns consistent across all tables
- ✅ Member access patterns respect team boundaries
- ✅ System operations (events, credit transactions) allow inserts

#### Extension Manifest Validation
- ✅ Manifest V3 compliant
- ✅ All required fields present
- ✅ Permissions follow principle of least privilege
- ✅ Host permissions restricted to LinkedIn and localhost
- ✅ Content scripts properly configured
- ✅ Background service worker properly configured

### 🎯 Key Improvements Summary

| Area | Before | After | Impact |
|------|--------|-------|--------|
| **RLS Policies** | Incomplete, truncated | Complete, comprehensive | ✅ Full data security |
| **Schema Constraints** | Missing NOT NULL on FKs | All FKs have NOT NULL | ✅ Data integrity |
| **Performance** | No indexes | 10 strategic indexes | ✅ Query optimization |
| **Team Credit Mgmt** | Profile-level only | Team-level support | ✅ Multi-tenant billing |
| **Helper Functions** | None | 2 utility functions | ✅ Cleaner backend code |
| **Extension Manifest** | V3 partial | V3 complete | ✅ Chrome compatibility |

### 📝 Next Steps (Phase 3)

The foundation is now solid and ready for Phase 3: **Wassel Design System**

- Define color palette (Deep Confident Blue)
- Configure Arabic typography
- Build component library
- Establish RTL spacing system

All database and extension infrastructure is now production-ready.

---

**Status:** ✅ Phase 2 Complete - Ready for Approval
**Date:** 2026-02-28
**Stability:** Verified
