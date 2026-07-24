import AnalyticsDashboardClient from '@/components/AnalyticsDashboardClient';
import { getSessionContext } from '@/lib/auth';
import { assertPageAccess } from '@/lib/page-access';
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
