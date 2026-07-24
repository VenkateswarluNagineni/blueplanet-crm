# BluePlanet Design System  
### *Quarried Luxury · Operational Clarity · Award-Grade Craft*

> **North star:** The UI should feel like a private showroom for natural stone — dark basalt, a gold vein of light, and sodalite blue accents — while remaining denser and faster than any consumer SaaS template.

**Version:** 1.5 · **Status:** Canonical (premium OS craft floor) · **Brand:** BluePlanet (do not rebrand)

### v1.5 craft notes (premium altitude)
- **Anti-tutorial copy:** no “Open module →”, no marketing subtitles under attention strips.
- **Attention:** exceptions only; meta chips only for approvals/overdue — not duplicate KPI restatements.
- **Card hover:** border + shadow only; no translateY bounce.
- **Tables:** ~36px rows (8–10px cell padding); sticky thead; mono IDs via `.bp-id`.
- **Passport timeline:** `.bp-timeline-node--done|active|pending` (emerald / vein gold / basalt dashed).
- **CTAs:** always `btn-primary` / `Button` — never ad-hoc gold hex fills on primary actions.
- **Chanel rule:** each UI PR removes at least as much chrome as it adds.

---

## 1. Design thesis

### 1.1 Inspiration synthesis (Pinterest / Dribbble / luxury B2B)

| Source pattern | What we take | What we reject |
|----------------|--------------|----------------|
| **Luxury dark dashboards** (obsidian + champagne gold) | Deep blacks, warm metallics, high contrast KPIs | Neon gamification, purple gradients |
| **Marble / jewelry brand sites** | Material honesty, serif display, sparse hero moments | Over-photography that hides data |
| **Linear / Vercel-class tools** | Ruthless hierarchy, keyboard-first, quiet motion | Empty whitespace that wastes warehouse operators |
| **Bloomberg / trading terminals** | Information density, tabular nums, status color codes | Cluttered chrome, 12 competing accent colors |
| **Stone architecture sections** | Layered strata (sidebar → surface → lift cards) | Flat single-plane gray boxes |

### 1.2 Product personality

| Axis | BluePlanet position |
|------|---------------------|
| Mood | **Quiet confidence** — never loud, never cute |
| Material | **Basalt + gold vein + sodalite** |
| Tempo | **Decisive** — click → work, not explore → wander |
| Density | **Professional** — data-first with breathing room at edges |
| Craft | **Award-level** — shadows, radii, type, and focus states intentional |

### 1.3 One-sentence brief

> *BluePlanet is the operating system of a stone empire: every slab’s passport, every deal’s gravity, rendered in basalt and vein gold.*

---

## 2. Brand foundations

### 2.1 Logo & mark

- **BrandMark:** three horizontal strata (gold / sodalite / basalt) in a rounded square — geological section.
- **Wordmark:** Fraunces, weight 600, tight tracking.
- Clear space: ≥ 0.5× mark height around the logo lockup.
- Never recolor the strata; never stretch the mark.

### 2.2 Color system

#### Core palette (token names)

| Token | Hex | Role |
|-------|-----|------|
| `--bp-basalt-950` | `#121113` | Deepest canvas (sidebar void, modals) |
| `--bp-basalt-900` | `#1c1c1c` | Sidebar / elevated chrome |
| `--bp-basalt-850` | `#242326` | App background |
| `--bp-basalt-800` | `#2b2a2c` | Primary page background (legacy) |
| `--bp-basalt-700` | `#333234` | Surface / card |
| `--bp-basalt-600` | `#3f3e41` | Hover surface |
| `--bp-basalt-500` | `#454446` | Border |
| `--bp-vein-gold` | `#e3c16c` | Primary action, active nav, key metrics |
| `--bp-vein-gold-hover` | `#d2ac55` | Primary hover |
| `--bp-vein-gold-muted` | `rgba(227,193,108,0.12)` | Soft gold fills |
| `--bp-sodalite` | `#92b0ce` | Secondary accent, links, info |
| `--bp-sodalite-muted` | `rgba(146,176,206,0.12)` | Soft blue fills |
| `--bp-fog-100` | `#ffffff` | Primary text |
| `--bp-fog-300` | `#d9d8d9` | Body muted |
| `--bp-fog-400` | `#b8b6b9` | Secondary / labels |
| `--bp-fog-500` | `#7d7c7f` | Tertiary / hints |
| `--bp-emerald` | `#10b981` | Success / available / paid |
| `--bp-coral` | `#e8956b` | Warning / overdue soft |
| `--bp-ruby` | `#ef4444` | Danger / error |
| `--bp-amethyst` | `#b58cd6` | Pipeline / deals |

#### Semantic mapping

| Use | Token |
|-----|--------|
| Page canvas | `basalt-850` / `basalt-800` |
| Cards | `basalt-700` + 1px `basalt-500` border + soft elevation |
| Primary CTA | `vein-gold` on `basalt-950` text |
| Links / focus | `sodalite` |
| Positive status | `emerald` |
| Destructive | `ruby` |

#### Rules

1. **Gold is scarce.** Primary buttons, active nav rail, hero KPIs only — never full-width gold backgrounds.
2. **One accent per region.** Don’t mix gold + amethyst + sodalite in the same 40px chip row without hierarchy.
3. **Borders > heavy fills** for structure. Prefer hairline borders and lift shadows over thick colored blocks.

### 2.3 Typography

| Role | Family | Weight | Size | Tracking | Use |
|------|--------|--------|------|----------|-----|
| **Display** | Fraunces | 500–600 | 22–28px | −0.02em | Page titles, KPI values |
| **Title** | Fraunces | 500 | 18–20px | −0.01em | Drawer titles, section heroes |
| **Body** | Inter | 400 | 13px | 0 | Tables, forms, paragraphs |
| **Label** | Inter | 500 | 11px | 0.06em uppercase | Eyebrows, column headers |
| **Mono** | ui-monospace / system | 500 | 12–13px | 0 | SO/PO/slab IDs |

**Type rules**

- KPI big numbers always **Fraunces + tabular-nums**.
- Never set body copy in Fraunces.
- Line length for descriptive text ≤ ~68ch.
- Table headers: 11px uppercase fog-400, not bold black on dark.

### 2.4 Spacing scale (4px base)

```
2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64
```

| Context | Spacing |
|---------|---------|
| Page padding | 24px (`p-6`) |
| Card padding | 16–20px |
| Stack between sections | 24px |
| Compact table cell | 12px vertical |
| Sidebar item | 8px vertical |

### 2.5 Radius

| Token | Value | Use |
|-------|-------|-----|
| `radius-sm` | 6px | Inputs, chips |
| `radius-md` | 8px | Buttons, small cards |
| `radius-lg` | 12px | Primary cards, drawers |
| `radius-xl` | 16px | Hero panels, command palette |

### 2.6 Elevation (dark-mode shadows)

```css
/* Lift 1 — resting card */
box-shadow: 0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.28);

/* Lift 2 — hover / interactive */
box-shadow: 0 1px 0 rgba(255,255,255,0.06) inset, 0 12px 32px rgba(0,0,0,0.4);

/* Lift 3 — modal / drawer */
box-shadow: 0 24px 64px rgba(0,0,0,0.55);
```

### 2.7 Motion

| Motion | Duration | Easing | Use |
|--------|----------|--------|-----|
| Micro | 120–180ms | ease | Hover, focus |
| Panel | 220–280ms | cubic-bezier(0.22, 1, 0.36, 1) | Drawer, toast |
| Page | none / 150ms fade | — | Prefer instant navigation |

Respect `prefers-reduced-motion`. No bounce. No springy menu thrash.

---

## 3. Layout architecture

```
┌────────────┬────────────────────────────────────────────┐
│  SIDEBAR   │  HEADER (command + identity)               │
│  240 / 64  ├────────────────────────────────────────────┤
│  basalt-900│  PAGE HEADER (eyebrow · title · meta)      │
│            ├────────────────────────────────────────────┤
│  groups:   │                                            │
│  Inventory │   CONTENT CANVAS  (basalt-850)             │
│  Sales     │   cards · tables · boards                  │
│  Supply    │                                            │
│  Ops       │                                            │
└────────────┴────────────────────────────────────────────┘
```

### 3.1 Sidebar

- Width expanded **240px**, collapsed **64px**.
- Active item: basalt-700 fill + **2px gold left rail** + gold icon.
- Groups: 10px uppercase tracking-wide fog-500 labels.
- Footer: role chip + Ctrl+K hint (already shipped).

### 3.2 Page header

- Eyebrow (module group) → Title (Fraunces 20) → Subtitle → Meta chips.
- Toolbar (ListToolbar) sits **inside** header as second row.
- Breadcrumbs for nested Ops/Supply routes.

### 3.3 Content patterns

| Pattern | When |
|---------|------|
| **Command board** | Home — KPI grid + attention strip + charts |
| **Dense table** | Orders, Purchases, Inventory |
| **Kanban** | Pipeline |
| **Passport drawer** | Slab lineage (right sheet 640–720px) |
| **Form drawer** | CRM party create/edit |

---

## 4. Component inventory (target craft)

### 4.1 Surfaces

| Component | Spec |
|-----------|------|
| **Card** | `bg-basalt-700` · `border-basalt-500` · `radius-lg` · Lift 1 · hover Lift 2 if clickable |
| **Glass bar** | Header: basalt-900/90 + backdrop-blur 12px (optional polish) |
| **Vein panel** | `.vein` only on login hero, empty command boards, brand moments — not every card |

### 4.2 Buttons

| Variant | Spec |
|---------|------|
| **Primary** | Gold fill, basalt text, radius-md, 13px medium |
| **Secondary** | Transparent + border basalt-500, fog-100 text |
| **Ghost** | No border until hover |
| **Danger** | Ruby outline / soft fill |
| **Icon** | 32×32 hit target, fog-400 → fog-100 |

### 4.3 Inputs

- Height 36px, basalt-950/800 fill, basalt-500 border.
- Focus: sodalite border + 2px gold focus-visible ring (a11y).
- Placeholder: fog-500.

### 4.4 Data

| Element | Spec |
|---------|------|
| **Table** | Sticky header basalt-700, 13px body, mono for IDs, hover basalt-600/40 |
| **KPI** | Icon tile in muted accent, Fraunces value 22px, label 11px uppercase |
| **StatusPill** | Soft fill + border matching semantic color |
| **EmptyState** | Centered, fog-500 icon, short title, one action |

### 4.5 Overlays

| Element | Spec |
|---------|------|
| **Drawer** | Right sheet, basalt-800 body, basalt-900 header, Lift 3 |
| **Modal** | Centered, max-w-lg/2xl, backdrop black/60 |
| **Command palette** | max-w-lg, radius-xl, basalt-900, grouped results |

---

## 5. Screen-level design directions

### 5.1 Login

- Split: left **vein** hero (stone manifesto), right quiet form.
- Wordmark + Fraunces headline already strong — keep.
- Primary CTA gold full-width; demo account chips as secondary.

### 5.2 Command Center (Home)

- Attention strip as **first** visual (urgency).
- KPI cards clickable with gold hover edge.
- Charts in paired grid; “Open →” affordance on hover.

### 5.3 Inventory / Slabs

- Passport is the product’s *signature moment* — treat as a museum label:
  - Hero strip: product name, slab ID, status, location
  - Timeline nodes 1–4 with consistent iconography
  - Cost fields gold only when permitted

### 5.4 Pipeline

- Columns as basalt cards; stage color = single accent per column.
- Deal cards: soft lift on hover; probability bar emerald.
- Empty columns: intentional CTA, not “Empty” italic only.

### 5.5 Vendor portal

- Same basalt system, calmer density.
- Shared logistics stage bar for brand continuity with Admin Supply.

---

## 6. Accessibility & inclusion

| Requirement | Spec |
|-------------|------|
| Contrast | Body text ≥ 4.5:1 on basalt-800; gold on basalt ≥ 4.5:1 for text |
| Focus | Visible gold ring 2px offset 2px on all interactive |
| Hit targets | ≥ 32px interactive height |
| Reduced motion | Honor media query (already global) |
| Color alone | Status always has text/label, not color-only |

---

## 7. Do / Don’t

### Do
- Use **Fraunces for money and titles** only.
- Prefer **token classes** over raw hex in new code.
- Keep **gold scarce**.
- Design for **operators on 1440px** first, then collapse gracefully.
- Put **primary action top-right** of page header.

### Don’t
- Don’t invent a second green or second gold.
- Don’t put vein wash behind data tables.
- Don’t animate every hover with scale transforms.
- Don’t use pure black `#000` for large areas (use basalt-950).
- Don’t mix Inter headings with Fraunces body.

---

## 8. Implementation roadmap (architect plan)

### Phase A — Foundation (tokens & primitives) · **done**
1. Expand `globals.css` with full basalt/vein/sodalite tokens + elevation utilities.
2. Add utility classes: `.bp-card`, `.bp-card-interactive`, `.bp-lift-1/2/3`.
3. Refine `PageHeader`, `KpiCard`, `ListToolbar`, `Badge` to consume tokens.
4. Sidebar: softer group labels, refined active state, optional subtle top vein on brand lockup.

### Phase B — Shell & Home · **done**
1. Header: glass bar (`.bp-glass-bar`) + denser command search.
2. Command Center: `.bp-attention` strip, KPI hover language unified.
3. Login: tokenized form geometry + vein hero polish.

### Phase C — High-traffic modules · **done**
1. Orders + Purchasing tables: `.bp-table-shell` / `.bp-table`, mono IDs, row hit state.
2. Pipeline board: `.bp-kanban-col` / `.bp-kanban-card` + empty CTAs.
3. Inventory passport: museum-label hero (`.bp-passport-hero`) + material swatch + meta cards.

### Phase D — Coherence pass · **done** (v1.3 sweep)
1. Shell primitives (Header, Drawer, Badge, Sidebar, CommandPalette) on tokens.
2. Vendor portal, LogisticsStageBar, FacetCard, Vendor KPIs on shared card language.
3. Bulk token migration across Catalog, CRM, Analytics, Orders, Purchases, Pipeline, Inventory, Approvals, Logistics.
4. Motion: drawer enter + reduced-motion honored globally.

### Phase E — Signature moments · **done**
1. CSS material swatches: catalog gallery heroes + passport (via `swatchBaseForMaterial`).
2. Packing slip: warm paper document, Fraunces titles, print CSS (`.bp-print-slip`).

---

## 9. Success criteria

| Metric | Target |
|--------|--------|
| Visual consistency | Same card language on Home, Orders, Purchases, Vendor |
| Operator speed | No extra clicks vs current; toolbars stay ≤ 1 row |
| Brand recall | Gold vein + Fraunces KPI instantly recognizable |
| Test safety | Existing Playwright 150 suite still green after UI changes |
| Diff discipline | Prefer tokens + primitives; avoid mega-client rewrites in Phase A |

---

## 10. References (study set)

*Internal synthesis inspired by patterns commonly found on Pinterest / Dribbble under:*

- “Dark luxury admin dashboard”
- “Obsidian gold UI kit”
- “Marble brand identity dark”
- “Fintech dark dashboard champagne”
- “Architectural portfolio black gold”
- Linear, Vercel, Stripe Dashboard (hierarchy & restraint)
- Natural stone showroom lighting (warm accent on dark field)

*BluePlanet does not copy any single template; it merges material luxury with ERP density.*

---

## 11. Ownership

| Artifact | Location |
|----------|----------|
| This document | `/DESIGN.md` |
| Craft execution plan | `/UI_CRAFT_PLAN.md` |
| CSS tokens | `src/app/globals.css` |
| Brand mark | `src/components/brand/Wordmark.tsx` |
| Primitives | `src/components/ui/*` |

**When in doubt:** open this file, not a random Tailwind palette generator.

---

*Crafted as the canonical design constitution for BluePlanet CRM — basalt, vein, and clarity.*
