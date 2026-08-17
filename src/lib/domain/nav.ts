import type { ElementType } from 'react';
import {
  Home,
  Search,
  Package,
  Box,
  Users,
  FileText,
  Briefcase,
  Truck,
  CheckCircle,
  BarChart3,
  Warehouse,
  History,
  LayoutDashboard,
  GitCompare,
} from 'lucide-react';

/** Subset of company settings needed for nav visibility (client-safe; no server imports). */
export type NavVisibility = {
  vendorCanViewFullInventory: boolean;
};

export type AppRole = 'ADMIN' | 'SALES' | 'VENDOR';

export type NavItemDef = {
  id: string;
  /** Default short label (sidebar). */
  label: string;
  href: string;
  /** Longer description for Cmd+K and tooltips. */
  hint: string;
  icon: ElementType;
  roles: AppRole[];
  /** When true, VENDOR only sees this if vendorCanViewFullInventory is on. */
  requiresVendorInventory?: boolean;
  /** Sidebar group title per role (omit for top-level / ungrouped). */
  group: Partial<Record<AppRole, string>>;
  /** Optional per-role label overrides. */
  labels?: Partial<Record<AppRole, string>>;
  /** Optional badge key resolved by the shell (e.g. "approvals"). */
  badgeKey?: string;
};

/**
 * Single source of truth for Sidebar + Command Palette destinations.
 * Order within each group defines visual order. URLs are stable.
 */
export const NAV_ITEMS: NavItemDef[] = [
  {
    id: 'home',
    label: 'Dashboard',
    href: '/',
    hint: 'Command center — KPIs & shortcuts',
    icon: Home,
    roles: ['ADMIN', 'SALES'],
    group: {},
  },
  // —— Inventory ——
  {
    id: 'inventory-overview',
    label: 'Overview',
    href: '/inventory/overview',
    hint: 'Stock at a glance by location & status',
    icon: LayoutDashboard,
    roles: ['ADMIN', 'SALES'],
    group: { ADMIN: 'Inventory', SALES: 'Stock' },
  },
  {
    id: 'inventory',
    label: 'Slabs',
    href: '/inventory',
    hint: 'Search slabs & material passports',
    icon: Search,
    roles: ['ADMIN', 'SALES', 'VENDOR'],
    requiresVendorInventory: true,
    group: { ADMIN: 'Inventory', SALES: 'Stock', VENDOR: 'Directory' },
    labels: { VENDOR: 'Inventory' },
  },
  {
    id: 'catalog',
    label: 'Catalog',
    href: '/catalog',
    hint: 'Materials, pricing & available yard stock',
    icon: Box,
    roles: ['ADMIN', 'SALES', 'VENDOR'],
    requiresVendorInventory: true,
    group: { ADMIN: 'Inventory', SALES: 'Stock' },
  },
  {
    id: 'purchases',
    label: 'Purchasing',
    href: '/purchases',
    hint: 'Purchase orders & receiving',
    icon: Package,
    roles: ['ADMIN'],
    group: { ADMIN: 'Inventory' },
  },
  {
    id: 'reconciliation',
    label: 'Reconciliation',
    href: '/purchases/reconciliation',
    hint: 'Supplier email corrections awaiting review',
    icon: GitCompare,
    roles: ['ADMIN'],
    group: { ADMIN: 'Inventory' },
    badgeKey: 'reconciliation',
  },
  // —— Sales ——
  {
    id: 'crm',
    label: 'People',
    href: '/crm',
    hint: 'Customers, suppliers, vendors & reps',
    icon: Users,
    roles: ['ADMIN', 'SALES'],
    group: { ADMIN: 'Sales', SALES: 'Sell' },
    labels: { SALES: 'Customers' },
  },
  {
    id: 'pipeline',
    label: 'Pipeline',
    href: '/pipeline',
    hint: 'Deals & opportunities',
    icon: Briefcase,
    roles: ['ADMIN', 'SALES'],
    group: { ADMIN: 'Sales', SALES: 'Sell' },
  },
  {
    id: 'orders',
    label: 'Orders',
    href: '/orders',
    hint: 'Quotes & sales orders',
    icon: FileText,
    roles: ['ADMIN', 'SALES'],
    group: { ADMIN: 'Sales', SALES: 'Sell' },
  },
  // —— Supply (admin) ——
  {
    id: 'logistics',
    label: 'Logistics',
    href: '/logistics',
    hint: 'Shipments in transit',
    icon: Truck,
    roles: ['ADMIN'],
    group: { ADMIN: 'Supply' },
  },
  {
    id: 'locations',
    label: 'Locations',
    href: '/admin/locations',
    hint: 'Warehouses & showrooms',
    icon: Warehouse,
    roles: ['ADMIN'],
    group: { ADMIN: 'Supply' },
  },
  {
    id: 'movements',
    label: 'Movements',
    href: '/admin/movements',
    hint: 'Transfer, hold & write-off audit',
    icon: History,
    roles: ['ADMIN'],
    group: { ADMIN: 'Supply' },
  },
  // —— Ops (admin) ——
  {
    id: 'approvals',
    label: 'Approvals',
    href: '/admin/approvals',
    hint: 'Measurement overrides awaiting review',
    icon: CheckCircle,
    roles: ['ADMIN'],
    group: { ADMIN: 'Ops' },
    badgeKey: 'approvals',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    href: '/analytics',
    hint: 'Margin & SKU profitability',
    icon: BarChart3,
    roles: ['ADMIN'],
    group: { ADMIN: 'Ops' },
  },
  // —— Vendor ——
  {
    id: 'vendor',
    label: 'Portal',
    href: '/vendor',
    hint: 'My shipments & invoices',
    icon: Truck,
    roles: ['VENDOR'],
    group: { VENDOR: 'Account' },
    labels: { VENDOR: 'My work' },
  },
];

export function labelFor(item: NavItemDef, role: AppRole): string {
  return item.labels?.[role] ?? item.label;
}

/** Destinations visible to this role given company visibility settings. */
export function visibleNavItems(role: AppRole, settings: NavVisibility): NavItemDef[] {
  return NAV_ITEMS.filter((item) => {
    if (!item.roles.includes(role)) return false;
    if (role === 'VENDOR' && item.requiresVendorInventory && !settings.vendorCanViewFullInventory) {
      return false;
    }
    return true;
  });
}

/**
 * Active state for nav items.
 * Exact match wins; prefix match is used for nested routes — except when a more
 * specific sibling lives under the same path (e.g. /inventory vs /inventory/overview).
 */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  if (pathname === href) return true;
  // Sibling modules under /inventory/* have their own nav entries.
  if (href === '/inventory' && pathname.startsWith('/inventory/')) return false;
  return pathname.startsWith(href + '/');
}

/** Preferred group order for sidebar rendering (unknown groups append after). */
export const GROUP_ORDER: Record<AppRole, string[]> = {
  ADMIN: ['Inventory', 'Sales', 'Supply', 'Ops'],
  SALES: ['Sell', 'Stock'],
  VENDOR: ['Account', 'Directory'],
};
