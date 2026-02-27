# وصل | Wassel

**Premium Saudi-First SaaS for LinkedIn Relationship Management**

Wassel is a production-grade SaaS platform designed for Saudi founders, agencies, and consultants to manage LinkedIn relationships at scale. Built with an "Apple-level Arabic SaaS" philosophy: premium simplicity, trustworthy design, and Arabic-first experience.

---

## 🎯 Vision

**"Apple-level Arabic SaaS"**

- Arabic first, not translated later
- Premium simplicity with clean whitespace
- Trustworthy, minimal UI inspired by Notion × Linear × Apple
- Designed for Saudi/GCC market with local context (timezone, currency, culture)

---

## 🏗️ Architecture

### Monorepo Structure

```
wassel/
├── apps/
│   ├── web/                    # React 19 + Tailwind 4 frontend
│   │   ├── src/
│   │   │   ├── pages/         # Page components
│   │   │   ├── components/    # Reusable UI components
│   │   │   ├── lib/           # Utilities & tRPC client
│   │   │   └── index.css      # Global styles
│   │   └── public/            # Static assets (minimal)
│   └── extension/             # Chrome Extension (Manifest V3)
│       ├── manifest.json      # Extension configuration
│       ├── popup.html         # Extension popup
│       ├── content.js         # LinkedIn content script
│       └── background.js      # Service worker
├── server/                     # Express 4 + tRPC backend
│   ├── routers.ts            # tRPC procedure definitions
│   ├── db.ts                 # Database query helpers
│   ├── auth.logout.test.ts   # Test examples
│   └── _core/                # Framework internals (do not edit)
├── drizzle/                   # Database schema & migrations
│   ├── schema.ts             # Drizzle ORM schema
│   └── migrations/           # Generated SQL migrations
├── supabase/                  # Supabase-specific setup
│   └── migrations/           # PostgreSQL migrations
│       ├── 001_core_schema.sql
│       ├── 002_functions.sql
│       └── 003_rls_policies.sql
├── shared/                    # Shared types & constants
├── storage/                   # S3 file storage helpers
├── package.json              # Root dependencies
├── turbo.json                # Turborepo configuration
├── tsconfig.json             # TypeScript configuration
├── TODO.md                   # Feature roadmap (9 phases)
├── CHANGELOG.md              # Change history
└── README.md                 # This file
```

---

## 🚀 Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | React 19 + Tailwind 4 | Latest |
| **Backend** | Express 4 + tRPC 11 | Latest |
| **Database** | Supabase (PostgreSQL) | Cloud |
| **ORM** | Drizzle ORM | Latest |
| **Auth** | Manus OAuth | Built-in |
| **File Storage** | AWS S3 (via Manus) | Cloud |
| **Build Tool** | Vite + Turbo | Latest |
| **Package Manager** | pnpm | 10.x |
| **Extension** | Chrome Manifest V3 | V3 |
| **Language** | TypeScript 5.9 | Latest |

---

## 🔐 Database Architecture

### Multi-Tenancy Design

- **Teams** as isolation boundary
- All data tables include `team_id` foreign key
- Row Level Security (RLS) enforces team boundaries
- Team owners have full access, members have role-based access

### Core Tables

- **profiles** - User accounts (extends auth.users)
- **teams** - Team/workspace management
- **team_members** - Team membership with roles
- **campaigns** - LinkedIn outreach campaigns
- **campaign_steps** - Campaign workflow sequences
- **leads** - LinkedIn profiles imported for outreach
- **action_queue** - Human-in-the-loop approval workflow
- **message_templates** - Reusable message templates
- **events** - Analytics event tracking
- **credit_transactions** - Usage tracking & billing

### Security

- Row Level Security (RLS) enabled on all tables
- Role-based access control (owner, admin, member)
- Proper foreign key constraints with cascading rules
- Check constraints for data validation

---

## 🛠️ Development Setup

### Prerequisites

- Node.js 22.x
- pnpm 10.x
- Git
- Supabase account (for database)

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/wassel.git
cd wassel

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local

# Run database migrations (Supabase)
pnpm db:push

# Start development server
pnpm dev
```

### Environment Variables

Create `.env.local` with:

```env
# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Google OAuth (for LinkedIn)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# Stripe (Test Mode)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email
RESEND_API_KEY=re_...

# Extension
NEXT_PUBLIC_EXTENSION_ID=your-extension-id

# Auth
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=http://localhost:3000
```

---

## 📦 Build & Deployment

### Development

```bash
pnpm dev           # Start dev server with HMR
pnpm lint          # Run linter
pnpm format        # Format code
pnpm test          # Run tests
```

### Production

```bash
pnpm build         # Build frontend + backend
pnpm start         # Start production server
```

### Database Migrations

```bash
pnpm db:migrate    # Apply pending migrations
pnpm db:reset      # Reset database (dev only)
pnpm db:seed       # Seed database (if available)
```

---

## 🎨 Design System

### Color Palette

- **Primary:** Deep Confident Blue (#1E40AF)
- **Secondary:** Neutral Gray (#6B7280)
- **Accent:** Emerald Green (#10B981)
- **Background:** White (#FFFFFF)
- **Text:** Dark Gray (#111827)

### Typography

- **Font:** Tajawal (Arabic) + Inter (English)
- **Sizes:** 12px, 14px, 16px, 18px, 20px, 24px, 32px
- **Weight:** 400 (Regular), 500 (Medium), 600 (Semibold), 700 (Bold)

### RTL Support

- All components built with RTL-first approach
- CSS logical properties for direction-agnostic styling
- Proper spacing and alignment for Arabic text

---

## 🔄 Development Workflow

### tRPC Procedures

1. Define procedure in `server/routers.ts`
2. Add database helper in `server/db.ts` if needed
3. Call from frontend with `trpc.feature.useQuery/useMutation`
4. Write tests in `server/*.test.ts`

### Database Changes

1. Update schema in `drizzle/schema.ts`
2. Run `pnpm drizzle-kit generate` to create migration
3. Apply migration via `pnpm db:push`
4. Update types in TypeScript

### Component Development

1. Create component in `client/src/components/`
2. Use shadcn/ui components for consistency
3. Apply Tailwind utilities for styling
4. Test with different screen sizes

---

## 📋 Project Phases

See [TODO.md](./TODO.md) for complete 9-phase roadmap:

- ✅ Phase 1: Project Intelligence
- ✅ Phase 2: Foundation Fixes
- ⏳ Phase 3: Wassel Design System
- ⏳ Phase 4: Landing Page
- ⏳ Phase 5: User Dashboard
- ⏳ Phase 6: Admin Dashboard
- ⏳ Phase 7: Chrome Extension
- ⏳ Phase 8: Polish & Refinement
- ⏳ Phase 9: Launch Readiness

---

## 📚 Documentation

- [TODO.md](./TODO.md) - Feature roadmap and task tracking
- [CHANGELOG.md](./CHANGELOG.md) - Version history and changes
- [PHASE2_STABILITY_REPORT.md](./PHASE2_STABILITY_REPORT.md) - Phase 2 validation report

---

## 🤝 Contributing

This is a private project. For internal development:

1. Create a feature branch: `git checkout -b feature/feature-name`
2. Make changes and commit: `git commit -m "feat: add feature"`
3. Push to GitHub: `git push origin feature/feature-name`
4. Create a Pull Request for review

---

## 📄 License

Private project. All rights reserved.

---

## 👥 Team

- **Product & Design:** Wassel Vision
- **Development:** Manus AI Builder
- **Infrastructure:** Supabase + Manus

---

## 🚀 Deployment

### Vercel (Frontend)

```bash
vercel deploy
```

### Supabase (Database)

Migrations automatically applied on push.

### Chrome Web Store

Extension submission pending Phase 7 completion.

---

## 📞 Support

For issues or questions:
1. Check [TODO.md](./TODO.md) for known limitations
2. Review [CHANGELOG.md](./CHANGELOG.md) for recent changes
3. Consult [PHASE2_STABILITY_REPORT.md](./PHASE2_STABILITY_REPORT.md) for architecture details

---

**Last Updated:** 2026-02-28  
**Status:** Phase 2 Complete - Ready for Phase 3  
**Language:** Arabic RTL First
