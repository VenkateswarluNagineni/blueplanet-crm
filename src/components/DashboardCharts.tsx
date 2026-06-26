'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
} from 'recharts';
import type { DashboardData } from '@/server/queries/dashboard';

const PALETTE = ['#e3c16c', '#92b0ce', '#10b981', '#e8956b', '#b58cd6', '#5db5b5'];

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#1c1c1c] border border-[#454446] rounded-lg p-5">
      <h3 className="text-[13px] font-medium text-white mb-4">{title}</h3>
      <div className="h-[220px]">{children}</div>
    </div>
  );
}

const axisProps = { stroke: '#b8b6b9', fontSize: 11, tickLine: false } as const;

const moneyFmt = (value: unknown): [string, string] => [`$${Number(value).toLocaleString()}`, ''];

/** A single bar chart over a {name,value}[] series — the unit the dashboard composes. */
function BarPanel({
  title,
  rows,
  money,
  decimals = false,
}: {
  title: string;
  rows: { name: string; value: number }[];
  money: boolean;
  decimals?: boolean;
}) {
  return (
    <Panel title={title}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333234" vertical={false} />
          <XAxis dataKey="name" {...axisProps} />
          <YAxis {...axisProps} width={money ? 48 : 32} allowDecimals={decimals} />
          <Tooltip
            cursor={{ fill: '#33323433' }}
            contentStyle={{ background: '#2b2a2c', border: '1px solid #454446', borderRadius: 6, fontSize: 12 }}
            formatter={money ? moneyFmt : undefined}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {rows.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Panel>
  );
}

/** Keys that select a chart widget — kept in sync with the dashboard widget catalog. */
export type ChartKey = 'inventoryByLocation' | 'pipelineByStage' | 'poByStatus' | 'salesByAssociate';

export const CHART_TITLES: Record<ChartKey, string> = {
  inventoryByLocation: 'Inventory Value by Location ($)',
  pipelineByStage: 'Open Pipeline by Stage ($)',
  poByStatus: 'Purchase Orders by Stage',
  salesByAssociate: 'Closed Sales by Associate ($)',
};

/** Render one chart by key, sourcing its series from the shared dashboard payload. */
export function ChartWidget({ chartKey, data }: { chartKey: ChartKey; data: DashboardData }) {
  switch (chartKey) {
    case 'inventoryByLocation':
      return <BarPanel title={CHART_TITLES.inventoryByLocation} rows={data.inventoryByLocation} money />;
    case 'pipelineByStage':
      return <BarPanel title={CHART_TITLES.pipelineByStage} rows={data.pipelineByStage} money />;
    case 'poByStatus':
      return <BarPanel title={CHART_TITLES.poByStatus} rows={data.poByStatus} money={false} decimals={false} />;
    case 'salesByAssociate':
      return <BarPanel title={CHART_TITLES.salesByAssociate} rows={data.salesByAssociate} money />;
    default:
      return null;
  }
}

/** The fixed four-up chart grid, still used by the vendor portal. */
export function DashboardCharts({ data }: { data: DashboardData }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {data.inventoryByLocation.length > 0 && <ChartWidget chartKey="inventoryByLocation" data={data} />}
      <ChartWidget chartKey="pipelineByStage" data={data} />
      <ChartWidget chartKey="poByStatus" data={data} />
      <ChartWidget chartKey="salesByAssociate" data={data} />
    </div>
  );
}
