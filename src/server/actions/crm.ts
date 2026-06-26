'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { getEffectiveRole, getSessionContext } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';

export type ActionResult = { ok: true } | { ok: false; error: string };

type PartyType = 'SUPPLIER' | 'VENDOR' | 'ASSOCIATE';

async function nextRepNumber(): Promise<string> {
  const latest = await db.party.findFirst({
    where: { type: 'ASSOCIATE', systemId: { startsWith: 'REP-' } },
    orderBy: { systemId: 'desc' },
    select: { systemId: true },
  });
  const seq = latest?.systemId ? parseInt(latest.systemId.replace('REP-', ''), 10) : 1100;
  return `REP-${(Number.isNaN(seq) ? 1100 : seq) + 1}`;
}

const CreateSchema = z.object({
  type: z.enum(['SUPPLIER', 'VENDOR', 'ASSOCIATE']),
  name: z.string().min(1).max(200),
  contactPerson: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  originCountry: z.string().optional(),
  paymentTerms: z.string().optional(),
  incoterms: z.string().optional(),
  currency: z.string().optional(),
  creditLimit: z.number().optional(),
  serviceType: z.string().optional(),
  role: z.string().optional(),
  baseLocation: z.string().optional(),
  commissionRate: z.string().optional(),
});

export async function createPartyAction(input: z.input<typeof CreateSchema>): Promise<ActionResult> {
  const role = await getEffectiveRole();
  requireRole(role, ['ADMIN']);

  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Name is required and fields must be valid.' };
  const d = parsed.data;

  const systemId = d.type === 'ASSOCIATE' ? await nextRepNumber() : undefined;

  await db.party.create({
    data: {
      type: d.type,
      name: d.name,
      systemId,
      contactPerson: d.contactPerson || null,
      email: d.email || null,
      phone: d.phone || null,
      originCountry: d.originCountry || null,
      paymentTerms: d.paymentTerms || null,
      incoterms: d.incoterms || null,
      currency: d.currency || 'USD',
      creditLimit: d.creditLimit ?? 0,
      serviceType: d.serviceType || null,
      role: d.role || null,
      baseLocation: d.baseLocation || null,
      commissionRate: d.commissionRate || null,
    },
  });

  revalidatePath('/crm');
  return { ok: true };
}

const UpdateSchema = z.object({
  contactPerson: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  originCountry: z.string().optional(),
  paymentTerms: z.string().optional(),
  incoterms: z.string().optional(),
  creditLimit: z.number().optional(),
  serviceType: z.string().optional(),
  role: z.string().optional(),
  baseLocation: z.string().optional(),
  commissionRate: z.string().optional(),
  salesTargetAnnual: z.number().optional(),
});

export async function updatePartyAction(
  id: string,
  type: PartyType,
  updates: z.input<typeof UpdateSchema>,
): Promise<ActionResult> {
  const role = await getEffectiveRole();
  requireRole(role, ['ADMIN']);

  const existing = await db.party.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return { ok: false, error: 'Record not found.' };

  const parsed = UpdateSchema.safeParse(updates);
  if (!parsed.success) return { ok: false, error: 'Invalid update.' };
  const u = parsed.data;

  await db.party.update({
    where: { id },
    data: {
      contactPerson: u.contactPerson,
      email: u.email,
      phone: u.phone,
      ...(type === 'SUPPLIER'
        ? { originCountry: u.originCountry, paymentTerms: u.paymentTerms, incoterms: u.incoterms, creditLimit: u.creditLimit }
        : {}),
      ...(type === 'VENDOR' ? { serviceType: u.serviceType } : {}),
      ...(type === 'ASSOCIATE'
        ? { role: u.role, baseLocation: u.baseLocation, commissionRate: u.commissionRate, salesTargetAnnual: u.salesTargetAnnual }
        : {}),
    },
  });

  revalidatePath('/crm');
  return { ok: true };
}

/**
 * Set an associate's annual sales target. An admin may set any associate's target;
 * a sales rep may only set their own (the Party their login is linked to).
 */
export async function setSalesTargetAction(partyId: string, target: number): Promise<ActionResult> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated.' };
  if (!Number.isFinite(target) || target < 0) return { ok: false, error: 'Enter a valid target amount.' };

  const isOwnTarget = ctx.party?.id === partyId && ctx.party?.type === 'ASSOCIATE';
  if (!ctx.isAdmin && !isOwnTarget) {
    return { ok: false, error: 'You can only edit your own target.' };
  }

  const existing = await db.party.findFirst({ where: { id: partyId, type: 'ASSOCIATE', deletedAt: null } });
  if (!existing) return { ok: false, error: 'Associate not found.' };

  await db.party.update({ where: { id: partyId }, data: { salesTargetAnnual: target } });
  revalidatePath('/crm');
  revalidatePath('/pipeline');
  return { ok: true };
}

export async function softDeletePartyAction(id: string): Promise<ActionResult> {
  const role = await getEffectiveRole();
  requireRole(role, ['ADMIN']);

  const existing = await db.party.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return { ok: false, error: 'Record not found.' };

  await db.party.update({ where: { id }, data: { deletedAt: new Date() } });
  revalidatePath('/crm');
  return { ok: true };
}
