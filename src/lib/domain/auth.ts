import 'server-only';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { db } from '../db';
import { env } from '../env';

const SECRET = new TextEncoder().encode(env.AUTH_SECRET);
const SESSION_COOKIE = 'bp_session';
const IMPERSONATE_COOKIE = 'bp_impersonate';
const VALID_ROLES = ['ADMIN', 'SALES', 'VENDOR'];

export type SessionUser = {
  id: string;
  email: string;
  role: string;
  companyId: string;
};

export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    secure: process.env.NODE_ENV === 'production',
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(IMPERSONATE_COOKIE);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    const uid = payload.uid as string;
    const user = await db.user.findFirst({ where: { id: uid, deletedAt: null } });
    if (!user) return null;
    return { id: user.id, email: user.email, role: user.role, companyId: user.companyId };
  } catch {
    return null;
  }
}

/**
 * The role used for authorization decisions. ADMINs may impersonate another
 * role for demos/QA; everyone else gets their real role. Because impersonation
 * lives in a server-read cookie, server-side RBAC still honors it (it is not a
 * client-only illusion), but only an ADMIN can set it.
 */
export async function getEffectiveRole(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role === 'ADMIN') {
    const store = await cookies();
    const imp = store.get(IMPERSONATE_COOKIE)?.value;
    if (imp && VALID_ROLES.includes(imp)) return imp;
  }
  return user.role;
}

export type SessionContext = {
  user: SessionUser;
  role: string; // effective role (honors ADMIN impersonation)
  isAdmin: boolean;
  /** The Party this login acts as, if linked (Associate for SALES, Vendor for VENDOR). */
  party: { id: string; type: string; systemId: string | null; name: string } | null;
  /** Convenience: the rep's systemId when the session is (or impersonates) a sales associate. */
  associateSystemId: string | null;
  /** Convenience: the vendor Party id when the session is a vendor. */
  vendorPartyId: string | null;
  /** Locations this login is assigned to (drives catalog/inventory scoping). */
  locationIds: string[];
  locationNames: string[];
  /** The viewer's saved dashboard widget layout (ordered widget keys), or null for the role default. */
  dashboardLayout: string[] | null;
};

/**
 * The single source of truth for "who is acting and what may they see" — resolves
 * the logged-in user to their effective role, the Party they act as, and their
 * assigned locations. Returns null when unauthenticated. Use this instead of any
 * hardcoded rep id. ADMINs impersonating SALES borrow the linked associate (if the
 * admin login itself has a party) so demos behave like a real seller.
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const role = (await getEffectiveRole()) ?? user.role;

  const record = await db.user.findFirst({
    where: { id: user.id, deletedAt: null },
    include: {
      party: { select: { id: true, type: true, systemId: true, name: true } },
      userLocations: { include: { location: { select: { id: true, name: true } } } },
    },
  });

  const party = record?.party ?? null;
  const locationIds = record?.userLocations.map((ul) => ul.location.id) ?? [];
  const locationNames = record?.userLocations.map((ul) => ul.location.name) ?? [];

  // dashboardLayout is a Json column; accept only an array of strings, else fall back to the role default.
  const rawLayout = record?.dashboardLayout;
  const dashboardLayout =
    Array.isArray(rawLayout) && rawLayout.every((k) => typeof k === 'string')
      ? (rawLayout as string[])
      : null;

  return {
    user,
    role,
    isAdmin: role === 'ADMIN',
    party,
    associateSystemId: party?.type === 'ASSOCIATE' ? party.systemId : null,
    vendorPartyId: party?.type === 'VENDOR' ? party.id : null,
    locationIds,
    locationNames,
    dashboardLayout,
  };
}

export async function setImpersonation(role: string | null): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') return;
  const store = await cookies();
  if (!role || role === 'ADMIN') {
    store.delete(IMPERSONATE_COOKIE);
  } else if (VALID_ROLES.includes(role)) {
    store.set(IMPERSONATE_COOKIE, role, { httpOnly: true, sameSite: 'lax', path: '/' });
  }
}
