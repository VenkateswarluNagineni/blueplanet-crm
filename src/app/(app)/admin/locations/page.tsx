import { getSessionContext } from '@/lib/auth';
import { assertPageAccess } from '@/lib/page-access';
import { getLocationsAdmin } from '@/server/queries/locations';
import { LocationsClient } from '@/components/LocationsClient';

export const metadata = { title: 'Locations | BluePlanet' };

export default async function LocationsPage() {
  assertPageAccess(await getSessionContext(), 'admin');
  const locations = await getLocationsAdmin();
  return <LocationsClient locations={locations} />;
}
