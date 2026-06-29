'use client';

import React, { useState, useMemo } from 'react';
import { Search, LayoutGrid, ArrowRight, History } from 'lucide-react';
import { FacetCard, FacetRow } from '@/components/ui/FacetCard';
import type { MovementLogRow } from '@/server/queries/movements';

const TYPE_TONE: Record<string, string> = {
  TRANSFER: 'text-[#92b0ce] border-[#92b0ce]/30 bg-[#92b0ce]/10',
  HOLD: 'text-[#e3c16c] border-[#e3c16c]/30 bg-[#e3c16c]/10',
  RELEASE: 'text-[#10b981] border-[#10b981]/30 bg-[#10b981]/10',
  WRITE_OFF: 'text-red-400 border-red-500/30 bg-red-500/10',
};

const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

type Facet = { id: string; label: string; valueOf: (m: MovementLogRow) => string };
const FACETS: Facet[] = [
  { id: 'type', label: 'Type', valueOf: (m) => m.type },
  { id: 'location', label: 'Location', valueOf: (m) => m.toLocation ?? m.fromLocation ?? '—' },
  { id: 'by', label: 'Performed By', valueOf: (m) => m.byUser ?? m.byRole ?? '—' },
];

export function MovementsClient({ movements }: { movements: MovementLogRow[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showOverview, setShowOverview] = useState(true);
  const [filters, setFilters] = useState<Record<string, string[]>>({});

  const toggle = (facet: string, value: string) =>
    setFilters((prev) => {
      const cur = prev[facet] ?? [];
      return { ...prev, [facet]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] };
    });
  const filterCount = Object.values(filters).reduce((n, a) => n + a.length, 0);

  const cards = useMemo(() =>
    FACETS.map((f) => {
      const counts = new Map<string, number>();
      for (const m of movements) { const v = f.valueOf(m); counts.set(v, (counts.get(v) ?? 0) + 1); }
      return { id: f.id, label: f.label, entries: [...counts.entries()].sort((a, b) => b[1] - a[1]) };
    }), [movements]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return movements.filter((m) => {
      const matchSearch = !q || [m.slabId, m.productName, m.reason, m.note, m.byUser, m.byRole, m.type]
        .filter(Boolean).join(' ').toLowerCase().includes(q);
      const matchFacets = FACETS.every((f) => {
        const sel = filters[f.id];
        return !sel || sel.length === 0 || sel.includes(f.valueOf(m));
      });
      return matchSearch && matchFacets;
    });
  }, [movements, searchTerm, filters]);

  return (
    <div className="flex flex-col h-full bg-[#2b2a2c] text-[#d9d8d9] overflow-hidden">
      {/* Header */}
      <div className="pt-6 px-6 pb-4 border-b border-[#454446] bg-[#1c1c1c] shrink-0">
        <h1 className="text-[20px] font-medium text-white mb-1">Stock Movements</h1>
        <p className="text-[13px] text-[#b8b6b9]">Audit log of every transfer, hold, release, and write-off across the warehouses.</p>
        <div className="flex items-center gap-3 mt-4">
          <div className="flex items-center bg-[#2b2a2c] border border-[#454446] rounded-md px-3 py-1.5 focus-within:border-[#92b0ce] transition-colors w-80">
            <Search size={14} className="text-[#b8b6b9] mr-2 shrink-0" />
            <input type="text" placeholder="Search slab, product, reason, user…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-transparent border-none outline-none text-[13px] text-white w-full placeholder-[#b8b6b9]" />
          </div>
          <button onClick={() => setShowOverview(!showOverview)} className={`flex items-center gap-2 px-2 py-1.5 rounded transition-colors text-[13px] ${showOverview ? 'bg-[#333234] text-white' : 'hover:bg-[#333234] text-[#b8b6b9]'}`}>
            <LayoutGrid size={14} /> Overview
          </button>
          {filterCount > 0 && <button onClick={() => setFilters({})} className="text-[12px] text-[#92b0ce] hover:underline">Clear filters ({filterCount})</button>}
          <span className="ml-auto text-[13px] text-[#b8b6b9]">Showing <strong className="text-white">{filtered.length}</strong> of {movements.length}</span>
        </div>
      </div>

      {/* Overview cards */}
      {showOverview && movements.length > 0 && (
        <div className="px-6 py-4 bg-[#1c1c1c] border-b border-[#454446] shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {cards.map((f) => (
              <FacetCard key={f.id} title={f.label}>
                {f.entries.map(([val, n]) => <FacetRow key={val} label={val.replace('_', '-')} count={n} active={(filters[f.id] ?? []).includes(val)} onClick={() => toggle(f.id, val)} />)}
              </FacetCard>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {movements.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[#b8b6b9] gap-2">
            <History size={28} className="text-[#454446]" />
            <p className="text-[13px]">No stock movements recorded yet.</p>
            <p className="text-[12px] text-[#7d7c7f]">Transfers, holds, and write-offs from the Inventory page will appear here.</p>
          </div>
        ) : (
          <table className="w-full text-left text-[13px] text-[#d9d8d9] whitespace-nowrap border-collapse min-w-max">
            <thead className="sticky top-0 bg-[#2b2a2c] z-10 shadow-[0_1px_0_#454446]">
              <tr>
                <Th>Date</Th><Th>Type</Th><Th>Slab</Th><Th>Product</Th><Th>Change</Th><Th>Reason / Note</Th><Th>By</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#454446]">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-[#b8b6b9]">No movements match your filters.</td></tr>
              ) : filtered.map((m) => (
                <tr key={m.id} className="hover:bg-[#333234] transition-colors">
                  <td className="px-4 py-3 text-[#b8b6b9]">{fmt(m.createdAt)}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${TYPE_TONE[m.type] ?? 'text-[#b8b6b9] border-[#454446]'}`}>{m.type.replace('_', '-')}</span></td>
                  <td className="px-4 py-3 font-mono text-white">{m.slabId ?? '—'}</td>
                  <td className="px-4 py-3">{m.productName ?? '—'}</td>
                  <td className="px-4 py-3 text-[#d9d8d9]">
                    {m.type === 'TRANSFER'
                      ? <span className="flex items-center gap-1.5">{m.fromLocation ?? '—'} <ArrowRight size={12} className="text-[#7d7c7f]" /> {m.toLocation ?? '—'}</span>
                      : <span className="flex items-center gap-1.5">{m.fromStatus ?? '—'} <ArrowRight size={12} className="text-[#7d7c7f]" /> {m.toStatus ?? '—'}</span>}
                  </td>
                  <td className="px-4 py-3 text-[#b8b6b9] max-w-[280px] truncate" title={m.reason ?? m.note ?? ''}>{m.reason ?? m.note ?? '—'}</td>
                  <td className="px-4 py-3 text-[#b8b6b9]">{m.byUser ?? (m.byRole ? `(${m.byRole})` : '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 font-medium border-b border-[#454446]">{children}</th>;
}
