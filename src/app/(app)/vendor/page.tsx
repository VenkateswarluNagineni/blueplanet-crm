import { Truck, FileText, DollarSign, Ship } from 'lucide-react';
import { getVendorPortal } from '@/server/queries/vendor';

export const metadata = { title: 'Vendor Portal | BluePlanet' };

// Demo: the vendor user represents ZIM Integrated Shipping (V-001).
const VENDOR_SYSTEM_ID = 'V-001';

export default async function VendorPortalPage() {
  const portal = await getVendorPortal(VENDOR_SYSTEM_ID);

  if (!portal) {
    return <div className="p-8 text-[13px] text-[#b8b6b9]">No vendor account is linked to this login.</div>;
  }

  return (
    <div className="h-full w-full flex flex-col bg-[#2b2a2c] text-[#d9d8d9]">
      <div className="pt-6 pb-4 px-6 border-b border-[#454446] shrink-0 bg-[#1c1c1c]">
        <h1 className="text-[20px] font-medium text-white mb-1 flex items-center gap-2"><Truck size={18} className="text-[#92b0ce]" /> {portal.vendorName}</h1>
        <p className="text-[13px] text-[#b8b6b9]">{portal.serviceType} · Outstanding balance <span className="text-[#e3c16c] font-medium">${portal.balanceDue.toLocaleString()}</span></p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        <section>
          <h2 className="text-[13px] font-medium text-white mb-3 flex items-center gap-2"><Ship size={15} className="text-[#92b0ce]" /> My Active Orders</h2>
          {portal.orders.length === 0 ? (
            <div className="text-center py-10 text-[#b8b6b9] bg-[#1c1c1c] border border-[#454446] border-dashed rounded-md">No assigned shipments.</div>
          ) : (
            <div className="bg-[#1c1c1c] border border-[#454446] rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="bg-[#333234] text-[11px] uppercase tracking-wider text-[#b8b6b9]">
                    <th className="p-3 font-medium border-b border-[#454446]">PO</th>
                    <th className="p-3 font-medium border-b border-[#454446]">Supplier</th>
                    <th className="p-3 font-medium border-b border-[#454446]">Material</th>
                    <th className="p-3 font-medium border-b border-[#454446]">My Leg</th>
                    <th className="p-3 font-medium border-b border-[#454446]">Status</th>
                    <th className="p-3 font-medium border-b border-[#454446]">ETA / Container</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#454446]">
                  {portal.orders.map((o) => (
                    <tr key={o.poNumber} className="hover:bg-[#2b2a2c] transition-colors">
                      <td className="p-3 font-mono text-white">{o.poNumber}</td>
                      <td className="p-3 text-white">{o.supplierName}</td>
                      <td className="p-3">{o.materialName}</td>
                      <td className="p-3"><span className="bg-[#333234] border border-[#454446] text-[#b8b6b9] px-2 py-0.5 rounded text-[11px]">{o.leg}</span></td>
                      <td className="p-3 text-[#92b0ce]">{o.status}</td>
                      <td className="p-3">
                        <span className="text-white">{o.eta ?? 'TBD'}</span>
                        {o.containerId && <span className="text-[11px] font-mono text-[#92b0ce] ml-2">{o.containerId}</span>}
                        <div className="text-[10px] text-[#10b981] mt-0.5 font-mono">🔒 SHA-256 Dispatch Verified</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-[13px] font-medium text-white mb-3 flex items-center gap-2"><FileText size={15} className="text-[#e3c16c]" /> My Invoices</h2>
          {portal.invoices.length === 0 ? (
            <div className="text-center py-10 text-[#b8b6b9] bg-[#1c1c1c] border border-[#454446] border-dashed rounded-md">No invoices on file.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {portal.invoices.map((inv) => (
                <div key={inv.invoiceNum} className="bg-[#1c1c1c] border border-[#454446] rounded-md p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-white font-medium">{inv.invoiceNum}</span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${inv.status === 'Overdue' ? 'bg-red-500/10 text-red-400 border-red-500/30' : inv.status === 'In Dispute' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' : inv.status === 'Paid' ? 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/30' : 'bg-[#e3c16c]/10 text-[#e3c16c] border-[#e3c16c]/30'}`}>{inv.status}</span>
                  </div>
                  <p className="text-[12px] text-[#b8b6b9] mb-1">{inv.serviceDetails}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[14px] text-[#e3c16c] font-medium flex items-center gap-1"><DollarSign size={13} /> {inv.amount.toLocaleString()}</span>
                    <span className="text-[11px] text-[#b8b6b9]">Due {inv.dueDate ?? '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
