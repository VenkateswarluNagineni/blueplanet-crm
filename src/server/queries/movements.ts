import 'server-only';
import { db } from '@/lib/db';

export type MovementLogRow = {
  id: string;
  type: string; // TRANSFER, HOLD, RELEASE, WRITE_OFF
  createdAt: string; // ISO
  slabId: string | null;
  productName: string | null;
  fromLocation: string | null;
  toLocation: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
  note: string | null;
  byRole: string | null;
  byUser: string | null; // email
};

/**
 * The company-wide stock-movement audit log (transfers / holds / releases / write-offs),
 * newest first. Location ids and the acting user id are resolved to display values in a
 * single extra round-trip each.
 */
export async function getStockMovements(limit = 300): Promise<MovementLogRow[]> {
  const movements = await db.stockMovement.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { inventoryItem: { select: { uniqueSlabId: true, product: { select: { name: true } } } } },
  });

  const [locs, users] = await Promise.all([
    db.location.findMany({ select: { id: true, name: true } }),
    db.user.findMany({ select: { id: true, email: true } }),
  ]);
  const locName = new Map(locs.map((l) => [l.id, l.name]));
  const userEmail = new Map(users.map((u) => [u.id, u.email]));

  return movements.map((m) => ({
    id: m.id,
    type: m.type,
    createdAt: m.createdAt.toISOString(),
    slabId: m.inventoryItem?.uniqueSlabId ?? null,
    productName: m.inventoryItem?.product?.name ?? null,
    fromLocation: m.fromLocationId ? locName.get(m.fromLocationId) ?? null : null,
    toLocation: m.toLocationId ? locName.get(m.toLocationId) ?? null : null,
    fromStatus: m.fromStatus,
    toStatus: m.toStatus,
    reason: m.reason,
    note: m.note,
    byRole: m.byRole,
    byUser: m.byUserId ? userEmail.get(m.byUserId) ?? null : null,
  }));
}
