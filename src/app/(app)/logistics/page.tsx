import { redirect } from 'next/navigation';
import { Ship, Package, Truck, Factory, Warehouse } from 'lucide-react';
import { getEffectiveRole } from '@/lib/auth';
import { getPurchaseOrders, type PoLogisticsStatus } from '@/server/queries/purchasing';

export const metadata = { title: 'Logistics | BluePlanet' };

const STEPS: { key: PoLogisticsStatus; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { key: 'PRODUCTION', label: 'Production', icon: Factory },
  { key: 'ON_WATER', label: 'Ocean', icon: Ship },
  { key: 'CUSTOMS', label: 'Customs', icon: Package },
  { key: 'INLAND_TRANSIT', label: 'Inland', icon: Truck },
  { key: 'RECEIVED', label: 'Received', icon: Warehouse },
];
const INDEX: Record<PoLogisticsStatus, number> = { PRODUCTION: 0, ON_WATER: 1, CUSTOMS: 2, INLAND_TRANSIT: 3, RECEIVED: 4 };

export default async function LogisticsPage() {
  const role = (await getEffectiveRole()) ?? 'SALES';
  if (role !== 'ADMIN') redirect('/catalog');

  const pos = await getPurchaseOrders();
  const inTransit = pos.filter((p) => p.status !== 'RECEIVED');

  return (
    <div className="h-full w-full flex flex-col bg-[#2b2a2c] text-[#d9d8d9]">
      <div className="pt-6 pb-4 px-6 border-b border-[#454446] shrink-0 bg-[#1c1c1c]">
        <h1 className="text-[20px] font-medium text-white mb-1">Logistics Tracker</h1>
        <p className="text-[13px] text-[#b8b6b9]">{inTransit.length} shipment{inTransit.length === 1 ? '' : 's'} currently in transit across the supply chain.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {inTransit.length === 0 ? (
          <div className="text-center py-12 text-[#b8b6b9] bg-[#1c1c1c] border border-[#454446] border-dashed rounded-md">No active shipments in transit.</div>
        ) : (
          inTransit.map((po) => {
            const cur = INDEX[po.status];
            return (
              <div key={po.id} className="bg-[#1c1c1c] border border-[#454446] rounded-lg p-5">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="font-mono text-white font-medium">{po.poNumber}</p>
                    <p className="text-[12px] text-[#b8b6b9]">{po.supplierName} · {po.materialName} · {po.orderedSlabs} slabs</p>
                  </div>
                  <div className="text-right text-[12px]">
                    <p className="text-white">ETA {po.eta ?? 'TBD'}</p>
                    {po.containerId && <p className="text-[#92b0ce] font-mono">{po.containerId}</p>}
                  </div>
                </div>
                <div className="flex items-center">
                  {STEPS.map((step, idx) => {
                    const done = idx < cur, active = idx === cur;
                    const Icon = step.icon;
                    return (
                      <div key={step.key} className="flex items-center flex-1 last:flex-none">
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${done ? 'bg-[#10b981] border-[#10b981] text-black' : active ? 'bg-[#e3c16c] border-[#e3c16c] text-black' : 'bg-[#2b2a2c] border-[#454446] text-[#b8b6b9]'}`}>
                            <Icon size={14} />
                          </div>
                          <span className={`text-[10px] mt-1 ${active ? 'text-[#e3c16c]' : done ? 'text-[#10b981]' : 'text-[#b8b6b9]'}`}>{step.label}</span>
                        </div>
                        {idx < STEPS.length - 1 && <div className={`h-0.5 flex-1 mx-1 -mt-4 ${done ? 'bg-[#10b981]' : 'bg-[#454446]'}`} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
