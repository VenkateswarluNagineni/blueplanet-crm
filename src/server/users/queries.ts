import 'server-only';
import { db } from '@/lib/db';

export type AdminUser = {
  id: string;
  email: string;
  role: string;
  active: boolean;
  partyName: string | null;
  locationNames: string[];
  createdAt: string;
};

/**
 * Closes a real gap found in the DESIGN.md v2.0 buyer-checklist audit: there
 * was no User Admin UI at all (accounts could only be created via seed/DB).
 * Powers the /admin/users screen.
 */
export async function getUsersAdmin(): Promise<AdminUser[]> {
  const users = await db.user.findMany({
    where: { deletedAt: null },
    include: {
      party: { select: { name: true } },
      userLocations: { include: { location: { select: { name: true } } } },
    },
    orderBy: { email: 'asc' },
  });

  return users.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    active: !u.deletedAt,
    partyName: u.party?.name ?? null,
    locationNames: u.userLocations.map((ul) => ul.location.name),
    createdAt: u.createdAt.toISOString(),
  }));
}
