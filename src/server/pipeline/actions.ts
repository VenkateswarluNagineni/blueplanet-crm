'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { getEffectiveRole } from '@/lib/domain/auth';
import { requireRole } from '@/lib/domain/rbac';
import { PIPELINE_STAGES } from '@/server/pipeline/queries';

export type ActionResult = { ok: true } | { ok: false; error: string };

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  leadName: z.string().optional(),
  amount: z.number().nonnegative(),
  probability: z.number().int().min(0).max(100),
  associateId: z.string().optional(),
  expectedClose: z.string().optional(),
});

export async function createOpportunityAction(input: z.input<typeof CreateSchema>): Promise<ActionResult> {
  const role = await getEffectiveRole();
  requireRole(role, ['ADMIN', 'SALES']);

  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Please provide a name, amount, and probability.' };
  const d = parsed.data;

  await db.opportunity.create({
    data: {
      name: d.name,
      leadName: d.leadName || null,
      amount: d.amount,
      probability: d.probability,
      status: 'LEAD',
      source: 'MANUAL',
      associateId: d.associateId || null,
      expectedCloseDate: d.expectedClose ? new Date(d.expectedClose) : null,
    },
  });

  revalidatePath('/pipeline');
  revalidatePath('/');
  return { ok: true };
}

async function nextSoNumber(): Promise<string> {
  const latest = await db.salesOrder.findFirst({
    where: { soNumber: { startsWith: 'SO-' } },
    orderBy: { soNumber: 'desc' },
    select: { soNumber: true },
  });
  const current = latest ? parseInt(latest.soNumber.replace('SO-', ''), 10) : 1000;
  return `SO-${(Number.isNaN(current) ? 1000 : current) + 1}`;
}

const ConvertSchema = z.object({
  opportunityId: z.string().min(1),
  slabId: z.string().min(1),
  pricePerSf: z.number().positive(),
});

/**
 * Route a won deal into a real Sales Order: creates the order against an available
 * slab, attributed to the opportunity's associate and customer, and holds the slab.
 * This closes the pipeline → orders loop so the sale shows up for the rep.
 */
export async function convertOpportunityToOrderAction(
  input: z.input<typeof ConvertSchema>,
): Promise<ActionResult & { soNumber?: string }> {
  const role = await getEffectiveRole();
  requireRole(role, ['ADMIN', 'SALES']);

  const parsed = ConvertSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Choose a slab and a valid price.' };
  const { opportunityId, slabId, pricePerSf } = parsed.data;

  const opp = await db.opportunity.findFirst({
    where: { id: opportunityId, deletedAt: null },
    include: {
      customer: {
        select: { name: true, creditLimit: true, creditLockExempt: true, salesLockNote: true },
      },
    },
  });
  if (!opp) return { ok: false, error: 'Opportunity not found.' };
  if (opp.status !== 'CLOSED_WON') return { ok: false, error: 'Only won deals can be converted to an order.' };

  const slab = await db.inventoryItem.findFirst({
    where: { id: slabId, deletedAt: null },
    include: { product: true },
  });
  if (!slab) return { ok: false, error: 'Slab not found.' };
  if (slab.status !== 'AVAILABLE') return { ok: false, error: 'Slab is no longer available.' };

  const floor = slab.product.minPricePerSf ?? 0;
  if (pricePerSf < floor) {
    return { ok: false, error: `Price cannot be below the authorized minimum of $${floor}/sqft.` };
  }

  const customer = opp.customer;
  if (customer && !customer.creditLockExempt) {
    if (customer.salesLockNote) {
      return { ok: false, error: customer.salesLockNote };
    }
    if (customer.creditLimit > 0) {
      const openOrders = await db.salesOrder.findMany({
        where: { customerId: opp.customerId, status: 'PLACED', deletedAt: null },
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

  const soNumber = await nextSoNumber();
  const customerLabel = opp.customer?.name ?? opp.leadName ?? opp.name;

  await db.$transaction([
    db.salesOrder.create({
      data: {
        soNumber,
        customerName: customerLabel,
        customerId: opp.customerId,
        associateId: opp.associateId,
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

  revalidatePath('/pipeline');
  revalidatePath('/orders');
  revalidatePath('/catalog');
  revalidatePath('/crm');
  return { ok: true, soNumber };
}

export async function setOpportunityStatusAction(id: string, status: string): Promise<ActionResult> {
  const role = await getEffectiveRole();
  requireRole(role, ['ADMIN', 'SALES']);
  if (!PIPELINE_STAGES.includes(status as (typeof PIPELINE_STAGES)[number])) {
    return { ok: false, error: 'Invalid stage.' };
  }

  const opp = await db.opportunity.findFirst({ where: { id, deletedAt: null } });
  if (!opp) return { ok: false, error: 'Opportunity not found.' };

  await db.opportunity.update({ where: { id }, data: { status } });
  revalidatePath('/pipeline');
  revalidatePath('/');
  return { ok: true };
}
