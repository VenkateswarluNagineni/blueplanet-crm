import type { FormEvent } from 'react';
import type { CatalogProduct, CatalogSlab } from '@/server/catalog/queries';
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
  quoteError: string;
  isPending: boolean;
  onSubmit: (e: FormEvent) => void;
}) {
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
      width={440}
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
  );
}
