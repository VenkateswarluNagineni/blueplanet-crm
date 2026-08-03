'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CornerDownLeft,
  UserSquare2,
  Building2,
  Target,
  Layers,
  Warehouse,
  Loader2,
  Search,
  Box,
  FileText,
  Truck,
} from 'lucide-react';
import { globalSearchAction, type SearchHit, type SearchKind } from '@/server/actions/search';
import { type AppRole, visibleNavItems, labelFor } from '@/lib/nav';
import type { VisibilitySettings } from '@/context/RoleContext';

const KIND_ICON: Record<SearchKind, React.ComponentType<{ size?: number; className?: string }>> = {
  customer: UserSquare2,
  supplier: Building2,
  vendor: Truck,
  associate: Target,
  product: Box,
  slab: Layers,
  order: FileText,
  location: Warehouse,
};
const KIND_LABEL: Record<SearchKind, string> = {
  customer: 'Customer',
  supplier: 'Supplier',
  vendor: 'Vendor',
  associate: 'Associate',
  product: 'Product',
  slab: 'Slab',
  order: 'Order',
  location: 'Location',
};

type Row = {
  key: string;
  label: string;
  sublabel: string | null;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  group: string;
};

export function CommandPalette({
  open,
  onClose,
  role,
  settings,
}: {
  open: boolean;
  onClose: () => void;
  role: string;
  settings: VisibilitySettings;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [records, setRecords] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const appRole = role as AppRole;

  const modules = useMemo(() => {
    const base = visibleNavItems(appRole, settings);
    const q = query.trim().toLowerCase();
    return q
      ? base.filter((d) => (labelFor(d, appRole) + ' ' + d.hint).toLowerCase().includes(q))
      : base;
  }, [query, appRole, settings]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      const t0 = setTimeout(() => {
        setRecords([]);
        setLoading(false);
      }, 0);
      return () => clearTimeout(t0);
    }
    let stale = false;
    const tLoad = setTimeout(() => {
      if (!stale) setLoading(true);
    }, 0);
    const t = setTimeout(async () => {
      try {
        const res = await globalSearchAction(q);
        if (!stale) setRecords(res);
      } finally {
        if (!stale) setLoading(false);
      }
    }, 200);
    return () => {
      stale = true;
      clearTimeout(tLoad);
      clearTimeout(t);
    };
  }, [query]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => {
        setQuery('');
        setRecords([]);
        setActive(0);
        inputRef.current?.focus();
      }, 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => setActive(0), 0);
    return () => clearTimeout(t);
  }, [query, records.length]);

  const rows: Row[] = useMemo(() => {
    const recRows: Row[] = records.map((r) => ({
      key: `${r.kind}:${r.id}`,
      label: r.label,
      sublabel: r.sublabel,
      href: r.href,
      icon: KIND_ICON[r.kind],
      group: KIND_LABEL[r.kind],
    }));
    // Align module groups with sidebar IA (Inventory / Sales / Supply / Ops …).
    const modRows: Row[] = modules.map((m) => ({
      key: `mod:${m.href}`,
      label: labelFor(m, appRole),
      sublabel: m.hint,
      href: m.href,
      icon: m.icon as React.ComponentType<{ size?: number; className?: string }>,
      group: m.group[appRole] ?? 'Go to',
    }));
    return [...recRows, ...modRows];
  }, [records, modules, appRole]);

  if (!open) return null;

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (rows[active]) go(rows[active].href);
    }
  };

  let idx = -1;
  const groups: { group: string; items: { row: Row; i: number }[] }[] = [];
  for (const row of rows) {
    idx += 1;
    const last = groups[groups.length - 1];
    if (last && last.group === row.group) last.items.push({ row, i: idx });
    else groups.push({ group: row.group, items: [{ row, i: idx }] });
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center pt-[14vh] px-4" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      <div
        role="dialog"
        aria-label="Command menu"
        className="relative w-full max-w-lg bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded-[var(--radius-xl)] bp-lift-3 overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2 px-4 py-3.5 border-b border-[var(--color-basalt-500)]">
          {loading ? (
            <Loader2 size={16} className="text-[var(--color-sodalite)] animate-spin" />
          ) : (
            <Search size={16} className="text-[var(--color-text-secondary)]" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customers, slabs, products, orders… or jump to a module"
            className="bg-transparent border-none outline-none text-[14px] text-white w-full placeholder-[var(--color-fog-500)]"
          />
          <kbd className="text-[10px] text-[var(--color-fog-500)] border border-[var(--color-basalt-500)] rounded px-1.5 py-0.5 font-mono">esc</kbd>
        </div>
        <div className="max-h-[360px] overflow-y-auto p-2">
          {rows.length === 0 ? (
            <p className="text-[13px] text-[var(--color-text-secondary)] text-center py-8">
              {query.trim().length >= 2
                ? loading
                  ? 'Searching…'
                  : 'No matches found.'
                : 'Type to search records, or pick a destination.'}
            </p>
          ) : (
            groups.map((g) => (
              <div key={g.group} className="mb-1.5 last:mb-0">
                <p className="text-[10px] uppercase tracking-wider text-[var(--color-fog-500)] px-3 pt-1 pb-1">{g.group}</p>
                {g.items.map(({ row, i }) => {
                  const Icon = row.icon;
                  return (
                    <button
                      key={row.key}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(row.href)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        i === active ? 'bg-[var(--color-basalt-700)]' : 'hover:bg-[var(--color-basalt-800)]'
                      }`}
                    >
                      <Icon size={16} className="text-[var(--color-sodalite)] shrink-0" />
                      <span className="text-[13px] text-white truncate">{row.label}</span>
                      {row.sublabel && (
                        <span className="text-[12px] text-[var(--color-text-secondary)] ml-1 truncate">{row.sublabel}</span>
                      )}
                      {i === active && <CornerDownLeft size={13} className="text-[var(--color-text-secondary)] ml-auto shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
