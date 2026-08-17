import PurchasesDashboardClient from '@/components/purchasing/PurchasesDashboardClient';
import { getSessionContext } from '@/lib/domain/auth';
import { assertPageAccess } from '@/lib/domain/page-access';
import { getCompanySettings } from '@/lib/domain/rbac';
import { getPurchaseOrders, getPurchasingRefData } from '@/server/purchasing/queries';
import { getOpenReconciliationCaseByPoId } from '@/server/reconciliation/queries';

export const metadata = {
  title: 'Purchasing & Logistics | BluePlanet',
};

export default async function PurchasesPage() {
  const ctx = assertPageAccess(await getSessionContext(), 'admin');

  const [purchaseOrders, ref, settings, openReconciliationCaseByPoId] = await Promise.all([
    getPurchaseOrders(),
    getPurchasingRefData(),
    getCompanySettings(ctx.user.companyId),
    getOpenReconciliationCaseByPoId(),
  ]);

  return (
    <div className="h-full w-full">
      <PurchasesDashboardClient
        purchaseOrders={purchaseOrders}
        suppliers={ref.suppliers}
        vendors={ref.vendors}
        materials={ref.materials}
        nextPoNumber={ref.nextPoNumber}
        poApprovalThreshold={settings.poApprovalThreshold}
        openReconciliationCaseByPoId={openReconciliationCaseByPoId}
      />
    </div>
  );
}
