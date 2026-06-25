import { redirect } from 'next/navigation';
import PurchasesDashboardClient from '@/components/PurchasesDashboardClient';
import { getEffectiveRole } from '@/lib/auth';
import { getPurchaseOrders, getPurchasingRefData } from '@/server/queries/purchasing';

export const metadata = {
  title: 'Purchasing & Logistics | BluePlanet',
};

export default async function PurchasesPage() {
  // Purchasing is an admin function.
  const role = (await getEffectiveRole()) ?? 'SALES';
  if (role !== 'ADMIN') redirect('/catalog');

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
