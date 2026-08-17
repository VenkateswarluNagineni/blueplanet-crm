'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LinkIcon } from 'lucide-react';
import { linkCaseToPoAction } from '@/server/reconciliation/actions';
import { Button } from '@/components/ui/Button';

export type CandidatePO = { id: string; poNumber: string; supplierName: string };

/** Shown when a case's deterministic match failed at ingestion — manual override. */
export function CaseMatchBanner({ caseId, candidates }: { caseId: string; candidates: CandidatePO[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const link = () => {
    if (!selected) return;
    setError('');
    startTransition(async () => {
      const res = await linkCaseToPoAction(caseId, selected);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <div className="bg-[rgba(227,193,108,0.08)] border border-[rgba(227,193,108,0.3)] rounded-[var(--radius-md)] p-3 mb-4">
      <p className="text-[12px] text-[var(--color-vein)] font-medium mb-2">
        No purchase order could be matched automatically — link one manually to continue.
      </p>
      <div className="flex items-center gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="bp-select flex-1"
        >
          <option value="">Select a purchase order…</option>
          {candidates.map((po) => (
            <option key={po.id} value={po.id}>
              {po.poNumber} — {po.supplierName}
            </option>
          ))}
        </select>
        <Button size="sm" disabled={!selected || isPending} onClick={link} className="flex items-center gap-1.5">
          <LinkIcon size={13} /> Link
        </Button>
      </div>
      {error && <p className="text-[11px] text-[var(--color-ruby)] mt-1.5">{error}</p>}
    </div>
  );
}
