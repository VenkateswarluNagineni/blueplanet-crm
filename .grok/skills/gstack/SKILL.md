---
name: gstack
description: Garry Tan gstack sprint methodology adapted for BluePlanet + Grok Build. Use for product thinking, plan reviews, design critique, staff review, QA, security (CSO), and ship discipline. Think → Plan → Build → Review → Test → Ship → Reflect.
version: 1.0.0
author: blueplanet-crm (adapted from garrytan/gstack MIT)
source: https://github.com/garrytan/gstack
---

# gstack (BluePlanet · Grok adapter)

**Upstream:** [garrytan/gstack](https://github.com/garrytan/gstack) v1.60+  
**Local clone (Claude Code / full binaries):** `.claude/skills/gstack/`  
**Project playbook:** `GSTACK.md`

This skill is the **process**, not a blank prompt. Run stages in order when shipping real product work.

## Sprint loop

```
Think → Plan → Build → Review → Test → Ship → Reflect
```

| Stage | gstack command (Claude) | Grok / BluePlanet equivalent |
|-------|-------------------------|------------------------------|
| Think | `/office-hours` | This skill Phase 0–1; save design doc |
| Plan | `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review` | Plan mode + DESIGN.md + arena choices |
| Build | implement | `frontend-ux-engineer` + `nextjs-fullstack` |
| Review | `/review` | `agentic-code-review` |
| Test | `/qa`, `/qa-only` | `tdd-test-engineer` + Playwright e2e |
| Security | `/cso` | `security-audit` (OWASP-minded) |
| Ship | `/ship` | `git-github-flow` (ask before push) |
| Reflect | `/retro` | Update `UI_CRAFT_PLAN.md` + learnings |

## When to invoke

- User says: gstack, office hours, autoplan, design review, CSO, ship discipline, sprint
- Starting a **feature** (not a one-line fix)
- Before large Horizon work (H2 reservation, CRM forms, remnant status)
- After a multi-file UI wave before merge

## BluePlanet hard constraints (always)

1. **DESIGN.md** is the visual constitution (basalt · vein gold scarce · slab is the object).
2. **E2E contracts:** `#email`, `#password`, Sign in, Material Passport titles / `data-testid`s.
3. **No second palette**, no gamification, no confetti.
4. **RBAC:** cost fields stay role-gated.
5. **Ask before** force-push, production deploy, new frameworks, schema migrations.

## Phase 0 — Context (always run first)

1. Read `DESIGN.md` (thesis + do/don’t), `UI_CRAFT_PLAN.md` (progress), `GSTACK.md`.
2. `git status` / recent diff if shipping.
3. Name **persona** (Admin / Sales / Vendor) and **primary job**.
4. State **success in one sentence** (user outcome, not “refactor code”).

## Phase 1 — Office hours (Think)

Use when the problem is still fuzzy. **Do not write product code in this phase.**

Six forcing questions (push for specificity):

1. **Who is desperate?** Name role + context (e.g. “NJ yard admin receiving containers”).
2. **What do they do today without us?** Status quo is the competitor.
3. **What is the narrowest wedge that ships this week?** Not the platform vision.
4. **What evidence is demand vs interest?** Behavior > “sounds cool”.
5. **What must be true for this to work?** Assumptions listed.
6. **What is explicitly out of scope?** Write it down.

**Output:** short design note under `docs/design/` or session plan:

```markdown
## Problem
## User + status quo
## Wedge (this week)
## Non-goals
## Open questions
## Recommended approach (A/B/C + pick)
```

## Phase 2 — Plan reviews

### CEO / product (`/plan-ceo-review`)

- Expand / hold / reduce scope.
- Kill decorative work; prefer operator speed and signature moments (passport, packing slip).
- Completeness score when options differ in coverage (10 full, 7 happy path, 3 shortcut).

### Eng (`/plan-eng-review`)

- Data flow, RBAC, failure modes, test matrix.
- Files touched; migration risk; e2e impact.

### Design (`/plan-design-review`)

- Rate density, gold scarcity, hierarchy, empty states, motion restraint 0–10.
- AI-slop check: tutorial copy, bounce hovers, solid gold spam, emoji.
- Must align with DESIGN.md v1.5 craft notes.

### Autoplan shortcut

When user says “autoplan”: run Think summary → CEO scope → eng test matrix → design craft floor in **one** response, then stop for approval before build.

## Phase 3 — Build

- Prefer existing primitives: PageShell, PageHeader, ListToolbar, bp-table, Drawer, Modal, Button, EmptyState.
- Horizon order (premium plan): H2.1 reservation → H2.4 CRM forms → H3 signatures.
- Small diffs; tokens only; Chanel rule (remove one accessory per PR).

**Pair skills:** `frontend-ux-engineer`, `nextjs-fullstack`, `refactor-master` (mega files only).

## Phase 4 — Review (`/review`)

Use `agentic-code-review` on the uncommitted diff:

- Correctness, RBAC leaks, a11y, e2e breakage, dead demo metrics.
- Auto-fix only obvious safe issues; ask on race/auth/data loss.

## Phase 5 — QA (`/qa` / `/qa-only`)

- Manual: login → Command Center → Slabs passport → Pipeline → Catalog → Analytics.
- Automated: `npx tsc --noEmit`; `npm run e2e` when auth/UI contracts touch.
- Report-only mode if user says `qa-only`.

## Phase 6 — Security (`/cso`)

Pair with `security-audit`:

- Auth cookies, impersonation, cost field leakage, server actions injection, vendor scope.
- Confidence gate: only report findings you’d file as real bugs.

## Phase 7 — Ship

- `tsc` clean; e2e green if required.
- Commit messages: complete sentences, no secrets.
- **Ask user** before `git push` / PR / deploy (`git-github-flow`).

## Phase 8 — Reflect

- Append 3–5 lines to `UI_CRAFT_PLAN.md` invoke progress.
- Note one operational learning (path, command, e2e gotcha).

## Full gstack (Claude Code) — optional

When Bun + Claude Code are available:

```powershell
# already cloned at:
#   .claude\skills\gstack

# one-time (needs Bun + Node on Windows):
cd .claude\skills\gstack
# install bun if needed, then:
#   .\setup   # Git Bash / WSL preferred for setup script
```

Then slash skills work: `/office-hours`, `/review`, `/qa`, `/ship`, `/cso`, `/autoplan`, `/browse`, etc.

Reinstall clone:

```powershell
.\scripts\install-gstack.ps1
```

## Voice (from gstack ETHOS)

- Lead with the point; name files and user outcomes.
- No corporate filler; no AI vocabulary spam.
- User has context you don’t — offer options, don’t pretend certainty.

## Example prompts

```text
Use gstack. Office hours on reservation ceremony for sales holds.
```

```text
Use gstack autoplan. Next slice: CRM party create/edit Drawer craft.
```

```text
Use gstack review on the current uncommitted diff. Then qa-only checklist for localhost:3000.
```

```text
Use gstack and security-audit. CSO pass on login, impersonation, cost fields.
```
