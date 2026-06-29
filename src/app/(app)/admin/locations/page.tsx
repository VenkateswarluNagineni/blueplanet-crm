import { redirect } from 'next/navigation';
import { getEffectiveRole } from '@/lib/auth';
import { getLocationsAdmin } from '@/server/queries/locations';
import { LocationsClient } from '@/components/LocationsClient';

export const metadata = { title: 'Locations | BluePlanet' };

export default async function LocationsPage() {
  const role = (await getEffectiveRole()) ?? 'SALES';
  if (role !== 'ADMIN') redirect('/');

  const locations = await getLocationsAdmin();
  return <LocationsClient locations={locations} />;
}
