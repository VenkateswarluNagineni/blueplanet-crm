'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2, Truck, Users, Search, Plus, Mail, Phone, MoreHorizontal, DollarSign,
  TrendingUp, Globe, X, MapPin, FileText, Target, ListFilter, Edit2,
} from 'lucide-react';
import type { CrmData } from '@/server/queries/crm';
import { createPartyAction, updatePartyAction, softDeletePartyAction } from '@/server/actions/crm';

type TabType = 'SUPPLIERS' | 'VENDORS' | 'ASSOCIATES';
type EntityType = 'SUPPLIER' | 'VENDOR' | 'ASSOCIATE';

const EMPTY = 'text-center py-12 text-[#b8b6b9] bg-[#1c1c1c] border border-[#454446] border-dashed rounded-md';

export function CrmDashboardClient({ data, canManage }: { data: CrmData; canManage: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const {
    suppliers, vendors, associates,
    activePos, historyPos, vendorInvoices, historyInvoices,
    associatePipeline, associateSales, associateMetrics,
  } = data;

  const [activeTab, setActiveTab] = useState<TabType>('SUPPLIERS');
  const [searchTerm, setSearchTerm] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  // Drill-down drawer
  const [viewing, setViewing] = useState<{ id: string; type: EntityType } | null>(null);
  const [drawerTab, setDrawerTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Add drawer
  const [addOpen, setAddOpen] = useState(false);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [selectedOrigins, setSelectedOrigins] = useState<string[]>([]);
  const [selectedTerms, setSelectedTerms] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);

  const activeFiltersCount =
    (activeTab === 'SUPPLIERS' ? selectedOrigins.length + selectedTerms.length : 0) +
    (activeTab === 'VENDORS' ? selectedServices.length : 0) +
    (activeTab === 'ASSOCIATES' ? selectedRoles.length + selectedLocations.length : 0);

  const clearAllFilters = () => {
    setSelectedOrigins([]); setSelectedTerms([]); setSelectedServices([]); setSelectedRoles([]); setSelectedLocations([]);
  };
  const addUnique = (setter: React.Dispatch<React.SetStateAction<string[]>>, v: string) =>
    setter((prev) => (v && !prev.includes(v) ? [...prev, v] : prev));
  const removeFilter = (setter: React.Dispatch<React.SetStateAction<string[]>>, v: string) =>
    setter((prev) => prev.filter((x) => x !== v));

  const originOptions = Array.from(new Set(suppliers.map((s) => s.origin))).filter((x) => x !== '—');
  const termOptions = Array.from(new Set(suppliers.map((s) => s.terms))).filter((x) => x !== '—');
  const serviceOptions = Array.from(new Set(vendors.map((v) => v.service))).filter((x) => x !== '—');
  const roleOptions = Array.from(new Set(associates.map((a) => a.role))).filter((x) => x !== '—');
  const locationOptions = Array.from(new Set(associates.map((a) => a.location))).filter((x) => x !== '—');

  const matchSearch = (s: string) => s.toLowerCase().includes(searchTerm.toLowerCase());

  const filteredSuppliers = suppliers.filter((i) =>
    matchSearch(`${i.name} ${i.origin} ${i.contact} ${i.email} ${i.terms}`) &&
    (selectedOrigins.length === 0 || selectedOrigins.includes(i.origin)) &&
    (selectedTerms.length === 0 || selectedTerms.includes(i.terms)));
  const filteredVendors = vendors.filter((i) =>
    matchSearch(`${i.name} ${i.service} ${i.contact} ${i.email}`) &&
    (selectedServices.length === 0 || selectedServices.includes(i.service)));
  const filteredAssociates = associates.filter((i) =>
    matchSearch(`${i.name} ${i.salesNumber} ${i.role} ${i.location}`) &&
    (selectedRoles.length === 0 || selectedRoles.includes(i.role)) &&
    (selectedLocations.length === 0 || selectedLocations.includes(i.location)));

  const totalRecords =
    activeTab === 'SUPPLIERS' ? suppliers.length : activeTab === 'VENDORS' ? vendors.length : associates.length;

  const doDelete = (id: string) => {
    if (!confirm('Archive this entity? It will be soft-deleted and hidden from active lists.')) return;
    setOpenMenuId(null);
    setActionError('');
    startTransition(async () => {
      const res = await softDeletePartyAction(id);
      if (!res.ok) setActionError(res.error);
      else router.refresh();
    });
  };

  const handleInlineSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!viewing) return;
    const fd = new FormData(e.currentTarget);
    const u = Object.fromEntries(fd.entries()) as Record<string, string>;
    setActionError('');
    startTransition(async () => {
      const res = await updatePartyAction(viewing.id, viewing.type, {
        contactPerson: u.contact,
        email: u.email,
        phone: u.phone,
        originCountry: u.origin,
        paymentTerms: u.terms,
        incoterms: u.incoterms,
        creditLimit: u.creditLimit !== undefined ? Number(u.creditLimit) || 0 : undefined,
        serviceType: u.service,
        role: u.role,
        baseLocation: u.location,
        commissionRate: u.commissionRate,
      });
      if (!res.ok) { setActionError(res.error); return; }
      setIsEditingProfile(false);
      router.refresh();
    });
  };

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const u = Object.fromEntries(fd.entries()) as Record<string, string>;
    const type: EntityType = activeTab === 'SUPPLIERS' ? 'SUPPLIER' : activeTab === 'VENDORS' ? 'VENDOR' : 'ASSOCIATE';
    setActionError('');
    startTransition(async () => {
      const res = await createPartyAction({
        type,
        name: u.name,
        contactPerson: u.contact || undefined,
        email: u.email || undefined,
        phone: u.phone || undefined,
        originCountry: u.origin || undefined,
        paymentTerms: u.terms || undefined,
        incoterms: u.incoterms || undefined,
        currency: u.currency || undefined,
        creditLimit: u.creditLimit ? Number(u.creditLimit) : undefined,
        serviceType: u.service || undefined,
        role: u.role || undefined,
        baseLocation: u.location || undefined,
        commissionRate: u.commissionRate || undefined,
      });
      if (!res.ok) { setActionError(res.error); return; }
      setAddOpen(false);
      router.refresh();
    });
  };

  const rowMenu = (id: string, type: EntityType) => (
    <td className="px-6 py-3 text-right relative">
      <button
        className="text-[#b8b6b9] hover:text-white p-1 rounded hover:bg-[#454446]"
        onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === id ? null : id); }}
      >
        <MoreHorizontal size={16} />
      </button>
      {openMenuId === id && (
        <div className="absolute right-8 top-8 w-40 bg-[#1c1c1c] border border-[#454446] rounded-md shadow-lg z-50 py-1 text-left" onClick={(e) => e.stopPropagation()}>
          <button className="w-full text-left px-4 py-2 text-[13px] text-white hover:bg-[#333234]" onClick={() => { setOpenMenuId(null); setViewing({ id, type }); setDrawerTab('ACTIVE'); setIsEditingProfile(false); }}>View Profile</button>
          {canManage && <button className="w-full text-left px-4 py-2 text-[13px] text-white hover:bg-[#333234]" onClick={() => { setOpenMenuId(null); setViewing({ id, type }); setDrawerTab('ACTIVE'); setIsEditingProfile(true); }}>Edit Details</button>}
          {canManage && <><div className="h-px bg-[#454446] my-1" /><button className="w-full text-left px-4 py-2 text-[13px] text-red-400 hover:bg-[#333234]" onClick={() => doDelete(id)}>Delete Entity</button></>}
        </div>
      )}
    </td>
  );

  const viewingSupplier = viewing?.type === 'SUPPLIER' ? suppliers.find((s) => s.id === viewing.id) : null;
  const viewingVendor = viewing?.type === 'VENDOR' ? vendors.find((v) => v.id === viewing.id) : null;
  const viewingAssociate = viewing?.type === 'ASSOCIATE' ? associates.find((a) => a.id === viewing.id) : null;
  const inputCls = 'w-full bg-[#333234] border border-[#454446] rounded px-2 py-1.5 text-white text-[12px] outline-none focus:border-[#92b0ce]';
  const addInputCls = 'w-full bg-[#1c1c1c] border border-[#454446] rounded-md px-3 py-2 text-white focus:border-[#92b0ce] outline-none transition-colors';

  return (
    <div className="flex flex-col h-full bg-[#2b2a2c] text-[#d9d8d9] overflow-hidden relative">
      {/* Header & Tabs */}
      <div className="pt-6 px-6 border-b border-[#454446] bg-[#1c1c1c] shrink-0">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[20px] font-medium text-white mb-1">People & Companies</h1>
            <p className="text-[13px] text-[#b8b6b9]">Manage your external supply chain and internal sales roster.</p>
          </div>
          {canManage && (
            <button onClick={() => { setAddOpen(true); setActionError(''); }} className="flex items-center gap-2 bg-[#e3c16c] text-black px-3 py-1.5 rounded-md text-[13px] font-medium hover:bg-[#d2ac55] transition-colors">
              <Plus size={14} /> Add New {activeTab === 'SUPPLIERS' ? 'Supplier' : activeTab === 'VENDORS' ? 'Vendor' : 'Associate'}
            </button>
          )}
        </div>
        <div className="flex items-center gap-6">
          {([['SUPPLIERS', Building2, '#e3c16c', 'Suppliers'], ['VENDORS', Truck, '#92b0ce', 'Vendors (Logistics)'], ['ASSOCIATES', Users, '#10b981', 'Associates / Sales']] as const).map(([tab, Icon, color, label]) => (
            <button key={tab} onClick={() => { setActiveTab(tab); clearAllFilters(); }} className={`flex items-center gap-2 pb-3 text-[13px] font-medium border-b-2 transition-colors ${activeTab === tab ? 'text-white' : 'border-transparent text-[#b8b6b9] hover:text-white'}`} style={activeTab === tab ? { borderColor: color } : undefined}>
              <Icon size={16} style={activeTab === tab ? { color } : undefined} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Action bar */}
      <div className="px-6 py-3 flex items-center justify-between border-b border-[#454446] shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-[#1c1c1c] border border-[#454446] rounded-md px-3 py-1.5 focus-within:border-[#92b0ce] transition-colors w-80">
            <Search size={14} className="text-[#b8b6b9] mr-2 shrink-0" />
            <input type="text" placeholder={`Search ${activeTab.toLowerCase()}...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-transparent border-none outline-none text-[13px] text-white w-full placeholder-[#b8b6b9]" />
          </div>
          <div className="w-px h-4 bg-[#454446]" />
          <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-2 py-1 rounded transition-colors text-[13px] ${showFilters ? 'bg-[#333234] text-white' : 'hover:bg-[#333234] text-[#b8b6b9]'}`}>
            <ListFilter size={14} /> {showFilters ? 'Hide Filters' : 'Filters'}
            {activeFiltersCount > 0 && <span className="bg-[#e3c16c] text-black text-[10px] px-1.5 rounded-sm ml-1 font-medium">{activeFiltersCount}</span>}
          </button>
        </div>
        <div className="text-[13px] text-[#b8b6b9]">Total Records: <strong className="text-white">{totalRecords}</strong></div>
      </div>

      {/* Filter dropdowns */}
      {showFilters && (
        <div className="px-6 py-3 bg-[#1c1c1c] border-b border-[#454446] flex items-center gap-4 text-[13px]">
          <span className="text-[#b8b6b9]">Filter by:</span>
          {activeTab === 'SUPPLIERS' && (
            <>
              <select value="" onChange={(e) => addUnique(setSelectedOrigins, e.target.value)} className="bg-[#333234] border border-[#454446] text-white rounded px-2 py-1 outline-none focus:border-[#92b0ce]"><option value="">+ Add Origin</option>{originOptions.map((o) => <option key={o} value={o}>{o}</option>)}</select>
              <select value="" onChange={(e) => addUnique(setSelectedTerms, e.target.value)} className="bg-[#333234] border border-[#454446] text-white rounded px-2 py-1 outline-none focus:border-[#92b0ce]"><option value="">+ Add Terms</option>{termOptions.map((o) => <option key={o} value={o}>{o}</option>)}</select>
            </>
          )}
          {activeTab === 'VENDORS' && (
            <select value="" onChange={(e) => addUnique(setSelectedServices, e.target.value)} className="bg-[#333234] border border-[#454446] text-white rounded px-2 py-1 outline-none focus:border-[#92b0ce]"><option value="">+ Add Service Type</option>{serviceOptions.map((o) => <option key={o} value={o}>{o}</option>)}</select>
          )}
          {activeTab === 'ASSOCIATES' && (
            <>
              <select value="" onChange={(e) => addUnique(setSelectedRoles, e.target.value)} className="bg-[#333234] border border-[#454446] text-white rounded px-2 py-1 outline-none focus:border-[#92b0ce]"><option value="">+ Add Role</option>{roleOptions.map((o) => <option key={o} value={o}>{o}</option>)}</select>
              <select value="" onChange={(e) => addUnique(setSelectedLocations, e.target.value)} className="bg-[#333234] border border-[#454446] text-white rounded px-2 py-1 outline-none focus:border-[#92b0ce]"><option value="">+ Add Hub Location</option>{locationOptions.map((o) => <option key={o} value={o}>{o}</option>)}</select>
            </>
          )}
          {activeFiltersCount > 0 && <button onClick={clearAllFilters} className="text-[#92b0ce] hover:underline">Clear All</button>}
        </div>
      )}

      {/* Active filter pills */}
      {activeFiltersCount > 0 && (
        <div className="px-6 py-2 bg-[#2b2a2c] border-b border-[#454446] flex items-center gap-2 flex-wrap">
          <span className="text-[#b8b6b9] text-[11px] uppercase tracking-wider mr-2">Active Filters:</span>
          {selectedOrigins.map((v) => <Pill key={v} label={`Origin: ${v}`} onRemove={() => removeFilter(setSelectedOrigins, v)} />)}
          {selectedTerms.map((v) => <Pill key={v} label={`Terms: ${v}`} onRemove={() => removeFilter(setSelectedTerms, v)} />)}
          {selectedServices.map((v) => <Pill key={v} label={`Service: ${v}`} onRemove={() => removeFilter(setSelectedServices, v)} />)}
          {selectedRoles.map((v) => <Pill key={v} label={`Role: ${v}`} onRemove={() => removeFilter(setSelectedRoles, v)} />)}
          {selectedLocations.map((v) => <Pill key={v} label={`Hub: ${v}`} onRemove={() => removeFilter(setSelectedLocations, v)} />)}
        </div>
      )}

      {actionError && <div className="mx-6 mt-3 bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] px-3 py-2 rounded">{actionError}</div>}

      {/* Table */}
      <div className="flex-1 overflow-auto bg-[#2b2a2c]">
        <table className="w-full text-left text-[13px] text-[#d9d8d9] whitespace-nowrap border-collapse min-w-max">
          <thead className="sticky top-0 bg-[#2b2a2c] z-10 shadow-[0_1px_0_#454446]">
            <tr>
              <th className="px-6 py-3 font-medium border-b border-[#454446] w-10"></th>
              {activeTab === 'SUPPLIERS' && <>
                <Th>Supplier Name</Th><Th>Origin</Th><Th>Primary Contact</Th><Th>Terms</Th><Th right>Active POs</Th><Th right>YTD Spend</Th>
              </>}
              {activeTab === 'VENDORS' && <>
                <Th>Vendor Name</Th><Th>Service Type</Th><Th>Primary Contact</Th><Th right>Active Invoices</Th><Th right>AP Balance</Th>
              </>}
              {activeTab === 'ASSOCIATES' && <>
                <Th>Associate Name</Th><Th>Sales Number</Th><Th>Role &amp; Location</Th><Th>Commission</Th><Th right>Active Pipeline</Th><Th right>YTD Sales</Th>
              </>}
              <th className="px-6 py-3 border-b border-[#454446]"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#454446]">
            {activeTab === 'SUPPLIERS' && (filteredSuppliers.length === 0 ? <EmptyRow cols={8} /> : filteredSuppliers.map((item) => (
              <tr key={item.id} className="hover:bg-[#333234] transition-colors group">
                <td className="px-6 py-3" />
                <td className="px-4 py-3 font-medium text-white"><button className="hover:underline hover:text-[#e3c16c]" onClick={() => { setViewing({ id: item.id, type: 'SUPPLIER' }); setDrawerTab('ACTIVE'); setIsEditingProfile(false); }}>{item.name}</button></td>
                <td className="px-4 py-3 text-[#b8b6b9]"><span className="flex items-center gap-1.5"><Globe size={12} /> {item.origin}</span></td>
                <td className="px-4 py-3 text-white">{item.contact}</td>
                <td className="px-4 py-3"><span className="bg-[#454446] text-white px-2 py-0.5 rounded text-[11px]">{item.terms}</span></td>
                <td className="px-4 py-3 text-right font-medium text-white">{item.activePos}</td>
                <td className="px-4 py-3 text-right text-white font-medium">${item.ytdSpend.toLocaleString()}</td>
                {rowMenu(item.id, 'SUPPLIER')}
              </tr>
            )))}
            {activeTab === 'VENDORS' && (filteredVendors.length === 0 ? <EmptyRow cols={7} /> : filteredVendors.map((item) => (
              <tr key={item.id} className="hover:bg-[#333234] transition-colors group">
                <td className="px-6 py-3" />
                <td className="px-4 py-3 font-medium text-white"><button className="hover:underline hover:text-[#92b0ce]" onClick={() => { setViewing({ id: item.id, type: 'VENDOR' }); setDrawerTab('ACTIVE'); setIsEditingProfile(false); }}>{item.name}</button></td>
                <td className="px-4 py-3"><span className="bg-[#333234] border border-[#454446] text-[#b8b6b9] px-2 py-0.5 rounded text-[11px]">{item.service}</span></td>
                <td className="px-4 py-3 text-white">{item.contact}</td>
                <td className="px-4 py-3 text-right font-medium text-white">{item.activeInvoices}</td>
                <td className="px-4 py-3 text-right text-white font-medium flex items-center justify-end gap-1"><DollarSign size={12} className="text-[#e3c16c]" /> {item.balance.toLocaleString()}</td>
                {rowMenu(item.id, 'VENDOR')}
              </tr>
            )))}
            {activeTab === 'ASSOCIATES' && (filteredAssociates.length === 0 ? <EmptyRow cols={8} /> : filteredAssociates.map((item) => (
              <tr key={item.id} className="hover:bg-[#333234] transition-colors group">
                <td className="px-6 py-3" />
                <td className="px-4 py-3 font-medium text-white"><button className="hover:underline hover:text-[#10b981]" onClick={() => { setViewing({ id: item.id, type: 'ASSOCIATE' }); setDrawerTab('ACTIVE'); setIsEditingProfile(false); }}>{item.name}</button></td>
                <td className="px-4 py-3 text-white"><span className="bg-[#454446] border border-[#5d5c5f] px-2 py-0.5 rounded text-[11px] font-mono tracking-wider">{item.salesNumber}</span></td>
                <td className="px-4 py-3"><div className="flex flex-col"><span className="text-white">{item.role}</span><span className="text-[11px] text-[#b8b6b9] flex items-center gap-1 mt-0.5"><MapPin size={10} /> {item.location}</span></div></td>
                <td className="px-4 py-3 text-[#b8b6b9]">{item.commissionRate}</td>
                <td className="px-4 py-3 text-right font-medium text-white">${item.activeOppValue.toLocaleString()}</td>
                <td className="px-4 py-3 text-right"><span className="font-medium text-[#10b981] flex items-center justify-end gap-1"><TrendingUp size={12} /> ${item.ytdSales.toLocaleString()}</span></td>
                {rowMenu(item.id, 'ASSOCIATE')}
              </tr>
            )))}
          </tbody>
        </table>
      </div>

      {/* Drill-down drawer */}
      {viewing && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40" onClick={() => { setViewing(null); setIsEditingProfile(false); }} />
          <div className="fixed top-0 right-0 h-full w-[700px] bg-[#2b2a2c] border-l border-[#454446] shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#454446] bg-[#1c1c1c] shrink-0">
              <div>
                <h2 className="text-[18px] font-medium text-white flex items-center gap-2">
                  {viewing.type === 'SUPPLIER' && <Building2 size={18} className="text-[#e3c16c]" />}
                  {viewing.type === 'VENDOR' && <Truck size={18} className="text-[#92b0ce]" />}
                  {viewing.type === 'ASSOCIATE' && <Target size={18} className="text-[#10b981]" />}
                  {viewingSupplier?.name ?? viewingVendor?.name ?? viewingAssociate?.name}
                  <span className="text-[#b8b6b9] font-normal text-[14px]">{viewing.type === 'SUPPLIER' ? ' Supplier' : viewing.type === 'VENDOR' ? ' Vendor' : ' Associate'} Account</span>
                </h2>
              </div>
              <div className="flex items-center gap-3">
                {canManage && !isEditingProfile && <button onClick={() => setIsEditingProfile(true)} className="flex items-center gap-2 bg-[#333234] text-[#92b0ce] hover:text-white px-3 py-1.5 rounded text-[13px] font-medium border border-[#454446] hover:border-[#92b0ce] transition-colors"><Edit2 size={14} /> Edit Profile</button>}
                <button onClick={() => { setViewing(null); setIsEditingProfile(false); }} className="text-[#b8b6b9] hover:text-white hover:bg-[#333234] p-1.5 rounded transition-colors"><X size={20} /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Profile card */}
              <form onSubmit={handleInlineSave} className="bg-[#1c1c1c] border border-[#454446] rounded-md p-5 mb-2">
                {viewingSupplier && (
                  <div className="grid grid-cols-3 gap-6">
                    <Field label="Contact Information">
                      {isEditingProfile ? <div className="space-y-2"><input name="contact" defaultValue={viewingSupplier.contact} className={inputCls} /><input name="email" defaultValue={viewingSupplier.email} className={inputCls} /><input name="phone" defaultValue={viewingSupplier.phone} className={inputCls} /></div>
                        : <><p className="text-[13px] text-white font-medium">{viewingSupplier.contact}</p><p className="text-[12px] text-[#92b0ce] flex items-center gap-1 mt-1"><Mail size={12} /> {viewingSupplier.email}</p><p className="text-[12px] text-[#b8b6b9] flex items-center gap-1 mt-0.5"><Phone size={12} /> {viewingSupplier.phone}</p></>}
                    </Field>
                    <Field label="Location & Origin">
                      {isEditingProfile ? <input name="origin" defaultValue={viewingSupplier.origin} className={inputCls} /> : <p className="text-[13px] text-white flex items-center gap-1"><Globe size={12} className="text-[#b8b6b9]" /> {viewingSupplier.origin}</p>}
                    </Field>
                    <Field label="Financial Terms & Credit">
                      {isEditingProfile ? <div className="space-y-2"><input name="terms" defaultValue={viewingSupplier.terms} className={inputCls} placeholder="Payment Terms" /><input name="incoterms" defaultValue={viewingSupplier.incoterms} className={inputCls} placeholder="Incoterms" /><input name="creditLimit" type="number" defaultValue={viewingSupplier.creditLimit} className={inputCls} placeholder="Credit Limit" /></div>
                        : <><div className="flex items-center gap-2 mb-1"><span className="bg-[#454446] text-white px-2 py-0.5 rounded text-[11px] font-medium">{viewingSupplier.terms}</span><span className="bg-[#454446] text-[#b8b6b9] px-2 py-0.5 rounded text-[11px] font-medium border border-[#5d5c5f]">{viewingSupplier.incoterms}</span></div>{viewingSupplier.creditLimit > 0 ? <p className="text-[12px] text-[#10b981] font-medium">Limit: ${viewingSupplier.creditLimit.toLocaleString()} {viewingSupplier.currency}</p> : <p className="text-[12px] text-[#e3c16c] font-medium">Cash in Advance / No Credit</p>}</>}
                    </Field>
                  </div>
                )}
                {viewingVendor && (
                  <div className="grid grid-cols-3 gap-6">
                    <Field label="Contact Information">
                      {isEditingProfile ? <div className="space-y-2"><input name="contact" defaultValue={viewingVendor.contact} className={inputCls} /><input name="email" defaultValue={viewingVendor.email} className={inputCls} /><input name="phone" defaultValue={viewingVendor.phone} className={inputCls} /></div>
                        : <><p className="text-[13px] text-white font-medium">{viewingVendor.contact}</p><p className="text-[12px] text-[#92b0ce] flex items-center gap-1 mt-1"><Mail size={12} /> {viewingVendor.email}</p><p className="text-[12px] text-[#b8b6b9] flex items-center gap-1 mt-0.5"><Phone size={12} /> {viewingVendor.phone}</p></>}
                    </Field>
                    <Field label="Service Type">
                      {isEditingProfile ? <input name="service" defaultValue={viewingVendor.service} className={inputCls} /> : <span className="bg-[#333234] border border-[#454446] text-[#b8b6b9] px-2 py-0.5 rounded text-[11px]">{viewingVendor.service}</span>}
                    </Field>
                    <Field label="Active Balance & Rating">
                      <p className="text-[14px] text-[#e3c16c] font-medium flex items-center gap-1 mb-1"><DollarSign size={14} /> {viewingVendor.balance.toLocaleString()}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20 px-1.5 py-0.5 rounded text-[10px] font-bold">
                          98.4% On-Time SLA
                        </span>
                        <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded text-[10px]">
                          Low Hold Risk
                        </span>
                      </div>
                    </Field>
                  </div>
                )}
                {viewingAssociate && (
                  <div className="grid grid-cols-3 gap-6">
                    <Field label="Role & ID">
                      {isEditingProfile ? <input name="role" defaultValue={viewingAssociate.role} className={inputCls} /> : <><p className="text-[13px] text-white font-medium mb-1">{viewingAssociate.role}</p><span className="bg-[#454446] border border-[#5d5c5f] px-2 py-0.5 rounded text-[11px] font-mono tracking-wider text-white">{viewingAssociate.salesNumber}</span></>}
                    </Field>
                    <Field label="Location">
                      {isEditingProfile ? <input name="location" defaultValue={viewingAssociate.location} className={inputCls} /> : <p className="text-[13px] text-white flex items-center gap-1"><MapPin size={12} className="text-[#b8b6b9]" /> {viewingAssociate.location}</p>}
                    </Field>
                    <Field label="Commission Target">
                      {isEditingProfile ? <input name="commissionRate" defaultValue={viewingAssociate.commissionRate} className={inputCls} /> : <p className="text-[13px] text-white font-medium">{viewingAssociate.commissionRate}</p>}
                    </Field>
                  </div>
                )}
                {isEditingProfile && (
                  <div className="mt-6 pt-4 border-t border-[#454446] flex justify-end gap-3">
                    <button type="button" onClick={() => setIsEditingProfile(false)} className="px-4 py-2 text-[12px] font-medium text-[#b8b6b9] hover:text-white transition-colors">Cancel</button>
                    <button type="submit" disabled={isPending} className="px-4 py-2 text-[12px] font-medium bg-[#e3c16c] text-black rounded hover:bg-[#d2ac55] transition-colors disabled:opacity-60">{isPending ? 'Saving…' : 'Save Changes'}</button>
                  </div>
                )}
              </form>

              {/* Inner tabs */}
              <div className="flex border-b border-[#454446] mb-4 gap-6">
                <button onClick={() => setDrawerTab('ACTIVE')} className={`pb-2 text-[13px] font-medium border-b-2 ${drawerTab === 'ACTIVE' ? 'border-[#e3c16c] text-white' : 'border-transparent text-[#b8b6b9] hover:text-white'}`}>
                  {viewing.type === 'SUPPLIER' ? 'Ongoing Purchase Orders' : viewing.type === 'VENDOR' ? 'Pending Invoices' : 'Active Pipeline'}
                </button>
                <button onClick={() => setDrawerTab('HISTORY')} className={`pb-2 text-[13px] font-medium border-b-2 ${drawerTab === 'HISTORY' ? 'border-[#e3c16c] text-white' : 'border-transparent text-[#b8b6b9] hover:text-white'}`}>
                  {viewing.type === 'SUPPLIER' ? 'Historical Business' : viewing.type === 'VENDOR' ? 'Payment History' : 'Closed Sales'}
                </button>
              </div>

              {/* SUPPLIER cards */}
              {viewing.type === 'SUPPLIER' && (() => {
                const list = drawerTab === 'ACTIVE' ? activePos[viewing.id] : historyPos[viewing.id];
                if (!list || list.length === 0) return <div className={EMPTY}>{drawerTab === 'ACTIVE' ? 'No ongoing Purchase Orders.' : 'No historical POs found.'}</div>;
                return <div className="space-y-4">{list.map((po) => (
                  <div key={po.poNumber} className="bg-[#1c1c1c] border border-[#454446] rounded-md overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-[#454446] bg-[#333234]/30">
                      <div className="flex items-center gap-3"><span className="font-mono text-white font-medium">{po.poNumber}</span><span className="px-2 py-0.5 rounded text-[11px] font-medium border bg-[#92b0ce]/10 text-[#92b0ce] border-[#92b0ce]/30">{po.status}</span></div>
                      <span className="text-[14px] font-medium text-[#10b981]">${po.amount.toLocaleString()}</span>
                    </div>
                    <div className="p-4 grid grid-cols-3 gap-4 text-[13px]">
                      <div><p className="text-[#b8b6b9] mb-1">ETA</p><p className="text-white font-medium">{po.eta}</p></div>
                      <div><p className="text-[#b8b6b9] mb-1">Container</p><p className="text-white font-mono">{po.container}</p></div>
                      <div><p className="text-[#b8b6b9] mb-1">Slabs</p><p className="text-white">{po.slabs} Units</p></div>
                    </div>
                  </div>
                ))}</div>;
              })()}

              {/* VENDOR cards */}
              {viewing.type === 'VENDOR' && (() => {
                const list = drawerTab === 'ACTIVE' ? vendorInvoices[viewing.id] : historyInvoices[viewing.id];
                if (!list || list.length === 0) return <div className={EMPTY}>{drawerTab === 'ACTIVE' ? 'No pending invoices found.' : 'No payment history found.'}</div>;
                return <div className="space-y-4">{list.map((inv) => (
                  <div key={inv.invoiceNum} className="bg-[#1c1c1c] border border-[#454446] rounded-md overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-[#454446] bg-[#333234]/30">
                      <div className="flex items-center gap-3"><FileText size={14} className="text-[#92b0ce]" /><span className="font-mono text-white font-medium">{inv.invoiceNum}</span><span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${inv.status === 'Overdue' ? 'bg-red-500/10 text-red-400 border-red-500/30' : inv.status === 'In Dispute' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' : 'bg-[#e3c16c]/10 text-[#e3c16c] border-[#e3c16c]/30'}`}>{inv.status}</span></div>
                      <span className="text-[14px] font-medium text-[#e3c16c]">${inv.amount.toLocaleString()}</span>
                    </div>
                    <div className="p-4 text-[13px]"><p className="text-[#b8b6b9] mb-1">Service Provided</p><p className="text-white mb-4">{inv.serviceDetails}</p><p className="text-[#b8b6b9] mb-1">Due Date</p><p className="text-white font-medium">{inv.dueDate}</p></div>
                  </div>
                ))}</div>;
              })()}

              {/* ASSOCIATE cards */}
              {viewing.type === 'ASSOCIATE' && (
                <>
                  {associateMetrics[viewing.id] && (
                    <div className="grid grid-cols-4 gap-3 mb-6">
                      <Metric label="Avg Deal Size" value={`$${associateMetrics[viewing.id].avgDealSize.toLocaleString()}`} />
                      <Metric label="Win Rate" value={associateMetrics[viewing.id].conversionRate} color="#10b981" />
                      <Metric label="YTD Commission" value={`$${associateMetrics[viewing.id].commissionEarnedYTD.toLocaleString()}`} color="#e3c16c" />
                      <Metric label="Quota" value={associateMetrics[viewing.id].quotaAttainment} />
                    </div>
                  )}
                  {drawerTab === 'ACTIVE' && (() => {
                    const list = associatePipeline[viewing.id];
                    if (!list || list.length === 0) return <div className={EMPTY}>No active opportunities in pipeline.</div>;
                    return <div className="space-y-4">{list.map((opp, idx) => (
                      <div key={idx} className="bg-[#1c1c1c] border border-[#454446] rounded-md overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-[#454446] bg-[#333234]/30"><div className="flex items-center gap-3"><Target size={14} className="text-[#b8b6b9]" /><span className="text-white font-medium">{opp.oppName}</span><span className="px-2 py-0.5 rounded text-[11px] font-medium border bg-[#92b0ce]/10 text-[#92b0ce] border-[#92b0ce]/30">{opp.status}</span></div><span className="text-[14px] font-medium text-white">${opp.amount.toLocaleString()}</span></div>
                        <div className="p-4 grid grid-cols-2 gap-4 text-[13px]"><div><p className="text-[#b8b6b9] mb-1">Expected Close</p><p className="text-white font-medium">{opp.expectedClose}</p></div><div><p className="text-[#b8b6b9] mb-1">Probability</p><div className="flex items-center gap-2"><div className="h-1.5 flex-1 bg-[#333234] rounded-full overflow-hidden"><div className="h-full bg-[#10b981]" style={{ width: opp.probability }} /></div><span className="text-white">{opp.probability}</span></div></div></div>
                      </div>
                    ))}</div>;
                  })()}
                  {drawerTab === 'HISTORY' && (() => {
                    const list = associateSales[viewing.id];
                    if (!list || list.length === 0) return <div className={EMPTY}>No recent closed sales found.</div>;
                    return <div className="space-y-4">{list.map((sale, idx) => (
                      <div key={idx} className="bg-[#1c1c1c] border border-[#10b981]/30 rounded-md overflow-hidden relative"><div className="absolute top-0 left-0 w-1 h-full bg-[#10b981]" />
                        <div className="flex items-center justify-between p-4 border-b border-[#454446] bg-[#333234]/30 pl-5"><div className="flex items-center gap-3"><FileText size={14} className="text-[#10b981]" /><span className="font-mono text-white font-medium">{sale.soNumber}</span><span className="bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/30 px-2 py-0.5 rounded text-[11px] font-medium">Closed Won</span></div><span className="text-[14px] font-medium text-[#10b981]">+${sale.amount.toLocaleString()}</span></div>
                        <div className="p-4 grid grid-cols-3 gap-4 text-[13px] pl-5"><div><p className="text-[#b8b6b9] mb-1">Customer</p><p className="text-white font-medium">{sale.customer}</p></div><div><p className="text-[#b8b6b9] mb-1">Close Date</p><p className="text-white">{sale.closeDate}</p></div><div><p className="text-[#b8b6b9] mb-1">Items</p><p className="text-white">{sale.items} Units</p></div></div>
                      </div>
                    ))}</div>;
                  })()}
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Add drawer */}
      {addOpen && canManage && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setAddOpen(false)} />
          <form onSubmit={handleAdd} className="fixed top-0 right-0 h-full w-[600px] bg-[#2b2a2c] border-l border-[#454446] shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#454446] bg-[#1c1c1c] shrink-0">
              <div>
                <h2 className="text-[18px] font-medium text-white">Register New {activeTab === 'SUPPLIERS' ? 'Supplier' : activeTab === 'VENDORS' ? 'Vendor' : 'Associate'}</h2>
                <p className="text-[13px] text-[#b8b6b9] mt-1">Add them to the global directory.</p>
              </div>
              <button type="button" onClick={() => setAddOpen(false)} className="text-[#b8b6b9] hover:text-white hover:bg-[#333234] p-1.5 rounded transition-colors"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-[13px]">
              <div className="space-y-1.5"><label className="text-[#b8b6b9] block">{activeTab === 'ASSOCIATES' ? 'Full Name' : 'Company Name'}</label><input name="name" required placeholder={activeTab === 'ASSOCIATES' ? 'e.g. Alex Johnson' : 'e.g. Antolini Italy'} className={addInputCls} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><label className="text-[#b8b6b9] block">Point of Contact</label><input name="contact" placeholder="e.g. Sarah Jenkins" className={addInputCls} /></div>
                <div className="space-y-1.5"><label className="text-[#b8b6b9] block">Email</label><input name="email" type="email" placeholder="email@example.com" className={addInputCls} /></div>
              </div>
              <div className="space-y-1.5"><label className="text-[#b8b6b9] block">Phone</label><input name="phone" placeholder="+1 (555) 000-0000" className={addInputCls} /></div>

              {activeTab === 'SUPPLIERS' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><label className="text-[#b8b6b9] block">Origin Country</label><input name="origin" placeholder="e.g. Italy" className={addInputCls} /></div>
                  <div className="space-y-1.5"><label className="text-[#b8b6b9] block">Payment Terms</label><select name="terms" className={addInputCls}><option value="Pre-Pay">Pre-Pay</option><option value="Net 30">Net 30</option><option value="Net 60">Net 60</option></select></div>
                  <div className="space-y-1.5"><label className="text-[#b8b6b9] block">Incoterms</label><input name="incoterms" placeholder="e.g. FOB Genoa" className={addInputCls} /></div>
                  <div className="space-y-1.5"><label className="text-[#b8b6b9] block">Credit Limit</label><input name="creditLimit" type="number" placeholder="0" className={addInputCls} /></div>
                  <div className="space-y-1.5"><label className="text-[#b8b6b9] block">Currency</label><select name="currency" className={addInputCls}><option value="USD">USD</option><option value="EUR">EUR</option><option value="BRL">BRL</option></select></div>
                </div>
              )}
              {activeTab === 'VENDORS' && (
                <div className="space-y-1.5"><label className="text-[#b8b6b9] block">Service Type</label><select name="service" className={addInputCls}><option value="Ocean Freight">Ocean Freight</option><option value="Inland Logistics">Inland Logistics</option><option value="Customs &amp; Tariffs">Customs &amp; Tariffs</option></select></div>
              )}
              {activeTab === 'ASSOCIATES' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><label className="text-[#b8b6b9] block">Role</label><input name="role" placeholder="e.g. Sales Rep" className={addInputCls} /></div>
                  <div className="space-y-1.5"><label className="text-[#b8b6b9] block">Base Location</label><input name="location" placeholder="e.g. Maryland Hub" className={addInputCls} /></div>
                  <div className="space-y-1.5"><label className="text-[#b8b6b9] block">Commission Rate</label><input name="commissionRate" placeholder="e.g. 5%" className={addInputCls} /></div>
                </div>
              )}
              {actionError && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] px-3 py-2 rounded">{actionError}</div>}
            </div>
            <div className="p-4 border-t border-[#454446] bg-[#1c1c1c] flex items-center justify-end gap-3 shrink-0">
              <button type="button" onClick={() => setAddOpen(false)} className="px-4 py-2 text-[13px] font-medium text-white hover:bg-[#333234] rounded-md transition-colors">Cancel</button>
              <button type="submit" disabled={isPending} className="px-4 py-2 text-[13px] font-medium text-black rounded-md bg-[#e3c16c] hover:bg-[#d2ac55] transition-colors disabled:opacity-60">{isPending ? 'Saving…' : 'Save Record'}</button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-4 py-3 font-medium border-b border-[#454446] ${right ? 'text-right' : ''}`}>{children}</th>;
}
function EmptyRow({ cols }: { cols: number }) {
  return <tr><td colSpan={cols} className="px-6 py-12 text-center text-[#b8b6b9]">No records match your filters.</td></tr>;
}
function Pill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return <span className="flex items-center gap-1.5 bg-[#333234] border border-[#454446] px-2.5 py-1 rounded-full text-[11px] text-white">{label}<X size={12} className="cursor-pointer hover:text-[#e3c16c] ml-1" onClick={onRemove} /></span>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="text-[11px] text-[#b8b6b9] uppercase tracking-wider mb-1">{label}</p>{children}</div>;
}
function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return <div className="bg-[#333234] border border-[#454446] p-3 rounded-md"><p className="text-[11px] text-[#b8b6b9] uppercase tracking-wider mb-1">{label}</p><p className="text-[14px] font-medium" style={{ color: color ?? '#ffffff' }}>{value}</p></div>;
}
