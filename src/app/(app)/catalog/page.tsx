import CatalogDashboardClient from '@/components/CatalogDashboardClient';
import { getSessionContext } from '@/lib/auth';
import { getCompanySettings, canViewLandedCost } from '@/lib/rbac';
import { getCatalog } from '@/server/queries/catalog';

export const metadata = {
  title: 'Material Catalog | BluePlanet',
  description: 'Master Rock Catalog and Available Inventory',
};

export default async function CatalogPage() {
  const ctx = await getSessionContext();
  const settings = ctx ? await getCompanySettings(ctx.user.companyId) : null;
  const canViewCost = settings && ctx ? canViewLandedCost(ctx.role, settings) : false;

  // Admins see every location; other roles see only their assigned locations.
  const locationScope = ctx?.isAdmin ? null : ctx?.locationIds ?? null;
  const products = await getCatalog(canViewCost, locationScope);

  return <CatalogDashboardClient products={products} canViewCost={canViewCost} />;
}
