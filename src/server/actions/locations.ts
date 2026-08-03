'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { getSessionContext } from '@/lib/domain/auth';
import { requireRole } from '@/lib/domain/rbac';
import { LOCATION_TYPES, COUNTRIES } from '@/lib/domain/reference';

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const optStr = z.string().trim().max(200).optional().or(z.literal(''));
const locationSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(160),
  code: z.string().trim().min(1, 'Short code is required.').max(40),
  type: z.enum(LOCATION_TYPES).default('Warehouse'),
  line1: optStr,
  line2: optStr,
  city: optStr,
  region: optStr,
  postalCode: optStr,
  country: z.enum(COUNTRIES).optional(),
  phone: optStr,
  fax: optStr,
  defaultPriceLevel: optStr,
});
export type LocationInput = z.input<typeof locationSchema>;

/** Normalize the validated input into Prisma data (empty strings → null). */
function toData(d: z.infer<typeof locationSchema>) {
  return {
    name: d.name, code: d.code, type: d.type,
    line1: d.line1 || null, line2: d.line2 || null, city: d.city || null, region: d.region || null,
    postalCode: d.postalCode || null, country: d.country || null,
    phone: d.phone || null, fax: d.fax || null, defaultPriceLevel: d.defaultPriceLevel || null,
  };
}

export async function createLocationAction(input: LocationInput): Promise<ActionResult> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated.' };
  requireRole(ctx.role, ['ADMIN']);

  const parsed = locationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid location.' };
  const d = parsed.data;

  const dupe = await db.location.findFirst({
    where: { companyId: ctx.user.companyId, code: { equals: d.code, mode: 'insensitive' }, deletedAt: null },
    select: { id: true },
  });
  if (dupe) return { ok: false, error: `A location with code "${d.code}" already exists.` };

  const loc = await db.location.create({ data: { companyId: ctx.user.companyId, ...toData(d) } });
  revalidatePath('/admin/locations');
  revalidatePath('/inventory');
  return { ok: true, id: loc.id };
}

export async function updateLocationAction(id: string, input: LocationInput): Promise<ActionResult> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated.' };
  requireRole(ctx.role, ['ADMIN']);

  const existing = await db.location.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return { ok: false, error: 'Location not found.' };

  const parsed = locationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid location.' };
  const d = parsed.data;

  const dupe = await db.location.findFirst({
    where: { companyId: existing.companyId, code: { equals: d.code, mode: 'insensitive' }, deletedAt: null, id: { not: id } },
    select: { id: true },
  });
  if (dupe) return { ok: false, error: `Another location already uses code "${d.code}".` };

  await db.location.update({ where: { id }, data: toData(d) });
  revalidatePath('/admin/locations');
  revalidatePath('/inventory');
  return { ok: true };
}

export async function softDeleteLocationAction(id: string): Promise<ActionResult> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated.' };
  requireRole(ctx.role, ['ADMIN']);

  const existing = await db.location.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return { ok: false, error: 'Location not found.' };

  const slabCount = await db.inventoryItem.count({ where: { presentLocationId: id, deletedAt: null } });
  if (slabCount > 0) return { ok: false, error: `Cannot delete — ${slabCount} slab(s) are still stored here. Transfer them first.` };

  await db.location.update({ where: { id }, data: { deletedAt: new Date() } });
  revalidatePath('/admin/locations');
  revalidatePath('/inventory');
  return { ok: true };
}
