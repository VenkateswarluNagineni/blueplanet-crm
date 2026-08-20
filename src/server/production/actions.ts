'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { getEffectiveRole } from '@/lib/domain/auth';
import { requireRole } from '@/lib/domain/rbac';
import { PRODUCTION_STAGES } from '@/lib/domain/reference';

export type ActionResult = { ok: true } | { ok: false; error: string };

type ProductionStage = (typeof PRODUCTION_STAGES)[number];

const NEXT_STAGE: Record<ProductionStage, ProductionStage | null> = {
  QUOTED: 'TEMPLATED',
  TEMPLATED: 'FABRICATED',
  FABRICATED: 'INSTALLED',
  INSTALLED: null,
};

const MILESTONE_FIELD: Partial<Record<ProductionStage, 'templatedAt' | 'fabricatedAt' | 'installedAt'>> = {
  TEMPLATED: 'templatedAt',
  FABRICATED: 'fabricatedAt',
  INSTALLED: 'installedAt',
};

/**
 * Advance a sales order to the next production stage. DESIGN.md v2.0
 * Destructive Action Guardrail: only sets the new stage + its own milestone
 * timestamp, never touches unrelated fields (mirrors advancePOAction).
 */
export async function advanceProductionStageAction(
  orderId: string,
  installSignatureDataUri?: string,
): Promise<ActionResult> {
  const role = await getEffectiveRole();
  requireRole(role, ['ADMIN', 'SALES']);

  const order = await db.salesOrder.findFirst({ where: { id: orderId, deletedAt: null } });
  if (!order) return { ok: false, error: 'Order not found.' };
  if (order.status === 'CANCELLED') return { ok: false, error: 'Cannot advance a cancelled order.' };

  const current = order.productionStage as ProductionStage;
  const next = NEXT_STAGE[current];
  if (!next) return { ok: false, error: 'This order has already been installed.' };
  if (current === 'QUOTED' && !order.approvedAt) {
    return { ok: false, error: 'Approve this order before starting production.' };
  }

  const milestoneField = MILESTONE_FIELD[next];

  await db.salesOrder.update({
    where: { id: orderId },
    data: {
      productionStage: next,
      ...(milestoneField ? { [milestoneField]: new Date() } : {}),
      ...(next === 'INSTALLED' && installSignatureDataUri ? { installSignatureDataUri } : {}),
    },
  });

  revalidatePath('/orders');
  return { ok: true };
}

/** Set or clear the free-text blocker note on an order (e.g. "Waiting on cabinets"). */
export async function setProductionBlockerAction(orderId: string, note: string): Promise<ActionResult> {
  const role = await getEffectiveRole();
  requireRole(role, ['ADMIN', 'SALES']);

  const trimmed = note.trim();
  if (trimmed.length > 200) return { ok: false, error: 'Blocker note must be 200 characters or fewer.' };

  const order = await db.salesOrder.findFirst({ where: { id: orderId, deletedAt: null } });
  if (!order) return { ok: false, error: 'Order not found.' };

  await db.salesOrder.update({
    where: { id: orderId },
    data: { blockerNote: trimmed || null },
  });

  revalidatePath('/orders');
  return { ok: true };
}

/** Assign or reassign the installer (an ASSOCIATE-type Party) for an order. */
export async function assignInstallerAction(orderId: string, installerId: string | null): Promise<ActionResult> {
  const role = await getEffectiveRole();
  requireRole(role, ['ADMIN', 'SALES']);

  const order = await db.salesOrder.findFirst({ where: { id: orderId, deletedAt: null } });
  if (!order) return { ok: false, error: 'Order not found.' };

  if (installerId) {
    const installer = await db.party.findFirst({ where: { id: installerId, type: 'ASSOCIATE', deletedAt: null } });
    if (!installer) return { ok: false, error: 'Installer not found.' };
  }

  await db.salesOrder.update({
    where: { id: orderId },
    data: { installerId },
  });

  revalidatePath('/orders');
  return { ok: true };
}
