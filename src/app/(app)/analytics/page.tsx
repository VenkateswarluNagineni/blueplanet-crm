import AnalyticsDashboardClient from '@/components/analytics/AnalyticsDashboardClient';
import { getSessionContext } from '@/lib/domain/auth';
import { assertPageAccess } from '@/lib/domain/page-access';
import { getPurchaseOrders } from '@/server/queries/purchasing';
import { getSalesOrders } from '@/server/queries/orders';
import { getCatalog } from '@/server/queries/catalog';

export const metadata = {
  title: 'Analytics | BluePlanet CRM',
  description: 'Booked sales, inbound capital, and material spread by line.',
};

export default async function AnalyticsPage() {
  assertPageAccess(await getSessionContext(), 'admin');

  const [purchaseOrders, salesOrders, catalog] = await Promise.all([
    getPurchaseOrders(),
    getSalesOrders(null),
    getCatalog(true),
  ]);

  return (
    <div className="h-full w-full">
      <AnalyticsDashboardClient
        purchaseOrders={purchaseOrders}
        salesOrders={salesOrders}
        catalog={catalog}
      />
    </div>
  );
}
