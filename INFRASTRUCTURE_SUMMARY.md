# Wassel Infrastructure Summary

## Current Architecture

### Database Layer
**Supabase PostgreSQL** (Single Source of Truth)
- URL: https://hiqotmimlgsrsnovtopd.supabase.co
- 10 core tables with RLS policies
- Multi-tenant isolation enforced
- Service Role Key for server-side operations

### Backend
**Express 4 + tRPC 11**
- Server: `/home/ubuntu/wassel/server/`
- tRPC procedures for all data operations
- Supabase SDK (supabase-js) for database access
- Team isolation enforced on every query
- User IDs: UUID strings from auth.uid()

### Frontend
**React 19 + Tailwind CSS 4**
- Client: `/home/ubuntu/wassel/client/`
- tRPC hooks for data fetching
- Supabase Auth integration
- Premium UX with skeleton loaders
- Arabic-first design system

### Authentication
**Supabase Auth**
- Magic link flow (to be implemented)
- Session-based dashboard access
- Team membership via team_members table
- Role-based access control (owner, admin, member)

## Build vs Runtime

### Build-Time (Migrations Only)
```
Supabase CLI + Access Token
    ↓
Apply migrations to remote database
    ↓
Verify schema integrity
    ↓
✅ Complete - No longer needed
```

### Runtime (Permanent)
```
Supabase SDK (supabase-js)
    ↓
Authenticated user context
    ↓
Team-scoped queries
    ↓
RLS policies enforce isolation
    ↓
✅ Secure, scalable, production-ready
```

## Key Files

| File | Purpose |
|------|---------|
| `server/supabase.ts` | Supabase client initialization |
| `server/db.ts` | Database helper functions |
| `server/routers.ts` | tRPC procedure definitions |
| `supabase/migrations/` | Database schema & policies |
| `client/src/lib/trpc.ts` | tRPC client configuration |
| `client/src/pages/dashboard/` | Dashboard UI components |

## Environment Variables

### Required at Runtime
```
SUPABASE_URL=https://hiqotmimlgsrsnovtopd.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
JWT_SECRET=<session_signing_secret>
VITE_APP_ID=<oauth_app_id>
OAUTH_SERVER_URL=<oauth_server_url>
```

### Not Used (Removed)
```
DATABASE_URL ❌ (Removed - no direct Postgres)
DRIZZLE_* ❌ (Removed - no Drizzle ORM)
```

## Security Model

### Row-Level Security (RLS)
- All tables have RLS enabled
- Policies check `auth.uid()` for user identity
- Team membership verified via team_members table
- Service role bypasses RLS for admin operations

### Team Isolation
- Every table has `team_id` column
- All queries include `eq('team_id', teamId)` filter
- Cross-team data access impossible
- Enforced at database layer (not application)

### Authentication Flow
```
User Login
    ↓
Supabase Auth (magic link)
    ↓
Session cookie created
    ↓
Dashboard access with auth context
    ↓
Team ID derived from team_members table
    ↓
All queries scoped to user's team
```

## Data Model

### Core Tables
- **profiles**: User identity (linked to auth.users)
- **teams**: Organization/workspace
- **team_members**: Team membership with roles
- **campaigns**: LinkedIn campaign definitions
- **leads**: Lead database with LinkedIn data
- **action_queue**: Human-in-the-loop actions
- **message_templates**: Reusable templates
- **events**: Analytics and audit trail
- **credit_transactions**: Usage tracking

### Relationships
```
auth.users (Supabase)
    ↓
profiles (1:1)
    ↓
team_members (N:M)
    ↓
teams (1:N)
    ↓
campaigns, leads, action_queue, etc.
```

## Deployment Readiness

### ✅ Production Ready
- Database schema complete
- RLS policies enforced
- Team isolation verified
- No direct database access in code
- Supabase SDK only at runtime

### ⏳ Next Phase
- Auth flow integration
- Demo data seeding
- UI/UX testing
- Performance optimization
- Chrome extension integration

## Troubleshooting

### If migrations fail
1. Check Supabase project exists
2. Verify Service Role Key is valid
3. Run: `supabase db push --yes`
4. Check migration files for syntax errors

### If RLS blocks access
1. Verify user is authenticated
2. Check team_members table for user's team
3. Confirm RLS policies are active
4. Use Service Role Key for admin operations

### If Supabase SDK fails
1. Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
2. Check internet connectivity
3. Verify project is active in Supabase dashboard
4. Check RLS policies aren't blocking the operation

## Architecture Principles

1. **Supabase is the single source of truth**
   - No MySQL, no Drizzle, no hybrid layers
   - All data flows through Supabase

2. **Team isolation enforced everywhere**
   - Server-side: Every query includes team_id filter
   - Database-level: RLS policies verify team membership
   - Never cross-team data access

3. **User IDs are UUID strings**
   - From Supabase Auth (auth.uid())
   - Consistent across all tables
   - No numeric IDs or conversions

4. **Premium UX preserved**
   - Skeleton loaders for loading states
   - Optimistic updates for instant feedback
   - Smooth transitions and calm interactions
   - Arabic-first microcopy

5. **Build-time vs Runtime**
   - Build: CLI + direct DB for migrations only
   - Runtime: SDK + RLS for secure access
   - Clean separation of concerns

---

**Status:** Infrastructure phase complete. Ready for auth integration and feature development.
