import { InventoryTableClient } from '@/components/InventoryTableClient';
import { getSessionContext } from '@/lib/auth';
import { getCompanySettings, canViewLandedCost } from '@/lib/rbac';
import { getInventoryItems, getInventoryLocations } from '@/server/queries/inventory';

export const metadata = {
  title: 'Inventory Search | BluePlanet',
  description: 'Search and manage the natural stone slab inventory.',
};

export default async function InventoryPage() {
  const ctx = await getSessionContext();
  const settings = ctx ? await getCompanySettings(ctx.user.companyId) : null;
  const canViewCost = settings && ctx ? canViewLandedCost(ctx.role, settings) : false;

  // Admins see every location; other roles see only their assigned locations.
  const locationScope = ctx?.isAdmin ? null : ctx?.locationIds ?? null;

  const [items, locations] = await Promise.all([
    getInventoryItems(canViewCost, locationScope),
    getInventoryLocations(),
  ]);

  return <InventoryTableClient initialData={items} availableLocations={locations} />;
}
