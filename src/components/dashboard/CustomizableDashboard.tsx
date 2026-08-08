'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
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
  ArrowUpRight,
  AlertTriangle,
  Clock,
  Target,
  PauseCircle,
} from 'lucide-react';
import type { DashboardData } from '@/server/dashboard/queries';
import { ChartWidget, type ChartKey } from '@/components/dashboard/DashboardCharts';
import { setDashboardLayoutAction } from '@/server/dashboard/actions';
import { useRole } from '@/context/RoleContext';
import { ACCENT } from '@/lib/ui/statusColors';
import { Button } from '@/components/ui/Button';

type Kind = 'kpi' | 'chart';
type IconType = React.ComponentType<{ size?: number; className?: string }>;
type AppRole = 'ADMIN' | 'SALES' | 'VENDOR';

type WidgetDef = {
  key: string;
  label: string;
  kind: Kind;
  requiresCost?: boolean;
  /** Admin-only widgets (hidden for sales in catalog + sanitized from layout). */
  adminOnly?: boolean;
  icon?: IconType;
  accent?: string;
  value?: (d: DashboardData) => string;
  /** Role-safe deep link. Return null when this role should not navigate. */
  href?: (role: AppRole) => string | null;
  chartKey?: ChartKey;
};

const usd = (n: number) => `$${n.toLocaleString()}`;
const num = (n: number) => n.toLocaleString();

const CATALOG: WidgetDef[] = [
  {
    key: 'kpi:inventoryValue',
    label: 'Inventory Value',
    kind: 'kpi',
    requiresCost: true,
    icon: DollarSign,
    accent: ACCENT.gold,
    value: (d) => usd(d.kpis.inventoryValue),
    href: () => '/inventory/overview',
  },
  {
    key: 'kpi:availableSlabs',
    label: 'Available Slabs',
    kind: 'kpi',
    icon: Boxes,
    accent: ACCENT.sodalite,
    value: (d) => num(d.kpis.availableSlabs),
    href: () => '/inventory?status=AVAILABLE',
  },
  {
    key: 'kpi:inTransitPos',
    label: 'POs In Transit',
    kind: 'kpi',
    icon: Truck,
    accent: ACCENT.coral,
    value: (d) => num(d.kpis.inTransitPos),
    // Sales cannot open logistics — send them to inventory overview instead.
    href: (role) => (role === 'ADMIN' ? '/logistics' : '/inventory/overview'),
  },
  {
    key: 'kpi:openPipelineValue',
    label: 'Open Pipeline',
    kind: 'kpi',
    icon: Briefcase,
    accent: ACCENT.amethyst,
    value: (d) => usd(d.kpis.openPipelineValue),
    href: () => '/pipeline',
  },
  {
    key: 'kpi:ytdSales',
    label: 'YTD Closed Sales',
    kind: 'kpi',
    icon: TrendingUp,
    accent: ACCENT.emerald,
    value: (d) => usd(d.kpis.ytdSales),
    href: () => '/orders?status=COMPLETED',
  },
  {
    key: 'kpi:pendingApprovals',
    label: 'Pending Approvals',
    kind: 'kpi',
    adminOnly: true,
    icon: CheckCircle,
    accent: ACCENT.sodalite,
    value: (d) => num(d.kpis.pendingApprovals),
    href: (role) => (role === 'ADMIN' ? '/admin/approvals' : null),
  },
  {
    key: 'chart:inventoryByLocation',
    label: 'Inventory by Location',
    kind: 'chart',
    requiresCost: true,
    chartKey: 'inventoryByLocation',
    href: () => '/inventory/overview',
  },
  {
    key: 'chart:pipelineByStage',
    label: 'Pipeline by Stage',
    kind: 'chart',
    chartKey: 'pipelineByStage',
    href: () => '/pipeline',
  },
  {
    key: 'chart:poByStatus',
    label: 'Purchase Orders by Stage',
    kind: 'chart',
    chartKey: 'poByStatus',
    href: (role) => (role === 'ADMIN' ? '/purchases' : null),
  },
  {
    key: 'chart:salesByAssociate',
    label: 'Sales by Associate',
    kind: 'chart',
    chartKey: 'salesByAssociate',
    href: () => '/orders',
  },
];

function KpiCard({
  def,
  data,
  href,
  editing,
}: {
  def: WidgetDef;
  data: DashboardData;
  href: string | null;
  editing: boolean;
}) {
  const Icon = def.icon!;
  const interactive = !!href && !editing;

  const inner = (
    <>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center shrink-0 border border-white/[0.04]"
            style={{ background: `${def.accent}14`, color: def.accent }}
          >
            <Icon size={15} />
          </div>
          <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-fog-500)] font-semibold leading-tight">
            {def.label}
          </p>
        </div>
        {interactive && (
          <ArrowUpRight
            size={14}
            className="text-[var(--color-fog-500)] opacity-0 group-hover:opacity-100 group-hover:text-[var(--color-vein)] transition-all shrink-0"
            aria-hidden
          />
        )}
      </div>
      <p className="bp-kpi-value text-[22px]">{def.value!(data)}</p>
    </>
  );

  const shellClass = `block p-5 h-full ${
    interactive
      ? 'bp-card-interactive cursor-pointer group focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-vein)] focus-visible:outline-offset-2'
      : 'bp-card'
  }`;

  if (interactive && href) {
    return (
      <Link href={href} className={shellClass} title={`Go to ${def.label}`}>
        {inner}
      </Link>
    );
  }

  return <div className={shellClass}>{inner}</div>;
}

function AttentionStrip({ data, role }: { data: DashboardData; role: AppRole }) {
  const a = data.attention;
  type Item = {
    id: string;
    label: string;
    count: number;
    href: string;
    icon: IconType;
    tone: string;
    show: boolean;
    urgent?: boolean;
  };

  const items: Item[] = [
    {
      id: 'approvals',
      label: 'Approvals waiting',
      count: a.pendingApprovals,
      href: '/admin/approvals',
      icon: CheckCircle,
      tone: '#92b0ce',
      show: role === 'ADMIN' && a.pendingApprovals > 0,
      urgent: a.pendingApprovals > 0,
    },
    {
      id: 'overdue',
      label: 'Overdue shipments',
      count: a.overduePos,
      href: '/logistics',
      icon: AlertTriangle,
      tone: '#e8956b',
      show: role === 'ADMIN' && a.overduePos > 0,
      urgent: true,
    },
    {
      id: 'holds',
      label: 'Slabs on hold',
      count: a.onHoldSlabs,
      href: '/inventory?status=ON_HOLD',
      icon: PauseCircle,
      tone: '#e3c16c',
      show: a.onHoldSlabs > 0,
      urgent: a.onHoldSlabs > 10,
    },
    {
      id: 'pipeline',
      label: 'Open deals',
      count: a.openPipelineCount,
      href: '/pipeline',
      icon: Target,
      tone: '#b58cd6',
      show: a.openPipelineCount > 0,
    },
    {
      id: 'stock',
      label: 'Slabs ready to sell',
      count: a.availableSlabs,
      href: '/inventory?status=AVAILABLE',
      icon: Boxes,
      tone: '#92b0ce',
      show: a.availableSlabs > 0,
    },
    {
      id: 'orders',
      label: 'Review sales orders',
      count: a.ordersToReview,
      href: '/orders',
      icon: Clock,
      tone: '#10b981',
      show: role === 'SALES' && a.ordersToReview > 0,
    },
  ].filter((i) => i.show);

  const visible = items.filter((i) => i.count > 0).slice(0, 4);

  if (visible.length === 0) return null;

  return (
    <div className="bp-attention">
      <div className="bp-attention-header">
        <span className="bp-eyebrow">Needs attention</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[var(--color-basalt-500)]">
        {visible.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-basalt-800)]/80 transition-colors group"
            >
              <div
                className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center shrink-0"
                style={{ background: `${item.tone}14`, color: item.tone }}
              >
                <Icon size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-[var(--color-text-secondary)] truncate">{item.label}</p>
                <p
                  className={`text-[17px] font-medium tabular-nums tracking-tight ${
                    item.urgent ? 'text-[var(--color-vein)]' : 'text-white'
                  }`}
                  style={{ fontFamily: 'var(--font-heading)' }}
                >
                  {item.count.toLocaleString()}
                </p>
              </div>
              <ArrowUpRight
                size={13}
                className="text-[var(--color-fog-500)] opacity-50 group-hover:opacity-100 group-hover:text-[var(--color-vein)] transition-all shrink-0"
                aria-hidden
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

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
    <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-[var(--color-basalt-950)]/90 border border-[var(--color-basalt-500)] rounded-lg px-1 py-0.5 shadow-lg">
      <button
        onClick={onLeft}
        disabled={!canLeft}
        className="p-1 rounded text-[var(--color-text-secondary)] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
        title="Move earlier"
      >
        <ChevronLeft size={14} />
      </button>
      <button
        onClick={onRight}
        disabled={!canRight}
        className="p-1 rounded text-[var(--color-text-secondary)] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
        title="Move later"
      >
        <ChevronRight size={14} />
      </button>
      <button
        onClick={onRemove}
        className="p-1 rounded text-[var(--color-coral)] hover:text-white"
        title="Remove widget"
      >
        <X size={14} />
      </button>
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
  defaultLayout: string[];
  initialLayout: string[] | null;
}) {
  const { role } = useRole();
  const appRole = role as AppRole;
  const byKey = useMemo(() => new Map(CATALOG.map((w) => [w.key, w])), []);

  const allowed = useMemo(
    () =>
      CATALOG.filter((w) => {
        if (w.requiresCost && !canViewCost) return false;
        if (w.adminOnly && appRole !== 'ADMIN') return false;
        return true;
      }),
    [canViewCost, appRole],
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

  const move = (key: string, dir: -1 | 1) => {
    const def = byKey.get(key);
    if (!def) return;
    const next = [...layout];
    const idx = next.indexOf(key);
    let swap = -1;
    for (let j = idx + dir; j >= 0 && j < next.length; j += dir) {
      if (byKey.get(next[j])?.kind === def.kind) {
        swap = j;
        break;
      }
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
      <AttentionStrip data={data} role={appRole} />

      <div className="flex items-center justify-end gap-2">
        {pending && <span className="text-[11px] text-[var(--color-text-secondary)]">Saving…</span>}
        {editing && (
          <Button
            type="button"
            onClick={reset}
            variant="secondary"
            size="sm"
            title="Reset to the default layout for your role"
          >
            <RotateCcw size={13} /> Reset
          </Button>
        )}
        <Button
          type="button"
          onClick={() => setEditing((v) => !v)}
          variant={editing ? 'primary' : 'secondary'}
          size="sm"
        >
          {editing ? (
            <>
              <Check size={13} /> Done
            </>
          ) : (
            <>
              <Sliders size={13} /> Customize
            </>
          )}
        </Button>
      </div>

      {editing && available.length > 0 && (
        <div className="bp-panel border-dashed p-4">
          <p className="bp-eyebrow mb-3">Add a widget</p>
          <div className="flex flex-wrap gap-2">
            {available.map((w) => (
              <button
                key={w.key}
                onClick={() => add(w.key)}
                className="flex items-center gap-1.5 text-[12px] text-white bg-[var(--color-basalt-800)] hover:bg-[var(--color-basalt-700)] border border-[var(--color-basalt-500)] rounded-[var(--radius-md)] px-2.5 py-1.5 transition-colors"
              >
                <Plus size={13} className="text-[var(--color-emerald)]" /> {w.label}
                <span className="text-[10px] text-[var(--color-fog-500)] uppercase">{w.kind}</span>
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
            const href = def.href?.(appRole) ?? null;
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
                <KpiCard def={def} data={data} href={href} editing={editing} />
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
            const href = def.href?.(appRole) ?? null;
            return (
              <div key={key} className="relative group/chart">
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
                {href && !editing && (
                  <Link
                    href={href}
                    className="absolute bottom-4 right-4 text-[11px] text-[var(--color-text-secondary)] hover:text-[var(--color-vein)] bg-[var(--color-basalt-950)]/90 border border-[var(--color-basalt-500)] rounded-[var(--radius-sm)] px-2 py-1 flex items-center gap-1 transition-colors opacity-80 group-hover/chart:opacity-100"
                  >
                    Open <ArrowUpRight size={12} />
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}

      {layout.length === 0 && (
        <div className="border border-dashed border-[var(--color-basalt-500)] rounded-[var(--radius-lg)] p-10 text-center bg-[var(--color-basalt-900)]/40">
          <p className="text-[14px] text-white font-medium mb-1">No widgets pinned</p>
          <p className="text-[13px] text-[var(--color-text-secondary)] mb-4">
            Add KPIs and charts for this role.
          </p>
          <Button type="button" onClick={() => setEditing(true)}>
            <Sliders size={13} /> Customize
          </Button>
        </div>
      )}
    </div>
  );
}
