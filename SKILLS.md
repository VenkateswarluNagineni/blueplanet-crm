# BluePlanet · Grok skills playbook

Skills live in:

```
.grok/skills/          # Grok Build skills (awesome-grok-build + gstack adapter)
.claude/skills/gstack/ # Full garrytan/gstack clone (optional Claude Code; gitignored)
```

Also: `.grokignore` — keeps agents out of `node_modules`, `.next`, secrets, Playwright reports.

Project `AGENTS.md` / `CLAUDE.md` include skill routing. Human process: **`GSTACK.md`**.

---

## How to invoke

In Grok Build TUI:

```text
Use gstack. Autoplan H2.1 reservation ceremony.
```

```text
Use frontend-ux-engineer. Polish the Orders empty state; keep DESIGN.md tokens.
```

Or:

```text
/skills
```

Then pick a skill.

---

## gstack (process factory)

| Skill | When to use |
|-------|-------------|
| **gstack** | Think → Plan → Build → Review → Test → Ship. Office hours, autoplan, design critique, CSO posture, ship discipline. See `GSTACK.md`. |

Upstream: [garrytan/gstack](https://github.com/garrytan/gstack). Refresh clone: `.\scripts\install-gstack.ps1`.

---

## awesome-grok-build skills (implementation)

| Skill | When to use |
|-------|-------------|
| **frontend-ux-engineer** | Product UI, a11y, loading/empty/error, responsive polish |
| **nextjs-fullstack** | App Router, RSC, server actions, auth, caching |
| **repo-health-check** | Audit repo → propose smallest safe PR (no edit until approved) |
| **agentic-code-review** | Review current diff before commit |
| **tdd-test-engineer** | Tests first; Playwright / flaky e2e |
| **security-audit** | Login, RBAC, server actions, secrets |
| **performance-optimizer** | Slow queries, heavy clients, dashboard |
| **architecture-review** | Domain boundaries, schema evolution |
| **refactor-master** | Split large files without behavior change |
| **git-github-flow** | Clean commits / PR text (ask before push) |
| **research-agent** | Source-backed research (web/X) |
| **hooksmith** | Design safe Grok hooks (lint/test) |
| **python-expert** | Rare here (this is a Next.js repo) |

---

## Best for BluePlanet (priority order)

1. `gstack` for any multi-step feature (plan before build)  
2. `frontend-ux-engineer` + `DESIGN.md`  
3. `nextjs-fullstack`  
4. `tdd-test-engineer` (`npm run e2e`, passport strings)  
5. `security-audit` (JWT, RBAC, actions)  
6. `agentic-code-review` before shipping  
7. `repo-health-check` when stuck on “what next?”  
8. `refactor-master` for `InventoryTableClient` / `CrmDashboardClient`  

---

## Prompt recipes

### UI

```text
Use frontend-ux-engineer.
Read DESIGN.md first.
Build the actual workflow, not a landing page.
Include loading, empty, error states.
Preserve e2e: #email, #password, Sign in, Material Passport headings.
```

### Server / auth

```text
Use nextjs-fullstack and security-audit.
Review server actions and RBAC. Do not weaken auth. Plan before edits.
```

### Tests

```text
Use tdd-test-engineer.
Run npm run e2e only when asked.
Never rename Material Passport timeline copy without updating tests.
```

### Pre-merge

```text
Use agentic-code-review on the current uncommitted diff.
Findings first, ordered by severity.
```

### Next PR

```text
Use repo-health-check.
Propose the smallest safe PR. Do not edit until I approve.
```

### gstack sprint

```text
Use gstack. Autoplan the next premium slice from GSTACK.md (H2.1 reservation).
Stop after plan for approval, then implement with frontend-ux-engineer.
```

---

## Discipline (from awesome-grok-build + gstack)

- Plan Mode for design-system / schema / risky work  
- gstack: Think before Build; no code in office-hours phase  
- Subagents for parallel investigation  
- Discover real commands: `npx tsc --noEmit`, `npm run e2e`, prisma  
- Small diffs; no secrets; no committing `.next` or `.env`  
- Ask before force-push, production data, or new frameworks  

---

## Verify install

```powershell
Get-ChildItem .grok\skills -Directory
# expect awesome-grok skills + gstack

Test-Path .claude\skills\gstack\README.md
# True after scripts\install-gstack.ps1

# if Grok CLI available:
grok inspect
```
