import { notFound } from 'next/navigation';
import { ReconciliationCaseWorkspace } from '@/components/reconciliation/ReconciliationCaseWorkspace';
import { getSessionContext } from '@/lib/domain/auth';
import { assertPageAccess } from '@/lib/domain/page-access';
import { getReconciliationCaseDetail } from '@/server/reconciliation/queries';
import { getPurchaseOrders } from '@/server/purchasing/queries';

export const metadata = {
  title: 'Reconciliation case | BluePlanet',
};

export default async function ReconciliationCasePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  assertPageAccess(await getSessionContext(), 'admin');
  const { caseId } = await params;

  const detail = await getReconciliationCaseDetail(caseId);
  if (!detail) notFound();

  const candidatePOs = detail.status === 'NEEDS_MATCH'
    ? (await getPurchaseOrders())
        .filter((po) => po.approvalStatus !== 'FULFILLED')
        .map((po) => ({ id: po.id, poNumber: po.poNumber, supplierName: po.supplierName }))
    : [];

  return (
    <div className="h-full w-full">
      <ReconciliationCaseWorkspace detail={detail} candidatePOs={candidatePOs} />
    </div>
  );
}
