import { getSessionContext } from '@/lib/auth';
import { getCompanySettings, canViewLandedCost } from '@/lib/rbac';
import { assertPageAccess } from '@/lib/page-access';
import { getInventoryOverview } from '@/server/queries/inventoryOverview';
import { InventoryOverviewClient } from '@/components/InventoryOverviewClient';

export const metadata = { title: 'Inventory Overview | BluePlanet' };

export default async function InventoryOverviewPage() {
  const ctx = await getSessionContext();
  const settings = ctx ? await getCompanySettings(ctx.user.companyId) : null;
  const session = assertPageAccess(ctx, 'inventoryBrowse', settings);
  const canViewCost = settings ? canViewLandedCost(session.role, settings) : false;
  const locationScope = session.isAdmin ? null : session.locationIds;

  const overview = await getInventoryOverview(canViewCost, locationScope);
  return <InventoryOverviewClient overview={overview} canViewCost={canViewCost} />;
}
