import 'server-only';
import { db } from '@/lib/db';

export type CrmSupplier = {
  id: string; name: string; origin: string; contact: string; email: string; phone: string;
  terms: string; incoterms: string; currency: string; creditLimit: number; activePos: number; ytdSpend: number;
};
export type CrmVendor = {
  id: string; name: string; service: string; contact: string; email: string; phone: string;
  activeInvoices: number; balance: number;
};
export type CrmAssociate = {
  id: string; name: string; salesNumber: string; role: string; location: string; commissionRate: string;
  activeOppValue: number; ytdSales: number; salesTargetAnnual: number;
};
export type CrmCustomer = {
  id: string; systemId: string; name: string; subType: string; contact: string; email: string; phone: string;
  terms: string; creditLimit: number; priceTier: string; rep: string; openDeals: number; lifetimeValue: number;
};

export type PoCard = { poNumber: string; status: string; amount: number; eta: string; container: string; slabs: number };
export type InvoiceCard = { invoiceNum: string; status: string; amount: number; dueDate: string; serviceDetails: string };
export type OppCard = { oppName: string; status: string; amount: number; expectedClose: string; probability: string };
export type SaleCard = { soNumber: string; customer: string; amount: number; closeDate: string; items: number };
export type AssociateMetrics = { avgDealSize: number; conversionRate: string; commissionEarnedYTD: number; quotaAttainment: string };

export type CrmData = {
  suppliers: CrmSupplier[];
  vendors: CrmVendor[];
  associates: CrmAssociate[];
  customers: CrmCustomer[];
  activePos: Record<string, PoCard[]>;
  historyPos: Record<string, PoCard[]>;
  vendorInvoices: Record<string, InvoiceCard[]>;
  historyInvoices: Record<string, InvoiceCard[]>;
  associatePipeline: Record<string, OppCard[]>;
  associateSales: Record<string, SaleCard[]>;
  associateMetrics: Record<string, AssociateMetrics>;
};

// --- Sales-scoped CRM: a rep sees only customers + their own scorecard ---

export type SalesCustomer = {
  id: string; name: string; email: string; phone: string;
  openDeals: number; openValue: number; ordersCount: number; lifetimeValue: number;
};

export type MyScorecard = {
  partyId: string;
  name: string;
  systemId: string;
  role: string;
  location: string;
  commissionRate: string;
  ytdSales: number;
  activePipelineValue: number;
  salesTargetAnnual: number;
  quotaAttainmentPct: number;
};

export type SalesCrmData = {
  me: MyScorecard | null;
  customers: SalesCustomer[];
};

/**
 * CRM data for a sales rep: their own performance scorecard plus the customer
 * directory with each customer's deal/order activity. Deliberately excludes any
 * supplier or vendor data — reps must not see the supply chain.
 */
export async function getSalesCrmData(associatePartyId: string | null): Promise<SalesCrmData> {
  const [customers, opps, orders, me] = await Promise.all([
    db.party.findMany({ where: { type: 'CUSTOMER', deletedAt: null }, orderBy: { name: 'asc' } }),
    db.opportunity.findMany({
      where: { deletedAt: null, status: { notIn: ['CLOSED_WON', 'CLOSED_LOST'] } },
      select: { customerId: true, amount: true },
    }),
    db.salesOrder.findMany({
      where: { deletedAt: null },
      include: { soLineItems: { include: { inventoryItem: { select: { totalSf: true } } } } },
    }),
    associatePartyId
      ? db.party.findFirst({ where: { id: associatePartyId, type: 'ASSOCIATE', deletedAt: null } })
      : Promise.resolve(null),
  ]);

  const orderValue = (o: (typeof orders)[number]) =>
    o.soLineItems.reduce((s, li) => s + li.soldPricePerSf * (li.inventoryItem?.totalSf ?? 0), 0);

  const customerCards: SalesCustomer[] = customers.map((c) => {
    const cOpps = opps.filter((o) => o.customerId === c.id);
    const cOrders = orders.filter((o) => o.customerId === c.id);
    return {
      id: c.id, name: c.name, email: c.email ?? '—', phone: c.phone ?? '—',
      openDeals: cOpps.length,
      openValue: cOpps.reduce((s, o) => s + o.amount, 0),
      ordersCount: cOrders.length,
      lifetimeValue: c.totalSold,
    };
  });

  let scorecard: MyScorecard | null = null;
  if (me) {
    const myOpenOpps = await db.opportunity.findMany({
      where: { deletedAt: null, associateId: me.id, status: { notIn: ['CLOSED_WON', 'CLOSED_LOST'] } },
      select: { amount: true },
    });
    const target = me.salesTargetAnnual ?? 0;
    scorecard = {
      partyId: me.id,
      name: me.name,
      systemId: me.systemId ?? '—',
      role: me.role ?? '—',
      location: me.baseLocation ?? '—',
      commissionRate: me.commissionRate ?? '—',
      ytdSales: me.totalSold,
      activePipelineValue: myOpenOpps.reduce((s, o) => s + o.amount, 0),
      salesTargetAnnual: target,
      quotaAttainmentPct: target > 0 ? Math.round((me.totalSold / target) * 100) : 0,
    };
  }

  return { me: scorecard, customers: customerCards };
}

const PO_STATUS_LABEL: Record<string, string> = {
  PRODUCTION: 'In Production',
  ON_WATER: 'On Water',
  CUSTOMS: 'Clearing Customs',
  INLAND_TRANSIT: 'Inland Transit',
  RECEIVED: 'Delivered',
};

export async function getCrmData(): Promise<CrmData> {
  const [parties, pos, invoices, opps, sales] = await Promise.all([
    db.party.findMany({ where: { type: { in: ['SUPPLIER', 'VENDOR', 'ASSOCIATE', 'CUSTOMER'] }, deletedAt: null }, orderBy: { name: 'asc' } }),
    db.purchaseOrder.findMany({ where: { deletedAt: null }, orderBy: { issuedAt: 'desc' } }),
    db.vendorInvoice.findMany({ where: { deletedAt: null }, orderBy: { dueDate: 'asc' } }),
    db.opportunity.findMany({ where: { deletedAt: null }, orderBy: { expectedCloseDate: 'asc' } }),
    db.salesOrder.findMany({
      where: { deletedAt: null, status: 'COMPLETED' },
      include: { customer: { select: { name: true } }, soLineItems: { include: { inventoryItem: { select: { totalSf: true } } } } },
    }),
  ]);

  // Rep display-name lookup for customers' assigned associate.
  const repName = new Map(parties.filter((p) => p.type === 'ASSOCIATE').map((p) => [p.id, p.name]));

  const suppliers: CrmSupplier[] = [];
  const vendors: CrmVendor[] = [];
  const associates: CrmAssociate[] = [];
  const customers: CrmCustomer[] = [];
  const activePos: Record<string, PoCard[]> = {};
  const historyPos: Record<string, PoCard[]> = {};
  const vendorInvoices: Record<string, InvoiceCard[]> = {};
  const historyInvoices: Record<string, InvoiceCard[]> = {};
  const associatePipeline: Record<string, OppCard[]> = {};
  const associateSales: Record<string, SaleCard[]> = {};
  const associateMetrics: Record<string, AssociateMetrics> = {};

  for (const p of parties) {
    if (p.type === 'SUPPLIER') {
      const myPos = pos.filter((po) => po.supplierId === p.id);
      const toCard = (po: (typeof pos)[number]): PoCard => ({
        poNumber: po.poNumber,
        status: PO_STATUS_LABEL[po.logisticsStatus] ?? po.logisticsStatus,
        amount: po.orderedSlabs * po.unitCost,
        eta: po.eta ?? 'TBD',
        container: po.containerId ?? 'TBD',
        slabs: po.orderedSlabs,
      });
      const active = myPos.filter((po) => po.logisticsStatus !== 'RECEIVED');
      activePos[p.id] = active.map(toCard);
      historyPos[p.id] = myPos.filter((po) => po.logisticsStatus === 'RECEIVED').map(toCard);
      suppliers.push({
        id: p.id, name: p.name, origin: p.originCountry ?? '—', contact: p.contactPerson ?? '—',
        email: p.email ?? '—', phone: p.phone ?? '—', terms: p.paymentTerms ?? '—', incoterms: p.incoterms ?? '—',
        currency: p.currency, creditLimit: p.creditLimit, activePos: active.length, ytdSpend: p.totalPurchased,
      });
    } else if (p.type === 'VENDOR') {
      const myInv = invoices.filter((inv) => inv.vendorId === p.id);
      const toCard = (inv: (typeof invoices)[number]): InvoiceCard => ({
        invoiceNum: inv.invoiceNum, status: inv.status, amount: inv.amount,
        dueDate: inv.dueDate ? inv.dueDate.toISOString().split('T')[0] : '—', serviceDetails: inv.serviceDetails ?? '—',
      });
      const active = myInv.filter((inv) => inv.status !== 'Paid');
      vendorInvoices[p.id] = active.map(toCard);
      historyInvoices[p.id] = myInv.filter((inv) => inv.status === 'Paid').map(toCard);
      vendors.push({
        id: p.id, name: p.name, service: p.serviceType ?? '—', contact: p.contactPerson ?? '—',
        email: p.email ?? '—', phone: p.phone ?? '—', activeInvoices: active.length, balance: p.balanceDue,
      });
    } else if (p.type === 'ASSOCIATE') {
      const myOpps = opps.filter((o) => o.associateId === p.id);
      const openOpps = myOpps.filter((o) => o.status !== 'CLOSED_WON' && o.status !== 'CLOSED_LOST');
      associatePipeline[p.id] = openOpps.map((o) => ({
        oppName: o.name, status: o.status.charAt(0) + o.status.slice(1).toLowerCase().replace('_', ' '),
        amount: o.amount, expectedClose: o.expectedCloseDate ? o.expectedCloseDate.toISOString().split('T')[0] : '—',
        probability: `${o.probability}%`,
      }));
      const mySales = sales.filter((s) => s.associateId === p.id);
      const saleCards: SaleCard[] = mySales.map((s) => ({
        soNumber: s.soNumber, customer: s.customerName ?? s.customer?.name ?? 'Customer',
        amount: s.soLineItems.reduce((sum, li) => sum + li.soldPricePerSf * (li.inventoryItem?.totalSf ?? 0), 0),
        closeDate: s.placedAt.toISOString().split('T')[0], items: s.soLineItems.length,
      }));
      associateSales[p.id] = saleCards;

      const activeOppValue = openOpps.reduce((sum, o) => sum + o.amount, 0);
      const wonCount = myOpps.filter((o) => o.status === 'CLOSED_WON').length;
      const closedCount = myOpps.filter((o) => o.status === 'CLOSED_WON' || o.status === 'CLOSED_LOST').length;
      const avgDealSize = saleCards.length ? Math.round(saleCards.reduce((s, x) => s + x.amount, 0) / saleCards.length) : 0;
      const ratePct = parseFloat((p.commissionRate ?? '0').replace(/[^0-9.]/g, '')) || 0;
      const target = p.salesTargetAnnual ?? 0;
      associateMetrics[p.id] = {
        avgDealSize,
        conversionRate: closedCount ? `${Math.round((wonCount / closedCount) * 100)}%` : 'N/A',
        commissionEarnedYTD: Math.round(p.totalSold * (ratePct / 100)),
        quotaAttainment: target > 0 ? `${Math.round((p.totalSold / target) * 100)}%` : 'N/A',
      };
      associates.push({
        id: p.id, name: p.name, salesNumber: p.systemId ?? '—', role: p.role ?? '—', location: p.baseLocation ?? '—',
        commissionRate: p.commissionRate ?? '—', activeOppValue, ytdSales: p.totalSold, salesTargetAnnual: target,
      });
    } else if (p.type === 'CUSTOMER') {
      const openDeals = opps.filter((o) => o.customerId === p.id && o.status !== 'CLOSED_WON' && o.status !== 'CLOSED_LOST').length;
      customers.push({
        id: p.id, systemId: p.systemId ?? '—', name: p.name, subType: p.subType ?? '—',
        contact: p.contactPerson ?? '—', email: p.email ?? '—', phone: p.phone ?? '—',
        terms: p.paymentTerms ?? '—', creditLimit: p.creditLimit, priceTier: p.priceTier ?? '—',
        rep: p.assignedAssociateId ? repName.get(p.assignedAssociateId) ?? '—' : '—',
        openDeals, lifetimeValue: p.totalSold,
      });
    }
  }

  return { suppliers, vendors, associates, customers, activePos, historyPos, vendorInvoices, historyInvoices, associatePipeline, associateSales, associateMetrics };
}
