import { InventoryTableClient } from '@/components/inventory/InventoryTableClient';
import { getSessionContext } from '@/lib/domain/auth';
import { getCompanySettings, canViewLandedCost } from '@/lib/domain/rbac';
import { assertPageAccess } from '@/lib/domain/page-access';
import { getInventoryItems, getInventoryLocations } from '@/server/inventory/queries';

export const metadata = {
  title: 'Inventory Search | BluePlanet',
  description: 'Search and manage the natural stone slab inventory.',
};

export default async function InventoryPage() {
  const ctx = await getSessionContext();
  const settings = ctx ? await getCompanySettings(ctx.user.companyId) : null;
  const session = assertPageAccess(ctx, 'inventoryBrowse', settings);
  const canViewCost = settings ? canViewLandedCost(session.role, settings) : false;

  // Admins see every location; other roles see only their assigned locations.
  const locationScope = session.isAdmin ? null : session.locationIds;

  const [items, locations] = await Promise.all([
    getInventoryItems(canViewCost, locationScope),
    getInventoryLocations(),
  ]);

  return (
    <InventoryTableClient
      initialData={items}
      availableLocations={locations.map((l) => l.name)}
      locations={locations}
    />
  );
}
