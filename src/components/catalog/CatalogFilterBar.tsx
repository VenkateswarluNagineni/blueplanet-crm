import { ChevronDown } from 'lucide-react';

type FacetCardData = { id: string; label: string; entries: [string, number][] };

export function CatalogFilterBar({
  facets,
  prodFilters,
  openFilterMenu,
  setOpenFilterMenu,
  toggleProd,
}: {
  facets: FacetCardData[];
  prodFilters: Record<string, string[]>;
  openFilterMenu: string | null;
  setOpenFilterMenu: (id: string | null) => void;
  toggleProd: (facet: string, value: string) => void;
}) {
  return (
    <div className="px-6 py-3 bg-[var(--color-basalt-900)] border-b border-[var(--color-basalt-500)] flex items-center gap-3 text-[13px] flex-wrap">
      <span className="text-[var(--color-text-secondary)]">Filter by:</span>
      {facets.map((f) => {
        const sel = prodFilters[f.id] ?? [];
        return (
          <div key={f.id} className="relative">
            <button
              onClick={() => setOpenFilterMenu(openFilterMenu === f.id ? null : f.id)}
              aria-expanded={openFilterMenu === f.id}
              className="flex items-center gap-1 text-white hover:text-[var(--color-sodalite)] bg-[var(--color-basalt-700)] px-3 py-1 rounded border border-[var(--color-basalt-500)]"
            >
              {f.label} {sel.length > 0 && <span className="text-[var(--color-vein)]">({sel.length})</span>} <ChevronDown size={14} />
            </button>
            {openFilterMenu === f.id && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setOpenFilterMenu(null)} />
                <div className="absolute top-full mt-1 left-0 w-56 max-h-64 overflow-y-auto bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded shadow-xl z-50 p-2">
                  {f.entries.map(([val, n]) => (
                    <label key={val} className="flex items-center justify-between gap-2 p-1.5 hover:bg-[var(--color-basalt-700)] rounded cursor-pointer text-white">
                      <span className="flex items-center gap-2"><input type="checkbox" checked={sel.includes(val)} onChange={() => toggleProd(f.id, val)} className="accent-[var(--color-vein)]" />{val}</span>
                      <span className="text-[11px] text-[var(--color-text-secondary)]">{n}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
