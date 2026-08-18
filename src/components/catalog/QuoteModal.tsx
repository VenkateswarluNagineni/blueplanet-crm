import type { FormEvent } from 'react';
import type { CatalogProduct, CatalogSlab } from '@/server/catalog/queries';
import { EDGE_PROFILES } from '@/lib/domain/reference';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

export function QuoteModal({
  quotingSlab,
  selectedMaterial,
  onClose,
  quotePrice,
  setQuotePrice,
  quoteCustomer,
  setQuoteCustomer,
  edgeProfile,
  setEdgeProfile,
  edgeUpcharge,
  setEdgeUpcharge,
  cutoutCount,
  setCutoutCount,
  cutoutUpcharge,
  setCutoutUpcharge,
  quoteError,
  isPending,
  onSubmit,
}: {
  quotingSlab: CatalogSlab | null;
  selectedMaterial: CatalogProduct | null;
  onClose: () => void;
  quotePrice: string;
  setQuotePrice: (v: string) => void;
  quoteCustomer: string;
  setQuoteCustomer: (v: string) => void;
  edgeProfile: string;
  setEdgeProfile: (v: string) => void;
  edgeUpcharge: string;
  setEdgeUpcharge: (v: string) => void;
  cutoutCount: string;
  setCutoutCount: (v: string) => void;
  cutoutUpcharge: string;
  setCutoutUpcharge: (v: string) => void;
  quoteError: string;
  isPending: boolean;
  onSubmit: (e: FormEvent) => void;
}) {
  const sf = quotingSlab?.totalSf ?? 0;
  const base = parseFloat(quotePrice) || 0;
  const edgeAdd = parseFloat(edgeUpcharge) || 0;
  const cutoutN = parseInt(cutoutCount, 10) || 0;
  const cutoutEach = parseFloat(cutoutUpcharge) || 0;
  const total = (base + edgeAdd) * sf + cutoutN * cutoutEach;

  return (
    <Modal
      open={!!quotingSlab && !!selectedMaterial}
      onClose={onClose}
      title="Create Sales Quote"
      subtitle={
        quotingSlab && selectedMaterial
          ? `${selectedMaterial.name} · ${quotingSlab.uniqueSlabId} (${quotingSlab.totalSf} sqft)`
          : undefined
      }
      width={480}
      footer={
        <>
          <Button variant="ghost" size="sm" type="button" onClick={onClose}>
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
          <form id="quote-form" onSubmit={onSubmit} className="space-y-4">
            <div className="bp-card p-3">
              <p className="bp-eyebrow mb-1">Selected material</p>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[14px] text-white font-medium">{selectedMaterial.name}</p>
                  <p className="text-[12px] text-[var(--color-sodalite)] bp-mono">
                    {quotingSlab.uniqueSlabId} (<span className="bp-mono">{quotingSlab.totalSf}</span> sqft)
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-[var(--color-text-secondary)]">Retail</p>
                  <p className="text-[13px] text-white bp-mono">${selectedMaterial.retailPricePerSf ?? '—'}/sqft</p>
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
                className="bp-input bp-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1.5">Edge Profile</label>
                <select value={edgeProfile} onChange={(e) => setEdgeProfile(e.target.value)} className="bp-select">
                  <option value="">— None —</option>
                  {EDGE_PROFILES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1.5">Edge Upcharge ($/sf)</label>
                <input type="number" step="0.01" min="0" value={edgeUpcharge} onChange={(e) => setEdgeUpcharge(e.target.value)} className="bp-input bp-mono" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1.5">Cutouts</label>
                <input type="number" step="1" min="0" value={cutoutCount} onChange={(e) => setCutoutCount(e.target.value)} className="bp-input bp-mono" placeholder="0" />
              </div>
              <div>
                <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1.5">Cutout Upcharge ($ each)</label>
                <input type="number" step="0.01" min="0" value={cutoutUpcharge} onChange={(e) => setCutoutUpcharge(e.target.value)} className="bp-input bp-mono" placeholder="0.00" />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[var(--color-basalt-500)]">
              <span className="text-[12px] text-[var(--color-text-secondary)]">Line total</span>
              <span className="text-[16px] text-[var(--color-vein)] font-medium bp-mono">
                ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {quoteError && (
              <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.25)] text-[var(--color-ruby)] text-[12px] px-3 py-2 rounded-[var(--radius-sm)]">
                {quoteError}
              </div>
            )}

          </form>
      )}
    </Modal>
  );
}
