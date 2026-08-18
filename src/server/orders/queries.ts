import 'server-only';
import { db } from '@/lib/db';

export type PaymentRow = {
  id: string;
  amount: number;
  method: string | null;
  note: string | null;
  createdAt: string;
};

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
  /** Fabrication line-item depth on the first line — edge profile/cutout upcharges, if any. */
  edgeProfile: string | null;
  fabricationCharges: number;
  /** Always derived (sum of SOPayment.amount) — never a stored/editable field. */
  depositsPaid: number;
  /** Always derived (totalValue - depositsPaid) — never a stored/editable field. */
  balanceDue: number;
  payments: PaymentRow[];
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
      soPayments: { orderBy: { createdAt: 'desc' } },
    },
    orderBy: { placedAt: 'desc' },
  });

  return orders.map((o) => {
    const first = o.soLineItems[0];
    const sqft = o.soLineItems.reduce((s, li) => s + (li.inventoryItem?.totalSf ?? 0), 0);
    // Line total = (base $/sf + edge upcharge $/sf) * sf + (cutout count * $ each) — every
    // fabrication upcharge is derived here, never pre-baked into soldPricePerSf, so margin
    // reporting elsewhere in the app keeps reading the true material price.
    const totalValue = o.soLineItems.reduce((s, li) => {
      const sf = li.inventoryItem?.totalSf ?? 0;
      return s + (li.soldPricePerSf + li.edgeUpchargePerSf) * sf + li.cutoutCount * li.cutoutUpchargeEach;
    }, 0);
    const fabricationCharges = o.soLineItems.reduce((s, li) => {
      const sf = li.inventoryItem?.totalSf ?? 0;
      return s + li.edgeUpchargePerSf * sf + li.cutoutCount * li.cutoutUpchargeEach;
    }, 0);
    const depositsPaid = o.soPayments.reduce((s, p) => s + p.amount, 0);
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
      edgeProfile: first?.edgeProfile ?? null,
      fabricationCharges: Math.round(fabricationCharges * 100) / 100,
      depositsPaid: Math.round(depositsPaid * 100) / 100,
      balanceDue: Math.round((totalValue - depositsPaid) * 100) / 100,
      payments: o.soPayments.map((p) => ({
        id: p.id, amount: p.amount, method: p.method, note: p.note, createdAt: p.createdAt.toISOString(),
      })),
    };
  });
}
