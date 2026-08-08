# BluePlanet UI Craft Plan  
### *Award-grade · Interesting · Operational*

**Version:** 1.0 · **Date:** 2026-07-18  
**Inputs:** Multi-agent research (luxury dark dashboards, stone B2B UX) + full codebase audit vs `DESIGN.md` v1.3  
**North star:** *Materials house operating system* — basalt, scarce vein gold, slab identity — never generic SaaS.

---

## 1. Research synthesis (what we studied)

### 1.1 Luxury dark / high-density ops
| Pattern | Takeaway for BluePlanet |
|---------|-------------------------|
| Obsidian surface stack | Page → rail → panel → row; hairline borders + lift, not flat gray boxes |
| Vein-gold restraint | Gold only: primary CTA, active nav rail, focus, passport seal — never status fills |
| Bloomberg/Linear tables | 32–36px rows, mono IDs, sticky header + filters, batch bar only when selected |
| Master–detail inspector | Side panel keeps list context; no modal-only multi-field edit |
| Semantic status (not gold) | Emerald / sodalite / coral / ruby pills; reserved = thin gold *border* only |
| Sticky ops chrome | Glass header + sticky filter strip; no scroll thrash |
| Command palette | Already shipped — keep as power rail |

### 1.2 Stone industry B2B
| Pattern | Takeaway |
|---------|----------|
| Slab is the object | Never hero “47 in stock” without identity |
| Passport as travel document | Museum label + timeline + QR-ready identity |
| Block family continuity | “Mates from same lot/block” (future signature) |
| Reservation ceremony | Quiet gold status change, not confetti |
| CSS swatch gallery | No lifestyle stock photos as default |
| Deal board with material gravity | Mini swatches + hold risk on cards |
| Commercial docs as brand | Packing slip already paper-crafted — keep print tokens |

### 1.3 Anti-patterns (ban list)
- Purple gradients, emoji gamification, rainbow status  
- Second gold/amber warning system (ROP bands in pure amber)  
- AI “propensity rocket” chrome  
- Confetti / bounce celebrations  
- Inventory as SKU-count cards only  
- Raw tables that ignore `.bp-table` while Orders looks premium  

---

## 2. Audit scorecard (current product)

| Layer | Score | Notes |
|-------|-------|-------|
| Tokens / CSS primitives | **A** | globals.css is the constitution |
| Shell (Sidebar, Header, PageHeader) | **A−** | Glass bar, gold rail strong |
| Orders / Purchases tables | **B+** | Reference implementation |
| Catalog gallery + passport hero | **B+** | Signature moments land |
| Inventory main table | **C** | Daily ops — still pre-Phase C chrome |
| Analytics | **C−** | Tailwind blues/ambers, marketing jargon |
| Pipeline tone | **C+** | Kanban good; emoji/AI banner breaks quiet luxury |
| Shared Modal / Button | **D** | CSS exists; React wrappers missing |
| E2E safety | **C** | Text-based selectors; harden before copy rewrites |

---

## 3. Execution waves

### Wave 0 — Safety (before copy rewrites)
**Goal:** Protect 150 Playwright suite.

| # | Task | Files |
|---|------|-------|
| 0.1 | Add additive `data-testid`s: `orders-search`, `passport-root`, `passport-title`, timeline nodes | Orders, Inventory passport |
| 0.2 | Do **not** rename “Material Passport”, “Orders”, timeline “1. Supplier Origin…” until tests use testids |

### Wave 1 — One table, one shell (P0 · highest impact)
**Goal:** Every high-traffic list feels like the same product.

| # | Task | Files | Pattern |
|---|------|-------|---------|
| 1.1 | Inventory grid → `bp-table-shell` / `bp-table` + EmptyState | `InventoryTableClient.tsx` | High-density ops table |
| 1.2 | Catalog list → `bp-table`; header → PageHeader language already partial | `CatalogDashboardClient.tsx` | Dual gallery/table |
| 1.3 | Analytics ledger → full `bp-table`; kill blue/amber defaults | `AnalyticsDashboardClient.tsx` | Token status |
| 1.4 | CRM primary tables → `bp-table-shell` where practical | `CrmDashboardClient.tsx` | Coherence |

### Wave 2 — Quiet luxury personality (P0–P1)
**Goal:** Interesting without cute; gold scarce.

| # | Task | Files |
|---|------|-------|
| 2.1 | Pipeline: remove 🚀 / stalemate emoji; restyle AI banner as quiet meta strip; Closed Lost → ruby | `PipelineClient.tsx` |
| 2.2 | Catalog ROP band → coral/`bp-attention` language (no second gold) | `CatalogDashboardClient.tsx` |
| 2.3 | Toast danger → ruby; remove bounce toasts | `Toast.tsx`, Inventory |
| 2.4 | Dashboard teal `#5db5b5` → sodalite or emerald | `CustomizableDashboard.tsx` |
| 2.5 | Status pills consistency (reserved = gold *border*) | `Badge.tsx` |

### Wave 3 — Signature moments (P1 · “interesting”)
**Goal:** Moments only BluePlanet can own.

| # | Task | Files |
|---|------|-------|
| 3.1 | Passport on shared `Drawer` geometry (keep all copy for E2E) | `InventoryTableClient.tsx`, `Drawer.tsx` |
| 3.2 | Passport timeline: clearer node rings (done/active/pending), gold only on cost | Passport body |
| 3.3 | Pipeline deal cards: optional mini material line (if data available) | `PipelineClient.tsx` |
| 3.4 | Catalog card hover: reveal rack/location meta if present | Gallery cards |
| 3.5 | Empty states: quiet craft copy (no blobs) everywhere inventory/pipeline | EmptyState consumers |

### Wave 4 — Primitives & craft floor (P1)
**Goal:** No more one-off modals.

| # | Task | Files |
|---|------|-------|
| 4.1 | `ui/Modal.tsx` — lift-3, basalt-900 header, footer actions | New + Orders/Pipeline/Catalog |
| 4.2 | `ui/Button.tsx` wrapping btn-primary/secondary/ghost/danger | Shared |
| 4.3 | Form pass: `bp-input` / `bp-select` + focus-visible gold | Forms |
| 4.4 | Header settings trigger → real `<button>` | `Header.tsx` |
| 4.5 | Single interactive `KpiCard` API | ui + dashboards |

### Wave 5 — Future signatures (P2 · after waves 1–4)
| # | Idea | Notes |
|---|------|-------|
| 5.1 | ~~Block family “mates” strip in passport~~ ✅ | `getBlockMates`, `PassportMatesStrip` (item 26) |
| 5.2 | ~~Reservation ceremony micro-interaction~~ ✅ | Sales+Admin hold/release, gold row/status, reserve toast (item 21) |
| 5.3 | QR deep-link passport print | External share |
| 5.4 | Remnant as first-class status | Domain work |

---

## 4. Visual recipes (implement exactly)

### Dense table
```
shell: .bp-table-shell
thead: basalt-700 sticky, 11px uppercase fog-400
row: 36px, hover basalt-800/85, hit = gold wash
IDs: .bp-id mono
money: .bp-money emerald
```

### Attention (not amber scream)
```
.bp-attention header wash gold/sodalite
urgent count: vein gold Fraunces
no solid amber full-width bars
coral for soft warning text only
```

### Passport
```
.bp-passport-hero + .bp-swatch
h2 “Material Passport” UNCHANGED (E2E)
timeline nodes: emerald done · gold active · basalt pending
```

### Motion
```
micro 120–180ms ease
drawer 220–280ms cubic-bezier(0.22, 1, 0.36, 1)
NO bounce, NO spring menus, honor prefers-reduced-motion
```

---

## 5. Success criteria

1. Operator cannot tell Catalog / Inventory / Orders were built in different eras.  
2. Gold appears ≤ 1 primary action + active nav + passport seal per viewport.  
3. Passport still opens from `?slab=` and E2E strings hold (or testids replace them).  
4. Pipeline feels like a materials deal board, not a gamified SaaS.  
5. Analytics reads as basalt executive ledger, not blue Tailwind demo.  
6. `tsc --noEmit` green; optional: 150 e2e green after Wave 0.

---

## 6. Invoke progress

1. ~~Research agents~~ ✅  
2. ~~This plan~~ ✅  
3. ~~Wave 0–2 partial~~ ✅ (pipeline quiet, inventory table, analytics, ROP, toast, testids)  
4. ~~Wave 3 passport Drawer~~ ✅  
5. ~~Wave 4 Button + Modal~~ ✅ (Orders receipt, Pipeline convert/add, Catalog quote, ConfirmDialog)  
6. ~~Catalog master list bp-table~~ ✅  
7. ~~CRM tables → bp-table~~ ✅  
8. ~~Inventory bulk op Modal~~ ✅  
9. ~~Movements table + Locations inputs/cards~~ ✅  
10. ~~CRM viewing/add full Drawer migration~~ ✅  
11. ~~Locations add/edit Drawer~~ ✅  
12. Remaining optional: full e2e suite; CRM add form still IIFE+Drawer (works)  
13. ~~Premium Horizon 0.1 craft lint~~ ✅ (btn-primary CTAs, approvals coral, no amber demo)  
14. ~~Premium H1.1 slabs density~~ ✅ (36px table rows, quieter meta, a11y slab link)  
15. ~~Premium H1.2 passport timeline~~ ✅ (done/active/pending nodes + StatusPill status)  
16. ~~H1.3 Pipeline material gravity~~ ✅ (swatch match, at-risk chips, closed-lost ruby edge)  
17. ~~H1.4 Catalog dual-view lock~~ ✅ (soft filter badge, low-reserve gallery, list swatches, quote btn)  
18. ~~H1.5 Analytics ledger~~ ✅ (PageShell, no demo margins, real export JSON, empty state)  
19. Next: H2.1 Reservation ceremony → H2.4 CRM form craft → H3 signatures  
20. ~~gstack installed~~ ✅ (clone `.claude/skills/gstack`, Grok adapter `.grok/skills/gstack`, `GSTACK.md`)  
21. ~~H2.1 Reservation ceremony~~ ✅ (Sales+Admin hold/release, gold row/status, reserve toast, hold modal)  
22. ~~H2.4 CRM form craft~~ ✅ (section chrome, portal access callout, bp-select, quieter People chrome)  
23. ~~H2.2 Attention holds~~ ✅ (dashboard onHoldSlabs tile → /inventory?status=ON_HOLD)  
24. ~~CSO hold hardening~~ ✅ (max 100 bulk, reason length 200, soft RBAC errors, revalidate /)  
25. E2E: ensureAuthed + login retry; passport testid; flaky Docker caused mid-suite fail (97/150 last run)  
26. ~~H3.1 Block mates passport strip~~ ✅ (`getBlockMates`, `PassportMatesStrip`, seed bundleId, `e2e/passport-mates.spec.ts`, `docker-compose.yml`)  
27. ~~Consistency + primitives pass~~ ✅ (ruby/coral token sweep, Toast/Modal shadow match, dead teal killed, shared `ACCENT`/`statusColors.ts`, last 2 raw tables → `bp-table-shell`, Orders row actions → `.bp-row-action`, `ui/Switch.tsx`, `Button` adoption sweep app-wide, `ui/Input.tsx`/`ui/Select.tsx` primitives, KPI-card focus-visible regression fixed in `InventoryOverviewClient.tsx`)
28. Backlog (not forced, migrate opportunistically when these files are next touched): ~30 hand-rolled `focus:outline-none`/`focus:border-*` input/select instances in Catalog, CRM (×2), Movements, Purchasing, Pipeline, Inventory table, Command Palette not yet on `ui/Input.tsx`/`ui/Select.tsx` — each already has *some* focus indicator (border-color shift), so this is a consistency debt, not an a11y bug like the KPI-card Link was.


---

## 7. Ownership

| Artifact | Path |
|----------|------|
| Design constitution | `/DESIGN.md` |
| This craft plan | `/UI_CRAFT_PLAN.md` |
| Tokens | `src/app/globals.css` |

*When in doubt: basalt stack, gold scarce, slab is the object.*
