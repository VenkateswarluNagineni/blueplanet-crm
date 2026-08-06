'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { destroySession, setImpersonation, getCurrentUser } from '@/lib/domain/auth';
import { canManageSettings } from '@/lib/domain/rbac';
import { ForbiddenError, ValidationError } from '@/lib/errors';

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect('/login');
}

export async function impersonateAction(role: string): Promise<void> {
  // setImpersonation itself enforces that only ADMINs may impersonate.
  await setImpersonation(role === 'ADMIN' ? null : role);
  revalidatePath('/', 'layout');
}

const SETTING_KEYS = [
  'salesCanViewLandedCost',
  'salesCanViewAllPipeline',
  'vendorCanViewFullInventory',
  'poApprovalThreshold',
] as const;

export async function updateSettingAction(key: string, value: boolean | number | null): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !canManageSettings(user.role)) throw new ForbiddenError();
  if (!SETTING_KEYS.includes(key as (typeof SETTING_KEYS)[number])) throw new ValidationError('Unknown setting');
  if (key === 'poApprovalThreshold' && typeof value !== 'number' && value !== null) {
    throw new ValidationError('Invalid threshold.');
  }

  await db.companySetting.upsert({
    where: { companyId: user.companyId },
    update: { [key]: value },
    create: { companyId: user.companyId, [key]: value },
  });
  revalidatePath('/', 'layout');
}
