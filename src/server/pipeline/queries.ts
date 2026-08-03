import 'server-only';
import { db } from '@/lib/db';

export type OppItem = {
  id: string;
  name: string;
  customerLabel: string;
  associateName: string;
  amount: number;
  probability: number;
  status: string;
  expectedClose: string | null;
  /** Best-effort material line when the deal name matches a catalog product. */
  materialName: string | null;
  materialType: string | null;
  baseColor: string | null;
};

export const PIPELINE_STAGES = ['LEAD', 'QUOTED', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'] as const;

function matchMaterial(
  dealName: string,
  products: { name: string; materialType: string; baseColor: string }[],
): { materialName: string; materialType: string; baseColor: string } | null {
  const n = dealName.toLowerCase();
  // Longest product name first so "Calacatta Gold" beats "Gold"
  const sorted = [...products].sort((a, b) => b.name.length - a.name.length);
  for (const p of sorted) {
    if (p.name.length < 3) continue;
    if (n.includes(p.name.toLowerCase())) {
      return { materialName: p.name, materialType: p.materialType, baseColor: p.baseColor };
    }
  }
  return null;
}

export async function getOpportunities(scopeAssociateSystemId: string | null): Promise<OppItem[]> {
  const [opps, products] = await Promise.all([
    db.opportunity.findMany({
      where: {
        deletedAt: null,
        ...(scopeAssociateSystemId ? { associate: { systemId: scopeAssociateSystemId } } : {}),
      },
      include: {
        associate: { select: { name: true } },
        customer: { select: { name: true } },
      },
      orderBy: { amount: 'desc' },
    }),
    db.product.findMany({
      where: { deletedAt: null },
      select: { name: true, materialType: true, baseColor: true },
    }),
  ]);

  return opps.map((o) => {
    const mat = matchMaterial(o.name, products);
    return {
      id: o.id,
      name: o.name,
      customerLabel: o.customer?.name ?? o.leadName ?? 'New Lead',
      associateName: o.associate?.name ?? 'Unassigned',
      amount: o.amount,
      probability: o.probability,
      status: o.status,
      expectedClose: o.expectedCloseDate ? o.expectedCloseDate.toISOString().split('T')[0] : null,
      materialName: mat?.materialName ?? null,
      materialType: mat?.materialType ?? null,
      baseColor: mat?.baseColor ?? null,
    };
  });
}

export async function getAssociateOptions(): Promise<{ id: string; name: string }[]> {
  return db.party.findMany({
    where: { type: 'ASSOCIATE', deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

export type QuotableSlab = {
  id: string;
  uniqueSlabId: string;
  productName: string;
  materialType: string;
  baseColor: string;
  sqft: number;
  minPricePerSf: number;
  retailPricePerSf: number;
};

/** Available slabs a won deal can be converted into a sales order against. */
export async function getQuotableSlabs(): Promise<QuotableSlab[]> {
  const slabs = await db.inventoryItem.findMany({
    where: { status: 'AVAILABLE', deletedAt: null },
    include: {
      product: {
        select: {
          name: true,
          materialType: true,
          baseColor: true,
          minPricePerSf: true,
          retailPricePerSf: true,
        },
      },
    },
    orderBy: { uniqueSlabId: 'asc' },
  });
  return slabs.map((s) => ({
    id: s.id,
    uniqueSlabId: s.uniqueSlabId,
    productName: s.product.name,
    materialType: s.product.materialType,
    baseColor: s.product.baseColor,
    sqft: s.totalSf,
    minPricePerSf: s.product.minPricePerSf ?? 0,
    retailPricePerSf: s.product.retailPricePerSf ?? 0,
  }));
}
