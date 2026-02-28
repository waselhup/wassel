# وصل | Wassel Design System

**Version:** 1.0.0  
**Status:** Phase 3 - In Development  
**Language:** Arabic RTL First  
**Philosophy:** "Apple-level Arabic SaaS"

---

## 🎨 Design Philosophy

Wassel's design language is built on three core principles:

1. **Premium Simplicity:** Clean, minimal UI with generous whitespace
2. **Arabic-First:** Native RTL experience, not translated
3. **Trustworthy Clarity:** Every element serves a purpose, nothing is decorative

The design should feel like a billion-dollar SaaS, not a startup MVP.

---

## 🌈 Color System

### Primary Palette

| Color | Hex | RGB | Usage | OKLCH |
|-------|-----|-----|-------|-------|
| **Deep Confident Blue** | `#1E40AF` | rgb(30, 64, 175) | Primary actions, headers | oklch(45% 0.15 258°) |
| **Light Blue** | `#DBEAFE` | rgb(219, 238, 254) | Backgrounds, hover states | oklch(92% 0.05 258°) |
| **Darker Blue** | `#1E3A8A` | rgb(30, 58, 138) | Dark mode, emphasis | oklch(35% 0.15 258°) |

### Neutral Palette

| Color | Hex | RGB | Usage |
|-------|-----|-----|-------|
| **White** | `#FFFFFF` | rgb(255, 255, 255) | Primary background |
| **Light Gray** | `#F3F4F6` | rgb(243, 244, 246) | Secondary background |
| **Medium Gray** | `#E5E7EB` | rgb(229, 231, 235) | Borders, dividers |
| **Dark Gray** | `#6B7280` | rgb(107, 114, 128) | Secondary text |
| **Text Black** | `#111827` | rgb(17, 24, 39) | Primary text |

### Accent Palette

| Color | Hex | Usage | Context |
|-------|-----|-------|---------|
| **Success Green** | `#10B981` | Success states, confirmations | Positive actions |
| **Warning Amber** | `#F59E0B` | Warnings, pending states | Caution |
| **Error Red** | `#EF4444` | Errors, destructive actions | Negative |
| **Info Blue** | `#3B82F6` | Information, help text | Neutral info |

### Gradients

**Premium Gradient (Hero sections):**
```css
background: linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%);
```

**Soft Gradient (Cards):**
```css
background: linear-gradient(135deg, #DBEAFE 0%, #F3F4F6 100%);
```

**Dark Gradient (Dark mode):**
```css
background: linear-gradient(135deg, #1E3A8A 0%, #1E40AF 100%);
```

---

## 📝 Typography System

### Font Stack

**Arabic (Primary):**
```css
font-family: 'Tajawal', -apple-system, BlinkMacSystemFont, sans-serif;
```

**English (Secondary):**
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
```

### Type Scale

| Size | px | rem | Usage | Weight |
|------|----|----|-------|--------|
| **Display** | 32 | 2.0 | Page titles, hero | 700 Bold |
| **Heading 1** | 28 | 1.75 | Section titles | 700 Bold |
| **Heading 2** | 24 | 1.5 | Subsections | 600 Semibold |
| **Heading 3** | 20 | 1.25 | Card titles | 600 Semibold |
| **Body Large** | 18 | 1.125 | Large text | 400 Regular |
| **Body** | 16 | 1.0 | Default text | 400 Regular |
| **Body Small** | 14 | 0.875 | Secondary text | 400 Regular |
| **Caption** | 12 | 0.75 | Labels, hints | 500 Medium |

### Font Weights

- **400:** Regular (body text)
- **500:** Medium (labels, emphasis)
- **600:** Semibold (headings, strong emphasis)
- **700:** Bold (titles, strong headings)

### Line Heights

- **Tight:** 1.2 (headings)
- **Normal:** 1.5 (body text)
- **Relaxed:** 1.75 (descriptions)

---

## 🎯 Spacing System

All spacing follows an 8px base unit for consistency and RTL compatibility.

| Size | px | Usage |
|------|----|----|
| **xs** | 4 | Micro spacing |
| **sm** | 8 | Compact spacing |
| **md** | 16 | Default spacing |
| **lg** | 24 | Generous spacing |
| **xl** | 32 | Large sections |
| **2xl** | 48 | Major sections |
| **3xl** | 64 | Page margins |

### Padding Guidelines

- **Buttons:** 12px vertical, 16px horizontal (sm/md)
- **Cards:** 24px (lg)
- **Containers:** 32px (xl)
- **Page:** 48px (2xl)

### Margin Guidelines

- **Between sections:** 32-48px (xl-2xl)
- **Between elements:** 16-24px (md-lg)
- **Within groups:** 8-16px (sm-md)

---

## 🔲 Border & Radius System

### Border Radius

| Size | px | Usage |
|------|----|----|
| **sm** | 4 | Subtle corners |
| **md** | 8 | Default corners |
| **lg** | 12 | Larger elements |
| **xl** | 16 | Cards, modals |
| **full** | 9999 | Circles, pills |

### Border Width

- **Default:** 1px (borders, dividers)
- **Thick:** 2px (emphasis)
- **Heavy:** 4px (focus states)

### Border Colors

- **Light:** #E5E7EB (default)
- **Medium:** #D1D5DB (hover)
- **Dark:** #6B7280 (active)

---

## 🌑 Shadow System

### Elevation Levels

| Level | Shadow | Usage |
|-------|--------|-------|
| **None** | none | Flat elements |
| **sm** | 0 1px 2px rgba(0,0,0,0.05) | Subtle depth |
| **md** | 0 4px 6px rgba(0,0,0,0.1) | Default cards |
| **lg** | 0 10px 15px rgba(0,0,0,0.1) | Elevated cards |
| **xl** | 0 20px 25px rgba(0,0,0,0.1) | Modals, popovers |
| **2xl** | 0 25px 50px rgba(0,0,0,0.15) | Dropdowns, tooltips |

---

## 🎬 Motion & Transitions

### Duration

- **Fast:** 150ms (micro-interactions)
- **Normal:** 300ms (standard transitions)
- **Slow:** 500ms (important changes)

### Easing

- **ease-in:** cubic-bezier(0.4, 0, 1, 1) - Entering
- **ease-out:** cubic-bezier(0, 0, 0.2, 1) - Exiting
- **ease-in-out:** cubic-bezier(0.4, 0, 0.2, 1) - Smooth transitions

### Common Transitions

```css
/* Hover effects */
transition: all 150ms ease-out;

/* Page transitions */
transition: opacity 300ms ease-in-out;

/* Modal animations */
transition: transform 300ms ease-out, opacity 300ms ease-out;
```

---

## 🔘 Component Specifications

### Buttons

#### Primary Button
- **Background:** Deep Confident Blue (#1E40AF)
- **Text:** White
- **Padding:** 12px 24px
- **Border Radius:** 8px
- **Font Weight:** 600 Semibold
- **Hover:** Darker Blue (#1E3A8A)
- **Active:** Even darker with shadow
- **Disabled:** Gray with reduced opacity

#### Secondary Button
- **Background:** Light Gray (#F3F4F6)
- **Text:** Dark Gray (#6B7280)
- **Border:** 1px Medium Gray (#D1D5DB)
- **Padding:** 12px 24px
- **Border Radius:** 8px
- **Hover:** Medium Gray background

#### Tertiary Button
- **Background:** Transparent
- **Text:** Deep Confident Blue (#1E40AF)
- **Padding:** 12px 24px
- **Border Radius:** 8px
- **Hover:** Light Blue background

### Cards

#### Data Card
- **Background:** White
- **Border:** 1px Light Gray (#E5E7EB)
- **Border Radius:** 12px
- **Padding:** 24px
- **Shadow:** md (0 4px 6px rgba(0,0,0,0.1))
- **Hover:** Light shadow increase

#### Interactive Card
- **All of Data Card +**
- **Cursor:** pointer
- **Hover State:** Light Blue background, shadow-lg
- **Transition:** 300ms ease-out

### Input Fields

#### Text Input
- **Height:** 44px
- **Padding:** 12px 16px
- **Border:** 1px Medium Gray (#D1D5DB)
- **Border Radius:** 8px
- **Font Size:** 16px
- **Focus:** Blue border (2px), shadow-sm
- **Placeholder:** Dark Gray (#9CA3AF)

#### Select/Dropdown
- **Same as Text Input +**
- **Icon:** Chevron on right (RTL: left)
- **Options Background:** White
- **Option Hover:** Light Blue

---

## 📐 Layout System

### Container Sizes

| Size | Max Width | Usage |
|------|-----------|-------|
| **sm** | 640px | Narrow layouts |
| **md** | 768px | Medium layouts |
| **lg** | 1024px | Standard layouts |
| **xl** | 1280px | Wide layouts |
| **2xl** | 1536px | Extra wide |

### Grid System

- **Columns:** 12-column grid
- **Gap:** 24px (lg)
- **Breakpoints:**
  - Mobile: 320px
  - Tablet: 768px
  - Desktop: 1024px
  - Wide: 1280px

---

## 🌍 RTL Considerations

### CSS Logical Properties

Use logical properties for RTL compatibility:

```css
/* Instead of: */
margin-left: 16px;
padding-right: 24px;

/* Use: */
margin-inline-start: 16px;
padding-inline-end: 24px;
```

### Text Direction

```css
direction: rtl;
text-align: right;
```

### Flexbox & Grid

```css
/* Flexbox automatically reverses in RTL */
display: flex;
flex-direction: row; /* Reverses to row-reverse in RTL */

/* Grid also respects RTL */
display: grid;
grid-auto-flow: column; /* Reverses in RTL */
```

---

## ♿ Accessibility Standards

### Color Contrast

- **Normal text:** Minimum 4.5:1 ratio
- **Large text:** Minimum 3:1 ratio
- **UI components:** Minimum 3:1 ratio

### Focus States

- **Visible focus ring:** 2px solid blue
- **Focus outline:** 2px offset from element
- **Never remove focus:** Use outline instead

### ARIA Labels

- All interactive elements must have labels
- Form inputs must have associated labels
- Images must have alt text

### Keyboard Navigation

- All interactive elements must be keyboard accessible
- Tab order must be logical
- No keyboard traps

---

## 🎨 Design Tokens (Tailwind Config)

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        wassel: {
          primary: '#1E40AF',
          'primary-light': '#DBEAFE',
          'primary-dark': '#1E3A8A',
        },
      },
      fontFamily: {
        arabic: ['Tajawal', 'system-ui'],
        english: ['Inter', 'system-ui'],
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        '2xl': '48px',
        '3xl': '64px',
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
    },
  },
};
```

---

## 📚 Component Library

### Implemented Components

- [ ] Button (Primary, Secondary, Tertiary, Danger)
- [ ] Card (Simple, Interactive, Data)
- [ ] Input (Text, Email, Password, Search)
- [ ] Select (Dropdown)
- [ ] Checkbox
- [ ] Radio Button
- [ ] Toggle Switch
- [ ] Modal / Dialog
- [ ] Sidebar Navigation
- [ ] Top Navigation
- [ ] Breadcrumb
- [ ] Pagination
- [ ] Table
- [ ] Form
- [ ] Alert
- [ ] Badge
- [ ] Tooltip
- [ ] Loading Spinner
- [ ] Empty State
- [ ] Error State

---

## 🎯 Usage Guidelines

### Do's ✅

- Use the color palette consistently
- Maintain proper spacing and alignment
- Use appropriate font sizes for hierarchy
- Implement focus states for accessibility
- Test in RTL mode
- Use semantic HTML

### Don'ts ❌

- Don't mix fonts or colors arbitrarily
- Don't remove focus indicators
- Don't use placeholder text as labels
- Don't forget RTL testing
- Don't over-decorate
- Don't use generic templates

---

## 📖 Documentation

Each component should include:

1. **Visual Examples:** Multiple states (default, hover, active, disabled)
2. **Code Examples:** React component usage
3. **Props Documentation:** All available props
4. **Accessibility Notes:** ARIA attributes, keyboard navigation
5. **RTL Testing:** Verified in RTL mode
6. **Dark Mode:** If applicable

---

## 🔄 Maintenance

### Version Control

- Track design changes in Git
- Document breaking changes
- Maintain backwards compatibility when possible

### Updates

- Review components quarterly
- Update based on user feedback
- Keep accessibility standards current
- Test new browser versions

---

**Last Updated:** 2026-02-28  
**Status:** Phase 3 In Progress  
**Next:** Component Implementation
