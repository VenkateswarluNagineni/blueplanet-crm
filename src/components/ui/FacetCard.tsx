import React from 'react';

/**
 * A faceted count card: a titled, scrollable list of clickable value rows used by
 * the Customer Catalog and the Products Master List. Shared so both catalogs render
 * identical facet UI.
 */
export function FacetCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#2b2a2c] border border-[#454446] rounded-lg overflow-hidden flex flex-col">
      <div className="px-3 py-2 bg-[#333234]/40 border-b border-[#454446]"><h4 className="text-[12px] font-medium text-[#92b0ce]">{title}</h4></div>
      <div className="p-1.5 space-y-0.5 max-h-44 overflow-y-auto">{children}</div>
    </div>
  );
}

/**
 * A single clickable facet value row (label + count). Highlights when active.
 */
export function FacetRow({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center justify-between px-2 py-1 rounded text-[12px] transition-colors ${active ? 'bg-[#e3c16c]/15 text-[#e3c16c]' : 'text-[#d9d8d9] hover:bg-[#333234]'}`}>
      <span className="truncate mr-2">{label}</span>
      <span className={`tabular-nums ${active ? 'text-[#e3c16c]' : 'text-[#b8b6b9]'}`}>{count}</span>
    </button>
  );
}
