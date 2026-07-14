# BluePlanet CRM Constitution (`github/spec-kit` Protocol)

## 1. Full-Stack UI & Architectural Guardrails
1. **App Router & Server/Client Boundaries**: All page routes under `src/app` must clearly separate server-side data fetching from interactive client components (`"use client"`). Database queries (`PrismaClient`) and secret tokens must ONLY reside inside `src/server/` or Server Actions/Route Handlers.
2. **Zero Client Secret Exposure**: Never expose database connection strings (`DATABASE_URL`), JWT secret keys, or internal webhook URLs to client bundles. Only environment variables explicitly prefixed with `NEXT_PUBLIC_` may be imported inside client UI components.
3. **Design System & Component Consistency**: All visual modules (`ApprovalsClient`, `CatalogDashboardClient`, `InventoryTableClient`, `OrdersDashboardClient`, `PurchasesDashboardClient`, `Sidebar`) must strictly adhere to our LangSmith-inspired enterprise tokens (rounded `8px/12px` geometry, high-contrast typography, comfortable padding, and smooth micro-interactions).
4. **DRY & Modular UI Architecture**: Avoid copy-pasting complex table rows or state logic across dashboards. Shared UI patterns must be extracted into reusable components (`CommandPalette`, `Sidebar`) or custom hooks.
5. **Continuous Build Verification**: Every architectural or component modification MUST pass `npm run lint` and `npm run build` cleanly (`100% production-ready bundle`) before merge.
