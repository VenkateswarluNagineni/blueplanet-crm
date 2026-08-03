import { getSessionContext } from '@/lib/domain/auth';
import { assertPageAccess } from '@/lib/domain/page-access';
import { getApprovals } from '@/server/queries/approvals';
import { ApprovalsClient } from '@/components/approvals/ApprovalsClient';

export const metadata = { title: 'Approvals | BluePlanet' };

export default async function ApprovalsPage() {
  assertPageAccess(await getSessionContext(), 'admin');
  const approvals = await getApprovals();
  return <ApprovalsClient approvals={approvals} />;
}
