'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { getEffectiveRole, getSessionContext } from '@/lib/domain/auth';
import { requireRole } from '@/lib/domain/rbac';

export type ActionResult = { ok: true } | { ok: false; error: string };

async function nextSoNumber(): Promise<string> {
  const latest = await db.salesOrder.findFirst({
    where: { soNumber: { startsWith: 'SO-' } },
    orderBy: { soNumber: 'desc' },
    select: { soNumber: true },
  });
  const current = latest ? parseInt(latest.soNumber.replace('SO-', ''), 10) : 1000;
  return `SO-${(Number.isNaN(current) ? 1000 : current) + 1}`;
}

/**
 * The associate Party the signed-in seller acts as, resolved from their identity.
 * An ADMIN creating a quote without a linked associate falls back to the first
 * associate so the order is still attributable.
 */
async function currentAssociateId(): Promise<string | null> {
  const ctx = await getSessionContext();
  if (ctx?.party?.type === 'ASSOCIATE') return ctx.party.id;
  const fallback = await db.party.findFirst({ where: { type: 'ASSOCIATE', deletedAt: null } });
  return fallback?.id ?? null;
}

const QuoteSchema = z.object({
  slabId: z.string().min(1),
  pricePerSf: z.number().positive(),
  customerName: z.string().min(1).max(200),
});

export async function createQuoteAction(input: {
  slabId: string;
  pricePerSf: number;
  customerName: string;
}): Promise<ActionResult> {
  const role = await getEffectiveRole();
  requireRole(role, ['ADMIN', 'SALES']);

  const parsed = QuoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid quote details.' };
  const { slabId, pricePerSf, customerName } = parsed.data;

  const slab = await db.inventoryItem.findFirst({
    where: { id: slabId, deletedAt: null },
    include: { product: true },
  });
  if (!slab) return { ok: false, error: 'Slab not found.' };
  if (slab.status !== 'AVAILABLE') return { ok: false, error: 'Slab is no longer available.' };

  // Server-side enforcement of the authorized minimum sell price.
  const floor = slab.product.minPricePerSf ?? 0;
  if (pricePerSf < floor) {
    return { ok: false, error: `Price cannot be below the authorized minimum of $${floor}/sqft.` };
  }

  const soNumber = await nextSoNumber();
  const associateId = await currentAssociateId();

  await db.$transaction([
    db.salesOrder.create({
      data: {
        soNumber,
        customerName,
        associateId,
        status: 'PLACED',
        soLineItems: {
          create: [
            {
              inventoryItemId: slab.id,
              soldPricePerSf: pricePerSf,
              landedCostAtSale: slab.costLanded ?? 0,
            },
          ],
        },
      },
    }),
    db.inventoryItem.update({ where: { id: slab.id }, data: { status: 'ON_HOLD' } }),
  ]);

  revalidatePath('/catalog');
  revalidatePath('/orders');
  return { ok: true };
}

export async function completeOrderAction(orderId: string, receiptRef: string): Promise<ActionResult> {
  const role = await getEffectiveRole();
  requireRole(role, ['ADMIN', 'SALES']);
  if (!receiptRef.trim()) return { ok: false, error: 'A receipt reference is required.' };

  const order = await db.salesOrder.findFirst({
    where: { id: orderId, deletedAt: null },
    include: { soLineItems: { include: { inventoryItem: true } } },
  });
  if (!order) return { ok: false, error: 'Order not found.' };
  if (order.status !== 'PLACED') return { ok: false, error: 'Only placed orders can be completed.' };

  const orderValue = order.soLineItems.reduce(
    (sum, li) => sum + li.soldPricePerSf * (li.inventoryItem?.totalSf ?? 0),
    0,
  );

  await db.$transaction([
    db.salesOrder.update({
      where: { id: order.id },
      data: { status: 'COMPLETED', receiptRef: receiptRef.trim() },
    }),
    ...order.soLineItems.map((li) =>
      db.inventoryItem.update({ where: { id: li.inventoryItemId }, data: { status: 'SOLD' } }),
    ),
    ...(order.associateId
      ? [
          db.party.update({
            where: { id: order.associateId },
            data: { totalSold: { increment: orderValue } },
          }),
        ]
      : []),
  ]);

  revalidatePath('/orders');
  revalidatePath('/catalog');
  revalidatePath('/crm');
  return { ok: true };
}

/**
 * Revert a completed or cancelled order back to PLACED (pending). Completed orders
 * unwind the sale: slabs return to ON_HOLD and the rep's YTD sold is decremented by
 * the original order value. Cancelled orders re-hold their (still-available) slabs.
 */
export async function reopenOrderAction(orderId: string): Promise<ActionResult> {
  const role = await getEffectiveRole();
  requireRole(role, ['ADMIN', 'SALES']);

  const order = await db.salesOrder.findFirst({
    where: { id: orderId, deletedAt: null },
    include: { soLineItems: { include: { inventoryItem: true } } },
  });
  if (!order) return { ok: false, error: 'Order not found.' };
  if (order.status === 'PLACED') return { ok: false, error: 'This order is already open.' };

  const wasCompleted = order.status === 'COMPLETED';
  const orderValue = order.soLineItems.reduce(
    (sum, li) => sum + li.soldPricePerSf * (li.inventoryItem?.totalSf ?? 0),
    0,
  );

  await db.$transaction([
    db.salesOrder.update({
      where: { id: order.id },
      data: { status: 'PLACED', ...(wasCompleted ? { receiptRef: null } : {}) },
    }),
    // Re-hold the slabs: SOLD (completed) or AVAILABLE (cancelled) → ON_HOLD.
    ...order.soLineItems.map((li) =>
      db.inventoryItem.update({ where: { id: li.inventoryItemId }, data: { status: 'ON_HOLD' } }),
    ),
    // Unwind the recognized revenue only if it had been completed.
    ...(wasCompleted && order.associateId
      ? [
          db.party.update({
            where: { id: order.associateId },
            data: { totalSold: { decrement: orderValue } },
          }),
        ]
      : []),
  ]);

  revalidatePath('/orders');
  revalidatePath('/catalog');
  revalidatePath('/crm');
  return { ok: true };
}

export async function cancelOrderAction(orderId: string): Promise<ActionResult> {
  const role = await getEffectiveRole();
  requireRole(role, ['ADMIN', 'SALES']);

  const order = await db.salesOrder.findFirst({
    where: { id: orderId, deletedAt: null },
    include: { soLineItems: true },
  });
  if (!order) return { ok: false, error: 'Order not found.' };
  if (order.status !== 'PLACED') return { ok: false, error: 'Only placed orders can be cancelled.' };

  await db.$transaction([
    db.salesOrder.update({ where: { id: order.id }, data: { status: 'CANCELLED' } }),
    // Release the held slabs back to AVAILABLE.
    ...order.soLineItems.map((li) =>
      db.inventoryItem.updateMany({
        where: { id: li.inventoryItemId, status: 'ON_HOLD' },
        data: { status: 'AVAILABLE' },
      }),
    ),
  ]);

  revalidatePath('/orders');
  revalidatePath('/catalog');
  return { ok: true };
}
