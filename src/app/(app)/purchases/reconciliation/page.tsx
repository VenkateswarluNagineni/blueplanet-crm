import { ReconciliationDashboardClient } from '@/components/reconciliation/ReconciliationDashboardClient';
import { getSessionContext } from '@/lib/domain/auth';
import { assertPageAccess } from '@/lib/domain/page-access';
import { getReconciliationCases } from '@/server/reconciliation/queries';

export const metadata = {
  title: 'Reconciliation | BluePlanet',
};

export default async function ReconciliationPage() {
  assertPageAccess(await getSessionContext(), 'admin');
  const cases = await getReconciliationCases();

  return (
    <div className="h-full w-full">
      <ReconciliationDashboardClient cases={cases} />
    </div>
  );
}
