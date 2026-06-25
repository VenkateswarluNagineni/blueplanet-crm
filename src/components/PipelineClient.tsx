'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Target, Trophy, Ban } from 'lucide-react';
import type { OppItem } from '@/server/queries/pipeline';
import { createOpportunityAction, setOpportunityStatusAction } from '@/server/actions/pipeline';

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
}: {
  opportunities: OppItem[];
  associates: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState('');

  const move = (id: string, status: string) => {
    setError('');
    startTransition(async () => {
      const res = await setOpportunityStatusAction(id, status);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  };

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
          <div className="mx-6 mt-4 bg-[#333234] border border-[#454446] p-3.5 rounded-lg flex items-center justify-between text-[#d9d8d9]">
            <div className="flex items-center gap-6 text-[12px]">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-[#b58cd6]/20 text-[#b58cd6] border border-[#b58cd6]/30 font-bold text-[10px] rounded uppercase tracking-wider">AI Propensity Engine</span>
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
        <div className="grid grid-cols-5 gap-4 min-w-[1100px]">
          {STAGES.map((stage) => {
            const items = opportunities.filter((o) => o.status === stage.key);
            const colTotal = items.reduce((s, o) => s + o.amount, 0);
            return (
              <div key={stage.key} className="bg-[#1c1c1c] border border-[#454446] rounded-lg flex flex-col">
                <div className="px-3 py-2.5 border-b border-[#454446] flex items-center justify-between">
                  <span className="text-[12px] font-medium flex items-center gap-2" style={{ color: stage.color }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: stage.color }} /> {stage.label}
                  </span>
                  <span className="text-[11px] text-[#b8b6b9]">{items.length}</span>
                </div>
                <div className="p-2 space-y-2 flex-1 min-h-[120px]">
                  {items.length === 0 ? (
                    <p className="text-[11px] text-[#b8b6b9] text-center py-6 italic">Empty</p>
                  ) : (
                    items.map((o) => (
                      <div key={o.id} className="bg-[#2b2a2c] border border-[#454446] rounded-md p-3 hover:border-[#92b0ce]/50 transition-colors">
                        <div className="flex items-start gap-2 mb-2">
                          <Target size={13} className="text-[#b8b6b9] mt-0.5 shrink-0" />
                          <p className="text-[13px] text-white font-medium leading-tight">{o.name}</p>
                        </div>
                        <p className="text-[11px] text-[#b8b6b9] mb-1">{o.customerLabel}</p>
                        <p className="text-[14px] text-[#10b981] font-medium mb-2">${o.amount.toLocaleString()}</p>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-1 flex-1 bg-[#454446] rounded-full overflow-hidden"><div className="h-full bg-[#10b981]" style={{ width: `${o.probability}%` }} /></div>
                          <span className="text-[10px] text-[#b8b6b9]">{o.probability}%</span>
                        </div>
                        <div className="mb-2">
                          {o.probability >= 70 && (
                            <span className="inline-block bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
                              🚀 High Win Propensity
                            </span>
                          )}
                          {o.probability < 30 && o.status !== 'CLOSED_LOST' && (
                            <span className="inline-block bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
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
