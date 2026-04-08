# Wassel v2 — Premium Design Skill

## Design Philosophy
Build interfaces that look like they cost $100,000 to develop.
Every pixel matters. No generic AI aesthetics. Make humans say "a human designer made this."

## Design References (study these for inspiration)
- simplify.jobs — Clean SaaS landing, smooth onboarding, trust-building layout
- simplify.jobs/blog — Content layout, typography, card design
- lemlist.com — Bold colors, animated sections, social proof done right
- instantly.ai — Dark/light contrast, pricing page excellence, feature showcases
- gmass.co — Clean email tool UI, dashboard simplicity
- brevo.com — Enterprise-level polish, multi-product navigation
- saleshandy.com — Cold email dashboard, campaign builder UX
- activecampaign.com — Automation workflow visuals, advanced but approachable

## Wassel Color System (NEVER change these)
```css
--navy: #1e3a5f;          /* Primary — headers, sidebar, dark sections */
--orange: #ff6b35;        /* CTA buttons, highlights, badges */
--bg: #ffffff;            /* Base background */
--surface: #fafafa;       /* Cards, elevated surfaces */
--text: #1a1a2e;          /* Primary text */
--muted: #64748b;         /* Secondary text */
--border: #e0e5eb;        /* Borders, dividers */
--success: #22c55e;       /* Success states */
--warning: #f59e0b;       /* Warning, tokens */
--danger: #ef4444;        /* Errors, destructive */
```

## Typography Rules
- Arabic headings: Cairo, 700-800 weight, generous line-height (1.8)
- English headings: Inter, 700 weight, tight tracking (-0.02em)
- Body text: 16-18px, line-height 1.6-1.8
- Hero titles: 48-72px, bold, gradient text for key words
- NEVER use default browser fonts

## Layout Principles
- Max content width: 1280px
- Section padding: 80-120px vertical
- Card border-radius: 16-24px (rounded-2xl, rounded-3xl)
- Subtle shadows: shadow-sm default, shadow-lg on hover
- Generous whitespace — let content breathe
- Grid gaps: 24-32px between cards

## Animation Rules (Framer Motion)
- Page sections: whileInView fade-up, stagger 0.1s between children
- Cards: hover scale 1.02 + shadow increase + translateY(-4px)
- Buttons: whileHover scale 1.05, whileTap scale 0.95
- Numbers/stats: count-up animation on scroll
- Page transitions: fade + slide (200-300ms)
- NEVER: excessive bounce, jarring movements, too many simultaneous animations

## Component Design Standards

### Hero Section
- Split layout: text left, visual right (or centered on mobile)
- Gradient text on key phrase (navy → orange)
- Large CTA button (orange, rounded-xl, shadow-lg)
- Trust badges below CTA (no credit card, free trial, etc.)
- Subtle background pattern or gradient blobs

### Feature Cards
- White bg, rounded-2xl, subtle border
- Icon in colored circle (48x48px)
- Title (20-24px, bold)
- Description (16px, muted color, 2-3 lines max)
- Hover: lift + shadow + accent bottom border
- "Learn more →" link (orange)

### Pricing Cards
- 3-4 cards, middle one elevated (scale-105, ring-2 ring-orange)
- "Most Popular" badge on recommended plan
- Price: large number + currency + period
- Feature list with checkmarks
- CTA button matches card importance

### Dashboard Sidebar
- Dark navy background (#1e3a5f)
- White text, semi-transparent inactive items
- Active item: orange left border + slightly lighter bg
- Logo at top, user avatar at bottom
- Collapsible on mobile (hamburger menu)

### Forms
- Clean labels above inputs
- Rounded-lg inputs with subtle border
- Focus: orange ring (ring-orange-500/20)
- Error: red border + error message below
- Success: green checkmark inline

### Tables
- Alternating row colors (white / gray-50)
- Sticky header
- Hover row highlight
- Action buttons in last column
- Responsive: horizontal scroll or card view on mobile

## Image Generation Guidelines
- For hero section: create abstract gradient SVG illustrations (blobs, waves, geometric shapes in navy/orange/white)
- For feature icons: use Lucide icons in colored circles
- For testimonials: gradient circles with initials (not photos)
- For mockups: gradient placeholder divs styled as browser windows
- NEVER use stock photos — use SVG illustrations or gradients
- If real images needed: describe what to generate with AI image tools

## RTL (Arabic) Specific
- Mirror all layouts (text-right, flex-row-reverse)
- Cairo font everywhere
- Logical properties: ms- me- ps- pe- (not ml- mr- pl- pr-)
- Numbers always Western (0-9), never Eastern Arabic
- Test every component in both AR and EN

## Quality Checklist
Before shipping any UI:
- [ ] Looks professional at 1440px (desktop)
- [ ] Looks good at 768px (tablet)
- [ ] Looks perfect at 375px (mobile)
- [ ] Animations are smooth, not jarring
- [ ] Colors match the design system exactly
- [ ] Typography hierarchy is clear
- [ ] RTL layout works correctly
- [ ] Dark sections have proper contrast
- [ ] Interactive elements have hover/active states
- [ ] Loading states exist for async operations
- [ ] Empty states are designed (not blank)
- [ ] Error states show meaningful messages
