'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Package,
  Search,
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
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { Term } from '@/components/ui/Tooltip';
import type { PoRow, PoLogisticsStatus, PurchasingRefData, EtaStatus } from '@/server/queries/purchasing';
import { createPOAction, advancePOAction } from '@/server/actions/purchasing';

type SlipTarget = 'SUPPLIER' | 'OCEAN' | 'CUSTOMS' | 'INLAND';

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null;

/** Date-driven delivery status badge shown on each PO row. */
function EtaBadge({ status, days }: { status: EtaStatus; days: number | null }) {
  if (status === 'RECEIVED' || status === 'NONE') return null;
  const map: Record<string, { cls: string; label: string }> = {
    ON_TRACK: { cls: 'text-[#10b981] bg-[#10b981]/10 border-[#10b981]/20', label: `On track · ${days}d` },
    DUE_SOON: { cls: 'text-[#e3c16c] bg-[#e3c16c]/10 border-[#e3c16c]/20', label: days === 0 ? 'Due today' : `Due in ${days}d` },
    OVERDUE: { cls: 'text-red-400 bg-red-500/10 border-red-500/20', label: `Overdue ${Math.abs(days ?? 0)}d` },
  };
  const m = map[status];
  if (!m) return null;
  return (
    <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${m.cls}`}>
      {m.label}
    </span>
  );
}

const STEPS: { key: PoLogisticsStatus; label: string }[] = [
  { key: 'PRODUCTION', label: 'Supplier (Origin)' },
  { key: 'ON_WATER', label: 'Ocean Freight' },
  { key: 'CUSTOMS', label: 'Customs Broker' },
  { key: 'INLAND_TRANSIT', label: 'Inland Trucking' },
  { key: 'RECEIVED', label: 'Destination Hub' },
];

const STATUS_INDEX: Record<PoLogisticsStatus, number> = {
  PRODUCTION: 0,
  ON_WATER: 1,
  CUSTOMS: 2,
  INLAND_TRANSIT: 3,
  RECEIVED: 4,
};

const PipelineVisual = ({ status }: { status: PoLogisticsStatus }) => {
  const currentIdx = STATUS_INDEX[status];
  return (
    <div className="flex items-center w-full max-w-3xl py-4">
      {STEPS.map((step, idx) => {
        const stepStatus = idx < currentIdx ? 'COMPLETED' : idx === currentIdx ? 'ACTIVE' : 'PENDING';
        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center relative z-10">
              <div
                className={`w-4 h-4 rounded-full border-4 ${
                  stepStatus === 'COMPLETED'
                    ? 'bg-[#10b981] border-[#10b981] shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                    : stepStatus === 'ACTIVE'
                      ? 'bg-[#e3c16c] border-[#e3c16c] shadow-[0_0_8px_rgba(242,247,100,0.6)] animate-pulse'
                      : 'bg-[#2b2a2c] border-[#454446]'
                }`}
              />
              <span
                className={`text-[11px] absolute top-6 whitespace-nowrap ${
                  stepStatus === 'PENDING' ? 'text-[#b8b6b9]' : stepStatus === 'ACTIVE' ? 'text-[#e3c16c] font-medium' : 'text-[#10b981] font-medium'
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`flex-1 h-1 mx-0 ${stepStatus === 'COMPLETED' ? 'bg-[#10b981]' : 'bg-[#454446]'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default function PurchasesDashboardClient({
  purchaseOrders,
  suppliers,
  vendors,
  materials,
  nextPoNumber,
}: {
  purchaseOrders: PoRow[];
} & PurchasingRefData) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [verifyModalOpen, setVerifyModalOpen] = useState<{ isOpen: boolean; poId: string | null }>({ isOpen: false, poId: null });
  const [verifyDocRef, setVerifyDocRef] = useState('');
  const [viewerModalOpen, setViewerModalOpen] = useState<{ isOpen: boolean; poId: string | null }>({ isOpen: false, poId: null });
  const [slipTarget, setSlipTarget] = useState<SlipTarget>('SUPPLIER');

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

  const filteredPOs = purchaseOrders.filter(
    (po) =>
      po.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.materialName.toLowerCase().includes(searchTerm.toLowerCase()),
  );

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

  return (
    <div className="h-full w-full flex flex-col bg-[#2b2a2c] text-[#d9d8d9]">
      <div className="pt-6 pb-4 px-6 border-b border-[#454446] shrink-0 bg-[#1c1c1c]">
        <div className="flex justify-between items-end mb-4">
          <div>
            <h1 className="text-[20px] font-medium text-white mb-2">Purchase Orders & Logistics</h1>
            <p className="text-[13px] text-[#b8b6b9]">
              Track inbound shipments, manage supplier POs, and receive containers to restock inventory.
            </p>
          </div>
          <button
            onClick={() => { setIsCreateModalOpen(true); setFormError(''); }}
            className="px-4 py-2 bg-[#e3c16c] text-black font-medium text-[13px] rounded hover:bg-[#d2ac55] transition-colors flex items-center gap-2"
          >
            <Plus size={16} /> Create PO
          </button>
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-[#b8b6b9]" />
          <input
            type="text"
            placeholder="Search POs, suppliers, or materials..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-1.5 bg-[#2b2a2c] border border-[#454446] rounded text-[13px] text-white focus:outline-none focus:border-[#92b0ce] w-80 transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="bg-[#1c1c1c] border border-[#454446] rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#333234] text-[11px] uppercase tracking-wider text-[#b8b6b9]">
                <th className="p-3 font-medium border-b border-[#454446]">PO Number</th>
                <th className="p-3 font-medium border-b border-[#454446]">Supplier</th>
                <th className="p-3 font-medium border-b border-[#454446]">Material</th>
                <th className="p-3 font-medium border-b border-[#454446] text-right">Quantity</th>
                <th className="p-3 font-medium border-b border-[#454446] text-right">Unit Cost</th>
                <th className="p-3 font-medium border-b border-[#454446]"><Term k="eta">Est. Delivery</Term> / <Term k="container">Container</Term></th>
                <th className="p-3 font-medium border-b border-[#454446]">Status</th>
                <th className="p-3 font-medium border-b border-[#454446] text-center">Logistics Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#454446] text-[13px]">
              {filteredPOs.map((po) => {
                const totalValue = po.orderedSlabs * po.unitCost;
                return (
                  <React.Fragment key={po.id}>
                    <tr className="hover:bg-[#2b2a2c] transition-colors border-b-0">
                      <td className="p-3 font-mono text-white">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText size={14} className="text-[#b8b6b9]" />
                          <button
                            onClick={() => { setSlipTarget('SUPPLIER'); setViewerModalOpen({ isOpen: true, poId: po.id }); }}
                            className="hover:text-[#92b0ce] hover:underline transition-colors cursor-pointer"
                          >
                            {po.poNumber}
                          </button>
                        </div>
                        {po.documentRefs.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {po.documentRefs.map((doc, i) => (
                              <span key={i} className="text-[9px] bg-[#92b0ce]/10 text-[#92b0ce] border border-[#92b0ce]/20 px-1.5 py-0.5 rounded flex items-center gap-1">
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
                        <span className="text-[#e3c16c]">${po.unitCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        <div className="text-[11px] text-[#b8b6b9]">Total: ${totalValue.toLocaleString()}</div>
                      </td>
                      <td className="p-3">
                        <div className="text-white">{fmtDate(po.estimatedDelivery) ?? po.eta ?? 'TBD'}</div>
                        {po.containerId && <div className="text-[11px] font-mono text-[#92b0ce]">{po.containerId}</div>}
                        <div><EtaBadge status={po.etaStatus} days={po.daysToEta} /></div>
                        {po.status === 'RECEIVED' && po.receiptNumber && (
                          <div className="text-[10px] text-[#10b981] mt-1 flex items-center gap-1">
                            <Term k="receipt">Receipt</Term>: <span className="font-mono">{po.receiptNumber}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        {po.status === 'PRODUCTION' && (
                          <span className="inline-flex items-center gap-1 text-[#b8b6b9] bg-[#454446] px-2 py-1 rounded text-[11px] font-medium"><Clock size={12} /> In Production</span>
                        )}
                        {po.status === 'ON_WATER' && (
                          <span className="inline-flex items-center gap-1 text-[#92b0ce] bg-[#92b0ce]/10 px-2 py-1 rounded text-[11px] font-medium border border-[#92b0ce]/20"><Ship size={12} /> On Water</span>
                        )}
                        {po.status === 'CUSTOMS' && (
                          <span className="inline-flex items-center gap-1 text-orange-400 bg-orange-400/10 px-2 py-1 rounded text-[11px] font-medium border border-orange-400/20"><Package size={12} /> Clearing Customs</span>
                        )}
                        {po.status === 'INLAND_TRANSIT' && (
                          <span className="inline-flex items-center gap-1 text-purple-400 bg-purple-400/10 px-2 py-1 rounded text-[11px] font-medium border border-purple-400/20"><Truck size={12} /> Inland Transit</span>
                        )}
                        {po.status === 'RECEIVED' && (
                          <span className="inline-flex items-center gap-1 text-[#10b981] bg-[#10b981]/10 px-2 py-1 rounded text-[11px] font-medium border border-[#10b981]/20"><CheckCircle2 size={12} /> Restocked</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {po.status !== 'RECEIVED' ? (
                          <button
                            onClick={() => { setVerifyModalOpen({ isOpen: true, poId: po.id }); setFormError(''); }}
                            className="text-[11px] text-black bg-[#e3c16c] hover:bg-[#d2ac55] font-medium px-3 py-1.5 rounded transition-colors flex items-center justify-center gap-1 mx-auto"
                          >
                            Verify Step
                          </button>
                        ) : (
                          <span className="text-[11px] text-[#b8b6b9] italic">Completed</span>
                        )}
                      </td>
                    </tr>
                    <tr className="border-b border-[#454446] bg-[#222123]">
                      <td colSpan={8} className="px-8 pt-2 pb-10">
                        <PipelineVisual status={po.status} />
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
              {filteredPOs.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-[#b8b6b9]">No purchase orders match your search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create PO Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
          <div className="bg-[#2b2a2c] border border-[#454446] rounded-lg w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#454446] bg-[#1c1c1c] flex justify-between items-center">
              <div>
                <h3 className="text-white font-medium">Create Purchase Order</h3>
                <p className="text-[11px] text-[#b8b6b9] mt-0.5">
                  Will be issued as{' '}
                  <span className="font-mono text-[#e3c16c]">{nextPoNumber}</span>
                  {' '}— <Term k="poNumber">standard PO-[Year]-[Sequence]</Term>
                </p>
              </div>
              <button onClick={() => { setIsCreateModalOpen(false); resetForm(); }} className="text-[#b8b6b9] hover:text-white transition-colors">
                <XCircle size={18} />
              </button>
            </div>
            <form onSubmit={handleCreatePO} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] text-[#b8b6b9] mb-1.5">Supplier</label>
                  <select required value={selectedSupplierId} onChange={(e) => handleSupplierChange(e.target.value)} className="w-full bg-[#1c1c1c] border border-[#454446] rounded px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[#92b0ce]">
                    <option value="" disabled>Select supplier...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}{s.incoterms ? ` (${s.incoterms})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] text-[#b8b6b9] mb-1.5">Material to Order</label>
                  <select required value={selectedMaterialId} onChange={(e) => setSelectedMaterialId(e.target.value)} className="w-full bg-[#1c1c1c] border border-[#454446] rounded px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[#92b0ce]">
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
                    <label className="block text-[12px] text-[#b8b6b9] font-medium whitespace-nowrap">Ocean Freight Line</label>
                    <label className="flex items-center gap-1.5 text-[11px] text-[#92b0ce] cursor-pointer hover:text-white transition-colors">
                      <input type="checkbox" checked={isOceanCovered} onChange={(e) => { setIsOceanCovered(e.target.checked); setSelectedOceanId(e.target.checked ? 'SUPPLIER_COVERED' : ''); }} className="accent-[#92b0ce]" />
                      Supplier Covers
                    </label>
                  </div>
                  <select required disabled={isOceanCovered} value={selectedOceanId} onChange={(e) => setSelectedOceanId(e.target.value)} className="w-full bg-[#1c1c1c] border border-[#454446] rounded px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[#92b0ce] disabled:opacity-50">
                    {isOceanCovered ? <option value="SUPPLIER_COVERED">Handled by Supplier</option> : <option value="" disabled>Select shipping line...</option>}
                    {vendors.filter((v) => v.service === 'Ocean Freight').map((v) => (<option key={v.id} value={v.id}>{v.name}</option>))}
                  </select>
                  {isOceanCovered ? (
                    <p className="text-[11px] text-[#b8b6b9] mt-1.5">Cost rolled into the supplier&apos;s price.</p>
                  ) : (
                    <input type="number" required min="0.01" step="0.01" value={oceanCost} onChange={(e) => setOceanCost(e.target.value)} placeholder="Ocean freight price (total $)" className="mt-2 w-full bg-[#1c1c1c] border border-[#454446] rounded px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[#92b0ce]" />
                  )}
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-[12px] text-[#b8b6b9] font-medium whitespace-nowrap">Customs Broker</label>
                    <label className="flex items-center gap-1.5 text-[11px] text-[#92b0ce] cursor-pointer hover:text-white transition-colors">
                      <input type="checkbox" checked={isCustomsCovered} onChange={(e) => { setIsCustomsCovered(e.target.checked); setSelectedCustomsId(e.target.checked ? 'SUPPLIER_COVERED' : ''); }} className="accent-[#92b0ce]" />
                      Supplier Covers
                    </label>
                  </div>
                  <select required disabled={isCustomsCovered} value={selectedCustomsId} onChange={(e) => setSelectedCustomsId(e.target.value)} className="w-full bg-[#1c1c1c] border border-[#454446] rounded px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[#92b0ce] disabled:opacity-50">
                    {isCustomsCovered ? <option value="SUPPLIER_COVERED">Handled by Supplier</option> : <option value="" disabled>Select broker...</option>}
                    {vendors.filter((v) => v.service === 'Customs & Tariffs').map((v) => (<option key={v.id} value={v.id}>{v.name}</option>))}
                  </select>
                  {isCustomsCovered ? (
                    <p className="text-[11px] text-[#b8b6b9] mt-1.5">Cost rolled into the supplier&apos;s price.</p>
                  ) : (
                    <input type="number" required min="0.01" step="0.01" value={customsCost} onChange={(e) => setCustomsCost(e.target.value)} placeholder="Customs brokerage price (total $)" className="mt-2 w-full bg-[#1c1c1c] border border-[#454446] rounded px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[#92b0ce]" />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-[12px] text-[#b8b6b9] font-medium whitespace-nowrap">Inland Trucking</label>
                    <label className="flex items-center gap-1.5 text-[11px] text-[#92b0ce] cursor-pointer hover:text-white transition-colors">
                      <input type="checkbox" checked={isInlandCovered} onChange={(e) => { setIsInlandCovered(e.target.checked); setSelectedInlandId(e.target.checked ? 'SUPPLIER_COVERED' : ''); }} className="accent-[#92b0ce]" />
                      Supplier Covers
                    </label>
                  </div>
                  <select required disabled={isInlandCovered} value={selectedInlandId} onChange={(e) => setSelectedInlandId(e.target.value)} className="w-full bg-[#1c1c1c] border border-[#454446] rounded px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[#92b0ce] disabled:opacity-50">
                    {isInlandCovered ? <option value="SUPPLIER_COVERED">Handled by Supplier</option> : <option value="" disabled>Select trucking co...</option>}
                    {vendors.filter((v) => v.service === 'Inland Logistics').map((v) => (<option key={v.id} value={v.id}>{v.name}</option>))}
                  </select>
                  {isInlandCovered ? (
                    <p className="text-[11px] text-[#b8b6b9] mt-1.5">Cost rolled into the supplier&apos;s price.</p>
                  ) : (
                    <input type="number" required min="0.01" step="0.01" value={inlandCost} onChange={(e) => setInlandCost(e.target.value)} placeholder="Inland trucking price (total $)" className="mt-2 w-full bg-[#1c1c1c] border border-[#454446] rounded px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[#92b0ce]" />
                  )}
                </div>
                <div>
                  <label className="block text-[12px] text-[#b8b6b9] mb-2 font-medium">Destination Hub</label>
                  <select required value={selectedDestination} onChange={(e) => setSelectedDestination(e.target.value)} className="w-full bg-[#1c1c1c] border border-[#454446] rounded px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[#92b0ce]">
                    <option value="" disabled>Select hub...</option>
                    <option value="Maryland Hub">Maryland Hub (HQ)</option>
                    <option value="Boston HQ">Boston Branch</option>
                    <option value="New Jersey HQ">New Jersey Hub</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[12px] text-[#b8b6b9] mb-2 font-medium">Slabs Quantity</label>
                  <input type="number" required min="1" value={orderedSlabs} onChange={(e) => setOrderedSlabs(e.target.value)} className="w-full bg-[#1c1c1c] border border-[#454446] rounded px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[#92b0ce]" placeholder="e.g. 80" />
                </div>
                <div>
                  <label className="block text-[12px] text-[#b8b6b9] mb-2 font-medium">Negotiated Cost ($/sqft)</label>
                  <input type="number" required step="0.01" min="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className="w-full bg-[#1c1c1c] border border-[#454446] rounded px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[#92b0ce]" placeholder="e.g. 45.00" />
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
                  <div className="bg-[#1c1c1c] border border-[#454446] rounded p-3 text-[12px]">
                    <p className="text-[11px] text-[#b8b6b9] uppercase tracking-wider font-bold mb-2">Cost roll-up (≈{estSf.toLocaleString()} sf)</p>
                    <div className="grid grid-cols-2 gap-y-1">
                      <span className="text-[#b8b6b9]"><Term k="fob">Material (FOB)</Term></span><span className="text-right text-white">{fmt(material)}</span>
                      <span className="text-[#b8b6b9]">Ocean freight</span><span className="text-right text-white">{fmt(parseFloat(oceanCost || '0') || 0)}</span>
                      <span className="text-[#b8b6b9]">Customs</span><span className="text-right text-white">{fmt(parseFloat(customsCost || '0') || 0)}</span>
                      <span className="text-[#b8b6b9]">Inland</span><span className="text-right text-white">{fmt(parseFloat(inlandCost || '0') || 0)}</span>
                      <span className="text-white font-medium border-t border-[#454446] pt-1 mt-1"><Term k="landedCost">Est. Landed</Term></span>
                      <span className="text-right text-[#e3c16c] font-medium border-t border-[#454446] pt-1 mt-1">{fmt(landed)} <span className="text-[#b8b6b9] font-normal">({fmt(landed / estSf)}/sf)</span></span>
                    </div>
                  </div>
                );
              })()}

              <div className="border-t border-[#454446] pt-4">
                <label className="block text-[12px] text-[#b8b6b9] mb-2 font-medium">
                  <Term k="eta">Estimated Delivery Date</Term> — when do you expect this at the hub?
                </label>
                <input
                  type="date"
                  required
                  value={estimatedDelivery}
                  onChange={(e) => setEstimatedDelivery(e.target.value)}
                  className="w-full bg-[#1c1c1c] border border-[#454446] rounded px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[#92b0ce] [color-scheme:dark]"
                />
                <p className="text-[11px] text-[#b8b6b9] mt-1.5">
                  The dashboard tracks each PO against this date — flagging it on track, due soon, or overdue.
                </p>
              </div>

              {formError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] px-3 py-2 rounded">{formError}</div>
              )}

              <div className="pt-4 mt-2 border-t border-[#454446] flex justify-end gap-3">
                <button type="button" onClick={() => { setIsCreateModalOpen(false); resetForm(); }} className="px-4 py-2 text-[13px] text-[#b8b6b9] hover:text-white transition-colors">Cancel</button>
                <button type="submit" disabled={isPending} className="px-4 py-2 text-[13px] bg-[#e3c16c] text-black font-medium rounded hover:bg-[#d2ac55] transition-colors disabled:opacity-60">{isPending ? 'Issuing…' : 'Issue PO'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Verify Step Modal */}
      {verifyModalOpen.isOpen && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
          <div className="bg-[#2b2a2c] border border-[#454446] rounded-lg w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#454446] bg-[#1c1c1c] flex justify-between items-center">
              <h3 className="text-white font-medium">Verify Logistics Step</h3>
              <button onClick={() => setVerifyModalOpen({ isOpen: false, poId: null })} className="text-[#b8b6b9] hover:text-white transition-colors"><XCircle size={18} /></button>
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
                    <div className="bg-[#1c1c1c] border border-[#92b0ce]/30 p-3 rounded mb-4">
                      <p className="text-[12px] text-[#92b0ce] mb-1 uppercase tracking-wider font-bold">Current Verification Target</p>
                      <p className="text-[14px] text-white">Verifying <span className="font-bold">{currentLeg}</span> completion by <span className="text-[#e3c16c]">{vendorName}</span>.</p>
                    </div>
                    <p className="text-[13px] text-[#b8b6b9] mb-4">
                      Advance this PO to the next stage. {isFinal ? 'Receiving this container will restock the ordered slabs into inventory.' : 'You can optionally attach a reference number.'}
                    </p>
                    <label className="block text-[12px] text-[#b8b6b9] mb-1.5">
                      {isFinal ? <><Term k="receipt">Goods Receipt Number</Term> (stored for future lookup)</> : `${docType} Number (Optional)`}
                    </label>
                    <input type="text" value={verifyDocRef} onChange={(e) => setVerifyDocRef(e.target.value)} className="w-full bg-[#1c1c1c] border border-[#454446] rounded px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[#92b0ce]" placeholder={`e.g. ${docType.split(' ')[0].toUpperCase()}-884920`} />
                    {isFinal && (
                      <p className="text-[11px] text-[#b8b6b9] mt-1.5">Paperwork stays offline — only this reference number is saved, so the shipment can be searched later.</p>
                    )}
                  </div>
                );
              })()}

              {formError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] px-3 py-2 rounded">{formError}</div>
              )}

              <div className="pt-4 mt-2 border-t border-[#454446] flex justify-end gap-3">
                <button type="button" onClick={() => setVerifyModalOpen({ isOpen: false, poId: null })} className="px-4 py-2 text-[13px] text-[#b8b6b9] hover:text-white transition-colors">Cancel</button>
                <button type="submit" disabled={isPending} className="px-4 py-2 text-[13px] bg-[#10b981] text-white font-medium rounded hover:bg-[#059669] transition-colors disabled:opacity-60">{isPending ? 'Advancing…' : 'Verify & Advance'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PO Viewer Modal */}
      {viewerModalOpen.isOpen && viewerPo && slip && (
        <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4">
          <div className="bg-[#fdfdfd] text-black border border-[#d1d5db] w-full max-w-3xl h-[85vh] shadow-2xl flex flex-col relative font-sans overflow-hidden">
            <button onClick={() => setViewerModalOpen({ isOpen: false, poId: null })} className="absolute top-4 right-4 text-gray-500 hover:text-black transition-colors print:hidden"><XCircle size={24} /></button>

            {/* Party selector — one slip per counterparty in the pipeline */}
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-3 flex items-center gap-2 print:hidden">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mr-1">Generate slip for:</span>
              {slipTargets.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setSlipTarget(t.key)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${activeTarget === t.key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'}`}
                >
                  {t.tab}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-10">
              <div className="border-b-2 border-gray-800 pb-6 mb-8 flex justify-between items-end">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">{slip.title}</h1>
                  <p className="text-sm text-gray-500 font-mono">DOC NO: <span className="font-bold text-gray-800">{viewerPo.poNumber}-{slip.suffix}</span></p>
                  <p className="text-sm text-gray-500 font-mono">ISSUED: <span className="font-bold text-gray-800">{new Date(viewerPo.issuedAt ?? Date.now()).toLocaleString()}</span></p>
                </div>
                <div className="text-right">
                  <h2 className="text-xl font-bold text-gray-800">BluePlanet CRM Ledger</h2>
                  <p className="text-sm text-gray-500">123 Corporate Blvd, Maryland</p>
                  <p className="text-sm text-gray-500">procurement@blueplanet.com</p>
                </div>
              </div>

              <div className="bg-gray-100 border border-gray-300 p-4 mb-8 flex items-start gap-3">
                <div className="text-blue-600 mt-0.5"><CheckCircle2 size={18} /></div>
                <div>
                  <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-1">State-Driven Immutable Record</h4>
                  <p className="text-xs text-gray-600 font-mono break-all leading-relaxed">LEDGER HASH: {viewerPo.ledgerHash ?? 'PENDING'} · {slip.suffix}</p>
                  <p className="text-xs text-gray-500 mt-1 italic">Derived from PO {viewerPo.poNumber}. Modifications to the source ledger invalidate this slip&apos;s hash.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider border-b border-gray-300 pb-2 mb-4">Dispatch To — {slip.role}</h3>
                  <p className="text-sm font-medium text-gray-900">{slip.name}</p>
                  <p className="text-sm text-gray-600 mt-1">Party ID: {slip.id}</p>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider border-b border-gray-300 pb-2 mb-4">Reference & Logistics</h3>
                  <div className="grid grid-cols-2 gap-y-2">
                    <p className="text-sm text-gray-500">Source PO:</p>
                    <p className="text-sm font-medium text-gray-900 text-right">{viewerPo.poNumber}</p>
                    <p className="text-sm text-gray-500">Est. Delivery:</p>
                    <p className="text-sm font-medium text-gray-900 text-right">{fmtDate(viewerPo.estimatedDelivery) ?? viewerPo.eta ?? 'TBD'}</p>
                    <p className="text-sm text-gray-500">Container:</p>
                    <p className="text-sm font-medium text-gray-900 text-right">{viewerPo.containerId ?? 'Pending Allocation'}</p>
                  </div>
                </div>
              </div>

              <table className="w-full mb-6">
                <thead>
                  <tr className="border-b border-gray-300 bg-gray-50">
                    <th className="text-left p-3 text-xs font-bold text-gray-600 uppercase tracking-wider">Scope of Work</th>
                    <th className="text-right p-3 text-xs font-bold text-gray-600 uppercase tracking-wider">Quantity</th>
                    <th className="text-right p-3 text-xs font-bold text-gray-600 uppercase tracking-wider">Detail</th>
                    <th className="text-right p-3 text-xs font-bold text-gray-600 uppercase tracking-wider">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {slip.rows.map((r, i) => (
                    <tr key={i} className="border-b border-gray-200">
                      <td className="p-3 text-sm font-medium text-gray-900">{r.item}</td>
                      <td className="p-3 text-sm text-gray-600 text-right">{r.qty}</td>
                      <td className="p-3 text-sm text-gray-600 text-right">{r.unit}</td>
                      <td className="p-3 text-sm font-bold text-gray-900 text-right">{r.value == null ? 'Per contract' : `$${r.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="bg-gray-50 border border-gray-200 rounded p-4 mb-8">
                <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Instructions</h4>
                <p className="text-sm text-gray-700 leading-relaxed">{slip.note}</p>
              </div>

              <div className="mb-4">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider border-b border-gray-300 pb-2 mb-3">Pipeline Route — this slip covers <span className="text-gray-900">{slip.leg}</span></h3>
                <div className="bg-gray-900 p-4 rounded text-white mt-4">
                  <PipelineVisual status={viewerPo.status} />
                </div>
              </div>
            </div>

            <div className="bg-gray-100 border-t border-gray-300 px-6 py-3 flex items-center justify-between print:hidden">
              <span className="text-[11px] text-gray-500">{slipTargets.length} slip{slipTargets.length === 1 ? '' : 's'} available for this PO</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                >
                  <Printer size={13} /> Print {slip.suffix} slip
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(viewerPo, null, 2));
                    const downloadAnchor = document.createElement('a');
                    downloadAnchor.setAttribute("href", dataStr);
                    downloadAnchor.setAttribute("download", `${viewerPo.poNumber}_ledger_snapshot.json`);
                    document.body.appendChild(downloadAnchor);
                    downloadAnchor.click();
                    downloadAnchor.remove();
                    toast(`Cryptographic ledger JSON for ${viewerPo.poNumber} exported`);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-amber-300 bg-amber-950 border border-amber-700/50 rounded hover:bg-amber-900 transition-colors cursor-pointer"
                >
                  <Download size={13} /> Export JSON
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(`${window.location.origin}/purchases#${viewerPo.poNumber}-${slip.suffix}`);
                    toast(`${slip.role} slip link for ${viewerPo.poNumber} copied`);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-white bg-gray-800 rounded hover:bg-gray-700 transition-colors"
                >
                  <LinkIcon size={13} /> Copy link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
