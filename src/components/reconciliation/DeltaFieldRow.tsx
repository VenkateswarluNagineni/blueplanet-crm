'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import type { ReconciliationDeltaRow } from '@/server/reconciliation/queries';
import { Button } from '@/components/ui/Button';
import { AffectedSlabPicker, type EligibleSlab } from './AffectedSlabPicker';

const FIELD_LABEL: Record<string, string> = {
  orderedSlabs: 'Ordered slabs',
  unitCost: 'Unit cost ($/sf)',
  oceanCost: 'Ocean freight',
  customsCost: 'Customs',
  inlandCost: 'Inland trucking',
  estimatedDelivery: 'Estimated delivery',
  receiptNumber: 'Receipt #',
  expectedSf: 'Expected sf',
  expectedCost: 'Expected cost',
  costFob: 'FOB cost',
  costApportioned: 'Apportioned freight',
  costLanded: 'Landed cost',
};

const STATUS_TONE: Record<string, string> = {
  PENDING: 'text-[var(--color-vein)]',
  APPROVED: 'text-[var(--color-emerald)]',
  APPLIED: 'text-[var(--color-emerald)]',
  REJECTED: 'text-[var(--color-fog-500)]',
  BLOCKED: 'text-[var(--color-coral)]',
  SUPERSEDED: 'text-[var(--color-fog-500)]',
};

function fmtValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return String(v);
}

export function DeltaFieldRow({
  delta,
  eligibleSlabs,
  soldSlabIds,
  onApprove,
  onReject,
  isPending,
}: {
  delta: ReconciliationDeltaRow;
  eligibleSlabs: EligibleSlab[];
  soldSlabIds: string[];
  onApprove: (deltaId: string, affectedInventoryItemIds?: string[]) => void;
  onReject: (deltaId: string) => void;
  isPending: boolean;
}) {
  const [selectedSlabs, setSelectedSlabs] = useState<string[]>([]);
  const isReviewable = delta.status === 'PENDING';
  const requiredCount = delta.retroactive && delta.field === 'orderedSlabs'
    ? Math.max(0, Number(delta.oldValue) - Number(delta.newValue))
    : undefined;

  return (
    <div className="bp-card p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] text-white font-medium">{FIELD_LABEL[delta.field] ?? delta.field}</p>
          <div className="flex items-center gap-2 mt-1 text-[13px]">
            <span className="bp-mono text-[var(--color-fog-500)] line-through">{fmtValue(delta.oldValue)}</span>
            <span className="text-[var(--color-fog-500)]">→</span>
            <span className="bp-mono text-[var(--color-sodalite)] font-medium">{fmtValue(delta.newValue)}</span>
          </div>
          {delta.sourceExcerpt && (
            <p className="text-[11px] text-[var(--color-text-secondary)] italic mt-1.5 max-w-xl">
              &ldquo;{delta.sourceExcerpt}&rdquo;
            </p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`text-[10px] uppercase tracking-wider font-semibold ${STATUS_TONE[delta.status] ?? ''}`}>
              {delta.status}
            </span>
            {delta.confidence != null && (
              <span className="text-[10px] text-[var(--color-fog-500)]">
                {Math.round(delta.confidence * 100)}% confidence
              </span>
            )}
          </div>
          {delta.status === 'BLOCKED' && delta.blockedReason && (
            <p className="text-[11px] text-[var(--color-coral)] mt-1">{delta.blockedReason}</p>
          )}
        </div>
        {isReviewable && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              disabled={isPending}
              onClick={() => onReject(delta.id)}
              className="flex items-center gap-1 hover:!border-[rgba(239,68,68,0.4)] hover:!text-[var(--color-ruby)]"
            >
              <X size={13} /> Reject
            </Button>
            <button
              disabled={isPending || (delta.retroactive && selectedSlabs.length === 0)}
              onClick={() => onApprove(delta.id, delta.retroactive ? selectedSlabs : undefined)}
              className="flex items-center gap-1 text-[12px] text-[var(--color-basalt-950)] bg-[var(--color-emerald)] hover:opacity-90 px-3 py-1.5 rounded-[var(--radius-md)] font-medium transition-colors disabled:opacity-50"
            >
              <Check size={13} /> Approve
            </button>
          </div>
        )}
      </div>

      {isReviewable && delta.retroactive && (
        <AffectedSlabPicker
          eligibleSlabs={eligibleSlabs}
          soldSlabIds={soldSlabIds}
          selected={selectedSlabs}
          onChange={setSelectedSlabs}
          requiredCount={requiredCount}
        />
      )}
    </div>
  );
}
