import CatalogDashboardClient from '@/components/CatalogDashboardClient';
import { getSessionContext } from '@/lib/auth';
import { getCompanySettings, canViewLandedCost } from '@/lib/rbac';
import { assertPageAccess } from '@/lib/page-access';
import { getCatalog } from '@/server/queries/catalog';

export const metadata = {
  title: 'Material Catalog | BluePlanet',
  description: 'Master Rock Catalog and Available Inventory',
};

export default async function CatalogPage() {
  const ctx = await getSessionContext();
  const settings = ctx ? await getCompanySettings(ctx.user.companyId) : null;
  const session = assertPageAccess(ctx, 'catalogBrowse', settings);
  const canViewCost = settings ? canViewLandedCost(session.role, settings) : false;

  const locationScope = session.isAdmin ? null : session.locationIds;
  const products = await getCatalog(canViewCost, locationScope);

  return <CatalogDashboardClient products={products} canViewCost={canViewCost} />;
}
