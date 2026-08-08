'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  DollarSign,
  Ship,
  FileText,
  AlertTriangle,
  Layers,
  Sliders,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Check,
} from 'lucide-react';
import { setDashboardLayoutAction } from '@/server/dashboard/actions';
import { ACCENT } from '@/lib/ui/statusColors';

export type VendorKpis = {
  balanceDue: number;
  activeShipments: number;
  totalPos: number;
  openInvoices: number;
  overdueAmount: number;
};

type IconType = React.ComponentType<{ size?: number; className?: string }>;
type WidgetDef = { key: string; label: string; icon: IconType; accent: string; value: (k: VendorKpis) => string };

const usd = (n: number) => `$${n.toLocaleString()}`;
const num = (n: number) => n.toLocaleString();

const CATALOG: WidgetDef[] = [
  { key: 'vkpi:balanceDue', label: 'Outstanding Balance', icon: DollarSign, accent: ACCENT.gold, value: (k) => usd(k.balanceDue) },
  { key: 'vkpi:activeShipments', label: 'Active Shipments', icon: Ship, accent: ACCENT.sodalite, value: (k) => num(k.activeShipments) },
  { key: 'vkpi:totalPos', label: 'Assigned Orders', icon: Layers, accent: ACCENT.amethyst, value: (k) => num(k.totalPos) },
  { key: 'vkpi:openInvoices', label: 'Open Invoices', icon: FileText, accent: ACCENT.sodalite, value: (k) => num(k.openInvoices) },
  { key: 'vkpi:overdueAmount', label: 'Overdue', icon: AlertTriangle, accent: ACCENT.coral, value: (k) => usd(k.overdueAmount) },
];

const DEFAULT_LAYOUT = ['vkpi:balanceDue', 'vkpi:activeShipments', 'vkpi:totalPos', 'vkpi:overdueAmount'];

function KpiCard({
  def,
  kpis,
  onClick,
  editing,
}: {
  def: WidgetDef;
  kpis: VendorKpis;
  onClick?: () => void;
  editing: boolean;
}) {
  const Icon = def.icon;
  const interactive = !!onClick && !editing;
  const shell = `p-5 h-full ${
    interactive ? 'bp-card-interactive cursor-pointer' : 'bp-card'
  }`;
  const body = (
    <>
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center shrink-0 shadow-inner"
          style={{ background: `${def.accent}1a`, color: def.accent }}
        >
          <Icon size={16} />
        </div>
        <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-secondary)] font-medium leading-tight">
          {def.label}
        </p>
      </div>
      <p className="bp-kpi-value">{def.value(kpis)}</p>
      {interactive && (
        <p className="mt-2 text-[10px] text-[var(--color-fog-500)] group-hover:text-[var(--color-sodalite)]">
          Jump to details →
        </p>
      )}
    </>
  );
  if (interactive) {
    return (
      <button type="button" onClick={onClick} className={`${shell} w-full text-left`}>
        {body}
      </button>
    );
  }
  return <div className={shell}>{body}</div>;
}

export function VendorDashboard({
  kpis,
  initialLayout,
  onKpiClick,
}: {
  kpis: VendorKpis;
  initialLayout: string[] | null;
  /** Optional: scroll to section when a KPI is clicked (disabled while customizing). */
  onKpiClick?: (key: string) => void;
}) {
  const byKey = useMemo(() => new Map(CATALOG.map((w) => [w.key, w])), []);
  const allowedKeys = useMemo(() => new Set(CATALOG.map((w) => w.key)), []);
  const sanitize = (keys: string[]) => keys.filter((k) => allowedKeys.has(k));

  const [layout, setLayout] = useState<string[]>(initialLayout ? sanitize(initialLayout) : DEFAULT_LAYOUT);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const persist = (next: string[]) => {
    setLayout(next);
    startTransition(async () => { await setDashboardLayoutAction(next); });
  };
  const remove = (key: string) => persist(layout.filter((k) => k !== key));
  const add = (key: string) => { if (!layout.includes(key)) persist([...layout, key]); };
  const reset = () => persist(DEFAULT_LAYOUT);
  const move = (key: string, dir: -1 | 1) => {
    const next = [...layout];
    const idx = next.indexOf(key);
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    persist(next);
  };

  const available = CATALOG.filter((w) => !layout.includes(w.key));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        {pending && <span className="text-[11px] text-[var(--color-text-secondary)]">Saving…</span>}
        {editing && (
          <button onClick={reset} className="flex items-center gap-1.5 text-[12px] text-[var(--color-text-secondary)] hover:text-white border border-[var(--color-basalt-500)] rounded-lg px-2.5 py-1.5 transition-colors">
            <RotateCcw size={13} /> Reset
          </button>
        )}
        <button type="button" onClick={() => setEditing((v) => !v)} className={editing ? 'btn-primary !min-h-8 !px-2.5 text-[12px]' : 'btn-secondary !min-h-8 !px-2.5 text-[12px]'}>
          {editing ? <><Check size={13} /> Done</> : <><Sliders size={13} /> Customize</>}
        </button>
      </div>

      {editing && available.length > 0 && (
        <div className="bg-[var(--color-basalt-900)] border border-dashed border-[var(--color-basalt-500)] rounded-xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-[var(--color-text-secondary)] font-medium mb-3">Add a card</p>
          <div className="flex flex-wrap gap-2">
            {available.map((w) => (
              <button type="button" key={w.key} onClick={() => add(w.key)} className="flex items-center gap-1.5 text-[12px] text-white bg-[var(--color-basalt-800)] hover:bg-[var(--color-basalt-700)] border border-[var(--color-basalt-500)] rounded-lg px-2.5 py-1.5 transition-colors">
                <Plus size={13} className="text-[var(--color-emerald)]" /> {w.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {layout.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {layout.map((key, i) => {
            const def = byKey.get(key);
            if (!def) return null;
            return (
              <div key={key} className="relative">
                {editing && (
                  <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-[var(--color-basalt-950)]/90 border border-[var(--color-basalt-500)] rounded-lg px-1 py-0.5 shadow-lg">
                    <button onClick={() => move(key, -1)} disabled={i === 0} className="p-1 rounded text-[var(--color-text-secondary)] hover:text-white disabled:opacity-30"><ChevronLeft size={14} /></button>
                    <button onClick={() => move(key, 1)} disabled={i === layout.length - 1} className="p-1 rounded text-[var(--color-text-secondary)] hover:text-white disabled:opacity-30"><ChevronRight size={14} /></button>
                    <button onClick={() => remove(key)} className="p-1 rounded text-[var(--color-coral)] hover:text-white"><X size={14} /></button>
                  </div>
                )}
                <KpiCard
                  def={def}
                  kpis={kpis}
                  editing={editing}
                  onClick={onKpiClick ? () => onKpiClick(def.key + def.label) : undefined}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="vein border border-dashed border-[var(--color-basalt-500)] rounded-xl p-8 text-center">
          <p className="text-[13px] text-[var(--color-text-secondary)]">No summary cards. Click <span className="text-white font-medium">Customize</span> to add some.</p>
        </div>
      )}
    </div>
  );
}
