'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Home, Box, Search, FileText, Briefcase, Package, Users, Truck, CheckCircle, CornerDownLeft,
} from 'lucide-react';

type Dest = { label: string; href: string; hint: string; icon: React.ComponentType<{ size?: number; className?: string }>; roles: string[] };

const ALL: Dest[] = [
  { label: 'Dashboard', href: '/', hint: 'KPIs & charts', icon: Home, roles: ['ADMIN', 'SALES'] },
  { label: 'Product Catalog', href: '/catalog', hint: 'Browse materials & quote', icon: Box, roles: ['ADMIN', 'SALES', 'VENDOR'] },
  { label: 'Inventory Search', href: '/inventory', hint: 'Slabs & material passport', icon: Search, roles: ['ADMIN', 'SALES', 'VENDOR'] },
  { label: 'Sales Orders', href: '/orders', hint: 'Quotes & transactions', icon: FileText, roles: ['ADMIN', 'SALES'] },
  { label: 'Sales Pipeline', href: '/pipeline', hint: 'Opportunities', icon: Briefcase, roles: ['ADMIN', 'SALES'] },
  { label: 'Purchasing & POs', href: '/purchases', hint: 'Logistics pipeline', icon: Package, roles: ['ADMIN'] },
  { label: 'People & Companies', href: '/crm', hint: 'Suppliers, vendors, reps', icon: Users, roles: ['ADMIN', 'SALES'] },
  { label: 'Logistics', href: '/logistics', hint: 'Shipments in transit', icon: Truck, roles: ['ADMIN'] },
  { label: 'Pending Approvals', href: '/admin/approvals', hint: 'Measurement overrides', icon: CheckCircle, roles: ['ADMIN'] },
  { label: 'Vendor Portal', href: '/vendor', hint: 'My orders & invoices', icon: Truck, roles: ['VENDOR'] },
];

export function CommandPalette({ open, onClose, role }: { open: boolean; onClose: () => void; role: string }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const base = ALL.filter((d) => d.roles.includes(role));
    const q = query.trim().toLowerCase();
    return q ? base.filter((d) => (d.label + ' ' + d.hint).toLowerCase().includes(q)) : base;
  }, [query, role]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => { setActive(0); }, [query]);

  if (!open) return null;

  const go = (href: string) => { onClose(); router.push(href); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[active]) go(results[active].href); }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center pt-[14vh] px-4" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        role="dialog"
        aria-label="Command menu"
        className="relative w-full max-w-lg bg-[#1c1c1c] border border-[#454446] rounded-xl shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#454446]">
          <Search size={16} className="text-[#b8b6b9]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to…"
            className="bg-transparent border-none outline-none text-[14px] text-white w-full placeholder-[#b8b6b9]"
          />
          <kbd className="text-[10px] text-[#b8b6b9] border border-[#454446] rounded px-1.5 py-0.5">esc</kbd>
        </div>
        <div className="max-h-[320px] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="text-[13px] text-[#b8b6b9] text-center py-8">No matching destinations.</p>
          ) : (
            results.map((d, i) => {
              const Icon = d.icon;
              return (
                <button
                  key={d.href}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(d.href)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${i === active ? 'bg-[#333234]' : 'hover:bg-[#2b2a2c]'}`}
                >
                  <Icon size={16} className="text-[#92b0ce] shrink-0" />
                  <span className="text-[13px] text-white">{d.label}</span>
                  <span className="text-[12px] text-[#b8b6b9] ml-1">{d.hint}</span>
                  {i === active && <CornerDownLeft size={13} className="text-[#b8b6b9] ml-auto" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
