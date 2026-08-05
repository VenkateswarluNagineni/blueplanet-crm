import { getSessionContext } from '@/lib/domain/auth';
import { getCompanySettings, canViewLandedCost } from '@/lib/domain/rbac';
import { assertPageAccess } from '@/lib/domain/page-access';
import { getDashboardData } from '@/server/dashboard/queries';
import { CustomizableDashboard } from '@/components/dashboard/CustomizableDashboard';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';

export const metadata = { title: 'Dashboard | BluePlanet CRM' };

const DEFAULT_LAYOUTS: Record<string, string[]> = {
  ADMIN: [
    'kpi:inventoryValue', 'kpi:availableSlabs', 'kpi:inTransitPos',
    'kpi:openPipelineValue', 'kpi:ytdSales', 'kpi:pendingApprovals',
    'chart:inventoryByLocation', 'chart:pipelineByStage', 'chart:poByStatus', 'chart:salesByAssociate',
  ],
  SALES: [
    'kpi:openPipelineValue', 'kpi:ytdSales', 'kpi:availableSlabs', 'kpi:inTransitPos',
    'chart:pipelineByStage', 'chart:salesByAssociate', 'chart:poByStatus',
  ],
};

export default async function HomeDashboard() {
  const ctx = assertPageAccess(await getSessionContext(), 'salesWorkspace');
  const role = ctx.role;

  const settings = await getCompanySettings(ctx.user.companyId);
  const canViewCost = canViewLandedCost(role, settings);
  const data = await getDashboardData(canViewCost);

  const defaultLayout = DEFAULT_LAYOUTS[role] ?? DEFAULT_LAYOUTS.SALES;

  return (
    <PageShell
      header={
        <PageHeader
          eyebrow="Command center"
          title="Today’s board"
          subtitle={
            role === 'ADMIN'
              ? 'Inventory, logistics, pipeline, and approvals in one place.'
              : 'Your slabs, pipeline, and orders.'
          }
          meta={[
            {
              label: role === 'ADMIN' ? 'Admin' : 'Sales',
              tone: role === 'ADMIN' ? 'gold' : 'green',
            },
            ...(role === 'ADMIN' && data.attention.pendingApprovals > 0
              ? [{ label: `${data.attention.pendingApprovals} approvals`, tone: 'gold' as const }]
              : []),
            ...(role === 'ADMIN' && data.attention.overduePos > 0
              ? [{ label: `${data.attention.overduePos} overdue`, tone: 'gold' as const }]
              : []),
          ]}
        />
      }
    >
      <CustomizableDashboard
        data={data}
        canViewCost={canViewCost}
        defaultLayout={defaultLayout}
        initialLayout={ctx.dashboardLayout ?? null}
      />
    </PageShell>
  );
}
