import { redirect } from 'next/navigation';
import { ApprovalsClient } from '@/components/ApprovalsClient';
import { getEffectiveRole } from '@/lib/auth';
import { getApprovals } from '@/server/queries/approvals';

export const metadata = { title: 'Approvals | BluePlanet' };

export default async function ApprovalsPage() {
  const role = (await getEffectiveRole()) ?? 'SALES';
  if (role !== 'ADMIN') redirect('/');

  const approvals = await getApprovals();
  return <ApprovalsClient approvals={approvals} />;
}
