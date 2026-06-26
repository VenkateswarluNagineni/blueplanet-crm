'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Target, Trophy, Ban, RotateCcw, FileOutput } from 'lucide-react';
import type { OppItem, QuotableSlab } from '@/server/queries/pipeline';
import {
  createOpportunityAction,
  setOpportunityStatusAction,
  convertOpportunityToOrderAction,
} from '@/server/actions/pipeline';

const STAGES: { key: string; label: string; color: string }[] = [
  { key: 'LEAD', label: 'Lead', color: '#b8b6b9' },
  { key: 'QUOTED', label: 'Quoted', color: '#92b0ce' },
  { key: 'NEGOTIATION', label: 'Negotiation', color: '#e3c16c' },
  { key: 'CLOSED_WON', label: 'Closed Won', color: '#10b981' },
  { key: 'CLOSED_LOST', label: 'Closed Lost', color: '#e06c6c' },
];

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

  return (
    <div className="h-full w-full flex flex-col bg-[#2b2a2c] text-[#d9d8d9]">
      <div className="pt-6 pb-4 px-6 border-b border-[#454446] shrink-0 bg-[#1c1c1c] flex justify-between items-end">
        <div>
          <h1 className="text-[20px] font-medium text-white mb-1">Sales Pipeline</h1>
          <p className="text-[13px] text-[#b8b6b9]">Open pipeline value: <span className="text-[#10b981] font-medium">${totalOpen.toLocaleString()}</span></p>
        </div>
        <button onClick={() => { setAddOpen(true); setError(''); }} className="px-4 py-2 bg-[#e3c16c] text-black font-medium text-[13px] rounded hover:bg-[#d2ac55] transition-colors flex items-center gap-2">
          <Plus size={16} /> New Opportunity
        </button>
      </div>

      {error && <div className="mx-6 mt-3 bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] px-3 py-2 rounded">{error}</div>}

      {/* AI Deal Projection Waterfall Banner */}
      {(() => {
        const openDeals = opportunities.filter(o => o.status !== 'CLOSED_WON' && o.status !== 'CLOSED_LOST');
        const weightedYield = openDeals.reduce((sum, o) => sum + (o.amount * (o.probability / 100)), 0);
        const estCommission = weightedYield * 0.045;
        return (
          <div className="mx-6 mt-4 bg-[#333234] border border-[#454446] p-4 rounded-xl flex items-center justify-between text-[#d9d8d9] shadow-md">
            <div className="flex items-center gap-6 text-[12px]">
              <div className="flex items-center gap-2.5">
                <span className="px-2 py-0.5 bg-[#b58cd6]/20 text-[#b58cd6] border border-[#b58cd6]/30 font-bold text-[10px] rounded-full uppercase tracking-wider">AI Propensity Engine</span>
                <span>Weighted Yield Forecast: <strong className="text-white font-mono">${Math.round(weightedYield).toLocaleString()}</strong></span>
              </div>
              <div className="w-px h-4 bg-[#454446]" />
              <div>Projected Commission Pool: <strong className="text-[#10b981] font-mono">${estCommission.toFixed(2)}</strong></div>
            </div>
            <div className="text-[11px] text-[#b8b6b9]">Calculated dynamically across {openDeals.length} open negotiation pipelines</div>
          </div>
        );
      })()}

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-5 gap-5 min-w-[1100px]">
          {STAGES.map((stage) => {
            const items = opportunities.filter((o) => o.status === stage.key);
            const colTotal = items.reduce((s, o) => s + o.amount, 0);
            return (
              <div key={stage.key} className="bg-[#1c1c1c] border border-[#454446] rounded-xl flex flex-col shadow-md">
                <div className="px-4 py-3 border-b border-[#454446] flex items-center justify-between bg-[#333234]/40 rounded-t-xl">
                  <span className="text-[12px] font-medium flex items-center gap-2" style={{ color: stage.color }}>
                    <span className="w-2 h-2 rounded-full shadow-sm" style={{ background: stage.color }} /> {stage.label}
                  </span>
                  <span className="text-[11px] text-[#b8b6b9] font-mono bg-[#2b2a2c] px-2 py-0.5 rounded-full border border-[#454446]">{items.length}</span>
                </div>
                <div className="p-3 space-y-3 flex-1 min-h-[120px]">
                  {items.length === 0 ? (
                    <p className="text-[11px] text-[#b8b6b9] text-center py-8 italic">Empty</p>
                  ) : (
                    items.map((o) => (
                      <div key={o.id} className="bg-[#2b2a2c] border border-[#454446] rounded-xl p-4 hover:border-[#92b0ce] transition-all duration-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5">
                        <div className="flex items-start gap-2.5 mb-2.5">
                          <Target size={14} className="text-[#b8b6b9] mt-0.5 shrink-0" />
                          <p className="text-[13px] text-white font-medium leading-snug">{o.name}</p>
                        </div>
                        <p className="text-[11px] text-[#b8b6b9] mb-1.5 truncate">{o.customerLabel}</p>
                        <p className="text-[15px] text-[#10b981] font-medium font-mono mb-3">${o.amount.toLocaleString()}</p>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="h-1.5 flex-1 bg-[#454446] rounded-full overflow-hidden"><div className="h-full bg-[#10b981]" style={{ width: `${o.probability}%` }} /></div>
                          <span className="text-[10px] text-[#b8b6b9] font-mono tabular-nums">{o.probability}%</span>
                        </div>
                        <div className="mb-3">
                          {o.probability >= 70 && (
                            <span className="inline-block bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">
                              🚀 High Win Propensity
                            </span>
                          )}
                          {o.probability < 30 && o.status !== 'CLOSED_LOST' && (
                            <span className="inline-block bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">
                              ⚠ Stalemate Risk
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-[#b8b6b9] mb-2">
                          <span>{o.associateName}</span>
                          {o.expectedClose && <span>{o.expectedClose}</span>}
                        </div>
                        {o.status !== 'CLOSED_WON' && o.status !== 'CLOSED_LOST' && (
                          <div className="flex items-center gap-1.5 pt-2 border-t border-[#454446]">
                            <select
                              value={o.status}
                              disabled={isPending}
                              onChange={(e) => move(o.id, e.target.value)}
                              className="flex-1 bg-[#1c1c1c] border border-[#454446] rounded text-[11px] text-white px-1.5 py-1 outline-none focus:border-[#92b0ce]"
                            >
                              {STAGES.filter((s) => s.key !== 'CLOSED_WON' && s.key !== 'CLOSED_LOST').map((s) => (
                                <option key={s.key} value={s.key}>{s.label}</option>
                              ))}
                            </select>
                            <button title="Mark Won" disabled={isPending} onClick={() => move(o.id, 'CLOSED_WON')} className="p-1.5 rounded bg-[#10b981]/10 text-[#10b981] hover:bg-[#10b981]/20 transition-colors"><Trophy size={12} /></button>
                            <button title="Mark Lost" disabled={isPending} onClick={() => move(o.id, 'CLOSED_LOST')} className="p-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"><Ban size={12} /></button>
                          </div>
                        )}
                        {(o.status === 'CLOSED_WON' || o.status === 'CLOSED_LOST') && (
                          <div className="flex items-center gap-1.5 pt-2 border-t border-[#454446]">
                            <button
                              title="Reopen this deal back to Negotiation"
                              disabled={isPending}
                              onClick={() => move(o.id, 'NEGOTIATION')}
                              className="flex-1 flex items-center justify-center gap-1 bg-[#1c1c1c] border border-[#454446] rounded text-[11px] text-[#b8b6b9] hover:text-white hover:border-[#92b0ce] px-1.5 py-1 transition-colors"
                            >
                              <RotateCcw size={11} /> Reopen
                            </button>
                            {o.status === 'CLOSED_WON' && (
                              <button
                                title="Convert this won deal into a sales order"
                                disabled={isPending}
                                onClick={() => openConvert(o)}
                                className="flex-1 flex items-center justify-center gap-1 bg-[#10b981]/10 border border-[#10b981]/30 rounded text-[11px] text-[#10b981] hover:bg-[#10b981]/20 px-1.5 py-1 transition-colors"
                              >
                                <FileOutput size={11} /> To Order
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
                <div className="px-3 py-2 border-t border-[#454446] text-[11px] text-[#b8b6b9]">${colTotal.toLocaleString()}</div>
              </div>
            );
          })}
        </div>
      </div>

      {convertOpp && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
          <form onSubmit={handleConvert} className="bg-[#2b2a2c] border border-[#454446] rounded-lg w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#454446] bg-[#1c1c1c] flex justify-between items-center">
              <h3 className="text-white font-medium">Convert to Sales Order</h3>
              <button type="button" onClick={() => setConvertOpp(null)} className="text-[#b8b6b9] hover:text-white transition-colors"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-[12px] text-[#b8b6b9]">
                Won deal <span className="text-white font-medium">{convertOpp.name}</span> · {convertOpp.customerLabel} · forecast ${convertOpp.amount.toLocaleString()}
              </p>
              <div>
                <label className="block text-[12px] text-[#b8b6b9] mb-1.5">Allocate Slab</label>
                <select
                  required
                  value={convertSlabId}
                  onChange={(e) => {
                    const s = quotableSlabs.find((q) => q.id === e.target.value);
                    setConvertSlabId(e.target.value);
                    if (s && !convertPrice) setConvertPrice(String(s.retailPricePerSf || s.minPricePerSf || ''));
                  }}
                  className="w-full bg-[#1c1c1c] border border-[#454446] rounded px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[#92b0ce]"
                >
                  <option value="">{quotableSlabs.length ? 'Select an available slab…' : 'No available slabs'}</option>
                  {quotableSlabs.map((s) => (
                    <option key={s.id} value={s.id}>{s.uniqueSlabId} — {s.productName} ({s.sqft} sqft)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] text-[#b8b6b9] mb-1.5">
                  Price / sqft {selectedSlab && <span className="text-[#b8b6b9]">(min ${selectedSlab.minPricePerSf})</span>}
                </label>
                <input
                  type="number" min="0" step="0.01" required
                  value={convertPrice}
                  onChange={(e) => setConvertPrice(e.target.value)}
                  className="w-full bg-[#1c1c1c] border border-[#454446] rounded px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[#92b0ce]"
                />
              </div>
              {selectedSlab && convertPrice && (
                <p className="text-[12px] text-[#10b981]">Order value: ${(selectedSlab.sqft * Number(convertPrice)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
              )}
              {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] px-3 py-2 rounded">{error}</div>}
            </div>
            <div className="px-6 py-4 border-t border-[#454446] flex justify-end gap-3">
              <button type="button" onClick={() => setConvertOpp(null)} className="px-4 py-2 text-[13px] text-[#b8b6b9] hover:text-white transition-colors">Cancel</button>
              <button type="submit" disabled={isPending || !convertSlabId} className="px-4 py-2 text-[13px] bg-[#10b981] text-black font-medium rounded hover:bg-[#059669] transition-colors disabled:opacity-60">{isPending ? 'Creating…' : 'Create Order'}</button>
            </div>
          </form>
        </div>
      )}

      {addOpen && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
          <form onSubmit={handleAdd} className="bg-[#2b2a2c] border border-[#454446] rounded-lg w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#454446] bg-[#1c1c1c] flex justify-between items-center">
              <h3 className="text-white font-medium">New Opportunity</h3>
              <button type="button" onClick={() => setAddOpen(false)} className="text-[#b8b6b9] hover:text-white transition-colors"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="block text-[12px] text-[#b8b6b9] mb-1.5">Opportunity Name</label><input name="name" required className="w-full bg-[#1c1c1c] border border-[#454446] rounded px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[#92b0ce]" placeholder="e.g. Marriott Downtown Reno" /></div>
              <div><label className="block text-[12px] text-[#b8b6b9] mb-1.5">Lead / Customer</label><input name="leadName" className="w-full bg-[#1c1c1c] border border-[#454446] rounded px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[#92b0ce]" placeholder="e.g. Marriott Group" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-[12px] text-[#b8b6b9] mb-1.5">Amount ($)</label><input name="amount" type="number" min="0" required className="w-full bg-[#1c1c1c] border border-[#454446] rounded px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[#92b0ce]" /></div>
                <div><label className="block text-[12px] text-[#b8b6b9] mb-1.5">Probability (%)</label><input name="probability" type="number" min="0" max="100" defaultValue={20} required className="w-full bg-[#1c1c1c] border border-[#454446] rounded px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[#92b0ce]" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-[12px] text-[#b8b6b9] mb-1.5">Associate</label><select name="associateId" className="w-full bg-[#1c1c1c] border border-[#454446] rounded px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[#92b0ce]"><option value="">Unassigned</option>{associates.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                <div><label className="block text-[12px] text-[#b8b6b9] mb-1.5">Expected Close</label><input name="expectedClose" type="date" className="w-full bg-[#1c1c1c] border border-[#454446] rounded px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[#92b0ce]" /></div>
              </div>
              {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] px-3 py-2 rounded">{error}</div>}
            </div>
            <div className="px-6 py-4 border-t border-[#454446] flex justify-end gap-3">
              <button type="button" onClick={() => setAddOpen(false)} className="px-4 py-2 text-[13px] text-[#b8b6b9] hover:text-white transition-colors">Cancel</button>
              <button type="submit" disabled={isPending} className="px-4 py-2 text-[13px] bg-[#e3c16c] text-black font-medium rounded hover:bg-[#d2ac55] transition-colors disabled:opacity-60">{isPending ? 'Creating…' : 'Create'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
