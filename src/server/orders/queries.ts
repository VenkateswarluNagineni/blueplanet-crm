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
  /** Production/job tracking — physical progress, independent of commercial `status`. */
  productionStage: string; // QUOTED | TEMPLATED | FABRICATED | INSTALLED
  templatedAt: string | null;
  fabricatedAt: string | null;
  installedAt: string | null;
  installerId: string | null;
  installerName: string | null;
  blockerNote: string | null;
  /** Internal approval gate (Deal Desk pattern) — production can't advance past QUOTED without it. */
  approvedAt: string | null;
  approvedByName: string | null;
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
      installer: { select: { name: true } },
      approvedBy: { select: { name: true } },
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
      productionStage: o.productionStage,
      templatedAt: o.templatedAt ? o.templatedAt.toISOString().split('T')[0] : null,
      fabricatedAt: o.fabricatedAt ? o.fabricatedAt.toISOString().split('T')[0] : null,
      installedAt: o.installedAt ? o.installedAt.toISOString().split('T')[0] : null,
      installerId: o.installerId ?? null,
      installerName: o.installer?.name ?? null,
      blockerNote: o.blockerNote ?? null,
      approvedAt: o.approvedAt ? o.approvedAt.toISOString() : null,
      approvedByName: o.approvedBy?.name ?? null,
    };
  });
}

export type QuoteCustomerRow = {
  id: string;
  name: string;
  creditLimit: number;
  creditLockExempt: boolean;
  salesLockNote: string | null;
  salesAlertNote: string | null;
  openExposure: number;
  priorOrderCount: number;
  priorOrderTotal: number;
};

/**
 * Customers for the quote-creation search/select (Catalog's QuoteModal). Preloaded
 * client-side-filter list — same "small B2B customer base" pattern already used by
 * CrmDashboardClient, plus per-customer credit exposure/history so a rep can see
 * both without an extra round trip once they pick a customer.
 */
export async function getQuoteCustomers(): Promise<QuoteCustomerRow[]> {
  const customers = await db.party.findMany({
    where: { type: 'CUSTOMER', deletedAt: null },
    select: {
      id: true,
      name: true,
      creditLimit: true,
      creditLockExempt: true,
      salesLockNote: true,
      salesAlertNote: true,
      salesOrders: {
        where: { deletedAt: null, status: { in: ['PLACED', 'COMPLETED'] } },
        select: {
          status: true,
          soLineItems: { select: { soldPricePerSf: true, inventoryItem: { select: { totalSf: true } } } },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  return customers.map((c) => {
    let openExposure = 0;
    let priorOrderCount = 0;
    let priorOrderTotal = 0;
    for (const so of c.salesOrders) {
      const value = so.soLineItems.reduce((s, li) => s + li.soldPricePerSf * (li.inventoryItem?.totalSf ?? 0), 0);
      if (so.status === 'PLACED') openExposure += value;
      if (so.status === 'COMPLETED') {
        priorOrderCount += 1;
        priorOrderTotal += value;
      }
    }
    return {
      id: c.id,
      name: c.name,
      creditLimit: c.creditLimit,
      creditLockExempt: c.creditLockExempt,
      salesLockNote: c.salesLockNote,
      salesAlertNote: c.salesAlertNote,
      openExposure: Math.round(openExposure * 100) / 100,
      priorOrderCount,
      priorOrderTotal: Math.round(priorOrderTotal * 100) / 100,
    };
  });
}
