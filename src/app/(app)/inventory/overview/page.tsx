import { getSessionContext } from '@/lib/auth';
import { getCompanySettings, canViewLandedCost } from '@/lib/rbac';
import { getInventoryOverview } from '@/server/queries/inventoryOverview';
import { InventoryOverviewClient } from '@/components/InventoryOverviewClient';

export const metadata = { title: 'Inventory Overview | BluePlanet' };

export default async function InventoryOverviewPage() {
  const ctx = await getSessionContext();
  const settings = ctx ? await getCompanySettings(ctx.user.companyId) : null;
  const canViewCost = settings && ctx ? canViewLandedCost(ctx.role, settings) : false;
  const locationScope = ctx?.isAdmin ? null : ctx?.locationIds ?? null;

  const overview = await getInventoryOverview(canViewCost, locationScope);
  return <InventoryOverviewClient overview={overview} canViewCost={canViewCost} />;
}
