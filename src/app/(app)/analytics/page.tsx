import AnalyticsDashboardClient from '@/components/analytics/AnalyticsDashboardClient';
import { getSessionContext } from '@/lib/domain/auth';
import { assertPageAccess } from '@/lib/domain/page-access';
import { getPurchaseOrders } from '@/server/purchasing/queries';
import { getSalesOrders } from '@/server/orders/queries';
import { getCatalog } from '@/server/catalog/queries';
import { getLandedCostSummary, getInventoryAging, getMarginByMaterialCategory } from '@/server/analytics/queries';

export const metadata = {
  title: 'Analytics | BluePlanet CRM',
  description: 'Booked sales, inbound capital, and material spread by line.',
};

export default async function AnalyticsPage() {
  assertPageAccess(await getSessionContext(), 'admin');

  const [purchaseOrders, salesOrders, catalog, landedCostSummary, inventoryAging, marginByMaterial] =
    await Promise.all([
      getPurchaseOrders(),
      getSalesOrders(null),
      getCatalog(true),
      getLandedCostSummary(),
      getInventoryAging(),
      getMarginByMaterialCategory(),
    ]);

  return (
    <div className="h-full w-full">
      <AnalyticsDashboardClient
        purchaseOrders={purchaseOrders}
        salesOrders={salesOrders}
        catalog={catalog}
        landedCostSummary={landedCostSummary}
        inventoryAging={inventoryAging}
        marginByMaterial={marginByMaterial}
      />
    </div>
  );
}
