@AGENTS.md

## gstack

Use the project playbook `GSTACK.md` and the Grok adapter skill `.grok/skills/gstack/SKILL.md`.

Local full tree (slash commands after Bun `./setup`): `.claude/skills/gstack/`.

For browsing authenticated UI QA, prefer gstack `/browse` when Claude + setup is available; do not rely on unauthenticated assumptions for RBAC screens.

Available gstack skills (Claude Code, after setup): `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/design-shotgun`, `/design-html`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/setup-gbrain`, `/retro`, `/investigate`, `/document-release`, `/document-generate`, `/codex`, `/cso`, `/autoplan`, `/plan-devex-review`, `/devex-review`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`, `/learn`.

## Skill routing

When the user's request matches an available skill, invoke it. When in doubt, invoke the skill.

Key routing rules:
- Product ideas / brainstorming / “is this worth building” → **gstack** office hours
- Strategy / scope → **gstack** CEO review
- Architecture / data flow / test matrix → **gstack** eng review + **nextjs-fullstack**
- UI screens / polish → **frontend-ux-engineer** + `DESIGN.md`
- Design system / AI slop → **gstack** design review (must not break DESIGN.md tokens)
- Full plan pipeline → **gstack** autoplan
- Bugs / errors → **gstack** investigate posture + **tdd-test-engineer**
- QA / “does this work in the browser” → **gstack** qa / qa-only + Playwright
- Code review / diff → **agentic-code-review** or **gstack** review
- Security / OWASP → **security-audit** + **gstack** CSO
- Ship / PR → **git-github-flow** (ask before push)
- Premium UI craft → **frontend-ux-engineer** + DESIGN.md v1.5 + UI_CRAFT_PLAN.md
