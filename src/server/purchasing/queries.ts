import 'server-only';
import { db } from '@/lib/db';

export type PoLogisticsStatus =
  | 'PRODUCTION'
  | 'ON_WATER'
  | 'CUSTOMS'
  | 'INLAND_TRANSIT'
  | 'RECEIVED';

export type EtaStatus = 'RECEIVED' | 'ON_TRACK' | 'DUE_SOON' | 'OVERDUE' | 'NONE';

export type PoRow = {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  materialName: string;
  orderedSlabs: number;
  unitCost: number;
  oceanCost: number;
  customsCost: number;
  inlandCost: number;
  eta: string | null;
  estimatedDelivery: string | null; // ISO date
  etaStatus: EtaStatus;
  daysToEta: number | null; // negative = overdue
  receiptNumber: string | null;
  containerId: string | null;
  destinationHub: string | null;
  status: PoLogisticsStatus;
  documentRefs: string[];
  issuedAt: string | null;
  ledgerHash: string | null;
  oceanVendorId: string | null;
  customsVendorId: string | null;
  inlandVendorId: string | null;
};

export type PurchasingRefData = {
  suppliers: { id: string; name: string; incoterms: string | null }[];
  vendors: { id: string; name: string; service: string }[];
  materials: { id: string; name: string; type: string }[];
  nextPoNumber: string; // preview of the next auto-assigned PO number
};

/**
 * Classify a PO against its estimated delivery date. RECEIVED short-circuits;
 * otherwise it is overdue (past), due soon (≤7 days), or on track.
 */
function classifyEta(
  status: PoLogisticsStatus,
  estimatedDelivery: Date | null,
): { etaStatus: EtaStatus; daysToEta: number | null } {
  if (status === 'RECEIVED') return { etaStatus: 'RECEIVED', daysToEta: null };
  if (!estimatedDelivery) return { etaStatus: 'NONE', daysToEta: null };
  const msPerDay = 24 * 60 * 60 * 1000;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const days = Math.ceil((estimatedDelivery.getTime() - startOfToday.getTime()) / msPerDay);
  const etaStatus: EtaStatus = days < 0 ? 'OVERDUE' : days <= 7 ? 'DUE_SOON' : 'ON_TRACK';
  return { etaStatus, daysToEta: days };
}

/** The next PO number, following the PO-[Year]-[Sequence] company standard. */
export async function getNextPoNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const latest = await db.purchaseOrder.findFirst({
    where: { poNumber: { startsWith: `PO-${year}-` } },
    orderBy: { poNumber: 'desc' },
    select: { poNumber: true },
  });
  const seq = latest ? parseInt(latest.poNumber.split('-')[2], 10) : 0;
  const next = (Number.isNaN(seq) ? 0 : seq) + 1;
  return `PO-${year}-${String(next).padStart(3, '0')}`;
}

export async function getPurchaseOrders(): Promise<PoRow[]> {
  const pos = await db.purchaseOrder.findMany({
    where: { deletedAt: null },
    include: { supplier: { select: { name: true, deletedAt: true } }, product: { select: { name: true } } },
    orderBy: { issuedAt: 'desc' },
  });

  return pos.map((po) => {
    const status = po.logisticsStatus as PoLogisticsStatus;
    const { etaStatus, daysToEta } = classifyEta(status, po.estimatedDelivery);
    return {
      id: po.id,
      poNumber: po.poNumber,
      supplierId: po.supplierId,
      // Null Reference safety: a soft-deleted supplier reads as "Archived".
      supplierName: po.supplier && !po.supplier.deletedAt ? po.supplier.name : 'Archived Supplier',
      materialName: po.product?.name ?? '—',
      orderedSlabs: po.orderedSlabs,
      unitCost: po.unitCost,
      oceanCost: po.oceanCost,
      customsCost: po.customsCost,
      inlandCost: po.inlandCost,
      eta: po.eta,
      estimatedDelivery: po.estimatedDelivery ? po.estimatedDelivery.toISOString() : null,
      etaStatus,
      daysToEta,
      receiptNumber: po.receiptNumber,
      containerId: po.containerId,
      destinationHub: po.destinationHub,
      status,
      documentRefs: po.documentRefs,
      issuedAt: po.issuedAt ? po.issuedAt.toISOString() : null,
      ledgerHash: po.ledgerHash,
      oceanVendorId: po.oceanVendorId,
      customsVendorId: po.customsVendorId,
      inlandVendorId: po.inlandVendorId,
    };
  });
}

export async function getPurchasingRefData(): Promise<PurchasingRefData> {
  const [suppliers, vendors, materials, nextPoNumber] = await Promise.all([
    db.party.findMany({
      where: { type: 'SUPPLIER', deletedAt: null },
      select: { id: true, name: true, incoterms: true },
      orderBy: { name: 'asc' },
    }),
    db.party.findMany({
      where: { type: 'VENDOR', deletedAt: null },
      select: { id: true, name: true, serviceType: true },
      orderBy: { name: 'asc' },
    }),
    db.product.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, materialType: true },
      orderBy: { name: 'asc' },
    }),
    getNextPoNumber(),
  ]);

  return {
    suppliers,
    vendors: vendors.map((v) => ({ id: v.id, name: v.name, service: v.serviceType ?? 'Other' })),
    materials: materials.map((m) => ({ id: m.id, name: m.name, type: m.materialType })),
    nextPoNumber,
  };
}
