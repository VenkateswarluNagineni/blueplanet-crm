'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Trophy, Ban, RotateCcw, FileOutput, ExternalLink } from 'lucide-react';
import type { OppItem, QuotableSlab } from '@/server/pipeline/queries';
import {
  createOpportunityAction,
  setOpportunityStatusAction,
  convertOpportunityToOrderAction,
} from '@/server/pipeline/actions';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { swatchBaseForMaterial } from '@/lib/domain/material-swatch';

const STAGES: { key: string; label: string; color: string }[] = [
  { key: 'LEAD', label: 'Lead', color: '#b8b6b9' },
  { key: 'QUOTED', label: 'Quoted', color: '#92b0ce' },
  { key: 'NEGOTIATION', label: 'Negotiation', color: '#e3c16c' },
  { key: 'CLOSED_WON', label: 'Closed Won', color: '#10b981' },
  { key: 'CLOSED_LOST', label: 'Closed Lost', color: '#ef4444' },
];

function DealCard({
  o,
  isPending,
  onMove,
  onConvert,
}: {
  o: OppItem;
  isPending: boolean;
  onMove: (id: string, status: string) => void;
  onConvert: (o: OppItem) => void;
}) {
  const swatch = o.materialType
    ? swatchBaseForMaterial(o.materialType, o.baseColor)
    : null;
  const lost = o.status === 'CLOSED_LOST';
  const won = o.status === 'CLOSED_WON';
  const open = !won && !lost;

  return (
    <div
      className={`bp-kanban-card ${lost ? 'border-[rgba(239,68,68,0.35)]' : ''}`}
      style={
        lost
          ? { boxShadow: 'inset 3px 0 0 0 var(--color-ruby)' }
          : won
            ? { boxShadow: 'inset 3px 0 0 0 var(--color-emerald)' }
            : undefined
      }
    >
      <div className="flex items-start gap-2.5 mb-2">
        {swatch ? (
          <div
            className="bp-swatch shrink-0 mt-0.5"
            style={{ ['--swatch-base' as string]: swatch, width: 22, height: 22 }}
            aria-hidden
            title={o.materialName ?? o.materialType ?? undefined}
          />
        ) : (
          <span
            className="w-[22px] h-[22px] rounded-[4px] border border-[var(--color-basalt-500)] bg-[var(--color-basalt-800)] shrink-0 mt-0.5"
            aria-hidden
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-white font-medium leading-snug">{o.name}</p>
          {o.materialName && (
            <p className="text-[11px] text-[var(--color-sodalite)] mt-0.5 truncate" title={o.materialName}>
              {o.materialName}
              {o.materialType ? ` · ${o.materialType}` : ''}
            </p>
          )}
        </div>
      </div>
      <p className="text-[11px] text-[var(--color-text-secondary)] mb-1.5 truncate">{o.customerLabel}</p>
      <p
        className="text-[15px] text-[var(--color-emerald)] font-medium bp-mono mb-2.5"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        ${o.amount.toLocaleString()}
      </p>
      {open && (
        <div className="flex items-center gap-2 mb-2.5">
          <div className="h-1.5 flex-1 bg-[var(--color-basalt-500)] rounded-full overflow-hidden">
            <div
              className={`h-full ${o.probability < 30 ? 'bg-[var(--color-coral)]' : 'bg-[var(--color-emerald)]'}`}
              style={{ width: `${o.probability}%` }}
            />
          </div>
          <span className="text-[10px] text-[var(--color-text-secondary)] bp-mono tabular-nums">
            {o.probability}%
          </span>
        </div>
      )}
      <div className="flex items-center gap-1.5 flex-wrap mb-2 min-h-[18px]">
        {open && o.probability >= 70 && (
          <span className="inline-block bg-[rgba(16,185,129,0.1)] text-[var(--color-emerald)] border border-[rgba(16,185,129,0.25)] px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-[0.08em]">
            High confidence
          </span>
        )}
        {open && o.probability < 30 && (
          <span className="inline-block bg-[rgba(232,149,107,0.1)] text-[var(--color-coral)] border border-[rgba(232,149,107,0.25)] px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-[0.08em]">
            At risk
          </span>
        )}
        {lost && (
          <span className="inline-block bg-[rgba(239,68,68,0.1)] text-[var(--color-ruby)] border border-[rgba(239,68,68,0.25)] px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-[0.08em]">
            Closed lost
          </span>
        )}
      </div>
      <div className="flex items-center justify-between text-[10px] text-[var(--color-text-secondary)] mb-2">
        <span className="truncate">{o.associateName}</span>
        {o.expectedClose && <span className="shrink-0">{o.expectedClose}</span>}
      </div>
      {open && (
        <div className="flex items-center gap-1.5 pt-2 border-t border-[var(--color-basalt-500)]">
          <select
            value={o.status}
            disabled={isPending}
            onChange={(e) => onMove(o.id, e.target.value)}
            className="flex-1 bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded text-[11px] text-white px-1.5 py-1 outline-none focus:border-[var(--color-sodalite)]"
            aria-label={`Stage for ${o.name}`}
          >
            {STAGES.filter((s) => s.key !== 'CLOSED_WON' && s.key !== 'CLOSED_LOST').map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            title="Mark won"
            disabled={isPending}
            onClick={() => onMove(o.id, 'CLOSED_WON')}
            className="p-1.5 rounded bg-[var(--color-emerald)]/10 text-[var(--color-emerald)] hover:bg-[var(--color-emerald)]/20 transition-colors"
          >
            <Trophy size={12} />
          </button>
          <button
            type="button"
            title="Mark lost"
            disabled={isPending}
            onClick={() => onMove(o.id, 'CLOSED_LOST')}
            className="p-1.5 rounded bg-[rgba(239,68,68,0.1)] text-[var(--color-ruby)] hover:bg-[rgba(239,68,68,0.2)] transition-colors"
          >
            <Ban size={12} />
          </button>
        </div>
      )}
      {(won || lost) && (
        <div className="flex items-center gap-1.5 pt-2 border-t border-[var(--color-basalt-500)]">
          <button
            type="button"
            title="Reopen this deal back to Negotiation"
            disabled={isPending}
            onClick={() => onMove(o.id, 'NEGOTIATION')}
            className="flex-1 flex items-center justify-center gap-1 bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded text-[11px] text-[var(--color-text-secondary)] hover:text-white hover:border-[var(--color-sodalite)] px-1.5 py-1 transition-colors"
          >
            <RotateCcw size={11} /> Reopen
          </button>
          {won && (
            <button
              type="button"
              title="Convert this won deal into a sales order"
              disabled={isPending}
              onClick={() => onConvert(o)}
              className="flex-1 flex items-center justify-center gap-1 bg-[var(--color-emerald)]/10 border border-[rgba(16,185,129,0.30)] rounded text-[11px] text-[var(--color-emerald)] hover:bg-[var(--color-emerald)]/20 px-1.5 py-1 transition-colors"
            >
              <FileOutput size={11} /> To Order
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function PipelineClient({
  opportunities,
  associates,
  quotableSlabs,
}: {
  opportunities: OppItem[];
  associates: { id: string; name: string }[];
  quotableSlabs: QuotableSlab[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState('');
  const [convertOpp, setConvertOpp] = useState<OppItem | null>(null);
  const [convertSlabId, setConvertSlabId] = useState('');
  const [convertPrice, setConvertPrice] = useState('');

  const move = (id: string, status: string) => {
    setError('');
    startTransition(async () => {
      const res = await setOpportunityStatusAction(id, status);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  };

  const openConvert = (o: OppItem) => {
    setConvertOpp(o);
    setConvertSlabId('');
    setConvertPrice('');
    setError('');
  };

  const handleConvert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertOpp) return;
    setError('');
    startTransition(async () => {
      const res = await convertOpportunityToOrderAction({
        opportunityId: convertOpp.id,
        slabId: convertSlabId,
        pricePerSf: Number(convertPrice),
      });
      if (!res.ok) { setError(res.error); return; }
      setConvertOpp(null);
      if (res.soNumber) {
        router.push(`/orders?order=${encodeURIComponent(res.soNumber)}`);
        return;
      }
      router.refresh();
    });
  };

  const selectedSlab = quotableSlabs.find((s) => s.id === convertSlabId);

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError('');
    startTransition(async () => {
      const res = await createOpportunityAction({
        name: String(fd.get('name') || ''),
        leadName: String(fd.get('leadName') || '') || undefined,
        amount: Number(fd.get('amount') || 0),
        probability: Number(fd.get('probability') || 0),
        associateId: String(fd.get('associateId') || '') || undefined,
        expectedClose: String(fd.get('expectedClose') || '') || undefined,
      });
      if (!res.ok) { setError(res.error); return; }
      setAddOpen(false);
      router.refresh();
    });
  };

  const totalOpen = opportunities
    .filter((o) => o.status !== 'CLOSED_WON' && o.status !== 'CLOSED_LOST')
    .reduce((s, o) => s + o.amount, 0);

  const openCount = opportunities.filter(
    (o) => o.status !== 'CLOSED_WON' && o.status !== 'CLOSED_LOST',
  ).length;

  return (
    <PageShell
      flush
      header={
        <PageHeader
          eyebrow="Sales"
          title="Pipeline"
          subtitle={
            <>
              Open pipeline value:{' '}
              <span className="text-[var(--color-emerald)] font-medium">${totalOpen.toLocaleString()}</span>
            </>
          }
          meta={[
            { label: `${openCount} open deals`, tone: 'blue' },
            { label: `$${totalOpen.toLocaleString()} value`, tone: 'green' },
          ]}
          actions={
            <div className="flex items-center gap-2">
              <Link
                href="/orders"
                className="hidden sm:inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text-secondary)] hover:text-white border border-[var(--color-basalt-500)] rounded-lg px-2.5 py-1.5 transition-colors"
              >
                Orders <ExternalLink size={12} />
              </Link>
              <Link
                href="/crm"
                className="hidden sm:inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text-secondary)] hover:text-white border border-[var(--color-basalt-500)] rounded-lg px-2.5 py-1.5 transition-colors"
              >
                People <ExternalLink size={12} />
              </Link>
              <button
                onClick={() => { setAddOpen(true); setError(''); }}
                className="btn-primary flex items-center gap-2"
              >
                <Plus size={16} /> New Opportunity
              </button>
            </div>
          }
        />
      }
    >

      {error && (
        <div className="mx-6 mt-3 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.25)] text-[var(--color-ruby)] text-[12px] px-3 py-2 rounded-[var(--radius-sm)]">
          {error}
        </div>
      )}

      {(() => {
        const openDeals = opportunities.filter(
          (o) => o.status !== 'CLOSED_WON' && o.status !== 'CLOSED_LOST',
        );
        const weightedYield = openDeals.reduce(
          (sum, o) => sum + o.amount * (o.probability / 100),
          0,
        );
        const atRisk = openDeals.filter((o) => o.probability < 30).length;
        return (
          <div className="mx-6 mt-4 bp-attention">
            <div className="bp-attention-header">
              <span className="bp-eyebrow">Pipeline</span>
            </div>
            <div className="px-4 py-3 flex flex-wrap items-center gap-x-8 gap-y-2 text-[12px] text-[var(--color-text-secondary)]">
              <div>
                Weighted value{' '}
                <strong
                  className="text-white bp-mono text-[15px] ml-1"
                  style={{ fontFamily: 'var(--font-heading)' }}
                >
                  ${Math.round(weightedYield).toLocaleString()}
                </strong>
              </div>
              {atRisk > 0 && (
                <>
                  <div className="hidden sm:block w-px h-4 bg-[var(--color-basalt-500)]" />
                  <div>
                    At risk{' '}
                    <strong className="text-[var(--color-coral)] ml-1">{atRisk}</strong>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-5 gap-5 min-w-[1100px]">
          {STAGES.map((stage) => {
            const items = opportunities.filter((o) => o.status === stage.key);
            const colTotal = items.reduce((s, o) => s + o.amount, 0);
            return (
              <div key={stage.key} className="bp-kanban-col">
                <div className="px-4 py-3 border-b border-[var(--color-basalt-500)] flex items-center justify-between bg-[var(--color-basalt-700)]/40 rounded-t-[var(--radius-xl)]">
                  <span
                    className="text-[12px] font-medium flex items-center gap-2"
                    style={{ color: stage.color }}
                  >
                    <span
                      className="w-2 h-2 rounded-full shadow-sm"
                      style={{ background: stage.color }}
                    />{' '}
                    {stage.label}
                  </span>
                  <span className="text-[11px] text-[var(--color-text-secondary)] bp-mono bg-[var(--color-basalt-800)] px-2 py-0.5 rounded-full border border-[var(--color-basalt-500)]">
                    {items.length}
                  </span>
                </div>
                <div className="p-3 space-y-3 flex-1 min-h-[140px]">
                  {items.length === 0 ? (
                    stage.key === 'LEAD' ? (
                      <div className="py-4 px-1 text-center">
                        <p className="text-[11px] text-[var(--color-text-secondary)] mb-3">
                          No leads yet
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setAddOpen(true);
                            setError('');
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-vein)] hover:text-white border border-[rgba(227,193,108,0.4)] rounded-[var(--radius-sm)] px-2.5 py-1.5 transition-colors"
                        >
                          <Plus size={12} /> Add opportunity
                        </button>
                      </div>
                    ) : stage.key === 'CLOSED_WON' ? (
                      <p className="text-[11px] text-[var(--color-fog-500)] text-center py-6 px-2 leading-relaxed">
                        Won deals appear here — convert to an order when ready.
                      </p>
                    ) : stage.key === 'CLOSED_LOST' ? (
                      <p className="text-[11px] text-[var(--color-fog-500)] text-center py-6 px-2 leading-relaxed">
                        Lost deals land here for review.
                      </p>
                    ) : (
                      <p className="text-[11px] text-[var(--color-fog-500)] text-center py-8">
                        Empty stage
                      </p>
                    )
                  ) : (
                    items.map((o) => (
                      <DealCard
                        key={o.id}
                        o={o}
                        isPending={isPending}
                        onMove={move}
                        onConvert={openConvert}
                      />
                    ))
                  )}
                </div>
                <div className="px-3 py-2 border-t border-[var(--color-basalt-500)] text-[11px] text-[var(--color-text-secondary)] bp-mono">
                  ${colTotal.toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Modal
        open={!!convertOpp}
        onClose={() => setConvertOpp(null)}
        title="Convert to Sales Order"
        subtitle={
          convertOpp
            ? `Won deal ${convertOpp.name} · ${convertOpp.customerLabel} · forecast $${convertOpp.amount.toLocaleString()}`
            : undefined
        }
        width={440}
        footer={
          <>
            <Button variant="ghost" size="sm" type="button" onClick={() => setConvertOpp(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              form="convert-order-form"
              disabled={isPending || !convertSlabId}
              className="!bg-[var(--color-emerald)] hover:!opacity-90"
            >
              {isPending ? 'Creating…' : 'Create Order'}
            </Button>
          </>
        }
      >
        <form id="convert-order-form" onSubmit={handleConvert} className="space-y-4">
          <div>
            <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1.5">Allocate slab</label>
            <select
              required
              value={convertSlabId}
              onChange={(e) => {
                const s = quotableSlabs.find((q) => q.id === e.target.value);
                setConvertSlabId(e.target.value);
                if (s && !convertPrice) setConvertPrice(String(s.retailPricePerSf || s.minPricePerSf || ''));
              }}
              className="bp-select w-full"
            >
              <option value="">{quotableSlabs.length ? 'Select an available slab…' : 'No available slabs'}</option>
              {quotableSlabs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.uniqueSlabId} — {s.productName} ({s.sqft} sqft)
                </option>
              ))}
            </select>
            {selectedSlab && (
              <div className="mt-2 flex items-center gap-2 text-[12px] text-[var(--color-text-secondary)]">
                <div
                  className="bp-swatch shrink-0"
                  style={{
                    ['--swatch-base' as string]: swatchBaseForMaterial(
                      selectedSlab.materialType,
                      selectedSlab.baseColor,
                    ),
                    width: 18,
                    height: 18,
                  }}
                  aria-hidden
                />
                <span className="text-white truncate">{selectedSlab.productName}</span>
                <span className="text-[var(--color-fog-500)]">· {selectedSlab.materialType}</span>
              </div>
            )}
          </div>
          <div>
            <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1.5">
              Price / sqft{' '}
              {selectedSlab && (
                <span className="text-[var(--color-fog-500)]">(min ${selectedSlab.minPricePerSf})</span>
              )}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={convertPrice}
              onChange={(e) => setConvertPrice(e.target.value)}
              className="bp-input"
            />
          </div>
          {selectedSlab && convertPrice && (
            <p className="text-[12px] text-[var(--color-emerald)]">
              Order value: $
              {(selectedSlab.sqft * Number(convertPrice)).toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}
            </p>
          )}
          {error && (
            <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.25)] text-[var(--color-ruby)] text-[12px] px-3 py-2 rounded-[var(--radius-sm)]">
              {error}
            </div>
          )}
        </form>
      </Modal>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="New Opportunity"
        subtitle="Add a deal to the board."
        width={440}
        footer={
          <>
            <Button variant="ghost" size="sm" type="button" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" form="add-opp-form" disabled={isPending}>
              {isPending ? 'Creating…' : 'Create'}
            </Button>
          </>
        }
      >
        <form id="add-opp-form" onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1.5">Opportunity Name</label>
            <input name="name" required className="bp-input" placeholder="e.g. Marriott Downtown Reno" />
          </div>
          <div>
            <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1.5">Lead / Customer</label>
            <input name="leadName" className="bp-input" placeholder="e.g. Marriott Group" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1.5">Amount ($)</label>
              <input name="amount" type="number" min="0" required className="bp-input" />
            </div>
            <div>
              <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1.5">Probability (%)</label>
              <input name="probability" type="number" min="0" max="100" defaultValue={20} required className="bp-input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1.5">Associate</label>
              <select name="associateId" className="bp-select w-full">
                <option value="">Unassigned</option>
                {associates.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1.5">Expected Close</label>
              <input name="expectedClose" type="date" className="bp-input [color-scheme:dark]" />
            </div>
          </div>
          {error && (
            <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.25)] text-[var(--color-ruby)] text-[12px] px-3 py-2 rounded-[var(--radius-sm)]">
              {error}
            </div>
          )}
        </form>
      </Modal>
    </PageShell>
  );
}
