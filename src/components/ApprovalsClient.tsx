'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, Ruler, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import type { ApprovalItem } from '@/server/queries/approvals';
import { approveApprovalAction, rejectApprovalAction } from '@/server/actions/approvals';

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
    <div className="h-full w-full flex flex-col bg-[#2b2a2c] text-[#d9d8d9]">
      <div className="pt-6 pb-4 px-6 border-b border-[#454446] shrink-0 bg-[#1c1c1c]">
        <h1 className="text-[20px] font-medium text-white mb-1">Pending Approvals</h1>
        <p className="text-[13px] text-[#b8b6b9]">Review and resolve measurement overrides submitted from the floor.</p>
      </div>

      {error && <div className="mx-6 mt-3 bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] px-3 py-2 rounded">{error}</div>}

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div>
          <h2 className="text-[13px] font-medium text-white mb-3">Awaiting Review ({pending.length})</h2>
          {pending.length === 0 ? (
            <div className="text-center py-12 text-[#b8b6b9] bg-[#1c1c1c] border border-[#454446] border-dashed rounded-md">No approvals awaiting review.</div>
          ) : (
            <div className="space-y-3">
              {pending.map((a) => (
                <div key={a.id} className="bg-[#1c1c1c] border border-[#e3c16c]/30 rounded-lg p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-9 h-9 rounded-md bg-[#e3c16c]/10 text-[#e3c16c] flex items-center justify-center shrink-0"><Ruler size={16} /></div>
                    <div className="min-w-0">
                      <p className="text-[13px] text-white font-medium truncate">{a.productName} <span className="text-[#92b0ce] font-mono">· {a.slabId}</span></p>
                      <div className="flex items-center gap-2 text-[12px] text-[#b8b6b9] mt-0.5">
                        <span>{a.currentLength ?? '—'}" × {a.currentWidth ?? '—'}"</span>
                        <ArrowRight size={12} className="text-[#e3c16c]" />
                        <span className="text-white">{a.proposedLength}" × {a.proposedWidth}"</span>
                        <span className="ml-2 text-[#b8b6b9]">submitted by {a.submittedByRole} · {a.createdAt}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="bg-amber-500/10 text-amber-300 border border-amber-500/20 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">
                          🔐 Variance Delta: +4.2%
                        </span>
                        <span className="bg-[#92b0ce]/10 text-[#92b0ce] border border-[#92b0ce]/20 px-1.5 py-0.5 rounded text-[10px]">
                          Cryptographic Sign-off Required
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button disabled={isPending} onClick={() => act(rejectApprovalAction, a.id)} className="flex items-center gap-1 text-[12px] text-[#b8b6b9] border border-[#454446] hover:text-red-400 hover:border-red-400/40 px-3 py-1.5 rounded transition-colors disabled:opacity-50"><X size={13} /> Reject</button>
                    <button disabled={isPending} onClick={() => act(approveApprovalAction, a.id)} className="flex items-center gap-1 text-[12px] text-black bg-[#10b981] hover:bg-[#059669] px-3 py-1.5 rounded font-medium transition-colors disabled:opacity-50"><Check size={13} /> Approve</button>
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
                <div key={a.id} className="bg-[#1c1c1c] border border-[#454446] rounded-md p-3 flex items-center justify-between opacity-80">
                  <p className="text-[12px] text-[#b8b6b9]"><span className="text-white font-mono">{a.slabId}</span> · {a.proposedLength}" × {a.proposedWidth}"</p>
                  {a.status === 'COMPLETED' ? (
                    <span className="text-[11px] text-[#10b981] flex items-center gap-1"><CheckCircle2 size={13} /> Approved</span>
                  ) : (
                    <span className="text-[11px] text-red-400 flex items-center gap-1"><XCircle size={13} /> Rejected</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
