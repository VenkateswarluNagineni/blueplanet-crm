'use client';

import React, { useState, useMemo, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2, Truck, Users, UserSquare2, Search, Plus, Mail, Phone, MoreHorizontal, DollarSign,
  TrendingUp, Globe, X, MapPin, FileText, Target, ListFilter, Edit2, KeyRound, Copy,
  LayoutGrid, Columns3, AlertTriangle, Lock,
} from 'lucide-react';
import type { CrmData, CrmCustomer } from '@/server/queries/crm';
import type { CreatePartyInput } from '@/lib/validation/party';
import { createPartyAction, updatePartyAction, softDeletePartyAction } from '@/server/actions/crm';
import {
  COUNTRIES, CURRENCIES, PAYMENT_TERMS, INCOTERMS, PARTY_STATUS, SUPPLIER_SUBTYPES,
  CUSTOMER_SUBTYPES, MATERIAL_CATEGORIES, VENDOR_SERVICE_TYPES, VENDOR_RATE_BASIS,
  CUSTOMER_PRICE_TIERS, ASSOCIATE_ROLES, LOGIN_ROLES,
  TAX_EXEMPT_REASONS, DOC_DELIVERY_METHODS, FULFILLMENT_METHODS,
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

// ---- Customer Catalog: banding helpers + facet/column config ----

const CREDIT_BANDS = ['1 – 500', '501 – 1,000', '1,001 – 2,000', '2,001 – 5,000', '> 5,000', 'Unclassified'] as const;
function creditBand(n: number): string {
  if (!n || n <= 0) return 'Unclassified';
  if (n <= 500) return '1 – 500';
  if (n <= 1000) return '501 – 1,000';
  if (n <= 2000) return '1,001 – 2,000';
  if (n <= 5000) return '2,001 – 5,000';
  return '> 5,000';
}

const SINCE_BANDS = ['0 – 2 Years', '3 – 5 Years', '6 – 10 Years', '> 10 Years', 'Unknown'] as const;
function sinceBand(iso: string | null): string {
  if (!iso) return 'Unknown';
  const years = (Date.now() - new Date(iso).getTime()) / (365.25 * 24 * 3600 * 1000);
  if (years <= 2) return '0 – 2 Years';
  if (years <= 5) return '3 – 5 Years';
  if (years <= 10) return '6 – 10 Years';
  return '> 10 Years';
}

const EXPIRY_BANDS = ['Expired', 'Expires ≤ 30 Days', 'Expires ≤ 60 Days', 'Expires ≤ 90 Days', 'Valid > 90 Days', 'None'] as const;
function expiryBand(iso: string | null): string {
  if (!iso) return 'None';
  const days = (new Date(iso).getTime() - Date.now()) / (24 * 3600 * 1000);
  if (days < 0) return 'Expired';
  if (days <= 30) return 'Expires ≤ 30 Days';
  if (days <= 60) return 'Expires ≤ 60 Days';
  if (days <= 90) return 'Expires ≤ 90 Days';
  return 'Valid > 90 Days';
}

// Standard single-value facets (each customer falls in exactly one bucket).
type CustFacet = { id: string; label: string; valueOf: (c: CrmCustomer) => string; order?: readonly string[] };
const CUST_FACETS: CustFacet[] = [
  { id: 'type', label: 'Type', valueOf: (c) => c.subType || '—' },
  { id: 'price', label: 'Price Level', valueOf: (c) => c.priceTier || '—' },
  { id: 'rep', label: 'Primary Sales Person', valueOf: (c) => c.rep || '—' },
  { id: 'state', label: 'State', valueOf: (c) => c.state || '—' },
  { id: 'country', label: 'Country', valueOf: (c) => c.country || '—' },
  { id: 'status', label: 'Status', valueOf: (c) => c.status || '—' },
  { id: 'credit', label: 'Credit Limit $', valueOf: (c) => creditBand(c.creditLimit), order: CREDIT_BANDS },
  { id: 'since', label: 'Since Years', valueOf: (c) => sinceBand(c.customerSince), order: SINCE_BANDS },
  { id: 'expiry', label: 'Tax Exempt Expiry', valueOf: (c) => expiryBand(c.exemptCertExpiry), order: EXPIRY_BANDS },
  { id: 'parent', label: 'Parent Customer', valueOf: (c) => c.parentCustomerName || '—' },
];

// Accounting boolean flags — a customer can belong to several at once (AND semantics when filtering).
const ACCT_FLAGS: { label: string; test: (c: CrmCustomer) => boolean }[] = [
  { label: 'Multi-Location', test: (c) => c.multiLocation },
  { label: 'Required PO', test: (c) => c.poRequired },
  { label: 'Applied Finance Charges', test: (c) => c.applyFinanceCharges },
  { label: 'Sales Lock', test: (c) => !!c.salesLockNote },
  { label: 'Generic Customer', test: (c) => c.genericCustomer },
  { label: 'Credit-Lock Exempt', test: (c) => c.creditLockExempt },
];

// Customer table columns. Name is always shown; these are the toggleable rest.
type CustColKey =
  | 'type' | 'contact' | 'terms' | 'rep' | 'creditLimit' | 'since' | 'openDeals' | 'ltv'
  | 'dba' | 'parent' | 'state' | 'status' | 'multiLoc' | 'poReq' | 'taxExempt' | 'fulfillment' | 'acctEmail';
const CUST_COLUMNS: { key: CustColKey; label: string; right?: boolean; def: boolean }[] = [
  { key: 'type', label: 'Type', def: true },
  { key: 'contact', label: 'Primary Contact', def: true },
  { key: 'terms', label: 'Terms', def: true },
  { key: 'rep', label: 'Assigned Rep', def: true },
  { key: 'creditLimit', label: 'Credit Limit', right: true, def: true },
  { key: 'since', label: 'Customer Since', def: true },
  { key: 'openDeals', label: 'Open Deals', right: true, def: true },
  { key: 'ltv', label: 'Lifetime Value', right: true, def: true },
  { key: 'dba', label: 'DBA', def: false },
  { key: 'parent', label: 'Parent Customer', def: false },
  { key: 'state', label: 'State', def: false },
  { key: 'status', label: 'Status', def: false },
  { key: 'multiLoc', label: 'Multi-Location', def: false },
  { key: 'poReq', label: 'PO Required', def: false },
  { key: 'taxExempt', label: 'Tax Exempt', def: false },
  { key: 'fulfillment', label: 'Default Fulfillment', def: false },
  { key: 'acctEmail', label: 'Accounting Email', def: false },
];
const CUST_COLS_LS_KEY = 'bp.crm.custCols.v1';

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

  // Customer Catalog: faceted analytics view, multi-facet filters, and column picker.
  const [customerView, setCustomerView] = useState<'LIST' | 'CATALOG'>('LIST');
  const [custFilters, setCustFilters] = useState<Record<string, string[]>>({});
  const [showColPicker, setShowColPicker] = useState(false);
  const [visibleCols, setVisibleCols] = useState<Set<CustColKey>>(
    () => new Set(CUST_COLUMNS.filter((c) => c.def).map((c) => c.key)),
  );
  // Load saved column visibility once on mount (client-only; avoids SSR hydration mismatch).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUST_COLS_LS_KEY);
      if (raw) {
        const keys = JSON.parse(raw) as CustColKey[];
        const valid = keys.filter((k) => CUST_COLUMNS.some((c) => c.key === k));
        if (valid.length) setVisibleCols(new Set(valid));
      }
    } catch { /* ignore corrupt storage */ }
  }, []);
  const toggleCol = (key: CustColKey) =>
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      try { localStorage.setItem(CUST_COLS_LS_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });

  const toggleCustFilter = (facet: string, value: string) =>
    setCustFilters((prev) => {
      const cur = prev[facet] ?? [];
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      return { ...prev, [facet]: next };
    });
  const custFilterCount = Object.values(custFilters).reduce((n, arr) => n + arr.length, 0);

  const activeFiltersCount =
    (activeTab === 'SUPPLIERS' ? selectedOrigins.length + selectedTerms.length : 0) +
    (activeTab === 'VENDORS' ? selectedServices.length : 0) +
    (activeTab === 'ASSOCIATES' ? selectedRoles.length + selectedLocations.length : 0) +
    (activeTab === 'CUSTOMERS' ? custFilterCount : 0);

  const clearAllFilters = () => {
    setSelectedOrigins([]); setSelectedTerms([]); setSelectedServices([]); setSelectedRoles([]); setSelectedLocations([]);
    setCustFilters({});
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
  const custFacetPass = (c: CrmCustomer) =>
    CUST_FACETS.every((f) => {
      const sel = custFilters[f.id];
      return !sel || sel.length === 0 || sel.includes(f.valueOf(c));
    });
  const acctFlagPass = (c: CrmCustomer) =>
    (custFilters['acct'] ?? []).every((label) => ACCT_FLAGS.find((a) => a.label === label)?.test(c) ?? true);
  const filteredCustomers = customers.filter((i) =>
    matchSearch(`${i.name} ${i.systemId} ${i.contact} ${i.email} ${i.subType} ${i.rep} ${i.dba ?? ''} ${i.state ?? ''} ${i.parentCustomerName ?? ''}`) &&
    custFacetPass(i) && acctFlagPass(i));

  // Faceted count cards (computed over ALL customers for a stable catalog overview).
  const customerFacetCards = useMemo(() =>
    CUST_FACETS.map((f) => {
      const counts = new Map<string, number>();
      for (const c of customers) { const v = f.valueOf(c); counts.set(v, (counts.get(v) ?? 0) + 1); }
      let entries = Array.from(counts.entries());
      entries = f.order
        ? entries.sort((a, b) => f.order!.indexOf(a[0]) - f.order!.indexOf(b[0]))
        : entries.sort((a, b) => b[1] - a[1]);
      return { id: f.id, label: f.label, entries };
    }), [customers]);
  const acctFlagCounts = useMemo(() =>
    ACCT_FLAGS.map((a) => ({ label: a.label, count: customers.filter(a.test).length })), [customers]);

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
    const t = viewing.type;
    // Only send fields valid for the member type being edited (no cross-type leakage).
    const updates = {
      contactPerson: u.contact, email: u.email, phone: u.phone,
      ...(t === 'SUPPLIER' ? {
        originCountry: u.origin, paymentTerms: u.terms, incoterms: u.incoterms,
        creditLimit: u.creditLimit !== undefined ? Number(u.creditLimit) || 0 : undefined,
      } : {}),
      ...(t === 'VENDOR' ? { serviceType: u.service } : {}),
      ...(t === 'CUSTOMER' ? {
        paymentTerms: u.terms,
        creditLimit: u.creditLimit !== undefined ? Number(u.creditLimit) || 0 : undefined,
      } : {}),
      ...(t === 'ASSOCIATE' ? {
        role: u.role, baseLocation: u.location, commissionRate: u.commissionRate,
        salesTargetAnnual: u.salesTargetAnnual !== undefined && u.salesTargetAnnual !== '' ? Number(u.salesTargetAnnual) : undefined,
      } : {}),
    };
    setActionError('');
    startTransition(async () => {
      const res = await updatePartyAction(viewing.id, viewing.type, updates);
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
      // Bill-to + ship-to map to structured BILLING / SHIPPING addresses. Shipping can mirror billing.
      const billing = v('bill_line1') && v('bill_city') && v('bill_country')
        ? { kind: 'BILLING' as const, line1: u.bill_line1.trim(), line2: v('bill_line2'),
            city: u.bill_city.trim(), region: v('bill_region'), postalCode: v('bill_postal'),
            county: v('bill_county'), country: u.bill_country as (typeof COUNTRIES)[number] }
        : undefined;
      const copyShip = u.ship_copy === 'on';
      const shipFields = copyShip && billing
        ? { line1: billing.line1, line2: billing.line2, city: billing.city, region: billing.region,
            postalCode: billing.postalCode, county: billing.county, country: billing.country }
        : (v('ship_line1') && v('ship_city') && v('ship_country')
            ? { line1: u.ship_line1.trim(), line2: v('ship_line2'), city: u.ship_city.trim(),
                region: v('ship_region'), postalCode: v('ship_postal'), county: v('ship_county'),
                country: u.ship_country as (typeof COUNTRIES)[number] }
            : undefined);
      const shipping = shipFields ? { kind: 'SHIPPING' as const, ...shipFields } : undefined;
      const custAddresses = [billing, shipping].filter(Boolean) as NonNullable<typeof billing>[];

      input = { type, ...base, addresses: custAddresses.length ? custAddresses : undefined,
        // Identity & classification
        subType: v('subType') as never, dba: v('dba'), referredBy: v('referredBy'),
        parentCustomerId: v('parentCustomerId'),
        multiLocation: u.multiLocation === 'on', genericCustomer: u.genericCustomer === 'on',
        // Extra contact channels
        secondaryPhone: v('secondaryPhone'), mobilePhone: v('mobilePhone'), fax: v('fax'),
        accountingEmail: v('accountingEmail'),
        // Sales & pricing
        currency: (v('currency') ?? 'USD') as never, paymentTerms: v('terms') as never,
        creditLimit: num('creditLimit'), priceTier: v('priceTier') as never,
        defaultFulfillment: v('defaultFulfillment') as never, source: v('source'),
        assignedAssociateId: v('assignedAssociateId'), customerSince: v('customerSince'),
        // Tax & compliance
        taxId: v('taxId'), taxExempt: u.taxExempt === 'on', taxExemptReason: v('taxExemptReason') as never,
        salesTaxCode: v('salesTaxCode'), resaleCertNumber: v('resaleCertNumber'), exemptCertExpiry: v('exemptCertExpiry'),
        // Accounting controls
        poRequired: u.poRequired === 'on', applyFinanceCharges: u.applyFinanceCharges === 'on',
        docDeliveryPref: v('docDeliveryPref') as never, gracePeriodDays: num('gracePeriodDays'), holdDays: num('holdDays'),
        // Credit controls
        creditLockExempt: u.creditLockExempt === 'on', salesAlertNote: v('salesAlertNote'), salesLockNote: v('salesLockNote'),
        // Notes & instructions
        deliveryInstructions: v('deliveryInstructions'), collectionNotes: v('collectionNotes'),
        copyNotesToOrders: u.copyNotesToOrders === 'on' };
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
          {canManage && type !== 'CUSTOMER' && <button className="w-full text-left px-4 py-2 text-[13px] text-white hover:bg-[#333234]" onClick={() => { setOpenMenuId(null); setViewing({ id, type }); setDrawerTab('ACTIVE'); setIsEditingProfile(true); }}>Edit Details</button>}
          {canManage && <><div className="h-px bg-[#454446] my-1" /><button className="w-full text-left px-4 py-2 text-[13px] text-red-400 hover:bg-[#333234]" onClick={() => doDelete(id)}>Delete Entity</button></>}
        </div>
      )}
    </td>
  );

  // Render a single customer table cell's inner content for a given column key.
  const yesNo = (b: boolean) => b
    ? <span className="bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20 px-1.5 py-0.5 rounded text-[10px] font-medium">Yes</span>
    : <span className="text-[#7d7c7f]">—</span>;
  const custCell = (key: CustColKey, item: CrmCustomer): React.ReactNode => {
    switch (key) {
      case 'type': return <span className="bg-[#333234] border border-[#454446] text-[#b8b6b9] px-2 py-0.5 rounded text-[11px]">{item.subType}</span>;
      case 'contact': return <span className="text-white">{item.contact}</span>;
      case 'terms': return <span className="bg-[#454446] text-white px-2 py-0.5 rounded text-[11px]">{item.terms}</span>;
      case 'rep': return <span className="text-[#b8b6b9]">{item.rep}</span>;
      case 'creditLimit': return <span className="text-white font-medium">${item.creditLimit.toLocaleString()}</span>;
      case 'since': return <span className="text-[#b8b6b9]">{item.customerSince ?? '—'}</span>;
      case 'openDeals': return <span className="text-white font-medium">{item.openDeals}</span>;
      case 'ltv': return <span className="text-white font-medium">${item.lifetimeValue.toLocaleString()}</span>;
      case 'dba': return <span className="text-[#b8b6b9]">{item.dba ?? '—'}</span>;
      case 'parent': return <span className="text-[#b8b6b9]">{item.parentCustomerName ?? '—'}</span>;
      case 'state': return <span className="text-[#b8b6b9]">{item.state ?? '—'}</span>;
      case 'status': return <span className="bg-[#333234] border border-[#454446] text-[#b8b6b9] px-2 py-0.5 rounded text-[11px]">{item.status}</span>;
      case 'multiLoc': return yesNo(item.multiLocation);
      case 'poReq': return yesNo(item.poRequired);
      case 'taxExempt': return yesNo(item.taxExempt);
      case 'fulfillment': return <span className="text-[#b8b6b9]">{item.defaultFulfillment ?? '—'}</span>;
      case 'acctEmail': return <span className="text-[#92b0ce]">{item.accountingEmail ?? '—'}</span>;
      default: return null;
    }
  };
  const visibleCustCols = CUST_COLUMNS.filter((c) => visibleCols.has(c.key));

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
          {activeTab === 'CUSTOMERS' && (
            <>
              <button onClick={() => setCustomerView(customerView === 'CATALOG' ? 'LIST' : 'CATALOG')} className={`flex items-center gap-2 px-2 py-1 rounded transition-colors text-[13px] ${customerView === 'CATALOG' ? 'bg-[#333234] text-white' : 'hover:bg-[#333234] text-[#b8b6b9]'}`}>
                <LayoutGrid size={14} /> Catalog
              </button>
              <div className="relative">
                <button onClick={() => setShowColPicker(!showColPicker)} className={`flex items-center gap-2 px-2 py-1 rounded transition-colors text-[13px] ${showColPicker ? 'bg-[#333234] text-white' : 'hover:bg-[#333234] text-[#b8b6b9]'}`}>
                  <Columns3 size={14} /> Columns
                </button>
                {showColPicker && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowColPicker(false)} />
                    <div className="absolute left-0 top-9 w-56 max-h-[60vh] overflow-y-auto bg-[#1c1c1c] border border-[#454446] rounded-md shadow-xl z-50 py-2">
                      <p className="px-3 pb-1.5 text-[10px] uppercase tracking-wider text-[#7d7c7f]">Visible columns</p>
                      {CUST_COLUMNS.map((c) => (
                        <label key={c.key} className="flex items-center gap-2 px-3 py-1.5 text-[12px] text-white hover:bg-[#333234] cursor-pointer">
                          <input type="checkbox" checked={visibleCols.has(c.key)} onChange={() => toggleCol(c.key)} className="accent-[#e3c16c]" />
                          {c.label}
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
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
          {activeTab === 'CUSTOMERS' && (
            <div className="flex items-center gap-3 flex-wrap">
              {customerFacetCards.filter((f) => ['type', 'price', 'rep', 'state', 'status'].includes(f.id)).map((f) => (
                <select key={f.id} value="" onChange={(e) => { if (e.target.value) toggleCustFilter(f.id, e.target.value); }} className="bg-[#333234] border border-[#454446] text-white rounded px-2 py-1 outline-none focus:border-[#92b0ce]">
                  <option value="">+ {f.label}</option>
                  {f.entries.filter(([val]) => !(custFilters[f.id] ?? []).includes(val)).map(([val, n]) => <option key={val} value={val}>{val} ({n})</option>)}
                </select>
              ))}
            </div>
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
          {activeTab === 'CUSTOMERS' && Object.entries(custFilters).flatMap(([facet, vals]) =>
            vals.map((v) => {
              const label = facet === 'acct' ? 'Flag' : CUST_FACETS.find((f) => f.id === facet)?.label ?? facet;
              return <Pill key={`${facet}:${v}`} label={`${label}: ${v}`} onRemove={() => toggleCustFilter(facet, v)} />;
            }))}
        </div>
      )}

      {actionError && <div className="mx-6 mt-3 bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] px-3 py-2 rounded">{actionError}</div>}

      {/* Customer Catalog — faceted count cards (click a value to filter the table) */}
      {activeTab === 'CUSTOMERS' && customerView === 'CATALOG' && (
        <div className="px-6 py-4 bg-[#1c1c1c] border-b border-[#454446] shrink-0 max-h-[42vh] overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {customerFacetCards.map((f) => (
              <FacetCard key={f.id} title={f.label}>
                {f.entries.map(([val, n]) => {
                  const active = (custFilters[f.id] ?? []).includes(val);
                  return (
                    <button key={val} onClick={() => toggleCustFilter(f.id, val)} className={`w-full flex items-center justify-between px-2 py-1 rounded text-[12px] transition-colors ${active ? 'bg-[#e3c16c]/15 text-[#e3c16c]' : 'text-[#d9d8d9] hover:bg-[#333234]'}`}>
                      <span className="truncate mr-2">{val}</span>
                      <span className={`tabular-nums ${active ? 'text-[#e3c16c]' : 'text-[#b8b6b9]'}`}>{n}</span>
                    </button>
                  );
                })}
              </FacetCard>
            ))}
            <FacetCard title="Accounting">
              {acctFlagCounts.map(({ label, count }) => {
                const active = (custFilters['acct'] ?? []).includes(label);
                return (
                  <button key={label} onClick={() => toggleCustFilter('acct', label)} className={`w-full flex items-center justify-between px-2 py-1 rounded text-[12px] transition-colors ${active ? 'bg-[#e3c16c]/15 text-[#e3c16c]' : 'text-[#d9d8d9] hover:bg-[#333234]'}`}>
                    <span className="truncate mr-2">{label}</span>
                    <span className={`tabular-nums ${active ? 'text-[#e3c16c]' : 'text-[#b8b6b9]'}`}>{count}</span>
                  </button>
                );
              })}
            </FacetCard>
          </div>
        </div>
      )}

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
                <Th>Customer Name</Th>
                {visibleCustCols.map((c) => <Th key={c.key} right={c.right}>{c.label}</Th>)}
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
            {activeTab === 'CUSTOMERS' && (filteredCustomers.length === 0 ? <EmptyRow cols={visibleCustCols.length + 2} /> : filteredCustomers.map((item) => (
              <tr key={item.id} className="hover:bg-[#333234] transition-colors group">
                <td className="px-6 py-3" />
                <td className="px-4 py-3 font-medium text-white">
                  <button className="hover:underline hover:text-[#e8956b]" onClick={() => { setViewing({ id: item.id, type: 'CUSTOMER' }); setDrawerTab('ACTIVE'); setIsEditingProfile(false); }}>{item.name}</button>
                  {item.salesLockNote && <Lock size={11} className="inline ml-1.5 text-red-400" aria-label="Sales lock" />}
                </td>
                {visibleCustCols.map((c) => <td key={c.key} className={`px-4 py-3 ${c.right ? 'text-right' : ''}`}>{custCell(c.key, item)}</td>)}
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
                {canManage && !isEditingProfile && viewing.type !== 'CUSTOMER' && <button onClick={() => setIsEditingProfile(true)} className="flex items-center gap-2 bg-[#333234] text-[#92b0ce] hover:text-white px-3 py-1.5 rounded text-[13px] font-medium border border-[#454446] hover:border-[#92b0ce] transition-colors"><Edit2 size={14} /> Edit Profile</button>}
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
                {viewingCustomer && (() => {
                  const c = viewingCustomer;
                  const val = (s: string | null | undefined) => (s && s !== '—' ? s : '—');
                  const fmtAddr = (a: typeof c.billingAddress) => {
                    if (!a) return '—';
                    const l2 = a.line2 ? `, ${a.line2}` : '';
                    const cty = a.county ? ` · ${a.county}` : '';
                    return `${a.line1}${l2}, ${a.city}, ${val(a.region)} ${val(a.postalCode)}${cty}, ${a.country}`;
                  };
                  return (
                  <div className="space-y-5">
                    {(c.salesAlertNote || c.salesLockNote) && (
                      <div className="space-y-2">
                        {c.salesLockNote && <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 text-red-300 text-[12px] px-3 py-2 rounded"><Lock size={14} className="mt-0.5 shrink-0" /><span><strong className="text-red-200">Sales Lock:</strong> {c.salesLockNote}</span></div>}
                        {c.salesAlertNote && <div className="flex items-start gap-2 bg-[#e3c16c]/10 border border-[#e3c16c]/30 text-[#e3c16c] text-[12px] px-3 py-2 rounded"><AlertTriangle size={14} className="mt-0.5 shrink-0" /><span><strong>Sales Alert:</strong> {c.salesAlertNote}</span></div>}
                      </div>
                    )}
                    <DrawerSection title="Identity & Classification">
                      <Field label="Customer ID"><span className="text-[13px] text-white font-mono">{c.systemId}</span></Field>
                      <Field label="Type"><span className="text-[13px] text-white">{val(c.subType)}</span></Field>
                      <Field label="Status"><span className="text-[13px] text-white">{c.status}</span></Field>
                      <Field label="Print Name / DBA"><span className="text-[13px] text-white">{val(c.dba)}</span></Field>
                      <Field label="Referred By"><span className="text-[13px] text-white">{val(c.referredBy)}</span></Field>
                      <Field label="Parent Customer"><span className="text-[13px] text-white">{val(c.parentCustomerName)}</span></Field>
                      <Field label="Multi-Location"><span className="text-[13px] text-white">{c.multiLocation ? 'Yes' : 'No'}</span></Field>
                      <Field label="Generic Customer"><span className="text-[13px] text-white">{c.genericCustomer ? 'Yes' : 'No'}</span></Field>
                    </DrawerSection>
                    <DrawerSection title="Contact Channels">
                      <Field label="Primary Phone"><span className="text-[13px] text-white">{val(c.phone)}</span></Field>
                      <Field label="Secondary Phone"><span className="text-[13px] text-white">{val(c.secondaryPhone)}</span></Field>
                      <Field label="Mobile"><span className="text-[13px] text-white">{val(c.mobilePhone)}</span></Field>
                      <Field label="Fax"><span className="text-[13px] text-white">{val(c.fax)}</span></Field>
                      <Field label="Email"><span className="text-[13px] text-[#92b0ce]">{val(c.email)}</span></Field>
                      <Field label="Accounting Email"><span className="text-[13px] text-[#92b0ce]">{val(c.accountingEmail)}</span></Field>
                      <Field label="Website"><span className="text-[13px] text-white">{val(c.website)}</span></Field>
                    </DrawerSection>
                    <DrawerSection title="Addresses" cols={1}>
                      <Field label="Bill-To"><span className="text-[13px] text-white">{fmtAddr(c.billingAddress)}</span></Field>
                      <Field label="Ship-To"><span className="text-[13px] text-white">{fmtAddr(c.shippingAddress)}</span></Field>
                    </DrawerSection>
                    <DrawerSection title="Sales & Pricing">
                      <Field label="Assigned Rep"><span className="text-[13px] text-white">{val(c.rep)}</span></Field>
                      <Field label="Price Tier"><span className="text-[13px] text-[#e3c16c]">{val(c.priceTier)}</span></Field>
                      <Field label="Payment Terms"><span className="text-[13px] text-white">{val(c.terms)}</span></Field>
                      <Field label="Currency"><span className="text-[13px] text-white">{c.currency}</span></Field>
                      <Field label="Default Fulfillment"><span className="text-[13px] text-white">{val(c.defaultFulfillment)}</span></Field>
                      <Field label="Source"><span className="text-[13px] text-white">{val(c.source)}</span></Field>
                      <Field label="Customer Since"><span className="text-[13px] text-white">{val(c.customerSince)}</span></Field>
                      <Field label="Open Deals"><span className="text-[13px] text-white">{c.openDeals}</span></Field>
                      <Field label="Lifetime Value"><span className="text-[13px] text-[#10b981]">${c.lifetimeValue.toLocaleString()}</span></Field>
                    </DrawerSection>
                    <DrawerSection title="Tax & Compliance">
                      <Field label="Tax ID / EIN"><span className="text-[13px] text-white">{val(c.taxId)}</span></Field>
                      <Field label="Tax Exempt"><span className="text-[13px] text-white">{c.taxExempt ? 'Yes' : 'No'}</span></Field>
                      <Field label="Exempt Reason"><span className="text-[13px] text-white">{val(c.taxExemptReason)}</span></Field>
                      <Field label="Sales Tax Code"><span className="text-[13px] text-white">{val(c.salesTaxCode)}</span></Field>
                      <Field label="Exempt Cert #"><span className="text-[13px] text-white">{val(c.resaleCertNumber)}</span></Field>
                      <Field label="Exempt Expiry"><span className="text-[13px] text-white">{val(c.exemptCertExpiry)}</span></Field>
                    </DrawerSection>
                    <DrawerSection title="Accounting Controls">
                      <Field label="PO Required"><span className="text-[13px] text-white">{c.poRequired ? 'Yes' : 'No'}</span></Field>
                      <Field label="Finance Charges"><span className="text-[13px] text-white">{c.applyFinanceCharges ? 'Yes' : 'No'}</span></Field>
                      <Field label="Doc Delivery"><span className="text-[13px] text-white">{val(c.docDeliveryPref)}</span></Field>
                      <Field label="Grace Period"><span className="text-[13px] text-white">{c.gracePeriodDays != null ? `${c.gracePeriodDays} days` : '—'}</span></Field>
                      <Field label="Hold Days"><span className="text-[13px] text-white">{c.holdDays != null ? `${c.holdDays} days` : '—'}</span></Field>
                    </DrawerSection>
                    <DrawerSection title="Credit Controls">
                      <Field label="Credit Limit"><span className="text-[13px] text-white">{c.creditLimit > 0 ? `$${c.creditLimit.toLocaleString()}` : '—'}</span></Field>
                      <Field label="Credit-Lock Exempt"><span className="text-[13px] text-white">{c.creditLockExempt ? 'Yes' : 'No'}</span></Field>
                    </DrawerSection>
                    {(c.deliveryInstructions || c.collectionNotes || c.notes) && (
                      <DrawerSection title="Notes & Instructions" cols={1}>
                        {c.deliveryInstructions && <Field label="Delivery Instructions"><span className="text-[13px] text-white">{c.deliveryInstructions}</span></Field>}
                        {c.collectionNotes && <Field label="Collection Notes"><span className="text-[13px] text-white">{c.collectionNotes}</span></Field>}
                        {c.notes && <Field label="Internal Notes"><span className="text-[13px] text-white">{c.notes}</span></Field>}
                        {c.copyNotesToOrders && <p className="text-[11px] text-[#7d7c7f]">Notes are copied to all orders.</p>}
                      </DrawerSection>
                    )}
                  </div>
                  );
                })()}
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
              {/* Shared identity/contact/address — customers use their own richer sections below */}
              {t !== 'CUSTOMER' && (<>
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
              <Sec title="Address">
                <Fld label="Street Address"><input name="addr_line1" placeholder="Street, building" className={addInputCls} /></Fld>
                <Fld label="Address Line 2"><input name="addr_line2" placeholder="Suite, unit (optional)" className={addInputCls} /></Fld>
                <div className="grid grid-cols-2 gap-4">
                  <Fld label="City"><input name="addr_city" placeholder="City" className={addInputCls} /></Fld>
                  <Fld label="State / Region"><input name="addr_region" placeholder="State / province" className={addInputCls} /></Fld>
                  <Fld label="Postal Code"><input name="addr_postal" placeholder="ZIP / postal" className={addInputCls} /></Fld>
                  <Fld label="Country"><select name="addr_country" className={addInputCls}><option value="">— Select —</option>{COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></Fld>
                </div>
              </Sec>
              </>)}

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

              {/* CUSTOMER — comprehensive, sectioned enrollment */}
              {t === 'CUSTOMER' && (<>
                {/* 1 — Identity & Classification */}
                <Sec title="Identity & Classification">
                  <Fld label="Customer Name" req>
                    <input name="name" required placeholder="e.g. Premier Stone Works" className={addInputCls} />
                  </Fld>
                  <div className="grid grid-cols-2 gap-4">
                    <Fld label="Customer Type"><select name="subType" className={addInputCls}><option value="">—</option>{CUSTOMER_SUBTYPES.map((s) => <option key={s} value={s}>{s}</option>)}</select></Fld>
                    <Fld label="Contact Name"><input name="contact" placeholder="e.g. Sarah Jenkins" className={addInputCls} /></Fld>
                    <Fld label="Print Name / DBA"><input name="dba" placeholder="Doing-business-as name" className={addInputCls} /></Fld>
                    <Fld label="Referred By"><input name="referredBy" placeholder="Referral source / partner" className={addInputCls} /></Fld>
                    <Fld label="Parent Customer"><select name="parentCustomerId" className={addInputCls}><option value="">— None (top-level) —</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Fld>
                    <Fld label="Status"><select name="status" defaultValue="ACTIVE" className={addInputCls}>{PARTY_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}</select></Fld>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
                    <label className="flex items-center gap-2 text-[12px] text-[#b8b6b9]"><input type="checkbox" name="multiLocation" className="accent-[#e3c16c]" /> Multi-location customer</label>
                    <label className="flex items-center gap-2 text-[12px] text-[#b8b6b9]"><input type="checkbox" name="genericCustomer" className="accent-[#e3c16c]" /> Generic / walk-in customer</label>
                  </div>
                  <p className="text-[11px] text-[#7d7c7f]">A Customer ID (C-###) is assigned automatically on save.</p>
                </Sec>

                {/* 2 — Contact Information */}
                <Sec title="Contact Information">
                  <div className="grid grid-cols-2 gap-4">
                    <Fld label="Primary Phone"><input name="phone" placeholder="+1 (555) 000-0000" className={addInputCls} /></Fld>
                    <Fld label="Secondary Phone"><input name="secondaryPhone" placeholder="+1 (555) 000-0000" className={addInputCls} /></Fld>
                    <Fld label="Mobile"><input name="mobilePhone" placeholder="+1 (555) 000-0000" className={addInputCls} /></Fld>
                    <Fld label="Fax"><input name="fax" placeholder="Fax number" className={addInputCls} /></Fld>
                    <Fld label="Email"><input name="email" type="email" placeholder="email@example.com" className={addInputCls} /></Fld>
                    <Fld label="Accounting Email"><input name="accountingEmail" type="email" placeholder="ap@example.com" className={addInputCls} /></Fld>
                    <Fld label="Website"><input name="website" placeholder="https://example.com" className={addInputCls} /></Fld>
                  </div>
                  <p className="text-[11px] text-[#7d7c7f]">Provide at least one way to reach this customer (email or phone).</p>
                </Sec>

                {/* 3 — Bill-To Address */}
                <Sec title="Bill-To Address">
                  <Fld label="Street Address"><input name="bill_line1" placeholder="Street, building" className={addInputCls} /></Fld>
                  <Fld label="Address Line 2"><input name="bill_line2" placeholder="Suite, unit (optional)" className={addInputCls} /></Fld>
                  <div className="grid grid-cols-2 gap-4">
                    <Fld label="City"><input name="bill_city" placeholder="City" className={addInputCls} /></Fld>
                    <Fld label="State / Region"><input name="bill_region" placeholder="State / province" className={addInputCls} /></Fld>
                    <Fld label="ZIP / Postal"><input name="bill_postal" placeholder="ZIP / postal" className={addInputCls} /></Fld>
                    <Fld label="County"><input name="bill_county" placeholder="County" className={addInputCls} /></Fld>
                    <Fld label="Country"><select name="bill_country" defaultValue="United States" className={addInputCls}><option value="">— Select —</option>{COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></Fld>
                  </div>
                </Sec>

                {/* 4 — Shipping Address */}
                <Sec title="Shipping Address">
                  <label className="flex items-center gap-2 text-[12px] text-[#b8b6b9]"><input type="checkbox" name="ship_copy" className="accent-[#e3c16c]" /> Same as bill-to address</label>
                  <Fld label="Street Address"><input name="ship_line1" placeholder="Street, building" className={addInputCls} /></Fld>
                  <Fld label="Address Line 2"><input name="ship_line2" placeholder="Suite, unit (optional)" className={addInputCls} /></Fld>
                  <div className="grid grid-cols-2 gap-4">
                    <Fld label="City"><input name="ship_city" placeholder="City" className={addInputCls} /></Fld>
                    <Fld label="State / Region"><input name="ship_region" placeholder="State / province" className={addInputCls} /></Fld>
                    <Fld label="ZIP / Postal"><input name="ship_postal" placeholder="ZIP / postal" className={addInputCls} /></Fld>
                    <Fld label="County"><input name="ship_county" placeholder="County" className={addInputCls} /></Fld>
                    <Fld label="Country"><select name="ship_country" defaultValue="United States" className={addInputCls}><option value="">— Select —</option>{COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></Fld>
                  </div>
                </Sec>

                {/* 5 — Sales & Pricing */}
                <Sec title="Sales & Pricing">
                  <div className="grid grid-cols-2 gap-4">
                    <Fld label="Assigned Rep"><select name="assignedAssociateId" className={addInputCls}><option value="">— Unassigned —</option>{associates.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Fld>
                    <Fld label="Price Tier"><select name="priceTier" className={addInputCls}><option value="">—</option>{CUSTOMER_PRICE_TIERS.map((p) => <option key={p} value={p}>{p}</option>)}</select></Fld>
                    <Fld label="Payment Terms"><select name="terms" className={addInputCls}><option value="">—</option>{PAYMENT_TERMS.map((p) => <option key={p} value={p}>{p}</option>)}</select></Fld>
                    <Fld label="Currency"><select name="currency" defaultValue="USD" className={addInputCls}>{CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></Fld>
                    <Fld label="Default Fulfillment"><select name="defaultFulfillment" className={addInputCls}><option value="">—</option>{FULFILLMENT_METHODS.map((f) => <option key={f} value={f}>{f}</option>)}</select></Fld>
                    <Fld label="How did you hear?"><input name="source" placeholder="e.g. Referral, Trade show" className={addInputCls} /></Fld>
                  </div>
                </Sec>

                {/* 6 — Tax & Compliance */}
                <Sec title="Tax & Compliance">
                  <div className="grid grid-cols-2 gap-4">
                    <Fld label="Tax ID / EIN"><input name="taxId" placeholder="Tax / EIN" className={addInputCls} /></Fld>
                    <Fld label="Sales Tax Code"><input name="salesTaxCode" placeholder="Tax jurisdiction code" className={addInputCls} /></Fld>
                    <Fld label="Exempt Reason"><select name="taxExemptReason" className={addInputCls}><option value="">—</option>{TAX_EXEMPT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}</select></Fld>
                    <Fld label="Exempt Certificate #"><input name="resaleCertNumber" placeholder="If tax-exempt" className={addInputCls} /></Fld>
                    <Fld label="Exempt Expiry"><input name="exemptCertExpiry" type="date" className={addInputCls} /></Fld>
                  </div>
                  <label className="flex items-center gap-2 text-[12px] text-[#b8b6b9] pt-1"><input type="checkbox" name="taxExempt" className="accent-[#e3c16c]" /> Tax-exempt customer</label>
                </Sec>

                {/* 7 — Accounting Controls */}
                <Sec title="Accounting Controls">
                  <div className="grid grid-cols-2 gap-4">
                    <Fld label="Document Delivery"><select name="docDeliveryPref" className={addInputCls}><option value="">—</option>{DOC_DELIVERY_METHODS.map((d) => <option key={d} value={d}>{d}</option>)}</select></Fld>
                    <Fld label="Customer Since"><input name="customerSince" type="date" className={addInputCls} /></Fld>
                    <Fld label="Grace Period (days)"><input name="gracePeriodDays" type="number" min="0" max="365" placeholder="e.g. 5" className={addInputCls} /></Fld>
                    <Fld label="Hold (days)"><input name="holdDays" type="number" min="0" max="365" placeholder="e.g. 30" className={addInputCls} /></Fld>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
                    <label className="flex items-center gap-2 text-[12px] text-[#b8b6b9]"><input type="checkbox" name="poRequired" className="accent-[#e3c16c]" /> Purchase order required</label>
                    <label className="flex items-center gap-2 text-[12px] text-[#b8b6b9]"><input type="checkbox" name="applyFinanceCharges" className="accent-[#e3c16c]" /> Apply finance charges</label>
                  </div>
                </Sec>

                {/* 8 — Credit Controls */}
                <Sec title="Credit Controls">
                  <div className="grid grid-cols-2 gap-4">
                    <Fld label="Credit Limit"><input name="creditLimit" type="number" min="0" placeholder="0" className={addInputCls} /></Fld>
                  </div>
                  <label className="flex items-center gap-2 text-[12px] text-[#b8b6b9]"><input type="checkbox" name="creditLockExempt" className="accent-[#e3c16c]" /> Exempt from credit lock</label>
                  <Fld label="Sales Alert Note"><textarea name="salesAlertNote" rows={2} placeholder="Shown to sales when quoting (optional)" className={`${addInputCls} resize-none`} /></Fld>
                  <Fld label="Sales Lock Note"><textarea name="salesLockNote" rows={2} placeholder="Reason orders are blocked (optional)" className={`${addInputCls} resize-none`} /></Fld>
                </Sec>

                {/* 9 — Notes & Instructions */}
                <Sec title="Notes & Instructions">
                  <Fld label="Delivery Instructions"><textarea name="deliveryInstructions" rows={2} placeholder="Site access, hours, equipment (optional)" className={`${addInputCls} resize-none`} /></Fld>
                  <Fld label="Collection Notes"><textarea name="collectionNotes" rows={2} placeholder="AR / collections context (optional)" className={`${addInputCls} resize-none`} /></Fld>
                  <Fld label="Internal Notes"><textarea name="notes" rows={2} placeholder="Internal notes (optional)" className={`${addInputCls} resize-none`} /></Fld>
                  <label className="flex items-center gap-2 text-[12px] text-[#b8b6b9]"><input type="checkbox" name="copyNotesToOrders" className="accent-[#e3c16c]" /> Copy notes to all orders</label>
                </Sec>
              </>)}

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

              {/* Notes — customers capture notes in their own Notes & Instructions section */}
              {t !== 'CUSTOMER' && (
              <Sec title="Notes">
                <textarea name="notes" rows={2} placeholder="Internal notes (optional)" className={`${addInputCls} resize-none`} />
              </Sec>
              )}

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

// A faceted count card for the Customer Catalog: a titled, scrollable list of clickable value rows.
function FacetCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#2b2a2c] border border-[#454446] rounded-lg overflow-hidden flex flex-col">
      <div className="px-3 py-2 bg-[#333234]/40 border-b border-[#454446]"><h4 className="text-[12px] font-medium text-[#92b0ce]">{title}</h4></div>
      <div className="p-1.5 space-y-0.5 max-h-44 overflow-y-auto">{children}</div>
    </div>
  );
}

// A titled detail section for the customer drill-down drawer; lays its fields out in a grid.
function DrawerSection({ title, children, cols = 3 }: { title: string; children: React.ReactNode; cols?: number }) {
  return (
    <div>
      <h3 className="text-[11px] uppercase tracking-wider text-[#b8b6b9] font-medium border-b border-[#454446] pb-1.5 mb-3">{title}</h3>
      <div className={`grid gap-x-6 gap-y-3 ${cols === 1 ? 'grid-cols-1' : 'grid-cols-3'}`}>{children}</div>
    </div>
  );
}
