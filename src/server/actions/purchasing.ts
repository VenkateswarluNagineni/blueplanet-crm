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
  destinationHub: z.string().min(1),
  estimatedDelivery: z.string().min(1, 'An estimated delivery date is required.'),
});

export async function createPOAction(input: {
  supplierId: string;
  materialId: string;
  orderedSlabs: number;
  unitCost: number;
  oceanVendorId?: string;
  customsVendorId?: string;
  inlandVendorId?: string;
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

  const [supplier, product] = await Promise.all([
    db.party.findFirst({ where: { id: d.supplierId, type: 'SUPPLIER', deletedAt: null } }),
    db.product.findFirst({ where: { id: d.materialId, deletedAt: null } }),
  ]);
  if (!supplier || !product) return { ok: false, error: 'Supplier or material not found.' };

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

    const slabCreates = Array.from({ length: po.orderedSlabs }).map((_, i) => {
      const n = counter + i + 1;
      const lengthInches = 118 + (n % 14);
      const widthInches = 65 + (n % 13);
      const totalSf = Math.round(((lengthInches * widthInches) / 144) * 10) / 10;
      const costLanded = Math.round(totalSf * po.unitCost * 100) / 100;
      const costFob = Math.round(costLanded * 0.7 * 100) / 100;
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
          costApportioned: Math.round((costLanded - costFob) * 100) / 100,
          costLanded,
        },
      });
    });

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
    ]);

    revalidatePath('/purchases');
    revalidatePath('/catalog');
    revalidatePath('/inventory');
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
