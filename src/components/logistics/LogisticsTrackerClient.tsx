'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Ship, ArrowRight, Package } from 'lucide-react';
import { LogisticsStageBar } from '@/components/logistics/LogisticsStageBar';
import {
  LOGISTICS_STEPS,
  LOGISTICS_STATUS_LABEL,
  type PoLogisticsStatus,
} from '@/lib/domain/logistics-stages';
import { FilterChip } from '@/components/ui/ListToolbar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

/** Minimal PO fields needed for the tracker (avoids importing server-only modules). */
export type LogisticsPoCard = {
  id: string;
  poNumber: string;
  supplierName: string;
  materialName: string;
  orderedSlabs: number;
  status: PoLogisticsStatus;
  eta: string | null;
  containerId: string | null;
};

export function LogisticsTrackerClient({ pos }: { pos: LogisticsPoCard[] }) {
  const inTransit = useMemo(() => pos.filter((p) => p.status !== 'RECEIVED'), [pos]);
  const [stageFilter, setStageFilter] = useState<PoLogisticsStatus | 'ALL'>('ALL');

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of inTransit) m.set(p.status, (m.get(p.status) ?? 0) + 1);
    return m;
  }, [inTransit]);

  const visible = useMemo(
    () =>
      stageFilter === 'ALL'
        ? inTransit
        : inTransit.filter((p) => p.status === stageFilter),
    [inTransit, stageFilter],
  );

  // Scroll to #PO-NUMBER when arriving from Purchasing.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    const t = setTimeout(() => {
      const el = document.getElementById(`po-${hash}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.classList.add('ring-1', 'ring-[var(--color-vein)]/50');
    }, 80);
    return () => clearTimeout(t);
  }, [visible.length]);

  if (inTransit.length === 0) {
    return (
      <EmptyState
        icon={Ship}
        title="No active shipments"
        hint="When purchase orders leave production, they appear here with live logistics stages."
        action={
          <Link href="/purchases" className="btn-primary inline-flex items-center gap-1.5">
            Open Purchasing <ArrowRight size={14} />
          </Link>
        }
        className="bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] border-dashed rounded-md"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip active={stageFilter === 'ALL'} onClick={() => setStageFilter('ALL')} count={inTransit.length}>
          All in transit
        </FilterChip>
        {LOGISTICS_STEPS.filter((s) => s.key !== 'RECEIVED').map((s) => (
          <FilterChip
            key={s.key}
            active={stageFilter === s.key}
            onClick={() => setStageFilter(s.key)}
            count={counts.get(s.key) ?? 0}
          >
            {s.label}
          </FilterChip>
        ))}
        <Link
          href="/purchases?status=ACTIVE"
          className="ml-auto text-[12px] text-[var(--color-sodalite)] hover:text-white inline-flex items-center gap-1 transition-colors"
        >
          Manage in Purchasing <ArrowRight size={12} />
        </Link>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No shipments in this stage"
          hint="Try another stage filter or open Purchasing to advance a PO."
          action={
            <Button type="button" onClick={() => setStageFilter('ALL')} variant="ghost">
              Show all in transit
            </Button>
          }
          className="bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] border-dashed rounded-md py-10"
        />
      ) : (
        visible.map((po) => (
          <div
            key={po.id}
            id={`po-${po.poNumber}`}
            className="bp-card p-5 hover:border-[rgba(146,176,206,0.45)] transition-colors scroll-mt-24"
          >
            <div className="flex items-center justify-between mb-4 gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="bp-mono text-white font-medium">{po.poNumber}</p>
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-[var(--color-basalt-500)] text-[var(--color-text-secondary)] bg-[var(--color-basalt-800)]">
                    {LOGISTICS_STATUS_LABEL[po.status]}
                  </span>
                </div>
                <p className="text-[12px] text-[var(--color-text-secondary)] truncate mt-0.5">
                  {po.supplierName} · {po.materialName} · {po.orderedSlabs} slabs
                </p>
              </div>
              <div className="text-right text-[12px] shrink-0">
                <p className="text-white">ETA {po.eta ?? 'TBD'}</p>
                {po.containerId && <p className="text-[var(--color-sodalite)] font-mono">{po.containerId}</p>}
                <Link
                  href={`/purchases?po=${encodeURIComponent(po.poNumber)}`}
                  className="inline-flex items-center gap-1 mt-2 text-[11px] font-medium text-[var(--color-vein)] hover:text-white transition-colors"
                >
                  Open PO · verify step <ArrowRight size={12} />
                </Link>
              </div>
            </div>
            <LogisticsStageBar status={po.status} variant="full" />
          </div>
        ))
      )}
    </div>
  );
}
