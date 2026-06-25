import { CrmDashboardClient } from '@/components/CrmDashboardClient';
import { getEffectiveRole } from '@/lib/auth';
import { getCrmData } from '@/server/queries/crm';

export const metadata = {
  title: 'People & Companies | BluePlanet',
};

export default async function CrmPage() {
  const role = (await getEffectiveRole()) ?? 'SALES';
  const data = await getCrmData();

  return (
    <main className="h-screen flex flex-col bg-[#2b2a2c] w-full">
      <CrmDashboardClient data={data} canManage={role === 'ADMIN'} />
    </main>
  );
}
