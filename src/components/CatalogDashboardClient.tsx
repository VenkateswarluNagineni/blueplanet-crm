'use client';

import React, { useState, useMemo, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Truck,
  Search,
  Image as ImageIcon,
  TrendingUp,
  Globe,
  X,
  Tag,
  ListFilter,
  Eye,
  ChevronDown,
  LayoutGrid,
  Rows3,
  Columns3,
  ArrowUpDown,
} from 'lucide-react';
import type { CatalogProduct, CatalogSlab } from '@/server/queries/catalog';
import { createQuoteAction } from '@/server/actions/sales';
import { FacetCard, FacetRow } from '@/components/ui/FacetCard';

// ---- Products Master List: price band + facet/column config ----

const PRICE_BANDS = ['≤ $50', '$50 – 100', '$100 – 150', '> $150', 'Unpriced'] as const;
function priceBand(n: number | null): string {
  if (n == null) return 'Unpriced';
  if (n <= 50) return '≤ $50';
  if (n <= 100) return '$50 – 100';
  if (n <= 150) return '$100 – 150';
  return '> $150';
}

type ProdFacet = { id: string; label: string; valueOf: (p: CatalogProduct) => string; order?: readonly string[] };
const PROD_FACETS: ProdFacet[] = [
  { id: 'type', label: 'Type', valueOf: (p) => p.productType || '—' },
  { id: 'category', label: 'Category', valueOf: (p) => p.category || p.materialType || '—' },
  { id: 'subCategory', label: 'Sub-Category', valueOf: (p) => p.subCategory || '—' },
  { id: 'group', label: 'Product Group', valueOf: (p) => p.productGroup || '—' },
  { id: 'price', label: 'Price Range', valueOf: (p) => priceBand(p.retailPricePerSf), order: PRICE_BANDS },
  { id: 'origin', label: 'Origin', valueOf: (p) => p.originCountry || '—' },
  { id: 'finish', label: 'Finish', valueOf: (p) => p.finish || '—' },
];

type ProdColKey = 'type' | 'category' | 'subCategory' | 'group' | 'finish' | 'color' | 'origin' | 'thickness' | 'yard' | 'hold' | 'transit' | 'retail' | 'cost' | 'margin';
const PROD_COLUMNS: { key: ProdColKey; label: string; right?: boolean; def: boolean; cost?: boolean }[] = [
  { key: 'type', label: 'Type', def: true },
  { key: 'category', label: 'Category', def: true },
  { key: 'subCategory', label: 'Sub-Category', def: false },
  { key: 'group', label: 'Group', def: true },
  { key: 'finish', label: 'Finish', def: false },
  { key: 'color', label: 'Base Color', def: true },
  { key: 'origin', label: 'Origin', def: true },
  { key: 'thickness', label: 'Thickness', def: false },
  { key: 'yard', label: 'In Yard', right: true, def: true },
  { key: 'hold', label: 'On Hold', right: true, def: false },
  { key: 'transit', label: 'In Transit', right: true, def: false },
  { key: 'retail', label: 'Retail $/sf', right: true, def: true },
  { key: 'cost', label: 'Cost $/sf', right: true, def: false, cost: true },
  { key: 'margin', label: 'Margin', right: true, def: false, cost: true },
];
const PROD_COLS_LS_KEY = 'bp.catalog.prodCols.v1';

export default function CatalogDashboardClient({
  products,
  canViewCost,
}: {
  products: CatalogProduct[];
  canViewCost: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Cost view is only available to viewers permitted to see landed cost.
  const [viewMode, setViewMode] = useState<'ADMIN' | 'SALES'>('SALES');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState<CatalogProduct | null>(null);

  // Quoting modal state
  const [quotingSlab, setQuotingSlab] = useState<CatalogSlab | null>(null);
  const [quotePrice, setQuotePrice] = useState<string>('');
  const [quoteCustomer, setQuoteCustomer] = useState('');
  const [quoteError, setQuoteError] = useState('');

  // Filter / view state
  const [showFilters, setShowFilters] = useState(false);
  const [openFilterMenu, setOpenFilterMenu] = useState<string | null>(null);
  const [prodFilters, setProdFilters] = useState<Record<string, string[]>>({});
  const [viewLayout, setViewLayout] = useState<'GALLERY' | 'LIST'>('GALLERY');
  const [showCatalog, setShowCatalog] = useState(false);
  const [showColPicker, setShowColPicker] = useState(false);
  const [sortKey, setSortKey] = useState<'name' | 'type' | 'category' | 'yard' | 'retail'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [visibleProdCols, setVisibleProdCols] = useState<Set<ProdColKey>>(
    () => new Set(PROD_COLUMNS.filter((c) => c.def).map((c) => c.key)),
  );
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PROD_COLS_LS_KEY);
      if (raw) {
        const keys = (JSON.parse(raw) as ProdColKey[]).filter((k) => PROD_COLUMNS.some((c) => c.key === k));
        if (keys.length) setVisibleProdCols(new Set(keys));
      }
    } catch { /* ignore corrupt storage */ }
  }, []);
  const toggleProdCol = (key: ProdColKey) =>
    setVisibleProdCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      try { localStorage.setItem(PROD_COLS_LS_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });

  const toggleProd = (facet: string, value: string) =>
    setProdFilters((prev) => {
      const cur = prev[facet] ?? [];
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      return { ...prev, [facet]: next };
    });
  const clearProdFilters = () => setProdFilters({});
  const prodFilterCount = Object.values(prodFilters).reduce((n, arr) => n + arr.length, 0);

  const matchSearch = (m: CatalogProduct) =>
    [m.name, m.sku, m.materialType, m.altName, m.genericSku, m.category, m.baseColor]
      .filter(Boolean).join(' ').toLowerCase().includes(searchTerm.toLowerCase());
  const prodFacetPass = (m: CatalogProduct) =>
    PROD_FACETS.every((f) => {
      const sel = prodFilters[f.id];
      return !sel || sel.length === 0 || sel.includes(f.valueOf(m));
    });
  const filteredMaterials = products.filter((m) => matchSearch(m) && prodFacetPass(m));

  const sortedMaterials = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const key = (m: CatalogProduct) => {
      switch (sortKey) {
        case 'type': return m.productType;
        case 'category': return m.category ?? m.materialType;
        case 'yard': return m.slabsInYard;
        case 'retail': return m.retailPricePerSf ?? -1;
        default: return m.name;
      }
    };
    return [...filteredMaterials].sort((a, b) => {
      const ka = key(a), kb = key(b);
      if (typeof ka === 'number' && typeof kb === 'number') return (ka - kb) * dir;
      return String(ka).localeCompare(String(kb)) * dir;
    });
  }, [filteredMaterials, sortKey, sortDir]);

  // Faceted count cards computed over all products (stable catalog overview).
  const productFacetCards = useMemo(() =>
    PROD_FACETS.map((f) => {
      const counts = new Map<string, number>();
      for (const p of products) { const v = f.valueOf(p); counts.set(v, (counts.get(v) ?? 0) + 1); }
      let entries = Array.from(counts.entries());
      entries = f.order
        ? entries.sort((a, b) => f.order!.indexOf(a[0]) - f.order!.indexOf(b[0]))
        : entries.sort((a, b) => b[1] - a[1]);
      return { id: f.id, label: f.label, entries };
    }), [products]);

  const setSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };
  const visibleProductCols = PROD_COLUMNS.filter((c) => visibleProdCols.has(c.key) && (!c.cost || (canViewCost && viewMode === 'ADMIN')));

  const badge = (s: string) => <span className="bg-[#333234] border border-[#454446] text-[#b8b6b9] px-2 py-0.5 rounded text-[11px]">{s}</span>;
  const dim = (s: string | null) => <span className="text-[#b8b6b9]">{s ?? '—'}</span>;
  const prodCell = (key: ProdColKey, item: CatalogProduct): React.ReactNode => {
    switch (key) {
      case 'type': return badge(item.productType);
      case 'category': return dim(item.category ?? item.materialType);
      case 'subCategory': return dim(item.subCategory);
      case 'group': return item.productGroup ? badge(item.productGroup) : dim(null);
      case 'finish': return dim(item.finish);
      case 'color': return dim(item.baseColor);
      case 'origin': return dim(item.originCountry);
      case 'thickness': return dim(item.thickness);
      case 'yard': return <span className="text-white font-medium">{item.slabsInYard}</span>;
      case 'hold': return <span className={item.slabsOnHold > 0 ? 'text-[#e3c16c]' : 'text-[#7d7c7f]'}>{item.slabsOnHold}</span>;
      case 'transit': return <span className={item.slabsInTransit > 0 ? 'text-[#92b0ce]' : 'text-[#7d7c7f]'}>{item.slabsInTransit}</span>;
      case 'retail': return <span className="text-white">{item.retailPricePerSf != null ? `$${item.retailPricePerSf}` : '—'}</span>;
      case 'cost': return <span className="text-[#b8b6b9]">{item.avgCostPerSf != null ? `$${item.avgCostPerSf}` : '—'}</span>;
      case 'margin': {
        const m = item.avgCostPerSf != null && item.retailPricePerSf ? (((item.retailPricePerSf - item.avgCostPerSf) / item.retailPricePerSf) * 100).toFixed(0) : null;
        return <span className="text-[#10b981]">{m != null ? `${m}%` : '—'}</span>;
      }
      default: return null;
    }
  };

  const handleQuoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setQuoteError('');
    if (!selectedMaterial || !quotingSlab) return;
    const priceNum = parseFloat(quotePrice);
    if (isNaN(priceNum)) {
      setQuoteError('Please enter a valid price.');
      return;
    }
    const floor = selectedMaterial.minPricePerSf ?? 0;
    if (priceNum < floor) {
      setQuoteError(`Price cannot be below the authorized minimum of $${floor}/sqft.`);
      return;
    }

    startTransition(async () => {
      const res = await createQuoteAction({
        slabId: quotingSlab.id,
        pricePerSf: priceNum,
        customerName: quoteCustomer,
      });
      if (!res.ok) {
        setQuoteError(res.error);
        return;
      }
      setQuotingSlab(null);
      setQuotePrice('');
      setQuoteCustomer('');
      setSelectedMaterial(null);
      router.refresh();
    });
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#2b2a2c]">
      {/* 1. Header & Controls */}
      <div className="pt-6 pb-2 px-6 border-b border-[#454446] shrink-0">
        <div className="flex justify-between items-end mb-4">
          <div>
            <h1 className="text-[20px] font-medium text-white mb-2">Material Master Catalog</h1>
            <p className="text-[13px] text-[#b8b6b9]">
              {viewMode === 'SALES'
                ? 'Browse available gallery and yard inventory.'
                : 'Manage full lifecycle cost, provenance, and inventory metrics.'}
            </p>
          </div>
          {canViewCost && (
            <div className="flex items-center gap-3">
              <div className="bg-[#1c1c1c] p-1 rounded-md border border-[#454446] flex text-[13px] font-medium">
                <button
                  onClick={() => setViewMode('SALES')}
                  className={`px-4 py-1.5 rounded-sm transition-colors flex items-center gap-2 ${viewMode === 'SALES' ? 'bg-[#333234] text-white shadow-sm' : 'text-[#b8b6b9] hover:text-white'}`}
                >
                  <Eye size={14} /> Sales Gallery
                </button>
                <button
                  onClick={() => setViewMode('ADMIN')}
                  className={`px-4 py-1.5 rounded-sm transition-colors flex items-center gap-2 ${viewMode === 'ADMIN' ? 'bg-[#333234] text-[#e3c16c] shadow-sm' : 'text-[#b8b6b9] hover:text-white'}`}
                >
                  <TrendingUp size={14} /> Admin / Cost
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pb-2">
          <div className="flex gap-4 items-center">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2 text-[#b8b6b9]" />
              <input
                type="text"
                placeholder="Search materials (e.g., Calacatta, Quartzite)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-[#1c1c1c] border border-[#454446] rounded text-[13px] text-white focus:outline-none focus:border-[#92b0ce] w-80 transition-colors"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-2 py-1 rounded transition-colors text-[13px] ${showFilters ? 'bg-[#333234] text-white' : 'hover:bg-[#333234] text-[#b8b6b9]'}`}
            >
              <ListFilter size={14} /> Filters
              {prodFilterCount > 0 && (
                <span className="bg-[#e3c16c] text-black text-[10px] px-1.5 rounded-sm ml-1 font-medium">{prodFilterCount}</span>
              )}
            </button>
            <button
              onClick={() => setShowCatalog(!showCatalog)}
              className={`flex items-center gap-2 px-2 py-1 rounded transition-colors text-[13px] ${showCatalog ? 'bg-[#333234] text-white' : 'hover:bg-[#333234] text-[#b8b6b9]'}`}
            >
              <LayoutGrid size={14} /> Catalog
            </button>
          </div>
          <div className="flex items-center gap-3">
            {viewLayout === 'LIST' && (
              <div className="relative">
                <button onClick={() => setShowColPicker(!showColPicker)} className={`flex items-center gap-2 px-2 py-1 rounded transition-colors text-[13px] ${showColPicker ? 'bg-[#333234] text-white' : 'hover:bg-[#333234] text-[#b8b6b9]'}`}>
                  <Columns3 size={14} /> Columns
                </button>
                {showColPicker && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowColPicker(false)} />
                    <div className="absolute right-0 top-9 w-56 max-h-[60vh] overflow-y-auto bg-[#1c1c1c] border border-[#454446] rounded-md shadow-xl z-50 py-2">
                      <p className="px-3 pb-1.5 text-[10px] uppercase tracking-wider text-[#7d7c7f]">Visible columns</p>
                      {PROD_COLUMNS.filter((c) => !c.cost || (canViewCost && viewMode === 'ADMIN')).map((c) => (
                        <label key={c.key} className="flex items-center gap-2 px-3 py-1.5 text-[12px] text-white hover:bg-[#333234] cursor-pointer">
                          <input type="checkbox" checked={visibleProdCols.has(c.key)} onChange={() => toggleProdCol(c.key)} className="accent-[#e3c16c]" />
                          {c.label}
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="bg-[#1c1c1c] p-1 rounded-md border border-[#454446] flex text-[13px] font-medium">
              <button onClick={() => setViewLayout('GALLERY')} className={`px-3 py-1.5 rounded-sm transition-colors flex items-center gap-2 ${viewLayout === 'GALLERY' ? 'bg-[#333234] text-white' : 'text-[#b8b6b9] hover:text-white'}`}><LayoutGrid size={14} /> Gallery</button>
              <button onClick={() => setViewLayout('LIST')} className={`px-3 py-1.5 rounded-sm transition-colors flex items-center gap-2 ${viewLayout === 'LIST' ? 'bg-[#333234] text-white' : 'text-[#b8b6b9] hover:text-white'}`}><Rows3 size={14} /> Master List</button>
            </div>
          </div>
        </div>
      </div>

      {/* Conditional Filter Bar — one dropdown per facet */}
      {showFilters && (
        <div className="px-6 py-3 bg-[#1c1c1c] border-b border-[#454446] flex items-center gap-3 text-[13px] flex-wrap">
          <span className="text-[#b8b6b9]">Filter by:</span>
          {productFacetCards.map((f) => {
            const sel = prodFilters[f.id] ?? [];
            return (
              <div key={f.id} className="relative">
                <button
                  onClick={() => setOpenFilterMenu(openFilterMenu === f.id ? null : f.id)}
                  aria-expanded={openFilterMenu === f.id}
                  className="flex items-center gap-1 text-white hover:text-[#92b0ce] bg-[#333234] px-3 py-1 rounded border border-[#454446]"
                >
                  {f.label} {sel.length > 0 && <span className="text-[#e3c16c]">({sel.length})</span>} <ChevronDown size={14} />
                </button>
                {openFilterMenu === f.id && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpenFilterMenu(null)} />
                    <div className="absolute top-full mt-1 left-0 w-56 max-h-64 overflow-y-auto bg-[#1c1c1c] border border-[#454446] rounded shadow-xl z-50 p-2">
                      {f.entries.map(([val, n]) => (
                        <label key={val} className="flex items-center justify-between gap-2 p-1.5 hover:bg-[#333234] rounded cursor-pointer text-white">
                          <span className="flex items-center gap-2"><input type="checkbox" checked={sel.includes(val)} onChange={() => toggleProd(f.id, val)} className="accent-[#e3c16c]" />{val}</span>
                          <span className="text-[11px] text-[#b8b6b9]">{n}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Active Filters Pill Bar */}
      {prodFilterCount > 0 && (
        <div className="px-6 py-2 bg-[#2b2a2c] border-b border-[#454446] flex gap-2 flex-wrap items-center">
          <span className="text-[12px] text-[#b8b6b9] mr-2">Active:</span>
          {Object.entries(prodFilters).flatMap(([facet, vals]) =>
            vals.map((v) => {
              const label = PROD_FACETS.find((f) => f.id === facet)?.label ?? facet;
              return (
                <span key={`${facet}:${v}`} className="flex items-center gap-1 bg-[#454446] text-white px-2 py-0.5 rounded text-[12px]">
                  {label}: {v} <X size={12} className="cursor-pointer hover:text-[#e3c16c]" onClick={() => toggleProd(facet, v)} />
                </span>
              );
            }))}
          <button onClick={clearProdFilters} className="text-[12px] text-[#92b0ce] hover:underline ml-2">Clear All</button>
        </div>
      )}

      {/* Products Master List — faceted count cards (click a value to filter) */}
      {showCatalog && (
        <div className="px-6 py-4 bg-[#1c1c1c] border-b border-[#454446] shrink-0 max-h-[42vh] overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {productFacetCards.map((f) => (
              <FacetCard key={f.id} title={f.label}>
                {f.entries.map(([val, n]) => (
                  <FacetRow key={val} label={val} count={n} active={(prodFilters[f.id] ?? []).includes(val)} onClick={() => toggleProd(f.id, val)} />
                ))}
              </FacetCard>
            ))}
          </div>
        </div>
      )}

      {/* Automated Supply Chain Exception Banner */}
      {(() => {
        const criticalLow = filteredMaterials.filter(m => m.slabsInYard <= 5);
        if (criticalLow.length === 0) return null;
        return (
          <div className="mx-6 mt-4 bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl flex items-center justify-between text-amber-300 shadow-md">
            <div className="flex items-center gap-3 text-[13px]">
              <span className="px-2 py-0.5 bg-amber-500 text-black font-bold text-[10px] rounded-full uppercase tracking-wider shadow-sm">ROP Alert</span>
              <span><strong>Velocity Exception Detected:</strong> {criticalLow.length} active stone line{criticalLow.length === 1 ? '' : 's'} ({criticalLow.map(c => c.name).slice(0, 2).join(', ')}{criticalLow.length > 2 ? '...' : ''}) below safety yard reserve (≤ 5 slabs).</span>
            </div>
            <button 
              onClick={() => router.push('/purchases')}
              className="text-[12px] bg-amber-500 hover:bg-amber-400 text-black font-bold px-3.5 py-2 rounded-lg transition-all cursor-pointer shrink-0 shadow hover:shadow-md"
            >
              Issue Emergency PO →
            </button>
          </div>
        );
      })()}

      {/* 2. Gallery / Master List */}
      <div className="flex-1 overflow-y-auto">
        {viewLayout === 'GALLERY' ? (
        <div className="p-6">
        {filteredMaterials.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[13px] text-[#b8b6b9]">
            No materials match your search.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredMaterials.map((item) => {
              const margin =
                viewMode === 'ADMIN' && item.avgCostPerSf != null && item.retailPricePerSf
                  ? (((item.retailPricePerSf - item.avgCostPerSf) / item.retailPricePerSf) * 100).toFixed(0)
                  : null;
              return (
                <div
                  key={item.id}
                  className="bg-[#1c1c1c] border border-[#454446] rounded-xl overflow-hidden hover:border-[#92b0ce] transition-all duration-200 cursor-pointer group shadow-sm hover:shadow-xl hover:-translate-y-0.5"
                  onClick={() => setSelectedMaterial(item)}
                >
                  <div className="h-40 bg-[#333234] flex items-center justify-center relative overflow-hidden group-hover:bg-[#2b2a2c] transition-colors">
                    <ImageIcon size={32} className="text-[#454446]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1c1c1c] to-transparent opacity-60"></div>
                    <div className="absolute bottom-2.5 left-3.5 flex gap-2">
                      <span className="bg-[#1c1c1c]/80 backdrop-blur text-white px-2.5 py-0.5 rounded-full text-[10px] font-medium border border-[#454446]">{item.materialType}</span>
                      {item.thickness && (
                        <span className="bg-[#1c1c1c]/80 backdrop-blur text-[#b8b6b9] px-2.5 py-0.5 rounded-full text-[10px] font-medium border border-[#454446]">{item.thickness}</span>
                      )}
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="text-[15px] font-medium text-white group-hover:text-[#92b0ce] transition-colors">{item.name}</h3>
                        <p className="text-[12px] text-[#b8b6b9] flex items-center gap-1 mt-0.5">
                          <Globe size={12} /> {item.originCountry ?? 'Unknown origin'}
                        </p>
                      </div>
                      {viewMode === 'SALES' || margin == null ? (
                        <div className="text-right">
                          <p className="text-[14px] text-white font-medium">${item.retailPricePerSf ?? '—'}/sqft</p>
                        </div>
                      ) : (
                        <div className="text-right">
                          <p className="text-[12px] text-[#10b981] font-medium flex items-center justify-end gap-1"><TrendingUp size={10} /> {margin}% Margin</p>
                          <p className="text-[11px] text-[#b8b6b9] mt-0.5">Cost: ${item.avgCostPerSf}</p>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 mt-3 border-t border-[#454446] flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-white font-medium flex items-center gap-1">
                          <Tag size={12} className="text-[#b8b6b9]" />
                          {item.slabsInYard} <span className="text-[#b8b6b9] font-normal">in Yard</span>
                        </span>
                        {item.slabsOnHold > 0 && (
                          <span className="text-[11px] text-[#e3c16c] bg-[#e3c16c]/10 px-1.5 py-0.5 rounded">{item.slabsOnHold} On Hold</span>
                        )}
                      </div>
                      {viewMode === 'ADMIN' && item.slabsInTransit > 0 && (
                        <div className="flex justify-end">
                          <span className="text-[11px] text-[#92b0ce] flex items-center gap-1 bg-[#92b0ce]/10 px-1.5 py-0.5 rounded">
                            <Truck size={10} /> +{item.slabsInTransit} In Transit
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>
        ) : (
          <table className="w-full text-left text-[13px] text-[#d9d8d9] whitespace-nowrap border-collapse min-w-max">
            <thead className="sticky top-0 bg-[#2b2a2c] z-10 shadow-[0_1px_0_#454446]">
              <tr>
                <th className="px-4 py-3 font-medium border-b border-[#454446]">
                  <button onClick={() => setSort('name')} className="inline-flex items-center gap-1 hover:text-white">Product / SKU <ArrowUpDown size={11} /></button>
                </th>
                {visibleProductCols.map((c) => {
                  const sortable = (['type', 'category', 'yard', 'retail'] as const).includes(c.key as 'type');
                  return (
                    <th key={c.key} className={`px-4 py-3 font-medium border-b border-[#454446] ${c.right ? 'text-right' : ''}`}>
                      {sortable
                        ? <button onClick={() => setSort(c.key as 'type' | 'category' | 'yard' | 'retail')} className="inline-flex items-center gap-1 hover:text-white">{c.label} <ArrowUpDown size={11} /></button>
                        : c.label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#454446]">
              {sortedMaterials.length === 0 ? (
                <tr><td colSpan={visibleProductCols.length + 1} className="px-6 py-12 text-center text-[#b8b6b9]">No products match your filters.</td></tr>
              ) : sortedMaterials.map((item) => (
                <tr key={item.id} className="hover:bg-[#333234] transition-colors cursor-pointer" onClick={() => setSelectedMaterial(item)}>
                  <td className="px-4 py-3"><div className="font-medium text-white hover:text-[#92b0ce]">{item.name}</div><div className="text-[11px] text-[#b8b6b9] font-mono">{item.sku}</div></td>
                  {visibleProductCols.map((c) => <td key={c.key} className={`px-4 py-3 ${c.right ? 'text-right' : ''}`}>{prodCell(c.key, item)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 3. Slide-in Details Drawer */}
      {selectedMaterial && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 transition-opacity" onClick={() => setSelectedMaterial(null)} />
          <div className="fixed top-0 right-0 h-full w-[600px] bg-[#2b2a2c] border-l border-[#454446] shadow-2xl z-50 flex flex-col">
            <div className="px-6 py-5 border-b border-[#454446] bg-[#1c1c1c] flex justify-between items-start">
              <div>
                <h2 className="text-[20px] font-medium text-white flex items-center gap-2">{selectedMaterial.name}</h2>
                <div className="flex gap-2 mt-2 text-[12px] text-[#b8b6b9] flex-wrap">
                  <span className="bg-[#e3c16c]/10 text-[#e3c16c] border border-[#e3c16c]/30 px-2 py-0.5 rounded">{selectedMaterial.productType}</span>
                  <span className="bg-[#333234] border border-[#454446] px-2 py-0.5 rounded">{selectedMaterial.category ?? selectedMaterial.materialType}</span>
                  {selectedMaterial.productGroup && <span className="bg-[#333234] border border-[#454446] px-2 py-0.5 rounded">{selectedMaterial.productGroup}</span>}
                  {selectedMaterial.originCountry && <span className="bg-[#333234] border border-[#454446] px-2 py-0.5 rounded">{selectedMaterial.originCountry}</span>}
                  <span className="bg-[#333234] border border-[#454446] px-2 py-0.5 rounded">{selectedMaterial.finish}</span>
                  <span className="bg-[#333234] border border-[#454446] px-2 py-0.5 rounded font-mono text-[11px]">{selectedMaterial.sku}</span>
                </div>
              </div>
              <button onClick={() => setSelectedMaterial(null)} className="text-[#b8b6b9] hover:text-white hover:bg-[#333234] p-1.5 rounded transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {viewMode === 'ADMIN' && canViewCost ? (
                <div className="space-y-6">
                  <div className="bg-[#1c1c1c] border border-[#454446] rounded-md p-5">
                    <p className="text-[12px] text-[#b8b6b9] uppercase tracking-wider mb-3">Procurement Intelligence</p>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-[#2b2a2c] border border-[#454446] p-3 rounded">
                        <p className="text-[11px] text-[#b8b6b9]">Landed Cost (Avg)</p>
                        <p className="text-[16px] text-white font-medium">${selectedMaterial.avgCostPerSf ?? '—'}/sqft</p>
                      </div>
                      <div className="bg-[#2b2a2c] border border-[#454446] p-3 rounded">
                        <p className="text-[11px] text-[#b8b6b9]">Retail Price</p>
                        <p className="text-[16px] text-[#92b0ce] font-medium">${selectedMaterial.retailPricePerSf ?? '—'}/sqft</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#b8b6b9] mb-2">Approved Suppliers</p>
                      {selectedMaterial.approvedSuppliers.length > 0 ? (
                        <div className="flex gap-2 flex-wrap">
                          {selectedMaterial.approvedSuppliers.map((s) => (
                            <span key={s.id} className="text-[12px] bg-[#333234] border border-[#454446] text-[#d9d8d9] px-2 py-1 rounded flex items-center gap-1">
                              <Building2 size={12} /> {s.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[12px] text-[#b8b6b9] italic">No active suppliers mapped.</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-[#1c1c1c] border border-[#454446] rounded-md p-5">
                    <p className="text-[12px] text-[#b8b6b9] uppercase tracking-wider mb-3">Inbound Logistics (POs)</p>
                    {selectedMaterial.inboundPOs.length > 0 ? (
                      <div className="space-y-2">
                        {selectedMaterial.inboundPOs.map((po) => (
                          <div key={po.poNumber} className="border border-[#454446] rounded overflow-hidden">
                            <div className="bg-[#2b2a2c] px-3 py-2 flex justify-between text-[12px] text-[#b8b6b9] border-b border-[#454446]">
                              <span>{po.poNumber}</span>
                              <span className="text-[#e3c16c]">ETA: {po.eta ?? 'TBD'}</span>
                            </div>
                            <div className="p-3 text-[13px] text-white flex justify-between">
                              <span>{po.orderedSlabs} Slabs</span>
                              <span className="text-[#b8b6b9]">Container: {po.containerId ?? 'TBD'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[13px] text-[#b8b6b9]">No active purchase orders in transit.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-[13px] text-[#b8b6b9] mb-4">Select slabs below to add to a customer quote.</p>
                  {selectedMaterial.availableSlabs.length === 0 ? (
                    <p className="text-[13px] text-[#b8b6b9] italic">No slabs currently available in the yard.</p>
                  ) : (
                    selectedMaterial.availableSlabs.slice(0, 8).map((slab) => (
                      <div key={slab.id} className="bg-[#1c1c1c] border border-[#454446] rounded flex items-center p-3 hover:bg-[#333234] cursor-pointer group">
                        <div className="w-16 h-12 bg-[#2b2a2c] rounded mr-4 flex items-center justify-center">
                          <ImageIcon size={16} className="text-[#454446]" />
                        </div>
                        <div className="flex-1">
                          <a
                            href={`/inventory?slab=${encodeURIComponent(slab.uniqueSlabId)}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[13px] text-white font-mono hover:text-[#e3c16c] hover:underline transition-colors"
                            title="Open full slab traceability in Inventory"
                          >
                            {slab.uniqueSlabId}
                          </a>
                          <p className="text-[11px] text-[#b8b6b9]">{slab.totalSf} sqft</p>
                        </div>
                        <div className="text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setQuotingSlab(slab);
                              setQuotePrice(selectedMaterial.retailPricePerSf?.toString() ?? '');
                              setQuoteError('');
                            }}
                            className="text-[11px] font-medium bg-[#10b981] text-black px-3 py-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Add to Quote
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                  {selectedMaterial.availableSlabs.length > 8 && (
                    <p className="text-[12px] text-[#b8b6b9] text-center pt-2">…and {selectedMaterial.availableSlabs.length - 8} more slabs available.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Quote Creation Modal */}
      {quotingSlab && selectedMaterial && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
          <div className="bg-[#2b2a2c] border border-[#454446] rounded-lg w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#454446] bg-[#1c1c1c] flex justify-between items-center">
              <h3 className="text-white font-medium">Create Sales Quote</h3>
              <button onClick={() => setQuotingSlab(null)} className="text-[#b8b6b9] hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleQuoteSubmit} className="p-6 space-y-4">
              <div className="bg-[#1c1c1c] border border-[#454446] p-3 rounded mb-4">
                <p className="text-[12px] text-[#b8b6b9] mb-1">Selected Material</p>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[14px] text-white font-medium">{selectedMaterial.name}</p>
                    <p className="text-[12px] text-[#92b0ce]">{quotingSlab.uniqueSlabId} ({quotingSlab.totalSf} sqft)</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-[#b8b6b9]">Retail Price</p>
                    <p className="text-[13px] text-white">${selectedMaterial.retailPricePerSf ?? '—'}/sqft</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[12px] text-[#b8b6b9] mb-1.5">Customer Name / Project</label>
                <input
                  type="text"
                  required
                  value={quoteCustomer}
                  onChange={(e) => setQuoteCustomer(e.target.value)}
                  className="w-full bg-[#1c1c1c] border border-[#454446] rounded px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[#92b0ce]"
                  placeholder="e.g. John Smith - Kitchen Remodel"
                />
              </div>

              <div>
                <label className="block text-[12px] text-[#b8b6b9] mb-1.5">Quoted Price ($/sqft)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={quotePrice}
                  onChange={(e) => setQuotePrice(e.target.value)}
                  className="w-full bg-[#1c1c1c] border border-[#454446] rounded px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[#92b0ce]"
                />
              </div>

              {quoteError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] px-3 py-2 rounded">{quoteError}</div>
              )}

              <div className="pt-4 mt-2 border-t border-[#454446] flex justify-end gap-3">
                <button type="button" onClick={() => setQuotingSlab(null)} className="px-4 py-2 text-[13px] text-[#b8b6b9] hover:text-white transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isPending} className="px-4 py-2 text-[13px] bg-[#10b981] text-black font-medium rounded hover:bg-[#0ea5e9] transition-colors disabled:opacity-60">
                  {isPending ? 'Creating…' : 'Confirm Sales Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
