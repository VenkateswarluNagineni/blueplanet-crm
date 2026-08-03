'use client';

import React, { useState, useMemo } from 'react';
import { Search, LayoutGrid, ArrowRight, History } from 'lucide-react';
import { FacetCard, FacetRow } from '@/components/ui/FacetCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import type { MovementLogRow } from '@/server/queries/movements';

const TYPE_TONE: Record<string, string> = {
  TRANSFER: 'text-[var(--color-sodalite)] border-[rgba(146,176,206,0.30)] bg-[rgba(146,176,206,0.10)]',
  HOLD: 'text-[var(--color-vein)] border-[rgba(227,193,108,0.30)] bg-[var(--color-vein)]/10',
  RELEASE: 'text-[var(--color-emerald)] border-[rgba(16,185,129,0.30)] bg-[var(--color-emerald)]/10',
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
    <PageShell
      flush
      header={
        <PageHeader
          breadcrumbs={[
            { label: 'Supply', href: '/logistics' },
            { label: 'Movements' },
          ]}
          title="Movements"
          subtitle="Audit log of every transfer, hold, release, and write-off."
          meta={[
            { label: `${movements.length} events`, tone: 'neutral' },
            { label: `${filtered.length} shown`, tone: 'blue' },
          ]}
        >
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center bg-[var(--color-basalt-800)] border border-[var(--color-basalt-500)] rounded-md px-3 py-1.5 focus-within:border-[var(--color-sodalite)] transition-colors w-80">
              <Search size={14} className="text-[var(--color-text-secondary)] mr-2 shrink-0" />
              <input type="text" placeholder="Search slab, product, reason, user…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-transparent border-none outline-none text-[13px] text-white w-full placeholder-[var(--color-fog-500)]" />
            </div>
            <button onClick={() => setShowOverview(!showOverview)} className={`flex items-center gap-2 px-2 py-1.5 rounded transition-colors text-[13px] ${showOverview ? 'bg-[var(--color-basalt-700)] text-white' : 'hover:bg-[var(--color-basalt-700)] text-[var(--color-text-secondary)]'}`}>
              <LayoutGrid size={14} /> Overview
            </button>
            {filterCount > 0 && <button onClick={() => setFilters({})} className="text-[12px] text-[var(--color-sodalite)] hover:underline">Clear filters ({filterCount})</button>}
          </div>
        </PageHeader>
      }
    >

      {/* Overview cards */}
      {showOverview && movements.length > 0 && (
        <div className="px-6 py-4 bg-[var(--color-basalt-900)] border-b border-[var(--color-basalt-500)] shrink-0">
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
      <div className="flex-1 overflow-auto p-4">
        {movements.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[var(--color-text-secondary)] gap-2">
            <History size={28} className="text-[var(--color-basalt-500)]" />
            <p className="text-[13px]">No stock movements recorded yet.</p>
            <p className="text-[12px] text-[var(--color-fog-500)]">Transfers, holds, and write-offs from the Inventory page will appear here.</p>
          </div>
        ) : (
          <div className="bp-table-shell overflow-x-auto">
          <table className="bp-table min-w-max whitespace-nowrap">
            <thead>
              <tr>
                <Th>Date</Th><Th>Type</Th><Th>Slab</Th><Th>Product</Th><Th>Change</Th><Th>Reason / Note</Th><Th>By</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="!py-12 text-center text-[var(--color-text-secondary)]">No movements match your filters.</td></tr>
              ) : filtered.map((m) => (
                <tr key={m.id}>
                  <td className="text-[var(--color-text-secondary)]">{fmt(m.createdAt)}</td>
                  <td><span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${TYPE_TONE[m.type] ?? 'text-[var(--color-text-secondary)] border-[var(--color-basalt-500)]'}`}>{m.type.replace('_', '-')}</span></td>
                  <td className="bp-id">{m.slabId ?? '—'}</td>
                  <td>{m.productName ?? '—'}</td>
                  <td className="text-[var(--color-text-muted)]">
                    {m.type === 'TRANSFER'
                      ? <span className="flex items-center gap-1.5">{m.fromLocation ?? '—'} <ArrowRight size={12} className="text-[var(--color-fog-500)]" /> {m.toLocation ?? '—'}</span>
                      : <span className="flex items-center gap-1.5">{m.fromStatus ?? '—'} <ArrowRight size={12} className="text-[var(--color-fog-500)]" /> {m.toStatus ?? '—'}</span>}
                  </td>
                  <td className="text-[var(--color-text-secondary)] max-w-[280px] truncate" title={m.reason ?? m.note ?? ''}>{m.reason ?? m.note ?? '—'}</td>
                  <td className="text-[var(--color-text-secondary)]">{m.byUser ?? (m.byRole ? `(${m.byRole})` : '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th>{children}</th>;
}
