'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search, Mail, Phone, Target, TrendingUp, Briefcase, Pencil, Check, X, FileText, ExternalLink, Users,
} from 'lucide-react';
import type { SalesCrmData } from '@/server/crm/queries';
import { setSalesTargetAction } from '@/server/crm/actions';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { ListToolbar } from '@/components/ui/ListToolbar';
import { EmptyState } from '@/components/ui/EmptyState';

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
    <PageShell
      header={
        <PageHeader
          eyebrow="Sales"
          title="Customers"
          subtitle="Your book of business and quota — supplier and vendor data is not shown to sales."
          meta={[
            { label: `${customers.length} customers`, tone: 'blue' },
            ...(me ? [{ label: `${me.quotaAttainmentPct}% of target`, tone: 'green' as const }] : []),
          ]}
          actions={
            <div className="flex items-center gap-2">
              <Link
                href="/pipeline"
                className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text-secondary)] hover:text-white border border-[var(--color-basalt-500)] rounded-lg px-2.5 py-1.5 transition-colors"
              >
                Pipeline <ExternalLink size={12} />
              </Link>
              <Link
                href="/orders"
                className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text-secondary)] hover:text-white border border-[var(--color-basalt-500)] rounded-lg px-2.5 py-1.5 transition-colors"
              >
                Orders <ExternalLink size={12} />
              </Link>
            </div>
          }
        >
          <ListToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search customers…"
            resultCount={filtered.length}
            totalCount={customers.length}
          />
        </PageHeader>
      }
    >
      <div className="space-y-6">
        {me && (
          <div className="bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded-lg p-5">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <div>
                <h2 className="text-[16px] font-medium text-white">{me.name}</h2>
                <p className="text-[12px] text-[var(--color-text-secondary)]">
                  <span className="font-mono bg-[var(--color-basalt-500)] px-1.5 py-0.5 rounded text-white">{me.systemId}</span>
                  {' · '}{me.role} · {me.location}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[12px] text-[var(--color-text-secondary)]">Commission {me.commissionRate}</span>
                <Link
                  href="/pipeline"
                  className="text-[12px] text-[var(--color-amethyst)] hover:text-white inline-flex items-center gap-1"
                >
                  <Briefcase size={12} /> View pipeline
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <ScoreCell icon={TrendingUp} label="YTD Sales" value={usd(me.ytdSales)} accent="#10b981" href="/orders?status=COMPLETED" />
              <ScoreCell icon={Briefcase} label="Open Pipeline" value={usd(me.activePipelineValue)} accent="#b58cd6" href="/pipeline" />
              <ScoreCell icon={Target} label="Annual Target" value={me.salesTargetAnnual > 0 ? usd(me.salesTargetAnnual) : 'Not set'} accent="#e3c16c" />
              <ScoreCell icon={Target} label="Quota Attainment" value={`${me.quotaAttainmentPct}%`} accent="#92b0ce" />
            </div>

            <div className="bg-[var(--color-basalt-800)] border border-[var(--color-basalt-500)] rounded-md p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] text-[var(--color-text-secondary)] uppercase tracking-wider">Progress to Target</span>
                {canEditTarget && !editingTarget && (
                  <button
                    onClick={() => { setEditingTarget(true); setTargetInput(String(me.salesTargetAnnual)); setError(''); }}
                    className="flex items-center gap-1 text-[12px] text-[var(--color-sodalite)] hover:text-white transition-colors"
                  >
                    <Pencil size={12} /> Edit target
                  </button>
                )}
              </div>

              {editingTarget ? (
                <div className="flex items-center gap-2">
                  <span className="text-[var(--color-text-secondary)] text-[13px]">$</span>
                  <input
                    type="number" min="0" step="1000" autoFocus
                    value={targetInput}
                    onChange={(e) => setTargetInput(e.target.value)}
                    className="flex-1 bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded px-3 py-1.5 text-white text-[13px] focus:outline-none focus:border-[var(--color-sodalite)]"
                  />
                  <button onClick={saveTarget} disabled={isPending} className="p-1.5 rounded bg-[var(--color-emerald)]/10 text-[var(--color-emerald)] hover:bg-[var(--color-emerald)]/20 transition-colors disabled:opacity-50"><Check size={14} /></button>
                  <button onClick={() => setEditingTarget(false)} className="p-1.5 rounded bg-[var(--color-basalt-500)]/40 text-[var(--color-text-secondary)] hover:text-white transition-colors"><X size={14} /></button>
                </div>
              ) : (
                <>
                  <div className="h-2.5 bg-[var(--color-basalt-500)] rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--color-emerald)] transition-all" style={{ width: `${Math.min(me.quotaAttainmentPct, 100)}%` }} />
                  </div>
                  <p className="text-[11px] text-[var(--color-text-secondary)] mt-1.5">
                    {usd(me.ytdSales)} of {me.salesTargetAnnual > 0 ? usd(me.salesTargetAnnual) : '—'} ({me.quotaAttainmentPct}%)
                  </p>
                </>
              )}
              {error && <p className="text-red-400 text-[12px] mt-2">{error}</p>}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-[14px] font-medium text-white mb-3">
            Customers <span className="text-[var(--color-text-secondary)] font-normal">({customers.length})</span>
          </h2>

          <div className="bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded-lg overflow-hidden">
            {filtered.length === 0 ? (
              <EmptyState
                icon={Users}
                title={customers.length === 0 ? 'No customers assigned' : 'No customers match'}
                hint={
                  customers.length === 0
                    ? 'Ask an admin to assign customers to your book, or create deals in Pipeline.'
                    : 'Try a different search term.'
                }
                action={
                  customers.length === 0 ? (
                    <Link href="/pipeline" className="btn-primary inline-flex items-center gap-1.5 text-[13px]">
                      <Briefcase size={14} /> Go to pipeline
                    </Link>
                  ) : (
                    <button type="button" onClick={() => setSearch('')} className="btn-ghost text-[13px]">
                      Clear search
                    </button>
                  )
                }
                className="py-12"
              />
            ) : (
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="bg-[var(--color-basalt-700)] text-[11px] uppercase tracking-wider text-[var(--color-text-secondary)]">
                    <th className="p-3 font-medium border-b border-[var(--color-basalt-500)]">Customer</th>
                    <th className="p-3 font-medium border-b border-[var(--color-basalt-500)]">Contact</th>
                    <th className="p-3 font-medium border-b border-[var(--color-basalt-500)] text-right">Open Deals</th>
                    <th className="p-3 font-medium border-b border-[var(--color-basalt-500)] text-right">Open Value</th>
                    <th className="p-3 font-medium border-b border-[var(--color-basalt-500)] text-right">Orders</th>
                    <th className="p-3 font-medium border-b border-[var(--color-basalt-500)] text-right">Lifetime Value</th>
                    <th className="p-3 font-medium border-b border-[var(--color-basalt-500)] text-center">Jump</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-basalt-500)]">
                  {filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-[var(--color-basalt-800)] transition-colors">
                      <td className="p-3 font-medium text-white">{c.name}</td>
                      <td className="p-3">
                        <span className="text-[12px] text-[var(--color-sodalite)] flex items-center gap-1"><Mail size={11} /> {c.email}</span>
                        <span className="text-[11px] text-[var(--color-text-secondary)] flex items-center gap-1 mt-0.5"><Phone size={10} /> {c.phone}</span>
                      </td>
                      <td className="p-3 text-right text-white">{c.openDeals}</td>
                      <td className="p-3 text-right text-[var(--color-amethyst)]">{usd(c.openValue)}</td>
                      <td className="p-3 text-right text-white">{c.ordersCount}</td>
                      <td className="p-3 text-right text-[var(--color-emerald)] font-medium">{usd(c.lifetimeValue)}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link
                            href="/pipeline"
                            className="p-1.5 rounded text-[var(--color-amethyst)] hover:bg-[rgba(181,140,214,0.10)] transition-colors"
                            title="Open pipeline"
                          >
                            <Briefcase size={13} />
                          </Link>
                          <Link
                            href="/orders"
                            className="p-1.5 rounded text-[var(--color-emerald)] hover:bg-[var(--color-emerald)]/10 transition-colors"
                            title="Open orders"
                          >
                            <FileText size={13} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function ScoreCell({
  icon: Icon,
  label,
  value,
  accent,
  href,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  accent: string;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-md" style={{ background: `${accent}1a`, color: accent }}>
          <Icon size={14} />
        </div>
        <span className="text-[11px] text-[var(--color-text-secondary)] uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-[16px] font-medium text-white tabular-nums" style={{ fontFamily: 'var(--font-fraunces), serif' }}>
        {value}
      </p>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block bg-[var(--color-basalt-800)] border border-[var(--color-basalt-500)] rounded-lg p-3 hover:border-[var(--color-vein)]/50 transition-colors"
      >
        {body}
      </Link>
    );
  }

  return <div className="bg-[var(--color-basalt-800)] border border-[var(--color-basalt-500)] rounded-lg p-3">{body}</div>;
}
