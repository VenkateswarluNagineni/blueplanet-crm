import React from 'react';

/** A KPI stat card: label, big value, tinted icon, optional delta line. */
export function KpiCard({
  label,
  value,
  icon: Icon,
  color = '#92b0ce',
  delta,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ElementType;
  color?: string;
  delta?: { text: string; positive?: boolean };
}) {
  return (
    <div className="bg-[#1c1c1c] border border-[#454446] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-medium text-[#b8b6b9] uppercase tracking-wider">{label}</span>
        {Icon && <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${color}1a`, color }}><Icon size={16} /></div>}
      </div>
      <div className="text-[22px] font-semibold text-white leading-none">{value}</div>
      {delta && (
        <div className={`mt-2 text-[11px] ${delta.positive ? 'text-[#10b981]' : 'text-[#b8b6b9]'}`}>{delta.text}</div>
      )}
    </div>
  );
}

/** Cost-gated chip used as a KPI value when the viewer can't see landed cost. */
export const RestrictedValue = (
  <span className="text-[#b8b6b9] text-[11px] bg-[#333234] px-2 py-0.5 rounded uppercase tracking-wider">Restricted</span>
);
