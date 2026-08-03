import { CrmDashboardClient } from '@/components/crm/CrmDashboardClient';
import { SalesCrmClient } from '@/components/crm/SalesCrmClient';
import { getSessionContext } from '@/lib/auth';
import { assertPageAccess } from '@/lib/page-access';
import { getCrmData, getSalesCrmData } from '@/server/queries/crm';

export const metadata = {
  title: 'People & Companies | BluePlanet',
};

export default async function CrmPage() {
  const ctx = assertPageAccess(await getSessionContext(), 'salesWorkspace');

  // Sales reps get a scoped view: their customers + own scorecard, never the
  // supply chain. Only admins see the full supplier/vendor/associate directory.
  if (!ctx.isAdmin) {
    const data = await getSalesCrmData(ctx.party?.id ?? null);
    return (
      <main className="h-screen flex flex-col bg-[#2b2a2c] w-full">
        <SalesCrmClient data={data} canEditTarget={!!data.me} />
      </main>
    );
  }

  const data = await getCrmData();
  return (
    <main className="h-screen flex flex-col bg-[#2b2a2c] w-full">
      <CrmDashboardClient data={data} canManage />
    </main>
  );
}
