'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, Ruler, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import type { ApprovalItem } from '@/server/approvals/queries';
import { approveApprovalAction, rejectApprovalAction } from '@/server/approvals/actions';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { EmptyState } from '@/components/ui/EmptyState';

export function ApprovalsClient({ approvals }: { approvals: ApprovalItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const act = (fn: (id: string) => Promise<{ ok: boolean; error?: string }>, id: string) => {
    setError('');
    startTransition(async () => {
      const res = await fn(id);
      if (!res.ok) setError(res.error ?? 'Action failed.');
      else router.refresh();
    });
  };

  const pending = approvals.filter((a) => a.status === 'PENDING');
  const resolved = approvals.filter((a) => a.status !== 'PENDING');

  return (
    <PageShell
      header={
        <PageHeader
          breadcrumbs={[
            { label: 'Ops', href: '/' },
            { label: 'Approvals' },
          ]}
          title="Approvals"
          subtitle="Review and resolve measurement overrides submitted from the floor."
          meta={[
            { label: `${pending.length} awaiting`, tone: pending.length > 0 ? 'gold' : 'green' },
            { label: `${resolved.length} resolved`, tone: 'neutral' },
          ]}
        />
      }
    >
      {error && <div className="mb-4 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[var(--color-ruby)] text-[12px] px-3 py-2 rounded">{error}</div>}

      <div className="space-y-6">
        <div>
          <h2 className="text-[13px] font-medium text-white mb-3">Awaiting Review ({pending.length})</h2>
          {pending.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No approvals awaiting review"
              hint="Measurement overrides submitted from the floor will land here."
              className="bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] border-dashed rounded-md py-12"
            />
          ) : (
            <div className="space-y-3">
              {pending.map((a) => (
                <div key={a.id} className="bp-card p-4 flex items-center justify-between gap-4 !border-[rgba(227,193,108,0.35)]">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[rgba(227,193,108,0.12)] text-[var(--color-vein)] flex items-center justify-center shrink-0"><Ruler size={16} /></div>
                    <div className="min-w-0">
                      <p className="text-[13px] text-white font-medium truncate">{a.productName} <span className="text-[var(--color-sodalite)] font-mono">· {a.slabId}</span></p>
                      <div className="flex items-center gap-2 text-[12px] text-[var(--color-text-secondary)] mt-0.5">
                        <span>{a.currentLength ?? '—'}&quot; × {a.currentWidth ?? '—'}&quot;</span>
                        <ArrowRight size={12} className="text-[var(--color-vein)]" />
                        <span className="text-white">{a.proposedLength}&quot; × {a.proposedWidth}&quot;</span>
                        <span className="ml-2 text-[var(--color-text-secondary)]">submitted by {a.submittedByRole} · {a.createdAt}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="bg-[var(--color-coral)]/10 text-[var(--color-coral)] border border-[rgba(232,149,107,0.3)] px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold">
                          Variance +4.2%
                        </span>
                        <span className="bg-[rgba(146,176,206,0.10)] text-[var(--color-sodalite)] border border-[rgba(146,176,206,0.20)] px-1.5 py-0.5 rounded text-[10px]">
                          Admin sign-off required
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button disabled={isPending} onClick={() => act(rejectApprovalAction, a.id)} className="btn-secondary flex items-center gap-1 text-[12px] py-1.5 disabled:opacity-50 hover:!border-[rgba(239,68,68,0.4)] hover:!text-[var(--color-ruby)]"><X size={13} /> Reject</button>
                    <button disabled={isPending} onClick={() => act(approveApprovalAction, a.id)} className="flex items-center gap-1 text-[12px] text-[var(--color-basalt-950)] bg-[var(--color-emerald)] hover:opacity-90 px-3 py-1.5 rounded-[var(--radius-md)] font-medium transition-colors disabled:opacity-50"><Check size={13} /> Approve</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {resolved.length > 0 && (
          <div>
            <h2 className="text-[13px] font-medium text-white mb-3">Recently Resolved</h2>
            <div className="space-y-2">
              {resolved.map((a) => (
                <div key={a.id} className="bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded-md p-3 flex items-center justify-between opacity-80">
                  <p className="text-[12px] text-[var(--color-text-secondary)]"><span className="text-white font-mono">{a.slabId}</span> · {a.proposedLength}&quot; × {a.proposedWidth}&quot;</p>
                  {a.status === 'COMPLETED' ? (
                    <span className="text-[11px] text-[var(--color-emerald)] flex items-center gap-1"><CheckCircle2 size={13} /> Approved</span>
                  ) : (
                    <span className="text-[11px] text-[var(--color-ruby)] flex items-center gap-1"><XCircle size={13} /> Rejected</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
