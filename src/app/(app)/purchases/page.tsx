import PurchasesDashboardClient from '@/components/purchasing/PurchasesDashboardClient';
import { getSessionContext } from '@/lib/domain/auth';
import { assertPageAccess } from '@/lib/domain/page-access';
import { getPurchaseOrders, getPurchasingRefData } from '@/server/queries/purchasing';

export const metadata = {
  title: 'Purchasing & Logistics | BluePlanet',
};

export default async function PurchasesPage() {
  assertPageAccess(await getSessionContext(), 'admin');

  const [purchaseOrders, ref] = await Promise.all([getPurchaseOrders(), getPurchasingRefData()]);

  return (
    <div className="h-full w-full">
      <PurchasesDashboardClient
        purchaseOrders={purchaseOrders}
        suppliers={ref.suppliers}
        vendors={ref.vendors}
        materials={ref.materials}
        nextPoNumber={ref.nextPoNumber}
      />
    </div>
  );
}
