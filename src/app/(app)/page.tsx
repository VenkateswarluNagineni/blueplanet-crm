import { redirect } from 'next/navigation';
import { Boxes, Truck, Briefcase, TrendingUp, DollarSign, CheckCircle } from 'lucide-react';
import { getCurrentUser, getEffectiveRole } from '@/lib/auth';
import { getCompanySettings, canViewLandedCost } from '@/lib/rbac';
import { getDashboardData } from '@/server/queries/dashboard';
import { DashboardCharts } from '@/components/DashboardCharts';

export const metadata = { title: 'Dashboard | BluePlanet CRM' };

function KpiCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="bg-[#1c1c1c] border border-[#454446] rounded-lg p-4 hover:border-[#5a595c] transition-colors">
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: `${accent}1a`, color: accent }}>
          <Icon size={15} />
        </div>
        <p className="text-[10px] uppercase tracking-wider text-[#b8b6b9] leading-tight">{label}</p>
      </div>
      <p className="text-[20px] font-medium text-white tabular-nums" style={{ fontFamily: 'var(--font-fraunces), serif' }}>{value}</p>
    </div>
  );
}

export default async function HomeDashboard() {
  const user = await getCurrentUser();
  const role = (await getEffectiveRole()) ?? 'SALES';
  // Vendors get their own scoped portal.
  if (role === 'VENDOR') redirect('/vendor');

  const settings = user ? await getCompanySettings(user.companyId) : null;
  const canViewCost = settings ? canViewLandedCost(role, settings) : false;
  const data = await getDashboardData(canViewCost);
  const k = data.kpis;
  const usd = (n: number) => `$${n.toLocaleString()}`;

  return (
    <div className="h-full w-full flex flex-col bg-[#2b2a2c]">
      <div className="pt-6 pb-4 px-6 border-b border-[#454446] shrink-0">
        <h1 className="text-[20px] font-medium text-white mb-1">Operations Dashboard</h1>
        <p className="text-[13px] text-[#b8b6b9]">Live snapshot of inventory, logistics, pipeline, and sales.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {canViewCost && <KpiCard icon={DollarSign} label="Inventory Value" value={usd(k.inventoryValue)} accent="#e3c16c" />}
          <KpiCard icon={Boxes} label="Available Slabs" value={k.availableSlabs.toLocaleString()} accent="#92b0ce" />
          <KpiCard icon={Truck} label="POs In Transit" value={k.inTransitPos.toLocaleString()} accent="#e8956b" />
          <KpiCard icon={Briefcase} label="Open Pipeline" value={usd(k.openPipelineValue)} accent="#b58cd6" />
          <KpiCard icon={TrendingUp} label="YTD Closed Sales" value={usd(k.ytdSales)} accent="#10b981" />
          <KpiCard icon={CheckCircle} label="Pending Approvals" value={k.pendingApprovals.toLocaleString()} accent="#5db5b5" />
        </div>

        <DashboardCharts data={data} />
      </div>
    </div>
  );
}
