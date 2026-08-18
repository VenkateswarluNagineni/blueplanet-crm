import { getSessionContext } from '@/lib/domain/auth';
import { assertPageAccess } from '@/lib/domain/page-access';
import { getUsersAdmin } from '@/server/users/queries';
import { getLocationsAdmin } from '@/server/locations/queries';
import { UsersClient } from '@/components/admin/UsersClient';

export const metadata = { title: 'Users | BluePlanet' };

export default async function UsersPage() {
  const ctx = assertPageAccess(await getSessionContext(), 'admin');
  const [users, locations] = await Promise.all([getUsersAdmin(), getLocationsAdmin()]);
  return (
    <UsersClient
      users={users}
      locations={locations.map((l) => ({ id: l.id, name: l.name }))}
      currentUserId={ctx.user.id}
    />
  );
}
