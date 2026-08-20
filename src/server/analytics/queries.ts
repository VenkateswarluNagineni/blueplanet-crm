import 'server-only';
import { db } from '@/lib/db';

export type LandedCostSummary = {
  /** Real COGS: sum of the immutable per-slab landed cost snapshotted at sale, across completed orders. */
  realCogs: number;
  /** Real landed cost of every AVAILABLE (yard) slab. */
  yardLandedCost: number;
};

export async function getLandedCostSummary(): Promise<LandedCostSummary> {
  const [cogs, yard] = await Promise.all([
    db.sOLineItem.aggregate({
      where: { deletedAt: null, salesOrder: { status: 'COMPLETED', deletedAt: null } },
      _sum: { landedCostAtSale: true },
    }),
    db.inventoryItem.aggregate({
      where: { deletedAt: null, status: 'AVAILABLE' },
      _sum: { costLanded: true },
    }),
  ]);

  return {
    realCogs: cogs._sum.landedCostAtSale ?? 0,
    yardLandedCost: yard._sum.costLanded ?? 0,
  };
}

export type AgingBucketLabel = '0-30' | '31-90' | '91-180' | '180+';

export type InventoryAgingBucket = {
  label: AgingBucketLabel;
  count: number;
  totalSf: number;
  capitalTiedUp: number;
};

export type AgingSlabRow = {
  id: string;
  uniqueSlabId: string;
  materialName: string;
  daysInYard: number;
  capitalTiedUp: number;
};

export type InventoryAgingReport = {
  buckets: InventoryAgingBucket[];
  oldestSlabs: AgingSlabRow[];
  totalCapitalTiedUp: number;
};

const AGING_BUCKETS: { label: AgingBucketLabel; min: number; max: number }[] = [
  { label: '0-30', min: 0, max: 30 },
  { label: '31-90', min: 31, max: 90 },
  { label: '91-180', min: 91, max: 180 },
  { label: '180+', min: 181, max: Infinity },
];

/**
 * "Days in yard" — InventoryItem rows are only ever created at PO receipt (see
 * src/server/purchasing/actions.ts), so createdAt is an accurate proxy for receipt date.
 */
export async function getInventoryAging(): Promise<InventoryAgingReport> {
  const items = await db.inventoryItem.findMany({
    where: { deletedAt: null, status: 'AVAILABLE' },
    select: {
      id: true,
      uniqueSlabId: true,
      createdAt: true,
      costLanded: true,
      totalSf: true,
      product: { select: { name: true } },
    },
  });

  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;
  const withAge = items.map((item) => ({
    ...item,
    daysInYard: Math.floor((now - item.createdAt.getTime()) / msPerDay),
  }));

  const buckets: InventoryAgingBucket[] = AGING_BUCKETS.map(({ label, min, max }) => {
    const inBucket = withAge.filter((i) => i.daysInYard >= min && i.daysInYard <= max);
    return {
      label,
      count: inBucket.length,
      totalSf: inBucket.reduce((s, i) => s + i.totalSf, 0),
      capitalTiedUp: inBucket.reduce((s, i) => s + (i.costLanded ?? 0), 0),
    };
  });

  const oldestSlabs: AgingSlabRow[] = [...withAge]
    .sort((a, b) => b.daysInYard - a.daysInYard)
    .slice(0, 10)
    .map((i) => ({
      id: i.id,
      uniqueSlabId: i.uniqueSlabId,
      materialName: i.product.name,
      daysInYard: i.daysInYard,
      capitalTiedUp: i.costLanded ?? 0,
    }));

  return {
    buckets,
    oldestSlabs,
    totalCapitalTiedUp: withAge.reduce((s, i) => s + (i.costLanded ?? 0), 0),
  };
}

export type MaterialMarginRow = {
  materialType: string;
  orderCount: number;
  revenue: number;
  realCogs: number;
  marginValue: number;
  marginPercent: number | null;
};

/** Realized margin (completed sales only) broken down by material category — a breakdown of the
 * same realCogs figure getLandedCostSummary() already aggregates, not a new, differently-scoped metric. */
export async function getMarginByMaterialCategory(): Promise<MaterialMarginRow[]> {
  const lineItems = await db.sOLineItem.findMany({
    where: { deletedAt: null, salesOrder: { status: 'COMPLETED', deletedAt: null } },
    select: {
      soldPricePerSf: true,
      landedCostAtSale: true,
      inventoryItem: { select: { totalSf: true, product: { select: { materialType: true } } } },
    },
  });

  const byMaterial = new Map<string, { revenue: number; realCogs: number; orderCount: number }>();
  for (const li of lineItems) {
    const materialType = li.inventoryItem?.product.materialType ?? 'Other';
    const revenue = li.soldPricePerSf * (li.inventoryItem?.totalSf ?? 0);
    const entry = byMaterial.get(materialType) ?? { revenue: 0, realCogs: 0, orderCount: 0 };
    entry.revenue += revenue;
    entry.realCogs += li.landedCostAtSale;
    entry.orderCount += 1;
    byMaterial.set(materialType, entry);
  }

  return [...byMaterial.entries()]
    .map(([materialType, v]) => ({
      materialType,
      orderCount: v.orderCount,
      revenue: v.revenue,
      realCogs: v.realCogs,
      marginValue: v.revenue - v.realCogs,
      marginPercent: v.revenue > 0 ? ((v.revenue - v.realCogs) / v.revenue) * 100 : null,
    }))
    .sort((a, b) => b.marginValue - a.marginValue);
}

export type YieldMetric = {
  purchasedSf: number;
  remnantSf: number;
  netSfUsed: number;
  yieldPercent: number | null;
};

/**
 * Real material yield — net sf used ÷ purchased sf, derived from existing
 * remnant/line-item data (no new capture burden, no CAD/nesting geometry).
 * `purchasedSf` is the sum of every root purchased slab's totalSf (parentItemId
 * null); `remnantSf` is the sf split off into remnant child records via the
 * existing self-relation; the difference is the sf that went straight to a
 * finished, sold piece rather than ending up as leftover material.
 */
export async function getYieldMetric(): Promise<YieldMetric> {
  const [purchased, remnants] = await Promise.all([
    db.inventoryItem.aggregate({
      where: { deletedAt: null, parentItemId: null },
      _sum: { totalSf: true },
    }),
    db.inventoryItem.aggregate({
      where: { deletedAt: null, parentItemId: { not: null } },
      _sum: { totalSf: true },
    }),
  ]);

  const purchasedSf = purchased._sum.totalSf ?? 0;
  const remnantSf = remnants._sum.totalSf ?? 0;
  const netSfUsed = Math.max(0, purchasedSf - remnantSf);

  return {
    purchasedSf: Math.round(purchasedSf * 10) / 10,
    remnantSf: Math.round(remnantSf * 10) / 10,
    netSfUsed: Math.round(netSfUsed * 10) / 10,
    yieldPercent: purchasedSf > 0 ? (netSfUsed / purchasedSf) * 100 : null,
  };
}

export type JobMarginRow = {
  salesOrderId: string;
  soNumber: string;
  customerLabel: string;
  revenue: number;
  realCogs: number;
  marginValue: number;
  marginPercent: number | null;
  placedAt: string;
};

/**
 * Realized margin (completed sales only) per individual job/order — same
 * revenue/realCogs calculation getMarginByMaterialCategory uses, just grouped by
 * SalesOrder instead of material category. Note: soldPricePerSf and
 * landedCostAtSale are both snapshotted together at quote time (see
 * createQuoteAction) and landedCostAtSale is immutable once sold (see the
 * reconciliation engine's sold-slab exclusion) — there is no "actual cost that
 * can diverge from the estimate" in the data today, so this is a true realized
 * margin figure, not an estimate-vs-actual comparison.
 */
export async function getJobMargins(): Promise<JobMarginRow[]> {
  const orders = await db.salesOrder.findMany({
    where: { deletedAt: null, status: 'COMPLETED' },
    select: {
      id: true,
      soNumber: true,
      customerName: true,
      customer: { select: { name: true } },
      placedAt: true,
      soLineItems: {
        where: { deletedAt: null },
        select: {
          soldPricePerSf: true,
          landedCostAtSale: true,
          inventoryItem: { select: { totalSf: true } },
        },
      },
    },
    orderBy: { placedAt: 'desc' },
  });

  return orders.map((o) => {
    const revenue = o.soLineItems.reduce((s, li) => s + li.soldPricePerSf * (li.inventoryItem?.totalSf ?? 0), 0);
    const realCogs = o.soLineItems.reduce((s, li) => s + li.landedCostAtSale, 0);
    return {
      salesOrderId: o.id,
      soNumber: o.soNumber,
      customerLabel: o.customerName ?? o.customer?.name ?? 'Unknown Customer',
      revenue,
      realCogs,
      marginValue: revenue - realCogs,
      marginPercent: revenue > 0 ? ((revenue - realCogs) / revenue) * 100 : null,
      placedAt: o.placedAt.toISOString().split('T')[0],
    };
  });
}
