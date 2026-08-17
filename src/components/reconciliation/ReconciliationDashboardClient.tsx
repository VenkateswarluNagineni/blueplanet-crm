'use client';

import Link from 'next/link';
import { GitCompare, Inbox } from 'lucide-react';
import type { ReconciliationCaseRow } from '@/server/reconciliation/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { EmptyState } from '@/components/ui/EmptyState';

const STATUS_TONE: Record<string, string> = {
  NEEDS_MATCH: 'bg-[rgba(232,149,107,0.1)] text-[var(--color-coral)] border-[rgba(232,149,107,0.3)]',
  IN_REVIEW: 'bg-[rgba(227,193,108,0.12)] text-[var(--color-vein)] border-[rgba(227,193,108,0.3)]',
  BLOCKED: 'bg-[rgba(239,68,68,0.1)] text-[var(--color-ruby)] border-[rgba(239,68,68,0.25)]',
  RESOLVED: 'bg-[rgba(16,185,129,0.1)] text-[var(--color-emerald)] border-[rgba(16,185,129,0.3)]',
};

export function ReconciliationDashboardClient({ cases }: { cases: ReconciliationCaseRow[] }) {
  const open = cases.filter((c) => c.status !== 'RESOLVED');
  const resolved = cases.filter((c) => c.status === 'RESOLVED');

  return (
    <PageShell
      header={
        <PageHeader
          breadcrumbs={[{ label: 'Inventory', href: '/purchases' }, { label: 'Reconciliation' }]}
          title="Reconciliation"
          subtitle="Supplier email corrections matched against purchase orders, awaiting field-by-field review."
          meta={[{ label: `${open.length} open`, tone: open.length > 0 ? 'gold' : 'green' }]}
        />
      }
    >
      {open.length === 0 ? (
        <EmptyState
          icon={GitCompare}
          title="No open reconciliation cases"
          hint="Supplier correction emails forwarded to your reconciliation inbox will land here."
        />
      ) : (
        <div className="space-y-2 mb-8">
          {open.map((c) => (
            <Link
              key={c.id}
              href={`/purchases/reconciliation/${c.id}`}
              className="bp-card p-4 flex items-center justify-between gap-4 block hover:border-[rgba(227,193,108,0.35)] transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[rgba(227,193,108,0.12)] text-[var(--color-vein)] flex items-center justify-center shrink-0">
                  <Inbox size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] text-white font-medium truncate">
                    {c.inboundMessage.subject ?? '(no subject)'}
                    {c.purchaseOrder && (
                      <span className="text-[var(--color-sodalite)] bp-mono ml-2">· {c.purchaseOrder.poNumber}</span>
                    )}
                  </p>
                  <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5 truncate">
                    From {c.inboundMessage.fromAddress}
                    {c.purchaseOrder && ` · ${c.purchaseOrder.supplierName}`}
                    {' · '}
                    {new Date(c.inboundMessage.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {c.openDeltaCount > 0 && (
                  <span className="text-[11px] text-[var(--color-vein)] bp-mono">{c.openDeltaCount} field{c.openDeltaCount === 1 ? '' : 's'}</span>
                )}
                <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded border ${STATUS_TONE[c.status] ?? ''}`}>
                  {c.status.replace('_', ' ')}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <div>
          <h2 className="text-[13px] font-medium text-white mb-3">Recently Resolved</h2>
          <div className="space-y-2">
            {resolved.map((c) => (
              <Link
                key={c.id}
                href={`/purchases/reconciliation/${c.id}`}
                className="bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded-md p-3 flex items-center justify-between opacity-80 block hover:opacity-100 transition-opacity"
              >
                <p className="text-[12px] text-[var(--color-text-secondary)]">
                  {c.purchaseOrder && <span className="text-white bp-mono">{c.purchaseOrder.poNumber}</span>}
                  {' · '}
                  {c.inboundMessage.subject ?? '(no subject)'}
                </p>
                <span className="text-[11px] text-[var(--color-emerald)]">Resolved</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </PageShell>
  );
}
