'use client';

import React, { useState, useTransition, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Edit2, Phone, Printer, MapPin, Package, Users, Trash2 } from 'lucide-react';
import { BrandMark } from '@/components/brand/Wordmark';
import { LOCATION_TYPES, COUNTRIES } from '@/lib/domain/reference';
import { createLocationAction, updateLocationAction, softDeleteLocationAction, type LocationInput } from '@/server/locations/actions';
import type { AdminLocation } from '@/server/locations/queries';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { EmptyState } from '@/components/ui/EmptyState';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';

const inputCls = 'bp-input';

export function LocationsClient({ locations }: { locations: AdminLocation[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { confirm, confirmDialog } = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [drawer, setDrawer] = useState<{ mode: 'ADD' } | { mode: 'EDIT'; loc: AdminLocation } | null>(null);
  const [actionError, setActionError] = useState('');
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightRef = useRef<HTMLDivElement | null>(null);

  // Deep-link: /admin/locations?loc=<id> highlights and opens the location card.
  useEffect(() => {
    const wanted = searchParams.get('loc');
    if (!wanted) return;
    const match = locations.find((l) => l.id === wanted || l.code === wanted);
    if (!match) return;
    const t = setTimeout(() => {
      setHighlightId(match.id);
      setDrawer({ mode: 'EDIT', loc: match });
      setActionError('');
    }, 0);
    return () => clearTimeout(t);
  }, [searchParams, locations]);

  useEffect(() => {
    if (!highlightId) return;
    const t = setTimeout(() => highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
    return () => clearTimeout(t);
  }, [highlightId]);

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
    <PageShell
      header={
        <PageHeader
          breadcrumbs={[
            { label: 'Supply', href: '/logistics' },
            { label: 'Locations' },
          ]}
          title="Locations"
          subtitle="Warehouses, showrooms, and stocking points."
          meta={[{ label: `${locations.length} sites`, tone: 'blue' }]}
          actions={
            <button type="button" onClick={() => { setDrawer({ mode: 'ADD' }); setActionError(''); }} className="btn-primary !min-h-8 !px-3 text-[12px]">
              <Plus size={14} /> New Location
            </button>
          }
        />
      }
    >
      {confirmDialog}
        {locations.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="No locations yet"
            hint="Add your first warehouse, showroom, or stocking point."
            action={
              <button onClick={() => { setDrawer({ mode: 'ADD' }); setActionError(''); }} className="btn-primary inline-flex items-center gap-1.5">
                <Plus size={14} /> New Location
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {locations.map((l) => (
              <div
                key={l.id}
                ref={highlightId === l.id ? highlightRef : undefined}
                className={`bp-card p-5 group transition-colors ${
                  highlightId === l.id
                    ? '!border-[var(--color-vein)] ring-1 ring-[rgba(227,193,108,0.4)]'
                    : 'hover:!border-[rgba(146,176,206,0.45)]'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <BrandMark size={30} />
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setDrawer({ mode: 'EDIT', loc: l }); setActionError(''); }} className="text-[var(--color-sodalite)] hover:text-white p-1.5 rounded hover:bg-[var(--color-basalt-700)]" title="Edit"><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(l)} className="text-red-400 hover:text-red-300 p-1.5 rounded hover:bg-[var(--color-basalt-700)]" title="Delete"><Trash2 size={14} /></button>
                  </div>
                </div>
                <h3 className="text-[15px] font-medium text-white">{l.name} <span className="text-[var(--color-text-secondary)] font-normal">({l.code})</span></h3>
                <div className="mt-1.5"><Badge tone="blue">{l.type}</Badge></div>

                <div className="mt-4 pt-4 border-t border-[var(--color-basalt-500)] space-y-1.5 text-[12px]">
                  {(l.line1 || l.city) ? (
                    <p className="text-[var(--color-text-muted)] flex items-start gap-1.5">
                      <MapPin size={12} className="text-[var(--color-text-secondary)] mt-0.5 shrink-0" />
                      <span>
                        {[l.line1, l.line2].filter(Boolean).join(', ')}
                        {(l.line1 || l.line2) && <br />}
                        {[l.city, l.region, l.postalCode].filter(Boolean).join(' ')}{l.country ? `, ${l.country}` : ''}
                      </span>
                    </p>
                  ) : <p className="text-[var(--color-fog-500)] italic">No address on file</p>}
                  {l.phone && <p className="text-[var(--color-text-secondary)] flex items-center gap-1.5"><Phone size={12} /> {l.phone}</p>}
                  {l.fax && <p className="text-[var(--color-text-secondary)] flex items-center gap-1.5"><Printer size={12} /> {l.fax}</p>}
                  {l.defaultPriceLevel && <p className="text-[var(--color-text-secondary)]">Default Price Level: <span className="text-[var(--color-vein)]">{l.defaultPriceLevel}</span></p>}
                </div>

                <div className="mt-4 flex items-center gap-4 text-[12px]">
                  <span className="flex items-center gap-1.5 text-white"><Package size={12} className="text-[var(--color-text-secondary)]" /> {l.slabCount} <span className="text-[var(--color-text-secondary)] font-normal">slabs</span></span>
                  <span className="flex items-center gap-1.5 text-white"><Users size={12} className="text-[var(--color-text-secondary)]" /> {l.userCount} <span className="text-[var(--color-text-secondary)] font-normal">users</span></span>
                </div>
              </div>
            ))}
          </div>
        )}

      <Drawer
        open={!!drawer}
        onClose={close}
        width={560}
        title={drawer?.mode === 'ADD' ? 'New Location' : `Edit ${cur?.name ?? 'Location'}`}
        footer={
          <>
            <Button variant="ghost" size="sm" type="button" onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" form="location-form" disabled={isPending}>
              {isPending ? 'Saving…' : 'Save Location'}
            </Button>
          </>
        }
      >
        {drawer && (
          <form id="location-form" onSubmit={handleSubmit} className="p-6 space-y-6 text-[13px]">
            <Sec title="Identity">
              <div className="grid grid-cols-2 gap-4">
                <Fld label="Location Name" req>
                  <input name="name" required defaultValue={cur?.name} placeholder="e.g. Blue Planet Inc - NJ" className={inputCls} />
                </Fld>
                <Fld label="Short Code" req>
                  <input name="code" required defaultValue={cur?.code} placeholder="e.g. BP-NJ" className={inputCls} />
                </Fld>
                <Fld label="Type">
                  <select name="type" defaultValue={cur?.type ?? 'Warehouse'} className={inputCls}>
                    {LOCATION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Fld>
                <Fld label="Default Price Level">
                  <input
                    name="defaultPriceLevel"
                    defaultValue={cur?.defaultPriceLevel ?? ''}
                    placeholder="e.g. Retail-Retail"
                    className={inputCls}
                  />
                </Fld>
              </div>
            </Sec>
            <Sec title="Address">
              <Fld label="Street Address">
                <input name="line1" defaultValue={cur?.line1 ?? ''} placeholder="Street, building" className={inputCls} />
              </Fld>
              <Fld label="Address Line 2">
                <input name="line2" defaultValue={cur?.line2 ?? ''} placeholder="Suite, unit (optional)" className={inputCls} />
              </Fld>
              <div className="grid grid-cols-2 gap-4">
                <Fld label="City">
                  <input name="city" defaultValue={cur?.city ?? ''} placeholder="City" className={inputCls} />
                </Fld>
                <Fld label="State / Region">
                  <input name="region" defaultValue={cur?.region ?? ''} placeholder="State / province" className={inputCls} />
                </Fld>
                <Fld label="Postal Code">
                  <input name="postalCode" defaultValue={cur?.postalCode ?? ''} placeholder="ZIP / postal" className={inputCls} />
                </Fld>
                <Fld label="Country">
                  <select name="country" defaultValue={cur?.country ?? 'United States'} className={inputCls}>
                    <option value="">— Select —</option>
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Fld>
              </div>
            </Sec>
            <Sec title="Contact">
              <div className="grid grid-cols-2 gap-4">
                <Fld label="Phone">
                  <input name="phone" defaultValue={cur?.phone ?? ''} placeholder="+1 (555) 000-0000" className={inputCls} />
                </Fld>
                <Fld label="Fax">
                  <input name="fax" defaultValue={cur?.fax ?? ''} placeholder="Fax number" className={inputCls} />
                </Fld>
              </div>
            </Sec>
            {actionError && (
              <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.25)] text-[var(--color-ruby)] text-[12px] px-3 py-2 rounded-[var(--radius-sm)]">
                {actionError}
              </div>
            )}
          </form>
        )}
      </Drawer>
    </PageShell>
  );
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-[11px] uppercase tracking-wider text-[var(--color-text-secondary)] font-medium border-b border-[var(--color-basalt-500)] pb-1.5">{title}</h3>
      {children}
    </div>
  );
}

function Fld({ label, children, req }: { label: string; children: React.ReactNode; req?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[var(--color-text-secondary)] block text-[12px]">{label}{req && <span className="text-red-400"> *</span>}</label>
      {children}
    </div>
  );
}
