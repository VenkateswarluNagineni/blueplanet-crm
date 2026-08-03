import 'server-only';
import { db } from './db';
import { ForbiddenError } from './errors';

export type VisibilitySettings = {
  salesCanViewLandedCost: boolean;
  salesCanViewAllPipeline: boolean;
  vendorCanViewFullInventory: boolean;
};

export const DEFAULT_SETTINGS: VisibilitySettings = {
  salesCanViewLandedCost: false,
  salesCanViewAllPipeline: false,
  vendorCanViewFullInventory: false,
};

export async function getCompanySettings(companyId: string): Promise<VisibilitySettings> {
  const s = await db.companySetting.findUnique({ where: { companyId } });
  if (!s) return DEFAULT_SETTINGS;
  return {
    salesCanViewLandedCost: s.salesCanViewLandedCost,
    salesCanViewAllPipeline: s.salesCanViewAllPipeline,
    vendorCanViewFullInventory: s.vendorCanViewFullInventory,
  };
}

// --- Capability checks (the single source of truth for visibility) ---

export function canViewLandedCost(role: string, s: VisibilitySettings): boolean {
  return role === 'ADMIN' || (role === 'SALES' && s.salesCanViewLandedCost);
}

export function canViewAllPipeline(role: string, s: VisibilitySettings): boolean {
  return role === 'ADMIN' || (role === 'SALES' && s.salesCanViewAllPipeline);
}

export function canViewFullInventory(role: string, s: VisibilitySettings): boolean {
  return role !== 'VENDOR' || s.vendorCanViewFullInventory;
}

export function canManageSettings(role: string): boolean {
  return role === 'ADMIN';
}

/** Throw if the role is not in the allow-list. Use at the top of Server Actions. */
export function requireRole(role: string | null, allowed: string[]): asserts role is string {
  if (!role || !allowed.includes(role)) {
    throw new ForbiddenError();
  }
}
