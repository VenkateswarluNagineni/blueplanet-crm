import OrdersDashboardClient from '@/components/OrdersDashboardClient';
import { getSessionContext } from '@/lib/auth';
import { assertPageAccess } from '@/lib/page-access';
import { getSalesOrders } from '@/server/queries/orders';

export const metadata = {
  title: 'Sales Orders | BluePlanet',
  description: 'Manage and track all Sales Orders, Quotes, and Cancellations.',
};

export default async function OrdersPage() {
  const ctx = assertPageAccess(await getSessionContext(), 'salesWorkspace');
  const isAdmin = ctx.isAdmin;
  // Admins see every order; a sales rep sees only the orders attributed to them.
  const orders = await getSalesOrders(isAdmin ? null : ctx.associateSystemId);

  return <OrdersDashboardClient orders={orders} isAdmin={isAdmin} />;
}
