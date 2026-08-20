import { useState, type FormEvent } from 'react';
import type { CatalogProduct, CatalogSlab } from '@/server/catalog/queries';
import type { QuoteCustomerRow } from '@/server/orders/queries';
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
  customers,
  quoteCustomerId,
  setQuoteCustomerId,
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
  customers: QuoteCustomerRow[];
  quoteCustomerId: string | null;
  setQuoteCustomerId: (v: string | null) => void;
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

  const [customerSearch, setCustomerSearch] = useState('');
  const selectedCustomer = customers.find((c) => c.id === quoteCustomerId) ?? null;
  const matches =
    !selectedCustomer && customerSearch.trim().length > 0
      ? customers.filter((c) => c.name.toLowerCase().includes(customerSearch.toLowerCase())).slice(0, 6)
      : [];
  const projectedExposure = selectedCustomer ? selectedCustomer.openExposure + total : 0;
  const overLimit =
    !!selectedCustomer &&
    !selectedCustomer.creditLockExempt &&
    selectedCustomer.creditLimit > 0 &&
    projectedExposure > selectedCustomer.creditLimit;

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
              <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1.5">Customer</label>
              {selectedCustomer ? (
                <div className="bp-card p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-white font-medium">{selectedCustomer.name}</span>
                    <button
                      type="button"
                      onClick={() => { setQuoteCustomerId(null); setCustomerSearch(''); }}
                      className="text-[11px] text-[var(--color-sodalite)] hover:underline"
                    >
                      Change
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--color-text-secondary)]">
                      {selectedCustomer.priorOrderCount > 0
                        ? `${selectedCustomer.priorOrderCount} prior order${selectedCustomer.priorOrderCount === 1 ? '' : 's'} · $${selectedCustomer.priorOrderTotal.toLocaleString()} lifetime`
                        : 'No completed orders yet'}
                    </span>
                    {selectedCustomer.creditLimit > 0 && !selectedCustomer.creditLockExempt && (
                      <span className={overLimit ? 'text-[var(--color-ruby)]' : 'text-[var(--color-text-secondary)]'}>
                        ${Math.round(selectedCustomer.openExposure).toLocaleString()} open / ${selectedCustomer.creditLimit.toLocaleString()} limit
                      </span>
                    )}
                  </div>
                  {selectedCustomer.salesLockNote && (
                    <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.25)] text-[var(--color-ruby)] text-[11px] px-2.5 py-1.5 rounded-[var(--radius-sm)]">
                      {selectedCustomer.salesLockNote}
                    </div>
                  )}
                  {!selectedCustomer.salesLockNote && overLimit && (
                    <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.25)] text-[var(--color-ruby)] text-[11px] px-2.5 py-1.5 rounded-[var(--radius-sm)]">
                      This quote would put {selectedCustomer.name} over their credit limit.
                    </div>
                  )}
                  {!selectedCustomer.salesLockNote && !overLimit && selectedCustomer.salesAlertNote && (
                    <div className="bg-[rgba(234,179,8,0.1)] border border-[rgba(234,179,8,0.25)] text-[var(--color-coral)] text-[11px] px-2.5 py-1.5 rounded-[var(--radius-sm)]">
                      {selectedCustomer.salesAlertNote}
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="bp-input"
                    placeholder="Search customers…"
                    autoComplete="off"
                  />
                  {matches.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bp-card p-1 max-h-48 overflow-y-auto">
                      {matches.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { setQuoteCustomerId(c.id); setCustomerSearch(''); }}
                          className="w-full text-left px-2.5 py-1.5 rounded-[var(--radius-sm)] text-[13px] text-white hover:bg-[var(--color-basalt-700)]"
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1.5">
                Project / Notes {selectedCustomer ? '(optional)' : ''}
              </label>
              <input
                type="text"
                required={!selectedCustomer}
                value={quoteCustomer}
                onChange={(e) => setQuoteCustomer(e.target.value)}
                className="bp-input"
                placeholder="e.g. Kitchen Remodel"
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
