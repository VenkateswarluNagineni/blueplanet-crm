# BluePlanet × gstack

**Upstream:** [garrytan/gstack](https://github.com/garrytan/gstack) (MIT)  
**Local tree:** `.claude/skills/gstack/` (v1.60+ shallow clone)  
**Grok skill:** `.grok/skills/gstack/SKILL.md`  
**Awesome-grok skills:** `.grok/skills/*` (still primary for day-to-day code)

---

## What gstack is

A **sprint process** that turns the agent into a virtual team:

Think → Plan → Build → Review → Test → Ship → Reflect

Not more chrome. Not a second design system. Process discipline on top of `DESIGN.md`.

---

## Install / refresh

```powershell
# From repo root
.\scripts\install-gstack.ps1
```

Full Claude Code slash commands need **Bun + Node** and `./setup` inside `.claude/skills/gstack` (Git Bash/WSL on Windows). Grok does **not** need that — use the adapter skill.

---

## How to invoke (Grok Build)

```text
Use gstack. Autoplan the next H2.1 reservation ceremony slice.
```

```text
Use gstack. Office hours: is block-mates in passport the right wedge?
```

```text
Use gstack review on uncommitted diff. Then use tdd-test-engineer for e2e plan.
```

```text
Use gstack + security-audit. CSO pass on auth and cost RBAC.
```

### Claude Code (optional)

After `setup`, slash: `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/autoplan`, `/review`, `/qa`, `/cso`, `/ship`, `/browse`, …

---

## Skill routing (this repo)

| User intent | Invoke |
|-------------|--------|
| Product idea / “is this worth it?” | **gstack** (office hours) |
| Scope / strategy | **gstack** (CEO review) |
| Architecture / data / tests | **gstack** eng review + **nextjs-fullstack** |
| UI polish / screens | **frontend-ux-engineer** + DESIGN.md |
| AI slop / visual craft | **gstack** design review + DESIGN.md v1.5 |
| Diff review | **agentic-code-review** (or gstack review) |
| Bugs | **gstack** investigate posture + **tdd-test-engineer** |
| Auth / RBAC | **security-audit** (+ gstack CSO) |
| PR / commit | **git-github-flow** (ask before push) |
| Full factory loop | **gstack** autoplan → build → review → e2e |

---

## BluePlanet product state (for planners)

| Horizon | Status |
|---------|--------|
| A–E design system, craft waves 0–4 | Done |
| Premium H0 + H1 (craft, slabs, passport, pipeline, catalog, analytics) | Done |
| **H2.1 Reservation ceremony** | **Done** (Sales+Admin hold/release, gold row, reserve toast) |
| H2.4 CRM form craft | **Done** (sections, portal access, selects) |
| H2.2 Attention holds | **Done** (home tile → held slabs) |
| CSO hold hardening | **Done** (bulk cap, reason length, soft RBAC) |
| E2E gate | **Partial** — 97/150 when Docker stays up; harness hardened. Re-run with stable `blueplanet-pg` |
| H3 mates / QR / remnant | Later (needs domain) |

**North star:** materials house OS — basalt, scarce gold, slab passport signature.

---

## Recommended next sprint (gstack-shaped)

### Sprint goal

Ship **reservation ceremony** + **e2e gate** so holds feel premium and safe.

### 1. Think (office hours) — 15 min

- Who: Sales rep holding slabs for a customer walk-in.
- Status quo: Status flip + reason string, no ceremony.
- Wedge: Quiet gold border status + toast + audit (no confetti, no new schema if avoidable).
- Non-goals: Multi-step reserve wizard, customer portal, QR.

### 2. Plan (CEO + eng + design)

- **CEO:** Hold scope — UX only on existing hold actions first.
- **Eng:** Trace `hold` / `release` actions, StatusPill gold, Toast, e2e selectors.
- **Design:** Gold scarce (status border only); coral for risk; no second gold system.

### 3. Build

- Inventory hold/release affordances + StatusPill `ON_HOLD` language (already gold tone).
- Toast: “Held for {reason}” / “Released”.
- Optional: attention strip counts holds if useful.

### 4. Review

- `agentic-code-review` on diff.
- RBAC: sales can hold; cost still gated.

### 5. Test

- `npx tsc --noEmit`
- `npm run e2e` (full 150 after this wave)

### 6. Ship

- Commit with complete sentences.
- Ask user before push/PR.

### 7. Reflect

- Update `UI_CRAFT_PLAN.md` progress.
- Next backlog: H2.4 CRM Drawer forms.

### Sprint 2 (after H2.1)

CRM party create/edit craft (`bp-input` / sections / provision login clarity).

### Sprint 3

H3 domain pick (one of): block mates | remnant status | QR passport — after office hours.

---

## Do not

- Replace DESIGN.md with gstack design-consultation output without review.
- Commit secrets or run destructive git without ask.
- Treat gstack telemetry as required (default off upstream).
- Vendor-update by hand forever — re-run `install-gstack.ps1` or `git -C .claude/skills/gstack pull`.

---

*Process from gstack. Product taste from BluePlanet DESIGN.md.*
