'use client';

import React, { useState, useTransition, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Package,
  Plus,
  Ship,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  Printer,
  Link as LinkIcon,
  Download,
  GitCompare,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { Term } from '@/components/ui/Tooltip';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { ListToolbar, FilterChip } from '@/components/ui/ListToolbar';
import { EmptyState } from '@/components/ui/EmptyState';
import { LogisticsStageBar } from '@/components/logistics/LogisticsStageBar';
import { LOGISTICS_STATUS_LABEL } from '@/lib/domain/logistics-stages';
import type { PoRow, PoLogisticsStatus, PurchasingRefData, EtaStatus } from '@/server/purchasing/queries';
import { createPOAction, advancePOAction, approvePOAction } from '@/server/purchasing/actions';

type SlipTarget = 'SUPPLIER' | 'OCEAN' | 'CUSTOMS' | 'INLAND';

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null;

/** Date-driven delivery status badge shown on each PO row. */
function EtaBadge({ status, days }: { status: EtaStatus; days: number | null }) {
  if (status === 'RECEIVED' || status === 'NONE') return null;
  const map: Record<string, { cls: string; label: string }> = {
    ON_TRACK: { cls: 'text-[var(--color-emerald)] bg-[var(--color-emerald)]/10 border-[rgba(16,185,129,0.20)]', label: `On track · ${days}d` },
    DUE_SOON: { cls: 'text-[var(--color-vein)] bg-[var(--color-vein)]/10 border-[rgba(227,193,108,0.20)]', label: days === 0 ? 'Due today' : `Due in ${days}d` },
    OVERDUE: { cls: 'text-[var(--color-ruby)] bg-[rgba(239,68,68,0.1)] border-[rgba(239,68,68,0.2)]', label: `Overdue ${Math.abs(days ?? 0)}d` },
  };
  const m = map[status];
  if (!m) return null;
  return (
    <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${m.cls}`}>
      {m.label}
    </span>
  );
}



export default function PurchasesDashboardClient({
  purchaseOrders,
  suppliers,
  vendors,
  materials,
  nextPoNumber,
  poApprovalThreshold,
  openReconciliationCaseByPoId = {},
}: {
  purchaseOrders: PoRow[];
  poApprovalThreshold: number | null;
  /** PO id -> open ReconciliationCase id, for the discrepancy badge on each row. */
  openReconciliationCaseByPoId?: Record<string, string>;
} & PurchasingRefData) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { confirm, confirmDialog } = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<PoLogisticsStatus | 'ALL' | 'ACTIVE'>('ALL');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [verifyModalOpen, setVerifyModalOpen] = useState<{ isOpen: boolean; poId: string | null }>({ isOpen: false, poId: null });
  const [verifyDocRef, setVerifyDocRef] = useState('');
  const [viewerModalOpen, setViewerModalOpen] = useState<{ isOpen: boolean; poId: string | null }>({ isOpen: false, poId: null });
  const [slipTarget, setSlipTarget] = useState<SlipTarget>('SUPPLIER');

  // Deep-link: /purchases?po=<poNumber|id> opens the packing-slip viewer.
  // Also honors ?status=ACTIVE|PRODUCTION|… from Logistics.
  useEffect(() => {
    const wanted = searchParams.get('po');
    const status = searchParams.get('status');
    const t = setTimeout(() => {
      if (status) {
        const s = status.toUpperCase();
        if (s === 'ACTIVE' || s === 'ALL') setStatusFilter(s as 'ACTIVE' | 'ALL');
        else if (['PRODUCTION', 'ON_WATER', 'CUSTOMS', 'INLAND_TRANSIT', 'RECEIVED'].includes(s)) {
          setStatusFilter(s as PoLogisticsStatus);
        }
      }
      if (!wanted) return;
      const match = purchaseOrders.find(
        (p) => p.id === wanted || p.poNumber.toLowerCase() === wanted.toLowerCase(),
      );
      if (!match) return;
      setSearchTerm(match.poNumber);
      setSlipTarget('SUPPLIER');
      setViewerModalOpen({ isOpen: true, poId: match.id });
    }, 0);
    return () => clearTimeout(t);
  }, [searchParams, purchaseOrders]);

  // New PO form state
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [orderedSlabs, setOrderedSlabs] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [selectedOceanId, setSelectedOceanId] = useState('');
  const [selectedInlandId, setSelectedInlandId] = useState('');
  const [selectedCustomsId, setSelectedCustomsId] = useState('');
  const [oceanCost, setOceanCost] = useState('');
  const [customsCost, setCustomsCost] = useState('');
  const [inlandCost, setInlandCost] = useState('');
  const [selectedDestination, setSelectedDestination] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState('');
  const [isOceanCovered, setIsOceanCovered] = useState(false);
  const [isCustomsCovered, setIsCustomsCovered] = useState(false);
  const [isInlandCovered, setIsInlandCovered] = useState(false);

  const resetForm = () => {
    setSelectedSupplierId('');
    setSelectedMaterialId('');
    setOrderedSlabs('');
    setUnitCost('');
    setSelectedOceanId('');
    setSelectedInlandId('');
    setSelectedCustomsId('');
    setOceanCost('');
    setCustomsCost('');
    setInlandCost('');
    setSelectedDestination('');
    setEstimatedDelivery('');
    setIsOceanCovered(false);
    setIsCustomsCovered(false);
    setIsInlandCovered(false);
    setFormError('');
  };

  const handleSupplierChange = (supplierId: string) => {
    setSelectedSupplierId(supplierId);
    const supplier = suppliers.find((s) => s.id === supplierId);
    if (!supplier) return;
    const terms = (supplier.incoterms ?? '').toUpperCase();
    if (terms.includes('DDP')) {
      setIsOceanCovered(true); setIsCustomsCovered(true); setIsInlandCovered(true);
      setSelectedOceanId('SUPPLIER_COVERED'); setSelectedCustomsId('SUPPLIER_COVERED'); setSelectedInlandId('SUPPLIER_COVERED');
      setOceanCost(''); setCustomsCost(''); setInlandCost('');
    } else if (terms.includes('CIF')) {
      setIsOceanCovered(true); setIsCustomsCovered(false); setIsInlandCovered(false);
      setSelectedOceanId('SUPPLIER_COVERED'); setSelectedCustomsId(''); setSelectedInlandId('');
      setOceanCost('');
    } else {
      setIsOceanCovered(false); setIsCustomsCovered(false); setIsInlandCovered(false);
      setSelectedOceanId(''); setSelectedCustomsId(''); setSelectedInlandId('');
    }
  };

  const q = searchTerm.trim().toLowerCase();
  const filteredPOs = purchaseOrders.filter((po) => {
    const matchSearch =
      !q ||
      po.poNumber.toLowerCase().includes(q) ||
      po.supplierName.toLowerCase().includes(q) ||
      po.materialName.toLowerCase().includes(q);
    const matchStatus =
      statusFilter === 'ALL'
        ? true
        : statusFilter === 'ACTIVE'
          ? po.status !== 'RECEIVED'
          : po.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const countBy = (pred: (p: PoRow) => boolean) => purchaseOrders.filter(pred).length;
  const clearPoFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
  };

  const handleCreatePO = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    startTransition(async () => {
      const res = await createPOAction({
        supplierId: selectedSupplierId,
        materialId: selectedMaterialId,
        orderedSlabs: parseInt(orderedSlabs, 10),
        unitCost: parseFloat(unitCost),
        oceanVendorId: selectedOceanId || undefined,
        customsVendorId: selectedCustomsId || undefined,
        inlandVendorId: selectedInlandId || undefined,
        oceanCost: oceanCost ? parseFloat(oceanCost) : undefined,
        customsCost: customsCost ? parseFloat(customsCost) : undefined,
        inlandCost: inlandCost ? parseFloat(inlandCost) : undefined,
        destinationHub: selectedDestination,
        estimatedDelivery,
      });
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      setIsCreateModalOpen(false);
      resetForm();
      router.refresh();
    });
  };

  const handleVerifyStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyModalOpen.poId) return;
    startTransition(async () => {
      const res = await advancePOAction(verifyModalOpen.poId!, verifyDocRef || undefined);
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      setVerifyModalOpen({ isOpen: false, poId: null });
      setVerifyDocRef('');
      router.refresh();
    });
  };

  const handleApprove = async (po: PoRow) => {
    const ok = await confirm({
      title: `Approve ${po.poNumber}?`,
      message: `This PO is above the approval threshold. Approving lets it start moving through logistics.`,
      confirmLabel: 'Approve',
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await approvePOAction(po.id);
      if (!res.ok) {
        toast(res.error, 'error');
        return;
      }
      toast(`${po.poNumber} approved.`, 'success');
      router.refresh();
    });
  };

  const viewerPo = viewerModalOpen.poId ? purchaseOrders.find((p) => p.id === viewerModalOpen.poId) : null;

  const vendorName = (id: string | null) =>
    id && id !== 'SUPPLIER_COVERED' ? vendors.find((v) => v.id === id)?.name ?? 'Vendor' : '—';

  // Each engaged counterparty in the pipeline gets its own targeted slip.
  const slipTargets: { key: SlipTarget; tab: string }[] = viewerPo
    ? [
        { key: 'SUPPLIER', tab: 'Supplier PO' },
        ...(viewerPo.oceanVendorId && viewerPo.oceanVendorId !== 'SUPPLIER_COVERED' ? [{ key: 'OCEAN' as SlipTarget, tab: 'Ocean Freight' }] : []),
        ...(viewerPo.customsVendorId && viewerPo.customsVendorId !== 'SUPPLIER_COVERED' ? [{ key: 'CUSTOMS' as SlipTarget, tab: 'Customs Broker' }] : []),
        ...(viewerPo.inlandVendorId && viewerPo.inlandVendorId !== 'SUPPLIER_COVERED' ? [{ key: 'INLAND' as SlipTarget, tab: 'Inland Delivery' }] : []),
      ]
    : [];
  const activeTarget: SlipTarget = slipTargets.some((t) => t.key === slipTarget) ? slipTarget : 'SUPPLIER';

  function buildSlip(po: PoRow, target: SlipTarget) {
    const total = po.orderedSlabs * po.unitCost;
    const dest = po.destinationHub ?? 'Destination Hub';
    const container = po.containerId ?? 'Pending Allocation';
    const eta = fmtDate(po.estimatedDelivery) ?? po.eta ?? 'TBD';
    switch (target) {
      case 'OCEAN':
        return {
          title: 'OCEAN FREIGHT BOOKING', suffix: 'OF', leg: 'Ocean Freight',
          role: 'Ocean Freight Carrier', name: vendorName(po.oceanVendorId), id: po.oceanVendorId ?? '—',
          rows: [{ item: `Ocean carriage — ${po.materialName}`, qty: `1 container · ${po.orderedSlabs} slabs`, unit: container, value: (po.oceanCost || null) as number | null }],
          note: `Book ocean carriage for container ${container} from supplier origin to ${dest}. Issue the Bill of Lading and confirm ETA (${eta}).`,
        };
      case 'CUSTOMS':
        return {
          title: 'CUSTOMS CLEARANCE INSTRUCTION', suffix: 'CB', leg: 'Customs Broker',
          role: 'Customs Broker', name: vendorName(po.customsVendorId), id: po.customsVendorId ?? '—',
          rows: [{ item: `Customs entry — ${po.materialName}`, qty: `Container ${container}`, unit: 'Dimensional stone', value: po.customsCost || null }],
          note: `Clear inbound shipment ${container} at the port of entry, assess duties, and release for inland transit to ${dest}.`,
        };
      case 'INLAND':
        return {
          title: 'INLAND DELIVERY ORDER', suffix: 'IL', leg: 'Inland Trucking',
          role: 'Inland Carrier', name: vendorName(po.inlandVendorId), id: po.inlandVendorId ?? '—',
          rows: [{ item: `Drayage to ${dest}`, qty: `Container ${container}`, unit: `${po.orderedSlabs} slabs`, value: po.inlandCost || null }],
          note: `Collect container ${container} from the port and deliver to ${dest}. Confirm receipt with the warehouse team.`,
        };
      default:
        return {
          title: 'PURCHASE ORDER', suffix: 'S', leg: 'Supplier (Origin)',
          role: 'Supplier', name: po.supplierName, id: po.supplierId,
          rows: [{ item: po.materialName, qty: `${po.orderedSlabs} slabs`, unit: `$${po.unitCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, value: total }],
          note: `Supply and prepare ${po.orderedSlabs} slabs of ${po.materialName} for FOB handover per agreed incoterms.`,
        };
    }
  }
  const slip = viewerPo ? buildSlip(viewerPo, activeTarget) : null;

  const activeCount = countBy((p) => p.status !== 'RECEIVED');

  return (
    <PageShell
      flush
      header={
        <PageHeader
          eyebrow="Inventory"
          title="Purchasing"
          subtitle="Track inbound shipments, manage supplier POs, and receive containers to restock inventory."
          meta={[
            { label: `${purchaseOrders.length} POs`, tone: 'neutral' },
            { label: `${activeCount} in transit`, tone: activeCount > 0 ? 'gold' : 'green' },
          ]}
          actions={
            <div className="flex items-center gap-2">
              <Link
                href="/logistics"
                className="hidden sm:inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text-secondary)] hover:text-white border border-[var(--color-basalt-500)] rounded-lg px-2.5 py-1.5 transition-colors"
              >
                <Truck size={13} /> Logistics tracker
              </Link>
              <Button
                type="button"
                onClick={() => { setIsCreateModalOpen(true); setFormError(''); }}
              >
                <Plus size={16} /> Create PO
              </Button>
            </div>
          }
        >
          <ListToolbar
            search={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Search POs, suppliers, or materials…"
            resultCount={filteredPOs.length}
            totalCount={purchaseOrders.length}
            onClear={searchTerm || statusFilter !== 'ALL' ? clearPoFilters : undefined}
            clearLabel="Reset filters"
            filters={
              <div className="flex items-center gap-1.5 flex-wrap">
                <FilterChip active={statusFilter === 'ALL'} onClick={() => setStatusFilter('ALL')} count={purchaseOrders.length}>
                  All
                </FilterChip>
                <FilterChip active={statusFilter === 'ACTIVE'} onClick={() => setStatusFilter('ACTIVE')} count={activeCount}>
                  In transit
                </FilterChip>
                <FilterChip active={statusFilter === 'PRODUCTION'} onClick={() => setStatusFilter('PRODUCTION')} count={countBy((p) => p.status === 'PRODUCTION')}>
                  Production
                </FilterChip>
                <FilterChip active={statusFilter === 'ON_WATER'} onClick={() => setStatusFilter('ON_WATER')} count={countBy((p) => p.status === 'ON_WATER')}>
                  Ocean
                </FilterChip>
                <FilterChip active={statusFilter === 'RECEIVED'} onClick={() => setStatusFilter('RECEIVED')} count={countBy((p) => p.status === 'RECEIVED')}>
                  Received
                </FilterChip>
              </div>
            }
          />
        </PageHeader>
      }
    >
      <div className="p-6">
        <div className="bp-table-shell">
          <table className="bp-table">
            <thead>
              <tr>
                <th>PO Number</th>
                <th>Supplier</th>
                <th>Material</th>
                <th className="text-right">Quantity</th>
                <th className="text-right">Unit Cost</th>
                <th><Term k="eta">Est. Delivery</Term> / <Term k="container">Container</Term></th>
                <th>Status</th>
                <th className="text-center">Logistics Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPOs.map((po) => {
                const totalValue = po.orderedSlabs * po.unitCost;
                return (
                  <React.Fragment key={po.id}>
                    <tr>
                      <td>
                        <div className="flex items-center gap-2 mb-1">
                          <FileText size={14} className="text-[var(--color-text-secondary)]" />
                          <button
                            onClick={() => { setSlipTarget('SUPPLIER'); setViewerModalOpen({ isOpen: true, poId: po.id }); }}
                            className="bp-id hover:text-[var(--color-sodalite)] hover:underline transition-colors cursor-pointer"
                          >
                            {po.poNumber}
                          </button>
                          {openReconciliationCaseByPoId[po.id] && (
                            <Link
                              href={`/purchases/reconciliation/${openReconciliationCaseByPoId[po.id]}`}
                              title="Supplier email discrepancy awaiting review"
                              className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-[var(--color-vein)] bg-[rgba(227,193,108,0.12)] border border-[rgba(227,193,108,0.3)] px-1.5 py-0.5 rounded hover:bg-[rgba(227,193,108,0.2)] transition-colors"
                            >
                              <GitCompare size={11} /> Discrepancy
                            </Link>
                          )}
                        </div>
                        {po.documentRefs.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {po.documentRefs.map((doc, i) => (
                              <span key={i} className="text-[9px] bg-[rgba(146,176,206,0.10)] text-[var(--color-sodalite)] border border-[rgba(146,176,206,0.20)] px-1.5 py-0.5 rounded flex items-center gap-1">
                                📎 {doc}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-3 font-medium text-white">{po.supplierName}</td>
                      <td className="p-3">{po.materialName}</td>
                      <td className="p-3 text-right text-white font-medium">{po.orderedSlabs} slabs</td>
                      <td className="p-3 text-right">
                        <span className="text-[var(--color-vein)]">${po.unitCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        <div className="text-[11px] text-[var(--color-text-secondary)]">Total: ${totalValue.toLocaleString()}</div>
                      </td>
                      <td className="p-3">
                        <div className="text-white">{fmtDate(po.estimatedDelivery) ?? po.eta ?? 'TBD'}</div>
                        {po.containerId && <div className="text-[11px] font-mono text-[var(--color-sodalite)]">{po.containerId}</div>}
                        <div><EtaBadge status={po.etaStatus} days={po.daysToEta} /></div>
                        {po.status === 'RECEIVED' && po.receiptNumber && (
                          <div className="text-[10px] text-[var(--color-emerald)] mt-1 flex items-center gap-1">
                            <Term k="receipt">Receipt</Term>: <span className="font-mono">{po.receiptNumber}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1 items-start">
                          {po.approvalStatus === 'PENDING_APPROVAL' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded border border-[rgba(227,193,108,0.35)] bg-[rgba(227,193,108,0.10)] text-[var(--color-vein)]">
                              Pending Approval
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded border border-[var(--color-basalt-500)] bg-[var(--color-basalt-800)] text-[var(--color-text-muted)]">
                            {LOGISTICS_STATUS_LABEL[po.status]}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex flex-col items-center gap-1.5">
                          {po.approvalStatus === 'PENDING_APPROVAL' ? (
                            <Button
                              type="button"
                              onClick={() => handleApprove(po)}
                              disabled={isPending}
                              variant="secondary"
                              className="!min-h-7 !px-2.5 text-[11px]"
                            >
                              Approve
                            </Button>
                          ) : po.status !== 'RECEIVED' ? (
                            <Button
                              type="button"
                              onClick={() => { setVerifyModalOpen({ isOpen: true, poId: po.id }); setFormError(''); }}
                              className="!min-h-7 !px-2.5 text-[11px]"
                            >
                              Verify step
                            </Button>
                          ) : (
                            <span className="text-[11px] text-[var(--color-text-secondary)] italic">Completed</span>
                          )}
                          {po.approvalStatus !== 'PENDING_APPROVAL' && po.status !== 'RECEIVED' && (
                            <Link
                              href={`/logistics#${encodeURIComponent(po.poNumber)}`}
                              className="text-[10px] text-[var(--color-sodalite)] hover:text-white transition-colors"
                            >
                              Open in tracker →
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                    <tr className="border-b border-[var(--color-basalt-500)] bg-[#222123]">
                      <td colSpan={8} className="px-6 pt-1 pb-4">
                        <LogisticsStageBar status={po.status} variant="full" />
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
              {filteredPOs.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-4">
                    <EmptyState
                      icon={Package}
                      title={purchaseOrders.length === 0 ? 'No purchase orders yet' : 'No POs match your filters'}
                      hint={
                        purchaseOrders.length === 0
                          ? 'Create a PO to start tracking slabs from quarry to warehouse.'
                          : 'Try another status chip or clear search.'
                      }
                      action={
                        purchaseOrders.length === 0 ? (
                          <Button
                            type="button"
                            onClick={() => { setIsCreateModalOpen(true); setFormError(''); }}
                          >
                            <Plus size={14} /> Create PO
                          </Button>
                        ) : (
                          <Button type="button" onClick={clearPoFilters} variant="ghost">
                            Reset filters
                          </Button>
                        )
                      }
                      className="py-10"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create PO Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
          <div className="bg-[var(--color-basalt-800)] border border-[var(--color-basalt-500)] rounded-lg w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--color-basalt-500)] bg-[var(--color-basalt-900)] flex justify-between items-center">
              <div>
                <h3 className="text-white font-medium">Create Purchase Order</h3>
                <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                  Will be issued as{' '}
                  <span className="font-mono text-[var(--color-vein)]">{nextPoNumber}</span>
                  {' '}— <Term k="poNumber">standard PO-[Year]-[Sequence]</Term>
                </p>
              </div>
              <button onClick={() => { setIsCreateModalOpen(false); resetForm(); }} className="text-[var(--color-text-secondary)] hover:text-white transition-colors">
                <XCircle size={18} />
              </button>
            </div>
            <form onSubmit={handleCreatePO} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1.5">Supplier</label>
                  <select required value={selectedSupplierId} onChange={(e) => handleSupplierChange(e.target.value)} className="w-full bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[var(--color-sodalite)]">
                    <option value="" disabled>Select supplier...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}{s.incoterms ? ` (${s.incoterms})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1.5">Material to Order</label>
                  <select required value={selectedMaterialId} onChange={(e) => setSelectedMaterialId(e.target.value)} className="w-full bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[var(--color-sodalite)]">
                    <option value="" disabled>Select material...</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>{m.name} ({m.type})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-[12px] text-[var(--color-text-secondary)] font-medium whitespace-nowrap">Ocean Freight Line</label>
                    <label className="flex items-center gap-1.5 text-[11px] text-[var(--color-sodalite)] cursor-pointer hover:text-white transition-colors">
                      <input type="checkbox" checked={isOceanCovered} onChange={(e) => { setIsOceanCovered(e.target.checked); setSelectedOceanId(e.target.checked ? 'SUPPLIER_COVERED' : ''); }} className="accent-[#92b0ce]" />
                      Supplier Covers
                    </label>
                  </div>
                  <select required disabled={isOceanCovered} value={selectedOceanId} onChange={(e) => setSelectedOceanId(e.target.value)} className="w-full bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[var(--color-sodalite)] disabled:opacity-50">
                    {isOceanCovered ? <option value="SUPPLIER_COVERED">Handled by Supplier</option> : <option value="" disabled>Select shipping line...</option>}
                    {vendors.filter((v) => v.service === 'Ocean Freight').map((v) => (<option key={v.id} value={v.id}>{v.name}</option>))}
                  </select>
                  {isOceanCovered ? (
                    <p className="text-[11px] text-[var(--color-text-secondary)] mt-1.5">Cost rolled into the supplier&apos;s price.</p>
                  ) : (
                    <input type="number" required min="0.01" step="0.01" value={oceanCost} onChange={(e) => setOceanCost(e.target.value)} placeholder="Ocean freight price (total $)" className="mt-2 w-full bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[var(--color-sodalite)]" />
                  )}
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-[12px] text-[var(--color-text-secondary)] font-medium whitespace-nowrap">Customs Broker</label>
                    <label className="flex items-center gap-1.5 text-[11px] text-[var(--color-sodalite)] cursor-pointer hover:text-white transition-colors">
                      <input type="checkbox" checked={isCustomsCovered} onChange={(e) => { setIsCustomsCovered(e.target.checked); setSelectedCustomsId(e.target.checked ? 'SUPPLIER_COVERED' : ''); }} className="accent-[#92b0ce]" />
                      Supplier Covers
                    </label>
                  </div>
                  <select required disabled={isCustomsCovered} value={selectedCustomsId} onChange={(e) => setSelectedCustomsId(e.target.value)} className="w-full bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[var(--color-sodalite)] disabled:opacity-50">
                    {isCustomsCovered ? <option value="SUPPLIER_COVERED">Handled by Supplier</option> : <option value="" disabled>Select broker...</option>}
                    {vendors.filter((v) => v.service === 'Customs & Tariffs').map((v) => (<option key={v.id} value={v.id}>{v.name}</option>))}
                  </select>
                  {isCustomsCovered ? (
                    <p className="text-[11px] text-[var(--color-text-secondary)] mt-1.5">Cost rolled into the supplier&apos;s price.</p>
                  ) : (
                    <input type="number" required min="0.01" step="0.01" value={customsCost} onChange={(e) => setCustomsCost(e.target.value)} placeholder="Customs brokerage price (total $)" className="mt-2 w-full bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[var(--color-sodalite)]" />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-[12px] text-[var(--color-text-secondary)] font-medium whitespace-nowrap">Inland Trucking</label>
                    <label className="flex items-center gap-1.5 text-[11px] text-[var(--color-sodalite)] cursor-pointer hover:text-white transition-colors">
                      <input type="checkbox" checked={isInlandCovered} onChange={(e) => { setIsInlandCovered(e.target.checked); setSelectedInlandId(e.target.checked ? 'SUPPLIER_COVERED' : ''); }} className="accent-[#92b0ce]" />
                      Supplier Covers
                    </label>
                  </div>
                  <select required disabled={isInlandCovered} value={selectedInlandId} onChange={(e) => setSelectedInlandId(e.target.value)} className="w-full bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[var(--color-sodalite)] disabled:opacity-50">
                    {isInlandCovered ? <option value="SUPPLIER_COVERED">Handled by Supplier</option> : <option value="" disabled>Select trucking co...</option>}
                    {vendors.filter((v) => v.service === 'Inland Logistics').map((v) => (<option key={v.id} value={v.id}>{v.name}</option>))}
                  </select>
                  {isInlandCovered ? (
                    <p className="text-[11px] text-[var(--color-text-secondary)] mt-1.5">Cost rolled into the supplier&apos;s price.</p>
                  ) : (
                    <input type="number" required min="0.01" step="0.01" value={inlandCost} onChange={(e) => setInlandCost(e.target.value)} placeholder="Inland trucking price (total $)" className="mt-2 w-full bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[var(--color-sodalite)]" />
                  )}
                </div>
                <div>
                  <label className="block text-[12px] text-[var(--color-text-secondary)] mb-2 font-medium">Destination Hub</label>
                  <select required value={selectedDestination} onChange={(e) => setSelectedDestination(e.target.value)} className="w-full bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[var(--color-sodalite)]">
                    <option value="" disabled>Select hub...</option>
                    <option value="Maryland Hub">Maryland Hub (HQ)</option>
                    <option value="Boston HQ">Boston Branch</option>
                    <option value="New Jersey HQ">New Jersey Hub</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[12px] text-[var(--color-text-secondary)] mb-2 font-medium">Slabs Quantity</label>
                  <input type="number" required min="1" value={orderedSlabs} onChange={(e) => setOrderedSlabs(e.target.value)} className="w-full bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[var(--color-sodalite)]" placeholder="e.g. 80" />
                </div>
                <div>
                  <label className="block text-[12px] text-[var(--color-text-secondary)] mb-2 font-medium">Negotiated Cost ($/sqft)</label>
                  <input type="number" required step="0.01" min="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className="w-full bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[var(--color-sodalite)]" placeholder="e.g. 45.00" />
                </div>
              </div>

              {(() => {
                const slabs = parseInt(orderedSlabs || '0', 10);
                const uc = parseFloat(unitCost || '0');
                if (!(slabs > 0 && uc > 0)) return null;
                const estSf = slabs * 63.5;
                const material = estSf * uc;
                const freight = (parseFloat(oceanCost || '0') || 0) + (parseFloat(customsCost || '0') || 0) + (parseFloat(inlandCost || '0') || 0);
                const landed = material + freight;
                const fmt = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                return (
                  <div className="bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded p-3 text-[12px]">
                    <p className="text-[11px] text-[var(--color-text-secondary)] uppercase tracking-wider font-bold mb-2">Cost roll-up (≈{estSf.toLocaleString()} sf)</p>
                    <div className="grid grid-cols-2 gap-y-1">
                      <span className="text-[var(--color-text-secondary)]"><Term k="fob">Material (FOB)</Term></span><span className="text-right text-white">{fmt(material)}</span>
                      <span className="text-[var(--color-text-secondary)]">Ocean freight</span><span className="text-right text-white">{fmt(parseFloat(oceanCost || '0') || 0)}</span>
                      <span className="text-[var(--color-text-secondary)]">Customs</span><span className="text-right text-white">{fmt(parseFloat(customsCost || '0') || 0)}</span>
                      <span className="text-[var(--color-text-secondary)]">Inland</span><span className="text-right text-white">{fmt(parseFloat(inlandCost || '0') || 0)}</span>
                      <span className="text-white font-medium border-t border-[var(--color-basalt-500)] pt-1 mt-1"><Term k="landedCost">Est. Landed</Term></span>
                      <span className="text-right text-[var(--color-vein)] font-medium border-t border-[var(--color-basalt-500)] pt-1 mt-1">{fmt(landed)} <span className="text-[var(--color-text-secondary)] font-normal">({fmt(landed / estSf)}/sf)</span></span>
                    </div>
                    {poApprovalThreshold != null && landed > poApprovalThreshold && (
                      <p className="mt-2 pt-2 border-t border-[rgba(227,193,108,0.25)] text-[11px] text-[var(--color-vein)]">
                        Above the {fmt(poApprovalThreshold)} approval threshold — this PO will require admin approval before it can proceed.
                      </p>
                    )}
                  </div>
                );
              })()}

              <div className="border-t border-[var(--color-basalt-500)] pt-4">
                <label className="block text-[12px] text-[var(--color-text-secondary)] mb-2 font-medium">
                  <Term k="eta">Estimated Delivery Date</Term> — when do you expect this at the hub?
                </label>
                <input
                  type="date"
                  required
                  value={estimatedDelivery}
                  onChange={(e) => setEstimatedDelivery(e.target.value)}
                  className="w-full bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[var(--color-sodalite)] [color-scheme:dark]"
                />
                <p className="text-[11px] text-[var(--color-text-secondary)] mt-1.5">
                  The dashboard tracks each PO against this date — flagging it on track, due soon, or overdue.
                </p>
              </div>

              {formError && (
                <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[var(--color-ruby)] text-[12px] px-3 py-2 rounded">{formError}</div>
              )}

              <div className="pt-4 mt-2 border-t border-[var(--color-basalt-500)] flex justify-end gap-3">
                <Button type="button" onClick={() => { setIsCreateModalOpen(false); resetForm(); }} variant="ghost">Cancel</Button>
                <Button type="submit" disabled={isPending}>{isPending ? 'Issuing…' : 'Issue PO'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Verify Step Modal */}
      {verifyModalOpen.isOpen && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
          <div className="bg-[var(--color-basalt-800)] border border-[var(--color-basalt-500)] rounded-lg w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--color-basalt-500)] bg-[var(--color-basalt-900)] flex justify-between items-center">
              <h3 className="text-white font-medium">Verify Logistics Step</h3>
              <button onClick={() => setVerifyModalOpen({ isOpen: false, poId: null })} className="text-[var(--color-text-secondary)] hover:text-white transition-colors"><XCircle size={18} /></button>
            </div>
            <form onSubmit={handleVerifyStep} className="p-6 space-y-4">
              {(() => {
                const po = purchaseOrders.find((p) => p.id === verifyModalOpen.poId);
                if (!po) return null;
                const resolveVendor = (id: string | null) =>
                  id === 'SUPPLIER_COVERED' ? `Supplier (${po.supplierName})` : (vendors.find((v) => v.id === id)?.name ?? 'Vendor');
                let currentLeg = '', vendorName = '', docType = 'Document';
                if (po.status === 'PRODUCTION') { currentLeg = 'Ocean Freight Booking'; vendorName = resolveVendor(po.oceanVendorId); docType = 'Bill of Lading / Booking Ref'; }
                else if (po.status === 'ON_WATER') { currentLeg = 'Customs Clearance'; vendorName = resolveVendor(po.customsVendorId); docType = 'Customs Release Form'; }
                else if (po.status === 'CUSTOMS') { currentLeg = 'Inland Trucking'; vendorName = resolveVendor(po.inlandVendorId); docType = 'Delivery Order / BOL'; }
                else if (po.status === 'INLAND_TRANSIT') { currentLeg = 'Destination Hub Receipt'; vendorName = 'Warehouse Team'; docType = 'Goods Receipt'; }
                const isFinal = po.status === 'INLAND_TRANSIT';
                return (
                  <div>
                    <div className="bg-[var(--color-basalt-900)] border border-[rgba(146,176,206,0.30)] p-3 rounded mb-4">
                      <p className="text-[12px] text-[var(--color-sodalite)] mb-1 uppercase tracking-wider font-bold">Current Verification Target</p>
                      <p className="text-[14px] text-white">Verifying <span className="font-bold">{currentLeg}</span> completion by <span className="text-[var(--color-vein)]">{vendorName}</span>.</p>
                    </div>
                    <p className="text-[13px] text-[var(--color-text-secondary)] mb-4">
                      Advance this PO to the next stage. {isFinal ? 'Receiving this container will restock the ordered slabs into inventory.' : 'You can optionally attach a reference number.'}
                    </p>
                    <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1.5">
                      {isFinal ? <><Term k="receipt">Goods Receipt Number</Term> (stored for future lookup)</> : `${docType} Number (Optional)`}
                    </label>
                    <input type="text" value={verifyDocRef} onChange={(e) => setVerifyDocRef(e.target.value)} className="w-full bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[var(--color-sodalite)]" placeholder={`e.g. ${docType.split(' ')[0].toUpperCase()}-884920`} />
                    {isFinal && (
                      <p className="text-[11px] text-[var(--color-text-secondary)] mt-1.5">Paperwork stays offline — only this reference number is saved, so the shipment can be searched later.</p>
                    )}
                  </div>
                );
              })()}

              {formError && (
                <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[var(--color-ruby)] text-[12px] px-3 py-2 rounded">{formError}</div>
              )}

              <div className="pt-4 mt-2 border-t border-[var(--color-basalt-500)] flex justify-end gap-3">
                <button type="button" onClick={() => setVerifyModalOpen({ isOpen: false, poId: null })} className="px-4 py-2 text-[13px] text-[var(--color-text-secondary)] hover:text-white transition-colors">Cancel</button>
                <button type="submit" disabled={isPending} className="px-4 py-2 text-[13px] bg-[var(--color-emerald)] text-white font-medium rounded hover:bg-[color-mix(in_srgb,var(--color-emerald)_85%,black)] transition-colors disabled:opacity-60">{isPending ? 'Advancing…' : 'Verify & Advance'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PO packing slip — light paper document for print (DESIGN.md Phase E) */}
      {viewerModalOpen.isOpen && viewerPo && slip && (
        <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4 print:p-0 print:bg-white print:static">
          <div className="bp-print-slip bg-[#faf9f7] text-[#1a1918] border border-[#d4d0c8] w-full max-w-3xl h-[85vh] shadow-2xl flex flex-col relative overflow-hidden print:h-auto print:max-w-none print:border-0 print:shadow-none">
            <button
              onClick={() => setViewerModalOpen({ isOpen: false, poId: null })}
              className="absolute top-4 right-4 text-[#7a7874] hover:text-[#1a1918] transition-colors print:hidden z-10"
              aria-label="Close slip"
            >
              <XCircle size={22} />
            </button>

            <div className="bg-[#f0eeea] border-b border-[#d4d0c8] px-6 py-3 flex items-center gap-2 print:hidden">
              <span className="text-[10px] font-semibold text-[#7a7874] uppercase tracking-[0.12em] mr-1">
                Generate slip for
              </span>
              {slipTargets.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setSlipTarget(t.key)}
                  className={`text-[11px] font-medium px-3 py-1.5 rounded-full border transition-colors ${
                    activeTarget === t.key
                      ? 'bg-[#1a1918] text-white border-[#1a1918]'
                      : 'bg-white text-[#5a5650] border-[#d4d0c8] hover:bg-[#f0eeea]'
                  }`}
                >
                  {t.tab}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-10 print:p-8">
              <div className="border-b border-[#1a1918] pb-6 mb-8 flex justify-between items-end gap-6">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8a7a50] mb-2">
                    BluePlanet · Procurement
                  </p>
                  <h1
                    className="text-[28px] font-medium tracking-tight text-[#1a1918] mb-2 leading-tight"
                    style={{ fontFamily: 'var(--font-heading), Georgia, serif' }}
                  >
                    {slip.title}
                  </h1>
                  <p className="text-[12px] text-[#5a5650] font-mono">
                    DOC NO:{' '}
                    <span className="font-semibold text-[#1a1918]">
                      {viewerPo.poNumber}-{slip.suffix}
                    </span>
                  </p>
                  <p className="text-[12px] text-[#5a5650] font-mono mt-0.5">
                    ISSUED:{' '}
                    <span className="font-semibold text-[#1a1918]">
                      {viewerPo.issuedAt
                        ? new Date(viewerPo.issuedAt).toLocaleString()
                        : 'Just now'}
                    </span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <h2
                    className="text-[18px] font-medium text-[#1a1918]"
                    style={{ fontFamily: 'var(--font-heading), Georgia, serif' }}
                  >
                    BluePlanet CRM
                  </h2>
                  <p className="text-[12px] text-[#5a5650] mt-1">123 Corporate Blvd, Maryland</p>
                  <p className="text-[12px] text-[#5a5650]">procurement@blueplanet.com</p>
                </div>
              </div>

              <div className="bg-[#f0eeea] border border-[#d4d0c8] p-4 mb-8 flex items-start gap-3">
                <div className="text-[#5a7a9a] mt-0.5">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <h4 className="text-[10px] font-semibold text-[#1a1918] uppercase tracking-[0.1em] mb-1">
                    Immutable ledger record
                  </h4>
                  <p className="text-[11px] text-[#5a5650] font-mono break-all leading-relaxed">
                    LEDGER HASH: {viewerPo.ledgerHash ?? 'PENDING'} · {slip.suffix}
                  </p>
                  <p className="text-[11px] text-[#7a7874] mt-1">
                    Derived from PO {viewerPo.poNumber}. Source ledger changes invalidate this slip&apos;s
                    hash.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                  <h3 className="text-[11px] font-semibold text-[#1a1918] uppercase tracking-[0.1em] border-b border-[#d4d0c8] pb-2 mb-3">
                    Dispatch to — {slip.role}
                  </h3>
                  <p className="text-[13px] font-medium text-[#1a1918]">{slip.name}</p>
                  <p className="text-[12px] text-[#5a5650] mt-1 font-mono">Party ID: {slip.id}</p>
                </div>
                <div>
                  <h3 className="text-[11px] font-semibold text-[#1a1918] uppercase tracking-[0.1em] border-b border-[#d4d0c8] pb-2 mb-3">
                    Reference & logistics
                  </h3>
                  <div className="grid grid-cols-2 gap-y-2 text-[12px]">
                    <p className="text-[#7a7874]">Source PO</p>
                    <p className="font-medium text-[#1a1918] text-right font-mono">{viewerPo.poNumber}</p>
                    <p className="text-[#7a7874]">Est. delivery</p>
                    <p className="font-medium text-[#1a1918] text-right">
                      {fmtDate(viewerPo.estimatedDelivery) ?? viewerPo.eta ?? 'TBD'}
                    </p>
                    <p className="text-[#7a7874]">Container</p>
                    <p className="font-medium text-[#1a1918] text-right font-mono">
                      {viewerPo.containerId ?? 'Pending'}
                    </p>
                  </div>
                </div>
              </div>

              <table className="w-full mb-6 text-[13px]">
                <thead>
                  <tr className="border-b border-[#d4d0c8] bg-[#f0eeea]">
                    <th className="text-left p-3 text-[10px] font-semibold text-[#5a5650] uppercase tracking-[0.08em]">
                      Scope of work
                    </th>
                    <th className="text-right p-3 text-[10px] font-semibold text-[#5a5650] uppercase tracking-[0.08em]">
                      Qty
                    </th>
                    <th className="text-right p-3 text-[10px] font-semibold text-[#5a5650] uppercase tracking-[0.08em]">
                      Detail
                    </th>
                    <th className="text-right p-3 text-[10px] font-semibold text-[#5a5650] uppercase tracking-[0.08em]">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {slip.rows.map((r, i) => (
                    <tr key={i} className="border-b border-[#e8e4dc]">
                      <td className="p-3 font-medium text-[#1a1918]">{r.item}</td>
                      <td className="p-3 text-[#5a5650] text-right tabular-nums">{r.qty}</td>
                      <td className="p-3 text-[#5a5650] text-right">{r.unit}</td>
                      <td className="p-3 font-semibold text-[#1a1918] text-right tabular-nums">
                        {r.value == null
                          ? 'Per contract'
                          : `$${r.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="bg-[#f0eeea] border border-[#d4d0c8] rounded p-4 mb-8">
                <h4 className="text-[10px] font-semibold text-[#5a5650] uppercase tracking-[0.1em] mb-1">
                  Instructions
                </h4>
                <p className="text-[13px] text-[#3a3836] leading-relaxed">{slip.note}</p>
              </div>

              <div className="mb-4">
                <h3 className="text-[11px] font-semibold text-[#1a1918] uppercase tracking-[0.1em] border-b border-[#d4d0c8] pb-2 mb-3">
                  Pipeline route — this slip covers{' '}
                  <span className="text-[#1a1918] normal-case tracking-normal font-medium">
                    {slip.leg}
                  </span>
                </h3>
                <div className="bg-[var(--color-basalt-900)] p-4 rounded text-white mt-4 print:bg-[var(--color-basalt-900)]">
                  <LogisticsStageBar status={viewerPo.status} variant="full" />
                </div>
              </div>
            </div>

            <div className="bg-[#f0eeea] border-t border-[#d4d0c8] px-6 py-3 flex items-center justify-between print:hidden">
              <span className="text-[11px] text-[#7a7874]">
                {slipTargets.length} slip{slipTargets.length === 1 ? '' : 's'} available for this PO
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[#1a1918] bg-white border border-[#d4d0c8] rounded hover:bg-[#faf9f7] transition-colors font-medium"
                >
                  <Printer size={13} /> Print {slip.suffix} slip
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const dataStr =
                      'data:text/json;charset=utf-8,' +
                      encodeURIComponent(JSON.stringify(viewerPo, null, 2));
                    const downloadAnchor = document.createElement('a');
                    downloadAnchor.setAttribute('href', dataStr);
                    downloadAnchor.setAttribute('download', `${viewerPo.poNumber}_ledger_snapshot.json`);
                    document.body.appendChild(downloadAnchor);
                    downloadAnchor.click();
                    downloadAnchor.remove();
                    toast(`Cryptographic ledger JSON for ${viewerPo.poNumber} exported`);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[#8a7a50] bg-[#2a2520] border border-[#5a4a30] rounded hover:bg-[#3a3028] transition-colors cursor-pointer"
                >
                  <Download size={13} /> Export JSON
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(
                      `${window.location.origin}/purchases#${viewerPo.poNumber}-${slip.suffix}`,
                    );
                    toast(`${slip.role} slip link for ${viewerPo.poNumber} copied`);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-white bg-[#1a1918] rounded hover:bg-[#2a2826] transition-colors"
                >
                  <LinkIcon size={13} /> Copy link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {confirmDialog}
    </PageShell>
  );
}
