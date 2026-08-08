import { Building2, Image as ImageIcon } from 'lucide-react';
import type { CatalogProduct, CatalogSlab } from '@/server/catalog/queries';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';

export function MaterialDetailDrawer({
  selectedMaterial,
  onClose,
  viewMode,
  canViewCost,
  onQuote,
}: {
  selectedMaterial: CatalogProduct | null;
  onClose: () => void;
  viewMode: 'ADMIN' | 'SALES';
  canViewCost: boolean;
  onQuote: (slab: CatalogSlab) => void;
}) {
  return (
    <Drawer
      open={!!selectedMaterial}
      onClose={onClose}
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
                        <Button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onQuote(slab);
                          }}
                          className="!min-h-7 !px-2.5 text-[11px] opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Add to quote
                        </Button>
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
  );
}
