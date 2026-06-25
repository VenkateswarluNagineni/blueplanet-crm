'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { getEffectiveRole } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';

export type ActionResult = { ok: true } | { ok: false; error: string };

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
