'use client';

import { useMemo, useRef } from 'react';
import { FileText, DollarSign, Ship, AlertTriangle, Package } from 'lucide-react';
import type { VendorOrder, VendorInvoiceRow } from '@/server/vendor/queries';
import { VendorDashboard, type VendorKpis } from '@/components/vendor/VendorDashboard';
import { LogisticsStageBar } from '@/components/logistics/LogisticsStageBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';

function invoiceTone(status: string): 'green' | 'gold' | 'red' | 'orange' | 'neutral' {
  const s = status.toLowerCase();
  if (s === 'paid') return 'green';
  if (s === 'overdue') return 'red';
  if (s.includes('dispute')) return 'orange';
  if (s === 'open' || s === 'pending' || s === 'sent') return 'gold';
  return 'neutral';
}

export function VendorPortalClient({
  vendorName,
  serviceType,
  kpis,
  orders,
  invoices,
  initialLayout,
}: {
  vendorName: string;
  serviceType: string;
  kpis: VendorKpis;
  orders: VendorOrder[];
  invoices: VendorInvoiceRow[];
  initialLayout: string[] | null;
}) {
  const shipmentsRef = useRef<HTMLElement | null>(null);
  const invoicesRef = useRef<HTMLElement | null>(null);

  const activeOrders = useMemo(
    () => orders.filter((o) => o.logisticsStatus !== 'RECEIVED'),
    [orders],
  );
  const overdueInvoices = useMemo(
    () => invoices.filter((i) => i.status === 'Overdue'),
    [invoices],
  );

  const scrollTo = (ref: React.RefObject<HTMLElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-8">
      {(overdueInvoices.length > 0 || activeOrders.length > 0) && (
        <div className="bp-attention">
          <div className="bp-attention-header">
            <span className="bp-eyebrow">Needs attention</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[var(--color-basalt-500)]">
            {overdueInvoices.length > 0 && (
              <button
                type="button"
                onClick={() => scrollTo(invoicesRef)}
                className="flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[var(--color-basalt-800)] transition-colors"
              >
                <div className="w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center bg-[rgba(239,68,68,0.1)] text-[var(--color-ruby)]">
                  <AlertTriangle size={16} />
                </div>
                <div>
                  <p className="text-[12px] text-[var(--color-text-secondary)]">Overdue invoices</p>
                  <p
                    className="text-[18px] font-medium text-[var(--color-vein)] tabular-nums tracking-tight"
                    style={{ fontFamily: 'var(--font-heading)' }}
                  >
                    {overdueInvoices.length} · ${kpis.overdueAmount.toLocaleString()}
                  </p>
                </div>
              </button>
            )}
            {activeOrders.length > 0 && (
              <button
                type="button"
                onClick={() => scrollTo(shipmentsRef)}
                className="flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[var(--color-basalt-800)] transition-colors"
              >
                <div className="w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center bg-[rgba(146,176,206,0.1)] text-[var(--color-sodalite)]">
                  <Ship size={16} />
                </div>
                <div>
                  <p className="text-[12px] text-[var(--color-text-secondary)]">Active shipments</p>
                  <p
                    className="text-[18px] font-medium text-white tabular-nums tracking-tight"
                    style={{ fontFamily: 'var(--font-heading)' }}
                  >
                    {activeOrders.length} in your lanes
                  </p>
                </div>
              </button>
            )}
          </div>
        </div>
      )}

      <VendorDashboard
        kpis={kpis}
        initialLayout={initialLayout}
        onKpiClick={(key) => {
          if (
            key.includes('Invoice') ||
            key.includes('overdue') ||
            key.includes('Balance') ||
            key.includes('balance')
          ) {
            scrollTo(invoicesRef);
          } else {
            scrollTo(shipmentsRef);
          }
        }}
      />

      <section ref={shipmentsRef} id="shipments" className="scroll-mt-6">
        <div className="flex items-center justify-between mb-3 gap-2">
          <h2 className="text-[13px] font-medium text-white flex items-center gap-2">
            <Ship size={15} className="text-[var(--color-sodalite)]" /> My shipments
          </h2>
          <span className="text-[11px] text-[var(--color-fog-500)] tabular-nums">
            {activeOrders.length} active · {orders.length} total
          </span>
        </div>

        {orders.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No assigned shipments"
            hint="When BluePlanet books you on a PO leg (ocean, customs, or inland), shipments appear here with live status."
            className="bp-panel border-dashed py-12"
          />
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <div key={o.poNumber} className="bp-card p-4 hover:border-[rgba(146,176,206,0.4)] transition-colors">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="bp-mono text-white font-medium">{o.poNumber}</span>
                      <Badge tone="blue">{o.leg}</Badge>
                      <span className="text-[11px] text-[var(--color-text-secondary)] border border-[var(--color-basalt-500)] rounded px-2 py-0.5">
                        {o.status}
                      </span>
                    </div>
                    <p className="text-[12px] text-[var(--color-text-secondary)] mt-1 truncate">
                      {o.supplierName} · {o.materialName}
                    </p>
                  </div>
                  <div className="text-right text-[12px] shrink-0">
                    <p className="text-white">ETA {o.eta ?? 'TBD'}</p>
                    {o.containerId && (
                      <p className="text-[var(--color-sodalite)] bp-mono text-[11px]">{o.containerId}</p>
                    )}
                  </div>
                </div>
                <LogisticsStageBar status={o.logisticsStatus} variant="full" />
              </div>
            ))}
          </div>
        )}
      </section>

      <section ref={invoicesRef} id="invoices" className="scroll-mt-6">
        <div className="flex items-center justify-between mb-3 gap-2">
          <h2 className="text-[13px] font-medium text-white flex items-center gap-2">
            <FileText size={15} className="text-[var(--color-vein)]" /> My invoices
          </h2>
          <span className="text-[11px] text-[var(--color-fog-500)] tabular-nums">
            {kpis.openInvoices} open
            {kpis.overdueAmount > 0 && (
              <span className="text-[var(--color-ruby)]">
                {' '}
                · ${kpis.overdueAmount.toLocaleString()} overdue
              </span>
            )}
          </span>
        </div>

        {invoices.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No invoices on file"
            hint="Invoices posted against your vendor account will show amount, due date, and status here."
            className="bp-panel border-dashed py-12"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {invoices.map((inv) => (
              <div
                key={inv.invoiceNum}
                className={`bp-card p-4 ${
                  inv.status === 'Overdue' ? '!border-[rgba(239,68,68,0.4)]' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-2 gap-2">
                  <span className="bp-mono text-white font-medium">{inv.invoiceNum}</span>
                  <Badge tone={invoiceTone(inv.status)}>{inv.status}</Badge>
                </div>
                <p className="text-[12px] text-[var(--color-text-secondary)] mb-3 line-clamp-2">
                  {inv.serviceDetails ?? 'Logistics service'}
                </p>
                <div className="flex items-center justify-between">
                  <span
                    className="text-[15px] text-[var(--color-vein)] font-medium flex items-center gap-1 tabular-nums"
                    style={{ fontFamily: 'var(--font-heading)' }}
                  >
                    <DollarSign size={14} /> {inv.amount.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-[var(--color-text-secondary)]">
                    Due {inv.dueDate ?? '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-[11px] text-[var(--color-fog-500)] text-center pb-2">
        Signed in as <span className="text-[var(--color-text-secondary)]">{vendorName}</span>
        {serviceType ? ` · ${serviceType}` : ''} — only your assigned legs and invoices are visible.
      </p>
    </div>
  );
}
