'use client';

import React, { useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  Package,
  BarChart3,
  Download,
  Filter,
  Clock,
  Layers,
} from 'lucide-react';
import type { PoRow } from '@/server/purchasing/queries';
import type { OrderRow } from '@/server/orders/queries';
import type { CatalogProduct } from '@/server/catalog/queries';
import type { LandedCostSummary, InventoryAgingReport, MaterialMarginRow } from '@/server/analytics/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { EmptyState } from '@/components/ui/EmptyState';
import { swatchBaseForMaterial } from '@/lib/domain/material-swatch';
import { Button } from '@/components/ui/Button';
import { MarginPill } from '@/components/ui/MarginPill';

export default function AnalyticsDashboardClient({
  purchaseOrders,
  salesOrders,
  catalog,
  landedCostSummary,
  inventoryAging,
  marginByMaterial,
}: {
  purchaseOrders: PoRow[];
  salesOrders: OrderRow[];
  catalog: CatalogProduct[];
  landedCostSummary: LandedCostSummary;
  inventoryAging: InventoryAgingReport;
  marginByMaterial: MaterialMarginRow[];
}) {
  const [filterType, setFilterType] = useState('ALL');

  // Material cost is still a per-PO estimate for slabs not yet received (no real
  // per-slab data exists before receipt) — but freight legs are real, already-paid
  // totals, so include them rather than silently dropping them from capital deployed.
  const totalLandedCost = purchaseOrders.reduce(
    (sum, po) => sum + po.orderedSlabs * po.unitCost * 45 + po.oceanCost + po.customsCost + po.inlandCost,
    0,
  );

  const totalBookedRevenue = salesOrders.reduce((sum, so) => sum + so.totalValue, 0);

  // Real COGS: the immutable per-slab landed cost snapshotted at sale — not a catalog-average guess.
  const netMarginValue = totalBookedRevenue - landedCostSummary.realCogs;
  const netMarginPercent = totalBookedRevenue > 0 ? (netMarginValue / totalBookedRevenue) * 100 : null;

  // Real landed cost of every available slab — not a hardcoded-sf-per-slab guess.
  const physicalInventoryValue = landedCostSummary.yardLandedCost;

  const agedCapital180Plus =
    inventoryAging.buckets.find((b) => b.label === '180+')?.capitalTiedUp ?? 0;

  const filteredCatalog = catalog.filter((sku) => {
    if (filterType === 'HIGH_VELOCITY') return sku.slabsOnHold + sku.slabsInTransit > sku.slabsInYard;
    if (filterType === 'LOW_STOCK') return sku.slabsInYard <= 5;
    return true;
  });

  const usd = (n: number, digits = 0) =>
    `$${n.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits })}`;

  return (
    <PageShell
      header={
        <PageHeader
          eyebrow="Analytics"
          title="Profitability"
          subtitle="Booked sales, inbound capital, and material spread by line."
          meta={[
            { label: `${catalog.length} lines`, tone: 'neutral' },
            { label: `${salesOrders.length} orders`, tone: 'blue' },
          ]}
          actions={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                const blob = new Blob(
                  [
                    JSON.stringify(
                      {
                        exportedAt: new Date().toISOString(),
                        totalBookedRevenue,
                        totalLandedCost,
                        physicalInventoryValue,
                        lines: filteredCatalog.map((s) => ({
                          name: s.name,
                          sku: s.sku,
                          materialType: s.materialType,
                          yard: s.slabsInYard,
                          cost: s.avgCostPerSf,
                          retail: s.retailPricePerSf,
                        })),
                      },
                      null,
                      2,
                    ),
                  ],
                  { type: 'application/json' },
                );
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `blueplanet-ledger-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download size={14} /> Export JSON
            </Button>
          }
        />
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bp-card p-5">
            <div className="flex justify-between items-start mb-3">
              <span className="bp-eyebrow">Booked revenue</span>
              <div className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center bg-[rgba(146,176,206,0.12)] text-[var(--color-sodalite)] border border-white/[0.04]">
                <DollarSign size={16} />
              </div>
            </div>
            <div className="bp-kpi-value mb-1">{usd(totalBookedRevenue, 2)}</div>
            <div className="text-[11px] text-[var(--color-text-secondary)]">
              {salesOrders.length} sales order{salesOrders.length === 1 ? '' : 's'}
            </div>
          </div>

          <div className="bp-card p-5">
            <div className="flex justify-between items-start mb-3">
              <span className="bp-eyebrow">Capital deployed</span>
              <div className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center bg-[rgba(232,149,107,0.12)] text-[var(--color-coral)] border border-white/[0.04]">
                <Package size={16} />
              </div>
            </div>
            <div className="bp-kpi-value mb-1">{usd(totalLandedCost, 2)}</div>
            <div className="text-[11px] text-[var(--color-text-secondary)]">
              {purchaseOrders.length} purchase order{purchaseOrders.length === 1 ? '' : 's'}
            </div>
          </div>

          <div className="bp-card p-5">
            <div className="flex justify-between items-start mb-3">
              <span className="bp-eyebrow">Est. net margin</span>
              <div className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center bg-[rgba(16,185,129,0.12)] text-[var(--color-emerald)] border border-white/[0.04]">
                <TrendingUp size={16} />
              </div>
            </div>
            <div className="bp-kpi-value text-[var(--color-emerald)] mb-1">
              {netMarginPercent != null ? `${netMarginPercent.toFixed(1)}%` : '—'}
            </div>
            <div className="text-[11px] text-[var(--color-text-secondary)]">
              Yield {usd(Math.max(0, netMarginValue))}
            </div>
          </div>

          <div className="bp-card p-5">
            <div className="flex justify-between items-start mb-3">
              <span className="bp-eyebrow">Yard valuation</span>
              <div className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center bg-[rgba(181,140,214,0.12)] text-[var(--color-amethyst)] border border-white/[0.04]">
                <BarChart3 size={16} />
              </div>
            </div>
            <div className="bp-kpi-value mb-1">{usd(physicalInventoryValue)}</div>
            <div className="text-[11px] text-[var(--color-text-secondary)]">
              Active warehouse inventory, landed cost
            </div>
          </div>
        </div>

        <div className="bp-table-shell flex flex-col">
          <div className="px-5 py-3 border-b border-[var(--color-basalt-500)] flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-white font-medium text-[14px] truncate">Inventory aging</h3>
            </div>
            <div className="text-[12px] text-[var(--color-text-secondary)]">
              {usd(agedCapital180Plus)} tied up 180+ days
            </div>
          </div>

          {inventoryAging.buckets.every((b) => b.count === 0) ? (
            <div className="p-8">
              <EmptyState
                icon={Clock}
                title="No yard stock yet"
                hint="Aging appears here once slabs are received into inventory."
              />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="bp-table min-w-max">
                  <thead>
                    <tr>
                      <th>Age in yard</th>
                      <th className="text-center">Slabs</th>
                      <th className="text-right">Sqft</th>
                      <th className="text-right">Capital tied up</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryAging.buckets.map((bucket) => (
                      <tr key={bucket.label}>
                        <td className="font-medium text-white">{bucket.label} days</td>
                        <td className="text-center text-white font-medium tabular-nums">{bucket.count}</td>
                        <td className="text-right bp-mono tabular-nums text-[var(--color-text-secondary)]">
                          {bucket.totalSf.toFixed(1)}
                        </td>
                        <td className="text-right bp-mono tabular-nums text-[var(--color-text-secondary)]">
                          {usd(bucket.capitalTiedUp)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {inventoryAging.oldestSlabs.length > 0 && (
                <div className="border-t border-[var(--color-basalt-500)]">
                  <div className="px-5 py-2.5">
                    <h4 className="text-[12px] text-[var(--color-text-secondary)] font-medium">Oldest stock</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="bp-table min-w-max">
                      <thead>
                        <tr>
                          <th>Slab</th>
                          <th>Material</th>
                          <th className="text-right">Days in yard</th>
                          <th className="text-right">Capital tied up</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventoryAging.oldestSlabs.map((slab) => (
                          <tr key={slab.id}>
                            <td className="bp-mono text-[var(--color-text-secondary)]">{slab.uniqueSlabId}</td>
                            <td className="text-white">{slab.materialName}</td>
                            <td className="text-right bp-mono tabular-nums text-white font-medium">
                              {slab.daysInYard}
                            </td>
                            <td className="text-right bp-mono tabular-nums text-[var(--color-text-secondary)]">
                              {usd(slab.capitalTiedUp)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="bp-table-shell flex flex-col">
          <div className="px-5 py-3 border-b border-[var(--color-basalt-500)] flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-white font-medium text-[14px] truncate">Margin by material</h3>
              <span className="text-[11px] bg-[var(--color-basalt-900)] text-[var(--color-text-secondary)] px-2.5 py-0.5 rounded-full border border-[var(--color-basalt-500)] bp-mono shrink-0">
                {marginByMaterial.length}
              </span>
            </div>
          </div>

          {marginByMaterial.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Layers}
                title="No completed sales yet"
                hint="Realized margin by material appears here once orders are marked complete."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="bp-table min-w-max">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th className="text-center">Orders</th>
                    <th className="text-right">Revenue</th>
                    <th className="text-right">Real COGS</th>
                    <th className="text-right">Margin $</th>
                    <th className="text-right">Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {marginByMaterial.map((row) => (
                    <tr key={row.materialType}>
                      <td className="font-medium text-white">
                        <span className="inline-flex items-center gap-2.5 min-w-0">
                          <span
                            className="bp-swatch shrink-0"
                            style={{
                              ['--swatch-base' as string]: swatchBaseForMaterial(row.materialType, null),
                              width: 16,
                              height: 16,
                            }}
                            aria-hidden
                          />
                          <span className="truncate">{row.materialType}</span>
                        </span>
                      </td>
                      <td className="text-center text-white font-medium tabular-nums">{row.orderCount}</td>
                      <td className="text-right bp-mono tabular-nums text-[var(--color-text-secondary)]">
                        {usd(row.revenue)}
                      </td>
                      <td className="text-right bp-mono tabular-nums text-[var(--color-coral)]">
                        {usd(row.realCogs)}
                      </td>
                      <td className="text-right bp-mono tabular-nums text-white font-medium">
                        {usd(row.marginValue)}
                      </td>
                      <td className="text-right">
                        <MarginPill percent={row.marginPercent} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bp-table-shell flex flex-col">
          <div className="px-5 py-3 border-b border-[var(--color-basalt-500)] flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-white font-medium text-[14px] truncate">Material ledger</h3>
              <span className="text-[11px] bg-[var(--color-basalt-900)] text-[var(--color-text-secondary)] px-2.5 py-0.5 rounded-full border border-[var(--color-basalt-500)] bp-mono shrink-0">
                {filteredCatalog.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[12px] text-[var(--color-text-secondary)] flex items-center gap-1">
                <Filter size={12} /> Filter
              </span>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bp-select h-8 text-[12px] py-0"
                aria-label="Filter material ledger"
              >
                <option value="ALL">All materials</option>
                <option value="HIGH_VELOCITY">High demand (hold &gt; yard)</option>
                <option value="LOW_STOCK">Low reserve (≤ 5 slabs)</option>
              </select>
            </div>
          </div>

          {filteredCatalog.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={BarChart3}
                title="No lines match"
                hint="Change the filter or add materials to the catalog."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="bp-table min-w-max">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Origin / type</th>
                    <th className="text-right">Landed $/sf</th>
                    <th className="text-right">Retail $/sf</th>
                    <th className="text-right">Spread</th>
                    <th className="text-center">Yard</th>
                    <th className="text-center">State</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCatalog.map((sku) => {
                    const cost = sku.avgCostPerSf;
                    const retail = sku.retailPricePerSf;
                    const margin =
                      cost != null && retail != null && retail > 0
                        ? ((retail - cost) / retail) * 100
                        : null;
                    const isHighDemand =
                      sku.slabsOnHold + sku.slabsInTransit > sku.slabsInYard;
                    const isLowStock = sku.slabsInYard <= 5;

                    return (
                      <tr key={sku.id}>
                        <td className="font-medium text-white">
                          <span className="inline-flex items-center gap-2.5 min-w-0">
                            <span
                              className="bp-swatch shrink-0"
                              style={{
                                ['--swatch-base' as string]: swatchBaseForMaterial(
                                  sku.materialType,
                                  sku.baseColor,
                                ),
                                width: 16,
                                height: 16,
                              }}
                              aria-hidden
                            />
                            <span className="truncate">{sku.name}</span>
                          </span>
                        </td>
                        <td className="text-[var(--color-text-secondary)]">
                          {sku.originCountry ?? '—'} · {sku.materialType}
                        </td>
                        <td className="text-right bp-mono tabular-nums text-[var(--color-text-secondary)]">
                          {cost != null ? (
                            <span className="text-[var(--color-coral)]">${cost.toFixed(2)}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="text-right bp-mono tabular-nums text-[var(--color-sodalite)] font-medium">
                          {retail != null ? `$${retail.toFixed(2)}` : '—'}
                        </td>
                        <td className="text-right">
                          <MarginPill percent={margin} />
                        </td>
                        <td className="text-center text-white font-medium tabular-nums">
                          {sku.slabsInYard}
                        </td>
                        <td className="text-center">
                          {isLowStock ? (
                            <span className="bg-[rgba(239,68,68,0.1)] text-[var(--color-ruby)] border border-[rgba(239,68,68,0.25)] px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider">
                              Low reserve
                            </span>
                          ) : isHighDemand ? (
                            <span className="bg-[rgba(146,176,206,0.1)] text-[var(--color-sodalite)] border border-[rgba(146,176,206,0.25)] px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider">
                              High demand
                            </span>
                          ) : (
                            <span className="bg-[var(--color-basalt-700)] text-[var(--color-fog-500)] border border-[var(--color-basalt-500)] px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider">
                              Stable
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
