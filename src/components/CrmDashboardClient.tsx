'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2, Truck, Users, UserSquare2, Search, Plus, Mail, Phone, MoreHorizontal, DollarSign,
  TrendingUp, Globe, X, MapPin, FileText, Target, ListFilter, Edit2, KeyRound, Copy,
} from 'lucide-react';
import type { CrmData } from '@/server/queries/crm';
import type { CreatePartyInput } from '@/lib/validation/party';
import { createPartyAction, updatePartyAction, softDeletePartyAction } from '@/server/actions/crm';
import {
  COUNTRIES, CURRENCIES, PAYMENT_TERMS, INCOTERMS, PARTY_STATUS, SUPPLIER_SUBTYPES,
  CUSTOMER_SUBTYPES, MATERIAL_CATEGORIES, VENDOR_SERVICE_TYPES, VENDOR_RATE_BASIS,
  CUSTOMER_PRICE_TIERS, ASSOCIATE_ROLES, LOGIN_ROLES,
} from '@/lib/reference';

type TabType = 'SUPPLIERS' | 'VENDORS' | 'CUSTOMERS' | 'ASSOCIATES';
type EntityType = 'SUPPLIER' | 'VENDOR' | 'CUSTOMER' | 'ASSOCIATE';

const TAB_TO_TYPE: Record<TabType, EntityType> = {
  SUPPLIERS: 'SUPPLIER', VENDORS: 'VENDOR', CUSTOMERS: 'CUSTOMER', ASSOCIATES: 'ASSOCIATE',
};
const TYPE_LABEL: Record<EntityType, string> = {
  SUPPLIER: 'Supplier', VENDOR: 'Vendor', CUSTOMER: 'Customer', ASSOCIATE: 'Associate',
};

const EMPTY = 'text-center py-12 text-[#b8b6b9] bg-[#1c1c1c] border border-[#454446] border-dashed rounded-md';

export function CrmDashboardClient({ data, canManage }: { data: CrmData; canManage: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const {
    suppliers, vendors, associates, customers,
    activePos, historyPos, vendorInvoices, historyInvoices,
    associatePipeline, associateSales, associateMetrics,
  } = data;

  const [activeTab, setActiveTab] = useState<TabType>('SUPPLIERS');
  const [searchTerm, setSearchTerm] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  // One-time temp password surfaced after provisioning a member's login.
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  // Controlled "provision login" toggle so the form can reveal the login fields.
  const [provisionLogin, setProvisionLogin] = useState(false);

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
  const filteredCustomers = customers.filter((i) =>
    matchSearch(`${i.name} ${i.systemId} ${i.contact} ${i.email} ${i.subType} ${i.rep}`));

  const totalRecords =
    activeTab === 'SUPPLIERS' ? suppliers.length
      : activeTab === 'VENDORS' ? vendors.length
      : activeTab === 'CUSTOMERS' ? customers.length
      : associates.length;

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
        salesTargetAnnual: u.salesTargetAnnual !== undefined && u.salesTargetAnnual !== '' ? Number(u.salesTargetAnnual) : undefined,
      });
      if (!res.ok) { setActionError(res.error); return; }
      setIsEditingProfile(false);
      router.refresh();
    });
  };

  const closeAdd = () => { setAddOpen(false); setProvisionLogin(false); setActionError(''); };

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const u = Object.fromEntries(fd.entries()) as Record<string, string>;
    const v = (k: string) => (u[k]?.trim() ? u[k].trim() : undefined);
    const num = (k: string) => (u[k]?.trim() ? Number(u[k]) : undefined);
    const type = TAB_TO_TYPE[activeTab];

    // Assemble the structured primary address only if a usable line + city + country were entered.
    const addr = v('addr_line1') && v('addr_city') && v('addr_country')
      ? [{ kind: 'PRIMARY' as const, line1: u.addr_line1.trim(), line2: v('addr_line2'),
           city: u.addr_city.trim(), region: v('addr_region'), postalCode: v('addr_postal'),
           country: u.addr_country as (typeof COUNTRIES)[number] }]
      : undefined;

    const base = {
      name: u.name?.trim() ?? '', legalName: v('legalName'), website: v('website'),
      status: (v('status') as (typeof PARTY_STATUS)[number]) ?? 'ACTIVE', notes: v('notes'),
      contactPerson: v('contact'), email: v('email'), phone: v('phone'), addresses: addr,
    };

    let input: CreatePartyInput;
    if (type === 'SUPPLIER') {
      input = { type, ...base,
        subType: v('subType') as never, originCountry: v('origin') as never,
        materialCategories: fd.getAll('materialCategories') as never,
        paymentTerms: v('terms') as never, incoterms: v('incoterms') as never,
        currency: (v('currency') ?? 'USD') as never, creditLimit: num('creditLimit'),
        taxId: v('taxId'), leadTimeDays: num('leadTimeDays'), minOrderValue: num('minOrderValue'),
        remittanceInfo: v('remittanceInfo'), certifications: v('certifications') };
    } else if (type === 'VENDOR') {
      input = { type, ...base,
        serviceType: v('service') as never, serviceArea: v('serviceArea'), rateBasis: v('rateBasis') as never,
        currency: (v('currency') ?? 'USD') as never, paymentTerms: v('terms') as never, taxId: v('taxId'),
        insurancePolicy: v('insurancePolicy'), licenseNumber: v('licenseNumber'),
        provisionLogin, loginEmail: v('loginEmail') ?? v('email'), loginRole: (v('loginRole') ?? 'VENDOR') as never };
    } else if (type === 'CUSTOMER') {
      input = { type, ...base,
        subType: v('subType') as never, currency: (v('currency') ?? 'USD') as never, paymentTerms: v('terms') as never,
        creditLimit: num('creditLimit'), taxId: v('taxId'), taxExempt: u.taxExempt === 'on',
        resaleCertNumber: v('resaleCertNumber'), priceTier: v('priceTier') as never, source: v('source'),
        assignedAssociateId: v('assignedAssociateId') };
    } else {
      input = { type, ...base,
        role: v('role'), baseLocation: v('location'), territory: v('territory'), employeeId: v('employeeId'),
        startDate: v('startDate'), commissionRate: v('commissionRate'), salesTargetAnnual: num('salesTargetAnnual'),
        provisionLogin, loginEmail: v('loginEmail') ?? v('email'), loginRole: (v('loginRole') ?? 'SALES') as never };
    }

    setActionError('');
    startTransition(async () => {
      const res = await createPartyAction(input);
      if (!res.ok) { setActionError(res.error); return; }
      if (res.tempPassword) setTempPassword(res.tempPassword);
      closeAdd();
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
  const viewingCustomer = viewing?.type === 'CUSTOMER' ? customers.find((c) => c.id === viewing.id) : null;
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
            <button onClick={() => { setAddOpen(true); setActionError(''); setProvisionLogin(false); }} className="flex items-center gap-2 bg-[#e3c16c] text-black px-3 py-1.5 rounded-md text-[13px] font-medium hover:bg-[#d2ac55] transition-colors">
              <Plus size={14} /> Add New {TYPE_LABEL[TAB_TO_TYPE[activeTab]]}
            </button>
          )}
        </div>
        <div className="flex items-center gap-6">
          {([['SUPPLIERS', Building2, '#e3c16c', 'Suppliers'], ['VENDORS', Truck, '#92b0ce', 'Vendors (Logistics)'], ['CUSTOMERS', UserSquare2, '#e8956b', 'Customers'], ['ASSOCIATES', Users, '#10b981', 'Associates / Sales']] as const).map(([tab, Icon, color, label]) => (
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
              {activeTab === 'CUSTOMERS' && <>
                <Th>Customer Name</Th><Th>Type</Th><Th>Primary Contact</Th><Th>Terms</Th><Th>Assigned Rep</Th><Th right>Open Deals</Th><Th right>Lifetime Value</Th>
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
            {activeTab === 'CUSTOMERS' && (filteredCustomers.length === 0 ? <EmptyRow cols={9} /> : filteredCustomers.map((item) => (
              <tr key={item.id} className="hover:bg-[#333234] transition-colors group">
                <td className="px-6 py-3" />
                <td className="px-4 py-3 font-medium text-white"><button className="hover:underline hover:text-[#e8956b]" onClick={() => { setViewing({ id: item.id, type: 'CUSTOMER' }); setDrawerTab('ACTIVE'); setIsEditingProfile(false); }}>{item.name}</button></td>
                <td className="px-4 py-3"><span className="bg-[#333234] border border-[#454446] text-[#b8b6b9] px-2 py-0.5 rounded text-[11px]">{item.subType}</span></td>
                <td className="px-4 py-3 text-white">{item.contact}</td>
                <td className="px-4 py-3"><span className="bg-[#454446] text-white px-2 py-0.5 rounded text-[11px]">{item.terms}</span></td>
                <td className="px-4 py-3 text-[#b8b6b9]">{item.rep}</td>
                <td className="px-4 py-3 text-right font-medium text-white">{item.openDeals}</td>
                <td className="px-4 py-3 text-right text-white font-medium">${item.lifetimeValue.toLocaleString()}</td>
                {rowMenu(item.id, 'CUSTOMER')}
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
                  {viewing.type === 'CUSTOMER' && <UserSquare2 size={18} className="text-[#e8956b]" />}
                  {viewing.type === 'ASSOCIATE' && <Target size={18} className="text-[#10b981]" />}
                  {viewingSupplier?.name ?? viewingVendor?.name ?? viewingCustomer?.name ?? viewingAssociate?.name}
                  <span className="text-[#b8b6b9] font-normal text-[14px]"> {TYPE_LABEL[viewing.type]} Account</span>
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
                    <Field label="Commission &amp; Annual Target">
                      {isEditingProfile ? (
                        <div className="space-y-2">
                          <input name="commissionRate" defaultValue={viewingAssociate.commissionRate} className={inputCls} placeholder="Commission rate" />
                          <input name="salesTargetAnnual" type="number" defaultValue={viewingAssociate.salesTargetAnnual || ''} className={inputCls} placeholder="Annual target ($)" />
                        </div>
                      ) : (
                        <>
                          <p className="text-[13px] text-white font-medium">{viewingAssociate.commissionRate}</p>
                          <p className="text-[12px] text-[#e3c16c] mt-1">
                            Target: {viewingAssociate.salesTargetAnnual > 0 ? `$${viewingAssociate.salesTargetAnnual.toLocaleString()}` : 'Not set'}
                          </p>
                        </>
                      )}
                    </Field>
                  </div>
                )}
                {viewingCustomer && (
                  <div className="grid grid-cols-3 gap-6">
                    <Field label="Contact Information">
                      {isEditingProfile ? <div className="space-y-2"><input name="contact" defaultValue={viewingCustomer.contact} className={inputCls} /><input name="email" defaultValue={viewingCustomer.email} className={inputCls} /><input name="phone" defaultValue={viewingCustomer.phone} className={inputCls} /></div>
                        : <><p className="text-[13px] text-white font-medium">{viewingCustomer.contact}</p><p className="text-[12px] text-[#92b0ce] flex items-center gap-1 mt-1"><Mail size={12} /> {viewingCustomer.email}</p><p className="text-[12px] text-[#b8b6b9] flex items-center gap-1 mt-0.5"><Phone size={12} /> {viewingCustomer.phone}</p></>}
                    </Field>
                    <Field label="Type &amp; Terms">
                      {isEditingProfile ? <div className="space-y-2"><input name="terms" defaultValue={viewingCustomer.terms} className={inputCls} placeholder="Payment Terms" /><input name="creditLimit" type="number" defaultValue={viewingCustomer.creditLimit} className={inputCls} placeholder="Credit Limit" /></div>
                        : <><span className="bg-[#333234] border border-[#454446] text-[#b8b6b9] px-2 py-0.5 rounded text-[11px]">{viewingCustomer.subType}</span><div className="flex items-center gap-2 mt-1.5"><span className="bg-[#454446] text-white px-2 py-0.5 rounded text-[11px]">{viewingCustomer.terms}</span>{viewingCustomer.creditLimit > 0 && <span className="text-[12px] text-[#10b981]">${viewingCustomer.creditLimit.toLocaleString()}</span>}</div></>}
                    </Field>
                    <Field label="Relationship">
                      <p className="text-[13px] text-white">Price tier: <span className="text-[#e3c16c]">{viewingCustomer.priceTier}</span></p>
                      <p className="text-[12px] text-[#b8b6b9] mt-1 flex items-center gap-1"><Users size={11} /> Rep: {viewingCustomer.rep}</p>
                      <p className="text-[12px] text-[#b8b6b9] mt-0.5">Lifetime: ${viewingCustomer.lifetimeValue.toLocaleString()}</p>
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

              {/* Inner tabs (activity drill-down) — not shown for customers */}
              {viewing.type !== 'CUSTOMER' && (
              <div className="flex border-b border-[#454446] mb-4 gap-6">
                <button onClick={() => setDrawerTab('ACTIVE')} className={`pb-2 text-[13px] font-medium border-b-2 ${drawerTab === 'ACTIVE' ? 'border-[#e3c16c] text-white' : 'border-transparent text-[#b8b6b9] hover:text-white'}`}>
                  {viewing.type === 'SUPPLIER' ? 'Ongoing Purchase Orders' : viewing.type === 'VENDOR' ? 'Pending Invoices' : 'Active Pipeline'}
                </button>
                <button onClick={() => setDrawerTab('HISTORY')} className={`pb-2 text-[13px] font-medium border-b-2 ${drawerTab === 'HISTORY' ? 'border-[#e3c16c] text-white' : 'border-transparent text-[#b8b6b9] hover:text-white'}`}>
                  {viewing.type === 'SUPPLIER' ? 'Historical Business' : viewing.type === 'VENDOR' ? 'Payment History' : 'Closed Sales'}
                </button>
              </div>
              )}

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

      {/* Add drawer — comprehensive, sectioned intake per member type */}
      {addOpen && canManage && (() => {
        const t = TAB_TO_TYPE[activeTab];
        const isCompany = t !== 'ASSOCIATE';
        const showLogin = t === 'ASSOCIATE' || t === 'VENDOR';
        return (
        <>
          <div className="fixed inset-0 bg-black/60 z-40" onClick={closeAdd} />
          <form onSubmit={handleAdd} className="fixed top-0 right-0 h-full w-[640px] bg-[#2b2a2c] border-l border-[#454446] shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#454446] bg-[#1c1c1c] shrink-0">
              <div>
                <h2 className="text-[18px] font-medium text-white">Register New {TYPE_LABEL[t]}</h2>
                <p className="text-[13px] text-[#b8b6b9] mt-1">Capture the full record. Fields marked <span className="text-red-400">*</span> are required.</p>
              </div>
              <button type="button" onClick={closeAdd} className="text-[#b8b6b9] hover:text-white hover:bg-[#333234] p-1.5 rounded transition-colors"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-[13px]">
              {/* Identity */}
              <Sec title="Identity">
                <Fld label={isCompany ? 'Company / Trading Name' : 'Full Name'} req>
                  <input name="name" required placeholder={isCompany ? 'e.g. Antolini Italy' : 'e.g. Alex Johnson'} className={addInputCls} />
                </Fld>
                <div className="grid grid-cols-2 gap-4">
                  {isCompany && <Fld label="Legal Entity Name"><input name="legalName" placeholder="Registered legal name" className={addInputCls} /></Fld>}
                  <Fld label="Website"><input name="website" placeholder="https://example.com" className={addInputCls} /></Fld>
                  <Fld label="Status"><select name="status" defaultValue="ACTIVE" className={addInputCls}>{PARTY_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}</select></Fld>
                  {t === 'SUPPLIER' && <Fld label="Supplier Type"><select name="subType" className={addInputCls}><option value="">—</option>{SUPPLIER_SUBTYPES.map((s) => <option key={s} value={s}>{s}</option>)}</select></Fld>}
                  {t === 'CUSTOMER' && <Fld label="Customer Type"><select name="subType" className={addInputCls}><option value="">—</option>{CUSTOMER_SUBTYPES.map((s) => <option key={s} value={s}>{s}</option>)}</select></Fld>}
                </div>
              </Sec>

              {/* Primary contact */}
              <Sec title="Primary Contact">
                <div className="grid grid-cols-2 gap-4">
                  <Fld label="Point of Contact"><input name="contact" placeholder="e.g. Sarah Jenkins" className={addInputCls} /></Fld>
                  <Fld label="Email"><input name="email" type="email" placeholder="email@example.com" className={addInputCls} /></Fld>
                  <Fld label="Phone"><input name="phone" placeholder="+1 (555) 000-0000" className={addInputCls} /></Fld>
                </div>
                <p className="text-[11px] text-[#7d7c7f]">Provide at least one way to reach this member (email or phone).</p>
              </Sec>

              {/* Address */}
              <Sec title={t === 'CUSTOMER' ? 'Primary / Billing Address' : 'Address'}>
                <Fld label="Street Address"><input name="addr_line1" placeholder="Street, building" className={addInputCls} /></Fld>
                <Fld label="Address Line 2"><input name="addr_line2" placeholder="Suite, unit (optional)" className={addInputCls} /></Fld>
                <div className="grid grid-cols-2 gap-4">
                  <Fld label="City"><input name="addr_city" placeholder="City" className={addInputCls} /></Fld>
                  <Fld label="State / Region"><input name="addr_region" placeholder="State / province" className={addInputCls} /></Fld>
                  <Fld label="Postal Code"><input name="addr_postal" placeholder="ZIP / postal" className={addInputCls} /></Fld>
                  <Fld label="Country"><select name="addr_country" className={addInputCls}><option value="">— Select —</option>{COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></Fld>
                </div>
              </Sec>

              {/* SUPPLIER specifics */}
              {t === 'SUPPLIER' && (
                <Sec title="Commercial & Compliance">
                  <div className="grid grid-cols-2 gap-4">
                    <Fld label="Origin Country"><select name="origin" className={addInputCls}><option value="">—</option>{COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></Fld>
                    <Fld label="Materials Supplied"><select name="materialCategories" multiple className={`${addInputCls} h-[88px]`}>{MATERIAL_CATEGORIES.map((m) => <option key={m} value={m}>{m}</option>)}</select></Fld>
                    <Fld label="Payment Terms"><select name="terms" className={addInputCls}><option value="">—</option>{PAYMENT_TERMS.map((p) => <option key={p} value={p}>{p}</option>)}</select></Fld>
                    <Fld label="Incoterms"><select name="incoterms" className={addInputCls}><option value="">—</option>{INCOTERMS.map((i) => <option key={i} value={i}>{i}</option>)}</select></Fld>
                    <Fld label="Currency"><select name="currency" defaultValue="USD" className={addInputCls}>{CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></Fld>
                    <Fld label="Credit Limit"><input name="creditLimit" type="number" min="0" placeholder="0" className={addInputCls} /></Fld>
                    <Fld label="Lead Time (days)"><input name="leadTimeDays" type="number" min="0" placeholder="e.g. 45" className={addInputCls} /></Fld>
                    <Fld label="Min Order Value"><input name="minOrderValue" type="number" min="0" placeholder="0" className={addInputCls} /></Fld>
                    <Fld label="Tax / VAT ID"><input name="taxId" placeholder="Tax / registration #" className={addInputCls} /></Fld>
                    <Fld label="Certifications"><input name="certifications" placeholder="e.g. ISO 9001, CE" className={addInputCls} /></Fld>
                  </div>
                  <Fld label="Remittance / Bank Details"><input name="remittanceInfo" placeholder="Bank, IBAN / SWIFT" className={addInputCls} /></Fld>
                </Sec>
              )}

              {/* VENDOR specifics */}
              {t === 'VENDOR' && (
                <Sec title="Service & Compliance">
                  <div className="grid grid-cols-2 gap-4">
                    <Fld label="Service Type"><select name="service" className={addInputCls}><option value="">—</option>{VENDOR_SERVICE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}</select></Fld>
                    <Fld label="Rate Basis"><select name="rateBasis" className={addInputCls}><option value="">—</option>{VENDOR_RATE_BASIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></Fld>
                    <Fld label="Service Area / Lanes"><input name="serviceArea" placeholder="e.g. Genoa → NJ" className={addInputCls} /></Fld>
                    <Fld label="Currency"><select name="currency" defaultValue="USD" className={addInputCls}>{CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></Fld>
                    <Fld label="Payment Terms"><select name="terms" className={addInputCls}><option value="">—</option>{PAYMENT_TERMS.map((p) => <option key={p} value={p}>{p}</option>)}</select></Fld>
                    <Fld label="Tax ID"><input name="taxId" placeholder="Tax / registration #" className={addInputCls} /></Fld>
                    <Fld label="Insurance Policy"><input name="insurancePolicy" placeholder="Policy # + expiry" className={addInputCls} /></Fld>
                    <Fld label="License # (MC/DOT/FMC)"><input name="licenseNumber" placeholder="Carrier / broker license" className={addInputCls} /></Fld>
                  </div>
                </Sec>
              )}

              {/* CUSTOMER specifics */}
              {t === 'CUSTOMER' && (
                <Sec title="Commercial & Tax">
                  <div className="grid grid-cols-2 gap-4">
                    <Fld label="Payment Terms"><select name="terms" className={addInputCls}><option value="">—</option>{PAYMENT_TERMS.map((p) => <option key={p} value={p}>{p}</option>)}</select></Fld>
                    <Fld label="Currency"><select name="currency" defaultValue="USD" className={addInputCls}>{CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></Fld>
                    <Fld label="Credit Limit"><input name="creditLimit" type="number" min="0" placeholder="0" className={addInputCls} /></Fld>
                    <Fld label="Price Tier"><select name="priceTier" className={addInputCls}><option value="">—</option>{CUSTOMER_PRICE_TIERS.map((p) => <option key={p} value={p}>{p}</option>)}</select></Fld>
                    <Fld label="Tax ID"><input name="taxId" placeholder="Tax / EIN" className={addInputCls} /></Fld>
                    <Fld label="Resale Cert #"><input name="resaleCertNumber" placeholder="If tax-exempt" className={addInputCls} /></Fld>
                    <Fld label="Assigned Rep"><select name="assignedAssociateId" className={addInputCls}><option value="">— Unassigned —</option>{associates.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Fld>
                    <Fld label="Source"><input name="source" placeholder="e.g. Referral, Trade show" className={addInputCls} /></Fld>
                  </div>
                  <label className="flex items-center gap-2 text-[12px] text-[#b8b6b9] mt-1"><input type="checkbox" name="taxExempt" className="accent-[#e3c16c]" /> Tax-exempt customer</label>
                </Sec>
              )}

              {/* ASSOCIATE specifics */}
              {t === 'ASSOCIATE' && (
                <Sec title="Role & Compensation">
                  <div className="grid grid-cols-2 gap-4">
                    <Fld label="Role"><select name="role" className={addInputCls}><option value="">—</option>{ASSOCIATE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select></Fld>
                    <Fld label="Base Location"><input name="location" placeholder="e.g. Maryland Hub" className={addInputCls} /></Fld>
                    <Fld label="Territory"><input name="territory" placeholder="e.g. Mid-Atlantic" className={addInputCls} /></Fld>
                    <Fld label="Employee ID"><input name="employeeId" placeholder="EMP-001" className={addInputCls} /></Fld>
                    <Fld label="Start Date"><input name="startDate" type="date" className={addInputCls} /></Fld>
                    <Fld label="Commission Rate"><input name="commissionRate" placeholder="e.g. 5%" className={addInputCls} /></Fld>
                    <Fld label="Annual Sales Target"><input name="salesTargetAnnual" type="number" min="0" placeholder="0" className={addInputCls} /></Fld>
                  </div>
                </Sec>
              )}

              {/* Login provisioning */}
              {showLogin && (
                <Sec title="Portal Access">
                  <label className="flex items-center gap-2 text-[12px] text-white"><input type="checkbox" checked={provisionLogin} onChange={(e) => setProvisionLogin(e.target.checked)} className="accent-[#e3c16c]" /> Create a portal login for this member</label>
                  {provisionLogin && (
                    <div className="grid grid-cols-2 gap-4 mt-1">
                      <Fld label="Login Email"><input name="loginEmail" type="email" placeholder="defaults to contact email" className={addInputCls} /></Fld>
                      <Fld label="Login Role"><select name="loginRole" defaultValue={t === 'VENDOR' ? 'VENDOR' : 'SALES'} className={addInputCls}>{LOGIN_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select></Fld>
                      <p className="col-span-2 text-[11px] text-[#7d7c7f]">A one-time temporary password will be generated and shown once after saving.</p>
                    </div>
                  )}
                </Sec>
              )}

              {/* Notes */}
              <Sec title="Notes">
                <textarea name="notes" rows={2} placeholder="Internal notes (optional)" className={`${addInputCls} resize-none`} />
              </Sec>

              {actionError && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] px-3 py-2 rounded">{actionError}</div>}
            </div>
            <div className="p-4 border-t border-[#454446] bg-[#1c1c1c] flex items-center justify-end gap-3 shrink-0">
              <button type="button" onClick={closeAdd} className="px-4 py-2 text-[13px] font-medium text-white hover:bg-[#333234] rounded-md transition-colors">Cancel</button>
              <button type="submit" disabled={isPending} className="px-4 py-2 text-[13px] font-medium text-black rounded-md bg-[#e3c16c] hover:bg-[#d2ac55] transition-colors disabled:opacity-60">{isPending ? 'Saving…' : 'Save Record'}</button>
            </div>
          </form>
        </>
        );
      })()}

      {/* One-time temp-password reveal after login provisioning */}
      {tempPassword && (
        <>
          <div className="fixed inset-0 bg-black/70 z-[60]" onClick={() => setTempPassword(null)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] bg-[#1c1c1c] border border-[#454446] rounded-xl shadow-2xl z-[61] p-6">
            <div className="flex items-center gap-2 mb-3"><KeyRound size={18} className="text-[#e3c16c]" /><h3 className="text-[15px] font-medium text-white">Portal login created</h3></div>
            <p className="text-[13px] text-[#b8b6b9] mb-4">Share this one-time temporary password securely. It won&apos;t be shown again.</p>
            <div className="flex items-center justify-between bg-[#2b2a2c] border border-[#454446] rounded-lg px-3 py-2.5 mb-5">
              <code className="text-[15px] text-white font-mono tracking-wide">{tempPassword}</code>
              <button onClick={() => navigator.clipboard?.writeText(tempPassword)} className="text-[#92b0ce] hover:text-white p-1" title="Copy"><Copy size={15} /></button>
            </div>
            <button onClick={() => setTempPassword(null)} className="w-full bg-[#e3c16c] text-black py-2 rounded-md text-[13px] font-medium hover:bg-[#d2ac55] transition-colors">Done</button>
          </div>
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
