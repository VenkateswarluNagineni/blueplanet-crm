# BluePlanet Design System  
### *Quarried Luxury · Operational Clarity · Award-Grade Craft*

> **North star:** The UI should feel like a private showroom for natural stone — dark basalt, a gold vein of light, and sodalite blue accents — while remaining denser and faster than any consumer SaaS template.

**Version:** 2.0 · **Status:** Canonical (premium OS craft floor) · **Brand:** BluePlanet (do not rebrand)

### v2.0 craft notes (Legibility & Robustness Constitution)
Evidence-based, not aesthetic: every rule below exists because a real, verbatim user complaint about a competitor (Stone Profit Systems, 15 verified Capterra reviews read in full) named this exact failure. None of those 15 reviews complained about color, theme, or branding — every substantive complaint was functional. **Decision: the basalt/vein-gold/sodalite palette is retained, not replaced** — see §0 below for the full rationale. What changes is a set of mandatory rules that make legibility, overflow-safety, export consistency, and data-integrity guarantees explicit instead of implicit.
- **Legibility floor.** Body text never below 12px effective size in dense contexts. Secondary/supporting text that is the *only* label for a value (not a decorative caption) must be `fog-400` or brighter, never `fog-500` — `fog-500` is reserved for true hints/placeholders. *Answers: "Fonts not very comfortable to read."*
- **Overflow-safe layout contract.** Any container that can receive unbounded content (tables, drawers, long IDs/names, long email subjects) must declare its overflow behavior explicitly — `overflow-x-auto` + `.bp-col-pin`, `truncate` with a `title` tooltip, or wrap — and must never be allowed to silently clip or escape its region. `.bp-col-pin` (Orders, Sales, Inventory) is the canonical sticky-column pattern; reuse it, don't reinvent per screen. *Answers: "Display Screen - going outside the screen zones."*
- **One export pattern.** All file downloads/prints go through `src/lib/export.ts`'s shared `downloadFile()` helper — no per-screen ad-hoc Blob/data-URI variants. *Answers: "PDF/Excel format not uniform."*
- **Destructive Action Guardrail.** Any server action that creates a record *from* another record must never clear, zero, or silently mutate fields on the source record without an explicit, reviewable reason documented in a code comment. `advancePOAction` (PO → InventoryItem) and the reconciliation engine's approve/reject actions (PurchaseOrder → ReconciliationDelta) are the canonical correct examples — new features must match this bar, not drift from it as the app grows. *Answers: "the purchase order deletes the quantities of crates and slabs."*

### v1.6 craft notes (density & reconciliation)
- **Numeric data is mono.** Every $, sf, and count cell renders in `ui-monospace` with `tabular-nums`, right-aligned — never proportional Inter for a number a user needs to scan down a column (see §2.3).
- **Dense table mode is opt-in, not default.** `.bp-table--dense` (30px rows) exists for high-volume triage screens (reconciliation deltas, large inventory scans); `.bp-table` at 36px stays the default everywhere else.
- **Sticky-ID tables.** `.bp-col-pin` (already shipped, used by Orders/Sales) pins the identity column so it survives horizontal scroll — extend its adoption to any table that can grow past ~8 columns (Inventory).
- **Discrepancy is the one new status.** Vein-gold is reused (not a new hex) for "Price/Qty Discrepancy" because on the reconciliation screen, resolving it *is* the primary action — consistent with "gold is scarce," not an exception to it.

### v1.5 craft notes (premium altitude)
- **Anti-tutorial copy:** no “Open module →”, no marketing subtitles under attention strips.
- **Attention:** exceptions only; meta chips only for approvals/overdue — not duplicate KPI restatements.
- **Card hover:** border + shadow only; no translateY bounce.
- **Tables:** ~36px rows (8–10px cell padding); sticky thead; mono IDs via `.bp-id`.
- **Passport timeline:** `.bp-timeline-node--done|active|pending` (emerald / vein gold / basalt dashed).
- **CTAs:** always `btn-primary` / `Button` — never ad-hoc gold hex fills on primary actions.
- **Chanel rule:** each UI PR removes at least as much chrome as it adds.

---

## 0. Palette-retention decision (v2.0)

**Decision: the basalt / vein-gold / sodalite palette stays. It is not being replaced.**

This is recorded explicitly because permission to reskin was given and deliberately not used — so a future pass doesn't reopen the question without new evidence.

**Evidence reviewed:** the full text of 15 verified Capterra reviews of Stone Profit Systems (the dominant incumbent stone-shop ERP), SlabWise's independent SPS review, and SlabWise's 38-question stone-software buyer's checklist. Across all of it — every complaint, every checklist line, every "what to compare" criterion — **zero** mention color, theme, or visual style as a decision factor. Every substantive real-world complaint was functional: data integrity ("the purchase order deletes the quantities"), discoverability ("everything is vague and hard to find"), legibility ("fonts not very comfortable to read"), format consistency ("PDF/Excel not very uniform"), or friction ("additional steps to accomplish a simple task").

**Conclusion:** a reskin would optimize for a problem the evidence says doesn't exist, at the cost of the one thing competitors can't easily copy — SPS's own marketing site (screenshotted live) is a flat, un-grouped, 2012-era text-link sidebar with no visual hierarchy. BluePlanet's dark-luxury system is a validated differentiator, not a liability.

**What changed instead:** the v2.0 rules above (legibility floor, overflow-safety, export consistency, destructive-action guardrail) — mandatory engineering/UX discipline mapped 1:1 to real complaints, applied *within* the existing palette.

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
| Discrepancy / needs review | `vein-gold` (reused — the one status besides primary CTAs that earns gold, since resolving it is the screen's primary action) |

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
| **Numeric (money/qty)** | ui-monospace | 500 | 13px | 0 | Every $, sf, and count table cell — right-aligned, `tabular-nums` mandatory |
| **Delta (old → new)** | ui-monospace | 500 | 13px | 0 | Reconciliation diff rows — old value struck-through `fog-500`, new value in the field's normal color |

**Type rules**

- KPI big numbers always **Fraunces + tabular-nums**.
- Never set body copy in Fraunces.
- Line length for descriptive text ≤ ~68ch.
- Table headers: 11px uppercase fog-400, not bold black on dark.
- **Numeric table cells are mono + `tabular-nums`, right-aligned — no exceptions.** A column of dollar amounts or slab counts in proportional Inter is a legibility bug, not a style choice (formalized v1.6; see `.bp-num` in `globals.css`).

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
| **Table** | Sticky header basalt-700, 13px body, mono for IDs, hover basalt-600/40; numeric columns mono + `tabular-nums` right-aligned (`.bp-num`) |
| **Table — dense** | `.bp-table--dense`: 30px rows, 6/12px cell padding; opt-in per screen via toolbar toggle, never a global setting |
| **Table — sticky ID** | `.bp-col-pin`: pins the identity column via `position: sticky; left:0` with a scroll-seam shadow (already shipped on Orders/Sales); use past ~8 columns |
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
| Legibility floor (v2.0) | Body text never below 12px effective size in dense contexts; supporting-only labels ≥ `fog-400`, never `fog-500` |
| Overflow safety (v2.0) | Unbounded content (tables, long IDs/names) must use `.bp-col-pin` + `overflow-x-auto`, `truncate` + tooltip, or wrap — never silently clip/escape its container |

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

### Phase F — Density & reconciliation (v1.6) · **done**
1. Numeric-cell typography rule (`.bp-num`, mono + `tabular-nums`) formalized and rolled out to money/qty columns.
2. `.bp-table--dense` primitive added; `.bp-col-pin` (existing) adoption extended to Inventory.
3. New "Discrepancy" status (vein-gold, reused) backing the email-to-PO reconciliation workspace, shipped end-to-end (schema, ingestion, review UI).
4. Fabrication quote/estimator numeric columns audited against the mono/tabular-nums rule.

### Phase G — Legibility & Robustness Constitution (v2.0) · **in progress**
1. Palette-retention decision recorded (§0), backed by evidence from 15 competitor reviews — no reskin.
2. Legibility floor + overflow-safe layout contract formalized (§6).
3. `src/lib/export.ts` shared export helper — replaces 3 ad-hoc download idioms (Analytics, Purchasing ×2).
4. Destructive Action Guardrail documented; stale bulk-selection fixed in Inventory.
5. User Admin UI and Sales Order deposits/AR — real feature gaps found via buyer-checklist audit, not previously covered by any UI.

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
