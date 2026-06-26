'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  ListFilter,
  XCircle,
  CheckCircle2,
  Clock,
  Upload,
  ArrowUpDown,
  RotateCcw,
} from 'lucide-react';
import type { OrderRow } from '@/server/queries/orders';
import { completeOrderAction, cancelOrderAction, reopenOrderAction } from '@/server/actions/sales';

type SortField = 'date' | 'material' | 'customer' | 'value';
type SortDir = 'asc' | 'desc';

export default function OrdersDashboardClient({
  orders,
  isAdmin,
}: {
  orders: OrderRow[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [actionError, setActionError] = useState('');

  const [receiptModalOrder, setReceiptModalOrder] = useState<string | null>(null);
  const [receiptRefInput, setReceiptRefInput] = useState('');

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

  const handleCancelOrder = (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this Sales Order?')) return;
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

  const handleReopenOrder = (orderId: string) => {
    if (!confirm('Reopen this order? It returns to Pending and its slabs are re-held.')) return;
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

  const SortHeader = ({ field, label, align = 'left' }: { field: SortField; label: string; align?: 'left' | 'right' }) => (
    <button
      type="button"
      onClick={() => toggleSort(field)}
      className={`flex items-center gap-1 hover:text-white transition-colors ${align === 'right' ? 'ml-auto' : ''} ${sortField === field ? 'text-white' : ''}`}
      title={`Sort by ${label.toLowerCase()}`}
    >
      {label}
      <ArrowUpDown size={11} className={sortField === field ? 'opacity-100' : 'opacity-40'} />
      {sortField === field && <span className="text-[9px]">{sortDir === 'asc' ? '↑' : '↓'}</span>}
    </button>
  );

  return (
    <div className="h-full w-full flex flex-col bg-[#2b2a2c] text-[#d9d8d9]">
      {/* Header & Controls */}
      <div className="pt-6 pb-4 px-6 border-b border-[#454446] shrink-0 bg-[#1c1c1c]">
        <div className="flex justify-between items-end mb-4">
          <div>
            <h1 className="text-[20px] font-medium text-white mb-2">Sales Orders</h1>
            <p className="text-[13px] text-[#b8b6b9]">
              {isAdmin
                ? 'Global view of all transactions, cancellations, and completions.'
                : 'Manage your active quotes and cancellations.'}
            </p>
          </div>
          <span className="text-[12px] text-[#b8b6b9] bg-[#2b2a2c] border border-[#454446] px-3 py-1.5 rounded">
            {isAdmin ? 'Admin View — all reps' : 'My Orders'}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <div className="flex gap-4 items-center">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-[#b8b6b9]" />
              <input
                type="text"
                placeholder="Search orders or customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-[#2b2a2c] border border-[#454446] rounded text-[13px] text-white focus:outline-none focus:border-[#92b0ce] w-80 transition-colors"
              />
            </div>
            <div className="flex items-center gap-2 text-[13px]">
              <ListFilter size={14} className="text-[#b8b6b9]" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
                className="bg-[#2b2a2c] border border-[#454446] rounded px-2 py-1.5 text-white outline-none focus:border-[#92b0ce] transition-colors"
              >
                <option value="ALL">All statuses</option>
                <option value="PLACED">Pending Payment</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {actionError && (
        <div className="mx-6 mt-4 bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] px-3 py-2 rounded">
          {actionError}
        </div>
      )}

      {/* Table View */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="bg-[#1c1c1c] border border-[#454446] rounded-xl overflow-hidden shadow-md">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#333234] text-[11px] uppercase tracking-wider text-[#b8b6b9]">
                <th className="py-3.5 px-4 font-medium border-b border-[#454446]">Order ID</th>
                <th className="py-3.5 px-4 font-medium border-b border-[#454446]"><SortHeader field="date" label="Date" /></th>
                <th className="py-3.5 px-4 font-medium border-b border-[#454446]"><SortHeader field="customer" label="Customer / Project" /></th>
                <th className="py-3.5 px-4 font-medium border-b border-[#454446]"><SortHeader field="material" label="Material (Slab)" /></th>
                <th className="py-3.5 px-4 font-medium border-b border-[#454446] text-right"><SortHeader field="value" label="Total Value" align="right" /></th>
                <th className="py-3.5 px-4 font-medium border-b border-[#454446]">Rep ID</th>
                <th className="py-3.5 px-4 font-medium border-b border-[#454446]">Status</th>
                <th className="py-3.5 px-4 font-medium border-b border-[#454446] text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#454446] text-[13px]">
              {displayedOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-[#b8b6b9]">No orders found matching your criteria.</td>
                </tr>
              ) : (
                displayedOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-[#2b2a2c] transition-colors">
                    <td className="py-4 px-4 font-mono text-white font-medium">{order.soNumber}</td>
                    <td className="py-4 px-4 text-[#b8b6b9]">{order.placedAt}</td>
                    <td className="py-4 px-4 font-medium text-white">{order.customerName}</td>
                    <td className="p-3">
                      <span className="text-white">{order.materialName}</span>
                      <br />
                      {order.slabId !== '—' ? (
                        <a
                          href={`/inventory?slab=${encodeURIComponent(order.slabId)}`}
                          className="text-[11px] text-[#92b0ce] hover:text-white hover:underline"
                          title="Open this slab's full Material Passport in Inventory"
                        >
                          {order.slabId} ({order.sqft} sqft) ↗
                        </a>
                      ) : (
                        <span className="text-[11px] text-[#92b0ce]">{order.slabId} ({order.sqft} sqft)</span>
                      )}
                    </td>
                    <td className="p-3 text-right font-medium text-[#10b981]">
                      ${order.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <span className="bg-[#454446] text-white px-1.5 py-0.5 rounded text-[11px] font-mono">{order.repId} (60%)</span>
                        <span className="bg-[#333234] text-[#92b0ce] border border-[#454446] px-1 py-0.5 rounded text-[10px] font-mono" title="Branch Override Associate">SPLIT (40%)</span>
                      </div>
                      <div className="text-[10px] text-[#10b981] mt-1 font-mono">
                        Payout: ${(order.totalValue * 0.045).toFixed(2)}
                      </div>
                    </td>
                    <td className="p-3">
                      {order.status === 'PLACED' && (
                        <span className="inline-flex items-center gap-1 text-[#e3c16c] bg-[#e3c16c]/10 px-2 py-1 rounded text-[11px] font-medium border border-[#e3c16c]/20">
                          <Clock size={12} /> Pending Payment
                        </span>
                      )}
                      {order.status === 'COMPLETED' && (
                        <span className="inline-flex items-center gap-1 text-[#10b981] bg-[#10b981]/10 px-2 py-1 rounded text-[11px] font-medium border border-[#10b981]/20">
                          <CheckCircle2 size={12} /> Completed
                        </span>
                      )}
                      {order.status === 'CANCELLED' && (
                        <span className="inline-flex items-center gap-1 text-red-400 bg-red-400/10 px-2 py-1 rounded text-[11px] font-medium border border-red-400/20">
                          <XCircle size={12} /> Cancelled
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center relative group">
                      <div className="flex justify-center gap-2">
                        {order.status === 'PLACED' && (
                          <>
                            <button
                              onClick={() => handleCancelOrder(order.id)}
                              disabled={isPending}
                              className="text-[11px] text-[#b8b6b9] hover:text-red-400 hover:bg-red-400/10 px-2 py-1 rounded transition-colors disabled:opacity-50"
                            >
                              Cancel Order
                            </button>
                            <button
                              onClick={() => { setReceiptModalOrder(order.id); setActionError(''); }}
                              disabled={isPending}
                              className="text-[11px] text-[#b8b6b9] hover:text-[#10b981] hover:bg-[#10b981]/10 px-2 py-1 rounded transition-colors flex items-center gap-1 disabled:opacity-50"
                            >
                              <Upload size={10} /> Add Receipt
                            </button>
                          </>
                        )}
                        {(order.status === 'COMPLETED' || order.status === 'CANCELLED') && (
                          <button
                            onClick={() => handleReopenOrder(order.id)}
                            disabled={isPending}
                            className="text-[11px] text-[#b8b6b9] hover:text-[#e3c16c] hover:bg-[#e3c16c]/10 px-2 py-1 rounded transition-colors flex items-center gap-1 disabled:opacity-50"
                            title={order.status === 'COMPLETED' ? 'Reverse this sale back to Pending' : 'Reactivate this cancelled order'}
                          >
                            <RotateCcw size={10} /> Reopen
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Receipt Modal */}
      {receiptModalOrder && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
          <div className="bg-[#2b2a2c] border border-[#454446] rounded-lg w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#454446] bg-[#1c1c1c] flex justify-between items-center">
              <h3 className="text-white font-medium">Upload Payment Receipt</h3>
              <button onClick={() => setReceiptModalOrder(null)} className="text-[#b8b6b9] hover:text-white transition-colors">
                <XCircle size={18} />
              </button>
            </div>
            <form onSubmit={handleAddReceipt} className="p-6 space-y-4">
              <p className="text-[13px] text-[#b8b6b9]">
                Attach proof of payment to officially complete this transaction.
              </p>
              <div>
                <label className="block text-[12px] text-[#b8b6b9] mb-1.5">Wire / Check / Receipt Reference #</label>
                <input
                  type="text"
                  required
                  value={receiptRefInput}
                  onChange={(e) => setReceiptRefInput(e.target.value)}
                  className="w-full bg-[#1c1c1c] border border-[#454446] rounded px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[#92b0ce]"
                  placeholder="e.g. WIRE-998822"
                />
              </div>
              {actionError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] px-3 py-2 rounded">{actionError}</div>
              )}
              <div className="pt-4 mt-2 border-t border-[#454446] flex justify-end gap-3">
                <button type="button" onClick={() => setReceiptModalOrder(null)} className="px-4 py-2 text-[13px] text-[#b8b6b9] hover:text-white transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isPending} className="px-4 py-2 text-[13px] bg-[#10b981] text-black font-medium rounded hover:bg-[#059669] transition-colors flex items-center gap-2 disabled:opacity-60">
                  <Upload size={14} /> {isPending ? 'Completing…' : 'Complete Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
