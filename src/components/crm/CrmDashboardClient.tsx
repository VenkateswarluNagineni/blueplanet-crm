'use client';

import React, { useState, useMemo, useTransition, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Building2, Truck, Users, UserSquare2, Search, Plus, Mail, Phone, MoreHorizontal, DollarSign,
  TrendingUp, Globe, X, MapPin, FileText, Target, ListFilter, Edit2, KeyRound, Copy, Briefcase,
  LayoutGrid, Columns3, AlertTriangle, Lock,
} from 'lucide-react';
import type { CrmData, CrmCustomer } from '@/server/crm/queries';
import { FacetCard } from '@/components/ui/FacetCard';
import { Badge, StatusPill } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { ArrowUpDown } from 'lucide-react';
import type { CreatePartyInput } from '@/lib/domain/party-validation';
import { createPartyAction, updatePartyAction, softDeletePartyAction } from '@/server/crm/actions';
import {
  COUNTRIES, CURRENCIES, PAYMENT_TERMS, INCOTERMS, PARTY_STATUS, SUPPLIER_SUBTYPES,
  CUSTOMER_SUBTYPES, MATERIAL_CATEGORIES, VENDOR_SERVICE_TYPES, VENDOR_RATE_BASIS,
  CUSTOMER_PRICE_TIERS, ASSOCIATE_ROLES, LOGIN_ROLES,
  TAX_EXEMPT_REASONS, DOC_DELIVERY_METHODS, FULFILLMENT_METHODS,
} from '@/lib/domain/reference';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';

type TabType = 'SUPPLIERS' | 'VENDORS' | 'CUSTOMERS' | 'ASSOCIATES';
type EntityType = 'SUPPLIER' | 'VENDOR' | 'CUSTOMER' | 'ASSOCIATE';

const TAB_TO_TYPE: Record<TabType, EntityType> = {
  SUPPLIERS: 'SUPPLIER', VENDORS: 'VENDOR', CUSTOMERS: 'CUSTOMER', ASSOCIATES: 'ASSOCIATE',
};
const TYPE_LABEL: Record<EntityType, string> = {
  SUPPLIER: 'Supplier', VENDOR: 'Vendor', CUSTOMER: 'Customer', ASSOCIATE: 'Associate',
};

const EMPTY =
  'text-center py-12 text-[var(--color-text-secondary)] bp-panel border-dashed rounded-[var(--radius-md)]';

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
  const searchParams = useSearchParams();
  const toast = useToast();
  const { confirm, confirmDialog } = useConfirm();
  const [isPending, startTransition] = useTransition();
  // Customer table sorting
  const [custSort, setCustSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' });
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

  // Deep-link: /crm?party=<id> opens the matching party drawer and switches tab.
  useEffect(() => {
    const partyId = searchParams.get('party');
    if (!partyId) return;
    const match =
      (customers.find((c) => c.id === partyId) && ({ id: partyId, type: 'CUSTOMER' as EntityType, tab: 'CUSTOMERS' as TabType })) ||
      (suppliers.find((s) => s.id === partyId) && ({ id: partyId, type: 'SUPPLIER' as EntityType, tab: 'SUPPLIERS' as TabType })) ||
      (vendors.find((v) => v.id === partyId) && ({ id: partyId, type: 'VENDOR' as EntityType, tab: 'VENDORS' as TabType })) ||
      (associates.find((a) => a.id === partyId) && ({ id: partyId, type: 'ASSOCIATE' as EntityType, tab: 'ASSOCIATES' as TabType })) ||
      null;
    if (!match) return;
    const t = setTimeout(() => {
      setActiveTab(match.tab);
      setViewing({ id: match.id, type: match.type });
      setDrawerTab('ACTIVE');
      setIsEditingProfile(false);
    }, 0);
    return () => clearTimeout(t);
  }, [searchParams, customers, suppliers, vendors, associates]);

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
  const [visibleCols, setVisibleCols] = useState<Set<CustColKey>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(CUST_COLS_LS_KEY);
        if (raw) {
          const keys = JSON.parse(raw) as CustColKey[];
          const valid = keys.filter((k) => CUST_COLUMNS.some((c) => c.key === k));
          if (valid.length) return new Set(valid);
        }
      } catch { /* ignore */ }
    }
    return new Set(CUST_COLUMNS.filter((c) => c.def).map((c) => c.key));
  });
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

  // Customer table sorting
  const custSortVal = (c: CrmCustomer, key: string): string | number => {
    switch (key) {
      case 'type': return c.subType; case 'contact': return c.contact; case 'terms': return c.terms;
      case 'rep': return c.rep; case 'creditLimit': return c.creditLimit; case 'since': return c.customerSince ?? '';
      case 'openDeals': return c.openDeals; case 'ltv': return c.lifetimeValue; case 'dba': return c.dba ?? '';
      case 'parent': return c.parentCustomerName ?? ''; case 'state': return c.state ?? ''; case 'status': return c.status;
      case 'multiLoc': return c.multiLocation ? 1 : 0; case 'poReq': return c.poRequired ? 1 : 0;
      case 'taxExempt': return c.taxExempt ? 1 : 0; case 'fulfillment': return c.defaultFulfillment ?? '';
      case 'acctEmail': return c.accountingEmail ?? ''; default: return c.name;
    }
  };
  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    const dir = custSort.dir === 'asc' ? 1 : -1;
    const av = custSortVal(a, custSort.key), bv = custSortVal(b, custSort.key);
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  });
  const toggleCustSort = (key: string) =>
    setCustSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

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

  const doDelete = async (id: string) => {
    setOpenMenuId(null);
    const okToDelete = await confirm({
      title: 'Archive this record?',
      message: 'It will be soft-deleted and hidden from active lists.',
      confirmLabel: 'Archive', tone: 'danger',
    });
    if (!okToDelete) return;
    setActionError('');
    startTransition(async () => {
      const res = await softDeletePartyAction(id);
      if (!res.ok) { toast(res.error, 'error'); setActionError(res.error); }
      else { toast('Record archived.', 'success'); router.refresh(); }
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
    <td className="text-right relative">
      <button
        type="button"
        className="text-[var(--color-text-secondary)] hover:text-white p-1 rounded hover:bg-[var(--color-basalt-500)]"
        onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === id ? null : id); }}
      >
        <MoreHorizontal size={16} />
      </button>
      {openMenuId === id && (
        <div className="absolute right-2 top-8 w-40 bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded-md shadow-lg z-50 py-1 text-left" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="w-full text-left px-4 py-2 text-[13px] text-white hover:bg-[var(--color-basalt-700)]" onClick={() => { setOpenMenuId(null); setViewing({ id, type }); setDrawerTab('ACTIVE'); setIsEditingProfile(false); }}>View Profile</button>
          {canManage && type !== 'CUSTOMER' && <button type="button" className="w-full text-left px-4 py-2 text-[13px] text-white hover:bg-[var(--color-basalt-700)]" onClick={() => { setOpenMenuId(null); setViewing({ id, type }); setDrawerTab('ACTIVE'); setIsEditingProfile(true); }}>Edit Details</button>}
          {canManage && <><div className="h-px bg-[var(--color-basalt-500)] my-1" /><button type="button" className="w-full text-left px-4 py-2 text-[13px] text-[var(--color-ruby)] hover:bg-[var(--color-basalt-700)]" onClick={() => doDelete(id)}>Delete Entity</button></>}
        </div>
      )}
    </td>
  );

  // Render a single customer table cell's inner content for a given column key.
  const yesNo = (b: boolean) => b
    ? <span className="bg-[var(--color-emerald)]/10 text-[var(--color-emerald)] border border-[rgba(16,185,129,0.20)] px-1.5 py-0.5 rounded text-[10px] font-medium">Yes</span>
    : <span className="text-[var(--color-fog-500)]">—</span>;
  const custCell = (key: CustColKey, item: CrmCustomer): React.ReactNode => {
    switch (key) {
      case 'type': return <Badge>{item.subType}</Badge>;
      case 'contact': return <span className="text-white">{item.contact}</span>;
      case 'terms': return <span className="bg-[var(--color-basalt-500)] text-white px-2 py-0.5 rounded text-[11px]">{item.terms}</span>;
      case 'rep': return <span className="text-[var(--color-text-secondary)]">{item.rep}</span>;
      case 'creditLimit': return <span className="text-white font-medium">${item.creditLimit.toLocaleString()}</span>;
      case 'since': return <span className="text-[var(--color-text-secondary)]">{item.customerSince ?? '—'}</span>;
      case 'openDeals': return <span className="text-white font-medium">{item.openDeals}</span>;
      case 'ltv': return <span className="text-white font-medium">${item.lifetimeValue.toLocaleString()}</span>;
      case 'dba': return <span className="text-[var(--color-text-secondary)]">{item.dba ?? '—'}</span>;
      case 'parent': return <span className="text-[var(--color-text-secondary)]">{item.parentCustomerName ?? '—'}</span>;
      case 'state': return <span className="text-[var(--color-text-secondary)]">{item.state ?? '—'}</span>;
      case 'status': return <StatusPill status={item.status} />;
      case 'multiLoc': return yesNo(item.multiLocation);
      case 'poReq': return yesNo(item.poRequired);
      case 'taxExempt': return yesNo(item.taxExempt);
      case 'fulfillment': return <span className="text-[var(--color-text-secondary)]">{item.defaultFulfillment ?? '—'}</span>;
      case 'acctEmail': return <span className="text-[var(--color-sodalite)]">{item.accountingEmail ?? '—'}</span>;
      default: return null;
    }
  };
  const visibleCustCols = CUST_COLUMNS.filter((c) => visibleCols.has(c.key));
  // A sortable customer column header.
  const custTh = (key: string, label: string, right?: boolean) => (
    <th className={right ? 'text-right' : undefined}>
      <button
        type="button"
        onClick={() => toggleCustSort(key)}
        className={`inline-flex items-center gap-1 hover:text-white transition-colors ${right ? 'flex-row-reverse' : ''} ${custSort.key === key ? 'text-white' : ''}`}
      >
        {label}{' '}
        <ArrowUpDown
          size={11}
          className={custSort.key === key ? 'text-[var(--color-vein)]' : 'text-[var(--color-fog-500)]'}
        />
      </button>
    </th>
  );

  const viewingSupplier = viewing?.type === 'SUPPLIER' ? suppliers.find((s) => s.id === viewing.id) : null;
  const viewingVendor = viewing?.type === 'VENDOR' ? vendors.find((v) => v.id === viewing.id) : null;
  const viewingAssociate = viewing?.type === 'ASSOCIATE' ? associates.find((a) => a.id === viewing.id) : null;
  const viewingCustomer = viewing?.type === 'CUSTOMER' ? customers.find((c) => c.id === viewing.id) : null;
  const inputCls = 'bp-input !h-8 text-[12px]';
  const addInputCls = 'bp-input';
  const addSelectCls = 'bp-select w-full h-10 text-[13px]';

  return (
    <div className="flex flex-col h-full bg-[var(--color-basalt-850)] text-[var(--color-text-muted)] overflow-hidden relative">
      {confirmDialog}
      {/* Header & Tabs */}
      <PageHeader
        eyebrow="Sales"
        title="People"
        subtitle="Suppliers, logistics vendors, customers, and sales associates."
        meta={[
          { label: `${customers.length} customers`, tone: 'blue' },
          { label: `${associates.length} reps`, tone: 'green' },
        ]}
        actions={
          canManage ? (
            <button
              type="button"
              onClick={() => { setAddOpen(true); setActionError(''); setProvisionLogin(false); }}
              className="btn-primary !min-h-8 !px-3 text-[12px]"
            >
              <Plus size={14} /> Add {TYPE_LABEL[TAB_TO_TYPE[activeTab]]}
            </button>
          ) : undefined
        }
        className="pb-0"
      >
        <div className="flex items-center gap-6">
          {([['SUPPLIERS', Building2, '#e3c16c', 'Suppliers'], ['VENDORS', Truck, '#92b0ce', 'Vendors (Logistics)'], ['CUSTOMERS', UserSquare2, '#e8956b', 'Customers'], ['ASSOCIATES', Users, '#10b981', 'Associates / Sales']] as const).map(([tab, Icon, color, label]) => (
            <button key={tab} onClick={() => { setActiveTab(tab); clearAllFilters(); }} className={`flex items-center gap-2 pb-3 text-[13px] font-medium border-b-2 transition-colors ${activeTab === tab ? 'text-white' : 'border-transparent text-[var(--color-text-secondary)] hover:text-white'}`} style={activeTab === tab ? { borderColor: color } : undefined}>
              <Icon size={16} style={activeTab === tab ? { color } : undefined} /> {label}
            </button>
          ))}
        </div>
      </PageHeader>

      {/* Action bar */}
      <div className="px-6 py-3 flex items-center justify-between border-b border-[var(--color-basalt-500)] shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded-md px-3 py-1.5 focus-within:border-[var(--color-sodalite)] transition-colors w-80">
            <Search size={14} className="text-[var(--color-text-secondary)] mr-2 shrink-0" />
            <input type="text" placeholder={`Search ${activeTab.toLowerCase()}...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-transparent border-none outline-none text-[13px] text-white w-full placeholder-[var(--color-fog-500)]" />
          </div>
          <div className="w-px h-4 bg-[var(--color-basalt-500)]" />
          <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-2 py-1 rounded transition-colors text-[13px] ${showFilters ? 'bg-[var(--color-basalt-700)] text-white' : 'hover:bg-[var(--color-basalt-700)] text-[var(--color-text-secondary)]'}`}>
            <ListFilter size={14} /> {showFilters ? 'Hide Filters' : 'Filters'}
            {activeFiltersCount > 0 && (
              <span className="bg-[rgba(227,193,108,0.14)] text-[var(--color-vein)] border border-[rgba(227,193,108,0.3)] text-[10px] px-1.5 rounded-sm ml-1 font-semibold tabular-nums">
                {activeFiltersCount}
              </span>
            )}
          </button>
          {activeTab === 'CUSTOMERS' && (
            <>
              <button onClick={() => setCustomerView(customerView === 'CATALOG' ? 'LIST' : 'CATALOG')} className={`flex items-center gap-2 px-2 py-1 rounded transition-colors text-[13px] ${customerView === 'CATALOG' ? 'bg-[var(--color-basalt-700)] text-white' : 'hover:bg-[var(--color-basalt-700)] text-[var(--color-text-secondary)]'}`}>
                <LayoutGrid size={14} /> Catalog
              </button>
              <div className="relative">
                <button onClick={() => setShowColPicker(!showColPicker)} className={`flex items-center gap-2 px-2 py-1 rounded transition-colors text-[13px] ${showColPicker ? 'bg-[var(--color-basalt-700)] text-white' : 'hover:bg-[var(--color-basalt-700)] text-[var(--color-text-secondary)]'}`}>
                  <Columns3 size={14} /> Columns
                </button>
                {showColPicker && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowColPicker(false)} />
                    <div className="absolute left-0 top-9 w-56 max-h-[60vh] overflow-y-auto bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded-md shadow-xl z-50 py-2">
                      <p className="px-3 pb-1.5 text-[10px] uppercase tracking-wider text-[var(--color-fog-500)]">Visible columns</p>
                      {CUST_COLUMNS.map((c) => (
                        <label key={c.key} className="flex items-center gap-2 px-3 py-1.5 text-[12px] text-white hover:bg-[var(--color-basalt-700)] cursor-pointer">
                          <input type="checkbox" checked={visibleCols.has(c.key)} onChange={() => toggleCol(c.key)} className="accent-[var(--color-vein)]" />
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
        <div className="text-[13px] text-[var(--color-text-secondary)]">Total Records: <strong className="text-white">{totalRecords}</strong></div>
      </div>

      {/* Filter dropdowns */}
      {showFilters && (
        <div className="px-6 py-3 bg-[var(--color-basalt-900)] border-b border-[var(--color-basalt-500)] flex items-center gap-4 text-[13px]">
          <span className="text-[var(--color-text-secondary)]">Filter by:</span>
          {activeTab === 'SUPPLIERS' && (
            <>
              <select value="" onChange={(e) => addUnique(setSelectedOrigins, e.target.value)} className="bg-[var(--color-basalt-700)] border border-[var(--color-basalt-500)] text-white rounded px-2 py-1 outline-none focus:border-[var(--color-sodalite)]"><option value="">+ Add Origin</option>{originOptions.map((o) => <option key={o} value={o}>{o}</option>)}</select>
              <select value="" onChange={(e) => addUnique(setSelectedTerms, e.target.value)} className="bg-[var(--color-basalt-700)] border border-[var(--color-basalt-500)] text-white rounded px-2 py-1 outline-none focus:border-[var(--color-sodalite)]"><option value="">+ Add Terms</option>{termOptions.map((o) => <option key={o} value={o}>{o}</option>)}</select>
            </>
          )}
          {activeTab === 'VENDORS' && (
            <select value="" onChange={(e) => addUnique(setSelectedServices, e.target.value)} className="bg-[var(--color-basalt-700)] border border-[var(--color-basalt-500)] text-white rounded px-2 py-1 outline-none focus:border-[var(--color-sodalite)]"><option value="">+ Add Service Type</option>{serviceOptions.map((o) => <option key={o} value={o}>{o}</option>)}</select>
          )}
          {activeTab === 'ASSOCIATES' && (
            <>
              <select value="" onChange={(e) => addUnique(setSelectedRoles, e.target.value)} className="bg-[var(--color-basalt-700)] border border-[var(--color-basalt-500)] text-white rounded px-2 py-1 outline-none focus:border-[var(--color-sodalite)]"><option value="">+ Add Role</option>{roleOptions.map((o) => <option key={o} value={o}>{o}</option>)}</select>
              <select value="" onChange={(e) => addUnique(setSelectedLocations, e.target.value)} className="bg-[var(--color-basalt-700)] border border-[var(--color-basalt-500)] text-white rounded px-2 py-1 outline-none focus:border-[var(--color-sodalite)]"><option value="">+ Add Hub Location</option>{locationOptions.map((o) => <option key={o} value={o}>{o}</option>)}</select>
            </>
          )}
          {activeTab === 'CUSTOMERS' && (
            <div className="flex items-center gap-3 flex-wrap">
              {customerFacetCards.filter((f) => ['type', 'price', 'rep', 'state', 'status'].includes(f.id)).map((f) => (
                <select key={f.id} value="" onChange={(e) => { if (e.target.value) toggleCustFilter(f.id, e.target.value); }} className="bg-[var(--color-basalt-700)] border border-[var(--color-basalt-500)] text-white rounded px-2 py-1 outline-none focus:border-[var(--color-sodalite)]">
                  <option value="">+ {f.label}</option>
                  {f.entries.filter(([val]) => !(custFilters[f.id] ?? []).includes(val)).map(([val, n]) => <option key={val} value={val}>{val} ({n})</option>)}
                </select>
              ))}
            </div>
          )}
          {activeFiltersCount > 0 && <button onClick={clearAllFilters} className="text-[var(--color-sodalite)] hover:underline">Clear All</button>}
        </div>
      )}

      {/* Active filter pills */}
      {activeFiltersCount > 0 && (
        <div className="px-6 py-2 bg-[var(--color-basalt-800)] border-b border-[var(--color-basalt-500)] flex items-center gap-2 flex-wrap">
          <span className="text-[var(--color-text-secondary)] text-[11px] uppercase tracking-wider mr-2">Active Filters:</span>
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

      {actionError && <div className="mx-6 mt-3 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[var(--color-ruby)] text-[12px] px-3 py-2 rounded">{actionError}</div>}

      {/* Customer Catalog — faceted count cards (click a value to filter the table) */}
      {activeTab === 'CUSTOMERS' && customerView === 'CATALOG' && (
        <div className="px-6 py-4 bg-[var(--color-basalt-900)] border-b border-[var(--color-basalt-500)] shrink-0 max-h-[42vh] overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {customerFacetCards.map((f) => (
              <FacetCard key={f.id} title={f.label}>
                {f.entries.map(([val, n]) => {
                  const active = (custFilters[f.id] ?? []).includes(val);
                  return (
                    <button key={val} onClick={() => toggleCustFilter(f.id, val)} className={`w-full flex items-center justify-between px-2 py-1 rounded text-[12px] transition-colors ${active ? 'bg-[var(--color-vein)]/15 text-[var(--color-vein)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-basalt-700)]'}`}>
                      <span className="truncate mr-2">{val}</span>
                      <span className={`tabular-nums ${active ? 'text-[var(--color-vein)]' : 'text-[var(--color-text-secondary)]'}`}>{n}</span>
                    </button>
                  );
                })}
              </FacetCard>
            ))}
            <FacetCard title="Accounting">
              {acctFlagCounts.map(({ label, count }) => {
                const active = (custFilters['acct'] ?? []).includes(label);
                return (
                  <button key={label} onClick={() => toggleCustFilter('acct', label)} className={`w-full flex items-center justify-between px-2 py-1 rounded text-[12px] transition-colors ${active ? 'bg-[var(--color-vein)]/15 text-[var(--color-vein)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-basalt-700)]'}`}>
                    <span className="truncate mr-2">{label}</span>
                    <span className={`tabular-nums ${active ? 'text-[var(--color-vein)]' : 'text-[var(--color-text-secondary)]'}`}>{count}</span>
                  </button>
                );
              })}
            </FacetCard>
          </div>
        </div>
      )}

      {/* Table — shared dense table language */}
      <div className="flex-1 overflow-auto p-4 bg-[var(--color-basalt-850)]">
        <div className="bp-table-shell overflow-x-auto">
        <table className="bp-table min-w-max whitespace-nowrap">
          <thead>
            <tr>
              <th className="w-10"></th>
              {activeTab === 'SUPPLIERS' && <>
                <Th>Supplier Name</Th><Th>Origin</Th><Th>Primary Contact</Th><Th>Terms</Th><Th right>Active POs</Th><Th right>YTD Spend</Th>
              </>}
              {activeTab === 'VENDORS' && <>
                <Th>Vendor Name</Th><Th>Service Type</Th><Th>Primary Contact</Th><Th right>Active Invoices</Th><Th right>AP Balance</Th>
              </>}
              {activeTab === 'CUSTOMERS' && <>
                {custTh('name', 'Customer Name')}
                {visibleCustCols.map((c) => <React.Fragment key={c.key}>{custTh(c.key, c.label, c.right)}</React.Fragment>)}
              </>}
              {activeTab === 'ASSOCIATES' && <>
                <Th>Associate Name</Th><Th>Sales Number</Th><Th>Role &amp; Location</Th><Th>Commission</Th><Th right>Active Pipeline</Th><Th right>YTD Sales</Th>
              </>}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {activeTab === 'SUPPLIERS' && (filteredSuppliers.length === 0 ? <EmptyRow cols={8} /> : filteredSuppliers.map((item) => (
              <tr key={item.id} className="group">
                <td />
                <td className="font-medium text-white"><button type="button" className="hover:underline hover:text-[var(--color-vein)]" onClick={() => { setViewing({ id: item.id, type: 'SUPPLIER' }); setDrawerTab('ACTIVE'); setIsEditingProfile(false); }}>{item.name}</button></td>
                <td className="text-[var(--color-text-secondary)]"><span className="flex items-center gap-1.5"><Globe size={12} /> {item.origin}</span></td>
                <td className="text-white">{item.contact}</td>
                <td><span className="bg-[var(--color-basalt-700)] border border-[var(--color-basalt-500)] text-white px-2 py-0.5 rounded text-[11px]">{item.terms}</span></td>
                <td className="text-right font-medium text-white tabular-nums">{item.activePos}</td>
                <td className="text-right text-white font-medium tabular-nums">${item.ytdSpend.toLocaleString()}</td>
                {rowMenu(item.id, 'SUPPLIER')}
              </tr>
            )))}
            {activeTab === 'VENDORS' && (filteredVendors.length === 0 ? <EmptyRow cols={7} /> : filteredVendors.map((item) => (
              <tr key={item.id} className="group">
                <td />
                <td className="font-medium text-white"><button type="button" className="hover:underline hover:text-[var(--color-sodalite)]" onClick={() => { setViewing({ id: item.id, type: 'VENDOR' }); setDrawerTab('ACTIVE'); setIsEditingProfile(false); }}>{item.name}</button></td>
                <td><span className="bg-[var(--color-basalt-700)] border border-[var(--color-basalt-500)] text-[var(--color-text-secondary)] px-2 py-0.5 rounded text-[11px]">{item.service}</span></td>
                <td className="text-white">{item.contact}</td>
                <td className="text-right font-medium text-white tabular-nums">{item.activeInvoices}</td>
                <td className="text-right text-white font-medium tabular-nums"><span className="inline-flex items-center justify-end gap-1"><DollarSign size={12} className="text-[var(--color-vein)]" /> {item.balance.toLocaleString()}</span></td>
                {rowMenu(item.id, 'VENDOR')}
              </tr>
            )))}
            {activeTab === 'CUSTOMERS' && (sortedCustomers.length === 0 ? (
              <tr><td colSpan={visibleCustCols.length + 2} className="!p-4"><EmptyState icon={UserSquare2} title="No customers match" hint={searchTerm || activeFiltersCount > 0 ? 'Try clearing your search or filters.' : 'Add your first customer to get started.'} className="py-10" /></td></tr>
            ) : sortedCustomers.map((item) => (
              <tr key={item.id} className="group">
                <td />
                <td className="font-medium text-white">
                  <button type="button" className="hover:underline hover:text-[var(--color-coral)]" onClick={() => { setViewing({ id: item.id, type: 'CUSTOMER' }); setDrawerTab('ACTIVE'); setIsEditingProfile(false); }}>{item.name}</button>
                  {item.salesLockNote && <Lock size={11} className="inline ml-1.5 text-[var(--color-ruby)]" aria-label="Sales lock" />}
                </td>
                {visibleCustCols.map((c) => <td key={c.key} className={c.right ? 'text-right' : ''}>{custCell(c.key, item)}</td>)}
                {rowMenu(item.id, 'CUSTOMER')}
              </tr>
            )))}
            {activeTab === 'ASSOCIATES' && (filteredAssociates.length === 0 ? <EmptyRow cols={8} /> : filteredAssociates.map((item) => (
              <tr key={item.id} className="group">
                <td />
                <td className="font-medium text-white"><button type="button" className="hover:underline hover:text-[var(--color-emerald)]" onClick={() => { setViewing({ id: item.id, type: 'ASSOCIATE' }); setDrawerTab('ACTIVE'); setIsEditingProfile(false); }}>{item.name}</button></td>
                <td className="text-white"><span className="bg-[var(--color-basalt-700)] border border-[var(--color-basalt-500)] px-2 py-0.5 rounded text-[11px] bp-mono tracking-wider">{item.salesNumber}</span></td>
                <td><div className="flex flex-col"><span className="text-white">{item.role}</span><span className="text-[11px] text-[var(--color-text-secondary)] flex items-center gap-1 mt-0.5"><MapPin size={10} /> {item.location}</span></div></td>
                <td className="text-[var(--color-text-secondary)]">{item.commissionRate}</td>
                <td className="text-right font-medium text-white tabular-nums">${item.activeOppValue.toLocaleString()}</td>
                <td className="text-right"><span className="font-medium text-[var(--color-emerald)] inline-flex items-center justify-end gap-1 tabular-nums"><TrendingUp size={12} /> ${item.ytdSales.toLocaleString()}</span></td>
                {rowMenu(item.id, 'ASSOCIATE')}
              </tr>
            )))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Drill-down — shared Drawer */}
      <Drawer
        open={!!viewing}
        onClose={() => { setViewing(null); setIsEditingProfile(false); }}
        width={700}
        title={
          viewing ? (
            <span className="flex items-center gap-2 min-w-0">
              {viewing.type === 'SUPPLIER' && <Building2 size={18} className="text-[var(--color-vein)] shrink-0" />}
              {viewing.type === 'VENDOR' && <Truck size={18} className="text-[var(--color-sodalite)] shrink-0" />}
              {viewing.type === 'CUSTOMER' && <UserSquare2 size={18} className="text-[var(--color-coral)] shrink-0" />}
              {viewing.type === 'ASSOCIATE' && <Target size={18} className="text-[var(--color-emerald)] shrink-0" />}
              <span className="truncate">
                {viewingSupplier?.name ?? viewingVendor?.name ?? viewingCustomer?.name ?? viewingAssociate?.name}
              </span>
              <span className="text-[var(--color-text-secondary)] font-normal text-[13px] shrink-0">
                {TYPE_LABEL[viewing.type]}
              </span>
            </span>
          ) : undefined
        }
        headerExtra={
          viewing && canManage && !isEditingProfile && viewing.type !== 'CUSTOMER' ? (
            <button
              type="button"
              onClick={() => setIsEditingProfile(true)}
              className="btn-secondary !min-h-8 !px-2.5 text-[12px]"
            >
              <Edit2 size={14} /> Edit
            </button>
          ) : undefined
        }
      >
        {viewing && (
          <div className="p-6 space-y-4">
              {/* Profile card */}
              <form onSubmit={handleInlineSave} className="bp-card p-5 mb-2">
                {viewingSupplier && (
                  <div className="grid grid-cols-3 gap-6">
                    <Field label="Contact Information">
                      {isEditingProfile ? <div className="space-y-2"><input name="contact" defaultValue={viewingSupplier.contact} className={inputCls} /><input name="email" defaultValue={viewingSupplier.email} className={inputCls} /><input name="phone" defaultValue={viewingSupplier.phone} className={inputCls} /></div>
                        : <><p className="text-[13px] text-white font-medium">{viewingSupplier.contact}</p><p className="text-[12px] text-[var(--color-sodalite)] flex items-center gap-1 mt-1"><Mail size={12} /> {viewingSupplier.email}</p><p className="text-[12px] text-[var(--color-text-secondary)] flex items-center gap-1 mt-0.5"><Phone size={12} /> {viewingSupplier.phone}</p></>}
                    </Field>
                    <Field label="Location & Origin">
                      {isEditingProfile ? <input name="origin" defaultValue={viewingSupplier.origin} className={inputCls} /> : <p className="text-[13px] text-white flex items-center gap-1"><Globe size={12} className="text-[var(--color-text-secondary)]" /> {viewingSupplier.origin}</p>}
                    </Field>
                    <Field label="Financial Terms & Credit">
                      {isEditingProfile ? <div className="space-y-2"><input name="terms" defaultValue={viewingSupplier.terms} className={inputCls} placeholder="Payment Terms" /><input name="incoterms" defaultValue={viewingSupplier.incoterms} className={inputCls} placeholder="Incoterms" /><input name="creditLimit" type="number" defaultValue={viewingSupplier.creditLimit} className={inputCls} placeholder="Credit Limit" /></div>
                        : <><div className="flex items-center gap-2 mb-1"><span className="bg-[var(--color-basalt-500)] text-white px-2 py-0.5 rounded text-[11px] font-medium">{viewingSupplier.terms}</span><span className="bg-[var(--color-basalt-500)] text-[var(--color-text-secondary)] px-2 py-0.5 rounded text-[11px] font-medium border border-[var(--color-basalt-500)]">{viewingSupplier.incoterms}</span></div>{viewingSupplier.creditLimit > 0 ? <p className="text-[12px] text-[var(--color-emerald)] font-medium">Limit: ${viewingSupplier.creditLimit.toLocaleString()} {viewingSupplier.currency}</p> : <p className="text-[12px] text-[var(--color-vein)] font-medium">Cash in Advance / No Credit</p>}</>}
                    </Field>
                  </div>
                )}
                {viewingVendor && (
                  <div className="grid grid-cols-3 gap-6">
                    <Field label="Contact Information">
                      {isEditingProfile ? <div className="space-y-2"><input name="contact" defaultValue={viewingVendor.contact} className={inputCls} /><input name="email" defaultValue={viewingVendor.email} className={inputCls} /><input name="phone" defaultValue={viewingVendor.phone} className={inputCls} /></div>
                        : <><p className="text-[13px] text-white font-medium">{viewingVendor.contact}</p><p className="text-[12px] text-[var(--color-sodalite)] flex items-center gap-1 mt-1"><Mail size={12} /> {viewingVendor.email}</p><p className="text-[12px] text-[var(--color-text-secondary)] flex items-center gap-1 mt-0.5"><Phone size={12} /> {viewingVendor.phone}</p></>}
                    </Field>
                    <Field label="Service Type">
                      {isEditingProfile ? <input name="service" defaultValue={viewingVendor.service} className={inputCls} /> : <span className="bg-[var(--color-basalt-700)] border border-[var(--color-basalt-500)] text-[var(--color-text-secondary)] px-2 py-0.5 rounded text-[11px]">{viewingVendor.service}</span>}
                    </Field>
                    <Field label="Open balance">
                      <p className="text-[14px] text-[var(--color-vein)] font-medium flex items-center gap-1 mb-1" style={{ fontFamily: 'var(--font-heading)' }}>
                        <DollarSign size={14} /> {viewingVendor.balance.toLocaleString()}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-secondary)]">
                        {viewingVendor.service || 'Logistics vendor'}
                      </p>
                    </Field>
                  </div>
                )}
                {viewingAssociate && (
                  <div className="grid grid-cols-3 gap-6">
                    <Field label="Role & ID">
                      {isEditingProfile ? <input name="role" defaultValue={viewingAssociate.role} className={inputCls} /> : <><p className="text-[13px] text-white font-medium mb-1">{viewingAssociate.role}</p><span className="bg-[var(--color-basalt-500)] border border-[var(--color-basalt-500)] px-2 py-0.5 rounded text-[11px] font-mono tracking-wider text-white">{viewingAssociate.salesNumber}</span></>}
                    </Field>
                    <Field label="Location">
                      {isEditingProfile ? <input name="location" defaultValue={viewingAssociate.location} className={inputCls} /> : <p className="text-[13px] text-white flex items-center gap-1"><MapPin size={12} className="text-[var(--color-text-secondary)]" /> {viewingAssociate.location}</p>}
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
                          <p className="text-[12px] text-[var(--color-vein)] mt-1">
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
                        {c.salesLockNote && <div className="flex items-start gap-2 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.30)] text-[var(--color-ruby)] text-[12px] px-3 py-2 rounded"><Lock size={14} className="mt-0.5 shrink-0" /><span><strong className="text-[var(--color-ruby)]">Sales Lock:</strong> {c.salesLockNote}</span></div>}
                        {c.salesAlertNote && <div className="flex items-start gap-2 bg-[var(--color-vein)]/10 border border-[rgba(227,193,108,0.30)] text-[var(--color-vein)] text-[12px] px-3 py-2 rounded"><AlertTriangle size={14} className="mt-0.5 shrink-0" /><span><strong>Sales Alert:</strong> {c.salesAlertNote}</span></div>}
                      </div>
                    )}
                    {/* Cross-module shortcuts — commercial flow */}
                    <div className="flex flex-wrap gap-2">
                      <a
                        href="/pipeline"
                        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-amethyst)] bg-[rgba(181,140,214,0.10)] border border-[rgba(181,140,214,0.3)] rounded-md px-3 py-1.5 hover:bg-[rgba(181,140,214,0.20)] transition-colors"
                      >
                        <Briefcase size={13} /> Open pipeline
                      </a>
                      <a
                        href="/orders"
                        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-emerald)] bg-[var(--color-emerald)]/10 border border-[rgba(16,185,129,0.30)] rounded-md px-3 py-1.5 hover:bg-[var(--color-emerald)]/20 transition-colors"
                      >
                        <FileText size={13} /> Sales orders
                      </a>
                      {(c.openDeals > 0 || c.lifetimeValue > 0) && (
                        <span className="inline-flex items-center text-[11px] text-[var(--color-text-secondary)] px-2">
                          {c.openDeals > 0 ? `${c.openDeals} open deal${c.openDeals === 1 ? '' : 's'} · ` : ''}
                          ${c.lifetimeValue.toLocaleString()} LTV
                        </span>
                      )}
                    </div>
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
                      <Field label="Email"><span className="text-[13px] text-[var(--color-sodalite)]">{val(c.email)}</span></Field>
                      <Field label="Accounting Email"><span className="text-[13px] text-[var(--color-sodalite)]">{val(c.accountingEmail)}</span></Field>
                      <Field label="Website"><span className="text-[13px] text-white">{val(c.website)}</span></Field>
                    </DrawerSection>
                    <DrawerSection title="Addresses" cols={1}>
                      <Field label="Bill-To"><span className="text-[13px] text-white">{fmtAddr(c.billingAddress)}</span></Field>
                      <Field label="Ship-To"><span className="text-[13px] text-white">{fmtAddr(c.shippingAddress)}</span></Field>
                    </DrawerSection>
                    <DrawerSection title="Sales & Pricing">
                      <Field label="Assigned Rep"><span className="text-[13px] text-white">{val(c.rep)}</span></Field>
                      <Field label="Price Tier"><span className="text-[13px] text-[var(--color-vein)]">{val(c.priceTier)}</span></Field>
                      <Field label="Payment Terms"><span className="text-[13px] text-white">{val(c.terms)}</span></Field>
                      <Field label="Currency"><span className="text-[13px] text-white">{c.currency}</span></Field>
                      <Field label="Default Fulfillment"><span className="text-[13px] text-white">{val(c.defaultFulfillment)}</span></Field>
                      <Field label="Source"><span className="text-[13px] text-white">{val(c.source)}</span></Field>
                      <Field label="Customer Since"><span className="text-[13px] text-white">{val(c.customerSince)}</span></Field>
                      <Field label="Open Deals"><span className="text-[13px] text-white">{c.openDeals}</span></Field>
                      <Field label="Lifetime Value"><span className="text-[13px] text-[var(--color-emerald)]">${c.lifetimeValue.toLocaleString()}</span></Field>
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
                        {c.copyNotesToOrders && <p className="text-[11px] text-[var(--color-fog-500)]">Notes are copied to all orders.</p>}
                      </DrawerSection>
                    )}
                  </div>
                  );
                })()}
                {isEditingProfile && (
                  <div className="mt-6 pt-4 border-t border-[var(--color-basalt-500)] flex justify-end gap-3">
                    <button type="button" onClick={() => setIsEditingProfile(false)} className="btn-ghost text-[12px]">Cancel</button>
                    <button type="submit" disabled={isPending} className="btn-primary text-[12px] disabled:opacity-60">{isPending ? 'Saving…' : 'Save changes'}</button>
                  </div>
                )}
              </form>

              {/* Inner tabs (activity drill-down) — not shown for customers */}
              {viewing.type !== 'CUSTOMER' && (
              <div className="flex border-b border-[var(--color-basalt-500)] mb-4 gap-6">
                <button onClick={() => setDrawerTab('ACTIVE')} className={`pb-2 text-[13px] font-medium border-b-2 ${drawerTab === 'ACTIVE' ? 'border-[var(--color-vein)] text-white' : 'border-transparent text-[var(--color-text-secondary)] hover:text-white'}`}>
                  {viewing.type === 'SUPPLIER' ? 'Ongoing Purchase Orders' : viewing.type === 'VENDOR' ? 'Pending Invoices' : 'Active Pipeline'}
                </button>
                <button onClick={() => setDrawerTab('HISTORY')} className={`pb-2 text-[13px] font-medium border-b-2 ${drawerTab === 'HISTORY' ? 'border-[var(--color-vein)] text-white' : 'border-transparent text-[var(--color-text-secondary)] hover:text-white'}`}>
                  {viewing.type === 'SUPPLIER' ? 'Historical Business' : viewing.type === 'VENDOR' ? 'Payment History' : 'Closed Sales'}
                </button>
              </div>
              )}

              {/* SUPPLIER cards */}
              {viewing.type === 'SUPPLIER' && (() => {
                const list = drawerTab === 'ACTIVE' ? activePos[viewing.id] : historyPos[viewing.id];
                if (!list || list.length === 0) return <div className={EMPTY}>{drawerTab === 'ACTIVE' ? 'No ongoing Purchase Orders.' : 'No historical POs found.'}</div>;
                return <div className="space-y-4">{list.map((po) => (
                  <div key={po.poNumber} className="bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded-md overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-[var(--color-basalt-500)] bg-[var(--color-basalt-700)]/30">
                      <div className="flex items-center gap-3"><span className="font-mono text-white font-medium">{po.poNumber}</span><span className="px-2 py-0.5 rounded text-[11px] font-medium border bg-[rgba(146,176,206,0.10)] text-[var(--color-sodalite)] border-[rgba(146,176,206,0.30)]">{po.status}</span></div>
                      <span className="text-[14px] font-medium text-[var(--color-emerald)]">${po.amount.toLocaleString()}</span>
                    </div>
                    <div className="p-4 grid grid-cols-3 gap-4 text-[13px]">
                      <div><p className="text-[var(--color-text-secondary)] mb-1">ETA</p><p className="text-white font-medium">{po.eta}</p></div>
                      <div><p className="text-[var(--color-text-secondary)] mb-1">Container</p><p className="text-white font-mono">{po.container}</p></div>
                      <div><p className="text-[var(--color-text-secondary)] mb-1">Slabs</p><p className="text-white">{po.slabs} Units</p></div>
                    </div>
                  </div>
                ))}</div>;
              })()}

              {/* VENDOR cards */}
              {viewing.type === 'VENDOR' && (() => {
                const list = drawerTab === 'ACTIVE' ? vendorInvoices[viewing.id] : historyInvoices[viewing.id];
                if (!list || list.length === 0) return <div className={EMPTY}>{drawerTab === 'ACTIVE' ? 'No pending invoices found.' : 'No payment history found.'}</div>;
                return <div className="space-y-4">{list.map((inv) => (
                  <div key={inv.invoiceNum} className="bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded-md overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-[var(--color-basalt-500)] bg-[var(--color-basalt-700)]/30">
                      <div className="flex items-center gap-3"><FileText size={14} className="text-[var(--color-sodalite)]" /><span className="font-mono text-white font-medium">{inv.invoiceNum}</span><span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${inv.status === 'Overdue' ? 'bg-[rgba(239,68,68,0.1)] text-[var(--color-ruby)] border-[rgba(239,68,68,0.30)]' : inv.status === 'In Dispute' ? 'bg-[rgba(232,149,107,0.1)] text-[var(--color-coral)] border-[rgba(232,149,107,0.30)]' : 'bg-[var(--color-vein)]/10 text-[var(--color-vein)] border-[rgba(227,193,108,0.30)]'}`}>{inv.status}</span></div>
                      <span className="text-[14px] font-medium text-[var(--color-vein)]">${inv.amount.toLocaleString()}</span>
                    </div>
                    <div className="p-4 text-[13px]"><p className="text-[var(--color-text-secondary)] mb-1">Service Provided</p><p className="text-white mb-4">{inv.serviceDetails}</p><p className="text-[var(--color-text-secondary)] mb-1">Due Date</p><p className="text-white font-medium">{inv.dueDate}</p></div>
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
                      <div key={idx} className="bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded-md overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-[var(--color-basalt-500)] bg-[var(--color-basalt-700)]/30"><div className="flex items-center gap-3"><Target size={14} className="text-[var(--color-text-secondary)]" /><span className="text-white font-medium">{opp.oppName}</span><span className="px-2 py-0.5 rounded text-[11px] font-medium border bg-[rgba(146,176,206,0.10)] text-[var(--color-sodalite)] border-[rgba(146,176,206,0.30)]">{opp.status}</span></div><span className="text-[14px] font-medium text-white">${opp.amount.toLocaleString()}</span></div>
                        <div className="p-4 grid grid-cols-2 gap-4 text-[13px]"><div><p className="text-[var(--color-text-secondary)] mb-1">Expected Close</p><p className="text-white font-medium">{opp.expectedClose}</p></div><div><p className="text-[var(--color-text-secondary)] mb-1">Probability</p><div className="flex items-center gap-2"><div className="h-1.5 flex-1 bg-[var(--color-basalt-700)] rounded-full overflow-hidden"><div className="h-full bg-[var(--color-emerald)]" style={{ width: opp.probability }} /></div><span className="text-white">{opp.probability}</span></div></div></div>
                      </div>
                    ))}</div>;
                  })()}
                  {drawerTab === 'HISTORY' && (() => {
                    const list = associateSales[viewing.id];
                    if (!list || list.length === 0) return <div className={EMPTY}>No recent closed sales found.</div>;
                    return <div className="space-y-4">{list.map((sale, idx) => (
                      <div key={idx} className="bg-[var(--color-basalt-900)] border border-[rgba(16,185,129,0.30)] rounded-md overflow-hidden relative"><div className="absolute top-0 left-0 w-1 h-full bg-[var(--color-emerald)]" />
                        <div className="flex items-center justify-between p-4 border-b border-[var(--color-basalt-500)] bg-[var(--color-basalt-700)]/30 pl-5"><div className="flex items-center gap-3"><FileText size={14} className="text-[var(--color-emerald)]" /><span className="font-mono text-white font-medium">{sale.soNumber}</span><span className="bg-[var(--color-emerald)]/10 text-[var(--color-emerald)] border border-[rgba(16,185,129,0.30)] px-2 py-0.5 rounded text-[11px] font-medium">Closed Won</span></div><span className="text-[14px] font-medium text-[var(--color-emerald)]">+${sale.amount.toLocaleString()}</span></div>
                        <div className="p-4 grid grid-cols-3 gap-4 text-[13px] pl-5"><div><p className="text-[var(--color-text-secondary)] mb-1">Customer</p><p className="text-white font-medium">{sale.customer}</p></div><div><p className="text-[var(--color-text-secondary)] mb-1">Close Date</p><p className="text-white">{sale.closeDate}</p></div><div><p className="text-[var(--color-text-secondary)] mb-1">Items</p><p className="text-white">{sale.items} Units</p></div></div>
                      </div>
                    ))}</div>;
                  })()}
                </>
              )}
          </div>
        )}
      </Drawer>

      {/* Add / register — shared Drawer */}
      {canManage && (() => {
        const t = TAB_TO_TYPE[activeTab];
        const isCompany = t !== 'ASSOCIATE';
        const showLogin = t === 'ASSOCIATE' || t === 'VENDOR';
        return (
      <Drawer
        open={addOpen}
        onClose={closeAdd}
        width={640}
        title={`Add ${TYPE_LABEL[t]}`}
        subtitle={
          <>
            Required fields marked <span className="text-[var(--color-ruby)]">*</span>. Save creates a stable system ID.
          </>
        }
        footer={
          <>
            <Button variant="ghost" size="sm" type="button" onClick={closeAdd}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" form="crm-add-form" disabled={isPending}>
              {isPending ? 'Saving…' : `Save ${TYPE_LABEL[t].toLowerCase()}`}
            </Button>
          </>
        }
      >
          <form id="crm-add-form" onSubmit={handleAdd} className="p-6 space-y-7 text-[13px]">
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
                  <Fld label="Status"><select name="status" defaultValue="ACTIVE" className={addSelectCls}>{PARTY_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}</select></Fld>
                  {t === 'SUPPLIER' && <Fld label="Supplier Type"><select name="subType" className={addSelectCls}><option value="">—</option>{SUPPLIER_SUBTYPES.map((s) => <option key={s} value={s}>{s}</option>)}</select></Fld>}
                </div>
              </Sec>

              {/* Primary contact */}
              <Sec title="Primary Contact">
                <div className="grid grid-cols-2 gap-4">
                  <Fld label="Point of Contact"><input name="contact" placeholder="e.g. Sarah Jenkins" className={addInputCls} /></Fld>
                  <Fld label="Email"><input name="email" type="email" placeholder="email@example.com" className={addInputCls} /></Fld>
                  <Fld label="Phone"><input name="phone" placeholder="+1 (555) 000-0000" className={addInputCls} /></Fld>
                </div>
                <p className="text-[11px] text-[var(--color-fog-500)]">Provide at least one way to reach this member (email or phone).</p>
              </Sec>

              {/* Address */}
              <Sec title="Address">
                <Fld label="Street Address"><input name="addr_line1" placeholder="Street, building" className={addInputCls} /></Fld>
                <Fld label="Address Line 2"><input name="addr_line2" placeholder="Suite, unit (optional)" className={addInputCls} /></Fld>
                <div className="grid grid-cols-2 gap-4">
                  <Fld label="City"><input name="addr_city" placeholder="City" className={addInputCls} /></Fld>
                  <Fld label="State / Region"><input name="addr_region" placeholder="State / province" className={addInputCls} /></Fld>
                  <Fld label="Postal Code"><input name="addr_postal" placeholder="ZIP / postal" className={addInputCls} /></Fld>
                  <Fld label="Country"><select name="addr_country" className={addSelectCls}><option value="">— Select —</option>{COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></Fld>
                </div>
              </Sec>
              </>)}

              {/* SUPPLIER specifics */}
              {t === 'SUPPLIER' && (
                <Sec title="Commercial & Compliance">
                  <div className="grid grid-cols-2 gap-4">
                    <Fld label="Origin Country"><select name="origin" className={addSelectCls}><option value="">—</option>{COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></Fld>
                    <Fld label="Materials Supplied"><select name="materialCategories" multiple className={`${addSelectCls} !h-[88px] py-1`}>{MATERIAL_CATEGORIES.map((m) => <option key={m} value={m}>{m}</option>)}</select></Fld>
                    <Fld label="Payment Terms"><select name="terms" className={addSelectCls}><option value="">—</option>{PAYMENT_TERMS.map((p) => <option key={p} value={p}>{p}</option>)}</select></Fld>
                    <Fld label="Incoterms"><select name="incoterms" className={addSelectCls}><option value="">—</option>{INCOTERMS.map((i) => <option key={i} value={i}>{i}</option>)}</select></Fld>
                    <Fld label="Currency"><select name="currency" defaultValue="USD" className={addSelectCls}>{CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></Fld>
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
                    <Fld label="Service Type"><select name="service" className={addSelectCls}><option value="">—</option>{VENDOR_SERVICE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}</select></Fld>
                    <Fld label="Rate Basis"><select name="rateBasis" className={addSelectCls}><option value="">—</option>{VENDOR_RATE_BASIS.map((r) => <option key={r} value={r}>{r}</option>)}</select></Fld>
                    <Fld label="Service Area / Lanes"><input name="serviceArea" placeholder="e.g. Genoa → NJ" className={addInputCls} /></Fld>
                    <Fld label="Currency"><select name="currency" defaultValue="USD" className={addSelectCls}>{CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></Fld>
                    <Fld label="Payment Terms"><select name="terms" className={addSelectCls}><option value="">—</option>{PAYMENT_TERMS.map((p) => <option key={p} value={p}>{p}</option>)}</select></Fld>
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
                    <Fld label="Customer Type"><select name="subType" className={addSelectCls}><option value="">—</option>{CUSTOMER_SUBTYPES.map((s) => <option key={s} value={s}>{s}</option>)}</select></Fld>
                    <Fld label="Contact Name"><input name="contact" placeholder="e.g. Sarah Jenkins" className={addInputCls} /></Fld>
                    <Fld label="Print Name / DBA"><input name="dba" placeholder="Doing-business-as name" className={addInputCls} /></Fld>
                    <Fld label="Referred By"><input name="referredBy" placeholder="Referral source / partner" className={addInputCls} /></Fld>
                    <Fld label="Parent Customer"><select name="parentCustomerId" className={addSelectCls}><option value="">— None (top-level) —</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Fld>
                    <Fld label="Status"><select name="status" defaultValue="ACTIVE" className={addSelectCls}>{PARTY_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}</select></Fld>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
                    <label className="flex items-center gap-2 text-[12px] text-[var(--color-text-secondary)]"><input type="checkbox" name="multiLocation" className="accent-[var(--color-vein)]" /> Multi-location customer</label>
                    <label className="flex items-center gap-2 text-[12px] text-[var(--color-text-secondary)]"><input type="checkbox" name="genericCustomer" className="accent-[var(--color-vein)]" /> Generic / walk-in customer</label>
                  </div>
                  <p className="text-[11px] text-[var(--color-fog-500)]">A Customer ID (C-###) is assigned automatically on save.</p>
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
                  <p className="text-[11px] text-[var(--color-fog-500)]">Provide at least one way to reach this customer (email or phone).</p>
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
                    <Fld label="Country"><select name="bill_country" defaultValue="United States" className={addSelectCls}><option value="">— Select —</option>{COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></Fld>
                  </div>
                </Sec>

                {/* 4 — Shipping Address */}
                <Sec title="Shipping Address">
                  <label className="flex items-center gap-2 text-[12px] text-[var(--color-text-secondary)]"><input type="checkbox" name="ship_copy" className="accent-[var(--color-vein)]" /> Same as bill-to address</label>
                  <Fld label="Street Address"><input name="ship_line1" placeholder="Street, building" className={addInputCls} /></Fld>
                  <Fld label="Address Line 2"><input name="ship_line2" placeholder="Suite, unit (optional)" className={addInputCls} /></Fld>
                  <div className="grid grid-cols-2 gap-4">
                    <Fld label="City"><input name="ship_city" placeholder="City" className={addInputCls} /></Fld>
                    <Fld label="State / Region"><input name="ship_region" placeholder="State / province" className={addInputCls} /></Fld>
                    <Fld label="ZIP / Postal"><input name="ship_postal" placeholder="ZIP / postal" className={addInputCls} /></Fld>
                    <Fld label="County"><input name="ship_county" placeholder="County" className={addInputCls} /></Fld>
                    <Fld label="Country"><select name="ship_country" defaultValue="United States" className={addSelectCls}><option value="">— Select —</option>{COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></Fld>
                  </div>
                </Sec>

                {/* 5 — Sales & Pricing */}
                <Sec title="Sales & Pricing">
                  <div className="grid grid-cols-2 gap-4">
                    <Fld label="Assigned Rep"><select name="assignedAssociateId" className={addSelectCls}><option value="">— Unassigned —</option>{associates.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Fld>
                    <Fld label="Price Tier"><select name="priceTier" className={addSelectCls}><option value="">—</option>{CUSTOMER_PRICE_TIERS.map((p) => <option key={p} value={p}>{p}</option>)}</select></Fld>
                    <Fld label="Payment Terms"><select name="terms" className={addSelectCls}><option value="">—</option>{PAYMENT_TERMS.map((p) => <option key={p} value={p}>{p}</option>)}</select></Fld>
                    <Fld label="Currency"><select name="currency" defaultValue="USD" className={addSelectCls}>{CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></Fld>
                    <Fld label="Default Fulfillment"><select name="defaultFulfillment" className={addSelectCls}><option value="">—</option>{FULFILLMENT_METHODS.map((f) => <option key={f} value={f}>{f}</option>)}</select></Fld>
                    <Fld label="How did you hear?"><input name="source" placeholder="e.g. Referral, Trade show" className={addInputCls} /></Fld>
                  </div>
                </Sec>

                {/* 6 — Tax & Compliance */}
                <Sec title="Tax & Compliance">
                  <div className="grid grid-cols-2 gap-4">
                    <Fld label="Tax ID / EIN"><input name="taxId" placeholder="Tax / EIN" className={addInputCls} /></Fld>
                    <Fld label="Sales Tax Code"><input name="salesTaxCode" placeholder="Tax jurisdiction code" className={addInputCls} /></Fld>
                    <Fld label="Exempt Reason"><select name="taxExemptReason" className={addSelectCls}><option value="">—</option>{TAX_EXEMPT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}</select></Fld>
                    <Fld label="Exempt Certificate #"><input name="resaleCertNumber" placeholder="If tax-exempt" className={addInputCls} /></Fld>
                    <Fld label="Exempt Expiry"><input name="exemptCertExpiry" type="date" className={addInputCls} /></Fld>
                  </div>
                  <label className="flex items-center gap-2 text-[12px] text-[var(--color-text-secondary)] pt-1"><input type="checkbox" name="taxExempt" className="accent-[var(--color-vein)]" /> Tax-exempt customer</label>
                </Sec>

                {/* 7 — Accounting Controls */}
                <Sec title="Accounting Controls">
                  <div className="grid grid-cols-2 gap-4">
                    <Fld label="Document Delivery"><select name="docDeliveryPref" className={addSelectCls}><option value="">—</option>{DOC_DELIVERY_METHODS.map((d) => <option key={d} value={d}>{d}</option>)}</select></Fld>
                    <Fld label="Customer Since"><input name="customerSince" type="date" className={addInputCls} /></Fld>
                    <Fld label="Grace Period (days)"><input name="gracePeriodDays" type="number" min="0" max="365" placeholder="e.g. 5" className={addInputCls} /></Fld>
                    <Fld label="Hold (days)"><input name="holdDays" type="number" min="0" max="365" placeholder="e.g. 30" className={addInputCls} /></Fld>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
                    <label className="flex items-center gap-2 text-[12px] text-[var(--color-text-secondary)]"><input type="checkbox" name="poRequired" className="accent-[var(--color-vein)]" /> Purchase order required</label>
                    <label className="flex items-center gap-2 text-[12px] text-[var(--color-text-secondary)]"><input type="checkbox" name="applyFinanceCharges" className="accent-[var(--color-vein)]" /> Apply finance charges</label>
                  </div>
                </Sec>

                {/* 8 — Credit Controls */}
                <Sec title="Credit Controls">
                  <div className="grid grid-cols-2 gap-4">
                    <Fld label="Credit Limit"><input name="creditLimit" type="number" min="0" placeholder="0" className={addInputCls} /></Fld>
                  </div>
                  <label className="flex items-center gap-2 text-[12px] text-[var(--color-text-secondary)]"><input type="checkbox" name="creditLockExempt" className="accent-[var(--color-vein)]" /> Exempt from credit lock</label>
                  <Fld label="Sales Alert Note"><textarea name="salesAlertNote" rows={2} placeholder="Shown to sales when quoting (optional)" className={`${addInputCls} resize-none`} /></Fld>
                  <Fld label="Sales Lock Note"><textarea name="salesLockNote" rows={2} placeholder="Reason orders are blocked (optional)" className={`${addInputCls} resize-none`} /></Fld>
                </Sec>

                {/* 9 — Notes & Instructions */}
                <Sec title="Notes & Instructions">
                  <Fld label="Delivery Instructions"><textarea name="deliveryInstructions" rows={2} placeholder="Site access, hours, equipment (optional)" className={`${addInputCls} resize-none`} /></Fld>
                  <Fld label="Collection Notes"><textarea name="collectionNotes" rows={2} placeholder="AR / collections context (optional)" className={`${addInputCls} resize-none`} /></Fld>
                  <Fld label="Internal Notes"><textarea name="notes" rows={2} placeholder="Internal notes (optional)" className={`${addInputCls} resize-none`} /></Fld>
                  <label className="flex items-center gap-2 text-[12px] text-[var(--color-text-secondary)]"><input type="checkbox" name="copyNotesToOrders" className="accent-[var(--color-vein)]" /> Copy notes to all orders</label>
                </Sec>
              </>)}

              {/* ASSOCIATE specifics */}
              {t === 'ASSOCIATE' && (
                <Sec title="Role & Compensation">
                  <div className="grid grid-cols-2 gap-4">
                    <Fld label="Role"><select name="role" className={addSelectCls}><option value="">—</option>{ASSOCIATE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select></Fld>
                    <Fld label="Base Location"><input name="location" placeholder="e.g. Maryland Hub" className={addInputCls} /></Fld>
                    <Fld label="Territory"><input name="territory" placeholder="e.g. Mid-Atlantic" className={addInputCls} /></Fld>
                    <Fld label="Employee ID"><input name="employeeId" placeholder="EMP-001" className={addInputCls} /></Fld>
                    <Fld label="Start Date"><input name="startDate" type="date" className={addInputCls} /></Fld>
                    <Fld label="Commission Rate"><input name="commissionRate" placeholder="e.g. 5%" className={addInputCls} /></Fld>
                    <Fld label="Annual Sales Target"><input name="salesTargetAnnual" type="number" min="0" placeholder="0" className={addInputCls} /></Fld>
                  </div>
                </Sec>
              )}

              {/* Login provisioning — quiet institutional callout */}
              {showLogin && (
                <Sec title="Portal access" hint={t === 'VENDOR' ? 'Optional vendor login for shipment visibility.' : 'Optional associate login for sales workspace.'}>
                  <div className="rounded-[var(--radius-md)] border border-[var(--color-basalt-500)] bg-[var(--color-basalt-900)]/60 p-3.5 space-y-3">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={provisionLogin}
                        onChange={(e) => setProvisionLogin(e.target.checked)}
                        className="accent-[var(--color-vein)] mt-0.5 shrink-0"
                      />
                      <span>
                        <span className="block text-[13px] text-white font-medium">Create portal login</span>
                        <span className="block text-[11px] text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
                          Issues a one-time temporary password after save. Share it out-of-band; it is not emailed.
                        </span>
                      </span>
                    </label>
                    {provisionLogin && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-[var(--color-basalt-500)]">
                        <Fld label="Login email">
                          <input
                            name="loginEmail"
                            type="email"
                            placeholder="Defaults to contact email"
                            className={addInputCls}
                            autoComplete="off"
                          />
                        </Fld>
                        <Fld label="Login role">
                          <select
                            name="loginRole"
                            defaultValue={t === 'VENDOR' ? 'VENDOR' : 'SALES'}
                            className={addSelectCls}
                          >
                            {LOGIN_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r === 'SALES' ? 'Sales' : r === 'VENDOR' ? 'Vendor' : r}
                              </option>
                            ))}
                          </select>
                        </Fld>
                        <p className="sm:col-span-2 text-[11px] text-[var(--color-fog-500)] flex items-start gap-1.5">
                          <Lock size={12} className="shrink-0 mt-0.5 text-[var(--color-vein)]" />
                          Password is shown once in a dialog after save — copy before closing.
                        </p>
                      </div>
                    )}
                  </div>
                </Sec>
              )}

              {/* Notes — customers capture notes in their own Notes & Instructions section */}
              {t !== 'CUSTOMER' && (
              <Sec title="Notes">
                <textarea name="notes" rows={2} placeholder="Internal notes (optional)" className={`${addInputCls} resize-none`} />
              </Sec>
              )}

              {actionError && (
                <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.25)] text-[var(--color-ruby)] text-[12px] px-3 py-2 rounded-[var(--radius-sm)]">
                  {actionError}
                </div>
              )}
          </form>
      </Drawer>
        );
      })()}

      <Modal
        open={!!tempPassword}
        onClose={() => setTempPassword(null)}
        title={
          <span className="flex items-center gap-2">
            <KeyRound size={18} className="text-[var(--color-vein)]" /> Portal login created
          </span>
        }
        subtitle="Copy it now — it will not be shown again and is not emailed."
        width={420}
        zIndex={70}
        footer={
          <Button variant="primary" className="w-full" onClick={() => setTempPassword(null)}>
            Done
          </Button>
        }
      >
        {tempPassword && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 bg-[var(--color-basalt-950)] border border-[rgba(227,193,108,0.3)] rounded-[var(--radius-md)] px-3 py-3">
              <code className="text-[15px] text-white bp-mono tracking-wide break-all">{tempPassword}</code>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(tempPassword);
                  toast('Password copied', 'success');
                }}
                className="btn-secondary !min-h-8 !px-2.5 text-[12px] shrink-0"
                title="Copy password"
              >
                <Copy size={14} /> Copy
              </button>
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
              Share over a secure channel. The user should change it after first sign-in.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Sec({
  title,
  children,
  hint,
}: {
  title: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <section className="space-y-3">
      <header className="border-b border-[var(--color-basalt-500)] pb-1.5">
        <h3 className="bp-section-title text-[var(--color-fog-500)]">{title}</h3>
        {hint && (
          <p className="text-[11px] text-[var(--color-fog-500)] mt-1 leading-relaxed">{hint}</p>
        )}
      </header>
      {children}
    </section>
  );
}

function Fld({ label, children, req }: { label: string; children: React.ReactNode; req?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[var(--color-text-secondary)] block text-[12px] font-medium">
        {label}
        {req && <span className="text-[var(--color-ruby)]"> *</span>}
      </label>
      {children}
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={right ? 'text-right' : undefined}>{children}</th>;
}
function EmptyRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="!py-12 text-center text-[var(--color-text-secondary)]">
        No records match your filters.
      </td>
    </tr>
  );
}
function Pill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return <span className="flex items-center gap-1.5 bg-[var(--color-basalt-700)] border border-[var(--color-basalt-500)] px-2.5 py-1 rounded-full text-[11px] text-white">{label}<X size={12} className="cursor-pointer hover:text-[var(--color-vein)] ml-1" onClick={onRemove} /></span>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="text-[11px] text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">{label}</p>{children}</div>;
}
function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return <div className="bg-[var(--color-basalt-700)] border border-[var(--color-basalt-500)] p-3 rounded-md"><p className="text-[11px] text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">{label}</p><p className="text-[14px] font-medium" style={{ color: color ?? '#ffffff' }}>{value}</p></div>;
}

// A titled detail section for the customer drill-down drawer; lays its fields out in a grid.
function DrawerSection({ title, children, cols = 3 }: { title: string; children: React.ReactNode; cols?: number }) {
  return (
    <div>
      <h3 className="text-[11px] uppercase tracking-wider text-[var(--color-text-secondary)] font-medium border-b border-[var(--color-basalt-500)] pb-1.5 mb-3">{title}</h3>
      <div className={`grid gap-x-6 gap-y-3 ${cols === 1 ? 'grid-cols-1' : 'grid-cols-3'}`}>{children}</div>
    </div>
  );
}
