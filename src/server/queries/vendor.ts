import 'server-only';
import { db } from '@/lib/db';
import { LOGISTICS_STATUS_LABEL, type PoLogisticsStatus } from '@/lib/logistics-stages';

export type VendorOrder = {
  poNumber: string;
  supplierName: string;
  materialName: string;
  /** Display label aligned with admin logistics language. */
  status: string;
  /** Raw stage for progress bars. */
  logisticsStatus: PoLogisticsStatus;
  eta: string | null;
  containerId: string | null;
  leg: string;
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
    orders: pos.map((po) => {
      const logisticsStatus = (po.logisticsStatus as PoLogisticsStatus) ?? 'PRODUCTION';
      return {
        poNumber: po.poNumber,
        supplierName: po.supplier?.name ?? '—',
        materialName: po.product?.name ?? '—',
        status: LOGISTICS_STATUS_LABEL[logisticsStatus] ?? po.logisticsStatus,
        logisticsStatus,
        eta: po.eta,
        containerId: po.containerId,
        leg: legOf(po),
      };
    }),
    invoices: invoices.map((inv) => ({
      invoiceNum: inv.invoiceNum,
      status: inv.status,
      amount: inv.amount,
      dueDate: inv.dueDate ? inv.dueDate.toISOString().split('T')[0] : null,
      serviceDetails: inv.serviceDetails,
    })),
  };
}
