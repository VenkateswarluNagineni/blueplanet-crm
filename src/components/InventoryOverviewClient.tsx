'use client';

import React from 'react';
import Link from 'next/link';
import {
  Boxes, CheckCircle, PauseCircle, Truck, Ruler, DollarSign,
  Search, History, Warehouse, Box, Package, MapPin, Layers, ArrowRight,
} from 'lucide-react';
import { useRole } from '@/context/RoleContext';
import type { InventoryOverview } from '@/server/queries/inventoryOverview';

const RESTRICTED = <span className="text-[#b8b6b9] text-[11px] bg-[#333234] px-2 py-0.5 rounded uppercase tracking-wider">Restricted</span>;

export function InventoryOverviewClient({ overview, canViewCost }: { overview: InventoryOverview; canViewCost: boolean }) {
  const { role } = useRole();
  const isAdmin = role === 'ADMIN';
  const k = overview.kpis;

  const kpis: { label: string; value: React.ReactNode; icon: React.ElementType; color: string }[] = [
    { label: 'Total Slabs', value: k.totalSlabs.toLocaleString(), icon: Boxes, color: '#92b0ce' },
    { label: 'Available', value: k.available.toLocaleString(), icon: CheckCircle, color: '#10b981' },
    { label: 'On Hold', value: k.onHold.toLocaleString(), icon: PauseCircle, color: '#e3c16c' },
    { label: 'In Transit', value: k.inTransit.toLocaleString(), icon: Truck, color: '#92b0ce' },
    { label: 'Available SF', value: k.availableSf.toLocaleString(), icon: Ruler, color: '#d9d8d9' },
    { label: 'Inventory Value', value: canViewCost && k.inventoryValue != null ? `$${k.inventoryValue.toLocaleString()}` : RESTRICTED, icon: DollarSign, color: '#e3c16c' },
  ];

  const tiles = [
    { label: 'Inventory Search', href: '/inventory', icon: Search, show: true },
    { label: 'Product Catalog', href: '/catalog', icon: Box, show: true },
    { label: 'Purchasing & POs', href: '/purchases', icon: Package, show: isAdmin },
    { label: 'Stock Movements', href: '/admin/movements', icon: History, show: isAdmin },
    { label: 'Locations', href: '/admin/locations', icon: Warehouse, show: isAdmin },
  ].filter((t) => t.show);

  return (
    <div className="flex flex-col h-full bg-[#2b2a2c] text-[#d9d8d9] overflow-y-auto">
      {/* Header */}
      <div className="pt-6 px-6 pb-5 border-b border-[#454446] bg-[#1c1c1c] shrink-0">
        <h1 className="text-[20px] font-medium text-white mb-1">Inventory Overview</h1>
        <p className="text-[13px] text-[#b8b6b9]">Stock at a glance — by status, location, and material category.</p>
      </div>

      <div className="p-6 space-y-6">
        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {kpis.map((c) => (
            <div key={c.label} className="bg-[#1c1c1c] border border-[#454446] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-medium text-[#b8b6b9] uppercase tracking-wider">{c.label}</span>
                <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${c.color}1a`, color: c.color }}><c.icon size={16} /></div>
              </div>
              <div className="text-[22px] font-semibold text-white leading-none">{c.value}</div>
            </div>
          ))}
        </div>

        {/* Breakdowns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* By Location */}
          <div className="bg-[#1c1c1c] border border-[#454446] rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[#454446] flex items-center gap-2"><MapPin size={15} className="text-[#92b0ce]" /><h3 className="text-[14px] font-medium text-white">Inventory by Location</h3></div>
            <table className="w-full text-[13px]">
              <thead><tr className="text-[#b8b6b9]">
                <th className="text-left font-medium px-5 py-2">Location</th>
                <th className="text-right font-medium px-3 py-2">Slabs</th>
                <th className="text-right font-medium px-3 py-2">Avail. SF</th>
                {canViewCost && <th className="text-right font-medium px-5 py-2">Value</th>}
              </tr></thead>
              <tbody className="divide-y divide-[#454446]">
                {overview.byLocation.map((l) => (
                  <tr key={l.location} className="hover:bg-[#333234] transition-colors group">
                    <td className="px-5 py-2.5">
                      <Link href={`/inventory?location=${encodeURIComponent(l.location)}`} className="text-white hover:text-[#92b0ce] flex items-center gap-1.5">
                        {l.location} <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-[#92b0ce]" />
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-right text-white">{l.slabs} <span className="text-[#7d7c7f]">({l.availableSlabs} avail)</span></td>
                    <td className="px-3 py-2.5 text-right text-[#b8b6b9]">{l.availableSf.toLocaleString()}</td>
                    {canViewCost && <td className="px-5 py-2.5 text-right text-[#e3c16c]">{l.value != null ? `$${l.value.toLocaleString()}` : '—'}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* By Category */}
          <div className="bg-[#1c1c1c] border border-[#454446] rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[#454446] flex items-center gap-2"><Layers size={15} className="text-[#e8956b]" /><h3 className="text-[14px] font-medium text-white">Inventory by Category</h3></div>
            <table className="w-full text-[13px]">
              <thead><tr className="text-[#b8b6b9]">
                <th className="text-left font-medium px-5 py-2">Category</th>
                <th className="text-right font-medium px-3 py-2">Slabs</th>
                <th className="text-right font-medium px-5 py-2">Avail. SF</th>
              </tr></thead>
              <tbody className="divide-y divide-[#454446]">
                {overview.byCategory.map((c) => (
                  <tr key={c.category} className="hover:bg-[#333234] transition-colors">
                    <td className="px-5 py-2.5 text-white">{c.category}</td>
                    <td className="px-3 py-2.5 text-right text-white">{c.slabs}</td>
                    <td className="px-5 py-2.5 text-right text-[#b8b6b9]">{c.availableSf.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick links */}
        <div>
          <h3 className="text-[11px] uppercase tracking-wider text-[#b8b6b9] font-medium mb-3">Jump to</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {tiles.map((t) => (
              <Link key={t.href} href={t.href} className="bg-[#1c1c1c] border border-[#454446] rounded-xl p-4 flex items-center gap-3 hover:border-[#92b0ce] hover:bg-[#333234]/40 transition-colors">
                <div className="p-2 rounded-lg bg-[#333234] text-[#92b0ce]"><t.icon size={16} /></div>
                <span className="text-[13px] text-white">{t.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
