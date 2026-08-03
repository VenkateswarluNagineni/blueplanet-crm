import 'server-only';
import { db } from '@/lib/db';

export type CatalogSlab = { id: string; uniqueSlabId: string; totalSf: number };

export type CatalogProduct = {
  id: string;
  name: string;
  sku: string;
  materialType: string;
  productType: string;
  category: string | null;
  subCategory: string | null;
  productGroup: string | null;
  altName: string | null;
  genericSku: string | null;
  finish: string;
  baseColor: string;
  thickness: string | null;
  originCountry: string | null;
  retailPricePerSf: number | null;
  minPricePerSf: number | null;
  /** null when the viewer is not allowed to see landed cost. */
  avgCostPerSf: number | null;
  slabsInYard: number;
  slabsOnHold: number;
  slabsInTransit: number;
  approvedSuppliers: { id: string; name: string }[];
  inboundPOs: { poNumber: string; eta: string | null; containerId: string | null; orderedSlabs: number }[];
  availableSlabs: CatalogSlab[];
};

/**
 * Builds the full catalog view from the database. Inventory counts are derived
 * live from InventoryItem status (yard/hold) and open PurchaseOrders (transit),
 * so the Catalog always reflects the real state — no hardcoded panels.
 */
export async function getCatalog(
  canViewCost: boolean,
  locationIds?: string[] | null,
): Promise<CatalogProduct[]> {
  // Scope yard/hold counts and available slabs to the viewer's locations
  // (null = unrestricted, e.g. admin). The product list itself stays global.
  const locScope = locationIds ? { presentLocationId: { in: locationIds } } : {};
  const [products, statusGroups, openPos, availSlabs, suppliers] = await Promise.all([
    db.product.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }),
    db.inventoryItem.groupBy({
      by: ['productId', 'status'],
      where: { deletedAt: null, ...locScope },
      _count: { _all: true },
    }),
    db.purchaseOrder.findMany({
      where: { deletedAt: null, logisticsStatus: { not: 'RECEIVED' }, productId: { not: null } },
      select: { productId: true, poNumber: true, eta: true, containerId: true, orderedSlabs: true },
    }),
    db.inventoryItem.findMany({
      where: { deletedAt: null, status: 'AVAILABLE', ...locScope },
      select: { id: true, uniqueSlabId: true, totalSf: true, productId: true },
      orderBy: { uniqueSlabId: 'asc' },
    }),
    db.party.findMany({ where: { type: 'SUPPLIER', deletedAt: null }, select: { id: true, name: true } }),
  ]);

  const supplierName = new Map(suppliers.map((s) => [s.id, s.name]));

  const countOf = (productId: string, status: string) =>
    statusGroups.find((g) => g.productId === productId && g.status === status)?._count._all ?? 0;

  return products.map((p) => {
    const inbound = openPos.filter((po) => po.productId === p.id);
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      materialType: p.materialType,
      productType: p.productType,
      category: p.category,
      subCategory: p.subCategory,
      productGroup: p.productGroup,
      altName: p.altName,
      genericSku: p.genericSku,
      finish: p.finish,
      baseColor: p.baseColor,
      thickness: p.thickness,
      originCountry: p.originCountry,
      retailPricePerSf: p.retailPricePerSf,
      minPricePerSf: p.minPricePerSf,
      avgCostPerSf: canViewCost ? p.avgCostPerSf : null,
      slabsInYard: countOf(p.id, 'AVAILABLE'),
      slabsOnHold: countOf(p.id, 'ON_HOLD'),
      slabsInTransit: inbound.reduce((sum, po) => sum + po.orderedSlabs, 0),
      approvedSuppliers: p.approvedSupplierIds
        .map((id) => ({ id, name: supplierName.get(id) ?? 'Archived Supplier' })),
      inboundPOs: inbound.map((po) => ({
        poNumber: po.poNumber,
        eta: po.eta,
        containerId: po.containerId,
        orderedSlabs: po.orderedSlabs,
      })),
      availableSlabs: availSlabs
        .filter((s) => s.productId === p.id)
        .map((s) => ({ id: s.id, uniqueSlabId: s.uniqueSlabId, totalSf: s.totalSf })),
    };
  });
}
