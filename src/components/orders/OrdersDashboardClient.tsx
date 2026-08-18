'use client';

import React, { useState, useTransition, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Upload,
  ArrowUpDown,
  RotateCcw,
  FileText,
  Wallet,
} from 'lucide-react';
import type { OrderRow } from '@/server/orders/queries';
import { completeOrderAction, cancelOrderAction, reopenOrderAction, recordDepositAction } from '@/server/orders/actions';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { ListToolbar, FilterChip } from '@/components/ui/ListToolbar';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusPill } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

type SortField = 'date' | 'material' | 'customer' | 'value';
type SortDir = 'asc' | 'desc';

interface SortHeaderProps {
  field: SortField;
  label: string;
  align?: 'left' | 'right';
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
}

const SortHeader = ({ field, label, align = 'left', sortField, sortDir, onSort }: SortHeaderProps) => (
  <button
    type="button"
    onClick={() => onSort(field)}
    className={`flex items-center gap-1 hover:text-white transition-colors ${align === 'right' ? 'ml-auto' : ''} ${sortField === field ? 'text-white' : ''}`}
    title={`Sort by ${label.toLowerCase()}`}
  >
    {label}
    <ArrowUpDown size={11} className={sortField === field ? 'opacity-100' : 'opacity-40'} />
    {sortField === field && <span className="text-[9px]">{sortDir === 'asc' ? '↑' : '↓'}</span>}
  </button>
);

export default function OrdersDashboardClient({
  orders,
  isAdmin,
}: {
  orders: OrderRow[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const _toast = useToast();
  const { confirm, confirmDialog: _confirmDialog } = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [actionError, setActionError] = useState('');
  const [highlightOrder, setHighlightOrder] = useState<string | null>(null);
  const highlightRef = useRef<HTMLTableRowElement | null>(null);

  const [receiptModalOrder, setReceiptModalOrder] = useState<string | null>(null);
  const [receiptRefInput, setReceiptRefInput] = useState('');

  const [depositModalOrder, setDepositModalOrder] = useState<OrderRow | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositMethod, setDepositMethod] = useState('Cash');
  const [depositNote, setDepositNote] = useState('');
  const [depositError, setDepositError] = useState('');

  // Deep-link: /orders?order=<soNumber|id> seeds search + highlights the row.
  // Also honors /orders?status=COMPLETED|PLACED|CANCELLED from the command center.
  useEffect(() => {
    const wanted = searchParams.get('order');
    const status = searchParams.get('status');
    const t = setTimeout(() => {
      if (wanted) {
        setSearchTerm(wanted);
        setHighlightOrder(wanted);
      }
      if (status && ['PLACED', 'COMPLETED', 'CANCELLED', 'ALL'].includes(status.toUpperCase())) {
        setStatusFilter(status.toUpperCase() === 'ALL' ? 'ALL' : status.toUpperCase());
      }
    }, 0);
    return () => clearTimeout(t);
  }, [searchParams]);

  useEffect(() => {
    if (!highlightOrder) return;
    const t = setTimeout(() => highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    return () => clearTimeout(t);
  }, [highlightOrder, searchTerm, statusFilter]);

  const handleAddReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptModalOrder || !receiptRefInput) return;
    setActionError('');
    startTransition(async () => {
      const res = await completeOrderAction(receiptModalOrder, receiptRefInput);
      if (!res.ok) {
        setActionError(res.error);
        return;
      }
      setReceiptModalOrder(null);
      setReceiptRefInput('');
      router.refresh();
    });
  };

  const handleRecordDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositModalOrder) return;
    const amount = Number(depositAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setDepositError('Enter a valid amount greater than zero.');
      return;
    }
    setDepositError('');
    startTransition(async () => {
      const res = await recordDepositAction(depositModalOrder.id, { amount, method: depositMethod, note: depositNote });
      if (!res.ok) {
        setDepositError(res.error);
        return;
      }
      setDepositModalOrder(null);
      setDepositAmount('');
      setDepositNote('');
      router.refresh();
    });
  };

  const handleCancelOrder = async (orderId: string) => {
    const ok = await confirm({
      title: 'Cancel Sales Order?',
      message: 'Are you sure you want to cancel this Sales Order? This action cannot be undone.',
      confirmLabel: 'Cancel Order',
      tone: 'danger',
    });
    if (!ok) return;
    setActionError('');
    startTransition(async () => {
      const res = await cancelOrderAction(orderId);
      if (!res.ok) {
        setActionError(res.error);
        return;
      }
      router.refresh();
    });
  };

  const handleReopenOrder = async (orderId: string) => {
    const ok = await confirm({
      title: 'Reopen Order?',
      message: 'Reopen this order? It returns to Pending status and its slabs will be re-held.',
      confirmLabel: 'Reopen Order',
      tone: 'danger',
    });
    if (!ok) return;
    setActionError('');
    startTransition(async () => {
      const res = await reopenOrderAction(orderId);
      if (!res.ok) {
        setActionError(res.error);
        return;
      }
      router.refresh();
    });
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'date' || field === 'value' ? 'desc' : 'asc');
    }
  };

  const displayedOrders = orders
    .filter((order) => {
      const matchSearch =
        order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.soNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.materialName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'ALL' || order.status === statusFilter;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'value':
          return (a.totalValue - b.totalValue) * dir;
        case 'material':
          return a.materialName.localeCompare(b.materialName) * dir;
        case 'customer':
          return a.customerName.localeCompare(b.customerName) * dir;
        case 'date':
        default:
          return a.placedAt.localeCompare(b.placedAt) * dir;
      }
    });

  const pendingCount = orders.filter((o) => o.status === 'PLACED').length;
  const completedCount = orders.filter((o) => o.status === 'COMPLETED').length;
  const cancelledCount = orders.filter((o) => o.status === 'CANCELLED').length;

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setHighlightOrder(null);
  };

  return (
    <PageShell
      flush
      header={
        <PageHeader
          eyebrow="Sales"
          title="Orders"
          subtitle={
            isAdmin
              ? 'Global view of all transactions, cancellations, and completions.'
              : 'Manage your active quotes and cancellations.'
          }
          meta={[
            { label: isAdmin ? 'All reps' : 'My book', tone: isAdmin ? 'gold' : 'green' },
            { label: `${orders.length} total`, tone: 'neutral' },
            ...(pendingCount > 0
              ? [{ label: `${pendingCount} pending payment`, tone: 'gold' as const }]
              : []),
          ]}
        >
          <ListToolbar
            search={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Search orders, customers, or materials…"
            resultCount={displayedOrders.length}
            totalCount={orders.length}
            onClear={searchTerm || statusFilter !== 'ALL' ? clearFilters : undefined}
            clearLabel="Reset filters"
            filters={
              <div className="flex items-center gap-1.5 flex-wrap">
                <FilterChip active={statusFilter === 'ALL'} onClick={() => setStatusFilter('ALL')} count={orders.length}>
                  All
                </FilterChip>
                <FilterChip active={statusFilter === 'PLACED'} onClick={() => setStatusFilter('PLACED')} count={pendingCount}>
                  Pending
                </FilterChip>
                <FilterChip active={statusFilter === 'COMPLETED'} onClick={() => setStatusFilter('COMPLETED')} count={completedCount}>
                  Completed
                </FilterChip>
                <FilterChip active={statusFilter === 'CANCELLED'} onClick={() => setStatusFilter('CANCELLED')} count={cancelledCount}>
                  Cancelled
                </FilterChip>
              </div>
            }
          />
        </PageHeader>
      }
    >

      {actionError && (
        <div className="mx-6 mt-4 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[var(--color-ruby)] text-[12px] px-3 py-2 rounded">
          {actionError}
        </div>
      )}

      {/* Table View — DESIGN.md §5 / Phase C dense table */}
      <div className="p-6">
        <div className="bp-table-shell">
          <table className="bp-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th><SortHeader field="date" label="Date" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></th>
                <th><SortHeader field="customer" label="Customer / Project" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></th>
                <th><SortHeader field="material" label="Material (Slab)" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></th>
                <th className="text-right"><SortHeader field="value" label="Total Value" align="right" sortField={sortField} sortDir={sortDir} onSort={toggleSort} /></th>
                <th className="text-right">Balance Due</th>
                <th>Rep ID</th>
                <th>Status</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="!p-4">
                    <EmptyState
                      icon={FileText}
                      title={orders.length === 0 ? 'No sales orders yet' : 'No orders match your filters'}
                      hint={
                        orders.length === 0
                          ? 'Convert a pipeline deal or create an order from the catalog.'
                          : 'Try another status chip or clear search.'
                      }
                      action={
                        (searchTerm || statusFilter !== 'ALL') ? (
                          <Button type="button" onClick={clearFilters} variant="ghost">
                            Reset filters
                          </Button>
                        ) : undefined
                      }
                      className="py-10"
                    />
                  </td>
                </tr>
              ) : (
                displayedOrders.map((order) => {
                  const isHit =
                    !!highlightOrder &&
                    (order.soNumber === highlightOrder || order.id === highlightOrder);
                  return (
                  <tr
                    key={order.id}
                    ref={isHit ? highlightRef : undefined}
                    className={isHit ? 'bp-table-row-hit' : undefined}
                  >
                    <td className="bp-id">{order.soNumber}</td>
                    <td className="text-[var(--color-text-secondary)]">{order.placedAt}</td>
                    <td className="font-medium text-white">{order.customerName}</td>
                    <td>
                      <span className="text-white">{order.materialName}</span>
                      <br />
                      {order.slabId !== '—' ? (
                        <a
                          href={`/inventory?slab=${encodeURIComponent(order.slabId)}`}
                          className="text-[11px] text-[var(--color-sodalite)] hover:text-white hover:underline bp-mono"
                          title="Open this slab's full Material Passport in Inventory"
                        >
                          {order.slabId} ({order.sqft} sqft) ↗
                        </a>
                      ) : (
                        <span className="text-[11px] text-[var(--color-sodalite)] bp-mono">{order.slabId} ({order.sqft} sqft)</span>
                      )}
                    </td>
                    <td className="bp-money">
                      ${order.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="bp-num">
                      {order.balanceDue <= 0.005 ? (
                        <span className="text-[var(--color-emerald)]">Paid</span>
                      ) : (
                        <>
                          ${order.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          {order.depositsPaid > 0 && (
                            <div className="text-[10px] text-[var(--color-text-secondary)] font-normal">
                              ${order.depositsPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} paid
                            </div>
                          )}
                        </>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="text-[11px] text-white font-mono">
                        {order.repId} (60%){' '}
                        <span className="text-[var(--color-text-secondary)]" title="Branch Override Associate">
                          · SPLIT (40%)
                        </span>
                      </div>
                      <div className="text-[10px] text-[var(--color-emerald)] mt-1 font-mono">
                        Payout: ${(order.totalValue * 0.045).toFixed(2)}
                      </div>
                    </td>
                    <td className="p-3">
                      <StatusPill
                        status={
                          order.status === 'PLACED'
                            ? 'PLACED'
                            : order.status === 'COMPLETED'
                              ? 'COMPLETED'
                              : order.status === 'CANCELLED'
                                ? 'CANCELLED'
                                : order.status
                        }
                      />
                      {order.status === 'PLACED' && (
                        <span className="block text-[10px] text-[var(--color-fog-500)] mt-1">Pending payment</span>
                      )}
                    </td>
                    <td className="p-3 text-center relative">
                      <div className="bp-row-actions">
                        {order.status !== 'CANCELLED' && order.balanceDue > 0.005 && (
                          <button
                            onClick={() => { setDepositModalOrder(order); setDepositAmount(''); setDepositMethod('Cash'); setDepositNote(''); setDepositError(''); }}
                            disabled={isPending}
                            className="bp-row-action disabled:opacity-50"
                          >
                            <Wallet size={10} /> Deposit
                          </button>
                        )}
                        {order.status === 'PLACED' && (
                          <>
                            <button
                              onClick={() => handleCancelOrder(order.id)}
                              disabled={isPending}
                              className="bp-row-action disabled:opacity-50"
                            >
                              Cancel Order
                            </button>
                            <button
                              onClick={() => { setReceiptModalOrder(order.id); setActionError(''); }}
                              disabled={isPending}
                              className="bp-row-action bp-row-action--primary disabled:opacity-50"
                            >
                              <Upload size={10} /> Add Receipt
                            </button>
                          </>
                        )}
                        {(order.status === 'COMPLETED' || order.status === 'CANCELLED') && (
                          <button
                            onClick={() => handleReopenOrder(order.id)}
                            disabled={isPending}
                            className="bp-row-action disabled:opacity-50"
                            title={order.status === 'COMPLETED' ? 'Reverse this sale back to Pending' : 'Reactivate this cancelled order'}
                          >
                            <RotateCcw size={10} /> Reopen
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={!!receiptModalOrder}
        onClose={() => setReceiptModalOrder(null)}
        title="Upload Payment Receipt"
        subtitle="Attach proof of payment to officially complete this transaction."
        width={400}
        footer={
          <>
            <Button variant="ghost" size="sm" type="button" onClick={() => setReceiptModalOrder(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              form="receipt-form"
              disabled={isPending}
              className="!bg-[var(--color-emerald)] hover:!opacity-90"
            >
              <Upload size={14} /> {isPending ? 'Completing…' : 'Complete Transaction'}
            </Button>
          </>
        }
      >
        <form id="receipt-form" onSubmit={handleAddReceipt} className="space-y-4">
          <div>
            <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1.5">
              Wire / Check / Receipt Reference #
            </label>
            <input
              type="text"
              required
              value={receiptRefInput}
              onChange={(e) => setReceiptRefInput(e.target.value)}
              className="bp-input"
              placeholder="e.g. WIRE-998822"
            />
          </div>
          {actionError && (
            <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.25)] text-[var(--color-ruby)] text-[12px] px-3 py-2 rounded-[var(--radius-sm)]">
              {actionError}
            </div>
          )}
        </form>
      </Modal>

      <Modal
        open={!!depositModalOrder}
        onClose={() => setDepositModalOrder(null)}
        title={`Record deposit — ${depositModalOrder?.soNumber ?? ''}`}
        subtitle={depositModalOrder ? `Balance due: $${depositModalOrder.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : undefined}
        width={420}
        footer={
          <>
            <Button variant="ghost" size="sm" type="button" onClick={() => setDepositModalOrder(null)}>Cancel</Button>
            <Button variant="primary" size="sm" type="submit" form="deposit-form" disabled={isPending}>
              <Wallet size={14} /> {isPending ? 'Recording…' : 'Record Deposit'}
            </Button>
          </>
        }
      >
        {depositModalOrder && (
          <form id="deposit-form" onSubmit={handleRecordDeposit} className="space-y-4">
            <div>
              <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1.5">Amount ($)</label>
              <input
                type="number" step="0.01" min="0.01" required
                value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)}
                className="bp-input bp-mono" placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1.5">Method</label>
              <select value={depositMethod} onChange={(e) => setDepositMethod(e.target.value)} className="bp-select">
                {['Cash', 'Check', 'Card', 'Wire', 'Other'].map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1.5">Note (optional)</label>
              <input type="text" value={depositNote} onChange={(e) => setDepositNote(e.target.value)} className="bp-input" placeholder="e.g. Deposit at signing" />
            </div>
            {depositError && (
              <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.25)] text-[var(--color-ruby)] text-[12px] px-3 py-2 rounded-[var(--radius-sm)]">
                {depositError}
              </div>
            )}
            {depositModalOrder.payments.length > 0 && (
              <div className="pt-2 border-t border-[var(--color-basalt-500)]">
                <p className="text-[10px] uppercase tracking-wider text-[var(--color-fog-500)] mb-1.5">Payment history</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {depositModalOrder.payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-[12px]">
                      <span className="text-[var(--color-text-secondary)]">
                        {new Date(p.createdAt).toLocaleDateString()} · {p.method ?? 'Other'}
                        {p.note && <span className="text-[var(--color-fog-400)]"> — {p.note}</span>}
                      </span>
                      <span className="bp-mono text-white">${p.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>
        )}
      </Modal>
    </PageShell>
  );
}
