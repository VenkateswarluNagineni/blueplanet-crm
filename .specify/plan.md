# Technical Restructuring & Implementation Plan (`plan.md`)

## 1. UI & Server Modularization Objectives
1. **Server vs Client Separation**: Ensure interactive state (`useState`, `useEffect`, `onClick`) is strictly isolated to components explicitly marked with `"use client"`. Server queries (`src/server/queries/crm.ts`) execute purely on the server boundary.
2. **Component Restructuring**: Standardize UI spacing and geometry across all 11 CRM modules to prevent visual fragmentation and ad-hoc utility spaghetti.
3. **DRY State & Action Handling**: Centralize recurring status badge rendering and table filtering logic.

## 2. Code Restructuring Blueprint
- `src/components/CatalogDashboardClient.tsx` through `PurchasesDashboardClient.tsx`: Ensure clean React hooks usage, proper dependencies (`eslint-plugin-react-hooks`), and zero unused variables.
- `src/server/queries/crm.ts`: Verify all Prisma database calls (`prisma.customer.findMany`, `prisma.order.findMany`, etc.) return strongly typed payloads without exposing sensitive fields.
- `src/components/CommandPalette.tsx`: Ensure keyboard accessibility (`Cmd/Ctrl+K`) cleanly opens modal overlays without DOM memory leaks.

## 3. Continuous Verification Checkpoints
- **SAST / Lint**: `npm run lint` -> Zero ESLint warnings or errors.
- **Production Build**: `npm run build` -> Clean Next.js static and dynamic page generation without bundle size bloating.
- **Security Audit**: `npm audit --audit-level=high` -> Zero high or critical dependency vulnerabilities.
