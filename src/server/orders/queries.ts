import 'server-only';
import { db } from '@/lib/db';

export type OrderRow = {
  id: string;
  soNumber: string;
  customerName: string;
  materialName: string;
  slabId: string;
  sqft: number;
  quotedPrice: number;
  totalValue: number;
  status: string; // PLACED | COMPLETED | CANCELLED
  repId: string;
  placedAt: string;
};

/**
 * Sales orders for the Orders screen. When `scopeAssociateSystemId` is provided
 * (Sales role), only that rep's orders are returned; ADMIN passes null for all.
 */
export async function getSalesOrders(scopeAssociateSystemId: string | null): Promise<OrderRow[]> {
  const orders = await db.salesOrder.findMany({
    where: {
      deletedAt: null,
      ...(scopeAssociateSystemId ? { associate: { systemId: scopeAssociateSystemId } } : {}),
    },
    include: {
      associate: { select: { systemId: true, name: true } },
      customer: { select: { name: true } },
      soLineItems: { include: { inventoryItem: { include: { product: true } } } },
    },
    orderBy: { placedAt: 'desc' },
  });

  return orders.map((o) => {
    const first = o.soLineItems[0];
    const sqft = o.soLineItems.reduce((s, li) => s + (li.inventoryItem?.totalSf ?? 0), 0);
    const totalValue = o.soLineItems.reduce(
      (s, li) => s + li.soldPricePerSf * (li.inventoryItem?.totalSf ?? 0),
      0,
    );
    return {
      id: o.id,
      soNumber: o.soNumber,
      customerName: o.customerName ?? o.customer?.name ?? 'Unknown Customer',
      materialName: first?.inventoryItem?.product?.name ?? '—',
      slabId: first?.inventoryItem?.uniqueSlabId ?? '—',
      sqft: Math.round(sqft * 10) / 10,
      quotedPrice: first?.soldPricePerSf ?? 0,
      totalValue,
      status: o.status,
      repId: o.associate?.systemId ?? '—',
      placedAt: o.placedAt.toISOString().split('T')[0],
    };
  });
}
