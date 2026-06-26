'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  Boxes,
  Truck,
  Briefcase,
  TrendingUp,
  DollarSign,
  CheckCircle,
  Sliders,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Check,
} from 'lucide-react';
import type { DashboardData } from '@/server/queries/dashboard';
import { ChartWidget, type ChartKey } from '@/components/DashboardCharts';
import { setDashboardLayoutAction } from '@/server/actions/dashboard';

type Kind = 'kpi' | 'chart';
type IconType = React.ComponentType<{ size?: number; className?: string }>;

type WidgetDef = {
  key: string;
  label: string;
  kind: Kind;
  requiresCost?: boolean;
  // KPI-only presentation
  icon?: IconType;
  accent?: string;
  value?: (d: DashboardData) => string;
  // chart-only
  chartKey?: ChartKey;
};

const usd = (n: number) => `$${n.toLocaleString()}`;
const num = (n: number) => n.toLocaleString();

// The full catalog of widgets. Cost-gated widgets are filtered out for roles
// that may not see landed cost, so a sales rep can never add them.
const CATALOG: WidgetDef[] = [
  { key: 'kpi:inventoryValue', label: 'Inventory Value', kind: 'kpi', requiresCost: true, icon: DollarSign, accent: '#e3c16c', value: (d) => usd(d.kpis.inventoryValue) },
  { key: 'kpi:availableSlabs', label: 'Available Slabs', kind: 'kpi', icon: Boxes, accent: '#92b0ce', value: (d) => num(d.kpis.availableSlabs) },
  { key: 'kpi:inTransitPos', label: 'POs In Transit', kind: 'kpi', icon: Truck, accent: '#e8956b', value: (d) => num(d.kpis.inTransitPos) },
  { key: 'kpi:openPipelineValue', label: 'Open Pipeline', kind: 'kpi', icon: Briefcase, accent: '#b58cd6', value: (d) => usd(d.kpis.openPipelineValue) },
  { key: 'kpi:ytdSales', label: 'YTD Closed Sales', kind: 'kpi', icon: TrendingUp, accent: '#10b981', value: (d) => usd(d.kpis.ytdSales) },
  { key: 'kpi:pendingApprovals', label: 'Pending Approvals', kind: 'kpi', icon: CheckCircle, accent: '#5db5b5', value: (d) => num(d.kpis.pendingApprovals) },
  { key: 'chart:inventoryByLocation', label: 'Inventory by Location', kind: 'chart', requiresCost: true, chartKey: 'inventoryByLocation' },
  { key: 'chart:pipelineByStage', label: 'Pipeline by Stage', kind: 'chart', chartKey: 'pipelineByStage' },
  { key: 'chart:poByStatus', label: 'Purchase Orders by Stage', kind: 'chart', chartKey: 'poByStatus' },
  { key: 'chart:salesByAssociate', label: 'Sales by Associate', kind: 'chart', chartKey: 'salesByAssociate' },
];

function KpiCard({ def, data }: { def: WidgetDef; data: DashboardData }) {
  const Icon = def.icon!;
  return (
    <div className="bg-[#1c1c1c] border border-[#454446] rounded-xl p-5 hover:border-[#5a595c] transition-all shadow-md hover:shadow-lg h-full">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-inner" style={{ background: `${def.accent}1a`, color: def.accent }}>
          <Icon size={16} />
        </div>
        <p className="text-[11px] uppercase tracking-wider text-[#b8b6b9] font-medium leading-tight">{def.label}</p>
      </div>
      <p className="text-[22px] font-medium text-white tabular-nums tracking-tight" style={{ fontFamily: 'var(--font-fraunces), serif' }}>
        {def.value!(data)}
      </p>
    </div>
  );
}

// Edit-mode controls overlaid on each placed widget: reorder within its row, or remove.
function EditControls({
  onLeft,
  onRight,
  onRemove,
  canLeft,
  canRight,
}: {
  onLeft: () => void;
  onRight: () => void;
  onRemove: () => void;
  canLeft: boolean;
  canRight: boolean;
}) {
  return (
    <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-[#0f0f0f]/90 border border-[#454446] rounded-lg px-1 py-0.5 shadow-lg">
      <button onClick={onLeft} disabled={!canLeft} className="p-1 rounded text-[#b8b6b9] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed" title="Move earlier"><ChevronLeft size={14} /></button>
      <button onClick={onRight} disabled={!canRight} className="p-1 rounded text-[#b8b6b9] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed" title="Move later"><ChevronRight size={14} /></button>
      <button onClick={onRemove} className="p-1 rounded text-[#e8956b] hover:text-white" title="Remove widget"><X size={14} /></button>
    </div>
  );
}

export function CustomizableDashboard({
  data,
  canViewCost,
  defaultLayout,
  initialLayout,
}: {
  data: DashboardData;
  canViewCost: boolean;
  /** Role-appropriate default ordering of widget keys. */
  defaultLayout: string[];
  /** The user's saved layout, or null to use the default. */
  initialLayout: string[] | null;
}) {
  const byKey = useMemo(() => new Map(CATALOG.map((w) => [w.key, w])), []);

  // Only widgets allowed for this viewer (cost gating). Saved layouts are sanitized
  // against this so a stale key (e.g. a cost widget after a permission change) is dropped.
  const allowed = useMemo(
    () => CATALOG.filter((w) => (w.requiresCost ? canViewCost : true)),
    [canViewCost],
  );
  const allowedKeys = useMemo(() => new Set(allowed.map((w) => w.key)), [allowed]);

  const sanitize = (keys: string[]) => keys.filter((k) => allowedKeys.has(k));
  const cleanDefault = sanitize(defaultLayout);

  const [layout, setLayout] = useState<string[]>(
    initialLayout ? sanitize(initialLayout) : cleanDefault,
  );
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const persist = (next: string[]) => {
    setLayout(next);
    startTransition(async () => {
      await setDashboardLayoutAction(next);
    });
  };

  const remove = (key: string) => persist(layout.filter((k) => k !== key));
  const add = (key: string) => {
    if (layout.includes(key)) return;
    persist([...layout, key]);
  };
  const reset = () => persist(cleanDefault);

  // Move a widget earlier/later, swapping only with the nearest neighbor of the
  // same kind so KPI cards and charts each reorder within their own row.
  const move = (key: string, dir: -1 | 1) => {
    const def = byKey.get(key);
    if (!def) return;
    const next = [...layout];
    const idx = next.indexOf(key);
    let swap = -1;
    for (let j = idx + dir; j >= 0 && j < next.length; j += dir) {
      if (byKey.get(next[j])?.kind === def.kind) { swap = j; break; }
    }
    if (swap === -1) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    persist(next);
  };

  const placedKpis = layout.filter((k) => byKey.get(k)?.kind === 'kpi');
  const placedCharts = layout.filter((k) => byKey.get(k)?.kind === 'chart');
  const available = allowed.filter((w) => !layout.includes(w.key));

  const neighborIndex = (key: string, dir: -1 | 1): number => {
    const def = byKey.get(key);
    const idx = layout.indexOf(key);
    for (let j = idx + dir; j >= 0 && j < layout.length; j += dir) {
      if (byKey.get(layout[j])?.kind === def?.kind) return j;
    }
    return -1;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        {pending && <span className="text-[11px] text-[#b8b6b9]">Saving…</span>}
        {editing && (
          <button onClick={reset} className="flex items-center gap-1.5 text-[12px] text-[#b8b6b9] hover:text-white border border-[#454446] rounded-lg px-2.5 py-1.5 transition-colors" title="Reset to the default layout for your role">
            <RotateCcw size={13} /> Reset
          </button>
        )}
        <button
          onClick={() => setEditing((v) => !v)}
          className={`flex items-center gap-1.5 text-[12px] rounded-lg px-2.5 py-1.5 transition-colors border ${editing ? 'bg-[#e3c16c] text-[#1c1c1c] border-[#e3c16c] font-medium' : 'text-[#b8b6b9] hover:text-white border-[#454446]'}`}
        >
          {editing ? <><Check size={13} /> Done</> : <><Sliders size={13} /> Customize</>}
        </button>
      </div>

      {editing && available.length > 0 && (
        <div className="bg-[#1c1c1c] border border-dashed border-[#454446] rounded-xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-[#b8b6b9] font-medium mb-3">Add a widget</p>
          <div className="flex flex-wrap gap-2">
            {available.map((w) => (
              <button
                key={w.key}
                onClick={() => add(w.key)}
                className="flex items-center gap-1.5 text-[12px] text-white bg-[#2b2a2c] hover:bg-[#353436] border border-[#454446] rounded-lg px-2.5 py-1.5 transition-colors"
              >
                <Plus size={13} className="text-[#10b981]" /> {w.label}
                <span className="text-[10px] text-[#b8b6b9] uppercase">{w.kind}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {placedKpis.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {placedKpis.map((key) => {
            const def = byKey.get(key);
            if (!def) return null;
            return (
              <div key={key} className="relative">
                {editing && (
                  <EditControls
                    onLeft={() => move(key, -1)}
                    onRight={() => move(key, 1)}
                    onRemove={() => remove(key)}
                    canLeft={neighborIndex(key, -1) !== -1}
                    canRight={neighborIndex(key, 1) !== -1}
                  />
                )}
                <KpiCard def={def} data={data} />
              </div>
            );
          })}
        </div>
      )}

      {placedCharts.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {placedCharts.map((key) => {
            const def = byKey.get(key);
            if (!def?.chartKey) return null;
            return (
              <div key={key} className="relative">
                {editing && (
                  <EditControls
                    onLeft={() => move(key, -1)}
                    onRight={() => move(key, 1)}
                    onRemove={() => remove(key)}
                    canLeft={neighborIndex(key, -1) !== -1}
                    canRight={neighborIndex(key, 1) !== -1}
                  />
                )}
                <ChartWidget chartKey={def.chartKey} data={data} />
              </div>
            );
          })}
        </div>
      )}

      {layout.length === 0 && (
        <div className="bg-[#1c1c1c] border border-dashed border-[#454446] rounded-xl p-10 text-center">
          <p className="text-[13px] text-[#b8b6b9]">Your dashboard is empty. Click <span className="text-white font-medium">Customize</span> to add widgets.</p>
        </div>
      )}
    </div>
  );
}
