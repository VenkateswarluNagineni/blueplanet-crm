'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Mail, Phone, Target, TrendingUp, Briefcase, Pencil, Check, X } from 'lucide-react';
import type { SalesCrmData } from '@/server/queries/crm';
import { setSalesTargetAction } from '@/server/actions/crm';

/**
 * The CRM as a sales rep sees it: their own performance scorecard (with an
 * editable annual target) and the customer directory — no suppliers or vendors.
 */
export function SalesCrmClient({ data, canEditTarget }: { data: SalesCrmData; canEditTarget: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { me, customers } = data;

  const [search, setSearch] = useState('');
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState(me ? String(me.salesTargetAnnual) : '');
  const [error, setError] = useState('');

  const saveTarget = () => {
    if (!me) return;
    setError('');
    startTransition(async () => {
      const res = await setSalesTargetAction(me.partyId, Number(targetInput));
      if (!res.ok) { setError(res.error); return; }
      setEditingTarget(false);
      router.refresh();
    });
  };

  const usd = (n: number) => `$${n.toLocaleString()}`;
  const filtered = customers.filter((c) =>
    `${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="h-full w-full flex flex-col bg-[#2b2a2c] text-[#d9d8d9]">
      <div className="pt-6 pb-4 px-6 border-b border-[#454446] bg-[#1c1c1c] shrink-0">
        <h1 className="text-[20px] font-medium text-white mb-1">My Customers &amp; Performance</h1>
        <p className="text-[13px] text-[#b8b6b9]">Your book of business and quota — supplier and vendor data is not shown to sales.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Scorecard */}
        {me && (
          <div className="bg-[#1c1c1c] border border-[#454446] rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[16px] font-medium text-white">{me.name}</h2>
                <p className="text-[12px] text-[#b8b6b9]">
                  <span className="font-mono bg-[#454446] px-1.5 py-0.5 rounded text-white">{me.systemId}</span> · {me.role} · {me.location}
                </p>
              </div>
              <span className="text-[12px] text-[#b8b6b9]">Commission {me.commissionRate}</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <ScoreCell icon={TrendingUp} label="YTD Sales" value={usd(me.ytdSales)} accent="#10b981" />
              <ScoreCell icon={Briefcase} label="Open Pipeline" value={usd(me.activePipelineValue)} accent="#b58cd6" />
              <ScoreCell icon={Target} label="Annual Target" value={me.salesTargetAnnual > 0 ? usd(me.salesTargetAnnual) : 'Not set'} accent="#e3c16c" />
              <ScoreCell icon={Target} label="Quota Attainment" value={`${me.quotaAttainmentPct}%`} accent="#92b0ce" />
            </div>

            {/* Quota progress + editable target */}
            <div className="bg-[#2b2a2c] border border-[#454446] rounded-md p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] text-[#b8b6b9] uppercase tracking-wider">Progress to Target</span>
                {canEditTarget && !editingTarget && (
                  <button
                    onClick={() => { setEditingTarget(true); setTargetInput(String(me.salesTargetAnnual)); setError(''); }}
                    className="flex items-center gap-1 text-[12px] text-[#92b0ce] hover:text-white transition-colors"
                  >
                    <Pencil size={12} /> Edit target
                  </button>
                )}
              </div>

              {editingTarget ? (
                <div className="flex items-center gap-2">
                  <span className="text-[#b8b6b9] text-[13px]">$</span>
                  <input
                    type="number" min="0" step="1000" autoFocus
                    value={targetInput}
                    onChange={(e) => setTargetInput(e.target.value)}
                    className="flex-1 bg-[#1c1c1c] border border-[#454446] rounded px-3 py-1.5 text-white text-[13px] focus:outline-none focus:border-[#92b0ce]"
                  />
                  <button onClick={saveTarget} disabled={isPending} className="p-1.5 rounded bg-[#10b981]/10 text-[#10b981] hover:bg-[#10b981]/20 transition-colors disabled:opacity-50"><Check size={14} /></button>
                  <button onClick={() => setEditingTarget(false)} className="p-1.5 rounded bg-[#454446]/40 text-[#b8b6b9] hover:text-white transition-colors"><X size={14} /></button>
                </div>
              ) : (
                <>
                  <div className="h-2.5 bg-[#454446] rounded-full overflow-hidden">
                    <div className="h-full bg-[#10b981] transition-all" style={{ width: `${Math.min(me.quotaAttainmentPct, 100)}%` }} />
                  </div>
                  <p className="text-[11px] text-[#b8b6b9] mt-1.5">
                    {usd(me.ytdSales)} of {me.salesTargetAnnual > 0 ? usd(me.salesTargetAnnual) : '—'} ({me.quotaAttainmentPct}%)
                  </p>
                </>
              )}
              {error && <p className="text-red-400 text-[12px] mt-2">{error}</p>}
            </div>
          </div>
        )}

        {/* Customers */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-medium text-white">Customers <span className="text-[#b8b6b9] font-normal">({customers.length})</span></h2>
            <div className="flex items-center bg-[#1c1c1c] border border-[#454446] rounded-md px-3 py-1.5 focus-within:border-[#92b0ce] transition-colors w-72">
              <Search size={14} className="text-[#b8b6b9] mr-2 shrink-0" />
              <input type="text" placeholder="Search customers…" value={search} onChange={(e) => setSearch(e.target.value)} className="bg-transparent border-none outline-none text-[13px] text-white w-full placeholder-[#b8b6b9]" />
            </div>
          </div>

          <div className="bg-[#1c1c1c] border border-[#454446] rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#333234] text-[11px] uppercase tracking-wider text-[#b8b6b9]">
                  <th className="p-3 font-medium border-b border-[#454446]">Customer</th>
                  <th className="p-3 font-medium border-b border-[#454446]">Contact</th>
                  <th className="p-3 font-medium border-b border-[#454446] text-right">Open Deals</th>
                  <th className="p-3 font-medium border-b border-[#454446] text-right">Open Value</th>
                  <th className="p-3 font-medium border-b border-[#454446] text-right">Orders</th>
                  <th className="p-3 font-medium border-b border-[#454446] text-right">Lifetime Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#454446]">
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-[#b8b6b9]">No customers found.</td></tr>
                ) : (
                  filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-[#2b2a2c] transition-colors">
                      <td className="p-3 font-medium text-white">{c.name}</td>
                      <td className="p-3">
                        <span className="text-[12px] text-[#92b0ce] flex items-center gap-1"><Mail size={11} /> {c.email}</span>
                        <span className="text-[11px] text-[#b8b6b9] flex items-center gap-1 mt-0.5"><Phone size={10} /> {c.phone}</span>
                      </td>
                      <td className="p-3 text-right text-white">{c.openDeals}</td>
                      <td className="p-3 text-right text-[#b58cd6]">{usd(c.openValue)}</td>
                      <td className="p-3 text-right text-white">{c.ordersCount}</td>
                      <td className="p-3 text-right text-[#10b981] font-medium">{usd(c.lifetimeValue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreCell({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string; accent: string }) {
  return (
    <div className="bg-[#2b2a2c] border border-[#454446] rounded-md p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon size={13} className="shrink-0" />
        <p className="text-[10px] uppercase tracking-wider text-[#b8b6b9]">{label}</p>
      </div>
      <p className="text-[16px] font-medium tabular-nums" style={{ color: accent }}>{value}</p>
    </div>
  );
}
