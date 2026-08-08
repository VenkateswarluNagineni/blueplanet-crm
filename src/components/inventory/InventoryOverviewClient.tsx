'use client';

import React from 'react';
import Link from 'next/link';
import {
  Boxes, CheckCircle, PauseCircle, Truck, Ruler, DollarSign,
  Search, History, Warehouse, Box, Package, MapPin, Layers, ArrowRight,
} from 'lucide-react';
import { useRole } from '@/context/RoleContext';
import type { InventoryOverview } from '@/server/inventory/overview-queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { KpiCard, RestrictedValue } from '@/components/ui/KpiCard';

export function InventoryOverviewClient({ overview, canViewCost }: { overview: InventoryOverview; canViewCost: boolean }) {
  const { role } = useRole();
  const isAdmin = role === 'ADMIN';
  const k = overview.kpis;

  const kpis: {
    label: string;
    value: React.ReactNode;
    icon: React.ElementType;
    color: string;
    href?: string;
  }[] = [
    { label: 'Total Slabs', value: k.totalSlabs.toLocaleString(), icon: Boxes, color: '#92b0ce', href: '/inventory' },
    { label: 'Available', value: k.available.toLocaleString(), icon: CheckCircle, color: '#10b981', href: '/inventory?status=AVAILABLE' },
    { label: 'On Hold', value: k.onHold.toLocaleString(), icon: PauseCircle, color: '#e3c16c', href: '/inventory?status=ON_HOLD' },
    { label: 'In Transit', value: k.inTransit.toLocaleString(), icon: Truck, color: '#92b0ce', href: isAdmin ? '/logistics' : undefined },
    { label: 'Available SF', value: k.availableSf.toLocaleString(), icon: Ruler, color: '#d9d8d9', href: '/inventory?status=AVAILABLE' },
    {
      label: 'Inventory Value',
      value: canViewCost && k.inventoryValue != null ? `$${k.inventoryValue.toLocaleString()}` : RestrictedValue,
      icon: DollarSign,
      color: '#e3c16c',
    },
  ];

  const tiles = [
    { label: 'Slabs', href: '/inventory', icon: Search, show: true },
    { label: 'Catalog', href: '/catalog', icon: Box, show: true },
    { label: 'Purchasing', href: '/purchases', icon: Package, show: isAdmin },
    { label: 'Movements', href: '/admin/movements', icon: History, show: isAdmin },
    { label: 'Locations', href: '/admin/locations', icon: Warehouse, show: isAdmin },
  ].filter((t) => t.show);

  return (
    <PageShell
      header={
        <PageHeader
          eyebrow="Inventory"
          title="Overview"
          subtitle="Status, location, and category."
          meta={[
            { label: `${k.available.toLocaleString()} available`, tone: 'green' },
            ...(k.onHold > 0 ? [{ label: `${k.onHold} on hold`, tone: 'gold' as const }] : []),
            ...(k.inTransit > 0 ? [{ label: `${k.inTransit} in transit`, tone: 'blue' as const }] : []),
          ]}
        />
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {kpis.map((c) => {
            if (!c.href) {
              return <KpiCard key={c.label} label={c.label} value={c.value} icon={c.icon} color={c.color} />;
            }
            return (
              <Link key={c.label} href={c.href} className="block rounded-xl transition-opacity hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-vein)] focus-visible:outline-offset-2">
                <KpiCard label={c.label} value={c.value} icon={c.icon} color={c.color} />
              </Link>
            );
          })}
        </div>

        {/* Status breakdown — deep-links into Slabs with matching ?status= */}
        <div className="bp-card p-4">
          <p className="bp-eyebrow mb-3">By status</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {(
              [
                { label: 'Available', status: 'AVAILABLE', count: k.available, tone: 'text-[var(--color-emerald)] border-[rgba(16,185,129,0.30)] bg-[var(--color-emerald)]/10' },
                { label: 'On hold', status: 'ON_HOLD', count: k.onHold, tone: 'text-[var(--color-vein)] border-[rgba(227,193,108,0.30)] bg-[var(--color-vein)]/10' },
                { label: 'Committed', status: 'COMMITTED', count: k.committed, tone: 'text-[var(--color-sodalite)] border-[rgba(146,176,206,0.30)] bg-[rgba(146,176,206,0.10)]' },
                { label: 'Sold', status: 'SOLD', count: k.sold, tone: 'text-[var(--color-text-secondary)] border-[var(--color-basalt-500)] bg-[var(--color-basalt-700)]' },
                { label: 'Written off', status: 'WRITTEN_OFF', count: k.writtenOff, tone: 'text-[var(--color-ruby)] border-[rgba(239,68,68,0.30)] bg-[rgba(239,68,68,0.10)]' },
              ] as const
            ).map((row) => (
              <Link
                key={row.status}
                href={`/inventory?status=${encodeURIComponent(row.status)}`}
                className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border transition-colors hover:border-[var(--color-vein)]/50 ${row.tone}`}
              >
                <span className="text-[12px] font-medium">{row.label}</span>
                <span className="text-[15px] font-semibold tabular-nums" style={{ fontFamily: 'var(--font-fraunces), serif' }}>
                  {row.count.toLocaleString()}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bp-card overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--color-basalt-500)] flex items-center gap-2">
              <MapPin size={15} className="text-[var(--color-sodalite)]" />
              <h3 className="text-[14px] font-medium text-white">Inventory by Location</h3>
            </div>
            <table className="bp-table">
              <thead>
                <tr>
                  <th>Location</th>
                  <th className="text-right">Slabs</th>
                  <th className="text-right">Avail. SF</th>
                  {canViewCost && <th className="text-right">Value</th>}
                </tr>
              </thead>
              <tbody>
                {overview.byLocation.map((l) => (
                  <tr key={l.location} className="group">
                    <td>
                      <Link
                        href={`/inventory?location=${encodeURIComponent(l.location)}`}
                        className="text-white hover:text-[var(--color-sodalite)] flex items-center gap-1.5"
                      >
                        {l.location}{' '}
                        <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-sodalite)]" />
                      </Link>
                    </td>
                    <td className="text-right text-white">
                      {l.slabs} <span className="text-[var(--color-fog-500)]">({l.availableSlabs} avail)</span>
                    </td>
                    <td className="text-right text-[var(--color-text-secondary)]">{l.availableSf.toLocaleString()}</td>
                    {canViewCost && (
                      <td className="text-right text-[var(--color-vein)]">
                        {l.value != null ? `$${l.value.toLocaleString()}` : '—'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bp-card overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--color-basalt-500)] flex items-center gap-2">
              <Layers size={15} className="text-[var(--color-coral)]" />
              <h3 className="text-[14px] font-medium text-white">Inventory by Category</h3>
            </div>
            <table className="bp-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="text-right">Slabs</th>
                  <th className="text-right">Avail. SF</th>
                </tr>
              </thead>
              <tbody>
                {overview.byCategory.map((c) => (
                  <tr key={c.category}>
                    <td className="text-white">{c.category}</td>
                    <td className="text-right text-white">{c.slabs}</td>
                    <td className="text-right text-[var(--color-text-secondary)]">{c.availableSf.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="bp-eyebrow mb-3">Jump to</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {tiles.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="bp-card-interactive p-4 flex items-center gap-3"
              >
                <div className="p-2 rounded-[var(--radius-md)] bg-[var(--color-basalt-700)] text-[var(--color-sodalite)]">
                  <t.icon size={16} />
                </div>
                <span className="text-[13px] text-white">{t.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
