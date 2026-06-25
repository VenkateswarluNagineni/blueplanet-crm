import 'server-only';
import { db } from '@/lib/db';

const PO_LABEL: Record<string, string> = {
  PRODUCTION: 'In Production',
  ON_WATER: 'On Water',
  CUSTOMS: 'Clearing Customs',
  INLAND_TRANSIT: 'Inland Transit',
  RECEIVED: 'Delivered',
};

export type VendorOrder = {
  poNumber: string; supplierName: string; materialName: string; status: string;
  eta: string | null; containerId: string | null; leg: string;
};
export type VendorInvoiceRow = {
  invoiceNum: string; status: string; amount: number; dueDate: string | null; serviceDetails: string | null;
};
export type VendorPortal = {
  vendorName: string;
  serviceType: string;
  balanceDue: number;
  orders: VendorOrder[];
  invoices: VendorInvoiceRow[];
};

export async function getVendorPortal(vendorSystemId: string): Promise<VendorPortal | null> {
  const vendor = await db.party.findFirst({ where: { type: 'VENDOR', systemId: vendorSystemId, deletedAt: null } });
  if (!vendor) return null;

  const [pos, invoices] = await Promise.all([
    db.purchaseOrder.findMany({
      where: {
        deletedAt: null,
        OR: [{ oceanVendorId: vendor.id }, { customsVendorId: vendor.id }, { inlandVendorId: vendor.id }],
      },
      include: { supplier: { select: { name: true } }, product: { select: { name: true } } },
      orderBy: { issuedAt: 'desc' },
    }),
    db.vendorInvoice.findMany({ where: { vendorId: vendor.id, deletedAt: null }, orderBy: { dueDate: 'asc' } }),
  ]);

  const legOf = (po: (typeof pos)[number]) =>
    po.oceanVendorId === vendor.id ? 'Ocean Freight'
      : po.customsVendorId === vendor.id ? 'Customs & Tariffs'
        : 'Inland Logistics';

  return {
    vendorName: vendor.name,
    serviceType: vendor.serviceType ?? 'Logistics',
    balanceDue: vendor.balanceDue,
    orders: pos.map((po) => ({
      poNumber: po.poNumber,
      supplierName: po.supplier?.name ?? '—',
      materialName: po.product?.name ?? '—',
      status: PO_LABEL[po.logisticsStatus] ?? po.logisticsStatus,
      eta: po.eta,
      containerId: po.containerId,
      leg: legOf(po),
    })),
    invoices: invoices.map((inv) => ({
      invoiceNum: inv.invoiceNum,
      status: inv.status,
      amount: inv.amount,
      dueDate: inv.dueDate ? inv.dueDate.toISOString().split('T')[0] : null,
      serviceDetails: inv.serviceDetails,
    })),
  };
}
