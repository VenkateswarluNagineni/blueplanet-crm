import { getSessionContext } from '@/lib/auth';
import { assertPageAccess } from '@/lib/page-access';
import { getApprovals } from '@/server/queries/approvals';
import { ApprovalsClient } from '@/components/approvals/ApprovalsClient';

export const metadata = { title: 'Approvals | BluePlanet' };

export default async function ApprovalsPage() {
  assertPageAccess(await getSessionContext(), 'admin');
  const approvals = await getApprovals();
  return <ApprovalsClient approvals={approvals} />;
}
