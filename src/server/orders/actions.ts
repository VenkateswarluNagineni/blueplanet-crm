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
  customerId: z.string().optional(),
  edgeProfile: z.string().trim().max(60).optional().or(z.literal('')),
  edgeUpchargePerSf: z.number().min(0).default(0),
  cutoutCount: z.number().int().min(0).default(0),
  cutoutUpchargeEach: z.number().min(0).default(0),
});

export async function createQuoteAction(input: {
  slabId: string;
  pricePerSf: number;
  customerName: string;
  customerId?: string;
  edgeProfile?: string;
  edgeUpchargePerSf?: number;
  cutoutCount?: number;
  cutoutUpchargeEach?: number;
}): Promise<ActionResult> {
  const role = await getEffectiveRole();
  requireRole(role, ['ADMIN', 'SALES']);

  const parsed = QuoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid quote details.' };
  const { slabId, pricePerSf, customerName, customerId, edgeProfile, edgeUpchargePerSf, cutoutCount, cutoutUpchargeEach } = parsed.data;

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

  // Same credit-limit enforcement convertOpportunityToOrderAction already applies on the
  // pipeline path (src/server/pipeline/actions.ts) — the catalog-quote path previously
  // bypassed it entirely since it never linked a customerId at all.
  if (customerId) {
    const customer = await db.party.findFirst({
      where: { id: customerId, type: 'CUSTOMER', deletedAt: null },
      select: { name: true, creditLimit: true, creditLockExempt: true, salesLockNote: true },
    });
    if (customer && !customer.creditLockExempt) {
      if (customer.salesLockNote) {
        return { ok: false, error: customer.salesLockNote };
      }
      if (customer.creditLimit > 0) {
        const openOrders = await db.salesOrder.findMany({
          where: { customerId, status: 'PLACED', deletedAt: null },
          include: { soLineItems: { include: { inventoryItem: { select: { totalSf: true } } } } },
        });
        const openExposure = openOrders.reduce(
          (sum, so) =>
            sum + so.soLineItems.reduce((s, li) => s + li.soldPricePerSf * (li.inventoryItem?.totalSf ?? 0), 0),
          0,
        );
        const newOrderValue = pricePerSf * slab.totalSf;
        const projected = openExposure + newOrderValue;
        if (projected > customer.creditLimit) {
          return {
            ok: false,
            error: `This order would put ${customer.name} $${Math.round(
              projected - customer.creditLimit,
            ).toLocaleString()} over their $${customer.creditLimit.toLocaleString()} credit limit (currently $${Math.round(
              openExposure,
            ).toLocaleString()} in open orders).`,
          };
        }
      }
    }
  }

  const soNumber = await nextSoNumber();
  const associateId = await currentAssociateId();

  await db.$transaction([
    db.salesOrder.create({
      data: {
        soNumber,
        customerName,
        customerId: customerId || null,
        associateId,
        status: 'PLACED',
        soLineItems: {
          create: [
            {
              inventoryItemId: slab.id,
              soldPricePerSf: pricePerSf,
              landedCostAtSale: slab.costLanded ?? 0,
              edgeProfile: edgeProfile || null,
              edgeUpchargePerSf,
              cutoutCount,
              cutoutUpchargeEach,
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

/**
 * Lightweight internal approval gate (the "Deal Desk" pattern — Salesforce CPQ,
 * Zuora, PandaDoc: cross-functional sign-off before commitment, distinct from a
 * customer-facing e-signature). Production cannot advance past QUOTED until this
 * is set (see advanceProductionStageAction in src/server/production/actions.ts).
 */
export async function approveOrderAction(orderId: string): Promise<ActionResult> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated.' };
  requireRole(ctx.role, ['ADMIN', 'SALES']);

  const order = await db.salesOrder.findFirst({ where: { id: orderId, deletedAt: null } });
  if (!order) return { ok: false, error: 'Order not found.' };
  if (order.approvedAt) return { ok: false, error: 'This order is already approved.' };
  if (order.status === 'CANCELLED') return { ok: false, error: 'Cannot approve a cancelled order.' };

  await db.salesOrder.update({
    where: { id: orderId },
    data: { approvedAt: new Date(), approvedByPartyId: ctx.party?.id ?? null },
  });

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

const DepositSchema = z.object({
  amount: z.number().positive('Amount must be greater than zero.'),
  method: z.enum(['Cash', 'Check', 'Card', 'Wire', 'Other']).optional(),
  note: z.string().trim().max(300).optional().or(z.literal('')),
});

/**
 * Record a customer deposit/payment against a Sales Order. Append-only by
 * design (DESIGN.md v2.0 Destructive Action Guardrail) — balanceDue is never
 * stored, only ever derived from this ledger, so there's nothing to desync.
 * Blocks overpayment past the current balance rather than allowing a typo to
 * silently create a negative-AR situation.
 */
export async function recordDepositAction(
  orderId: string,
  input: { amount: number; method?: string; note?: string },
): Promise<ActionResult> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated.' };
  requireRole(ctx.role, ['ADMIN', 'SALES']);

  const parsed = DepositSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid payment.' };
  const d = parsed.data;

  const order = await db.salesOrder.findFirst({
    where: { id: orderId, deletedAt: null },
    include: { soLineItems: { include: { inventoryItem: true } }, soPayments: true },
  });
  if (!order) return { ok: false, error: 'Order not found.' };
  if (order.status === 'CANCELLED') return { ok: false, error: 'Cannot record a payment against a cancelled order.' };

  const totalValue = order.soLineItems.reduce((s, li) => s + li.soldPricePerSf * (li.inventoryItem?.totalSf ?? 0), 0);
  const alreadyPaid = order.soPayments.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.round((totalValue - alreadyPaid) * 100) / 100;
  if (d.amount > remaining + 0.01) {
    return { ok: false, error: `Payment of $${d.amount.toFixed(2)} exceeds the remaining balance of $${remaining.toFixed(2)}.` };
  }

  await db.sOPayment.create({
    data: {
      salesOrderId: orderId,
      amount: d.amount,
      method: d.method ?? null,
      note: d.note || null,
      recordedByUserId: ctx.user.id,
      recordedByRole: ctx.role,
    },
  });

  revalidatePath('/orders');
  return { ok: true };
}
