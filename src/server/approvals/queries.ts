import 'server-only';
import { db } from '@/lib/db';

export type ApprovalItem = {
  id: string;
  slabId: string;
  productName: string;
  currentLength: number | null;
  currentWidth: number | null;
  proposedLength: number;
  proposedWidth: number;
  submittedByRole: string;
  status: string;
  createdAt: string;
};

export async function getApprovals(): Promise<ApprovalItem[]> {
  const events = await db.eventOutbox.findMany({
    where: { eventType: 'MEASUREMENT_OVERRIDE' },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const slabIds = events.map((e) => e.aggregateId);
  const slabs = await db.inventoryItem.findMany({
    where: { uniqueSlabId: { in: slabIds } },
    include: { product: { select: { name: true } } },
  });
  const slabMap = new Map(slabs.map((s) => [s.uniqueSlabId, s]));

  return events.map((e) => {
    const payload = (e.payload ?? {}) as { lengthInches?: number; widthInches?: number; submittedByRole?: string };
    const slab = slabMap.get(e.aggregateId);
    return {
      id: e.id,
      slabId: e.aggregateId,
      productName: slab?.product.name ?? 'Unknown',
      currentLength: slab?.lengthInches ?? null,
      currentWidth: slab?.widthInches ?? null,
      proposedLength: payload.lengthInches ?? 0,
      proposedWidth: payload.widthInches ?? 0,
      submittedByRole: payload.submittedByRole ?? 'UNKNOWN',
      status: e.status,
      createdAt: e.createdAt.toISOString().split('T')[0],
    };
  });
}
