'use client';

import React, { useState, useMemo, useTransition, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  Box,
} from 'lucide-react';
import type { CatalogProduct, CatalogSlab } from '@/server/catalog/queries';
import { createQuoteAction } from '@/server/orders/actions';
import { FacetCard, FacetRow } from '@/components/ui/FacetCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Drawer } from '@/components/ui/Drawer';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { swatchBaseForMaterial } from '@/lib/domain/material-swatch';

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
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Cost view is only available to viewers permitted to see landed cost.
  const [viewMode, setViewMode] = useState<'ADMIN' | 'SALES'>('SALES');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState<CatalogProduct | null>(null);

  // Deep-link: /catalog?product=<id|sku> opens that material detail.
  useEffect(() => {
    const wanted = searchParams.get('product');
    if (!wanted) return;
    const match = products.find(
      (p) => p.id === wanted || p.sku === wanted || p.name.toLowerCase() === wanted.toLowerCase(),
    );
    if (!match) return;
    const t = setTimeout(() => {
      setSelectedMaterial(match);
      setSearchTerm(match.name);
    }, 0);
    return () => clearTimeout(t);
  }, [searchParams, products]);

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
  const [visibleProdCols, setVisibleProdCols] = useState<Set<ProdColKey>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(PROD_COLS_LS_KEY);
        if (raw) {
          const keys = (JSON.parse(raw) as ProdColKey[]).filter((k) => PROD_COLUMNS.some((c) => c.key === k));
          if (keys.length) return new Set(keys);
        }
      } catch { /* ignore */ }
    }
    return new Set(PROD_COLUMNS.filter((c) => c.def).map((c) => c.key));
  });
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

  const badge = (s: string) => <Badge>{s}</Badge>;
  const dim = (s: string | null) => <span className="text-[var(--color-text-secondary)]">{s ?? '—'}</span>;
  const prodCell = (key: ProdColKey, item: CatalogProduct): React.ReactNode => {
    switch (key) {
      case 'type': return <Badge tone="blue">{item.productType}</Badge>;
      case 'category': return dim(item.category ?? item.materialType);
      case 'subCategory': return dim(item.subCategory);
      case 'group': return item.productGroup ? badge(item.productGroup) : dim(null);
      case 'finish': return dim(item.finish);
      case 'color': return dim(item.baseColor);
      case 'origin': return dim(item.originCountry);
      case 'thickness': return dim(item.thickness);
      case 'yard': return <span className="text-white font-medium">{item.slabsInYard}</span>;
      case 'hold': return <span className={item.slabsOnHold > 0 ? 'text-[var(--color-vein)]' : 'text-[var(--color-fog-500)]'}>{item.slabsOnHold}</span>;
      case 'transit': return <span className={item.slabsInTransit > 0 ? 'text-[var(--color-sodalite)]' : 'text-[var(--color-fog-500)]'}>{item.slabsInTransit}</span>;
      case 'retail': return <span className="text-white">{item.retailPricePerSf != null ? `$${item.retailPricePerSf}` : '—'}</span>;
      case 'cost': return <span className="text-[var(--color-text-secondary)]">{item.avgCostPerSf != null ? `$${item.avgCostPerSf}` : '—'}</span>;
      case 'margin': {
        const m = item.avgCostPerSf != null && item.retailPricePerSf ? (((item.retailPricePerSf - item.avgCostPerSf) / item.retailPricePerSf) * 100).toFixed(0) : null;
        return <span className="text-[var(--color-emerald)]">{m != null ? `${m}%` : '—'}</span>;
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
    <div className="h-full w-full flex flex-col bg-[var(--color-basalt-850)]">
      {/* 1. Header & Controls — DESIGN.md page chrome */}
      <div className="bp-header-chrome pt-5 pb-2 px-6 shrink-0">
        <div className="flex justify-between items-end mb-4">
          <div>
            <p className="bp-eyebrow mb-2">Inventory</p>
            <h1 className="text-[20px] font-medium text-white mb-1 tracking-tight">Catalog</h1>
            <p className="text-[13px] text-[var(--color-text-secondary)]">
              {viewMode === 'SALES'
                ? 'Materials and yard availability.'
                : 'Cost, provenance, and inventory metrics.'}
            </p>
          </div>
          {canViewCost && (
            <div className="flex items-center gap-3">
              <div className="bg-[var(--color-basalt-950)] p-1 rounded-[var(--radius-md)] border border-[var(--color-basalt-500)] flex text-[13px] font-medium">
                <button
                  onClick={() => setViewMode('SALES')}
                  className={`px-4 py-1.5 rounded-[var(--radius-sm)] transition-colors flex items-center gap-2 ${viewMode === 'SALES' ? 'bg-[var(--color-basalt-700)] text-white shadow-sm' : 'text-[var(--color-text-secondary)] hover:text-white'}`}
                >
                  <Eye size={14} /> Sales Gallery
                </button>
                <button
                  onClick={() => setViewMode('ADMIN')}
                  className={`px-4 py-1.5 rounded-[var(--radius-sm)] transition-colors flex items-center gap-2 ${viewMode === 'ADMIN' ? 'bg-[var(--color-basalt-700)] text-[var(--color-vein)] shadow-sm' : 'text-[var(--color-text-secondary)] hover:text-white'}`}
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
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-fog-500)]" />
              <input
                type="search"
                placeholder="Search materials (e.g., Calacatta, Quartzite)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 h-9 bg-[var(--color-basalt-950)] border border-[var(--color-basalt-500)] rounded-[var(--radius-sm)] text-[13px] text-white focus:outline-none focus:border-[var(--color-sodalite)] w-80 transition-colors placeholder-[var(--color-fog-500)]"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-2 py-1 rounded transition-colors text-[13px] ${showFilters ? 'bg-[var(--color-basalt-700)] text-white' : 'hover:bg-[var(--color-basalt-700)] text-[var(--color-text-secondary)]'}`}
            >
              <ListFilter size={14} /> Filters
              {prodFilterCount > 0 && (
                <span className="bg-[rgba(227,193,108,0.14)] text-[var(--color-vein)] border border-[rgba(227,193,108,0.3)] text-[10px] px-1.5 rounded-sm ml-1 font-semibold tabular-nums">{prodFilterCount}</span>
              )}
            </button>
            <button
              onClick={() => setShowCatalog(!showCatalog)}
              className={`flex items-center gap-2 px-2 py-1 rounded transition-colors text-[13px] ${showCatalog ? 'bg-[var(--color-basalt-700)] text-white' : 'hover:bg-[var(--color-basalt-700)] text-[var(--color-text-secondary)]'}`}
            >
              <LayoutGrid size={14} /> Catalog
            </button>
          </div>
          <div className="flex items-center gap-3">
            {viewLayout === 'LIST' && (
              <div className="relative">
                <button onClick={() => setShowColPicker(!showColPicker)} className={`flex items-center gap-2 px-2 py-1 rounded transition-colors text-[13px] ${showColPicker ? 'bg-[var(--color-basalt-700)] text-white' : 'hover:bg-[var(--color-basalt-700)] text-[var(--color-text-secondary)]'}`}>
                  <Columns3 size={14} /> Columns
                </button>
                {showColPicker && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowColPicker(false)} />
                    <div className="absolute right-0 top-9 w-56 max-h-[60vh] overflow-y-auto bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded-md shadow-xl z-50 py-2">
                      <p className="px-3 pb-1.5 text-[10px] uppercase tracking-wider text-[var(--color-fog-500)]">Visible columns</p>
                      {PROD_COLUMNS.filter((c) => !c.cost || (canViewCost && viewMode === 'ADMIN')).map((c) => (
                        <label key={c.key} className="flex items-center gap-2 px-3 py-1.5 text-[12px] text-white hover:bg-[var(--color-basalt-700)] cursor-pointer">
                          <input type="checkbox" checked={visibleProdCols.has(c.key)} onChange={() => toggleProdCol(c.key)} className="accent-[var(--color-vein)]" />
                          {c.label}
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="bg-[var(--color-basalt-900)] p-1 rounded-md border border-[var(--color-basalt-500)] flex text-[13px] font-medium">
              <button onClick={() => setViewLayout('GALLERY')} className={`px-3 py-1.5 rounded-sm transition-colors flex items-center gap-2 ${viewLayout === 'GALLERY' ? 'bg-[var(--color-basalt-700)] text-white' : 'text-[var(--color-text-secondary)] hover:text-white'}`}><LayoutGrid size={14} /> Gallery</button>
              <button onClick={() => setViewLayout('LIST')} className={`px-3 py-1.5 rounded-sm transition-colors flex items-center gap-2 ${viewLayout === 'LIST' ? 'bg-[var(--color-basalt-700)] text-white' : 'text-[var(--color-text-secondary)] hover:text-white'}`}><Rows3 size={14} /> Master List</button>
            </div>
          </div>
        </div>
      </div>

      {/* Conditional Filter Bar — one dropdown per facet */}
      {showFilters && (
        <div className="px-6 py-3 bg-[var(--color-basalt-900)] border-b border-[var(--color-basalt-500)] flex items-center gap-3 text-[13px] flex-wrap">
          <span className="text-[var(--color-text-secondary)]">Filter by:</span>
          {productFacetCards.map((f) => {
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
      )}

      {/* Active Filters Pill Bar */}
      {prodFilterCount > 0 && (
        <div className="px-6 py-2 bg-[var(--color-basalt-800)] border-b border-[var(--color-basalt-500)] flex gap-2 flex-wrap items-center">
          <span className="text-[12px] text-[var(--color-text-secondary)] mr-2">Active:</span>
          {Object.entries(prodFilters).flatMap(([facet, vals]) =>
            vals.map((v) => {
              const label = PROD_FACETS.find((f) => f.id === facet)?.label ?? facet;
              return (
                <span key={`${facet}:${v}`} className="flex items-center gap-1 bg-[var(--color-basalt-500)] text-white px-2 py-0.5 rounded text-[12px]">
                  {label}: {v} <X size={12} className="cursor-pointer hover:text-[var(--color-vein)]" onClick={() => toggleProd(facet, v)} />
                </span>
              );
            }))}
          <button onClick={clearProdFilters} className="text-[12px] text-[var(--color-sodalite)] hover:underline ml-2">Clear All</button>
        </div>
      )}

      {/* Reorder-point alert band — full-width so it never overlaps the facet panel */}
      {(() => {
        const criticalLow = filteredMaterials.filter((m) => m.slabsInYard <= 5);
        if (criticalLow.length === 0) return null;
        return (
          <div className="px-6 py-2.5 bg-[rgba(232,149,107,0.08)] border-b border-[rgba(232,149,107,0.28)] flex items-center justify-between gap-3 text-[var(--color-coral)] shrink-0">
            <div className="flex items-center gap-3 text-[13px] min-w-0">
              <span className="px-2 py-0.5 bg-[rgba(232,149,107,0.2)] text-[var(--color-coral)] border border-[rgba(232,149,107,0.35)] font-semibold text-[10px] rounded-full uppercase tracking-[0.1em] shrink-0">
                Low reserve
              </span>
              <span className="truncate text-[var(--color-text-secondary)]">
                <strong className="text-white font-medium">{criticalLow.length} line{criticalLow.length === 1 ? '' : 's'}</strong>
                {' '}({criticalLow.map((c) => c.name).slice(0, 2).join(', ')}
                {criticalLow.length > 2 ? '…' : ''}) below safety (≤ 5 slabs in yard).
              </span>
            </div>
            <button
              type="button"
              onClick={() => router.push('/purchases')}
              className="btn-primary !min-h-8 !px-3 text-[12px] shrink-0"
            >
              Issue PO
            </button>
          </div>
        );
      })()}

      {/* Products Master List — faceted count cards (click a value to filter) */}
      {showCatalog && (
        <div className="px-6 py-4 bg-[var(--color-basalt-900)] border-b border-[var(--color-basalt-500)] shrink-0 max-h-[42vh] overflow-y-auto">
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

      {/* 2. Gallery / Master List */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {viewLayout === 'GALLERY' ? (
        <div className="p-6">
        {filteredMaterials.length === 0 ? (
          <EmptyState
            icon={Box}
            title="No materials match"
            hint={searchTerm || prodFilterCount > 0 ? 'Clear search or filters to browse the full catalog.' : 'No products in the catalog yet.'}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredMaterials.map((item) => {
              const margin =
                viewMode === 'ADMIN' && item.avgCostPerSf != null && item.retailPricePerSf
                  ? (((item.retailPricePerSf - item.avgCostPerSf) / item.retailPricePerSf) * 100).toFixed(0)
                  : null;
              const swatch = swatchBaseForMaterial(item.materialType, item.baseColor);
              const lowYard = item.slabsInYard <= 5;
              return (
                <div
                  key={item.id}
                  className="bp-card-interactive overflow-hidden cursor-pointer group"
                  onClick={() => setSelectedMaterial(item)}
                >
                  {/* Material swatch hero — DESIGN.md Phase E */}
                  <div
                    className="h-40 relative overflow-hidden"
                    style={{
                      background: `
                        linear-gradient(125deg, transparent 38%, rgba(255,255,255,0.14) 40%, transparent 42%),
                        linear-gradient(155deg, transparent 58%, rgba(0,0,0,0.28) 60%, transparent 63%),
                        radial-gradient(ellipse at 25% 15%, rgba(255,255,255,0.18), transparent 55%),
                        radial-gradient(ellipse at 80% 80%, rgba(0,0,0,0.2), transparent 50%),
                        ${swatch}
                      `,
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-basalt-900)] via-transparent to-transparent opacity-80" />
                    <div className="absolute top-3 right-3">
                      <div
                        className="bp-swatch shadow-lg"
                        style={{ ['--swatch-base' as string]: swatch, width: 36, height: 36 }}
                        aria-hidden
                      />
                    </div>
                    <div className="absolute bottom-2.5 left-3.5 flex gap-2 flex-wrap">
                      <span className="bg-[var(--color-basalt-950)]/75 backdrop-blur-sm text-white px-2.5 py-0.5 rounded-full text-[10px] font-medium border border-white/10">
                        {item.materialType}
                      </span>
                      {item.thickness && (
                        <span className="bg-[var(--color-basalt-950)]/75 backdrop-blur-sm text-[var(--color-text-secondary)] px-2.5 py-0.5 rounded-full text-[10px] font-medium border border-white/10">
                          {item.thickness}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <div className="min-w-0">
                        <h3
                          className="text-[15px] font-medium text-white group-hover:text-[var(--color-sodalite)] transition-colors truncate tracking-tight"
                          style={{ fontFamily: 'var(--font-heading)' }}
                        >
                          {item.name}
                        </h3>
                        <p className="text-[12px] text-[var(--color-text-secondary)] flex items-center gap-1 mt-0.5">
                          <Globe size={12} /> {item.originCountry ?? 'Unknown origin'}
                        </p>
                      </div>
                      {viewMode === 'SALES' || margin == null ? (
                        <div className="text-right shrink-0">
                          <p className="text-[14px] text-white font-medium tabular-nums">
                            ${item.retailPricePerSf ?? '—'}
                            <span className="text-[11px] text-[var(--color-fog-500)] font-normal">/sf</span>
                          </p>
                        </div>
                      ) : (
                        <div className="text-right shrink-0">
                          <p className="text-[12px] text-[var(--color-emerald)] font-medium flex items-center justify-end gap-1">
                            <TrendingUp size={10} /> {margin}% Margin
                          </p>
                          <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                            Cost: ${item.avgCostPerSf}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 mt-3 border-t border-[var(--color-basalt-500)] flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] text-white font-medium flex items-center gap-1">
                          <Tag size={12} className="text-[var(--color-text-secondary)]" />
                          {item.slabsInYard}{' '}
                          <span className="text-[var(--color-text-secondary)] font-normal">in yard</span>
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {lowYard && (
                            <span className="text-[10px] text-[var(--color-coral)] bg-[rgba(232,149,107,0.12)] border border-[rgba(232,149,107,0.28)] px-1.5 py-0.5 rounded">
                              Low reserve
                            </span>
                          )}
                          {item.slabsOnHold > 0 && (
                            <span className="text-[11px] text-[var(--color-vein)] bg-[rgba(227,193,108,0.1)] border border-[rgba(227,193,108,0.25)] px-1.5 py-0.5 rounded">
                              {item.slabsOnHold} hold
                            </span>
                          )}
                        </div>
                      </div>
                      {viewMode === 'ADMIN' && item.slabsInTransit > 0 && (
                        <div className="flex justify-end">
                          <span className="text-[11px] text-[var(--color-sodalite)] flex items-center gap-1 bg-[rgba(146,176,206,0.1)] px-1.5 py-0.5 rounded">
                            <Truck size={10} /> +{item.slabsInTransit} in transit
                          </span>
                        </div>
                      )}
                      {/* Hover meta — yard path into slabs */}
                      <div className="flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity pt-0.5">
                        <span className="text-[11px] text-[var(--color-fog-500)] truncate">
                          {item.finish}
                          {item.thickness ? ` · ${item.thickness}` : ''}
                        </span>
                        <span className="text-[11px] text-[var(--color-sodalite)] font-medium">Open →</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>
        ) : (
          <div className="p-6">
            {sortedMaterials.length === 0 ? (
              <EmptyState
                icon={Box}
                title="No products match"
                hint={searchTerm || prodFilterCount > 0 ? 'Clear search or filters to browse the full catalog.' : 'No products in the catalog yet.'}
              />
            ) : (
              <div className="bp-table-shell overflow-x-auto">
                <table className="bp-table min-w-max whitespace-nowrap">
                  <thead>
                    <tr>
                      <th>
                        <button
                          type="button"
                          onClick={() => setSort('name')}
                          className="inline-flex items-center gap-1 hover:text-white"
                        >
                          Product / SKU <ArrowUpDown size={11} />
                        </button>
                      </th>
                      {visibleProductCols.map((c) => {
                        const sortable = (['type', 'category', 'yard', 'retail'] as const).includes(
                          c.key as 'type',
                        );
                        return (
                          <th key={c.key} className={c.right ? 'text-right' : ''}>
                            {sortable ? (
                              <button
                                type="button"
                                onClick={() => setSort(c.key as 'type' | 'category' | 'yard' | 'retail')}
                                className="inline-flex items-center gap-1 hover:text-white"
                              >
                                {c.label} <ArrowUpDown size={11} />
                              </button>
                            ) : (
                              c.label
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedMaterials.map((item) => (
                      <tr
                        key={item.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedMaterial(item)}
                      >
                        <td>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className="bp-swatch shrink-0"
                              style={{
                                ['--swatch-base' as string]: swatchBaseForMaterial(
                                  item.materialType,
                                  item.baseColor,
                                ),
                                width: 20,
                                height: 20,
                              }}
                              aria-hidden
                            />
                            <div className="min-w-0">
                              <div
                                className="font-medium text-white hover:text-[var(--color-sodalite)] truncate"
                                style={{ fontFamily: 'var(--font-heading)' }}
                              >
                                {item.name}
                              </div>
                              <div className="text-[11px] text-[var(--color-text-secondary)] bp-mono">
                                {item.sku}
                              </div>
                            </div>
                          </div>
                        </td>
                        {visibleProductCols.map((c) => (
                          <td key={c.key} className={c.right ? 'text-right' : ''}>
                            {prodCell(c.key, item)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Material detail — shared Drawer */}
      <Drawer
        open={!!selectedMaterial}
        onClose={() => setSelectedMaterial(null)}
        width={600}
        title={selectedMaterial?.name}
        subtitle={
          selectedMaterial ? (
            <span className="flex gap-2 mt-1 text-[12px] flex-wrap">
              <span className="bg-[rgba(227,193,108,0.12)] text-[var(--color-vein)] border border-[rgba(227,193,108,0.3)] px-2 py-0.5 rounded">
                {selectedMaterial.productType}
              </span>
              <span className="bg-[var(--color-basalt-700)] border border-[var(--color-basalt-500)] px-2 py-0.5 rounded">
                {selectedMaterial.category ?? selectedMaterial.materialType}
              </span>
              {selectedMaterial.originCountry && (
                <span className="bg-[var(--color-basalt-700)] border border-[var(--color-basalt-500)] px-2 py-0.5 rounded">
                  {selectedMaterial.originCountry}
                </span>
              )}
              <span className="bg-[var(--color-basalt-700)] border border-[var(--color-basalt-500)] px-2 py-0.5 rounded bp-mono text-[11px]">
                {selectedMaterial.sku}
              </span>
            </span>
          ) : undefined
        }
      >
        {selectedMaterial && (
            <div className="p-6">
              {viewMode === 'ADMIN' && canViewCost ? (
                <div className="space-y-6">
                  <div className="bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded-md p-5">
                    <p className="text-[12px] text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">Procurement Intelligence</p>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-[var(--color-basalt-800)] border border-[var(--color-basalt-500)] p-3 rounded">
                        <p className="text-[11px] text-[var(--color-text-secondary)]">Landed Cost (Avg)</p>
                        <p className="text-[16px] text-white font-medium">${selectedMaterial.avgCostPerSf ?? '—'}/sqft</p>
                      </div>
                      <div className="bg-[var(--color-basalt-800)] border border-[var(--color-basalt-500)] p-3 rounded">
                        <p className="text-[11px] text-[var(--color-text-secondary)]">Retail Price</p>
                        <p className="text-[16px] text-[var(--color-sodalite)] font-medium">${selectedMaterial.retailPricePerSf ?? '—'}/sqft</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] text-[var(--color-text-secondary)] mb-2">Approved Suppliers</p>
                      {selectedMaterial.approvedSuppliers.length > 0 ? (
                        <div className="flex gap-2 flex-wrap">
                          {selectedMaterial.approvedSuppliers.map((s) => (
                            <span key={s.id} className="text-[12px] bg-[var(--color-basalt-700)] border border-[var(--color-basalt-500)] text-[var(--color-text-muted)] px-2 py-1 rounded flex items-center gap-1">
                              <Building2 size={12} /> {s.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[12px] text-[var(--color-text-secondary)] italic">No active suppliers mapped.</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded-md p-5">
                    <p className="text-[12px] text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">Inbound Logistics (POs)</p>
                    {selectedMaterial.inboundPOs.length > 0 ? (
                      <div className="space-y-2">
                        {selectedMaterial.inboundPOs.map((po) => (
                          <div key={po.poNumber} className="border border-[var(--color-basalt-500)] rounded overflow-hidden">
                            <div className="bg-[var(--color-basalt-800)] px-3 py-2 flex justify-between text-[12px] text-[var(--color-text-secondary)] border-b border-[var(--color-basalt-500)]">
                              <span>{po.poNumber}</span>
                              <span className="text-[var(--color-vein)]">ETA: {po.eta ?? 'TBD'}</span>
                            </div>
                            <div className="p-3 text-[13px] text-white flex justify-between">
                              <span>{po.orderedSlabs} Slabs</span>
                              <span className="text-[var(--color-text-secondary)]">Container: {po.containerId ?? 'TBD'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[13px] text-[var(--color-text-secondary)]">No active purchase orders in transit.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-[13px] text-[var(--color-text-secondary)] mb-4">Select slabs below to add to a customer quote.</p>
                  {selectedMaterial.availableSlabs.length === 0 ? (
                    <p className="text-[13px] text-[var(--color-text-secondary)] italic">No slabs currently available in the yard.</p>
                  ) : (
                    selectedMaterial.availableSlabs.slice(0, 8).map((slab) => (
                      <div key={slab.id} className="bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded flex items-center p-3 hover:bg-[var(--color-basalt-700)] group">
                        <div className="w-16 h-12 bg-[var(--color-basalt-800)] rounded mr-4 flex items-center justify-center">
                          <ImageIcon size={16} className="text-[var(--color-basalt-500)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-white font-mono truncate">{slab.uniqueSlabId}</p>
                          <p className="text-[11px] text-[var(--color-text-secondary)]">{slab.totalSf} sqft</p>
                          <a
                            href={`/inventory?slab=${encodeURIComponent(slab.uniqueSlabId)}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[11px] text-[var(--color-sodalite)] hover:text-[var(--color-vein)] hover:underline transition-colors"
                            title="Open material passport in Slabs"
                          >
                            Open passport →
                          </a>
                        </div>
                        <div className="text-right shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setQuotingSlab(slab);
                              setQuotePrice(selectedMaterial.retailPricePerSf?.toString() ?? '');
                              setQuoteError('');
                            }}
                            className="btn-primary !min-h-7 !px-2.5 text-[11px] opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Add to quote
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                  {selectedMaterial.availableSlabs.length > 8 && (
                    <p className="text-[12px] text-[var(--color-text-secondary)] text-center pt-2">
                      …and {selectedMaterial.availableSlabs.length - 8} more slabs available.{' '}
                      <a href="/inventory?status=AVAILABLE" className="text-[var(--color-sodalite)] hover:text-[var(--color-vein)] hover:underline">
                        View in Slabs →
                      </a>
                    </p>
                  )}
                </div>
              )}
            </div>
        )}
      </Drawer>

      {/* Quote Creation Modal */}
      <Modal
        open={!!quotingSlab && !!selectedMaterial}
        onClose={() => setQuotingSlab(null)}
        title="Create Sales Quote"
        subtitle={
          quotingSlab && selectedMaterial
            ? `${selectedMaterial.name} · ${quotingSlab.uniqueSlabId} (${quotingSlab.totalSf} sqft)`
            : undefined
        }
        width={440}
        footer={
          <>
            <Button variant="ghost" size="sm" type="button" onClick={() => setQuotingSlab(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              form="quote-form"
              disabled={isPending}
              className="!bg-[var(--color-emerald)] hover:!opacity-90"
            >
              {isPending ? 'Saving…' : 'Create Quote'}
            </Button>
          </>
        }
      >
        {quotingSlab && selectedMaterial && (
            <form id="quote-form" onSubmit={handleQuoteSubmit} className="space-y-4">
              <div className="bp-card p-3">
                <p className="bp-eyebrow mb-1">Selected material</p>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[14px] text-white font-medium">{selectedMaterial.name}</p>
                    <p className="text-[12px] text-[var(--color-sodalite)] bp-mono">
                      {quotingSlab.uniqueSlabId} ({quotingSlab.totalSf} sqft)
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-[var(--color-text-secondary)]">Retail</p>
                    <p className="text-[13px] text-white">${selectedMaterial.retailPricePerSf ?? '—'}/sqft</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1.5">Customer Name / Project</label>
                <input
                  type="text"
                  required
                  value={quoteCustomer}
                  onChange={(e) => setQuoteCustomer(e.target.value)}
                  className="bp-input"
                  placeholder="e.g. John Smith - Kitchen Remodel"
                />
              </div>

              <div>
                <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1.5">Quoted Price ($/sqft)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={quotePrice}
                  onChange={(e) => setQuotePrice(e.target.value)}
                  className="bp-input"
                />
              </div>

              {quoteError && (
                <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.25)] text-[var(--color-ruby)] text-[12px] px-3 py-2 rounded-[var(--radius-sm)]">
                  {quoteError}
                </div>
              )}

            </form>
        )}
      </Modal>
    </div>
  );
}
