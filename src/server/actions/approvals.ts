'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { getEffectiveRole } from '@/lib/domain/auth';
import { requireRole } from '@/lib/domain/rbac';

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function approveApprovalAction(eventId: string): Promise<ActionResult> {
  const role = await getEffectiveRole();
  requireRole(role, ['ADMIN']);

  const event = await db.eventOutbox.findFirst({ where: { id: eventId, status: 'PENDING' } });
  if (!event) return { ok: false, error: 'Approval not found or already processed.' };

  const payload = (event.payload ?? {}) as { lengthInches?: number; widthInches?: number };
  const slab = await db.inventoryItem.findFirst({ where: { uniqueSlabId: event.aggregateId, deletedAt: null } });
  if (!slab) return { ok: false, error: 'Referenced slab no longer exists.' };

  const lengthInches = payload.lengthInches ?? slab.lengthInches;
  const widthInches = payload.widthInches ?? slab.widthInches;
  const totalSf = Math.round(((lengthInches * widthInches) / 144) * 10) / 10;

  await db.$transaction([
    db.inventoryItem.update({ where: { id: slab.id }, data: { lengthInches, widthInches, totalSf } }),
    db.eventOutbox.update({ where: { id: event.id }, data: { status: 'COMPLETED', processedAt: new Date() } }),
  ]);

  revalidatePath('/admin/approvals');
  revalidatePath('/inventory');
  revalidatePath('/');
  return { ok: true };
}

export async function rejectApprovalAction(eventId: string): Promise<ActionResult> {
  const role = await getEffectiveRole();
  requireRole(role, ['ADMIN']);

  const event = await db.eventOutbox.findFirst({ where: { id: eventId, status: 'PENDING' } });
  if (!event) return { ok: false, error: 'Approval not found or already processed.' };

  await db.eventOutbox.update({ where: { id: event.id }, data: { status: 'FAILED', processedAt: new Date() } });
  revalidatePath('/admin/approvals');
  revalidatePath('/');
  return { ok: true };
}
