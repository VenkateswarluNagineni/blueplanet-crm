'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ReconciliationCaseDetail } from '@/server/reconciliation/queries';
import { approveDeltaAction, rejectDeltaAction, dismissCaseAction } from '@/server/reconciliation/actions';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { CheckCircle2 } from 'lucide-react';
import { InboundMessagePane } from './InboundMessagePane';
import { DeltaFieldRow } from './DeltaFieldRow';
import { CaseMatchBanner, type CandidatePO } from './CaseMatchBanner';

export function ReconciliationCaseWorkspace({
  detail,
  candidatePOs,
}: {
  detail: ReconciliationCaseDetail;
  candidatePOs: CandidatePO[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const approve = (deltaId: string, affectedInventoryItemIds?: string[]) => {
    setError('');
    startTransition(async () => {
      const res = await approveDeltaAction(deltaId, { affectedInventoryItemIds });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  };
  const reject = (deltaId: string) => {
    setError('');
    startTransition(async () => {
      const res = await rejectDeltaAction(deltaId);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  };
  const dismiss = () => {
    startTransition(async () => {
      const res = await dismissCaseAction(detail.id);
      if (res.ok) router.push('/purchases/reconciliation');
    });
  };

  const pendingDeltas = detail.deltas.filter((d) => d.status === 'PENDING' || d.status === 'BLOCKED');
  const resolvedDeltas = detail.deltas.filter((d) => !pendingDeltas.includes(d));

  return (
    <PageShell
      header={
        <PageHeader
          breadcrumbs={[
            { label: 'Inventory', href: '/purchases' },
            { label: 'Reconciliation', href: '/purchases/reconciliation' },
            { label: detail.purchaseOrder?.poNumber ?? 'Unmatched' },
          ]}
          title={detail.purchaseOrder ? `Reconcile ${detail.purchaseOrder.poNumber}` : 'Reconcile — unmatched'}
          subtitle={detail.purchaseOrder ? `${detail.purchaseOrder.supplierName} · ${detail.inboundMessage.fromAddress}` : undefined}
          meta={[
            { label: `${pendingDeltas.length} pending`, tone: pendingDeltas.length > 0 ? 'gold' : 'green' },
          ]}
          actions={
            detail.status !== 'DISMISSED' && detail.status !== 'RESOLVED' ? (
              <Button variant="secondary" size="sm" disabled={isPending} onClick={dismiss}>
                Dismiss case
              </Button>
            ) : undefined
          }
        />
      }
    >
      {error && (
        <div className="mb-4 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[var(--color-ruby)] text-[12px] px-3 py-2 rounded">
          {error}
        </div>
      )}

      {detail.status === 'NEEDS_MATCH' && <CaseMatchBanner caseId={detail.id} candidates={candidatePOs} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <div className="lg:sticky lg:top-0">
          <InboundMessagePane message={detail.inboundMessage} />
        </div>

        <div className="space-y-3">
          {pendingDeltas.length === 0 && resolvedDeltas.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No deltas extracted for this message"
              hint="This case has no proposed changes to review."
            />
          ) : (
            <>
              {pendingDeltas.map((d) => (
                <DeltaFieldRow
                  key={d.id}
                  delta={d}
                  eligibleSlabs={detail.eligibleSlabs}
                  soldSlabIds={detail.soldSlabIds}
                  onApprove={approve}
                  onReject={reject}
                  isPending={isPending}
                />
              ))}
              {resolvedDeltas.length > 0 && (
                <div className="pt-2">
                  <p className="text-[11px] uppercase tracking-wider text-[var(--color-fog-500)] mb-2">Resolved</p>
                  <div className="space-y-2 opacity-70">
                    {resolvedDeltas.map((d) => (
                      <DeltaFieldRow
                        key={d.id}
                        delta={d}
                        eligibleSlabs={detail.eligibleSlabs}
                        soldSlabIds={detail.soldSlabIds}
                        onApprove={approve}
                        onReject={reject}
                        isPending={isPending}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </PageShell>
  );
}
