import 'server-only';
import { db } from '@/lib/db';

export type InventoryOverview = {
  kpis: {
    totalSlabs: number;
    available: number;
    onHold: number;
    committed: number;
    sold: number;
    writtenOff: number;
    inTransit: number;
    availableSf: number;
    inventoryValue: number | null; // null when the viewer can't see landed cost
  };
  byLocation: { location: string; slabs: number; availableSlabs: number; availableSf: number; value: number | null }[];
  byCategory: { category: string; slabs: number; availableSf: number }[];
};

/**
 * Rolled-up inventory metrics for the Overview dashboard: status KPIs, in-transit
 * (from open POs), and breakdowns by location and by category. Scoped to the viewer's
 * locations; landed-cost value is gated by `canViewCost`.
 */
export async function getInventoryOverview(
  canViewCost: boolean,
  locationIds?: string[] | null,
): Promise<InventoryOverview> {
  const locScope = locationIds ? { presentLocationId: { in: locationIds } } : {};
  const [items, openPos, locations] = await Promise.all([
    db.inventoryItem.findMany({
      where: { deletedAt: null, ...locScope },
      select: {
        status: true, totalSf: true, costLanded: true,
        product: { select: { materialType: true, category: true } },
        location: { select: { name: true } },
      },
    }),
    db.purchaseOrder.findMany({
      where: { deletedAt: null, logisticsStatus: { not: 'RECEIVED' } },
      select: { orderedSlabs: true },
    }),
    db.location.findMany({
      where: { deletedAt: null, ...(locationIds ? { id: { in: locationIds } } : {}) },
      select: { name: true },
    }),
  ]);

  const SELLABLE = (s: string) => s !== 'SOLD' && s !== 'WRITTEN_OFF';
  const count = (s: string) => items.filter((i) => i.status === s).length;

  const availableSf = items.filter((i) => i.status === 'AVAILABLE').reduce((sum, i) => sum + i.totalSf, 0);
  const inventoryValue = canViewCost
    ? Math.round(items.filter((i) => SELLABLE(i.status)).reduce((sum, i) => sum + (i.costLanded ?? 0), 0))
    : null;
  const inTransit = openPos.reduce((sum, po) => sum + po.orderedSlabs, 0);

  // By location — seed every active location so empty warehouses still show (at 0).
  const locMap = new Map<string, { slabs: number; availableSlabs: number; availableSf: number; value: number }>();
  for (const l of locations) locMap.set(l.name, { slabs: 0, availableSlabs: 0, availableSf: 0, value: 0 });
  for (const i of items) {
    const k = i.location.name;
    const e = locMap.get(k) ?? { slabs: 0, availableSlabs: 0, availableSf: 0, value: 0 };
    e.slabs += 1;
    if (i.status === 'AVAILABLE') { e.availableSlabs += 1; e.availableSf += i.totalSf; }
    if (SELLABLE(i.status)) e.value += i.costLanded ?? 0;
    locMap.set(k, e);
  }
  const byLocation = [...locMap.entries()]
    .map(([location, e]) => ({
      location, slabs: e.slabs, availableSlabs: e.availableSlabs,
      availableSf: Math.round(e.availableSf * 10) / 10,
      value: canViewCost ? Math.round(e.value) : null,
    }))
    .sort((a, b) => b.slabs - a.slabs);

  // By category (fall back to materialType when category is unset)
  const catMap = new Map<string, { slabs: number; availableSf: number }>();
  for (const i of items) {
    const k = i.product.category ?? i.product.materialType ?? '—';
    const e = catMap.get(k) ?? { slabs: 0, availableSf: 0 };
    e.slabs += 1;
    if (i.status === 'AVAILABLE') e.availableSf += i.totalSf;
    catMap.set(k, e);
  }
  const byCategory = [...catMap.entries()]
    .map(([category, e]) => ({ category, slabs: e.slabs, availableSf: Math.round(e.availableSf * 10) / 10 }))
    .sort((a, b) => b.slabs - a.slabs);

  return {
    kpis: {
      totalSlabs: items.length,
      available: count('AVAILABLE'),
      onHold: count('ON_HOLD'),
      committed: count('COMMITTED'),
      sold: count('SOLD'),
      writtenOff: count('WRITTEN_OFF'),
      inTransit,
      availableSf: Math.round(availableSf * 10) / 10,
      inventoryValue,
    },
    byLocation,
    byCategory,
  };
}
