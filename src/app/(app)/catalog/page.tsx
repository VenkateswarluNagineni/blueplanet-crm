import CatalogDashboardClient from '@/components/catalog/CatalogDashboardClient';
import { getSessionContext } from '@/lib/domain/auth';
import { getCompanySettings, canViewLandedCost } from '@/lib/domain/rbac';
import { assertPageAccess } from '@/lib/domain/page-access';
import { getCatalog } from '@/server/catalog/queries';

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
