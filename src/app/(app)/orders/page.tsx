import OrdersDashboardClient from '@/components/OrdersDashboardClient';
import { getEffectiveRole } from '@/lib/auth';
import { getSalesOrders } from '@/server/queries/orders';

export const metadata = {
  title: 'Sales Orders | BluePlanet',
  description: 'Manage and track all Sales Orders, Quotes, and Cancellations.',
};

// The demo seller maps to associate REP-1042; Sales sees only their own orders.
const SALES_REP_SYSTEM_ID = 'REP-1042';

export default async function OrdersPage() {
  const role = (await getEffectiveRole()) ?? 'SALES';
  const isAdmin = role === 'ADMIN';
  const orders = await getSalesOrders(isAdmin ? null : SALES_REP_SYSTEM_ID);

  return <OrdersDashboardClient orders={orders} isAdmin={isAdmin} />;
}
