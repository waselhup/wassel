# Wassel Component Showcase

**Status:** Phase 3 - Design System Implementation  
**Last Updated:** 2026-02-28

---

## 🎨 Color Palette Preview

### Primary Colors

```
Deep Confident Blue
#1E40AF
RGB(30, 64, 175)
Used for: Primary actions, headers, focus states
```

```
Light Blue
#DBEAFE
RGB(219, 238, 254)
Used for: Backgrounds, hover states, secondary elements
```

```
Darker Blue
#1E3A8A
RGB(30, 58, 138)
Used for: Active states, dark mode, emphasis
```

### Neutral Colors

```
White: #FFFFFF - Primary background
Light Gray: #F3F4F6 - Secondary background
Medium Gray: #E5E7EB - Borders, dividers
Dark Gray: #6B7280 - Secondary text
Text Black: #111827 - Primary text
```

### Status Colors

```
Success Green: #10B981 - Positive actions
Warning Amber: #F59E0B - Cautions, pending
Error Red: #EF4444 - Errors, destructive
Info Blue: #3B82F6 - Information
```

---

## 📝 Typography Hierarchy

### Display (32px, Bold)
**Used for:** Page titles, hero sections

### Heading 1 (28px, Bold)
**Used for:** Section titles, major headings

### Heading 2 (24px, Semibold)
**Used for:** Subsections, card titles

### Heading 3 (20px, Semibold)
**Used for:** Minor headings, emphasis

### Body Large (18px, Regular)
**Used for:** Large text, introductions

### Body (16px, Regular)
**Used for:** Default body text, paragraphs

### Body Small (14px, Regular)
**Used for:** Secondary text, descriptions

### Caption (12px, Medium)
**Used for:** Labels, hints, metadata

---

## 🔘 Button Components

### Primary Button
- **State:** Default
- **Background:** Deep Confident Blue (#1E40AF)
- **Text:** White
- **Padding:** 12px 24px
- **Border Radius:** 8px
- **Font Weight:** 600

**Hover State:**
- Background: Darker Blue (#1E3A8A)
- Shadow: Elevated

**Active State:**
- Background: Even darker
- Shadow: Maximum

**Disabled State:**
- Opacity: 50%
- Cursor: Not allowed

### Secondary Button
- **Background:** Light Gray (#F3F4F6)
- **Text:** Dark Gray (#6B7280)
- **Border:** 1px Medium Gray (#D1D5DB)
- **Hover:** Medium Gray background

### Tertiary Button
- **Background:** Transparent
- **Text:** Deep Confident Blue (#1E40AF)
- **Hover:** Light Blue background

### Danger Button
- **Background:** Error Red (#EF4444)
- **Text:** White
- **Hover:** Darker Red

---

## 🎴 Card Components

### Data Card
```
┌─────────────────────────────────┐
│                                 │
│  Card Title                     │
│  Card description or content    │
│                                 │
└─────────────────────────────────┘
```

**Properties:**
- Background: White
- Border: 1px Light Gray
- Border Radius: 12px
- Padding: 24px
- Shadow: Soft (md)
- Hover: Shadow increases

### Interactive Card
- Same as Data Card
- Cursor: Pointer
- Hover Background: Light Blue
- Hover Shadow: Larger

### Compact Card
- Padding: 16px
- Used for: Lists, grids

---

## 📝 Input Components

### Text Input
```
┌────────────────────────────────────┐
│ Placeholder text or value          │
└────────────────────────────────────┘
```

**Properties:**
- Height: 44px
- Padding: 12px 16px
- Border: 1px Medium Gray
- Border Radius: 8px
- Focus: Blue border (2px), shadow

### Email Input
- Same as Text Input
- Type: email
- Validation: Built-in

### Password Input
- Same as Text Input
- Type: password
- Show/Hide toggle

### Search Input
- Same as Text Input
- Icon: Search (left/right based on RTL)
- Clear button: Optional

### Select/Dropdown
- Same as Text Input
- Icon: Chevron (right in LTR, left in RTL)
- Options: Dropdown menu

---

## ✅ Checkbox & Radio

### Checkbox
```
☑ Checkbox label
```

**States:**
- Unchecked: Empty box
- Checked: Checkmark
- Indeterminate: Dash
- Disabled: Grayed out

### Radio Button
```
◉ Radio option
```

**States:**
- Unselected: Empty circle
- Selected: Filled circle
- Disabled: Grayed out

---

## 🔘 Toggle Switch

```
ON  ⚪ ─────── OFF
```

**Properties:**
- Width: 48px
- Height: 24px
- Border Radius: 12px
- Animation: 300ms ease-out

---

## 📋 Modal / Dialog

```
┌──────────────────────────────────┐
│  Modal Title                   ✕ │
├──────────────────────────────────┤
│                                  │
│  Modal content goes here         │
│                                  │
├──────────────────────────────────┤
│  [Cancel]              [Confirm] │
└──────────────────────────────────┘
```

**Properties:**
- Background: White with shadow
- Border Radius: 16px
- Padding: 24px
- Overlay: Semi-transparent dark
- Animation: Fade in 300ms

---

## 🗂️ Navigation Components

### Sidebar Navigation
```
┌─────────────┐
│ WASSEL LOGO │
├─────────────┤
│ 📊 Overview │
│ 👥 Leads    │
│ 📢 Campaign │
│ ⚙️ Settings │
└─────────────┘
```

**Properties:**
- Width: 256px (collapsible)
- Background: White
- Border Right: 1px Light Gray
- RTL: Flips to right side

### Top Navigation
```
┌────────────────────────────────────────┐
│ WASSEL  [Search] [Profile] [Settings] │
└────────────────────────────────────────┘
```

**Properties:**
- Height: 64px
- Background: White
- Border Bottom: 1px Light Gray
- Sticky: Top of page

### Breadcrumb
```
Home > Campaigns > Campaign Name
```

**Properties:**
- Separator: ">"
- RTL: Reverses order
- Links: Clickable

---

## 📊 Data Table

```
┌──────────┬──────────┬──────────┐
│ Header 1 │ Header 2 │ Header 3 │
├──────────┼──────────┼──────────┤
│ Data 1   │ Data 2   │ Data 3   │
│ Data 1   │ Data 2   │ Data 3   │
│ Data 1   │ Data 2   │ Data 3   │
└──────────┴──────────┴──────────┘
```

**Properties:**
- Header: Bold, background color
- Rows: Alternating hover effect
- Pagination: Below table
- Sortable: Click headers
- Responsive: Horizontal scroll on mobile

---

## 🚨 Alert Components

### Success Alert
```
✓ Operation completed successfully
```
- Background: Light Green
- Border: Left 4px Green
- Icon: Checkmark

### Warning Alert
```
⚠ Please review this action
```
- Background: Light Amber
- Border: Left 4px Amber
- Icon: Warning triangle

### Error Alert
```
✕ An error occurred
```
- Background: Light Red
- Border: Left 4px Red
- Icon: X mark

### Info Alert
```
ℹ Here's some information
```
- Background: Light Blue
- Border: Left 4px Blue
- Icon: Info circle

---

## 🏷️ Badge Components

### Primary Badge
```
Primary
```
- Background: Light Blue
- Text: Deep Blue
- Border Radius: Full (pill)

### Success Badge
```
Success
```
- Background: Light Green
- Text: Dark Green

### Warning Badge
```
Warning
```
- Background: Light Amber
- Text: Dark Amber

### Error Badge
```
Error
```
- Background: Light Red
- Text: Dark Red

---

## ⏳ Loading States

### Spinner
```
  ⟳
```
- Animation: Rotating 360°
- Duration: 1s
- Color: Deep Blue

### Skeleton
```
████████████
████████████
████████████
```
- Animation: Pulsing
- Duration: 1.5s
- Color: Light Gray

### Progress Bar
```
████████░░░░░░░░░░░░
```
- Height: 4px
- Color: Deep Blue
- Background: Light Gray

---

## 📭 Empty States

```
┌──────────────────────────┐
│                          │
│         📭               │
│                          │
│    No data found         │
│                          │
│  [Create new item]       │
│                          │
└──────────────────────────┘
```

**Properties:**
- Icon: Large, light gray
- Title: Bold, centered
- Description: Secondary text
- Action: Primary button

---

## ⚠️ Error States

```
┌──────────────────────────┐
│                          │
│         ⚠️               │
│                          │
│    Something went wrong  │
│                          │
│  [Try again] [Go back]   │
│                          │
└──────────────────────────┘
```

**Properties:**
- Icon: Large, red
- Title: Bold, centered
- Description: Error details
- Actions: Retry + Alternative

---

## 🎬 Animations & Transitions

### Hover Transitions
- Duration: 150ms
- Easing: ease-out
- Properties: color, background, shadow

### Page Transitions
- Duration: 300ms
- Easing: ease-in-out
- Properties: opacity, transform

### Modal Animations
- Duration: 300ms
- Easing: ease-out
- Properties: transform, opacity

### Loading Animations
- Duration: 1-1.5s
- Easing: linear
- Properties: rotation, opacity

---

## 🌍 RTL Considerations

### Text Direction
- All text automatically right-aligned in RTL
- Logical properties used (start/end instead of left/right)

### Navigation
- Sidebar moves to right side
- Icons flip horizontally
- Chevrons reverse direction

### Spacing
- Padding/margin use logical properties
- Flexbox automatically reverses
- Grid respects direction

### Icons
- Some icons flip (arrows, chevrons)
- Others remain same (circles, crosses)

---

## ♿ Accessibility Features

### Focus States
- All interactive elements have visible focus ring
- Focus ring: 2px solid blue
- Outline offset: 2px

### Color Contrast
- All text meets WCAG AA standards
- Minimum 4.5:1 for normal text
- Minimum 3:1 for large text

### Keyboard Navigation
- All components keyboard accessible
- Tab order is logical
- No keyboard traps

### ARIA Labels
- Buttons have descriptive labels
- Form inputs have associated labels
- Icons have alt text

---

## 📐 Spacing Reference

| Size | px | Usage |
|------|----|----|
| xs | 4 | Micro spacing |
| sm | 8 | Compact spacing |
| md | 16 | Default spacing |
| lg | 24 | Generous spacing |
| xl | 32 | Large sections |
| 2xl | 48 | Major sections |
| 3xl | 64 | Page margins |

---

## 🔄 Component States

### Button States
- Default
- Hover
- Active
- Focus
- Disabled

### Input States
- Empty
- Filled
- Focus
- Error
- Disabled
- Loading

### Card States
- Default
- Hover
- Active
- Loading
- Error

---

## 📚 Implementation Notes

### Do's ✅
- Use design tokens consistently
- Test in RTL mode
- Verify keyboard navigation
- Check color contrast
- Test on multiple devices

### Don'ts ❌
- Don't mix colors arbitrarily
- Don't remove focus indicators
- Don't use placeholder as label
- Don't forget RTL testing
- Don't over-decorate

---

**Next Steps:**
1. Review component previews
2. Approve design direction
3. Proceed to Phase 4 (Landing Page)

---

**Last Updated:** 2026-02-28  
**Status:** Design System Complete - Awaiting Approval
