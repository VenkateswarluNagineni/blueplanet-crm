import 'server-only';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { db } from './db';

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'dev-insecure-secret-change-me',
);
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
