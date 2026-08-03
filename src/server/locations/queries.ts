import 'server-only';
import { db } from '@/lib/db';

export type AdminLocation = {
  id: string;
  name: string;
  code: string;
  type: string;
  line1: string | null;
  line2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  phone: string | null;
  fax: string | null;
  defaultPriceLevel: string | null;
  slabCount: number;
  userCount: number;
};

/**
 * Every active company location with its address/contact details and live counts
 * (slabs currently present + logins assigned). Powers the Locations admin page.
 */
export async function getLocationsAdmin(): Promise<AdminLocation[]> {
  const [locations, slabGroups, userGroups] = await Promise.all([
    db.location.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }),
    db.inventoryItem.groupBy({ by: ['presentLocationId'], where: { deletedAt: null }, _count: { _all: true } }),
    db.userLocation.groupBy({ by: ['locationId'], _count: { _all: true } }),
  ]);

  const slabCountOf = new Map(slabGroups.map((g) => [g.presentLocationId, g._count._all]));
  const userCountOf = new Map(userGroups.map((g) => [g.locationId, g._count._all]));

  return locations.map((l) => ({
    id: l.id, name: l.name, code: l.code, type: l.type,
    line1: l.line1, line2: l.line2, city: l.city, region: l.region, postalCode: l.postalCode, country: l.country,
    phone: l.phone, fax: l.fax, defaultPriceLevel: l.defaultPriceLevel,
    slabCount: slabCountOf.get(l.id) ?? 0,
    userCount: userCountOf.get(l.id) ?? 0,
  }));
}
