'use client';

import { SoldSlabConflictNote } from './SoldSlabConflictNote';

export type EligibleSlab = { id: string; uniqueSlabId: string; status: string };

/**
 * Rendered inline under a DeltaFieldRow when the delta is retroactive (targets an
 * already-received PO). The reviewer must explicitly pick which physical slab(s)
 * are affected — never auto-inferred. Already-sold slabs aren't selectable here;
 * they're excluded from `eligibleSlabs` upstream and called out separately.
 */
export function AffectedSlabPicker({
  eligibleSlabs,
  soldSlabIds,
  selected,
  onChange,
  requiredCount,
}: {
  eligibleSlabs: EligibleSlab[];
  soldSlabIds: string[];
  selected: string[];
  onChange: (ids: string[]) => void;
  /** For a qty-shortfall delta, how many slabs the correction implies removing. */
  requiredCount?: number;
}) {
  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  return (
    <div className="mt-2 bg-[var(--color-basalt-950)] border border-[var(--color-basalt-500)] rounded-[var(--radius-sm)] p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-fog-500)] mb-1.5">
        Affected slabs {requiredCount ? `(select ${requiredCount})` : ''}
      </p>
      {eligibleSlabs.length === 0 ? (
        <p className="text-[12px] text-[var(--color-text-secondary)]">No eligible slabs on this PO.</p>
      ) : (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {eligibleSlabs.map((s) => (
            <label
              key={s.id}
              className="flex items-center gap-2 px-1.5 py-1 rounded text-[12px] text-white hover:bg-[var(--color-basalt-700)] cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.includes(s.id)}
                onChange={() => toggle(s.id)}
                className="accent-[var(--color-vein)]"
              />
              <span className="bp-mono">{s.uniqueSlabId}</span>
              <span className="text-[var(--color-text-secondary)] text-[10px] uppercase">{s.status}</span>
            </label>
          ))}
        </div>
      )}
      <SoldSlabConflictNote slabIds={soldSlabIds} />
    </div>
  );
}
