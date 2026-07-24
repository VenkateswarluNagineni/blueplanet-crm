'use server';

import { db } from '@/lib/db';
import { getSessionContext } from '@/lib/auth';
import { getCompanySettings, canViewFullInventory } from '@/lib/rbac';

export type SearchKind = 'customer' | 'supplier' | 'vendor' | 'associate' | 'product' | 'slab' | 'order' | 'location';
export type SearchHit = { kind: SearchKind; id: string; label: string; sublabel: string | null; href: string };

/**
 * Universal record search behind the Ctrl+K palette. Scoped by role and capped per
 * category. Hrefs deep-link where possible (a slab opens its Material Passport).
 */
export async function globalSearchAction(raw: string): Promise<SearchHit[]> {
  const ctx = await getSessionContext();
  if (!ctx) return [];
  const q = raw.trim();
  if (q.length < 2) return [];
  const role = ctx.role;
  const settings = await getCompanySettings(ctx.user.companyId);
  const ci = { contains: q, mode: 'insensitive' as const };
  const hits: SearchHit[] = [];

  // Parties — ADMIN/SALES only (vendors have no CRM access).
  if (role === 'ADMIN' || role === 'SALES') {
    // Sales reps only search customers; admins search the full directory.
    const partyTypes =
      role === 'ADMIN'
        ? ['CUSTOMER', 'SUPPLIER', 'VENDOR', 'ASSOCIATE']
        : ['CUSTOMER'];
    const parties = await db.party.findMany({
      where: {
        deletedAt: null,
        type: { in: partyTypes },
        OR: [{ name: ci }, { systemId: ci }, { email: ci }],
      },
      select: { id: true, name: true, systemId: true, type: true },
      take: 6,
    });
    for (const p of parties) {
      hits.push({
        kind: p.type.toLowerCase() as SearchKind,
        id: p.id,
        label: p.name,
        sublabel: p.systemId ?? p.type,
        href: `/crm?party=${encodeURIComponent(p.id)}`,
      });
    }
  }

  // Products & slabs — not for vendors without full inventory access.
  const canBrowseStock =
    role === 'ADMIN' || role === 'SALES' || canViewFullInventory(role, settings);

  if (canBrowseStock) {
    const products = await db.product.findMany({
      where: {
        deletedAt: null,
        OR: [{ name: ci }, { sku: ci }, { altName: ci }, { genericSku: ci }],
      },
      select: { id: true, name: true, sku: true },
      take: 6,
    });
    for (const pr of products) {
      hits.push({
        kind: 'product',
        id: pr.id,
        label: pr.name,
        sublabel: pr.sku,
        href: `/catalog?product=${encodeURIComponent(pr.id)}`,
      });
    }

    const slabs = await db.inventoryItem.findMany({
      where: { deletedAt: null, OR: [{ uniqueSlabId: ci }, { barcode: ci }] },
      select: { uniqueSlabId: true, product: { select: { name: true } } },
      take: 6,
    });
    for (const s of slabs) {
      hits.push({
        kind: 'slab',
        id: s.uniqueSlabId,
        label: s.uniqueSlabId,
        sublabel: s.product?.name ?? null,
        href: `/inventory?slab=${encodeURIComponent(s.uniqueSlabId)}`,
      });
    }
  }

  // Sales orders (ADMIN/SALES)
  if (role === 'ADMIN' || role === 'SALES') {
    const orders = await db.salesOrder.findMany({
      where: { deletedAt: null, soNumber: ci },
      select: {
        id: true,
        soNumber: true,
        customerName: true,
        customer: { select: { name: true } },
      },
      take: 6,
    });
    for (const o of orders) {
      hits.push({
        kind: 'order',
        id: o.id,
        label: o.soNumber,
        sublabel: o.customer?.name ?? o.customerName ?? null,
        href: `/orders?order=${encodeURIComponent(o.soNumber)}`,
      });
    }
  }

  // Locations (ADMIN)
  if (role === 'ADMIN') {
    const locs = await db.location.findMany({
      where: { deletedAt: null, OR: [{ name: ci }, { code: ci }] },
      select: { id: true, name: true, code: true },
      take: 6,
    });
    for (const l of locs) {
      hits.push({
        kind: 'location',
        id: l.id,
        label: l.name,
        sublabel: l.code,
        href: `/admin/locations?loc=${encodeURIComponent(l.id)}`,
      });
    }
  }

  return hits;
}
