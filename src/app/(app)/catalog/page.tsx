import CatalogDashboardClient from '@/components/CatalogDashboardClient';
import { getCurrentUser, getEffectiveRole } from '@/lib/auth';
import { getCompanySettings, canViewLandedCost } from '@/lib/rbac';
import { getCatalog } from '@/server/queries/catalog';

export const metadata = {
  title: 'Material Catalog | BluePlanet',
  description: 'Master Rock Catalog and Available Inventory',
};

export default async function CatalogPage() {
  const user = await getCurrentUser();
  const role = (await getEffectiveRole()) ?? 'SALES';
  const settings = user ? await getCompanySettings(user.companyId) : null;
  const canViewCost = settings ? canViewLandedCost(role, settings) : false;

  const products = await getCatalog(canViewCost);

  return <CatalogDashboardClient products={products} canViewCost={canViewCost} />;
}
