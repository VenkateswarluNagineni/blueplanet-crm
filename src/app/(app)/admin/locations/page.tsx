import { getSessionContext } from '@/lib/domain/auth';
import { assertPageAccess } from '@/lib/domain/page-access';
import { getLocationsAdmin } from '@/server/locations/queries';
import { LocationsClient } from '@/components/locations/LocationsClient';

export const metadata = { title: 'Locations | BluePlanet' };

export default async function LocationsPage() {
  assertPageAccess(await getSessionContext(), 'admin');
  const locations = await getLocationsAdmin();
  return <LocationsClient locations={locations} />;
}
