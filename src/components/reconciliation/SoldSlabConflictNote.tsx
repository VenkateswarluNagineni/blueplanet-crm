import { AlertTriangle } from 'lucide-react';

/**
 * Read-only callout for deltas that touch slabs already sold. SOLineItem.landedCostAtSale
 * is an intentionally immutable historical snapshot — this is never a UI mutation, only a
 * pointer to a manual finance memo.
 */
export function SoldSlabConflictNote({ slabIds }: { slabIds: string[] }) {
  if (slabIds.length === 0) return null;
  return (
    <div className="flex items-start gap-2 bg-[rgba(232,149,107,0.08)] border border-[rgba(232,149,107,0.25)] rounded-[var(--radius-sm)] px-3 py-2 mt-2">
      <AlertTriangle size={14} className="text-[var(--color-coral)] shrink-0 mt-0.5" />
      <p className="text-[12px] text-[var(--color-coral)] leading-relaxed">
        Already sold — <span className="bp-mono">{slabIds.join(', ')}</span>. Landed cost is an
        immutable historical snapshot at time of sale; this correction can&apos;t be auto-applied
        to sold slabs. Handle via a manual finance memo instead.
      </p>
    </div>
  );
}
