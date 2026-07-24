<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project design & skills

- Design constitution: `DESIGN.md` (basalt · vein gold · sodalite). Do not invent a second palette.
- Grok skill library: `.grok/skills/` (awesome-grok-build + **gstack** adapter).
- Human playbooks: `SKILLS.md`, **`GSTACK.md`** (Garry Tan sprint process).
- Prefer skills: `gstack` (think/plan/review/ship loop), `frontend-ux-engineer`, `nextjs-fullstack`, `tdd-test-engineer`, `security-audit`, `agentic-code-review`.
- gstack source clone (optional Claude Code): `.claude/skills/gstack/` — refresh with `scripts/install-gstack.ps1`.
- E2E safety: preserve login `#email`/`#password`/Sign in and Material Passport headings unless tests are updated.
- Verify with: `npx tsc --noEmit`, `npm run e2e` (when UI/auth flows change).
