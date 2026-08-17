import 'server-only';
import { db } from '@/lib/db';

export type ReconciliationCaseRow = {
  id: string;
  status: string;
  matchMethod: string | null;
  matchConfidence: number | null;
  createdAt: string;
  inboundMessage: { fromAddress: string; subject: string | null; createdAt: string };
  purchaseOrder: { id: string; poNumber: string; supplierName: string } | null;
  openDeltaCount: number;
};

export type ReconciliationDeltaRow = {
  id: string;
  entityType: string;
  entityId: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  sourceExcerpt: string | null;
  confidence: number | null;
  retroactive: boolean;
  status: string;
  blockedReason: string | null;
};

export type ReconciliationCaseDetail = ReconciliationCaseRow & {
  inboundMessage: ReconciliationCaseRow['inboundMessage'] & { bodyText: string; bodyHtml: string | null };
  deltas: ReconciliationDeltaRow[];
  /** Slabs on the matched PO eligible for the AffectedSlabPicker (not already sold). */
  eligibleSlabs: { id: string; uniqueSlabId: string; status: string }[];
};

/** Count of unresolved (non-terminal) cases, for the nav badge — same shape as the existing `approvals` badge. */
export async function getOpenReconciliationCount(): Promise<number> {
  return db.reconciliationCase.count({ where: { status: { in: ['NEEDS_MATCH', 'IN_REVIEW', 'BLOCKED'] } } });
}

export async function getReconciliationCases(): Promise<ReconciliationCaseRow[]> {
  const cases = await db.reconciliationCase.findMany({
    where: { status: { not: 'DISMISSED' } },
    include: {
      inboundMessage: { select: { fromAddress: true, subject: true, createdAt: true } },
      purchaseOrder: { select: { id: true, poNumber: true, supplier: { select: { name: true } } } },
      deltas: { select: { status: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return cases.map((c) => ({
    id: c.id,
    status: c.status,
    matchMethod: c.matchMethod,
    matchConfidence: c.matchConfidence,
    createdAt: c.createdAt.toISOString(),
    inboundMessage: {
      fromAddress: c.inboundMessage.fromAddress,
      subject: c.inboundMessage.subject,
      createdAt: c.inboundMessage.createdAt.toISOString(),
    },
    purchaseOrder: c.purchaseOrder
      ? { id: c.purchaseOrder.id, poNumber: c.purchaseOrder.poNumber, supplierName: c.purchaseOrder.supplier.name }
      : null,
    openDeltaCount: c.deltas.filter((d) => d.status === 'PENDING' || d.status === 'BLOCKED').length,
  }));
}

export async function getReconciliationCaseDetail(caseId: string): Promise<ReconciliationCaseDetail | null> {
  const c = await db.reconciliationCase.findUnique({
    where: { id: caseId },
    include: {
      inboundMessage: true,
      purchaseOrder: { select: { id: true, poNumber: true, supplier: { select: { name: true } } } },
      deltas: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!c) return null;

  const eligibleSlabs = c.purchaseOrder
    ? await db.inventoryItem.findMany({
        where: { deletedAt: null, poLineItem: { purchaseOrderId: c.purchaseOrder.id }, soLineItem: null },
        select: { id: true, uniqueSlabId: true, status: true },
        orderBy: { uniqueSlabId: 'asc' },
      })
    : [];

  return {
    id: c.id,
    status: c.status,
    matchMethod: c.matchMethod,
    matchConfidence: c.matchConfidence,
    createdAt: c.createdAt.toISOString(),
    inboundMessage: {
      fromAddress: c.inboundMessage.fromAddress,
      subject: c.inboundMessage.subject,
      createdAt: c.inboundMessage.createdAt.toISOString(),
      bodyText: c.inboundMessage.bodyText,
      bodyHtml: c.inboundMessage.bodyHtml,
    },
    purchaseOrder: c.purchaseOrder
      ? { id: c.purchaseOrder.id, poNumber: c.purchaseOrder.poNumber, supplierName: c.purchaseOrder.supplier.name }
      : null,
    openDeltaCount: c.deltas.filter((d) => d.status === 'PENDING' || d.status === 'BLOCKED').length,
    deltas: c.deltas.map((d) => ({
      id: d.id,
      entityType: d.entityType,
      entityId: d.entityId,
      field: d.field,
      oldValue: d.oldValue,
      newValue: d.newValue,
      sourceExcerpt: d.sourceExcerpt,
      confidence: d.confidence,
      retroactive: d.retroactive,
      status: d.status,
      blockedReason: d.blockedReason,
    })),
    eligibleSlabs,
  };
}
