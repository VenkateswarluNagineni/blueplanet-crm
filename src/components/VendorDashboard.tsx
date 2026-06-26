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
import { setDashboardLayoutAction } from '@/server/actions/dashboard';

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
  { key: 'vkpi:balanceDue', label: 'Outstanding Balance', icon: DollarSign, accent: '#e3c16c', value: (k) => usd(k.balanceDue) },
  { key: 'vkpi:activeShipments', label: 'Active Shipments', icon: Ship, accent: '#92b0ce', value: (k) => num(k.activeShipments) },
  { key: 'vkpi:totalPos', label: 'Assigned Orders', icon: Layers, accent: '#b58cd6', value: (k) => num(k.totalPos) },
  { key: 'vkpi:openInvoices', label: 'Open Invoices', icon: FileText, accent: '#5db5b5', value: (k) => num(k.openInvoices) },
  { key: 'vkpi:overdueAmount', label: 'Overdue', icon: AlertTriangle, accent: '#e8956b', value: (k) => usd(k.overdueAmount) },
];

const DEFAULT_LAYOUT = ['vkpi:balanceDue', 'vkpi:activeShipments', 'vkpi:totalPos', 'vkpi:overdueAmount'];

function KpiCard({ def, kpis }: { def: WidgetDef; kpis: VendorKpis }) {
  const Icon = def.icon;
  return (
    <div className="bg-[#1c1c1c] border border-[#454446] rounded-xl p-5 hover:border-[#5a595c] transition-all shadow-md h-full">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-inner" style={{ background: `${def.accent}1a`, color: def.accent }}>
          <Icon size={16} />
        </div>
        <p className="text-[11px] uppercase tracking-wider text-[#b8b6b9] font-medium leading-tight">{def.label}</p>
      </div>
      <p className="text-[22px] font-medium text-white tabular-nums tracking-tight" style={{ fontFamily: 'var(--font-fraunces), serif' }}>{def.value(kpis)}</p>
    </div>
  );
}

export function VendorDashboard({ kpis, initialLayout }: { kpis: VendorKpis; initialLayout: string[] | null }) {
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
        {pending && <span className="text-[11px] text-[#b8b6b9]">Saving…</span>}
        {editing && (
          <button onClick={reset} className="flex items-center gap-1.5 text-[12px] text-[#b8b6b9] hover:text-white border border-[#454446] rounded-lg px-2.5 py-1.5 transition-colors">
            <RotateCcw size={13} /> Reset
          </button>
        )}
        <button onClick={() => setEditing((v) => !v)} className={`flex items-center gap-1.5 text-[12px] rounded-lg px-2.5 py-1.5 transition-colors border ${editing ? 'bg-[#e3c16c] text-[#1c1c1c] border-[#e3c16c] font-medium' : 'text-[#b8b6b9] hover:text-white border-[#454446]'}`}>
          {editing ? <><Check size={13} /> Done</> : <><Sliders size={13} /> Customize</>}
        </button>
      </div>

      {editing && available.length > 0 && (
        <div className="bg-[#1c1c1c] border border-dashed border-[#454446] rounded-xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-[#b8b6b9] font-medium mb-3">Add a card</p>
          <div className="flex flex-wrap gap-2">
            {available.map((w) => (
              <button key={w.key} onClick={() => add(w.key)} className="flex items-center gap-1.5 text-[12px] text-white bg-[#2b2a2c] hover:bg-[#353436] border border-[#454446] rounded-lg px-2.5 py-1.5 transition-colors">
                <Plus size={13} className="text-[#10b981]" /> {w.label}
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
                  <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-[#0f0f0f]/90 border border-[#454446] rounded-lg px-1 py-0.5 shadow-lg">
                    <button onClick={() => move(key, -1)} disabled={i === 0} className="p-1 rounded text-[#b8b6b9] hover:text-white disabled:opacity-30"><ChevronLeft size={14} /></button>
                    <button onClick={() => move(key, 1)} disabled={i === layout.length - 1} className="p-1 rounded text-[#b8b6b9] hover:text-white disabled:opacity-30"><ChevronRight size={14} /></button>
                    <button onClick={() => remove(key)} className="p-1 rounded text-[#e8956b] hover:text-white"><X size={14} /></button>
                  </div>
                )}
                <KpiCard def={def} kpis={kpis} />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-[#1c1c1c] border border-dashed border-[#454446] rounded-xl p-8 text-center">
          <p className="text-[13px] text-[#b8b6b9]">No summary cards. Click <span className="text-white font-medium">Customize</span> to add some.</p>
        </div>
      )}
    </div>
  );
}
