import {
  ArrowLeft,
  X,
  MapPin,
  Search,
  History,
  PauseCircle,
  FileText,
  Factory,
  Ship,
  Package,
  Truck,
  Warehouse,
  ShoppingCart,
  User,
  Hash,
  Calendar,
  Receipt,
} from 'lucide-react';
import type { InventoryRow } from '@/server/inventory/queries';
import { Drawer } from '@/components/ui/Drawer';
import { StatusPill } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Term, Tooltip } from '@/components/ui/Tooltip';
import { swatchBaseForMaterial } from '@/lib/domain/material-swatch';
import { PassportMatesStrip } from '@/components/inventory/PassportMatesStrip';
import { SlabPhotoGallery } from '@/components/inventory/SlabPhotoGallery';

const RESTRICTED = (
  <span className="text-[var(--color-text-secondary)] text-[10px] bg-[var(--color-basalt-700)] px-1.5 py-0.5 rounded uppercase tracking-wider">Restricted</span>
);

const fmtDate = (iso: string | Date | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

const money = (n: number | null | undefined) =>
  n == null ? null : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function PassportDrawer({
  selectedPassportSlab,
  onClose,
  passportSearch,
  setPassportSearch,
  passportResults,
  onSelectSlab,
  passportMates,
}: {
  selectedPassportSlab: InventoryRow | null;
  onClose: () => void;
  passportSearch: string;
  setPassportSearch: (v: string) => void;
  passportResults: InventoryRow[];
  onSelectSlab: (slab: InventoryRow) => void;
  passportMates: InventoryRow[];
}) {

  return (
    <Drawer
      open={!!selectedPassportSlab}
      onClose={onClose}
      width={700}
      testId="passport-root"
      zIndex={50}
      header={
        selectedPassportSlab ? (
          <div className="bp-passport-hero flex items-start justify-between gap-3 px-6 py-5 shrink-0">
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1 text-[12px] text-[var(--color-sodalite)] hover:text-white mb-2.5 transition-colors"
              >
                <ArrowLeft size={13} /> Back to results
              </button>
              <div className="flex items-start gap-3">
                <div
                  className="bp-swatch shrink-0 mt-0.5 hidden sm:block"
                  style={{
                    ['--swatch-base' as string]: swatchBaseForMaterial(
                      selectedPassportSlab.product.materialType,
                      selectedPassportSlab.product.baseColor,
                    ),
                  }}
                  aria-hidden
                />
                <div className="min-w-0">
                  <h2
                    className="text-[18px] font-medium text-white flex items-center gap-2 flex-wrap tracking-tight"
                    style={{ fontFamily: 'var(--font-heading)' }}
                    data-testid="passport-title"
                  >
                    Material Passport
                    <span className="bg-[rgba(227,193,108,0.14)] text-[var(--color-vein)] border border-[rgba(227,193,108,0.3)] px-2 py-0.5 rounded-[var(--radius-sm)] text-[10px] font-bold tracking-[0.12em] uppercase">
                      Digital twin
                    </span>
                  </h2>
                  <p
                    className="text-[16px] text-white font-medium mt-1.5 truncate"
                    title={selectedPassportSlab.product.name}
                    style={{ fontFamily: 'var(--font-heading)' }}
                  >
                    {selectedPassportSlab.product.name}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap mt-2.5">
                    <span className="bp-mono text-[12px] text-[var(--color-text-secondary)]">
                      {selectedPassportSlab.uniqueSlabId}
                    </span>
                    <StatusPill status={selectedPassportSlab.status} />
                    <span className="text-[12px] text-[var(--color-fog-500)] flex items-center gap-1">
                      <MapPin size={12} /> {selectedPassportSlab.location.name}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-basalt-700)] p-1.5 rounded-[var(--radius-md)] transition-colors shrink-0"
              aria-label="Close passport"
            >
              <X size={20} />
            </button>
          </div>
        ) : null
      }
    >
          {selectedPassportSlab && (
          <>
          {/* Drawer Search / Switcher — jump to any slab by its lineage */}
          <div className="px-6 py-4 border-b border-[var(--color-basalt-500)] bg-[var(--color-basalt-800)] relative">
            <div className="flex items-center bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded-md px-3 py-2 focus-within:border-[var(--color-sodalite)] transition-colors">
              <Search size={14} className="text-[var(--color-text-secondary)] mr-2 shrink-0" />
              <input
                type="text"
                placeholder="Find a slab by ID, supplier, lot/container, customer, PO, or date…"
                value={passportSearch}
                onChange={(e) => setPassportSearch(e.target.value)}
                className="bg-transparent border-none outline-none text-[13px] text-white w-full placeholder-[var(--color-fog-500)]"
              />
              {passportSearch && (
                <button onClick={() => setPassportSearch('')} aria-label="Clear search" className="text-[var(--color-text-secondary)] hover:text-white ml-2"><X size={14} /></button>
              )}
            </div>
            {passportResults.length > 0 && (
              <div className="absolute left-6 right-6 top-full mt-1 bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded-md shadow-2xl z-20 max-h-72 overflow-y-auto">
                {passportResults.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => { onSelectSlab(r); setPassportSearch(''); }}
                    className="w-full text-left px-3 py-2 hover:bg-[var(--color-basalt-700)] border-b border-[var(--color-basalt-700)] last:border-0 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-white font-mono">{r.uniqueSlabId}</span>
                      <span className="text-[10px] text-[var(--color-text-secondary)] uppercase tracking-wider">{r.status}</span>
                    </div>
                    <div className="text-[11px] text-[var(--color-text-secondary)] truncate">
                      {r.product.name} · {r.trace.supplierName ?? 'Opening stock'} · Lot {r.lotNumber ?? '—'}
                      {r.trace.customerName ? ` · → ${r.trace.customerName}` : ''}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {passportSearch.trim().length >= 2 && passportResults.length === 0 && (
              <div className="absolute left-6 right-6 top-full mt-1 bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded-md shadow-2xl z-20 px-3 py-3 text-[12px] text-[var(--color-text-secondary)]">
                No slab matches &ldquo;{passportSearch}&rdquo;.
              </div>
            )}
          </div>

          <PassportMatesStrip currentSlab={selectedPassportSlab} mates={passportMates} onSelect={onSelectSlab} />

          <SlabPhotoGallery slab={selectedPassportSlab} />

          {/* Drawer Content (Timeline) — real lineage from the database */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Operational movement history (transfers / holds / write-offs) */}
            {(selectedPassportSlab.holdReason || selectedPassportSlab.movements.length > 0) && (
              <div className="mb-8">
                <h3 className="text-[12px] uppercase tracking-wider text-[var(--color-text-secondary)] font-medium flex items-center gap-2 mb-3"><History size={13} /> Movement History</h3>
                {selectedPassportSlab.status === 'ON_HOLD' && (
                  <div className="mb-3 rounded-[var(--radius-md)] border border-[rgba(227,193,108,0.35)] bg-[rgba(227,193,108,0.08)] px-3 py-2.5 flex items-start gap-2">
                    <PauseCircle size={15} className="text-[var(--color-vein)] shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-[var(--color-vein)]">Reserved · on hold</p>
                      <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5 truncate" title={selectedPassportSlab.holdReason ?? undefined}>
                        {selectedPassportSlab.holdReason
                          ? `Held for ${selectedPassportSlab.holdReason}`
                          : 'No reason recorded'}
                      </p>
                    </div>
                  </div>
                )}
                {selectedPassportSlab.movements.length === 0 ? (
                  <EmptyState
                    icon={History}
                    title="No movements yet"
                    hint="Transfers, holds, and write-offs will appear here."
                    className="py-6"
                  />
                ) : (
                  <div className="space-y-2">
                    {selectedPassportSlab.movements.map((m) => {
                      const tone = m.type === 'TRANSFER' ? 'text-[var(--color-sodalite)] border-[rgba(146,176,206,0.30)] bg-[rgba(146,176,206,0.10)]'
                        : m.type === 'HOLD' ? 'text-[var(--color-vein)] border-[rgba(227,193,108,0.30)] bg-[var(--color-vein)]/10'
                        : m.type === 'RELEASE' ? 'text-[var(--color-emerald)] border-[rgba(16,185,129,0.30)] bg-[var(--color-emerald)]/10'
                        : 'text-[var(--color-ruby)] border-[rgba(239,68,68,0.30)] bg-[rgba(239,68,68,0.10)]';
                      const desc = m.type === 'TRANSFER' ? `Moved ${m.fromLocation ?? '—'} → ${m.toLocation ?? '—'}`
                        : m.type === 'HOLD' ? 'Placed on hold'
                        : m.type === 'RELEASE' ? 'Released to available'
                        : 'Written off';
                      return (
                        <div key={m.id} className="flex items-start gap-3 bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded-md px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium border shrink-0 ${tone}`}>{m.type.replace('_', '-')}</span>
                          <div className="flex-1 text-[12px] min-w-0">
                            <p className="text-white">{desc}</p>
                            {m.reason && <p className="text-[var(--color-text-secondary)] truncate" title={m.reason}>{m.reason}</p>}
                            {m.note && <p className="text-[var(--color-text-secondary)] truncate" title={m.note}>{m.note}</p>}
                            {m.byRole && <p className="text-[11px] text-[var(--color-fog-500)]">by {m.byRole}</p>}
                          </div>
                          <span className="text-[11px] text-[var(--color-text-secondary)] whitespace-nowrap">{fmtDate(m.createdAt)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {(() => {
              const t = selectedPassportSlab.trace;
              const hasPO = !!t.poNumber;
              const sold = !!t.sold;
              // Timeline states: emerald done · gold active · basalt pending (DESIGN craft)
              type NodeState = 'done' | 'active' | 'pending';
              const n1: NodeState = 'done';
              const n2: NodeState = !hasPO ? 'pending' : sold ? 'done' : 'done';
              const n3: NodeState = sold ? 'done' : 'active';
              const n4: NodeState = sold ? 'done' : 'pending';
              const nodeClass = (s: NodeState) =>
                `bp-timeline-node bp-timeline-node--${s}`;
              const titleClass = (s: NodeState) =>
                s === 'active'
                  ? 'text-[14px] text-[var(--color-vein)] font-medium mb-2'
                  : 'text-[14px] text-white font-medium mb-2';
              const renderDocs = (refs: string[], accent = false) => (
                <div className={`w-[210px] shrink-0 bg-[var(--color-basalt-900)] border ${accent ? 'border-[rgba(227,193,108,0.30)]' : 'border-[var(--color-basalt-500)]'} rounded-md p-3`}>
                  <span className={`text-[10px] ${accent ? 'text-[var(--color-vein)]' : 'text-[var(--color-text-secondary)]'} font-medium uppercase tracking-wider mb-2 block`}>Linked Documents</span>
                  {refs.length === 0 ? (
                    <p className="text-[11px] text-[var(--color-text-secondary)] italic">None on file</p>
                  ) : refs.map((d, i) => (
                    <Tooltip key={i} content="Documents are filed offline — the passport links the reference only.">
                      <div className="flex items-center gap-2 text-[12px] text-[var(--color-text-secondary)] w-full mb-1.5 last:mb-0 break-all cursor-help">
                        <FileText size={12} className="shrink-0" /> {d}
                      </div>
                    </Tooltip>
                  ))}
                </div>
              );
              // Split PO documents across the legs they belong to.
              const transitDocs = t.documentRefs.filter((d) => /BOL|CUSTOMS|ENTRY|LADING/i.test(d));
              const supplierDocs = t.documentRefs.filter((d) => !transitDocs.includes(d) && !/GRN|RCV|RECEIV/i.test(d));
              const receivingDocs = [
                ...t.documentRefs.filter((d) => /GRN|RCV|RECEIV/i.test(d)),
                ...(t.receiptNumber && !t.documentRefs.includes(t.receiptNumber) ? [t.receiptNumber] : []),
              ];
              const canViewLanded =
                selectedPassportSlab.costLanded != null;
              return (
                <>
                  {/* Top Meta Info */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8 text-[13px]">
                    <div className="bp-card p-3">
                      <p className="bp-eyebrow mb-1.5">Product</p>
                      <p className="text-white font-medium truncate" title={selectedPassportSlab.product.name}>{selectedPassportSlab.product.name}</p>
                    </div>
                    <div className="bp-card p-3">
                      <p className="bp-eyebrow mb-1.5"><Term k="lot">Lot / Container</Term></p>
                      <p className="text-white font-medium truncate bp-mono text-[12px]" title={selectedPassportSlab.lotNumber ?? ''}>{selectedPassportSlab.lotNumber ?? '—'}</p>
                    </div>
                    <div className="bp-card p-3">
                      <p className="bp-eyebrow mb-1.5"><Term k="landedCost">Landed Cost</Term></p>
                      <p
                        className={`font-medium ${canViewLanded ? 'text-[var(--color-vein)]' : 'text-[var(--color-text-secondary)]'}`}
                        style={canViewLanded ? { fontFamily: 'var(--font-heading)' } : undefined}
                      >
                        {money(selectedPassportSlab.costLanded) ?? RESTRICTED}
                      </p>
                    </div>
                    <div className="bp-card p-3">
                      <p className="bp-eyebrow mb-1.5">Current Status</p>
                      <div className="mt-0.5"><StatusPill status={selectedPassportSlab.status} /></div>
                    </div>
                  </div>

                  <h3 className="bp-section-title mb-5">Lifecycle &amp; documentation</h3>

                  <div className="space-y-0">

                    {/* Node 1: Origin / Supplier */}
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center w-8 shrink-0">
                        <div className={nodeClass(n1)} aria-hidden>
                          <Factory size={14} />
                        </div>
                        <div className={`bp-timeline-rail ${n1 === 'done' ? 'bp-timeline-rail--done' : ''}`} />
                      </div>
                      <div className="flex-1 pb-8 flex gap-4">
                        <div className="flex-1">
                          <h4 className={titleClass(n1)}>1. Supplier Origin</h4>
                          {hasPO ? (
                            <div className="text-[13px] text-[var(--color-text-secondary)] space-y-1">
                              <p><User size={11} className="inline mr-1 -mt-0.5" />Supplier: <span className="text-white">{t.supplierName}</span>{t.supplierOrigin ? <span className="text-[var(--color-text-secondary)]"> · {t.supplierOrigin}</span> : null}</p>
                              <p><Hash size={11} className="inline mr-1 -mt-0.5" />Purchase Order: <span className="text-white font-mono">{t.poNumber}</span></p>
                              <p><Term k="fob">FOB</Term> Unit Cost: <span className="text-white">{t.unitCost != null ? `$${t.unitCost.toFixed(2)} / sf` : RESTRICTED}</span></p>
                              <p><Calendar size={11} className="inline mr-1 -mt-0.5" />Date Issued: <span className="text-white">{fmtDate(t.poIssuedAt)}</span></p>
                            </div>
                          ) : (
                            <div className="text-[13px] text-[var(--color-text-secondary)] space-y-1">
                              <p>Origin: <span className="text-white">{t.supplierOrigin ?? 'Unknown'}</span></p>
                              <p className="italic text-[12px]">Opening stock — no inbound purchase order is linked to this slab.</p>
                            </div>
                          )}
                        </div>
                        {renderDocs(supplierDocs)}
                      </div>
                    </div>

                    {/* Node 2: Transit & Apportionment */}
                    <div className={`flex gap-4 ${hasPO ? '' : 'opacity-60'}`}>
                      <div className="flex flex-col items-center w-8 shrink-0">
                        <div className={nodeClass(n2)} aria-hidden>
                          <Ship size={14} />
                        </div>
                        <div className={`bp-timeline-rail ${n2 === 'done' ? 'bp-timeline-rail--done' : ''}`} />
                      </div>
                      <div className="flex-1 pb-8 flex gap-4">
                        <div className="flex-1">
                          <h4 className={titleClass(n2)}>2. Transit &amp; <Term k="apportioned">Apportionment</Term></h4>
                          {hasPO ? (
                            <div className="text-[13px] text-[var(--color-text-secondary)] space-y-1">
                              <p><Ship size={11} className="inline mr-1 -mt-0.5" />Ocean Freight: <span className="text-white">{t.oceanVendorName ?? '—'}</span></p>
                              <p><Package size={11} className="inline mr-1 -mt-0.5" /><Term k="customs">Customs Broker</Term>: <span className="text-white">{t.customsVendorName ?? '—'}</span></p>
                              <p><Truck size={11} className="inline mr-1 -mt-0.5" />Inland Carrier: <span className="text-white">{t.inlandVendorName ?? '—'}</span></p>
                              <p>Apportioned Freight: <span className={selectedPassportSlab.costApportioned != null ? 'text-[var(--color-vein)]' : 'text-white'}>{selectedPassportSlab.costApportioned != null ? `+${money(selectedPassportSlab.costApportioned)} applied` : RESTRICTED}</span></p>
                              <p><Term k="eta">Est. Delivery</Term>: <span className="text-white">{fmtDate(t.poEstimatedDelivery)}</span></p>
                            </div>
                          ) : (
                            <p className="text-[13px] text-[var(--color-text-secondary)] italic">No inbound logistics recorded for opening stock.</p>
                          )}
                        </div>
                        {renderDocs(transitDocs)}
                      </div>
                    </div>

                    {/* Node 3: Receiving / Current Inventory */}
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center w-8 shrink-0">
                        <div className={nodeClass(n3)} aria-hidden>
                          <Warehouse size={14} />
                        </div>
                        <div className={`bp-timeline-rail ${n3 === 'done' ? 'bp-timeline-rail--done' : ''}`} />
                      </div>
                      <div className="flex-1 pb-8 flex gap-4">
                        <div className="flex-1">
                          <h4 className={titleClass(n3)}>3. Current Inventory</h4>
                          <div className="text-[13px] text-[var(--color-text-secondary)] space-y-1">
                            <p><MapPin size={11} className="inline mr-1 -mt-0.5" />Location: <span className="text-white">{selectedPassportSlab.location.name}</span></p>
                            <p><Calendar size={11} className="inline mr-1 -mt-0.5" />Date Received: <span className="text-white">{fmtDate(selectedPassportSlab.createdAt)}</span></p>
                            <p>Dimensions: <span className="text-white">{selectedPassportSlab.lengthInches}&quot; × {selectedPassportSlab.widthInches}&quot; ({selectedPassportSlab.totalSf} SF)</span></p>
                            {t.receiptNumber && <p><Receipt size={11} className="inline mr-1 -mt-0.5" /><Term k="receipt">Receipt No.</Term>: <span className="text-white font-mono">{t.receiptNumber}</span></p>}
                          </div>
                        </div>
                        {renderDocs(receivingDocs, n3 === 'active')}
                      </div>
                    </div>

                    {/* Node 4: Sales & Customer */}
                    <div className={`flex gap-4 ${sold ? '' : 'opacity-70'}`}>
                      <div className="flex flex-col items-center w-8 shrink-0">
                        <div className={nodeClass(n4)} aria-hidden>
                          <ShoppingCart size={14} />
                        </div>
                      </div>
                      <div className="flex-1 flex gap-4">
                        <div className="flex-1">
                          <h4 className={titleClass(n4)}>4. Sales &amp; Customer</h4>
                          {sold ? (
                            <div className="text-[13px] text-[var(--color-text-secondary)] space-y-1">
                              <p><User size={11} className="inline mr-1 -mt-0.5" />Customer: <span className="text-white">{t.customerName}</span></p>
                              <p>Sales Rep: <span className="text-white">{t.salesRepName ?? '—'}</span></p>
                              <p><Hash size={11} className="inline mr-1 -mt-0.5" />Sales Order: <span className="text-white font-mono">{t.soNumber}</span></p>
                              <p><Calendar size={11} className="inline mr-1 -mt-0.5" />Sold: <span className="text-white">{fmtDate(t.soldAt)}</span></p>
                              <p>Sold Price: <span className="text-white">{t.soldPricePerSf != null ? `$${t.soldPricePerSf.toFixed(2)} / sf` : RESTRICTED}</span></p>
                            </div>
                          ) : (
                            <p className="text-[13px] text-[var(--color-text-secondary)] italic">Not yet sold — awaiting opportunity conversion.</p>
                          )}
                        </div>
                        {renderDocs(sold && t.soNumber ? [t.soNumber] : [])}
                      </div>
                    </div>

                  </div>
                </>
              );
            })()}
          </div>
          </>
          )}
    </Drawer>
  );
}
