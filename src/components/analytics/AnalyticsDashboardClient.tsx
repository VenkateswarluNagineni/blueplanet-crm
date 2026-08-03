'use client';

import React, { useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  Package,
  BarChart3,
  Download,
  Filter,
} from 'lucide-react';
import type { PoRow } from '@/server/purchasing/queries';
import type { OrderRow } from '@/server/orders/queries';
import type { CatalogProduct } from '@/server/catalog/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { EmptyState } from '@/components/ui/EmptyState';
import { swatchBaseForMaterial } from '@/lib/domain/material-swatch';

export default function AnalyticsDashboardClient({
  purchaseOrders,
  salesOrders,
  catalog,
}: {
  purchaseOrders: PoRow[];
  salesOrders: OrderRow[];
  catalog: CatalogProduct[];
}) {
  const [filterType, setFilterType] = useState('ALL');

  const totalLandedCost = purchaseOrders.reduce(
    (sum, po) => sum + po.orderedSlabs * po.unitCost * 45,
    0,
  );

  const totalBookedRevenue = salesOrders.reduce((sum, so) => sum + so.totalValue, 0);

  const totalSoldSqft = salesOrders.reduce((sum, so) => sum + so.sqft, 0);
  const costSamples = catalog.filter((c) => c.avgCostPerSf != null && c.avgCostPerSf > 0);
  const avgCostAcrossCatalog =
    costSamples.length > 0
      ? costSamples.reduce((sum, c) => sum + (c.avgCostPerSf as number), 0) / costSamples.length
      : null;
  const estimatedCostOfGoodsSold =
    avgCostAcrossCatalog != null ? totalSoldSqft * avgCostAcrossCatalog : null;
  const netMarginValue =
    estimatedCostOfGoodsSold != null ? totalBookedRevenue - estimatedCostOfGoodsSold : null;
  const netMarginPercent =
    netMarginValue != null && totalBookedRevenue > 0
      ? (netMarginValue / totalBookedRevenue) * 100
      : null;

  const physicalInventoryValue = catalog.reduce((sum, sku) => {
    const unit = sku.avgCostPerSf ?? 0;
    return sum + sku.slabsInYard * 45 * unit;
  }, 0);

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
            <button
              type="button"
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
              className="btn-secondary !min-h-8 !px-3 text-[12px]"
            >
              <Download size={14} /> Export JSON
            </button>
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
              {netMarginValue != null
                ? `Est. yield ${usd(Math.max(0, netMarginValue))}`
                : 'Needs cost visibility on catalog lines'}
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
              Active warehouse inventory at avg cost
            </div>
          </div>
        </div>

        <div className="bp-table-shell flex flex-col">
          <div className="px-5 py-3 border-b border-[var(--color-basalt-500)] bg-[var(--color-basalt-700)] flex flex-wrap justify-between items-center gap-3">
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
                          {margin != null ? (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                margin >= 40
                                  ? 'bg-[rgba(16,185,129,0.1)] text-[var(--color-emerald)]'
                                  : 'bg-[rgba(232,149,107,0.1)] text-[var(--color-coral)]'
                              }`}
                            >
                              {margin.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-[var(--color-fog-500)]">—</span>
                          )}
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
