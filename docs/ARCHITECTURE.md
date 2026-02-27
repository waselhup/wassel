# Wassel Architecture Documentation

## System Overview

Wassel is a production-grade SaaS platform built as a monorepo with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Extension                          │
│              (Manifest V3 - LinkedIn Integration)            │
└────────────────────────┬────────────────────────────────────┘
                         │
                    HTTP/WebSocket
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   Web Application                            │
│  React 19 + Tailwind 4 + tRPC Client                        │
│  ├─ Landing Page                                            │
│  ├─ User Dashboard                                          │
│  └─ Admin Dashboard                                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                   tRPC over HTTP
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   Backend Server                             │
│  Express 4 + tRPC 11 + TypeScript                           │
│  ├─ Authentication (Manus OAuth)                            │
│  ├─ Business Logic (Routers)                               │
│  ├─ Database Queries (Drizzle ORM)                         │
│  └─ File Storage (S3 via Manus)                            │
└────────────────────────┬────────────────────────────────────┘
                         │
                   SQL / Postgres Protocol
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   Supabase (PostgreSQL)                      │
│  ├─ Multi-tenant Data (Teams)                              │
│  ├─ Row Level Security (RLS)                               │
│  ├─ Triggers & Functions                                   │
│  └─ Real-time Subscriptions (optional)                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Architecture

### Multi-Tenancy Model

**Isolation Boundary:** Teams

Every data record belongs to exactly one team. The `team_id` foreign key is present in all data tables:

```
User (auth.users)
  ↓
Profile (1:1)
  ↓
Teams (1:many) ← Isolation Boundary
  ↓
├─ Campaigns
├─ Leads
├─ Action Queue
├─ Message Templates
├─ Events
└─ Credit Transactions
```

### Security Model

**Row Level Security (RLS)** enforces multi-tenancy at the database level:

1. **Owner Access:** Team owner has full access to all team data
2. **Member Access:** Team members have role-based access (admin, member)
3. **System Access:** Background jobs can create events/transactions without user context
4. **Public Data:** Some templates can be marked public (shared across teams)

### Data Flow

```
User Action (Frontend)
  ↓
tRPC Procedure (Backend)
  ↓
Database Query (Drizzle ORM)
  ↓
RLS Policy Check (Supabase)
  ↓
Data Returned / Denied
  ↓
Response to Frontend
```

---

## API Architecture

### tRPC Procedures

All backend operations are exposed through tRPC procedures, which provide:

- **Type Safety:** End-to-end TypeScript types
- **Automatic Validation:** Input/output validation
- **Error Handling:** Standardized error responses
- **Authentication:** `protectedProcedure` for auth-required endpoints

### Procedure Categories

```typescript
// Public procedures (no auth required)
trpc.public.*

// Protected procedures (auth required)
trpc.protected.*

// Admin procedures (admin role required)
trpc.admin.*
```

### Example Flow

```typescript
// Frontend
const { data } = trpc.campaigns.list.useQuery({ teamId: "123" });

// Backend (server/routers.ts)
campaigns: {
  list: protectedProcedure
    .input(z.object({ teamId: z.string().uuid() }))
    .query(({ ctx, input }) => {
      // ctx.user is authenticated user
      // RLS ensures only team members can access
      return db.getCampaigns(input.teamId);
    })
}

// Database (server/db.ts)
export async function getCampaigns(teamId: string) {
  return db.select().from(campaigns)
    .where(eq(campaigns.team_id, teamId));
  // RLS policy prevents cross-team access
}
```

---

## Database Schema

### Core Tables

| Table | Purpose | Multi-Tenant | RLS Enabled |
|-------|---------|--------------|-------------|
| profiles | User accounts | No (user-level) | Yes |
| teams | Workspaces | Yes | Yes |
| team_members | Team membership | Yes | Yes |
| campaigns | Outreach campaigns | Yes | Yes |
| campaign_steps | Campaign workflow | Yes | Yes |
| leads | LinkedIn profiles | Yes | Yes |
| action_queue | Approval workflow | Yes | Yes |
| message_templates | Message templates | Yes | Yes |
| events | Analytics events | Yes | Yes |
| credit_transactions | Usage tracking | Yes | Yes |

### Key Design Decisions

1. **JSONB Fields:** `configuration`, `settings`, `metadata` for flexibility
2. **Generated Columns:** `leads.full_name` computed from first_name + last_name
3. **Cascading Deletes:** Deleting team cascades to all team data
4. **Indexes:** Strategic indexes on `team_id`, `user_id`, `status` for performance
5. **Check Constraints:** Enum-like fields validated at database level

---

## Authentication & Authorization

### OAuth Flow

1. User clicks "Login"
2. Redirected to Manus OAuth portal
3. User authenticates with Google/Microsoft/etc.
4. Callback to `/api/oauth/callback`
5. Session cookie set
6. User logged in

### Authorization Levels

| Level | Access | Example |
|-------|--------|---------|
| Public | No auth required | Landing page |
| User | Any authenticated user | User dashboard |
| Team Member | Member of team | Campaign management |
| Team Owner | Owner of team | Team settings |
| Admin | Global admin | User management |

### RLS Policies

Each table has policies that check:

```sql
-- Example: User can only access their team's campaigns
CREATE POLICY "team_access" ON campaigns
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = campaigns.team_id
      AND user_id = auth.uid()
    )
  );
```

---

## File Storage

### S3 Architecture

Files are stored in S3 (via Manus), not in database:

```
Frontend Upload
  ↓
POST to /api/upload
  ↓
Backend: storagePut(key, buffer, mimeType)
  ↓
S3 Upload
  ↓
Return signed URL
  ↓
Store URL in database
```

### Benefits

- **Performance:** No database bloat
- **Scalability:** S3 handles large files
- **Security:** Signed URLs expire
- **CDN:** Files served from edge locations

---

## Real-time Features (Future)

### Supabase Realtime

When implemented, Supabase Realtime will enable:

```typescript
// Subscribe to campaign updates
supabase
  .channel(`campaigns:${teamId}`)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns' }, (payload) => {
    // Update UI
  })
  .subscribe();
```

---

## Extension Architecture

### Manifest V3 Structure

```
Extension
├─ popup.html          # Extension popup UI
├─ content.js          # Runs on LinkedIn pages
├─ background.js       # Service worker (persistent)
├─ sidebar.html        # Sidebar UI (injected)
└─ manifest.json       # Extension configuration
```

### Communication Flow

```
LinkedIn Page
  ↓
Content Script detects profile
  ↓
Sends message to Service Worker
  ↓
Service Worker communicates with web app (localhost:3000)
  ↓
Web app returns data
  ↓
Sidebar displays information
```

### Security

- **CSP:** Content Security Policy prevents unauthorized scripts
- **Permissions:** Minimal permissions requested
- **Communication:** Only with localhost:3000 (development) or production domain
- **Data:** No sensitive data stored locally

---

## Deployment Architecture

### Development

```
Local Machine
├─ Frontend: http://localhost:3000 (Vite)
├─ Backend: http://localhost:3000 (Express via Vite proxy)
├─ Database: Supabase (cloud)
└─ Extension: Unpacked in Chrome
```

### Production

```
Vercel
├─ Frontend: React build
└─ Backend: Express build

Supabase
└─ Database: PostgreSQL

S3
└─ File storage

Chrome Web Store
└─ Extension distribution
```

---

## Performance Considerations

### Database

- **Indexes:** On `team_id`, `user_id`, `status`, `created_at`
- **Query Optimization:** Avoid N+1 queries
- **Pagination:** Implement for large result sets
- **Caching:** tRPC client caches queries

### Frontend

- **Code Splitting:** Lazy load pages
- **Image Optimization:** Use CDN URLs
- **CSS:** Tailwind purging
- **Bundle Size:** Monitor with Vite analyzer

### Backend

- **Connection Pooling:** Supabase handles
- **Rate Limiting:** Implement per IP
- **Caching:** Redis (future)
- **Monitoring:** Error tracking

---

## Monitoring & Observability

### Logs

- **Server Logs:** Express middleware logs requests
- **Database Logs:** Supabase provides query logs
- **Client Logs:** Browser console (development)
- **Extension Logs:** Chrome DevTools

### Metrics

- **Performance:** Response times, query durations
- **Usage:** Active users, campaigns run, leads imported
- **Errors:** Exception rates, failed operations
- **Business:** Conversion rates, subscription churn

---

## Security Best Practices

1. **Never commit secrets** - Use `.env.local` (gitignored)
2. **Validate input** - Use Zod schemas
3. **Escape output** - React prevents XSS
4. **HTTPS only** - All connections encrypted
5. **RLS enforced** - Database-level access control
6. **Rate limiting** - Prevent abuse
7. **CORS configured** - Only allow trusted origins
8. **Secrets rotation** - Regularly update API keys

---

## Future Enhancements

1. **Real-time Subscriptions:** Supabase Realtime for live updates
2. **Webhooks:** Stripe, LinkedIn, custom integrations
3. **Background Jobs:** Delayed campaign execution
4. **Analytics:** Advanced reporting and insights
5. **API:** Public API for third-party integrations
6. **Mobile App:** React Native version
7. **Internationalization:** Full i18n support
8. **A/B Testing:** Feature flags and experimentation

---

**Last Updated:** 2026-02-28  
**Status:** Phase 2 Complete
