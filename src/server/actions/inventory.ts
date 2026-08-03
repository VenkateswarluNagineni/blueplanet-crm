'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { getEffectiveRole, getSessionContext } from '@/lib/domain/auth';
import { requireRole } from '@/lib/domain/rbac';

export type ActionResult = { ok: true } | { ok: false; error: string };
export type BulkResult = { ok: true; affected: number; skipped: number } | { ok: false; error: string };

// Statuses that may never be operated on by a bulk action.
const LOCKED_STATUSES = ['SOLD', 'WRITTEN_OFF'];
/** Cap bulk selection size (DoS / accidental mass ops). */
const MAX_BULK_IDS = 100;
/** Hold reason max length (XSS-safe plain text storage). */
const MAX_REASON_LEN = 200;

/**
 * A re-measure is not applied directly — it is queued to the EventOutbox as a
 * PENDING approval that an ADMIN resolves on the Approvals screen.
 */
export async function submitMeasurementOverrideAction(
  uniqueSlabId: string,
  lengthInches: number,
  widthInches: number,
): Promise<ActionResult> {
  const role = await getEffectiveRole();
  requireRole(role, ['ADMIN', 'SALES']);

  if (!(lengthInches > 0) || !(widthInches > 0)) {
    return { ok: false, error: 'Dimensions must be positive numbers.' };
  }

  const slab = await db.inventoryItem.findFirst({ where: { uniqueSlabId, deletedAt: null } });
  if (!slab) return { ok: false, error: 'Slab not found.' };

  await db.eventOutbox.create({
    data: {
      eventType: 'MEASUREMENT_OVERRIDE',
      aggregateType: 'InventoryItem',
      aggregateId: uniqueSlabId,
      status: 'PENDING',
      payload: { lengthInches, widthInches, submittedByRole: role },
    },
  });

  revalidatePath('/inventory');
  revalidatePath('/admin/approvals');
  return { ok: true };
}

type BulkRole = 'ADMIN' | 'SALES';

/** Common preamble for bulk ops: auth, role gate, and slab fetch. */
async function loadForBulk(slabIds: string[], roles: BulkRole[] = ['ADMIN']) {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false as const, error: 'Not authenticated.' };
  if (!roles.includes(ctx.role as BulkRole)) {
    return { ok: false as const, error: 'Forbidden: insufficient permissions.' };
  }
  const ids = Array.from(new Set(slabIds)).filter(Boolean);
  if (ids.length === 0) return { ok: false as const, error: 'No slabs selected.' };
  if (ids.length > MAX_BULK_IDS) {
    return { ok: false as const, error: `Select at most ${MAX_BULK_IDS} slabs at a time.` };
  }
  const slabs = await db.inventoryItem.findMany({ where: { id: { in: ids }, deletedAt: null } });
  return { ok: true as const, ctx, slabs };
}

function cleanReason(reason: string): string {
  return reason.trim().replace(/\s+/g, ' ').slice(0, MAX_REASON_LEN);
}

/** Move eligible slabs (not SOLD/WRITTEN_OFF) to another location, with an audit row each. */
export async function transferSlabsAction(slabIds: string[], toLocationId: string, note?: string): Promise<BulkResult> {
  const loaded = await loadForBulk(slabIds);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const { ctx, slabs } = loaded;

  const dest = await db.location.findFirst({ where: { id: toLocationId, deletedAt: null } });
  if (!dest) return { ok: false, error: 'Destination location not found.' };

  const eligible = slabs.filter((s) => !LOCKED_STATUSES.includes(s.status) && s.presentLocationId !== dest.id);
  const ops = eligible.flatMap((s) => [
    db.inventoryItem.update({ where: { id: s.id }, data: { presentLocationId: dest.id } }),
    db.stockMovement.create({ data: {
      inventoryItemId: s.id, type: 'TRANSFER', fromLocationId: s.presentLocationId, toLocationId: dest.id,
      fromStatus: s.status, toStatus: s.status, note: note || null, byUserId: ctx.user.id, byRole: ctx.role,
    } }),
  ]);
  if (ops.length) await db.$transaction(ops);
  revalidatePath('/inventory');
  return { ok: true, affected: eligible.length, skipped: slabs.length - eligible.length };
}

/**
 * Place AVAILABLE slabs ON_HOLD with a reason + audit row.
 * Admin and Sales (reservation ceremony for walk-ins / quotes).
 */
export async function holdSlabsAction(slabIds: string[], reason: string): Promise<BulkResult> {
  const loaded = await loadForBulk(slabIds, ['ADMIN', 'SALES']);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const { ctx, slabs } = loaded;
  const heldFor = cleanReason(reason ?? '');
  if (!heldFor) return { ok: false, error: 'A hold reason is required (customer, quote, or project).' };

  const eligible = slabs.filter((s) => s.status === 'AVAILABLE');
  const ops = eligible.flatMap((s) => [
    db.inventoryItem.update({ where: { id: s.id }, data: { status: 'ON_HOLD', holdReason: heldFor } }),
    db.stockMovement.create({ data: {
      inventoryItemId: s.id, type: 'HOLD', fromStatus: s.status, toStatus: 'ON_HOLD',
      reason: heldFor, byUserId: ctx.user.id, byRole: ctx.role,
    } }),
  ]);
  if (ops.length) await db.$transaction(ops);
  revalidatePath('/inventory');
  revalidatePath('/inventory/overview');
  revalidatePath('/catalog');
  revalidatePath('/');
  return { ok: true, affected: eligible.length, skipped: slabs.length - eligible.length };
}

/**
 * Release ON_HOLD slabs back to AVAILABLE, clearing hold reason + audit.
 * Admin and Sales.
 */
export async function releaseSlabsAction(slabIds: string[]): Promise<BulkResult> {
  const loaded = await loadForBulk(slabIds, ['ADMIN', 'SALES']);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const { ctx, slabs } = loaded;

  const eligible = slabs.filter((s) => s.status === 'ON_HOLD');
  const ops = eligible.flatMap((s) => [
    db.inventoryItem.update({ where: { id: s.id }, data: { status: 'AVAILABLE', holdReason: null } }),
    db.stockMovement.create({ data: {
      inventoryItemId: s.id, type: 'RELEASE', fromStatus: s.status, toStatus: 'AVAILABLE',
      reason: s.holdReason || null, byUserId: ctx.user.id, byRole: ctx.role,
    } }),
  ]);
  if (ops.length) await db.$transaction(ops);
  revalidatePath('/inventory');
  revalidatePath('/inventory/overview');
  revalidatePath('/catalog');
  revalidatePath('/');
  return { ok: true, affected: eligible.length, skipped: slabs.length - eligible.length };
}

/** Write off eligible slabs (not SOLD/WRITTEN_OFF) with a reason, with an audit row each. */
export async function writeOffSlabsAction(slabIds: string[], reason: string): Promise<BulkResult> {
  const loaded = await loadForBulk(slabIds);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const { ctx, slabs } = loaded;
  const why = cleanReason(reason ?? '');
  if (!why) return { ok: false, error: 'A write-off reason is required.' };

  const eligible = slabs.filter((s) => !LOCKED_STATUSES.includes(s.status));
  const ops = eligible.flatMap((s) => [
    db.inventoryItem.update({ where: { id: s.id }, data: { status: 'WRITTEN_OFF', holdReason: null } }),
    db.stockMovement.create({ data: {
      inventoryItemId: s.id, type: 'WRITE_OFF', fromStatus: s.status, toStatus: 'WRITTEN_OFF',
      reason: why, byUserId: ctx.user.id, byRole: ctx.role,
    } }),
  ]);
  if (ops.length) await db.$transaction(ops);
  revalidatePath('/inventory');
  return { ok: true, affected: eligible.length, skipped: slabs.length - eligible.length };
}
