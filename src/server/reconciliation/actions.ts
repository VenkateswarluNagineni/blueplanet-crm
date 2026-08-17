'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { getSessionContext } from '@/lib/domain/auth';
import { requireRole } from '@/lib/domain/rbac';

export type ActionResult = { ok: true } | { ok: false; error: string };

const round2 = (v: number) => Math.round(v * 100) / 100;

const PO_NUMERIC_FIELDS = ['orderedSlabs', 'unitCost', 'oceanCost', 'customsCost', 'inlandCost'] as const;
type PoNumericField = (typeof PO_NUMERIC_FIELDS)[number];
const PO_STRING_FIELDS = ['receiptNumber'] as const;
type PoStringField = (typeof PO_STRING_FIELDS)[number];
const LINE_ITEM_NUMERIC_FIELDS = ['expectedSf', 'expectedCost'] as const;
type LineItemNumericField = (typeof LINE_ITEM_NUMERIC_FIELDS)[number];
const INVENTORY_COST_FIELDS = ['costFob', 'costApportioned', 'costLanded'] as const;
type InventoryCostField = (typeof INVENTORY_COST_FIELDS)[number];

/** Loose equality for a live DB value vs. a JSON-snapshotted delta.oldValue — numbers compare with float tolerance. */
function valuesMatch(current: unknown, snapshot: unknown): boolean {
  if (typeof current === 'number' && typeof snapshot === 'number') {
    return Math.abs(current - snapshot) < 0.005;
  }
  if (current instanceof Date) {
    return current.toISOString() === snapshot;
  }
  return current === snapshot;
}

async function blockDrift(deltaId: string, why: string): Promise<ActionResult> {
  await db.reconciliationDelta.update({
    where: { id: deltaId },
    data: { status: 'BLOCKED', blockedReason: why },
  });
  return { ok: false, error: why };
}

/**
 * Approve one field-level reconciliation delta. Every approve is applied and
 * reviewed independently — "approve qty, reject price" is just two separate
 * calls, never batch/all-or-nothing. Re-validates the live entity against the
 * delta's extraction-time snapshot before writing, so a drifted PO (edited by
 * someone else, or by an earlier delta in the same case) blocks instead of
 * silently overwriting.
 */
export async function approveDeltaAction(
  deltaId: string,
  opts?: { affectedInventoryItemIds?: string[] },
): Promise<ActionResult> {
  const session = await getSessionContext();
  requireRole(session?.role ?? null, ['ADMIN']);
  const userId = session!.user.id;

  const delta = await db.reconciliationDelta.findFirst({ where: { id: deltaId, status: 'PENDING' } });
  if (!delta) return { ok: false, error: 'Delta not found, already reviewed, or blocked.' };

  const po = await db.purchaseOrder.findFirst({ where: { id: delta.purchaseOrderId, deletedAt: null } });
  if (!po) return { ok: false, error: 'Referenced purchase order no longer exists.' };

  if (delta.entityType === 'PurchaseOrder') {
    const field = delta.field;

    if ((PO_NUMERIC_FIELDS as readonly string[]).includes(field)) {
      const f = field as PoNumericField;
      if (!valuesMatch(po[f], delta.oldValue)) {
        return blockDrift(delta.id, 'The purchase order changed since this delta was extracted — re-review needed.');
      }
      if (typeof delta.newValue !== 'number') return { ok: false, error: 'Delta value is not numeric.' };

      // A quantity correction on an already-received PO must go through the
      // retroactive/affected-slab path (below) — the header count is historical
      // once slabs are materialized and can't be silently overwritten.
      if (f === 'orderedSlabs' && po.logisticsStatus === 'RECEIVED') {
        return { ok: false, error: 'This PO is already received — resubmit as a retroactive, slab-scoped delta.' };
      }

      await db.$transaction([
        db.purchaseOrder.update({ where: { id: po.id }, data: { [f]: delta.newValue } }),
        db.reconciliationDelta.update({
          where: { id: delta.id },
          data: { status: 'APPLIED', appliedAt: new Date(), reviewedByUserId: userId, reviewedAt: new Date() },
        }),
      ]);
      revalidatePath('/purchases');
      revalidatePath('/purchases/reconciliation');
      revalidatePath('/analytics');
      return { ok: true };
    }

    if ((PO_STRING_FIELDS as readonly string[]).includes(field)) {
      const f = field as PoStringField;
      if (!valuesMatch(po[f], delta.oldValue)) {
        return blockDrift(delta.id, 'The purchase order changed since this delta was extracted — re-review needed.');
      }
      if (typeof delta.newValue !== 'string') return { ok: false, error: 'Delta value is not a string.' };
      await db.$transaction([
        db.purchaseOrder.update({ where: { id: po.id }, data: { [f]: delta.newValue } }),
        db.reconciliationDelta.update({
          where: { id: delta.id },
          data: { status: 'APPLIED', appliedAt: new Date(), reviewedByUserId: userId, reviewedAt: new Date() },
        }),
      ]);
      revalidatePath('/purchases');
      revalidatePath('/purchases/reconciliation');
      return { ok: true };
    }

    if (field === 'estimatedDelivery') {
      const currentIso = po.estimatedDelivery ? po.estimatedDelivery.toISOString() : null;
      if (currentIso !== delta.oldValue) {
        return blockDrift(delta.id, 'The purchase order changed since this delta was extracted — re-review needed.');
      }
      if (typeof delta.newValue !== 'string') return { ok: false, error: 'Delta value is not a date string.' };
      await db.$transaction([
        db.purchaseOrder.update({ where: { id: po.id }, data: { estimatedDelivery: new Date(delta.newValue) } }),
        db.reconciliationDelta.update({
          where: { id: delta.id },
          data: { status: 'APPLIED', appliedAt: new Date(), reviewedByUserId: userId, reviewedAt: new Date() },
        }),
      ]);
      revalidatePath('/purchases');
      revalidatePath('/purchases/reconciliation');
      return { ok: true };
    }

    return { ok: false, error: `Field "${field}" is not on the reconciliation allow-list for PurchaseOrder.` };
  }

  if (delta.entityType === 'POLineItem') {
    if (!(LINE_ITEM_NUMERIC_FIELDS as readonly string[]).includes(delta.field)) {
      return { ok: false, error: `Field "${delta.field}" is not on the reconciliation allow-list for POLineItem.` };
    }
    const f = delta.field as LineItemNumericField;
    const line = await db.pOLineItem.findFirst({ where: { id: delta.entityId, purchaseOrderId: po.id } });
    if (!line) return { ok: false, error: 'Referenced line item no longer exists on this PO.' };
    if (!valuesMatch(line[f], delta.oldValue)) {
      return blockDrift(delta.id, 'The line item changed since this delta was extracted — re-review needed.');
    }
    if (typeof delta.newValue !== 'number') return { ok: false, error: 'Delta value is not numeric.' };

    await db.$transaction([
      db.pOLineItem.update({ where: { id: line.id }, data: { [f]: delta.newValue } }),
      db.reconciliationDelta.update({
        where: { id: delta.id },
        data: { status: 'APPLIED', appliedAt: new Date(), reviewedByUserId: userId, reviewedAt: new Date() },
      }),
    ]);
    revalidatePath('/purchases');
    revalidatePath('/purchases/reconciliation');
    return { ok: true };
  }

  if (delta.entityType === 'InventoryItem') {
    return applyInventoryItemDelta(delta.id, po.id, userId, opts?.affectedInventoryItemIds ?? []);
  }

  return { ok: false, error: `Unsupported delta entity type: ${delta.entityType}` };
}

/**
 * Retroactive InventoryItem-scoped delta — a qty shortfall or cost correction
 * on a PO that has already been received (slabs already materialized). The
 * reviewer must explicitly pick which physical slab(s) are affected; nothing
 * is ever auto-inferred. Any already-SOLD slab is excluded — its landed cost
 * is an immutable historical snapshot (SOLineItem.landedCostAtSale) — and
 * surfaced instead as a "finance memo required" case, never silently rewritten.
 */
async function applyInventoryItemDelta(
  deltaId: string,
  purchaseOrderId: string,
  userId: string,
  affectedInventoryItemIds: string[],
): Promise<ActionResult> {
  const delta = await db.reconciliationDelta.findUnique({ where: { id: deltaId } });
  if (!delta) return { ok: false, error: 'Delta not found.' };

  if (affectedInventoryItemIds.length === 0) {
    return { ok: false, error: 'Select at least one affected slab before approving a retroactive correction.' };
  }

  const candidates = await db.inventoryItem.findMany({
    where: {
      id: { in: affectedInventoryItemIds },
      deletedAt: null,
      poLineItem: { purchaseOrderId },
    },
    include: { soLineItem: true },
  });

  const invalidIds = affectedInventoryItemIds.filter((id) => !candidates.some((c) => c.id === id));
  if (invalidIds.length > 0) {
    return { ok: false, error: 'One or more selected slabs do not belong to this purchase order.' };
  }
  const soldIds = candidates.filter((c) => c.soLineItem).map((c) => c.uniqueSlabId);
  if (soldIds.length > 0) {
    return {
      ok: false,
      error: `Cannot apply — ${soldIds.join(', ')} already sold. Landed cost is an immutable historical snapshot; handle via a manual finance memo instead.`,
    };
  }

  const isQtyShortfall = delta.field === 'orderedSlabs';

  await db.$transaction(async (tx) => {
    if (isQtyShortfall) {
      // The slab doesn't actually exist — write it off, mirroring the
      // existing WRITE_OFF movement convention used elsewhere in Inventory.
      for (const item of candidates) {
        await tx.inventoryItem.update({ where: { id: item.id }, data: { status: 'WRITTEN_OFF' } });
        await tx.stockMovement.create({
          data: {
            inventoryItemId: item.id,
            type: 'WRITE_OFF',
            fromStatus: item.status,
            toStatus: 'WRITTEN_OFF',
            reason: 'Reconciliation: supplier-corrected quantity',
            note: delta.sourceExcerpt,
            byUserId: userId,
            byRole: 'ADMIN',
            reconciliationDeltaId: delta.id,
          },
        });
      }
    } else {
      // Cost correction on slabs that still exist — recompute using the same
      // round2 apportionment convention as the receiving flow.
      const newValue = typeof delta.newValue === 'number' ? delta.newValue : null;
      if (newValue !== null) {
        for (const item of candidates) {
          const field = delta.field as InventoryCostField;
          const updated: Record<string, number> = { [field]: round2(newValue) };
          if (field === 'costFob' || field === 'costApportioned') {
            const fob = field === 'costFob' ? newValue : (item.costFob ?? 0);
            const apportioned = field === 'costApportioned' ? newValue : (item.costApportioned ?? 0);
            updated.costLanded = round2(fob + apportioned);
          }
          await tx.inventoryItem.update({ where: { id: item.id }, data: updated });
          await tx.stockMovement.create({
            data: {
              inventoryItemId: item.id,
              type: 'RECONCILIATION_ADJUSTMENT',
              fromStatus: item.status,
              toStatus: item.status,
              reason: `Reconciliation: ${field} corrected`,
              note: delta.sourceExcerpt,
              byUserId: userId,
              byRole: 'ADMIN',
              reconciliationDeltaId: delta.id,
            },
          });
        }
      }
    }

    await tx.reconciliationDelta.update({
      where: { id: delta.id },
      data: {
        status: 'APPLIED',
        appliedAt: new Date(),
        reviewedByUserId: userId,
        reviewedAt: new Date(),
        affectedInventoryItemIds,
      },
    });
  });

  revalidatePath('/purchases');
  revalidatePath('/purchases/reconciliation');
  revalidatePath('/inventory');
  revalidatePath('/analytics');
  return { ok: true };
}

export async function rejectDeltaAction(deltaId: string, reason?: string): Promise<ActionResult> {
  const session = await getSessionContext();
  requireRole(session?.role ?? null, ['ADMIN']);

  const delta = await db.reconciliationDelta.findFirst({ where: { id: deltaId, status: 'PENDING' } });
  if (!delta) return { ok: false, error: 'Delta not found or already reviewed.' };

  await db.reconciliationDelta.update({
    where: { id: delta.id },
    data: {
      status: 'REJECTED',
      blockedReason: reason ?? null,
      reviewedByUserId: session!.user.id,
      reviewedAt: new Date(),
    },
  });
  revalidatePath('/purchases/reconciliation');
  return { ok: true };
}

/**
 * Manually links an unmatched (NEEDS_MATCH) case to a PO. A case only reaches
 * NEEDS_MATCH when deterministic matching (PO# in subject/body, supplier
 * email) failed at ingestion — no deltas exist yet at that point, since
 * extraction needs a live PO snapshot as context to propose meaningful
 * deltas. Linking here unblocks the case for a (re-)extraction pass; it does
 * not itself create deltas.
 */
export async function linkCaseToPoAction(caseId: string, purchaseOrderId: string): Promise<ActionResult> {
  const session = await getSessionContext();
  requireRole(session?.role ?? null, ['ADMIN']);

  const kase = await db.reconciliationCase.findFirst({ where: { id: caseId } });
  if (!kase) return { ok: false, error: 'Case not found.' };
  const po = await db.purchaseOrder.findFirst({ where: { id: purchaseOrderId, deletedAt: null } });
  if (!po) return { ok: false, error: 'Purchase order not found.' };

  await db.reconciliationCase.update({
    where: { id: caseId },
    data: { purchaseOrderId, matchMethod: 'MANUAL', matchConfidence: 1, status: 'IN_REVIEW' },
  });
  revalidatePath('/purchases/reconciliation');
  return { ok: true };
}

export async function dismissCaseAction(caseId: string): Promise<ActionResult> {
  const session = await getSessionContext();
  requireRole(session?.role ?? null, ['ADMIN']);

  const kase = await db.reconciliationCase.findFirst({ where: { id: caseId } });
  if (!kase) return { ok: false, error: 'Case not found.' };

  await db.reconciliationCase.update({ where: { id: caseId }, data: { status: 'DISMISSED' } });
  revalidatePath('/purchases/reconciliation');
  return { ok: true };
}
