'use server';

import { z } from 'zod';
import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { getEffectiveRole } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import type { PoLogisticsStatus } from '@/server/queries/purchasing';

export type ActionResult = { ok: true } | { ok: false; error: string };

const ADVANCE: Record<PoLogisticsStatus, PoLogisticsStatus> = {
  PRODUCTION: 'ON_WATER',
  ON_WATER: 'CUSTOMS',
  CUSTOMS: 'INLAND_TRANSIT',
  INLAND_TRANSIT: 'RECEIVED',
  RECEIVED: 'RECEIVED',
};

const MATERIAL_ABBREV: Record<string, string> = {
  Marble: 'MBL',
  Quartzite: 'QZT',
  Granite: 'GRN',
  Travertine: 'TRV',
};

async function nextPoNumber(): Promise<string> {
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

const CreatePoSchema = z.object({
  supplierId: z.string().min(1),
  materialId: z.string().min(1),
  orderedSlabs: z.number().int().positive(),
  unitCost: z.number().positive(),
  oceanVendorId: z.string().optional(),
  customsVendorId: z.string().optional(),
  inlandVendorId: z.string().optional(),
  oceanCost: z.number().min(0).optional(),
  customsCost: z.number().min(0).optional(),
  inlandCost: z.number().min(0).optional(),
  destinationHub: z.string().min(1),
  estimatedDelivery: z.string().min(1, 'An estimated delivery date is required.'),
});

// A leg has a real third-party vendor (so it needs its own price) when an id is
// chosen that isn't the supplier-covered sentinel.
const isThirdParty = (id?: string) => !!id && id !== 'SUPPLIER_COVERED';

export async function createPOAction(input: {
  supplierId: string;
  materialId: string;
  orderedSlabs: number;
  unitCost: number;
  oceanVendorId?: string;
  customsVendorId?: string;
  inlandVendorId?: string;
  oceanCost?: number;
  customsCost?: number;
  inlandCost?: number;
  destinationHub: string;
  estimatedDelivery: string;
}): Promise<ActionResult> {
  const role = await getEffectiveRole();
  requireRole(role, ['ADMIN']);

  const parsed = CreatePoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Please complete all required PO fields, including the estimated delivery date.' };
  const d = parsed.data;

  const etaDate = new Date(d.estimatedDelivery);
  if (Number.isNaN(etaDate.getTime())) return { ok: false, error: 'The estimated delivery date is invalid.' };

  // Each leg handled by a third-party vendor needs its own price; supplier-covered legs cost 0.
  const oceanCost = isThirdParty(d.oceanVendorId) ? d.oceanCost ?? 0 : 0;
  const customsCost = isThirdParty(d.customsVendorId) ? d.customsCost ?? 0 : 0;
  const inlandCost = isThirdParty(d.inlandVendorId) ? d.inlandCost ?? 0 : 0;
  if (isThirdParty(d.oceanVendorId) && !(oceanCost > 0)) return { ok: false, error: 'Enter the ocean freight price for the selected carrier.' };
  if (isThirdParty(d.customsVendorId) && !(customsCost > 0)) return { ok: false, error: 'Enter the customs brokerage price for the selected broker.' };
  if (isThirdParty(d.inlandVendorId) && !(inlandCost > 0)) return { ok: false, error: 'Enter the inland trucking price for the selected carrier.' };

  const [supplier, product] = await Promise.all([
    db.party.findFirst({ where: { id: d.supplierId, type: 'SUPPLIER', deletedAt: null } }),
    db.product.findFirst({ where: { id: d.materialId, deletedAt: null } }),
  ]);
  if (!supplier || !product) return { ok: false, error: 'Supplier or material not found.' };

  // Validate that every chosen third-party vendor actually exists.
  const vendorIds = [d.oceanVendorId, d.customsVendorId, d.inlandVendorId].filter(isThirdParty) as string[];
  if (vendorIds.length) {
    const found = await db.party.count({ where: { id: { in: vendorIds }, type: 'VENDOR', deletedAt: null } });
    if (found !== new Set(vendorIds).size) return { ok: false, error: 'One or more selected vendors could not be found.' };
  }

  const poNumber = await nextPoNumber();
  const ledgerHash = 'sha256:' + randomBytes(32).toString('hex');
  const avgSf = 63.5;

  await db.purchaseOrder.create({
    data: {
      poNumber,
      supplierId: supplier.id,
      productId: product.id,
      status: 'ISSUED',
      logisticsStatus: 'PRODUCTION',
      orderedSlabs: d.orderedSlabs,
      unitCost: d.unitCost,
      oceanVendorId: d.oceanVendorId || null,
      customsVendorId: d.customsVendorId || null,
      inlandVendorId: d.inlandVendorId || null,
      oceanCost,
      customsCost,
      inlandCost,
      destinationHub: d.destinationHub,
      eta: etaDate.toISOString().split('T')[0],
      estimatedDelivery: etaDate,
      ledgerHash,
      poLineItems: {
        create: [{ expectedSf: d.orderedSlabs * avgSf, expectedCost: d.orderedSlabs * avgSf * d.unitCost }],
      },
    },
  });

  revalidatePath('/purchases');
  revalidatePath('/catalog');
  return { ok: true };
}

export async function advancePOAction(poId: string, docRef?: string): Promise<ActionResult> {
  const role = await getEffectiveRole();
  requireRole(role, ['ADMIN']);

  const po = await db.purchaseOrder.findFirst({
    where: { id: poId, deletedAt: null },
    include: { product: true },
  });
  if (!po) return { ok: false, error: 'Purchase order not found.' };

  const current = po.logisticsStatus as PoLogisticsStatus;
  if (current === 'RECEIVED') return { ok: false, error: 'This PO is already received.' };
  const next = ADVANCE[current];
  const newDocs = docRef ? [...po.documentRefs, docRef] : po.documentRefs;

  if (next === 'RECEIVED') {
    // Resolve the destination location, then materialise the ordered slabs as
    // real inventory in a single transaction (no double-counting).
    const location =
      (po.destinationHub
        ? await db.location.findFirst({ where: { name: po.destinationHub, deletedAt: null } })
        : null) ?? (await db.location.findFirst({ where: { deletedAt: null } }));
    if (!location) return { ok: false, error: 'No destination location configured.' };

    const maxBarcode = await db.inventoryItem.aggregate({ _max: { barcode: true } });
    let counter = parseInt(maxBarcode._max.barcode ?? '1000000', 10);
    if (Number.isNaN(counter)) counter = 1000000;

    const abbrev = po.product ? MATERIAL_ABBREV[po.product.materialType] ?? 'GEN' : 'GEN';
    const locShort = location.code.replace('BP-', '');
    const yy = String(new Date().getFullYear()).slice(-2);

    const round2 = (v: number) => Math.round(v * 100) / 100;

    // Generate the physical slabs first so freight can be apportioned by true SF share.
    const specs = Array.from({ length: po.orderedSlabs }).map((_, i) => {
      const n = counter + i + 1;
      const lengthInches = 118 + (n % 14);
      const widthInches = 65 + (n % 13);
      const totalSf = Math.round(((lengthInches * widthInches) / 144) * 10) / 10;
      return { n, lengthInches, widthInches, totalSf };
    });
    const sumSf = specs.reduce((s, x) => s + x.totalSf, 0) || 1;
    const totalFreight = po.oceanCost + po.customsCost + po.inlandCost;

    const slabCreates = specs.map(({ n, lengthInches, widthInches, totalSf }) => {
      const costFob = round2(totalSf * po.unitCost); // supplier material
      const costApportioned = round2(totalFreight * (totalSf / sumSf)); // this slab's share of freight
      const costLanded = round2(costFob + costApportioned);
      return db.inventoryItem.create({
        data: {
          uniqueSlabId: `BP-${locShort}-${yy}-${abbrev}-${n}`,
          barcode: `${n}`,
          productId: po.productId!,
          presentLocationId: location.id,
          status: 'AVAILABLE',
          lotNumber: po.containerId ?? po.poNumber,
          lengthInches,
          widthInches,
          totalSf,
          costFob,
          costApportioned,
          costLanded,
        },
      });
    });

    const materialTotal = round2(sumSf * po.unitCost);

    // Each third-party logistics leg becomes a payable invoice against that vendor,
    // and the vendor's running balance is bumped — keeping AP and CRM in sync.
    const dueDate = new Date((po.estimatedDelivery ?? new Date()).getTime() + 30 * 24 * 60 * 60 * 1000);
    const legs = [
      { id: po.oceanVendorId, cost: po.oceanCost, suffix: 'OF', label: 'Ocean freight' },
      { id: po.customsVendorId, cost: po.customsCost, suffix: 'CB', label: 'Customs brokerage' },
      { id: po.inlandVendorId, cost: po.inlandCost, suffix: 'IL', label: 'Inland trucking' },
    ];
    const apOps = legs
      .filter((l) => l.id && l.id !== 'SUPPLIER_COVERED' && l.cost > 0)
      .flatMap((l) => [
        db.vendorInvoice.create({
          data: {
            invoiceNum: `${po.poNumber}-${l.suffix}`,
            vendorId: l.id!,
            status: 'Pending Payment',
            amount: l.cost,
            dueDate,
            serviceDetails: `${l.label} — container ${po.containerId ?? po.poNumber} (PO ${po.poNumber})`,
          },
        }),
        db.party.update({ where: { id: l.id! }, data: { balanceDue: { increment: l.cost } } }),
      ]);

    await db.$transaction([
      db.purchaseOrder.update({
        where: { id: po.id },
        data: {
          logisticsStatus: 'RECEIVED',
          status: 'FULFILLED',
          documentRefs: newDocs,
          // The reference captured when closing the PO is the goods-receipt number.
          ...(docRef ? { receiptNumber: docRef } : {}),
        },
      }),
      ...slabCreates,
      // Supplier spend rolls up onto the supplier party (shown in CRM).
      db.party.update({ where: { id: po.supplierId }, data: { totalPurchased: { increment: materialTotal } } }),
      ...apOps,
    ]);

    revalidatePath('/purchases');
    revalidatePath('/catalog');
    revalidatePath('/inventory');
    revalidatePath('/crm');
    revalidatePath('/vendor');
    revalidatePath('/analytics');
    return { ok: true };
  }

  await db.purchaseOrder.update({
    where: { id: po.id },
    data: { logisticsStatus: next, documentRefs: newDocs },
  });
  revalidatePath('/purchases');
  revalidatePath('/catalog');
  return { ok: true };
}
