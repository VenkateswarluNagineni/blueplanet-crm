'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { getEffectiveRole } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { PIPELINE_STAGES } from '@/server/queries/pipeline';

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
