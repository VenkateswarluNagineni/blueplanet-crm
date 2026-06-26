import { redirect } from 'next/navigation';
import { getSessionContext } from '@/lib/auth';
import { getCompanySettings, canViewLandedCost } from '@/lib/rbac';
import { getDashboardData } from '@/server/queries/dashboard';
import { CustomizableDashboard } from '@/components/CustomizableDashboard';

export const metadata = { title: 'Dashboard | BluePlanet CRM' };

// Role-appropriate default boards. Cost widgets are sanitized out client-side for
// viewers who can't see landed cost, so listing them here is harmless.
const DEFAULT_LAYOUTS: Record<string, string[]> = {
  ADMIN: [
    'kpi:inventoryValue', 'kpi:availableSlabs', 'kpi:inTransitPos',
    'kpi:openPipelineValue', 'kpi:ytdSales', 'kpi:pendingApprovals',
    'chart:inventoryByLocation', 'chart:pipelineByStage', 'chart:poByStatus', 'chart:salesByAssociate',
  ],
  SALES: [
    'kpi:availableSlabs', 'kpi:openPipelineValue', 'kpi:ytdSales', 'kpi:inTransitPos',
    'chart:pipelineByStage', 'chart:salesByAssociate', 'chart:poByStatus',
  ],
};

export default async function HomeDashboard() {
  const ctx = await getSessionContext();
  const role = ctx?.role ?? 'SALES';
  // Vendors get their own scoped portal.
  if (role === 'VENDOR') redirect('/vendor');

  const settings = ctx ? await getCompanySettings(ctx.user.companyId) : null;
  const canViewCost = settings ? canViewLandedCost(role, settings) : false;
  const data = await getDashboardData(canViewCost);

  const defaultLayout = DEFAULT_LAYOUTS[role] ?? DEFAULT_LAYOUTS.SALES;

  return (
    <div className="h-full w-full flex flex-col bg-[#2b2a2c]">
      <div className="pt-6 pb-4 px-6 border-b border-[#454446] shrink-0">
        <h1 className="text-[20px] font-medium text-white mb-1">Operations Dashboard</h1>
        <p className="text-[13px] text-[#b8b6b9]">Live snapshot of inventory, logistics, pipeline, and sales — tailored to you.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <CustomizableDashboard
          data={data}
          canViewCost={canViewCost}
          defaultLayout={defaultLayout}
          initialLayout={ctx?.dashboardLayout ?? null}
        />
      </div>
    </div>
  );
}
