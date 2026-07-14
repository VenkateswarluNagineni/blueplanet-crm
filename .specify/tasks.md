# Verifiable Task Checklist (`tasks.md`)

- [x] **Task 1: Spec-Kit Specification Embedding**
  - Create `.specify/constitution.md` establishing Next.js App Router rules, strict TypeScript types, and zero secret exposure on client bundles.
  - Create `.specify/spec.md` with full-stack data flow and UI module contracts.
  - Create `.specify/plan.md` outlining clean UI and server action separation.

- [x] **Task 2: UI & Server Code Restructuring Verification**
  - Verify `src/components/CatalogDashboardClient.tsx`, `OrdersDashboardClient.tsx`, and `InventoryTableClient.tsx` strictly follow `"use client"` conventions without leaky server dependencies.
  - Verify `src/server/queries/crm.ts` executes pure server queries without client bundle leakage.

- [x] **Task 3: Production Security & Build Gating**
  - Run `npm run lint` -> Zero ESLint violations across all client and server files.
  - Run `npm audit --audit-level=high` -> Zero high or critical SCA vulnerabilities.
  - Execute full production build (`npm run build`) -> 100% clean Next.js static & dynamic bundle generation.
