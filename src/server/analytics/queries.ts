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
