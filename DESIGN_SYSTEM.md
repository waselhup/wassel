# Wassel — Design System
**Quality bar:** $100K agency. Inspirations: Linear, Lemlist, Simplify.jobs, Vercel.

## Brand Foundation
- **Name:** Wassel (وصّل) — "to connect / deliver"
- **Audience:** Saudi job seekers + B2B sales teams in KSA/GCC
- **Tone:** Confident, warm, professional. Never salesy.

## Color Palette
| Token | Hex | Usage |
|---|---|---|
| `--navy` | `#1e3a5f` | Primary brand, headlines, nav |
| `--navy-dark` | `#152a47` | Hover states, footers |
| `--orange` | `#ff6b35` | CTAs, highlights, badges |
| `--orange-light` | `#ff8a5c` | Hover on orange |
| `--bg` | `#fafafa` | Page background |
| `--surface` | `#ffffff` | Cards, modals |
| `--border` | `#e5e7eb` | Dividers |
| `--text` | `#1f2937` | Body |
| `--text-muted` | `#6b7280` | Secondary text |
| `--success` | `#10b981` | Positive states |
| `--warning` | `#f59e0b` | Caution |
| `--danger` | `#ef4444` | Errors, destructive |

## Typography
| Language | Font | CDN | Weights |
|---|---|---|---|
| Arabic | **Cairo** | Google Fonts | 400, 500, 600, 700, 800 |
| English | **Inter** | Google Fonts | 400, 500, 600, 700, 800 |

### Scale (rem, mobile-first)
- `text-xs` 0.75 / `text-sm` 0.875 / `text-base` 1 / `text-lg` 1.125
- `text-xl` 1.25 / `text-2xl` 1.5 / `text-3xl` 1.875 / `text-4xl` 2.25
- `text-5xl` 3 / `text-6xl` 3.75 / `text-7xl` 4.5
- Headlines: `font-weight: 700-800`, `line-height: 1.1`
- Body: `font-weight: 400`, `line-height: 1.6`

## Spacing
4px base grid. Tailwind defaults (`p-2` `p-4` `p-6` `p-8` `p-12` `p-16` `p-24`).

## Radius
- Inputs / buttons: `rounded-xl` (12px)
- Cards: `rounded-2xl` (16px)
- Pills / badges: `rounded-full`

## Shadows
- `shadow-sm` — subtle hover
- `shadow-md` — cards
- `shadow-xl` — modals, hero CTAs
- `shadow-2xl` — floating panels
Transition: `transition-shadow duration-300 ease-out`

## Components (shadcn/ui base)
- Button: navy bg, orange accent variant, ghost variant
- Card: white surface, `rounded-2xl`, `shadow-md`, `p-6`
- Input: `rounded-xl`, `border`, focus ring orange
- Badge: small, `rounded-full`, color-coded
- Modal: backdrop blur, centered, `rounded-2xl`
- Toast: top-right (LTR) / top-left (RTL), auto-dismiss 4s
- Skeleton: shimmer animation, 1.2s loop

## Animations (Framer Motion)
```jsx
// Standard scroll-in
initial={{ opacity: 0, y: 24 }}
whileInView={{ opacity: 1, y: 0 }}
viewport={{ once: true, margin: "-80px" }}
transition={{ duration: 0.6, ease: "easeOut" }}

// Stagger children
transition={{ staggerChildren: 0.1, delayChildren: 0.2 }}

// Hover lift
whileHover={{ y: -4, transition: { duration: 0.2 } }}
```

## Loading States
- **Skeleton shimmer** for cards/lists (never spinners except for instant actions)
- **Pulse** for inline states
- **Progress bar** for multi-step operations (orange fill)

## Empty States
Every list/page must have one. Pattern:
1. Inline SVG illustration (centered, 200px max)
2. Headline (`text-xl font-semibold`)
3. Description (`text-muted text-base`)
4. Single primary CTA

## RTL Rules
- `dir="rtl"` on `<html>` when `i18n.language === 'ar'`
- Use `start`/`end` instead of `left`/`right` (Tailwind logical props)
- Mirror icons that have direction (arrows, chevrons)
- Numbers stay LTR even in Arabic context

## Responsive Breakpoints
```
sm:  640px   → small phones landscape
md:  768px   → tablets
lg:  1024px  → laptops
xl:  1280px  → desktops
2xl: 1536px  → large monitors
```
Test: 375 / 768 / 1024 / 1440 / 1920

## Iconography
- Lucide React (`lucide-react`) — outline, 1.5px stroke, 20-24px default
- Custom illustrations: inline SVG, brand colors only

## Accessibility
- Contrast: AA minimum (`#1f2937` on `#fafafa` ✅)
- Focus rings: visible orange `ring-2 ring-orange/40`
- All interactive elements: keyboard reachable
- ARIA labels on icon-only buttons
- Form inputs always have `<label>`

## File References
- CSS variables: `client/src/index.css`
- Tailwind config: `tailwind.config.ts`
- Component library: `client/src/components/ui/`
- i18n: `client/public/locales/{ar,en}/translation.json`
