'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Edit2, Phone, Printer, MapPin, Package, Users, Trash2 } from 'lucide-react';
import { BrandMark } from '@/components/brand/Wordmark';
import { LOCATION_TYPES, COUNTRIES } from '@/lib/reference';
import { createLocationAction, updateLocationAction, softDeleteLocationAction, type LocationInput } from '@/server/actions/locations';
import type { AdminLocation } from '@/server/queries/locations';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Badge } from '@/components/ui/Badge';

const inputCls = 'w-full bg-[#1c1c1c] border border-[#454446] rounded-md px-3 py-2 text-white text-[13px] focus:border-[#92b0ce] outline-none transition-colors';

export function LocationsClient({ locations }: { locations: AdminLocation[] }) {
  const router = useRouter();
  const toast = useToast();
  const { confirm, confirmDialog } = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [drawer, setDrawer] = useState<{ mode: 'ADD' } | { mode: 'EDIT'; loc: AdminLocation } | null>(null);
  const [actionError, setActionError] = useState('');

  const close = () => { setDrawer(null); setActionError(''); };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!drawer) return;
    const fd = new FormData(e.currentTarget);
    const u = Object.fromEntries(fd.entries()) as Record<string, string>;
    const v = (k: string) => (u[k]?.trim() ? u[k].trim() : undefined);
    const input: LocationInput = {
      name: u.name?.trim() ?? '', code: u.code?.trim() ?? '', type: (v('type') ?? 'Warehouse') as never,
      line1: v('line1'), line2: v('line2'), city: v('city'), region: v('region'),
      postalCode: v('postalCode'), country: v('country') as never, phone: v('phone'), fax: v('fax'),
      defaultPriceLevel: v('defaultPriceLevel'),
    };
    setActionError('');
    startTransition(async () => {
      const res = drawer.mode === 'ADD'
        ? await createLocationAction(input)
        : await updateLocationAction(drawer.loc.id, input);
      if (!res.ok) { setActionError(res.error); return; }
      close();
      router.refresh();
    });
  };

  const handleDelete = async (loc: AdminLocation) => {
    const okToDelete = await confirm({
      title: `Delete ${loc.name}?`,
      message: 'The location will be archived and hidden from active lists.',
      confirmLabel: 'Delete', tone: 'danger',
    });
    if (!okToDelete) return;
    startTransition(async () => {
      const res = await softDeleteLocationAction(loc.id);
      if (!res.ok) { toast(res.error, 'error'); return; }
      toast(`${loc.name} archived.`, 'success');
      router.refresh();
    });
  };

  const cur = drawer?.mode === 'EDIT' ? drawer.loc : null;

  return (
    <div className="flex flex-col h-full bg-[#2b2a2c] text-[#d9d8d9] overflow-hidden">
      {confirmDialog}
      {/* Header */}
      <div className="pt-6 px-6 pb-5 border-b border-[#454446] bg-[#1c1c1c] shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-medium text-white mb-1">Locations &amp; Warehouses</h1>
          <p className="text-[13px] text-[#b8b6b9]">Manage the company&apos;s warehouses, showrooms, and stocking points.</p>
        </div>
        <button onClick={() => { setDrawer({ mode: 'ADD' }); setActionError(''); }} className="flex items-center gap-2 bg-[#e3c16c] text-black px-3 py-1.5 rounded-md text-[13px] font-medium hover:bg-[#d2ac55] transition-colors">
          <Plus size={14} /> New Location
        </button>
      </div>

      {/* Card grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {locations.length === 0 ? (
          <div className="text-center py-16 text-[#b8b6b9]">No locations yet. Add your first warehouse.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {locations.map((l) => (
              <div key={l.id} className="bg-[#1c1c1c] border border-[#454446] rounded-xl p-5 hover:border-[#92b0ce] transition-colors group">
                <div className="flex items-start justify-between mb-4">
                  <BrandMark size={30} />
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setDrawer({ mode: 'EDIT', loc: l }); setActionError(''); }} className="text-[#92b0ce] hover:text-white p-1.5 rounded hover:bg-[#333234]" title="Edit"><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(l)} className="text-red-400 hover:text-red-300 p-1.5 rounded hover:bg-[#333234]" title="Delete"><Trash2 size={14} /></button>
                  </div>
                </div>
                <h3 className="text-[15px] font-medium text-white">{l.name} <span className="text-[#b8b6b9] font-normal">({l.code})</span></h3>
                <div className="mt-1.5"><Badge tone="blue">{l.type}</Badge></div>

                <div className="mt-4 pt-4 border-t border-[#454446] space-y-1.5 text-[12px]">
                  {(l.line1 || l.city) ? (
                    <p className="text-[#d9d8d9] flex items-start gap-1.5">
                      <MapPin size={12} className="text-[#b8b6b9] mt-0.5 shrink-0" />
                      <span>
                        {[l.line1, l.line2].filter(Boolean).join(', ')}
                        {(l.line1 || l.line2) && <br />}
                        {[l.city, l.region, l.postalCode].filter(Boolean).join(' ')}{l.country ? `, ${l.country}` : ''}
                      </span>
                    </p>
                  ) : <p className="text-[#7d7c7f] italic">No address on file</p>}
                  {l.phone && <p className="text-[#b8b6b9] flex items-center gap-1.5"><Phone size={12} /> {l.phone}</p>}
                  {l.fax && <p className="text-[#b8b6b9] flex items-center gap-1.5"><Printer size={12} /> {l.fax}</p>}
                  {l.defaultPriceLevel && <p className="text-[#b8b6b9]">Default Price Level: <span className="text-[#e3c16c]">{l.defaultPriceLevel}</span></p>}
                </div>

                <div className="mt-4 flex items-center gap-4 text-[12px]">
                  <span className="flex items-center gap-1.5 text-white"><Package size={12} className="text-[#b8b6b9]" /> {l.slabCount} <span className="text-[#b8b6b9] font-normal">slabs</span></span>
                  <span className="flex items-center gap-1.5 text-white"><Users size={12} className="text-[#b8b6b9]" /> {l.userCount} <span className="text-[#b8b6b9] font-normal">users</span></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit drawer */}
      {drawer && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40" onClick={close} />
          <form onSubmit={handleSubmit} className="fixed top-0 right-0 h-full w-full max-w-[560px] bg-[#2b2a2c] border-l border-[#454446] shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#454446] bg-[#1c1c1c] shrink-0">
              <h2 className="text-[18px] font-medium text-white">{drawer.mode === 'ADD' ? 'New Location' : `Edit ${cur?.name}`}</h2>
              <button type="button" onClick={close} className="text-[#b8b6b9] hover:text-white hover:bg-[#333234] p-1.5 rounded transition-colors"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-[13px]">
              <Sec title="Identity">
                <div className="grid grid-cols-2 gap-4">
                  <Fld label="Location Name" req><input name="name" required defaultValue={cur?.name} placeholder="e.g. Blue Planet Inc - NJ" className={inputCls} /></Fld>
                  <Fld label="Short Code" req><input name="code" required defaultValue={cur?.code} placeholder="e.g. BP-NJ" className={inputCls} /></Fld>
                  <Fld label="Type"><select name="type" defaultValue={cur?.type ?? 'Warehouse'} className={inputCls}>{LOCATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></Fld>
                  <Fld label="Default Price Level"><input name="defaultPriceLevel" defaultValue={cur?.defaultPriceLevel ?? ''} placeholder="e.g. Retail-Retail" className={inputCls} /></Fld>
                </div>
              </Sec>
              <Sec title="Address">
                <Fld label="Street Address"><input name="line1" defaultValue={cur?.line1 ?? ''} placeholder="Street, building" className={inputCls} /></Fld>
                <Fld label="Address Line 2"><input name="line2" defaultValue={cur?.line2 ?? ''} placeholder="Suite, unit (optional)" className={inputCls} /></Fld>
                <div className="grid grid-cols-2 gap-4">
                  <Fld label="City"><input name="city" defaultValue={cur?.city ?? ''} placeholder="City" className={inputCls} /></Fld>
                  <Fld label="State / Region"><input name="region" defaultValue={cur?.region ?? ''} placeholder="State / province" className={inputCls} /></Fld>
                  <Fld label="Postal Code"><input name="postalCode" defaultValue={cur?.postalCode ?? ''} placeholder="ZIP / postal" className={inputCls} /></Fld>
                  <Fld label="Country"><select name="country" defaultValue={cur?.country ?? 'United States'} className={inputCls}><option value="">— Select —</option>{COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></Fld>
                </div>
              </Sec>
              <Sec title="Contact">
                <div className="grid grid-cols-2 gap-4">
                  <Fld label="Phone"><input name="phone" defaultValue={cur?.phone ?? ''} placeholder="+1 (555) 000-0000" className={inputCls} /></Fld>
                  <Fld label="Fax"><input name="fax" defaultValue={cur?.fax ?? ''} placeholder="Fax number" className={inputCls} /></Fld>
                </div>
              </Sec>
              {actionError && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] px-3 py-2 rounded">{actionError}</div>}
            </div>
            <div className="p-4 border-t border-[#454446] bg-[#1c1c1c] flex items-center justify-end gap-3 shrink-0">
              <button type="button" onClick={close} className="px-4 py-2 text-[13px] font-medium text-white hover:bg-[#333234] rounded-md transition-colors">Cancel</button>
              <button type="submit" disabled={isPending} className="px-4 py-2 text-[13px] font-medium text-black rounded-md bg-[#e3c16c] hover:bg-[#d2ac55] transition-colors disabled:opacity-60">{isPending ? 'Saving…' : 'Save Location'}</button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-[11px] uppercase tracking-wider text-[#b8b6b9] font-medium border-b border-[#454446] pb-1.5">{title}</h3>
      {children}
    </div>
  );
}

function Fld({ label, children, req }: { label: string; children: React.ReactNode; req?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[#b8b6b9] block text-[12px]">{label}{req && <span className="text-red-400"> *</span>}</label>
      {children}
    </div>
  );
}
