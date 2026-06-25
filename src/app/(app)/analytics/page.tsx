import AnalyticsDashboardClient from '@/components/AnalyticsDashboardClient';
import { getEffectiveRole } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getPurchaseOrders } from '@/server/queries/purchasing';
import { getSalesOrders } from '@/server/queries/orders';
import { getCatalog } from '@/server/queries/catalog';

export const metadata = {
  title: 'Executive Profitability & Margin Analytics | BluePlanet',
  description: 'Real-time landed cost apportionment, SKU profitability, and warehouse velocity tracking.',
};

export default async function AnalyticsPage() {
  const role = (await getEffectiveRole()) ?? 'SALES';
  if (role !== 'ADMIN') redirect('/catalog');

  const [purchaseOrders, salesOrders, catalog] = await Promise.all([
    getPurchaseOrders(),
    getSalesOrders(null),
    getCatalog(true)
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
