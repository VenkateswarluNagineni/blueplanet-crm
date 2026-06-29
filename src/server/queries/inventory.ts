import 'server-only';
import { db } from '@/lib/db';

/**
 * The full lineage of a single slab — every counterparty and document that
 * touched it, from supplier origin through to the customer it was sold to.
 * Powers the Material Passport and the search-by-supplier/lot/date experience.
 */
export type SlabTrace = {
  // Supplier / origin
  supplierName: string | null;
  supplierOrigin: string | null;
  poNumber: string | null;
  poIssuedAt: string | null; // ISO date
  poEstimatedDelivery: string | null; // ISO date
  unitCost: number | null; // negotiated FOB $/sf (cost-gated)
  // Transit / receiving
  oceanVendorName: string | null;
  customsVendorName: string | null;
  inlandVendorName: string | null;
  containerId: string | null;
  receiptNumber: string | null;
  documentRefs: string[];
  // Sale
  sold: boolean;
  customerName: string | null;
  salesRepName: string | null;
  soNumber: string | null;
  soldAt: string | null; // ISO date
  soldPricePerSf: number | null; // cost-gated
};

export type MovementRow = {
  id: string;
  type: string; // TRANSFER, HOLD, RELEASE, WRITE_OFF
  fromLocation: string | null;
  toLocation: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
  note: string | null;
  byRole: string | null;
  createdAt: string; // ISO
};

export type InventoryRow = {
  id: string;
  uniqueSlabId: string;
  barcode: string;
  status: string;
  holdReason: string | null;
  lengthInches: number;
  widthInches: number;
  totalSf: number;
  costFob: number | null;
  costApportioned: number | null;
  costLanded: number | null;
  lotNumber: string | null;
  bundleId: string | null;
  createdAt: Date;
  presentLocationId: string;
  product: { name: string; materialType: string; originCountry: string | null };
  location: { name: string };
  movements: MovementRow[];
  trace: SlabTrace;
};

export type InventoryLocation = { id: string; name: string; code: string };

const VENDOR_COVERED = 'SUPPLIER_COVERED';

export async function getInventoryItems(
  canViewCost: boolean,
  locationIds?: string[] | null,
): Promise<InventoryRow[]> {
  const items = await db.inventoryItem.findMany({
    where: {
      deletedAt: null,
      // Scope to the viewer's assigned locations (null = unrestricted, e.g. admin).
      ...(locationIds ? { presentLocationId: { in: locationIds } } : {}),
    },
    include: {
      product: { select: { name: true, materialType: true, originCountry: true } },
      location: { select: { name: true } },
      movements: { orderBy: { createdAt: 'desc' }, take: 20 },
      poLineItem: {
        include: { purchaseOrder: { include: { supplier: { select: { name: true, originCountry: true } } } } },
      },
      soLineItem: {
        include: {
          salesOrder: {
            include: {
              customer: { select: { name: true } },
              associate: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { uniqueSlabId: 'asc' },
  });

  // Location id → name map for resolving movement from/to locations in one round-trip.
  const locs = await db.location.findMany({ where: { deletedAt: null }, select: { id: true, name: true } });
  const locName = new Map(locs.map((l) => [l.id, l.name]));

  // Resolve logistics-vendor ids (ocean/customs/inland are stored as Party ids
  // or the SUPPLIER_COVERED sentinel) to display names in one round-trip.
  const vendorIds = new Set<string>();
  for (const i of items) {
    const po = i.poLineItem?.purchaseOrder;
    if (!po) continue;
    for (const id of [po.oceanVendorId, po.customsVendorId, po.inlandVendorId]) {
      if (id && id !== VENDOR_COVERED) vendorIds.add(id);
    }
  }
  const vendors = vendorIds.size
    ? await db.party.findMany({ where: { id: { in: [...vendorIds] } }, select: { id: true, name: true } })
    : [];
  const vendorName = new Map(vendors.map((v) => [v.id, v.name]));
  const resolveVendor = (id: string | null | undefined): string | null =>
    !id ? null : id === VENDOR_COVERED ? 'Supplier-covered' : vendorName.get(id) ?? 'Archived vendor';

  return items.map((i) => {
    const po = i.poLineItem?.purchaseOrder ?? null;
    const so = i.soLineItem?.salesOrder ?? null;
    const trace: SlabTrace = {
      supplierName: po?.supplier?.name ?? null,
      supplierOrigin: po?.supplier?.originCountry ?? i.product.originCountry ?? null,
      poNumber: po?.poNumber ?? null,
      poIssuedAt: po?.issuedAt ? po.issuedAt.toISOString() : null,
      poEstimatedDelivery: po?.estimatedDelivery ? po.estimatedDelivery.toISOString() : null,
      unitCost: canViewCost ? po?.unitCost ?? null : null,
      oceanVendorName: resolveVendor(po?.oceanVendorId),
      customsVendorName: resolveVendor(po?.customsVendorId),
      inlandVendorName: resolveVendor(po?.inlandVendorId),
      containerId: po?.containerId ?? null,
      receiptNumber: po?.receiptNumber ?? null,
      documentRefs: po?.documentRefs ?? [],
      sold: !!so,
      customerName: so?.customer?.name ?? so?.customerName ?? null,
      salesRepName: so?.associate?.name ?? null,
      soNumber: so?.soNumber ?? null,
      soldAt: so?.placedAt ? so.placedAt.toISOString() : null,
      soldPricePerSf: canViewCost ? i.soLineItem?.soldPricePerSf ?? null : null,
    };

    return {
      id: i.id,
      uniqueSlabId: i.uniqueSlabId,
      barcode: i.barcode,
      status: i.status,
      holdReason: i.holdReason,
      lengthInches: i.lengthInches,
      widthInches: i.widthInches,
      totalSf: i.totalSf,
      costFob: canViewCost ? i.costFob : null,
      costApportioned: canViewCost ? i.costApportioned : null,
      costLanded: canViewCost ? i.costLanded : null,
      lotNumber: i.lotNumber,
      bundleId: i.bundleId,
      createdAt: i.createdAt,
      presentLocationId: i.presentLocationId,
      product: i.product,
      location: i.location,
      movements: i.movements.map((m) => ({
        id: m.id, type: m.type,
        fromLocation: m.fromLocationId ? locName.get(m.fromLocationId) ?? null : null,
        toLocation: m.toLocationId ? locName.get(m.toLocationId) ?? null : null,
        fromStatus: m.fromStatus, toStatus: m.toStatus, reason: m.reason, note: m.note,
        byRole: m.byRole, createdAt: m.createdAt.toISOString(),
      })),
      trace,
    };
  });
}

export async function getInventoryLocations(): Promise<InventoryLocation[]> {
  const locs = await db.location.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, code: true },
    orderBy: { name: 'asc' },
  });
  return locs;
}
