'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/domain/auth';

export type ActionResult = { ok: true } | { ok: false; error: string };

// A layout is just an ordered list of widget keys. We cap the length defensively;
// the client only ever sends keys from the role-aware catalog.
const LayoutSchema = z.object({
  layout: z.array(z.string().min(1).max(64)).max(32),
});

/**
 * Persist the signed-in user's personal dashboard layout (which widgets, in what
 * order). Each login owns its own layout, so an admin, a sales rep, and a vendor
 * each curate their own view. Passing an empty array is valid (a blank board);
 * passing null is not — to reset to the role default, callers delete their saved
 * layout via setDashboardLayoutAction with the role's default keys.
 */
export async function setDashboardLayoutAction(layout: string[]): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const parsed = LayoutSchema.safeParse({ layout });
  if (!parsed.success) return { ok: false, error: 'Invalid dashboard layout.' };

  await db.user.update({
    where: { id: user.id },
    data: { dashboardLayout: parsed.data.layout },
  });

  revalidatePath('/');
  return { ok: true };
}
