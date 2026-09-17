---
name: Executive Precision
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#434655'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#784b00'
  on-tertiary: '#ffffff'
  tertiary-container: '#996100'
  on-tertiary-container: '#ffeedd'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  title-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  caption:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-2xs: 0.25rem
  space-xs: 0.5rem
  space-sm: 0.75rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
---

## Brand & Style

This design system embodies modern operational rigor, precision, and clarity. Crafted for high-velocity SaaS workflows, e-commerce management, and business administration, the visual language prioritizes utility and immediate comprehension over decorative excess. 

The aesthetic is grounded in **Modern Corporate Precision**—characterized by clean slate foundations, crisp 1px structural borders, deliberate micro-elevations, and high-visibility status indicators. Every surface, table row, form control, and metric card is engineered to reduce visual fatigue during prolonged operational sessions while instilling trust, order, and control.

## Colors

The palette is engineered around functional contrast and standard operational semantics.

- **Primary (`#2563EB`)**: Royal blue utilized strictly for high-priority interactive touchpoints, primary actions ("+ Add Product", "Save", "Login"), active navigation states, and focused input indicators.
- **Secondary / Success (`#10B981`)**: Vivid emerald paired with a light mint container (`#ECFDF5`) for positive confirmations, "In Stock", "Active", and "Confirmed" lifecycle tags.
- **Tertiary / Warning (`#F59E0B`)**: Warm amber with amber-tinted backdrops (`#FFFBEB`) signaling transient states, "Pending" queues, or "Low Stock" inventory warnings.
- **Critical / Danger (`#EF4444`)**: Balanced rose-red with light red containers (`#FEF2F2`) reserved for destructive actions, validation alerts, and "Inactive" status badges.
- **Neutral & Canvas Foundations**: Built on slate tones. The global application canvas is `#F8FAFC`, while functional cards, modals, table surfaces, and sidebars utilize pure `#FFFFFF`. Dividers and subtle container borders maintain a precise 1px stroke of `#E2E8F0`. High-emphasis typography sits at `#0F172A`, supporting copy at `#64748B`, and placeholder tokens at `#94A3B8`.

## Typography

Typography relies on **Plus Jakarta Sans** throughout the suite to combine contemporary geometric legibility with humanist warmth. 

- Numeric values in KPI summary tiles and inventory data tables leverage standard tabular figures (`tnum`) for consistent vertical alignment across dense lists.
- Headers are concise, direct, and tightly tracked (`-0.01em` to `-0.02em` letter spacing on display variants) to maintain commanding structure without consuming excessive vertical space.
- Interactive labels and table headers enforce medium-weight styling (`500` or `600`) to guarantee unmistakable contrast against neutral backgrounds.

## Layout & Spacing

The application architecture utilizes a persistent collapsible navigation sidebar (fixed at `240px` on desktop) paired with a responsive 12-column fluid content canvas.

- **Breakpoints**:
  - `Desktop (>= 1280px)`: 12 columns, `1.5rem` (24px) gutters, `2rem` (32px) margins.
  - `Tablet (768px - 1279px)`: 8 columns, `1rem` (16px) gutters, `1.5rem` (24px) margins. Sidebar collapses to an icon bar (`64px`) or an off-canvas drawer.
  - `Mobile (< 768px)`: 4 columns, `0.75rem` (12px) gutters, `1rem` (16px) margins. Dual-column form sections reflow into single-column vertical stacks.
- **Rhythm**: Component interiors are built on multiples of 4px. Metric grids adapt from 4 columns on large screens to 2 columns on tablet, collapsing to 1 column on handheld displays.

## Elevation & Depth

Visual hierarchy is maintained through **subtle structural outlines complemented by gentle ambient drop shadows**, avoiding deep blurs or muddy overlays.

- **Layer 0 (Canvas)**: Surface base `#F8FAFC` provides the foundational layer.
- **Layer 1 (Card & Pane Elevation)**: Pure white (`#FFFFFF`) containers framed with a hairline border (`1px solid #E2E8F0`) and an ambient shadow (`0 1px 3px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.02)`).
- **Layer 2 (Dropdowns, Popovers & Context Menus)**: Bordered containers elevated with (`0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.03)`).
- **Layer 3 (Modals & Slide-out Panels)**: Heavy ambient diffusion (`0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.04)`) overlaid on a 40% opacity slate backdrop (`rgba(15, 23, 42, 0.40)`).

## Shapes

The interface embraces a **Soft/Balanced** geometric contour language (Level 1).

- Core interactive controls (buttons, inputs, select triggers, metric cards) feature a `6px` (`0.375rem`) to `8px` (`0.5rem`) corner radius.
- Large panels, modal dialogs, and primary listing containers utilize `8px` to `12px` (`0.75rem`).
- Status chips, badge tags, and pill toggles employ full rounded caps (`9999px`) to immediately delineate informative state tokens from square action controls.

## Components

### Buttons
- **Primary**: Solid `#2563EB` fill, white text, subtle hover shade (`#1D4ED8`), active state (`#1E40AF`). Height: 38px (medium), 32px (small). Padding: 16px horizontal.
- **Secondary / Outline**: 1px border `#E2E8F0`, `#0F172A` text, hover `#F8FAFC`.
- **Ghost**: Transparent fill, `#64748B` text, hover background `#F1F5F9`. Used for table row actions (`···`), pagination step arrows, and sub-actions.

### Input Fields & Controls
- **Text Inputs & Selects**: Height 38px, background `#FFFFFF`, border `1px solid #E2E8F0`, placeholder `#94A3B8`. Focus state applies an active ring: `border-color: #2563EB` with `box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12)`.
- **Search Bars**: Integrated left-aligned search icon (`#94A3B8`), input field with embedded clear triggers.
- **Checkboxes & Radios**: Custom 16x16px boxes with `#2563EB` checked state and white glyphs.

### Status Pills & Chips
- Fully rounded pills (`border-radius: 9999px`) with padding `2px 10px` and text `label-sm`.
- **Success / In Stock / Active**: Background `#ECFDF5`, text `#059669`.
- **Warning / Low Stock / Pending**: Background `#FFFBEB`, text `#D97706`.
- **Inactive / Critical**: Background `#FEF2F2`, text `#DC2626`.

### Data Tables
- Header row fixed height 40px, background `#F8FAFC`, uppercase label style `caption`, text `#64748B`, bottom divider `1px solid #E2E8F0`.
- Body rows fixed height 52px, alternating or clean white with hover state `#F8FAFC`. Vertical padding 12px, horizontal cell padding 16px. Sticky headers on scrollable viewports.

### Cards & Metrics
- Metric summary tiles feature clean numeric hierarchy (`headline-lg`), contextual icon containers (`36x36px` soft slate or blue tint), and descriptive titles (`body-sm` in `#64748B`).
- Media upload droppable zones leverage dashed borders (`1.5px dashed #CBD5E1`) over `#F8FAFC` with central SVG upload icons.