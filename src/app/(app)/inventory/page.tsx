import { InventoryTableClient } from '@/components/InventoryTableClient';
import { getCurrentUser, getEffectiveRole } from '@/lib/auth';
import { getCompanySettings, canViewLandedCost } from '@/lib/rbac';
import { getInventoryItems, getInventoryLocations } from '@/server/queries/inventory';

export const metadata = {
  title: 'Inventory Search | BluePlanet',
  description: 'Search and manage the natural stone slab inventory.',
};

export default async function InventoryPage() {
  const user = await getCurrentUser();
  const role = (await getEffectiveRole()) ?? 'SALES';
  const settings = user ? await getCompanySettings(user.companyId) : null;
  const canViewCost = settings ? canViewLandedCost(role, settings) : false;

  const [items, locations] = await Promise.all([
    getInventoryItems(canViewCost),
    getInventoryLocations(),
  ]);

  return <InventoryTableClient initialData={items} availableLocations={locations} />;
}
