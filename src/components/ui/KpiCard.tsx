import React from 'react';

/** Award-grade KPI stat card — DESIGN.md §4.4 */
export function KpiCard({
  label,
  value,
  icon: Icon,
  color = '#92b0ce',
  delta,
  interactive = false,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ElementType;
  color?: string;
  delta?: { text: string; positive?: boolean };
  interactive?: boolean;
}) {
  return (
    <div className={interactive ? 'bp-card-interactive p-4 h-full' : 'bp-card p-4 h-full'}>
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[10px] font-semibold text-[var(--color-fog-500)] uppercase tracking-[0.1em]">
          {label}
        </span>
        {Icon && (
          <div
            className="w-7 h-7 rounded-[var(--radius-md)] flex items-center justify-center border border-white/[0.04]"
            style={{ backgroundColor: `${color}14`, color }}
          >
            <Icon size={14} />
          </div>
        )}
      </div>
      <div className="bp-kpi-value text-[20px] leading-none">{value}</div>
      {delta && (
        <div
          className={`mt-2 text-[11px] ${delta.positive ? 'text-[var(--color-emerald)]' : 'text-[var(--color-text-secondary)]'}`}
        >
          {delta.text}
        </div>
      )}
    </div>
  );
}

export const RestrictedValue = (
  <span className="text-[var(--color-text-secondary)] text-[11px] bg-[var(--color-surface)] px-2 py-0.5 rounded uppercase tracking-wider">
    Restricted
  </span>
);
