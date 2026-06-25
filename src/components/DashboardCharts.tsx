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

export function DashboardCharts({ data }: { data: DashboardData }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {data.inventoryByLocation.length > 0 && (
        <Panel title="Inventory Value by Location ($)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.inventoryByLocation} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333234" vertical={false} />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis {...axisProps} width={48} />
              <Tooltip cursor={{ fill: '#33323433' }} contentStyle={{ background: '#2b2a2c', border: '1px solid #454446', borderRadius: 6, fontSize: 12 }} formatter={moneyFmt} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {data.inventoryByLocation.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      )}

      <Panel title="Open Pipeline by Stage ($)">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.pipelineByStage} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333234" vertical={false} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} width={48} />
            <Tooltip cursor={{ fill: '#33323433' }} contentStyle={{ background: '#2b2a2c', border: '1px solid #454446', borderRadius: 6, fontSize: 12 }} formatter={moneyFmt} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.pipelineByStage.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Purchase Orders by Stage">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.poByStatus} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333234" vertical={false} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} width={32} allowDecimals={false} />
            <Tooltip cursor={{ fill: '#33323433' }} contentStyle={{ background: '#2b2a2c', border: '1px solid #454446', borderRadius: 6, fontSize: 12 }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.poByStatus.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Closed Sales by Associate ($)">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.salesByAssociate} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333234" vertical={false} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} width={48} />
            <Tooltip cursor={{ fill: '#33323433' }} contentStyle={{ background: '#2b2a2c', border: '1px solid #454446', borderRadius: 6, fontSize: 12 }} formatter={moneyFmt} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.salesByAssociate.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
}
