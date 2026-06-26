'use client';

import React, { useState, useTransition } from 'react';
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
} from 'lucide-react';
import type { CatalogProduct, CatalogSlab } from '@/server/queries/catalog';
import { createQuoteAction } from '@/server/actions/sales';

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

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [openFilterMenu, setOpenFilterMenu] = useState<'type' | 'origin' | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedOrigins, setSelectedOrigins] = useState<string[]>([]);

  const uniqueTypes = Array.from(new Set(products.map((m) => m.materialType)));
  const uniqueOrigins = Array.from(new Set(products.map((m) => m.originCountry).filter(Boolean) as string[]));

  const toggleFilter = (setter: React.Dispatch<React.SetStateAction<string[]>>, val: string) => {
    setter((prev) => (prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]));
  };
  const removeFilter = (setter: React.Dispatch<React.SetStateAction<string[]>>, val: string) => {
    setter((prev) => prev.filter((v) => v !== val));
  };

  const filteredMaterials = products.filter((m) => {
    const matchSearch =
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.materialType.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = selectedTypes.length === 0 || selectedTypes.includes(m.materialType);
    const matchOrigin = selectedOrigins.length === 0 || (m.originCountry != null && selectedOrigins.includes(m.originCountry));
    return matchSearch && matchType && matchOrigin;
  });

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
              {selectedTypes.length + selectedOrigins.length > 0 && (
                <span className="bg-[#e3c16c] text-black text-[10px] px-1.5 rounded-sm ml-1 font-medium">
                  {selectedTypes.length + selectedOrigins.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Conditional Filter Bar */}
      {showFilters && (
        <div className="px-6 py-3 bg-[#1c1c1c] border-b border-[#454446] flex items-center gap-4 text-[13px]">
          <span className="text-[#b8b6b9]">Filter by:</span>
          <div className="relative">
            <button
              onClick={() => setOpenFilterMenu(openFilterMenu === 'type' ? null : 'type')}
              aria-expanded={openFilterMenu === 'type'}
              className="flex items-center gap-1 text-white hover:text-[#92b0ce] bg-[#333234] px-3 py-1 rounded border border-[#454446]"
            >
              Material Type {selectedTypes.length > 0 && <span className="text-[#e3c16c]">({selectedTypes.length})</span>} <ChevronDown size={14} />
            </button>
            {openFilterMenu === 'type' && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setOpenFilterMenu(null)} />
                <div className="absolute top-full mt-1 left-0 w-48 bg-[#1c1c1c] border border-[#454446] rounded shadow-xl z-50 p-2">
                  {uniqueTypes.map((type) => (
                    <label key={type} className="flex items-center gap-2 p-1.5 hover:bg-[#333234] rounded cursor-pointer text-white">
                      <input type="checkbox" checked={selectedTypes.includes(type)} onChange={() => toggleFilter(setSelectedTypes, type)} className="accent-[#e3c16c]" />
                      {type}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => setOpenFilterMenu(openFilterMenu === 'origin' ? null : 'origin')}
              aria-expanded={openFilterMenu === 'origin'}
              className="flex items-center gap-1 text-white hover:text-[#92b0ce] bg-[#333234] px-3 py-1 rounded border border-[#454446]"
            >
              Origin {selectedOrigins.length > 0 && <span className="text-[#e3c16c]">({selectedOrigins.length})</span>} <ChevronDown size={14} />
            </button>
            {openFilterMenu === 'origin' && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setOpenFilterMenu(null)} />
                <div className="absolute top-full mt-1 left-0 w-48 bg-[#1c1c1c] border border-[#454446] rounded shadow-xl z-50 p-2">
                  {uniqueOrigins.map((origin) => (
                    <label key={origin} className="flex items-center gap-2 p-1.5 hover:bg-[#333234] rounded cursor-pointer text-white">
                      <input type="checkbox" checked={selectedOrigins.includes(origin)} onChange={() => toggleFilter(setSelectedOrigins, origin)} className="accent-[#e3c16c]" />
                      {origin}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Active Filters Pill Bar */}
      {(selectedTypes.length > 0 || selectedOrigins.length > 0) && (
        <div className="px-6 py-2 bg-[#2b2a2c] border-b border-[#454446] flex gap-2 flex-wrap items-center">
          <span className="text-[12px] text-[#b8b6b9] mr-2">Active:</span>
          {selectedTypes.map((type) => (
            <span key={type} className="flex items-center gap-1 bg-[#454446] text-white px-2 py-0.5 rounded text-[12px]">
              {type} <X size={12} className="cursor-pointer hover:text-[#e3c16c]" onClick={() => removeFilter(setSelectedTypes, type)} />
            </span>
          ))}
          {selectedOrigins.map((origin) => (
            <span key={origin} className="flex items-center gap-1 bg-[#454446] text-white px-2 py-0.5 rounded text-[12px]">
              {origin} <X size={12} className="cursor-pointer hover:text-[#e3c16c]" onClick={() => removeFilter(setSelectedOrigins, origin)} />
            </span>
          ))}
          <button onClick={() => { setSelectedTypes([]); setSelectedOrigins([]); }} className="text-[12px] text-[#92b0ce] hover:underline ml-2">
            Clear All
          </button>
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

      {/* 2. Grid View */}
      <div className="flex-1 overflow-y-auto p-6">
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

      {/* 3. Slide-in Details Drawer */}
      {selectedMaterial && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 transition-opacity" onClick={() => setSelectedMaterial(null)} />
          <div className="fixed top-0 right-0 h-full w-[600px] bg-[#2b2a2c] border-l border-[#454446] shadow-2xl z-50 flex flex-col">
            <div className="px-6 py-5 border-b border-[#454446] bg-[#1c1c1c] flex justify-between items-start">
              <div>
                <h2 className="text-[20px] font-medium text-white flex items-center gap-2">{selectedMaterial.name}</h2>
                <div className="flex gap-2 mt-2 text-[12px] text-[#b8b6b9]">
                  <span className="bg-[#333234] border border-[#454446] px-2 py-0.5 rounded">{selectedMaterial.materialType}</span>
                  {selectedMaterial.originCountry && <span className="bg-[#333234] border border-[#454446] px-2 py-0.5 rounded">{selectedMaterial.originCountry}</span>}
                  <span className="bg-[#333234] border border-[#454446] px-2 py-0.5 rounded">{selectedMaterial.finish}</span>
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
                          <p className="text-[13px] text-white font-mono">{slab.uniqueSlabId}</p>
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
