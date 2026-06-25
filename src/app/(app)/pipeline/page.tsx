import { PipelineClient } from '@/components/PipelineClient';
import { getCurrentUser, getEffectiveRole } from '@/lib/auth';
import { getCompanySettings, canViewAllPipeline } from '@/lib/rbac';
import { getOpportunities, getAssociateOptions } from '@/server/queries/pipeline';

export const metadata = { title: 'Sales Pipeline | BluePlanet' };

const SALES_REP_SYSTEM_ID = 'REP-1042';

export default async function PipelinePage() {
  const user = await getCurrentUser();
  const role = (await getEffectiveRole()) ?? 'SALES';
  const settings = user ? await getCompanySettings(user.companyId) : null;

  // Sales reps see only their own pipeline unless granted global visibility.
  const seeAll = role === 'ADMIN' || (settings ? canViewAllPipeline(role, settings) : false);
  const scope = seeAll ? null : SALES_REP_SYSTEM_ID;

  const [opportunities, associates] = await Promise.all([getOpportunities(scope), getAssociateOptions()]);

  return <PipelineClient opportunities={opportunities} associates={associates} />;
}
