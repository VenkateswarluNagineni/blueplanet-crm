import React from 'react';

/**
 * Faceted count card — shared by Customer Catalog and Products Master List.
 * Spec: DESIGN.md surfaces (basalt card language).
 */
export function FacetCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bp-card overflow-hidden flex flex-col !rounded-[var(--radius-md)]">
      <div className="px-3 py-2 bg-[var(--color-basalt-700)]/50 border-b border-[var(--color-basalt-500)]">
        <h4 className="text-[11px] font-medium text-[var(--color-sodalite)] uppercase tracking-[0.08em]">
          {title}
        </h4>
      </div>
      <div className="p-1.5 space-y-0.5 max-h-44 overflow-y-auto">{children}</div>
    </div>
  );
}

/** Clickable facet value row (label + count). */
export function FacetRow({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between px-2 py-1 rounded-[var(--radius-sm)] text-[12px] transition-colors ${
        active
          ? 'bg-[rgba(227,193,108,0.14)] text-[var(--color-vein)]'
          : 'text-[var(--color-text-muted)] hover:bg-[var(--color-basalt-700)]'
      }`}
    >
      <span className="truncate mr-2">{label}</span>
      <span
        className={`tabular-nums ${active ? 'text-[var(--color-vein)]' : 'text-[var(--color-text-secondary)]'}`}
      >
        {count}
      </span>
    </button>
  );
}
