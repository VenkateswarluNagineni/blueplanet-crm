'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { getSessionContext } from '@/lib/domain/auth';
import { requireRole } from '@/lib/domain/rbac';
import { USER_ROLES } from '@/lib/domain/reference';

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const emailSchema = z.string().trim().min(1, 'Email is required.').email('Enter a valid email address.');
const passwordSchema = z.string().min(8, 'Password must be at least 8 characters.');
const roleSchema = z.enum(USER_ROLES);

async function setUserLocations(tx: Prisma.TransactionClient, userId: string, locationIds: string[]) {
  await tx.userLocation.deleteMany({ where: { userId } });
  if (locationIds.length > 0) {
    await tx.userLocation.createMany({
      data: locationIds.map((locationId) => ({ userId, locationId })),
      skipDuplicates: true,
    });
  }
}

export async function createUserAction(input: {
  email: string;
  password: string;
  role: string;
  locationIds: string[];
}): Promise<ActionResult> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated.' };
  requireRole(ctx.role, ['ADMIN']);

  const email = emailSchema.safeParse(input.email);
  if (!email.success) return { ok: false, error: email.error.issues[0]?.message ?? 'Invalid email.' };
  const password = passwordSchema.safeParse(input.password);
  if (!password.success) return { ok: false, error: password.error.issues[0]?.message ?? 'Invalid password.' };
  const role = roleSchema.safeParse(input.role);
  if (!role.success) return { ok: false, error: 'Invalid role.' };

  const dupe = await db.user.findFirst({ where: { email: { equals: email.data, mode: 'insensitive' }, deletedAt: null } });
  if (dupe) return { ok: false, error: `A user with email "${email.data}" already exists.` };

  const passwordHash = await bcrypt.hash(password.data, 10);

  const user = await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { companyId: ctx.user.companyId, email: email.data, passwordHash, role: role.data },
    });
    await setUserLocations(tx, created.id, input.locationIds);
    return created;
  });

  revalidatePath('/admin/users');
  return { ok: true, id: user.id };
}

export async function updateUserAction(
  id: string,
  input: { role: string; locationIds: string[] },
): Promise<ActionResult> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated.' };
  requireRole(ctx.role, ['ADMIN']);

  const existing = await db.user.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return { ok: false, error: 'User not found.' };

  const role = roleSchema.safeParse(input.role);
  if (!role.success) return { ok: false, error: 'Invalid role.' };

  // An ADMIN can't demote their own only-remaining admin seat by accident —
  // require at least one other active ADMIN before this account can change role away from ADMIN.
  if (existing.id === ctx.user.id && existing.role === 'ADMIN' && role.data !== 'ADMIN') {
    const otherAdmins = await db.user.count({ where: { role: 'ADMIN', deletedAt: null, id: { not: id } } });
    if (otherAdmins === 0) {
      return { ok: false, error: 'You are the only active admin — assign another admin before changing your own role.' };
    }
  }

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { role: role.data } });
    await setUserLocations(tx, id, input.locationIds);
  });

  revalidatePath('/admin/users');
  return { ok: true };
}

export async function resetPasswordAction(id: string, newPassword: string): Promise<ActionResult> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated.' };
  requireRole(ctx.role, ['ADMIN']);

  const existing = await db.user.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return { ok: false, error: 'User not found.' };

  const password = passwordSchema.safeParse(newPassword);
  if (!password.success) return { ok: false, error: password.error.issues[0]?.message ?? 'Invalid password.' };

  const passwordHash = await bcrypt.hash(password.data, 10);
  await db.user.update({ where: { id }, data: { passwordHash } });
  revalidatePath('/admin/users');
  return { ok: true };
}

export async function deactivateUserAction(id: string): Promise<ActionResult> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated.' };
  requireRole(ctx.role, ['ADMIN']);

  if (id === ctx.user.id) return { ok: false, error: "You can't deactivate your own account while logged in as it." };

  const existing = await db.user.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return { ok: false, error: 'User not found.' };

  if (existing.role === 'ADMIN') {
    const otherAdmins = await db.user.count({ where: { role: 'ADMIN', deletedAt: null, id: { not: id } } });
    if (otherAdmins === 0) return { ok: false, error: 'Cannot deactivate the only active admin.' };
  }

  await db.user.update({ where: { id }, data: { deletedAt: new Date() } });
  revalidatePath('/admin/users');
  return { ok: true };
}

export async function reactivateUserAction(id: string): Promise<ActionResult> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated.' };
  requireRole(ctx.role, ['ADMIN']);

  const existing = await db.user.findFirst({ where: { id } });
  if (!existing) return { ok: false, error: 'User not found.' };

  await db.user.update({ where: { id }, data: { deletedAt: null } });
  revalidatePath('/admin/users');
  return { ok: true };
}
