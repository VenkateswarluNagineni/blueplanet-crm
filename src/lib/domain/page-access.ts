import { redirect } from 'next/navigation';
import type { SessionContext } from '@/lib/domain/auth';
import { canViewFullInventory, type VisibilitySettings } from '@/lib/domain/rbac';

/** Role-appropriate landing path after a forbidden navigation. */
export function homeForRole(role: string): string {
  if (role === 'VENDOR') return '/vendor';
  return '/';
}

/**
 * Page-level capabilities. Middleware only checks authentication;
 * every route should call assertPageAccess for the right capability.
 */
export type PageCapability =
  | 'admin' // ADMIN only: purchases, logistics, analytics, admin/*
  | 'salesWorkspace' // ADMIN | SALES: crm, orders, pipeline, dashboard
  | 'inventoryBrowse' // ADMIN | SALES | VENDOR (when setting allows)
  | 'catalogBrowse' // same as inventoryBrowse
  | 'vendorPortal'; // VENDOR primary; ADMIN impersonation allowed

/**
 * Enforce page access server-side. Redirects to a safe home when forbidden.
 * Returns a non-null session context for convenience at call sites.
 */
export function assertPageAccess(
  ctx: SessionContext | null,
  capability: PageCapability,
  settings?: VisibilitySettings | null,
): SessionContext {
  if (!ctx) redirect('/login');

  const { role } = ctx;

  switch (capability) {
    case 'admin':
      if (role !== 'ADMIN') redirect(homeForRole(role));
      break;

    case 'salesWorkspace':
      if (role !== 'ADMIN' && role !== 'SALES') redirect(homeForRole(role));
      break;

    case 'inventoryBrowse':
    case 'catalogBrowse':
      if (role === 'VENDOR') {
        const allowed = settings ? canViewFullInventory(role, settings) : false;
        if (!allowed) redirect('/vendor');
      } else if (role !== 'ADMIN' && role !== 'SALES') {
        redirect(homeForRole(role));
      }
      break;

    case 'vendorPortal':
      // Portal is public to any authenticated role (ADMIN may impersonate VENDOR).
      break;

    default:
      redirect(homeForRole(role));
  }

  return ctx;
}
